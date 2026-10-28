# 02 · Contenido en francés (fr): páginas y entradas

> Sesión 1 · Análisis profundo. Datos de contenido en `data/analysis/content/fr.json` (texto íntegro para migrar, secciones, CTA, imágenes, formularios, comparación con el ES, hechos de empresa, pie y banner de cookies). Este documento es el inventario legible. Fuentes: `data/analysis/pages/fr/*.json`, `data/raw/html/fr/*.html`, `data/raw/rest/pages.fr.json` y `posts.fr.json`, `data/analysis/content/es.json` (referencia ES), `data/analysis/seo-tech.json`, `data/analysis/pdf-text/Torivac_2024_FR/`. Cosecha del 27/10/2026. No se modificó la web original ni se hicieron peticiones de red.

Alcance: páginas y entradas cuya URL está en francés (prefijo `/fr/`). Se excluyen las fichas de producto y los archivos de categoría de producto, que se analizan aparte. Se inventarían, sin analizarlos a fondo, los dos archivos de categoría de entradas. En francés no existen carrito, finalizar compra, tienda ni mi cuenta en los datos (ver sección 2.3).

## 1. Resumen

| Concepto | Dato |
|---|---|
| Piezas inventariadas | 32 (9 páginas, 21 entradas, 2 archivos de categoría) |
| Texto | 4.191 palabras en páginas y 20.450 en entradas (en ES: 6.960 y 19.217; el ES incluye el aviso legal. 2.895 palabras. que no existe en FR) |
| Entradas por fecha | 6 de 2024, 15 de 2025 (14 de diciembre de 2025) |
| Estructura frente al ES | Idéntica: mismos niveles de encabezado en las 30 páginas y entradas; ninguna sección ausente; las cifras coinciden (salvo 'cinq continents' y los recuentos de categoría) |
| Calidad de la traducción | ok 22; parcial 2; automática sospechosa 6; sin traducir 0; n/a 2 |
| Páginas y entradas sin `<h1>` | 27 de 30 (solo tienen H1 la portada, Notre entreprise y Projets clés en main) |
| Meta description sin resolver (valor literal `%`) | 8 páginas; 1 entrada sin meta description (Matelec) |
| Canónica a otro idioma | 2 páginas: `/fr/produits-torivac/` (→ inglés) y `/fr/politica-de-cookies/` (→ español) |
| Imágenes de contenido | 76; 34 con alt vacío, 14 con alt que es un nombre de archivo y 1 no descriptivo |
| Entradas que mencionan a China | 13 de 21 (igual que en ES) |
| Entradas que mencionan España como mercado | 14 de 21 (traducción sin localizar) |
| Desfase de fechas | Las 21 entradas FR se modificaron el 23/03/2026 (15:52-15:59), después de las ES. Desactualizadas frente al ES: portada (solo imágenes) y proyectos (solo imágenes) |
| Hallazgos de calidad | 190 (alta 24, media 107, baja 59); detalle en `quality_flags` de cada pieza |
| Lorem ipsum o texto de relleno clásico | Ninguno (búsqueda en texto visible, HTML y REST de las piezas FR) |
| Decisión de migración | Copiar con correcciones: 8; Retraducir tras corregir el ES: 18; Regenerar: 3; Revisión legal: 1; No migrar: 2 |

Conclusiones:

1. **El francés es una copia traducida del español, sin contenido propio.** Las 30 páginas y entradas tienen los mismos encabezados, las mismas líneas y las mismas cifras que su original ES. Heredan todos sus defectos (erratas, afirmaciones sin respaldo, plantillas legales incompletas, 14 textos SEO de plantilla) y añaden los suyos. La web nueva debe tratar el ES corregido como fuente única y regenerar el FR desde él.
2. **Parece una traducción automática en lote.** Las 21 entradas llevan fecha de modificación 2026-03-23 entre las 15:52:28 y las 15:59:12, y hay errores de sentido en nombres de producto y de evento: «Beyond Catalonia» → «l’au-delà de la Catalogne»; «variador» → «onduleur»/«entraînement»; «choques» → «chocs»; «portaleds» → «portails»; «cookies propias» → «biscuits». Las fuentes no dicen qué herramienta se usó.
3. **Los fallos más graves están en la interfaz y en lo legal, no en los artículos.** Banner de cookies casi entero en español en las 190 páginas; casilla de consentimiento de las entradas mal traducida («Il a accepté et accepté la politique de confidentialité»); pie sin el texto ICEX-Next/FEDER que sí tiene el ES; enlaces legales del pie hacia las páginas en español y ninguna página de aviso legal en francés; etiquetas ocultas del formulario en español; catálogo en español descargable desde la portada francesa.
4. **Datos de empresa idénticos al ES** (teléfono, correo, NIF, domicilio), con dos matices: la dirección está traducida solo en la página de contacto, y el nombre de la empresa tiene tres formas en francés («Groupe Torivac», «TORIVAC GROUP», «Grupor Torivac»).
5. **Lo aprovechable:** la portada, Notre entreprise, Projets clés en main, Contactez-nous y las dos noticias con hechos verificables (Coiltech, Beyond Catalonia), siempre corregidas. El resto se retraduce tras la decisión sobre el ES (14 artículos SEO de plantilla, textos legales, índices).

## 2. Inventario

`Qué dice` resume la finalidad de la pieza. `Calidad del texto` es una valoración editorial (no una puntuación automática). Las fechas son de publicación y última modificación según la API REST de WordPress; `Modif. ES` es la fecha de la pieza española enlazada por `hreflang`. `Traducción` es la calidad de la traducción (criterios en la sección 12).

### 2.1 Páginas (9)

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. FR | Modif. ES | Pal. | Qué dice | Calidad del texto | Traducción | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|
| `/fr/` | 15764 | Accueil Torivac | Spécialistes du contrôle et de la régulation de la tension | 2025-10-30 / 2026-03-13 | 2026-10-14 (posterior) | 541 | Portada en francés: presenta a Torivac como especialista en control y regulación de tensión (más de 60 años), enlaza a empresa, proyectos, las 10 familias de producto y el catálogo PDF, y ofrece el formulario de contacto. | Traducción literal correcta salvo tres nombres de familia mal vertidos (variadores, choques, portaleds), los tres CTA idénticos ('Plus d'informations') y etiquetas del formulario en español. Imágenes anteriores a la actualización del ES. | automática sospechosa | Copiar con correcciones |
| `/fr/notre-entreprise/` | 15716 | Torivac_Torivac Company | Notre entreprise | 2025-11-03 / 2026-03-09 | 2026-03-08 | 387 | Presenta la empresa en francés: 60 años, presencia en más de 30 países, misión (desde 1964), visión, valores y liderazgo de M. Ramón Zamora. | Buena. Fiel y fluida; terminología de producto algo inestable ('régulateurs' frente a 'variateurs'), título SEO con 'Grupor' y CTA enlazado a /contacto/ (ES). | ok | Copiar con correcciones |
| `/fr/produits-torivac/` | 15734 | Produits Torivac | (sin H1) Produits | 2025-11-02 / 2026-03-10 | 2026-02-25 | 442 | Índice de productos en francés: árbol de categorías (modal) y tarjetas de las 11 familias con recuento y extracto. | Pobre como texto (igual que el ES) y con errores de traducción en nombres de subcategoría ('Double onduleur', 'Porté', 'Prises'); canónica a la URL inglesa. | automática sospechosa | Regenerar desde datos |
| `/fr/projets-cles-en-main/` | 15752 | Torivac_Projets entrepreneuriaux | Projets clés en main | 2025-11-03 / 2026-03-09 | 2026-04-14 (posterior) | 228 | Describe en francés la oferta de proyectos llave en mano y a medida (diseño, fabricación y puesta en marcha) y la colaboración con clientes y aliados. | Buena. Fiel; botón mal traducido ('à l'adresse suivante'), cuatro nombres para la misma sección e imágenes anteriores a las del ES. | ok | Copiar con correcciones |
| `/fr/blog/` | 15825 | Torivac_Blog | (sin H1) Réglementation des transformateurs él… | 2024-06-25 / 2026-03-10 | 2026-03-10 | 139 | Índice del blog en francés: rejilla de entradas (10 en la primera página; hay 3 páginas) con imagen, fecha, título y botón 'Leer más'. | Sin texto propio (rejilla automática). Fechas ya en francés, pero 'Leer más' en español y 'Do you like it?' en inglés. | parcial | Regenerar desde datos |
| `/fr/contactez-nous/` | 15739 | Torivac Contact | (sin H1) CONTACTEZ-NOUS | 2025-11-03 / 2026-03-13 | 2026-03-13 | 162 | Página de contacto en francés: formulario, texto de acompañamiento, dirección, teléfono, correo y mapa de Google embebido. | Correcta y completa en datos. Restos en español en las etiquetas del formulario, dirección con dos redacciones y mapa con título en español. | parcial | Copiar con correcciones |
| `/fr/politique-de-confidentialite/` | 15709 | Politique de confidentialité | (sin H1) Politique de confidentialité | 2025-12-10 / 2026-03-09 | 2025-12-10 | 954 | Política de privacidad en francés (RGPD): responsable, principios, datos recogidos, legitimación, derechos y fecha de actualización (diciembre 2025). | Traducción fluida de una plantilla incompleta: titular sin nombre, 'correodelcliente' sin resolver, 'TORIVAC GROUP' y mezcla GDPR/RGPD. | ok | Revisión legal antes de migrar |
| `/fr/politica-de-cookies/` | 15829 | Politique en matière de cookies | (sin H1) POLITIQUE EN MATIÈRE DE COOKIES | 2022-12-16 / 2022-12-16 | 2025-02-11 (posterior) | 643 | Política de cookies genérica en francés: qué son las cookies, cookies propias, de redes sociales (con enlaces a sus políticas) y cómo desactivarlas. | Traducción fluida con un encabezado erróneo ('Vos propres biscuits'); plantilla genérica sin inventario de cookies; canónica a la URL española. | automática sospechosa | Retraducir tras corregir el ES |
| `/fr/declaracion-de-accesibilidad/` | 15701 | Déclaration d’accessibilité | (sin H1) Déclaration d'accessibilité | 2025-12-10 / 2026-03-09 | 2025-12-10 | 695 | Declaración de accesibilidad en francés conforme al RD 1112/2018: situación de cumplimiento, contenido no accesible, método de evaluación y vías de contacto. | Traducción fiel de una plantilla del sector público con afirmaciones contradictorias ('partiellement conforme' y 'Conforme à 100%'). | ok | Retraducir tras corregir el ES |

### 2.2 Entradas del blog (21)

Todas están en la categoría `blog` (id 605), firmadas por el autor WordPress 'Franco Santiso' (heredado del ES) y con una imagen destacada. Orden: más recientes primero. Todas tienen el slug en español bajo `/fr/`.

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. FR | Modif. ES | Pal. | Qué dice | Calidad del texto | Traducción | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|
| `/fr/normativas-sobre-transformadores-electricos-en-europa/` | 16026 | Réglementation des transformateurs électrique… | (sin H1) Réglementation des transformateurs él… | 2025-12-29 / 2026-03-23 | 2026-03-23 | 1056 | Artículo SEO en francés que presenta el marco normativo europeo/español de los transformadores y posiciona a Torivac como asesor y proveedor certificado frente a importaciones asiáticas. | Texto SEO de plantilla. 'Variadores' vertido como 'variateurs' y como 'onduleurs' en el mismo artículo; cita EN 50588-1 y Reglamento (UE) 2019/1783 sin vincularlos a ningún producto. | automática sospechosa | Retraducir tras corregir el ES |
| `/fr/mantenimiento-de-transformadores-electricos/` | 15952 | Maintenance des transformateurs électriques | (sin H1) Maintenance des transformateurs élect… | 2025-12-29 / 2026-03-23 | 2025-12-29 | 1158 | Artículo SEO en francés sobre la importancia del mantenimiento preventivo/correctivo de transformadores que presenta a Torivac como proveedor de servicios de mantenimiento. | Texto SEO de plantilla. Atribuye servicios de mantenimiento (termografía, aceite dieléctrico) sin respaldo; frase repetida y encabezado en minúscula. | ok | Retraducir tras corregir el ES |
| `/fr/como-extender-la-vida-util-de-un-transformador/` | 15988 | Comment prolonger la durée de vie d’un transf… | (sin H1) Comment prolonger la durée de vie d’u… | 2025-12-29 / 2026-03-23 | 2025-12-29 | 1002 | Artículo SEO en francés sobre cómo prolongar la vida útil de un transformador que promociona los 'transformadores de larga duración con garantía extendida' de Torivac. | Texto SEO de plantilla. 'Garantie étendue' y 'processus certifiés' sin respaldo; compara con 'un transformateur chinois générique'. | ok | Retraducir tras corregir el ES |
| `/fr/impacto-medioambiental-de-los-transformadores-hoy/` | 16138 | L’impact environnemental des transformateurs… | (sin H1) L’impact environnemental des transfor… | 2025-12-29 / 2026-03-23 | 2025-12-29 | 1102 | Artículo SEO en francés sobre el impacto ambiental de los transformadores y la regulación europea; presenta a Torivac como fabricante sostenible. | Texto SEO de plantilla. Materiales ecológicos, trazabilidad total y ODS 7 sin evidencia: riesgo de greenwashing. | ok | Retraducir tras corregir el ES |
| `/fr/funcionamiento-de-un-transformador-en-la-industria/` | 16047 | Fonctionnement d’un transformateur : les clés… | (sin H1) Fonctionnement d’un transformateur :… | 2025-12-29 / 2026-03-23 | 2025-12-29 | 1440 | Artículo SEO en francés sobre el funcionamiento de un transformador en entornos industriales, dirigido a contratistas eléctricos, con promoción de la asesoría técnica de Torivac. | Comercial, no explica el funcionamiento. 'Variadores' vertido como 'onduleurs' y 'entraînements'; desprecia el soporte técnico asiático. | automática sospechosa | Retraducir tras corregir el ES |
| `/fr/seguridad-en-el-uso-de-transformadores/` | 16121 | Sécurité dans l’utilisation des transformateu… | (sin H1) Sécurité dans l’utilisation des trans… | 2025-12-20 / 2026-03-23 | 2025-12-20 | 1148 | Artículo SEO en francés sobre seguridad de transformadores en instalaciones críticas que promociona los 'transformadores con protección avanzada' de Torivac. | Texto SEO de plantilla. Protecciones concretas sin ficha; confunde normas con directivas; Torivac aparece como 'fabricant espagnol' y como europeo. | ok | Retraducir tras corregir el ES |
| `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 16137 | Limites d’un transformateur et leur influence… | (sin H1) Limites d’un transformateur et leur i… | 2025-12-20 / 2026-03-23 | 2025-12-20 | 879 | Artículo SEO en francés sobre los límites operativos de un transformador (térmicos, dieléctricos) orientado a proyectos de energía renovable; promociona la personalización de Torivac. | Vago y comercial; afirma conformidad 'normes CE' en general; frase confusa heredada del ES. | ok | Retraducir tras corregir el ES |
| `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 16025 | Défauts courants des transformateurs et leurs… | (sin H1) Défauts courants des transformateurs… | 2025-12-20 / 2026-03-23 | 2025-12-20 | 1054 | Artículo SEO en francés sobre fallos frecuentes de transformadores y sus soluciones, orientado a universidades y centros de investigación, que promociona un servicio de diagnóstico y reparación de Torivac. | Palabra clave repetida de forma mecánica (unas diez veces) y público incoherente (universidades); 'service de diagnostic et de réparation' sin respaldo. | ok | Retraducir tras corregir el ES |
| `/fr/eficiencia-de-los-transformadores-clave-en-europa/` | 16114 | L’efficacité des transformateurs : un élément… | (sin H1) L’efficacité des transformateurs : un… | 2025-12-20 / 2026-03-23 | 2025-12-20 | 1019 | Artículo SEO en francés sobre eficiencia energética de transformadores dirigido a distribuidores eléctricos; presenta a Torivac como fabricante de alta eficiencia conforme a Ecodesign. | Texto SEO de plantilla. 'Directive Ecodesign' y eficiencia 'prouvée' sin datos; dos superlativos distintos ('leader européen', 'l'un des rares'). | ok | Retraducir tras corregir el ES |
| `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 16009 | Comment améliorer un transformateur grâce à d… | (sin H1) Comment améliorer un transformateur g… | 2025-12-20 / 2026-03-23 | 2025-12-20 | 1135 | Artículo SEO en francés sobre cómo mejorar o modernizar un transformador existente; presenta a Torivac como prestador de servicios de optimización y reparación. | Atribuye reparación y modernización (réimprégnation sous vide…) sin respaldo y clientes anónimos que 'font état d'une diminution notable'. | ok | Retraducir tras corregir el ES |
| `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | 16087 | Fabrication d’un transformateur : processus e… | (sin H1) Fabrication d’un transformateur : pro… | 2025-12-20 / 2026-03-23 | 2025-12-20 | 999 | Artículo SEO en francés que describe a alto nivel cómo se fabrica un transformador y presenta a Torivac como fabricante a medida con 'calidad certificada'. | Descripción genérica del proceso; certificaciones y presencia en varios países sin concretar. | ok | Retraducir tras corregir el ES |
| `/fr/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 16034 | Applications des transformateurs dans l’indus… | (sin H1) Applications des transformateurs dans… | 2025-12-19 / 2026-03-23 | 2025-12-19 | 999 | Artículo SEO en francés sobre aplicaciones industriales de los transformadores (generación, hospitales, ferrocarril, logística) que presenta a Torivac como referencia de fiabilidad. | Aplicaciones genéricas de potencia y distribución (hospitales, ferrocarril), no del catálogo real. | ok | Retraducir tras corregir el ES |
| `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` | 16008 | Matériaux des transformateurs : la clé de la… | (sin H1) Matériaux des transformateurs : la cl… | 2025-12-19 / 2026-03-23 | 2025-12-19 | 1368 | Artículo SEO en francés sobre el papel de los materiales (acero al silicio, cobre esmaltado, aislamientos) en el rendimiento de un transformador y la superioridad de los materiales de Torivac. | Mezcla datos técnicos genéricos con ensayos no documentados y una generalización sobre fábricas chinas (riesgo legal); título redundante. | ok | Retraducir tras corregir el ES |
| `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 16033 | A quoi sert un transformateur ? Découvrez sa… | (sin H1) A quoi sert un transformateur ? Décou… | 2025-12-19 / 2026-03-23 | 2025-12-19 | 1029 | Artículo SEO en francés que explica brevemente para qué sirve un transformador (adaptar la tensión) y orienta la compra hacia Torivac frente a importadores. | La función se explica en un párrafo; el resto es comercial ('manque alarmant') sin fuente. | ok | Retraducir tras corregir el ES |
| `/fr/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | 16007 | Torivac consolide son leadership dans le sect… | (sin H1) Torivac consolide son leadership dans… | 2025-06-03 / 2026-03-23 | 2025-12-16 | 617 | Nota corporativa en francés sobre la participación de Torivac en la feria Coiltech Deutschland 2025 (Messe Augsburg) y su estrategia de internacionalización. | Noticia con hechos verificables. Nombres propios en minúscula (heredado), título SEO distinto del visible e imagen sin alt. | ok | Copiar con correcciones |
| `/fr/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 16031 | Torivac à Matelec 2024 – Explorer le marché e… | (sin H1) Torivac à Matelec 2024 – Explorer le… | 2024-11-22 / 2026-03-23 | 2025-12-19 | 474 | Crónica corporativa en francés de la visita de Torivac a la feria Matelec 2024 (Madrid), con valoración negativa de la organización. | Texto humano pero crítico con el organizador. Enlace 'Matelec 2024' duplicado por la traducción; sin meta description. | ok | No migrar |
| `/fr/torivac-en-beyond-catalonia/` | 16071 | Torivac dans l’au-delà de la Catalogne | (sin H1) Torivac dans l’au-delà de la Catalogne | 2024-11-18 / 2026-03-23 | 2025-12-19 | 981 | Nota corporativa en francés sobre la participación de Torivac en Beyond Catalonia (ACCIÓ, World Trade Center Barcelona) y su estrategia de expansión internacional. | Texto humano útil, pero con el nombre del evento traducido ('l'au-delà de la Catalogne') en título, H3 y SEO; errata 'Catalona' heredada. | automática sospechosa | Copiar con correcciones |
| `/fr/estabilizadores-de-tension-con-cobre/` | 15995 | Stabilisateurs de tension en cuivre | (sin H1) Stabilisateurs de tension en cuivre | 2024-11-12 / 2026-03-23 | 2025-12-19 | 702 | Artículo en francés sobre estabilizadores de tensión 'en cobre' y sus ventajas operativas para infraestructuras. | Texto de producto razonable con una afirmación técnica imprecisa ('réguler la tension à l'aide du cuivre') y título SEO con marcadores sin resolver. | ok | Copiar con correcciones |
| `/fr/estabilizadores-de-tension/` | 16052 | Les stabilisateurs de tension garantissent un… | (sin H1) Les stabilisateurs de tension garanti… | 2024-11-05 / 2026-03-23 | 2025-12-19 | 806 | Artículo en francés que explica qué es un estabilizador de tensión, en qué se diferencia de un protector de tensión y cómo beneficia a las grandes infraestructuras. | Describe un estabilizador de tomas que no corresponde a las series AVS/BAVS; subtítulos que no son encabezados; bloque corporativo duplicado. | ok | Retraducir tras corregir el ES |
| `/fr/descargadores-de-bateria/` | 16059 | Déchargeurs de batterie Torivac | (sin H1) Déchargeurs de batterie Torivac | 2024-10-10 / 2026-03-23 | 2025-12-19 | 993 | Artículo en francés sobre descargadores de batería (simulación de carga y pruebas de baterías) presentados como producto de Torivac. | Describe un producto sin ficha ni categoría en el catálogo; el término 'déchargeur' no figura en el catálogo FR; alt descriptivo en francés. | ok | Retraducir tras corregir el ES |
| `/fr/la-importancia-del-transformador-toroidal-en-la-industria/` | 15994 | L’importance du transformateur torique dans l… | (sin H1) L’importance du transformateur toriqu… | 2024-06-25 / 2026-03-23 | 2025-12-19 | 489 | Artículo en francés que explica por qué importa el transformador toroidal, cómo elegirlo y en qué se diferencia del convencional. | El más cercano al producto real (toroidal frente a convencional). Frase duplicada y dos 'ici' sin enlace. | ok | Copiar con correcciones |

### 2.3 Piezas técnicas y piezas ES sin equivalente FR

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. FR | Modif. ES | Pal. | Qué dice | Calidad del texto | Traducción | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|
| `/fr/category/blog/` | 605 | blog - Torivac | (sin encabezado) | — / — | — | — | Archivo de la categoría de entradas 'blog' (id 605): listado paginado de las 21 entradas FR, sin texto propio (el texto capturado es solo el pie). | Archivo de taxonomía sin texto propio. | n/a | Regenerar desde datos |
| `/fr/category/non-classifiee/` | 133 | Non classifié(e) - Torivac | (sin encabezado) | — / — | — | — | Archivo de la categoría vacía 'Non classifié(e)' (id 133), sin texto propio (el texto capturado es solo el pie). | Archivo vacío por defecto de WordPress. | n/a | No migrar |

Piezas que existen en el ES y no tienen equivalente en los datos FR:

| Pieza ES | Estado en francés |
|---|---|
| `/aviso-legal-2/` (Aviso legal) | No existe traducción FR (solo DE). El pie FR enlaza a la URL española. |
| `/confirmar/` (checkout) y `/shop/` | Sin página FR en los datos (las capturas ES devuelven plantillas EN). Solo se inventarían en el ES. |
| `/category/sin-categorizar/` | Existe como `/fr/category/non-classifiee/` (arriba). |
| `/elementor-hf/header/` y `/elementor-hf/footer-blog/` | No cosechadas como piezas FR; cabecera y pies se reconstruyen del HTML (sección 8). |

## 3. Qué copiar y qué reescribir

Ninguna pieza FR se copia literalmente: hasta las mejores heredan erratas del ES o llevan defectos de traducción. El criterio es el esfuerzo que exige la migración y la dependencia del ES: **si el ES se reescribe o se valida, el FR se traduce desde esa versión; no se corrige el francés actual**.

Resumen operativo:

| Qué hacer | Piezas | Cómo |
|---|---|---|
| Copiar casi tal cual | Notre entreprise; Projets clés en main; Contactez-nous (datos de contacto y mapa) | Solo retoques de enlaces (a rutas /fr/), CTA, título SEO y meta description |
| Copiar corrigiendo la traducción | Portada; Coiltech; Beyond Catalonia; Stabilisateurs en cuivre; Importance du transformateur torique | Nombres de familia y de evento, mayúsculas, bloques duplicados, formulario |
| Retraducir desde el ES corregido (no copiar el FR) | 14 artículos SEO de plantilla (19-29/12/2025), Stabilisateurs de tension, Déchargeurs de batterie, política de cookies y declaración de accesibilidad | Esperar la decisión del ES y traducir con el glosario de la sección 5 |
| Regenerar desde datos | Índice de productos, índice del blog, archivo de la categoría `blog` | Generar con interfaz en francés |
| Revisión legal | Política de privacidad (y aviso legal, que no existe en FR) | Asesor + datos de empresa |
| No migrar | Matelec (decisión del cliente) y la categoría vacía `non-classifiee` | — |

**Copiar con correcciones (8)**. El texto es útil y verificable. Se migra el `full_text` corrigiendo lo indicado y sincronizando con las decisiones del ES.

- `/fr/`: Copiar la estructura y el texto corrigiendo los tres nombres de familia (variateurs de tension, selfs toriques, supports pour LED), diferenciando los tres CTA, enlazando todo a rutas /fr/ y al catálogo FR, y regenerando el formulario. Seguir además las correcciones que se decidan en el ES ('Potenciómentros', 'Catalogo', 'te la resolveremos').
- `/fr/notre-entreprise/`: Es la mejor pieza FR de las páginas: copiar casi tal cual. Corregir 'Grupor' del título SEO, rellenar la meta description, enlazar el CTA a /fr/contactez-nous/ y unificar 'variateurs de tension' en misión y subtítulo. Mantener sincronizada con las decisiones del ES (cifras de años, clientes).
- `/fr/projets-cles-en-main/`: Copiar el texto. Corregir el CTA ('Nous contacter'), enlazarlo a /fr/contactez-nous/, unificar el nombre de la sección, corregir 'Grupor', añadir meta description y alt a las imágenes (se rehacen con las imágenes ES actuales).
- `/fr/contactez-nous/`: Mantener datos de contacto y mapa (título del mapa en francés); hacer clicables teléfono y correo, enlazar el consentimiento a la política FR, añadir H1, unificar la dirección ('6e étage'), y rehacer el formulario con etiquetas en francés.
- `/fr/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/`: Copiar con mayúsculas corregidas (Coiltech Deutschland, Europe, Torivac), título SEO alineado con el H1, fecha visible y foto con alt en francés. Mantener la sincronía con el ES.
- `/fr/torivac-en-beyond-catalonia/`: Hechos verificables (evento, organizador, lugar). Copiar corrigiendo el nombre propio del evento, 'Beyond Catalonia' (sin traducir) en título, H3 y SEO, el tiempo verbal y eliminando el bloque corporativo duplicado. Misma decisión que en el ES.
- `/fr/estabilizadores-de-tension-con-cobre/`: Misma decisión que el ES: corregir la afirmación del cobre con ingeniería, limpiar el título SEO y quitar el bloque corporativo duplicado.
- `/fr/la-importancia-del-transformador-toroidal-en-la-industria/`: Como en el ES: corregir la sintaxis, enlazar de verdad a las categorías de transformadores y a /fr/contactez-nous/ y fijar un único término ('torique').

**Regenerar desde datos (3)**. No se copia: la web nueva lo genera desde los datos.

- `/fr/produits-torivac/`: No copiar. Regenerar desde los datos de catálogo (S2) con nombres FR validados (glosario de la sección 5 de esta documentación). Reutilizar solo los nombres de familia corregidos.
- `/fr/blog/`: Generar el índice desde las entradas migradas con interfaz en francés ('Lire la suite', fechas en formato FR). No copiar.
- `/fr/category/blog/`: Archivo de taxonomía: la web nueva generará su propio listado de entradas en francés.

**Revisión legal antes de migrar (1)**. Texto jurídico con huecos. Datos de empresa y revisión de un asesor antes de publicar.

- `/fr/politique-de-confidentialite/`: Texto legal: revisión de un asesor y datos de empresa completos (razón social, correo de derechos) antes de publicar. La versión FR se traduce desde la versión ES revisada, no desde esta.

**Retraducir tras corregir el ES (18)**. El ES decide su futuro (reescribir, dejar como propuesta en admin o validar con el cliente). El FR actual solo sirve de referencia de estructura; el texto se traduce desde la versión ES final con el glosario de la sección 5.

- `/fr/politica-de-cookies/`: El ES se reescribe con el banner de consentimiento de la web nueva (inventario real de cookies); la versión FR se traduce desde esa versión, con 'cookies' y enlaces a las políticas de terceros en francés.
- `/fr/declaracion-de-accesibilidad/`: El ES se reescribe tras auditar la web nueva (WCAG 2.1 AA); la versión FR se traduce desde esa versión.
- `/fr/normativas-sobre-transformadores-electricos-en-europa/`: El ES se reescribe con datos verificables o se deja como propuesta en admin; la FR se traduce desde esa versión.
- `/fr/mantenimiento-de-transformadores-electricos/`: Propuesta en admin en el ES: no publicar sin confirmar que Torivac ofrece mantenimiento. La FR se traduce desde la versión validada.
- `/fr/como-extender-la-vida-util-de-un-transformador/`: Propuesta en admin en el ES (no publicar sin validar la garantía extendida). La FR se traduce desde la versión validada.
- `/fr/impacto-medioambiental-de-los-transformadores-hoy/`: Propuesta en admin en el ES (greenwashing): no publicar sin validar. La FR se traduce desde la versión validada.
- `/fr/funcionamiento-de-un-transformador-en-la-industria/`: El ES se reescribe con contenido técnico verificado; la FR se traduce desde esa versión (con 'variateur de tension').
- `/fr/seguridad-en-el-uso-de-transformadores/`: Propuesta en admin en el ES: no publicar sin validar protecciones y normas. La FR se traduce desde la versión validada.
- `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/`: Reescribir en el ES con datos de fichas técnicas; la FR se traduce desde esa versión.
- `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/`: Propuesta en admin en el ES: no publicar sin validar el servicio. La FR se traduce desde la versión validada.
- `/fr/eficiencia-de-los-transformadores-clave-en-europa/`: Propuesta en admin en el ES: reescribir con datos de fichas técnicas. La FR se traduce desde esa versión.
- `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/`: Propuesta en admin en el ES (no publicar sin validar los servicios). La FR se traduce desde la versión validada.
- `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/`: Sustituir por una descripción real del proceso (bobinado, encapsulado, ensayos) validada por el cliente en el ES; la FR se traduce desde ella.
- `/fr/aplicaciones-de-los-transformadores-en-la-industria-actual/`: Seguir el ES (reescribir con aplicaciones reales de las fichas). La FR se traduce desde esa versión.
- `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/`: Propuesta en admin en el ES: reescribir con materiales reales de las fichas. La FR se traduce desde esa versión.
- `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/`: El ES se reescribe con una explicación didáctica real; la FR se traduce desde ella.
- `/fr/estabilizadores-de-tension/`: El ES se reescribe con la descripción real de las series AVS/BAVS; la versión FR se traduce desde ella.
- `/fr/descargadores-de-bateria/`: Propuesta en admin (no publicar sin validar) según el ES: confirmar con el cliente si 'descargadores de batería' es un producto real. Después, traducir desde el ES validado con el término FR acordado.

**No migrar (2)**. Sin valor editorial o con riesgo reputacional; decisión final del cliente.

- `/fr/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/`: Seguir la decisión del ES: tono negativo hacia el organizador; recomendado reescribir en tono neutral o retirar (decisión del cliente). Si se mantiene, FR se traduce desde la versión ES final.
- `/fr/category/non-classifiee/`: Archivo vacío por defecto de WordPress; no migrar.

## 4. Comparación con la versión ES

### 4.1 Estructura, fechas e imágenes

Comparación automática de cada pieza FR con su original ES (`comparison_with_es` en el JSON). `Δ días` = fecha ES menos fecha FR (positivo: el ES es posterior).

| Pieza | Modif. FR | Modif. ES | Δ días | Encabezados FR/ES (niveles) | Líneas FR/ES | Imágenes distintas (solo FR / solo ES) | Estado |
|---|---|---|---|---|---|---|---|
| `/fr/` | 2026-03-13 | 2026-10-14 | 214 | 23/23 (iguales) | 52/56 | 12/13 | ES más reciente: hero e imágenes (texto igual) |
| `/fr/notre-entreprise/` | 2026-03-09 | 2026-03-08 | -2 | 9/9 (iguales) | 20/20 | 0/0 | Al día |
| `/fr/produits-torivac/` | 2026-03-10 | 2026-02-25 | -14 | 14/14 (iguales) | 106/107 | 7/7 | Al día |
| `/fr/projets-cles-en-main/` | 2026-03-09 | 2026-04-14 | 35 | 6/6 (iguales) | 15/15 | 4/2 | ES más reciente: 2 imágenes nuevas (texto igual) |
| `/fr/blog/` | 2026-03-10 | 2026-03-10 | -1 | 10/10 (iguales) | 26/26 | 0/0 | Al día |
| `/fr/contactez-nous/` | 2026-03-13 | 2026-03-13 | -1 | 4/4 (iguales) | 21/15 | 0/0 | Al día |
| `/fr/politique-de-confidentialite/` | 2026-03-09 | 2025-12-10 | -90 | 1/1 (iguales) | 51/51 | 0/0 | Al día |
| `/fr/politica-de-cookies/` | 2022-12-16 | 2025-02-11 | 787 | 5/5 (iguales) | 19/30 | 2/1 | Metadato FR de 2022; texto de 2025 |
| `/fr/declaracion-de-accesibilidad/` | 2026-03-09 | 2025-12-10 | -90 | 1/1 (iguales) | 47/47 | 0/0 | Al día |
| `/fr/normativas-sobre-transformadores-electricos-en-europa/` | 2026-03-23 | 2026-03-23 | -1 | 5/5 (iguales) | 13/13 | 0/0 | Al día |
| `/fr/mantenimiento-de-transformadores-electricos/` | 2026-03-23 | 2025-12-29 | -85 | 5/5 (iguales) | 40/40 | 0/0 | Al día |
| `/fr/como-extender-la-vida-util-de-un-transformador/` | 2026-03-23 | 2025-12-29 | -85 | 5/5 (iguales) | 21/21 | 0/0 | Al día |
| `/fr/impacto-medioambiental-de-los-transformadores-hoy/` | 2026-03-23 | 2025-12-29 | -85 | 5/5 (iguales) | 23/23 | 0/0 | Al día |
| `/fr/funcionamiento-de-un-transformador-en-la-industria/` | 2026-03-23 | 2025-12-29 | -85 | 6/6 (iguales) | 20/20 | 0/0 | Al día |
| `/fr/seguridad-en-el-uso-de-transformadores/` | 2026-03-23 | 2025-12-20 | -93 | 4/4 (iguales) | 30/30 | 0/0 | Al día |
| `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 2026-03-23 | 2025-12-20 | -93 | 5/5 (iguales) | 30/30 | 0/0 | Al día |
| `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 2026-03-23 | 2025-12-20 | -93 | 5/5 (iguales) | 25/25 | 0/0 | Al día |
| `/fr/eficiencia-de-los-transformadores-clave-en-europa/` | 2026-03-23 | 2025-12-20 | -93 | 5/5 (iguales) | 27/27 | 0/0 | Al día |
| `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 2026-03-23 | 2025-12-20 | -93 | 4/4 (iguales) | 24/24 | 0/0 | Al día |
| `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | 2026-03-23 | 2025-12-20 | -93 | 5/5 (iguales) | 23/23 | 0/0 | Al día |
| `/fr/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 2026-03-23 | 2025-12-19 | -94 | 5/5 (iguales) | 21/21 | 0/0 | Al día |
| `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` | 2026-03-23 | 2025-12-19 | -94 | 8/8 (iguales) | 34/34 | 0/0 | Al día |
| `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 2026-03-23 | 2025-12-19 | -94 | 5/5 (iguales) | 13/13 | 0/0 | Al día |
| `/fr/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | 2026-03-23 | 2025-12-16 | -98 | 2/2 (iguales) | 12/12 | 0/0 | Al día |
| `/fr/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 2026-03-23 | 2025-12-19 | -94 | 4/4 (iguales) | 18/18 | 0/0 | Al día |
| `/fr/torivac-en-beyond-catalonia/` | 2026-03-23 | 2025-12-19 | -94 | 6/6 (iguales) | 26/26 | 0/0 | Al día |
| `/fr/estabilizadores-de-tension-con-cobre/` | 2026-03-23 | 2025-12-19 | -94 | 5/5 (iguales) | 19/19 | 0/0 | Al día |
| `/fr/estabilizadores-de-tension/` | 2026-03-23 | 2025-12-19 | -94 | 1/1 (iguales) | 19/19 | 0/0 | Al día |
| `/fr/descargadores-de-bateria/` | 2026-03-23 | 2025-12-19 | -94 | 6/6 (iguales) | 24/24 | 0/0 | Al día |
| `/fr/la-importancia-del-transformador-toroidal-en-la-industria/` | 2026-03-23 | 2025-12-19 | -94 | 4/4 (iguales) | 15/15 | 0/0 | Al día |

Secciones ausentes en francés: **ninguna**. Secciones desactualizadas: **ninguna de texto**. Las diferencias de líneas son ruido: la portada y contacto (formulario), productos (menú) y cookies (el análisis del HTML solo recoge el pie; el texto sale de REST).

Particularidades de fechas:

- Las 21 entradas FR se modificaron el 2026-03-23 entre las 15:52:28 y las 15:59:12, es decir, 85 a 98 días después que las ES (todas de diciembre de 2025 salvo la de normativas, modificada el mismo 23/03/2026 unos 40 minutos antes). Es coherente con un lote de traducción posterior; no hay entradas FR desfasadas respecto al ES.
- La portada ES se modificó el 2026-10-14 (214 días después de la FR) y la de proyectos el 2026-04-14 (35 días): el texto es el mismo, pero el ES ya usa las imágenes WebP optimizadas de abril de 2026 y el FR conserva JPG/PNG anteriores. Además, el contenedor del hero de la portada ES se rehízo (6 identificadores de Elementor distintos).
- La política de cookies FR figura como modificada el 2022-12-16, pero su texto cita la plantilla de 11/02/2025 (como el ES, modificado el 2025-02-11): el metadato no refleja la edición real.

### 4.2 Restos de español e inglés dentro del francés

| Elemento | Texto | Dónde | Páginas |
|---|---|---|---|
| Botón de tarjeta del blog | `Leer más` | `/fr/blog/` | 1 |
| Interfaz del plugin de «me gusta» | `Do you like it?` (inglés) | `/fr/blog/` | 1 |
| Etiquetas del formulario 16179 | `Correo`, `Mensaje` (visibles a lectores de pantalla) y etiqueta del honeypot `Correo Mensaje Nom` | portada y contacto | 2 |
| Texto de envío del formulario 16206 | `Enviando...` | pie de las entradas | 21 |
| Placeholder del buscador | `Busar` (errata de `Buscar`) | cabecera | 190 |
| Dirección | `Planta 6ª`, `Barcelona` | pie, política de privacidad y archivos | 190 |
| Variable sin resolver | `correodelcliente` | política de privacidad | 1 |
| Banner de cookies (Complianz) | `Gestionar consentimiento`, `Aceptar`, `Denegar`, `Ver preferencias`, `Guardar preferencias` y todos los textos descriptivos | todas | 190 |
| `aria-label` del menú y del idioma | `Abrir menú`, `Idioma actual: Español` (anuncia español como idioma actual) | todas | 190 |
| Mapa | `title` y `aria-label` del iframe en español/catalán | contacto | 1 |
| Enlaces a políticas de terceros | `twitter.com/es/privacy`, `hl=es-419`, `pinterest.com/es/` | política de cookies | 1 |
| Nombres de archivo y slugs | `declaracion-de-accesibilidad`, `politica-de-cookies` y los 21 slugs de las entradas en español bajo `/fr/` | URLs | 23 |

El cuerpo de los artículos está íntegramente en francés: el escaneo de palabras vacías en español no encontró frases en español en ninguna entrada.

### 4.3 Diferencias en los datos de empresa respecto al ES

| Dato | FR | ES | ¿Coincide? |
|---|---|---|---|
| Razón social | «Groupe Torivac» (accesibilidad, SEO), «TORIVAC GROUP» (privacidad), «Grupor Torivac» (SEO), «Torivac S.L» (JSON-LD) | «GRUPO TORIVAC», «Grupo Torivac», «Grupor Torivac», «Torivac S.L.» (pie) | No: el FR traduce el nombre y no lleva el pie con «Torivac S.L.» |
| NIF | B60784584 (sin nombre de titular) | B60784584 (titular en blanco) | Sí |
| Dirección | contacto: «C/ Potosi Nº 2, 6ème étage, 08030 Barcelone»; pie y privacidad: «C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» | «C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» | Mismo domicilio; redacción distinta en contacto |
| Teléfono | +34 93 312 01 61 | +34 93 312 01 61 | Sí |
| Correo | info@torivac.com | info@torivac.com | Sí |
| Redes sociales | Ninguna (icono de LinkedIn sin enlace, 380 apariciones) | Ninguna (icono de LinkedIn sin enlace) | Sí |
| Horarios | No constan | No constan | Sí |
| Trayectoria | 1964; «plus de 60 ans»; «plus d’un demi-siècle»; «près de 60 ans» | 1964; «más de 60 años»; «más de medio siglo»; «cerca de 60 años» | Sí (mismo desorden de cifras) |
| Presencia internacional | «plus de 30 pays»; «cinq continents» | «más de 30 países»; «5 continentes» | Sí |
| Dirección de la empresa | M. Ramón Zamora | D. Ramón Zamora | Sí |
| Financiación pública (ICEX-Next / FEDER) | **Ausente** (logotipo antiguo, sin texto) | Texto + logotipo `MANUAL-FEDER-ICEX-NEXT-2027.jpeg` en 186 de 208 páginas | **No** |
| Catálogo PDF | Menú: `Torivac_2024_FR.pdf`; botón de la portada: `Torivac_2024.pdf` (español) | `Torivac_2024.pdf` | Incoherente en FR |
| GA4 / GTM | G-QXLKHV4Y7X / GTM-K93FKL89 | iguales | Sí |

## 5. Glosario terminológico

Los errores de traducción más dañinos son de vocabulario técnico. El catálogo francés de la empresa (`Torivac_2024_FR.pdf`) es la mejor referencia disponible, aunque tiene residuos propios (títulos en inglés en las p. 26 y 31 y «Onduleur triphasé» en la p. 12), de modo que se cita como apoyo y no como norma. Propuesta provisional; la fija el cliente.

| ES | FR en la web actual | FR en el catálogo FR | Propuesta | Gravedad |
|---|---|---|---|---|
| Variador de tensión | «Entraînements à tension variable» (portada); «Double onduleur», «Entraînements triphasés», «Onduleurs monophasés» (índice de productos); «onduleurs» y «entraînements» (2 entradas); «régulateurs de tension toroïdaux» (empresa); «variateurs de vitesse à tension…» (extracto) | «Variateur de tension torique» (p. 2); sección «AUTOTRANSFORMATEURS VARIABLES» (p. 2-4); pero el pie de las figuras de la p. 12 dice «Onduleur triphasé» | variateur de tension (autotransformateur variable) | alta |
| Choques toroidales | «Chocs toroïdaux» (portada); «Inductances \| Réactances toroïdales» (índice); «bobines d’inductance» (empresa) | «SELFS TORIQUES» (p. 20-22) | selfs toriques | alta |
| Portaleds / soportes metálicos para LED | «Portails» (portada); «Porté» (índice) | «SUPPORTS MÉTALLIQUES POUR LEDS» (p. 34), «SUPPORT MÉTAL POUR LED» (p. 38) | supports métalliques pour LED | alta |
| Hembrillas | «Prises» (índice); «douilles de sécurité» (extracto) | «FICHES FEMELLE, BANANES & PORTE FUSIBLES» (p. 34 y 40) | fiches femelles / bananes (a confirmar con el cliente) | media |
| Botones de mando | «Boutons de commande» | «BOUTONS DE FONCTIONNEMENT» (p. 34-37) | fijar un único término (decisión del cliente) | baja |
| Transformador / núcleo toroidal | «transformateur torique» (título de una entrada) y «toroïdal» (resto) | «TRANSFORMATEURS TORIQUES» (p. 15), «NOYAUX TORIQUES» (p. 24) | torique (unificar) | baja |
| Bobinas encapsuladas | «Bobines encapsulées» | «BOBINES MOULÉES» (p. 25-26) | fijar uno (decisión del cliente) | baja |
| Cookies propias | «Vos propres biscuits» | — | cookies propres / cookies de première partie | media |
| Beyond Catalonia (nombre del evento de ACCIÓ) | «l’au-delà de la Catalogne» | — | mantener «Beyond Catalonia» sin traducir | alta |
| Descargadores de batería | «déchargeurs de batterie» | No consta (0 apariciones de «décharg» en el catálogo FR) | pendiente: confirmar si es producto real | media |

## 6. Páginas legales

| Página | URL FR | Estado | Hallazgos principales |
|---|---|---|---|
| Aviso legal | — | **No existe en francés** (ES `/aviso-legal-2/`, solo traducida al alemán) | El pie FR enlaza a la URL española; falta cualquier condición general en francés. |
| Política de privacidad | `/fr/politique-de-confidentialite/` | Traducida (ES `/politica-de-privacidad/`) | Titular sin nombre («est détenue par : B60784584»); `correodelcliente` sin resolver; «TORIVAC GROUP»; mezcla GDPR/RGPD; dirección sin traducir; remite a una sección «Utilisation des cookies» inexistente. |
| Política de cookies | `/fr/politica-de-cookies/` | Traducida, con canónica a la URL española | «Vos propres biscuits»; plantilla genérica sin inventario de cookies; enlaces a políticas de terceros en español; metadato de modificación de 2022. |
| Declaración de accesibilidad | `/fr/declaracion-de-accesibilidad/` | Traducida | «partiellement conforme» frente a «Conforme à 100%»; plantilla del sector público de 2024; slug en español. |

La política de cookies no está enlazada desde el pie FR (solo la enlaza el banner de Complianz en ejecución). Los tres textos son plantillas heredadas del ES y requieren revisión profesional antes de publicarse; el francés se traduce desde la versión revisada.

## 7. Cabecera, pie y banner de cookies

**Cabecera** (idéntica en las 190 páginas FR salvo el selector de idioma, que enlaza a la misma página en cada idioma). Logotipo `Torivac_negativo.png` con alt `Torivac_negativo`. Menú, todo en `/fr/`:

| Texto | Destino |
|---|---|
| Accueil | `/fr/` |
| Notre Entreprise | `/fr/notre-entreprise/` |
| Produits | `/fr/produits-torivac/` |
| Projets entrepreneuriaux | `/fr/projets-cles-en-main/` |
| Catalogue | `/wp-content/uploads/2024/10/Torivac_2024_FR.pdf` |
| Blog | `/fr/blog/` |
| Contactez nous | `/fr/contactez-nous/` |

Selector de idioma: English, Français, Español, Deutsch (cada página enlaza a su equivalente; las entradas enlazan a `/en/<slug-español>/`, `/<slug-español>/` y `/de/<slug-español>/`). Banderas con alt en francés («Anglais», «Espagnol», «Allemand»). Buscador con placeholder `Busar`. Dos scripts fijan en español `aria-label="Abrir menú"` y `aria-label="Idioma actual: Español"` en las 190 páginas, de modo que un lector de pantalla anuncia el español como idioma activo de una página francesa.

**Pie de las páginas** (169 de 190 HTML): dos bloques apilados, el de 2025 y el antiguo de 2022.

- Los tres enlaces legales del bloque 2025 apuntan a las URLs españolas (/aviso-legal-2/, /politica-de-privacidad/, /declaracion-de-accesibilidad/) aunque existen /fr/politique-de-confidentialite/ y /fr/declaracion-de-accesibilidad/; no existe aviso legal en francés.
- Falta el símbolo © ('2025 Torivac', '2022 Torivac'; el ES dice '© 2025 Torivac').
- Falta el texto ICEX-Next / FEDER que el pie ES sí lleva; en su lugar, el logotipo antiguo Logotipos_FondosEuropeos.jpg.
- El bloque antiguo de 2022 (con 'Mentions légales' → /aviso-legal/, enlace roto aparente) se muestra además del bloque de 2025, en lugar de sustituirlo.
- Dirección, teléfono y correo coinciden con ES; 'Planta 6ª' y 'Barcelona' sin traducir.

**Pie de las entradas** (21): bloque «CONTACTEZ-NOUS» con el formulario 16206 y dos bloques de 2022.

- La casilla de consentimiento del formulario 16206 dice «Il a accepté et accepté la politique de confidentialité» (tercera persona y repetido); el ES dice «He leído y acepto…» y la portada FR «J’ai lu et j’accepte…».
- El texto del botón durante el envío está en español ('Enviando...').
- El formulario no tiene etiquetas <label> para nombre, correo ni mensaje (solo placeholders).
- El ES usa el formulario 14511 (con captcha aritmético condicional); el FR, el 16206 (reCAPTCHA v3 + honeypot).
- 'Mentions légales' enlaza a /aviso-legal/ (enlace roto aparente).

**Banner de cookies** (Complianz, 190 páginas):

- En el HTML cosechado, el banner de consentimiento de las 190 páginas FR está casi entero en español (título, texto, categorías, descripciones y botones); solo cinco textos secundarios están en francés («Toujours activé» y cuatro enlaces). Es el texto legal de consentimiento más visible del sitio y un visitante francés no lo entiende.
- El HTML estático conserva los marcadores '{title}' y '{vendor_count}'; no hay captura del banner abierto en data/raw/screens para comprobar cómo se resuelven en ejecución.
- Textos en francés: «Gérer les options», «Gérer les services», «Gérer {vendor_count} fournisseurs», «En savoir plus sur ces finalités». Botones en español: «Aceptar», «Denegar», «Ver preferencias», «Guardar preferencias». Marcadores sin resolver: `{title}` (×3) y `{vendor_count}`.

## 8. Hallazgos de calidad

Total: 190 (alta 24, media 107, baja 59). Las banderas de cada pieza están en `quality_flags`; aquí se agrupan por tipo. Las que se generan por regla se agregan (una línea por tema).

### 8.0 Gravedad alta

- `/fr/` (translation): 'Variadores de tensión' (familia de producto) traducido como 'Entraînements à tension variable' (entraînement = accionamiento/arrastre). El propio hero de la página usa 'variateurs' y el catálogo FR de la empresa usa 'Variateur de tension torique' (p. 2).
- `/fr/` (translation): 'Choques toroidales' traducido como 'Chocs toroïdaux' (choc = golpe/impacto). Un choque en electrónica es una inductancia (self); el catálogo FR de la empresa usa 'Selfs toriques' (p. 20-22) y la propia web FR usa 'Inductances | Réactances toroïdales' en el índice de productos.
- `/fr/` (translation): 'Portaleds' traducido como 'Portails' (portail = portal/portón). Los soportes metálicos para LED se llaman en el catálogo FR 'Support métallique pour LED' (p. 34 y 38).
- `/fr/produits-torivac/` (translation): Variadores de tensión traducidos como 'onduleur' (inversor/SAI) y 'entraînement' en cuatro subcategorías: 'Variador Doble' → 'Double onduleur', 'Variadores Trifásicos' → 'Entraînements triphasés', 'Variadores Monofasicos' → 'Onduleurs monophasés'.
- `/fr/produits-torivac/` (translation): Extracto de la familia de variadores: 'variateurs de vitesse à tension et à variation continue' (un variador de tensión no controla velocidad).
- `/fr/produits-torivac/` (seo): La canónica apunta a una URL en inglés (https://grupotorivac.com/en/torivac-products/) distinta de la URL real de la página (https://grupotorivac.com/fr/produits-torivac/): Google puede consolidar la señal en la otra versión. Mismo patrón que HALLAZGOS.md #11.
- `/fr/politique-de-confidentialite/` (placeholder): Variable sin resolver en el ejercicio de derechos: 'correodelcliente' (no es una dirección de correo).
- `/fr/politique-de-confidentialite/` (legal): Titular del sitio sin nombre: el hueco del ES ('la ostenta: , con NIF: B60784584') queda en FR como 'est détenue par : B60784584'. Falta la razón social.
- `/fr/politica-de-cookies/` (seo): La canónica apunta a una URL en español (https://grupotorivac.com/politica-de-cookies/) distinta de la URL real de la página (https://grupotorivac.com/fr/politica-de-cookies/): Google puede consolidar la señal en la otra versión. Mismo patrón que HALLAZGOS.md #11.
- `/fr/declaracion-de-accesibilidad/` (accuracy): Afirmaciones contradictorias heredadas del ES: 'partiellement conforme' en la situación y 'Conforme à 100%' en el apartado de contenido no accesible.
- `/fr/normativas-sobre-transformadores-electricos-en-europa/` (translation): 'Variadores' traducido como 'onduleurs' (inversores/SAI) en el tercer bloque y como 'variateurs' en el segundo: la misma gama con dos nombres distintos.
- `/fr/normativas-sobre-transformadores-electricos-en-europa/` (unverified_claim): Cumplimiento de EN 50588-1 / Reglamento (UE) 2019/1783 y 'documentation technique reconnue par les organismes de certification européens' sin vincularlo a ningún producto ni documento.
- `/fr/mantenimiento-de-transformadores-electricos/` (unverified_claim): Servicios de mantenimiento (termografía, análisis de aceite dieléctrico, contratos de mantenimiento, informes) no documentados en otras fuentes del sitio ni en el catálogo.
- `/fr/como-extender-la-vida-util-de-un-transformador/` (unverified_claim): 'Garantie étendue' sin plazo ni condiciones ni documento (el catálogo solo recoge una garantía de 12 meses con exclusiones).
- `/fr/impacto-medioambiental-de-los-transformadores-hoy/` (unverified_claim): Afirmaciones ambientales (materiales respetuosos, materias primas reciclables, proceso de baja emisión, trazabilidad completa, ODS 7) sin evidencia: riesgo de greenwashing.
- `/fr/funcionamiento-de-un-transformador-en-la-industria/` (translation): 'Variadores' traducido como 'onduleurs' y como 'entraînements': términos de otro producto (inversor/SAI; accionamiento).
- `/fr/seguridad-en-el-uso-de-transformadores/` (unverified_claim): Atribuye a los transformadores Torivac protección contra sobrecargas y 'mécanismes de détection précoce des courts-circuits' sin ficha técnica que lo respalde.
- `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` (unverified_claim): Atribuye a Torivac un servicio de diagnóstico y reparación inexistente en el resto del sitio.
- `/fr/eficiencia-de-los-transformadores-clave-en-europa/` (unverified_claim): Cumplimiento de la 'directive Ecodesign' y eficiencia 'prouvée' sin datos de pérdidas ni clase de eficiencia.
- `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` (unverified_claim): Atribuye a Torivac servicios de optimización y reparación de transformadores (reimpregnación al vacío, refrigeración, sustitución de aislamiento, diagnóstico) inexistentes en el resto del sitio.
- `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` (reputation): Generalización despectiva sin fuente sobre fábricas chinas: 'de nombreuses usines chinoises évitent ces contrôles afin de réduire les coûts' (riesgo legal).
- `/fr/torivac-en-beyond-catalonia/` (translation): El nombre propio del evento 'Beyond Catalonia' se traduce como 'l’au-delà de la Catalogne' en el título, el H3 y el título SEO; es el nombre oficial del evento de ACCIÓ y no se traduce.
- `/fr/estabilizadores-de-tension-con-cobre/` (seo): Título SEO con marcadores sin resolver: 'Stabilisateurs de tension en cuivre Torivac Torivac Torivac Torivac Torivac %' (77 caracteres).
- `/fr/descargadores-de-bateria/` (unverified_claim): Atribuye a Torivac la fabricación de 'déchargeurs de batterie', producto que no figura en el catálogo ni en ninguna categoría de la web (podría corresponder a bancos de carga).

### 8.1 Errores de traducción

- `/fr/` (alta): 'Variadores de tensión' (familia de producto) traducido como 'Entraînements à tension variable' (entraînement = accionamiento/arrastre). El propio hero de la página usa 'variateurs' y el catálogo FR de la empresa usa 'Variateur de tension torique' (p. 2).
- `/fr/` (alta): 'Choques toroidales' traducido como 'Chocs toroïdaux' (choc = golpe/impacto). Un choque en electrónica es una inductancia (self); el catálogo FR de la empresa usa 'Selfs toriques' (p. 20-22) y la propia web FR usa 'Inductances | Réactances toroïdales' en el índice de productos.
- `/fr/` (alta): 'Portaleds' traducido como 'Portails' (portail = portal/portón). Los soportes metálicos para LED se llaman en el catálogo FR 'Support métallique pour LED' (p. 34 y 38).
- `/fr/produits-torivac/` (alta): Variadores de tensión traducidos como 'onduleur' (inversor/SAI) y 'entraînement' en cuatro subcategorías: 'Variador Doble' → 'Double onduleur', 'Variadores Trifásicos' → 'Entraînements triphasés', 'Variadores Monofasicos' → 'Onduleurs monophasés'.
- `/fr/produits-torivac/` (alta): Extracto de la familia de variadores: 'variateurs de vitesse à tension et à variation continue' (un variador de tensión no controla velocidad).
- `/fr/produits-torivac/` (media): 'Portaled' → 'Porté' (participio de porter); 'Hembrillas' → 'Prises' (el extracto habla de 'douilles de sécurité'); 'Equipos de sobremesa' → 'Équipement de bureau' (la URL usa 'unites-de-paillasse'); 'Aros con flecha' → 'Cerceaux à flèches'; 'Discos Flecha' → 'Disques Arrow'; 'Tapas serie BO' → 'La série BO couvre' (verbo, no sustantivo); 'Caratulas graduadas' → 'Couvertures classées'; 'Estators' se copia como 'Estateurs'.
- `/fr/projets-cles-en-main/` (media): Botón 'Contáctanos' traducido como 'Contactez-nous à l'adresse suivante' (frase incompleta: no sigue ninguna dirección).
- `/fr/politique-de-confidentialite/` (media): El nombre de la empresa se traduce: 'TORIVAC GROUP' (ES 'GRUPO TORIVAC'; el resto del sitio FR usa 'Groupe Torivac').
- `/fr/politica-de-cookies/` (media): 'Cookies propias' traducido como 'Vos propres biscuits' (biscuits = galletas; en francés se dice 'cookies' o 'témoins de connexion'). Es el único encabezado de la política que cambia el sentido.
- `/fr/normativas-sobre-transformadores-electricos-en-europa/` (alta): 'Variadores' traducido como 'onduleurs' (inversores/SAI) en el tercer bloque y como 'variateurs' en el segundo: la misma gama con dos nombres distintos.
- `/fr/funcionamiento-de-un-transformador-en-la-industria/` (alta): 'Variadores' traducido como 'onduleurs' y como 'entraînements': términos de otro producto (inversor/SAI; accionamiento).
- `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` (baja): Título redundante: 'des transformateurs … des transformateurs' (ES 'de un transformador: clave en su rendimiento').
- `/fr/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` (media): El enlace 'Matelec 2024' queda repetido fuera de la frase: 'conférence de Matelec 2024. Matelec 2024.' (artefacto de traducción automática; además añade la palabra 'conférence', que no está en el ES).
- `/fr/torivac-en-beyond-catalonia/` (alta): El nombre propio del evento 'Beyond Catalonia' se traduce como 'l’au-delà de la Catalogne' en el título, el H3 y el título SEO; es el nombre oficial del evento de ACCIÓ y no se traduce.
- `/fr/torivac-en-beyond-catalonia/` (baja): 'transformadores regulables' vertido como 'transformateurs de régulation' (debería ser 'autotransformateurs réglables').

Todos los casos de la sección 5 (glosario) salen de aquí. Los nombres propios (eventos, marcas, normas) no deben traducirse.

### 8.2 Erratas, gramática y estilo

- `/fr/` (style, baja): 'Nos services' encabeza una rejilla de productos (hereda la etiqueta del ES 'Nuestros Servicios') y el bloque contiguo se titula '60 ans d'expérience'.
- `/fr/notre-entreprise/` (typo, media): Errata 'Grupor' en el título SEO (heredada del ES).
- `/fr/notre-entreprise/` (style, baja): Calco del español en el cierre: 'au bénéfice de la construction d'alliances' (ES 'beneficiando la construcción de alianzas').
- `/fr/produits-torivac/` (typo, baja): Subcategorías con minúscula inicial ('led 10mm', 'led 3mm', 'led 5mm', 'led 8mm', 'prise de sécurité HR4') y 'Estateurs' (errata heredada de 'Estators').
- `/fr/projets-cles-en-main/` (typo, media): Errata 'Grupor' en el título SEO (heredada del ES).
- `/fr/projets-cles-en-main/` (typo, baja): Titular que termina en un punto aislado separado por salto de línea: '...de la tension .'
- `/fr/blog/` (typo, baja): Extracto cortado con ' […]' y sin cierre de frase; el contador '0' del plugin forma parte del texto.
- `/fr/normativas-sobre-transformadores-electricos-en-europa/` (typo, baja): Encabezado con 'torivac' en minúscula.
- `/fr/mantenimiento-de-transformadores-electricos/` (typo, baja): Encabezado que empieza en minúscula (heredado del ES).
- `/fr/seguridad-en-el-uso-de-transformadores/` (grammar, baja): Construcción incorrecta: 'en tant qu’un des fabricants espagnols les plus spécialisés qui comprend' (calco del ES).
- `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/` (grammar, baja): Frase confusa: 'La confiance accordée à un fournisseur tel que Torivac ne doit pas être basée sur sa reconnaissance industrielle, mais sur ses capacités techniques concrètes'.
- `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` (grammar, baja): Palabra clave encajada de forma agramatical: 'expert en défauts courants des transformateurs et ses solutions techniques avancées' (concordancia 'ses').
- `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/` (typo, baja): '21e siècle' con cifra arábiga (la grafía francesa correcta es XXIe siècle).
- `/fr/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` (typo, media): Nombres propios en minúscula, heredados del ES: 'coiltech deutschland', 'europe' (Europe) y 'torivac'; el encabezado H3 empieza en minúscula.
- `/fr/torivac-en-beyond-catalonia/` (typo, media): Errata heredada del ES en el nombre del evento: 'Beyond Catalona'.
- `/fr/estabilizadores-de-tension/` (grammar, baja): Concordancia rota: 'En outre, elle contribue à la protection des infrastructures' (sin sujeto femenino previo).
- `/fr/la-importancia-del-transformador-toroidal-en-la-industria/` (grammar, baja): 'Les transformateurs toroïdaux, heureusement pour votre entreprise, ont un noyau circulaire' (inciso confuso, calco del ES).
- Mezcla de apóstrofos rectos y tipográficos en el mismo texto (4 piezas): `/fr/`, `/fr/notre-entreprise/`, `/fr/projets-cles-en-main/`, `/fr/declaracion-de-accesibilidad/`.

### 8.3 Idioma equivocado y restos de otro idioma

- `/fr/` (media): Etiquetas del formulario en español dentro de la portada francesa: 'Correo' y 'Mensaje' (campos nombre y correo/mensaje) y la etiqueta del honeypot 'Correo Mensaje Nom'.
- `/fr/blog/` (media): Botón de la tarjeta en español dentro de la página francesa.
- `/fr/blog/` (media): Texto de interfaz en inglés del plugin de 'me gusta'.
- `/fr/contactez-nous/` (media): Etiquetas del formulario en español ('Correo', 'Mensaje'), exposibles a lectores de pantalla, y etiqueta del honeypot 'Correo Mensaje Nom'.
- `/fr/politique-de-confidentialite/` (baja): La dirección conserva palabras en español ('Planta 6ª', 'Barcelona').
- `/fr/politica-de-cookies/` (baja): Enlaces a las políticas de terceros en versión española: twitter.com/es/privacy, policies.google.com/privacy?hl=es-419&gl=mx, policy.pinterest.com/es/privacy-policy.
- Resto de elementos globales (cabecera, banner, buscador, scripts): ver las secciones 4.2 y 7.

### 8.4 Relleno y marcadores sin resolver

- Lorem ipsum o relleno clásico: ninguno.
- `/fr/politique-de-confidentialite/`: Variable sin resolver en el ejercicio de derechos: 'correodelcliente' (no es una dirección de correo).
- Meta description con el valor literal `%` en 8 páginas: `/fr/notre-entreprise/`, `/fr/produits-torivac/`, `/fr/projets-cles-en-main/`, `/fr/blog/`, `/fr/contactez-nous/`, `/fr/politique-de-confidentialite/`, `/fr/politica-de-cookies/`, `/fr/declaracion-de-accesibilidad/`.
- Título SEO con marcadores repetidos y un `%` final en `/fr/estabilizadores-de-tension-con-cobre/`: «Stabilisateurs de tension en cuivre Torivac Torivac Torivac Torivac Torivac %».
- Banner de cookies con `{title}` (×3) y `{vendor_count}` en el HTML estático.

### 8.5 Enlaces rotos aparentes y enlaces a URLs en español

- `/fr/la-importancia-del-transformador-toroidal-en-la-industria/`: 'Cliquez ici' y 'vous pouvez nous contacter ici' sin enlace (0 anclas en el HTML y en el REST).
- `/fr/category/blog/`: 'Mentions légales' enlaza a /aviso-legal/ (enlace roto aparente: no consta en sitemap, REST ni índice de páginas).
- Enlaces del cuerpo que apuntan a URLs en español (8):
  - `/fr/`: «Plus d'informations» → `/torivac-empresa/`
  - `/fr/`: «Plus d'informations» → `/proyectos-empresariales/`
  - `/fr/`: «Chocs toroïdaux» → `/categoria-producto/choques/`
  - `/fr/`: «Boutons et bornes de commande» → `/categoria-producto/botones-de-mando/`
  - `/fr/`: «Portails» → `/categoria-producto/portaled/`
  - `/fr/`: «Noyaux toroïdaux» → `/categoria-producto/nucleos/`
  - `/fr/notre-entreprise/`: «Plus d'informations» → `/contacto/`
  - `/fr/projets-cles-en-main/`: «Contactez-nous à l'adresse suivante» → `/contacto/`
- Pie de las 190 páginas: «Avis juridique…», «Politique de confidentialité» y «Déclaration d’accessibilité» apuntan a las URLs españolas; «Mentions légales» a `/aviso-legal/` (roto aparente). Existen `/fr/politique-de-confidentialite/` y `/fr/declaracion-de-accesibilidad/`.
- Botón «Télécharger le catalogue» de la portada → catálogo español; el menú → catálogo francés.
- Paginación del blog (`/fr/blog/page/2/`, `/fr/blog/page/3/`): no está en los datos cosechados.

### 8.6 Contenido duplicado

- `/fr/mantenimiento-de-transformadores-electricos/`: El párrafo repite la misma idea dos veces seguidas (incumplimiento normativo, paradas de producción o de línea, pérdida de materiales sensibles); heredado del ES.
- `/fr/torivac-en-beyond-catalonia/`: Bloque corporativo estándar duplicado en esta entrada y en descargadores, estabilizadores y cobre (el ES lo repite además en 21 fichas y categorías; las fichas FR no lo llevan).
- `/fr/estabilizadores-de-tension-con-cobre/`: Bloque corporativo estándar duplicado (también en Beyond Catalonia, descargadores y estabilizadores).
- `/fr/estabilizadores-de-tension/`: Bloque corporativo estándar duplicado.
- `/fr/descargadores-de-bateria/`: Bloque corporativo estándar duplicado.
- `/fr/la-importancia-del-transformador-toroidal-en-la-industria/`: Frase duplicada consecutiva en el primer bloque (heredada del ES): 'Ils réduisent les coûts d’exploitation et améliorent la stabilité des systèmes électriques de toute entreprise.' y la variante 'dans toutes les entreprises'.
- El ES lleva el bloque 'Contamos con una experiencia de cerca de 60 años…' en 25 piezas (4 entradas + 21 fichas y categorías); el FR solo en las 4 entradas: las fichas FR no lo incluyen (se estudiará en el análisis de productos).

### 8.7 Afirmaciones sin respaldo y riesgo reputacional (entradas)

Las afirmaciones son las del ES; la traducción las reproduce. Se listan con la frase francesa como evidencia.

- `/fr/declaracion-de-accesibilidad/` (accuracy, alta): Afirmaciones contradictorias heredadas del ES: 'partiellement conforme' en la situación y 'Conforme à 100%' en el apartado de contenido no accesible.
- `/fr/normativas-sobre-transformadores-electricos-en-europa/` (unverified_claim, alta): Cumplimiento de EN 50588-1 / Reglamento (UE) 2019/1783 y 'documentation technique reconnue par les organismes de certification européens' sin vincularlo a ningún producto ni documento.
- `/fr/mantenimiento-de-transformadores-electricos/` (unverified_claim, alta): Servicios de mantenimiento (termografía, análisis de aceite dieléctrico, contratos de mantenimiento, informes) no documentados en otras fuentes del sitio ni en el catálogo.
- `/fr/mantenimiento-de-transformadores-electricos/` (unverified_claim, media): Resultados de clientes sin cliente ni dato: 'Les entreprises qui ont fait confiance à Torivac font état d’améliorations significatives'.
- `/fr/como-extender-la-vida-util-de-un-transformador/` (unverified_claim, alta): 'Garantie étendue' sin plazo ni condiciones ni documento (el catálogo solo recoge una garantía de 12 meses con exclusiones).
- `/fr/como-extender-la-vida-util-de-un-transformador/` (unverified_claim, media): Procesos de fabricación 'certifiés' sin nombrar la certificación.
- `/fr/como-extender-la-vida-util-de-un-transformador/` (accuracy, baja): Se compara con 'un transformateur chinois générique' sin datos.
- `/fr/impacto-medioambiental-de-los-transformadores-hoy/` (unverified_claim, alta): Afirmaciones ambientales (materiales respetuosos, materias primas reciclables, proceso de baja emisión, trazabilidad completa, ODS 7) sin evidencia: riesgo de greenwashing.
- `/fr/impacto-medioambiental-de-los-transformadores-hoy/` (unverified_claim, media): Certificaciones 'compatibles con las directivas europeas' sin nombrarlas.
- `/fr/impacto-medioambiental-de-los-transformadores-hoy/` (accuracy, baja): El Reglamento (UE) 2019/1783 se cita sin vincularlo a ningún producto de Torivac (verificar con el cliente a qué gama aplicaría).
- `/fr/funcionamiento-de-un-transformador-en-la-industria/` (unverified_claim, media): Servicios de consultoría, pruebas, simulaciones, cálculos eléctricos y garantías de rendimiento no documentados en otras fuentes.
- `/fr/funcionamiento-de-un-transformador-en-la-industria/` (reputation, media): Declaración despectiva sobre los competidores asiáticos: soporte técnico 'généralement inexistant ou limité à des manuels mal traduits'.
- `/fr/seguridad-en-el-uso-de-transformadores/` (unverified_claim, alta): Atribuye a los transformadores Torivac protección contra sobrecargas y 'mécanismes de détection précoce des courts-circuits' sin ficha técnica que lo respalde.
- `/fr/seguridad-en-el-uso-de-transformadores/` (accuracy, media): Confunde normas con directivas: 'directives européennes telles que IEC et EN' (IEC y EN son normas técnicas).
- `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/` (unverified_claim, media): Afirma cumplimiento de 'normes CE' de forma general (el catálogo condiciona el marcado CE de los variadores a su montaje en caja o envolvente).
- `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` (unverified_claim, alta): Atribuye a Torivac un servicio de diagnóstico y reparación inexistente en el resto del sitio.
- `/fr/eficiencia-de-los-transformadores-clave-en-europa/` (unverified_claim, alta): Cumplimiento de la 'directive Ecodesign' y eficiencia 'prouvée' sin datos de pérdidas ni clase de eficiencia.
- `/fr/eficiencia-de-los-transformadores-clave-en-europa/` (unverified_claim, media): Superlativos incompatibles sin respaldo: 'leader européen' (meta description) frente a 'l’un des rares fabricants européens' (cuerpo).
- `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` (unverified_claim, alta): Atribuye a Torivac servicios de optimización y reparación de transformadores (reimpregnación al vacío, refrigeración, sustitución de aislamiento, diagnóstico) inexistentes en el resto del sitio.
- `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` (unverified_claim, media): Resultados atribuidos a clientes ('font état d'une diminution notable...') sin cliente, dato ni caso citado.
- `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` (unverified_claim, media): 'Structure de service certifiée' sin certificación.
- `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` (unverified_claim, media): 'Certifications de qualité reconnues' y 'qualité certifiée' sin nombrar ninguna certificación (el sitio no cita ISO u otra).
- `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` (unverified_claim, media): 'Présence opérationnelle dans plusieurs pays européens' sin concretar países ni sedes (solo consta la dirección de Barcelona).
- `/fr/aplicaciones-de-los-transformadores-en-la-industria-actual/` (unverified_claim, media): Afirma conformidad con 'normes internationales' y que Torivac es 'une référence sur le marché européen' sin certificado ni dato.
- `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` (reputation, alta): Generalización despectiva sin fuente sobre fábricas chinas: 'de nombreuses usines chinoises évitent ces contrôles afin de réduire les coûts' (riesgo legal).
- `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` (unverified_claim, media): Ensayos 'térmicos, dieléctricos y electromagnéticos de alto nivel' y procesos de fabricación certificados sin documento ni certificación nombrada.
- `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/` (unverified_claim, media): 'Manque alarmant' de fabricantes europeos y saturación del mercado sin fuente ni dato.
- `/fr/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` (reputation, media): Crítica explícita al organizador de la feria (desorganización, espacio reducido, personal desbordado) sin datos objetivos.
- `/fr/estabilizadores-de-tension-con-cobre/` (unverified_claim, media): Afirmación técnica imprecisa heredada del ES: regular la tensión 'à l’aide du cuivre' (el cobre es el conductor del bobinado, no un método de regulación).
- `/fr/estabilizadores-de-tension/` (accuracy, media): Describe un estabilizador 'à plusieurs sorties' que no corresponde a las series reales de Torivac (AVS electromecánica con servomotor y BAVS electrónica, según el índice de productos FR).
- `/fr/descargadores-de-bateria/` (unverified_claim, alta): Atribuye a Torivac la fabricación de 'déchargeurs de batterie', producto que no figura en el catálogo ni en ninguna categoría de la web (podría corresponder a bancos de carga).
- Comparación con productos o fabricantes de China/Asia sin fuente ni dato, en 13 entradas: `/fr/normativas-sobre-transformadores-electricos-en-europa/`, `/fr/mantenimiento-de-transformadores-electricos/`, `/fr/como-extender-la-vida-util-de-un-transformador/`, `/fr/funcionamiento-de-un-transformador-en-la-industria/`, `/fr/seguridad-en-el-uso-de-transformadores/`, `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/`, `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/`, `/fr/eficiencia-de-los-transformadores-clave-en-europa/`, `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/`, `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/`, `/fr/aplicaciones-de-los-transformadores-en-la-industria-actual/`, `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/`, `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/`.
- Foco en España: 14 de las 21 entradas hablan de «l’Espagne» o de «fabricants espagnols» como mercado de referencia (traducción literal sin localizar); un lector francés ve un blog escrito para España. Menciones de Francia: 3 entradas. Decisión de localización pendiente del cliente: no se propone texto nuevo.

### 8.8 SEO y accesibilidad

- Sin `<h1>`: 27 de 30 piezas (todas menos la portada, Notre entreprise y Projets clés en main). El título visible es un H2 (en productos, un H3).
- Canónicas incorrectas: `/fr/produits-torivac/` → `https://grupotorivac.com/en/torivac-products/`; `/fr/politica-de-cookies/` → `https://grupotorivac.com/politica-de-cookies/`. El análisis de páginas registra estas dos piezas con la URL de la canónica; aquí `url` es la real.
- Títulos SEO: «Grupor» en dos páginas; solo la marca («Torivac», 7 caracteres, idéntico al ES) en la portada; título de la entrada Coiltech de 88 caracteres; título de estabilizadores con cobre con marcadores sin resolver.
- Imágenes sin alt útil:

| Pieza | Imágenes de contenido | Alt vacío | Alt = nombre de archivo | Alt no descriptivo |
|---|---|---|---|---|
| `/fr/` | 22 | 11 | 8 | 1 |
| `/fr/notre-entreprise/` | 4 | 4 | 0 | 0 |
| `/fr/projets-cles-en-main/` | 6 | 0 | 6 | 0 |
| `/fr/blog/` | 10 | 1 | 0 | 0 |
| `/fr/normativas-sobre-transformadores-electricos-en-europa/` | 1 | 1 | 0 | 0 |
| `/fr/mantenimiento-de-transformadores-electricos/` | 1 | 1 | 0 | 0 |
| `/fr/como-extender-la-vida-util-de-un-transformador/` | 1 | 1 | 0 | 0 |
| `/fr/impacto-medioambiental-de-los-transformadores-hoy/` | 1 | 1 | 0 | 0 |
| `/fr/funcionamiento-de-un-transformador-en-la-industria/` | 1 | 1 | 0 | 0 |
| `/fr/seguridad-en-el-uso-de-transformadores/` | 1 | 1 | 0 | 0 |
| `/fr/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 1 | 1 | 0 | 0 |
| `/fr/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 1 | 1 | 0 | 0 |
| `/fr/eficiencia-de-los-transformadores-clave-en-europa/` | 1 | 1 | 0 | 0 |
| `/fr/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 1 | 1 | 0 | 0 |
| `/fr/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | 1 | 1 | 0 | 0 |
| `/fr/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 1 | 1 | 0 | 0 |
| `/fr/materiales-de-un-transformador-clave-en-su-rendimiento/` | 1 | 1 | 0 | 0 |
| `/fr/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 1 | 1 | 0 | 0 |
| `/fr/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | 1 | 1 | 0 | 0 |
| `/fr/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 3 | 3 | 0 | 0 |

  Los alt de las imágenes con texto están en francés cuando existen (blog, Beyond Catalonia, estabilizadores, cobre, descargadores, toroidal); las 14 entradas de plantilla no tienen alt. En la portada, 10 de los 11 alt vacíos son iconos decorativos dentro de enlaces con texto.
- Las banderas de `seo-tech.json` para cada URL están en `seo_tech_flags` del JSON (referencia cruzada).

### 8.9 Formularios

- 16179: etiquetas ocultas en español ('Correo', 'Mensaje') y etiqueta visible del honeypot 'Correo Mensaje Nom'
- 16206: consentimiento mal traducido ('Il a accepté et accepté…'), sin etiquetas, texto de envío 'Enviando...' en español
- El FR no replica los captchas aritméticos del ES (portada: 14511 con captcha condicional)
- Dos formularios WPForms: 16179 (portada y contacto) y 16206 (pie de las 21 entradas). Ambos protegidos con reCAPTCHA v3 y honeypot; ninguno enlaza el consentimiento a la política de privacidad.

## 9. Auditoría del borrador

Lectura completa de las 32 piezas FR contra data/analysis/pages/fr/*.json, data/raw/html/fr/*.html, data/raw/rest/{pages,posts}.fr.json y las piezas ES de data/analysis/content/es.json. Comprobaciones automáticas: (1) el texto del análisis coincide con el texto de la API REST (espacios normalizados) en 24 de 30 páginas y entradas; las diferencias están en la portada y contacto (ruido del formulario), el blog (paginación), dos entradas (espacio antes de la puntuación junto a un enlace) y la política de cookies (el HTML solo aporta el pie; se usa REST); (2) todas las key_facts y las pruebas de banderas con where=text son subcadenas literales de full_text (comprobación por script, 0 fallos); (3) los niveles de encabezado REST FR y ES coinciden en las 30 piezas de contenido; (4) el número de líneas de texto FR es igual al ES en 26 de 30 (el resto: portada, contacto, productos y cookies, por ruido de formularios, menú y fuente del texto); (5) búsqueda de lorem ipsum y de relleno clásico en texto visible, HTML y REST de las piezas FR: 0 resultados; (6) 0 enlaces tel:/mailto: en los 190 HTML FR; solo 2 entradas llevan enlaces en el cuerpo (torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2, torivac-en-beyond-catalonia); (7) recuentos de pie, banner de cookies y scripts de accesibilidad sobre los 190 HTML FR, y presencia del texto ICEX/FEDER (0 de 190 HTML FR, 0 de 194 EN y 0 de 189 DE, frente a 186 de 208 ES).

Correcciones sobre los datos de partida:

- El análisis de páginas registra /fr/produits-torivac/ y /fr/politica-de-cookies/ con la URL de su canónica (/en/torivac-products/ y /politica-de-cookies/); aquí se usa la URL real y se anota la canónica como defecto.
- site-structure.json marca como sin equivalente FR el aviso legal, el checkout (/confirmar/) y la tienda (/shop/); aquí se confirma para el aviso legal (no existe pieza FR en los datos ni en la REST) y se comprueba que tampoco hay checkout ni tienda FR.

## 10. Huecos y preguntas para el cliente

Huecos de las fuentes (`gaps` en el JSON):

- No existe aviso legal en francés: el ES (/aviso-legal-2/) solo está traducido al alemán, y el pie FR enlaza a la URL española. Los datos no permiten saber si es una omisión o una decisión.
- Carrito, checkout, tienda y mi cuenta en francés: no hay ninguna de esas páginas en los datos FR (las capturas ES de /confirmar/ y /shop/ devuelven plantillas EN); solo se pueden inventariar los archivos de categoría de entradas.
- Plantillas Elementor de cabecera y pie (elementor-hf) FR: no están cosechadas como piezas; se han reconstruido a partir del HTML de las 190 páginas FR.
- Índice del blog: /fr/blog/page/2/ y /fr/blog/page/3/ no están en los datos; las 21 entradas proceden de la API REST (pasa lo mismo en ES).
- Cómo se resuelve el banner de cookies en ejecución ({title}, {vendor_count}): no hay captura del banner abierto en data/raw/screens.
- Traducción francesa del texto ICEX-Next / FEDER del pie: no existe en las fuentes (el pie FR no lo incluye); hay que redactarla y que la apruebe el cliente (obligación de publicidad de fondos europeos).
- Términos franceses acordados con el cliente para 'descargadores de batería', 'botones de mando', 'bobinas encapsuladas' y 'hembrillas': no constan; el catálogo FR ofrece alternativas pero no es concluyente.
- Quién o qué herramienta tradujo los textos FR: las fuentes no lo indican (solo consta WPML); la modificación masiva del 2026-03-23 es un indicio, no una prueba.
- Razón social completa y datos registrales (igual que en ES): el titular sigue en blanco en la política de privacidad FR y no hay aviso legal FR.
- Redes sociales, horarios y certificaciones de empresa: no constan en FR (igual que en ES).
- Correo de destino de los formularios FR (16179 y 16206): WPForms no expone las notificaciones; solo consta info@torivac.com como dato público.
- Si las URLs FR deben traducirse: 21 entradas y 2 páginas (declaracion-de-accesibilidad, politica-de-cookies) tienen slug en español bajo /fr/; decisión de la tarea de URLs/SEO.
- Autoría real de los textos de las entradas FR: WordPress las atribuye a 'Franco Santiso' (autor 3) por herencia del ES; no consta quién las redactó.
- Las 'fichas de producto y categorías de producto' FR no se analizan aquí (tarea aparte): el recuento de tarjetas del índice de productos (62 FR frente a 65 ES) y la ausencia del bloque corporativo en las fichas FR quedan para ese análisis.

Preguntas para el cliente (la web nueva no puede resolverlas sola):

1. ¿Quieres que el francés sea una traducción del español corregido o que se redacte aparte con foco en Francia? Hoy 14 de 21 entradas hablan de España como mercado.
2. ¿Qué término francés usáis para variador de tensión, choque toroidal, portaled, hembrilla, botón de mando y bobina encapsulada? El catálogo FR y la web discrepan (sección 5).
3. ¿Existe o debe existir un aviso legal en francés? ¿Quién redacta la versión francesa de los tres textos legales?
4. ¿Hay que mostrar el texto ICEX-Next / FEDER en francés? Necesitamos la traducción aprobada.
5. ¿Se acepta mantener las 14 entradas de plantilla como propuesta en el panel de admin y retraducirlas solo si el cliente las valida (servicios, certificaciones, garantía extendida)?
6. ¿Los 'descargadores de batería' son un producto real o se refieren a bancos de carga?
7. ¿Las URLs francesas deben tener slug francés (por ejemplo `/fr/blog/...`, `/fr/declaration-d-accessibilite/`) con redirecciones 301 desde las actuales?
8. ¿El catálogo que debe descargarse desde la portada francesa es el francés (`Torivac_2024_FR.pdf`)?

## 11. Cómo usar `fr.json`

- `items[]`: una entrada por pieza, con el mismo esquema que `es.json` más `comparison_with_es`, `seo_tech_flags`, `fetched_url` y `canonical_url`. `full_text` es el texto íntegro para migrar (con el ruido de formulario indicado en las notas de la portada y contacto).
- `sections[]`: resumen y `key_facts` (citas literales del francés, verificadas por script).
- `company_facts`, `site_chrome`, `legal_pages`, `cross_findings`, `stats`, `gaps`, `field_notes` y `audit`: bloques globales.
- Para migrar: leer `migration.decision`; si es `retraducir_tras_es`, no usar `full_text` como fuente sino la versión ES final.

## 12. Criterios

ok: francés fluido y fiel al ES, solo defectos menores o heredados. parcial: francés correcto pero con restos de ES/EN visibles o accesibles (etiquetas, botones, interfaz). automática_sospechosa: traducción automática con errores que alteran el sentido (términos técnicos, nombres propios o de producto, encabezados). sin_traducir: copia del ES (ninguna pieza). n/a: archivos sin texto propio.

Decisiones de migración: `copiar_con_correcciones`, `regenerar`, `revisar_antes_de_migrar`, `retraducir_tras_es` (la pieza FR no se copia: se traduce desde el ES corregido o validado) y `no_migrar`.
