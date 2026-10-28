#!/usr/bin/env python3
"""Sesión 2 · Mapa de traducciones según WPML (sondeo de solo lectura: GET sin seguir redirecciones).

OJO: WPML es el plugin de la web ORIGINAL (grupotorivac.com). La web nueva NO usa WPML ni ningún plugin de idioma: es HTML estático con su
propio selector y su propia detección de idioma (site/assets/js/app.js). Esta herramienta solo LEE las redirecciones públicas de WPML para
saber qué página es traducción de cuál al migrar el contenido; no forma parte de la web entregada.


  python3 -I scripts/wpml_probe.py            # sondea categorías y fichas sin traducción; escribe data/analysis/wpml-probe.json
  python3 -I scripts/wpml_probe.py --compare  # además compara con data/catalog/categories.json y lista discrepancias

Idea: WPML redirige la URL de un contenido en un idioma que NO existe hacia la traducción real (o hacia el original si no hay traducción).
  GET https://grupotorivac.com/<lang><ruta-ES-de-la-categoría>
    200            → existe un término en ese idioma con el mismo slug (WPML lo duplicó, suele ser una categoría vacía)
    301 → /<lang>/categoria-producto/<slug-traducido>/   → ESA es la traducción según WPML
    302 → /<lang>/product/<slug>/                         → categoría de una sola ficha: WPML salta a la ficha traducida
    302/301 → URL sin prefijo de idioma (español)         → NO hay traducción publicada
Es el mismo mecanismo que usa el selector de idioma de la web original, así que es la fuente más fiable (mejor que hreflang o co-ocurrencias).
Solo lecturas GET de URLs públicas; nada se modifica en la web original.
"""
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT, AN = ROOT / "data" / "catalog", ROOT / "data" / "analysis"
BASE = "https://grupotorivac.com"
LANGS = ["en", "fr", "de"]


def probe(url):
    """GET sin seguir redirecciones → (código, destino)."""
    for _ in range(3):
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", "--max-time", "25", url], capture_output=True, text=True)
        out = r.stdout.strip().split(" ", 1)
        if out and out[0].isdigit() and out[0] != "000":
            return int(out[0]), (out[1] if len(out) > 1 else "")
        time.sleep(1.5)
    return 0, ""


def classify(lang, code, dest):
    """Clasifica un sondeo WPML: same_slug (200), product/category (redirige a la traducción), no_translation o http_<código>."""
    if code == 200:
        return "same_slug"
    if code in (301, 302, 307, 308):
        path = dest.replace(BASE, "")
        if not path.startswith(f"/{lang}/"):
            return "no_translation"                         # vuelve al español (o a otro idioma)
        return "product" if path.startswith(f"/{lang}/product/") else "category"
    return f"http_{code}"


def main():
    """Sondea la URL de cada categoría en en/fr/de, guarda wpml-probe.json y, con --compare, lista las discrepancias."""
    cats = json.loads((CAT / "categories.json").read_text())
    jobs = [(c["id"], l, f"{BASE}/{l}{c['path']['es']}") for c in cats for l in LANGS]
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(lambda j: (j, probe(j[2])), jobs))
    out = {}
    for (cid, lang, url), (code, dest) in results:
        out.setdefault(str(cid), {})[lang] = {"probe": url.replace(BASE, ""), "http": code, "to": dest.replace(BASE, ""), "kind": classify(lang, code, dest)}
    (AN / "wpml-probe.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    kinds = {}
    for v in out.values():
        for d in v.values():
            kinds[d["kind"]] = kinds.get(d["kind"], 0) + 1
    print("sondeos:", len(results), kinds)
    if "--compare" in sys.argv:
        compare(cats, out)


def compare(cats, probe_out):
    """Discrepancias entre el mapa actual (hreflang + co-ocurrencia) y lo que dice WPML."""
    n = 0
    for c in cats:
        for l in LANGS:
            p = probe_out[str(c["id"])][l]
            cur = (c.get("path") or {}).get(l)
            if p["kind"] == "category" and p["to"].rstrip("/") != (cur or "").rstrip("/"):
                n += 1
                print(f"[{c['id']}] {c['name']['es']} · {l}: actual={cur} · WPML={p['to']}")
    print("discrepancias de categoría:", n)


if __name__ == "__main__":
    main()
