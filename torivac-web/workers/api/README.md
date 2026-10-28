# torivac-api · Worker de producción (Cloudflare)

Un solo Worker para todo lo que la web estática no puede hacer sola. **No está desplegado**: el demo
(`dist/`) simula estos pasos en el navegador. Este Worker es el reemplazo real, con la misma API que
usa `site/assets/js/quote-page.js`.
> **Alternativa para hosting con cPanel:** `backend-php/api` implementa exactamente este mismo contrato en PHP (sin base de datos); ver `docs/DESPLIEGUE-CPANEL.md`. La web, el panel y las pruebas de navegador funcionan igual con uno u otro.

| Función | Ruta | Quién |
|---|---|---|
| Salud | `GET /api/health` | público |
| Precios vigentes | `GET /api/prices` | público (caché 5 min) |
| Enviar pedido | `POST /api/order` | público (límite por IP, Turnstile opcional) |
| Enviar contacto | `POST /api/contact` | público |
| Login / sesión | `POST /api/auth/login`, `GET /api/auth/me` | público / sesión |
| Pedidos | `GET /api/orders` | manager: todos · cliente: solo los suyos |
| Refrescar precios ahora | `POST /api/prices/refresh` | manager |
| Subir hoja de precios (vista previa/aplicar) | `POST /api/prices/upload` | manager |
| Usuarios | `GET/POST /api/users`, `DELETE /api/users/:email` | manager |
| Instrucción de precios con IA (propone, no aplica) | `POST /api/prices/ai` `{instruction}` | manager (15 consultas / 10 min) |
| Aplicar lo propuesto tras revisarlo | `POST /api/prices/ai/apply` `{changes, confirm_large?}` | manager |
| Decisiones sobre propuestas del panel | `GET/POST /api/proposals/state` | manager |

Cron: `0 3 * * *` (UTC) sincroniza precios cada 24 h. La actualización manual es el botón del panel.

## Cómo funciona un pedido
1. El navegador manda `{customer, lines:[{ref, qty}]}` (los precios que envíe se **ignoran**).
2. El Worker valida cada referencia contra `src/generated/items.js` (lo genera `site/build.mjs`), valora
   con los precios de KV (tramos por cantidad, línea redondeada a 2 decimales) y numera `TV-AAAAMMDD-NNNN`.
3. Guarda el pedido en KV y envía por Resend a `ORDER_TO` (info@ y mzamora@) con el PDF adjunto y copia al cliente.
   Sin `RESEND_API_KEY` no falla: guarda el pedido y avisa de que no se envió.

## Precios desde Excel / Drive
Orden de preferencia de la fuente (se usa la primera configurada):
1. `GOOGLE_SERVICE_ACCOUNT` (secreto) + `PRICE_SHEET_ID`: el archivo de Drive compartido con el correo de la cuenta de servicio. Hoja de Google → Sheets API (`PRICE_SHEET_RANGE`); **Excel `.xlsx` subido tal cual → se descarga con la API de Drive y se lee el libro**.
2. `PRICE_XLSX_URL`: descarga directa de un `.xlsx` (Drive «cualquiera con el enlace»: `https://drive.google.com/uc?export=download&id=<ID>`; hoja de Google: `…/export?format=xlsx`). `PRICE_SHEET_NAME` fija la hoja; sin nombre, la primera visible con columnas de referencia y precio.
3. `PRICE_CSV_URL` (hoja compartida «con enlace», exportada como CSV; sin credenciales).
4. Subida manual de `.csv/.xlsx` desde el panel (`/api/prices/upload`).

Formatos de hoja entendidos (tarifa «Artículo · Descripción · Precio venta», canónico y WooCommerce), decimales (`PRICE_DECIMALS`, 4 por defecto), tramos, referencias nuevas por familia y protecciones: **`docs/PRECIOS-DRIVE.md`**.
Cada sincronización guarda un historial y **se rechaza** si la hoja nueva pierde más de la mitad de las referencias, llega vacía o trae un precio de relleno (salvo `force`).

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
npx wrangler secret put SESSION_SECRET            # ≥ 32 caracteres aleatorios
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler deploy
# primer manager (con el token maestro; después se gestionan desde el panel → Usuarios):
curl -X POST https://<worker>/api/users -H "Authorization: Bearer $ADMIN_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"tu@correo","name":"Tu nombre","role":"manager","password":"mínimo 10 caracteres"}'
# panel real: compilar la web con  TORIVAC_API=https://<worker>  → /admin/ carga admin-live.js (login real) en lugar del demo
```
Destinatarios confirmados por el cliente: `ORDER_TO = info@grupotorivac.com, mzamora@torivac.com` (info@ también para las pruebas).
Antes de producción: verificar `grupotorivac.com` en Resend (SPF/DKIM) para que `ORDER_FROM` (`pedidos@grupotorivac.com`) no vaya a spam,
y poner en `ALLOWED_ORIGINS` el dominio real de la web (y el del cPanel de pruebas).

## Pruebas
`npm test` (Node ≥ 22, sin dependencias): hash/sesión, validación, tramos y céntimos,
lectura de hoja y CSV con comillas, **lector de `.xlsx`** (mismos libros que el port PHP), sincronización con rechazo de hojas rotas y desde Drive (URL directa, Sheets → respaldo Drive), JWT RS256 de cuenta de
servicio, flujo de pedido con Resend simulado, roles, límite de login, CORS, subida y cron, y la IA de precios (validación, propuesta, aplicar con
confirmación, límite de uso, 403 a clientes). Extremo a extremo: `node scripts/qa-live.mjs` (pedido/contacto), `qa-admin-live.mjs` (panel real) y `qa-tarifa.mjs` (tarifa Excel real);
los tres aceptan `--php` para correr contra `backend-php/api`.
