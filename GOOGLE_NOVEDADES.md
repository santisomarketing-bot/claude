# Publicador semanal de novedades en Google Business Profile

> ✅ **Estado real (13/09/2026):** ya existe en vuestro Make (equipo Santiso
> Marketing S.L.U., carpeta **GOOGLE BUSINESS**) el escenario
> **`GBP PUBLICADOR SEMANAL DE NOVEDADES (PRUEBA: solo Santiso Marketing)`**
> (id `9802376`), programado para lunes 09:00 (hora España). Encadena
> `Search Locations` (vuestra cuenta, id `104496299100098224068`, la misma
> que usan ECOKIL/IcebergExpo/etc.) → redacción con OpenAI → `Create a Post`.
>
> **Lo dejé en INACTIVO y filtrado solo a vuestra propia ficha (Santiso
> Marketing) a propósito:** publicar de verdad es una acción pública y
> visible en un listado real, así que no la lancé ni la activé sin
> confirmároslo primero — ni siquiera contra vuestra propia ficha. Antes de
> activarlo:
> 1. Revisad/corregid la URL del botón (puse `https://www.santisomarketing.com`
>    a modo de ejemplo — confirmad cuál es la real).
> 2. Lanzad una ejecución de prueba manual desde Make y mirad el texto que
>    sale antes de dejarlo en automático.
> 3. Para ampliarlo a un cliente real, cambiad el filtro del segundo módulo
>    (hoy solo deja pasar `locations/641459008971883916`) por el
>    `location.name` de ese cliente (la lista completa de vuestros 16
>    negocios en esta cuenta la tengo si la queréis).
>
> Por ahora usa un único ángulo "libre" (la IA varía el enfoque cada vez)
> en vez de la rotación por Sheet descrita más abajo — es la versión mínima
> que ya funciona; la rotación con hoja de cálculo queda como mejora futura.

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
