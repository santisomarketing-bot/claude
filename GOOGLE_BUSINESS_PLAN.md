# Plan de trabajo — automatización de Google Business Profile

Hoja de ruta para terminar de dejar en producción el respondedor de reseñas
([`GOOGLE_REVIEWS.md`](./GOOGLE_REVIEWS.md)) y el publicador semanal de
novedades ([`GOOGLE_NOVEDADES.md`](./GOOGLE_NOVEDADES.md)), en fases cortas
que se pueden ir haciendo sesión a sesión. Marca `[x]` según se completen.

## Fase 0 — Base construida ✅ (13/09/2026)

- [x] Escenario `GBP REDACTAR RESPUESTA A RESEÑA` (Make, id `9802353`) creado y probado con un caso 5★ y uno 2★.
- [x] Escenario `GBP PUBLICADOR SEMANAL DE NOVEDADES` (Make, id `9802376`) creado, programado lunes 9:00, filtrado solo a Santiso Marketing.
- [x] Carpeta `GOOGLE BUSINESS` en Make para ambos escenarios.

## Fase 1 — Cerrar el circuito del respondedor de reseñas

- [ ] En Make, añadir el trigger **Watch Reviews** (Google Business Profile) sobre la cuenta `104496299100098224068`.
- [ ] Conectar ese trigger para que llame a `GBP REDACTAR RESPUESTA A RESEÑA` con `negocio`/`autor`/`estrellas`/`texto`.
- [ ] En la ruta 4-5★ del propio escenario, añadir el módulo **Create/Update a Review Reply** para publicar `respuesta` de verdad.
- [ ] Probar con una reseña real (o dejar caer una de prueba) en **un solo negocio** antes de activarlo para todos.
- [ ] Confirmar que el email de borrador (1-3★) llega bien y con buen aspecto.

**Decisión tuya:** ¿en qué negocio probamos primero? (Sugerencia: Santiso
Marketing propio o Ecokil, que ya tienen todo el resto de infraestructura
montada.)

## Fase 2 — Piloto del respondedor en un cliente real

- [ ] Activar el trigger de reseñas **solo** para el negocio piloto elegido en la Fase 1.
- [ ] Dejarlo correr 1-2 semanas.
- [ ] Revisar las respuestas publicadas (tono, precisión) y los borradores recibidos por email.
- [ ] Ajustar `google-reviews-prompts.mjs` / el prompt en Make si hace falta.

## Fase 3 — Cerrar el publicador de novedades

- [ ] Corregir la URL real en el módulo `Create a Post` (hoy tiene un placeholder, `https://www.santisomarketing.com`).
- [ ] Ejecutar una vez a mano desde Make y revisar el texto generado.
- [ ] Activar el escenario **solo** para Santiso Marketing (ya está filtrado así) durante 2-3 semanas.
- [ ] Revisar los primeros posts publicados antes de sumar clientes.

## Fase 4 — Expansión gradual a clientes reales

Repetir por lotes pequeños (2-3 clientes por sesión) para ambos escenarios:

- [ ] Elegir el siguiente lote de clientes (de los 16 negocios en la cuenta: Ecokil, Why Not Barbershop (Gràcia/Senillosa/Paris/Academy), IcebergExpo, TORIVAC, DOMINA TU DISCURSO, Titan Flow, SoloRueda Torrelavega, Simply Stunning Interiors, KrtoonsEvents, Rockpull, Taller Fast Engine).
- [ ] Por cada cliente nuevo: confirmar tono de marca, sector y (para novedades) la URL real de destino.
- [ ] Ampliar el filtro del publicador de novedades para incluir su `location.name`.
- [ ] Activar el respondedor de reseñas para ese cliente.
- [ ] Confirmar con el cliente (o con vosotros internamente) que el tono de las primeras respuestas/posts es el correcto.

## Fase 5 — Mejoras (cuando el resto esté estable)

- [ ] Rotación de temas de novedades vía Google Sheet (`GOOGLE_NOVEDADES.md` ya documenta el diseño) en vez de "libre".
- [ ] Historial/auditoría: una fila por respuesta y por post publicado, para ver todo sin entrar a Google.
- [ ] Imágenes en los posts de novedades (módulo de Google Drive con fotos por cliente).
- [ ] Revisar si conviene mover el email de aprobación de reseñas 1-3★ a un canal más ágil (Slack, WhatsApp) si el volumen crece.

## Notas

- Todo lo de Fase 1 en adelante que publique o responda **de verdad** en una
  ficha real requiere vuestro ok antes de activarlo — no se activa nada solo
  porque esté construido.
- El orden de fases es una propuesta; si preferís otro orden (por ejemplo,
  arrancar por novedades en vez de reseñas) se reordena sin problema.
