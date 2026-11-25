from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "assets" / "vendor" / "schematex" / "package" / "dist" / "browser.js"
SOURCE = ROOT / "assets" / "vendor" / "schematex" / "SOURCE.json"
CHECKSUMS = ROOT / "assets" / "vendor" / "schematex" / "SHA256SUMS"


def test_schematex_official_package_is_bundled_with_provenance() -> None:
    assert MODULE.is_file()
    assert MODULE.stat().st_size > 100
    assert CHECKSUMS.is_file()
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert source["version"] == "1.0.1"
    assert source["license"] == "AGPL-3.0-only"
    assert source["network"] == "disabled"
    assert source["runtime"].startswith("official")
    package = json.loads((MODULE.parents[1] / "package.json").read_text(encoding="utf-8"))
    assert package["name"] == "schematex"
    assert package["version"] == "1.0.1"


def test_schematex_official_runtime_renders_entity_structure() -> None:
    script = f"""
import * as schema from {json.dumps(MODULE.as_uri())};
const source = `entity-structure "Acme"
entity parent "Parent" corp@BR
entity child "Child" llc@BR
parent -> child : 100%`;
const result = schema.renderResult(source);
if (!result.ok) throw new Error(JSON.stringify(result));
if (!result.svg.includes('class="lt-entity"')) throw new Error('missing entity diagram marker');
if (!result.svg.includes('100%')) throw new Error('missing ownership label');
console.log(JSON.stringify({{version:"1.0.1",size:result.svg.length}}));
"""
    completed = subprocess.run(["node", "--input-type=module", "-e", script], check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    assert payload["version"] == "1.0.1"
    assert payload["size"] > 1_000


def test_individual_ownership_label_does_not_overlap_role() -> None:
    script = f"""
import * as schema from {json.dumps(MODULE.as_uri())};
const source = `entity-structure "Acme"
entity founder "Founder" individual@BR [role: "Controller"]
entity trust "Founder Trust" trust@US
founder -> trust : 100%`;
const result = schema.renderResult(source);
if (!result.ok) throw new Error(JSON.stringify(result));
const role = result.svg.match(/<text[^>]*y="([0-9.]+)"[^>]*class="lt-entity-role"[^>]*>Controller<[/]text>/);
const ownership = result.svg.match(/<text[^>]*y="([0-9.]+)"[^>]*class="lt-entity-label"[^>]*>100%<[/]text>/);
if (!role || !ownership) throw new Error('missing expected labels');
console.log(JSON.stringify({{roleY:Number(role[1]),ownershipY:Number(ownership[1])}}));
"""
    completed = subprocess.run(["node", "--input-type=module", "-e", script], check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    assert payload["ownershipY"] - payload["roleY"] >= 25
