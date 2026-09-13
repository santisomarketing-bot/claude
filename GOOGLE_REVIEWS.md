# Respondedor de reseñas de Google Business Profile

> ✅ **Estado real (13/09/2026):** el escenario `GBP REDACTAR RESPUESTA A
> RESEÑA` (Make, equipo Santiso Marketing S.L.U., carpeta **GOOGLE
> BUSINESS**, id `9802353`) está **completo y probado con datos reales**
> (contra las reseñas reales de Ecokil, sin publicar nada en real ahí — ver
> notas). Apunta a **Santiso Marketing** como piloto. Sigue en modo
> **`on-demand`** (no corre solo todavía) a la espera de la Fase 2 del plan.

Escenario de **Make.com** que detecta reseñas nuevas de un negocio y responde:

- **4-5★ → se publica sola.** Bajo riesgo, no hace falta revisarla.
- **1-3★ → se manda un borrador por email y NO se publica sola**, y no se
  vuelve a avisar dos veces de la misma reseña.

## Por qué no usa el trigger nativo "Watch Reviews"

Lo probamos en real: el módulo **"Watch Reviews"** de Google Business
Profile en Make está **roto** — sin importar la cuenta/ubicación que le
pongas, siempre llama a `GET /v4/reviews` (sin cuenta ni ubicación en la
URL) y Google responde 404. Confirmado con dos configuraciones distintas
(una mal hecha por mí, otra bien hecha a mano en el editor de Make) — mismo
resultado exacto en ambas, así que no es un error de configuración.

**Reemplazo que sí funciona:** un módulo **`Make an API Call`** (Google
Business Profile) haciendo `GET` directo a
`v4/accounts/{account}/locations/{location}/reviews`, seguido de un
**Iterator** que recorre cada reseña del array `body.reviews`. Probado con
las 3 reseñas reales de Ecokil (todas 5★) — trae bien `reviewId`,
`starRating` (viene como texto: `ONE`…`FIVE`, no como número),
`reviewer.displayName`, `comment` y `reviewReply` (el campo que indica si
ya tiene respuesta).

## Cómo está montado (escenario `9802353`)

1. **`Make an API Call`** — `GET v4/accounts/.../locations/.../reviews?pageSize=20` (conexión `My Google Custom connection`).
2. **Iterator** sobre `{{1.body.reviews}}` — una reseña por bundle.
3. **Router**, dos rutas, ambas exigen que la reseña **no tenga ya `reviewReply`** (si ya tiene, no se toca):

### Ruta A — 4★/5★ (autopublicar)

4. **OpenAI (`gpt-4.1-mini`)** redacta la respuesta pública.
5. **`Make an API Call`** — `PATCH v4/{name}/reply` con `{"comment": "<respuesta>"}`. Este es el reemplazo de "Create/Update a Review Reply" (tampoco encontré ese módulo por su nombre oficial, así que se hace igual que la lectura: llamando directo al endpoint de Google). Probado en real que la llamada llega bien formada hasta Google (con un ID de reseña inventado, para no publicar nada de verdad en la prueba).
6. Devuelve `{autopublicar: true, respuesta, publicado}`.

### Ruta B — 1★/2★/3★ (borrador, con control de duplicados)

4. **Google Sheets — Filter Rows** busca en **"Control de reseñas respondidas - Santiso Marketing"** (Drive, carpeta raíz de la marca) si ya existe una fila con este `reviewId`.
5. **Aggregator** junta el resultado en un solo array (vacío si no hay coincidencia).
6. **Filtro:** solo sigue si ese array está vacío (`length = 0`) — es decir, si todavía no se avisó de esta reseña.
7. **OpenAI** redacta el borrador (tono empático, sin autopublicar).
8. **Gmail — Send an email** a santisomarketing@gmail.com con el borrador.
9. **Google Sheets — Add a Row** registra `reviewId`, `starRating` y fecha en el Sheet de control, para que la próxima vez el paso 6 lo frene.

## Sheet "Control de reseñas respondidas - Santiso Marketing"

Un Sheet simple (pestaña `Hoja 1`), tres columnas sin encabezado por ahora:
`reviewId`, `estrellas`, `fecha del aviso`. Una fila por cada reseña 1-3★
que ya generó un email — mientras la fila exista, no se vuelve a avisar de
esa reseña.

## Ajustar

- **Umbral de autopublicar:** las condiciones `FOUR`/`FIVE` vs `ONE`/`TWO`/`THREE` en los filtros del Router.
- **Tono/longitud de las respuestas:** el texto del prompt en cada módulo de OpenAI.
- **A quién le llega el borrador / dónde se autopublica:** hoy hardcodeado a Santiso Marketing (piloto); para otra marca se cambia el `location` en la URL del paso 1, el nombre del negocio en los prompts, y el destinatario del email.
- **Frecuencia:** el escenario sigue en `on-demand`. Pasar a `indefinitely` (ej. cada 15 min) cuando se decida activarlo en automático — ver `GOOGLE_BUSINESS_PLAN.md`.

## Notas honestas

- **Probado con datos reales de Ecokil** (lectura y generación de respuesta contra sus 3 reseñas 5★ reales) para confirmar que el mapeo de campos es correcto — sin publicar ni mandar nada a nombre de Ecokil. Después se devolvió el escenario a apuntar a Santiso Marketing.
- **Lo que falta confirmar con datos reales:** ni Santiso Marketing (0 reseñas) ni Ecokil (todas 5★) tienen ahora mismo una reseña 1-3★ real para probar el control de duplicados de punta a punta. La lógica está armada y sus piezas (la búsqueda en el Sheet, el agregador, el registro) están probadas por separado con datos reales; falta el caso "reseña negativa real" para la prueba completa.
- **El módulo de publicación (ruta A)** está probado solo a nivel de mecánica de la llamada (URL, autenticación, método) contra un ID de reseña inventado — nunca se ejecutó contra una reseña real, para no publicar nada sin que lo hayáis visto antes. Antes de activar el sondeo automático, conviene revisar el primer caso real a mano.
- Si en el futuro cambiáis de Make a una integración propia, la lógica de decisión (umbral, prompts, control de duplicados) se traslada igual — lo que cambia es solo qué sistema hace las llamadas HTTP.
