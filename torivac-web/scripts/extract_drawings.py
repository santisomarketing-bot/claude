#!/usr/bin/env python3
"""[EXTRACT-DRAWINGS] Dibujos técnicos con cotas de las fichas técnicas en PDF → imágenes WebP en site/assets/drawings/ y contrato data/catalog/drawings.json.

  python3 -I scripts/extract_drawings.py                 genera (o regenera) las imágenes y data/catalog/drawings.json desde data/catalog/drawings.curated.json
  python3 -I scripts/extract_drawings.py --check         comprueba SIN escribir: verificación de cada dibujo + que lo guardado es exactamente lo que saldría (imágenes y JSON); falla si algo difiere
  python3 -I scripts/extract_drawings.py --propose NOMBRE.pdf    ayuda para redactar recetas: lista los bloques de dibujo que detecta en cada página (cajas en puntos PDF, origen arriba a la izquierda)

Qué hay detrás. Los dibujos de las fichas son gráficos vectoriales (líneas y curvas) o imágenes incrustadas dentro del PDF. No se «redibuja» nada: se RECORTA la región de la página del PDF original
(data/raw/pdf, copia de lo que la web original publica) a una resolución nítida, se colapsan las bandas en blanco entre vistas y se guarda en WebP sin pérdida (vectoriales, en gris) o con
pérdida mínima (imágenes). Qué región es cada dibujo y a qué producto pertenece son decisiones humanas con su porqué: data/catalog/drawings.curated.json (mismo criterio que pdf-links.curated.json).

Reglas de seguridad (todas se comprueban en cada ejecución; si una falla, el dibujo NO se publica y el script termina con error):
  · El vínculo producto ↔ PDF ↔ familia debe existir en data/analysis/pdf-product-links.json con confianza «alta» (no se publican dibujos de un vínculo dudoso: van a propuestas).
  · La región contiene el dibujo entero (ningún grupo de trazos queda cortado por el borde) y nada que no sea dibujo (ni celdas de tabla rellenas ni texto corrido).
  · Si la receta dice qué texto del PDF identifica la fila (expect_text, junto a la región) o la página (expect_page_text), ese texto aparece donde debe.
  · El resultado pesa ≤ 120 KB y mide ≤ 1000 × 1400 px.

Secciones: [DETECTAR] [VERIFICAR] [RENDER] [CONSTRUIR] [CLI]
Funciones: clusters · blocks · verify_region · render_region · build · propose · main
"""
import argparse
import hashlib
import io
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pdfplumber
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "data" / "raw" / "pdf"
CURATED = ROOT / "data" / "catalog" / "drawings.curated.json"
DATA = ROOT / "data" / "catalog" / "drawings.json"
LINKS = ROOT / "data" / "analysis" / "pdf-product-links.json"
OUT_DIR = ROOT / "site" / "assets" / "drawings"
MAX_W, MAX_H, MAX_BYTES = 1000, 1400, 120 * 1024
HEADER_BOTTOM = 95          # las cabeceras negras con el naranja de las fichas acaban antes de este punto
PAD = 2.5                   # margen (puntos PDF) alrededor de la caja de la receta


# ───────────────────────────────────────── [DETECTAR] grupos de trazos
def clusters(page, gap=8):
    """Agrupa las líneas y curvas de la página que se tocan (o están a menos de `gap` puntos). Devuelve [{bbox:(x0,y0,x1,y1), n}] en puntos, origen arriba a la izquierda."""
    objs = [o for o in page.lines + page.curves if o["x1"] - o["x0"] < 400 and o["bottom"] - o["top"] < 400]
    n = len(objs)
    parent = list(range(n))

    def find(i):
        """Raíz del grupo de trazos al que pertenece el trazo i (unión-búsqueda con compresión de caminos)."""
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    boxes = [(o["x0"], o["top"], o["x1"], o["bottom"]) for o in objs]
    for i in range(n):
        a = boxes[i]
        for j in range(i + 1, n):
            b = boxes[j]
            if a[0] - gap <= b[2] and b[0] - gap <= a[2] and a[1] - gap <= b[3] and b[1] - gap <= a[3]:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    out = []
    for ids in groups.values():
        out.append({"bbox": (min(boxes[i][0] for i in ids), min(boxes[i][1] for i in ids), max(boxes[i][2] for i in ids), max(boxes[i][3] for i in ids)), "n": len(ids)})
    return out


def _overlap(a0, a1, b0, b1):
    """Longitud en que se solapan dos intervalos [a0,a1] y [b0,b1] (0 si no se tocan)."""
    return max(0, min(a1, b1) - max(a0, b0))


def blocks(page, gap=8, vgap=6, cap_h=11):
    """Bloques de dibujo de una página: vistas que se tocan en vertical (alzado + planta) y su título (vectorial, de poca altura) que queda justo encima. Solo sirve de ayuda para redactar recetas."""
    cs = [c for c in clusters(page, gap) if c["n"] >= 6 and c["bbox"][1] > HEADER_BOTTOM]
    caps = [c for c in cs if c["bbox"][3] - c["bbox"][1] <= cap_h and c["bbox"][2] - c["bbox"][0] >= 18 and c["n"] <= 40]
    body = [c for c in cs if c not in caps and (c["bbox"][3] - c["bbox"][1]) > cap_h and c["n"] >= 10]
    changed = True
    while changed:
        changed = False
        for i in range(len(body)):
            for j in range(i + 1, len(body)):
                a, b = body[i]["bbox"], body[j]["bbox"]
                if _overlap(a[0], a[2], b[0], b[2]) >= 0.4 * min(a[2] - a[0], b[2] - b[0]) and b[1] - a[3] <= vgap and a[1] - b[3] <= vgap:
                    body[i] = {"bbox": (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])), "n": body[i]["n"] + body[j]["n"]}
                    del body[j]
                    changed = True
                    break
            if changed:
                break
    for c in caps:
        a = c["bbox"]
        best = None
        for k, bl in enumerate(body):
            b = bl["bbox"]
            if b[1] >= a[3] - 2 and b[1] - a[3] <= 70 and _overlap(a[0], a[2], b[0], b[2]) >= 0.5 * (a[2] - a[0]):
                if best is None or b[1] < body[best]["bbox"][1]:
                    best = k
        if best is not None:
            b = body[best]["bbox"]
            body[best] = {"bbox": (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])), "n": body[best]["n"] + c["n"]}
    body.sort(key=lambda c: (round(c["bbox"][1] / 40), c["bbox"][0]))
    return body


# ───────────────────────────────────────── [VERIFICAR]
def load_links():
    """Vínculos producto ↔ PDF ↔ familia con confianza alta: {(pdf, product_id): {familias}}."""
    d = json.loads(LINKS.read_text(encoding="utf-8"))
    out = {}
    for l in d.get("links", []):
        if l.get("confidence") == "alta" and l.get("product_id") is not None:
            out.setdefault((l["pdf"], int(l["product_id"])), set()).add(l.get("family") or "")
    return out


def _inside(b, box, tol=0.5):
    """True si la caja b (x0,y0,x1,y1) cabe entera dentro de box, con una tolerancia de medio punto."""
    return b[0] >= box[0] - tol and b[1] >= box[1] - tol and b[2] <= box[2] + tol and b[3] <= box[3] + tol


def verify_region(page, rec, links):
    """Lista de problemas de una receta (vacía = bien). `page` es la página abierta con pdfplumber."""
    errs = []
    rid = rec["id"]
    bx = rec["bbox"]
    box = (bx[0] - PAD, bx[1] - PAD, bx[2] + PAD, bx[3] + PAD)
    # 1 · vínculo de confianza alta con la familia
    for pid in rec["products"]:
        fam = links.get((rec["pdf"], int(pid)))
        if fam is None:
            errs.append(f"{rid}: el producto {pid} no tiene un vínculo de confianza alta con {rec['pdf']} (data/analysis/pdf-product-links.json)")
        elif rec.get("family") and rec["family"] not in fam:
            errs.append(f"{rid}: la familia «{rec['family']}» no es una de las vinculadas al producto {pid} ({sorted(fam)})")
    # 2 · contenido de la región
    texto = [c for c in page.chars if _inside((c["x0"], c["top"], c["x1"], c["bottom"]), box)]
    if len(texto) > (rec.get("max_chars") or 12):
        errs.append(f"{rid}: la región lleva {len(texto)} caracteres de texto (¿una tabla?); máximo {rec.get('max_chars', 12)}")
    rellenas = [r for r in page.rects if r.get("fill") and (r["x1"] - r["x0"]) * (r["bottom"] - r["top"]) > 300 and _inside((r["x0"], r["top"], r["x1"], r["bottom"]), box)]
    if rellenas:
        errs.append(f"{rid}: la región lleva {len(rellenas)} celdas de tabla rellenas")
    if rec["kind"] == "vector":
        dentro = [o for o in page.lines + page.curves if _inside((o["x0"], o["top"], o["x1"], o["bottom"]), box)]
        if len(dentro) < (rec.get("min_objects") or 40):
            errs.append(f"{rid}: solo {len(dentro)} trazos vectoriales (mínimo {rec.get('min_objects', 40)})")
        for c in clusters(page, 4):                      # trazos a menos de 4 pt = el mismo dibujo (un título a 8–12 pt de distancia es otro objeto)
            b = c["bbox"]
            toca = b[0] < box[2] and b[2] > box[0] and b[1] < box[3] and b[3] > box[1]
            if toca and c["n"] >= 12 and not _inside(b, box, tol=2.5):
                errs.append(f"{rid}: un grupo de {c['n']} trazos {[round(v) for v in b]} queda cortado por el borde de la región")
    else:
        imgs = [im for im in page.images if _inside((im["x0"], im["top"], im["x1"], im["bottom"]), (box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1))]
        if not imgs:
            errs.append(f"{rid}: no hay ninguna imagen incrustada dentro de la región")
    # 3 · texto que identifica la fila (junto a la región) o la página (en cualquier parte)
    if rec.get("expect_page_text"):
        t = " ".join((page.extract_text() or "").split()).lower()
        if " ".join(rec["expect_page_text"].split()).lower() not in t:
            errs.append(f"{rid}: el texto «{rec['expect_page_text']}» no aparece en la página {rec['page']} de {rec['pdf']}")
    if rec.get("expect_text"):
        banda = page.crop((0, max(0, bx[1] - 40), page.width, min(page.height, bx[3] + 40)))
        t = " ".join((banda.extract_text() or "").split()).lower()
        if " ".join(rec["expect_text"].split()).lower() not in t:
            errs.append(f"{rid}: el texto «{rec['expect_text']}» no aparece junto a la región")
    return errs


# ───────────────────────────────────────── [RENDER]
def render_region(rec):
    """Recorta la región de la página del PDF y devuelve (imagen PIL, formato webp kwargs). Colapsa bandas en blanco largas (entre el título y el dibujo, por ejemplo)."""
    x0, y0, x1, y1 = rec["bbox"]
    x0, y0, x1, y1 = x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD
    wi, hi = (x1 - x0) / 72, (y1 - y0) / 72
    dpi = max(150, min(400, int(MAX_W / wi), int(MAX_H * 1.5 / hi)))      # algo más de píxeles de los que se guardan: el reescalado afina las líneas
    k = dpi / 72
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "r"
        subprocess.run(["pdftocairo", "-png", "-r", str(dpi), "-f", str(rec["page"]), "-l", str(rec["page"]), "-x", str(int(x0 * k)), "-y", str(int(y0 * k)), "-W", str(int((x1 - x0) * k)), "-H", str(int((y1 - y0) * k)), "-singlefile", str(PDF_DIR / rec["pdf"]), str(out)], check=True, capture_output=True)
        im = Image.open(str(out) + ".png").convert("RGB")
        im.load()
    im = _collapse_blank_rows(im, min_run=int(0.11 * dpi), keep=int(0.06 * dpi))
    if im.width > MAX_W or im.height > MAX_H:
        s = min(MAX_W / im.width, MAX_H / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    if rec["kind"] == "vector":
        return im.convert("L"), {"lossless": True, "method": 6}
    return im, {"quality": 88, "method": 6}


def _collapse_blank_rows(im, min_run, keep):
    """Reduce a `keep` píxeles las franjas horizontales totalmente en blanco de más de `min_run` píxeles (huecos de la maquetación del PDF); recorta también el blanco de arriba y abajo."""
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    blank = [all(px[x, y] > 246 for x in range(0, w, 2)) for y in range(h)]
    rows, y = [], 0
    while y < h:
        j = y
        while j < h and blank[j] == blank[y]:
            j += 1
        rows.append((y, j, blank[y]))
        y = j
    parts = []
    for i, (a, b, bl) in enumerate(rows):
        if bl and (i == 0 or i == len(rows) - 1):
            continue                                     # blanco de los extremos: fuera
        if bl and b - a > min_run:
            parts.append(im.crop((0, a, w, a + keep)))
        else:
            parts.append(im.crop((0, a, w, b)))
    total = sum(p.height for p in parts)
    out = Image.new("RGB", (w, max(total, 1)), (255, 255, 255))
    yy = 0
    for p in parts:
        out.paste(p, (0, yy))
        yy += p.height
    # recorta el blanco de los lados
    box = Image.eval(out.convert("L"), lambda v: 255 if v < 246 else 0).getbbox()
    if box:
        m = int(0.03 * 150)
        out = out.crop((max(0, box[0] - m), 0, min(out.width, box[2] + m), out.height))
        out = _pad(out, 6)
    return out


def _pad(im, m):
    """Devuelve la imagen con un margen blanco de m píxeles por cada lado."""
    out = Image.new("RGB", (im.width + 2 * m, im.height + 2 * m), (255, 255, 255))
    out.paste(im, (m, m))
    return out


def image_bytes(rec):
    """Renderiza la región de la receta y devuelve los bytes del .webp final (sin escribir nada en disco)."""
    im, kw = render_region(rec)
    b = io.BytesIO()
    im.save(b, "WEBP", **kw)
    return b.getvalue(), im.size


# ───────────────────────────────────────── [CONSTRUIR]
def filename(rec):
    """Nombre de archivo descriptivo y estable: <id>.webp (el id lo elige la receta)."""
    return f"{rec['id']}.webp"


def build(check=False):
    """Genera (o comprueba) imágenes y contrato. Devuelve la lista de problemas."""
    cur = json.loads(CURATED.read_text(encoding="utf-8"))
    recs = cur["drawings"]
    links = load_links()
    errs = []
    ids = set()
    pages = {}
    items, by_product = [], {}
    for rec in recs:
        if rec["id"] in ids:
            errs.append(f"{rec['id']}: id repetido")
        ids.add(rec["id"])
        pdf_path = PDF_DIR / rec["pdf"]
        if not pdf_path.exists():
            errs.append(f"{rec['id']}: no existe {rec['pdf']} en data/raw/pdf")
            continue
        if rec["pdf"] not in pages:
            pages[rec["pdf"]] = pdfplumber.open(pdf_path)
        pdf = pages[rec["pdf"]]
        if rec["page"] > len(pdf.pages):
            errs.append(f"{rec['id']}: {rec['pdf']} no tiene la página {rec['page']}")
            continue
        e = verify_region(pdf.pages[rec["page"] - 1], rec, links)
        errs += e
        if e:
            continue
        data, (w, h) = image_bytes(rec)
        if len(data) > MAX_BYTES:
            errs.append(f"{rec['id']}: pesa {len(data) // 1024} KB (máximo {MAX_BYTES // 1024} KB)")
            continue
        fn = filename(rec)
        p = OUT_DIR / fn
        if check:
            if not p.exists() or p.read_bytes() != data:
                errs.append(f"{fn}: la imagen guardada no coincide con lo que sale del PDF (¿falta regenerar con scripts/extract_drawings.py?)")
        else:
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        item = {"id": rec["id"], "file": f"assets/drawings/{fn}", "w": w, "h": h, "bytes": len(data), "sha": hashlib.sha1(data).hexdigest()[:12], "caption": rec["caption"], "pdf": rec["pdf"], "page": rec["page"], "products": rec["products"]}
        items.append(item)
        for pid in rec["products"]:
            by_product.setdefault(str(pid), []).append(rec["id"])
    for pdf in pages.values():
        pdf.close()
    out = {"_doc": "GENERADO por scripts/extract_drawings.py desde drawings.curated.json (no editar a mano). items = dibujos (archivo en site/assets/drawings, tamaño, pie, PDF y página de origen); by_product = id de producto → ids de dibujo, en orden.",
           "items": items, "by_product": by_product}
    txt = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if check:
        if not DATA.exists() or DATA.read_text(encoding="utf-8") != txt:
            errs.append("data/catalog/drawings.json no coincide con lo que sale de las recetas (regenera con scripts/extract_drawings.py)")
        stale = sorted(p.name for p in OUT_DIR.glob("*.webp") if p.name not in {Path(i["file"]).name for i in items}) if OUT_DIR.exists() else []
        if stale:
            errs.append(f"imágenes sin receta en site/assets/drawings: {stale[:5]}")
    elif not errs:
        DATA.write_text(txt, encoding="utf-8")
        for p in OUT_DIR.glob("*.webp"):
            if p.name not in {Path(i["file"]).name for i in items}:
                p.unlink()
    return errs, len(items), len(by_product)


def propose(name):
    """Ayuda para redactar recetas: imprime los bloques de dibujo de cada página del PDF."""
    with pdfplumber.open(PDF_DIR / name) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"{name} · página {i + 1} · {page.width:.0f}×{page.height:.0f} pt · imágenes incrustadas: {[[round(v) for v in (im['x0'], im['top'], im['x1'], im['bottom'])] for im in page.images]}")
            for k, b in enumerate(blocks(page)):
                print(f"  bloque {k}: bbox {[round(v) for v in b['bbox']]} · {b['n']} trazos")


# ───────────────────────────────────────── [CLI]
def main():
    """Línea de comandos: genera los dibujos (o, con --check, solo los compara) y con --propose PDF lista los bloques de dibujo de cada página."""
    ap = argparse.ArgumentParser(description="Dibujos técnicos de los PDF → site/assets/drawings + data/catalog/drawings.json")
    ap.add_argument("--check", action="store_true", help="comprueba sin escribir")
    ap.add_argument("--propose", metavar="PDF", help="lista los bloques de dibujo de un PDF (ayuda para las recetas)")
    a = ap.parse_args()
    if a.propose:
        propose(a.propose)
        return 0
    errs, n, p = build(check=a.check)
    for e in errs:
        print("  ✗ " + e)
    if errs:
        print(f"✗ {len(errs)} problema(s) en los dibujos técnicos")
        return 1
    print(f"✓ {n} dibujos técnicos para {p} productos" + (" (coinciden con lo guardado)" if a.check else " generados"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
