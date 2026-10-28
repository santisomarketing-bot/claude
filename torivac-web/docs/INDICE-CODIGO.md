# Índice de código (generado)

> Generado por `scripts/gen_code_index.py`. **No editar a mano**: se rehace con `python3 -I scripts/gen_code_index.py`.
> Cada archivo se describe por su cabecera; las secciones `[ETIQUETA]` marcan los bloques; cada función lleva su descripción (⚠ = falta describirla).
**Cobertura**: 102/409 funciones descritas (25 %) · 67/68 archivos con cabecera.


## `site/`

### `build.mjs`

[BUILD] Generador del sitio estático Torivac (demo).  Uso:  node site/build.mjs [--base=https://dominio] [--out=carpeta] Lee data/catalog/*.json (fuente única de verdad) y escribe dist/ (HTML por idioma + assets + datos para JS). Secciones: [LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS]

Secciones: `[BUILD]` · `[LOAD]` · `[CATS]` · `[PRODUCTS]` · `[SITE]` · `[EMIT]` · `[DATA]` · `[ASSETS]` · `[SEO]` · `[WORKER]` · `[ADMIN]` · `[CSS-PROD]` · `[SEO-FILES]`

- `arg0` (l. 16) — ⚠ sin describir
- `arg` (l. 18) — ⚠ sin describir
- `jl` (l. 20) — ⚠ sin describir
- `normName` (l. 37) — ───────────────────────────────────────────────────────────── [CATS] limpieza del árbol (duplicados → fusionados) y rutas
- `depthOf` (l. 40) — ⚠ sin describir
- `canon` (l. 42) — ⚠ sin describir
- `subtreeIds` (l. 65) — ⚠ sin describir
- `prodIdsOf` (l. 66) — ⚠ sin describir
- `visible` (l. 69) — ⚠ sin describir
- `prune` (l. 70) — ⚠ sin describir
- `site_prodById_placeholder` (l. 88) — ⚠ sin describir
- `pth` (l. 92) — ───────────────────────────────────────────────────────────── [SITE] estructura global por idioma
- `emit` (l. 144) — , '') + (p.endsWith('/') ? 'index.html' : ''), html); count++; };
- `mkctx` (l. 145) — ⚠ sin describir
- `fitTitle` (l. 149) — [SEO] migas de pan y nodos JSON-LD (solo se emiten con --base; ver site/lib/seo.mjs)
- `crumbHome` (l. 150) — ⚠ sin describir
- `crumbProducts` (l. 151) — ⚠ sin describir
- `pickAlt` (l. 152) — ⚠ sin describir
- `absImg` (l. 153) — ⚠ sin describir
- `alts` (l. 157) — ⚠ sin describir
- `a` (l. 294) — ⚠ sin describir
- `copyDir` (l. 301) — ⚠ sin describir
- `xml` (l. 318) — ⚠ sin describir
- `url` (l. 319) — ⚠ sin describir
- `sec` (l. 331) — ⚠ sin describir

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
- `crumbs` (l. 156) — ───────────────────────────────────────────────────────────── [SHARED] migas, etiquetas de tensión, tarjeta de producto
- `vtags` (l. 158) — ⚠ sin describir
- `productCard` (l. 168) — ⚠ sin describir
- `catTree` (l. 182) — árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
- `holds` (l. 184) — ⚠ sin describir
- `link` (l. 185) — ⚠ sin describir
- `walk` (l. 186) — ⚠ sin describir
- `categoryCards` (l. 193) — tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original
- `homeBody` (l. 210) — ───────────────────────────────────────────────────────────── [HOME]
- `text` (l. 213) — ⚠ sin describir
- `imgs` (l. 214) — ⚠ sin describir
- `btn` (l. 215) — ⚠ sin describir
- `eyebrowAndHead` (l. 227) — ⚠ sin describir
- `paras` (l. 232) — ⚠ sin describir
- `bt` (l. 233) — ⚠ sin describir
- `waveSvg` (l. 257) — onda de tensión animada (SVG) — elemento gráfico base del hero
- `sectionsHtml` (l. 264) — ───────────────────────────────────────────────────────────── [PAGES] páginas genéricas (empresa, proyectos, legales)
- `isPhoto` (l. 268) — los iconos pequeños se quedan dentro del texto
- `genericPage` (l. 284) — ⚠ sin describir
- `blogIndexBody` (l. 305) — ───────────────────────────────────────────────────────────── [BLOG]
- `postBody` (l. 310) — ⚠ sin describir
- `shopBody` (l. 320) — ───────────────────────────────────────────────────────────── [SHOP] listado / categoría
- `productBody` (l. 348) — ───────────────────────────────────────────────────────────── [PRODUCT] ficha
- `quoteBody` (l. 398) — ───────────────────────────────────────────────────────────── [QUOTE] página del presupuesto
- `contactForm` (l. 425) — ───────────────────────────────────────────────────────────── [CONTACT] formulario
- `contactIntro` (l. 441) — introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio)

## `site/lib/`

### `i18n.mjs`

[I18N] Textos de interfaz del demo en los 4 idiomas. Solo textos NUEVOS de la experiencia de pedido (presupuesto, filtros, formulario…): el contenido del sitio viene tal cual de la web original. Cada clave existe en es/en/fr/de. El idioma por defecto del sitio es 'es' (raíz); en/fr/de viven bajo /en /fr /de.

Secciones: `[I18N]`

- `countLabel` (l. 101) — «1 producto / 2 productos» en los 4 idiomas
- `refLabel` (l. 102) — ⚠ sin describir
- `t` (l. 103) — ⚠ sin describir

### `render.mjs`

[RENDER] Utilidades del generador: escape, rutas relativas, enlaces internos, bloques semánticos → HTML. RUTAS: el demo se puede abrir con doble clic (file://). Por eso todos los enlaces internos son RELATIVOS y terminan en index.html. Las URLs lógicas (las mismas que la web original: /product/x/, /en/…) se conservan como estructura

Secciones: `[RENDER]`

- `esc` (l. 10) — ⚠ sin describir
- `dirOf` (l. 14) — ruta lógica de página ('/en/product/x/') → carpeta de salida relativa a dist ('en/product/x')
- `rel` (l. 17) — URL relativa desde la página `from` hasta la página lógica `to` (+hash opcional).
- `asset` (l. 23) — URL relativa a un asset ('assets/css/x.css') desde la página `from`.
- `mapLink` (l. 38) — Reescribe un enlace de la web original a su equivalente local (página, PDF) o lo deja absoluto.
- `inlineHtml` (l. 57) — HTML inline de un bloque (los enlaces internos se reescriben).
- `tbl` (l. 65) — ⚠ sin describir
- `cell` (l. 69) — ⚠ sin describir
- `blocksHtml` (l. 78) — Bloques semánticos → HTML. opts.demote: sube el nivel de los encabezados (h1→h2…) para que la plantilla sea dueña del h1.
- `plain` (l. 115) — ⚠ sin describir
- `fmtDate` (l. 117) — ⚠ sin describir
- `writeFile` (l. 119) — ⚠ sin describir

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
- `rowsToPrices` (l. 35) — ⚠ sin describir
- `diffPrices` (l. 50) — ⚠ sin describir
- `itemName` (l. 56) — ⚠ sin describir
- `toast` (l. 57) — ⚠ sin describir
- `download` (l. 58) — ⚠ sin describir
- `orders` (l. 59) — ⚠ sin describir
- `V.resumen` (l. 68) — ⚠ sin describir
- `kpi` (l. 79) — ⚠ sin describir
- `V.pedidos` (l. 81) — ⚠ sin describir
- `V.mis` (l. 87) — ⚠ sin describir
- `V.precios` (l. 89) — ⚠ sin describir
- `V.lista` (l. 97) — ⚠ sin describir
- `V.propuestas` (l. 102) — ⚠ sin describir
- `V.contenido` (l. 112) — ⚠ sin describir
- `cell` (l. 114) — ⚠ sin describir
- `V.estadisticas` (l. 119) — ⚠ sin describir
- `V.ajustes` (l. 125) — ⚠ sin describir
- `V.presupuestador` (l. 130) — ⚠ sin describir
- `showDraft` (l. 136) — ⚠ sin describir
- `rowsOf` (l. 138) — ⚠ sin describir
- `applyDraft` (l. 144) — ⚠ sin describir
- `readUpload` (l. 145) — ⚠ sin describir
- `go` (l. 147) — ⚠ sin describir
- `itemHaystack` (l. 153) — ───────────────────────────────────────── [PROMPT] instrucciones en castellano → reglas de precio (demo, sin IA)
- `targetMatches` (l. 154) — ⚠ sin describir
- `parsePrompt` (l. 158) — ⚠ sin describir
- `runPrompt` (l. 170) — ⚠ sin describir
- `f` (l. 179) — ⚠ sin describir
- `bind` (l. 189) — ───────────────────────────────────────── [ROUTER]
- `onClick` (l. 193) — ⚠ sin describir
- `render` (l. 206) — ⚠ sin describir

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

Secciones: `[QUOTE-ENGINE]` · `[STATE]` · `[FORMAT]` · `[PRICES]` · `[API]` · `[REFRESH]` · `[OVERRIDE]` · `[CSV]`

- `applyOverride` (l. 21) — ───────────────────────────────────────── [OVERRIDE] precios cargados desde el panel (demo): sustituyen a TV.prices en este navegador
- `clean` (l. 33) — ⚠ sin describir
- `load` (l. 34) — ⚠ sin describir
- `save` (l. 40) — ⚠ sin describir
- `emit` (l. 45) — ⚠ sin describir
- `buildFormats` (l. 53) — ⚠ sin describir
- `money` (l. 59) — ⚠ sin describir
- `unitMoney` (l. 60) — ⚠ sin describir
- `t` (l. 61) — ⚠ sin describir
- `rel` (l. 63) — ruta relativa a una página lógica (/en/product/x/) desde la página actual
- `assetUrl` (l. 67) — ⚠ sin describir
- `priceOf` (l. 71) — ───────────────────────────────────────── [PRICES]
- `tiersOf` (l. 78) — ⚠ sin describir
- `round2` (l. 79) — ⚠ sin describir
- `lines` (l. 83) — ⚠ sin describir
- `count` (l. 84) — ⚠ sin describir
- `kinds` (l. 85) — ⚠ sin describir
- `has` (l. 86) — ⚠ sin describir
- `add` (l. 87) — ⚠ sin describir
- `set` (l. 93) — ⚠ sin describir
- `remove` (l. 100) — ⚠ sin describir
- `clear` (l. 101) — ⚠ sin describir
- `detail` (l. 103) — líneas detalladas + total (solo suma las que tienen precio)
- `onChange` (l. 113) — ⚠ sin describir
- `applyOverride` (l. 114) — ⚠ sin describir
- `label` (l. 117) — nombre de línea listo para mostrar
- `shownRef` (l. 119) — referencia visible (las líneas genéricas P#### no se muestran como referencia)
- `importRows` (l. 121) — importa filas {ref, qty}: devuelve {added, unknown[]}
- `base` (l. 136) — ⚠ sin describir
- `live` (l. 137) — ⚠ sin describir
- `post` (l. 138) — ⚠ sin describir
- `TV.csvParse` (l. 145) — ⚠ sin describir
- `TV.refreshPrices` (l. 162) — ───────────────────────────────────────── [REFRESH] recarga manual de precios (el cron de 24 h lo hace el servidor; ver Sesión 6)
- `n.onload` (l. 167) — ⚠ sin describir
- `n.onerror` (l. 168) — ⚠ sin describir

### `shop.js`

[SHOP] Listados (filtros por tensión y búsqueda) y fichas de producto (tabla de modelos con cantidades, galería). Secciones: [FILTERS] filtros del listado · [MODELS] tabla de modelos · [GALLERY] galería · [PRICES] precios en las filas Depende de: quote.js, app.js (TV.$, TV.$$, TV.toast).

Secciones: `[SHOP]` · `[FILTERS]` · `[MODELS]` · `[GALLERY]` · `[PRICES]`

- `apply` (l. 15) — ⚠ sin describir
- `qtyOf` (l. 36) — ⚠ sin describir
- `updatePrice` (l. 51) — ───────────────────────────────────────── [PRICES] precio unitario y tramos por fila
- `allPrices` (l. 59) — ⚠ sin describir

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

### `enrich_catalog.py`

Sesión 2 · Enriquece el catálogo con lo que sale de los PDFs verificados y de los agentes de análisis.    python3 -I scripts/enrich_catalog.py            # lee products.base.json → escribe products.json (+ proposals.json, voltage-tags.json)

- `jl` (l. 27) — ⚠ sin describir
- `to_num` (l. 34) — ⚠ sin describir
- `unit_of` (l. 39) — ⚠ sin describir
- `norm_spec` (l. 47) — ⚠ sin describir
- `main` (l. 51) — ⚠ sin describir

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

- `header_of` (l. 33) — Primer comentario del archivo (la «cabecera»).
- `comment_above` (l. 55) — Comentario inmediatamente encima de la línea idx (o al final de esa línea).
- `scan_js` (l. 69) — ⚠ sin describir
- `scan_py` (l. 84) — ⚠ sin describir
- `scan_css` (l. 109) — ⚠ sin describir
- `main` (l. 121) — ⚠ sin describir

### `inline_fonts.py`

Regenera site/assets/css/fonts.css (fuentes en base64) a partir de site/assets/fonts/*.woff2. Ver cabecera de fonts.css.

### `legal_proposals.py`

Sesión 9 · Hallazgos de las páginas legales (análisis de contenido) → PROPUESTAS para el panel. La web NO se modifica: los textos legales se publican tal cual están en la web original y los problemas quedan para que los revise quien corresponda (asesoría legal).

- `main` (l. 15) — ⚠ sin describir

### `make_thumbs.py`

Sesión 3/8 · Miniaturas incrustadas para el PDF del presupuesto, logo para el PDF y favicon.    python3 -I scripts/make_thumbs.py

- `data_url` (l. 24) — ⚠ sin describir
- `thumb` (l. 30) — ⚠ sin describir
- `main` (l. 45) — ⚠ sin describir

### `map_translations.py`

Sesión 1 · Mapa de traducciones y lotes de trabajo (determinista).    python3 -I scripts/map_translations.py

- `load` (l. 23) — ⚠ sin describir
- `norm` (l. 30) — ⚠ sin describir
- `chain` (l. 55) — ⚠ sin describir

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

[QA-LIVE] Sesión 9/6 · La web de producción contra el Worker REAL (workers/api) en memoria: sin red, sin enviar correo de verdad. node scripts/qa-live.mjs Cadena: navegador (Playwright) → dist/ servido por http → Worker torivac-api (KV en memoria, Resend simulado).

Secciones: `[QA-LIVE]` · `[DATA]` · `[SITE]` · `[WORKER]` · `[BROWSER]`

- `round2` (l. 26) — ⚠ sin describir
- `unit` (l. 27) — ⚠ sin describir
- `mockFetch` (l. 35) — ⚠ sin describir
- `ok` (l. 49) — ⚠ sin describir

### `qa-quote.mjs`

[QA-QUOTE] Sesión 5 · Presupuesto realista de punta a punta en los 4 idiomas (Playwright, modo file://). node scripts/qa-quote.mjs Escenario: transformador toroidal (serie TT), resistencias y botones de baquelita, con cantidades que cruzan tramos de precio

Secciones: `[QA-QUOTE]` · `[DATA]` · `[SCENARIO]`

- `round2` (l. 27) — ⚠ sin describir
- `unitPrice` (l. 28) — ⚠ sin describir
- `ok` (l. 59) — ⚠ sin describir
- `norm` (l. 60) — ⚠ sin describir
- `file` (l. 69) — ' + path.join(DIST, p.replace(/^\//, ''), p.endsWith('/') ? 'index.html' : '');

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

### `static-server.mjs`

[STATIC-SERVER] Servidor estático mínimo para las pruebas de navegador (sirve dist/ por http como en producción). const { server, base } = await serve(DIST);   …   server.close();

Secciones: `[STATIC-SERVER]`

- `serve` (l. 10) — ⚠ sin describir

## `workers/api/src/`

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

- `fetch` (l. 16) — ⚠ sin describir
- `scheduled` (l. 57) — ⚠ sin describir

### `orders.js`

[ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por email (equipo + copia al cliente, con el PDF).

Secciones: `[ORDERS]`

- `ymd` (l. 10) — ⚠ sin describir
- `nextNumber` (l. 11) — ⚠ sin describir
- `handleOrder` (l. 13) — ⚠ sin describir
- `handleContact` (l. 35) — ⚠ sin describir

### `prices.js`

[PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios). Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js): { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note } } }

Secciones: `[PRICES]`

- `loadPrices` (l. 8) — ⚠ sin describir
- `unitPrice` (l. 10) — ⚠ sin describir
- `priceOrder` (l. 15) — Valora las líneas {ref,qty}. Sin precio → unit/total null («Consultar»; no suman al total).
- `num` (l. 21) — ⚠ sin describir
- `rowsToPrices` (l. 24) — filas (primera = cabecera, en minúsculas o no) → objeto de precios. Ignora filas sin ref/price o con active=0/no/false.
- `ix` (l. 27) — ⚠ sin describir
- `diffPrices` (l. 40) — ⚠ sin describir

### `ratelimit.js`

[RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.

Secciones: `[RATE-LIMIT]`

- `hit` (l. 2) — [RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.

### `sheets.js`

[SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV. Dos modos, en este orden:  1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID) → Sheets API v4;  2) PRICE_CSV_URL (exportación CSV pública con enlace). Seguridad: la sincronización se niega a publicar si la hoja nueva tiene < 50 % de las referencias que ya había (hoja vacía/rota) salvo force=true.

Secciones: `[SHEETS]`

- `parseCsv` (l. 8) — ⚠ sin describir
- `pemToDer` (l. 22) — ⚠ sin describir
- `getAccessToken` (l. 24) — token de acceso OAuth2 de una cuenta de servicio (JWT RS256 firmado con WebCrypto)
- `readSheetRows` (l. 34) — ⚠ sin describir
- `syncPrices` (l. 50) — Lee la hoja, valida, guarda en KV (con histórico de 10 versiones) y devuelve estadísticas.

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

### `api.test.js`

⚠ **sin cabecera**

- `goodOrder` (l. 12) — ⚠ sin describir
- `ok` (l. 65) — ⚠ sin describir
- `login` (l. 115) — ⚠ sin describir
- `as` (l. 119) — ⚠ sin describir

### `helpers.js`

Utilidades de test: KV en memoria con list() y TTL ignorado, y fetch simulado.

- `mkEnv` (l. 9) — demo.example', ...extra });
- `req` (l. 10) — api.test${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });

