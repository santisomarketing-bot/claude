// ============================================================================
//  ads-templates.mjs
//  --------------------------------------------------------------------------
//  Plantilla de GOOGLE ADS como TAREA con subtareas (2 niveles, sin Epic).
//
//    Tarea:  GOOGLE ADS <marca> <fecha>
//      ├─ Sub tarea: Alta de la cuenta
//      ├─ Sub tarea: Configurar conversiones
//      ├─ Sub tarea: Campaña
//      ├─ Sub tarea: Grupo de anuncio
//      ├─ Sub tarea: Anuncios
//      └─ Sub tarea: (una por mes de gestión)  -> "los meses"
//
//  La Tarea puede ir suelta o colgar de la Marca/Epic de un cliente (parentKey).
//  Proyecto por defecto: SM (Santiso marketing). Cambia el objeto ADS si quieres otro.
//    cloudId: 7c9edfbc-6762-4096-950f-806a10a91782
//    SM (id 10000): Tarea 10001 · Subtarea 10002
// ============================================================================

export const ADS = {
  cloudId: "7c9edfbc-6762-4096-950f-806a10a91782",
  projectId: "10000",
  projectKey: "SM",
  TAREA: "10001",
  SUBTAREA: "10002",
};

// Subtareas de puesta en marcha (setup), en orden.
export const SETUP_ADS = ["Alta de la cuenta", "Configurar conversiones", "Campaña", "Grupo de anuncio", "Anuncios"];

function tagDe(marca, fecha) {
  return [marca, fecha].filter(Boolean).join(" ").trim();
}

// Normaliza `meses`: acepta un número (N -> ["Mes 1"..."Mes N"]) o un array de etiquetas.
function etiquetasMeses(meses) {
  if (Array.isArray(meses)) return meses;
  const n = Number.isFinite(meses) ? meses : 6; // por defecto 6 meses
  return Array.from({ length: n }, (_, i) => `Mes ${i + 1}`);
}

// opts = { marca, fecha, meses?: number|string[], parentKey?: string }
//   meses: cuántos meses de gestión (número) o etiquetas concretas (array).
//   parentKey: si la Tarea debe colgar de la Marca/Epic de un cliente.
export function construyeTareaGoogleAds(opts) {
  const { marca, fecha = "", meses = 6, parentKey = null } = opts;
  if (!marca) throw new Error("Falta 'marca' (nombre del cliente).");
  const tag = tagDe(marca, fecha);

  const tareaFields = {
    project: { id: ADS.projectId },
    issuetype: { id: ADS.TAREA },
    summary: `GOOGLE ADS ${tag}`.trim(),
  };
  if (parentKey) tareaFields.parent = { key: parentKey };
  const tarea = { fields: tareaFields };

  const secciones = [...SETUP_ADS, ...etiquetasMeses(meses).map((m) => `Gestión ${m}`)];
  const subtareas = secciones.map((sec) => ({
    seccion: sec,
    fields: {
      project: { id: ADS.projectId },
      issuetype: { id: ADS.SUBTAREA },
      summary: `${sec} ${tag}`.trim(),
      // parent (la Tarea) se rellena tras crear la tarea
    },
  }));

  return { meta: { marca, fecha, tag, totalSubtareas: subtareas.length }, tarea, subtareas };
}

export function renderPlan(plan) {
  const L = [`🟦 Tarea: ${plan.tarea.fields.summary}`];
  plan.subtareas.forEach((s, i) => {
    const last = i === plan.subtareas.length - 1;
    L.push(`     ${last ? "└─" : "├─"} 🟩 ${s.fields.summary}`);
  });
  return L.join("\n");
}

// ---- Autotest: node ads-templates.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("== 6 meses (por defecto) ==");
  console.log(renderPlan(construyeTareaGoogleAds({ marca: "CLIENTE DEMO", fecha: "AGO 26" })));
  console.log("\n== meses con etiquetas concretas ==");
  console.log(renderPlan(construyeTareaGoogleAds({ marca: "CLIENTE DEMO", fecha: "2026", meses: ["SEP 26", "OCT 26", "NOV 26"] })));
}
