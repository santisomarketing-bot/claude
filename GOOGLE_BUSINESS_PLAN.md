# Plan de trabajo — automatización de Google Business Profile

Hoja de ruta para terminar de dejar en producción el respondedor de reseñas
([`GOOGLE_REVIEWS.md`](./GOOGLE_REVIEWS.md)) y el publicador semanal de
novedades ([`GOOGLE_NOVEDADES.md`](./GOOGLE_NOVEDADES.md)), en fases cortas
que se pueden ir haciendo sesión a sesión. Marca `[x]` según se completen.

## Fase 0 — Base construida ✅ (13/09/2026)

- [x] Escenario `GBP REDACTAR RESPUESTA A RESEÑA` (Make, id `9802353`) creado y probado con un caso 5★ y uno 2★.
- [x] Escenario `GBP PUBLICADOR SEMANAL DE NOVEDADES` (Make, id `9802376`) creado, programado lunes 9:00, filtrado solo a Santiso Marketing.
- [x] Carpeta `GOOGLE BUSINESS` en Make para ambos escenarios.

## Fase 0.5 — Estructura de Drive para contenido ✅ (13/09/2026, piloto Santiso Marketing)

Ver [`ESTRUCTURA_CONTENIDO_DRIVE.md`](./ESTRUCTURA_CONTENIDO_DRIVE.md) para el detalle completo.

- [x] Carpeta `NOVEDADES GOOGLE BUSINESS` (dentro de la carpeta de la marca en Drive) con Excel maestro, subcarpeta `BORRADORES PUBLICACION` y un post de ejemplo.
- [x] Carpeta `PUBLICACIONES LINKEDIN` con su propio Excel maestro y un post de ejemplo.
- [x] Escenario en Make `NOVEDADES GBP - Recordatorio mensual de contenido` (id `9802497`), activo, probado con un envío real. Manda un email el día 1 de cada mes con el link a `BORRADORES PUBLICACION` y al Excel maestro.
- [ ] Revisar y aprobar (o borrar) los posts de ejemplo antes de que se acumule contenido real encima.
- [ ] Decidir si el recordatorio mensual va también a un email del cliente, o solo interno.

## Fase 1 — Cerrar el circuito del respondedor de reseñas ✅ (13/09/2026)

- [x] ~~Trigger **Watch Reviews**~~ — **descartado**: confirmado con pruebas reales que este módulo de Make está roto (siempre llama a `/v4/reviews` sin cuenta/ubicación, 404 fijo, pase lo que pase en el mapeo). No es un error de configuración.
- [x] Reemplazado por **`Make an API Call`** (GET a `v4/accounts/.../locations/.../reviews`) + un **Iterator** que recorre cada reseña + filtro "sin `reviewReply` todavía" para no reprocesar. Probado con datos reales de Ecokil (pipeline completo funcionando: lectura + IA).
- [x] **Módulo de publicación** (ruta 4-5★): también por `Make an API Call` (`PATCH v4/{name}/reply`) ya que tampoco existe/funciona el módulo nativo por su nombre oficial. Mecánica de la llamada probada (URL, auth, método) contra un ID inventado — sin publicar nada real todavía.
- [x] **Control de duplicados** (ruta 1-3★): Sheet "Control de reseñas respondidas - Santiso Marketing" + Filter Rows + Aggregator antes de mandar el email; se registra la reseña después de avisar para no repetir el email.
- [x] El escenario `GBP REDACTAR RESPUESTA A RESEÑA` (id `9802353`) corre esta lógica completa apuntando a **Santiso Marketing** (piloto). Sigue en modo `on-demand` (no automático todavía).
- [ ] **Falta probar con una reseña 1-3★ real**: ni Santiso Marketing (0 reseñas) ni Ecokil (todas 5★) tienen ahora mismo una negativa para validar el control de duplicados de punta a punta. Las piezas están probadas por separado con datos reales.
- [ ] Cuando haya un caso real revisado a mano: cambiar la programación de `on-demand` a `indefinitely` (ej. cada 15 min) para que corra solo.

**Decisión ya tomada:** piloto en Santiso Marketing (propio negocio de la agencia).

## Fase 2 — Piloto del respondedor en un cliente real

- [ ] Activar el trigger de reseñas **solo** para el negocio piloto elegido en la Fase 1.
- [ ] Dejarlo correr 1-2 semanas.
- [ ] Revisar las respuestas publicadas (tono, precisión) y los borradores recibidos por email.
- [ ] Ajustar `google-reviews-prompts.mjs` / el prompt en Make si hace falta.

## Fase 3 — Cerrar el publicador de novedades ✅ (13/09/2026)

- [x] Conectado el publicador semanal con la carpeta `NOVEDADES GOOGLE BUSINESS` (Fase 0.5): lee el Excel maestro y prioriza una fila `Listo` en cola; solo genera con IA si no hay ninguna. Ver [`GOOGLE_NOVEDADES.md`](./GOOGLE_NOVEDADES.md).
- [x] **Publicado un post real** (13/09/2026, contenido basado en un artículo real del blog) en la ficha real de Santiso Marketing. Se detectó y corrigió un bug real (el Router nunca detectaba la cola por un problema de sintaxis de Make — ver detalle en `GOOGLE_NOVEDADES.md`); el post publicado se corrigió con un `PATCH` una vez arreglada la causa.
- [x] Dejado un segundo post en cola (`Estado = Listo`) para que la próxima ejecución automática (el próximo lunes 09:00) lo publique solo, a modo de prueba de punta a punta.
- [x] Todos los módulos de ambos escenarios (`9802353` y `9802376`) tienen ahora un nombre descriptivo de su función en el editor de Make.
- [ ] Revisar que el segundo post se publique correctamente el próximo lunes antes de sumar clientes.
- [ ] Activar el escenario para un cliente real (hoy sigue filtrado solo a Santiso Marketing).

## Fase 4 — Expansión gradual a clientes reales

Repetir por lotes pequeños (2-3 clientes por sesión) para ambos escenarios:

- [ ] Elegir el siguiente lote de clientes (de los 16 negocios en la cuenta: Ecokil, Why Not Barbershop (Gràcia/Senillosa/Paris/Academy), IcebergExpo, TORIVAC, DOMINA TU DISCURSO, Titan Flow, SoloRueda Torrelavega, Simply Stunning Interiors, KrtoonsEvents, Rockpull, Taller Fast Engine).
- [ ] Por cada cliente nuevo: replicar la estructura de Drive de la Fase 0.5 (`<marca>/NOVEDADES GOOGLE BUSINESS/`, `<marca>/PUBLICACIONES LINKEDIN/`) dentro de su carpeta de marca.
- [ ] Confirmar tono de marca, sector y (para novedades) la URL real de destino.
- [ ] Ampliar el filtro del publicador de novedades para incluir su `location.name`.
- [ ] Activar el respondedor de reseñas para ese cliente.
- [ ] Confirmar con el cliente (o con vosotros internamente) que el tono de las primeras respuestas/posts es el correcto.

## Fase 5 — Mejoras (cuando el resto esté estable)

- [x] Publicador de LinkedIn automático (13/09/2026): escenario `LINKEDIN PUBLICADOR SEGUN FRECUENCIA` (id `9802783`), activo, corre a diario y publica solo cuando toca según la `Frecuencia` elegida en el propio Excel maestro (pestaña `Configuracion`, seleccionable sin tocar Make) y hay contenido `Listo` en cola. Ver [`LINKEDIN_PUBLICACIONES.md`](./LINKEDIN_PUBLICACIONES.md).
- [x] **Cola de contenido cargada en ambas plataformas (13/09/2026)**: 16 posts `Listo` en LinkedIn y 16 en Novedades GBP, armados a partir de las fotos que ya estaban en `BORRADORES PUBLICACION`. Van a salir de a uno por semana en cada plataforma — falta la prueba de punta a punta real (que el primer post de cada cola salga bien solo).
- [ ] Resolver de forma sistemática el enlace público de las fotos/videos de Drive (hoy hay que compartirlas a mano, y en el caso de LinkedIn no se pudieron mover a subcarpetas propias por pertenecer a otra cuenta de Drive) — ver nota en `ESTRUCTURA_CONTENIDO_DRIVE.md`.
- [ ] Historial/auditoría: una fila por respuesta y por post publicado, para ver todo sin entrar a Google.
- [ ] Revisar si conviene mover el email de aprobación de reseñas 1-3★ a un canal más ágil (Slack, WhatsApp) si el volumen crece.

## Notas

- Todo lo de Fase 1 en adelante que publique o responda **de verdad** en una
  ficha real requiere vuestro ok antes de activarlo — no se activa nada solo
  porque esté construido.
- El orden de fases es una propuesta; si preferís otro orden (por ejemplo,
  arrancar por novedades en vez de reseñas) se reordena sin problema.
