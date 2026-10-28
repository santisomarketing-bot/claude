# 02 · Contenido en inglés (en): páginas y entradas

> Sesión 1 · Análisis profundo. Datos de contenido en `data/analysis/content/en.json` (texto íntegro para migrar, secciones, CTA, imágenes, formularios, comparación con ES, datos de empresa, textos legales y hallazgos con evidencia verificada). Este documento es el inventario legible. Fuentes: `data/analysis/pages/en/*.json`, `data/raw/html/en/*.html`, `data/raw/rest/{pages,posts,categories}.en.json`, `pages-index.json`, `media-index.json`, `sitemaps/`, el análisis ES (`es.json`) y el catálogo `Torivac_2024_EN.pdf`. Cosecha del 27/10/2026. No se modificó la web original ni se hicieron peticiones de red.

Alcance: páginas y entradas cuya URL está en inglés (prefijo `/en/`) más la entrada que solo existe en inglés. Se excluyen las fichas de producto y los archivos de categoría y etiqueta de producto (157 de los 194 ficheros de `pages/en`), que se analizan aparte. Se inventarían, sin analizarlas a fondo, las piezas técnicas de WooCommerce y los archivos de categoría de entradas. La política de cookies, la de privacidad y la declaración de accesibilidad se analizan como páginas legales; el aviso legal no existe en inglés.

## 1. Resumen

| Concepto | Dato |
|---|---|
| Piezas inventariadas | 37 (9 páginas, 22 entradas, 6 piezas técnicas) |
| Texto | 3.772 palabras en páginas y 17.851 en entradas |
| Entradas por año | 7 de 2024 y 15 de 2025 (14 del 19 al 29/12/2025); 1 de ellas existe solo en inglés |
| Con original ES | 33 de las 37 piezas (sin original: la entrada EN-only y las páginas de carrito, tienda y mi cuenta); 30 se comparan línea a línea con ES |
| Páginas y entradas sin `<h1>` | 28 de 31 (solo tienen H1 la portada, Empresa y Proyectos) |
| Meta description | 12 sin resolver (valor literal `%`), 3 ausentes (Matelec y 2 categorías), 1 en español (entrada EN-only) |
| Imágenes de contenido | 77; 34 con alt vacío, 11 con nombre de archivo, 5 con alt en francés o español |
| Entradas que mencionan a China | 13 de 22 |
| Calidad de traducción (valoración editorial) | ok: 13; parcial: 7; automática sospechosa: 13; sin traducir: 1; n/a: 3 |
| Frente a ES (campo `modified`) | EN más antigua: 3 (portada, Proyectos, política de cookies); sincronizada (±2 días): 5; EN más reciente: 23; sin original ES: 4 |
| Hallazgos de calidad | 278 (alta 24, media 172, baja 82); 176 ya existen en ES y 99 son propios de EN; detalle en `quality_flags` de cada pieza |
| Lorem ipsum o texto de relleno clásico | Ninguno (búsqueda en texto visible, HTML y REST de las 37 piezas) |
| Decisión de migración | Propuesta en admin: 10; Copiar con correcciones: 9; Reescribir: 8; No migrar: 6; Regenerar desde datos: 3; Revisión legal antes de migrar: 1 |

Conclusiones:

1. **La versión EN es una traducción frase a frase de la ES, no contenido propio.** En las 30 piezas comparadas las líneas de texto, las frases y las cifras coinciden con las de ES (diferencias solo en el ruido de los formularios y en la lista de subcategorías de Productos). Por eso la decisión de migración de cada entrada es la de su original ES, y el valor de EN está en ser un buen punto de partida de traducción, no en aportar texto nuevo. La única pieza con contenido propio es la entrada técnica `/en/el-variador-de-tension-y-sus-funciones/`, que no tiene original ES, FR ni DE.
2. **La traducción es automática de buena calidad, con errores que cambian el sentido.** 13 de 37 piezas llevan al menos un falso amigo o término técnico equivocado: 'processors' por 'transformers' (2 entradas), 'millions of dollars' por 'pérdidas millonarias' (2), 'European Green Pact' por 'European Green Deal', 'Toroidal shocks' por chokes, 'load benches' por load banks, 'Single Phase Inverters' y 'variable speed drives' por variadores. El término más inestable es **'variador de tensión'**, que aparece como 'voltage variators', 'voltage regulators' y 'drives' según la pieza, aunque el catálogo EN oficial dice 'variator' y 'voltage variator' y nunca 'regulator'. Hace falta un glosario antes de reutilizar ningún texto.
3. **Hay texto en español dentro del inglés, sobre todo en la interfaz y los metadatos.** El banner de cookies está en español en las 194 páginas EN; el buscador dice 'Busar'; los formularios de portada y contacto tienen las etiquetas 'Correo' y 'Mensaje'; las tarjetas del blog dicen 'Leer más'; la meta description y el alt de la entrada EN-only están en español; el JSON-LD de la portada conserva el tagline en español con errata; el carrito de WooCommerce está en español; hay alts en francés y español. El cuerpo de las páginas y entradas sí está íntegro en inglés.
4. **Frescura frente a ES.** En las entradas la EN va por delante (re-guardada el 2026-03-23, 84-97 días después que la ES). Están desactualizadas la portada (215 días más antigua que la ES, que ya usa imágenes WebP optimizadas), Proyectos (35 días, con otras imágenes) y la política de cookies (2,2 años). El texto visible no difiere de ES, pero las imágenes y el pie sí.
5. **Datos de empresa iguales a ES, con dos diferencias.** Teléfono (+34 93 312 01 61), correo (info@torivac.com) y dirección coinciden; el pie EN traduce la dirección ('No. 2, 6th Floor') mientras Contacto y Privacidad la dejan en español ('Nº 2, Planta 6ª'). Y el pie de las 194 páginas EN **no incluye el aviso de ICEX-Next/FEDER** ni el logotipo nuevo que sí tienen 186 de las 208 páginas ES.
6. **Problemas de SEO que no existen en ES:** la home EN declara como canonical la home alemana, Contacto la de contacto alemana, la política de cookies la española y la entrada EN-only una URL sin `/en/` que no existe. Los formularios de las 22 entradas no tienen etiquetas `<label>` y los de portada y contacto piden aceptar el 'Legal Notice', que no existe en inglés.
7. **Los textos legales EN son los de ES traducidos con sus mismos defectos.** El titular está en blanco en la política de privacidad, falta la variable `correodelcliente`, la declaración de accesibilidad se contradice y la política de cookies no inventaría las cookies reales. No existe aviso legal en inglés (`HALLAZGOS.md` #10 cita una URL `/en/aviso-legal-2/` que no consta en ninguna fuente).

## 2. Inventario

`Qué dice` resume la finalidad de la pieza. `Calidad del texto` es una valoración editorial (no es una puntuación automática). `Trad.` es la valoración de la traducción (ok | parcial | automática sospechosa | sin traducir | n/a; ver criterios en la sección 11). Las fechas son de publicación y última modificación según la API REST de WordPress. `ES` es la URL del original.

### 2.1 Páginas (9)

| URL | ID | Título WP | H1 o encabezado visible | Publ. / modif. | Pal. | ES | Qué dice | Calidad del texto | Trad. | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|
| `/en/` | 15755 | Torivac Home | Specialists in voltage control and regulation | 2025-10-30 / 2026-03-13 | 468 | `/` | Portada EN: presenta a Torivac como especialista en regulación de tensión, enlaza a empresa, proyectos, familias de producto y catálogo PDF, y ofrece formulario de contacto. | Aceptable. Texto comercial propio, traducido fiel a ES línea por línea. Falsos amigos ('Toroidal shocks', 'load benches', 'drives'), etiquetas del formulario en español, alts en francés y español, CTA a páginas en español y canonical a la home alemana. | parcial | Copiar con correcciones |
| `/en/torivac-company/` | 15713 | Torivac_Torivac Company | Our company | 2025-11-03 / 2026-03-09 | 350 | `/torivac-empresa/` | Presenta la empresa: trayectoria desde 1964, presencia internacional, misión, visión, valores y liderazgo de Mr. Ramón Zamora. | Buena. Traducción fluida; única página con trayectoria (1964), misión, visión y valores. Heredados: 'Grupor' en el título SEO, meta description '%' y CTA a /contacto/ en español. | ok | Copiar con correcciones |
| `/en/torivac-products/` | 15728 | Torivac Products | (sin H1) Products | 2025-11-02 / 2026-03-10 | 401 | `/productos/` | Índice de productos EN: árbol de categorías (modal) y tarjetas de las 11 familias con recuento de productos y extracto. | Pobre como texto. Árbol de menú más extractos cortados con '…', restos de interfaz ('Torivac-Products', '×') y falsos amigos ('Single Phase Inverters', 'Nuclei', 'variable speed drives'). Sin tarjeta de Electronic equipment. | automática sospechosa | Regenerar desde datos |
| `/en/entrepreneurial-projects/` | 15749 | Torivac_Entrepreneurial Projects | Turnkey projects | 2025-11-03 / 2026-03-09 | 201 | `/proyectos-empresariales/` | Describe la oferta de proyectos llave en mano y a medida (diseño, fabricación y puesta en marcha) y la colaboración con clientes y aliados. | Buena. Texto propio correcto, pero 'Entrepreneurial' traduce mal 'Empresariales', el CTA se queda en 'Contact us at' y las imágenes son anteriores a la actualización de ES. | ok | Copiar con correcciones |
| `/en/blog/` | 15828 | Torivac_Blog | (sin H1) sin encabezado propio | 2024-06-25 / 2026-03-10 | 133 | `/blog/` | Índice del blog EN: rejilla de entradas (3 páginas, 10 visibles en la captura) con imagen, fecha, título, extracto y botón 'Leer más'. | Sin texto propio: rejilla automática con 'Leer más' en español, fechas en inglés y extractos sin puntuación. | parcial | Regenerar desde datos |
| `/en/contact/` | 15736 | Torivac_Contact | (sin H1) CONTACT US | 2025-11-03 / 2026-03-13 | 154 | `/contacto/` | Página de contacto EN: formulario, texto de acompañamiento, dirección, teléfono, correo y mapa de Google embebido. | Correcta y completa. Etiquetas 'Correo'/'Mensaje' en español, dirección sin traducir, consentimiento sin enlace y canonical a la página de contacto alemana. | parcial | Copiar con correcciones |
| `/en/privacy-policy/` | 15707 | Privacy Policy | (sin H1) Privacy Policy | 2025-12-10 / 2026-03-09 | 842 | `/politica-de-privacidad/` | Política de privacidad EN (RGPD): responsable, principios, datos recogidos, legitimación, derechos y fecha de actualización (December 2025). | Plantilla incompleta con traducción fiel: titular en blanco, 'correodelcliente' sin resolver y terminología de derechos no alineada con el RGPD en inglés. | ok | Revisión legal antes de migrar |
| `/en/politica-de-cookies/` | 15830 | Cookie Policy | (sin H1) sin encabezado propio | 2022-12-16 / 2022-12-16 | 594 | `/politica-de-cookies/` | Política de cookies EN genérica: qué son las cookies, propias, de redes sociales (con enlaces a sus políticas) y cómo deshabilitarlas. | Plantilla de generador gratuito sin inventario de cookies; traducción fiel con una frase ininteligible, enlaces a políticas en español/México y página sin re-guardar desde 2022. | parcial | Reescribir |
| `/en/declaracion-de-accesibilidad/` | 15699 | Accessibility statement | (sin H1) Accessibility statement | 2025-12-10 / 2026-03-09 | 629 | `/declaracion-de-accesibilidad/` | Declaración de accesibilidad EN conforme al RD 1112/2018: situación de cumplimiento, contenido no accesible, método de evaluación y vías de contacto. | Contradictoria ('partially compliant' y 'Meets 100%') y copiada de una plantilla del sector público; traducción fiel, con la fecha en formato mes/día. | ok | Reescribir |

### 2.2 Entradas del blog (22)

| URL | ID | Título (H2) | Publ. / modif. | Pal. | ES | Qué dice | Calidad del texto | Trad. | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| `/en/normativas-sobre-transformadores-electricos-en-europa/` | 15970 | Electrical transformer regulations in Europe | 2025-12-29 / 2026-03-23 | 895 | `/normativas-sobre-transformadores-electricos-en-europa/` | Artículo SEO sobre la normativa europea de transformadores eléctricos (EN 50588-1, Reglamento UE 2019/1783) con Torivac como aliado de cumplimiento; compara con importaciones asiáticas. | Pobre. Plantilla SEO que afirma documentación reconocida por organismos europeos y cumplimiento de EN 50588-1 sin respaldo; 'drives' por 'variadores'. | automática sospechosa | Reescribir |
| `/en/mantenimiento-de-transformadores-electricos/` | 15958 | Maintenance of electrical transformers | 2025-12-29 / 2026-03-23 | 968 | `/mantenimiento-de-transformadores-electricos/` | Artículo SEO sobre el mantenimiento de transformadores eléctricos que presenta a Torivac como especialista en mantenimiento preventivo y correctivo; compara con fabricantes asiáticos. | Pobre. Plantilla SEO que presenta a Torivac como especialista en mantenimiento, con servicios concretos (termografía, aceite dieléctrico) que ninguna otra página respalda. | ok | Propuesta en admin (no publicar sin validar) |
| `/en/como-extender-la-vida-util-de-un-transformador/` | 15963 | How to extend the life of a transformer | 2025-12-29 / 2026-03-23 | 847 | `/como-extender-la-vida-util-de-un-transformador/` | Artículo SEO sobre cómo prolongar la vida útil de un transformador; promociona transformadores 'de larga duración' de Torivac con 'extended warranty' y compara con importaciones chinas. | Pobre. Plantilla SEO; 'extended warranty' y procesos 'certificados' sin respaldo y comparación con transformadores producidos en China. | ok | Propuesta en admin (no publicar sin validar) |
| `/en/impacto-medioambiental-de-los-transformadores-hoy/` | 15953 | Environmental impact of transformers today | 2025-12-29 / 2026-03-23 | 963 | `/impacto-medioambiental-de-los-transformadores-hoy/` | Artículo SEO sobre el impacto ambiental de los transformadores; presenta a Torivac como socio de la 'transformación eléctrica verde' con materiales reciclables, trazabilidad y alineación con el ODS 7. | Pobre. Plantilla SEO con afirmaciones ecológicas y de trazabilidad sin certificado; 'European Green Pact' en lugar de 'European Green Deal'. | automática sospechosa | Propuesta en admin (no publicar sin validar) |
| `/en/funcionamiento-de-un-transformador-en-la-industria/` | 15962 | How a transformer works: keys to your project | 2025-12-29 / 2026-03-23 | 1243 | `/funcionamiento-de-un-transformador-en-la-industria/` | Artículo SEO titulado como explicación del funcionamiento de un transformador pero de contenido comercial: asesoría técnica y proyectos industriales con Torivac. | Pobre. Titulada como explicación técnica pero es texto comercial; afirma que el soporte de proveedores asiáticos son 'manuales mal traducidos'; 'drives' por 'variadores'. | automática sospechosa | Reescribir |
| `/en/seguridad-en-el-uso-de-transformadores/` | 16044 | Safety in the use of transformers | 2025-12-20 / 2026-03-23 | 982 | `/seguridad-en-el-uso-de-transformadores/` | Artículo SEO sobre la seguridad en el uso de transformadores; atribuye a los transformadores Torivac protecciones avanzadas y 'garantía europea'. | Pobre. Protecciones y 'garantía europea' sin ficha técnica; presenta IEC y EN como 'directivas europeas'. | ok | Propuesta en admin (no publicar sin validar) |
| `/en/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 16018 | Limits of a transformer and how they affect its performance | 2025-12-20 / 2026-03-23 | 750 | `/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | Artículo SEO sobre los límites de un transformador (térmicos, dieléctricos) en proyectos de energía renovable; Torivac diseña 'según los límites' de cada proyecto. | Pobre. Plantilla SEO con 'processors' por 'transformers' y cumplimiento CE afirmado en general. | automática sospechosa | Reescribir |
| `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 16039 | Common transformer failures and their effective solutions | 2025-12-20 / 2026-03-23 | 920 | `/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | Artículo SEO sobre fallos comunes de los transformadores y sus soluciones, orientado a universidades y centros de investigación; atribuye a Torivac un servicio de diagnóstico y reparación. | Pobre. Servicio de diagnóstico y reparación sin respaldo, dirigido a universidades, con la palabra clave repetida de forma mecánica. | ok | Propuesta en admin (no publicar sin validar) |
| `/en/eficiencia-de-los-transformadores-clave-en-europa/` | 16120 | Transformer efficiency: key in Europe | 2025-12-20 / 2026-03-23 | 873 | `/eficiencia-de-los-transformadores-clave-en-europa/` | Artículo SEO sobre la eficiencia de los transformadores dirigido a distribuidores de material eléctrico; presenta a Torivac como líder europeo en transformadores de alta eficiencia con cumplimiento 'Ecodesign'. | Pobre. 'Ecodesign' y 'líder europeo' sin dato; 'processors' por 'transformers'. | automática sospechosa | Propuesta en admin (no publicar sin validar) |
| `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 16015 | How to upgrade a transformer with expert techniques | 2025-12-20 / 2026-03-23 | 979 | `/como-se-mejora-un-transformador-con-tecnicas-expertas/` | Artículo SEO sobre cómo mejorar un transformador existente (reimpregnación, refrigeración, aislamiento); atribuye a Torivac servicios de optimización y reparación. | Pobre. Servicios de optimización y reparación (reimpregnación al vacío) sin respaldo y resultados de clientes sin cifras. | ok | Propuesta en admin (no publicar sin validar) |
| `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | 16092 | How a transformer is manufactured: European quality and process | 2025-12-20 / 2026-03-23 | 840 | `/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | Artículo SEO sobre cómo se fabrica un transformador con calidad europea (diseño, núcleos, devanados, aislamiento, ensayos) que afirma certificaciones de calidad de Torivac. | Mixta. Describe un proceso de fabricación genérico razonable, pero afirma certificaciones sin nombrarlas. | ok | Propuesta en admin (no publicar sin validar) |
| `/en/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 16010 | Transformer applications in today’s industry | 2025-12-19 / 2026-03-23 | 834 | `/aplicaciones-de-los-transformadores-en-la-industria-actual/` | Artículo SEO sobre las aplicaciones de los transformadores en la industria actual y el coste oculto de los de baja calidad; Torivac como referencia para aplicaciones exigentes. | Mixta. La más cercana a un texto informativo, con comparación sin fuente con productos chinos; 'Asian drives'. | automática sospechosa | Reescribir |
| `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | 16100 | Transformer materials: key to transformer performance | 2025-12-19 / 2026-03-23 | 1161 | `/materiales-de-un-transformador-clave-en-su-rendimiento/` | Artículo SEO sobre la influencia de los materiales de un transformador (acero al silicio, cobre esmaltado, aislamientos) en eficiencia y durabilidad, con los riesgos de la baja calidad y la selección de materiales de Torivac. | Pobre. Dos plantillas acopladas; generaliza sobre fábricas chinas y habla de 'millions of dollars'. | automática sospechosa | Propuesta en admin (no publicar sin validar) |
| `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 16038 | What is a transformer for? Discover its key function | 2025-12-19 / 2026-03-23 | 890 | `/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | Artículo SEO que explica para qué sirve un transformador y argumenta por qué Torivac es la elección inteligente (centros de datos, líneas de producción). | Pobre. Hipérbole comercial, 'alarming lack' de fabricantes europeos y 'millions of dollars'. | automática sospechosa | Reescribir |
| `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | 16079 | Torivac consolidates its leadership in the electricity sector followi… | 2025-06-03 / 2026-03-23 | 551 | `/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | Noticia: participación de Torivac en Coiltech Deutschland (marzo de 2025, Messe Augsburg): networking, World Magnetic Conference y exploración de Alemania, Italia y Francia. | Buena. Noticia con hechos verificables (feria, fecha, lugar); mayúsculas y título SEO por corregir. | ok | Copiar con correcciones |
| `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 15961 | Torivac at Matelec 2024 – Exploring the market and strengthening conn… | 2024-11-22 / 2026-03-23 | 444 | `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Crónica de la visita de Torivac a Matelec 2024 (Madrid) con críticas explícitas a la organización de la feria. | Dudosa. Crónica con críticas públicas a la organización de la feria; sin meta description. | ok | No migrar |
| `/en/torivac-en-beyond-catalonia/` | 16074 | Torivac in Beyond Catalonia | 2024-11-18 / 2026-03-23 | 872 | `/torivac-en-beyond-catalonia/` | Crónica de la participación de Torivac en Beyond Catalonia (ACCIÓ, World Trade Center Barcelona): internacionalización, IA en comercio B2B, financiación a exportadores y expansión hacia América. | Buena. Hechos verificables; errata 'Catalona', futuro en una crónica ya celebrada y bloque corporativo duplicado. | automática sospechosa | Copiar con correcciones |
| `/en/estabilizadores-de-tension-con-cobre/` | 16000 | Copper voltage stabilizers | 2024-11-12 / 2026-03-23 | 563 | `/estabilizadores-de-tension-con-cobre/` | Artículo SEO sobre estabilizadores de tensión 'con cobre': qué son y qué los hace especiales (estabilidad, ahorro de mantenimiento, eficiencia). | Aceptable. Afirmación técnica imprecisa (el cobre como método de regulación) y título SEO con 'Torivac Torivac.'. | automática sospechosa | Copiar con correcciones |
| `/en/estabilizadores-de-tension/` | 16056 | Voltage stabilizers ensure stable supply and cost reduction | 2024-11-05 / 2026-03-23 | 683 | `/estabilizadores-de-tension/` | Artículo SEO sobre estabilizadores de tensión: definición, diferencia con el protector de tensión, ventajas y beneficio para grandes infraestructuras. | Aceptable. Define estabilizador y protector, pero describe uno de tomas que no es el de las series AVS/BAVS. | automática sospechosa | Reescribir |
| `/en/descargadores-de-bateria/` | 8201 | Torivac battery dischargers | 2024-10-10 / 2026-03-13 | 835 | `/descargadores-de-bateria/` | Artículo SEO sobre descargadores de batería (simulación de carga y pruebas de baterías) presentados como producto de Torivac. | Dudosa. Presenta como producto de Torivac unos descargadores de batería que no constan en el catálogo. | automática sospechosa | Propuesta en admin (no publicar sin validar) |
| `/en/el-variador-de-tension-y-sus-funciones/` | 8196 | What is a Voltage Variator? | 2024-09-19 / 2025-12-19 | 353 | solo EN | Artículo técnico (solo en inglés) que explica qué es un variador de tensión (autotransformador variable), sus tipos (IP00, cerrados, llave en mano) y cómo calcular la potencia necesaria. | Buena. El texto técnico más útil del blog (tipos y cálculo de potencia); meta description y alt en español, CTA roto y sin versión ES/FR/DE. | parcial | Copiar con correcciones |
| `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | 8191 | The importance of the toroidal transformer in industry | 2024-06-25 / 2026-03-13 | 405 | `/la-importancia-del-transformador-toroidal-en-la-industria/` | Artículo SEO breve que compara transformadores toroidales y convencionales (núcleo circular frente a cuadrado, eficiencia, coste) y orienta la elección para una empresa. | Buena. La más cercana al producto real (toroidal frente a convencional); sintaxis rota heredada y 'click here' sin enlace. | ok | Copiar con correcciones |

### 2.3 Piezas técnicas (6)

Se inventarían sin analizar a fondo: son plantillas de WooCommerce o archivos de taxonomía.

| URL | ID | Tipo | Título del navegador | Robots | En sitemap | Qué es | Notas |
|---|---|---|---|---|---|---|---|
| `/en/carrito/` | 11513 | WooCommerce | Carrito - Torivac | noindex | sí | Carrito de WooCommerce (id 11513, publicado 2025-06-11): páginas de plantilla de la tienda del sitio original; solo se inventaría. | Sin contenido propio: plantilla de WooCommerce con los títulos en español. Título del navegador 'Carrito - Torivac' y slug /en/carrito/ en español. Robots: noindex, follow. El texto del analizador (408 caracteres) es solo el pie; el cuerpo se tomó del HTML. |
| `/en/finalizar-compra/` | 11514 | WooCommerce | Finalizar compra - Torivac | noindex | no | Página de finalizar compra (checkout) de WooCommerce (id 11514, publicada 2025-06-11); solo se inventaría. | Sin contenido propio: bloques de checkout de WooCommerce. REST content.rendered: 3.250 caracteres de marcado de bloques WooCommerce Checkout (contacto, envío, facturación, pago, resumen del pedido) y 0 caracteres de texto visible. El HTML cosechado para /en/finalizar-compra/ devuelve la plantilla del carrito (canonica… |
| `/en/mi-cuenta/` | 11515 | WooCommerce | Mi cuenta - Torivac | noindex | sí | Página 'Mi cuenta' de WooCommerce (id 11515, publicada 2025-06-11): formulario de acceso; solo se inventaría. | Sin contenido propio: formulario de acceso de WooCommerce. Título 'Mi cuenta - Torivac', slug /en/mi-cuenta/ en español. Robots: noindex, follow. REST content.rendered: '<div class="woocommerce"></div>' (el formulario lo genera WooCommerce). |
| `/en/tienda/` | 11512 | WooCommerce | Tienda - Torivac | index | sí | Página 'Tienda' de WooCommerce (id 11512, publicada 2025-06-11); vacía en el HTML cosechado. | Vacía. Título 'Tienda - Torivac', slug /en/tienda/ en español. Según el HTML servido es la única de las cuatro páginas de WooCommerce indexable (robots 'index, follow'; carrito y mi-cuenta salen noindex y la de finalizar-compra devolvió la plantilla del carrito) y no tiene contenido. Yoast (REST) declara 'index, follo… |
| `/en/category/blog/` | 606 | Categoría de entradas | blog - Torivac | index | no | Archivo de la categoría 'blog' (id 606): lista las entradas con la misma plantilla de tarjetas que el índice del blog. | Archivo automático de entradas con 'Leer más' en español. Título del navegador 'blog - Torivac' (nombre de categoría en minúscula). El cuerpo es una rejilla automática de tarjetas idéntica a /en/blog/; no se transcribe en full_text. El contador de la categoría EN es 21 (no incluye la entrada EN-only id 8196, asignada… |
| `/en/category/uncategorized/` | 132 | Categoría de entradas | Uncategorized - Torivac | index | no | Archivo de la categoría 'Uncategorized' (id 132): categoría por defecto de WordPress, sin entradas. | Archivo vacío (0 entradas). Categoría con 0 entradas e indexable ('index, follow'). Equivalentes: ES 'sin-categorizar' (id 1), FR 'non-classifiee', DE 'unkategorisiert'. |

## 3. Qué copiar y qué reescribir

Ninguna pieza se puede copiar literalmente: hasta las mejores tienen alguna errata heredada o un falso amigo. Las decisiones repiten las del original ES para que la web multilingüe sea coherente; en `migration.notes` de cada pieza hay las correcciones propias de EN.

**Copiar con correcciones (9)**. El texto es útil y verificable. Se migra el `full_text` corrigiendo lo que listan los hallazgos de la sección 8.

- `/en/`: Copiar el texto y la estructura. Corregir 'load benches' (load banks), 'Toroidal shocks' (chokes), 'Cores toroidal' (toroidal cores), unificar 'drives'/'variators', apuntar los CTA y las tarjetas a las URL EN y al catálogo EN, y rehacer la rejilla de familias desde los datos de catálogo. Usar las imágenes WebP optimizadas de ES.
- `/en/torivac-company/`: Es la única página con trayectoria y valores: copiar tal cual corrigiendo 'Grupor' en el título SEO, unificando 'voltage variators'/'voltage regulators', completando la meta description y apuntando el CTA a /en/contact/.
- `/en/entrepreneurial-projects/`: Copiar y unificar el nombre de la sección ('Entrepreneurial Projects', 'Turnkey projects', 'Business Projects'); completar el CTA ('Contact us'); validar con el cliente la 'puesta en marcha en instalaciones'; usar las imágenes de la versión ES.
- `/en/contact/`: Mantener datos de contacto y mapa; traducir la dirección ('No. 2, 6th Floor'), hacer clicables teléfono y correo, enlazar el consentimiento a la política de privacidad EN, traducir las etiquetas 'Correo'/'Mensaje' y corregir 'Potosi'.
- `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/`: Noticia con hechos verificables (feria, fecha, lugar). Corregir mayúsculas de nombres propios, alinear título SEO y H2, añadir fecha visible y fotos con alt; verificar los datos del evento en la fuente.
- `/en/torivac-en-beyond-catalonia/`: Hechos verificables (evento, organizador, lugar). Corregir erratas y tiempo verbal y eliminar el bloque corporativo duplicado; verificar los datos del evento en la fuente.
- `/en/estabilizadores-de-tension-con-cobre/`: Corregir erratas y revisar con ingeniería la afirmación sobre 'regulación de tensión mediante el cobre' (el cobre es el conductor del bobinado, no un método de regulación).
- `/en/el-variador-de-tension-y-sus-funciones/`: Es el artículo más técnico y útil del blog. Copiar con correcciones (idioma de meta y alt, URL del CTA, 'wiper') y crear las versiones ES/FR/DE; confirmar con el cliente la autoría y si hay original en español despublicado.
- `/en/la-importancia-del-transformador-toroidal-en-la-industria/`: Es el artículo más cercano al producto real (toroidal frente a convencional). Corregir sintaxis rota, 'click here' sin enlace; enlazar de verdad a las categorías de transformadores y a contacto.

**Regenerar desde datos (3)**. No se copia: la web nueva lo genera desde los datos (catálogo, entradas, menú, selector de idioma).

- `/en/torivac-products/`: No se copia: la web nueva debe generar el índice desde los datos de catálogo (S2). Reutilizar solo los nombres de familia, tras corregir 'Single Phase Inverters', 'Nuclei', 'Estators', 'Casing covers' y 'variable speed drives'.
- `/en/blog/`: Generar el índice desde las entradas migradas; no copiar tal cual (contiene interfaz en español 'Leer más', 'Do you like it?' en inglés dentro de ES/FR/DE y fechas en formato anglosajón).
- `/en/category/blog/`: Archivo de taxonomía; la web nueva generará su propio listado.

**Reescribir (8)**. Hay una base temática aprovechable, pero el texto actual no se puede publicar: afirmaciones sin respaldo, comparaciones por países o texto de plantilla.

- `/en/politica-de-cookies/`: Plantilla genérica de un generador gratuito, sin inventario de cookies real (GA4, GTM, reCAPTCHA, Complianz). Rehacer con el banner de consentimiento de la web nueva y enlazarla desde el pie.
- `/en/declaracion-de-accesibilidad/`: Plantilla del sector público con afirmaciones contradictorias, fechada en 2024. Rehacerla tras auditar la web nueva (WCAG 2.1 AA) y adaptarla a una empresa privada; si se conserva, unificar el formato de fecha (ISO) en todos los idiomas.
- `/en/normativas-sobre-transformadores-electricos-en-europa/`: No migrar como afirmación de cumplimiento. Reescribir sin comparar países y citando solo normas y reglamentos que se puedan acreditar con los productos concretos.
- `/en/funcionamiento-de-un-transformador-en-la-industria/`: Reescribir con una explicación técnica real del funcionamiento y sin descalificar a proveedores asiáticos.
- `/en/limites-de-un-transformador-y-como-afectan-su-rendimiento/`: Reescribir con límites reales de los productos (potencia, temperatura, aislamiento) tomados de las fichas técnicas.
- `/en/aplicaciones-de-los-transformadores-en-la-industria-actual/`: Reescribir con aplicaciones reales de los productos de Torivac y sin comparaciones por países.
- `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/`: Reescribir como explicación del transformador y quitar la comparación con importaciones.
- `/en/estabilizadores-de-tension/`: Reescribir con las series reales (AVS, BAVS) y sin el bloque corporativo duplicado.

**Propuesta en admin (no publicar sin validar) (10)**. Contenido dudoso: se muestra como propuesta en el panel de admin y no se publica hasta que el cliente lo valide.

- `/en/mantenimiento-de-transformadores-electricos/`: Mostrar como propuesta en el panel de admin y no publicar hasta que el cliente confirme que ofrece servicios de mantenimiento.
- `/en/como-extender-la-vida-util-de-un-transformador/`: Proponer en admin; no publicar la 'garantía extendida' ni la comparación con importaciones chinas sin respaldo.
- `/en/impacto-medioambiental-de-los-transformadores-hoy/`: Proponer en admin; sin certificado ambiental ni dato de trazabilidad no se pueden publicar las afirmaciones ecológicas.
- `/en/seguridad-en-el-uso-de-transformadores/`: Proponer en admin; las protecciones y la garantía europea deben salir de fichas técnicas reales.
- `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/`: Proponer en admin; no publicar el servicio de diagnóstico y reparación sin confirmación del cliente.
- `/en/eficiencia-de-los-transformadores-clave-en-europa/`: Proponer en admin; sin dato medible de eficiencia ni referencia al reglamento aplicable no se publica.
- `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/`: Proponer en admin; los servicios de reparación y modernización deben confirmarse con el cliente.
- `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/`: Proponer en admin; el proceso real y las certificaciones deben aportarse por el cliente.
- `/en/materiales-de-un-transformador-clave-en-su-rendimiento/`: Proponer en admin; las afirmaciones sobre ensayos, ISO y fábricas chinas no se pueden publicar sin respaldo.
- `/en/descargadores-de-bateria/`: Proponer en admin; no publicar hasta que el cliente confirme que fabrica descargadores de batería.

**Revisión legal antes de migrar (1)**. Texto legal: revisión de asesoría jurídica antes de migrar.

- `/en/privacy-policy/`: Plantilla con el titular en blanco y una variable sin resolver ('correodelcliente'); falta una sección 'Use of Cookies' que el texto cita. Revisión legal obligatoria antes de publicar en cualquier idioma; traducir con la terminología oficial del RGPD en inglés.

**No migrar (6)**. Sin valor para la web nueva.

- `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/`: No migrar: crítica pública a la organización de una feria. Si el cliente quiere conservar la visita, reescribir como crónica neutral.
- `/en/carrito/`: Página de carrito de WooCommerce sin contenido propio; no migrar. La web nueva tendrá su propio flujo de presupuesto.
- `/en/finalizar-compra/`: Página de checkout de WooCommerce sin contenido propio (solo marcado de bloques, 0 caracteres de texto visible); no migrar.
- `/en/mi-cuenta/`: Página de cuenta de WooCommerce sin contenido propio; no migrar.
- `/en/tienda/`: Página de tienda de WooCommerce sin contenido; no migrar. El catálogo se genera desde los datos de producto.
- `/en/category/uncategorized/`: Categoría por defecto de WordPress sin entradas (count 0); no migrar ni indexar.

## 4. Comparación con la versión ES

### 4.1 Fechas de modificación

`Δ días` = fecha EN menos fecha ES (negativo: la EN es más antigua). Se considera sincronizada una diferencia de hasta 2 días.

| Pieza EN | ES | Modificada EN | Modificada ES | Δ días | Estado |
|---|---|---|---|---|---|
| `/en/` | `/` | 2026-03-13 | 2026-10-14 | -215 | **EN más antigua** |
| `/en/torivac-company/` | `/torivac-empresa/` | 2026-03-09 | 2026-03-08 | +2 | sincronizada |
| `/en/torivac-products/` | `/productos/` | 2026-03-10 | 2026-02-25 | +13 | EN más reciente |
| `/en/entrepreneurial-projects/` | `/proyectos-empresariales/` | 2026-03-09 | 2026-04-14 | -35 | **EN más antigua** |
| `/en/blog/` | `/blog/` | 2026-03-10 | 2026-03-10 | +0 | sincronizada |
| `/en/contact/` | `/contacto/` | 2026-03-13 | 2026-03-13 | +0 | sincronizada |
| `/en/privacy-policy/` | `/politica-de-privacidad/` | 2026-03-09 | 2025-12-10 | +89 | EN más reciente |
| `/en/politica-de-cookies/` | `/politica-de-cookies/` | 2022-12-16 | 2025-02-11 | -788 | **EN más antigua** |
| `/en/declaracion-de-accesibilidad/` | `/declaracion-de-accesibilidad/` | 2026-03-09 | 2025-12-10 | +89 | EN más reciente |
| `/en/normativas-sobre-transformadores-electricos-en-europa/` | `/normativas-sobre-transformadores-electricos-en-europa/` | 2026-03-23 | 2026-03-23 | +0 | sincronizada |
| `/en/mantenimiento-de-transformadores-electricos/` | `/mantenimiento-de-transformadores-electricos/` | 2026-03-23 | 2025-12-29 | +84 | EN más reciente |
| `/en/como-extender-la-vida-util-de-un-transformador/` | `/como-extender-la-vida-util-de-un-transformador/` | 2026-03-23 | 2025-12-29 | +84 | EN más reciente |
| `/en/impacto-medioambiental-de-los-transformadores-hoy/` | `/impacto-medioambiental-de-los-transformadores-hoy/` | 2026-03-23 | 2025-12-29 | +84 | EN más reciente |
| `/en/funcionamiento-de-un-transformador-en-la-industria/` | `/funcionamiento-de-un-transformador-en-la-industria/` | 2026-03-23 | 2025-12-29 | +84 | EN más reciente |
| `/en/seguridad-en-el-uso-de-transformadores/` | `/seguridad-en-el-uso-de-transformadores/` | 2026-03-23 | 2025-12-20 | +93 | EN más reciente |
| `/en/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | `/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 2026-03-23 | 2025-12-20 | +93 | EN más reciente |
| `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | `/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 2026-03-23 | 2025-12-20 | +93 | EN más reciente |
| `/en/eficiencia-de-los-transformadores-clave-en-europa/` | `/eficiencia-de-los-transformadores-clave-en-europa/` | 2026-03-23 | 2025-12-20 | +93 | EN más reciente |
| `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | `/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 2026-03-23 | 2025-12-20 | +93 | EN más reciente |
| `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | `/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | 2026-03-23 | 2025-12-20 | +93 | EN más reciente |
| `/en/aplicaciones-de-los-transformadores-en-la-industria-actual/` | `/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | `/materiales-de-un-transformador-clave-en-su-rendimiento/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | `/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | `/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | 2026-03-23 | 2025-12-16 | +97 | EN más reciente |
| `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | `/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/torivac-en-beyond-catalonia/` | `/torivac-en-beyond-catalonia/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/estabilizadores-de-tension-con-cobre/` | `/estabilizadores-de-tension-con-cobre/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/estabilizadores-de-tension/` | `/estabilizadores-de-tension/` | 2026-03-23 | 2025-12-19 | +94 | EN más reciente |
| `/en/descargadores-de-bateria/` | `/descargadores-de-bateria/` | 2026-03-13 | 2025-12-19 | +84 | EN más reciente |
| `/en/el-variador-de-tension-y-sus-funciones/` | `-` | 2025-12-19 | - | - | sin original ES |
| `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | `/la-importancia-del-transformador-toroidal-en-la-industria/` | 2026-03-13 | 2025-12-19 | +84 | EN más reciente |
| `/en/finalizar-compra/` | `/confirmar/` | 2025-06-11 | 2025-06-11 | -0 | sincronizada |
| `/en/category/blog/` | `/category/blog/` | - | - | - | - |
| `/en/category/uncategorized/` | `/category/sin-categorizar/` | - | - | - | - |

Lectura: las 21 entradas con original ES se re-guardaron en EN entre el 2026-03-13 y el 2026-03-23, entre 84 y 97 días después de la última edición de ES (dic. 2025, salvo Normativas, sincronizada): no hay evidencia de texto EN anterior al ES. Las excepciones son:

- **Portada** (EN 2026-03-13, ES 2026-10-14): el texto visible coincide bloque a bloque, pero la EN conserva JPG/PNG originales (2026/02) mientras la ES los sustituyó por WebP optimizados (2026/04). No se puede saber qué cambió el 2026-10-14.
- **Proyectos** (EN 2026-03-09, ES 2026-04-14): la galería EN tiene 6 imágenes anteriores a la actualización; la ES usa 4 distintas (`trafo torivac`, `4Z0A6518`, convertidor y Adobe-Express-file).
- **Política de cookies** (EN 2022-12-16, ES 2025-02-11): el contenido coincide con el ES; es una falta de re-guardado, no de texto.

### 4.2 Secciones ausentes o desactualizadas en EN

| Pieza | Ausente / desactualizado |
|---|---|
| `/en/` | Desactualizado: Imágenes del hero y de los dos carruseles: EN usa JPG/PNG originales (2026/02 y 2025/01-11); ES las sustituyó por WebP optimizados (2026/04, 'torivac-optimized.webp', '*-optimized.webp'). |
| `/en/torivac-products/` | Ausente: Subcategoría 'Fuente de alimentación CA' (AC power supplies) de Equipos electrónicos: aparece en el árbol ES y no en el EN. Desactualizado: Recuento de la familia Voltage variators: 12 en EN frente a 15 en ES (3 fichas sin traducción al inglés). |
| `/en/entrepreneurial-projects/` | Desactualizado: Galería de imágenes: EN conserva 6 imágenes anteriores a la actualización del 2026-04-14 de la versión ES (que usa 4). |
| `/en/blog/` | Ausente: La entrada EN-only 'What is a Voltage Variator?' (2024-09-19) no aparece en este listado (está asignada a la categoría ES 'blog', id 443) y por eso la categoría EN 'blog' cuenta 21 entradas, no 22. |
| `/en/politica-de-cookies/` | Desactualizado: La fecha de modificación de la EN (2022-12-16) es anterior en 2,2 años a la de ES (2025-02-11); el contenido coincide con el de ES, así que parece una falta de re-guardado y no de contenido. |
| `/en/category/blog/` | Ausente: La entrada EN-only 'What is a Voltage Variator?' no aparece (categoría ES 443). |

Para las demás piezas con original ES no falta ninguna sección: el número de líneas de texto y de frases coincide (30 piezas comparadas). Las diferencias de líneas en portada (52 EN frente a 56 ES) y contacto (21 frente a 15) vienen del ruido del formulario, no del contenido. El blog EN lista 10 de 22 entradas en su primera página, igual que ES (10 de 21).

### 4.3 Texto en español (u otro idioma) dentro del inglés

| Pieza | Dónde | Cadena | Nota |
|---|---|---|---|
| `/en/` | form | Correo | Etiqueta del campo E-mail (visible para lectores de pantalla; el placeholder sí dice 'E-mail') |
| `/en/` | form | Mensaje | Etiqueta del campo de mensaje |
| `/en/` | form | Name Mensaje Correo | Etiqueta del campo honeypot |
| `/en/` | img_alt | resistencia | alt en español |
| `/en/` | img_alt | sobremesa03 | alt con nombre de archivo en español ('sobremesa') |
| `/en/` | img_alt | triphasé servomoteur | alt en francés |
| `/en/` | html | Carrusel de imágenes | aria-label de los dos carruseles |
| `/en/` | html | Especializados en diseño y fabricación de variados de tensión | WebSite.description del JSON-LD (con la errata 'variados') |
| `/en/` | link | https://grupotorivac.com/torivac-empresa/ | Destino en español del primer CTA |
| `/en/` | link | https://grupotorivac.com/proyectos-empresariales/ | Destino en español de los otros dos CTA |
| `/en/` | link | https://grupotorivac.com/categoria-producto/choques/ | Cuatro tarjetas de familia (choques, botones-de-mando, portaled, nucleos) enlazan a URLs de categoría en español, fuera de /en/ |
| `/en/` | link | https://grupotorivac.com/wp-content/uploads/2024/10/Torivac_2024.pdf | 'Download Catalog' lleva al catálogo ES; el menú EN usa Torivac_2024_EN.pdf |
| `/en/torivac-company/` | link | https://grupotorivac.com/contacto/ | El CTA 'More Information' lleva a la página de contacto en español; existe /en/contact/ |
| `/en/entrepreneurial-projects/` | link | https://grupotorivac.com/contacto/ | CTA a la página de contacto en español |
| `/en/entrepreneurial-projects/` | img_alt | transformador-serie-tci.png | alt con nombre de archivo en español |
| `/en/entrepreneurial-projects/` | img_alt | resistencia | alt en español |
| `/en/blog/` | text | Leer más | Botón de cada tarjeta sin traducir |
| `/en/contact/` | form | Correo | Etiqueta del campo E-mail |
| `/en/contact/` | form | Mensaje | Etiqueta del campo de mensaje |
| `/en/contact/` | text | C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona | Dirección en formato español; el pie EN la traduce como 'C/ Potosi No. 2, 6th Floor' |
| `/en/contact/` | html | Carrer de Potosí, 2, planta 6, San Andrés de Palomar, 08030 Barcelona | title/aria-label del iframe del mapa |
| `/en/privacy-policy/` | text | C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona | Dirección en formato español |
| `/en/privacy-policy/` | text | correodelcliente | Variable de plantilla sin resolver (también en ES) |
| `/en/politica-de-cookies/` | link | https://twitter.com/es/privacy | Política de Twitter en español |
| `/en/politica-de-cookies/` | link | https://policies.google.com/privacy?hl=es-419&gl=mx | Política de Google en español de Latinoamérica/México |
| `/en/politica-de-cookies/` | link | https://policy.pinterest.com/es/privacy-policy | Política de Pinterest en español |
| `/en/politica-de-cookies/` | url | /en/politica-de-cookies/ | Slug en español |
| `/en/declaracion-de-accesibilidad/` | url | /en/declaracion-de-accesibilidad/ | Slug en español |
| `/en/el-variador-de-tension-y-sus-funciones/` | meta_description | Desde Torivac os contamos cómo funciona y qué aporta a tu negocio un variador de tensión.… | meta description completa en español |
| `/en/el-variador-de-tension-y-sus-funciones/` | img_alt | transformador toroideal | alt en español |
| `/en/el-variador-de-tension-y-sus-funciones/` | link | https://grupotorivac.com/en/contacto/ | CTA hacia una URL con slug español (/en/contacto/) que no existe |
| `/en/carrito/` | text | Puede que te interese… | H2 |
| `/en/carrito/` | text | ¡Tu carrito está actualmente vacío! | H2 |
| `/en/carrito/` | text | Nuevo en la tienda | H2 |
| `/en/carrito/` | seo | Carrito - Torivac | Título del navegador |
| `/en/finalizar-compra/` | url | /en/finalizar-compra/ | Slug y título en español |
| `/en/mi-cuenta/` | seo | Mi cuenta - Torivac | Título del navegador |
| `/en/tienda/` | seo | Tienda - Torivac | Título del navegador |
| `/en/category/blog/` | text | Leer más | Botón de las tarjetas |

Sitio entero (194 páginas EN): «Busar» en placeholder del buscador del encabezado (194 páginas EN); «Gestionar consentimiento / Aceptar / Denegar / Ver preferencias / Guar» en banner de cookies (Complianz); «Carrusel de imágenes» en aria-label de los carruseles de la portada.

### 4.4 Terminología: cuatro traducciones de «variador de tensión»

ES 'variador(es) de tensión' tiene al menos cuatro traducciones distintas en EN: 'voltage variators', 'voltage regulators', 'drives' (y 'variable speed drives', 'inverters' en la taxonomía de productos). El catálogo EN oficial (data/analysis/pdf-text/Torivac_2024_EN, 41 páginas) usa 'variator' 13 veces, 'voltage variator' 7 y 'autotransformer' 49; 'regulator' 0 y 'drive' 1; 'inverter' 8, solo en las secciones de conexión de las pp. 12-13 (ES: 'Modos de conexión para variadores monofásicos/trifásicos'). Usa ortografía británica ('stabilisers', 'recognised'), mientras la web usa la estadounidense.

| Término EN | Dónde aparece |
|---|---|
| voltage variators | bloque corporativo (cuerpo): estabilizadores, cobre, descargadores, Beyond Catalonia; torivac-company (cabecera); meta description de la portada; menú y taxonomía: Voltage variators - Adjustable autotransformers; el-variador-de-tension-y-sus-funciones |
| voltage regulators | titular del bloque corporativo (4 entradas); Beyond Catalonia ("such as voltage regulators"); torivac-company (MISSION: toroidal voltage regulators); cobre/estabilizadores ("copper voltage regulators", "Implementing voltage regulators") |
| drives | portada (hero y tarjeta Variable voltage drives); normativas (Torivac drives; line of drives); funcionamiento (The drives and solutions; incorporating drives); aplicaciones (Asian drives and components); torivac-products (Three-phase drives) |
| variable speed drives / inverters | torivac-products: extracto de la familia de variadores y subcategoría Single Phase Inverters |

Propuesta: Fijar en el glosario EN: variador de tensión = 'voltage variator' (autotransformador variable = 'variable autotransformer'); estabilizador = 'voltage stabilizer'; 'voltage regulator' solo como término genérico; no usar 'drive' ni 'inverter' para este producto.

## 5. Datos de empresa que aparecen en el sitio EN (frente a ES)

Contados sobre los HTML completos: 194 páginas EN y 208 ES. Lo que no consta se deja vacío y se anota en la sección 10.

| Dato | EN | ES | Diferencia |
|---|---|---|---|
| Teléfono | +34 93 312 01 61 (391 apariciones) | +34 93 312 01 61 (234) | Ninguna: mismo número, sin otros teléfonos. |
| Correo | info@torivac.com (391 apariciones) | info@torivac.com (234) | Ninguna: único correo en ambos; el dominio (torivac.com) difiere del de la web (grupotorivac.com). |
| Dirección | Pie: «C/ Potosi No. 2, 6th Floor 08030 Barcelona»; Contacto y Privacidad: «C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» | «C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» | El dato es el mismo; el pie EN lo traduce y Contacto/Privacidad no. Mapa: «Carrer de Potosí, 2, planta 6, San Andrés de Palomar, 08030 Barcelona» en ambos. |
| NIF | B60784584 (solo en la política de privacidad) | B60784584 (aviso legal y privacidad) | En EN no hay aviso legal; titular en blanco en privacidad. |
| Razón social | TORIVAC GROUP / Torivac Group / Torivac S.L (JSON-LD) | GRUPO TORIVAC / Torivac S.L. | Traducción literal de 'Grupo'; no consta la denominación registral completa. |
| Trayectoria | 60 years; Since 1964; more than half a century; nearly 60 years; more than 60 years | 60 años; Desde 1964; más de medio siglo; cerca de 60 años; más de 60 años | Ninguna: mismas cifras y misma incoherencia. |
| Presencia internacional | more than 30 countries; all 5 continents | más de 30 países; 5 continentes | Ninguna. |
| Catálogo PDF | Menú: Torivac_2024_EN.pdf; botón de la portada: Torivac_2024.pdf (ES) | Torivac_2024.pdf | El botón de la portada EN lleva al catálogo en español. |
| Financiación pública (ICEX-Next / FEDER) | Sin aviso en las 194 páginas; solo el logotipo antiguo `Logotipos_FondosEuropeos.jpg` (alt vacío) | Aviso y logotipo nuevo en 186 de 208 páginas | **Falta en EN**: texto de ICEX-Next/FEDER y logotipo `MANUAL-FEDER-ICEX-NEXT-2027.jpeg`. |
| Redes sociales | Ninguna con enlace; icono de LinkedIn sin enlace en las 194 páginas | Ninguna con enlace; icono de LinkedIn sin enlace | Ninguna. |
| Horarios | No constan | No constan | Ninguna. |
| Enlaces `tel:` y `mailto:` | 0 | 0 | Ninguna: teléfono y correo son texto plano en ambos idiomas. |
| Analítica | GA4 G-QXLKHV4Y7X; GTM GTM-K93FKL89 | Los mismos | Ninguna. |
| Agencia web | Santiso Marketing (https://santisomarketing.com/) | Santiso Marketing | Ninguna. |

## 6. Páginas legales

El texto íntegro de las tres está en `data/analysis/content/en.json`, clave `legal_pages` (y en `full_text` de cada pieza).

| Página | ID | Publ. / modif. | Caracteres | Problemas de gravedad alta | Decisión |
|---|---|---|---|---|---|
| [Privacy Policy](https://grupotorivac.com/en/privacy-policy/) | 15707 | 2025-12-10 / 2026-03-09 | 5.231 | El titular está en blanco: 'is held by: , with NIF: B60784584'.; Variable de plantilla sin resolver: 'send us a communication to correodelcliente' (no hay dirección).; Faltan plazos concretos de conservación, destinatarios/encargados (Google reCAPTCHA, Analytics, hosting), derecho a reclamar ante la autoridad de con… | Revisión legal antes de migrar |
| [Cookie Policy](https://grupotorivac.com/en/politica-de-cookies/) | 15830 | 2022-12-16 / 2022-12-16 | 3.926 | Sin inventario de cookies (nombre, finalidad, duración, proveedor): el sitio carga Google Analytics 4 (G-QXLKHV4Y7X), Google Tag Manager (GTM-K93FKL8… | Reescribir |
| [Accessibility statement](https://grupotorivac.com/en/declaracion-de-accesibilidad/) | 15699 | 2025-12-10 / 2026-03-09 | 4.143 | Contradicción: se declara 'partially compliant' y a la vez que el incumplimiento 'Not applicable. Meets 100% of the web accessibility criteria'.; Declara nivel AA de WCAG 2.1 por autoevaluación, mientras el sitio actual tiene alts vacíos, ausencia de H1 y enlaces rotos aparentes en el pie. | Reescribir |

Observaciones:

- **No existe aviso legal en inglés**: ni en la REST (`pages.en.json`), ni en `pages-index.json`, ni en los sitemaps ni en el `hreflang` del ES (que solo tiene traducción alemana). El pie EN y el banner de cookies enlazan a `/aviso-legal-2/` (español). `HALLAZGOS.md` #10 habla de un aviso legal EN con el titular en blanco: esa URL no consta; lo que sí tiene el titular en blanco en EN es la política de privacidad.
- La política de cookies EN existe (`/en/politica-de-cookies/`, id 15830) aunque `es.json` dice que no hay traducciones: el HTML cosechado solo contiene el pie, el canonical y el índice de páginas apuntan a la versión española y el texto íntegro procede de la REST.
- La declaración de accesibilidad y la de privacidad EN tienen URL traducida pero con slug en español (`/en/declaracion-de-accesibilidad/`); el pie EN enlaza a las versiones españolas de ambas.
- Terminología RGPD: la privacidad EN dice 'Limit', 'Oppose' y 'Delete' donde el texto oficial en inglés usa 'restriction', 'object' y 'erasure'; conviene que lo fije la asesoría legal.

## 7. Cabecera, pie y banner de cookies

Son comunes a todas las páginas y no forman parte del `full_text`. Los datos están en `site_chrome`.

- **Cabecera** (plantilla Elementor/Betheme): logotipo `Torivac_negativo.png` (alt = nombre de archivo). Menú: Home; Torivac Company; Products; Entrepreneurial Projects; Catalogue; Blog; Contact. Selector de idioma: English, Français, Español, Deutsch (en las entradas apunta a la misma ruta con el slug español; en la entrada EN-only solo ofrece English). Buscador con placeholder 'Busar' (español y con errata). El menú 'Catalogue' lleva a `Torivac_2024_EN.pdf`.
- **Pie de las páginas** (172 de las 194 páginas EN): dos bloques. El primero (© 2025) trae dirección traducida, teléfono, correo, 'All rights reserved' y enlaces a Legal Notice and Terms of Use, Privacy Policy y Accessibility Statement, **los tres hacia las versiones en español**, más 'Developed by Santiso Marketing'. El segundo (© 2022) repite dirección y datos y enlaza a `/aviso-legal/` (enlace roto aparente) y a la agencia. Entre ellos van el logotipo antiguo `Logotipos_FondosEuropeos.jpg` (alt vacío, dos veces) y un icono de LinkedIn sin enlace. **No hay aviso de ICEX-Next/FEDER.**
- **Pie de las entradas** (22 páginas): bloque 'CONTACT WITH US' con el formulario 16204 (nombre, correo, mensaje, 'I agree to the privacy policy', reCAPTCHA v3), sin etiquetas `<label>`, y **dos bloques idénticos © 2022** que enlazan a `/aviso-legal/` y no a privacidad ni accesibilidad. El mismo formulario está además en el pie de 128 fichas y categorías de producto.
- **Banner de cookies** (Complianz): título 'Gestionar consentimiento', categorías Funcional, Preferencias, Estadísticas, Marketing; botones Aceptar, Denegar, Ver preferencias, Guardar preferencias. **Todo en español** en una página con `lang=en-US`; solo los enlaces 'Manage options', 'Manage services', 'Manage {vendor_count} vendors', 'Read more about these purposes' y el aria-label 'Close dialog' están en inglés. Los enlaces se resuelven en ejecución con `complianz.page_links`: política de cookies -> `/en/politica-de-cookies/`, privacidad -> `/en/privacy-policy/` y Aviso legal -> `/aviso-legal-2/` (español). No hay captura del banner abierto en `data/raw/screens`.
- **Cabecera y datos estructurados**: el JSON-LD de la portada EN conserva en español el tagline (`Especializados en diseño y fabricación de variados de tensión`), y `WebSite.url` y el `SearchAction` apuntan a la raíz española (`https://grupotorivac.com/?s=`). `html lang` y `og:locale` son `en-US` y el texto usa ortografía estadounidense, mientras que el catálogo EN usa la británica ('stabilisers', 'recognised').

## 8. Hallazgos de calidad

Cada hallazgo tiene una evidencia que se comprobó automáticamente contra el texto, el SEO, las imágenes, los enlaces, los formularios o el HTML/REST crudos (278 de 278 verificados). Los hallazgos completos están en `quality_flags` de cada pieza; aquí se agrupan por tipo y los que se repiten en varias piezas aparecen en una sola fila. `ES` indica si el defecto ya está en el original (sí) o es propio de EN (no).

### 8.0 Gravedad alta (24)

| Pieza | Tipo | Hallazgo | ES |
|---|---|---|---|
| `/en/` | seo | El <link rel="canonical"> de la home EN apunta a la home alemana (/de/); og:url y WebPage.url del JSON-LD también. Hasta que se corrija, Google puede indexar la versión DE en lugar de la EN. Ya registrado en HALLAZGOS.md (#1 y #11). | no |
| `/en/contact/` | seo | El <link rel="canonical"> de /en/contact/ apunta a la página de contacto alemana (/de/kontakt-us/). | no |
| `/en/privacy-policy/` | placeholder | El titular está en blanco: 'is held by: , with NIF: B60784584'. | sí |
| `/en/privacy-policy/` | placeholder | Variable de plantilla sin resolver: 'send us a communication to correodelcliente' (no hay dirección). | sí |
| `/en/privacy-policy/` | legal | Faltan plazos concretos de conservación, destinatarios/encargados (Google reCAPTCHA, Analytics, hosting), derecho a reclamar ante la autoridad de control y bases por finalidad; menciona 'Financial data' aunque el sitio no vende. Revisar con asesoría legal. | sí |
| `/en/politica-de-cookies/` | legal | Sin inventario de cookies (nombre, finalidad, duración, proveedor): el sitio carga Google Analytics 4 (G-QXLKHV4Y7X), Google Tag Manager (GTM-K93FKL89), reCAPTCHA y el banner Complianz. | sí |
| `/en/declaracion-de-accesibilidad/` | consistency | Contradicción: se declara 'partially compliant' y a la vez que el incumplimiento 'Not applicable. Meets 100% of the web accessibility criteria'. | sí |
| `/en/declaracion-de-accesibilidad/` | unverified_claim | Declara nivel AA de WCAG 2.1 por autoevaluación, mientras el sitio actual tiene alts vacíos, ausencia de H1 y enlaces rotos aparentes en el pie. | sí |
| `/en/normativas-sobre-transformadores-electricos-en-europa/` | unverified_claim | Afirma documentación técnica 'reconocida por organismos certificadores europeos' sin citar ninguno; no hay certificados ni fichas que lo respalden en las fuentes. | sí |
| `/en/mantenimiento-de-transformadores-electricos/` | unverified_claim | Presenta a Torivac como empresa especializada en mantenimiento de transformadores; no existe esa línea de servicio en el resto del sitio (home, empresa, productos, proyectos). | sí |
| `/en/mantenimiento-de-transformadores-electricos/` | unverified_claim | Lista servicios técnicos concretos (termografía, revisión de refrigeración, análisis de aceite dieléctrico, ensayos) y contratos de mantenimiento sin respaldo en otras fuentes. | sí |
| `/en/como-extender-la-vida-util-de-un-transformador/` | unverified_claim | 'Extended warranty' sin plazo, condiciones ni documento; el catálogo solo recoge la garantía estándar con exclusiones. | sí |
| `/en/impacto-medioambiental-de-los-transformadores-hoy/` | unverified_claim | Afirma materiales ecológicos, materias primas reciclables y proceso de baja emisión sin certificado ambiental ni dato. | sí |
| `/en/impacto-medioambiental-de-los-transformadores-hoy/` | unverified_claim | Trazabilidad total de cada unidad y documentación técnica detallada: no hay evidencia en otras fuentes. | sí |
| `/en/funcionamiento-de-un-transformador-en-la-industria/` | reputation | Afirma que el soporte técnico de los proveedores asiáticos 'es inexistente o se limita a manuales mal traducidos': declaración despectiva sin fuente. | sí |
| `/en/seguridad-en-el-uso-de-transformadores/` | unverified_claim | Atribuye a los transformadores funciones de protección (sobrecargas, detección temprana de cortocircuitos) sin ficha técnica que las respalde. | sí |
| `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | unverified_claim | Servicio de diagnóstico y reparación atribuido a Torivac sin respaldo en el resto del sitio. | sí |
| `/en/eficiencia-de-los-transformadores-clave-en-europa/` | unverified_claim | Cumplimiento de Ecodesign afirmado sin identificar reglamento ni producto. | sí |
| `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | unverified_claim | Servicios de optimización y reparación atribuidos a Torivac sin respaldo. | sí |
| `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | unverified_claim | Afirma certificaciones de calidad reconocidas sin nombrarlas; no constan certificados de empresa en las fuentes. | sí |
| `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | reputation | Generaliza que muchas fábricas chinas evitan controles de trazabilidad y pureza de aleaciones 'para reducir costes': riesgo reputacional y legal. | sí |
| `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | reputation | Crítica explícita a la organización de la feria (la propia entrada enlaza a https://www.ifema.es/matelec/que-es): riesgo reputacional. | sí |
| `/en/descargadores-de-bateria/` | unverified_claim | Afirma que Torivac fabrica descargadores de batería; no existe ficha ni categoría de ese producto en el catálogo. | sí |
| `/en/el-variador-de-tension-y-sus-funciones/` | seo | El canonical y og:url apuntan a https://grupotorivac.com/el-variador-de-tension-y-sus-funciones/ (sin /en/), una URL que no está en el sitemap (el sitemap lista la /en/) ni en la REST ES: la entrada EN se declara duplicado de una página ES que no existe. | no |

### 8.1 Erratas, gramática y estilo (30)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| media | grammar | `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | Sintaxis rota heredada de ES: 'feel free to consult any questions with electrical experts or electrical engineers can provide personalized guidance'. | «feel free to consult any questions with electrical experts or electrical engine…» | sí |
| media | typo | `/en/torivac-company/` | El título SEO dice 'Grupor Torivac - Our Company' ('Grupor'). | «Grupor Torivac - Our Company» | sí |
| media | typo | `/en/entrepreneurial-projects/` | El título SEO dice 'Grupor Torivac - Business Projects' ('Grupor'). | «Grupor Torivac - Business Projects» | sí |
| media | typo | `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | Nombres propios en minúscula en titulares y cuerpo ('coiltech deutschland', 'messe augsburg', 'torivac'). | «torivac innovation and technology highlighted at coiltech deutschland 2025» | sí |
| media | typo | `/en/torivac-en-beyond-catalonia/` | Errata: 'Beyond Catalona' (Catalonia) en el primer párrafo. | «Beyond Catalona» | sí |
| baja | grammar | `/en/torivac-en-beyond-catalonia/` | 'we have deepened on the concept' (calco de 'profundizamos en'). | «we have deepened on the concept» | no |
| baja | style | `/en/` | Calcos del español: 'CONTACT WITH US' (Contact us), 'In Torivac you will find' (At Torivac), 'high demanding' (highly demanding) y 'Write us and we will solve it for you' (sin antecedente en inglés para 'it'). | «In Torivac you will find a wide range» | no |
| baja | style | `/en/contact/` | Calcos: 'CONTACT WITH US', 'Do you have any doubts?' (questions), 'In Torivac you will find', 'Write us'. | «Do you have any doubts?» | no |
| baja | style | `/en/declaracion-de-accesibilidad/` | Formato de fecha 08/26/2024 (mes/día) cuando el original dice 26/08/2024: ambiguo para un lector europeo. | «08/26/2024» | no |
| baja | style | `/en/funcionamiento-de-un-transformador-en-la-industria/` | 'technified adaptability' y 'know-how' (calcos); 'This technified adaptability' no es inglés idiomático. | «This technified adaptability» | sí |
| baja | style | `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | Anglicismo 'ROI' y alternancia 'upgrade'/'improve' (título y meta description usan términos distintos). | «ROI» | sí |
| baja | style | `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | Frase torpe por calco: 'European advanced-manufactured transformers stand out from mass-produced solutions with lower standards and regulatory compliance.' | «European advanced-manufactured transformers stand out» | no |
| baja | style | `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | Hipérbole comercial ('smart choice', 'the perfect partner'). | «the perfect partner for highly demanding sectors» | sí |
| baja | style | `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | Hipérbole: 'an unbeatable opportunity'; 'those who bet on these events' (calco de 'apuestan'). | «an unbeatable opportunity» | sí |
| baja | style | `/en/estabilizadores-de-tension-con-cobre/` | Superlativo sin prueba: 'This is undoubtedly the most effective'; y non sequitur 'Therefore, voltage stabilizers are more than effective.' | «This is undoubtedly the most effective» | sí |
| baja | style | `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | Tono coloquial: 'fortunately for your company'. | «Toroidal transformers, fortunately for your company» | sí |
| baja | typo | `/en/torivac-products/` | Frase con palabras duplicadas: 'Voltage stabilizers or also called voltage regulators or voltage regulators.' | «voltage regulators or voltage regulators» | no |
| baja | typo | `/en/torivac-products/` | Mayúsculas y puntuación incoherentes: 'led 10mm', 'safety socket HR4', 'Resistors : Load banks' (espacio antes de los dos puntos), 'Squares' en lugar de 'Square', 'Sockets' para 'Hembrillas' (la URL usa 'socket-jack'). | «Resistors : Load banks» | sí |
| baja | typo | `/en/contact/` | 'Potosi' sin tilde (el mapa usa 'Potosí'). | «Potosi» | sí |
| baja | typo | `/en/privacy-policy/` | Sintaxis: 'we will treat your data as we reflect in this Privacy Policy' y 'The types of data requested' (calco de 'tal y como reflejamos'). | «as we reflect in this Privacy Policy» | no |
| baja | typo | `/en/politica-de-cookies/` | 'Cookies are those that are sent...' (bajo 'Own Cookies') carece de sujeto; 'Web Site'/'Website' se usan de forma indistinta; 'Twitter' (hoy X). | «Cookies are those that are sent to the User» | sí |
| baja | typo | `/en/normativas-sobre-transformadores-electricos-en-europa/` | Topónimo y marca en minúscula en los titulares: 'spain', 'torivac'. | «technical regulations in spain and europe» | sí |
| baja | typo | `/en/mantenimiento-de-transformadores-electricos/` | Subtítulo H3 que empieza en minúscula: 'pressure on the market...'. | «pressure on the market and doubts about the quality of Asian manufacturers» | sí |
| baja | typo | `/en/como-extender-la-vida-util-de-un-transformador/` | Titular con 'europe' en minúscula. | «Transformer life extension in europe» | sí |
| baja | typo | `/en/impacto-medioambiental-de-los-transformadores-hoy/` | Titular con 'europe' y 'spain' en minúscula. | «Environmental impact of transformers in europe and spain» | sí |
| baja | typo | `/en/funcionamiento-de-un-transformador-en-la-industria/` | Unidad 'kw' en minúscula (kW). | «every kw must be perfectly controlled» | sí |
| baja | typo | `/en/seguridad-en-el-uso-de-transformadores/` | Titular que termina en punto y es una frase completa: 'Torivac offers transformers with advanced protection and a European warranty.' | «Torivac offers transformers with advanced protection and a European warranty.» | no |
| baja | typo | `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Construcciones torpes por calco: 'something that affected a lot', 'interesting products/booths'. | «something that affected a lot» | sí |
| baja | typo | `/en/torivac-en-beyond-catalonia/` | Palabra duplicada por el enlace: 'browse the the Torivac website'. | «browse the / the Torivac website» | no |
| baja | typo | `/en/category/blog/` | El título del navegador es 'blog - Torivac' (categoría en minúscula). | «blog - Torivac» | sí |

### 8.2 Errores de traducción y terminología (30)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| media | terminology | `/en/` | Tres nombres para el mismo producto en una misma página: 'drives' en el hero y en la tarjeta ('Variable voltage drives'), 'variators' en la meta description y 'Voltage variators - Adjustable autotransformers' en la taxonomía. 'Variable speed drive' designa otro equipo (variador de frecuencia). | «Variable voltage drives» | no |
| media | terminology | `/en/normativas-sobre-transformadores-electricos-en-europa/` | 'variadores' se traduce como 'drives' ('Torivac drives stand out', 'Its line of drives') en un artículo sobre transformadores; el mismo término es 'voltage variators' o 'voltage regulators' en otras piezas. | «Torivac drives stand out» | no |
| media | terminology | `/en/funcionamiento-de-un-transformador-en-la-industria/` | 'variadores' se traduce como 'drives' ('The drives and solutions developed by Torivac', 'incorporating drives') en un artículo sobre transformadores. | «The drives and solutions developed by Torivac» | no |
| media | terminology | `/en/aplicaciones-de-los-transformadores-en-la-industria-actual/` | 'variadores' se traduce como 'drives' en un artículo sobre transformadores: 'Asian drives and components'. | «The technical limitations of many Asian drives and components» | no |
| media | terminology | `/en/torivac-en-beyond-catalonia/`, `/en/estabilizadores-de-tension-con-cobre/`, `/en/estabilizadores-de-tension/` y 1 más (4 piezas) | El titular del bloque corporativo traduce 'variadores de tensión' como 'voltage regulators'; el cuerpo del mismo bloque dice 'voltage variators' y el catálogo EN oficial (Torivac_2024_EN.pdf) usa 'variator' (13 veces) y 'voltage variator' (7) pero nunca 'regulator'. | «Torivac is a company specialized in the design and manufacture of toroidal tran…» | no |
| media | translation | `/en/` | 'load benches' es un falso amigo: ES dice 'bancos de carga' (load banks), término que la propia meta description EN y la categoría 'Resistors : Load banks' sí usan. | «We also manufacture load benches and resistors» | no |
| media | translation | `/en/` | 'Toroidal shocks' traduce 'Choques toroidales': el término técnico es 'toroidal chokes' (la categoría EN se llama 'Chokes \| Inductances \| Toroidal Reactances'). | «Toroidal shocks» | no |
| media | translation | `/en/torivac-products/` | 'Single Phase Inverters' traduce 'Variadores Monofásicos': un inverter es un convertidor CC/CA, no un variador de tensión (autotransformador variable). La tercera subcategoría se llama 'Three-phase drives' y la familia 'Voltage variators', tres nombres para lo mismo. La confusión viene del catálogo EN (p. 12: ES 'Modos de conexión para v… | «Single Phase Inverters» | no |
| media | translation | `/en/torivac-products/` | 'variable speed drives' (extracto de la familia Voltage variators) designa variadores de velocidad de motores; el original ES habla de variadores de tensión y de regulación continua. | «voltage and stepless variable speed drives» | no |
| media | translation | `/en/torivac-products/` | 'Nuclei' (ES 'Núcleos') debería ser 'Cores'; la URL de la categoría ya es /cores/. | «Nuclei» | no |
| media | translation | `/en/entrepreneurial-projects/` | El CTA es 'Contact us at ' y no completa la frase (ES: 'Contáctanos'); el texto del enlace termina en una preposición. | «Contact us at» | no |
| media | translation | `/en/privacy-policy/` | Terminología de derechos no alineada con el RGPD en inglés: 'Limit the processing' (restriction of processing, art. 18), 'Oppose the processing' (object, art. 21), 'Delete' (erasure, art. 17), 'LEGITIMACY' (lawfulness/legal basis). | «Oppose the processing of your personal data in accordance with Article 21 of th…» | no |
| media | translation | `/en/politica-de-cookies/` | Frase ininteligible por calco: 'no cookie allows this cookie to contact the User’s telephone number'. | «no cookie allows this cookie to contact the User’s telephone number» | no |
| media | translation | `/en/impacto-medioambiental-de-los-transformadores-hoy/` | 'European Green Pact' traduce 'Pacto Verde Europeo': el nombre oficial en inglés es 'European Green Deal'. | «European Green Pact» | no |
| media | translation | `/en/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | 'processors' traduce 'transformadores': el original ES dice 'entre los transformadores de origen chino y los europeos'. | «between Chinese and European processors is notorious» | no |
| media | translation | `/en/eficiencia-de-los-transformadores-clave-en-europa/` | 'improving the efficiency of processors' traduce 'mejorar la eficiencia de los transformadores'. | «improving the efficiency of processors» | no |
| media | translation | `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | 'millions of dollars in losses' introduce una moneda que no figura en el original ('pérdidas millonarias'); Torivac opera en euros. | «millions of dollars in losses» | no |
| media | translation | `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 'millions of dollars in losses' introduce una moneda que no figura en el original ('pérdidas millonarias'). | «millions of dollars in losses» | no |
| media | translation | `/en/el-variador-de-tension-y-sus-funciones/` | Falsa coherencia terminológica: el encabezado dice 'Types of Voltage Regulators' y el párrafo 'Voltage regulators can come in three different forms', pero lo que describe son variadores ('voltage variators'). | «Voltage regulators can come in three different forms:» | no |
| baja | terminology | `/en/torivac-company/` | El mismo producto aparece como 'voltage variators' en la cabecera y como 'toroidal voltage regulators' en MISSION (ES: 'variadores de tensión toroidales'); 'voltage regulator' se usa también para los estabilizadores. | «our toroidal voltage regulators» | no |
| baja | terminology | `/en/estabilizadores-de-tension-con-cobre/` | Alternancia 'stabilizer'/'regulator' para el mismo producto en un mismo párrafo ('Our copper voltage regulators reduce equipment wear'). | «Our copper voltage regulators reduce equipment wear» | no |
| baja | terminology | `/en/estabilizadores-de-tension/` | 'Implementing voltage regulators' mezcla 'regulator' y 'stabilizer' para el mismo producto. | «Implementing voltage regulators helps to comply» | no |
| baja | translation | `/en/` | Etiquetas de la rejilla con orden o término no estándar: 'Cores toroidal' (toroidal cores) y 'Coil for electromagnets' (la categoría EN es 'Encapsulated coils'; 'Nuclei' en la taxonomía). | «Cores / toroidal» | no |
| baja | translation | `/en/torivac-products/` | 'Estators' (ES 'Estators' = estátores) debería ser 'Stators'; 'Casing covers' traduce 'Cubretercas' (cubretuercas, 'nut covers' en la URL del producto); 'Graded covers' es incoherente con 'Graduated discs'. | «Casing covers» | no |
| baja | translation | `/en/normativas-sobre-transformadores-electricos-en-europa/` | La meta description empieza con 'Complies with...' (imperativo 'Cumple con' sin sujeto en inglés). | «Complies with European electrical transformer regulations» | no |
| baja | translation | `/en/descargadores-de-bateria/` | Frase sin sentido por calco: 'Such as energy, these devices are essential...' (ES: 'Como la energética'). | «Such as energy, these devices are essential» | no |
| baja | translation | `/en/el-variador-de-tension-y-sus-funciones/` | 'with a cursor moving along it' traduce 'cursor' (en un autotransformador variable, el contacto deslizante se llama 'wiper' o 'brush'). | «with a cursor moving along it» | no |

### 8.3 Idioma equivocado y texto de interfaz en otro idioma (15)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| media | wrong_language | `/en/` | 'Download Catalog' enlaza al catálogo en español (Torivac_2024.pdf) mientras que el menú EN apunta a Torivac_2024_EN.pdf (41 páginas, existe en data/raw/pdf). | «https://grupotorivac.com/wp-content/uploads/2024/10/Torivac_2024.pdf» | no |
| media | wrong_language | `/en/` | Etiquetas de formulario en español en la página EN: el campo E-mail se llama 'Correo' y el de mensaje 'Mensaje' (ocultas a la vista, pero las leen los lectores de pantalla); el honeypot se titula 'Name Mensaje Correo'. | «Correo» | no |
| media | wrong_language | `/en/` | Alts en otro idioma: 'triphasé servomoteur' (francés), 'resistencia' y 'sobremesa03' (español). | «triphasé servomoteur» | no |
| media | wrong_language | `/en/blog/` | El botón de cada tarjeta dice 'Leer más' (español) en la página EN. | «Leer más» | no |
| media | wrong_language | `/en/contact/` | Etiquetas de formulario en español: 'Correo' y 'Mensaje' (campos E-mail y mensaje). | «Correo» | no |
| media | wrong_language | `/en/politica-de-cookies/` | Los enlaces a las políticas de terceros son de la versión en español: twitter.com/es/privacy, policies.google.com/privacy?hl=es-419&gl=mx (español de México) y policy.pinterest.com/es. | «https://policies.google.com/privacy?hl=es-419&gl=mx» | no |
| media | wrong_language | `/en/el-variador-de-tension-y-sus-funciones/` | La meta description está en español: 'Desde Torivac os contamos cómo funciona y qué aporta a tu negocio un variador de tensión. ¡Echa un vistazo!'. | «Desde Torivac os contamos cómo funciona» | no |
| media | wrong_language | `/en/el-variador-de-tension-y-sus-funciones/` | El alt de la imagen está en español: 'transformador toroideal'. | «transformador toroideal» | no |
| media | wrong_language | `/en/carrito/` | Los H2 y el mensaje de carrito vacío están en español en la página EN ('Puede que te interese…', '¡Tu carrito está actualmente vacío!', 'Nuevo en la tienda'); el título del navegador y el slug también. | «¡Tu carrito está actualmente vacío!» | no |
| media | wrong_language | `/en/finalizar-compra/` | El HTML servido para /en/finalizar-compra/ es la plantilla del carrito en español (canonical /en/carrito/), no el checkout. | «https://grupotorivac.com/en/carrito/» | sí |
| media | wrong_language | `/en/category/blog/` | Botón 'Leer más' en español en cada tarjeta. | «Leer más» | sí |
| baja | wrong_language | `/en/` | El aria-label de ambos carruseles está en español ('Carrusel de imágenes') en una página con lang=en-US. | «Carrusel de imágenes» | no |
| baja | wrong_language | `/en/` | El buscador del encabezado tiene el placeholder 'Busar' (español y con errata de 'Buscar') en todas las páginas EN. | «Busar» | sí |
| baja | wrong_language | `/en/contact/` | La dirección de la sección de contacto está en formato español ('Nº 2, Planta 6ª'), mientras el pie de la misma página la traduce ('No. 2, 6th Floor'). | «C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» | no |
| baja | wrong_language | `/en/privacy-policy/` | La dirección del titular está en formato español ('Nº 2, Planta 6ª'). | «Address: C/ Potosi Nº 2, Planta 6ª, 08030 Barcelona» | no |

### 8.4 Relleno y marcadores sin resolver (2)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| alta | placeholder | `/en/privacy-policy/` | El titular está en blanco: 'is held by: , with NIF: B60784584'. | «is held by: , with NIF: B60784584» | sí |
| alta | placeholder | `/en/privacy-policy/` | Variable de plantilla sin resolver: 'send us a communication to correodelcliente' (no hay dirección). | «correodelcliente» | sí |

### 8.5 Enlaces rotos aparentes y enlaces ausentes (8)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| media | broken_link | `/en/` | Tres CTA enlazan a páginas en español (/torivac-empresa/, /proyectos-empresariales/ x2) aunque existen /en/torivac-company/ y /en/entrepreneurial-projects/. Además el tercero ('Conocer la empresa Torivac' en ES) sigue enviando a Proyectos. | «https://grupotorivac.com/torivac-empresa/» | no |
| media | broken_link | `/en/` | Cuatro de las diez tarjetas de familia enlazan a categorías con slug español y sin prefijo /en/ (choques, botones-de-mando, portaled, nucleos); las otras seis sí usan /en/categoria-producto/. | «https://grupotorivac.com/categoria-producto/choques/» | no |
| media | broken_link | `/en/torivac-company/` | El CTA 'More Information' enlaza a /contacto/ (español) en lugar de /en/contact/. | «https://grupotorivac.com/contacto/» | no |
| media | broken_link | `/en/entrepreneurial-projects/` | El CTA enlaza a /contacto/ (español) en lugar de /en/contact/. | «https://grupotorivac.com/contacto/» | no |
| media | broken_link | `/en/blog/` | La paginación (1, 2, 3) apunta a /en/blog/page/2/ y /en/blog/page/3/, que no se cosecharon: solo se capturó la primera página (10 de 22 entradas). | «Page 2» | sí |
| media | broken_link | `/en/el-variador-de-tension-y-sus-funciones/` | El enlace 'assist you!' apunta a https://grupotorivac.com/en/contacto/, URL que no existe (la página de contacto EN es /en/contact/): enlace roto aparente, no comprobado por red. | «https://grupotorivac.com/en/contacto/» | no |
| media | broken_link | `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | Dice 'just click here' y 'contact us here' pero no hay ningún enlace en el HTML (texto plano). | «Then just click here.» | sí |
| media | broken_link | `/en/carrito/` | El pie antiguo enlaza a https://grupotorivac.com/aviso-legal/, que no figura en el sitemap, la API REST ni el índice de páginas (enlace roto aparente, no comprobado por red). | «https://grupotorivac.com/aviso-legal/» | sí |

### 8.6 Contenido duplicado, incoherencias y estructura (28)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| alta | consistency | `/en/declaracion-de-accesibilidad/` | Contradicción: se declara 'partially compliant' y a la vez que el incumplimiento 'Not applicable. Meets 100% of the web accessibility criteria'. | «Not applicable. Meets 100% of the web accessibility criteria.» | sí |
| media | consistency | `/en/` | Cifra de trayectoria no unificada: H2 '60 years of experience', hero 'More than 60 years' y 'nearly 60 years' en las entradas del blog. | «60 years of experience» | sí |
| media | consistency | `/en/torivac-company/` | Cifras de trayectoria no unificadas: '60 years', 'Since 1964' y 'more than half a century'; en las entradas 'nearly 60 years'; el catálogo habla de 'más de treinta años' en toroidales. | «more than half a century» | sí |
| media | consistency | `/en/torivac-products/` | 'Electronic equipment' figura en el árbol (4 subcategorías) pero no tiene tarjeta en 'Our products'; en ES el árbol tiene 5 subcategorías (falta 'AC power supplies' en EN). | «Electronic equipment» | sí |
| media | consistency | `/en/torivac-products/` | Recuento de Voltage variators: 12 en EN frente a 15 en ES; tres fichas no están traducidas. | «Voltage variators - Adjustable autotransformers / (12)» | no |
| media | consistency | `/en/entrepreneurial-projects/` | Cuatro nombres para la misma sección: menú 'Entrepreneurial Projects', H1 'Turnkey projects', título SEO 'Business Projects' y URL entrepreneurial-projects. 'Entrepreneurial' (emprendedor) traduce mal 'Empresariales' (business). | «Business Projects» | no |
| media | consistency | `/en/declaracion-de-accesibilidad/` | Estándares contradictorios: 'XHTML 1.0, CSS 3.0, WAI AA' frente a 'HTML5'. | «Use of W3C standards: XHTML 1.0, CSS 3.0, WAI AA.» | sí |
| media | consistency | `/en/torivac-en-beyond-catalonia/` | Tiempo verbal futuro en una crónica ya celebrada ('Torivac will be present at...') junto a 'was held' y 'Consolidating a new expansion strategy'. | «Torivac will be present at the Beyond Catalona event» | sí |
| media | consistency | `/en/el-variador-de-tension-y-sus-funciones/` | Pieza sin traducciones: solo existe en inglés (22 entradas EN frente a 21 en ES/FR/DE); el selector de idioma solo ofrece 'English'. Está asignada a la categoría ES id 443 y no a la EN (606), por lo que no cuenta en la categoría EN 'blog' (21). | [categoría ES id 443] | no |
| media | content | `/en/torivac-products/` | Los extractos de las tarjetas acaban en '…' a mitad de frase (extracto automático). | «driven by the growing demand for reliable and…» | sí |
| media | content | `/en/blog/` | El extracto automático concatena el subtítulo con el texto sin puntuación ('...in spain and europe The European...'). | «technical regulations in spain and europe The European» | sí |
| media | content | `/en/funcionamiento-de-un-transformador-en-la-industria/` | El título promete explicar el funcionamiento pero el cuerpo es comercial; además el título SEO ('Operation of a transformer in industry') y el H2 ('How a transformer works: keys to your project') no coinciden. | «Operation of a transformer in industry» | sí |
| media | content | `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | Público objetivo (universidades, laboratorios) poco coherente con el cliente industrial de Torivac. | «universities, technology institutes and research centers» | sí |
| media | content | `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | La meta description afirma que los toroidales 'guarantee superior electrical isolation in power transmission', cosa que el cuerpo no trata. | «superior electrical isolation in power transmission» | - |
| media | duplicate_content | `/en/torivac-en-beyond-catalonia/`, `/en/estabilizadores-de-tension-con-cobre/`, `/en/estabilizadores-de-tension/` y 1 más (4 piezas) | Bloque corporativo duplicado en esta y otras entradas (descargadores, estabilizadores, cobre, Beyond Catalonia) y en decenas de fichas de producto. | «Torivac is a company specialized in the design and manufacture of toroidal tran…» | sí |
| baja | consistency | `/en/` | La etiqueta 'Our Services' encabeza una rejilla de productos, no de servicios. | «Our Services» | sí |
| baja | consistency | `/en/contact/` | El dominio del correo (torivac.com) no coincide con el del sitio (grupotorivac.com). | «info@torivac.com» | sí |
| baja | consistency | `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | Cifra de trayectoria: aquí 'more than 60 years of experience'; en las entradas con el bloque corporativo 'nearly 60 years'. | «more than 60 years of experience» | sí |
| baja | content | `/en/torivac-company/` | Los textos de MISSION y VISION describen historia y objetivos comerciales, y la visión repite una frase de la portada ('the excellent quality-price ratio that characterizes us'). Frases poco claras por calco: 'maintain the reliability of our customers for our products' y 'benefiting the construction of alliances'. | «maintain the reliability of our customers for our products» | sí |
| baja | content | `/en/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | Frase confusa: 'The trust placed in a supplier such as Torivac should not be based on its industrial recognition'. | «should not be based on its industrial recognition» | sí |
| baja | structure | `/en/` | Saltos de nivel de encabezado: H1, luego H4/H2 alternados (las etiquetas superiores son H4 y los títulos H2). | [saltos de nivel de encabezado] | sí |
| baja | structure | `/en/torivac-company/` | Estructura de encabezados poco semántica: H1, luego H4 y H2 alternados. | [saltos de nivel de encabezado] | sí |
| baja | structure | `/en/torivac-products/` | Encabezado 'CUSTOMIZED PRODUCTS' sin contenido. | «CUSTOMIZED PRODUCTS» | sí |
| baja | structure | `/en/entrepreneurial-projects/` | Encabezado repetido 'Strategic work and collaboration' (dos veces) y 'Tailor-made projects' como H4 suelto. | «Strategic work and collaboration» | sí |
| baja | structure | `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | Las cuatro primeras secciones son muy cortas (400-630 caracteres) frente a las tres últimas (1.600-2.050): son dos plantillas SEO acopladas. | «Material selection and operational efficiency» | sí |

### 8.7 Afirmaciones sin respaldo y riesgo reputacional (52)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| alta | reputation | `/en/funcionamiento-de-un-transformador-en-la-industria/` | Afirma que el soporte técnico de los proveedores asiáticos 'es inexistente o se limita a manuales mal traducidos': declaración despectiva sin fuente. | «whose technical support is generally non-existent or limited to poorly translat…» | sí |
| alta | reputation | `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | Generaliza que muchas fábricas chinas evitan controles de trazabilidad y pureza de aleaciones 'para reducir costes': riesgo reputacional y legal. | «many Chinese factories avoid these controls to reduce costs» | sí |
| alta | reputation | `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Crítica explícita a la organización de la feria (la propia entrada enlaza a https://www.ifema.es/matelec/que-es): riesgo reputacional. | «some organizational problems that affected the flow of the event» | sí |
| alta | unverified_claim | `/en/declaracion-de-accesibilidad/` | Declara nivel AA de WCAG 2.1 por autoevaluación, mientras el sitio actual tiene alts vacíos, ausencia de H1 y enlaces rotos aparentes en el pie. | «complying with the priority 2 (AA) checkpoints» | sí |
| alta | unverified_claim | `/en/normativas-sobre-transformadores-electricos-en-europa/` | Afirma documentación técnica 'reconocida por organismos certificadores europeos' sin citar ninguno; no hay certificados ni fichas que lo respalden en las fuentes. | «technical documentation recognized by European certifying bodies» | sí |
| alta | unverified_claim | `/en/mantenimiento-de-transformadores-electricos/` | Presenta a Torivac como empresa especializada en mantenimiento de transformadores; no existe esa línea de servicio en el resto del sitio (home, empresa, productos, proyectos). | «Torivac positions itself as a company specialized in the maintenance of electri…» | sí |
| alta | unverified_claim | `/en/mantenimiento-de-transformadores-electricos/` | Lista servicios técnicos concretos (termografía, revisión de refrigeración, análisis de aceite dieléctrico, ensayos) y contratos de mantenimiento sin respaldo en otras fuentes. | «thermography diagnostics, overhaul of cooling systems, adjustment of internal c…» | sí |
| alta | unverified_claim | `/en/como-extender-la-vida-util-de-un-transformador/` | 'Extended warranty' sin plazo, condiciones ni documento; el catálogo solo recoge la garantía estándar con exclusiones. | «extended warranty» | sí |
| alta | unverified_claim | `/en/impacto-medioambiental-de-los-transformadores-hoy/` | Afirma materiales ecológicos, materias primas reciclables y proceso de baja emisión sin certificado ambiental ni dato. | «use of recyclable raw materials and a low-emission manufacturing process» | sí |
| alta | unverified_claim | `/en/impacto-medioambiental-de-los-transformadores-hoy/` | Trazabilidad total de cada unidad y documentación técnica detallada: no hay evidencia en otras fuentes. | «full traceability of each unit manufactured» | sí |
| alta | unverified_claim | `/en/seguridad-en-el-uso-de-transformadores/` | Atribuye a los transformadores funciones de protección (sobrecargas, detección temprana de cortocircuitos) sin ficha técnica que las respalde. | «integrate overload protections, early short-circuit detection mechanisms» | sí |
| alta | unverified_claim | `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | Servicio de diagnóstico y reparación atribuido a Torivac sin respaldo en el resto del sitio. | «Torivac’s diagnostic and repair service» | sí |
| alta | unverified_claim | `/en/eficiencia-de-los-transformadores-clave-en-europa/` | Cumplimiento de Ecodesign afirmado sin identificar reglamento ni producto. | «comply with European standards such as the Ecodesign directive» | sí |
| alta | unverified_claim | `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | Servicios de optimización y reparación atribuidos a Torivac sin respaldo. | «Torivac offers transformer optimization and repair services» | sí |
| alta | unverified_claim | `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | Afirma certificaciones de calidad reconocidas sin nombrarlas; no constan certificados de empresa en las fuentes. | «recognized quality certifications» | sí |
| alta | unverified_claim | `/en/descargadores-de-bateria/` | Afirma que Torivac fabrica descargadores de batería; no existe ficha ni categoría de ese producto en el catálogo. | «The battery dischargers we manufacture at Torivac» | sí |
| media | accuracy | `/en/seguridad-en-el-uso-de-transformadores/` | Error conceptual: IEC y EN son normas, no 'directivas europeas'. | «European directives such as IEC and EN» | sí |
| media | accuracy | `/en/estabilizadores-de-tension-con-cobre/` | El cobre es el material del bobinado, no un método de regulación; afirmación técnica imprecisa a validar con ingeniería. | «One of the many solutions is voltage regulation using copper» | sí |
| media | accuracy | `/en/estabilizadores-de-tension/` | Describe un estabilizador de tomas ('a transformer that has several outputs') que no corresponde a las series Torivac (AVS electromecánicos con servomotor, BAVS electrónicos) de la página de productos. | «equipped with a transformer that has several outputs» | sí |
| media | reputation | `/en/normativas-sobre-transformadores-electricos-en-europa/`, `/en/mantenimiento-de-transformadores-electricos/`, `/en/como-extender-la-vida-util-de-un-transformador/` y 5 más (8 piezas) | Se compara con importaciones asiáticas (sobre todo chinas) sin aportar fuente ni dato. | «especially of Chinese origin, whose technical characteristics and levels of com…» | sí |
| media | reputation | `/en/impacto-medioambiental-de-los-transformadores-hoy/` | Generaliza sobre los procesos de fabricación asiáticos sin fuente. | «Much of the supply comes from Asian suppliers, whose manufacturing processes of…» | sí |
| media | reputation | `/en/eficiencia-de-los-transformadores-clave-en-europa/` | Atribuye cuestionamientos a 'expertos del sector' sin fuente. | «has been questioned by industry experts» | sí |
| media | reputation | `/en/aplicaciones-de-los-transformadores-en-la-industria-actual/` | Califica de limitadas las soluciones asiáticas sin fuente. | «This situation has allowed products of Chinese origin to gain a certain presenc…» | sí |
| media | reputation | `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | 'Alarming lack' y 'saturation' por equipos chinos sin fuente. | «market saturation by importers of Chinese equipment» | sí |
| media | reputation | `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Reprocha a la organización fallos en tono público ('we hope that the organization has noticed these mistakes'). | «we hope that the organization has noticed these mistakes» | sí |
| media | unverified_claim | `/en/entrepreneurial-projects/` | La 'puesta en marcha en instalaciones' ('commissioning in installations') no se describe en ninguna otra página. | «We include design, manufacturing and commissioning in installations.» | sí |
| media | unverified_claim | `/en/normativas-sobre-transformadores-electricos-en-europa/` | Aplica EN 50588-1 y el Reglamento 2019/1783 (transformadores de distribución y de potencia) al catálogo de Torivac sin indicar qué productos los cumplen; no migrar como afirmación de cumplimiento. Las referencias normativas no se han contrastado con fuentes externas (sin red). | «EN 50588-1» | sí |
| media | unverified_claim | `/en/mantenimiento-de-transformadores-electricos/` | Testimonio genérico sin cliente ni dato: 'Companies that have relied on Torivac report significant improvements'. | «Companies that have relied on Torivac report significant improvements» | sí |
| media | unverified_claim | `/en/como-extender-la-vida-util-de-un-transformador/` | Procesos de fabricación 'certificados' sin nombrar certificación. | «certified manufacturing processes» | sí |
| media | unverified_claim | `/en/impacto-medioambiental-de-los-transformadores-hoy/` | Vincula la producción con el ODS 7 sin ninguna acreditación. | «Sustainable Development Goal 7 (affordable and clean energy)» | sí |
| media | unverified_claim | `/en/funcionamiento-de-un-transformador-en-la-industria/` | Servicios de ingeniería (pruebas, simulaciones, garantías de rendimiento, cálculos eléctricos) no descritos en otras páginas. | «providing tests, simulations and performance guarantees» | sí |
| media | unverified_claim | `/en/seguridad-en-el-uso-de-transformadores/` | Superlativo de mercado sin evidencia: 'one of the most specialized manufacturers in Spain'. | «one of the most specialized manufacturers in Spain» | sí |
| media | unverified_claim | `/en/seguridad-en-el-uso-de-transformadores/` | 'Certified national engineering' sin certificación citada. | «certified national engineering» | sí |
| media | unverified_claim | `/en/limites-de-un-transformador-y-como-afectan-su-rendimiento/` | Cumplimiento de normativa CE afirmado en general; el catálogo (Torivac_2024.pdf p. 12) lo condiciona al montaje de los variadores en envolvente. | «complying with CE standards» | sí |
| media | unverified_claim | `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | 'Has earned it the trust of high-level academic institutions' y 'tangible and documented results' sin referencias. | «has earned it the trust of high-level academic institutions» | sí |
| media | unverified_claim | `/en/eficiencia-de-los-transformadores-clave-en-europa/` | Eficiencia presentada como 'hecho comprobado' sin ningún dato medible, y 'líder europeo' en la meta description. | «is not simply a statement, it is a fact proven» | sí |
| media | unverified_claim | `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | Resultados de clientes sin cifras ni nombres ('report remarkable decreases in electrical consumption'). | «report remarkable decreases in electrical consumption» | sí |
| media | unverified_claim | `/en/como-se-mejora-un-transformador-con-tecnicas-expertas/` | 'Certified service structure' sin certificación citada. | «certified service structure» | sí |
| media | unverified_claim | `/en/como-se-fabrica-un-transformador-proceso-y-calidad-europea/` | Presencia operativa en varios países europeos sin concretar (en otras páginas solo se dice 'más de 30 países'). | «operational presence in several European countries» | sí |
| media | unverified_claim | `/en/aplicaciones-de-los-transformadores-en-la-industria-actual/` | Cumplimiento 'riguroso' de normas internacionales sin citar normas. | «rigorous compliance with international standards» | sí |
| media | unverified_claim | `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | Ensayos térmicos, dieléctricos y electromagnéticos 'superados' sin informe. | «passed high-level thermal, dielectric and electromagnetic tests» | sí |
| media | unverified_claim | `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | Cita ISO genérica sin número ni certificado. | «rigorous compliance with ISO standards» | sí |
| media | unverified_claim | `/en/materiales-de-un-transformador-clave-en-su-rendimiento/` | Sectores de aplicación (minería, química) no respaldados por referencias. | «advanced manufacturing, chemical industry, mining or energy distribution» | sí |
| media | unverified_claim | `/en/para-que-sirve-un-transformador-descubre-su-funcion-clave/` | Servicio de atención que acompaña 'desde el concepto hasta su implementación final' no documentado. | «from concept to final implementation» | sí |
| baja | unverified_claim | `/en/torivac-company/` | 'Solving the demands of large companies' sin nombrar clientes ni casos. | «60 years solving the demands of large companies.» | sí |

### 8.8 SEO, accesibilidad y frescura (103)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| alta | seo | `/en/` | El <link rel="canonical"> de la home EN apunta a la home alemana (/de/); og:url y WebPage.url del JSON-LD también. Hasta que se corrija, Google puede indexar la versión DE en lugar de la EN. Ya registrado en HALLAZGOS.md (#1 y #11). | «https://grupotorivac.com/de/» | no |
| alta | seo | `/en/contact/` | El <link rel="canonical"> de /en/contact/ apunta a la página de contacto alemana (/de/kontakt-us/). | «https://grupotorivac.com/de/kontakt-us/» | no |
| alta | seo | `/en/el-variador-de-tension-y-sus-funciones/` | El canonical y og:url apuntan a https://grupotorivac.com/el-variador-de-tension-y-sus-funciones/ (sin /en/), una URL que no está en el sitemap (el sitemap lista la /en/) ni en la REST ES: la entrada EN se declara duplicado de una página ES que no existe. | «https://grupotorivac.com/el-variador-de-tension-y-sus-funciones/» | no |
| media | accessibility | `/en/` | Los tres CTA se llaman igual ('More Information') y llevan a destinos distintos; fuera de contexto no describen su función. En ES cada CTA tiene un texto propio. | «More Information» | no |
| media | accessibility | `/en/` | Alts sin significado o con nombre de archivo en las fotos del hero y los carruseles ('transo', '_B7T4306', 'DOBLE-MOTORIZADO', 'A_Medida02', '4Z0A9179', 'convertidor1-1-1024x1024', 'Adobe Express - file'). | «transo» | sí |
| media | accessibility | `/en/` | Los 10 iconos de familia y la imagen decorativa 'disipador.jpg' tienen alt vacío (11 imágenes); en los iconos es aceptable porque el enlace ya tiene texto, pero conviene confirmar que son decorativos. | «https://grupotorivac.com/wp-content/uploads/2022/04/disipador.jpg» | sí |
| media | accessibility | 22 piezas (todas las entradas del blog o casi: ver `quality_flags`) | El formulario de contacto del pie (WPForms 16204) no tiene etiquetas <label> en nombre, correo ni mensaje: solo placeholders ('Name', 'E-mail', 'Message'), que no sustituyen a una etiqueta accesible; el campo honeypot trae una etiqueta vacía. La versión ES del pie (14511) sí tiene etiquetas. | [campos sin <label>] | no |
| media | outdated | `/en/` | La home EN (2026-03-13) es 215 días más antigua que la ES (2026-10-14). El texto visible coincide bloque a bloque, pero las imágenes no se actualizaron (ES usa WebP optimizados). | [modified anterior al de ES] | no |
| media | outdated | `/en/entrepreneurial-projects/` | La EN es 35 días más antigua que la ES y conserva imágenes anteriores. | [modified anterior al de ES] | no |
| media | outdated | `/en/politica-de-cookies/` | La página EN (2022-12-16) es 2,2 años más antigua que la ES (2025-02-11). | [modified anterior al de ES] | no |
| media | seo | `/en/` | El <title> es solo 'Torivac' (sin palabra clave descriptiva). | «Torivac» | sí |
| media | seo | `/en/` | JSON-LD de la home EN: WebSite.description sigue en español y con errata ('variados de tensión'), y WebSite.url y el SearchAction apuntan a la raíz española (https://grupotorivac.com/?s=...). | «Especializados en diseño y fabricación de variados de tensión» | sí |
| media | seo | `/en/torivac-company/` | Meta description sin resolver: el valor es el literal '%' (variable de Yoast vacía). | «%» | sí |
| media | seo | `/en/torivac-products/` | Meta description sin resolver ('%') y sin H1 (el primer encabezado es un H3). | «%» | sí |
| media | seo | `/en/entrepreneurial-projects/` | Meta description sin resolver ('%'). | «%» | sí |
| media | seo | `/en/blog/` | Meta description sin resolver ('%') y sin H1; la primera imagen no tiene alt. | «%» | sí |
| media | seo | `/en/contact/` | Meta description sin resolver ('%'); no hay H1 (el primer encabezado es un H2). | «%» | sí |
| media | seo | `/en/privacy-policy/` | Meta description '%'; la página no tiene H1 (el título visible es un H2). | «%» | sí |
| media | seo | `/en/politica-de-cookies/` | El canonical de /en/politica-de-cookies/ apunta a la versión española (/politica-de-cookies/) y el índice de páginas registra la URL española como URL de la pieza EN. | «https://grupotorivac.com/politica-de-cookies/» | no |
| media | seo | `/en/declaracion-de-accesibilidad/` | Meta description '%'; la página no tiene H1. | «%» | sí |
| media | seo | 22 piezas (todas las entradas del blog o casi: ver `quality_flags`) | La página no tiene <h1>: el título visible es un H2. | [sin <h1>] | sí |
| media | seo | `/en/fallos-comunes-en-transformadores-y-sus-soluciones-efectivas/` | Palabra clave repetida de forma mecánica en titulares y cuerpo ('common transformer failures and their solutions'). | «common transformer failures and their solutions» | sí |
| media | seo | `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | El título SEO ('Torivac consolidates strategic alliances in europe during coiltech deutschland 2025') difiere del H2 ('...consolidates its leadership in the electricity sector...') y del slug. | «Torivac consolidates strategic alliances in europe during coiltech deutschland…» | sí |
| media | seo | `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Sin meta description en Yoast y slug con sufijo '-2' (duplicado). | [meta description ausente] | sí |
| media | seo | `/en/estabilizadores-de-tension-con-cobre/` | El título SEO es 'Copper voltage stabilizers \| Torivac Torivac.' (marca duplicada y punto final). | «Copper voltage stabilizers \| Torivac Torivac.» | no |
| media | seo | `/en/estabilizadores-de-tension/` | El título SEO ('Voltage stabilizers') es distinto del H2 ('Voltage stabilizers ensure stable supply and cost reduction') y del slug. | «Voltage stabilizers ensure stable supply and cost reduction» | sí |
| media | seo | `/en/carrito/` | La página es noindex y a la vez figura en el sitemap de Yoast (contradicción; en ES ocurre igual con /confirmar/). | [noindex y en sitemap] | sí |
| media | seo | `/en/mi-cuenta/` | La página es noindex y a la vez figura en el sitemap de Yoast (contradicción). | [noindex y en sitemap] | - |
| media | seo | `/en/tienda/` | Página vacía e indexable ('index, follow') con título en español 'Tienda - Torivac'; además figura en el sitemap de Yoast. | «Tienda - Torivac» | no |
| baja | accessibility | `/en/torivac-company/` | Las 4 imágenes (empresa, misión, visión, valores) tienen alt vacío. | «https://grupotorivac.com/wp-content/uploads/2022/04/mision.png» | sí |
| baja | accessibility | `/en/entrepreneurial-projects/` | Alts que son nombres de archivo ('transformador-serie-tci.png', 'fa300a', 'convertidor1-1-1024x1024', 'Adobe Express - file') o palabras en español ('resistencia'). | «transformador-serie-tci.png» | no |
| baja | accessibility | `/en/normativas-sobre-transformadores-electricos-en-europa/`, `/en/mantenimiento-de-transformadores-electricos/`, `/en/como-extender-la-vida-util-de-un-transformador/` y 11 más (14 piezas) | La única imagen de contenido tiene alt vacío. | «Transformador_normativas-internacionales.jpg» | sí |
| baja | accessibility | `/en/torivac-consolida-su-liderazgo-en-el-sector-electrico-tras-su-participacion-en-coiltech-deutschland-2025/` | Única imagen sin alt y con nombre de fichero de herramienta de reescalado ('upscalemedia-transformed'). | «upscalemedia-transformed.jpeg» | sí |
| baja | accessibility | `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | Las 3 imágenes no tienen alt; una foto aparece dos veces (original y recorte 1630x860) con nombre de cámara (1000067540). | «1000067540-1630x860.jpg» | sí |
| baja | accessibility | `/en/torivac-en-matelec-2024-explorando-el-mercado-y-reforzando-conexiones-2/` | El enlace 'here' hacia la web no describe su destino. | «https://grupotorivac.com/en/ / here» | sí |
| baja | accessibility | `/en/torivac-en-beyond-catalonia/` | El alt es una frase de 150 caracteres que parece texto SEO y no describe la imagen. | «Torivac at Beyond Catalonia, we concretize alliances and expansion strategies» | sí |
| baja | accessibility | `/en/estabilizadores-de-tension-con-cobre/` | El alt es una frase promocional en minúscula que no describe la imagen ('reduce operating costs in your business...'). | «reduce operating costs in your business with Torivac voltage stabilizers» | sí |
| baja | accessibility | `/en/estabilizadores-de-tension/` | El alt es una frase en minúscula que no describe la imagen ('we manufacture voltage stabilizers to avoid surges and dips...'). | «we manufacture voltage stabilizers to avoid surges and dips» | sí |
| baja | accessibility | `/en/descargadores-de-bateria/` | Nombre de imagen con restos de PageSpeed ('xbancos-de-carga.jpg.pagespeed.ic._FgzNCz6tC.jpg') y alt largo promocional. | «xbancos-de-carga.jpg.pagespeed.ic._FgzNCz6tC.jpg» | sí |
| baja | accessibility | `/en/el-variador-de-tension-y-sus-funciones/` | El enlace 'assist you!' está partido en dos nodos y su texto no describe el destino ('contact'). | «assist you!» | no |
| baja | accessibility | `/en/la-importancia-del-transformador-toroidal-en-la-industria/` | El alt de la imagen ('importance of the toroidal transformer') repite el título; en ES está en alemán. | «importance of the toroidal transformer» | no |
| baja | seo | `/en/blog/` | La página no tiene encabezado propio: el único H2 es el título de la primera tarjeta. | [sin <h1>] | sí |
| baja | seo | `/en/politica-de-cookies/` | Meta description '%'; sin H1 (el título visible es un H2); el extractor HTML solo recoge el pie. | «%» | sí |
| baja | seo | `/en/eficiencia-de-los-transformadores-clave-en-europa/` | La meta description afirma 'the European leader' sin respaldo. | «Torivac, the European leader» | sí |
| baja | seo | `/en/carrito/` | Título 'Carrito - Torivac' y slug /en/carrito/ en español. | «Carrito - Torivac» | no |
| baja | seo | `/en/mi-cuenta/` | Título 'Mi cuenta - Torivac' y slug /en/mi-cuenta/ en español. | «Mi cuenta - Torivac» | no |
| baja | seo | `/en/tienda/` | Su URL EN figura en el sitemap de Yoast aunque no tiene contenido. | [URL en sitemap] | - |
| baja | seo | `/en/category/uncategorized/` | Archivo vacío e indexable ('index, follow') sin utilidad para el usuario. | «Uncategorized - Torivac» | sí |

### 8.9 Legal, formularios y UX (10)

| Gravedad | Tipo | Pieza | Hallazgo | Evidencia | ES |
|---|---|---|---|---|---|
| alta | legal | `/en/privacy-policy/` | Faltan plazos concretos de conservación, destinatarios/encargados (Google reCAPTCHA, Analytics, hosting), derecho a reclamar ante la autoridad de control y bases por finalidad; menciona 'Financial data' aunque el sitio no vende. Revisar con asesoría legal. | «Financial data, if applicable.» | sí |
| alta | legal | `/en/politica-de-cookies/` | Sin inventario de cookies (nombre, finalidad, duración, proveedor): el sitio carga Google Analytics 4 (G-QXLKHV4Y7X), Google Tag Manager (GTM-K93FKL89), reCAPTCHA y el banner Complianz. | «Access to this Web Site may involve the use of cookies.» | sí |
| media | legal | `/en/` | La casilla de consentimiento dice 'I have read and accept the Legal Notice' (ES: política de privacidad), no enlaza a ningún documento y no existe aviso legal en inglés. Un formulario que recoge datos debe remitir a la política de privacidad. | «I have read and accept the Legal Notice» | no |
| media | legal | `/en/contact/` | La casilla de consentimiento dice 'I have read and accept the Legal Notice' (ES: política de privacidad) y no enlaza a ningún documento; no hay aviso legal en inglés. | «I have read and accept the Legal Notice» | no |
| media | legal | `/en/privacy-policy/` | Remite a una sección 'Use of Cookies' 'below' que no existe en el texto. | «described in the “Use of Cookies” section below» | sí |
| media | legal | `/en/politica-de-cookies/` | Texto de un generador gratuito de terceros con fecha 11/02/2025, ambigua en inglés (11 de febrero o 2 de noviembre). | «on 11/02/2025» | no |
| media | legal | `/en/declaracion-de-accesibilidad/` | Plantilla de generador gratuito del sector público (habla de 'this Unit' y del RD 1112/2018); comprobar su aplicabilidad a una empresa privada. | «such as images, interactive maps» | sí |
| media | ux | `/en/contact/` | Teléfono y correo son texto plano: no hay enlaces tel: ni mailto: en ninguna página EN. | [0 enlaces tel:/mailto:] | sí |
| baja | ux | `/en/torivac-products/` | Restos de interfaz en el texto: 'Torivac-Products' y '×' (cierre de modal). | «Torivac-Products» | sí |
| baja | ux | `/en/blog/` | El contador 'Do you like it?' es interfaz del tema (inglés también en ES). | «Do you like it?» | sí |

### 8.10 Relleno tipo Lorem ipsum

No hay ninguno. Se buscaron 'lorem ipsum', 'dolor sit amet', 'sample page', 'hello world', 'coming soon', 'texto de ejemplo' y similares en el texto visible, el HTML y la REST de las 37 piezas: 0 resultados en texto visible y 0 en HTML/REST. Los únicos marcadores sin resolver son `%` (12 meta description), `correodelcliente` (privacidad) y las etiquetas técnicas del formulario.

## 9. Auditoría del borrador

`en.json` se generó con un script a partir de las fuentes y de anotaciones manuales. Antes de darlo por bueno se contrastó con los datos en bruto. Comprobaciones hechas:

- El `full_text` de las 30 piezas de contenido (todas salvo la política de cookies y las 6 técnicas) coincide carácter a carácter con el texto del análisis tras normalizar espacios; y palabra a palabra con el cuerpo de la API REST en 27 de 30 (las 3 diferencias son el aviso `Please enable JavaScript...`, que la REST trae duplicado en portada y contacto, y los números 1, 2 y 3 de la paginación del blog).
- Las 278 evidencias de `quality_flags` se encontraron en la fuente indicada (278 verificadas, 0 no verificadas); los 184 `key_facts` están en el texto, o en el HTML o los enlaces cuando son datos derivados (0 sin verificar).
- Comparación EN-ES por líneas, frases y números de las piezas con original: mismas líneas y mismas cifras, con tres diferencias de frase en entradas (descargadores, cobre y normativas) que son uniones o divisiones de oraciones sin cambio de sentido.
- Las divergencias de traducción ('processors', 'millions of dollars', 'European Green Pact', 'drives', 'load benches', 'shocks') se contrastaron una a una con la frase ES alineada (`also_in_es = no`); 'technified adaptability' y 'technical rigidity' resultaron ser calcos fieles del ES y no se marcan como error de EN.
- Datos de contacto, NIF, financiación ICEX/FEDER, JSON-LD, identificadores de analítica, banner de cookies, listado de URL EN en los sitemaps y catálogo `Torivac_2024_EN.pdf` (terminología, pp. 12-13) contrastados con el HTML, la REST, los sitemaps y el texto del PDF.
- Búsqueda de enlaces `tel:` y `mailto:`, redes sociales, horarios y texto de relleno en los 194 HTML EN.

Correcciones aplicadas al borrador:

- Frescura EN/ES: se asumió que la EN iría por detrás de la ES; los datos dicen lo contrario en las entradas (EN re-guardada el 2026-03-23, ES en dic. 2025: la EN va 84-97 días por delante) y solo la portada, proyectos y la política de cookies están desactualizadas.
- 'technified adaptability' y 'technical rigidity' se comprobaron contra el original ES: son calcos fieles, no errores propios de la traducción, y no se marcan como específicos de EN.
- 'processors' (2 entradas), 'millions of dollars' (2), 'European Green Pact' (1), 'load benches', 'Toroidal shocks', 'Single Phase Inverters' y 'variable speed drives' se contrastaron con el texto ES: son divergencias de la traducción (also_in_es = false).
- HALLAZGOS.md #10 sitúa un aviso legal en '/en/aviso-legal-2/': la URL no existe en ninguna fuente EN; solo existe el aviso legal ES (y DE).
- La política de cookies EN sí existe (/en/politica-de-cookies/, REST id 15830) aunque es.json y el índice de páginas la registran con la URL española; el HTML cosechado solo contiene el pie y el canonical apunta a ES.
- La entrada de finalizar compra (REST id 11514) no se pudo leer del HTML cosechado (devuelve el carrito); se inventaría desde la REST.

## 10. Huecos y preguntas para el cliente

- Entrada EN-only id 8196 'What is a Voltage Variator?' (slug 'el-variador-de-tension-y-sus-funciones', 2024-09-19): no tiene original ES ni traducción FR/DE (22 entradas EN frente a 21 en ES/FR/DE); está asignada a la categoría ES id 443, por eso la categoría EN 'blog' cuenta 21. Confirmar con el cliente si hubo un original en español despublicado.
- Calidad real de la traducción: las fuentes no indican si el texto EN es traducción automática de WPML o revisada por una persona. 'translation_quality' es una valoración editorial inferida del texto y su comparación con ES, no un estado de WPML.
- Aviso legal EN: no existe (ni REST, ni sitemap, ni hreflang). El ES solo tiene traducción DE. docs/01-analisis/HALLAZGOS.md #10 cita '/en/aviso-legal-2/', que no consta en ninguna fuente; pendiente crear el aviso legal EN con el titular completo.
- Razón social completa y datos registrales: el titular está vacío en la política de privacidad EN ('is held by: , with NIF: B60784584'); la denominación 'TORIVAC GROUP' es traducción del ES 'GRUPO TORIVAC'.
- Correo de destino de los formularios EN (16157 y 16204): no consta en las fuentes (WPForms no expone notificaciones); solo info@torivac.com. Tampoco consta si las notificaciones llegan al mismo buzón que las de ES.
- Aviso de financiación ICEX-Next/FEDER: ausente en el pie de las 194 páginas EN (presente en 186 de 208 ES). No se sabe si es una omisión o si el cliente lo considera aplicable solo a ES.
- Banner de cookies EN: sus textos están en español pero no hay captura del banner abierto en data/raw/screens para ver cómo se muestra; los enlaces se rellenan en ejecución (complianz.page_links).
- Blog EN: solo se cosechó la primera página del índice (10 de 22 entradas; /en/blog/page/2/ y /en/blog/page/3/ no están en los datos); las 22 entradas proceden de la API REST. No hay fecha visible en el cuerpo de las entradas.
- Enlaces rotos aparentes (no comprobados por red): /aviso-legal/ (pie antiguo, 194 páginas) y /en/contacto/ (entrada EN-only). El criterio es que no constan en sitemap, REST ni índice de páginas.
- Verificación externa pendiente (sin red): fechas y lugares de Coiltech Deutschland 2025, Matelec 2024 y Beyond Catalonia; referencias normativas citadas (EN 50588-1, Reglamento (UE) 2019/1783, 'directiva' Ecodesign); URL de la política de cookies de redes sociales.
- Certificaciones de empresa (ISO u otras), servicios de mantenimiento, reparación, modernización, garantía extendida y descargadores de batería: afirmados en entradas EN (igual que en ES), sin respaldo en el resto del sitio ni en el catálogo; pendientes de confirmar con el cliente.
- Recuento de familias de producto: Voltage variators 12 en EN frente a 15 en ES (3 fichas sin traducir) y falta la subcategoría 'AC power supplies' en el árbol EN; el detalle por producto se analiza en el fichero de productos.
- Horarios de atención y perfil de LinkedIn u otras redes: no constan en ninguna página EN (como en ES).
- Páginas de WooCommerce EN (carrito, finalizar compra, mi cuenta, tienda): no hay capturas EN en data/raw/screens; el HTML de /en/finalizar-compra/ devuelve la plantilla del carrito.
- La política de cookies ES (analizada en es.json) dice 'Sin traducciones en EN/FR/DE en los datos': en realidad existe /en/politica-de-cookies/ (REST id 15830, modificada el 2022-12-16); el HTML cosechado solo contiene el pie y el canonical apunta a la versión ES.

Preguntas que desbloquean la migración:

1. ¿El texto EN se tradujo con WPML (automático) o lo revisó una persona? Si es automático, ¿se acepta rehacerlo con un glosario fijo (variador de tensión = 'voltage variator')?
2. ¿Qué variante de inglés debe usar la web nueva (en-GB o en-US) y qué formato de fecha?
3. ¿Se mantienen en EN las entradas que citan servicios y certificaciones no documentados y las comparativas con fabricantes chinos? Se recomienda reescribirlas o dejarlas como propuesta en el panel de admin.
4. ¿Existió una entrada original en español de 'El variador de tensión y sus funciones'? El artículo EN-only es el más técnico y se propone conservarlo y traducirlo a ES/FR/DE.
5. ¿El aviso de ICEX-Next/FEDER debe mostrarse también en las versiones EN, FR y DE?
6. ¿Cuál es la razón social completa para el aviso legal y la política de privacidad EN? ¿A qué correo deben llegar los formularios EN?

## 11. Cómo usar `en.json`

- `items[]`: una pieza por elemento. Campos principales: `type` (page, post u other), `id`, `url`, `canonical_url`, `slug`, `title`, `seo_title`, `h1` y `h1_visual`, `date`, `modified`, `purpose`, `sections[{heading, summary, key_facts[]}]`, `full_text` (íntegro y sin HTML, para migrar), `ctas`, `images[{src, alt, alt_issue, role}]`, `pdf_links`, `internal_links`, `external_links`, `forms`, `translation_of_es`, `translation_quality` y `translation_quality_notes`, `vs_es`, `sitemap_yoast`, `migration{decision, notes}`, `quality_flags[{severity, type, detail, evidence, where, also_in_es, verified}]`, `notes` y `source`.
- `translation_quality`: **ok** = texto íntegro en inglés y fiel a ES, solo con defectos heredados o cosméticos; **parcial** = cuerpo traducido pero con cadenas en otro idioma (etiquetas, meta description, alt, interfaz); **automática_sospechosa** = al menos un error que cambia el sentido o un término técnico equivocado (revisar con glosario antes de reutilizar); **sin_traducir** = contenido en español; **n/a** = sin texto.
- `vs_es`: comparación con la pieza ES (diferencia de `modified`, líneas de texto, cadenas en español dentro del inglés, secciones ausentes o desactualizadas). `company_facts_vs_es`: datos de empresa con la diferencia frente a ES. `legal_pages[]`: texto íntegro de las tres páginas legales y la nota del aviso legal inexistente. `site_chrome`: cabecera, pie y banner. `cross_findings`, `stats`, `gaps`, `questions_for_client`, `field_notes` y `audit`.
- Para migrar el texto de una pieza: usar `full_text` y aplicar las correcciones de `quality_flags` de tipo `typo`, `grammar`, `style`, `translation` y `terminology`. En la portada, Contacto y las entradas hay que descartar el ruido del formulario (`Name`, `Correo`, `Mensaje`, el texto del honeypot y `Please enable JavaScript...`).
- El glosario de términos (variador de tensión = 'voltage variator', autotransformador variable = 'variable autotransformer', estabilizador = 'voltage stabilizer') debe fijarse antes de reutilizar cualquier texto EN; la referencia más fiable es el catálogo `Torivac_2024_EN.pdf`.
