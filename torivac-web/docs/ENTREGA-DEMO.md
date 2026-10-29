# Torivac · web nueva — guía de entrega

> **Esto no es la web oficial.** No se ha tocado grupotorivac.com (solo lecturas GET para copiar su contenido). La web nueva se prueba en un **subdominio de pruebas** (paquete para cPanel o Plesk) o, sin servidor, con el **demo** que se abre con doble clic.

## Dos formas de verla

### A) Demo sin servidor (doble clic)
1. Descomprime `torivac-demo.zip` y abre **`index.html`** (español). Idiomas: `en/index.html`, `fr/index.html`, `de/index.html` (también con el selector ES · EN · FR · DE del menú).
2. Recomendado: sirve la carpeta por http (`python3 -m http.server 8080` y abre http://localhost:8080). Con `file://` algunos navegadores no comparten bien el almacenamiento entre páginas (hay un respaldo, pero por http es 100 % fiable).
3. Panel: `admin/index.html`. Manager `manager@torivac.demo` / `Torivac-Manager-2026` · cliente `cliente@torivac.demo` / `Torivac-Cliente-2026` (acceso **solo de demostración**).
4. **Precios, envío del pedido y contacto están SIMULADOS** en este modo (precios inventados y marcados «DEMO»; el pedido genera el PDF y un borrador de correo, no envía nada).

### B) Subdominio de pruebas en tu hosting con Plesk o cPanel (real)
`python3 -I scripts/package_cpanel.py --base=https://pruebas.grupotorivac.com --staging` genera un `.zip` **verificado** (sin claves, sin tests, sin precios, PHP válido) con la web y el API PHP. Pasos de subida, configuración, correo, precios y cron: **[`DESPLIEGUE-PLESK.md`](DESPLIEGUE-PLESK.md)** (Plesk, con el paso posterior a cPanel) o **[`DESPLIEGUE-CPANEL.md`](DESPLIEGUE-CPANEL.md)**; el paquete es el mismo. El subdominio sale con `noindex` y cinta «entorno de pruebas».
Aquí **sí** funciona todo de verdad: pedidos por correo a `info@grupotorivac.com` y `mzamora@torivac.com` con el PDF adjunto (y copia al cliente), contacto, login real del panel, precios desde tu Drive.

## Qué puedes probar
- **Dos aspectos de la web**: **«Ficha técnica»** (identidad nueva, por defecto) y **«Clásico»** (el de la web original). Se alternan con el selector **Aspecto** de la cinta superior o del pie (o con `?tema=clasico` / `?tema=ficha` al final de la dirección) y el navegador recuerda la elección. Qué es cada uno y cómo se elige para producción: [`DISENO-TEMAS.md`](DISENO-TEMAS.md).
- **Pedido por cantidades como un e-commerce**: en cada ficha, tabla de modelos con cantidades → «Añadir» → botón flotante «Presupuesto» (cajón lateral) → página de presupuesto → «Enviar pedido».
- **La tienda** (ítem «Tienda» del menú, o el botón de «Productos»): todos los productos en un listado, con filtros por categoría, tensión y texto, orden por nombre, precio o categoría, y en cada tarjeta el precio y «Añadir al presupuesto» (si el producto tiene varios modelos, «Elegir modelo» lleva a la tabla de su ficha). Está en los tres aspectos y en los cuatro idiomas: [`DISENO-TEMAS.md`](DISENO-TEMAS.md) §1c.
- **Presupuesto en PDF** (descarga en el navegador, con logotipo, imágenes de referencia, tramos de precio y céntimos).
- **Importar CSV/Excel** con columnas «referencia» y «cantidad» en la página de presupuesto.
- **Etiquetas de voltaje** en 27 productos (filtro por tensión), sacadas de los PDF verificados o de frases literales de la ficha; lo dudoso no se etiqueta.
- **Referencias pedibles reales** (códigos de fabricante de los PDF) en 24 productos / 283 modelos; el resto se pide por línea genérica «consultar modelo».
- **Precios con céntimos y tramos por cantidad**. Se actualizan desde una hoja de Drive (cada 24 h y con el botón «Actualizar ahora»), subiendo un Excel/CSV con vista previa, o con una instrucción en castellano que la IA **propone** y tú confirmas: [`PRECIOS-DRIVE.md`](PRECIOS-DRIVE.md).
- **Idioma**: detección por el navegador (una sola redirección, solo desde páginas en español), aviso para cambiar o mantener y selector manual que siempre manda.
- **Propuestas** (panel → Propuestas): lo que no se ha dado por seguro — diferencias web ≠ PDF, traducciones que faltan, familias de los PDF sin ficha, textos legales. Nada dudoso se ha añadido a la web.

## Qué es REAL y qué es SIMULADO
| Cosa | Demo (doble clic) | Subdominio de pruebas (Plesk o cPanel) |
|---|---|---|
| Contenido (textos, imágenes, PDFs, categorías, 4 idiomas) | Real, copiado de grupotorivac.com; sin precios en el original | Igual |
| **Precios** | **DEMO** (inventados, marcados «DEMO»; no son tarifas de Torivac) | **Los que haya en tu hoja de Drive**; sin hoja, «Consultar». La web no lleva precios dentro |
| Envío del pedido / contacto | Simulado (PDF + borrador de correo) | **Real** (Resend → info@ y mzamora@) cuando se configura el correo |
| Login del panel | Solo demostración (credenciales en el código) | **Real** (usuarios con contraseña, sesiones firmadas) |
| Estadísticas (Google Business, Ads, Search Console, GA4) | Sin conectar | Sin conectar: faltan las credenciales de Torivac; el panel no muestra cifras inventadas |

## Cómo se ha comprobado (todo reproducible y sin red)
- `cd workers/api && npm test` · `php backend-php/api/tests/run.php`: pedidos, precios, hojas, lectura de `.xlsx`, login, IA, CORS… (el mismo contrato en Worker y en PHP).
- Navegador (Playwright), **contra el Worker y contra el API PHP**: `qa-live.mjs` (pedido/contacto/errores), `qa-admin-live.mjs` (panel completo), `qa-tarifa.mjs` (tarifa Excel real), y `qa-package.mjs` (el paquete tal como se sube, con la CSP real del `.htaccess`).
- Aspectos: `qa-theme.mjs` (selector, persistencia, fuentes, sin JS, sin desbordes en los dos aspectos, hoja por capas) y `qa-ux` / `qa-a11y` con ambos.
- Calidad de la web: `qa-quote` (presupuesto en 4 idiomas con cálculo independiente), `qa-lang`, `qa-ux` (todas las páginas, escritorio y móvil), `qa-a11y` (axe-core AA), `qa-art`, `seo_check.py` (H1, canonical, hreflang, JSON-LD, sitemap, enlaces), `perf.mjs`, `secret_scan.py`.
- **Lo único que no se ha podido probar aquí** es un Apache/LiteSpeed real de cPanel ni un Plesk real: se probó con `php -S` aplicando la misma reescritura y la misma CSP, y lo propio de Plesk (nginx delante de Apache, IP del visitante, carpeta de datos) con pruebas que simulan sus cabeceras y permisos y con su documentación. La primera subida se verifica con `php api/tools/check.php --net` (o *Ajustes → Diagnóstico* del panel) y la lista de `DESPLIEGUE-PLESK.md` §10 o `DESPLIEGUE-CPANEL.md` §10.

## Qué se hizo distinto a lo previsto (y por qué)
1. **Enlace producto ↔ PDF y contrastes**: el análisis con agentes (tres procesos largos) se cortó por el límite de uso. No se reanudó: se hizo con **scripts deterministas** (`link_pdfs`, `contrast_pdfs`, `web_vs_pdf`, `enrich_catalog`), reproducibles y sin IA, que además dejan cada duda como propuesta con su evidencia. Resultado: 42 familias de los catálogos PDF contrastadas ES↔EN, tablas web ↔ PDF comparadas, 283 modelos pedibles.
2. **Tabla de la ficha «Transformador Serie TT»**: la de la web original **no coincide con el PDF ni con tu tarifa de Drive** (códigos que no existen, tensiones desplazadas). La web nueva muestra los 28 modelos verificados y oculta esa tabla (reversible: `data/catalog/content-overrides.json`); queda la propuesta `PR-17604` para que lo confirmes.
3. **Backend PHP para cPanel y Plesk** (además del Worker de Cloudflare): lo pediste para hostings con cPanel (las pruebas están ahora en un Plesk), así que el API completo (pedidos, contacto, precios, panel, IA de precios, cron) corre también en PHP sin base de datos. El Worker sigue disponible como alternativa.
4. **Lectura de la tarifa real**: formato «Artículo · Descripción · Precio venta» con 8 decimales, referencias nuevas dentro de su familia verificada y lectura directa del `.xlsx` en Drive. Se rechaza el precio de relleno (la hoja «Torivac Precios» trae uno, 22 000, y filas por producto en vez de por modelo).

## Decisiones tuyas (pendientes)
1. **¿Precios públicos o solo para clientes registrados?** Hoy son públicos (la web original no tenía precios). Cambiarlo es pequeño; mientras tanto, en el subdominio de pruebas no cargues la tarifa real salvo que lo restrinjas por IP.
2. **Decimales del precio unitario**: 4 por defecto (`27,75093203 → 27,7509`; la línea se redondea a 2). Configurable hasta 6.
3. **Cómo conectar Drive**: descarga directa del `.xlsx` con enlace (más simple) o cuenta de servicio de Google (privada): [`PRECIOS-DRIVE.md`](PRECIOS-DRIVE.md) §8.
4. **Resend**: verificar `grupotorivac.com` (SPF/DKIM en el DNS, sin tocar el correo actual) para enviar desde `pedidos@grupotorivac.com`.
5. **Dominio/subdominio de pruebas** (ahora en Plesk: `torivac.santisomarketing.com`), el paso a cPanel (final de `DESPLIEGUE-PLESK.md`) y, más adelante, el cambio de DNS (`DESPLIEGUE-CPANEL.md` §12).
6. **Propuestas del panel** (116): aprobar o descartar; las legales (15) requieren a quien lleve lo jurídico.
7. **Traducciones inexistentes en el original** (variador portátil, SAI, 2 onduladores y fuente de CA; «Trifásico manual» sin alemán): la web nueva muestra el español con aviso. **La web nueva no usa WPML ni ningún plugin de idioma** (HTML estático con selector y detección propios); WPML solo se consultó, en lectura, para emparejar traducciones.

Hallazgos del sitio original (errores, discrepancias web ≠ PDF, textos copiados entre fichas): [`01-analisis/HALLAZGOS.md`](01-analisis/HALLAZGOS.md). Guía para programadores: [`DOCUMENTACION.md`](DOCUMENTACION.md) · índice de código: [`INDICE-CODIGO.md`](INDICE-CODIGO.md).
