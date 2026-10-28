#!/usr/bin/env python3
"""Sesión 2/11 · Enriquece el catálogo con lo que sale de los PDFs verificados (determinista, sin IA).

  python3 -I scripts/enrich_catalog.py            # lee products.base.json → escribe products.json, proposals.json, voltage-tags.json
  python3 -I scripts/enrich_catalog.py --report   # además imprime cobertura

NUNCA modifica el contenido de la web (nombres, descripciones, imágenes): solo AÑADE
  · variants[]     modelos del PDF verificado como líneas pedibles (ref = código impreso, o «P<id>-<modelo>» si el PDF no da código), con especificaciones y origen {pdf, página}
  · voltage_tags[] etiquetas de tensión con evidencia (PDF verificado o frase literal de la ficha) y voltage_evidence[]
  · power{min,max,unit} rango de potencia derivado de las variantes
  · pdfs[]         fichas técnicas enlazadas (con URL original)
  · proposals.json todo lo dudoso o discrepante, para decidir en el panel (nada de eso se publica)
REGLA («si no estás seguro, no lo sumes»): solo se publican modelos con confianza «alta» de familias enlazadas con confianza «alta» a la ficha por scripts/link_pdfs.py.
Entradas: data/analysis/pdf-product-links.json · pdfs/p*.json · web-vs-pdf.json · pdf-contrast-proposals-raw.json · proposals-raw.json · legal/ux-proposals-raw.json
          data/catalog/voltage-curated.json · proposals.curated.json · pdf-links.curated.json
Salidas: products.json · proposals.json · voltage-tags.json
"""
import glob
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import voltage  # noqa: E402
from lib.pdfkeys import model_key  # noqa: E402

AN, CAT, RAW = ROOT / "data" / "analysis", ROOT / "data" / "catalog", ROOT / "data" / "raw"


# ───── [UTIL] lectura y normalización
def jl(p, d=None):
    """JSON de un fichero, o `d` si no existe / no es válido"""
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return d


def to_num(raw):
    """primer número de un texto (coma o punto decimal)"""
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(raw or ""))
    return float(m.group(0).replace(",", ".")) if m else None


def unit_of(col, raw):
    """unidad: la de la cabecera «(mm)» o la que sigue al número"""
    m = re.search(r"\(([^)]+)\)", col or "")
    if m:
        return m.group(1).strip()
    m = re.search(r"\d\s*([A-Za-zΩµ%°²³/]+)\s*$", str(raw or ""))
    return m.group(1) if m else None


def norm_spec(col, raw):
    """valor de especificación → {raw, value, unit}"""
    return {"raw": str(raw).strip(), "value": to_num(raw), "unit": unit_of(col, raw)}


# ───── [REFS] qué es una referencia pedible
CODE_RE = re.compile(r"[A-Z]{1,5}-?\d[0-9A-Z/.\-]*|\d{2,3}[A-Z]{1,3}")
DIMS_RE = re.compile(r"A\d+[- ]B\d+[- ]C\d+")
JUNK_RE = re.compile(r"sin referencia|no printed|ilustraci|dibujo|drawing", re.I)
SPEC_JUNK = re.compile(r"^(Gama de la tabla|Grupo de filas)", re.I)


def classify(ref):
    """('code', 'TT0020210') si el PDF imprime un código de fabricante; ('model', '160 VA') si solo identifica el modelo por potencia/número; (None, None) si no es utilizable"""
    r = re.sub(r"\s+", " ", str(ref or "").replace("\xa0", " ")).strip()
    r = re.sub(r"\[[^\]]*\]", "", r).strip()
    if not r or JUNK_RE.search(r):
        return None, None
    r2 = re.sub(r"\s*-\s*", "-", r)
    if CODE_RE.fullmatch(r2) and not DIMS_RE.fullmatch(r2):
        return "code", r2.upper()
    r = re.sub(r"^(?:Serie\s+\S+(?:\s+con\s+L[ií]nea|\s+\(brillante\))?|Tapas|Aros con Flecha|Cubretuercas|Discos \w+|BO Series\w*)\s+(?=MOD\.)", "", r, flags=re.I)
    return "model", r


def slug(label):
    """etiqueta de modelo → trozo de clave: «160 VA» → 160VA"""
    return re.sub(r"[^A-Z0-9Ø×]+", "", label.upper())[:30]


# ───── [IDS] identificador estable de propuesta: no cambia aunque aparezcan o desaparezcan otras
def pid_of(identity, taken):
    """Id estable `PR-nnnnn` de una propuesta, derivado del hash de su identidad; si ya está en `taken`, toma otro libre."""
    n = int(hashlib.sha1(identity.encode()).hexdigest()[:8], 16) % 90000 + 10000
    while n in taken:
        n = n % 90000 + 10000 + 1
    taken.add(n)
    return f"PR-{n}"


def main():
    """Parte de products.base.json y añade variantes, tensiones y potencia (PDF verificados); escribe products, voltage-tags y proposals."""
    base = CAT / "products.base.json"
    if not base.exists():
        base.write_text((CAT / "products.json").read_text())      # primera vez: la salida de build_catalog es la base
    products = json.loads(base.read_text())
    byid = {p["id"]: p for p in products}
    links = jl(AN / "pdf-product-links.json", {"links": []})
    curated = jl(CAT / "pdf-links.curated.json", {})
    jobs = {}
    for f in sorted(glob.glob(str(AN / "pdfs" / "p*.json"))):
        for doc in (jl(f) or {}).get("documents", []):
            jobs[(doc["file"], Path(f).stem)] = doc
    manifest = {Path(x["file"]).name: x["url"] for x in jl(RAW / "manifest.json", {}).get("pdfs", []) if x.get("url")}
    stats = defaultdict(int)
    corro = {(x["product_id"], k) for x in jl(AN / "web-vs-pdf.json", {"tables": []})["tables"] for k in x.get("agree_keys", [])}     # modelos con la misma fila en la web y en el PDF
    proposals = []                                    # los de este script (los de agentes/legal/ux/wpml se añaden después, con id estable)
    extra_prop = []

    def prop(type_, pid, title, web, pdf, rec, sev="media", field=None, conf="alta", ref=None, evidence=None):
        """Añade a `extra_prop` una propuesta para el panel (tipo, producto, título, valor web/PDF, recomendación, severidad, evidencia)."""
        extra_prop.append({"type": type_, "product_id": pid, "product_name": (byid.get(pid) or {}).get("name", {}).get("es") if pid else None, "field": field, "title": title, "web_value": web, "pdf_value": pdf, "severity": sev,
                           "recommendation": rec, "confidence": conf, **({"ref": ref} if ref else {}), **({"evidence": evidence} if evidence else {})})

    # ---- 1) variantes pedibles desde las familias de PDF enlazadas con confianza alta
    per_product = defaultdict(list)
    for l in links.get("links", []):
        if l.get("confidence") == "alta" and l.get("family") and l.get("preferred", True):
            per_product[l["product_id"]].append(l)
    used_codes = {}
    for pid, ls in sorted(per_product.items()):
        p = byid.get(int(pid))
        if not p:
            stats["producto_desconocido"] += 1
            continue
        variants, pdfs, keys = [], {x["url"]: x for x in p.get("pdfs", [])}, set()
        fam_tags = []
        no_var = any(l.get("variants") is False for l in ls)
        for l in ls:
            doc = jobs.get((l["pdf"], l.get("job")))
            fam = next((f for f in (doc or {}).get("families", []) if f["family"] == l["family"]), None)
            if not fam:
                stats["familia_no_encontrada"] += 1
                continue
            url = manifest.get(l["pdf"])
            if url and url not in pdfs:
                pdfs[url] = {"url": url, "label": {"es": None}, "linked_by": "pdf-product-links"}
            fam_tags += [(t, w, l["pdf"], fam.get("page")) for t, w in voltage.family_tags(fam, doc)]
            if no_var:
                continue
            only = set(l["models"]) if l.get("models") else None
            # modelos utilizables: referencia identificable, confianza alta, sin duplicados de etiqueta dentro de la familia
            cand, dudosos, labels = [], [], defaultdict(int)
            for m in fam.get("models", []):
                if only is not None and m["reference"] not in only:
                    continue
                kind, key = classify(m.get("reference"))
                if kind is None:
                    stats["modelo_sin_referencia"] += 1
                    continue
                if m.get("confidence", "alta") != "alta" and (p["id"], model_key(m["reference"])) not in corro:
                    dudosos.append(m["reference"])
                    continue
                labels[key] += 1
                cand.append((kind, key, m))
            repetidos = {k for k, n in labels.items() if n > 1}
            if repetidos:
                prop("pdf_duplicate_model", p["id"], f"«{p['name']['es']}»: el PDF repite {', '.join(sorted(repetidos))}", ", ".join(sorted(repetidos)), None,
                     "No se publican esos modelos hasta confirmar en el PDF si son dos versiones distintas o una fila partida.", "media", f"{l['pdf']}")
            if dudosos:
                prop("pdf_uncertain_model", p["id"], f"«{p['name']['es']}»: {len(dudosos)} modelos del PDF con lectura dudosa no se publican", ", ".join(dudosos[:12]) + ("…" if len(dudosos) > 12 else ""), None,
                     "Comprobar estos modelos con el PDF original; hasta entonces no son pedibles por separado (la línea genérica sigue disponible).", "media", l["pdf"], evidence={"file": l["pdf"], "page": fam.get("page")})
            for kind, key, m in cand:
                if key in repetidos:
                    continue
                if kind == "code":
                    ref = key
                    if ref in used_codes and used_codes[ref] != p["id"]:
                        stats["ref_duplicada_entre_productos"] += 1
                        prop("pdf_duplicate_ref", p["id"], f"El código {ref} aparece en dos productos", ref, None, f"Ya está en «{byid[used_codes[ref]]['name']['es']}». Decidir a cuál pertenece.", "media", ref=ref)
                        continue
                    used_codes[ref] = p["id"]
                else:
                    ref = f"P{p['id']}-{slug(key)}"
                    n = 2
                    while ref in keys:
                        ref = f"P{p['id']}-{slug(key)}-{n}"
                        n += 1
                if ref in keys:
                    continue
                keys.add(ref)
                specs = {c: norm_spec(c, v) for c, v in (m.get("specs") or {}).items() if v not in (None, "") and not SPEC_JUNK.match(c)
                         and not (kind == "code" and re.sub(r"[^A-Za-z0-9]", "", str(v)).upper() == re.sub(r"[^A-Za-z0-9]", "", ref))}      # la columna «CODIGO» repite la referencia
                mt = voltage.model_tags(m)
                variants.append({"ref": ref, "code": kind == "code", "label": None if kind == "code" else {"es": key}, "specs": specs, "voltage_tags": [t for t, _ in mt], "voltage_evidence": [{"tag": t, "why": w} for t, w in mt],
                                 "source": {"type": "pdf", "file": l["pdf"], "page": m.get("page"), "family": fam["family"]}, "confidence": "alta",
                                 **({"corroborated_by": "tabla de la web"} if m.get("confidence", "alta") != "alta" else {})})
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
        p["_fam_tags"] = fam_tags

    # ---- 2) etiquetas de voltaje: PDF verificado + frases literales de la ficha
    cur = jl(CAT / "voltage-curated.json", {"products": {}, "proposals": []})
    used_tags = set()
    for p in products:
        ev, tags = [], []

        def add(tag, source, why):
            """Anota la etiqueta de tensión `tag` en el producto actual (sin repetirla) con su evidencia: origen y motivo."""
            if tag not in tags:
                tags.append(tag)
            ev.append({"tag": tag, "source": source, "why": why})
        for t, w, f, pg in p.pop("_fam_tags", []):
            add(t, f"{f} p.{pg}", w)
        text = json.dumps({k: (p.get(k) or {}).get("es") for k in ("short", "description")}, ensure_ascii=False)
        text = re.sub(r"<[^>]+>|\\u[0-9a-f]{4}", " ", re.sub(r"\s+", " ", text))
        for c in cur["products"].get(str(p["id"]), []):
            needle = re.sub(r"\s+", " ", c["quote"]).strip()
            if needle not in re.sub(r"\s+", " ", text.replace("\\n", " ")):
                raise SystemExit(f"voltage-curated: la frase «{needle}» no aparece en el texto del producto {p['id']} ({p['name']['es']})")
            add(c["tag"], "web", f"«{needle}»")
        for v in p.get("variants", []):
            for t in v["voltage_tags"]:
                if t not in tags:
                    tags.append(t)
                    ev.append({"tag": t, "source": "variantes", "why": "ver variantes"})
        bad = [t for t in tags if t not in voltage.TAGS]
        if bad:
            raise SystemExit(f"etiqueta de voltaje desconocida {bad} en {p['name']['es']}")
        tags.sort(key=lambda t: voltage.TAGS[t].get("sort", 999))
        if tags:
            p["voltage_tags"] = tags
            p["voltage_evidence"] = ev
            used_tags.update(tags)
            stats["productos_con_voltaje"] += 1
    vtags = [{"id": t, **{k: v for k, v in voltage.TAGS[t].items()}} for t in sorted(used_tags, key=lambda t: voltage.TAGS[t].get("sort", 999))]
    (CAT / "voltage-tags.json").write_text(json.dumps(vtags, ensure_ascii=False, indent=1))
    for x in cur.get("proposals", []):
        prop("voltage_tag", x.get("product_id"), x["title"], x.get("web_value"), None, x["recommendation"], x.get("severity", "baja"), field="etiqueta de voltaje")

    # ---- 3) propuestas deterministas de PDFs: web≠PDF, familias sin ficha, sin variantes, contraste ES/EN
    wv = jl(AN / "web-vs-pdf.json", {"tables": []})
    for t in wv["tables"]:
        if t["severity"] == "ok":
            continue
        ejemplos = "; ".join(f"{d['ref']} · {d['column']}: web {d['web']} / PDF {d['pdf']}" for d in t["diffs"][:6])
        solo = (f" Códigos que solo existen en la web: {', '.join(t['only_web'][:8])}{'…' if len(t['only_web']) > 8 else ''}." if t["only_web"] else "")
        prop("web_pdf_table", t["product_id"], f"La tabla de la web difiere del PDF en «{t['product']}» ({t['rows_different']} filas con cifras distintas, {len(t['only_web'])} códigos solo en la web)",
             f"{t['rows_web']} filas en la web", f"{t['rows_pdf']} modelos en el PDF {t['pdf']}",
             f"Diferencias: {ejemplos}.{solo} La web nueva muestra los modelos verificados con el PDF y conserva la tabla original solo si coincide; confirmar con Torivac cuál es la correcta.", "alta" if t["severity"] == "alta" else "media",
             field="tabla de modelos", evidence={"file": t["pdf"], "page": None})
    for o in links.get("families_without_product", []):
        prop("pdf_family_without_product", None, f"El PDF {o['pdf']} describe «{o['family']}» ({o['models']} modelos) y la web no tiene ficha para ello", None, o["family"],
             "Valorar crear la ficha de producto (o enlazar el PDF a una existente).", "baja", field="familia de PDF sin producto")
    for x in curated.get("no_variants", []):
        prop("pdf_no_variants", x["product_id"], "Se mantiene la línea genérica (sin modelos pedibles por separado)", None, None, x["why"], "baja", field="modelos de PDF")
    for x in jl(AN / "pdf-contrast-proposals-raw.json", []) or []:
        extra_prop.append(x)
    for x in jl(CAT / "proposals.curated.json", {"proposals": []})["proposals"]:
        prop(x["type"], x.get("product_id"), x["title"], x.get("web_value"), x.get("pdf_value"), x["recommendation"], x.get("severity", "media"), field=x.get("field"), evidence=x.get("evidence"))

    # ---- 4) propuestas de agentes, traducciones, legales, UX y WPML
    pending = []
    for x in jl(AN / "proposals-raw.json", []) or []:
        pr = {"status": "pending", **x}
        pr["product_name"] = pr.get("product_name") or (byid.get(int(x["product_id"]), {}).get("name", {}).get("es") if x.get("product_id") else None)
        pending.append(pr)
    for p in products:
        for l in ("en", "fr", "de"):
            st = p["translation_status"].get(l)
            if st in ("missing", "partial", "identical_to_es"):
                pending.append({"status": "pending", "type": "missing_translation", "product_id": p["id"], "product_name": p["name"]["es"], "lang": l, "field": f"description[{l}]", "title": {"missing": "Falta la traducción", "partial": "Traducción incompleta", "identical_to_es": "Texto sin traducir (idéntico al español)"}[st],
                                "web_value": st, "pdf_value": None, "severity": "media", "recommendation": "Traducir antes de publicar; mientras tanto la web muestra el texto en español con aviso.", "confidence": "alta"})
    for src in ("legal-proposals-raw.json", "ux-proposals-raw.json"):
        for x in jl(AN / src, []) or []:
            pending.append({"status": "pending", **x})
    for c in jl(CAT / "categories.json", []) or []:
        for l, cf in (c.get("wpml_conflict") or {}).items():
            pending.append({"status": "pending", "type": "wpml_link", "category_id": c["id"], "product_name": c["name"]["es"], "lang": l, "field": f"categoría[{l}]", "title": "Traducción de categoría mal enlazada en WPML", "web_value": cf["wpml_path"], "pdf_value": None, "severity": "baja",
                            "recommendation": f"WPML enlaza «{c['name']['es']}» con «{cf['wpml_name']}», que cuelga de otra rama del árbol. La web nueva usa {cf['kept_path'] or 'el texto en español'}; revisar el enlace en WPML de la web original.", "confidence": "alta"})
    pending += [{"status": "pending", **x} for x in extra_prop]
    taken = set()
    for x in pending:
        ident = "|".join(str(x.get(k) or "") for k in ("type", "product_id", "category_id", "lang", "field", "title", "ref"))
        x["id"] = pid_of(ident, taken)
        proposals.append(x)
    proposals.sort(key=lambda x: ({"alta": 0, "media": 1, "baja": 2}.get(x.get("severity"), 3), x.get("type", ""), x["id"]))

    (CAT / "proposals.json").write_text(json.dumps(proposals, ensure_ascii=False, indent=1))
    (CAT / "products.json").write_text(json.dumps(products, ensure_ascii=False, indent=1))
    tipos = defaultdict(int)
    for x in proposals:
        tipos[x["type"]] += 1
    print(json.dumps({"productos": len(products), "propuestas": len(proposals), **dict(stats)}, ensure_ascii=False))
    print("propuestas por tipo:", dict(sorted(tipos.items())))
    if "--report" in sys.argv:
        sin = [p["name"]["es"] for p in products if not p["variants"]]
        print(f"sin variantes ({len(sin)}):", "; ".join(sin[:60]))


if __name__ == "__main__":
    main()
