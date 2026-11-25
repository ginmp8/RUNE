#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,platform,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"services/rune/tools/lib"))
from rune_supply_chain import generate_provenance,sha256_file  # noqa: E402

def main()->int:
    p=argparse.ArgumentParser(description="Generate an in-toto SLSA v1 provenance statement.")
    p.add_argument("--subject",type=Path,action="append",required=True); p.add_argument("--material",type=Path,action="append",default=[]); p.add_argument("--output",type=Path,required=True); p.add_argument("--builder-id",default="https://rune.local/builders/offline-sandbox/v1")
    a=p.parse_args(); version=(ROOT/"VERSION").read_text().strip(); materials=[{"uri":x.name,"digest":{"sha256":sha256_file(x)}} for x in a.material]
    payload=generate_provenance(a.subject,version=version,builder_id=a.builder_id,invocation={"configuration":"Release","platform":platform.platform(),"offline":True},materials=materials)
    a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(payload,indent=2,sort_keys=True)+"\n")
    print(f"PROVENANCE PASSED: {len(a.subject)} subjects -> {a.output}"); return 0
if __name__=="__main__": raise SystemExit(main())
