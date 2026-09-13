# Google Maps bulk scan (Local SEO)

Sesión 8 de [`AEO_PLAN.md`](./AEO_PLAN.md). Automatiza en masa lo que una extensión de Chrome de
Local SEO hace ficha a ficha: sacar CID/Place ID/NAP+ de una lista de negocios, o ver la posición
de una marca en el "local pack" simulando búsquedas desde distintas ciudades.

## ⚠️ Aviso importante

Igual que el [scanner de LinkedIn](./README.md): automatizar Google Maps/Search a escala roza sus
Términos de Servicio. Usa **tu propia sesión** de Google y un ritmo lento para minimizar riesgo,
pero el riesgo no es cero. Pensado para uso interno de la agencia sobre sus propios clientes, no
para scrapear terceros a gran escala.

## Instalación (una vez)

```bash
npm install
npx playwright install chromium
```

## 1) Iniciar sesión (una vez)

```bash
npm run maps-login
```

Se abre Chrome. Iniciá sesión con tu cuenta de Google a mano. Cuando la veas activa, volvé a la
terminal y pulsá **ENTER**. La sesión queda en `.chrome-profile-maps/` (en `.gitignore`, separada
de la de LinkedIn).

## 2) Modo `extract` — CID / Place ID / NAP+ de una lista de negocios

`negocios.txt`, una entrada por línea — nombre + ciudad, o URL de Maps directa:

```
Cliente S.L. Barcelona
https://www.google.com/maps/place/...
```

```bash
npm run maps-scan -- --mode=extract --input=negocios.txt --out=cliente-maps
```

Salida (`cliente-maps.csv` / `.json`): `query, url, placeFtid, cid, nombre, direccion, telefono,
web, rating`.

## 3) Modo `grid` — local pack **y orgánico** por ciudad/barrio

`grid.txt`, una entrada por línea: `termino;ciudad;marca_objetivo;dominio` (marca objetivo y
dominio son opcionales — sin marca objetivo, solo lista lo que sale en el local pack; sin
dominio, no busca posición orgánica):

```
agencia de marketing;Barcelona;Santiso Marketing;santisomarketing.com
agencia de marketing;Madrid;Santiso Marketing;santisomarketing.com
```

```bash
npm run maps-scan -- --mode=grid --input=grid.txt --out=grid-cliente
```

Salida: `term, location, target, posicion, competidoresAntes, totalDetectados, domain,
posicionOrganica`. `posicion` es el puesto de `target` en el **local pack** detectado para esa
búsqueda simulada desde esa ubicación (vía
[UULE](https://www.foolvpn.me/blog/what-is-google-uule-parameter/), no hay API oficial para
esto). `competidoresAntes` son los nombres que salieron antes en el local pack.
`posicionOrganica` es el puesto de `domain` en los resultados **orgánicos** (no de pago, no
local pack) de esa misma búsqueda — se lee de la misma página, sin request extra.

### Por qué esto (grid por ciudad) y no un heatmap geográfico fino de lo orgánico

Herramientas comerciales de SEO local muestran una cuadrícula fina (lat/lng, como la de
`--mode=heatmap`) también para lo orgánico. Eso necesita simular la búsqueda desde coordenadas
exactas, cosa que Google Maps permite de forma real y documentada (`@lat,lng,zoom`, lo que usa
`--mode=heatmap`) pero que la búsqueda **normal** de Google no — el mecanismo que existe (`uule`
con coordenadas en vez de nombre de lugar) no está documentado ni verificado de forma confiable,
así que no se implementó para no arriesgar mostrar datos que **parecen** reales pero no lo son.
El modo `grid` por ciudad/barrio con nombre es la versión honesta de esto: menos fina que un
heatmap de 81 puntos, pero cada dato que muestra se puede verificar a mano.

## 4) Modo `heatmap` — cuadrícula geográfica real alrededor de un negocio

A diferencia del modo `grid` (que compara ciudades con *nombre*, vía UULE), este modo arma una
cuadrícula real de puntos geográficos alrededor de una ubicación (lat/lng) y para cada uno mide
en qué posición aparece el negocio. Es el que alimenta el panel **Radar Local** (Artifact).

```bash
npm run maps-scan -- --mode=heatmap \
  --center=41.3874,2.1686 \
  --term="peluqueria en el centro" \
  --target="Cliente S.L." \
  --radius-km=5 \
  --size=5 \
  --out=radar-cliente
```

| Flag | Qué hace | Def. |
|---|---|---|
| `--center=LAT,LNG` | Centro de la cuadrícula (la ubicación del negocio) | — (obligatorio) |
| `--term=TEXTO` | Término de búsqueda | — (obligatorio) |
| `--target=TEXTO` | Nombre del negocio a ubicar en los resultados | — (opcional, sin él solo ves cuántos resultados hay) |
| `--radius-km=N` | Radio de la cuadrícula, en km | 5 |
| `--size=N` | Tamaño de la cuadrícula N×N (impar, para tener un punto central) | 5 |
| `--append` | En vez de pisar `<out>.csv/.json`, agrega esta corrida al histórico existente | — (desactivado) |
| `--headless` | Corre el navegador sin ventana visible (para rastreos programados desatendidos) | — (desactivado) |

Salida (`<out>.csv` / `.json`): `row, col, distancia_km, direccion, posicion, fecha, topNegocios,
lat, lng` — **el mismo formato que espera el botón "Cargar CSV real" del panel Radar Local**,
subilo tal cual. Con `--append`, cada fila lleva la fecha de esa corrida y el panel arma solo un
gráfico de evolución si detecta más de una fecha en el CSV. `topNegocios` es la lista completa de
negocios detectados en ese punto (hasta 20, separados por `|`, en el orden en que salen) — el
panel la usa para armar la tabla de "negocios detectados en la cuadrícula" (tu marca incluida, si
aparece).

**Ojo con el volumen**: cada punto de la cuadrícula es una navegación real a Google Maps. Una
cuadrícula de `5×5` son 25 búsquedas (~2 minutos con el ritmo por defecto); `9×9` son 81 (~7-8
minutos) y sube bastante el riesgo de que Google detecte el patrón. Empezá chico (`--size=5`) y
solo subilo si de verdad necesitás más resolución.

**`--headless` es más riesgoso**: un navegador sin ventana es más fácil de detectar como bot para
Google que uno normal con `--disable-blink-features=AutomationControlled` a la vista. Usalo solo
para rastreos programados desatendidos (ver [`SCHEDULED_SCANS.md`](./SCHEDULED_SCANS.md)) y con
volumen moderado — para uso manual, dejá la ventana visible (el default).

## 5) Modo `prospect` — negocios con poca presencia digital (leads de SEO local)

Sesión 10 de `AEO_PLAN.md`. Busca por categoría+ubicación, lista los negocios que salen y marca
como **prospecto** a los que tienen pocas reseñas — señal de que todavía no invirtieron en su
presencia digital, un lead razonable para ofrecer SEO local.

`categorias.txt`, una entrada por línea: `categoria;ubicacion`

```
gimnasio;Vigo
peluqueria;Vigo
```

```bash
npm run maps-scan -- --mode=prospect --input=categorias.txt --out=prospectos --min-reviews=15 --debug
```

| Flag | Qué hace | Def. |
|---|---|---|
| `--min-reviews=N` | Reseñas por debajo de las cuales se marca como prospecto | 15 |
| `--check-website=N` | A los N prospectos con menos reseñas, les abre la ficha para confirmar si tienen web (más lento) | 0 (no comprobar) |

Salida: `categoria, ubicacion, nombre, rating, resenas, tieneWeb` (`tieneWeb` es `si`/`no` solo
para los que se comprobaron con `--check-website`; el resto queda como `sin comprobar`).

**Esto es lectura del listado de resultados**, no entra a cada ficha (salvo con
`--check-website`) — es rápido pero el `rating`/`resenas` se parsean del texto de la tarjeta tal
como Google lo muestra en la lista, no son un dato 100% garantizado si Google cambia ese formato.

### Opciones comunes (extract / grid / prospect)

| Flag | Qué hace | Def. |
|---|---|---|
| `--mode=extract\|grid\|heatmap\|prospect` | Qué hacer | `extract` |
| `--input=fichero` | Lista de entradas (extract/grid/prospect, formato según el modo) | — (obligatorio salvo heatmap) |
| `--out=nombre` | Base del fichero de salida | `maps-scan` |
| `--delay=MS` | Pausa entre negocios/búsquedas (ritmo humano) | 3000 |
| `--debug` | Muestra el resultado de cada fila en consola | — |

## Cómo funciona por dentro

- **CID / Place ID**: Google mete el patrón `!1s0x<hex>:0x<hex>` en la URL de cualquier ficha de
  Maps — el primer hex es el "ftid" (place ID alternativo), el segundo convertido de hex a
  decimal es el CID. Es estructura de URL, no del diseño visual, así que es la parte más estable
  del script.
- **NAP+**: se lee de los `aria-label` de los botones de dirección/teléfono/web/rating de la
  ficha (locale es-ES). Esto **sí** depende del HTML actual de Google Maps — si Google cambia el
  diseño, hay que ajustar los selectores en `maps-scan.mjs` (mismo mantenimiento que tuvo el
  scanner de LinkedIn con los cambios de DOM).
- **Grid/UULE**: el parámetro `uule` para simular ubicación no es oficial ni documentado por
  Google — puede dejar de funcionar sin aviso. La detección del "local pack" en los resultados de
  búsqueda es la parte más frágil de todo el script.
- **Heatmap**: en vez de UULE, navega directo a `google.com/maps/search/<termino>/@lat,lng,zoom`
  — esa parte de la URL (coordenadas + zoom) es formato real y documentado de Google Maps, más
  sólido que el `uule`. Lo que sigue siendo frágil (igual que en `grid`) es leer la lista de
  resultados del panel izquierdo para encontrar la posición del negocio — depende del DOM actual.

**Antes de correr una lista grande**: probá primero con `--debug` sobre 2-3 negocios/búsquedas
conocidas y confirmá a mano (comparando con lo que ves vos en el navegador) que los datos que
saca son correctos. Si algo no coincide, son los selectores de `maps-scan.mjs` los que hay que
ajustar, no la lógica de CID/UULE.

## Alternativa oficial (no es el default de este script)

La **Google Places API** (Place Search + Place Details) da Place ID y datos de negocio sin rozar
los ToS, pero: es de pago por request, **no** da ranking real (Google no deja simular búsquedas
vía API, así que no sirve para el modo `grid`), y el Place ID que da no es exactamente el mismo
dato que el CID que expone la UI de Maps. Para auditorías puntuales de NAP+ sin riesgo, puede ser
mejor opción que este script — para tracking de ranking por ciudad, no hay alternativa oficial.
