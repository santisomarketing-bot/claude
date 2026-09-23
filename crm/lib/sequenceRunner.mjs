// ============================================================================
//  sequenceRunner.mjs
//  --------------------------------------------------------------------------
//  Revisa los leads con pasos de la secuencia ya en fecha y manda el correo
//  correspondiente. Se llama desde server.mjs en dos momentos:
//    - justo después de crear un lead nuevo (para que la confirmación salga
//      al momento, sin esperar al siguiente barrido)
//    - periódicamente (setInterval), para los pasos con retraso (web/newsletter)
//
//  Sin transport (SMTP no configurado) no toca nada: los pasos se quedan
//  "pendiente" hasta que haya credenciales, no se pierden ni se marcan mal.
// ============================================================================

import { findStepDef, stepsDue } from "./sequence.mjs";
import { sendMail } from "./mailer.mjs";

// deps = { store, transport, agency, from, now? }
export async function runDueSequenceSteps({ store, transport, agency, from, now = Date.now() }) {
  const resultados = [];
  if (!transport) return resultados;

  const { items } = await store.listLeads({ limit: 1_000_000 });
  for (const lead of items) {
    if (!lead.contact?.email) continue;
    for (const step of stepsDue(lead.sequence, agency, now)) {
      const def = findStepDef(step.id);
      try {
        await sendMail(transport, {
          to: lead.contact.email,
          from,
          subject: def.asunto(lead, agency),
          html: def.html(lead, agency),
        });
        await store.updateSequenceStep(lead.id, step.id, { status: "enviado", sentAt: new Date(now).toISOString() });
        resultados.push({ leadId: lead.id, step: step.id, status: "enviado" });
      } catch (err) {
        await store.updateSequenceStep(lead.id, step.id, { status: "error", error: String(err.message || err) });
        resultados.push({ leadId: lead.id, step: step.id, status: "error", error: String(err.message || err) });
      }
    }
  }
  return resultados;
}
