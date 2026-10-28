#!/usr/bin/env python3
"""Sesión 3 · Imágenes en local para el demo (solo GET sobre la web original, nunca se modifica nada allí).

  python3 -I scripts/fetch_images.py

Recoge las URLs de imágenes de: Store API (productos), páginas limpias (contenido), cabecera/pie del HTML,
y fondos `background-image` de los CSS de Elementor de cada página. Las descarga a data/raw/media/ (no se versiona)
y genera versiones web en site/assets/media/ (WebP máx. 1200 px + miniatura 480 px; SVG tal cual).
Escribe data/catalog/image-map.json: URL original -> {file, thumb, w, h}.
"""
import concurrent.futures as cf
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW, AN = ROOT / "data" / "raw", ROOT / "data" / "analysis"
OUTD = ROOT / "site" / "assets" / "media"
CAT = ROOT / "data" / "catalog"
BASE = "https://grupotorivac.com"
UA = "Mozilla/5.0 (compatible; SantisoMarketing-Migration/1.0)"
LANGS = ["es", "en", "fr", "de"]

for d in (RAW / "media", OUTD, CAT):
    d.mkdir(parents=True, exist_ok=True)


def norm(u):
    u = (u or "").strip().split("#")[0]
    if not u or u.startswith("data:"):
        return None
    return urljoin(BASE + "/", u.replace("&amp;", "&"))


def collect():
    urls = {}
    def add(u, src):
        u = norm(u)
        if u and re.search(r"\.(jpe?g|png|webp|gif|svg)(\?.*)?$", urlparse(u).path, re.I) and urlparse(u).netloc.endswith("grupotorivac.com"):
            urls.setdefault(u.split("?")[0], set()).add(src)
    for l in LANGS:
        p = RAW / f"store/products.{l}.json"
        if p.exists():
            for pr in json.loads(p.read_text()):
                for im in pr.get("images", []):
                    add(im.get("src"), f"store:{l}")
    # imágenes de las CATEGORÍAS (Store API y REST): sin esto las tarjetas de /productos/ enlazarían a la web original
    for l in LANGS:
        p = RAW / f"store/categories.{l}.json"
        if p.exists():
            for c in json.loads(p.read_text()):
                add((c.get("image") or {}).get("src"), f"cat:{l}")
    for f in AN.glob("pages/*/*.json"):
        pg = json.loads(f.read_text())
        for im in pg.get("images", []):
            add(im.get("src"), f"page:{pg['lang']}")
        add(pg.get("og_image"), "og")
    # cabecera/pie, fondos de CSS de Elementor
    css_seen = set()
    for l in LANGS:
        for h in (RAW / "html" / l).glob("*.html"):
            if not re.search(r"(home|^en$|^fr$|^de$|empresa|company|unternehmen|entreprise|proyectos|projects|projets|projekte|contacto|contact|kontakt|blog)", h.stem) and "product" in h.stem:
                continue
            html = h.read_text(errors="replace")
            for m in re.finditer(r"<img[^>]+(?:data-src|src)=[\"']([^\"']+)[\"']", html):
                add(m.group(1), f"html:{l}")
            for m in re.finditer(r"url\(['\"]?([^'\")]+\.(?:jpe?g|png|webp|svg))", html):
                add(m.group(1), f"htmlcss:{l}")
            for m in re.finditer(r"uploads/elementor/css/(post-\d+|global|loop-\d+)\.css", html):
                css_seen.add(f"{BASE}/wp-content/uploads/elementor/css/{m.group(1)}.css")
    (CAT / "elementor-css-urls.json").write_text(json.dumps(sorted(css_seen), indent=1))
    return urls, sorted(css_seen)


def get(url, binary=True, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
                return data if binary else data.decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def css_images(css_urls):
    out = {}
    def one(u):
        try:
            css = get(u, binary=False)
        except Exception:
            return u, []
        return u, [urljoin(u, m.group(1)) for m in re.finditer(r"url\(['\"]?([^'\")]+\.(?:jpe?g|png|webp|svg))", css)]
    with cf.ThreadPoolExecutor(6) as ex:
        for u, imgs in ex.map(one, css_urls):
            for i in imgs:
                if urlparse(i).netloc.endswith("grupotorivac.com"):
                    out.setdefault(i.split("?")[0], set()).add("css:" + Path(u).name)
    return out


def process(url):
    name = Path(urlparse(url).path).name
    key = hashlib.sha1(url.encode()).hexdigest()[:8]
    raw = RAW / "media" / f"{key}-{name}"
    rec = {"src_url": url, "ok": False}
    try:
        if not raw.exists():
            raw.write_bytes(get(url))
        ext = raw.suffix.lower()
        if ext == ".svg":
            dst = OUTD / f"{key}-{name}"
            dst.write_bytes(raw.read_bytes())
            rec.update(ok=True, file=f"assets/media/{dst.name}", thumb=f"assets/media/{dst.name}", w=None, h=None, kind="svg")
            return rec
        im = Image.open(raw)
        im.load()
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        im = im.convert("RGBA" if has_alpha else "RGB")
        w, h = im.size
        stem = f"{key}-{Path(name).stem}"
        big = im.copy(); big.thumbnail((1200, 1200)); big_p = OUTD / f"{stem}.webp"
        big.save(big_p, "WEBP", quality=82, method=4)
        th = im.copy(); th.thumbnail((480, 480)); th_p = OUTD / f"{stem}-t.webp"
        th.save(th_p, "WEBP", quality=78, method=4)
        rec.update(ok=True, file=f"assets/media/{big_p.name}", thumb=f"assets/media/{th_p.name}", w=w, h=h, kind="raster", alpha=has_alpha)
    except Exception as e:  # noqa: BLE001
        rec["error"] = str(e)[:200]
    return rec


if __name__ == "__main__":
    urls, css = collect()
    print("URLs en HTML/JSON:", len(urls), "| CSS Elementor:", len(css))
    for u, s in css_images(css).items():
        urls.setdefault(u, set()).update(s)
    # variantes con tamaño (-300x300) -> se descartan si existe la base: se baja la grande
    keep = {}
    bases = {re.sub(r"-\d+x\d+(?=\.\w+$)", "", u) for u in urls}
    for u in urls:
        b = re.sub(r"-\d+x\d+(?=\.\w+$)", "", u)
        if b != u and b in urls:
            continue  # la base ya está
        keep[u] = urls[u]
    print("a descargar:", len(keep))
    results = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for rec in ex.map(process, sorted(keep)):
            results[rec["src_url"]] = rec | {"used_in": sorted(keep[rec["src_url"]])[:6]}
    # alias: URL con tamaño -> misma imagen que la base
    for u in urls:
        b = re.sub(r"-\d+x\d+(?=\.\w+$)", "", u)
        if u not in results and b in results:
            results[u] = results[b] | {"alias_of": b}
    bad = [r for r in results.values() if not r.get("ok")]
    (CAT / "image-map.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))
    tot = sum(f.stat().st_size for f in OUTD.glob("*"))
    print(f"OK: {len(results) - len(bad)} | fallos: {len(bad)} | peso site/assets/media: {tot / 1048576:.1f} MB")
    for b in bad[:15]:
        print(" FALLO", b["src_url"], b.get("error"))
