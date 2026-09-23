// ============================================================================
//  notifyRunner.mjs
//  --------------------------------------------------------------------------
//  Dispara los avisos al equipo:
//    - notifyNewLeads(): el aviso inmediato de lead nuevo. Se llama justo
//      tras crear cada lead (server.mjs) y también en cada barrido, así que
//      un envío que falló (SMTP caído un rato) se reintenta solo.
//    - sendOpenLeadsDigest(): el recordatorio periódico de leads sin cerrar.
//      Solo lo llama el barrido periódico (no tiene sentido tras cada lead
//      nuevo, sería redundante con el aviso inmediato).
//
//  Sin transport/team configurados, ninguna de las dos hace nada — ver
//  mailer.mjs y config.mjs.
// ============================================================================

import { sendMail } from "./mailer.mjs";
import { buildNewLeadEmail, buildDigestEmail } from "./notify.mjs";
import { TERMINAL_STATUSES } from "./schema.mjs";

export async function notifyNewLeads({ store, transport, team, publicUrl, from }) {
  const resultados = [];
  if (!transport || !team) return resultados;

  const { items } = await store.listLeads({ limit: 1_000_000 });
  for (const lead of items) {
    const estado = lead.notified?.status || "pendiente";
    if (estado !== "pendiente") continue;
    try {
      const { subject, html } = buildNewLeadEmail(lead, { publicUrl });
      await sendMail(transport, { to: team, from, subject, html });
      await store.updateNotified(lead.id, { status: "enviado", sentAt: new Date().toISOString() });
      resultados.push({ leadId: lead.id, status: "enviado" });
    } catch (err) {
      await store.updateNotified(lead.id, { status: "error", error: String(err.message || err) });
      resultados.push({ leadId: lead.id, status: "error", error: String(err.message || err) });
    }
  }
  return resultados;
}

// No manda nada si no hay ningún lead abierto (nada que recordar).
export async function sendOpenLeadsDigest({ store, transport, team, publicUrl, from, now = Date.now() }) {
  if (!transport || !team) return null;
  const { items } = await store.listLeads({ limit: 1_000_000 });
  const abiertos = items.filter((l) => !TERMINAL_STATUSES.includes(l.status));
  if (!abiertos.length) return null;
  const { subject, html } = buildDigestEmail(abiertos, { publicUrl, now });
  await sendMail(transport, { to: team, from, subject, html });
  return { count: abiertos.length };
}
