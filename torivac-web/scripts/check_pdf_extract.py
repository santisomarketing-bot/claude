#!/usr/bin/env python3
"""Comprobador determinista de data/analysis/pdfs/<trabajo>.json (Sesión 1).

  python3 -I scripts/check_pdf_extract.py data/analysis/pdfs/p01-catalogo-es.json [--json]

Por cada documento y página:
  PRECISIÓN  cada número que aparece en models[].specs / raw_row / tables[].rows / voltage_mentions debe existir
             en el texto de esa página (pdf-text). Se tolera coma/punto decimal. Los números que no están => posible invención.
  RECALL     números del texto de la página que NO aparecen en ningún sitio del JSON de esa página (posible omisión).
             Solo se avisa en páginas con >= 12 números en el texto.
Páginas listadas en visual_only_pages (transcritas de imagen) o sin capa de texto se saltan y se informan.
Código de salida 1 si hay números sin respaldo.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AN = ROOT / "data" / "analysis"
NUM = re.compile(r"(?<![\w])\d+(?:[.,]\d+)*")


def toks(s):
    return {t.replace(",", ".").rstrip(".") for t in NUM.findall(s or "")}


def walk(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def page_text(stem, p):
    f = AN / "pdf-text" / stem / f"p{p:03d}.txt"
    return f.read_text() if f.exists() else ""


def main(path, as_json=False):
    d = json.loads(Path(path).read_text())
    idx = {r["file"]: r for r in json.loads((AN / "pdf-index.json").read_text())["pdfs"]}
    problems, notes, per_page = [], [], {}
    for doc in d.get("documents", []):
        f = doc.get("file")
        stem = (idx.get(f) or {}).get("stem")
        if not stem:
            problems.append({"file": f, "page": None, "kind": "archivo", "detail": "PDF no está en pdf-index.json"})
            continue
        visual = set(doc.get("visual_only_pages") or [])
        # agrupa todo lo extraído por página
        bucket = {}
        def put(page, obj):
            bucket.setdefault(page, []).append(obj)
        for fam in doc.get("families", []):
            for m in fam.get("models", []):
                put(m.get("page") or fam.get("page"), {"specs": m.get("specs"), "ref": m.get("reference"), "raw": m.get("raw_row")})
            put(fam.get("page"), {"general": fam.get("general_specs"), "desc": fam.get("description"), "ord": fam.get("ordering_info")})
        for t in doc.get("tables", []):
            put(t.get("page"), {"cols": t.get("columns"), "rows": t.get("rows"), "notes": t.get("notes")})
        for v in doc.get("voltage_mentions", []):
            put(v.get("page"), {"raw": v.get("raw")})
        for fa in doc.get("other_facts", []):
            put(fa.get("page"), {"fact": fa.get("fact")})
        for page, objs in sorted(bucket.items(), key=lambda kv: (kv[0] is None, kv[0])):
            if page is None:
                problems.append({"file": f, "page": None, "kind": "sin_pagina", "detail": "hay datos sin número de página"})
                continue
            text = page_text(stem, page)
            if page in visual or len(text.strip()) < 60:
                notes.append(f"{f} p{page}: sin capa de texto o transcrita de imagen — no verificable automáticamente")
                continue
            ptoks = toks(text)
            got = set()
            for o in objs:
                for s in walk(o):
                    got |= toks(s)
            missing = sorted(t for t in got if t not in ptoks and not (len(t) == 1))
            for t in missing:
                problems.append({"file": f, "page": page, "kind": "numero_sin_respaldo", "detail": t})
            if len(ptoks) >= 12:
                lost = sorted(ptoks - got)
                per_page[f"{f}#p{page}"] = {"numbers_in_page": len(ptoks), "numbers_extracted": len(got & ptoks), "recall": round(len(got & ptoks) / len(ptoks), 2), "not_extracted_sample": lost[:25]}
    low = {k: v for k, v in per_page.items() if v["recall"] < 0.7}
    res = {"file": str(path), "numeros_sin_respaldo": len([p for p in problems if p["kind"] == "numero_sin_respaldo"]), "otros_problemas": len([p for p in problems if p["kind"] != "numero_sin_respaldo"]),
           "paginas_recall_bajo": low, "notas": notes, "detail": problems}
    if as_json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        print(f"{path}: {res['numeros_sin_respaldo']} números sin respaldo, {res['otros_problemas']} otros problemas, {len(low)} páginas con recall<0.70")
        for p in problems[:60]:
            print(" -", p["file"], "p" + str(p["page"]), p["kind"], p["detail"])
        for k, v in list(low.items())[:20]:
            print(f" ~ recall bajo {k}: {v['numbers_extracted']}/{v['numbers_in_page']} (faltan p.ej. {v['not_extracted_sample'][:10]})")
        for n in notes[:15]:
            print(" ·", n)
    return 1 if res["numeros_sin_respaldo"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], "--json" in sys.argv))
