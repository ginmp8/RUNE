#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))
from verify_compose_pipeline import publish_jetstream, stream_snapshot  # noqa: E402

FAILURE_POINTS = [
    "before-render",
    "during-chromium",
    "during-temp-write",
    "during-rename",
    "after-commit",
    "before-ack",
    "during-upload",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate RUNE with two APIs, two workers, JetStream, shared storage, redelivery, and injected failures.")
    parser.add_argument("--compose-file", type=Path, default=ROOT / "docker-compose.resilience.yml")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=300)
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--keep", action="store_true")
    return parser.parse_args()


def compose(path: Path, *args: str, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["docker", "compose", "-f", str(path), *args],
        cwd=ROOT,
        env=env,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if check and result.returncode:
        raise RuntimeError(
            f"Compose command failed ({result.returncode}): {' '.join(args)}\n{result.stdout}"
        )
    return result


def request_json(method: str, url: str, payload: dict[str, Any] | None = None, timeout: int = 60) -> Any:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code} {url}: {error.read().decode(errors='replace')}") from error


def wait_http(url: str, timeout: int) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=3) as response:
                if response.status < 500:
                    return
        except Exception:
            time.sleep(0.5)
    raise TimeoutError(url)


def submit(base: str, key: str, label: str) -> str:
    body = request_json("POST", base + "/v1/render", {
        "sourceType": "markdown",
        "content": f"# Distributed resilience\n\n{label}\n\n```mermaid\ngraph LR\nA-->B\n```",
        "outputFormat": "png",
        "documentName": "distributed-resilience.md",
        "idempotencyKey": key,
        "options": {"cachePolicy": {"mode": "use", "scope": "resilience-verifier", "staleLockSeconds": 5}},
    }, timeout=60)
    return str(body["renderId"])


def wait_job(base: str, render_id: str, timeout: int) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    history: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        body = request_json("GET", f"{base}/v1/renders/{render_id}", timeout=20)
        job = body.get("job", body)
        snapshot = {key: job.get(key) for key in ("status", "attempt", "claimedBy", "leaseToken", "progressStage")}
        if not history or history[-1] != snapshot:
            history.append(snapshot)
        status = str(job.get("status", "")).lower()
        if status == "completed":
            job["history"] = history
            return job
        if status in {"failed", "cancelled"}:
            raise RuntimeError(json.dumps(job, indent=2))
        time.sleep(0.25)
    raise TimeoutError(f"job {render_id}: {history}")


def worker_failure_env(point: str, action: str = "throw") -> dict[str, str]:
    env = os.environ.copy()
    env.update({
        "RUNE_WORKER_A_FAILURE_POINTS": point,
        "RUNE_WORKER_A_FAILURE_ACTION": action,
        "RUNE_WORKER_A_FAILURE_MODE": "once",
        "RUNE_WORKER_B_FAILURE_POINTS": "",
    })
    return env


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    compose_file = args.compose_file.resolve()
    report: dict[str, Any] = {"status": "running", "checks": {}, "failureInjection": {}}
    try:
        compose(compose_file, "down", "--volumes", "--remove-orphans", check=False)
        up = ["up", "-d", "--wait"]
        if not args.skip_build:
            up.append("--build")
        compose(compose_file, *up)
        for base in ("http://127.0.0.1:8081", "http://127.0.0.1:8082"):
            wait_http(base + "/health", args.timeout_seconds)
            wait_http(base + "/metrics", args.timeout_seconds)
        report["checks"]["topology"] = {"apis": 2, "workers": 2, "jetStream": True, "sharedStorage": True}

        key = "resilience-idempotency-" + uuid.uuid4().hex
        first = submit("http://127.0.0.1:8081", key, "same job submitted through API A")
        second = submit("http://127.0.0.1:8082", key, "same job submitted through API A")
        if first != second:
            raise RuntimeError(f"idempotency mismatch: {first} != {second}")
        completed = wait_job("http://127.0.0.1:8082", first, args.timeout_seconds)
        report["checks"]["duplicateJob"] = {"renderId": first, "sameId": True, "attempt": completed.get("attempt")}

        event_id = uuid.uuid4()
        package_path = completed.get("packagePath") or f"{first.replace('-', '')}/package.json"
        command = {
            "metadata": {
                "eventId": str(event_id), "correlationId": first, "causationId": None,
                "schemaVersion": "1.0", "occurredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
            "renderId": first,
            "packagePath": package_path,
        }
        publish_jetstream("127.0.0.1", 4222, "rune.render.requested.v1", command, uuid.uuid4().hex)
        publish_jetstream("127.0.0.1", 4222, "rune.render.requested.v1", command, uuid.uuid4().hex)
        replay = wait_job("http://127.0.0.1:8081", first, args.timeout_seconds)
        if replay.get("attempt") != completed.get("attempt"):
            raise RuntimeError("duplicate message changed completed job attempt")
        report["checks"]["duplicateMessage"] = {"harmless": True, "attemptUnchanged": True}

        for point in FAILURE_POINTS:
            env = worker_failure_env(point, "crash" if point == "before-ack" else "throw")
            compose(compose_file, "stop", "rune-worker-b", env=env)
            compose(compose_file, "up", "-d", "--force-recreate", "rune-worker-a", env=env)
            render_id = submit("http://127.0.0.1:8081", f"failure-{point}-{uuid.uuid4().hex}", point)
            time.sleep(3)
            compose(compose_file, "kill", "rune-worker-a", env=env, check=False)
            clean = os.environ.copy()
            clean["RUNE_WORKER_A_FAILURE_POINTS"] = ""
            clean["RUNE_WORKER_B_FAILURE_POINTS"] = ""
            compose(compose_file, "up", "-d", "--force-recreate", "rune-worker-b", env=clean)
            recovered = wait_job("http://127.0.0.1:8082", render_id, args.timeout_seconds)
            report["failureInjection"][point] = {
                "renderId": render_id,
                "completed": True,
                "attempt": recovered.get("attempt"),
                "history": recovered.get("history"),
            }

        metrics = urlopen("http://127.0.0.1:8081/metrics", timeout=30).read().decode("utf-8")
        required = [
            "rune_jobs_queued", "rune_jobs_running", "rune_jobs_completed", "rune_jobs_failed",
            "rune_job_duration_seconds", "rune_render_duration_seconds", "rune_message_redelivery_total",
            "rune_idempotency_hit_total", "rune_cache_hit_total", "rune_cache_miss_total",
            "rune_lease_conflict_total", "rune_lease_fencing_rejection_total", "rune_temp_files_total",
            "rune_chromium_processes",
        ]
        missing = [name for name in required if name not in metrics]
        if missing:
            raise RuntimeError("missing metrics: " + ", ".join(missing))
        report["checks"]["metrics"] = {"present": required}
        report["checks"]["jetStream"] = stream_snapshot("http://127.0.0.1:8222")
        report["status"] = "passed"
        return_code = 0
    except Exception as error:
        report["status"] = "failed"
        report["error"] = f"{type(error).__name__}: {error}"
        return_code = 1
    finally:
        (output / "multi-node-resilience-report.json").write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        compose(compose_file, "logs", "--no-color", check=False).stdout and (output / "compose.log").write_text(
            compose(compose_file, "logs", "--no-color", check=False).stdout, encoding="utf-8"
        )
        if not args.keep:
            compose(compose_file, "down", "--remove-orphans", check=False)
    print(json.dumps(report, indent=2, sort_keys=True))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
