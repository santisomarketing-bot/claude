# Índice de código (generado)

> Generado por `scripts/gen_code_index.py`. **No editar a mano**: se rehace con `python3 -I scripts/gen_code_index.py`.
> Cada archivo se describe por su cabecera; las secciones `[ETIQUETA]` marcan los bloques; cada función lleva su descripción (⚠ = falta describirla).
**Cobertura**: 1829/1829 funciones descritas (100 %) · 204/204 archivos con cabecera.


## `site/`

### `build.mjs`

[BUILD] Generador del sitio estático Torivac (demo).  Uso:  node site/build.mjs [--base=https://dominio] [--out=carpeta] Lee data/catalog/*.json (fuente única de verdad) y escribe dist/ (HTML por idioma + assets + datos para JS). Secciones: [LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS]

Secciones: `[BUILD]` · `[LOAD]` · `[CATS]` · `[PRODUCTS]` · `[SITE]` · `[EMIT]` · `[DATA]` · `[ASSETS]` · `[THEME]` · `[LIVE]` · `[SEO-OVERRIDES]` · `[OVERRIDES]` · `[PROPOSALS-APPLIED]` · `[ORIGINAL]` · `[SEO]` · `[BLOG]` · `[WORKER]` · `[ADMIN]` · `[PRICE-SHEET]` · `[PLAIN-TEXT]` · `[CSS]` · `[SEO-FILES]` · `[HOSTING]` · `[VERSIONES]`

- `arg0` (l. 23) — Valor de la opción `--k=valor` de la línea de comandos ('' si no se pasó).
- `arg` (l. 26) — Igual que arg0: valor de la opción `--k=valor` de la línea de comandos ('' si no se pasó).
- `jl` (l. 40) — Lee data/catalog/<f> como JSON; devuelve `d` si el archivo no existe o no es JSON válido.
- `normName` (l. 63) — Normaliza un nombre de categoría para detectar duplicados: minúsculas, sin tildes ni signos y con las palabras en singular.
- `depthOf` (l. 67) — Profundidad de una categoría en el árbol (0 = raíz), subiendo por `parent`.
- `canon` (l. 70) — Id de la categoría que se conserva tras fusionar duplicados (el mismo `id` si no se fusionó).
- `subtreeIds` (l. 117) — Ids de una categoría y de todas sus descendientes.
- `prodIdsOf` (l. 119) — Ids de los productos asignados a una categoría o a cualquiera de sus subcategorías.
- `visible` (l. 123) — Una categoría se muestra si tiene productos y su slug no está en la lista de ocultas (HIDE).
- `prune` (l. 125) — Quita (recursivo) las categorías no visibles y ordena cada nivel por nombre en español.
- `pth` (l. 146) — Ruta de una URL de grupotorivac.com con barra final, salvo que termine en una extensión de archivo.
- `pickCats` (l. 199) — Categorías visibles (ya fusionadas) de una lista de ids, en el mismo orden y sin repetir.
- `emit` (l. 222) — Escribe en dist el HTML de la ruta lógica `p` (como p/index.html si termina en barra) y suma una página al contador.
- `mkctx` (l. 224) — Contexto de render (Ctx) de la página `p` en el idioma `lang`; `section` marca el ítem activo del menú.
- `fitTitle` (l. 229) — título ≤ 65: «Nombre · Torivac» si cabe; si no, solo el nombre (recortado). Las categorías homónimas llevan el nombre del padre.
- `crumbHome` (l. 231) — Miga de pan «Inicio» del idioma `lang`: { name, path }.
- `crumbProducts` (l. 233) — Miga de pan «Productos» del idioma `lang`: { name, path }.
- `pickAlt` (l. 235) — Texto alt de una imagen en el idioma `lang` (español si falta; '' si no hay).
- `absImg` (l. 237) — URL absoluta de una imagen (solo con --base); null si no hay base o la imagen no tiene archivo.
- `alts` (l. 244) — Traducciones de la página `pagePath` ({ idioma: ruta }), solo las que existen en el sitio generado.
- `a` (l. 419) — Ruta relativa al recurso `s` desde /admin/ (assets del panel).
- `copyDir` (l. 437) — Copia recursivamente la carpeta `a` en `b`, creando los directorios que falten.
- `css` (l. 447) — Texto del archivo site/assets/css/<n>.css.
- `xml` (l. 467) — Escapa &, <, > y comillas para el XML del sitemap (null/undefined → '').
- `url` (l. 469) — Entrada <url> del sitemap de una página registrada: loc, enlaces hreflang (con x-default) e imágenes con alt.
- `sec` (l. 481) — Sección Markdown de llms.txt: encabezado `## título` y una línea por fila.
- `t` (l. 508) — Texto de interfaz `k` en el idioma del bucle (español si falta la traducción; la propia clave si no existe).
- `hashOf` (l. 526) — Huella (10 hex) del contenido del archivo `p` de dist/ (con caché); aborta si el archivo no existe.
- `walk` (l. 536) — Recorre dist/ y resuelve los marcadores de versión de cada .html.

### `templates.mjs`

[TEMPLATES] Plantillas HTML (funciones puras: datos → string). Cada una devuelve el <main> de su página; `layout()` lo envuelve con cabecera, pie, elementos flotantes y scripts. Datos: data/catalog/*.json (ver docs/ARQUITECTURA.md). Textos de interfaz: site/lib/i18n.mjs.

Secciones: `[TEMPLATES]` · `[ART]` · `[A11Y]` · `[META]` · `[LAYOUT]` · `[THEME]` · `[ORIGINAL]` · `[SEO-FILES]` · `[NAV]` · `[SOCIAL]` · `[SHARED]` · `[HOME]` · `[PAGES]` · `[BLOG]` · `[SHOP]` · `[STORE]` · `[PRODUCT]` · `[QUOTE]` · `[CONTACT]`

- `pick` (l. 13) — Valor de un campo traducible en el idioma `lang` (español si falta; '' si no hay objeto).
- `toroidArt` (l. 20) — Bobinado toroidal visto desde arriba (mismo motivo que el logotipo): 56 espiras que se «dibujan» al entrar en pantalla (CSS + IntersectionObserver en app.js).
- `waveLab` (l. 29) — Osciloscopio esquemático de un variador de tensión: la onda de salida (cobre) se reduce al mover el mando; la de entrada (230 V) queda fija. JS: assets/js/lab.js
- `headingOrder` (l. 49) — El contenido original salta de nivel (H1→H4). Se corrige en la ACCESIBILIDAD (aria-level) sin tocar la etiqueta, así el diseño no cambia:
- `metaDescription` (l. 61) — Usa la descripción original si es útil; si no, el primer párrafo real de la página (sin inventar nada); como último recurso, la descripción de la portada en ese idioma (`fallback`, texto de la web original; sin ella, ninguna).
- `ok` (l. 63) — Una descripción sirve si tiene al menos 50 caracteres y no es solo signos o cifras.
- `cssGuard` (l. 74) — Aviso para el demo (solo sin --base): si la página se abre sin sus hojas de estilo (p. ej. index.html dentro del .zip sin extraer), enseña arriba cómo abrirla bien.
- `oc` (l. 86) — Con selector de aspecto, el HTML lleva los elementos de los tres aspectos y cada hoja de estilos muestra los suyos (los del resto, con `display:none`).
- `lbl` (l. 88) — Rótulo que cambia según el aspecto: sin «Original», el de siempre; solo «Original», el de la web actual; con selector, los dos (cada hoja muestra uno). Los textos ya vienen escapados.
- `oHref` (l. 90) — Dirección a la que apunta una tarjeta o un enlace de categoría: en «Original» solo, una categoría hoja con UN producto lleva directa a ese producto (la web actual la redirige).
- `floatMenu` (l. 92) — Menú flotante «Productos-Torivac»: pestaña en el borde izquierdo que abre un panel oscuro con las categorías (dos niveles, en el orden de la web actual). Nace oculto: app.js lo muestra (sin JS no serviría).
- `themeSwitch` (l. 111) — Selector de aspecto: dos botones con aria-pressed. Nace oculto (sin JS no serviría de nada); assets/js/app.js lo muestra, marca el activo y guarda la elección. `where` distingue el de la cinta y el del pie.
- `layout` (l. 114) — Envuelve `hero` + `body` en la página HTML completa (SEO, cabecera, pie, presupuesto, scripts) y la registra para el sitemap.
- `alt` (l. 118) — selector de idioma: sin traducción cae a la portada de ese idioma
- `crumbs` (l. 205) — Migas de pan (nav + ol): todas enlazadas salvo la última, que lleva aria-current=page.
- `vtext` (l. 208) — Texto de un campo traducible (objeto por idioma o cadena) en el idioma `lang`, con respaldo al español.
- `vtags` (l. 210) — Fila de etiquetas de tensión (hasta `limit`) de un producto; '' si no hay ninguna conocida.
- `productCard` (l. 221) — Tarjeta de un producto del listado: foto, nombre, etiquetas de tensión y nº de referencias, con data-* para filtrar.
- `catTree` (l. 235) — árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
- `holds` (l. 238) — Indica si la categoría `c` es la activa o contiene a la activa entre sus descendientes.
- `link` (l. 240) — Enlace a una categoría con su nombre y su nº de productos; marca aria-current si es la activa.
- `walk` (l. 242) — Lista anidada del árbol de categorías; abre (data-open) las ramas que contienen la activa.
- `cut` (l. 249) — Texto recortado a `max` caracteres en el último espacio (sin partir palabras) y con «…» si se ha recortado; `max` Infinity = íntegro.
- `categoryCards` (l. 251) — tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original
- `fold` (l. 267) — algunas descripciones originales son copia de otra categoría (ver docs/01-analisis/HALLAZGOS.md #3): en la tarjeta solo se usa si comparte alguna palabra significativa con el nombre
- `oSecImg` (l. 280) — «Original»: atributo style con la foto de fondo de una sección (los trazos del logotipo de la web actual), en una variable que solo pinta la hoja de ese aspecto. Una URL dentro de una variable se resuelve desde la hoja que la usa (assets/css/site.css), de ahí «../media/…» y no la ruta de la página.
- `homeBody` (l. 282) — Portada: devuelve { hero, body, heroImg } con el hero, cinco secciones (fotos, servicios, catálogo), el formulario de contacto y la URL de la foto de portada (se precarga en la cabecera: es el elemento más grande de la primera pantalla).
- `text` (l. 286) — Bloques de título y párrafo de una sección (hoy sin uso en homeBody).
- `imgs` (l. 288) — Bloques de imagen de una sección.
- `btn` (l. 290) — Primer bloque de botón de una sección (undefined si no tiene).
- `oh` (l. 297) — «Original»: clase que engancha cada sección de la portada con la hoja de la web actual (sin «Original» no se emite y el HTML sale idéntico)
- `oBg` (l. 299) — «Original»: variable con la foto de fondo de una sección de la portada.
- `eyebrowAndHead` (l. 308) — HTML del antetítulo (encabezado de nivel 4 o más) y del título h2 (nivel 3 o menos) de una sección.
- `paras` (l. 314) — HTML de los párrafos de una sección, con los enlaces internos reescritos.
- `bt` (l. 316) — Enlace-botón (clase btn + `cls`) del botón de una sección; '' si no tiene.
- `waveSvg` (l. 345) — onda de tensión animada (SVG) — elemento gráfico base del hero
- `cardsHtml` (l. 353) — «Original»: bloques de una sección de tarjetas (Misión, Visión, Valores…) con cada icono y el texto que le sigue dentro de su propia tarjeta; lo que va antes del primer icono (título) queda fuera. Los otros aspectos ven el mismo flujo, solo con un div más.
- `isIcon` (l. 355) — Indica si el bloque es un icono pequeño (60 × 60) y no una foto.
- `sectionsHtml` (l. 364) — Secciones de una página genérica en HTML (texto, foto o carrusel, fondo oscuro, formulario de contacto), alternando el fondo. Con «Original», cada sección lleva además clases según cómo la maqueta la web actual (site.oSections, por id de sección de Elementor, igual en los cuatro idiomas).
- `cls` (l. 369) — Clases de la sección: las de siempre y, con «Original», las del tipo, el lado de la foto y el arte de fondo.
- `isPhoto` (l. 373) — los iconos pequeños se quedan dentro del texto
- `genericPage` (l. 399) — Página genérica (empresa, proyectos, legales…): devuelve { hero, body, title }; el primer encabezado pasa a h1 del hero.
- `contactBlockO` (l. 421) — «Original»: bloque «Contacta con nosotros» (texto de la portada y formulario) que la web actual repite al pie de cada ficha de producto y de cada entrada del blog; '' si la portada no lo trae. `where` hace únicos los ids del formulario; `wrap` lo mete en un `container` (en las fichas ya va dentro de uno).
- `postCard` (l. 434) — Tarjeta de una entrada en el listado del blog. Con `dyn` (plantilla de las entradas que se crean desde el panel, ver backend-php/api/lib/BlogPage.php) cada dato variable es una marca @@TV:…@@
- `blogIndexBody` (l. 442) — Listado del blog: tarjetas con imagen, fecha, título y extracto (150 caracteres) de cada entrada.
- `postBody` (l. 450) — Entrada de blog: devuelve { hero, body } con migas, h1, fecha y el contenido sin su H1 original. Con `dyn` es la plantilla de las entradas que se crean desde el panel: lo variable son marcas
- `shopBody` (l. 470) — Listado de productos (tienda o categoría): barra lateral con categorías, tensiones y búsqueda, subcategorías y tarjetas.
- `storeCard` (l. 511) — Tarjeta de un producto en la tienda: foto, categoría, nombre, tensiones, precio y compra (el precio y el «añadir al presupuesto» los pinta shop.js con los precios vigentes; sin JS queda el enlace a la ficha).
- `storeBody` (l. 528) — Tienda: barra lateral con categorías (de primer nivel), tensiones y búsqueda; barra de orden y contador; y todos los productos como tarjetas de tienda. Filtros y orden: assets/js/shop.js.
- `topsOf` (l. 531) — Ids de las categorías de primer nivel a las que pertenece el producto `p` (la tienda filtra por ellas).
- `productBody` (l. 562) — Ficha de producto: galería, etiquetas de tensión, descripción, fichas PDF, tabla de modelos con cantidades y relacionados.
- `quoteBody` (l. 626) — Página del presupuesto: tabla del pedido, carga de CSV/Excel y formulario de datos para enviarlo o descargar el PDF.
- `contactForm` (l. 655) — Formulario de contacto accesible (nombre, email, mensaje, privacidad y campo trampa antispam); `where` hace únicos los ids.
- `contactIntro` (l. 671) — introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio)
- `contactPageOriginal` (l. 676) — «Original»: página de contacto como la de la web actual: recuadro blanco con sombra naranja y el formulario a la izquierda; a la derecha el texto y los datos (dirección, teléfono, correo) con su icono. `blocks` son los textos de la página sin el título (que es el h1); `logo` es la foto del logotipo si la página la trae y `bg` la del fondo de la sección (trazos del logotipo). Con selector de aspecto va aparte del bloque de siempre (el formulario lleva otros ids).
- `plainOf` (l. 681) — Texto de un párrafo sin etiquetas.
- `li` (l. 688) — Fila de datos de contacto («Original»): icono, texto y enlace de teléfono o correo según el tipo.
- `lv2` (l. 691) — Encabezados de un trozo de HTML con aria-level 2.

## `site/lib/`

### `blog-shell.mjs`

[BLOG-SHELL] Plantillas de las páginas del blog que genera el SERVIDOR (backend-php/api/lib/BlogPage.php) para las entradas que se escriben en el panel. La web compilada ya trae las 21 entradas por idioma de la web original como páginas estáticas; las nuevas viven en la carpeta de datos y se pintan al pedirlas, con ESTA misma cabecera, menú, pie y estilos: aquí se prepara, para cada idioma, la página completa con marcas @@TV:…@@ en lo variable (título, fecha, texto, imagen, enlaces de idioma…) y el servidor solo las rellena (escapando siempre).

Secciones: `[BLOG-SHELL]`

- `dateKit` (l. 20) — Cómo se escribe una fecha larga en ese idioma: patrón con {d} {m} {y} y nombres de los doce meses (de Intl: lo mismo que enseñan las fechas de las entradas de la web).
- `llmsHeads` (l. 28) — Títulos de las secciones de entradas del blog en llms.txt (corto) y llms-full.txt (con el texto), por idioma.
- `splitIndex` (l. 31) — Parte el HTML del listado del blog (/blog/) en lo que va antes y después de las tarjetas. Falla si la estructura de blogIndexBody cambió (nunca se queda a medias en silencio).
- `blogShell` (l. 43) — Plantillas del blog de un idioma. `mkctx(lang, ruta, sección)` crea el contexto de render; `posts` son las entradas estáticas de la web original (sus tarjetas se guardan para mezclarlas, por fecha, con las nuevas).

### `hosting.mjs`

[HOSTING] Archivos de servidor para publicar en un hosting con cPanel o Plesk (Apache o LiteSpeed; en Plesk, con PHP servido por Apache): .htaccess, robots.txt de pruebas y 404 por idioma. Se generan solo con --base (producción o dominio de pruebas); la compilación de demostración (doble clic) no los necesita. htaccess({ base, staging, aliases, pdfRedirects, apiOrigin, phpApi, langs })  → texto del .htaccess de la raíz

Secciones: `[HOSTING]`

- `rx` (l. 10) — Escapa un texto para usarlo literal dentro de una expresión regular de Apache.
- `WP_PROBES` (l. 13) — Expresión de Apache con las rutas que solo existen en un WordPress (y que los escáneres prueban a diario). `bp` es la ruta base del sitio. Se comprueba en scripts/package_cpanel.py.
- `basePathOf` (l. 16) — ruta base del sitio: «https://x.com/prueba/» → «/prueba» («» si está en la raíz del dominio)
- `BLOG_RULES` (l. 23) — Reglas del blog que se escribe en el panel (PHP, api/page.php): las entradas nuevas (/blog/<slug>/ y /en|fr|de/blog/<slug>/), el listado del blog (que mezcla las nuevas con las de la web original), las imágenes
- `htaccess` (l. 35) — Genera el .htaccess de la raíz: HTTPS, host único, 301 de URLs antiguas, caché, cabeceras de seguridad (CSP), noindex en pruebas y reescritura de /api.
- `langHtaccess` (l. 84) — .htaccess de /en, /fr, /de: solo cambia la página 404 para que se muestre en el idioma de la sección
- `robotsTxt` (l. 87) — Genera robots.txt: en pruebas prohíbe todo; en producción permite el sitio, cierra /admin/ y /api/ y enlaza el sitemap.

### `i18n.mjs`

[I18N] Textos de interfaz del demo en los 4 idiomas. Solo textos NUEVOS de la experiencia de pedido (presupuesto, filtros, formulario…): el contenido del sitio viene tal cual de la web original. Cada clave existe en es/en/fr/de. El idioma por defecto del sitio es 'es' (raíz); en/fr/de viven bajo /en /fr /de.

Secciones: `[I18N]`

- `countLabel` (l. 151) — «1 producto / 2 productos» en los 4 idiomas
- `refLabel` (l. 153) — «1 referencia / 2 referencias» en los 4 idiomas.
- `t` (l. 155) — Texto de interfaz de la clave `key` en el idioma `lang` (español si falta; la propia clave si no existe).

### `proposals-apply.mjs`

[PROPOSALS-APPLY] Aplica al contenido de la web las propuestas que el manager aprobó con SU texto desde el panel (data/catalog/proposals.applied.json, que sale de scripts/apply_proposals.mjs a partir del archivo que descarga el panel). La usan site/build.mjs (al compilar) y scripts/apply_proposals.mjs (para probar antes de guardar): la misma función, así lo que se comprueba es lo que se publica.

Secciones: `[PROPOSALS-APPLY]`

- `decode` (l. 16) — Entidades HTML más comunes → texto.
- `textOfHtml` (l. 23) — Texto de un trozo de HTML en línea (sin etiquetas ni entidades).
- `norm` (l. 25) — Texto comparable: sin tildes de comillas y guiones tipográficos, espacios únicos, minúsculas.
- `paragraphs` (l. 28) — Texto del manager → bloques `p` (un párrafo por grupo de líneas separado por una línea en blanco; los saltos sueltos son <br>), todo escapado.
- `spots` (l. 33) — Dónde está el texto de un bloque que se puede sustituir → lista de «sitios»: { text, set(newText) } (cada sitio sabe cómo cambiarse). Tipos: p · h · ul/ol · celdas de tabla.
- `pageBlocks` (l. 47) — Todas las listas de bloques de una página (secciones) → array de arrays.
- `replaceIn` (l. 49) — Sustituye el primer sitio de `lists` cuyo texto contiene `find` → true si lo encontró.
- `listsFor` (l. 57) — Listas de bloques de la página `path` en `lang`: una página suelta (pages), la ficha de un producto (description y short) o una categoría (description); [] si no existe. Las rutas se comparan sin barra final.
- `same` (l. 59) — ¿Son la misma ruta (sin contar la barra final)?
- `parseTitles` (l. 70) — Líneas «es: título» → { es, en, fr, de } (solo los idiomas que vengan); null si no hay ninguna válida.
- `applyApproved` (l. 77) — Aplica las entradas aprobadas (ver arriba) → { applied, notFound, manual }. No lanza por una entrada que no encaja: la anota en notFound.

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

### `shared-client.mjs`

[SHARED-CLIENT] Convierte un módulo ES de shared/ (la lógica que comparten el navegador, el Worker y el servidor PHP) en un script clásico para el navegador: sin `export`, dentro de una función propia y colgado de TV.<nombre>. Así el navegador usa EXACTAMENTE el código que usan el servidor y el Worker (y las mismas pruebas con los mismos casos). classicScript(raíz, 'plain-text.mjs', { title, expose, patches }) → texto del script

Secciones: `[SHARED-CLIENT]`

- `classicScript` (l. 9) — Texto del script clásico generado desde shared/<file>. `expose` es la expresión del objeto que se publica (p. ej. `{ check: checkText }`) en TV.<global>.
- `plainTextScript` (l. 21) — Script del validador de texto plano: TV.PlainText.check(valor, { max, multiline }) y los límites de cada campo. En un navegador sin lookbehind en las expresiones regulares (Safari < 16.4) se omiten las reglas que no entiende: el aviso es solo una cortesía y el servidor las aplica todas siempre.
- `blogMarkdownScript` (l. 31) — Script del conversor de texto del blog: TV.BlogMarkdown.render(texto, { tableLabel }) y compañía (la vista previa del editor del panel usa EXACTAMENTE el código que publica la página). En un navegador sin lookbehind (Safari < 16.4) el script no carga: el panel lo detecta y avisa de que no hay vista previa.

### `themes.mjs`

[THEMES] Aspectos de la web (fuente única): lista, orden en el selector y script de arranque que aplica el elegido ANTES del primer pintado. Ver docs/DISENO-TEMAS.md. Para añadir un aspecto: añadirlo aquí, su hoja en site/build.mjs [CSS] y su texto `theme_<nombre>` en site/lib/i18n.mjs. Aspectos disponibles, en el orden del selector. El primero es el que se publica por defecto salvo que se pida otro con --theme.

Secciones: `[THEMES]` · `[CSS]`

- `themeBootJs` (l. 8) — Script de la cabecera (solo con selector de aspecto): aplica ?tema=<aspecto> o la elección guardada (localStorage `tv-theme`) antes de pintar, sin parpadeo. Es constante: la CSP lo admite por su huella (ver site/lib/hosting.mjs).

## `site/assets/js/`

### `admin-blog.js`

[ADMIN-BLOG] Vista «Blog» del panel real (admin-live.js, solo managers): escribir, ordenar y publicar las entradas del blog sin tocar archivos. Las entradas viven en la carpeta de datos del servidor (no en los archivos de la web) y se publican en /blog/<dirección>/ con SEO completo (título, descripción, canonical, hreflang, Open Graph, JSON-LD, sitemap.xml y llms.txt); ver docs/BLOG.md. · Listado con filtros (idioma, estado, texto) y estado de cada entrada: publicada, programada (con fecha futura) o borrador.

Secciones: `[ADMIN-BLOG]` · `[UTIL]` · `[DATOS]` · `[LISTA]` · `[EDITOR]` · `[SEO]` · `[TEXTO]` · `[IMAGENES]` · `[GUARDAR]` · `[EVENTOS]`

- `esc` (l. 26) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `pad` (l. 28) — Número con cero a la izquierda a dos cifras.
- `toLocalInput` (l. 30) — Fecha ISO → valor de un <input type="datetime-local"> en la hora del navegador ('' si no hay).
- `fromLocalInput` (l. 32) — Valor de un <input type="datetime-local"> (hora del navegador) → ISO en UTC «AAAA-MM-DDTHH:MM:SSZ», o null.
- `siteBase` (l. 34) — Ruta de la web dentro del dominio («» o «/prueba») según dónde está el panel (/admin/).
- `publicUrl` (l. 36) — Dirección pública completa de una ruta de la web.
- `pathOf` (l. 38) — Ruta pública de una entrada de ese idioma y dirección.
- `nowMs` (l. 40) — Ahora, según el reloj del servidor (la diferencia con el del navegador se mide al cargar el listado).
- `stateOf` (l. 42) — Estado de una entrada del listado o del editor: «live» (publicada y ya visible), «scheduled» (publicada con fecha futura) o «draft».
- `stateTag` (l. 44) — Etiqueta HTML del estado de una entrada.
- `shortDate` (l. 49) — Fecha corta local (dd/mm/aaaa hh:mm) de una fecha ISO.
- `cut` (l. 51) — Título + «…» recortado a `n` caracteres.
- `slugify` (l. 53) — Dirección a partir de un título (el mismo slugify que el servidor, sale de shared/blog-markdown.mjs).
- `unavailable` (l. 55) — Aviso de que el blog no está disponible en este servidor.
- `parseArg` (l. 57) — Parte «nueva?lang=en&tr=bp-…» o «bp-…» en { id, q }.
- `blank` (l. 65) — Entrada vacía para empezar a escribir (idioma, y si viene de «Crear la traducción», enlazada con la original).
- `loadList` (l. 71) — Pide el listado (con la hora y los límites del servidor). Devuelve Promise<null|respuesta con error>.
- `load` (l. 79) — Prepara lo que necesita la vista pedida (listado; o listado + imágenes + la entrada). Devuelve Promise<null|respuesta con error>.
- `filtered` (l. 97) — Entradas del listado que pasan el filtro actual.
- `rowsHtml` (l. 104) — Filas de la tabla del listado.
- `listHtml` (l. 115) — Vista del listado: contadores, filtros y tabla.
- `opt` (l. 119) — Una <option> con su valor y su texto, marcada si es la actual.
- `countHtml` (l. 130) — Contador «n/máx» de un campo de una línea.
- `coverHtml` (l. 132) — Cuadro de la imagen destacada: vista previa, texto alternativo y botones.
- `toolbarHtml` (l. 141) — Barra de herramientas del texto.
- `b` (l. 143) — Un botón de la barra: acción, rótulo (HTML) y ayuda.
- `textHtml` (l. 148) — Cuadro del texto: barra, caja de texto y vista previa en vivo.
- `seoHtml` (l. 155) — Cuadro de SEO: título y descripción para buscadores, aspecto en Google y lista de comprobación.
- `translationsHtml` (l. 163) — Cuadro de traducciones: un desplegable por idioma con las entradas de ese idioma que se pueden enlazar.
- `editorHtml` (l. 176) — Vista del editor completo.
- `msg` (l. 193) — Mensaje de la barra superior (error o aviso); '' lo oculta.
- `effectiveDescription` (l. 197) — Texto de la descripción que usará la web: la de SEO, el resumen o el principio del texto.
- `checks` (l. 204) — Lista [{ok, text}] de comprobaciones de SEO de la entrada actual (consejos, no bloquean el guardado).
- `updateSeo` (l. 221) — Repinta la vista previa de Google y la lista de comprobación.
- `updatePreview` (l. 229) — Pinta la vista previa del texto con el MISMO conversor que usa el servidor (TV.BlogMarkdown).
- `updateCounts` (l. 239) — Pone al día los contadores de caracteres de los campos con límite (en rojo si se pasan).
- `updateUrl` (l. 246) — Dirección completa que tendrá la entrada, con aviso si cambia la de una ya publicada.
- `updateWhen` (l. 252) — Texto de la sección «Publicación» según estado y fecha, y la etiqueta de estado de la barra.
- `setDirty` (l. 260) — Marca el estado «con cambios sin guardar».
- `refresh` (l. 262) — Pone al día todo lo que depende de los campos.
- `insertText` (l. 264) — Inserta `text` en la caja de texto sustituyendo la selección; deja el cursor al final de lo insertado.
- `wrap` (l. 266) — Rodea la selección con `pre` y `post` (o pone `ph` si no hay selección).
- `prefixLines` (l. 268) — Antepone `prefix` a cada línea de la selección (o a la línea del cursor); con `numbered` las numera.
- `tool` (l. 274) — Ejecuta una herramienta de la barra sobre la caja de texto.
- `canWebp` (l. 291) — ¿Sabe este navegador guardar imágenes WebP desde un canvas? (si no, se usa JPEG).
- `compress` (l. 293) — Archivo de imagen → Promise<{ data: base64, mime, w, h, bytes }> redimensionado a 1600 px como mucho y recodificado (WebP o JPEG) hasta que pese menos que el límite del servidor.
- `img.onload` (l. 297) — Con la imagen abierta: la redimensiona y recodifica hasta que cabe en el límite.
- `attempt` (l. 301) — Intenta una combinación de tamaño y calidad; si no cabe en el límite, la siguiente.
- `r.onload` (l. 312) — Con el archivo leído: entrega los datos en base64.
- `r.onerror` (l. 314) — Si no se puede leer el archivo recodificado.
- `img.onerror` (l. 321) — Si el navegador no puede abrir el archivo como imagen.
- `upload` (l. 326) — Sube un archivo de imagen (comprimido) y devuelve Promise<imagen del servidor | null si falló, con el aviso ya mostrado>.
- `pickerHtml` (l. 340) — Contenido del cuadro de imágenes: subir una nueva y rejilla de las ya subidas.
- `dlgMsg` (l. 348) — Aviso dentro del cuadro de imágenes (el aviso del editor queda detrás del cuadro y no se ve).
- `removeImage` (l. 350) — Borra del servidor la imagen elegida en el cuadro, tras confirmar: si alguna entrada la usa, el servidor no la borra y dice en cuáles. Después vuelve a pintar la rejilla.
- `openPicker` (l. 364) — Abre el cuadro de imágenes para `target` («cover» = imagen destacada, «text» = insertar en el texto).
- `closePicker` (l. 373) — Cierra el cuadro de imágenes.
- `chooseImage` (l. 375) — Marca una imagen del cuadro como elegida y pide su texto alternativo.
- `useImage` (l. 384) — Usa la imagen elegida: como destacada o insertada en el texto.
- `payload` (l. 396) — Cuerpo que se envía al servidor con lo que hay en el formulario.
- `showError` (l. 403) — Marca el campo con error que dijo el servidor y enseña el mensaje.
- `verifyLive` (l. 410) — Tras guardar una entrada ya visible, pide su página pública para comprobar que la web la sirve de verdad; si no (404, 500…), avisa: lo habitual es que el servidor no esté aplicando las reglas del .htaccess del blog.
- `save` (l. 420) — Guarda la entrada (crea o actualiza). Devuelve Promise<boolean>.
- `preview` (l. 439) — «Ver como saldrá»: guarda y abre la página real con una dirección firmada de una hora (sirve también para borradores y programadas).
- `remove` (l. 451) — Borra la entrada indicada tras confirmar.
- `fieldChanged` (l. 458) — Lee un campo del formulario y lo pasa a la entrada que se edita.
- `B.bind` (l. 472) — Engancha los clics, cambios y teclas del listado y del editor (delegación de eventos sobre `root`, una sola vez).
- `B.view` (l. 520) — Vista del blog: listado o editor según `arg` (ver la cabecera).
- `B.dirty` (l. 530) — ¿Hay cambios sin guardar en el editor?

### `admin-live.js`

[ADMIN-LIVE] Panel de gestión de Torivac CONECTADO AL WORKER (producción). Mismo aspecto que el demo (admin.css), datos y acciones reales. Roles:  manager → Resumen · Pedidos · Mensajes · Precios · Propuestas · Contenido · Blog · Usuarios · Actividad · Estadísticas · Ajustes cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas

Secciones: `[ADMIN-LIVE]` · `[HTTP]` · `[AUTH]` · `[UTIL]` · `[VIEWS]` · `[PRICES]` · `[AI]` · `[PROPOSALS]` · `[BLOG]` · `[SECURITY]` · `[ROUTER]`

- `esc` (l. 18) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `money` (l. 20) — Importe formateado con la divisa y el idioma de la página (Q.money); un valor vacío cuenta como 0.
- `http` (l. 24) — method + ruta + cuerpo → Promise<{ok, status, …}>. Un 401 cierra la sesión (token caducado). Nunca rechaza: los errores de red vuelven como {ok:false}.
- `session` (l. 33) — Sesión actual {token, email, name, role} o null. El rol del servidor ('client') se muestra como 'cliente'.
- `openSession` (l. 39) — Guarda la sesión que devuelve el servidor (token y datos de la persona). El rol del servidor ('client') se muestra como 'cliente'.
- `login` (l. 43) — Entra con correo y contraseña. Devuelve Promise<string|null>: null si ha ido bien (sesión abierta) o si el servidor pide un código por correo (queda en `pending` y se pinta la pantalla del código), o el mensaje de error.
- `verifyCode` (l. 52) — Comprueba el código escrito (POST /api/auth/verify). Promise<{done}|{back,msg}|{msg}>: sesión abierta · el código ya no sirve (se vuelve a la contraseña con el aviso) · error para mostrar sin salir de la pantalla.
- `resendCode` (l. 61) — Pide otro código por correo (el anterior deja de valer). Promise<{ok}|{back,msg}|{msg}>.
- `endSession` (l. 69) — Borra la sesión de este navegador y vuelve a la pantalla de acceso (sin avisar al servidor: lo usa también un 401, cuando el servidor ya la ha dado por caducada).
- `relogin` (l. 71) — Vuelve a la pantalla de acceso con un aviso (tras cambiar la contraseña propia: el servidor ya cerró todas las sesiones).
- `logout` (l. 73) — Cierra la sesión: el servidor invalida TODOS los tokens anteriores de esta persona (POST /api/auth/logout; si no responde, igualmente se sale de este navegador).
- `adminData` (l. 78) — Propuestas de cambio y datos de cobertura del catálogo, solo para managers (GET /api/admin/data); se piden una vez y se guardan en TV.proposals y TV.admin. Nunca rechaza.
- `toast` (l. 85) — Muestra un aviso breve (3,2 s) en pantalla.
- `kpi` (l. 87) — HTML de una tarjeta KPI con la etiqueta `l` y el valor `v`, ambos escapados.
- `itemName` (l. 89) — Nombre legible de una referencia (nombre ES + ref si es un modelo concreto).
- `when` (l. 91) — Fecha y hora local (es-ES) de una fecha ISO; «—» si viene vacía.
- `download` (l. 93) — Descarga `blob` como archivo `name` con un enlace temporal y libera la URL a los 800 ms.
- `fail` (l. 95) — Aviso de error del servidor con el mensaje devuelto.
- `mailWarn` (l. 106) — Aviso del Resumen cuando el correo no funciona (sin completar o el último envío falló): los pedidos y mensajes se guardan igual, pero nadie recibe el aviso. '' si todo va bien.
- `V.resumen` (l. 112) — Vista Resumen (manager): con datos del Worker, KPIs, estado de la hoja de precios y sincronización, y los 5 últimos pedidos.
- `ordersView` (l. 124) — Tabla de pedidos (manager: todos · cliente: solo los suyos, lo filtra el servidor).
- `V.pedidos` (l. 133) — Vista Pedidos (manager): tabla de todos los pedidos que devuelve el Worker.
- `V.mis` (l. 135) — Vista «Mis presupuestos» (cliente): sus propios pedidos; el filtro por usuario lo aplica el servidor.
- `V.lista` (l. 138) — Vista Lista de precios (cliente): precios vigentes del Worker, sin IVA, con sus tramos (hasta 600 referencias).
- `V.presupuestador` (l. 147) — Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1.
- `V.contenido` (l. 150) — Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto.
- `cell` (l. 153) — Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir).
- `V.estadisticas` (l. 159) — Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras.
- `mailTag` (l. 165) — Etiqueta con el estado del aviso por correo de un mensaje o de un pedido (emailed.sent / reason; el texto del error solo lo trae el servidor a los gestores).
- `V.mensajes` (l. 171) — Vista Mensajes (manager): los mensajes del formulario de contacto, que el servidor guarda aunque el correo falle, con el estado del aviso por correo y el borrado individual.
- `mailPanel` (l. 183) — Panel «Correo» de Ajustes: controlador, si está completo, qué falta, el último intento (también el fallo) y el botón para mandar un correo de prueba.
- `V.ajustes` (l. 193) — Vista Ajustes (manager): datos de la sesión (GET /api/auth/me), tu cuenta y las copias de seguridad (admin-security.js), dónde se configuran los destinatarios del pedido y, con el API PHP, su autodiagnóstico (GET /api/diag).
- `modeBox` (l. 207) — Selector de lo que hace la hoja subida: actualizar solo lo que trae (por defecto; puede ser una parte del catálogo) o reemplazar toda la lista de precios.
- `V.precios` (l. 213) — Vista Precios (manager): estado y sincronización de la hoja, subida de Excel/CSV con vista previa e instrucción a la IA.
- `previewUpload` (l. 224) — Filas (cabecera + datos) → vista previa de diferencias contra los precios vigentes (el servidor calcula la diferencia con el modo elegido; no se aplica nada).
- `list` (l. 230) — Filas HTML (máx. 60) de las referencias `arr`, cada una con su producto y la etiqueta `kind`.
- `readUpload` (l. 242) — Lee el archivo subido (Excel o CSV) en el navegador y pide la vista previa.
- `go` (l. 245) — Pide la vista previa de las filas leídas, etiquetándola con el nombre del archivo.
- `applyUpload` (l. 250) — Publica la hoja subida (POST /api/prices/upload, con `force` si se marcó la casilla) y repinta; sin borrador no hace nada.
- `runPrompt` (l. 264) — Envía la instrucción a la IA (POST /api/prices/ai) y muestra la propuesta de cambios para confirmarla; no aplica nada.
- `applyProposal` (l. 280) — Aplica la propuesta vigente de la IA (POST /api/prices/ai/apply, confirmando los cambios grandes si se marcó) y repinta.
- `V.propuestas` (l. 290) — Vista Propuestas (manager): editar, probar y aplicar cada propuesta de mejora (ver admin-proposals.js).
- `V.blog` (l. 294) — Vista Blog (manager): listado (#blog), entrada nueva (#blog/nueva) o edición (#blog/<id>); `arg` es lo que sigue a «blog/» en la dirección.
- `V.usuarios` (l. 298) — Vista «Usuarios» (manager): lista con último acceso, código por correo y bloqueos, alta, baja y contraseña nueva a una cuenta.
- `V.actividad` (l. 300) — Vista «Actividad» (manager): quién entró y quién cambió qué, con filtros y descarga en CSV.
- `onClick` (l. 304) — Manejador único de clics del panel (delegación de eventos): salir, sincronizar precios, aplicar o descartar cambios, propuestas, usuarios y PDF.
- `bind` (l. 321) — Eventos de la vista Precios (subida por arrastre) y del formulario de usuarios; se enlazan tras pintar cada vista.
- `loginLogo` (l. 349) — Logotipo de las pantallas de acceso (el mismo que el menú, sobre fondo oscuro).
- `loginError` (l. 351) — Muestra un error en el párrafo [data-err] de la pantalla de acceso (role=alert: lo anuncia el lector de pantalla).
- `renderLogin` (l. 353) — Pantalla de acceso, primer paso: correo y contraseña. Si el servidor pide un código por correo, `login` deja el reto en `pending` y se repinta con la segunda pantalla.
- `renderCode` (l. 362) — Segundo paso del acceso: el código de 6 cifras que llegó por correo, «recordar este dispositivo», «Reenviar» (con la espera que marca el servidor) y «Volver».
- `tick` (l. 372) — Pone en el botón de reenviar la espera que falta (o lo activa); se detiene solo cuando la pantalla se repinta.
- `back` (l. 380) — Vuelve a la primera pantalla (con un aviso, si lo hay).
- `render` (l. 403) — Pinta la pantalla de acceso (contraseña, o el código por correo si falta) o el panel (menú lateral + la vista de la ruta #hash); `renderSeq` descarta la respuesta de una vista si entretanto se pidió otra.

### `admin-proposals.js`

[ADMIN-PROPOSALS] Vista «Propuestas» del panel real (admin-live.js): cada propuesta de mejora se puede EDITAR, PROBAR en la página real y APLICAR. · Editar: la persona escribe SU texto (cómo debe quedar el párrafo, la traducción que falta, el título de la portada o la decisión que toma). · Probar: abre la página real en un marco y enseña el cambio puesto en su sitio (resaltado) sin publicar nada; la web de verdad no cambia.

Secciones: `[ADMIN-PROPOSALS]` · `[CLASES]` · `[DESTINOS]` · `[HTML]` · `[PREVIA]` · `[ACCIONES]` · `[EXPORTAR]`

- `esc` (l. 18) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `kindOf` (l. 29) — Cómo se edita una propuesta: replace (sustituir un párrafo de la web) · translate (descripción de un producto en otro idioma) · title (títulos de la portada) · decide (una decisión o dato para el equipo).
- `literal` (l. 36) — Fragmento literal de la web que describe la propuesta: el texto más largo entre comillas ('…' o «…») de web_value o, si no hay, web_value entero (sin puntos suspensivos al final).
- `hasQuoted` (l. 43) — ¿Aparece entre comillas en web_value (es decir, es un trozo literal de la página y no una descripción del problema)?
- `defaultMode` (l. 45) — Modo por defecto de una propuesta de tipo «replace»: sustituir si hay un trozo literal; añadir un párrafo nuevo si solo hay una descripción del problema.
- `langOfPath` (l. 55) — Idioma de una ruta de la web (/en/…, /fr/…, /de/…; el resto es español).
- `targets` (l. 57) — Páginas [{lang, path, label}] donde la propuesta se aplicaría, sin repetir: las que trae (pages), la ruta entre paréntesis del nombre, la ficha del producto, la categoría o las portadas (títulos).
- `add` (l. 60) — Añade una página destino si no estaba ya.
- `frameUrl` (l. 71) — Ruta de la web → dirección que se abre desde /admin/ (un nivel por encima), en modo «embed» y con index.html si la web no usa URL limpias.
- `statusOf` (l. 79) — Estado guardado de una propuesta: 'ok' · 'no' · ''.
- `stateTag` (l. 81) — Etiqueta de estado de la cabecera de una tarjeta.
- `labelText` (l. 83) — Texto del campo principal según el tipo de edición.
- `initialText` (l. 90) — Valor inicial del campo de texto: lo guardado y, si no hay, los títulos actuales (propuesta SEO) o nada.
- `modeRadios` (l. 96) — HTML de los botones de modo (sustituir / añadir / solo decisión) de una propuesta de tipo «replace».
- `cardHtml` (l. 101) — HTML de una propuesta: cabecera plegable con su estado y, dentro, lo que dice la web, el formulario de edición y el sitio de la vista previa.
- `filtered` (l. 118) — Propuestas que cumplen el filtro actual (estado, tipo y búsqueda), las más graves primero.
- `counts` (l. 130) — Contadores por estado (pendientes · aprobadas · descartadas · todas).
- `barHtml` (l. 136) — Barra de filtros: estado (botones), tipo, búsqueda y la descarga de las aprobadas.
- `listHtml` (l. 145) — HTML de la lista (tarjetas) del filtro actual; el sitio de las tarjetas se rellena aparte para no perder el foco al teclear en la búsqueda.
- `A.view` (l. 150) — Vista Propuestas: explicación en tres pasos, barra de filtros y la lista.
- `norm` (l. 162) — Texto comparable: sin comillas ni guiones tipográficos, espacios únicos, minúsculas.
- `findBlock` (l. 164) — Elemento de texto más pequeño de la página (párrafo, título, elemento de lista o celda) cuyo texto contiene `find`; null si no hay.
- `mark` (l. 175) — Resalta un elemento del marco para que se vea dónde cae el cambio.
- `paras` (l. 177) — Párrafos de un texto: separados por líneas en blanco, sin vacíos.
- `putText` (l. 179) — Pone el texto de la persona en un elemento (con textContent) y, si hay varios párrafos y el elemento es un párrafo, añade los demás detrás.
- `metaDesc` (l. 185) — Descripción meta de la página del marco ('' si no la tiene).
- `previewIn` (l. 190) — Pone en el documento `doc` del marco la versión `v` ({mode, find, text}) de la propuesta `p` para la página `t` → { ok, msg, serp? }. Cada modo cambia un sitio distinto: replace (el párrafo), add (un
- `drawSerp` (l. 223) — Dibuja el resultado de búsqueda de ejemplo (título, dirección y descripción) con los textos de la persona, sin HTML.
- `readForm` (l. 229) — Lee la versión de la persona del formulario de una tarjeta → {mode, find, text, note}.
- `runTry` (l. 234) — Abre (o actualiza) la vista previa de una tarjeta: el marco con la página destino elegida y el cambio puesto.
- `runLoad` (l. 251) — «Traer el párrafo de la web»: abre la página, busca el párrafo que contiene el texto indicado y lo pone entero en el recuadro para editarlo en su sitio.
- `showError` (l. 267) — Mensaje de error del servidor para un campo: lo pone en la tarjeta y marca el campo si el servidor dijo cuál.
- `redraw` (l. 273) — Vuelve a pintar una tarjeta con el estado actual, manteniéndola abierta.
- `refreshBar` (l. 280) — Repinta la barra de filtros (los contadores cambian al aprobar o descartar).
- `save` (l. 282) — Guarda el estado de una propuesta en el servidor (ok con su texto, no con nota, o '' para deshacer) y repinta la tarjeta.
- `exportData` (l. 304) — Datos de las propuestas aprobadas con su texto → objeto que se descarga como JSON (lo lee scripts/apply_proposals.mjs).
- `doExport` (l. 316) — Descarga las propuestas aprobadas como archivo JSON (propuestas-aprobadas-AAAA-MM-DD.json).
- `A.bind` (l. 324) — Engancha los clics, cambios y envíos de la vista (delegación de eventos sobre `root`). Los eventos se enlazan UNA sola vez (root no se repinta, sus nodos sí); `ctx` se actualiza cada vez.
- `cardOf` (l. 329) — Propuesta de la tarjeta que contiene el elemento.
- `relist` (l. 331) — Repinta la lista con el filtro actual.

### `admin-report.js`

[ADMIN-REPORT] Informe de lectura de una hoja de precios para la vista previa del panel: columnas reconocidas, avisos, referencias nuevas y filas que no se publican. Lo comparten admin.js (demo, en el navegador) y admin-live.js (real, el informe viene del servidor). Sin dependencias. TV.priceReportHtml(report, esc) → HTML ('' si no hay informe)

Secciones: `[ADMIN-REPORT]`

- `TV.priceReportHtml` (l. 13) — HTML del informe de lectura de la hoja (columnas, avisos y listas plegables); `esc` escapa el texto; '' sin informe.
- `list` (l. 28) — Bloque <details> con `title` y hasta 40 elementos formateados con `fmt` (añade «…» si hay más); '' si la lista está vacía.

### `admin-security.js`

[ADMIN-SECURITY] Partes del panel (solo con el servidor PHP) que cuidan el acceso y la recuperación de los datos: · Usuarios: último acceso, «código por correo» por cuenta (la casilla de las cuentas de confianza), bloqueos con su botón «Desbloquear», contraseña nueva para otra cuenta, alta y baja. · Actividad: quién entró y quién cambió qué (GET /api/activity), con filtros y descarga en CSV.

Secciones: `[ADMIN-SECURITY]` · `[UTIL]` · `[USUARIOS]` · `[ACTIVIDAD]` · `[AJUSTES]` · `[COPIAS]` · `[EVENTOS]`

- `esc` (l. 22) — Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía.
- `lockText` (l. 24) — Segundos de bloqueo → «54 min» o «1 h».
- `size` (l. 26) — Bytes → «3,2 MB» / «840 KB».
- `when` (l. 28) — Fecha ISO → «dd/mm/aaaa hh:mm» en la hora del navegador; «—» si no hay.
- `fail` (l. 30) — Aviso de error del servidor con su mensaje.
- `unavailable` (l. 32) — Un mensaje de «no disponible en este servidor» (el Worker de Cloudflare no trae estas partes) o el error que devolvió el servidor.
- `stateTags` (l. 36) — Texto y marca del estado de seguridad de un usuario: bloqueo, protección reforzada o nada.
- `codeCell` (l. 43) — La casilla «código por correo» de una cuenta de manager (los clientes no la usan salvo tras ataques repetidos).
- `S.usersView` (l. 49) — Vista Usuarios (manager): la lista con su seguridad, alta de usuarios y contraseña nueva para una cuenta.
- `activityRows` (l. 75) — Filas de la tabla de actividad.
- `S.activityView` (l. 84) — Vista Actividad (manager): filtros, tabla y descarga.
- `opt` (l. 90) — Una opción de un desplegable: valor `v`, texto `t`, marcada si es igual a `cur`.
- `csvCell` (l. 101) — Una celda de CSV: entre comillas y sin que una fórmula de hoja de cálculo (= + - @) se ejecute al abrirlo.
- `downloadCsv` (l. 103) — Descarga lo que se está viendo como CSV (con BOM para que Excel respete las tildes).
- `codeExplain` (l. 112) — Texto de lo que le pasa a esta persona al entrar, según el estado que da el servidor (user.code en /api/auth/me).
- `accountPanel` (l. 119) — Panel «Tu cuenta y tu seguridad» de Ajustes: estado del código, olvidar dispositivos y cambiar la contraseña propia.
- `S.settingsPanels` (l. 126) — Los paneles de seguridad de Ajustes (solo manager): tu cuenta y las copias de seguridad. Nunca rechaza. Cada uno sale solo si el servidor lo trae (el de la cuenta, si /api/auth/me da `code`; el de las copias, si /api/backups responde).
- `backupsPanel` (l. 132) — Panel «Copias de seguridad»: la lista, crear una ahora, descargar y borrar. '' si el servidor no las trae.
- `downloadBackup` (l. 144) — Pide el enlace firmado de una copia y la descarga.
- `S.bind` (l. 157) — Engancha los eventos de lo que pinten usersView, activityView y settingsPanels (delegación sobre `root`, una sola vez). `ctx.render()` repinta la vista; `ctx.relogin(msg)` cierra

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

### `captcha.js`

[CAPTCHA] CAPTCHA invisible OPCIONAL (Cloudflare Turnstile) en los formularios de contacto y de pedido. Solo se activa si el servidor lo dice: GET /api/health trae `features.turnstile.sitekey` cuando en config.php (o en el Worker) están puestas la clave pública Y la secreta. Sin eso este fichero no hace nada, no carga nada de terceros y los formularios se envían como siempre (la defensa de siempre sigue: trampa, tiempo mínimo, texto plano, topes por visitante).

Secciones: `[CAPTCHA]` · `[SERVIDOR]` · `[SCRIPT]` · `[WIDGET]` · `[API]`

- `sitekey` (l. 29) — Promise<string>: la clave pública de Turnstile que anuncia el servidor, o '' si el CAPTCHA no está activado (o no hay API, o el servidor no responde). Una sola consulta por página. Nunca rechaza.
- `load` (l. 41) — Promise<turnstile>: descarga el script de Cloudflare la primera vez (y lo vuelve a intentar si falló: bloqueador, red).
- `s.onload` (l. 48) — El script cargó: ya existe `window.turnstile`.
- `s.onerror` (l. 50) — El script no se pudo descargar (bloqueador de contenido, sin red).
- `state` (l. 59) — Estado del widget de un formulario: {id, slot, waiting}.
- `settle` (l. 61) — Entrega el token (o '' si falló) a quien lo está esperando.
- `ensure` (l. 63) — Promise<turnstile>: carga el script y crea el widget del formulario (invisible hasta que se ejecuta; solo se ve si Cloudflare pide una interacción).
- `callback` (l. 69) — Cloudflare dio el token: se entrega a quien espera el envío.
- `C.token` (l. 85) — Promise<string>: un token nuevo de Turnstile para este envío, o '' si el CAPTCHA no está activo o no se pudo conseguir. Nunca rechaza.
- `finish` (l. 93) — Termina la espera una sola vez con el token (o '').
- `C.attach` (l. 101) — Promise<object>: `body` con `turnstileToken` si hay CAPTCHA y se consiguió token; si no, tal cual.
- `C.init` (l. 105) — Engancha un formulario: si el servidor activó el CAPTCHA, enseña el aviso y precarga el script cuando alguien empieza a usarlo. Sin CAPTCHA no hace nada.
- `warm` (l. 113) — Primer uso del formulario: se descarga el script (no antes).

### `contact.js`

[CONTACT] Formularios de contacto (página Contacto, bloque de la portada y bloque «Contacta con nosotros» de las fichas y entradas de «Original»). Con TV.meta.api (producción): POST /api/contact al servidor (workers/api o backend-php: honeypot, tiempo mínimo de relleno, solo texto plano y con límite de caracteres, límite por IP, Turnstile opcional: captcha.js). El servidor guarda el mensaje SIEMPRE (se ve en el panel) y avisa por correo al equipo; aquí se avisa de lo que no vale en el idioma de la página.

Secciones: `[CONTACT]`

### `forms.js`

[FORMS] Ayudas comunes de los formularios públicos (contacto y pedido): contador de caracteres, aviso por campo, traducción de los errores del servidor y tiempo de relleno. Los límites (atributo maxlength) y las reglas de «solo texto plano» son las del servidor (TV.PlainText, generado desde shared/plain-text.mjs): aquí solo se avisa antes y en el idioma de la página; el servidor lo vuelve a comprobar SIEMPRE.

Secciones: `[FORMS]` · `[TEXTOS]` · `[CAMPOS]` · `[CONTADOR]` · `[SERVIDOR]`

- `F.elapsed` (l. 16) — Milisegundos desde que se empezó a cargar la página: el servidor exige un mínimo (`_e`) y un robot que envía sin cargarla no lo cumple.
- `text` (l. 20) — Texto de interfaz `key` con {n} y {max} sustituidos por los valores de `vars`.
- `F.codeText` (l. 26) — Aviso, en el idioma de la página, de un código de error del servidor (plain_text, too_long, too_many_links, too_fast y captcha: no se pudo comprobar que es una persona); '' si no se conoce. `max` es el límite del campo.
- `F.clear` (l. 37) — Quita los avisos de error del formulario y la marca de campo no válido.
- `F.fail` (l. 42) — Marca el campo `el` como no válido y pone `msg` justo debajo, enlazado con aria-describedby para que el lector de pantalla lo lea al enfocar el campo.
- `maxOf` (l. 51) — Límite de caracteres del campo (su maxlength); 1000 si no lo tiene.
- `F.checkText` (l. 53) — Revisa con las reglas del servidor los campos de texto `names` del formulario: marca los que no valen y devuelve el primero (o null si todo está bien). Sin TV.PlainText no hace nada.
- `F.counters` (l. 66) — Contador «n / máx» bajo cada textarea con maxlength, y un aviso para lectores de pantalla solo al acercarse al límite (a 50, 20 y 10 caracteres y al llegar a él) para no leer cada letra.
- `update` (l. 73) — Pone el recuento actual y, si se cruza un umbral, el aviso hablado.
- `F.explain` (l. 88) — Muestra la respuesta de error `r` del servidor ({status, code, field, error}). Si es un error de un campo (code + field) lo marca, lo enfoca y devuelve true; si no, devuelve el

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

[QUOTE-PAGE] Página completa del presupuesto: tabla editable, importación CSV/Excel, PDF y envío (simulado en demo). Secciones: [TABLE] · [IMPORT] · [PDF] · [SEND] · [REFRESH] Depende de: quote.js, app.js, forms.js (TV.Forms), plain-text.js (TV.PlainText), captcha.js (TV.Captcha, opcional), pdf.js, SheetJS (window.XLSX) para .xlsx/.xls.

Secciones: `[QUOTE-PAGE]` · `[TABLE]` · `[IMPORT]` · `[PDF]` · `[SEND]` · `[REFRESH]` · `[SEND-LIVE]` · `[SEND-DEMO]`

- `render` (l. 14) — Pinta la tabla del presupuesto (imagen, línea, cantidad editable, precio y total) o el aviso de presupuesto vacío.
- `handleRows` (l. 46) — Importa filas de CSV/Excel: detecta las columnas de referencia y cantidad (o usa la 1.ª y 2.ª) y avisa de las desconocidas.
- `parseCsv` (l. 58) — Convierte texto CSV en filas de celdas con el lector compartido TV.csvParse (quote.js).
- `readFile` (l. 60) — Lee el archivo elegido o soltado (Excel con SheetJS, primera hoja, o CSV como texto) y pasa sus filas a handleRows.
- `customer` (l. 77) — Datos del formulario del presupuesto como objeto {campo: valor}, sin el campo honeypot `hp` (antispam).
- `download` (l. 79) — Descarga el PDF `res` ({blob(), filename}) con un enlace temporal y libera la URL del blob a los 800 ms.
- `sendLive` (l. 101) — Envía el pedido al servidor (POST /api/order) con el PDF adjunto; los precios y totales los fija el servidor.
- `sendDemo` (l. 126) — Demo sin servidor: descarga el PDF, guarda el pedido en localStorage y ofrece un borrador de correo (mailto:).

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

[SHOP] Listados (filtros por categoría, tensión y búsqueda; en la tienda también orden, precio y compra rápida en cada tarjeta) y fichas de producto (tabla de modelos con cantidades, galería). Secciones: [FILTERS] filtros del listado y [STORE] tienda · [MODELS] tabla de modelos · [EXTRAS] referencias que añade la hoja de precios · [GALLERY] galería · [PRICES] precios en las filas Depende de: quote.js, app.js (TV.$, TV.$$, TV.toast).

Secciones: `[SHOP]` · `[FILTERS]` · `[STORE]` · `[MODELS]` · `[EXTRAS]` · `[GALLERY]` · `[PRICES]`

- `on` (l. 16) — Claves marcadas de un mapa de filtros ({clave: true|false}).
- `apply` (l. 18) — Aplica los filtros (categorías, tensiones y texto): oculta las fichas que no encajan y actualiza el contador y el aviso de vacío.
- `cmp` (l. 38) — Compara dos textos con las reglas del idioma de la página (sin distinguir mayúsculas ni tildes).
- `minOf` (l. 40) — Precio mínimo de la tarjeta (número) o null si no tiene ninguno conocido.
- `sortCards` (l. 42) — Reordena las tarjetas EN EL DOCUMENTO (así el orden de lectura y de tabulación es el que se ve) según el criterio elegido; a igualdad, por nombre. Sin precio, al final.
- `qtyIn` (l. 56) — Cantidad entera ≥ 1 escrita en el campo de la tarjeta.
- `buyFor` (l. 58) — Pone en la tarjeta la compra que toca: una sola referencia → cantidad y «añadir al presupuesto»; varias → «elegir modelo» (la tabla de la ficha); ninguna conocida → lo que trae el HTML.
- `paintStore` (l. 71) — Pinta en cada tarjeta de la tienda el precio (el menor de sus referencias, con «desde» si hay varios) y la compra; corre al cargar y con cada cambio de precios.
- `qtyOf` (l. 98) — Cantidad entera ≥ 0 escrita en la fila `tr` (0 si el campo está vacío o no es un número).
- `bindRow` (l. 100) — Conecta una fila de modelos (−, +, cantidad y «añadir») con el presupuesto y la registra para refrescar su precio.
- `extraRow` (l. 118) — HTML de la fila de una referencia que añade la hoja de precios: código, descripción, celda de precio, cantidad y botón añadir.
- `renderExtras` (l. 125) — Pinta (o repinta) tras la tabla de modelos las referencias que la hoja de precios añade a ESTE producto, con su filtro.
- `updatePrice` (l. 145) — Actualiza el precio unitario, los tramos y el importe de una fila de la tabla de modelos según la cantidad escrita.
- `allPrices` (l. 154) — Actualiza el precio de todas las filas y muestra u oculta el aviso de demo según el modo de la hoja de precios.
- `refresh` (l. 156) — Rehace las referencias extra y los precios de las filas; corre al cargar y en cada evento tv:prices.

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

Secciones: `[ORIGINAL]` · `[BASE]` · `[HEADER]` · `[FOOTER]` · `[BUTTONS]` · `[FLOAT]` · `[SHOP-ROOT]` · `[CATEGORY]` · `[LISTING]` · `[PRODUCT]` · `[TABLES]` · `[RELATED]` · `[CONTACT]` · `[HOME]` · `[PAGES]` · `[QUOTE]` · `[MOBILE]` · `[STORE]`

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

- `run` (l. 52) — ejecuta y devuelve (código, salida combinada)
- `git_version` (l. 58) — → (versión, fecha del commit, limpio): hash corto del commit actual, su fecha y si el árbol de trabajo no tiene cambios sin commitear; ('sin-git', '', True) si no hay git.
- `write_build_info` (l. 68) — escribe api/generated/build.json: qué versión es este paquete (sin hora de compilación, para que el mismo commit dé el mismo .zip)
- `build_site` (l. 75) — compila la web de producción (la salida se cuenta línea a línea en la consola de build); `switch` None = el valor por defecto del compilador (sí en pruebas, no en producción)
- `copy_api` (l. 83) — copia SOLO los archivos permitidos del API PHP (lista blanca API_ALLOWED): sin pruebas, sin almacén de datos, sin copias de seguridad y sin la configuración real (config.php lleva claves y la crea quien despliega)
- `shown` (l. 94) — ruta legible: relativa al proyecto si está dentro, absoluta si no
- `files` (l. 102) — Todos los ficheros de la carpeta, ordenados (incluye los ocultos como .htaccess).
- `check_versions` (l. 107) — Actualizar sin caché vieja: todo CSS y JS local de cada página lleva «?v=<10 hex>» igual a la huella (SHA-256) del archivo, y no queda ningún marcador sin resolver.
- `check_csp` (l. 150) — Política de seguridad de contenido: script-src sin 'unsafe-inline' y cada script en línea ejecutable de cada página con su huella SHA-256 en la cabecera (los bloques de datos application/json y ld+json no se ejecutan).
- `check_wp_probes` (l. 179) — El .htaccess corta con 410 los sondeos de WordPress (wp-login.php, xmlrpc.php, wp-admin…) sin tocar las fotos y PDF antiguos de wp-content/uploads ni las páginas de la web: se prueba la expresión con rutas de ejemplo.
- `check_blog` (l. 200) — Blog del panel: las cuatro plantillas del servidor (api/generated/blog-shell.<idioma>.json) se leen, son de ESTA compilación (misma base y mismo modo pruebas/producción), traen todas las marcas que rellena PHP,
- `verify` (l. 238) — → (errores, avisos). Un error impide entregar el paquete.
- `make_zip` (l. 351) — comprime la carpeta (con ficheros ocultos como .htaccess) y devuelve el SHA-256
- `main` (l. 363) — Compila, copia el API, verifica y comprime; si la verificación falla no genera el .zip.

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

### `apply_proposals.mjs`

[APPLY-PROPOSALS] Pasa a la web las propuestas que el manager aprobó con su texto en el panel (Propuestas → «Descargar aprobadas»). node scripts/apply_proposals.mjs --file=propuestas-aprobadas-2026-10-28.json            comprueba y guarda en data/catalog/proposals.applied.json (se mezcla con lo que ya hubiera, por id) node scripts/apply_proposals.mjs --file=… --replace                                       el archivo guardado pasa a ser EXACTAMENTE lo del archivo descargado (así se deshace lo que ya no está aprobado)

Secciones: `[APPLY-PROPOSALS]`

- `arg` (l. 17) — Valor de la opción --k=valor de la línea de comandos ('' si no se pasó).
- `flag` (l. 19) — ¿Se pasó la opción --k?
- `load` (l. 21) — Lee un JSON de data/catalog (o el valor por defecto si no existe).
- `die` (l. 23) — Termina con un mensaje de error.
- `str` (l. 34) — Texto recortado de una entrada del archivo (cadena o vacío).
- `clone` (l. 50) — prueba sobre el catálogo real (copias: no se toca nada)

### `audit_i18n.mjs`

[AUDIT-I18N] Lista, por idioma, los textos de interfaz que escribió el proyecto (los de site/lib/i18n.mjs) y que NO existen tal cual en la web original, para que alguien que domine cada idioma los valide antes de publicar. Los textos del contenido (fichas, páginas, entradas, menús y pie) vienen de la web original sin tocar y no pasan por aquí. node scripts/audit_i18n.mjs            reescribe docs/TEXTOS-DE-INTERFAZ.md

Secciones: `[AUDIT-I18N]`

- `j` (l. 16) — Lee un JSON de data/catalog.
- `norm` (l. 22) — Texto comparable: minúsculas, comillas tipográficas normalizadas y espacios simples.
- `blockTexts` (l. 24) — Texto de una lista de bloques semánticos (títulos, párrafos, listas y tablas) como lista de cadenas sin etiquetas.
- `corpusOf` (l. 36) — Todo el texto de la web original en el idioma `l`, normalizado en una sola cadena.
- `cell` (l. 44) — Escapa las barras verticales de una celda de tabla Markdown.
- `build` (l. 47) — Genera el texto del documento.
- `orig` (l. 52) — ¿El texto de la clave `key` en el idioma `l` aparece tal cual en la web original?

### `capturas.mjs`

[CAPTURAS] Capturas de pantalla de las vistas clave del demo (para revisar sin abrir nada) + PDF de ejemplo. node scripts/capturas.mjs [carpeta-salida] [--theme=clasico|ficha]        (por defecto entrega/capturas y el aspecto que traiga dist/; --theme fuerza uno de los dos aspectos) Sirve dist/ por http, recorre el flujo de un cliente (ficha → presupuesto → PDF) y el panel de gestión, y guarda PNG numerados.

Secciones: `[CAPTURAS]`

- `THEME` (l. 16) — Aspecto forzado con --theme=clasico|ficha ('' = el que traiga dist/).
- `byPid` (l. 25) — Referencia (clave de TV.items) de la primera línea del producto `pid`.
- `mk` (l. 29) — Abre un contexto de navegador de w×h con el idioma fijado a mano (sin autodetección) y devuelve { ctx, page }.
- `shot` (l. 36) — Guarda una captura PNG numerada (NN-nombre.png) en la carpeta de salida y la muestra por consola; opts va a page.screenshot.
- `settle` (l. 38) — Espera a que la página termine de cargar y deja ms milisegundos más para que se asienten los scripts.

### `gen_plain_text_php.mjs`

[GEN-PLAIN-TEXT-PHP] Escribe backend-php/api/lib/PlainTextRules.php a partir de shared/plain-text.mjs: las MISMAS expresiones, límites y rangos de caracteres para el servidor PHP. node scripts/gen_plain_text_php.mjs            reescribe el archivo node scripts/gen_plain_text_php.mjs --check    no escribe; sale con 1 si el archivo está desfasado

Secciones: `[GEN-PLAIN-TEXT-PHP]` · `[PLAIN-TEXT-RULES]`

- `q` (l. 13) — Cadena PHP entre comillas simples (escapa \ y ').
- `build` (l. 18) — Texto del archivo PHP.

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

- `opt` (l. 15) — Valor de la opción --k=valor de la línea de comandos, o d si no se indicó.
- `scan` (l. 44) — Analiza con axe la página que `page` tiene abierta y anota las violaciones bajo la etiqueta `label` (ruta o ruta + estado) en el tamaño `vpName`.

### `qa-admin-live.mjs`

[QA-ADMIN-LIVE] Sesión 7 · Panel REAL (admin-live.js) contra el backend real (sin red, correo ni IA reales). node scripts/qa-admin-live.mjs            contra el Worker torivac-api (en memoria) node scripts/qa-admin-live.mjs --php      contra el API PHP de cPanel (php -S) · ver scripts/lib/backends.mjs

Secciones: `[QA-ADMIN-LIVE]`

- `pick` (l. 28) — 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
- `ok` (l. 45) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `newPage` (l. 47) — Abre un contexto (1440×900) con el catálogo apuntando al API de pruebas; devuelve { ctx, page, errs } (errs = errores de JS).
- `login` (l. 55) — Abre /admin/ y envía el formulario de acceso con el correo y la contraseña dados (no espera al resultado).
- `navs` (l. 57) — Textos de los enlaces del menú lateral del panel.
- `toastText` (l. 59) — Texto del aviso emergente (#toast), leído tras una pausa corta para que aparezca.
- `open` (l. 207) — Busca una propuesta por texto (la búsqueda se confirma con Intro) y la deja abierta; devuelve su tarjeta.
- `clearQ` (l. 209) — Vacía la búsqueda y la confirma (para volver a ver todas las del estado elegido).

### `qa-apache.mjs`

[QA-APACHE] El paquete tal como se sube, sobre un Apache REAL con PHP-FPM (como Plesk y cPanel), con su .htaccess de verdad: URLs limpias, redirecciones, 404 por idioma, ficheros ocultos, sondeos de WordPress (410), cabeceras de seguridad y CSP, compresión y caché, la carpeta api/ cerrada para lo que existe y abierta para las rutas del API, la cabecera Authorization hasta PHP, un mensaje de verdad, el bloqueo de 1 hora y, con un segundo paquete de PRODUCCIÓN, HTTPS obligatorio, un solo host (www → sin www), HSTS, sitemap, llms.txt y robots.txt.

Secciones: `[QA-APACHE]` · `[PAQUETE]`

- `ok` (l. 23) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `writeCfg` (l. 33) — Escribe api/config.php con la carpeta de datos indicada (fuera de la web por defecto).
- `get` (l. 39) — GET (sin seguir redirecciones) de una ruta → { s: estado, h: cabeceras, t: cuerpo }
- `api` (l. 41) — Llamada JSON al API → { s, j }
- `raw` (l. 138) — GET con las cabeceras que se indiquen (incluido Host, que fetch no deja cambiar) → { s, h, t }

### `qa-art.mjs`

[QA-ART] Sesión 12 · Piezas gráficas: osciloscopio del variador (4 idiomas, ratón/teclado, movimiento reducido) y bobinado toroidal de la portada.

Secciones: `[QA-ART]`

- `ok` (l. 13) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `amp` (l. 29) — Amplitud vertical (máx − mín de y) de los tramos «L x y» de un trazado SVG d.

### `qa-blog-apache.mjs`

[QA-BLOG-APACHE] El blog del panel sobre un Apache REAL con PHP-FPM, con los paquetes tal como se suben: se crean entradas por el API como lo haría el panel (entrada publicada con imagen y tabla, su traducción, un borrador, una programada y una con la dirección cambiada) y se mira lo que ve el público y los buscadores: la página de la entrada con la cabecera, menú y pie de la web (todos sus enlaces relativos resuelven), título, descripción, canonical, hreflang, Open Graph, JSON-LD, una sola h1; el listado /blog/ con las entradas nuevas entre las de siempre; sitemap.xml, llms.txt y

Secciones: `[QA-BLOG-APACHE]`

- `ok` (l. 19) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `localLinks` (l. 22) — Todas las direcciones relativas (href/src) de una página → absolutas contra la dirección de la propia página.

### `qa-blog-panel.mjs`

[QA-BLOG-PANEL] El editor del blog del panel, en un navegador de verdad (Chromium) sobre el paquete desplegado en un Apache real con PHP-FPM: entrar, escribir una entrada con la barra de herramientas y la vista previa en vivo, subir una imagen (se comprime en el navegador), rellenar el SEO y ver cómo sale en Google, publicarla, verla en la web, crear su traducción (hreflang en las dos), previsualizar un borrador con la dirección firmada, programar una entrada para el futuro, comprobar errores de validación, la protección de cambios sin guardar y el borrado; con axe-core (accesibilidad) sobre el listado y el editor.

Secciones: `[QA-BLOG-PANEL]`

- `ok` (l. 21) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `toast` (l. 34) — Texto del aviso emergente del panel (#toast), tras una pausa corta para que aparezca.
- `editor` (l. 36) — Espera a que el editor esté pintado.
- `axe` (l. 38) — Analiza con axe la pantalla actual y anota las violaciones graves.
- `id1` (l. 149) — identificador de la primera entrada creada (sale de la dirección del panel: #blog/<id>)
- `id2` (l. 203) — identificador de la entrada en inglés (traducción de la primera)

### `qa-captcha.mjs`

[QA-CAPTCHA] El CAPTCHA invisible OPCIONAL (Cloudflare Turnstile) en los formularios de contacto y de pedido, en un navegador de verdad (Chromium) sobre el paquete desplegado en un Apache real con PHP-FPM: A) SIN claves (cómo se entrega): la página no habla con Cloudflare, no sale el aviso y los formularios funcionan como siempre. B) CON claves, con una RÉPLICA de la API de Cloudflare (determinista, sin red): el script solo se descarga cuando alguien usa el formulario, el token viaja con el envío y el servidor lo comprueba

Secciones: `[QA-CAPTCHA]`

- `ok` (l. 26) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `render` (l. 51) — Crea un widget en el elemento y apunta con qué ajustes se creó (la prueba los lee).
- `execute` (l. 53) — Lanza la comprobación del widget de ese elemento: según el comportamiento elegido, da un token bueno, uno malo, un error o no contesta.
- `reset` (l. 60) — Vuelve el widget a su estado inicial (la réplica no guarda nada).
- `open` (l. 67) — Abre una página nueva (contexto limpio) con los avisos de error recogidos; `replica` sustituye el script de Cloudflare por la réplica y cuenta las descargas.
- `fillContact` (l. 81) — Rellena el formulario de contacto con datos válidos (tras un envío bueno el formulario se vacía).
- `sendContact` (l. 88) — Rellena el formulario de contacto de la página y lo envía; devuelve el aviso que sale.
- `form` (l. 95) — El formulario de contacto que se ve en la página (según el aspecto hay dos copias en el HTML y solo una se muestra).
- `messages` (l. 97) — Los mensajes de contacto que hay guardados en el servidor (los ve un manager).
- `axe` (l. 99) — Analiza con axe la pantalla actual y anota las violaciones graves.

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

- `pick` (l. 24) — 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
- `round2` (l. 27) — Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web).
- `unit` (l. 29) — Precio unitario esperado de ref para q unidades: el del último tramo por cantidad alcanzado, o el base.
- `ok` (l. 42) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.

### `qa-package.mjs`

[QA-PACKAGE] El paquete del hosting (cPanel/Plesk) tal y como se sube: lo genera package_cpanel.py (con sus verificaciones), se sirve con php -S (URLs limpias, API PHP real con almacén en ficheros, Resend simulado) y se recorre con el navegador: precios que llegan del servidor (el paquete NO lleva precios), presupuesto, pedido, panel y seguridad del API.

Secciones: `[QA-PACKAGE]` · `[PAQUETE]`

- `pick` (l. 27) — Primera referencia pedible de un producto (código real del PDF o línea genérica P<id>).
- `round2` (l. 30) — Redondea a 2 decimales (importe de línea).
- `unit` (l. 32) — Precio unitario de una referencia para una cantidad, con los tramos de la hoja.
- `ok` (l. 42) — Anota una comprobación: la cuenta como fallo si no se cumple y la imprime.
- `peek` (l. 104) — Pide una ruta del API y devuelve el código HTTP y si la respuesta enseña código PHP.

### `qa-quote.mjs`

[QA-QUOTE] Sesión 5 · Presupuesto realista de punta a punta en los 4 idiomas (Playwright, modo file://). node scripts/qa-quote.mjs Escenario: transformador toroidal (serie TT), resistencias y botones de baquelita, con cantidades que cruzan tramos de precio

Secciones: `[QA-QUOTE]` · `[DATA]` · `[SCENARIO]`

- `round2` (l. 28) — Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web).
- `unitPrice` (l. 30) — Precio unitario esperado de ref para qty unidades (último tramo alcanzado, o el base); null si no tiene precio.
- `ok` (l. 62) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `norm` (l. 64) — Texto con los espacios duros (U+00A0, U+202F) pasados a espacio normal y los repetidos colapsados, para comparar importes.
- `file` (l. 74) — URL de la ruta p: por http si hay servidor de pruebas (BASE) o file:// sobre dist/ con --file.

### `qa-security-panel.mjs`

[QA-SECURITY-PANEL] El acceso en dos pasos y la seguridad del panel, en un navegador de verdad (Chromium) sobre el paquete desplegado en un Apache real con PHP-FPM y el correo guardado en una carpeta (controlador «file»: el código llega a <datos>/outbox y la prueba lo lee de ahí, como lo leería una persona de su bandeja): 1) la dueña (cuenta de confianza) entra solo con la contraseña · 2) un manager normal recibe un código, lo escribe (con un fallo antes), marca «recordar este dispositivo» y entra

Secciones: `[QA-SECURITY-PANEL]`

- `ok` (l. 28) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `fresh` (l. 38) — Abre un navegador nuevo (sin cookies ni sesión) con sus avisos de error y de confirmación recogidos → { ctx, page, dialogs }
- `signIn` (l. 49) — Escribe correo y contraseña en la pantalla de acceso y pulsa «Entrar».
- `panel` (l. 54) — Espera a que el panel esté pintado (menú lateral).
- `codeScreen` (l. 56) — Espera a la pantalla del código.
- `toast` (l. 58) — Texto del aviso emergente del panel (#toast), tras una pausa corta para que aparezca.
- `wrongCode` (l. 60) — Otro código que no sea `real` (para equivocarse a propósito).
- `axe` (l. 62) — Analiza con axe la pantalla actual y anota las violaciones graves.
- `shot` (l. 71) — Guarda una captura de la pantalla si se pidió (QA_SHOTS=<carpeta>): sirve para mirar cómo quedó, no es una comprobación.
- `visitor` (l. 73) — Cabeceras para hacerse pasar por otro visitante en el API.
- `hammer` (l. 75) — Intentos de acceso con contraseña mala desde otro «visitante» (para provocar un bloqueo de una hora).
- `until` (l. 77) — Espera (hasta `ms`) a que se cumpla `fn`: los avisos por ataque repetido salen cuando la respuesta ya terminó, así que no están en la carpeta al instante.
- `settle` (l. 79) — Pausa corta para que, si iba a salir un aviso al terminar la respuesta, ya haya salido (se usa antes de afirmar que NO salió).
- `alerts` (l. 247) — Los correos de «intentos repetidos» que se han mandado (el aviso al equipo).
- `bkRows` (l. 357) — Las filas de la tabla de copias de seguridad de Ajustes.

### `qa-shop.mjs`

[QA-SHOP] La tienda (todos los productos): página propia en los 4 idiomas y en los tres aspectos (Ficha técnica, Clásico, Original), con filtros por categoría, tensión y texto, orden por nombre, precio y categoría, precio y «añadir al presupuesto» en cada tarjeta, y la portada de «Productos» solo con categorías. node scripts/qa-shop.mjs

Secciones: `[QA-SHOP]` · `[HTML]` · `[BROWSER]` · `[NAV]` · `[LANG]` · `[NOJS]`

- `ok` (l. 23) — Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo.
- `build` (l. 25) — Compila una variante del sitio en TMP/<name> con las opciones `args` y devuelve su carpeta.
- `read` (l. 27) — Texto del archivo `f` (ruta relativa) de la variante `dir`.
- `ctxOf` (l. 81) — Contexto de navegador con idioma ya elegido, el aspecto `theme` ya guardado y las opciones `o`.
- `visible` (l. 83) — Visibles: las tarjetas de la tienda que el filtro deja a la vista, con su nombre, precio mínimo y categoría.
- `priced` (l. 85) — Espera a que todas las tarjetas tengan su precio pintado.
- `orderOf` (l. 114) — orden

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

### `test-blog-markdown-php.mjs`

[TEST-BLOG-MD-PHP] Compara el conversor de texto del blog de JavaScript (shared/blog-markdown.mjs, el que usa la vista previa del panel) con el de PHP (backend-php/api/lib/BlogMarkdown.php, el que publica la página): decenas de miles de textos al azar —con las piezas más peligrosas, espacios raros de Unicode, emojis, acentos y direcciones de todo tipo— y la salida tiene que ser IDÉNTICA en las dos. Además PCRE no puede fallar (límites de retroceso o de pila) con ninguno de esos textos.

Secciones: `[TEST-BLOG-MD-PHP]`

- `arg` (l. 15) — Valor de la opción --k=valor (o el valor por defecto).
- `rnd` (l. 21) — Número pseudoaleatorio en [0,1) con semilla fija: la misma tanda en cada ejecución.
- `pick` (l. 23) — Un elemento al azar de una lista.
- `gen` (l. 30) — Un texto al azar con entre 1 y `max` piezas.
- `bad` (l. 57) — Muestra los primeros desacuerdos con detalle.

### `test-blog-markdown.mjs`

[TEST-BLOG-MD] Pruebas del conversor de texto del blog (shared/blog-markdown.mjs). node scripts/test-blog-markdown.mjs            recorre shared/blog-markdown.fixtures.json (el contrato que también cumple backend-php/api/lib/BlogMarkdown.php), comprueba que NUNCA sale HTML fuera de la lista permitida (con miles de entradas al azar y ataques conocidos)

Secciones: `[TEST-BLOG-MD]`

- `ok` (l. 18) — Anota una comprobación correcta o, si no se cumple, un fallo con su mensaje.
- `eq` (l. 20) — Comprueba que `got` es exactamente `want` y, si no, enseña los dos.
- `audit` (l. 41) — Devuelve la lista de problemas del HTML (vacía si todo es lo permitido).
- `rnd` (l. 80) — Número pseudoaleatorio en [0,1) con semilla fija: la misma tanda de entradas hostiles en cada ejecución.

### `test-plain-text.mjs`

[TEST-PLAIN-TEXT] Pruebas del validador de texto plano de los formularios (shared/plain-text.mjs) contra su contrato (shared/plain-text.fixtures.json), que también cumple el servidor PHP. Además comprueba que backend-php/api/lib/PlainTextRules.php está al día y que ningún texto razonable de las pruebas de aceptación se rechaza. node scripts/test-plain-text.mjs

Secciones: `[TEST-PLAIN-TEXT]`

- `ok` (l. 17) — Anota una comprobación: correcta, o fallo con su mensaje.
- `load` (l. 31) — Ejecuta el script generado en un entorno aislado (con `RegExp` propio si se indica) y devuelve TV.PlainText.
- `Old` (l. 41) — Constructor de RegExp de un navegador antiguo: lanza si la expresión usa lookbehind, como Safari anterior a 16.4.

### `test-proposals.mjs`

[TEST-PROPOSALS] Pruebas de la aplicación de las propuestas aprobadas con texto propio (site/lib/proposals-apply.mjs) y del archivo data/catalog/proposals.applied.json: sustituir un párrafo, traducir una descripción, cambiar el título de la portada, escapar siempre lo escrito y avisar de lo que no encaja. Con datos sintéticos y con el catálogo real. node scripts/test-proposals.mjs

Secciones: `[TEST-PROPOSALS]`

- `load` (l. 13) — Lee un JSON de data/catalog.
- `ok` (l. 16) — Anota una comprobación: correcta, o fallo con su mensaje.
- `clone` (l. 18) — Copia profunda de datos JSON.
- `synth` (l. 30) — Datos de prueba sintéticos: una página con título, párrafo, lista y tabla, una ficha de producto, una categoría y los títulos SEO.
- `real` (l. 72) — Copia del catálogo real (páginas, productos, categorías y títulos SEO) para aplicar propuestas sin tocar los JSON.
- `has` (l. 84) — Texto JSON de un objeto, para comparar datos completos.

### `qa-all.sh`

[QA-ALL] Todas las pruebas del proyecto, una tras otra, con resumen final (la CI hace lo mismo en ci/ci.yml). bash scripts/qa-all.sh             # todo (unos 15-25 min; qa-ux recorre las ~770 páginas en escritorio y en móvil) bash scripts/qa-all.sh --rapido    # sin qa-ux, qa-a11y ni perf (unos 4-6 min)

### `rebuild.sh`

Reconstruye TODO el demo a partir de los datos ya cosechados/analizados (orden importa). bash scripts/rebuild.sh            # contenido + catálogo + precios + sitio

## `scripts/lib/`

### `apache.mjs`

[APACHE] Un Apache REAL con PHP-FPM (como en Plesk y cPanel) para probar el paquete tal como se sube: el .htaccess de verdad (reescrituras, 410, cabeceras, 404 por idioma, ruta /api, cabecera Authorization hacia PHP-FPM), no un servidor de pruebas que lo imite. Necesita los paquetes apache2 y php8.3-fpm (sudo apt-get install apache2 php8.3-fpm); si no están, las pruebas que lo usan se saltan con un aviso claro (apacheAvailable() devuelve el motivo).

Secciones: `[APACHE]`

- `firstExisting` (l. 17) — Primera ruta que existe de una lista, o ''.
- `apacheAvailable` (l. 20) — '' si hay Apache y PHP-FPM utilizables; si no, el motivo (qué instalar).
- `freePort` (l. 30) — Puerto TCP libre en 127.0.0.1.
- `waitPort` (l. 32) — Espera (hasta `ms`) a que algo responda en el puerto.
- `startApache` (l. 43) — Arranca PHP-FPM y Apache sobre `docroot`. `extraConf` se añade al final de la configuración de Apache (p. ej. otro <VirtualHost> o directivas de prueba).

### `backends.mjs`

[BACKENDS] Servidores de API intercambiables para las pruebas de navegador: el Worker (workers/api, en memoria) o el PHP (backend-php/api, con `php -S`). Los mismos guiones (qa-live, qa-admin-live, qa-tarifa) corren contra los dos: si el contrato de un backend se desvía, falla la misma comprobación. const be = await startBackend({ kind: backendKind(), dist, port? });   (port: solo PHP, cuando la web ya lleva la URL compilada)   kind: 'worker' (por defecto) | 'php' (flag --php o TV_BACKEND=php)

Secciones: `[BACKENDS]` · `[WORKER]` · `[PHP]`

- `backendKind` (l. 27) — Backend elegido por la línea de comandos: 'php' con --php (o TV_BACKEND=php), 'worker' por defecto.
- `freePort` (l. 30) — Puerto TCP libre en 127.0.0.1.
- `readBody` (l. 32) — Cuerpo completo de una petición HTTP entrante, como Buffer.
- `externals` (l. 35) — servicios de terceros simulados; la misma lógica sirve al Worker (fetchImpl) y al PHP (servidor http)
- `handle` (l. 38) — Responde a los servicios externos simulados (Resend, Anthropic, hoja CSV, libro Excel) y guarda lo que se les envía.
- `startWorker` (l. 51) — Arranca el Worker torivac-api en memoria (KV simulado) detrás de un servidor http, con la web en otro puerto; misma interfaz que startPhp.
- `mockFetch` (l. 60) — fetch simulado del Worker: delega en los servicios externos simulados.
- `startPhp` (l. 90) — Arranca el API PHP con php -S sobre una copia de api/ y enlaces a la web; devuelve la misma interfaz que startWorker.
- `writeCfg` (l. 110) — Escribe api/config.php con la configuración de pruebas (PHP la lee en cada petición).
- `kv` (l. 124) — Ruta del fichero del almacén que corresponde a una clave.
- `read` (l. 126) — Valor guardado en el almacén del PHP para una clave (null si no existe).
- `startBackend` (l. 142) — Arranca el backend pedido ('worker' o 'php') y devuelve su interfaz común.

### `pkg-apache.mjs`

[PKG-APACHE] Despliega un paquete de la web (producción o pruebas) en un Apache REAL con PHP-FPM y deja a mano lo que hace falta para probarlo: peticiones con el Host y el esquema que se quiera, llamadas al API con la sesión de un manager recién creado y una imagen PNG válida de cualquier tamaño. Lo usan scripts/qa-blog-apache.mjs (peticiones directas) y scripts/qa-blog-panel.mjs (navegador). const d = await deployPackage({ staging, local })    local = true: la web es http://127.0.0.1:<puerto> (para abrirla con un navegador); si no, https://example.test (o pruebas.example.test) detrás de un «proxy» (cabecera X-Forwarded-Proto)

Secciones: `[PKG-APACHE]`

- `freePort` (l. 23) — Puerto TCP libre en 127.0.0.1.
- `png` (l. 26) — PNG de colores lisos de w×h píxeles (válido de verdad: con sus sumas de control).
- `crc` (l. 28) — Suma de control CRC-32 de un trozo de bytes.
- `chunk` (l. 30) — Trozo de PNG: longitud, tipo, datos y suma de control.
- `deploy` (l. 38) — Despliega un paquete (producción o pruebas) en un Apache real → { www, ap, port, host, req(), api(), stop() }
- `req` (l. 51) — Petición con las cabeceras que se indiquen (incluido Host, que fetch no deja cambiar); por defecto como llega detrás del proxy con https → { s, h, t, b }
- `api` (l. 56) — Llamada JSON al API → { s, j }
- `deployPackage` (l. 70) — Despliega el paquete en un Apache real → { www, ap, port, host, BASE, req, api, token, stop } (ver la cabecera).
- `writeCfg` (l. 81) — Escribe api/config.php con `c`.
- `setConfig` (l. 84) — Cambia apartados de config.php (cada clave de primer nivel que se pase sustituye a la de antes).
- `outbox` (l. 86) — Correos guardados por el controlador «file», del más antiguo al más reciente (por la hora del fichero: el nombre solo tiene segundos) → [{ file, to, subject, text, html }]
- `kvFile` (l. 88) — Fichero del almacén de una clave (p. ej. «pin:<id>»): kv/<clave con % >.json.
- `kvKeys` (l. 90) — Claves del almacén que empiezan por `prefix`, más recientes primero.
- `kvDrop` (l. 92) — Borra del almacén todas las claves que empiezan por `prefix` (p. ej. 'rl:contact:' para volver a empezar los límites por visitante) → cuántas.
- `kvGet` (l. 94) — Lee el valor guardado en una clave del almacén, o null.
- `kvEdit` (l. 96) — Cambia el valor de una clave del almacén con `fn(valor) → valor nuevo` (para adelantar el reloj de un código, por ejemplo).
- `lastCode` (l. 98) — El último código de acceso (6 cifras, sin espacio) que se mandó a `email`, o null si no se mandó ninguno.
- `req` (l. 100) — Petición con las cabeceras que se indiquen (incluido Host, que fetch no deja cambiar); por defecto como llega detrás del proxy con https → { s, h, t, b }
- `api` (l. 105) — Llamada JSON al API → { s, j, h }. `headers` añade cabeceras (p. ej. X-Forwarded-For: 203.0.113.7 para hacerse pasar por otro visitante: el Apache de pruebas confía en la conexión local).

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

[EMAIL] Envío de correo por Resend o Brevo (HTTP, sin SDK) según EMAIL_PROVIDER (resend por defecto · brevo · none), con el MOTIVO veraz de cada intento y sin secretos en los errores. Resultado de sendMail: { ok, id?, reason:'sent'|'off'|'failed'|'skipped', error?, driver, status?, skipped? }. off = sin controlador (EMAIL_PROVIDER=none); skipped = faltan credenciales, remitente o destinatarios; failed = el proveedor respondió error o no respondió. `error` es un texto CORTO (≤ 160) y sin secretos, solo para gestores. Cada envío anota su resultado en mail:last (ver mailstate.js).

Secciones: `[EMAIL]` · `[CONTROLADORES]` · `[COPIA]` · `[CONTACTO]`

- `providerUnknown` (l. 18) — True si EMAIL_PROVIDER trae un valor que no es resend, brevo ni none (se trata como «none»: falla cerrado). Vacío o ausente = resend.
- `mailDriver` (l. 20) — Controlador de correo activo según EMAIL_PROVIDER: «resend» (por defecto), «brevo» o «none»; un valor desconocido falla cerrado y cuenta como «none».
- `parseSender` (l. 29) — Remitente de ORDER_FROM («Nombre <correo@dominio>» o solo el correo; si falta, Torivac Web <pedidos@torivac.com>) → { ok:true, name, email, from } con `from` normalizado, o { ok:false }
- `teamRecipients` (l. 37) — Destinatarios del equipo: los correos válidos de ORDER_TO (separados por comas); los que no lo son se ignoran (y mailProblems avisa de ORDER_TO).
- `blocker` (l. 39) — Por qué NO se puede enviar ahora → { reason:'off'|'skipped', error }, o null si el controlador está listo (clave del proveedor y remitente válidos).
- `mailReady` (l. 47) — True si el controlador activo puede enviar ahora (no es «none» y tiene su clave y un remitente válido).
- `mailSettingProblems` (l. 49) — Ajustes de correo MAL puestos (solo nombres, nunca valores): EMAIL_PROVIDER desconocido u ORDER_FROM que no es «Nombre <correo@dominio>». Los avisa /api/health en config.problems.
- `mailProblems` (l. 56) — Ajustes que impiden o estorban el envío (solo nombres, nunca valores): los mal puestos, la clave del controlador activo (RESEND_API_KEY o BREVO_API_KEY) y los destinatarios de ORDER_TO.
- `mailStatus` (l. 66) — Estado del correo para el panel y la salud → { driver, configured, problems (nombres de ajustes), last (último intento o null) }; nunca lleva valores secretos.
- `providerError` (l. 73) — Texto corto y sin secretos del fallo de un proveedor: «Brevo 401: mensaje» (mensaje ≤ 120 caracteres) o, si no dio mensaje, «Brevo respondió 401».
- `callProvider` (l. 79) — POST JSON a la API de un proveedor y traduce la respuesta → { ok:true, reason:'sent', id? } o { ok:false, reason:'failed', status?, error }. Cualquier 2xx cuenta como aceptado; sin respuesta en 15 s se corta.
- `toList` (l. 88) — Lista de direcciones: una lista tal cual, un texto suelto como lista de uno, nada como lista vacía.
- `deliver` (l. 90) — Prepara y envía por el controlador activo, sin anotar nada → { ok, id?, reason, skipped?, status?, error? }. Sin controlador, credenciales, remitente o destinatarios válidos no llama a ningún proveedor.
- `sendMail` (l. 112) — Envía un correo por el controlador activo → { ok, id?, reason, error?, driver, status?, skipped? } y anota el intento en mail:last (`kind`: 'order' · 'contact' · 'test'). El asunto va siempre en una línea;
- `money` (l. 120) — Importe en euros con el formato del idioma (es, en, fr, de); «—» si no hay importe.
- `orderMail` (l. 124) — Correo de aviso de un pedido para el equipo → { html, text } con cliente, líneas, total, marca de precios de demostración y, si va PDF adjunto, el aviso de que el importe válido es el del servidor.
- `copySubject` (l. 144) — Asunto fijo de la copia al cliente (el mismo en todos los idiomas).
- `customerCopyMail` (l. 149) — Copia del pedido para el CLIENTE → { subject, html, text }. Solo contenido generado por el servidor: texto fijo en el idioma del pedido, número, líneas (ref, nombre del catálogo, cantidad e
- `contactMail` (l. 165) — Correo de un mensaje de contacto PARA EL EQUIPO → { subject, html, text }. Asunto «Contacto web · <nombre>» en una línea; nombre, correo, idioma, id del mensaje y texto del visitante van SIEMPRE
- `testMail` (l. 177) — Correo de PRUEBA del panel → { subject, html, text }: asunto «Torivac · prueba de correo», texto fijo y, como datos, el controlador y la hora (ISO).

### `index.js`

[INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login Acceso: 5 contraseñas erróneas del mismo visitante contra una cuenta (o 15 contra cualquiera, o 30 contra una cuenta de cualquier visitante) = bloqueo de 1 hora; ver handleLogin.

Secciones: `[INDEX]`

- `tooMany` (l. 26) — 429 con el texto de siempre (inundación, Bearer): el mismo para cualquier límite de acceso, nunca distingue si un usuario existe.
- `lockWait` (l. 28) — Texto del tiempo que queda de bloqueo: «una hora» si falta casi una hora entera; si no, «N minutos» (redondeado hacia arriba).
- `locked` (l. 30) — El 429 del bloqueo por fallos de contraseña: el mismo para los tres motivos y exista o no la cuenta; dice cuánto falta (retry_after y Retry-After, en segundos).
- `turnstileSitekey` (l. 36) — Clave PÚBLICA de Cloudflare Turnstile (TURNSTILE_SITEKEY) si está bien escrita; '' si no. Los formularios de la web solo piden el CAPTCHA cuando /api/health la anuncia junto al secreto.
- `configProblems` (l. 41) — Ajustes mal puestos que se avisan en /api/health: solo sus NOMBRES (SESSION_SECRET, ADMIN_API_TOKEN, ORDER_COPY, EMAIL_PROVIDER, ORDER_FROM), nunca sus valores.
- `fail` (l. 51) — Respuesta de error: un ApiError enseña su mensaje y estado; cualquier otra excepción se responde como «Error interno» con un id de 8 hex y el detalle va al registro con ese id.
- `identify` (l. 58) — Quién llama + control de fallos de Bearer: sin Bearer → anónimo; con Bearer inválido cuenta un FALLO (30 / 10 min por ipKey) y, pasado el tope, responde { limited: true }. Una petición válida no consume cupo.
- `handleLogin` (l. 71) — POST /api/auth/login, con protección contra la fuerza bruta: 5 contraseñas erróneas del mismo visitante (ipKey) contra una cuenta bloquean ESA pareja 1 HORA desde el 5.º fallo (ni la contraseña
- `route` (l. 97) — Enruta la petición (ya con CORS resuelto) → Response; las excepciones suben a fetch, que las convierte en «Error interno».
- `fetch` (l. 172) — Atiende cada petición HTTP: CORS, rutas públicas, login y rutas de sesión o de manager; deps = { fetchImpl, ctx, now, purge, rand } para pruebas. Una excepción NUNCA escapa sin cabeceras CORS.
- `scheduled` (l. 188) — Tarea programada (cron): sincroniza los precios con la hoja de origen y limpia los registros de límites caducados; un fallo se anota en prices:meta y en el log, y no se propaga.

### `mailapi.js`

[MAILAPI] Endpoints de gestión de los mensajes de contacto y del correo. SOLO managers (sesión de manager o token maestro): index.js ya comprobó el rol antes de llegar aquí. GET /api/messages?limit=100        → { ok, items:[{ id, at, name, email, message, lang, ip, emailed:{ sent, reason, error? } }], truncated }   (más recientes primero; limit 1..300) DELETE /api/messages/:id           → { ok:true } · 404 si no existe (derecho de supresión)

Secciones: `[MAILAPI]`

- `priv` (l. 14) — Cabeceras de estas respuestas: nada de caché (son datos personales y estado vivo) y sin que el navegador adivine el tipo del contenido.
- `handleMessageList` (l. 18) — GET /api/messages?limit=N: los mensajes más recientes primero (hasta 300; por defecto 100) con la IP y el estado del correo; un registro corrupto se omite.
- `handleMessageDelete` (l. 23) — DELETE /api/messages/:id (el id llega tal cual viene en la URL, aún codificado): borra el mensaje; 404 si no existe o el id no tiene la forma CT-AAAAMMDD-NNNN-XXX.
- `optionalBody` (l. 29) — Cuerpo JSON opcional de la petición → objeto ({} si no hay cuerpo), o null si es demasiado grande, anida demasiado, no es JSON o no es un objeto.
- `handleMailTest` (l. 41) — POST /api/mail/test { to? }: envía «Torivac · prueba de correo» a `to` (un correo válido) o, si no se da, a los destinatarios de ORDER_TO. Responde 200 { ok, driver, to, sent, reason, error? } aunque el
- `handleMailStatus` (l. 57) — GET /api/mail/status: controlador activo, si está configurado, los NOMBRES de los ajustes que faltan (nunca valores) y el último intento de envío (null si todavía no hubo ninguno).

### `mailstate.js`

[MAILSTATE] Último intento de envío de correo (clave KV mail:last, solo el último, igual que prices:sync) y limpieza de secretos en los textos de error que ven los gestores. mail:last = { at, kind:'contact'|'order'|'test', ok, reason:'sent'|'off'|'failed'|'skipped', error? }. No lleva datos del visitante (ni correo, ni nombre, ni mensaje).

Secciones: `[MAILSTATE]`

- `scrub` (l. 19) — Texto de error de UNA línea, sin secretos y de como mucho `max` caracteres: tacha los valores exactos de los secretos del entorno (claves, tokens, contraseñas) y las formas típicas de clave.
- `recordMail` (l. 26) — Anota en mail:last el resultado del último intento de envío (también el fallido, el omitido y el de un controlador apagado); sobrescribe. Un fallo al anotarlo nunca tapa el resultado real del envío.
- `readLast` (l. 33) — Último intento de envío guardado en mail:last → { at, kind, ok, reason, error? }, o null si no hay ninguno o está dañado.

### `messages.js`

[MESSAGES] Mensajes del formulario de contacto guardados en KV (retención de 400 días, como los pedidos: la caducidad la hace KV con expirationTtl, sin cron) y su listado/borrado acotados para el panel. Clave: msg:<fecha invertida>-<contador invertido>-<sufijo>, derivada del id CT-AAAAMMDD-NNNN-XXX. KV solo lista en orden ascendente; al invertir fecha y contador, UN list() devuelve primero los más recientes (1 operación de list + como mucho 300 de get —más los registros corruptos que se salten— por petición, sin recorrer todo el almacén). El id se puede volver a convertir en clave, así que borrar un mensaje es directo (sin índices aparte).

Secciones: `[MESSAGES]`

- `messageKey` (l. 12) — Clave KV del mensaje con ese id (CT-AAAAMMDD-NNNN-XXX), o null si el id no tiene esa forma. Fecha y contador van invertidos (restados de 99999999 y 99999) y con ancho fijo para que el orden de claves sea el de más reciente primero.
- `putMessage` (l. 17) — Guarda (o sobrescribe) el registro de un mensaje con caducidad de 400 días; lanza si KV no deja escribir.
- `messageExists` (l. 19) — True si ya hay un mensaje guardado con ese id.
- `deleteMessage` (l. 21) — Borra el mensaje con ese id → true si existía, false si no existe (o el id no es válido).
- `str` (l. 27) — Texto de un campo del registro, o '' si no es una cadena (un registro dañado nunca rompe el listado).
- `view` (l. 29) — Registro de KV (texto JSON) → vista para el gestor { id, at, name, email, message, lang, ip, emailed:{ sent, reason, error? } }, o null si falta, no es JSON o no trae id y fecha.
- `messageLimit` (l. 36) — `limit` pedido en la URL (texto o número) → entero entre 1 y 300; ausente o ilegible = 100.
- `newestKeys` (l. 41) — Nombres de las `fetch` claves de mensaje más recientes → { names, complete } (complete = KV ya no tiene más); sigue el cursor si devuelve páginas más cortas (como mucho 8 páginas).
- `listMessages` (l. 56) — Mensajes para el panel (solo gestores) → { items (más recientes primero, hasta `limit`, 1..300), truncated }. Un list de KV (con unas claves de margen para los registros corruptos) + un get por mensaje, en grupos de 10:

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

[ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por correo: AVISO al equipo (con el PDF que fabricó el navegador) y, según ORDER_COPY y con topes, COPIA al cliente con contenido generado solo por el servidor (sin PDF ni texto del visitante). Número de pedido TV-AAAAMMDD-NNNN-XXX (XXX aleatorio: dos pedidos simultáneos no se pisan). POST /api/contact → guarda SIEMPRE el mensaje (CT-AAAAMMDD-NNNN-XXX, ver messages.js), intenta el correo al equipo y dice la verdad sobre él en `emailed`.

Secciones: `[ORDERS]`

- `ymd` (l. 21) — Fecha en UTC como AAAAMMDD, para el número de pedido y su contador diario.
- `intVar` (l. 23) — Entero de una variable de entorno (texto de cifras); si falta, no es un entero o es menor que `min`, vale `def`.
- `copyMode` (l. 25) — Modo de la copia al cliente: «capped» (por defecto, con topes) u «off» (nunca); cualquier otro valor falla cerrado y cuenta como «off».
- `randomSuffix` (l. 27) — 3 caracteres aleatorios base36 en mayúsculas para cerrar el número de pedido; `rand(n)` devuelve n enteros sin signo (se puede inyectar en las pruebas).
- `baseNumber` (l. 29) — Parte «<prefijo>-AAAAMMDD-NNNN» del número (TV = pedidos, CT = mensajes de contacto): contador diario en KV de «mejor esfuerzo» (no es atómico; si KV lo rechaza, un número de respaldo por segundos del día: el pedido nunca se pierde por esto).
- `nextNumber` (l. 36) — Siguiente número de pedido completo (TV-AAAAMMDD-NNNN-XXX).
- `uorderPrefix` (l. 38) — Prefijo de las claves del índice de pedidos de un cliente: uorder:<32 primeros hex del SHA-256 de su correo en minúsculas>: (nunca el correo en la clave).
- `sendCopy` (l. 44) — Decide y, si procede, envía la copia al cliente → motivo: 'sent' | 'failed' | 'not_requested' (el visitante mandó copy:false) | 'off' (ORDER_COPY no es «capped») | 'skipped' (correo sin configurar) |
- `handleOrder` (l. 56) — POST /api/order: límites (por visitante y global), validación, valoración en servidor con los precios vigentes, guardado en KV, aviso al equipo y copia al cliente.
- `sleep` (l. 91) — Espera `ms` milisegundos (0 = no espera).
- `handleContact` (l. 97) — POST /api/contact: límite por visitante y anti-spam como siempre (5 / 10 min por ipKey, Turnstile); luego construye el registro, LO GUARDA (msg:…, 400 días), intenta el correo al equipo, anota el resultado
- `notSaved` (l. 100) — 500 «No se pudo guardar el mensaje» (el detalle va al registro del servidor, sin datos del visitante).

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

### `proposals.js`

[PROPOSALS] Decisiones del manager sobre las propuestas de mejora del panel (clave KV proposals:state: id de la propuesta → entrada). Igual que backend-php/api/lib/Proposals.php. Una entrada es { state: ok|no, by, at } y, si el manager ha editado la propuesta, también: mode  → qué hace su texto: replace (sustituye el párrafo de la web que contiene `find`) · translate (descripción del producto en otro idioma) · title (título de la portada, una línea

Secciones: `[PROPOSALS]`

- `proposalEntry` (l. 19) — Valida el cuerpo de POST /api/proposals/state para el estado `ok` o `no` → { entry } con los textos ya normalizados (sin controles ni invisibles) o { error, code?, field? }. Los campos

### `ratelimit.js`

[RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms. La clave NUNCA lleva el identificador en claro: rl:<cubo>:<SHA-256 hex (32 primeros)> → longitud acotada (KV admite 512 bytes), sin correos ni IP en las claves y sin eco de la clave en los errores. Cada registro se guarda con expirationTtl (KV lo borra solo al caducar); además, purgeExpired limpia «al vuelo» lo caducado que pudiera quedar.

Secciones: `[RATE-LIMIT]`

- `rlKey` (l. 7) — Clave KV del limitador: rl:<cubo>:<32 primeros hex del SHA-256 del identificador>.
- `read` (l. 9) — Lee el registro { count, resetAt } vigente del cubo, o null si no hay o ya caducó.
- `hit` (l. 14) — Cuenta una acción en el cubo (ventana fija de windowMs desde la primera) → { allowed, remaining, resetAt, count }; allowed es false cuando se supera `max`.
- `isBlocked` (l. 22) — True si el cubo ya está en el máximo dentro de su ventana vigente. Solo lee: sirve para contadores que cuentan únicamente los fallos (se llama a hit tras cada fallo).
- `failLock` (l. 30) — Anota un fallo de un contador con BLOQUEO: los fallos se cuentan en una ventana de `windowMs` desde el primero y, al llegar al `max`-ésimo, el contador queda bloqueado `lockMs` desde ESE momento
- `lockedFor` (l. 41) — Milisegundos que le quedan de bloqueo a un contador con bloqueo (failLock); 0 si no está bloqueado. Solo lee.
- `reset` (l. 46) — Pone a cero el cubo (p. ej. tras un acceso correcto).
- `purgeExpired` (l. 48) — Borra hasta `limit` registros rl:* caducados (por su dato de caducidad en KV o, si no lo trae, por su resetAt) → cuántos borró. Se llama «al vuelo» en 1 de cada 50 peticiones.

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

- `oneLine` (l. 16) — Texto de UNA línea: sin \r \n \t ni otros caracteres de control (se sustituyen por un espacio), espacios colapsados, recortado y limitado a max caracteres.
- `multiLine` (l. 18) — Texto con saltos de línea (notas, mensajes): conserva \n y el tabulador, convierte \r\n y \r en \n y quita el resto de controles; recortado y limitado a max caracteres.
- `isEmail` (l. 20) — True si `s` es un correo válido y estricto (≤ 254 caracteres, parte local ≤ 64).
- `optText` (l. 22) — True si el valor es ausente (undefined o null) o una cadena.
- `isObj` (l. 24) — True si v es un objeto «de verdad» (no null ni lista).
- `parsePdf` (l. 30) — Valida el PDF que manda el navegador → { b64 } normalizado (sin saltos de línea) o { error }. Base64 estricto (^[A-Za-z0-9+/]+={0,2}$ tras quitar los saltos de línea, con longitud múltiplo de 4),
- `minFillMs` (l. 42) — Milisegundos mínimos entre cargar la página y enviar el formulario (variable FORM_MIN_FILL_MS; 1200 si falta o no es un número; 0 = no se exige `_e`).
- `fillTimeError` (l. 49) — Error de `_e`: null si trae un entero ≥ el mínimo (o el mínimo es 0); si no, { error, code:'too_fast' }: un bot que postea sin cargar la página.
- `textFields` (l. 57) — Revisa los campos de texto (`spec`: nombre → multilínea sí/no) de `src` con shared/plain-text.mjs y los límites de `form` → { out } con los textos NORMALIZADOS o { error, code, field }.
- `parseOrder` (l. 71) — Valida y normaliza el pedido del navegador (cliente, líneas pedibles de items, idioma, PDF) → { order } o { error, code?, field? }. `minFillMs` = tiempo mínimo de relleno (0 = no se exige; quien llama pasa minFillMs(env)).
- `parseContact` (l. 100) — Valida y normaliza el formulario de contacto (honeypot, tiempo de relleno, nombre, correo, mensaje, privacidad) → { contact } o { error, code?, field? }.

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
- `run` (l. 270) — Envía el contacto de ejemplo a un entorno nuevo (con o sin RESEND_API_KEY) y un Resend simulado con ese estado → { status, j (JSON), env }.
- `up` (l. 284) — Sube una hoja (cuerpo `body`) al API con el catálogo de pruebas y devuelve la respuesta ya leída.
- `items` (l. 286) — Precios vigentes guardados en KV.
- `rows` (l. 321) — Hoja de 12 referencias R0…R11 con precio base + índice.

### `blog.test.js`

El blog del panel (entradas, imágenes, páginas públicas) vive en el servidor PHP del hosting (backend-php/api): el Worker de Cloudflare no lo incluye y lo dice con claridad, sin esconder la ruta.

### `helpers.js`

Utilidades de test: KV en memoria que imita las reglas de Cloudflare KV (clave ≤ 512 bytes, TTL ≥ 60 s, listado ordenado con páginas y fecha de caducidad), entorno de pruebas con secretos largos y fetch simulado. El TTL NO hace desaparecer las claves en get (los tests inyectan `now`): solo se anota para que list y la purga puedan verlo.

- `checkKey` (l. 5) — Comprueba la clave como lo haría KV: no vacía y de 512 bytes como máximo.
- `put` (l. 10) — Guarda un valor; anota la caducidad si trae expirationTtl (KV exige al menos 60 s).
- `list` (l. 17) — Claves con el prefijo, ordenadas, por páginas (cursor), con su dato de caducidad si lo tienen.
- `mkEnv` (l. 36) — Entorno de pruebas del Worker: KV en memoria, destinatarios, token maestro, secreto de sesión y origen; extra sobrescribe valores. FORM_MIN_FILL_MS = 0: las pruebas de formularios no mandan `_e` salvo las que prueban justo eso.
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
- `provider` (l. 40) — Proveedor de correo simulado (Resend o Brevo, según la URL a la que se llame): guarda cada petición { url, headers, body } en `calls`. `status` y `reply` fijan la respuesta (por defecto 200 con { id } de Resend o 201 con { messageId } de Brevo; un texto se envía tal cual); `throws` simula una caída de red.
- `fetchImpl` (l. 43) — fetch simulado: anota la petición y responde como el proveedor (o lanza, si se pidió una caída de red).
- `freshIp` (l. 53) — IP de prueba nueva en cada llamada (el límite de contacto es de 5 por visitante cada 10 minutos).
- `contactPost` (l. 55) — POST /api/contact anónimo con un mensaje válido de ejemplo (over sustituye campos; el resto va a deps: now, rand, retryMs…) → { r (Response), j (JSON), ip }.
- `withLog` (l. 60) — Ejecuta fn con console.error capturado → las líneas que se escribieron en el registro del servidor (una cadena por llamada).
- `messagesIn` (l. 67) — Registros (ya leídos) de los mensajes de contacto guardados en el KV del entorno, de la clave más reciente a la más antigua.

### `mail-admin.test.js`

[PRUEBAS-CORREO-PANEL] Pruebas de M2 (endpoints de gestión: GET/DELETE /api/messages, POST /api/mail/test, GET /api/mail/status y el bloque `mail` de /api/health) y de su seguridad (M4): solo gestores, nada de secretos en ninguna respuesta y los datos del visitante tratados como dato. Sin red: KV en memoria y proveedores simulados con provider() (ver kit.js).

Secciones: `[PRUEBAS-CORREO-PANEL]`

- `setup` (l. 10) — Entorno con Resend configurado y un gestor y un cliente con sesión → { env, mgr (token), cli (token) }.
- `seed` (l. 16) — Guarda `n` mensajes de contacto de ejemplo (uno por minuto desde `t0`) → ids, del más antiguo al más reciente.

### `mail-contact.test.js`

[PRUEBAS-CONTACTO] Pruebas de M1 (POST /api/contact guarda SIEMPRE y `emailed` dice la verdad), M3 (controladores Resend y Brevo con fetch simulado, remitente, EMAIL_PROVIDER) y M4 (secretos y datos del visitante). Sin red: KV en memoria y proveedores simulados con provider() (ver kit.js). Mismos nombres que en el PHP en lo posible (M1 · …).

Secciones: `[PRUEBAS-CONTACTO]`

- `ttlOf` (l. 13) — Segundos de caducidad que le quedan a una clave del KV de pruebas (la fecha de caducidad se anota al guardar).
- `stored` (l. 15) — Registro del mensaje con ese id, tal como está guardado en KV.
- `conTurnstile` (l. 111) — fetch que responde al desafío de Turnstile con éxito o fracaso y deja pasar lo demás al proveedor simulado.
- `health` (l. 225) — Lo que responde GET /api/health con esas variables de entorno.

### `price-sheet.test.js`

Pruebas de la lectura tolerante de hojas de precios (shared/price-sheet.mjs) con los casos compartidos (shared/price-sheet.fixtures.json).

### `proposals.test.js`

Pruebas de las propuestas EDITABLES del panel (src/proposals.js y POST/GET /api/proposals/state): el manager aprueba con SU texto, rechaza con una nota o deshace; todo es texto plano con límites, solo lo hacen los managers y aprobar no publica nada por sí solo. Mismos casos que backend-php/api/tests/ProposalsTest.php.

- `setup` (l. 10) — Entorno con un manager y un cliente con sesión → { env, tj, ta, post(body, token), get(token) }.
- `post` (l. 14) — POST /api/proposals/state con ese cuerpo y token (sin token = sin sesión) → { status, body }.
- `get` (l. 16) — GET /api/proposals/state con ese token → { status, body }.

### `security-auth.test.js`

Pruebas de los arreglos de seguridad del ACCESO: D3 (límites de login, de Bearer, claves acotadas, secretos mínimos, contraseñas nuevas, comparación de secretos, purga), D4 (sesiones ligadas al usuario, revocables y de 24 h), D6 (errores sin texto interno, tope real del cuerpo, CORS en excepciones, anidamiento) y D9 (datos de gestión solo para managers). Cada prueba reproduce el ataque del informe y comprueba que ya no funciona y que lo legítimo sigue funcionando.

- `nextIp` (l. 18) — IP de prueba distinta cada vez (para no tropezar con los límites por visitante cuando se hacen muchos intentos).
- `forge` (l. 22) — Token firmado a mano con HMAC-SHA256 (para forjar tokens con cualquier contenido y la clave que se quiera).
- `payloadOf` (l. 27) — Contenido (payload) de un token de sesión ya emitido.
- `withLog` (l. 29) — Ejecuta fn con console.error capturado → lo que se escribió en el registro (una cadena por llamada).
- `lockShape` (l. 34) — Cuerpo y cabecera de una respuesta de bloqueo: [error, claves, Retry-After === retry_after, retry_after entre 3590 y 3600].
- `visto` (l. 100) — Origen (source) de la lista de precios que ve quien llama con ese token desde esa IP: completo para un manager, solo «upload» para el público.
- `con` (l. 256) — Cuerpo de pedido con un nivel de anidamiento de n corchetes en un campo extra.
- `rnd` (l. 289) — Número pseudoaleatorio en [0, 1) con semilla fija (la prueba es reproducible).
- `pick` (l. 291) — Elemento al azar de una lista.
- `gen` (l. 294) — Valor JSON raro al azar: átomos, listas y objetos con las claves que usa el API.

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

### `blog-markdown.mjs`

[BLOG-MD] Conversor de texto (Markdown reducido) a HTML para las entradas del blog que se escriben en el panel. LA MISMA lógica vive en PHP (backend-php/api/lib/BlogMarkdown.php): shared/blog-markdown.fixtures.json es el contrato que cumplen las dos (scripts/test-blog-markdown.mjs y backend-php/api/tests/BlogMarkdownTest.php lo recorren). Si cambia una regla aquí, cambia en los dos y en las pruebas.

Secciones: `[BLOG-MD]`

- `escapeHtml` (l. 14) — Escapa & < > " para texto y atributos.
- `clean` (l. 17) — Quita los caracteres de control (salvo tabulador y salto de línea), los separadores de línea Unicode, los invisibles y las marcas de dirección de texto, y unifica los saltos de línea: lo que el conversor nunca debe ver.
- `safeUrl` (l. 23) — Dirección permitida en un enlace, o null. Admite https://, http://, mailto:, tel:, /ruta (no //), #ancla.
- `safeImageUrl` (l. 35) — Dirección permitida en una imagen, o null: https:// o una ruta del propio sitio (/media/blog/…).
- `imgHtml` (l. 41) — <img> de una imagen en Markdown (o null si la dirección no vale). `o.imgAttrs(src)` puede devolver width/height ya escapados (el servidor los conoce).
- `emphasis` (l. 51) — Negrita y cursiva (** __ * _ y *** para las dos) con anidación SIEMPRE bien formada: un emparejamiento con pila; lo que no cierra se queda como texto. Trabaja sobre texto ya escapado.
- `flush` (l. 57) — Pasa el texto acumulado a la lista de trozos.
- `inline` (l. 96) — Texto en línea (negrita, cursiva, código, enlaces, imágenes) → HTML ya escapado.
- `put` (l. 99) — Guarda un trozo de HTML ya seguro y devuelve su marca de posición.
- `isBlank` (l. 125) — ¿La línea está vacía o solo tiene espacios?
- `splitRow` (l. 134) — Celdas de una fila de tabla (\| escapa la barra).
- `startsTable` (l. 141) — ¿Esta línea y la siguiente abren una tabla? (una fila con barras y debajo la fila de guiones con las mismas columnas)
- `startsBlock` (l. 143) — ¿Esta línea empieza un bloque distinto de un párrafo?
- `render` (l. 146) — Markdown reducido → HTML. Opciones: tableLabel (nombre accesible de las tablas, «Tabla»), imgAttrs(src) (width/height de las imágenes que el servidor conoce).
- `plainOfHtml` (l. 203) — Texto plano de un trozo de HTML del conversor (sin etiquetas, sin entidades y con los espacios normalizados).
- `cutAtWord` (l. 212) — Texto de hasta `n` caracteres cortado en una palabra entera (con «…» si se recorta).
- `toPlain` (l. 219) — Texto plano de un Markdown (sin marcas ni etiquetas, espacios normalizados): extracto, longitud y llms.txt.
- `excerpt` (l. 224) — Extracto de hasta `n` caracteres cortado en una palabra entera (con «…» si se recorta).
- `lead` (l. 229) — Descripción automática: el primer párrafo del texto (sin títulos, listas ni tablas) cortado en una palabra entera; si no hay párrafos, el extracto de todo. Es lo que se usa cuando no se escribe resumen ni descripción para buscadores.
- `slugify` (l. 237) — Título → dirección: minúsculas, sin acentos, letras y cifras separadas por guiones, hasta 80 caracteres (cortado en un guion).

### `plain-text.mjs`

[PLAIN-TEXT] Los formularios públicos (contacto, pedido) aceptan SOLO TEXTO PLANO y con límites: nada de etiquetas HTML, scripts, enlaces en exceso ni líneas de código (inyección de HTML/JS, SQL, plantillas, órdenes de consola, rutas…). Es una defensa EN PROFUNDIDAD: la salida ya se escapa siempre (correo, panel, páginas) y no hay SQL; esto rechaza de entrada lo que no es un mensaje de una persona y le dice por qué a quien escribe de buena fe.

Secciones: `[PLAIN-TEXT]`

- `normalizeText` (l. 55) — Texto limpio: sin controles ni caracteres invisibles, saltos de línea \n, tabuladores y espacios repetidos como un espacio y, si el campo es de una línea, sin saltos.
- `length` (l. 63) — Número de caracteres (puntos de código, no unidades UTF-16 ni bytes).
- `checkText` (l. 66) — Revisa un texto de formulario: { ok:true, text } con el texto ya limpio, o { ok:false, code } (`not_text` si ni siquiera es una cadena). Un campo vacío es válido: si es obligatorio lo decide quien llama.

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

### `page.php`

[PAGE] Punto de entrada de las páginas que pinta el servidor (api/page.php): las entradas del blog escritas en el panel, el listado del blog con ellas, sus imágenes y el sitemap.xml, llms.txt y llms-full.txt con ellas añadidas. El .htaccess de la web reescribe hasta aquí SOLO esas direcciones (/blog/…, /media/blog/…, /sitemap.xml, /llms.txt, /llms-full.txt); lo que se sirve se decide por la dirección original (REQUEST_URI), no por parámetros, así que llamar a este archivo directamente no sirve nada. Ver lib/BlogPage.php.

Secciones: `[PAGE]`

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

### `Audit.php`

[AUDIT] Registro de actividad del panel: quién entró, cuándo y desde dónde, y quién cambió qué (usuarios, precios, propuestas, blog, correo, copias). Un fichero por día (UTC) en <datos>/audit/AAAA-MM-DD.jsonl, una línea JSON por hecho: { t: ISO, a: acción, u: quién (correo, «master» o «sistema»), r: rol, ip, ua: «Chrome · Windows», d: detalle corto }

Secciones: `[AUDIT]` · `[DESDE EL ROUTER]` · `[LECTURA]`

- `dir` (l. 44) — Carpeta del registro dentro de la carpeta de datos.
- `file` (l. 47) — Fichero de un día (AAAA-MM-DD en UTC).
- `label` (l. 50) — Nombre legible de una acción (si no se conoce, la propia clave).
- `agent` (l. 53) — «Chrome · Windows» a partir de la cabecera User-Agent (solo familia del navegador y del sistema: el texto entero es largo y no aporta).
- `log` (l. 67) — Anota un hecho. `$who` es el que lo hace (['sub','role'] como devuelve Auth::authenticate), o null si no hay sesión (un intento de acceso: entonces `$detail` suele llevar el correo).
- `worthLoggingFail` (l. 100) — ¿Conviene anotar este fallo de contraseña? Una vez por visitante y cuenta cada 10 minutos (un ataque no llena el registro).
- `describe` (l. 107) — Código del hecho y detalle (sin secretos) de una petición de un manager que salió bien, o null si no hay que anotarla.
- `fromRequest` (l. 140) — Anota la acción de un manager (o cliente) que acaba de hacer `$req` con la respuesta `$res`, si es de las que se registran. Nunca lanza.
- `days` (l. 151) — Días (AAAA-MM-DD, el más reciente primero) de los últimos `$days`.
- `read` (l. 163) — Hechos de los últimos `$days` días, el más reciente primero, como mucho `$limit`. Filtros: `u` (parte del correo), `cat` (categoría = lo que va antes del punto de la acción: login, user, prices…) y
- `summary` (l. 190) — Resumen para el Diagnóstico: hechos de los últimos 7 días y de cuántos días hay fichero (sin leer más que contar líneas). @return array{events:int,days:int}
- `purge` (l. 204) — Borra los ficheros de más de KEEP_DAYS días; devuelve cuántos. Nunca lanza.

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
- `set` (l. 237) — Cambia campos de seguridad de un usuario (`null` quita el campo) bajo el bloqueo de usuarios; devuelve el registro nuevo o null si no existe.
- `adminList` (l. 256) — Lista para los managers: lo público de cada usuario más su estado de seguridad → two_step (lo guardado: true, false o null = lo normal), code ('required' pide código por correo al entrar ·
- `setPassword` (l. 277) — Pone una contraseña nueva a una cuenta (la propia, tras comprobar la actual, o la de otra persona por un manager): mismas reglas que al crear un usuario. Cierra TODAS sus sesiones y hace que sus
- `revokeSessions` (l. 295) — Invalida TODOS los tokens emitidos hasta ahora para ese usuario (sess_after = ahora). Devuelve false si el usuario no existe.
- `login` (l. 311) — Comprueba credenciales (mismo coste si el usuario no existe: no se puede enumerar usuarios por tiempo). Si valen, devuelve el usuario público y su sid para firmar la sesión;
- `check` (l. 322) — comprueba credenciales y devuelve el usuario público (sin sid), o null
- `upgrade` (l. 329) — Pone al día el registro tras un acceso correcto: sid si no lo tenía y hash nuevo si el coste de PASSWORD_DEFAULT subió. Devuelve el registro, o null si lo borraron entre medias.

### `Backup.php`

[BACKUP] Copias de seguridad de los datos de la web (pedidos, mensajes, usuarios, precios, propuestas, entradas del blog e imágenes subidas) que se pueden descargar desde el panel. Una copia es UN archivo `backup-AAAAMMDD-HHMMSS-<32 hex al azar>.jsonl.gz` en <datos>/backups/ (junto a una ficha .json con su resumen): gzip de líneas JSON, una por dato: { torivac_backup: 1, created, by, auto }                         cabecera

Secciones: `[BACKUP]` · `[AJUSTES Y RUTAS]` · `[LISTA]` · `[CREAR]` · `[API]` · `[RESTAURAR]`

- `enabled` (l. 39) — ¿Están activas las copias automáticas semanales? (config backup.auto; sí por defecto).
- `includeMedia` (l. 46) — ¿Entran las imágenes del blog en la copia? (config backup.media; sí por defecto).
- `dir` (l. 53) — Carpeta de las copias dentro de la carpeta de datos.
- `path` (l. 56) — Ruta de un archivo de copia por su nombre, o null si el nombre no es el de una copia (nada de rutas ni nombres raros).
- `isDownloadPath` (l. 59) — ¿Es la ruta de descarga de una copia (/backups/<archivo>)?
- `list` (l. 63) — Las copias que hay, la más reciente primero: file, size, at (ISO), by, auto, keys, media. Solo cuenta las que tienen su archivo.
- `prune` (l. 79) — Borra las copias más antiguas y deja las KEEP más recientes. Devuelve cuántas borró.
- `skipped` (l. 91) — ¿Es una clave que no entra en la copia?
- `create` (l. 102) — Hace una copia ahora. `$by` es quién la pide (correo o «sistema»). Si ya se está haciendo otra, no empieza (409). Se escribe en un archivo temporal y solo al terminar se pone con su nombre:
- `maybeWeekly` (l. 160) — Hace la copia semanal si hace falta: han pasado EVERY segundos desde la última (o no hay ninguna) y no se intentó hace menos de una hora (para no repetir un fallo sin parar). Nunca lanza.
- `scheduleWeekly` (l. 180) — Programa la copia semanal para cuando se haya enviado la respuesta (sin hacer esperar a quien entra al panel): con PHP-FPM la respuesta ya salió; con otros PHP, tarda unos segundos más.
- `link` (l. 191) — Token de un enlace de descarga: caducidad.correo.firma (HMAC con session_secret, ligado al archivo y a quien lo pidió).
- `verifyLink` (l. 200) — Comprueba un token de descarga para ese archivo → el correo de quien pidió el enlace, o null si es falso, de otro archivo o caducó.
- `err` (l. 210) — Un 4xx/5xx con su mensaje.
- `handle` (l. 216) — GET /backups (lista y estado) · POST /backups (crear ahora; 6 por hora y manager) · POST /backups/<archivo>/link (enlace de descarga de 2 minutos) · DELETE /backups/<archivo>.
- `download` (l. 246) — GET /backups/<archivo>?t=<token>: envía el archivo de la copia si el enlace es válido (lo firmó un manager hace menos de 2 minutos). 30 intentos por hora y visitante; no se distingue «no existe» de «enlace malo».
- `restore` (l. 266) — Restaura una copia en la carpeta de datos actual (lo usa tools/restore.php). Comprueba que el archivo está completo (tiene su cierre y los recuentos coinciden) ANTES de escribir nada.

### `Blog.php`

[BLOG] Entradas de blog que se escriben en el panel (solo managers) y viven en la carpeta de datos, no en los archivos de la web: una actualización de la web (borrar y volver a subir) no las toca. Se publican en /blog/<slug>/ (y /en/blog/…, /fr/blog/…, /de/blog/…) a través de api/page.php (BlogPage.php); las 21 entradas por idioma de la web original siguen siendo páginas estáticas. Claves del almacén (Store):

Secciones: `[BLOG]` · `[PIEZAS]` · `[LECTURA]` · `[ESCRITURA]` · `[VISTA PREVIA]`

- `slugify` (l. 43) — Título → dirección: minúsculas, sin acentos, letras y cifras separadas por guiones, hasta 80 caracteres (cortado en un guion). Igual que slugify de shared/blog-markdown.mjs.
- `path` (l. 56) — Ruta pública de una entrada: /blog/<slug>/ en español y /<idioma>/blog/<slug>/ en los demás.
- `kPost` (l. 59) — Clave del almacén de una entrada.
- `kSlug` (l. 61) — Clave de una dirección (slug) de un idioma.
- `kIx` (l. 63) — Clave del resumen de un idioma.
- `kMedia` (l. 65) — Clave de los datos de una imagen.
- `withLock` (l. 71) — Ejecuta `$fn` con el bloqueo del blog (o directamente, si ya se tiene).
- `err` (l. 81) — Error de validación: ['error' => mensaje para quien edita, 'code' => …, 'field' => campo].
- `len` (l. 84) — Número de caracteres (códigos de punto).
- `oneLine` (l. 87) — Texto de una línea de un campo: limpio de controles y recortado de espacios; ['ok' => texto] o ['error' => …].
- `parseDate` (l. 97) — ISO 8601 con zona → «AAAA-MM-DDTHH:MM:SSZ» en UTC; null si no es una fecha válida entre 2000 y 5 años en el futuro.
- `ts` (l. 107) — Segundos desde 1970 de una fecha guardada («…Z»); 0 si no hay.
- `isLive` (l. 110) — ¿Se ve en la web? Publicada y con fecha ya llegada (una publicada con fecha futura está programada).
- `get` (l. 117) — La entrada completa o null.
- `index` (l. 125) — Resumen de un idioma: { id → entrada resumida }. Si no existe pero hay entradas guardadas, se reconstruye (por si se borró a mano o se copió la carpeta de datos).
- `listing` (l. 135) — Todas las entradas resumidas (de todos los idiomas), la más reciente primero (las sin fecha, al final). Para el panel.
- `liveEntries` (l. 144) — Las entradas visibles de un idioma, la más reciente primero.
- `resolve` (l. 152) — Dirección → ['id' => …, 'alias' => bool] o null (también si la entrada ya no existe).
- `translationsOf` (l. 160) — Las traducciones de una entrada (mismas `grp`, otro idioma): { idioma → entrada resumida }. Con `$liveOnly` solo las visibles.
- `entry` (l. 172) — Resumen de una entrada para el listado y la web.
- `reindex` (l. 181) — Vuelve a escribir los resúmenes de todos los idiomas a partir de las entradas guardadas (arregla cualquier desajuste). Devuelve cuántas entradas hay.
- `fields` (l. 199) — Valida y normaliza los campos recibidos. `$cur` = la entrada actual (al actualizar); solo se miran los campos presentes. Devuelve ['set' => campos normalizados] o ['error' …].
- `publishable` (l. 249) — Comprobaciones para publicar: lo imprescindible (título, dirección, texto y, si hay imagen, su texto alternativo).
- `members` (l. 258) — Miembros (id → idioma) del grupo de traducciones `$grp`, mirando los resúmenes y los cambios pendientes de esta operación (`$pending`: id → entrada ya con su grupo nuevo).
- `linkTranslations` (l. 272) — Aplica los enlaces de traducción pedidos (idioma → id | '' para desenlazar) a la entrada `$p` (ya con su `grp`). Enlazar junta los dos grupos (cada uno puede traer más traducciones) siempre que no
- `persist` (l. 302) — Guarda la entrada, las direcciones y los resúmenes (dentro del bloqueo). `$others` = otras entradas cambiadas (traducciones).
- `create` (l. 321) — Crea una entrada. Campos: lang (obligatorio) · title (obligatorio) · slug (si falta sale del título) · excerpt · seo_title · seo_description · markdown · image {file, alt} · status (draft por defecto) · date · translations {idioma: id}.
- `update` (l. 354) — Actualiza una entrada (solo los campos que llegan). El idioma no se puede cambiar. Si cambia la dirección de una que ya se publicó, la antigua redirige (301) a la nueva.
- `delete` (l. 388) — Borra una entrada y sus direcciones (la web deja de servirla); las traducciones enlazadas siguen existiendo. true si existía.
- `mediaDir` (l. 405) — Carpeta donde están los bytes de las imágenes (dentro de la carpeta de datos, nunca servida directamente).
- `mediaMeta` (l. 408) — Datos de una imagen subida (o null).
- `images` (l. 416) — Todas las imágenes subidas, la más reciente primero.
- `saveImage` (l. 429) — Guarda una imagen subida: solo JPEG, PNG o WebP de verdad (se mira el contenido, no el nombre ni lo que diga el navegador), hasta 2,5 MB y 6000 px por lado. El archivo se llama
- `imageUsedBy` (l. 462) — ¿Alguna entrada usa esta imagen (como destacada o dentro del texto)? Devuelve los títulos.
- `deleteImage` (l. 474) — Borra una imagen si ninguna entrada la usa. @return array{ok?:bool,error?:string,code?:string,status?:int,used_by?:array}
- `previewToken` (l. 486) — Código de la vista previa de una entrada, válido `$ttl` segundos: «<caducidad>.<firma>»; null si el servidor no tiene session_secret válido.
- `verifyPreview` (l. 495) — ¿Es válido y vigente ese código para esa entrada?

### `BlogApi.php`

[BLOG-API] Rutas del blog para el panel (solo managers; Router::route las despacha aquí). Cuerpo y respuestas en JSON; los errores de validación llevan { error, code, field } y el código HTTP que toca (400 datos no válidos · 404 no existe · 409 dirección repetida, traducción ya enlazada, imagen en uso o límite · 429 demasiadas peticiones). GET    /api/blog/posts                  listado de todas las entradas (resumidas) de todos los idiomas, con la hora del servidor para saber cuáles están programadas

Secciones: `[BLOG-API]`

- `handle` (l. 26) — Despacha una ruta /blog/… (el que llama ya comprobó que es un manager).
- `limits` (l. 46) — Límites que el panel enseña junto a cada campo.
- `result` (l. 53) — Un resultado de Blog::* → respuesta: los errores llevan su código HTTP; lo demás sale con ok.
- `view` (l. 64) — La entrada tal como la ve el panel: completa, con sus traducciones, su ruta y si ya se ve en la web.
- `one` (l. 72) — GET /blog/posts/:id
- `save` (l. 79) — POST /blog/posts (crear) y POST /blog/posts/:id (actualizar).
- `preview` (l. 90) — POST /blog/posts/:id/preview
- `upload` (l. 100) — POST /blog/images { name, data }

### `BlogMarkdown.php`

[BLOG-MD] Conversor de texto (Markdown reducido) a HTML para las entradas del blog que se escriben en el panel: el MISMO que shared/blog-markdown.mjs (el panel lo usa para la vista previa y este lo usa para la página que se publica). shared/blog-markdown.fixtures.json es el contrato que cumplen los dos, y scripts/test-blog-markdown-php.mjs compara las salidas de los dos con decenas de miles de textos al azar. Si cambia una regla en uno, cambia en el otro.

Secciones: `[BLOG-MD]` · `[PIEZAS]` · `[BLOQUES]` · `[TEXTO PLANO]`

- `rx` (l. 28) — Expresión PCRE por nombre: el código fuente está aquí abajo, escrito tal cual (nowdoc) con {WS} por el \s de JavaScript.
- `escapeHtml` (l. 126) — Escapa & < > " para texto y atributos.
- `jstrim` (l. 129) — Recorta los espacios como String.trim de JavaScript.
- `isSpace` (l. 139) — ¿Es un solo carácter de espacio (el \s de JavaScript)?
- `isDigit` (l. 142) — ¿Empieza por una cifra ASCII?
- `isWord` (l. 145) — ¿Es una letra o cifra de las que cuentan para el subrayado (_)? (A-Z a-z 0-9 y U+00C0–U+024F)
- `clean` (l. 148) — Texto sin caracteres de control (salvo tabulador y salto de línea), separadores de línea Unicode, invisibles ni marcas de dirección, y con los saltos de línea unificados.
- `safeUrl` (l. 157) — Dirección permitida en un enlace, o null. Admite https://, http://, mailto:, tel:, /ruta (no //), #ancla.
- `safeImageUrl` (l. 166) — Dirección permitida en una imagen, o null: https:// o una ruta del propio sitio (/media/blog/…).
- `imgHtml` (l. 173) — <img> de una imagen en Markdown (o null si la dirección no vale). `$o['imgAttrs']($src)` puede devolver width/height ya escapados (el servidor los conoce).
- `emphasis` (l. 183) — Negrita y cursiva (** __ * _ y *** para las dos) con anidación SIEMPRE bien formada: un emparejamiento con pila; lo que no cierra se queda como texto. Trabaja sobre texto ya escapado.
- `rcb` (l. 233) — preg_replace_callback que, si PCRE falla (límite de retroceso o de pila), deja el texto como estaba: el paso siguiente lo escapa igualmente.
- `inline` (l. 242) — Texto en línea (negrita, cursiva, código, enlaces, imágenes) → HTML ya escapado.
- `isBlank` (l. 275) — ¿La línea está vacía o solo tiene espacios?
- `splitRow` (l. 278) — Celdas de una fila de tabla (\| escapa la barra).
- `startsTable` (l. 289) — ¿Esta línea y la siguiente abren una tabla? (una fila con barras y debajo la fila de guiones con las mismas columnas)
- `startsBlock` (l. 296) — ¿Esta línea empieza un bloque distinto de un párrafo?
- `render` (l. 303) — Markdown reducido → HTML. Opciones: tableLabel (nombre accesible de las tablas, «Tabla»), imgAttrs(src) (width/height de las imágenes que el servidor conoce).
- `plainOfHtml` (l. 372) — Texto plano de un trozo de HTML del conversor (sin etiquetas, sin entidades y con los espacios normalizados).
- `cutAtWord` (l. 382) — Texto de hasta `$n` caracteres (códigos de punto) cortado en una palabra entera (con «…» si se recorta).
- `toPlain` (l. 392) — Texto plano de un Markdown (sin marcas ni etiquetas, espacios normalizados): extracto, longitud y llms.txt.
- `excerpt` (l. 395) — Extracto de hasta `$n` caracteres cortado en una palabra entera (con «…» si se recorta).
- `lead` (l. 398) — Descripción automática: el primer párrafo del texto (sin títulos, listas ni tablas) cortado en una palabra entera; si no hay párrafos, el extracto de todo.

### `BlogPage.php`

[BLOG-PAGE] Páginas públicas del blog que pinta el servidor (api/page.php): las entradas escritas en el panel (/blog/<slug>/ y /en|fr|de/blog/<slug>/), el listado del blog con las entradas nuevas mezcladas con las de la web original, las imágenes subidas (/media/blog/<archivo>) y el mapa del sitio (sitemap.xml, llms.txt, llms-full.txt) con las entradas nuevas añadidas. El resto de la web es estático. Cómo se pinta: la compilación deja en api/generated/blog-shell.<idioma>.json la página COMPLETA (cabecera, menú, pie, estilos y scripts del sitio) con marcas @@TV:…@@ en lo variable

Secciones: `[BLOG-PAGE]` · `[PIEZAS]` · `[RUTAS]` · `[LISTADO]` · `[ENTRADA]` · `[MAPA DEL SITIO]` · `[SALIDA]`

- `root` (l. 33) — Carpeta de la web.
- `shellDir` (l. 36) — Carpeta de las plantillas generadas.
- `reset` (l. 39) — Olvida las plantillas leídas (las pruebas cambian de carpeta).
- `esc` (l. 43) — Escapa & < > " (igual que la compilación).
- `clip` (l. 46) — Texto recortado a `$max` caracteres sin partir palabras y con «…» si se cortó (igual que clip() de site/lib/seo.mjs).
- `json` (l. 57) — JSON para incrustar en una página: sin < ni > literales, sin separadores de línea Unicode.
- `shell` (l. 65) — Plantilla de un idioma (o null si falta o está dañada).
- `bp` (l. 78) — Ruta base del sitio dentro del dominio («» o «/prueba»), sacada de la dirección base de la plantilla.
- `fmtDate` (l. 81) — Fecha larga en el idioma de la plantilla y en la zona horaria del sitio (igual que las fechas de las entradas estáticas).
- `localNaive` (l. 88) — Fecha y hora local naive «AAAA-MM-DDTHH:MM:SS» (la de las tarjetas estáticas) de un instante UTC: sirve para ordenar las tarjetas nuevas entre las viejas.
- `withBase` (l. 94) — Antepone la ruta base del sitio a los enlaces e imágenes que empiezan por «/» (solo si el sitio vive en una subcarpeta).
- `imgAttrs` (l. 100) — width/height de una imagen de /media/blog/ que el servidor conoce (evita saltos de maquetación).
- `cache` (l. 111) — Cabeceras de caché: `$seconds` > 0 = pública durante ese tiempo; 0 = nada de caché. Se manda también Expires: sin él, el mod_expires del .htaccess de la web (que da «max-age=0» al HTML) añade su propia
- `out` (l. 118) — Respuesta HTML/texto con estas cabeceras.
- `plain` (l. 121) — Respuesta de error corta (sin plantilla: no depende de nada que pueda estar roto).
- `moved` (l. 127) — Redirección 301 a una ruta del mismo sitio, conservando los parámetros de la dirección.
- `cacheable` (l. 133) — Añade ETag y devuelve 304 si el navegador ya tiene esta versión.
- `route` (l. 147) — Qué pide la dirección (solo la cola de la ruta cuenta, así vale también en una subcarpeta): ['kind' => post|index|media|file, …] o null.
- `handle` (l. 162) — Atiende una petición. `$reqHeaders` lleva los nombres en minúsculas. Solo GET y HEAD. Nunca lanza para una petición normal; api/page.php recoge cualquier excepción inesperada.
- `placeholder` (l. 178) — Imagen de la tarjeta de una entrada sin imagen destacada: el logotipo de la web (así el listado no tiene huecos vacíos).
- `card` (l. 185) — Tarjeta de una entrada nueva, rellenando la plantilla de tarjeta.
- `index` (l. 197) — /blog/ (y /en|fr|de/blog/): el listado de la web con las entradas nuevas mezcladas por fecha.
- `staticFallback` (l. 211) — Sin plantilla (una compilación sin --php-api o un paquete a medias): se sirve el listado estático que haya, para no dejar el blog roto.
- `languageLinks` (l. 220) — Marcas y enlaces de idioma de una entrada: canonical + hreflang, y los cuatro enlaces del selector de idioma.
- `structuredData` (l. 245) — JSON-LD de la entrada (mismos tipos y campos que las entradas estáticas: ver pageGraph y postNode de site/lib/seo.mjs).
- `post` (l. 271) — La página de una entrada, o 404/301.
- `notFound` (l. 321) — 404 con la página «no encontrado» del idioma (la que ya tiene la web), o un texto corto si no está.
- `media` (l. 330) — /media/blog/<archivo>: el contenido de la imagen subida, con caché de un año (el nombre lleva la huella del contenido, así que nunca cambia).
- `xml` (l. 345) — Escapa para XML.
- `siteFile` (l. 348) — sitemap.xml, llms.txt o llms-full.txt: el archivo de la compilación con las entradas nuevas añadidas.
- `send` (l. 399) — Envía la respuesta al navegador (para api/page.php). Una respuesta con `file` envía el archivo tal cual.

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
- `all` (l. 24) — toda la configuración cargada (para tachar los secretos de los textos de error; nunca se devuelve por la API)
- `get` (l. 27) — valor por ruta con puntos: 'prices.sheet_id'

### `Diag.php`

[DIAG] Autodiagnóstico del servidor para quien despliega en un hosting con Apache y PHP (cPanel, Plesk…): versión de PHP, extensiones, carpeta de datos, configuración, correo, origen de precios, primer manager y última sincronización; y, si se mira por web, qué servidor es y qué IP ve del visitante. Se ve de dos formas: php api/tools/check.php [--net]      por línea de comandos (--net prueba además la salida a Internet)

Secciones: `[DIAG]`

- `c` (l. 16) — Una comprobación.
- `insideWebRoot` (l. 22) — Dice si un directorio está dentro de la web (cualquiera podría pedir sus ficheros si el .htaccess no se respetara): bajo la carpeta que contiene api/ (la web)
- `bytes` (l. 36) — Valor de php.ini con sufijo (8M, 512K, 1G) → bytes; 0 o -1 = sin límite → null.
- `run` (l. 48) — Ejecuta todas las comprobaciones.
- `build` (l. 141) — Qué versión del paquete está instalada (api/generated/build.json, que escribe scripts/package_cpanel.py: versión = commit, fecha, dirección base, pruebas o producción, aspecto) y, si se mira por
- `security` (l. 164) — Las medidas de acceso y de recuperación: verificación por correo (¿se pide y a quién?), adónde van los avisos de ataques repetidos, registro de actividad, copias de seguridad y CAPTCHA.
- `blog` (l. 203) — Estado del blog del panel: ¿están las plantillas de las cuatro lenguas (api/generated/blog-shell.<idioma>.json)? y cuántas entradas e imágenes hay. Sin plantillas la web no falla (las entradas de siempre
- `mail` (l. 225) — Comprobaciones del correo según el controlador activo: si está listo (clave o servidor), los avisos propios de cada uno (mail() no garantiza la entrega, SMTP sin verificar el certificado…)
- `web` (l. 260) — Comprobaciones que solo tienen sentido al mirar por web: qué servidor atiende (¿se aplica el .htaccess?), qué IP ve del visitante detrás de un proxy y si la

### `Http.php`

[HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google (sigue hasta 5 redirecciones de los GET, p. ej. la descarga de Drive). En las pruebas se sustituye por una función (Http::$mock) para no salir a Internet. Defensas (la URL sale de la configuración, pero un salto de la cadena de redirecciones no es de fiar):

Secciones: `[HTTP]`

- `hostIps` (l. 25) — Direcciones IP de un servidor: la propia si ya es una IP; si no, las que resuelve el DNS (IPv4 e IPv6). Vacío si no resuelve.
- `isPrivateIp` (l. 47) — ¿Es una IP privada, de loopback, de enlace local o reservada? Las que nunca debe alcanzar una redirección desde un servidor público. Usa filter_var con
- `isPrivateHost` (l. 62) — ¿Alguna de las direcciones de ese servidor es privada o local?
- `redirectProblem` (l. 72) — Motivo por el que se rechaza una redirección a `$next` (null = vale): solo http y https; y si la URL de partida era un servidor público (`$initialPublic`), el destino
- `request` (l. 88) — @param string[] $headers líneas «Nombre: valor»

### `Mail.php`

[MAIL] Envío de correo con seis controladores (config mail.driver) y el MOTIVO veraz de cada intento: resend → API HTTP de Resend (hay que verificar el dominio de order_from con SPF/DKIM) brevo  → API HTTP de Brevo (el remitente o su dominio debe estar verificado/autenticado en Brevo)

Secciones: `[MAIL]` · `[CONTROLADORES]` · `[SECRETOS]` · `[CONTACTO Y PRUEBA]`

- `driverUnknown` (l. 55) — ¿mail.driver tiene un valor que no es ninguno de los conocidos? (vacío o ausente = none, que no es un error).
- `driver` (l. 62) — Controlador activo según mail.driver: resend, brevo, smtp, mail, file o none; ausente o un valor desconocido = none (falla cerrado).
- `sender` (l. 74) — Remitente de order_from («Nombre <correo@dominio>» o solo el correo; si falta, Torivac Web <pedidos@torivac.com>) → ['ok'=>true, 'name', 'email', 'from' (normalizado, para las APIs),
- `smtpConfig` (l. 88) — Ajustes del servidor SMTP (mail.smtp): host, port, secure, user, pass, helo, timeout, insecure_tls, tls_name.
- `blocker` (l. 95) — Por qué NO se puede enviar ahora → ['reason' => 'off'|'skipped', 'error' => …], o null si el controlador está listo (credenciales y remitente válidos).
- `enabled` (l. 111) — ¿Hay un controlador de correo listo para enviar? (no es none y tiene sus credenciales y un remitente válido)
- `problems` (l. 114) — Ajustes que impiden o estorban el envío (solo NOMBRES, nunca valores): mail.driver desconocido, la clave o el servidor del controlador activo, order_from y order_to.
- `status` (l. 135) — Estado del correo para el panel, /health y el diagnóstico → ['driver', 'configured', 'problems' (nombres de ajustes), 'last' (último intento o null)]; nunca lleva valores secretos.
- `last` (l. 143) — Último intento de envío guardado en mail:last → ['at', 'kind', 'ok', 'reason', 'error'?] o null si no hay ninguno o está dañado.
- `record` (l. 153) — Anota el resultado de un envío en mail:last (sobrescribe; un fallo al anotar nunca tapa el resultado real del envío). `$kind`: order · contact · test.
- `secrets` (l. 164) — Valores secretos de la configuración (de claves cuyo nombre contiene key, secret, token, pass, account, auth o user), de 6 o más caracteres.
- `scrub` (l. 187) — Texto de UNA línea, sin secretos y de como mucho `$max` caracteres: tacha los valores exactos de los secretos de la configuración y las formas típicas de clave
- `send` (l. 209) — Envía un correo por el controlador activo → ['ok', 'id'?, 'reason', 'error'?, 'driver', 'skipped'?, 'status'?, 'note'?] y anota el intento en mail:last (`$kind`: 'order' · 'contact' · 'test').
- `deliver` (l. 221) — Prepara y envía por `$driver`, sin anotar nada. Sin controlador, credenciales, remitente o destinatarios válidos no llama a ningún proveedor.
- `viaResend` (l. 242) — Resend: POST /emails con la clave en Authorization.
- `viaBrevo` (l. 253) — Brevo: POST /v3/smtp/email con la clave en api-key (sender, to, cc, replyTo, subject, htmlContent, textContent y attachment[{name, content}]).
- `callProvider` (l. 264) — POST JSON a la API de un proveedor y traduce la respuesta → ['ok'=>true,'reason'=>'sent','id'?] o ['ok'=>false,'reason'=>'failed','status'?,'error']. Cualquier 2xx cuenta como aceptado.
- `providerError` (l. 276) — Texto corto y sin secretos del fallo de un proveedor: «Brevo 401: mensaje» (mensaje ≤ 120 caracteres) o, si no dio mensaje, «Brevo respondió 401».
- `viaSmtp` (l. 288) — SMTP: compone el mensaje completo y lo entrega con Smtp (destinatarios = to + cc). Un destinatario rechazado por el servidor no impide el envío a los demás, pero se avisa.
- `viaMail` (l. 299) — mail() de PHP: true = lo aceptó el servicio de correo LOCAL del hosting (no que llegue); false = lo rechazó. Pasa el remitente al sobre con -f cuando es seguro.
- `viaFile` (l. 309) — file: guarda el correo como JSON en la carpeta outbox de los datos (pruebas y entornos sin correo: no sale por correo).
- `encodeHeader` (l. 320) — Codifica un texto con caracteres no ASCII como palabras MIME UTF-8 en base64 (varias, de como mucho ~45 bytes, sin partir un carácter) unidas por un salto de línea plegado.
- `message` (l. 333) — Mensaje completo para SMTP: Date, Message-ID, To, Subject y las cabeceras MIME de mime(), una línea en blanco y el cuerpo.
- `mime` (l. 342) — cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail() y SMTP
- `contactMail` (l. 373) — Aviso de un mensaje de contacto PARA EL EQUIPO → ['subject', 'html', 'text']. Asunto «Contacto web · <nombre>» en una línea; nombre, correo, idioma, id del mensaje y texto del visitante
- `testMail` (l. 386) — Correo de PRUEBA del panel → ['subject', 'html', 'text']: asunto «Torivac · prueba de correo», texto fijo y, como datos, el controlador y la hora (ISO).
- `money` (l. 393) — importe con el formato del idioma del cliente (es 1.234,56 €, en €1,234.56, fr 1 234,56 €, de 1.234,56 €)
- `orderMail` (l. 408) — Correo del pedido PARA EL EQUIPO. `$d['pdf']` (bool) dice si lleva el PDF del cliente: entonces añade la línea fija de que lo generó el navegador y el importe que vale es el del servidor.
- `copyMail` (l. 437) — Copia del presupuesto PARA EL CLIENTE: asunto fijo «Torivac · copia de tu presupuesto <número>», sin adjunto, y un cuerpo hecho SOLO con texto fijo en el idioma del pedido

### `Messages.php`

[MESSAGES] Mensajes del formulario de contacto: se guardan SIEMPRE (antes de intentar el correo) para que nadie pierda un mensaje ni se quede sin saber si salió el aviso. Clave del almacén: msg:<id> con id CT-AAAAMMDD-NNNN-XXX (CT = contacto; NNNN = contador diario; XXX = 3 caracteres aleatorios base36 en mayúsculas, por si dos mensajes coinciden). Retención de 400 días como los pedidos (Store caduca el registro; el cron lo borra). Son DATOS PERSONALES: solo los ve un gestor (GET /api/messages) y la IP completa solo se guarda aquí.

Secciones: `[MESSAGES]`

- `nextId` (l. 24) — Id nuevo CT-AAAAMMDD-NNNN-XXX: contador diario con bloqueo (dos mensajes no repiten número) + sufijo aleatorio. Lanza si el almacén no deja escribir.
- `validId` (l. 39) — ¿Tiene esa forma un id de mensaje?
- `create` (l. 46) — Crea y GUARDA el registro de un mensaje ya validado y limpio (name, email, message, lang) con la IP del visitante. Hasta saber el resultado del correo, el registro no afirma nada falso
- `setEmailed` (l. 55) — Anota en el registro el resultado del correo: ['sent' => bool, 'reason' => …, 'error'? => …]. Lanza si no se puede guardar.
- `view` (l. 62) — Vista de un registro para el gestor, o null si falta algo esencial (id y fecha en texto) o no es un registro.
- `limit` (l. 73) — `limit` pedido en la URL → entero entre 1 y 300; ausente o ilegible = 100.
- `recent` (l. 83) — Los mensajes más recientes primero (hasta `$limit`, 1..300) → ['items' => […], 'truncated' => bool]. Solo se leen los ficheros necesarios (los nombres se ordenan sin abrirlos);
- `delete` (l. 100) — Borra el mensaje con ese id → true si existía; false si no existe o el id no tiene la forma CT-AAAAMMDD-NNNN-XXX (nunca alcanza otras claves del almacén).

### `Orders.php`

[ORDERS] POST /api/order y POST /api/contact: valida lo que llega del navegador (no es fiable), valora el pedido en servidor con los precios VIGENTES (ignora cualquier precio que mande el cliente), numera TV-AAAAMMDD-NNNN, guarda y envía por correo al equipo (con el PDF) y, si procede, una copia al cliente. Defensas: honeypot, límite por visitante (Request::ipKey) y límite global de pedidos por hora, Turnstile opcional, referencias solo del catálogo (o añadidas por la hoja de

Secciones: `[ORDERS]` · `[COPIA-AL-CLIENTE]` · `[PDF]` · `[TEXTO-PLANO]` · `[CONTACTO]`

- `validEmail` (l. 34) — ¿Es un correo válido? Cadena de ≤ 254 caracteres que cumple EMAIL y además pasa filter_var(FILTER_VALIDATE_EMAIL).
- `str` (l. 40) — Texto de un campo del cuerpo: '' si falta o es null; null si NO es una cadena (número, lista, objeto…), y entonces la petición se rechaza.
- `normalizePdf` (l. 50) — Valida el PDF que manda el navegador y lo devuelve normalizado (base64 canónico, sin saltos), o null si no vale: cadena base64 estricta (tras quitar saltos de línea), que
- `plainError` (l. 64) — Error de validación de un campo de texto → ['error' => castellano, 'code' => plain_text|too_long|too_many_links, 'field' => campo]; `code` y `field` son para que el navegador lo muestre traducido.
- `minFillMs` (l. 71) — Milisegundos mínimos entre cargar la página y enviar (config form_min_fill_ms; 1200 si falta o no es un número; 0 = no se exige `_e`).
- `fillTimeError` (l. 78) — ¿Trae el cuerpo el campo `_e` (ms que tardó la persona) con un entero ≥ el mínimo? Si no, es un bot que no cargó la página: error con code too_fast. Con el mínimo en 0 no se exige.
- `badRequest` (l. 88) — Respuesta 400 de una validación fallida: el error en castellano y, si los hay, `code` y `field`.
- `parseOrder` (l. 94) — @return array{order?:array,error?:string,code?:string,field?:string}
- `parseContact` (l. 144) — @return array{contact?:array,error?:string,code?:string,field?:string}
- `verifyTurnstile` (l. 170) — Turnstile opcional: sin secreto se omite; con secreto, falla cerrado
- `team` (l. 183) — destinatarios del equipo: config order_to (array o texto separado por comas)
- `copyMode` (l. 191) — Modo de la copia al cliente: 'capped' (con topes) o 'off'. Solo el texto «capped» (sin importar mayúsculas ni espacios alrededor) activa la copia; si no está puesto, es capped; CUALQUIER otro valor (también uno que no sea un texto) es off.
- `copyModeValid` (l. 198) — ¿Tiene order_copy un valor reconocido (capped u off, sin importar mayúsculas ni espacios) o no está puesto? Si no, se trata como off y el diagnóstico y /health avisan.
- `copyDailyMax` (l. 205) — Tope de copias al cliente en total por cada 24 h (config order_copy_daily_max; 150 si falta o no es un número; 0 = ninguna).
- `ordersPerHourMax` (l. 212) — Tope global de pedidos por hora (config orders_per_hour_max; 120 si falta o no es un número): protege la cuota del correo y el buzón del equipo.
- `nextNumber` (l. 219) — Siguiente número de pedido TV-AAAAMMDD-NNNN (contador diario con bloqueo para que dos pedidos no repitan número).
- `sendCopy` (l. 235) — Decide y envía la copia al cliente. Devuelve el motivo para emailed.customer_reason: 'not_requested' (el visitante mandó copy:false), 'off' (order_copy no es capped),
- `handleOrder` (l. 250) — POST /order: valida, valora con los precios del servidor, guarda el pedido y envía el correo al equipo (con el PDF del cliente) y, si procede, la copia al cliente.
- `handleContact` (l. 285) — POST /contact: límite por visitante y anti-spam como siempre (5 / 10 min por ipKey, honeypot, `_e`, Turnstile); luego construye el registro, LO GUARDA (400 días), intenta el correo al equipo,

### `PlainText.php`

[PLAIN-TEXT] Los formularios públicos (contacto, pedido) aceptan SOLO TEXTO PLANO y con límites: sin etiquetas HTML, scripts, enlaces en exceso ni líneas de código (HTML/JS, SQL, plantillas, órdenes de consola, rutas…). Defensa en profundidad: la salida ya se escapa siempre y no hay SQL; esto rechaza de entrada lo que no es un mensaje de una persona. Es la misma lógica que shared/plain-text.mjs (navegador y Worker); las expresiones y límites vienen de PlainTextRules.php (generado desde ese módulo) y

Secciones: `[PLAIN-TEXT]`

- `normalize` (l. 20) — Texto limpio: sin controles ni caracteres invisibles, saltos de línea \n, tabuladores y espacios repetidos como un espacio y, si el campo es de una línea, sin saltos.
- `length` (l. 32) — Número de caracteres (letras, no bytes: «é» y un emoji cuentan 1).
- `max` (l. 38) — Límite de caracteres del campo `$field` del formulario `$form` (PlainTextRules::FIELDS).
- `check` (l. 49) — Revisa un texto de formulario. null = campo ausente (válido y vacío). Si no es una cadena → not_text; si no es UTF-8 válido o salta una regla → plain_text (también si el motor

### `PlainTextRules.php`

[PLAIN-TEXT-RULES] GENERADO por scripts/gen_plain_text_php.mjs desde shared/plain-text.mjs (no editar a mano: se regenera con `node scripts/gen_plain_text_php.mjs`). Las mismas expresiones, límites y rangos de caracteres invisibles que usan el navegador y el Worker; PlainText.php las aplica.

Secciones: `[PLAIN-TEXT-RULES]`

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

### `Proposals.php`

[PROPOSALS] Decisiones del manager sobre las propuestas de mejora del panel (clave proposals:state: id de la propuesta → entrada). Una entrada es { state: ok|no, by, at } y, si el manager ha editado la propuesta, también: mode  → qué hace su texto: replace (sustituye el párrafo de la web que contiene `find`) · translate (descripción del producto en otro idioma) · title (título de la portada, una línea

Secciones: `[PROPOSALS]`

- `entry` (l. 27) — Valida el cuerpo de POST /api/proposals/state para el estado `ok` o `no` y devuelve la entrada que se guarda, con los textos ya normalizados (sin controles ni invisibles). Los campos

### `Request.php`

[REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP del visitante) + respuesta JSON + CORS + límite de uso. Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake). [CLIENT-IP] La IP del visitante sale de REMOTE_ADDR; solo si quien conecta es un proxy de confianza (una red privada, la propia dirección del servidor, Cloudflare

Secciones: `[REQUEST]` · `[CLIENT-IP]` · `[IP-KEY]` · `[CORS]` · `[RATE-LIMIT]`

- `fromGlobals` (l. 37) — construye la petición real a partir de $_SERVER; la ruta es lo que sigue a «/api»
- `readBody` (l. 61) — Lee el cuerpo de la petición (por defecto php://input) con un tope REAL: como mucho MAX_BODY + 1 bytes pasan a memoria, diga lo que diga Content-Length o aunque no lo diga
- `proxyList` (l. 70) — Proxies de confianza además de las redes privadas y Cloudflare: los de config `trusted_proxies` (lista o texto separado por comas) y la propia dirección
- `normalizeIp` (l. 80) — Una IP escrita de cualquier forma (con corchetes, con puerto, IPv4 dentro de IPv6…) en su forma normal; null si no es una IP.
- `inNet` (l. 92) — True si la IP está dentro de la red `a.b.c.d/n` o `x::/n` (una IP suelta cuenta como red de una sola dirección).
- `isCloudflareHop` (l. 110) — True si `$ip` es una dirección de Cloudflare que no está también entre las redes privadas ni entre los proxies propios de `trusted_proxies` (esas se tratan como el proxy de casa que son).
- `isTrustedProxy` (l. 118) — True si `$ip` es un proxy de confianza: red privada o local, Cloudflare o una de las redes extra de `trusted_proxies`.
- `clientIp` (l. 132) — IP del visitante. Una conexión directa NO se puede falsear con cabeceras (se usa REMOTE_ADDR tal cual). Solo si quien conecta es un proxy de confianza
- `ipKey` (l. 156) — Clave de límite por visitante: una IPv4 tal cual; una IPv6, su /64 en forma canónica «xxxx:xxxx:xxxx:xxxx::/64» (hextetos de 4 dígitos en minúsculas); una IPv4 escrita
- `fake` (l. 170) — petición simulada para pruebas
- `cookie` (l. 183) — Valor de una cookie de la petición (cabecera Cookie); cadena vacía si no existe. Los valores que usa el API son hexadecimales y puntos: nada se decodifica ni se interpreta.
- `header` (l. 193) — Valor de una cabecera de la petición (nombre sin distinguir mayúsculas); cadena vacía si no existe.
- `json` (l. 196) — cuerpo JSON como array (null si no es válido, está anidado a más de 32 niveles o supera el límite de bytes)
- `bearer` (l. 204) — Token de la cabecera «Authorization: Bearer …», o null.
- `__construct` (l. 220) — Respuesta con cuerpo JSON, código HTTP y cabeceras (por defecto JSON UTF-8 y sin caché).
- `send` (l. 228) — Envía código, cabeceras y cuerpo JSON (sin cuerpo en 204 y 304). Si el cuerpo no se puede codificar responde un 500 genérico con un id (el detalle va al registro).
- `allowed` (l. 252) — Dice si un origen puede usar el API: el propio sitio, las peticiones sin Origin o los de allowed_origins.
- `headers` (l. 267) — Cabeceras CORS para un origen permitido.
- `key` (l. 288) — Clave del almacén de un contador: rl:<cubo>:<sha256 del identificador, 32 caracteres>.
- `hit` (l. 291) — @return array{allowed:bool,remaining:int,resetAt:int}
- `exceeded` (l. 307) — ¿Ha llegado el contador de fallos de ese cubo e identificador a `$max` en la ventana actual? No suma nada.
- `fail` (l. 314) — Anota un fallo (la ventana cuenta desde el primero) y devuelve cuántos lleva en ella.
- `failLock` (l. 335) — Anota un fallo de un contador con BLOQUEO: los fallos se cuentan en una ventana de `$windowMs` desde el primero y, al llegar al `$max`-ésimo, el contador queda bloqueado `$lockMs`
- `lockedFor` (l. 353) — Milisegundos que le quedan de bloqueo a un contador con bloqueo (failLock); 0 si no está bloqueado. No suma nada.
- `clear` (l. 361) — Pone a cero el contador de fallos (tras un acceso correcto).
- `purgeExpired` (l. 368) — Borra ahora hasta PURGE_MAX registros de límite caducados; devuelve cuántos.
- `maybePurge` (l. 374) — Con probabilidad 1/purgeOneIn limpia registros caducados; un fallo al limpiar nunca rompe la petición.

### `Router.php`

[ROUTER] Rutas del API (equivalentes a workers/api/src/index.js: la web usa el mismo contrato con el Worker o con este PHP). PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login · POST /api/auth/verify · POST /api/auth/resend (código por correo) · GET /api/backups/<archivo>?t=… (descarga firmada) USUARIO   GET /api/auth/me · POST /api/auth/logout (cierra TODAS las sesiones de esa persona) · POST /api/auth/password (cambiar la propia) · POST /api/auth/devices/forget · GET /api/orders (manager: los 300 últimos; cliente: los suyos, hasta 100)

Secciones: `[ROUTER]` · `[LIMITES]` · `[ERRORES]`

- `handle` (l. 48) — Atiende una petición: comprueba el origen (CORS), despacha a la ruta y convierte las excepciones en respuestas JSON con su código.
- `mergeVary` (l. 70) — Une dos valores de la cabecera Vary sin repetir (Origin va primero): la respuesta depende del origen Y de la sesión, y una caché compartida debe saberlo.
- `failure` (l. 82) — Convierte una excepción en la respuesta que ve quien llama: una petición o hoja mal formada (InvalidArgumentException) = 400 con su mensaje; un RuntimeException con código HTTP
- `tooMany` (l. 93) — El 429 de siempre (inundación, Bearer, cron): mismo texto para todos, exista o no el usuario.
- `lockWait` (l. 96) — Texto del tiempo que queda de bloqueo: «una hora» si falta casi una hora entera; si no, «N minutos» (redondeado hacia arriba).
- `locked` (l. 104) — El 429 del bloqueo por fallos de contraseña: el mismo para los tres motivos y exista o no la cuenta; dice cuánto falta (retry_after y Retry-After, en segundos).
- `authenticate` (l. 115) — Autentica la petición. Devuelve [quién|null, respuesta 429|null]. Sin Bearer no hay nada que probar. Con Bearer, un visitante (ipKey) con 30 fallos en 10 min ni siquiera llega a
- `health` (l. 126) — GET /health: vivo, estado del correo (controlador, si está configurado y último intento SIN el texto del error) y, si algún ajuste está mal (secreto de sesión, token maestro o de cron, modo de la copia al cliente, mail.driver, order_from), lo dice con su NOMBRE (nunca el valor).
- `prices` (l. 148) — GET /prices: el público ve la lista sin quién la cargó ni de dónde; un manager lo ve todo (y el estado de la última sincronización). Con la IP bloqueada por tokens fallidos se sirve la vista pública.
- `login` (l. 173) — POST /auth/login: contraseña con coste igual exista o no el usuario, token ligado al sid del usuario y protección contra la fuerza bruta (ver la cabecera): 5 fallos de un visitante contra una cuenta,
- `enter` (l. 216) — Abre la sesión: anota el acceso (y el último acceso de la persona), programa la copia de seguridad semanal si es manager y devuelve el token con el usuario.
- `verifyCode` (l. 229) — POST /auth/verify { challenge, code, remember? }: comprueba el código que llegó por correo y, si vale, abre la sesión. Con `remember: true` deja una cookie de dispositivo (HttpOnly, firmada) para no volver a
- `resendCode` (l. 252) — POST /auth/resend { challenge }: manda un código nuevo por correo (el anterior deja de valer); como mucho 2 reenvíos y con espera entre ellos.
- `changePassword` (l. 263) — POST /auth/password { current, password }: cambia la contraseña PROPIA (pide la actual: 5 fallos por hora y cuenta → 429). Cierra todas las sesiones (también esta: hay que entrar de nuevo) y olvida los dispositivos
- `cronByUrl` (l. 284) — GET /cron?token=…: sincroniza los precios si el token es el de cron_token (≥ 24 caracteres); 10 fallos / 10 min por visitante → 429; sin cron_token válido la URL está desactivada (401).
- `forClient` (l. 299) — Un pedido tal como lo ve un cliente: sin la IP desde la que se hizo ni el motivo técnico del fallo del correo (eso es solo para managers).
- `orders` (l. 307) — GET /orders: un manager recibe los 300 pedidos más recientes; un cliente, los suyos (los que llevan su correo) hasta 100, mirando solo los 3000 más recientes. `truncated:true` si se cortó.
- `messages` (l. 329) — GET /messages?limit=N: los mensajes de contacto más recientes primero (1..300, 100 por defecto) con la IP y el estado del correo; un registro dañado se omite.
- `mailTest` (l. 339) — POST /mail/test { to? }: envía «Torivac · prueba de correo» a `to` (un correo válido) o, si no se da, a los destinatarios de order_to. Responde 200 { ok, driver, to, sent, reason, error? } aunque el
- `userAction` (l. 359) — POST /users/:correo/unlock { clear_reinforced? } quita el bloqueo de esa cuenta (y, si se pide, su protección reforzada) · /two-step { enabled } pide o no el código por correo a esa cuenta (false = cuenta de confianza)
- `route` (l. 380) — Tabla de rutas: públicas, de usuario autenticado y de manager (ver la lista de la cabecera).
- `cron` (l. 479) — sincroniza los precios (cron diario), hace la copia de seguridad semanal si toca y limpia lo caducado, también si la hoja se rechaza (esa limpieza no depende de la hoja)

### `Security.php`

[SECURITY] Medidas de acceso que van más allá de la contraseña y del bloqueo de una hora: · VERIFICACIÓN EN DOS PASOS POR CORREO. Un manager que escribe bien su contraseña recibe un código de 6 cifras en su correo (vale 10 minutos y 5 intentos) y lo escribe para entrar. Si marca «recordar este dispositivo», una cookie firmada (HttpOnly, 30 días) evita volver a pedirlo en ese navegador. Quedan fuera las cuentas de confianza (casilla «sin código» en

Secciones: `[SECURITY]` · `[AJUSTES]` · `[DISPOSITIVOS DE CONFIANZA]`

- `flag` (l. 49) — Un ajuste booleano de config.php o de una variable de entorno (que llega como texto: «false», «off», «0», «no» = no).
- `twoStepEnabled` (l. 57) — ¿Está activa la verificación por correo para los managers? (config two_step.enabled; sí por defecto).
- `attackProtection` (l. 60) — ¿Se refuerza una cuenta tras ataques repetidos? (config two_step.on_attack; sí por defecto).
- `rememberDays` (l. 63) — Días que se recuerda un dispositivo tras dar el código (config two_step.remember_days; 30 por defecto, de 1 a 90; 0 = no se ofrece recordar).
- `exemptList` (l. 70) — Correos que nunca piden código (config two_step.exempt: lista o texto separado por comas), en minúsculas.
- `alertRecipients` (l. 78) — Quién recibe el aviso de ataques repetidos: config alert_to (lista o texto separado por comas, solo correos válidos) o, si está vacío, los destinatarios de los pedidos (order_to).
- `isExempt` (l. 88) — ¿Es una cuenta de confianza? Con la casilla «sin código» (two_step = false) o en la lista two_step.exempt.
- `codeStatus` (l. 94) — Estado para mostrar de un usuario: 'required' (pide código al entrar), 'exempt' (cuenta de confianza), 'off' (la verificación está desactivada en el servidor) o 'n/a' (clientes: solo la piden tras ataques).
- `underAttack` (l. 102) — ¿Está esa cuenta en protección reforzada (ataques repetidos recientes)?
- `codeReason` (l. 108) — Por qué hay que pedir código a esta persona al entrar, o null si no: 'two_step' (manager con verificación activa) o 'attack' (protección reforzada tras ataques repetidos).
- `deviceCookieName` (l. 117) — Nombre de la cookie del dispositivo de una cuenta: una por cuenta (un ordenador compartido entre dos managers no mezcla sus dispositivos).
- `deviceSig` (l. 120) — Firma de un dispositivo: ligada al identificador de sesión del usuario (si se borra y se vuelve a crear, no vale), a su época de dispositivos (olvidarlos los invalida) y a la caducidad.
- `issueDevice` (l. 126) — Cookie de un dispositivo recién verificado → ['name', 'value', 'max_age'], o null si no hay secreto seguro o no se ofrece recordar.
- `deviceTrusted` (l. 137) — ¿Trae la petición una cookie de dispositivo válida (firma buena, sin caducar y de ESTA cuenta)?
- `cookieHeader` (l. 147) — Valor de la cabecera Set-Cookie de un dispositivo: HttpOnly (el JavaScript de la página no la ve), SameSite=Strict, solo para el API y con Secure si la petición llegó por HTTPS.
- `forgetDevices` (l. 153) — Hace que todos los dispositivos recordados de esa cuenta dejen de valer (sube su época). Devuelve false si la cuenta no existe.
- `hint` (l. 161) — «m****@torivac.com»: el correo con casi todo oculto, para decir adónde se mandó el código sin enseñarlo entero.
- `sendCode` (l. 169) — Envía el código por correo al usuario → resultado de Mail::send. El código no va en el asunto (se vería en notificaciones).
- `startChallenge` (l. 186) — Crea un código para esa persona, lo guarda (solo su hash HMAC) y se lo manda por correo. `$why`: 'two_step' o 'attack'.
- `resend` (l. 210) — Reenvía un código nuevo (el anterior deja de valer): como mucho PIN_SENDS envíos por intento de acceso, con PIN_RESEND_WAIT_MS entre ellos.
- `verify` (l. 240) — Comprueba un código. Bien → ['email', 'why'] y el código queda gastado. Mal → 'error' con 'left' (intentos que quedan) y, con PIN_TRIES fallos, el código se anula. Además de los 5 intentos por
- `idxKey` (l. 282) — Clave del índice de visitantes que han fallado contra una cuenta.
- `noteAttempt` (l. 285) — Anota que ese visitante (clave de IP) ha fallado contra esa cuenta: así se puede ver si está bloqueada y desbloquearla sin conocer las IP de antemano. El índice caduca a las 2 horas y guarda 40 como mucho.
- `lockLeft` (l. 301) — Milisegundos que le quedan de bloqueo a una cuenta por cualquiera de los motivos (contraseña o código, por visitante o por cuenta); 0 si no está bloqueada.
- `unlock` (l. 314) — Quita el bloqueo de una cuenta y pone a cero sus contadores (por cuenta y por cada visitante que había fallado contra ella; también el bloqueo del propio visitante, para que quien
- `lockoutHappened` (l. 332) — Un bloqueo acaba de empezar contra una cuenta (`$weight` 1 = el de un visitante; ATTACK_LOCKS = el de la cuenta entera o 20 códigos erróneos: un ataque repartido). Si la cuenta suma ATTACK_LOCKS
- `deferred` (l. 352) — Ejecuta `$job` cuando ya se ha enviado la respuesta (con PHP-FPM, quien hizo la petición no espera al correo); con `$defer` en false, al instante. Nunca lanza.
- `alertMail` (l. 360) — Correo de aviso al equipo por intentos repetidos contra una cuenta (sin ninguna contraseña ni código). Si no sale, queda anotado en la actividad (no en mail:last, que es público).

### `Smtp.php`

[SMTP] Cliente SMTP mínimo y seguro (sin librerías) para enviar el correo por el buzón del propio hosting (Plesk, cPanel…) o por cualquier servidor SMTP. Habla con stream_socket_client: saludo 220 → EHLO → STARTTLS (secure = tls) → AUTH PLAIN o LOGIN → MAIL FROM → RCPT TO (uno por destinatario) → DATA → QUIT. · Cifrado: secure = 'ssl' (TLS implícito, puerto 465), 'tls' (STARTTLS, puerto 587; si el servidor no lo ofrece NO se envía) o 'none' (sin cifrar, puerto 25). El certificado del servidor se

Secciones: `[SMTP]`

- `send` (l. 33) — Envía un mensaje ya compuesto (cabeceras + cuerpo MIME) por SMTP.
- `problem` (l. 103) — Primer problema de los datos de entrada (null = todo bien): servidor, puerto, cifrado, usuario, contraseña, remitente y destinatarios.
- `heloName` (l. 118) — Nombre con el que nos presentamos en EHLO: mail.smtp.helo, o el del servidor web, o el de la máquina; solo letras, cifras, puntos y guiones.
- `caps` (l. 128) — Capacidades que anuncia el servidor en su respuesta a EHLO: nombre en mayúsculas → resto de la línea.
- `auth` (l. 140) — Autentica con PLAIN (si lo anuncia) o LOGIN. Error: «SMTP 535 …» si el servidor rechaza las credenciales; nunca incluye el usuario ni la contraseña.
- `cmd` (l. 159) — Envía una orden (sin CR/LF dentro) y devuelve la respuesta [código, texto]. `$secret` = la orden lleva credenciales: nunca entra en ningún mensaje de error.
- `write` (l. 167) — Escribe todo el texto, por trozos, sin pasarse del plazo.
- `reply` (l. 181) — Lee una respuesta completa (varias líneas «250-…» y la última «250 …») → [código, texto de las líneas unidas por salto]. Con tope de líneas, de bytes y de tiempo.
- `fail` (l. 203) — Excepción «SMTP <código> <texto>» para una respuesta que no es la esperada.
- `short` (l. 209) — «550 5.1.1 texto…» recortado a 100 caracteres y en una línea.
- `oneLine` (l. 212) — Texto de UNA línea recortado a `$max` caracteres (sin saltos ni caracteres de control).
- `why` (l. 219) — Motivo legible de un fallo de conexión o de cifrado: el texto del sistema y, si lo hay, la causa de OpenSSL (certificado caducado, nombre que no coincide…).

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

### `backup.php`

[BACKUP-TOOL] Hace una copia de seguridad de los datos desde la línea de comandos (la misma que «Crear copia ahora» del panel) y dice dónde quedó: php api/tools/backup.php Úsala antes de actualizar la web o de tocar la carpeta de datos. El archivo queda en <carpeta de datos>/backups/ y se baja desde Panel → Ajustes → Copias de seguridad (o por SFTP).

Secciones: `[BACKUP-TOOL]`

### `check.php`

[CHECK] Comprobación de la instalación desde la línea de comandos (Terminal de cPanel, SSH o, en Plesk, una tarea programada de «Ejecutar un comando»): php api/tools/check.php           revisa PHP, extensiones, carpeta de datos, config.php, correo, precios y primer manager php api/tools/check.php --net     además prueba la salida a Internet (Resend, Google, Anthropic)

Secciones: `[CHECK]`

### `create-user.php`

[CREATE-USER] Crea un usuario desde la línea de comandos (el primer manager, o clientes): php api/tools/create-user.php correo@dominio.com "Nombre Apellido" manager "contraseña de al menos 12 caracteres" Roles: manager (todo) · client (solo sus pedidos). La contraseña se guarda con password_hash. Se rechaza una contraseña de menos de 12 caracteres, que contenga la parte local del

Secciones: `[CREATE-USER]`

### `restore.php`

[RESTORE] Restaura una copia de seguridad (archivo .jsonl.gz que hizo el panel o tools/backup.php) en la carpeta de datos de esta instalación: php api/tools/restore.php ARCHIVO.jsonl.gz --dry-run     cuenta lo que trae y comprueba que está completa, sin escribir nada php api/tools/restore.php ARCHIVO.jsonl.gz               restaura (solo si la carpeta de datos está vacía)

Secciones: `[RESTORE]`

### `unlock.php`

[UNLOCK-TOOL] Quita el bloqueo de una cuenta desde la línea de comandos: la salida si ningún manager puede entrar al panel para pulsar «Desbloquear» (por ejemplo, si alguien ha agotado el bloqueo de la cuenta de quien administra la web): php api/tools/unlock.php correo@dominio.com          quita los bloqueos y pone a cero los contadores de esa cuenta (contraseñas, códigos y visitantes que fallaron contra ella)

Secciones: `[UNLOCK-TOOL]`

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
- `test_privacy_session_revocation_and_contact_escaping` (l. 376) — GET /prices: el público no ve quién cargó la hoja ni el id de Drive; un manager sí; un usuario borrado pierde la sesión; el contacto solo admite texto plano y su correo escapa el HTML.
- `test_http_client_follows_redirects_without_leaking_credentials` (l. 411) — Cliente HTTP real contra un servidor local: sigue redirecciones de los GET a mano, no manda la credencial a otro servidor y corta los bucles.
- `test_email_status_is_never_overstated` (l. 444) — El correo es parte del resultado: el pedido y el mensaje de contacto se guardan siempre y dicen si el aviso salió (y por qué no).
- `test_diag_warns_about_orders_without_email` (l. 472) — El autodiagnóstico avisa si los últimos pedidos se guardaron sin que saliera su aviso por correo.

### `BlogMarkdownTest.php`

Pruebas de BlogMarkdown con los casos compartidos con la versión JavaScript (shared/blog-markdown.fixtures.json) y comprobaciones de seguridad propias.

- `bm_fixtures` (l. 10) — Casos compartidos con JavaScript (en el paquete del hosting no van las pruebas; junto a ellas hay una copia para trabajar solo con backend-php/).
- `test_blog_markdown_fixtures_copy_is_identical` (l. 18) — La copia de los casos junto a las pruebas es idéntica a la compartida (si el repositorio completo está presente).
- `test_blog_markdown_render_matches_contract` (l. 26) — El HTML de cada caso es EXACTAMENTE el que da JavaScript.
- `test_blog_markdown_plain_and_excerpt_match_contract` (l. 32) — Texto plano y extracto, igual que en JavaScript.
- `test_blog_markdown_safe_url_matches_contract` (l. 41) — Direcciones permitidas y prohibidas, igual que en JavaScript.
- `bm_audit` (l. 47) — Auditoría del HTML: solo etiquetas y atributos permitidos, texto sin < ni > sueltos y todo cerrado. Devuelve la lista de problemas.
- `test_blog_markdown_known_attacks_never_produce_forbidden_html` (l. 84) — Los ataques conocidos (scripts, javascript:, data:, atributos que se cuelan, // , etc.) salen como texto o no salen: nunca como HTML fuera de la lista.
- `test_blog_markdown_random_input_stays_inside_allowed_html` (l. 99) — Texto cualquiera (también con bytes que no son UTF-8) nunca rompe el conversor ni deja HTML fuera de la lista.
- `test_blog_markdown_huge_hostile_inputs_are_fast` (l. 115) — Entradas hostiles enormes se resuelven rápido (sin retroceso exponencial ni cuadrático) y sin salirse de lo permitido.
- `test_blog_markdown_url_limit_counts_code_points` (l. 135) — Los límites cuentan letras (códigos de punto), no bytes: una dirección de 2000 emojis cabe y una de 2001 no.
- `test_blog_markdown_longest_link_still_converts` (l. 144) — El tamaño de la dirección máxima (2000) sigue siendo un enlace en la página (PCRE no se rinde por la pila).
- `test_blog_markdown_invalid_utf8_is_cleaned` (l. 153) — Bytes que no son UTF-8 se limpian (nunca llegan al HTML ni rompen el análisis).

### `BlogPageTest.php`

Pruebas de las páginas públicas del blog (BlogPage.php): rutas, entrada (SEO, JSON-LD, hreflang, escapado), borradores y programadas, vista previa firmada, direcciones antiguas, listado mezclado, imágenes, sitemap.xml / llms.txt / llms-full.txt con las entradas nuevas y respuestas condicionales. Se prueba con una plantilla mínima hecha a mano (la real sale de la compilación y se prueba en qa-apache).

- `bp_shell` (l. 20) — Plantilla mínima de un idioma con todas las marcas que rellena el servidor.
- `bp_site` (l. 40) — Carpeta de la web de pruebas con las plantillas (y, si se pide, 404, sitemap y llms) → ruta.
- `bp_post` (l. 62) — Entrada publicada (por defecto en español, con fecha ya llegada).
- `bp_get` (l. 71) — GET a esa dirección → respuesta.
- `bp_ld` (l. 74) — Extrae el JSON-LD de una página → array.
- `test_blogpage_routes` (l. 81) — BP1 · Las direcciones se reconocen por su cola (valen también en una subcarpeta) y lo demás no es del blog.
- `test_blogpage_published_post_has_complete_seo` (l. 98) — BP2 · Una entrada publicada sale con todo el SEO: título, descripción, canonical, Open Graph, JSON-LD, una sola h1, fecha en la zona del sitio, texto convertido y sin marcas sin rellenar.
- `test_blogpage_dates_use_the_site_timezone` (l. 131) — BP3 · La fecha se enseña en la zona horaria del sitio (Madrid), no en UTC.
- `test_blogpage_image_in_header_social_and_structured_data` (l. 142) — BP4 · Con imagen: fondo de la cabecera, foto al principio del texto (con su texto alternativo y medidas), og:image con texto alternativo y ImageObject; sin imagen, el logotipo.
- `test_blogpage_diag_reports_blog_state` (l. 164) — BP4b · El autodiagnóstico cuenta las entradas y avisa si faltan las plantillas del blog.
- `test_blogpage_hostile_content_is_escaped` (l. 181) — BP5 · Todo lo que se escribe se escapa: título, descripción, texto y alt no pueden cerrar etiquetas, atributos ni el JSON-LD, y las marcas @@TV:…@@ escritas por una persona se quedan como texto.
- `test_blogpage_drafts_and_scheduled_are_invisible` (l. 208) — BP6 · Borradores y programadas no existen para el público (404 con la página «no encontrado» del idioma); borrar también.
- `test_blogpage_preview_with_signed_address` (l. 231) — BP7 · La vista previa firmada enseña un borrador sin indexar ni cachear; una firma mala, caducada o de otra entrada no vale.
- `test_blogpage_redirects` (l. 256) — BP8 · Direcciones: la antigua redirige (301) a la nueva con sus parámetros; sin barra final también; y la entrada solo vive en su idioma.
- `test_blogpage_hreflang_and_language_links` (l. 275) — BP9 · Traducciones: hreflang solo con las visibles (más x-default), enlaces del selector de idioma con la traducción o la portada, y marcas de «sin traducción».
- `test_blogpage_index_merges_new_posts_by_date` (l. 299) — BP10 · El listado mezcla las entradas nuevas con las de la web por fecha (la más reciente primero), solo las visibles y de su idioma, con imagen y texto escapado.
- `test_blogpage_index_fallbacks` (l. 325) — BP11 · Sin entradas nuevas el listado es el de la plantilla; sin plantilla se sirve el estático que dejó la compilación; sin nada, 503.
- `test_blogpage_media` (l. 343) — BP12 · Imágenes: se sirven con su tipo, caché de un año, 304 por ETag y cabeceras que impiden ejecutar nada; las que no existen o con nombre raro, 404.
- `test_blogpage_conditional_and_methods` (l. 361) — BP13 · Respuestas condicionales de las páginas: 304 con el mismo ETag; solo GET y HEAD.
- `test_blogpage_sitemap_gets_the_new_posts` (l. 379) — BP14 · sitemap.xml: las entradas visibles se añaden con hreflang (traducciones visibles + x-default), imágenes con texto alternativo y lastmod; borradores y programadas no; sin entradas, el archivo tal cual.
- `test_blogpage_llms_get_the_new_posts` (l. 404) — BP15 · llms.txt y llms-full.txt: las entradas nuevas se añaden bajo el título de su idioma (la más reciente arriba), con resumen o texto completo; si falta el título se crea la sección; lo escrito no puede romper el formato.

### `BlogTest.php`

Pruebas del blog del panel (Blog.php y las rutas /api/blog/… de BlogApi.php): entradas (borrador, publicada, programada), direcciones únicas por idioma con redirección de las antiguas, traducciones enlazadas, imágenes de verdad (JPEG, PNG, WebP), vista previa firmada, permisos y límites.

- `bl_post` (l. 20) — Entrada mínima válida (se puede sobrescribir cualquier campo).
- `bl_make` (l. 23) — Crea una entrada y devuelve la entrada (falla la prueba si da error).
- `bl_tokens` (l. 31) — Manager y cliente con sesión → [token del manager, token del cliente].
- `bl_api` (l. 39) — Llamada al API con token → Response.
- `test_blog_slugify_matches_javascript` (l. 42) — B1 · slugify da lo mismo que la versión de JavaScript (casos compartidos).
- `test_blog_create_draft_defaults` (l. 49) — B2 · Crear un borrador: id con su forma, campos por defecto, nada visible, y aparece en el listado de su idioma.
- `test_blog_create_validates_fields` (l. 68) — B3 · Validación de los campos: obligatorios, límites en caracteres (no bytes), tipos y limpieza de controles.
- `test_blog_publish_schedule_and_visibility` (l. 88) — B4 · Publicar exige título y texto; sin fecha se pone la de ahora; con fecha futura queda programada y no se ve hasta entonces.
- `test_blog_slug_unique_per_language` (l. 112) — B5 · La dirección es única POR IDIOMA: repetida en el mismo idioma da 409; en otro idioma vale; las inválidas se rechazan; vacía se deriva del título.
- `test_blog_slug_change_keeps_redirects_for_published_posts` (l. 139) — B6 · Cambiar la dirección de una entrada ya publicada deja la antigua como redirección; la de un borrador nunca publicado se libera; no se puede coger la dirección antigua de otra entrada.
- `test_blog_update_is_partial` (l. 161) — B7 · Actualizar cambia solo los campos enviados, no deja cambiar el idioma y responde 404 si no existe.
- `test_blog_translations_link_unlink_and_conflicts` (l. 180) — B8 · Traducciones: se enlazan por pares y en grupo, son simétricas, se desenlazan, no se repiten por idioma ni se enlazan con sí mismas, y borrar una no borra las demás.
- `test_blog_delete_frees_everything` (l. 217) — B9 · Borrar quita la entrada, su dirección (y las antiguas) y su resumen; la dirección vuelve a estar libre.
- `test_blog_index_rebuilds_without_deadlock` (l. 231) — B10 · El resumen se reconstruye solo (y a mano) si falta, sin quedarse esperando a sí mismo por el bloqueo.
- `test_blog_images_accept_real_images_only` (l. 250) — B11 · Imágenes: JPEG, PNG y WebP de verdad se aceptan, se nombran por su contenido y la misma imagen no se guarda dos veces; lo demás (GIF, SVG, PHP, texto con extensión de imagen, truncadas, enormes) se rechaza.
- `test_blog_post_image_needs_alt_and_cannot_be_deleted_while_used` (l. 280) — B12 · La imagen de una entrada necesita estar subida y llevar texto alternativo; no se puede borrar mientras se use (en la imagen destacada o en el texto).
- `test_blog_preview_token` (l. 304) — B13 · La vista previa lleva una firma que solo vale para esa entrada, caduca y no se puede falsear.
- `test_blog_api_roles_and_crud` (l. 323) — B14 · El API: sin sesión 401, cliente 403, manager y token maestro entran; crear (201), leer, actualizar, borrar y los errores con su código y campo.
- `test_blog_api_images_preview_and_reindex` (l. 357) — B15 · API de imágenes: subir en base64 (con o sin prefijo data:), listar, borrar; rechaza lo que no es una imagen y lo que no es base64; la vista previa y el reindex funcionan.
- `test_blog_api_rate_limits` (l. 385) — B16 · Límites por hora: guardados y subidas se cortan con 429 sin dejar entradas a medias.
- `test_blog_post_limit` (l. 397) — B17 · Tope de entradas: al llegar al máximo no se crean más (409) hasta borrar alguna.

### `HostingTest.php`

Pruebas de lo que cambia de un hosting a otro (cPanel, Plesk…): la carpeta de datos que se elige, la IP real del visitante detrás de un proxy (el nginx de Plesk, Cloudflare) y las comprobaciones del diagnóstico que dependen del servidor. Sin red ni servidor web: todo con rutas temporales y $_SERVER simulado.

- `hosting_tmpdir` (l. 16) — Carpeta temporal nueva y vacía para una prueba.
- `hosting_rmtree` (l. 24) — Borra una carpeta temporal con todo lo que lleva dentro.
- `hosting_status` (l. 32) — Estado de cada comprobación del diagnóstico por su id.
- `test_client_ip_behind_proxies` (l. 40) — IP del visitante: sin proxy no se puede falsear con cabeceras; detrás de un proxy de confianza (nginx de Plesk, Cloudflare) se lee X-Forwarded-For de derecha a izquierda.
- `test_ip_in_net` (l. 66) — Pertenencia a una red: límites, máscaras que no son múltiplo de 8, IPv6, familias distintas, IP suelta y /0.
- `test_proxy_list` (l. 76) — Proxies de confianza extra: los de config (lista o texto con comas) más la dirección del propio servidor.
- `test_request_from_globals_ip` (l. 87) — Petición real (a partir de $_SERVER): nginx de Plesk que llama a Apache por la IP pública de la máquina, y conexión directa con cabeceras falsas.
- `test_store_picks_a_usable_data_folder` (l. 104) — Carpeta de datos: la configurada, un almacén que ya tiene datos, la primera que se pueda crear, o error claro; un fichero en medio hace de «raíz de solo lectura» (Plesk).
- `test_diag_reports_data_folder_deviation` (l. 138) — El diagnóstico avisa cuando la carpeta de datos configurada no sirvió y se usó otra; por línea de comandos sabe si la carpeta cae dentro de la web.
- `test_diag_web_checks` (l. 159) — Comprobaciones de servidor del diagnóstico: nginx sin Apache ignora el .htaccess; la IP del visitante tras un proxy; HTTPS.
- `test_diag_build_stamp_and_domain` (l. 181) — El Diagnóstico enseña la versión instalada (build.json) y avisa si falta, si se compiló con cambios sin guardar o si el dominio no es el del paquete.

### `MailTest.php`

Pruebas del correo (Mail.php): controladores y su elección, remitente, ajustes que faltan, Resend y Brevo con HTTP simulado (Http::$mock), último intento (mail:last), secretos fuera de cualquier error y los correos de contacto y de prueba. El SMTP tiene sus pruebas en SmtpTest.php y los endpoints del panel en MessagesTest.php.

- `test_mail_driver_normalization` (l. 17) — mail.driver: resend, brevo, smtp, mail, file y none se reconocen (mayúsculas y espacios no importan); ausente = none; un valor desconocido falla cerrado como none y se avisa.
- `test_mail_sender_parsing` (l. 29) — Remitente de order_from: «Nombre <correo>» o solo el correo; por defecto Torivac Web <pedidos@torivac.com>; cabeceras con salto, < > " \ o un correo roto no valen.
- `test_mail_blockers_and_problems` (l. 51) — Sin controlador, con credenciales incompletas, remitente roto o sin destinatarios válidos: nada se envía y reason dice por qué (off · skipped).
- `test_mail_resend_request_and_errors` (l. 88) — Resend: POST /emails con la clave, cuerpo completo y errores cortos («Resend 403: …», «Resend respondió 500», «no se pudo conectar»).
- `test_mail_brevo_request_and_errors` (l. 119) — Brevo: POST /v3/smtp/email con api-key, sender, to, cc, replyTo, subject, htmlContent, textContent y attachment[{name, content}]; errores «Brevo <estado>: <mensaje ≤ 120>».
- `test_mail_secrets_never_leak` (l. 147) — Ninguna clave sale en ningún error ni en el último intento, aunque el proveedor la repita: «sk-SECRETO-123» configurada como clave no aparece en ninguna parte.
- `test_mail_last_attempt_is_recorded_on_every_send` (l. 171) — mail:last se anota en CADA envío (pedido, copia, contacto, prueba), solo el último, con el tipo, la hora y el motivo; también el fallido, el omitido y el de un controlador apagado.
- `test_mail_contact_and_test_composers` (l. 198) — Correo de un mensaje de contacto para el equipo: asunto en una línea, todo lo del visitante escapado en el HTML y completo en el texto; y el correo de prueba del panel.
- `test_diag_mail_checks` (l. 215) — Diag::mail: avisa según el controlador (none, mail(), file, SMTP sin verificar…) y según el resultado del último envío real.

### `MessagesTest.php`

Pruebas del formulario de contacto que de verdad funciona (Messages.php, Orders::handleContact y las rutas del panel): el mensaje se guarda SIEMPRE y el estado del correo es veraz; GET/DELETE /messages, POST /mail/test, GET /mail/status y el bloque `mail` de /health; solo texto plano con límites; antispam por tiempo de relleno (`_e`) y sin secretos en ninguna respuesta.

- `ms_contact` (l. 20) — Contacto válido de ejemplo (se puede sobrescribir cualquier campo).
- `ms_post` (l. 23) — POST /contact desde esa IP → Response.
- `ms_tokens` (l. 26) — Un gestor y un cliente con sesión → [token del gestor, token del cliente].
- `ms_seed` (l. 34) — Guarda `$n` mensajes de ejemplo, uno por minuto desde `$t0` (ms), y devuelve sus ids del más antiguo al más reciente.
- `test_contact_saves_message_and_reports_the_truth` (l. 46) — M1 · El mensaje se guarda con todos los campos, 400 días de retención y contador propio, y la respuesta es { ok, id, emailed:{ sent, reason } } sin error.
- `test_contact_email_status_failed_off_skipped` (l. 69) — M1 · Si el correo falla, se omite o está apagado: 200 igualmente, el mensaje queda guardado y `reason` dice por qué (el detalle solo en el registro).
- `test_contact_not_saved_is_a_500_and_sends_nothing` (l. 94) — M1 · Si el almacén no deja guardar: 500 «No se pudo guardar el mensaje», se registra y NO se envía nada; nunca «recibido» de lo que no está guardado.
- `test_contact_limits_and_antispam_still_apply` (l. 116) — M1 · Los límites y el antispam de siempre siguen: 6.º mensaje → 429 sin guardar; honeypot, campos no válidos, privacidad y Turnstile fallido → 400 sin guardar ni enviar.
- `test_invalid_contact_does_not_spend_the_budget` (l. 138) — M1b · Lo no válido no gasta el cupo de 5 mensajes de 10 min: seis intentos con el texto mal (cada uno con su aviso) y después sus 5 mensajes bien se aceptan; el 6.º bueno es 429. Igual que el Worker.
- `test_contact_plain_text_and_limits_over_the_api` (l. 148) — Texto plano y límites: etiquetas, scripts, SQL, plantillas, consola y rutas se rechazan con code y field; demasiado largo o con muchos enlaces también; nada se guarda ni se envía.
- `test_contact_and_order_fill_time_check` (l. 178) — Antispam por tiempo: con form_min_fill_ms = 1200 el cuerpo debe traer `_e` (entero ≥ 1200); sin él, con un número menor o con un texto → 400 too_fast. 0 lo desactiva.
- `test_order_plain_text_and_limits_over_the_api` (l. 200) — Pedido: mismos límites de texto plano (nombre 80, empresa 120, teléfono 40, notas 500) y mismo 400 con code y field.
- `test_messages_list_permissions_order_and_limit` (l. 218) — M2 · GET /messages: solo gestor (anónimo 401, cliente 403), más recientes primero, todos los campos, sin caché y límite acotado a 1..300 (100 por defecto).
- `test_messages_list_tolerates_corrupt_records` (l. 241) — M2 · Un registro corrupto se omite sin romper la lista y el hueco se rellena con el siguiente; un registro sin id válido tampoco vale.
- `test_messages_list_returns_visitor_text_as_data` (l. 253) — M2/M4 · El contenido del visitante es dato: se devuelve tal cual dentro del JSON, nunca como HTML ni con cabeceras.
- `test_messages_delete_and_cannot_reach_other_keys` (l. 264) — M2 · DELETE /messages/:id borra uno (derecho de supresión); 404 si no existe, ya se borró o el id no tiene forma de id; nunca alcanza otras claves; cliente 403.
- `test_mail_test_endpoint` (l. 282) — M2 · POST /mail/test: envía «Torivac · prueba de correo» a los destinatarios del equipo o a `to`; 200 aunque falle (con el error corto); 400 si `to` no vale; 10 por hora y usuario; cliente 403.
- `test_mail_test_endpoint_rate_limit` (l. 316) — M2 · 10 pruebas por hora y usuario: la 11.ª es 429, otro gestor tiene su cupo.
- `test_mail_status_endpoint_and_health` (l. 329) — M2 · GET /mail/status: driver, configured, problems (nombres), last (null al principio; luego el último intento); cliente 403; sin secretos.
- `test_mail_endpoints_never_leak_the_key` (l. 361) — M4 · Con una clave «sk-SECRETO-123» configurada, no aparece en ninguna respuesta de los endpoints de correo ni en el almacén aunque el proveedor la repita.
- `test_diag_warns_about_messages_without_email` (l. 374) — El diagnóstico avisa si los últimos mensajes de contacto se guardaron sin que saliera su aviso por correo.

### `PlainTextTest.php`

Pruebas de PlainText con los casos compartidos con la versión JavaScript (shared/plain-text.fixtures.json).

- `pt_fixtures` (l. 10) — Casos compartidos con JavaScript (en el paquete del hosting hay una copia junto a las pruebas).
- `test_plain_text_fixtures_copy_is_identical` (l. 18) — La copia de los casos junto a las pruebas es idéntica a la compartida (si el repositorio completo está presente).
- `test_plain_text_accepts_real_messages` (l. 26) — Lo que una persona escribe de verdad (técnico, con signos, en cuatro idiomas) se acepta.
- `test_plain_text_rejects_code_and_markup` (l. 35) — HTML, scripts, SQL, plantillas, consola, rutas, signos de programación, demasiados enlaces y lo que no es texto se rechazan con el código esperado.
- `test_plain_text_normalize_matches_javascript` (l. 44) — La limpieza (invisibles, controles, saltos, espacios, recorte) da lo mismo que en JavaScript.
- `test_plain_text_limits_count_characters_not_bytes` (l. 50) — Los límites cuentan letras (un acento o un emoji cuenta 1) y rechazan con too_long.
- `test_plain_text_field_limits` (l. 62) — Los límites de cada campo son los acordados (contacto: mensaje 1000; pedido: notas 500).
- `test_plain_text_hostile_long_inputs_are_fast` (l. 71) — Textos hostiles enormes no se eternizan ni agotan el motor de expresiones (se rechazan o se aceptan, pero rápido).

### `PriceSheetTest.php`

Pruebas de PriceSheet con los casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json)

- `fixtures` (l. 8) — Casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json).
- `test_price_sheet_cases` (l. 16) — Cada caso de hoja → precios, desconocidas, nuevas y filas ignoradas esperados.
- `test_price_sheet_numbers` (l. 43) — Números de celda: coma o punto decimal, miles, símbolos de moneda y texto ilegible.
- `test_price_sheet_errors` (l. 51) — Hojas sin cabecera reconocible o vacías: error claro.

### `ProposalsTest.php`

Pruebas de las propuestas EDITABLES del panel (Proposals.php y POST/GET /api/proposals/state): el manager aprueba con SU texto, rechaza con una nota o deshace; todo es texto plano con límites, solo lo hacen los managers y aprobar no publica nada por sí solo.

- `pr_tokens` (l. 16) — Gestor y cliente con sesión → [token del gestor, token del cliente].
- `pr_post` (l. 24) — POST /proposals/state con ese cuerpo y token (null = sin sesión) → Response.
- `test_proposals_approve_with_the_managers_own_text` (l. 27) — P1 · Aprobar con SU texto: se guarda tal cual (limpio de controles y espacios repetidos) con modo, fragmento a sustituir y nota; el GET lo devuelve y quien lo hizo y cuándo.
- `test_proposals_plain_approve_reject_and_undo_still_work` (l. 46) — P2 · Sin texto sigue funcionando como siempre (aprobar, rechazar y deshacer); rechazar admite una nota.
- `test_proposals_text_is_plain_and_limited` (l. 59) — P3 · Solo texto plano y con límites: etiquetas, scripts y código se rechazan con code y field; demasiado largo también; no se guarda nada.
- `test_proposals_ids_and_roles` (l. 84) — P4 · Identificadores: PR- y de 3 a 6 cifras; solo managers (cliente 403, sin sesión 401); un cuerpo roto no rompe nada.

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
- `test_d3_login_limits_per_ip_and_per_account` (l. 100) — Seguridad 2 · Fuerza bruta: 5 contraseñas erróneas del mismo visitante contra una cuenta la bloquean 1 hora (desde el 5.º fallo; ni la contraseña buena entra); 15 fallos de un visitante contra
- `test_login_lock_wait_text` (l. 163) — El texto del tiempo de espera: «una hora» si falta casi una hora entera; si no, minutos redondeados hacia arriba.
- `test_d3_failure_counters_window_and_reset` (l. 169) — Contadores de fallos (exceeded / fail / clear): ventana fija desde el primer fallo, sin sumar al mirar, y hit() sigue contando cada llamada.
- `test_a4_rate_limit_keys_are_bounded_and_expired_ones_purged` (l. 184) — A4 · Un correo de 300 caracteres ya no rompe el guardado ni se hace eco de la clave en el error; los contadores caducados se purgan «al vuelo» y no crecen sin límite.
- `test_a12_bearer_and_cron_failure_limits` (l. 215) — A12 · Un Bearer inválido (30 fallos / 10 min por visitante) y una llamada al cron con token erróneo (10 / 10 min) acaban en 429; una petición válida no consume cupo.
- `test_d3_secret_minimum_lengths_fail_closed` (l. 259) — D3 · Secretos con longitud mínima que fallan cerrado: session_secret ≥ 32 y sin «CAMBIA-ESTO», admin_token ≥ 32, cron_token ≥ 24; el diagnóstico y /health lo dicen con el NOMBRE del ajuste.
- `test_d3_password_policy_for_new_users` (l. 310) — D3 · Contraseñas nuevas: ≥ 12, sin la parte local del correo y fuera de la lista de triviales; por la API y por la herramienta de línea de comandos. Los usuarios ya creados no se tocan.
- `test_d4_sessions_are_bound_to_the_user_record` (l. 364) — D4 · La sesión va ligada al usuario: el token lleva {sub, iat, exp, sid} (sin rol), el rol sale del registro, los tokens sin sid no valen y el borrado + alta con el mismo correo no los resucita (A5).
- `test_d4_logout_revokes_every_earlier_token` (l. 412) — D4 · POST /api/auth/logout invalida TODOS los tokens anteriores de esa persona (sess_after); el token maestro no tiene sesión; los de otras personas no se tocan.
- `test_a3_decoy_hash_follows_the_current_default_cost` (l. 446) — A3 · El hash «señuelo» que iguala el tiempo de un usuario inexistente se genera con el coste actual de PASSWORD_DEFAULT (10 en PHP ≤ 8.3, 12 en 8.4) y se cachea; ya no es un literal de 61 caracteres.
- `test_d6_vary_merges_origin_and_authorization` (l. 475) — Las respuestas con Origin ajeno o propio siguen igual y Vary lleva Origin y Authorization a la vez (antes el de la ruta pisaba al de CORS).

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
- `test_d10_htaccess_closes_existing_files_but_not_the_api_routes` (l. 492) — D10/A10 · El .htaccess de api/ cierra todo lo que EXISTA salvo index.php y page.php (lib/, tools/, cron.php, config.php, copias, generated/, storage/) pero deja pasar las direcciones del API, que no existen como fichero y la raíz reescribe a index.php: Apache comprueba el acceso ANTES de reescribir, así que un «Require all denied» general (y un «Require all allowed», que ni existe) dejaba TODA la API en 403/500. Comprobado en un Apache real: scripts/qa-apache.mjs.
- `test_d10_new_files_and_dirs_are_private` (l. 517) — D10/A10 · Ficheros nuevos 0660 y carpetas 0770 (con umask 022 salían 0664/0755, legibles por otros usuarios del hosting); un almacén anterior se cierra a «otros» en su siguiente uso.
- `test_d10_diag_checks_the_new_settings` (l. 547) — D10 · El diagnóstico comprueba lo nuevo: secretos cortos (por su nombre, nunca el valor), modo de la copia al cliente, tope diario y tope de pedidos por hora.

### `SecurityOrdersTest.php`

Pruebas de seguridad de los pedidos y del contacto (informe del revisor del PHP: A1, A9, A13 · decisiones D1 y D7). Cada hallazgo reproduce el ataque del informe y comprueba que ya no funciona, y que lo legítimo sigue funcionando. Sin red ni servidor web (el correo es el controlador «file» o un Http::$mock).

- `so_mail_to` (l. 23) — El correo guardado en la bandeja de salida cuyo destinatario es `$to` (o null).
- `so_warnings` (l. 30) — Ejecuta `$fn` y devuelve los avisos y notas de PHP que haya provocado (deben ser ninguno).
- `test_a1_copy_to_customer_has_only_server_text_and_no_attachment` (l. 39) — A1 · La copia al cliente solo lleva contenido del servidor: nada de lo que escribió el visitante y SIN adjunto; el PDF y los datos del visitante solo van al equipo.
- `test_d1_copy_text_follows_the_order_language` (l. 65) — A1 · El texto fijo de la copia sale en el idioma del pedido (es, en, fr, de) y el asunto es siempre el mismo.
- `test_a1_pdf_is_validated_and_normalized` (l. 85) — A1 · El PDF del visitante se valida de verdad (base64 estricto, %PDF-, ≤ 4 MB) y se reenvía normalizado, solo al equipo.
- `test_d1_copy_mode_off_unknown_values_and_reasons` (l. 122) — D1 · order_copy: capped por defecto, off y cualquier otro valor = no se envía copia (falla cerrado); copy:false y correo sin configurar también tienen su motivo.
- `test_d1_copy_caps_per_recipient_and_per_day` (l. 152) — D1 · Topes de la copia: 2 por destinatario cada 24 h (clave = sha256 del correo) y `order_copy_daily_max` al día en total; superado un tope, el pedido y el aviso al equipo salen igual.
- `test_d1_global_orders_per_hour_cap` (l. 185) — D1 · Tope global de pedidos por hora (orders_per_hour_max, 120 por defecto): 429 y no se guarda nada; solo cuentan los pedidos válidos.
- `test_a13_single_line_fields_and_notes_are_cleaned` (l. 203) — A13 · Los campos de una línea no admiten saltos de línea ni controles (asunto del correo al equipo); las notas conservan los saltos pero no los controles raros.
- `test_a13_email_validation_is_strict` (l. 228) — A13 · Correo del visitante: la expresión del servidor es más estricta que la de antes (sin , ; < > " ( ) [ ] \ | ni espacios) y además pasa filter_var.
- `test_a9_non_string_fields_are_rejected_without_php_warnings` (l. 248) — A9 · Todos los campos de texto del pedido, el contacto y el acceso deben ser cadenas: un array o un número se rechaza con 400 y sin avisos de PHP.
- `test_d7_client_orders_hide_ip_and_mail_error` (l. 278) — D7 · A un cliente no se le devuelve la IP del pedido ni el motivo técnico del fallo del correo; un manager (y el token maestro) lo ve todo.
- `test_d7_orders_list_is_capped` (l. 304) — D7 · El listado de pedidos no revienta con miles: un manager recibe los 300 más recientes y un cliente hasta 100 de los suyos, con truncated:true si se cortó.
- `test_d7_prototype_names_are_not_valid_references` (l. 328) — D7/W8 · Nombres como «constructor», «__proto__» o «toString» no son referencias del catálogo (en PHP los arrays no tienen el problema; se cubre con una prueba).

### `SecurityStepTest.php`

Pruebas de la seguridad de acceso de la sesión «Seguridad 3»: verificación en dos pasos por correo (código, dispositivo recordado, cuentas de confianza), respuesta a ataques repetidos, desbloqueo de cuentas, cambio de contraseña, registro de actividad y copias de seguridad (crear, descargar con enlace firmado, restaurar). El correo es el controlador «file»: el código se lee de la carpeta outbox.

- `ss_setup` (l. 27) — Prepara el almacén con el código por correo ACTIVADO (la configuración normal) y un manager (jefa) y un cliente (ana). `$extra` cambia ajustes de two_step.
- `ss_clear_outbox` (l. 35) — Vacía el outbox (los correos que ha «enviado» el controlador file).
- `ss_code` (l. 38) — El código de 6 cifras del último correo de seguridad enviado a `$to` (null si no hay). Se vacía el outbox antes de cada acción para que no haya dudas.
- `ss_login` (l. 47) — POST /auth/login.
- `ss_verify` (l. 53) — POST /auth/verify.
- `ss_manager_token` (l. 59) — Entra como manager con su código (sin recordar el dispositivo) y devuelve el token.
- `ss_call` (l. 68) — Llamada autenticada con un token.
- `ss_reset_sends` (l. 74) — Pone a cero el tope de códigos por hora de una cuenta (una prueba que pide muchos no debe chocar con él salvo que lo pruebe).
- `ss_config` (l. 77) — La configuración normal de las pruebas con estos cambios encima (a diferencia de `Config::all() + [...]`, aquí gana lo nuevo).
- `ss_cookie` (l. 84) — El valor de la cookie de dispositivo que fijó una respuesta (null si no la hay).
- `test_step_manager_must_give_the_email_code` (l. 91) — SS1 · Un manager con la contraseña buena recibe un código por correo y solo con él obtiene la sesión; el código no va en el asunto ni en claro en el almacén.
- `test_step_clients_and_missing_mail_do_not_need_a_code` (l. 117) — SS2 · Los clientes no piden código (solo si hay ataques repetidos); sin correo capaz de enviar, nadie lo pide (no se queda nadie fuera).
- `test_step_five_wrong_codes_kill_the_challenge` (l. 129) — SS3 · Cinco códigos erróneos anulan ese código (y bloquean la pareja visitante+cuenta una hora); hay que volver a entrar con la contraseña.
- `test_step_resend_rules` (l. 152) — SS4 · Reenviar el código: espera entre envíos, como mucho 3 envíos por intento, y el código anterior deja de valer.
- `test_step_remembered_device` (l. 177) — SS5 · Dispositivo recordado: cookie firmada, HttpOnly, de 30 días y solo de esa cuenta; deja de valer al olvidarla, al cambiar la contraseña o al borrar y recrear la cuenta.
- `test_step_exemptions_and_switches` (l. 229) — SS6 · Cuentas de confianza (casilla, lista en config.php) y interruptores: nadie se queda fuera. Si el correo falla justo al pedir el código, se dice y no queda nada pendiente.
- `test_step_user_actions_are_for_managers` (l. 259) — SS7 · La casilla de código por correo, el desbloqueo y la contraseña de otra cuenta son cosas de managers.
- `test_step_change_own_password` (l. 277) — SS8 · Cambiar la contraseña propia: pide la actual (5 fallos por hora), cierra todas las sesiones y exige entrar de nuevo.
- `test_step_repeated_attacks_alert_once_and_require_a_code` (l. 297) — SS9 · Ataques repetidos: tres bloqueos en 24 h → UN aviso por correo y código en dispositivos nuevos 7 días; sin avisos de rutina; una cuenta de confianza no pide código de rutina, pero sí mientras dura la protección reforzada.
- `test_step_distributed_attack_counts_at_once` (l. 353) — SS10 · El bloqueo de la cuenta entera (30 fallos repartidos entre muchas direcciones) cuenta como ataque repetido al instante.
- `test_step_unlock_account` (l. 364) — SS11 · Otro manager desbloquea una cuenta (la pareja visitante+cuenta, la cuenta y el visitante) y la lista dice cuáles están bloqueadas; la protección reforzada se puede quitar aparte.
- `test_step_audit_log` (l. 384) — SS12 · Registro de actividad: qué se anota, con qué detalle, cuánto ocupa y quién lo lee.
- `test_step_audit_every_action_has_a_label` (l. 425) — Toda acción que el servidor anota tiene su nombre en castellano (si no, el panel enseñaría un código como «user.password»). Se buscan en el código fuente, así que una acción nueva sin nombre lo rompe.
- `test_step_burst_counts_one_lockout` (l. 439) — SSR1 · Revisión independiente: una ráfaga de peticiones simultáneas contra una cuenta cuenta UN bloqueo (no uno por petición), así que un solo visitante no puede provocar el aviso ni la protección reforzada.
- `test_step_security_mail_is_not_public` (l. 453) — SSR2 · Revisión independiente: los correos de seguridad (código y aviso) no se anotan en mail:last, que publica /api/health; un fallo del aviso queda en la actividad.
- `test_step_audit_anonymous_cap_and_no_junk` (l. 474) — SSR3 · Revisión independiente: lo que hacen visitantes sin sesión no llena el registro del día entero (la mitad queda para los managers), y un correo inventado no deja ficheros de bloqueo.
- `test_step_self_protection_and_turnstile_token` (l. 493) — SSR4 · Revisión independiente: un manager no se borra a sí mismo ni se cambia la contraseña sin la actual; el token maestro sí puede; un token de Turnstile enorme se rechaza sin llamar a Cloudflare.
- `test_step_audit_caps_and_purge` (l. 514) — SS13 · Tamaño y limpieza del registro: un día no pasa de 2 MB (con una línea de aviso) y lo de más de 180 días se borra.
- `test_step_backup_create_download_restore` (l. 534) — SS14 · Copia de seguridad: se crea desde el panel, se baja con un enlace firmado de 2 minutos y se restaura entera (datos con su caducidad e imágenes); nada de secretos ni contadores.
- `test_step_backup_schedule_and_prune` (l. 599) — SS15 · Copias: se guardan solo las 8 últimas, la semanal se hace una vez por semana y se puede apagar.
- `test_step_health_features_and_diagnostics` (l. 636) — SS16 · /health cuenta qué trae el servidor (y la clave PÚBLICA del CAPTCHA solo si están las dos claves) y el Diagnóstico explica cada medida.

### `SmtpTest.php`

Pruebas del cliente SMTP (Smtp.php) y del controlador smtp de Mail contra un servidor SMTP FALSO (fake-smtp.php, lanzado con proc_open en 127.0.0.1 y un puerto libre): éxito, STARTTLS y TLS implícito con certificado autofirmado (verificado y sin verificar), AUTH PLAIN y LOGIN, 535 de autenticación, 550 de destinatario, conexión rechazada, servidor mudo (tiempo máximo), respuestas absurdas, inyección de cabeceras y órdenes, contraseña sin cifrar a un servidor remoto y que ni el usuario ni la contraseña salen jamás en un error.

- `smtp_cert` (l. 18) — Certificado autofirmado de pruebas (PEM con certificado y clave) creado una vez por ejecución; null si OpenSSL no puede crearlo (entonces se omiten las pruebas de TLS).
- `smtp_fake` (l. 41) — Lanza el servidor SMTP falso con ese guion → ['port' => int, 'events' => fn(): array (lo recibido hasta ahora), 'stop' => fn()] o null si no se puede lanzar procesos.
- `with_smtp` (l. 64) — Ejecuta `$fn($puerto, $eventos)` con un servidor falso levantado y lo para siempre al terminar. Si no se puede lanzar procesos, lo dice y se omite.
- `smtp_cfg` (l. 72) — Configuración SMTP de pruebas hacia el servidor falso (sin cifrar, pues es la propia máquina).
- `smtp_cmds` (l. 75) — Órdenes recibidas por el servidor falso, en orden (sin los datos del mensaje).
- `test_smtp_success_commands_and_dot_stuffing` (l. 81) — Éxito sin cifrar: órdenes en el orden correcto, un RCPT por destinatario y mensaje entregado con «dot-stuffing».
- `test_smtp_auth_plain_and_login` (l. 98) — AUTH PLAIN y AUTH LOGIN: el servidor recibe usuario y contraseña bien codificados.
- `test_smtp_535_error_never_echoes_credentials` (l. 118) — 535: el error dice «SMTP 535 …» y NUNCA lleva el usuario ni la contraseña, aunque el servidor los repita en su texto.
- `test_smtp_recipient_rejected` (l. 131) — 550 de destinatario: con uno solo, error; con dos y uno rechazado, el mensaje sale al bueno y el rechazado se avisa.
- `test_smtp_server_errors_are_reported` (l. 147) — Fallos del servidor: saludo 554, MAIL FROM rechazado, DATA rechazado.
- `test_smtp_refused_mute_and_flooding_servers` (l. 164) — Conexión rechazada, servidor mudo (tiempo máximo) y respuestas absurdas (sin fin): nada se queda colgado ni agota la memoria.
- `test_smtp_rejects_bad_input_before_connecting` (l. 191) — Lo que no debe llegar a conectar: saltos de línea en remitente, destinatarios, usuario o contraseña; contraseña sin cifrar a un servidor remoto; ajustes absurdos.
- `test_smtp_starttls_and_implicit_tls` (l. 217) — STARTTLS y TLS implícito con un certificado autofirmado: con verificación fallan; sin ella (insecure_tls) funcionan, y la contraseña solo viaja ya cifrada.
- `test_mail_send_via_smtp_end_to_end` (l. 254) — Mail::send con el controlador smtp: mensaje completo (cabeceras, MIME, adjunto), resultado veraz y último intento anotado, sin secretos.
- `test_mail_message_headers_are_encoded_safely` (l. 288) — El mensaje completo: nombre del remitente y asunto largos con caracteres no ASCII se codifican en palabras MIME cortas y sin partir ninguna letra.

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

### `blog-markdown-batch.php`

[BLOG-MD] Ejecutor por lotes para comparar PHP con JavaScript: php blog-markdown-batch.php entradas.json Lee una lista de {md, n} y escribe en la salida estándar, en JSON, las salidas de BlogMarkdown (render, toPlain, excerpt, lead) y cuántas veces falló PCRE. Lo usa scripts/test-blog-markdown-php.mjs.

Secciones: `[BLOG-MD]`

### `fake-smtp.php`

Servidor SMTP falso SOLO para las pruebas (SmtpTest.php): escucha en 127.0.0.1 en un puerto libre, habla SMTP según un guion y anota todo lo que recibe. php fake-smtp.php <guion.json> <registro.jsonl> Escribe «PORT=<puerto>» en la salida estándar cuando está listo y atiende UNA conexión (o hasta `connections`). Guion (todo opcional):

### `harness.php`

[TESTS] Mini arnés de pruebas sin dependencias (no hace falta PHPUnit en el hosting): php tests/run.php            ejecuta todas las pruebas de tests/*Test.php Cada fichero define funciones test_*; assertSame/assertTrue/assertThrows comparan y cuentan.

Secciones: `[TESTS]`

- `same` (l. 16) — Compara valor esperado y obtenido (como JSON) y cuenta acierto o fallo.
- `true` (l. 26) — Comprueba que una condición es cierta.
- `throws` (l. 34) — Comprueba que una función lanza una excepción cuyo mensaje cumple el patrón.

### `run.php`

Ejecuta todas las pruebas: php tests/run.php  (código de salida 1 si alguna falla). Con un argumento solo carga los archivos *Test.php cuyo nombre lo contenga: php tests/run.php Blog

### `support.php`

Preparación común de las pruebas: almacén temporal, configuración de pruebas, catálogo sintético y peticiones simuladas

- `fresh` (l. 27) — Almacén temporal nuevo, configuración y catálogo sintéticos de las pruebas.
- `prices` (l. 44) — Precios de ejemplo: TT0020210 con tramos y P16633.
- `seedPrices` (l. 50) — Guarda los precios de ejemplo en el almacén.
- `goodOrder` (l. 53) — Pedido válido de ejemplo (se puede sobrescribir cualquier campo).
- `req` (l. 59) — Petición simulada para llamar al Router sin servidor web.
- `wire` (l. 62) — cuerpo de una respuesta tal y como lo recibe un cliente (JSON → arrays): los `items` de precios viajan como objeto y en el servidor son stdClass
- `master` (l. 65) — Cabecera de autenticación con el token maestro.
- `bearer` (l. 68) — Cabecera de autenticación con un token de sesión.
- `login_token` (l. 71) — Inicia sesión por el API y devuelve el token (null si no entra).
- `kv_files` (l. 78) — Nombres de los ficheros del almacén (kv/) que empiezan por un prefijo ya codificado como en disco («rl%3A» para las claves rl:).
- `outbox` (l. 86) — correos guardados por el controlador «file»
- `tmp_dir` (l. 96) — Carpeta temporal nueva y vacía para una prueba (la borra quien la pide con rmtree_all).
- `rmtree_all` (l. 104) — Borra una carpeta temporal con todo lo que lleva dentro.
- `php_child` (l. 115) — Ejecuta código PHP en un proceso aparte (con la autocarga del API) y devuelve [código de salida, salida estándar, salida de error]. Sirve para lo que no debe tumbar la prueba si falla
- `api_server` (l. 136) — Arranca el API REAL (api/index.php) con `php -S` en un puerto libre; la configuración va por variables de entorno TORIVAC_* (no hay config.php). La ruta /control hace saltar un aviso
- `zip_build` (l. 160) — Zip mínimo hecho a mano con las entradas que se le den: nombre => contenido (se comprime con deflate; los nombres que acaban en «!» se guardan SIN comprimir) o nombre =>
- `xlsx_with_sheet` (l. 177) — Libro con una sola hoja «Precios» cuyo XML de hoja es `$sheetXml` (más, si se quiere, las cadenas compartidas).
- `so_customer` (l. 186) — Datos del cliente de un pedido de prueba (cualquier campo se puede sobrescribir).
- `so_post` (l. 192) — Envía un pedido por el manejador; cada llamada usa por defecto una IP distinta (no se tropieza con el límite por visitante).
- `deflate_bomb` (l. 200) — Flujo deflate (sin cabecera zlib) de `$mb` megabytes de espacios, hecho por trozos: ocupa unos 300 KB comprimido y 300 MB descomprimido (la «bomba» del informe).
- `mt_msg` (l. 210) — Correo de ejemplo al equipo con todos los campos.
- `mt_http` (l. 216) — HTTP simulado que guarda cada petición en `$calls` y responde `$status` / `$body` (o lanza si `$throw`).
- `bl_img` (l. 226) — Imágenes de 1×1 píxel válidas (PNG, JPEG y WebP).
- `bl_png_dims` (l. 235) — PNG que dice tener esas dimensiones (solo la cabecera: basta para que se rechace por tamaño).

