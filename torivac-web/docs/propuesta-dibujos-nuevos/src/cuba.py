"""Cuba de aceite: redibujo a mano (el original es una imagen pixelada de 277×279 px).
Mantiene las tres cotas (A alto, B fondo, C ancho) y la posición del borne y del piloto."""
import math
INK='#100404'; CU='#a45c18'; CUL='#ba6b1e'
def pts(*p): return ' '.join('%s,%s'%(round(x,1),round(y,1)) for x,y in p)
def arrow(x,y,dx,dy,L=18,W=7):
    """punta de flecha en (x,y) apuntando hacia (dx,dy) unitario"""
    nx,ny=-dy,dx
    return f'<polygon points="{pts((x,y),(x-dx*L+nx*W/2,y-dy*L+ny*W/2),(x-dx*L-nx*W/2,y-dy*L-ny*W/2))}" fill="{CU}"/>'
cx=443
T=(cx,102); R=(650,224); F=(cx,346); L=(236,224)
th=16
Fb=(cx,F[1]+th); Lb=(L[0],L[1]+th); Rb=(R[0],R[1]+th)
sl=(Fb[1]-Lb[1])/(Fb[0]-Lb[0])
bl=250; br=636
bt_l=(bl,Lb[1]+(bl-Lb[0])*sl); bt_r=(br,Rb[1]+(Rb[0]-br)*sl)
bt_c=(cx,Fb[1])
bb_l=(bl,610); bb_r=(br,610); bb_c=(cx,610+(cx-bl)*sl)
u=(0.5,-0.86)   # normal hacia arriba-derecha (cota B)
v=(0.5,0.86)    # normal hacia abajo-derecha (cota C)
o=[]
o.append(f'<g stroke-linejoin="round" stroke-linecap="round">')
# cuerpo
o.append(f'<polygon points="{pts(bt_l,bt_c,bb_c,bb_l)}" fill="#dcc29a" stroke="{INK}" stroke-width="4"/>')
o.append(f'<polygon points="{pts(bt_c,bt_r,bb_r,bb_c)}" fill="#a9824f" stroke="{INK}" stroke-width="4"/>')
# tapa: caras laterales y cara superior
o.append(f'<polygon points="{pts(Lb,Fb,F,L)}" fill="#d8bd92" stroke="{INK}" stroke-width="4"/>')
o.append(f'<polygon points="{pts(Fb,Rb,R,F)}" fill="#8f6a3a" stroke="{INK}" stroke-width="4"/>')
o.append(f'<polygon points="{pts(T,R,F,L)}" fill="#efe2cc" stroke="{INK}" stroke-width="4.5"/>')
# borne (poste) y anillo
o.append(f'<ellipse cx="{cx}" cy="224" rx="14" ry="7" fill="{CUL}" stroke="{INK}" stroke-width="3"/>')
o.append(f'<rect x="{cx-6}" y="150" width="12" height="76" fill="{INK}"/>')
# piloto
o.append(f'<ellipse cx="292" cy="206" rx="15" ry="11" fill="{CUL}" stroke="{INK}" stroke-width="3"/>')
o.append('</g>')
# cotas: finas, en cobre
d=[]
# A (alto)
d.append(f'<line x1="20" y1="160" x2="{cx-8}" y2="160"/>')
d.append(f'<line x1="20" y1="668" x2="348" y2="668"/>')
d.append(f'<line x1="42" y1="176" x2="42" y2="652"/>')
d.append(arrow(42,160,0,-1)); d.append(arrow(42,668,0,1))
# B (fondo)
off=90
A1=(T[0]+u[0]*off,T[1]+u[1]*off); A2=(R[0]+u[0]*off,R[1]+u[1]*off)
d.append(f'<line x1="{T[0]}" y1="{T[1]}" x2="{T[0]+u[0]*(off+14)}" y2="{T[1]+u[1]*(off+14)}" stroke-dasharray="7 6"/>')
d.append(f'<line x1="{R[0]}" y1="{R[1]}" x2="{R[0]+u[0]*(off+14)}" y2="{R[1]+u[1]*(off+14)}" stroke-dasharray="7 6"/>')
ux,uy=(R[0]-T[0]),(R[1]-T[1]); n=math.hypot(ux,uy); ux/=n; uy/=n
d.append(f'<line x1="{A1[0]+ux*16}" y1="{A1[1]+uy*16}" x2="{A2[0]-ux*16}" y2="{A2[1]-uy*16}"/>')
d.append(arrow(A1[0],A1[1],-ux,-uy)); d.append(arrow(A2[0],A2[1],ux,uy))
# C (ancho)
P1=bb_c; P2=bb_r
off2=90
C1=(P1[0]+v[0]*off2,P1[1]+v[1]*off2); C2=(P2[0]+v[0]*off2,P2[1]+v[1]*off2)
d.append(f'<line x1="{P1[0]}" y1="{P1[1]}" x2="{P1[0]+v[0]*(off2+14)}" y2="{P1[1]+v[1]*(off2+14)}" stroke-dasharray="7 6"/>')
d.append(f'<line x1="{P2[0]}" y1="{P2[1]}" x2="{P2[0]+v[0]*(off2+14)}" y2="{P2[1]+v[1]*(off2+14)}" stroke-dasharray="7 6"/>')
wx,wy=(P2[0]-P1[0]),(P2[1]-P1[1]); n=math.hypot(wx,wy); wx/=n; wy/=n
d.append(f'<line x1="{C1[0]+wx*16}" y1="{C1[1]+wy*16}" x2="{C2[0]-wx*16}" y2="{C2[1]-wy*16}"/>')
d.append(arrow(C1[0],C1[1],-wx,-wy)); d.append(arrow(C2[0],C2[1],wx,wy))
cot=f'<g fill="none" stroke="{CU}" stroke-width="2.4" stroke-linecap="round">'+''.join(x for x in d if not x.startswith('<polygon'))+'</g>'+''.join(x for x in d if x.startswith('<polygon'))
lab=[]
def label(txt,x,y): lab.append(f'<text x="{x}" y="{y}" font-size="46" text-anchor="middle" fill="{CU}">{txt}</text>')
label('A',78,430)
mB=((A1[0]+A2[0])/2,(A1[1]+A2[1])/2); label('B',mB[0]+30,mB[1]-8)
mC=((C1[0]+C2[0])/2,(C1[1]+C2[1])/2); label('C',mC[0]+6,mC[1]+50)
M=16
W,H=723,857
corner=[]
Lc=44
for (x,y,dx,dy) in ((2,2,1,1),(W+2*M-2,2,-1,1),(2,H+2*M-2,1,-1),(W+2*M-2,H+2*M-2,-1,-1)):
    corner.append(f'M{x+dx*Lc} {y}L{x} {y}L{x} {y+dy*Lc}')
svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W+2*M} {H+2*M}" width="{W+2*M}" height="{H+2*M}" '
     f'font-family="\'Chivo Mono\',\'JetBrains Mono\',ui-monospace,monospace">'
     f'<g transform="translate({M} {M})">'+''.join(o)+cot+''.join(lab)+'</g>'
     f'<path d="{"".join(corner)}" fill="none" stroke="{CUL}" stroke-width="3.4" opacity=".8"/></svg>')
open('svg/cuba-de-aceite.svg','w').write(svg)
print(len(svg))
