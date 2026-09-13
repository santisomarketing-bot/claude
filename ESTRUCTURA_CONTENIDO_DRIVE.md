# Estructura de contenido en Drive (por marca)

Patrón para organizar el contenido de cada marca en Google Drive, pensado
para alimentar el publicador de novedades de Google Business
([`GOOGLE_NOVEDADES.md`](./GOOGLE_NOVEDADES.md)) y, más adelante, un
publicador de LinkedIn. Montado y probado con **Santiso Marketing** como
ejemplo — se replica igual dentro de la carpeta de cada cliente.

## Estructura, dentro de la carpeta de la marca (ej. `Santiso Marketing/`)

```
<Marca>/
  NOVEDADES GOOGLE BUSINESS/
    Excel maestro - Novedades Google Business      <- fila = un post
    BORRADORES PUBLICACION/                         <- subir aquí material nuevo
    <ID del post> - <tema>/                         <- una carpeta por post
      Video o foto del post
      Copy - <tema>                                 <- texto propuesto
  PUBLICACIONES LINKEDIN/
    Excel maestro - Publicaciones LinkedIn          <- fila = un post
    <ID del post> - <tema>/
      Foto o video del post
      Copy - <tema>
```

**Regla de oro:** el nombre de cada subcarpeta de post coincide con la
columna `Carpeta` de su fila en el Excel maestro correspondiente. El Excel
es la fuente de verdad de qué existe y en qué estado está; la carpeta es
donde vive el archivo real.

## Excel maestro — Novedades Google Business (columnas)

| Columna | Qué es |
|---|---|
| `ID` | Identificador único de la fila (ej. `2026-09-EJEMPLO`) |
| `Estado` | Borrador / Listo para publicar / Publicado / Descartado |
| `Mes previsto` | Cuándo se piensa usar |
| `Tipo` | Foto / Video / Carrusel |
| `Carpeta` | Nombre exacto de la subcarpeta con el contenido |
| `Link carpeta` | Enlace directo a esa subcarpeta en Drive |
| `Texto del post` | El copy ya adaptado a Google Business (corto, sin hashtags) |
| `Boton / URL destino` | La llamada a la acción del post |
| `Fecha publicacion` | Se completa cuando el publicador semanal lo usa |
| `Notas` | Lo que haga falta aclarar |

## Excel maestro — Publicaciones LinkedIn (columnas)

Igual que el de arriba, cambiando `Boton / URL destino` por
`Link imagen (URL publica)` — LinkedIn necesita la URL pública de la imagen
para publicarla vía Make (módulo `LINKEDIN SANTISOMARKETING`, ya existente
en la cuenta).

## Recordatorio mensual (ya montado y probado)

Escenario de Make **`NOVEDADES GBP - Recordatorio mensual de contenido`**
(id `9802497`, carpeta `GOOGLE BUSINESS`, **activo**). El día 1 de cada mes
manda un email a santisomarketing@gmail.com con:

- El link a la carpeta `BORRADORES PUBLICACION` (subir ahí fotos/videos nuevos).
- El link al Excel maestro de novedades.

Probado con un envío real el 13/09/2026 (operación real registrada en Make,
no simulada). Para replicarlo en un cliente, se duplica el escenario
cambiando el destinatario y los dos links por los de su propia carpeta.

## Piloto ya creado (Santiso Marketing)

- Carpeta [`NOVEDADES GOOGLE BUSINESS`](https://drive.google.com/drive/folders/1c7-0lQjYDQvQPH2KkCD1AfQNKMf6oZPi) con:
  - [Excel maestro](https://docs.google.com/spreadsheets/d/1EWkg1AxYC6kx_PSAdSSiVN5E7lxg1UkyTfcBI0Uw3oM/edit)
  - [BORRADORES PUBLICACION](https://drive.google.com/drive/folders/1RXA4eiwwt0n3w30jRDfNjClicbpLYCHG) (vacía, lista para usar)
  - Un post de ejemplo con video + copy real (a borrar o reemplazar)
- Carpeta [`PUBLICACIONES LINKEDIN`](https://drive.google.com/drive/folders/1t5qSBa4T56eG89uJAgHRr3249R_rqFuL) con:
  - [Excel maestro](https://docs.google.com/spreadsheets/d/1CY8eoGKUbFpdYiHYDFVMAJK4T3CvITmp7YlDnLoYH50/edit)
  - Un post de ejemplo con foto + copy real (a borrar o reemplazar)

## Formato visual de los Excel maestro (13/09/2026)

Los tres Sheets (Novedades GBP, Publicaciones LinkedIn, Inventario Ecokil)
tienen formato real aplicado vía API de Google Sheets, no solo texto plano:

- Encabezado con color de marca, negrita, texto blanco, fila congelada (no
  se pierde de vista al bajar) y filtro automático en cada columna.
- La columna **Estado** se colorea sola según el texto: verde para
  "Listo"/publicado, naranja/rojo para "Pendiente"/"Revisar", gris para
  "Ejemplo" o material sin post armado.
- Columnas auto-ajustadas al contenido (excepto las de texto largo, que se
  dejan con ancho fijo para no romper la vista).

Se hizo con el módulo `google-sheets:makeAPICall` de Make (mismo patrón que
el resto: `Make an API Call` cuando el módulo nativo no alcanza). Para
replicarlo en un Excel nuevo hace falta el `sheetId` numérico interno de la
pestaña (se obtiene con un `GET` a `spreadsheets/{id}`) y mandar el `body`
del `batchUpdate` como **texto JSON**, no como objeto — el módulo de Make
tiene un bug real: si el body se pasa como objeto, lo manda literalmente
como el texto `[object Object]` en vez de serializarlo.

## Notas honestas

- **Los posts de ejemplo son reales pero de relleno**: reutilizan un video y
  una foto que ya existían en `FRANCO/1-CONTENIDO`, con un copy escrito para
  esta prueba. Bórralos o reemplázalos antes de que se acumule contenido real
  encima — están claramente marcados como "EJEMPLO" en el nombre y en el Excel.
- **Enlace público de las fotos/videos:** para que Google Business o LinkedIn
  puedan leer un archivo de Drive al publicar, ese archivo necesita permiso
  "cualquiera con el enlace". La herramienta de Drive que tengo solo comparte
  a una persona/email concreto, no en modo público — así que, por ahora, hay
  que activar ese permiso a mano en Drive (clic derecho → Compartir → Cualquiera
  con el enlace) antes de que un escenario de Make use esa foto/video. Pendiente
  confirmar si el conector de Google Drive de Make lo resuelve mejor.
- **Replicar a otra marca:** copiar esta misma estructura (dos carpetas +
  sus Excel maestros) dentro de la carpeta de esa marca, y duplicar el
  escenario de recordatorio mensual cambiando los links. Ver Fase 4 de
  [`GOOGLE_BUSINESS_PLAN.md`](./GOOGLE_BUSINESS_PLAN.md).
