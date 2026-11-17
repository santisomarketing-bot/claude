import json, re, os
ROOT=str(__import__('pathlib').Path(__file__).resolve().parents[3])
SP=str(__import__('pathlib').Path.cwd())
cur=json.load(open(f'{ROOT}/data/catalog/drawings.curated.json'))['drawings']
dj={i['id']:i for i in json.load(open(f'{ROOT}/data/catalog/drawings.json'))['items']}
prods={p['id']:p for p in json.load(open(f'{ROOT}/data/catalog/products.json'))}
from PIL import Image
out=[]
for n,r in enumerate(cur,1):
    x0,y0,x1,y1=r['bbox']; bw,bh=x1-x0,y1-y0
    it=dj[r['id']]
    padw,padh=(bw+5,bh+5) if r['kind']=='vector' else (bw,bh)
    oldw=it['w']/ (it['w']/padw); 
    ppp_w=it['w']/padw; ppp_h=it['h']/padh
    ppp=ppp_w   # el alto actual puede ser menor: el proceso antiguo colapsa filas en blanco
    old_pt=[it['w']/ppp, it['h']/ppp]
    new={}
    if r['kind']=='vector':
        svg=open(f'{SP}/svg/{r["id"]}.svg').read()
        m=re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',svg)
        new={'type':'svg','file':f'{SP}/svg/{r["id"]}.svg','pt':[float(m.group(1)),float(m.group(2))]}
    elif r['id']=='cuba-de-aceite':
        svg=open(f'{SP}/svg/{r["id"]}.svg').read()
        m=re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',svg)
        new={'type':'svg','file':f'{SP}/svg/{r["id"]}.svg','pt':[float(m.group(1))/ppp_w, float(m.group(2))/ppp_w]}
    else:
        im=Image.open(f'{SP}/png/{r["id"]}.png')
        new={'type':'png','file':f'{SP}/png/{r["id"]}.png','pt':[im.width/3.6733, im.height/3.6733]}
    ps=[{'id':p,'name':prods[p]['name']['es'],'path':prods[p]['path']['es']} for p in r['products']]
    out.append(dict(n=n,id=r['id'],caption=r['caption'],pdf=r['pdf'],page=r['page'],kind=r['kind'],family=r.get('family',''),
                    products=ps,old={'file':f'{ROOT}/site/assets/drawings/{r["id"]}.webp','pt':old_pt,'bytes':it['bytes']},new=new))
json.dump(out,open(f'{SP}/out/manifest.json','w'),ensure_ascii=False,indent=1)
print(len(out))
tot_old=sum(o['old']['bytes'] for o in out); tot_new=sum(os.path.getsize(o['new']['file']) for o in out)
print('old KB',tot_old//1024,'new KB (svg+png)',tot_new//1024)
import gzip
print('new gz KB', sum(len(gzip.compress(open(o['new']['file'],'rb').read())) for o in out)//1024)
