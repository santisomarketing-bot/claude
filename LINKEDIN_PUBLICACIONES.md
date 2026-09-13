# Publicador de LinkedIn (empresa)

> ✅ **Estado real (13/09/2026):** escenario **`LINKEDIN PUBLICADOR SEGUN
> FRECUENCIA (Santiso Marketing)`** (Make, id `9802783`, carpeta **GOOGLE
> BUSINESS**), **activo**, programado a diario a las 09:30 (hora España).
> Publica imagen + texto en la página de empresa de LinkedIn
> (`Santiso Marketing S.L.`, vía el módulo ya existente en la cuenta,
> `linkedin:CreateCompanyImagePost`).
>
> **Todavía no se publicó ningún post real**: el único contenido que hay
> en el [Excel maestro](./ESTRUCTURA_CONTENIDO_DRIVE.md) es la fila
> `EJEMPLO`, y su imagen tiene un enlace "PENDIENTE" (no es una URL
> pública real todavía — ver nota en `ESTRUCTURA_CONTENIDO_DRIVE.md`
> sobre compartir imágenes de Drive). En cuanto se suba una imagen real
> con enlace público y se ponga `Estado = Listo` en una fila, el
> escenario la publica sola en la próxima ejecución diaria si además toca
> según la frecuencia configurada.

## La frecuencia es seleccionable en el propio Excel (no en Make)

El Excel maestro de LinkedIn tiene ahora una pestaña extra, **`Configuracion`**:

| Frecuencia de publicacion | Proxima publicacion | Notas | Posts en cola (Listo) |
|---|---|---|---|
| `Semanal` (desplegable) | `2026-09-13` | — | `=COUNTIF(Untitled!B:B;"Listo")` |

- **`Frecuencia de publicacion`**: desplegable con `Diaria` / `Semanal` /
  `Quincenal` / `Mensual`. Se puede cambiar en cualquier momento sin tocar
  Make — el escenario la lee en cada ejecución.
- **`Proxima publicacion`**: fecha (`YYYY-MM-DD`) en la que toca el
  siguiente post. El escenario corre **todos los días** a las 09:30, pero
  solo publica si `hoy >= Proxima publicacion` **y** hay al menos una fila
  `Listo` en cola. Después de publicar, el propio escenario calcula la
  siguiente fecha sumando el intervalo de la `Frecuencia` elegida
  (1 / 7 / 14 / 30 días) y la guarda aquí solo.
- **`Posts en cola (Listo)`**: no lo toca nadie a mano — es una fórmula
  `COUNTIF` que cuenta cuántas filas dicen `Listo` en el Excel principal.
  El escenario la lee para decidir si hay algo que publicar.

## Cómo está montado (escenario `9802783`)

1. **`Google Sheets — Search Rows`** sobre `Configuracion` (trae Frecuencia,
   Proxima publicacion y el conteo de cola en una sola llamada).
2. **Filtro** (antes del siguiente módulo): `hoy >= Proxima publicacion`
   **y** `Posts en cola > 0`. Si no se cumple, el escenario termina ahí
   mismo sin hacer nada (ni publica, ni toca el Excel).
3. **`Google Sheets — Search Rows`** trae la fila `Listo` más antigua del
   Excel principal.
4. **`LinkedIn — Create a Company Image Post`**: `content` = `Texto del
   post`, `url` = `Link imagen (URL publica)`.
5. **`Google Sheets — Update a Row`**: marca esa fila como `Publicado` con
   la fecha.
6. **`Google Sheets — Make an API Call`**: calcula la próxima fecha
   (hoy + intervalo de la Frecuencia) y la guarda en `Configuracion!B2`.

## Bug real de Make evitado (13/09/2026)

Al construir esto se descubrió que el módulo **`Aggregator`** de Make,
cuando su "feeder" es un `Search Rows` (no un iterador nativo), **siempre
reporta un array de longitud 1, aunque el `Search Rows` no haya encontrado
ninguna fila real** — confirmado con una búsqueda deliberadamente
imposible. Por eso aquí (y ahora también en el publicador de Novedades,
ver [`GOOGLE_NOVEDADES.md`](./GOOGLE_NOVEDADES.md)) **no se usa
`Aggregator` + `length()` para saber si hay cola** — se usa en su lugar
una celda con fórmula `COUNTIF` en el propio Excel, que Google Sheets
calcula de verdad y Make solo lee. Es más simple y no depende de esta
particularidad de Make.

## Ajustar

- **Cambiar la frecuencia:** una sola celda (`Configuracion!A2`), sin
  tocar Make.
- **Adelantar o atrasar el próximo post:** editar `Configuracion!B2`
  directamente.
- **Tono/contenido:** no genera nada con IA — solo publica lo que ya está
  escrito y marcado `Listo` en el Excel (a diferencia de Novedades GBP,
  que sí tiene una IA de respaldo si la cola está vacía). Si se quiere lo
  mismo aquí, se puede sumar una ruta B con IA igual que en Novedades.

## Notas honestas

- **Enlace público de la imagen:** LinkedIn necesita una URL pública real
  de la imagen (no un link de Drive privado). Sigue pendiente resolver
  esto de forma sistemática — ver nota en
  [`ESTRUCTURA_CONTENIDO_DRIVE.md`](./ESTRUCTURA_CONTENIDO_DRIVE.md).
  Mientras tanto, la fila de ejemplo tiene un enlace "PENDIENTE" a
  propósito, para que no se publique nada por error.
- **No hay ruta de aviso si la cola queda vacía:** si toca publicar según
  la fecha pero no hay ninguna fila `Listo`, el escenario simplemente no
  hace nada ese día (no manda ningún email). El recordatorio mensual de
  contenido de Novedades GBP no cubre LinkedIn — si se quiere un aviso
  parecido, es un módulo de email más, fácil de sumar.
- Probado en real (13/09/2026) solo el camino "no hay nada que publicar"
  (con la cola en 0): el escenario corre y no toca nada, correctamente.
  Falta la prueba de punta a punta con un post real en cuanto haya una
  imagen con enlace público de verdad.
