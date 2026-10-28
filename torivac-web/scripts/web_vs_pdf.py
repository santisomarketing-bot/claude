#!/usr/bin/env python3
"""Sesión 11 · Compara las TABLAS de las fichas de la web original con las tablas del PDF verificado (determinista).

  python3 -I scripts/web_vs_pdf.py            # escribe data/analysis/web-vs-pdf.json

Para cada producto con familia de PDF enlazada (confianza alta) busca en su descripción las tablas HTML cuya primera columna contiene
modelos del PDF y compara celda a celda las cifras (se compara el número, no el formato: «2×1,5» = «2x1.5»).
Resultado por tabla: filas que coinciden, filas con cifras distintas, códigos que solo existen en la web o solo en el PDF y una gravedad:
  alta   → hay códigos que no existen en el PDF o más del 20 % de las filas difieren (la web puede hacer pedir algo que no existe)
  media  → algunas filas difieren
  ok     → coincide
Además anota `agree_keys`: modelos cuya fila coincide en la web y en el PDF (corroboración independiente); enrich_catalog.py los acepta aunque el PDF los marcara «media».
La web nueva NO corrige nada por su cuenta salvo lo que figure en data/catalog/content-overrides.json (decisión humana documentada).
Entradas: data/catalog/products.base.json · data/analysis/pdf-product-links.json · data/analysis/pdfs/p*.json
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.pdfkeys import alnum, model_key  # noqa: E402

AN, CAT = ROOT / "data" / "analysis", ROOT / "data" / "catalog"


def nums(v):
    """números de una celda: «2×1,5» → [2.0, 1.5]"""
    return [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", str(v or ""))]


def head_key(h):
    """clave de una cabecera: las de 1-2 letras se respetan tal cual (D ≠ d); las largas se reducen a su primera palabra («Altura mm Height mm.» → altura, «Kgs.» → kg)"""
    h = str(h or "").strip()
    if re.fullmatch(r"[A-Za-zØø]{1,2}\.?", h):
        return h.rstrip(".")
    w = re.findall(r"[a-zA-ZØø]+", h)
    k = alnum(w[0]) if w else ""
    return "kg" if k in ("kgs", "kg") else k


def walk_tables(blocks):
    for b in blocks or []:
        if b.get("t") == "table":
            yield b


def table_rows(b):
    return [[(c.get("x") or "").strip() for c in r] for r in b.get("rows", [])]


def main():
    products = {p["id"]: p for p in json.loads((CAT / "products.base.json").read_text())}
    links = json.loads((AN / "pdf-product-links.json").read_text())["links"]
    docs = {}
    for f in sorted(glob.glob(str(AN / "pdfs" / "p*.json"))):
        for d in json.loads(Path(f).read_text()).get("documents", []):
            docs[(d["file"], Path(f).stem)] = d
    out = {"tables": [], "summary": {}}
    for l in links:
        if l["confidence"] != "alta" or not l.get("family") or not l.get("preferred"):
            continue
        doc = docs.get((l["pdf"], l.get("job")))
        fam = next((f for f in (doc or {}).get("families", []) if f["family"] == l["family"]), None)
        if not fam:
            continue
        p = products.get(l["product_id"])
        models = {model_key(m["reference"]): m for m in fam.get("models", [])}
        for field in ("description", "short"):
            for b in walk_tables((p.get(field) or {}).get("es")):
                rows = table_rows(b)
                # cabecera = primera fila con ≥ 3 celdas marcadas th
                hi = next((i for i, r in enumerate(b.get("rows", [])) if sum(1 for c in r if c.get("th")) >= 3), None)
                if hi is None:
                    continue
                header, body = rows[hi], rows[hi + 1:]
                hk = [head_key(h) for h in header]
                keyed = [(model_key(r[0]), r) for r in body if r and r[0]]
                hits = [k for k, _ in keyed if k in models]
                if len(hits) < max(2, len(keyed) // 3):
                    continue                                    # no es la tabla de modelos de esta familia
                sc = {}                                         # clave de cabecera → columna de specs del PDF
                for col in (hits and models[hits[0]].get("specs") or {}):
                    sc.setdefault(head_key(col), col)
                diffs, only_web, same, agree = [], [], 0, []
                for k, r in keyed:
                    m = models.get(k)
                    if not m:
                        only_web.append(r[0])
                        continue
                    bad, cmp_ = False, 0
                    for h, cell in zip(hk[1:], r[1:]):
                        col = sc.get(h)
                        if not col or not nums(cell) or not nums(m["specs"].get(col)):
                            continue
                        cmp_ += 1
                        if nums(cell) != nums(m["specs"].get(col)):
                            diffs.append({"ref": r[0], "column": col, "web": cell, "pdf": m["specs"].get(col)})
                            bad = True
                    same += 0 if bad else 1
                    if not bad and cmp_ >= 2:
                        agree.append(k)                      # dos fuentes independientes (web y PDF) dan las mismas cifras
                only_pdf = [m["reference"] for k, m in models.items() if k not in {kk for kk, _ in keyed}]
                bad_rows = len({d["ref"] for d in diffs})
                sev = "ok" if not diffs and not only_web else ("alta" if only_web or bad_rows > 0.2 * max(1, len(keyed)) else "media")
                out["tables"].append({"product_id": p["id"], "product": p["name"]["es"], "field": field, "block_index": (p.get(field)["es"]).index(b), "pdf": l["pdf"], "family": l["family"],
                                      "rows_web": len(keyed), "rows_pdf": len(models), "rows_equal": same, "rows_different": bad_rows, "only_web": only_web, "only_pdf": only_pdf, "diffs": diffs, "agree_keys": agree, "severity": sev})
    out["summary"] = {"tables": len(out["tables"]), "alta": sum(1 for t in out["tables"] if t["severity"] == "alta"), "media": sum(1 for t in out["tables"] if t["severity"] == "media"), "ok": sum(1 for t in out["tables"] if t["severity"] == "ok")}
    (AN / "web-vs-pdf.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(out["summary"]))
    for t in out["tables"]:
        print(f"  {t['severity']:5s} {t['product_id']:5d} {t['product'][:40]:40s} filas web {t['rows_web']:3d} · pdf {t['rows_pdf']:3d} · iguales {t['rows_equal']:3d} · distintas {t['rows_different']:3d} · solo web {len(t['only_web'])} · solo pdf {len(t['only_pdf'])}")


if __name__ == "__main__":
    main()
