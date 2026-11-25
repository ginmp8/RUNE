from __future__ import annotations

import json
from pathlib import Path

import pytest

from rune_studio.documentation import filter_features, load_catalog, read_feature_document


def make_docs(tmp_path: Path) -> Path:
    catalog = tmp_path / "catalog"
    catalog.mkdir()
    (catalog / "one.md").write_text("# One\n", encoding="utf-8")
    (catalog / "catalog.json").write_text(
        json.dumps(
            {
                "version": "0.6.0",
                "features": [
                    {
                        "id": "one",
                        "title": "One Feature",
                        "category": "Markdown",
                        "status": "implemented",
                        "summary": "First capability",
                        "documentation": "catalog/one.md",
                    },
                    {
                        "id": "two",
                        "title": "Two Feature",
                        "category": "Jobs",
                        "status": "implemented",
                        "summary": "Second capability",
                        "documentation": "catalog/two.md",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    return tmp_path


def test_catalog_load_filter_and_read(tmp_path: Path) -> None:
    docs = make_docs(tmp_path)
    catalog = load_catalog(docs)
    matches = filter_features(catalog, query="first", category="Markdown")
    assert [item["id"] for item in matches] == ["one"]
    name, content, text = read_feature_document(docs, matches[0])
    assert name == "one.md"
    assert content == b"# One\n"
    assert text.startswith("# One")


def test_document_path_cannot_escape_docs_root(tmp_path: Path) -> None:
    docs = make_docs(tmp_path)
    with pytest.raises(ValueError):
        read_feature_document(docs, {"documentation": "../outside.md"})


def test_complex_reactflow_examples_are_exposed() -> None:
    source = (Path(__file__).resolve().parents[1] / "app.py").read_text(encoding="utf-8")
    for filename in (
        "enterprise-event-driven-platform.md",
        "fraud-decision-orchestration.md",
        "multi-region-resilience.md",
    ):
        assert filename in source
    assert '"Example"' in source
    assert '"Load example"' in source
