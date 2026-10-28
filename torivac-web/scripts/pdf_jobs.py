#!/usr/bin/env python3
"""Sesión 1 · Reparto de PDFs en trabajos para agentes. Requiere prepare.py pdf.

  python3 -I scripts/pdf_jobs.py   -> data/analysis/pdf-jobs.json
Reglas: catálogo ES en tramos de 7 págs; catálogo EN en tramos de 14 (se contrasta con ES);
fichas de 1-3 págs agrupadas por familia (máx. 5 por trabajo); duplicados por texto normalizado se marcan, no se descartan.
"""
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AN = ROOT / "data" / "analysis"
idx = json.loads((AN / "pdf-index.json").read_text())["pdfs"]

FAMS = [
    ("variadores", r"variador|monofasico"),
    ("transformadores", r"transformador|serie-?t[ect]|serie_t|tci"),
    ("botones-baquelita", r"boton|tapas|senalizador|baquelita"),
    ("hembrillas-bornes", r"hembrilla|borne|portafusible"),
    ("bobinas-potenciometros-reostatos", r"bobina|potenciometro|reostato"),
    ("soportes-led", r"soporte|led"),
    ("nucleos-choques", r"nucleo|choque"),
]


def fam(name):
    """Familia de producto (variadores, transformadores…) de un nombre de PDF según FAMS; otros si ninguna encaja."""
    n = name.lower()
    for k, rx in FAMS:
        if re.search(rx, n):
            return k
    return "otros"


def norm_text(stem, pages):
    """Texto de todas las páginas de un PDF en minúsculas alfanuméricas, para detectar PDF con el mismo texto."""
    t = ""
    for p in range(1, pages + 1):
        f = AN / "pdf-text" / stem / f"p{p:03d}.txt"
        if f.exists():
            t += f.read_text()
    return re.sub(r"[^a-z0-9]+", "", t.lower())


hashes = defaultdict(list)
for r in idx:
    h = hashlib.sha256(norm_text(r["stem"], r["pages"]).encode()).hexdigest() if r["text_chars"] > 200 else None
    r["text_hash"] = h
    if h:
        hashes[h].append(r["file"])
for r in idx:
    r["same_text_as"] = [f for f in hashes.get(r["text_hash"], []) if f != r["file"]]

jobs, n = [], 0


def add(kind, files, note=""):
    """Añade a `jobs` un trabajo `p<nn>-<kind>` numerado con el contador global `n`."""
    global n
    n += 1
    jobs.append({"key": f"p{n:02d}-{kind}", "kind": kind, "note": note, "files": files})


cat_es = next((r for r in idx if r["file"] == "Torivac_2024.pdf"), None)
cat_en = next((r for r in idx if r["file"] == "Torivac_2024_EN.pdf"), None)
if cat_es:
    for a in range(1, cat_es["pages"] + 1, 7):
        add("catalogo-es", [{"file": cat_es["file"], "stem": cat_es["stem"], "pages": [a, min(a + 6, cat_es["pages"])]}], "Catálogo general 2024 (ES). Fuente principal de referencias, tensiones y potencias.")
if cat_en:
    for a in range(1, cat_en["pages"] + 1, 14):
        add("catalogo-en", [{"file": cat_en["file"], "stem": cat_en["stem"], "pages": [a, min(a + 13, cat_en["pages"])]}], "Catálogo 2024 en inglés: registrar terminología EN y CONTRASTAR cifras con el catálogo ES (misma página/producto).")
rest = [r for r in idx if r is not cat_es and r is not cat_en]
byfam = defaultdict(list)
for r in sorted(rest, key=lambda r: r["file"].lower()):
    byfam[fam(r["file"])].append(r)
for f, lst in sorted(byfam.items()):
    for i in range(0, len(lst), 5):
        part = lst[i:i + 5]
        add(f"fichas-{f}", [{"file": r["file"], "stem": r["stem"], "pages": [1, r["pages"]], "needs_visual_read": r["needs_visual_read"], "same_text_as": r["same_text_as"]} for r in part],
            "Fichas técnicas. Los PDFs con needs_visual_read=true son imagen: hay que mirarlos renderizados (pdftoppm) y transcribirlos.")

(AN / "pdf-jobs.json").write_text(json.dumps({"n_pdfs": len(idx), "n_jobs": len(jobs), "jobs": jobs}, ensure_ascii=False, indent=1))
print("PDFs:", len(idx), "| trabajos:", len(jobs))
for j in jobs:
    print(" ", j["key"], [(f["file"], f["pages"]) for f in j["files"]])
dups = {h: v for h, v in hashes.items() if len(v) > 1}
print("grupos de PDFs con texto idéntico:", len(dups), list(dups.values())[:8])
