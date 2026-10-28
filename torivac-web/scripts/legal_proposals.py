#!/usr/bin/env python3
"""Sesión 9 · Hallazgos de las páginas legales (análisis de contenido) → PROPUESTAS para el panel. La web NO se modifica: los textos legales
se publican tal cual están en la web original y los problemas quedan para que los revise quien corresponda (asesoría legal).

  python3 -I scripts/legal_proposals.py     # lee data/analysis/content/es.json → data/analysis/legal-proposals-raw.json
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TITLES = {"aviso_legal": "Aviso legal", "privacidad": "Política de privacidad", "cookies": "Política de cookies", "accesibilidad": "Declaración de accesibilidad"}
SEV = {"alta": "alta", "media": "media", "baja": "baja"}


def main():
    """Convierte los hallazgos de las páginas legales (content/es.json) en propuestas para el panel (legal-proposals-raw.json)."""
    d = json.loads((ROOT / "data" / "analysis" / "content" / "es.json").read_text())
    out = []
    for lp in d.get("legal_pages", []):
        name = TITLES.get(lp.get("kind"), lp.get("title") or lp.get("kind"))
        for i in lp.get("issues", []):
            if i.get("type") == "seo":          # «sin H1»: la web nueva ya lo corrige con su propia estructura
                continue
            out.append({"type": "legal", "lang": "es", "product_name": f"{name} ({lp['url'].replace('https://grupotorivac.com', '')})", "field": i.get("type", ""),
                        "title": f"{name}: {i['detail'][:90]}{'…' if len(i['detail']) > 90 else ''}", "web_value": i["detail"], "pdf_value": None, "severity": SEV.get(i.get("severity"), "media"),
                        "recommendation": "Revisar con quien lleve lo legal (asesoría) y, si procede, corregir el texto en el original. La web nueva publica el texto tal cual; no se ha modificado nada.", "confidence": "alta",
                        "evidence": {"source": lp.get("source")}})
    for g in d.get("gaps", []):
        if "Razón social" in g:
            out.append({"type": "missing_data", "lang": "es", "product_name": "Datos del titular (aviso legal y privacidad)", "field": "titular", "title": "Falta la razón social completa y los datos registrales del titular", "web_value": "la ostenta: , con NIF: B60784584",
                        "pdf_value": None, "severity": "alta", "recommendation": "Indicar la denominación social completa (en el pie de página consta «Torivac S.L.») y los datos del Registro Mercantil. Pendiente de confirmar con el cliente.", "confidence": "alta"})
    (ROOT / "data" / "analysis" / "legal-proposals-raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"{len(out)} propuestas legales → data/analysis/legal-proposals-raw.json")


if __name__ == "__main__":
    main()
