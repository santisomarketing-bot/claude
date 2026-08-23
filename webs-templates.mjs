// ============================================================================
//  webs-templates.mjs
//  --------------------------------------------------------------------------
//  Plantilla de proyecto WEB para el proyecto WEBS de Jira, replicando la
//  estructura de 3 niveles que ya usas:
//
//    Marca (Epic)      -> el cliente / la web
//      └─ Tarea        -> "DISEÑO WEB[ KIT DIGITAL] <marca> <fecha>"
//           └─ Sub tarea (una por página/sección):  "<Sección> <marca> <fecha>"
//
//  Instancia: santisomarketing.atlassian.net
//    cloudId : 7c9edfbc-6762-4096-950f-806a10a91782
//    Proyecto: WEBS (id 10001)
//    Tipos   : Marca/Epic 10010 · Tarea 10003 · Sub tarea 10004
//
//  construyeProyectoWeb({marca, fecha, tipo, kitDigital}) devuelve un PLAN con los
//  payloads listos para createJiraIssue, en el orden de creación (epic -> tarea ->
//  subtareas), enlazando cada nivel con el `parent` del anterior.
// ============================================================================

export const WEBS = {
  cloudId: "7c9edfbc-6762-4096-950f-806a10a91782",
  projectId: "10001",
  projectKey: "WEBS",
  EPIC: "10010", // "Marca"
  TAREA: "10003",
  SUBTAREA: "10004",
};

// Páginas base (web corporativa). Orden = orden de creación de subtareas.
export const PAGINAS_CORP = [
  "HOME",
  "header",
  "footer",
  "Sobre nosotros",
  "Servicios",
  "Blog",
  "Plantilla entradas",
  "Contacto",
  "Páginas legales",
];

// Ecommerce: mismas base, pero en vez de "Servicios" van las páginas de tienda.
export const PAGINAS_ECOMMERCE = [
  "HOME",
  "header",
  "footer",
  "Sobre nosotros",
  "Tienda/Shop",
  "Ficha de producto",
  "Carrito/Checkout",
  "Blog",
  "Plantilla entradas",
  "Contacto",
  "Páginas legales",
];

// Subtarea extra solo para proyectos Kit Digital.
export const PAGINA_KIT_DIGITAL = "JUSTIFICACIÓN KIT DIGITAL";

// Devuelve la lista de secciones según tipo + kit digital.
export function paginasDe(tipo = "corporativa", kitDigital = false) {
  const base = tipo === "ecommerce" ? [...PAGINAS_ECOMMERCE] : [...PAGINAS_CORP];
  if (kitDigital) base.push(PAGINA_KIT_DIGITAL);
  return base;
}

// marca = "KICK BARCELONA", fecha = "MAYO 26"  ->  tag = "KICK BARCELONA MAYO 26"
function tagDe(marca, fecha) {
  return [marca, fecha].filter(Boolean).join(" ").trim();
}

// Construye el plan completo del proyecto web.
//   opts = { marca, fecha, tipo?: "corporativa"|"ecommerce", kitDigital?: boolean }
export function construyeProyectoWeb(opts) {
  const { marca, fecha = "", tipo = "corporativa", kitDigital = false } = opts;
  if (!marca) throw new Error("Falta 'marca' (nombre del cliente/web).");

  const tag = tagDe(marca, fecha);
  const secciones = paginasDe(tipo, kitDigital);

  const epic = {
    fields: {
      project: { id: WEBS.projectId },
      issuetype: { id: WEBS.EPIC },
      summary: marca,
    },
  };

  const tareaSummary = `DISEÑO WEB${kitDigital ? " KIT DIGITAL" : ""} ${tag}`.replace(/\s+/g, " ").trim();
  const tarea = {
    fields: {
      project: { id: WEBS.projectId },
      issuetype: { id: WEBS.TAREA },
      summary: tareaSummary,
      // parent (el Epic) se rellena tras crear el epic: fields.parent = { key: epicKey }
    },
  };

  const subtareas = secciones.map((sec) => ({
    seccion: sec,
    fields: {
      project: { id: WEBS.projectId },
      issuetype: { id: WEBS.SUBTAREA },
      summary: `${sec} ${tag}`.trim(),
      // parent (la Tarea) se rellena tras crear la tarea: fields.parent = { key: tareaKey }
    },
  }));

  return { meta: { marca, fecha, tipo, kitDigital, tag, totalSubtareas: subtareas.length }, epic, tarea, subtareas };
}

// Render de árbol para revisar el plan por consola.
export function renderPlan(plan) {
  const L = [];
  L.push(`🟪 Marca (Epic): ${plan.epic.fields.summary}`);
  L.push(`   └─ 🟦 Tarea: ${plan.tarea.fields.summary}`);
  plan.subtareas.forEach((s, i) => {
    const last = i === plan.subtareas.length - 1;
    L.push(`        ${last ? "└─" : "├─"} 🟩 Sub tarea: ${s.fields.summary}`);
  });
  return L.join("\n");
}

// ---- Autotest: node webs-templates.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("===== CORPORATIVA + KIT DIGITAL =====");
  console.log(renderPlan(construyeProyectoWeb({ marca: "KICK BARCELONA", fecha: "MAYO 26", kitDigital: true })));
  console.log("\n===== ECOMMERCE =====");
  console.log(renderPlan(construyeProyectoWeb({ marca: "Tienda Ejemplo", fecha: "AGO 26", tipo: "ecommerce" })));
}
