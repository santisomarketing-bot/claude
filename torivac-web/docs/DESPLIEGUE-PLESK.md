# Despliegue en un hosting con Plesk (y paso posterior a cPanel)

Es **el mismo paquete** que para cPanel: un `.zip` con la web estática y la carpeta `api/` (PHP). `scripts/package_cpanel.py` conserva ese nombre por historia, pero vale para cualquier hosting con **Apache y PHP 7.4+**. Esta guía cuenta solo lo que cambia en Plesk; lo demás está en [`DESPLIEGUE-CPANEL.md`](DESPLIEGUE-CPANEL.md) (mismos pasos, mismos ajustes de `config.php`).

> **Qué está comprobado y qué no.** El API PHP y el paquete se prueban en automático: pruebas de PHP, navegador contra el API, el paquete tal como se sube y, **sobre un Apache real con PHP-FPM** (`scripts/qa-apache.mjs`), el `.htaccess` de verdad (URLs limpias, redirecciones, 404 por idioma, ficheros ocultos, sondeos de WordPress, cabeceras y CSP, gzip y caché, carpeta `api/` cerrada, cabecera `Authorization`, HTTPS, un solo host, sitemap y `llms.txt`). **Lo que no se ha podido probar es un Plesk real**: el nginx que va delante de Apache, qué IP ve PHP, qué carpetas se pueden escribir. Eso se ha contrastado con la documentación de Plesk y el **Diagnóstico** (`php api/tools/check.php` o el panel, *Ajustes → Diagnóstico*) dice si algo no encaja. Los nombres de menú van en inglés, como en Plesk por defecto; en español son parecidos y pueden variar un poco según la versión.

## ¿Hay mucha diferencia entre Plesk y cPanel?

**No: el código, el paquete y los ajustes son los mismos.** Cambian cinco cosas, y solo una puede dar un disgusto si se pasa por alto (la primera):

| | cPanel | Plesk | Qué hacer en Plesk |
|---|---|---|---|
| **Quién atiende** | Apache (o LiteSpeed): el `.htaccess` se aplica a todo | **nginx delante de Apache** por defecto. Con PHP «servido por nginx», o con nginx sirviendo directamente los ficheros estáticos, **el `.htaccess` se ignora** (en esos casos) | Elegir *FPM application served by Apache* y no activar *Serve static files directly by nginx* (paso 2) |
| **Carpeta de datos** | `/home/CUENTA/torivac-datos`, fuera de la web, **se crea sola** | La raíz de la cuenta (`/var/www/vhosts/…`) normalmente **no se puede escribir** con el usuario de la web: los datos caen en `api/storage` (dentro de la web, protegida con `.htaccess`) | Para pruebas vale; para la tarifa real o producción, sacarla de la web (paso 5) |
| **Correo, cron, HTTPS** | SMTP del buzón (o Brevo/Resend) · *Cron Jobs* · AutoSSL | SMTP del buzón (o Brevo/Resend) · *Scheduled Tasks* · *SSL It!* / Let's Encrypt | Pasos 8, 9 y 1 |
| **Terminal** | *Terminal* en el panel | Solo si quien administra el servidor da acceso SSH | Todo se puede hacer sin terminal (paso 7) |
| **Cortafuegos ModSecurity** | A veces | Suele venir activo | Si un pedido da 403/406 (paso 10) |

Lo que **no** cambia: el `.zip`, el `.htaccess` generado, `config.php`, el correo (mismo `mail.driver`), el origen de precios de Drive, el panel, los usuarios. La IP real del visitante (que usan los límites de uso) también funciona sola: Plesk lo resuelve con `mod_remoteip` y, si no lo hiciera, el API lee `X-Forwarded-For` del nginx de forma segura.

## Pasos (los mismos 10; solo se detalla lo distinto)

### 1. Subdominio y HTTPS
**Websites & Domains → Add Subdomain** → `torivac.santisomarketing.com`. Plesk propone una carpeta de documentos (normalmente con el nombre del subdominio): anótala, ahí se descomprime el `.zip`. Después, **SSL/TLS Certificates** del subdominio → certificado gratuito de **Let's Encrypt** (*SSL It!*). El `.htaccess` ya fuerza HTTPS; no hace falta marcar la redirección de Plesk (si la marcas, no pasa nada: hacen lo mismo).

### 2. PHP: que lo ejecute Apache
En el subdominio: **PHP Settings** →
- Versión **8.1 o superior** (probado con 8.3; funciona desde 7.4).
- **Run PHP as → «FPM application served by Apache»**. Es el ajuste importante: con *«served by nginx»* el servidor no lee el `.htaccess` y fallan las URL limpias, la ruta `/api`, las cabeceras de seguridad y las redirecciones (el Diagnóstico lo avisa: línea *«Servidor web»*). Si esa opción no aparece, activa **Apache & nginx Settings → Proxy mode** del dominio.
- `post_max_size` y `upload_max_filesize` de **8M o más** (un pedido con PDF grande) y `memory_limit` de 128M o más.
- Extensiones `curl`, `mbstring`, `openssl`, `json`, `zlib`: vienen activas en la instalación normal de Plesk.

Y en **Apache & nginx Settings** del mismo dominio: deja **desmarcada** *Serve static files directly by nginx*. Con ella, nginx entrega HTML, CSS, JS, imágenes y fuentes **sin pasar por Apache**, y con eso se pierden las cabeceras de seguridad (CSP…), la cabecera `noindex` del entorno de pruebas, la caché y el cierre por IP del `.htaccess` (Plesk lo documenta así). Si tras desmarcarla siguen faltando cabeceras (se comprueba en el paso 10), desmarca también *Smart static files processing*: así Apache sirve todo él mismo.

### 3. Generar el paquete
```bash
python3 -I scripts/package_cpanel.py --base=https://torivac.santisomarketing.com --staging
```
Crea `entrega/torivac-web-torivac-santisomarketing-com-pruebas-AAAAMMDD.zip` (`--staging`: `noindex` en cabecera, meta y `robots.txt`; cinta «entorno de pruebas» y selector de aspecto). El paquete se **verifica** antes de entregarse (ficheros, sin claves ni precios, PHP válido, URL del API).

### 4. Subir y descomprimir
**Files** → carpeta del subdominio → *Upload* del `.zip` → clic en el `.zip` → **Extract Files**. Debe quedar `index.html`, `.htaccess` y `api/index.php` directamente en la carpeta (no dentro de otra). Si Plesk dejó una página de bienvenida (`index.html`/`index.php`), el zip la sustituye; si el subdominio tenía otra web, vacíalo antes (ver el recuadro de abajo). **Para actualizar, extrae encima** (el paquete no lleva `api/config.php` ni datos; el procedimiento completo está en [`ACTUALIZAR-SIN-ROMPER.md`](ACTUALIZAR-SIN-ROMPER.md)); si alguna vez vacías la carpeta, **conserva `api/config.php` y `api/storage/`**: ahí están tu configuración y, si no usas B o C del paso 5, tus datos.

> **Si el subdominio ya tiene un WordPress (u otra web): bórralo antes, no pegues el zip encima.** Los archivos de WordPress (`wp-config.php` con la clave de su base de datos, `wp-login.php`, `wp-admin`, plugins) se quedarían junto a la web y a los datos de Torivac: una puerta abierta si no se actualiza.
> 1. *Hosting Settings* del subdominio → mira el **Document root** y vacía **solo esa carpeta**. Si es `httpdocs` (la del dominio principal), no borres nada: primero dale al subdominio una carpeta propia. El usuario del sistema es el de toda la suscripción, así que nada fuera de esa carpeta.
> 2. Si hay algo que conservar, copia de seguridad antes (WordPress Toolkit → *Back up*, o descarga la carpeta desde *Files*).
> 3. Con WordPress Toolkit: abre la instalación → **Remove** (archivos y base de datos). Sin él: *Files* → *Show hidden files* → seleccionar todo → *Remove*; y en *Databases*, borra la base de datos de ese WordPress.
> 4. Sube y extrae el `.zip` en la carpeta vacía.

No protejas el subdominio con **Password-Protected Directories** (contraseña HTTP): choca con la cabecera `Authorization` del panel. Para cerrarlo a tu IP, descomenta en el `.htaccess` el bloque `Require ip` de pruebas.

### 5. Carpeta de datos
Hay tres maneras; el Diagnóstico dice cuál se está usando:

| | Cómo | Cuándo |
|---|---|---|
| **A. Sin hacer nada** | Si la raíz de la cuenta se pudiera escribir, los datos van solos a `torivac-datos` junto a la web (fuera de ella); lo normal es que no, y entonces van a `api/storage` (dentro de la web, con un `.htaccess` que lo prohíbe todo). El Diagnóstico dice cuál | Pruebas con precios de demostración o datos sin importancia |
| **B. Sin permisos de administrador** | En el subdominio: **Hosting Settings → Document root** = una subcarpeta (p. ej. `torivac.santisomarketing.com/web`); extrae el `.zip` **ahí** y crea al lado la carpeta `datos` con el *File Manager*. Así `datos` queda **fuera** de la web y la crea tu usuario. En `config.php`: `'storage_dir' => '/var/www/vhosts/santisomarketing.com/torivac.santisomarketing.com/datos'` | Recomendado en cuanto cargues la tarifa real o pedidos reales |
| **C. Con acceso root (SSH)** | Quien administra el servidor crea la carpeta junto a la web y le da el mismo dueño: `mkdir /var/www/vhosts/DOMINIO/torivac-datos` · `chown --reference=/var/www/vhosts/DOMINIO/httpdocs /var/www/vhosts/DOMINIO/torivac-datos` · `chmod 750 /var/www/vhosts/DOMINIO/torivac-datos`; y en `config.php`: `'storage_dir' => '/var/www/vhosts/DOMINIO/torivac-datos'` | Igual que B; también vale para varias webs |

- Si empezaste en A y pasas a B o C, **copia antes el contenido** (`api/storage/kv`, `outbox`…) a la carpeta nueva y después escribe `storage_dir`: una carpeta de datos que ya tiene datos **no se abandona sola** (así nunca se parten los pedidos entre dos sitios).
- Con A, comprueba que la protección funciona: abre `https://torivac.santisomarketing.com/api/storage/index.html` → debe dar **Prohibido (403)**, nunca una página en blanco. Si se abriera, activa B o C antes de guardar nada real. (Una causa posible: la opción *Serve static files directly by nginx*, que deja a nginx servir ficheros sin consultar el `.htaccess`.)
- `open_basedir` (el límite de carpetas de PHP) permite por defecto toda la cuenta (`/var/www/vhosts/DOMINIO`), así que B y C no necesitan tocarlo.

### 6. `api/config.php`
Igual que en cPanel ([paso 6](DESPLIEGUE-CPANEL.md#6-configuración-apiconfigphp)): copia `config.sample.php` como `config.php` (permisos 640) y rellena `session_secret`, `order_to`, `order_from`, `mail` y `prices`. **`storage_dir` déjalo vacío** salvo que uses B o C. `order_from` debe ser una dirección de un dominio **verificado en Resend**: en pruebas, el dominio desde el que vas a enviar (p. ej. `santisomarketing.com` si las pruebas viven ahí); en producción, `grupotorivac.com`.

### 7. Primer usuario manager (sin terminal)
Pon un `admin_token` largo en `config.php` y, desde cualquier ordenador:
```bash
curl -X POST https://torivac.santisomarketing.com/api/users \
  -H "Authorization: Bearer EL_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"jefa@torivac.com","name":"Nombre Apellido","role":"manager","password":"una contraseña de 12 o más caracteres"}'
```
y **vacía `admin_token`** después. (Con SSH: `php api/tools/create-user.php correo "Nombre" manager "contraseña"`.)

**Código por correo al entrar**: con el correo funcionando (paso 8), a los managers se les pide un código de 6 cifras (recordando el navegador 30 días). **Marca tu cuenta como de confianza** en Panel → Usuarios → «Código por correo» → «No (cuenta de confianza)» para no escribirlo (solo si alguien ataca tu cuenta de forma repetida te lo pedirá, 7 días y en dispositivos nuevos). Si el correo no está completo, no se pide a nadie. Si alguien te bloquea la cuenta y no hay otro manager que pulse «Desbloquear», en el SSH de Plesk: `php api/tools/unlock.php tu@correo.com`. Más en [`SEGURIDAD.md`](SEGURIDAD.md) §10 y §11.

### 8. Correo
Igual que en cPanel ([paso 8](DESPLIEGUE-CPANEL.md#8-correo)) y con la guía completa en [`CORREO.md`](CORREO.md). En Plesk lo más sencillo es **SMTP con el buzón del dominio**: **Mail → Create Email Address** (`pedidos@torivac.santisomarketing.com` o el del dominio principal), servidor `mail.TUDOMINIO` (el que muestra *Mail → Mail Settings*), puerto 587 con `secure = 'tls'` (o 465 con `ssl`), usuario = la dirección completa. Para SPF y DKIM: *Mail → Mail Settings* del dominio → *Use DKIM spam protection*. Después, **Ajustes → Correo → «Enviar correo de prueba»** en el panel. Si el correo no sale, **el pedido y el mensaje se guardan igual** y se marcan «El aviso por correo falló» con el motivo.

### 9. Precios y cron diario
Origen de la hoja: [`PRECIOS-DRIVE.md`](PRECIOS-DRIVE.md). Para la sincronización diaria: **Scheduled Tasks → Add Task** → tipo **Run a PHP script** → ruta `…/api/cron.php` (p. ej. `/var/www/vhosts/santisomarketing.com/torivac.santisomarketing.com/api/cron.php`), PHP 8.x, *Daily* a las 03:00; marca recibir por correo solo los errores. Sin esa opción: tipo **Fetch a URL** con `https://torivac.santisomarketing.com/api/cron?token=EL_TOKEN` (pon `cron_token` en `config.php`). La tarea corre con el usuario de la web, el mismo que escribe los datos.

### 10. Comprobar
Igual que en cPanel ([paso 10](DESPLIEGUE-CPANEL.md#10-comprobar)): URL clave, **Ajustes → Diagnóstico** del panel y un pedido de prueba. En Plesk fíjate además en estas líneas del Diagnóstico:

| Línea | Debe decir | Si no |
|---|---|---|
| *Servidor web* | `Apache…` | `nginx…` sin Apache → paso 2 (PHP servido por Apache) |
| Cabeceras (a mano: `curl -sI https://torivac.santisomarketing.com/ \| grep -i -E 'content-security\|x-robots'`) | Las dos (en pruebas) | Faltan → nginx sirve los estáticos sin leer el `.htaccess`: paso 2 (desmarcar *Serve static files directly by nginx* y, si hace falta, *Smart static files processing*). Sin ellas la web funciona igual y el entorno de pruebas sigue sin indexarse (meta `noindex` y `robots.txt`), pero no queda cerrado a tu IP |
| *IP del visitante* | «El servidor ve la IP real…» o «Hay un proxy delante… se lee de sus cabeceras» | «Todas las visitas llegan con la IP interna…» → el proxy no pasa la IP real; pide que envíe `X-Forwarded-For` o añade el proxy a `trusted_proxies` |
| *Blog* | «Blog del panel listo: N publicada(s)…» | «Faltan las plantillas del blog»: paquete subido a medias (extráelo entero encima). Si tras publicar una entrada el panel avisa «la web todavía no la muestra (error 404)», nginx está sirviendo sin pasar por Apache: paso 2. Ver [`BLOG.md`](BLOG.md) §7 y §9 |
| *Carpeta de datos* | fuera de la web (B o C) | dentro de la web (A): válido para pruebas; ver paso 5. Ahí también viven las entradas del blog y sus imágenes |
| *Carpeta de datos (desvío)* | no aparece | `storage_dir` apuntaba a un sitio que no se puede escribir y se usó otro: corrige `storage_dir` o vacíalo |

## Si algo falla en Plesk

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La web carga pero `/api/…` da 404, o faltan las URL limpias | PHP «servido por nginx»: el `.htaccess` no se lee | Paso 2: *FPM application served by Apache* (y *Proxy mode* activo) |
| Faltan las cabeceras de seguridad o `Require ip` no restringe nada | nginx sirve los estáticos directamente | Paso 2: desmarcar *Serve static files directly by nginx* (y si hace falta *Smart static files processing*) |
| Enviar un pedido da 403/406 aunque `/api/health` responde | **ModSecurity** (*Tools & Settings → Web Application Firewall*) rechaza el cuerpo, que lleva el PDF en base64 | Poner ModSecurity del dominio en *Detection only* o desactivar la regla que salta (se ve en el registro de ModSecurity); el resto de la web no se afecta |
| Error 500 en todo | Alguna directiva del `.htaccess` | Registro de errores del dominio (**Logs**); comentar la línea indicada |
| «El servidor no puede escribir en su directorio de datos» | `storage_dir` mal escrito o sin permisos | Dejarlo vacío, o crear la carpeta con el mismo dueño que la web (paso 5) |
| Los límites de uso o el bloqueo de intentos afectan a todos a la vez | PHP ve la misma IP interna para todos | Línea *IP del visitante* del Diagnóstico (arriba) |
| Entrar al panel vuelve a pedir acceso (401) | La cabecera `Authorization` no llega a PHP | Ya hay una regla en el `.htaccess`; si persiste, ver la tabla de [cPanel](DESPLIEGUE-CPANEL.md#14-si-algo-falla) |

## Cuando se pase a cPanel

1. **Paquete nuevo** con la URL final y sin `--staging`: `python3 -I scripts/package_cpanel.py --base=https://www.grupotorivac.com [--theme=ficha|clasico]`. El de pruebas no sirve (lleva `noindex` y la URL de pruebas).
2. **`config.php`**: se copia casi entero (`order_to`, `mail`, `prices`…). Cambia o **vacía `storage_dir`**: una ruta de Plesk (`/var/www/vhosts/…`) no existe allí; si se deja, el API se desvía solo a un sitio válido y el Diagnóstico lo avisa, pero es mejor dejarlo vacío (en cPanel se crea `/home/CUENTA/torivac-datos`, fuera de la web, sin hacer nada). `session_secret` nuevo (se cierran las sesiones de pruebas).
3. **Datos de pruebas**: lo normal es empezar limpio (crear los managers otra vez, paso 7) y no llevar los pedidos de prueba. Si hay que conservar usuarios: copiar `kv/user%3A*.json` de la carpeta de datos antigua a la nueva.
4. **Cron** (*Cron Jobs*): `0 3 * * * /usr/local/bin/php /home/CUENTA/public_html/api/cron.php` ([paso 9 de cPanel](DESPLIEGUE-CPANEL.md#9-precios-y-cron-diario)). **HTTPS**: AutoSSL.
5. **Correo**: con SMTP, crea el buzón en cPanel y cambia `mail.smtp` (host, usuario, contraseña) y `order_from`; con Resend o Brevo, verifica `grupotorivac.com`. Luego «Enviar correo de prueba».
6. **ModSecurity** en cPanel: si un pedido da 403/406, pedir a soporte una excepción para `/api/`.
7. El `.htaccess` es el mismo (Apache o LiteSpeed): nada que tocar. Después, DNS y Search Console como en [Pasar a producción](DESPLIEGUE-CPANEL.md#12-pasar-a-producción).
