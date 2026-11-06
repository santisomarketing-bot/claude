# Precios por categoría y cuentas de cliente · contrato de los dos servidores

Es el **contrato único** de `backend-php/api` y `workers/api`: mismas rutas, mismas respuestas, mismos errores. Lo usan el panel (`admin-customers.js`, `admin-prices.js`, `admin-quotes.js`) y la web (`quote.js`, `shop.js`, `quote-page.js`).

## 0. Qué pidió Torivac (decisiones cerradas)

1. **Clientes con usuario, de solo lectura:** pueden **revisar** presupuestos y **crear presupuestos nuevos en el panel** (máximo **3 al día**), pero no editar ni reenviar.
2. **Cuatro categorías de precio** por cliente: **VIP**, **VIP +5**, **VIP +10** y **Normal**. VIP es el precio base; VIP +5 = VIP × 1,05; VIP +10 = VIP × 1,10; Normal = VIP × 1,15. **Los porcentajes (5, 10, 15) son masivos**: un ajuste global que vale para todos los productos, no un precio por producto. **El precio de la hoja es el VIP.**
3. **Quien administra las categorías** son **María y Xavi**, el equipo de Torivac con el rol `client` (en el panel, «Propietario»): asignan la categoría de cada cliente, cambian los porcentajes y modifican precios. No tienen acceso técnico (Ajustes, Google, correo, copias, usuarios del equipo).
4. **Sin precio público:** para el visitante sin cuenta, la web no enseña precios exactos. Muestra «Consultar precio» y, si se activa, un **precio aproximado** (calculado también de forma masiva). Un presupuesto de visitante sale «A consultar»; como **alternativa** (interruptor) se calcula como **Normal** si el producto tiene precio.
5. **Precios editables en el panel**, producto a producto (además de la hoja de Drive). Lo editado a mano queda **marcado «manual»** y la sincronización de la hoja **no lo pisa**.
6. En el presupuestador, el cliente **aplica sus precios con un botón** sobre el presupuesto que sube o arma él mismo.

## 1. Roles y permisos

| | `manager` | `client` («Propietario» · María, Xavi) | `customer` («Cliente») | visitante |
|---|---|---|---|---|
| Presupuestos recibidos: ver | todos | todos (sin `ip` ni `emailed.error`) | **solo los suyos** (`owner` = su correo), versión reducida (§6) | — |
| Editar / reenviar presupuestos | sí | sí | **no** (403) | — |
| Crear presupuesto (`POST /order` con sesión) | sí | sí | sí, **3 por día** | sí (sin sesión) |
| Cuentas de cliente (`/customers`) | sí | sí | no | — |
| Porcentajes y ajustes de precios (`/settings/pricing`) | sí | sí | no | — |
| Editar precios de producto (`/prices/items/:ref`) | sí | sí | no | — |
| Subir hoja, sincronizar, IA de precios | sí | no | no | — |
| Usuarios del equipo, Ajustes, Google, copias… | sí | no | no | — |
| `GET /prices` | base (VIP) con marcas | base (VIP) con marcas | **precios de su categoría** | según ajuste (§4) |

El rol `customer` es nuevo. El `client` de siempre no cambia de nombre en el API. Una cuenta `customer` **no** ve la lista de usuarios ni los datos de otros clientes.

## 2. Categorías y cálculo del precio

```
TIERS = vip · vip5 · vip10 · normal
porcentaje(vip) = 0 (fijo)            porcentaje(vip5)=5 · (vip10)=10 · (normal)=15   ← por defecto, editables (§5.2)
precio(categoría, ref, cantidad) = redondeo4( precioVIP(ref, cantidad) × (1 + porcentaje/100) )
```

- `precioVIP(ref, cantidad)` es lo de siempre: el precio base `p` y el **último tramo `t` alcanzado** (`[[cantMin, precio], …]`). Cada tramo se escala con el mismo porcentaje.
- `redondeo4` = redondeo a 4 decimales (el precio unitario conserva hasta 4); el importe de línea sigue siendo `round2(unit × qty)` y el total la suma de líneas.
- Una referencia **sin precio** sigue siendo «A consultar» (`unit`/`total` nulos, no suma) en todas las categorías.
- La categoría de un cliente vive en su registro de usuario: `tier` (por defecto `normal`). **Se lee del registro en cada petición** (cambiarla vale al instante). Si la cuenta se borra, su sesión deja de valer (401).

### Precio aproximado (solo visitante, solo si `anon` = `consult`)
Por referencia, en este orden:
1. `item.a === false` → no se enseña aproximado (queda «Consultar»).
2. `item.a` es un número > 0 → ese es el aproximado (sirve aunque la referencia no tenga precio de hoja).
3. si hay `item.p` válido y `approx.on` → `aprox(redondeo4(p × (1 + approx.pct/100)))`, con `aprox(v) = v ≥ 10 ? redondeo a euro entero : redondeo a 1 decimal`. Es el precio para **una unidad** (sin tramos).
4. en otro caso, nada.

## 3. Datos

- **Usuario** `user:<correo>`: `{ email, name, role: 'manager'|'client'|'customer', tier?: 'vip'|'vip5'|'vip10'|'normal', created, … }`. `tier` solo se guarda si `role === 'customer'` (por defecto `normal`).
- **Pedido** `order:<nº>` (campos nuevos, opcionales): `owner` (correo de la sesión que lo creó, solo si hubo sesión) y `priceTier` (`vip|vip5|vip10|normal` o `consult` si se valoró «A consultar»). Pedidos antiguos no los tienen.
- **Ajustes de precios** `settings:pricing` (sin caducidad):
  ```json
  { "tiers": { "vip5": 5, "vip10": 10, "normal": 15 },
    "anon": "consult",
    "approx": { "on": false, "pct": 15 },
    "updated": { "at": "ISO", "by": "correo|maestro" } }
  ```
  Por defecto: porcentajes 5/10/15, `anon:'consult'`, `approx.on:false` (**nada público hasta que se active**), `approx.pct:15`. `load()` devuelve siempre la forma completa y solo valores válidos (lo dañado vuelve al valor por defecto).
- **Precio de producto** `prices:current.items[ref]` (campos nuevos, opcionales): `m: true` (editado a mano: la hoja no lo pisa) y `a: number | false` (aproximado explícito, o `false` = nunca aproximado).

## 4. `GET /api/prices` según quién llama

Misma forma de siempre: `{ prices:{ updated_at, source, currency, mode, items:{ ref:{ p, t? } } }, meta }`. **El servidor decide qué contiene** y añade `Vary: Authorization`. Con sesión: `Cache-Control: private, no-store`.

| Llamante | `prices.items` | Marcas extra |
|---|---|---|
| `manager` / `client` | precios **VIP** (base), con `m` y `a` | `meta` como hoy (manager: detalle; `client`: sin quién ni de dónde, como el público) + `meta.manual_count` |
| `customer` | precios **de su categoría** (`p` y `t` escalados). Sin `m`, `a` ni nombre de categoría | — |
| visitante, `anon:'normal'` | precios **Normal** completos (con tramos) | — |
| visitante, `anon:'consult'` y `approx.on` | `{ ref: { p: aproximado } }` solo donde §2 da un valor; **sin tramos** | `prices.approx: true` |
| visitante, `anon:'consult'` y `!approx.on` | `{}` | `prices.mode: 'none'` |

**Nunca** se publica el precio VIP ni el de otra categoría a quien no corresponde. Una sesión inválida o caducada en este GET se trata como visitante (no es un error).

## 5. Rutas nuevas (todas con sesión de `manager` o `client` salvo que se diga otra cosa)

### 5.1 Clientes
- `GET /api/customers` → `{ ok, customers:[{ email, name, tier, created, last_login? }], tiers:{ vip:{label:'VIP',pct:0}, vip5:{label:'VIP +5',pct}, vip10:…, normal:… } }`
- `POST /api/customers` `{ email, name, password, tier }` → crea una cuenta `customer` (misma validación de correo, nombre y contraseña que `/users`; `tier` ∈ las cuatro, por defecto `normal`). `201`/`200 { ok, customer }`; correo ya existente → `409`.
- `PUT /api/customers/:correo` `{ tier?, name? }` → cambia categoría y/o nombre. Solo sobre cuentas `customer`; otro rol o inexistente → `404`.
- `POST /api/customers/:correo/password` `{ password }` → contraseña nueva (mismas reglas) y se cierran sus sesiones.
- `DELETE /api/customers/:correo` → borra la cuenta (y cierra sus sesiones). No borra sus presupuestos.
- Un `customer` o un visitante → `403`/`401`. PHP anota en Actividad: `customer.create`, `customer.tier` (`correo → vip5`), `customer.password`, `customer.delete`.
- `POST /api/users` del manager acepta además `role:'customer'` con `tier`; `GET /api/users` devuelve `tier` en las cuentas `customer`. `tools/create-user.php` y el alta del Worker aceptan el rol `customer` y un 5.º argumento/campo `tier` opcional.

### 5.2 Ajustes de precios
- `GET /api/settings/pricing` → `{ ok, pricing }` (la forma de §3, con `updated`).
- `PUT /api/settings/pricing` `{ tiers:{vip5,vip10,normal}, anon, approx:{on,pct} }` → valida y guarda con `updated = { at, by }` → `200 { ok, pricing }`; error → `400 { ok:false, error, field }` con `field` ∈ `tiers.vip5|tiers.vip10|tiers.normal|anon|approx.pct|approx.on`.
  Reglas: porcentajes numéricos 0–100 con hasta 2 decimales y **vip5 ≤ vip10 ≤ normal**; `anon` ∈ `consult|normal`; `approx.on` booleano; `approx.pct` 0–200. Cuerpo ≤ 2 KB. PHP: `Audit settings.pricing`.

### 5.3 Editar el precio de un producto
- `PUT /api/prices/items/:ref` (`:ref` codificada en la URL) cuerpo `{ p?, t?, a?, manual? }`:
  - `p`: número > 0 y ≤ 10 000 000 con hasta 4 decimales (**precio VIP unitario**), o `null` = quitarle el precio (queda «A consultar»).
  - `t`: lista de 0 a 8 tramos `[cantMin, precio]`, `cantMin` entero ≥ 2 **estrictamente creciente**, precio como `p`. `[]` = sin tramos.
  - `a`: número > 0 (aproximado explícito), `false` (nunca aproximado) o `null` (seguir la regla).
  - `manual: false` → quita la marca `m` (la próxima sincronización de la hoja podrá cambiarlo). Si el cuerpo trae `p` o `t`, la marca `m: true` se pone sola.
  - La referencia debe existir (catálogo o referencias que añadió la hoja) → si no, `404 { ok:false, error:'Referencia desconocida' }`. Una ref sin ningún dato queda sin entrada.
  - Guarda con histórico (razón `edit:<correo>`), `updated_at` nuevo. `200 { ok:true, ref, item }` (`item` = `{ p?, t?, a?, m? }`). Errores `400 { ok:false, error, field }`. PHP: `Audit price.edit` (`REF`).
- **Sincronización con la hoja** (`Prices::merge`, ambos modos `merge` y `replace`, cron y «Actualizar ahora»): una referencia con `m:true` **no se toca** (se conserva tal cual, aunque la hoja la quite o la cambie); se cuenta en `meta.manual_skipped` (el panel lo enseña). Las reglas de seguridad de cambios masivos ignoran las referencias manuales. La aplicación de la IA (`/prices/ai/apply`) conserva `m`.

## 6. Presupuestos

### `POST /api/order`
- **Con sesión** (`Authorization: Bearer …`): sesión **inválida/caducada** → `401 { ok:false, code:'session', error:'Tu sesión ha caducado. Vuelve a entrar.' }` (no se trata como visitante).
  - `customer`: se valora con **su categoría**; `owner` = su correo; `priceTier` = su categoría; **no** se exige Turnstile, `hp` ni `_e` (hay sesión). Se mantienen los límites por IP y el global por hora. Cualquier `tier` o `price` del cuerpo se **ignora**. **Límite: 3 por día** (ventana móvil de 24 h por persona; `CUSTOMER_ORDERS_PER_DAY` / `customer_orders_per_day`, entero ≥ 1, por defecto 3; no válido → 3). Solo cuentan los presupuestos válidos y guardados. Superado: `429 { ok:false, code:'daily_limit', error:'Has alcanzado el límite de 3 presupuestos al día. Vuelve a intentarlo mañana o escribe al equipo.' }` (el número del texto es el límite configurado).
  - `manager`/`client`: valoración **VIP** salvo que el cuerpo traiga `tier` (`vip|vip5|vip10|normal`, solo para ellos); `owner` = su correo.
- **Sin sesión**: según `settings.anon`: `consult` → todas las líneas `unit:null, total:null` (`unpriced` = nº de líneas; `priceTier:'consult'`); `normal` → valoración **Normal** (`priceTier:'normal'`). Antispam como hoy.
- La respuesta añade, solo para `customer`, `remaining` (nº de presupuestos que le quedan hoy).
- El correo al equipo y la copia al solicitante siguen como hoy; el correo al equipo añade una línea con la cuenta (`owner`) y la categoría cuando hay `priceTier`.

### `GET /api/orders` y `GET /api/orders/:n`
- `customer`: **solo** los que tienen `owner` = su correo (los 100 más recientes), en versión reducida `forCustomer`: `{ number, at, customer, lines, total, unpriced, lang, quoteNote? }` — **sin** `ip`, `emailed`, `history`, `lastSent`, `original`, `rev`, `edited`, `owner`, `prices`, `priceTier`. La lista añade `quota: { limit, used }` (`used` = sus presupuestos de las últimas 24 h). Un número que no es suyo → `404 { ok:false, error:'No existe ese presupuesto' }` (igual que uno inexistente).
- `PUT /api/orders/:n` y `POST /api/orders/:n/send` → `403 { ok:false, error:'Solo lectura' }` para `customer`.
- Worker: índice `oorder:<correo>:<nº>` (mismo plazo de 400 días) escrito al crear; PHP: recorrido filtrado por `owner`.

### `PUT /api/orders/:n` (staff): parámetro `tier`
Opcional (`vip|vip5|vip10|normal`). Si viene, las líneas **sin `price` explícito** se valoran con esa categoría **aunque no hayan cambiado de cantidad** (`manual` desaparece) y `priceTier` del registro pasa a ese valor; las líneas con `price` numérico quedan `manual`. **Sin `tier`:** las líneas que no cambian (misma referencia y cantidad, sin `price`) se conservan tal cual; las líneas **nuevas o con la cantidad cambiada** se valoran con la categoría con la que se valoró el presupuesto (`priceTier`: `vip|vip5|vip10|normal`), de modo que cambiar una cantidad nunca regala el precio VIP a un cliente Normal. Si el presupuesto salió `consult` («A consultar») esas líneas quedan sin precio, y si es antiguo y no tiene `priceTier`, se valoran VIP como hasta ahora. `tier` sirve para valorar un presupuesto que salió «A consultar».

## 7. Pruebas que debe tener cada servidor

1. **Cálculo:** las cuatro categorías sobre `p` y tramos (5/10/15 por defecto y con porcentajes cambiados), redondeo a 4, ref sin precio → null, categoría leída del registro en cada petición.
2. **`GET /prices` por llamante:** manager y client ven VIP con `m`/`a`; `customer` ve su categoría (y cambiar su `tier` cambia lo que ve); visitante: `normal`, `consult+approx` (reglas de §2 con `a` número, `a:false`, sin precio) y `consult` apagado; el VIP **no** aparece en las respuestas de customer ni visitante; cabecera `Vary: Authorization`; sesión inválida = visitante.
3. **Clientes:** CRUD completo; `client` y `manager` pueden, `customer`/visitante no; no se toca una cuenta de otro rol (404); contraseña y correo con las reglas de siempre; categoría inválida → 400; el borrado cierra sesiones; `/users` ve y acepta `customer` y `tier`.
4. **Ajustes de precios:** valores por defecto, validación (orden vip5 ≤ vip10 ≤ normal, rangos, decimales, cuerpo basura), solo `manager`/`client`, quién y cuándo guardó, valor dañado en el almacén → por defecto.
5. **Edición de producto:** `p`/`t`/`a`/`manual`; marca `m` automática; ref desconocida 404; tramos mal formados 400; histórico; **la sincronización (merge y replace) no toca `m`** y cuenta `manual_skipped`; la IA conserva `m`.
6. **Pedidos:** `customer` valora con su categoría, ignora `price`/`tier` del cuerpo, `owner` y `priceTier` correctos, 3 por día (el 4.º → 429 `daily_limit`, sin gastar cupo en un 400), sesión inválida 401, sin Turnstile; visitante `consult` y `normal`; staff con `tier`.
7. **Lectura del cliente:** solo lo suyo, reducido, `quota`; `PUT`/`send` → 403; el de otro → 404; `client` sigue viendo todo.
8. **`PUT /orders/:n` con `tier`:** reprecia solo las líneas sin precio explícito; un presupuesto `consult` queda valorado.
9. **Paridad:** las mismas peticiones dan las mismas formas en los dos servidores (las usa `scripts/qa-admin-live.mjs`).

## 8. Web y panel (lo que **no** hacen los servidores)

- **Web pública** (`quote.js`, `shop.js`, `quote-page.js`): con `prices.approx` los precios son aproximados: tarjetas y fichas enseñan «≈ 125 €» con la nota «Precio aproximado, sin IVA. El precio final se confirma por presupuesto.»; **el presupuestador no valora** (queda «A consultar»). Sin precios → «Consultar precio». Textos nuevos en los 4 idiomas, a validar ([`TEXTOS-DE-INTERFAZ.md`](TEXTOS-DE-INTERFAZ.md)).
- **Dentro del panel (iframe `?embed=1`)** la web manda el token de la sesión en `GET /api/prices` y en `POST /api/order`. **Fuera del panel nunca.**
- **Cliente (`customer`):** en el presupuestador, las líneas salen sin precio hasta pulsar **«Aplicar mis precios»**; el servidor valora siempre con su categoría al enviar. Menú: Nuevo presupuesto · Mis presupuestos (solo lectura, con PDF) · Lista de precios. No ve el nombre de su categoría.
- **Propietario y manager:** vistas **Clientes** (alta, categoría, contraseña, baja) y **Precios** (porcentajes de las categorías, precio público/aproximado, editor de productos con la marca «manual»); en *Presupuestos recibidos → Editar*, un selector «Valorar con la categoría…» (`tier` de §6).
