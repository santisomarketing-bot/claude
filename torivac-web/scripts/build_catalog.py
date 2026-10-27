#!/usr/bin/env python3
"""Sesión 2 · Construye data/catalog/*.json (ÚNICA fuente de verdad del sitio) a partir de data/raw + data/analysis.

  python3 -I scripts/build_catalog.py

Parte DETERMINISTA (sin IA): contenido tal cual de la web original, convertido a bloques semánticos (scripts/semantic.py).
La parte inteligente (etiquetas de voltaje, variantes pedibles desde PDFs, propuestas) se aplica después con
scripts/enrich_catalog.py (lee data/analysis/products, pdfs, voltage-*.json) y NO toca el contenido de la web.

Etiquetas de secciones: [CFG] [UTIL] [IMG] [CATS] [PRODUCTS] [PAGES] [SITE]
"""
import difflib
import html as htmllib
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from semantic import blocks_from, blocks_from_html  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW, AN, CAT = ROOT / "data" / "raw", ROOT / "data" / "analysis", ROOT / "data" / "catalog"
CAT.mkdir(parents=True, exist_ok=True)
(RAW / "css").mkdir(parents=True, exist_ok=True)
(ROOT / "site" / "assets" / "pdf").mkdir(parents=True, exist_ok=True)
BASE = "https://grupotorivac.com"
LANGS = ["es", "en", "fr", "de"]
UA = "Mozilla/5.0 (compatible; SantisoMarketing-Migration/1.0)"


# ----------------------------------------------------------------------------- [UTIL]
def jl(p, default=None):
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return default


def pth(u):
    """ruta absoluta con barra final: https://x/en/a/ -> /en/a/"""
    p = urlparse(u or "").path or "/"
    return p if p.endswith("/") or "." in p.rsplit("/", 1)[-1] else p + "/"


def lang_of_path(p):
    m = re.match(r"^/(en|fr|de)(/|$)", p)
    return m.group(1) if m else "es"


def text_of(blocks):
    out = []
    for b in blocks:
        if b["t"] == "h": out.append(b["x"])
        elif b["t"] == "p": out.append(re.sub(r"<[^>]+>", " ", b["h"]))
        elif b["t"] == "ul": out += [re.sub(r"<[^>]+>", " ", i) for i in b["i"]]
        elif b["t"] == "table": out += [" ".join(c["x"] for c in r) for r in b["rows"]]
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def fetch(url, dst: Path):
    if dst.exists():
        return dst.read_text(errors="replace")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        data = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")
        dst.write_text(data)
        return data
    except Exception:
        return ""


def clean_alt(a):
    """alt de imagen: se decodifican entidades; si parece un nombre de fichero (sin espacios) se descarta y la plantilla usa el nombre del producto"""
    a = htmllib.unescape(a or "").strip()
    return None if (not a or re.fullmatch(r"[\w\-×x.]+", a)) else a


# ----------------------------------------------------------------------------- [IMG]
IMG = jl(CAT / "image-map.json", {})


def size_base(u):
    return re.sub(r"-\d+x\d+(?=\.\w+$)", "", u.split("?")[0])


def img_ref(src):
    """URL original -> {file, thumb, w, h} local. Si no existe copia local, se conserva la URL remota (y se anota)."""
    if not src:
        return None
    s = src.split("?")[0]
    r = IMG.get(s) or IMG.get(size_base(s))
    if r and r.get("ok"):
        return {"file": r["file"], "thumb": r["thumb"], "w": r.get("w"), "h": r.get("h"), "src": s}
    return {"file": None, "thumb": None, "w": None, "h": None, "src": s, "missing_local": True}


def localize_blocks(blocks):
    for b in blocks:
        if b["t"] == "img":
            b["img"] = img_ref(b["src"])
    return blocks


# ----------------------------------------------------------------------------- [CFG] datos cargados
store = {l: {p["id"]: p for p in jl(RAW / f"store/products.{l}.json", [])} for l in LANGS}
rest_prod = {l: {p["id"]: p for p in jl(RAW / f"rest/product.{l}.json", [])} for l in LANGS}
rest_cat = {l: jl(RAW / f"rest/product_cat.{l}.json", []) for l in LANGS}
rest_posts = {l: jl(RAW / f"rest/posts.{l}.json", []) for l in LANGS}
pmap = {p["id_es"]: p for p in jl(AN / "product-map.json", {"products": []})["products"]}
pidx = jl(AN / "pages-index.json", {"pages": []})["pages"]
def _expected_stem(path):
    return path.strip("/").replace("/", "__") or "home"


def _real_path(r):
    """Ruta real de la página. Normalmente la canónica; pero la home EN declara canónica /de/ (error de la web original), así que en las homes manda el fichero."""
    stem = Path(r["file"]).stem
    if stem in ("en", "fr", "de"):
        return f"/{stem}/"
    if stem == "home":
        return "/"
    return pth(r["url"]) if r.get("url") else None


def _best_per_path(records):
    """Varias páginas pueden compartir URL canónica. Gana la cuyo fichero coincide con la ruta; si no, la de más texto. Se excluyen plantillas internas (elementor-hf)."""
    best = {}
    for r in records:
        if Path(r["file"]).stem.startswith("elementor-hf"):
            continue
        p = _real_path(r)
        if not p:
            continue
        stem = Path(r["file"]).stem
        # un ES publicado también bajo /en/ (canónica ES) no es una página EN: se descarta
        fetched = "en" if stem.startswith("en__") else "fr" if stem.startswith("fr__") else "de" if stem.startswith("de__") else "es"
        if fetched != lang_of_path(p) and stem not in ("en", "fr", "de"):
            continue
        score = (stem == _expected_stem(p) or stem in ("en", "fr", "de", "home"), r.get("text_chars", 0))
        if p not in best or score > best[p][0]:
            best[p] = (score, r)
    return {p: v[1] for p, v in best.items()}


by_url = _best_per_path(pidx)
alts = {}
for r in pidx:
    hl = {k: pth(v) for k, v in (r.get("hreflang") or {}).items()}
    for u in [pth(r["url"])] + list(hl.values()):
        alts.setdefault(u, {}).update(hl)


def alt_of(path, lang):
    """ruta equivalente en otro idioma por hreflang"""
    a = alts.get(path, {})
    for k, v in a.items():
        if k == lang or k.startswith(lang + "-") or k.startswith(lang + "_"):
            return v
    return None


# ----------------------------------------------------------------------------- [CATS]
def build_categories():
    es = rest_cat["es"]
    store_cat = {c["id"]: c for c in jl(RAW / "store/categories.es.json", [])}
    by_link = {l: {pth(c["link"]): c for c in rest_cat[l]} for l in LANGS}
    out = []
    for c in es:
        path = pth(c["link"])
        rec = {"id": c["id"], "parent": c["parent"], "count": c["count"], "slug": {"es": c["slug"]}, "name": {"es": htmllib.unescape(c["name"])},
               "path": {"es": path}, "description": {"es": blocks_from_html(c.get("description") or "")}, "legacy_ids": []}
        for l in ("en", "fr", "de"):
            ap = alt_of(path, l)
            t = by_link[l].get(ap) if ap else None
            if t:
                rec["slug"][l], rec["name"][l], rec["path"][l] = t["slug"], htmllib.unescape(t["name"]), pth(t["link"])
                rec["description"][l] = blocks_from_html(t.get("description") or "")
            else:
                rec["slug"][l] = rec["name"][l] = rec["path"][l] = None
        sim = (store_cat.get(c["id"], {}).get("image") or {}).get("src")
        rec["image"] = img_ref(sim) if sim else None
        yo = (c.get("yoast_head_json") or {})
        rec["seo"] = {"es": {"title": htmllib.unescape(yo.get("title") or "") or None, "description": htmllib.unescape(yo.get("description") or "") or None}}
        out.append(rec)
    return out


# ----------------------------------------------------------------------------- [PRODUCTS]
def blocks_pdfs(blocks):
    return [b for b in blocks if b["t"] == "btn" and b.get("pdf")]


def build_products(categories):
    cat_by_id = {c["id"]: c for c in categories}
    prods = []
    for pid, pm in pmap.items():
        e = store["es"][pid]
        rec = {"id": pid, "sku": e.get("sku") or None, "type": e["type"], "slug": {}, "path": {}, "name": {}, "short": {}, "description": {}, "seo": {}, "source_url": {}, "translation_status": {}}
        langs_present = ["es"] + [l for l in ("en", "fr", "de") if pm["translations"].get(l)]
        for l in LANGS:
            if l not in langs_present:
                rec["slug"][l] = rec["path"][l] = rec["name"][l] = rec["source_url"][l] = None
                rec["short"][l] = rec["description"][l] = None
                rec["translation_status"][l] = "missing"
                continue
            sid = pid if l == "es" else pm["translations"][l]["id"]
            s = store[l][sid]
            rec["slug"][l] = s["slug"]
            rec["path"][l] = pth(s["permalink"])
            rec["source_url"][l] = s["permalink"]
            rec["name"][l] = re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", "", s["name"]))).strip()
            rec["short"][l] = localize_blocks(blocks_from_html(s.get("short_description") or ""))
            rec["description"][l] = localize_blocks(blocks_from_html(s.get("description") or ""))
            y = (rest_prod[l].get(sid, {}).get("yoast_head_json") or {})
            rec["seo"][l] = {"title": htmllib.unescape(y.get("title") or "") or None, "description": htmllib.unescape(y.get("description") or "") or None}
        # estado de traducción respecto a ES
        es_txt = text_of(rec["short"]["es"] + rec["description"]["es"])
        es_tab = sum(1 for b in rec["description"]["es"] if b["t"] == "table")
        for l in ("en", "fr", "de"):
            if rec["name"][l] is None:
                continue
            t = text_of(rec["short"][l] + rec["description"][l])
            tabs = sum(1 for b in rec["description"][l] if b["t"] == "table")
            ratio = len(t) / max(1, len(es_txt))
            same = difflib.SequenceMatcher(None, es_txt[:1500], t[:1500]).quick_ratio() > 0.92 and len(es_txt) > 80
            st = "identical_to_es" if same else ("partial" if (ratio < 0.6 or tabs < es_tab) else "ok")
            rec["translation_status"][l] = st
        rec["translation_status"]["es"] = "ok"
        # imágenes (galería de la API) con alt por idioma
        imgs = []
        for i, im in enumerate(e["images"]):
            r = img_ref(im["src"]) or {}
            alt = {l: None for l in LANGS}
            alt["es"] = clean_alt(im.get("alt") or im.get("name"))
            for l in ("en", "fr", "de"):
                if pm["translations"].get(l):
                    ims = store[l][pm["translations"][l]["id"]]["images"]
                    if i < len(ims): alt[l] = clean_alt(ims[i].get("alt") or ims[i].get("name"))
            imgs.append({**r, "alt": alt, "id": im.get("id")})
        rec["images"] = imgs
        rec["category_ids"] = [c["id"] for c in e["categories"]]
        rec["attributes"] = [{"name": a["name"], "values": [t["name"] for t in a["terms"]]} for a in e.get("attributes", [])]
        # PDFs: botones de descarga en descripción + enlaces de la página renderizada
        pdfs = {}
        for b in blocks_pdfs(rec["description"]["es"] + rec["short"]["es"]):
            pdfs[b["href"]] = {"url": b["href"], "label": {"es": b["x"]}}
        pg = by_url.get(rec["path"]["es"])
        if pg:
            for u in pg.get("pdf_links") or []:
                pdfs.setdefault(u, {"url": u, "label": {"es": None}})
        rec["pdfs"] = list(pdfs.values())
        rec["voltage_tags"] = []          # lo rellena enrich_catalog.py
        rec["variants"] = []              # idem (referencias pedibles)
        rec["power"] = None
        rec["related"] = []
        prods.append(rec)
    # relacionados: mismos categoría hoja, hasta 3 (como "Explora productos similares")
    by_cat = defaultdict(list)
    for p in prods:
        for c in p["category_ids"]:
            by_cat[c].append(p["id"])
    for p in prods:
        rel = []
        for c in sorted(p["category_ids"], key=lambda c: len(by_cat[c])):
            for q in by_cat[c]:
                if q != p["id"] and q not in rel:
                    rel.append(q)
        p["related"] = rel[:3]
    return prods


# ----------------------------------------------------------------------------- [PAGES]
def section_backgrounds(elementor_id, html):
    """mapa data-id de sección -> imagen de fondo, leyendo el CSS post-<id>.css de Elementor"""
    css = fetch(f"{BASE}/wp-content/uploads/elementor/css/post-{elementor_id}.css", RAW / "css" / f"post-{elementor_id}.css")
    out = {}
    for m in re.finditer(r"\.elementor-element\.elementor-element-([0-9a-f]{7})[^{]*\{[^}]*background-image:\s*url\(\s*[\"']?([^\"')]+)", css):
        out.setdefault(m.group(1), m.group(2))
    return out


def page_blocks(path):
    """Devuelve dict con secciones del contenido principal (Elementor) convertidas a bloques, sin plantillas globales."""
    rec = by_url.get(path)
    if not rec:
        return None
    html = Path(ROOT / rec["file"]).read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")
    main = soup.find(attrs={"data-elementor-type": re.compile("wp-page|wp-post|single")}) or soup.find("main") or soup.body
    eid = main.get("data-elementor-id")
    bgs = section_backgrounds(eid, html) if eid else {}
    tops = [t for t in main.find_all(True) if t.get("data-element_type") in ("section", "container") and not t.find_parent(attrs={"data-element_type": re.compile("section|container")})]
    sections = []
    for t in (tops or [main]):
        has_form = bool(t.find(class_=re.compile("wpforms")) or t.find("form"))
        if has_form:  # el formulario de WPForms se sustituye por el propio del sitio; los textos de la sección se conservan
            for f in t.find_all(class_=re.compile("wpforms")):
                f.decompose()
            for f in t.find_all("form"):
                f.decompose()
        bl = [b for b in localize_blocks(blocks_from(t)) if not (b["t"] == "p" and re.match(r"^\s*[.#][\w-]+\s*$", re.sub(r"<[^>]+>", "", b["h"])))]
        bg = bgs.get(t.get("data-id"))
        sections.append({"id": t.get("data-id"), "form": has_form, "blocks": bl, "bg": img_ref(bg) if bg else None})
    return {"elementor_id": eid, "sections": sections}


def services_cards(section_html_root):
    """tarjetas de categorías de la home: enlaces a categoria-producto con título e icono"""
    out = []
    for a in section_html_root.find_all("a", href=re.compile(r"/categoria-producto/|/product-category/|/categorie-produit/|/produktkategorie/")):
        title = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        im = a.find("img")
        icon = (im.get("data-src") or im.get("src")) if im else None
        if title and icon and not icon.startswith("data:"):
            out.append({"title": title, "href": a["href"], "icon": img_ref(icon)})
    seen, res = set(), []
    for c in out:
        if c["href"] not in seen:
            seen.add(c["href"]); res.append(c)
    return res


def build_pages():
    pages = {l: {} for l in LANGS}
    kinds = {}
    for p, r in by_url.items():
        b = r["body_classes"]
        l = lang_of_path(p)  # el idioma sale de la RUTA canónica, no del fichero (hay ES publicados también bajo /en/)
        if "single-product" in b or "tax-product_cat" in b or "tax-product_tag" in b:
            continue
        if "woocommerce-cart" in b or "woocommerce-account" in b or "/carrito" in p or "/mi-cuenta" in p or "/my-account" in p or "/shop" in p or "/tienda" in p or "/cart" in p or "/panier" in p or "/warenkorb" in p:
            kinds[p] = ("utility", l, r); continue
        if "single-post" in b: k = "post"
        elif "home" in b or p in ("/", "/en/", "/fr/", "/de/"): k = "home"
        elif "page" in b: k = "page"
        else: continue
        kinds[p] = (k, l, r)
    for p, (k, l, r) in kinds.items():
        if k == "utility":
            continue
        content = page_blocks(p)
        rec = {"kind": k, "lang": l, "path": p, "title": htmllib.unescape(r["title"] or ""), "meta_description": htmllib.unescape(r["meta_description"] or ""), "alternates": {x: alt_of(p, x) for x in LANGS if x != l and alt_of(p, x)},
               "source_url": r["url"], **(content or {"sections": []})}
        if k == "home":
            html = Path(ROOT / r["file"]).read_text(errors="replace")
            soup = BeautifulSoup(html, "lxml")
            rec["services"] = services_cards(soup)
        pages[l][p] = rec
    # entradas del blog: fecha, imagen destacada, extracto desde REST
    for l in LANGS:
        for po in rest_posts[l]:
            p = pth(po["link"])
            if p in pages[l]:
                y = po.get("yoast_head_json") or {}
                og = (y.get("og_image") or [{}])[0].get("url")
                pages[l][p].update({"date": po.get("date"), "modified": po.get("modified"), "wp_id": po["id"], "featured": img_ref(og) if og else None,
                                    "excerpt": re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", "", po.get("excerpt", {}).get("rendered", "")))).strip(), "title": htmllib.unescape(re.sub(r"<[^>]+>", "", po["title"]["rendered"]))})
    return pages


# ----------------------------------------------------------------------------- [SITE] menús, pie, datos de empresa
def build_site():
    nav, foot = {}, {}
    for l, f in [("es", "home"), ("en", "en"), ("fr", "fr"), ("de", "de")]:
        s = BeautifulSoup((RAW / "html" / l / f"{f}.html").read_text(errors="replace"), "lxml")
        hdr = s.find("header") or s.find(class_=re.compile("elementor-location-header"))
        items, seen = [], set()
        for a in hdr.find_all("a", href=True):
            t = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
            if t and a["href"] not in seen and t not in ("English", "Français", "Español", "Deutsch"):
                seen.add(a["href"]); items.append({"label": t, "href": a["href"]})
        nav[l] = items
        ft = s.find("footer") or s.find(class_=re.compile("elementor-location-footer"))
        lines = [x for x in ft.get_text("\n", strip=True).split("\n") if x]
        links = [{"label": re.sub(r"\s+", " ", a.get_text(" ", strip=True)), "href": a["href"]} for a in ft.find_all("a", href=True) if "santisomarketing" not in a["href"]]
        foot[l] = {"lines": lines[:14], "links": links[:6], "funding_text": next((x for x in lines if "ICEX" in x or "FEDER" in x), None)}
    return nav, foot


def main():
    cats = build_categories()
    prods = build_products(cats)
    pages = build_pages()
    nav, foot = build_site()
    (CAT / "categories.json").write_text(json.dumps(cats, ensure_ascii=False, indent=1))
    (CAT / "products.json").write_text(json.dumps(prods, ensure_ascii=False, indent=1))
    (CAT / "pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=1))
    meta = {
        "name": "Torivac", "legal_name": "Torivac S.L.", "price_mode": "demo", "currency": "EUR",
        "languages": [{"code": l, "prefix": "" if l == "es" else f"/{l}", "label": {"es": "Español", "en": "English", "fr": "Français", "de": "Deutsch"}[l]} for l in LANGS],
        "contact": {"address": ["C/ Potosi Nº 2, Planta 6ª", "08030 Barcelona"], "phone": "+34 93 312 01 61", "email": "info@torivac.com"},
        "order_recipients": {"to": ["info@torivac.com", "mzamora@torivac.com"], "status": "POR CONFIRMAR: la web muestra info@torivac.com; el dictado decía grupotoriback.com / toriback.com"},
        "nav": nav, "footer": foot,
        "catalogs": {"es": "Torivac_2024.pdf", "en": "Torivac_2024_EN.pdf", "fr": "Torivac_2024_FR.pdf", "de": "catalogue-torivac-DE.pdf"},
        "generated_by": "scripts/build_catalog.py",
    }
    (CAT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    miss = sum(1 for p in prods for i in p["images"] if i.get("missing_local"))
    print(f"categorías {len(cats)} | productos {len(prods)} | páginas {[(l, len(v)) for l, v in pages.items()]} | imágenes de producto sin copia local: {miss}")
    st = defaultdict(int)
    for p in prods:
        for l in ("en", "fr", "de"):
            st[(l, p["translation_status"][l])] += 1
    print("estado de traducciones:", dict(sorted(st.items())))


if __name__ == "__main__":
    main()
