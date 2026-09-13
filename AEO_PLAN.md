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

### Sesión 4 — Seguimiento de menciones/citas en motores de IA ✅ hecho (falta probar con API keys reales)

Automatiza la fase 9. Implementado en
[`AEO-core/ai-mentions.mjs`](https://github.com/santisomarketing-bot/AEO-core/blob/main/ai-mentions.mjs)
— ver [`AI_MENTIONS.md`](https://github.com/santisomarketing-bot/AEO-core/blob/main/AI_MENTIONS.md).
La lógica de detección de mención/sentimiento/citas está probada con respuestas sintéticas; falta
correrlo con API keys reales de al menos un motor (no hay ninguna cargada en esta sesión).

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

### Sesión 5 — Informe mensual automatizado

Automatiza la fase 10, cierra el ciclo con Jira/Sheets ya existentes.

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

### Sesión 7 — Empaquetado y decisión de producto

- Con las 6 piezas funcionando, decidir: ¿se queda como herramienta interna de la agencia, se
  ofrece como servicio con precio propio a clientes, o ambas?
- Si se ofrece como servicio: definir tiers (auditoría suelta / auditoría + edge + tracking
  mensual), y cómo se vende (landing, propuesta comercial).
- Entregable: `AEO_PRODUCTO.md` con la decisión y next steps si aplica.

### Sesión 8 — Extracción masiva de datos de Google Maps (Local SEO) ✅ hecho (falta validar en vivo)

Añadido a petición: automatizar "en masa" lo que hoy se hace ficha a ficha a mano en Google Maps
(sacar CID, Place ID, NAP+, simular geolocalización con UULE para ver el local pack por zona,
exportar a CSV). Es una pista independiente del resto del plan (no depende de las sesiones de
AEO), útil para el trabajo de Local SEO/GBP que ya hacéis. Implementado en
[`maps-scan.mjs`](./maps-scan.mjs) — ver [`MAPS_SCAN.md`](./MAPS_SCAN.md). La extracción de
CID/Place ID desde la URL está probada (es estructura de URL, no de DOM); la lectura de NAP+ y la
detección del local pack dependen del HTML actual de Google y **no se pudieron probar en vivo**
en esta sesión (sin sesión de Google ni acceso de red a Maps desde acá) — antes de usarlo en
serio, correr `--debug` sobre 2-3 casos conocidos y ajustar selectores si hace falta.

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
- `MAPS_SCAN.md` con instalación, uso y las dos limitaciones de arriba.
- Criterio de éxito: correr `maps-scan.mjs` sobre 5-10 negocios/ubicaciones de un cliente real y
  obtener un CSV con CID + Place ID + NAP+ + (si aplica) posición en el grid, sin tocar Maps a
  mano.

---

## Orden y dependencias

```
0 (hecho) → 1 → 2 → 3
                 └─→ 4 → 5
                 └─→ 6
                          → 7

8 (independiente, se puede hacer en cualquier momento)
```

Sesiones 3, 4 y 6 dependen de tener la Sesión 2 (generador de contenido) lista, pero son
independientes entre sí — se pueden hacer en el orden que convenga según qué cliente piloto se
use primero. La Sesión 5 necesita 1 y 4. La 7 es la última, cuando el resto esté validado con al
menos un cliente real. La Sesión 8 no depende de nada del resto del plan — es una pista aparte de
Local SEO que se puede abordar en paralelo o incluso primero.
