#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"services/rune/tools/lib"))
from rune_supply_chain import SEVERITY_ORDER, scan_sbom, sha256_file  # noqa: E402

def main() -> int:
    parser=argparse.ArgumentParser(description="Scan a CycloneDX SBOM against a pinned offline advisory database.")
    parser.add_argument("--sbom",type=Path,required=True); parser.add_argument("--database",type=Path,required=True); parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--fail-on",choices=["none","low","medium","high","critical"],default="high")
    args=parser.parse_args()
    report=scan_sbom(json.loads(args.sbom.read_text()),json.loads(args.database.read_text()),database_digest=sha256_file(args.database))
    args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    if report["status"].startswith("blocked"):
        print("VULNERABILITY SCAN BLOCKED: advisory database coverage is not complete")
        return 2
    threshold=4 if args.fail_on=="none" else SEVERITY_ORDER[args.fail_on]
    highest=max((SEVERITY_ORDER.get(x["severity"],1) for x in report["findings"]),default=-1)
    print(f"VULNERABILITY SCAN PASSED: {report['componentsScanned']} components, {len(report['findings'])} findings")
    return 1 if highest>=threshold else 0
if __name__ == "__main__": raise SystemExit(main())
