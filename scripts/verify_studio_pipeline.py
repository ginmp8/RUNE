#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

from recovery_common import FENCE_RE, inspect_dom, run_chromium

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
EXAMPLES = (
    ROOT / "services/rune/examples/reactflow/enterprise-event-driven-platform.md",
    ROOT / "services/rune/examples/reactflow/fraud-decision-orchestration.md",
    ROOT / "services/rune/examples/reactflow/multi-region-resilience.md",
)


def markdown_source() -> str:
    blocks = ["# RUNE Studio recovery smoke"]
    for path in EXAMPLES:
        for source in FENCE_RE.findall(path.read_text(encoding="utf-8")):
            json.loads(source)
            blocks.extend((f"## {path.stem}", "```reactflow", source, "```"))
    return "\n\n".join(blocks)


def render_html(api_url: str, timeout_seconds: int) -> str:
    payload = json.dumps({
        "sourceType": "markdown",
        "content": markdown_source(),
        "outputFormat": "interactiveHtml",
        "htmlTrustMode": "safe",
        "options": {"theme": "professional", "landscape": True, "timeoutSeconds": timeout_seconds},
    }).encode()
    request = Request(api_url.rstrip("/") + "/v1/render", data=payload, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=timeout_seconds) as response:
        value = json.loads(response.read())
    html = value.get("html")
    if not isinstance(html, str) or "__RUNE_RENDER_DONE__" not in html:
        raise RuntimeError("RUNE API did not return the expected interactive HTML contract.")
    return html


def verify(api_url: str, executable: str | None, timeout_seconds: int, output_pdf: Path | None) -> dict:
    dom, pdf = run_chromium(render_html(api_url, timeout_seconds), executable=executable, timeout_seconds=timeout_seconds, output_pdf=output_pdf)
    counts = inspect_dom(dom)
    expected = {"documents": 3, "ready": 3, "svgs": 3, "nodes": 72, "edges": 82, "markers": ["rf-arrow-0", "rf-arrow-1", "rf-arrow-2"]}
    failures = [f"{key}: expected {value!r}, got {counts.get(key)!r}" for key, value in expected.items() if counts.get(key) != value]
    if f'data-rune-version="{VERSION}"' not in dom:
        failures.append(f"compiled HTML does not identify RUNE {VERSION}")
    if failures:
        raise RuntimeError("Studio pipeline validation failed:\n- " + "\n- ".join(failures))
    return {"version": VERSION, **counts, "pdfBytes": len(pdf), "barrierReady": True, "renderer": "rune-api-html-pipeline"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate RUNE API compilation, global readiness, deterministic React Flow rendering, and PDF output.")
    parser.add_argument("--api-url", default="http://localhost:8080")
    parser.add_argument("--chromium-executable")
    parser.add_argument("--timeout-seconds", type=int, default=120)
    parser.add_argument("--output-pdf", type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.api_url, args.chromium_executable, args.timeout_seconds, args.output_pdf), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
