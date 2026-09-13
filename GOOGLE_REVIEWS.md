# Respondedor de reseñas de Google Business Profile

Escenario de **Make.com** (ya tienes Google Business Profile conectado ahí) que
detecta reseñas nuevas en los negocios de los clientes y responde:

- **4-5★ → se publica sola.** Bajo riesgo, no hace falta revisarla.
- **1-3★ → se manda un borrador por email y NO se publica sola.** Una reseña
  negativa mal respondida es más cara que el tiempo de revisarla.

## Cómo está montado

- **Orquestación (vive en Make, no en este repo):** un escenario que dispara
  con cada reseña nueva y decide la ruta según la puntuación.
- **Lógica versionada:** [`google-reviews-prompts.mjs`](./google-reviews-prompts.mjs)
  — `decideRuta` (umbral 4-5★ vs 1-3★), `promptRespuesta` (el prompt para el
  módulo de IA), `recortaRespuesta` (límite de longitud) y las plantillas del
  email de borrador (`asuntoBorrador` / `cuerpoBorrador`).
- **Multi-cliente:** una fila por negocio en el Sheet **"Clientes GBP"**
  (columnas abajo). Si gestionáis varios clientes desde una sola cuenta de
  Google con permiso de **Gerente** en cada ficha, un solo escenario cubre a
  todos filtrando por `location_id`. Si cada cliente tiene su propio login de
  Google, duplica el escenario por cliente (misma lógica, distinta conexión).

### Sheet "Clientes GBP" (columnas)

| Columna | Qué es | Ejemplo |
|---|---|---|
| `cliente` | Nombre del negocio | Clínica Demo |
| `location_id` | ID de la ficha en Business Profile | `accounts/123/locations/456` |
| `tono` | Tono de marca para la IA | cercano y profesional |
| `sector` | Sector (opcional, mejora el prompt) | clínica dental |
| `email_aprobacion` | A quién le llega el borrador de reseñas 1-3★ | equipo@clinicademo.es |
| `activo` | SI/NO — si está NO, el escenario la salta | SI |

## Estructura del escenario en Make

1. **Trigger — Google Business Profile: Watch Reviews.** Poll cada 15-30 min.
2. **Google Sheets — Search Rows** en "Clientes GBP" por `location_id` de la
   reseña, para sacar `cliente`, `tono`, `sector`, `email_aprobacion`.
3. **Router** con dos rutas según `rating` de la reseña (usa `decideRuta` de
   `google-reviews-prompts.mjs` como referencia: ≥4 va a la ruta A, ≤3 a la B).

### Ruta A — 4★/5★ (autopublicar)

4. **Módulo de IA** (OpenAI/Claude/HTTP, el que tengas conectado en Make) con
   el prompt de `promptRespuesta(cliente, reseña)` — la función ya devuelve
   el prompt completo para este caso (agradecer, mencionar algo concreto).
5. **Google Business Profile — Create/Update a Review Reply**: publica el
   texto de la IA (pasado por `recortaRespuesta` si tu módulo no corta solo).
6. *(Opcional)* **Google Sheets — Add a Row** en un histórico de respuestas,
   para poder auditar qué se ha contestado sin entrar a Google.

### Ruta B — 1★/2★/3★ (borrador, no se publica sola)

4. **Módulo de IA** con el prompt de `promptRespuesta(cliente, reseña)` para
   este caso (empático, sin ponerse a la defensiva, invita a resolver por
   privado).
5. **Gmail — Send an Email** a `email_aprobacion` con asunto
   `asuntoBorrador(cliente, reseña)` y cuerpo `cuerpoBorrador(cliente, reseña, textoIA)`.
   Alguien del equipo publica la respuesta a mano (o la edita antes).
6. *(Opcional)* **Google Sheets — Add a Row** en una pestaña "Pendientes de
   aprobar" (`cliente`, `reseña`, `borrador`, `estado=pendiente`) para tener
   un panel de lo que falta por publicar.

## Ajustar

- **Umbral de autopublicar:** `UMBRAL_AUTOPUBLICAR` en `google-reviews-prompts.mjs` (por defecto 4).
- **Tono/longitud de las respuestas:** `promptRespuesta` y `LIMITE_CARACTERES` en el mismo fichero.
- **A quién le llega el borrador:** columna `email_aprobacion` por cliente en el Sheet (no hace falta tocar código).
- **Frecuencia del polling:** en el propio módulo "Watch Reviews" de Make.

## Notas honestas

- La API de reseñas de Google Business Profile (leer y responder) es la parte
  **estable** de esta integración — Make la ofrece como módulo nativo desde
  hace años.
- El **borrador para 1-3★ es la versión mínima**: manda el email y ya, alguien
  publica a mano. Si más adelante queréis que un "SI" por email publique solo
  la respuesta, es un escenario aparte (watch del hilo de Gmail + publicar) —
  no lo he montado para no complicar la primera versión sin que la hayáis
  probado en real.
- Si en el futuro cambiáis de Make a la API oficial directamente, la lógica
  de `google-reviews-prompts.mjs` (prompts, umbral, recorte) se reutiliza tal
  cual — lo único que cambia es qué llama a qué.
