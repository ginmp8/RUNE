#!/usr/bin/env python3
from __future__ import annotations
import argparse,subprocess
from pathlib import Path

def main()->int:
    p=argparse.ArgumentParser(description="Create or verify detached Ed25519 artifact signatures with OpenSSL.")
    sub=p.add_subparsers(dest="command",required=True)
    sign=sub.add_parser("sign"); sign.add_argument("--artifact",type=Path,required=True); sign.add_argument("--private-key",type=Path,required=True); sign.add_argument("--signature",type=Path,required=True)
    verify=sub.add_parser("verify"); verify.add_argument("--artifact",type=Path,required=True); verify.add_argument("--public-key",type=Path,required=True); verify.add_argument("--signature",type=Path,required=True)
    a=p.parse_args()
    if a.command=="sign":
        a.signature.parent.mkdir(parents=True,exist_ok=True)
        subprocess.run(["openssl","pkeyutl","-sign","-rawin","-inkey",str(a.private_key),"-in",str(a.artifact),"-out",str(a.signature)],check=True)
        print(f"SIGNATURE CREATED: {a.signature}")
    else:
        subprocess.run(["openssl","pkeyutl","-verify","-rawin","-pubin","-inkey",str(a.public_key),"-in",str(a.artifact),"-sigfile",str(a.signature)],check=True,stdout=subprocess.DEVNULL)
        print(f"SIGNATURE VERIFIED: {a.artifact}")
    return 0
if __name__=="__main__": raise SystemExit(main())
