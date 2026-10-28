# Torivac · demo de la web nueva — guía de entrega

> **Esto es una demo, no la web oficial.** No se ha tocado grupotorivac.com (solo se han hecho lecturas GET para copiar su contenido).

## Cómo abrirla
1. Descomprime `torivac-demo.zip` y abre **`index.html`** con doble clic (español).
   Idiomas: `en/index.html`, `fr/index.html`, `de/index.html` (también se elige con el selector ES · EN · FR · DE del menú).
2. **Recomendado** para probar el carrito sin sorpresas del navegador: sirve la carpeta por http
   (`python3 -m http.server 8080` dentro de la carpeta y abre http://localhost:8080). Al abrirla con doble clic (`file://`)
   algunos navegadores no comparten bien el almacenamiento entre páginas; hay un respaldo, pero por http es 100 % fiable.
3. Panel de gestión: `admin/index.html`.
   - Manager: `manager@torivac.demo` / `Torivac-Manager-2026`
   - Cliente: `cliente@torivac.demo` / `Torivac-Cliente-2026`
   (acceso **solo de demostración**; el login real va en el Worker, ver más abajo).

## Qué puedes probar
- **Pedido por cantidades como un e-commerce**: en cada ficha, tabla de modelos con cantidades → «Añadir» → botón flotante «Presupuesto» (cajón lateral) → página de presupuesto.
- **Presupuesto en PDF** (descarga en el navegador, con logotipo, imágenes de referencia, tramos de precio y céntimos) y **«Enviar pedido»**.
- **Importar CSV/Excel** con columnas «referencia» y «cantidad» en la página de presupuesto.
- **Precios con variaciones de céntimos y tramos por cantidad** (1, 10, 50, 200 uds.). Se actualizan cargando un Excel/CSV (hoja `precios.demo.xlsx` / `.csv` en `assets/data/`) o con una instrucción en lenguaje natural desde el panel.
- **Idioma**: detección por el idioma del navegador (una sola redirección, solo desde páginas en español), aviso para cambiar o mantener y selector manual que siempre manda.
- **Propuestas** (panel → Propuestas): diferencias web ≠ PDF y traducciones que faltan. Nada dudoso se ha añadido a la web; queda para tu aprobación.

## Qué es REAL y qué es SIMULADO
| Cosa | Estado |
|---|---|
| Contenido (textos, imágenes, PDFs, categorías, 4 idiomas) | Real, copiado de grupotorivac.com; sin precios en el original |
| **Precios** | **DEMO** (inventados, marcados «DEMO» en pantalla y en el PDF). No son tarifas de Torivac |
| Envío del pedido / contacto en la demo | **Simulado**: genera el PDF y un borrador de correo; no se envía nada |
| Login del panel | Solo demostración (credenciales en el código) |
| Etiquetas de voltaje y referencias pedibles por modelo | Parcial: pendiente de terminar el enlace producto ↔ PDF (ver «Pendiente») |

## Producción (ya construida y probada, sin desplegar)
`workers/api/` — Worker de Cloudflare `torivac-api`: pedidos por email (Resend) a **info@** y **mzamora@** con el PDF adjunto y copia al cliente,
precios desde Google Sheets/CSV con cron cada 24 h + actualización manual, login manager/cliente (PBKDF2 + sesión firmada), límite de intentos, CORS, honeypot.
14 pruebas del Worker + prueba de extremo a extremo navegador → Worker (`node scripts/qa-live.mjs`). Para activarlo: `workers/api/README.md` y compilar la web con `TORIVAC_API=https://…`.

## Pruebas automáticas (todas en verde a la hora de entrega)
`node scripts/qa-quote.mjs` (presupuesto realista en 4 idiomas, totales y PDF) · `qa-lang.mjs` (idiomas) · `qa-live.mjs` (web + Worker) · `smoke.mjs` · `smoke-admin.mjs` · `cd workers/api && npm test`.

## Pendiente / decisiones tuyas
1. **Destinatarios**: ¿`info@torivac.com` o `info@grupotorivac.com`? ¿`mzamora@torivac.com`? (hoy figuran como «por confirmar»).
2. **Hosting** del dominio de prueba (propuesta: Cloudflare Pages + el Worker) y de dónde saldrán los **precios reales** (Excel en Drive).
3. Enlace producto ↔ PDF (referencias pedibles reales, etiquetas de voltaje, fichas) y verificación de los PDF: el análisis se cortó por el límite de uso de las 5 h; se relanza y todo lo dudoso irá a «Propuestas».
4. Traducciones que faltan en el original (variador portátil, SAI, 2 onduladores y fuente de CA; «Trifásico manual» sin alemán): se buscaron leyendo las redirecciones públicas de WPML de la web original y **no hay traducción publicada**; mientras tanto la web nueva muestra el español con aviso. **La web nueva no usa WPML ni ningún plugin de idioma** (HTML estático con selector y detección propios); WPML solo se consultó, en lectura, para emparejar traducciones al migrar.
5. Gráficos extra (sesión 12), documentación para programadores (sesión 15) y la sesión final de revisión para superar la versión de Why Not (sesión 16).

Hallazgos del sitio original (errores, discrepancias web ≠ PDF, textos copiados entre fichas): `docs/01-analisis/HALLAZGOS.md`.
