# NAP-W: presencia en directorios locales

Sesión 11 de [`AEO_PLAN.md`](./AEO_PLAN.md). NAP-W = Name, Address, Phone, Website — los datos
básicos que un negocio debería tener consistentes en todos los directorios locales donde
aparece. Usa la misma sesión de Google que `maps-scan.mjs`/`serp-scan.mjs`.

## ⚠️ Alcance real (importante)

Este script comprueba **si el negocio aparece listado** en cada directorio (vía
`site:<directorio> "<nombre>"` en Google), no compara nombre/dirección/teléfono/web campo a
campo entre directorios. Hacer esa comparación exacta necesitaría parsear el HTML propio de cada
directorio (todos distintos), y no es algo que se pueda hacer de forma confiable para una lista
larga de directorios sin mantenimiento constante — así que **no está incluido**, para no mostrar
una "consistencia" que en realidad no se verificó. Lo que sí te da: en qué directorios estás, en
cuáles no, y el link a cada ficha encontrada para que confirmes los datos a mano.

## Instalación y sesión

```bash
npm install
npx playwright install chromium
npm run maps-login
```

## Uso

```bash
npm run napw-check -- --name="Cliente S.L." --out=napw-cliente --debug
```

| Flag | Qué hace | Default |
|---|---|---|
| `--name=TEXTO` | Nombre del negocio a buscar | — (obligatorio) |
| `--directories=fichero` | Lista propia de dominios (uno por línea), reemplaza la lista por defecto | ver más abajo |
| `--out=nombre` | Base del fichero de salida | `napw-check` |
| `--delay=MS` | Pausa entre directorios | 3000 |
| `--headless` | Sin ventana visible | desactivado |
| `--debug` | Muestra cada directorio en consola | — |

Salida: `directorio, encontrado, url, totalResultados`.

## Directorios por defecto

`paginasamarillas.es`, `qdq.com`, `cylex.es`, `europages.es`, `yelp.es`, `foursquare.com`,
`trustpilot.com`, `guiaempresas.universia.es`, `11870.com`, `hotfrog.es`.

Si conocés otro directorio relevante para tu sector/zona, armá un fichero de texto con un dominio
por línea y pasalo con `--directories=fichero.txt` (mismo espíritu que "si conoces algún
directorio local más, añadilo" de otras herramientas del mercado).

## Cómo leer el resultado

- `encontrado=true` + `url`: abrí ese link y confirmá a mano que el nombre, dirección, teléfono y
  web coinciden con los datos reales del negocio — esa verificación de consistencia es manual.
- `encontrado=false`: el negocio no aparece indexado en Google dentro de ese directorio con ese
  nombre exacto — puede ser que no esté dado de alta, o que esté con un nombre distinto (probá
  variantes si el nombre real difiere del que buscaste).
- La lista de "no encontrado" que imprime la consola al final es tu lista de altas a priorizar.
