// ============================================================================
//  schema.mjs
//  --------------------------------------------------------------------------
//  Forma canónica de un LEAD dentro del CRM, sea cual sea su origen
//  (Meta Ads, Google Ads o un formulario web). Los normalizadores de cada
//  fuente (lib/sources/*.mjs) construyen este mismo objeto con buildLead().
// ============================================================================

import { randomUUID } from "node:crypto";
import { buildSequenceState } from "./sequence.mjs";

export const SOURCES = ["meta", "google", "web"];

// Mismo vocabulario que el checklist de "Estado del lead" en las tareas de
// Jira (ver JIRA_TEMPLATES.md), para que el CRM y Jira hablen igual.
export const STATUSES = ["nuevo", "contactado", "respondio", "reunion", "presupuesto", "ganado", "perdido"];

export const STATUS_LABELS = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  respondio: "Respondió",
  reunion: "Reunión",
  presupuesto: "Presupuesto",
  ganado: "Ganado",
  perdido: "Perdido",
};

// Un lead "cerrado" es el único caso en que puede dejar de perseguirse: el
// recordatorio de leads abiertos (notify.mjs) se basa en esto para decidir
// qué sigue pendiente de cerrar.
export const TERMINAL_STATUSES = ["ganado", "perdido"];

function limpia(v) {
  if (v == null) return "";
  return String(v).trim();
}

// contact = { name?, email?, phone?, company? }
// campaign = { id?, name?, adId?, adName?, formId?, formName? }
// opts = { source, sourceId?, site?, contact?, campaign?, message?, fields?, raw? }
export function buildLead(opts) {
  if (!SOURCES.includes(opts.source)) throw new Error(`source inválido: ${opts.source}`);

  const contact = opts.contact || {};
  const receivedAt = new Date().toISOString();
  return {
    id: randomUUID(),
    source: opts.source,
    sourceId: opts.sourceId ? String(opts.sourceId) : null,
    site: opts.site || null,
    receivedAt,
    status: "nuevo",
    contact: {
      name: limpia(contact.name),
      email: limpia(contact.email).toLowerCase(),
      phone: limpia(contact.phone),
      company: limpia(contact.company),
    },
    campaign: opts.campaign || {},
    message: limpia(opts.message),
    fields: opts.fields || {},
    notes: [],
    // Secuencia de bienvenida (3 correos, ver sequence.mjs). Se calcula igual
    // para todos los leads; el envío en sí lo filtra sequenceRunner.mjs por
    // si el lead tiene email, y stepsDue() por si el contenido está listo.
    sequence: buildSequenceState(receivedAt),
    // Aviso inmediato al EQUIPO (no al lead) de que ha entrado este lead,
    // ver notify.mjs/notifyRunner.mjs. Independiente de si el lead tiene
    // email: el equipo debe enterarse igualmente.
    notified: { status: "pendiente", sentAt: null, error: null },
    raw: opts.raw ?? null,
  };
}

export function isValidStatus(status) {
  return STATUSES.includes(status);
}
