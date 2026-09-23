# Plan por sesiones: herramientas propias de AEO/GEO

AEO/GEO = optimizar y medir la visibilidad de un cliente en motores de IA (ChatGPT, Perplexity,
Gemini, Claude, AI Overviews de Google) en vez de (o además de) el buscador tradicional.

Punto de partida: existen productos de mercado que ya ofrecen esto como servicio (auditoría de
páginas para IA, generación de contenido optimizado, entrega distinta a bots de IA que a humanos,
y seguimiento de menciones/citas). Este plan no busca clonar ningún producto puntual, sino
construir el equivalente como herramienta interna de la agencia, con el mismo criterio que ya
usamos en este repo (`scan.mjs`, `daily-leads.mjs`): scripts propios, sin depender de licencias de
terceros.

Para repos de GitHub, despliegue en Cloudflare y dónde entra Make, ver
[`AEO_INFRA.md`](./AEO_INFRA.md).

## Por qué esto encaja aquí

Ya hacéis GEO (Generative Engine Optimization) a mano con el flujo de
[`GEO_TEMPLATES.md`](./GEO_TEMPLATES.md): auditoría de visibilidad IA, schema.org, seguimiento de
citas, informe mensual — todo vía Jira + Excel. Este plan automatiza exactamente esas piezas:

| Fase manual hoy (`GEO_TEMPLATES.md`) | Qué la automatiza |
|---|---|
| 1. Auditoría de visibilidad IA | Auditor de páginas (crawler + detección de señales IA) |
| 6. Datos estructurados / Schema.org | Generador de contenido AI-ready (genera JSON-LD) |
| — (no existe hoy) | Entrega en el edge (sirve la versión IA solo a bots) |
| 9. Seguimiento de menciones/citaciones | Tracking de menciones (ChatGPT/Perplexity/Gemini/Claude) |
| 10. Informe mensual de visibilidad IA | Dashboard / reporte agregado |

El objetivo **no** es vender esto como producto SaaS público desde el día uno, sino construir
una herramienta interna que la agencia use para dar este servicio a clientes de forma
automatizada, y después decidir si se empaqueta como oferta propia.

## Cómo usar este plan

Cada sesión de abajo es el alcance de **una sesión de Claude Code** (o Claude Code Web): tiene
un objetivo cerrado, entregables concretos y depende como mucho de la sesión anterior. No hace
falta hacerlas todas seguidas — se puede parar entre sesiones y retomar. Al abrir una sesión
nueva, pega el número y nombre de la sesión (p. ej. "Sesión 2 del plan AEO") y este documento le
da el contexto.

---

### Sesión 0 — Descubrimiento y alcance (ya hecha en esta sesión)

- Investigar cómo funcionan los productos de mercado de AEO/GEO (hecho: ver tabla arriba).
- Decidir alcance: herramienta interna para dar servicio GEO a clientes de la agencia.
- Entregable: este documento (`AEO_PLAN.md`).

### Sesión 1 — Auditor de visibilidad IA (script) ✅ hecho

Automatiza la fase 1 de `GEO_TEMPLATES.md`. Implementado en
[`AEO-core/ai-audit.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/ai-audit.mjs)
— ver [`AI_AUDIT.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/AI_AUDIT.md).

- Script `ai-audit.mjs` que, dado un dominio o lista de URLs:
  - Comprueba si existe `llms.txt`, `robots.txt` (y si bloquea GPTBot/ClaudeBot/PerplexityBot/
    Google-Extended), sitemap.
  - Por página: detecta `schema.org`/JSON-LD existente, jerarquía de headings, texto vs. JS
    renderizado (contenido visible sin ejecutar JS), meta description, tiempo de carga básico.
  - Da una puntuación de "AI-readiness" 0-100 por página y por dominio.
- Salida: `ia-audit.csv` / `.json` (mismo patrón que `leads.csv`/`leads.json` del scanner).
- `AI_AUDIT.md` explicando cómo correrlo, igual de estilo que `README.md`.
- Criterio de éxito: correr `npm run audit -- --url=cliente.com` sobre un cliente real y obtener
  un informe legible con qué falta (schema, llms.txt, headings, etc.).

**Automatizado sin PC**: corre solo cada semana vía GitHub Actions
([`ai-stats.yml`](https://github.com/santisomarketing-bot/AEO-core/blob/main/.github/workflows/ai-stats.yml)
en `AEO-core`, junto con la Sesión 4) y publica al dashboard de la Sesión 8
(pestaña "Visibilidad IA"). Validado en vivo con Why Not Barbershop.

### Sesión 2 — Generador de contenido "AI-ready" ✅ hecho

Automatiza la fase 6 (schema.org) y complementa la 4 (crear contenido). Implementado en
[`AEO-core/ai-content.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/ai-content.mjs)
— ver [`AI_CONTENT.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/AI_CONTENT.md).

- Script/módulo que, a partir de una página o de un artículo ya escrito:
  - Genera JSON-LD (Article, FAQPage, Organization, Product según el tipo de página).
  - Genera un `llms.txt` de dominio (resumen del sitio + enlaces clave, formato estándar).
  - Sugiere una versión "limpia" del HTML (estructura semántica, sin depender de JS) para las
    páginas que peor puntuaron en la Sesión 1.
- Reutiliza convenciones de `webs-templates.mjs`/`ads-templates.mjs` (mismo estilo de módulo).
- Entregable: `ai-content.mjs` + `AI_CONTENT.md`.
- Criterio de éxito: para una URL del audit de la Sesión 1, generar el JSON-LD y el `llms.txt`
  listos para pegar/subir.

### Sesión 3 — Entrega en el edge (Cloudflare Worker) ✅ validado (placeholder), falta contenido real

La pieza que no existe hoy en el flujo manual: servir la versión optimizada solo a bots de IA.
Implementado y **validado de punta a punta** en
[`AEO-edge`](https://github.com/santisomarketing-bot/AEO-edge): el Worker distingue `GPTBot` de un
navegador normal y hace pass-through real a un sitio de prueba (Cloudflare Pages conectado al
mismo repo) — probado con `curl -A "GPTBot"` vs `curl -A "Mozilla/5.0"` sobre `*.workers.dev`.
Sin Wrangler ni GitHub Actions: despliegue manual pegando el código en el dashboard (ver el
`README.md` del repo). Falta para cerrar la sesión: que la rama de bots sirva el HTML/JSON-LD real
que genera la Sesión 2 (hoy es un placeholder de texto) y probarlo sobre el dominio real de un
cliente piloto en vez del sitio de prueba.

- Plantilla de Cloudflare Worker que:
  - Detecta user-agent de bots de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
    CCBot, etc.).
  - A esos bots les sirve el HTML generado en la Sesión 2 + `llms.txt` + JSON-LD inyectado.
  - A humanos y al resto de bots, pass-through al sitio original sin tocar nada.
- `README.md` de `AEO-edge`: cómo desplegarlo por cliente (pegar el código en el dashboard, Route
  o Custom Domain sobre el dominio del cliente ya proxied por Cloudflare).
- Criterio de éxito: desplegado en un dominio de prueba, `curl -A "GPTBot" ...` devuelve la
  versión optimizada y un navegador normal ve el sitio intacto.

### Sesión 4 — Seguimiento de menciones/citas en motores de IA ✅ hecho y validado en vivo

Automatiza la fase 9. Implementado en
[`AEO-core/ai-mentions.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/ai-mentions.mjs)
— ver [`AI_MENTIONS.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/AI_MENTIONS.md).

**Automatizado sin PC, corriendo en vivo**: junto con la Sesión 1, corre cada semana vía GitHub
Actions ([`ai-stats.yml`](https://github.com/santisomarketing-bot/AEO-core/blob/main/.github/workflows/ai-stats.yml))
con las API keys como secrets del repo — a diferencia de Maps (Sesión 8), esto es solo HTTP y no
necesita ninguna PC prendida. Validado con Why Not Barbershop: los motores con API key configurada
devuelven datos reales (mención/posición/sentimiento/citas), los que no tienen key quedan
marcados como `sin_api_key` en vez de fallar. Publica a `docs/data/ai/`, leído por la pestaña
"Visibilidad IA" del dashboard de la Sesión 8 — de momento esa pestaña queda pausada a pedido del
cliente hasta terminar de configurar el resto de las API keys, aunque el mecanismo ya funciona.

- Script `ai-mentions.mjs` que, dado un cliente + lista de prompts de marca (p. ej. "mejor
  agencia de marketing en [ciudad]", "alternativas a [cliente]"):
  - Consulta las APIs de ChatGPT, Perplexity, Gemini y Claude (las que tengan API disponible;
    para las que no, documentar el límite y dejar hueco para consulta manual).
  - Detecta si la marca aparece, en qué posición, con qué sentimiento (positivo/neutro/
    negativo), y qué fuentes cita el modelo.
  - Guarda histórico en `mentions.json`/Sheet (mismo patrón que `leads.json`).
- `AI_MENTIONS.md` con cómo configurar las API keys y correr el seguimiento.
- Criterio de éxito: correr el script sobre un cliente real y obtener un CSV con citas
  detectadas por motor y fecha.

### Sesión 5 — Informe mensual automatizado ✅ hecho (falta probar con datos reales)

Automatiza la fase 10, cierra el ciclo con Jira/Sheets ya existentes. Implementado en
[`AEO-core/monthly-report.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/monthly-report.mjs)
— ver [`MONTHLY_REPORT.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/MONTHLY_REPORT.md).
Probado con datos sintéticos (audit + mentions, comparación mes a mes); falta correrlo con
datos reales de un cliente.

- Combina salidas de Sesión 1 (audit) + Sesión 4 (mentions) en un informe único por cliente
  (Markdown o HTML simple, exportable a PDF/Google Doc).
- Automatización tipo `daily-leads.mjs` pero mensual: genera el informe y lo manda por email o
  lo sube a la carpeta de Drive del cliente.
- Opcional: comentario automático en la tarea Jira "GEO <cliente> <fecha>" (subtarea 10) con el
  resumen y enlace al informe, usando los templates de `jira-lead-templates.mjs` como referencia.
- `MONTHLY_REPORT.md` con el detalle.
- Criterio de éxito: informe mensual generado end-to-end para un cliente piloto.

### Sesión 6 — Integración con WordPress (WP_Agent)

Para clientes en WordPress, cierra la fase 4-5 sin depender de subir manualmente el JSON-LD.

- Usar las tools de WP_Agent (`get_post_content`, `patch_post_content`, `update_post_seo`,
  `update_custom_css`) para:
  - Inyectar el JSON-LD generado en la Sesión 2 en los posts peor puntuados.
  - Actualizar SEO (título/meta) cuando el audit detecte huecos.
- Documentar en `WP_INTEGRATION.md` el flujo: audit → generar → aplicar en WP → re-auditar.
- Criterio de éxito: aplicado en un post real de un sitio conectado, y el audit de la Sesión 1
  sube de puntuación tras el cambio.

### Sesión 7 — Empaquetado y decisión de producto ✅ hecho

Ver [`AEO_PRODUCTO.md`](./AEO_PRODUCTO.md): recomienda un piloto interno de punta a punta antes
de vender esto como servicio (varias piezas solo están probadas con datos sintéticos, no en
vivo), y deja una propuesta de tiers para cuando el piloto esté validado.

### Sesión 8 — Extracción masiva de datos de Google Maps (Local SEO) ✅ hecho y validado en vivo

Añadido a petición: automatizar "en masa" lo que hoy se hace ficha a ficha a mano en Google Maps
(sacar CID, Place ID, NAP+, simular geolocalización con UULE para ver el local pack por zona,
exportar a CSV). Es una pista independiente del resto del plan (no depende de las sesiones de
AEO), útil para el trabajo de Local SEO/GBP que ya hacéis. Implementado en
[`maps-scan.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/maps-scan.mjs) —
ver [`MAPS_SCAN.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/MAPS_SCAN.md)
(en `AEO-core/geo/`). Suma un tercer modo,
`heatmap`, que genera una cuadrícula geográfica real (lat/lng) alrededor de un negocio — es el
que alimenta el panel Radar Local, en dos versiones:
- [Artifact de Claude](https://claude.ai/code/artifact/3e5bf41d-4fe6-4fd1-a9f1-3873b6de2649) (privado, con "Cargar CSV real" manual).
- **Dashboard en vivo público**: https://santisomarketing-bot.github.io/AEO-core/ (`AEO-core/docs/index.html`,
  GitHub Pages) — con mapa real (Leaflet + OpenStreetMap, sin el bloqueo de CSP de los Artifacts) y
  desplegable de marca (`docs/data/manifest.json`) que carga sola el CSV publicado de cada cliente.

**Validado en vivo con un cliente real (WHY NOT Barber Shop Paris)**: CID/Place ID, NAP+, extracción
de lat/lng, y heatmap 5×5 con 4 palabras clave — todo confirmado funcionando de punta a punta,
incluida la publicación automática. Dos bugs reales encontrados y corregidos en el camino (no eran
del usuario, eran del código):
1. **Detección de entry-point ESM rota en Windows** (`file://${process.argv[1]}` arma mal la URL
   con backslashes de Windows) — el script cargaba y salía sin hacer nada, sin error visible.
   Corregido con `pathToFileURL()`.
2. **`--out` escribía siempre en `geo/`** (usaba `__dirname` en vez del directorio desde donde se
   corre el comando) — por más que apuntaras a otra carpeta, el CSV terminaba en `geo/nombre.csv`.
   Corregido para que sea relativo al directorio de trabajo, como documenta `MAPS_SCAN.md`.

**Automatización semanal end-to-end** (ver [`SCHEDULED_SCANS.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/SCHEDULED_SCANS.md)
para el detalle): un único `.bat` por cliente (`rastreo-semanal-<cliente>.bat`) programado en el
Programador de tareas de Windows hace, sin intervención manual: 1) corre el heatmap real, 2) copia
el CSV a la carpeta de Drive del cliente (`geo CSVs/`), 3) copia el CSV a `docs/data/<cliente>.csv`
y hace `git push` — el dashboard de GitHub Pages sirve la versión nueva a los pocos minutos. Para
sumar un cliente nuevo: una línea en `docs/data/manifest.json` + su propio `.bat` (mismo patrón,
coordenadas y `--target` distintos). Runbook completo, con los errores reales ya resueltos:
[`ONBOARDING_CLIENTE.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/ONBOARDING_CLIENTE.md).

**Estado real (22-23/09/2026)**: 4 sucursales de Why Not en producción con datos reales — Paris,
Gràcia, Balmes y Senillosa, todas visibles en el dashboard. Detectado y corregido un problema real
de la tarea programada: la config por defecto de `schtasks` ("Solo interactivo" + detener en
batería) hizo que la tarea de Paris no se disparara sola la primera semana (la PC tenía que estar
desbloqueada y enchufada justo a esa hora) — la solución (ejecutar sin sesión iniciada + sin
restricción de batería) ya quedó documentada en `SCHEDULED_SCANS.md` y `ONBOARDING_CLIENTE.md`, y
aplicada en las tareas nuevas.

- **Sí es posible**: mismo patrón que `scan.mjs` (Playwright + tu propia sesión de navegador, sin
  API de pago). En vez de hacerlo a mano ficha por ficha, un script recorre una lista de
  búsquedas/negocios y lo hace todo de una tacada.
- Script `maps-scan.mjs` que, dada una lista de:
  - **Términos de búsqueda + ciudades/barrios** (grid de ubicaciones simuladas vía UULE, para ver
    si un cliente sale en el local pack por zona) → guarda posición, competidores que salen antes.
  - **Nombres de negocio o URLs de Maps** → extrae CID, Place ID, NAP+ (dirección, teléfono, web,
    categoría, rating, nº de reseñas) de cada uno.
  - Igual que `scan.mjs`: modo `--login` (una vez, guarda `.chrome-profile/`), luego
    `npm run maps-scan -- --input=negocios.csv` procesando la lista con ritmo humano (`--delay`).
- Salida: `maps-<fecha>.csv`/`.json` (mismo patrón que `leads.csv`/`leads.json`), pensado para
  pegar en el Excel de seguimiento local o alimentar la fase 1/9 de `GEO_TEMPLATES.md` cuando el
  cliente depende de Google Maps/GBP.
- **Aviso igual que en el scanner de LinkedIn**: automatizar Google Maps a escala roza los
  Términos de Servicio de Google. Usar tu propia sesión, ritmo lento, y volumen moderado (esto es
  para uso interno de la agencia sobre clientes propios, no para scrapear terceros a gran escala).
- Alternativa "oficial" a mencionar en `MAPS_SCAN.md` pero no como default: Google Places API
  (Place Search + Place Details) — sin riesgo de ToS, pero de pago por request, no da ranking real
  (Google no permite simular búsquedas vía API) y el Place ID no es exactamente el mismo dato que
  el CID que expone la UI de Maps.
- `MAPS_SCAN.md` (en `AEO-core/geo/`) con instalación, uso y las dos limitaciones de arriba.
- Criterio de éxito: correr `maps-scan.mjs` sobre 5-10 negocios/ubicaciones de un cliente real y
  obtener un CSV con CID + Place ID + NAP+ + (si aplica) posición en el grid, sin tocar Maps a
  mano.

### Sesión 9 — Análisis de SERP de Google (AI Overview / Ads / Local Pack) ✅ hecho

Añadido a petición: mientras la Sesión 8 mira Google Maps, esta mira la página de resultados
**normal** de Google — la que ve un usuario buscando desde cualquier localidad. Independiente del
resto del plan. Implementado en
[`serp-scan.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/serp-scan.mjs) —
ver [`SERP_SCAN.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/SERP_SCAN.md)
(en `AEO-core/geo/`).

- Mismo patrón que `maps-scan.mjs`/`scan.mjs`: Playwright + tu propia sesión de Google, sin API
  de pago.
- Por cada búsqueda detecta: si aparece **AI Overview** (por frases de disclosure, más estable
  que un selector visual), cuántos **Ads** hay, si hay **Local Pack** y en qué posición aparece
  una marca (opcional).
- Salida `term, location, target, aiOverview, ads, localPack, posicionLocalPack` — histórico
  simple por corrida (CSV/JSON), sin acumular como `ai-mentions.mjs`.
- **No se pudo probar en vivo** en esta sesión (sin sesión de Google ni acceso de red desde acá) —
  probar con `--debug` sobre búsquedas conocidas antes de usarlo en serio.

### Sesión 10 — Prospección de clientes de SEO local ✅ hecho

Añadido a petición: encontrar negocios con poca presencia digital (pocas reseñas, sin web) como
leads para vender SEO local — mismo espíritu que el scanner de LinkedIn, apuntando a Google Maps
en vez de posts. Implementado como `--mode=prospect` en
[`maps-scan.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/maps-scan.mjs) —
ver el punto 5 de
[`MAPS_SCAN.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/MAPS_SCAN.md).

- Busca por categoría+ubicación, lista los negocios y parsea rating/reseñas de cada tarjeta.
- Marca como prospecto a los que tienen menos reseñas que `--min-reviews` (def. 15).
- Opcional (`--check-website=N`): a los N prospectos con menos reseñas, les abre la ficha
  (reutiliza `extractOne` de la Sesión 8) para confirmar si tienen web — sin web + pocas reseñas
  es la señal más fuerte de que necesitan ayuda digital.
- **No se pudo probar en vivo** en esta sesión, mismo motivo que la 8 y la 9.

### Sesión 11 — NAP-W: presencia en directorios locales ✅ hecho

Añadido a petición (inspirado en el módulo de SEO local de una herramienta de mercado, ver
`MAPS_SCAN.md`/`NAPW_CHECK.md` para el detalle de qué se decidió no replicar y por qué).
Implementado en
[`napw-check.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/napw-check.mjs) —
ver [`NAPW_CHECK.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/geo/NAPW_CHECK.md)
(en `AEO-core/geo/`).

- Comprueba **presencia** (no consistencia campo a campo, ver limitación explicada en
  `NAPW_CHECK.md`) del negocio en una lista de directorios locales, vía `site:<directorio>
  "<nombre>"` en Google — reutiliza la misma lectura de resultados orgánicos que la Sesión 9.
- Salida: `directorio, encontrado, url, totalResultados` — los directorios sin presencia son la
  lista de altas a priorizar.
- **No se pudo probar en vivo** en esta sesión, mismo motivo que las Sesiones 8-10.

---

## Orden y dependencias

```
0 (hecho) → 1 → 2 → 3
                 └─→ 4 → 5
                 └─→ 6
                          → 7

8 ─┬─ 9 ─┬─ 11   (independientes del resto, se pueden hacer en cualquier momento)
   └─ 10 ┘
```

Sesiones 3, 4 y 6 dependen de tener la Sesión 2 (generador de contenido) lista, pero son
independientes entre sí — se pueden hacer en el orden que convenga según qué cliente piloto se
use primero. La Sesión 5 necesita 1 y 4. La 7 es la última, cuando el resto esté validado con al
menos un cliente real. Las Sesiones 8, 9, 10 y 11 no dependen de nada del resto del plan — son la
pista aparte de Local SEO/Google Search que se puede abordar en paralelo o incluso primero; la 10
reutiliza código de la 8 (`extractOne`) y la 11 reutiliza la lectura de resultados orgánicos de
la 9, pero ninguna depende de que la otra esté "terminada".
