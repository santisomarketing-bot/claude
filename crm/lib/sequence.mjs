// ============================================================================
//  sequence.mjs
//  --------------------------------------------------------------------------
//  Secuencia de bienvenida: 3 correos automáticos que se disparan cuando
//  entra un lead nuevo (de cualquier fuente), espaciados en el tiempo:
//
//    1) confirmacion — inmediato: confirma que hemos recibido su solicitud.
//    2) web          — +1 día: invita a conocer la web.
//    3) newsletter   — +4 días: comparte la newsletter/contenido reciente.
//
//  El contenido se genera en el momento de ENVIAR (no al crear el lead), así
//  que si cambias AGENCY_WEBSITE_URL/AGENCY_NEWSLETTER_URL en marcha, el
//  correo que todavía esté pendiente sale ya con el dato nuevo.
//
//  Tiempos y textos se editan aquí sin miedo — es el único sitio que hace
//  falta tocar para ajustar la secuencia. Si un paso necesita un dato que
//  aún no está configurado (p. ej. la web del paso 2), isReady() lo detecta
//  y el paso se queda "pendiente" en vez de mandarse a medias.
// ============================================================================

const DIA_EN_MINUTOS = 60 * 24;

function saludo(lead) {
  const primerNombre = (lead?.contact?.name || "").trim().split(/\s+/)[0];
  return primerNombre ? `Hola ${primerNombre},` : "Hola,";
}

export const SEQUENCE_STEPS = [
  {
    id: "confirmacion",
    label: "Confirmación de recepción",
    delayMinutes: 0,
    isReady: () => true,
    asunto: (lead, agency) => `Hemos recibido tu solicitud — ${agency.name}`,
    html: (lead, agency) => `
      <p>${saludo(lead)}</p>
      <p>Gracias por ponerte en contacto con <strong>${agency.name}</strong>. Hemos recibido tu
      solicitud correctamente y en breve te contactamos para seguir hablando.</p>
      <p>Un saludo,<br>${agency.senderName}</p>
    `.trim(),
  },
  {
    id: "web",
    label: "Invitación a la web",
    delayMinutes: 1 * DIA_EN_MINUTOS,
    isReady: (agency) => Boolean(agency.websiteUrl),
    asunto: (lead, agency) => `Echa un vistazo a lo que hacemos en ${agency.name}`,
    html: (lead, agency) => `
      <p>${saludo(lead)}</p>
      <p>Mientras seguimos en contacto, te dejamos nuestra web para que veas el tipo de
      trabajo que hacemos: <a href="${agency.websiteUrl}">${agency.websiteUrl}</a>.</p>
      <p>Un saludo,<br>${agency.senderName}</p>
    `.trim(),
  },
  {
    id: "newsletter",
    label: "Newsletter",
    delayMinutes: 4 * DIA_EN_MINUTOS,
    isReady: (agency) => Boolean(agency.newsletterUrl),
    asunto: (lead, agency) => `Algo de lectura: nuestra newsletter — ${agency.name}`,
    html: (lead, agency) => `
      <p>${saludo(lead)}</p>
      <p>Te compartimos nuestra newsletter con las últimas novedades, por si te interesa
      echarle un ojo: <a href="${agency.newsletterUrl}">${agency.newsletterUrl}</a>.</p>
      <p>Un saludo,<br>${agency.senderName}</p>
    `.trim(),
  },
];

export function findStepDef(id) {
  return SEQUENCE_STEPS.find((s) => s.id === id) || null;
}

// Se llama al crear el lead (buildLead en schema.mjs): calcula cuándo toca
// cada paso a partir de la hora de entrada del lead.
export function buildSequenceState(receivedAtISO) {
  const base = new Date(receivedAtISO).getTime();
  return SEQUENCE_STEPS.map((step) => ({
    id: step.id,
    scheduledFor: new Date(base + step.delayMinutes * 60000).toISOString(),
    sentAt: null,
    status: "pendiente", // pendiente | enviado | omitido | cancelado | error
  }));
}

// Pasos de un lead que ya tocan (fecha cumplida, con contenido listo) y
// siguen pendientes. agency = config.agency (name/websiteUrl/newsletterUrl/senderName).
export function stepsDue(sequence, agency, now = Date.now()) {
  if (!Array.isArray(sequence)) return [];
  return sequence.filter((s) => {
    if (s.status !== "pendiente") return false;
    if (new Date(s.scheduledFor).getTime() > now) return false;
    const def = findStepDef(s.id);
    return Boolean(def && def.isReady(agency));
  });
}

// ---- Autotest: node crm/lib/sequence.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = await import("node:assert/strict");
  const recibido = "2026-01-01T10:00:00.000Z";
  const seq = buildSequenceState(recibido);
  assert.default.equal(seq.length, 3);
  assert.default.equal(seq[0].scheduledFor, recibido); // confirmación: inmediata
  assert.default.equal(seq[1].scheduledFor, "2026-01-02T10:00:00.000Z"); // +1 día
  assert.default.equal(seq[2].scheduledFor, "2026-01-05T10:00:00.000Z"); // +4 días
  assert.default.ok(seq.every((s) => s.status === "pendiente" && s.sentAt === null));
  console.log("buildSequenceState: ok");

  const agencySinDatos = { name: "Test", senderName: "Equipo Test", websiteUrl: "", newsletterUrl: "" };
  const ahora = new Date(recibido).getTime() + 10 * DIA_EN_MINUTOS * 60000; // muy por delante de los 3 pasos
  const due1 = stepsDue(seq, agencySinDatos, ahora);
  console.log("solo confirmación lista sin web/newsletter configuradas:", due1.length === 1 && due1[0].id === "confirmacion");

  const agencyCompleta = { ...agencySinDatos, websiteUrl: "https://ejemplo.com", newsletterUrl: "https://ejemplo.com/newsletter" };
  const due2 = stepsDue(seq, agencyCompleta, ahora);
  console.log("los 3 pasos listos con toda la config:", due2.length === 3);

  const lead = { contact: { name: "Ana López" } };
  console.log("asunto confirmación:", SEQUENCE_STEPS[0].asunto(lead, agencyCompleta).includes("Test"));
  console.log("saludo con nombre:", SEQUENCE_STEPS[0].html(lead, agencyCompleta).includes("Hola Ana,"));
}
