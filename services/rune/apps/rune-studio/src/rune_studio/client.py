from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Any, Iterator

import httpx


@dataclass(frozen=True)
class RenderResult:
    render_id: str | None
    status: str
    html: str | None = None
    document: dict[str, Any] | None = None
    content: bytes | None = None
    content_type: str | None = None
    diagnostics: list[dict[str, Any]] | None = None


class RuneClient:
    def __init__(self, base_url: str, timeout: float = 60.0, transport: httpx.BaseTransport | None = None) -> None:
        self._client = httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout, transport=transport)

    def close(self) -> None:
        self._client.close()

    def render(
        self,
        source_type: str,
        content: str,
        output_format: str,
        trusted_html: bool = False,
        *,
        options: dict[str, Any] | None = None,
        resources: list[dict[str, str | None]] | None = None,
        idempotency_key: str | None = None,
        document_name: str = "document.md",
        wait_for_completion: bool = False,
        wait_timeout_seconds: int = 5,
        source_resource_path: str | None = None,
        pdf_import: dict[str, Any] | None = None,
        template: dict[str, Any] | None = None,
        output_formats: list[str] | None = None,
        composite: dict[str, Any] | None = None,
        multi_output: dict[str, Any] | None = None,
    ) -> RenderResult:
        response = self._client.post(
            "/v1/render",
            json={
                "sourceType": source_type,
                "content": content,
                "outputFormat": None if output_formats else output_format,
                "htmlTrustMode": "trusted" if trusted_html else "safe",
                "options": options,
                "resources": resources or [],
                "idempotencyKey": idempotency_key,
                "documentName": document_name,
                "waitForCompletion": wait_for_completion,
                "waitTimeoutSeconds": wait_timeout_seconds,
                "sourceResourcePath": source_resource_path,
                "pdfImport": pdf_import,
                "template": template,
                "outputFormats": output_formats,
                "composite": composite,
                "multiOutput": multi_output,
            },
        )
        self._raise_for_status(response)
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return RenderResult(None, "completed", content=response.content, content_type=content_type)
        body = response.json()
        if not output_formats and output_format == "interactiveHtml":
            return RenderResult(None, "completed", html=body["html"], content_type=body["contentType"], diagnostics=body.get("diagnostics", []))
        if not output_formats and output_format == "structuredJson":
            return RenderResult(None, "completed", document=body["document"], content_type=body["contentType"])
        return RenderResult(body["renderId"], body["status"])

    def convert_pdf(
        self,
        content: bytes,
        *,
        mode: str = "hybrid",
        semantic_confidence_threshold: float = 0.65,
        visual_scale: float = 1.5,
        ocr_mode: str = "off",
        ocr_language: str = "eng",
        password: str | None = None,
        preserve_links: bool = False,
        extract_images: bool = True,
        source_name: str = "input.pdf",
        idempotency_key: str | None = None,
    ) -> RenderResult:
        if password:
            raise ValueError("Encrypted or permission-restricted PDFs are rejected by the stable RUNE contract.")
        resource_path = f"source/{source_name.rsplit('/', 1)[-1]}"
        return self.render(
            "pdf",
            "",
            "staticHtml",
            resources=[{
                "path": resource_path,
                "contentBase64": base64.b64encode(content).decode("ascii"),
                "contentType": "application/pdf",
            }],
            idempotency_key=idempotency_key,
            document_name=source_name.rsplit('/', 1)[-1],
            source_resource_path=resource_path,
            pdf_import={
                "mode": mode,
                "ocrMode": ocr_mode,
                "ocrLanguage": ocr_language,
                "semanticConfidenceThreshold": semantic_confidence_threshold,
                "visualScale": visual_scale,
                "emitRegionDiagnostics": True,
                "preserveLinks": preserve_links,
                "extractImages": extract_images,
            },
        )

    def get_conversion_report(self, render_id: str) -> dict[str, Any]:
        response = self._client.get(f"/v1/renders/{render_id}/conversion-report")
        self._raise_for_status(response)
        return response.json()

    def get_artifact(self, render_id: str, name: str) -> bytes:
        response = self._client.get(f"/v1/renders/{render_id}/artifacts/{name}")
        self._raise_for_status(response)
        return response.content

    def get_artifact_set_manifest(self, render_id: str) -> dict[str, Any]:
        response = self._client.get(f"/v1/renders/{render_id}/artifacts")
        self._raise_for_status(response)
        return response.json()

    def get_artifact_package(self, render_id: str) -> bytes:
        response = self._client.get(f"/v1/renders/{render_id}/package")
        self._raise_for_status(response)
        return response.content

    def create_comparison(self, left_render_id: str, right_render_id: str, *, left_artifact: str = "content", right_artifact: str = "content", profile: dict[str, Any] | None = None, idempotency_key: str | None = None) -> dict[str, Any]:
        response = self._client.post("/v1/comparisons", json={
            "left": {"renderId": left_render_id, "artifactName": left_artifact},
            "right": {"renderId": right_render_id, "artifactName": right_artifact},
            "profile": profile,
            "idempotencyKey": idempotency_key,
        })
        self._raise_for_status(response)
        return response.json()

    def get_comparison(self, comparison_id: str) -> dict[str, Any]:
        response = self._client.get(f"/v1/comparisons/{comparison_id}")
        self._raise_for_status(response)
        return response.json()

    def get_comparison_report(self, comparison_id: str, *, html: bool = False) -> bytes:
        suffix = "report.html" if html else "report.json"
        response = self._client.get(f"/v1/comparisons/{comparison_id}/{suffix}")
        self._raise_for_status(response)
        return response.content

    def get_status(self, render_id: str) -> dict[str, Any]:
        response = self._client.get(f"/v1/renders/{render_id}")
        self._raise_for_status(response)
        body = response.json()
        return body.get("job", body)

    def list_jobs(self, *, status: str | None = None, offset: int = 0, limit: int = 50) -> dict[str, Any]:
        response = self._client.get("/v1/renders", params={"status": status, "offset": offset, "limit": limit})
        self._raise_for_status(response)
        return response.json()

    def get_content(self, render_id: str) -> RenderResult:
        response = self._client.get(f"/v1/renders/{render_id}/content")
        self._raise_for_status(response)
        return RenderResult(render_id, "completed", content=response.content, content_type=response.headers.get("content-type"))

    def cancel(self, render_id: str, reason: str | None = None) -> None:
        response = self._client.post(f"/v1/renders/{render_id}/cancel", json={"reason": reason})
        self._raise_for_status(response)

    def retry(self, render_id: str, reset_attempts: bool = False) -> None:
        response = self._client.post(f"/v1/renders/{render_id}/retry", json={"resetAttempts": reset_attempts})
        self._raise_for_status(response)

    def get_features(self) -> dict[str, Any]:
        response = self._client.get("/v1/features")
        self._raise_for_status(response)
        return response.json()

    def stream_events(self, render_id: str, *, last_event_id: str | None = None) -> Iterator[dict[str, Any]]:
        headers = {"Last-Event-ID": last_event_id} if last_event_id else None
        with self._client.stream("GET", f"/v1/renders/{render_id}/events", headers=headers) as response:
            self._raise_for_status(response)
            event_name = "message"
            event_id: str | None = None
            retry: int | None = None
            data_lines: list[str] = []
            for line in response.iter_lines():
                if not line:
                    if data_lines:
                        import json
                        yield {"event": event_name, "id": event_id, "retry": retry, "data": json.loads("\n".join(data_lines))}
                    event_name, event_id, retry, data_lines = "message", None, None, []
                elif line.startswith(":"):
                    continue
                elif line.startswith("event:"):
                    event_name = line[6:].strip()
                elif line.startswith("id:"):
                    event_id = line[3:].strip()
                elif line.startswith("retry:"):
                    retry = int(line[6:].strip())
                elif line.startswith("data:"):
                    data_lines.append(line[5:].lstrip())

    def wait(self, render_id: str, timeout_seconds: int = 120, poll_interval_seconds: float = 0.5) -> RenderResult:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            job = self.get_status(render_id)
            status = str(job["status"]).lower()
            if status == "completed":
                return self.get_content(render_id)
            if status in {"failed", "cancelled"}:
                raise RuntimeError(job.get("error") or f"Render {status}")
            time.sleep(poll_interval_seconds)
        return RenderResult(render_id, "processing")

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            detail = response.text.strip()
            raise RuntimeError(detail or str(error)) from error
