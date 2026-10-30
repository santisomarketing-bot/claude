# Presupuestos recibidos · ver, editar, reenviar y descargar (panel)

**Para quién es.** Las personas que entran al panel con rol `client` **no son compradores: son los propietarios de la web** (Torivac). Los *solicitantes* son quienes piden presupuesto desde la web. Por eso, en el panel el rol se llama **Propietario** (el valor técnico del API sigue siendo `client`, para no romper cuentas ni pruebas) y la sección se llama **Presupuestos recibidos**. El rol `manager` (equipo técnico) ve lo mismo y además lo suyo (usuarios, precios, blog…).

Este documento es el **contrato único** de los dos servidores (`backend-php/api` y `workers/api`): mismas rutas, mismas respuestas, mismos errores.

## 1. Qué cambia

| Antes | Ahora |
|---|---|
| `GET /api/orders` con rol `client` = solo los pedidos hechos con **su propio correo** (pensado para compradores) | `client` (Propietario) ve **todos** los presupuestos recibidos, igual que un manager (sin la IP ni el texto de error del correo) |
| Solo se podía listar y regenerar el PDF | Ver uno, **editarlo**, **reenviarlo por correo** desde la plataforma, **descargarlo** en PDF; queda un historial |

## 2. Modelo del registro (`order:<número>`)

Los campos de siempre (`number, at, customer{name,company,email,phone,notes}, lines[{ref,qty,unit,total}], total, unpriced, lang, prices{updated_at,mode}, ip, emailed`) más, **solo si se ha tocado**:

| Campo | Qué es |
|---|---|
| `rev` | Entero ≥ 1: número de ediciones. Ausente = nunca editado (0). |
| `edited` | `{ at, by }`: última edición (ISO UTC y correo de quien la hizo). |
| `original` | `{ at, customer, lines, total, unpriced }`: lo que llegó de la web, guardado **una sola vez**, en la primera edición. |
| `quoteNote` | Texto plano ≤ 1000 caracteres: nota del propietario para el presupuesto (sale en el PDF y en el correo). |
| `lines[].manual` | `true` si el precio unitario lo puso una persona (no la tarifa). |
| `history` | Lista de `{ at, by, kind:'edit'\|'send', rev, to?:[correos], ok?:bool, reason? }`, **máx. 50** (se descartan las más antiguas). `send` guarda los destinatarios y si salió. |

El PDF **no se guarda** (lo fabrica el navegador del panel; ver §6).

## 3. Rutas (todas exigen sesión; las pueden usar `manager` y `client`; el token maestro cuenta como manager)

### `GET /api/orders`
Igual que ahora para el manager (300 más recientes, `truncated:true` si se cortó). **Para `client`: exactamente la misma lista**, pasada por `forClient` (sin `ip` y sin `emailed.error`). El índice `uorder:` del Worker se sigue escribiendo pero ya no se usa para listar.

### `GET /api/orders/:number`
`200 { ok:true, order }` (con `forClient` si no es manager) · `404 { ok:false, error:'No existe ese presupuesto' }` · número con forma no válida → 404 igual (nunca se usa el texto de la URL para tocar ficheros). Forma: `^TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?$`.

### `PUT /api/orders/:number` — editar
Cuerpo JSON (≤ 100 KB; si pasa, 413/400 como el resto del API):

```json
{ "rev": 0,
  "customer": { "name": "…", "company": "", "email": "…", "phone": "", "notes": "" },
  "lines": [ { "ref": "TT-1", "qty": 3 }, { "ref": "TT-2", "qty": 1, "price": 12.5 }, { "ref": "TT-3", "qty": 2, "price": null } ],
  "quoteNote": "Validez de la oferta: 30 días." }
```

- `rev` (entero ≥ 0) = la revisión que la persona **cargó**. Si no coincide con la guardada (`rev` o 0): **`409 { ok:false, code:'conflict', error:'Alguien ha modificado este presupuesto: recarga y vuelve a intentarlo', order }`** (con el registro actual). Evita pisar un cambio de otra persona.
- `customer` (opcional; si falta se deja igual; si viene, las 5 claves son **cadenas**): mismas reglas que `parseOrder` — texto plano (`PlainText`, con los límites de campo de `order`: name, company, phone, notes), `name` ≥ 2 caracteres, `email` válido (minúsculas). **No** se exige `privacy`, ni `hp`, ni `_e`, ni Turnstile (ya hay sesión).
- `lines` (obligatorio, 1..200): `ref` ∈ catálogo (`withSheetItems` como en `handleOrder`), `qty` entero 1..1 000 000, **sin referencias repetidas** (400 «Línea repetida: REF»). `price`:
  - **ausente**: si la línea ya existía con la misma `ref` **y la misma `qty`**, se conserva su `unit`/`total`/`manual` tal cual (no se revalora nada sin que lo pida la persona); si la `qty` cambió o la línea es nueva, `unit` = tarifa vigente para esa cantidad (puede ser `null` = «A consultar») y `manual` desaparece;
  - **número** (0 ≤ x ≤ 10 000 000, hasta 4 decimales): `unit = x`, `manual:true`;
  - **`null`**: vuelve a la tarifa vigente (como «cantidad cambiada»).
  - `total` = `round2(unit × qty)` o `null` si no hay precio. `total` del pedido = suma de los `total` no nulos; `unpriced` = nº de líneas sin precio.
- `quoteNote` (opcional): texto plano ≤ 1000 (multilínea). Cadena vacía = quitarla. Si falta, se conserva.
- Efecto: `rev += 1`; `edited = { at: ahora, by: correo }` (el maestro: `'maestro'`); `original` solo si no existía; `history` += `{ at, by, kind:'edit', rev }`; si alguna línea se revaloró con la tarifa vigente, `prices` pasa a ser la de ahora.
- Respuesta: `200 { ok:true, order }`. Errores de texto como `parseOrder` (`400 { ok:false, error, code, field }`).
- Se guarda con el mismo plazo que un pedido (400 días desde esta edición). PHP: bajo el bloqueo del almacén (`Store::locked`) para que dos ediciones no se pisen; Worker: KV no es atómico, la protección es `rev`.
- PHP: `Audit::log('order.edit', $who, $req, 'TV-… rev N')`.

### `POST /api/orders/:number/send` — reenviar por correo
Cuerpo JSON (≤ 6 MB):

```json
{ "to": ["cliente@empresa.com"], "message": "Adjunto el presupuesto revisado.", "pdf": "<base64>", "copyToMe": true }
```

- `to`: lista de 1 a 3 correos válidos (`validEmail`), en minúsculas y sin repetir. Se recomienda que el primero sea el del solicitante, pero **se puede mandar a cualquiera** (reenviarlo a un colega del cliente, por ejemplo).
- `message` (opcional): texto plano multilínea ≤ 1500 (`PlainText`).
- `pdf` (**obligatorio**): el mismo control que en `handleOrder` (`normalizePdf`: base64 estricto, empieza por `%PDF-`, ≤ 4 MB). El navegador del panel lo fabrica con los datos ya editados. No se guarda.
- `copyToMe` (opcional, `true` por defecto): pone en copia (`cc`) a quien lo envía si su identidad es un correo válido (no al token maestro).
- Topes (se aplican **antes** de enviar y no se devuelven si el envío falla): **20 por hora y persona** (`qsend`) y **150 al día en total** (`qsendday`; configurable con `order_send_daily_max` (PHP; variable de entorno `TORIVAC_ORDER_SEND_DAILY_MAX`) / `ORDER_SEND_DAILY_MAX` (Worker); **0 = sin tope diario** en los dos; el tope de 20 por hora y persona no se configura). Superado: `429 { ok:false, error:'Demasiados reenvíos seguidos. Espera un rato.' }`.
- Si el correo no está configurado (`Mail::enabled()` falso / `mailReady` falso): `409 { ok:false, code:'mail_off', error:'El correo no está configurado: el presupuesto no se puede enviar desde aquí. Descarga el PDF y envíalo tú.' }` (no gasta cupo y no anota historial).
- Correo: asunto fijo según el idioma del pedido (`es` «Torivac · presupuesto TV-…», `en` «Torivac · quote TV-…», `fr` «Torivac · devis TV-…», `de` «Torivac · Angebot TV-…»); cuerpo = texto fijo del servidor en ese idioma + el `message` de la persona (**escapado**, saltos de línea → `<br>`) + la tabla de líneas y el total del registro (como `copyMail`, **con los precios guardados**, no los de la tarifa) + la `quoteNote` si existe; **adjunto** `<número>.pdf`; `Reply-To` = primer correo del equipo (`order_to`/`ORDER_TO`), `cc` según `copyToMe`. Nada de HTML de la persona.
- Resultado: se anota en `history` (`{ at, by, kind:'send', rev, to, ok, reason }`) **aunque falle** y se guarda `lastSent = { at, by, to, ok, reason }`. Respuesta `200 { ok:true, sent:bool, reason:'sent'|'failed'|'skipped', order }` (con `error` solo para manager y ya limpio de secretos). Un fallo de envío **no** es un error HTTP: la persona ve la verdad en `sent:false`.
- Errores de validación: `400` con `{ ok:false, error }` y, en texto, `code`/`field` como `parseOrder`; `404` si el presupuesto no existe.
- PHP: `Audit::log('order.send', $who, $req, 'TV-… → a***@dominio.com' )` (parte local enmascarada).

## 4. Seguridad (lo que hay que conservar)

- **Datos personales**: los ve quien tiene sesión de manager o de propietario; nunca la IP ni el error de correo a un propietario.
- **Relé de correo**: reenviar permite escribir a terceros con adjunto, a diferencia de la copia automática al comprador. Por eso: solo con sesión (con código por correo si el manager lo tiene activo), máx. 3 destinatarios, topes por persona y diarios, asunto y texto fijos, mensaje solo texto plano escapado, PDF validado, `From` fijo del dominio y `Reply-To` del equipo. Una cuenta de propietario comprometida podría mandar hasta 20 correos/hora: por eso las cuentas se protegen con el código por correo (`SEGURIDAD.md`) y, en PHP, cada reenvío queda en **Actividad**.
- **Rol «cliente» = propietario**: ve **todos** los presupuestos. No crear cuentas de compradores con ese rol.

## 5. Pruebas que debe tener cada servidor

1. `client` ve todos los pedidos (de varios correos), sin `ip` ni `emailed.error`; `manager` los ve con ambos.
2. `GET /orders/:n`: 200 (con y sin ip según rol), 404 si no existe, 404 con número raro (`../`, `%2e%2e`, vacío…), 401 sin sesión.
3. `PUT`: edita cliente y líneas; conserva `unit` de líneas sin tocar; revalora al cambiar `qty`; `price` fija `manual`; `price:null` vuelve a tarifa; `total` y `unpriced` bien; `original` se guarda una vez; `rev` sube; `history` crece y se corta en 50; `409` con `rev` viejo; 400 con ref desconocida / repetida / qty 0 / texto con HTML / email malo / nombre corto; 401 sin sesión; el registro no pierde `ip` ni `emailed`.
4. `POST send`: manda a 1 y a 3 destinatarios con adjunto (controlador de prueba «file»/falso); 4 destinatarios → 400; correo malo → 400; sin `pdf` o PDF falso → 400; `message` con HTML → 400; `cc` solo con `copyToMe`; asunto e idioma según `lang` del pedido; el mensaje de la persona sale **escapado**; precios del registro (no los de la tarifa) en la tabla; topes (21.º en una hora → 429); sin correo configurado → 409 `mail_off` y sin historial; fallo del proveedor → `sent:false` + historial `ok:false`; `history` y `lastSent` guardados; `error` solo para manager.
5. Paridad: las mismas peticiones dan las mismas formas de respuesta en los dos servidores (las usa `scripts/qa-admin-live.mjs`).

## 6. Panel (`site/assets/js/admin-live.js` + `admin-quotes.js`)

- Rol `client` se muestra como **Propietario**; menú: *Nuevo presupuesto* · **Presupuestos recibidos** · *Lista de precios* · *Estadísticas*. `manager`: *Presupuestos recibidos* sustituye a «Pedidos».
- En la lista, la columna «Cliente» pasa a **Solicitante**.
- **Lista** con búsqueda (número, nombre, empresa, correo, referencia) y filtro (todos · editados · reenviados · sin avisar al equipo), con botones *Ver*, *PDF* y *Reenviar*.
- **Detalle** (`#recibidos/<número>`; editar: `…/editar`; reenviar: `…/enviar`): datos del solicitante, líneas, totales, nota, historial, y *Editar*, *Descargar PDF*, *Reenviar por correo*, *Ver lo que llegó* (si fue editado).
- **Edición** en la misma pantalla: datos del solicitante, cantidad y precio por línea («tarifa» si se deja vacío), quitar y añadir líneas por referencia, nota del presupuesto. Guardar = `PUT` con `rev`; si hay conflicto (409) lo dice y recarga.
- **PDF**: se fabrica en el navegador con `TV.makeQuotePdf` **en el idioma del pedido** (`Q.withLang`) y con los precios guardados del registro (nunca los de la tarifa de hoy). Descargar = archivo; reenviar = el mismo PDF en base64 en el `POST`.
- **Reenviar**: formulario con destinatarios (el del solicitante ya puesto), mensaje y «enviarme copia»; dice si salió o no y lo anota en el historial.
- Todo texto que viene de la API se **escapa** al pintarlo.

## 7. Decisiones de implementación (iguales en PHP y Worker)

Donde el contrato dejaba margen, los dos servidores hacen lo mismo (lo comprueban `QuotesTest.php`, `workers/api/test/quotes.test.js` y `scripts/qa-admin-live.mjs` con ambos):

- **Orden de comprobaciones:** 401 → 404 (número sin forma de número o inexistente, también para un propietario: nunca 403) → 413/400 (cuerpo) → 409 (`rev` viejo en `PUT`; `mail_off` en `send`) → 429 (topes de `send`) → acción. Un 400 y un `mail_off` **no gastan cupo**.
- **Cuerpo grande:** `413 { ok:false, error:'La petición es demasiado grande' }` (más de 100 000 bytes en `PUT`, más de 6 000 000 en `send`). Vacío, que no es JSON o una lista: `400 'Petición no válida'`.
- **`rev` obligatorio** en `PUT` (entero ≥ 0); si falta o no vale: `400 { error:'Falta rev: la revisión del presupuesto que cargaste', field:'rev' }`.
- **`customer` y `quoteNote`:** si la clave **falta**, se conserva lo que había; si **viene**, tiene que ser válida (`customer` con sus 5 claves como cadenas); `null` → 400.
- **Líneas:** una referencia repetida en la edición es 400 «Línea repetida: REF» (no se suman). Una línea sin `price` y con la misma `qty` conserva `unit`, `total` y `manual` aunque la tarifa haya cambiado desde entonces.
- **`original.at`** es el `at` del pedido recibido (cuándo llegó de la web), no el de la primera edición.
- **`to`:** se pasan a minúsculas, se quitan repetidos y deben quedar entre 1 y 3 (más de 20 entradas en bruto → 400). **`copyToMe`:** solo `false` exacto lo desactiva; el `cc` se omite si quien envía ya va en `to` o es el token maestro.
- **Qué anota un `send`:** no cambia `rev`; `history` guarda `{ at, by, kind:'send', rev, to, ok, reason }` (`reason` = `sent` | `failed` | `skipped`) y `lastSent` guarda `{ at, by, to, ok, reason }`. **El texto de error del proveedor nunca se guarda en el registro** (el manager lo ve en la respuesta, limpio de secretos). Si falla el guardado del historial después de enviar, se registra en el log del servidor y se responde la verdad del envío (200).
- **Correo con precios de demostración:** el título lleva «(PRECIOS DE DEMOSTRACIÓN)» si `prices.mode` del registro no es `live`; el asunto sigue siendo fijo.
- **Caché:** `GET`, `PUT` y `send` responden con `Cache-Control: private, no-store`. Un método que no encaja en una ruta válida (p. ej. `DELETE`) es `404 'No encontrado'`.
- **Actividad (PHP):** `order.edit` anota `TV-… rev N`; `order.send` anota `TV-… → c***@dominio.com, …` (parte local enmascarada) y ` (NO se envió)` si falló. Etiquetas: «Editó un presupuesto recibido» · «Reenvió un presupuesto por correo».
- **Particularidad del router del Worker:** `/api/orders/` (número vacío) se normaliza a `/api/orders` (devuelve la lista, no 404), y `/api/orders/%2e%2e` o `/api/orders/..` se resuelven fuera de la ruta (404 al manager, 403 al propietario). Un número raro sin esas secuencias da siempre «No existe ese presupuesto».

## 8. Textos fijos del correo de reenvío (para validar por idioma)

Los escribió el proyecto (no vienen de la web original); son **borrador** hasta que alguien de cada idioma los valide. En `Mail::QUOTE` (PHP) y `quoteMail` (Worker, `src/email.js`); la tabla de líneas y el total usan los mismos textos que la copia al solicitante. El mensaje de la persona y la nota del presupuesto se escapan y se añaden debajo.

| Idioma | Asunto | Título | Introducción | Etiquetas | Cierre |
|---|---|---|---|---|---|
| ES | `Torivac · presupuesto {n}` | Presupuesto | Te enviamos el presupuesto con los importes de Torivac. Lo encontrarás también adjunto en PDF. | Mensaje · Nota del presupuesto | Si tienes cualquier duda, responde a este correo. |
| EN | `Torivac · quote {n}` | Quote | Here is the quote with the amounts from Torivac. You will also find it attached as a PDF. | Message · Quote note | If you have any questions, just reply to this email. |
| FR | `Torivac · devis {n}` | Devis | Voici le devis avec les montants de Torivac. Vous le trouverez aussi en pièce jointe au format PDF. | Message · Note du devis | Pour toute question, répondez simplement à cet e-mail. |
| DE | `Torivac · Angebot {n}` | Angebot | Hier ist das Angebot mit den Beträgen von Torivac. Sie finden es auch als PDF im Anhang. | Nachricht · Hinweis zum Angebot | Bei Fragen antworten Sie einfach auf diese E-Mail. |

Los textos del **panel** (en castellano) no se traducen: el panel es solo para el equipo.

