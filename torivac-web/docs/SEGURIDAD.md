# Seguridad: qué protege esta web, cómo se comprobó y qué queda por hacer

Este documento cuenta, sin humo, las medidas de seguridad que lleva la web de Torivac, cómo se verifican y **cuáles son sus límites**. Vale para los dos servidores que existen (el **PHP** de cPanel/Plesk y el **Worker** de Cloudflare): se comportan igual y se prueban con las mismas pruebas (salvo el código por correo, la actividad, las copias y el blog del panel, que solo existen en el servidor PHP del hosting: §9–§13).

> **Una idea para quedarte:** los datos que mandan los visitantes **nunca se consideran fiables**. El precio de un pedido lo calcula el servidor (no el navegador), todo texto se limpia y se escapa al mostrarlo, y lo que el servidor guarda lo ven solo las personas con sesión de *manager*.

## 1. Resumen de medidas

| Qué se protege | Cómo | Dónde se ve |
|---|---|---|
| **Acceso al panel (fuerza bruta)** | 5 contraseñas erróneas → bloqueo de **1 hora** (§2) | Panel: «Demasiados intentos fallidos. Vuelve a intentarlo en una hora.» |
| **Contraseñas** | Mínimo **12 caracteres**, sin tu correo dentro, sin palabras típicas («password», «123456», «torivac»…) y con variedad. Se guardan como *hash* (`password_hash` en PHP; PBKDF2 en el Worker): nadie, ni tú, puede leerlas | Al crear un usuario |
| **Sesiones** | Firmadas (HMAC), caducan a las **24 h**, atadas al usuario: borrar al usuario o pulsar *Salir* anula sus sesiones. La clave de firma (`session_secret`) tiene que tener ≥ 32 caracteres o **nadie puede entrar** (a propósito) | Ajustes → Diagnóstico |
| **Acceso al panel: código por correo** | Con la contraseña buena, a los managers se les manda un **código de 6 cifras** al correo (vale 10 minutos, una sola vez, 5 intentos). «Recordar este dispositivo» lo evita **30 días** en ese navegador. La cuenta de quien administra la web puede ser **de confianza** y no lo pide de rutina (§10) | Panel: pantalla «Código de verificación» |
| **Intentos repetidos** | **Sin avisos de rutina.** Solo si una cuenta suma 3 bloqueos en 24 h: **un** aviso por correo (como mucho uno al día) y esa cuenta pide el código en dispositivos nuevos durante 7 días (§11) | Correo · Usuarios: «Protección reforzada» |
| **Desbloqueo** | Un manager desbloquea una cuenta desde Panel → Usuarios (§11) | Usuarios → «Desbloquear» |
| **Registro de actividad** | Quién entró y quién cambió qué, con la hora y la dirección; 180 días; solo managers; sin contraseñas ni códigos (§12) | Panel → Actividad |
| **Copias de seguridad** | Una a la semana, sola, descargable con un enlace firmado de 2 minutos; se pueden restaurar (§13) | Panel → Ajustes → Copias de seguridad |
| **CAPTCHA invisible** (opcional) | Cloudflare Turnstile en contacto y pedido; **apagado hasta que pongas las dos claves** en `config.php` (§14) | Diagnóstico: «CAPTCHA» |
| **Token maestro** (`admin_token`) | Solo para crear el primer manager. Si tiene menos de 32 caracteres queda **desactivado**. Vacíalo después | Diagnóstico |
| **Formularios: solo texto plano** | Sin etiquetas HTML, scripts, `javascript:`, plantillas `{{ }}`, SQL (`UNION SELECT`, `; DROP TABLE`…), órdenes de consola, rutas `../`; **máximo 2 enlaces** por texto (§3) | Aviso junto al campo, en el idioma de la página |
| **Formularios: límite de caracteres** | Mensaje 1000 · notas del pedido 500 · empresa 120 · nombre 80 · teléfono 40 | Contador «n / máx» bajo el cuadro |
| **Antispam** | Campo trampa invisible (`hp`), **tiempo mínimo de relleno** (un robot que envía al instante queda fuera), tope de mensajes y pedidos por visitante, tope global de pedidos por hora | — |
| **Pedidos** | El servidor **recalcula** precios y total (el navegador no puede fijar un precio); referencias y cantidades se validan; PDF adjunto comprobado (es un PDF de ≤ 4 MB) | Pedidos → total del servidor |
| **Correo** | La copia al cliente lleva **solo texto fijo del servidor** (nada de lo que escribió el visitante, sin adjunto) con topes: así el correo corporativo no puede usarse para mandar mensajes a terceros. Los errores de envío nunca llevan claves | §6 |
| **Datos personales** | Pedidos y mensajes viven en una carpeta de datos **fuera de la web** (o, si el hosting no deja, dentro y cerrada con `.htaccess`); retención 400 días; solo los ve un manager; un cliente solo ve **sus** pedidos | Diagnóstico: «Carpeta de datos» |
| **Web y cabeceras** | CSP **sin scripts en línea** (una inyección de HTML no puede ejecutar código), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS | `.htaccess` generado |
| **Carpeta `api/`** | Lista blanca: desde fuera solo se sirve `index.php`; `lib/`, `generated/`, `config.php`, copias y registros quedan cerrados | `qa-package` lo comprueba |
| **Sondeos de WordPress** | `wp-login.php`, `xmlrpc.php`, `wp-admin`, `wp-json`, plugins y temas reciben **410 sin tocar PHP**; las fotos y PDF antiguos de `wp-content/uploads` siguen redirigiendo | `.htaccess` generado |
| **Blog del panel** | Lo que escribe un manager se trata como no fiable: el texto solo emite una lista cerrada de etiquetas, todo se escapa al pintar, las imágenes se validan por su contenido y la vista previa de borradores va firmada y caduca en una hora (§9) | `qa-blog-apache.mjs`, `test-blog-markdown.mjs` |
| **Paquete** | Nunca lleva `config.php`, claves, precios, pruebas ni scripts de trabajo; un escáner de secretos lo revisa antes de entregarlo | `package_cpanel.py` |

## 2. Bloqueo por fuerza bruta («5 fallos → esperar una hora»)

Se cuentan los fallos de **tres formas a la vez**; cuando salta cualquiera, ese acceso queda bloqueado **1 hora**:

| Contador | Umbral | Qué bloquea |
|---|---|---|
| Visitante + cuenta | **5 fallos** (en una hora) | Que ese visitante pruebe más contraseñas para esa cuenta |
| Visitante (cualquier cuenta) | 15 fallos por hora | Que ese visitante pruebe contraseñas de cuentas distintas |
| Cuenta (desde cualquier sitio) | 30 fallos por hora | Ataques repartidos entre muchas IP contra una cuenta |

- El bloqueo empieza **en el 5.º fallo**. Mientras dura, **ni la contraseña correcta entra** (ni siquiera se comprueba) y no se alarga si se sigue insistiendo.
- Los correos que **no existen** cuentan igual que los que sí: no se puede averiguar qué cuentas hay.
- La respuesta es la misma en todos los casos: «Demasiados intentos fallidos. Vuelve a intentarlo en una hora.» (HTTP 429, con la cabecera `Retry-After`).
- Un acceso correcto pone a cero los contadores de ese visitante y esa cuenta.
- Aparte hay un corte de inundación: 30 intentos en 10 minutos desde un mismo visitante, cuenten como cuenten.
- Las **otras cuentas** del mismo visitante siguen entrando con normalidad.
- **Los códigos del correo cuentan aparte** (§10): 5 códigos erróneos de un visitante contra una cuenta → 1 hora; 20 contra la cuenta desde cualquier sitio → 1 hora y cuenta como ataque repetido (§11).
- **Efecto secundario aceptado:** quien teclee mal 5 veces espera una hora (es lo que se pidió). Alguien con ganas de molestar podría bloquear la cuenta de un manager repartiendo 30 fallos entre varias IP. **Para quitar un bloqueo, otro manager pulsa «Desbloquear» en Panel → Usuarios** (§11). Si no hay otro manager que pueda entrar, espera la hora o borra a mano, en la carpeta de datos (`kv/`), los ficheros que empiezan por `rl%3Algpair%3A`, `rl%3Algip%3A`, `rl%3Algacct%3A`, `rl%3Apinpair%3A` y `rl%3Apinacct%3A` (PHP).

## 3. Formularios: solo texto plano

Los formularios (contacto y pedido) aceptan **texto de persona**, no código. La comprobación es **una sola lógica para tres sitios** (`shared/plain-text.mjs`): el navegador avisa al momento y en el idioma de la página; el servidor la vuelve a aplicar siempre (el aviso del navegador es una cortesía, no la defensa). Un mismo archivo de casos (`shared/plain-text.fixtures.json`) lo cumplen los tres.

Se rechaza (con un aviso claro y sin guardar ni enviar nada):
- Etiquetas HTML y XML (`<script>`, `<img onerror=…>`, `<svg>`, `<iframe>`, `<a href…>`…), comentarios y declaraciones, y sus versiones codificadas (`&lt;`, `&#60;`).
- Esquemas peligrosos (`javascript:`, `vbscript:`, `data:text/…`), funciones de script (`alert(`, `eval(`…) y manejadores (`onerror=`, `onload=`…).
- Plantillas (`{{ }}`, `${ }`, `#{ }`, `{% %}`), SQL (`UNION SELECT`, `; DROP TABLE`, `OR 1=1`, `sleep(`…), sustituciones de consola (`` `…` ``, `$(…)`), cadenas de órdenes (`; cat /…`, `| bash`, `&& wget`…) y rutas (`../`, `/etc/passwd`).
- Textos con una proporción alta de signos de programación (`{ } [ ] < > \ | ^ ~ ` $ ; =`) en un texto de 15 caracteres o más.
- Más de **2 enlaces** (`http://`, `https://`, `www.`) en un mismo texto.
- Texto demasiado largo (límites en §1). El texto se limpia antes de contar: sin caracteres de control, sin invisibles ni marcas de dirección que sirvan para esconder texto, y con los espacios normalizados.

**Un mensaje técnico normal pasa sin problema**: «Necesito 3 toroidales de 500 VA, 230V/2x24V (50-60Hz). Si V<Vn y I>In, ¿qué protección? Precio < 50 € & envío urgente; gracias» se acepta. Lo único que se pierde son casos muy raros, como una fórmula del tipo `a<b y c>d` (parece una etiqueta HTML).

**Tiempo mínimo de relleno:** el navegador manda cuántos milisegundos pasaron desde que cargó la página (`_e`). Si faltan o son menos de **1200**, el servidor rechaza el envío («El formulario se ha enviado demasiado rápido»). Se cambia con `form_min_fill_ms` (PHP) o `FORM_MIN_FILL_MS` (Worker); `0` lo desactiva.

**Orden de comprobación.** *Contacto:* campo trampa → tiempo de relleno → texto plano y límites → validez de los datos → tope de 5 mensajes cada 10 minutos por visitante → (si hay) Turnstile; lo no válido no gasta ese cupo. *Pedido:* primero el tope de 8 pedidos cada 10 minutos por visitante (cuenta todos los intentos) y después las mismas comprobaciones; además, un tope global de pedidos por hora (120) que solo cuenta pedidos válidos.

## 4. Servidor, cabeceras y paquete

- **Lista blanca en `api/`**: el `.htaccess` de esa carpeta lo cierra todo salvo `index.php`. En el paquete solo entra una lista cerrada de ficheros (código, `.htaccess` y datos generados): sin pruebas, sin `config.php`, sin copias (`.bak`, `~`), sin registros.
- **IP real del visitante** (de la que dependen los límites): se lee de `REMOTE_ADDR`; solo si quien conecta es la propia máquina, una red privada (el nginx de Plesk) o Cloudflare se acepta `X-Forwarded-For`, y se descartan las direcciones falsas. IPv6 se agrupa por su /64 para que un atacante no cambie de dirección a cada intento.
- **CORS por lista**: un origen ajeno que intenta usar el API recibe 403.
- **CSP**: `script-src 'self'` + la huella SHA-256 de cada script en línea (que son constantes). Nada de `unsafe-inline` ni `eval` en scripts. `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `connect-src` solo a la propia web y al API.
- **Errores**: ninguna respuesta de error enseña texto interno del servidor; un fallo inesperado devuelve «Error interno» con un identificador de 8 caracteres y el detalle va al registro.
- **Cuerpo máximo 6 MB**, contados de verdad (también si llega por trozos); JSON limitado en profundidad; hojas `.xlsx` leídas con límites de memoria (contra «bombas» de compresión).
- **Hoja de precios**: una hoja que borre muchos precios de golpe exige confirmación. Las descargas de la hoja (Drive u otra URL) no pueden apuntar a la red interna del servidor: se comprueba la IP a la que resuelve el nombre y se conecta a esa misma IP (protege del ataque SSRF y del cambio de DNS a media conexión).
- **Permisos de ficheros** 0660/0770 en la carpeta de datos; escritura atómica y bloqueo de ficheros en contadores y límites.

## 5. Cómo se ha comprobado

| Qué | Comando | Resultado de esta versión |
|---|---|---|
| Servidor PHP | `php backend-php/api/tests/run.php` | 5390 comprobaciones, 0 fallos (con ataques reales de entrada hostil, fuerza bruta, relé de correo, SSRF, código por correo, ataques repetidos, actividad y copias…) |
| Worker | `cd workers/api && npm test` | 164 pruebas, 0 fallos |
| Texto plano (navegador = Worker = PHP) | `node scripts/test-plain-text.mjs` | 194 comprobaciones; incluye navegador sin *lookbehind* y textos hostiles de 60 000 caracteres (sin eternizarse) |
| Conversor de texto del blog | `node scripts/test-blog-markdown.mjs` · `test-blog-markdown-php.mjs` | 20 000 entradas aleatorias hostiles + los casos del contrato: nunca produce HTML peligroso; JS y PHP dan lo mismo en ~195 000 comparaciones |
| Blog en un Apache real | `node scripts/qa-blog-apache.mjs` · `qa-blog-panel.mjs` | Entradas, imágenes, borradores, vista previa firmada y editor del panel en un navegador, con el paquete tal como se sube y sin errores ni avisos de PHP |
| Acceso en dos pasos y seguridad del panel | `node scripts/qa-security-panel.mjs` | **Chromium** sobre un Apache real con el correo guardado en una carpeta: la dueña (cuenta de confianza) entra sola; un manager recibe el código, se equivoca, lo escribe y marca «recordar»; en ese navegador no se lo vuelven a pedir y en otro sí; reenviar con su espera; cinco códigos erróneos bloquean y otro manager desbloquea; tres visitantes distintos bloquean una cuenta → **un solo aviso**, código en dispositivos nuevos y «Desbloquear»; Actividad con filtros y CSV sin fórmulas; copias (crear, descargar, comprobar que está completa, borrar); cambiar la contraseña; el interruptor de emergencia; móvil; y axe (accesibilidad) |
| CAPTCHA invisible | `node scripts/qa-captcha.mjs` | Sin claves no pasa nada; con claves, con una réplica de la API de Cloudflare **y con Cloudflare de verdad** (claves de prueba oficiales): el script solo se descarga al usar el formulario, el token viaja, el servidor lo comprueba, cada envío pide uno nuevo y, si falla, se explica en el idioma de la página sin perder lo escrito; también el pedido y la CSP del `.htaccess` |
| Web ↔ servidor | `node scripts/qa-live.mjs [--php]` | Pedido, contacto, texto plano, límites y tiempo de relleno en un navegador real |
| Panel ↔ servidor | `node scripts/qa-admin-live.mjs [--php]` | Roles, mensajes, correo y el bloqueo de 1 hora |
| Paquete tal como se sube | `node scripts/qa-package.mjs` | Con la CSP real aplicada: ni un solo incumplimiento; `api/` cerrada |
| Secretos | `python3 -I scripts/secret_scan.py` | Ninguna clave en los ficheros versionados |

Además: **revisión independiente** del servidor PHP (13 hallazgos, todos corregidos, más 10 de diseño) y del Worker, con pruebas de mutación (36 mutaciones del código se detectaron). Los arreglos más importantes fueron cerrar el **relé de correo** (la copia al cliente), poner las **sesiones de 24 h con revocación**, los **límites de acceso**, los **secretos obligatoriamente largos**, la **lista blanca** de `api/` y que `GET /api/admin/data` sea solo para managers.

## 6. Secretos: dónde van y dónde no

- Solo en `api/config.php` (permisos 640; no va en ningún paquete ni repositorio) o como secreto de Cloudflare (`wrangler secret put`). **Nunca** en el chat, en un correo ni en un fichero versionado.
- Los mensajes de error del correo y el diagnóstico enseñan el **nombre** de lo que falta, nunca su valor. `/api/health` (público) cuenta si el correo está completo y si el último envío salió, **sin** el texto del error.
- `config.php` y la carpeta de datos no se tocan al actualizar la web (ver `docs/ACTUALIZAR-SIN-ROMPER.md`).

## 7. Límites conocidos (lo que esta versión NO hace)

- **El CAPTCHA (Turnstile) viene apagado**: funciona y está probado, pero solo se enciende cuando pones las dos claves en `config.php` (§14). Mientras tanto la defensa es la trampa, el tiempo de relleno, el texto plano y los topes.
- **El entorno de pruebas es público** (cerrado a buscadores con `noindex`, no con contraseña). No cargues la tarifa real ahí sin cerrarlo a tu IP (bloque `Require ip` del `.htaccess`).
- **Librerías de terceros del navegador** (`jsPDF`, `SheetJS` para leer Excel): son versiones antiguas. Solo procesan archivos del propio usuario en su navegador, pero conviene actualizarlas (pendiente, sin urgencia).
- **Plesk con nginx sirviendo estáticos**: si se deja activa esa opción, el `.htaccess` (cabeceras, CSP) no se aplica a HTML, CSS y JS. Se comprueba con `curl -sI https://TU-DOMINIO/ | grep -i content-security`; cómo arreglarlo está en `docs/DESPLIEGUE-PLESK.md` (paso 2).
- **El segundo factor es el correo, no una app del móvil.** Quien controle el buzón de un manager **y** conozca su contraseña puede entrar: protege esos buzones con su propia verificación en dos pasos. Una cuenta «de confianza» (la tuya) entra solo con la contraseña: usa una larga y única.
- **El código por correo depende de que el correo funcione.** Por eso, si el correo está sin completar, no se pide a nadie; y si un día el correo falla y no puedes entrar, el interruptor de emergencia es `two_step.enabled = false` y `two_step.on_attack = false` en `config.php` (§10).
- **El Worker de Cloudflare no trae** el código por correo, la actividad ni las copias (solo el servidor PHP del hosting): el panel lo dice en vez de romperse.
- **Las copias de seguridad están en el mismo servidor** que los datos: no te salvan si el servidor desaparece. Descarga alguna de vez en cuando y guárdala en un sitio privado (llevan datos personales y los *hash* de las contraseñas). El hosting suele hacer además su propia copia diaria.
- **No se avisa de lo normal** (a propósito): solo hay aviso por correo cuando un patrón se repite (§11). Si quieres ver qué pasa día a día, mira Panel → Actividad.
- Los límites por IP no frenan a un atacante con **muchas** IP; para eso están el límite por cuenta (30/hora) y las contraseñas largas. Un cortafuegos delante (Cloudflare, ModSecurity) suma una capa más.

## 8. Lo que se propuso y qué se hizo

| # | Propuesta | Estado |
|---|---|---|
| 1 | **Verificación en dos pasos** para managers | ✓ **Hecho, por correo** (no por móvil) y con recuerdo de 30 días; la cuenta de quien administra puede ser «de confianza» (§10) |
| 2 | **Aviso por correo** cuando se bloquea una cuenta | ✓ **Hecho a medida**: sin avisos de rutina; solo **un** aviso cuando el patrón se repite, y entonces se pide el código en dispositivos nuevos (§11) |
| 3 | **Registro de actividad** | ✓ Hecho (§12) |
| 4 | **Copia de seguridad semanal** descargable | ✓ Hecho, con restauración (§13) |
| 5 | **CAPTCHA invisible (Turnstile)** | ✓ Hecho; **apagado hasta que pongas las claves** (§14) |
| 6 | **Desbloqueo** de cuentas por otro manager | ✓ Hecho (§11) |

Ideas para más adelante (no hacen falta ya): código de una **app de autenticación** o *passkeys* en vez del correo; un cortafuegos delante (Cloudflare o ModSecurity); actualizar `jsPDF` y `SheetJS`.

## 9. Blog del panel (entradas e imágenes)

Las entradas las escribe un manager pero las lee **cualquiera**, así que se tratan como contenido no fiable hasta el último paso (por si se pega algo de otra web o alguien roba una sesión). Guía de uso: [`BLOG.md`](BLOG.md).

| Riesgo | Medida | Cómo se prueba |
|---|---|---|
| **Código en el texto** (XSS) | El texto pasa por un conversor que solo emite una lista cerrada de etiquetas; todo lo demás se escapa y sale como texto. Enlaces solo `https://`, `http://`, `mailto:`, `tel:`, `/ruta` y `#ancla`; imágenes solo `https://` o `/ruta`. Sin HTML, sin `javascript:` | 20 000 textos hostiles al azar (`test-blog-markdown.mjs`) y `BlogMarkdownTest.php` |
| **Código en título, resumen, SEO, texto alternativo o dirección** | Texto plano (las mismas reglas que los formularios). Al pintar, todo se escapa en **un solo paso**: ni `"><script>` ni una marca interna `@@TV:…@@` escrita por una persona se vuelven a interpretar; el JSON-LD se codifica sin `<` ni `>` | `BlogPageTest.php` (BP5) |
| **Imagen disfrazada** (SVG con script, HTML con extensión `.png`…) | El servidor mira los **bytes** (no el nombre ni lo que diga el navegador): solo JPEG, PNG y WebP con medidas razonables. El nombre lleva la huella del contenido; se sirve con su tipo, `nosniff` y la CSP de la web | `BlogTest.php`, `qa-blog-apache.mjs` |
| **Llenar el disco o inundar el servidor** | 600 entradas, 1 500 imágenes, 2,5 MB por imagen, 60 000 caracteres por texto, cuerpo máximo por petición y 600 guardados / 120 subidas por usuario y hora | `BlogTest.php` |
| **Ver un borrador sin permiso** | Solo con una dirección **firmada** (HMAC con `session_secret`) de una hora, válida para esa entrada y no para otra; con `noindex`, `no-store` y sin entrar en sitemap ni `llms` | `BlogPageTest.php` (BP7) |
| **Pisarse dos personas** | Escrituras bajo bloqueo: no se repite una dirección ni se rompe un grupo de traducciones | `BlogTest.php` |
| **Usar el API del blog sin ser manager** | Sin sesión, 401; un cliente, 403; solo managers crean, editan, suben y borran | `BlogTest.php` |
| **Servir archivos de trabajo** | `api/page.php` solo responde por la dirección pedida (`REQUEST_URI`): llamarlo directamente no sirve nada; el `.htaccess` de `api/` sigue cerrando todo salvo `index.php` y `page.php` | `SecurityDataTest.php` (D10), `qa-package.mjs` |
| **Si PHP falla** | El listado, el sitemap y `llms.txt` caen al archivo estático de la compilación; una entrada da 503. El error va al registro con un identificador, nunca a la página | `BlogPageTest.php` |

**Límite conocido:** un manager puede publicar cualquier **texto** (no código): la protección es técnica, no editorial. Quien tenga rol de manager responde de lo que publica; por eso el panel solo da ese rol a quien se crea expresamente.

## 10. Acceso en dos pasos por correo

Después de la contraseña, a los **managers** se les manda un código de 6 cifras al correo de su cuenta y tienen que escribirlo para entrar. (Solo con el servidor PHP; se comporta igual en cPanel y en Plesk.)

| Regla | Valor |
|---|---|
| Validez del código | **10 minutos**, **un solo uso**; el servidor solo guarda su huella (HMAC), nunca el código |
| Intentos | **5** por código; al quinto fallo el código se descarta y hay que volver a entrar con la contraseña |
| Reenviar | Como mucho 2 veces, con **45 s** de espera entre una y otra; el código anterior deja de valer. Tope de 6 códigos por hora y cuenta |
| Bloqueo | 5 códigos erróneos de un visitante contra una cuenta, o 20 contra la cuenta desde cualquier sitio → **1 hora** (§2) |
| Correo | El asunto **no** lleva el código (no se vería en las notificaciones del móvil); el cuerpo dice desde qué dirección y a qué hora se intentó entrar |

**Recordar este dispositivo (30 días).** Al escribir el código, la casilla «Recordar este dispositivo» viene marcada (desmárcala en un ordenador compartido). Deja en ese navegador una cookie `tv_dev_…` **HttpOnly** (el JavaScript de la página no la ve), **SameSite=Strict**, solo para `/api` y con `Secure` si hay HTTPS; va firmada con la clave de sesión y atada a la cuenta, así que no sirve para otra. Deja de valer si se cambia la contraseña de la cuenta, se borra el usuario o se pulsa **Olvidar mis dispositivos recordados** (Ajustes → Tu cuenta y tu seguridad). Una cookie robada evita el código pero **sigue sin servir sin la contraseña**.

**Cuenta de confianza (la tuya).** En Panel → Usuarios, columna «Código por correo», elige «No (cuenta de confianza)», o pon su correo en `two_step.exempt` de `config.php`. Esa cuenta entra solo con su contraseña, **salvo si sufre intentos repetidos** (§11): entonces, durante 7 días, también le pide el código en los dispositivos nuevos. Cualquier manager ve en Usuarios quién es de confianza. Los clientes no piden código salvo en la protección reforzada (§11).

**No te deja fuera.** Si el correo está sin completar (Ajustes → Correo), el código **no se pide a nadie**: sería un código que no llega, y Usuarios lo avisa. Si un día el correo falla y no puedes entrar: pon `'two_step' => ['enabled' => false, 'on_attack' => false]` en `api/config.php` (así no se pide código a nadie, ni de rutina ni por ataques), entra, arregla el correo y quítalo. Si el servidor no puede mandar el código en ese momento, la persona lo lee («No hemos podido enviarte el código por correo») y queda anotado en Actividad.

## 11. Ataques repetidos, avisos y desbloqueo

**Principio: nada de avisos de rutina.** Un bloqueo suelto (alguien que se equivoca de contraseña) no manda ningún correo. Solo se avisa cuando **el patrón se repite**:

1. Una cuenta suma **3 bloqueos en 24 horas** (cada bloqueo de un visitante cuenta 1; el bloqueo de la cuenta entera, o 20 códigos erróneos, cuentan 3 de golpe: un ataque repartido).
2. Se manda **un** correo a `alert_to` (o, si está vacío, a quienes reciben los pedidos) diciendo qué cuenta y cuántos bloqueos, **sin contraseñas ni códigos**. Como mucho uno al día por cuenta.
3. **Protección reforzada 7 días**: esa cuenta (también si es de un cliente) pide el código por correo en cualquier dispositivo nuevo; el correo del código lo explica. Se ve en Usuarios como «Protección reforzada hasta …» y queda en Actividad como «Aviso: intentos repetidos».
4. **Las cuentas de confianza (§10) también**: de rutina no piden código, pero mientras dura la protección reforzada sí lo piden en los dispositivos nuevos (es cuando más falta hace). Una cuenta que no existe no genera avisos ni protección.

Se desactiva con `two_step.on_attack = false`.

**Desbloquear.** Panel → Usuarios: las cuentas bloqueadas salen con «Bloqueada · 1 h» y un botón **Desbloquear**: quita el bloqueo, pone a cero los contadores (también el de quien se bloqueó a sí mismo y el de los códigos) y, si la cuenta tiene protección reforzada, también la quita. Queda anotado en Actividad.

## 12. Registro de actividad

Panel → **Actividad** (solo managers): quién entró y quién cambió qué, con la hora y la dirección desde la que lo hizo; filtros por período, tipo, persona y texto; descarga en CSV (Excel respeta las tildes y las celdas que empiezan por `=`, `+`, `-` o `@` se neutralizan para que no se ejecuten como fórmula).

- **Qué anota**: entradas (con contraseña, con código, con dispositivo recordado), salidas, códigos enviados e incorrectos, bloqueos y avisos, altas y bajas de usuarios, cambios del código por correo y de contraseñas (sin la contraseña), desbloqueos, precios (subir hoja, sincronizar, IA), propuestas, blog, mensajes borrados, correos de prueba y copias (crear, descargar, borrar y la automática).
- **Qué no anota nunca**: contraseñas, códigos, tokens ni textos largos. El detalle son hasta 200 caracteres sin saltos de línea (un correo escrito con «\n» no puede inventar líneas del registro) y se enseña siempre escapado.
- **Fallos de contraseña**: se anotan **resumidos** (una vez cada 10 minutos por visitante y cuenta), así que un ataque no llena el registro; los bloqueos y los avisos sí se anotan siempre.
- **Dónde y cuánto**: un fichero por día en `<carpeta de datos>/audit/AAAA-MM-DD.jsonl`; 2 MB como máximo por día (al llegar se anota «Registro lleno por hoy» y se calla el resto) y **180 días** de historia. El Diagnóstico cuenta los hechos de la última semana.
- **Es un dato personal** (correos y direcciones IP): solo lo ven los managers y se borra solo a los 180 días.

## 13. Copias de seguridad y restauración

**Qué lleva** una copia: pedidos, mensajes, usuarios (con el *hash* de la contraseña, no la contraseña), precios, propuestas, entradas del blog e imágenes. **Qué no**: contadores de límites, códigos pendientes, `config.php` (los secretos nunca van a una copia) ni el registro de actividad.

- **Cuándo**: **una por semana, sola** (con la primera entrada de un manager pasada la semana, sin hacerle esperar, o con el cron diario) y cuando pulsas **Crear copia ahora** (Panel → Ajustes → Copias de seguridad) o ejecutas `php api/tools/backup.php`. Se guardan las **8 últimas** en `<carpeta de datos>/backups/`.
- **Descargar**: botón «Descargar» → enlace firmado, válido **2 minutos**, para ese archivo y esa persona; queda anotado en Actividad. **Guarda alguna fuera del servidor**: la copia está en el mismo sitio que los datos.
- **Privada**: lleva datos personales y los *hash* de las contraseñas; solo la descarga un manager y la carpeta de datos está cerrada a la web.
- **Restaurar** (a propósito se hace por línea de comandos, no desde el panel: es una operación delicada): con la terminal del hosting (cPanel «Terminal», Plesk «SSH» o «Tareas programadas»):
  1. `php api/tools/restore.php ARCHIVO.jsonl.gz --dry-run` comprueba que la copia **está entera** (tiene su cierre y los recuentos coinciden) y cuenta lo que trae, sin escribir nada.
  2. `php api/tools/restore.php ARCHIVO.jsonl.gz` restaura si la carpeta de datos está **vacía**; con `--force` sobrescribe lo que ya haya con lo que trae la copia (lo que la copia no trae se queda).
  3. No toca `config.php`; las sesiones y los dispositivos recordados siguen valiendo.
- **Ajustes** (`config.php`): `backup.auto = false` apaga la copia semanal; `backup.media = false` la hace sin imágenes. Con muchas imágenes, una copia lleva como mucho 400 MB de ellas (el resto se avisa y se deja fuera).

## 14. CAPTCHA invisible (Cloudflare Turnstile)

**Estado de entrega: apagado.** Se enciende solo cuando pones **las dos claves** en `api/config.php`; no hay que recompilar ni subir nada más. Mientras estén vacías, la web **no habla con Cloudflare** y los formularios funcionan como siempre.

**Cómo se enciende** (gratis; no hace falta mover la web a Cloudflare ni tocar los DNS):
1. Crea una cuenta en Cloudflare → *Turnstile* → **Añadir sitio** (*Add widget*).
2. Nombre «Torivac web»; dominios `grupotorivac.com` (y `torivac.santisomarketing.com` para las pruebas); modo **Gestionado** (recomendado: solo molesta a quien parece un robot) o **Invisible**.
3. Copia la **clave del sitio** (pública) y la **clave secreta**.
4. En `api/config.php` (gestor de archivos del hosting): `'turnstile_sitekey' => 'LA_CLAVE_DEL_SITIO', 'turnstile_secret' => 'LA_CLAVE_SECRETA',`. Las **dos** o ninguna.
5. Panel → Ajustes → Diagnóstico: debe decir «CAPTCHA invisible (Cloudflare Turnstile) activo…». Prueba el formulario de contacto. (En el Worker: variable `TURNSTILE_SITEKEY` y `npx wrangler secret put TURNSTILE_SECRET`.)

Para apagarlo, vacía las dos claves.

**Cómo funciona.** `/api/health` anuncia la clave **pública** solo si están las dos; el navegador entonces enseña el aviso «protegido por Cloudflare Turnstile» junto al formulario y **descarga el script de Cloudflare solo cuando alguien empieza a usar el formulario** (no pesa en la carga ni en el LCP y quien solo mira la web no habla con Cloudflare). Al enviar, el widget se ejecuta de forma invisible y el token viaja con el envío; el servidor lo comprueba con Cloudflare (`siteverify`) y **falla cerrado**. Cada token vale una vez y 5 minutos: se pide uno nuevo en cada envío. Si no se consigue (bloqueador de contenido, sin red), el formulario se envía igual sin token, el servidor lo rechaza y la página dice, en el idioma del visitante, que recargue o desactive el bloqueador, **sin perder lo escrito**. La CSP del `.htaccess` admite un único origen de terceros: `https://challenges.cloudflare.com` (scripts y marcos).

**Avisos del Diagnóstico y de `/api/health`:** el secreto **sin** la clave pública (o mal escrita) es un **fallo** (los formularios exigirían un CAPTCHA que la web no puede mostrar); la clave pública sin el secreto solo avisa («no se usa hasta que pongas las dos»).

**Privacidad.** Al usar un formulario, el navegador contacta con Cloudflare, que analiza datos técnicos del navegador y la IP para distinguir personas de robots. La web ya **no dice** «protegido por reCAPTCHA» (no usa reCAPTCHA); solo enseña el aviso de Cloudflare **cuando el CAPTCHA está activo**. Al activarlo, **conviene añadir una línea a la política de privacidad** (el texto legal lo decides tú; no se ha tocado la política existente). Propuesta: «Para proteger los formularios contra el spam usamos Cloudflare Turnstile, un servicio de Cloudflare, Inc. que analiza datos técnicos del navegador y la dirección IP en el momento del envío.»

## 15. Contraseñas: cambiar la tuya y poner una nueva a otra cuenta

- **La tuya**: Panel → Ajustes → *Tu cuenta y tu seguridad* → «Cambiar mi contraseña». Pide la actual (5 fallos por hora → bloqueo), cierra **todas** tus sesiones y olvida tus dispositivos recordados; vuelves a entrar con la nueva.
- **La de otra persona** (la olvidó, o sospechas que la conocen otros): Panel → Usuarios → «Poner una contraseña nueva a una cuenta». Cierra todas sus sesiones y olvida sus dispositivos. **Díselo por un canal seguro**; no la mandes por correo.
- Las reglas son las de siempre (§1): mínimo 12 caracteres, sin el correo dentro, sin palabras típicas y con variedad. Borrar un usuario también cierra sus sesiones.
