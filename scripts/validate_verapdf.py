#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,subprocess,tempfile
from pathlib import Path
from typing import Any


def _objects(value: Any):
    if isinstance(value,dict):
        yield value
        for child in value.values(): yield from _objects(child)
    elif isinstance(value,list):
        for child in value: yield from _objects(child)


def summarize_report(payload:dict[str,Any])->dict[str,Any]:
    validations=[]
    for obj in _objects(payload):
        value=obj.get("validationResult") if isinstance(obj,dict) else None
        if isinstance(value,list): validations.extend(x for x in value if isinstance(x,dict))
        elif isinstance(value,dict): validations.append(value)
    if not validations:
        validations=[obj for obj in _objects(payload) if isinstance(obj,dict) and ("compliant" in obj or "isCompliant" in obj) and ("details" in obj or "profileName" in obj)]
    compliant=all(bool(v.get("compliant",v.get("isCompliant",False))) for v in validations) if validations else False
    rule_passed=rule_failed=check_passed=check_failed=0
    profile=None
    for v in validations:
        profile=profile or v.get("profileName") or v.get("profile") or v.get("flavour")
        details=v.get("details") or {}
        rule_passed += int(details.get("passedRules",details.get("rulePassedCount",0)) or 0)
        rule_failed += int(details.get("failedRules",details.get("ruleFailedCount",0)) or 0)
        check_passed += int(details.get("passedChecks",details.get("checkPassedCount",0)) or 0)
        check_failed += int(details.get("failedChecks",details.get("checkFailedCount",0)) or 0)
    return {"schemaVersion":1,"compliant":compliant,"profile":profile,"documents":len(validations),"rulesPassed":rule_passed,"rulesFailed":rule_failed,"checksPassed":check_passed,"checksFailed":check_failed,"raw":payload}


def build_command(verapdf: Path, input_file: Path, flavour: str)->list[str]:
    return [str(verapdf), "--format", "json", "--flavour", flavour, str(input_file)]


def main()->int:
    p=argparse.ArgumentParser(description="Validate a RUNE-generated PDF/A artifact with external veraPDF.")
    p.add_argument("--verapdf",type=Path,required=True); p.add_argument("--input",type=Path,required=True); p.add_argument("--profile",default="2b"); p.add_argument("--output",type=Path,required=True); p.add_argument("--raw-output",type=Path)
    a=p.parse_args(); raw=a.raw_output or a.output.with_name(a.output.stem+"-raw.json")
    command=build_command(a.verapdf,a.input,a.profile)
    result=subprocess.run(command,capture_output=True,text=True,check=False)
    raw.parent.mkdir(parents=True,exist_ok=True); raw.write_text(result.stdout,encoding="utf-8")
    if result.returncode not in {0,1}: raise SystemExit(result.stderr.strip() or f"veraPDF exited {result.returncode}")
    payload=json.loads(result.stdout); report=summarize_report(payload); report["validator"]={"name":"veraPDF","command":command,"exitCode":result.returncode}
    a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    if not report["compliant"]:
        print(f"VERAPDF FAILED: {a.input}"); return 1
    print(f"VERAPDF PASSED: {a.input} ({report['profile'] or a.profile})"); return 0
if __name__=="__main__": raise SystemExit(main())
