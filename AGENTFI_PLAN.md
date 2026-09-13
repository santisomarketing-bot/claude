# Plan por sesiones: funcionalidades tipo AgentFi (AEO/GEO automatizado)

Referencia: [agentfi.tech](https://agentfi.tech) / [docs.agentfi.tech](https://docs.agentfi.tech) —
"la capa SEO para la era de la búsqueda con IA". No confundir con el "AgentFi" de DeFi/cripto
(otro producto con el mismo nombre).

Para repos de GitHub, despliegue en Cloudflare y dónde entra Make, ver
[`AGENTFI_INFRA.md`](./AGENTFI_INFRA.md).

## Por qué esto encaja aquí

Ya hacéis GEO (Generative Engine Optimization) a mano con el flujo de
[`GEO_TEMPLATES.md`](./GEO_TEMPLATES.md): auditoría de visibilidad IA, schema.org, seguimiento de
citas, informe mensual — todo vía Jira + Excel. AgentFi automatiza exactamente esas piezas:

| Fase manual hoy (`GEO_TEMPLATES.md`) | Pieza de AgentFi que la automatiza |
|---|---|
| 1. Auditoría de visibilidad IA | AI Page Optimization (crawler + detección) |
| 6. Datos estructurados / Schema.org | AI Page Optimization (genera JSON-LD) |
| — (no existe hoy) | Edge Deployment (sirve la versión IA solo a bots) |
| 9. Seguimiento de menciones/citaciones | AI Engine Tracking (ChatGPT/Perplexity/Gemini/Claude) |
| 10. Informe mensual de visibilidad IA | Dashboard / reporte agregado |

El objetivo de este plan **no** es clonar AgentFi como producto SaaS público, sino construir
una herramienta interna (estilo `daily-leads.mjs` / `signals.mjs`) que la agencia use para dar
este servicio a clientes de forma automatizada, y que después decidamos si se empaqueta como
oferta propia.

## Cómo usar este plan

Cada sesión de abajo es el alcance de **una sesión de Claude Code** (o Claude Code Web): tiene
un objetivo cerrado, entregables concretos y depende como mucho de la sesión anterior. No hace
falta hacerlas todas seguidas — se puede parar entre sesiones y retomar. Al abrir una sesión
nueva, pega el número y nombre de la sesión (p. ej. "Sesión 2 del plan AgentFi") y este documento
le da el contexto.

---

### Sesión 0 — Descubrimiento y alcance (ya hecha en esta sesión)

- Investigar qué hace AgentFi realmente (hecho: ver tabla arriba).
- Decidir alcance: herramienta interna para dar servicio GEO a clientes de la agencia.
- Entregable: este documento (`AGENTFI_PLAN.md`).

### Sesión 1 — Auditor de visibilidad IA (script)

Automatiza la fase 1 de `GEO_TEMPLATES.md`.

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

### Sesión 2 — Generador de contenido "AI-ready"

Automatiza la fase 6 (schema.org) y complementa la 4 (crear contenido).

- Script/módulo que, a partir de una página o de un artículo ya escrito:
  - Genera JSON-LD (Article, FAQPage, Organization, Product según el tipo de página).
  - Genera un `llms.txt` de dominio (resumen del sitio + enlaces clave, formato estándar).
  - Sugiere una versión "limpia" del HTML (estructura semántica, sin depender de JS) para las
    páginas que peor puntuaron en la Sesión 1.
- Reutiliza convenciones de `webs-templates.mjs`/`ads-templates.mjs` (mismo estilo de módulo).
- Entregable: `ai-content.mjs` + `AI_CONTENT.md`.
- Criterio de éxito: para una URL del audit de la Sesión 1, generar el JSON-LD y el `llms.txt`
  listos para pegar/subir.

### Sesión 3 — Edge Deployment (Cloudflare Worker)

La pieza que no existe hoy en el flujo manual: servir la versión optimizada solo a bots de IA.

- Plantilla de Cloudflare Worker que:
  - Detecta user-agent de bots de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
    CCBot, etc.).
  - A esos bots les sirve el HTML generado en la Sesión 2 + `llms.txt` + JSON-LD inyectado.
  - A humanos y al resto de bots, pass-through al sitio original sin tocar nada.
- Carpeta `cloudflare-worker/` con el script del worker + `wrangler.toml` de ejemplo +
  instrucciones de despliegue por cliente (dominio propio de cada cliente, no compartido).
- `EDGE_DEPLOYMENT.md`: cómo desplegarlo por cliente, qué credenciales hacen falta (cuenta de
  Cloudflare del cliente o de la agencia, DNS proxied).
- Criterio de éxito: desplegado en un dominio de prueba, `curl -A "GPTBot" ...` devuelve la
  versión optimizada y un navegador normal ve el sitio intacto.

### Sesión 4 — Seguimiento de menciones/citas en motores de IA

Automatiza la fase 9.

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
- Entregable: `AGENTFI_PRODUCTO.md` con la decisión y next steps si aplica.

### Sesión 8 — Extracción masiva estilo Collac.io (Local SEO / Google Maps)

Añadido a petición: hacer "en masa" lo que [Collac](https://collac.io/google-chrome-extension/)
hace ficha a ficha (CID, Place ID, NAP+, simulación de geolocalización con UULE, export CSV).
Es una pista independiente del resto del plan (no depende de las sesiones de AgentFi), útil para
el trabajo de Local SEO/GBP que ya hacéis. Se puede hacer en cualquier momento, incluso antes que
las demás.

- **Sí es posible**: mismo patrón que `scan.mjs` (Playwright + tu propia sesión de navegador, sin
  API de pago). En vez de un clic manual por ficha en la extensión, un script recorre una lista de
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
menos un cliente real. La Sesión 8 no depende de nada del plan AgentFi — es una pista aparte de
Local SEO que se puede abordar en paralelo o incluso primero.
