#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "services/rune/tests/fixtures/pdf-native"
TERMINAL = {"completed", "failed", "cancelled"}


def request(base_url: str, path: str, payload: dict | None = None, timeout: int = 240) -> tuple[int, dict[str, str], bytes]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    method = "GET" if payload is None else "POST"
    req = Request(base_url.rstrip("/") + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as response:
            return response.status, dict(response.headers), response.read()
    except HTTPError as error:
        return error.code, dict(error.headers), error.read()


def wait_job(base_url: str, render_id: str, seconds: int = 240, allow_failure: bool = False) -> dict:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        status, _, body = request(base_url, f"/v1/renders/{render_id}")
        if status != 200:
            raise RuntimeError(body.decode(errors="replace"))
        response = json.loads(body)
        job = response.get("job", response)
        state = str(job.get("status", "")).lower()
        if state in TERMINAL:
            if state != "completed" and not allow_failure:
                raise RuntimeError(json.dumps(job, indent=2))
            return job
        time.sleep(0.25)
    raise TimeoutError(render_id)


def encode(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pdf_import_options() -> dict:
    return {
        "mode": "native-page",
        "ocrMode": "off",
        "maximumPages": 20,
        "maximumSourceBytes": 25_000_000,
        "maximumOutputBytes": 150_000_000,
        "emitRegionDiagnostics": True,
        "preserveLinks": True,
        "extractImages": True,
        "signatures": "reject",
        "forms": "flatten",
        "annotations": {"links": "preserve", "comments": "flatten", "attachments": "reject"},
        "javascript": "remove",
        "fallback": "visual",
    }


def composite_payload(version: str, fixture: Path, output_format: str, case: str) -> dict:
    resource_path = f"pdf/{fixture.name}"
    return {
        "sourceType": "composite",
        "outputFormat": output_format,
        "documentName": f"native-pdf-{case}.md",
        "resources": [{"path": resource_path, "contentBase64": encode(fixture), "contentType": "application/pdf"}],
        "composite": {
            "includePartTitles": True,
            "pageBreakBetweenParts": True,
            "rewriteTableOfContents": True,
            "maximumDepth": 4,
            "parts": [
                {"name": "Introduction", "sourceType": "markdown", "content": f"# RUNE {version} native PDF evidence\n\nCase: `{case}`."},
                {"name": "Imported PDF", "sourceType": "pdf", "resourcePath": resource_path, "pdfImport": pdf_import_options()},
                {"name": "Conclusion", "sourceType": "markdown", "content": "# Conclusion\n\nNative PDF evidence complete."},
            ],
        },
        "options": {
            "theme": "professional",
            "pageSize": "A4",
            "includeToc": True,
            "tagged": True,
            "outline": True,
            "emitStructureMap": True,
            "timeoutSeconds": 180,
            "pdfAConformance": "2b",
        },
        "idempotencyKey": f"rune-{version}-native-pdf-{case}-{output_format.lower()}-{digest(fixture)[:16]}",
    }


def fetch_artifact(base_url: str, render_id: str, name: str, output: Path) -> bytes:
    status, _, body = request(base_url, f"/v1/renders/{render_id}/artifacts/{name}")
    if status != 200:
        raise RuntimeError(f"artifact {name} failed for {render_id}: {status}: {body.decode(errors='replace')}")
    output.write_bytes(body)
    return body


def render_completed(base_url: str, payload: dict, output_path: Path) -> tuple[str, dict, bytes]:
    status, _, body = request(base_url, "/v1/render", payload)
    if status != 202:
        raise RuntimeError(f"render rejected: {status}: {body.decode(errors='replace')}")
    render_id = json.loads(body)["renderId"]
    job = wait_job(base_url, render_id)
    status, _, content = request(base_url, f"/v1/renders/{render_id}/content")
    if status != 200 or not content.startswith(b"%PDF"):
        raise RuntimeError(f"invalid PDF result for {render_id}: {status}, {content[:100]!r}")
    output_path.write_bytes(content)
    return render_id, job, content


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate RUNE native PDF page-import evidence.")
    parser.add_argument("--base-url", default="http://127.0.0.1:5080")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()

    cases = [
        ("native-pdf", FIXTURES / "reportlab-subset-vectors-links.pdf", "pdf", "native-page", None),
        ("native-pdfa", FIXTURES / "reportlab-mixed-geometry.pdf", "pdfA", "native-page", None),
        ("form-visual-fallback", FIXTURES / "reportlab-form.pdf", "pdf", "visual", "form-flatten-required"),
        ("object-stream-fallback", FIXTURES / "rune-object-stream.pdf", "pdf", "visual", "unsupported-object-stream"),
        ("javascript-removed-native", FIXTURES / "pypdf-javascript.pdf", "pdf", "native-page", None),
    ]
    manifest: dict[str, object] = {"schemaVersion": 1, "version": version, "cases": [], "artifacts": []}

    for case, fixture, output_format, expected_mode, expected_reason in cases:
        payload = composite_payload(version, fixture, output_format, case)
        pdf_path = args.output / f"{case}.pdf"
        render_id, job, content = render_completed(args.base_url, payload, pdf_path)
        import_manifest_path = args.output / f"{case}-pdf-import-manifest.json"
        raw_manifest = fetch_artifact(args.base_url, render_id, "pdf-import-manifest.json", import_manifest_path)
        imported = json.loads(raw_manifest)
        if len(imported.get("imports", [])) != 1:
            raise RuntimeError(f"{case}: expected one import entry")
        entry = imported["imports"][0]
        if entry.get("requestedMode") != "native-page" or entry.get("appliedMode") != expected_mode:
            raise RuntimeError(f"{case}: unexpected import mode {entry}")
        if entry.get("fallbackReason") != expected_reason:
            raise RuntimeError(f"{case}: unexpected fallback reason {entry.get('fallbackReason')!r}")
        text_path = args.output / f"{case}-pdftotext.txt"
        text = subprocess.run(["pdftotext", str(pdf_path), "-"], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout
        text_path.write_bytes(text)
        info_path = args.output / f"{case}-pdfinfo.txt"
        info = subprocess.run(["pdfinfo", str(pdf_path)], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout
        info_path.write_bytes(info)
        if case == "native-pdf" and b"Selectable subset-font text" not in text:
            raise RuntimeError("native selectable source text was not preserved")
        if case == "form-visual-fallback" and not entry["detected"].get("forms"):
            raise RuntimeError("form fallback did not report detected forms")
        manifest["cases"].append({
            "case": case,
            "fixture": fixture.name,
            "fixtureSha256": digest(fixture),
            "outputFormat": output_format,
            "renderId": render_id,
            "status": job.get("status"),
            "requestedMode": entry.get("requestedMode"),
            "appliedMode": entry.get("appliedMode"),
            "fallbackReason": entry.get("fallbackReason"),
            "pages": entry.get("pages"),
            "outputBytes": len(content),
            "outputSha256": hashlib.sha256(content).hexdigest(),
        })

    reject_fixture = FIXTURES / "pypdf-signature.pdf"
    reject_payload = composite_payload(version, reject_fixture, "pdf", "signature-rejected")
    status, _, body = request(args.base_url, "/v1/render", reject_payload)
    rejection: dict[str, object] = {"case": "signature-rejected", "fixture": reject_fixture.name, "statusCode": status}
    if status == 202:
        render_id = json.loads(body)["renderId"]
        job = wait_job(args.base_url, render_id, allow_failure=True)
        if str(job.get("status", "")).lower() != "failed" or "pdf-signature-rejected" not in str(job.get("error", "")):
            raise RuntimeError(f"signature rejection did not fail safely: {job}")
        rejection.update({"renderId": render_id, "jobStatus": job.get("status"), "error": job.get("error")})
    elif status == 400:
        text = body.decode("utf-8", errors="replace")
        if "pdf-signature-rejected" not in text:
            raise RuntimeError(f"signature rejection used unexpected error: {text}")
        rejection["response"] = json.loads(body)
    else:
        raise RuntimeError(f"signature rejection returned unexpected status {status}: {body.decode(errors='replace')}")
    (args.output / "signature-rejected.json").write_text(json.dumps(rejection, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest["cases"].append(rejection)

    for path in sorted(args.output.iterdir()):
        if path.is_file() and path.name != "manifest.json":
            manifest["artifacts"].append({"name": path.name, "size": path.stat().st_size, "sha256": digest(path)})
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"NATIVE PDF EVIDENCE PASSED: RUNE {version}; native PDF/PDF-A, fallback, JavaScript removal, and signature rejection")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
