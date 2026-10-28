# Torivac · documentación para programadores

Guía para quien tenga que **mantener o ampliar** la web nueva de Torivac. Complementa a `ARQUITECTURA.md` (contrato de datos), `PLAN.md` (sesiones),
`INDICE-CODIGO.md` (índice generado: cada archivo y cada función), `CONVENCIONES.md` (etiquetas del código) y `ENTREGA-DEMO.md` (qué es real y qué es simulado).

## 1. Qué es
Una web **100 % estática** (HTML + CSS + JS vanilla, sin frameworks) que replica grupotorivac.com en 4 idiomas (es en la raíz, `/en`, `/fr`, `/de`) y añade:
pedido por referencia y cantidad (estilo e-commerce, sin pasarela de pago), **presupuesto en PDF** con imágenes, **etiquetas de voltaje**, **precios** desde una hoja
(Excel/Google Sheets) y un **panel** con dos roles (manager / cliente). Lo único dinámico vive en un **backend con contrato único**, con dos implementaciones intercambiables: el Worker de Cloudflare (`workers/api`) o el API PHP para hosting con cPanel (`backend-php/api`).

Dos modos de la misma base de código:

| | Demo (`node site/build.mjs`) | Producción con API PHP en cPanel (`scripts/package_cpanel.py --base=https://dominio`) | Producción con Worker (`TORIVAC_API=https://… node site/build.mjs --base=https://dominio`) |
|---|---|---|---|
| Se abre con | doble clic (`file://`) o cualquier servidor | hosting cPanel (Apache/LiteSpeed) | cualquier hosting estático (cPanel, Cloudflare Pages…) |
| Precios | `prices.demo.*` (inventados, marcados DEMO) | **ninguno en la web**: los lee de `/api/prices` (hoja de Drive, cron 24 h + botón manual) | igual, desde el Worker |
| Envío de pedido/contacto | simulado (PDF + borrador `mailto:`) | `POST /api/order` y `/api/contact` → Resend (info@ + mzamora@ + copia al cliente) | igual |
| Panel `/admin/` | `admin.js` (credenciales de demo en el código) | `admin-live.js` (login real, datos del servidor) | igual |
| CSS / fuentes | 6 CSS y fuentes en base64 (para `file://`) | 1 `site.css` minificado + fuentes `woff2` | igual |
| SEO y servidor | sin canonical/sitemap | canonical, hreflang, JSON-LD, sitemap con imágenes, `llms.txt`, `robots.txt`, **`.htaccess`** (HTTPS, host único, 301, caché, CSP), 404 por idioma, URLs limpias | igual (el `.htaccess` solo si el estático va a cPanel) |

## 2. Mapa del repositorio
```
data/
  raw/            HTML y JSON de la web original (NO versionado: ~100 MB; se regenera con scripts/harvest.mjs)
  analysis/       análisis intermedios (estructura, PDFs, productos, WPML, hallazgos de UX/legales)
  catalog/        FUENTE ÚNICA DE VERDAD de la web: categories, products, pages, meta, prices, proposals, voltage-tags, image-map…
site/
  build.mjs       generador (lee data/catalog → escribe dist/)           templates.mjs  plantillas HTML (funciones puras)
  lib/            i18n.mjs (textos UI ×4 idiomas) · render.mjs (enlaces, bloques, imágenes) · seo.mjs (JSON-LD, OG) · hosting.mjs (.htaccess, robots.txt, 404)
  assets/         css/ (tokens, base, layout, components, art, admin) · js/ (quote, app, shop, pdf, quote-page, contact, lab, admin, admin-live) · vendor/ · fonts/ · img/
workers/api/      Worker torivac-api (pedidos, contacto, precios, login, IA de precios, propuestas) + pruebas (`npm test`)
backend-php/api/  el MISMO API en PHP para cPanel: Router, Orders, Prices/Sheets, Xlsx, Auth/Users, Ai, Mail, Store (ficheros JSON), Diag, tools/ (create-user, check), cron.php + pruebas (`php tests/run.php`)
shared/           código y casos de prueba que comparten JS y PHP: price-sheet.mjs (lector de hojas), xlsx.mjs (lector de .xlsx), fixtures
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
Secciones `[LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS] [CSS-PROD] [SEO-FILES]`. Emite por idioma: portada, listado de productos, categorías (con sus subcategorías), fichas, blog, contacto,
presupuesto (`/presupuesto/`, `/en/quote/`, `/fr/devis/`, `/de/angebot/`), páginas genéricas y legales, redirecciones de rutas fusionadas y `/admin/`. Los enlaces son **relativos y terminan en `index.html`**
(así funciona por `file://`).
Opciones: `--base=URL` (modo producción: URLs limpias, SEO, `.htaccess`, `robots.txt`, 404 por idioma), `--out=carpeta`, `--staging` (entorno de pruebas: `noindex`, `robots.txt` cerrado, cinta),
`--php-api` (el API vive en `/api` de la propia web) y variable `TORIVAC_API` (URL del Worker). Una compilación con API (**LIVE**) nunca lleva precios de demostración ni más de un destinatario en el código público.
También escribe `assets/data/*.js` (datos para el navegador como globales `TV.*`), `workers/api/src/generated/items.js` y `backend-php/api/generated/catalog.json` (referencias pedibles que cada backend usa para validar).

## 6. Front-end
- **Sin JS la web se lee y navega**; el JS añade presupuesto, filtros, PDF, idioma, gráficos. Datos para el navegador: `TV.meta`, `TV.i18n`, `TV.items`, `TV.thumbs`, `TV.logo`, `TV.prices`, `TV.proposals`, `TV.admin`.
- **`quote.js`** — API `TV.Quote` (`add/set/remove/clear/detail/priceOf/tiersOf/importRows/onChange`), formato de importes por idioma, `TV.csvParse` (RFC 4180), `TV.refreshPrices`, `TV.api` (llamadas al Worker).
  El presupuesto vive en `localStorage` (`tv_quote_v1`); en `file://` hay un respaldo en `window.name` porque Chrome a veces entrega un almacenamiento vacío entre ficheros.
- **`app.js`** — menú, cajón del presupuesto, botones flotantes, detección de idioma, sello de precios, arte toroidal. **`shop.js`** — filtros por tensión/búsqueda, tabla de modelos, galería.
  **`pdf.js`** — `TV.makeQuotePdf` (jsPDF + autoTable locales). **`quote-page.js`** — tabla editable, importar CSV/Excel, enviar (demo/real). **`contact.js`**. **`lab.js`** — osciloscopio del variador.
- **Idioma**: elección manual > idioma del navegador. Redirección automática **una sola vez** y **solo desde páginas en español**; en `/en/`, `/fr/`, `/de/` solo se ofrece un aviso. Claves: `tv_lang`, `tv_lang_src`, `tv_lang_auto_done`.
- **CSS**: todo sale de tokens (`tokens.css`); nunca colores o fuentes sueltos. `art.css` = piezas gráficas. Contraste AA, foco visible, `prefers-reduced-motion` respetado.
- **Accesibilidad**: landmarks, «saltar al contenido», un H1, niveles de encabezado sin saltos (`headingOrder` usa `aria-level` para no cambiar el diseño), `alt` en todas las imágenes.
- **Textos de interfaz**: `site/lib/i18n.mjs` (objeto `T` con es/en/fr/de). Para **añadir un idioma**: añadirlo a `LANGS`, a cada clave de `T`, a `meta.json` (menús/pie) y a `scripts/build_catalog.py`.

## 7. Backend: Worker `torivac-api` (`workers/api`) o API PHP (`backend-php/api`)
Mismas rutas, mismas respuestas, mismas reglas: se elige según el hosting y **los guiones de prueba corren contra los dos** (`--php`). Worker: variables y puesta en marcha en `workers/api/README.md`.
PHP: `docs/DESPLIEGUE-CPANEL.md`; datos en ficheros JSON de una carpeta fuera de la web (misma estructura de claves que KV, con `flock` para contadores), configuración en `api/config.php`, `cron.php` para los precios y
`tools/check.php` / `GET /api/diag` para diagnosticar la instalación. Claves KV (o ficheros): `user:<email>`, `order:<nº>`, `prices:current|meta|history:<ts>`, `proposals:state`, `rl:<bucket>:<id>`, `counter:<aaaammdd>`.
**Precios**: la hoja se lee de un Excel/Hoja de Drive (cuenta de servicio, descarga directa del `.xlsx` o CSV) con `shared/price-sheet.mjs` (+ port PHP) y `shared/xlsx.mjs` (+ port PHP): ver `docs/PRECIOS-DRIVE.md`.
Seguridad: PBKDF2 (100 k) + sesión firmada HMAC, límite de intentos de login, CORS por lista de orígenes, honeypot y límite por IP en pedidos/contacto, Turnstile opcional,
**el servidor revalora siempre el pedido** (ignora precios del navegador), la hoja nueva se rechaza si pierde >50 % de las referencias, la IA de precios solo propone y exige confirmación.

## 8. Panel
`/admin/` carga `admin.js` (demo, sin servidor) o `admin-live.js` (real). Manager: Resumen · Pedidos · Precios (estado, sincronizar, subir Excel/CSV con vista previa, instrucción con IA) · Propuestas ·
Contenido · Usuarios · Estadísticas · Ajustes. Cliente: Presupuestador · Mis presupuestos · Lista de precios · Estadísticas. **Estadísticas** (Google Business, Ads, Search Console, GA4) están
como estructura sin datos: se conectan con las credenciales de Torivac (no se muestran cifras inventadas). Para **añadir una vista**: entrada en `NAV`, función `V.<nombre>` que devuelva HTML (en `admin-live.js`, una *Promise*) y, si hace falta, su ruta en el Worker.

## 9. Pruebas (todas locales y reproducibles)
| Comando | Qué comprueba |
|---|---|
| `cd workers/api && npm test` | pruebas del Worker (auth, pedidos, precios, hoja, JWT, IA, propuestas, lector de `.xlsx` y sincronización desde Drive) |
| `php backend-php/api/tests/run.php` | pruebas del API PHP (mismos casos que el Worker + autodiagnóstico) y los mismos libros `.xlsx` y casos de hoja que JS |
| `node scripts/qa-quote.mjs` | presupuesto realista (tramos, céntimos, PDF) en 4 idiomas, con cálculo independiente |
| `node scripts/qa-lang.mjs` | detección de idioma, selector, persistencia, accesibilidad del selector |
| `node scripts/qa-live.mjs` / `qa-admin-live.mjs` / `qa-tarifa.mjs` (+ `--php`) | web ↔ backend real, **Worker en memoria o API PHP con `php -S`** (pedido, contacto, errores) / panel real completo / tarifa en formato real (Excel, 8 decimales, referencias nuevas, lectura directa del `.xlsx`) |
| `node scripts/qa-package.mjs` | el **paquete de cPanel tal como se sube**: sin precios, precios del servidor, pedido, panel, CSP real del `.htaccess` y API cerrado a ficheros de código |
| `node scripts/qa-ux.mjs [--mobile \| --width=N]` | **todas** las páginas: desbordes, imágenes rotas/deformadas/borrosas, restos de código, peticiones externas, texto en otro idioma |
| `node scripts/qa-a11y.mjs` | axe-core (WCAG 2.1 AA) sobre una muestra estratificada |
| `node scripts/qa-art.mjs` | osciloscopio y arte toroidal (idiomas, teclado, movimiento reducido) |
| `python3 -I scripts/seo_check.py <dist> --base=…` | H1, títulos/descripciones, canonical, hreflang recíproco, OG, JSON-LD, sitemap, enlaces |
| `node scripts/perf.mjs --dir=<dist>` | LCP/CLS en móvil con CPU ×4 y 4G lenta (objetivo < 2,5 s) |
| `python3 -I scripts/qa_content.py` | fidelidad del contenido frente a la web original |
| `python3 -I scripts/secret_scan.py` · `gen_code_index.py --check` | secretos · cabeceras y funciones documentadas |
La CI (`ci/ci.yml`) las encadena. `node scripts/capturas.mjs` genera capturas de las vistas clave.

## 10. Operaciones habituales
- **Cambiar precios**: Excel/CSV en el panel (vista previa → aplicar) · instrucción en castellano (IA propone, tú confirmas) · hoja de Drive (sincroniza cada 24 h; botón «Actualizar ahora»). Cada cambio guarda un histórico de 90 días en KV.
- **Añadir un usuario**: panel → Usuarios (o `POST /api/users` con el token maestro para el primer manager).
- **Añadir un producto/referencia**: cambiar el origen (la web original o el PDF) y regenerar `data/catalog`; las referencias pedibles salen de `variants[]`. Para un modelo nuevo sin PDF, añadirlo en la hoja de precios con su `ref` **y** en el catálogo.
- **Publicar en cPanel**: `python3 -I scripts/package_cpanel.py --base=https://dominio [--staging]` genera y **verifica** el `.zip` (`docs/DESPLIEGUE-CPANEL.md`); `ci/deploy.yml` lo hace desde GitHub (artefacto y, si se pide, rsync por SSH con simulacro).
  Con Worker: `npx wrangler deploy` y `TORIVAC_API=… node site/build.mjs --base=…` (la web puede ir al mismo cPanel).
- **Algo falla en `file://`**: el almacenamiento entre páginas de Chrome es inconsistente; usar un servidor (`python3 -m http.server`) o producción.

## 11. Riesgos y pendiente conocidos
- **Referencias pedibles y etiquetas de voltaje**: salen de los PDF verificados (24 de 80 productos tienen modelos pedibles por separado; el resto usa una línea genérica `P<id>`). Lo dudoso no se publica y va a propuestas (116 en el panel).
- **Destinatarios** confirmados: info@grupotorivac.com y mzamora@torivac.com (el pie mantiene info@torivac.com, contenido original). Queda verificar `grupotorivac.com` en Resend (SPF/DKIM).
- **Precios públicos**: `GET /api/prices` es público (la web los pinta). Si se quieren solo para clientes registrados, es un cambio pequeño en servidor y en `loadLivePrices` (ver `docs/PRECIOS-DRIVE.md` §9).
- **Estadísticas externas** (Google Business, Ads, Search Console, GA4) sin conectar: faltan las credenciales de Torivac; el panel no muestra cifras inventadas.
- **Textos legales** publicados tal cual con sus defectos (ver propuestas `legal`). Traducciones inexistentes en el original (5 fichas) mostradas en español con aviso.
- **No probado contra un Apache real** (sí contra `php -S` con la misma reescritura y la CSP del `.htaccess` aplicada): la primera subida al subdominio de pruebas se verifica con `tools/check.php` y la lista del apartado 10 de `DESPLIEGUE-CPANEL.md`.

## 12. Revisión final (S16): lo que se encontró y se corrigió
Una pasada de lectura de todo el código (al documentar cada función) y de las pruebas dejó estos arreglos, cada uno con su prueba en **los dos backends**:
- **Privacidad**: `GET /api/prices` es público y devolvía `meta.reason`/`source` con el correo de quien cargó la hoja (`upload:ana@…`) y el id del archivo de Drive. Ahora el público ve solo `upload`, `sheet`… y un manager (con sesión) ve el detalle (`Cache-Control: private, no-store`, `Vary: Authorization`).
- **Sesiones**: borrar un usuario no cerraba su sesión (las sesiones no tienen estado y duran 7 días). Ahora se comprueba que el usuario siga existiendo (una lectura por petición autenticada).
- **Correo de contacto** (Worker): el correo del visitante iba sin escapar en el HTML que recibe el equipo; ahora nombre, correo y mensaje se escapan (el PHP ya lo hacía).
- **Número de pedido** (Worker): KV no es atómico; si dos pedidos coinciden, el segundo coge el siguiente número en vez de pisar el registro (el PHP usa `flock`).
- **Importar CSV/Excel**: la cantidad `1.000` se importaba como 1; ahora es mil. **Importes en español** (`1.234,56`): la demo del panel y `build_prices.py` los leían mal; ahora usan la misma regla que el servidor (el último separador es el decimal).
- **Servidor de pruebas** (`static-server.mjs`): ya no sale de su carpeta ni se cae con un `%` mal formado. Dos comprobaciones de las pruebas eran más laxas de lo que parecían (responder-a del correo y recuento de referencias sin precio) y se han afinado.
- Código muerto y casos límite de los scripts de desarrollo (`seo_check.py` sin páginas, `qa_content.py` sin filas, fechas inválidas en el blog).

Lo que **no** se ha tocado y conviene saber: los textos legales se publican tal cual (15 propuestas), las Estadísticas de Google no están conectadas, y las sesiones de un manager no se pueden revocar una a una (cambiar `SESSION_SECRET` cierra todas).
