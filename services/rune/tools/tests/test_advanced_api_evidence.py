from __future__ import annotations
import base64
import importlib.util
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[4]
spec = importlib.util.spec_from_file_location("generate_advanced_api_evidence", ROOT / "scripts/generate_advanced_api_evidence.py")
module = importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(module)


def test_embedded_woff2_extraction() -> None:
    font = b"wOF2test-font-bytes"
    html = b"<style>@font-face{src:url(data:font/woff2;base64," + base64.b64encode(font) + b") format('woff2')}</style>"
    assert module.extract_embedded_font(html) == font


def test_embedded_font_extraction_fails_closed() -> None:
    with pytest.raises(RuntimeError):
        module.extract_embedded_font(b"<html></html>")


def test_comparison_fixture_is_multipage_and_structural() -> None:
    html = module.two_page_html("changed")
    assert "break-before:page" in html
    assert "Comparison/First" in html and "Comparison/Second" in html
