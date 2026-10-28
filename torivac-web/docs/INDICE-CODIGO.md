# Índice de código (generado)

> Generado por `scripts/gen_code_index.py`. **No editar a mano**: se rehace con `python3 -I scripts/gen_code_index.py`.
> Cada archivo se describe por su cabecera; las secciones `[ETIQUETA]` marcan los bloques; cada función lleva su descripción (⚠ = falta describirla).
**Cobertura**: 1061/1061 funciones descritas (100 %) · 144/144 archivos con cabecera.


## `site/`

### `build.mjs`

[BUILD] Generador del sitio estático Torivac (demo).  Uso:  node site/build.mjs [--base=https://dominio] [--out=carpeta] Lee data/catalog/*.json (fuente única de verdad) y escribe dist/ (HTML por idioma + assets + datos para JS). Secciones: [LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS]

Secciones: `[BUILD]` · `[LOAD]` · `[CATS]` · `[PRODUCTS]` · `[SITE]` · `[EMIT]` · `[DATA]` · `[ASSETS]` · `[THEME]` · `[LIVE]` · `[OVERRIDES]` · `[ORIGINAL]` · `[SEO]` · `[WORKER]` · `[ADMIN]` · `[PRICE-SHEET]` · `[CSS]` · `[SEO-FILES]` · `[HOSTING]` · `[VERSIONES]`

- `arg0` (l. 20) — Valor de la opción `--k=valor` de la línea de comandos ('' si no se pasó).
- `arg` (l. 23) — Igual que arg0: valor de la opción `--k=valor` de la línea de comandos ('' si no se pasó).
- `jl` (l. 37) — Lee data/catalog/<f> como JSON; devuelve `d` si el archivo no existe o no es JSON válido.
- `normName` (l. 60) — Normaliza un nombre de categoría para detectar duplicados: minúsculas, sin tildes ni signos y con las palabras en singular.
- `depthOf` (l. 64) — Profundidad de una categoría en el árbol (0 = raíz), subiendo por `parent`.
- `canon` (l. 67) — Id de la categoría que se conserva tras fusionar duplicados (el mismo `id` si no se fusionó).
- `subtreeIds` (l. 101) — Ids de una categoría y de todas sus descendientes.
- `prodIdsOf` (l. 103) — Ids de los productos asignados a una categoría o a cualquiera de sus subcategorías.
- `visible` (l. 107) — Una categoría se muestra si tiene productos y su slug no está en la lista de ocultas (HIDE).
- `prune` (l. 109) — Quita (recursivo) las categorías no visibles y ordena cada nivel por nombre en español.
- `pth` (l. 130) — Ruta de una URL de grupotorivac.com con barra final, salvo que termine en una extensión de archivo.
- `pickCats` (l. 178) — Categorías visibles (ya fusionadas) de una lista de ids, en el mismo orden y sin repetir.
- `emit` (l. 201) — Escribe en dist el HTML de la ruta lógica `p` (como p/index.html si termina en barra) y suma una página al contador.
- `mkctx` (l. 203) — Contexto de render (Ctx) de la página `p` en el idioma `lang`; `section` marca el ítem activo del menú.
- `fitTitle` (l. 208) — título ≤ 65: «Nombre · Torivac» si cabe; si no, solo el nombre (recortado). Las categorías homónimas llevan el nombre del padre.
- `crumbHome` (l. 210) — Miga de pan «Inicio» del idioma `lang`: { name, path }.
- `crumbProducts` (l. 212) — Miga de pan «Productos» del idioma `lang`: { name, path }.
- `pickAlt` (l. 214) — Texto alt de una imagen en el idioma `lang` (español si falta; '' si no hay).
- `absImg` (l. 216) — URL absoluta de una imagen (solo con --base); null si no hay base o la imagen no tiene archivo.
- `alts` (l. 221) — Traducciones de la página `pagePath` ({ idioma: ruta }), solo las que existen en el sitio generado.
- `a` (l. 379) — Ruta relativa al recurso `s` desde /admin/ (assets del panel).
- `copyDir` (l. 393) — Copia recursivamente la carpeta `a` en `b`, creando los directorios que falten.
- `css` (l. 403) — Texto del archivo site/assets/css/<n>.css.
- `xml` (l. 423) — Escapa &, <, > y comillas para el XML del sitemap (null/undefined → '').
- `url` (l. 425) — Entrada <url> del sitemap de una página registrada: loc, enlaces hreflang (con x-default) e imágenes con alt.
- `sec` (l. 437) — Sección Markdown de llms.txt: encabezado `## título` y una línea por fila.
- `t` (l. 459) — Texto de interfaz `k` en el idioma del bucle (español si falta la traducción; la propia clave si no existe).
- `hashOf` (l. 477) — Huella (10 hex) del contenido del archivo `p` de dist/ (con caché); aborta si el archivo no existe.
- `walk` (l. 487) — Recorre dist/ y resuelve los marcadores de versión de cada .html.

### `templates.mjs`

[TEMPLATES] Plantillas HTML (funciones puras: datos → string). Cada una devuelve el <main> de su página; `layout()` lo envuelve con cabecera, pie, elementos flotantes y scripts. Datos: data/catalog/*.json (ver docs/ARQUITECTURA.md). Textos de interfaz: site/lib/i18n.mjs.

Secciones: `[TEMPLATES]` · `[ART]` · `[A11Y]` · `[META]` · `[LAYOUT]` · `[THEME]` · `[ORIGINAL]` · `[SEO-FILES]` · `[NAV]` · `[SOCIAL]` · `[SHARED]` · `[HOME]` · `[PAGES]` · `[BLOG]` · `[SHOP]` · `[PRODUCT]` · `[QUOTE]` · `[CONTACT]`

- `pick` (l. 12) — Valor de un campo traducible en el idioma `lang` (español si falta; '' si no hay objeto).
- `toroidArt` (l. 19) — Bobinado toroidal visto desde arriba (mismo motivo que el logotipo): 56 espiras que se «dibujan» al entrar en pantalla (CSS + IntersectionObserver en app.js).
- `waveLab` (l. 28) — Osciloscopio esquemático de un variador de tensión: la onda de salida (cobre) se reduce al mover el mando; la de entrada (230 V) queda fija. JS: assets/js/lab.js
- `headingOrder` (l. 48) — El contenido original salta de nivel (H1→H4). Se corrige en la ACCESIBILIDAD (aria-level) sin tocar la etiqueta, así el diseño no cambia:
- `metaDescription` (l. 61) — Usa la descripción original si es útil; si no, el primer párrafo real de la página (sin inventar nada); como último recurso, una frase genérica de marca.
- `ok` (l. 63) — Una descripción sirve si tiene al menos 50 caracteres y no es solo signos o cifras.
- `cssGuard` (l. 74) — Aviso para el demo (solo sin --base): si la página se abre sin sus hojas de estilo (p. ej. index.html dentro del .zip sin extraer), enseña arriba cómo abrirla bien.
- `oc` (l. 86) — Con selector de aspecto, el HTML lleva los elementos de los tres aspectos y cada hoja de estilos muestra los suyos (los del resto, con `display:none`).
- `lbl` (l. 88) — Rótulo que cambia según el aspecto: sin «Original», el de siempre; solo «Original», el de la web actual; con selector, los dos (cada hoja muestra uno). Los textos ya vienen escapados.
- `oHref` (l. 90) — Dirección a la que apunta una tarjeta o un enlace de categoría: en «Original» solo, una categoría hoja con UN producto lleva directa a ese producto (la web actual la redirige).
- `floatMenu` (l. 92) — Menú flotante «Productos-Torivac»: pestaña en el borde izquierdo que abre un panel oscuro con las categorías (dos niveles, en el orden de la web actual). Nace oculto: app.js lo muestra (sin JS no serviría).
- `themeSwitch` (l. 111) — Selector de aspecto: dos botones con aria-pressed. Nace oculto (sin JS no serviría de nada); assets/js/app.js lo muestra, marca el activo y guarda la elección. `where` distingue el de la cinta y el del pie.
- `layout` (l. 114) — Envuelve `hero` + `body` en la página HTML completa (SEO, cabecera, pie, presupuesto, scripts) y la registra para el sitemap.
- `alt` (l. 117) — selector de idioma: sin traducción cae a la portada de ese idioma
- `crumbs` (l. 204) — Migas de pan (nav + ol): todas enlazadas salvo la última, que lleva aria-current=page.
- `vtext` (l. 207) — Texto de un campo traducible (objeto por idioma o cadena) en el idioma `lang`, con respaldo al español.
- `vtags` (l. 209) — Fila de etiquetas de tensión (hasta `limit`) de un producto; '' si no hay ninguna conocida.
- `productCard` (l. 220) — Tarjeta de un producto del listado: foto, nombre, etiquetas de tensión y nº de referencias, con data-* para filtrar.
- `catTree` (l. 234) — árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
- `holds` (l. 237) — Indica si la categoría `c` es la activa o contiene a la activa entre sus descendientes.
- `link` (l. 239) — Enlace a una categoría con su nombre y su nº de productos; marca aria-current si es la activa.
- `walk` (l. 241) — Lista anidada del árbol de categorías; abre (data-open) las ramas que contienen la activa.
- `cut` (l. 248) — Texto recortado a `max` caracteres en el último espacio (sin partir palabras) y con «…» si se ha recortado; `max` Infinity = íntegro.
- `categoryCards` (l. 250) — tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original
- `fold` (l. 266) — algunas descripciones originales son copia de otra categoría (ver docs/01-analisis/HALLAZGOS.md #3): en la tarjeta solo se usa si comparte alguna palabra significativa con el nombre
- `oSecImg` (l. 279) — «Original»: atributo style con la foto de fondo de una sección (los trazos del logotipo de la web actual), en una variable que solo pinta la hoja de ese aspecto. Una URL dentro de una variable se resuelve desde la hoja que la usa (assets/css/site.css), de ahí «../media/…» y no la ruta de la página.
- `homeBody` (l. 281) — Portada: devuelve { hero, body, heroImg } con el hero, cinco secciones (fotos, servicios, catálogo), el formulario de contacto y la URL de la foto de portada (se precarga en la cabecera: es el elemento más grande de la primera pantalla).
- `text` (l. 285) — Bloques de título y párrafo de una sección (hoy sin uso en homeBody).
- `imgs` (l. 287) — Bloques de imagen de una sección.
- `btn` (l. 289) — Primer bloque de botón de una sección (undefined si no tiene).
- `oh` (l. 296) — «Original»: clase que engancha cada sección de la portada con la hoja de la web actual (sin «Original» no se emite y el HTML sale idéntico)
- `oBg` (l. 298) — «Original»: variable con la foto de fondo de una sección de la portada.
- `eyebrowAndHead` (l. 307) — HTML del antetítulo (encabezado de nivel 4 o más) y del título h2 (nivel 3 o menos) de una sección.
- `paras` (l. 313) — HTML de los párrafos de una sección, con los enlaces internos reescritos.
- `bt` (l. 315) — Enlace-botón (clase btn + `cls`) del botón de una sección; '' si no tiene.
- `waveSvg` (l. 344) — onda de tensión animada (SVG) — elemento gráfico base del hero
- `cardsHtml` (l. 352) — «Original»: bloques de una sección de tarjetas (Misión, Visión, Valores…) con cada icono y el texto que le sigue dentro de su propia tarjeta; lo que va antes del primer icono (título) queda fuera. Los otros aspectos ven el mismo flujo, solo con un div más.
- `isIcon` (l. 354) — Indica si el bloque es un icono pequeño (60 × 60) y no una foto.
- `sectionsHtml` (l. 363) — Secciones de una página genérica en HTML (texto, foto o carrusel, fondo oscuro, formulario de contacto), alternando el fondo. Con «Original», cada sección lleva además clases según cómo la maqueta la web actual (site.oSections, por id de sección de Elementor, igual en los cuatro idiomas).
- `cls` (l. 368) — Clases de la sección: las de siempre y, con «Original», las del tipo, el lado de la foto y el arte de fondo.
- `isPhoto` (l. 372) — los iconos pequeños se quedan dentro del texto
- `genericPage` (l. 398) — Página genérica (empresa, proyectos, legales…): devuelve { hero, body, title }; el primer encabezado pasa a h1 del hero.
- `contactBlockO` (l. 420) — «Original»: bloque «Contacta con nosotros» (texto de la portada y formulario) que la web actual repite al pie de cada ficha de producto y de cada entrada del blog; '' si la portada no lo trae. `where` hace únicos los ids del formulario; `wrap` lo mete en un `container` (en las fichas ya va dentro de uno).
- `blogIndexBody` (l. 430) — Listado del blog: tarjetas con imagen, fecha, título y extracto (150 caracteres) de cada entrada.
- `postBody` (l. 436) — Entrada de blog: devuelve { hero, body } con migas, h1, fecha y el contenido sin su H1 original.
- `shopBody` (l. 453) — Listado de productos (tienda o categoría): barra lateral con categorías, tensiones y búsqueda, subcategorías y tarjetas.
- `productBody` (l. 492) — Ficha de producto: galería, etiquetas de tensión, descripción, fichas PDF, tabla de modelos con cantidades y relacionados.
- `quoteBody` (l. 556) — Página del presupuesto: tabla del pedido, carga de CSV/Excel y formulario de datos para enviarlo o descargar el PDF.
- `contactForm` (l. 584) — Formulario de contacto accesible (nombre, email, mensaje, privacidad y campo trampa antispam); `where` hace únicos los ids.
- `contactIntro` (l. 600) — introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio)
- `contactPageOriginal` (l. 605) — «Original»: página de contacto como la de la web actual: recuadro blanco con sombra naranja y el formulario a la izquierda; a la derecha el texto y los datos (dirección, teléfono, correo) con su icono. `blocks` son los textos de la página sin el título (que es el h1); `logo` es la foto del logotipo si la página la trae y `bg` la del fondo de la sección (trazos del logotipo). Con selector de aspecto va aparte del bloque de siempre (el formulario lleva otros ids).
- `plainOf` (l. 610) — Texto de un párrafo sin etiquetas.
- `li` (l. 617) — Fila de datos de contacto («Original»): icono, texto y enlace de teléfono o correo según el tipo.
- `lv2` (l. 620) — Encabezados de un trozo de HTML con aria-level 2.

## `site/lib/`

### `hosting.mjs`

[HOSTING] Archivos de servidor para publicar en un hosting con cPanel o Plesk (Apache o LiteSpeed; en Plesk, con PHP servido por Apache): .htaccess, robots.txt de pruebas y 404 por idioma. Se generan solo con --base (producción o dominio de pruebas); la compilación de demostración (doble clic) no los necesita. htaccess({ base, staging, aliases, pdfRedirects, apiOrigin, phpApi, langs })  → texto del .htaccess de la raíz

Secciones: `[HOSTING]`

- `rx` (l. 10) — Escapa un texto para usarlo literal dentro de una expresión regular de Apache.
- `basePathOf` (l. 13) — ruta base del sitio: «https://x.com/prueba/» → «/prueba» («» si está en la raíz del dominio)
- `htaccess` (l. 16) — Genera el .htaccess de la raíz: HTTPS, host único, 301 de URLs antiguas, caché, cabeceras de seguridad (CSP), noindex en pruebas y reescritura de /api.
- `langHtaccess` (l. 61) — .htaccess de /en, /fr, /de: solo cambia la página 404 para que se muestre en el idioma de la sección
- `robotsTxt` (l. 64) — Genera robots.txt: en pruebas prohíbe todo; en producción permite el sitio, cierra /admin/ y /api/ y enlaza el sitemap.

### `i18n.mjs`

[I18N] Textos de interfaz del demo en los 4 idiomas. Solo textos NUEVOS de la experiencia de pedido (presupuesto, filtros, formulario…): el contenido del sitio viene tal cual de la web original. Cada clave existe en es/en/fr/de. El idioma por defecto del sitio es 'es' (raíz); en/fr/de viven bajo /en /fr /de.

Secciones: `[I18N]`

- `countLabel` (l. 130) — «1 producto / 2 productos» en los 4 idiomas
- `refLabel` (l. 132) — «1 referencia / 2 referencias» en los 4 idiomas.
- `t` (l. 134) — Texto de interfaz de la clave `key` en el idioma `lang` (español si falta; la propia clave si no existe).

### `render.mjs`

[RENDER] Utilidades del generador: escape, rutas relativas, enlaces internos, bloques semánticos → HTML. RUTAS: el demo se puede abrir con doble clic (file://). Por eso todos los enlaces internos son RELATIVOS y terminan en index.html. Las URLs lógicas (las mismas que la web original: /product/x/, /en/…) se conservan como estructura

Secciones: `[RENDER]`

- `esc` (l. 11) — Escapa &, <, > y comillas dobles para insertar texto en HTML o en atributos.
- `dirOf` (l. 15) — ruta lógica de página ('/en/product/x/') → carpeta de salida relativa a dist ('en/product/x')
- `setCleanUrls` (l. 20) — Activa (producción) o desactiva (demo con file://) las URLs sin index.html que genera rel().
- `rel` (l. 22) — URL relativa desde la página `from` hasta la página lógica `to` (+hash opcional).
- `setVersionedAssets` (l. 32) — Activa (servidor real) o desactiva (demo con file://) el marcador de versión en las URLs de CSS y JS.
- `asset` (l. 34) — URL relativa a un asset ('assets/css/x.css') desde la página `from`; los .css y .js llevan el marcador de versión si está activado.
- `mapLink` (l. 50) — Reescribe un enlace de la web original a su equivalente local (página, PDF) o lo deja absoluto.
- `inlineHtml` (l. 69) — HTML inline de un bloque (los enlaces internos se reescriben).
- `hText` (l. 78) — Texto de un encabezado. Con «Original» conserva los saltos de línea del original (cuando los tiene); sin «Original», el texto de siempre.
- `cellText` (l. 81) — Texto de una celda o del título de una tabla. Con «Original» se conserva el salto de línea y la cursiva de la web actual (castellano arriba y la traducción debajo); sin «Original», el texto de siempre.
- `tbl` (l. 84) — Bloque de tabla → HTML: detecta la cabecera, usa una primera fila de una sola celda como título y añade región con scroll.
- `cell` (l. 89) — Celda th/td con el texto escapado; las th dentro del cuerpo llevan scope="row".
- `blocksHtml` (l. 98) — Bloques semánticos → HTML. opts.demote: sube el nivel de los encabezados (h1→h2…) para que la plantilla sea dueña del h1.
- `plain` (l. 136) — Texto plano de una lista de bloques (encabezados, párrafos sin etiquetas y listas), con los espacios normalizados.
- `fmtDate` (l. 139) — Fecha ISO → fecha larga localizada según el idioma (p. ej. «12 de marzo de 2024»).
- `writeFile` (l. 142) — Escribe `content` en root/p creando las carpetas intermedias que falten.

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
- `jsonScript` (l. 81) — Bloque de datos <script type="application/json" id="…"> (no se ejecuta: la CSP de producción puede prohibir TODO script en línea). Escapa < y los separadores U+2028/2029.

### `themes.mjs`

[THEMES] Aspectos de la web (fuente única): lista, orden en el selector y script de arranque que aplica el elegido ANTES del primer pintado. Ver docs/DISENO-TEMAS.md. Para añadir un aspecto: añadirlo aquí, su hoja en site/build.mjs [CSS] y su texto `theme_<nombre>` en site/lib/i18n.mjs. Aspectos disponibles, en el orden del selector. El primero es el que se publica por defecto salvo que se pida otro con --theme.

Secciones: `[THEMES]` · `[CSS]`

- `themeBootJs` (l. 8) — Script de la cabecera (solo con selector de aspecto): aplica ?tema=<aspecto> o la elección guardada (localStorage `tv-theme`) antes de pintar, sin parpadeo. Es constante: la CSP lo admite por su huella (ver site/lib/hosting.mjs).

## `site/assets/js/`

### `admin-live.js`

[ADMIN-LIVE] Panel de gestión de Torivac CONECTADO AL WORKER (producción). Mismo aspecto que el demo (admin.css), datos y acciones reales. Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Usuarios · Estadísticas · Ajustes cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas

Secciones: `[ADMIN-LIVE]` · `[HTTP]` · `[AUTH]` · `[UTIL]` · `[VIEWS]` · `[PRICES]` · `[AI]` · `[USERS]` · `[PROPOSALS]` · `[ROUTER]`

- `esc` (l. 17) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `money` (l. 19) — Importe formateado con la divisa y el idioma de la página (Q.money); un valor vacío cuenta como 0.
- `http` (l. 23) — method + ruta + cuerpo → Promise<{ok, status, …}>. Un 401 cierra la sesión (token caducado). Nunca rechaza: los errores de red vuelven como {ok:false}.
- `session` (l. 32) — Sesión actual {token, email, name, role} o null. El rol del servidor ('client') se muestra como 'cliente'.
- `login` (l. 34) — Entra con correo y contraseña. Devuelve Promise<string|null>: null si ha ido bien, o el mensaje de error.
- `endSession` (l. 42) — Borra la sesión de este navegador y vuelve a la pantalla de acceso (sin avisar al servidor: lo usa también un 401, cuando el servidor ya la ha dado por caducada).
- `logout` (l. 44) — Cierra la sesión: el servidor invalida TODOS los tokens anteriores de esta persona (POST /api/auth/logout; si no responde, igualmente se sale de este navegador).
- `adminData` (l. 49) — Propuestas de cambio y datos de cobertura del catálogo, solo para managers (GET /api/admin/data); se piden una vez y se guardan en TV.proposals y TV.admin. Nunca rechaza.
- `toast` (l. 56) — Muestra un aviso breve (3,2 s) en pantalla.
- `kpi` (l. 58) — HTML de una tarjeta KPI con la etiqueta `l` y el valor `v`, ambos escapados.
- `itemName` (l. 60) — Nombre legible de una referencia (nombre ES + ref si es un modelo concreto).
- `when` (l. 62) — Fecha y hora local (es-ES) de una fecha ISO; «—» si viene vacía.
- `download` (l. 64) — Descarga `blob` como archivo `name` con un enlace temporal y libera la URL a los 800 ms.
- `fail` (l. 66) — Aviso de error del servidor con el mensaje devuelto.
- `V.resumen` (l. 77) — Vista Resumen (manager): con datos del Worker, KPIs, estado de la hoja de precios y sincronización, y los 5 últimos pedidos.
- `ordersView` (l. 89) — Tabla de pedidos (manager: todos · cliente: solo los suyos, lo filtra el servidor).
- `V.pedidos` (l. 98) — Vista Pedidos (manager): tabla de todos los pedidos que devuelve el Worker.
- `V.mis` (l. 100) — Vista «Mis presupuestos» (cliente): sus propios pedidos; el filtro por usuario lo aplica el servidor.
- `V.lista` (l. 103) — Vista Lista de precios (cliente): precios vigentes del Worker, sin IVA, con sus tramos (hasta 600 referencias).
- `V.presupuestador` (l. 112) — Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1.
- `V.contenido` (l. 115) — Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto.
- `cell` (l. 118) — Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir).
- `V.estadisticas` (l. 124) — Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras.
- `V.ajustes` (l. 130) — Vista Ajustes (manager): datos de la sesión (GET /api/auth/me), dónde se configuran los destinatarios del pedido y, con el API PHP, su autodiagnóstico (GET /api/diag).
- `modeBox` (l. 142) — Selector de lo que hace la hoja subida: actualizar solo lo que trae (por defecto; puede ser una parte del catálogo) o reemplazar toda la lista de precios.
- `V.precios` (l. 148) — Vista Precios (manager): estado y sincronización de la hoja, subida de Excel/CSV con vista previa e instrucción a la IA.
- `previewUpload` (l. 159) — Filas (cabecera + datos) → vista previa de diferencias contra los precios vigentes (el servidor calcula la diferencia con el modo elegido; no se aplica nada).
- `list` (l. 165) — Filas HTML (máx. 60) de las referencias `arr`, cada una con su producto y la etiqueta `kind`.
- `readUpload` (l. 177) — Lee el archivo subido (Excel o CSV) en el navegador y pide la vista previa.
- `go` (l. 180) — Pide la vista previa de las filas leídas, etiquetándola con el nombre del archivo.
- `applyUpload` (l. 185) — Publica la hoja subida (POST /api/prices/upload, con `force` si se marcó la casilla) y repinta; sin borrador no hace nada.
- `runPrompt` (l. 199) — Envía la instrucción a la IA (POST /api/prices/ai) y muestra la propuesta de cambios para confirmarla; no aplica nada.
- `applyProposal` (l. 215) — Aplica la propuesta vigente de la IA (POST /api/prices/ai/apply, confirmando los cambios grandes si se marcó) y repinta.
- `V.propuestas` (l. 224) — Vista Propuestas (manager): lista las propuestas de cambio con su estado en el servidor para aprobar, rechazar o deshacer.
- `V.usuarios` (l. 239) — Vista «Usuarios» (manager): lista de usuarios con alta y baja de managers y clientes.
- `onClick` (l. 249) — Manejador único de clics del panel (delegación de eventos): salir, sincronizar precios, aplicar o descartar cambios, propuestas, usuarios y PDF.
- `bind` (l. 267) — Eventos de la vista Precios (subida por arrastre) y del formulario de usuarios; se enlazan tras pintar cada vista.
- `render` (l. 286) — Pinta la pantalla de acceso o el panel (menú lateral + la vista de la ruta #hash); `renderSeq` descarta la respuesta de una vista si entretanto se pidió otra.

### `admin-report.js`

[ADMIN-REPORT] Informe de lectura de una hoja de precios para la vista previa del panel: columnas reconocidas, avisos, referencias nuevas y filas que no se publican. Lo comparten admin.js (demo, en el navegador) y admin-live.js (real, el informe viene del servidor). Sin dependencias. TV.priceReportHtml(report, esc) → HTML ('' si no hay informe)

Secciones: `[ADMIN-REPORT]`

- `TV.priceReportHtml` (l. 13) — HTML del informe de lectura de la hoja (columnas, avisos y listas plegables); `esc` escapa el texto; '' sin informe.
- `list` (l. 28) — Bloque <details> con `title` y hasta 40 elementos formateados con `fmt` (añade «…» si hay más); '' si la lista está vacía.

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
- `modeBox` (l. 46) — Selector de lo que hace la hoja subida: actualizar solo lo que trae (por defecto; puede ser una parte del catálogo) o reemplazar toda la lista de precios.
- `rowsToPrices` (l. 52) — Hoja → precios con las MISMAS reglas que el servidor (TV.PriceSheet = shared/price-sheet.mjs): cabeceras tolerantes, SKU, referencias nuevas por regla, avisos.
- `diffPrices` (l. 61) — Compara la hoja vigente `a` con la nueva `b`: {added, changed, removed} como [ref, antes, después] y same = nº sin cambios.
- `itemName` (l. 68) — Nombre en español de la referencia (con el código si es un modelo concreto); sin ficha devuelve la propia referencia.
- `toast` (l. 70) — Muestra el aviso flotante #toast con el mensaje `m` durante 2,6 s.
- `download` (l. 72) — Descarga `blob` como archivo `name` con un enlace temporal y libera la URL a los 800 ms.
- `orders` (l. 74) — Pedidos de la demo guardados en localStorage (tv_orders); [] si no hay.
- `V.resumen` (l. 84) — Vista Resumen (manager): KPIs de pedidos, mensajes y propuestas, estado de la hoja de precios y las 5 referencias más pedidas.
- `kpi` (l. 96) — HTML de una tarjeta KPI con la etiqueta `l` y el valor `v`, ambos escapados.
- `V.pedidos` (l. 99) — Vista Pedidos (manager): tabla de los pedidos de la demo, los más recientes primero, con PDF por pedido, exportar y borrar.
- `V.mis` (l. 106) — Vista «Mis presupuestos» (cliente): la tabla de Pedidos con otro título.
- `V.precios` (l. 109) — Vista Precios (manager): estado de la hoja, actualizar o restaurar, subida de Excel/CSV e instrucción en castellano.
- `V.lista` (l. 118) — Vista Lista de precios (cliente): precios unitarios y tramos de las primeras 400 referencias con precio.
- `V.propuestas` (l. 124) — Vista Propuestas (manager): diferencias entre la web y los PDFs para aprobar o rechazar una a una (estado en localStorage).
- `V.contenido` (l. 135) — Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto.
- `cell` (l. 138) — Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir).
- `V.estadisticas` (l. 144) — Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras.
- `V.ajustes` (l. 151) — Vista Ajustes (manager): destinatarios del pedido y usuarios de la demo.
- `V.presupuestador` (l. 157) — Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1.
- `showDraft` (l. 164) — Guarda `next` como borrador y pinta su vista previa contra los precios vigentes, con el informe `report` y Aplicar/Descartar.
- `rowsOf` (l. 167) — Filas HTML (máx. 60) de las diferencias `arr` [ref, antes, después], con la etiqueta `kind`.
- `applyDraft` (l. 174) — Aplica el borrador de precios: lo guarda como hoja del panel (tv_prices_override), actualiza la web, avisa y repinta.
- `readUpload` (l. 176) — Lee la hoja subida (Excel con SheetJS o CSV) y muestra su vista previa como borrador de precios.
- `go` (l. 179) — Convierte las filas leídas en un borrador de precios y lo muestra; si la hoja no se puede leer, avisa con el error.
- `itemHaystack` (l. 186) — Texto en el que se busca una referencia: su nombre, su categoría y su código, normalizado.
- `targetMatches` (l. 188) — ¿Encaja `ref` con el objetivo? Vacío o «todo» sí; si no, cada palabra del objetivo debe estar en su nombre, categoría o código.
- `parsePrompt` (l. 193) — Traduce la instrucción en castellano a reglas {op: pct|abs|round|unknown, val, dec, target}; lo ininteligible va como unknown.
- `runPrompt` (l. 206) — Aplica la instrucción a una copia de los precios y muestra la vista previa; avisa de los fragmentos que no entiende.
- `f` (l. 216) — Aplica la regla `r` a un precio `v`: porcentaje, suma o resta fija, o redondeo; otra operación lo deja igual.
- `bind` (l. 227) — Conecta los eventos de la vista recién pintada (zona de arrastre del Excel/CSV, botones y formularios).
- `onClick` (l. 234) — Gestor único de clics del panel (delegado en #admin-root): salir, precios, instrucción, borrador, propuestas, PDF y pedidos.
- `render` (l. 248) — Pinta la pantalla de acceso (sin sesión) o el panel con menú lateral y la vista de la ruta #hash según el rol.

### `app.js`

[APP] Comportamiento común a todas las páginas. Secciones: [UTIL] · [MENU] menú móvil · [DRAWER] cajón del presupuesto · [FAB] botones flotantes · [LANG] idioma (detección + selector manual) · [THEME] aspecto · [ORIGINAL] menú flotante del aspecto «Original» · [PRICE-STAMP] Depende de: quote.js (TV.Quote). Sin librerías.

Secciones: `[APP]` · `[UTIL]` · `[MENU]` · `[DRAWER]` · `[FAB]` · `[LANG]` · `[THEME]` · `[ORIGINAL]` · `[PRICE-STAMP]` · `[EMBED]` · `[TREE]` · `[ART]`

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
- `paint` (l. 144) — Muestra los selectores (sin JS no hay botones inútiles) y marca como pulsado el del aspecto activo.
- `setOpen` (l. 158) — Abre o cierra el panel de categorías (y lo anuncia a los lectores de pantalla).
- `stamp` (l. 171) — Pinta la marca «DEMO» (solo con precios de demostración) y la fecha de los precios.

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
- `sendDemo` (l. 120) — Demo sin servidor: descarga el PDF, guarda el pedido en localStorage y ofrece un borrador de correo (mailto:).

### `quote.js`

[QUOTE-ENGINE] Motor del presupuesto/pedido de Torivac. Sin dependencias. Funciona con file:// (los datos llegan como variables globales: TV.items, TV.prices, TV.i18n). Secciones:  [STATE] estado persistente · [FORMAT] formato de importes · [PRICES] precios y tramos · [API] TorivacQuote · [REFRESH] actualización manual de precios

Secciones: `[QUOTE-ENGINE]` · `[STATE]` · `[FORMAT]` · `[PRICES]` · `[API]` · `[REFRESH]` · `[OVERRIDE]` · `[CSV]` · `[LIVE]`

- `own` (l. 20) — ¿`k` es una clave PROPIA de `o`? (con `o[k]` a secas, «constructor», «__proto__» o «toString» pasarían por referencias válidas)
- `applyOverride` (l. 25) — En producción la hoja de Drive manda (servidor + cron 24 h); aquí `tv_prices_override` hace de "hoja viva" para poder probar el flujo Excel → web.
- `mergeSheetItems` (l. 30) — La hoja de precios puede traer referencias nuevas dentro de un producto (prices.items[ref] = {p, n, pid}): se suman a TV.items para poder presupuestarlas (x:1 = viene de la hoja).
- `clean` (l. 50) — Las referencias que la hoja de precios añade (x:1) llegan con los precios, después de cargar esto: no se puede exigir que ya estén en TV.items. Solo se descartan las que no son texto y los nombres de Object.prototype.
- `load` (l. 52) — Carga las líneas del presupuesto de localStorage; con file:// manda la copia de window.name si es más reciente.
- `save` (l. 59) — Guarda las líneas y su marca de tiempo en localStorage (si falla, quedan en memoria) y, con file://, una copia en window.name.
- `emit` (l. 65) — Guarda el presupuesto y avisa del cambio `detail` a los oyentes registrados y con el evento tv:quote del documento.
- `buildFormats` (l. 74) — Crea los formateadores de moneda (importes a 2 decimales, precios unitarios de 2 a 4) con la divisa de los precios o EUR.
- `money` (l. 81) — Formatea un importe (2 decimales) en la divisa y el idioma de la página.
- `unitMoney` (l. 83) — Formatea un precio unitario (de 2 a 4 decimales) en la divisa y el idioma de la página.
- `t` (l. 85) — Texto de interfaz `key` en el idioma de la página (TV.i18n); si no existe devuelve la propia clave.
- `rel` (l. 87) — ruta relativa a una página lógica (/en/product/x/) desde la página actual
- `assetUrl` (l. 92) — Ruta relativa al archivo `a` del sitio desde la página actual (antepone tantos «../» como niveles indica data-path).
- `priceOf` (l. 96) — precio unitario aplicable a `qty` unidades de `ref` (null = sin precio → "consultar")
- `tiersOf` (l. 104) — Tramos de precio por cantidad de `ref` como [[cantMin, precio], …]; [] si no tiene.
- `round2` (l. 106) — Redondea a 2 decimales compensando el error de coma flotante.
- `qtyOf` (l. 109) — Cantidad de una celda CSV/Excel: entero ≥ 0; «1.000» y «1,000» son mil (millares), «12,0» es doce; 0 si no se entiende.
- `lines` (l. 119) — Copia de las líneas del presupuesto [{ref, qty}]; modificarla no altera el estado.
- `count` (l. 121) — Total de unidades del presupuesto (suma de las cantidades de todas las líneas).
- `kinds` (l. 123) — Número de referencias distintas (líneas) del presupuesto.
- `has` (l. 125) — Indica si el presupuesto ya tiene una línea con la referencia `ref`.
- `add` (l. 127) — Suma `qty` unidades de `ref` (crea la línea si falta); false si la referencia no existe o la cantidad no es válida.
- `set` (l. 134) — Fija la cantidad de `ref`: 0 elimina la línea y, si la línea no existía, equivale a añadirla.
- `remove` (l. 142) — Elimina la línea de `ref` (fija su cantidad a 0).
- `clear` (l. 144) — Vacía el presupuesto y avisa del cambio.
- `detail` (l. 146) — líneas detalladas + total (solo suma las que tienen precio)
- `onChange` (l. 157) — Registra `fn(detail)` para que se llame en cada cambio del presupuesto o de los precios.
- `applyOverride` (l. 159) — Reaplica los precios cargados desde el panel, rehace los formatos y avisa a la página (evento tv:prices y cambio «prices»).
- `label` (l. 162) — nombre de línea listo para mostrar
- `shownRef` (l. 164) — referencia visible (las líneas genéricas P#### no se muestran como referencia)
- `importRows` (l. 166) — importa filas {ref, qty}: devuelve {added, unknown[]}
- `base` (l. 182) — URL base del Worker de la API (TV.meta.api) sin barras finales; cadena vacía si no hay API.
- `live` (l. 184) — Indica si hay API de producción configurada (false = modo demo, con el envío simulado).
- `post` (l. 186) — POST JSON a `path` de la API; devuelve siempre una Promise con la respuesta y su `status` (los fallos vuelven como {ok:false}).
- `TV.loadLivePrices` (l. 195) — El snapshot de la compilación (assets/data/prices.js) es solo el respaldo: con TV.meta.api manda lo que devuelva GET /api/prices (hoja de Drive, cada 24 h o al pulsar «actualizar»).
- `TV.csvParse` (l. 206) — Lector CSV (RFC 4180): texto → filas de celdas; detecta el separador , o ; en la 1.ª línea, admite comillas y quita el BOM.
- `TV.refreshPrices` (l. 224) — Recarga los precios a mano: del servidor si hay API; en la demo, volviendo a cargar assets/data/prices.js.
- `n.onload` (l. 231) — Al cargar el script de precios recién pedido: reaplica el override, rehace formatos, avisa del cambio y resuelve con true.
- `n.onerror` (l. 233) — Si falla la carga del script de precios, resuelve la promesa con false.

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

### `ficha-tokens.css`

[FICHA-TOKENS] Aspecto «Ficha técnica» (el nuevo, por defecto): papel de documentación, tinta y UN solo acento: el cobre, que es el material del bobinado.

Secciones: `[FICHA-TOKENS]`

### `ficha.css`

[FICHA] Aspecto «Ficha técnica»: la web como una hoja de datos impresa. Papel mate, tinta, UN acento (cobre), filetes visibles, ángulos rectos, titulares en Archivo extendida

Secciones: `[FICHA]` · `[BASE]` · `[BUTTONS]` · `[HEADER]` · `[HERO]` · `[SECTIONS]` · `[CATALOG]` · `[PRODUCT]` · `[TABLES]` · `[FORMS]` · `[QUOTE]` · `[BLOG]` · `[FOOTER]` · `[ART]` · `[SWITCH]` · `[PRINT]`

### `fonts-ficha-files.css`

[FONTS-FICHA-FILES] Las mismas como ARCHIVOS woff2 (producción por http). Generado por scripts/inline_fonts.py

Secciones: `[FONTS-FICHA-FILES]`

### `fonts-ficha.css`

[FONTS-FICHA] Archivo extendida + Chivo Mono (OFL) del aspecto «Ficha técnica», en base64 para file://. Generado por scripts/inline_fonts.py

Secciones: `[FONTS-FICHA]`

### `fonts-files.css`

[FONTS-FILES] Mismas fuentes como ARCHIVOS woff2 (producción por http: cacheables y sin bloquear el pintado). Generado por scripts/inline_fonts.py

Secciones: `[FONTS-FILES]`

### `fonts-original-files.css`

[FONTS-ORIGINAL-FILES] La misma como ARCHIVO woff2 (producción por http). Generado por scripts/inline_fonts.py

Secciones: `[FONTS-ORIGINAL-FILES]`

### `fonts-original.css`

[FONTS-ORIGINAL] PT Sans negrita (OFL) del aspecto «Original», en base64 para file://. Generado por scripts/inline_fonts.py

Secciones: `[FONTS-ORIGINAL]`

### `fonts.css`

[FONTS] Advent Pro + Archivo (OFL), en base64 para que funcionen también con file://. Generado por scripts/inline_fonts.py

Secciones: `[FONTS]`

### `layout.css`

[LAYOUT] cabecera, héroe, secciones, pie, disposición con barra lateral, elementos flotantes cinta de demo (centrada; si lleva el selector de aspecto, este va a su lado)

Secciones: `[LAYOUT]` · `[THEME-SWITCH]` · `[ORIGINAL]`

### `original-tokens.css`

[ORIGINAL-TOKENS] Aspecto «Original»: la web actual de grupotorivac.com (cabecera y pie negros, naranja cobre, Advent Pro, Archivo, PT Sans en menú y títulos de tarjetas),

Secciones: `[ORIGINAL-TOKENS]`

### `original.css`

[ORIGINAL] Aspecto «Original»: la web actual de grupotorivac.com tal como es (cabecera y pie negros, naranja cobre, Advent Pro, Archivo, tarjetas blancas, fichas con galería y tablas naranjas),

Secciones: `[ORIGINAL]` · `[BASE]` · `[HEADER]` · `[FOOTER]` · `[BUTTONS]` · `[FLOAT]` · `[SHOP-ROOT]` · `[CATEGORY]` · `[LISTING]` · `[PRODUCT]` · `[TABLES]` · `[RELATED]` · `[CONTACT]` · `[HOME]` · `[PAGES]` · `[QUOTE]` · `[MOBILE]`

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

Regenera los CSS de fuentes a partir de site/assets/fonts/*.woff2 (ver la cabecera de cada CSS).    fonts.css / fonts-files.css              Advent Pro + Archivo (aspecto «Clásico»): en base64 (también con file://) y como archivos woff2 (producción)

- `face` (l. 28) — Regla @font-face de la familia `fam` con el rango de pesos `weight`, el origen `src` (url(...)) y el rango Unicode `rng`.
- `write` (l. 33) — Escribe <name>.css (base64) y <name>-files.css (archivos woff2) con las familias de `faces`.

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

### `make_ficha_fonts.py`

Genera las dos fuentes del tema «Ficha técnica» a partir de los paquetes de Fontsource (licencia OFL).    · archivo-expanded-latin-wght-normal.woff2  Archivo con el ancho fijado al 125 % (extendida) y peso variable 600-900: solo titulares grandes (~25 KB).

- `option` (l. 20) — Valor de `--nombre=valor` en la línea de comandos (None si falta).
- `instance` (l. 28) — Guarda en `out` la fuente variable `src` con los ejes recortados a `limits` (p. ej. {"wdth": 125, "wght": (600, 900)}): un número fija el eje, un par lo acota.
- `main` (l. 38) — Lee las dos rutas de origen, genera las dos fuentes en site/assets/fonts y avisa de qué hacer a continuación.

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

[PACKAGE-CPANEL] Paquete .zip para subir a un hosting con cPanel o Plesk (Apache + PHP; web estática + API PHP), verificado antes de entregarlo. (El nombre del script es histórico: el paquete es el mismo para cualquier hosting con Apache y PHP 7.4+.)

- `run` (l. 51) — ejecuta y devuelve (código, salida combinada)
- `git_version` (l. 57) — → (versión, fecha del commit, limpio): hash corto del commit actual, su fecha y si el árbol de trabajo no tiene cambios sin commitear; ('sin-git', '', True) si no hay git.
- `write_build_info` (l. 67) — escribe api/generated/build.json: qué versión es este paquete (sin hora de compilación, para que el mismo commit dé el mismo .zip)
- `build_site` (l. 74) — compila la web de producción (la salida se cuenta línea a línea en la consola de build); `switch` None = el valor por defecto del compilador (sí en pruebas, no en producción)
- `copy_api` (l. 82) — copia SOLO los archivos permitidos del API PHP (lista blanca API_ALLOWED): sin pruebas, sin almacén de datos, sin copias de seguridad y sin la configuración real (config.php lleva claves y la crea quien despliega)
- `shown` (l. 93) — ruta legible: relativa al proyecto si está dentro, absoluta si no
- `files` (l. 101) — Todos los ficheros de la carpeta, ordenados (incluye los ocultos como .htaccess).
- `check_versions` (l. 106) — Actualizar sin caché vieja: todo CSS y JS local de cada página lleva «?v=<10 hex>» igual a la huella (SHA-256) del archivo, y no queda ningún marcador sin resolver.
- `check_csp` (l. 149) — Política de seguridad de contenido: script-src sin 'unsafe-inline' y cada script en línea ejecutable de cada página con su huella SHA-256 en la cabecera (los bloques de datos application/json y ld+json no se ejecutan).
- `verify` (l. 178) — → (errores, avisos). Un error impide entregar el paquete.
- `make_zip` (l. 289) — comprime la carpeta (con ficheros ocultos como .htaccess) y devuelve el SHA-256
- `main` (l. 301) — Compila, copia el API, verifica y comprime; si la verificación falla no genera el .zip.

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
- `_heading_html` (l. 83) — HTML del encabezado solo si el original lleva saltos de línea (<br>) y nada más que texto; si no, cadena vacía.
- `_cell_html` (l. 89) — HTML inline de una celda cuando lleva salto de línea o cursiva (p. ej. «Dimensiones (mm.)<br><em>Dimensions (mm.)</em>»); cadena vacía si es texto llano o lleva enlaces.
- `_table` (l. 95) — Bloque de tabla (título y filas de celdas) de un elemento table; None si ninguna fila tiene texto. La celda lleva además `h` (HTML inline) solo si el original tiene salto de línea o cursiva.
- `_is_button` (l. 112) — Indica si el enlace `a` tiene clase de botón (Elementor, ElementsKit, Gutenberg o genérica).
- `blocks_from` (l. 119) — [WALK] recorre en orden de documento y emite bloques
- `flush` (l. 123) — Convierte en un párrafo los nodos inline sueltos acumulados en `pending` y vacía la lista.
- `visit` (l. 135) — Añade a `blocks` los bloques del nodo `n` (encabezado, párrafo, lista, tabla, imagen, botón…); en contenedores recorre sus hijos.
- `_dedupe` (l. 228) — quita imágenes duplicadas consecutivas (los carruseles Swiper repiten slides) y bloques vacíos
- `clean_wp_html` (l. 245) — [WPBAKERY] Restos de shortcodes sin renderizar en la web original: [vc_raw_html]BASE64[/vc_raw_html] se decodifica (base64 → URL-decode → HTML);
- `raw` (l. 248) — Decodifica el base64 de un shortcode vc_raw_html (base64 → URL-decode → HTML); cadena vacía si falla.
- `blocks_from_html` (l. 258) — HTML (fragmento o página) → lista de bloques semánticos, tras limpiar los shortcodes de WPBakery sin renderizar.
- `elementor_sections` (l. 266) — [WALK] secciones de primer nivel de Elementor -> lista de listas de bloques

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

[CAPTURAS] Capturas de pantalla de las vistas clave del demo (para revisar sin abrir nada) + PDF de ejemplo. node scripts/capturas.mjs [carpeta-salida] [--theme=clasico|ficha]        (por defecto entrega/capturas y el aspecto que traiga dist/; --theme fuerza uno de los dos aspectos) Sirve dist/ por http, recorre el flujo de un cliente (ficha → presupuesto → PDF) y el panel de gestión, y guarda PNG numerados.

Secciones: `[CAPTURAS]`

- `THEME` (l. 16) — Aspecto forzado con --theme=clasico|ficha ('' = el que traiga dist/).
- `byPid` (l. 25) — Referencia (clave de TV.items) de la primera línea del producto `pid`.
- `mk` (l. 29) — Abre un contexto de navegador de w×h con el idioma fijado a mano (sin autodetección) y devuelve { ctx, page }.
- `shot` (l. 36) — Guarda una captura PNG numerada (NN-nombre.png) en la carpeta de salida y la muestra por consola; opts va a page.screenshot.
- `settle` (l. 38) — Espera a que la página termine de cargar y deja ms milisegundos más para que se asienten los scripts.

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

### `probe_original_heroes.mjs`

[PROBE-ORIGINAL-HEROES] Lee (solo GET) las páginas de categoría de la web actual de grupotorivac.com y descarga la foto grande que muestran junto al texto (bloque `torivac-cat-media`), para el aspecto «Original». Guarda las fotos en site/assets/img/original/ y el mapa categoría → foto en data/catalog/original-layout.json (clave `hero`). Uso: node scripts/probe_original_heroes.mjs   (≈ 60 peticiones, con pausa entre ellas)

Secciones: `[PROBE-ORIGINAL-HEROES]`

- `pause` (l. 16) — Pausa de 800 ms entre peticiones a la web actual (solo lectura, sin cargarla).

### `probe_original_layout.mjs`

[PROBE-ORIGINAL-LAYOUT] Lee (solo GET, sin escribir nada en la web original) el ORDEN en que la web actual de grupotorivac.com enseña sus categorías, y lo guarda en data/catalog/original-layout.json para el aspecto «Original»: shop   ids de las categorías de la portada de /productos/ en su orden

Secciones: `[PROBE-ORIGINAL-LAYOUT]`

- `norm` (l. 14) — grupotorivac.com').pathname; return p.endsWith('/') ? p : p + '/'; } catch { return ''; } };
- `get` (l. 17) — Descarga una página de la web original (GET) y devuelve su HTML.
- `idsOf` (l. 19) — Ids de categoría, en orden y sin repetir, de los enlaces `href` que cumplen `re` dentro de `html`.

### `probe_original_page.mjs`

[PROBE-PAGE] Mide una página de la web ACTUAL (grupotorivac.com) para clonar su maqueta en el aspecto «Original». Solo lectura: una carga GET por página. node scripts/probe_original_page.mjs <url> [ancho=1440]            lista plana ordenada por posición: bloques con fondo, borde o sombra, textos (tipografía, color), imágenes y botones node scripts/probe_original_page.mjs <url> [ancho=1440] --fondos   fondos (imagen, tamaño, posición) y capas ::before/::after (velos con degradado)

Secciones: `[PROBE-PAGE]`

- `box` (l. 27) — Caja de un elemento como [x, y de página, ancho, alto] redondeada.

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

[QA-PACKAGE] El paquete del hosting (cPanel/Plesk) tal y como se sube: lo genera package_cpanel.py (con sus verificaciones), se sirve con php -S (URLs limpias, API PHP real con almacén en ficheros, Resend simulado) y se recorre con el navegador: precios que llegan del servidor (el paquete NO lleva precios), presupuesto, pedido, panel y seguridad del API.

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

### `qa-theme.mjs`

[QA-THEME] Aspectos de la web (Ficha técnica / Clásico / Original): compilaciones y banderas, hoja por capas, selector y persistencia, fuentes, sin JS, sin desbordes y reglas de diseño. node scripts/qa-theme.mjs Compila 5 variantes en una carpeta temporal (no toca dist/) y las prueba por http:

Secciones: `[QA-THEME]` · `[DESIGN]` · `[BUILD]` · `[BROWSER]`

- `ok` (l. 24) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `build` (l. 26) — Compila una variante del sitio en TMP/<name> con las opciones `args` y devuelve su carpeta.
- `read` (l. 28) — Texto del archivo `f` (ruta relativa) de la variante `dir`.
- `rulesOf` (l. 30) — Lista las reglas de estilo de un CSS (sin comentarios) como [{ selector, body, media }]; entra en los @media y salta @keyframes/@font-face.
- `walk` (l. 33) — Recorre src[i..] hasta cerrar el bloque actual; `media` es el @media que lo envuelve (o '').
- `splitSelectors` (l. 53) — Divide una lista de selectores por las comas de primer nivel (sin romper los paréntesis de :is(), :not()…).
- `ctxOf` (l. 119) — Contexto de navegador con idioma ya elegido (sin avisos ni redirecciones) y las opciones `o`; `init` se ejecuta en cada página antes que nada.
- `state` (l. 121) — Estado visible del aspecto en la página: atributo, almacenamiento, fuente y esquina de los botones, y qué botón del selector está pulsado.

### `qa-update.mjs`

[QA-UPDATE] Actualizar la web publicada sin que el navegador mezcle HTML nuevo con CSS o catálogo viejos. Reproduce lo que pasa en un hosting real: el HTML no se guarda (Cache-Control: no-cache) y los CSS/JS se guardan una semana (max-age=604800), igual que el .htaccess. Compila DOS versiones de producción (v1 = Ficha técnica, v2 = Clásico: hoja de estilos distinta), sirve una y, con el MISMO navegador y su caché, «publica» la otra:

Secciones: `[QA-UPDATE]` · `[VERSIONES]` · `[SERVIDOR]` · `[NAVEGADOR]`

- `ok` (l. 49) — Anota una comprobación: la cuenta como fallo si no se cumple y la imprime.
- `look` (l. 51) — Qué ve la página tras cargar: aspecto, dirección y origen (red o caché) de site.css y catalog.js, y si la hoja en uso lleva la capa de «Ficha técnica».
- `res` (l. 53) — Dirección (sin el origen) y si vino de la red del recurso cuya URL contiene `needle`; null si la página no lo pidió.
- `newPage` (l. 60) — Pestaña nueva en un contexto nuevo (caché vacía).

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

### `single_file.mjs`

[SINGLE-FILE] Convierte una página del demo en UN solo .html autosuficiente: hojas de estilo, scripts, fuentes e imágenes van dentro (base64). node scripts/single_file.mjs dist/index.html entrega/Torivac-portada.html Sirve para enseñar la web donde no se puede descomprimir nada (vista previa del móvil, correo, un visor de archivos): se ve igual que en el navegador.

Secciones: `[SINGLE-FILE]` · `[FILES]` · `[INLINE]`

- `localFile` (l. 13) — Archivo local al que apunta una referencia del HTML o del CSS (null si es http, data:, un ancla o no existe).
- `dataUri` (l. 20) — data: URI de un archivo de imagen o fuente (null si el tipo no se incrusta, p. ej. los PDF).
- `inlineCss` (l. 27) — CSS con cada url(...) local sustituida por su data: URI; `dir` es la carpeta del propio CSS.
- `attrOf` (l. 32) — Valor de un atributo de una etiqueta HTML (comillas dobles o simples); null si no lo lleva.
- `singleFile` (l. 35) — Página → HTML autosuficiente. Devuelve { html, images, bytes }.
- `inline` (l. 52) — data: URI de la imagen o fuente local a la que apunta `ref` (la cuenta en `images`); null si no hay nada que incrustar.

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

- `backendKind` (l. 26) — Backend elegido por la línea de comandos: 'php' con --php (o TV_BACKEND=php), 'worker' por defecto.
- `freePort` (l. 29) — Puerto TCP libre en 127.0.0.1.
- `readBody` (l. 31) — Cuerpo completo de una petición HTTP entrante, como Buffer.
- `externals` (l. 34) — servicios de terceros simulados; la misma lógica sirve al Worker (fetchImpl) y al PHP (servidor http)
- `handle` (l. 37) — Responde a los servicios externos simulados (Resend, Anthropic, hoja CSV, libro Excel) y guarda lo que se les envía.
- `startWorker` (l. 50) — Arranca el Worker torivac-api en memoria (KV simulado) detrás de un servidor http, con la web en otro puerto; misma interfaz que startPhp.
- `mockFetch` (l. 59) — fetch simulado del Worker: delega en los servicios externos simulados.
- `startPhp` (l. 88) — Arranca el API PHP con php -S sobre una copia de api/ y enlaces a la web; devuelve la misma interfaz que startWorker.
- `writeCfg` (l. 107) — Escribe api/config.php con la configuración de pruebas (PHP la lee en cada petición).
- `kv` (l. 121) — Ruta del fichero del almacén que corresponde a una clave.
- `read` (l. 123) — Valor guardado en el almacén del PHP para una clave (null si no existe).
- `startBackend` (l. 138) — Arranca el backend pedido ('worker' o 'php') y devuelve su interfaz común.

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
- `suggestPriceChanges` (l. 124) — Propone cambios para una instrucción. Lanza ApiError (400 instrucción vacía o larga, 409 sin precios, 503 IA sin configurar, 502 fallo de la IA).
- `incoming` (l. 138) — Cambio recibido del navegador → { ref, price, tiers } para validarlo de nuevo; las entradas que no son objetos (null, números…) se descartan.
- `applyPriceChanges` (l. 140) — Aplica los cambios que la persona ha revisado. Vuelve a validarlo todo en servidor (no se fía de lo que manda el navegador).

### `auth.js`

[AUTH] Sesiones firmadas HMAC-SHA256 sin estado en el token, pero LIGADAS al registro del usuario, y autenticación de cada petición. Patrón de whynot-sites/workers/admin (users.js). Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma). payload = { sub:email, iat, exp, sid }. Caduca a las 24 h. El ROL no va en el token: sale SIEMPRE del registro del usuario.

Secciones: `[AUTH]`

- `secretOk` (l. 14) — True si el secreto es una cadena de al menos `min` caracteres y no es el marcador de ejemplo («CAMBIA-ESTO»).
- `hmac` (l. 16) — Firma HMAC-SHA256 de bytes con la clave secret; devuelve Uint8Array.
- `signSession` (l. 21) — Crea el token de sesión «datos.firma» (base64url) con { sub, iat, exp, sid }; caduca a los ttlMs (24 horas por defecto). Con un secreto inseguro lanza Error.
- `verifySession` (l. 27) — Comprueba firma, caducidad y forma de un token de sesión → { sub, iat, exp, sid }, o null si no es válido (o el secreto es inseguro). No mira el registro del usuario: eso lo hace authenticate.
- `bearer` (l. 40) — Token de la cabecera «Authorization: Bearer …» de la petición, o null si no viene.
- `authenticate` (l. 45) — Quién llama: {role:'manager'|'client', sub, name, master?} o null. ADMIN_API_TOKEN (≥ 32 caracteres) actúa como manager (scripts/CI; se compara por resúmenes SHA-256, en tiempo constante también
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

[EMAIL] Envío por Resend (HTTP). Sin RESEND_API_KEY no se envía nada y se devuelve {skipped:true} (entornos de prueba). Dos correos por pedido: el AVISO al equipo (con los datos del cliente y el PDF que fabricó su navegador) y la COPIA al cliente, que solo lleva texto fijo y datos valorados por el servidor.

Secciones: `[EMAIL]` · `[COPIA]`

- `sendMail` (l. 5) — Envía un correo por Resend → { ok, id }; sin RESEND_API_KEY { ok:false, skipped:true }; si falla { ok:false, status | error }. El asunto va siempre en una línea.
- `money` (l. 16) — Importe en euros con el formato del idioma (es, en, fr, de); «—» si no hay importe.
- `orderMail` (l. 20) — Correo de aviso de un pedido para el equipo → { html, text } con cliente, líneas, total, marca de precios de demostración y, si va PDF adjunto, el aviso de que el importe válido es el del servidor.
- `copySubject` (l. 40) — Asunto fijo de la copia al cliente (el mismo en todos los idiomas).
- `customerCopyMail` (l. 45) — Copia del pedido para el CLIENTE → { subject, html, text }. Solo contenido generado por el servidor: texto fijo en el idioma del pedido, número, líneas (ref, nombre del catálogo, cantidad e

### `index.js`

[INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login USUARIO   GET /api/auth/me · POST /api/auth/logout · GET /api/orders (manager: los 300 más recientes; client: solo los suyos, hasta 100)

Secciones: `[INDEX]`

- `tooMany` (l. 21) — 429 con el texto de siempre (el mismo para cualquier límite de acceso: nunca distingue si un usuario existe).
- `configProblems` (l. 23) — Ajustes mal puestos que se avisan en /api/health: solo sus NOMBRES (SESSION_SECRET, ADMIN_API_TOKEN, ORDER_COPY), nunca sus valores.
- `fail` (l. 31) — Respuesta de error: un ApiError enseña su mensaje y estado; cualquier otra excepción se responde como «Error interno» con un id de 8 hex y el detalle va al registro con ese id.
- `identify` (l. 38) — Quién llama + control de fallos de Bearer: sin Bearer → anónimo; con Bearer inválido cuenta un FALLO (30 / 10 min por ipKey) y, pasado el tope, responde { limited: true }. Una petición válida no consume cupo.
- `handleLogin` (l. 49) — POST /api/auth/login. Límites (todos devuelven el mismo 429 y nunca distinguen si el usuario existe): por ipKey+correo 6 / 10 min · por ipKey sola 30 / 10 min contra cualquier cuenta ·
- `route` (l. 72) — Enruta la petición (ya con CORS resuelto) → Response; las excepciones suben a fetch, que las convierte en «Error interno».
- `fetch` (l. 132) — Atiende cada petición HTTP: CORS, rutas públicas, login y rutas de sesión o de manager; deps = { fetchImpl, ctx, now, purge, rand } para pruebas. Una excepción NUNCA escapa sin cabeceras CORS.
- `scheduled` (l. 148) — Tarea programada (cron): sincroniza los precios con la hoja de origen y limpia los registros de límites caducados; un fallo se anota en prices:meta y en el log, y no se propaga.

### `orderlist.js`

[ORDERLIST] GET /api/orders sin recorrer todo el almacén: acotado en pedidos y en operaciones de KV por petición. MANAGER  recorre los prefijos de fecha order:TV-AAAAMMDD- hacia atrás desde hoy hasta reunir 300 pedidos o llegar a 120 días, con un máximo de 400 operaciones de KV (list + get). CLIENTE  lista su índice uorder:<sha256(correo)[:32]>:<nº> (se escribe al crear el pedido) y lee como mucho sus 100 pedidos más recientes. Los pedidos anteriores a este índice no le aparecen.

Secciones: `[ORDERLIST]`

- `parse` (l. 10) — Pedido de KV (texto JSON) → objeto, o null si falta o está dañado.
- `forClient` (l. 12) — Versión de un pedido para un CLIENTE: sin la IP del emisor ni el texto de error del aviso por correo (eso es solo para managers).
- `listKeys` (l. 18) — Todas las claves de KV con ese prefijo (cada página es una operación; para si se agotan las operaciones) → { keys, complete }.
- `readOrders` (l. 29) — Lee los pedidos de las claves dadas (las más recientes primero) hasta `want` pedidos o hasta agotar las operaciones → { done } con false si quedaron claves sin leer.
- `listOrders` (l. 40) — Pedidos visibles para `who` (manager: los más recientes de todos; cliente: los suyos, sin IP ni error de correo) → { orders (más recientes primero), truncated }. `now` en ms (para pruebas).
- `scan` (l. 50) — Recorre KV según el rol llenando `out` con los pedidos leídos (los más recientes primero) → true si se cortó antes de agotar lo que había.

### `orders.js`

[ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por correo: AVISO al equipo (con el PDF que fabricó el navegador) y, según ORDER_COPY y con topes, COPIA al cliente con contenido generado solo por el servidor (sin PDF ni texto del visitante). Número de pedido TV-AAAAMMDD-NNNN-XXX (XXX aleatorio: dos pedidos simultáneos no se pisan). Claves KV: order:<nº completo> (400 días) · uorder:<sha256(correo)[:32]>:<nº> (índice de «mis pedidos» del cliente, valor mínimo) · counter:<AAAAMMDD> (contador de «mejor esfuerzo»).

Secciones: `[ORDERS]`

- `ymd` (l. 18) — Fecha en UTC como AAAAMMDD, para el número de pedido y su contador diario.
- `intVar` (l. 20) — Entero de una variable de entorno (texto de cifras); si falta, no es un entero o es menor que `min`, vale `def`.
- `copyMode` (l. 22) — Modo de la copia al cliente: «capped» (por defecto, con topes) u «off» (nunca); cualquier otro valor falla cerrado y cuenta como «off».
- `randomSuffix` (l. 24) — 3 caracteres aleatorios base36 en mayúsculas para cerrar el número de pedido; `rand(n)` devuelve n enteros sin signo (se puede inyectar en las pruebas).
- `baseNumber` (l. 26) — Parte «TV-AAAAMMDD-NNNN» del número: contador diario en KV de «mejor esfuerzo» (no es atómico; si KV lo rechaza, un número de respaldo por segundos del día: el pedido nunca se pierde por esto).
- `nextNumber` (l. 33) — Siguiente número de pedido completo (TV-AAAAMMDD-NNNN-XXX).
- `uorderPrefix` (l. 35) — Prefijo de las claves del índice de pedidos de un cliente: uorder:<32 primeros hex del SHA-256 de su correo en minúsculas>: (nunca el correo en la clave).
- `sendCopy` (l. 41) — Decide y, si procede, envía la copia al cliente → motivo: 'sent' | 'failed' | 'not_requested' (el visitante mandó copy:false) | 'off' (ORDER_COPY no es «capped») | 'skipped' (correo sin configurar) |
- `handleOrder` (l. 53) — POST /api/order: límites (por visitante y global), validación, valoración en servidor con los precios vigentes, guardado en KV, aviso al equipo y copia al cliente.
- `handleContact` (l. 89) — POST /api/contact: límite por visitante, anti-spam y envío del mensaje al equipo; responde { ok, emailed, skipped }.

### `passwords.js`

[PASSWORDS] Contraseñas con PBKDF2-HMAC-SHA256 (100 000 iteraciones, el máximo de Workers; sal de 16 B) y política de contraseñas nuevas.

Secciones: `[PASSWORDS]`

- `pbkdf2` (l. 11) — Deriva 256 bits de la contraseña con PBKDF2-HMAC-SHA256 y la sal dada (ITER iteraciones); devuelve Uint8Array.
- `hashPassword` (l. 16) — Genera una sal aleatoria de 16 B y devuelve { hash, salt } en hexadecimal, listos para guardar en el usuario.
- `verifyPassword` (l. 21) — True si la contraseña con esa sal da el hash guardado (comparación en tiempo constante, también en longitud).
- `flat` (l. 25) — Minúsculas, sin acentos y solo letras y cifras: «Torivac-Manager-2026» → «torivacmanager2026».
- `passwordProblem` (l. 31) — Motivo por el que una contraseña NUEVA no vale (texto para mostrar), o null si vale: mínimo 12 caracteres (y como mucho 1000), que no contenga la parte local del correo (también sin la

### `prices.js`

[PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios). Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js): { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note, n?, pid? } } }   (n/pid: referencia que añade la hoja dentro de un producto)

Secciones: `[PRICES]`

- `loadPrices` (l. 11) — Precios vigentes guardados en KV; si todavía no hay, una hoja vacía (mode 'none').
- `coarse` (l. 14) — Origen sin datos personales ni identificadores: «upload:ana@torivac.com» → «upload», «sheet:ID» → «sheet».
- `publicView` (l. 16) — Lo que ve cualquier visitante de GET /api/prices: igual que el original pero sin el correo de quien cargó la hoja ni el id del archivo de Drive.
- `unitPrice` (l. 20) — Precio unitario de ref para qty unidades (último tramo por cantidad alcanzado); null si no tiene precio.
- `priceOrder` (l. 25) — Valora las líneas {ref,qty}. Sin precio → unit/total null («Consultar»; no suman al total).
- `readPrices` (l. 33) — filas (con filas de título delante si las hay) → { prices, report } usando las reglas compartidas de shared/price-sheet.mjs.
- `rowsToPrices` (l. 40) — igual que readPrices pero devuelve solo el objeto de precios (lo usan el cron y los tests)
- `withSheetItems` (l. 42) — catálogo de referencias pedibles = las del sitio + las que la hoja de precios añadió dentro de un producto ({n, pid})
- `updateMode` (l. 48) — Modo de actualización válido: «replace» (la hoja sustituye a toda la lista) o «merge» (solo lo que trae la hoja; es lo normal y vale para cualquier otro valor).
- `mergePrices` (l. 53) — Aplica una hoja ya leída (`sheet`) a los precios vigentes (`prev`). «merge»: quita las referencias de `retire` y pone o actualiza las que trae la hoja (si una referencia sale a la vez
- `basePrice` (l. 57) — Precio base vigente de ref en `prev`, o undefined si esa referencia no tiene precio propio.
- `massChange` (l. 62) — Aviso «cambio_masivo» si ≥ 10 referencias ya tenían precio y más de la mitad cambia más de un 40 % (¿hoja equivocada, columna movida, otra unidad?); null si no.
- `diffPrices` (l. 78) — Compara dos precios: { changed, added, removed } con las referencias afectadas y same con el número de las que no cambian.
- `assertFinitePrices` (l. 85) — Comprueba que todos los importes y tramos sean cifras finitas y razonables antes de guardar (JSON.stringify convierte NaN e Infinity en null y vaciaría la lista); si no, lanza Error.
- `bad` (l. 88) — true si x no es una cifra finita entre 0 y 10 000 000 (el tope de cualquier cifra de una hoja)

### `ratelimit.js`

[RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms. La clave NUNCA lleva el identificador en claro: rl:<cubo>:<SHA-256 hex (32 primeros)> → longitud acotada (KV admite 512 bytes), sin correos ni IP en las claves y sin eco de la clave en los errores. Cada registro se guarda con expirationTtl (KV lo borra solo al caducar); además, purgeExpired limpia «al vuelo» lo caducado que pudiera quedar.

Secciones: `[RATE-LIMIT]`

- `rlKey` (l. 7) — Clave KV del limitador: rl:<cubo>:<32 primeros hex del SHA-256 del identificador>.
- `read` (l. 9) — Lee el registro { count, resetAt } vigente del cubo, o null si no hay o ya caducó.
- `hit` (l. 14) — Cuenta una acción en el cubo (ventana fija de windowMs desde la primera) → { allowed, remaining, resetAt, count }; allowed es false cuando se supera `max`.
- `isBlocked` (l. 22) — True si el cubo ya está en el máximo dentro de su ventana vigente. Solo lee: sirve para contadores que cuentan únicamente los fallos (se llama a hit tras cada fallo).
- `reset` (l. 27) — Pone a cero el cubo (p. ej. tras un acceso correcto).
- `purgeExpired` (l. 29) — Borra hasta `limit` registros rl:* caducados (por su dato de caducidad en KV o, si no lo trae, por su resetAt) → cuántos borró. Se llama «al vuelo» en 1 de cada 50 peticiones.

### `sheets.js`

[SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV. Tres modos, en este orden: 1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID): hoja de Google → Sheets API v4; si el archivo es un .xlsx subido a Drive sin convertir → se descarga con la API de Drive y se lee el libro

Secciones: `[SHEETS]` · `[DESCARGAS]`

- `parseCsv` (l. 21) — Texto CSV → filas de celdas: separador «;» o «,» según la primera línea, comillas dobles; omite las filas vacías.
- `pemToDer` (l. 36) — Clave privada PEM (PKCS8) → bytes DER, sin las líneas de cabecera ni espacios.
- `getAccessToken` (l. 38) — token de acceso OAuth2 de una cuenta de servicio (JWT RS256 firmado con WebCrypto)
- `isLocalHost` (l. 51) — True si el host es local o una IP literal (loopback, privada, enlace local): una redirección a ellos desde un host público se rechaza.
- `fetchSafe` (l. 61) — fetch con redirecciones MANUALES: como mucho 5 saltos, solo https: (y http: si la URL inicial ya era http:), nunca a un host local desde uno público y sin reenviar la cabecera Authorization
- `readBytes` (l. 77) — Cuerpo de una respuesta como bytes, contando de verdad lo que llega: más de `max` → ApiError 502 («La hoja es demasiado grande o está dañada»).
- `xlsxRows` (l. 92) — filas de la hoja de precios de un libro .xlsx descargado (bytes) → { rows, sheet }; si no es un libro, el error (ApiError 502) dice qué revisar
- `readSheetRows` (l. 100) — Lee la hoja de precios de la primera fuente configurada (cuenta de servicio, XLSX o CSV) → { rows, source }; sin fuente, ApiError.
- `savePrices` (l. 127) — Guarda unos precios nuevos: copia el anterior al histórico (90 días), escribe los vigentes y la meta (que borra el estado de error de un intento anterior). Lo usan la sincronización y los cambios por IA.
- `planPrices` (l. 140) — Plan de una actualización, sin guardar nada: lee las filas, las aplica a los precios vigentes según `mode` («merge»: solo lo que trae la hoja; «replace»: sustituye todo) y lista lo que
- `recordSync` (l. 159) — Anota en prices:sync el resultado del último intento de sincronización { at, reason, ok, blocked, error, refs? } (también el fallido o bloqueado); lo ven los managers en GET /api/prices. Un fallo al anotarlo nunca tapa el resultado real.
- `syncPrices` (l. 164) — Lee la hoja (Drive, CSV o filas subidas), la valida con las reglas compartidas y la publica. `mode`: «merge» (por defecto, o PRICE_UPDATE_MODE) o «replace». ctx = contexto del catálogo (ver catalog.js); sin ctx se aceptan todas las referencias (pruebas).

### `turnstile.js`

[TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.

Secciones: `[TURNSTILE]`

- `verifyTurnstile` (l. 2) — [TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.

### `users.js`

[USERS] Usuarios en KV: clave user:<email>. Nunca se devuelve ni se guarda la contraseña en claro. Registro: { email, name, role, hash, salt, created, sid, sess_after }. `sid` (16 bytes aleatorios en hex) ata las sesiones a ESTE registro: borrar y volver a crear al usuario no resucita sus tokens; `sess_after` (ms) es el momento del último «cerrar sesión»: vale solo un token emitido después. Los usuarios antiguos sin `sid` lo reciben en su siguiente inicio de sesión correcto.

Secciones: `[USERS]`

- `userKey` (l. 9) — Clave KV de un usuario: user:<correo en minúsculas>.
- `pub` (l. 11) — Datos públicos del usuario, sin el hash ni la sal de la contraseña ni los datos de sesión.
- `newSid` (l. 13) — Identificador de sesión nuevo: 16 bytes aleatorios en hexadecimal (32 caracteres).
- `getUser` (l. 16) — Registro completo del usuario con ese correo, o null si no existe (o está dañado).
- `createUser` (l. 21) — Da de alta un usuario → { user } o { error, status? } si el correo, el rol o la contraseña no valen o ya existe. Contraseña: mínimo 12, sin la parte local del correo ni triviales.
- `listUsers` (l. 36) — Lista los usuarios (solo datos públicos), recorriendo todas las páginas de KV.
- `deleteUser` (l. 42) — Borra el usuario con ese correo (si no existe, no hace nada). Sus sesiones dejan de valer al instante: un usuario recreado con el mismo correo recibe un `sid` nuevo.
- `verifyUser` (l. 44) — Comprueba la contraseña contra el registro u (null = no existe: se gasta el mismo tiempo para no enumerar usuarios por tiempo) → true solo si el usuario existe y la contraseña es la suya.
- `checkLogin` (l. 49) — Comprueba credenciales. Devuelve el usuario público o null (mismo coste si no existe).
- `ensureSession` (l. 54) — Garantiza que el registro tenga `sid` y `sess_after` (los usuarios antiguos no los traen) y lo guarda si hizo falta → el registro actualizado.
- `logoutUser` (l. 61) — Cierra la sesión: `sess_after` = ahora, de modo que TODOS los tokens emitidos antes de este momento dejan de valer. → true si el usuario existe.

### `util.js`

[UTIL] Respuestas JSON, errores de la API, escape HTML, comparación de secretos en tiempo constante, codificaciones, clave de límite por visitante (ipKey) y lectura acotada del cuerpo.

Secciones: `[UTIL]` · `[IPKEY]` · `[BODY]`

- `json` (l. 8) — Respuesta JSON con el estado y las cabeceras indicados; nunca se cachea (no-store).
- `esc` (l. 10) — Escapa & < > y comillas para incrustar un valor en HTML; null o undefined dan una cadena vacía.
- `utf8` (l. 12) — Bytes bien formados de un texto UTF-8.
- `sha256` (l. 14) — SHA-256 de un texto (UTF-8) → Uint8Array de 32 bytes.
- `sha256Hex` (l. 16) — SHA-256 de un texto en hexadecimal minúsculas (64 caracteres).
- `timingSafeEqual` (l. 18) — Compara dos textos en tiempo constante TAMBIÉN en longitud: compara sus resúmenes SHA-256, así que no sale antes si las longitudes difieren.
- `toB64Url` (l. 24) — Bytes → base64url sin relleno.
- `fromB64Url` (l. 26) — base64url (con o sin relleno) → Uint8Array.
- `toHex` (l. 28) — Bytes → texto hexadecimal en minúsculas.
- `fromHex` (l. 30) — Texto hexadecimal → Uint8Array.
- `round2` (l. 32) — Redondea a 2 decimales (1.005 → 1.01).
- `randomHex` (l. 34) — Identificador aleatorio de n bytes en hexadecimal (p. ej. el id de un error interno: 4 bytes = 8 caracteres).
- `clientIp` (l. 36) — IP del cliente que informa Cloudflare (CF-Connecting-IP); 0.0.0.0 si falta. Es la IP COMPLETA: para limitar usa ipKey.
- `parseV4` (l. 40) — «a.b.c.d» (cuatro octetos decimales 0–255, sin ceros a la izquierda) → [a, b, c, d]; null si no es una IPv4 válida.
- `parseV6` (l. 46) — IPv6 (con «::», IPv4 final y «%zona» opcionales) → 8 grupos de 16 bits; null si no es válida.
- `ipKey` (l. 68) — Clave de límite por visitante: IPv4 tal cual; IPv6 → su /64 en formato canónico «xxxx:xxxx:xxxx:xxxx::/64» (quien controla una dirección controla todo su /64: sin agrupar,
- `jsonDepthOk` (l. 78) — True si el JSON `text` no anida más de `max` niveles de [] o {} (recorrido lineal; las cadenas largas se saltan con indexOf, sin mirarlas carácter a carácter).
- `readBody` (l. 96) — Lee el cuerpo de la petición contando los bytes que llegan de verdad (no basta Content-Length: con transferencia por trozos no existe); más de maxBytes → null.
- `readJson` (l. 112) — Cuerpo JSON de la petición, o null si supera maxBytes (contados de verdad), anida más de 32 niveles o no es JSON válido.

### `validate.js`

[VALIDATE] Validación estricta de pedidos y mensajes de contacto. Todo lo que llega del navegador es no fiable. Reglas: todo texto debe ser una CADENA (si no, 400); los campos de una línea no llevan saltos ni caracteres de control (el asunto del correo al equipo lleva el nombre); las referencias se comprueban con Object.hasOwn (nombres como «constructor» o «__proto__» NO son referencias); el correo es estricto; el PDF se valida de verdad (base64 estricto, %PDF-, ≤ 4 MB).

Secciones: `[VALIDATE]`

- `oneLine` (l. 13) — Texto de UNA línea: sin \r \n \t ni otros caracteres de control (se sustituyen por un espacio), espacios colapsados, recortado y limitado a max caracteres.
- `multiLine` (l. 15) — Texto con saltos de línea (notas, mensajes): conserva \n y el tabulador, convierte \r\n y \r en \n y quita el resto de controles; recortado y limitado a max caracteres.
- `isEmail` (l. 17) — True si `s` es un correo válido y estricto (≤ 254 caracteres, parte local ≤ 64).
- `optText` (l. 19) — True si el valor es ausente (undefined o null) o una cadena.
- `isObj` (l. 21) — True si v es un objeto «de verdad» (no null ni lista).
- `parsePdf` (l. 27) — Valida el PDF que manda el navegador → { b64 } normalizado (sin saltos de línea) o { error }. Base64 estricto (^[A-Za-z0-9+/]+={0,2}$ tras quitar los saltos de línea, con longitud múltiplo de 4),
- `parseOrder` (l. 39) — Valida y normaliza el pedido del navegador (cliente, líneas pedibles de items, idioma, PDF) → { order } o { error }.
- `parseContact` (l. 66) — Valida y normaliza el formulario de contacto (honeypot, nombre, correo, mensaje, privacidad) → { contact } o { error }.

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

Pruebas de [AUTH], [VALIDATE], [PRICES], [SHEETS], [ORDERS], [USERS] e [INDEX]: contraseñas y sesiones, pedidos, hoja de precios, roles, CORS, límites y cron. Sin red: KV en memoria y Resend/Google simulados con fetchImpl (ver helpers.js). Se ejecutan con `npm test` desde workers/api. Las pruebas de los arreglos de seguridad (D1…D9) están en security-orders.test.js, security-auth.test.js y security-sheets.test.js.

Secciones: `[AUTH]` · `[VALIDATE]` · `[PRICES]` · `[SHEETS]` · `[ORDERS]` · `[USERS]` · `[INDEX]`

- `goodOrder` (l. 16) — Pedido válido de ejemplo { customer, lines, lang }; over sustituye campos para provocar cada error de validación.
- `ok` (l. 72) — Crea un fetch simulado que responde 200 con el texto dado.
- `login` (l. 123) — POST /api/auth/login con el correo y la contraseña dados; devuelve la Response.
- `as` (l. 128) — Llama al Worker en la ruta p con el token t como Bearer y las opciones o (método, body); devuelve la Response.
- `rec` (l. 134) — Registro de pedido de ejemplo con IP y un error de correo (para comprobar qué ve cada rol).
- `ok` (l. 193) — fetch simulado que responde 200 con las filas del CSV de precio de relleno (rows).
- `me` (l. 222) — GET /api/auth/me con la sesión de Ana; devuelve la Response.
- `fetchImpl` (l. 230) — Resend simulado: guarda cada correo enviado en `sent`.
- `down` (l. 252) — Resend simulado que rechaza todos los envíos (403: dominio sin verificar).
- `up` (l. 259) — Resend simulado que acepta todos los envíos.
- `up` (l. 281) — Sube una hoja (cuerpo `body`) al API con el catálogo de pruebas y devuelve la respuesta ya leída.
- `items` (l. 283) — Precios vigentes guardados en KV.
- `rows` (l. 318) — Hoja de 12 referencias R0…R11 con precio base + índice.

### `helpers.js`

Utilidades de test: KV en memoria que imita las reglas de Cloudflare KV (clave ≤ 512 bytes, TTL ≥ 60 s, listado ordenado con páginas y fecha de caducidad), entorno de pruebas con secretos largos y fetch simulado. El TTL NO hace desaparecer las claves en get (los tests inyectan `now`): solo se anota para que list y la purga puedan verlo.

- `checkKey` (l. 5) — Comprueba la clave como lo haría KV: no vacía y de 512 bytes como máximo.
- `put` (l. 10) — Guarda un valor; anota la caducidad si trae expirationTtl (KV exige al menos 60 s).
- `list` (l. 17) — Claves con el prefijo, ordenadas, por páginas (cursor), con su dato de caducidad si lo tienen.
- `mkEnv` (l. 36) — Entorno de pruebas del Worker: KV en memoria, destinatarios, token maestro, secreto de sesión y origen; extra sobrescribe valores.
- `req` (l. 38) — Request de prueba a https://api.test: método, cabeceras y body (un objeto se serializa a JSON; un texto se envía tal cual).

### `kit.js`

Ayudas de las pruebas de seguridad: llamadas al Worker con IP, token y hora simulados, altas e inicios de sesión, pedidos de ejemplo y un buzón de Resend simulado.

- `call` (l. 9) — Llama al Worker: ip → CF-Connecting-IP, token → Bearer, origin, deps (now, fetchImpl, rand, purge…; sin purga aleatoria por defecto) → Response.
- `signIn` (l. 12) — Da de alta un usuario y devuelve su inicio de sesión real { token, user, email } (por la API, desde la IP indicada).
- `mailbox` (l. 20) — Buzón de Resend simulado: fetchImpl guarda cada correo enviado en `sent` (cuerpo JSON ya leído) y responde 200.
- `fetchImpl` (l. 23) — Resend simulado: guarda el correo, o responde 403 si la bandeja está configurada para fallar.
- `order` (l. 30) — Pedido válido de ejemplo con referencias REALES del catálogo generado; over sustituye campos de primer nivel.
- `orderEnv` (l. 32) — Entorno de pruebas con Resend configurado, precios vigentes de ejemplo (P16633 y P8339) y los extras indicados.
- `keys` (l. 38) — Todas las claves de KV (ordenadas) que empiezan por el prefijo.

### `price-sheet.test.js`

Pruebas de la lectura tolerante de hojas de precios (shared/price-sheet.mjs) con los casos compartidos (shared/price-sheet.fixtures.json).

### `security-auth.test.js`

Pruebas de los arreglos de seguridad del ACCESO: D3 (límites de login, de Bearer, claves acotadas, secretos mínimos, contraseñas nuevas, comparación de secretos, purga), D4 (sesiones ligadas al usuario, revocables y de 24 h), D6 (errores sin texto interno, tope real del cuerpo, CORS en excepciones, anidamiento) y D9 (datos de gestión solo para managers). Cada prueba reproduce el ataque del informe y comprueba que ya no funciona y que lo legítimo sigue funcionando.

- `nextIp` (l. 18) — IP de prueba distinta cada vez (para no tropezar con los límites por visitante cuando se hacen muchos intentos).
- `forge` (l. 22) — Token firmado a mano con HMAC-SHA256 (para forjar tokens con cualquier contenido y la clave que se quiera).
- `payloadOf` (l. 27) — Contenido (payload) de un token de sesión ya emitido.
- `withLog` (l. 29) — Ejecuta fn con console.error capturado → lo que se escribió en el registro (una cadena por llamada).
- `visto` (l. 69) — Origen (source) de la lista de precios que ve quien llama con ese token desde esa IP: completo para un manager, solo «upload» para el público.
- `con` (l. 225) — Cuerpo de pedido con un nivel de anidamiento de n corchetes en un campo extra.
- `rnd` (l. 258) — Número pseudoaleatorio en [0, 1) con semilla fija (la prueba es reproducible).
- `pick` (l. 260) — Elemento al azar de una lista.
- `gen` (l. 263) — Valor JSON raro al azar: átomos, listas y objetos con las claves que usa el API.

### `security-orders.test.js`

Pruebas de los arreglos de seguridad del PEDIDO y de la CLAVE DE LÍMITE: D1 (copia al cliente, PDF, topes, campos de una línea, correo estricto, solo cadenas), D2 (ipKey y /64) y D7 (visibilidad, número de pedido, listado acotado, referencias con Object.hasOwn). Cada prueba reproduce el ataque del informe del revisor y comprueba que ya no funciona y que lo legítimo sigue funcionando. Mismos nombres que en el PHP en lo posible (D1 · …).

- `nextIp` (l. 16) — IP de prueba distinta cada vez (así el límite por visitante de 8 pedidos no interfiere con pruebas que envían muchos).
- `send` (l. 63) — Envía un pedido de ejemplo con la fecha y el correo dados desde una IP nueva.
- `pdfDe` (l. 106) — PDF en base64 que decodificado pesa exactamente n bytes (empieza por «%PDF-»).
- `q` (l. 157) — Valida un pedido con esas líneas contra el catálogo de pruebas.
- `ago` (l. 225) — Fecha AAAAMMDD y marca de tiempo de hace n días respecto a `now`.
- `put` (l. 227) — Guarda un pedido mínimo en KV con su número y fecha.
- `quiet` (l. 285) — Ejecuta fn con console.error silenciado (los fallos provocados a propósito no ensucian la salida de las pruebas).

### `security-sheets.test.js`

Pruebas de los arreglos de seguridad de la HOJA DE PRECIOS y las DESCARGAS: D5 (borrado masivo en modo «fusionar», cifras finitas, columna «nota»), D8 (topes del lector de .xlsx, redirecciones controladas y tope de tamaño de la descarga). Cada prueba reproduce el ataque del informe del revisor y comprueba que ya no funciona y que lo legítimo sigue funcionando.

- `seeded` (l. 18) — Entorno con los precios vigentes de las n primeras referencias (precio 10 + posición).
- `csv` (l. 20) — Hoja CSV con las n primeras referencias: f(i) da su precio (0 = retirar) y act(i) su columna active.
- `nPrices` (l. 22) — Número de referencias con precio guardadas ahora mismo.
- `upload` (l. 24) — POST /api/prices/upload como manager (token maestro) con el cuerpo dado → { r, j }.
- `quiet` (l. 26) — Ejecuta fn con console.error silenciado → lo que se habría escrito en el registro.
- `plan` (l. 41) — Plan de actualización (sin guardar) de una hoja CSV en el modo dado, con el catálogo real.
- `sync` (l. 65) — Estado del último intento de sincronización guardado en prices:sync.
- `caida` (l. 78) — fetch simulado que responde 404 a todo.
- `hoja` (l. 122) — Libro con una sola celda en la columna dada.
- `filas` (l. 126) — Libro con n filas de una celda cada una.
- `fetchImpl` (l. 148) — fetchImpl de la prueba: siempre devuelve el libro hostil.
- `scripted` (l. 156) — fetch simulado que sirve las respuestas de `chain` en orden y anota cada llamada [url, init].
- `redir` (l. 158) — Respuesta de redirección 302 a la dirección dada.

### `xlsx.test.js`

Lector de .xlsx del servidor (shared/xlsx.mjs): mismos libros y mismo resultado esperado que el port en PHP (backend-php/api/tests/XlsxTest.php).

- `book` (l. 11) — Bytes del libro .xlsx de pruebas f, leído de shared/xlsx/.
- `bytesRes` (l. 49) — Response simulada con los bytes del libro f y el estado indicado (200 por defecto).
- `fetchImpl` (l. 66) — fetch simulado que siempre devuelve el libro artesanal.xlsx.
- `mk` (l. 85) — Crea el fetch simulado de Google: OAuth siempre válido; Sheets da valores si sheetsOk o falla con 400; Drive sirve el libro.
- `dead` (l. 102) — ni Sheets ni Drive: error con los dos códigos y la pista de compartir el archivo

### `zip.js`

Constructor mínimo de libros .xlsx para las pruebas (zip con deflate o sin comprimir): sirve para fabricar libros normales y también hostiles (bombas de inflado, celdas enormes, filas sin cerrar).

- `mkZip` (l. 5) — Zip en memoria con las entradas [{ name, data (Buffer o texto), stored? }]; deflate salvo stored → Uint8Array.
- `mkBook` (l. 17) — Libro .xlsx con una hoja «Precios» cuyo contenido de <sheetData> es `sheetData` (texto) y, opcionalmente, cadenas compartidas; extra añade entradas al zip.
- `rowXml` (l. 23) — Fila de texto en línea: <row><c r="A1" t="inlineStr"><is><t>…</t></is></c>…</row> con las celdas dadas (números → <v>).

## `shared/`

### `price-sheet.mjs`

[PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → objeto de precios. FUENTE ÚNICA de las reglas. Lo usan el Worker (workers/api), los scripts de Node (scripts/import_prices.mjs), el panel demo (se copia a assets/js/price-sheet.js al compilar) y tiene un port en PHP (backend-php/lib/PriceSheet.php) que se prueba contra los mismos casos (shared/price-sheet.fixtures.json).

Secciones: `[PRICE-SHEET]`

- `normHeader` (l. 35) — cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa)
- `normRef` (l. 37) — referencia → clave de comparación: mayúsculas, sin espacios
- `parseNumber` (l. 42) — número de una celda: acepta «27,75», «27.75093203», «1.234,56», «1,234.56», «22 000», «€ 5» y números ya numéricos; vacío, ilegible, infinito o por encima de MAX_NUMBER → null
- `applySheetItems` (l. 58) — Aplica los precios que trae una hoja (`sheetItems`) a los vigentes (`prevItems`). «merge» (por defecto): quita las referencias de `retire` y pone o actualiza las que trae la hoja
- `roundTo` (l. 65) — Redondea n a dec decimales (corrige los errores de coma flotante: 1.005 con 2 decimales da 1.01).
- `findHeader` (l. 68) — índice de la fila de cabecera (primera con una columna de referencia —o de ID de producto— y una de precio) y mapa columna → posición
- `readSheet` (l. 87) — rows: matriz (primera fila = cabecera o con filas de título delante). ctx (todo opcional):
- `col` (l. 97) — Celda de la fila r en la columna del campo f; cadena vacía si la hoja no tiene esa columna.
- `resolve` (l. 101) — Resuelve la fila a una línea del catálogo: { target, kind:'ref'|'sku'|'id'|'rule', extra? } · { skip: motivo } · { unknown: true }. Primero la referencia, luego el SKU, luego la familia nueva; el ID solo si la fila no trae referencia.
- `retireRow` (l. 121) — Anota para retirar la línea a la que apunta la fila (si se reconoce); las desconocidas no cuentan como tales.

### `xlsx.mjs`

[XLSX] Lector mínimo de libros .xlsx (un zip con XML) SIN dependencias: lo usa el Worker para leer la tarifa directamente de Drive (descarga del .xlsx tal cual, sin convertirlo a hoja de Google). Port en PHP: backend-php/api/lib/Xlsx.php. Ambos se prueban contra los mismos libros (shared/xlsx/*.xlsx, generados por scripts/make_xlsx_fixtures.py) y el mismo resultado esperado (shared/xlsx/esperado.json).

Secciones: `[XLSX]`

- `u16` (l. 19) — Enteros little-endian de 16 y 32 bits en la posición o de un DataView (formato del zip).
- `zipEntries` (l. 22) — índice del contenido del zip por nombre: { método, tamaño comprimido, posición de la cabecera local } (se lee del directorio central, al final del fichero)
- `spend` (l. 39) — descuenta n bytes del presupuesto de descompresión del libro; si se agota → «hoja demasiado grande o dañada»
- `entryText` (l. 41) — contenido de una entrada del zip (sin comprimir o deflate) como texto UTF-8; la descompresión se lee por trozos CONTANDO y se aborta al pasar de MAX_ENTRY (una bomba de 300 KB → 300 MB no se infla)
- `unesc` (l. 64) — entidades XML → texto (&amp; &lt; &#233; &#xE9;); un código fuera de rango (&#x110000;) se sustituye por el carácter de sustitución U+FFFD en vez de romper la lectura
- `nameCh` (l. 66) — True si el código de carácter c puede ir en un nombre de atributo XML: letras, cifras, «_», «:», «.» y «-»
- `attrs` (l. 68) — atributos de una etiqueta XML: ' r="A1" t="s"' → { r: 'A1', t: 's' } (recorrido lineal; solo comillas dobles, como escribe Excel)
- `findOpen` (l. 83) — posición de la siguiente apertura «<etiqueta» (seguida de espacio, «>» o «/», para no confundir <c con <cols) desde `from`, o -1
- `each` (l. 91) — Recorre los elementos «<tag …>…</tag>» y los autocerrados «<tag …/>» de xml[from, to) en orden y en tiempo LINEAL → { attr, bs, be }: texto de los atributos y rango del contenido (bs = be si no tiene). Una etiqueta sin cerrar = libro dañado.
- `between` (l. 103) — lo que hay entre la primera apertura `open` y el `close` que le sigue (por ejemplo <v>…</v>), o undefined si no hay
- `tText` (l. 105) — texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta (recorrido lineal)
- `sharedStrings` (l. 123) — cadenas compartidas del libro (xl/sharedStrings.xml): el texto de cada <si>, en orden
- `colIndex` (l. 135) — letras de columna → posición: A=0, Z=25, AA=26 … XFD=16383; una columna por encima de XFD (o con tantas letras que lo parezca) = libro dañado
- `sheetRows` (l. 138) — celdas de una hoja → filas (ver cabecera); con topes de filas, columnas y celdas
- `readXlsx` (l. 170) — @returns {Promise<{name:string, hidden:boolean, rows:any[][]}[]>}
- `text` (l. 173) — Texto de una entrada del zip por su nombre ('' si no existe).
- `pickSheet` (l. 193) — elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio

## `backend-php/api/`

### `config.sample.php`

CONFIGURACIÓN DEL API DE TORIVAC (hosting con Apache y PHP: cPanel, Plesk…). 1) Copia este fichero como config.php (en esta misma carpeta) y rellénalo. 2) config.php NO se sube a ningún repositorio: contiene claves. Permisos recomendados: 640.

### `cron.php`

[CRON] Sincroniza los precios desde la hoja de Drive y limpia lo caducado. cPanel → «Trabajos de Cron» → una vez al día (p. ej. 03:00):  /usr/local/bin/php /home/CUENTA/public_html/api/cron.php Plesk  → «Tareas programadas» → «Ejecutar un script PHP» → ruta  …/api/cron.php  (o «Obtener una URL» con cron_token)

Secciones: `[CRON]`

### `index.php`

[INDEX] Punto de entrada del API (api/index.php). El .htaccess de la web reescribe /api/* hasta aquí. Carga la configuración (config.php), inicializa el almacén de datos y despacha la petición. Los errores de PHP NUNCA se escriben en la respuesta (display_errors a 0): enseñarían rutas del servidor; van al registro de errores del dominio.

Secciones: `[INDEX]`

## `backend-php/api/lib/`

### `AdminData.php`

[ADMIN-DATA] Datos de gestión que NO se publican en la web: las propuestas de cambio (incluidas las que señalan carencias legales) y los datos de cobertura del catálogo. El build del sitio los escribe en generated/admin-data.json = {"proposals":[…],"admin":{"products":[…],"byRef":{…}}} y GET /api/admin/data los sirve SOLO a managers (el token maestro cuenta como manager; clientes y anónimos no pasan). Si el fichero falta o está dañado se devuelven listas vacías, nunca un error.

Secciones: `[ADMIN-DATA]`

- `setFile` (l. 15) — Cambia el fichero de datos que se lee (pruebas); null vuelve al de generated/.
- `load` (l. 22) — El contenido del fichero tal cual, con la forma garantizada: proposals (lista), admin.products (lista) y admin.byRef (objeto, aunque vaya vacío). Se decodifica a objetos

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

[AUTH] Contraseñas (password_hash: bcrypt/argon2 según el hosting) y sesiones firmadas HMAC-SHA256. Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma); payload = {sub, iat, exp(ms), sid}; caduca a las 24 h. El token NO dice qué rol tiene ni qué nombre: al verificarlo se busca a la persona y de su registro salen el rol y el nombre. Además va ligado al registro del usuario:

Secciones: `[AUTH]` · `[USERS]`

- `hashPassword` (l. 32) — Hash de contraseña (bcrypt/argon2 según el hosting) para guardar en el usuario.
- `verifyPassword` (l. 35) — Comprueba una contraseña contra su hash; un hash vacío nunca valida.
- `decoyHash` (l. 42) — Hash «señuelo» para que comprobar una contraseña de un usuario que no existe tarde lo mismo que la de uno que sí existe. Se genera en tiempo de ejecución con el coste
- `secretProblem` (l. 55) — Qué le pasa a un secreto de sesión: 'demasiado corto', 'sin cambiar' (lleva el texto de ejemplo) o null si vale.
- `sessionSecret` (l. 63) — El secreto de sesión de la configuración si es seguro; null si falta, es corto o es el de ejemplo (entonces no se crean ni se aceptan sesiones).
- `masterToken` (l. 70) — El token maestro (admin_token) si tiene 32 caracteres o más; null si está vacío o es corto (entonces no vale ninguno).
- `cronToken` (l. 77) — El token de la tarea programada por URL (cron_token) si tiene 24 caracteres o más; null si está vacío o es corto.
- `configProblems` (l. 84) — Nombres (nunca valores) de los ajustes de seguridad mal puestos: session_secret (corto, vacío o de ejemplo), admin_token y cron_token (puestos pero cortos).
- `signSession` (l. 94) — Firma una sesión {sub, iat, exp, sid} con HMAC-SHA256 y la devuelve como token. `$u` lleva sub (correo) y sid del usuario; el secreto debe ser seguro.
- `verifySession` (l. 104) — Comprueba firma, forma y caducidad de un token. @return array{sub:string,iat:int,exp:int,sid:string}|null (aún falta comprobar el usuario: ver authenticate)
- `authenticate` (l. 122) — quién llama: ['role','sub','name','master'?] o null. Con un token de sesión: la firma es buena, no ha caducado, la persona existe, su sid coincide con el del token y el token
- `requireRole` (l. 140) — Dice si la sesión existe y su rol es uno de los permitidos.
- `flat` (l. 157) — Minúsculas, sin acentos y solo letras y cifras: «Torivac-Manager-2026» → «torivacmanager2026».
- `key` (l. 160) — Clave del almacén de un usuario: user:<correo en minúsculas>.
- `pub` (l. 163) — Usuario sin el hash de la contraseña ni los datos de sesión (lo que puede salir al navegador).
- `passwordProblem` (l. 169) — Por qué NO vale una contraseña nueva (texto para mostrar) o null si vale: mínimo 12 caracteres, que no contenga la parte local del correo (si tiene 3 o más letras y cifras),
- `create` (l. 185) — @return array{user?:array,error?:string,status?:int}
- `all` (l. 210) — Lista de todos los usuarios sin hash, ordenados por correo.
- `exists` (l. 218) — ¿Existe ese usuario?
- `find` (l. 221) — Registro completo de un usuario (con hash, sid y sess_after: solo para uso interno), o null.
- `delete` (l. 228) — Borra un usuario por su correo (si se vuelve a crear tendrá otro sid: sus tokens anteriores no resucitan).
- `revokeSessions` (l. 234) — Invalida TODOS los tokens emitidos hasta ahora para ese usuario (sess_after = ahora). Devuelve false si el usuario no existe.
- `login` (l. 250) — Comprueba credenciales (mismo coste si el usuario no existe: no se puede enumerar usuarios por tiempo). Si valen, devuelve el usuario público y su sid para firmar la sesión;
- `check` (l. 261) — comprueba credenciales y devuelve el usuario público (sin sid), o null
- `upgrade` (l. 268) — Pone al día el registro tras un acceso correcto: sid si no lo tenía y hash nuevo si el coste de PASSWORD_DEFAULT subió. Devuelve el registro, o null si lo borraron entre medias.

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

[DIAG] Autodiagnóstico del servidor para quien despliega en un hosting con Apache y PHP (cPanel, Plesk…): versión de PHP, extensiones, carpeta de datos, configuración, correo, origen de precios, primer manager y última sincronización; y, si se mira por web, qué servidor es y qué IP ve del visitante. Se ve de dos formas: php api/tools/check.php [--net]      por línea de comandos (--net prueba además la salida a Internet)

Secciones: `[DIAG]`

- `c` (l. 16) — Una comprobación.
- `insideWebRoot` (l. 22) — Dice si un directorio está dentro de la web (cualquiera podría pedir sus ficheros si el .htaccess no se respetara): bajo la carpeta que contiene api/ (la web)
- `bytes` (l. 36) — Valor de php.ini con sufijo (8M, 512K, 1G) → bytes; 0 o -1 = sin límite → null.
- `run` (l. 48) — Ejecuta todas las comprobaciones.
- `web` (l. 137) — Comprobaciones que solo tienen sentido al mirar por web: qué servidor atiende (¿se aplica el .htaccess?), qué IP ve del visitante detrás de un proxy y si la

### `Http.php`

[HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google (sigue hasta 5 redirecciones de los GET, p. ej. la descarga de Drive). En las pruebas se sustituye por una función (Http::$mock) para no salir a Internet. Defensas (la URL sale de la configuración, pero un salto de la cadena de redirecciones no es de fiar):

Secciones: `[HTTP]`

- `hostIps` (l. 25) — Direcciones IP de un servidor: la propia si ya es una IP; si no, las que resuelve el DNS (IPv4 e IPv6). Vacío si no resuelve.
- `isPrivateIp` (l. 47) — ¿Es una IP privada, de loopback, de enlace local o reservada? Las que nunca debe alcanzar una redirección desde un servidor público. Usa filter_var con
- `isPrivateHost` (l. 62) — ¿Alguna de las direcciones de ese servidor es privada o local?
- `redirectProblem` (l. 72) — Motivo por el que se rechaza una redirección a `$next` (null = vale): solo http y https; y si la URL de partida era un servidor público (`$initialPublic`), el destino
- `request` (l. 88) — @param string[] $headers líneas «Nombre: valor»

### `Mail.php`

[MAIL] Envío de correo con tres controladores (config mail.driver): resend → API HTTP de Resend (recomendado; hay que verificar el dominio con SPF/DKIM) mail   → función mail() de PHP (el propio hosting; sin garantías de entrega si el SPF del dominio no incluye el servidor)

Secciones: `[MAIL]`

- `enabled` (l. 37) — ¿Hay un controlador de correo listo para enviar? (resend con clave, mail o file)
- `send` (l. 45) — @param array{to:string[],cc?:string[],subject:string,html?:string,text?:string,replyTo?:string,attachments?:array} $m
- `encodeHeader` (l. 80) — Codifica un asunto con caracteres no ASCII como palabra MIME UTF-8 en base64.
- `mime` (l. 83) — cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail()
- `money` (l. 108) — importe con el formato del idioma del cliente (es 1.234,56 €, en €1,234.56, fr 1 234,56 €, de 1.234,56 €)
- `orderMail` (l. 123) — Correo del pedido PARA EL EQUIPO. `$d['pdf']` (bool) dice si lleva el PDF del cliente: entonces añade la línea fija de que lo generó el navegador y el importe que vale es el del servidor.
- `copyMail` (l. 152) — Copia del presupuesto PARA EL CLIENTE: asunto fijo «Torivac · copia de tu presupuesto <número>», sin adjunto, y un cuerpo hecho SOLO con texto fijo en el idioma del pedido

### `Orders.php`

[ORDERS] POST /api/order y POST /api/contact: valida lo que llega del navegador (no es fiable), valora el pedido en servidor con los precios VIGENTES (ignora cualquier precio que mande el cliente), numera TV-AAAAMMDD-NNNN, guarda y envía por correo al equipo (con el PDF) y, si procede, una copia al cliente. Defensas: honeypot, límite por visitante (Request::ipKey) y límite global de pedidos por hora, Turnstile opcional, referencias solo del catálogo (o añadidas por la hoja de

Secciones: `[ORDERS]` · `[COPIA-AL-CLIENTE]` · `[PDF]`

- `validEmail` (l. 27) — ¿Es un correo válido? Cadena de ≤ 254 caracteres que cumple EMAIL y además pasa filter_var(FILTER_VALIDATE_EMAIL).
- `str` (l. 33) — Texto de un campo del cuerpo: '' si falta o es null; null si NO es una cadena (número, lista, objeto…), y entonces la petición se rechaza.
- `normalizePdf` (l. 43) — Valida el PDF que manda el navegador y lo devuelve normalizado (base64 canónico, sin saltos), o null si no vale: cadena base64 estricta (tras quitar saltos de línea), que
- `parseOrder` (l. 57) — @return array{order?:array,error?:string}
- `parseContact` (l. 99) — @return array{contact?:array,error?:string}
- `verifyTurnstile` (l. 117) — Turnstile opcional: sin secreto se omite; con secreto, falla cerrado
- `team` (l. 130) — destinatarios del equipo: config order_to (array o texto separado por comas)
- `copyMode` (l. 138) — Modo de la copia al cliente: 'capped' (con topes) o 'off'. Solo el texto «capped» (sin importar mayúsculas ni espacios alrededor) activa la copia; si no está puesto, es capped; CUALQUIER otro valor (también uno que no sea un texto) es off.
- `copyModeValid` (l. 145) — ¿Tiene order_copy un valor reconocido (capped u off, sin importar mayúsculas ni espacios) o no está puesto? Si no, se trata como off y el diagnóstico y /health avisan.
- `copyDailyMax` (l. 152) — Tope de copias al cliente en total por cada 24 h (config order_copy_daily_max; 150 si falta o no es un número; 0 = ninguna).
- `ordersPerHourMax` (l. 159) — Tope global de pedidos por hora (config orders_per_hour_max; 120 si falta o no es un número): protege la cuota del correo y el buzón del equipo.
- `nextNumber` (l. 166) — Siguiente número de pedido TV-AAAAMMDD-NNNN (contador diario con bloqueo para que dos pedidos no repitan número).
- `sendCopy` (l. 182) — Decide y envía la copia al cliente. Devuelve el motivo para emailed.customer_reason: 'not_requested' (el visitante mandó copy:false), 'off' (order_copy no es capped),
- `handleOrder` (l. 197) — POST /order: valida, valora con los precios del servidor, guarda el pedido y envía el correo al equipo (con el PDF del cliente) y, si procede, la copia al cliente.
- `handleContact` (l. 228) — POST /contact: valida el mensaje y lo envía al equipo con el correo del visitante como responder-a.

### `PriceSheet.php`

[PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → precios. Port FIEL de shared/price-sheet.mjs: las dos implementaciones se prueban con los mismos casos (shared/price-sheet.fixtures.json). FORMATOS: plantilla (ref · price · qty2/price2…), tarifa (Artículo · Descripción · Precio venta), exportación de WooCommerce (SKU · Producto · Precio · Oferta · Stock) y hojas por ID de producto (ID · Precio).

Secciones: `[PRICE-SHEET]`

- `normHeader` (l. 40) — cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa)
- `normRef` (l. 48) — referencia → clave de comparación: mayúsculas y sin espacios
- `parseNumber` (l. 57) — número de una celda («27,75», «1.234,56», «1,234.56», «22 000», «€ 5»…); vacío, ilegible, infinito o por encima de MAX_NUMBER → null
- `findHeader` (l. 78) — Cabecera: primera fila (de las 12 primeras) con una columna de referencia —o de ID de producto— y una de precio. @return array{index:int,map:array<string,int>,headers:string[]}|null
- `read` (l. 105) — @param array $rows matriz de celdas
- `num` (l. 216) — número sin ceros sobrantes, como lo escribe JavaScript (10, 10.5)

### `Prices.php`

[PRICES] Precios vigentes, tramos por cantidad, valoración de pedidos en servidor (el cliente nunca fija precios) e histórico. { updated_at, source, currency, mode:'demo'|'live'|'none', items:{ ref:{ p, t:[[cantMin,precio],…], note?, n?, pid? } } } Importes: el precio unitario conserva hasta 4 decimales; el importe de línea se redondea a 2.

Secciones: `[PRICES]` · `[SHEETS]`

- `load` (l. 24) — Precios vigentes; si todavía no hay, devuelve una hoja vacía (modo none).
- `coarse` (l. 31) — Origen sin datos personales ni identificadores: «upload:ana@torivac.com» → «upload», «sheet:ID» → «sheet».
- `publicView` (l. 34) — Lo que ve cualquier visitante de GET /prices: igual que el original pero sin el correo de quien cargó la hoja ni el id del archivo de Drive.
- `forJson` (l. 42) — para JSON: items vacío → {} y claves numéricas siempre como objeto
- `unit` (l. 49) — Precio unitario de una referencia para una cantidad, aplicando el último tramo alcanzado; null si no tiene precio.
- `priceOrder` (l. 59) — valora líneas [{ref,qty}]; sin precio → unit/total null («Consultar»: no suman)
- `withSheetItems` (l. 72) — catálogo del sitio + referencias que la hoja añadió dentro de un producto
- `mode` (l. 82) — Modo de actualización válido: «replace» (la hoja sustituye a toda la lista) o «merge» (solo lo que trae la hoja; es lo normal y vale para cualquier otro valor).
- `merge` (l. 88) — Aplica una hoja ya leída (`$sheet`) a los precios vigentes (`$prev`). «merge»: quita las referencias de `$retire` y pone o actualiza las que trae la hoja (si una referencia
- `massChange` (l. 101) — Aviso «cambio_masivo» si ≥ 10 referencias de la hoja ya tenían precio y más de la mitad cambia más de un 40 % (¿hoja equivocada, columna movida, otra unidad?); null si no.
- `diff` (l. 121) — diferencias entre dos juegos de precios
- `save` (l. 135) — guarda unos precios nuevos: el anterior pasa al histórico (90 días), se escriben los vigentes y la meta
- `recordSync` (l. 148) — Anota el resultado del último intento de sincronización (ver KEY_SYNC); un fallo al anotarlo nunca tapa el resultado real.
- `fromRows` (l. 154) — filas → ['prices' => …, 'report' => …] con las reglas compartidas de PriceSheet
- `parseCsv` (l. 166) — CSV (RFC 4180: comillas, separador , o ;, saltos de línea dentro de comillas) → filas
- `serviceAccount` (l. 188) — cuenta de servicio de Google: array, ruta a un .json o texto JSON
- `accessToken` (l. 200) — token de acceso OAuth2 (JWT RS256 firmado con openssl)
- `xlsxRows` (l. 215) — filas de la hoja de precios de un libro .xlsx descargado (bytes); si no es un libro, el error dice qué revisar
- `readRows` (l. 228) — Tres orígenes, en este orden:
- `plan` (l. 265) — Plan de una actualización, sin guardar nada: lee las filas, las aplica a los precios vigentes según `$mode` («merge»: solo lo que trae la hoja; «replace»: sustituye todo) y
- `sync` (l. 291) — Lee la hoja (Drive, CSV o filas subidas), valida y publica. `mode` («merge» por defecto, o prices.update_mode; «replace» sustituye toda la lista). ctx = contexto del catálogo (null → el del sitio; [] → aceptar todo, pruebas).

### `Request.php`

[REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP del visitante) + respuesta JSON + CORS + límite de uso. Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake). [CLIENT-IP] La IP del visitante sale de REMOTE_ADDR; solo si quien conecta es un proxy de confianza (una red privada, la propia dirección del servidor, Cloudflare

Secciones: `[REQUEST]` · `[CLIENT-IP]` · `[IP-KEY]` · `[CORS]` · `[RATE-LIMIT]`

- `fromGlobals` (l. 33) — construye la petición real a partir de $_SERVER; la ruta es lo que sigue a «/api»
- `readBody` (l. 55) — Lee el cuerpo de la petición (por defecto php://input) con un tope REAL: como mucho MAX_BODY + 1 bytes pasan a memoria, diga lo que diga Content-Length o aunque no lo diga
- `proxyList` (l. 64) — Proxies de confianza además de las redes privadas y Cloudflare: los de config `trusted_proxies` (lista o texto separado por comas) y la propia dirección
- `normalizeIp` (l. 74) — Una IP escrita de cualquier forma (con corchetes, con puerto, IPv4 dentro de IPv6…) en su forma normal; null si no es una IP.
- `inNet` (l. 86) — True si la IP está dentro de la red `a.b.c.d/n` o `x::/n` (una IP suelta cuenta como red de una sola dirección).
- `isTrustedProxy` (l. 104) — True si `$ip` es un proxy de confianza: red privada o local, Cloudflare o una de las redes extra de `trusted_proxies`.
- `clientIp` (l. 118) — IP del visitante. Una conexión directa NO se puede falsear con cabeceras (se usa REMOTE_ADDR tal cual). Solo si quien conecta es un proxy de confianza
- `ipKey` (l. 139) — Clave de límite por visitante: una IPv4 tal cual; una IPv6, su /64 en forma canónica «xxxx:xxxx:xxxx:xxxx::/64» (hextetos de 4 dígitos en minúsculas); una IPv4 escrita
- `fake` (l. 153) — petición simulada para pruebas
- `header` (l. 165) — Valor de una cabecera de la petición (nombre sin distinguir mayúsculas); cadena vacía si no existe.
- `json` (l. 168) — cuerpo JSON como array (null si no es válido, está anidado a más de 32 niveles o supera el límite de bytes)
- `bearer` (l. 176) — Token de la cabecera «Authorization: Bearer …», o null.
- `__construct` (l. 190) — Respuesta con cuerpo JSON, código HTTP y cabeceras (por defecto JSON UTF-8 y sin caché).
- `send` (l. 198) — Envía código, cabeceras y cuerpo JSON (sin cuerpo en 204 y 304). Si el cuerpo no se puede codificar responde un 500 genérico con un id (el detalle va al registro).
- `allowed` (l. 221) — Dice si un origen puede usar el API: el propio sitio, las peticiones sin Origin o los de allowed_origins.
- `headers` (l. 236) — Cabeceras CORS para un origen permitido.
- `key` (l. 257) — Clave del almacén de un contador: rl:<cubo>:<sha256 del identificador, 32 caracteres>.
- `hit` (l. 260) — @return array{allowed:bool,remaining:int,resetAt:int}
- `exceeded` (l. 276) — ¿Ha llegado el contador de fallos de ese cubo e identificador a `$max` en la ventana actual? No suma nada.
- `fail` (l. 283) — Anota un fallo (la ventana cuenta desde el primero) y devuelve cuántos lleva en ella.
- `clear` (l. 299) — Pone a cero el contador de fallos (tras un acceso correcto).
- `purgeExpired` (l. 306) — Borra ahora hasta PURGE_MAX registros de límite caducados; devuelve cuántos.
- `maybePurge` (l. 312) — Con probabilidad 1/purgeOneIn limpia registros caducados; un fallo al limpiar nunca rompe la petición.

### `Router.php`

[ROUTER] Rutas del API (equivalentes a workers/api/src/index.js: la web usa el mismo contrato con el Worker o con este PHP). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login USUARIO   GET /api/auth/me · POST /api/auth/logout (cierra TODAS las sesiones de esa persona) · GET /api/orders (manager: los 300 últimos; cliente: los suyos, hasta 100)

Secciones: `[ROUTER]` · `[LIMITES]` · `[ERRORES]`

- `handle` (l. 41) — Atiende una petición: comprueba el origen (CORS), despacha a la ruta y convierte las excepciones en respuestas JSON con su código.
- `mergeVary` (l. 61) — Une dos valores de la cabecera Vary sin repetir (Origin va primero): la respuesta depende del origen Y de la sesión, y una caché compartida debe saberlo.
- `failure` (l. 73) — Convierte una excepción en la respuesta que ve quien llama: una petición o hoja mal formada (InvalidArgumentException) = 400 con su mensaje; un RuntimeException con código HTTP
- `tooMany` (l. 84) — El 429 de siempre: mismo texto para todos los límites de acceso, exista o no el usuario.
- `authenticate` (l. 91) — Autentica la petición. Devuelve [quién|null, respuesta 429|null]. Sin Bearer no hay nada que probar. Con Bearer, un visitante (ipKey) con 30 fallos en 10 min ni siquiera llega a
- `health` (l. 102) — GET /health: vivo, y si algún ajuste de seguridad está mal (secreto de sesión, token maestro o de cron, modo de la copia al cliente) lo dice con su NOMBRE (nunca el valor).
- `prices` (l. 112) — GET /prices: el público ve la lista sin quién la cargó ni de dónde; un manager lo ve todo (y el estado de la última sincronización). Con la IP bloqueada por tokens fallidos se sirve la vista pública.
- `login` (l. 132) — POST /auth/login: tres límites (visitante+correo, visitante, cuenta), contraseña con coste igual exista o no el usuario y token ligado al sid del usuario.
- `cronByUrl` (l. 160) — GET /cron?token=…: sincroniza los precios si el token es el de cron_token (≥ 24 caracteres); 10 fallos / 10 min por visitante → 429; sin cron_token válido la URL está desactivada (401).
- `forClient` (l. 175) — Un pedido tal como lo ve un cliente: sin la IP desde la que se hizo ni el motivo técnico del fallo del correo (eso es solo para managers).
- `orders` (l. 183) — GET /orders: un manager recibe los 300 pedidos más recientes; un cliente, los suyos (los que llevan su correo) hasta 100, mirando solo los 3000 más recientes. `truncated:true` si se cortó.
- `route` (l. 205) — Tabla de rutas: públicas, de usuario autenticado y de manager (ver la lista de la cabecera).
- `cron` (l. 273) — sincroniza los precios (cron diario) y limpia lo caducado (también si la hoja se rechaza: esa limpieza no depende de la hoja)

### `Store.php`

[STORE] Almacén clave-valor en ficheros JSON (sustituye a Cloudflare KV en un hosting con Apache y PHP: cPanel, Plesk…). claves: user:<email> · order:<nº> · prices:current · prices:meta · prices:sync · prices:history:<ts> · rl:<cubo>:<sha256 de 32 caracteres del id> · counter:<yyyymmdd> · proposals:state · auth:decoy Escritura atómica (fichero temporal + rename) y bloqueo flock para los contadores. Caducidad opcional (TTL) comprobada al leer.

Secciones: `[STORE]`

- `candidates` (l. 27) — Carpetas donde guardar los datos cuando `storage_dir` está vacío, de mejor a peor:
- `bootstrap` (l. 43) — Prepara el almacén y devuelve su carpeta. Orden: 1) `$configured` (config storage_dir) si se puede usar; 2) una de `candidates()` que YA sea un almacén
- `usable` (l. 58) — Dice si una carpeta sirve de almacén: existe (o se puede crear con sus subcarpetas) y se puede escribir en ella.
- `initialized` (l. 65) — Dice si una carpeta ya es un almacén de este API (tiene su subcarpeta kv).
- `note` (l. 68) — Aviso de bootstrap(): se usó una carpeta distinta de la configurada ('' si todo normal).
- `init` (l. 74) — crea las carpetas y protege el directorio. Las carpetas nuevas quedan en 0770 aunque el umask del servidor diga otra cosa; en un almacén anterior (0775/0755), kv, locks y
- `root` (l. 93) — Carpeta de datos en uso.
- `file` (l. 96) — Fichero JSON que guarda una clave (la clave se codifica para que sea un nombre de fichero válido).
- `get` (l. 99) — valor guardado (array/escalar) o null si no existe o caducó
- `put` (l. 115) — Guarda un valor de forma atómica (fichero temporal + rename) con caducidad opcional en segundos. Si el valor no se puede codificar a JSON LANZA una excepción
- `delete` (l. 129) — Borra una clave.
- `keys` (l. 132) — claves que empiezan por un prefijo (sin las caducadas)
- `names` (l. 144) — Claves que empiezan por un prefijo SIN leer sus ficheros ni mirar la caducidad, de la más reciente (orden descendente) a la más antigua: para listar «los últimos N».
- `locked` (l. 153) — ejecuta $fn con un bloqueo exclusivo (contador de pedidos, límites de uso)
- `purge` (l. 165) — borra lo caducado (lo llama el cron) y los temporales de escrituras interrumpidas (más de una hora)
- `purgeRl` (l. 180) — Borra hasta `$max` registros de límite de uso (rl:*) caducados, mirando como mucho `$maxScan` ficheros (a partir de una posición al azar si hay más): es la limpieza «al vuelo»

### `Util.php`

[UTIL] Utilidades sin estado: codificaciones, redondeo, escape HTML y comparaciones seguras. Compatible con PHP 7.4 o superior (sin match, str_contains ni argumentos con nombre).

Secciones: `[UTIL]`

- `b64url` (l. 11) — binario → base64 URL-safe sin relleno
- `unb64url` (l. 14) — base64 URL-safe → binario ('' si no es válido)
- `round2` (l. 23) — importe de línea: 2 decimales (mitad hacia arriba, igual que el navegador y el Worker)
- `round4` (l. 26) — precio unitario: 4 decimales (variaciones de céntimos)
- `esc` (l. 29) — escape para HTML
- `eq` (l. 32) — comparación en tiempo constante
- `secretEq` (l. 35) — Compara un secreto conocido con lo que manda quien llama en tiempo constante TAMBIÉN en la longitud: se comparan los resúmenes sha-256 (hash_equals sola sale antes si las longitudes difieren).
- `startsWith` (l. 38) — Dice si un texto empieza por otro.
- `nowMs` (l. 41) — milisegundos desde 1970
- `iso` (l. 44) — ISO 8601 con milisegundos y Z, como JavaScript (new Date().toISOString())
- `obj` (l. 51) — un array vacío debe salir como {} en JSON (no como []): lo necesitan items de precios y mapas
- `enc` (l. 60) — JSON legible y fiel: sin escapar tildes ni barras. Si no se puede codificar (una cifra infinita, demasiada profundidad…) LANZA una excepción: antes devolvía «null»
- `clean` (l. 68) — cadena limpia de caracteres de control y recortada
- `line` (l. 79) — Texto de UNA línea (nombre, empresa, teléfono, correo): los saltos de línea, tabuladores y demás caracteres de control (también los de dirección del texto) se
- `text` (l. 89) — Texto de varias líneas (notas, mensajes): conserva los saltos de línea (\r\n y \r pasan a \n) y los tabuladores, pero quita los demás caracteres de control.
- `sha32` (l. 99) — Resumen sha-256 en hexadecimal recortado a 32 caracteres: para claves del almacén que no deben llevar el dato (correos, IP) ni crecer con él.
- `isList` (l. 102) — ¿es una lista (array indexado 0..n-1)? (array_is_list existe solo desde PHP 8.1)

### `Xlsx.php`

[XLSX] Lector mínimo de libros .xlsx (zip + XML) sin extensiones ni librerías: la tarifa se lee directamente de Drive sin convertirla a hoja de Google. Port en PHP de shared/xlsx.mjs; ambos se prueban con los mismos libros (shared/xlsx/*.xlsx) y el mismo resultado esperado (shared/xlsx/esperado.json). Xlsx::read($bytes)           → [['name' => …, 'hidden' => bool, 'rows' => [[…], …]], …]   hojas en el orden del libro

Secciones: `[XLSX]` · `[TOPES]`

- `u16` (l. 39) — Entero de 16 bits little-endian en la posición o del texto binario (formato del zip).
- `u32` (l. 42) — Entero de 32 bits little-endian en la posición o del texto binario (formato del zip).
- `entries` (l. 45) — índice del contenido del zip por nombre: método, tamaños, y posición de la cabecera local (del directorio central, al final del fichero)
- `text` (l. 63) — contenido de una entrada del zip (sin comprimir o deflate), con tope por entrada y en total (`$budget` = bytes que aún se pueden leer en este libro)
- `unesc` (l. 82) — entidades XML → texto (&amp; &lt; &#233; &#xE9;)
- `attrs` (l. 85) — atributos de una etiqueta XML: ' r="A1" t="s"' → ['r' => 'A1', 't' => 's'] (una etiqueta de más de 4 KB de atributos no es de un libro real)
- `endsName` (l. 94) — ¿Es `$c` (el carácter que sigue al nombre de una etiqueta) un final de nombre? (espacio, «>» o «/»: así <row no confunde <rowBreaks)
- `each` (l. 100) — Recorre en una sola pasada los elementos <tag …>contenido</tag> y <tag …/> de un XML y llama a `$fn(atributos, contenido)` (contenido = null si es <tag …/>).
- `eachOpen` (l. 121) — Recorre las etiquetas <tag …> o <tag …/> (solo atributos, sin contenido) y llama a `$fn(atributos)`.
- `tText` (l. 137) — texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta
- `colIndex` (l. 155) — letras de columna → posición: A=0, Z=25, AA=26, XFD=16383 (más de 3 letras o pasar de XFD no es una columna de Excel)
- `sheetRows` (l. 167) — celdas de una hoja → filas (ver cabecera)
- `read` (l. 211) — @return array<int,array{name:string,hidden:bool,rows:array}>
- `pick` (l. 241) — elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio

### `autoload.php`

Autocarga mínima de las clases Torivac\* (cada una vive en lib/; las auxiliares comparten fichero con su clase principal)

## `backend-php/api/tools/`

### `check.php`

[CHECK] Comprobación de la instalación desde la línea de comandos (Terminal de cPanel, SSH o, en Plesk, una tarea programada de «Ejecutar un comando»): php api/tools/check.php           revisa PHP, extensiones, carpeta de datos, config.php, correo, precios y primer manager php api/tools/check.php --net     además prueba la salida a Internet (Resend, Google, Anthropic)

Secciones: `[CHECK]`

### `create-user.php`

[CREATE-USER] Crea un usuario desde la línea de comandos (el primer manager, o clientes): php api/tools/create-user.php correo@dominio.com "Nombre Apellido" manager "contraseña de al menos 12 caracteres" Roles: manager (todo) · client (solo sus pedidos). La contraseña se guarda con password_hash. Se rechaza una contraseña de menos de 12 caracteres, que contenga la parte local del

Secciones: `[CREATE-USER]`

## `backend-php/api/tests/`

### `ApiTest.php`

Pruebas del API en PHP: equivalen a workers/api/test/api.test.js + ai.test.js (sin red: Resend, Google y Anthropic se simulan con Http::$mock)

- `test_auth_sessions` (l. 22) — Sesión firmada {sub, iat, exp, sid} (sin rol): válida, manipulada y caducada; la contraseña se guarda con hash.
- `test_users_and_login` (l. 36) — Alta de usuarios, duplicados, login (sin el hash en la respuesta) y bloqueo tras varios intentos.
- `test_prices_tiers_and_rounding` (l. 54) — Tramos por cantidad, importe de línea redondeado a 2 decimales y diferencias entre hojas de precios.
- `test_sheet_sync_rules` (l. 66) — Sincronización de la hoja en modo «replace» (la hoja sustituye a toda la lista): rechaza hojas con menos del 50 % de referencias o con precio de relleno salvo force; guarda el histórico.
- `test_partial_price_updates` (l. 87) — Actualización parcial (modo por defecto): la hoja puede traer solo una parte del catálogo, reconocida por referencia, SKU o ID; precio 0 o active = 0 quitan el precio; lo demás se conserva.
- `test_mass_price_change_guard` (l. 126) — Cambio masivo: si más de la mitad de las referencias que ya tenían precio cambia más de un 40 %, la sincronización se rechaza salvo force (hoja equivocada, columna movida, otra unidad).
- `test_csv_parser` (l. 141) — CSV con comillas, separadores dentro de comillas, BOM y separador coma o punto y coma.
- `test_google_jwt` (l. 148) — Token de la cuenta de servicio de Google: firma RS256 verificable con la clave pública.
- `test_order_flow_server_side_pricing` (l. 164) — Pedido: el servidor valora con sus precios (ignora los del cliente), numera, guarda y envía.
- `test_order_validation_and_limits` (l. 184) — Validación del pedido (campos, cantidades, referencias, PDF, honeypot) y límite por IP.
- `test_order_with_resend_driver` (l. 201) — Envío con Resend: destinatarios, copia al cliente, responder-a y PDF adjunto.
- `test_mime_builder` (l. 221) — Cuerpo MIME para mail(): texto y HTML, adjunto y cabeceras.
- `test_contact_and_cors` (l. 229) — Formulario de contacto y reglas CORS (origen ajeno, el propio sitio y preflight).
- `test_prices_endpoint_etag` (l. 247) — GET /prices: precios públicos con ETag (304) y `items` como objeto {} aunque esté vacío.
- `test_manager_upload_roles_and_cron` (l. 258) — Subida de hojas (vista previa y aplicar), permisos por rol, referencia nueva por regla de familia y cron por URL con token.
- `test_orders_visibility_and_users_api` (l. 286) — Un manager ve todos los pedidos y cada cliente solo los suyos; alta y baja de usuarios por el API.
- `ai_reply` (l. 309) — Servidor de IA simulado: contesta con una propuesta de cambios de precios (uso de herramienta de Anthropic).
- `test_ai_validation_and_flow` (l. 315) — IA de precios: valida y limita lo que propone; la propuesta no escribe nada y solo se aplica lo confirmado.
- `test_diag_checks` (l. 349) — Autodiagnóstico: una instalación a medias da errores que dicen qué arreglar, y una completa pasa sin fallos.
- `test_privacy_session_revocation_and_contact_escaping` (l. 376) — GET /prices: el público no ve quién cargó la hoja ni el id de Drive; un manager sí; un usuario borrado pierde la sesión; el contacto escapa el HTML.
- `test_http_client_follows_redirects_without_leaking_credentials` (l. 408) — Cliente HTTP real contra un servidor local: sigue redirecciones de los GET a mano, no manda la credencial a otro servidor y corta los bucles.
- `test_email_status_is_never_overstated` (l. 441) — El correo es parte del resultado: el pedido se guarda siempre y dice si el aviso salió; el contacto falla si el mensaje no pudo enviarse.
- `test_diag_warns_about_orders_without_email` (l. 466) — El autodiagnóstico avisa si los últimos pedidos se guardaron sin que saliera su aviso por correo.

### `HostingTest.php`

Pruebas de lo que cambia de un hosting a otro (cPanel, Plesk…): la carpeta de datos que se elige, la IP real del visitante detrás de un proxy (el nginx de Plesk, Cloudflare) y las comprobaciones del diagnóstico que dependen del servidor. Sin red ni servidor web: todo con rutas temporales y $_SERVER simulado.

- `hosting_tmpdir` (l. 16) — Carpeta temporal nueva y vacía para una prueba.
- `hosting_rmtree` (l. 24) — Borra una carpeta temporal con todo lo que lleva dentro.
- `hosting_status` (l. 32) — Estado de cada comprobación del diagnóstico por su id.
- `test_client_ip_behind_proxies` (l. 40) — IP del visitante: sin proxy no se puede falsear con cabeceras; detrás de un proxy de confianza (nginx de Plesk, Cloudflare) se lee X-Forwarded-For de derecha a izquierda.
- `test_ip_in_net` (l. 62) — Pertenencia a una red: límites, máscaras que no son múltiplo de 8, IPv6, familias distintas, IP suelta y /0.
- `test_proxy_list` (l. 72) — Proxies de confianza extra: los de config (lista o texto con comas) más la dirección del propio servidor.
- `test_request_from_globals_ip` (l. 83) — Petición real (a partir de $_SERVER): nginx de Plesk que llama a Apache por la IP pública de la máquina, y conexión directa con cabeceras falsas.
- `test_store_picks_a_usable_data_folder` (l. 100) — Carpeta de datos: la configurada, un almacén que ya tiene datos, la primera que se pueda crear, o error claro; un fichero en medio hace de «raíz de solo lectura» (Plesk).
- `test_diag_reports_data_folder_deviation` (l. 134) — El diagnóstico avisa cuando la carpeta de datos configurada no sirvió y se usó otra; por línea de comandos sabe si la carpeta cae dentro de la web.
- `test_diag_web_checks` (l. 155) — Comprobaciones de servidor del diagnóstico: nginx sin Apache ignora el .htaccess; la IP del visitante tras un proxy; HTTPS.

### `PriceSheetTest.php`

Pruebas de PriceSheet con los casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json)

- `fixtures` (l. 8) — Casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json).
- `test_price_sheet_cases` (l. 16) — Cada caso de hoja → precios, desconocidas, nuevas y filas ignoradas esperados.
- `test_price_sheet_numbers` (l. 43) — Números de celda: coma o punto decimal, miles, símbolos de moneda y texto ilegible.
- `test_price_sheet_errors` (l. 51) — Hojas sin cabecera reconocible o vacías: error claro.

### `SecurityAuthTest.php`

Pruebas de seguridad del acceso, las sesiones y los límites (informe del revisor del PHP: A2, A3, A4, A5, A12 · decisiones D2, D3 y D4). Cada hallazgo reproduce el ataque del informe y comprueba que ya no funciona, y que lo legítimo sigue funcionando. Sin red ni servidor web.

- `sa_order_status` (l. 22) — Pedido por el manejador desde una IP devolviendo solo el código HTTP (para las pruebas de límites).
- `ipkey_fixtures` (l. 28) — Casos compartidos de la clave de límite por visitante (shared/ip-key.fixtures.json; en el paquete del hosting hay una copia junto a las pruebas).
- `sa_login` (l. 36) — Intento de acceso por el manejador desde una IP; devuelve la respuesta.
- `sa_get` (l. 42) — Llamada GET a una ruta con un token (o sin él) desde una IP.
- `sa_cron` (l. 48) — Llamada GET /cron?token=… desde una IP.
- `sa_forge` (l. 56) — Token firmado a mano con el secreto de pruebas (para probar tokens que el servidor nunca emitiría).
- `test_d2_ip_key_shared_cases` (l. 63) — D2 · Los mismos casos de ipKey que el Worker (shared/ip-key.fixtures.json): IPv4 tal cual, IPv6 por su /64, IPv4 dentro de IPv6 y lo ilegible = «0».
- `test_a2_ipv6_addresses_of_one_slash64_share_every_limit` (l. 72) — A2 · Los límites por visitante (acceso, pedido, contacto) cuentan por /64: 30 direcciones de un mismo /64 ya no son 30 visitantes, y otro /64 u otra IPv4 sí tienen cupo propio.
- `test_d3_login_limits_per_ip_and_per_account` (l. 97) — D3 · Tres límites de acceso con el mismo 429: por visitante y correo (6), por visitante contra cualquier cuenta (30) y por cuenta de cualquier IP (12 fallos, solo cuentas que existen).
- `test_d3_failure_counters_window_and_reset` (l. 149) — Contadores de fallos (exceeded / fail / clear): ventana fija desde el primer fallo, sin sumar al mirar, y hit() sigue contando cada llamada.
- `test_a4_rate_limit_keys_are_bounded_and_expired_ones_purged` (l. 164) — A4 · Un correo de 300 caracteres ya no rompe el guardado ni se hace eco de la clave en el error; los contadores caducados se purgan «al vuelo» y no crecen sin límite.
- `test_a12_bearer_and_cron_failure_limits` (l. 195) — A12 · Un Bearer inválido (30 fallos / 10 min por visitante) y una llamada al cron con token erróneo (10 / 10 min) acaban en 429; una petición válida no consume cupo.
- `test_d3_secret_minimum_lengths_fail_closed` (l. 239) — D3 · Secretos con longitud mínima que fallan cerrado: session_secret ≥ 32 y sin «CAMBIA-ESTO», admin_token ≥ 32, cron_token ≥ 24; el diagnóstico y /health lo dicen con el NOMBRE del ajuste.
- `test_d3_password_policy_for_new_users` (l. 290) — D3 · Contraseñas nuevas: ≥ 12, sin la parte local del correo y fuera de la lista de triviales; por la API y por la herramienta de línea de comandos. Los usuarios ya creados no se tocan.
- `test_d4_sessions_are_bound_to_the_user_record` (l. 344) — D4 · La sesión va ligada al usuario: el token lleva {sub, iat, exp, sid} (sin rol), el rol sale del registro, los tokens sin sid no valen y el borrado + alta con el mismo correo no los resucita (A5).
- `test_d4_logout_revokes_every_earlier_token` (l. 392) — D4 · POST /api/auth/logout invalida TODOS los tokens anteriores de esa persona (sess_after); el token maestro no tiene sesión; los de otras personas no se tocan.
- `test_a3_decoy_hash_follows_the_current_default_cost` (l. 426) — A3 · El hash «señuelo» que iguala el tiempo de un usuario inexistente se genera con el coste actual de PASSWORD_DEFAULT (10 en PHP ≤ 8.3, 12 en 8.4) y se cachea; ya no es un literal de 61 caracteres.
- `test_d6_vary_merges_origin_and_authorization` (l. 455) — Las respuestas con Origin ajeno o propio siguen igual y Vary lleva Origin y Authorization a la vez (antes el de la ruta pisaba al de CORS).

### `SecurityDataTest.php`

Pruebas de seguridad de los precios, los errores, las descargas, el lector de .xlsx, los datos de gestión y el despliegue (informe del revisor del PHP: A6, A7, A8, A9, A10, A11 · decisiones D5, D6, D8, D9 y D10). Cada hallazgo reproduce el ataque del informe y comprueba que ya no funciona, y que lo legítimo sigue funcionando. Lo que necesita un servidor o un proceso aparte (memoria, display_errors, redirecciones) usa `php -S` o un proceso hijo en 127.0.0.1; no hay red.

- `sd_seed` (l. 29) — Guarda `$n` precios vigentes R0…R(n-1) con precio 10, 11, 12…
- `sd_rows` (l. 37) — Filas de una hoja con R0…R(total-1) al mismo precio que `sd_seed`, salvo las de `$retire`, que van con precio 0 (o con active = 0 si `$active`).
- `sd_catalog` (l. 48) — Catálogo con R0…R(n-1) pedibles (para que la sincronización por el flujo normal reconozca esas referencias).
- `sd_with_error_log` (l. 56) — Ejecuta `$fn` con el registro de errores de PHP desviado a un fichero y devuelve [resultado, texto del registro].
- `test_d5_sheet_that_retires_many_prices_needs_force` (l. 67) — D5 · Una hoja que retira ≥ 10 referencias y más del 30 % de los precios vigentes, o tras la cual quedaría menos del 50 % (siendo ≥ 10), exige force: no se aplica en silencio.
- `test_d5_mass_change_counts_retired_prices` (l. 106) — D5 · massChange cuenta los precios retirados como cambios del 100 %.
- `test_d5_automatic_sync_never_applies_a_blocked_sheet` (l. 120) — D5 · La sincronización automática (cron, URL del cron, «Actualizar ahora») NUNCA aplica una hoja con bloqueos: conserva los precios, anota el motivo y el panel y el diagnóstico lo muestran.
- `sa_cron_url` (l. 167) — Llamada GET /cron con el token de pruebas desde una IP libre.
- `test_a6_json_failures_throw_instead_of_nulling_data` (l. 176) — A6 · Un valor que no se puede codificar a JSON (1e999 = INF) ya no vacía lo guardado: enc() y Store::put() lanzan una excepción y lo anterior queda intacto.
- `test_a8_internal_observations_are_not_published` (l. 207) — A8 · La nota pública solo sale de una columna explícita: «Observaciones» (anotaciones internas) no se publica en GET /prices.
- `test_d6_internal_errors_are_generic_and_logged_with_an_id` (l. 221) — D6 · Ningún 500 devuelve el mensaje interno: respuesta genérica con id de 8 hex y el detalle al registro; los errores pensados para quien llama (400, 409, 502, 503…) conservan su texto.
- `test_d6_body_cap_and_json_depth` (l. 258) — D6 · Tope REAL del cuerpo (se lee como mucho 6 MB + 1 byte, aunque Content-Length mienta o falte) y JSON anidado como mucho a 32 niveles → petición no válida (400).
- `test_d6_real_server_hides_php_warnings_and_rejects_oversized_bodies` (l. 284) — D6/A9 · Con el API real (`php -S`, display_errors=1 en el servidor): un aviso interno de PHP nunca llega a la respuesta, y un cuerpo de 7 MB o un JSON demasiado hondo dan 400.
- `test_a7_xlsx_reader_limits_memory_and_columns` (l. 315) — D8/A7 · El lector de .xlsx tiene topes: una bomba de descompresión (aunque el libro mienta sobre su tamaño) o una columna absurda dan «La hoja es demasiado grande o está dañada» sin agotar la memoria.
- `test_a7_xlsx_reader_is_linear_on_unclosed_elements` (l. 355) — D8/W11 · El XML se recorre en una sola pasada: miles de <row>, <c>, <si>, <Relationship> o <sheet> sin cerrar ya no son cuadráticos.
- `test_d8_oversized_workbook_keeps_current_prices` (l. 383) — D8 · Una hoja .xlsx hostil hace fallar la sincronización con un error claro, conserva los precios vigentes y deja el motivo anotado.
- `test_a11_http_client_protocols_size_and_private_redirects` (l. 400) — A11 · El cliente HTTP solo sigue http y https (una redirección a file:/// devolvía el contenido de ese fichero), con tope de tamaño de respuesta y sin llegar a redes internas desde un servidor público.
- `test_d9_admin_data_is_only_for_managers` (l. 454) — D9 · GET /api/admin/data: las propuestas y los datos de cobertura solo los ve un manager (el token maestro también); clientes y anónimos no; sin fichero → listas vacías, nunca un error.
- `test_d10_htaccess_is_a_whitelist` (l. 492) — D10/A10 · .htaccess pasa a lista blanca: Require all denied para todo salvo index.php (y la sintaxis equivalente de Apache 2.2); lib/, tools/, cron.php, config.php, generated/ y storage/ no se sirven.
- `test_d10_new_files_and_dirs_are_private` (l. 515) — D10/A10 · Ficheros nuevos 0660 y carpetas 0770 (con umask 022 salían 0664/0755, legibles por otros usuarios del hosting); un almacén anterior se cierra a «otros» en su siguiente uso.
- `test_d10_diag_checks_the_new_settings` (l. 545) — D10 · El diagnóstico comprueba lo nuevo: secretos cortos (por su nombre, nunca el valor), modo de la copia al cliente, tope diario y tope de pedidos por hora.

### `SecurityOrdersTest.php`

Pruebas de seguridad de los pedidos y del contacto (informe del revisor del PHP: A1, A9, A13 · decisiones D1 y D7). Cada hallazgo reproduce el ataque del informe y comprueba que ya no funciona, y que lo legítimo sigue funcionando. Sin red ni servidor web (el correo es el controlador «file» o un Http::$mock).

- `so_mail_to` (l. 23) — El correo guardado en la bandeja de salida cuyo destinatario es `$to` (o null).
- `so_warnings` (l. 30) — Ejecuta `$fn` y devuelve los avisos y notas de PHP que haya provocado (deben ser ninguno).
- `test_a1_copy_to_customer_has_only_server_text_and_no_attachment` (l. 39) — A1 · La copia al cliente solo lleva contenido del servidor: nada de lo que escribió el visitante y SIN adjunto; el PDF y los datos del visitante solo van al equipo.
- `test_d1_copy_text_follows_the_order_language` (l. 63) — A1 · El texto fijo de la copia sale en el idioma del pedido (es, en, fr, de) y el asunto es siempre el mismo.
- `test_a1_pdf_is_validated_and_normalized` (l. 83) — A1 · El PDF del visitante se valida de verdad (base64 estricto, %PDF-, ≤ 4 MB) y se reenvía normalizado, solo al equipo.
- `test_d1_copy_mode_off_unknown_values_and_reasons` (l. 120) — D1 · order_copy: capped por defecto, off y cualquier otro valor = no se envía copia (falla cerrado); copy:false y correo sin configurar también tienen su motivo.
- `test_d1_copy_caps_per_recipient_and_per_day` (l. 150) — D1 · Topes de la copia: 2 por destinatario cada 24 h (clave = sha256 del correo) y `order_copy_daily_max` al día en total; superado un tope, el pedido y el aviso al equipo salen igual.
- `test_d1_global_orders_per_hour_cap` (l. 183) — D1 · Tope global de pedidos por hora (orders_per_hour_max, 120 por defecto): 429 y no se guarda nada; solo cuentan los pedidos válidos.
- `test_a13_single_line_fields_and_notes_are_cleaned` (l. 201) — A13 · Los campos de una línea no admiten saltos de línea ni controles (asunto del correo al equipo); las notas conservan los saltos pero no los controles raros.
- `test_a13_email_validation_is_strict` (l. 226) — A13 · Correo del visitante: la expresión del servidor es más estricta que la de antes (sin , ; < > " ( ) [ ] \ | ni espacios) y además pasa filter_var.
- `test_a9_non_string_fields_are_rejected_without_php_warnings` (l. 246) — A9 · Todos los campos de texto del pedido, el contacto y el acceso deben ser cadenas: un array o un número se rechaza con 400 y sin avisos de PHP.
- `test_d7_client_orders_hide_ip_and_mail_error` (l. 276) — D7 · A un cliente no se le devuelve la IP del pedido ni el motivo técnico del fallo del correo; un manager (y el token maestro) lo ve todo.
- `test_d7_orders_list_is_capped` (l. 302) — D7 · El listado de pedidos no revienta con miles: un manager recibe los 300 más recientes y un cliente hasta 100 de los suyos, con truncated:true si se cortó.
- `test_d7_prototype_names_are_not_valid_references` (l. 326) — D7/W8 · Nombres como «constructor», «__proto__» o «toString» no son referencias del catálogo (en PHP los arrays no tienen el problema; se cubre con una prueba).

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

- `fresh` (l. 25) — Almacén temporal nuevo, configuración y catálogo sintéticos de las pruebas.
- `prices` (l. 40) — Precios de ejemplo: TT0020210 con tramos y P16633.
- `seedPrices` (l. 46) — Guarda los precios de ejemplo en el almacén.
- `goodOrder` (l. 49) — Pedido válido de ejemplo (se puede sobrescribir cualquier campo).
- `req` (l. 55) — Petición simulada para llamar al Router sin servidor web.
- `wire` (l. 58) — cuerpo de una respuesta tal y como lo recibe un cliente (JSON → arrays): los `items` de precios viajan como objeto y en el servidor son stdClass
- `master` (l. 61) — Cabecera de autenticación con el token maestro.
- `bearer` (l. 64) — Cabecera de autenticación con un token de sesión.
- `login_token` (l. 67) — Inicia sesión por el API y devuelve el token (null si no entra).
- `kv_files` (l. 74) — Nombres de los ficheros del almacén (kv/) que empiezan por un prefijo ya codificado como en disco («rl%3A» para las claves rl:).
- `outbox` (l. 82) — correos guardados por el controlador «file»
- `tmp_dir` (l. 92) — Carpeta temporal nueva y vacía para una prueba (la borra quien la pide con rmtree_all).
- `rmtree_all` (l. 100) — Borra una carpeta temporal con todo lo que lleva dentro.
- `php_child` (l. 111) — Ejecuta código PHP en un proceso aparte (con la autocarga del API) y devuelve [código de salida, salida estándar, salida de error]. Sirve para lo que no debe tumbar la prueba si falla
- `api_server` (l. 132) — Arranca el API REAL (api/index.php) con `php -S` en un puerto libre; la configuración va por variables de entorno TORIVAC_* (no hay config.php). La ruta /control hace saltar un aviso
- `zip_build` (l. 156) — Zip mínimo hecho a mano con las entradas que se le den: nombre => contenido (se comprime con deflate; los nombres que acaban en «!» se guardan SIN comprimir) o nombre =>
- `xlsx_with_sheet` (l. 173) — Libro con una sola hoja «Precios» cuyo XML de hoja es `$sheetXml` (más, si se quiere, las cadenas compartidas).
- `so_customer` (l. 182) — Datos del cliente de un pedido de prueba (cualquier campo se puede sobrescribir).
- `so_post` (l. 188) — Envía un pedido por el manejador; cada llamada usa por defecto una IP distinta (no se tropieza con el límite por visitante).
- `deflate_bomb` (l. 196) — Flujo deflate (sin cabecera zlib) de `$mb` megabytes de espacios, hecho por trozos: ocupa unos 300 KB comprimido y 300 MB descomprimido (la «bomba» del informe).

