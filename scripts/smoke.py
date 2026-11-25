#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

API = "http://localhost:8080"
STUDIO = "http://localhost:8501/_stcore/health"
TERMINAL = {"completed", "failed", "cancelled"}
VERSION = (Path(__file__).resolve().parents[1] / "VERSION").read_text(encoding="utf-8").strip()


@dataclass(frozen=True)
class Response:
    status: int
    headers: object
    body: bytes

    def json(self):
        return json.loads(self.body)


def call(path: str, payload=None, method: str | None = None, timeout: int = 30) -> Response:
    data = None if payload is None else json.dumps(payload).encode()
    request = Request(API + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return Response(response.status, response.headers, response.read())
    except HTTPError as error:
        return Response(error.code, error.headers, error.read())


def wait_url(url: str, seconds: int = 180) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=5) as response:
                if response.status < 500:
                    return
        except Exception:
            time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {url}")


def wait_job(render_id: str, expected: set[str] | None = None, seconds: int = 180) -> dict:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        response = call(f"/v1/renders/{render_id}")
        assert response.status == 200, response.body
        job = response.json()["job"] if "job" in response.json() else response.json()
        state = str(job["status"]).lower()
        if state in TERMINAL:
            if expected is not None:
                assert state in expected, job
            return job
        time.sleep(0.5)
    raise RuntimeError(f"Render {render_id} did not reach a terminal state")


def create_job(output: str, key: str, content: str = "# Browser smoke", *, source_type: str = "markdown", options: dict | None = None) -> str:
    response = call("/v1/render", {
        "sourceType": source_type,
        "content": content,
        "outputFormat": output,
        "htmlTrustMode": "trusted" if source_type == "html" else "safe",
        "documentName": "smoke.html" if source_type == "html" else "smoke.md",
        "idempotencyKey": key,
        "options": options or {"timeoutSeconds": 30},
    })
    assert response.status == 202, (response.status, response.body)
    return response.json()["renderId"]


def check_content(render_id: str, output: str) -> None:
    response = call(f"/v1/renders/{render_id}/content")
    assert response.status == 200, response.body
    body = response.body
    checks = {
        "staticHtml": lambda: b"data-rune-static=\"true\"" in body and b"<script" not in body.lower(),
        "pdf": lambda: body.startswith(b"%PDF"),
        "pdfA": lambda: body.startswith(b"%PDF"),
        "png": lambda: body.startswith(b"\x89PNG"),
        "jpeg": lambda: body.startswith(b"\xff\xd8"),
        "svg": lambda: b"<svg" in body[:500].lower(),
    }
    assert checks[output](), f"Invalid {output} output ({len(body)} bytes)"


def compose(*args: str) -> None:
    subprocess.run(["docker", "compose", *args], check=True)


def main() -> None:
    wait_url(API + "/health")
    wait_url(STUDIO)

    root = call("/")
    assert root.status == 200 and root.json()["version"] == VERSION
    features = call("/v1/features")
    assert features.status == 200 and "structuredJson" in {item[0].lower() + item[1:] for item in features.json()["outputs"]}
    openapi = call("/v1/openapi.json")
    assert openapi.status == 200 and openapi.json()["openapi"] == "3.1.0"
    schemas = call("/v1/schemas")
    assert schemas.status == 200 and "render-request.v1.schema.json" in schemas.json()
    assert call("/v1/schemas/render-request.v1.schema.json").status == 200

    markdown = call("/v1/render", {"sourceType": "markdown", "content": "# Smoke", "outputFormat": "interactiveHtml"})
    assert markdown.status == 200 and b"<h1" in markdown.body and b"__RUNE_RENDER_DONE__" in markdown.body
    html = call("/v1/render", {"sourceType": "html", "content": "<h1>HTML smoke</h1>", "outputFormat": "interactiveHtml"})
    assert html.status == 200 and b"HTML smoke" in html.body
    structured = call("/v1/render", {"sourceType": "markdown", "content": "# Model\n\nParagraph.", "outputFormat": "structuredJson"})
    assert structured.status == 200 and structured.json()["document"]["nodes"]

    first = create_job("pdf", "smoke-idempotent-v030")
    duplicate = create_job("pdf", "smoke-idempotent-v030")
    assert first == duplicate
    wait_job(first, {"completed"})
    check_content(first, "pdf")
    events = call(f"/v1/renders/{first}/events")
    assert events.status == 200 and b"event: render-status" in events.body and b"completed" in events.body.lower()

    for output in ("staticHtml", "pdfA", "png", "jpeg", "svg"):
        render_id = create_job(output, f"smoke-{output.lower()}-v030")
        wait_job(render_id, {"completed"}, 240)
        check_content(render_id, output)

    listing = call("/v1/renders?status=completed&offset=0&limit=5")
    assert listing.status == 200 and listing.json()["total"] >= 6

    # Fail-closed readiness: an unowned pending renderer must fail instead of producing a partial artifact.
    failing = create_job(
        "staticHtml",
        "smoke-readiness-failure-v030",
        '<div class="rune-async" data-render-state="pending">never ready</div>',
        source_type="html",
        options={"timeoutSeconds": 5},
    )
    failed = wait_job(failing, {"failed"}, 120)
    assert "ready" in str(failed.get("error", "")).lower() or "renderer" in str(failed.get("error", "")).lower()

    # Deterministic queued cancellation and recovery after worker restart.
    compose("stop", "rune-worker")
    cancelled_id = create_job("pdf", "smoke-cancel-retry-v030")
    cancellation = call(f"/v1/renders/{cancelled_id}/cancel", {"reason": "Smoke cancellation"}, method="POST")
    assert cancellation.status == 202, cancellation.body
    compose("start", "rune-worker")
    wait_job(cancelled_id, {"cancelled"}, 120)
    retry = call(f"/v1/renders/{cancelled_id}/retry", {"resetAttempts": True}, method="POST")
    assert retry.status == 202, retry.body
    wait_job(cancelled_id, {"completed"}, 180)
    check_content(cancelled_id, "pdf")

    print("SMOKE PASSED: API, schemas, Studio, NATS, worker, outputs, readiness, idempotency, cancellation and retry")


if __name__ == "__main__":
    main()
