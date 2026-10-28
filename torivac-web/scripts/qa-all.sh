#!/usr/bin/env bash
# [QA-ALL] Todas las pruebas del proyecto, una tras otra, con resumen final (la CI hace lo mismo en ci/ci.yml).
#   bash scripts/qa-all.sh             # todo (unos 15-25 min; qa-ux recorre las ~770 páginas en escritorio y en móvil)
#   bash scripts/qa-all.sh --rapido    # sin qa-ux, qa-a11y ni perf (unos 4-6 min)
# Necesita: node 22, python3 + openpyxl, php 8, Playwright (npm i --no-save playwright), y axe-core para qa-a11y (AXE_PATH=/ruta/axe.min.js).
# Cada paso tiene un tiempo máximo de 20 min; si uno se pasa se corta y se marca como fallo (probablemente un bug: revisar).
set -u
cd "$(dirname "$0")/.."
RAPIDO=0; [ "${1:-}" = "--rapido" ] && RAPIDO=1
PASOS=(); RES=()
paso() {  # paso "nombre" comando…  → ejecuta, anota ✓/✗ y el tiempo
  local nombre="$1"; shift
  local t0=$SECONDS
  echo; echo "━━━ $nombre"
  if timeout 1200 "$@"; then RES+=("✓"); else RES+=("✗"); fi
  PASOS+=("$nombre ($((SECONDS - t0)) s)")
}
paso "Escáner de secretos"                      python3 -I scripts/secret_scan.py
paso "Índice de código (cabeceras y funciones)" python3 -I scripts/gen_code_index.py --check
paso "Worker: pruebas"                          bash -c 'cd workers/api && npm test'
paso "PHP: pruebas"                             php backend-php/api/tests/run.php
paso "Compilar el demo (precios de demostración)" bash -c 'python3 -I scripts/build_prices.py --demo && node site/build.mjs'
paso "Compilar producción + auditoría SEO/GEO"  bash -c 'node site/build.mjs --base=https://demo.torivac.example --out=/tmp/tv-prod-dist >/dev/null && python3 -I scripts/seo_check.py /tmp/tv-prod-dist --base=https://demo.torivac.example'
paso "Humo del demo (file://)"                  node scripts/smoke.mjs
paso "Humo del panel (file://)"                 node scripts/smoke-admin.mjs
paso "Presupuesto en 4 idiomas"                 node scripts/qa-quote.mjs
paso "Idioma"                                   node scripts/qa-lang.mjs
paso "Gráficos"                                 node scripts/qa-art.mjs
for B in "" "--php"; do
  paso "Web ↔ backend ${B:-worker}: pedido y contacto"  node scripts/qa-live.mjs $B
  paso "Panel ↔ backend ${B:-worker}"                   node scripts/qa-admin-live.mjs $B
  paso "Tarifa Excel ↔ backend ${B:-worker}"            node scripts/qa-tarifa.mjs $B
done
paso "Paquete de cPanel tal como se sube"       node scripts/qa-package.mjs
if [ "$RAPIDO" = 0 ]; then
  paso "UX de todas las páginas (escritorio)"   node scripts/qa-ux.mjs
  paso "UX de todas las páginas (móvil)"        node scripts/qa-ux.mjs --mobile
  paso "Accesibilidad AA (axe-core)"            node scripts/qa-a11y.mjs
  paso "Rendimiento en móvil"                   node scripts/perf.mjs --dir=/tmp/tv-prod-dist
fi
echo; echo "━━━ RESUMEN"
FALLOS=0
for i in "${!PASOS[@]}"; do echo "${RES[$i]} ${PASOS[$i]}"; [ "${RES[$i]}" = "✗" ] && FALLOS=$((FALLOS + 1)); done
echo; [ "$FALLOS" = 0 ] && echo "✓ todo en verde" || echo "✗ $FALLOS paso(s) con fallos"
exit "$FALLOS"
