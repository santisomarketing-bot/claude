# torivac-api · Worker de producción (Cloudflare)

Un solo Worker para todo lo que la web estática no puede hacer sola. **No está desplegado**: el demo
(`dist/`) simula estos pasos en el navegador. Este Worker es el reemplazo real, con la misma API que
usa `site/assets/js/quote-page.js`.

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

Cron: `0 3 * * *` (UTC) sincroniza precios cada 24 h. La actualización manual es el botón del panel.

## Cómo funciona un pedido
1. El navegador manda `{customer, lines:[{ref, qty}]}` (los precios que envíe se **ignoran**).
2. El Worker valida cada referencia contra `src/generated/items.js` (lo genera `site/build.mjs`), valora
   con los precios de KV (tramos por cantidad, línea redondeada a 2 decimales) y numera `TV-AAAAMMDD-NNNN`.
3. Guarda el pedido en KV y envía por Resend a `ORDER_TO` (info@ y mzamora@) con el PDF adjunto y copia al cliente.
   Sin `RESEND_API_KEY` no falla: guarda el pedido y avisa de que no se envió.

## Precios desde Excel / Drive
Orden de preferencia de la fuente (se usa la primera configurada):
1. `GOOGLE_SERVICE_ACCOUNT` + `PRICE_SHEET_ID` (Google Sheets API; la hoja se comparte con el email de la cuenta de servicio).
2. `PRICE_CSV_URL` (hoja compartida «con enlace», exportada como CSV; sin credenciales).
3. Subida manual de `.csv/.xlsx` desde el panel (`/api/prices/upload`).

Columnas: `ref, product_id, name_es, unit, currency, price, qty2, price2, qty3, price3, qty4, price4, note, active, updated_at`.
Cada sincronización guarda un historial y **se rechaza** si cambia más del 50 % de las referencias o llega vacía.

## Puesta en marcha
```
cd workers/api && npm i
npx wrangler kv namespace create TORIVAC_KV      # pegar el id en wrangler.toml
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SESSION_SECRET            # ≥ 32 caracteres aleatorios
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler deploy
```
Antes de producción: confirmar con el cliente `ORDER_TO` y `ORDER_FROM` (dominio verificado en Resend),
y poner en `ALLOWED_ORIGINS` el dominio real de la web.

## Pruebas
`npm test` (Node ≥ 22, sin dependencias): 14 pruebas — hash/sesión, validación, tramos y céntimos,
lectura de hoja y CSV con comillas, sincronización con rechazo de hojas rotas, JWT RS256 de cuenta de
servicio, flujo de pedido con Resend simulado, roles, límite de login, CORS, subida y cron.
