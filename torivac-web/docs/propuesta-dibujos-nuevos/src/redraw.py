#!/usr/bin/env python3
"""Rediseña (restyle) un dibujo técnico a partir de la geometría vectorial del PDF.

No inventa nada: cada trazo, curva, flecha y letra sale del PDF original. Solo cambia la
piel: tinta cálida para el contorno, cobre para cotas y letras, grosores en 3 niveles,
fondo transparente, marcas de esquina. Salida: SVG autónomo (viewBox = recorte).
"""
import json, math, sys, os, re, pathlib
import pdfplumber
from pdfminer.converter import PDFLayoutAnalyzer
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.utils import apply_matrix_pt

ROOT = str(pathlib.Path(__file__).resolve().parents[3])
INK = '#100404'
COPPER = '#a45c18'      # cobre algo más oscuro que --copper para que las cotas finas se lean
COPPER_L = '#ba6b1e'
PAPER = '#f6f3ec'
TINT = '#e8d5bb'
COLORS = {'ink': INK, 'dim': COPPER, 'paper': 'var(--dwg-bg,%s)' % PAPER}


class Rec(PDFLayoutAnalyzer):
    """Registra trazados COMPLETOS (con sus huecos) y letras, en orden de pintado."""

    def __init__(self, rsrc):
        super().__init__(rsrc, pageno=1, laparams=None)
        self.recs = []

    def paint_path(self, gstate, stroke, fill, evenodd, path):
        if not path or path[0][0] != 'm':
            return
        tp = []
        for op in path:
            o = op[0]
            if o == 'h':
                tp.append(('h',))
                continue
            pts = [apply_matrix_pt(self.ctm, (float(a), float(b))) for a, b in zip(op[1::2], op[2::2])]
            tp.append((o,) + tuple(pts))
        a, b, c, d = self.ctm[0], self.ctm[1], self.ctm[2], self.ctm[3]
        sc = math.sqrt(abs(a * d - b * c)) or 1.0
        self.recs.append(dict(t='path', stroke=stroke, fill=fill, evenodd=evenodd,
                              lw=gstate.linewidth * sc, scolor=gstate.scolor, ncolor=gstate.ncolor,
                              dash=gstate.dash, path=tp))

    _tr = 0

    def render_string(self, textstate, seq, ncs, graphicstate):
        # modo de texto: 3 = invisible (capa de texto oculta), 7 = solo recorte
        self._tr = getattr(textstate, 'render', 0)
        return super().render_string(textstate, seq, ncs, graphicstate)

    def render_char(self, matrix, font, fontsize, scaling, rise, cid, ncs, graphicstate):
        adv = super().render_char(matrix, font, fontsize, scaling, rise, cid, ncs, graphicstate)
        ch = self.cur_item._objs[-1]
        if self._tr in (3, 7):
            return adv
        self.recs.append(dict(t='char', text=ch.get_text(), matrix=ch.matrix, size=ch.size,
                              ncolor=graphicstate.ncolor, x0=ch.x0, x1=ch.x1, y0=ch.y0, y1=ch.y1))
        return adv


def records(pdf_path, page_no):
    pdf = pdfplumber.open(pdf_path)
    pg = pdf.pages[page_no - 1]
    rm = PDFResourceManager()
    dev = Rec(rm)
    PDFPageInterpreter(rm, dev).process_page(pg.page_obj)
    return pg, dev.recs


def to_rgb(c):
    """Color de pdfminer (gris, RGB o CMYK) → (r,g,b) 0..1; None si no es un color."""
    if c is None or isinstance(c, str):
        return None
    c = tuple(c)
    if len(c) == 1:
        return (c[0], c[0], c[0])
    if len(c) == 3:
        return c
    if len(c) == 4:
        C, M, Y, K = c
        return ((1 - C) * (1 - K), (1 - M) * (1 - K), (1 - Y) * (1 - K))
    return None


def klass(c):
    rgb = to_rgb(c)
    if rgb is None:
        return 'ink'
    l = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
    if l < 0.25:
        return 'ink'
    if l < 0.88:
        return 'dim'
    return 'paper'


def f(n):
    s = f'{n:.2f}'.rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def width_tier(w):
    """3 grosores: fino (cotas, rayado), medio (contorno), grueso (silueta)."""
    if w is None:
        return 0.75
    if w < 0.45:
        return 0.4
    if w < 0.9:
        return 0.75
    return 1.25


def corner_marks(W, H, L=6, m=0.6):
    """Marcas de esquina de plano técnico, en cobre fino."""
    p = []
    for (x, y, dx, dy) in ((m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)):
        p.append(f'M{f(x + dx * L)} {f(y)}L{f(x)} {f(y)}L{f(x)} {f(y + dy * L)}')
    return f'<path d="{"".join(p)}" fill="none" stroke="{COPPER_L}" stroke-width="0.6" opacity=".8"/>'


def convert(pdf_path, page_no, bbox, pad=2.5, marks=True, margin=7):
    """Devuelve (svg_text, stats). bbox = [x0, y0, x1, y1] en puntos, origen arriba-izquierda."""
    pg, recs = records(pdf_path, page_no)
    H = pg.height
    x0, y0, x1, y1 = bbox
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    W, Hh = X1 - X0, Y1 - Y0
    els = []
    stats = {'path': 0, 'char': 0, 'skipped_big': 0}

    def P(pt):
        return (pt[0] - X0, (H - pt[1]) - Y0)

    for r in recs:
        if r['t'] == 'char':
            txt = r['text']
            if not txt.strip():
                continue
            top, bottom = H - r['y1'], H - r['y0']
            if r['x1'] < X0 or r['x0'] > X1 or bottom < Y0 or top > Y1:
                continue
            m = r['matrix']
            ox, oy = P((m[4], m[5]))
            # el origen de la letra debe caer dentro del recorte: evita virutas de rótulos vecinos
            if not (-1 <= ox <= W + 1 and -1 <= oy <= Hh + 1):
                continue
            ang = -math.degrees(math.atan2(m[1], m[0]))
            ex, ey = P((m[4], m[5]))
            col = COLORS[klass(r['ncolor'])]
            tr = f'translate({f(ex)} {f(ey)})' + (f' rotate({f(ang)})' if abs(ang) > 0.5 else '')
            fa = f'style="fill:{col}"' if col.startswith('var(') else f'fill="{col}"'
            els.append(f'<text transform="{tr}" font-size="{f(math.hypot(m[0], m[1]) * 0.93)}" {fa}>{esc(txt)}</text>')
            stats['char'] += 1
            continue
        # trazado
        xs, ys = [], []
        for cmd in r['path']:
            for pt in cmd[1:]:
                xs.append(pt[0]); ys.append(H - pt[1])
        if not xs:
            continue
        bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
        if bx1 < X0 or bx0 > X1 or by0 > Y1 or by1 < Y0:
            continue
        if (bx1 - bx0) > 2.2 * W or (by1 - by0) > 2.2 * Hh:
            stats['skipped_big'] += 1
            continue
        d = []
        for cmd in r['path']:
            o = cmd[0]
            if o == 'm':
                d.append('M%s %s' % tuple(f(v) for v in P(cmd[1])))
            elif o == 'l':
                d.append('L%s %s' % tuple(f(v) for v in P(cmd[1])))
            elif o == 'c':
                d.append('C' + ' '.join('%s %s' % tuple(f(v) for v in P(p)) for p in cmd[1:]))
            elif o == 'v':   # pdfminer ya convierte; por si acaso
                d.append('L%s %s' % tuple(f(v) for v in P(cmd[-1])))
            elif o == 'y':
                d.append('L%s %s' % tuple(f(v) for v in P(cmd[-1])))
            elif o == 'h':
                d.append('Z')
        attrs = []
        area = (bx1 - bx0) * (by1 - by0)
        if r['fill']:
            fc = klass(r['ncolor'])
            col = COLORS[fc]
            if fc == 'dim' and area > 60:
                col = TINT
            attrs.append(f'style="fill:{col}"' if col.startswith('var(') else f'fill="{col}"')
            if r['evenodd']:
                attrs.append('fill-rule="evenodd"')
        else:
            attrs.append('fill="none"')
        if r['stroke']:
            sc = klass(r['scolor'])
            w = width_tier(r['lw'])
            if sc == 'dim':
                w = min(w, 0.5)
            attrs.append(f'style="stroke:{COLORS[sc]}" stroke-width="{f(w)}"' if sc == 'paper' else f'stroke="{COLORS[sc]}" stroke-width="{f(w)}"')
            dash = r['dash']
            if dash and dash[0]:
                attrs.append('stroke-dasharray="%s"' % ' '.join(f(v) for v in dash[0]))
        els.append(f'<path d="{"".join(d)}" {" ".join(attrs)}/>')
        stats['path'] += 1
    m_ = margin if marks else 0
    TW, TH = W + 2 * m_, Hh + 2 * m_
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(TW)} {f(TH)}" '
        f'width="{f(TW)}" height="{f(TH)}" stroke-linecap="round" stroke-linejoin="round" '
        f'font-family="\'Chivo Mono\',\'JetBrains Mono\',ui-monospace,monospace">'
        f'<defs><clipPath id="c"><rect width="{f(W)}" height="{f(Hh)}"/></clipPath></defs>'
        f'<g transform="translate({f(m_)} {f(m_)})" clip-path="url(#c)">' + ''.join(els) + '</g>'
        + (corner_marks(TW, TH, L=7, m=1) if marks else '') + '</svg>'
    )
    return svg, stats


if __name__ == '__main__':
    rec_id = sys.argv[1]
    out = sys.argv[2]
    cur = json.load(open(f'{ROOT}/data/catalog/drawings.curated.json'))['drawings']
    r = next(x for x in cur if x['id'] == rec_id)
    svg, st = convert(f'{ROOT}/data/raw/pdf/{r["pdf"]}', r['page'], r['bbox'])
    open(out, 'w').write(svg)
    print(rec_id, st, len(svg) // 1024, 'KB')
