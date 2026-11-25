from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/"services/rune/tools/lib"))
from rune_supply_chain import generate_provenance, generate_sbom, scan_sbom, sha256_file, version_in_range


def test_sbom_contains_all_ecosystems() -> None:
    payload=generate_sbom(ROOT)
    purls={x["purl"].split(":",1)[1].split("/",1)[0] for x in payload["components"]}
    assert {"nuget","pypi","npm"}.issubset(purls)
    by_purl={item["purl"]:item for item in payload["components"]}
    schematex=by_purl["pkg:npm/schematex@1.0.1"]
    properties={item["name"]:item["value"] for item in schematex["properties"]}
    assert properties["rune:license"]=="AGPL-3.0-only"
    assert properties["rune:modified"]=="false"
    assert payload["specVersion"]=="1.6"

@pytest.mark.parametrize(("version","expression","expected"),[("1.0.0","[1.0.0,2.0.0)",True),("2.0.0","[1.0.0,2.0.0)",False),("1.5.0","(,1.5.0]",True),("1.5.1","(,1.5.0]",False)])
def test_nuget_ranges(version:str,expression:str,expected:bool)->None:
    assert version_in_range(version,expression) is expected


def test_scan_fails_closed_and_matches_advisories(tmp_path:Path)->None:
    sbom={"components":[{"name":"Example","version":"1.2.0","purl":"pkg:nuget/Example@1.2.0"}]}
    blocked=scan_sbom(sbom,{"coverage":"unavailable","advisories":[]},database_digest="a"*64)
    assert blocked["status"]=="blocked-incomplete-advisory-database"
    complete={"coverage":"complete","advisories":[{"id":"ADV-1","package":"Example","versions":"[1.0.0,2.0.0)","severity":"high","url":"https://example.test/ADV-1"}]}
    report=scan_sbom(sbom,complete,database_digest="b"*64)
    assert report["summary"]["high"]==1


def test_provenance_and_signature_reject_tampering(tmp_path:Path)->None:
    artifact=tmp_path/"artifact.bin"; artifact.write_bytes(b"rune")
    payload=generate_provenance([artifact],version="0.9.0",builder_id="test",invocation={"offline":True},materials=[])
    assert payload["subject"][0]["digest"]["sha256"]==sha256_file(artifact)
    private=tmp_path/"private.pem"; public=tmp_path/"public.pem"; signature=tmp_path/"artifact.sig"
    subprocess.run(["openssl","genpkey","-algorithm","ED25519","-out",str(private)],check=True)
    subprocess.run(["openssl","pkey","-in",str(private),"-pubout","-out",str(public)],check=True)
    subprocess.run([sys.executable,str(ROOT/"scripts/sign_artifact.py"),"sign","--artifact",str(artifact),"--private-key",str(private),"--signature",str(signature)],check=True)
    subprocess.run([sys.executable,str(ROOT/"scripts/sign_artifact.py"),"verify","--artifact",str(artifact),"--public-key",str(public),"--signature",str(signature)],check=True)
    artifact.write_bytes(b"tampered")
    failed=subprocess.run([sys.executable,str(ROOT/"scripts/sign_artifact.py"),"verify","--artifact",str(artifact),"--public-key",str(public),"--signature",str(signature)])
    assert failed.returncode!=0
