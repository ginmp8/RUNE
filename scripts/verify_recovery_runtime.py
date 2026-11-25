#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

from recovery_common import FENCE_RE, inspect_dom, run_chromium

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
EXAMPLES = (
    ROOT / "services/rune/examples/reactflow/enterprise-event-driven-platform.md",
    ROOT / "services/rune/examples/reactflow/fraud-decision-orchestration.md",
    ROOT / "services/rune/examples/reactflow/multi-region-resilience.md",
)


def load_documents() -> list[dict]:
    documents: list[dict] = []
    for path in EXAMPLES:
        if not path.is_file():
            raise RuntimeError(f"Required recovery example is missing: {path}")
        matches = FENCE_RE.findall(path.read_text(encoding="utf-8"))
        if not matches:
            raise RuntimeError(f"No React Flow block found: {path}")
        documents.extend(json.loads(source) for source in matches)
    return documents


def base64url(value: dict) -> str:
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def standalone_html(documents: list[dict]) -> str:
    css = (ROOT / "services/rune/assets/reactflow/reactflow.css").read_text(encoding="utf-8")
    renderer = (ROOT / "services/rune/assets/reactflow/reactflow-renderer.js").read_text(encoding="utf-8")
    figures = "".join(
        f'<figure class="reactflow-document" data-render-state="pending" data-reactflow-payload="{base64url(document)}">'
        f'<figcaption>{document.get("title") or f"React Flow {index + 1}"}</figcaption>'
        '<div class="reactflow-loading">Rendering...</div><div class="reactflow-canvas"></div></figure>'
        for index, document in enumerate(documents)
    )
    return (
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        f'body{{font-family:Arial,sans-serif;margin:24px}}{css}</style></head><body>{figures}'
        f'<script>{renderer}</script><script>(async()=>{{window.__RUNE_RECOVERY_RESULT__=await '
        'window.MarkdownPdfReactFlow.renderAll();document.documentElement.dataset.recoveryDone="true";})();'
        '</script></body></html>'
    )


def verify(executable: str | None, timeout_seconds: int, output_pdf: Path | None) -> dict:
    documents = load_documents()
    expected_nodes = sum(len(item.get("nodes", [])) for item in documents)
    expected_edges = sum(len(item.get("edges", [])) for item in documents)
    dom, pdf = run_chromium(standalone_html(documents), executable=executable, timeout_seconds=timeout_seconds, output_pdf=output_pdf)
    counts = inspect_dom(dom)
    expected = {
        "documents": 3,
        "ready": 3,
        "svgs": 3,
        "nodes": expected_nodes,
        "edges": expected_edges,
        "markers": ["rf-arrow-0", "rf-arrow-1", "rf-arrow-2"],
    }
    failures = [f"{key}: expected {value!r}, got {counts.get(key)!r}" for key, value in expected.items() if counts.get(key) != value]
    if failures:
        raise RuntimeError("Recovery runtime validation failed:\n- " + "\n- ".join(failures))
    return {"version": VERSION, **counts, "pdfBytes": len(pdf), "renderer": "stable-static-svg"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the exact local deterministic React Flow renderer with real Chromium and PDF output.")
    parser.add_argument("--chromium-executable")
    parser.add_argument("--timeout-seconds", type=int, default=90)
    parser.add_argument("--output-pdf", type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.chromium_executable, args.timeout_seconds, args.output_pdf), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
