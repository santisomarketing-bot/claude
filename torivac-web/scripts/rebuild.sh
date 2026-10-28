#!/usr/bin/env bash
# Reconstruye TODO el demo a partir de los datos ya cosechados/analizados (orden importa).
#   bash scripts/rebuild.sh            # contenido + catálogo + precios + sitio
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -I scripts/build_catalog.py          # contenido original → data/catalog (products.base.json)
python3 -I scripts/contrast_pdfs.py          # catálogo ES vs EN: divergencias → propuestas
python3 -I scripts/link_pdfs.py              # ficha de producto ↔ familia del PDF verificado (alta/media/baja)
python3 -I scripts/web_vs_pdf.py             # tablas de la web vs tablas del PDF → propuestas
python3 -I scripts/enrich_catalog.py         # + variantes pedibles, etiquetas de voltaje y propuestas (solo confianza alta; lo dudoso va al panel)
python3 -I scripts/make_thumbs.py            # miniaturas para el PDF + logo + favicon
python3 -I scripts/build_prices.py ${PRICES_ARGS:---demo}   # hoja de precios (DEMO por defecto)
node site/build.mjs "$@"                     # sitio estático → dist/
