# Publicador semanal de novedades en Google Business Profile

> ✅ **Estado real (13/09/2026):** escenario **`GBP PUBLICADOR SEMANAL DE
> NOVEDADES (Santiso Marketing)`** (Make, id `9802376`, carpeta **GOOGLE
> BUSINESS**), **activo**, programado lunes 09:00 (hora España). Ya no
> genera siempre con IA: primero mira si hay contenido en cola en el
> [Excel maestro](./ESTRUCTURA_CONTENIDO_DRIVE.md) y solo si no hay nada
> "Listo" genera un texto nuevo con IA. Publicó de verdad un post real el
> 13/09/2026 (ver notas) y tiene un segundo post en cola ("Listo") para la
> próxima ejecución automática, a modo de prueba de punta a punta.
>
> **Lógica de cola (módulos 10/11/2):**
> 1. `Google Sheets — Search Rows` sobre el Excel maestro, filtrando
>    `Estado = Listo`.
> 2. `Aggregator` cuenta cuántas filas "Listo" hay.
> 3. `Router`: si hay ≥1 en cola → toma la más antigua, publica su
>    `Texto del post` / `Boton / URL destino` tal cual, y marca esa fila
>    como `Publicado` con la fecha. Si no hay ninguna → genera el texto con
>    IA (ángulo libre) como respaldo.
>
> Para ampliarlo a un cliente real: cambiad el filtro del segundo módulo
> (hoy solo deja pasar `locations/641459008971883916`) por el
> `location.name` de ese cliente, y repetid la estructura de Drive
> (Fase 0.5 del plan) para ese cliente.

## Bug real encontrado y corregido (13/09/2026)

La primera ejecución real publicó el texto genérico de IA en vez del post
en cola, a pesar de que el Excel sí tenía una fila `Listo`. Causa raíz,
confirmada con pruebas aisladas contra datos reales:

- **El `Aggregator` de Make expone el array agregado como campo `array`,
  no `bundle`.** El campo `bundle` en el mapper del Aggregator es solo el
  nombre que yo le puse a la plantilla de cada elemento — no es el nombre
  del campo de salida. Todas las condiciones del Router usaban
  `{{length(11.bundle)}}`, que siempre daba `0` (campo inexistente) por
  más filas "Listo" que hubiera. Corregido a `{{length(11.array)}}`.
- **Los campos de `Google Sheets — Search Rows` con nombre puramente
  numérico ("6", "7"...) no se pueden referenciar con `{{12.6}}`** (Make lo
  malinterpreta como el número decimal 12,6) **ni con `get(12; "6")`**
  (devuelve un valor sin sentido). La sintaxis que sí funciona, probada
  contra la fila real: comillas invertidas alrededor del nombre del campo,
  `` {{12.`6`}} ``.
- El mismo patrón (`length(aggregator.bundle)` en vez de `.array`) estaba
  también en el control de duplicados del respondedor de reseñas
  (`GOOGLE_REVIEWS.md`, escenario `9802353`, módulo 14) — nunca se detectó
  porque no ha habido todavía una reseña real 1-3★ que dispare esa ruta.
  Corregido igual, de forma preventiva.
- El post real mal publicado el 13/09/2026 (con el texto de IA en vez del
  de la cola) se corrigió con un `PATCH` directo al mismo post ya
  existente en Google (mismo `name`, sin borrar ni duplicar nada) para que
  el texto y el enlace en la ficha real coincidan con lo previsto.

**Todos los módulos de Make (este escenario y el de reseñas) llevan ahora
un nombre descriptivo de su función** (`1. Buscar ubicaciones...`, `4A.
Publicar post de la cola...`, etc.), visible en el editor de Make, para
que sea más fácil reconocerlos y editarlos más adelante.

Escenario de **Make.com** que, **una vez por semana**, redacta y publica un
post de "Novedades" (Updates / Local Post) para cada cliente activo, sin que
tengáis que preparar nada de contenido a mano.

## Cómo está montado

- **Orquestación (vive en Make, no en este repo):** un escenario con
  disparador semanal que recorre los clientes activos y publica un post por
  cada uno.
- **Lógica versionada:** [`google-novedades-prompts.mjs`](./google-novedades-prompts.mjs)
  — `TEMAS` (rotación de ángulos), `siguienteTema` (qué toca esta semana),
  `promptNovedad` (el prompt para el módulo de IA) y `recortaResumen` (límite
  real de Google, 1500 caracteres).
- **Multi-cliente:** misma fila que en el respondedor de reseñas — reutiliza
  el Sheet **"Clientes GBP"** de [`GOOGLE_REVIEWS.md`](./GOOGLE_REVIEWS.md),
  con dos columnas extra (`temas_propios`, `ultimo_tema`).

### Columnas extra en "Clientes GBP" para novedades

| Columna | Qué es | Ejemplo |
|---|---|---|
| `temas_propios` | Ángulos propios del cliente, separados por coma (opcional; si está vacío usa la rotación por defecto de `TEMAS`) | `cita_urgente,financiacion` |
| `ultimo_tema` | El tema usado la semana pasada (lo actualiza el propio escenario) | `oferta_o_promocion` |

## Estructura del escenario en Make

1. **Trigger — Schedule.** Una vez por semana (ej. lunes 9:00, hora España).
2. **Google Sheets — Search Rows** en "Clientes GBP" filtrando `activo = SI`.
3. **Iterator** sobre cada fila (Make repite los pasos 4-7 por cada cliente).
4. **Tema de esta semana:** `siguienteTema(fila.ultimo_tema, fila.temas_propios?.split(","))`
   — replica esta lógica con un módulo "Set variable"/router, o llama a la
   función si tenéis un módulo de código (Make lo soporta con "Run JS").
5. **Módulo de IA** con el prompt de `promptNovedad(cliente, tema)`.
6. **Google Business Profile — Create a Post**: `location_id` de la fila,
   resumen = texto de la IA (pasado por `recortaResumen`). Si el cliente tiene
   fotos en Drive, añade un módulo "Google Drive — Search Files" antes para
   adjuntar una imagen; si no, publica solo texto (Business Profile lo admite).
7. **Google Sheets — Update a Row**: pon `ultimo_tema` = el tema usado esta
   semana, para que la próxima rote al siguiente.
8. *(Opcional, recomendado)* Tras el Iterator, **Gmail — Send an Email** con
   `asuntoResumen(fechaISO)` / `cuerpoResumen(publicaciones)` a modo de
   resumen semanal: qué se publicó y dónde, sin tener que entrar a cada ficha.

## Ajustar

- **Ángulos por defecto y su orden:** array `TEMAS` en `google-novedades-prompts.mjs`.
- **Ángulos propios de un cliente:** columna `temas_propios` en el Sheet (no hace falta tocar código).
- **Tono/longitud del post:** `promptNovedad` y `LIMITE_CARACTERES` en el mismo fichero.
- **Día/hora de publicación:** el propio módulo "Schedule" en Make.
- **Añadir imagen:** módulo de Google Drive antes de "Create a Post" (no está en la versión mínima).

## Notas honestas

- Esta es la parte de la API de Google Business Profile que Google **restringe
  más** a integraciones nuevas (el acceso a crear "Local Posts" se cerró para
  solicitudes nuevas desde 2020). Como usáis **Make.com**, que ya tiene acceso
  concedido como plataforma, no tenéis que pasar por ese trámite — pero si
  algún día migrarais a una integración propia (API directa), esa parte
  específica puede no estar disponible sin pedir acceso a Google.
- El texto que redacta la IA es genérico por diseño: no inventa precios, citas
  ni datos concretos que no le deis. Si un cliente necesita que el post lleve
  un dato exacto (una oferta con fecha límite, por ejemplo), lo más simple es
  meterlo ya redactado como fila en una cola aparte y que el escenario lo use
  en vez de generar uno — decidme si llegado el caso queréis montar esa cola.
- Revisad los primeros 2-3 posts de cada cliente antes de dejarlo 100% en
  automático: el resumen semanal por email (paso 8) es justo para eso.
