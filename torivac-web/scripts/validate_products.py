#!/usr/bin/env python3
"""Validador determinista de data/analysis/products/<lote>.json (Sesión 1).

  python3 -I scripts/validate_products.py data/analysis/products/g01-xxx.json [--json]

Comprueba (no arregla):
  - estructura y tipos del registro de producto
  - ids del lote == ids de data/analysis/groups.json
  - nombres/urls/ids de traducciones coinciden con product-map.json y con la Store API
  - texto de descripción por idioma presente y sin truncar respecto a la fuente (store)
  - cada voltage_mentions[].raw existe literalmente en la fuente de ese idioma
  - recall: menciones de voltaje que hay en la fuente y NO están en voltage_mentions
  - spec_tables: nº de filas == tablas de la fuente
Salida: lista de problemas (vacía = OK). Código de salida 1 si hay errores.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW, AN = ROOT / "data" / "raw", ROOT / "data" / "analysis"
LANGS = ["es", "en", "fr", "de"]
VOLT = re.compile(r"(?<![\w.])(\d{1,4}(?:[.,]\d+)?(?:\s?[-–/]\s?\d{1,4}(?:[.,]\d+)?)?\s?(?:kV|V\s?(?:AC|DC|CA|CC|ca|cc)?|VAC|VDC|VCA|VCC|voltios?|volts?|volt))(?![\w])", re.I)


def strip(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def nz(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def main(path, as_json=False):
    data = json.loads(Path(path).read_text())
    groups = json.loads((AN / "groups.json").read_text())["groups"]
    pmap = {p["id_es"]: p for p in json.loads((AN / "product-map.json").read_text())["products"]}
    store = {l: {p["id"]: p for p in json.loads((RAW / f"store/products.{l}.json").read_text())} for l in LANGS}
    key = data.get("group") or Path(path).stem
    grp = next((g for g in groups if g["key"] == key), None)
    errs = []
    E = lambda pid, msg: errs.append({"id_es": pid, "problem": msg})
    if not grp:
        E(None, f"lote '{key}' no existe en groups.json")
    prods = data.get("products", [])
    got = [p.get("id_es") for p in prods]
    if grp:
        miss, extra = sorted(set(grp["ids"]) - set(got)), sorted(set(got) - set(grp["ids"]))
        if miss: E(None, f"faltan productos del lote: {miss}")
        if extra: E(None, f"productos que no son del lote: {extra}")
    if len(got) != len(set(got)):
        E(None, "ids duplicados")
    req = ["id_es", "slug", "url_es", "names", "urls", "ids", "category_path_es", "type", "short_description", "description_text", "spec_tables", "attributes",
           "images", "pdf_links", "voltage_mentions", "power_mentions", "variation_axes_hint", "seo", "translation_status", "quality_flags", "gaps"]
    for p in prods:
        pid = p.get("id_es")
        for k in req:
            if k not in p: E(pid, f"falta la clave '{k}'")
        pm = pmap.get(pid)
        if not pm:
            E(pid, "id_es no está en product-map.json"); continue
        for l in LANGS:
            src = store[l].get(pid if l == "es" else (pm["translations"].get(l) or {}).get("id"))
            has_src = src is not None
            st = (p.get("translation_status") or {}).get(l)
            if l != "es":
                if has_src and st in ("missing", None): E(pid, f"{l}: la fuente tiene traducción pero translation_status={st}")
                if not has_src and st not in ("missing", None): E(pid, f"{l}: no hay traducción en la fuente pero translation_status={st}")
            if not has_src:
                continue
            if nz((p.get("names") or {}).get(l)) != nz(html.unescape(src["name"])): E(pid, f"{l}: names no coincide con la fuente ({(p.get('names') or {}).get(l)!r} vs {src['name']!r})")
            if (p.get("ids") or {}).get(l) != src["id"]: E(pid, f"{l}: ids incorrecto")
            if norm_url(p.get("urls", {}).get(l)) != norm_url(src["permalink"]): E(pid, f"{l}: url incorrecta")
            srctxt, got_txt = strip(src.get("description")), (p.get("description_text") or {}).get(l) or ""
            if srctxt and len(strip(got_txt)) < 0.9 * len(srctxt): E(pid, f"{l}: description_text truncado ({len(strip(got_txt))} vs {len(srctxt)} chars)")
            # voltaje: precisión y recall
            corpus = nz(strip(src.get("description")) + " " + strip(src.get("short_description")) + " " + src["name"])
            for vm in p.get("voltage_mentions") or []:
                if vm.get("lang") == l and vm.get("source") in ("web:descripcion", "web:corta", "web:nombre", "web:tabla") and nz(vm.get("raw")) not in corpus:
                    E(pid, f"{l}: voltage raw {vm.get('raw')!r} no aparece en la fuente")
            have = " | ".join(nz(v.get("raw")) for v in (p.get("voltage_mentions") or []) if v.get("lang") == l)
            for m in VOLT.finditer(strip(src.get("description")) + " " + strip(src.get("short_description")) + " " + src["name"]):
                if nz(m.group(1)) not in have:
                    E(pid, f"{l}: mención de voltaje en la fuente no recogida: {m.group(1)!r}")
            nt = len(re.findall(r"<table", src.get("description") or "", re.I))
            got_t = len([t for t in (p.get("spec_tables") or []) if t.get("lang") == l])
            if nt != got_t: E(pid, f"{l}: tablas en fuente={nt} vs spec_tables={got_t}")
    res = {"file": str(path), "group": key, "products": len(prods), "problems": len(errs), "detail": errs}
    if as_json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        print(f"{path}: {len(prods)} productos, {len(errs)} problemas")
        for e in errs[:80]:
            print(" -", e["id_es"], e["problem"])
        if len(errs) > 80: print(f" … y {len(errs) - 80} más (usa --json)")
    return 1 if errs else 0


def norm_url(u):
    return (u or "").split("#")[0].rstrip("/")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], "--json" in sys.argv))
