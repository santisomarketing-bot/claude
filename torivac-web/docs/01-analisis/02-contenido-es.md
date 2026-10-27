# 02 · Contenido en español (es): páginas y entradas

> Sesión 1 · Análisis profundo. Datos de contenido en `data/analysis/content/es.json` (texto íntegro para migrar, secciones, CTA, imágenes, formularios, hechos de empresa y textos legales). Este documento es el inventario legible. Fuentes: `data/analysis/pages/es/*.json`, `data/raw/html/es/*.html`, `data/raw/rest/pages.es.json` y `posts.es.json`, sitemaps, `data/analysis/pdf-text/` y capturas de `data/raw/screens/`. Cosecha del 27/10/2026. No se modificó la web original ni se hicieron peticiones de red.

Alcance: páginas y entradas cuya URL está en español (sin prefijo `/en/`, `/fr/`, `/de/`). Se excluyen las fichas de producto y los archivos de categoría de producto, que se analizan aparte. Se inventarían, sin analizarlas a fondo, las piezas técnicas de WooCommerce y WordPress (checkout, tienda, archivos de categoría de entradas y plantillas de cabecera y pie).

## 1. Resumen

| Concepto | Dato |
|---|---|
| Piezas inventariadas | 37 (10 páginas, 21 entradas, 6 piezas técnicas) |
| Texto | 6.960 palabras en páginas y 19.217 en entradas |
| Entradas por fecha | 6 de 2024, 15 de 2025 (14 del 19 al 29/12/2025) |
| Páginas y entradas sin `<h1>` | 28 de 31 (solo tienen H1 la portada, Empresa y Proyectos) |
| Meta description sin resolver (valor literal `%`) | 9 piezas; 1 entrada sin meta description (Matelec) |
| Imágenes de contenido | 88; 35 con alt vacío y 14 con alt que es un nombre de archivo |
| Entradas que mencionan a China | 13 de 21 |
| Hallazgos de calidad | 215 (alta 24, media 113, baja 78); detalle en `quality_flags` de cada pieza |
| Lorem ipsum o texto de relleno clásico | Ninguno (búsqueda en texto visible, HTML y REST de las 37 piezas) |
| Decisión de migración | Propuesta en admin (no publicar sin validar): 10; Copiar con correcciones: 8; Reescribir: 8; Regenerar desde datos: 5; No migrar: 4; Revisión legal antes de migrar: 2 |

Conclusiones:

1. **El texto propio y fiable es poco**: portada, Empresa, Proyectos y Contacto, más 2 noticias aprovechables (Coiltech y Beyond Catalonia; la de Matelec critica al organizador de la feria). Es lo que se puede llevar a la web nueva casi tal cual.
2. **14 de las 21 entradas (19–29/12/2025) son texto SEO de plantilla**: misma estructura (escasez de fabricantes europeos, importaciones asiáticas, Torivac como aliado), palabra clave repetida de forma mecánica y afirmaciones que ninguna otra fuente respalda (servicios de mantenimiento, reparación, diagnóstico, garantía extendida, certificaciones sin nombre, materiales ecológicos). Además comparan con fabricantes chinos sin datos. Se proponen como propuesta en el panel de admin hasta que el cliente las valide.
3. **Los textos legales son plantillas incompletas**: el titular del sitio está en blanco en el aviso legal y en la política de privacidad, hay una variable sin resolver (`correodelcliente`), la política de cookies no inventaría las cookies reales y la declaración de accesibilidad se contradice. Requieren revisión legal antes de publicarse.
4. **Faltan datos de empresa** que la web nueva podría necesitar: razón social completa y datos registrales, redes sociales (el pie muestra un icono de LinkedIn sin enlace), horarios, certificaciones de empresa y clientes de referencia.
5. **Problemas técnicos repetidos**: 28 piezas sin H1, 9 meta description sin resolver, 22 pies con enlace a `/aviso-legal/` (roto aparente), pie de las entradas desactualizado y duplicado, bloque corporativo duplicado y alts vacíos o en otro idioma.

## 2. Inventario

`Qué dice` resume la finalidad de la pieza. `Calidad del texto` es una valoración editorial (no es una puntuación automática). Las fechas son de publicación y última modificación según la API REST de WordPress. `Trad.` indica en qué idiomas existe una URL traducida según `hreflang` (la calidad de esas traducciones se analiza en los ficheros de cada idioma).

### 2.1 Páginas (10)

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. | Pal. | Trad. | Qué dice | Calidad del texto | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 13947 | Torivac Home | Especialistas en control y regulación de tensión | 2025-10-30 / 2026-10-14 | 502 | EN/FR/DE | Portada: presenta a Torivac como especialista en regulación de tensión, enlaza a empresa, proyectos, familias de producto y catálogo PDF, y ofrece formulario de contacto. | Aceptable. Texto comercial propio y coherente. Erratas ('Potenciómentros', 'Catalogo', 'encontrareis'), mezcla de tú y usted, CTA 'Conocer la empresa Torivac' enlazado a proyectos y 'Nuestros Servicios' sobre una rejilla de productos. | Copiar con correcciones |
| `/torivac-empresa/` | 14319 | Torivac_Torivac Empresa | Nuestra empresa | 2025-11-03 / 2026-03-08 | 375 | EN/FR/DE | Presenta la empresa: trayectoria desde 1964, presencia internacional, misión, visión, valores y liderazgo de D. Ramón Zamora. | Buena. Única página con trayectoria (1964), misión, visión, valores y liderazgo. Cifras de años sin unificar y título SEO con 'Grupor'. | Copiar con correcciones |
| `/productos/` | 14049 | Torivac Productos | (sin H1) Productos | 2025-11-02 / 2026-02-25 | 412 | EN/FR/DE | Índice de productos: árbol de categorías (modal) y tarjetas de las 11 familias con recuento de productos y extracto. | Pobre como texto: árbol del menú más extractos cortados con '…', restos de interfaz ('Productos-Torivac', '×') y sin tarjeta de Equipos electrónicos. | Regenerar desde datos |
| `/proyectos-empresariales/` | 14299 | Torivac_Proyectos Empresariales | Proyectos llave en mano | 2025-11-03 / 2026-04-14 | 210 | EN/FR/DE | Describe la oferta de proyectos llave en mano y a medida (diseño, fabricación y puesta en marcha) y la colaboración con clientes y aliados. | Buena. Texto propio correcto; cuatro nombres para la misma sección, encabezado repetido, 'costos' (léxico latinoamericano) y alts con nombre de archivo. | Copiar con correcciones |
| `/blog/` | 15801 | Torivac_Blog | (sin encabezado) | 2024-06-25 / 2026-03-10 | 136 | EN/FR/DE | Índice del blog: rejilla de entradas (3 páginas) con imagen, fecha, título y botón 'Leer más'. | Sin texto propio: rejilla automática con interfaz en inglés ('Do you like it?'), fechas 'diciembre 29, 2025' y extracto sin puntuación. | Regenerar desde datos |
| `/contacto/` | 14214 | Torivac Contacto | (sin H1) CONSÚLTANOS | 2025-11-03 / 2026-03-13 | 145 | EN/FR/DE | Página de contacto: formulario, texto de acompañamiento, dirección, teléfono, correo y mapa de Google embebido. | Correcta y completa. Teléfono y correo sin enlace, 'Potosi' sin tilde y casilla de consentimiento sin enlace a la política. | Copiar con correcciones |
| `/aviso-legal-2/` | 1109 | Aviso legal | (sin H1) AVISO LEGAL Y CONDICIONES GENERALES DE USO | 2022-12-16 / 2025-12-10 | 2895 | DE | Aviso legal y condiciones generales de uso (LSSI): objeto, datos identificativos, propiedad intelectual, obligaciones, responsabilidades, hipervínculos, protección de datos, cookies y jurisdicción. | Plantilla genérica con el titular en blanco, términos mezclados (Sitio Web, Espacio Web, la Entidad) y frases rotas. | Revisión legal antes de migrar |
| `/politica-de-privacidad/` | 14762 | Política de privacidad | (sin H1) Política de privacidad | 2025-12-10 / 2025-12-10 | 868 | EN/FR/DE | Política de privacidad (RGPD): responsable, principios, datos recogidos, legitimación, derechos y fecha de actualización (diciembre 2025). | Plantilla incompleta: titular en blanco, 'correodelcliente' sin resolver, sin plazos de conservación ni destinatarios. | Revisión legal antes de migrar |
| `/politica-de-cookies/` | 1117 | Política de cookies | (sin H1) POLÍTICA DE COOKIES | 2022-12-16 / 2025-02-11 | 682 | EN/FR/DE | Política de cookies genérica: qué son las cookies, propias, de redes sociales (con enlaces a sus políticas) y cómo deshabilitarlas. | Plantilla de un generador gratuito (11/02/2025) sin inventario real de cookies. | Reescribir |
| `/declaracion-de-accesibilidad/` | 14774 | Declaración de accesibilidad | (sin H1) Declaración de accesibilidad | 2025-12-10 / 2025-12-10 | 735 | EN/FR/DE | Declaración de accesibilidad conforme al RD 1112/2018: situación de cumplimiento, contenido no accesible, método de evaluación y vías de contacto. | Contradictoria ('parcialmente conforme' y 'cumple el 100 %') y copiada de una plantilla del sector público (2024). | Reescribir |

### 2.2 Entradas del blog (21)

Todas están en la categoría `blog`, firmadas por el autor WordPress 'Franco Santiso' y con una imagen destacada. Orden: más recientes primero.

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. | Pal. | Trad. | Qué dice | Calidad del texto | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| `/normativas-sobre-transformadores-electricos-en-europa/` | 15141 | Normativas sobre transformadores eléctricos en Europa | (sin H1) Normativas sobre transformadores eléctricos e… | 2025-12-29 / 2026-03-23 | 992 | EN/FR/DE | Artículo SEO que presenta el marco normativo europeo/español de los transformadores y posiciona a Torivac como asesor y proveedor certificado frente a importaciones asiáticas. | Texto SEO de plantilla. Cita EN 50588-1 y el Reglamento UE 2019/1783 sin vincularlos a ningún producto, afirma documentación certificada sin citarla y ataca a las importaciones chinas. Errata 'problemíticas'. | Reescribir |
| `/mantenimiento-de-transformadores-electricos/` | 15131 | Mantenimiento de transformadores eléctricos | (sin H1) Mantenimiento de transformadores eléctricos | 2025-12-29 / 2025-12-29 | 1071 | EN/FR/DE | Artículo SEO sobre la importancia del mantenimiento preventivo/correctivo de transformadores que presenta a Torivac como proveedor de servicios de mantenimiento. | Texto SEO de plantilla. Presenta a Torivac como empresa de mantenimiento (termografía, análisis de aceites dieléctricos), servicio que no figura en ninguna otra fuente. | Propuesta en admin (no publicar sin validar) |
| `/como-extender-la-vida-util-de-un-transformador/` | 15122 | Cómo extender la vida útil de un transformador | (sin H1) Cómo extender la vida útil de un transformador | 2025-12-29 / 2025-12-29 | 919 | EN/FR/DE | Artículo SEO sobre cómo prolongar la vida útil de un transformador que promociona los 'transformadores de larga duración con garantía extendida' de Torivac. | Texto SEO de plantilla. 'Garantía extendida' y 'procesos certificados' sin respaldo; compara con el 'transformador genérico chino'. | Propuesta en admin (no publicar sin validar) |
| `/impacto-medioambiental-de-los-transformadores-hoy/` | 15112 | Impacto medioambiental de los transformadores hoy | (sin H1) Impacto medioambiental de los transformadores… | 2025-12-29 / 2025-12-29 | 1078 | EN/FR/DE | Artículo SEO sobre el impacto ambiental de los transformadores y la regulación europea; presenta a Torivac como fabricante sostenible. | Texto SEO de plantilla. Materiales ecológicos, trazabilidad total y ODS 7 sin evidencia: riesgo de greenwashing. | Propuesta en admin (no publicar sin validar) |
| `/funcionamiento-de-un-transformador-en-la-industria/` | 15102 | Funcionamiento de un transformador: claves para tu pro… | (sin H1) Funcionamiento de un transformador: claves pa… | 2025-12-29 / 2025-12-29 | 1344 | EN/FR/DE | Artículo SEO sobre el funcionamiento de un transformador en entornos industriales dirigido a contratistas eléctricos, con promoción de la asesoría técnica de Torivac. | No explica el funcionamiento: es texto comercial. Dice que el soporte de los proveedores asiáticos es 'inexistente' (declaración despectiva). | Reescribir |
| `/seguridad-en-el-uso-de-transformadores/` | 15095 | Seguridad en el uso de transformadores | (sin H1) Seguridad en el uso de transformadores | 2025-12-20 / 2025-12-20 | 1065 | EN/FR/DE | Artículo SEO sobre seguridad de transformadores en instalaciones críticas que promociona los 'transformadores con protección avanzada' de Torivac. | Texto SEO de plantilla. Atribuye protecciones concretas y 'directivas IEC y EN' (son normas) sin ficha técnica. | Propuesta en admin (no publicar sin validar) |
| `/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 15085 | Límites de un transformador y cómo afectan su rendimie… | (sin H1) Límites de un transformador y cómo afectan su… | 2025-12-20 / 2025-12-20 | 826 | EN/FR/DE | Artículo SEO sobre los límites operativos de un transformador (térmicos, dieléctricos) orientado a proyectos de energía renovable; promociona la personalización de Torivac. | Vago y comercial; afirma conformidad CE en general (el catálogo la condiciona a la envolvente) y tiene frases confusas. | Reescribir |
| `/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 15078 | Fallos comunes en transformadores y sus soluciones efe… | (sin H1) Fallos comunes en transformadores y sus soluc… | 2025-12-20 / 2025-12-20 | 1004 | EN/FR/DE | Artículo SEO sobre fallos frecuentes de transformadores y sus soluciones, orientado a universidades y centros de investigación, que promociona un servicio de diagnóstico y reparación de Torivac. | Repite la palabra clave de forma mecánica; público (universidades) incoherente con el cliente industrial; 'servicio de diagnóstico y reparación' sin respaldo. | Propuesta en admin (no publicar sin validar) |
| `/eficiencia-de-los-transformadores-clave-en-europa/` | 15071 | Eficiencia de los transformadores: clave en Europa | (sin H1) Eficiencia de los transformadores: clave en E… | 2025-12-20 / 2025-12-20 | 977 | EN/FR/DE | Artículo SEO sobre eficiencia energética de transformadores dirigido a distribuidores eléctricos; presenta a Torivac como fabricante de alta eficiencia conforme a Ecodesign. | Texto SEO de plantilla. Cumplimiento 'Ecodesign' y eficiencia 'comprobada' sin ningún dato. | Propuesta en admin (no publicar sin validar) |
| `/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 15065 | Cómo se mejora un transformador con técnicas expertas | (sin H1) Cómo se mejora un transformador con técnicas… | 2025-12-20 / 2025-12-20 | 1063 | EN/FR/DE | Artículo SEO sobre cómo mejorar o modernizar un transformador existente; presenta a Torivac como prestador de servicios de optimización y reparación. | Atribuye a Torivac reparación y modernización (re-impregnación al vacío, refrigeración, aislamientos) que no figuran en otras fuentes. | Propuesta en admin (no publicar sin validar) |
| `/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | 15058 | Cómo se fabrica un transformador: proceso y calidad eu… | (sin H1) Cómo se fabrica un transformador: proceso y c… | 2025-12-20 / 2025-12-20 | 942 | EN/FR/DE | Artículo SEO que describe a alto nivel cómo se fabrica un transformador y presenta a Torivac como fabricante a medida con 'calidad certificada'. | Descripción genérica del proceso; 'certificaciones reconocidas' y 'presencia operativa en distintos países' sin concretar. | Propuesta en admin (no publicar sin validar) |
| `/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 15039 | Aplicaciones de los transformadores en la industria ac… | (sin H1) Aplicaciones de los transformadores en la ind… | 2025-12-19 / 2025-12-19 | 969 | EN/FR/DE | Artículo SEO sobre aplicaciones industriales de los transformadores (generación, hospitales, ferrocarril, logística) que presenta a Torivac como referencia de fiabilidad. | Aplicaciones genéricas de potencia y distribución, no del catálogo real (toroidales, variadores, resistencias). | Reescribir |
| `/materiales-de-un-transformador-clave-en-su-rendimiento/` | 15026 | Materiales de un transformador: clave en su rendimiento | (sin H1) Materiales de un transformador: clave en su r… | 2025-12-19 / 2025-12-19 | 1315 | EN/FR/DE | Artículo SEO sobre el papel de los materiales (acero al silicio, cobre esmaltado, aislamientos) en el rendimiento de un transformador y la superioridad de los materiales de Torivac. | Mezcla datos técnicos genéricos (acero al silicio, cobre esmaltado) con ensayos no documentados y una generalización sobre fábricas chinas (riesgo legal). | Propuesta en admin (no publicar sin validar) |
| `/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 15007 | ¿Para qué sirve un transformador? Descubre su función… | (sin H1) ¿Para qué sirve un transformador? Descubre su… | 2025-12-19 / 2025-12-19 | 963 | EN/FR/DE | Artículo SEO que explica brevemente para qué sirve un transformador (adaptar la tensión) y orienta la compra hacia Torivac frente a importadores. | La función se explica en un párrafo; el resto es comercial (centros de datos) con 'carencia alarmante' de fabricantes sin fuente. | Reescribir |
| `/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | 11320 | Torivac consolida su liderazgo en el sector eléctrico… | (sin H1) Torivac consolida su liderazgo en el sector e… | 2025-06-03 / 2025-12-16 | 613 | EN/FR/DE | Nota corporativa sobre la participación de Torivac en la feria Coiltech Deutschland 2025 (Augsburg) y su estrategia de internacionalización. | Noticia con hechos verificables (marzo de 2025, Messe Augsburg). Nombres propios en minúscula, título SEO distinto del H2 e imagen sin alt. | Copiar con correcciones |
| `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 14925 | Torivac en Matelec 2024 – Explorando el mercado y refo… | (sin H1) Torivac en Matelec 2024 – Explorando el merca… | 2024-11-22 / 2025-12-19 | 424 | EN/FR/DE | Crónica corporativa de la visita de Torivac a la feria Matelec 2024 (Madrid), con valoración negativa de la organización. | Texto humano pero crítico con el organizador. Erratas ('apaliar', 'hubieron'), sin meta description. | No migrar |
| `/torivac-en-beyond-catalonia/` | 8414 | Torivac en Beyond Catalonia | (sin H1) Torivac en Beyond Catalonia | 2024-11-18 / 2025-12-19 | 900 | EN/FR/DE | Nota corporativa sobre la participación de Torivac en Beyond Catalonia (ACCIÓ, World Trade Center Barcelona) y su estrategia de expansión internacional. | Texto humano útil (hechos del evento). Erratas ('Catalona', 'articulo', 'una nueva una'), tiempo verbal incoherente y bloque corporativo duplicado. | Copiar con correcciones |
| `/estabilizadores-de-tension-con-cobre/` | 8334 | Estabilizadores de tensión con cobre | (sin H1) Estabilizadores de tensión con cobre | 2024-11-12 / 2025-12-19 | 639 | EN/FR/DE | Artículo SEO sobre estabilizadores de tensión 'con cobre' y sus ventajas operativas para infraestructuras. | Texto de producto razonable con afirmación técnica imprecisa ('regulación de tensión mediante el cobre'); 'evitareis'. | Copiar con correcciones |
| `/estabilizadores-de-tension/` | 8272 | Los estabilizadores de tensión garantizan un suministr… | (sin H1) Los estabilizadores de tensión garantizan un… | 2024-11-05 / 2025-12-19 | 771 | EN/FR/DE | Artículo SEO que explica qué es un estabilizador de tensión, en qué se diferencia de un protector y cómo beneficia a grandes infraestructuras. | Describe un estabilizador de tomas que no corresponde a las series AVS/BAVS reales; 'Podéis'; bloque corporativo duplicado. | Reescribir |
| `/descargadores-de-bateria/` | 8112 | Descargadores de batería Torivac | (sin H1) Descargadores de batería Torivac | 2024-10-10 / 2025-12-19 | 908 | EN/FR/DE | Artículo SEO sobre descargadores de batería (simulación de carga y pruebas de baterías) presentados como producto de Torivac. | Describe un producto sin ficha ni categoría en el catálogo; alt de la imagen en francés; 'bateria' sin tilde. | Propuesta en admin (no publicar sin validar) |
| `/la-importancia-del-transformador-toroidal-en-la-industria/` | 7484 | La importancia del transformador toroidal en la indust… | (sin H1) La importancia del transformador toroidal en… | 2024-06-25 / 2025-12-19 | 434 | EN/FR/DE | Artículo SEO que explica por qué importa el transformador toroidal, cómo elegirlo y en qué se diferencia del convencional. | El más cercano al producto real (toroidal frente a convencional). Sintaxis rota, 'click aquí' sin enlace y alt en alemán. | Copiar con correcciones |

### 2.3 Piezas técnicas (6)

No son contenido editorial. Se inventarían para saber qué existe y qué hay que reconstruir.

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. | Pal. | Trad. | Qué dice | Calidad del texto | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| `/confirmar/` | 11519 | Confirmar | (sin encabezado) | 2025-06-11 / 2025-06-11 | — | EN | Página de finalizar compra (checkout) de WooCommerce con título 'Confirmar' (id 11519, publicada 2025-06-11). La captura ES devuelve el carrito en inglés (/en/carrito/); solo se inventaría. | Sin texto: marcado de bloques del checkout de WooCommerce. | No migrar |
| `/shop/` | — | Productos archivo - Torivac | (sin H1) Sin categorizar | — / — | 410 | EN/FR/DE | Archivo WooCommerce de productos (/shop/): listado de categorías raíz con extracto. La captura ES devuelve la plantilla de /en/shop/ (canonical); solo se inventaría. | Archivo técnico de WooCommerce; una descripción de categoría muestra un shortcode sin renderizar. | No migrar |
| `/category/blog/` | 443 | blog - Torivac | (sin encabezado) | — / — | — | EN/FR/DE | Archivo de la categoría de entradas 'blog' (id 443): listado paginado de entradas. Solo se inventaría. | Archivo de taxonomía sin texto propio. | Regenerar desde datos |
| `/category/sin-categorizar/` | 1 | Sin categorizar - Torivac | (sin encabezado) | — / — | — | EN/FR/DE | Archivo de la categoría 'Sin categorizar' (id 1), vacía. Solo se inventaría. | Archivo vacío por defecto de WordPress. | No migrar |
| `/elementor-hf/header/` | — | Torivac | (sin encabezado) | — / — | 14 | — | Plantilla Elementor 'Header' (elementor-hf). Su URL se resuelve a la portada; el contenido real de cabecera es el menú y el selector de idioma. | Plantilla de cabecera (menú y selector de idioma). | Regenerar desde datos |
| `/elementor-hf/footer-blog/` | 14542 | Torivac | (sin encabezado) | — / — | 171 | — | Plantilla Elementor 'footer-blog' (id 14542), usada solo en las entradas: bloque 'Contacta con nosotros' con formulario y pie antiguo de 2022 duplicado. | Plantilla del pie de las entradas, desactualizada (2022) y duplicada. | Regenerar desde datos |

## 3. Qué copiar y qué reescribir

Ninguna pieza se puede copiar literalmente sin tocar: hasta las mejores tienen alguna errata. El criterio es el esfuerzo que exige la migración.

**Copiar con correcciones (8)**. El texto es útil y verificable. Se migra el `full_text` corrigiendo las erratas listadas en la sección 7.

- `/`: Copiar el texto y la estructura; corregir 'Potenciómentros', 'Catalogo', el destino del CTA 'Conocer la empresa Torivac' y el cierre 'te la resolveremos'.
- `/torivac-empresa/`: Es la única página con datos de trayectoria y valores; copiar tal cual corrigiendo 'Grupor' en el título SEO, completando meta description y revisando las afirmaciones de clientes.
- `/proyectos-empresariales/`: Copiar y unificar el nombre de la sección (hoy: 'Proyectos comerciales Torivac', 'Proyectos llave en mano', 'Proyectos Empresariales'); validar con el cliente la 'puesta en marcha en instalaciones'.
- `/contacto/`: Mantener datos de contacto y mapa; hacer clicables teléfono y correo, enlazar el consentimiento a la política de privacidad y corregir 'Potosi'/'encontrareis'.
- `/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/`: Noticia con hechos verificables (feria, fecha, lugar). Corregir mayúsculas de nombres propios, alinear título SEO y H2 y añadir fecha visible y fotos con alt.
- `/torivac-en-beyond-catalonia/`: Hechos verificables (evento, organizador, lugar). Corregir erratas, tiempo verbal y eliminar el bloque corporativo duplicado en 4 entradas.
- `/estabilizadores-de-tension-con-cobre/`: Corregir erratas y revisar con ingeniería la afirmación sobre 'regulación de tensión mediante el cobre' (el cobre es el conductor del bobinado, no un método de regulación).
- `/la-importancia-del-transformador-toroidal-en-la-industria/`: Es el artículo con contenido más cercano al producto real (toroidal vs convencional). Corregir sintaxis rota, 'click aquí' sin enlace y el alt en alemán; enlazar de verdad a las categorías de transformadores y a contacto.

**Regenerar desde datos (5)**. No se copia: la web nueva lo genera desde los datos (catálogo, entradas, menú, selector de idioma).

- `/productos/`: En la web nueva debe generarse desde los datos de catálogo (S2), no copiarse: los extractos están cortados con '…' y el árbol incluye restos de interfaz. Reutilizar solo los nombres de familia y los recuentos.
- `/blog/`: Generar el índice desde las entradas migradas; no copiar tal cual (contiene textos de interfaz en inglés y fechas en formato anglosajón).
- `/category/blog/`: Archivo de taxonomía; la web nueva generará su propio listado.
- `/elementor-hf/header/`: Plantilla de cabecera: reconstruir menú, logotipo y selector de idioma en la web nueva.
- `/elementor-hf/footer-blog/`: Unificar con el pie de las páginas (id 14231): hoy las entradas muestran un pie desactualizado.

**Revisión legal antes de migrar (2)**. Texto jurídico con huecos. Necesita datos de empresa y revisión de un asesor legal antes de publicar.

- `/aviso-legal-2/`: Texto genérico de plantilla con el titular en blanco. Necesita revisión legal y datos de empresa antes de publicar; el nuevo sitio añade cuentas de cliente y presupuestos.
- `/politica-de-privacidad/`: Plantilla con campo del titular vacío y variable sin resolver en el ejercicio de derechos; faltan elementos habituales (plazos, destinatarios, autoridad de control). Revisión legal obligatoria antes de publicar.

**Reescribir (8)**. El texto no sirve tal cual (genérico, impreciso o contradictorio). Se mantiene la URL y el título por SEO y se rehace el cuerpo con datos verificables.

- `/politica-de-cookies/`: Plantilla genérica de un generador gratuito, sin inventario de cookies real (GA4, GTM, reCAPTCHA, Complianz). No está enlazada desde el pie (solo desde el banner Complianz, en ejecución). Rehacer con el banner de consentimiento de la web nueva.
- `/declaracion-de-accesibilidad/`: Plantilla del sector público con afirmaciones contradictorias y fechada en 2024. Rehacerla tras auditar la web nueva (WCAG 2.1 AA) y ajustar a la normativa aplicable a una empresa privada.
- `/normativas-sobre-transformadores-electricos-en-europa/`: Plantilla SEO con afirmaciones normativas y de certificación no respaldadas por otras fuentes del sitio. Mantener URL/título para SEO y reescribir con datos verificables o dejar como propuesta en el panel de admin hasta que el cliente valide.
- `/funcionamiento-de-un-transformador-en-la-industria/`: No explica realmente el principio de funcionamiento; es texto comercial con servicios (consultoría, pruebas, cálculos eléctricos) no documentados. Reescribir con contenido técnico verificado por ingeniería.
- `/limites-de-un-transformador-y-como-afectan-su-rendimiento/`: Texto comercial con claves técnicas vagas; afirma cumplimiento de 'normativa CE' de forma general (el catálogo condiciona el CE de los variadores a su montaje en envolvente). Reescribir con datos de fichas técnicas.
- `/aplicaciones-de-los-transformadores-en-la-industria-actual/`: Aplicaciones listadas son genéricas y de potencia/distribución, no necesariamente del catálogo real de Torivac (toroidales, variadores, resistencias). Reescribir con aplicaciones reales de las fichas.
- `/para-que-sirve-un-transformador-descubre-su-funcion-clave/`: La función del transformador se resuelve en un párrafo; el resto es comercial con afirmaciones no documentadas. Reescribir con explicación didáctica real.
- `/estabilizadores-de-tension/`: Explica el estabilizador como un transformador con varias salidas, que no coincide con las series reales de Torivac (AVS electromecánica con servomotor y BAVS electrónica). Reescribir con la descripción real de las series.

**Propuesta en admin (no publicar sin validar) (10)**. Contiene afirmaciones que podrían ser falsas o comprometedoras (servicios, certificaciones, medio ambiente). No se publica como hecho: se muestra como propuesta en el panel de admin hasta que el cliente la confirme o la sustituya.

- `/mantenimiento-de-transformadores-electricos/`: Describe servicios (termografía, análisis de aceites dieléctricos, contratos de mantenimiento) que no aparecen en ninguna otra página ni en el catálogo. No publicar como hecho; dejar como propuesta en admin hasta confirmar con el cliente si ofrece ese servicio.
- `/como-extender-la-vida-util-de-un-transformador/`: Menciona 'garantía extendida' y 'procesos de fabricación certificados' sin respaldo documental; la única garantía documentada está en el catálogo (Torivac_2024.pdf, p. 13). Reescribir o dejar como propuesta.
- `/impacto-medioambiental-de-los-transformadores-hoy/`: Contiene afirmaciones medioambientales concretas (materiales ecológicos, trazabilidad total, alineación con el ODS 7) sin evidencia en las fuentes. Riesgo de 'greenwashing': no publicar sin validación del cliente.
- `/seguridad-en-el-uso-de-transformadores/`: Atribuye a los transformadores Torivac protecciones concretas (sobrecarga, detección temprana de cortocircuito) y conformidad con 'directivas IEC y EN' sin respaldo; además confunde normas con directivas.
- `/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/`: Atribuye a Torivac un 'servicio de diagnóstico y reparación' inexistente en el resto del sitio y repite la keyword de forma artificial. No publicar sin validar.
- `/eficiencia-de-los-transformadores-clave-en-europa/`: Afirma cumplimiento de la directiva Ecodesign y eficiencia 'comprobada' sin datos de pérdidas ni clase de eficiencia. Reescribir con datos de fichas técnicas.
- `/como-se-mejora-un-transformador-con-tecnicas-expertas/`: Atribuye a Torivac servicios de reparación y modernización (re-impregnación al vacío, refrigeración, sustitución de aislamientos) inexistentes en el resto del sitio. No publicar sin validación.
- `/como-se-fabrica-un-transformador-proceso-y-calidad-europea/`: La descripción del proceso es genérica y las certificaciones no se nombran. Sustituir por una descripción real del proceso de Torivac (bobinado, encapsulado, ensayos) validada por el cliente.
- `/materiales-de-un-transformador-clave-en-su-rendimiento/`: Mezcla datos técnicos genéricos (acero al silicio, cobre esmaltado) con afirmaciones de ensayos y calidad superior no documentadas y una generalización despectiva sobre fábricas chinas. Reescribir con materiales reales de fichas.
- `/descargadores-de-bateria/`: El catálogo no incluye 'descargadores de batería' como producto; el artículo afirma que Torivac los fabrica. Confirmar con el cliente si es producto real (podría corresponder a bancos de carga) antes de publicar; la imagen y su alt están en otro idioma.

**No migrar (4)**. Sin valor editorial (técnico, vacío) o con riesgo reputacional. Decisión final del cliente.

- `/confirmar/`: Página de checkout de WooCommerce sin contenido propio (solo marcado de bloques, 0 caracteres de texto visible); no migrar. La web nueva tendrá su propio flujo de presupuesto.
- `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/`: Tono negativo hacia el organizador de la feria (riesgo reputacional), erratas y falta de meta description. Recomendado reescribir en tono neutral o retirar; decisión del cliente.
- `/shop/`: Archivo técnico de WooCommerce. Contiene un shortcode de WPBakery sin renderizar (vc_raw_html en base64) como descripción de una categoría.
- `/category/sin-categorizar/`: Archivo vacío por defecto de WordPress, indexable; no migrar.

## 4. Datos de empresa que aparecen en el sitio

Cada dato lleva su fuente. Lo que no consta se deja vacío y se anota en la sección 9.

| Dato | Valor | Fuente / observación |
|---|---|---|
| Razón social | Torivac S.L. (parcial). Variantes: GRUPO TORIVAC (responsable en aviso legal y política de privacidad); Torivac (marca); Grupo Torivac (títulos SEO); 'Grupor Torivac' (errata en el título SEO de /torivac-empresa/) | [/](https://grupotorivac.com/) (Pie de página: 'Torivac S.L. ha participado en el Programa de Iniciac…); [/](https://grupotorivac.com/) (JSON-LD: WebSite.alternateName 'Torivac S.L' y Organization.alternate…); [/aviso-legal-2/](https://grupotorivac.com/aviso-legal-2/) ('GRUPO TORIVAC, responsable del sitio web'). El campo del titular está vacío en el aviso legal y la política de privacidad ('la ostenta: , con NIF: B60784584'); la denominación registral completa no consta en ninguna fuente. Pendiente de confirmar con el cliente. |
| NIF | B60784584 | [/aviso-legal-2/](https://grupotorivac.com/aviso-legal-2/) (DATOS IDENTIFICATIVOS); [/politica-de-privacidad/](https://grupotorivac.com/politica-de-privacidad/) (CONTACTO) |
| Dirección | C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona. En el mapa: Carrer de Potosí, 2, planta 6, San Andrés de Palomar, 08030 Barcelona | [/contacto/](https://grupotorivac.com/contacto/) (Texto de contacto e iframe de Google Maps (title/aria-label)); [/aviso-legal-2/](https://grupotorivac.com/aviso-legal-2/) (DATOS IDENTIFICATIVOS); [/](https://grupotorivac.com/) (Pie de página). Se escribe 'Potosi' sin tilde en el texto y 'Potosí' en el mapa. No consta código de país ni provincia. |
| Teléfono | +34 93 312 01 61 | [/contacto/](https://grupotorivac.com/contacto/) (Contacto y pie de página); [/aviso-legal-2/](https://grupotorivac.com/aviso-legal-2/) (DATOS IDENTIFICATIVOS); [/declaracion-de-accesibilidad/](https://grupotorivac.com/declaracion-de-accesibilidad/) (Observaciones y datos de contacto) |
| Correo | info@torivac.com | [/contacto/](https://grupotorivac.com/contacto/) (Contacto y pie de página); [/aviso-legal-2/](https://grupotorivac.com/aviso-legal-2/) (DATOS IDENTIFICATIVOS); [/declaracion-de-accesibilidad/](https://grupotorivac.com/declaracion-de-accesibilidad/) (Observaciones y datos de contacto). Único correo de contacto en las fuentes ES (234 apariciones). El dominio (torivac.com) difiere del de la web (grupotorivac.com). docs/PLAN.md asume info@grupotorivac.com y mzamora@...: ninguno aparece en las fuentes. Las direcciones 'admin@promodoc.ru', 'josep.leyen@protonmail.com', etc. del HTML son una lista negra anti-spam d… |
| Redes sociales | Ninguna con enlace. El pie muestra un icono de LinkedIn sin enlace | No hay ningún perfil ni enlace a redes sociales en el HTML ES (cabecera, pie, JSON-LD: sin sameAs). El pie de todas las páginas y entradas muestra un icono de LinkedIn (Font Awesome 'fab fa-linkedin', 230 apariciones en los 208 HTML ES) que NO está dentro de ningún <a>: no enlaza a ninguna parte y no consta la URL del perfil. La política de cookies cita Facebook, Twitter, Instagram, YouTube, Pinterest y LinkedIn sol… |
| Horarios | No constan | Búsqueda en los textos ES de páginas y entradas: sin resultados |
| Años de trayectoria | Desde 1964 (más de 60 años, 'más de medio siglo'). Toroidales: 'experiencia superior a treinta años' | [/torivac-empresa/](https://grupotorivac.com/torivac-empresa/) (MISIÓN); portada; catálogo `Torivac_2024.pdf` p. 15. Cifras compatibles solo si se acota (empresa desde 1964; toroidales desde hace >30 años). Unificar en la web nueva. |
| Presencia internacional | más de 30 países; productos presentes en los 5 continentes | [/](https://grupotorivac.com/) ('Contamos con presencia en más de 30 países'); [/torivac-empresa/](https://grupotorivac.com/torivac-empresa/) (MISIÓN: 'presentes en los 5 continentes'). Sin lista de países ni clientes de referencia. |
| Dirección de la empresa | D. Ramón Zamora (liderazgo) | [/torivac-empresa/](https://grupotorivac.com/torivac-empresa/). No se indica cargo. docs/PLAN.md menciona 'mzamora': coincide el apellido, no hay correo en las fuentes. |
| Certificaciones de empresa | Ninguna citada (ni ISO ni otra) | Ninguna página institucional cita una certificación de empresa (ISO u otra). Las entradas del blog hablan de 'certificaciones reconocidas' sin nombrarlas. Normas de producto citadas en fichas: EN 61558, VDE 0570, UL-506, CSA C22.2, CEE 15, SEMKO 115 (no son páginas de empresa). |
| Financiación pública | Programa de Iniciación a la Exportación ICEX-Next, con apoyo de ICEX y cofinanciación de Fondos europeos FEDER | [/](https://grupotorivac.com/) (Pie de página de las páginas (id 14231) con la imagen MANUAL-FEDER-IC…). Obligación de publicidad: mantener texto y logotipos en el pie de la web nueva. El pie de las entradas (id 14542) no lo incluye. |
| Cifras clave | Más de 60 años / desde 1964; Presencia en más de 30 países; 5 continentes; 65 productos en las 11 familias con tarjeta (80 productos ES en total según data/analysis…; Resistencias: gama 'de 50W a 200K W' (sic); Control del 100% de los variadores fabricados; Catálogo 2024: 41 páginas, ES/EN/FR/DE | Ver `company_facts.cifras_clave` (cada cifra con su fuente) |
| Tecnologías y servicios declarados | modelado 3D, simulaciones en tiempo real, fabricación a medida, proyectos llave en mano (diseño, fabricación y puesta en marcha) | Portada y Proyectos; sin evidencia adicional |
| Idiomas del sitio | ES (raíz), EN, FR, DE | Selector de idioma de la cabecera ([https://grupotorivac.com/](https://grupotorivac.com/)) |
| Catálogos PDF | Torivac_2024 en ES, EN, FR y DE (41 páginas cada uno) | Menú CATALOGO y botón 'Descargar Catalogo'; `data/analysis/pdf-index.json` |
| Analítica | GA4 G-QXLKHV4Y7X; GTM GTM-K93FKL89 | `tracking_ids` de `data/analysis/pages/es/*.json` |
| Agencia web | Santiso Marketing (https://santisomarketing.com/) | Pie de página. En WordPress todas las entradas figuran con el autor 'Franco Santiso' (Yoast: 'Escrito por'); el apellido coincide con la agencia, pero las fuentes no dicen que sea personal de Santiso Marketing: no se asume. |

## 5. Páginas legales

El texto íntegro de las cuatro está en `data/analysis/content/es.json`, clave `legal_pages` (y en `full_text` de cada pieza). Aquí solo se resume.

| Página | ID | Publ. / modif. | Caracteres | Problemas de gravedad alta | Decisión |
|---|---|---|---|---|---|
| [Aviso legal y condiciones generales de uso](https://grupotorivac.com/aviso-legal-2/) | 1109 | 2022-12-16 / 2025-12-10 | 18.803 | El titular del sitio está en blanco: 'la ostenta: , con NIF: B60784584'. Falta denominación social completa.; Faltan datos registrales (Registro Mercantil) y razón social completa en los datos identificativos (art. 10 LSSI); revisar con asesoría legal. | Revisión legal antes de migrar |
| [Política de privacidad](https://grupotorivac.com/politica-de-privacidad/) | 14762 | 2025-12-10 / 2025-12-10 | 5.627 | El titular está en blanco: 'la ostenta: , con NIF: B60784584'.; Variable de plantilla sin resolver: para ejercer derechos 'puede enviarnos una comunicación a correodelcliente' (no hay dirección).; Faltan plazos concretos de conservación, destinatarios/encargados (Google reCAPTCHA, Analytics, hosting), derecho a reclamar ante la AEPD y bases por finalidad; menciona 'datos económicos' aunque el sitio no vende. Revi… | Revisión legal antes de migrar |
| [Política de cookies](https://grupotorivac.com/politica-de-cookies/) | 1117 | 2022-12-16 / 2025-02-11 | 4.390 | Sin inventario de cookies (nombre, finalidad, duración, proveedor): el sitio carga Google Analytics 4 (G-QXLKHV4Y7X), Google Tag Manager (GTM-K93FKL89), reCAPTCHA y el banner Complianz. | Reescribir |
| [Declaración de accesibilidad](https://grupotorivac.com/declaracion-de-accesibilidad/) | 14774 | 2025-12-10 / 2025-12-10 | 4.636 | Contradicción: se declara 'parcialmente conforme' y a la vez que el incumplimiento 'No aplica. Cumple el 100%'.; Declara nivel AA de WCAG 2.1 por autoevaluación, mientras el sitio actual tiene alts vacíos o con nombre de archivo, ausencia de H1 y enlaces rotos aparentes en el pie de las entradas. | Reescribir |

Observaciones:

- El slug del aviso legal es `aviso-legal-2` y solo existe traducido al alemán (`/de/aviso-legal-2/`).
- La política de cookies no se extrajo del HTML (el extractor solo recogió el pie): su texto íntegro procede de la API REST (id 1117).
- En EN, FR y DE el título de la política de cookies está traducido, pero el índice de páginas registra como URL la española (`/politica-de-cookies/`); la declaración de accesibilidad tiene URL traducida con el slug en español (`/en/declaracion-de-accesibilidad/`). Ver los ficheros de cada idioma.
- El banner de consentimiento es de Complianz y enlaza en ejecución a la política de cookies, a la de privacidad y al aviso legal (ver sección 6).

## 6. Cabecera, pie y banner de cookies

Son comunes a todas las páginas y no forman parte del `full_text`. Los datos están en `site_chrome`.

- **Cabecera** (plantilla Elementor/Betheme): logotipo `Torivac_negativo.png` (alt = nombre de archivo). Menú: INICIO; TORIVAC EMPRESA; PRODUCTOS; PROYECTOS COMERCIALES TORIVAC; CATALOGO; BLOG; CONTACTO. Selector de idioma: English, Français, Español, Deutsch. Buscador con placeholder 'Busar' (errata).
- **Pie de las páginas** (Elementor 14231): logotipo, dirección, teléfono, correo, '© 2025 Torivac. Todos los derechos reservados', enlaces a Aviso legal y condiciones de uso, Política de Privacidad y Declaración de accesibilidad, 'Desarrollado por Santiso Marketing', logotipo `MANUAL-FEDER-ICEX-NEXT-2027.jpeg`, icono de LinkedIn sin enlace y el aviso de financiación ICEX-Next/FEDER. El texto íntegro del aviso: «Torivac S.L. ha participado en el Programa de Iniciación a la Exportación ICEX-Next, y ha contado con el apoyo de ICEX, así como con la cofinanciación de Fondos europeos FEDER, habiendo contribuido según la medida de los mismos, al crecimiento económico de esta empresa, su región y de España en su conjunto.» Debe conservarse en la web nueva por la obligación de publicidad de la financiación.
- **Pie de las entradas** (Elementor 14542, `footer-blog`): bloque 'CONTACTA CON NOSOTROS' con el formulario 14511 y dos pies idénticos con '© 2022 Torivac', enlace a `/aviso-legal/` (roto aparente), el logotipo antiguo de Fondos Europeos sin el aviso de ICEX-Next, y el icono de LinkedIn sin enlace. Sin enlaces a privacidad ni accesibilidad.
- **Banner de cookies** (Complianz): título 'Gestionar consentimiento', categorías Funcional (siempre activo), Preferencias, Estadísticas y Marketing; botones Aceptar, Denegar, Ver preferencias y Guardar preferencias. El marcado estático lista 3 enlaces ('cookie-statement', 'privacy-statement', 'impressum') con href='#' y marcador '{title}'; Complianz los resuelve en ejecución con complianz.page_links.eu: Política de cookies -> /politica-de-cookies/, Política de privacidad -> /politica-de-privacidad/, Aviso legal -> /aviso-legal-2/ (no verificado visualmente: sin captura del banner abierto).

## 7. Hallazgos de calidad

Cada hallazgo tiene una evidencia que se comprobó automáticamente contra el texto, el SEO, las imágenes o el HTML. Los hallazgos completos están en `quality_flags` de cada pieza.

### 7.0 Gravedad alta (24)

| Pieza | Tipo | Hallazgo |
|---|---|---|
| `/aviso-legal-2/` | placeholder | El titular del sitio está en blanco: 'la ostenta: , con NIF: B60784584'. Falta denominación social completa. |
| `/aviso-legal-2/` | legal | Faltan datos registrales (Registro Mercantil) y razón social completa en los datos identificativos (art. 10 LSSI); revisar con asesoría legal. |
| `/politica-de-privacidad/` | placeholder | El titular está en blanco: 'la ostenta: , con NIF: B60784584'. |
| `/politica-de-privacidad/` | placeholder | Variable de plantilla sin resolver: para ejercer derechos 'puede enviarnos una comunicación a correodelcliente' (no hay dirección). |
| `/politica-de-privacidad/` | legal | Faltan plazos concretos de conservación, destinatarios/encargados (Google reCAPTCHA, Analytics, hosting), derecho a reclamar ante la AEPD y bases por finalidad; menciona 'datos económicos' aunque el sitio no vende. Revisar con asesoría legal. |
| `/politica-de-cookies/` | legal | Sin inventario de cookies (nombre, finalidad, duración, proveedor): el sitio carga Google Analytics 4 (G-QXLKHV4Y7X), Google Tag Manager (GTM-K93FKL89), reCAPTCHA y el banner Complianz. |
| `/declaracion-de-accesibilidad/` | consistency | Contradicción: se declara 'parcialmente conforme' y a la vez que el incumplimiento 'No aplica. Cumple el 100%'. |
| `/declaracion-de-accesibilidad/` | unverified_claim | Declara nivel AA de WCAG 2.1 por autoevaluación, mientras el sitio actual tiene alts vacíos o con nombre de archivo, ausencia de H1 y enlaces rotos aparentes en el pie de las entradas. |
| `/normativas-sobre-transformadores-electricos-en-europa/` | unverified_claim | Afirma documentación técnica reconocida por entidades certificadoras europeas sin citar ninguna; no hay certificados ni fichas que lo respalden en las fuentes. |
| `/mantenimiento-de-transformadores-electricos/` | unverified_claim | Presenta a Torivac como empresa especializada en mantenimiento de transformadores; no existe esa línea de servicio en el resto del sitio (home, empresa, productos, proyectos). |
| `/mantenimiento-de-transformadores-electricos/` | unverified_claim | Lista servicios técnicos concretos (termografía, análisis de aceites dieléctricos...) sin respaldo en otras fuentes. |
| `/como-extender-la-vida-util-de-un-transformador/` | unverified_claim | 'Garantía extendida' sin plazo, condiciones ni documento; el catálogo solo recoge garantía estándar con exclusiones. |
| `/impacto-medioambiental-de-los-transformadores-hoy/` | unverified_claim | Afirma materiales ecológicos y de proceso bajo en emisiones sin certificado ambiental ni dato. |
| `/impacto-medioambiental-de-los-transformadores-hoy/` | unverified_claim | Trazabilidad total de cada unidad y documentación detallada: no hay evidencia en otras fuentes. |
| `/funcionamiento-de-un-transformador-en-la-industria/` | reputation | Afirma que el soporte de proveedores asiáticos es inexistente o con manuales mal traducidos: declaración despectiva sin fuente. |
| `/seguridad-en-el-uso-de-transformadores/` | unverified_claim | Funciones de protección atribuidas a los transformadores sin ficha técnica que las respalde. |
| `/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | unverified_claim | Servicio de diagnóstico y reparación atribuido a Torivac sin respaldo en el resto del sitio. |
| `/eficiencia-de-los-transformadores-clave-en-europa/` | unverified_claim | Cumplimiento de Ecodesign afirmado sin identificar reglamento ni producto. |
| `/como-se-mejora-un-transformador-con-tecnicas-expertas/` | unverified_claim | Servicios de optimización y reparación atribuidos a Torivac sin respaldo. |
| `/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | unverified_claim | Afirma certificaciones de calidad reconocidas sin nombrarlas; no constan certificados de empresa en las fuentes. |
| `/materiales-de-un-transformador-clave-en-su-rendimiento/` | reputation | Generalización sobre fábricas chinas que 'evitan controles': riesgo reputacional/legal. |
| `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | reputation | Crítica explícita a la organización de la feria (la propia entrada enlaza a https://www.ifema.es/matelec/que-es): riesgo reputacional. |
| `/descargadores-de-bateria/` | unverified_claim | Afirma que Torivac fabrica descargadores de batería; no existe ficha ni categoría de ese producto en el catálogo. |
| `/shop/` | placeholder | La descripción de 'Botones de mando y accesorios' muestra un shortcode '[vc_row][vc_column][vc_raw_html]…' en base64 que, al decodificarse, contiene HTML con una imagen del dominio de staging torivac.santisomarketing.com y un texto de variadores copiado. |

### 7.1 Erratas, gramática y estilo

| Pieza | Hallazgo | Evidencia |
|---|---|---|
| `/` | Errata en la rejilla de productos y su enlace: 'Potenciómentros' (Potenciómetros). | «Potenciómentros y reostatos» |
| `/` | 'Catalogo' sin tilde en el CTA. | «Descargar Catalogo» |
| `/` | 'te la resolveremos' no tiene antecedente (se copió del bloque de contacto, donde se refiere a 'duda'); mezcla además usted ('Conozca', 'Descargue') y tú ('Escríbenos', 'te'). | «Escríbenos y te la resolveremos» |
| `/` | 'encontrareis' sin tilde y en forma de 'vosotros' dentro de un texto en usted/tú. | «encontrareis» |
| `/` | El tagline del WebSite en JSON-LD tiene la errata 'variados de tensión'. | «variados de tensión» |
| `/torivac-empresa/` | El título SEO dice 'Grupor Torivac - Nuestra Empresa' ('Grupor'). | «Grupor Torivac - Nuestra Empresa» |
| `/productos/` | Tildes y mayúsculas incoherentes: 'Nucleos', 'Reostatos', 'Variadores Monofasicos', 'Energias renovables', 'Caratulas graduadas', 'Potenciometros'. | «Nucleos» |
| `/productos/` | Nombres de categoría en minúscula: 'hembrilla de seguridad HR4', 'led 10mm'. | «hembrilla de seguridad HR4» |
| `/proyectos-empresariales/` | Léxico latinoamericano en texto para un público español ('costos'). | «costos» |
| `/contacto/` | 'Potosi' sin tilde (el mapa usa 'Potosí'). | «C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» |
| `/contacto/` | 'encontrareis' sin tilde y en forma de 'vosotros'. | «encontrareis» |
| `/aviso-legal-2/` | Errata: 'lo menús' (los menús). | «lo menús» |
| `/aviso-legal-2/` | Frase rota en COOKIES: 'preferencias de navegación u publicitarias que el Usuario, a los perfiles demográficos...'. | «navegación u publicitarias» |
| `/politica-de-privacidad/` | 'trataremos su datos' (sus datos) y 'Las tipos de datos' (Los tipos). | «trataremos su datos» |
| `/politica-de-privacidad/` | 'Las tipos de datos que se solicitan y tratan son'. | «Las tipos de datos que se solicitan» |
| `/politica-de-cookies/` | Usa 'Twitter' (hoy X). | «Twitter:» |
| `/declaracion-de-accesibilidad/` | 'SITUACION' sin tilde. | «SITUACION DE CUMPLIMIENTO» |
| `/normativas-sobre-transformadores-electricos-en-europa/` | Errata: 'problemíticas' (problemáticas). | «problemíticas» |
| `/normativas-sobre-transformadores-electricos-en-europa/` | Titulares con topónimo/marca en minúscula ('españa', 'torivac'). | «regulaciones técnicas en españa y europa» |
| `/mantenimiento-de-transformadores-electricos/` | Subtítulo H3 que empieza en minúscula. | «presión en el mercado y dudas sobre la calidad de los fabricantes asiáticos» |
| `/como-extender-la-vida-util-de-un-transformador/` | Titular con 'europa' en minúscula. | «Prolongación de la vida útil de un transformador en europa» |
| `/impacto-medioambiental-de-los-transformadores-hoy/` | Titular con 'europa' y 'españa' en minúscula. | «Impacto medioambiental de los transformadores en europa y españa» |
| `/funcionamiento-de-un-transformador-en-la-industria/` | Unidad 'kw' en minúscula (kW). | «cada kw debe estar perfectamente controlado» |
| `/funcionamiento-de-un-transformador-en-la-industria/` | Anglicismo innecesario 'know-how'. | «know-how» |
| `/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 'Venta' con mayúscula inicial en mitad de frase. | «una trayectoria centrada en la Venta de transformadores» |
| `/como-se-mejora-un-transformador-con-tecnicas-expertas/` | Anglicismo 'ROI' en texto para público general. | «ROI» |
| `/aplicaciones-de-los-transformadores-en-la-industria-actual/` | Concordancia: 'los requisitos estrictos que rige' (rigen). | «los requisitos estrictos que rige el entorno industrial actual» |
| `/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | Hipérbole comercial ('elección más inteligente', 'aliado perfecto'). | «Por qué Torivac es la elección más inteligente para empresas exigentes» |
| `/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | Nombres propios en minúscula en titular y cuerpo ('coiltech deutschland', 'messe augsburg', 'torivac'). | «recinto de messe augsburg» |
| `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Errata: 'apaliar' (paliar). | «apaliar» |
| `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Impersonal mal conjugado: 'hubieron' (hubo). | «hubieron ciertos problemas de organización» |
| `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 'algun producto/stand interesantes' (sin tilde y sin concordancia). | «algun producto/stand interesantes» |
| `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Mayúscula tras coma: 'Sin embargo, No tuvimos'. | «Sin embargo, No tuvimos» |
| `/torivac-en-beyond-catalonia/` | Errata: 'Beyond Catalona'. | «Beyond Catalona» |
| `/torivac-en-beyond-catalonia/` | Palabra repetida: 'una nueva una estrategia'. | «Consolidamos una nueva una estrategia» |
| `/torivac-en-beyond-catalonia/` | 'articulo' sin tilde. | «este articulo» |
| `/torivac-en-beyond-catalonia/` | 'cliente journey' (customer journey / recorrido del cliente). | «cliente journey» |
| `/torivac-en-beyond-catalonia/` | Bloque duplicado con errata 'la fabricación dispositivos'. | «garantiza la fabricación dispositivos de alta precisión» |
| `/estabilizadores-de-tension-con-cobre/` | 'un niveles de tensión estables y constante' (concordancia). | «mantener un niveles de tensión estables y constante» |
| `/estabilizadores-de-tension-con-cobre/` | Forma de 'vosotros' en texto por lo demás de tú/usted: 'evitareis'. | «evitareis» |
| `/estabilizadores-de-tension-con-cobre/` | Superlativo sin prueba ('Sin lugar a dudas, la más efectiva'). | «Sin lugar a dudas, la más efectiva» |
| `/estabilizadores-de-tension/` | Falta de 'para': 'es de vital importancia garantizar'. | «es de vital importancia garantizar el flujo energético estable» |
| `/estabilizadores-de-tension/` | Concordancia: 'mientras están en uso' (singular). | «mientras están en uso» |
| `/estabilizadores-de-tension/` | Forma de 'vosotros' en texto de tú: 'Podéis'. | «Podéis pensarlo» |
| `/descargadores-de-bateria/` | 'bateria' sin tilde. | «bateria puede soportar una carga» |
| `/la-importancia-del-transformador-toroidal-en-la-industria/` | Sintaxis rota: 'Se trata de productos se destacan'. | «Se trata de productos se destacan» |
| `/la-importancia-del-transformador-toroidal-en-la-industria/` | Frase sin sentido: 'no dudes en consultar cualquier duda ... puede proporcionar'. | «no dudes en consultar cualquier duda con expertos en electricidad o ingenieros…» |
| `/la-importancia-del-transformador-toroidal-en-la-industria/` | Anglicismo 'click' y tono coloquial ('por suerte para tu empresa'). | «por suerte para tu empresa» |
| `/elementor-hf/header/` | Entrada de menú 'CATALOGO' sin tilde y enlazada directamente a Torivac_2024.pdf. | «CATALOGO» |
| `/elementor-hf/header/` | El placeholder del buscador es 'Busar' (Buscar). | «Busar» |

Léxico latinoamericano en un sitio dirigido a España: 'costo(s)' (9 piezas), 'falla(s)' (3 piezas), 'reporte(s)' (1 pieza), 'mediano plazo' (1 pieza), 'liviana(s)' (1 pieza). Conviene unificar a castellano de España ('costes', 'averías', 'informes', 'medio plazo', 'ligeras'). Mezcla de registros: la portada alterna usted ('Conozca', 'Descargue') y tú ('Escríbenos'); 'evitareis', 'encontrareis' y 'Podéis' usan vosotros en textos de tú. Anglicismos: 'know-how', 'ROI', 'performance', 'click', 'cliente journey'. Nombres propios en minúscula ('españa', 'europa', 'torivac', 'messe augsburg') en 5 piezas (blog, 3 entradas de diciembre y la noticia de Coiltech).

### 7.2 Idioma equivocado y texto de interfaz en otro idioma

| Pieza | Hallazgo | Evidencia |
|---|---|---|
| `/blog/` | Texto de interfaz del tema en inglés en cada tarjeta ('Do you like it?' con contador). | «Do you like it?» |
| `/confirmar/` | La URL ES /confirmar/ devuelve la plantilla en inglés (/en/carrito/); probable fallo de mapeo de WPML (no confirmado). | «Legal Notice and Terms of Use» |
| `/descargadores-de-bateria/` | El alt de la imagen está en francés en una página española. | «Les déchargeurs de batterie Torivac permettent» |
| `/la-importancia-del-transformador-toroidal-en-la-industria/` | El alt de la imagen está en alemán en una página española. | «Bedeutung des Ringkerntransformators» |
| `/shop/` | El archivo ES se sirve desde /en/shop/ y declara hreflang relativos '/shop/' (inválidos). | «https://grupotorivac.com/en/shop/» |

No hay textos de cuerpo en otro idioma: el problema se limita a alts, interfaz del tema y plantillas. El detalle de traducciones EN/FR/DE se analiza en los ficheros de cada idioma. Avance útil para esas tareas: los títulos de las 21 entradas existen traducidos en EN, FR y DE, pero 'Beyond Catalonia' (nombre propio de un evento) se tradujo en FR como 'l’au-delà de la Catalogne' y en DE como 'Jenseits von Katalonien' (`posts.fr.json` y `posts.de.json`).

### 7.3 Relleno y marcadores sin resolver

No hay Lorem ipsum, 'Hola mundo' ni 'Página de ejemplo' (búsqueda en texto visible, HTML y REST). Sí hay marcadores y restos de plantilla:

| Pieza | Hallazgo | Evidencia |
|---|---|---|
| `/aviso-legal-2/` | El titular del sitio está en blanco: 'la ostenta: , con NIF: B60784584'. Falta denominación social completa. | «la ostenta: , con NIF:» |
| `/politica-de-privacidad/` | El titular está en blanco: 'la ostenta: , con NIF: B60784584'. | «la ostenta: , con NIF:» |
| `/politica-de-privacidad/` | Variable de plantilla sin resolver: para ejercer derechos 'puede enviarnos una comunicación a correodelcliente' (no hay dirección). | «correodelcliente» |
| `/shop/` | La descripción de 'Botones de mando y accesorios' muestra un shortcode '[vc_row][vc_column][vc_raw_html]…' en base64 que, al decodificarse, contiene HTML con una imagen del dominio de staging torivac.santisomarketing.com y un texto de vari… | «[vc_row][vc_column][vc_raw_html]» |

Otros restos: la meta description `%` (9 piezas, lista en la sección 7.7), el marcador `{title}` de los enlaces del banner (se rellena en ejecución) y las etiquetas técnicas del honeypot de los formularios dentro del texto extraído.

### 7.4 Enlaces rotos aparentes y enlaces ausentes

Se comprobaron todos los enlaces internos de las 12 páginas y 21 entradas contra sitemaps, REST, índice de páginas, productos y medios. Solo `/aviso-legal/` no consta en ninguna fuente. No se hicieron peticiones de red, por lo que son enlaces rotos aparentes, no confirmados.

| Hallazgo | Dónde | Detalle |
|---|---|---|
| `/aviso-legal/` no consta en sitemap, REST ni índice de páginas (el aviso real es `/aviso-legal-2/`) | Pie de las 21 entradas y de `/confirmar/` (22 piezas) | Corregir en la web nueva: enlace único al aviso legal |
| `/blog/page/2/` y `/blog/page/3/` (paginación del blog) no se cosecharon | `/blog/` | No está roto: falta cosechar. Las 21 entradas proceden de la API REST |
| 'Haz click aquí' y 'contactar con nosotros aquí' sin enlace | `/la-importancia-del-transformador-toroidal-en-la-industria/` | Texto plano; enlazar a categorías de transformadores y a contacto |
| CTA 'Conocer la empresa Torivac' enlaza a `/proyectos-empresariales/` | Portada | Debería ir a `/torivac-empresa/` |
| Icono de LinkedIn sin enlace | Pie de todas las páginas y entradas (230 iconos, ninguno dentro de un enlace) | Falta la URL del perfil o quitar el icono |
| Teléfono y correo sin enlace `tel:` ni `mailto:` | Todo el sitio ES (0 enlaces en 208 HTML) | Hacerlos clicables |
| Casilla 'He leído y acepto la política de privacidad' sin enlace | Formularios de portada, contacto y las 21 entradas | Enlazar a `/politica-de-privacidad/` |
| `og:image` de Contacto apunta a un icono del plugin de formularios (`submit-spin.svg`) | `/contacto/` | Definir una imagen social real |
| Imagen y recorte con restos de PageSpeed (`xbancos-de-carga.jpg.pagespeed.ic…`) y favicon de 192 px con nombre `xcropped-Logo_Torivac-192x192.png.pagespeed.ic…` | `/descargadores-de-bateria/` y `<head>` de los 208 HTML ES | Usar los originales al migrar |
| Shortcode `[vc_raw_html]` sin renderizar con imagen del dominio de pruebas `torivac.santisomarketing.com` | `/shop/` (categoría 'Botones de mando y accesorios') | No migrar; indica restos de un entorno de staging |

### 7.5 Contenido duplicado

| Qué | Dónde | Detalle |
|---|---|---|
| Bloque corporativo 'Contamos con una experiencia de cerca de 60 años en el sector…' (contiene la errata 'la fabricación dispositivos') | 25 piezas ES: 4 entradas y 21 fichas o categorías de producto | Copia literal; además lista 'descargadores de batería' como producto del catálogo. Aparece en `descargadores-de-bateria`, `estabilizadores-de-tension`, `estabilizadores-de-tension-con-cobre` y `torivac-en-beyond-catalonia` |
| Tres párrafos de la portada ('Fabricamos equipos a medida…', 'La precisión y eficiencia son clave…', 'Nuestra capacidad de innovación…') repetidos en Empresa | `/` y `/torivac-empresa/` | Unificar en un único bloque reutilizable |
| Pie de las entradas con los datos de contacto y el crédito dos veces seguidas | 21 entradas | Un solo pie en la web nueva |
| Bloque 'CONTACTA CON NOSOTROS' (misma frase) en portada, Contacto y 21 entradas | 23 piezas | Un componente único |
| Mismo H2 'Trabajo y colaboración estratégica' dos veces (uno con carácter invisible U+200B) | `/proyectos-empresariales/` | Renombrar uno |

### 7.6 Afirmaciones sin respaldo y riesgo reputacional (entradas)

13 de las 21 entradas mencionan a China (otras hablan de fabricantes 'asiáticos') presentando esos productos como inferiores, sin fuente ni dato. Alguna llega a generalizar ('muchas fábricas chinas evitan esos controles', 'soporte técnico inexistente o limitado a manuales traducidos erróneamente'). Es el mayor riesgo reputacional y legal del contenido actual. Las entradas de diciembre de 2025 también atribuyen a Torivac servicios que no figuran en el resto del sitio ni en el catálogo: mantenimiento de transformadores (termografía, análisis de aceites dieléctricos), diagnóstico y reparación, re-impregnación al vacío, garantía extendida, consultoría. En los datos de producto, 'termografía' solo aparece como técnica de grabado de los discos graduados, y no hay ninguna ficha de mantenimiento o reparación. Lo único documentado es que el catálogo (`Torivac_2024.pdf`, p. 13) ofrece revisar un variador de tensión 'en nuestras instalaciones' y 12 meses de garantía. El catálogo (`Torivac_2024.pdf`, p. 15) sitúa sus transformadores estándar entre 20 VA y 3000 VA, mientras varias entradas hablan de subestaciones, redes de media tensión y transformadores de distribución, que son otra categoría de producto. Solo hay una línea con aceite (variadores en cuba de aceite) y ninguna ficha ofrece análisis de aceites ni mantenimiento.

'Descargadores de batería' aparece como producto solo en la entrada y en el bloque corporativo duplicado; no hay ficha, categoría ni PDF con ese nombre. La imagen de la entrada se llama `bancos-de-carga`, por lo que podría tratarse de los bancos de carga del catálogo: confirmar con el cliente.

Imágenes destacadas: en la captura del índice del blog (`data/raw/screens/blog.desktop.png`) las tarjetas muestran fotografías de transformadores de potencia, subestaciones y operarios en postes, y, la primera, una ilustración de estilo digital; ninguna muestra productos de Torivac. Valorar fotos propias.

Resumen de afirmaciones por entrada: ver el campo `migration.notes` y los hallazgos `unverified_claim`, `reputation` y `accuracy` de cada una.

| Tipo | Hallazgos | Entradas afectadas |
|---|---|---|
| unverified_claim | 29 | 15 |
| reputation | 16 | 15 |
| accuracy | 3 | 3 |
| duplicate_content | 4 | 4 |

### 7.7 SEO y accesibilidad

| Aspecto | Dato | Piezas |
|---|---|---|
| Sin `<h1>` | 28 de 31; el título visible es un H2, H3 o H4 del constructor | `/productos/`, `/blog/`, `/contacto/`, `/aviso-legal-2/`, `/politica-de-privacidad/`, `/politica-de-cookies/`, `/declaracion-de-accesibilidad/`, y las 21 entradas |
| Meta description `%` (variable de Yoast sin resolver) | 9 piezas | `/torivac-empresa/`, `/productos/`, `/blog/`, `/contacto/`, `/aviso-legal-2/`, `/politica-de-privacidad/`, `/politica-de-cookies/`, `/declaracion-de-accesibilidad/`, `/confirmar/` |
| Sin meta description | 1 entrada | `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` |
| Título SEO | Portada: solo 'Torivac'. Empresa: 'Grupor Torivac - Nuestra Empresa'. Coiltech: el `<title>` difiere del H2 y del slug. Estabilizadores: H2 distinto del `<title>` | `/`, `/torivac-empresa/`, 2 entradas |
| Slugs con sufijo duplicado | `aviso-legal-2`, `torivac-en-matelec-…-conexiones-2` | 2 |
| Alt vacío en imágenes de contenido | 35 de 88 | Portada (12), Empresa (4), blog (primera tarjeta) y 16 entradas (Matelec con 3 imágenes) |
| Alt que es un nombre de archivo | 14 de 88 | Portada (11: fotografías de bloques y rejilla), Proyectos (3) |
| Alt en otro idioma | 2 | `descargadores-de-bateria` (francés), `la-importancia-del-transformador-toroidal-en-la-industria` (alemán) |
| Archivos de taxonomía indexables | `/category/blog/` y `/category/sin-categorizar/` (vacío) | 2 |
| Estructura de encabezados | Poco semántica en Empresa y Proyectos (H1, luego H4 y H2 alternados); en entradas el título es un H2 | — |

### 7.8 Formularios

| Formulario | Dónde | Campos y protección |
|---|---|---|
| WPForms 14511 (contacto corto) | Portada y pie de las 21 entradas | Nombre*, Correo*, Mensaje, consentimiento*; honeypot oculto; captcha aritmético oculto por lógica condicional (lista negra de 4 correos y 3 URLs de spam, visible en el HTML); reCAPTCHA v3 |
| WPForms 4921 (contacto) | `/contacto/` | Nombre*, Correo*, Mensaje, consentimiento*; honeypot oculto; reCAPTCHA v3 |
| Buscador del tema | Cabecera | Campo `s`; placeholder con la errata 'Busar' |

El destino de las notificaciones de los formularios no consta en los datos. En ninguno de los dos el consentimiento enlaza a la política de privacidad. Para la web nueva hay que definir destinatarios, antispam y el texto del consentimiento.

## 8. Auditoría del borrador

`es.json` se generó con un script a partir de las fuentes y de anotaciones manuales. Antes de darlo por bueno se contrastó con los datos en bruto. Comprobaciones hechas:

- El `full_text` de 31 de las 37 piezas coincide carácter a carácter (tras normalizar espacios) con el texto del análisis; las otras 6 son la política de cookies (REST), 3 archivos sin texto y 2 plantillas reconstruidas.
- Los números y las citas de los `key_facts` aparecen en el texto (los 10 que no, son metadatos como IDs de formulario o el nº de páginas del PDF, comprobados aparte).
- Datos de contacto, NIF, ICEX/FEDER, JSON-LD, versiones de WordPress (7.1.3), WooCommerce (11.2.1), Elementor (4.3.5), WPML (5.1.0) y Yoast (28.7), identificadores de analítica, autor de las entradas y citas del catálogo (pp. 2, 12, 13 y 15) contrastados con el HTML, la REST y los PDF.
- Búsqueda de enlaces `tel:` y `mailto:`, redes sociales, horarios y texto de relleno en los 208 HTML ES.

Correcciones aplicadas al borrador:

- confirmar: REST no está vacío (3.250 caracteres de bloques WooCommerce Checkout, 0 de texto visible); es el checkout, no el carrito
- /aviso-legal/: 'inexistente' pasa a 'enlace roto aparente' (solo se puede afirmar que no consta en las fuentes)
- Banner de cookies: la afirmación 'no enlaza a la política de cookies' era errónea; Complianz lo enlaza en ejecución (page_links)
- Formularios 14511 y 4921: el campo [4] de 4921 y el [5] de 14511 son honeypots (hn_data), no captchas; el captcha aritmético de 14511 está oculto por lógica condicional
- Redes sociales: el pie muestra un icono de LinkedIn sin enlace (antes se decía 'ninguna')
- blog: h1_visual pasa a null (el único H2 es el título de la primera tarjeta; la página no tiene encabezado propio)
- Matelec: IFEMA se menciona porque la propia entrada enlaza a ifema.es/matelec, no como 'cliente'
- Autoría del blog: se elimina la inferencia 'usuario de la agencia' (solo consta el autor WordPress 'Franco Santiso')
- Pie de entradas (footer-blog): sí incluye el logotipo antiguo Logotipos_FondosEuropeos.jpg (alt vacío) y un icono LinkedIn sin enlace; no incluye el texto ICEX-Next
- Huecos añadidos: entrada EN-only id 8196, banner de cookies sin captura, /aviso-legal/ sin comprobación por red, destino de formularios, URL de LinkedIn

## 9. Huecos y preguntas para el cliente

- Razón social completa y datos registrales: el titular está vacío en aviso legal y política de privacidad (solo NIF B60784584 y 'Torivac S.L.' en el pie/JSON-LD).
- Correo de destino de los formularios: no consta en las fuentes (WPForms no expone notificaciones); solo info@torivac.com. El plan asume info@grupotorivac.com y un correo 'mzamora', no confirmados.
- Redes sociales: ningún perfil con enlace (el pie solo muestra un icono de LinkedIn sin enlace). Horarios de atención: no constan.
- Certificaciones de empresa (ISO, etc.): no constan; las entradas del blog afirman 'certificaciones reconocidas' sin nombrarlas.
- Servicios de mantenimiento, reparación, modernización, garantía extendida y descargadores de batería: afirmados en entradas del blog, ausentes del resto del sitio y del catálogo; pendientes de confirmar con el cliente.
- Blog: solo se cosechó la primera página del índice (/blog/page/2/ y /blog/page/3/ no están en los datos); las 21 entradas proceden de la API REST.
- Política de cookies: el HTML cosechado solo contiene el pie; el texto íntegro procede de la API REST (data/raw/rest/pages.es.json, id 1117).
- Las capturas ES de /confirmar/ y /shop/ devuelven la plantilla de /en/carrito/ y /en/shop/ (canonical): no hay carrito, tienda ni mi-cuenta ES en los datos.
- El aviso legal solo tiene traducción DE; el índice de páginas registra la URL española para las políticas de cookies EN/FR/DE (con el título traducido): revisar en las tareas de idioma.
- Cifra '60 años' vs 'más de treinta años' (toroidales): requiere criterio del cliente.
- Clientes de referencia, lista de países y casos de éxito: no constan en ninguna página ES.
- Autoría real de los textos del blog (todos firmados 'Franco Santiso' en WordPress; no consta quién redactó los textos).
- Entrada EN id 8196 'What is a Voltage Variator?' (slug 'el-variador-de-tension-y-sus-funciones', 2024-09-19): existe solo en inglés (22 entradas EN frente a 21 en ES/FR/DE), con la meta description en español. No hay original ES en la API REST ni en el sitemap: posible original ES despublicado o borrado; confirmar con el cliente. Se analiza en el fichero EN.
- Banner de cookies: sus enlaces a política de cookies, privacidad y aviso legal se rellenan en ejecución (complianz.page_links); no hay captura del banner abierto en data/raw/screens para verlo.
- El enlace /aviso-legal/ del pie antiguo se marca como roto aparente solo por no constar en sitemap, REST ni índice de páginas; no se comprobó por red.
- Icono de LinkedIn del pie sin enlace: falta la URL del perfil de empresa (y si existen otros perfiles).

Preguntas que desbloquean la migración:

1. ¿Cuál es la razón social completa y los datos del Registro Mercantil para el aviso legal y la política de privacidad? ¿A qué correo deben llegar los formularios y el pedido (en las fuentes solo consta `info@torivac.com`; el plan asumía `info@grupotorivac.com`)?
2. ¿Qué servicios ofrece realmente Torivac además de fabricar (mantenimiento, reparación, diagnóstico, garantía extendida)? ¿Qué certificaciones de empresa tiene?
3. ¿Se mantienen las entradas con comparativas contra fabricantes chinos? Se recomienda reescribirlas sin nombrar países.
4. ¿Existe perfil de LinkedIn de la empresa u otras redes? ¿Cuál es el horario de atención?
5. ¿Hubo una entrada original en español de 'El variador de tensión y sus funciones' (id EN 8196)?
6. Cifra de trayectoria para la web nueva: '60 años' (desde 1964) frente a 'más de treinta años' en transformadores toroidales.

## 10. Cómo usar `es.json`

- `items[]`: una pieza por elemento. Campos principales: `type` (page, post u other), `id`, `url`, `slug`, `title`, `h1` y `h1_visual`, `date`, `modified`, `purpose`, `sections[{heading, summary, key_facts[]}]`, `full_text` (íntegro y sin HTML, para migrar), `ctas`, `images[{src, alt, alt_issue, role}]`, `pdf_links`, `internal_links`, `external_links`, `forms`, `translation_of_es` (null en ES), `translation_quality` (`n/a` en ES), `translations_hreflang`, `migration{decision, notes}`, `quality_flags[]` y `notes`.
- `company_facts`: datos de empresa con fuente. `legal_pages[]`: texto íntegro de las cuatro páginas legales. `site_chrome`: cabecera, pies y banner. `cross_findings`, `stats`, `gaps`, `field_notes` y `audit`.
- Para migrar el texto de una pieza: usar `full_text` y aplicar las correcciones de `quality_flags` de tipo `typo`, `grammar` y `style`. En la portada y en las entradas hay que descartar el ruido del formulario (`personalizado Captcha Nombre`, `Captcha personalizado`, `=`).
