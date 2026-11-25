from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[4]
SPEC = importlib.util.spec_from_file_location("verify_distributed_pipeline", ROOT / "scripts/verify_distributed_pipeline.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_source_fixture_covers_both_schematex_families_and_distributed_path() -> None:
    source = MODULE.source_fixture("0.10.0")
    assert 'entity-structure "RUNE Local Ownership"' in source
    assert "```orgchart" in source
    assert "StudioClient --> API --> NATS --> Worker" in source
    assert "distributed dispatch" in source


def test_all_declared_outputs_have_unique_evidence_names() -> None:
    assert set(MODULE.ASYNC_OUTPUTS) == {"staticHtml", "pdf", "pdfA", "png", "jpeg", "svg"}
    names = [item[0] for item in MODULE.ASYNC_OUTPUTS.values()]
    assert len(names) == len(set(names))


def test_snapshot_job_records_only_state_changes() -> None:
    jobs = [
        {"status": "queued", "progressPercent": 0, "progressStage": "queued", "attempt": 0, "maximumAttempts": 4},
        {"status": "queued", "progressPercent": 0, "progressStage": "queued", "attempt": 0, "maximumAttempts": 4},
        {"status": "processing", "progressPercent": 25, "progressStage": "browser", "attempt": 1, "maximumAttempts": 4},
    ]

    class Client:
        def get_status(self, render_id: str) -> dict:
            assert render_id == "render-id"
            return jobs.pop(0)

    history: list[dict] = []
    MODULE.snapshot_job(Client(), "render-id", history)
    MODULE.snapshot_job(Client(), "render-id", history)
    MODULE.snapshot_job(Client(), "render-id", history)
    assert [item["status"] for item in history] == ["queued", "processing"]


def test_ensure_alive_reports_log_tail(tmp_path: Path) -> None:
    log = tmp_path / "api.log"
    log.write_text("fatal startup error\n", encoding="utf-8")
    managed = SimpleNamespace(
        name="rune-api",
        process=SimpleNamespace(poll=lambda: 17),
        log_stream=SimpleNamespace(flush=lambda: None),
        log_path=log,
    )
    with pytest.raises(RuntimeError, match="fatal startup error"):
        MODULE.ensure_alive(managed)


def test_sha256_bytes_is_deterministic() -> None:
    assert MODULE.sha256_bytes(b"rune") == MODULE.sha256_bytes(b"rune")
    assert MODULE.sha256_bytes(b"rune") != MODULE.sha256_bytes(b"RUNE")
