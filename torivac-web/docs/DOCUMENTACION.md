# Torivac · documentación para programadores

Guía para quien tenga que **mantener o ampliar** la web nueva de Torivac. Complementa a `ARQUITECTURA.md` (contrato de datos), `PLAN.md` (sesiones),
`INDICE-CODIGO.md` (índice generado: cada archivo y cada función), `CONVENCIONES.md` (etiquetas del código), `ENTREGA-DEMO.md` (qué es real y qué es simulado), `ACTUALIZAR-SIN-ROMPER.md` (cómo publicar cambios con una vuelta atrás), `SEGURIDAD.md` (medidas, pruebas y límites), `CORREO.md` (SMTP, Brevo o Resend; probar y arreglar el envío), `PROPUESTAS.md` (editar, probar y aplicar las mejoras del panel) y `SESION-21.md` (lo siguiente).

## 1. Qué es
Una web **100 % estática** (HTML + CSS + JS vanilla, sin frameworks) que replica grupotorivac.com en 4 idiomas (es en la raíz, `/en`, `/fr`, `/de`) y añade:
pedido por referencia y cantidad (estilo e-commerce, sin pasarela de pago), **presupuesto en PDF** con imágenes, **etiquetas de voltaje**, **precios** desde una hoja
(Excel/Google Sheets) y un **panel** con dos roles (manager / cliente). Lo único dinámico vive en un **backend con contrato único**, con dos implementaciones intercambiables: el Worker de Cloudflare (`workers/api`) o el API PHP para un hosting con Apache y PHP: cPanel o Plesk (`backend-php/api`).

Dos modos de la misma base de código:

| | Demo (`node site/build.mjs`) | Producción con API PHP en cPanel o Plesk (`scripts/package_cpanel.py --base=https://dominio`) | Producción con Worker (`TORIVAC_API=https://… node site/build.mjs --base=https://dominio`) |
|---|---|---|---|
| Se abre con | doble clic (`file://`) o cualquier servidor | hosting cPanel o Plesk (Apache/LiteSpeed) | cualquier hosting estático (cPanel, Cloudflare Pages…) |
| Precios | `prices.demo.*` (inventados, marcados DEMO) | **ninguno en la web**: los lee de `/api/prices` (hoja de Drive, cron 24 h + botón manual) | igual, desde el Worker |
| Envío de pedido/contacto | simulado (PDF + borrador `mailto:`) | `POST /api/order` y `/api/contact` → correo (SMTP del buzón, Brevo o Resend: info@ + mzamora@ + copia al cliente) y, el contacto, guardado en *Mensajes* | igual |
| Panel `/admin/` | `admin.js` (credenciales de demo en el código) | `admin-live.js` (login real, datos del servidor) | igual |
| CSS / fuentes | 1 `site.css` legible (dos aspectos en capas) + fuentes en base64 (para `file://`) | 1 `site.css` minificado + fuentes `woff2` | igual |
| SEO y servidor | sin canonical/sitemap | canonical, hreflang, JSON-LD, sitemap con imágenes, `llms.txt`, `robots.txt`, **`.htaccess`** (HTTPS, host único, 301, caché, CSP), 404 por idioma, URLs limpias | igual (el `.htaccess` solo si el estático va a cPanel/Plesk) |

## 2. Mapa del repositorio
```
data/
  raw/            HTML y JSON de la web original (NO versionado: ~100 MB; se regenera con scripts/harvest.mjs)
  analysis/       análisis intermedios (estructura, PDFs, productos, WPML, hallazgos de UX/legales)
  catalog/        FUENTE ÚNICA DE VERDAD de la web: categories, products, pages, meta, prices, proposals, voltage-tags, image-map…
site/
  build.mjs       generador (lee data/catalog → escribe dist/)           templates.mjs  plantillas HTML (funciones puras)
  lib/            i18n.mjs (textos UI ×4 idiomas) · render.mjs (enlaces, bloques, imágenes) · seo.mjs (JSON-LD, OG) · hosting.mjs (.htaccess, robots.txt, 404, reglas del blog) · blog-shell.mjs (plantillas del blog del panel)
  assets/         css/ (tokens, base, layout, components, art, admin) · js/ (quote, app, shop, pdf, quote-page, contact, forms, captcha, lab, admin, admin-live, admin-blog, admin-proposals, admin-security) · vendor/ · fonts/ · img/
workers/api/      Worker torivac-api (pedidos, contacto, precios, login, IA de precios, propuestas) + pruebas (`npm test`)
backend-php/api/  el MISMO API en PHP para cPanel o Plesk: Router, Orders, Prices/Sheets, Xlsx, Auth/Users, Ai, Mail, Store (ficheros JSON), Diag, **Blog/BlogApi/BlogPage/BlogMarkdown + page.php (blog del panel, solo PHP)**, **Security/Audit/Backup (código por correo, actividad y copias, solo PHP)**, tools/ (create-user, check, backup, restore), cron.php + pruebas (`php tests/run.php`)
shared/           código y casos de prueba que comparten JS y PHP: price-sheet.mjs (lector de hojas), xlsx.mjs (lector de .xlsx), plain-text.mjs (formularios), blog-markdown.mjs (conversor del blog), fixtures
scripts/          cosecha y construcción del catálogo (Python/Node) + todas las pruebas de calidad (qa-*.mjs, seo_check.py, perf.mjs…)
ci/               plantillas de GitHub Actions (ci.yml, deploy.yml) para copiar a .github/workflows/
docs/             esta documentación, plan, arquitectura, hallazgos de la web original, índice de código
dist/             salida generada (se puede borrar y regenerar)
```

## 3. Flujo de datos (de la web original a `dist/`)
```
harvest.mjs ──► data/raw ──► prepare.py ──► data/analysis ──► build_catalog.py ──► data/catalog/*.base.json
                                                              enrich_catalog.py ──► products.json, proposals.json   (variantes, voltaje, PDFs, propuestas)
                                                              make_thumbs.py    ──► thumbs.json, logo.png, favicon
                                                              build_prices.py   ──► prices.json, prices.demo.{csv,xlsx}
                                                              site/build.mjs    ──► dist/ (+ workers/api/src/generated/items.js)
```
`bash scripts/rebuild.sh` ejecuta la cadena completa desde `data/analysis` (orden importa). Sin `data/raw` (p. ej. en CI) basta con
`python3 -I scripts/build_prices.py --demo && node site/build.mjs` porque `data/catalog/*.json` está versionado.

Reglas de oro: (1) **nunca se escribe en la web original** (solo `GET`); (2) **no se inventa nada**: lo dudoso va a `proposals.json` y se aprueba en el panel;
(3) el HTML se genera, no se edita a mano; (4) el contenido visible es el original (los precios son lo único nuevo).

## 4. Contrato de datos (`data/catalog/`)
- **categories.json** — `[{id, parent, count, slug{lang}, name{lang}, path{lang}, description{lang}[bloques], image, seo, ids{lang}, matched_by{lang}, wpml_conflict{lang}}]`.
  Las traducciones salen de la redirección de WPML de la web original **si respeta el árbol** (`build_catalog.py → build_categories`); si no, hreflang o coincidencia de productos.
- **products.json** — `{id, sku, slug{}, path{}, name{}, short{}, description{}, seo{}, translation_status{lang}, images[{file,thumb,w,h,alt{}}], category_ids, attributes, pdfs[{url,label}],
  voltage_tags[], variants[{ref, label, specs{col:{raw,value,unit}}, voltage_tags[], source{type,file,page,family}, confidence}], power{min,max,unit}, related[]}`.
  Sin `variants` la ficha muestra una línea genérica `P<id>` («consultar modelo»).
- **pages.json** — `pages[lang][ruta] = {kind:'home|page|post', title, meta_description, alternates{}, sections[{id, form, blocks[]}], date?, featured?}`.
  Bloques: `h{l,x}` · `p{h,q?}` · `ul{i[],o?}` · `table` · `img{img,alt,href}` · `btn{x,href,pdf?}`.
- **prices.json** — `{updated_at, source, currency, mode:'demo|live', items:{ref:{p, t:[[cantMin, precio]…], note}}}`. Precio unitario hasta 4 decimales; importe de línea redondeado a 2.
  Hoja: `ref, product_id, name_es, unit, currency, price, qty2, price2, qty3, price3, qty4, price4, note, active, updated_at`.
- **proposals.json** — cambios dudosos para aprobar (`web_vs_pdf`, `missing_translation`, `wrong_language`, `wpml_link`, `legal`, `missing_data`…). No se publican solos.
- **voltage-tags.json** — taxonomía cerrada de etiquetas (`230V-AC`, `400V-3F`, `0-230V-AC`…) con `label`, `kind`, `min/max`.
- **meta.json** — empresa, contacto, destinatarios (`order_recipients`, marcados POR CONFIRMAR), menús, pie.

## 5. El generador (`site/build.mjs`)
Secciones `[LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS] [CSS] [SEO-FILES]`. Banderas de aspecto: `--theme=ficha|clasico` y `--theme-switch`/`--no-theme-switch` ([`DISENO-TEMAS.md`](DISENO-TEMAS.md)). Emite por idioma: portada, «Productos» (solo las categorías), **la tienda con todos los productos** (`/tienda/`, `/en/shop/`, `/fr/boutique/`, `/de/shop/`), categorías (con sus subcategorías), fichas, blog, contacto,
presupuesto (`/presupuesto/`, `/en/quote/`, `/fr/devis/`, `/de/angebot/`), páginas genéricas y legales, redirecciones de rutas fusionadas y `/admin/`. Los enlaces son **relativos y terminan en `index.html`**
(así funciona por `file://`).
Opciones: `--base=URL` (modo producción: URLs limpias, SEO, `.htaccess`, `robots.txt`, 404 por idioma), `--out=carpeta`, `--staging` (entorno de pruebas: `noindex`, `robots.txt` cerrado, cinta),
`--php-api` (el API vive en `/api` de la propia web) y variable `TORIVAC_API` (URL del Worker). Una compilación con API (**LIVE**) nunca lleva precios de demostración ni más de un destinatario en el código público.
También escribe `assets/data/*.js` (datos para el navegador como globales `TV.*`), `workers/api/src/generated/items.js` y `backend-php/api/generated/catalog.json` (referencias pedibles que cada backend usa para validar).

## 6. Front-end
- **Sin JS la web se lee y navega**; el JS añade presupuesto, filtros, PDF, idioma, gráficos. Datos para el navegador: `TV.meta`, `TV.i18n`, `TV.items`, `TV.thumbs`, `TV.logo`, `TV.prices`, `TV.proposals`, `TV.admin`.
- **`quote.js`** — API `TV.Quote` (`add/set/remove/clear/detail/priceOf/tiersOf/importRows/onChange`), formato de importes por idioma, `TV.csvParse` (RFC 4180), `TV.refreshPrices`, `TV.api` (llamadas al Worker).
  El presupuesto vive en `localStorage` (`tv_quote_v1`); en `file://` hay un respaldo en `window.name` porque Chrome a veces entrega un almacenamiento vacío entre ficheros.
- **`app.js`** — menú, cajón del presupuesto, botones flotantes, detección de idioma, sello de precios, arte toroidal. **`shop.js`** — filtros por categoría/tensión/búsqueda, orden, precio y compra rápida de las tarjetas de la tienda, tabla de modelos, galería.
  **`pdf.js`** — `TV.makeQuotePdf` (jsPDF + autoTable locales). **`quote-page.js`** — tabla editable, importar CSV/Excel, enviar (demo/real). **`contact.js`**. **`lab.js`** — osciloscopio del variador.
- **Idioma**: elección manual > idioma del navegador. Redirección automática **una sola vez** y **solo desde páginas en español**; en `/en/`, `/fr/`, `/de/` solo se ofrece un aviso. Claves: `tv_lang`, `tv_lang_src`, `tv_lang_auto_done`.
- **CSS**: todo sale de tokens (`tokens.css`; `ficha-tokens.css` en el aspecto nuevo); nunca colores o fuentes sueltos. `art.css` = piezas gráficas. Contraste AA, foco visible, `prefers-reduced-motion` respetado. **Dos aspectos** (Ficha técnica, por defecto, y Clásico) en capas de una sola hoja: [`DISENO-TEMAS.md`](DISENO-TEMAS.md).
- **Accesibilidad**: landmarks, «saltar al contenido», un H1, niveles de encabezado sin saltos (`headingOrder` usa `aria-level` para no cambiar el diseño), `alt` en todas las imágenes.
- **Textos de interfaz**: `site/lib/i18n.mjs` (objeto `T` con es/en/fr/de). Para **añadir un idioma**: añadirlo a `LANGS`, a cada clave de `T`, a `meta.json` (menús/pie) y a `scripts/build_catalog.py`.

## 7. Backend: Worker `torivac-api` (`workers/api`) o API PHP (`backend-php/api`)
Mismas rutas, mismas respuestas, mismas reglas: se elige según el hosting y **los guiones de prueba corren contra los dos** (`--php`). Worker: variables y puesta en marcha en `workers/api/README.md`.
PHP: `docs/DESPLIEGUE-CPANEL.md` o `docs/DESPLIEGUE-PLESK.md`; datos en ficheros JSON de una carpeta (misma estructura de claves que KV, con `flock` para contadores) que elige `Store::bootstrap`: `storage_dir` si sirve, un almacén que ya tenga datos, `/home/CUENTA/torivac-datos` (fuera de la web) o `api/storage` (protegida con `.htaccess`); configuración en `api/config.php`, `cron.php` para los precios y
`tools/check.php` / `GET /api/diag` para diagnosticar la instalación. La IP del visitante (límites de uso) la calcula `Request::clientIp`: `REMOTE_ADDR`, y solo detrás de un proxy de confianza (nginx de Plesk, Cloudflare, `trusted_proxies`) la cadena `X-Forwarded-For` de derecha a izquierda. Claves KV (o ficheros): `user:<email>`, `order:<nº>`, `prices:current|meta|history:<ts>`, `proposals:state`, `rl:<bucket>:<id>`, `counter:<aaaammdd>`, y las del blog `blog:post:<id>`, `blog:slug:<idioma>:<slug>`, `blog:ix:<idioma>`, `blog:media:<archivo>` (las imágenes, en `<datos>/media/`). **El blog solo existe en el API PHP**: el Worker responde 501 `blog_unavailable` y `/api/health` dice `features.blog` (ver [`BLOG.md`](BLOG.md)).
**Precios**: `Sheets::plan` (PHP) / `planPrices` (Worker) decide qué se publica —solo lo que trae la hoja («merge», por defecto) o toda la lista («replace»)— y qué exige confirmar (relleno, cambio masivo); la vista previa y la subida usan el mismo plan. La hoja se lee de un Excel/Hoja de Drive (cuenta de servicio, descarga directa del `.xlsx` o CSV) con `shared/price-sheet.mjs` (+ port PHP) y `shared/xlsx.mjs` (+ port PHP): ver `docs/PRECIOS-DRIVE.md`.
Seguridad: PBKDF2 (100 k) + sesión firmada HMAC, límite de intentos de login, CORS por lista de orígenes, honeypot y límite por IP en pedidos/contacto, Turnstile opcional,
**el servidor revalora siempre el pedido** (ignora precios del navegador), la hoja nueva se rechaza si pierde >50 % de las referencias, la IA de precios solo propone y exige confirmación.

## 8. Panel
`/admin/` carga `admin.js` (demo, sin servidor) o `admin-live.js` (real). Manager: Resumen · Pedidos · Precios (estado, sincronizar, subir Excel/CSV con vista previa, instrucción con IA) · Propuestas ·
Contenido · **Blog** (`admin-blog.js`: listado, editor con vista previa, imágenes, SEO, programar y traducciones; [`BLOG.md`](BLOG.md)) · **Usuarios** (`admin-security.js`: último acceso, código por correo, bloqueos y «Desbloquear», contraseña nueva) · **Actividad** (quién entró y quién cambió qué, con filtros y CSV) · Estadísticas · **Ajustes** (tu cuenta y tu seguridad, copias de seguridad, correo, diagnóstico). El acceso pide un código por correo (`admin-live.js`, segunda pantalla; [`SEGURIDAD.md`](SEGURIDAD.md) §10). Cliente: Presupuestador · Mis presupuestos · Lista de precios · Estadísticas. **Estadísticas** (Google Business, Ads, Search Console, GA4) están
como estructura sin datos: se conectan con las credenciales de Torivac (no se muestran cifras inventadas). Para **añadir una vista**: entrada en `NAV`, función `V.<nombre>` que devuelva HTML (en `admin-live.js`, una *Promise*) y, si hace falta, su ruta en el Worker.

## 9. Pruebas (todas locales y reproducibles)
| Comando | Qué comprueba |
|---|---|
| `cd workers/api && npm test` | pruebas del Worker (auth, pedidos, precios, hoja, JWT, IA, propuestas, lector de `.xlsx` y sincronización desde Drive) |
| `php backend-php/api/tests/run.php` | pruebas del API PHP (mismos casos que el Worker + autodiagnóstico) y los mismos libros `.xlsx` y casos de hoja que JS; `HostingTest.php`: elección de la carpeta de datos, IP del visitante tras un proxy y comprobaciones por servidor (cPanel/Plesk) |
| `node scripts/qa-quote.mjs` | presupuesto realista (tramos, céntimos, PDF) en 4 idiomas, con cálculo independiente |
| `node scripts/qa-lang.mjs` | detección de idioma, selector, persistencia, accesibilidad del selector |
| `node scripts/qa-live.mjs` / `qa-admin-live.mjs` / `qa-tarifa.mjs` (+ `--php`) | web ↔ backend real, **Worker en memoria o API PHP con `php -S`** (pedido, contacto, errores) / panel real completo / tarifa en formato real (Excel, 8 decimales, referencias nuevas, lectura directa del `.xlsx`) |
| `node scripts/qa-update.mjs` | **actualizar sin caché vieja**: compila dos versiones, las «publica» una tras otra con la caché de una semana del `.htaccess` y comprueba que el HTML y el CSS son siempre de la misma versión, que lo que no cambia no se descarga otra vez, que volver atrás es inmediato, y que sin huellas (control) el problema se reproduce |
| `node scripts/test-blog-markdown.mjs` · `test-blog-markdown-php.mjs` | conversor del blog contra el contrato (`shared/blog-markdown.fixtures.json`) y 20 000 textos hostiles; **JS = PHP** con ~195 000 comparaciones (0 diferencias) |
| `node scripts/qa-blog-apache.mjs` · `qa-blog-panel.mjs` | el **blog sobre un Apache real + PHP-FPM** con el paquete tal como se sube (SEO, hreflang, JSON-LD, sitemap, `llms`, imágenes, borradores, programadas, redirecciones) y el **editor del panel en Chromium** (escribir, imagen, SEO, publicar, traducir, previsualizar, programar, validar, borrar, axe) |
| `node scripts/qa-security-panel.mjs` | el **acceso en dos pasos y la seguridad del panel en Chromium sobre un Apache real**: código por correo (leído de la carpeta de correo de pruebas), recordar el dispositivo, reenviar, códigos erróneos y bloqueo, ataques repetidos (un solo aviso), Usuarios, Actividad con CSV, copias de seguridad, cambio de contraseña, interruptor de emergencia, móvil y axe |
| `node scripts/qa-captcha.mjs` | el **CAPTCHA invisible opcional** (Turnstile) en contacto y pedido: sin claves no pasa nada; con claves, con una réplica de la API de Cloudflare **y con Cloudflare de verdad** (claves de prueba oficiales, si hay red); carga diferida, token, errores en los 4 idiomas y la CSP real |
| `node scripts/qa-package.mjs` | el **paquete del hosting (cPanel/Plesk) tal como se sube**: sin precios, precios del servidor, pedido, panel, CSP real del `.htaccess` y API cerrado a ficheros de código |
| `node scripts/qa-ux.mjs [--mobile \| --width=N]` | **todas** las páginas: desbordes, imágenes rotas/deformadas/borrosas, restos de código, peticiones externas, texto en otro idioma |
| `node scripts/qa-a11y.mjs` | axe-core (WCAG 2.1 AA) sobre una muestra estratificada |
| `node scripts/qa-art.mjs` | osciloscopio y arte toroidal (idiomas, teclado, movimiento reducido) |
| `python3 -I scripts/seo_check.py <dist> --base=…` | H1, títulos/descripciones, canonical, hreflang recíproco, OG, JSON-LD, sitemap, enlaces |
| `node scripts/perf.mjs --dir=<dist>` | LCP/CLS en móvil con CPU ×4 y 4G lenta (objetivo < 2,5 s) |
| `python3 -I scripts/qa_content.py` | fidelidad del contenido frente a la web original |
| `python3 -I scripts/secret_scan.py` · `gen_code_index.py --check` | secretos · cabeceras y funciones documentadas |
La CI (`ci/ci.yml`) las encadena. `node scripts/capturas.mjs` genera capturas de las vistas clave.

## 10. Operaciones habituales
- **Cambiar precios**: Excel/CSV en el panel (vista previa → aplicar; la hoja puede traer **solo una parte del catálogo**, reconocida por referencia, SKU o ID de producto, y el resto se conserva: `docs/PRECIOS-DRIVE.md` §2) · instrucción en castellano (IA propone, tú confirmas) · hoja de Drive (sincroniza cada 24 h; botón «Actualizar ahora»). Cada cambio guarda un histórico de 90 días en KV.
- **Añadir un usuario**: panel → Usuarios (o `POST /api/users` con el token maestro para el primer manager).
- **Añadir un producto/referencia**: cambiar el origen (la web original o el PDF) y regenerar `data/catalog`; las referencias pedibles salen de `variants[]`. Para un modelo nuevo sin PDF, añadirlo en la hoja de precios con su `ref` **y** en el catálogo.
- **Publicar en cPanel o Plesk**: `python3 -I scripts/package_cpanel.py --base=https://dominio [--staging]` genera y **verifica** el `.zip` (`docs/DESPLIEGUE-CPANEL.md` · `docs/DESPLIEGUE-PLESK.md`; el nombre del script es histórico, el paquete es el mismo); `ci/deploy.yml` lo hace desde GitHub (artefacto y, si se pide, rsync por SSH con simulacro).
  Con Worker: `npx wrangler deploy` y `TORIVAC_API=… node site/build.mjs --base=…` (la web puede ir al mismo cPanel o Plesk).
- **Algo falla en `file://`**: el almacenamiento entre páginas de Chrome es inconsistente; usar un servidor (`python3 -m http.server`) o producción.

## 11. Riesgos y pendiente conocidos
- **Referencias pedibles y etiquetas de voltaje**: salen de los PDF verificados (24 de 80 productos tienen modelos pedibles por separado; el resto usa una línea genérica `P<id>`). Lo dudoso no se publica y va a propuestas (116 en el panel).
- **Destinatarios** confirmados: info@grupotorivac.com y mzamora@torivac.com (el pie mantiene info@torivac.com, contenido original). Queda verificar `grupotorivac.com` en Resend (SPF/DKIM).
- **Precios públicos**: `GET /api/prices` es público (la web los pinta). Si se quieren solo para clientes registrados, es un cambio pequeño en servidor y en `loadLivePrices` (ver `docs/PRECIOS-DRIVE.md` §10).
- **Estadísticas externas** (Google Business, Ads, Search Console, GA4) sin conectar: faltan las credenciales de Torivac; el panel no muestra cifras inventadas.
- **Textos legales** publicados tal cual con sus defectos (ver propuestas `legal`). Traducciones inexistentes en el original (5 fichas) mostradas en español con aviso.
- **Probado contra un Apache real con PHP-FPM** (`scripts/qa-apache.mjs`: el `.htaccess` del paquete de verdad), pero **no contra un Plesk real** (nginx delante, permisos de carpetas, qué IP ve PHP): eso se contrasta con la documentación de Plesk y con `tools/check.php` (o *Ajustes → Diagnóstico*) en la primera subida; ver el apartado 10 de `DESPLIEGUE-PLESK.md` / `DESPLIEGUE-CPANEL.md`.

## 12. Revisión final (S16): lo que se encontró y se corrigió
Una pasada de lectura de todo el código (al documentar cada función) y de las pruebas dejó estos arreglos, cada uno con su prueba en **los dos backends**:
- **Privacidad**: `GET /api/prices` es público y devolvía `meta.reason`/`source` con el correo de quien cargó la hoja (`upload:ana@…`) y el id del archivo de Drive. Ahora el público ve solo `upload`, `sheet`… y un manager (con sesión) ve el detalle (`Cache-Control: private, no-store`, `Vary: Authorization`).
- **Sesiones**: borrar un usuario no cerraba su sesión (las sesiones no tienen estado y duran 24 h). Ahora se comprueba que el usuario siga existiendo (una lectura por petición autenticada).
- **Correo de contacto** (Worker): el correo del visitante iba sin escapar en el HTML que recibe el equipo; ahora nombre, correo y mensaje se escapan (el PHP ya lo hacía).
- **Número de pedido** (Worker): KV no es atómico; si dos pedidos coinciden, el segundo coge el siguiente número en vez de pisar el registro (el PHP usa `flock`).
- **Importar CSV/Excel**: la cantidad `1.000` se importaba como 1; ahora es mil. **Importes en español** (`1.234,56`): la demo del panel y `build_prices.py` los leían mal; ahora usan la misma regla que el servidor (el último separador es el decimal).
- **El correo es parte del resultado**: la web decía «te hemos enviado una copia» aunque el correo no hubiera salido (y el formulario de contacto daba por enviado un mensaje que nadie recibía). Ahora el pedido guarda siempre si el aviso salió (`emailed`), el panel marca los que no («sin aviso por correo»), la web solo promete la copia si salió y el diagnóstico avisa. *Actualización (S24):* el mensaje de contacto ahora se **guarda siempre** (*Mensajes* del panel) antes de intentar el correo y la web dice «Mensaje recibido» porque lo está de verdad; el aviso por correo queda marcado en el panel (enviado o fallido, con el motivo). Probado en los dos backends con Resend caído.
- **Servidor de pruebas** (`static-server.mjs`): ya no sale de su carpeta ni se cae con un `%` mal formado. Dos comprobaciones de las pruebas eran más laxas de lo que parecían (responder-a del correo y recuento de referencias sin precio) y se han afinado.
- Código muerto y casos límite de los scripts de desarrollo (`seo_check.py` sin páginas, `qa_content.py` sin filas, fechas inválidas en el blog).

Lo que **no** se ha tocado y conviene saber: los textos legales se publican tal cual (15 propuestas), las Estadísticas de Google no están conectadas, y las sesiones de un manager no se pueden revocar una a una (cambiar `SESSION_SECRET` cierra todas).

## 13. Hosting con Plesk (S20): lo que se encontró y se corrigió
Al pasar las pruebas a un subdominio de Plesk (producción irá a cPanel) se revisó todo lo que depende del servidor; cada punto tiene su prueba en `backend-php/api/tests/HostingTest.php`:
- **Carpeta de datos**: el ejemplo de `config.php` apuntaba a `/home/CUENTA/torivac-datos`; en Plesk la raíz de la cuenta no es escribible por la web y **toda la API respondía 500**. Ahora `storage_dir` vacío = `Store::bootstrap` elige solo (`torivac-datos` junto a la cuenta si se puede; si no, `api/storage`), nunca abandona un almacén que ya tiene datos (para no partir pedidos entre dos carpetas) y, si `storage_dir` no sirve, se desvía con aviso en el Diagnóstico.
- **IP del visitante** (límites por IP de pedidos, mensajes y **bloqueo de intentos de acceso**): el PHP se fiaba de la cabecera `CF-Connecting-IP` sin comprobar que viniera de Cloudflare (cualquiera podía falsearla y saltarse esos límites) y, detrás del nginx de Plesk, todas las visitas podían contar como una sola IP. Ahora `Request::clientIp` usa `REMOTE_ADDR` y solo mira las cabeceras si quien conecta es un proxy de confianza; la cadena `X-Forwarded-For` se lee de derecha a izquierda, de modo que lo que escriba el visitante no cuenta.
- **PHP servido por nginx** (opción de Plesk): ignora el `.htaccess` y rompe URLs limpias, cabeceras y la ruta `/api`; el Diagnóstico lo detecta (*Servidor web*).
- **Diagnóstico** más preciso por línea de comandos (sabe si la carpeta de datos cae dentro de la web sin `DOCUMENT_ROOT`), con textos para cPanel y Plesk.

## 14. Formularios, correo y acceso (S24): lo que se encontró y se corrigió
Motivo: en el entorno de pruebas el formulario de contacto decía «Mensaje recibido» y los correos nunca llegaban (el servidor daba el envío por bueno en cuanto el sistema lo aceptaba). Y se pidió endurecer el acceso y los formularios. Cada punto tiene sus pruebas en **los dos backends** (`backend-php/api/tests/*`, `workers/api/test/*`) y en el navegador (`scripts/qa-live.mjs`, `qa-admin-live.mjs`):
- **Correo veraz y configurable**: seis controladores (`smtp` —el buzón del dominio, con cliente propio y certificado verificado—, `brevo`, `resend`, `mail`, `file`, `none`); cada envío devuelve `{ ok, reason, error }` con un motivo corto y sin secretos; el último intento se guarda (`mail:last`) y se ve en *Ajustes → Correo* (con «Enviar correo de prueba»), en el *Resumen* y, sin el texto del error, en `/api/health`. Guía: `CORREO.md`.
- **Mensajes de contacto guardados**: `msg:` (400 días), `GET /api/messages`, `DELETE /api/messages/:id`; el contacto responde `{ ok, id, emailed }` y solo es error si no se pudo **guardar** (500).
- **Acceso**: 5 contraseñas erróneas del mismo visitante contra una cuenta → bloqueo de 1 hora (más 15/h por visitante y 30/h por cuenta); contraseña buena durante el bloqueo → mismo 429; `Retry-After`. Sesiones de 24 h.
- **Formularios solo texto plano y con límite** (`shared/plain-text.mjs` → navegador, Worker y `PlainTextRules.php`), tiempo mínimo de relleno (`_e`), contador de caracteres y avisos en los cuatro idiomas (`assets/js/forms.js`, textos nuevos en `TEXTOS-DE-INTERFAZ.md` para validar).
- **Bloque «Contacta con nosotros» de «Original»** (al pie de fichas y entradas): no cargaba `contact.js`, así que su formulario no hacía nada (enviaba la página con los datos en la dirección). Ahora `layout()` añade los scripts de formulario en toda página que lleve un formulario de contacto.
- **Contacto, orden de comprobaciones** (PHP): primero se valida y después se gasta el cupo de 5 mensajes cada 10 min (como el Worker): un aviso de texto no deja sin cupo a quien escribe de buena fe.
- **Sondeos de WordPress**: `.htaccess` responde 410 a `wp-login.php`, `xmlrpc.php`, `wp-admin`… (el paquete lo verifica con rutas de ejemplo).
- Contraseñas nuevas de **12 o más** caracteres (la guía y el panel decían 10).

## 15. Propuestas editables (S24b)
Las 118 propuestas del panel ya no son solo «aprobar o rechazar»: cada una se **edita** (la persona escribe SU texto), se **prueba** en la página real (marco aislado, sin publicar nada) y se **aplica** (queda aprobada con su texto en `proposals:state`, con `mode`, `text`, `find` y `note`). El panel descarga lo aprobado (JSON) y `scripts/apply_proposals.mjs` lo comprueba sobre el catálogo real y lo guarda en `data/catalog/proposals.applied.json`, que `site/build.mjs` aplica al compilar (`site/lib/proposals-apply.mjs`: sustituir un párrafo, traducir una ficha, cambiar el título de la portada; todo escapado). Guía: `PROPUESTAS.md`. Código: `site/assets/js/admin-proposals.js`, `backend-php/api/lib/Proposals.php`, `workers/api/src/proposals.js`. Pruebas: `ProposalsTest.php`, `proposals.test.js`, `scripts/test-proposals.mjs` y la sección 9 de `scripts/qa-admin-live.mjs`. Los identificadores `PR-…` aceptan de 3 a 6 cifras en los dos servidores (el Worker aceptaba solo hasta 5).

## 16. Primera prueba con un Apache real (S24c): lo que se encontró
Hasta ahora el paquete se probaba con `php -S`, que **no lee el `.htaccess`**. Al montar `scripts/lib/apache.mjs` (Apache 2.4 + PHP-FPM reales) y `scripts/qa-apache.mjs` apareció un fallo grave del `.htaccess` de `api/`, que se había introducido con la «lista blanca» de la revisión de seguridad:
- Tenía `Require all allowed`, que **no existe** en Apache (es `granted`): Apache respondía **500 en toda la API**.
- Corregido eso, seguía el problema de fondo: **Apache comprueba el acceso ANTES de reescribir**, así que `Require all denied` + «solo index.php» cerraba también `/api/health`, `/api/order`… (403 en toda la API) antes de que el `.htaccess` de la raíz las reescribiera a `index.php`. Ahora la regla (`Require expr` con `! -e '%{REQUEST_FILENAME}'`) cierra **lo que existe como fichero o carpeta** salvo `index.php` (lib/, tools/, generated/, storage/, config.php, copias…) y deja pasar las direcciones del API, que no existen como fichero. Apache 2.2 queda cubierto por tipo de fichero.
- La prueba antigua (`SecurityDataTest`) daba por bueno el texto erróneo; se ha sustituido por una que comprueba la estructura correcta y que prohíbe tanto `allowed` como un `Require all denied` general en Apache 2.4.
- `scripts/qa-apache.mjs` comprueba ahora, en un Apache de verdad, todo lo anterior (URLs, 404, ocultos, WordPress 410, cabeceras, gzip, caché, api/ cerrada, Authorization, contacto, bloqueo de 1 hora, almacén dentro de la web) y, con un segundo paquete de producción, HTTPS, un solo host, HSTS, sitemap, `llms.txt` y `robots.txt`. Necesita `apache2` y `php8.3-fpm` (si no están, se omite con un aviso).

## 17. Blog del panel (S23): diseño y lo que se encontró
Guía de uso y de operación: [`BLOG.md`](BLOG.md). Lo que conviene saber al tocar el código:
- **Qué se hace en la compilación y qué en el servidor**: la compilación emite por idioma `api/generated/blog-shell.<idioma>.json` (la página completa con marcas `@@TV:…@@`, con las mismas plantillas `postBody`/`postCard` que las entradas estáticas, así que el diseño no puede divergir) y las reglas del `.htaccess` (`BLOG_RULES`); `api/page.php` rellena las marcas **en un solo paso y escapando todo**, y mezcla en el listado, el sitemap y `llms*.txt` las entradas nuevas con las estáticas. Sin recompilar nada.
- **Un solo conversor, dos lenguajes**: la vista previa del panel (JS) y la página publicada (PHP) tienen que dar el mismo HTML. El contrato es `shared/blog-markdown.fixtures.json` y `scripts/test-blog-markdown-php.mjs` compara los dos con textos al azar. Reglas que hubo que seguir: todas las expresiones con `/u`, largos en códigos de punto, ninguna repetición contada de un grupo (PCRE: «regular expression is too large»; se usan `+` en JS y cuantificador posesivo en PHP, y el límite de largo va en `safeUrl`), recortes en tiempo lineal (un texto hostil de 60 000 caracteres no puede colgar la petición) y `clean()` antes de nada (controles e invisibles).
- **Programar sin cron**: «programada» no es un estado, es *publicada con fecha futura*; cada petición compara la fecha (`Blog::isLive`). Las páginas se guardan 60 s y los mapas 10 min (`PAGE_TTL`, `MAP_TTL`).
- **Lo que solo salió en un Apache real** (`qa-blog-apache.mjs`): `mod_expires` añadía su `Cache-Control: max-age=0` a la caché de las páginas de PHP (ahora PHP envía también `Expires`); `mod_dir` contesta él mismo con un 301 a `/blog` → `/blog/` antes de la reescritura; el `.htaccess` de `api/` debía dejar pasar también `page.php` (`Require expr` con `(index|page)\.php`); y el cliente HTTP de Node se atragantaba con un 405 con cuerpo troceado (el servidor estaba bien: se comprobó byte a byte).
- **Seguridad**: todo lo que escribe una persona se escapa; el texto solo emite las etiquetas de la tabla de `BLOG.md` §1 y solo esquemas de enlace seguros; las imágenes se validan por su contenido (JPEG, PNG, WebP; nunca SVG) y se sirven con `nosniff` y una CSP propia; las direcciones de imágenes llevan la huella del contenido; los guardados y subidas tienen límite por usuario y hora; la vista previa de borradores va firmada (HMAC), caduca en una hora y lleva `noindex`. Ver [`SEGURIDAD.md`](SEGURIDAD.md) §9.
- **Imagen destacada**: sale de fondo de la cabecera («Clásico»), de banner («Original») y, como la primera foto de las entradas de siempre, al principio del texto (la oculta «Original», que ya la enseña de banner); en «Ficha técnica» el fondo de la cabecera es el papel milimetrado, así que solo se ve en el texto.
- **Avisos que evitan sustos**: al guardar una entrada visible, el panel pide su página pública y avisa si no se sirve (lo habitual: un servidor que no aplica el `.htaccess`); el Diagnóstico tiene la línea «blog».
