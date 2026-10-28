// [EMAIL] Envío por Resend (HTTP). Sin RESEND_API_KEY no se envía nada y se devuelve {skipped:true} (entornos de prueba).
import { esc } from './util.js';
/** Envía un correo por Resend → { ok, id }; sin RESEND_API_KEY { ok:false, skipped:true }; si falla { ok:false, status | error }. */
export async function sendMail(env, { to, cc, subject, html, text, replyTo, attachments }, fetchImpl = fetch) {
  if (!env.RESEND_API_KEY) return { ok: false, skipped: true };
  const body = { from: env.ORDER_FROM || 'Torivac Web <pedidos@torivac.com>', to, subject, html, text };
  if (cc && cc.length) body.cc = cc; if (replyTo) body.reply_to = replyTo; if (attachments && attachments.length) body.attachments = attachments;
  try {
    const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, id: (await r.json()).id };
  } catch (e) { return { ok: false, error: String(e) }; }
}
/** Importe en euros con el formato del idioma (es, en, fr, de); «—» si no hay importe. */
const money = (n, lang = 'es') => (n == null ? '—' : new Intl.NumberFormat({ es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' }[lang] || 'es-ES', { style: 'currency', currency: 'EUR' }).format(n));
/** Correo de aviso de un pedido para el equipo → { html, text } con cliente, líneas, total y marca de precios de demostración. */
export function orderMail({ number, customer, priced, lang, demo }, items) {
  const rows = priced.lines.map((l) => `<tr><td style="font-family:monospace">${esc(l.ref)}</td><td>${esc(items[l.ref]?.n || '')}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${money(l.unit, lang)}</td><td style="text-align:right"><b>${money(l.total, lang)}</b></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Nuevo pedido ${esc(number)}${demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''}</h2>
<p><b>${esc(customer.name)}</b> ${customer.company ? '· ' + esc(customer.company) : ''}<br>${esc(customer.email)}${customer.phone ? ' · ' + esc(customer.phone) : ''}</p>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Ud.</th><th>Importe</th></tr>${rows}</table>
<p style="text-align:right;font-size:18px">Total (sin IVA): <b>${money(priced.total, lang)}</b>${priced.unpriced ? `<br><small>${priced.unpriced} línea(s) «A consultar» no incluidas en el total</small>` : ''}</p>
${customer.notes ? `<p><b>Notas:</b> ${esc(customer.notes)}</p>` : ''}<p style="color:#777;font-size:12px">Idioma del cliente: ${esc(lang)} · El PDF del presupuesto va adjunto.</p></div>`;
  const text = [`Nuevo pedido ${number}${demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''}`, `${customer.name} <${customer.email}> ${customer.phone || ''}`, '', ...priced.lines.map((l) => `${l.ref}\t${items[l.ref]?.n || ''}\tx${l.qty}\t${money(l.total, lang)}`), '', `Total (sin IVA): ${money(priced.total, lang)}`, customer.notes ? `\nNotas: ${customer.notes}` : ''].join('\n');
  return { html, text };
}
