#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import math
import statistics
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PROFILES = {
    "smoke": {"jobs": 20, "duration_minutes": 0, "concurrency": 2},
    "load": {"jobs": 200, "duration_minutes": 0, "concurrency": 8},
    "sustained": {"jobs": 0, "duration_minutes": 30, "concurrency": 8},
    "soak": {"jobs": 0, "duration_minutes": 120, "concurrency": 4},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run short RUNE load, sustained, or soak profiles across multiple API nodes.")
    parser.add_argument("--profile", choices=PROFILES, default="smoke")
    parser.add_argument("--base-url", action="append", dest="base_urls", default=[])
    parser.add_argument("--jobs", type=int)
    parser.add_argument("--duration-minutes", type=float)
    parser.add_argument("--concurrency", type=int)
    parser.add_argument("--timeout-seconds", type=int, default=600)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--compose-file", type=Path, default=Path("docker-compose.resilience.yml"))
    return parser.parse_args()


def request_json(method: str, url: str, payload: dict[str, Any] | None = None, timeout: int = 60) -> tuple[int, Any]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url, data=body, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except HTTPError as error:
        raw = error.read()
        detail = raw.decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} {url}: {detail}") from error


def request_text(url: str, timeout: int = 30) -> str:
    with urlopen(url, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def submit(index: int, base_urls: list[str], duplicate_group: int | None = None) -> dict[str, Any]:
    base = base_urls[index % len(base_urls)].rstrip("/")
    logical = duplicate_group if duplicate_group is not None else index
    payload = {
        "sourceType": "markdown",
        "content": f"# RUNE resilience load {logical}\n\nJob index: {logical}\n\n```mermaid\ngraph LR\nA{logical}-->B{logical}\n```",
        "outputFormat": "png",
        "documentName": f"resilience-{logical}.md",
        "idempotencyKey": f"resilience-load-{logical}-{uuid.uuid5(uuid.NAMESPACE_URL, str(logical)).hex[:16]}",
        "options": {
            "cachePolicy": {
                "mode": "use",
                "scope": "resilience-load",
                "maximumAgeSeconds": 3600,
                "distributedLockTimeoutSeconds": 60,
                "staleLockSeconds": 10,
            }
        },
    }
    started = time.time()
    status, body = request_json("POST", base + "/v1/render", payload, timeout=120)
    render_id = str(body["renderId"])
    return {"index": index, "logical": logical, "baseUrl": base, "renderId": render_id, "submittedAt": started, "httpStatus": status}


def parse_date(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def wait_terminal(item: dict[str, Any], timeout_seconds: int) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    base = item["baseUrl"]
    while time.monotonic() < deadline:
        _, body = request_json("GET", f"{base}/v1/renders/{item['renderId']}", timeout=30)
        job = body.get("job", body)
        status = str(job.get("status", "")).lower()
        if status in {"completed", "failed", "cancelled"}:
            created = parse_date(job.get("createdAt"))
            started = parse_date(job.get("startedAt"))
            completed = parse_date(job.get("completedAt"))
            return {
                **item,
                "status": status,
                "attempt": int(job.get("attempt", 0)),
                "cacheStatus": job.get("cacheStatus"),
                "queueSeconds": (started - created).total_seconds() if created and started else None,
                "renderSeconds": (completed - started).total_seconds() if completed and started else None,
                "totalSeconds": (completed - created).total_seconds() if completed and created else time.time() - item["submittedAt"],
                "error": job.get("error"),
            }
        time.sleep(0.25)
    return {**item, "status": "timeout", "error": f"not terminal after {timeout_seconds}s"}


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil((len(ordered) - 1) * quantile)))
    return round(ordered[index], 6)


def summary(values: list[float]) -> dict[str, float | int | None]:
    return {
        "count": len(values),
        "min": round(min(values), 6) if values else None,
        "p50": percentile(values, 0.50),
        "p95": percentile(values, 0.95),
        "p99": percentile(values, 0.99),
        "max": round(max(values), 6) if values else None,
        "mean": round(statistics.fmean(values), 6) if values else None,
    }


def prometheus_values(text: str) -> dict[str, float]:
    values: dict[str, float] = {}
    for line in text.splitlines():
        if not line or line.startswith("#") or " " not in line:
            continue
        name, raw = line.rsplit(" ", 1)
        if "{" in name:
            continue
        try:
            values[name] = float(raw)
        except ValueError:
            pass
    return values


def docker_observations(compose_file: Path) -> dict[str, Any]:
    result: dict[str, Any] = {"available": False}
    try:
        stats = subprocess.run(
            ["docker", "compose", "-f", str(compose_file), "ps", "-q"],
            check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout.split()
        if not stats:
            return result
        raw = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{json .}}", *stats],
            check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout.splitlines()
        result = {"available": True, "containers": [json.loads(line) for line in raw if line.strip()]}
        temp_sizes: dict[str, str] = {}
        for service in ("rune-worker-a", "rune-worker-b"):
            command = ["docker", "compose", "-f", str(compose_file), "exec", "-T", service, "sh", "-c", "du -sb /tmp/rune 2>/dev/null | cut -f1"]
            probe = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            if probe.returncode == 0:
                temp_sizes[service] = probe.stdout.strip()
        result["temporaryBytes"] = temp_sizes
    except (FileNotFoundError, subprocess.CalledProcessError, json.JSONDecodeError):
        pass
    return result


def main() -> int:
    args = parse_args()
    profile = dict(PROFILES[args.profile])
    jobs_target = args.jobs if args.jobs is not None else profile["jobs"]
    duration_minutes = args.duration_minutes if args.duration_minutes is not None else profile["duration_minutes"]
    concurrency = args.concurrency if args.concurrency is not None else profile["concurrency"]
    base_urls = args.base_urls or ["http://127.0.0.1:8081", "http://127.0.0.1:8082"]
    for base in base_urls:
        request_text(base.rstrip("/") + "/health")

    started = time.time()
    submissions: list[dict[str, Any]] = []
    next_index = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        pending: set[concurrent.futures.Future[dict[str, Any]]] = set()
        deadline = started + duration_minutes * 60 if duration_minutes > 0 else None
        while (jobs_target <= 0 or next_index < jobs_target) and (deadline is None or time.time() < deadline):
            while len(pending) < concurrency and (jobs_target <= 0 or next_index < jobs_target) and (deadline is None or time.time() < deadline):
                duplicate_group = next_index - 1 if next_index > 0 and next_index % 10 == 0 else None
                pending.add(executor.submit(submit, next_index, base_urls, duplicate_group))
                next_index += 1
            done, pending = concurrent.futures.wait(pending, timeout=0.5, return_when=concurrent.futures.FIRST_COMPLETED)
            submissions.extend(future.result() for future in done)
        if pending:
            submissions.extend(future.result() for future in concurrent.futures.as_completed(pending))

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(lambda item: wait_terminal(item, args.timeout_seconds), submissions))
    finished = time.time()

    unique_ids = {item["renderId"] for item in submissions}
    completed = [item for item in results if item["status"] == "completed"]
    queue = [float(item["queueSeconds"]) for item in completed if item.get("queueSeconds") is not None]
    render = [float(item["renderSeconds"]) for item in completed if item.get("renderSeconds") is not None]
    total = [float(item["totalSeconds"]) for item in completed if item.get("totalSeconds") is not None]
    metrics_text = request_text(base_urls[0].rstrip("/") + "/metrics")
    report = {
        "profile": args.profile,
        "startedAt": dt.datetime.fromtimestamp(started, dt.timezone.utc).isoformat(),
        "finishedAt": dt.datetime.fromtimestamp(finished, dt.timezone.utc).isoformat(),
        "durationSeconds": round(finished - started, 3),
        "baseUrls": base_urls,
        "submittedRequests": len(submissions),
        "uniqueJobs": len(unique_ids),
        "idempotentDuplicates": len(submissions) - len(unique_ids),
        "completed": len(completed),
        "failed": sum(item["status"] == "failed" for item in results),
        "cancelled": sum(item["status"] == "cancelled" for item in results),
        "timeouts": sum(item["status"] == "timeout" for item in results),
        "retries": sum(max(0, int(item.get("attempt", 0)) - 1) for item in results),
        "jobsPerMinute": round(len(completed) / max((finished - started) / 60, 1 / 60), 3),
        "latency": {"queueSeconds": summary(queue), "renderSeconds": summary(render), "totalSeconds": summary(total)},
        "cache": {
            "hitJobs": sum(item.get("cacheStatus") in {"hit", "mixed-or-hit"} for item in completed),
            "missJobs": sum(item.get("cacheStatus") in {"miss", "refresh"} for item in completed),
        },
        "prometheus": prometheus_values(metrics_text),
        "docker": docker_observations(args.compose_file),
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("profile", "submittedRequests", "uniqueJobs", "completed", "failed", "timeouts", "jobsPerMinute", "latency")}, indent=2))
    return 0 if report["failed"] == 0 and report["timeouts"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
