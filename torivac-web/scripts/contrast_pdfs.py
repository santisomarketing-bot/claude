#!/usr/bin/env python3
"""Sesión 11 · Contraste del catálogo Torivac 2024 en español frente al inglés (mismos 41 folios), determinista.

  python3 -I scripts/contrast_pdfs.py            # escribe data/analysis/pdfs/contrast-es-en.json y data/analysis/pdf-contrast-proposals-raw.json

Compara, familia a familia y modelo a modelo, las tablas YA verificadas de los dos idiomas (p01-p06 = ES, p07-p09 = EN):
  · modelos que están en un idioma y no en el otro
  · cifras distintas para el mismo modelo y columna (se compara el número, no el formato: «0,45» = «0.45»)
Las cifras que difieren NO se corrigen: cada divergencia se publica como propuesta del panel para decidir con el PDF original delante.
Las ya resueltas mirando el PDF se anotan en data/analysis/pdfs/contrast-resolutions.json (clave = familia ES) y no generan propuesta.
Entradas: data/analysis/pdfs/p0[1-9]-catalogo-*.json  ·  Salidas: ver arriba.
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.pdfkeys import alnum, model_key  # noqa: E402

PDFS = ROOT / "data" / "analysis" / "pdfs"


def numbers(v):
    """lista de números de un valor (coma o punto decimal); None/vacío → []"""
    return [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", str(v or ""))]


def load(prefix_files):
    """familias de los PDF indicados: [{family, page, models:{refkey:model}, refs}]"""
    fams = []
    for f in sorted(prefix_files):
        for doc in json.loads(Path(f).read_text()).get("documents", []):
            for fam in doc.get("families", []):
                if not fam.get("models"):
                    continue
                fams.append({"family": fam["family"], "page": fam.get("page"), "models": {model_key(m["reference"]): m for m in fam["models"]}, "raw": fam})
    return fams


def pair_families(es, en):
    """empareja familias ES↔EN por solape de claves de modelo, respetando el orden del documento (las secciones BO/Tapas/Aros comparten claves)"""
    used, pairs, last = set(), [], -1
    for a in es:
        cands = []
        for j, b in enumerate(en):
            if j in used:
                continue
            ka, kb = set(a["models"]), set(b["models"])
            s = len(ka & kb) / max(1, len(ka | kb))
            if s >= 0.5:
                cands.append((s, j > last, -abs(j - (last + 1)), j))
        if cands:
            s, _, _, j = max(cands)
            used.add(j)
            last = j
            pairs.append((a, en[j], s))
        else:
            pairs.append((a, None, 0.0))
    return pairs, [b for j, b in enumerate(en) if j not in used]


def compare(a, b):
    """divergencias entre dos familias emparejadas"""
    out = []
    for k, ma in a["models"].items():
        mb = b["models"].get(k)
        if not mb:
            out.append({"kind": "modelo_solo_es", "ref": ma["reference"], "page": ma.get("page")})
            continue
        ea, eb = ma.get("specs") or {}, mb.get("specs") or {}
        ka, kb = list(ea), list(eb)
        for i, col in enumerate(ka):
            colb = col if col in eb else (kb[i] if len(ka) == len(kb) else None)
            if colb is None:
                continue
            na, nb = numbers(ea[col]), numbers(eb[colb])
            if na and nb and na != nb:
                out.append({"kind": "cifra_distinta", "ref": ma["reference"], "page": ma.get("page"), "column": col, "es": ea[col], "en": eb[colb]})
    for k, mb in b["models"].items():
        if k not in a["models"]:
            out.append({"kind": "modelo_solo_en", "ref": mb["reference"], "page": mb.get("page")})
    return out


def main():
    resolved = json.loads((PDFS / "contrast-resolutions.json").read_text()) if (PDFS / "contrast-resolutions.json").exists() else {}
    es = load(glob.glob(str(PDFS / "p0[1-6]-catalogo-es.json")))
    en = load(glob.glob(str(PDFS / "p0[7-9]-catalogo-en.json")))
    pairs, unpaired_en = pair_families(es, en)
    report, props = {"families_es": len(es), "families_en": len(en), "pairs": [], "unpaired_es": [], "unpaired_en": [b["family"] for b in unpaired_en]}, []
    for a, b, score in pairs:
        if not b:
            report["unpaired_es"].append(a["family"])
            continue
        div = compare(a, b)
        report["pairs"].append({"es": a["family"], "en": b["family"], "page_es": a["page"], "page_en": b["page"], "overlap": round(score, 2), "models_es": len(a["models"]), "models_en": len(b["models"]), "divergences": div})
        if div and a["family"] in resolved:
            report["pairs"][-1]["resolved"] = resolved[a["family"]]          # ya verificado en la imagen del PDF: no genera propuesta
        elif div:
            n_val = sum(1 for d in div if d["kind"] == "cifra_distinta")
            n_mod = len(div) - n_val
            ejemplos = "; ".join(f"{d['ref']} · {d['column']}: ES {d['es']} / EN {d['en']}" for d in div if d["kind"] == "cifra_distinta")[:260]
            props.append({"type": "pdf_divergence", "product_name": a["family"], "field": f"catálogo 2024 · folio {a['page']}", "title": f"El catálogo ES y EN difieren en «{a['family']}» ({n_val} cifras, {n_mod} modelos)",
                          "web_value": ejemplos or "modelos que solo aparecen en un idioma", "pdf_value": None, "severity": "media",
                          "recommendation": "Revisar el folio en los dos PDF y corregir el que esté mal antes de publicar los valores. Mientras tanto la web no muestra las cifras dudosas como definitivas.", "confidence": "alta"})
    report["total_divergences"] = sum(len(p["divergences"]) for p in report["pairs"])
    (PDFS / "contrast-es-en.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    (ROOT / "data" / "analysis" / "pdf-contrast-proposals-raw.json").write_text(json.dumps(props, ensure_ascii=False, indent=1))
    print(f"familias ES {len(es)} · EN {len(en)} · emparejadas {sum(1 for p in report['pairs'])} · sin pareja ES {len(report['unpaired_es'])} / EN {len(report['unpaired_en'])} · divergencias {report['total_divergences']} · propuestas {len(props)}")


if __name__ == "__main__":
    main()
