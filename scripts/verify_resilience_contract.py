#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

REQUIRED_METRICS = {
    "rune_jobs_queued",
    "rune_jobs_running",
    "rune_jobs_completed",
    "rune_jobs_failed",
    "rune_job_duration_seconds",
    "rune_render_duration_seconds",
    "rune_message_redelivery_total",
    "rune_idempotency_hit_total",
    "rune_cache_hit_total",
    "rune_cache_miss_total",
    "rune_lease_conflict_total",
    "rune_lease_fencing_rejection_total",
    "rune_temp_files_total",
    "rune_chromium_processes",
    "rune_dispatch_published_total",
    "rune_dispatch_failure_total",
    "rune_dead_letter_total",
}
REQUIRED_FAILURE_POINTS = {
    "before-render",
    "during-chromium",
    "during-temp-write",
    "during-rename",
    "after-commit",
    "before-ack",
    "during-upload",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the RUNE distributed-resilience implementation contract.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    errors: list[str] = []
    checks: dict[str, object] = {}

    compose_path = root / "docker-compose.resilience.yml"
    compose = yaml.safe_load(compose_path.read_text(encoding="utf-8")) if compose_path.is_file() else {}
    services = set((compose or {}).get("services", {}))
    required_services = {"storage", "cache", "nats", "rune-api-a", "rune-api-b", "rune-worker-a", "rune-worker-b"}
    missing_services = sorted(required_services - services)
    if missing_services:
        errors.append("missing resilience services: " + ", ".join(missing_services))
    checks["services"] = sorted(services)

    source_files = [
        root / "services/rune/src/abstractions/Rune.Storage.Abstractions/ResilienceSupport.cs",
        root / "services/rune/src/application/Rune.Jobs/FileSystemRenderJobStore.cs",
        root / "services/rune/src/application/Rune.RenderProcessing/RenderCache.cs",
        root / "services/rune/src/application/Rune.RenderProcessing/RenderJobProcessor.cs",
        root / "services/rune/apps/rune-api/Program.cs",
        root / "services/rune/apps/rune-worker/Program.cs",
    ]
    source = "\n".join(path.read_text(encoding="utf-8") for path in source_files if path.is_file())
    missing_metrics = sorted(metric for metric in REQUIRED_METRICS if metric not in source)
    missing_points = sorted(point for point in REQUIRED_FAILURE_POINTS if f'"{point}"' not in source)
    if missing_metrics:
        errors.append("missing metrics: " + ", ".join(missing_metrics))
    if missing_points:
        errors.append("missing failure points: " + ", ".join(missing_points))
    checks["metrics"] = sorted(REQUIRED_METRICS - set(missing_metrics))
    checks["failurePoints"] = sorted(REQUIRED_FAILURE_POINTS - set(missing_points))

    required_markers = {
        "monotonic job fencing token": "var token = checked(job.LeaseToken + 1);",
        "owned job writes": "SaveOwnedAsync",
        "owned result writes": "SaveResultOwnedAsync",
        "owned artifact-set writes": "SaveArtifactSetOwnedAsync",
        "cache fencing exception": "CacheFencingRejectedException",
        "prometheus endpoint": 'MapGet("/metrics"',
        "before ack injection": 'Trigger("before-ack"',
        "durable dispatch outbox": "RenderCommandOutbox",
        "dead letter endpoint": 'MapGet("/v1/dead-letters"',
        "replay endpoint": 'MapPost("/v1/renders/{id:guid}/replay"',
        "w3c telemetry": "RuneTelemetry",
    }
    for label, marker in required_markers.items():
        if marker not in source:
            errors.append(f"missing marker for {label}: {marker}")
    checks["markers"] = sorted(required_markers)

    test_source = "\n".join(path.read_text(encoding="utf-8") for path in [
        root / "services/rune/tests/Rune.Jobs.Tests/JobStoreTests.cs",
        root / "services/rune/tests/Rune.Engine.Tests/RenderCacheFeatureTests.cs",
    ])
    required_tests = [
        "Expired_lease_is_replaced_and_old_fencing_token_is_rejected",
        "Old_owner_cannot_publish_result_after_takeover",
        "Superseded_cache_fencing_token_cannot_publish",
        "Cleanup_removes_only_abandoned_temporary_entries",
    ]
    missing_tests = [name for name in required_tests if name not in test_source]
    if missing_tests:
        errors.append("missing resilience tests: " + ", ".join(missing_tests))
    checks["tests"] = required_tests

    docs = [
        root / "services/rune/docs/operations/distributed-resilience.md",
        root / "services/rune/docs/operations/failure-injection.md",
        root / "services/rune/docs/operations/resilience-load-and-soak.md",
        root / "VALIDATION.md",
    ]
    missing_docs = [path.relative_to(root).as_posix() for path in docs if not path.is_file()]
    if missing_docs:
        errors.append("missing documentation: " + ", ".join(missing_docs))
    checks["documents"] = [path.relative_to(root).as_posix() for path in docs]

    version = (root / "VERSION").read_text(encoding="utf-8").strip() if (root / "VERSION").is_file() else ""
    match = re.fullmatch(r"0\.(\d+)\.(\d+)", version)
    if match is None or int(match.group(1)) < 15:
        errors.append(f"VERSION must be an integrated release at or after 0.15.0, found {version!r}")
    release_notes = (root / "RELEASE_NOTES.md").read_text(encoding="utf-8")
    first_heading = next((line.strip() for line in release_notes.splitlines() if line.startswith("#")), "")
    if version not in first_heading:
        errors.append(f"release notes heading must identify {version}, found {first_heading!r}")
    checks["version"] = version

    payload = {"status": "passed" if not errors else "failed", "checks": checks, "errors": errors}
    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print("RUNE DISTRIBUTED RESILIENCE CONTRACT " + ("PASSED" if not errors else "FAILED"))
        for error in errors:
            print("ERROR:", error)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
