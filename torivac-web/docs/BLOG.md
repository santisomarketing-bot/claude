# Blog: escribir, publicar y posicionar entradas desde el panel

Las entradas se escriben en el panel (**Blog**), se ven en `/blog/…` con la misma cabecera, menú, pie y estilo de la web, y salen solas con todo el SEO y en el `sitemap.xml` y en `llms.txt` / `llms-full.txt`. No hay que subir archivos ni recompilar la web.

- Solo las ve y edita un **manager**.
- Funciona con el **API PHP** (cPanel, Plesk). El API de Cloudflare Worker no tiene blog: el panel avisa «El blog no está disponible en este servidor».
- Las 21 entradas por idioma que ya tenía la web (`/<dirección>/`) siguen igual; el listado `/blog/` mezcla las nuevas con ellas, por fecha.
- **Las entradas viven en la carpeta de datos**, no en los archivos de la web: actualizar la web no las toca (ver §8).

## 1. Escribir una entrada (paso a paso)

**Panel → Blog → Nueva entrada**

| Campo | Qué poner |
|---|---|
| **Idioma** | El de la entrada. No se cambia después: para otro idioma se crea otra entrada y se enlaza como traducción (§4) |
| **Título** | Es el título principal (`h1`) de la página. Hasta 120 caracteres |
| **Dirección (slug)** | Sale sola del título (`como-elegir-un-transformador` → `/blog/como-elegir-un-transformador/`). Se puede cambiar; si cambias la de una entrada ya publicada, la antigua redirige a la nueva (301) |
| **Resumen** | Sale en el listado del blog y es la descripción para Google si no escribes otra. Hasta 300 caracteres. Si lo dejas vacío se usa el principio del texto |
| **Imagen destacada** | Sale al principio de la entrada, en el listado y al compartirla en redes. **Texto alternativo obligatorio** (lo leen los lectores de pantalla y Google) |
| **Texto** | Formato sencillo (tabla de abajo). Hasta 60 000 caracteres. Hay vista previa en vivo igual a la página publicada |
| **SEO** | Título y descripción para buscadores (opcionales, ver §5) |
| **Publicación** | Estado y fecha (§2) |

### El texto

No hace falta saber HTML (y no se admite: cualquier etiqueta que escribas sale como texto, nunca se ejecuta). La barra de la parte superior inserta cada cosa.

| Escribes | Sale |
|---|---|
| `## Título de apartado` | Título de apartado (`h2`). Un `#` solo también sale como `h2`: el `h1` de la página es el título de la entrada |
| `### Subtítulo`, `#### Sub-subtítulo` | `h3`, `h4` (no te saltes niveles: la lista de comprobación avisa) |
| `**negrita**`, `*cursiva*` | **negrita**, *cursiva* |
| `- punto` · `1. paso` | Lista con viñetas · lista numerada (sin listas dentro de listas) |
| `> frase` | Cita |
| `[texto](https://…)` | Enlace. Admite `https://`, `http://`, `/ruta` de la propia web, `#ancla`, `mailto:` y `tel:`. Los externos se abren con `rel="noopener"` |
| `![texto alternativo](/media/blog/…webp "pie")` | Imagen con pie (se inserta con el botón *Imagen*) |
| `\| Serie \| VA \|` + `\|---\|---\|` | Tabla (con nombre accesible) |
| `---` | Línea separadora |

Los enlaces a otras páginas de la propia web (`/product/transformadores-toroidales/`, `/contacto/`…) ayudan al posicionamiento y a quien lee: pon al menos uno.

## 2. Estado, fecha, borradores y programar

| Estado | Qué ocurre |
|---|---|
| **Borrador** | No se ve en la web, ni en el listado, ni en el sitemap, ni en `llms.txt`. La dirección pública da 404 |
| **Publicada** | Visible desde su fecha. Si la dejas sin fecha, se publica con la **de ahora** y esa fecha ya no cambia al editarla (puedes cambiarla a mano) |
| **Programada** | Una entrada «Publicada» con **fecha futura** (la hora que pones es la de tu navegador). Aparece sola al llegar esa hora, sin tareas programadas: el servidor compara la fecha en cada petición. El panel la marca «Programada · dd/mm/aaaa hh:mm» |

- **Ver como saldrá** guarda y abre la página real con una dirección **firmada de una hora** (sirve para borradores y programadas). Lleva `noindex, nofollow` y no se guarda en ninguna caché. Cualquiera que tenga el enlace la ve durante esa hora: no lo compartas fuera del equipo.
- Las páginas se guardan **1 minuto** en la caché del navegador o de un CDN: tras guardar un cambio puede tardar hasta un minuto en verse en la web pública (el sitemap y `llms.txt`, hasta 10).
- Al guardar una entrada ya visible, el panel pide su página pública para comprobar que el servidor la sirve; si no (404, 500…) lo dice (ver §9).
- Salir del editor con cambios sin guardar pide confirmación.

## 3. Imágenes

- **Se comprimen en tu navegador** antes de subirlas (máximo 1600 px de lado, WebP o JPEG): subir una foto de 8 MB de un móvil funciona y no hace falta prepararla.
- El servidor **no se fía del archivo**: comprueba por su contenido que sea JPEG, PNG o WebP (no se admite SVG ni GIF), tamaño (máx. 2,5 MB y 6000 px por lado) y lo guarda con un nombre que lleva la huella de su contenido (`toroidal-300-va-ab12cd34ef56.webp`): una imagen nueva siempre tiene un nombre nuevo (nunca se ve una versión vieja) y el navegador puede guardarla un año.
- **El texto alternativo es obligatorio** en la imagen destacada y en cada imagen del texto (la lista de comprobación lo recuerda).
- Para quitar una imagen que ya no uses: en el cuadro de imágenes, elígela y pulsa **Borrar esta imagen**. Si alguna entrada la usa (destacada o dentro del texto) **no se borra** y el cuadro dice en cuáles. Máximo 1 500 imágenes y 600 entradas.

## 4. Traducciones

Nada se traduce solo: cada idioma lo escribe quien traduce y **se guarda como una entrada propia**. En la entrada original, **Crear la traducción en inglés/francés/alemán** abre una entrada nueva ya enlazada.

- Enlazadas, cada una sale con sus `hreflang` (más `x-default` = español) y el selector de idioma de la web lleva a la traducción de **esa** entrada (si no existe, a la portada del idioma).
- Como mucho una entrada por idioma en cada grupo. Una traducción en borrador no cuenta hasta publicarse.
- Los textos fijos de la web (menú, botones, pie) ya están en los cuatro idiomas; lo que escribas en el panel va tal cual.

## 5. SEO y GEO: qué se genera solo y qué haces tú

**Se genera solo en cada entrada publicada** (lo comprueba `scripts/qa-blog-apache.mjs` sobre un Apache real):

| Qué | Detalle |
|---|---|
| `<title>` y `meta description` | Los del bloque SEO; si faltan, el título y el resumen (o el principio del texto), recortados sin partir palabras |
| `canonical` | La dirección de la entrada con el dominio base |
| `hreflang` | Con las traducciones enlazadas, más `x-default` |
| Open Graph y Twitter | Título, descripción, `og:type=article`, imagen (con su texto alternativo; si no hay, el logotipo), fechas, `summary_large_image` |
| JSON-LD (`@graph`) | `Organization`, `WebSite`, `WebPage`, `BreadcrumbList` y `BlogPosting` (titular, fechas de publicación y modificación, imagen, idioma, autor y editor) |
| Una sola `h1` | El título; los apartados empiezan en `h2` |
| **`sitemap.xml`** | Dirección, `lastmod`, las alternativas de idioma y la imagen con su texto |
| **`llms.txt` y `llms-full.txt`** | Cada entrada visible, en la sección de su idioma: título, enlace y descripción (el completo, con el texto limpio) |
| `robots.txt` | Permite el sitio; cierra `/admin/` y `/api/` |
| Dominio de pruebas | Cabecera, meta y `robots.txt` con `noindex`; sin sitemap ni `llms` (no se indexa) |

**Ejemplo de lo que se añade** al publicar «Cómo elegir un transformador toroidal» (con su traducción al inglés y una imagen), en producción:

```text
llms.txt  →  ## Español · entradas del blog
             - [Cómo elegir un transformador toroidal](https://www.grupotorivac.com/blog/como-elegir-un-transformador-toroidal/): Guía rápida para elegir la potencia…

llms-full.txt  →  ### Cómo elegir un transformador toroidal
                  https://www.grupotorivac.com/blog/como-elegir-un-transformador-toroidal/
                  2026-10-28
                  Elegir un transformador toroidal empieza por la potencia… (el texto completo, sin formato)
```
```xml
<url><loc>https://www.grupotorivac.com/blog/como-elegir-un-transformador-toroidal/</loc>
  <xhtml:link rel="alternate" hreflang="es" href="https://www.grupotorivac.com/blog/como-elegir-un-transformador-toroidal/"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://www.grupotorivac.com/en/blog/how-to-choose-a-toroidal-transformer/"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://www.grupotorivac.com/blog/como-elegir-un-transformador-toroidal/"/>
  <lastmod>2026-10-28</lastmod>
  <image:image><image:loc>https://www.grupotorivac.com/media/blog/toroidal-300-va-ab12cd34ef56.webp</image:loc><image:caption>Transformador toroidal de 300 VA</image:caption></image:image></url>
```

**Lo que haces tú** (el editor tiene una lista de comprobación con ✓ y ⚠ que se actualiza al escribir y una vista previa de cómo sale en Google):

1. Título para buscadores de 25 a 65 caracteres y descripción de 70 a 160.
2. Dirección corta (hasta 60 caracteres) con las palabras importantes.
3. Al menos 300 palabras (los textos muy cortos posicionan peor) y un título de apartado como mínimo.
4. Texto alternativo en todas las imágenes y enlaces a páginas de la propia web.
5. Un primer párrafo que conteste en pocas palabras la pregunta del título (no está en la lista de comprobación; es consejo de redacción): si no escribes resumen, ese primer párrafo es el del listado, el de la descripción para Google y el de `llms.txt`, y es lo que suelen citar los buscadores con IA.
6. Tras publicar, en producción, avisa a Google: **Search Console → Inspección de URL → Solicitar indexación** (el sitemap lo descubre solo, pero así va antes).

## 6. Límites

| Qué | Límite |
|---|---|
| Título · resumen · título SEO · descripción SEO · texto alternativo | 120 · 300 · 120 · 200 · 200 caracteres |
| Texto | 60 000 caracteres |
| Dirección | 3–80 caracteres (a-z, 0-9 y guiones) |
| Entradas · imágenes | 600 · 1 500 |
| Imagen | 2,5 MB · 6000 px de lado · JPEG, PNG o WebP |
| Uso por hora | 600 guardados y 120 subidas de imagen (frena abusos; no se nota al trabajar) |
| Direcciones antiguas que redirigen | 10 por entrada |

Los campos son **texto plano** (sin etiquetas ni código, como los formularios de la web). Si algo no encaja, el panel marca el campo y dice el motivo.

## 7. Qué necesita el servidor

- **Apache o LiteSpeed con `mod_rewrite` y `.htaccess`** (cPanel y Plesk lo traen) y PHP 7.4+ (probado con 8.3). El `.htaccess` lo trae el paquete: reescribe `/blog/<dirección>/`, `/blog/`, `/media/blog/…` y (en producción) `sitemap.xml`, `llms.txt` y `llms-full.txt` hacia `api/page.php`.
- En **Plesk**, lo mismo que para el resto de la web ([`DESPLIEGUE-PLESK.md`](DESPLIEGUE-PLESK.md) paso 2): PHP servido por Apache y sin *Serve static files directly by nginx*. Si nginx entrega `sitemap.xml` y `llms.txt` sin pasar por Apache, **sirve la versión de la compilación, sin las entradas nuevas**; las propias entradas, el listado y las imágenes sí funcionan.
- Si PHP fallara al servir `/blog/`, el sitemap o `llms.txt`, se entrega el archivo estático de la compilación (la web no se cae); para una entrada se devuelve 503.
- El **Diagnóstico** (Ajustes) tiene una línea «blog»: cuántas entradas y si están las plantillas de los cuatro idiomas (`api/generated/blog-shell.*.json`).

## 8. Dónde se guardan y cómo se actualiza sin perderlas

Las entradas y sus imágenes están en la **carpeta de datos** (la misma que los pedidos y los precios): las entradas como archivos del almacén (`blog:post:…`, `blog:ix:…`) y los bytes de las imágenes en `<carpeta de datos>/media/`.

- Si la carpeta de datos está **fuera de la web** (`torivac-datos`, o la de `storage_dir`): actualizar o incluso vaciar la web **no las toca**.
- Si está **dentro** (`api/storage/`): «borrar y volver a subir» **las borra**. Antes de vaciar, comprime y descarga `api/storage/` (lo explica [`ACTUALIZAR-SIN-ROMPER.md`](ACTUALIZAR-SIN-ROMPER.md)) o, mejor, pasa a una carpeta fuera de la web (paso 5 de los despliegues).
- **Copia de seguridad**: la carpeta de datos entera (incluida `media/`). Si la copias a otro servidor y falta algún índice, el servidor lo reconstruye solo al leerlo.
- Las entradas de **pruebas no pasan a producción** (son otra carpeta de datos): escribe allí las reales. El texto de una entrada es el que ves en el editor: se puede copiar de una a otra.
- Borrar una entrada la quita de todo (página, listado, sitemap, `llms`) y su dirección vuelve a dar 404.

## 9. Si la entrada no aparece (o aparece sin estilo)

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El panel avisa «guardada, pero la web todavía no la muestra (error 404)» | El servidor no aplica el `.htaccess` (nginx sirviendo directo, `AllowOverride None`) o faltan los archivos | Revisa el Diagnóstico (*Servidor web*, *blog*); en Plesk, §7; vuelve a extraer el paquete encima |
| 404 solo en `/blog/mi-entrada/` | Es un borrador, o programada con fecha futura | Pon estado «Publicada» y comprueba la fecha |
| `/blog/` sale sin las entradas nuevas | Caché del navegador (1 min) o nginx sirviendo el estático | Recarga sin caché; si sigue, §7 |
| «Faltan las plantillas del blog» en el Diagnóstico | Paquete subido a medias (falta `api/generated/blog-shell.*.json`) o es el paquete de demostración | Extrae el paquete completo encima |
| Error 503 en una entrada | PHP no puede leer la plantilla | Mismo caso; mira el registro de errores de PHP |
| `sitemap.xml` o `llms.txt` sin las nuevas (en producción) | nginx los sirve directo, o la caché de 10 min | §7; espera 10 minutos |
| La imagen no se sube | Peso (el navegador la comprime; si sigue pasando de 2,5 MB, usa una más pequeña) o `post_max_size` bajo en PHP (mínimo 8M) | Diagnóstico → *subida* |

## 10. Para programadores

**Piezas** (todas con cabecera y funciones descritas en [`INDICE-CODIGO.md`](INDICE-CODIGO.md)):

| Archivo | Qué hace |
|---|---|
| `shared/blog-markdown.mjs` ↔ `backend-php/api/lib/BlogMarkdown.php` | Conversor de texto a HTML, **el mismo en JS (vista previa) y en PHP (página publicada)**. El contrato es `shared/blog-markdown.fixtures.json` |
| `backend-php/api/lib/Blog.php` | Modelo: validación, direcciones únicas por idioma, traducciones (`grp`), imágenes, vista previa firmada. Escrituras bajo `Store::locked('blog')` |
| `backend-php/api/lib/BlogApi.php` | Rutas de gestión `/api/blog/posts…`, `/api/blog/images…` (solo managers) |
| `backend-php/api/lib/BlogPage.php` + `api/page.php` | Páginas públicas, listado, imágenes, `sitemap.xml`, `llms*.txt` |
| `site/lib/blog-shell.mjs` | La compilación deja por idioma `api/generated/blog-shell.<idioma>.json`: la página completa con marcas `@@TV:…@@` (usa las mismas plantillas que las entradas estáticas: `postBody`/`postCard` con `dyn`) |
| `site/lib/hosting.mjs` (`BLOG_RULES`) | Reglas de reescritura del `.htaccess` |
| `site/assets/js/admin-blog.js` | Pantalla del panel (lista, editor, imágenes, SEO, guardar) |

**Cómo se pinta una entrada**: `page.php` decide por `REQUEST_URI` (no por parámetros: llamarlo directamente no sirve nada), carga la plantilla del idioma y rellena las marcas en **un solo paso** (`strtr`), **escapando todo**: lo que alguien escriba (título, descripción, texto alternativo, `@@TV:…@@`…) nunca se vuelve a interpretar. El cuerpo sale de `BlogMarkdown`, que solo emite las etiquetas de la tabla de §1 y solo admite esquemas de enlace seguros.

**Pruebas** (todas se ejecutan con `bash scripts/qa-all.sh`):

| Comando | Qué prueba |
|---|---|
| `php backend-php/api/tests/run.php Blog` | Modelo, API, páginas, escapes, vista previa, sitemap, `llms` y conversor (≈3 650 comprobaciones) |
| `node scripts/test-blog-markdown.mjs` | El conversor contra los casos del contrato y 20 000 textos hostiles al azar (tiempo lineal) |
| `node scripts/test-blog-markdown-php.mjs` | JS = PHP: ~195 000 comparaciones, 0 diferencias |
| `cd workers/api && npm test` | El Worker responde 501 `blog_unavailable` |
| `node scripts/qa-blog-apache.mjs` | **Apache real + PHP-FPM** con el paquete tal como se sube: entradas, SEO, hreflang, JSON-LD, listado, sitemap, `llms`, imágenes, borradores, programadas, redirecciones, noindex en pruebas |
| `node scripts/qa-blog-panel.mjs` | **Chromium** sobre ese Apache: escribir, imagen, SEO, publicar, traducir, previsualizar, programar, validar, borrar y accesibilidad (axe) |

**Cambiar algo del formato**: se cambia la regla en `shared/blog-markdown.mjs` **y** en `BlogMarkdown.php`, se añade el caso a `shared/blog-markdown.fixtures.json` (`node scripts/test-blog-markdown.mjs --update` copia el contrato a la carpeta de pruebas de PHP) y se pasan los dos comparadores.

**Añadir un campo a la entrada**: `Blog.php` (límite, validación, lo que devuelve `entry()`), `admin-blog.js` (formulario y `payload()`), la plantilla `postBody` en `site/templates.mjs` (+ `BlogPage::post`) si sale en la página, y su prueba en `BlogTest.php` / `BlogPageTest.php`.
