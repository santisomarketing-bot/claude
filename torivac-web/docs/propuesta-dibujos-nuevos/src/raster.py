"""Dibujo que en el PDF es una imagen: se renderiza a alta resolución, se completa el recorte
(la leyenda inferior salía cortada) y se recolorea: tinta para el trazo oscuro, cobre para las cotas,
fondo transparente. No cambia ningún dato del dibujo."""
import subprocess, json, numpy as np
from PIL import Image, ImageFilter
ROOT=str(__import__('pathlib').Path(__file__).resolve().parents[3])
DPI=500
def render(pdf,page,bbox):
    x0,y0,x1,y1=bbox; k=DPI/72
    subprocess.run(['pdftoppm','-r',str(DPI),'-f',str(page),'-l',str(page),'-x',str(int(x0*k)),'-y',str(int(y0*k)),
                    '-W',str(int((x1-x0)*k)),'-H',str(int((y1-y0)*k)),'-gray','-png','-singlefile',pdf,'/tmp/_r'],check=True)
    return Image.open('/tmp/_r.png').convert('L')
def sstep(a,e0,e1):
    t=np.clip((a-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def recolor(im, ink=(16,4,4), cu=(164,92,24), out_w=1800):
    im=im.filter(ImageFilter.GaussianBlur(0.8))
    a=np.asarray(im).astype(np.float32)
    alpha=np.clip((246-a)/(246-95),0,1)**0.7
    t=sstep(a,95,175)[...,None]
    rgb=(np.array(ink,np.float32)*(1-t)+np.array(cu,np.float32)*t)
    rgba=np.dstack([rgb,(alpha*255)[...,None]]).astype(np.uint8)
    img=Image.fromarray(rgba,'RGBA')
    s=out_w/img.width
    return img.resize((out_w,int(img.height*s)),Image.LANCZOS)
if __name__=='__main__':
    cur=json.load(open(f'{ROOT}/data/catalog/drawings.curated.json'))['drawings']
    r=next(x for x in cur if x['id']=='reostato-pc-anclaje')
    x0,y0,x1,y1=r['bbox']; bbox=[x0,y0,x1,788]
    im=recolor(render(f'{ROOT}/data/raw/pdf/{r["pdf"]}',r['page'],bbox))
    # marcas de esquina (mismo estilo que los vectores)
    from PIL import ImageDraw
    m=26; W,H=im.size
    can=Image.new('RGBA',(W+2*m,H+2*m),(0,0,0,0)); can.paste(im,(m,m))
    d=ImageDraw.Draw(can); L=34; c=(186,107,30,205); w=3
    for (x,y,dx,dy) in ((3,3,1,1),(can.width-4,3,-1,1),(3,can.height-4,1,-1),(can.width-4,can.height-4,-1,-1)):
        d.line([(x+dx*L,y),(x,y),(x,y+dy*L)],fill=c,width=w,joint='curve')
    can.save('png/reostato-pc-anclaje.png'); print(can.size)
