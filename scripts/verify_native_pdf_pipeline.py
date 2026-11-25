#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, json, os, signal, subprocess, sys, time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
SCRIPT_DIR=ROOT/'scripts'
if str(SCRIPT_DIR) not in sys.path: sys.path.insert(0,str(SCRIPT_DIR))
from verify_distributed_pipeline import start_process, wait_http, ensure_alive, free_port, ManagedProcess  # noqa:E402
from generate_api_evidence import validate_artifact  # noqa:E402

def request(base:str,path:str,payload:dict[str,Any]|None=None,timeout:int=240)->tuple[int,bytes,str]:
    data=None if payload is None else json.dumps(payload).encode()
    req=Request(base.rstrip('/')+path,data=data,method='GET' if payload is None else 'POST',headers={'Content-Type':'application/json'})
    try:
        with urlopen(req,timeout=timeout) as r: return r.status,r.read(),r.headers.get('Content-Type','application/octet-stream')
    except HTTPError as e: return e.code,e.read(),e.headers.get('Content-Type','application/octet-stream')

def wait_job(base:str,rid:str,timeout:int)->dict[str,Any]:
    deadline=time.monotonic()+timeout; history=[]
    while time.monotonic()<deadline:
        status,body,_=request(base,f'/v1/renders/{rid}',timeout=15)
        if status!=200: raise RuntimeError(body.decode(errors='replace'))
        payload=json.loads(body); job=payload.get('job',payload); state=str(job.get('status','')).lower()
        snap={k:job.get(k) for k in ('status','attempt','progressPercent','progressStage','leaseToken')}
        if not history or history[-1]!=snap: history.append(snap)
        if state=='completed': job['_history']=history; return job
        if state in {'failed','cancelled'}: raise RuntimeError(json.dumps(job,indent=2))
        time.sleep(.25)
    raise TimeoutError(f'{rid}: {history}')

def stop(p:ManagedProcess)->dict[str,Any]:
    if p.process.poll() is None:
        try: os.killpg(p.process.pid,signal.SIGTERM); code=p.process.wait(timeout=15); graceful=True
        except Exception:
            try: os.killpg(p.process.pid,signal.SIGKILL)
            except Exception: pass
            try: code=p.process.wait(timeout=5)
            except Exception: code=None
            graceful=False
    else: code=p.process.returncode; graceful=True
    try: p.log_stream.close()
    except Exception: pass
    return {'name':p.name,'exitCode':code,'graceful':graceful}

def main()->int:
    ap=argparse.ArgumentParser(); ap.add_argument('--output',type=Path,required=True); ap.add_argument('--dotnet',type=Path,required=True); ap.add_argument('--chromium',type=Path,default=Path('/usr/bin/chromium')); ap.add_argument('--timeout-seconds',type=int,default=180); a=ap.parse_args()
    out=a.output.resolve(); out.mkdir(parents=True,exist_ok=True); logs=out/'logs'; logs.mkdir(exist_ok=True); data=out/'data'; data.mkdir(exist_ok=True); cache=out/'cache'; cache.mkdir(exist_ok=True); tmp=out/'tmp'; tmp.mkdir(exist_ok=True)
    version=(ROOT/'VERSION').read_text().strip(); api_dll=ROOT/'services/rune/apps/rune-api/bin/Release/net10.0/Rune.Api.dll'; fixture=ROOT/'services/rune/tests/fixtures/pdf-native/reportlab-subset-vectors-links.pdf'
    port=free_port(); base=f'http://127.0.0.1:{port}'
    env=os.environ.copy(); env.update({'DOTNET_ROOT':str(a.dotnet.parent),'DOTNET_MULTILEVEL_LOOKUP':'0','DOTNET_CLI_TELEMETRY_OPTOUT':'1','RUNE_DATA_ROOT':str(data),'RUNE_RENDER_CACHE_ROOT':str(cache),'TMPDIR':str(tmp),'RUNE_CHROMIUM_EXECUTABLE_PATH':str(a.chromium.resolve()),'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH':str(a.chromium.resolve()),'ASPNETCORE_URLS':base,'RUNE_DISPATCH_PROVIDER':'local','RUNE_BROWSER_CONCURRENCY':'1'}); env.pop('PLATFORM',None); env.pop('Platform',None)
    active=[]; manifest={'schemaVersion':1,'version':version,'runtime':'api-local-dispatcher-real-chromium-native-composer','artifacts':[],'checks':{}}
    try:
        api=start_process('rune-api-native',[str(a.dotnet.resolve()),str(api_dll.resolve())],log_dir=logs,env=env,cwd=api_dll.parent); active.append(api); wait_http(base+'/health'); ensure_alive(api)
        source_pdf=fixture.read_bytes(); encoded=base64.b64encode(source_pdf).decode()
        common={'sourceType':'composite','documentName':'native-pdf-composite.md','resources':[{'path':'appendix.pdf','contentBase64':encoded,'contentType':'application/pdf'}],'composite':{'includePartTitles':True,'pageBreakBetweenParts':True,'rewriteTableOfContents':True,'parts':[{'name':'Generated introduction','sourceType':'markdown','content':'# Generated introduction\n\nRUNE 0.17.0 native page pipeline evidence.'},{'name':'Native appendix','sourceType':'pdf','resourcePath':'appendix.pdf','pdfImport':{'mode':'native-page','signatures':'reject','forms':'flatten','annotations':{'links':'preserve','comments':'remove','attachments':'reject'},'javascript':'remove','fallback':'reject'}}]},'options':{'pageSize':'A4','includeToc':True,'tagged':True,'outline':True,'timeoutSeconds':180,'pdfAConformance':'2b'}}
        for fmt,name in [('pdf','native-composite.pdf'),('pdfA','native-composite-pdfa.pdf')]:
            status,body,_=request(base,'/v1/render',{**common,'outputFormat':fmt,'idempotencyKey':f'rune-{version}-native-{fmt}'},timeout=30)
            if status!=202: raise RuntimeError(f'{fmt} rejected {status}: {body.decode(errors="replace")}')
            rid=json.loads(body)['renderId']; job=wait_job(base,rid,a.timeout_seconds)
            status,content,ctype=request(base,f'/v1/renders/{rid}/content',timeout=60); validate_artifact('pdfA' if fmt=='pdfA' else 'pdf',content,ctype); path=out/name; path.write_bytes(content)
            status,mbytes,_=request(base,f'/v1/renders/{rid}/artifacts/pdf-import-manifest.json',timeout=30)
            if status!=200: raise RuntimeError(f'manifest missing for {fmt}: {status}')
            mpath=out/name.replace('.pdf','-pdf-import-manifest.json'); mpath.write_bytes(mbytes); plan=json.loads(mbytes)
            imports=plan.get('imports',[]); applied={str(item.get('appliedMode','')).lower() for item in imports}; pages=[page for item in imports for page in item.get('pages',[])];
            if 'native-page' not in applied: raise RuntimeError(f'{fmt} did not apply native-page: {applied}')
            text=subprocess.run(['pdftotext',str(path),'-'],check=True,stdout=subprocess.PIPE).stdout.decode(errors='replace')
            if 'Generated introduction' not in text or 'Selectable subset-font text' not in text: raise RuntimeError(f'{fmt} text preservation failed')
            fonts=subprocess.run(['pdffonts',str(path)],check=True,stdout=subprocess.PIPE).stdout.decode(errors='replace'); (out/name.replace('.pdf','-pdffonts.txt')).write_text(fonts)
            urls=subprocess.run(['pdfinfo','-url',str(path)],check=False,stdout=subprocess.PIPE,stderr=subprocess.STDOUT).stdout.decode(errors='replace'); (out/name.replace('.pdf','-urls.txt')).write_text(urls)
            info=subprocess.run(['pdfinfo',str(path)],check=True,stdout=subprocess.PIPE).stdout.decode(errors='replace'); (out/name.replace('.pdf','-pdfinfo.txt')).write_text(info)
            manifest['artifacts'].append({'output':fmt,'renderId':rid,'name':name,'size':len(content),'sha256':hashlib.sha256(content).hexdigest(),'contentType':ctype,'history':job.get('_history')})
            manifest['checks'][fmt]={'nativePageApplied':True,'sourceTextPreserved':True,'generatedTextPresent':True,'fontsInspected':True,'linksInspected':True,'manifest':mpath.name,'pageCount':len(pages)}
        manifest['checks']['shutdown']=stop(api); active.clear(); manifest['completedAtUtc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()); (out/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
        print(f'NATIVE PDF PIPELINE PASSED: RUNE {version}; PDF and PDF/A; real Chromium; native page replacement',flush=True); return 0
    finally:
        for p in reversed(active): stop(p)
if __name__=='__main__': raise SystemExit(main())
