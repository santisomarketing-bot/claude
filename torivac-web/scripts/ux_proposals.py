#!/usr/bin/env python3
"""Sesión 10 · Convierte los hallazgos de idioma de scripts/qa-ux.mjs en PROPUESTAS para el panel (nunca cambia la web).

  node scripts/qa-ux.mjs && python3 -I scripts/ux_proposals.py     # lee data/analysis/qa-ux-desktop.json → data/analysis/ux-proposals-raw.json

Un texto «en otro idioma» es esperable cuando la ficha/categoría no tiene traducción en el original (la web nueva muestra el español CON aviso:
ya lo cubren las propuestas «missing_translation»). Aquí solo se registran los casos NO esperables:
  · texto en un idioma que NO es el español ni el de la página (p. ej. neerlandés dentro de una página alemana: así está en el original)
  · texto en español dentro de una página traducida SIN aviso de «sin traducir»
enrich_catalog.py los fusiona con el resto de propuestas.
"""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = {"es": "español", "en": "inglés", "fr": "francés", "de": "alemán", "nl": "neerlandés"}


def main():
    """Convierte los textos en otro idioma no esperables de qa-ux-desktop.json en propuestas (ux-proposals-raw.json)."""
    d = json.loads((ROOT / "data" / "analysis" / "qa-ux-desktop.json").read_text())
    by_text = defaultdict(list)
    for r in d["results"]:
        page_lang = r["url"].strip("/").split("/")[0] if r["url"].strip("/").split("/")[0] in ("en", "fr", "de") else "es"
        for t in r.get("lang") or []:
            det, _, txt = t.partition(": ")
            expected_fallback = det == "es" and r.get("notice")
            if not expected_fallback:
                by_text[(page_lang, det, txt)].append(r["url"])
    out = []
    for (page_lang, det, txt), urls in sorted(by_text.items(), key=lambda kv: (kv[0][0], kv[0][2])):
        out.append({
            "type": "wrong_language", "lang": page_lang, "product_name": urls[0], "field": "texto visible",
            "title": f"Texto en otro idioma dentro de la web en {LANGS[page_lang]}",
            "web_value": txt.strip("«»"), "pdf_value": None, "pages": urls[:6], "severity": "media",
            "recommendation": f"El texto parece estar en {LANGS.get(det, det)} (o en neerlandés) y aparece en {len(urls)} página(s) en {LANGS[page_lang]}. Es así en la web original; la web nueva lo respeta. Revisar y traducir antes de publicar.",
            "confidence": "media",
        })
    (ROOT / "data" / "analysis" / "ux-proposals-raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"{len(out)} propuestas de idioma → data/analysis/ux-proposals-raw.json")


if __name__ == "__main__":
    main()
