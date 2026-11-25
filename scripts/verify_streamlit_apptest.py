#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "services/rune/apps/rune-studio/app.py"
EXPECTED_STREAMLIT = "1.59.2"
SCHEMATEX_SOURCE = '''---
title: RUNE Streamlit AppTest
---
# Streamlit distributed workflow

```schematex
entity-structure "AppTest Ownership"
jurisdiction BR "Brazil"
entity owner "Owner" individual@BR
entity holding "Holding S.A." corp@BR
entity product "RUNE Ltda." llc@BR
owner -> holding : 100%
holding -> product : 100%
```

```orgchart
ceo: "RUNE Director" | "CEO"
  studio: "Studio Lead" | "Streamlit"
  renderer: "Renderer Lead" | "Worker"
```
'''


def by_label(elements: Iterable[Any], label: str) -> Any:
    matches = [element for element in elements if getattr(element, "label", None) == label]
    if len(matches) != 1:
        labels = [getattr(element, "label", None) for element in elements]
        raise LookupError(f"Expected one widget labelled {label!r}; found {labels!r}")
    return matches[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute the exact Streamlit AppTest runtime against a live RUNE API.")
    parser.add_argument("--api-url", default="http://127.0.0.1:5080")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=330)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    import streamlit
    from streamlit.testing.v1 import AppTest

    if streamlit.__version__ != EXPECTED_STREAMLIT:
        raise RuntimeError(f"Expected Streamlit {EXPECTED_STREAMLIT}, got {streamlit.__version__}")

    os.environ["RUNE_API_URL"] = args.api_url.rstrip("/")
    at = AppTest.from_file(str(APP), default_timeout=args.timeout_seconds).run()
    if at.exception:
        raise RuntimeError(f"Initial AppTest run failed: {at.exception}")
    if at.title[0].value != "RUNE Studio":
        raise RuntimeError(f"Unexpected Studio title: {at.title[0].value!r}")

    by_label(at.text_area, "Document source").input(SCHEMATEX_SOURCE)
    by_label(at.multiselect, "Export formats").set_value(["Static HTML"])
    by_label(at.button, "Update preview").click()
    at.run(timeout=args.timeout_seconds)
    if at.exception:
        raise RuntimeError(f"Preview AppTest run failed: {at.exception}")
    preview = at.session_state["preview_html"]
    if not isinstance(preview, str) or "__RUNE_RENDER_DONE__" not in preview:
        raise RuntimeError("Streamlit preview did not receive ready interactive HTML from RUNE API")
    for kind in ("schematex", "orgchart"):
        if f'data-kind="{kind}"' not in preview:
            raise RuntimeError(f"Streamlit preview is missing the {kind} diagram")
    if preview.count('data-schematex-version="1.0.1"') < 2:
        raise RuntimeError("Streamlit preview did not receive both official SchemaTex diagrams")
    if preview.count("<svg") < 2:
        raise RuntimeError("Streamlit preview is missing materialized SVG diagrams")

    by_label(at.button, "Generate export").click()
    at.run(timeout=args.timeout_seconds)
    if at.exception:
        raise RuntimeError(f"Export AppTest run failed: {at.exception}")
    export = at.session_state["last_export"]
    if not isinstance(export, dict) or export.get("label") != "Static HTML":
        raise RuntimeError(f"Unexpected Streamlit export state: {export!r}")
    content = export.get("content")
    if not isinstance(content, bytes) or b'data-rune-static="true"' not in content:
        raise RuntimeError("Streamlit AppTest export did not produce valid static HTML")
    if content.count(b'data-schematex-version="1.0.1"') < 2 or content.count(b"<svg") < 2:
        raise RuntimeError("Streamlit export did not preserve both official SchemaTex diagrams")

    (output / "streamlit-preview.html").write_text(preview, encoding="utf-8")
    (output / "streamlit-export.html").write_bytes(content)
    manifest = {
        "schemaVersion": 1,
        "streamlitVersion": streamlit.__version__,
        "apiUrl": args.api_url.rstrip("/"),
        "app": str(APP.relative_to(ROOT)),
        "interactions": ["initial-load", "set-document-source", "update-preview", "generate-static-html"],
        "schemaTex": {"entityStructure": True, "orgchart": True},
        "previewBytes": len(preview.encode("utf-8")),
        "previewSha256": hashlib.sha256(preview.encode("utf-8")).hexdigest(),
        "exportBytes": len(content),
        "exportSha256": hashlib.sha256(content).hexdigest(),
        "renderId": export.get("render_id"),
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        f"STREAMLIT APPTEST PASSED: Streamlit {streamlit.__version__}; live preview and Static HTML export; "
        "SchemaTex entity-structure and orgchart"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
