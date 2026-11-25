from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any

import streamlit as st
import streamlit.components.v1 as components

from rune_studio.client import RuneClient
from rune_studio.documentation import filter_features, load_catalog, read_feature_document
from rune_studio.pdf_import import conversion_artifact_names

st.set_page_config(page_title="RUNE Studio", page_icon="📄", layout="wide")


@st.cache_resource
def get_client() -> RuneClient:
    return RuneClient(os.getenv("RUNE_API_URL", "http://localhost:8080"), timeout=330)


EXAMPLE_MARKDOWN = """---
title: RUNE Studio
subtitle: Markdown and HTML rendering
toc: true
include-cover: true
organization: RUNE
version: 0.13.0
---
# Document

Markdown and HTML share the same rendering pipeline.

> [!NOTE] Preview
> Interactive HTML is returned directly by the API.

```mermaid
flowchart LR
  Source --> RUNE
  RUNE --> HTML
  RUNE --> PDF
```

```reactflow
{"title":"RUNE pipeline","nodes":[{"id":"a","position":{"x":20,"y":20},"data":{"label":"Markdown"},"type":"input"},{"id":"b","position":{"x":300,"y":120},"data":{"label":"HTML / PDF"},"type":"output"}],"edges":[{"id":"e1","source":"a","target":"b","label":"render"}]}
```
"""

EXAMPLE_HTML = """<!doctype html>
<html lang="en">
<head>
  <title>HTML input</title>
  <style>.html-card{max-width:720px;margin:3rem auto;padding:2rem;border:1px solid #bbb;border-radius:16px}</style>
</head>
<body><article class="html-card"><h1>HTML input</h1><p>Controlled styles and scripts are preserved in trusted mode.</p></article></body>
</html>"""

OUTPUTS = {
    "PDF": ("pdf", "pdf", "application/pdf"),
    "PDF/A": ("pdfA", "pdf", "application/pdf"),
    "Static HTML": ("staticHtml", "html", "text/html"),
    "Structured JSON": ("structuredJson", "json", "application/json"),
    "PNG": ("png", "png", "image/png"),
    "JPEG": ("jpeg", "jpg", "image/jpeg"),
    "SVG": ("svg", "svg", "image/svg+xml"),
}

REACTFLOW_EXAMPLES = {
    "Enterprise event-driven platform": "enterprise-event-driven-platform.md",
    "Fraud decision orchestration": "fraud-decision-orchestration.md",
    "Multi-region resilience": "multi-region-resilience.md",
}


def examples_root() -> Path:
    return Path(os.getenv("RUNE_EXAMPLES_ROOT", Path(__file__).resolve().parents[2] / "examples"))


def load_markdown_example(label: str) -> tuple[str, str]:
    if label == "RUNE overview":
        return EXAMPLE_MARKDOWN, "document.md"
    filename = REACTFLOW_EXAMPLES[label]
    path = (examples_root() / "reactflow" / filename).resolve()
    root = examples_root().resolve()
    if root not in path.parents or not path.is_file():
        raise FileNotFoundError(f"RUNE example is unavailable: {filename}")
    return path.read_text(encoding="utf-8"), filename


def defaults() -> None:
    state = st.session_state
    state.setdefault("source_type", "Markdown")
    state.setdefault("markdown_source", EXAMPLE_MARKDOWN)
    state.setdefault("html_source", EXAMPLE_HTML)
    state.setdefault("preview_html", None)
    state.setdefault("diagnostics", [])
    state.setdefault("preview_fingerprint", None)
    state.setdefault("last_export", None)
    state.setdefault("last_render_id", None)
    state.setdefault("busy", False)
    state.setdefault("markdown_document_name", "document.md")
    state.setdefault("html_document_name", "document.html")
    state.setdefault("pdf_import_result", None)
    state.setdefault("template_source", "# {{title}}\n\n{{#each items}}- {{name}}: {{currency value}}\n{{/each}}")
    state.setdefault("template_data", '{"title":"RUNE template","items":[{"name":"Total","value":1234.56}]}')
    state.setdefault("template_schema", '{"type":"object","required":["title","items"]}')
    state.setdefault("template_result", None)
    state.setdefault("comparison_result", None)


def encode_resources(uploaded_files: list[Any] | None) -> list[dict[str, str | None]]:
    return [
        {
            "path": uploaded.name,
            "contentBase64": base64.b64encode(uploaded.getvalue()).decode("ascii"),
            "contentType": uploaded.type or None,
        }
        for uploaded in uploaded_files or []
    ]


def fingerprint(source_type: str, source: str, options: dict[str, Any], resources: list[dict[str, str | None]]) -> str:
    payload = json.dumps({"sourceType": source_type, "source": source, "options": options, "resources": resources}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def infer_title(source_type: str, source: str) -> str:
    if source_type == "markdown":
        front = re.search(r"\A---\s*\n(.*?)\n---", source, re.S)
        if front:
            match = re.search(r"(?mi)^title:\s*[\"']?(.*?)[\"']?\s*$", front.group(1))
            if match:
                return match.group(1).strip()
        heading = re.search(r"(?m)^#\s+(.+?)\s*$", source)
        if heading:
            return heading.group(1).strip()
    else:
        title = re.search(r"(?is)<title[^>]*>(.*?)</title>", source)
        if title:
            return re.sub(r"<[^>]+>", "", title.group(1)).strip()
        heading = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", source)
        if heading:
            return re.sub(r"<[^>]+>", "", heading.group(1)).strip()
    return "RUNE document"


def source_summary(source: str) -> str:
    lines = source.count("\n") + 1
    words = len(re.findall(r"\b\w+\b", source, re.UNICODE))
    fences = len(re.findall(r"(?m)^```", source)) // 2
    return f"{len(source):,} characters · {words:,} words · {lines:,} lines · {fences} fenced blocks"


def clear_stale_results(current_fingerprint: str) -> None:
    if st.session_state.preview_fingerprint and st.session_state.preview_fingerprint != current_fingerprint:
        st.session_state.preview_html = None
        st.session_state.diagnostics = []
        st.session_state.preview_fingerprint = None
    export = st.session_state.last_export
    if export and export.get("fingerprint") != current_fingerprint:
        st.session_state.last_export = None


def render_preview(client: RuneClient, source_type: str, source: str, trusted: bool, options: dict[str, Any], resources: list[dict[str, str | None]], document_name: str, current_fingerprint: str) -> None:
    with st.status("Compiling interactive HTML...", expanded=True) as status:
        result = client.render(source_type, source, "interactiveHtml", trusted, options=options, resources=resources, document_name=document_name)
        st.session_state.preview_html = result.html
        st.session_state.diagnostics = result.diagnostics or []
        st.session_state.preview_fingerprint = current_fingerprint
        status.update(label="Preview ready", state="complete")


def render_export(client: RuneClient, source_type: str, source: str, trusted: bool, output_label: str, options: dict[str, Any], resources: list[dict[str, str | None]], document_name: str, current_fingerprint: str) -> None:
    output_format, extension, mime = OUTPUTS[output_label]
    key = hashlib.sha256(f"{current_fingerprint}:{output_format}".encode()).hexdigest()
    if output_format == "structuredJson":
        result = client.render(source_type, source, output_format, trusted, options=options, resources=resources, document_name=document_name)
        data = json.dumps(result.document, indent=2, ensure_ascii=False).encode()
        st.session_state.last_export = {"content": data, "extension": extension, "mime": mime, "fingerprint": current_fingerprint, "render_id": None, "label": output_label}
        return

    accepted = client.render(source_type, source, output_format, trusted, options=options, resources=resources, idempotency_key=key, document_name=document_name)
    if not accepted.render_id:
        raise RuntimeError("RUNE API did not return a render id.")
    st.session_state.last_render_id = accepted.render_id
    progress = st.progress(0, text="Render queued")
    status_slot = st.empty()
    deadline = time.monotonic() + max(180, int(options["timeoutSeconds"]) + 60)
    while time.monotonic() < deadline:
        job = client.get_status(accepted.render_id)
        percent = int(job.get("progressPercent") or 0)
        stage = str(job.get("progressStage") or job.get("status") or "processing")
        progress.progress(max(0, min(100, percent)), text=stage.replace("-", " ").title())
        status_slot.caption(f"Render ID: `{accepted.render_id}` · attempt {job.get('attempt', 0)}/{job.get('maximumAttempts', 4)}")
        state = str(job["status"]).lower()
        if state == "completed":
            result = client.get_content(accepted.render_id)
            st.session_state.last_export = {"content": result.content, "extension": extension, "mime": result.content_type or mime, "fingerprint": current_fingerprint, "render_id": accepted.render_id, "label": output_label}
            progress.progress(100, text="Completed")
            return
        if state in {"failed", "cancelled"}:
            raise RuntimeError(job.get("error") or f"Render {state}.")
        time.sleep(0.5)
    raise TimeoutError(f"Render {accepted.render_id} is still processing. Use the Jobs tab to continue tracking it.")


def render_export_set(client: RuneClient, source_type: str, source: str, trusted: bool, output_labels: list[str], options: dict[str, Any], resources: list[dict[str, str | None]], document_name: str, current_fingerprint: str, *, template: dict[str, Any] | None = None, package_zip: bool = True) -> None:
    if not output_labels:
        raise ValueError("Select at least one output format.")
    if len(output_labels) == 1 and template is None:
        render_export(client, source_type, source, trusted, output_labels[0], options, resources, document_name, current_fingerprint)
        return
    output_formats = [OUTPUTS[label][0] for label in output_labels]
    key = hashlib.sha256(f"{current_fingerprint}:{','.join(output_formats)}".encode()).hexdigest()
    accepted = client.render(
        source_type, source, output_formats[0], trusted, options=options, resources=resources,
        idempotency_key=key, document_name=document_name, template=template, output_formats=output_formats,
        multi_output={"atomicPolicy": "required", "packageMode": "zip" if package_zip else "none", "includeManifest": True, "includeProvenance": True},
    )
    if not accepted.render_id:
        raise RuntimeError("RUNE API did not return a render id.")
    st.session_state.last_render_id = accepted.render_id
    progress = st.progress(0, text="Atomic output set queued")
    deadline = time.monotonic() + max(180, int(options.get("timeoutSeconds", 60)) + 60)
    while time.monotonic() < deadline:
        job = client.get_status(accepted.render_id)
        progress.progress(max(0, min(100, int(job.get("progressPercent") or 0))), text=str(job.get("progressStage") or job.get("status")).replace("-", " ").title())
        state = str(job["status"]).lower()
        if state == "completed":
            manifest = client.get_artifact_set_manifest(accepted.render_id)
            package = client.get_artifact_package(accepted.render_id) if package_zip else None
            st.session_state.last_export = {
                "content": package if package is not None else json.dumps(manifest, indent=2).encode(),
                "extension": "zip" if package is not None else "json",
                "mime": "application/zip" if package is not None else "application/json",
                "fingerprint": current_fingerprint, "render_id": accepted.render_id,
                "label": "Atomic output package" if package is not None else "Artifact-set manifest",
                "manifest": manifest,
            }
            progress.progress(100, text="Atomic output set committed")
            return
        if state in {"failed", "cancelled"}:
            raise RuntimeError(job.get("error") or f"Render {state}.")
        time.sleep(0.5)
    raise TimeoutError(f"Render {accepted.render_id} is still processing. Use the Jobs tab to continue tracking it.")


def diagnostics_panel(items: list[dict[str, Any]]) -> None:
    if not items:
        return
    severity_order = ["error", "warning", "info"]
    tabs = st.tabs([f"{name.title()} ({sum(str(item.get('severity', '')).lower() == name for item in items)})" for name in severity_order])
    for tab, severity in zip(tabs, severity_order, strict=True):
        with tab:
            selected = [item for item in items if str(item.get("severity", "")).lower() == severity]
            if not selected:
                st.caption("No diagnostics.")
            for item in selected:
                location = f" · line {item['line']}" if item.get("line") else ""
                st.markdown(f"**`{item.get('code', 'diagnostic')}`**{location}  \n{item.get('message', '')}")


def editor_tab() -> None:
    client = get_client()
    busy = st.session_state.busy
    with st.sidebar:
        st.header("Document")
        source_type_label = st.radio("Source", ["Markdown", "HTML"], key="source_type", horizontal=True, disabled=busy)
        source_type = source_type_label.lower()
        trusted = st.checkbox("Trusted HTML", disabled=busy or source_type != "html", help="Use only with controlled HTML.")
        source_upload = st.file_uploader("Open document", type=["md", "markdown", "html", "htm", "txt"], disabled=busy)
        uploaded_files = st.file_uploader("Resources", accept_multiple_files=True, disabled=busy, help="Images, fonts, stylesheets, include files, JSON, YAML, CSV, or other local resources.")
        st.header("Rendering")
        theme = st.selectbox("Theme", ["professional", "minimal", "dark"], disabled=busy)
        page_size = st.selectbox("Page size", ["A4", "Letter", "Legal", "A3", "A5", "Tabloid"], disabled=busy)
        landscape = st.checkbox("Landscape", disabled=busy)
        include_cover = st.checkbox("Cover", disabled=busy)
        include_toc = st.checkbox("Table of contents", disabled=busy)
        number_headings = st.checkbox("Number headings", disabled=busy)
        apply_front_matter = st.checkbox("Apply front matter", value=True, disabled=busy)
        watermark = st.text_input("Watermark", disabled=busy)
        timeout_seconds = st.slider("Render timeout", 5, 300, 60, 5, disabled=busy)
        output_labels = st.multiselect("Export formats", list(OUTPUTS), default=["PDF"], disabled=busy, help="Multiple formats are generated and committed atomically.")
        package_zip = st.checkbox("Package output set as ZIP", value=True, disabled=busy or len(output_labels) < 2)
        with st.expander("Advanced rendering"):
            language = st.text_input("Language", value="en", disabled=busy)
            direction = st.selectbox("Text direction", ["ltr", "rtl"], disabled=busy)
            viewport_width = st.number_input("Viewport width", 320, 7680, 1440, 10, disabled=busy)
            viewport_height = st.number_input("Viewport height", 240, 7680, 1000, 10, disabled=busy)
            margin_top = st.text_input("Top margin", value="20mm", disabled=busy)
            margin_right = st.text_input("Right margin", value="18mm", disabled=busy)
            margin_bottom = st.text_input("Bottom margin", value="20mm", disabled=busy)
            margin_left = st.text_input("Left margin", value="18mm", disabled=busy)
            header_template = st.text_area("Header template", disabled=busy, help="Trusted Chromium header HTML.")
            footer_template = st.text_area("Footer template", disabled=busy, help="Trusted Chromium footer HTML.")
            additional_css = st.text_area("Additional CSS", disabled=busy)
            page_decorations_json = st.text_area("Page decoration profiles (JSON)", disabled=busy, help="Canonical API pageDecorations object with default/first/left/right/rules.")
            fonts_json = st.text_area("Font mapping (JSON)", disabled=busy, help="Canonical API fonts object. Upload the referenced local font resources above.")
            tagged = st.checkbox("Tagged PDF", value=True, disabled=busy)
            outline = st.checkbox("PDF outline", value=True, disabled=busy)
            jpeg_quality = st.slider("JPEG quality", 1, 100, 90, disabled=busy)
            pdfa_conformance = st.selectbox("PDF/A conformance", ["1b", "2b", "3b"], index=1, disabled=busy)
        with st.expander("Cover metadata"):
            cover_title = st.text_input("Cover title", disabled=busy)
            cover_subtitle = st.text_input("Cover subtitle", disabled=busy)
            cover_author = st.text_input("Cover author", disabled=busy)
            cover_organization = st.text_input("Cover organization", disabled=busy)
            cover_version = st.text_input("Cover version", disabled=busy)
            cover_status = st.text_input("Cover status", disabled=busy)
            cover_description = st.text_area("Cover description", disabled=busy)
            cover_date = st.text_input("Cover date", disabled=busy)
            cover_image = st.text_input("Cover image resource path", disabled=busy)

    source_key = "markdown_source" if source_type == "markdown" else "html_source"
    document_name_key = "markdown_document_name" if source_type == "markdown" else "html_document_name"
    if source_upload is not None:
        upload_key = f"{source_type}:{source_upload.name}:{source_upload.size}"
        if st.session_state.get("loaded_source_upload") != upload_key:
            st.session_state[source_key] = source_upload.getvalue().decode("utf-8-sig")
            st.session_state[document_name_key] = source_upload.name
            st.session_state.loaded_source_upload = upload_key
            st.rerun()

    options: dict[str, Any] = {
        "theme": theme, "pageSize": page_size, "landscape": landscape, "printBackground": True,
        "includeCover": include_cover, "includeToc": include_toc, "numberHeadings": number_headings,
        "applyFrontMatter": apply_front_matter, "watermark": watermark or None,
        "timeoutSeconds": timeout_seconds, "language": language or "en", "direction": direction,
        "width": int(viewport_width), "height": int(viewport_height),
        "marginTop": margin_top, "marginRight": margin_right,
        "marginBottom": margin_bottom, "marginLeft": margin_left,
        "headerTemplate": header_template or None, "footerTemplate": footer_template or None,
        "additionalCss": additional_css or None, "tagged": tagged, "outline": outline,
        "jpegQuality": jpeg_quality, "pdfAConformance": pdfa_conformance,
        "coverTitle": cover_title or None, "coverSubtitle": cover_subtitle or None,
        "coverAuthor": cover_author or None, "coverOrganization": cover_organization or None,
        "coverVersion": cover_version or None, "coverStatus": cover_status or None,
        "coverDescription": cover_description or None, "coverDate": cover_date or None,
        "coverImage": cover_image or None,
    }
    try:
        if page_decorations_json.strip():
            options["pageDecorations"] = json.loads(page_decorations_json)
        if fonts_json.strip():
            options["fonts"] = json.loads(fonts_json)
    except json.JSONDecodeError as error:
        st.error(f"Invalid advanced JSON: {error}")
    resources = encode_resources(uploaded_files)

    editor_col, action_col = st.columns([5, 1])
    with editor_col:
        source = st.text_area("Document source", key=source_key, height=580, disabled=busy)
    with action_col:
        example_label = st.selectbox(
            "Example",
            ["RUNE overview", *REACTFLOW_EXAMPLES] if source_type == "markdown" else ["HTML document"],
            disabled=busy,
        )
        if st.button("Load example", use_container_width=True, disabled=busy):
            if source_type == "markdown":
                example_source, example_name = load_markdown_example(example_label)
                st.session_state[source_key] = example_source
                st.session_state[document_name_key] = example_name
            else:
                st.session_state[source_key] = EXAMPLE_HTML
                st.session_state[document_name_key] = "document.html"
            st.rerun()
        preview_clicked = st.button("Update preview", use_container_width=True, type="primary", disabled=busy)
        export_clicked = st.button("Generate export", use_container_width=True, disabled=busy)
        if st.session_state.last_render_id:
            st.caption(f"Last render: `{st.session_state.last_render_id}`")

    document_name = str(st.session_state[document_name_key])
    current_fingerprint = fingerprint(source_type, source, options, resources)
    clear_stale_results(current_fingerprint)
    title_col, summary_col = st.columns([2, 3])
    title_col.metric("Detected title", infer_title(source_type, source))
    summary_col.metric("Document summary", source_summary(source))
    st.caption(f"Document: `{document_name}`")

    if preview_clicked or export_clicked:
        st.session_state.busy = True
        try:
            if preview_clicked:
                render_preview(client, source_type, source, trusted, options, resources, document_name, current_fingerprint)
            if export_clicked:
                render_export_set(client, source_type, source, trusted, output_labels, options, resources, document_name, current_fingerprint, package_zip=package_zip)
        except Exception as error:
            st.error(str(error))
        finally:
            st.session_state.busy = False

    st.subheader("Preview")
    if st.session_state.preview_html:
        components.html(st.session_state.preview_html, height=760, scrolling=True)
    else:
        st.info("Update the preview to compile the current document.")
    diagnostics_panel(st.session_state.diagnostics)

    export = st.session_state.last_export
    if export:
        st.subheader("Last export")
        st.download_button(
            f"Download {export['label']}", export["content"],
            file_name=f"{Path(document_name).stem or 'rune-output'}.{export['extension']}",
            mime=export["mime"], use_container_width=True,
        )
        if export.get("render_id"):
            st.code(export["render_id"], language=None)
        if export.get("manifest"):
            with st.expander("Artifact-set manifest"):
                st.json(export["manifest"])


def pdf_import_tab() -> None:
    client = get_client()
    st.header("PDF to HTML")
    st.caption("Choose visual fidelity, semantic editability, or hybrid page-level fallback. Native-page import is available for PDF parts in composite PDF/PDF-A jobs, not in this PDF-to-HTML converter.")
    uploaded = st.file_uploader("Source PDF", type=["pdf"], key="pdf_import_upload")
    controls = st.columns(3)
    mode = controls[0].selectbox("Conversion mode", ["hybrid", "semantic", "visual"])
    threshold = controls[1].slider("Semantic confidence", 0.0, 1.0, 0.65, 0.05, disabled=mode == "visual")
    visual_scale = controls[2].slider("Visual scale", 0.5, 4.0, 1.5, 0.25, disabled=mode == "semantic")
    advanced = st.columns(2)
    ocr_mode = advanced[0].selectbox("OCR mode", ["off", "auto", "force"])
    ocr_language = advanced[1].text_input("OCR language", value="eng", disabled=ocr_mode == "off")
    st.caption("Encrypted or permission-restricted PDFs are rejected by the stable contract.")
    safety = st.columns(2)
    preserve_links = safety[0].checkbox("Preserve safe links", value=False)
    extract_images = safety[1].checkbox("Extract images", value=True)
    convert = st.button("Convert PDF", type="primary", disabled=uploaded is None or st.session_state.busy)

    if convert and uploaded is not None:
        st.session_state.busy = True
        try:
            source = uploaded.getvalue()
            key_material = json.dumps({
                "mode": mode, "threshold": threshold, "visualScale": visual_scale,
                "ocrMode": ocr_mode, "ocrLanguage": ocr_language,
                "preserveLinks": preserve_links, "extractImages": extract_images,
            }, sort_keys=True).encode()
            key = hashlib.sha256(source + key_material).hexdigest()
            accepted = client.convert_pdf(
                source,
                mode=mode,
                semantic_confidence_threshold=threshold,
                visual_scale=visual_scale,
                ocr_mode=ocr_mode,
                ocr_language=ocr_language or "eng",
                preserve_links=preserve_links,
                extract_images=extract_images,
                source_name=uploaded.name,
                idempotency_key=key,
            )
            if not accepted.render_id:
                raise RuntimeError("RUNE API did not return a PDF conversion id.")
            st.session_state.last_render_id = accepted.render_id
            progress = st.progress(0, text="PDF conversion queued")
            deadline = time.monotonic() + 300
            while time.monotonic() < deadline:
                job = client.get_status(accepted.render_id)
                progress.progress(int(job.get("progressPercent") or 0), text=str(job.get("progressStage") or job["status"]).replace("-", " ").title())
                status = str(job["status"]).lower()
                if status == "completed":
                    result = client.get_content(accepted.render_id)
                    report = client.get_conversion_report(accepted.render_id)
                    artifacts = {name: client.get_artifact(accepted.render_id, name) for name in conversion_artifact_names(report)}
                    st.session_state.pdf_import_result = {
                        "render_id": accepted.render_id,
                        "html": result.content or b"",
                        "content_type": result.content_type or "text/html",
                        "report": report,
                        "artifacts": artifacts,
                        "source_name": uploaded.name,
                    }
                    progress.progress(100, text="Completed")
                    break
                if status in {"failed", "cancelled"}:
                    raise RuntimeError(job.get("error") or f"PDF conversion {status}.")
                time.sleep(0.5)
            else:
                raise TimeoutError(f"PDF conversion {accepted.render_id} is still processing. Use the Jobs tab to continue tracking it.")
        except Exception as error:
            st.error(str(error))
        finally:
            st.session_state.busy = False

    conversion = st.session_state.pdf_import_result
    if conversion:
        st.subheader("Converted HTML")
        html = conversion["html"].decode("utf-8", errors="replace")
        components.html(html, height=760, scrolling=True)
        downloads = st.columns(2)
        downloads[0].download_button(
            "Download HTML", conversion["html"],
            file_name=f"{Path(conversion['source_name']).stem}.html",
            mime=conversion["content_type"], use_container_width=True,
        )
        report_bytes = json.dumps(conversion["report"], indent=2, ensure_ascii=False).encode()
        downloads[1].download_button(
            "Download conversion report", report_bytes,
            file_name="conversion-report.json", mime="application/json", use_container_width=True,
        )
        artifacts = conversion.get("artifacts") or {}
        if artifacts:
            st.subheader("Extracted artifacts")
            for name, content in artifacts.items():
                suffix = Path(name).suffix.lower()
                mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(suffix, "application/octet-stream")
                st.download_button(f"Download {name}", content, file_name=name, mime=mime, key=f"artifact-{conversion['render_id']}-{name}")
        with st.expander("Conversion diagnostics", expanded=True):
            st.json(conversion["report"])

def jobs_tab() -> None:
    client = get_client()
    controls = st.columns([2, 1, 1])
    status = controls[0].selectbox("Status", ["all", "queued", "claimed", "rendering", "cancelRequested", "cancelled", "completed", "failed"])
    limit = controls[1].number_input("Limit", 1, 200, 50)
    refresh = controls[2].button("Refresh", use_container_width=True)
    try:
        page = client.list_jobs(status=None if status == "all" else status, limit=int(limit))
    except Exception as error:
        st.error(str(error))
        return
    items = page.get("items", [])
    st.caption(f"{page.get('total', len(items))} render jobs")
    for job in items:
        formats = job.get("outputFormats") or [job.get("outputFormat")]
        with st.expander(f"{job['id']} · {job['status']} · {', '.join(str(item) for item in formats if item)}"):
            st.progress(int(job.get("progressPercent") or 0), text=str(job.get("progressStage") or job["status"]))
            st.json(job)
            action_columns = st.columns(4)
            if action_columns[0].button("Track", key=f"track-{job['id']}"):
                st.session_state.last_render_id = job["id"]
            if job["status"] not in {"completed", "failed", "cancelled"} and action_columns[1].button("Cancel", key=f"cancel-{job['id']}"):
                client.cancel(job["id"], "Cancelled from RUNE Studio")
                st.rerun()
            if job["status"] in {"failed", "cancelled"} and action_columns[2].button("Retry", key=f"retry-{job['id']}"):
                client.retry(job["id"])
                st.rerun()
            if job["status"] == "completed":
                if job.get("outputFormats"):
                    manifest = client.get_artifact_set_manifest(job["id"])
                    action_columns[3].download_button("Manifest", json.dumps(manifest, indent=2).encode(), file_name=f"rune-{job['id']}-manifest.json", mime="application/json", key=f"manifest-{job['id']}")
                else:
                    result = client.get_content(job["id"])
                    extension = {"pdf": "pdf", "pdfA": "pdf", "png": "png", "jpeg": "jpg", "svg": "svg", "staticHtml": "html"}.get(job.get("outputFormat"), "bin")
                    action_columns[3].download_button("Download", result.content, file_name=f"rune-{job['id']}.{extension}", mime=result.content_type, key=f"download-{job['id']}")


def template_tab() -> None:
    client = get_client()
    st.header("Parameterized templates")
    st.caption("Strict rune-template-v1 evaluation with typed JSON data, schema validation, contextual escaping, deterministic locale, and time zone.")
    template_source = st.text_area("Template", key="template_source", height=300)
    columns = st.columns(2)
    data_source = columns[0].text_area("Data JSON", key="template_data", height=260)
    schema_source = columns[1].text_area("JSON Schema", key="template_schema", height=260)
    settings = st.columns(4)
    culture = settings[0].text_input("Culture", value="pt-BR")
    time_zone = settings[1].text_input("Time zone", value="America/Sao_Paulo")
    strict = settings[2].checkbox("Strict", value=True)
    output_labels = settings[3].multiselect("Outputs", list(OUTPUTS), default=["Static HTML", "PDF"] )
    if st.button("Render template", type="primary"):
        try:
            json.loads(data_source)
            json.loads(schema_source)
            resources = [
                {"path":"data.json","contentBase64":base64.b64encode(data_source.encode()).decode(),"contentType":"application/json"},
                {"path":"schema.json","contentBase64":base64.b64encode(schema_source.encode()).decode(),"contentType":"application/schema+json"},
            ]
            template = {"syntax":"rune-template-v1","contentType":"markdown","dataResourcePath":"data.json","dataSchemaResourcePath":"schema.json","strict":strict,"culture":culture,"timeZone":time_zone,"escapingMode":"contextual","applySchemaDefaults":True}
            fp = fingerprint("template", template_source, {"template":template}, resources)
            render_export_set(client, "template", template_source, False, output_labels, {"timeoutSeconds":60}, resources, "template.md", fp, template=template, package_zip=len(output_labels)>1)
            st.session_state.template_result = st.session_state.last_export
        except Exception as error:
            st.error(str(error))
    result = st.session_state.template_result
    if result:
        st.download_button("Download template result", result["content"], file_name=f"rune-template.{result['extension']}", mime=result["mime"])
        if result.get("manifest"):
            st.json(result["manifest"])


def comparison_tab() -> None:
    client = get_client()
    st.header("Artifact comparison jobs")
    st.caption("Compare immutable RUNE artifacts asynchronously. Source authorization and report classification are evaluated independently.")
    columns = st.columns(2)
    left = columns[0].text_input("Left render ID")
    right = columns[1].text_input("Right render ID")
    artifacts = st.columns(2)
    left_name = artifacts[0].text_input("Left artifact", value="content")
    right_name = artifacts[1].text_input("Right artifact", value="content")
    layers = st.columns(3)
    visual = layers[0].checkbox("Visual", value=True)
    ocr = layers[1].checkbox("OCR", value=False)
    profile_name = layers[2].text_input("Profile", value="studio-review")
    if st.button("Create comparison", type="primary", disabled=not left or not right):
        try:
            accepted = client.create_comparison(left, right, left_artifact=left_name, right_artifact=right_name, profile={"name":profile_name,"version":"1","compareIdentity":True,"compareSemantic":True,"compareStructure":True,"compareVisual":visual,"compareOcr":ocr})
            comparison_id = str(accepted["id"])
            progress = st.progress(0, text="Comparison queued")
            deadline = time.monotonic() + 180
            while time.monotonic() < deadline:
                job = client.get_comparison(comparison_id)
                progress.progress(int(job.get("progressPercent") or 0), text=str(job.get("progressStage") or job["status"]).replace("-", " ").title())
                if str(job["status"]).lower() == "completed":
                    st.session_state.comparison_result = {"job":job,"json":client.get_comparison_report(comparison_id),"html":client.get_comparison_report(comparison_id, html=True)}
                    break
                if str(job["status"]).lower() in {"failed","cancelled"}:
                    raise RuntimeError(job.get("error") or f"Comparison {job['status']}")
                time.sleep(0.5)
        except Exception as error:
            st.error(str(error))
    result = st.session_state.comparison_result
    if result:
        st.json(result["job"])
        downloads = st.columns(2)
        downloads[0].download_button("Download JSON report", result["json"], file_name="comparison-report.json", mime="application/json")
        downloads[1].download_button("Download HTML report", result["html"], file_name="comparison-report.html", mime="text/html")
        components.html(result["html"].decode("utf-8", errors="replace"), height=700, scrolling=True)


def documentation_tab() -> None:
    st.header("RUNE feature documentation")
    docs_root = Path(os.getenv("RUNE_DOCS_ROOT", Path(__file__).resolve().parents[2] / "docs"))
    try:
        catalog = load_catalog(docs_root)
    except Exception as error:
        st.error(f"Documentation catalog is unavailable: {error}")
        return

    features = catalog.get("features", [])
    categories = sorted({str(feature.get("category", "Other")) for feature in features})
    search_col, category_col = st.columns([3, 1])
    query = search_col.text_input("Search features", placeholder="Markdown, ownership, PDF/A, jobs...")
    category = category_col.selectbox("Category", ["All", *categories])
    matches = filter_features(catalog, query=query, category=category)
    st.caption(f"RUNE {catalog.get('version', 'unknown')} · {len(matches)} of {len(features)} documented features")
    if not matches:
        st.info("No features match the current filters.")
        return

    labels = {f"{item.get('category', 'Other')} · {item.get('title', item.get('id', 'Feature'))}": item for item in matches}
    selected_label = st.selectbox("Feature", list(labels))
    feature = labels[selected_label]
    status = str(feature.get("status", "unknown"))
    st.markdown(f"**Status:** `{status}`  \n**Feature ID:** `{feature.get('id', '')}`")
    st.write(feature.get("summary", ""))
    try:
        file_name, content, markdown = read_feature_document(docs_root, feature)
    except Exception as error:
        st.error(f"Feature documentation is unavailable: {error}")
        return
    st.markdown(markdown)
    with st.expander("Traceability"):
        st.markdown("**Implementation**")
        for path in feature.get("implementation", []):
            st.code(str(path), language=None)
        st.markdown("**Tests**")
        for path in feature.get("tests", []):
            st.code(str(path), language=None)
        if feature.get("referenceCase"):
            st.markdown(f"**Compatibility case:** `{feature['referenceCase']}`")
    st.download_button("Download documentation", content, file_name=file_name, mime="text/markdown")


def main() -> None:
    defaults()
    st.title("RUNE Studio")
    st.caption("Markdown, HTML, and PDF conversion through the RUNE API")
    editor, templates, pdf_import, comparisons, jobs, docs = st.tabs(["Editor", "Templates", "PDF to HTML", "Compare", "Jobs", "Documentation"])
    with editor:
        editor_tab()
    with templates:
        template_tab()
    with pdf_import:
        pdf_import_tab()
    with comparisons:
        comparison_tab()
    with jobs:
        jobs_tab()
    with docs:
        documentation_tab()


if __name__ == "__main__":
    main()
