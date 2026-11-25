#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/rune/tools/lib"))
from rune_supply_chain import generate_sbom  # noqa: E402

def main() -> int:
    parser=argparse.ArgumentParser(description="Generate a deterministic CycloneDX SBOM for RUNE.")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, required=True)
    args=parser.parse_args()
    payload=generate_sbom(args.root.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(f"SBOM PASSED: {len(payload['components'])} components -> {args.output}")
    return 0
if __name__ == "__main__": raise SystemExit(main())
