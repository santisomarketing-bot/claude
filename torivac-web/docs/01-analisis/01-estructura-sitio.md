# 01 · Estructura e IA del sitio grupotorivac.com

> Sesión 1 · Análisis profundo. Documento derivado de `data/analysis/site-structure.json` (contiene el detalle completo y los datos máquina-legibles). Todo se ha obtenido de las copias locales de `data/raw/` y `data/analysis/`; no se ha hecho ninguna petición de red ni se ha modificado la web original.

## 1. Resumen

- La web actual es **WordPress + WooCommerce + Elementor (tema Betheme) + Yoast + WPML** con 4 idiomas por directorio: ES en la raíz y EN/FR/DE bajo `/en/`, `/fr/`, `/de/`.
- Se han analizado **781 páginas HTML** (208 ES, 194 EN, 190 FR, 189 DE), 20 plantillas de página distintas y el sitemap de Yoast.
- Contenido ES: **11 páginas** (REST), **21 entradas** de blog, **80 fichas de producto**, **91 categorías de producto** y 2 categorías de blog. El catálogo no tiene precios (80 de 80 fichas con precio 0 y no comprables).
- **211 URLs de catálogo no son contenido propio**: 53 categorías hoja por idioma (52 en DE) devuelven el HTML de la ficha de producto. Hay que redirigirlas a la ficha.
- Las traducciones están casi completas: entradas 100 %, páginas 82-91 % (90-100 % sin el carrito), fichas 92-94 %, categorías 89 %. Faltan 5-6 fichas por idioma, el aviso legal en EN y FR y 10 categorías (vacías o duplicadas salvo tres que contienen una ficha).
- **Los slugs de página sí están traducidos; los de entrada de blog no (los 21 repiten el slug ES), los de ficha son mixtos y los segmentos base `/product/`, `/categoria-producto/`, `/category/` se repiten en español en los 4 idiomas.**
- Problemas SEO graves que no hay que heredar: canonical de `/en/` apunta a `/de/`; 54/54/53 fichas EN/FR/DE declaran canonical en la URL ES; el sitemap sólo lista URLs ES (197) y 4 EN; meta description literal `%` en 38 páginas; título "Grupor Torivac" en 7.
- **Hallazgo de arquitectura de información:** `/productos/` lista 11 familias y omite "Equipos electrónicos" (11 fichas). En total 15 de las 80 fichas ES no se enlazan desde `/productos/`.
- Lista de URLs a conservar idénticas: **613** (142 de ellas son tier 1: URLs ES indexadas y catálogo PDF); **227** se redirigen con 301 y 8 se descartan o revisan (sección 11).

Cómo leer este documento: cada afirmación lleva su fuente (fichero y clave) en el JSON; los valores de contenido (títulos, slugs, etiquetas de menú) se dejan en su idioma original.

## 2. Idiomas y volumen

| Idioma | Prefijo | Páginas (REST) | Entradas | Fichas | Categorías de producto | Cat. blog | HTML cosechado | URLs en sitemap Yoast |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Español (`es`, es-ES) | `/` | 11 | 21 | 80 | 91 | 2 | 208 | 197 |
| English (`en`, en-US) | `/en/` | 13 | 22 | 75 | 82 | 2 | 194 | 4 |
| Français (`fr`, fr-FR) | `/fr/` | 9 | 21 | 76 | 82 | 2 | 190 | 0 |
| Deutsch (`de`, de-DE) | `/de/` | 10 | 21 | 74 | 82 | 2 | 189 | 0 |

Fuentes: `data/raw/manifest.json` (rest/store), `data/analysis/pages-index.json` (781 registros), `data/raw/sitemaps/*.xml`. Los valores de "Páginas (REST)" incluyen las páginas WooCommerce (ES 1: `/confirmar/`; EN 4: tienda, carrito, finalizar-compra, mi-cuenta). Las cifras EN de entradas (22), FR de fichas (76) y las 82 categorías EN/FR/DE incluyen contenido huérfano (sección 7).

Los 4 idiomas se negocian por directorio (WPML). El HTML de cada idioma declara `x-default` = URL ES. Los catálogos PDF del menú son distintos por idioma: ES: `/wp-content/uploads/2024/10/Torivac_2024.pdf`; EN: `/wp-content/uploads/2024/10/Torivac_2024_EN.pdf`; FR: `/wp-content/uploads/2024/10/Torivac_2024_FR.pdf`; DE: `/wp-content/uploads/2025/02/catalogue-torivac-DE.pdf`.

## 3. Árbol del sitio (ES)

El árbol es idéntico en EN/FR/DE salvo los slugs traducidos (secciones 6 y 8.5) y las 5-6 fichas y 10 categorías que faltan. `n` = fichas asignadas a la categoría o a sus descendientes según la REST de producto; `→ ficha` = la URL de la categoría devuelve la ficha del único producto que contiene (canonical y og:url = ficha).

```
/ (portada)
- Torivac Empresa  /torivac-empresa/
- Productos  /productos/
  - Sin categorizar  /categoria-producto/sin-categorizar/  [archivo, n=4]
  - Bobinas encapsuladas  /categoria-producto/bobinas-encapsuladas/  [archivo, n=2]
    - Cuadradas  /categoria-producto/bobinas-encapsuladas/cuadradas/  [→ ficha, n=1]
    - Redondas  /categoria-producto/bobinas-encapsuladas/redondas/  [→ ficha, n=1]
  - Botones de mando  /categoria-producto/botones-de-mando/  [archivo, n=11]
    - Aros con flecha  /categoria-producto/botones-de-mando/aros-con-flecha/  [→ ficha, n=1]
    - Botones de mando serie BM (Mate)  /categoria-producto/botones-de-mando/botones-de-mando-serie-bm-mate/  [→ ficha, n=1]
    - Botones de mando serie BO (brillante)  /categoria-producto/botones-de-mando/botones-de-mando-serie-bo-brillante/  [→ ficha, n=1]
    - Botones de mando Serie BO con linea  /categoria-producto/botones-de-mando/botones-de-mando-serie-bo-con-linea/  [→ ficha, n=1]
    - Caratulas graduadas  /categoria-producto/botones-de-mando/caratulas-graduadas/  [→ ficha, n=1]
    - Cubretercas  /categoria-producto/botones-de-mando/cubretercas/  [→ ficha, n=1]
    - Discos Flecha  /categoria-producto/botones-de-mando/discos-flecha/  [→ ficha, n=1]
    - Discos graduados  /categoria-producto/botones-de-mando/discos-graduados/  [→ ficha, n=1]
    - Estators  /categoria-producto/botones-de-mando/estators/  [→ ficha, n=1]
    - Tapas Serie BM  /categoria-producto/botones-de-mando/tapas-serie-bm/  [→ ficha, n=1]
    - Tapas serie BO  /categoria-producto/botones-de-mando/tapas-serie-bo/  [→ ficha, n=1]
  - Botones de mando y accesorios  /categoria-producto/botones-de-mando-y-accesorios/  [→ ficha, n=1]
  - Choques | Inductancias | Reactancias toroidales  /categoria-producto/choques/  [→ ficha, n=1]
  - Comunicación MODBUS  /categoria-producto/comunicacion-modbus/  [archivo, n=0]
  - Controlador 0-10VDC  /categoria-producto/controlador-0-10vdc/  [archivo, n=0]
  - Equipos de Sobremesa  /categoria-producto/equipos-de-sobremesa-en-caja/  [archivo, n=0]
  - Equipos de sobremesa  /categoria-producto/equipos-de-sobremesa/  [archivo, n=0]
  - Equipos electrónicos  /categoria-producto/electronica/  [archivo, n=11]
    - Control industrial  /categoria-producto/electronica/control-industrial/  [archivo, n=2]
    - Convertidores  /categoria-producto/electronica/convertidores/  [→ ficha, n=1]
    - Energias renovables  /categoria-producto/electronica/energias-renovables/  [archivo, n=4]
    - Fuente de alimentación CA  /categoria-producto/electronica/fuente-de-alimentacion-ca/  [→ ficha, n=1]
    - Fuentes de alimentación CC  /categoria-producto/electronica/fuentes-de-alimentacion-cc/  [archivo, n=2]
  - Equipos industriales  /categoria-producto/equipos-industriales-en-caja/  [archivo, n=0]
  - Equipos industriales  /categoria-producto/equipos-industriales/  [archivo, n=0]
  - Estabilizadores de tensión  /categoria-producto/estabilizadores-de-tension/  [archivo, n=5]
    - Estabilizadores Serie AVS: electromecánicos con servomotor  /categoria-producto/estabilizadores-de-tension/serie-avs/  [archivo, n=2]
      - Monofásico  /categoria-producto/estabilizadores-de-tension/serie-avs/monofasico-serie-avs/  [→ ficha, n=1]
      - Trifásico  /categoria-producto/estabilizadores-de-tension/serie-avs/trifasico-serie-avs/  [→ ficha, n=1]
    - Serie BAVS: Electrónicos  /categoria-producto/estabilizadores-de-tension/serie-bavs/  [archivo, n=2]
      - Monofásico  /categoria-producto/estabilizadores-de-tension/serie-bavs/monofasico-serie-bavs/  [→ ficha, n=1]
      - Trifásico  /categoria-producto/estabilizadores-de-tension/serie-bavs/trifasico-serie-bavs/  [→ ficha, n=1]
  - Fabricaciones a Medida  /categoria-producto/fabricaciones-a-medida/  [archivo, n=0]
  - Fabricaciones a medida  /categoria-producto/fabricaciones-a-medida-transformadores-toroidales/  [archivo, canonical a ruta inexistente, n=0]
  - Hembrillas  /categoria-producto/hembrillas/  [archivo, n=4]
    - Hembrilla de seguridad HBS4  /categoria-producto/hembrillas/hembrilla-de-seguridad-hbs4/  [→ ficha, n=1]
    - hembrilla de seguridad HR4  /categoria-producto/hembrillas/hembrilla-de-seguridad-hr4/  [→ ficha, n=1]
    - Hembrilla de seguridad HSR4  /categoria-producto/hembrillas/hembrilla-de-seguridad-hsr4/  [→ ficha, n=1]
    - Hembrilla HB4  /categoria-producto/hembrillas/hembrilla-hb4/  [→ ficha, n=1]
  - Hembrillas de seguridad  /categoria-producto/hembrillas-de-seguridad/  [archivo, n=0]
  - Nucleos  /categoria-producto/nucleos/  [→ ficha, n=1]
  - Portaled  /categoria-producto/portaled/  [archivo, n=4]
    - led 10mm  /categoria-producto/portaled/led-10mm/  [→ ficha, n=1]
    - led 3mm  /categoria-producto/portaled/led-3mm/  [→ ficha, n=1]
    - led 5mm  /categoria-producto/portaled/led-5mm/  [→ ficha, n=1]
    - led 8mm  /categoria-producto/portaled/led-8mm/  [→ ficha, n=1]
  - Portaleds  /categoria-producto/portaleds/  [archivo, n=0]
  - Potenciómetros y reóstatos  /categoria-producto/potenciometros-y-reostatos/  [archivo, n=0]
  - Reostatos y potenciómetros bobinados  /categoria-producto/reostatos-y-potenciometros-bobinados/  [archivo, n=9]
    - Potenciometros  /categoria-producto/reostatos-y-potenciometros-bobinados/potenciometros/  [archivo, n=3]
      - Dobles  /categoria-producto/reostatos-y-potenciometros-bobinados/potenciometros/dobles-potenciometros/  [→ ficha, n=1]
      - Simples  /categoria-producto/reostatos-y-potenciometros-bobinados/potenciometros/simples/  [archivo, n=2]
    - Reóstatos cerámicos  /categoria-producto/reostatos-y-potenciometros-bobinados/ceramicos/  [archivo, n=5]
  - Resistencias | Bancos de carga  /categoria-producto/resistencias/  [archivo, n=7]
    - Bancos de carga  /categoria-producto/resistencias/bancos-de-carga/  [→ ficha, n=1]
    - Cementadas  /categoria-producto/resistencias/cementadas/  [→ ficha, n=1]
    - En caja  /categoria-producto/resistencias/en-caja-resistencias/  [→ ficha, n=1]
    - Helicoidales  /categoria-producto/resistencias/helicoidales/  [→ ficha, n=1]
    - Resistencias de arranque  /categoria-producto/resistencias/resistencias-de-arranque/  [→ ficha, n=1]
    - Resistencias de frenado  /categoria-producto/resistencias/resistencias-de-frenado/  [→ ficha, n=1]
    - Resistencias de puesta a tierra  /categoria-producto/resistencias/resistencias-de-puesta-a-tierra/  [→ ficha, n=1]
  - Transformadores  /categoria-producto/transformadores/  [archivo, n=6]
    - Transformadores toroidales  /categoria-producto/transformadores/transformadores-toroidales-transformadores/  [archivo, n=3]
      - Serie TCi (encapsulado para circuito impreso)  /categoria-producto/transformadores/transformadores-toroidales-transformadores/serie-tci/  [→ ficha, n=1]
      - Serie TT  /categoria-producto/transformadores/transformadores-toroidales-transformadores/serie-tt/  [→ ficha, n=1]
      - Serie TE  /categoria-producto/transformadores/transformadores-toroidales-transformadores/serie-te/  [→ ficha, n=1]
    - Transformador convencional  /categoria-producto/transformadores/transformador-convencional/  [archivo, n=3]
      - Serie TC  /categoria-producto/transformadores/transformador-convencional/serie-tc/  [→ ficha, n=1]
      - Serie TCE  /categoria-producto/transformadores/transformador-convencional/serie-tce/  [→ ficha, n=1]
      - TCT  /categoria-producto/transformadores/transformador-convencional/tct/  [→ ficha, n=1]
  - Variadores de tensión - Autotransformadores regulables  /categoria-producto/variadores-de-tension/  [archivo, n=15]
    - Variadores Monofasicos  /categoria-producto/variadores-de-tension/monofasico/  [archivo, n=2]
      - Manual  /categoria-producto/variadores-de-tension/monofasico/monofasicos-manual/  [→ ficha, n=1]
      - Motorizado  /categoria-producto/variadores-de-tension/monofasico/motorizado-monofasico/  [→ ficha, n=1]
    - Variador Doble  /categoria-producto/variadores-de-tension/dobles/  [archivo, n=2]
      - Doble manual  /categoria-producto/variadores-de-tension/dobles/doble-manual/  [→ ficha, n=1]
      - Doble motorizado  /categoria-producto/variadores-de-tension/dobles/doble-motorizado/  [→ ficha, n=1]
    - Variadores Trifásicos  /categoria-producto/variadores-de-tension/trifasico/  [archivo, n=2]
      - Manual  /categoria-producto/variadores-de-tension/trifasico/manual-trifasico/  [→ ficha, n=1]
      - Motorizado  /categoria-producto/variadores-de-tension/trifasico/motorizado/  [→ ficha, n=1]
    - Equipos de sobremesa  /categoria-producto/variadores-de-tension/en-caja/  [archivo, n=3]
      - En caja  /categoria-producto/variadores-de-tension/en-caja/variador-de-tension-en-caja/  [→ ficha, n=1]
      - Variador de tensión industriales  /categoria-producto/variadores-de-tension/en-caja/variador-de-tension-industriales/  [→ ficha, n=1]
      - Cuba de aceite  /categoria-producto/variadores-de-tension/en-caja/cuba-de-aceite/  [archivo, n=0]
    - Fabricación a medida  /categoria-producto/variadores-de-tension/fabricacion-a-media/  [→ ficha, n=1]
    - Accesorios de regulación  /categoria-producto/variadores-de-tension/accesorios-de-regulacion/  [archivo, n=3]
- Proyectos comerciales Torivac  /proyectos-empresariales/
- Catálogo (PDF)  /wp-content/uploads/2024/10/Torivac_2024.pdf
- Blog  /blog/
  - la-importancia-del-transformador-toroidal-en-la-industria  /la-importancia-del-transformador-toroidal-en-la-industria/
  - descargadores-de-bateria  /descargadores-de-bateria/
  - estabilizadores-de-tension  /estabilizadores-de-tension/
  - estabilizadores-de-tension-con-cobre  /estabilizadores-de-tension-con-cobre/
  - torivac-en-beyond-catalonia  /torivac-en-beyond-catalonia/
  - torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2  /torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/
  - torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025  /torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/
  - para-que-sirve-un-transformador-descubre-su-funcion-clave  /para-que-sirve-un-transformador-descubre-su-funcion-clave/
  - materiales-de-un-transformador-clave-en-su-rendimiento  /materiales-de-un-transformador-clave-en-su-rendimiento/
  - aplicaciones-de-los-transformadores-en-la-industria-actual  /aplicaciones-de-los-transformadores-en-la-industria-actual/
  - como-se-fabrica-un-transformador-proceso-y-calidad-europea  /como-se-fabrica-un-transformador-proceso-y-calidad-europea/
  - como-se-mejora-un-transformador-con-tecnicas-expertas  /como-se-mejora-un-transformador-con-tecnicas-expertas/
  - eficiencia-de-los-transformadores-clave-en-europa  /eficiencia-de-los-transformadores-clave-en-europa/
  - fallos-comunes-en-transformadores-y-sus-soluciones-efectivas  /fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/
  - limites-de-un-transformador-y-como-afectan-su-rendimiento  /limites-de-un-transformador-y-como-afectan-su-rendimiento/
  - seguridad-en-el-uso-de-transformadores  /seguridad-en-el-uso-de-transformadores/
  - funcionamiento-de-un-transformador-en-la-industria  /funcionamiento-de-un-transformador-en-la-industria/
  - impacto-medioambiental-de-los-transformadores-hoy  /impacto-medioambiental-de-los-transformadores-hoy/
  - como-extender-la-vida-util-de-un-transformador  /como-extender-la-vida-util-de-un-transformador/
  - mantenimiento-de-transformadores-electricos  /mantenimiento-de-transformadores-electricos/
  - normativas-sobre-transformadores-electricos-en-europa  /normativas-sobre-transformadores-electricos-en-europa/
- Contacto  /contacto/
- Legales (pie)
  - Aviso legal y condiciones de uso  /aviso-legal-2/
  - Política de privacidad  /politica-de-privacidad/
  - Declaración de accesibilidad  /declaracion-de-accesibilidad/
  - Política de cookies (banner Complianz)  /politica-de-cookies/
```

Notas del árbol:

- "Sin categorizar" (`/categoria-producto/sin-categorizar/`, 4 fichas) y las categorías vacías o duplicadas figuran como raíces aunque no aparecen en `/productos/`.
- La sección de entradas de blog cuelga de la raíz del idioma (`/{slug}/`), no de `/blog/`. `/blog/` pagina de 10 en 10: `/blog/page/2/` y `/blog/page/3/` (enlazadas en el HTML, no cosechadas).
- Además de la portada ES existen dos plantillas de Elementor indexables (`/elementor-hf/header/`, `/elementor-hf/footer-blog/`) que **no** forman parte del sitio.

## 4. Navegación y componentes globales

### 4.1 Menú de cabecera

Menú plano de 7 entradas, sin desplegables, idéntico en todas las páginas de un idioma (única excepción: la copia ES de `/confirmar/` que renderiza el menú y pie en inglés). Es sticky y en móvil se abre con el mismo `nav#menu` (Betheme, `a.responsive-menu-toggle`); no hay un segundo menú móvil.

| # | ES | EN | FR | DE |
|---|---|---|---|---|
| 1 | INICIO<br>`/` | Home<br>`/en/` | Accueil<br>`/fr/` | Startseite<br>`/de/` |
| 2 | TORIVAC EMPRESA<br>`/torivac-empresa/` | Torivac Company<br>`/en/torivac-company/` | Notre Entreprise<br>`/fr/notre-entreprise/` | Torivac Unternehmen<br>`/de/unser-unternehmen/` |
| 3 | PRODUCTOS<br>`/productos/` | Products<br>`/en/torivac-products/` | Produits<br>`/fr/produits-torivac/` | Produkte<br>`/de/torivac-produkte/` |
| 4 | PROYECTOS COMERCIALES TORIVAC<br>`/proyectos-empresariales/` | Entrepreneurial Projects<br>`/en/entrepreneurial-projects/` | Projets entrepreneuriaux<br>`/fr/projets-cles-en-main/` | Unternehmerische Projekte<br>`/de/schluesselfertige-projekte/` |
| 5 | CATALOGO<br>`/wp-content/uploads/2024/10/Torivac_2024.pdf` | Catalogue<br>`/wp-content/uploads/2024/10/Torivac_2024_EN.pdf` | Catalogue<br>`/wp-content/uploads/2024/10/Torivac_2024_FR.pdf` | Katalog<br>`/wp-content/uploads/2025/02/catalogue-torivac-DE.pdf` |
| 6 | BLOG<br>`/blog/` | Blog<br>`/en/blog/` | Blog<br>`/fr/blog/` | Blog<br>`/de/blog/` |
| 7 | CONTACTO<br>`/contacto/` | Contact<br>`/en/contact/` | Contactez nous<br>`/fr/contactez-nous/` | Kontakt<br>`/de/kontakt-us/` |

Al final del menú WPML añade el **selector de idioma**: 4 ítems en orden fijo English, Français, Español, Deutsch, cada uno con **bandera** (`img.wpml-ls-flag`, `alt` vacío) y nombre nativo. Sólo ofrece los idiomas en los que la página existe (selector incompleto en 17 páginas ES, 8 EN, 3 FR y 2 DE; no hay retroceso a la portada del idioma).

### 4.2 Pie

- **Estándar (escritorio):** dirección `C/ Potosí Nº 2, Planta 6ª, 08030 Barcelona`, teléfono `+34 93 312 01 61`, `info@torivac.com`, © 2025, enlaces a Aviso legal, Política de privacidad y Declaración de accesibilidad, crédito "Desarrollado por Santiso Marketing" (https://santisomarketing.com/), aviso de cofinanciación ICEX-Next / FEDER con logotipos y enlace a LinkedIn.
- **Variante de entradas de blog (21 por idioma):** bloque "Contacta con nosotros" con formulario WPForms antes del pie.
- **EN/FR/DE:** añaden un segundo bloque sólo tablet/móvil con © 2022 y enlace a `/aviso-legal/`. **Los enlaces de privacidad, aviso legal y accesibilidad de los pies EN/FR/DE apuntan a las URLs ES** (aunque existen versiones traducidas de privacidad y accesibilidad).

### 4.3 Barra lateral flotante de catálogo y migas

Shortcode propio `torivac-floating-sidebar` (botón "Productos-Torivac" y panel con lista plegable de categorías) presente en `/productos/`, `/shop/`, categorías y fichas (173 páginas en ES; mismo patrón en EN/FR/DE). Raíces que lista: Variadores de tensión - Autotransformadores regulables, Transformadores, Estabilizadores de tensión, Reostatos y potenciómetros bobinados, Bobinas encapsuladas, Choques / Inductancias / Reactancias toroidales, Nucleos, Portaled, Hembrillas, Resistencias / Bancos de carga, Equipos electrónicos, Botones de mando. Las migas (Productos > categoría > subcategoría) sólo existen en catálogo y el primer enlace "Productos" va a la portada en las categorías con archivo y a `/productos/` en fichas y categorías-ficha (incoherente).

### 4.4 Portada

H1 "Especialistas en control y regulación de tensión", presentación "Somos fabricantes", servicios, "60 años de experiencia", rejilla de 10 mosaicos de familia, descarga del catálogo PDF, "presencia en más de 30 países", bloque de contacto con formulario. Los mosaicos enlazan a 10 de las 12 familias; **faltan Hembrillas y Equipos electrónicos**.

### 4.5 Otros componentes globales

- Plugins detectados en el HTML: elementor, pro-elements, elementskit-lite, header-footer-elementor, wpforms, sitepress-multilingual-cms (WPML), woocommerce, woocommerce-multilingual, complianz-gdpr, wp-ultimate-review, wordpress-seo (Yoast).
- Seguimiento: GA4 `G-QXLKHV4Y7X` y GTM `GTM-K93FKL89` en las 781 páginas.
- Búsqueda de WordPress (`form#searchform`, parámetro `s`, placeholder ES con errata "Busar") en todas las páginas; no existe plantilla de resultados cosechada.

## 5. Plantillas de página

Clasificación por ruta + `body_classes` (los tokens `N` representan identificadores variables).

| Plantilla | Tipo WordPress | ES / EN / FR / DE | Ejemplo | body_classes definitorias | Decisión |
|---|---|---|---|---|---|
| **Portada** (`home`) | page (portada estática; REST id 13947 en ES) | 1 / 1 / 1 / 1 | https://grupotorivac.com/ | `elementor-page`, `elementor-page-N`, `elementor-template-full-width`, `home`, `is-elementor` | migrar |
| **Listado de productos (/productos/)** (`page:products_index`) | page con shortcode de categorías WooCommerce | 1 / 1 / 1 / 1 | https://grupotorivac.com/productos/ | `elementor-page`, `elementor-page-N`, `is-elementor`, `page`, `page-id-N` | migrar |
| **Categoría de producto (archivo)** (`product_category_archive`) | taxonomía product_cat con hijos o varios productos | 38 / 29 / 29 / 30 | https://grupotorivac.com/categoria-producto/bobinas-encapsuladas/ | `archive`, `aside_right`, `elementor-page-N`, `elementor-template-full-width`, `tax-product_cat` | migrar |
| **Categoría hoja que sirve la ficha del producto** (`product_category_serves_product`) | taxonomía product_cat con 1 solo producto | 53 / 53 / 53 / 52 | https://grupotorivac.com/categoria-producto/bobinas-encapsuladas/cuadradas/ | `aside_right`, `elementor-page-N`, `elementor-template-full-width`, `postid-N`, `product-template-default` | redirigir (301 a la ficha) |
| **Ficha de producto** (`product_single`) | product (WooCommerce, tipo simple, no comprable, precio 0) | 80 / 75 / 76 / 74 | https://grupotorivac.com/product/a-medida-2/ | `aside_right`, `elementor-page-N`, `elementor-template-full-width`, `postid-N`, `product-template-default` | migrar |
| **Empresa** (`page:company`) | page | 1 / 1 / 1 / 1 | https://grupotorivac.com/torivac-empresa/ | `elementor-page`, `elementor-page-N`, `elementor-template-full-width`, `is-elementor`, `page` | migrar |
| **Proyectos** (`page:projects`) | page | 1 / 1 / 1 / 1 | https://grupotorivac.com/proyectos-empresariales/ | `elementor-page`, `elementor-page-N`, `elementor-template-full-width`, `is-elementor`, `page` | migrar |
| **Índice del blog** (`page:blog_index`) | page | 1 / 1 / 1 / 1 | https://grupotorivac.com/blog/ | `elementor-page`, `elementor-page-N`, `is-elementor`, `page`, `page-id-N` | migrar |
| **Entrada de blog** (`blog_post`) | post (categoría "blog") | 21 / 22 / 21 / 21 | https://grupotorivac.com/aplicaciones-de-los-transformadores-en-la-industria-actual/ | `elementor-page`, `elementor-page-N`, `elementor-template-full-width`, `is-elementor`, `post-template` | migrar |
| **Archivo de categoría de blog** (`blog_category_archive`) | taxonomía category | 2 / 2 / 2 / 2 | https://grupotorivac.com/category/blog/ | `archive`, `category` | redirigir a /blog/ |
| **Contacto** (`page:contact`) | page | 1 / 1 / 1 / 1 | https://grupotorivac.com/contacto/ | `elementor-page`, `elementor-page-N`, `elementor-template-full-width`, `is-elementor`, `page` | migrar |
| **Aviso legal** (`page:legal_notice`) | page | 1 / 0 / 0 / 1 | https://grupotorivac.com/aviso-legal-2/ | `elementor-page`, `elementor-page-N`, `is-elementor`, `page`, `page-id-N` | migrar |
| **Política de privacidad** (`page:privacy_policy`) | page | 1 / 1 / 1 / 1 | https://grupotorivac.com/politica-de-privacidad/ | `elementor-page`, `elementor-page-N`, `is-elementor`, `page`, `page-id-N` | migrar |
| **Política de cookies** (`page:cookie_policy`) | page + shortcode Complianz | 1 / 1 / 1 / 1 | https://grupotorivac.com/politica-de-cookies/ | `page`, `page-id-N`, `page-template-default`, `wp-singular` | migrar |
| **Declaración de accesibilidad** (`page:accessibility_statement`) | page | 1 / 1 / 1 / 1 | https://grupotorivac.com/declaracion-de-accesibilidad/ | `elementor-page`, `elementor-page-N`, `is-elementor`, `page`, `page-id-N` | migrar |
| **Tienda (WooCommerce)** (`page:shop`) | archivo de producto (ES /shop/) y página "tienda" (EN) | 1 / 1 / 0 / 0 | https://grupotorivac.com/shop/ |  | no migrar (redirigir a /productos/) |
| **Carrito** (`page:cart`) | page WooCommerce [woocommerce_cart] | 1 / 1 / 0 / 0 | https://grupotorivac.com/confirmar/ | `page`, `page-id-N`, `page-template-default`, `woocommerce-cart`, `woocommerce-page` | no migrar |
| **Finalizar compra** (`page:checkout`) | page WooCommerce [woocommerce_checkout] | 0 / 1 / 0 / 0 | https://grupotorivac.com/en/finalizar-compra/ | `page`, `page-id-N`, `page-template-default`, `woocommerce-cart`, `woocommerce-page` | no migrar |
| **Mi cuenta** (`page:account`) | page WooCommerce [woocommerce_my_account] | 0 / 1 / 0 / 0 | https://grupotorivac.com/en/mi-cuenta/ | `page`, `page-id-N`, `page-template-default`, `woocommerce-account`, `woocommerce-page` | no migrar |
| **Plantilla Header/Footer de Elementor expuesta** (`elementor_hf_template`) | elementor-hf (CPT público) | 2 / 0 / 0 / 0 | https://grupotorivac.com/elementor-hf/footer-blog/ | `elementor-page`, `elementor-page-N`, `elementor-template-full-width`, `home`, `is-elementor` | descartar |

Detalle por plantilla (esquema de títulos, formularios, rango de texto, nota de migración): `data/analysis/site-structure.json` → `page_templates[]`.

Observaciones:

- Las 4 plantillas de catálogo (`product_single`, `product_category_serves_product`, `product_category_archive`, `page:products_index`) comparten `woocommerce`, `elementor-template-full-width`, `with_aside aside_right` y la barra lateral flotante.
- Los formularios WPForms son 3 en ES (14511 portada y entradas, 14527 fichas y categorías-ficha, 4921 contacto) y 2 por idioma en EN/FR/DE (p. ej. EN 16157 portada y contacto, 16204 fichas y entradas). Todos tienen nombre\*, email\*, teléfono, mensaje y consentimiento\*; el 14511 lleva además un campo adicional sin etiqueta identificada.
- Fichas: 79 de tipo `simple` y 1 `variable` en la Store API ES; ninguna es comprable (precio 0).

## 6. Patrones de URL por idioma

| Tipo | ES | EN | FR | DE |
|---|---|---|---|---|
| Portada | `/` | `/en/` | `/fr/` | `/de/` |
| Página | `/{slug}/` | `/en/{slug}/` | `/fr/{slug}/` | `/de/{slug}/` |
| Índice del blog | `/blog/` | `/en/blog/` | `/fr/blog/` | `/de/blog/` |
| Producto | `/product/{slug}/` | `/en/product/{slug}/` | `/fr/product/{slug}/` | `/de/product/{slug}/` |
| Categoría de producto | `/categoria-producto/{cat}/{subcat}/{subsubcat}/` | `/en/categoria-producto/{cat}/{subcat}/{subsubcat}/` | `/fr/categoria-producto/{cat}/{subcat}/{subsubcat}/` | `/de/categoria-producto/{cat}/{subcat}/{subsubcat}/` |
| Categoría de blog | `/category/{slug}/` | `/en/category/{slug}/` | `/fr/category/{slug}/` | `/de/category/{slug}/` |
| Paginación del blog | `/blog/page/{n}/` | `/en/blog/page/{n}/` | `/fr/blog/page/{n}/` | `/de/blog/page/{n}/` |
| Entrada de blog | `/{slug}/` (entradas colgando de la raíz del idioma) | `/en/{slug}/` (entradas colgando de la raíz del idioma) | `/fr/{slug}/` (entradas colgando de la raíz del idioma) | `/de/{slug}/` (entradas colgando de la raíz del idioma) |

Ejemplos reales:

- **ES** · página `/torivac-empresa/` · entrada `/la-importancia-del-transformador-toroidal-en-la-industria/` · ficha `/product/hembrilla-hb4/` · categoría `/categoria-producto/resistencias/bancos-de-carga/`
- **EN** · página `/en/torivac-company/` · entrada `/en/la-importancia-del-transformador-toroidal-en-la-industria/` · ficha `/en/product/hb4-socket/` · categoría `/en/categoria-producto/resistors-load-banks/load-banks/`
- **FR** · página `/fr/notre-entreprise/` · entrada `/fr/la-importancia-del-transformador-toroidal-en-la-industria/` · ficha `/fr/product/prise-hb4/` · categoría `/fr/categoria-producto/resistances-bancs-de-charge/bancs-de-charge/`
- **DE** · página `/de/unser-unternehmen/` · entrada `/de/la-importancia-del-transformador-toroidal-en-la-industria/` · ficha `/de/product/hb4-buchse/` · categoría `/de/categoria-producto/widerstande-lastbanke/ladebanke/`

Reglas:

- ES es el idioma por defecto y vive en la raíz sin prefijo; EN/FR/DE se montan bajo /en/ /fr/ /de/ (WPML, idioma por directorio).
- Los segmentos base /product/, /categoria-producto/, /category/, /blog/ y /shop/ NO se traducen: se repiten en español en los 4 idiomas.
- Las páginas SÍ llevan slug traducido (salvo cookies y accesibilidad, que repiten el slug ES), las entradas de blog conservan el slug ES en los 3 idiomas y los productos son mixtos (aprox. la mitad idénticos al slug ES).
- Las categorías de producto llevan slug traducido en EN/FR/DE (y jerarquía completa en la ruta), pero hay slugs mezclados o en neerlandés (ver slug_issues).
- Los slugs con sufijo numérico (-2, -3, -6…) nacen de colisiones al duplicar productos/categorías con el mismo nombre; el sufijo forma parte de la URL pública.
- Home de cada idioma: /, /en/, /fr/, /de/ (slugs REST internos: grupo-torivac-inicio, home, accueil, startseite).
- Las categorías son jerárquicas hasta 3 niveles (`/categoria-producto/<raíz>/<sub>/<subsub>/`); la ruta completa de la categoría padre va traducida en EN/FR/DE.
- Páginas WooCommerce: ES `/confirmar/` (carrito) y `/shop/` (archivo); EN `/en/tienda/`, `/en/carrito/`, `/en/finalizar-compra/`, `/en/mi-cuenta/` (títulos y slugs en español dentro del sitio EN); FR y DE no las tienen.

Traducción de slugs (último segmento frente al ES):

| Contenido | Idioma | Traducciones | Slug idéntico al ES | Slug traducido |
|---|---|---:|---:|---:|
| Páginas | EN | 7 | 2 | 5 |
| Páginas | FR | 7 | 2 | 5 |
| Páginas | DE | 8 | 3 | 5 |
| Entradas | EN | 21 | 21 | 0 |
| Entradas | FR | 21 | 21 | 0 |
| Entradas | DE | 21 | 21 | 0 |
| Fichas | EN | 75 | 39 | 36 |
| Fichas | FR | 75 | 37 | 38 |
| Fichas | DE | 74 | 41 | 33 |
| Categorías de producto | EN | 81 | 6 | 75 |
| Categorías de producto | FR | 81 | 7 | 74 |
| Categorías de producto | DE | 81 | 3 | 78 |

## 7. Cobertura de traducción

| Contenido | ES (total) | EN | FR | DE |
|---|---:|---:|---:|---:|
| Páginas (REST, incluye carrito) | 11 | 10 (90,9 %) | 9 (81,8 %) | 10 (90,9 %) |
| Páginas sin utilidades WooCommerce | 10 | 9 (90,0 %) | 9 (90,0 %) | 10 (100,0 %) |
| Entradas de blog | 21 | 21 (100,0 %) | 21 (100,0 %) | 21 (100,0 %) |
| Fichas de producto | 80 | 75 (93,8 %) | 75 (93,8 %) | 74 (92,5 %) |
| Categorías de producto | 91 | 81 (89,0 %) | 81 (89,0 %) | 81 (89,0 %) |
| Categorías de blog | 2 | 2 (100,0 %) | 2 (100,0 %) | 2 (100,0 %) |

Método: se parte de cada URL ES y se lee el `hreflang` de su HTML; para las 53 categorías hoja (cuyo HTML es el de la ficha y hereda los hreflang de la ficha) el par se obtiene con la traducción de la ficha servida o, en 8 casos FR/DE, por eliminación o palabra clave (`mapped_by`, ver `gaps.G-11`).

### 7.1 Matriz de páginas (ES → EN/FR/DE)

| Rol | ES | EN | FR | DE |
|---|---|---|---|---|
| home | `/` | `/en/` | `/fr/` | `/de/` |
| company | `/torivac-empresa/` | `/en/torivac-company/` | `/fr/notre-entreprise/` | `/de/unser-unternehmen/` |
| products_index | `/productos/` | `/en/torivac-products/` | `/fr/produits-torivac/` | `/de/torivac-produkte/` |
| projects | `/proyectos-empresariales/` | `/en/entrepreneurial-projects/` | `/fr/projets-cles-en-main/` | `/de/schluesselfertige-projekte/` |
| blog_index | `/blog/` | `/en/blog/` | `/fr/blog/` | `/de/blog/` |
| contact | `/contacto/` | `/en/contact/` | `/fr/contactez-nous/` | `/de/kontakt-us/` |
| legal_notice | `/aviso-legal-2/` | **null** | **null** | `/de/aviso-legal-2/` |
| privacy_policy | `/politica-de-privacidad/` | `/en/privacy-policy/` | `/fr/politique-de-confidentialite/` | `/de/datenschutzbestimmungen/` |
| cookie_policy | `/politica-de-cookies/` | `/en/politica-de-cookies/` | `/fr/politica-de-cookies/` | `/de/politica-de-cookies/` |
| accessibility_statement | `/declaracion-de-accesibilidad/` | `/en/declaracion-de-accesibilidad/` | `/fr/declaracion-de-accesibilidad/` | `/de/declaracion-de-accesibilidad/` |
| cart | `/confirmar/` | `/en/carrito/` | **null** | **null** |
| shop_archive | `/shop/` | **null** | **null** | **null** |

Faltan: aviso legal EN y FR; carrito FR y DE; `/shop/` no tiene traducción (su hreflang es el relativo `/shop/` repetido). El aviso legal DE conserva el slug ES `aviso-legal-2`.

### 7.2 Entradas de blog (21 ES → EN/FR/DE)

Las 21 entradas tienen traducción en los 3 idiomas **con el mismo slug que el ES** bajo `/en/`, `/fr/` y `/de/` (63 URLs). Matriz completa en `translation_matrix.posts`.

| Fecha (REST) | Slug (ES = EN = FR = DE) |
|---|---|
| 2025-12-29 | `/funcionamiento-de-un-transformador-en-la-industria/` |
| 2025-12-29 | `/impacto-medioambiental-de-los-transformadores-hoy/` |
| 2025-12-29 | `/como-extender-la-vida-util-de-un-transformador/` |
| 2025-12-29 | `/mantenimiento-de-transformadores-electricos/` |
| 2025-12-29 | `/normativas-sobre-transformadores-electricos-en-europa/` |
| 2025-12-20 | `/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` |
| 2025-12-20 | `/como-se-mejora-un-transformador-con-tecnicas-expertas/` |
| 2025-12-20 | `/eficiencia-de-los-transformadores-clave-en-europa/` |
| 2025-12-20 | `/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` |
| 2025-12-20 | `/limites-de-un-transformador-y-como-afectan-su-rendimiento/` |
| 2025-12-20 | `/seguridad-en-el-uso-de-transformadores/` |
| 2025-12-19 | `/para-que-sirve-un-transformador-descubre-su-funcion-clave/` |
| 2025-12-19 | `/materiales-de-un-transformador-clave-en-su-rendimiento/` |
| 2025-12-19 | `/aplicaciones-de-los-transformadores-en-la-industria-actual/` |
| 2025-06-03 | `/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` |
| 2024-11-22 | `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` |
| 2024-11-18 | `/torivac-en-beyond-catalonia/` |
| 2024-11-12 | `/estabilizadores-de-tension-con-cobre/` |
| 2024-11-05 | `/estabilizadores-de-tension/` |
| 2024-10-10 | `/descargadores-de-bateria/` |
| 2024-06-25 | `/la-importancia-del-transformador-toroidal-en-la-industria/` |

### 7.3 Fichas sin traducir

| ES id | Ficha ES | EN | FR | DE |
|---:|---|:-:|:-:|:-:|
| 16633 | [Variador de tensión portatil](https://grupotorivac.com/product/variador-de-tension-portatil/) | sin traducir | sin traducir | sin traducir |
| 977 | [SAI para control industrial](https://grupotorivac.com/product/sai-para-control-industrial/) | sin traducir | sin traducir | sin traducir |
| 976 | [Ondulador para FV Interconectada de 350W autoconsumo](https://grupotorivac.com/product/ondulador-para-fv-interconectada-de-350w-autoconsumo/) | sin traducir | sin traducir | sin traducir |
| 974 | [Ondulador autonomo para instalaciones fotovoltaicas sin conexión a red](https://grupotorivac.com/product/ondulador-autonomo-para-instalaciones-fotovoltaicas-sin-conexion-a-red/) | sin traducir | sin traducir | sin traducir |
| 972 | [Fuente de corriente alterna sinusoidal](https://grupotorivac.com/product/fuente-de-corriente-alterna-sinusoidal/) | sin traducir | sin traducir | sin traducir |
| 326 | [Variador Trifásico manual](https://grupotorivac.com/product/trifasico-manual/) | sí | sí | sin traducir |

Las fichas 972, 974, 976, 977 y 16633 faltan en los 3 idiomas; la 326 "Variador Trifásico manual" sólo falta en DE. No se proponen traducciones aquí (queda como propuesta para el admin).

### 7.4 Categorías de producto sin traducir (10 por idioma)

| ES id | Categoría ES | Ruta | Fichas | Se sirve |
|---:|---|---|---:|---|
| 31 | Controlador 0-10VDC | `/categoria-producto/controlador-0-10vdc/` | 0 | archive |
| 32 | Cuba de aceite | `/categoria-producto/variadores-de-tension/en-caja/cuba-de-aceite/` | 0 | archive |
| 700 | En caja | `/categoria-producto/variadores-de-tension/en-caja/variador-de-tension-en-caja/` | 1 | product |
| 47 | Equipos industriales | `/categoria-producto/equipos-industriales-en-caja/` | 0 | archive |
| 36 | Equipos industriales | `/categoria-producto/equipos-industriales/` | 0 | archive |
| 49 | Fabricaciones a Medida | `/categoria-producto/fabricaciones-a-medida/` | 0 | archive |
| 102 | Fabricaciones a medida | `/categoria-producto/fabricaciones-a-medida-transformadores-toroidales/` | 0 | other-canonical |
| 99 | Fuente de alimentación CA | `/categoria-producto/electronica/fuente-de-alimentacion-ca/` | 1 | product |
| 25 | Hembrillas de seguridad | `/categoria-producto/hembrillas-de-seguridad/` | 0 | archive |
| 699 | Variador de tensión industriales | `/categoria-producto/variadores-de-tension/en-caja/variador-de-tension-industriales/` | 1 | product |

Las 10 faltan en los 3 idiomas. Tres contienen una ficha ES: 699 y 700 (subcategorías de Equipos de sobremesa que sirven su ficha) y 99 "Fuente de alimentación CA" (ficha 972, que tampoco está traducida); las otras 7 no tienen fichas.

## 8. Hallazgos

Listado ordenado por área; la columna Evidencia remite a claves de `site-structure.json` o a ficheros fuente. Severidad: alta = pierde SEO o catálogo; media = confunde o duplica; baja = cosmético.

### 8.1 Duplicados

| ID | Sev. | Hallazgo | Detalle | Recomendación | Evidencia |
|---|---|---|---|---|---|
| F-D01 | alta | **211 URLs de categoría sirven la ficha de producto** | 53 categorías hoja por idioma (52 en DE) con un solo producto devuelven el HTML de la ficha: canonical y og:url apuntan a la ficha, pero la URL de categoría está en product_cat-sitemap y en la barra lateral. | En la web nueva la categoría hoja no existe como página: 301 a la ficha (redirect_to ya calculado en seo.preserve_urls). | data/analysis/site-structure.json translation_matrix.product_categories[].es.renders = product; data/raw/sitemaps/product_cat-sitemap.xml |
| F-D02 | media | **/shop/ y /en/tienda/ duplican /productos/** | Archivo WooCommerce (ES /shop/, EN /en/tienda/) lista las mismas familias que /productos/; /shop/ es la primera URL del product-sitemap y declara hreflang relativo '/shop/'. | No migrar; 301 a /productos/ (traducido). | data/analysis/pages/es/shop.json; data/raw/sitemaps/product-sitemap.xml |
| F-D03 | media | **12 categorías ES vacías o duplicadas por nombre** | Sin productos y fuera del sitemap (12): Comunicación MODBUS (50), Controlador 0-10VDC (31), Cuba de aceite (32), Equipos de Sobremesa (46) y Equipos de sobremesa (39) duplicadas entre sí y con la de variadores, Equipos industriales x2 (36, 47), Fabricaciones a Medida / a medida (49, 102; la 102 con canonical a una ruta inexistente), Hembrillas de seguridad (25, duplicada de Hembrillas), Portaleds (24, duplicada de Portaled) y Potenciómetros y reóstatos (26, duplicada de Reostatos y potenciómetros bobinados). | Descartar (410/301 a la familia correcta) y no regenerarlas; 5 de ellas tienen traducción (24, 26, 39, 46, 50) y también se retiran. | translation_matrix.product_categories[] con product_count 0; seo.sitemap_issues.es_categories_live_not_in_sitemap |
| F-D04 | media | **Tres fichas con el mismo nombre 'Reostatos y potenciometros bobinados'** | Fichas 904, 905 y 909 (slugs reostatos-y-potenciometros-bobinados, -2, -6); 905 y 909 sólo cuelgan de 'Sin categorizar' (REST product_cat = [18]). Ficha 878 'Fabricaciones a medida' también. | Diferenciar nombres o fusionar tras revisión (propuesta para el admin, no se decide aquí). | data/raw/rest/product.es.json (product_cat); data/analysis/product-map.json |
| F-D05 | media | **Plantillas Elementor indexables que duplican la portada** | /elementor-hf/header/ y /elementor-hf/footer-blog/ responden con body 'home', mismo H1 que la portada, canonical a otra URL ES y están en elementor-hf-sitemap. | No migrar: 410. | data/raw/sitemaps/elementor-hf-sitemap.xml; data/analysis/pages/es/elementor-hf__header.json |
| F-D06 | baja | **Archivos de categoría de blog duplican el índice** | /category/blog/ (22 entradas según REST) y /category/sin-categorizar/ (0) existen en los 4 idiomas; /category/blog/ pagina igual que /blog/. El canonical DE de sin-categorizar apunta a otro idioma. | 301 a /blog/ (y /blog/page/N/). | data/raw/rest/categories.*.json; data/raw/html/*/category__*.html |

### 8.2 Huérfanos

| ID | Sev. | Hallazgo | Detalle | Recomendación | Evidencia |
|---|---|---|---|---|---|
| F-H01 | media | **Contenido que sólo existe en EN/FR/DE** | EN: entrada 8196 'What is a Voltage Variator?', páginas WooCommerce tienda/finalizar-compra/mi-cuenta, categoría 2x3W. FR: ficha 4323 'Equipos de sobremesa' y categoría 2x3W. DE: categoría 2x3W. Ninguno tiene par ES por hreflang. | La entrada EN 8196 requiere decisión de contenido (traducir a ES o descartar); el resto se descarta. | orphans.by_language; data/analysis/coverage.json translated_products_without_es_match |

### 8.3 Navegación e ia

| ID | Sev. | Hallazgo | Detalle | Recomendación | Evidencia |
|---|---|---|---|---|---|
| F-N01 | alta | **/productos/ omite 'Equipos electrónicos' (11 fichas) en los 4 idiomas** | /productos/ lista 11 familias (65 fichas sumando sus contadores); 'Equipos electrónicos' (control industrial, convertidores, energías renovables, fuentes CA/CC) sólo aparece en la barra lateral y en /shop/; la REST da count 0 para esa rama. La rejilla de la portada (10 mosaicos) tampoco incluye Hembrillas ni Equipos electrónicos. | Listar las 12 familias en /productos/ y en la portada, o decidir expresamente ocultar la rama (confirmar con Torivac). | data/analysis/pages/*/productos.json outline; nav_menus.es.floating_sidebar; data/analysis/product-map.json |
| F-N02 | media | **Cuatro fichas sin ruta de navegación desde /productos/** | 909, 905 y 878 sólo cuelgan de 'Sin categorizar' (REST product_cat=[18]) y la 155 'Tapas para botones BM mate' de la categoría raíz 'Botones de mando y accesorios' (27); ninguna de esas dos categorías aparece en /productos/ ni en la barra lateral (sí en /shop/). Con las 11 de 'Equipos electrónicos' son 15 de las 80 fichas ES que /productos/ no enlaza (65 sí). | Asignarles familia real en la web nueva (propuesta para el admin) y listar las 12 familias. | data/raw/rest/product.es.json (product_cat); data/analysis/product-map.json (distribución por categoría raíz); data/analysis/pages/es/productos.json outline |
| F-N03 | media | **Menú plano y navegación de catálogo sólo en la barra lateral** | El menú principal tiene 7 entradas sin desplegables; las categorías sólo se navegan desde la barra lateral flotante de /productos/, /shop/, categorías y fichas (173 páginas en ES; el mismo patrón en EN/FR/DE). | Mantener 7 entradas; menú lateral fijo en todo el catálogo con las 12 familias (ya previsto en el plan). | nav_menus.*.header; nav_menus.*.floating_sidebar |
| F-N04 | baja | **Migas inconsistentes** | Primer enlace 'Productos' va a la portada en 38 categorías ES y a /productos/ en categorías-ficha y fichas. | Migas Inicio > Productos (/productos/) > familia > subfamilia, siempre al mismo destino. | nav_menus.es.breadcrumb |
| F-N05 | alta | **Pie EN/FR/DE enlaza a URLs ES y a /aviso-legal/** | El pie traducido enlaza /aviso-legal-2/, /politica-de-privacidad/ y /declaracion-de-accesibilidad/ (rutas ES) aunque existen versiones traducidas de privacidad y accesibilidad; el bloque tablet/móvil y el pie de las 21 entradas de blog enlazan a /aviso-legal/, que no figura en REST ni sitemap (no se verificó su código HTTP). | Pie por idioma con sus propias URLs; crear aviso legal EN y FR. | data/raw/html/en/en.html; data/raw/html/es/aplicaciones-de-los-transformadores-en-la-industria-actual.html |
| F-N06 | media | **Nombres de familia mal traducidos en /productos/** | FR 'Porté (4)' y DE 'Portiert (4)' para Portaled; DE 'Socket Jack (4)' para Hembrillas; contadores distintos para Variadores (ES 15, EN 12, FR 12, DE 11) por fichas sin traducir. | Glosario técnico de familias en los 4 idiomas (propuesta a validar). | data/analysis/pages/{fr,de}/*produits-torivac.json \| *torivac-produkte.json |
| F-N07 | media | **Blog paginado en 3 páginas, no cosechadas** | 21 entradas en 3 páginas de 10 (/blog/page/2/ y /blog/page/3/ enlazadas en el HTML, no cosechadas); /blog/ muestra un contador 'Do you like it?' con 0 y meta description '%'. | Conservar las mismas URLs de paginación (o un listado completo) y quitar el contador. | data/raw/html/es/blog.html |
| F-N08 | media | **Selector de idioma sin retroceso** | Sólo ofrece los idiomas con traducción (se verificó en el HTML: selector incompleto en 17 páginas ES, 8 EN, 3 FR y 2 DE), por ejemplo categorías vacías que existen sólo en ES y fichas sin traducir como /product/fuente-de-corriente-alterna-sinusoidal/. | Selector con retroceso a la portada del idioma o a /productos/. | nav_menus.*.language_switcher |

### 8.4 SEO, canonical, hreflang y sitemap

| ID | Sev. | Hallazgo | Detalle | Recomendación | Evidencia |
|---|---|---|---|---|---|
| F-C01 | alta | **Canonicals cruzados entre idiomas** | EN /en/ canonical /de/; EN contacto canonical /de/kontakt-us/; FR /fr/produits-torivac/ y DE /de/torivac-produkte/ canonical /en/torivac-products/; cookies EN/FR/DE canonical a la URL ES. | Auto-canonical por idioma + hreflang recíproco completo. | seo.canonical_issues |
| F-C02 | alta | **54 de 75 fichas EN, 54 de 76 FR y 53 de 74 DE tienen canonical ES** | Google puede ignorar las versiones traducidas. | Auto-canonical en cada ficha traducida. | seo.canonical_issues.summary |
| F-C03 | media | **Sitemap sólo con URLs ES** | 201 URLs únicas (197 ES + 4 EN); FR y DE ausentes; cada URL ES se repite hasta 4 veces; product-sitemap incluye /shop/ y ?post_type=product&p=875. | Un sitemap por idioma sin duplicados y con hreflang. | seo.sitemap_issues |
| F-C04 | media | **Metadatos erróneos** | Título SEO 'Grupor Torivac' en 7 páginas (empresa/proyectos en 4 idiomas, salvo ES-proyectos) y meta description '%' en 38 páginas. | Corregir y revisar title/description por página. | slug_issues.SI-07 |
| F-C05 | media | **Política de cookies sin contenido en la copia** | Complianz inyecta el texto por JS: el HTML sólo tiene banner y pie (408-572 caracteres) en los 4 idiomas. | Recuperar el texto original antes de migrar. | gaps.G-01 |

### 8.5 Slugs mal traducidos, erratas y ambigüedades

| ID | Alcance | Elementos | Gravedad | Descripción | Recomendación |
|---|---|---:|---|---|---|
| SI-01 | blog_post | 63 | media | Las 21 entradas de blog conservan el slug español en las URLs EN/FR/DE (p. ej. /en/como-extender-la-vida-util-de-un-transformador/) aunque el título y el contenido están traducidos. | Mantener estas URLs idénticas (ya están publicadas y declaradas por hreflang). Si se quieren slugs traducidos, hacerlo en la web nueva con 301 desde la URL actual. |
| SI-02 | page | 7 | media | Políticas de cookies y declaración de accesibilidad repiten el slug español en EN/FR/DE; el aviso legal DE también (aviso-legal-2). El resto de páginas sí tienen slug traducido. | Mantener (URLs publicadas). El slug "blog" es común a los 4 idiomas y no es incidencia. |
| SI-03 | product | 117 | media | Aprox. la mitad de las fichas traducidas conserva el slug ES (EN 39 de 75, FR 37 de 75, DE 41 de 74). Las demás sí llevan slug traducido, por lo que el patrón es incoherente dentro de un mismo idioma. | No cambiar en la migración (se conservan idénticas); documentar el criterio y corregir en una segunda fase con 301. |
| SI-04 | product_category | 16 | baja | Categorías cuyo último segmento coincide con el ES en el idioma traducido (p. ej. comunicacion-modbus, portaleds, y los hijos "monofasico-serie-bavs" bajo rutas EN). | Conservar. |
| SI-05 | product/page/category | 44 | media | Slugs con sufijo -N por colisión de nombre (p. ej. /product/serie-avs-2/, /product/reostatos-y-potenciometros-bobinados-6/, /aviso-legal-2/, EN benchtop-units-2): el slug no describe el contenido y parece URL duplicada. | Conservar las URLs indexadas tal cual; en la web nueva usar slug descriptivo en un campo aparte sólo si se acuerda redirección 301 desde la antigua. |
| SI-06 | varios | 17 | alta | Errores de traducción, mezclas de idioma, erratas y ambigüedades detectadas en slugs y etiquetas (lista curada a partir de las rutas reales). | Para SEO se conservan las URLs; los textos/etiquetas visibles se corrigen en la web nueva. Lo que implique terminología técnica (inverter vs variador) queda como propuesta a validar por Torivac. |
| SI-07 | page | 45 | media | Errata en título SEO "Grupor Torivac" (7 páginas: empresa y proyectos, en los 4 idiomas; sólo ES-proyectos está bien escrito) y meta description literal "%" en 38 páginas (ES 9, EN 12, FR 8, DE 9). | Corregir en la web nueva (título "Grupo Torivac"). |

Detalle de SI-06 (lista curada, revisada contra las rutas reales):

| Idioma | Dónde | Slug / URL | Problema |
|---|---|---|---|
| es | categoría 28 "Fabricación a medida" | `fabricacion-a-media` | Errata: "a-media" en lugar de "a-medida" (el producto que sirve se llama a-medida-2). |
| es | categoría 45 "Equipos de sobremesa" | `en-caja` | El slug "en-caja" no coincide con el nombre ("Equipos de sobremesa"); existen además "en-caja-resistencias", "variador-de-tension-en-caja" y el producto /product/en-caja/ (sin relación con resistencias). |
| es | página inicio (REST id 13947) | `grupo-torivac-inicio` | Slug interno "grupo-torivac-inicio" para la portada (la URL pública es /); sólo relevante si se reutiliza REST. |
| es | página 1109 | `aviso-legal-2` | Sufijo -2: el slug "aviso-legal" está ocupado por otro elemento; los pies (bloque tablet/móvil) enlazan a /aviso-legal/ que no figura en REST ni sitemap. |
| es/en/fr/de | página "Proyectos" | `proyectos-empresariales \| entrepreneurial-projects \| projets-cles-en-main \| schluesselfertige-projekte` | El H1 ES dice "Proyectos llave en mano"; FR y DE usan slug "llave en mano / schlüsselfertig" pero la etiqueta de menú dice "Projets entrepreneuriaux / Unternehmerische Projekte"; ES y EN usan "empresariales / entrepreneurial". Tres términos distintos para la misma página. |
| de | página 15742 contacto | `kontakt-us` | Slug mezcla alemán e inglés ("kontakt-us"); es además el canonical de la página EN de contacto. |
| en | categoría 543 (Manual, hija de "Single Phase Inverters") | `trifasicos-manual` | Slug en español y semánticamente contradictorio: "trifásicos" (trifásico) bajo la rama monofásica. |
| fr | productos 940 y 938 (Tapas serie BM / BO) | `la-serie-bm-couvre \| la-serie-bo-couvre` | "Tapas" traducido como verbo ("couvre" = cubre): debería ser "couvercles/capuchons". |
| de | productos 940 y 938 (Tapas serie BM / BO) | `bm-serie-umfasst \| bo-serie-umfasst` | "Tapas" traducido como verbo ("umfasst" = incluye): debería ser "Abdeckungen/Deckel". |
| fr | producto 951 (Carátulas graduadas) | `couvertures-classees` | "couvertures classées" no corresponde a "carátulas graduadas" (cadrans gradués). |
| de | producto 951 (Carátulas graduadas) | `abgestufte-bezuege` | "abgestufte Bezüge" no corresponde a "carátulas graduadas" (Skalenblenden / Gradskalen). |
| de | árbol de categorías DE | `bedieningsknoppen, hoepels-met-pijl, gegradueerde-covers, omslagen, pijlschijven, dubbele-variator, dubbele-handleiding, dubbele-motor, dubbele-potentiometers, ` | Numerosos slugs de categoría DE están en neerlandés (traducción automática equivocada), mezclados con alemán en la misma ruta. |
| fr | categorías FR (portaleds, hembrillas) | `portail, porte-10-mm, led-portique-3-mm, led-portale-5-mm, prise-jack` | "Portaled" traducido como "portail" (portal/puerta) y "hembrilla" como "prise jack": términos inexactos para portaleds y hembrillas de seguridad. |
| en/fr/de | ramas de variadores monofásicos/trifásicos | `single-phase-inverters \| three-phase-drives \| onduleurs-monophases \| entrainements-triphases \| einphasen-wechselrichter \| dreiphasige-antriebe` | "Variador de tensión" (autotransformador regulable) vertido como inverter/drive/Wechselrichter/onduleur: término técnico distinto (convertidor/inversor). Revisar con glosario técnico; marcar como propuesta, no corregir sin validación. |
| fr/de | productos de reóstatos | `rheostats-et-potentiometres-… (FR), rheostate-und-potentiometer-… (DE)` | FR usa "rheostats" (inglés) en lugar de "rhéostats" en la URL; ES conserva "reostatos" sin traducir en 2-3 fichas por idioma. |
| en | productos 951 vs categoría 82 | `graded-covers (producto) vs graduated-covers (categoría)` | El mismo concepto "carátulas graduadas" tiene dos traducciones distintas entre ficha y categoría. |
| es | productos 904, 905, 909 | `reostatos-y-potenciometros-bobinados \| -2 \| -6` | Tres fichas con el mismo nombre "Reostatos y potenciometros bobinados" (textos similares al 74-79 %); dos de ellas están en la categoría "Sin categorizar". |

Notas: (a) los slugs con sufijo numérico (`-2`, `-6`…) existen en 39 fichas ES y 1 página (`aviso-legal-2`) por colisión al duplicar; forman parte de la URL pública y no se cambian sin 301. (b) Los términos técnicos (variador de tensión vs inverter/drive/Wechselrichter/onduleur) deben validarse con Torivac antes de corregirse.

## 9. Páginas de utilidad que no se migran

El pedido pasa a presupuesto por cantidades, así que no se migran las páginas de la tienda. Carrito, finalizar compra y mi cuenta llevan `noindex`; `/en/tienda/` y `/shop/` se indexan.

| Página | URLs | Decisión | Sustituto / destino 301 |
|---|---|---|---|
| Carrito WooCommerce | `/confirmar/`, `/en/carrito/` | no migrar | Lista de presupuesto (cantidades por referencia -> PDF + email). → `página de presupuesto del idioma` |
| Finalizar compra | `/en/finalizar-compra/` | no migrar | No hay pago online: catálogo sin precios (Store API: prices.price="0", is_purchasable=false en 80/80 productos ES). → `página de presupuesto` |
| Mi cuenta | `/en/mi-cuenta/` | no migrar | Ninguno público (el área de cliente/administración es un módulo aparte del proyecto). → `portada del idioma` |
| Página "Tienda" (EN) | `/en/tienda/` | no migrar | /productos/ (torivac-products) → `/en/torivac-products/` |
| Archivo de productos /shop/ (ES) | `/shop/` | no migrar | /productos/ → `/productos/` |
| Banner de cookies Complianz + política dinámica | `/politica-de-cookies/`, `/en/politica-de-cookies/`, `/fr/politica-de-cookies/`, `/de/politica-de-cookies/` | reemplazar | Banner propio + política de cookies redactada (contenido a recuperar). → `—` |
| Archivos de categoría de blog | `/category/blog/`, `/category/sin-categorizar/`, `/en/category/blog/`, `/en/category/uncategorized/`, `/fr/category/blog/`, `/fr/category/non-classifiee/`, `/de/category/blog/`, `/de/category/unkategorisiert/` | no migrar | /blog/ → `/blog/ del idioma` |
| Plantillas Elementor header/footer expuestas | `/elementor-hf/footer-blog/`, `/elementor-hf/header/` | descartar |  → `desindexar (410 o noindex)` |
| Archivo de autor | `/author/francoadm/` | descartar |  → `410 / noindex` |
| Selector de idioma WPML (ítems de menú) |  | reemplazar | Selector de idioma nuevo (manual + detección). → `—` |

Componentes que no se migran tal cual: selector de orden de WooCommerce (`form.woocommerce-ordering` en 4 categorías por idioma; sustituido por orden fijo o filtros por voltaje/potencia), búsqueda de WordPress (se reemplaza por un buscador JS sobre el índice de productos) y los formularios WPForms (se reimplementan con envío por email conservando campos y consentimiento RGPD).

Otras URLs técnicas descartables: `/elementor-hf/header/` y `/elementor-hf/footer-blog/` (410), `/author/francoadm/` (410; expone el usuario de WordPress), `/category/blog/` y `/category/sin-categorizar/` en los 4 idiomas (301 a `/blog/`).

## 10. Recomendaciones para la web nueva

### 10.1 Mantener, unificar y descartar

| Ámbito | Decisión | Detalle |
|---|---|---|
| páginas de contenido (empresa, proyectos, contacto, blog, productos) | **mantener** | Migrar con el mismo contenido y slugs; 4 idiomas. |
| fichas de producto | **mantener** | 80 ES / 75 EN / 76 FR / 74 DE; completar las 5-6 sin traducción como propuesta (no inventar). |
| categorías con archivo real | **mantener** | 38 ES (+29 EN/FR, +30 DE) con migas y barra lateral. |
| categorías hoja que sirven la ficha | **unificar** | 53 URLs por idioma -> 301 a la ficha (ya es la canónica). |
| categorías vacías y duplicadas | **unificar/descartar** | IDs ES 31, 32, 36, 47, 49, 102, 25 (+ 24, 26, 39, 46 duplicados con traducciones) sin productos. |
| tres fichas "Reostatos y potenciometros bobinados" con el mismo nombre | **unificar** | IDs 904/905/909: diferenciar nombre o fusionar tras revisión. |
| WooCommerce (carrito, finalizar compra, mi cuenta, tienda, /shop/) | **descartar** | El pedido pasa a presupuesto por cantidades; redirigir a /productos/ y a la página de presupuesto. |
| elementor-hf, author, categorías de blog | **descartar** | No son contenido; desindexar/redirigir. |
| canonicals, hreflang y sitemap | **rehacer** | Auto-canonical por idioma, hreflang recíprocos completos, un sitemap por idioma sin duplicados. |
| pie legal EN/FR/DE | **unificar** | Enlazar a la versión traducida (privacidad y cookies existen en los 4 idiomas); crear aviso legal EN/FR. |

### 10.2 IA propuesta

Propuesta derivada del análisis; no sustituye decisiones del cliente.

- Misma estructura de URLs que la web actual (mismo slug, mismo prefijo de idioma) salvo las 211 categorías-ficha y las páginas WooCommerce (ver seo.preserve_urls).
- ES en la raíz; EN/FR/DE bajo /en/ /fr/ /de/. Auto-canonical por idioma y hreflang recíproco en todas las páginas con traducción.
- Catálogo = 12 familias raíz (se añade 'Equipos electrónicos' a /productos/ y a la portada) con menú lateral fijo en todo el catálogo.
- Pedido por presupuesto: lista de presupuesto flotante + página de presupuesto nueva (sustituye carrito/finalizar compra/mi cuenta/tienda).

Cabecera: Inicio · Torivac Empresa · Productos · Proyectos comerciales Torivac · Catálogo (PDF por idioma) · Blog · Contacto; más selector de idioma con banderas y botón flotante de presupuesto.

Catálogo: las 12 familias raíz (las 11 de `/productos/` + Equipos electrónicos), con menú lateral fijo visible en todo el catálogo, filtros por categoría, etiqueta de voltaje y potencia, y botón "añadir a presupuesto" en cada ficha. Las categorías hoja de una sola ficha se resuelven en la propia ficha.

Páginas nuevas: una página de presupuesto (lista de referencias y cantidades, PDF y envío por email) que sustituye a carrito, finalizar compra, mi cuenta, tienda y `/shop/`. Su slug por idioma está por decidir.

Orden de trabajo recomendado:

1. Congelar la lista de URLs idénticas (sección 11) como contrato del generador: el build debe fallar si falta alguna.
2. Generar redirecciones 301 desde `seo.preserve_urls` (227 entradas) y 410 para las técnicas.
3. Auto-canonical y hreflang recíproco completo desde el primer despliegue; sitemap por idioma sin duplicados.
4. Resolver las decisiones abiertas con Torivac: visibilidad de Equipos electrónicos, aviso legal EN/FR, fichas sin traducir, artículo EN huérfano, glosario técnico de familias.

## 11. URLs que deben conservarse idénticas

Criterio: **tier 1** = URLs ES indexadas (sitemap de Yoast) y catálogo PDF del menú; **tier 2** = URLs traducidas declaradas por hreflang, PDFs de ficha y categorías ES vivas fuera del sitemap; **tier 3** = técnicas o legadas (se redirigen o descartan). La lista completa de 848 URLs con acción, tier y destino está en `site-structure.json` → `seo.preserve_urls.urls`; aquí se resume y se listan las de tier 1.

| Tier | Acción | URLs |
|---:|---|---:|
| 3 | descartar_410 | 3 |
| 1 | mantener_identica | 142 |
| 2 | mantener_identica | 471 |
| 1 | redirigir_301 | 53 |
| 2 | redirigir_301 | 158 |
| 3 | redirigir_301 | 16 |
| 3 | revisar | 1 |
| 3 | revisar_descartar | 4 |
| | **Total** | **848** (mantener 613 · 301 227) |

### 11.1 Conservar idénticas, por idioma y tipo

| Tipo | ES | EN | FR | DE |
|---|---:|---:|---:|---:|
| home | 1 | 1 | 1 | 1 |
| company | 1 | 1 | 1 | 1 |
| products_index | 1 | 1 | 1 | 1 |
| projects | 1 | 1 | 1 | 1 |
| blog_index | 1 | 1 | 1 | 1 |
| contact | 1 | 1 | 1 | 1 |
| legal_notice | 1 | 0 | 0 | 1 |
| privacy_policy | 1 | 1 | 1 | 1 |
| cookie_policy | 1 | 1 | 1 | 1 |
| accessibility_statement | 1 | 1 | 1 | 1 |
| blog_post | 21 | 21 | 21 | 21 |
| blog_pagination | 2 | 2 | 2 | 2 |
| product | 80 | 75 | 75 | 74 |
| product_category | 37 | 28 | 28 | 29 |
| PDFs enlazados (mismo `/wp-content/uploads/...`) | 56 | | | |

Las entradas EN incluyen la huérfana `/en/el-variador-de-tension-y-sus-funciones/` (tier 1 porque está en el sitemap). Las categorías por idioma excluyen las que se redirigen a la ficha (11.3) y las vacías.

### 11.2 Páginas estáticas y blog (4 idiomas)

Todas se conservan con su ruta actual (sección 7.1). Las 21 entradas se mantienen con el slug ES en los 4 idiomas (sección 7.2) y la paginación `/blog/page/2/`, `/blog/page/3/` en cada idioma.

### 11.3 Tier 1 en detalle (ES, mantener idénticas)

Fichas (80) y categorías con archivo real (26 en tier 1):

```
/product/variador-de-tension-portatil/
/product/resistencia-en-caja/
/product/resistencias-de-alta-potencia-cementadas/
/product/resistencias-helicoidales/
/product/resistencias-de-frenado/
/product/reostatos-y-potenciometros-bobinados-especiales/
/product/regulador-a-tiristores/
/product/sai-para-control-industrial/
/product/ondulador-para-fv-interconectada-de-350w-autoconsumo/
/product/reguladores-fotovoltaicos-torivac/
/product/ondulador-autonomo-para-instalaciones-fotovoltaicas-sin-conexion-a-red/
/product/ondulador-para-conexion-fotovoltaica-a-red/
/product/fuente-de-corriente-alterna-sinusoidal/
/product/fuente-de-alimentacion-de-300a/
/product/fuente-de-alimentacion-de-corriente-constante-150a/
/product/convertidores-y-variadores-de-frecuencia-para-ensayos/
/product/electronica/
/product/resistencias-de-puesta-a-tierra/
/product/resistencias-de-arranque/
/product/bancos-de-carga/
/product/hembrilla-de-seguridad-hsr4/
/product/hembrilla-de-seguridad-hr4/
/product/hembrilla-de-seguridad-hbs4/
/product/hembrilla-hb4/
/product/caratulas-graduadas-2/
/product/discos-con-flecha-2/
/product/cubretercas-2/
/product/estators-2/
/product/discos-graduados-2/
/product/aros-con-flecha-2/
/product/tapas-serie-bm-2/
/product/tapas-serie-bo-2/
/product/botones-de-mando-serie-bm-mate-2/
/product/botones-de-mando-serie-bo-con-linea-2/
/product/botones-de-mando-serie-bo-brillante-2/
/product/soporte-metalico-para-led-10mm-2/
/product/soporte-metalico-para-led-8mm-2/
/product/soporte-metalico-para-led-5mm-2/
/product/soporte-metalico-para-led-3mm-2/
/product/nucleos-toroidales/
/product/choques-inductancias-reactancias-toroidales/
/product/bobinas-para-electroimanes-3-2/
/product/bobinas-para-electroimanes/
/product/reostatos-y-potenciometros-bobinados-10-2/
/product/reostatos-y-potenciometros-bobinados-9-2/
/product/reostatos-y-potenciometros-bobinados-8-2/
/product/reostatos-y-potenciometros-bobinados-7/
/product/reostatos-y-potenciometros-bobinados-6/
/product/reostatos-y-potenciometros-bobinados-5/
/product/reostatos-y-potenciometros-bobinados-4/
/product/reostatos-y-potenciometros-bobinados-3/
/product/reostatos-y-potenciometros-bobinados-2/
/product/reostatos-y-potenciometros-bobinados/
/product/serie-bavs-3/
/product/serie-bavs-2/
/product/serie-avs-3/
/product/serie-avs-2/
/product/estabilizadores-de-tension/
/product/transformador-trifasico-2/
/product/transformadores-convencionales-encapsulados/
/product/transformador-convencional-estandar-2/
/product/serie-circuito-impreso-2/
/product/serie-encapsulada-2/
/product/transformadores-serie-tt/
/product/comunicacion-modbus-2/
/product/accesorios-de-regulacion/
/product/fabricaciones-a-medida/
/product/equipos-industriales-2/
/product/en-caja/
/product/monofasico-motorizado/
/product/monofasico-manual/
/product/variador-trifasico-motorizado/
/product/trifasico-manual/
/product/doble-manual/
/product/doble-motorizado/
/product/cuba-de-aceite-2/
/product/controlador-0-10vdc-2/
/product/botones-de-mando-2-2/
/product/a-medida-2/
/product/tapas-para-botones-bm-mate/
/categoria-producto/variadores-de-tension/accesorios-de-regulacion/
/categoria-producto/bobinas-encapsuladas/
/categoria-producto/botones-de-mando/
/categoria-producto/electronica/control-industrial/
/categoria-producto/electronica/energias-renovables/
/categoria-producto/variadores-de-tension/en-caja/
/categoria-producto/electronica/
/categoria-producto/estabilizadores-de-tension/
/categoria-producto/estabilizadores-de-tension/serie-avs/
/categoria-producto/electronica/fuentes-de-alimentacion-cc/
/categoria-producto/hembrillas/
/categoria-producto/portaled/
/categoria-producto/reostatos-y-potenciometros-bobinados/potenciometros/
/categoria-producto/reostatos-y-potenciometros-bobinados/ceramicos/
/categoria-producto/reostatos-y-potenciometros-bobinados/
/categoria-producto/resistencias/
/categoria-producto/estabilizadores-de-tension/serie-bavs/
/categoria-producto/reostatos-y-potenciometros-bobinados/potenciometros/simples/
/categoria-producto/sin-categorizar/
/categoria-producto/transformadores/transformador-convencional/
/categoria-producto/transformadores/
/categoria-producto/transformadores/transformadores-toroidales-transformadores/
/categoria-producto/variadores-de-tension/dobles/
/categoria-producto/variadores-de-tension/
/categoria-producto/variadores-de-tension/monofasico/
/categoria-producto/variadores-de-tension/trifasico/
```

Otras de tier 1:

```
/
/torivac-empresa/
/productos/
/proyectos-empresariales/
/blog/
/contacto/
/aviso-legal-2/
/politica-de-privacidad/
/politica-de-cookies/
/declaracion-de-accesibilidad/
/la-importancia-del-transformador-toroidal-en-la-industria/
/descargadores-de-bateria/
/estabilizadores-de-tension/
/estabilizadores-de-tension-con-cobre/
/torivac-en-beyond-catalonia/
/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/
/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/
/para-que-sirve-un-transformador-descubre-su-funcion-clave/
/materiales-de-un-transformador-clave-en-su-rendimiento/
/aplicaciones-de-los-transformadores-en-la-industria-actual/
/como-se-fabrica-un-transformador-proceso-y-calidad-europea/
/como-se-mejora-un-transformador-con-tecnicas-expertas/
/eficiencia-de-los-transformadores-clave-en-europa/
/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/
/limites-de-un-transformador-y-como-afectan-su-rendimiento/
/seguridad-en-el-uso-de-transformadores/
/funcionamiento-de-un-transformador-en-la-industria/
/impacto-medioambiental-de-los-transformadores-hoy/
/como-extender-la-vida-util-de-un-transformador/
/mantenimiento-de-transformadores-electricos/
/normativas-sobre-transformadores-electricos-en-europa/
/en/el-variador-de-tension-y-sus-funciones/
/wp-content/uploads/2024/10/Torivac_2024.pdf
/wp-content/uploads/2024/10/Torivac_2024_EN.pdf
/wp-content/uploads/2024/10/Torivac_2024_FR.pdf
/wp-content/uploads/2025/02/catalogue-torivac-DE.pdf
```

### 11.4 Redirecciones y descartes

| Origen | Destino | Motivo |
|---|---|---|
| 211 categorías-ficha (53 ES, 53 EN, 53 FR, 52 DE), p. ej. `/categoria-producto/bobinas-encapsuladas/cuadradas/` | su ficha, p. ej. `/product/bobinas-para-electroimanes-3-2/` | La categoría sirve el HTML de la ficha y ya declara canonical a ella. Destino por URL en `preserve_urls`. |
| `/shop/`, `/en/tienda/` | `/productos/` (traducido) | Archivo WooCommerce duplicado. |
| `/confirmar/`, `/en/carrito/`, `/en/finalizar-compra/`, `/en/mi-cuenta/` | página de presupuesto (por definir) | Tienda sin precios. |
| `/category/blog/`, `/category/sin-categorizar/` (x4) y `/category/blog/page/2|3/` | `/blog/` y `/blog/page/N/` | Duplican el índice del blog. |
| `/elementor-hf/header/`, `/elementor-hf/footer-blog/`, `/author/francoadm/` | 410 | Plantillas internas y archivo de autor. |
| Categorías 2x3W (`/en|fr|de/categoria-producto/2x3w/`), ficha FR `/fr/product/equipos-de-sobremesa-2/` | revisar / descartar | Sin par ES; la ficha FR es una categoría convertida en ficha. |
| `/categoria-producto/fabricaciones-a-medida-transformadores-toroidales/` | revisar / descartar | Categoría vacía con canonical a una ruta inexistente. |

Importante: no se conservan ni la URL fea `?post_type=product&p=875` ni `/aviso-legal/`: la primera sólo existe como canonical de la ficha FR huérfana y en el product-sitemap; la segunda se enlaza desde pies pero no figura en REST ni en sitemap, y no se verificó su respuesta HTTP.

## 12. Huecos y verificaciones pendientes

Nada de lo siguiente se ha inventado: queda como `null` o como propuesta.

| ID | Tema | Detalle |
|---|---|---|
| G-01 | Política de cookies | El HTML capturado de /politica-de-cookies/ (4 idiomas) sólo contiene banner Complianz y pie (408-572 caracteres); el texto se inyecta por JS. Contenido = null. |
| G-02 | Códigos HTTP reales | No se guardaron códigos de estado ni redirecciones. Que las URLs de categoría hoja "sirven" la ficha se deduce del HTML idéntico y de canonical/og:url; no se puede afirmar si es 301/302 o reescritura. Tampoco se verificó si /aviso-legal/ o /en/shop/ responden 404. |
| G-03 | Archivo de autor | /author/francoadm/ figura en author-sitemap.xml pero no se cosechó. |
| G-04 | Plantillas Elementor | La REST de elementor_library devolvió 401 (4 idiomas): no hay estructura interna de plantillas header/footer más allá del HTML renderizado. |
| G-05 | Menús WordPress | No hay export de menús ni de ubicaciones; la jerarquía se dedujo del HTML renderizado (nav#menu). Aparece plano (sin submenús). |
| G-06 | Resultados de búsqueda y paginación | No se cosecharon /?s=, feeds ni las páginas paginadas del blog: /blog/page/2/, /blog/page/3/ y /category/blog/page/2\|3/ (x4 idiomas, 16 URLs) están enlazadas en el HTML pero no existen en data/raw/html. Su contenido (entradas 11-21) se conoce por REST/sitemap, no por estas URLs. |
| G-07 | Indexación real | No hay datos de Search Console: la prioridad SEO (tiers) se basa en sitemap, canonical y hreflang, no en tráfico. |
| G-08 | Traducciones de categoría | La correspondencia ES->EN/FR/DE de 91 categorías se infirió con hreflang del archivo, traducción de la ficha servida y hermanos libres del padre (campo mapped_by). 7 emparejamientos FR/DE/EN están "cruzados" (sirven otra ficha) y son de confianza media. |
| G-09 | Fichas sin traducción | ES ids 16633, 977, 976, 974, 972 sin EN/FR/DE; id 326 sin DE. No se inventan traducciones; quedan como propuesta. |
| G-10 | Cobertura de /productos/ | /productos/ (4 idiomas) lista 11 familias y omite 'Equipos electrónicos' (11 fichas en ES) y 'Sin categorizar'; la barra lateral sí incluye 'Equipos electrónicos'. No se sabe si es intencionado (categoría oculta) o un olvido; la REST devuelve count 0 para esa rama aunque la Store API asigna fichas. |
| G-11 | Verificación de mapeos de categoría inferidos | 8 emparejamientos de categoría (FR/DE) se infirieron por eliminación o palabra clave del producto servido (mapped_by = parent-elimination / parent+served-product-keyword); revisar manualmente antes de generar redirecciones. |

## 13. Verificación independiente de este análisis

Tras generar el JSON se recalcularon con scripts propios (`python3 -I`) a partir de `pages-index.json`, `data/raw/sitemaps`, `data/raw/rest` y el HTML:

- Confirmado: 781 páginas HTML (208 ES / 194 EN / 190 FR / 189 DE) y reparto por plantilla por idioma.
- Confirmado: translation_matrix.pages/posts/products: 0 diferencias frente a hreflang de las páginas ES.
- Confirmado: Huérfanos EN 5 / FR 2 / DE 1 (recalculados).
- Confirmado: Sitemap: 201 URLs únicas (197 ES + 4 EN), product-sitemap 306 loc -> 82 únicas.
- Confirmado: Canonical de /en/ = /de/; canonical de FR/DE /productos/ = /en/torivac-products/; canonical de /en/contact/ = /de/kontakt-us/.
- Confirmado: Enlaces de pie a /aviso-legal/ (bloque tablet/móvil y pie de entradas de blog) y pie FR/DE/EN enlazando a las URL ES de privacidad/aviso legal/accesibilidad.
- Corregido: Selector de idioma: sí muestra banderas (antes decía 'sin banderas').
- Corregido: Enlaces externos del pie (Santiso Marketing) ya no llevan path '/'.
- Corregido: sitemap_issues ampliado: URL fea ?p=875 y /shop/ dentro de product-sitemap; 12 categorías ES vivas fuera del sitemap.

## 14. Fuentes

`data/analysis/pages-index.json` (781 páginas, `translation_groups` por hreflang) · `data/analysis/pages/<lang>/*.json` (menús, body_classes, outline, forms) · `data/raw/sitemaps/*` · `data/raw/rest/{pages,posts,categories,product,product_cat}.*.json` · `data/raw/store/products.*.json` · `data/analysis/{product-map,category-map,coverage}.json` · `data/raw/manifest.json` · capturas `data/raw/screens/home-*.png` y HTML en `data/raw/html/`.
