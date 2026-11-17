import json, sys, time
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))
import redraw
ROOT=redraw.ROOT
cur=json.load(open(f'{ROOT}/data/catalog/drawings.curated.json'))['drawings']
out={}
for r in cur:
    if r['kind']!='vector': 
        print('SKIP raster',r['id']); continue
    t=time.time()
    svg,st=redraw.convert(f'{ROOT}/data/raw/pdf/{r["pdf"]}', r['page'], r['bbox'])
    open(f'svg/{r["id"]}.svg','w').write(svg)
    out[r['id']]=dict(st, kb=len(svg)//1024)
    print(r['id'], st, len(svg)//1024,'KB', round(time.time()-t,1),'s', flush=True)
json.dump(out,open('stats.json','w'),indent=1)
