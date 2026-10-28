#!/usr/bin/env python3
"""Sesión 1 · Mapa de traducciones y lotes de trabajo (determinista).

  python3 -I scripts/map_translations.py

Requiere haber corrido harvest.mjs y prepare.py. Genera:
  data/analysis/product-map.json   cada producto ES -> traducciones EN/FR/DE (por hreflang, con respaldo por slug/REST)
  data/analysis/category-map.json  árbol de categorías ES + traducciones
  data/analysis/groups.json        lotes de productos para repartir entre agentes (por categoría raíz, máx. 10 por lote)
  data/analysis/coverage.json      huecos de traducción (productos sin EN/FR/DE)
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW, AN = ROOT / "data" / "raw", ROOT / "data" / "analysis"
LANGS = ["es", "en", "fr", "de"]
MAX_GROUP = 10


def load(p, default=None):
    """JSON del archivo `p`, o `default` si no existe o no es válido."""
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return default


def norm(u):
    """URL sin ancla (#...) ni barra final, para comparar rutas."""
    return (u or "").split("#")[0].rstrip("/")


store = {l: load(RAW / f"store/products.{l}.json", []) for l in LANGS}
rest = {l: load(RAW / f"rest/product.{l}.json", []) for l in LANGS}
cats = {l: load(RAW / f"rest/product_cat.{l}.json", []) for l in LANGS}
pages_index = load(AN / "pages-index.json", {"pages": []})

# url -> hreflang alternates (de cualquier idioma)
alt_by_url = {}
for r in pages_index["pages"]:
    hl = r.get("hreflang") or {}
    for u in [r.get("url")] + list(hl.values()):
        if u:
            alt_by_url[norm(u)] = {k: norm(v) for k, v in hl.items()}

by_url = {l: {norm(p["permalink"]): p for p in store[l]} for l in LANGS}
by_id = {l: {p["id"]: p for p in store[l]} for l in LANGS}
rest_by_id = {l: {p["id"]: p for p in rest[l]} for l in LANGS}

# slug de categoría -> árbol ES
cat_es = {c["id"]: c for c in cats["es"]}


def chain(cid):
    """Cadena de categorías ES desde la raíz hasta la categoría `cid` (lista de registros, de padre a hijo)."""
    out, seen = [], set()
    while cid and cid in cat_es and cid not in seen:
        seen.add(cid)
        out.append(cat_es[cid])
        cid = cat_es[cid]["parent"]
    return list(reversed(out))


products = []
gaps = defaultdict(list)
for p in store["es"]:
    u = norm(p["permalink"])
    alts = alt_by_url.get(u, {})
    tr = {}
    for l in ("en", "fr", "de"):
        target = alts.get(l) or next((v for k, v in alts.items() if k.startswith(l)), None)
        q = by_url[l].get(target) if target else None
        how = "hreflang" if q else None
        if not q:  # respaldo: mismo slug o mismo SKU
            for cand in store[l]:
                if (p.get("sku") and cand.get("sku") == p["sku"]) or cand["slug"] == p["slug"] or cand["slug"] == f"{p['slug']}-{l}":
                    q, how = cand, "slug/sku"
                    break
        if q:
            tr[l] = {"id": q["id"], "slug": q["slug"], "url": q["permalink"], "name": q["name"], "matched_by": how}
        else:
            gaps[l].append({"id": p["id"], "name": p["name"]})
    prim = chain((p["categories"][0]["id"]) if p["categories"] else 0)
    products.append({
        "id_es": p["id"], "slug": p["slug"], "url": p["permalink"], "name_es": p["name"], "sku": p.get("sku"), "type": p["type"],
        "categories_es": [{"id": c["id"], "name": c["name"], "slug": c["slug"]} for c in p["categories"]],
        "category_path": [c["name"] for c in prim], "top_category": (prim[0]["name"] if prim else "Sin categoría"), "top_slug": (prim[0]["slug"] if prim else "sin-categoria"),
        "translations": tr, "n_images": len(p["images"]), "has_table": bool(re.search(r"<table", p.get("description") or "", re.I)),
    })
(AN / "product-map.json").write_text(json.dumps({"count": len(products), "products": products}, ensure_ascii=False, indent=1))

# Productos EN/FR/DE sin pareja en ES (huérfanos)
matched = {l: {v["id"] for pr in products for k, v in pr["translations"].items() if k == l} for l in ("en", "fr", "de")}
orphans = {l: [{"id": p["id"], "name": p["name"], "url": p["permalink"]} for p in store[l] if p["id"] not in matched[l]] for l in ("en", "fr", "de")}
(AN / "coverage.json").write_text(json.dumps({"missing_translation_of_es_products": gaps, "translated_products_without_es_match": orphans,
                                               "counts": {l: len(store[l]) for l in LANGS}}, ensure_ascii=False, indent=1))

# categorías
cat_out = []
for c in cats["es"]:
    cat_out.append({"id": c["id"], "name": c["name"], "slug": c["slug"], "parent": c["parent"], "count": c["count"], "link": c.get("link"),
                    "path": [x["name"] for x in chain(c["id"])]})
(AN / "category-map.json").write_text(json.dumps({"es": cat_out, "other_langs": {l: [{"id": c["id"], "name": c["name"], "slug": c["slug"], "parent": c["parent"], "count": c["count"], "link": c.get("link")} for c in cats[l]] for l in ("en", "fr", "de")}}, ensure_ascii=False, indent=1))

# lotes de trabajo: por categoría raíz, trozos de <= MAX_GROUP, los pequeños se fusionan
by_top = defaultdict(list)
for pr in products:
    by_top[pr["top_category"]].append(pr)
chunks = []
for top, lst in sorted(by_top.items(), key=lambda kv: -len(kv[1])):
    lst = sorted(lst, key=lambda x: (x["category_path"], x["name_es"]))
    n = max(1, -(-len(lst) // MAX_GROUP))
    size = -(-len(lst) // n)
    for i in range(n):
        part = lst[i * size:(i + 1) * size]
        chunks.append({"label": top + (f" ({i + 1}/{n})" if n > 1 else ""), "ids": [x["id_es"] for x in part]})
small = [c for c in chunks if len(c["ids"]) < 4]
big = [c for c in chunks if len(c["ids"]) >= 4]
merged, cur = [], None
for c in small:
    if cur and len(cur["ids"]) + len(c["ids"]) <= MAX_GROUP:
        cur["label"] += " + " + c["label"]
        cur["ids"] += c["ids"]
    else:
        cur = {"label": c["label"], "ids": list(c["ids"])}
        merged.append(cur)
groups = big + merged
for i, g in enumerate(groups, 1):
    g["key"] = f"g{i:02d}-" + re.sub(r"[^a-z0-9]+", "-", g["label"].lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n"))[:40].strip("-")
(AN / "groups.json").write_text(json.dumps({"total_products": len(products), "groups": groups}, ensure_ascii=False, indent=1))
print("productos ES:", len(products), "| lotes:", len(groups), [len(g["ids"]) for g in groups])
print("sin traducción:", {l: len(v) for l, v in gaps.items()}, "| huérfanos:", {l: len(v) for l, v in orphans.items()})
