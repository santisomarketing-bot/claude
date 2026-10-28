# Índice de código (generado)

> Generado por `scripts/gen_code_index.py`. **No editar a mano**: se rehace con `python3 -I scripts/gen_code_index.py`.
> Cada archivo se describe por su cabecera; las secciones `[ETIQUETA]` marcan los bloques; cada función lleva su descripción (⚠ = falta describirla).
**Cobertura**: 248/711 funciones descritas (35 %) · 112/113 archivos con cabecera.


## `site/`

### `build.mjs`

[BUILD] Generador del sitio estático Torivac (demo).  Uso:  node site/build.mjs [--base=https://dominio] [--out=carpeta] Lee data/catalog/*.json (fuente única de verdad) y escribe dist/ (HTML por idioma + assets + datos para JS). Secciones: [LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS]

Secciones: `[BUILD]` · `[LOAD]` · `[CATS]` · `[PRODUCTS]` · `[SITE]` · `[EMIT]` · `[DATA]` · `[ASSETS]` · `[LIVE]` · `[OVERRIDES]` · `[SEO]` · `[WORKER]` · `[ADMIN]` · `[PRICE-SHEET]` · `[CSS-PROD]` · `[SEO-FILES]` · `[HOSTING]`

- `arg0` (l. 17) — ⚠ sin describir
- `arg` (l. 19) — ⚠ sin describir
- `jl` (l. 24) — ⚠ sin describir
- `normName` (l. 46) — ───────────────────────────────────────────────────────────── [CATS] limpieza del árbol (duplicados → fusionados) y rutas
- `depthOf` (l. 49) — ⚠ sin describir
- `canon` (l. 51) — ⚠ sin describir
- `subtreeIds` (l. 84) — ⚠ sin describir
- `prodIdsOf` (l. 85) — ⚠ sin describir
- `visible` (l. 88) — ⚠ sin describir
- `prune` (l. 89) — ⚠ sin describir
- `site_prodById_placeholder` (l. 107) — ⚠ sin describir
- `pth` (l. 111) — ───────────────────────────────────────────────────────────── [SITE] estructura global por idioma
- `emit` (l. 163) — , '') + (p.endsWith('/') ? 'index.html' : ''), html); count++; };
- `mkctx` (l. 164) — ⚠ sin describir
- `fitTitle` (l. 168) — [SEO] migas de pan y nodos JSON-LD (solo se emiten con --base; ver site/lib/seo.mjs)
- `crumbHome` (l. 169) — ⚠ sin describir
- `crumbProducts` (l. 170) — ⚠ sin describir
- `pickAlt` (l. 171) — ⚠ sin describir
- `absImg` (l. 172) — ⚠ sin describir
- `alts` (l. 176) — ⚠ sin describir
- `a` (l. 319) — ⚠ sin describir
- `copyDir` (l. 332) — ⚠ sin describir
- `xml` (l. 349) — ⚠ sin describir
- `url` (l. 350) — ⚠ sin describir
- `sec` (l. 361) — ⚠ sin describir
- `t` (l. 382) — ⚠ sin describir

### `templates.mjs`

[TEMPLATES] Plantillas HTML (funciones puras: datos → string). Cada una devuelve el <main> de su página; `layout()` lo envuelve con cabecera, pie, elementos flotantes y scripts. Datos: data/catalog/*.json (ver docs/ARQUITECTURA.md). Textos de interfaz: site/lib/i18n.mjs.

Secciones: `[TEMPLATES]` · `[ART]` · `[A11Y]` · `[META]` · `[LAYOUT]` · `[SEO-FILES]` · `[NAV]` · `[SOCIAL]` · `[SHARED]` · `[HOME]` · `[PAGES]` · `[BLOG]` · `[SHOP]` · `[PRODUCT]` · `[QUOTE]` · `[CONTACT]`

- `pick` (l. 10) — ⚠ sin describir
- `toroidArt` (l. 17) — ───────────────────────────────────────────────────────────── [ART] piezas gráficas técnicas (SVG propio, sin librerías)
- `waveLab` (l. 26) — Osciloscopio esquemático de un variador de tensión: la onda de salida (cobre) se reduce al mover el mando; la de entrada (230 V) queda fija. JS: assets/js/lab.js
- `headingOrder` (l. 46) — ───────────────────────────────────────────────────────────── [A11Y] orden de encabezados
- `metaDescription` (l. 59) — Usa la descripción original si es útil; si no, el primer párrafo real de la página (sin inventar nada); como último recurso, una frase genérica de marca.
- `ok` (l. 60) — ⚠ sin describir
- `layout` (l. 70) — ───────────────────────────────────────────────────────────── [LAYOUT] envoltorio común
- `alt` (l. 73) — selector de idioma: sin traducción cae a la portada de ese idioma
- `crumbs` (l. 157) — ───────────────────────────────────────────────────────────── [SHARED] migas, etiquetas de tensión, tarjeta de producto
- `vtext` (l. 159) — ⚠ sin describir
- `vtags` (l. 160) — ⚠ sin describir
- `productCard` (l. 170) — ⚠ sin describir
- `catTree` (l. 184) — árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
- `holds` (l. 186) — ⚠ sin describir
- `link` (l. 187) — ⚠ sin describir
- `walk` (l. 188) — ⚠ sin describir
- `categoryCards` (l. 195) — tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original
- `homeBody` (l. 212) — ───────────────────────────────────────────────────────────── [HOME]
- `text` (l. 215) — ⚠ sin describir
- `imgs` (l. 216) — ⚠ sin describir
- `btn` (l. 217) — ⚠ sin describir
- `eyebrowAndHead` (l. 229) — ⚠ sin describir
- `paras` (l. 234) — ⚠ sin describir
- `bt` (l. 235) — ⚠ sin describir
- `waveSvg` (l. 259) — onda de tensión animada (SVG) — elemento gráfico base del hero
- `sectionsHtml` (l. 266) — ───────────────────────────────────────────────────────────── [PAGES] páginas genéricas (empresa, proyectos, legales)
- `isPhoto` (l. 270) — los iconos pequeños se quedan dentro del texto
- `genericPage` (l. 286) — ⚠ sin describir
- `blogIndexBody` (l. 307) — ───────────────────────────────────────────────────────────── [BLOG]
- `postBody` (l. 312) — ⚠ sin describir
- `shopBody` (l. 322) — ───────────────────────────────────────────────────────────── [SHOP] listado / categoría
- `productBody` (l. 350) — ───────────────────────────────────────────────────────────── [PRODUCT] ficha
- `quoteBody` (l. 399) — ───────────────────────────────────────────────────────────── [QUOTE] página del presupuesto
- `contactForm` (l. 426) — ───────────────────────────────────────────────────────────── [CONTACT] formulario
- `contactIntro` (l. 442) — introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio)

## `site/lib/`

### `hosting.mjs`

[HOSTING] Archivos de servidor para publicar en un hosting con cPanel (Apache o LiteSpeed): .htaccess, robots.txt de pruebas y 404 por idioma. Se generan solo con --base (producción o dominio de pruebas); la compilación de demostración (doble clic) no los necesita. htaccess({ base, staging, aliases, pdfRedirects, apiOrigin, phpApi, langs })  → texto del .htaccess de la raíz

Secciones: `[HOSTING]`

- `rx` (l. 9) — ⚠ sin describir
- `basePathOf` (l. 12) — ruta base del sitio: «https://x.com/prueba/» → «/prueba» («» si está en la raíz del dominio)
- `htaccess` (l. 14) — ⚠ sin describir
- `langHtaccess` (l. 55) — .htaccess de /en, /fr, /de: solo cambia la página 404 para que se muestre en el idioma de la sección
- `robotsTxt` (l. 57) — ⚠ sin describir

### `i18n.mjs`

[I18N] Textos de interfaz del demo en los 4 idiomas. Solo textos NUEVOS de la experiencia de pedido (presupuesto, filtros, formulario…): el contenido del sitio viene tal cual de la web original. Cada clave existe en es/en/fr/de. El idioma por defecto del sitio es 'es' (raíz); en/fr/de viven bajo /en /fr /de.

Secciones: `[I18N]`

- `countLabel` (l. 108) — «1 producto / 2 productos» en los 4 idiomas
- `refLabel` (l. 109) — ⚠ sin describir
- `t` (l. 110) — ⚠ sin describir

### `render.mjs`

[RENDER] Utilidades del generador: escape, rutas relativas, enlaces internos, bloques semánticos → HTML. RUTAS: el demo se puede abrir con doble clic (file://). Por eso todos los enlaces internos son RELATIVOS y terminan en index.html. Las URLs lógicas (las mismas que la web original: /product/x/, /en/…) se conservan como estructura

Secciones: `[RENDER]`

- `esc` (l. 10) — ⚠ sin describir
- `dirOf` (l. 14) — ruta lógica de página ('/en/product/x/') → carpeta de salida relativa a dist ('en/product/x')
- `setCleanUrls` (l. 18) — ⚠ sin describir
- `rel` (l. 20) — URL relativa desde la página `from` hasta la página lógica `to` (+hash opcional).
- `asset` (l. 26) — URL relativa a un asset ('assets/css/x.css') desde la página `from`.
- `mapLink` (l. 41) — Reescribe un enlace de la web original a su equivalente local (página, PDF) o lo deja absoluto.
- `inlineHtml` (l. 60) — HTML inline de un bloque (los enlaces internos se reescriben).
- `tbl` (l. 68) — ⚠ sin describir
- `cell` (l. 72) — ⚠ sin describir
- `blocksHtml` (l. 81) — Bloques semánticos → HTML. opts.demote: sube el nivel de los encabezados (h1→h2…) para que la plantilla sea dueña del h1.
- `plain` (l. 118) — ⚠ sin describir
- `fmtDate` (l. 120) — ⚠ sin describir
- `writeFile` (l. 122) — ⚠ sin describir

### `seo.mjs`

[SEO] Datos estructurados JSON-LD (@graph) y metaetiquetas sociales. Solo con --base (necesitan URLs absolutas). Regla de oro: únicamente datos que existen en la web original / el catálogo (sin precios inventados, sin reseñas, sin valoraciones). Tipos: Organization (con logo, dirección, teléfono, correo, idiomas) · WebSite · WebPage/CollectionPage/ContactPage/AboutPage ·

Secciones: `[SEO]`

- `ogLocale` (l. 10) — ⚠ sin describir
- `clip` (l. 13) — Recorta un texto a `max` caracteres sin partir palabras.
- `productNode` (l. 21) — Nodo Product de una ficha. `images`: URLs absolutas.
- `itemListNode` (l. 31) — ItemList de un listado (productos de una categoría / todas las fichas).
- `postNode` (l. 35) — BlogPosting de una entrada.
- `pageGraph` (l. 47) — Grafo completo de una página.
- `ldScript` (l. 74) — <script type="application/ld+json"> seguro para incrustar (escapa < y el separador U+2028/2029).

## `site/assets/js/`

### `admin-live.js`

[ADMIN-LIVE] Panel de gestión de Torivac CONECTADO AL WORKER (producción). Mismo aspecto que el demo (admin.css), datos y acciones reales. Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Usuarios · Estadísticas · Ajustes cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas

Secciones: `[ADMIN-LIVE]` · `[HTTP]` · `[AUTH]` · `[UTIL]` · `[VIEWS]` · `[PRICES]` · `[AI]` · `[USERS]` · `[PROPOSALS]` · `[ROUTER]`

- `esc` (l. 16) — ⚠ sin describir
- `money` (l. 17) — ⚠ sin describir
- `http` (l. 21) — ───────────────────────────────────────── [HTTP] llamadas al Worker con el token de la sesión
- `session` (l. 30) — ───────────────────────────────────────── [AUTH] sesión en sessionStorage (se borra al cerrar la pestaña)
- `login` (l. 32) — Entra con correo y contraseña. Devuelve Promise<string|null>: null si ha ido bien, o el mensaje de error.
- `logout` (l. 40) — Cierra la sesión y vuelve a la pantalla de acceso.
- `toast` (l. 43) — ───────────────────────────────────────── [UTIL]
- `kpi` (l. 44) — ⚠ sin describir
- `itemName` (l. 46) — Nombre legible de una referencia (nombre ES + ref si es un modelo concreto).
- `when` (l. 47) — ⚠ sin describir
- `download` (l. 48) — ⚠ sin describir
- `fail` (l. 50) — Aviso de error del servidor con el mensaje devuelto.
- `V.resumen` (l. 60) — ⚠ sin describir
- `ordersView` (l. 72) — Tabla de pedidos (manager: todos · cliente: solo los suyos, lo filtra el servidor).
- `V.pedidos` (l. 80) — ⚠ sin describir
- `V.mis` (l. 81) — ⚠ sin describir
- `V.lista` (l. 83) — ⚠ sin describir
- `V.presupuestador` (l. 91) — ⚠ sin describir
- `V.contenido` (l. 93) — ⚠ sin describir
- `cell` (l. 95) — ⚠ sin describir
- `V.estadisticas` (l. 100) — ⚠ sin describir
- `V.ajustes` (l. 105) — ⚠ sin describir
- `V.precios` (l. 114) — ⚠ sin describir
- `previewUpload` (l. 125) — Filas (cabecera + datos) → vista previa de diferencias contra los precios vigentes (el servidor calcula la diferencia; no se aplica nada).
- `list` (l. 130) — ⚠ sin describir
- `readUpload` (l. 138) — Lee el archivo subido (Excel o CSV) en el navegador y pide la vista previa.
- `go` (l. 140) — ⚠ sin describir
- `applyUpload` (l. 144) — ⚠ sin describir
- `runPrompt` (l. 152) — ⚠ sin describir
- `applyProposal` (l. 167) — ⚠ sin describir
- `V.propuestas` (l. 175) — ⚠ sin describir
- `V.usuarios` (l. 189) — ───────────────────────────────────────── [USERS] altas y bajas de usuarios (managers y clientes)
- `onClick` (l. 198) — ───────────────────────────────────────── [ROUTER]
- `bind` (l. 216) — Eventos de la vista Precios (subida por arrastre) y del formulario de usuarios; se enlazan tras pintar cada vista.
- `render` (l. 233) — ⚠ sin describir

### `admin-report.js`

[ADMIN-REPORT] Informe de lectura de una hoja de precios para la vista previa del panel: columnas reconocidas, avisos, referencias nuevas y filas que no se publican. Lo comparten admin.js (demo, en el navegador) y admin-live.js (real, el informe viene del servidor). Sin dependencias. TV.priceReportHtml(report, esc) → HTML ('' si no hay informe)

Secciones: `[ADMIN-REPORT]`

- `TV.priceReportHtml` (l. 12) — ⚠ sin describir
- `list` (l. 18) — ⚠ sin describir

### `admin.js`

[ADMIN] Panel de gestión de Torivac (DEMO sin servidor): login con dos roles, menú lateral y vistas. Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Estadísticas · Ajustes cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas

Secciones: `[ADMIN]` · `[AUTH]` · `[UTIL]` · `[VIEWS]` · `[PRICES]` · `[PROMPT]` · `[ROUTER]`

- `esc` (l. 17) — ⚠ sin describir
- `money` (l. 18) — ⚠ sin describir
- `session` (l. 26) — ⚠ sin describir
- `login` (l. 27) — ⚠ sin describir
- `logout` (l. 28) — ⚠ sin describir
- `norm` (l. 31) — ───────────────────────────────────────── [UTIL]
- `stem` (l. 32) — ⚠ sin describir
- `csvParse` (l. 33) — ⚠ sin describir
- `pnum` (l. 34) — ⚠ sin describir
- `rowsToPrices` (l. 37) — Hoja → precios con las MISMAS reglas que el servidor (TV.PriceSheet = shared/price-sheet.mjs): cabeceras tolerantes, SKU, referencias nuevas por regla, avisos.
- `diffPrices` (l. 43) — ⚠ sin describir
- `itemName` (l. 49) — ⚠ sin describir
- `toast` (l. 50) — ⚠ sin describir
- `download` (l. 51) — ⚠ sin describir
- `orders` (l. 52) — ⚠ sin describir
- `V.resumen` (l. 61) — ⚠ sin describir
- `kpi` (l. 72) — ⚠ sin describir
- `V.pedidos` (l. 74) — ⚠ sin describir
- `V.mis` (l. 80) — ⚠ sin describir
- `V.precios` (l. 82) — ⚠ sin describir
- `V.lista` (l. 90) — ⚠ sin describir
- `V.propuestas` (l. 95) — ⚠ sin describir
- `V.contenido` (l. 105) — ⚠ sin describir
- `cell` (l. 107) — ⚠ sin describir
- `V.estadisticas` (l. 112) — ⚠ sin describir
- `V.ajustes` (l. 118) — ⚠ sin describir
- `V.presupuestador` (l. 123) — ⚠ sin describir
- `showDraft` (l. 129) — ⚠ sin describir
- `rowsOf` (l. 131) — ⚠ sin describir
- `applyDraft` (l. 137) — ⚠ sin describir
- `readUpload` (l. 138) — ⚠ sin describir
- `go` (l. 140) — ⚠ sin describir
- `itemHaystack` (l. 146) — ───────────────────────────────────────── [PROMPT] instrucciones en castellano → reglas de precio (demo, sin IA)
- `targetMatches` (l. 147) — ⚠ sin describir
- `parsePrompt` (l. 151) — ⚠ sin describir
- `runPrompt` (l. 163) — ⚠ sin describir
- `f` (l. 172) — ⚠ sin describir
- `bind` (l. 182) — ───────────────────────────────────────── [ROUTER]
- `onClick` (l. 186) — ⚠ sin describir
- `render` (l. 199) — ⚠ sin describir

### `app.js`

[APP] Comportamiento común a todas las páginas. Secciones: [UTIL] · [MENU] menú móvil · [DRAWER] cajón del presupuesto · [FAB] botones flotantes · [LANG] idioma (detección + selector manual) · [PRICE-STAMP] Depende de: quote.js (TV.Quote). Sin librerías.

Secciones: `[APP]` · `[UTIL]` · `[MENU]` · `[DRAWER]` · `[FAB]` · `[LANG]` · `[PRICE-STAMP]` · `[EMBED]` · `[TREE]` · `[ART]`

- `$` (l. 9) — ⚠ sin describir
- `$$` (l. 10) — ⚠ sin describir
- `esc` (l. 11) — ⚠ sin describir
- `TV.toast` (l. 15) — ⚠ sin describir
- `thumbSrc` (l. 17) — ⚠ sin describir
- `openDrawer` (l. 43) — ⚠ sin describir
- `closeDrawer` (l. 44) — ⚠ sin describir
- `renderDrawer` (l. 51) — ⚠ sin describir
- `refreshCounts` (l. 83) — ⚠ sin describir
- `store` (l. 99) — ⚠ sin describir
- `browserLang` (l. 100) — ⚠ sin describir
- `offer` (l. 115) — ⚠ sin describir
- `stamp` (l. 127) — ───────────────────────────────────────── [PRICE-STAMP] marca de demo y fecha de precios

### `contact.js`

[CONTACT] Formularios de contacto (página Contacto y bloque de la home). Con TV.meta.api (producción): POST /api/contact al Worker (workers/api: honeypot, límite por IP, Turnstile opcional, Resend). Sin API (DEMO): no se envía nada; se valida, se guarda el mensaje en localStorage (tv_messages) y se muestra un borrador mailto:.

Secciones: `[CONTACT]`

### `lab.js`

[LAB] Osciloscopio esquemático de un variador de tensión (categoría «Variadores de tensión»). Dos ondas sinusoidales: la de ENTRADA (230 V, fija, discontinua) y la de SALIDA (cobre) cuya amplitud sigue al mando (0–230 V). Es una ilustración: no mide nada ni promete prestaciones. Respeta prefers-reduced-motion (onda quieta) y funciona con teclado (input range).

Secciones: `[LAB]` · `[WAVE]` · `[UI]` · `[LOOP]`

- `path` (l. 15) — ⚠ sin describir
- `draw` (l. 27) — ⚠ sin describir
- `tick` (l. 41) — ⚠ sin describir

### `pdf.js`

[PDF] Generador del PDF de presupuesto en el navegador (jsPDF + autoTable, ambos locales en assets/vendor). API: TV.makeQuotePdf({ customer, number }) → { doc, blob, filename } Contenido: banda de marca, nº y fecha, datos del cliente, tabla con IMAGEN REFERENCIAL por línea, total, notas, aviso legal y marca DEMO si procede.

Secciones: `[PDF]`

- `TV.makeQuotePdf` (l. 12) — ⚠ sin describir
- `didDrawCell` (l. 50) — ⚠ sin describir

### `quote-page.js`

[QUOTE-PAGE] Página completa del presupuesto: tabla editable, importación CSV/Excel, PDF y envío (simulado en demo). Secciones: [TABLE] · [IMPORT] · [PDF] · [SEND] · [REFRESH] Depende de: quote.js, app.js, pdf.js, SheetJS (window.XLSX) para .xlsx/.xls.

Secciones: `[QUOTE-PAGE]` · `[TABLE]` · `[IMPORT]` · `[PDF]` · `[SEND]` · `[REFRESH]` · `[SEND-LIVE]` · `[SEND-DEMO]`

- `render` (l. 13) — ───────────────────────────────────────── [TABLE]
- `handleRows` (l. 44) — ⚠ sin describir
- `parseCsv` (l. 55) — ⚠ sin describir
- `readFile` (l. 56) — ⚠ sin describir
- `customer` (l. 70) — ⚠ sin describir
- `download` (l. 71) — ⚠ sin describir
- `sendLive` (l. 92) — ───────────────────────────────────────── [SEND-LIVE] producción: POST al Worker (precios y totales los fija el servidor)
- `sendDemo` (l. 109) — ───────────────────────────────────────── [SEND-DEMO] demo: descarga el PDF, guarda el pedido en localStorage y ofrece un borrador mailto:

### `quote.js`

[QUOTE-ENGINE] Motor del presupuesto/pedido de Torivac. Sin dependencias. Funciona con file:// (los datos llegan como variables globales: TV.items, TV.prices, TV.i18n). Secciones:  [STATE] estado persistente · [FORMAT] formato de importes · [PRICES] precios y tramos · [API] TorivacQuote · [REFRESH] actualización manual de precios

Secciones: `[QUOTE-ENGINE]` · `[STATE]` · `[FORMAT]` · `[PRICES]` · `[API]` · `[REFRESH]` · `[OVERRIDE]` · `[CSV]` · `[LIVE]`

- `applyOverride` (l. 21) — ───────────────────────────────────────── [OVERRIDE] precios cargados desde el panel (demo): sustituyen a TV.prices en este navegador
- `mergeSheetItems` (l. 26) — La hoja de precios puede traer referencias nuevas dentro de un producto (prices.items[ref] = {p, n, pid}): se suman a TV.items para poder presupuestarlas (x:1 = viene de la hoja).
- `clean` (l. 44) — ⚠ sin describir
- `load` (l. 45) — ⚠ sin describir
- `save` (l. 51) — ⚠ sin describir
- `emit` (l. 56) — ⚠ sin describir
- `buildFormats` (l. 64) — ⚠ sin describir
- `money` (l. 70) — ⚠ sin describir
- `unitMoney` (l. 71) — ⚠ sin describir
- `t` (l. 72) — ⚠ sin describir
- `rel` (l. 74) — ruta relativa a una página lógica (/en/product/x/) desde la página actual
- `assetUrl` (l. 78) — ⚠ sin describir
- `priceOf` (l. 82) — ───────────────────────────────────────── [PRICES]
- `tiersOf` (l. 89) — ⚠ sin describir
- `round2` (l. 90) — ⚠ sin describir
- `lines` (l. 94) — ⚠ sin describir
- `count` (l. 95) — ⚠ sin describir
- `kinds` (l. 96) — ⚠ sin describir
- `has` (l. 97) — ⚠ sin describir
- `add` (l. 98) — ⚠ sin describir
- `set` (l. 104) — ⚠ sin describir
- `remove` (l. 111) — ⚠ sin describir
- `clear` (l. 112) — ⚠ sin describir
- `detail` (l. 114) — líneas detalladas + total (solo suma las que tienen precio)
- `onChange` (l. 124) — ⚠ sin describir
- `applyOverride` (l. 125) — ⚠ sin describir
- `label` (l. 128) — nombre de línea listo para mostrar
- `shownRef` (l. 130) — referencia visible (las líneas genéricas P#### no se muestran como referencia)
- `importRows` (l. 132) — importa filas {ref, qty}: devuelve {added, unknown[]}
- `base` (l. 147) — ⚠ sin describir
- `live` (l. 148) — ⚠ sin describir
- `post` (l. 149) — ⚠ sin describir
- `TV.loadLivePrices` (l. 158) — ───────────────────────────────────────── [LIVE] precios vigentes del servidor (producción)
- `TV.csvParse` (l. 168) — ⚠ sin describir
- `TV.refreshPrices` (l. 185) — ───────────────────────────────────────── [REFRESH] recarga manual de precios (el cron de 24 h lo hace el servidor; ver Sesión 6)
- `n.onload` (l. 191) — ⚠ sin describir
- `n.onerror` (l. 192) — ⚠ sin describir

### `shop.js`

[SHOP] Listados (filtros por tensión y búsqueda) y fichas de producto (tabla de modelos con cantidades, galería). Secciones: [FILTERS] filtros del listado · [MODELS] tabla de modelos · [EXTRAS] referencias que añade la hoja de precios · [GALLERY] galería · [PRICES] precios en las filas Depende de: quote.js, app.js (TV.$, TV.$$, TV.toast).

Secciones: `[SHOP]` · `[FILTERS]` · `[MODELS]` · `[EXTRAS]` · `[GALLERY]` · `[PRICES]`

- `apply` (l. 15) — ⚠ sin describir
- `qtyOf` (l. 36) — ⚠ sin describir
- `bindRow` (l. 37) — ⚠ sin describir
- `extraRow` (l. 54) — ⚠ sin describir
- `renderExtras` (l. 60) — ⚠ sin describir
- `updatePrice` (l. 79) — ───────────────────────────────────────── [PRICES] precio unitario y tramos por fila
- `allPrices` (l. 87) — ⚠ sin describir
- `refresh` (l. 88) — ⚠ sin describir

## `site/assets/css/`

### `admin.css`

[ADMIN-CSS] Panel de gestión (demo). Usa los tokens de tokens.css. Menú lateral fijo a la izquierda.

Secciones: `[ADMIN-CSS]`

### `art.css`

[ART] elementos gráficos de marca (estética de plano técnico). Sesión 12 los amplía con más piezas. onda de tensión del héroe: tres senoidales a distinta velocidad (parallax de fase)

Secciones: `[ART]`

### `base.css`

[BASE] reset, tipografía, accesibilidad, utilidades

Secciones: `[BASE]`

### `components.css`

[COMPONENTS] botones, etiquetas de tensión, tarjetas, tablas técnicas, formularios, presupuesto ---- botones ----

Secciones: `[COMPONENTS]`

### `fonts-files.css`

[FONTS-FILES] Mismas fuentes como ARCHIVOS woff2 (producción por http: cacheables y sin bloquear el pintado). Generado por scripts/inline_fonts.py

Secciones: `[FONTS-FILES]`

### `fonts.css`

[FONTS] Advent Pro + Archivo (OFL), en base64 para que funcionen también con file://. Generado por scripts/inline_fonts.py

Secciones: `[FONTS]`

### `layout.css`

[LAYOUT] cabecera, héroe, secciones, pie, disposición con barra lateral, elementos flotantes cinta de demo

Secciones: `[LAYOUT]`

### `tokens.css`

[TOKENS] Torivac · variables de diseño. Nunca colores/fuentes a fuego en componentes: todo sale de aquí.

Secciones: `[TOKENS]`

## `scripts/`

### `build_catalog.py`

Sesión 2 · Construye data/catalog/*.json (ÚNICA fuente de verdad del sitio) a partir de data/raw + data/analysis.    python3 -I scripts/build_catalog.py

Secciones: `[UTIL]` · `[IMG]` · `[CFG]` · `[CATS]` · `[PRODUCTS]` · `[PAGES]` · `[SITE]`

- `jl` (l. 38) — ----------------------------------------------------------------------------- [UTIL]
- `pth` (l. 45) — ruta absoluta con barra final: https://x/en/a/ -> /en/a/
- `lang_of_path` (l. 51) — ⚠ sin describir
- `text_of` (l. 56) — ⚠ sin describir
- `fetch` (l. 66) — ⚠ sin describir
- `clean_alt` (l. 78) — alt de imagen: se decodifican entidades; si parece un nombre de fichero (sin espacios) se descarta y la plantilla usa el nombre del producto
- `size_base` (l. 88) — ⚠ sin describir
- `img_ref` (l. 92) — URL original -> {file, thumb, w, h} local. Si no existe copia local, se conserva la URL remota (y se anota).
- `localize_blocks` (l. 103) — ⚠ sin describir
- `_expected_stem` (l. 118) — ⚠ sin describir
- `_real_path` (l. 122) — Ruta real de la página. Normalmente la canónica; pero la home EN declara canónica /de/ (error de la web original), así que en las homes manda el fichero.
- `_best_per_path` (l. 132) — Varias páginas pueden compartir URL canónica. Gana la cuyo fichero coincide con la ruta; si no, la de más texto. Se excluyen plantillas internas (elementor-hf).
- `alt_of` (l. 161) — ruta equivalente en otro idioma por hreflang
- `cooccurrence` (l. 174) — ES cat id → {cat id en idioma: peso}, por los productos traducidos que comparten (se desempata luego por coherencia de padres)
- `build_categories` (l. 195) — ⚠ sin describir
- `blocks_pdfs` (l. 264) — ----------------------------------------------------------------------------- [PRODUCTS]
- `build_products` (l. 268) — ⚠ sin describir
- `section_backgrounds` (l. 348) — mapa data-id de sección -> imagen de fondo, leyendo el CSS post-<id>.css de Elementor
- `page_blocks` (l. 357) — Devuelve dict con secciones del contenido principal (Elementor) convertidas a bloques, sin plantillas globales.
- `services_cards` (l. 382) — tarjetas de categorías de la home: enlaces a categoria-producto con título e icono
- `build_pages` (l. 398) — ⚠ sin describir
- `build_site` (l. 452) — ----------------------------------------------------------------------------- [SITE] menús, pie, datos de empresa
- `main` (l. 470) — ⚠ sin describir

### `build_prices.py`

Sesión 6 · Hoja de precios → data/catalog/prices.json (y generación de la hoja DEMO).    python3 -I scripts/build_prices.py              # usa data/catalog/prices.csv|xlsx si existe; si no, genera la hoja DEMO

- `seed` (l. 32) — ⚠ sin describir
- `num` (l. 36) — ⚠ sin describir
- `first_number` (l. 49) — ⚠ sin describir
- `lines_of_catalog` (l. 54) — todas las líneas pedibles: variantes reales o la línea genérica P<id>
- `demo_price` (l. 65) — precio DEMO determinista: función suave de la potencia (VA/W) + variación de céntimos por referencia. Nunca es una tarifa real.
- `write_demo_sheet` (l. 91) — ⚠ sin describir
- `read_sheet` (l. 128) — ⚠ sin describir
- `build` (l. 141) — ⚠ sin describir
- `main` (l. 161) — ⚠ sin describir

### `check_pdf_extract.py`

Comprobador determinista de data/analysis/pdfs/<trabajo>.json (Sesión 1).    python3 -I scripts/check_pdf_extract.py data/analysis/pdfs/p01-catalogo-es.json [--json]

- `toks` (l. 24) — ⚠ sin describir
- `walk` (l. 28) — ⚠ sin describir
- `page_text` (l. 39) — ⚠ sin describir
- `main` (l. 44) — ⚠ sin describir
- `put` (l. 57) — ⚠ sin describir

### `contrast_pdfs.py`

Sesión 11 · Contraste del catálogo Torivac 2024 en español frente al inglés (mismos 41 folios), determinista.    python3 -I scripts/contrast_pdfs.py            # escribe data/analysis/pdfs/contrast-es-en.json y data/analysis/pdf-contrast-proposals-raw.json

- `numbers` (l. 26) — lista de números de un valor (coma o punto decimal); None/vacío → []
- `load` (l. 31) — familias de los PDF indicados: [{family, page, models:{refkey:model}, refs}]
- `pair_families` (l. 43) — empareja familias ES↔EN por solape de claves de modelo, respetando el orden del documento (las secciones BO/Tapas/Aros comparten claves)
- `compare` (l. 65) — divergencias entre dos familias emparejadas
- `main` (l. 88) — ⚠ sin describir

### `enrich_catalog.py`

Sesión 2/11 · Enriquece el catálogo con lo que sale de los PDFs verificados (determinista, sin IA).    python3 -I scripts/enrich_catalog.py            # lee products.base.json → escribe products.json, proposals.json, voltage-tags.json

Secciones: `[UTIL]` · `[REFS]` · `[IDS]`

- `jl` (l. 35) — JSON de un fichero, o `d` si no existe / no es válido
- `to_num` (l. 43) — primer número de un texto (coma o punto decimal)
- `unit_of` (l. 49) — unidad: la de la cabecera «(mm)» o la que sigue al número
- `norm_spec` (l. 58) — valor de especificación → {raw, value, unit}
- `classify` (l. 70) — ('code', 'TT0020210') si el PDF imprime un código de fabricante; ('model', '160 VA') si solo identifica el modelo por potencia/número; (None, None) si no es utilizable
- `slug` (l. 83) — etiqueta de modelo → trozo de clave: «160 VA» → 160VA
- `pid_of` (l. 89) — ───── [IDS] identificador estable de propuesta: no cambia aunque aparezcan o desaparezcan otras
- `main` (l. 97) — ⚠ sin describir
- `prop` (l. 115) — ⚠ sin describir
- `add` (l. 214) — ⚠ sin describir

### `fetch_images.py`

Sesión 3 · Imágenes en local para el demo (solo GET sobre la web original, nunca se modifica nada allí).    python3 -I scripts/fetch_images.py

- `norm` (l. 35) — ⚠ sin describir
- `collect` (l. 42) — ⚠ sin describir
- `add` (l. 44) — ⚠ sin describir
- `get` (l. 82) — ⚠ sin describir
- `css_images` (l. 94) — ⚠ sin describir
- `one` (l. 96) — ⚠ sin describir
- `process` (l. 110) — ⚠ sin describir

### `gen_code_index.py`

Sesión 15 · Índice de código para programadores: archivo → propósito → secciones [ETIQUETA] → funciones y qué hace cada una.    python3 -I scripts/gen_code_index.py            # escribe docs/INDICE-CODIGO.md y muestra la cobertura

- `header_of` (l. 35) — Primer comentario del archivo (la «cabecera»).
- `comment_above` (l. 57) — Comentario inmediatamente encima de la línea idx (o al final de esa línea).
- `scan_js` (l. 71) — ⚠ sin describir
- `scan_php` (l. 86) — PHP: la cabecera es el primer docblock tras `<?php`; cada método/función lleva encima un docblock o un comentario `//`.
- `scan_py` (l. 102) — ⚠ sin describir
- `scan_css` (l. 127) — ⚠ sin describir
- `main` (l. 139) — ⚠ sin describir

### `inline_fonts.py`

Regenera site/assets/css/fonts.css (fuentes en base64) a partir de site/assets/fonts/*.woff2. Ver cabecera de fonts.css.

### `legal_proposals.py`

Sesión 9 · Hallazgos de las páginas legales (análisis de contenido) → PROPUESTAS para el panel. La web NO se modifica: los textos legales se publican tal cual están en la web original y los problemas quedan para que los revise quien corresponda (asesoría legal).

- `main` (l. 15) — ⚠ sin describir

### `link_pdfs.py`

Sesión 11 · Enlaza cada ficha de producto con la familia del PDF verificado que la describe (determinista, sin IA).    python3 -I scripts/link_pdfs.py            # escribe data/analysis/pdf-product-links.json

Secciones: `[TOKENS]` · `[LOAD]`

- `fold` (l. 52) — ⚠ sin describir
- `toks` (l. 56) — conjunto de palabras distintivas de un nombre
- `score` (l. 73) — similitud producto ↔ familia (0-1); 0 si hay atributos en conflicto
- `base_family` (l. 92) — nombre de familia sin el rango de potencias entre paréntesis (dos tablas de un mismo producto: 160-4000 VA y 5000-11000 VA)
- `code_of` (l. 97) — «HB - 4» → hb4
- `load_docs` (l. 103) — ───── [LOAD]
- `main` (l. 112) — ⚠ sin describir
- `mkeys` (l. 200) — familias de PDFs (ES) sin ningún producto enlazado y que NO sean duplicado (catálogo ↔ ficha) de una ya enlazada → candidatas a ficha nueva (propuesta)

### `make_thumbs.py`

Sesión 3/8 · Miniaturas incrustadas para el PDF del presupuesto, logo para el PDF y favicon.    python3 -I scripts/make_thumbs.py

- `data_url` (l. 24) — ⚠ sin describir
- `thumb` (l. 30) — ⚠ sin describir
- `main` (l. 45) — ⚠ sin describir

### `make_xlsx_fixtures.py`

[XLSX-FIXTURES] Genera los libros de ejemplo con los que se prueban los lectores de .xlsx del servidor (Worker en JS y API en PHP):    python3 -I scripts/make_xlsx_fixtures.py          → shared/xlsx/tarifa-openpyxl.xlsx · shared/xlsx/artesanal.xlsx · shared/xlsx/esperado.json

- `openpyxl_book` (l. 24) — ⚠ sin describir
- `put` (l. 38) — ⚠ sin describir
- `handmade_book` (l. 44) — ⚠ sin describir
- `expected` (l. 77) — ⚠ sin describir

### `map_translations.py`

Sesión 1 · Mapa de traducciones y lotes de trabajo (determinista).    python3 -I scripts/map_translations.py

- `load` (l. 23) — ⚠ sin describir
- `norm` (l. 30) — ⚠ sin describir
- `chain` (l. 55) — ⚠ sin describir

### `package_cpanel.py`

[PACKAGE-CPANEL] Paquete .zip para subir a un hosting con cPanel (web estática + API PHP), verificado antes de entregarlo.    python3 -I scripts/package_cpanel.py --base=https://pruebas.grupotorivac.com --staging     # subdominio/dominio de PRUEBAS (noindex, sin robots)

- `run` (l. 41) — ejecuta y devuelve (código, salida combinada)
- `build_site` (l. 47) — compila la web de producción (la salida se cuenta línea a línea en la consola de build)
- `copy_api` (l. 55) — copia el API PHP sin pruebas, sin almacén de datos y sin la configuración real (config.php lleva claves y la crea quien despliega)
- `shown` (l. 60) — ruta legible: relativa al proyecto si está dentro, absoluta si no
- `files` (l. 68) — ⚠ sin describir
- `verify` (l. 72) — → (errores, avisos). Un error impide entregar el paquete.
- `make_zip` (l. 154) — comprime la carpeta (con ficheros ocultos como .htaccess) y devuelve el SHA-256
- `main` (l. 166) — ⚠ sin describir

### `pdf_jobs.py`

Sesión 1 · Reparto de PDFs en trabajos para agentes. Requiere prepare.py pdf.    python3 -I scripts/pdf_jobs.py   -> data/analysis/pdf-jobs.json

- `fam` (l. 29) — ⚠ sin describir
- `norm_text` (l. 37) — ⚠ sin describir
- `add` (l. 58) — ⚠ sin describir

### `prepare.py`

Sesión 1 · Preparación determinista para el análisis.    python3 -I scripts/prepare.py            # todo

- `clean` (l. 31) — ⚠ sin describir
- `lang_of` (l. 35) — ⚠ sin describir
- `parse_page` (l. 40) — ⚠ sin describir
- `do_pages` (l. 109) — ⚠ sin describir
- `do_media` (l. 134) — Índice compacto de la mediateca (los media.*.json en bruto pesan 10 MB y son idénticos entre idiomas).
- `sh` (l. 151) — ⚠ sin describir
- `do_pdf` (l. 155) — Incremental: no reescribe lo ya procesado (los agentes lo están leyendo); añade solo PDFs nuevos y guarda el índice de forma atómica.

### `qa_content.py`

[QA-CONTENT] ¿El demo contiene el mismo texto que la web original? (Sesión 10, control de contenido)    python3 -I scripts/qa_content.py [--worst=25] [--lang=es]

- `words` (l. 19) — ⚠ sin describir
- `dist_file` (l. 20) — ⚠ sin describir
- `mine` (l. 23) — ⚠ sin describir
- `orig` (l. 29) — ⚠ sin describir
- `orig_clean` (l. 43) — ⚠ sin describir

### `secret_scan.py`

Sesión 16 · Escáner de secretos (claves de API, claves privadas, tokens) en los archivos versionados de torivac-web.    python3 -I scripts/secret_scan.py            # sale con código 1 si encuentra algo

- `tracked` (l. 31) — ⚠ sin describir
- `main` (l. 36) — ⚠ sin describir

### `semantic.py`

Conversor HTML (WordPress/Elementor/WooCommerce) -> bloques semánticos limpios.  Biblioteca (la usa build_catalog.py) y pequeña CLI de prueba:

Secciones: `[INLINE]` · `[WALK]`

- `_abs` (l. 32) — ⚠ sin describir
- `_clean` (l. 36) — ⚠ sin describir
- `inline_html` (l. 41) — [INLINE] sanitiza un nodo en HTML inline seguro (conserva enlaces y énfasis)
- `walk` (l. 43) — ⚠ sin describir
- `_img_block` (l. 69) — ⚠ sin describir
- `_table` (l. 79) — ⚠ sin describir
- `_is_button` (l. 89) — ⚠ sin describir
- `blocks_from` (l. 95) — [WALK] recorre en orden de documento y emite bloques
- `flush` (l. 99) — ⚠ sin describir
- `visit` (l. 110) — ⚠ sin describir
- `_dedupe` (l. 198) — quita imágenes duplicadas consecutivas (los carruseles Swiper repiten slides) y bloques vacíos
- `clean_wp_html` (l. 215) — [WPBAKERY] Restos de shortcodes sin renderizar en la web original: [vc_raw_html]BASE64[/vc_raw_html] se decodifica (base64 → URL-decode → HTML);
- `raw` (l. 218) — ⚠ sin describir
- `blocks_from_html` (l. 227) — ⚠ sin describir
- `elementor_sections` (l. 234) — [WALK] secciones de primer nivel de Elementor -> lista de listas de bloques

### `seo_check.py`

Sesión 16 · Auditoría SEO/GEO/accesibilidad estática de un build con --base (equivalente al seo-check de Why Not, ampliado a 4 idiomas).    node site/build.mjs --base=https://demo.torivac.example --out=/tmp/seo-dist

- `__init__` (l. 29) — ⚠ sin describir
- `handle_starttag` (l. 47) — ⚠ sin describir
- `handle_endtag` (l. 77) — ⚠ sin describir
- `handle_data` (l. 92) — ⚠ sin describir
- `route_of` (l. 101) — ⚠ sin describir
- `lang_of` (l. 106) — ⚠ sin describir
- `main` (l. 111) — ⚠ sin describir
- `err` (l. 119) — ⚠ sin describir
- `warn` (l. 122) — ⚠ sin describir

### `slice.py`

Trocea una captura alta en bandas visualizables: python3 -I scripts/slice.py in.png outdir [alto=1300] [ancho=1000]

### `ux_proposals.py`

Sesión 10 · Convierte los hallazgos de idioma de scripts/qa-ux.mjs en PROPUESTAS para el panel (nunca cambia la web).    node scripts/qa-ux.mjs && python3 -I scripts/ux_proposals.py     # lee data/analysis/qa-ux-desktop.json → data/analysis/ux-proposals-raw.json

- `main` (l. 20) — ⚠ sin describir

### `validate_products.py`

Validador determinista de data/analysis/products/<lote>.json (Sesión 1).    python3 -I scripts/validate_products.py data/analysis/products/g01-xxx.json [--json]

- `strip` (l. 28) — ⚠ sin describir
- `nz` (l. 32) — ⚠ sin describir
- `main` (l. 36) — ⚠ sin describir
- `norm_url` (l. 101) — ⚠ sin describir

### `web_vs_pdf.py`

Sesión 11 · Compara las TABLAS de las fichas de la web original con las tablas del PDF verificado (determinista).    python3 -I scripts/web_vs_pdf.py            # escribe data/analysis/web-vs-pdf.json

- `nums` (l. 29) — números de una celda: «2×1,5» → [2.0, 1.5]
- `head_key` (l. 34) — clave de una cabecera: las de 1-2 letras se respetan tal cual (D ≠ d); las largas se reducen a su primera palabra («Altura mm Height mm.» → altura, «Kgs.» → kg)
- `walk_tables` (l. 44) — ⚠ sin describir
- `table_rows` (l. 50) — ⚠ sin describir
- `main` (l. 54) — ⚠ sin describir

### `wpml_probe.py`

Sesión 2 · Mapa de traducciones según WPML (sondeo de solo lectura: GET sin seguir redirecciones).  OJO: WPML es el plugin de la web ORIGINAL (grupotorivac.com). La web nueva NO usa WPML ni ningún plugin de idioma: es HTML estático con su

- `probe` (l. 34) — GET sin seguir redirecciones → (código, destino).
- `classify` (l. 45) — ⚠ sin describir
- `main` (l. 56) — ⚠ sin describir
- `compare` (l. 74) — Discrepancias entre el mapa actual (hreflang + co-ocurrencia) y lo que dice WPML.

### `capturas.mjs`

[CAPTURAS] Capturas de pantalla de las vistas clave del demo (para revisar sin abrir nada) + PDF de ejemplo. node scripts/capturas.mjs [carpeta-salida]        (por defecto entrega/capturas) Sirve dist/ por http, recorre el flujo de un cliente (ficha → presupuesto → PDF) y el panel de gestión, y guarda PNG numerados.

Secciones: `[CAPTURAS]`

- `mk` (l. 24) — ⚠ sin describir
- `shot` (l. 30) — ⚠ sin describir
- `settle` (l. 31) — ⚠ sin describir
- `byPid` (l. 46) — ficha del transformador toroidal serie TT, con cantidades

### `harvest.mjs`

Sesión 1 · Cosecha de datos en bruto de grupotorivac.com (WordPress + WooCommerce + WPML). Reanudable: si un fichero ya existe, se salta. Ritmo educado (concurrencia 4 + pausa). node scripts/harvest.mjs            # todo

- `want` (l. 27) — ⚠ sin describir
- `sleep` (l. 29) — ⚠ sin describir
- `exists` (l. 30) — ⚠ sin describir
- `get` (l. 33) — ⚠ sin describir
- `save` (l. 53) — ⚠ sin describir
- `pool` (l. 60) — ⚠ sin describir
- `langOf` (l. 68) — ⚠ sin describir
- `slugOf` (l. 69) — g, "__")) || "home";
- `locs` (l. 70) — ⚠ sin describir
- `sitemaps` (l. 73) — ---------- 1. Sitemaps ----------
- `rest` (l. 92) — ⚠ sin describir
- `store` (l. 119) — ---------- 3. Store API + product tree ----------
- `knownLinks` (l. 149) — ---------- 4. HTML de cada URL ----------
- `keep` (l. 152) — ignora
- `hreflangs` (l. 165) — ⚠ sin describir
- `html` (l. 178) — ⚠ sin describir
- `pdfs` (l. 200) — ---------- 5. PDFs ----------
- `add` (l. 202) — ⚠ sin describir

### `perf.mjs`

[PERF] Sesión 16 · Rendimiento en móvil: FCP, LCP, CLS y bytes transferidos con CPU ×4 más lenta y red «4G lenta» (1,6 Mbps, 150 ms). node scripts/perf.mjs [--dir=dist]      Objetivo del proyecto: LCP < 2,5 s (el contrato de Why Not pide < 2 s con hosting real y brotli/CDN). El servidor de pruebas comprime en gzip el texto, como haría el hosting; las imágenes ya vienen en webp.

Secciones: `[PERF]`

- `dirArg` (l. 13) — ⚠ sin describir
- `pad` (l. 45) — ⚠ sin describir

### `qa-a11y.mjs`

[QA-A11Y] Sesión 16 · Accesibilidad WCAG 2.1 AA con axe-core sobre una muestra estratificada (2 páginas por plantilla e idioma, escritorio y móvil). node scripts/qa-a11y.mjs [--per=2] [--dir=dist] axe-core: `npm i -D axe-core` o AXE_PATH=/ruta/axe.min.js (la prueba lo busca en node_modules y en /tmp/axe-install).

Secciones: `[QA-A11Y]`

- `opt` (l. 13) — ⚠ sin describir

### `qa-admin-live.mjs`

[QA-ADMIN-LIVE] Sesión 7 · Panel REAL (admin-live.js) contra el backend real (sin red, correo ni IA reales). node scripts/qa-admin-live.mjs            contra el Worker torivac-api (en memoria) node scripts/qa-admin-live.mjs --php      contra el API PHP de cPanel (php -S) · ver scripts/lib/backends.mjs

Secciones: `[QA-ADMIN-LIVE]`

- `pick` (l. 27) — 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
- `ok` (l. 42) — ⚠ sin describir
- `newPage` (l. 43) — ⚠ sin describir
- `login` (l. 50) — ⚠ sin describir
- `navs` (l. 51) — ⚠ sin describir
- `toastText` (l. 52) — ⚠ sin describir

### `qa-art.mjs`

[QA-ART] Sesión 12 · Piezas gráficas: osciloscopio del variador (4 idiomas, ratón/teclado, movimiento reducido) y bobinado toroidal de la portada.

Secciones: `[QA-ART]`

- `ok` (l. 12) — ⚠ sin describir
- `amp` (l. 27) — ⚠ sin describir

### `qa-lang.mjs`

[QA-LANG] Sesión 13 · Detección de idioma del navegador + selector manual (Playwright, por http). node scripts/qa-lang.mjs Casos: idioma del navegador soportado / no soportado / lista con preferencia secundaria · página interior · enlace directo a /fr/ ·

Secciones: `[QA-LANG]`

- `ok` (l. 16) — ⚠ sin describir
- `pathOf` (l. 17) — los enlaces del sitio terminan en index.html (funcionan también por file://)
- `visitor` (l. 20) — idioma del navegador → se simula con locale + navigator.languages (Playwright solo fija el primero)
- `settle` (l. 27) — ⚠ sin describir
- `ls` (l. 28) — ⚠ sin describir

### `qa-live.mjs`

[QA-LIVE] Sesión 9/6 · La web de producción contra el backend REAL: sin red, sin enviar correo de verdad. node scripts/qa-live.mjs            contra el Worker torivac-api (workers/api, KV en memoria) node scripts/qa-live.mjs --php      contra el API PHP de cPanel (backend-php/api, php -S, almacén en ficheros)

Secciones: `[QA-LIVE]` · `[DATA]` · `[SITE]` · `[BACKEND]` · `[BROWSER]`

- `pick` (l. 23) — 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
- `round2` (l. 25) — ⚠ sin describir
- `unit` (l. 26) — ⚠ sin describir
- `ok` (l. 38) — ⚠ sin describir

### `qa-package.mjs`

[QA-PACKAGE] El paquete de cPanel tal y como se sube: lo genera package_cpanel.py (con sus verificaciones), se sirve con php -S (URLs limpias, API PHP real con almacén en ficheros, Resend simulado) y se recorre con el navegador: precios que llegan del servidor (el paquete NO lleva precios), presupuesto, pedido, panel y seguridad del API.

Secciones: `[QA-PACKAGE]` · `[PAQUETE]`

- `pick` (l. 26) — ⚠ sin describir
- `round2` (l. 28) — ⚠ sin describir
- `unit` (l. 29) — ⚠ sin describir
- `ok` (l. 38) — ⚠ sin describir
- `peek` (l. 88) — ⚠ sin describir

### `qa-quote.mjs`

[QA-QUOTE] Sesión 5 · Presupuesto realista de punta a punta en los 4 idiomas (Playwright, modo file://). node scripts/qa-quote.mjs Escenario: transformador toroidal (serie TT), resistencias y botones de baquelita, con cantidades que cruzan tramos de precio

Secciones: `[QA-QUOTE]` · `[DATA]` · `[SCENARIO]`

- `round2` (l. 27) — ⚠ sin describir
- `unitPrice` (l. 28) — ⚠ sin describir
- `ok` (l. 59) — ⚠ sin describir
- `norm` (l. 60) — ⚠ sin describir
- `file` (l. 69) — ' + path.join(DIST, p.replace(/^\//, ''), p.endsWith('/') ? 'index.html' : '');

### `qa-tarifa.mjs`

[QA-TARIFA] Extremo a extremo con una TARIFA en el formato real (Excel «Artículo · Descripción · Precio venta», precios con 8 decimales), datos SINTÉTICOS (no hay precios de Torivac en el repositorio): panel real → subir .xlsx → vista previa (columnas, referencias nuevas, desconocidas) → aplicar → ficha del producto con las referencias nuevas

Secciones: `[QA-TARIFA]`

- `ok` (l. 49) — ⚠ sin describir
- `round2` (l. 50) — ⚠ sin describir
- `newPage` (l. 51) — ⚠ sin describir

### `qa-ux.mjs`

[QA-UX] Sesión 10 · Control riguroso de experiencia de usuario sobre TODAS las páginas del demo (Playwright, por http). node scripts/qa-ux.mjs [--limit=N] [--mobile | --width=1280] [--only=/ruta/] [--workers=4] [--out=informe.json] Por página mide (tras recorrerla entera para que carguen las imágenes diferidas):

Secciones: `[QA-UX]`

- `opt` (l. 17) — ⚠ sin describir
- `inPage` (l. 40) — ───────────────────────────────────────── comprobaciones dentro de la página (se serializa a texto: sin cierres externos)
- `vis` (l. 42) — ⚠ sin describir
- `desc` (l. 43) — ⚠ sin describir
- `words` (l. 100) — ⚠ sin describir
- `worker` (l. 117) — ⚠ sin describir

### `screenshots.mjs`

Sesión 1 · Capturas y volcado de estilos de las plantillas clave de grupotorivac.com. node scripts/screenshots.mjs Salida:

- `rj` (l. 16) — ⚠ sin describir
- `pick` (l. 22) — ⚠ sin describir
- `cs` (l. 58) — ⚠ sin describir
- `sample` (l. 61) — ⚠ sin describir

### `smoke-admin.mjs`

[SMOKE-ADMIN] Prueba del panel (file://): login por rol, subida de Excel de precios, instrucción de precios, aplicar y verlo en la web.

Secciones: `[SMOKE-ADMIN]`

### `smoke.mjs`

[SMOKE] Prueba de humo del demo en un navegador real (Playwright). Modo file:// (doble clic) y capturas. node scripts/smoke.mjs [--shots] [--lang=es] Comprueba: errores de consola/red local, que no haya texto desbordado, flujo de presupuesto (añadir, cantidades, total, PDF).

Secciones: `[SMOKE]`

- `arg` (l. 13) — ⚠ sin describir
- `url` (l. 17) — ' + path.join(DIST, p.replace(/^\//, ''), p.endsWith('/') ? 'index.html' : '');
- `visit` (l. 29) — ⚠ sin describir

### `rebuild.sh`

Reconstruye TODO el demo a partir de los datos ya cosechados/analizados (orden importa). bash scripts/rebuild.sh            # contenido + catálogo + precios + sitio

## `scripts/lib/`

### `backends.mjs`

[BACKENDS] Servidores de API intercambiables para las pruebas de navegador: el Worker (workers/api, en memoria) o el PHP (backend-php/api, con `php -S`). Los mismos guiones (qa-live, qa-admin-live, qa-tarifa) corren contra los dos: si el contrato de un backend se desvía, falla la misma comprobación. const be = await startBackend({ kind: backendKind(), dist, port? });   (port: solo PHP, cuando la web ya lleva la URL compilada)   kind: 'worker' (por defecto) | 'php' (flag --php o TV_BACKEND=php)

Secciones: `[BACKENDS]` · `[WORKER]` · `[PHP]`

- `backendKind` (l. 21) — ⚠ sin describir
- `freePort` (l. 23) — ⚠ sin describir
- `readBody` (l. 24) — ⚠ sin describir
- `externals` (l. 27) — servicios de terceros simulados; la misma lógica sirve al Worker (fetchImpl) y al PHP (servidor http)
- `handle` (l. 29) — ⚠ sin describir
- `startWorker` (l. 41) — ───────────────────────────────────────────────────────────── [WORKER]
- `mockFetch` (l. 49) — ⚠ sin describir
- `startPhp` (l. 77) — ⚠ sin describir
- `writeCfg` (l. 95) — ⚠ sin describir
- `kv` (l. 108) — ⚠ sin describir
- `read` (l. 109) — ⚠ sin describir
- `startBackend` (l. 123) — ⚠ sin describir

### `static-server.mjs`

[STATIC-SERVER] Servidor estático mínimo para las pruebas de navegador (sirve dist/ por http como en producción). const { server, base } = await serve(DIST);   …   server.close();

Secciones: `[STATIC-SERVER]`

- `serve` (l. 10) — ⚠ sin describir

## `workers/api/src/`

### `ai.js`

[AI] Cambios de precios por INSTRUCCIÓN EN CASTELLANO (panel «Precios» → «Actualizar con una instrucción»). POST /api/prices/ai        {instruction}                → propone cambios (NUNCA los aplica) + vista previa POST /api/prices/ai/apply  {changes, confirm_large?}    → aplica los cambios ya revisados por la persona

Secciones: `[AI]`

- `buildTable` (l. 49) — Lista de precios en texto compacto para el prompt: «ref | nombre | 12.3456 | desde 10 uds = 11.9; desde 50 uds = 11.4».
- `num` (l. 54) — ⚠ sin describir
- `r4` (l. 55) — ⚠ sin describir
- `validateChanges` (l. 61) — Valida lo que devuelve la IA contra los precios y el catálogo reales.
- `applyChanges` (l. 94) — Aplica cambios ya validados sobre unos precios (devuelve unos nuevos; no toca los originales).
- `callAnthropic` (l. 104) — ⚠ sin describir
- `suggestPriceChanges` (l. 121) — Propone cambios para una instrucción. Lanza Error con .status (400 instrucción vacía, 503 IA sin configurar, 502 fallo de la IA).
- `applyPriceChanges` (l. 135) — Aplica los cambios que la persona ha revisado. Vuelve a validarlo todo en servidor (no se fía de lo que manda el navegador).

### `auth.js`

[AUTH] Contraseñas PBKDF2-HMAC-SHA256 (100 000 it., sal de 16 B) y sesiones firmadas HMAC-SHA256 sin estado en servidor. Patrón de whynot-sites/workers/admin (users.js). Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma). payload = { sub:email, role, name, exp }. Caduca a los 7 días.

Secciones: `[AUTH]`

- `pbkdf2` (l. 10) — ⚠ sin describir
- `hashPassword` (l. 14) — ⚠ sin describir
- `verifyPassword` (l. 18) — ⚠ sin describir
- `hmac` (l. 21) — ⚠ sin describir
- `signSession` (l. 25) — ⚠ sin describir
- `verifySession` (l. 29) — ⚠ sin describir
- `bearer` (l. 39) — ⚠ sin describir
- `authenticate` (l. 41) — Quién llama: {role:'manager'|'client', sub, name, master?} o null. ADMIN_API_TOKEN actúa como manager (scripts/CI).
- `requireRole` (l. 46) — ⚠ sin describir

### `catalog.js`

[CATALOG] Contexto del catálogo para leer hojas de precios: líneas pedibles del sitio, SKU de WooCommerce y reglas de códigos nuevos (generado por site/build.mjs). PRICE_DECIMALS (variable del Worker, opcional): decimales del precio unitario al importar (por defecto 4, máximo 6).

Secciones: `[CATALOG]`

- `catalogCtx` (l. 5) — ⚠ sin describir

### `cors.js`

[CORS] Solo los orígenes de ALLOWED_ORIGINS (y los *.pages.dev si ALLOW_PAGES_DEV=1) pueden llamar al API desde un navegador.

Secciones: `[CORS]`

- `isOriginAllowed` (l. 2) — [CORS] Solo los orígenes de ALLOWED_ORIGINS (y los *.pages.dev si ALLOW_PAGES_DEV=1) pueden llamar al API desde un navegador.
- `corsHeaders` (l. 9) — ⚠ sin describir

### `email.js`

[EMAIL] Envío por Resend (HTTP). Sin RESEND_API_KEY no se envía nada y se devuelve {skipped:true} (entornos de prueba).

Secciones: `[EMAIL]`

- `sendMail` (l. 3) — ⚠ sin describir
- `money` (l. 13) — ⚠ sin describir
- `orderMail` (l. 14) — ⚠ sin describir

### `index.js`

[INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login USUARIO   GET /api/auth/me · GET /api/orders (manager: todos; client: solo los suyos)

Secciones: `[INDEX]`

- `fetch` (l. 18) — ⚠ sin describir
- `scheduled` (l. 79) — ⚠ sin describir

### `orders.js`

[ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por email (equipo + copia al cliente, con el PDF).

Secciones: `[ORDERS]`

- `ymd` (l. 10) — ⚠ sin describir
- `nextNumber` (l. 11) — ⚠ sin describir
- `handleOrder` (l. 13) — ⚠ sin describir
- `handleContact` (l. 36) — ⚠ sin describir

### `prices.js`

[PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios). Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js): { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note, n?, pid? } } }   (n/pid: referencia que añade la hoja dentro de un producto)

Secciones: `[PRICES]`

- `loadPrices` (l. 9) — ⚠ sin describir
- `unitPrice` (l. 11) — ⚠ sin describir
- `priceOrder` (l. 16) — Valora las líneas {ref,qty}. Sin precio → unit/total null («Consultar»; no suman al total).
- `readPrices` (l. 24) — filas (con filas de título delante si las hay) → { prices, report } usando las reglas compartidas de shared/price-sheet.mjs.
- `rowsToPrices` (l. 30) — igual que readPrices pero devuelve solo el objeto de precios (lo usan el cron y los tests)
- `withSheetItems` (l. 32) — catálogo de referencias pedibles = las del sitio + las que la hoja de precios añadió dentro de un producto ({n, pid})
- `diffPrices` (l. 37) — ⚠ sin describir

### `ratelimit.js`

[RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.

Secciones: `[RATE-LIMIT]`

- `hit` (l. 2) — [RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.

### `sheets.js`

[SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV. Tres modos, en este orden: 1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID): hoja de Google → Sheets API v4; si el archivo es un .xlsx subido a Drive sin convertir → se descarga con la API de Drive y se lee el libro

Secciones: `[SHEETS]`

- `parseCsv` (l. 13) — ⚠ sin describir
- `pemToDer` (l. 27) — ⚠ sin describir
- `getAccessToken` (l. 29) — token de acceso OAuth2 de una cuenta de servicio (JWT RS256 firmado con WebCrypto)
- `xlsxRows` (l. 40) — filas de la hoja de precios de un libro .xlsx descargado (bytes) → { rows, sheet }; si no es un libro, el error dice qué revisar
- `readSheetRows` (l. 46) — ⚠ sin describir
- `savePrices` (l. 74) — Lee la hoja, valida, guarda en KV (con histórico de 10 versiones) y devuelve estadísticas.
- `syncPrices` (l. 84) — Lee la hoja (Drive, CSV o filas subidas), la valida con las reglas compartidas y la publica. ctx = contexto del catálogo (ver catalog.js); sin ctx se aceptan todas las referencias (pruebas).

### `turnstile.js`

[TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.

Secciones: `[TURNSTILE]`

- `verifyTurnstile` (l. 2) — [TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.

### `users.js`

[USERS] Usuarios en KV: clave user:<email>. Nunca se devuelve ni se guarda la contraseña en claro.

Secciones: `[USERS]`

- `key` (l. 3) — ⚠ sin describir
- `pub` (l. 5) — ⚠ sin describir
- `createUser` (l. 7) — ⚠ sin describir
- `listUsers` (l. 18) — ⚠ sin describir
- `deleteUser` (l. 23) — ⚠ sin describir
- `checkLogin` (l. 25) — Comprueba credenciales. Devuelve el usuario público o null (mismo coste si no existe: evita enumerar usuarios por tiempo).

### `util.js`

[UTIL] Respuestas JSON, escape HTML, comparación en tiempo constante, codificaciones.

Secciones: `[UTIL]`

- `json` (l. 2) — [UTIL] Respuestas JSON, escape HTML, comparación en tiempo constante, codificaciones.
- `esc` (l. 3) — ⚠ sin describir
- `timingSafeEqual` (l. 4) — ⚠ sin describir
- `toB64Url` (l. 5) — g, '_').replace(/=+$/, ''); };
- `fromB64Url` (l. 6) — ⚠ sin describir
- `toHex` (l. 7) — ⚠ sin describir
- `fromHex` (l. 8) — ⚠ sin describir
- `round2` (l. 9) — ⚠ sin describir
- `clientIp` (l. 10) — ⚠ sin describir
- `readJson` (l. 11) — ⚠ sin describir

### `validate.js`

[VALIDATE] Validación estricta de pedidos y mensajes de contacto. Todo lo que llega del navegador es no fiable.

Secciones: `[VALIDATE]`

- `clean` (l. 4) — ⚠ sin describir
- `parseOrder` (l. 6) — ⚠ sin describir
- `parseContact` (l. 28) — ⚠ sin describir

## `workers/api/test/`

### `ai.test.js`

Pruebas de [AI]: cambios de precios por instrucción en castellano (API de Anthropic simulada; no sale nada a la red).

Secciones: `[AI]`

- `aiReply` (l. 11) — ⚠ sin describir
- `env0` (l. 12) — ⚠ sin describir
- `fetchImpl` (l. 54) — ⚠ sin describir
- `call` (l. 88) — ⚠ sin describir
- `call` (l. 103) — ⚠ sin describir

### `api.test.js`

⚠ **sin cabecera**

- `goodOrder` (l. 12) — ⚠ sin describir
- `ok` (l. 65) — ⚠ sin describir
- `login` (l. 115) — ⚠ sin describir
- `as` (l. 119) — ⚠ sin describir
- `ok` (l. 177) — ⚠ sin describir

### `helpers.js`

Utilidades de test: KV en memoria con list() y TTL ignorado, y fetch simulado.

- `mkEnv` (l. 9) — demo.example', ...extra });
- `req` (l. 10) — api.test${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });

### `price-sheet.test.js`

Pruebas de la lectura tolerante de hojas de precios (shared/price-sheet.mjs) con los casos compartidos (shared/price-sheet.fixtures.json).

### `xlsx.test.js`

Lector de .xlsx del servidor (shared/xlsx.mjs): mismos libros y mismo resultado esperado que el port en PHP (backend-php/api/tests/XlsxTest.php).

- `book` (l. 10) — ⚠ sin describir
- `bytesRes` (l. 47) — ⚠ sin describir
- `fetchImpl` (l. 63) — ⚠ sin describir
- `mk` (l. 81) — ⚠ sin describir
- `dead` (l. 98) — ni Sheets ni Drive: error con los dos códigos y la pista de compartir el archivo

## `shared/`

### `price-sheet.mjs`

[PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → objeto de precios. FUENTE ÚNICA de las reglas. Lo usan el Worker (workers/api), los scripts de Node (scripts/import_prices.mjs), el panel demo (se copia a assets/js/price-sheet.js al compilar) y tiene un port en PHP (backend-php/lib/PriceSheet.php) que se prueba contra los mismos casos (shared/price-sheet.fixtures.json).

Secciones: `[PRICE-SHEET]`

- `normHeader` (l. 29) — cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa)
- `normRef` (l. 31) — referencia → clave de comparación: mayúsculas, sin espacios
- `parseNumber` (l. 34) — número de una celda: acepta «27,75», «27.75093203», «1.234,56», «1,234.56», «22 000», «€ 5» y números ya numéricos; vacío/ilegible → null
- `roundTo` (l. 46) — ⚠ sin describir
- `findHeader` (l. 49) — índice de la fila de cabecera (primera con una columna de referencia y una de precio) y mapa columna → posición
- `readSheet` (l. 67) — rows: matriz (primera fila = cabecera o con filas de título delante). ctx (todo opcional):
- `col` (l. 76) — ⚠ sin describir

### `xlsx.mjs`

[XLSX] Lector mínimo de libros .xlsx (un zip con XML) SIN dependencias: lo usa el Worker para leer la tarifa directamente de Drive (descarga del .xlsx tal cual, sin convertirlo a hoja de Google). Port en PHP: backend-php/api/lib/Xlsx.php. Ambos se prueban contra los mismos libros (shared/xlsx/*.xlsx, generados por scripts/make_xlsx_fixtures.py) y el mismo resultado esperado (shared/xlsx/esperado.json).

Secciones: `[XLSX]`

- `u16` (l. 14) — ⚠ sin describir
- `zipEntries` (l. 17) — índice del contenido del zip por nombre: { método, tamaño comprimido, posición de la cabecera local } (se lee del directorio central, al final del fichero)
- `entryText` (l. 34) — contenido de una entrada del zip (sin comprimir o deflate) como texto UTF-8
- `unesc` (l. 46) — entidades XML → texto (&amp; &lt; &#233; &#xE9;)
- `attrs` (l. 48) — atributos de una etiqueta XML: ' r="A1" t="s"' → { r: 'A1', t: 's' }
- `tText` (l. 50) — texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta
- `colIndex` (l. 52) — letras de columna → posición: A=0, Z=25, AA=26
- `sheetRows` (l. 55) — celdas de una hoja → filas (ver cabecera)
- `readXlsx` (l. 84) — @returns {Promise<{name:string, hidden:boolean, rows:any[][]}[]>}
- `text` (l. 86) — ⚠ sin describir
- `pickSheet` (l. 105) — elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio

## `backend-php/api/`

### `config.sample.php`

CONFIGURACIÓN DEL API DE TORIVAC (hosting con cPanel). 1) Copia este fichero como config.php (en esta misma carpeta) y rellénalo. 2) config.php NO se sube a ningún repositorio: contiene claves. Permisos recomendados: 640.

### `cron.php`

[CRON] Sincroniza los precios desde la hoja de Drive y limpia lo caducado. cPanel → «Trabajos de Cron» → una vez al día (p. ej. 03:00): /usr/local/bin/php /home/CUENTA/public_html/api/cron.php

Secciones: `[CRON]`

### `index.php`

[INDEX] Punto de entrada del API (api/index.php). El .htaccess de la web reescribe /api/* hasta aquí. Carga la configuración (config.php), inicializa el almacén de datos y despacha la petición.

Secciones: `[INDEX]`

## `backend-php/api/lib/`

### `Ai.php`

[AI] Cambios de precios por INSTRUCCIÓN EN CASTELLANO (panel «Precios» → «Actualizar con una instrucción»). POST /api/prices/ai        {instruction}                → propone cambios (NUNCA los aplica) + vista previa POST /api/prices/ai/apply  {changes, confirm_large?}    → aplica los cambios que la persona ya ha revisado

Secciones: `[AI]`

- `system` (l. 20) — ⚠ sin describir
- `toolSchema` (l. 32) — ⚠ sin describir
- `buildTable` (l. 46) — lista de precios en texto compacto para el prompt
- `n` (l. 58) — ⚠ sin describir
- `validateChanges` (l. 64) — Valida lo que devuelve la IA contra los precios y el catálogo reales.
- `applyChanges` (l. 105) — aplica cambios ya validados sobre unos precios (devuelve unos nuevos)
- `suggest` (l. 119) — Propone cambios (lanza \RuntimeException con código HTTP: 400 instrucción vacía, 503 IA sin configurar, 409 sin precios, 502 fallo de la IA)
- `apply` (l. 145) — Aplica los cambios revisados por la persona; vuelve a validarlo todo en servidor

### `Auth.php`

[AUTH] Contraseñas (password_hash: bcrypt/argon2 según el hosting) y sesiones firmadas HMAC-SHA256 sin estado en servidor. Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma); payload = {sub, role, name, exp(ms)}; caduca a los 7 días. El token maestro (config admin_token) actúa como manager para scripts y CI.

Secciones: `[AUTH]` · `[USERS]`

- `hashPassword` (l. 13) — ⚠ sin describir
- `verifyPassword` (l. 15) — ⚠ sin describir
- `signSession` (l. 17) — ⚠ sin describir
- `verifySession` (l. 24) — @return array{sub:string,role:string,name:string}|null
- `authenticate` (l. 37) — quién llama: ['role','sub','name','master'?] o null
- `requireRole` (l. 46) — ⚠ sin describir
- `key` (l. 52) — ⚠ sin describir
- `pub` (l. 54) — ⚠ sin describir
- `create` (l. 57) — @return array{user?:array,error?:string,status?:int}
- `all` (l. 71) — ⚠ sin describir
- `delete` (l. 78) — ⚠ sin describir
- `check` (l. 81) — comprueba credenciales (mismo coste si el usuario no existe: no se puede enumerar usuarios por tiempo)

### `Catalog.php`

[CATALOG] Catálogo de referencias pedibles que genera la compilación del sitio (generated/catalog.json): items {ref:{n,pid}} · skus {sku de WooCommerce:id de producto} · rules [{pattern,pid}] (códigos nuevos de una tarifa que encajan en un producto)

Secciones: `[CATALOG]`

- `load` (l. 12) — ⚠ sin describir
- `set` (l. 22) — sustituye el catálogo (pruebas)
- `items` (l. 24) — ⚠ sin describir
- `sheetCtx` (l. 27) — contexto para PriceSheet::read

### `Config.php`

[CONFIG] Lee api/config.php (copia de config.sample.php) y la sirve con claves anidadas: Config::get('mail.driver', 'file'). Las variables de entorno TORIVAC_<CLAVE> (p. ej. TORIVAC_SESSION_SECRET) tienen prioridad: útil para pruebas y para hostings con panel de variables.

Secciones: `[CONFIG]`

- `load` (l. 12) — ⚠ sin describir
- `set` (l. 20) — sustituye toda la configuración (pruebas)
- `get` (l. 23) — valor por ruta con puntos: 'prices.sheet_id'

### `Http.php`

[HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google. En las pruebas se sustituye por una función (Http::$mock) para no salir a Internet.

Secciones: `[HTTP]`

- `request` (l. 17) — @param string[] $headers líneas «Nombre: valor»

### `Mail.php`

[MAIL] Envío de correo con tres controladores (config mail.driver): resend → API HTTP de Resend (recomendado; hay que verificar el dominio con SPF/DKIM) mail   → función mail() de PHP (el propio hosting; sin garantías de entrega si el SPF del dominio no incluye el servidor)

Secciones: `[MAIL]`

- `send` (l. 16) — @param array{to:string[],cc?:string[],subject:string,html?:string,text?:string,replyTo?:string,attachments?:array} $m
- `encodeHeader` (l. 47) — ⚠ sin describir
- `mime` (l. 50) — cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail()
- `money` (l. 73) — importe con el formato del idioma del cliente (es 1.234,56 €, en €1,234.56, fr 1 234,56 €, de 1.234,56 €)
- `orderMail` (l. 85) — @return array{html:string,text:string}

### `Orders.php`

[ORDERS] POST /api/order y POST /api/contact: valida lo que llega del navegador (no es fiable), valora el pedido en servidor con los precios VIGENTES (ignora cualquier precio que mande el cliente), numera TV-AAAAMMDD-NNNN, guarda y envía por correo al equipo (con el PDF) y copia al cliente. Defensas: honeypot, límite por IP, Turnstile opcional, referencias solo del catálogo (o añadidas por la hoja de precios), cantidades enteras 1..1 000 000.

Secciones: `[ORDERS]`

- `parseOrder` (l. 15) — @return array{order?:array,error?:string}
- `parseContact` (l. 46) — @return array{contact?:array,error?:string}
- `verifyTurnstile` (l. 59) — Turnstile opcional: sin secreto se omite; con secreto, falla cerrado
- `team` (l. 72) — destinatarios del equipo: config order_to (array o texto separado por comas)
- `nextNumber` (l. 79) — ⚠ sin describir
- `handleOrder` (l. 91) — ⚠ sin describir
- `handleContact` (l. 114) — ⚠ sin describir

### `PriceSheet.php`

[PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → precios. Port FIEL de shared/price-sheet.mjs: las dos implementaciones se prueban con los mismos casos (shared/price-sheet.fixtures.json). FORMATOS: plantilla (ref · price · qty2/price2…), tarifa (Artículo · Descripción · Precio venta) y exportación de WooCommerce (SKU · Producto · Precio · Oferta · Stock).

Secciones: `[PRICE-SHEET]`

- `normHeader` (l. 35) — cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa)
- `normRef` (l. 43) — referencia → clave de comparación: mayúsculas y sin espacios
- `parseNumber` (l. 49) — número de una celda («27,75», «1.234,56», «1,234.56», «22 000», «€ 5»…); vacío o ilegible → null
- `findHeader` (l. 68) — @return array{index:int,map:array<string,int>,headers:string[]}|null
- `read` (l. 95) — @param array $rows matriz de celdas
- `num` (l. 189) — número sin ceros sobrantes, como lo escribe JavaScript (10, 10.5)

### `Prices.php`

[PRICES] Precios vigentes, tramos por cantidad, valoración de pedidos en servidor (el cliente nunca fija precios) e histórico. { updated_at, source, currency, mode:'demo'|'live'|'none', items:{ ref:{ p, t:[[cantMin,precio],…], note?, n?, pid? } } } Importes: el precio unitario conserva hasta 4 decimales; el importe de línea se redondea a 2.

Secciones: `[PRICES]` · `[SHEETS]`

- `load` (l. 17) — ⚠ sin describir
- `forJson` (l. 24) — para JSON: items vacío → {} y claves numéricas siempre como objeto
- `unit` (l. 30) — ⚠ sin describir
- `priceOrder` (l. 40) — valora líneas [{ref,qty}]; sin precio → unit/total null («Consultar»: no suman)
- `withSheetItems` (l. 53) — catálogo del sitio + referencias que la hoja añadió dentro de un producto
- `diff` (l. 63) — diferencias entre dos juegos de precios
- `save` (l. 77) — guarda unos precios nuevos: el anterior pasa al histórico (90 días), se escriben los vigentes y la meta
- `fromRows` (l. 89) — filas → ['prices' => …, 'report' => …] con las reglas compartidas de PriceSheet
- `parseCsv` (l. 101) — CSV (RFC 4180: comillas, separador , o ;, saltos de línea dentro de comillas) → filas
- `serviceAccount` (l. 123) — cuenta de servicio de Google: array, ruta a un .json o texto JSON
- `accessToken` (l. 135) — token de acceso OAuth2 (JWT RS256 firmado con openssl)
- `xlsxRows` (l. 150) — filas de la hoja de precios de un libro .xlsx descargado (bytes); si no es un libro, el error dice qué revisar
- `readRows` (l. 163) — Tres orígenes, en este orden:
- `sync` (l. 199) — Lee la hoja (Drive, CSV o filas subidas), valida y publica. ctx = contexto del catálogo (null → el del sitio; [] → aceptar todo, pruebas).

### `Request.php`

[REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP) + respuesta JSON + CORS + límite de uso. Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake).

Secciones: `[REQUEST]` · `[CORS]` · `[RATE-LIMIT]`

- `fromGlobals` (l. 18) — construye la petición real a partir de $_SERVER; la ruta es lo que sigue a «/api»
- `fake` (l. 39) — petición simulada para pruebas
- `header` (l. 50) — ⚠ sin describir
- `json` (l. 53) — cuerpo JSON como array (null si no es válido o supera el límite)
- `bearer` (l. 60) — ⚠ sin describir
- `__construct` (l. 73) — ⚠ sin describir
- `send` (l. 80) — ⚠ sin describir
- `allowed` (l. 91) — ⚠ sin describir
- `headers` (l. 105) — ⚠ sin describir
- `hit` (l. 115) — @return array{allowed:bool,remaining:int,resetAt:int}

### `Router.php`

[ROUTER] Rutas del API (equivalentes a workers/api/src/index.js: la web usa el mismo contrato con el Worker o con este PHP). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login USUARIO   GET /api/auth/me · GET /api/orders (manager: todos; cliente: solo los suyos)

Secciones: `[ROUTER]`

- `handle` (l. 14) — ⚠ sin describir
- `route` (l. 34) — ⚠ sin describir
- `cron` (l. 120) — sincroniza los precios (cron diario) y limpia lo caducado

### `Store.php`

[STORE] Almacén clave-valor en ficheros JSON (sustituye a Cloudflare KV en un hosting con cPanel). claves: user:<email> · order:<nº> · prices:current · prices:meta · prices:history:<ts> · rl:<cubo>:<id> · counter:<yyyymmdd> · proposals:state Escritura atómica (fichero temporal + rename) y bloqueo flock para los contadores. Caducidad opcional (TTL) comprobada al leer.

Secciones: `[STORE]`

- `init` (l. 15) — crea las carpetas y protege el directorio
- `root` (l. 29) — ⚠ sin describir
- `file` (l. 31) — ⚠ sin describir
- `get` (l. 34) — valor guardado (array/escalar) o null si no existe o caducó
- `put` (l. 46) — ⚠ sin describir
- `delete` (l. 57) — ⚠ sin describir
- `keys` (l. 60) — claves que empiezan por un prefijo (sin las caducadas)
- `locked` (l. 72) — ejecuta $fn con un bloqueo exclusivo (contador de pedidos, límites de uso)
- `purge` (l. 81) — borra lo caducado (lo llama el cron)

### `Util.php`

[UTIL] Utilidades sin estado: codificaciones, redondeo, escape HTML y comparaciones seguras. Compatible con PHP 7.4 o superior (sin match, str_contains ni argumentos con nombre).

Secciones: `[UTIL]`

- `b64url` (l. 11) — binario → base64 URL-safe sin relleno
- `unb64url` (l. 14) — base64 URL-safe → binario ('' si no es válido)
- `round2` (l. 23) — importe de línea: 2 decimales (mitad hacia arriba, igual que el navegador y el Worker)
- `round4` (l. 26) — precio unitario: 4 decimales (variaciones de céntimos)
- `esc` (l. 29) — escape para HTML
- `eq` (l. 32) — comparación en tiempo constante
- `startsWith` (l. 34) — ⚠ sin describir
- `nowMs` (l. 37) — milisegundos desde 1970
- `iso` (l. 40) — ISO 8601 con milisegundos y Z, como JavaScript (new Date().toISOString())
- `obj` (l. 47) — un array vacío debe salir como {} en JSON (no como []): lo necesitan items de precios y mapas
- `enc` (l. 53) — JSON legible y fiel: sin escapar tildes ni barras
- `clean` (l. 60) — cadena limpia de caracteres de control y recortada
- `isList` (l. 68) — ¿es una lista (array indexado 0..n-1)? (array_is_list existe solo desde PHP 8.1)

### `Xlsx.php`

[XLSX] Lector mínimo de libros .xlsx (zip + XML) sin extensiones ni librerías: la tarifa se lee directamente de Drive sin convertirla a hoja de Google. Port en PHP de shared/xlsx.mjs; ambos se prueban con los mismos libros (shared/xlsx/*.xlsx) y el mismo resultado esperado (shared/xlsx/esperado.json). Xlsx::read($bytes)           → [['name' => …, 'hidden' => bool, 'rows' => [[…], …]], …]   hojas en el orden del libro

Secciones: `[XLSX]`

- `u16` (l. 17) — ⚠ sin describir
- `u32` (l. 19) — ⚠ sin describir
- `entries` (l. 22) — índice del contenido del zip por nombre: método, tamaño comprimido y posición de la cabecera local (del directorio central, al final del fichero)
- `text` (l. 40) — contenido de una entrada del zip (sin comprimir o deflate)
- `unesc` (l. 54) — entidades XML → texto (&amp; &lt; &#233; &#xE9;)
- `attrs` (l. 57) — atributos de una etiqueta XML: ' r="A1" t="s"' → ['r' => 'A1', 't' => 's']
- `tText` (l. 65) — texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta
- `colIndex` (l. 74) — letras de columna → posición: A=0, Z=25, AA=26
- `sheetRows` (l. 82) — celdas de una hoja → filas (ver cabecera)
- `read` (l. 121) — @return array<int,array{name:string,hidden:bool,rows:array}>
- `pick` (l. 146) — elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio

### `autoload.php`

Autocarga mínima de las clases Torivac\* (cada una vive en lib/; las auxiliares comparten fichero con su clase principal)

## `backend-php/api/tools/`

### `create-user.php`

[CREATE-USER] Crea un usuario desde la línea de comandos (el primer manager, o clientes): php api/tools/create-user.php correo@dominio.com "Nombre Apellido" manager "contraseña de al menos 10 caracteres" Roles: manager (todo) · client (solo sus pedidos). La contraseña se guarda con password_hash.

Secciones: `[CREATE-USER]`

## `backend-php/api/tests/`

### `ApiTest.php`

Pruebas del API en PHP: equivalen a workers/api/test/api.test.js + ai.test.js (sin red: Resend, Google y Anthropic se simulan con Http::$mock)

- `test_auth_sessions` (l. 20) — ⚠ sin describir
- `test_users_and_login` (l. 33) — ⚠ sin describir
- `test_prices_tiers_and_rounding` (l. 50) — ⚠ sin describir
- `test_sheet_sync_rules` (l. 61) — ⚠ sin describir
- `test_csv_parser` (l. 81) — ⚠ sin describir
- `test_google_jwt` (l. 87) — ⚠ sin describir
- `test_order_flow_server_side_pricing` (l. 102) — ⚠ sin describir
- `test_order_validation_and_limits` (l. 120) — ⚠ sin describir
- `test_order_with_resend_driver` (l. 136) — ⚠ sin describir
- `test_mime_builder` (l. 154) — ⚠ sin describir
- `test_contact_and_cors` (l. 161) — ⚠ sin describir
- `test_prices_endpoint_etag` (l. 178) — ⚠ sin describir
- `test_manager_upload_roles_and_cron` (l. 188) — ⚠ sin describir
- `test_orders_visibility_and_users_api` (l. 215) — ⚠ sin describir
- `ai_reply` (l. 237) — ⚠ sin describir
- `test_ai_validation_and_flow` (l. 242) — ⚠ sin describir

### `PriceSheetTest.php`

Pruebas de PriceSheet con los casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json)

- `fixtures` (l. 7) — ⚠ sin describir
- `test_price_sheet_cases` (l. 14) — ⚠ sin describir
- `test_price_sheet_numbers` (l. 38) — ⚠ sin describir
- `test_price_sheet_errors` (l. 45) — ⚠ sin describir

### `XlsxTest.php`

Pruebas del lector de .xlsx con los mismos libros y el mismo resultado esperado que la versión JavaScript (shared/xlsx/)

- `xlsxDir` (l. 8) — ⚠ sin describir
- `test_xlsx_books_match_expected` (l. 14) — ⚠ sin describir
- `test_xlsx_pick_and_price_rules` (l. 25) — ⚠ sin describir
- `test_xlsx_rejects_non_books` (l. 41) — ⚠ sin describir
- `ttCtx` (l. 53) — ⚠ sin describir
- `setPrices` (l. 55) — ⚠ sin describir
- `test_sync_from_xlsx_url` (l. 57) — ⚠ sin describir
- `test_sync_from_xlsx_sheet_name_and_bad_downloads` (l. 73) — ⚠ sin describir
- `test_sync_service_account_sheets_then_drive_fallback` (l. 90) — ⚠ sin describir

### `harness.php`

[TESTS] Mini arnés de pruebas sin dependencias (no hace falta PHPUnit en el hosting): php tests/run.php            ejecuta todas las pruebas de tests/*Test.php Cada fichero define funciones test_*; assertSame/assertTrue/assertThrows comparan y cuentan.

Secciones: `[TESTS]`

- `same` (l. 15) — ⚠ sin describir
- `true` (l. 24) — ⚠ sin describir
- `throws` (l. 31) — ⚠ sin describir

### `run.php`

Ejecuta todas las pruebas: php tests/run.php  (código de salida 1 si alguna falla)

### `support.php`

Preparación común de las pruebas: almacén temporal, configuración de pruebas, catálogo sintético y peticiones simuladas

- `fresh` (l. 14) — ⚠ sin describir
- `prices` (l. 25) — ⚠ sin describir
- `seedPrices` (l. 30) — ⚠ sin describir
- `goodOrder` (l. 32) — ⚠ sin describir
- `req` (l. 37) — ⚠ sin describir
- `wire` (l. 40) — cuerpo de una respuesta tal y como lo recibe un cliente (JSON → arrays): los `items` de precios viajan como objeto y en el servidor son stdClass
- `master` (l. 42) — ⚠ sin describir
- `outbox` (l. 45) — correos guardados por el controlador «file»

