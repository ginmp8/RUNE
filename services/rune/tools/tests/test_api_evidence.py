from __future__ import annotations
import importlib.util
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location("generate_api_evidence",ROOT/"scripts/generate_api_evidence.py")
module=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(module)

@pytest.mark.parametrize(("output","content","mime"),[
    ("staticHtml",b'<html data-rune-static="true"></html>',"text/html"),("pdf",b"%PDF-1.7", "application/pdf"),("pdfA",b"%PDF-1.7","application/pdf"),("png",b"\x89PNG\r\n\x1a\nrest","image/png"),("jpeg",b"\xff\xd8rest\xff\xd9","image/jpeg"),("svg",b"<svg></svg>","image/svg+xml")])
def test_validate_artifact_accepts_expected_signatures(output:str,content:bytes,mime:str)->None:
    module.validate_artifact(output,content,mime)

def test_validate_artifact_rejects_invalid_content()->None:
    with pytest.raises(ValueError): module.validate_artifact("pdf",b"not-pdf","text/plain")

def test_fixture_covers_all_interactive_renderers()->None:
    assert "```mermaid" in module.SOURCE and "```reactflow" in module.SOURCE and "$E = mc^2$" in module.SOURCE and '"schemaVersion":"1.0"' in module.SOURCE
