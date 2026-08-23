# Plantillas de tareas de Jira para leads

Para que cada lead de LinkedIn que se convierta en tarea de Jira salga **completo y
consistente**. Una plantilla **base** + **variantes por categoría** (marketing, web,
SEO, GEO, ADS). Lógica versionada en [`jira-lead-templates.mjs`](./jira-lead-templates.mjs).

## Dónde caen los leads (ruteo)

Tu Jira (`santisomarketing.atlassian.net`) está organizado por **entrega a clientes
ya activos**: GI (Gestión integral, por cliente), WEBS (webs por marca), SM, etc.
**No hay un espacio de prospección/CRM.**

Decisión: los leads **no se mezclan** con la entrega. Van a un Epic contenedor
**"🎯 Leads / Prospección" dentro del proyecto SM**, cada lead como **Tarea** hija,
con etiquetas `lead` + `lead-<categoría>` + `linkedin`. Así el pipeline comercial
queda aislado del trabajo de clientes. Si más adelante quieres, se migra a un
proyecto propio sin tocar las plantillas (solo cambia el destino).

> **Paso pendiente para activar:** crear el Epic "🎯 Leads / Prospección" en SM y
> poner su key (p. ej. `SM-123`) en `LEADS_EPIC_KEY` dentro de `jira-lead-templates.mjs`.
> Hasta entonces las tareas se crean sin Epic padre (funciona igual, solo que sueltas).

## Qué trae cada tarea (plantilla base)

- **Título:** `[LEAD·<Categoría>] <Empresa/Nombre> — <qué pide>`
- **Descripción** (ADF, secciones fijas):
  1. 🎯 **Oportunidad** — qué pide + cita textual del post.
  2. 🔗 **Fuente** — enlace al post, fecha, antigüedad, canal.
  3. 👤 **Contacto** — nombre, empresa, ubicación, email/tel (a completar).
  4. 🧩 **Encaje Santiso** — el servicio que le vendemos (varía por categoría).
  5. ❓ **Cualificar** — 3 preguntas clave (varían por categoría).
  6. ✅ **Próxima acción** — el siguiente paso concreto.
  7. 📋 **Estado del lead** — checklist: Contactado → Respondió → Reunión →
     Presupuesto → Ganado/Perdido.
- **Etiquetas:** `lead`, `lead-<categoría>`, `linkedin`.
- **Prioridad por frescura:** ≤2 días → Highest · ≤30 → High · ≤120 → Medium · resto → Low.

## Variantes por categoría

| Categoría | Etiqueta | Encaje de servicio |
|---|---|---|
| `marketing` | Marketing / RRSS | Gestión de redes, contenidos, community management |
| `web` | Diseño / Desarrollo web | Web WordPress, landing o tienda online |
| `seo` | SEO | Auditoría, contenidos y posicionamiento en Google |
| `geo` | GEO (posicionamiento en IA) | Aparecer/ser citado en ChatGPT, Perplexity, AI Overviews |
| `ads` | ADS / Paid media | Campañas Google Ads y Meta Ads |

Cada variante cambia el **Encaje Santiso** y las **3 preguntas de cualificación**.
Edita todo en `CATEGORIAS` dentro de `jira-lead-templates.mjs`.

## Cómo se crea una tarea (cuando activemos)

```js
import { construyeTareaLead } from "./jira-lead-templates.mjs";
const fields = construyeTareaLead({
  autor: "Nicolas Lev", pide: "busca agencia de marketing",
  cita: "Busco agencia de marketing, necesito llevar mis redes",
  url: "https://linkedin.com/posts/...activity-7430305413562126336-...",
  fecha: "2026-02-19", dias: 5, categoria: "marketing",
});
// -> se pasa `fields` a createJiraIssue (cloudId + projectKey SM)
```

El payload sale con todo relleno; solo hay que conseguir el contacto (email/tel).

## Ajustar

- **Secciones / textos de servicio / preguntas:** `CATEGORIAS` y `construyeTareaLead`.
- **Reglas de prioridad:** `prioridadPorFrescura`.
- **Proyecto / tipo / Epic destino:** objeto `JIRA` al inicio del módulo.
