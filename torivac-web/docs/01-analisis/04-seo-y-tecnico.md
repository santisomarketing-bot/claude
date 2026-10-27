# 04 · SEO y técnico de grupotorivac.com

> Sesión 1 · Análisis profundo. Documento derivado de `data/analysis/seo-tech.json` (contiene el detalle completo: las 781 URLs con sus incidencias, formularios, plugins, tracking y política de URLs en formato máquina). Todo procede de las copias locales de `data/raw/` y `data/analysis/`; no se ha hecho ninguna petición de red ni se ha tocado la web original.

Cómo leerlo: cada afirmación lleva su fuente en el JSON (`clave`) o en el fichero local indicado. Los valores de contenido (títulos, textos de formulario, etiquetas) se dejan en su idioma original. «Aparente» significa medido sobre el HTML, sin renderizar ni cargar la web viva.

## 1. Resumen

- **Plataforma:** WordPress 7.1.3 + WooCommerce 11.2.1 (catálogo sin precios) + Elementor 4.3.5 (la parte Pro cuelga del slug `pro-elements` 4.3.2) + tema Betheme 21.9.9 + Yoast SEO 28.7 + WPML 5.1.0 + Complianz 7.5.6 + WPForms 1.10.0.4 + W3 Total Cache. 13 componentes registrados (sección 9).
- **Alcance:** 781 páginas HTML (ES 208 · EN 194 · FR 190 · DE 189); 777 indexables y 4 `noindex` (carrito, finalizar compra, mi cuenta). 522 se mantienen con la misma ruta y 259 se redirigen, descartan o revisan.
- **Medición:** un único GA4 (`G-QXLKHV4Y7X`) y un único contenedor GTM (`GTM-K93FKL89`) en las 781 páginas; no hay Google Ads (AW-), Meta Pixel, LinkedIn, Hotjar ni otros píxeles en el HTML. Todas las páginas llevan la etiqueta de verificación de Search Console (la propiedad en sí no se ha podido comprobar). Google Ads, Meta Pixel y el perfil de Google Business no aparecen como ID en ningún sitio (sección 13).
- **Lo más grave (1 crítica y 6 altas):** GA4 y GTM cargan antes del consentimiento; el banner de cookies sale en español en EN/FR/DE y la política de cookies no tiene texto; el aviso legal tiene la denominación en blanco y no existe en EN/FR; **el 65 % de las páginas no tiene H1** (508 de 781); canonicals cruzados entre idiomas; el sitemap solo lista URLs en español.
- **Catálogo:** los 305 productos tienen precio `0` e `is_purchasable = false`; **no existe un botón «Solicitar presupuesto»** ni formulario de carrito: la única conversión es un formulario de contacto WPForms al pie de cada ficha. El flujo de presupuesto por cantidades es nuevo, no una migración.
- **Lo que está bien y se conserva:** metadatos de las fichas y entradas ES; hreflang coherente con `x-default` en 536 de 781 páginas; `robots` con `max-image-preview:large`; sitemap con imágenes; `llms.txt` declarado; slugs de página traducidos.
- **Qué reutilizar:** GA4 `G-QXLKHV4Y7X`, contenedor GTM `GTM-K93FKL89` (un solo snippet), la etiqueta `google-site-verification` de Search Console y los datos NAP del aviso legal. Para el dashboard de la Sesión 7 faltan los IDs numéricos de GA4, Search Console (tipo de propiedad), Google Ads y Business Profile (sección 13).
- **No se pudo verificar** (sin red): `robots.txt`, códigos HTTP y redirecciones, contenido del contenedor GTM, correo de destino de los formularios, rendimiento real (LCP/CLS) y accesibilidad con herramientas (sección 14).

## 2. Alcance y método

| Fuente | Qué se ha leído |
|---|---|
| `data/raw/html/<lang>/*.html` (781) | `<head>` completo (title, description, robots, canonical, hreflang, Open Graph, JSON-LD, generators), scripts y hojas CSS, banner Complianz, formularios, imágenes (`alt`, `loading`, dimensiones), encabezados, enlaces, landmarks |
| `data/analysis/pages/*/*.json` y `pages-index.json` | Texto limpio, menús, `tracking_ids`, `forms`; contraste cruzado con mi extracción (sección 15) |
| `data/raw/rest/*.json` | `yoast_head_json` y claves `meta` de páginas, entradas, productos y categorías |
| `data/raw/store/products.<lang>.json` | `add_to_cart`, `is_purchasable`, `prices`, stock, SKU |
| `data/raw/sitemaps/*.xml` | Índice y 7 sitemaps de Yoast |
| `data/analysis/site-structure.json` → `seo.preserve_urls` | Política de URLs (mantener, 301, 410, revisar) |
| `data/analysis/media-index.json` | Mediateca (formato, peso, `alt` por defecto) |

Umbrales orientativos: título 20–60 caracteres, descripción 70–160 (heurísticas de truncado de Google, no reglas). «Se mantiene» = acción `mantener_identica` de la política de URLs. Las cifras «todas» cuentan las 781 páginas, incluidas las categorías hoja que sirven el HTML de una ficha y se redirigen; las cifras «se mantienen» cuentan las 522 que existirán en la web nueva.

## 3. Problemas por gravedad

Total: 22 hallazgos (1 crítica, 6 altas, 11 medias, 2 bajas, 2 informativas). Gravedad = impacto en cumplimiento legal, visibilidad SEO o migración; es un criterio de este análisis, no una norma. Las referencias a `seo-tech.json` indican dónde está la evidencia.

### 3.1 Crítica

| ID | Área | Hallazgo | Evidencia | En la web nueva |
|---|---|---|---|---|
| T-01 | Consentimiento / RGPD | **GA4 y GTM se cargan antes del consentimiento.** gtag.js de GA4 (G-QXLKHV4Y7X) va en la primera línea del `<head>` de las 781 páginas, sin type="text/plain" ni data-category, y no existe gtag("consent","default"). El snippet GTM del `<head>` tampoco está bloqueado. Complianz está en modo opt-in (región UE) pero solo gobierna lo que lleva su marcado. | `data/raw/html/*/*.html (<head>)`, `tracking.ids_detected`, `cookie_consent.consent_gating_audit` | Cargar GA4/GTM solo tras aceptar estadísticas; implementar Consent Mode v2 (denied por defecto) en el banner propio. |

### 3.2 Alta

| ID | Área | Hallazgo | Evidencia | En la web nueva |
|---|---|---|---|---|
| T-02 | Consentimiento / RGPD | **reCAPTCHA, Google Fonts y Google Maps sin bloqueo ni mención en la política de privacidad.** google.com/recaptcha/api.js en 611 páginas, Google Fonts en 781 y el iframe de Google Maps en 4 (Contacto), sin data-service/data-category ni placeholder. Ninguna de las 4 políticas de privacidad cita GA, GTM, reCAPTCHA ni Maps (el aviso legal solo trae un párrafo genérico de cookies donde Google figura como responsable del tratamiento de la IP). | `cookie_consent.consent_gating_audit`, `legal_pages.issues` | Autoalojar fuentes; usar Cloudflare Turnstile en el Worker de formularios; mapa con carga bajo clic o consentimiento; actualizar la política. |
| T-03 | Consentimiento / RGPD | **Banner de cookies en español en EN/FR/DE y política de cookies vacía.** Mensaje, botones y categorías del banner salen en español en las páginas en inglés, francés y alemán; la política de cookies (4 idiomas) no tiene texto en el HTML y su canonical apunta a la versión española en EN/FR/DE. | `cookie_consent.by_language`, `cookie_consent.cookie_policy_note` | Banner propio traducido a 4 idiomas y política de cookies redactada con el inventario de cookies real. |
| T-04 | Legal | **Aviso legal incompleto, sin versión EN/FR y con enlaces a una URL inexistente.** «la ostenta: , con NIF: B60784584» (denominación en blanco). No hay aviso legal en inglés ni francés. El pie enlaza a /aviso-legal/ desde 595 páginas (680 enlaces); la URL no aparece en REST, sitemap ni cosecha. | `legal_pages`, `url_policy.additional_redirects_from_internal_links` | Completar los datos del titular, crear EN/FR y enlazar siempre a la versión del idioma; 301 de /aviso-legal/ a /aviso-legal-2/. |
| T-05 | SEO on-page | **El 65 % de las páginas no tiene H1.** 508 de 781 páginas sin H1 (solo 273 tienen uno): las 224 fichas EN/FR/DE, 158 categorías, 84 entradas de blog (título en h2), índices de blog y productos, contacto y todas las páginas legales. El primer encabezado de las fichas es un h3 «Productos» del panel lateral, no un h1. | `seo_by_url[*].h1_count`, `accessibility.headings` | Un único H1 por página con el título real; panel lateral sin encabezados jerárquicos. |
| T-06 | SEO técnico | **Canonicals cruzados entre idiomas y hacia la ficha.** 161 fichas EN/FR/DE declaran canonical en la ficha ES; 212 categorías declaran un canonical distinto de sí mismas (211 apuntan a la ficha que sirven, 1 a una ruta inexistente); la portada EN apunta a /de/, Contacto EN a /de/kontakt-us/, y las políticas de cookies EN/FR/DE a la URL ES. | `canonical_audit` | Canonical autorreferenciado en cada URL y hreflang recíproco (confirma F-C01/F-C02 de 01-estructura-sitio). |
| T-07 | SEO técnico | **Sitemap solo con URLs en español y con URLs que no deben indexarse.** 523 `<loc>` → 201 únicas (197 ES, 4 EN, 0 FR, 0 DE); 581 páginas indexables quedan fuera; lista 3 URLs noindex (carrito, confirmar, mi cuenta), el autor y las plantillas elementor-hf. | `robots_sitemap` | Un sitemap por idioma con hreflang y sin duplicados; llms.txt propio. |

### 3.3 Media

| ID | Área | Hallazgo | Evidencia | En la web nueva |
|---|---|---|---|---|
| T-08 | SEO on-page | **Meta descriptions ausentes o con el valor «%».** 119 páginas sin meta description (product_category 103, blog_category 8, blog_post 4, product_category_orphan 3, shop_archive 1) y 38 con el texto literal «%» (blog_index 4, privacy_policy 4, accessibility_statement 4, contact 4, cookie_policy 4, products_index 4, company 4, projects 3, woocommerce_page 3, legal_notice 2, cart 2). De las 522 URLs que se mantienen, 114 no tienen descripción utilizable. | `seo_by_url[*].flags DESC_AUSENTE / DESC_INVALIDA_PORCENTAJE` | Descripción única (70-160 caracteres) por URL y por idioma. |
| T-09 | SEO on-page | **Títulos genéricos, erratas y duplicados.** La portada de los 4 idiomas (y 2 plantillas) usa «Torivac» como único título (6 páginas); «Grupor Torivac» (errata) en 7; la entrada DE /de/estabilizadores-de-tension-con-cobre/ tiene como título el literal «%»; entre las URLs que se mantienen hay 11 grupos de título duplicado y 10 de descripción duplicada (p. ej. 3 fichas «Reostatos y potenciometros bobinados»). | `duplicates`, `seo_by_url[*].flags` | Títulos únicos con palabra clave principal; diferenciar las fichas de reóstatos. |
| T-10 | Datos estructurados | **JSON-LD mal tipado y sin Product ni LocalBusiness.** 45 páginas que no son entradas (portada, empresa, contacto, legales, índices) se marcan como Article/BlogPosting con autor «Franco Santiso»; ninguna ficha tiene Product; Organization solo lleva nombre, URL y logo 250×250, sin dirección, teléfono ni sameAs. | `json_ld` | Organization + LocalBusiness con NAP, WebSite por idioma, Product sin offers (catálogo) y BreadcrumbList; sin Person de agencia. |
| T-11 | SEO on-page | **Open Graph duplicado o inadecuado.** 85 entradas de blog emiten og:title/url/type/image/description dos veces (la descripción difiere); las 4 páginas de Contacto usan como og:image el spinner SVG de WPForms Lite; 175 páginas usan el logo de 250×250 px; og:description ausente en 38. | `seo_by_url[*].og` | Una sola serie OG por página con imagen 1200×630. |
| T-12 | Enlaces internos | **Enlaces internos a URLs que no existen en la cosecha.** Las migas de pan enlazan «Productos» a /en\|fr\|de/productos/ (slug español) desde 377 páginas; /aviso-legal/ desde 595; /en/contacto/ desde 1. Código HTTP no verificado. La paginación del blog (/blog/page/2\|3/ y /category/blog/page/2\|3/, 16 URLs) está enlazada pero no cosechada. | `url_policy.additional_redirects_from_internal_links` | Generar migas con la ruta real del idioma y añadir las redirecciones. |
| T-13 | Idioma y contenido | **Metadatos y formularios mal traducidos.** 14 páginas traducidas con title o descripción idénticos al español; 3 descripciones alemanas están en neerlandés; los formularios DE usan «Naam / E-mail / Bericht / Versturen / Hij gaat akkoord…» (neerlandés), el consentimiento EN enlaza «Legal Notice» y el FR dice «Il a accepté et accepté…». | `metadata_language`, `forms.wpforms[*].issues` | Revisión nativa de las cadenas de formulario y metadatos antes de publicar. |
| T-14 | Rendimiento | **Página pesada para ser un catálogo estático.** HTML mediano 211 kB (43 kB gzip), 48 scripts externos + 30 inline, 52 hojas CSS (≈97 kB de CSS inline), 4 scripts bloqueantes en `<head>` (jQuery, Migrate, shim FontAwesome, WP Ultimate Review). WooCommerce, jQuery UI y jPlayer se cargan en las 781 páginas sin uso aparente. | `performance` | HTML estático con CSS/JS mínimo y fuentes autoalojadas (LCP < 2 s en móvil). |
| T-15 | Rendimiento | **Imágenes: PNG, sin dimensiones y primera imagen diferida.** 10.677 de 14.644 `<img>` son PNG; 45,4 % sin width/height; 43,1 % sin loading=lazy (logo y banderas de la cabecera repetidos), pero la primera imagen de contenido va lazy en 291 de 304 fichas y 321 de 323 categorías con imagen. | `performance.images` | WebP/AVIF con width/height, srcset y fetchpriority en la imagen principal. |
| T-16 | Accesibilidad | **Sin `<main>`, sin enlace de salto y jerarquía de encabezados rota.** 0 páginas con `<main>` o enlace "saltar al contenido"; 629 páginas con saltos de nivel (p. ej. h1→h4); 6.120 enlaces y 3.124 botones sin nombre accesible; 2.525 campos sin `<label>`. | `accessibility` | Landmarks, skip link, etiquetas visibles y foco visible (AA). |
| T-17 | Accesibilidad | **Texto alternativo vacío en imágenes informativas.** 6.240 imágenes (42,6 %) con alt="" —incluidos los logotipos europeos del pie (1.190 apariciones) y el logo— y 4 sin atributo alt; el 91 % de la mediateca tiene alt vacío. | `accessibility.images`, `performance.media_library` | alt obligatorio en el esquema de datos (regla de whynot-sites). |
| T-18 | Accesibilidad / Legal | **La declaración de accesibilidad afirma 100 % de conformidad.** Contradice los hallazgos estáticos y puede ser un riesgo reputacional/legal. | `accessibility.accessibility_statement` | Redactar la declaración tras auditar la web nueva. |

### 3.4 Baja

| ID | Área | Hallazgo | Evidencia | En la web nueva |
|---|---|---|---|---|
| T-19 | Seguridad / Mantenimiento | **Superficie expuesta y componentes heredados.** Enlace RSD a xmlrpc.php publicado en el `<head>`, REST pública, archivo de autor con el usuario «francoadm» en el sitemap, plantillas elementor-hf indexables, Betheme 21.9.9, Elementor Pro bajo el slug pro-elements, restos de Rank Math/WPForms Lite/mod_pagespeed. El JSON-LD publica además a una persona de la agencia como autor. | `wordpress_stack` | Dejar la web antigua sin tráfico tras la migración y redirigir; no replicar nada de esto. |
| T-20 | Contenido | **Datos de contacto: dominio de correo distinto al esperado.** La web publica info@torivac.com (Contacto, aviso legal, privacidad); el plan del proyecto asume info@grupotorivac.com y mzamora@torivac.com. No hay correo de destino del formulario visible (se configura en WPForms). | `forms.destination_email` | Confirmar buzones de destino con Torivac antes de enviar pruebas. |

### 3.5 Informativa

| ID | Área | Hallazgo | Evidencia | En la web nueva |
|---|---|---|---|---|
| T-21 | Catálogo | **Catálogo sin precios y sin botón de presupuesto.** Los 305 productos (80/75/76/74) tienen precio "0", is_purchasable=false y no hay botón «Solicitar presupuesto» ni form.cart: la única conversión es el formulario de contacto al pie de cada ficha. | `woocommerce` | El flujo de presupuesto por cantidades es nuevo, no una migración. |
| T-22 | Posicionamiento | **Fortalezas que conviene conservar.** Metadatos de entradas y fichas ES bien redactados; hreflang con x-default coherente en las páginas de contenido (536 de 781 sin ninguna incidencia); robots con max-image-preview:large; llms.txt declarado; etiqueta de verificación de Search Console presente; sitemap con imágenes; slugs traducidos en páginas. | `seo_by_url`, `robots_sitemap` | Replicar y mejorar. |

## 4. SEO on-page por idioma

### 4.1 Metadatos y canonical

| Indicador | ES | EN | FR | DE | Se mantienen (522) | Todas (781) |
|---|--:|--:|--:|--:|--:|--:|
| Páginas | 136 | 129 | 128 | 129 | **522** | 781 |
| Título = «Torivac» | 1 | 1 | 1 | 1 | **4** | 6 |
| Título con «Grupor» | 1 | 2 | 2 | 2 | **7** | 7 |
| Título = «%» | 0 | 0 | 0 | 1 | **1** | 1 |
| Título > 60 car. | 13 | 10 | 21 | 16 | **60** | 79 |
| Título < 20 car. | 5 | 8 | 7 | 7 | **27** | 53 |
| Título duplicado* | 5 | 8 | 8 | 8 | **29** | 29 |
| Sin meta description | 8 | 24 | 24 | 25 | **81** | 119 |
| Description = «%» | 8 | 8 | 8 | 9 | **33** | 38 |
| Description > 160 car. | 4 | 2 | 15 | 12 | **33** | 43 |
| Description duplicada* | 6 | 6 | 4 | 4 | **20** | 20 |
| Sin H1 | 28 | 103 | 102 | 102 | **335** | 508 |
| Canonical a otro idioma | 0 | 58 | 56 | 55 | **169** | 282 |
| Canonical a otra URL | 0 | 0 | 0 | 0 | **0** | 105 |
| Indexable fuera de sitemap | 0 | 128 | 128 | 129 | **385** | 581 |
| Open Graph duplicado | 21 | 22 | 21 | 21 | **85** | 85 |
| Metadatos iguales al ES | 0 | 3 | 1 | 2 | **6** | 14 |
| Description en neerlandés | 0 | 0 | 0 | 2 | **2** | 3 |

\* Duplicados calculados solo entre las URLs que se mantienen, por idioma. En las 781 páginas hay 223 títulos repetidos que afectan a 464 páginas, casi todos por las categorías hoja que sirven el HTML de la ficha (se redirigen).

Longitudes (todas las páginas, fuente: `seo_by_url[*].title_len / meta_description_len`): los títulos van de 1 a 88 caracteres (mediana 36) y las 624 descripciones válidas de 71 a 258 (mediana 132). La portada de los 4 idiomas se titula solo «Torivac» y la descripción de la portada ES (216 caracteres) excede los 160. La entrada DE `/de/estabilizadores-de-tension-con-cobre/` tiene como título el literal «%».

### 4.2 Por tipo de página

| Tipo | ES/EN/FR/DE | Con H1 | Sin descripción útil | Canonical ≠ propia | En sitemap | Acción de migración |
|---|--:|--:|--:|--:|--:|---|
| Categoría de producto | 91/81/81/81 | 176/334 | 103 | 212 | 79 | redirigir 301 215, mantener idéntica 95, revisar / descartar 24 |
| Ficha de producto | 80/75/75/74 | 80/304 | 0 | 161 | 80 | mantener idéntica 304 |
| Entrada de blog | 21/21/21/21 | 0/84 | 4 | 0 | 21 | mantener idéntica 84 |
| Archivo de categoría de blog | 2/2/2/2 | 0/8 | 8 | 1 | 1 | redirigir 301 8 |
| Declaración de accesibilidad | 1/1/1/1 | 0/4 | 4 | 0 | 1 | mantener idéntica 4 |
| Índice del blog | 1/1/1/1 | 0/4 | 4 | 0 | 1 | mantener idéntica 4 |
| Torivac Empresa | 1/1/1/1 | 4/4 | 4 | 0 | 1 | mantener idéntica 4 |
| Contacto | 1/1/1/1 | 0/4 | 4 | 1 | 1 | mantener idéntica 4 |
| Política de cookies | 1/1/1/1 | 0/4 | 4 | 3 | 1 | mantener idéntica 4 |
| Portada | 1/1/1/1 | 4/4 | 0 | 1 | 1 | mantener idéntica 4 |
| Política de privacidad | 1/1/1/1 | 0/4 | 4 | 0 | 1 | mantener idéntica 4 |
| Índice de productos | 1/1/1/1 | 0/4 | 4 | 2 | 1 | mantener idéntica 4 |
| Proyectos comerciales | 1/1/1/1 | 4/4 | 3 | 0 | 1 | mantener idéntica 4 |
| Categoría huérfana (2x3W) | 0/1/1/1 | 3/3 | 3 | 0 | 0 | revisar / descartar 3 |
| Página WooCommerce | 0/3/0/0 | 0/3 | 3 | 1 | 2 | redirigir 301 3 |
| Carrito WooCommerce | 1/1/0/0 | 0/2 | 2 | 1 | 2 | redirigir 301 2 |
| Plantilla Elementor | 2/0/0/0 | 2/2 | 0 | 2 | 2 | descartar (410) 2 |
| Aviso legal | 1/0/0/1 | 0/2 | 2 | 0 | 1 | mantener idéntica 2 |
| Entrada huérfana (EN) | 0/1/0/0 | 0/1 | 0 | 1 | 1 | mantener idéntica 1 |
| Ficha huérfana (FR) | 0/0/1/0 | 0/1 | 0 | 1 | 0 | revisar 1 |
| Archivo /shop/ | 1/0/0/0 | 0/1 | 1 | 1 | 1 | redirigir 301 1 |

«Sin descripción útil» = ausente o con el valor `%`.

### 4.3 Encabezados (H1–H4)

- **508 páginas sin H1, 273 con uno y ninguna con varios.** Tienen H1 la portada, Torivac Empresa y Proyectos (los 4 idiomas), las 80 fichas ES, 176 categorías (más 3 huérfanas) y las 2 plantillas Elementor. No tienen: las 224 fichas EN/FR/DE, 158 categorías, las 84 entradas (el título es un `h2`), el índice del blog, el índice de productos, Contacto y todas las páginas legales.
- **Causa en las fichas traducidas:** En las 224 fichas EN/FR/DE el nombre del producto no se renderiza como encabezado en el cuerpo de la página (solo aparece en el `<title>`, en las migas de pan y en el panel lateral), mientras que las fichas ES lo muestran con h1.product_title. Causa exacta desconocida: la REST de plantillas Elementor devolvió 401. El primer encabezado de esas páginas es el h3 «Productos» del panel lateral flotante.
- **629 páginas saltan niveles** (p. ej. h1 → h4 en la portada). Patrón de ficha ES: h3 «Productos» (panel lateral) → h1 título → h4 «CONTACTA CON NOSOTROS» → h2 CTA → h2 «Explora productos similares» → h4 tarjetas.
- 636 páginas empiezan por un encabezado que no es H1.
- `seo_by_url[*].h1` conserva el H1 actual de cada URL que lo tiene, para reutilizarlo como `seo.h1` en la web nueva cuando sea correcto.

### 4.4 Duplicados entre las URLs que se mantienen

| Campo | Idioma | Nº | Valor | Tipos | URLs (máx. 3) |
|---|---|--:|---|---|---|
| Título | DE | 4 | Rheostate und Spulenpotentiometer - Torivac | Ficha de producto, Categoría de producto | /de/categoria-producto/rheostate-und-spulenpotentiometer/ · /de/product/reostatos-y-potenciometros-bobinados-2/ · /de/product/reostatos-y-potenciometros-bobinados-6/ |
| Título | EN | 4 | Rheostats and coiled potentiometers - Torivac | Ficha de producto, Categoría de producto | /en/categoria-producto/rheostats-and-coiled-potentiometers/ · /en/product/reostatos-y-potenciometros-bobinados-2/ · /en/product/reostatos-y-potenciometros-bobinados-6/ |
| Título | FR | 4 | Rhéostats et potentiomètres à boudin - Torivac | Ficha de producto, Categoría de producto | /fr/categoria-producto/rheostats-et-potentiometres-a-boudin/ · /fr/product/reostatos-y-potenciometros-bobinados-2/ · /fr/product/reostatos-y-potenciometros-bobinados-6/ |
| Título | ES | 3 | Reostatos y potenciometros bobinados - Torivac | Ficha de producto | /product/reostatos-y-potenciometros-bobinados-2/ · /product/reostatos-y-potenciometros-bobinados-6/ · /product/reostatos-y-potenciometros-bobinados/ |
| Título | DE | 2 | Spannungsstabilisatoren - Torivac | Ficha de producto, Categoría de producto | /de/categoria-producto/spannungsstabilisatoren/ · /de/product/estabilizadores-de-tension/ |
| Título | DE | 2 | Zubehör zum Regulieren - Torivac | Ficha de producto, Categoría de producto | /de/categoria-producto/spannungsregler-einstellbare-spartransformatoren/zubehor-zum-regulieren/ · /de/product/accesorios-de-regulacion/ |
| Título | EN | 2 | Regulating accessories - Torivac | Ficha de producto, Categoría de producto | /en/categoria-producto/voltage-variators-adjustable-autotransformers/regulating-accessories/ · /en/product/accesorios-de-regulacion/ |
| Título | EN | 2 | Voltage stabilizers - Torivac | Ficha de producto, Categoría de producto | /en/categoria-producto/voltage-stabilizers/ · /en/product/estabilizadores-de-tension/ |
| Título | ES | 2 | Estabilizadores de tensión - Torivac | Ficha de producto, Categoría de producto | /categoria-producto/estabilizadores-de-tension/ · /product/estabilizadores-de-tension/ |
| Título | FR | 2 | Accessoires de régulation - Torivac | Ficha de producto, Categoría de producto | /fr/categoria-producto/regulateurs-de-tension-autotransformateurs-reglables/accessoires-de-regulation/ · /fr/product/accesorios-de-regulacion/ |
| Título | FR | 2 | Stabilisateurs de tension - Torivac | Ficha de producto, Categoría de producto | /fr/categoria-producto/stabilisateurs-de-tension/ · /fr/product/estabilizadores-de-tension/ |
| Descripción | DE | 2 | Die Abdeckungen der BM-Serie sind matt und haben ein flaches Profil, d | Ficha de producto | /de/product/bm-serie-umfasst/ · /de/product/tapas-para-botones-bm-mate/ |
| Descripción | DE | 2 | Jeder Kunde ist einzigartig, und daher gibt es Nuancen oder Variatione | Ficha de producto | /de/product/a-medida-2/ · /de/product/fabricaciones-a-medida/ |
| Descripción | EN | 2 | A control knob is used to operate the shaft, which in turn allows rota | Ficha de producto | /en/product/manual-three-phase-inverter/ · /en/product/monofasico-manual/ |
| Descripción | EN | 2 | Each customer is unique, and therefore there are nuances or variations | Ficha de producto | /en/product/a-medida-2/ · /en/product/fabricaciones-a-medida/ |
| Descripción | EN | 2 | The caps corresponding to the BM series are matte, with a flat profile | Ficha de producto | /en/product/bm-series-covers/ · /en/product/tapas-para-botones-bm-mate/ |
| Descripción | ES | 2 | Cada cliente es único, y por lo tanto hay matices o variaciones de pro | Ficha de producto | /product/a-medida-2/ · /product/fabricaciones-a-medida/ |
| Descripción | ES | 2 | Las tapas correspondientes a la serie BM son mates, de perfil plano, l | Ficha de producto | /product/tapas-para-botones-bm-mate/ · /product/tapas-serie-bm-2/ |
| Descripción | ES | 2 | Mediante un botón de mando se actúa sobre el eje, este a su vez permit | Ficha de producto | /product/monofasico-manual/ · /product/trifasico-manual/ |
| Descripción | FR | 2 | L'axe est actionné au moyen d'un bouton de commande, qui permet à son  | Ficha de producto | /fr/product/monofasico-manual/ · /fr/product/onduleur-triphase-manuel/ |
| Descripción | FR | 2 | Les capuchons correspondant à la série BM sont mats, avec un profil pl | Ficha de producto | /fr/product/la-serie-bm-couvre/ · /fr/product/tapas-para-botones-bm-mate/ |
| H1 | ES | 3 | Reostatos y potenciometros bobinados | Ficha de producto | /product/reostatos-y-potenciometros-bobinados-2/ · /product/reostatos-y-potenciometros-bobinados-6/ · /product/reostatos-y-potenciometros-bobinados/ |
| H1 | ES | 2 | Estabilizadores de tensión | Ficha de producto, Categoría de producto | /categoria-producto/estabilizadores-de-tension/ · /product/estabilizadores-de-tension/ |

Patrón: las tres fichas «Reostatos y potenciometros bobinados» (`-2`, `-6` y la base) comparten título, H1 y descripción; en cada idioma la categoría y su ficha única comparten título (se resuelve al redirigir la categoría); y varias parejas de fichas copian la descripción (A medida / Fabricaciones a medida, Tapas BM, Variador monofásico/trifásico manual).

### 4.5 Idioma de los metadatos

- **14 páginas traducidas con título o descripción idénticos al español** (por ejemplo `/de/product/cuba-de-aceite-2/`, `/en/product/chokes-inductances-reactances-toroidal/`, la portada EN/FR/DE se titula igual que la ES).
- **3 descripciones de URLs alemanas están en neerlandés:** `/de/categoria-producto/spannungsregler-einstellbare-spartransformatoren/dubbele-variator/dubbele-motor/`, `/de/product/doble-motorizado/`, `/de/product/reostatos-y-potenciometros-bobinados-8-2/`.
- La entrada EN huérfana `/en/el-variador-de-tension-y-sus-funciones/` tiene la descripción en español.
- Cadenas mezcladas: DE: la etiqueta de la sección de contacto es «KONTAKT US» (mezcla alemán/inglés); FR: casilla «Il a accepté et accepté la politique de confidentialité»; DE: formularios con «Naam», «Bericht», «Versturen» (neerlandés). Placeholder del buscador «Busar» (errata) en las 781 páginas.
- El texto del banner de cookies sale en español en EN/FR/DE (sección 7.2).

### 4.6 Canonical y hreflang

| Idioma | Canonical propio | A otro idioma | A otra URL del mismo idioma | Con `?p=` |
|---|--:|--:|--:|--:|
| ES | 150 | 2 | 56 | 0 |
| EN | 82 | 95 | 17 | 0 |
| FR | 80 | 94 | 15 | 1 |
| DE | 81 | 91 | 17 | 0 |
| **Total** | **393** | **282** | **105** | **1** |

- 161 fichas EN/FR/DE (54/54/53) declaran canonical en la ficha ES; 212 categorías declaran un canonical distinto de sí mismas (211 hacia la ficha que sirven).
- Excepciones de contenido (`canonical_audit.other_exceptions`): portada EN → `/de/`; Contacto EN → `/de/kontakt-us/`; políticas de cookies EN/FR/DE → URL ES; índice de productos FR y DE → `/en/torivac-products/`; entrada EN huérfana y categoría de blog DE «unkategorisiert» → URL ES; `/confirmar/` → `/en/carrito/`; `/shop/` → `/en/shop/`; `/en/finalizar-compra/` → `/en/carrito/`; plantillas `elementor-hf` → portada `/`; ficha FR huérfana → `/?post_type=product&p=875`.
- **Yoast REST frente al HTML:** Coinciden en pages, posts y product (salvo 1 descripción con &nbsp; y las páginas WooCommerce con título «Carrito»). En product_cat difieren 52-53 categorías hoja por idioma: la REST describe la categoría (canonical propio) y el HTML sirve la ficha (canonical a la ficha).
- **hreflang:** 536 de 781 páginas sin ninguna incidencia. Las 215 incidencias de autorreferencia son las 211 categorías hoja (heredan el hreflang de la ficha) más 4 páginas técnicas; 115 no recíprocas (categorías cruzadas y el carrito). Sin `x-default`: 10 (huérfanas y WooCommerce). `x-default` = URL española.

| Idioma | Prefijo | `<html lang>` | `og:locale` | Páginas |
|---|---|---|---|--:|
| ES | / | es-ES, en-US | es_ES, en_US | 208 |
| EN | /en/ | en-US | en_US | 194 |
| FR | /fr/ | fr-FR | fr_FR | 190 |
| DE | /de/ | de-DE | de_DE | 189 |

La única anomalía de idioma es `/confirmar/` (carrito ES) con `lang="en-US"`.

### 4.7 Datos estructurados (JSON-LD)

Yoast emite un único bloque `@graph` por página (781 de 781 páginas), sin errores de sintaxis. No hay FAQ, HowTo, Video ni reseñas.

| Tipo de página | Páginas | Tipos del grafo (variante mayoritaria) |
|---|--:|---|
| Categoría de producto | 334 | BreadcrumbList, ImageObject, Organization, WebPage, WebSite |
| Ficha de producto | 304 | BreadcrumbList, ImageObject, Organization, WebPage, WebSite |
| Entrada de blog | 84 | Article, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Archivo de categoría de blog | 8 | BreadcrumbList, CollectionPage, ImageObject, Organization, WebSite |
| Portada | 4 | Article/BlogPosting, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Índice del blog | 4 | Article/BlogPosting, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Política de privacidad | 4 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Declaración de accesibilidad | 4 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Contacto | 4 | Article/BlogPosting, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Política de cookies | 4 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Proyectos comerciales | 4 | Article/BlogPosting, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Índice de productos | 4 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Torivac Empresa | 4 | Article/BlogPosting, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Categoría huérfana (2x3W) | 3 | BreadcrumbList, CollectionPage, Organization, WebSite |
| Página WooCommerce | 3 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Aviso legal | 2 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Carrito WooCommerce | 2 | Article/BlogPosting, BreadcrumbList, Organization, Person, WebPage, WebSite |
| Plantilla Elementor | 2 | Article/BlogPosting, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Entrada huérfana (EN) | 1 | Article, BreadcrumbList, ImageObject, Organization, Person, WebPage, WebSite |
| Archivo /shop/ | 1 | BreadcrumbList, CollectionPage, ImageObject, Organization, WebSite |
| Ficha huérfana (FR) | 1 | BreadcrumbList, ImageObject, Organization, WebPage, WebSite |

La tabla muestra la variante más frecuente de cada tipo; el resto (p. ej. con o sin `ImageObject`) está en `json_ld.types_by_page_type`.

- **45 páginas que no son entradas** (portada, empresa, proyectos, contacto, políticas, índices) se tipan como `Article`+`BlogPosting`, con autor/`Person` «Franco Santiso» (persona de la agencia) en el grafo de las 781 páginas.
- **Ninguna ficha tiene `Product`** (0). Tampoco `LocalBusiness`/`PostalAddress` (0).
- `Organization`: nombre «Torivac», alternateName «Torivac S.L», logo /wp-content/uploads/2025/02/Diseno-sin-titulo-73.png (250×250 px); sin `sameAs`, dirección, teléfono ni correo.
- `WebSite` con `SearchAction` hacia `https://grupotorivac.com/?s={search_term_string}`; descripción del sitio: «Especializados en diseño y fabricación de variados de tensión» (errata «variados»).
- `BreadcrumbList` en las 781; el último elemento no lleva `item` (válido). La portada solo tiene el elemento «Portada».
- El campo `json_ld_types` de data/analysis/pages/*/*.json está vacío ([null]) en las 781 páginas: usar este fichero.

### 4.8 Open Graph y Twitter

- `twitter:card = summary_large_image` y `og:site_name = Torivac` en las 781; `og:locale` coherente con el idioma salvo `/confirmar/`.
- **85 entradas de blog emiten dos series `og:*`** (title, url, type, image y description): la primera, al principio del `<head>`, con la primera frase del artículo como `og:description`; la segunda, de Yoast, con la meta description. La descripción difiere.
- Las 4 páginas de Contacto usan como `og:image` el SVG `submit-spin.svg` de WPForms Lite. 175 páginas (sobre todo categorías) usan el logo de 250×250 px como imagen social.
- Sin `og:description`: 38 páginas (categorías y archivos de blog).

### 4.9 Glosario de banderas de `seo_by_url[*].flags`

| Código | Significado | Se mantienen | Todas |
|---|---|--:|--:|
| `TITLE_SOLO_MARCA` | Título = «Torivac» (sin palabras clave) | 4 | 6 |
| `TITLE_INVALIDO_PORCENTAJE` | Título con el literal «%» | 1 | 1 |
| `TITLE_ERRATA_GRUPOR` | Título con la errata «Grupor Torivac» | 7 | 7 |
| `TITLE_LARGO` | Título > 60 caracteres | 60 | 79 |
| `TITLE_CORTO` | Título < 20 caracteres | 27 | 53 |
| `TITLE_DUPLICADO` | Título repetido en otra URL del mismo idioma (solo URLs que se mantienen) | 29 | 29 |
| `DESC_AUSENTE` | Sin meta description | 81 | 119 |
| `DESC_INVALIDA_PORCENTAJE` | Meta description con el valor literal «%» | 33 | 38 |
| `DESC_LARGA` | Descripción > 160 caracteres | 33 | 43 |
| `DESC_DUPLICADA` | Descripción repetida en otra URL del mismo idioma | 20 | 20 |
| `H1_AUSENTE` | Sin H1 | 335 | 508 |
| `CANONICAL_A_OTRO_IDIOMA` | Canonical hacia otro idioma | 169 | 282 |
| `CANONICAL_A_OTRA_URL` | Canonical hacia otra URL del mismo idioma | 0 | 105 |
| `CANONICAL_URL_CON_QUERY` | Canonical con parámetros (?p=) | 0 | 1 |
| `HREFLANG_AUTORREFERENCIA_NO_COINCIDE` | hreflang: la entrada de su idioma no es la propia URL | 0 | 215 |
| `HREFLANG_NO_RECIPROCO` | hreflang: algún destino no enlaza de vuelta | 3 | 115 |
| `HREFLANG_SIN_X_DEFAULT` | hreflang sin x-default | 1 | 10 |
| `HREFLANG_MENOS_DE_4_IDIOMAS` | hreflang con menos de 4 idiomas | 11 | 30 |
| `HREFLANG_URL_RELATIVA` | hreflang con URL relativa | 0 | 1 |
| `HREFLANG_SIN_AUTORREFERENCIA` | hreflang sin entrada de su propio idioma | 0 | 1 |
| `OG_ETIQUETAS_DUPLICADAS` | Etiquetas Open Graph repetidas | 85 | 85 |
| `OG_IMAGE_ES_ASSET_DE_PLUGIN` | og:image = asset de plugin (SVG) | 4 | 4 |
| `OG_IMAGE_LOGO_250PX_POR_DEFECTO` | og:image = logo 250×250 por defecto | 124 | 175 |
| `OG_DESCRIPTION_AUSENTE` | Sin og:description | 0 | 38 |
| `JSONLD_ARTICLE_EN_PAGINA_NO_ARTICULO` | JSON-LD Article/BlogPosting en una página que no es entrada | 38 | 45 |
| `INDEXABLE_FUERA_DE_SITEMAP` | Indexable y fuera de todos los sitemaps | 385 | 581 |
| `NOINDEX_DENTRO_DE_SITEMAP` | noindex pero listada en el sitemap | 0 | 3 |
| `NOINDEX` | robots noindex | 0 | 4 |
| `META_SIN_TRADUCIR_IDENTICA_A_ES` | Título o descripción idénticos al español | 6 | 14 |
| `META_EN_NEERLANDES` | Descripción en neerlandés | 2 | 3 |
| `HTML_LANG_NO_COINCIDE_CON_IDIOMA` | `<html lang>` distinto del idioma de la URL | 0 | 1 |
| `JERARQUIA_HEADINGS_SALTA_NIVELES` | Encabezados que saltan de nivel | 393 | 629 |
| `IMG_SIN_ATRIBUTO_ALT` | Imagen sin atributo alt | 2 | 4 |

## 5. Indexación: robots y sitemap

- **`robots.txt`: no disponible.** robots.txt no se cosechó (scripts/harvest.mjs solo descargó sitemap_index.xml y sus hijos). No se conocen sus reglas ni la línea Sitemap:. Comprobarlo antes del cambio de DNS.
- **Meta robots:** 777 páginas con `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` y 4 con `noindex, follow` (`/confirmar/`, `/en/carrito/`, `/en/finalizar-compra/`, `/en/mi-cuenta/`). Sin `X-Robots-Tag` conocido (no se guardaron cabeceras).
- **Generador:** Yoast SEO (XML con hoja de estilo main-sitemap.xsl) + comentario de W3 Total Cache. Índice: `/sitemap_index.xml` con 7 hijos.

| Sitemap | `<loc>` | URLs únicas | Por idioma | Entradas de imagen |
|---|--:|--:|---|--:|
| author-sitemap.xml | 1 | 1 | ES 1 | 0 |
| category-sitemap.xml | 1 | 1 | ES 1 | 0 |
| elementor-hf-sitemap.xml | 8 | 2 | ES 2 | 27 |
| page-sitemap.xml | 43 | 14 | EN 3, ES 11 | 143 |
| post-sitemap.xml | 85 | 22 | EN 1, ES 21 | 178 |
| product-sitemap.xml | 306 | 82 | ES 82 | 324 |
| product_cat-sitemap.xml | 79 | 79 | ES 79 | 2 |
| **Total** | **523** | **201** | ES 197, EN 4 |  |

- Yoast+WPML escribe cada URL ES hasta 4 veces: page 43→14, post 85→22, product 306→82, elementor-hf 8→2 (523 `<loc>` → 201 únicas).
- **581 de 777 páginas indexables no están en ningún sitemap** (FR 190, DE 189, EN 189, ES 13). Las traducciones solo se descubren por hreflang.
- Las 13 páginas ES fuera del sitemap son categorías vacías o duplicadas (`/categoria-producto/comunicacion-modbus/`, `/categoria-producto/controlador-0-10vdc/`, `/categoria-producto/equipos-de-sobremesa-en-caja/`, `/categoria-producto/equipos-de-sobremesa/`…) y `/category/sin-categorizar/`.
- URLs que no deben indexarse y sí están listadas: `/confirmar/`, `/en/carrito/`, `/en/mi-cuenta/` (noindex); `/?post_type=product&p=875`, `/author/francoadm/`, `/elementor-hf/footer-blog/`, `/elementor-hf/header/`, `/shop/`. Las URLs `/author/francoadm/` y `/?post_type=product&p=875` no se cosecharon.
- Los sitemaps incluyen entradas `<image:image>` (elementor-hf 27, page 143, post 178, product 324, product_cat 2); algunas son assets de plugin (submit-spin.svg de WPForms Lite).
- **llms.txt:** `<link rel="llms-sitemap" href="https://grupotorivac.com/llms.txt">` en las 781 páginas (función de Yoast); el contenido no se cosechó.

## 6. URLs que deben mantenerse o redirigirse con 301

Fuente: `data/analysis/site-structure.json` → `seo.preserve_urls` (la lista completa, copiada en `seo-tech.json` → `url_policy`). Comprobado: las 781 páginas cosechadas figuran en la política. Totales: **586 mantener idénticas · 237 redirigir 301 · 3 descartar 410 · 28 revisar/descartar** = 854.

| Acción | Tier | URLs |
|---|--:|--:|
| descartar (410) | 3 | 3 |
| mantener idéntica | 1 | 141 |
| mantener idéntica | 2 | 445 |
| redirigir 301 | 1 | 54 |
| redirigir 301 | 2 | 161 |
| redirigir 301 | 3 | 22 |
| revisar | 3 | 1 |
| revisar / descartar | 3 | 27 |

### 6.1 Se mantienen idénticas (misma ruta, mismo prefijo de idioma)

| Tipo | ES | EN | FR | DE | Total |
|---|--:|--:|--:|--:|--:|
| Ficha de producto | 80 | 75 | 75 | 74 | 304 |
| Categoría de producto | 25 | 23 | 23 | 24 | 95 |
| Entrada de blog | 21 | 21 | 21 | 21 | 84 |
| Paginación del blog | 2 | 2 | 2 | 2 | 8 |
| Política de cookies | 1 | 1 | 1 | 1 | 4 |
| Índice del blog | 1 | 1 | 1 | 1 | 4 |
| Portada | 1 | 1 | 1 | 1 | 4 |
| Torivac Empresa | 1 | 1 | 1 | 1 | 4 |
| Política de privacidad | 1 | 1 | 1 | 1 | 4 |
| Índice de productos | 1 | 1 | 1 | 1 | 4 |
| Proyectos comerciales | 1 | 1 | 1 | 1 | 4 |
| Declaración de accesibilidad | 1 | 1 | 1 | 1 | 4 |
| Contacto | 1 | 1 | 1 | 1 | 4 |
| Aviso legal | 1 |  |  | 1 | 2 |
| Entrada huérfana (EN) |  | 1 |  |  | 1 |
| **Total por idioma** | **138** | **131** | **130** | **131** | **530** |

El total por idioma (530) incluye 8 URLs de paginación del blog que no se cosecharon: las páginas cosechadas que se mantienen son 522.

Además se conservan **56 PDF** en su ruta `/wp-content/uploads/...` (catálogos por idioma y fichas técnicas). Catálogos del menú: ES `/wp-content/uploads/2024/10/Torivac_2024.pdf`, EN `…/Torivac_2024_EN.pdf`, FR `…/Torivac_2024_FR.pdf`, DE `/wp-content/uploads/2025/02/catalogue-torivac-DE.pdf`. La lista completa de rutas está en `url_policy.keep_identical`.

### 6.2 Redirecciones 301

| Tipo de origen | URLs | Ejemplo de origen | Destino del ejemplo |
|---|--:|---|---|
| Categoría de producto | 215 | `/categoria-producto/botones-de-mando/aros-con-flecha/` | `/product/aros-con-flecha-2/` |
| Archivo de categoría de blog | 8 | `/category/blog/` | `/blog/` |
| Paginación de categoría de blog | 8 | `/category/blog/page/2/` | `/blog/page/2/` |
| Página WooCommerce | 3 | `/en/mi-cuenta/` | `(página de presupuesto / productos)` |
| Carrito WooCommerce | 2 | `/confirmar/` | `(página de presupuesto)` |
| Archivo /shop/ | 1 | `/shop/` | `/productos/` |

- 215 categorías redirigen: 211 hoja a la ficha que sirven y 4 «Sin categorizar» a `/productos/` de su idioma; 7 están marcadas `needs_review` (categorías FR/DE cruzadas que sirven otra ficha).
- Destinos con paréntesis («(página de presupuesto)») se resuelven cuando exista la página de presupuesto; sustituyen a `/confirmar/`, `/en/carrito/`, `/en/finalizar-compra/` y `/en/mi-cuenta/`.
- `/shop/` y `/en/tienda/` → índice de productos de su idioma; archivos de categoría de blog y su paginación → `/blog/` de su idioma.

**Redirecciones adicionales deducidas de enlaces internos** (no están en la política original; los enlaces existen hoy en el HTML y su estado HTTP no se pudo comprobar):

| Origen | Destino propuesto | Páginas que lo enlazan | Evidencia |
|---|---|--:|---|
| `/aviso-legal/` | `/aviso-legal-2/` | 595 | Enlace del pie en las páginas EN/FR/DE y en el pie de entradas de blog; la URL no existe en REST, sitemap ni cosecha (código HTTP no verificado) |
| `/fr/productos/` | `/fr/produits-torivac/` | 127 | Enlace «Productos» de las migas de pan (shortcode cat-breadcrumb) con slug español; el slug real del idioma es /fr/produits-torivac/ |
| `/en/productos/` | `/en/torivac-products/` | 126 | Enlace «Productos» de las migas de pan (shortcode cat-breadcrumb) con slug español; el slug real del idioma es /en/torivac-products/ |
| `/de/productos/` | `/de/torivac-produkte/` | 124 | Enlace «Productos» de las migas de pan (shortcode cat-breadcrumb) con slug español; el slug real del idioma es /de/torivac-produkte/ |
| `/en/contacto/` | `/en/contact/` | 1 | Enlace interno desde la entrada EN huérfana |

La paginación del blog (16 URLs: `/blog/page/2|3/` y `/category/blog/page/2|3/` por idioma) está enlazada pero no cosechada (G-06 de 01-estructura-sitio).

### 6.3 Descartar o revisar con Torivac

| Acción | Ruta | Tipo |
|---|---|---|
| revisar / descartar | `/categoria-producto/comunicacion-modbus/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/controlador-0-10vdc/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/variadores-de-tension/en-caja/cuba-de-aceite/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/equipos-de-sobremesa-en-caja/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/equipos-de-sobremesa/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/equipos-industriales-en-caja/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/equipos-industriales/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/fabricaciones-a-medida/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/fabricaciones-a-medida-transformadores-toroidales/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/hembrillas-de-seguridad/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/portaleds/` | Categoría de producto |
| revisar / descartar | `/categoria-producto/potenciometros-y-reostatos/` | Categoría de producto |
| revisar / descartar | `/en/categoria-producto/comunicacion-modbus/` | Categoría de producto |
| revisar / descartar | `/en/categoria-producto/benchtop-units-2/` | Categoría de producto |
| revisar / descartar | `/en/categoria-producto/portaleds/` | Categoría de producto |
| revisar / descartar | `/en/categoria-producto/potentiometers-and-rheostats/` | Categoría de producto |
| revisar / descartar | `/en/categoria-producto/2x3w/` | Categoría huérfana (2x3W) |
| revisar / descartar | `/fr/categoria-producto/comunicacion-modbus/` | Categoría de producto |
| revisar / descartar | `/fr/categoria-producto/unites-de-paillasse-2/` | Categoría de producto |
| revisar / descartar | `/fr/categoria-producto/portaleds/` | Categoría de producto |
| revisar / descartar | `/fr/categoria-producto/potentiometres-et-rheostats/` | Categoría de producto |
| revisar | `/fr/product/equipos-de-sobremesa-2/` | Ficha huérfana (FR) |
| revisar / descartar | `/fr/categoria-producto/2x3w/` | Categoría huérfana (2x3W) |
| revisar / descartar | `/de/categoria-producto/comunicacion-modbus/` | Categoría de producto |
| revisar / descartar | `/de/categoria-producto/tafelmodellen-2/` | Categoría de producto |
| revisar / descartar | `/de/categoria-producto/portaleds/` | Categoría de producto |
| revisar / descartar | `/de/categoria-producto/potentiometers-en-reostaten/` | Categoría de producto |
| revisar / descartar | `/de/categoria-producto/2x3w/` | Categoría huérfana (2x3W) |
| descartar (410) | `/elementor-hf/header/` | Plantilla Elementor |
| descartar (410) | `/elementor-hf/footer-blog/` | Plantilla Elementor |
| descartar (410) | `/author/francoadm/` | Archivo de autor |

**Reglas para el generador:**

1. Mantener idénticas las rutas de keep_identical (mismo prefijo de idioma y mismo slug) y generar el catálogo PDF en la misma ruta /wp-content/uploads/...
2. Cada URL de redirect_301 debe responder 301 permanente a su destino; los destinos con paréntesis («(página de presupuesto)») se resuelven cuando exista esa página.
3. Las 211 categorías hoja que hoy sirven una ficha se redirigen a la ficha (la canónica ya apunta a ella).
4. gone_410 y review_or_discard requieren decisión con Torivac antes del lanzamiento.
5. Auto-canonical por página y hreflang recíproco en la web nueva: no heredar los canonical cruzados (ver canonical_audit).

## 7. Medición, consentimiento y cookies

### 7.1 IDs de medición y dónde están

| Servicio | ID | Páginas | Dónde y con qué bloqueo de consentimiento |
|---|---|---|---|
| GA4 (ID de medición) | `G-QXLKHV4Y7X` | 781 (ES 208 · EN 194 · FR 190 · DE 189) | Cabecera: script inline sin bloqueo de consentimiento<br>Cabecera: `<script async src="https://www.googletagmanager.com/gtag/js?id=...">`, primera línea del `<head>`, sin data-category ni type=text/plain |
| Google Tag Manager (contenedor) | `GTM-K93FKL89` | 781 (ES 208 · EN 194 · FR 190 · DE 189) | Final del `<body>`: bloque "Statistics script Complianz GDPR/CCPA" con data-category="functional" (se ejecuta siempre)<br>Cuerpo de la página (hacia el final, antes de los scripts del pie): `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=...">`<br>Cabecera: script inline sin bloqueo de consentimiento |
| Google reCAPTCHA v3 (clave de sitio, pública por diseño) | `6Ldj-sUsAAAAAKLkSeOzhX2vzkoujTkI-NuEjGQe` | 611 (ES 158 · EN 152 · FR 152 · DE 149) | Final del `<body>`: `<script src>` sin bloqueo de consentimiento |
| Google Search Console (etiqueta de verificación) | `BrDQSMCGzBbcjV4yqff-yVWMbruM6Uv_fbm7IBbPEcw` | 781 | `<meta name="google-site-verification">` en el `<head>`. Token público de verificación por etiqueta HTML (aparece en el `<head>` de las 781 páginas). No es un secreto. Mantener la misma etiqueta en la web nueva o verificar la propiedad por DNS antes de migrar. |

No detectados en el HTML: Universal Analytics (UA-), Google Ads (AW-) / conversion linker, Floodlight (DC-), Meta Pixel (fbq / facebook.com/tr), LinkedIn Insight Tag, Hotjar, Microsoft Clarity, TikTok Pixel, Pinterest Tag, Google Maps API key (el mapa es un iframe sin clave).

- **GTM duplicado:** El mismo contenedor GTM-K93FKL89 se inicializa dos veces por página: snippet estándar en `<head>` (sin bloqueo) y snippet de Complianz con data-category="functional" al final del `<body>`. Duplica la descarga de gtm.js y, si el contenedor también lleva la etiqueta GA4, puede duplicar el page_view (no verificable: el contenido del contenedor no está en las copias).
- **GA4 cableado:** GA4 (G-QXLKHV4Y7X) está además cableado con gtag.js en el `<head>`, antes de `<meta charset>` y sin esperar consentimiento. Si el contenedor GTM también envía GA4, hay riesgo de doble medición.
- **Consent Mode v2:** no hay `gtag("consent","default")` ni WP Consent API en el HTML. Complianz comunica el consentimiento al contenedor mediante eventos de dataLayer (`tm_categories = 1`); no se puede comprobar si el contenedor los usa.
- **Eventos:** un único `dataLayer.push` por página (el `gtm.js` de arranque); no hay eventos personalizados en el HTML. Los scripts sourcebuster/order-attribution de WooCommerce se cargan en las 781 páginas con allowTracking=true (cookies sbjs_*), sin relación con compras (no hay checkout).
- **No verificable:** Contenido del contenedor GTM-K93FKL89 (etiquetas, disparadores, variables): requiere acceso a Tag Manager. ID numérico de la propiedad GA4 (distinto del ID de medición G-): requiere acceso a Analytics. Si hay cuenta/ID de Google Ads vinculada: no hay AW- en el HTML; podría vivir dentro de GTM o solo en la cuenta de Ads.

### 7.2 Banner de cookies (Complianz)

| Elemento | Valor |
|---|---|
| Plugin / versión | Complianz GDPR/CCPA (complianz-gdpr) 7.5.6 (banner 1784, id `cmplz-cookiebanner-1-optin`) |
| Modelo de consentimiento | `optin` (opt-in), región `eu`, caducidad 365 días, `soft_cookiewall = 1`, `do_not_track_enabled = 1` |
| Categorías | Funcional (siempre activa), Preferencias, Estadísticas, Marketing; con servicios bloqueables en JS: estadísticas y marketing |
| Botones | Aceptar, Denegar, Ver preferencias, Guardar preferencias, Gestionar consentimiento (botón flotante de reapertura) |
| Presencia | Banner y botón de reapertura en 781 de 781 páginas; ninguna página usa contenido bloqueado por Complianz (0 marcadores) |
| Política de cookies | Sin texto en el HTML capturado (408-572 caracteres: solo pie y declaración ICEX); el listado de cookies lo inyecta Complianz por JavaScript. Contenido = null. |

**Idioma del banner** (`cookie_consent.by_language`): en EN, FR y DE el título, el mensaje, los botones y los textos de categoría están en español (idénticos al ES); solo cambian las etiquetas de enlaces («Manage options», «Gérer les options», «Optionen verwalten») y los nombres de categoría de la configuración JS.

| Idioma | Enlace a cookies | Enlace a privacidad | Aviso legal | Mensaje igual que el ES |
|---|---|---|---|---|
| ES | /politica-de-cookies/ | /politica-de-privacidad/ | Aviso legal → /aviso-legal-2/ | sí |
| EN | /en/politica-de-cookies/ | /en/privacy-policy/ | Aviso legal → /aviso-legal-2/ | sí |
| FR | /fr/politica-de-cookies/ | /fr/politique-de-confidentialite/ | Aviso legal → /aviso-legal-2/ | sí |
| DE | /de/politica-de-cookies/ | /de/datenschutzbestimmungen/ | Rechtlicher Hinweis → /de/aviso-legal-2/ | sí |

### 7.3 Qué se carga sin esperar consentimiento

| Recurso | Páginas | Categoría esperable | Bloqueado | Evidencia |
|---|--:|---|---|---|
| GA4 gtag.js (googletagmanager.com/gtag/js) | 781 | statistics | no | script async en `<head>` sin type="text/plain" ni data-category; no hay gtag("consent","default") |
| GTM snippet en `<head>` | 781 | statistics/marketing (según etiquetas) | no | script inline sin atributos |
| GTM snippet Complianz | 781 | functional | siempre activo | data-category="functional"; Complianz envía el consentimiento al contenedor mediante eventos de dataLayer (tm_categories=1) |
| Google reCAPTCHA v3 (google.com/recaptcha/api.js) | 611 | functional (anti-spam) con aviso en política | no | script sin bloqueo; la clave de sitio se envía en la URL |
| Google Fonts (fonts.googleapis.com: Archivo, PT Sans, Advent Pro) | 781 | functional/preferences | no | 2-3 `<link rel=stylesheet>` externos en `<head>`; transferencia de IP a Google |
| Google Maps (iframe maps.google.com/maps?q=...&output=embed) | 4 | marketing/functional | no | iframe con loading=lazy y src directo; sin data-service ni data-category, sin placeholder de Complianz (cmplz-blocked-content-container = 0) |
| WooCommerce order attribution (sourcebuster) | 781 | statistics | no | wc_order_attribution.params.allowTracking=true |

### 7.4 Cookies inferidas del código (no escaneadas)

| Cookie | Origen | Categoría | Evidencia |
|---|---|---|---|
| cmplz_banner-status, cmplz_consented_services, cmplz_policy_id, cmplz_functional/preferences/statistics/marketing | Complianz | functional | var complianz.prefix = "cmplz_", cookie_expiry 365 |
| wp-wpml_current_language | WPML | functional | var wpml_cookies (caduca a 1 día) |
| _ga, _ga_QXLKHV4Y7X | Google Analytics 4 | statistics | gtag("config","G-QXLKHV4Y7X") |
| sbjs_* (sourcebuster) | WooCommerce order attribution | statistics | scripts sourcebuster.min.js y order-attribution.min.js |
| _GRECAPTCHA | Google reCAPTCHA v3 | functional | google.com/recaptcha/api.js?render=... |
| _wpfuuid | WPForms | functional | wpforms_settings.uuid_cookie = "1"; gdpr = "" |
| cookies de Google (NID, etc.) | Google Maps embed / reCAPTCHA / GTM | marketing | iframe maps.google.com sin bloqueo |

Inferido del código observado; no se ha ejecutado un escaneo de cookies (sin red). El escáner de Complianz y la política de cookies viva son la fuente real.

## 8. Formularios

Todos los formularios de contacto son **WPForms** (con módulos Pro, versión 1.10.0.4); no hay Contact Form 7, Elementor Forms ni newsletter. Además existe el buscador de WordPress en la cabecera de las 781 páginas y los formularios de WooCommerce (orden en 16 categorías, login en `/en/mi-cuenta/`). Se envían por AJAX (`/wp-admin/admin-ajax.php`, acción `wpforms_submit`) y cada envío adjunta `page_title`, `page_url` y `page_id` ocultos.

| ID | Idioma | Dónde | Páginas | Campos (* obligatorio) | Botón | Antispam |
|---|---|---|---|---|---|---|
| `4921` | ES | Formulario de la página Contacto (ES) | 1 | Nombre* · Correo electrónico* · Mensaje · He leído y acepto la política de privacidad* | Enviar | reCAPTCHA v3 + honeypot |
| `14527` | ES | Bloque «Contacta con nosotros» al pie de fichas y categorías (ES) | 133 | Nombre* · Correo electrónico* · Mensaje · He leído y acepto la política de privacidad* | Enviar | reCAPTCHA v3 + honeypot |
| `14511` | ES | Bloque «Contacta con nosotros» de la portada y del pie de entradas de blog (ES; plantilla Elementor header/footer) | 24 | Nombre* · Correo electrónico* · Mensaje · He leído y acepto la política de privacidad* | Enviar | reCAPTCHA v3 + honeypot + captcha matemático condicional |
| `16157` | EN | Formulario de portada y de Contacto (EN) | 2 | Name* · E-mail* · Message · I have read and accept the Legal Notice* | Send | reCAPTCHA v3 + honeypot |
| `16204` | EN | Bloque «Contact with us» al pie de fichas, categorías y entradas (EN) | 150 | Name* · E-mail* · Message · I agree to the privacy policy* | Send | reCAPTCHA v3 + honeypot |
| `16179` | FR | Formulario de portada y de Contacto (FR) | 2 | Nom* · E-mail* · Message · J’ai lu et j’accepte la politique de confidentialité* | Envoyer | reCAPTCHA v3 + honeypot |
| `16206` | FR | Bloque «Contactez-nous» al pie de fichas, categorías y entradas (FR) | 150 | Nom* · E-mail* · Message · Il a accepté et accepté la politique de confidentialité* | Envoyer | reCAPTCHA v3 + honeypot |
| `16168` | DE | Formulario de portada y de Contacto (DE) | 2 | Naam* · E-mail* · Bericht · Ich habe die Datenschutzerklärung gelesen und akzeptiere sie* | Senden | reCAPTCHA v3 + honeypot |
| `16202` | DE | Bloque de contacto al pie de fichas, categorías y entradas (DE) | 147 | Naam* · E-mail* · Bericht · Hij gaat akkoord met het privacybeleid.* | Versturen | reCAPTCHA v3 + honeypot |

Incidencias de contenido por formulario:

- `16157` (EN): La casilla de consentimiento de los formularios de portada/contacto EN enlaza el «Legal Notice» y no la política de privacidad (en ES/FR/DE dice política de privacidad).
- `16157` (EN): Etiquetas visibles/ocultas de los campos en español dentro del formulario traducido (Correo *, Mensaje).
- `16179` (FR): Etiquetas visibles/ocultas de los campos en español dentro del formulario traducido (Correo *, Mensaje).
- `16206` (FR): Casilla de consentimiento FR mal traducida: «Il a accepté et accepté la politique de confidentialité».
- `16168` (DE): Textos del formulario en neerlandés dentro de la web alemana: Naam, Bericht.
- `16168` (DE): Etiquetas visibles/ocultas de los campos en español dentro del formulario traducido (Correo *, Mensaje).
- `16202` (DE): Textos del formulario en neerlandés dentro de la web alemana: Naam, Bericht, Versturen, Hij gaat akkoord met het privacybeleid.

- **Destino del envío:** `null`. El destinatario de las notificaciones de WPForms se configura en el servidor (Ajustes de cada formulario) y no aparece en el HTML, en la REST ni en el JS capturado. No se ha detectado ningún mailto: en ninguna página. Correo visible en la web: `info@torivac.com` (texto de data/analysis/pages/*/*.json: aparece en 31 páginas (declaración de accesibilidad 4, categoría de blog 8, carrito 2, contacto 4, política de cookies 4, aviso legal 2, política de privacidad 4, página WooCommerce 3)).
- **Discrepancia:** El plan (docs/PLAN.md) asume info@grupotorivac.com y mzamora@torivac.com; la web publica info@torivac.com. Confirmar con Torivac antes de configurar el Worker de pedidos.
- **Antispam:** reCAPTCHA v3 (la página de Contacto muestra el aviso «Este sitio está protegido por reCAPTCHA y se aplican la Política de Privacidad y los Términos del Servicio de Google»); Honeypot de WPForms (campo oculto con CSS); Captcha matemático WPForms (suma/producto, rango 1-15) solo en el formulario 14511 y mostrado por lógica condicional cuando correo/mensaje coinciden con una lista de patrones de spam (4 correos y 3 fragmentos de URL en wpforms_conditional_logic). No hay Turnstile ni Akismet. Ajustes: GDPR de WPForms desactivado, cookie `_wpfuuid` activa, `mailcheck` activo.
- **Flujo de presupuesto hoy:** No existe un flujo de presupuesto con cantidades: solo formularios de contacto (nombre, correo, mensaje opcional y casilla de privacidad) con el texto «¿Necesita asesoramiento técnico o un presupuesto?». Cada envío adjunta page_title/page_url/page_id ocultos, así que el correo recibido indica qué ficha originó la consulta.

## 9. Plataforma WordPress y WooCommerce

### 9.1 Componentes detectados

| Componente | Versión | Función / evidencia |
|---|---|---|
| WordPress | 7.1.3 | meta generator + ?ver= de /wp-includes/ (781/781) |
| Tema Betheme + `betheme-child` | 21.9.9 | /wp-content/themes/betheme/css/*.css?ver=21.9.9; clases de `<body>`: wp-theme-betheme, wp-child-theme-betheme-child, be-reg-2199 |
| Elementor Header, Footer & Blocks (`header-footer-elementor`) | 2.9.5 | Plantillas de cabecera/pie (CPT elementor-hf, expuesto en el sitemap) · assets en 781 páginas |
| WooCommerce (`woocommerce`) | 11.2.1 | Catálogo sin precios; carrito/checkout/mi cuenta activos pero sin uso comercial · assets en 781 páginas |
| WPML Multilingual CMS (`sitepress-multilingual-cms`) | 5.1.0 | ES/EN/FR/DE por directorio (generator: WPML ver:5.1.0) · assets en 781 páginas |
| Complianz GDPR/CCPA (`complianz-gdpr`) | 7.5.6 | Banner de cookies y bloqueo de scripts (versión leída de var complianz) · assets en 781 páginas |
| Elementor (`elementor`) | 4.3.5 | Constructor de páginas (generator meta: Elementor 4.3.5) · assets en 781 páginas |
| ElementsKit Lite (`elementskit-lite`) | 4.0.9 | Widgets Elementor adicionales · assets en 781 páginas |
| WP Ultimate Review (`wp-ultimate-review`) | 2.4.5 | Estilos/JS de reseñas cargados en las 781 páginas; no se ha detectado ninguna reseña ni JSON-LD de reseñas · assets en 781 páginas |
| WooCommerce Multilingual (WPML) (`woocommerce-multilingual`) | 5.6.3 | Traducción de productos/categorías · assets en 781 páginas |
| Pro Elements (slug no oficial de Elementor Pro) (`pro-elements`) | 4.3.2 | Funcionalidad Pro de Elementor (ElementorProFrontendConfig) servida desde el slug pro-elements, no desde elementor-pro; revisar licencia y soporte · assets en 781 páginas |
| WPForms (Pro) (`wpforms`) | 1.10.0.4 | Formularios de contacto; carga assets/pro (captcha personalizado, lógica condicional) · assets en 611 páginas |
| WPForms Lite (vestigio) (`wpforms-lite`) | — | Solo aparece en 4 páginas (contacto) como og:image y en el sitemap elementor-hf: spinner SVG del plugin Lite desinstalado/sustituido · assets en 4 páginas |
| Yoast SEO (`wordpress-seo`) | 28.7 | Metadatos, canonical, hreflang (con WPML), JSON-LD @graph, sitemaps, llms.txt (`<link rel="llms-sitemap">`). Versión leída del comentario HTML · assets en 781 páginas |
| W3 Total Cache (`w3-total-cache`) | — | Caché de página: comentario «Performance optimized by W3 Total Cache» en HTML y sitemaps · assets en 781 páginas |

Generators publicados: `Elementor 4.3.5; features: additional_custom_breakpoints; settings: css_print_method-external, google_font-enabled, font_display-auto`; `WPML ver:5.1.0 stt:1,4,3,2;`; `WooCommerce 11.2.1`; `WordPress 7.1.3`. No hay `mu-plugins`.

**Servicios de terceros:** Google Tag Manager, Google Analytics 4, Google reCAPTCHA v3, Google Fonts (Archivo, PT Sans, Advent Pro), Google Maps (iframe en Contacto), cookiedatabase.org (enlace de Complianz), santisomarketing.com (crédito en pie; 1.376 enlaces).

**Superficie expuesta y restos heredados** (no replicar):

- XML-RPC (enlace RSD): `<link rel="EditURI" href="https://grupotorivac.com/xmlrpc.php?rsd">` en las 781 páginas; el enlace se publica, pero que el endpoint responda no está verificado.
- REST API pública: `<link rel="https://api.w.org/">`, wp-json/wp/v2/* y wc/store/v1/* respondieron sin autenticación durante la cosecha; elementor_library devolvió 401.
- Archivo de autor: /author/francoadm/ en author-sitemap.xml (expone el nombre de usuario de WordPress «francoadm»).
- Plantillas Elementor públicas: /elementor-hf/header/ y /elementor-hf/footer-blog/ en elementor-hf-sitemap.xml (indexables).
- oEmbed, feeds RSS y comentarios: link rel=alternate en `<head>`.
- mod_pagespeed: favicon 192px servido como «xcropped-Logo_Torivac-192x192.png.pagespeed.ic.BXKchQ6CLH.png».
- Rank Math: la REST de producto expone claves meta rank_math_title/description/focus_keyword (vacías) y _dpc-meta-* aunque el SEO activo es Yoast.
- WPForms Lite: assets del plugin Lite todavía referenciados.
- Favicon: El favicon principal es un .jpg con type="image/x-icon" (MIME incorrecto).

### 9.2 WooCommerce: catálogo sin precios

| Idioma | Productos | Comprables sí / no | Precio | `price_html` vacío | `add_to_cart.text` | `single_text` | Con / sin SKU | Variables |
|---|--:|---|---|--:|---|---|---|--:|
| ES | 80 | 0 / 80 | "0" | 80 | Leer más | Añadir al carrito | 77 / 3 | 1 |
| EN | 75 | 0 / 75 | "0" | 75 | Read more | Add to cart | 73 / 2 | 1 |
| FR | 76 | 0 / 76 | "0" | 76 | Lire la suite | Ajouter au panier | 74 / 2 | 1 |
| DE | 74 | 0 / 74 | "0" | 74 | Weiterlesen | In den Warenkorb | 72 / 2 | 1 |

- **Modo catálogo:** No hay plugin de modo catálogo: todos los productos tienen price/regular_price = "0", price_html vacío e is_purchasable = false; las plantillas de ficha no renderizan form.cart, botón single_add_to_cart_button ni precio.
- **Botón «Solicitar presupuesto»: no existe.** No existe ningún botón «Solicitar presupuesto» en el HTML ni en la Store API. El texto de acción de WooCommerce es add_to_cart.text = «Leer más» (ES) / «Read more» / «Lire la suite» / «Weiterlesen», y single_text = «Añadir al carrito» / «Add to cart» / «Ajouter au panier» / «In den Warenkorb», pero ninguna se muestra en la ficha. La llamada a la acción real es un titular + formulario de contacto al pie de cada ficha.
- **Llamada a la acción real** (titular antes del formulario): ES: «¿Necesita asesoramiento técnico o un presupuesto? Escríbenos y te la resolveremos» · EN: «Do you need technical advice or a quotation? Write us and we will solve it for you» · FR: «Vous avez besoin d'un conseil technique ou d'un devis ? Écrivez-nous et nous résoudrons le problème pour vous.» · DE: «Benötigen Sie eine technische Beratung oder ein Angebot? Schreiben Sie uns und wir werden es für Sie lösen». Etiqueta superior: ES: «CONTACTA CON NOSOTROS» · EN: «CONTACT WITH US» · FR: «CONTACTEZ-NOUS» · DE: «KONTAKT US».
- **Fichas:** 304 páginas de ficha; ninguna con `form.cart`, botón de compra ni precio; 240 muestran en «Explora productos similares» un icono de cesta (`a.add_to_cart_button`) sin texto accesible. Estado real del clic (AJAX add_to_cart) no verificable sin red.
- **Único producto variable:** «Choques | Inductancias | Reactancias toroidales»: (en los 4 idiomas); 0 variaciones y marcado sin stock: se comporta como ficha informativa.
- **Páginas WooCommerce:** `/confirmar/` (noindex); `/shop/` (index); `/en/carrito/` (noindex); `/en/finalizar-compra/` (noindex); `/en/mi-cuenta/` (noindex); `/en/tienda/` (index). Ninguna se migra (política de URLs).
- wc-add-to-cart, woocommerce.js, js-cookie, blockUI, sourcebuster y order-attribution se cargan en las 781 páginas.
- Claves `meta` SEO expuestas por la REST de producto: `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw`, `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword`, `_dpc-meta-title`, `_dpc-meta-description`, `_dpc-keyword` (solo Yoast está activo; Rank Math y `_dpc-*` son restos).
- El pedido de la web nueva se modela como presupuesto por cantidades; no hay precios en origen (Store API) → los precios llegan de la hoja de Drive de la Sesión 6.

## 10. Rendimiento aparente

Medido sobre el HTML cosechado (sin red ni renderizado): no hay LCP/CLS/INP reales ni pesos de CSS/JS/imágenes; son indicadores aparentes.

| Indicador (por página) | Mediana | P90 | Máximo |
|---|--:|--:|--:|
| HTML (bytes) | 211.000 | 222.568 | 400.391 |
| HTML gzip (bytes) | 42.616 | 44.725 | 88.692 |
| `<script src>` | 48 | 48 | 85 |
| Scripts inline | 30 | 31 | 32 |
| Hojas CSS enlazadas | 52 | 53 | 54 |
| CSS inline (bytes) | 96.781 | 100.800 | 101.490 |
| Scripts bloqueantes en `<head>` | 4 | 4 | 4 |
| Scripts sin `async`/`defer` (total) | 35 | 35 | 73 |
| Elementos del DOM | 785 | 833 | 1145 |

- **Origen de los scripts (portada ES):** wp-core 11, wpforms 10, woocommerce 6, tema betheme 6, elementor 5, pro-elements 2, ext:www.googletagmanager.com 1, sitepress-multilingual-cms 1, wp-ultimate-review 1, woocommerce-multilingual 1, complianz-gdpr 1, ext:www.google.com 1. Bloqueantes en `<head>`: jquery.min.js 3.7.1, jquery-migrate.min.js 3.4.1, elementor font-awesome v4-shims.min.js, wp-ultimate-review content-page.js.
- **Cargado en las 781 páginas sin uso aparente:** jQuery Migrate (781), jQuery UI (781), CSS de jPlayer (781), scripts de WooCommerce (781), WP Ultimate Review (781) y 8 hojas de Font Awesome en la portada; los scripts de WPForms (incluido reCAPTCHA) en 611 páginas.
- **Fuentes:** Google Fonts (CDN externo): Archivo y PT Sans (pesos 300-900, cursivas 400 y 700); Advent Pro (400, 600, 700); 2-3 peticiones CSS por página, sin `preconnect`.
- **Imágenes:** 14.644 `<img>` en total (mediana 19 por página, máximo 38); 43,1 % sin `loading="lazy"`; 45,4 % sin `width`/`height` (riesgo de CLS); 10.677 PNG, 3.298 JPEG y 44 WebP; `fetchpriority="high"` en 114 páginas. La cabecera de cada página contiene el logo Torivac_negativo.png 4 veces y cada bandera (es/en/fr/de.png, PNG) 2 veces.
- En 291 de 304 fichas y 321 de 323 categorías la primera imagen del área de contenido lleva loading="lazy": candidata a LCP diferido (indicador aparente, sin renderizar).
- **Mediateca** (`media-index.json`): 1.594 imágenes (859 PNG, 705 JPEG, 30 WebP); de las 604 con peso conocido, 61 pesan más de 500 kB y 15 más de 1 MB; 128 superan los 2.000 px de ancho; 1.455 tienen `alt` vacío.
- **Caché y diferidos:** W3 Total Cache (caché de página); Elementor: css_print_method-external + carga diferida de fondos de contenedores (e-lazyloaded); WordPress speculation rules: prefetch conservador.
- Objetivo para la web nueva: la web nueva (estática) debe cumplir LCP < 2 s en móvil y CSS/JS mínimos; ver reglas heredadas de whynot-sites.

## 11. Accesibilidad aparente

Comprobaciones estáticas sobre el HTML (sin renderizar): no sustituyen a axe/Lighthouse ni a una revisión con lector de pantalla. Contraste de color no evaluado (data/analysis/design-dump.json tiene los estilos calculados para la Sesión 4).

| Comprobación | Resultado | Detalle |
|---|---|---|
| `<main>` / `role="main"` | 0 de 781 páginas | Landmarks presentes: `header`, `nav` (1–2), `footer` |
| Enlace «saltar al contenido» | 0 de 781 | — |
| Páginas sin H1 / con saltos de nivel | 508 / 629 | Sección 4.3 |
| Imágenes con `alt=""` | 6.240 de 14.644 (42,6 %) | Cabecera 3.052, pie 2.157, contenido 1.031 |
| Imágenes sin atributo `alt` | 4 | `Screenshot-2025-11-25-190644.png` ×2, `Screenshot-2025-11-25-203153.png` ×2 |
| `alt` con nombre de fichero | 6 | `transformador-serie-tci.png`, `transformador-serie-te.png` en Proyectos (3 idiomas) |
| Enlaces sin nombre accesible | 6.120 | Menú hamburguesa, cierre, iconos de cesta/enlace de las tarjetas |
| Botones sin nombre accesible | 3.124 | 4 interruptores de categoría del banner por página |
| Campos sin `<label>` | 2.525 | Buscador de cabecera en las 781 y campos WPForms (solo placeholder) |
| `<html lang>` correcto | 780 de 781 | Excepción: `/confirmar/` |
| Zoom bloqueado / `tabindex` positivo / iframes sin título | 0 / 0 / 0 | Correcto |

- Un alt vacío es válido en imágenes decorativas, pero aquí lo llevan logotipos informativos (Logotipos_FondosEuropeos.jpg en el pie, 1.190 apariciones; MANUAL-FEDER-ICEX-NEXT-2027.jpeg, 186) y el 91 % de la mediateca (alt vacío por defecto).
- Imágenes con `alt` vacío más frecuentes: `Logotipos_FondosEuropeos.jpg` (1.190), `Torivac_negativo.png` (781), `es.png` (771), `en.png` (765), `fr.png` (760), `de.png` (756), `MANUAL-FEDER-ICEX-NEXT-2027.jpeg` (186).
- **Declaración de accesibilidad:** Parcialmente conforme con RD 1112/2018; el apartado «Falta de conformidad» dice «No aplica. Cumple el 100% de los criterios de accesibilidad web». La declaración se contradice con los hallazgos estáticos: sin `<main>`, sin enlace de salto, 65 % de páginas sin H1, saltos de nivel en la mayoría de plantillas, 43 % de imágenes con alt vacío e inputs sin etiqueta.
- No evaluado: contraste de color (los estilos calculados están en `data/analysis/design-dump.json` para la Sesión 4), foco visible, orden de tabulación ni lectores de pantalla.

## 12. Páginas y avisos legales presentes

| Documento | ES | EN | FR | DE |
|---|---|---|---|---|
| Aviso legal | `/aviso-legal-2/` (18.809 car.) | **no existe** | **no existe** | `/de/aviso-legal-2/` (19.434 car.) |
| Política de privacidad | `/politica-de-privacidad/` (5.627 car.) | `/en/privacy-policy/` (5.238 car.) | `/fr/politique-de-confidentialite/` (6.270 car.) | `/de/datenschutzbestimmungen/` (6.133 car.) |
| Política de cookies | `/politica-de-cookies/` (572 car. · sin texto en HTML) | `/en/politica-de-cookies/` (408 car. · sin texto en HTML · canonical→ES) | `/fr/politica-de-cookies/` (441 car. · sin texto en HTML · canonical→ES) | `/de/politica-de-cookies/` (454 car. · sin texto en HTML · canonical→ES) |
| Declaración de accesibilidad | `/declaracion-de-accesibilidad/` (4.638 car.) | `/en/declaracion-de-accesibilidad/` (4.149 car.) | `/fr/declaracion-de-accesibilidad/` (4.598 car.) | `/de/declaracion-de-accesibilidad/` (4.699 car.) |

Todas con `meta description = «%»` y sin H1. Enlaces del pie por idioma (`legal_pages.footer_links_by_language`): En EN/FR/DE el pie enlaza a /aviso-legal-2/, /politica-de-privacidad/ y /declaracion-de-accesibilidad/ en español aunque existen versiones traducidas de privacidad y accesibilidad; además un segundo bloque enlaza a /aviso-legal/ (no existe en la cosecha).

Problemas:

- Aviso legal (ES): el apartado «Datos identificativos» tiene la denominación social en blanco («la ostenta: , con NIF: B60784584»): falta el nombre del titular que exige la LSSI.
- Las políticas de privacidad (ES/EN/FR/DE) no mencionan Google Analytics, Google Tag Manager, reCAPTCHA ni Google Maps, que la web carga; el aviso legal solo incluye un párrafo genérico de cookies.
- Política de cookies sin texto en el HTML (inyectada por JS) y con canonical a la URL española en EN/FR/DE.
- Declaración de accesibilidad con afirmación de 100 % de conformidad (ver accessibility).
- El aviso legal no contiene condiciones de venta, devolución ni desistimiento: coherente con un catálogo sin precios, pero habrá que añadirlas si el presupuesto deriva en pedido online.

**Identidad corporativa publicada** (fuentes: `data/analysis/pages/es/contacto.json`, `data/analysis/pages/es/aviso-legal-2.json`, `data/analysis/pages/es/politica-de-privacidad.json`): marca Torivac; GRUPO TORIVAC (aviso legal) / Torivac S.L. (declaración ICEX, JSON-LD alternateName «Torivac S.L»); NIF `B60784584`; C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona (el mapa usa «Carrer de Potosí, 2, planta 6, San Andrés de Palomar, 08030 Barcelona»); tel. +34 93 312 01 61; correo `info@torivac.com`. Datos corporativos públicos de la web. Los iconos sociales del pie (LinkedIn, etc.) son decorativos: no enlazan a ningún perfil.

**Aviso de ayudas europeas (obligatorio mantenerlo):** Torivac S.L. ha participado en el Programa de Iniciación a la Exportación ICEX-Next, y ha contado con el apoyo de ICEX, así como con la cofinanciación de Fondos europeos FEDER… Se muestra en el pie de página (texto + imágenes Logotipos_FondosEuropeos.jpg y MANUAL-FEDER-ICEX-NEXT-2027.jpeg, ambas con alt vacío). Mantener el texto y los logotipos en la web nueva, con alt descriptivo (obligación de publicidad de la ayuda).

## 13. IDs y cuentas a reutilizar (web nueva y dashboard de la Sesión 7)

IDs y cuentas detectados en el HTML de la web actual que la web nueva y el dashboard de la Sesión 7 deben reutilizar o confirmar. Ningún secreto: todos los valores son públicos por diseño.

| Servicio | ID | Estado | En la web nueva | En el dashboard S7 |
|---|---|---|---|---|
| Google Analytics 4 | `G-QXLKHV4Y7X` | detectado | Sí, el mismo flujo de datos web para conservar el histórico; cargar tras consentimiento (Consent Mode v2). | Conectar por la Data API con el ID numérico de la propiedad (no deducible del ID de medición → null). Informes sugeridos: sesiones, páginas, país, idioma, conversiones de presupuesto. |
| Google Tag Manager | `GTM-K93FKL89` | detectado | Sí: un solo snippet (hoy está duplicado). Revisar el contenedor para ver qué etiquetas lleva (GA4, Ads, Pixel) antes de decidir si GA4 se mueve dentro del contenedor. | Solo para auditoría de etiquetas; el dashboard no lee GTM. |
| Google Search Console | — | etiqueta de verificación presente (propiedad no comprobada) | Mantener la meta google-site-verification en el `<head>` de todas las páginas, o verificar por DNS, para no perder la propiedad ni el histórico; enviar los sitemaps por idioma; no hace falta la herramienta de cambio de dirección (el dominio no cambia). | API de Search Console sobre la propiedad https://grupotorivac.com/ (tipo de propiedad —prefijo de URL o dominio— no deducible → confirmar). Métricas: consultas, páginas, país, dispositivo por idioma. |
| Google Ads | — | no detectado en el HTML | Si hay campañas, el ID AW- y las conversiones pueden vivir dentro de GTM o solo en la cuenta de Ads: preguntar a Torivac / revisar el contenedor. Definir la conversión «presupuesto enviado» como evento nuevo. | Necesita ID de cliente de Google Ads (null) y vinculación con GA4. No se ha podido determinar si existen campañas. |
| Meta Pixel / Conversions API | — | no detectado | No hay píxel que migrar. | Sin datos de origen. |
| Google Business Profile | — | no detectado como ID | No hay enlace al perfil ni ID de ubicación: solo un iframe de Google Maps por dirección. Añadir enlace al perfil, reseñas y JSON-LD LocalBusiness con la misma NAP. | Requiere el ID de cuenta/ubicación de GBP (null). NAP para casarlo: Carrer de Potosí 2, planta 6, 08030 Barcelona; +34 93 312 01 61; info@torivac.com. |
| Google reCAPTCHA v3 | `6Ldj-sUsAAAAAKLkSeOzhX2vzkoujTkI-NuEjGQe` | detectado (clave de sitio) | No recomendado: el patrón de whynot-sites usa Cloudflare Turnstile en el Worker de formularios. La clave secreta no está en el HTML. | No aplica. |
| Complianz (consentimiento) | — | detectado | Sustituir por banner propio con las mismas 4 categorías (funcional, preferencias, estadísticas, marketing), caducidad 365 días, modo opt-in UE y traducido a 4 idiomas. | No aplica. |
| Búsqueda interna (SearchAction) | `/?s={search_term_string}` | declarada en JSON-LD | La web nueva tendrá buscador JS sobre el índice de productos: actualizar o retirar la SearchAction. | No aplica. |

**Datos NAP para casar el perfil de Business Profile y el JSON-LD `LocalBusiness`:** Torivac, C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona, +34 93 312 01 61, info@torivac.com. El mapa de Contacto es un iframe por dirección (`Carrer de Potosí, 2, planta 6, San Andrés de Palomar, 08030 Barcelona`), sin ID de lugar.

**Eventos a definir en la web nueva** (hoy no existe ninguno): `quote_add` (añadir referencia al presupuesto); `quote_submit` (envío del presupuesto: correo + PDF); `contact_submit`; `catalog_download` (PDF de catálogo por idioma); `pdf_datasheet_download` (fichas técnicas); `language_switch`; `voltage_filter_use`.

**Lista de comprobación antes del cambio de DNS:**

1. Mantener la meta google-site-verification (o verificar por DNS) y enviar los sitemaps nuevos.
2. Un solo contenedor GTM-K93FKL89 (o nuevo) y GA4 G-QXLKHV4Y7X con Consent Mode v2.
3. Redirecciones 301 del contrato url_policy cargadas en el borde (Cloudflare) antes del cambio de DNS.
4. robots.txt y llms.txt nuevos; comprobar el robots.txt actual (no cosechado).
5. Pedir a Torivac acceso de lectura a GA4, Search Console, Ads, GTM y Business Profile para la Sesión 7.

## 14. Huecos y verificaciones pendientes

Nada de lo siguiente se ha inventado: queda como `null` o como propuesta.

| ID | Tema | Detalle | Impacto |
|---|---|---|---|
| S-G1 | robots.txt | No se cosechó; se desconocen reglas y línea Sitemap:. | No se puede comparar con la web nueva. |
| S-G2 | Cabeceras y códigos HTTP | La cosecha no guardó status, redirecciones ni cabeceras (X-Robots-Tag, caché, seguridad, HSTS). | Las categorías «que sirven la ficha», /aviso-legal/ y /{en,fr,de}/productos/ se deducen del HTML, no de un 301/404 medido. |
| S-G3 | Contenedor GTM | Etiquetas, disparadores y variables de GTM-K93FKL89 no están en las copias. | No se sabe si hay Ads, Pixel o un segundo GA4 dentro del contenedor. |
| S-G4 | Propiedades de Google | ID numérico de GA4, tipo de propiedad de Search Console, ID de Google Ads y de Business Profile: no deducibles del HTML. | La Sesión 7 necesita acceso o los IDs. |
| S-G5 | Destino de los formularios | El correo de destino de WPForms es configuración de servidor; no aparece en ningún fichero. | Confirmar buzones (ver T-20). |
| S-G6 | Política de cookies | El listado de cookies lo genera Complianz por JS y no está en el HTML. | Hay que ejecutar el escáner de cookies sobre la web viva o redactar la política desde el inventario inferido. |
| S-G7 | Rendimiento real | Sin Lighthouse/CrUX, sin pesos de CSS/JS/imágenes cargadas, sin LCP/CLS/INP. | Las cifras de rendimiento son indicadores del HTML, no mediciones. |
| S-G8 | Accesibilidad real | Sin axe, contraste ni prueba con lector de pantalla. | Los hallazgos son comprobaciones estáticas. |
| S-G9 | Datos de Search Console y Analytics | No hay tráfico, consultas ni páginas de entrada (G-07 de 01-estructura-sitio). | La prioridad de URLs se basa en sitemap/hreflang, no en tráfico. |
| S-G10 | Plantillas Elementor | elementor_library devolvió 401: no hay estructura interna de cabecera/pie. | El origen de los H3 «Productos» y de las dobles etiquetas OG no se ha podido localizar en plantilla. |
| S-G11 | Versiones de componentes | La antigüedad relativa de Betheme 21.9.9 y de los plugins no se puede contrastar sin red. | No se emite juicio de obsolescencia más allá del número de versión. |
| S-G12 | Redes sociales | Los iconos del pie no enlazan a perfiles; no hay sameAs ni perfiles conocidos. | Si Torivac tiene perfiles, hay que pedirlos. |
| S-G13 | llms.txt | Declarado en `<link rel="llms-sitemap">` pero no cosechado. | Se desconoce su contenido. |

## 15. Verificación independiente de este análisis

Tras generar `seo-tech.json` se recalcularon cifras clave con otro camino de datos (`data/analysis/pages/*.json`, `pages-index.json`, `data/raw/store`, `data/raw/sitemaps`, `site-structure.json`), sin reutilizar mi extracción del HTML:

| Comprobación | seo-tech.json | Recalculado | Resultado |
|---|--:|--:|---|
| páginas | 781 | 781 | coincide |
| meta description ausente o vacía | 119 | 119 | coincide |
| meta description "%" | 38 | 38 | coincide |
| páginas sin H1 (outline de analysis/pages) | 508 | 508 | coincide |
| páginas noindex | 4 | 4 | coincide |
| GA4 y GTM únicos en las 781 páginas | True | True | coincide |
| título con «Grupor» | 7 | 7 | coincide |
| título = «Torivac» | 6 | 6 | coincide |
| canonical propio | 393 | 393 | coincide |
| formularios WPForms distintos | 9 | 9 | coincide |
| productos comprables (Store API ES) | 0 | 0 | coincide |
| productos comprables (Store API EN) | 0 | 0 | coincide |
| productos comprables (Store API FR) | 0 | 0 | coincide |
| productos comprables (Store API DE) | 0 | 0 | coincide |
| sitemap `<loc>` | 523 | 523 | coincide |
| sitemap URLs únicas | 201 | 201 | coincide |
| URLs de la política | 854 | 854 | coincide |
| 301 | 237 | 237 | coincide |
| 301 listados en seo-tech.json | 237 | 237 | coincide |
| mantener idénticas listadas | 586 | 586 | coincide |
| entradas de seo_by_url | 781 | 781 | coincide |

21 de 21 comprobaciones coinciden. Otros cruces: los metadatos de `yoast_head_json` (REST) coinciden con el HTML en páginas, entradas y fichas; los hallazgos de canonical y sitemap coinciden con `01-estructura-sitio.md` (F-C01 a F-C04); las cifras de la política de URLs coinciden con su sección 11.

Detalles que se verificaron a mano en el HTML: el snippet GTM duplicado (cabecera + bloque Complianz al final del `<body>`), la posición de GA4 antes de `<meta charset>`, el doble bloque `og:*` de las entradas, el H3 «Productos» como primer encabezado de las fichas, las cadenas neerlandesas de los formularios DE y la ausencia de `form.cart` / botón de compra en las fichas.

## 16. Fuentes

· `data/raw/html/<lang>/*.html (781 páginas: head, scripts, formularios, banner, imágenes, encabezados)` · `data/analysis/pages/<lang>/*.json (title, meta_description, hreflang, tracking_ids, forms, texto)` · `data/analysis/pages-index.json` · `data/analysis/site-structure.json → seo.preserve_urls (política de URLs)` · `data/raw/rest/{pages,posts,product,product_cat}.<lang>.json (yoast_head_json y meta)` · `data/raw/store/products.<lang>.json (add_to_cart, is_purchasable, prices)` · `data/raw/sitemaps/*.xml` · `data/raw/manifest.json` · `data/analysis/media-index.json`

