# Diseño y aspectos de la web: «Ficha técnica», «Clásico» y «Original»

La web tiene **tres aspectos** que comparten el mismo HTML y el mismo contenido; solo cambia la hoja de estilo:

| Aspecto | Qué es | Cuándo |
|---|---|---|
| **Ficha técnica** (`ficha`) | Identidad nueva: la web como una hoja de datos impresa | **Por defecto** |
| **Clásico** (`clasico`) | El aspecto de la web original de Torivac (cabecera y héroe oscuros, Advent Pro fino, cobre y ámbar), sin tocar | Segunda opción, siempre disponible |
| **Original** (`original`) | La web actual de grupotorivac.com **tal como es hoy** (catálogo, fichas y páginas con su maqueta), a la que solo se suman las etiquetas de tensión, los precios y un presupuesto discreto | Para quien quiere conservar la identidad que ya tiene |

Quien visita el demo o el subdominio de pruebas los alterna con el selector **Aspecto** (cinta superior y pie) o con `?tema=ficha` / `?tema=clasico` / `?tema=original`; el navegador recuerda la elección. En producción se publica uno solo (o se deja el selector si Torivac lo prefiere): ver §2.

---

## 1. La identidad «Ficha técnica»

**Idea.** Torivac fabrica componentes que se piden por referencia y se documentan en hojas de datos. La web se diseña como esa hoja: papel mate, tinta, filetes visibles, datos en tipografía de máquina y **un solo color de acento, el cobre**, que es el material del bobinado y ya era el color de la marca. No hay sombras, degradados, esquinas redondeadas ni texturas de ruido: nada que no sea impresión.

**Qué la hace propia (y no un «estilo de IA»).** Cada recurso sale del oficio de Torivac, no de una moda:
- **Foto de portada en tinta de cobre**: la fotografía real del stand, en escala de grises multiplicada por cobre (como una impresión a una tinta), dentro de un recuadro con marcas de registro. Es la misma foto de la web original.
- **Regla de medir** en el borde de las cabeceras y **papel milimetrado** de fondo: el instrumento y el soporte del ingeniero.
- **Etiquetas de tensión como placas de características**: filete de tinta, punto de cobre = alterna, rombo = continua. Los datos (referencias, medidas, precios, cantidades) van en Chivo Mono con cifras tabulares.
- **Pie como cajetín de plano**: dirección, teléfono y correo en casillas con filete.
- **Servicios como casillas numeradas** (01–10); las libres se rayan, como en un dibujo técnico. Al pasar el ratón, la casilla se invierte (tinta y cobre).
- **Tablas de modelos como hoja de datos**: cabecera en mono, columna de referencia y columna de pedido fijas con filete grueso.

**Paleta** (`site/assets/css/ficha-tokens.css`; contraste medido, todos ≥ 4,5:1):

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--ink` | `#100404` | texto, filetes, cabecera, pie (el negro cálido de la marca) | 16,5:1 sobre `--bg` |
| `--bg` / `--paper` / `--paper-2` | `#ece8e0` / `#f6f3ec` / `#e0dacf` | fondo de página / paneles y casillas / cabeceras de tabla | tinta 14,5–18,2:1 |
| `--copper` | `#ba6b1e` | rellenos (botones, marcas); **texto de tinta encima** | 5,0:1 |
| `--copper-strong` | `#8f4a0d` | cobre como texto sobre papel | 4,8–6,0:1 |
| `--muted` | `#5a524d` | texto secundario | 5,5–6,9:1 |
| `--copper-on-dark` | `#f0a259` | acento sobre tinta | 9,6:1 |

**Tipografía** (todas OFL, en local, sin servicios externos): **Archivo** (la fuente de texto de la web original; ancho normal) para texto y títulos en negrita; **Archivo Expanded** (Archivo con el ancho fijado al 125 %, solo para los titulares grandes, en móvil se cambia por Archivo normal para que quepan las palabras largas); **Chivo Mono** para referencias, etiquetas, botones, cifras y menú. El aspecto nuevo añade solo ~48 KB de fuentes.

**Reglas de uso.** Titulares en mayúsculas con trazo apretado; dentro de los textos largos (`.prose`) los subtítulos van en minúsculas para que se lean. Una pieza gráfica por zona, no por decoración. Botón principal = cobre con tinta; secundario = filete de tinta. Foco de teclado = anillo doble (tinta + ámbar) que se ve sobre papel y sobre tinta.

---

## 1b. El aspecto «Original»: la web actual, sin cambiar su identidad

**Idea.** No es un rediseño: es la web de hoy (WordPress + Betheme + Elementor + WooCommerce) reconstruida con la plantilla estática, con las **mismas pantallas, el mismo orden y la misma presentación de los productos**. Se midió a 1440 px y a 390 px con navegador real (`scripts/probe_original_page.mjs`, `probe_original_layout.mjs`, `probe_original_heroes.mjs`: solo lectura, una carga por página) y se comparó con capturas lado a lado.

**Lo único que se suma** (lo pidió el cliente): ① **etiquetas de tensión** (alterna, continua, rango) en fichas y listados; ② **precios** (tarifa del Drive) en la tabla «Modelos y referencias» de cada ficha; ③ **presupuesto discreto**: un botón flotante «Presupuesto», «Añadir al presupuesto» en la ficha y la tabla por referencia y cantidad. Todo lo demás sale de la web actual.

**Qué reproduce** (valores medidos):

| Zona | Valores |
|---|---|
| Cabecera / pie | `#141414`, 131 px de alto; menú en PT Sans 13 px mayúsculas; idiomas con bandera y nombre; pie con logotipo, tres datos con icono, avisos, fondos europeos y LinkedIn gris |
| Fondo / texto | `#f4f4f4`; Archivo 15/25 px; títulos en Advent Pro (38 px/38, peso 600, 1 px de espaciado) en naranja `#ba6b1e` |
| Portada | héroe de 594 px con velo `linear-gradient(rgba(0,0,0,.65) 60%, rgba(186,107,30,.65))`; «Fabricación a medida» con la foto a sangre a la izquierda; «Somos Fabricantes» en recuadro blanco con filete naranja y **sombra sólida de 8 px**; servicios en casillas **en damero `#100404` / `#333`** (4 columnas, la última fila acaba en una foto de dos casillas); banda oscura del catálogo; contacto con formulario de 525 px |
| Páginas | héroe de 540 px con velo `linear-gradient(#000 75%, rgba(186,107,30,.6))` a 0,7; secciones foto + texto, tarjetas con icono (misión/visión/valores), bandas oscuras (con botón o con foto a media página); contacto con recuadro-formulario y datos con icono; blog con la última entrada destacada y tarjetas blancas de tres columnas; legales con título plano en PT Sans 44 px |
| Catálogo | raíz con las categorías en tarjetas blancas de tres columnas; categorías con sus fotos grandes y subcategorías; listados y fichas (galería con marco naranja solo si hay varias fotos, tablas de medidas con banda naranja `#e99c3b` y cabeceras bilingües, botón «Ver ficha técnica», «Explora productos similares», contacto al pie); menú lateral «Productos-Torivac» |

**Ajustes de accesibilidad (la única desviación de color).** El naranja de los botones de la web (`#c46b29`) da 3,8:1 con texto blanco y el del texto sobre `#f4f4f4` (`#ac631e`) 4,2:1: aquí se usa `#ac631e` en botones (4,6:1) y `#a45c18` en texto (4,6:1). Es una diferencia de tono que no se nota y cumple AA. El foco de teclado es un anillo naranja de 3 px (ámbar sobre fondos oscuros).

**Qué no se copia, a propósito.** (a) Los **carruseles** (portada, proyectos) se paran en su primera foto: no hay reproducción automática. (b) El **mapa de Google incrustado** de la página de contacto se sustituye por un enlace «Ver en Google Maps» (un iframe de terceros pediría consentimiento y obligaría a abrir la política de seguridad). (c) El enlace «Política de cookies» va en el pie (la web actual lo enseña solo en su aviso de cookies). (d) En móvil las banderas de idioma quedan en la barra (en la web actual van dentro del menú). (e) Los **tres iconos de contacto** son trazo y no relleno.

**Cómo se mantiene la fidelidad al editar contenido.** El contenido sale del mismo `data/catalog/*.json` de siempre; la maqueta propia de cada sección de las páginas (`kind`: foto + texto, recuadro + foto, tarjetas, banda oscura…, lado de la foto, trazos del logotipo de fondo) está en `data/catalog/original-layout.json` → `sections`, **por id de sección de Elementor** (idéntico en los cuatro idiomas): una sección nueva sin entrada sale con la maqueta genérica de «Original» (título, texto, botón). Los textos de tabla que traen salto de línea y cursiva (castellano arriba, traducción debajo) se conservan en el catálogo (`cells[].h`, de `scripts/semantic.py`).


---

## 2. Elegir aspecto al compilar y al publicar

```bash
node site/build.mjs                                   # demo: Ficha técnica por defecto + selector
node site/build.mjs --theme=clasico                   # demo con «Clásico» por defecto (el selector sigue)
node site/build.mjs --theme=original                  # demo con «Original» por defecto (el selector sigue)
node site/build.mjs --base=https://dominio --theme=ficha            # producción: solo Ficha técnica (sin selector)
node site/build.mjs --base=https://dominio --theme=clasico          # producción: solo Clásico (hoja de siempre, sin capas ni fuentes nuevas)
node site/build.mjs --base=https://dominio --theme=original         # producción: solo Original (la web actual; dos capas, sin las fuentes de Ficha técnica)
node site/build.mjs --base=https://dominio --theme-switch           # producción con selector en el pie
python3 -I scripts/package_cpanel.py --base=https://pruebas.dominio --staging                 # pruebas: Ficha técnica + selector
python3 -I scripts/package_cpanel.py --base=https://www.dominio --theme=clasico               # producción en Clásico
python3 -I scripts/package_cpanel.py --base=https://www.dominio --theme=original              # producción en Original
```

| Bandera | Efecto |
|---|---|
| `--theme=ficha\|clasico\|original` (o `TORIVAC_THEME`) | aspecto por defecto (`<html data-theme>`); un valor desconocido aborta |
| `--theme-switch` / `--no-theme-switch` | con selector o sin él. **Por defecto: sí en demo y en pruebas, no en producción** |

Qué lleva cada compilación: con selector, `site.css` trae las tres capas (`@layer classic,ficha,original;`) y todas las fuentes; con `ficha` solo, `classic,ficha` y las fuentes de Ficha técnica; con `original` solo, `classic,original` con Advent Pro, Archivo y PT Sans, las fotos de `assets/img/original/` y **sin** nada de los otros aspectos (y el HTML sale limpio: sin duplicados ocultos); solo `clasico` sin selector trae la hoja de siempre (37 KB), sin capas ni fuentes nuevas. `package_cpanel.py` comprueba que lo pedido es lo que acaba en la portada y en la hoja.

---

## 3. Cómo está hecho

**Una hoja, hasta tres capas.** `site.css` (única en demo y en producción) = fuentes + `@layer classic, ficha, original;` + `@layer classic{ tokens, base, layout, components, art }` + `@layer ficha{ ficha-tokens, ficha }` + `@layer original{ original-tokens, original }`. Una capa posterior gana a una anterior **sin importar la especificidad**, así que el aspecto nuevo solo tiene que declarar lo que cambia y «Clásico» queda intacto. Compatible con Chrome 99, Firefox 97, Safari 15.4 (marzo de 2022) o posteriores.

**Atributo en `<html>`.** `data-theme="ficha|clasico|original"`. Todo selector de `ficha.css` empieza por `[data-theme="ficha"]` (una prueba lo exige: si no, la regla se colaría en «Clásico»). Sin JavaScript se ve el aspecto compilado por defecto.

**Selector y recuerdo.** Un script de una línea en la cabecera (solo si hay selector) aplica `?tema=` o la elección guardada (`localStorage['tv-theme']`) **antes del primer pintado**, sin parpadeo. `assets/js/app.js` → `[THEME]` enlaza los botones (nacen ocultos: sin JS no hay controles inútiles), marca `aria-pressed` y guarda la elección. Sin almacenamiento (modo privado) el selector cambia la página actual sin errores.

**Piezas que solo existen en «Ficha técnica».** El HTML lleva `.hero-fig` (foto en recuadro) en la portada y en las cabeceras de página con foto; en «Clásico» es `display:none`, así que el navegador **ni descarga la imagen dos veces**: se descarga una vez, como fondo en «Clásico» o en el recuadro en «Ficha técnica». La portada precarga su foto (`<link rel="preload" as="image" fetchpriority="high">`).

**Fuentes.** `scripts/make_ficha_fonts.py` genera `archivo-expanded-…woff2` y `chivo-mono-…woff2` desde los paquetes de Fontsource (instancias con `fonttools`); `scripts/inline_fonts.py` escribe `fonts*.css` (base64 para `file://`) y `fonts*-files.css` (archivos, para producción). En producción se precargan las de la primera pantalla según el aspecto por defecto.

**El panel (`/admin/`) no cambia**: sigue con `tokens.css` + `base` + `layout` + `components` + `admin`, sin capas.

### Trampas conocidas de las capas (leer antes de tocar `ficha.css`)
1. **Una regla amplia de `ficha` pisa a todas las específicas de `classic`.** Ejemplo real: `a{color:…}` dejó el menú en tinta sobre tinta. Se acotan los selectores (`main a:not([class])`, `.prose a`, `.crumbs a`…) y los contextos oscuros se vuelven a declarar (`.on-dark`, `.wave-lab`, `.quote-drawer>header`).
2. **Las reglas de pantalla estrecha de `classic` sobre una propiedad que `ficha` también fija dejan de valer**, porque `ficha` gana: hay que repetirlas dentro de `ficha.css` (menú abierto en móvil, botón flotante reducido, casillas de servicios).
3. **`!important`**: el de `classic` (p. ej. `[hidden]`, `.embed …`) gana al de `ficha` (en capas el orden se invierte). `ficha.css` solo usa `!important` para anular el fondo en línea de la portada y de las cabeceras.
4. **Colores solo con `var(--…)`**: una prueba lo vigila (`qa-theme.mjs`).

### Piezas del HTML que solo existen en «Original»
El HTML sirve a los tres aspectos y cada hoja muestra lo suyo. Con selector, lo que solo es de «Original» lleva `o-only` (la capa `classic` lo oculta; «Original» lo vuelve a mostrar con su propio `display`), los rótulos que cambian llevan `<span class="l-n">…</span><span class="l-o">…</span>` (`lbl()`) y lo que «Original» no tiene lleva `o-skip` (se oculta con `display:none!important`). **Compilando solo «Original» (`site.ONLY_O`) el HTML sale limpio**: sin esos duplicados. Sin «Original» (`site.O` falso) nada de esto se emite y el HTML es **idéntico byte a byte** al de antes. Ayudantes en `site/templates.mjs`: `oc()`, `lbl()`, `oSecImg()`, `contactBlockO()`, `cardsHtml()`, `contactPageOriginal()`; los textos de tabla con formato, en `site/lib/render.mjs` (`cellText()`).

**Trampas propias de «Original»:** (1) una URL dentro de una variable CSS se resuelve desde la hoja que la usa, no desde la página: los fondos de sección viajan como `--o-sec-img:url(../media/…)`; (2) `background:none` en una regla de sección borra el fondo de arte que pone otra de menor especificidad: usar `background-color:transparent`; (3) las rejillas con columnas fijas se escriben `minmax(0,Npx)` para que puedan encoger; (4) cualquier clase de la sección con el mismo nombre que la de un hijo (p. ej. `o-cards`) hace que ambos casen con la misma regla.

### Añadir otro aspecto
1. `site/assets/css/<nombre>-tokens.css` y `<nombre>.css` con todos los selectores bajo `[data-theme="<nombre>"]`.
2. `site/build.mjs`: añadirlo a `THEMES` y a la lista de capas de `[CSS]` (orden = prioridad).
3. `site/lib/i18n.mjs`: `theme_<nombre>`; `site/templates.mjs`: el botón en `themeSwitch`, el valor en `THEME_BOOT` y sus fuentes en `PRELOAD_FONTS`.
4. Ampliar `scripts/qa-theme.mjs` y pasar `qa-ux` / `qa-a11y` con ese aspecto por defecto.

---

## 4. Cómo se prueba

- **`node scripts/qa-theme.mjs`** (≈ 2 min; compila 5 variantes en una carpeta temporal): reglas de diseño de las fuentes CSS (selectores acotados, sin colores sueltos, sin `!important` de más, solo variables en los tokens) · banderas y qué lleva cada compilación (capas, fuentes base64/archivo, precargas, selector) · selector por clic, teclado y `?tema=` (valor desconocido ignorado), persistencia entre páginas y sin almacenamiento · sin JavaScript · fuentes realmente cargadas en cada aspecto (producción por http con gzip: 200 y sin errores de consola) · la foto de portada se pide **una sola vez** · **12 páginas × 4 anchos × 2 aspectos sin desborde horizontal**.
- **`qa-ux`** (758 páginas × escritorio y móvil) y **`qa-a11y`** (axe-core AA) con la Ficha técnica por defecto; `qa-all.sh` los repite con «Clásico» (muestra de 80 páginas en UX, axe completo).
- **Clásico no cambia**: se comparó píxel a píxel con las capturas de antes de este trabajo (11 páginas de escritorio, mismo navegador). Diferencias, todas declaradas: (a) la cinta de demo lleva el selector y su texto se desplaza para dejarle sitio; (b) el pie del demo lleva la fila del selector; (c) el botón «Categorías/Filtros» ya **no aparece en escritorio** (era un fallo: `.btn{display:inline-flex}` anulaba `.filters-toggle{display:none}`; en pantallas estrechas se ve igual que antes).
- **Rendimiento** (`perf.mjs`, móvil con CPU ×4 y red 4G lenta): LCP de la portada ≈ 2,0 s (el elemento más grande ahora es la foto del recuadro; en «Clásico» el LCP lo marca el texto, ≈ 1,0 s). Objetivo del proyecto ≤ 2,5 s; con brotli/CDN de un hosting real será menor.

---

## 5. Decisión pendiente

Qué aspecto se publica en producción (o si se deja el selector). Cambiarlo es una bandera de compilación, no requiere tocar contenido: `package_cpanel.py --theme=ficha|clasico|original [--theme-switch]`.
