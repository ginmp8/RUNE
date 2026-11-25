#!/usr/bin/env python3
import argparse, hashlib, json, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont

def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest().upper()

def load(path):
    return TTFont(path, recalcBBoxes=False, recalcTimestamp=False, lazy=False)

def metadata(font):
    cmap=font.getBestCmap() or {}
    return {
        'supported': True,
        'mappedCodePoints': len(cmap),
        'codePoints': sorted(cmap.keys()),
        'glyphCount': len(font.getGlyphOrder()),
        'tables': sorted(font.keys()),
    }

def save_sanitized(font, output, flavor):
    font.flavor = None if flavor in ('ttf','otf','sfnt') else flavor
    font.recalcTimestamp = False
    font.save(output, reorderTables=True)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('command', choices=['inspect','sanitize','subset'])
    p.add_argument('--input', required=True)
    p.add_argument('--output')
    p.add_argument('--flavor', default='ttf', choices=['ttf','otf','sfnt','woff','woff2'])
    p.add_argument('--unicodes', default='')
    a=p.parse_args()
    font=load(a.input)
    result=metadata(font)
    result['inputSha256']=sha256(a.input)
    if a.command=='sanitize':
        if not a.output: p.error('--output is required')
        save_sanitized(font,a.output,a.flavor)
        result['outputSha256']=sha256(a.output); result['outputBytes']=os.path.getsize(a.output)
    elif a.command=='subset':
        if not a.output: p.error('--output is required')
        unicodes=[int(v,16) for v in a.unicodes.split(',') if v]
        opts=subset.Options()
        opts.flavor=None if a.flavor in ('ttf','otf','sfnt') else a.flavor
        opts.recalc_timestamp=False
        opts.canonical_order=True
        opts.layout_features='*'
        opts.name_IDs=['*']; opts.name_legacy=True; opts.name_languages=['*']
        subsetter=subset.Subsetter(options=opts); subsetter.populate(unicodes=unicodes); subsetter.subset(font)
        font.save(a.output, reorderTables=True)
        result['outputSha256']=sha256(a.output); result['outputBytes']=os.path.getsize(a.output)
        result['subsetCodePoints']=unicodes
    print(json.dumps(result,separators=(',',':')))

if __name__=='__main__':
    try: main()
    except Exception as exc:
        print(json.dumps({'supported':False,'error':str(exc)}), file=sys.stderr)
        raise
