// ============================================================================
//  geo-templates.mjs
//  --------------------------------------------------------------------------
//  Plantilla de proyecto GEO (Generative Engine Optimization: aparecer y ser
//  citado en ChatGPT, Perplexity, Gemini y Google AI Overviews).
//
//  Misma estructura de 3 niveles que WEBS:
//    Marca (Epic)  -> el cliente
//      └─ Tarea    -> "GEO <marca> <fecha>"
//           └─ Sub tarea (una por fase del servicio): "<Fase> <marca> <fecha>"
//
//  Proyecto destino sugerido: SEO (GEO es su evolución).
//    cloudId : 7c9edfbc-6762-4096-950f-806a10a91782
//    SEO (id 10004): Tarea 10021 · Subtarea 10022 · Epic 10023
// ============================================================================

export const GEO = {
  cloudId: "7c9edfbc-6762-4096-950f-806a10a91782",
  projectId: "10004",
  projectKey: "SEO",
  EPIC: "10023",
  TAREA: "10021",
  SUBTAREA: "10022",
};

// Recursos internos de Santiso (Google Drive) para las fases de contenido.
export const RECURSOS = {
  excelSeo2025: "https://docs.google.com/spreadsheets/d/1kH1y6cEPSUNehzNOYBJ5GcL_WWVT6MqRtTehbwAm5ok/edit",
  wordpress2025: "https://docs.google.com/spreadsheets/d/1CAMJXXGtcU2LZ8NhSmw1TBSanzCsd4mJkmrynAIyuSI/edit",
};

// Fases del servicio GEO (orden = orden de creación de subtareas).
// `desc` opcional -> va en la descripción de la subtarea (con enlaces a recursos).
export const FASES_GEO = [
  { seccion: "Auditoría de visibilidad IA" },
  { seccion: "Investigación de prompts objetivo" },
  { seccion: "Análisis de fuentes citadas" },
  {
    seccion: "Crear contenido",
    desc: `Crear el contenido optimizado para citación en IA usando el Excel «SEO 2025»: ${RECURSOS.excelSeo2025} — respuestas directas, FAQs y datos citables según los prompts/keywords objetivo.`,
  },
  {
    seccion: "Publicar contenido",
    desc: `Publicar el contenido en la web siguiendo «WORDPRESS 2025»: ${RECURSOS.wordpress2025} — maquetación en WordPress, SEO on-page y datos estructurados antes de publicar.`,
  },
  { seccion: "Datos estructurados / Schema.org" },
  { seccion: "Entidad de marca (Knowledge Panel / Wikidata)" },
  { seccion: "Presencia en fuentes de terceros (Reddit, reseñas, prensa)" },
  { seccion: "Seguimiento de menciones/citaciones" },
  { seccion: "Informe mensual de visibilidad IA" },
];

function tagDe(marca, fecha) {
  return [marca, fecha].filter(Boolean).join(" ").trim();
}

// opts = { marca, fecha }
export function construyeProyectoGeo(opts) {
  const { marca, fecha = "" } = opts;
  if (!marca) throw new Error("Falta 'marca' (nombre del cliente).");
  const tag = tagDe(marca, fecha);

  const epic = {
    fields: { project: { id: GEO.projectId }, issuetype: { id: GEO.EPIC }, summary: marca },
  };
  const tarea = {
    fields: {
      project: { id: GEO.projectId },
      issuetype: { id: GEO.TAREA },
      summary: `GEO ${tag}`.trim(),
      // parent (Epic) se rellena tras crear el epic
    },
  };
  const subtareas = FASES_GEO.map((f) => ({
    seccion: f.seccion,
    descripcion: f.desc || null,
    fields: {
      project: { id: GEO.projectId },
      issuetype: { id: GEO.SUBTAREA },
      summary: `${f.seccion} ${tag}`.trim(),
      // parent (Tarea) se rellena tras crear la tarea
    },
  }));

  return { meta: { marca, fecha, tag, totalSubtareas: subtareas.length }, epic, tarea, subtareas };
}

export function renderPlan(plan) {
  const L = [];
  L.push(`🟪 Marca (Epic): ${plan.epic.fields.summary}`);
  L.push(`   └─ 🟦 Tarea: ${plan.tarea.fields.summary}`);
  plan.subtareas.forEach((s, i) => {
    const last = i === plan.subtareas.length - 1;
    L.push(`        ${last ? "└─" : "├─"} 🟩 ${s.fields.summary}${s.descripcion ? "  📎" : ""}`);
  });
  return L.join("\n");
}

// ---- Autotest: node geo-templates.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const plan = construyeProyectoGeo({ marca: "CLIENTE DEMO", fecha: "AGO 26" });
  console.log(renderPlan(plan));
  console.log("\nSubtareas con recurso adjunto (📎):");
  plan.subtareas.filter((s) => s.descripcion).forEach((s) => console.log(` - ${s.seccion}: ${s.descripcion.slice(0, 70)}...`));
}
