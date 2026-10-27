# Hallazgos de calidad de la web original (grupotorivac.com)

Registro vivo de defectos detectados al migrar. **No se corrigen en la web original** (solo lectura): la web nueva replica el contenido y estos puntos
quedan como propuestas para aprobar (panel admin → Propuestas).

| # | Gravedad | Hallazgo | Evidencia | Estado en la web nueva |
|---|----------|----------|-----------|------------------------|
| 1 | Alta (SEO) | La home en inglés declara como `canonical` la URL alemana (`/de/`) | `<link rel="canonical">` de `/en/` | Se usa la URL real `/en/`; canonical correcto |
| 2 | Alta (datos) | Ficha *Transformador serie TT*: la tabla web no coincide con el PDF (p. ej. `TT0030210` web 2×12 V · 2×1,25 A; PDF 2×10 V · 2×1,5 A; el código encaja con el PDF) | `products/transformadores-serie-tt` vs `Carcateristicas_transformadores_toroidales_Torivac_serie_TT.pdf` | Se publica lo de la web (fiel) y se propone la corrección con evidencia |
| 3 | Media | Descripción de la categoría «Botones de mando y accesorios» contiene shortcodes WPBakery sin renderizar (`[vc_raw_html]…` en base64); el texto decodificado es copia del de Variadores | `rest/product_cat` id 27 y traducciones | Se decodifica el HTML; el texto erróneo se anota como propuesta |
| 4 | Media | Categorías duplicadas (p. ej. «Equipos industriales» ×2, «Fabricaciones a medida» ×2, «Portaled/Portaleds») | `data/analysis/categories-analysis.json` | Se fusionan en el menú; las URLs antiguas redirigen |
| 5 | Media | El sitemap de Yoast+WPML repite las URLs en español y no lista las traducidas | `sitemaps/*.xml` | La web nueva genera sitemap con todas las URLs y `hreflang` |
| 6 | Media | Fichas EN/FR/DE incompletas (sin tablas o con menos del 60 % del texto) en 5 productos por idioma; 5–6 productos sin traducción | `data/catalog/products.json` → `translation_status` | Se muestra el texto ES con aviso hasta traducir |
| 7 | Baja | Páginas legales de EN/FR/DE enlazan a las versiones en español (`/aviso-legal-2/`) | pie de página | Se enlaza a la traducción donde existe |
| 8 | Baja | Referencias a un dominio de pruebas antiguo (`torivac.santisomarketing.com`) dentro de contenido | descripción de categoría | No se enlazan imágenes de otros dominios |
| 9 | Info | Ningún producto tiene precio; 18 de 80 mencionan tensión en el texto (el resto solo en PDFs) | Store API | Etiquetas de voltaje a partir de web + PDFs verificados |
| 10 | Media (legal) | En el *Aviso legal* (ES y EN) falta el nombre de la titular: «la ostenta: , con NIF: B60784584» | `/aviso-legal-2/` y `/en/aviso-legal-2/` | Se replica fiel; se propone completar con la razón social (Torivac S.L.) tras confirmación |
| 11 | Alta (SEO) | Canónicas incoherentes en la web original: 93 fichas EN, 94 FR y 90 DE declaran como canónica la URL **en español**; además la home y el contacto EN apuntan a la URL alemana, y el listado de productos FR y DE apunta al inglés. Con `hreflang` esto resta posicionamiento internacional | `<link rel="canonical">` de cada página (ver `data/analysis/pages-index.json`) | La web nueva emite canónica propia por idioma + `hreflang` correcto |

