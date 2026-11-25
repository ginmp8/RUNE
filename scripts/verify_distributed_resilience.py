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
import uuid
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

from generate_api_evidence import validate_artifact  # noqa: E402
from rune_studio.client import RuneClient  # noqa: E402
from verify_compose_pipeline import publish_jetstream, stream_snapshot, wait_job  # noqa: E402
from verify_distributed_pipeline import (  # noqa: E402
    ManagedProcess,
    ensure_alive,
    free_port,
    source_fixture,
    start_process,
    wait_http,
    wait_tcp,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exercise local API/NATS/Worker persistence, duplicate delivery, and restart recovery without Docker."
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dotnet", type=Path, required=True)
    parser.add_argument("--nats-server", type=Path, required=True)
    parser.add_argument("--chromium", type=Path, default=Path("/usr/bin/chromium"))
    parser.add_argument("--api-dll", type=Path)
    parser.add_argument("--worker-dll", type=Path)
    parser.add_argument("--timeout-seconds", type=int, default=240)
    return parser.parse_args()


def request_json(base_url: str, path: str, payload: dict[str, Any], timeout: int = 240) -> tuple[int, bytes]:
    request = Request(
        base_url.rstrip("/") + path,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, error.read()


def artifact(client: RuneClient, render_id: str, output_format: str, path: Path) -> tuple[bytes, str]:
    result = client.get_content(render_id)
    content = result.content or b""
    content_type = result.content_type or "application/octet-stream"
    validate_artifact(output_format, content, content_type)
    path.write_bytes(content)
    return content, content_type


def stop_gracefully(process: ManagedProcess, timeout: int = 30) -> dict[str, Any]:
    if process.process.poll() is not None:
        process.log_stream.close()
        return {"name": process.name, "graceful": True, "exitCode": process.process.returncode, "alreadyStopped": True}
    try:
        os.killpg(process.process.pid, signal.SIGTERM)
        code = process.process.wait(timeout=timeout)
        return {"name": process.name, "graceful": True, "exitCode": code, "alreadyStopped": False}
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            code = process.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            code = None
        return {"name": process.name, "graceful": False, "exitCode": code, "alreadyStopped": False}
    finally:
        process.log_stream.close()


def kill_process(process: ManagedProcess) -> int | None:
    if process.process.poll() is None:
        try:
            os.killpg(process.process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    try:
        code = process.process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        code = None
    process.log_stream.close()
    return code


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
    api_dll = (args.api_dll or ROOT / "services/rune/apps/rune-api/bin/Release/net10.0/Rune.Api.dll").resolve()
    worker_dll = (args.worker_dll or ROOT / "services/rune/apps/rune-worker/bin/Release/net10.0/Rune.Worker.dll").resolve()
    for path, label in (
        (args.dotnet, "dotnet"),
        (args.nats_server, "nats-server"),
        (args.chromium, "chromium"),
        (api_dll, "API DLL"),
        (worker_dll, "worker DLL"),
    ):
        if not path.is_file():
            raise FileNotFoundError(f"{label} was not found: {path}")

    nats_port = free_port()
    monitor_port = free_port()
    api_port = free_port()
    nats_url = f"nats://127.0.0.1:{nats_port}"
    monitor_url = f"http://127.0.0.1:{monitor_port}"
    base_url = f"http://127.0.0.1:{api_port}"

    base_env = os.environ.copy()
    base_env.update(
        {
            "DOTNET_ROOT": str(args.dotnet.parent),
            "DOTNET_MULTILEVEL_LOOKUP": "0",
            "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
            "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
            "DOTNET_NOLOGO": "1",
            "RUNE_DATA_ROOT": str(data_root),
            "RUNE_CACHE_ROOT": str(cache_root),
            "TMPDIR": str(temp_root),
            "RUNE_CHROMIUM_EXECUTABLE_PATH": str(args.chromium.resolve()),
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH": str(args.chromium.resolve()),
            "NATS_URL": nats_url,
            "RUNE_BROWSER_CONCURRENCY": "1",
            "RUNE_JOB_LEASE_SECONDS": "10",
            "RUNE_NATS_ACK_WAIT_SECONDS": "12",
            "RUNE_NATS_NAK_DELAY_SECONDS": "2",
        }
    )
    base_env.pop("PLATFORM", None)
    base_env.pop("Platform", None)

    nats_command = [
        str(args.nats_server.resolve()),
        "--jetstream",
        "--store_dir",
        str(nats_store),
        "--port",
        str(nats_port),
        "--http_port",
        str(monitor_port),
    ]

    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "version": version,
        "runtime": "local-processes-no-docker",
        "pipeline": ["studio-client", "api", "nats-jetstream", "worker", "artifacts", "api"],
        "checks": {},
        "artifacts": [],
    }
    active: list[ManagedProcess] = []
    client: RuneClient | None = None
    shutdown_records: list[dict[str, Any]] = []
    try:
        nats1 = start_process("nats-server-before-restart", nats_command, log_dir=log_dir, env=base_env, cwd=output)
        active.append(nats1)
        wait_tcp("127.0.0.1", nats_port)
        wait_http(f"{monitor_url}/healthz")
        ensure_alive(nats1)

        api = start_process(
            "rune-api",
            [str(args.dotnet.resolve()), str(api_dll)],
            log_dir=log_dir,
            env={**base_env, "ASPNETCORE_URLS": base_url, "RUNE_DISPATCH_PROVIDER": "nats"},
            cwd=api_dll.parent,
        )
        active.append(api)
        wait_http(f"{base_url}/health")
        ensure_alive(api)
        client = RuneClient(base_url, timeout=float(args.timeout_seconds))
        features = client.get_features()
        dispatcher = features.get("dispatchProvider") or features.get("dispatching", {}).get("selected")
        if dispatcher != "nats":
            raise RuntimeError(f"Expected nats dispatcher, got {dispatcher!r}")
        manifest["checks"]["dispatcher"] = dispatcher

        source = source_fixture(version)
        source_digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
        options = {
            "theme": "professional",
            "pageSize": "A4",
            "includeCover": True,
            "includeToc": True,
            "timeoutSeconds": 180,
            "pdfAConformance": "2b",
            "headerTemplate": '<div style="font-size:9px;width:100%;text-align:center">RUNE RESILIENCE HEADER</div>',
            "footerTemplate": '<div style="font-size:9px;width:100%;text-align:center">RUNE RESILIENCE FOOTER <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
            "additionalCss": "body{font-family:'DejaVu Sans',sans-serif}",
            "width": 1440,
            "height": 1000,
        }

        queued = client.render(
            "markdown",
            source,
            "staticHtml",
            options=options,
            idempotency_key=f"rune-{version}-resilience-queued-{source_digest[:16]}",
            document_name="resilience-schematex.md",
        )
        if not queued.render_id:
            raise RuntimeError("API did not return a render id")
        time.sleep(1)
        queued_job = client.get_status(queued.render_id)
        if str(queued_job.get("status", "")).lower() != "queued":
            raise RuntimeError(f"Expected queued job with Worker stopped: {json.dumps(queued_job)}")
        before_restart = stream_snapshot(monitor_url)
        if before_restart["messages"] < 1:
            raise RuntimeError(f"JetStream did not retain the queued request: {before_restart}")
        manifest["checks"]["queuedBeforeWorker"] = {"renderId": queued.render_id, "stream": before_restart}

        shutdown_records.append(stop_gracefully(nats1))
        wait_deadline = time.monotonic() + 10
        while time.monotonic() < wait_deadline:
            try:
                with urlopen(f"{monitor_url}/healthz", timeout=0.5):
                    time.sleep(0.1)
            except OSError:
                break
        nats2 = start_process("nats-server-after-restart", nats_command, log_dir=log_dir, env=base_env, cwd=output)
        active.append(nats2)
        wait_tcp("127.0.0.1", nats_port)
        wait_http(f"{monitor_url}/healthz")
        ensure_alive(nats2)
        after_restart = stream_snapshot(monitor_url)
        if after_restart["messages"] < before_restart["messages"]:
            raise RuntimeError(f"JetStream message count regressed: {before_restart} -> {after_restart}")
        if str(client.get_status(queued.render_id).get("status", "")).lower() != "queued":
            raise RuntimeError("Queued job changed state while Worker was stopped")
        manifest["checks"]["natsRestartPersistence"] = {"before": before_restart, "after": after_restart}

        worker1 = start_process(
            "rune-worker-initial",
            [str(args.dotnet.resolve()), str(worker_dll)],
            log_dir=log_dir,
            env=base_env,
            cwd=worker_dll.parent,
        )
        active.append(worker1)
        time.sleep(1)
        ensure_alive(worker1)
        completed = wait_job(client, queued.render_id, args.timeout_seconds)
        html, html_type = artifact(client, queued.render_id, "staticHtml", output / "resilience-schematex.html")
        html_digest = hashlib.sha256(html).hexdigest()
        manifest["artifacts"].append(
            {"output": "staticHtml", "renderId": queued.render_id, "contentType": html_type, "size": len(html), "sha256": html_digest}
        )

        completed_attempt = int(completed.get("attempt", 0))
        package_path = str(completed.get("packagePath", ""))
        if not package_path:
            raise RuntimeError("Completed job did not expose packagePath")
        duplicate_event_id = uuid.uuid4()
        duplicate_command = {
            "metadata": {
                "eventId": str(duplicate_event_id),
                "correlationId": queued.render_id,
                "causationId": None,
                "schemaVersion": "1.0",
                "occurredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "headers": {"source": "local-resilience-validation"},
            },
            "renderId": queued.render_id,
            "packagePath": package_path,
        }
        first_ack = publish_jetstream("127.0.0.1", nats_port, "rune.render.requested.v1", duplicate_command, duplicate_event_id.hex)
        second_ack = publish_jetstream("127.0.0.1", nats_port, "rune.render.requested.v1", duplicate_command, duplicate_event_id.hex)
        time.sleep(2)
        after_duplicate = client.get_status(queued.render_id)
        duplicate_html = client.get_content(queued.render_id).content or b""
        if not second_ack.get("duplicate"):
            raise RuntimeError(f"JetStream did not suppress the broker duplicate: {second_ack}")
        if hashlib.sha256(duplicate_html).hexdigest() != html_digest:
            raise RuntimeError("Duplicate delivery modified the completed artifact")
        if int(after_duplicate.get("attempt", 0)) != completed_attempt:
            raise RuntimeError("Duplicate delivery incremented the completed job attempt")
        manifest["checks"]["duplicateMessage"] = {
            "firstAck": first_ack,
            "secondAck": second_ack,
            "artifactUnchanged": True,
            "attemptUnchanged": True,
        }

        pdf_job = client.render(
            "markdown",
            source,
            "pdf",
            options=options,
            idempotency_key=f"rune-{version}-resilience-pdf-{source_digest[:16]}",
            document_name="resilience-schematex.md",
        )
        if not pdf_job.render_id:
            raise RuntimeError("No render id for PDF validation")
        wait_job(client, pdf_job.render_id, args.timeout_seconds)
        pdf_path = output / "resilience-schematex.pdf"
        pdf, pdf_type = artifact(client, pdf_job.render_id, "pdf", pdf_path)
        text = subprocess.run(["pdftotext", str(pdf_path), "-"], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.decode("utf-8", errors="replace")
        if "RUNE RESILIENCE HEADER" not in text or "RUNE RESILIENCE FOOTER" not in text:
            raise RuntimeError("PDF header/footer validation failed")
        fonts = subprocess.run(["pdffonts", str(pdf_path)], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.decode("utf-8", errors="replace")
        if "DejaVu" not in fonts:
            raise RuntimeError(f"Expected DejaVu font in PDF:\n{fonts}")
        (output / "resilience-schematex-pdffonts.txt").write_text(fonts, encoding="utf-8")
        manifest["checks"]["pdfHeadersFootersFonts"] = {"renderId": pdf_job.render_id, "header": True, "footer": True, "font": "DejaVu"}
        manifest["artifacts"].append(
            {"output": "pdf", "renderId": pdf_job.render_id, "contentType": pdf_type, "size": len(pdf), "sha256": hashlib.sha256(pdf).hexdigest()}
        )

        composite_payload = {
            "sourceType": "composite",
            "outputFormat": "pdf",
            "documentName": "resilience-composite.md",
            "composite": {
                "includePartTitles": True,
                "pageBreakBetweenParts": True,
                "rewriteTableOfContents": True,
                "maximumDepth": 4,
                "parts": [
                    {"name": "Introduction", "sourceType": "markdown", "content": "# Introduction\n\nDistributed resilience evidence."},
                    {"name": "SchemaTex", "sourceType": "markdown", "content": source},
                ],
            },
            "options": {**options, "includeToc": True, "tagged": True, "outline": True, "emitStructureMap": True},
            "idempotencyKey": f"rune-{version}-resilience-composite-{source_digest[:16]}",
        }
        status, body = request_json(base_url, "/v1/render", composite_payload, args.timeout_seconds)
        if status != 202:
            raise RuntimeError(f"Composite render rejected: {status}: {body.decode(errors='replace')}")
        composite_id = json.loads(body)["renderId"]
        wait_job(client, composite_id, args.timeout_seconds)
        composite_path = output / "resilience-composite.pdf"
        composite, composite_type = artifact(client, composite_id, "pdf", composite_path)
        composite_text = subprocess.run(["pdftotext", str(composite_path), "-"], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.decode("utf-8", errors="replace")
        if "Introduction" not in composite_text or "SchemaTex" not in composite_text:
            raise RuntimeError("Composite PDF did not contain both declared parts")
        manifest["checks"]["composite"] = {"renderId": composite_id, "parts": ["Introduction", "SchemaTex"], "nativePdfImportUsed": False}
        manifest["artifacts"].append(
            {"output": "compositePdf", "renderId": composite_id, "contentType": composite_type, "size": len(composite), "sha256": hashlib.sha256(composite).hexdigest()}
        )

        shutdown_records.append(stop_gracefully(worker1))
        failure_once_root = output / "failure-once"
        failure_once_root.mkdir(exist_ok=True)
        crash_worker = start_process(
            "rune-worker-injected-crash",
            [str(args.dotnet.resolve()), str(worker_dll)],
            log_dir=log_dir,
            env={
                **base_env,
                "RUNE_FAILURE_POINTS": "during-chromium",
                "RUNE_FAILURE_ACTION": "crash",
                "RUNE_FAILURE_MODE": "once",
                "RUNE_FAILURE_ONCE_ROOT": str(failure_once_root),
            },
            cwd=worker_dll.parent,
        )
        active.append(crash_worker)
        time.sleep(1)
        ensure_alive(crash_worker)

        restart_source = source + "\n\n" + "\n\n".join(
            f"## Restart section {index}\n\nWorker restart recovery evidence with deterministic text content."
            for index in range(1, 41)
        )
        restart = client.render(
            "markdown",
            restart_source,
            "png",
            options={**options, "height": 2400, "timeoutSeconds": 180},
            idempotency_key=f"rune-{version}-resilience-worker-restart-{source_digest[:16]}",
            document_name="worker-restart.md",
        )
        if not restart.render_id:
            raise RuntimeError("No render id for Worker restart scenario")
        crash_code = crash_worker.process.wait(timeout=60)
        crash_worker.log_stream.close()
        active_job = client.get_status(restart.render_id)
        interrupted_attempt = int(active_job.get("attempt", 0))
        if interrupted_attempt < 1 or str(active_job.get("status", "")).lower() not in {"claimed", "rendering", "queued"}:
            raise RuntimeError(f"Injected crash did not leave recoverable work: {json.dumps(active_job)}")
        worker2 = start_process(
            "rune-worker-restarted",
            [str(args.dotnet.resolve()), str(worker_dll)],
            log_dir=log_dir,
            env=base_env,
            cwd=worker_dll.parent,
        )
        active.append(worker2)
        time.sleep(1)
        ensure_alive(worker2)
        print("resilience: waiting for replacement Worker recovery", flush=True)
        recovered = wait_job(client, restart.render_id, args.timeout_seconds)
        print("resilience: replacement Worker completed", flush=True)
        recovered_attempt = int(recovered.get("attempt", 0))
        if recovered_attempt <= interrupted_attempt:
            raise RuntimeError(f"Expected a new attempt after Worker restart: {interrupted_attempt} -> {recovered_attempt}")
        print("resilience: downloading recovered PNG", flush=True)
        restart_png, restart_type = artifact(client, restart.render_id, "png", output / "worker-restart-recovered.png")
        print("resilience: recovered PNG downloaded", flush=True)
        manifest["checks"]["workerRestart"] = {
            "renderId": restart.render_id,
            "interruptedState": active_job.get("status"),
            "interruptedAttempt": interrupted_attempt,
            "completedAttempt": recovered_attempt,
            "killedExitCode": crash_code,
            "failurePoint": "during-chromium",
            "recovered": True,
        }
        manifest["artifacts"].append(
            {"output": "restartPng", "renderId": restart.render_id, "contentType": restart_type, "size": len(restart_png), "sha256": hashlib.sha256(restart_png).hexdigest()}
        )

        print("resilience: stopping replacement Worker", flush=True)
        shutdown_records.append(stop_gracefully(worker2, timeout=15))
        print("resilience: stopping API", flush=True)
        shutdown_records.append(stop_gracefully(api, timeout=15))
        print("resilience: stopping NATS", flush=True)
        shutdown_records.append(stop_gracefully(nats2, timeout=15))
        manifest["checks"]["gracefulShutdown"] = {
            "records": shutdown_records,
            "allGracefulExceptInjectedKill": all(item["graceful"] for item in shutdown_records),
        }
        manifest["checks"]["excludedScope"] = {
            "nativePdfImport": False,
            "s3": False,
            "pdfUa": False,
            "releaseSigning": False,
            "heavyLoad": False,
            "arbitraryProductHelpers": False,
        }
        manifest["completedAtUtc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(
            f"DISTRIBUTED RESILIENCE PASSED: RUNE {version}; queued persistence across NATS restart; "
            "duplicate suppression; Worker crash recovery; headers, footers, composite, and fonts"
        )
        return 0
    finally:
        if client is not None:
            client.close()
        for process in reversed(active):
            if process.process.poll() is None:
                process.stop()
            else:
                try:
                    process.log_stream.close()
                except Exception:
                    pass


if __name__ == "__main__":
    raise SystemExit(main())
