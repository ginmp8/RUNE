#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import socket
import subprocess
import sys
import time
from contextlib import ExitStack
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
STUDIO_SRC = ROOT / "services/rune/apps/rune-studio/src"
if str(STUDIO_SRC) not in sys.path:
    sys.path.insert(0, str(STUDIO_SRC))

from rune_studio.client import RuneClient  # noqa: E402
from generate_api_evidence import SOURCE_TEMPLATE, validate_artifact  # noqa: E402

ASYNC_OUTPUTS: dict[str, tuple[str, str]] = {
    "staticHtml": ("distributed-schematex.html", "text/html"),
    "pdf": ("distributed-schematex.pdf", "application/pdf"),
    "pdfA": ("distributed-schematex-pdfa.pdf", "application/pdf"),
    "png": ("distributed-schematex.png", "image/png"),
    "jpeg": ("distributed-schematex.jpg", "image/jpeg"),
    "svg": ("distributed-schematex.svg", "image/svg+xml"),
}


@dataclass
class ManagedProcess:
    name: str
    process: subprocess.Popen[bytes]
    log_path: Path
    log_stream: Any

    def stop(self) -> None:
        if self.process.poll() is not None:
            self.log_stream.close()
            return
        try:
            os.killpg(self.process.pid, signal.SIGTERM)
            self.process.wait(timeout=10)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                os.killpg(self.process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
        finally:
            self.log_stream.close()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_http(url: str, timeout_seconds: int = 45) -> bytes:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if 200 <= response.status < 300:
                    return response.read()
        except (OSError, URLError) as error:
            last_error = error
        time.sleep(0.2)
    raise TimeoutError(f"HTTP endpoint did not become ready: {url}; last error: {last_error}")


def wait_tcp(host: str, port: int, timeout_seconds: int = 30) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: OSError | None = None
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return
        except OSError as error:
            last_error = error
        time.sleep(0.2)
    raise TimeoutError(f"TCP endpoint did not become ready: {host}:{port}; last error: {last_error}")


def start_process(
    name: str,
    command: Sequence[str],
    *,
    log_dir: Path,
    env: dict[str, str],
    cwd: Path,
) -> ManagedProcess:
    log_path = log_dir / f"{name}.log"
    stream = log_path.open("wb")
    process = subprocess.Popen(
        list(command),
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=stream,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return ManagedProcess(name, process, log_path, stream)


def ensure_alive(process: ManagedProcess) -> None:
    code = process.process.poll()
    if code is not None:
        process.log_stream.flush()
        tail = process.log_path.read_text(encoding="utf-8", errors="replace")[-4000:]
        raise RuntimeError(f"{process.name} exited with code {code}.\n{tail}")


def source_fixture(version: str) -> str:
    source = SOURCE_TEMPLATE.replace("{version}", version)
    required = ("```schematex", "entity-structure", "```orgchart")
    missing = [item for item in required if item not in source]
    if missing:
        raise RuntimeError(f"SchemaTex fixture is incomplete: {missing}")
    return source.replace("local dispatcher", "NATS/JetStream dispatcher").replace(
        "LocalDispatcher", "StudioClient --> API --> NATS --> Worker"
    ).replace("local dispatch", "distributed dispatch")


def snapshot_job(client: RuneClient, render_id: str, history: list[dict[str, Any]]) -> dict[str, Any]:
    job = client.get_status(render_id)
    compact = {
        "status": str(job.get("status", "")).lower(),
        "progressPercent": job.get("progressPercent"),
        "progressStage": job.get("progressStage"),
        "attempt": job.get("attempt"),
        "maximumAttempts": job.get("maximumAttempts"),
        "updatedAt": job.get("updatedAt"),
    }
    if not history or compact != history[-1]:
        history.append(compact)
    return job


def wait_for_artifact(
    client: RuneClient,
    render_id: str,
    output_format: str,
    *,
    timeout_seconds: int,
) -> tuple[bytes, str, list[dict[str, Any]]]:
    deadline = time.monotonic() + timeout_seconds
    history: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        job = snapshot_job(client, render_id, history)
        state = str(job["status"]).lower()
        if state == "completed":
            result = client.get_content(render_id)
            content = result.content or b""
            content_type = result.content_type or "application/octet-stream"
            validate_artifact(output_format, content, content_type)
            return content, content_type, history
        if state in {"failed", "cancelled"}:
            raise RuntimeError(json.dumps(job, indent=2, default=str))
        time.sleep(0.25)
    raise TimeoutError(f"Render {render_id} did not complete in {timeout_seconds} seconds")


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Execute Studio client -> API -> NATS/JetStream -> Worker and generate all RUNE output evidence."
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dotnet", type=Path, required=True)
    parser.add_argument("--nats-server", type=Path, required=True)
    parser.add_argument("--chromium", type=Path, default=Path("/usr/bin/chromium"))
    parser.add_argument("--api-dll", type=Path)
    parser.add_argument("--worker-dll", type=Path)
    parser.add_argument("--timeout-seconds", type=int, default=300)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    log_dir = output / "logs"
    log_dir.mkdir(exist_ok=True)
    data_root = output / "data"
    data_root.mkdir(exist_ok=True)
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
            "RUNE_CHROMIUM_EXECUTABLE_PATH": str(args.chromium.resolve()),
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH": str(args.chromium.resolve()),
            "NATS_URL": nats_url,
            "RUNE_BROWSER_CONCURRENCY": "1",
        }
    )
    base_env.pop("PLATFORM", None)
    base_env.pop("Platform", None)

    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "version": version,
        "pipeline": ["rune-studio-client", "rune-api", "nats-jetstream", "rune-worker", "chromium"],
        "dispatcher": None,
        "nats": {"url": nats_url, "monitorUrl": f"http://127.0.0.1:{monitor_port}"},
        "schemaTex": {"entityStructure": True, "orgchart": True},
        "queuedBeforeWorker": False,
        "idempotencyVerified": False,
        "artifacts": [],
    }

    processes: list[ManagedProcess] = []
    client: RuneClient | None = None
    try:
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
            env=base_env,
            cwd=output,
        )
        processes.append(nats)
        wait_tcp("127.0.0.1", nats_port)
        ensure_alive(nats)

        api_env = {**base_env, "ASPNETCORE_URLS": base_url, "RUNE_DISPATCH_PROVIDER": "nats"}
        api = start_process(
            "rune-api",
            [str(args.dotnet.resolve()), str(api_dll)],
            log_dir=log_dir,
            env=api_env,
            cwd=api_dll.parent,
        )
        processes.append(api)
        wait_http(f"{base_url}/health")
        ensure_alive(api)

        client = RuneClient(base_url, timeout=float(args.timeout_seconds))
        features = client.get_features()
        (output / "features.json").write_text(json.dumps(features, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        dispatcher = features.get("dispatchProvider") or features.get("dispatching", {}).get("selected")
        manifest["dispatcher"] = dispatcher
        if dispatcher != "nats":
            raise RuntimeError(f"Expected nats dispatcher, got {dispatcher!r}")

        source = source_fixture(version)
        (output / "distributed-schematex.md").write_text(source, encoding="utf-8")
        source_digest = sha256_bytes(source.encode("utf-8"))
        options = {
            "theme": "professional",
            "pageSize": "A4",
            "includeCover": True,
            "includeToc": True,
            "timeoutSeconds": 180,
            "pdfAConformance": "2b",
            "width": 1440,
            "height": 1000,
        }

        interactive = client.render(
            "markdown",
            source,
            "interactiveHtml",
            options=options,
            document_name="distributed-schematex.md",
        )
        interactive_html = interactive.html or ""
        if "__RUNE_RENDER_DONE__" not in interactive_html or "__RUNE_SCHEMATEX_MODULE_BASE64__" not in interactive_html:
            raise RuntimeError("Interactive HTML is missing readiness or SchemaTex runtime markers")
        interactive_bytes = interactive_html.encode("utf-8")
        (output / "distributed-schematex-interactive.html").write_bytes(interactive_bytes)
        manifest["artifacts"].append(
            {
                "output": "interactiveHtml",
                "name": "distributed-schematex-interactive.html",
                "contentType": interactive.content_type or "text/html",
                "size": len(interactive_bytes),
                "sha256": sha256_bytes(interactive_bytes),
                "path": "studio-client -> api",
            }
        )

        structured = client.render(
            "markdown",
            source,
            "structuredJson",
            options=options,
            document_name="distributed-schematex.md",
        )
        structured_bytes = (json.dumps(structured.document, indent=2, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
        if b"schematex" not in structured_bytes.lower() or b"orgchart" not in structured_bytes.lower():
            raise RuntimeError("Structured JSON did not preserve both SchemaTex diagram families")
        (output / "distributed-schematex.json").write_bytes(structured_bytes)
        manifest["artifacts"].append(
            {
                "output": "structuredJson",
                "name": "distributed-schematex.json",
                "contentType": structured.content_type or "application/json",
                "size": len(structured_bytes),
                "sha256": sha256_bytes(structured_bytes),
                "path": "studio-client -> api",
            }
        )

        first_key = f"rune-{version}-distributed-static-{source_digest[:16]}"
        first = client.render(
            "markdown",
            source,
            "staticHtml",
            options=options,
            idempotency_key=first_key,
            document_name="distributed-schematex.md",
        )
        if not first.render_id:
            raise RuntimeError("API did not return a render id for the queued distributed render")
        queued_history: list[dict[str, Any]] = []
        queued_job = snapshot_job(client, first.render_id, queued_history)
        queued_state = str(queued_job["status"]).lower()
        if queued_state != "queued":
            raise RuntimeError(f"Expected queued job before worker startup, got {queued_state!r}")
        manifest["queuedBeforeWorker"] = True

        duplicate = client.render(
            "markdown",
            source,
            "staticHtml",
            options=options,
            idempotency_key=first_key,
            document_name="distributed-schematex.md",
        )
        if duplicate.render_id != first.render_id:
            raise RuntimeError(f"Idempotency mismatch: {first.render_id} != {duplicate.render_id}")
        manifest["idempotencyVerified"] = True

        worker = start_process(
            "rune-worker",
            [str(args.dotnet.resolve()), str(worker_dll)],
            log_dir=log_dir,
            env=base_env,
            cwd=worker_dll.parent,
        )
        processes.append(worker)
        time.sleep(1)
        ensure_alive(worker)

        content, content_type, post_worker_history = wait_for_artifact(
            client,
            first.render_id,
            "staticHtml",
            timeout_seconds=args.timeout_seconds,
        )
        filename, _ = ASYNC_OUTPUTS["staticHtml"]
        (output / filename).write_bytes(content)
        manifest["artifacts"].append(
            {
                "output": "staticHtml",
                "name": filename,
                "renderId": first.render_id,
                "contentType": content_type,
                "size": len(content),
                "sha256": sha256_bytes(content),
                "path": "studio-client -> api -> nats-jetstream -> worker -> chromium",
                "history": queued_history + post_worker_history,
            }
        )

        for output_format, (filename, _) in ASYNC_OUTPUTS.items():
            if output_format == "staticHtml":
                continue
            accepted = client.render(
                "markdown",
                source,
                output_format,
                options=options,
                idempotency_key=f"rune-{version}-distributed-{output_format.lower()}-{source_digest[:16]}",
                document_name="distributed-schematex.md",
            )
            if not accepted.render_id:
                raise RuntimeError(f"API did not return a render id for {output_format}")
            content, content_type, history = wait_for_artifact(
                client,
                accepted.render_id,
                output_format,
                timeout_seconds=args.timeout_seconds,
            )
            (output / filename).write_bytes(content)
            manifest["artifacts"].append(
                {
                    "output": output_format,
                    "name": filename,
                    "renderId": accepted.render_id,
                    "contentType": content_type,
                    "size": len(content),
                    "sha256": sha256_bytes(content),
                    "path": "studio-client -> api -> nats-jetstream -> worker -> chromium",
                    "history": history,
                }
            )

        if len(manifest["artifacts"]) != 8:
            raise RuntimeError(f"Expected 8 output artifacts, got {len(manifest['artifacts'])}")
        manifest["completedAtUtc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(
            f"DISTRIBUTED PIPELINE PASSED: RUNE {version}; Studio client -> API -> NATS/JetStream -> Worker; "
            "8 formats; SchemaTex entity-structure and orgchart"
        )
        return 0
    finally:
        if client is not None:
            client.close()
        for process in reversed(processes):
            process.stop()


if __name__ == "__main__":
    raise SystemExit(main())
