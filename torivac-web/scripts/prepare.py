#!/usr/bin/env python3
"""Sesión 1 · Preparación determinista para el análisis.

  python3 -I scripts/prepare.py            # todo
  python3 -I scripts/prepare.py pages      # solo HTML -> JSON limpio
  python3 -I scripts/prepare.py pdf        # solo PDF -> texto por página

Salida (data/analysis/):
  pages/<lang>/<slug>.json   título, metas, hreflang (mapa de traducciones), encabezados, texto, enlaces, imágenes, json-ld, formularios
  pages-index.json           índice de todas las páginas + mapa de traducciones por hreflang
  pdf-text/<stem>/pNNN.txt   texto por página (pdftotext -layout)
  pdf-index.json             PDFs únicos: páginas, texto, páginas "sin texto" (necesitan lectura visual), duplicados por sha256
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "analysis"
BASE = "https://grupotorivac.com"
LANGS = ["es", "en", "fr", "de"]


def clean(s):
    """Colapsa espacios y líneas vacías repetidas de un texto y lo recorta."""
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\n\s*\n+", "\n\n", s or "")).strip()


def lang_of(url):
    """Idioma de una URL por su prefijo de ruta (en, fr, de); es si no lleva ninguno."""
    m = re.match(r"^/(en|fr|de)(/|$)", urlparse(url).path)
    return m.group(1) if m else "es"


def parse_page(path: Path, lang: str):
    """Extrae de un HTML de data/raw/html título, metas, hreflang, encabezados, texto, tablas, enlaces, imágenes y formularios (dict)."""
    html = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")
    meta = lambda **kw: (soup.find("meta", attrs=kw) or {}).get("content")
    canon = (soup.find("link", rel="canonical") or {}).get("href")
    hreflang = {}
    for l in soup.find_all("link", rel="alternate"):
        if l.get("hreflang"):
            hreflang[l["hreflang"]] = l.get("href")
    jsonld = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            jsonld.append(json.loads(s.string or "{}"))
        except Exception:
            pass
    # body_classes ayuda a distinguir plantilla (home, single-product, tax-product_cat, ...)
    body_classes = (soup.body.get("class") if soup.body else []) or []
    # menús (antes de eliminar nav/header)
    menus = []
    for nav in soup.find_all(["nav"]):
        items = [{"text": clean(a.get_text(" ")), "href": urljoin(BASE, a.get("href", ""))}
                 for a in nav.find_all("a", href=True) if clean(a.get_text(" "))]
        if items:
            menus.append({"aria": nav.get("aria-label") or nav.get("class"), "items": items[:80]})
    forms = []
    for f in soup.find_all("form"):
        forms.append({
            "action": f.get("action"), "method": f.get("method"), "id": f.get("id"), "class": f.get("class"),
            "fields": [{"name": i.get("name"), "type": i.get("type") or i.name, "placeholder": i.get("placeholder"),
                        "required": i.has_attr("required")} for i in f.find_all(["input", "select", "textarea"]) if i.get("type") not in ("hidden", "submit")],
        })
    tracking = sorted(set(re.findall(r"(G-[A-Z0-9]{6,}|GTM-[A-Z0-9]+|UA-\d+-\d+|AW-\d+|fbq\(.init.,\s*.(\d+))", html)[:0]))  # se rellena abajo
    tracking = sorted(set(m.group(0) for m in re.finditer(r"\b(G-[A-Z0-9]{8,12}|GTM-[A-Z0-9]{5,8}|UA-\d{4,10}-\d+|AW-\d{6,12})\b", html)))
    for t in soup(["script", "style", "noscript", "svg", "template"]):
        t.decompose()
    main = soup.find(attrs={"data-elementor-type": re.compile("wp-page|single|product|archive|wp-post")}) \
        or soup.find("main") or soup.find(id="content") or soup.body or soup
    for sel in ("header", "footer", "nav"):
        for t in main.find_all(sel):
            t.decompose()
    outline = [{"level": int(h.name[1]), "text": clean(h.get_text(" "))} for h in main.find_all(re.compile(r"^h[1-6]$")) if clean(h.get_text(" "))]
    # tablas -> filas de texto
    tables = []
    for t in main.find_all("table"):
        rows = [[clean(c.get_text(" ")) for c in r.find_all(["th", "td"])] for r in t.find_all("tr")]
        rows = [r for r in rows if any(r)]
        if rows:
            tables.append(rows)
    links = []
    for a in main.find_all("a", href=True):
        h = urljoin(BASE, a["href"])
        links.append({"text": clean(a.get_text(" "))[:120], "href": h})
    imgs = []
    for im in main.find_all("img"):
        src = im.get("data-src") or im.get("data-lazy-src") or im.get("src")
        if src and not src.startswith("data:"):
            imgs.append({"src": urljoin(BASE, src), "alt": im.get("alt") or ""})
    text = clean(main.get_text("\n"))
    return {
        "file": str(path.relative_to(ROOT)), "lang": lang, "url": canon,
        "title": clean(soup.title.get_text()) if soup.title else None,
        "meta_description": meta(name="description"), "og_title": meta(property="og:title"),
        "og_image": meta(property="og:image"), "robots": meta(name="robots"),
        "hreflang": hreflang, "body_classes": body_classes, "outline": outline, "text": text,
        "text_chars": len(text), "tables": tables, "links": links, "pdf_links": sorted({l["href"] for l in links if l["href"].lower().split("?")[0].endswith(".pdf")}),
        "images": imgs, "forms": forms, "menus": menus[:6], "tracking_ids": tracking, "json_ld_types": [j.get("@type") if isinstance(j, dict) else None for j in jsonld],
    }


def do_pages():
    """Convierte los HTML de data/raw/html en JSON limpio (data/analysis/pages) y escribe pages-index.json con los grupos de traducción."""
    (OUT / "pages").mkdir(parents=True, exist_ok=True)
    index = []
    for lang in LANGS:
        d = RAW / "html" / lang
        if not d.exists():
            continue
        (OUT / "pages" / lang).mkdir(parents=True, exist_ok=True)
        for f in sorted(d.glob("*.html")):
            try:
                rec = parse_page(f, lang)
            except Exception as e:  # una página rota no debe parar el lote
                print("FAIL", f, e)
                continue
            (OUT / "pages" / lang / (f.stem + ".json")).write_text(json.dumps(rec, ensure_ascii=False, indent=1))
            index.append({k: rec[k] for k in ("file", "lang", "url", "title", "meta_description", "hreflang", "body_classes", "text_chars", "pdf_links", "tracking_ids")} | {"json": f"data/analysis/pages/{lang}/{f.stem}.json"})
    # mapa de traducciones por hreflang (agrupa por conjunto de URLs alternativas)
    groups = {}
    for r in index:
        key = tuple(sorted((r["hreflang"] or {}).items())) or (("self", r["url"]),)
        groups.setdefault(key, []).append(r["json"])
    (OUT / "pages-index.json").write_text(json.dumps({"count": len(index), "pages": index, "translation_groups": [{"alternates": dict(k), "files": v} for k, v in groups.items()]}, ensure_ascii=False, indent=1))
    print("pages:", len(index), "| grupos de traducción:", len(groups))


def do_media():
    """Índice compacto de la mediateca (los media.*.json en bruto pesan 10 MB y son idénticos entre idiomas)."""
    src = RAW / "rest" / "media.es.json"
    if not src.exists():
        print("sin media.es.json")
        return
    items = json.loads(src.read_text())
    slim = []
    for m in items:
        md = m.get("media_details") or {}
        slim.append({"id": m.get("id"), "date": m.get("date"), "slug": m.get("slug"), "mime": m.get("mime_type"), "url": m.get("source_url"),
                     "title": (m.get("title") or {}).get("rendered"), "alt": m.get("alt_text"), "caption": re.sub(r"<[^>]+>", "", (m.get("caption") or {}).get("rendered") or "").strip() or None,
                     "attached_to": m.get("post"), "w": md.get("width"), "h": md.get("height"), "bytes": md.get("filesize")})
    (OUT / "media-index.json").write_text(json.dumps({"count": len(slim), "by_mime": {k: sum(1 for x in slim if x["mime"] == k) for k in sorted({x["mime"] for x in slim if x["mime"]})}, "items": slim}, ensure_ascii=False))
    print("media:", len(slim))


def sh(*a):
    """Ejecuta el comando (con sus argumentos) y devuelve su salida estándar como texto, sin comprobar el código de salida."""
    return subprocess.run(a, capture_output=True, text=True, errors="replace").stdout


def do_pdf():
    """Incremental: no reescribe lo ya procesado (los agentes lo están leyendo); añade solo PDFs nuevos y guarda el índice de forma atómica."""
    pdfdir = RAW / "pdf"
    (OUT / "pdf-text").mkdir(parents=True, exist_ok=True)
    idx_path = OUT / "pdf-index.json"
    index = json.loads(idx_path.read_text())["pdfs"] if idx_path.exists() else []
    seen = {r["sha256"]: r for r in index}
    known = {r["file"] for r in index} | {d for r in index for d in r.get("duplicates", [])}
    new = 0
    for f in sorted(pdfdir.glob("*.pdf")):
        if f.name in known:
            continue
        sha = hashlib.sha256(f.read_bytes()).hexdigest()
        if sha in seen:
            seen[sha].setdefault("duplicates", []).append(f.name)
            continue
        info = sh("pdfinfo", str(f))
        pages = int((re.search(r"Pages:\s+(\d+)", info) or [0, 0])[1])
        title = (re.search(r"Title:\s+(.*)", info) or [None, None])[1]
        stem = re.sub(r"[^\w\-]+", "_", f.stem)
        d = OUT / "pdf-text" / stem
        d.mkdir(parents=True, exist_ok=True)
        low, total = [], 0
        for p in range(1, pages + 1):
            t = sh("pdftotext", "-layout", "-f", str(p), "-l", str(p), str(f), "-")
            (d / f"p{p:03d}.txt").write_text(t)
            total += len(t.strip())
            if len(t.strip()) < 60:
                low.append(p)
        rec = {"file": f.name, "stem": stem, "sha256": sha, "bytes": f.stat().st_size, "pages": pages, "title": title,
               "text_chars": total, "low_text_pages": low, "needs_visual_read": len(low) > 0, "duplicates": [], "text_dir": f"data/analysis/pdf-text/{stem}"}
        seen[sha] = rec
        index.append(rec)
        new += 1
        print(f"NUEVO {f.name}: {pages} págs, {total} chars, sin texto: {low[:10]}")
    tmp = idx_path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"count": len(index), "pdfs": index}, ensure_ascii=False, indent=1))
    tmp.replace(idx_path)
    print("PDFs únicos:", len(index), "| nuevos:", new)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    OUT.mkdir(parents=True, exist_ok=True)
    if what in ("all", "pages"):
        do_pages()
    if what in ("all", "pdf"):
        do_pdf()
    if what in ("all", "media"):
        do_media()
