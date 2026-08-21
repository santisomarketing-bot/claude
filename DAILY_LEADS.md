# Envío diario de leads de LinkedIn por correo

Automatización que, **cada día a las 17:00 (hora España)**, busca posts públicos de
LinkedIn con intención de compra ("busco agencia de marketing", etc.), los fecha,
y manda un correo con los resultados a **santisomarketing@gmail.com**.

## Cómo está montado

- **Disparador (Routine):** una tarea programada de Claude Code que arranca una
  sesión nueva cada día a las 17:00 España y le pasa el prompt de abajo.
  Se gestiona con las herramientas `create_trigger` / `list_triggers` / `update_trigger`
  (no vive como fichero en el repo; el repo guarda la lógica y el playbook).
- **Lógica versionada:** [`daily-leads.mjs`](./daily-leads.mjs) — consultas
  canónicas (`QUERIES`), decodificador de fecha del post (`decodeActivityDate`),
  clasificación por frescura y generador del cuerpo HTML (`construyeEmailHtml`).
- **Envío:** conector de Gmail (`send_message`).

## Prompt que ejecuta la sesión programada

> Ejecuta el barrido diario de leads de LinkedIn siguiendo `DAILY_LEADS.md` del
> repo `santisomarketing-bot/claude` (rama `claude/weekly-invoice-automation-04y2d6`):
>
> 1. Para cada consulta de `QUERIES` en `daily-leads.mjs`, corre **WebSearch**
>    (dominios permitidos: `linkedin.com`).
> 2. Quédate solo con URLs de post (`/posts/...activity-<id>...`). Descarta
>    perfiles, páginas de empresa, `/pulse/`, `/advice/`, `/help/` y los posts
>    que sean de agencias ofreciéndose (no compradores).
> 3. Para cada post, saca el `activity-id` con `extraeActivityId`, féchalo con
>    `decodeActivityDate` y clasifícalo con `clasifica`. Elimina duplicados por id.
> 4. Ordena por frescura y arma el cuerpo con `construyeEmailHtml`.
> 5. Envía el correo con Gmail a `EMAIL_DESTINO` con asunto
>    `Leads LinkedIn diarios — <N> resultados (<X> frescos)`.
> 6. Si no hay resultados nuevos, envía igualmente un correo corto diciéndolo.

## Ajustar

- **Consultas / sectores / ciudades:** edita `QUERIES` en `daily-leads.mjs`.
- **Qué es "fresco":** `UMBRAL_FRESCO` / `UMBRAL_RECIENTE` en el mismo fichero.
- **Hora o frecuencia:** `update_trigger` (cron en UTC; ver nota DST abajo).
- **Destinatario:** `EMAIL_DESTINO` en `daily-leads.mjs`.

## Notas honestas

- La búsqueda pública indexa sobre todo **posts antiguos**; los frescos de tu zona
  están tras el login. Este envío es un goteo de cobertura amplia, no un flujo de
  leads recién publicados. Para lo reciente, usa el modo `--html` de `scan.mjs`
  con una búsqueda guardada desde tu LinkedIn logueado.
- **Horario de verano (DST):** el cron corre en UTC. 17:00 España = 15:00 UTC en
  verano (CEST) y 16:00 UTC en invierno (CET). El disparador se fija a una de las
  dos; en el cambio de hora puede desviarse 1 h hasta reajustarlo con `update_trigger`.
