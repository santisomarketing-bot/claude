#!/usr/bin/env python3
"""Sesión 11 · Enlaza cada ficha de producto con la familia del PDF verificado que la describe (determinista, sin IA).

  python3 -I scripts/link_pdfs.py            # escribe data/analysis/pdf-product-links.json
  python3 -I scripts/link_pdfs.py --review   # además imprime la tabla producto → familia para revisarla a ojo

REGLA DE ORO («si no estás seguro, no lo sumes»): un enlace es «alta» solo si
  1) la propia página del producto enlaza ese PDF (así lo decidió Torivac), Y
  2) el nombre de una familia del PDF coincide con el del producto (mismas palabras distintivas, sin atributos en conflicto:
     monofásico≠trifásico, manual≠motorizado, simple≠doble≠triple, 3 mm≠5 mm…), o el modelo del PDF aparece en el nombre del producto (Hembrilla HB4 ↔ «HB - 4»).
Todo lo demás es «media»/«baja»: NO publica variantes y va a propuestas del panel.
Entradas: data/catalog/products.base.json · data/analysis/pdfs/p*.json (ya verificados) · data/catalog/pdf-links.curated.json (decisiones humanas: links, reject, no_variants; mandan sobre el algoritmo)
Salida: {links:[{product_id, pdf, job, family, confidence, preferred, method, score, models?}], families_without_product:[…], products_without_pdf:[…]}
"""
import glob
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.pdfkeys import model_key  # noqa: E402

AN, CAT = ROOT / "data" / "analysis", ROOT / "data" / "catalog"

# ───── [TOKENS] normalización de nombres (castellano/inglés) para comparar producto ↔ familia
SYN = {
    "monofasico": "mono", "monofasica": "mono", "monofasicos": "mono", "single": "mono", "singlephase": "mono",
    "trifasico": "tri", "trifasica": "tri", "trifasicos": "tri", "three": "tri", "threephase": "tri",
    "motorizado": "motor", "motorizada": "motor", "motorizados": "motor", "motorizadas": "motor", "motor": "motor", "mamotorizada": "motor",
    "doble": "doble", "dobles": "doble", "twin": "doble", "double": "doble",
    "triple": "triple", "tripes": "triple", "triples": "triple",
    "simple": "simple", "startors": "stator", "startor": "stator", "estators": "stator", "estator": "stator", "stators": "stator", "stator": "stator",
    "cuba": "cuba", "cura": "cuba", "caratulas": "caratula", "caratula": "caratula",
    "graduadas": "graduado", "graduados": "graduado", "graduada": "graduado", "graduado": "graduado",
    "discos": "disco", "disco": "disco", "aros": "aro", "aro": "aro", "tapas": "tapa", "tapa": "tapa", "cubretuercas": "cubretuerca", "cubretuerca": "cubretuerca",
    "botones": "boton", "boton": "boton", "soportes": "soporte", "soporte": "soporte", "metalicos": "metalico", "metalico": "metalico",
    "hembrillas": "hembrilla", "hembrilla": "hembrilla", "potenciometros": "potenciometro", "potenciometro": "potenciometro",
    "reostatos": "reostato", "reostato": "reostato", "nucleos": "nucleo", "nucleo": "nucleo", "choques": "choque", "choque": "choque",
    "bobinas": "bobina", "bobina": "bobina", "transformadores": "transformador", "transformador": "transformador",
    "estabilizadores": "estabilizador", "estabilizador": "estabilizador", "variadores": "variador", "variador": "variador",
    "resistencias": "resistencia", "resistencia": "resistencia", "electroimanes": "electroiman", "electroiman": "electroiman",
    "encapsulada": "encapsulado", "encapsulado": "encapsulado", "encapsulados": "encapsulado", "circuito": "ci", "circuitos": "ci",
}
STOP = {"mando", "impreso", "impresos", "c", "de", "del", "la", "las", "el", "los", "y", "e", "en", "con", "para", "a", "tension", "regulacion", "serie", "series", "by", "of", "and", "the", "in", "for", "mm", "va", "kva", "w", "pdf", "mod", "type"}
# atributos mutuamente excluyentes: si producto y familia tienen valores distintos del mismo grupo → no son lo mismo
EXCL = [{"mono", "tri"}, {"manual", "motor"}, {"simple", "doble", "triple"}, {"3mm", "5mm", "8mm", "10mm"}, {"3w", "5w"}, {"bo", "bm", "df", "tt", "te", "tci", "pc"}, {"disco", "tapa", "aro", "cubretuerca", "caratula", "stator"}, {"hb4", "hr4", "hbs4", "hsr4"}]


def fold(s):
    return unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()


def toks(s):
    """conjunto de palabras distintivas de un nombre"""
    s = fold(s)
    s = re.sub(r"\bc\.\s*i\.", "ci", s)                              # C.I. → ci (circuito impreso)
    s = re.sub(r"(\d+)\s*(mm|w)\b", r"\1\2", s)             # 3 mm → 3mm · 5 W → 5w
    s = re.sub(r"\b([a-z]{1,3})\s*-\s*(\d)", r"\1\2", s)     # HB - 4 → hb4
    out = set()
    for t in re.findall(r"[a-z0-9]+", s):
        t = SYN.get(t, t)
        if t in STOP or len(t) < 2:
            continue
        if t.endswith("s") and len(t) > 3 and t not in SYN.values():
            t = t[:-1]
        out.add(SYN.get(t, t))
    return out


def score(pn, fam):
    """similitud producto ↔ familia (0-1); 0 si hay atributos en conflicto"""
    a, b = toks(pn), toks(fam)
    if not a or not b:
        return 0.0
    for g in EXCL:
        x, y = a & g, b & g
        if x and y and not (x & y):
            return 0.0
    inter = a & b
    if not inter:
        return 0.0
    sc = len(inter) / len(a | b) + (0.25 if any(g & inter for g in EXCL) else 0.0)
    for g in EXCL:                                                         # la familia es algo más concreto que el producto
        if (b & g) and not (a & g):
            sc *= 0.6
    return sc


def base_family(fam):
    """nombre de familia sin el rango de potencias entre paréntesis (dos tablas de un mismo producto: 160-4000 VA y 5000-11000 VA)"""
    return re.sub(r"\s*\([^)]*\b(?:VA|kVA)\b[^)]*\)\s*$", "", fam).strip()


def code_of(ref):
    """«HB - 4» → hb4"""
    return re.sub(r"[^a-z0-9]", "", fold(ref))


# ───── [LOAD]
def load_docs():
    docs = []
    for f in sorted(glob.glob(str(AN / "pdfs" / "p*.json"))):
        job = Path(f).stem
        for d in json.loads(Path(f).read_text()).get("documents", []):
            docs.append({**d, "job": job})
    return docs


def main():
    review = "--review" in sys.argv
    products = json.loads((CAT / "products.base.json").read_text())
    docs = [d for d in load_docs() if d.get("language") == "es" and d.get("verified")]
    by_file = {}
    for d in docs:
        by_file.setdefault(d["file"], []).append(d)
    curated = json.loads((CAT / "pdf-links.curated.json").read_text()) if (CAT / "pdf-links.curated.json").exists() else {"links": [], "reject": []}
    reject = {(r["product_id"], r["pdf"], r.get("family")) for r in curated.get("reject", [])}

    names = {p["id"]: p["name"]["es"] for p in products}
    links, linked_fam = [], set()
    for p in products:
        name = p["name"]["es"]
        pdfs = []
        for x in p.get("pdfs", []):
            fn = Path(x["url"]).name
            fn = re.sub(r"%20", " ", fn)
            if fn not in pdfs:
                pdfs.append(fn)
        for fn in pdfs:
            ds = by_file.get(fn) or by_file.get(re.sub(r"\.pdf$", ".pdf", fn))
            if not ds:
                links.append({"product_id": p["id"], "product": name, "pdf": fn, "confidence": "baja", "method": "pdf_sin_extraccion", "family": None, "preferred": False})
                continue
            for d in ds:
                fams = d.get("families", [])
                cands = []
                for fam in fams:
                    if not fam.get("models"):
                        continue
                    sc = score(name, fam["family"])
                    via = "nombre"
                    # el modelo del PDF aparece como palabra en el nombre del producto (Hembrilla HB4 ↔ «HB - 4»)
                    mm = [m for m in fam["models"] if code_of(m["reference"]) in toks(name) and re.search(r"[a-z]", code_of(m["reference"])) and re.search(r"\d", code_of(m["reference"]))]
                    if mm:
                        sc, via = max(sc, 0.9), "modelo_en_nombre"
                    if sc > 0:
                        cands.append((sc, fam, via, mm))
                cands.sort(key=lambda c: -c[0])
                if not cands:
                    continue
                top = cands[0][0]
                chosen = [c for c in cands if c[0] >= max(0.3, top - 0.0001)]
                if not chosen:                                   # ninguna familia se parece lo bastante: se deja constancia (baja) pero no se publica nada
                    sc, fam, via, mm = cands[0]
                    links.append({"product_id": p["id"], "product": name, "pdf": fn, "job": d["job"], "family": fam["family"], "doc_type": d.get("doc_type"), "confidence": "baja", "method": via, "score": round(sc, 2)})
                    continue
                # familias hermanas (misma base sin rango de potencia) → todas son del mismo producto
                base = base_family(chosen[0][1]["family"])
                for c in cands:
                    if c not in chosen and base_family(c[1]["family"]) == base and c[0] >= 0.3:
                        chosen.append(c)
                for sc, fam, via, mm in chosen:
                    if (p["id"], fn, fam["family"]) in reject:
                        continue
                    conf = "alta" if sc >= 0.5 or via == "modelo_en_nombre" else "media"
                    links.append({"product_id": p["id"], "product": name, "pdf": fn, "job": d["job"], "family": fam["family"], "doc_type": d.get("doc_type"), "confidence": conf, "method": via, "score": round(sc, 2),
                                  **({"models": [m["reference"] for m in mm]} if mm else {})})
                    linked_fam.add((fn, fam["family"]))
    # curados (mandan sobre el algoritmo)
    for c in curated.get("links", []):
        links = [l for l in links if not (l["product_id"] == c["product_id"] and l["pdf"] == c["pdf"] and l.get("family") == c.get("family"))]
        links.append({**c, "product": names.get(c["product_id"]), "method": "curado", "confidence": c.get("confidence", "alta")})
        linked_fam.add((c["pdf"], c.get("family")))

    # productos cuya tabla no debe convertirse en variantes pedibles (se mantienen el enlace a la ficha y la línea genérica)
    no_var = {x["product_id"]: x["why"] for x in curated.get("no_variants", [])}
    for l in links:
        if l["product_id"] in no_var:
            l["variants"], l["note"] = False, no_var[l["product_id"]]

    # preferred: para cada (producto, familia-base) gana la ficha técnica sobre el catálogo y, a igualdad, el enlace de mayor puntuación
    rank = {"ficha_tecnica": 0, "hoja_seleccion": 1, "catalogo": 2}
    grp = {}
    for l in links:
        if l.get("family"):
            grp.setdefault((l["product_id"], base_family(l["family"]).lower()), []).append(l)
    for l in links:
        l.setdefault("preferred", False)
    for ls in grp.values():
        ls.sort(key=lambda l: (rank.get(l.get("doc_type"), 3), -l.get("score", 0)))
        # dentro de un mismo documento se conservan todas las familias hermanas
        best_doc = ls[0]["pdf"]
        for l in ls:
            l["preferred"] = (l["pdf"] == best_doc)

    # familias de PDFs (ES) sin ningún producto enlazado y que NO sean duplicado (catálogo ↔ ficha) de una ya enlazada → candidatas a ficha nueva (propuesta)
    def mkeys(fam):
        return {model_key(m["reference"]) for m in fam.get("models", [])}
    linked_sets = []
    for d in docs:
        for fam in d.get("families", []):
            if (d["file"], fam["family"]) in linked_fam:
                linked_sets.append((toks(fam["family"]), mkeys(fam)))
    orphan = []
    for d in docs:
        for fam in d.get("families", []):
            if not fam.get("models") or (d["file"], fam["family"]) in linked_fam:
                continue
            tk, mk = toks(fam["family"]), mkeys(fam)
            dup = any((tk >= lt or lt >= tk) and len(mk & lm) / max(1, min(len(mk), len(lm))) >= 0.8 for lt, lm in linked_sets)
            if not dup:
                orphan.append({"pdf": d["file"], "family": fam["family"], "models": len(fam["models"]), "doc_type": d.get("doc_type")})
    no_pdf = [{"product_id": p["id"], "product": p["name"]["es"]} for p in products if not any(l["product_id"] == p["id"] and l.get("family") for l in links)]
    out = {"links": links, "families_without_product": orphan, "products_without_family": no_pdf,
           "stats": {"alta": sum(1 for l in links if l["confidence"] == "alta" and l.get("family")), "media": sum(1 for l in links if l["confidence"] == "media"), "baja": sum(1 for l in links if l["confidence"] == "baja")}}
    (AN / "pdf-product-links.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(out["stats"]), f"· productos sin familia {len(no_pdf)} · familias sin producto {len(orphan)}")
    if review:
        print("\n── ENLACES ──")
        for l in sorted(links, key=lambda x: (x["product_id"], x["pdf"])):
            print(f"{l['product_id']:6d} {l['product'][:44]:44s} {l['pdf'][:36]:36s} {str(l.get('family'))[:46]:46s} {l['confidence']:5s} {l.get('score', '')!s:5s} {l['method']:17s} {'★' if l.get('preferred') else ' '}")
        print("\n── PRODUCTOS SIN FAMILIA ──")
        for x in no_pdf:
            print(f"{x['product_id']:6d} {x['product']}")
        print("\n── FAMILIAS SIN PRODUCTO ──")
        for x in orphan:
            print(f"  {x['pdf'][:40]:40s} {x['family'][:60]:60s} {x['models']:3d} {x['doc_type']}")


if __name__ == "__main__":
    main()
