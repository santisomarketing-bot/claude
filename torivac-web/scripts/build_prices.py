#!/usr/bin/env python3
"""Sesión 6 · Hoja de precios → data/catalog/prices.json (y generación de la hoja DEMO).

  python3 -I scripts/build_prices.py              # usa data/catalog/prices.csv|xlsx si existe; si no, genera la hoja DEMO
  python3 -I scripts/build_prices.py --demo       # fuerza regenerar la hoja DEMO (prices.demo.csv / .xlsx)
  python3 -I scripts/build_prices.py --src=ruta.xlsx   # importa una hoja concreta (la que bajará el cron desde Drive)

HOJA DE PRECIOS (columnas; la primera fila es la cabecera; separador , o ;):
  ref · product_id · name_es · unit · currency · price · qty2 · price2 · qty3 · price3 · qty4 · price4 · note · active · updated_at
  - price = precio unitario base (hasta 4 decimales: así se admiten variaciones de céntimos)
  - qtyN/priceN = tramos: desde qtyN unidades el precio unitario pasa a priceN
  - active = 0/no/false oculta el precio (la línea pasa a «Consultar»)
  - una referencia SIN fila, o con price vacío, se muestra «Consultar»
SALIDA prices.json: {updated_at, source, currency, mode:"demo"|"live", items:{ref:{p, t:[[qty,price]…], note}}}

⚠ Los precios generados aquí son DE DEMOSTRACIÓN (no son tarifas de Torivac). `mode` queda en "demo" mientras la hoja sea la generada.
"""
import csv
import hashlib
import io
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / "data" / "catalog"
COLS = ["ref", "product_id", "name_es", "unit", "currency", "price", "qty2", "price2", "qty3", "price3", "qty4", "price4", "note", "active", "updated_at"]


def seed(ref):
    """Semilla numérica estable (8 primeros hex del SHA-1 de la referencia) para los precios DEMO deterministas."""
    return int(hashlib.sha1(ref.encode()).hexdigest()[:8], 16)


def num(x):
    """Número (float) de un valor escrito como «27,75», «27.75», «1.234,56» o «1,234.56» (el último separador es el decimal); None si está vacío o no es un número."""
    if x is None:
        return None
    s = str(x).strip()
    for ch in (" ", "\u00a0", "\u202f", "€", "$"):
        s = s.replace(ch, "")
    if not s:
        return None
    c, d = s.rfind(","), s.rfind(".")
    if c >= 0 and d >= 0:
        s = s.replace(".", "").replace(",", ".") if c > d else s.replace(",", "")
    elif c >= 0:
        s = s.replace(",", ".") if s.count(",") == 1 else s.replace(",", "")
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def first_number(raw):
    """Primer número (con coma o punto decimal) que aparece en un texto, como float; None si no hay ninguno."""
    m = re.search(r"\d+(?:[.,]\d+)?", raw or "")
    return num(m.group(0)) if m else None


def lines_of_catalog():
    """todas las líneas pedibles: variantes reales o la línea genérica P<id>"""
    out = []
    for p in json.loads((CAT / "products.json").read_text()):
        name = p["name"]["es"]
        vs = p.get("variants") or [{"ref": f"P{p['id']}", "specs": {}, "default": True}]
        for v in vs:
            out.append({"ref": v["ref"], "pid": p["id"], "name": name + ("" if v.get("default") else f" · {(v.get('label') or {}).get('es') or v['ref']}"), "specs": v.get("specs") or {}, "custom": bool(re.search(r"medida|custom|especial", name, re.I)), "default": bool(v.get("default"))})
    return out


def demo_price(line):
    """precio DEMO determinista: función suave de la potencia (VA/W) + variación de céntimos por referencia. Nunca es una tarifa real."""
    h = seed(line["ref"])
    rnd = (h % 10000) / 10000.0
    va = w = None
    for k, v in line["specs"].items():
        raw = v.get("raw") if isinstance(v, dict) else str(v)
        kk = k.lower()
        if kk.startswith("va") or "kva" in kk or "potencia" in kk or "power" in kk:
            va = va or first_number(raw)
        if kk.startswith("w") or "watt" in kk:
            w = w or first_number(raw)
    if va:
        p = 7.5 + va * 0.118 + (rnd - 0.5) * 1.4
    elif w:
        p = 4.2 + w * 0.035 + rnd
    else:
        p = 6.0 + rnd * 92
    p = round(p, 2)
    # variación de céntimos (ej. 12.37 / 12.19) y tramos por cantidad
    cents = ((h >> 8) % 7 - 3) / 100.0
    p = round(p + cents, 2)
    tiers = [(10, round(p * 0.97 - 0.01, 4)), (50, round(p * 0.94 - 0.02, 4)), (200, round(p * 0.90 - 0.03, 4))]
    return p, tiers


def write_demo_sheet():
    """Genera la hoja DEMO (prices.demo.csv y, si hay openpyxl, prices.demo.xlsx) con un precio por línea pedible; devuelve las filas."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = []
    for ln in lines_of_catalog():
        if ln["custom"]:        # a medida: se presupuesta aparte → «Consultar»
            rows.append({"ref": ln["ref"], "product_id": ln["pid"], "name_es": ln["name"], "unit": "ud", "currency": "EUR", "price": "", "note": "A medida: consultar", "active": 1, "updated_at": now})
            continue
        p, t = demo_price(ln)
        r = {"ref": ln["ref"], "product_id": ln["pid"], "name_es": ln["name"], "unit": "ud", "currency": "EUR", "price": f"{p:.2f}", "note": "DEMO", "active": 1, "updated_at": now}
        for i, (q, pr) in enumerate(t, start=2):
            r[f"qty{i}"], r[f"price{i}"] = q, f"{pr:.4f}".rstrip("0").rstrip(".")
        rows.append(r)
    with open(CAT / "prices.demo.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLS, delimiter=";")
        w.writeheader()
        w.writerows(rows)
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Precios"
        ws.append(COLS)
        for r in rows:
            ws.append([num(r.get(c)) if c in ("price", "qty2", "price2", "qty3", "price3", "qty4", "price4") and r.get(c) not in (None, "") else r.get(c, "") for c in COLS])
        for col, wd in zip("ABCDEFGHIJKLMNO", [14, 11, 44, 6, 9, 10, 7, 10, 7, 10, 7, 10, 22, 7, 22]):
            ws.column_dimensions[col].width = wd
        ws.freeze_panes = "A2"
        ws2 = wb.create_sheet("LEEME")
        for line in ["Hoja de precios Torivac — DEMO", "Los precios de esta hoja son DE DEMOSTRACIÓN, no son tarifas de Torivac.", "Columnas: ref · product_id · name_es · unit · currency · price · qty2/price2 · qty3/price3 · qty4/price4 · note · active · updated_at",
                     "price admite hasta 4 decimales (variaciones de céntimos). qtyN/priceN = a partir de qtyN unidades el precio unitario es priceN.", "Sin precio o active=0 → «Consultar». La web se actualiza cada 24 h desde esta hoja y con el botón de actualización manual."]:
            ws2.append([line])
        wb.save(CAT / "prices.demo.xlsx")
    except Exception as e:  # noqa: BLE001
        print("xlsx no generado:", e)
    return rows


def read_sheet(path):
    """Lee una hoja de precios .xlsx/.xls (primera hoja) o .csv (separador , o ;) como lista de filas {columna en minúsculas: valor}."""
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        import openpyxl
        ws = openpyxl.load_workbook(path, data_only=True, read_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        head = [str(c or "").strip().lower() for c in next(it)]
        return [dict(zip(head, ["" if c is None else c for c in r])) for r in it if any(c not in (None, "") for c in r)]
    text = path.read_text(encoding="utf-8-sig")
    delim = ";" if text.split("\n")[0].count(";") >= text.split("\n")[0].count(",") else ","
    return [{(k or "").strip().lower(): v for k, v in r.items()} for r in csv.DictReader(io.StringIO(text), delimiter=delim)]


def build(rows, source, mode):
    """Filas de la hoja → contenido de prices.json (updated_at, source, currency, mode, items); omite filas inactivas o sin precio."""
    items, stamp = {}, None
    for r in rows:
        ref = str(r.get("ref") or "").strip()
        if not ref or str(r.get("active", 1)).strip().lower() in ("0", "no", "false", "n"):
            continue
        p = num(r.get("price"))
        if p is None:
            continue
        t = []
        for q, k in ((2, "2"), (3, "3"), (4, "4")):
            qq, pp = num(r.get(f"qty{k}")), num(r.get(f"price{k}"))
            if qq and pp is not None:
                t.append([int(qq), pp])
        t.sort()
        items[ref] = {"p": p, **({"t": t} if t else {}), **({"note": str(r["note"])} if r.get("note") else {})}
        stamp = max(stamp or "", str(r.get("updated_at") or ""))
    return {"updated_at": stamp or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "source": source, "currency": "EUR", "mode": mode, "items": items}


def main():
    """Genera prices.json desde la hoja indicada (--src), la de data/catalog o, si no hay ninguna (o con --demo), la hoja DEMO."""
    args = sys.argv[1:]
    src = next((a.split("=", 1)[1] for a in args if a.startswith("--src=")), None)
    if "--demo" in args or (not src and not (CAT / "prices.csv").exists() and not (CAT / "prices.xlsx").exists()):
        rows = write_demo_sheet()
        out = build(rows, "prices.demo.csv", "demo")
    else:
        path = src or str(next(p for p in (CAT / "prices.xlsx", CAT / "prices.csv") if p.exists()))
        out = build(read_sheet(path), Path(path).name, "live")
    (CAT / "prices.json").write_text(json.dumps(out, ensure_ascii=False))
    n_lines = len(lines_of_catalog())
    print(f"prices.json: {len(out['items'])} referencias con precio de {n_lines} líneas pedibles · modo {out['mode']} · {out['updated_at']}")


if __name__ == "__main__":
    main()
