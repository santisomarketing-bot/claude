#!/usr/bin/env bash
# Reconstruye TODO el demo a partir de los datos ya cosechados/analizados (orden importa).
#   bash scripts/rebuild.sh            # contenido + catálogo + precios + sitio
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -I scripts/build_catalog.py          # contenido original → data/catalog (products.base.json)
python3 -I scripts/enrich_catalog.py         # + variantes/voltaje/propuestas desde PDFs verificados (si existen)
python3 -I scripts/make_thumbs.py            # miniaturas para el PDF + logo + favicon
python3 -I scripts/build_prices.py ${PRICES_ARGS:---demo}   # hoja de precios (DEMO por defecto)
node site/build.mjs "$@"                     # sitio estático → dist/
