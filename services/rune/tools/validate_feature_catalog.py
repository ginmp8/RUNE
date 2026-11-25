#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / "services/rune/docs/catalog/catalog.json"
errors: list[str] = []
try:
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
except Exception as error:
    print(f"FEATURE CATALOG FAILED: {error}")
    raise SystemExit(1)
features = payload.get("features", [])
ids: set[str] = set()
for feature in features:
    identifier = feature.get("id", "")
    if not identifier or identifier in ids: errors.append(f"invalid or duplicate feature id: {identifier!r}")
    ids.add(identifier)
    if feature.get("status") not in {"implemented", "partial", "deprecated"}: errors.append(f"{identifier}: invalid status")
    for field in ("title", "category", "summary", "documentation"):
        if not feature.get(field): errors.append(f"{identifier}: missing {field}")
    doc = ROOT / "services/rune/docs" / feature.get("documentation", "")
    if not doc.is_file(): errors.append(f"{identifier}: missing documentation {doc.relative_to(ROOT)}")
    for field in ("implementation", "tests"):
        values = feature.get(field) or []
        if not values: errors.append(f"{identifier}: missing {field} ownership")
        for value in values:
            if not (ROOT / value).is_file(): errors.append(f"{identifier}: missing {field} file {value}")
reference_cases = json.loads((ROOT / "services/rune/tests/compatibility/reference-feature-cases.json").read_text(encoding="utf-8"))
case_ids = {item["id"] for item in reference_cases}
for feature in features:
    case = feature.get("referenceCase")
    if case and case not in case_ids: errors.append(f"{feature['id']}: unknown reference case {case}")
for case in sorted(case_ids):
    if not any(item.get("referenceCase") == case for item in features): errors.append(f"reference case has no catalog feature: {case}")
if errors:
    print("FEATURE CATALOG FAILED")
    for error in errors: print(f"- {error}")
    sys.exit(1)
print(f"FEATURE CATALOG PASSED ({len(features)} features, {len(case_ids)} compatibility cases)")
