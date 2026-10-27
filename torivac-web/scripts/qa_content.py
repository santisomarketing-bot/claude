#!/usr/bin/env python3
"""[QA-CONTENT] ¿El demo contiene el mismo texto que la web original? (Sesión 10, control de contenido)

  python3 -I scripts/qa_content.py [--worst=25] [--lang=es]

Para cada página generada con equivalente en data/analysis/pages/<lang>/ compara el conjunto de palabras (≥5 letras):
  recall    = % de palabras del contenido principal ORIGINAL presentes en el demo (pérdida de contenido)
  precision = % de palabras del demo presentes en el original (contenido añadido; los textos de interfaz nuevos se esperan)
Del original se excluyen cabecera, pie, menús y bloques de plantilla (formulario de contacto, 'productos similares', barra lateral).
"""
import glob, html, json, re, sys
from pathlib import Path
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parent.parent
idx = json.loads((ROOT / "data/analysis/pages-index.json").read_text())["pages"]
worst = int((next((a for a in sys.argv if a.startswith("--worst=")), "--worst=25")).split("=")[1])
only = next((a.split("=")[1] for a in sys.argv if a.startswith("--lang=")), None)
STOP = re.compile(r"^(https?|www)")
def words(t): return {w for w in re.findall(r"[a-záéíóúñüçàâêèëîïôûäöß]{5,}", t.lower()) if not STOP.match(w)}
def dist_file(path):
    p = ROOT / "dist" / path.strip("/") / "index.html"
    return p if p.exists() else None
def mine(f):
    h = f.read_text(encoding="utf-8")
    m = re.search(r"<main[^>]*>(.*)</main>", h, re.S)
    h = m.group(1) if m else h
    h = re.sub(r"(?is)<(script|style|aside|nav|form)\b.*?</\1>", " ", h)   # sin barra lateral, migas, formularios
    return html.unescape(re.sub(r"<[^>]+>", " ", h))
def orig(rec):
    pg = json.loads((ROOT / rec["json"]).read_text())
    t = pg["text"]
    # fuera: bloques de plantilla repetidos en todas las páginas
    t = re.split(r"(?:CONTACTA CON NOSOTROS|CONTACT US|CONTACTEZ-NOUS|KONTAKT)", t)[0] if "single-product" in " ".join(pg["body_classes"]) else t
    t = re.sub(r"(?s)Explora productos similares.*", "", t)
    return t
# líneas de PLANTILLA (menú lateral de categorías, aviso de cookies, widgets): aparecen en muchas páginas del mismo idioma → se excluyen del original
from collections import Counter
FREQ = {}
for r in idx:
    c = FREQ.setdefault(r["lang"], Counter())
    for ln in set(l.strip() for l in json.loads((ROOT / r["json"]).read_text())["text"].split("\n") if l.strip()):
        c[ln] += 1
def orig_clean(rec):
    c = FREQ[rec["lang"]]
    return "\n".join(l for l in orig(rec).split("\n") if c[l.strip()] <= 8)
rows = []
seen = set()
for r in idx:
    if not r.get("url") or only and r["lang"] != only: continue
    stem = r["file"].split("/")[-1][:-5]
    path = ("/" if stem == "home" else f"/{stem}/" if stem in ("en", "fr", "de") else "/" + stem.replace("__", "/") + "/") if (stem.split("__")[0] in ("en", "fr", "de") or stem in ("home", "en", "fr", "de")) and urlparse(r["url"]).path.split("/")[1] not in ("en", "fr", "de", "") else urlparse(r["url"]).path
    path = path if path.endswith("/") else path + "/"
    f = dist_file(path)
    if not f or path in seen: continue
    if r["file"].split("/")[-1].startswith("elementor-hf"): continue
    seen.add(path)
    o, m = words(orig_clean(r)), words(mine(f))
    if len(o) < 8: continue
    rows.append((len(o & m) / len(o), len(o & m) / max(1, len(m)), path, len(o), sorted(o - m)[:8]))
rows.sort()
print(f"{len(rows)} páginas comparadas | recall medio {sum(r[0] for r in rows)/len(rows):.3f} | páginas con recall < 0.90: {sum(1 for r in rows if r[0] < .9)} | < 0.97: {sum(1 for r in rows if r[0] < .97)}")
for rc, pr, path, n, miss in rows[:worst]:
    print(f"  recall {rc:.2f} precision {pr:.2f} {path} ({n} pal.)  faltan: {', '.join(miss)}")
