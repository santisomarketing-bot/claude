// ============================================================================
//  notify.mjs
//  --------------------------------------------------------------------------
//  Avisos al EQUIPO (no al lead — eso es sequence.mjs). Dos correos:
//
//    1) Lead nuevo — inmediato, uno por lead, en cuanto entra.
//    2) Recordatorio de pendientes — periódico, lista TODOS los leads que
//       siguen sin cerrar (status distinto de ganado/perdido). Se repite en
//       cada barrido mientras quede al menos uno: es la red de seguridad
//       para que ningún lead se quede olvidado sin que alguien lo cierre.
//
//  Textos y umbrales de urgencia se editan aquí sin miedo.
// ============================================================================

const SOURCE_LABELS = { meta: "Meta Ads", google: "Google Ads", web: "Formulario web" };
const STATUS_LABELS = { nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", reunion: "Reunión", presupuesto: "Presupuesto", ganado: "Ganado", perdido: "Perdido" };

function nombreLead(lead) {
  return lead.contact?.name || lead.contact?.email || lead.contact?.phone || "(sin nombre)";
}

function enlace(lead, publicUrl) {
  return publicUrl ? `${publicUrl.replace(/\/+$/, "")}/?lead=${lead.id}` : null;
}

export function horasAbierto(lead, now = Date.now()) {
  return (now - new Date(lead.receivedAt).getTime()) / 3_600_000;
}

// Emoji de urgencia según cuánto lleva abierto, para que lo más atrasado
// destaque a simple vista en el recordatorio.
export function urgencia(horas) {
  if (horas >= 48) return "🔴";
  if (horas >= 24) return "🟠";
  if (horas >= 4) return "🟡";
  return "🟢";
}

export function buildNewLeadEmail(lead, { publicUrl } = {}) {
  const link = enlace(lead, publicUrl);
  const subject = `🆕 Lead nuevo (${SOURCE_LABELS[lead.source] || lead.source}) — ${nombreLead(lead)}`;
  const html = `
    <p>Ha entrado un lead nuevo por <strong>${SOURCE_LABELS[lead.source] || lead.source}</strong>${lead.site ? ` (${lead.site})` : ""}.</p>
    <ul>
      <li><strong>Nombre:</strong> ${nombreLead(lead)}</li>
      ${lead.contact?.email ? `<li><strong>Email:</strong> ${lead.contact.email}</li>` : ""}
      ${lead.contact?.phone ? `<li><strong>Teléfono:</strong> ${lead.contact.phone}</li>` : ""}
      ${lead.contact?.company ? `<li><strong>Empresa:</strong> ${lead.contact.company}</li>` : ""}
      ${lead.message ? `<li><strong>Mensaje:</strong> ${lead.message}</li>` : ""}
    </ul>
    ${link ? `<p><a href="${link}">Ver el lead en el CRM →</a></p>` : ""}
  `.trim();
  return { subject, html };
}

export function buildDigestEmail(leadsAbiertos, { publicUrl, now = Date.now() } = {}) {
  const ordenados = [...leadsAbiertos].sort((a, b) => horasAbierto(b, now) - horasAbierto(a, now));
  const filas = ordenados.map((lead) => {
    const horas = horasAbierto(lead, now);
    const link = enlace(lead, publicUrl);
    const nombre = link ? `<a href="${link}">${nombreLead(lead)}</a>` : nombreLead(lead);
    return `<li>${urgencia(horas)} ${nombre} — ${SOURCE_LABELS[lead.source] || lead.source} · ${STATUS_LABELS[lead.status] || lead.status} · abierto hace ${Math.round(horas)}h</li>`;
  });
  const subject = `📋 ${leadsAbiertos.length} lead${leadsAbiertos.length === 1 ? "" : "s"} sin cerrar — recordatorio`;
  const html = `
    <p>Estos leads siguen abiertos (ni ganados ni perdidos). Este aviso se repite
    mientras sigan así, para que ninguno se quede olvidado:</p>
    <ul>${filas.join("")}</ul>
  `.trim();
  return { subject, html };
}

// ---- Autotest: node crm/lib/notify.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (await import("node:assert/strict")).default;

  console.log("urgencia recién llegado:", urgencia(0) === "🟢");
  console.log("urgencia 5h:", urgencia(5) === "🟡");
  console.log("urgencia 30h:", urgencia(30) === "🟠");
  console.log("urgencia 60h:", urgencia(60) === "🔴");

  const lead = { id: "abc", source: "web", site: "webSantiso", contact: { name: "Ana López", email: "ana@ejemplo.com" }, message: "Quiero info", receivedAt: new Date().toISOString(), status: "nuevo" };
  const nuevo = buildNewLeadEmail(lead, { publicUrl: "https://crm.ejemplo.com" });
  assert.match(nuevo.subject, /Ana López/);
  assert.match(nuevo.html, /crm\.ejemplo\.com\/\?lead=abc/);
  console.log("aviso de lead nuevo: ok");

  const abierto1 = { ...lead, id: "a", status: "nuevo", receivedAt: new Date(Date.now() - 50 * 3_600_000).toISOString() };
  const abierto2 = { ...lead, id: "b", status: "contactado", receivedAt: new Date(Date.now() - 2 * 3_600_000).toISOString() };
  const digest = buildDigestEmail([abierto2, abierto1], {});
  assert.match(digest.subject, /^📋 2 leads/);
  console.log("digest ordena el más atrasado primero:", digest.html.indexOf("🔴") < digest.html.indexOf("🟢"));
}
