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
>    (dominios permitidos: `linkedin.com`). Cubren agencia/marketing, redes,
>    **diseño/desarrollo web, SEO, GEO (posicionamiento en IA) y ADS**.
> 2. Quédate solo con URLs de post (`/posts/...activity-<id>...`). Descarta
>    perfiles, páginas de empresa, `/pulse/`, `/advice/`, `/help/` y los posts
>    que sean de agencias ofreciéndose (no compradores).
> 3. Para cada post, saca el `activity-id` con `extraeActivityId` y féchalo con
>    `decodeActivityDate`. Elimina duplicados por id.
> 4. **Filtra por ventana de recencia** con `filtraPorVentana`: solo posts
>    publicados en las últimas **24 h** (lunes-viernes) o **48 h** (fin de
>    semana). Esta es la regla principal: fuera lo que no entre en la ventana.
> 5. Ordena por frescura y arma el cuerpo con `construyeEmailHtml`.
> 6. Envía el correo con Gmail a `EMAIL_DESTINO` con asunto
>    `Leads LinkedIn diarios — <N> resultados (<X> frescos)`.
> 7. Si no hay resultados dentro de la ventana, envía igualmente un correo corto
>    diciéndolo (es lo normal en la búsqueda pública; ver notas).

## Ajustar

- **Consultas / palabras clave / sectores / ciudades:** edita `QUERIES` en `daily-leads.mjs`.
- **Ventana de recencia (24 h / 48 h finde):** función `ventanaHoras` en `daily-leads.mjs`.
- **Etiquetas de "fresco":** `UMBRAL_FRESCO` / `UMBRAL_RECIENTE` en el mismo fichero.
- **Hora o frecuencia:** `update_trigger` (cron en UTC; ver nota DST abajo).
- **Destinatario:** `EMAIL_DESTINO` en `daily-leads.mjs`.

## Notas honestas

- La búsqueda pública indexa sobre todo **posts antiguos**; los frescos de tu zona
  están tras el login. Con la ventana de 24 h/48 h, **muchos días el correo dirá
  "sin novedades"** — es esperado, no un fallo. La ventana rinde de verdad con el
  modo `--html` de `scan.mjs` sobre una búsqueda guardada desde tu LinkedIn
  logueado y filtrada por "Última semana/24 h", que sí trae los de hoy.
- **Horario de verano (DST):** el cron corre en UTC. 17:00 España = 15:00 UTC en
  verano (CEST) y 16:00 UTC en invierno (CET). El disparador se fija a una de las
  dos; en el cambio de hora puede desviarse 1 h hasta reajustarlo con `update_trigger`.
