#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "scripts"
STUDIO_SRC = ROOT / "services/rune/apps/rune-studio/src"
for item in (SCRIPT_DIR, STUDIO_SRC):
    if str(item) not in sys.path:
        sys.path.insert(0, str(item))

from generate_api_evidence import SOURCE_TEMPLATE, validate_artifact  # noqa: E402
from rune_studio.client import RuneClient  # noqa: E402

TERMINAL = {"completed", "failed", "cancelled"}


def run(command: Sequence[str], *, input_bytes: bytes | None = None, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        list(command),
        cwd=ROOT,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{result.stdout.decode(errors='replace')}")
    return result


def compose(*args: str, input_bytes: bytes | None = None, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return run(["docker", "compose", *args], input_bytes=input_bytes, check=check)


def wait_http(url: str, timeout_seconds: int = 90) -> bytes:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=3) as response:
                if 200 <= response.status < 300:
                    return response.read()
        except (OSError, URLError) as error:
            last_error = error
        time.sleep(0.5)
    raise TimeoutError(f"HTTP endpoint did not become ready: {url}; last error: {last_error}")


def request_json(base_url: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 240) -> tuple[int, dict[str, str], bytes]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        base_url.rstrip("/") + path,
        data=data,
        method="GET" if payload is None else "POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, dict(response.headers), response.read()
    except HTTPError as error:
        return error.code, dict(error.headers), error.read()


def wait_job(client: RuneClient, render_id: str, timeout_seconds: int, *, target_states: set[str] | None = None) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    history: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        job = client.get_status(render_id)
        state = str(job.get("status", "")).lower()
        snapshot = {
            "status": state,
            "attempt": job.get("attempt"),
            "progressPercent": job.get("progressPercent"),
            "progressStage": job.get("progressStage"),
            "claimedBy": job.get("claimedBy"),
            "leaseExpiresAt": job.get("leaseExpiresAt"),
        }
        if not history or history[-1] != snapshot:
            history.append(snapshot)
        if target_states and state in target_states:
            job["_history"] = history
            return job
        if state in TERMINAL:
            if state != "completed":
                raise RuntimeError(json.dumps(job, indent=2, default=str))
            job["_history"] = history
            return job
        time.sleep(0.25)
    raise TimeoutError(f"Render {render_id} did not reach the expected state; history={json.dumps(history)}")


def jsz(monitor_url: str) -> dict[str, Any]:
    return json.loads(wait_http(f"{monitor_url}/jsz?streams=true&consumers=true&config=true").decode("utf-8"))


def stream_snapshot(monitor_url: str) -> dict[str, Any]:
    payload = jsz(monitor_url)
    streams: list[dict[str, Any]] = []
    direct_streams = payload.get("streams")
    if isinstance(direct_streams, list):
        streams.extend(item for item in direct_streams if isinstance(item, dict))
    for account in payload.get("account_details", []):
        if isinstance(account, dict):
            details = account.get("stream_detail", [])
            if isinstance(details, list):
                streams.extend(item for item in details if isinstance(item, dict))
    for stream in streams:
        if stream.get("name") == "RUNE_RENDER":
            state = stream.get("state", {})
            return {
                "messages": int(state.get("messages", 0)),
                "bytes": int(state.get("bytes", 0)),
                "firstSeq": state.get("first_seq"),
                "lastSeq": state.get("last_seq"),
                "consumerCount": state.get("consumer_count"),
            }
    raise RuntimeError(f"RUNE_RENDER stream was not found: {json.dumps(payload)[:2000]}")


def recv_line(sock: socket.socket) -> bytes:
    data = bytearray()
    while not data.endswith(b"\r\n"):
        chunk = sock.recv(1)
        if not chunk:
            raise ConnectionError("NATS connection closed")
        data.extend(chunk)
    return bytes(data[:-2])


def recv_exact(sock: socket.socket, size: int) -> bytes:
    data = bytearray()
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            raise ConnectionError("NATS connection closed")
        data.extend(chunk)
    return bytes(data)


def publish_jetstream(host: str, port: int, subject: str, payload: dict[str, Any], message_id: str) -> dict[str, Any]:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = f"NATS/1.0\r\nNats-Msg-Id: {message_id}\r\n\r\n".encode("ascii")
    inbox = f"_INBOX.RUNE.{uuid.uuid4().hex}"
    with socket.create_connection((host, port), timeout=5) as sock:
        sock.settimeout(10)
        info = recv_line(sock)
        if not info.startswith(b"INFO "):
            raise RuntimeError(f"Unexpected NATS greeting: {info!r}")
        sock.sendall(b'CONNECT {"verbose":false,"pedantic":false,"headers":true,"lang":"python","version":"stdlib"}\r\n')
        sock.sendall(f"SUB {inbox} 1\r\n".encode("ascii"))
        total = len(headers) + len(body)
        sock.sendall(f"HPUB {subject} {inbox} {len(headers)} {total}\r\n".encode("ascii") + headers + body + b"\r\n")
        sock.sendall(b"PING\r\n")
        while True:
            line = recv_line(sock)
            if line == b"PING":
                sock.sendall(b"PONG\r\n")
                continue
            if line in {b"PONG", b"+OK"}:
                continue
            if line.startswith(b"-ERR"):
                raise RuntimeError(f"NATS error: {line.decode(errors='replace')}")
            if line.startswith(b"MSG "):
                parts = line.split()
                size = int(parts[-1])
                response = recv_exact(sock, size)
                trailer = recv_exact(sock, 2)
                if trailer != b"\r\n":
                    raise RuntimeError("Malformed NATS response")
                return json.loads(response)


def ensure_non_root(service: str, expected_uid: int | None = None) -> int:
    result = compose("run", "--rm", "--no-deps", "--entrypoint", "id", service, "-u")
    text = result.stdout.decode("utf-8", errors="replace").strip().splitlines()[-1]
    uid = int(text)
    if uid == 0 or expected_uid is not None and uid != expected_uid:
        raise RuntimeError(f"{service} runs as uid {uid}, expected non-root" + (f" uid {expected_uid}" if expected_uid else ""))
    return uid


def pdf_text(pdf: bytes) -> str:
    result = compose("exec", "-T", "rune-api", "pdftotext", "-", "-", input_bytes=pdf)
    return result.stdout.decode("utf-8", errors="replace")


def pdf_fonts(pdf: bytes) -> str:
    # Inspect the actual artifact returned by the public API, not a private
    # storage path that can change with the persistence implementation.
    result = compose("exec", "-T", "rune-api", "pdffonts", "-", input_bytes=pdf)
    return result.stdout.decode("utf-8", errors="replace")


def save_content(client: RuneClient, render_id: str, output_format: str, path: Path) -> tuple[bytes, str]:
    result = client.get_content(render_id)
    content = result.content or b""
    content_type = result.content_type or "application/octet-stream"
    validate_artifact(output_format, content, content_type)
    path.write_bytes(content)
    return content, content_type


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the deployed RUNE Docker Compose and JetStream workflow.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--monitor-url", default="http://127.0.0.1:8222")
    parser.add_argument("--nats-host", default="127.0.0.1")
    parser.add_argument("--nats-port", type=int, default=4222)
    parser.add_argument("--timeout-seconds", type=int, default=600)
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--keep-running", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    source = SOURCE_TEMPLATE.replace("{version}", version).replace("local dispatcher", "NATS/JetStream dispatcher")
    source_hash = hashlib.sha256(source.encode("utf-8")).hexdigest()
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "version": version,
        "pipeline": ["studio", "api", "nats-jetstream", "worker", "artifacts", "api", "studio"],
        "checks": {},
        "artifacts": [],
    }
    client: RuneClient | None = None
    passed = False
    compose("down", "-v", "--remove-orphans", check=False)
    try:
        compose("config", "--quiet")
        if not args.skip_build:
            compose("build", "storage", "cache", "nats", "rune-api", "rune-worker", "rune-studio")
        manifest["checks"]["nonRoot"] = {
            service: ensure_non_root(service, 10001)
            for service in ("storage", "cache", "nats", "rune-api", "rune-worker", "rune-studio")
        }

        compose("up", "-d", "--wait", "storage", "cache", "nats", "rune-api", "rune-studio")
        wait_http(f"{args.base_url}/health")
        wait_http(f"{args.base_url}/v1/features")
        running = compose("ps", "--services", "--status", "running").stdout.decode().split()
        if "rune-worker" in running:
            raise RuntimeError("Worker must remain stopped for the queued-before-worker scenario")
        client = RuneClient(args.base_url, timeout=float(args.timeout_seconds))
        features = client.get_features()
        dispatcher = features.get("dispatchProvider") or features.get("dispatching", {}).get("selected")
        if dispatcher != "nats":
            raise RuntimeError(f"Expected RUNE_DISPATCH_PROVIDER=nats, got {dispatcher!r}")
        manifest["checks"]["dispatcher"] = dispatcher

        options = {
            "theme": "professional",
            "pageSize": "A4",
            "includeCover": True,
            "includeToc": True,
            "timeoutSeconds": 180,
            "pdfAConformance": "2b",
            "headerTemplate": '<div style="font-size:9px;width:100%;text-align:center">RUNE DEPLOYED HEADER</div>',
            "footerTemplate": '<div style="font-size:9px;width:100%;text-align:center">RUNE DEPLOYED FOOTER <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
            "additionalCss": "body{font-family:'DejaVu Sans',sans-serif}",
        }

        queued = client.render(
            "markdown",
            source,
            "staticHtml",
            options=options,
            idempotency_key=f"rune-{version}-compose-queued-{source_hash[:16]}",
            document_name="compose-schematex.md",
        )
        if not queued.render_id:
            raise RuntimeError("API did not return a render id")
        time.sleep(2)
        queued_job = client.get_status(queued.render_id)
        if str(queued_job.get("status", "")).lower() != "queued":
            raise RuntimeError(f"Expected queued status with Worker stopped: {json.dumps(queued_job)}")
        before_restart = stream_snapshot(args.monitor_url)
        if before_restart["messages"] < 1:
            raise RuntimeError(f"JetStream did not retain the queued request: {before_restart}")

        compose("restart", "nats")
        compose("up", "-d", "--wait", "nats", "rune-api", "rune-studio")
        after_restart = stream_snapshot(args.monitor_url)
        if after_restart["messages"] < before_restart["messages"]:
            raise RuntimeError(f"JetStream message count regressed after NATS restart: {before_restart} -> {after_restart}")
        if str(client.get_status(queued.render_id).get("status", "")).lower() != "queued":
            raise RuntimeError("Queued job changed state while Worker was stopped")
        manifest["checks"]["jetStreamPersistence"] = {"before": before_restart, "after": after_restart}

        compose("up", "-d", "--wait", "rune-worker")
        completed = wait_job(client, queued.render_id, args.timeout_seconds)
        html, html_type = save_content(client, queued.render_id, "staticHtml", output / "deployed-schematex.html")
        html_digest = hashlib.sha256(html).hexdigest()
        manifest["artifacts"].append({"output": "staticHtml", "renderId": queued.render_id, "contentType": html_type, "size": len(html), "sha256": html_digest})

        completed_attempt = int(completed.get("attempt", 0))
        package_path = str(completed.get("packagePath", ""))
        if not package_path:
            raise RuntimeError("Completed job did not expose PackagePath for duplicate-message validation")
        duplicate_event_id = uuid.uuid4()
        duplicate_command = {
            "metadata": {
                "eventId": str(duplicate_event_id),
                "correlationId": queued.render_id,
                "causationId": None,
                "schemaVersion": "1.0",
                "occurredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "headers": {"source": "compose-validation"},
            },
            "renderId": queued.render_id,
            "packagePath": package_path,
        }
        stream_before_duplicate = stream_snapshot(args.monitor_url)
        first_ack = publish_jetstream(args.nats_host, args.nats_port, "rune.render.requested.v1", duplicate_command, duplicate_event_id.hex)
        second_ack = publish_jetstream(args.nats_host, args.nats_port, "rune.render.requested.v1", duplicate_command, duplicate_event_id.hex)
        time.sleep(3)
        stream_after_duplicate = stream_snapshot(args.monitor_url)
        after_duplicate_job = client.get_status(queued.render_id)
        repeated_html = client.get_content(queued.render_id).content or b""
        if not second_ack.get("duplicate"):
            raise RuntimeError(f"JetStream did not report duplicate suppression: {second_ack}")
        if hashlib.sha256(repeated_html).hexdigest() != html_digest:
            raise RuntimeError("Duplicate delivery modified the completed artifact")
        if int(after_duplicate_job.get("attempt", 0)) != completed_attempt:
            raise RuntimeError("Duplicate delivery incremented the completed job attempt")
        manifest["checks"]["duplicateMessage"] = {
            "firstAck": first_ack,
            "secondAck": second_ack,
            "streamBefore": stream_before_duplicate,
            "streamAfter": stream_after_duplicate,
            "artifactUnchanged": True,
            "attemptUnchanged": True,
        }

        for output_format, file_name in (("pdf", "deployed-schematex.pdf"), ("pdfA", "deployed-schematex-pdfa.pdf"), ("png", "deployed-schematex.png")):
            accepted = client.render(
                "markdown",
                source,
                output_format,
                options=options,
                idempotency_key=f"rune-{version}-compose-{output_format.lower()}-{source_hash[:16]}",
                document_name="compose-schematex.md",
            )
            if not accepted.render_id:
                raise RuntimeError(f"No render id for {output_format}")
            job = wait_job(client, accepted.render_id, args.timeout_seconds)
            content, content_type = save_content(client, accepted.render_id, output_format, output / file_name)
            item = {"output": output_format, "renderId": accepted.render_id, "contentType": content_type, "size": len(content), "sha256": hashlib.sha256(content).hexdigest(), "history": job.pop("_history", [])}
            if output_format == "pdf":
                text = pdf_text(content)
                if "RUNE DEPLOYED HEADER" not in text or "RUNE DEPLOYED FOOTER" not in text:
                    raise RuntimeError("Generated PDF does not contain the configured header and footer")
                fonts = pdf_fonts(content)
                if "DejaVu" not in fonts:
                    raise RuntimeError(f"Expected DejaVu system font in generated PDF:\n{fonts}")
                (output / "deployed-schematex-pdffonts.txt").write_text(fonts, encoding="utf-8")
                item["headersFooters"] = True
                item["systemFont"] = "DejaVu"
            manifest["artifacts"].append(item)

        composite_payload = {
            "sourceType": "composite",
            "outputFormat": "pdf",
            "documentName": "deployed-composite.md",
            "composite": {
                "includePartTitles": True,
                "pageBreakBetweenParts": True,
                "rewriteTableOfContents": True,
                "maximumDepth": 4,
                "parts": [
                    {"name": "Introduction", "sourceType": "markdown", "content": "# Introduction\n\nComposite deployment evidence."},
                    {"name": "SchemaTex", "sourceType": "markdown", "content": source},
                ],
            },
            "options": {**options, "includeToc": True, "tagged": True, "outline": True, "emitStructureMap": True},
            "idempotencyKey": f"rune-{version}-compose-composite-{source_hash[:16]}",
        }
        status, _, body = request_json(args.base_url, "/v1/render", composite_payload)
        if status != 202:
            raise RuntimeError(f"Composite render rejected: {status}: {body.decode(errors='replace')}")
        composite_id = json.loads(body)["renderId"]
        wait_job(client, composite_id, args.timeout_seconds)
        composite_pdf, composite_type = save_content(client, composite_id, "pdf", output / "deployed-composite.pdf")
        composite_text = pdf_text(composite_pdf)
        if "Introduction" not in composite_text or "SchemaTex" not in composite_text:
            raise RuntimeError("Composite PDF does not contain both declared parts")
        manifest["checks"]["composite"] = {"renderId": composite_id, "contentType": composite_type, "size": len(composite_pdf), "nativePdfImportUsed": False}

        restart_source = source + "\n\n" + "\n\n".join(f"## Restart section {index}\n\nWorker restart recovery evidence." for index in range(1, 121))
        restart = client.render(
            "markdown",
            restart_source,
            "png",
            options={**options, "height": 7000},
            idempotency_key=f"rune-{version}-compose-worker-restart-{source_hash[:16]}",
            document_name="worker-restart.md",
        )
        if not restart.render_id:
            raise RuntimeError("No render id for Worker restart scenario")
        active = wait_job(client, restart.render_id, 60, target_states={"claimed", "rendering"})
        compose("kill", "-s", "SIGKILL", "rune-worker")
        compose("up", "-d", "--wait", "rune-worker")
        recovered = wait_job(client, restart.render_id, args.timeout_seconds)
        restart_png, restart_type = save_content(client, restart.render_id, "png", output / "worker-restart-recovered.png")
        manifest["checks"]["workerRestart"] = {
            "interruptedState": active.get("status"),
            "initialAttempt": active.get("attempt"),
            "completedAttempt": recovered.get("attempt"),
            "contentType": restart_type,
            "size": len(restart_png),
            "history": recovered.pop("_history", []),
        }

        ps_json = compose("ps", "--format", "json").stdout.decode("utf-8", errors="replace")
        (output / "compose-ps.jsonl").write_text(ps_json, encoding="utf-8")
        manifest["checks"]["servicesHealthy"] = True
        manifest["checks"]["excludedScope"] = {
            "nativePdfImport": False,
            "s3": False,
            "pdfUa": False,
            "releaseSigning": False,
            "heavyLoad": False,
            "arbitraryHelpers": False,
        }

        compose("stop", "-t", "90", "rune-studio", "rune-api", "rune-worker", "nats")
        manifest["checks"]["gracefulShutdown"] = True
        manifest["completedAtUtc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        logs = compose("logs", "--no-color", check=False).stdout
        (output / "compose.log").write_bytes(logs)
        print(f"COMPOSE PIPELINE PASSED: RUNE {version}; Studio -> API -> JetStream -> Worker -> artifacts -> API/Studio")
        passed = True
        return 0
    finally:
        if client is not None:
            client.close()
        if not args.keep_running:
            logs = compose("logs", "--no-color", check=False).stdout
            if logs and not (output / "compose.log").exists():
                (output / "compose.log").write_bytes(logs)
            compose("down", "-v", "--remove-orphans", check=False)
        if not passed and not (output / "manifest.json").exists():
            (output / "failure.json").write_text(json.dumps({"version": version, "failedAtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
