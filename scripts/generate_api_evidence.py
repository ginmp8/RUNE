#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SOURCE_TEMPLATE = '''---
title: RUNE {version} SchemaTex API Evidence
subtitle: Complete public API output validation
toc: true
include-cover: true
organization: RUNE
version: {version}
---
# Full API evidence

> [!NOTE]
> Generated through the public RUNE API with the local dispatcher.

## Compatibility matrix

| Capability | Evidence |
|---|---:|
| Markdown | Yes |
| Mermaid | Yes |
| KaTeX | Yes |
| React Flow | Yes |
| SchemaTex entity structure | Yes |

Inline math: $E = mc^2$.

```mermaid
flowchart LR
  Markdown --> API --> LocalDispatcher --> Chromium
  Chromium --> PDF
  Chromium --> PNG
  Chromium --> JPEG
  Chromium --> SVG
```

```reactflow
{"schemaVersion":"1.0","title":"RUNE evidence","nodes":[{"id":"a","position":{"x":20,"y":20},"data":{"label":"API"},"type":"input"},{"id":"b","position":{"x":300,"y":20},"data":{"label":"Artifacts"},"type":"output"}],"edges":[{"id":"e1","source":"a","target":"b","label":"local dispatch"}]}
```


```schematex
entity-structure "RUNE Local Ownership"
jurisdiction BR "Brazil"
jurisdiction US "United States"
entity founder "Founder" individual@BR [role: "Controller"]
entity trust "Founder Trust" trust@US
entity holding "RUNE Holdings S.A." corp@BR
entity platform "RUNE Platform Ltda." llc@BR
entity renderer "RUNE Renderer Fund" fund@US
entity documents "RUNE Documents Ltda." llc@BR
founder -> trust : 100%
trust -> holding : 100%
holding -> platform : 80% [class: "ON"]
holding -> renderer : 60% [class: "Series A"]
platform -> documents : 100%
```

## SchemaTex organization chart

```orgchart
ceo: "RUNE Director" | "CEO"
  platform: "Platform Lead" | "Engineering"
  documents: "Document Lead" | "Rendering"
```

'''
SOURCE = SOURCE_TEMPLATE

TERMINAL={"completed","failed","cancelled"}


def request(base_url:str,path:str,payload:dict|None=None,timeout:int=60)->tuple[int,dict[str,str],bytes]:
    data=None if payload is None else json.dumps(payload).encode()
    req=Request(base_url.rstrip("/")+path,data=data,headers={"Content-Type":"application/json"})
    try:
        with urlopen(req,timeout=timeout) as response:
            return response.status,dict(response.headers),response.read()
    except HTTPError as error:
        return error.code,dict(error.headers),error.read()


def wait_job(base_url:str,render_id:str,seconds:int=240)->dict:
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        status,_,body=request(base_url,f"/v1/renders/{render_id}")
        if status!=200: raise RuntimeError(body.decode(errors="replace"))
        payload=json.loads(body); job=payload.get("job",payload); state=str(job["status"]).lower()
        if state in TERMINAL:
            if state!="completed": raise RuntimeError(json.dumps(job))
            return job
        time.sleep(.25)
    raise TimeoutError(render_id)


def validate_artifact(output:str,content:bytes,content_type:str)->None:
    checks={
        "staticHtml": lambda: b"data-rune-static=\"true\"" in content,
        "pdf": lambda: content.startswith(b"%PDF"),
        "pdfA": lambda: content.startswith(b"%PDF"),
        "png": lambda: content.startswith(b"\x89PNG\r\n\x1a\n"),
        "jpeg": lambda: content.startswith(b"\xff\xd8") and content.endswith(b"\xff\xd9"),
        "svg": lambda: b"<svg" in content[:1000].lower(),
    }
    if output not in checks or not checks[output](): raise ValueError(f"invalid {output} artifact ({len(content)} bytes, {content_type})")


def main()->int:
    p=argparse.ArgumentParser(description="Generate complete RUNE public API evidence.")
    p.add_argument("--base-url",default="http://127.0.0.1:5080"); p.add_argument("--output",type=Path,required=True)
    a=p.parse_args(); out=a.output; out.mkdir(parents=True,exist_ok=True)
    version=(Path(__file__).resolve().parents[1]/"VERSION").read_text(encoding="utf-8").strip()
    source=SOURCE_TEMPLATE.replace("{version}", version)
    manifest={"schemaVersion":1,"version":version,"dispatcher":None,"artifacts":[]}
    for path,name in [("/","root.json"),("/health","health.json"),("/v1/features","features.json")]:
        status,_,body=request(a.base_url,path); assert status==200,(path,status,body); (out/name).write_bytes(body)
    features=json.loads((out/"features.json").read_text()); manifest["dispatcher"]=features.get("dispatchProvider") or features.get("dispatching",{}).get("selected")
    if manifest["dispatcher"]!="local": raise RuntimeError(f"expected default local dispatcher, got {manifest['dispatcher']}")

    common={"sourceType":"markdown","content":source,"htmlTrustMode":"safe","documentName":"rune-api-evidence.md","options":{"theme":"professional","pageSize":"A4","includeCover":True,"includeToc":True,"timeoutSeconds":120,"pdfAConformance":"2b"}}
    status,_,body=request(a.base_url,"/v1/render",{**common,"outputFormat":"interactiveHtml"}); assert status==200,(status,body)
    response=json.loads(body); (out/"interactive-response.json").write_bytes(body); (out/"interactive.html").write_text(response["html"],encoding="utf-8")
    if "__RUNE_RENDER_DONE__" not in response["html"]: raise RuntimeError("interactive readiness marker missing")
    if "__RUNE_SCHEMATEX_MODULE_BASE64__" not in response["html"]: raise RuntimeError("SchemaTex module was not embedded")
    status,_,body=request(a.base_url,"/v1/render",{**common,"outputFormat":"structuredJson"}); assert status==200,(status,body)
    (out/"structured.json").write_bytes(body)
    if b"schematex" not in body.lower(): raise RuntimeError("structured JSON did not preserve SchemaTex capability")

    names={"staticHtml":"rune-api-evidence.html","pdf":"rune-api-evidence.pdf","pdfA":"rune-api-evidence-pdfa.pdf","png":"rune-api-evidence.png","jpeg":"rune-api-evidence.jpg","svg":"rune-api-evidence.svg"}
    source_hash=hashlib.sha256(source.encode()).hexdigest()
    for output,name in names.items():
        payload={**common,"outputFormat":output,"idempotencyKey":f"rune-{version.replace(chr(46), chr(45))}-schematex-evidence-{output.lower()}-{source_hash[:16]}"}
        status,_,body=request(a.base_url,"/v1/render",payload); assert status==202,(output,status,body)
        render_id=json.loads(body)["renderId"]; wait_job(a.base_url,render_id)
        status,headers,content=request(a.base_url,f"/v1/renders/{render_id}/content",timeout=120); assert status==200,(output,status,content[:200])
        content_type=headers.get("Content-Type",headers.get("content-type","")); validate_artifact(output,content,content_type); (out/name).write_bytes(content)
        manifest["artifacts"].append({"output":output,"name":name,"renderId":render_id,"contentType":content_type,"size":len(content),"sha256":hashlib.sha256(content).hexdigest()})
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2,sort_keys=True)+"\n")
    print(f"API EVIDENCE PASSED: {version}; 8 public API formats including interactive HTML and structured JSON"); return 0
if __name__=="__main__": raise SystemExit(main())
