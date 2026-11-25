from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[4]
SPEC = importlib.util.spec_from_file_location("verify_streamlit_apptest", ROOT / "scripts/verify_streamlit_apptest.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_exact_streamlit_runtime_is_pinned() -> None:
    assert MODULE.EXPECTED_STREAMLIT == "1.59.2"


def test_schematex_fixture_covers_entity_structure_and_orgchart() -> None:
    assert "```schematex" in MODULE.SCHEMATEX_SOURCE
    assert "entity-structure" in MODULE.SCHEMATEX_SOURCE
    assert "```orgchart" in MODULE.SCHEMATEX_SOURCE


def test_by_label_returns_unique_widget() -> None:
    controls = [SimpleNamespace(label="Export format"), SimpleNamespace(label="Theme")]
    assert MODULE.by_label(controls, "Export format") is controls[0]


def test_by_label_rejects_missing_or_duplicated_widget() -> None:
    with pytest.raises(LookupError):
        MODULE.by_label([], "Export format")
    with pytest.raises(LookupError):
        MODULE.by_label([SimpleNamespace(label="Source"), SimpleNamespace(label="Source")], "Source")
