# Índice de código (generado)

> Generado por `scripts/gen_code_index.py`. **No editar a mano**: se rehace con `python3 -I scripts/gen_code_index.py`.
> Cada archivo se describe por su cabecera; las secciones `[ETIQUETA]` marcan los bloques; cada función lleva su descripción (⚠ = falta describirla).
**Cobertura**: 725/725 funciones descritas (100 %) · 116/116 archivos con cabecera.


## `site/`

### `build.mjs`

[BUILD] Generador del sitio estático Torivac (demo).  Uso:  node site/build.mjs [--base=https://dominio] [--out=carpeta] Lee data/catalog/*.json (fuente única de verdad) y escribe dist/ (HTML por idioma + assets + datos para JS). Secciones: [LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS]

Secciones: `[BUILD]` · `[LOAD]` · `[CATS]` · `[PRODUCTS]` · `[SITE]` · `[EMIT]` · `[DATA]` · `[ASSETS]` · `[LIVE]` · `[OVERRIDES]` · `[SEO]` · `[WORKER]` · `[ADMIN]` · `[PRICE-SHEET]` · `[CSS-PROD]` · `[SEO-FILES]` · `[HOSTING]`

- `arg0` (l. 18) — Valor de la opción `--k=valor` de la línea de comandos ('' si no se pasó).
- `arg` (l. 21) — Igual que arg0: valor de la opción `--k=valor` de la línea de comandos ('' si no se pasó).
- `jl` (l. 27) — Lee data/catalog/<f> como JSON; devuelve `d` si el archivo no existe o no es JSON válido.
- `normName` (l. 50) — Normaliza un nombre de categoría para detectar duplicados: minúsculas, sin tildes ni signos y con las palabras en singular.
- `depthOf` (l. 54) — Profundidad de una categoría en el árbol (0 = raíz), subiendo por `parent`.
- `canon` (l. 57) — Id de la categoría que se conserva tras fusionar duplicados (el mismo `id` si no se fusionó).
- `subtreeIds` (l. 91) — Ids de una categoría y de todas sus descendientes.
- `prodIdsOf` (l. 93) — Ids de los productos asignados a una categoría o a cualquiera de sus subcategorías.
- `visible` (l. 97) — Una categoría se muestra si tiene productos y su slug no está en la lista de ocultas (HIDE).
- `prune` (l. 99) — Quita (recursivo) las categorías no visibles y ordena cada nivel por nombre en español.
- `pth` (l. 120) — Ruta de una URL de grupotorivac.com con barra final, salvo que termine en una extensión de archivo.
- `emit` (l. 173) — Escribe en dist el HTML de la ruta lógica `p` (como p/index.html si termina en barra) y suma una página al contador.
- `mkctx` (l. 175) — Contexto de render (Ctx) de la página `p` en el idioma `lang`; `section` marca el ítem activo del menú.
- `fitTitle` (l. 180) — título ≤ 65: «Nombre · Torivac» si cabe; si no, solo el nombre (recortado). Las categorías homónimas llevan el nombre del padre.
- `crumbHome` (l. 182) — Miga de pan «Inicio» del idioma `lang`: { name, path }.
- `crumbProducts` (l. 184) — Miga de pan «Productos» del idioma `lang`: { name, path }.
- `pickAlt` (l. 186) — Texto alt de una imagen en el idioma `lang` (español si falta; '' si no hay).
- `absImg` (l. 188) — URL absoluta de una imagen (solo con --base); null si no hay base o la imagen no tiene archivo.
- `alts` (l. 193) — Traducciones de la página `pagePath` ({ idioma: ruta }), solo las que existen en el sitio generado.
- `a` (l. 337) — Ruta relativa al recurso `s` desde /admin/ (assets del panel).
- `copyDir` (l. 351) — Copia recursivamente la carpeta `a` en `b`, creando los directorios que falten.
- `xml` (l. 369) — Escapa &, <, > y comillas para el XML del sitemap (null/undefined → '').
- `url` (l. 371) — Entrada <url> del sitemap de una página registrada: loc, enlaces hreflang (con x-default) e imágenes con alt.
- `sec` (l. 383) — Sección Markdown de llms.txt: encabezado `## título` y una línea por fila.
- `t` (l. 405) — Texto de interfaz `k` en el idioma del bucle (español si falta la traducción; la propia clave si no existe).

### `templates.mjs`

[TEMPLATES] Plantillas HTML (funciones puras: datos → string). Cada una devuelve el <main> de su página; `layout()` lo envuelve con cabecera, pie, elementos flotantes y scripts. Datos: data/catalog/*.json (ver docs/ARQUITECTURA.md). Textos de interfaz: site/lib/i18n.mjs.

Secciones: `[TEMPLATES]` · `[ART]` · `[A11Y]` · `[META]` · `[LAYOUT]` · `[SEO-FILES]` · `[NAV]` · `[SOCIAL]` · `[SHARED]` · `[HOME]` · `[PAGES]` · `[BLOG]` · `[SHOP]` · `[PRODUCT]` · `[QUOTE]` · `[CONTACT]`

- `pick` (l. 11) — Valor de un campo traducible en el idioma `lang` (español si falta; '' si no hay objeto).
- `toroidArt` (l. 18) — Bobinado toroidal visto desde arriba (mismo motivo que el logotipo): 56 espiras que se «dibujan» al entrar en pantalla (CSS + IntersectionObserver en app.js).
- `waveLab` (l. 27) — Osciloscopio esquemático de un variador de tensión: la onda de salida (cobre) se reduce al mover el mando; la de entrada (230 V) queda fija. JS: assets/js/lab.js
- `headingOrder` (l. 47) — El contenido original salta de nivel (H1→H4). Se corrige en la ACCESIBILIDAD (aria-level) sin tocar la etiqueta, así el diseño no cambia:
- `metaDescription` (l. 60) — Usa la descripción original si es útil; si no, el primer párrafo real de la página (sin inventar nada); como último recurso, una frase genérica de marca.
- `ok` (l. 62) — Una descripción sirve si tiene al menos 50 caracteres y no es solo signos o cifras.
- `layout` (l. 73) — Envuelve `hero` + `body` en la página HTML completa (SEO, cabecera, pie, presupuesto, scripts) y la registra para el sitemap.
- `alt` (l. 76) — selector de idioma: sin traducción cae a la portada de ese idioma
- `crumbs` (l. 161) — Migas de pan (nav + ol): todas enlazadas salvo la última, que lleva aria-current=page.
- `vtext` (l. 164) — Texto de un campo traducible (objeto por idioma o cadena) en el idioma `lang`, con respaldo al español.
- `vtags` (l. 166) — Fila de etiquetas de tensión (hasta `limit`) de un producto; '' si no hay ninguna conocida.
- `productCard` (l. 177) — Tarjeta de un producto del listado: foto, nombre, etiquetas de tensión y nº de referencias, con data-* para filtrar.
- `catTree` (l. 191) — árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
- `holds` (l. 194) — Indica si la categoría `c` es la activa o contiene a la activa entre sus descendientes.
- `link` (l. 196) — Enlace a una categoría con su nombre y su nº de productos; marca aria-current si es la activa.
- `walk` (l. 198) — Lista anidada del árbol de categorías; abre (data-open) las ramas que contienen la activa.
- `categoryCards` (l. 205) — tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original
- `homeBody` (l. 223) — Portada: devuelve { hero, body } con el hero, cinco secciones (fotos, servicios, catálogo) y el formulario de contacto.
- `text` (l. 227) — Bloques de título y párrafo de una sección (hoy sin uso en homeBody).
- `imgs` (l. 229) — Bloques de imagen de una sección.
- `btn` (l. 231) — Primer bloque de botón de una sección (undefined si no tiene).
- `eyebrowAndHead` (l. 244) — HTML del antetítulo (encabezado de nivel 4 o más) y del título h2 (nivel 3 o menos) de una sección.
- `paras` (l. 250) — HTML de los párrafos de una sección, con los enlaces internos reescritos.
- `bt` (l. 252) — Enlace-botón (clase btn + `cls`) del botón de una sección; '' si no tiene.
- `waveSvg` (l. 276) — onda de tensión animada (SVG) — elemento gráfico base del hero
- `sectionsHtml` (l. 284) — Secciones de una página genérica en HTML (texto, foto o carrusel, fondo oscuro, formulario de contacto), alternando el fondo.
- `isPhoto` (l. 288) — los iconos pequeños se quedan dentro del texto
- `genericPage` (l. 305) — Página genérica (empresa, proyectos, legales…): devuelve { hero, body, title }; el primer encabezado pasa a h1 del hero.
- `blogIndexBody` (l. 327) — Listado del blog: tarjetas con imagen, fecha, título y extracto (150 caracteres) de cada entrada.
- `postBody` (l. 333) — Entrada de blog: devuelve { hero, body } con migas, h1, fecha y el contenido sin su H1 original.
- `shopBody` (l. 344) — Listado de productos (tienda o categoría): barra lateral con categorías, tensiones y búsqueda, subcategorías y tarjetas.
- `productBody` (l. 373) — Ficha de producto: galería, etiquetas de tensión, descripción, fichas PDF, tabla de modelos con cantidades y relacionados.
- `quoteBody` (l. 423) — Página del presupuesto: tabla del pedido, carga de CSV/Excel y formulario de datos para enviarlo o descargar el PDF.
- `contactForm` (l. 451) — Formulario de contacto accesible (nombre, email, mensaje, privacidad y campo trampa antispam); `where` hace únicos los ids.
- `contactIntro` (l. 467) — introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio)

## `site/lib/`

### `hosting.mjs`

[HOSTING] Archivos de servidor para publicar en un hosting con cPanel (Apache o LiteSpeed): .htaccess, robots.txt de pruebas y 404 por idioma. Se generan solo con --base (producción o dominio de pruebas); la compilación de demostración (doble clic) no los necesita. htaccess({ base, staging, aliases, pdfRedirects, apiOrigin, phpApi, langs })  → texto del .htaccess de la raíz

Secciones: `[HOSTING]`

- `rx` (l. 10) — Escapa un texto para usarlo literal dentro de una expresión regular de Apache.
- `basePathOf` (l. 13) — ruta base del sitio: «https://x.com/prueba/» → «/prueba» («» si está en la raíz del dominio)
- `htaccess` (l. 16) — Genera el .htaccess de la raíz: HTTPS, host único, 301 de URLs antiguas, caché, cabeceras de seguridad (CSP), noindex en pruebas y reescritura de /api.
- `langHtaccess` (l. 59) — .htaccess de /en, /fr, /de: solo cambia la página 404 para que se muestre en el idioma de la sección
- `robotsTxt` (l. 62) — Genera robots.txt: en pruebas prohíbe todo; en producción permite el sitio, cierra /admin/ y /api/ y enlaza el sitemap.

### `i18n.mjs`

[I18N] Textos de interfaz del demo en los 4 idiomas. Solo textos NUEVOS de la experiencia de pedido (presupuesto, filtros, formulario…): el contenido del sitio viene tal cual de la web original. Cada clave existe en es/en/fr/de. El idioma por defecto del sitio es 'es' (raíz); en/fr/de viven bajo /en /fr /de.

Secciones: `[I18N]`

- `countLabel` (l. 108) — «1 producto / 2 productos» en los 4 idiomas
- `refLabel` (l. 110) — «1 referencia / 2 referencias» en los 4 idiomas.
- `t` (l. 112) — Texto de interfaz de la clave `key` en el idioma `lang` (español si falta; la propia clave si no existe).

### `render.mjs`

[RENDER] Utilidades del generador: escape, rutas relativas, enlaces internos, bloques semánticos → HTML. RUTAS: el demo se puede abrir con doble clic (file://). Por eso todos los enlaces internos son RELATIVOS y terminan en index.html. Las URLs lógicas (las mismas que la web original: /product/x/, /en/…) se conservan como estructura

Secciones: `[RENDER]`

- `esc` (l. 11) — Escapa &, <, > y comillas dobles para insertar texto en HTML o en atributos.
- `dirOf` (l. 15) — ruta lógica de página ('/en/product/x/') → carpeta de salida relativa a dist ('en/product/x')
- `setCleanUrls` (l. 20) — Activa (producción) o desactiva (demo con file://) las URLs sin index.html que genera rel().
- `rel` (l. 22) — URL relativa desde la página `from` hasta la página lógica `to` (+hash opcional).
- `asset` (l. 28) — URL relativa a un asset ('assets/css/x.css') desde la página `from`.
- `mapLink` (l. 43) — Reescribe un enlace de la web original a su equivalente local (página, PDF) o lo deja absoluto.
- `inlineHtml` (l. 62) — HTML inline de un bloque (los enlaces internos se reescriben).
- `tbl` (l. 71) — Bloque de tabla → HTML: detecta la cabecera, usa una primera fila de una sola celda como título y añade región con scroll.
- `cell` (l. 76) — Celda th/td con el texto escapado; las th dentro del cuerpo llevan scope="row".
- `blocksHtml` (l. 85) — Bloques semánticos → HTML. opts.demote: sube el nivel de los encabezados (h1→h2…) para que la plantilla sea dueña del h1.
- `plain` (l. 123) — Texto plano de una lista de bloques (encabezados, párrafos sin etiquetas y listas), con los espacios normalizados.
- `fmtDate` (l. 126) — Fecha ISO → fecha larga localizada según el idioma (p. ej. «12 de marzo de 2024»).
- `writeFile` (l. 129) — Escribe `content` en root/p creando las carpetas intermedias que falten.

### `seo.mjs`

[SEO] Datos estructurados JSON-LD (@graph) y metaetiquetas sociales. Solo con --base (necesitan URLs absolutas). Regla de oro: únicamente datos que existen en la web original / el catálogo (sin precios inventados, sin reseñas, sin valoraciones). Tipos: Organization (con logo, dirección, teléfono, correo, idiomas) · WebSite · WebPage/CollectionPage/ContactPage/AboutPage ·

Secciones: `[SEO]`

- `ogLocale` (l. 11) — Código de locale de Open Graph (es_ES, en_GB, fr_FR, de_DE) del idioma; es_ES si no se reconoce.
- `clip` (l. 14) — Recorta un texto a `max` caracteres sin partir palabras.
- `productNode` (l. 22) — Nodo Product de una ficha. `images`: URLs absolutas.
- `itemListNode` (l. 32) — ItemList de un listado (productos de una categoría / todas las fichas).
- `postNode` (l. 36) — BlogPosting de una entrada.
- `pageGraph` (l. 48) — Grafo completo de una página.
- `ldScript` (l. 75) — <script type="application/ld+json"> seguro para incrustar (escapa < y el separador U+2028/2029).

## `site/assets/js/`

### `admin-live.js`

[ADMIN-LIVE] Panel de gestión de Torivac CONECTADO AL WORKER (producción). Mismo aspecto que el demo (admin.css), datos y acciones reales. Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Usuarios · Estadísticas · Ajustes cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas

Secciones: `[ADMIN-LIVE]` · `[HTTP]` · `[AUTH]` · `[UTIL]` · `[VIEWS]` · `[PRICES]` · `[AI]` · `[USERS]` · `[PROPOSALS]` · `[ROUTER]`

- `esc` (l. 17) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `money` (l. 19) — Importe formateado con la divisa y el idioma de la página (Q.money); un valor vacío cuenta como 0.
- `http` (l. 23) — method + ruta + cuerpo → Promise<{ok, status, …}>. Un 401 cierra la sesión (token caducado). Nunca rechaza: los errores de red vuelven como {ok:false}.
- `session` (l. 32) — Sesión actual {token, email, name, role} o null. El rol del servidor ('client') se muestra como 'cliente'.
- `login` (l. 34) — Entra con correo y contraseña. Devuelve Promise<string|null>: null si ha ido bien, o el mensaje de error.
- `logout` (l. 42) — Cierra la sesión y vuelve a la pantalla de acceso.
- `toast` (l. 46) — Muestra un aviso breve (3,2 s) en pantalla.
- `kpi` (l. 48) — HTML de una tarjeta KPI con la etiqueta `l` y el valor `v`, ambos escapados.
- `itemName` (l. 50) — Nombre legible de una referencia (nombre ES + ref si es un modelo concreto).
- `when` (l. 52) — Fecha y hora local (es-ES) de una fecha ISO; «—» si viene vacía.
- `download` (l. 54) — Descarga `blob` como archivo `name` con un enlace temporal y libera la URL a los 800 ms.
- `fail` (l. 56) — Aviso de error del servidor con el mensaje devuelto.
- `V.resumen` (l. 67) — Vista Resumen (manager): con datos del Worker, KPIs, estado de la hoja de precios y sincronización, y los 5 últimos pedidos.
- `ordersView` (l. 79) — Tabla de pedidos (manager: todos · cliente: solo los suyos, lo filtra el servidor).
- `V.pedidos` (l. 88) — Vista Pedidos (manager): tabla de todos los pedidos que devuelve el Worker.
- `V.mis` (l. 90) — Vista «Mis presupuestos» (cliente): sus propios pedidos; el filtro por usuario lo aplica el servidor.
- `V.lista` (l. 93) — Vista Lista de precios (cliente): precios vigentes del Worker, sin IVA, con sus tramos (hasta 600 referencias).
- `V.presupuestador` (l. 102) — Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1.
- `V.contenido` (l. 105) — Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto.
- `cell` (l. 108) — Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir).
- `V.estadisticas` (l. 114) — Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras.
- `V.ajustes` (l. 120) — Vista Ajustes (manager): datos de la sesión (GET /api/auth/me), dónde se configuran los destinatarios del pedido y, con el API PHP, su autodiagnóstico (GET /api/diag).
- `V.precios` (l. 132) — Vista Precios (manager): estado y sincronización de la hoja, subida de Excel/CSV con vista previa e instrucción a la IA.
- `previewUpload` (l. 143) — Filas (cabecera + datos) → vista previa de diferencias contra los precios vigentes (el servidor calcula la diferencia; no se aplica nada).
- `list` (l. 149) — Filas HTML (máx. 60) de las referencias `arr`, cada una con su producto y la etiqueta `kind`.
- `readUpload` (l. 157) — Lee el archivo subido (Excel o CSV) en el navegador y pide la vista previa.
- `go` (l. 160) — Pide la vista previa de las filas leídas, etiquetándola con el nombre del archivo.
- `applyUpload` (l. 165) — Publica la hoja subida (POST /api/prices/upload, con `force` si se marcó la casilla) y repinta; sin borrador no hace nada.
- `runPrompt` (l. 174) — Envía la instrucción a la IA (POST /api/prices/ai) y muestra la propuesta de cambios para confirmarla; no aplica nada.
- `applyProposal` (l. 190) — Aplica la propuesta vigente de la IA (POST /api/prices/ai/apply, confirmando los cambios grandes si se marcó) y repinta.
- `V.propuestas` (l. 199) — Vista Propuestas (manager): lista las propuestas de cambio con su estado en el servidor para aprobar, rechazar o deshacer.
- `V.usuarios` (l. 214) — Vista «Usuarios» (manager): lista de usuarios con alta y baja de managers y clientes.
- `onClick` (l. 224) — Manejador único de clics del panel (delegación de eventos): salir, sincronizar precios, aplicar o descartar cambios, propuestas, usuarios y PDF.
- `bind` (l. 242) — Eventos de la vista Precios (subida por arrastre) y del formulario de usuarios; se enlazan tras pintar cada vista.
- `render` (l. 259) — Pinta la pantalla de acceso o el panel (menú lateral + la vista de la ruta #hash); `renderSeq` descarta la respuesta de una vista si entretanto se pidió otra.

### `admin-report.js`

[ADMIN-REPORT] Informe de lectura de una hoja de precios para la vista previa del panel: columnas reconocidas, avisos, referencias nuevas y filas que no se publican. Lo comparten admin.js (demo, en el navegador) y admin-live.js (real, el informe viene del servidor). Sin dependencias. TV.priceReportHtml(report, esc) → HTML ('' si no hay informe)

Secciones: `[ADMIN-REPORT]`

- `TV.priceReportHtml` (l. 13) — HTML del informe de lectura de la hoja (columnas, avisos y listas plegables); `esc` escapa el texto; '' sin informe.
- `list` (l. 20) — Bloque <details> con `title` y hasta 40 elementos formateados con `fmt` (añade «…» si hay más); '' si la lista está vacía.

### `admin.js`

[ADMIN] Panel de gestión de Torivac (DEMO sin servidor): login con dos roles, menú lateral y vistas. Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Estadísticas · Ajustes cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas

Secciones: `[ADMIN]` · `[AUTH]` · `[UTIL]` · `[VIEWS]` · `[PRICES]` · `[PROMPT]` · `[ROUTER]`

- `esc` (l. 18) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `money` (l. 20) — Importe formateado con la divisa y el idioma de la página (Q.money); un valor vacío cuenta como 0.
- `session` (l. 29) — Sesión demo guardada en sessionStorage {email, role, name}; null si no hay sesión o está dañada.
- `login` (l. 31) — Comprueba correo y contraseña contra los usuarios de la demo; si coinciden guarda la sesión y devuelve el usuario, si no null.
- `logout` (l. 33) — Cierra la sesión demo, vacía la ruta (#hash) y repinta la pantalla de acceso.
- `norm` (l. 37) — Normaliza un texto para comparar: minúsculas, sin acentos ni signos y con espacios simples.
- `stem` (l. 39) — Raíz tosca de una palabra: quita «es» o «s» finales si tiene más de 4 letras, para comparar singular y plural.
- `csvParse` (l. 41) — Delega en TV.csvParse (lector CSV de quote.js): texto → filas de celdas.
- `pnum` (l. 43) — Convierte texto a número con las mismas reglas que el servidor («3,5», «1.234,56», «1,234.5», «€ 5»); null si está vacío o no es numérico.
- `rowsToPrices` (l. 46) — Hoja → precios con las MISMAS reglas que el servidor (TV.PriceSheet = shared/price-sheet.mjs): cabeceras tolerantes, SKU, referencias nuevas por regla, avisos.
- `diffPrices` (l. 53) — Compara la hoja vigente `a` con la nueva `b`: {added, changed, removed} como [ref, antes, después] y same = nº sin cambios.
- `itemName` (l. 60) — Nombre en español de la referencia (con el código si es un modelo concreto); sin ficha devuelve la propia referencia.
- `toast` (l. 62) — Muestra el aviso flotante #toast con el mensaje `m` durante 2,6 s.
- `download` (l. 64) — Descarga `blob` como archivo `name` con un enlace temporal y libera la URL a los 800 ms.
- `orders` (l. 66) — Pedidos de la demo guardados en localStorage (tv_orders); [] si no hay.
- `V.resumen` (l. 76) — Vista Resumen (manager): KPIs de pedidos, mensajes y propuestas, estado de la hoja de precios y las 5 referencias más pedidas.
- `kpi` (l. 88) — HTML de una tarjeta KPI con la etiqueta `l` y el valor `v`, ambos escapados.
- `V.pedidos` (l. 91) — Vista Pedidos (manager): tabla de los pedidos de la demo, los más recientes primero, con PDF por pedido, exportar y borrar.
- `V.mis` (l. 98) — Vista «Mis presupuestos» (cliente): la tabla de Pedidos con otro título.
- `V.precios` (l. 101) — Vista Precios (manager): estado de la hoja, actualizar o restaurar, subida de Excel/CSV e instrucción en castellano.
- `V.lista` (l. 110) — Vista Lista de precios (cliente): precios unitarios y tramos de las primeras 400 referencias con precio.
- `V.propuestas` (l. 116) — Vista Propuestas (manager): diferencias entre la web y los PDFs para aprobar o rechazar una a una (estado en localStorage).
- `V.contenido` (l. 127) — Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto.
- `cell` (l. 130) — Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir).
- `V.estadisticas` (l. 136) — Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras.
- `V.ajustes` (l. 143) — Vista Ajustes (manager): destinatarios del pedido y usuarios de la demo.
- `V.presupuestador` (l. 149) — Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1.
- `showDraft` (l. 156) — Guarda `next` como borrador y pinta su vista previa contra los precios vigentes, con el informe `report` y Aplicar/Descartar.
- `rowsOf` (l. 159) — Filas HTML (máx. 60) de las diferencias `arr` [ref, antes, después], con la etiqueta `kind`.
- `applyDraft` (l. 166) — Aplica el borrador de precios: lo guarda como hoja del panel (tv_prices_override), actualiza la web, avisa y repinta.
- `readUpload` (l. 168) — Lee la hoja subida (Excel con SheetJS o CSV) y muestra su vista previa como borrador de precios.
- `go` (l. 171) — Convierte las filas leídas en un borrador de precios y lo muestra; si la hoja no se puede leer, avisa con el error.
- `itemHaystack` (l. 178) — Texto en el que se busca una referencia: su nombre, su categoría y su código, normalizado.
- `targetMatches` (l. 180) — ¿Encaja `ref` con el objetivo? Vacío o «todo» sí; si no, cada palabra del objetivo debe estar en su nombre, categoría o código.
- `parsePrompt` (l. 185) — Traduce la instrucción en castellano a reglas {op: pct|abs|round|unknown, val, dec, target}; lo ininteligible va como unknown.
- `runPrompt` (l. 198) — Aplica la instrucción a una copia de los precios y muestra la vista previa; avisa de los fragmentos que no entiende.
- `f` (l. 208) — Aplica la regla `r` a un precio `v`: porcentaje, suma o resta fija, o redondeo; otra operación lo deja igual.
- `bind` (l. 219) — Conecta los eventos de la vista recién pintada (zona de arrastre del Excel/CSV, botones y formularios).
- `onClick` (l. 224) — Gestor único de clics del panel (delegado en #admin-root): salir, precios, instrucción, borrador, propuestas, PDF y pedidos.
- `render` (l. 238) — Pinta la pantalla de acceso (sin sesión) o el panel con menú lateral y la vista de la ruta #hash según el rol.

### `app.js`

[APP] Comportamiento común a todas las páginas. Secciones: [UTIL] · [MENU] menú móvil · [DRAWER] cajón del presupuesto · [FAB] botones flotantes · [LANG] idioma (detección + selector manual) · [PRICE-STAMP] Depende de: quote.js (TV.Quote). Sin librerías.

Secciones: `[APP]` · `[UTIL]` · `[MENU]` · `[DRAWER]` · `[FAB]` · `[LANG]` · `[PRICE-STAMP]` · `[EMBED]` · `[TREE]` · `[ART]`

- `$` (l. 10) — Primer elemento que cumple el selector `s` dentro de `r` (por defecto, el documento); null si no hay ninguno.
- `$$` (l. 12) — Todos los elementos que cumplen el selector `s` dentro de `r`, como array de verdad (no NodeList).
- `esc` (l. 14) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `TV.toast` (l. 19) — Muestra `msg` durante 2,6 s en el aviso flotante de la página (no hace nada si la página no lo incluye).
- `thumbSrc` (l. 22) — URL de la imagen del producto `ref` relativa a la página actual, o '' si no tiene imagen.
- `openDrawer` (l. 49) — Abre el cajón del presupuesto: guarda el foco previo, muestra cajón y velo, pinta las líneas y enfoca el botón de cerrar.
- `closeDrawer` (l. 51) — Cierra el cajón del presupuesto y el velo, y devuelve el foco al elemento que lo abrió.
- `renderDrawer` (l. 59) — Pinta el cajón: líneas con miniatura, cantidades y total, o el aviso de presupuesto vacío con enlace a la página.
- `refreshCounts` (l. 92) — Actualiza los contadores [data-quote-count] con el total de unidades del presupuesto.
- `store` (l. 109) — Lee la clave `k` de localStorage (sin `v`) o la guarda (con `v`); si el almacenamiento falla, devuelve null.
- `browserLang` (l. 111) — Primer idioma preferido del navegador que exista en la web (es, en, fr, de); null si ninguno.
- `offer` (l. 127) — Muestra el aviso para cambiar al idioma `target` (en ese idioma): «cambiar» fija la elección y «mantener» conserva la actual.
- `stamp` (l. 140) — Pinta la marca «DEMO» (solo con precios de demostración) y la fecha de los precios.

### `contact.js`

[CONTACT] Formularios de contacto (página Contacto y bloque de la home). Con TV.meta.api (producción): POST /api/contact al Worker (workers/api: honeypot, límite por IP, Turnstile opcional, Resend). Sin API (DEMO): no se envía nada; se valida, se guarda el mensaje en localStorage (tv_messages) y se muestra un borrador mailto:.

Secciones: `[CONTACT]`

### `lab.js`

[LAB] Osciloscopio esquemático de un variador de tensión (categoría «Variadores de tensión»). Dos ondas sinusoidales: la de ENTRADA (230 V, fija, discontinua) y la de SALIDA (cobre) cuya amplitud sigue al mando (0–230 V). Es una ilustración: no mide nada ni promete prestaciones. Respeta prefers-reduced-motion (onda quieta) y funciona con teclado (input range).

Secciones: `[LAB]` · `[WAVE]` · `[UI]` · `[LOOP]`

- `path` (l. 16) — Trazado SVG (atributo d) de una senoide de amplitud `amp` y fase `phase`: 3 ciclos a lo ancho de 640 unidades.
- `draw` (l. 29) — Repinta las dos ondas: la de entrada con amplitud fija y la de salida escalada por la tensión mostrada (0–230 V).
- `tick` (l. 44) — Un fotograma de la animación: avanza la fase, acerca la tensión mostrada al mando, repinta y pide otro si la sección es visible.

### `pdf.js`

[PDF] Generador del PDF de presupuesto en el navegador (jsPDF + autoTable, ambos locales en assets/vendor). API: TV.makeQuotePdf({ customer, number }) → { doc, blob, filename } Contenido: banda de marca, nº y fecha, datos del cliente, tabla con IMAGEN REFERENCIAL por línea, total, notas, aviso legal y marca DEMO si procede.

Secciones: `[PDF]`

- `TV.makeQuotePdf` (l. 13) — Genera el PDF del presupuesto con jsPDF; `opts` = {customer, number, detail, date}; devuelve {doc, number, filename, blob()}.
- `didDrawCell` (l. 52) — Gancho de autoTable: tras pintar cada celda de la columna «Imagen» estampa la miniatura JPEG de su línea, si existe.

### `quote-page.js`

[QUOTE-PAGE] Página completa del presupuesto: tabla editable, importación CSV/Excel, PDF y envío (simulado en demo). Secciones: [TABLE] · [IMPORT] · [PDF] · [SEND] · [REFRESH] Depende de: quote.js, app.js, pdf.js, SheetJS (window.XLSX) para .xlsx/.xls.

Secciones: `[QUOTE-PAGE]` · `[TABLE]` · `[IMPORT]` · `[PDF]` · `[SEND]` · `[REFRESH]` · `[SEND-LIVE]` · `[SEND-DEMO]`

- `render` (l. 14) — Pinta la tabla del presupuesto (imagen, línea, cantidad editable, precio y total) o el aviso de presupuesto vacío.
- `handleRows` (l. 46) — Importa filas de CSV/Excel: detecta las columnas de referencia y cantidad (o usa la 1.ª y 2.ª) y avisa de las desconocidas.
- `parseCsv` (l. 58) — Convierte texto CSV en filas de celdas con el lector compartido TV.csvParse (quote.js).
- `readFile` (l. 60) — Lee el archivo elegido o soltado (Excel con SheetJS, primera hoja, o CSV como texto) y pasa sus filas a handleRows.
- `customer` (l. 75) — Datos del formulario del presupuesto como objeto {campo: valor}, sin el campo honeypot `hp` (antispam).
- `download` (l. 77) — Descarga el PDF `res` ({blob(), filename}) con un enlace temporal y libera la URL del blob a los 800 ms.
- `sendLive` (l. 99) — Envía el pedido al servidor (POST /api/order) con el PDF adjunto; los precios y totales los fija el servidor.
- `sendDemo` (l. 117) — Demo sin servidor: descarga el PDF, guarda el pedido en localStorage y ofrece un borrador de correo (mailto:).

### `quote.js`

[QUOTE-ENGINE] Motor del presupuesto/pedido de Torivac. Sin dependencias. Funciona con file:// (los datos llegan como variables globales: TV.items, TV.prices, TV.i18n). Secciones:  [STATE] estado persistente · [FORMAT] formato de importes · [PRICES] precios y tramos · [API] TorivacQuote · [REFRESH] actualización manual de precios

Secciones: `[QUOTE-ENGINE]` · `[STATE]` · `[FORMAT]` · `[PRICES]` · `[API]` · `[REFRESH]` · `[OVERRIDE]` · `[CSV]` · `[LIVE]`

- `applyOverride` (l. 21) — En producción la hoja de Drive manda (Worker + cron 24 h); aquí `tv_prices_override` hace de "hoja viva" para poder probar el flujo Excel → web.
- `mergeSheetItems` (l. 26) — La hoja de precios puede traer referencias nuevas dentro de un producto (prices.items[ref] = {p, n, pid}): se suman a TV.items para poder presupuestarlas (x:1 = viene de la hoja).
- `clean` (l. 45) — Filtra las líneas guardadas: conserva solo las {ref, qty > 0} válidas; si `r` no es un array devuelve [].
- `load` (l. 47) — Carga las líneas del presupuesto de localStorage; con file:// manda la copia de window.name si es más reciente.
- `save` (l. 54) — Guarda las líneas y su marca de tiempo en localStorage (si falla, quedan en memoria) y, con file://, una copia en window.name.
- `emit` (l. 60) — Guarda el presupuesto y avisa del cambio `detail` a los oyentes registrados y con el evento tv:quote del documento.
- `buildFormats` (l. 69) — Crea los formateadores de moneda (importes a 2 decimales, precios unitarios de 2 a 4) con la divisa de los precios o EUR.
- `money` (l. 76) — Formatea un importe (2 decimales) en la divisa y el idioma de la página.
- `unitMoney` (l. 78) — Formatea un precio unitario (de 2 a 4 decimales) en la divisa y el idioma de la página.
- `t` (l. 80) — Texto de interfaz `key` en el idioma de la página (TV.i18n); si no existe devuelve la propia clave.
- `rel` (l. 82) — ruta relativa a una página lógica (/en/product/x/) desde la página actual
- `assetUrl` (l. 87) — Ruta relativa al archivo `a` del sitio desde la página actual (antepone tantos «../» como niveles indica data-path).
- `priceOf` (l. 91) — precio unitario aplicable a `qty` unidades de `ref` (null = sin precio → "consultar")
- `tiersOf` (l. 99) — Tramos de precio por cantidad de `ref` como [[cantMin, precio], …]; [] si no tiene.
- `round2` (l. 101) — Redondea a 2 decimales compensando el error de coma flotante.
- `qtyOf` (l. 104) — Cantidad de una celda CSV/Excel: entero ≥ 0; «1.000» y «1,000» son mil (millares), «12,0» es doce; 0 si no se entiende.
- `lines` (l. 114) — Copia de las líneas del presupuesto [{ref, qty}]; modificarla no altera el estado.
- `count` (l. 116) — Total de unidades del presupuesto (suma de las cantidades de todas las líneas).
- `kinds` (l. 118) — Número de referencias distintas (líneas) del presupuesto.
- `has` (l. 120) — Indica si el presupuesto ya tiene una línea con la referencia `ref`.
- `add` (l. 122) — Suma `qty` unidades de `ref` (crea la línea si falta); false si la referencia no existe o la cantidad no es válida.
- `set` (l. 129) — Fija la cantidad de `ref`: 0 elimina la línea y, si la línea no existía, equivale a añadirla.
- `remove` (l. 137) — Elimina la línea de `ref` (fija su cantidad a 0).
- `clear` (l. 139) — Vacía el presupuesto y avisa del cambio.
- `detail` (l. 141) — líneas detalladas + total (solo suma las que tienen precio)
- `onChange` (l. 152) — Registra `fn(detail)` para que se llame en cada cambio del presupuesto o de los precios.
- `applyOverride` (l. 154) — Reaplica los precios cargados desde el panel, rehace los formatos y avisa a la página (evento tv:prices y cambio «prices»).
- `label` (l. 157) — nombre de línea listo para mostrar
- `shownRef` (l. 159) — referencia visible (las líneas genéricas P#### no se muestran como referencia)
- `importRows` (l. 161) — importa filas {ref, qty}: devuelve {added, unknown[]}
- `base` (l. 177) — URL base del Worker de la API (TV.meta.api) sin barras finales; cadena vacía si no hay API.
- `live` (l. 179) — Indica si hay API de producción configurada (false = modo demo, con el envío simulado).
- `post` (l. 181) — POST JSON a `path` de la API; devuelve siempre una Promise con la respuesta y su `status` (los fallos vuelven como {ok:false}).
- `TV.loadLivePrices` (l. 190) — El snapshot de la compilación (assets/data/prices.js) es solo el respaldo: con TV.meta.api manda lo que devuelva GET /api/prices (hoja de Drive, cada 24 h o al pulsar «actualizar»).
- `TV.csvParse` (l. 201) — Lector CSV (RFC 4180): texto → filas de celdas; detecta el separador , o ; en la 1.ª línea, admite comillas y quita el BOM.
- `TV.refreshPrices` (l. 219) — Recarga los precios a mano: del servidor si hay API; en la demo, volviendo a cargar assets/data/prices.js.
- `n.onload` (l. 226) — Al cargar el script de precios recién pedido: reaplica el override, rehace formatos, avisa del cambio y resuelve con true.
- `n.onerror` (l. 228) — Si falla la carga del script de precios, resuelve la promesa con false.

### `shop.js`

[SHOP] Listados (filtros por tensión y búsqueda) y fichas de producto (tabla de modelos con cantidades, galería). Secciones: [FILTERS] filtros del listado · [MODELS] tabla de modelos · [EXTRAS] referencias que añade la hoja de precios · [GALLERY] galería · [PRICES] precios en las filas Depende de: quote.js, app.js (TV.$, TV.$$, TV.toast).

Secciones: `[SHOP]` · `[FILTERS]` · `[MODELS]` · `[EXTRAS]` · `[GALLERY]` · `[PRICES]`

- `apply` (l. 16) — Aplica los filtros (tensiones marcadas y texto): oculta las fichas que no encajan y actualiza el contador y el aviso de vacío.
- `qtyOf` (l. 38) — Cantidad entera ≥ 0 escrita en la fila `tr` (0 si el campo está vacío o no es un número).
- `bindRow` (l. 40) — Conecta una fila de modelos (−, +, cantidad y «añadir») con el presupuesto y la registra para refrescar su precio.
- `extraRow` (l. 58) — HTML de la fila de una referencia que añade la hoja de precios: código, descripción, celda de precio, cantidad y botón añadir.
- `renderExtras` (l. 65) — Pinta (o repinta) tras la tabla de modelos las referencias que la hoja de precios añade a ESTE producto, con su filtro.
- `updatePrice` (l. 85) — Actualiza el precio unitario, los tramos y el importe de una fila de la tabla de modelos según la cantidad escrita.
- `allPrices` (l. 94) — Actualiza el precio de todas las filas y muestra u oculta el aviso de demo según el modo de la hoja de precios.
- `refresh` (l. 96) — Rehace las referencias extra y los precios de las filas; corre al cargar y en cada evento tv:prices.

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

- `jl` (l. 38) — JSON de un fichero, o `default` si no existe o no es válido.
- `pth` (l. 46) — ruta absoluta con barra final: https://x/en/a/ -> /en/a/
- `lang_of_path` (l. 52) — Idioma de una ruta lógica: en, fr o de si empieza por ese prefijo; es en cualquier otro caso.
- `text_of` (l. 58) — Texto plano de una lista de bloques semánticos (encabezados, párrafos, listas y tablas), con los espacios normalizados.
- `fetch` (l. 69) — Descarga la URL a la caché en disco `dst` (si ya existe, la lee) y devuelve el texto; cadena vacía si falla.
- `clean_alt` (l. 82) — alt de imagen: se decodifican entidades; si parece un nombre de fichero (sin espacios) se descarta y la plantilla usa el nombre del producto
- `size_base` (l. 92) — URL de imagen sin parámetros ni sufijo de tamaño de WordPress (-300x200): la de la imagen original.
- `img_ref` (l. 97) — URL original -> {file, thumb, w, h} local. Si no existe copia local, se conserva la URL remota (y se anota).
- `localize_blocks` (l. 108) — Sustituye en los bloques de imagen la URL original por su copia local (img_ref); devuelve la misma lista.
- `_expected_stem` (l. 124) — Nombre de fichero (sin extensión) que le corresponde a una ruta: /en/a/ → en__a, y / → home.
- `_real_path` (l. 129) — Ruta real de la página. Normalmente la canónica; pero la home EN declara canónica /de/ (error de la web original), así que en las homes manda el fichero.
- `_best_per_path` (l. 139) — Varias páginas pueden compartir URL canónica. Gana la cuyo fichero coincide con la ruta; si no, la de más texto. Se excluyen plantillas internas (elementor-hf).
- `alt_of` (l. 168) — ruta equivalente en otro idioma por hreflang
- `cooccurrence` (l. 181) — ES cat id → {cat id en idioma: peso}, por los productos traducidos que comparten (se desempata luego por coherencia de padres)
- `build_categories` (l. 202) — Registros de categorías con sus traducciones: por hreflang, luego por WPML (si respeta el árbol) y por productos coincidentes.
- `blocks_pdfs` (l. 272) — Botones de descarga de PDF (bloques btn con pdf) de una lista de bloques.
- `build_products` (l. 277) — Registros de productos (ES y traducciones): bloques de texto, imágenes con alt, estado de traducción, PDFs y relacionados.
- `section_backgrounds` (l. 358) — mapa data-id de sección -> imagen de fondo, leyendo el CSS post-<id>.css de Elementor
- `page_blocks` (l. 367) — Devuelve dict con secciones del contenido principal (Elementor) convertidas a bloques, sin plantillas globales.
- `services_cards` (l. 392) — tarjetas de categorías de la home: enlaces a categoria-producto con título e icono
- `build_pages` (l. 408) — Páginas, home y entradas del blog por idioma ({idioma: {ruta: registro}}), con secciones en bloques y datos de REST.
- `build_site` (l. 463) — Devuelve (nav, foot): menú de cabecera y datos del pie por idioma, leídos de la home original.
- `main` (l. 482) — Construye categorías, productos, páginas y datos del sitio, y los escribe en data/catalog (JSON) con un resumen por consola.

### `build_prices.py`

Sesión 6 · Hoja de precios → data/catalog/prices.json (y generación de la hoja DEMO).    python3 -I scripts/build_prices.py              # usa data/catalog/prices.csv|xlsx si existe; si no, genera la hoja DEMO

- `seed` (l. 32) — Semilla numérica estable (8 primeros hex del SHA-1 de la referencia) para los precios DEMO deterministas.
- `num` (l. 37) — Número (float) de un valor escrito como «27,75», «27.75», «1.234,56» o «1,234.56» (el último separador es el decimal); None si está vacío o no es un número.
- `first_number` (l. 59) — Primer número (con coma o punto decimal) que aparece en un texto, como float; None si no hay ninguno.
- `lines_of_catalog` (l. 65) — todas las líneas pedibles: variantes reales o la línea genérica P<id>
- `demo_price` (l. 76) — precio DEMO determinista: función suave de la potencia (VA/W) + variación de céntimos por referencia. Nunca es una tarifa real.
- `write_demo_sheet` (l. 102) — Genera la hoja DEMO (prices.demo.csv y, si hay openpyxl, prices.demo.xlsx) con un precio por línea pedible; devuelve las filas.
- `read_sheet` (l. 140) — Lee una hoja de precios .xlsx/.xls (primera hoja) o .csv (separador , o ;) como lista de filas {columna en minúsculas: valor}.
- `build` (l. 154) — Filas de la hoja → contenido de prices.json (updated_at, source, currency, mode, items); omite filas inactivas o sin precio.
- `main` (l. 175) — Genera prices.json desde la hoja indicada (--src), la de data/catalog o, si no hay ninguna (o con --demo), la hoja DEMO.

### `check_pdf_extract.py`

Comprobador determinista de data/analysis/pdfs/<trabajo>.json (Sesión 1).    python3 -I scripts/check_pdf_extract.py data/analysis/pdfs/p01-catalogo-es.json [--json]

- `toks` (l. 24) — Conjunto de números que aparecen en un texto, normalizados (coma decimal → punto, sin punto final).
- `walk` (l. 29) — Recorre en profundidad dicts y listas y genera todas las cadenas que contienen.
- `page_text` (l. 41) — Texto extraído de la página `p` del PDF `stem` (data/analysis/pdf-text); cadena vacía si no existe.
- `main` (l. 47) — Contrasta los números del JSON de extracción con el texto de cada página (precisión y recall); 1 si hay números sin respaldo.
- `put` (l. 61) — Añade `obj` a lo extraído de la página `page` (en el cubo `bucket`).

### `contrast_pdfs.py`

Sesión 11 · Contraste del catálogo Torivac 2024 en español frente al inglés (mismos 41 folios), determinista.    python3 -I scripts/contrast_pdfs.py            # escribe data/analysis/pdfs/contrast-es-en.json y data/analysis/pdf-contrast-proposals-raw.json

- `numbers` (l. 26) — lista de números de un valor (coma o punto decimal); None/vacío → []
- `load` (l. 31) — familias de los PDF indicados: [{family, page, models:{refkey:model}, refs}]
- `pair_families` (l. 43) — empareja familias ES↔EN por solape de claves de modelo, respetando el orden del documento (las secciones BO/Tapas/Aros comparten claves)
- `compare` (l. 65) — divergencias entre dos familias emparejadas
- `main` (l. 88) — Compara los catálogos ES y EN; escribe contrast-es-en.json y, como propuestas, las divergencias aún sin resolver.

### `enrich_catalog.py`

Sesión 2/11 · Enriquece el catálogo con lo que sale de los PDFs verificados (determinista, sin IA).    python3 -I scripts/enrich_catalog.py            # lee products.base.json → escribe products.json, proposals.json, voltage-tags.json

Secciones: `[UTIL]` · `[REFS]` · `[IDS]`

- `jl` (l. 35) — JSON de un fichero, o `d` si no existe / no es válido
- `to_num` (l. 43) — primer número de un texto (coma o punto decimal)
- `unit_of` (l. 49) — unidad: la de la cabecera «(mm)» o la que sigue al número
- `norm_spec` (l. 58) — valor de especificación → {raw, value, unit}
- `classify` (l. 70) — ('code', 'TT0020210') si el PDF imprime un código de fabricante; ('model', '160 VA') si solo identifica el modelo por potencia/número; (None, None) si no es utilizable
- `slug` (l. 83) — etiqueta de modelo → trozo de clave: «160 VA» → 160VA
- `pid_of` (l. 89) — Id estable `PR-nnnnn` de una propuesta, derivado del hash de su identidad; si ya está en `taken`, toma otro libre.
- `main` (l. 98) — Parte de products.base.json y añade variantes, tensiones y potencia (PDF verificados); escribe products, voltage-tags y proposals.
- `prop` (l. 117) — Añade a `extra_prop` una propuesta para el panel (tipo, producto, título, valor web/PDF, recomendación, severidad, evidencia).
- `add` (l. 217) — Anota la etiqueta de tensión `tag` en el producto actual (sin repetirla) con su evidencia: origen y motivo.

### `fetch_images.py`

Sesión 3 · Imágenes en local para el demo (solo GET sobre la web original, nunca se modifica nada allí).    python3 -I scripts/fetch_images.py

- `norm` (l. 35) — URL absoluta de una referencia a imagen, sin ancla; None si está vacía o es un data: URI.
- `collect` (l. 43) — Reúne las URLs de imágenes de la web original y los CSS de Elementor; devuelve ({url: orígenes}, lista de CSS).
- `add` (l. 46) — Registra la URL `u` con su origen `src` si es una imagen (jpg, png, webp, gif, svg) alojada en grupotorivac.com.
- `get` (l. 85) — Descarga `url` con reintentos y devuelve bytes (o texto si `binary` es False); relanza el último error si todos fallan.
- `css_images` (l. 98) — Descarga en paralelo los CSS de Elementor y devuelve {URL de imagen de fondo: orígenes} de grupotorivac.com.
- `one` (l. 101) — Descarga el CSS `u` y devuelve (`u`, URLs absolutas de sus url(...)); lista vacía si la descarga falla.
- `process` (l. 116) — Descarga una imagen y genera su WebP (máx. 1200 px) y miniatura (480 px) en site/assets/media; SVG tal cual. Devuelve su registro.

### `gen_code_index.py`

Sesión 15 · Índice de código para programadores: archivo → propósito → secciones [ETIQUETA] → funciones y qué hace cada una.    python3 -I scripts/gen_code_index.py            # escribe docs/INDICE-CODIGO.md y muestra la cobertura

- `header_of` (l. 35) — Primer comentario del archivo (la «cabecera»).
- `comment_above` (l. 57) — Comentario inmediatamente encima de la línea idx (o al final de esa línea).
- `scan_js` (l. 71) — Lee un archivo JS/MJS: cabecera, etiquetas [SECCIÓN] y funciones con el comentario que llevan encima.
- `scan_php` (l. 87) — PHP: la cabecera es el primer docblock tras `<?php`; cada método/función lleva encima un docblock o un comentario `//`.
- `scan_py` (l. 103) — Lee un archivo Python: cabecera, etiquetas [SECCIÓN] y funciones con su docstring o comentario.
- `scan_css` (l. 129) — Lee un archivo CSS: comentario de cabecera y etiquetas [SECCIÓN].
- `main` (l. 142) — Recorre los archivos, escribe docs/INDICE-CODIGO.md y, con --check, falla si hay archivos sin cabecera o funciones sin describir.

### `inline_fonts.py`

Regenera site/assets/css/fonts.css (fuentes en base64) a partir de site/assets/fonts/*.woff2. Ver cabecera de fonts.css.

### `legal_proposals.py`

Sesión 9 · Hallazgos de las páginas legales (análisis de contenido) → PROPUESTAS para el panel. La web NO se modifica: los textos legales se publican tal cual están en la web original y los problemas quedan para que los revise quien corresponda (asesoría legal).

- `main` (l. 15) — Convierte los hallazgos de las páginas legales (content/es.json) en propuestas para el panel (legal-proposals-raw.json).

### `link_pdfs.py`

Sesión 11 · Enlaza cada ficha de producto con la familia del PDF verificado que la describe (determinista, sin IA).    python3 -I scripts/link_pdfs.py            # escribe data/analysis/pdf-product-links.json

Secciones: `[TOKENS]` · `[LOAD]`

- `fold` (l. 52) — Texto en minúsculas y sin tildes (los caracteres no ASCII se descartan), para comparar nombres.
- `toks` (l. 57) — conjunto de palabras distintivas de un nombre
- `score` (l. 74) — similitud producto ↔ familia (0-1); 0 si hay atributos en conflicto
- `base_family` (l. 93) — nombre de familia sin el rango de potencias entre paréntesis (dos tablas de un mismo producto: 160-4000 VA y 5000-11000 VA)
- `code_of` (l. 98) — «HB - 4» → hb4
- `load_docs` (l. 104) — Documentos de data/analysis/pdfs/p*.json, cada uno con el trabajo (`job`) del que procede.
- `main` (l. 114) — Enlaza cada producto con las familias de los PDF verificados (confianza alta, media o baja) y escribe pdf-product-links.json.
- `mkeys` (l. 203) — Conjunto de claves de modelo (model_key) de las referencias de una familia de PDF.

### `make_thumbs.py`

Sesión 3/8 · Miniaturas incrustadas para el PDF del presupuesto, logo para el PDF y favicon.    python3 -I scripts/make_thumbs.py

- `data_url` (l. 24) — Imagen PIL → URI data: en base64 con el formato indicado (`kw` se pasa a `save`).
- `thumb` (l. 31) — Miniatura cuadrada `size`×`size` en JPEG (fondo blanco, imagen centrada) del archivo `path`, como URI data:.
- `main` (l. 47) — Genera thumbs.json (miniaturas de producto y logo negativo para el PDF), site/assets/img/logo.png y favicon.png.

### `make_xlsx_fixtures.py`

[XLSX-FIXTURES] Genera los libros de ejemplo con los que se prueban los lectores de .xlsx del servidor (Worker en JS y API en PHP):    python3 -I scripts/make_xlsx_fixtures.py          → shared/xlsx/tarifa-openpyxl.xlsx · shared/xlsx/artesanal.xlsx · shared/xlsx/esperado.json

- `openpyxl_book` (l. 24) — Escribe tarifa-openpyxl.xlsx con openpyxl: dos hojas (Notas y Tarifa) y precios con 8 decimales.
- `put` (l. 39) — Añade una entrada al zip con fecha fija (salida reproducible), comprimida o sin comprimir.
- `handmade_book` (l. 46) — Escribe artesanal.xlsx a mano (XML) con lo que openpyxl no genera: texto enriquecido, «inline», fórmulas, booleanos, hoja oculta y una entrada sin comprimir.
- `expected` (l. 80) — Resultado que deben devolver los dos lectores (JS y PHP) para cada libro.

### `map_translations.py`

Sesión 1 · Mapa de traducciones y lotes de trabajo (determinista).    python3 -I scripts/map_translations.py

- `load` (l. 23) — JSON del archivo `p`, o `default` si no existe o no es válido.
- `norm` (l. 31) — URL sin ancla (#...) ni barra final, para comparar rutas.
- `chain` (l. 57) — Cadena de categorías ES desde la raíz hasta la categoría `cid` (lista de registros, de padre a hijo).

### `package_cpanel.py`

[PACKAGE-CPANEL] Paquete .zip para subir a un hosting con cPanel (web estática + API PHP), verificado antes de entregarlo.    python3 -I scripts/package_cpanel.py --base=https://pruebas.grupotorivac.com --staging     # subdominio/dominio de PRUEBAS (noindex, sin robots)

- `run` (l. 41) — ejecuta y devuelve (código, salida combinada)
- `build_site` (l. 47) — compila la web de producción (la salida se cuenta línea a línea en la consola de build)
- `copy_api` (l. 55) — copia el API PHP sin pruebas, sin almacén de datos y sin la configuración real (config.php lleva claves y la crea quien despliega)
- `shown` (l. 60) — ruta legible: relativa al proyecto si está dentro, absoluta si no
- `files` (l. 68) — Todos los ficheros de la carpeta, ordenados (incluye los ocultos como .htaccess).
- `verify` (l. 73) — → (errores, avisos). Un error impide entregar el paquete.
- `make_zip` (l. 155) — comprime la carpeta (con ficheros ocultos como .htaccess) y devuelve el SHA-256
- `main` (l. 167) — Compila, copia el API, verifica y comprime; si la verificación falla no genera el .zip.

### `pdf_jobs.py`

Sesión 1 · Reparto de PDFs en trabajos para agentes. Requiere prepare.py pdf.    python3 -I scripts/pdf_jobs.py   -> data/analysis/pdf-jobs.json

- `fam` (l. 29) — Familia de producto (variadores, transformadores…) de un nombre de PDF según FAMS; otros si ninguna encaja.
- `norm_text` (l. 38) — Texto de todas las páginas de un PDF en minúsculas alfanuméricas, para detectar PDF con el mismo texto.
- `add` (l. 60) — Añade a `jobs` un trabajo `p<nn>-<kind>` numerado con el contador global `n`.

### `prepare.py`

Sesión 1 · Preparación determinista para el análisis.    python3 -I scripts/prepare.py            # todo

- `clean` (l. 31) — Colapsa espacios y líneas vacías repetidas de un texto y lo recorta.
- `lang_of` (l. 36) — Idioma de una URL por su prefijo de ruta (en, fr, de); es si no lleva ninguno.
- `parse_page` (l. 42) — Extrae de un HTML de data/raw/html título, metas, hreflang, encabezados, texto, tablas, enlaces, imágenes y formularios (dict).
- `do_pages` (l. 112) — Convierte los HTML de data/raw/html en JSON limpio (data/analysis/pages) y escribe pages-index.json con los grupos de traducción.
- `do_media` (l. 138) — Índice compacto de la mediateca (los media.*.json en bruto pesan 10 MB y son idénticos entre idiomas).
- `sh` (l. 155) — Ejecuta el comando (con sus argumentos) y devuelve su salida estándar como texto, sin comprobar el código de salida.
- `do_pdf` (l. 160) — Incremental: no reescribe lo ya procesado (los agentes lo están leyendo); añade solo PDFs nuevos y guarda el índice de forma atómica.

### `qa_content.py`

[QA-CONTENT] ¿El demo contiene el mismo texto que la web original? (Sesión 10, control de contenido)    python3 -I scripts/qa_content.py [--worst=25] [--lang=es]

- `words` (l. 20) — Conjunto de palabras de 5 o más letras de un texto, en minúsculas y sin restos de URL (http, https, www).
- `dist_file` (l. 21) — Ruta de dist/<path>/index.html si existe; None si esa página no está generada.
- `mine` (l. 25) — Texto del main de una página generada, sin script, style, aside, nav ni form (barra lateral, migas y formularios fuera).
- `orig` (l. 32) — Texto original de una página (data/analysis/pages), sin el bloque de contacto de las fichas ni «Explora productos similares».
- `orig_clean` (l. 47) — Texto original sin las líneas de plantilla (las que se repiten en más de 8 páginas del idioma: menú, cookies, widgets).

### `secret_scan.py`

Sesión 16 · Escáner de secretos (claves de API, claves privadas, tokens) en los archivos versionados de torivac-web.    python3 -I scripts/secret_scan.py            # sale con código 1 si encuentra algo

- `tracked` (l. 31) — Rutas absolutas de los archivos versionados en git (git ls-files).
- `main` (l. 37) — Busca patrones de claves y tokens en los archivos versionados; sale con código 1 si hay alguno fuera de la lista blanca.

### `semantic.py`

Conversor HTML (WordPress/Elementor/WooCommerce) -> bloques semánticos limpios.  Biblioteca (la usa build_catalog.py) y pequeña CLI de prueba:

Secciones: `[INLINE]` · `[WALK]`

- `_abs` (l. 32) — URL absoluta (respecto a grupotorivac.com) con &amp; resuelto; devuelve `u` tal cual si viene vacía.
- `_clean` (l. 37) — Colapsa los blancos de un texto en un solo espacio y lo recorta (cadena vacía si es None).
- `inline_html` (l. 43) — [INLINE] sanitiza un nodo en HTML inline seguro (conserva enlaces y énfasis)
- `walk` (l. 45) — Añade a `out` el HTML inline seguro del nodo `n` y sus hijos (texto escapado, br, enlaces y énfasis; el resto se desenvuelve).
- `_img_block` (l. 72) — Bloque de imagen (src, alt, ancho y alto) de una etiqueta img, con carga diferida y srcset; None si no hay URL válida.
- `_table` (l. 83) — Bloque de tabla (título y filas de celdas) de un elemento table; None si ninguna fila tiene texto.
- `_is_button` (l. 94) — Indica si el enlace `a` tiene clase de botón (Elementor, ElementsKit, Gutenberg o genérica).
- `blocks_from` (l. 101) — [WALK] recorre en orden de documento y emite bloques
- `flush` (l. 105) — Convierte en un párrafo los nodos inline sueltos acumulados en `pending` y vacía la lista.
- `visit` (l. 117) — Añade a `blocks` los bloques del nodo `n` (encabezado, párrafo, lista, tabla, imagen, botón…); en contenedores recorre sus hijos.
- `_dedupe` (l. 206) — quita imágenes duplicadas consecutivas (los carruseles Swiper repiten slides) y bloques vacíos
- `clean_wp_html` (l. 223) — [WPBAKERY] Restos de shortcodes sin renderizar en la web original: [vc_raw_html]BASE64[/vc_raw_html] se decodifica (base64 → URL-decode → HTML);
- `raw` (l. 226) — Decodifica el base64 de un shortcode vc_raw_html (base64 → URL-decode → HTML); cadena vacía si falla.
- `blocks_from_html` (l. 236) — HTML (fragmento o página) → lista de bloques semánticos, tras limpiar los shortcodes de WPBakery sin renderizar.
- `elementor_sections` (l. 244) — [WALK] secciones de primer nivel de Elementor -> lista de listas de bloques

### `seo_check.py`

Sesión 16 · Auditoría SEO/GEO/accesibilidad estática de un build con --base (equivalente al seo-check de Why Not, ampliado a 4 idiomas).    node site/build.mjs --base=https://demo.torivac.example --out=/tmp/seo-dist

- `__init__` (l. 29) — Inicializa el estado del analizador: idioma, título, metas, enlaces, encabezados, imágenes, anclas y bloques JSON-LD.
- `handle_starttag` (l. 48) — Procesa una etiqueta de apertura: registra lang, metas, link, encabezados, imágenes, anclas y bloques JSON-LD.
- `handle_endtag` (l. 79) — Procesa una etiqueta de cierre: cierra el título, el encabezado (con su texto), el bloque JSON-LD o el script/style ignorado.
- `handle_data` (l. 95) — Acumula el texto en el título, en el bloque JSON-LD o en el encabezado abiertos (sin el texto de script/style).
- `route_of` (l. 105) — Ruta lógica (por ejemplo /en/product/x/) de un index.html generado, relativa a la carpeta de salida `root`.
- `lang_of` (l. 111) — Idioma de una ruta por su prefijo (en, fr, de); es si no lleva ninguno.
- `main` (l. 117) — Audita la carpeta de un build estático (páginas, enlaces, sitemap, robots, llms) e imprime el informe; sale con 1 si hay errores.
- `err` (l. 126) — Registra un error de la auditoría con el código `code` para la ruta `route`.
- `warn` (l. 130) — Registra un aviso (no hace fallar la auditoría) con el código `code` para la ruta `route`.

### `slice.py`

Trocea una captura alta en bandas visualizables: python3 -I scripts/slice.py in.png outdir [alto=1300] [ancho=1000]

### `ux_proposals.py`

Sesión 10 · Convierte los hallazgos de idioma de scripts/qa-ux.mjs en PROPUESTAS para el panel (nunca cambia la web).    node scripts/qa-ux.mjs && python3 -I scripts/ux_proposals.py     # lee data/analysis/qa-ux-desktop.json → data/analysis/ux-proposals-raw.json

- `main` (l. 20) — Convierte los textos en otro idioma no esperables de qa-ux-desktop.json en propuestas (ux-proposals-raw.json).

### `validate_products.py`

Validador determinista de data/analysis/products/<lote>.json (Sesión 1).    python3 -I scripts/validate_products.py data/analysis/products/g01-xxx.json [--json]

- `strip` (l. 28) — Texto plano de un fragmento HTML: sin etiquetas, con entidades decodificadas y espacios normalizados.
- `nz` (l. 33) — Texto normalizado para comparar: espacios colapsados, recortado y en minúsculas.
- `main` (l. 38) — Valida un lote de data/analysis/products contra groups.json, product-map.json y la Store API; devuelve 1 si hay problemas.
- `norm_url` (l. 104) — URL sin ancla (#...) ni barra final, para comparar.

### `web_vs_pdf.py`

Sesión 11 · Compara las TABLAS de las fichas de la web original con las tablas del PDF verificado (determinista).    python3 -I scripts/web_vs_pdf.py            # escribe data/analysis/web-vs-pdf.json

- `nums` (l. 29) — números de una celda: «2×1,5» → [2.0, 1.5]
- `head_key` (l. 34) — clave de una cabecera: las de 1-2 letras se respetan tal cual (D ≠ d); las largas se reducen a su primera palabra («Altura mm Height mm.» → altura, «Kgs.» → kg)
- `walk_tables` (l. 44) — Genera los bloques de tipo tabla de una lista de bloques semánticos (None equivale a lista vacía).
- `table_rows` (l. 51) — Filas de un bloque de tabla como listas de textos de celda, recortados.
- `main` (l. 56) — Compara las tablas de las fichas con las del PDF verificado enlazado (celda a celda) y escribe web-vs-pdf.json con la gravedad.

### `wpml_probe.py`

Sesión 2 · Mapa de traducciones según WPML (sondeo de solo lectura: GET sin seguir redirecciones).  OJO: WPML es el plugin de la web ORIGINAL (grupotorivac.com). La web nueva NO usa WPML ni ningún plugin de idioma: es HTML estático con su

- `probe` (l. 34) — GET sin seguir redirecciones → (código, destino).
- `classify` (l. 45) — Clasifica un sondeo WPML: same_slug (200), product/category (redirige a la traducción), no_translation o http_<código>.
- `main` (l. 57) — Sondea la URL de cada categoría en en/fr/de, guarda wpml-probe.json y, con --compare, lista las discrepancias.
- `compare` (l. 76) — Discrepancias entre el mapa actual (hreflang + co-ocurrencia) y lo que dice WPML.

### `capturas.mjs`

[CAPTURAS] Capturas de pantalla de las vistas clave del demo (para revisar sin abrir nada) + PDF de ejemplo. node scripts/capturas.mjs [carpeta-salida]        (por defecto entrega/capturas) Sirve dist/ por http, recorre el flujo de un cliente (ficha → presupuesto → PDF) y el panel de gestión, y guarda PNG numerados.

Secciones: `[CAPTURAS]`

- `mk` (l. 25) — Abre un contexto de navegador de w×h con el idioma fijado a mano (sin autodetección) y devuelve { ctx, page }.
- `shot` (l. 32) — Guarda una captura PNG numerada (NN-nombre.png) en la carpeta de salida y la muestra por consola; opts va a page.screenshot.
- `settle` (l. 34) — Espera a que la página termine de cargar y deja ms milisegundos más para que se asienten los scripts.
- `byPid` (l. 49) — ficha del transformador toroidal serie TT, con cantidades

### `harvest.mjs`

Sesión 1 · Cosecha de datos en bruto de grupotorivac.com (WordPress + WooCommerce + WPML). Reanudable: si un fichero ya existe, se salta. Ritmo educado (concurrencia 4 + pausa). node scripts/harvest.mjs            # todo

- `want` (l. 28) — True si hay que ejecutar la fase s: sin --only se hacen todas; con --only, solo las indicadas.
- `sleep` (l. 31) — Pausa asíncrona de ms milisegundos (ritmo educado con el servidor).
- `exists` (l. 33) — True si existe el fichero o la carpeta p.
- `get` (l. 37) — GET con reintentos y espera creciente (429/5xx; un 4xx no se reintenta) → { data (texto o Buffer), total, pages, ct }.
- `save` (l. 58) — Escribe content en data/raw/<rel>, creando las carpetas que falten; devuelve la ruta absoluta.
- `pool` (l. 66) — Aplica fn(item, índice) a los items con n tareas en paralelo y 120 ms de pausa entre peticiones; devuelve los resultados en orden.
- `langOf` (l. 75) — Idioma de una URL de WPML según su prefijo (/en, /fr o /de); sin prefijo, español.
- `slugOf` (l. 77) — Nombre de fichero de una URL: su ruta con «/» cambiado por «__» (home para la raíz).
- `locs` (l. 79) — Direcciones <loc> de un sitemap XML, en el orden en que aparecen.
- `sitemaps` (l. 82) — ---------- 1. Sitemaps ----------
- `rest` (l. 102) — Descarga el contenido REST (wp/v2) de cada tipo e idioma, paginado y unido, en rest/<tipo>.<lang>.json; salta lo ya descargado.
- `store` (l. 129) — ---------- 3. Store API + product tree ----------
- `knownLinks` (l. 159) — ---------- 4. HTML de cada URL ----------
- `keep` (l. 163) — Añade u (sin hash) al conjunto out si es del mismo dominio que BASE; ignora las URL no válidas.
- `hreflangs` (l. 177) — URL del mismo dominio que el HTML ya cosechado de urls declara como alternativas de idioma (<link rel=alternate hreflang>).
- `html` (l. 191) — Descarga el HTML de cada URL conocida (sitemap, REST, Store API y hreflang), hasta 3 rondas, saltando las ya guardadas.
- `pdfs` (l. 213) — ---------- 5. PDFs ----------
- `add` (l. 216) — Si u es un PDF lo registra en found (URL absoluta sin hash) con src como una de sus fuentes; ignora las URL rotas.

### `perf.mjs`

[PERF] Sesión 16 · Rendimiento en móvil: FCP, LCP, CLS y bytes transferidos con CPU ×4 más lenta y red «4G lenta» (1,6 Mbps, 150 ms). node scripts/perf.mjs [--dir=dist]      Objetivo del proyecto: LCP < 2,5 s (el contrato de Why Not pide < 2 s con hosting real y brotli/CDN). El servidor de pruebas comprime en gzip el texto, como haría el hosting; las imágenes ya vienen en webp.

Secciones: `[PERF]`

- `dirArg` (l. 14) — Valor de --dir=… de la línea de comandos (carpeta del sitio a medir); si falta se usa dist.
- `pad` (l. 47) — Texto s rellenado con espacios a la derecha hasta n caracteres, para alinear la tabla.

### `qa-a11y.mjs`

[QA-A11Y] Sesión 16 · Accesibilidad WCAG 2.1 AA con axe-core sobre una muestra estratificada (2 páginas por plantilla e idioma, escritorio y móvil). node scripts/qa-a11y.mjs [--per=2] [--dir=dist] axe-core: `npm i -D axe-core` o AXE_PATH=/ruta/axe.min.js (la prueba lo busca en node_modules y en /tmp/axe-install).

Secciones: `[QA-A11Y]`

- `opt` (l. 14) — Valor de la opción --k=valor de la línea de comandos, o d si no se indicó.

### `qa-admin-live.mjs`

[QA-ADMIN-LIVE] Sesión 7 · Panel REAL (admin-live.js) contra el backend real (sin red, correo ni IA reales). node scripts/qa-admin-live.mjs            contra el Worker torivac-api (en memoria) node scripts/qa-admin-live.mjs --php      contra el API PHP de cPanel (php -S) · ver scripts/lib/backends.mjs

Secciones: `[QA-ADMIN-LIVE]`

- `pick` (l. 27) — 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
- `ok` (l. 43) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `newPage` (l. 45) — Abre un contexto (1440×900) con el catálogo apuntando al API de pruebas; devuelve { ctx, page, errs } (errs = errores de JS).
- `login` (l. 53) — Abre /admin/ y envía el formulario de acceso con el correo y la contraseña dados (no espera al resultado).
- `navs` (l. 55) — Textos de los enlaces del menú lateral del panel.
- `toastText` (l. 57) — Texto del aviso emergente (#toast), leído tras una pausa corta para que aparezca.

### `qa-art.mjs`

[QA-ART] Sesión 12 · Piezas gráficas: osciloscopio del variador (4 idiomas, ratón/teclado, movimiento reducido) y bobinado toroidal de la portada.

Secciones: `[QA-ART]`

- `ok` (l. 13) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `amp` (l. 29) — Amplitud vertical (máx − mín de y) de los tramos «L x y» de un trazado SVG d.

### `qa-lang.mjs`

[QA-LANG] Sesión 13 · Detección de idioma del navegador + selector manual (Playwright, por http). node scripts/qa-lang.mjs Casos: idioma del navegador soportado / no soportado / lista con preferencia secundaria · página interior · enlace directo a /fr/ ·

Secciones: `[QA-LANG]`

- `ok` (l. 17) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `pathOf` (l. 18) — los enlaces del sitio terminan en index.html (funcionan también por file://)
- `visitor` (l. 21) — idioma del navegador → se simula con locale + navigator.languages (Playwright solo fija el primero)
- `settle` (l. 29) — Espera a que la página termine de cargar y 150 ms más para que actúe la detección de idioma.
- `ls` (l. 31) — Valor de localStorage para la clave k en la página (null si no existe).

### `qa-live.mjs`

[QA-LIVE] Sesión 9/6 · La web de producción contra el backend REAL: sin red, sin enviar correo de verdad. node scripts/qa-live.mjs            contra el Worker torivac-api (workers/api, KV en memoria) node scripts/qa-live.mjs --php      contra el API PHP de cPanel (backend-php/api, php -S, almacén en ficheros)

Secciones: `[QA-LIVE]` · `[DATA]` · `[SITE]` · `[BACKEND]` · `[BROWSER]`

- `pick` (l. 23) — 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
- `round2` (l. 26) — Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web).
- `unit` (l. 28) — Precio unitario esperado de ref para q unidades: el del último tramo por cantidad alcanzado, o el base.
- `ok` (l. 41) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.

### `qa-package.mjs`

[QA-PACKAGE] El paquete de cPanel tal y como se sube: lo genera package_cpanel.py (con sus verificaciones), se sirve con php -S (URLs limpias, API PHP real con almacén en ficheros, Resend simulado) y se recorre con el navegador: precios que llegan del servidor (el paquete NO lleva precios), presupuesto, pedido, panel y seguridad del API.

Secciones: `[QA-PACKAGE]` · `[PAQUETE]`

- `pick` (l. 27) — Primera referencia pedible de un producto (código real del PDF o línea genérica P<id>).
- `round2` (l. 30) — Redondea a 2 decimales (importe de línea).
- `unit` (l. 32) — Precio unitario de una referencia para una cantidad, con los tramos de la hoja.
- `ok` (l. 42) — Anota una comprobación: la cuenta como fallo si no se cumple y la imprime.
- `peek` (l. 96) — Pide una ruta del API y devuelve el código HTTP y si la respuesta enseña código PHP.

### `qa-quote.mjs`

[QA-QUOTE] Sesión 5 · Presupuesto realista de punta a punta en los 4 idiomas (Playwright, modo file://). node scripts/qa-quote.mjs Escenario: transformador toroidal (serie TT), resistencias y botones de baquelita, con cantidades que cruzan tramos de precio

Secciones: `[QA-QUOTE]` · `[DATA]` · `[SCENARIO]`

- `round2` (l. 28) — Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web).
- `unitPrice` (l. 30) — Precio unitario esperado de ref para qty unidades (último tramo alcanzado, o el base); null si no tiene precio.
- `ok` (l. 62) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `norm` (l. 64) — Texto con los espacios duros (U+00A0, U+202F) pasados a espacio normal y los repetidos colapsados, para comparar importes.
- `file` (l. 74) — URL de la ruta p: por http si hay servidor de pruebas (BASE) o file:// sobre dist/ con --file.

### `qa-tarifa.mjs`

[QA-TARIFA] Extremo a extremo con una TARIFA en el formato real (Excel «Artículo · Descripción · Precio venta», precios con 8 decimales), datos SINTÉTICOS (no hay precios de Torivac en el repositorio): panel real → subir .xlsx → vista previa (columnas, referencias nuevas, desconocidas) → aplicar → ficha del producto con las referencias nuevas

Secciones: `[QA-TARIFA]`

- `ok` (l. 50) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `round2` (l. 52) — Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web).
- `newPage` (l. 54) — Abre un contexto (1440×1000, español fijado a mano) con el catálogo apuntando al API de pruebas; devuelve { ctx, page, errs }.

### `qa-ux.mjs`

[QA-UX] Sesión 10 · Control riguroso de experiencia de usuario sobre TODAS las páginas del demo (Playwright, por http). node scripts/qa-ux.mjs [--limit=N] [--mobile | --width=1280] [--only=/ruta/] [--workers=4] [--out=informe.json] Por página mide (tras recorrerla entera para que carguen las imágenes diferidas):

Secciones: `[QA-UX]`

- `opt` (l. 18) — Valor de la opción --k=valor de la línea de comandos, o d si no se indicó.
- `inPage` (l. 42) — Comprobaciones que se ejecutan DENTRO de la página (se serializa a texto): desbordes, imágenes rotas o deformadas, restos de código, ids duplicados…
- `vis` (l. 45) — True si el elemento es visible: mide más de 1 px y no está oculto por visibility, display ni opacity.
- `desc` (l. 47) — Descripción corta del elemento para el informe: etiqueta#id.clase1.clase2.
- `words` (l. 105) — Palabras de un texto en minúsculas (solo letras), para contarlas contra las listas de palabras frecuentes de cada idioma.
- `worker` (l. 123) — Trabajador en paralelo: toma la siguiente página de todo, la recorre entera y guarda en results sus incidencias y errores.

### `screenshots.mjs`

Sesión 1 · Capturas y volcado de estilos de las plantillas clave de grupotorivac.com. node scripts/screenshots.mjs Salida:

- `rj` (l. 17) — Lee data/raw/<p> y lo devuelve ya parseado como JSON.
- `pick` (l. 24) — Permalink del primer elemento de arr que cumple f (o del primero si ninguno cumple).
- `cs` (l. 61) — Estilos calculados del elemento para las propiedades CSS props, como objeto { propiedad: valor }.
- `sample` (l. 65) — Muestra del primer elemento que casa con sel (texto y estilos de tipografía, color, caja y sombra); null si no existe.

### `smoke-admin.mjs`

[SMOKE-ADMIN] Prueba del panel (file://): login por rol, subida de Excel de precios, instrucción de precios, aplicar y verlo en la web.

Secciones: `[SMOKE-ADMIN]`

### `smoke.mjs`

[SMOKE] Prueba de humo del demo en un navegador real (Playwright). Modo file:// (doble clic) y capturas. node scripts/smoke.mjs [--shots] [--lang=es] Comprueba: errores de consola/red local, que no haya texto desbordado, flujo de presupuesto (añadir, cantidades, total, PDF).

Secciones: `[SMOKE]`

- `arg` (l. 14) — Valor de la opción --k=valor de la línea de comandos (undefined si no se indicó).
- `url` (l. 19) — URL file:// de la ruta p dentro de dist/ (las que acaban en «/» apuntan a su index.html).
- `visit` (l. 32) — Visita la ruta p, ejecuta fn si se da, busca desbordes horizontales y (con --shots) captura la página; anota los problemas nuevos.

### `qa-all.sh`

[QA-ALL] Todas las pruebas del proyecto, una tras otra, con resumen final (la CI hace lo mismo en ci/ci.yml). bash scripts/qa-all.sh             # todo (unos 15-25 min; qa-ux recorre las ~770 páginas en escritorio y en móvil) bash scripts/qa-all.sh --rapido    # sin qa-ux, qa-a11y ni perf (unos 4-6 min)

### `rebuild.sh`

Reconstruye TODO el demo a partir de los datos ya cosechados/analizados (orden importa). bash scripts/rebuild.sh            # contenido + catálogo + precios + sitio

## `scripts/lib/`

### `backends.mjs`

[BACKENDS] Servidores de API intercambiables para las pruebas de navegador: el Worker (workers/api, en memoria) o el PHP (backend-php/api, con `php -S`). Los mismos guiones (qa-live, qa-admin-live, qa-tarifa) corren contra los dos: si el contrato de un backend se desvía, falla la misma comprobación. const be = await startBackend({ kind: backendKind(), dist, port? });   (port: solo PHP, cuando la web ya lleva la URL compilada)   kind: 'worker' (por defecto) | 'php' (flag --php o TV_BACKEND=php)

Secciones: `[BACKENDS]` · `[WORKER]` · `[PHP]`

- `backendKind` (l. 22) — Backend elegido por la línea de comandos: 'php' con --php (o TV_BACKEND=php), 'worker' por defecto.
- `freePort` (l. 25) — Puerto TCP libre en 127.0.0.1.
- `readBody` (l. 27) — Cuerpo completo de una petición HTTP entrante, como Buffer.
- `externals` (l. 30) — servicios de terceros simulados; la misma lógica sirve al Worker (fetchImpl) y al PHP (servidor http)
- `handle` (l. 33) — Responde a los servicios externos simulados (Resend, Anthropic, hoja CSV, libro Excel) y guarda lo que se les envía.
- `startWorker` (l. 46) — Arranca el Worker torivac-api en memoria (KV simulado) detrás de un servidor http, con la web en otro puerto; misma interfaz que startPhp.
- `mockFetch` (l. 55) — fetch simulado del Worker: delega en los servicios externos simulados.
- `startPhp` (l. 84) — Arranca el API PHP con php -S sobre una copia de api/ y enlaces a la web; devuelve la misma interfaz que startWorker.
- `writeCfg` (l. 103) — Escribe api/config.php con la configuración de pruebas (PHP la lee en cada petición).
- `kv` (l. 117) — Ruta del fichero del almacén que corresponde a una clave.
- `read` (l. 119) — Valor guardado en el almacén del PHP para una clave (null si no existe).
- `startBackend` (l. 134) — Arranca el backend pedido ('worker' o 'php') y devuelve su interfaz común.

### `static-server.mjs`

[STATIC-SERVER] Servidor estático mínimo para las pruebas de navegador (sirve dist/ por http como en producción). const { server, base } = await serve(DIST);   …   server.close();

Secciones: `[STATIC-SERVER]`

- `serve` (l. 11) — Sirve root por http en un puerto libre de 127.0.0.1 (con gzip opcional del texto); devuelve { server, base }.

## `workers/api/src/`

### `ai.js`

[AI] Cambios de precios por INSTRUCCIÓN EN CASTELLANO (panel «Precios» → «Actualizar con una instrucción»). POST /api/prices/ai        {instruction}                → propone cambios (NUNCA los aplica) + vista previa POST /api/prices/ai/apply  {changes, confirm_large?}    → aplica los cambios ya revisados por la persona

Secciones: `[AI]`

- `buildTable` (l. 49) — Lista de precios en texto compacto para el prompt: «ref | nombre | 12.3456 | desde 10 uds = 11.9; desde 50 uds = 11.4».
- `num` (l. 55) — El valor si es un número finito; si no, null.
- `r4` (l. 57) — Redondea un precio a 4 decimales.
- `validateChanges` (l. 63) — Valida lo que devuelve la IA contra los precios y el catálogo reales.
- `applyChanges` (l. 96) — Aplica cambios ya validados sobre unos precios (devuelve unos nuevos; no toca los originales).
- `callAnthropic` (l. 107) — Llama a la API de Anthropic forzando la herramienta de propuesta → { input, usage }; lanza Error 502 si falla o no hay propuesta.
- `suggestPriceChanges` (l. 124) — Propone cambios para una instrucción. Lanza Error con .status (400 instrucción vacía, 503 IA sin configurar, 502 fallo de la IA).
- `applyPriceChanges` (l. 138) — Aplica los cambios que la persona ha revisado. Vuelve a validarlo todo en servidor (no se fía de lo que manda el navegador).

### `auth.js`

[AUTH] Contraseñas PBKDF2-HMAC-SHA256 (100 000 it., sal de 16 B) y sesiones firmadas HMAC-SHA256 sin estado en servidor. Patrón de whynot-sites/workers/admin (users.js). Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma). payload = { sub:email, role, name, exp }. Caduca a los 7 días.

Secciones: `[AUTH]`

- `pbkdf2` (l. 11) — Deriva 256 bits de la contraseña con PBKDF2-HMAC-SHA256 y la sal dada (ITER iteraciones); devuelve Uint8Array.
- `hashPassword` (l. 16) — Genera una sal aleatoria de 16 B y devuelve { hash, salt } en hexadecimal, listos para guardar en el usuario.
- `verifyPassword` (l. 21) — True si la contraseña con esa sal da el hash guardado (comparación en tiempo constante).
- `hmac` (l. 25) — Firma HMAC-SHA256 de bytes con la clave secret; devuelve Uint8Array.
- `signSession` (l. 30) — Crea el token de sesión «datos.firma» (base64url) con { sub, role, name }; caduca a los ttlMs (7 días por defecto).
- `verifySession` (l. 35) — Comprueba firma, caducidad y rol de un token de sesión → { sub, role, name }, o null si no es válido.
- `bearer` (l. 46) — Token de la cabecera «Authorization: Bearer …» de la petición, o null si no viene.
- `authenticate` (l. 48) — Quién llama: {role:'manager'|'client', sub, name, master?} o null. ADMIN_API_TOKEN actúa como manager (scripts/CI).
- `requireRole` (l. 56) — True si hay una persona autenticada (who) y su rol es uno de los indicados.

### `catalog.js`

[CATALOG] Contexto del catálogo para leer hojas de precios: líneas pedibles del sitio, SKU de WooCommerce y reglas de códigos nuevos (generado por site/build.mjs). PRICE_DECIMALS (variable del Worker, opcional): decimales del precio unitario al importar (por defecto 4, máximo 6).

Secciones: `[CATALOG]`

- `catalogCtx` (l. 6) — Contexto del catálogo para leer hojas de precios: { lines, skus, rules } y decimals si PRICE_DECIMALS es un entero.

### `cors.js`

[CORS] Solo los orígenes de ALLOWED_ORIGINS (y los *.pages.dev si ALLOW_PAGES_DEV=1) pueden llamar al API desde un navegador.

Secciones: `[CORS]`

- `isOriginAllowed` (l. 2) — [CORS] Solo los orígenes de ALLOWED_ORIGINS (y los *.pages.dev si ALLOW_PAGES_DEV=1) pueden llamar al API desde un navegador.
- `corsHeaders` (l. 10) — Cabeceras CORS para un origen ya permitido (métodos, cabeceras admitidas y caché del preflight).

### `email.js`

[EMAIL] Envío por Resend (HTTP). Sin RESEND_API_KEY no se envía nada y se devuelve {skipped:true} (entornos de prueba).

Secciones: `[EMAIL]`

- `sendMail` (l. 4) — Envía un correo por Resend → { ok, id }; sin RESEND_API_KEY { ok:false, skipped:true }; si falla { ok:false, status | error }.
- `money` (l. 15) — Importe en euros con el formato del idioma (es, en, fr, de); «—» si no hay importe.
- `orderMail` (l. 17) — Correo de aviso de un pedido para el equipo → { html, text } con cliente, líneas, total y marca de precios de demostración.

### `index.js`

[INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login USUARIO   GET /api/auth/me · GET /api/orders (manager: todos; client: solo los suyos)

Secciones: `[INDEX]`

- `fetch` (l. 19) — Atiende cada petición HTTP: CORS, rutas públicas, login y rutas de sesión o de manager; deps = { fetchImpl, ctx } para pruebas.
- `scheduled` (l. 86) — Tarea programada (cron): sincroniza los precios con la hoja de origen; un fallo se registra en el log y no se propaga.

### `orders.js`

[ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por email (equipo + copia al cliente, con el PDF).

Secciones: `[ORDERS]`

- `ymd` (l. 11) — Fecha en UTC como AAAAMMDD, para el número de pedido y su contador diario.
- `nextNumber` (l. 13) — Siguiente número de pedido del día (TV-AAAAMMDD-NNNN), con un contador en KV que caduca a las 48 h.
- `handleOrder` (l. 16) — POST /api/order: límite por IP, validación, valoración en servidor con los precios vigentes, guardado en KV y correos.
- `handleContact` (l. 41) — POST /api/contact: límite por IP, anti-spam y envío del mensaje al equipo; responde { ok, emailed, skipped }.

### `prices.js`

[PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios). Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js): { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note, n?, pid? } } }   (n/pid: referencia que añade la hoja dentro de un producto)

Secciones: `[PRICES]`

- `loadPrices` (l. 10) — Precios vigentes guardados en KV; si todavía no hay, una hoja vacía (mode 'none').
- `coarse` (l. 13) — Origen sin datos personales ni identificadores: «upload:ana@torivac.com» → «upload», «sheet:ID» → «sheet».
- `publicView` (l. 15) — Lo que ve cualquier visitante de GET /api/prices: igual que el original pero sin el correo de quien cargó la hoja ni el id del archivo de Drive.
- `unitPrice` (l. 19) — Precio unitario de ref para qty unidades (último tramo por cantidad alcanzado); null si no tiene precio.
- `priceOrder` (l. 24) — Valora las líneas {ref,qty}. Sin precio → unit/total null («Consultar»; no suman al total).
- `readPrices` (l. 32) — filas (con filas de título delante si las hay) → { prices, report } usando las reglas compartidas de shared/price-sheet.mjs.
- `rowsToPrices` (l. 38) — igual que readPrices pero devuelve solo el objeto de precios (lo usan el cron y los tests)
- `withSheetItems` (l. 40) — catálogo de referencias pedibles = las del sitio + las que la hoja de precios añadió dentro de un producto ({n, pid})
- `diffPrices` (l. 46) — Compara dos precios: { changed, added, removed } con las referencias afectadas y same con el número de las que no cambian.

### `ratelimit.js`

[RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.

Secciones: `[RATE-LIMIT]`

- `hit` (l. 2) — [RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.

### `sheets.js`

[SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV. Tres modos, en este orden: 1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID): hoja de Google → Sheets API v4; si el archivo es un .xlsx subido a Drive sin convertir → se descarga con la API de Drive y se lee el libro

Secciones: `[SHEETS]`

- `parseCsv` (l. 14) — Texto CSV → filas de celdas: separador «;» o «,» según la primera línea, comillas dobles; omite las filas vacías.
- `pemToDer` (l. 29) — Clave privada PEM (PKCS8) → bytes DER, sin las líneas de cabecera ni espacios.
- `getAccessToken` (l. 31) — token de acceso OAuth2 de una cuenta de servicio (JWT RS256 firmado con WebCrypto)
- `xlsxRows` (l. 42) — filas de la hoja de precios de un libro .xlsx descargado (bytes) → { rows, sheet }; si no es un libro, el error dice qué revisar
- `readSheetRows` (l. 49) — Lee la hoja de precios de la primera fuente configurada (cuenta de servicio, XLSX o CSV) → { rows, source }; sin fuente, Error.
- `savePrices` (l. 76) — Guarda unos precios nuevos: copia el anterior al histórico (90 días), escribe los vigentes y la meta. Lo usan la sincronización y los cambios por IA.
- `syncPrices` (l. 86) — Lee la hoja (Drive, CSV o filas subidas), la valida con las reglas compartidas y la publica. ctx = contexto del catálogo (ver catalog.js); sin ctx se aceptan todas las referencias (pruebas).

### `turnstile.js`

[TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.

Secciones: `[TURNSTILE]`

- `verifyTurnstile` (l. 2) — [TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.

### `users.js`

[USERS] Usuarios en KV: clave user:<email>. Nunca se devuelve ni se guarda la contraseña en claro.

Secciones: `[USERS]`

- `key` (l. 4) — Clave KV de un usuario: user:<correo en minúsculas>.
- `pub` (l. 7) — Datos públicos del usuario, sin el hash ni la sal de la contraseña.
- `createUser` (l. 10) — Da de alta un usuario → { user } o { error, status? } si el correo, el rol o la contraseña no valen o ya existe.
- `listUsers` (l. 22) — Lista los usuarios (solo datos públicos), recorriendo todas las páginas de KV.
- `deleteUser` (l. 28) — Borra el usuario con ese correo (si no existe, no hace nada).
- `checkLogin` (l. 30) — Comprueba credenciales. Devuelve el usuario público o null (mismo coste si no existe: evita enumerar usuarios por tiempo).

### `util.js`

[UTIL] Respuestas JSON, escape HTML, comparación en tiempo constante, codificaciones. Respuesta JSON con el estado y las cabeceras indicados; nunca se cachea (no-store).

Secciones: `[UTIL]`

- `json` (l. 4) — Respuesta JSON con el estado y las cabeceras indicados; nunca se cachea (no-store).
- `esc` (l. 6) — Escapa & < > y comillas para incrustar un valor en HTML; null o undefined dan una cadena vacía.
- `timingSafeEqual` (l. 8) — Compara dos textos en tiempo constante (false si su longitud difiere) para no revelar por tiempo dónde difieren.
- `toB64Url` (l. 10) — Bytes → base64url sin relleno.
- `fromB64Url` (l. 12) — base64url (con o sin relleno) → Uint8Array.
- `toHex` (l. 14) — Bytes → texto hexadecimal en minúsculas.
- `fromHex` (l. 16) — Texto hexadecimal → Uint8Array.
- `round2` (l. 18) — Redondea a 2 decimales (1.005 → 1.01).
- `clientIp` (l. 20) — IP del cliente que informa Cloudflare (CF-Connecting-IP); 0.0.0.0 si falta.
- `readJson` (l. 22) — Cuerpo JSON de la petición, o null si supera maxBytes (por Content-Length) o no es JSON válido.

### `validate.js`

[VALIDATE] Validación estricta de pedidos y mensajes de contacto. Todo lo que llega del navegador es no fiable.

Secciones: `[VALIDATE]`

- `clean` (l. 5) — Texto sin caracteres de control (conserva tabulador y saltos de línea), recortado y limitado a max caracteres.
- `parseOrder` (l. 8) — Valida y normaliza el pedido del navegador (cliente, líneas pedibles de items, idioma, PDF) → { order } o { error }.
- `parseContact` (l. 31) — Valida y normaliza el formulario de contacto (honeypot, nombre, correo, mensaje, privacidad) → { contact } o { error }.

## `workers/api/test/`

### `ai.test.js`

Pruebas de [AI]: cambios de precios por instrucción en castellano (API de Anthropic simulada; no sale nada a la red).

Secciones: `[AI]`

- `aiReply` (l. 12) — Respuesta simulada de la API de Anthropic: un bloque tool_use de la herramienta de precios con el input dado.
- `env0` (l. 14) — Entorno de pruebas con ANTHROPIC_API_KEY y PRICES ya guardados en KV; devuelve una promesa del entorno.
- `fetchImpl` (l. 57) — fetch simulado de la IA: guarda en sent la URL, las cabeceras y el cuerpo de la llamada y responde con una propuesta.
- `call` (l. 92) — POST a la ruta p del Worker con body JSON y cabeceras (por defecto el token maestro); devuelve la Response.
- `call` (l. 108) — Llama a /api/proposals/state con el método m, body y cabeceras (por defecto el token maestro); devuelve la Response.

### `api.test.js`

Pruebas de [AUTH], [VALIDATE], [PRICES], [SHEETS], [ORDERS], [USERS] e [INDEX]: contraseñas y sesiones, pedidos, hoja de precios, roles, CORS, límites y cron. Sin red: KV en memoria y Resend/Google simulados con fetchImpl (ver helpers.js). Se ejecutan con `npm test` desde workers/api.

Secciones: `[AUTH]` · `[VALIDATE]` · `[PRICES]` · `[SHEETS]` · `[ORDERS]` · `[USERS]` · `[INDEX]`

- `goodOrder` (l. 15) — Pedido válido de ejemplo { customer, lines, lang }; over sustituye campos para provocar cada error de validación.
- `ok` (l. 69) — Crea un fetch simulado que responde 200 con el texto dado.
- `login` (l. 120) — POST /api/auth/login con el correo y la contraseña dados; devuelve la Response.
- `as` (l. 125) — Llama al Worker en la ruta p con el token t como Bearer y las opciones o (método, body); devuelve la Response.
- `ok` (l. 184) — fetch simulado que responde 200 con las filas del CSV de precio de relleno (rows).
- `me` (l. 213) — GET /api/auth/me con la sesión de Ana; devuelve la Response.
- `fetchImpl` (l. 221) — Resend simulado: guarda cada correo enviado en `sent`.

### `helpers.js`

Utilidades de test: KV en memoria con list() y TTL ignorado, y fetch simulado.

- `mkEnv` (l. 10) — Entorno de pruebas del Worker: KV en memoria, destinatarios, token maestro, secreto de sesión y origen; extra sobrescribe valores.
- `req` (l. 12) — Request de prueba a https://api.test: método, cabeceras y body (se serializa a JSON).

### `price-sheet.test.js`

Pruebas de la lectura tolerante de hojas de precios (shared/price-sheet.mjs) con los casos compartidos (shared/price-sheet.fixtures.json).

### `xlsx.test.js`

Lector de .xlsx del servidor (shared/xlsx.mjs): mismos libros y mismo resultado esperado que el port en PHP (backend-php/api/tests/XlsxTest.php).

- `book` (l. 11) — Bytes del libro .xlsx de pruebas f, leído de shared/xlsx/.
- `bytesRes` (l. 49) — Response simulada con los bytes del libro f y el estado indicado (200 por defecto).
- `fetchImpl` (l. 66) — fetch simulado que siempre devuelve el libro artesanal.xlsx.
- `mk` (l. 85) — Crea el fetch simulado de Google: OAuth siempre válido; Sheets da valores si sheetsOk o falla con 400; Drive sirve el libro.
- `dead` (l. 102) — ni Sheets ni Drive: error con los dos códigos y la pista de compartir el archivo

## `shared/`

### `price-sheet.mjs`

[PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → objeto de precios. FUENTE ÚNICA de las reglas. Lo usan el Worker (workers/api), los scripts de Node (scripts/import_prices.mjs), el panel demo (se copia a assets/js/price-sheet.js al compilar) y tiene un port en PHP (backend-php/lib/PriceSheet.php) que se prueba contra los mismos casos (shared/price-sheet.fixtures.json).

Secciones: `[PRICE-SHEET]`

- `normHeader` (l. 29) — cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa)
- `normRef` (l. 31) — referencia → clave de comparación: mayúsculas, sin espacios
- `parseNumber` (l. 34) — número de una celda: acepta «27,75», «27.75093203», «1.234,56», «1,234.56», «22 000», «€ 5» y números ya numéricos; vacío/ilegible → null
- `roundTo` (l. 47) — Redondea n a dec decimales (corrige los errores de coma flotante: 1.005 con 2 decimales da 1.01).
- `findHeader` (l. 50) — índice de la fila de cabecera (primera con una columna de referencia y una de precio) y mapa columna → posición
- `readSheet` (l. 68) — rows: matriz (primera fila = cabecera o con filas de título delante). ctx (todo opcional):
- `col` (l. 78) — Celda de la fila r en la columna del campo f; cadena vacía si la hoja no tiene esa columna.

### `xlsx.mjs`

[XLSX] Lector mínimo de libros .xlsx (un zip con XML) SIN dependencias: lo usa el Worker para leer la tarifa directamente de Drive (descarga del .xlsx tal cual, sin convertirlo a hoja de Google). Port en PHP: backend-php/api/lib/Xlsx.php. Ambos se prueban contra los mismos libros (shared/xlsx/*.xlsx, generados por scripts/make_xlsx_fixtures.py) y el mismo resultado esperado (shared/xlsx/esperado.json).

Secciones: `[XLSX]`

- `u16` (l. 15) — Enteros little-endian de 16 y 32 bits en la posición o de un DataView (formato del zip).
- `zipEntries` (l. 18) — índice del contenido del zip por nombre: { método, tamaño comprimido, posición de la cabecera local } (se lee del directorio central, al final del fichero)
- `entryText` (l. 35) — contenido de una entrada del zip (sin comprimir o deflate) como texto UTF-8
- `unesc` (l. 47) — entidades XML → texto (&amp; &lt; &#233; &#xE9;)
- `attrs` (l. 49) — atributos de una etiqueta XML: ' r="A1" t="s"' → { r: 'A1', t: 's' }
- `tText` (l. 51) — texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta
- `colIndex` (l. 53) — letras de columna → posición: A=0, Z=25, AA=26
- `sheetRows` (l. 56) — celdas de una hoja → filas (ver cabecera)
- `readXlsx` (l. 85) — @returns {Promise<{name:string, hidden:boolean, rows:any[][]}[]>}
- `text` (l. 88) — Texto de una entrada del zip por su nombre ('' si no existe).
- `pickSheet` (l. 107) — elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio

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

- `system` (l. 21) — Instrucciones de sistema de la IA: propone cambios de precios (no los aplica), solo con referencias de la lista y con importes en euros.
- `toolSchema` (l. 34) — Esquema JSON de la herramienta que debe rellenar la IA: resumen, cambios {ref, price, tiers} y avisos.
- `buildTable` (l. 48) — lista de precios en texto compacto para el prompt
- `n` (l. 61) — Número con hasta 8 decimales y sin ceros sobrantes, para escribirlo en la tabla que ve la IA.
- `validateChanges` (l. 67) — Valida lo que devuelve la IA contra los precios y el catálogo reales.
- `applyChanges` (l. 108) — aplica cambios ya validados sobre unos precios (devuelve unos nuevos)
- `suggest` (l. 122) — Propone cambios (lanza \RuntimeException con código HTTP: 400 instrucción vacía, 503 IA sin configurar, 409 sin precios, 502 fallo de la IA)
- `apply` (l. 148) — Aplica los cambios revisados por la persona; vuelve a validarlo todo en servidor

### `Auth.php`

[AUTH] Contraseñas (password_hash: bcrypt/argon2 según el hosting) y sesiones firmadas HMAC-SHA256 sin estado en servidor. Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma); payload = {sub, role, name, exp(ms)}; caduca a los 7 días. El token maestro (config admin_token) actúa como manager para scripts y CI.

Secciones: `[AUTH]` · `[USERS]`

- `hashPassword` (l. 14) — Hash de contraseña (bcrypt/argon2 según el hosting) para guardar en el usuario.
- `verifyPassword` (l. 17) — Comprueba una contraseña contra su hash; un hash vacío nunca valida.
- `signSession` (l. 20) — Firma una sesión {sub, role, name, exp} con HMAC-SHA256 y la devuelve como token.
- `verifySession` (l. 27) — @return array{sub:string,role:string,name:string}|null
- `authenticate` (l. 40) — quién llama: ['role','sub','name','master'?] o null
- `requireRole` (l. 51) — Dice si la sesión existe y su rol es uno de los permitidos.
- `key` (l. 58) — Clave del almacén de un usuario: user:<correo en minúsculas>.
- `pub` (l. 61) — Usuario sin el hash de la contraseña (lo que puede salir al navegador).
- `create` (l. 64) — @return array{user?:array,error?:string,status?:int}
- `all` (l. 79) — Lista de todos los usuarios sin hash, ordenados por correo.
- `exists` (l. 87) — ¿Existe ese usuario?
- `delete` (l. 90) — Borra un usuario por su correo.
- `check` (l. 93) — comprueba credenciales (mismo coste si el usuario no existe: no se puede enumerar usuarios por tiempo)

### `Catalog.php`

[CATALOG] Catálogo de referencias pedibles que genera la compilación del sitio (generated/catalog.json): items {ref:{n,pid}} · skus {sku de WooCommerce:id de producto} · rules [{pattern,pid}] (códigos nuevos de una tarifa que encajan en un producto)

Secciones: `[CATALOG]`

- `load` (l. 13) — Catálogo de referencias pedibles (generated/catalog.json, o el fichero dado); se guarda en memoria.
- `set` (l. 23) — sustituye el catálogo (pruebas)
- `items` (l. 26) — Referencias pedibles: {ref: {n: nombre, pid: producto}}.
- `sheetCtx` (l. 29) — contexto para PriceSheet::read

### `Config.php`

[CONFIG] Lee api/config.php (copia de config.sample.php) y la sirve con claves anidadas: Config::get('mail.driver', 'file'). Las variables de entorno TORIVAC_<CLAVE> (p. ej. TORIVAC_SESSION_SECRET) tienen prioridad: útil para pruebas y para hostings con panel de variables.

Secciones: `[CONFIG]`

- `load` (l. 13) — Carga la configuración desde config.php (si falta, queda vacía) y fuerza a OPcache a releerla.
- `set` (l. 21) — sustituye toda la configuración (pruebas)
- `get` (l. 24) — valor por ruta con puntos: 'prices.sheet_id'

### `Diag.php`

[DIAG] Autodiagnóstico del servidor para quien despliega en cPanel: versión de PHP, extensiones, carpeta de datos, configuración, correo, origen de precios, primer manager y última sincronización. Se ve de dos formas: php api/tools/check.php [--net]      por línea de comandos (--net prueba además la salida a Internet)

Secciones: `[DIAG]`

- `c` (l. 16) — Una comprobación.
- `insideWebRoot` (l. 19) — Dice si un directorio está dentro de la carpeta pública de la web (cualquiera podría pedir sus ficheros si el .htaccess falla).
- `bytes` (l. 27) — Valor de php.ini con sufijo (8M, 512K, 1G) → bytes; 0 o -1 = sin límite → null.
- `run` (l. 39) — Ejecuta todas las comprobaciones.

### `Http.php`

[HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google (sigue hasta 5 redirecciones de los GET, p. ej. la descarga de Drive). En las pruebas se sustituye por una función (Http::$mock) para no salir a Internet.

Secciones: `[HTTP]`

- `request` (l. 17) — @param string[] $headers líneas «Nombre: valor»

### `Mail.php`

[MAIL] Envío de correo con tres controladores (config mail.driver): resend → API HTTP de Resend (recomendado; hay que verificar el dominio con SPF/DKIM) mail   → función mail() de PHP (el propio hosting; sin garantías de entrega si el SPF del dominio no incluye el servidor)

Secciones: `[MAIL]`

- `send` (l. 16) — @param array{to:string[],cc?:string[],subject:string,html?:string,text?:string,replyTo?:string,attachments?:array} $m
- `encodeHeader` (l. 48) — Codifica un asunto con caracteres no ASCII como palabra MIME UTF-8 en base64.
- `mime` (l. 51) — cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail()
- `money` (l. 74) — importe con el formato del idioma del cliente (es 1.234,56 €, en €1,234.56, fr 1 234,56 €, de 1.234,56 €)
- `orderMail` (l. 86) — @return array{html:string,text:string}

### `Orders.php`

[ORDERS] POST /api/order y POST /api/contact: valida lo que llega del navegador (no es fiable), valora el pedido en servidor con los precios VIGENTES (ignora cualquier precio que mande el cliente), numera TV-AAAAMMDD-NNNN, guarda y envía por correo al equipo (con el PDF) y copia al cliente. Defensas: honeypot, límite por IP, Turnstile opcional, referencias solo del catálogo (o añadidas por la hoja de precios), cantidades enteras 1..1 000 000.

Secciones: `[ORDERS]`

- `parseOrder` (l. 15) — @return array{order?:array,error?:string}
- `parseContact` (l. 46) — @return array{contact?:array,error?:string}
- `verifyTurnstile` (l. 59) — Turnstile opcional: sin secreto se omite; con secreto, falla cerrado
- `team` (l. 72) — destinatarios del equipo: config order_to (array o texto separado por comas)
- `nextNumber` (l. 80) — Siguiente número de pedido TV-AAAAMMDD-NNNN (contador diario con bloqueo para que dos pedidos no repitan número).
- `handleOrder` (l. 93) — POST /order: valida, valora con los precios del servidor, guarda el pedido y envía el correo al equipo y la copia al cliente.
- `handleContact` (l. 117) — POST /contact: valida el mensaje y lo envía al equipo con el correo del visitante como responder-a.

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

- `load` (l. 18) — Precios vigentes; si todavía no hay, devuelve una hoja vacía (modo none).
- `coarse` (l. 25) — Origen sin datos personales ni identificadores: «upload:ana@torivac.com» → «upload», «sheet:ID» → «sheet».
- `publicView` (l. 28) — Lo que ve cualquier visitante de GET /prices: igual que el original pero sin el correo de quien cargó la hoja ni el id del archivo de Drive.
- `forJson` (l. 36) — para JSON: items vacío → {} y claves numéricas siempre como objeto
- `unit` (l. 43) — Precio unitario de una referencia para una cantidad, aplicando el último tramo alcanzado; null si no tiene precio.
- `priceOrder` (l. 53) — valora líneas [{ref,qty}]; sin precio → unit/total null («Consultar»: no suman)
- `withSheetItems` (l. 66) — catálogo del sitio + referencias que la hoja añadió dentro de un producto
- `diff` (l. 76) — diferencias entre dos juegos de precios
- `save` (l. 90) — guarda unos precios nuevos: el anterior pasa al histórico (90 días), se escriben los vigentes y la meta
- `fromRows` (l. 102) — filas → ['prices' => …, 'report' => …] con las reglas compartidas de PriceSheet
- `parseCsv` (l. 114) — CSV (RFC 4180: comillas, separador , o ;, saltos de línea dentro de comillas) → filas
- `serviceAccount` (l. 136) — cuenta de servicio de Google: array, ruta a un .json o texto JSON
- `accessToken` (l. 148) — token de acceso OAuth2 (JWT RS256 firmado con openssl)
- `xlsxRows` (l. 163) — filas de la hoja de precios de un libro .xlsx descargado (bytes); si no es un libro, el error dice qué revisar
- `readRows` (l. 176) — Tres orígenes, en este orden:
- `sync` (l. 212) — Lee la hoja (Drive, CSV o filas subidas), valida y publica. ctx = contexto del catálogo (null → el del sitio; [] → aceptar todo, pruebas).

### `Request.php`

[REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP) + respuesta JSON + CORS + límite de uso. Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake).

Secciones: `[REQUEST]` · `[CORS]` · `[RATE-LIMIT]`

- `fromGlobals` (l. 18) — construye la petición real a partir de $_SERVER; la ruta es lo que sigue a «/api»
- `fake` (l. 39) — petición simulada para pruebas
- `header` (l. 51) — Valor de una cabecera de la petición (nombre sin distinguir mayúsculas); cadena vacía si no existe.
- `json` (l. 54) — cuerpo JSON como array (null si no es válido o supera el límite)
- `bearer` (l. 62) — Token de la cabecera «Authorization: Bearer …», o null.
- `__construct` (l. 76) — Respuesta con cuerpo JSON, código HTTP y cabeceras (por defecto JSON UTF-8 y sin caché).
- `send` (l. 84) — Envía código, cabeceras y cuerpo JSON (sin cuerpo en 204 y 304).
- `allowed` (l. 96) — Dice si un origen puede usar el API: el propio sitio, las peticiones sin Origin o los de allowed_origins.
- `headers` (l. 111) — Cabeceras CORS para un origen permitido.
- `hit` (l. 121) — @return array{allowed:bool,remaining:int,resetAt:int}

### `Router.php`

[ROUTER] Rutas del API (equivalentes a workers/api/src/index.js: la web usa el mismo contrato con el Worker o con este PHP). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login USUARIO   GET /api/auth/me · GET /api/orders (manager: todos; cliente: solo los suyos)

Secciones: `[ROUTER]`

- `handle` (l. 15) — Atiende una petición: comprueba el origen (CORS), despacha a la ruta y convierte las excepciones en respuestas JSON con su código.
- `route` (l. 36) — Tabla de rutas: públicas, de usuario autenticado y de manager (ver la lista de la cabecera).
- `cron` (l. 128) — sincroniza los precios (cron diario) y limpia lo caducado

### `Store.php`

[STORE] Almacén clave-valor en ficheros JSON (sustituye a Cloudflare KV en un hosting con cPanel). claves: user:<email> · order:<nº> · prices:current · prices:meta · prices:history:<ts> · rl:<cubo>:<id> · counter:<yyyymmdd> · proposals:state Escritura atómica (fichero temporal + rename) y bloqueo flock para los contadores. Caducidad opcional (TTL) comprobada al leer.

Secciones: `[STORE]`

- `init` (l. 15) — crea las carpetas y protege el directorio
- `root` (l. 30) — Carpeta de datos en uso.
- `file` (l. 33) — Fichero JSON que guarda una clave (la clave se codifica para que sea un nombre de fichero válido).
- `get` (l. 36) — valor guardado (array/escalar) o null si no existe o caducó
- `put` (l. 49) — Guarda un valor de forma atómica (fichero temporal + rename) con caducidad opcional en segundos.
- `delete` (l. 61) — Borra una clave.
- `keys` (l. 64) — claves que empiezan por un prefijo (sin las caducadas)
- `locked` (l. 76) — ejecuta $fn con un bloqueo exclusivo (contador de pedidos, límites de uso)
- `purge` (l. 85) — borra lo caducado (lo llama el cron)

### `Util.php`

[UTIL] Utilidades sin estado: codificaciones, redondeo, escape HTML y comparaciones seguras. Compatible con PHP 7.4 o superior (sin match, str_contains ni argumentos con nombre).

Secciones: `[UTIL]`

- `b64url` (l. 11) — binario → base64 URL-safe sin relleno
- `unb64url` (l. 14) — base64 URL-safe → binario ('' si no es válido)
- `round2` (l. 23) — importe de línea: 2 decimales (mitad hacia arriba, igual que el navegador y el Worker)
- `round4` (l. 26) — precio unitario: 4 decimales (variaciones de céntimos)
- `esc` (l. 29) — escape para HTML
- `eq` (l. 32) — comparación en tiempo constante
- `startsWith` (l. 35) — Dice si un texto empieza por otro.
- `nowMs` (l. 38) — milisegundos desde 1970
- `iso` (l. 41) — ISO 8601 con milisegundos y Z, como JavaScript (new Date().toISOString())
- `obj` (l. 48) — un array vacío debe salir como {} en JSON (no como []): lo necesitan items de precios y mapas
- `enc` (l. 54) — JSON legible y fiel: sin escapar tildes ni barras
- `clean` (l. 61) — cadena limpia de caracteres de control y recortada
- `isList` (l. 69) — ¿es una lista (array indexado 0..n-1)? (array_is_list existe solo desde PHP 8.1)

### `Xlsx.php`

[XLSX] Lector mínimo de libros .xlsx (zip + XML) sin extensiones ni librerías: la tarifa se lee directamente de Drive sin convertirla a hoja de Google. Port en PHP de shared/xlsx.mjs; ambos se prueban con los mismos libros (shared/xlsx/*.xlsx) y el mismo resultado esperado (shared/xlsx/esperado.json). Xlsx::read($bytes)           → [['name' => …, 'hidden' => bool, 'rows' => [[…], …]], …]   hojas en el orden del libro

Secciones: `[XLSX]`

- `u16` (l. 18) — Entero de 16 bits little-endian en la posición o del texto binario (formato del zip).
- `u32` (l. 21) — Entero de 32 bits little-endian en la posición o del texto binario (formato del zip).
- `entries` (l. 24) — índice del contenido del zip por nombre: método, tamaño comprimido y posición de la cabecera local (del directorio central, al final del fichero)
- `text` (l. 42) — contenido de una entrada del zip (sin comprimir o deflate)
- `unesc` (l. 56) — entidades XML → texto (&amp; &lt; &#233; &#xE9;)
- `attrs` (l. 59) — atributos de una etiqueta XML: ' r="A1" t="s"' → ['r' => 'A1', 't' => 's']
- `tText` (l. 67) — texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta
- `colIndex` (l. 76) — letras de columna → posición: A=0, Z=25, AA=26
- `sheetRows` (l. 84) — celdas de una hoja → filas (ver cabecera)
- `read` (l. 123) — @return array<int,array{name:string,hidden:bool,rows:array}>
- `pick` (l. 148) — elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio

### `autoload.php`

Autocarga mínima de las clases Torivac\* (cada una vive en lib/; las auxiliares comparten fichero con su clase principal)

## `backend-php/api/tools/`

### `check.php`

[CHECK] Comprobación de la instalación desde la línea de comandos (Terminal de cPanel o SSH): php api/tools/check.php           revisa PHP, extensiones, carpeta de datos, config.php, correo, precios y primer manager php api/tools/check.php --net     además prueba la salida a Internet (Resend, Google, Anthropic)

Secciones: `[CHECK]`

### `create-user.php`

[CREATE-USER] Crea un usuario desde la línea de comandos (el primer manager, o clientes): php api/tools/create-user.php correo@dominio.com "Nombre Apellido" manager "contraseña de al menos 10 caracteres" Roles: manager (todo) · client (solo sus pedidos). La contraseña se guarda con password_hash.

Secciones: `[CREATE-USER]`

## `backend-php/api/tests/`

### `ApiTest.php`

Pruebas del API en PHP: equivalen a workers/api/test/api.test.js + ai.test.js (sin red: Resend, Google y Anthropic se simulan con Http::$mock)

- `test_auth_sessions` (l. 22) — Sesión firmada: válida, manipulada y caducada; la contraseña se guarda con hash.
- `test_users_and_login` (l. 36) — Alta de usuarios, duplicados, login (sin el hash en la respuesta) y bloqueo tras varios intentos.
- `test_prices_tiers_and_rounding` (l. 54) — Tramos por cantidad, importe de línea redondeado a 2 decimales y diferencias entre hojas de precios.
- `test_sheet_sync_rules` (l. 66) — Sincronización de la hoja: rechaza hojas con menos del 50 % de referencias o con precio de relleno salvo force; guarda el histórico.
- `test_csv_parser` (l. 87) — CSV con comillas, separadores dentro de comillas, BOM y separador coma o punto y coma.
- `test_google_jwt` (l. 94) — Token de la cuenta de servicio de Google: firma RS256 verificable con la clave pública.
- `test_order_flow_server_side_pricing` (l. 110) — Pedido: el servidor valora con sus precios (ignora los del cliente), numera, guarda y envía.
- `test_order_validation_and_limits` (l. 129) — Validación del pedido (campos, cantidades, referencias, PDF, honeypot) y límite por IP.
- `test_order_with_resend_driver` (l. 146) — Envío con Resend: destinatarios, copia al cliente, responder-a y PDF adjunto.
- `test_mime_builder` (l. 165) — Cuerpo MIME para mail(): texto y HTML, adjunto y cabeceras.
- `test_contact_and_cors` (l. 173) — Formulario de contacto y reglas CORS (origen ajeno, el propio sitio y preflight).
- `test_prices_endpoint_etag` (l. 191) — GET /prices: precios públicos con ETag (304) y `items` como objeto {} aunque esté vacío.
- `test_manager_upload_roles_and_cron` (l. 202) — Subida de hojas (vista previa y aplicar), permisos por rol, referencia nueva por regla de familia y cron por URL con token.
- `test_orders_visibility_and_users_api` (l. 230) — Un manager ve todos los pedidos y cada cliente solo los suyos; alta y baja de usuarios por el API.
- `ai_reply` (l. 253) — Servidor de IA simulado: contesta con una propuesta de cambios de precios (uso de herramienta de Anthropic).
- `test_ai_validation_and_flow` (l. 259) — IA de precios: valida y limita lo que propone; la propuesta no escribe nada y solo se aplica lo confirmado.
- `test_diag_checks` (l. 293) — Autodiagnóstico: una instalación a medias da errores que dicen qué arreglar, y una completa pasa sin fallos.
- `test_privacy_session_revocation_and_contact_escaping` (l. 320) — GET /prices: el público no ve quién cargó la hoja ni el id de Drive; un manager sí; un usuario borrado pierde la sesión; el contacto escapa el HTML.
- `test_http_client_follows_redirects_without_leaking_credentials` (l. 351) — Cliente HTTP real contra un servidor local: sigue redirecciones de los GET a mano, no manda la credencial a otro servidor y corta los bucles.

### `PriceSheetTest.php`

Pruebas de PriceSheet con los casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json)

- `fixtures` (l. 8) — Casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json).
- `test_price_sheet_cases` (l. 16) — Cada caso de hoja → precios, desconocidas, nuevas y filas ignoradas esperados.
- `test_price_sheet_numbers` (l. 41) — Números de celda: coma o punto decimal, miles, símbolos de moneda y texto ilegible.
- `test_price_sheet_errors` (l. 49) — Hojas sin cabecera reconocible o vacías: error claro.

### `XlsxTest.php`

Pruebas del lector de .xlsx con los mismos libros y el mismo resultado esperado que la versión JavaScript (shared/xlsx/)

- `xlsxDir` (l. 9) — Carpeta con los libros de ejemplo (solo existe en el repositorio completo).
- `test_xlsx_books_match_expected` (l. 16) — Los dos libros de ejemplo dan las hojas, el orden, las ocultas y las filas esperadas.
- `test_xlsx_pick_and_price_rules` (l. 28) — Elección de hoja (primera visible con cabecera o por nombre) y paso del libro por las reglas de precios.
- `test_xlsx_rejects_non_books` (l. 45) — Un fichero que no es un libro Excel da un error claro.
- `ttCtx` (l. 58) — Contexto de catálogo de las pruebas de tarifa: dos referencias TT y la regla de la familia TT.
- `setPrices` (l. 61) — Sustituye la configuración de precios de las pruebas.
- `test_sync_from_xlsx_url` (l. 64) — Sincronización desde la URL de un .xlsx: referencias nuevas por regla y desconocidas fuera.
- `test_sync_from_xlsx_sheet_name_and_bad_downloads` (l. 81) — Hoja elegida por nombre y errores de descarga (nombre inexistente, página en vez de libro, HTTP 404).
- `test_sync_service_account_sheets_then_drive_fallback` (l. 99) — Cuenta de servicio: hoja de Google por Sheets API; si es un .xlsx de Drive, respaldo con la API de Drive y errores si fallan las dos.

### `harness.php`

[TESTS] Mini arnés de pruebas sin dependencias (no hace falta PHPUnit en el hosting): php tests/run.php            ejecuta todas las pruebas de tests/*Test.php Cada fichero define funciones test_*; assertSame/assertTrue/assertThrows comparan y cuentan.

Secciones: `[TESTS]`

- `same` (l. 16) — Compara valor esperado y obtenido (como JSON) y cuenta acierto o fallo.
- `true` (l. 26) — Comprueba que una condición es cierta.
- `throws` (l. 34) — Comprueba que una función lanza una excepción cuyo mensaje cumple el patrón.

### `run.php`

Ejecuta todas las pruebas: php tests/run.php  (código de salida 1 si alguna falla)

### `support.php`

Preparación común de las pruebas: almacén temporal, configuración de pruebas, catálogo sintético y peticiones simuladas

- `fresh` (l. 15) — Almacén temporal nuevo, configuración y catálogo sintéticos de las pruebas.
- `prices` (l. 27) — Precios de ejemplo: TT0020210 con tramos y P16633.
- `seedPrices` (l. 33) — Guarda los precios de ejemplo en el almacén.
- `goodOrder` (l. 36) — Pedido válido de ejemplo (se puede sobrescribir cualquier campo).
- `req` (l. 42) — Petición simulada para llamar al Router sin servidor web.
- `wire` (l. 45) — cuerpo de una respuesta tal y como lo recibe un cliente (JSON → arrays): los `items` de precios viajan como objeto y en el servidor son stdClass
- `master` (l. 48) — Cabecera de autenticación con el token maestro.
- `outbox` (l. 51) — correos guardados por el controlador «file»

