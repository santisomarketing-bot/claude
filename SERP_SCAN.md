# Análisis de SERP de Google (AI Overview / Ads / Local Pack)

Sesión 9 de [`AEO_PLAN.md`](./AEO_PLAN.md). Analiza la página de resultados normal de Google
(no Maps): detecta si aparece un **AI Overview**, cuántos **Ads** hay, y si hay **Local Pack** (y
en qué posición aparece una marca, si se la das). Usa la misma sesión de Google que
[`maps-scan.mjs`](./maps-scan.mjs).

## ⚠️ Aviso importante

Igual que `maps-scan.mjs`: automatizar Google Search a escala roza sus Términos de Servicio. Usa
tu propia sesión y un ritmo lento para minimizar riesgo, pero el riesgo no es cero. Uso interno
de la agencia sobre sus propios clientes.

## Instalación y sesión

```bash
npm install
npx playwright install chromium
npm run maps-login
```

Usa la misma sesión guardada (`.chrome-profile-maps/`) que `maps-scan.mjs` — si ya iniciaste
sesión para ese script, no hace falta repetirlo.

## Uso

`terminos.txt`, una búsqueda por línea. `ubicación` y `marca_objetivo` son opcionales:

```
mejor agencia de marketing en barcelona
gimnasio en sevilla;Sevilla;Fitness Park
```

```bash
npm run serp-scan -- --input=terminos.txt --out=serp-cliente --debug
```

| Flag | Qué hace | Default |
|---|---|---|
| `--input=fichero` | Lista de búsquedas | — (obligatorio) |
| `--out=nombre` | Base del fichero de salida | `serp-scan` |
| `--delay=MS` | Pausa entre búsquedas (ritmo humano) | 3000 |
| `--debug` | Muestra el resultado de cada fila en consola | — |

Salida: `<out>.csv` / `.json` con `term, location, target, aiOverview, ads, localPack,
posicionLocalPack`.

## Cómo funciona por dentro (y sus límites)

- **AI Overview**: se detecta buscando frases de aviso legal que Google muestra junto al AI
  Overview ("La IA puede cometer errores...", etc.) en el texto completo de la página, en vez de
  un selector CSS — esas frases de disclosure tienden a ser más estables que las clases/atributos
  internos, pero igual pueden cambiar de redacción.
- **Ads**: cuenta las etiquetas de texto "Anuncio"/"Ad" que Google pone sobre cada resultado
  pagado — mismo razonamiento (es un disclosure, no un detalle de diseño).
- **Local Pack**: misma lectura del panel de resultados que el modo `grid` de `maps-scan.mjs`
  — depende del DOM actual, es la parte más frágil.

**Ninguna de las tres detecciones se pudo probar en vivo** contra Google real (sin sesión de
Google ni acceso de red desde donde se escribió este script) — probá primero con `--debug` sobre
2-3 búsquedas conocidas (una que sepas que tiene AI Overview, una con Ads, una con Local Pack) y
confirmá a mano que coincide con lo que ves en el navegador, antes de correrlo en serio.
