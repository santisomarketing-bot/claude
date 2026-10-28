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
paso "Texto plano (navegador = Worker = PHP)"    node scripts/test-plain-text.mjs
paso "Conversor de texto del blog"              node scripts/test-blog-markdown.mjs
paso "Conversor del blog: JavaScript = PHP"       node scripts/test-blog-markdown-php.mjs
paso "Propuestas aprobadas con texto propio"    node scripts/test-proposals.mjs
paso "Textos de interfaz al día (para validar)" node scripts/audit_i18n.mjs --check
paso "Compilar el demo (precios de demostración)" bash -c 'python3 -I scripts/build_prices.py --demo && node site/build.mjs'
paso "Compilar producción + auditoría SEO/GEO"  bash -c 'node site/build.mjs --base=https://demo.torivac.example --out=/tmp/tv-prod-dist >/dev/null && python3 -I scripts/seo_check.py /tmp/tv-prod-dist --base=https://demo.torivac.example'
paso "Humo del demo (file://)"                  node scripts/smoke.mjs
paso "Humo del panel (file://)"                 node scripts/smoke-admin.mjs
paso "Presupuesto en 4 idiomas"                 node scripts/qa-quote.mjs
paso "Idioma"                                   node scripts/qa-lang.mjs
paso "Gráficos"                                 node scripts/qa-art.mjs
paso "Aspectos (Ficha técnica / Clásico)"       node scripts/qa-theme.mjs
for B in "" "--php"; do
  paso "Web ↔ backend ${B:-worker}: pedido y contacto"  node scripts/qa-live.mjs $B
  paso "Panel ↔ backend ${B:-worker}"                   node scripts/qa-admin-live.mjs $B
  paso "Tarifa Excel ↔ backend ${B:-worker}"            node scripts/qa-tarifa.mjs $B
done
paso "Paquete del hosting tal como se sube"     node scripts/qa-package.mjs
paso "Apache real + PHP-FPM (.htaccess de verdad)" node scripts/qa-apache.mjs
paso "Blog en Apache real (SEO, sitemap, llms)"   node scripts/qa-blog-apache.mjs
paso "Blog: editor del panel en un navegador"   node scripts/qa-blog-panel.mjs
paso "Actualizar sin caché vieja"               node scripts/qa-update.mjs
if [ "$RAPIDO" = 0 ]; then
  paso "UX de todas las páginas (escritorio)"   node scripts/qa-ux.mjs
  paso "UX de todas las páginas (móvil)"        node scripts/qa-ux.mjs --mobile
  paso "Accesibilidad AA (axe-core)"            node scripts/qa-a11y.mjs
  paso "Rendimiento en móvil"                   node scripts/perf.mjs --dir=/tmp/tv-prod-dist
  # el segundo aspecto (Clásico) se vuelve a pasar por UX (muestra de 80 páginas) y accesibilidad; al final se deja dist/ con el aspecto por defecto
  paso "Compilar el demo en aspecto Clásico"    bash -c 'node site/build.mjs --theme=clasico >/dev/null'
  paso "UX (Clásico, escritorio, muestra)"      node scripts/qa-ux.mjs --limit=80 --out=/tmp/qa-ux-clasico-desktop.json
  paso "UX (Clásico, móvil, muestra)"           node scripts/qa-ux.mjs --mobile --limit=80 --out=/tmp/qa-ux-clasico-mobile.json
  paso "Accesibilidad AA (Clásico)"             node scripts/qa-a11y.mjs
  paso "Volver a compilar el demo (Ficha técnica)" bash -c 'node site/build.mjs >/dev/null'
fi
echo; echo "━━━ RESUMEN"
FALLOS=0
for i in "${!PASOS[@]}"; do echo "${RES[$i]} ${PASOS[$i]}"; [ "${RES[$i]}" = "✗" ] && FALLOS=$((FALLOS + 1)); done
echo; [ "$FALLOS" = 0 ] && echo "✓ todo en verde" || echo "✗ $FALLOS paso(s) con fallos"
exit "$FALLOS"
