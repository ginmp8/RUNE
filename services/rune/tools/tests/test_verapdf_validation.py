from __future__ import annotations
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location("validate_verapdf",ROOT/"scripts/validate_verapdf.py")
module=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(module)


def test_summarizes_verapdf_validation_result_list()->None:
    payload={"jobs":[{"validationResult":[{"compliant":True,"profileName":"PDF/A-2B","details":{"passedRules":144,"failedRules":0,"passedChecks":40593,"failedChecks":0}}]}]}
    report=module.summarize_report(payload)
    assert report["compliant"] is True
    assert report["rulesPassed"]==144
    assert report["checksPassed"]==40593


def test_noncompliant_report_fails()->None:
    payload={"jobs":[{"validationResult":{"compliant":False,"profileName":"PDF/A-2B","details":{"failedRules":2,"failedChecks":4}}}]}
    report=module.summarize_report(payload)
    assert report["compliant"] is False
    assert report["rulesFailed"]==2


def test_missing_validation_is_not_compliant()->None:
    assert module.summarize_report({"jobs":[]})["compliant"] is False


def test_uses_builtin_flavour_not_custom_profile_path()->None:
    command=module.build_command(Path("/opt/verapdf"),Path("document.pdf"),"2b")
    assert command==["/opt/verapdf","--format","json","--flavour","2b","document.pdf"]
    assert "--profile" not in command
