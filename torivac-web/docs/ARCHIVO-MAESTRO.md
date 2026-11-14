# Archivo maestro · Webs estáticas multilingües con panel de gestión

**Cómo construir una web como la de Torivac: segura, accesible, traducida, adaptable y con paneles internos de gestión.**

Basado en `torivac-web` (commit `2295644`, 10 de noviembre de 2026). Escrito para una persona y para Claude Code.

## 0. Cómo usar este archivo

Este documento es el manual de oficio que salió de construir la web de Torivac. Tiene tres usos:

1. **Leerlo antes de planificar** un proyecto nuevo: las secciones 1 a 5 dicen qué se construye, con qué reglas y en qué orden.
2. **Copiar la sección 20 («Prompt maestro»)** como `CLAUDE.md` del repositorio nuevo, para que cada sesión de Claude Code arranque con las reglas.
3. **Usar las secciones 14 (checklist de «terminado») y 18 (cuestionario de arranque)** en cada proyecto: la primera para no entregar a medias, la segunda para no repetir los errores de Torivac.

Convenciones de lectura:

- Las tablas de requisitos siguen el esquema **Requisito → cómo se implementa → cómo se verifica**. Un requisito sin verificación no cuenta como hecho.
- Las rutas son relativas a `torivac-web/`.
- **«(no verificado)»** marca lo que se leyó en el código o en la documentación pero no se comprobó ejecutándolo.
- Si un documento y el código se contradicen, **manda el código** (el apéndice A lista las discrepancias conocidas).
- Esto **no es una plantilla para clonar sin tocar nada**. El generador, el backend y los paneles se reutilizan casi tal cual; el catálogo, la marca y los textos no (sección 16).

## 1. Qué se construye

Una web **estática** (HTML, CSS y JavaScript sin framework) generada a partir de datos, en varios idiomas, con un **backend pequeño sin base de datos** para formularios, pedidos, precios y acceso, y un **panel `/admin/`** con roles. Se despliega en un hosting compartido con Apache y PHP (cPanel o Plesk); existe un Worker de Cloudflare equivalente como alternativa.

Cifras de la web de Torivac, para dar escala:

| Concepto | Valor |
|---|---|
| Páginas generadas | unas 770 (758 recorridas por la prueba de UX) |
| Idiomas | 4: castellano en la raíz, `/en/`, `/fr/`, `/de/` |
| Aspectos visuales | 3 (`ficha`, `clasico`, `original`) con un solo selector |
| Precios | 336 referencias, con tramos por cantidad y 4 categorías de cliente |
| Backends | 2 con un mismo contrato: PHP (6.647 comprobaciones en la última pasada) y Worker (247 pruebas) |
| Paneles | 3 roles, 12 vistas para el equipo técnico |
| Pruebas de punta a punta | `scripts/qa-all.sh`: 43 pasos (34 con `--rapido`) |
| Código documentado | 230 de 230 archivos con cabecera; 2.294 de 2.294 funciones descritas |

## 2. Reglas inquebrantables

Estas doce reglas son lo que más trabajo ahorró. Se copian tal cual al `CLAUDE.md` del proyecto nuevo (sección 20).

1. **No se toca la web original.** Solo lecturas (`GET`). Las pruebas van a un subdominio con `noindex`. El cambio de DNS es el último paso.
2. **No se inventa nada.** Todo dato sale de una fuente con su archivo y página. Lo dudoso va a **propuestas** y no se publica hasta que una persona lo aprueba.
3. **Fidelidad de textos.** La web no traduce ni reformula el contenido original. Los textos de interfaz nuevos se escriben en un único archivo y se listan para que una persona nativa los valide.
4. **Salida estática y progresiva.** JavaScript vanilla; la web funciona sin JavaScript.
5. **Un contrato, dos implementaciones.** Si hay dos backends (PHP y Worker), primero se escribe el contrato en `docs/` y los mismos guiones de navegador se ejecutan contra los dos. Cualquier cambio de ruta, mensaje o regla se hace en ambos.
6. **El servidor decide.** Rol, precio, categoría y validación se calculan en el servidor y se releen en cada petición. El navegador solo pinta.
7. **Se escapa todo.** Cualquier dato que venga de una persona o del API se escapa al pintarlo. Los formularios aceptan solo texto plano. La CSP no permite scripts en línea.
8. **Los secretos no entran en el repositorio** y la configuración insegura **falla cerrada** (si falta un secreto, nadie entra).
9. **Colores y tamaños solo con tokens CSS.** Nunca valores sueltos en los componentes.
10. **Código documentado.** Cada archivo lleva cabecera y cada función una descripción; el índice se genera y la prueba falla si falta una.
11. **Sin prueba, no está hecho.** Cada requisito tiene un «criterio de hecho» y un script que lo comprueba.
12. **Cada sesión termina con un commit** y la documentación al día. Los puntos de control se marcan `[en curso]`.

## 3. Arquitectura de referencia

```
data/catalog/*.json     contenido de origen en los 4 idiomas, ajustes SEO, menús, propuestas
site/build.mjs          generador: datos → dist/ (HTML, sitemap, llms.txt, robots, .htaccess)
site/lib/               i18n, render, seo, hosting, themes, cookies, google
site/templates.mjs      plantillas (layout, SEO, héroe, fichas, genérica)
site/assets/{css,js}    tokens, capas por aspecto, app.js, presupuesto, paneles admin-*.js
shared/                 código común JavaScript ↔ PHP con casos compartidos (fixtures)
backend-php/api/        API PHP 7.4+ sin base de datos (lib/*.php, tools/*.php, tests/)
workers/api/            Worker de Cloudflare con el mismo contrato (almacén KV)
scripts/                cosecha y limpieza de datos, pruebas qa-*.mjs, empaquetado
docs/                   contratos, guías de despliegue, índice de código
ci/                     plantillas de CI y de despliegue (a copiar a .github/workflows/)
```

**Flujo de datos.** Origen (web antigua, PDF, hojas) → `harvest.mjs` → `prepare.py` → `build_catalog.py` → `data/catalog/*.json` → `site/build.mjs` → `dist/` → `package_cpanel.py` → `.zip` verificado.

**Backend.** Un `Router` único. El almacén es JSON en una carpeta **fuera de la web** (PHP) o KV (Worker). El mismo contrato se implementa dos veces porque el hosting final no estaba decidido; si se decide antes, conviene **un solo backend** (lección 6 de la sección 17).

**Panel.** Aplicación de una página en JavaScript vanilla con enrutado por `#vista/argumento`. La sesión es un token firmado que va como `Bearer` y vive en `sessionStorage`. El rol **no** va en el token: se lee del registro del usuario en cada petición.

**Aspectos visuales.** Todo el CSS va en una hoja con `@layer classic, ficha, original;`. El atributo `<html data-theme>` elige el aspecto; la capa posterior gana a la anterior sin importar la especificidad. El panel `/admin/` usa su propio CSS, sin capas.

## 4. Proceso de trabajo, por fases

Cada fase lleva un **criterio de hecho** y el script que lo comprueba. El orden importa: lo caro de corregir (roles, política de precios, hosting) se decide al principio.

| Fase | Qué se hace | Criterio de hecho |
|---|---|---|
| F0 Desbloqueo | Confirmar marca, dominio, hosting y accesos. Resolver el cuestionario de la sección 18. | Marca y dominio confirmados por escrito |
| F1 Análisis (solo lectura) | Cosechar la web original, inventariar, redactar `HALLAZGOS.md`, extraer tokens de diseño. Auditar la fiabilidad de cada fuente. | Inventario y hallazgos; ninguna escritura en el origen |
| F2 Catálogo limpio | Datos en JSON con diccionario de datos; lo dudoso a propuestas. | Validación del catálogo sin errores |
| F3 Esquema y función principal | Generador y la función clave del negocio (aquí, el presupuesto). | Prueba de la función con cálculo independiente |
| F4 Estética y UX | Tokens, aspectos, componentes. | `qa-theme` en verde |
| F5 QA de punta a punta | Recorrido completo con navegador real. | `smoke` y `qa-*` base |
| F6 Backend y datos dinámicos | API, almacén, correo. | Contrato escrito y pruebas del servidor |
| F7 Paneles con roles | Panel, roles y vistas. | `qa-admin-live` con cada rol |
| F8 Contacto y legales | Formularios, páginas legales. | `qa-live`; legales tal cual el original |
| F9 Control de UX y contenido | Recorrer todas las páginas frente al original. | `qa-ux` sin incidencias duras; `qa_content.py` |
| F10 Idioma | Detección y selector. | `qa-lang` |
| F11 Gráficos y accesibilidad | Piezas gráficas, axe. | `qa-art`, `qa-a11y` |
| F12 QA final y entrega | Demo y paquete. | `bash scripts/qa-all.sh` en verde |
| F13 Documentación | Índice de código y guías. | `gen_code_index.py --check` |
| F14 Revisión final | SEO/GEO, rendimiento, accesibilidad. | `seo_check.py`, `perf`, `qa-a11y` |
| F15 Despliegue | Paquete, `.htaccess`, `noindex` en pruebas, CI. | `package_cpanel.py` verifica y `qa-apache` en verde |
| Extensiones | Seguridad, blog, correo, Google, roles y precios, cada una con su contrato y su prueba. | Su propio `qa-*` |

## 5. Trabajo con agentes y control de versiones

- **Reparto.** El hilo principal escribe el **contrato**, la web, el panel y la prueba de navegador, y deja un commit `[en curso]`. Otros agentes implementan cada servidor por separado (en Torivac: Worker y PHP en paralelo). La integración final alinea diferencias, añade la sección de «Decisiones de implementación» al contrato y mete la prueba en `qa-all.sh`.
- **Revisión independiente.** Dos revisiones de seguridad sin contexto previo encontraron fallos reales (relé de correo, IP falsificable, sesiones sin revocar). Se planifican al cerrar cada bloque.
- **Límites de uso.** Los análisis largos con agentes se cortaron por límite de uso y se sustituyeron por **scripts deterministas** (`link_pdfs`, `contrast_pdfs`, `web_vs_pdf`, `enrich_catalog`). Conviene trabajos pequeños y commits frecuentes.
- **Commits.** Una rama de trabajo. Cada sesión termina con commit y push. Mensaje `torivac: <qué se hizo>` con viñetas y los trailers de coautoría. `dist/` y `data/raw` no se versionan. `ci/ci.yml` y `ci/deploy.yml` son plantillas que se copian a `.github/workflows/` de la raíz.
- **Empaquetado.** `package_cpanel.py` se niega a empaquetar producción con cambios sin commitear (`--allow-dirty` lo fuerza) y escribe la versión (commit) en `api/generated/build.json`.

## 6. Traducciones

**Modelo.** Español en la raíz y `/en/`, `/fr/`, `/de/`. Hay **dos fuentes distintas** y no se mezclan:

- **Contenido** (fichas, categorías, páginas, entradas, menús, pie): se copia **literal** de la web original en los cuatro idiomas a `data/catalog/*.json`, con claves por idioma. Nadie lo traduce: lo trae `harvest.mjs → prepare.py → build_catalog.py`.
- **Interfaz nueva** (botones, filtros, formularios, avisos): **un solo archivo**, `site/lib/i18n.mjs`, con `T = { clave: {es, en, fr, de} }` (156 claves) y la función `t(clave, lang)` (cae al castellano). Ningún texto de interfaz vive fuera de ese archivo.

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| Sin huecos de idioma | 156 claves × 4 idiomas en `i18n.mjs` | `node scripts/audit_i18n.mjs --check` (paso de `qa-all.sh`) |
| Fidelidad de textos | Los títulos y descripciones de respaldo usan **las palabras de la web original** de cada idioma, no textos propios | Revisión contra el original; `seo-overrides.json` |
| Textos nuevos a validar | `docs/TEXTOS-DE-INTERFAZ.md`, **generado**: por idioma, las claves cuyo texto no aparece literalmente en el corpus original; con glosario y tres pasos de validación | `audit_i18n.mjs --check` falla si el documento está desfasado |
| Rutas traducidas | Los *slugs* de páginas, productos y categorías son los de la web original; las páginas nuevas llevan slug propio por idioma (`/presupuesto/`, `/en/quote/`, `/fr/devis/`, `/de/angebot/`) | `seo_check.py` (hreflang recíproco, enlaces rotos) |
| Detección y selector | Manda la **elección manual**. Sin ella, en la primera visita y **solo desde una página en español**, una única redirección a la página equivalente. En `/en/`, `/fr/`, `/de/` solo un aviso (cambiar o mantener). `?nolang` lo desactiva. **Nunca dentro del panel** (`?embed=1`) | `scripts/qa-lang.mjs` (7 bloques) y `scripts/qa-customers.mjs` bloque 5b |
| Lo no traducido | `translation_status{lang}`; una ficha sin descripción en un idioma muestra el texto en español con un aviso, nunca una traducción automática | Panel *Contenido* (cobertura); propuestas `missing_translation` |
| Qué más se traduce | PDF del presupuesto (en el idioma del pedido), correo copia al solicitante, avisos de formulario, aviso de cookies y política de cookies, páginas 404 | `scripts/qa-quote.mjs` (4 idiomas, cálculo independiente, texto del PDF con `pdftotext`) |
| Lo que NO se traduce | El **panel** y los **errores del API** están solo en castellano; el correo al equipo va en castellano | Decisión documentada; la guía para clientes incluye un glosario |

**Cómo se añade un idioma:** `LANGS`, cada clave de `T`, `meta.json` y `build_catalog.py`.

## 7. SEO y GEO

Solo se generan con `--base` (producción). En el demo no hay *canonical* ni sitemap.

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| Un `<title>` útil | `fitTitle` (≤ 65 caracteres, «Nombre · Marca»); las fichas usan el `seo.title` original | `seo_check.py`: error si está vacío; aviso fuera de 10–65 |
| `meta description` | `metaDescription()`: válida si tiene ≥ 50 caracteres, recorte a 158 sin partir palabras; si no, el primer párrafo ≥ 60; si no, la descripción de la portada | `seo_check.py`: error si falta o es basura |
| Un solo H1 y jerarquía | La plantilla pone el H1; los H1 del contenido bajan de nivel. Los saltos se corrigen con `aria-level` (`headingOrder`) sin tocar el diseño | `seo_check.py` (H1 único = error; salto = aviso) |
| `canonical` y `hreflang` | Canónica propia; hreflang solo de los idiomas con traducción de esa página, más `x-default` | `seo_check.py` (recíproco, propio, destino) |
| Open Graph y Twitter | `og:title/description/image/url/locale`; imagen o logotipo de respaldo | `seo_check.py` |
| Datos estructurados | Un `@graph` JSON-LD por página: Organization, WebSite, WebPage/CollectionPage/ContactPage, BreadcrumbList, Product (**sin `offers`**), ItemList, BlogPosting. Solo datos que existen en el origen: sin precios inventados, reseñas ni valoraciones | `seo_check.py` (un bloque, tipos requeridos, `@id` únicos) |
| Sitemap | Todas las páginas indexables, con `xhtml:link` hreflang y `x-default` e `image:image` con *caption* | `seo_check.py` (faltas y sobras) |
| `llms.txt` y `llms-full.txt` | Cabecera de marca y, por idioma, páginas clave, productos y entradas; el completo trae el texto íntegro | `seo_check.py` (empieza por `#`) |
| `robots.txt` | Producción: `Allow /`, `Disallow /admin/ /api/`, `Sitemap:`. Pruebas: `Disallow: /` | `package_cpanel.py` y `qa-apache` |
| Entorno de pruebas fuera del índice | Presupuesto, 404, `/admin/` y todo `--staging`: `<meta robots noindex,nofollow>`, cabecera `X-Robots-Tag: noindex, nofollow, noarchive`, cinta visible, sin sitemap ni Google | `package_cpanel.py::verify`, `qa-apache` |
| Servidor | `.htaccess` generado: HTTPS, host único, 301 de URLs antiguas, URLs limpias, 410 a los sondeos de WordPress | `qa-apache.mjs` con Apache real |

`scripts/seo_check.py <dist> --base=…` sale con código 1 si hay errores. **Errores:** idioma distinto de la ruta, H1 ≠ 1, `title` vacío, descripción ausente o basura, canónica distinta de la URL, hreflang roto, falta algún `og:*`, `<img>` sin `alt`, JSON-LD incompleto, enlace interno roto, sitemap con faltas o sobras. **Avisos:** `title` fuera de 10–65, descripción > 160, salto de nivel, más de 3 imágenes con `alt` vacío, sin migas, `title` duplicado.

## 8. Seguridad

La seguridad se diseñó en capas y se revisó con **dos auditorías independientes**. Estos son los controles que existen hoy, dónde viven y cómo se comprueban.

### 8.1 Navegador y servidor web

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| Cabeceras de seguridad | `nosniff`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` sin cámara, micrófono, geolocalización ni pago, y `no-cache` en el HTML. Solo Apache (`mod_headers`), generado por `site/lib/hosting.mjs` | `scripts/qa-apache.mjs` con Apache real y PHP-FPM |
| CSP sin scripts en línea | `default-src 'self'`; `script-src 'self'` más el *hash* del único script de arranque; `frame-ancestors 'self'`; `object-src 'none'`. Los identificadores de Google van en `<script type="application/json">`. **Ojo:** `style-src` sí lleva `'unsafe-inline'` | `package_cpanel.py::check_csp` y `qa-package.mjs` (sin incumplimientos en consola) |
| HTTPS y host único | Redirección 301 a HTTPS, `www` ↔ sin `www` único, `Strict-Transport-Security` de 1 año en producción (300 s en pruebas), sin `includeSubDomains` ni `preload` | `qa-apache.mjs` (sin bucle tras un proxy) |
| CORS por lista | Mismo origen, sin `Origin` o `allowed_origins`; nunca `*`. Un origen ajeno recibe 403. Métodos `GET,POST,PUT,DELETE,OPTIONS` | Pruebas de PHP y del Worker; `qa-package.mjs` |
| Rutas sensibles cerradas | `api/.htaccess` solo deja pasar `index.php` y `page.php`; ocultos, `*.md`, `*.py`, `*.log` denegados; `Options -Indexes` | `qa-apache.mjs` (config, storage, copias → 401/403/404) |
| Sondeos de WordPress | `RedirectMatch 410` a `wp-login.php`, `xmlrpc.php`, `wp-admin/…`, `wp-content/plugins/…` sin llegar a PHP | `package_cpanel.py::check_wp_probes` (9 rutas cortadas, 11 legítimas intactas) |
| Caché sin versiones viejas | CSS y JS con `?v=<huella SHA-256 de 10 caracteres>`; el HTML `no-cache`; fuentes e imágenes 1 año | `package_cpanel.py::check_versions`, `scripts/qa-update.mjs` |
| Cookies y medición | Consent Mode v2 «básico»: todo `denied` por defecto, nada de Google se descarga hasta aceptar; «Rechazar» y «Aceptar» con el mismo peso; sin aviso en `?embed=1` | `scripts/qa-google.mjs` (con `--real` contra Google), `check_google` |

### 8.2 Acceso y sesiones

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| Sesión firmada y revocable | Token `base64url(payload).base64url(HMAC-SHA256)` con `sub`, `iat`, `exp` (24 h) y `sid`. El **rol no va en el token**; `sid` ata la sesión al registro (borrar y recrear no la resucita); *logout* invalida todos los tokens anteriores; comparación en tiempo constante | Pruebas `test_d4_*` (PHP) y «D4 · …» (Worker) |
| Secretos que fallan cerrados | `session_secret` ≥ 32 caracteres y sin «CAMBIA-ESTO» (si no, el acceso da 500 «Configuración insegura»); `admin_token` ≥ 32 y `cron_token` ≥ 24 (si no, quedan desactivados). `/api/health` solo lista **nombres** de claves con problemas | `test_d3_secret_minimum_lengths_fail_closed`; `qa-apache` |
| Contraseñas | PHP `password_hash` con *rehash* y un hash señuelo para igualar tiempos con usuarios inexistentes; Worker PBKDF2-SHA256 de 100.000 iteraciones. Política en altas y cambios: ≥ 12 y ≤ 1000 caracteres, sin la parte local del correo, sin empezar por palabras triviales, ≥ 5 caracteres distintos | `test_d3_password_policy_for_new_users` |
| Fuerza bruta | 5 fallos (visitante + cuenta) → bloqueo de **1 hora**; 15/h por visitante y 30/h por cuenta; mismo 429 exista o no el correo; una ráfaga paralela cuenta como un único bloqueo | `test_d3_login_limits_per_ip_and_per_account`; `qa-apache` («5 fallos → bloqueo de 1 hora») |
| Segundo factor por correo (solo PHP, solo managers) | Código de 6 cifras, 10 minutos, un uso, solo se guarda su HMAC; 5 intentos por código; dispositivo recordado 30 días con cookie `HttpOnly; SameSite=Strict` firmada; cuentas de confianza opcionales | `SecurityStepTest`; `scripts/qa-security-panel.mjs` (Chromium + Apache real) |
| Ataques repetidos | 3 bloqueos en 24 h → **un** correo al día y «protección reforzada» 7 días; desbloqueo desde el panel o con `tools/unlock.php` | `test_step_repeated_attacks_alert_once_and_require_a_code` |
| Registro de actividad | Un fichero por día, 2 MB, 180 días; nunca contraseñas ni códigos; el CSV neutraliza `= + - @`; solo managers | `test_step_audit_*`; `qa-security-panel` |
| Copias de seguridad | Semanal automática, 8 últimas, descarga con enlace firmado de 120 s; excluye límites, códigos, `config.php` y actividad; restaurar solo por línea de comandos | `test_step_backup_*`; `qa-apache` |
| IP real | `REMOTE_ADDR`; `X-Forwarded-For` solo si conecta un proxy de confianza; tras Cloudflare manda `CF-Connecting-IP`; IPv6 agrupada por /64 | `HostingTest::test_client_ip_behind_proxies`; `shared/ip-key.fixtures.json` |

### 8.3 Entrada y salida de datos

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| Formularios en texto plano | Contacto y pedido rechazan etiquetas, entidades, `javascript:`, plantillas, SQL, shell, rutas, ratio de símbolos > 0,2 y más de 2 enlaces. Límites: mensaje 1000, notas 500, empresa 120, nombre 80, teléfono 40, correo 254. **Una sola lógica** en `shared/plain-text.mjs`, portada a PHP | `scripts/test-plain-text.mjs`, `PlainTextTest` |
| Antispam | Campo señuelo `hp` y tiempo mínimo de relleno (1200 ms); con sesión no se exigen; CAPTCHA Turnstile opcional que falla cerrado | `SecurityOrdersTest`; `scripts/qa-captcha.mjs` |
| El servidor revalida todo | Precio recalculado con la hoja del servidor (ignora `price`, `unit` y `tier` del cuerpo salvo el equipo); referencias solo del catálogo; cantidad entera 1..1.000.000; ≤ 200 líneas; privacidad `true` | `test_order_flow_server_side_pricing`, `test_d7_prototype_names_are_not_valid_references` |
| Escapado de salida | Cada `admin-*.js` define `esc()`; el texto de personas va con `textContent`; solo el conversor del blog emite HTML, con lista cerrada de etiquetas y enlaces `https`/`http`/`mailto`/`tel` | `BlogMarkdownTest`, `scripts/test-blog-markdown.mjs` (20.000 entradas hostiles) |
| PDF adjunto | Base64 estricto, empieza por `%PDF-`, ≤ 4 MB; solo se valida la firma, no la estructura | `test_a1_pdf_is_validated_and_normalized` |
| Correo | La copia al cliente es texto fijo del servidor (4 idiomas), sin adjunto; topes por destinatario y por día; SMTP con certificado verificado y órdenes con saltos de línea rechazadas; los errores se tachan de claves | `test_a1_copy_to_customer_has_only_server_text_and_no_attachment`, `SmtpTest` |
| Errores y límites de entrada | Un 500 devuelve `{"ok":false,"error":"Error interno","id":"…"}` y el detalle va al registro; cuerpo máximo 6 MB; JSON ≤ 32 niveles; `.xlsx` ≤ 20 MB | `test_d6_*`; Worker «D6 · fuzz determinista: 800 peticiones» |
| Datos personales | Pedidos y mensajes caducan a **400 días**, actividad 180, histórico de precios 90; carpeta de datos fuera de la web; ficheros 0660 | `test_d10_*`, `qa-apache` |
| Secretos fuera del repo | `config.php` y `api/storage/` en `.gitignore`; `TORIVAC_<RUTA>` como variable de entorno; `wrangler secret put` en el Worker; escáner de 8 patrones | `python3 -I scripts/secret_scan.py` (primer paso de `qa-all.sh`) |
| Paquete con lista blanca | Dentro de `api/` solo entran `index.php`, `page.php`, `.htaccess`, `cron.php`, `config.sample.php`, `lib/*.php`, `tools/*.php` y JSON generados. Se prohíben `config.php`, pruebas, `storage`, precios y panel demo | `package_cpanel.py::verify`, `scripts/qa-package.mjs` |

### 8.4 Límites de uso

| Qué | Límite |
|---|---|
| Pedido por visitante | 8 cada 10 minutos; global 120 por hora |
| Contacto por visitante | 5 cada 10 minutos |
| Cliente con cuenta | 3 pedidos por ventana móvil de 24 horas |
| Copia de confirmación al cliente | 2 por destinatario y día; 150 al día en total |
| Reenviar un presupuesto (1 a 3 destinatarios) | 20 por hora y persona; 150 al día |
| Correo de prueba / IA de precios | 10 por hora / 15 cada 10 minutos, por usuario |
| Blog (solo PHP) | 600 guardados y 120 subidas por usuario y hora |

### 8.5 Límites conocidos de seguridad

- Las cabeceras y la CSP solo se generan como `.htaccess` (Apache/LiteSpeed). Con Cloudflare Pages o Worker no hay CSP (no verificado).
- `style-src 'unsafe-inline'`; HSTS sin `includeSubDomains`; sin COOP/CORP.
- El token de sesión vive en `sessionStorage`, no en una cookie `HttpOnly` (mitigado con CSP y escapado).
- El segundo factor es el correo (no TOTP ni *passkeys*); el bloqueo de una cuenta se puede provocar desde fuera (se arregla con «Desbloquear»).
- Las copias de seguridad están en el mismo servidor y llevan *hashes* de contraseñas y datos personales.
- `secret_scan.py` solo cubre 8 patrones y ficheros versionados (no Brevo, Turnstile ni contraseñas SMTP).
- Los topes por IP no frenan un ataque con muchas IP: conviene una regla de *Rate Limiting* de Cloudflare delante.
- Ni Plesk ni cPanel reales se han probado de principio a fin; el Worker no se ha desplegado en Cloudflare (no verificado).

## 9. Accesibilidad

**Objetivo: WCAG 2.1 nivel AA.** `scripts/qa-a11y.mjs` ejecuta axe-core con las etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `best-practice`. No se cubre WCAG 2.2.

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| Contraste AA | Tokens con valores medidos: tinta `#100404` sobre fondo (16,5:1), cobre de texto `#8f4a0d` (4,8 a 6,0:1), gris `#5a524d` (5,5 a 6,9:1), cobre sobre oscuro `#f0a259` (9,6:1) | axe `color-contrast`: 0 reglas serious o critical |
| Foco visible | Anillo doble de 3 px en el aspecto principal; invertido sobre fondos oscuros | Solo `qa-shop` (tarjeta enfocada con Tab). **No hay prueba general de foco** |
| Enlace para saltar | `<a class="skip" href="#content">` el primero del `<body>`; `<main id="content" tabindex="-1">`; en 4 idiomas | Sin prueba específica (no verificado) |
| Marcas de región | `header`, `nav[aria-label]`, `main`, `footer`; cajón del presupuesto con `role=dialog aria-modal`; avisos como `role=region` con `aria-label` | axe (`region`, `landmark-*`) |
| Encabezados | Un solo `<h1>`; `headingOrder()` evita saltos de más de un nivel con `aria-level` | `seo_check.py` |
| Imágenes | Decorativas con `alt=""`; iconos ≤ 160 px con `alt=""`; logotipo con `alt` | `seo_check.py` (todo `<img>` con `alt`); aviso `noname` de `qa-ux` |
| Formularios | `<label>` envolvente o `label[for]`; `autocomplete`; validación propia con `aria-invalid` y `aria-describedby` que enfoca el primer campo inválido; resultado en `role=status` con foco | `qa-a11y` analiza contacto y presupuesto **en estado de error**, en 4 idiomas y a 1440 y 390 px |
| Teclado | Escape cierra cajón, filtros y panel Original; cajón del presupuesto con trampa de foco y retorno del foco; botones de árbol con `aria-expanded` | `qa-theme`, `qa-shop`, `qa-lang`, `qa-art`, `qa-google` |
| Anuncios | `role=status` y `aria-live=polite` en toasts, contador de la tienda y resultado del envío | Indirecto (axe); sin prueba del texto anunciado |
| Movimiento reducido | Global en `base.css`: animaciones y transiciones casi nulas con `prefers-reduced-motion` | `scripts/qa-art.mjs` con `reducedMotion:'reduce'` |
| Idioma | `<html lang>` = idioma de la ruta; enlaces del selector con `lang`, `hreflang` y `aria-current` | `seo_check.py` (`html-lang` es error), `qa-lang` |
| Zonas con desplazamiento | `.tbl-wrap` con `tabindex=0 role=region aria-label` | axe (`scrollable-region-focusable`) |
| Sin JavaScript | Los controles solo-JS nacen `hidden`; la tienda lista todas las tarjetas con enlace | `qa-theme` y `qa-shop` con JavaScript desactivado |
| Zoom | `width=device-width,initial-scale=1` sin `maximum-scale`; tamaños en `rem` | Ninguna prueba: revisar a mano |

**Límites reales de accesibilidad** (leídos en el código, sin prueba que los cubra):

- El foco del aspecto Clásico es ámbar sobre claro: ≈ 1,6:1, por debajo del 3:1 de SC 1.4.11. axe no mide indicadores de foco.
- El cajón de filtros móvil no mueve el foco, no tiene `aria-expanded` ni trampa de foco; cerrado sigue siendo tabulable.
- El menú móvil lleva `aria-expanded`, pero Escape no lo cierra.
- El botón «subir» ignora `prefers-reduced-motion`.
- `aria-label="breadcrumb"` está fijo en inglés en los cuatro idiomas.
- Los fragmentos en español dentro de páginas traducidas no llevan `lang`.
- Los objetivos táctiles de `.btn.sm`, `.qty button`, `.icon-btn` y `.lang a` miden entre 30 y 38 px, menos de 44.
- El panel `/admin/` está **excluido** de `qa-a11y`; solo tiene axe en blog, seguridad, captcha y cookies.

**Revisión manual obligatoria** (ninguna prueba la cubre): foco visible con Tab en cada aspecto, zoom del 200 % y reflujo a 320 px, un lector de pantalla recorriendo el enlace de salto, el menú, el cajón y un formulario con error, objetivos táctiles en un móvil real, y el contraste de cualquier color nuevo.

## 10. Adaptabilidad y rendimiento

### 10.1 Adaptabilidad (responsive)

El enfoque es **desktop-first con `max-width`** (no *mobile-first*). Los componentes son fluidos: rejillas `repeat(auto-fill,minmax(236px|250px|300px,1fr))`, `clamp()` en títulos y `.container{width:min(100% - 2*s-5, 1240px)}`.

| Rango (px) | Qué cambia |
|---|---|
| ≤ 1340 | El menú pasa a botón «☰ Menú» (1341 a 1440, menú compacto) |
| ≤ 980 | Cajón de filtros, tiles de 2 columnas, presupuesto en 1 columna |
| ≤ 900 / ≤ 860 | Ficha de producto en 1 columna; paneles de contenido en 1 columna |
| ≤ 760 | La tabla de modelos pasa a **tarjetas** (`td::before{content:attr(data-label)}`), con `role` explícitos |
| ≤ 640 | Botón flotante del presupuesto solo icono más contador |
| ≤ 520 / ≤ 400 | Tiles pequeños; cabecera compacta |
| Panel | ≤ 860 shell de 1 columna; ≤ 1100 editor del blog |

- **Menú móvil:** el selector de idioma se queda siempre en la barra. El cajón del presupuesto mide `min(100vw,440px)`.
- **Tablas largas:** `.tbl-wrap{overflow-x:auto}`; en ≥ 761 px la primera y la última columna quedan fijas.
- **Imágenes:** 570 archivos `.webp`, `loading=lazy`, `decoding=async`, `width` y `height`. **No hay `srcset`** (una sola resolución más miniatura): mejora pendiente.
- **Palabras largas (alemán):** `hyphens:auto` y `overflow-wrap`.

| Qué se prueba | Dónde |
|---|---|
| 15 páginas × 5 anchos (390, 768, 1024, 1240, 1440) × 3 aspectos, sin desborde horizontal | `scripts/qa-theme.mjs` |
| Todas las páginas a 1440 y 390 px: sin peticiones externas, sin desborde, sin imágenes rotas ni deformadas, sin restos de código, sin errores de consola, sin identificadores duplicados | `scripts/qa-ux.mjs` (escritorio y `--mobile`) |
| Menú en 1241, 1300, 1341, 1366, 1400 y 1440 × 4 idiomas × 3 aspectos | `scripts/qa-shop.mjs` |
| Panel a 390 px en usuarios, actividad y ajustes | `scripts/qa-security-panel.mjs` |

### 10.2 Rendimiento

| Requisito | Cómo se implementa | Cómo se verifica |
|---|---|---|
| LCP | Precarga de la foto de la portada (`fetchpriority=high`), un único `.webp`; el segundo aspecto no la vuelve a pedir | `scripts/perf.mjs`: falla si el LCP > 2500 ms en móvil (390 px, CPU ×4, 1,6 Mbps, 150 ms) |
| Fuentes | Autoalojadas (woff2 con licencia OFL), `font-display:swap`, `unicode-range`, precarga de las de la primera pantalla; sin servicios externos | `qa-theme` (fuentes, foto única) |
| CSS | Una hoja con `@layer`; en producción se minifica y solo lleva las capas del aspecto elegido | `qa-theme` |
| JavaScript | Vanilla, sin framework. jsPDF y SheetJS solo se cargan en `/presupuesto/` | `perf.mjs` |
| Caché | Huella de contenido en CSS y JS; `.htaccess` con compresión y caché | `qa-update.mjs`, `qa-apache.mjs` |

**Resultado guardado (6 de noviembre, 8 páginas):** LCP de 1084 a 2072 ms, 266 a 465 KB y 12 a 22 peticiones. **Límites:** el CLS llega a 0,10 en la portada inglesa y 0,14 en `/presupuesto/` y **ninguna prueba lo vigila**; `catalog.js` pesa 376 KB y se carga en todas las páginas; los *scripts* son síncronos al final del `<body>`.
## 11. Paneles internos de gestión

El panel vive en `/admin/` (siempre `noindex`). `admin-live.js` es el panel con servidor; `admin.js` es solo la demo y no se publica en producción.

### 11.1 Roles

Los roles los decide **solo el servidor**, que los relee en cada petición. El JavaScript del navegador solo elige qué menús pintar.

| Rol (API) | Etiqueta | Quién es | Qué hace |
|---|---|---|---|
| `manager` | Manager | Equipo técnico | Todo: resumen, presupuestos recibidos, clientes, mensajes, precios (hoja, Excel, IA, categorías), propuestas, contenido, blog, usuarios, actividad, estadísticas y ajustes |
| `client` | **Propietario** | El dueño de la web | Nuevo presupuesto; todos los presupuestos recibidos (ver, editar, reenviar, PDF, sin IP ni error de correo); clientes; **precios: categorías, precio de cada producto, subir el Excel y «Actualizar ahora»**; lista de precios; estadísticas. Sin ajustes, Google, usuarios del equipo, copias ni IA de precios |
| `customer` | Cliente | Comprador con cuenta | Solo lectura: nuevo presupuesto (3 al día), sus presupuestos en versión reducida, y la lista con **su** categoría de precio. Nunca ve el nombre de su categoría |
| `reviewer` | **Revisor** | La persona que es a la vez comercial y traductora (una sola cuenta, creada desde *Usuarios*) | Solo «Contenido nuevo»: ve los borradores, propone cambios, acepta o descarta propuestas y **aprueba** (castellano como «comercial», idiomas como «traductor»). El servidor le niega todo lo demás (403). Solo existe en el servidor PHP; el Worker crea la cuenta y responde 501 a esa sección |
| (sin sesión) | Visitante | Cualquiera | Precios «Consultar», aproximados (≈) o de la categoría Normal, según un ajuste |

**Lección de nombres:** `client` se entendió al principio como «comprador» y era el dueño. Hoy se llama «Propietario» en la interfaz y se mantiene `client` en el API. Definir los roles y qué ve cada uno antes de construir.

### 11.2 Vistas del equipo técnico

`resumen` · `recibidos` (lista, búsqueda, filtros, detalle, edición con control de revisión, PDF en el idioma del pedido, reenvío a 3 destinatarios) · `clientes` (alta, categoría, contraseña, baja) · `mensajes` · `precios` (estado, «Actualizar ahora», subida de Excel o CSV con vista previa, instrucción a la IA, porcentajes de categorías, precio a visitantes, editor por producto) · `propuestas` (editar, probar en la página real, aplicar) · `contenido` (cobertura de traducción) · `blog` (editor con vista previa, SEO, imágenes, programar, traducciones) · `usuarios` · `actividad` · `estadisticas` (solo estructura, sin cifras inventadas) · `ajustes` (cuenta, copias, correo, Google, diagnóstico) · `lista` (precios de solo lectura) · `presupuestador` (la página del presupuesto incrustada con `?embed=1`).

### 11.3 Contrato de módulos y cómo añadir una vista

El patrón real, paso a paso:

1. Crear `site/assets/js/admin-<x>.js` como IIFE con `'use strict'` y cabecera `/** [ADMIN-X] … */`, que exponga `window.TV.AdminX = { view(ctx, arg) → Promise<string>, bind(root, ctx) }`.
2. El HTML lleva una raíz marcada `data-xx-root` y **todo** pasa por `esc()`.
3. `bind` engancha eventos delegados en `root` y **una sola vez** (patrón `bound === root`).
4. En `admin-live.js`: entrada en `NAV` por rol, `V.<id> = (s, arg) => TV.AdminX.view(PCTX, arg || '')` y, en `bind()`, la llamada a `TV.AdminX.bind`.
5. Añadir el `<script>` a la lista de `admin/index.html` en `site/build.mjs`.
6. Añadir las rutas en **los dos** backends (`Router.php` y `workers/api/src/index.js`) con la comprobación de rol en el servidor.
7. Pruebas: PHP, Worker y una sección en `scripts/qa-admin-live.mjs` (y con `--php`).
8. Documento de contrato y `gen_code_index.py`.

El contexto `ctx = { http(method, path, body), toast(msg), when(iso) }` más, según el módulo, `adminData()`, `session()`, `render()` y `relogin(msg)`. `http` **nunca rechaza**: devuelve `{ok:false, …}`, y un 401 cierra la sesión. El enrutador descarta las respuestas de vistas ya abandonadas (`renderSeq`).

### 11.4 Reglas de seguridad de los paneles

1. **Solo el servidor decide el rol** y lo relee en cada petición; borrar un usuario anula su sesión; un rol que llama a lo ajeno recibe 403 o 404.
2. **Escapar todo** lo que viene del API o de personas.
3. El servidor **revalida todo** (reprecia los pedidos, valida texto plano, ignora `price` y `tier` del cliente).
4. Los datos internos (propuestas, cobertura, mensajes) solo llegan a managers, por `GET /api/admin/data`.
5. Los secretos jamás llegan al navegador; viven en `api/config.php`.
6. El token solo se manda dentro del iframe del panel (`?embed=1`); **fuera del panel la web pública nunca manda el token**.
7. **Dentro del panel no se cambia de idioma ni se guarda nada de idioma.** Fallo real de Torivac: un cliente con el navegador en inglés veía dentro del panel la web completa y perdía la sesión, porque la detección de idioma redirigía el iframe. Se corrigió y tiene prueba (`qa-customers.mjs`, bloque 5b).

### 11.5 Lo que NO está hecho

La sesión 21 (ajustes de correo, precios, IA y secretos cifrados desde el panel; métricas de Search Console y GA4; un comando de publicación) está **planificada, no implementada**. Solo se hizo la configuración de Google desde el panel. Blog, código por correo, actividad y copias existen **solo en el API PHP**; el Worker responde 501 y `/api/health` expone `features` para que el panel oculte lo que no existe.

## 12. Backend: contrato, paridad y configuración

### 12.1 Un contrato, dos implementaciones

- **Contratos escritos** en `docs/`: `PRECIOS-Y-CLIENTES.md`, `PRESUPUESTOS-RECIBIDOS.md`, `GOOGLE.md §11`. Cada uno lista rutas, errores, orden de comprobaciones, pruebas obligatorias y una sección final de **«Decisiones de implementación (iguales en PHP y Worker)»**.
- **Paridad:** (a) código común en `shared/` con casos compartidos que cargan las dos implementaciones (`plain-text`, `price-sheet`, `xlsx`, `blog-markdown`, `ip-key`); (b) los **mismos guiones de navegador** contra los dos servidores, con `scripts/lib/backends.mjs` (Worker en memoria o `--php` con `php -S`); (c) pruebas que comparan JavaScript con PHP.
- **Divergencias reales:** el Worker no tiene código por correo, actividad, copias, blog (501), `POST /auth/password` ni desbloqueo; el número de pedido es `TV-AAAAMMDD-NNNN-XXX` en el Worker y `TV-AAAAMMDD-NNNN` en PHP.
- **Almacén:** PHP guarda JSON en `<datos>/kv/` con escritura atómica y bloqueo; el Worker usa KV (no atómico, así que los topes son de mejor esfuerzo).

**Añadir una ruta nueva:** (1) contrato en `docs/`; (2) lógica reutilizable a `shared/` con casos; (3) Worker: módulo y rama en `route()` tras `identify()` y `requireRole`; (4) PHP: clase en `lib/` y rama en `Router::route()` en el mismo orden; (5) si la hace un manager y debe quedar anotada, `Audit::describe()` y `Audit::LABELS`; (6) pruebas con **matriz de roles** (anónimo 401, cliente 403) y límites; (7) `qa-*.mjs` con y sin `--php`; (8) cabecera, descripciones y `qa-all.sh`; (9) si es solo PHP, anunciarlo en `features` de `/api/health`.

### 12.2 Precios y categorías de cliente (el módulo que más cambió)

- El precio de la hoja es el **VIP** (base). Las categorías VIP +5, VIP +10 y Normal suman un porcentaje **global** (de fábrica 5, 10 y 15; editable).
- `GET /api/prices` **varía según quien llama**: el equipo ve el VIP con marcas; el cliente, su categoría; el visitante, «Consultar», aproximado o Normal.
- Un precio editado a mano queda marcado **manual** y la hoja no lo pisa; «Volver a la hoja» lo suelta.
- La hoja nueva se rechaza si retira más de la mitad de las referencias, salvo confirmación expresa.
- **Permisos de la hoja:** subir el Excel (con vista previa) y «Actualizar ahora» los pueden usar `manager` y `client`; la IA de precios, solo el `manager`.
- **Política de precios:** se construyó pública y el cliente pidió no enseñar precios exactos. Preguntarlo al principio (sección 18).

### 12.3 Claves de configuración

PHP: `backend-php/api/config.php` (copia de `config.sample.php`, permisos 640). Cualquier clave puede darse como variable de entorno `TORIVAC_<RUTA_CON_GUIONES_BAJOS>`. Worker: `wrangler.toml` y `wrangler secret put`.

| Clave | Para qué | Defecto | Secreto |
|---|---|---|---|
| `storage_dir` | Carpeta de datos (fuera de la web) | `~/torivac-datos` o `api/storage` | no |
| `session_secret` | Firma sesiones, códigos y enlaces (≥ 32) | ejemplo «CAMBIA-ESTO» (nadie entra) | **sí** |
| `admin_token` | Token maestro = manager (≥ 32); vaciar tras crear el primero | vacío (apagado) | **sí** |
| `allowed_origins` | Orígenes CORS extra | vacío | no |
| `trusted_proxies` | Proxies cuyo `X-Forwarded-For` se acepta | vacío | no |
| `order_to`, `order_from` | Destinatarios de pedidos y mensajes; remitente | de la marca | no |
| `mail.driver` | `smtp`, `brevo`, `resend`, `mail`, `file` o `none` | `none` | no |
| `mail.smtp.*`, `mail.brevo_api_key`, `mail.resend_api_key` | Credenciales de correo | vacío | **sí** |
| `form_min_fill_ms` | Tiempo mínimo de relleno | 1200 (0 = apagado) | no |
| `prices.*` | Origen de la hoja de Drive, decimales | rango `Precios!A:O`, 4 decimales | cuenta de servicio **sí** |
| `ai.anthropic_api_key`, `ai.model` | IA que propone cambios de precio | apagada | clave **sí** |
| `two_step.*` | Código por correo (solo PHP) | activado, 30 días | no |
| `backup.*` | Copia semanal (solo PHP) | activada | no |
| `turnstile_sitekey`, `turnstile_secret` | CAPTCHA (las dos o ninguna) | apagado | secreto **sí** |
| `cron_token` | Habilita `GET /api/cron?token=` (≥ 24) | vacío | **sí** |
| `order_copy`, `order_copy_daily_max` | Copia al cliente | `capped`, 150 | no |
| `orders_per_hour_max`, `customer_orders_per_day`, `order_send_daily_max` | Topes de la sección 8.4 | 120, 3, 150 | no |

## 13. Despliegue y entrega

### 13.1 Pasos comunes (cPanel y Plesk)

1. Subdominio con HTTPS.
2. PHP ≥ 8.1 (probado 8.3; mínimo 7.4) con `curl`, `mbstring`, `openssl`, `json`, `zlib`; `post_max_size` ≥ 8 MB.
3. `python3 -I scripts/package_cpanel.py --base=https://… [--staging]` genera el `.zip` verificado.
4. Subir y extraer **encima** (nunca vaciar la carpeta).
5. Carpeta de datos **fuera de la web**.
6. Crear `api/config.php` (permisos 640).
7. Primer manager: con terminal, `php api/tools/create-user.php correo "Nombre" manager "contraseña"`; sin terminal, `admin_token` en `config.php`, una llamada `POST /api/users` y **vaciar el `admin_token`**. Después marcar la cuenta del dueño como «de confianza».
8. Correo: SMTP del buzón recomendado; probar en *Ajustes → Correo → Enviar correo de prueba*. SPF y DKIM son obligatorios para no ir a spam.
9. Cron diario de precios y limpieza (`php api/cron.php` a las 03:00).
10. Comprobar: `/api/health`, *Ajustes → Diagnóstico*, las cabeceras con `curl -sI` y un pedido de prueba.

### 13.2 Particularidades de cada hosting

- **Plesk:** *Run PHP as = FPM application served by Apache* y desmarcar *Serve static files directly by nginx*; si no, el `.htaccess` (CSP, `noindex`, caché) **no se aplica**. No usar *Password-Protected Directories*. Si ModSecurity devuelve 403 o 406 en pedidos con PDF, pasar a *Detection only* o poner una excepción para `/api/`.
- **cPanel:** AutoSSL, MultiPHP Manager, datos en `/home/CUENTA/torivac-datos`, *Trabajos de Cron*, *Entregabilidad de correo* para SPF y DKIM.
- **Cloudflare (Worker):** `wrangler kv namespace create`, `wrangler secret put …`, `wrangler deploy`, compilar la web con `TORIVAC_API=https://<worker>`, `workers_dev=false` con dominio propio y una regla de *Rate Limiting* sobre `/api/auth/login` y `/api/order`. No hay CSP en este despliegue.

### 13.3 Qué verifica el paquete antes de crear el `.zip`

Si algo falla, **no hay `.zip`**: 28 ficheros obligatorios presentes; nada fuera de la lista blanca ni prohibido; patrones de claves sobre todo el texto; `prices.js` sin precios ni modo demo; el catálogo apunta al API propio; sin `127.0.0.1` ni `localhost` en producción; `robots` y `noindex` coherentes con `--staging`; `/api` reescrito; huella `?v=` de CSS y JS; CSP; Google coherente con el modo; sondeos de WordPress cortados; `build.json` coincide con base, modo, aspecto y versión; `php -l` de cada PHP; en producción, además, `seo_check.py`. El zip es determinista (fechas fijas) y se acompaña de su SHA-256.

### 13.4 Actualizar sin romper

Pruebas en verde → paquete de pruebas → subir y extraer encima → lista corta de comprobación → **copia de seguridad** (*Crear copia ahora* o `php api/tools/backup.php`) y guardar `config.php` y el `.zip` anterior → paquete de producción **del mismo commit** → extraer → comprobar. **Vuelta atrás = extraer el `.zip` anterior.** No se tocan `api/config.php`, la carpeta de datos ni `.well-known/`; el `.htaccess` se regenera entero (se pierde cualquier `Require ip` manual). Si se sube un `.zip` encima de un WordPress, borrar antes la carpeta guardando `config.php` y los datos.

### 13.5 Carpeta de entrega

`entrega/` reúne el demo (`torivac-demo.zip`, doble clic), el paquete verificado, las guías (`DESPLIEGUE-*`, `ACTUALIZAR-SIN-ROMPER`, `SEGURIDAD`, `CORREO`, `GOOGLE`, `TEXTOS-DE-INTERFAZ`), un `config.php` de ejemplo, capturas, comparativas y **los instructivos en PDF** (clientes en inglés y español; propietarios en español). `ENTREGA-DEMO.md` lleva la tabla **real frente a simulado**, «qué se hizo distinto» y «decisiones pendientes».

## 14. QA y definición de «terminado»

### 14.1 Catálogo de pruebas (`bash scripts/qa-all.sh`)

43 pasos (34 con `--rapido`). Cada paso tiene un límite de 20 minutos. El script termina con un resumen y con salida distinta de cero si algo falla.

| Paso | Qué demuestra |
|---|---|
| Escáner de secretos, índice de código | Ningún secreto versionado; cabecera por archivo y descripción por función |
| Pruebas del Worker y de PHP | Pedidos, precios, hojas, sesiones, IA, `.xlsx`; el mismo contrato en los dos |
| Texto plano, conversor del blog, propuestas, textos de interfaz | Validador común, JavaScript = PHP, propuestas aprobadas, `TEXTOS-DE-INTERFAZ.md` al día |
| Compilar demo y producción + `seo_check.py` | Se genera sin errores; auditoría SEO y GEO |
| `smoke`, `smoke-admin` | Demo y panel por `file://` sin errores de consola |
| `qa-quote`, `qa-lang`, `qa-art`, `qa-theme`, `qa-shop` | Presupuesto en 4 idiomas con cálculo independiente; idioma; gráficos; aspectos y desbordes; tienda con axe |
| `qa-live`, `qa-admin-live`, `qa-tarifa`, `qa-customers` (con Worker y con `--php`) | Web y panel contra el backend real; Excel real; categorías y cuentas |
| `qa-package`, `qa-apache`, `qa-blog-apache` | El paquete tal como se sube; `.htaccess`, cabeceras y CSP en **Apache real** |
| `qa-blog-panel`, `qa-security-panel`, `qa-captcha`, `qa-google`, `qa-update` | Editor del blog, doble factor y bloqueos, Turnstile, cookies y Google, actualizar sin caché vieja |
| `qa-ux` (escritorio y móvil), `qa-a11y`, `perf` y el segundo aspecto (solo sin `--rapido`) | Todas las páginas; axe AA; LCP; el aspecto Clásico en muestra y axe |

**La CI (`ci/ci.yml`) no es `qa-all.sh`.** No ejecuta `smoke`, `smoke-admin`, `qa-customers`, `qa-apache`, `qa-blog-*`, `qa-security-panel` ni `qa-captcha`. Para entregar, manda `qa-all.sh` en local.

### 14.2 Definición de «terminado» para una web nueva

**Automáticas, todas en verde con `AXE_PATH` definido:**

1. Las pruebas de datos y de negocio que afecten a la web.
2. Compilaciones demo y producción sin errores; `seo_check.py` sin errores.
3. `qa-theme`: 0 fallos (reglas de diseño, banderas de compilación, desbordes en todos los anchos y aspectos).
4. `qa-ux` a 1440 y 390 px: **0 incidencias duras**; revisar los avisos nuevos.
5. `qa-a11y`: **0 reglas serious o critical con cada aspecto por defecto** (hoy `qa-all.sh` solo lo hace con Ficha y Clásico).
6. `qa-lang`, `qa-quote`, `qa-art` y la prueba del flujo propio de la web nueva (copiar el patrón de `qa-shop`: tres aspectos, axe, sin JavaScript).
7. `perf`: LCP ≤ 2500 ms **y** revisar a mano el CLS (< 0,1) y los KB, que el script no controla.
8. `qa-update` y `qa-apache` si hay `.htaccess`.
9. `secret_scan` y `gen_code_index --check`.

**Manuales** (ninguna prueba las cubre): foco visible con Tab, zoom del 200 % y reflujo a 320 px, lector de pantalla, objetivos táctiles en un móvil real, menú y cajón con teclado, revisión de las traducciones nuevas por una persona nativa y contraste de cualquier color nuevo.

### 14.3 Trampas conocidas (y cómo se detectaron)

- **Capas de aspecto:** una regla amplia (`a{color}`) en `ficha` dejó el menú tinta sobre tinta. Se acotan los selectores y `qa-theme` exige el prefijo `[data-theme]`.
- **Pantalla estrecha:** las reglas de `classic` dejan de valer si `ficha` fija la misma propiedad; hay que repetirlas. Se detecta con `qa-theme` a 390 y 768 px.
- **`display` que pisa a `hidden`:** `.btn{display:inline-flex}` anulaba `.filters-toggle{display:none}`.
- **Menús desbordados** en francés y alemán entre 1241 y 1400 px: `qa-shop` barre 6 anchos × 4 idiomas × 3 aspectos.
- **`php -S` no lee `.htaccess`:** una regla inválida dejó la API en 500 y solo se vio con Apache real. **Montar Apache y PHP-FPM desde el principio.**
- **Fallos silenciosos:** `qa-shop`, `qa-blog-panel`, `qa-security-panel`, `qa-captcha` y `qa-google` **omiten axe sin avisar** si falta `AXE_PATH`; `qa-apache` sale con 0 si faltan Apache y PHP-FPM. Un verde sin axe no demuestra accesibilidad.
- **`qa-all.sh` no pasa `qa-ux` ni `qa-a11y` con el aspecto Original.**
- Los colores sueltos de `components.css` (34), `layout.css` (25), `admin.css` (29) y `original.css` (144) **no los detecta ningún test**: la regla de tokens solo se vigila en `ficha.css`.
- **CORS con `PUT`:** el preflight fallaba porque `Access-Control-Allow-Methods` no incluía `PUT`. Hoy solo lo comprueba el Worker.
- **CSP con Google:** la lista oficial fallaba contra el Google real (`*.doubleclick.net`); solo lo detectó `qa-google.mjs --real`.
- **`Authorization` en PHP-FPM:** se descarta; se reinyecta con una regla de reescritura.
- **Ráfagas de intentos fallidos:** las peticiones en paralelo contaban varios bloqueos con un solo ataque y disparaban el aviso; se corrigió con `failLock`.
- **Detección de idioma dentro del panel:** véase la sección 11.4.

## 15. Documentación de código

Reglas de `docs/CONVENCIONES.md`:

- **Cabecera en cada archivo:** qué es, secciones y dependencias.
- **Secciones** con `// ───── [ETIQUETA] descripción`, en mayúsculas (`[AUTH]`, `[VIEWS]`, `[SEO-FILES]`).
- **Cada función** (también las flecha y los métodos) lleva `/** … */` o `//` de una línea encima; en Python, *docstring*. Comentarios en castellano.
- **PHP 7.4:** sin `match` ni `str_contains`.
- Pruebas con **cálculo independiente** y sin red.
- `python3 -I scripts/gen_code_index.py` genera `docs/INDICE-CODIGO.md`; con `--check` sale con 1 si falta una cabecera o una descripción (paso de `qa-all.sh`).

## 16. Reutilización

### 16.1 Genérico (se reutiliza casi tal cual)

- **Generador:** `site/build.mjs`, `site/lib/render.mjs`, `seo.mjs`, `hosting.mjs`, `shared-client.mjs`, `site/templates.mjs`, la estructura de `i18n.mjs`.
- **Idioma:** `app.js [LANG]`, el selector del layout, `qa-lang.mjs`, `audit_i18n.mjs`.
- **Formularios y Google:** `shared/plain-text.mjs` y `PlainText*.php`, `forms.js`, `captcha.js`, `google.mjs`, `cookies.mjs`, `consent.js`, `admin-google.js`.
- **Blog:** `shared/blog-markdown.mjs` ↔ `BlogMarkdown.php`, `Blog*.php`, `api/page.php`, `admin-blog.js` (solo PHP).
- **Backend PHP:** `Router`, `Request`, `Store`, `Config`, `Auth`, `Users`, `Security`, `Audit`, `Backup`, `Mail`, `Smtp`, `Messages`, `Diag`, `Proposals` y `tools/*`; sus equivalentes del Worker.
- **Paneles:** el *shell* `admin-live.js`, `admin-security.js`, Mensajes, Ajustes, Propuestas y `admin.css`.
- **Calidad y entrega:** `qa-ux`, `qa-a11y`, `perf`, `seo_check.py`, `secret_scan.py`, `qa-apache`, `qa-package`, `qa-update`, `gen_code_index.py`, `package_cpanel.py`, `scripts/lib/*`, `qa-all.sh`, `ci/*.yml`.
- **Cosecha de una web WordPress con WPML y WooCommerce:** `harvest.mjs`, `prepare.py`, `map_translations.py`, `wpml_probe.py`.

### 16.2 Específico de Torivac (se reescribe)

El catálogo (`data/catalog/*`) y sus scripts (`build_catalog.py`, `enrich_catalog.py`, `link_pdfs`, `contrast_pdfs`, `web_vs_pdf`), el presupuesto y la tienda (`quote.js`, `pdf.js`, `shop.js`), los precios y categorías (`Prices`, `Pricing`, `Customers`, `PriceSheet`, `admin-prices/customers/quotes.js`), los temas y gráficos concretos, y los textos legales y las propuestas (`PR-…`).

### 16.3 Qué parametrizar para otra marca

`data/catalog/meta.json` (nombre, razón social, contacto, menú, pie, destinatarios de pedidos); `LANGS`; el dominio de origen fijo en `harvest.mjs`, `wpml_probe.py`, `render.mjs mapLink` y `build.mjs`; el nombre «Torivac» cableado en `templates.mjs`, `seo.mjs` y `hosting.mjs`; `QSLUG` y `SHOPSLUG`; `GLOSSARY` en `audit_i18n.mjs`; `tokens.css`; `site/google.config.json`; el remitente de correo; los textos de `cookies.mjs`.

### 16.4 Añadir un aspecto visual nuevo

1. Crear `<n>-tokens.css` y `<n>.css` con todo bajo `[data-theme="<n>"]`.
2. Añadir `<n>` a `THEMES` en `site/lib/themes.mjs`.
3. En `site/build.mjs` (sección `[CSS]`): la bandera, las fuentes, la lista de capas, el bloque `@layer` y los archivos que se borran de `dist/assets/css`.
4. En `i18n.mjs`, la clave `theme_<n>` en 4 idiomas; en `templates.mjs`, `PRELOAD_FONTS[<n>]`.
5. Si lleva fuentes propias, `make_ficha_fonts.py` e `inline_fonts.py`.
6. Ampliar `qa-theme.mjs` y pasar `qa-ux` y `qa-a11y` **con ese aspecto por defecto**.

**Reglas de aspecto** (las vigila `qa-theme`): todo selector de `ficha.css` empieza por `[data-theme="ficha"]`; sin colores sueltos y con un único `!important`; los `*-tokens.css` solo declaran variables; `classic` no se edita para arreglar `ficha`; `url()` dentro de una variable CSS se resuelve desde la hoja; rejillas con `minmax(0,N)`; `background:none` borra otros fondos (usar `background-color:transparent`).

## 17. Lecciones aprendidas

1. **La marca llegó mal por dictado** («Toriback»): confirmar nombre, dominio, hosting y accesos en la fase 0.
2. **Roles:** `client` se creyó «comprador» y era el dueño. Definir qué ve cada rol antes de construir.
3. **Precios:** se construyeron públicos y el cliente pidió no enseñar precios exactos. Preguntar política de precios y de cuentas al inicio.
4. **Fidelidad:** el proyecto escribió títulos y descripciones propios en otros idiomas y el cliente exigió las palabras originales. Fijar «solo texto original más lista a validar» desde el principio.
5. **Identidad visual:** cambió tres veces (Ficha técnica → Clásico → Original). Preguntar al inicio si se conserva la imagen actual.
6. **Dos backends** duplican coste y divergen (blog, doble factor, actividad y copias solo en PHP). Decidir hosting y backend único antes; probar en Plesk y producir en cPanel.
7. **Apache real desde el principio:** `php -S` no lee `.htaccess`.
8. **Agentes largos** se cortaron por límite de uso: scripts deterministas, trabajos pequeños y commits `[en curso]`.
9. **Datos de origen poco fiables** (tabla ≠ PDF ≠ tarifa, precio de relleno, neerlandés en alemán, WPML mal enlazado, canónicas incoherentes): auditar las fuentes en F1 y no publicar lo dudoso.
10. **El correo es parte del resultado:** el formulario decía «recibido» sin que saliera ningún correo. Fijar SMTP, SPF, DKIM y remitente al inicio; el estado del envío debe ser veraz (`sent`, `off`, `failed`, `skipped`).
11. **Google:** preguntar qué mide hoy la web original para no perder conversiones ni contarlas doble.
12. **Autogestión:** la sesión 21 se planificó y no se hizo. Acordar pronto cuánto se gestiona desde el panel.
13. **Política de cookies:** la original era un *shortcode* no copiable; se generó una propia en la misma URL y requiere validación legal. Los textos legales originales se publican con sus defectos.
14. **Revisiones de seguridad independientes** encontraron fallos reales: planificarlas al cerrar cada bloque.
15. **Documentación desfasada:** vigilar `DOCUMENTACION.md §1` («dos roles»), el número de propuestas (116 o 118) y las cifras de pruebas de `SEGURIDAD.md`.
16. **Un fallo que solo ve un cliente real:** el panel dentro del navegador en inglés. Probar con un navegador sin idioma guardado y en cada idioma, no solo con el idioma fijado.

## 18. Cuestionario de arranque (fase 0)

Preguntar y dejar por escrito **antes** de escribir código:

1. **Marca y dominio:** nombre exacto (letra a letra), dominio de producción, subdominio de pruebas.
2. **Hosting:** Apache o nginx, SSH, cron, versión de PHP, ¿cPanel o Plesk?, ¿se puede montar Apache real en las pruebas?
3. **Roles:** quiénes son, qué ve y qué hace cada uno. ¿Hay compradores con cuenta?
4. **Precios:** ¿públicos, a consultar, aproximados? ¿Categorías de cliente? ¿Quién los cambia y desde dónde (Excel, Drive, panel)?
5. **Idiomas:** cuáles, **quién valida cada uno** y quién aprueba las propuestas.
6. **Imagen visual:** ¿se conserva la actual? ¿Hay varias opciones que decidir?
7. **Contenido «intocable»:** qué no se puede reformular (legales, fichas técnicas).
8. **Correo:** buzón de salida, destinatarios de pedidos y avisos, SPF y DKIM.
9. **Google:** identificadores de GA4, Ads y Search Console; qué se mide hoy; qué conversiones.
10. **Datos personales:** retención de pedidos y mensajes, y quién puede borrarlos.
11. **Cortafuegos del cliente:** ¿la red del cliente bloquea el subdominio de pruebas? (En Torivac, un cortafuegos corporativo impidió que el cliente viera la web de pruebas; hace falta el código de error y la IP.)
12. **Autogestión:** qué se cambia desde el panel y qué lo hace el equipo técnico.

## 19. Límites conocidos y deuda

- Sesión 21 sin implementar (sección 11.5).
- Estadísticas del panel sin datos conectados: faltan credenciales de Google.
- Un cliente no puede cambiar su propia contraseña desde el panel: debe pedirla a Torivac.
- No hay enlace público al acceso de clientes (`/admin/`): se ofreció y no se hizo.
- Dos backends con funciones desiguales (sección 12.1).
- El Worker de Cloudflare y los hostings Plesk y cPanel reales no se han probado de principio a fin.
- Sin `srcset` en imágenes; CLS de 0,10 a 0,14 en dos páginas sin umbral que lo vigile.
- Sin prueba general de foco visible ni de objetivos táctiles; panel fuera de `qa-a11y`.
- Validar con una persona nativa los textos de interfaz nuevos (334 filas) y la política de cookies (borrador).
- Verificar el dominio de envío en Resend sigue pendiente.

## 20. Prompt maestro

Copiar el bloque siguiente como `CLAUDE.md` en la raíz del repositorio nuevo y rellenar lo marcado `<…>`. Está pensado para que cada sesión empiece con las reglas.

````markdown
# <NOMBRE DEL PROYECTO> — contexto para Claude Code

Web estática multilingüe con backend pequeño sin base de datos y panel de gestión con roles.
Manual completo: docs/ARCHIVO-MAESTRO.md. Si un documento y el código se contradicen, manda el código.

## Reglas inquebrantables
1. No se toca la web original: solo GET. Pruebas en subdominio noindex. El DNS es lo último.
2. No se inventa nada. Cada dato lleva su fuente. Lo dudoso va a propuestas y no se publica sin aprobación.
3. El contenido original se copia literal en cada idioma; la web no traduce ni reformula. Los textos de interfaz nuevos viven solo en site/lib/i18n.mjs y se listan en docs/TEXTOS-DE-INTERFAZ.md (generado) para validarlos.
4. Salida estática, JavaScript vanilla, funciona sin JavaScript.
5. Un contrato por módulo en docs/ antes de programar. Si hay dos backends, cada cambio se hace en los dos y los mismos guiones de navegador corren contra ambos.
6. El servidor decide rol, precio y validación, y los relee en cada petición. El navegador solo pinta.
7. Se escapa todo lo que venga de personas o del API. Formularios en texto plano. CSP sin scripts en línea.
8. Ningún secreto en el repositorio. La configuración insegura falla cerrada.
9. Colores y tamaños solo con tokens CSS.
10. Cada archivo lleva cabecera y cada función una descripción (python3 -I scripts/gen_code_index.py --check).
11. Sin prueba no está hecho: cada requisito tiene su script qa-*.
12. Cada sesión termina con commit y documentación al día; los puntos de control se marcan [en curso].

## Requisitos de calidad
- Seguridad: cabeceras y CSP en .htaccess, sesiones firmadas, contraseñas ≥ 12, bloqueo por fuerza bruta, registro de actividad, copias, paquete con lista blanca. Ver sección 8 del manual.
- Accesibilidad: WCAG 2.1 AA, un H1, foco visible, enlace de salto, formularios con aria-invalid, movimiento reducido. axe sin reglas serious ni critical con cada aspecto.
- Traducciones: sin huecos por clave y por idioma; detección una sola vez y nunca dentro del panel (?embed=1).
- Adaptabilidad: sin desborde horizontal de 390 a 1440 px en todos los aspectos; tablas largas como tarjetas en móvil.
- SEO/GEO: seo_check.py sin errores; JSON-LD sin precios inventados; sitemap, llms.txt y robots; noindex en pruebas.
- Rendimiento: LCP ≤ 2,5 s en móvil y CLS < 0,1 (este último, a mano).
- Paneles: roles decididos por el servidor; cada vista escapa todo y se prueba con cada rol; una prueba por rol y por backend.

## Comandos
bash scripts/qa-all.sh            todo (15–25 min)
bash scripts/qa-all.sh --rapido   sin qa-ux, qa-a11y ni perf
node site/build.mjs [--base=https://…] [--staging] [--theme=…]
python3 -I scripts/package_cpanel.py --base=https://… [--staging]
python3 -I scripts/secret_scan.py
python3 -I scripts/gen_code_index.py [--check]

## Proceso
Fase 0: resolver el cuestionario de arranque (marca, hosting, roles, precios, idiomas, imagen, correo, Google, datos personales, cortafuegos, autogestión). Después: análisis → catálogo → función principal → estética → QA → backend → paneles → legales → control de UX → idioma → accesibilidad → entrega → documentación → revisión final → despliegue.

## Antes de dar algo por terminado
Todas las pruebas de bash scripts/qa-all.sh en verde con AXE_PATH definido, más la revisión manual de foco, zoom 200 %, lector de pantalla y objetivos táctiles. Decir con claridad qué se probó y qué no.
````

## Apéndice A · Discrepancias entre documentación y código

Manda el código. Las discrepancias conocidas al escribir este archivo:

- `DISENO-TEMAS.md` dice que `qa-theme` prueba «12 páginas × 4 anchos × 2 aspectos»; el código hace **15 páginas × 5 anchos × 3 aspectos**.
- `ARQUITECTURA.md` y `DOCUMENTACION.md` hablan de dos aspectos y de dos roles; hay **tres aspectos** (`ficha`, `clasico`, `original`) y **cuatro roles** (`manager`, `client`, `customer`, `reviewer`).
- Las cifras de pruebas de `SEGURIDAD.md` («5420 comprobaciones PHP», «164 pruebas Worker») están desfasadas: la última pasada dio 6.647 comprobaciones de PHP y 247 pruebas del Worker.
- No existe `.github/`: los flujos de CI están como plantillas en `ci/ci.yml` y `ci/deploy.yml`.
- El número de propuestas aparece como 116 o 118 según el documento.
- `PLAN.md` mantiene la sesión 21 como planificada.
- El README del Worker dice «No está desplegado»: nunca se ha probado en un Cloudflare real.
