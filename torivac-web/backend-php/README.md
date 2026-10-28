# backend-php · el API de Torivac para hosting con cPanel o Plesk

El **mismo contrato** que `workers/api` (Cloudflare), escrito en PHP 7.4+ sin Composer ni base de datos: pedidos por correo con PDF, contacto, precios desde una hoja de Drive,
login de managers y clientes, IA de precios (propone, no aplica), propuestas del panel y cron diario. La web (`site/`) y las pruebas de navegador no distinguen uno de otro.

```
backend-php/api/
  index.php          punto de entrada (el .htaccess de la web reescribe /api/* hasta aquí)
  cron.php           sincroniza los precios (cPanel → Trabajos de Cron · Plesk → Tareas programadas, una vez al día)
  config.sample.php  copiar como config.php (claves; no se versiona)
  .htaccess          solo index.php es accesible; el resto (php, json) denegado
  lib/               Router · Orders · Messages · Prices (+Sheets) · PriceSheet · Xlsx · Auth (+Users) · Ai · Mail · Smtp · PlainText (+PlainTextRules, generado) · Request (+Response, Cors, RateLimit) · Store · Catalog · Config · Diag · Http · Util
  tools/             create-user.php (primer manager) · check.php (autodiagnóstico)
  generated/         catalog.json (referencias pedibles; lo escribe site/build.mjs)
  tests/             php tests/run.php
```

- **Datos**: ficheros JSON en una carpeta (`storage_dir`; vacío = `Store::bootstrap` elige `/home/CUENTA/torivac-datos`, fuera de la web, o `api/storage` si ahí no se puede crear, como en Plesk), escritura atómica y `flock` en contadores y límites de uso. Claves: `user:`, `order:`, `msg:` (mensajes de contacto, 400 días), `mail:last` (último intento de envío), `prices:current|meta|history:`, `proposals:state`, `rl:`, `counter:` y `counter:ct:`.
- **Seguridad**: lo que llega del navegador no es fiable (se valida y el importe lo recalcula el servidor); contraseñas con `password_hash`; sesiones HMAC con caducidad; límites por IP (la IP sale de `REMOTE_ADDR`; solo detrás de un proxy de confianza —nginx de Plesk, Cloudflare, `trusted_proxies`— se lee `X-Forwarded-For`); CORS por lista; honeypot; Turnstile opcional.
- **Correo y mensajes**: `mail.driver` = `smtp` (el buzón del dominio; cliente propio en `Smtp.php`: STARTTLS o SSL con certificado verificado, AUTH PLAIN/LOGIN, nunca la contraseña sin cifrar a otro servidor) · `brevo` · `resend` · `mail` · `file` · `none` (ver `config.sample.php`). Cada envío devuelve `reason` (`sent`·`off`·`failed`·`skipped`) y un `error` corto y SIN secretos, y anota `mail:last`. `POST /api/contact` guarda SIEMPRE el mensaje (`Messages.php`) antes de intentar el correo y responde `{ok, id, emailed:{sent, reason}}`; el panel lista `GET /api/messages`, borra con `DELETE /api/messages/:id`, prueba con `POST /api/mail/test` y consulta `GET /api/mail/status` (también `mail` en `/api/health`, sin errores ni secretos).
- **Formularios**: solo texto plano con límites (`PlainText.php`, generado desde `shared/plain-text.mjs`: sin etiquetas, scripts, SQL, plantillas, consola ni más de 2 enlaces; contacto: mensaje 1000, nombre 80; pedido: notas 500, empresa 120, nombre 80, teléfono 40) y antispam por tiempo (`_e`, `form_min_fill_ms`). **Acceso**: 5 contraseñas erróneas del mismo visitante contra una cuenta la bloquean 1 hora (más 15 por visitante y 30 por cuenta, 1 hora), con el mismo 429 exista o no la cuenta.
- **Lectores compartidos con el Worker**: `shared/price-sheet.mjs` ⇄ `lib/PriceSheet.php` y `shared/xlsx.mjs` ⇄ `lib/Xlsx.php`, probados con los mismos casos (`shared/price-sheet.fixtures.json`, `shared/xlsx/`).
- **Despliegue**: `scripts/package_cpanel.py` empaqueta y verifica (el mismo paquete para cPanel y Plesk); guías paso a paso en `docs/DESPLIEGUE-CPANEL.md` y `docs/DESPLIEGUE-PLESK.md`. **Diagnóstico**: `php api/tools/check.php --net` o, como manager, `GET /api/diag`.
- **Pruebas**: `php api/tests/run.php [filtro]` (sin PHPUnit; el filtro carga solo los `*Test.php` cuyo nombre lo contiene; `SmtpTest.php` lanza un servidor SMTP falso en 127.0.0.1) y, desde la raíz de torivac-web, `node scripts/qa-live.mjs --php`, `qa-admin-live.mjs --php`, `qa-tarifa.mjs --php`, `qa-package.mjs`.

Convención: textos y mensajes en castellano; en cadenas entre comillas dobles, una variable pegada a `»` se escribe `{$var}` (PHP lee `»` como parte del nombre).
