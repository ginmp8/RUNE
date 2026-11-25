from __future__ import annotations
import json
import httpx
from rune_client import RuneClient


def test_render_and_job_operations_follow_api_contract() -> None:
    requests: list[tuple[str, str, dict[str, object] | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else None
        requests.append((request.method, request.url.path, payload))
        if request.url.path == "/v1/render":
            return httpx.Response(202, json={"renderId": "00000000-0000-0000-0000-000000000001", "status": "queued"})
        if request.url.path.endswith("/cancel") or request.url.path.endswith("/retry"):
            return httpx.Response(202, json={"status": "accepted"})
        if request.url.path == "/v1/renders":
            return httpx.Response(200, json={"items": [], "offset": 0, "limit": 50, "total": 0})
        return httpx.Response(200, json={"job": {"id": "00000000-0000-0000-0000-000000000001", "status": "queued"}})

    client = RuneClient("http://rune", transport=httpx.MockTransport(handler))
    result = client.render("markdown", "# Test", "pdf", options={"pageSize": "A4"}, idempotency_key="same")
    assert result.render_id == "00000000-0000-0000-0000-000000000001"
    client.cancel(result.render_id, "test")
    client.retry(result.render_id, True)
    assert client.list_jobs()["total"] == 0
    assert requests[0][2]["idempotencyKey"] == "same"  # type: ignore[index]
    assert requests[1][1].endswith("/cancel")
    assert requests[2][2] == {"resetAttempts": True}


def test_synchronous_html_and_structured_document_results() -> None:
    def html_handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"contentType": "text/html; charset=utf-8", "html": "<h1>Ready</h1>", "requiredRenderers": [], "diagnostics": []})
    html = RuneClient("http://rune", transport=httpx.MockTransport(html_handler)).render("markdown", "# Ready", "interactiveHtml")
    assert html.html == "<h1>Ready</h1>"

    def json_handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"contentType": "application/vnd.rune.document+json", "document": {"version": "1.0", "nodes": []}})
    document = RuneClient("http://rune", transport=httpx.MockTransport(json_handler)).render("markdown", "# Ready", "structuredJson")
    assert document.document == {"version": "1.0", "nodes": []}


def test_feature_and_schema_discovery() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/features":
            return httpx.Response(200, json={"version": "0.6.0", "outputs": ["pdf"]})
        if request.url.path == "/v1/schemas":
            return httpx.Response(200, json=["render-request.v1.schema.json"])
        if request.url.path.endswith("render-request.v1.schema.json"):
            return httpx.Response(200, json={"$id": "render-request.v1.schema.json"})
        return httpx.Response(404)

    with RuneClient("http://rune", transport=httpx.MockTransport(handler)) as client:
        assert client.features()["version"] == "0.6.0"
        assert client.schemas() == ["render-request.v1.schema.json"]
        assert client.schema("render-request.v1.schema.json")["$id"] == "render-request.v1.schema.json"


def test_pdf_conversion_and_report_contract() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/render":
            captured.update(json.loads(request.content))
            return httpx.Response(202, json={"renderId": "00000000-0000-0000-0000-000000000009", "status": "queued"})
        if request.url.path.endswith("/conversion-report"):
            return httpx.Response(200, json={"schemaVersion": "1.0", "effectiveMode": "hybrid"})
        return httpx.Response(404)

    with RuneClient("http://rune", transport=httpx.MockTransport(handler)) as client:
        result = client.convert_pdf(b"%PDF-1.4\n", mode="hybrid", source_name="input.pdf")
        report = client.get_conversion_report(result.render_id or "")

    assert captured["sourceType"] == "pdf"
    assert captured["content"] == ""
    assert captured["outputFormat"] == "staticHtml"
    assert captured["sourceResourcePath"] == "source/input.pdf"
    assert captured["pdfImport"]["mode"] == "hybrid"  # type: ignore[index]
    assert captured["resources"][0]["contentType"] == "application/pdf"  # type: ignore[index]
    assert report["effectiveMode"] == "hybrid"


def test_template_and_multi_output_contract() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(202, json={"renderId": "00000000-0000-0000-0000-000000000011", "status": "queued"})

    result = RuneClient("http://rune", transport=httpx.MockTransport(handler)).render(
        "template",
        "# {{title}}",
        "pdf",
        resources=[{"path": "data.json", "contentBase64": "eyJ0aXRsZSI6IlJVTkUifQ==", "contentType": "application/json"}],
        template={"syntax": "rune-template-v1", "contentType": "markdown", "dataResourcePath": "data.json"},
        output_formats=["pdf", "png", "jpeg"],
        options={"cachePolicy": {"mode": "use", "scope": "sdk-test"}},
    )
    assert result.render_id == "00000000-0000-0000-0000-000000000011"
    assert captured["sourceType"] == "template"
    assert captured["outputFormats"] == ["pdf", "png", "jpeg"]
    assert captured["template"]["syntax"] == "rune-template-v1"  # type: ignore[index]



def test_composite_and_async_artifact_comparison_contract() -> None:
    requests: list[tuple[str, dict[str, object] | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        requests.append((request.url.path, body))
        if request.url.path == "/v1/comparisons":
            return httpx.Response(202, json={"id": "00000000-0000-0000-0000-000000000099", "statusUrl": "/v1/comparisons/99", "eventsUrl": "/v1/comparisons/99/events"})
        if request.url.path.endswith("000000000099"):
            return httpx.Response(200, json={"id": "00000000-0000-0000-0000-000000000099", "status": "completed", "outcome": "equivalentUnderProfile"})
        return httpx.Response(200, json={"contentType": "text/html; charset=utf-8", "html": "<section>ok</section>", "requiredRenderers": [], "diagnostics": []})

    with RuneClient("http://rune", transport=httpx.MockTransport(handler)) as client:
        result = client.render(
            "composite", "", "interactiveHtml",
            composite={"parts": [{"name": "Intro", "sourceType": "markdown", "content": "# Intro"}]},
        )
        accepted = client.create_comparison(
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
            profile={"name": "sdk", "version": "1", "compareVisual": True},
        )
        comparison = client.get_comparison(accepted["id"])
    assert result.html == "<section>ok</section>"
    assert requests[0][1]["sourceType"] == "composite"  # type: ignore[index]
    assert requests[0][1]["composite"]["parts"][0]["name"] == "Intro"  # type: ignore[index]
    assert requests[1][0] == "/v1/comparisons"
    assert requests[1][1]["left"]["artifactName"] == "content"  # type: ignore[index]
    assert comparison["outcome"] == "equivalentUnderProfile"
