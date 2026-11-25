from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_catalog(docs_root: Path) -> dict[str, Any]:
    catalog_path = (docs_root / "catalog" / "catalog.json").resolve()
    root = docs_root.resolve()
    if root not in catalog_path.parents:
        raise ValueError("Documentation catalog escapes the configured documentation root.")
    with catalog_path.open("r", encoding="utf-8") as stream:
        catalog = json.load(stream)
    if not isinstance(catalog, dict) or not isinstance(catalog.get("features"), list):
        raise ValueError("RUNE feature catalog has an invalid structure.")
    return catalog


def filter_features(catalog: dict[str, Any], query: str = "", category: str | None = None) -> list[dict[str, Any]]:
    normalized_query = query.strip().casefold()
    selected: list[dict[str, Any]] = []
    for raw in catalog.get("features", []):
        if not isinstance(raw, dict):
            continue
        feature = dict(raw)
        if category and category != "All" and feature.get("category") != category:
            continue
        haystack = " ".join(
            str(feature.get(field, ""))
            for field in ("id", "title", "category", "status", "summary")
        ).casefold()
        if normalized_query and normalized_query not in haystack:
            continue
        selected.append(feature)
    return sorted(selected, key=lambda item: (str(item.get("category", "")), str(item.get("title", ""))))


def read_feature_document(docs_root: Path, feature: dict[str, Any]) -> tuple[str, bytes, str]:
    relative = str(feature.get("documentation", "")).strip()
    if not relative:
        raise ValueError("Feature documentation path is missing.")
    root = docs_root.resolve()
    path = (root / relative).resolve()
    if root != path and root not in path.parents:
        raise ValueError("Feature documentation escapes the configured documentation root.")
    if not path.is_file():
        raise FileNotFoundError(path)
    content = path.read_bytes()
    return path.name, content, content.decode("utf-8")
