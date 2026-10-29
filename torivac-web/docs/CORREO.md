# Correo: que los pedidos y los mensajes lleguen de verdad

Cuando alguien envía un pedido o un mensaje de contacto, la web hace **dos cosas por separado**:

1. **Lo guarda** en el servidor. Siempre. Pedidos en *Pedidos* y mensajes en *Mensajes* del panel (se borran solos a los 400 días).
2. **Avisa por correo** al equipo (`order_to`: `info@grupotorivac.com` y `mzamora@torivac.com`) y, en los pedidos, manda una copia al cliente.

Si el correo falla, **no se pierde nada**: el pedido o el mensaje sigue en el panel marcado «El aviso por correo falló» con el motivo. Y el panel te lo dice en el *Resumen* («El correo no está funcionando») y en *Ajustes → Correo*. Antes, el servidor daba el correo por enviado en cuanto el sistema lo aceptaba, aunque nunca llegara: ya no es así, el estado que se muestra es el real.

## 1. Elegir cómo se envía (`mail.driver` en `api/config.php`)

| `driver` | Qué es | Cuándo |
|---|---|---|
| **`smtp`** | El buzón de correo de **tu propio dominio** (el de Plesk o cPanel) | **Recomendado.** No depende de ningún servicio externo ni de cuentas nuevas. Necesitas crear el buzón y poner su contraseña |
| `brevo` | API de Brevo | Si prefieres un servicio externo con estadísticas (tiene plan gratuito; mira sus límites vigentes). Hay que verificar el remitente |
| `resend` | API de Resend | Igual que Brevo; hay que verificar el dominio (SPF y DKIM) |
| `mail` | La función `mail()` del hosting | **Último recurso.** El servidor la da por buena en cuanto la recibe, pero **nadie garantiza que llegue**: puede perderse o ir a spam y aquí no hay forma de saberlo |
| `file` | Guarda cada correo en la carpeta de datos (`outbox`) | Solo pruebas. No envía nada |
| `none` | No envía nada | Pedidos y mensajes se guardan igual y se ven en el panel |

Cualquier otro valor se trata como `none` (falla cerrado) y el panel lo marca en rojo.

## 2. Opción recomendada: SMTP con el buzón del dominio

**a) Crea el buzón.**
- **Plesk:** *Mail → Create Email Address* → `pedidos@grupotorivac.com` (o el dominio en el que estés probando) con una contraseña larga.
- **cPanel:** *Cuentas de correo → Crear*.

**b) Apunta los datos del servidor.** En Plesk, *Mail → Mail Settings* (o el correo de bienvenida del buzón); en cPanel, *Cuentas de correo → Conectar dispositivos*. Normalmente:

| Dato | Valor habitual |
|---|---|
| Servidor (`host`) | `mail.TUDOMINIO.com` (o el nombre del servidor que muestra el panel) |
| Puerto y cifrado | **587 con STARTTLS** (`secure` = `tls`) **o** 465 con SSL (`secure` = `ssl`) |
| Usuario (`user`) | la dirección **completa** (`pedidos@grupotorivac.com`) |
| Contraseña (`pass`) | la del buzón |

**c) Rellena `api/config.php`** (copiando antes `config.sample.php`):

```php
'order_from' => 'Torivac Web <pedidos@grupotorivac.com>',   // debe ser el MISMO buzón (o uno que el servidor te deje usar)
'mail' => [
    'driver' => 'smtp',
    'smtp' => [
        'host'   => 'mail.grupotorivac.com',
        'port'   => 587,
        'secure' => 'tls',
        'user'   => 'pedidos@grupotorivac.com',
        'pass'   => '…la contraseña del buzón…',
    ],
],
```

**Reglas de seguridad del cliente SMTP:** la contraseña **nunca** viaja sin cifrar a otro servidor (con `secure` = `none` y usuario y contraseña, solo se envía si el servidor es la propia máquina: `localhost`, `127.0.0.1` o `::1`); el certificado del servidor **se verifica**. Si el certificado es de otro nombre (por ejemplo conectas a `localhost` pero el certificado es de `mail.midominio.com`), pon ese nombre en `'tls_name' => 'mail.midominio.com'`. Solo como último recurso existe `'insecure_tls' => true` (no verifica nada; el diagnóstico lo marca con un aviso).

## 3. Opción alternativa: Brevo o Resend

**Brevo:** *SMTP y API → Claves API* → crea una clave (v3). *Remitentes y dominios* → verifica el remitente (`order_from`) o, mejor, el dominio. En `config.php`: `'mail' => ['driver' => 'brevo', 'brevo_api_key' => '…']`.

**Resend:** verifica el dominio de `order_from` (registros SPF y DKIM en el DNS) y pon `'mail' => ['driver' => 'resend', 'resend_api_key' => '…']`.

**Con el Worker de Cloudflare** (`workers/api`): variable `EMAIL_PROVIDER` = `resend` · `brevo` · `none` en `wrangler.toml`, y la clave como secreto: `npx wrangler secret put RESEND_API_KEY` (o `BREVO_API_KEY`). El Worker no sabe hablar SMTP; para SMTP usa el servidor PHP.

> **Las claves y contraseñas nunca se pegan en un chat, un correo ni el repositorio.** Solo van en `api/config.php` (permisos 640; no se incluye en ningún paquete) o como secreto de Cloudflare.

## 4. Que no caiga en spam: SPF y DKIM

Un correo sin firmar de un dominio que no lo autoriza acaba en spam o se rechaza. El dominio de `order_from` necesita:
- **SPF:** qué servidores pueden enviar por él. **DKIM:** la firma que demuestra que el mensaje es suyo.
- **Plesk:** *Mail → Mail Settings* del dominio → activar *Use DKIM spam protection*; el SPF lo crea Plesk si usas su DNS. **cPanel:** *Entregabilidad de correo (Email Deliverability)* → «Repair» / «Manage».
- Si el DNS lo lleva otro proveedor, copia ahí los registros que muestra el panel.
- Con Brevo o Resend, los registros te los da el propio servicio.

## 5. Probar que funciona

1. Entra en el panel → **Ajustes → Correo**: ves el controlador, si está completo y qué ajuste falta (por nombre, nunca el valor).
2. **«Enviar correo de prueba»** (vacío = a los destinatarios del pedido; o escribe tu correo). Dice «✓ Enviado a …» o **el motivo exacto** del fallo. Máximo 10 pruebas por hora y usuario.
3. Públicamente, `https://TU-DOMINIO/api/health` enseña `mail: { driver, configured, last: { ok, reason } }` **sin** el texto del error (ese solo lo ve un manager).
4. Haz un pedido y un mensaje de contacto de verdad: deben aparecer en *Pedidos* y *Mensajes* con «✓ Avisado por correo» y llegar a las dos bandejas.

## 5b. Correos de seguridad (el código de acceso y el aviso de intentos repetidos)

Con el correo bien configurado, el panel manda dos tipos de correo más (se ven en *Ajustes → Correo* como «seguridad»):

- **El código de acceso** (6 cifras, 10 minutos, un solo uso) que se pide al entrar a los managers que no son «de confianza»: el asunto no lleva el código. Detalle en [`SEGURIDAD.md`](SEGURIDAD.md) §10.
- **El aviso de intentos repetidos** (a `alert_to`, o a quienes reciben los pedidos si está vacío): **un solo correo** cuando una cuenta suma 3 bloqueos en 24 horas, como mucho uno al día. No hay avisos de rutina. §11.

Estos correos **no** salen como «último envío» en *Ajustes → Correo* ni en `/api/health` (que es público): desde fuera no debe verse cuándo alguien pidió un código. Si uno falla, queda en *Actividad*.

**Si el correo no está completo, no se pide código a nadie** (sería un código que no llega): nadie se queda fuera, y *Usuarios* lo avisa. Por eso **lo primero es dejar el correo funcionando** (apartado 5) y después comprobar que el código llega entrando desde otro navegador. Si un día el correo falla y no puedes entrar, el interruptor de emergencia es `'two_step' => ['enabled' => false, 'on_attack' => false]` en `api/config.php` (no se pide código a nadie).

## 6. Si falla: qué dice y qué hacer

| El panel muestra | Qué significa | Qué hacer |
|---|---|---|
| `SMTP: no se pudo conectar a host:587 (…)` | El servidor no responde en ese puerto o el hosting bloquea las salidas | Prueba 465 con `ssl`; en algunos hosting solo funciona el servidor `localhost` / el nombre que da el panel |
| `SMTP 535 …` | Usuario o contraseña incorrectos | El usuario es la dirección **completa**; revisa la contraseña (si lleva `'` o `\`, escápala en `config.php`) |
| `SMTP 550 …` / `553 …` / «Sender address rejected» | El servidor no deja usar ese remitente | `order_from` debe ser el buzón con el que inicias sesión |
| `SMTP: el servidor … no ofrece STARTTLS` | Estás usando `tls` en un puerto que no es 587 | Cambia a `ssl` con 465, o revisa el puerto |
| `… certificate verify failed` | El certificado es de otro nombre | `tls_name` con el nombre del certificado (ver 2c) |
| `Resend 403 …` / `Brevo 401 …` | Dominio o remitente sin verificar, o clave equivocada | Verifica el dominio/remitente; vuelve a copiar la clave |
| `Falta configurar: mail.smtp.host…` | Faltan ajustes | Complétalos en `config.php` |
| `mail()` dice «Enviado» pero no llega | `mail()` no garantiza nada | Pasa a `smtp` |

Si el panel dice «Enviado» y aun así no llega: mira la carpeta de spam y los registros del buzón; falta SPF/DKIM (apartado 4).

## 7. Resumen técnico (para quien programe)

- Código: `backend-php/api/lib/Mail.php` (controladores, composición de correos, estado), `lib/Smtp.php` (cliente SMTP propio: STARTTLS/SSL con verificación, AUTH PLAIN/LOGIN, temporizador global), `lib/Messages.php` (mensajes de contacto); en el Worker `workers/api/src/email.js`, `messages.js`, `mailstate.js`, `mailapi.js`.
- Cada envío devuelve `{ ok, reason: sent | off | failed | skipped, error?, driver }`; el error es corto (≤ 160 caracteres) y **sin secretos** (`Mail::scrub`). El último intento queda en la clave `mail:last` (salvo los correos de seguridad, que no se anotan ahí: `/api/health` es público).
- Endpoints de manager: `GET /api/messages`, `DELETE /api/messages/:id`, `POST /api/mail/test`, `GET /api/mail/status`. Público: `GET /api/health` (sin el texto del error).
- Pruebas: `php backend-php/api/tests/run.php Mail` / `Smtp` / `Messages` (el cliente SMTP se prueba contra un servidor falso en 127.0.0.1: STARTTLS, AUTH, rechazos, temporizadores, inyección de cabeceras), `cd workers/api && npm test`, y `node scripts/qa-admin-live.mjs [--php]` (panel: Mensajes, Correo, prueba y fallo explicado).
