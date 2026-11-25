from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any


def conversion_artifact_names(report: dict[str, Any]) -> list[str]:
    """Return safe, stable, deduplicated artifact names from a conversion report."""
    result: list[str] = []
    seen: set[str] = set()
    for item in report.get("extractedArtifacts") or []:
        if not isinstance(item, dict):
            continue
        raw = item.get("name")
        if not isinstance(raw, str) or not raw.strip():
            continue
        name = PurePosixPath(raw.strip()).name
        if name in {"", ".", ".."} or name in seen:
            continue
        seen.add(name)
        result.append(name)
    return result
