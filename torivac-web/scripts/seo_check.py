#!/usr/bin/env python3
"""Sesión 16 · Auditoría SEO/GEO/accesibilidad estática de un build con --base (equivalente al seo-check de Why Not, ampliado a 4 idiomas).

  node site/build.mjs --base=https://demo.torivac.example --out=/tmp/seo-dist
  python3 -I scripts/seo_check.py /tmp/seo-dist [--base=https://demo.torivac.example] [--verbose]

Por página indexable (se ignoran las redirecciones y las páginas noindex):
  H1 único · sin saltos de nivel · <title> 10-65 car. · meta description 50-160 car. (y no basura tipo «%») · canonical = URL propia ·
  hreflang recíproco (cada idioma enlaza al resto y todos se enlazan entre sí) · lang del <html> = idioma de la ruta ·
  Open Graph completo (title, description, image, url, locale) · todas las <img> con alt · JSON-LD válido con Organization+WebSite+WebPage ·
  BreadcrumbList en páginas interiores · títulos únicos por idioma
Global: enlaces internos sin 404 · sitemap con todas las páginas indexables · robots.txt con Sitemap · llms.txt y llms-full.txt.
Sale con código 1 si hay errores (los avisos no fallan).
"""
import json
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

LANGS = ("en", "fr", "de")


class Page(HTMLParser):
    """Extrae lo que importa de un HTML sin dependencias."""

    def __init__(self):
        """Inicializa el estado del analizador: idioma, título, metas, enlaces, encabezados, imágenes, anclas y bloques JSON-LD."""
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.title = ""
        self._in_title = False
        self.meta = {}
        self.links = []          # (rel, hreflang, href)
        self.headings = []       # (nivel, texto)
        self._h = None
        self.imgs = []           # (src, alt|None)
        self.anchors = []        # href
        self.ld = []
        self._in_ld = False
        self._ld_buf = ""
        self.refresh = None
        self.robots = ""
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        """Procesa una etiqueta de apertura: registra lang, metas, link, encabezados, imágenes, anclas y bloques JSON-LD."""
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            k = a.get("name") or a.get("property") or a.get("http-equiv")
            if k:
                self.meta[k.lower()] = a.get("content", "")
            if (a.get("http-equiv") or "").lower() == "refresh":
                self.refresh = a.get("content")
            if (a.get("name") or "").lower() == "robots":
                self.robots = a.get("content", "")
        elif tag == "link":
            self.links.append((a.get("rel", ""), a.get("hreflang"), a.get("href")))
        elif re.fullmatch(r"h[1-6]", tag):
            self._h = [int(a.get("aria-level") or tag[1]), ""]       # aria-level: el nivel «efectivo» para lectores de pantalla (ver headingOrder en templates.mjs)
        elif tag == "img":
            self.imgs.append((a.get("src"), a.get("alt")))
        elif tag == "a" and a.get("href"):
            self.anchors.append(a["href"])
        elif tag == "script":
            if a.get("type") == "application/ld+json":
                self._in_ld, self._ld_buf = True, ""
            else:
                self._skip += 1
        elif tag == "style":
            self._skip += 1

    def handle_endtag(self, tag):
        """Procesa una etiqueta de cierre: cierra el título, el encabezado (con su texto), el bloque JSON-LD o el script/style ignorado."""
        if tag == "title":
            self._in_title = False
        elif re.fullmatch(r"h[1-6]", tag) and self._h:
            self.headings.append((self._h[0], re.sub(r"\s+", " ", self._h[1]).strip()))
            self._h = None
        elif tag == "script":
            if self._in_ld:
                self.ld.append(self._ld_buf)
                self._in_ld = False
            elif self._skip:
                self._skip -= 1
        elif tag == "style" and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        """Acumula el texto en el título, en el bloque JSON-LD o en el encabezado abiertos (sin el texto de script/style)."""
        if self._in_title:
            self.title += data
        if self._in_ld:
            self._ld_buf += data
        elif self._h is not None and not self._skip:
            self._h[1] += data


def route_of(root, f):
    """Ruta lógica (por ejemplo /en/product/x/) de un index.html generado, relativa a la carpeta de salida `root`."""
    rel = "/" + str(f.relative_to(root)).replace("\\", "/")
    return rel[: -len("index.html")] if rel.endswith("/index.html") else rel


def lang_of(route):
    """Idioma de una ruta por su prefijo (en, fr, de); es si no lleva ninguno."""
    m = re.match(r"^/(en|fr|de)(/|$)", route)
    return m.group(1) if m else "es"


def main():
    """Audita la carpeta de un build estático (páginas, enlaces, sitemap, robots, llms) e imprime el informe; sale con 1 si hay errores."""
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], True) for a in sys.argv[1:] if a.startswith("--"))
    root = Path(args[0]).resolve()
    base = (opts.get("base") or "").rstrip("/")
    files = sorted(root.rglob("index.html"))
    pages, errors, warns = {}, defaultdict(list), defaultdict(list)

    def err(code, route, msg=""):
        """Registra un error de la auditoría con el código `code` para la ruta `route`."""
        errors[code].append(f"{route} {msg}".strip())

    def warn(code, route, msg=""):
        """Registra un aviso (no hace fallar la auditoría) con el código `code` para la ruta `route`."""
        warns[code].append(f"{route} {msg}".strip())

    for f in files:
        route = route_of(root, f)
        if route.startswith("/assets/") or route.startswith("/admin/"):
            continue
        p = Page()
        p.feed(f.read_text(encoding="utf-8", errors="ignore"))
        if p.refresh or "noindex" in p.robots.lower():
            pages[route] = None            # redirección o noindex: existe pero no se audita
            continue
        pages[route] = p
    index = {r: p for r, p in pages.items() if p}
    if not index:
        sys.exit(f"✗ no hay páginas HTML indexables en {root}")
    if not base:                                              # sin --base se deduce del canonical de la primera página
        canon = next((l[2] for l in next(iter(index.values())).links if l[0] == "canonical"), "")
        m = re.search(r"https?://[^\"']+", canon or "")
        base = urlparse(m.group(0)).scheme + "://" + urlparse(m.group(0)).netloc if m else ""

    titles = defaultdict(list)
    for route, p in index.items():
        lang = lang_of(route)
        # ---- html lang
        if p.lang != lang:
            err("html-lang", route, f"lang={p.lang!r}, debería ser {lang}")
        # ---- encabezados
        h1 = [h for h in p.headings if h[0] == 1]
        if len(h1) != 1:
            err("h1-unico", route, f"{len(h1)} H1")
        prev = 0
        for lvl, txt in p.headings:
            if prev and lvl > prev + 1:
                warn("salto-de-nivel", route, f"H{prev}→H{lvl} «{txt[:40]}»")
                break
            prev = lvl
        # ---- title / description
        t = re.sub(r"\s+", " ", p.title).strip()
        if not (10 <= len(t) <= 65):
            (err if not t else warn)("title-longitud", route, f"{len(t)} car.: «{t[:70]}»")
        titles[(lang, t)].append(route)
        d = (p.meta.get("description") or "").strip()
        if not d:
            err("description-falta", route)
        elif re.fullmatch(r"[\W\d_]{0,12}", d) or len(d) < 50:
            err("description-basura", route, f"«{d[:60]}»")
        elif len(d) > 160:
            warn("description-larga", route, f"{len(d)} car.")
        # ---- canonical / hreflang
        canon = [l for l in p.links if "canonical" in l[0]]
        self_url = base + route
        if base:
            if len(canon) != 1 or canon[0][2] != self_url:
                err("canonical", route, f"{[c[2] for c in canon]} ≠ {self_url}")
            alts = {l[1]: l[2] for l in p.links if "alternate" in l[0] and l[1]}
            if len(alts) > 1:
                if alts.get(lang) != self_url and not (lang == "es" and alts.get("es") == self_url):
                    err("hreflang-propio", route, f"{lang}→{alts.get(lang)}")
                for l2, href in alts.items():
                    if l2 == "x-default":
                        continue
                    tgt = pages.get(urlparse(href).path)
                    if tgt is None:
                        err("hreflang-destino", route, f"{l2}→{href} no existe o no es indexable")
                    elif tgt:
                        back = {l[1]: l[2] for l in tgt.links if "alternate" in l[0] and l[1]}
                        if back.get(lang) != self_url and not (lang == "es" and back.get("es") == self_url):
                            err("hreflang-reciproco", route, f"{l2} ({urlparse(href).path}) no devuelve el enlace a {lang}")
        # ---- Open Graph
        for k in ("og:title", "og:description", "og:image", "og:url", "og:locale"):
            if not p.meta.get(k):
                err("og-" + k.split(":")[1], route)
        # ---- imágenes
        sin_alt = [s for s, a in p.imgs if a is None]
        if sin_alt:
            err("img-sin-alt", route, f"{len(sin_alt)} <img> sin atributo alt: {sin_alt[:2]}")
        vacias = [s for s, a in p.imgs if a is not None and not a.strip()]
        if vacias and len(vacias) > 3:
            warn("img-alt-vacio", route, f"{len(vacias)} <img> con alt vacío (¿decorativas?)")
        # ---- JSON-LD
        if len(p.ld) != 1:
            err("jsonld-bloques", route, f"{len(p.ld)} bloques")
        else:
            try:
                g = json.loads(p.ld[0])
                types = {n.get("@type") for n in g.get("@graph", [])}
                for need in ("Organization", "WebSite"):
                    if need not in types:
                        err("jsonld-tipos", route, f"falta {need}")
                if not types & {"WebPage", "CollectionPage", "ContactPage", "AboutPage"}:
                    err("jsonld-tipos", route, "falta WebPage")
                if route.count("/") > 2 and not route.startswith("/product/") and "BreadcrumbList" not in types and route not in ("/en/", "/fr/", "/de/"):
                    pass
                if "/product/" in route and "Product" not in types:
                    err("jsonld-producto", route)
                ids = [n.get("@id") for n in g["@graph"]]
                if len(ids) != len(set(ids)):
                    err("jsonld-ids-repetidos", route)
            except Exception as e:
                err("jsonld-invalido", route, str(e))
        # ---- migas en páginas interiores
        if p.ld and route.strip("/").count("/") >= 1 and lang_of(route) == "es" or (lang != "es" and route.strip("/").count("/") >= 2):
            try:
                if "BreadcrumbList" not in {n.get("@type") for n in json.loads(p.ld[0])["@graph"]}:
                    warn("migas", route)
            except Exception:
                pass

    for (lang, t), routes in titles.items():
        if len(routes) > 1:
            warn("title-duplicado", f"[{lang}] «{t[:60]}»", f"{len(routes)} páginas: {routes[:3]}")

    # ---- enlaces internos
    broken = defaultdict(set)
    for route, p in index.items():
        for href in p.anchors:
            if re.match(r"^(#|mailto:|tel:|javascript:|data:|https?://|//)", href):
                continue
            u = urlparse(href)
            path = unquote(u.path)
            tgt = (Path(route).parent / path) if not path.startswith("/") else Path(path)
            tgt = Path(__import__("os").path.normpath(str(tgt)))
            rel = str(tgt).lstrip("/")
            fp = root / rel
            ok = fp.is_file() or (fp / "index.html").is_file()
            if not ok:
                broken[href].add(route)
    if broken:
        for href, routes in sorted(broken.items(), key=lambda kv: -len(kv[1]))[:30]:
            err("enlace-roto", href, f"desde {len(routes)} páginas, p. ej. {sorted(routes)[:2]}")

    # ---- sitemap / robots / llms
    sm = root / "sitemap.xml"
    if not sm.exists():
        err("sitemap", "sitemap.xml", "falta")
    else:
        locs = set(re.findall(r"<loc>([^<]+)</loc>", sm.read_text(encoding="utf-8")))
        locs = {l for l in locs if "/assets/" not in l}
        want = {base + r for r in index}
        if want - locs:
            err("sitemap-faltan", "sitemap.xml", f"{len(want - locs)} páginas indexables no están: {sorted(want - locs)[:3]}")
        if locs - want:
            err("sitemap-sobran", "sitemap.xml", f"{len(locs - want)} URLs que no son páginas indexables: {sorted(locs - want)[:3]}")
    rb = root / "robots.txt"
    if not rb.exists() or "Sitemap:" not in rb.read_text():
        err("robots", "robots.txt", "falta o sin Sitemap")
    for n in ("llms.txt", "llms-full.txt"):
        f = root / n
        if not f.exists() or not f.read_text(encoding="utf-8").startswith("#"):
            err(n, n, "falta o no empieza por «#»")

    # ---- informe
    print(f"{len(index)} páginas indexables auditadas · {sum(1 for v in pages.values() if v is None)} redirecciones/noindex · base {base}")
    for title, bag in (("ERRORES", errors), ("AVISOS", warns)):
        print(f"\n{title}: {sum(len(v) for v in bag.values())}")
        for code, items in sorted(bag.items(), key=lambda kv: -len(kv[1])):
            print(f"  [{code}] {len(items)}")
            for it in items[: (50 if opts.get('verbose') else 3)]:
                print(f"      · {it}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
