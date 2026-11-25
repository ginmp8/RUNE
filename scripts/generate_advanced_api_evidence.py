#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

TERMINAL = {"completed", "failed", "cancelled"}


def encode(value: bytes | str) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    return base64.b64encode(value).decode("ascii")


def request(base_url: str, path: str, payload: dict | None = None, timeout: int = 180) -> tuple[int, dict[str, str], bytes]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    method = "GET" if payload is None else "POST"
    req = Request(base_url.rstrip("/") + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as response:
            return response.status, dict(response.headers), response.read()
    except HTTPError as error:
        return error.code, dict(error.headers), error.read()


def wait_job(base_url: str, render_id: str, seconds: int = 300) -> dict:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        status, _, body = request(base_url, f"/v1/renders/{render_id}")
        if status != 200:
            raise RuntimeError(body.decode(errors="replace"))
        response = json.loads(body)
        job = response.get("job", response)
        state = str(job["status"]).lower()
        if state in TERMINAL:
            if state != "completed":
                raise RuntimeError(json.dumps(job, indent=2))
            return job
        time.sleep(0.25)
    raise TimeoutError(render_id)


def render_job(base_url: str, payload: dict, output_path: Path) -> tuple[str, dict, bytes]:
    status, _, body = request(base_url, "/v1/render", payload)
    if status != 202:
        raise RuntimeError(f"render rejected: {status}: {body.decode(errors='replace')}")
    render_id = json.loads(body)["renderId"]
    job = wait_job(base_url, render_id)
    status, _, content = request(base_url, f"/v1/renders/{render_id}/content")
    if status != 200:
        raise RuntimeError(f"content failed: {status}: {content.decode(errors='replace')}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(content)
    return render_id, job, content


def extract_embedded_font(html: bytes) -> bytes:
    match = re.search(rb"src:url\(data:font/(?:woff2|woff);base64,([A-Za-z0-9+/=]+)\)", html)
    if not match:
        raise RuntimeError("embedded subset font was not found")
    return base64.b64decode(match.group(1), validate=True)


def create_woff2(root: Path, source_root: Path) -> Path:
    source = next((Path(path) for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ) if Path(path).is_file()), None)
    if source is None:
        raise RuntimeError("a system TrueType font is required")
    python = Path("/opt/pyvenv/bin/python") if Path("/opt/pyvenv/bin/python").is_file() else Path("/usr/bin/python3")
    tool = source_root / "services/rune/apps/rune-api/tools/rune_font_tool.py"
    output = root / "source.woff2"
    result = subprocess.run([str(python), str(tool), "sanitize", "--input", str(source), "--output", str(output), "--flavor", "woff2"], capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return output


def two_page_html(second_page: str) -> str:
    return f"""<!doctype html><html><body>
<section data-rune-section=\"Comparison/First\"><h1>Comparison page one</h1><p>Identical first page.</p></section>
<div style=\"break-before:page;page-break-before:always\"></div>
<section data-rune-section=\"Comparison/Second\"><h1>Comparison page two</h1><p>{second_page}</p></section>
</body></html>"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate advanced RUNE public API evidence.")
    parser.add_argument("--base-url", default="http://127.0.0.1:5080")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    source_root = Path(__file__).resolve().parents[1]
    version = (source_root / "VERSION").read_text(encoding="utf-8").strip()
    manifest: dict[str, object] = {"schemaVersion": 1, "version": version, "artifacts": [], "checks": {}}

    # Caller-defined declarative helper pipeline.
    template_payload = {
        "sourceType": "template",
        "content": "# {{product-label name}}\n\nGenerated through the public API.",
        "outputFormat": "interactiveHtml",
        "resources": [{"path": "data.json", "contentBase64": encode('{"name":"  rune platform  "}'), "contentType": "application/json"}],
        "template": {
            "contentType": "markdown", "dataResourcePath": "data.json", "allowedHelpers": ["product-label"],
            "customHelpers": [{"name": "product-label", "operations": [
                {"operation": "trim"}, {"operation": "upper"}, {"operation": "prefix", "argument": "DOC: "},
                {"operation": "replace", "argument": "PLATFORM", "secondArgument": "ENGINE"}]}]
        }
    }
    status, _, body = request(args.base_url, "/v1/render", template_payload)
    if status != 200:
        raise RuntimeError(body.decode(errors="replace"))
    template_response = json.loads(body)
    template_html = template_response["html"]
    if "DOC: RUNE ENGINE" not in template_html:
        raise RuntimeError("custom helper output was not rendered")
    (output / "custom-helper-response.json").write_bytes(body)
    (output / "custom-helper.html").write_text(template_html, encoding="utf-8")
    manifest["checks"]["customDeclarativeHelper"] = True

    # Real WOFF2 sanitization and required physical subsetting through the API.
    font_path = create_woff2(output, source_root)
    original_font = font_path.read_bytes()
    font_payload = {
        "sourceType": "markdown", "content": "# Physical Font API Evidence\n\nRUNE physical subset.",
        "outputFormat": "staticHtml", "documentName": "physical-font.md",
        "resources": [{"path": "fonts/source.woff2", "contentBase64": encode(original_font), "contentType": "font/woff2"}],
        "options": {"timeoutSeconds": 120, "fonts": {
            "faces": [{"family": "RUNE Physical", "resourcePath": "fonts/source.woff2", "licenseSpdx": "OFL-1.1", "licenseAllowsEmbedding": True}],
            "defaultFamily": "RUNE Physical", "subsetPolicy": "auto", "analyzeGlyphCoverage": True,
            "requiredCharacters": "RUNE physical subset.",
            "physicalSubset": {"mode": "required", "blockCurrentRequest": True, "minimumFontSizeBytes": 0,
                "maximumUsedGlyphRatio": 1, "minimumEstimatedSavingBytes": 0, "maximumFontsPerDocument": 1, "decisionBudgetMilliseconds": 1000},
            "sanitization": {"enabled": True, "requireSuccess": True, "timeoutSeconds": 60}
        }}
    }
    font_id, font_job, font_html = render_job(args.base_url, font_payload, output / "physical-font.html")
    embedded_font = extract_embedded_font(font_html)
    (output / "physical-font-subset.woff2").write_bytes(embedded_font)
    if len(embedded_font) >= len(original_font):
        raise RuntimeError("physical subset did not reduce font bytes")
    manifest["checks"]["font"] = {"renderId": font_id, "originalBytes": len(original_font), "subsetBytes": len(embedded_font), "status": font_job["status"]}

    # Two independently generated multipage PDFs for advanced comparison.
    common_pdf = {"sourceType": "html", "outputFormat": "pdf", "htmlTrustMode": "trusted", "options": {
        "pageSize": "A4", "timeoutSeconds": 120, "tagged": True, "outline": True, "emitStructureMap": True,
        "marginTop": "16mm", "marginRight": "16mm", "marginBottom": "16mm", "marginLeft": "16mm"}}
    left_id, _, left_pdf = render_job(args.base_url, {**common_pdf, "content": two_page_html("Original second-page text."), "idempotencyKey": f"{version}-compare-left"}, output / "comparison-left.pdf")
    right_id, _, right_pdf = render_job(args.base_url, {**common_pdf, "content": two_page_html("Changed second-page text."), "idempotencyKey": f"{version}-compare-right"}, output / "comparison-right.pdf")
    for render_id, name in ((left_id, "comparison-left-structure-map.json"), (right_id, "comparison-right-structure-map.json")):
        status, _, artifact = request(args.base_url, f"/v1/renders/{render_id}/artifacts/structure-map.json")
        if status != 200:
            raise RuntimeError(f"structure map missing for {render_id}: {status}")
        (output / name).write_bytes(artifact)
        parsed = json.loads(artifact)
        if parsed.get("pageCount", 0) < 2 or not parsed.get("nodes"):
            raise RuntimeError("structure map did not contain multipage nodes")

    comparison_payload = {
        "left": {"name": "comparison-left.pdf", "contentBase64": encode(left_pdf), "contentType": "application/pdf"},
        "right": {"name": "comparison-right.pdf", "contentBase64": encode(right_pdf), "contentType": "application/pdf"},
        "normalizeText": True, "includeByteRanges": True, "maximumReportedRanges": 20,
        "advanced": {"pixelComparison": True, "ocrComparison": True, "canonicalizePdf": True,
            "pixelTolerancePercent": 0.1, "maximumPixelMismatchRatio": 0, "minimumOcrSimilarity": 1,
            "rasterDpi": 110, "ocrLanguage": "eng", "timeoutSeconds": 120, "includePixelDiff": True}
    }
    status, _, comparison_body = request(args.base_url, "/v1/artifacts/compare", comparison_payload, timeout=240)
    if status != 200:
        raise RuntimeError(comparison_body.decode(errors="replace"))
    comparison = json.loads(comparison_body)
    if not comparison.get("pixel", {}).get("executed") or comparison.get("pixel", {}).get("comparedPages") != 2:
        raise RuntimeError("multipage pixel comparison did not execute")
    if 2 not in comparison.get("pixel", {}).get("differingPages", []):
        raise RuntimeError("second-page visual difference was not reported")
    if not comparison.get("ocr", {}).get("executed") or comparison.get("ocr", {}).get("comparedPages") != 2:
        raise RuntimeError("multipage OCR comparison did not execute")
    if comparison.get("canonicalPdf") is None:
        raise RuntimeError("PDF canonical comparison did not execute")
    diff_base64 = comparison["pixel"].pop("diffImageBase64", None)
    (output / "advanced-comparison.json").write_text(json.dumps(comparison, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if diff_base64:
        (output / "advanced-comparison-diff.png").write_bytes(base64.b64decode(diff_base64))
    manifest["checks"]["advancedComparison"] = {
        "comparedPages": comparison["pixel"]["comparedPages"], "differingPages": comparison["pixel"]["differingPages"],
        "ocrSimilarity": comparison["ocr"].get("similarity"), "canonicalEquivalent": comparison["canonicalPdf"].get("equivalent")}

    # Nested composite with a template helper, independent page geometry, a PDF part, TOC rewriting, and structure map.
    composite_payload = {
        "sourceType": "composite", "outputFormat": "pdf", "documentName": "advanced-composite.md",
        "resources": [
            {"path": "data.json", "contentBase64": encode('{"name":"  nested composite  "}'), "contentType": "application/json"},
            {"path": "comparison-left.pdf", "contentBase64": encode(left_pdf), "contentType": "application/pdf"}],
        "composite": {"includePartTitles": True, "pageBreakBetweenParts": True, "rewriteTableOfContents": True, "maximumDepth": 5, "parts": [
            {"name": "Introduction", "sourceType": "markdown", "content": "# Introduction\n\n[Go to details](#details)\n\n## Details\n\nA5 section.",
                "pageSize": "A5", "marginTop": "12mm", "marginRight": "12mm", "marginBottom": "12mm", "marginLeft": "12mm"},
            {"name": "Nested", "sourceType": "composite", "pageSize": "Letter", "landscape": True,
                "composite": {"includePartTitles": True, "pageBreakBetweenParts": True, "rewriteTableOfContents": True, "parts": [
                    {"name": "Template", "sourceType": "template", "content": "# {{label name}}\n\nNested template body.",
                        "template": {"contentType": "markdown", "dataResourcePath": "data.json", "allowedHelpers": ["label"],
                            "customHelpers": [{"name": "label", "operations": [{"operation": "trim"}, {"operation": "upper"}, {"operation": "prefix", "argument": "NESTED: "}]}]}}
                ]}},
            {"name": "Imported PDF", "sourceType": "pdf", "resourcePath": "comparison-left.pdf", "pageSize": "A4",
                "pdfImport": {"mode": "visual", "ocrMode": "off", "maximumPages": 10, "visualScale": 1.25, "extractImages": False}}
        ]},
        "options": {"pageSize": "A4", "includeToc": True, "timeoutSeconds": 180, "tagged": True, "outline": True, "emitStructureMap": True}
    }
    composite_id, composite_job, composite_pdf = render_job(args.base_url, composite_payload, output / "advanced-composite.pdf")
    status, _, structure = request(args.base_url, f"/v1/renders/{composite_id}/artifacts/structure-map.json")
    if status != 200:
        raise RuntimeError("advanced composite structure map was not published")
    (output / "advanced-composite-structure-map.json").write_bytes(structure)
    structure_payload = json.loads(structure)
    section_nodes = {node.get("section"): node for node in structure_payload.get("nodes", []) if node.get("section")}
    sections = set(section_nodes)
    if not {"Introduction", "Nested", "Nested/Template", "Imported PDF"}.issubset(sections):
        raise RuntimeError(f"advanced composite structure map lacks sections: {sorted(sections)}")
    expected_ranges = {"Introduction": (2, 2), "Nested": (3, 4), "Nested/Template": (4, 4), "Imported PDF": (5, 7)}
    for section, expected in expected_ranges.items():
        node = section_nodes[section]
        actual = (node.get("physicalPage"), node.get("physicalEndPage"))
        if actual != expected or node.get("mappingSource") != "printed-pdf-marker":
            raise RuntimeError(f"incorrect physical mapping for {section}: {actual}, {node.get('mappingSource')}")
    if structure_payload.get("fallbackNodeCount") != 0:
        raise RuntimeError("advanced composite structure map used an unexpected proportional fallback")
    manifest["checks"]["advancedComposite"] = {"renderId": composite_id, "status": composite_job["status"], "bytes": len(composite_pdf),
        "pages": structure_payload.get("pageCount"), "sections": sorted(value for value in sections if value), "physicalRanges": expected_ranges}

    for path in sorted(output.iterdir()):
        if path.is_file() and path.name != "manifest.json":
            manifest["artifacts"].append({"name": path.name, "size": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"ADVANCED API EVIDENCE PASSED: {version}; helpers, font subset, multipage comparison, nested/PDF composite, and structure maps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
