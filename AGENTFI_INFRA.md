# Documento maestro: repos en GitHub + despliegue en Cloudflare (+ Make)

Complementa [`AGENTFI_PLAN.md`](./AGENTFI_PLAN.md) (qué se construye, sesión a sesión) con **dónde
vive el código y cómo sale a producción**. Léelo antes de arrancar la Sesión 1 del plan: crear los
repos y dejar Cloudflare/Make listos es trabajo de una tarde y evita reordenar código después.

## 1. Decisión: cuántos repos

Este repo (`santisomarketing-bot/claude`) es la caja de herramientas interna de la agencia
(scanner de LinkedIn, templates de Jira). Las piezas de AgentFi tienen dos necesidades que no
tiene el resto del repo: **CI/CD hacia Cloudflare** y, más adelante, ser algo que quizá se
empaquete como servicio propio (Sesión 7). Por eso van a repos nuevos, separados por ciclo de
vida de despliegue — no por prolijidad.

| Repo | Contenido (sesiones de `AGENTFI_PLAN.md`) | Por qué separado |
|---|---|---|
| `santisomarketing-bot/agentfi-core` | Sesión 1 (audit), 2 (generador contenido), 4 (mentions), 5 (informe mensual), 6 (integración WP) | Scripts Node de vida propia, se ejecutan por cliente/cron, sin despliegue web |
| `santisomarketing-bot/agentfi-edge` | Sesión 3 (Cloudflare Worker) | Necesita CI/CD propio hacia Cloudflare, un despliegue por dominio de cliente |
| `santisomarketing-bot/claude` (este mismo repo) | Sesión 8 (`maps-scan.mjs`, estilo Collac) | Es la misma familia que `scan.mjs` (Playwright + sesión propia) ya vive acá, no necesita Cloudflare |

Si preferís todo en un monorepo también funciona (mover `agentfi-core`/`agentfi-edge` a carpetas
de este repo) — la única pieza que **sí** exige aislar es `agentfi-edge`, porque su pipeline de
Cloudflare Actions corre en cada push y no querés que un commit de otra herramienta dispare un
deploy de Worker sin querer.

## 2. Estructura interna de cada repo

### `agentfi-core`

```
agentfi-core/
├── ai-audit.mjs          # Sesión 1
├── ai-content.mjs        # Sesión 2
├── ai-mentions.mjs       # Sesión 4
├── monthly-report.mjs    # Sesión 5
├── wp-integration.mjs    # Sesión 6
├── clients/              # config por cliente (dominio, prompts de marca, Jira epic…), no versionar datos sensibles
│   └── <cliente>.json
├── package.json
└── README.md
```

### `agentfi-edge`

```
agentfi-edge/
├── worker/
│   └── index.js           # detecta user-agent de bots IA, sirve versión optimizada
├── clients/
│   └── <cliente>/
│       └── wrangler.toml  # un wrangler.toml por cliente (su propia ruta/dominio)
├── .github/
│   └── workflows/
│       └── deploy.yml     # despliega con wrangler-action al hacer push
└── README.md
```

Un `wrangler.toml` por cliente (no uno global) para que cada despliegue sea independiente: si
rompés la config de un cliente, no tocás al resto.

## 3. GitHub — checklist

1. Crear los dos repos, **privados**, bajo `santisomarketing-bot`:
   - `agentfi-core`
   - `agentfi-edge`
2. Secrets a nivel repo (Settings → Secrets and variables → Actions):

   | Secret | Repo | Para qué |
   |---|---|---|
   | `CLOUDFLARE_API_TOKEN` | `agentfi-edge` | Deploy del Worker |
   | `CLOUDFLARE_ACCOUNT_ID` | `agentfi-edge` | Deploy del Worker |
   | `MAKE_WEBHOOK_URL` | `agentfi-core` | Disparar el escenario de Make al terminar audit/mentions/informe (ver punto 5) |
   | Claves de IA que uses en Sesión 4 (`OPENAI_API_KEY`, etc.) | `agentfi-core` | Consultar ChatGPT/Perplexity/Gemini/Claude en `ai-mentions.mjs` |

3. Workflow `agentfi-edge/.github/workflows/deploy.yml` (ejemplo mínimo, uno por cliente o con
   matrix sobre `clients/*`):

   ```yaml
   name: Deploy Worker
   on:
     push:
       branches: [main]
       paths: ["worker/**", "clients/**"]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: cloudflare/wrangler-action@v3
           with:
             apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
             accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
             workingDirectory: clients/<cliente>
   ```

4. `agentfi-core` no necesita Actions al inicio (se corre a mano o por cron en la máquina/servidor
   que uséis); si más adelante se automatiza, un cron de GitHub Actions (`schedule:`) alcanza.

## 4. Cloudflare — checklist

1. Usar la cuenta de Cloudflare de la agencia (crear una si no existe: cloudflare.com, plan Free
   alcanza para arrancar — Workers Free da 100.000 req/día).
2. Generar un **API Token** (no la Global API Key): `My Profile → API Tokens → Create Token`,
   permisos `Account.Workers Scripts: Edit` y `Zone.Workers Routes: Edit`. Ese token va al secret
   `CLOUDFLARE_API_TOKEN` del repo.
3. Anotar el **Account ID** (aparece en el dashboard, panel derecho de cualquier dominio) → secret
   `CLOUDFLARE_ACCOUNT_ID`.
4. **Requisito importante**: el Worker solo puede interceptar tráfico de un dominio que esté
   proxied por Cloudflare (nube naranja). Cada cliente piloto necesita su dominio en Cloudflare
   (aunque sea gratis) antes de la Sesión 3 — si el cliente usa otro DNS, hay que migrar el
   dominio o al menos delegar la zona.
5. Estrategia según nº de clientes:
   - **1-3 clientes piloto (ahora):** un Worker por cliente, cada uno con su `wrangler.toml` en
     `clients/<cliente>/`, ruta tipo `cliente.com/*`. Simple, sin fricción.
   - **Cuando escale a muchos clientes:** migrar a **Workers for Platforms** (dispatch namespace):
     un Worker "dispatcher" único en la cuenta de la agencia que enruta a un script por cliente
     subido dinámicamente. Evita crear un proyecto de Wrangler nuevo por cada alta de cliente.
     No hace falta resolverlo ahora — es una migración de la Sesión 3, no un bloqueo para
     empezar.
6. Antes de tocar un cliente real: desplegar un Worker "hola mundo" en un dominio de prueba propio
   de la agencia y confirmar con `curl -A "GPTBot" https://prueba.dominio.com` que la detección de
   bot funciona, tal como pide el criterio de éxito de la Sesión 3 del plan.

## 5. Dónde entra Make

Ya tenéis en Make las conexiones autorizadas (Gmail, Google Sheets, Jira, Slack/GBP…) que se
reutilizan en decenas de escenarios existentes. En vez de programar SMTP, API de Sheets o de Jira
dentro de `agentfi-core`, los scripts Node solo hacen **un POST a un webhook de Make** al terminar,
y el escenario de Make hace el resto con conexiones que ya existen — cero credenciales nuevas que
gestionar en el código.

Reemplaza estas partes del plan (para no programarlas a mano):

| Sesión del plan | Qué hace Make en vez del script |
|---|---|
| 5 — Informe mensual | Escenario recibe el JSON del informe por webhook → escribe fila en Sheets, sube el PDF a Drive del cliente, envía el email, comenta en la subtarea Jira "GEO \<cliente\> \<fecha\>" |
| 4 — Menciones IA | Escenario recibe webhook cuando aparece una mención nueva → alerta por email/Slack al momento (en vez de esperar al informe mensual) |
| 1 — Auditoría IA | Opcional: escenario que escribe cada resultado de audit en una fila del Excel "SEO 2025" ya usado en `GEO_TEMPLATES.md`, para no duplicar la hoja de cálculo |

Pasos:

1. Crear un escenario nuevo en Make por cada fila de la tabla (usar `hooks_create` para el webhook
   de entrada — ya tenéis el patrón con los `s...` scenarios existentes, seguí esa numeración/
   nomenclatura).
2. El script Node hace `fetch(process.env.MAKE_WEBHOOK_URL, { method: "POST", body: JSON.stringify(payload) })`
   al terminar. Nada más — la lógica de "a quién avisar", "en qué hoja escribir", "qué plantilla de
   email" vive en Make, no en el repo.
3. Documentar el `payload` esperado (forma del JSON) en el README de `agentfi-core` para que si
   cambia el escenario de Make, se sepa qué formato espera.

Esto es opcional por sesión: si un caso es más simple resolverlo en Node (por ejemplo, generar el
CSV de la Sesión 8), no hace falta forzar Make ahí.

## 6. Checklist de credenciales/variables a preparar

- [ ] `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (Cloudflare)
- [ ] `MAKE_WEBHOOK_URL` por escenario (uno para informe mensual, uno para alertas de menciones)
- [ ] API keys de los motores de IA que se puedan consultar por API para la Sesión 4 (revisar cuáles
      de ChatGPT/Perplexity/Gemini/Claude ofrecen API pública de consulta normal vs. solo vía su UI)
- [ ] Dominio de cada cliente piloto proxied en Cloudflare (nube naranja activa)
- [ ] Acceso de WP_Agent ya conectado al sitio del cliente piloto (Sesión 6)

## 7. Orden de ejecución recomendado

1. Crear `agentfi-core` y `agentfi-edge` (vacíos, con solo `README.md` y `package.json`/estructura
   de carpetas de arriba).
2. Dejar el token y account ID de Cloudflare cargados como secrets en `agentfi-edge`, y probar el
   "hola mundo" del punto 4.6 antes de escribir el Worker real de la Sesión 3.
3. Crear el webhook de Make para el informe mensual (punto 5) — es rápido y desbloquea que la
   Sesión 5 del plan solo tenga que hacer el `POST`, no programar el envío.
4. A partir de ahí, seguir el orden de `AGENTFI_PLAN.md` (Sesión 1 → 2 → 3/4/6 → 5 → 7, y Sesión 8
   en paralelo dentro de este mismo repo `claude`), moviendo cada script al repo que le
   corresponde según la tabla del punto 1 a medida que se completa.

## 8. Costes aproximados

- **GitHub:** repos privados, gratis.
- **Cloudflare Workers:** plan Free cubre 100.000 req/día por cuenta; si un cliente con mucho
  tráfico de bots lo supera, el plan Paid son ~$5/mes por 10M req.
- **Make:** no suma coste nuevo si se reutilizan las conexiones ya pagadas de la agencia — sí
  suma **operaciones** al plan mensual según cuántas veces se disparen los escenarios nuevos
  (informe mensual = bajo volumen; alertas de menciones, depende de cuántos clientes/prompts).

---

¿Querés que cree ya los dos repos vacíos (`agentfi-core`, `agentfi-edge`) en GitHub con esta
estructura, o preferís revisar antes los nombres/visibilidad?
