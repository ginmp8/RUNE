#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "scripts"
STUDIO_SRC = ROOT / "services/rune/apps/rune-studio/src"
for item in (SCRIPT_DIR, STUDIO_SRC):
    if str(item) not in sys.path:
        sys.path.insert(0, str(item))

from rune_studio.client import RuneClient  # noqa: E402
from verify_compose_pipeline import wait_job  # noqa: E402
from verify_distributed_pipeline import (  # noqa: E402
    ManagedProcess,
    ensure_alive,
    free_port,
    start_process,
    wait_http,
    wait_tcp,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify durable dispatch recovery, dead-letter terminal handling, and replay.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dotnet", type=Path, required=True)
    parser.add_argument("--nats-server", type=Path, required=True)
    parser.add_argument("--chromium", type=Path, default=Path("/usr/bin/chromium"))
    parser.add_argument("--timeout-seconds", type=int, default=120)
    return parser.parse_args()


def post_json(base_url: str, path: str, payload: dict[str, Any], timeout: int = 30) -> tuple[int, Any]:
    request = Request(
        base_url.rstrip("/") + path,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            data = response.read()
            return response.status, json.loads(data) if data else None
    except HTTPError as error:
        data = error.read()
        return error.code, json.loads(data) if data else None


def get_json(base_url: str, path: str, timeout: int = 30) -> tuple[int, Any]:
    request = Request(base_url.rstrip("/") + path, method="GET")
    try:
        with urlopen(request, timeout=timeout) as response:
            data = response.read()
            return response.status, json.loads(data) if data else None
    except HTTPError as error:
        data = error.read()
        return error.code, json.loads(data) if data else None


def stop(process: ManagedProcess, timeout: int = 15) -> dict[str, Any]:
    if process.process.poll() is not None:
        try:
            process.log_stream.close()
        except Exception:
            pass
        return {"name": process.name, "exitCode": process.process.returncode, "graceful": True, "alreadyStopped": True}
    try:
        os.killpg(process.process.pid, signal.SIGTERM)
        code = process.process.wait(timeout=timeout)
        graceful = True
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            code = process.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            code = None
        graceful = False
    finally:
        try:
            process.log_stream.close()
        except Exception:
            pass
    return {"name": process.name, "exitCode": code, "graceful": graceful, "alreadyStopped": False}


def wait_for_dispatch_failure(client: RuneClient, render_id: str, timeout: int) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get_status(render_id)
        if str(job.get("dispatchStatus", "")).lower() == "pending" and job.get("dispatchError"):
            return job
        time.sleep(0.25)
    raise TimeoutError(f"Render {render_id} did not record a durable dispatch failure")


def wait_for_dead_letter(client: RuneClient, render_id: str, timeout: int) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = client.get_status(render_id)
        if str(job.get("status", "")).lower() == "failed" and job.get("deadLetteredAt"):
            return job
        time.sleep(0.25)
    raise TimeoutError(f"Render {render_id} did not reach dead-letter state")


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    log_dir = output / "logs"
    log_dir.mkdir(exist_ok=True)
    data_root = output / "data"
    data_root.mkdir(exist_ok=True)
    cache_root = output / "cache"
    cache_root.mkdir(exist_ok=True)
    temp_root = output / "tmp"
    temp_root.mkdir(exist_ok=True)
    nats_store = output / "jetstream"
    nats_store.mkdir(exist_ok=True)

    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    api_dll = ROOT / "services/rune/apps/rune-api/bin/Release/net10.0/Rune.Api.dll"
    worker_dll = ROOT / "services/rune/apps/rune-worker/bin/Release/net10.0/Rune.Worker.dll"
    for path in (args.dotnet, args.nats_server, args.chromium, api_dll, worker_dll):
        if not path.is_file():
            raise FileNotFoundError(path)

    nats_port = free_port()
    monitor_port = free_port()
    api_port = free_port()
    nats_url = f"nats://127.0.0.1:{nats_port}"
    base_url = f"http://127.0.0.1:{api_port}"
    env = os.environ.copy()
    env.update(
        {
            "DOTNET_ROOT": str(args.dotnet.parent),
            "DOTNET_MULTILEVEL_LOOKUP": "0",
            "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
            "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
            "DOTNET_NOLOGO": "1",
            "RUNE_DATA_ROOT": str(data_root),
            "RUNE_CACHE_ROOT": str(cache_root),
            "RUNE_RENDER_CACHE_ROOT": str(cache_root),
            "TMPDIR": str(temp_root),
            "RUNE_CHROMIUM_EXECUTABLE_PATH": str(args.chromium.resolve()),
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH": str(args.chromium.resolve()),
            "NATS_URL": nats_url,
            "RUNE_BROWSER_CONCURRENCY": "1",
            "RUNE_JOB_LEASE_SECONDS": "5",
            "RUNE_NATS_ACK_WAIT_SECONDS": "8",
            "RUNE_NATS_NAK_DELAY_SECONDS": "1",
            "RUNE_DISPATCH_PUBLISH_TIMEOUT_SECONDS": "2",
        }
    )
    env.pop("PLATFORM", None)
    env.pop("Platform", None)

    active: list[ManagedProcess] = []
    client: RuneClient | None = None
    shutdown: list[dict[str, Any]] = []
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "version": version,
        "runtime": "local-processes-no-docker",
        "checks": {},
        "artifacts": [],
    }
    try:
        api = start_process(
            "rune-api",
            [str(args.dotnet.resolve()), str(api_dll.resolve())],
            log_dir=log_dir,
            env={**env, "ASPNETCORE_URLS": base_url, "RUNE_DISPATCH_PROVIDER": "nats"},
            cwd=api_dll.parent,
        )
        active.append(api)
        wait_http(f"{base_url}/health")
        ensure_alive(api)
        client = RuneClient(base_url, timeout=float(args.timeout_seconds))

        outage_source = "# Durable outbox recovery\n\nThis job is accepted while NATS is unavailable."
        outage_job = client.render(
            "markdown",
            outage_source,
            "staticHtml",
            idempotency_key=f"rune-{version}-outbox-outage",
            document_name="outbox-outage.md",
        )
        if not outage_job.render_id:
            raise RuntimeError("Outage render was not accepted")
        failed_dispatch = wait_for_dispatch_failure(client, outage_job.render_id, 30)
        event_id_before = failed_dispatch.get("dispatchEventId")
        generation_before = failed_dispatch.get("dispatchGeneration")
        package_path_before = failed_dispatch.get("packagePath")

        nats = start_process(
            "nats-server",
            [
                str(args.nats_server.resolve()),
                "--jetstream",
                "--store_dir",
                str(nats_store),
                "--port",
                str(nats_port),
                "--http_port",
                str(monitor_port),
            ],
            log_dir=log_dir,
            env=env,
            cwd=output,
        )
        active.append(nats)
        wait_tcp("127.0.0.1", nats_port)
        wait_http(f"http://127.0.0.1:{monitor_port}/healthz")
        ensure_alive(nats)

        worker = start_process(
            "rune-worker-normal",
            [str(args.dotnet.resolve()), str(worker_dll.resolve())],
            log_dir=log_dir,
            env=env,
            cwd=worker_dll.parent,
        )
        active.append(worker)
        time.sleep(1)
        ensure_alive(worker)
        recovered = wait_job(client, outage_job.render_id, args.timeout_seconds)
        if recovered.get("dispatchEventId") != event_id_before:
            raise RuntimeError("Outbox recovery changed the deterministic dispatch event id")
        if recovered.get("dispatchGeneration") != generation_before:
            raise RuntimeError("Outbox recovery changed dispatch generation")
        if recovered.get("packagePath") != package_path_before:
            raise RuntimeError("Outbox recovery changed package identity")
        outage_content = client.get_content(outage_job.render_id).content or b""
        outage_path = output / "outbox-recovered.html"
        outage_path.write_bytes(outage_content)
        manifest["checks"]["durableOutboxRecovery"] = {
            "renderId": outage_job.render_id,
            "acceptedWithoutNats": True,
            "dispatchFailureRecorded": True,
            "sameEventId": True,
            "sameGeneration": True,
            "samePackagePath": True,
            "completedAfterNatsStarted": True,
            "dispatchAttempts": recovered.get("dispatchAttempts"),
        }
        manifest["artifacts"].append(
            {
                "name": outage_path.name,
                "contentType": "text/html; charset=utf-8",
                "size": len(outage_content),
                "sha256": hashlib.sha256(outage_content).hexdigest(),
            }
        )

        shutdown.append(stop(worker))
        failure_root = output / "failure-once"
        failure_root.mkdir(exist_ok=True)
        failing_worker = start_process(
            "rune-worker-failing",
            [str(args.dotnet.resolve()), str(worker_dll.resolve())],
            log_dir=log_dir,
            env={
                **env,
                "RUNE_FAILURE_POINTS": "before-render",
                "RUNE_FAILURE_ACTION": "throw",
                "RUNE_FAILURE_MODE": "always",
                "RUNE_FAILURE_ONCE_ROOT": str(failure_root),
            },
            cwd=worker_dll.parent,
        )
        active.append(failing_worker)
        time.sleep(1)
        ensure_alive(failing_worker)

        poison_job = client.render(
            "markdown",
            "# Poison message terminal path\n\nThe Worker is configured to fail before render.",
            "pdf",
            options={"timeoutSeconds": 30},
            idempotency_key=f"rune-{version}-dead-letter-replay",
            document_name="dead-letter-replay.md",
        )
        if not poison_job.render_id:
            raise RuntimeError("Poison render was not accepted")
        dead = wait_for_dead_letter(client, poison_job.render_id, args.timeout_seconds)
        status, dead_letters = get_json(base_url, "/v1/dead-letters?limit=200")
        if status != 200:
            raise RuntimeError(f"Dead-letter endpoint returned {status}: {dead_letters}")
        items = dead_letters.get("items") if isinstance(dead_letters, dict) else None
        if not isinstance(items, list) or not any(str(item.get("id")) == poison_job.render_id for item in items):
            raise RuntimeError("Dead-letter endpoint did not list the terminated render")
        dead_event_id = dead.get("dispatchEventId")
        dead_generation = int(dead.get("dispatchGeneration", 0))
        dead_attempt = int(dead.get("attempt", 0))
        if dead_attempt < int(dead.get("maximumAttempts", 4)):
            raise RuntimeError(f"Job dead-lettered before exhausting attempts: {dead_attempt}")

        shutdown.append(stop(failing_worker))
        replay_worker = start_process(
            "rune-worker-replay",
            [str(args.dotnet.resolve()), str(worker_dll.resolve())],
            log_dir=log_dir,
            env=env,
            cwd=worker_dll.parent,
        )
        active.append(replay_worker)
        time.sleep(1)
        ensure_alive(replay_worker)
        replay_status, replay_body = post_json(
            base_url,
            f"/v1/renders/{poison_job.render_id}/replay",
            {"resetAttempts": True},
            timeout=30,
        )
        if replay_status != 202:
            raise RuntimeError(f"Replay returned {replay_status}: {replay_body}")
        replayed = wait_job(client, poison_job.render_id, args.timeout_seconds)
        if replayed.get("deadLetteredAt") is not None or replayed.get("deadLetterReason") is not None:
            raise RuntimeError("Replay did not clear dead-letter state")
        if int(replayed.get("dispatchGeneration", 0)) <= dead_generation:
            raise RuntimeError("Replay did not create a new dispatch generation")
        if replayed.get("dispatchEventId") == dead_event_id:
            raise RuntimeError("Replay reused the previous generation event id")
        replay_content = client.get_content(poison_job.render_id).content or b""
        replay_path = output / "dead-letter-replayed.pdf"
        replay_path.write_bytes(replay_content)
        manifest["checks"]["deadLetterReplay"] = {
            "renderId": poison_job.render_id,
            "terminalAttempt": dead_attempt,
            "deadLetterListed": True,
            "terminateReason": dead.get("deadLetterReason"),
            "replayAccepted": True,
            "newDispatchGeneration": replayed.get("dispatchGeneration"),
            "newEventId": True,
            "completedAfterReplay": True,
        }
        manifest["artifacts"].append(
            {
                "name": replay_path.name,
                "contentType": "application/pdf",
                "size": len(replay_content),
                "sha256": hashlib.sha256(replay_content).hexdigest(),
            }
        )

        metrics = urlopen(f"{base_url}/metrics", timeout=10).read().decode("utf-8")
        metrics_path = output / "metrics.prom"
        metrics_path.write_text(metrics, encoding="utf-8")
        required_metrics = ["rune_dispatch_failure_total", "rune_dispatch_published_total", "rune_dead_letter_total"]
        missing = [name for name in required_metrics if name not in metrics]
        if missing:
            raise RuntimeError(f"Missing operational metrics: {missing}")
        manifest["checks"]["metrics"] = {"required": required_metrics, "present": True}
        manifest["artifacts"].append(
            {
                "name": metrics_path.name,
                "contentType": "text/plain",
                "size": metrics_path.stat().st_size,
                "sha256": hashlib.sha256(metrics_path.read_bytes()).hexdigest(),
            }
        )

        shutdown.extend([stop(replay_worker), stop(api), stop(nats)])
        manifest["checks"]["shutdown"] = shutdown
        manifest["completedAtUtc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(
            f"DISPATCH RECOVERY PASSED: RUNE {version}; durable outage recovery; dead-letter terminal path; replay; metrics",
            flush=True,
        )
        return 0
    finally:
        if client is not None:
            client.close()
        for process in reversed(active):
            if process.process.poll() is None:
                stop(process, timeout=5)
            else:
                try:
                    process.log_stream.close()
                except Exception:
                    pass


if __name__ == "__main__":
    raise SystemExit(main())
