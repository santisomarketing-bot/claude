# Seguridad: qué protege esta web, cómo se comprobó y qué queda por hacer

Este documento cuenta, sin humo, las medidas de seguridad que lleva la web de Torivac, cómo se verifican y **cuáles son sus límites**. Vale para los dos servidores que existen (el **PHP** de cPanel/Plesk y el **Worker** de Cloudflare): se comportan igual y se prueban con las mismas pruebas.

> **Una idea para quedarte:** los datos que mandan los visitantes **nunca se consideran fiables**. El precio de un pedido lo calcula el servidor (no el navegador), todo texto se limpia y se escapa al mostrarlo, y lo que el servidor guarda lo ven solo las personas con sesión de *manager*.

## 1. Resumen de medidas

| Qué se protege | Cómo | Dónde se ve |
|---|---|---|
| **Acceso al panel (fuerza bruta)** | 5 contraseñas erróneas → bloqueo de **1 hora** (§2) | Panel: «Demasiados intentos fallidos. Vuelve a intentarlo en una hora.» |
| **Contraseñas** | Mínimo **12 caracteres**, sin tu correo dentro, sin palabras típicas («password», «123456», «torivac»…) y con variedad. Se guardan como *hash* (`password_hash` en PHP; PBKDF2 en el Worker): nadie, ni tú, puede leerlas | Al crear un usuario |
| **Sesiones** | Firmadas (HMAC), caducan a las **24 h**, atadas al usuario: borrar al usuario o pulsar *Salir* anula sus sesiones. La clave de firma (`session_secret`) tiene que tener ≥ 32 caracteres o **nadie puede entrar** (a propósito) | Ajustes → Diagnóstico |
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
- **Efecto secundario aceptado:** quien teclee mal 5 veces espera una hora (es lo que se pidió). Alguien con ganas de molestar podría bloquear la cuenta de un manager repartiendo 30 fallos entre varias IP; para ese caso, la solución es esperar la hora o, si hay prisa, borrar en la carpeta de datos (`kv/`) los ficheros que empiezan por `rl%3Algpair%3A`, `rl%3Algip%3A` y `rl%3Algacct%3A` (PHP) o, en Cloudflare, las claves KV `rl:lgpair:*`, `rl:lgip:*` y `rl:lgacct:*`.

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
| Servidor PHP | `php backend-php/api/tests/run.php` | 1502 comprobaciones, 0 fallos (con ataques reales de entrada hostil, fuerza bruta, relé de correo, SSRF…) |
| Worker | `cd workers/api && npm test` | 157 pruebas, 0 fallos |
| Texto plano (navegador = Worker = PHP) | `node scripts/test-plain-text.mjs` | 194 comprobaciones; incluye navegador sin *lookbehind* y textos hostiles de 60 000 caracteres (sin eternizarse) |
| Conversor de texto del blog | `node scripts/test-blog-markdown.mjs` | 20 000 entradas aleatorias hostiles + los casos del contrato: nunca produce HTML peligroso |
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

- **Turnstile (CAPTCHA) no está activo**: el servidor sabe verificarlo (`turnstile_secret`), pero la web **todavía no incluye el widget**. No lo actives hasta que se añada: los formularios dejarían de funcionar. Mientras tanto la defensa es la trampa, el tiempo de relleno, el texto plano y los topes.
- **El entorno de pruebas es público** (cerrado a buscadores con `noindex`, no con contraseña). No cargues la tarifa real ahí sin cerrarlo a tu IP (bloque `Require ip` del `.htaccess`).
- **Librerías de terceros del navegador** (`jsPDF`, `SheetJS` para leer Excel): son versiones antiguas. Solo procesan archivos del propio usuario en su navegador, pero conviene actualizarlas (pendiente, sin urgencia).
- **Plesk con nginx sirviendo estáticos**: si se deja activa esa opción, el `.htaccess` (cabeceras, CSP) no se aplica a HTML, CSS y JS. Se comprueba con `curl -sI https://TU-DOMINIO/ | grep -i content-security`; cómo arreglarlo está en `docs/DESPLIEGUE-PLESK.md` (paso 2).
- **Sin segundo factor** (código del móvil) al entrar en el panel, sin aviso cuando una cuenta se bloquea, sin registro de actividad ni copia de seguridad automática. Son las propuestas de abajo.
- Los límites por IP no frenan a un atacante con **muchas** IP; para eso están el límite por cuenta (30/hora) y las contraseñas largas. Un cortafuegos delante (Cloudflare, ModSecurity) suma una capa más.

## 8. Propuestas para reforzarla más (elige y se hacen)

| # | Propuesta | Qué aporta | Esfuerzo |
|---|---|---|---|
| 1 | **Verificación en dos pasos** (código del móvil) para managers | Aunque alguien robe la contraseña, no entra. Es la mejora más valiosa | Media (una sesión) |
| 2 | **Aviso por correo cuando se bloquea una cuenta** o hay muchos intentos | Te enteras de un ataque en el momento | Baja |
| 3 | **Registro de actividad** en el panel (quién entró, cuándo, desde dónde; quién cambió precios) | Saber qué pasó y quién | Baja-media |
| 4 | **Copia de seguridad semanal** de pedidos, mensajes y usuarios, descargable desde el panel | Recuperarse de un borrado o un fallo del hosting | Baja-media |
| 5 | **CAPTCHA invisible (Turnstile)** en los formularios | Frena a los robots que sí cargan la página | Media (widget + pruebas) |
| 6 | Desbloqueo de cuentas desde el panel por otro manager | Evita esperar la hora o tocar ficheros | Baja |
