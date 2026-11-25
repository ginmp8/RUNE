from __future__ import annotations

import json

import httpx

from rune_studio.client import RenderResult, RuneClient


def test_render_result_holds_async_identifier() -> None:
    result = RenderResult("abc", "queued")
    assert result.render_id == "abc"


def test_client_sends_options_resources_and_idempotency_key() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(202, json={"renderId": "abc", "status": "queued"})

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    result = client.render(
        "html",
        "<h1>x</h1>",
        "pdf",
        True,
        options={"pageSize": "A4"},
        resources=[{"path": "logo.png", "contentBase64": "AA==", "contentType": "image/png"}],
        idempotency_key="same",
    )

    assert result.render_id == "abc"
    assert captured["htmlTrustMode"] == "trusted"
    assert captured["idempotencyKey"] == "same"
    assert captured["resources"][0]["path"] == "logo.png"  # type: ignore[index]


def test_client_returns_interactive_html() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "contentType": "text/html; charset=utf-8",
                "html": "<h1>ready</h1>",
                "requiredRenderers": [],
                "diagnostics": [],
            },
        )

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    result = client.render("markdown", "# ready", "interactiveHtml")
    assert result.status == "completed"
    assert result.html == "<h1>ready</h1>"


def test_client_gets_feature_capabilities() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/features"
        return httpx.Response(200, json={"version": "0.6.0", "rendererCapabilities": [{"id": "mermaid", "available": True}]})

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    assert client.get_features()["rendererCapabilities"][0]["available"] is True


def test_event_stream_sends_resume_header_and_parses_id_retry() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Last-Event-ID"] == "41"
        body = 'id: 42\nevent: render-status\nretry: 1500\ndata: {"status":"rendering"}\n\n: heartbeat\n\n'
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=body)

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    events = list(client.stream_events("abc", last_event_id="41"))
    assert events == [{"event": "render-status", "id": "42", "retry": 1500, "data": {"status": "rendering"}}]


def test_client_converts_pdf_and_reads_report() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/render":
            captured.update(json.loads(request.content))
            return httpx.Response(202, json={"renderId": "pdf-1", "status": "queued"})
        if request.url.path.endswith("/conversion-report"):
            return httpx.Response(200, json={"schemaVersion": "1.0", "effectiveMode": "visual"})
        return httpx.Response(404)

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    result = client.convert_pdf(b"%PDF-1.4\n", mode="visual", source_name="scan.pdf")
    report = client.get_conversion_report(result.render_id or "")

    assert captured["sourceType"] == "pdf"
    assert captured["sourceResourcePath"] == "source/scan.pdf"
    assert captured["pdfImport"]["mode"] == "visual"  # type: ignore[index]
    assert report["effectiveMode"] == "visual"


def test_client_sends_complete_pdf_import_options_and_downloads_artifact() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/render":
            captured.update(json.loads(request.content))
            return httpx.Response(202, json={"renderId": "pdf-2", "status": "queued"})
        if request.url.path == "/v1/renders/pdf-2/artifacts/image-1.png":
            return httpx.Response(200, content=b"PNG", headers={"content-type": "image/png"})
        return httpx.Response(404)

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    result = client.convert_pdf(
        b"%PDF-1.7\n", mode="hybrid", ocr_mode="force", ocr_language="por",
        preserve_links=True, extract_images=True,
        source_name="input.pdf", idempotency_key="same",
    )
    artifact = client.get_artifact(result.render_id or "", "image-1.png")
    options = captured["pdfImport"]  # type: ignore[assignment]
    assert options["ocrMode"] == "force"  # type: ignore[index]
    assert options["ocrLanguage"] == "por"  # type: ignore[index]
    assert "password" not in options
    assert options["preserveLinks"] is True  # type: ignore[index]
    assert options["extractImages"] is True  # type: ignore[index]
    assert artifact == b"PNG"


def test_client_rejects_pdf_password_locally() -> None:
    client = RuneClient("http://rune", transport=httpx.MockTransport(lambda _: httpx.Response(500)))
    import pytest
    with pytest.raises(ValueError, match="Encrypted"):
        client.convert_pdf(b"%PDF-1.7\n", password="secret")
