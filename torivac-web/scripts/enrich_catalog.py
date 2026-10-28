#!/usr/bin/env python3
"""Sesión 2 · Enriquece el catálogo con lo que sale de los PDFs verificados y de los agentes de análisis.

  python3 -I scripts/enrich_catalog.py            # lee products.base.json → escribe products.json (+ proposals.json, voltage-tags.json)
  python3 -I scripts/enrich_catalog.py --report   # además imprime cobertura

NUNCA modifica el contenido de la web (nombres, descripciones, imágenes): solo AÑADE
  · variants[]     referencias pedibles (modelos de PDF) con sus especificaciones, origen {pdf, página} y etiquetas de voltaje propias
  · voltage_tags[] etiquetas de tensión con evidencia (web o PDF verificado)
  · power{min,max,unit} rango de potencia derivado de las variantes
  · pdfs[]         fichas técnicas enlazadas (con URL original)
  · proposals.json cambios dudosos para aprobar en el panel (web≠PDF, traducciones que faltan, errores evidentes…)
Entradas (todas opcionales; si falta una, esa parte se omite):
  data/analysis/pdf-product-links.json · pdfs/*.json · voltage-assignments.json · data/catalog/voltage-tags.json · proposals-raw.json
"""
import glob
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AN, CAT, RAW = ROOT / "data" / "analysis", ROOT / "data" / "catalog", ROOT / "data" / "raw"


def jl(p, d=None):
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return d


def to_num(raw):
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(raw or ""))
    return float(m.group(0).replace(",", ".")) if m else None


def unit_of(col, raw):
    m = re.search(r"\(([^)]+)\)", col or "")
    if m:
        return m.group(1).strip()
    m = re.search(r"\d\s*([A-Za-zΩµ%°²³/]+)\s*$", str(raw or ""))
    return m.group(1) if m else None


def norm_spec(col, raw):
    return {"raw": str(raw).strip(), "value": to_num(raw), "unit": unit_of(col, raw)}


def main():
    base = CAT / "products.base.json"
    if not base.exists():
        base.write_text((CAT / "products.json").read_text())      # primera vez: la salida de build_catalog es la base
    products = json.loads(base.read_text())
    byid = {p["id"]: p for p in products}
    links = jl(AN / "pdf-product-links.json", {"links": []})["links"]
    jobs = {}
    for f in sorted(glob.glob(str(AN / "pdfs" / "p*.json"))):
        d = jl(f)
        for doc in (d or {}).get("documents", []):
            jobs[(doc["file"], Path(f).stem)] = doc
    manifest = {Path(x["file"]).name: x["url"] for x in jl(RAW / "manifest.json", {}).get("pdfs", []) if x.get("url")}
    va = jl(AN / "voltage-assignments.json", {"products": {}, "variants": {}})
    vtags = jl(CAT / "voltage-tags.json", [])
    vtag_ids = {t["id"] for t in vtags}
    stats = defaultdict(int)
    seen_refs = {}

    # ---- variantes desde PDFs (solo el enlace 'preferred' de cada producto; evita duplicar catálogo y ficha)
    per_product = defaultdict(list)
    for l in links:
        if l.get("confidence") in ("alta", "media") and l.get("preferred", True):
            per_product[l["product_id"]].append(l)
    for pid, ls in per_product.items():
        p = byid.get(int(pid))
        if not p:
            stats["producto_desconocido"] += 1
            continue
        variants, pdfs = [], {x["url"]: x for x in p.get("pdfs", [])}
        for l in ls:
            doc = jobs.get((l["pdf"], l.get("job")))
            if not doc:
                doc = next((d for (f, j), d in jobs.items() if f == l["pdf"]), None)
            if not doc:
                stats["pdf_sin_extraccion"] += 1
                continue
            fam = next((f for f in doc.get("families", []) if f["family"] == l["family"]), None)
            if not fam:
                stats["familia_no_encontrada"] += 1
                continue
            url = manifest.get(l["pdf"])
            if url and url not in pdfs:
                pdfs[url] = {"url": url, "label": {"es": None}, "linked_by": "pdf-product-links"}
            for m in fam.get("models", []):
                ref = str(m.get("reference") or "").strip()
                if not ref:
                    continue
                if ref in seen_refs and seen_refs[ref] != p["id"]:
                    stats["ref_duplicada_entre_productos"] += 1
                    continue
                if any(v["ref"] == ref for v in variants):
                    continue
                seen_refs[ref] = p["id"]
                specs = {c: norm_spec(c, v) for c, v in (m.get("specs") or {}).items() if v not in (None, "")}
                vv = va.get("variants", {}).get(ref, {}).get("tags", [])
                variants.append({"ref": ref, "label": {"es": None}, "specs": specs, "voltage_tags": [t for t in vv if t in vtag_ids], "source": {"type": "pdf", "file": l["pdf"], "page": m.get("page"), "family": fam["family"]}, "confidence": m.get("confidence", "alta")})
        if variants:
            p["variants"] = variants
            stats["productos_con_variantes"] += 1
            stats["variantes"] += len(variants)
        p["pdfs"] = list(pdfs.values())
        # rango de potencia (VA/kVA/W/kW) derivado de las variantes
        pw = []
        for v in variants:
            for c, sp in v["specs"].items():
                if re.search(r"\b(va|kva|w|kw)\b|potencia|power", c, re.I) and sp["value"] is not None:
                    um = re.search(r"\b(kVA|VA|kW|W)\b", c) or re.search(r"\b(kVA|VA|kW|W)\b", sp["raw"])
                    pw.append((sp["value"], sp["unit"] or (um.group(1) if um else None)))
        if pw:
            p["power"] = {"min": min(a for a, _ in pw), "max": max(a for a, _ in pw), "unit": next((u for _, u in pw if u), None)}

    # ---- etiquetas de voltaje por producto
    for pid, a in va.get("products", {}).items():
        p = byid.get(int(pid))
        if not p:
            continue
        tags = [t for t in a.get("tags", []) if t in vtag_ids]
        vt = set(tags)
        for v in p["variants"]:
            vt.update(v.get("voltage_tags", []))
        if vt:
            p["voltage_tags"] = sorted(vt, key=lambda t: next((x.get("sort", 0) for x in vtags if x["id"] == t), 0))
            stats["productos_con_voltaje"] += 1

    # ---- propuestas (agentes + deterministas)
    proposals = []
    for i, x in enumerate(jl(AN / "proposals-raw.json", []) or [], start=1):
        pr = {"id": f"PR-{i:03d}", "status": "pending", **x}
        pr["product_name"] = pr.get("product_name") or (byid.get(int(x["product_id"]), {}).get("name", {}).get("es") if x.get("product_id") else None)
        proposals.append(pr)
    n = len(proposals)
    for p in products:
        for l in ("en", "fr", "de"):
            st = p["translation_status"].get(l)
            if st in ("missing", "partial", "identical_to_es"):
                n += 1
                proposals.append({"id": f"PR-{n:03d}", "status": "pending", "type": "missing_translation", "product_id": p["id"], "product_name": p["name"]["es"], "lang": l, "field": f"description[{l}]", "title": {"missing": "Falta la traducción", "partial": "Traducción incompleta", "identical_to_es": "Texto sin traducir (idéntico al español)"}[st], "web_value": st, "pdf_value": None, "severity": "media", "recommendation": "Traducir antes de publicar; mientras tanto la web muestra el texto en español con aviso.", "confidence": "alta"})
    # hallazgos de las páginas legales (análisis de contenido)
    for x in jl(AN / "legal-proposals-raw.json", []) or []:
        n += 1
        proposals.append({"id": f"PR-{n:03d}", "status": "pending", **x})
    # hallazgos de idioma de la prueba de UX (texto en otro idioma sin aviso)
    for x in jl(AN / "ux-proposals-raw.json", []) or []:
        n += 1
        proposals.append({"id": f"PR-{n:03d}", "status": "pending", **x})
    # enlaces de traducción (WPML) incoherentes con el árbol de categorías → propuesta (la web original los tiene mal enlazados)
    for c in jl(CAT / "categories.json", []) or []:
        for l, cf in (c.get("wpml_conflict") or {}).items():
            n += 1
            proposals.append({"id": f"PR-{n:03d}", "status": "pending", "type": "wpml_link", "category_id": c["id"], "product_name": c["name"]["es"], "lang": l, "field": f"categoría[{l}]",
                              "title": "Traducción de categoría mal enlazada en WPML", "web_value": cf["wpml_path"], "pdf_value": None, "severity": "baja",
                              "recommendation": f"WPML enlaza «{c['name']['es']}» con «{cf['wpml_name']}», que cuelga de otra rama del árbol. La web nueva usa {cf['kept_path'] or 'el texto en español'}; revisar el enlace en WPML de la web original.", "confidence": "alta"})
    (CAT / "proposals.json").write_text(json.dumps(proposals, ensure_ascii=False, indent=1))
    (CAT / "products.json").write_text(json.dumps(products, ensure_ascii=False, indent=1))
    print(json.dumps({"productos": len(products), "propuestas": len(proposals), **dict(stats)}, ensure_ascii=False))
    if "--report" in sys.argv:
        sin = [p["name"]["es"] for p in products if not p["variants"]]
        print(f"sin variantes ({len(sin)}):", "; ".join(sin[:40]))


if __name__ == "__main__":
    main()
