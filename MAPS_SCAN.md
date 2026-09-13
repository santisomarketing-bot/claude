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

## 3) Modo `grid` — posición en el local pack por ciudad/barrio

`grid.txt`, una entrada por línea: `termino;ciudad;marca_objetivo` (la marca objetivo es
opcional — sin ella, solo lista lo que sale en el local pack):

```
agencia de marketing;Barcelona;Santiso Marketing
agencia de marketing;Madrid;Santiso Marketing
```

```bash
npm run maps-scan -- --mode=grid --input=grid.txt --out=grid-cliente
```

Salida: `term, location, target, posicion, competidoresAntes, totalDetectados`. `posicion` es el
puesto de `target` en el local pack detectado para esa búsqueda simulada desde esa ubicación
(vía [UULE](https://www.foolvpn.me/blog/what-is-google-uule-parameter/), no hay API oficial para
esto). `competidoresAntes` son los nombres que salieron antes.

### Opciones comunes

| Flag | Qué hace | Def. |
|---|---|---|
| `--mode=extract\|grid` | Qué hacer | `extract` |
| `--input=fichero` | Lista de entradas (formato según el modo) | — (obligatorio) |
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
