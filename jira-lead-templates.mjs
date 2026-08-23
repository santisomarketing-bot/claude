// ============================================================================
//  jira-lead-templates.mjs
//  --------------------------------------------------------------------------
//  Plantillas de tarea de Jira para LEADS de LinkedIn.
//  Una plantilla BASE común + variantes por categoría (marketing/web/seo/geo/ads),
//  para que cada tarea que se cree salga completa y consistente.
//
//  construyeTareaLead(lead) devuelve el payload `fields` listo para createJiraIssue.
//
//  Instancia: santisomarketing.atlassian.net
//    cloudId  : 7c9edfbc-6762-4096-950f-806a10a91782
//    Proyecto : SM (id 10000)  ·  Tipo: Tarea (id 10001)
//  Los leads se cuelgan de un Epic contenedor "🎯 Leads / Prospección" para NO
//  mezclarlos con la entrega a clientes. Pon su key en LEADS_EPIC_KEY cuando exista.
// ============================================================================

export const JIRA = {
  cloudId: "7c9edfbc-6762-4096-950f-806a10a91782",
  projectKey: "SM",
  projectId: "10000",
  issueTypeId: "10001", // Tarea
  // Epic contenedor de leads. null = no se asigna padre (rellénalo al activar).
  LEADS_EPIC_KEY: null,
  // Prioridades del sitio (por id).
  PRIORITY: { HIGHEST: "1", HIGH: "2", MEDIUM: "3", LOW: "4", LOWEST: "5" },
};

// ---- Categorías: cada una añade su encaje de servicio y preguntas de cualificación ----
export const CATEGORIAS = {
  marketing: {
    etiqueta: "Marketing / RRSS",
    servicio: "Gestión de redes sociales, plan de contenidos y community management.",
    preguntas: [
      "¿Qué redes usa hoy y quién se las lleva?",
      "¿Objetivo: notoriedad, leads o ventas?",
      "¿Presupuesto mensual aproximado?",
    ],
  },
  web: {
    etiqueta: "Diseño / Desarrollo web",
    servicio: "Diseño y desarrollo web (WordPress), landing o tienda online.",
    preguntas: [
      "¿Web nueva, rediseño o tienda online?",
      "¿Tiene dominio/hosting o partimos de cero?",
      "¿Plazo y referencias que le gusten?",
    ],
  },
  seo: {
    etiqueta: "SEO",
    servicio: "Auditoría SEO, contenidos y posicionamiento en Google.",
    preguntas: [
      "¿Qué keywords/negocio quiere posicionar?",
      "¿Tiene web indexable y Search Console?",
      "¿Compite en local o nacional?",
    ],
  },
  geo: {
    etiqueta: "GEO (posicionamiento en IA)",
    servicio: "GEO: aparecer y ser citado en ChatGPT, Perplexity y Google AI Overviews.",
    preguntas: [
      "¿En qué prompts/temas quiere que le mencione la IA?",
      "¿Tiene contenido y presencia de marca que citar?",
      "¿Ya mide menciones en motores generativos?",
    ],
  },
  ads: {
    etiqueta: "ADS / Paid media",
    servicio: "Gestión de campañas Google Ads y Meta Ads (paid media).",
    preguntas: [
      "¿En qué plataformas quiere invertir (Google/Meta)?",
      "¿Presupuesto mensual y objetivo (leads/ventas/ROAS)?",
      "¿Tiene web/landing y medición de conversiones?",
    ],
  },
};

// Prioridad según frescura del post (días desde publicación).
export function prioridadPorFrescura(dias) {
  if (dias == null) return JIRA.PRIORITY.MEDIUM;
  if (dias <= 2) return JIRA.PRIORITY.HIGHEST; // recién publicado: llegar el primero
  if (dias <= 30) return JIRA.PRIORITY.HIGH;
  if (dias <= 120) return JIRA.PRIORITY.MEDIUM;
  return JIRA.PRIORITY.LOW;
}

// ---- Helpers ADF (Atlassian Document Format) ----
const t = (text, marks) => (marks ? { type: "text", text, marks } : { type: "text", text });
const linkNode = (text, href) => t(text, [{ type: "link", attrs: { href } }]);
const h = (level, text) => ({ type: "heading", attrs: { level }, content: [t(text)] });
const p = (...content) => ({ type: "paragraph", content: content.length ? content : [t("")] });
const bullets = (items) => ({
  type: "bulletList",
  content: items.map((it) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: Array.isArray(it) ? it : [t(it)] }],
  })),
});
const tasks = (items) => ({
  type: "taskList",
  attrs: { localId: "qualif" },
  content: items.map((txt, i) => ({
    type: "taskItem",
    attrs: { localId: `q${i}`, state: "TODO" },
    content: [t(txt)],
  })),
});

// ---- Plantilla ----
// lead = { autor, empresa?, pide, cita?, url, fecha, dias, categoria, ubicacion?, contacto? }
export function construyeTareaLead(lead) {
  const cat = CATEGORIAS[lead.categoria] || CATEGORIAS.marketing;
  const etiquetaCat = (lead.categoria || "marketing").toLowerCase();

  const summary = `[LEAD·${cat.etiqueta}] ${lead.empresa || lead.autor} — ${lead.pide}`.slice(0, 240);

  const description = {
    type: "doc",
    version: 1,
    content: [
      h(3, "🎯 Oportunidad"),
      p(t(lead.pide || "")),
      ...(lead.cita ? [{ type: "blockquote", content: [p(t(`“${lead.cita}”`))] }] : []),

      h(3, "🔗 Fuente"),
      bullets([
        [t("Post: "), linkNode(lead.url || "(sin enlace)", lead.url || "#")],
        `Publicado: ${lead.fecha || "?"} (${lead.dias != null ? lead.dias + " días" : "antigüedad ?"})`,
        "Canal: LinkedIn (post público)",
      ]),

      h(3, "👤 Contacto"),
      bullets([
        `Nombre: ${lead.autor || "?"}`,
        `Empresa: ${lead.empresa || "por confirmar"}`,
        `Ubicación: ${lead.ubicacion || "por confirmar"}`,
        `Email / teléfono: ${lead.contacto || "por conseguir"}`,
      ]),

      h(3, "🧩 Encaje Santiso"),
      p(t(cat.servicio)),

      h(3, "❓ Cualificar (preguntas)"),
      bullets(cat.preguntas),

      h(3, "✅ Próxima acción"),
      p(t("Enviar mensaje de contacto personalizado en LinkedIn y registrar respuesta.")),

      h(3, "📋 Estado del lead"),
      tasks(["Contactado", "Respondió", "Reunión agendada", "Presupuesto enviado", "Ganado / Perdido"]),
    ],
  };

  const fields = {
    project: { id: JIRA.projectId },
    issuetype: { id: JIRA.issueTypeId },
    summary,
    description,
    labels: ["lead", `lead-${etiquetaCat}`, "linkedin"],
    priority: { id: prioridadPorFrescura(lead.dias) },
  };
  if (JIRA.LEADS_EPIC_KEY) fields.parent = { key: JIRA.LEADS_EPIC_KEY };

  return fields;
}

// ---- Autotest: node jira-lead-templates.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const ejemplo = {
    autor: "Nicolas Lev",
    empresa: null,
    pide: "busca agencia de marketing (necesita ayuda con sus redes)",
    cita: "Busco agencia de marketing, necesito llevar mis redes y campañas",
    url: "https://es.linkedin.com/posts/nicolaslev_busco-agencia-de-marketing-necesito-activity-7430305413562126336-NJtu",
    fecha: "2026-02-19",
    dias: 183,
    categoria: "marketing",
  };
  const f = construyeTareaLead(ejemplo);
  const okReq = f.project && f.issuetype && f.summary && f.description?.type === "doc";
  console.log("summary:", f.summary);
  console.log("labels :", f.labels.join(", "), "| priority:", f.priority.id);
  console.log("secciones:", f.description.content.filter((n) => n.type === "heading").map((n) => n.content[0].text).join(" · "));
  console.log("required OK:", okReq, "| categorías:", Object.keys(CATEGORIAS).join(", "));
}
