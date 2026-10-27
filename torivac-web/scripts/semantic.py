#!/usr/bin/env python3
"""Conversor HTML (WordPress/Elementor/WooCommerce) -> bloques semánticos limpios.

Biblioteca (la usa build_catalog.py) y pequeña CLI de prueba:
    python3 -I scripts/semantic.py data/raw/html/es/home.html

Bloques de salida (siempre dicts JSON):
  {"t":"h","l":2,"x":"Texto"}                        encabezado
  {"t":"p","h":"HTML inline seguro"}                 párrafo (solo a, strong, em, b, i, br, sup, sub, u)
  {"t":"ul","o":false,"i":["HTML inline",...]}       lista (o=true => numerada)
  {"t":"table","cap":"..","rows":[[{"x":"..","th":true}]]}
  {"t":"img","src":"abs url","alt":"","href":null,"w":0,"h":0}
  {"t":"btn","x":"Texto","href":"abs url","pdf":false}
  {"t":"embed","src":"url"}                          iframe (vídeo/mapa)
  {"t":"hr"}
Etiquetas: [BLOQUES] = definición; [WALK] = recorrido; [INLINE] = sanitizado inline.
"""
import json
import re
import sys
from urllib.parse import urljoin

from bs4 import BeautifulSoup, NavigableString, Tag

BASE = "https://grupotorivac.com"
BLOCK_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "table", "img", "picture", "figure", "iframe", "hr", "blockquote", "video"}
DROP = {"script", "style", "noscript", "template", "form", "svg", "button", "input", "select", "textarea", "nav"}
DROP_CLASS = re.compile(r"elementor-widget-(spacer|social-icons|share-buttons|breadcrumbs|woocommerce-|loop-|ekit-nav|ekit-header|nav-menu)|elementor-divider|swiper-pagination|swiper-button|cmplz|grecaptcha|screen-reader-text|skip-link|sr-only|woocommerce-product-gallery__trigger|onsale")
INLINE_OK = {"a", "strong", "b", "em", "i", "br", "sup", "sub", "u", "span"}


def _abs(u):
    return urljoin(BASE + "/", (u or "").strip().replace("&amp;", "&")) if u else u


def _clean(s):
    return re.sub(r"[ \t\r\f\v ]+", " ", s or "").strip()


# [INLINE] sanitiza un nodo en HTML inline seguro (conserva enlaces y énfasis)
def inline_html(node):
    out = []
    def walk(n):
        if isinstance(n, NavigableString):
            t = str(n)
            out.append(t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            return
        if not isinstance(n, Tag) or n.name in DROP:
            return
        if n.name == "br":
            out.append("<br>")
        elif n.name == "a" and n.get("href") and not n.get("href").startswith(("javascript:", "#")):
            out.append(f'<a href="{_abs(n["href"])}">')
            for c in n.children: walk(c)
            out.append("</a>")
        elif n.name in ("strong", "b", "em", "i", "sup", "sub", "u"):
            out.append(f"<{n.name}>")
            for c in n.children: walk(c)
            out.append(f"</{n.name}>")
        else:  # span y cualquier otro: se desenvuelve
            for c in n.children: walk(c)
    walk(node)
    h = "".join(out)
    h = re.sub(r"(<br>\s*){3,}", "<br><br>", h)
    h = re.sub(r"^(\s|<br>)+|(\s|<br>)+$", "", h)
    return re.sub(r"[ \t\r\f\v ]+", " ", h).strip()


def _img_block(im):
    src = im.get("data-src") or im.get("data-lazy-src") or im.get("data-orig-src") or im.get("src") or ""
    if not src or src.startswith("data:"):
        ss = im.get("data-srcset") or im.get("srcset") or ""
        src = ss.split(",")[-1].strip().split(" ")[0] if ss else ""
    if not src or src.startswith("data:"):
        return None
    return {"t": "img", "src": _abs(src.split("?")[0]), "alt": _clean(im.get("alt")), "href": None, "w": int(im.get("width") or 0) if str(im.get("width") or "").isdigit() else 0, "h": int(im.get("height") or 0) if str(im.get("height") or "").isdigit() else 0}


def _table(t):
    rows = []
    cap = t.find("caption")
    for tr in t.find_all("tr"):
        cells = [{"x": _clean(c.get_text(" ", strip=True)), "th": c.name == "th"} for c in tr.find_all(["th", "td"])]
        if any(c["x"] for c in cells):
            rows.append(cells)
    return {"t": "table", "cap": _clean(cap.get_text(" ")) if cap else "", "rows": rows} if rows else None


def _is_button(a):
    cls = " ".join(a.get("class", []))
    return bool(re.search(r"elementor-button|ekit-btn|ekit_btn|btn\b|button\b|wp-block-button", cls))


# [WALK] recorre en orden de documento y emite bloques
def blocks_from(root):
    blocks = []
    pending = []  # nodos inline sueltos que forman un párrafo

    def flush():
        nonlocal pending
        if pending:
            wrap = BeautifulSoup("<div></div>", "lxml").div
            for n in pending:
                wrap.append(n.__copy__() if hasattr(n, "__copy__") else n)
            h = inline_html(wrap)
            if re.sub(r"<[^>]+>|\s|&nbsp;", "", h):
                blocks.append({"t": "p", "h": h})
            pending = []

    def visit(n):
        if isinstance(n, NavigableString):
            if str(n).strip():
                pending.append(n)
            return
        if not isinstance(n, Tag):
            return
        name = n.name
        cls = " ".join(n.get("class", []))
        if name in DROP or (cls and DROP_CLASS.search(cls)) or n.get("aria-hidden") == "true" and name != "a":
            return
        if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            flush()
            x = _clean(n.get_text(" ", strip=True))
            if x:
                blocks.append({"t": "h", "l": int(name[1]), "x": x})
        elif name == "p":
            flush()
            if n.find("img") and not _clean(n.get_text()):
                for im in n.find_all("img"):
                    b = _img_block(im)
                    if b: blocks.append(b)
                return
            h = inline_html(n)
            if re.sub(r"<[^>]+>|\s|&nbsp;", "", h):
                blocks.append({"t": "p", "h": h})
        elif name in ("ul", "ol"):
            flush()
            items = [inline_html(li) for li in n.find_all("li", recursive=False)] or [inline_html(li) for li in n.find_all("li")]
            items = [i for i in items if re.sub(r"<[^>]+>|\s", "", i)]
            if items:
                blocks.append({"t": "ul", "o": name == "ol", "i": items})
        elif name == "table":
            flush()
            b = _table(n)
            if b: blocks.append(b)
        elif name in ("img",):
            flush()
            b = _img_block(n)
            if b:
                a = n.find_parent("a")
                if a and a.get("href") and not _is_button(a):
                    b["href"] = _abs(a["href"])
                blocks.append(b)
        elif name == "picture":
            flush()
            im = n.find("img")
            b = _img_block(im) if im else None
            if b: blocks.append(b)
        elif name == "iframe":
            flush()
            if n.get("src") or n.get("data-src") or n.get("data-lazy-src"):
                blocks.append({"t": "embed", "src": _abs(n.get("src") or n.get("data-src") or n.get("data-lazy-src"))})
        elif name == "hr":
            flush()
            blocks.append({"t": "hr"})
        elif name == "blockquote":
            flush()
            h = inline_html(n)
            if h: blocks.append({"t": "p", "h": h, "q": True})
        elif name == "a" and n.get("href") and (_is_button(n) or n.get("href", "").lower().split("?")[0].endswith(".pdf")) and not n.find("img"):
            flush()
            x = _clean(n.get_text(" ", strip=True))
            if x:
                href = _abs(n["href"])
                blocks.append({"t": "btn", "x": x, "href": href, "pdf": href.lower().split("?")[0].endswith(".pdf")})
        elif name == "a" and n.find("img") and not n.find(re.compile("^h[1-6]$")):
            flush()
            for im in n.find_all("img"):
                b = _img_block(im)
                if b:
                    if n.get("href") and not n["href"].startswith("#"):
                        b["href"] = _abs(n["href"])
                    blocks.append(b)
        elif name in INLINE_OK:
            pending.append(n)
        else:  # contenedores: recursión
            flush()
            for c in list(n.children):
                visit(c)
            flush()

    visit(root)
    flush()
    return _dedupe(blocks)


# quita imágenes duplicadas consecutivas (los carruseles Swiper repiten slides) y bloques vacíos
def _dedupe(blocks):
    out, seen_img = [], set()
    for b in blocks:
        if b["t"] == "img":
            if b["src"] in seen_img:
                continue
            seen_img.add(b["src"])
        if out and out[-1] == b:
            continue
        out.append(b)
    return out


def blocks_from_html(html):
    soup = BeautifulSoup(html or "", "lxml")
    return blocks_from(soup.body or soup)


# [WALK] secciones de primer nivel de Elementor -> lista de listas de bloques
def elementor_sections(soup):
    main = soup.find(attrs={"data-elementor-type": re.compile("wp-page|wp-post|single")}) or soup.find("main") or soup.body
    tops = [t for t in main.find_all(True) if t.get("data-element_type") in ("section", "container") and t.parent is not None and not t.find_parent(attrs={"data-element_type": re.compile("section|container")})]
    return main, tops


if __name__ == "__main__":
    html = open(sys.argv[1], encoding="utf-8").read()
    soup = BeautifulSoup(html, "lxml")
    main, tops = elementor_sections(soup)
    print("secciones:", len(tops))
    for i, t in enumerate(tops):
        bl = blocks_from(t)
        print(f"--- sección {i} ({t.get('data-id')}) {len(bl)} bloques")
        for b in bl[:12]:
            print("  ", json.dumps(b, ensure_ascii=False)[:180])
