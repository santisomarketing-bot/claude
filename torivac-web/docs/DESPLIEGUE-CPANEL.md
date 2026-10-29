# Despliegue en un hosting con cPanel

> **¿Tu hosting es Plesk?** Es el mismo paquete y casi los mismos pasos: lee [`DESPLIEGUE-PLESK.md`](DESPLIEGUE-PLESK.md) (qué cambia, con el paso a cPanel al final). Esta guía sirve para cualquier hosting con Apache y PHP, con los nombres de menú de cPanel.

Se despliega **una sola cosa**: un `.zip` con la web estática (HTML por idioma) y la carpeta `api/` (PHP: pedidos, contacto, precios, panel). No hace falta Node, ni base de datos, ni WordPress en el hosting. La web actual de grupotorivac.com **no se toca**: se prueba en un subdominio y el cambio de dominio se hace al final.

## Resumen: 10 pasos

1. [Subdominio de pruebas](#1-subdominio-de-pruebas-y-https) con HTTPS (AutoSSL).
2. [PHP 8.1+](#2-php) con las extensiones habituales.
3. [Generar el paquete](#3-generar-el-paquete) `.zip` para ese subdominio.
4. [Subirlo y descomprimirlo](#4-subir-y-descomprimir) en la carpeta del subdominio.
5. [Carpeta de datos](#5-carpeta-de-datos-fuera-de-la-web) fuera de la web.
6. [`api/config.php`](#6-configuración-apiconfigphp) (copiando el ejemplo).
7. [Primer usuario manager](#7-primer-usuario-manager).
8. [Correo](#8-correo) (buzón del dominio por SMTP, Brevo o Resend; guía completa en [`CORREO.md`](CORREO.md)).
9. [Precios desde Drive y cron diario](#9-precios-y-cron-diario).
10. [Comprobar](#10-comprobar) con `check.php`, las URL clave y un pedido de prueba.

Después: [actualizar la web](#11-actualizar-la-web) · [pasar a producción](#12-pasar-a-producción) · [copias de seguridad](#13-copias-de-seguridad) · [si algo falla](#14-si-algo-falla) · [alternativa con Cloudflare](#15-alternativa-api-en-cloudflare-worker).

---

## 1. Subdominio de pruebas y HTTPS

1. En el DNS de grupotorivac.com (donde esté gestionado hoy) crea un registro **A** para `pruebas` apuntando a la IP del hosting nuevo. **No cambies nada más**: el dominio principal sigue en el hosting actual.
2. cPanel → **Dominios** → *Crear un nuevo dominio* → `pruebas.grupotorivac.com` (sin «compartir raíz»). La carpeta será, por ejemplo, `public_html/pruebas`.
3. cPanel → **SSL/TLS Status** → *Run AutoSSL*. Cuando el DNS haya propagado, el candado aparece solo.

> Cualquier otro dominio o subdominio sirve (p. ej. uno de la agencia). Solo cambia la URL que das en el paso 3.

## 2. PHP

cPanel → **MultiPHP Manager** → elige **PHP 8.1 o superior** (probado con 8.3; funciona desde 7.4). Extensiones necesarias (**Seleccionar versión de PHP → Extensiones**): `curl`, `mbstring`, `openssl`, `json`, `zlib`. Suelen venir activas.

## 3. Generar el paquete

En un ordenador con Node 22 y Python 3 (o con el flujo de GitHub del apartado [12](#12-pasar-a-producción)):

```bash
python3 -I scripts/package_cpanel.py --base=https://pruebas.grupotorivac.com --staging
```

Crea `entrega/torivac-web-pruebas-grupotorivac-com-AAAAMMDD.zip` y antes **verifica**: que están todos los ficheros, que no hay claves ni tests ni scripts de trabajo, que **no lleva precios**, que el PHP es válido y que la URL del API es la de la propia web.
`--staging` añade `noindex` (cabecera, meta y `robots.txt` que prohíbe todo) y una cinta «entorno de pruebas»: Google no indexa el subdominio.

**Aspecto de la web** (hay dos: «Ficha técnica», el nuevo, y «Clásico», el de la web original). En pruebas el paquete sale con la Ficha técnica por defecto y un selector «Aspecto» en la cinta y en el pie para que se comparen. Para fijar otro por defecto o quitar/poner el selector: `--theme=clasico`, `--theme-switch`, `--no-theme-switch` (en producción no hay selector salvo que lo pidas). Detalle en [`DISENO-TEMAS.md`](DISENO-TEMAS.md).

## 4. Subir y descomprimir

cPanel → **Administrador de archivos** → entra en la carpeta del subdominio → *Cargar* el `.zip` → clic derecho → **Extract**. Activa *Configuración → Mostrar archivos ocultos* para ver `.htaccess`.
Debe quedar `…/pruebas/index.html`, `…/pruebas/.htaccess`, `…/pruebas/api/index.php`, `…/pruebas/en/`, etc. (no una carpeta intermedia). Borra el `.zip`.

**Cerrar el subdominio de pruebas a tu IP (opcional, recomendable si cargas la tarifa real):** el `.htaccess` de pruebas trae un bloque comentado `Require ip 203.0.113.7`; descoméntalo con tu IP pública. No uses *Privacidad de directorios* de cPanel (contraseña): choca con la cabecera `Authorization` que usa el panel.

El `.htaccess` ya incluye: HTTPS obligatorio, un solo host (con o sin `www`), URLs limpias, las redirecciones 301 de URLs antiguas (duplicados fusionados y PDF de `/wp-content/uploads/`), compresión, caché, cabeceras de seguridad y la reescritura de `/api`. Funciona igual en Apache y en LiteSpeed.

## 5. Carpeta de datos (fuera de la web)

Pedidos, usuarios y precios se guardan como ficheros JSON. Con `storage_dir` vacío (lo normal) se usa `torivac-datos` en la carpeta personal de la cuenta (`/home/CUENTA/torivac-datos`, **fuera** de la web) y **se crea sola** al primer uso; no tienes que hacer nada. Si ahí no se pudiera crear, se usa `api/storage` (dentro de la web, protegida con `.htaccess`) y el Diagnóstico lo avisa. Si prefieres otra ruta, cámbiala en `storage_dir` (paso 6). Una carpeta que ya tiene datos no se abandona sola: para cambiar de carpeta, copia antes su contenido.

## 6. Configuración: `api/config.php`

1. En `…/pruebas/api/` copia **`config.sample.php`** como **`config.php`** y edítalo (los comentarios explican cada línea). Lo imprescindible:

| Ajuste | Qué poner |
|---|---|
| `storage_dir` | déjalo vacío (se usa `/home/CUENTA/torivac-datos`, paso 5); solo ponlo si quieres otra ruta |
| `session_secret` | 32+ caracteres aleatorios (`openssl rand -hex 32` o random.org). Cambiarla cierra todas las sesiones |
| `order_to` | `['info@grupotorivac.com', 'mzamora@torivac.com']` (confirmado; `info@` también para las pruebas) |
| `order_from` | `Torivac Web <pedidos@grupotorivac.com>` (con SMTP, el mismo buzón; con Resend o Brevo, un dominio o remitente verificado: paso 8) |
| `mail` | `driver` = `smtp` (recomendado: el buzón del dominio) con su bloque `smtp` (`host`, `port`, `secure`, `user`, `pass`); o `brevo` / `resend` con su clave. Ver [`CORREO.md`](CORREO.md) |
| `prices` | origen de la hoja de Drive (paso 9) |
| `admin_token` | solo para crear el primer manager (paso 7); **vacíalo después** |

2. Permisos recomendados de `config.php`: **640**. **No lo subas a ningún repositorio** (está en `.gitignore`).
3. Un cambio en `config.php` se aplica **al instante** (no hay caché que esperar).

## 7. Primer usuario manager

**Con Terminal** (cPanel → Terminal, o SSH):

```bash
cd ~/public_html/pruebas
php api/tools/create-user.php jefa@torivac.com "Nombre Apellido" manager "una contraseña de 12 o más caracteres"
```

**Sin Terminal**: pon un `admin_token` largo en `config.php` y, desde cualquier ordenador:

```bash
curl -X POST https://pruebas.grupotorivac.com/api/users \
  -H "Authorization: Bearer EL_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"jefa@torivac.com","name":"Nombre Apellido","role":"manager","password":"una contraseña de 12 o más caracteres"}'
```

Luego **vacía `admin_token`**. Más usuarios (managers o clientes) se crean desde el panel: **Usuarios**.

**Acceso en dos pasos (código por correo).** Con el correo ya funcionando (paso 8), a los managers se les pide un código de 6 cifras al entrar (con «recordar este dispositivo», una vez cada 30 días por navegador). **Marca tu propia cuenta como de confianza** para no tener que escribirlo: Panel → **Usuarios** → tu fila → «Código por correo» → «No (cuenta de confianza)» (o `'two_step' => ['exempt' => ['tu@correo.com']]` en `config.php`). Solo si alguien ataca tu cuenta de forma repetida, durante 7 días te lo pedirá en los dispositivos nuevos. Si el correo no está completo, no se pide código a nadie. Si alguien te bloquea la cuenta y no hay otro manager que pulse «Desbloquear», en la terminal del hosting: `php api/tools/unlock.php tu@correo.com`. Detalle en [`SEGURIDAD.md`](SEGURIDAD.md) §10 y §11.

## 8. Correo

Los pedidos y los mensajes de contacto avisan por correo a `order_to`; en los pedidos, el PDF va adjunto y el cliente recibe una copia. **Guía completa, con los errores más típicos: [`CORREO.md`](CORREO.md).** Lo esencial:

1. **Recomendado: `driver = 'smtp'` con el buzón del dominio.** Crea el buzón (*Cuentas de correo → Crear*: `pedidos@grupotorivac.com`), mira en *Conectar dispositivos* el servidor (`mail.TUDOMINIO.com`), el puerto (587 con TLS o 465 con SSL) y el usuario (la dirección completa), y rellena el bloque `mail.smtp` de `config.php`. `order_from` debe ser ese mismo buzón.
2. Alternativas con servicio externo: `brevo` (clave API v3 + remitente verificado) o `resend` (dominio verificado con SPF y DKIM; hasta entonces solo envía desde `onboarding@resend.dev` y solo a la dirección de tu cuenta).
3. Para que no vaya a spam, el dominio necesita **SPF y DKIM**: en cPanel, *Entregabilidad de correo (Email Deliverability)*.
4. **Pruébalo:** panel → **Ajustes → Correo → «Enviar correo de prueba»**. Dice «Enviado a…» o el motivo exacto del fallo.

**Qué pasa si el correo no sale** (contraseña mal, dominio sin verificar, servicio caído): **no se pierde nada**. El pedido y el mensaje de contacto se guardan igualmente y se ven en el panel (*Pedidos* y *Mensajes*) con la marca **«El aviso por correo falló»** y el motivo; el *Resumen* avisa de que «El correo no está funcionando». Al cliente la web le dice la verdad: pedido registrado, sin copia por correo y con tu correo para escribir. El visitante que usa el formulario de contacto ve «Mensaje recibido» porque **de verdad está guardado** (aunque el aviso por correo haya fallado: por eso conviene mirar *Mensajes* y arreglar el correo). `check.php` y *Ajustes → Diagnóstico* avisan si el correo no está completo.

Otras opciones de `mail.driver`: `'mail'` (función `mail()` del hosting: **sin garantías de entrega**, el servidor la da por buena en cuanto la recibe), `'file'` (no envía; deja cada correo en la carpeta `outbox` de la carpeta de datos, útil para ver cómo quedan) y `'none'` (no envía nada).

## 9. Precios y cron diario

1. Origen de la hoja de Drive: elige una de las formas de [`PRECIOS-DRIVE.md`](PRECIOS-DRIVE.md) (descarga directa del `.xlsx`, cuenta de servicio, CSV o subida manual) y rellena `prices` en `config.php`.
2. cPanel → **Trabajos de Cron** → una vez al día:

```
0 3 * * *  /usr/local/bin/php /home/CUENTA/public_html/pruebas/api/cron.php >> /home/CUENTA/torivac-datos/cron.log 2>&1
```

   (la ruta de `php` la muestra cPanel en la ayuda de la pantalla de cron). Si el hosting no deja programar por línea de comandos, pon un `cron_token` y programa `curl -fsS "https://pruebas.grupotorivac.com/api/cron?token=EL_TOKEN" > /dev/null`.
3. A mano, cuando quieras: Panel → **Precios → Actualizar ahora**.

## 10. Comprobar

**a) Autodiagnóstico** (Terminal): `php api/tools/check.php --net` — revisa PHP, extensiones, carpeta de datos, `config.php`, correo, precios, manager y salida a Internet; dice qué arreglar. También en el panel: **Ajustes → Diagnóstico** (solo managers).

**b) URL clave** (todas deben dar lo indicado):

| URL | Debe… |
|---|---|
| `https://pruebas…/` y `/en/` `/fr/` `/de/` | cargar con candado y la cinta «entorno de pruebas» |
| `…/api/health` | `{"ok":true,…}` |
| `…/api/config.php`, `…/api/lib/Config.php` | **nunca enseñar código** (401/403/404) |
| `…/robots.txt` | `Disallow: /` (pruebas) |
| `…/admin/` | pedir acceso; entrar con el manager |
| una ficha de producto | mostrar precio (o «Consultar» si aún no hay hoja) |
| `…/blog/` | el listado de entradas (las 21 de siempre por idioma, más las que escribas en el panel) |
| una URL inexistente | la página 404 del idioma |

**c) Pedido de prueba**: añadir dos referencias en una ficha → *Presupuesto* → rellenar → *Enviar pedido*. Debe salir «Pedido registrado · TV-AAAAMMDD-NNNN» y «te hemos enviado una copia», llegar a `info@` y `mzamora@` con el PDF y aparecer en el panel (**Pedidos**, sin la marca «sin aviso por correo»). Si sale «no hemos podido enviarte la copia» es que el correo no está bien configurado (paso 8).

## 11. Actualizar la web

Genera un `.zip` nuevo (paso 3) y **extrae encima** del anterior. El paquete **no contiene** `api/config.php` ni la carpeta de datos, así que no se pierde nada. El procedimiento completo (pruebas → producción, copia de seguridad, lista de comprobación y vuelta atrás) está en [`ACTUALIZAR-SIN-ROMPER.md`](ACTUALIZAR-SIN-ROMPER.md); no vacíes la carpeta antes de extraer.

## 12. Pasar a producción

1. `python3 -I scripts/package_cpanel.py --base=https://www.grupotorivac.com [--theme=ficha|clasico]` (sin `--staging`; el aspecto que se publica es el que decida Torivac, sin selector salvo `--theme-switch`; usa la URL final, con o sin `www`: el `.htaccess` fija ese host como único). Además de lo anterior ejecuta la **auditoría SEO/GEO** (H1, hreflang, canonical, JSON-LD, sitemap, enlaces).
2. Sube y extrae en la carpeta del dominio definitivo, copia `config.php` (cambia solo lo necesario, p. ej. quitar el aviso de pruebas del correo si lo habías puesto) y repite los pasos 7-10.
3. Baja el TTL del DNS unas horas antes y apunta `grupotorivac.com`/`www` al hosting nuevo. **Mantén el hosting antiguo** hasta comprobar todo.
4. Search Console: añade la propiedad y envía `https://www.grupotorivac.com/sitemap.xml`. Las URL son las mismas que las de la web original (con 301 donde había duplicados), así que el posicionamiento se conserva.
5. HSTS (un año) solo se activa en producción: asegúrate de que HTTPS funciona en todo antes de cambiar el DNS.
6. **Blog**: las entradas que escribiste en el subdominio de pruebas están en *su* carpeta de datos y no pasan a producción; escribe allí las definitivas (guía [`BLOG.md`](BLOG.md)). En producción el blog también aparece en `sitemap.xml` y en `llms.txt`/`llms-full.txt` (en pruebas no hay, porque no se indexa).

**Con GitHub**: copia `ci/deploy.yml` a `.github/workflows/deploy-cpanel.yml`; el flujo empaqueta, verifica y sube por SSH/rsync (con *simulacro* previo) o deja el `.zip` como artefacto para subirlo a mano. Secretos y variables: cabecera del fichero.

## 13. Copias de seguridad

Lo único que no se regenera es la **carpeta de datos** (pedidos 400 días, mensajes de contacto, usuarios, precios vigentes e histórico de 90 días, **entradas del blog y sus imágenes** en `media/`, el registro de actividad en `audit/` y las copias en `backups/`) y `api/config.php`. La web en sí siempre se puede volver a generar del repositorio.

**El panel ya hace copias solo**: una por semana (la primera, al entrar un manager por primera vez), se guardan las 8 últimas y se descargan desde **Ajustes → Copias de seguridad** (enlace firmado de 2 minutos). **Descarga alguna de vez en cuando y guárdala fuera del servidor**, y hazla también antes de actualizar (botón «Crear copia ahora» o `php api/tools/backup.php`). Para restaurar: `php api/tools/restore.php ARCHIVO.jsonl.gz --dry-run` (comprueba) y después sin `--dry-run` (ver [`SEGURIDAD.md`](SEGURIDAD.md) §13). La copia **no incluye `api/config.php`**: guarda ese archivo aparte (lleva tus claves). Inclúyelo también en la copia que haga cPanel.

## 14. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Error 500 en todas las páginas tras subir | El hosting no admite alguna directiva del `.htaccess` | Mira el `error_log` de la carpeta; comenta la línea indicada (suele ser `Options -Indexes` o `AddDefaultCharset`) |
| La web va pero `/api/…` da 404 | Falta el `.htaccess` (oculto) o `mod_rewrite` | Mostrar ocultos y comprobar que se extrajo; pedir a soporte `mod_rewrite` |
| Entras en el panel y vuelve a pedir acceso / 401 | El hosting no pasa la cabecera `Authorization` a PHP | Ya hay una regla en `.htaccess`; si persiste, en `api/.htaccess` añade `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` |
| «Origen no permitido» (403) | Se abre la web con otro host que el compilado (`www` frente a sin `www`) | Entrar por la URL compilada o añadir el otro origen a `allowed_origins` |
| No llegan los correos | Contraseña o remitente mal (SMTP), dominio sin verificar (Resend/Brevo), o va a spam (falta SPF/DKIM) | Panel → *Ajustes → Correo → «Enviar correo de prueba»* (dice el motivo exacto); [`CORREO.md`](CORREO.md) §6; probar con `driver = 'file'` y mirar la carpeta `outbox` de la carpeta de datos |
| Los precios no se actualizan | Origen mal configurado, archivo sin compartir o hoja rechazada | Ejecuta `php api/cron.php` y lee el mensaje; ver [`PRECIOS-DRIVE.md`](PRECIOS-DRIVE.md) §7-8 |
| Enviar un pedido o el contacto da error 403/406 aunque `/api/health` responde | **ModSecurity** (el cortafuegos del hosting) rechaza el cuerpo de la petición (lleva el PDF en base64) | Pedir a soporte una excepción para `/api/` (o que suba el límite del cuerpo); el resto de la web no se ve afectado |
| El subdominio ya tenía otra web (p. ej. un WordPress de pruebas) | El zip se extrae encima: `index.php`, `.htaccess` y plugins antiguos chocan con los nuevos | Copia de seguridad y vacía la carpeta del subdominio (o usa otro subdominio) antes de extraer |
| «No puedo escribir en el directorio de datos» | `storage_dir` mal escrito o sin permisos | Dejarlo vacío (se elige una carpeta válida) o crear la carpeta; permisos 755 y mismo usuario de la cuenta |

## 15. Alternativa: API en Cloudflare Worker

La web estática puede ir al cPanel y el API a Cloudflare (`workers/api`, plan gratuito): compilar con `TORIVAC_API=https://<worker>` en vez de `--php-api`, añadir el dominio del cPanel a `ALLOWED_ORIGINS` y seguir `workers/api/README.md`. El contrato es idéntico (los mismos guiones de prueba corren contra los dos). Con cPanel todo queda en un solo sitio y sin cuentas extra; con Worker el correo y el cron no dependen del hosting.

## Qué hace el API y qué no

- Pedidos y contacto: validación en servidor, límite por IP, *honeypot* anti-bots, Turnstile opcional, **el importe lo calcula el servidor** con sus precios.
- Panel: sesiones firmadas (HMAC) con caducidad, contraseñas con `password_hash`, bloqueo tras varios intentos, un cliente solo ve sus pedidos.
- La IA de precios **propone**, nunca aplica: una persona revisa y confirma (los cambios grandes piden confirmación extra).
- No guarda datos de tarjetas ni cobra: es un sistema de **presupuestos/pedidos** que llegan por correo.
