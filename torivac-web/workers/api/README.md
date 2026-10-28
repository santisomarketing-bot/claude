# torivac-api · Worker de producción (Cloudflare)

Un solo Worker para todo lo que la web estática no puede hacer sola. **No está desplegado**: el demo
(`dist/`) simula estos pasos en el navegador. Este Worker es el reemplazo real, con la misma API que
usa `site/assets/js/quote-page.js`.
> **Alternativa para hosting con cPanel:** `backend-php/api` implementa exactamente este mismo contrato en PHP (sin base de datos); ver `docs/DESPLIEGUE-CPANEL.md`. La web, el panel y las pruebas de navegador funcionan igual con uno u otro.

| Función | Ruta | Quién |
|---|---|---|
| Salud (y aviso de ajustes inseguros, solo nombres) | `GET /api/health` | público |
| Precios vigentes | `GET /api/prices` | público (caché 5 min) · un manager ve además quién cargó la hoja y `sync`: el estado del último intento de sincronización |
| Enviar pedido | `POST /api/order` | público (límite por visitante y global, Turnstile opcional) |
| Enviar contacto | `POST /api/contact` | público |
| Login / sesión / cerrar sesión | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | público / sesión |
| Pedidos | `GET /api/orders` | manager: los 300 más recientes (últimos 120 días) · cliente: los suyos (hasta 100), sin IP |
| Refrescar precios ahora | `POST /api/prices/refresh` | manager |
| Subir hoja de precios (vista previa/aplicar) | `POST /api/prices/upload` | manager |
| Usuarios | `GET/POST /api/users`, `DELETE /api/users/:email` | manager |
| Instrucción de precios con IA (propone, no aplica) | `POST /api/prices/ai` `{instruction}` | manager (15 consultas / 10 min) |
| Aplicar lo propuesto tras revisarlo | `POST /api/prices/ai/apply` `{changes, confirm_large?}` | manager |
| Decisiones sobre propuestas del panel | `GET/POST /api/proposals/state` | manager |
| Propuestas de cambio y cobertura del catálogo (datos internos de gestión) | `GET /api/admin/data` | manager (lee `src/generated/admin-data.js`, que escribe `site/build.mjs`) |

Cron: `0 3 * * *` (UTC) sincroniza precios cada 24 h y limpia los registros de límites caducados. La actualización manual es el botón del panel.

## Cómo funciona un pedido
1. El navegador manda `{customer, lines:[{ref, qty}], pdf?, copy?}` (los precios que envíe se **ignoran**). Todo texto debe ser una cadena; los campos de una línea
   (nombre, empresa, teléfono, correo) no admiten saltos ni caracteres de control; el correo es estricto; `ref` debe ser una referencia **propia** del catálogo.
2. El Worker valida cada referencia contra `src/generated/items.js` (lo genera `site/build.mjs`), valora con los precios de KV (tramos por cantidad, línea redondeada
   a 2 decimales) y numera **`TV-AAAAMMDD-NNNN-XXX`** (`XXX` = 3 caracteres aleatorios base36: dos pedidos simultáneos ya no se pisan; los pedidos antiguos sin sufijo se siguen leyendo).
3. Guarda el pedido en KV (`order:<número completo>` y, para «mis pedidos» del cliente, `uorder:<sha256(correo)[:32]>:<número>`) y envía por Resend:
   - **al equipo** (`ORDER_TO`): los datos del cliente, las líneas valoradas por el servidor y el **PDF que fabricó el navegador** (se valida de verdad: base64 estricto,
     empieza por `%PDF-`, ≤ 4 MB; si no, 400 «PDF adjunto no válido»), con la nota de que el importe que vale es el del servidor;
   - **al cliente** (copia): **solo contenido generado por el servidor** (texto fijo en el idioma del pedido, número, líneas, total y «Si no has pedido tú este presupuesto, ignora
     este mensaje»), asunto fijo `Torivac · copia de tu presupuesto <número>` y **sin adjunto**: nada de lo que escribió el visitante sale hacia un tercero.
   Sin `RESEND_API_KEY` no falla: guarda el pedido y avisa de que no se envió.
4. Respuesta: `{ ok, number, total, unpriced, emailed: { team, customer, skipped, customer_reason } }` con `customer_reason` = `sent` · `not_requested` (el visitante mandó `copy:false`) ·
   `off` · `limit` (tope de copias superado) · `failed` (Resend rechazó el envío) · `skipped` (correo sin configurar).

## Seguridad: ajustes y límites
| Ajuste | Valor |
|---|---|
| `SESSION_SECRET` (secreto) | ≥ 32 caracteres aleatorios y sin «CAMBIA-ESTO». Si no se cumple: el login responde 500 «Configuración insegura: SESSION_SECRET …» y ninguna sesión vale |
| `ADMIN_API_TOKEN` (secreto) | ≥ 32 caracteres. Si es más corto el token maestro queda desactivado (siempre 401). `GET /api/health` los marca con el **nombre** del ajuste, nunca el valor: `"config":{"ok":false,"problems":["SESSION_SECRET"]}` (si todo está bien, no hay clave `config`) |
| `ORDER_COPY` | `capped` (por defecto) o `off`; cualquier otro valor cuenta como `off` |
| `ORDER_COPY_DAILY_MAX` | copias totales al día (150 por defecto); además, **2 copias por destinatario cada 24 h** (clave con hash del correo) |
| `ORDERS_PER_HOUR_MAX` | pedidos globales por hora (120 por defecto), además de 8 por visitante cada 10 min → 429 |
| `FORM_MIN_FILL_MS` | milisegundos mínimos entre cargar la página y enviar un formulario (1200 por defecto; `0` = no se exige). Un robot que envía sin cargar la página queda fuera |
| `TURNSTILE_SECRET` | recomendado en producción (sin él, la protección contra bots descansa solo en los topes) |

- **Clave por visitante**: IPv4 tal cual; IPv6 agrupada por su **/64**; `::ffff:a.b.c.d` es su IPv4 (`ipKey` en `src/util.js`, casos en `shared/ip-key.fixtures.json`).
- **Login (fuerza bruta)**: **5 contraseñas erróneas** del mismo visitante contra una cuenta la **bloquean 1 hora** (desde el 5.º fallo; el bloqueo no se alarga y, mientras dura, ni la contraseña correcta entra: no se llega a comprobar). Además, **15 fallos por hora desde un mismo visitante** (contra cualquier cuenta) lo bloquean 1 hora, y **30 por hora contra una misma cuenta** (desde cualquier sitio) la bloquean 1 hora. Un correo que no existe cuenta igual que uno que sí (no se puede averiguar qué cuentas hay). El bloqueo responde **429** `{ok:false, error:"Demasiados intentos fallidos. Vuelve a intentarlo en una hora.", retry_after}` con la cabecera `Retry-After`; un acceso correcto pone a cero los contadores de ese visitante+cuenta y de la cuenta. Aparte, 30 intentos en 10 min por visitante cortan la inundación (mismo 429 de siempre «Demasiados intentos. Espera unos minutos.»). Un Bearer inválido cuenta como fallo (30 / 10 min por visitante); las peticiones válidas no consumen cupo.
- **Formularios (`/api/contact`, `/api/order`)**: **solo texto plano y con límite** (`shared/plain-text.mjs`, el mismo validador que usa el navegador y el servidor PHP): sin etiquetas HTML, scripts, esquemas `javascript:`, plantillas `{{ }}`/`${ }`, SQL (`UNION SELECT`, `; DROP TABLE`…), órdenes de consola, rutas `../` ni más de 2 enlaces; contacto: nombre 80 y mensaje 1000 caracteres; pedido: nombre 80, empresa 120, teléfono 40 y notas 500. Lo rechazado responde **400** `{ok:false, error, code: plain_text|too_long|too_many_links, field}` (la web lo traduce al idioma de la página) y no se guarda ni se envía nada. Antispam: campo trampa `hp` y **tiempo mínimo de relleno**: el navegador manda `_e` (ms desde que cargó la página) y, si falta o es menor que `FORM_MIN_FILL_MS` (1200 por defecto; `0` lo desactiva), 400 con `code: too_fast`. Lo no válido no gasta el cupo de mensajes (5 por visitante cada 10 min).
- **Sesiones**: token `{sub, iat, exp, sid}` firmado HMAC, **24 h**; el rol sale del registro del usuario; `sid` ata la sesión al usuario (borrar y recrear no resucita tokens) y
  `POST /api/auth/logout` invalida **todos** los tokens anteriores de esa persona (el token maestro no tiene sesión: 400). Los tokens de antes de este formato (sin `sid`, 7 días) no valen: todos vuelven a iniciar sesión una vez.
- **Contraseñas nuevas** (alta por la API): mínimo 12 caracteres, sin la parte local del correo y no triviales. Los usuarios ya creados no se tocan.
- **Claves de KV de los límites**: `rl:<cubo>:<sha256[:32]>`, de longitud acotada y sin IP ni correo en claro; con `expirationTtl` y una purga «al vuelo» (1 de cada 50 peticiones y el cron diario).
- **Errores**: ninguna respuesta 500 lleva texto interno: `{"ok":false,"error":"Error interno","id":"<8 hex>"}` y el detalle va al registro (`wrangler tail`) con ese `id`. Cuerpo máximo de 6 MB **contados de verdad** (también por trozos), JSON de ≤ 32 niveles.
- **Hoja de precios**: además del «precio de relleno» y del cambio masivo (que ahora cuenta también lo que la hoja *retira*), se pide `force` si la hoja **retira ≥ 10 precios y más del 30 %**
  de los vigentes, o si quedaría **menos de la mitad** (siendo ≥ 10). La lectura automática (cron y «Actualizar ahora») nunca aplica una hoja con bloqueos: conserva los precios y deja el motivo
  en `prices:sync` (`{at, reason, ok, blocked, error, refs?}` del último intento, también el fallido o bloqueado; solo lo ven los managers, en `GET /api/prices` → `sync`). Nunca se guarda un precio no finito. La columna pública «nota» solo sale de cabeceras explícitas (`nota`, `nota web`…).
- **Lector de `.xlsx` y descargas**: ≤ 20 MB descomprimidos por entrada (64 MB por libro), columna ≤ XFD, ≤ 200 000 filas, ≤ 4 millones de celdas; si se supera: «La hoja es demasiado grande o está dañada».
  Las descargas siguen las redirecciones a mano (máx. 5, solo `https:`; `http:` si la URL inicial lo era), nunca a `file:` ni a hosts locales, y con tope de 25 MB.
- **Listado de pedidos**: acotado (300 / 100 pedidos y 400 operaciones de KV por petición; `truncated:true` si se cortó). KV cuenta cada operación como subconsulta: en el plan gratuito de Workers (50 por invocación, según la documentación de Cloudflare) el listado se corta antes y se marca `truncated`. KV es eventualmente consistente: un pedido nuevo puede tardar hasta un minuto en salir en los listados.
- Una excepción nunca escapa sin cabeceras CORS. `GET /api/prices` responde con `Vary: Origin, Authorization`.
- Límites de KV: no es atómico (lectura + escritura) y es eventualmente consistente, así que los topes son de «mejor esfuerzo» (una ráfaga en paralelo puede pasarse unas peticiones). Para topes estrictos,
  además del Worker: regla de **Rate Limiting de Cloudflare** sobre `/api/auth/login` y `/api/order`, `TURNSTILE_SECRET`, `workers_dev = false` si la web usa un dominio propio y `ALLOWED_ORIGINS` sin `localhost` en producción.

## Precios desde Excel / Drive
Orden de preferencia de la fuente (se usa la primera configurada):
1. `GOOGLE_SERVICE_ACCOUNT` (secreto) + `PRICE_SHEET_ID`: el archivo de Drive compartido con el correo de la cuenta de servicio. Hoja de Google → Sheets API (`PRICE_SHEET_RANGE`); **Excel `.xlsx` subido tal cual → se descarga con la API de Drive y se lee el libro**.
2. `PRICE_XLSX_URL`: descarga directa de un `.xlsx` (Drive «cualquiera con el enlace»: `https://drive.google.com/uc?export=download&id=<ID>`; hoja de Google: `…/export?format=xlsx`). `PRICE_SHEET_NAME` fija la hoja; sin nombre, la primera visible con columnas de referencia y precio.
3. `PRICE_CSV_URL` (hoja compartida «con enlace», exportada como CSV; sin credenciales).
4. Subida manual de `.csv/.xlsx` desde el panel (`/api/prices/upload`).

Formatos de hoja entendidos (tarifa «Artículo · Descripción · Precio venta», canónico y WooCommerce), decimales (`PRICE_DECIMALS`, 4 por defecto), tramos, referencias nuevas por familia y protecciones: **`docs/PRECIOS-DRIVE.md`**.
Cada sincronización guarda un historial y **se rechaza** (409, salvo `force`) si la hoja nueva pierde más de la mitad de las referencias, llega vacía, retira demasiados precios o trae un precio de relleno.

## Precios por instrucción (IA)
`POST /api/prices/ai` manda a Claude la lista de precios (ref, nombre, precio y tramos; nada de clientes) y una instrucción en castellano
(«sube un 3 % las resistencias y redondea a 2 decimales»). La IA solo **propone** con una herramienta de esquema cerrado; el Worker valida
(referencias que existen, importes razonables, tramos coherentes), devuelve la vista previa y **no escribe nada**. Al confirmar en el panel,
`/api/prices/ai/apply` vuelve a validar y guarda (con histórico de 90 días); los cambios > ×3 exigen `confirm_large`.
Variables: secreto `ANTHROPIC_API_KEY` · opcional `AI_MODEL` (por defecto `claude-sonnet-5-5`).

## Puesta en marcha
```
cd workers/api && npm i
npx wrangler kv namespace create TORIVAC_KV      # pegar el id en wrangler.toml
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SESSION_SECRET            # ≥ 32 caracteres aleatorios (p. ej. openssl rand -base64 48)
npx wrangler secret put ADMIN_API_TOKEN           # ≥ 32 caracteres aleatorios
npx wrangler secret put TURNSTILE_SECRET          # recomendado
npx wrangler deploy
# primer manager (con el token maestro; después se gestionan desde el panel → Usuarios):
curl -X POST https://<worker>/api/users -H "Authorization: Bearer $ADMIN_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"tu@correo","name":"Tu nombre","role":"manager","password":"mínimo 12 caracteres, sin tu correo y nada obvio"}'
# comprobar la configuración (si algo está mal aparece "config":{"ok":false,"problems":["SESSION_SECRET",…]}):
curl https://<worker>/api/health
# panel real: compilar la web con  TORIVAC_API=https://<worker>  → /admin/ carga admin-live.js (login real) en lugar del demo
```
### Correo: Resend o Brevo, y por qué ya no hay un «recibido» falso
`EMAIL_PROVIDER` elige el servicio de envío: `resend` (por defecto; secreto `RESEND_API_KEY`), `brevo` (secreto `BREVO_API_KEY`, API v3 `smtp/email`) o `none` (no envía; todo se guarda igual). En los dos hace falta que el remitente `ORDER_FROM` (`Nombre <correo@dominio>`)
esté verificado en el servicio: en Resend, el dominio con SPF/DKIM; en Brevo, el remitente o el dominio autenticado. Si no, el servicio rechaza el envío y el motivo se ve en el panel.
- **Contacto:** `POST /api/contact` guarda SIEMPRE el mensaje (`msg:…`, 400 días) antes de intentar el correo y responde `{ ok, id, emailed:{ sent, reason } }`; `reason` = `sent` · `off` (sin controlador) · `failed` (el servicio respondió error) · `skipped` (faltan clave, remitente o destinatarios). Si no se pudo guardar, 500 y no se envía nada.
- **Panel (solo managers):** `GET /api/messages?limit=` (1..300, por defecto 100, el más reciente primero), `DELETE /api/messages/:id`, `POST /api/mail/test { to? }` (10 por hora y usuario; devuelve el error corto del servicio) y `GET /api/mail/status` (controlador, ajustes que faltan por NOMBRE y último intento).
  `GET /api/health` añade `mail:{ driver, configured, last }` sin texto de error ni secretos. El último intento (`mail:last`) se anota en cada envío: pedido, copia al cliente, contacto y prueba.
- **Seguridad:** ningún error lleva claves (se tachan los valores del entorno y las formas típicas de clave); el contenido del visitante se escapa en el correo y se guarda y devuelve como dato.

Destinatarios confirmados por el cliente: `ORDER_TO = info@grupotorivac.com, mzamora@torivac.com` (info@ también para las pruebas).
Antes de producción: verificar `grupotorivac.com` en Resend (SPF/DKIM) para que `ORDER_FROM` (`pedidos@grupotorivac.com`) no vaya a spam,
y poner en `ALLOWED_ORIGINS` el dominio real de la web (y el del cPanel de pruebas).

## Pruebas
`npm test` (Node ≥ 22, sin dependencias): hash/sesión, validación, tramos y céntimos,
lectura de hoja y CSV con comillas, **lector de `.xlsx`** (mismos libros que el port PHP), sincronización con rechazo de hojas rotas y desde Drive (URL directa, Sheets → respaldo Drive), JWT RS256 de cuenta de
servicio, flujo de pedido con Resend simulado, roles, límite de login, CORS, subida y cron, y la IA de precios (validación, propuesta, aplicar con
confirmación, límite de uso, 403 a clientes). Los arreglos de seguridad tienen sus pruebas de regresión (el ataque ya no funciona y lo legítimo sí) en
`test/security-orders.test.js` (copia al cliente, PDF, topes, `ipKey`, pedidos), `test/security-auth.test.js` (login, Bearer, secretos, sesiones, errores, cuerpo, `/api/admin/data`) y
`test/security-sheets.test.js` (borrado masivo de precios, cifras, lector `.xlsx` hostil, descargas). El correo veraz (contacto guardado, Resend y Brevo simulados, secretos) está en `test/mail-contact.test.js` y los endpoints de gestión (mensajes, prueba de correo, estado, salud) en `test/mail-admin.test.js`. Extremo a extremo: `node scripts/qa-live.mjs` (pedido/contacto), `qa-admin-live.mjs` (panel real) y `qa-tarifa.mjs` (tarifa Excel real);
los tres aceptan `--php` para correr contra `backend-php/api`.
