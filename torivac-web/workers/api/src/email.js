// [EMAIL] Envío por Resend (HTTP). Sin RESEND_API_KEY no se envía nada y se devuelve {skipped:true} (entornos de prueba).
// Dos correos por pedido: el AVISO al equipo (con los datos del cliente y el PDF que fabricó su navegador) y la COPIA al cliente, que solo lleva texto fijo y datos valorados por el servidor.
import { esc } from './util.js';
/** Envía un correo por Resend → { ok, id }; sin RESEND_API_KEY { ok:false, skipped:true }; si falla { ok:false, status | error }. El asunto va siempre en una línea. */
export async function sendMail(env, { to, cc, subject, html, text, replyTo, attachments }, fetchImpl = fetch) {
  if (!env.RESEND_API_KEY) return { ok: false, skipped: true };
  const body = { from: env.ORDER_FROM || 'Torivac Web <pedidos@torivac.com>', to, subject: String(subject).replace(/[\r\n]+/g, ' '), html, text };
  if (cc && cc.length) body.cc = cc; if (replyTo) body.reply_to = replyTo; if (attachments && attachments.length) body.attachments = attachments;
  try {
    const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, id: (await r.json()).id };
  } catch (e) { return { ok: false, error: String(e) }; }
}
/** Importe en euros con el formato del idioma (es, en, fr, de); «—» si no hay importe. */
const money = (n, lang = 'es') => (n == null ? '—' : new Intl.NumberFormat({ es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' }[lang] || 'es-ES', { style: 'currency', currency: 'EUR' }).format(n));
/** Aviso del PDF para el equipo: el PDF lo genera el navegador del cliente y puede no coincidir con lo que valoró el servidor. */
export const PDF_NOTE = 'El PDF adjunto lo ha generado el navegador del cliente: el importe que vale es el calculado por el servidor (arriba)';
/** Correo de aviso de un pedido para el equipo → { html, text } con cliente, líneas, total, marca de precios de demostración y, si va PDF adjunto, el aviso de que el importe válido es el del servidor. */
export function orderMail({ number, customer, priced, lang, demo, hasPdf = false }, items) {
  const rows = priced.lines.map((l) => `<tr><td style="font-family:monospace">${esc(l.ref)}</td><td>${esc(items[l.ref]?.n || '')}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${money(l.unit, lang)}</td><td style="text-align:right"><b>${money(l.total, lang)}</b></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Nuevo pedido ${esc(number)}${demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''}</h2>
<p><b>${esc(customer.name)}</b> ${customer.company ? '· ' + esc(customer.company) : ''}<br>${esc(customer.email)}${customer.phone ? ' · ' + esc(customer.phone) : ''}</p>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Ud.</th><th>Importe</th></tr>${rows}</table>
<p style="text-align:right;font-size:18px">Total (sin IVA): <b>${money(priced.total, lang)}</b>${priced.unpriced ? `<br><small>${priced.unpriced} línea(s) «A consultar» no incluidas en el total</small>` : ''}</p>
${customer.notes ? `<p><b>Notas:</b> ${esc(customer.notes).replace(/\n/g, '<br>')}</p>` : ''}<p style="color:#777;font-size:12px">Idioma del cliente: ${esc(lang)}${hasPdf ? ` · El PDF del presupuesto va adjunto.</p><p style="color:#9c520f;font-size:12px"><b>${esc(PDF_NOTE)}.</b>` : ''}</p></div>`;
  const text = [`Nuevo pedido ${number}${demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''}`, `${customer.name} <${customer.email}> ${customer.phone || ''}`, '', ...priced.lines.map((l) => `${l.ref}\t${items[l.ref]?.n || ''}\tx${l.qty}\t${money(l.total, lang)}`), '', `Total (sin IVA): ${money(priced.total, lang)}`, customer.notes ? `\nNotas: ${customer.notes}` : '', hasPdf ? `\n${PDF_NOTE}.` : ''].join('\n');
  return { html, text };
}

// ───────────────────────────────────────── [COPIA] correo al cliente: SOLO texto fijo y datos del servidor
/** Textos fijos de la copia en cada idioma del pedido (es, en, fr, de). Nada de lo que escribió el visitante entra aquí. */
const COPY_TEXT = {
  es: { title: 'Copia de tu presupuesto', intro: 'Hemos recibido tu solicitud de presupuesto. Esta es la copia de lo que has pedido, con los importes calculados por Torivac.', ref: 'Ref.', item: 'Artículo', qty: 'Cant.', unit: 'Ud.', amount: 'Importe', total: 'Total (sin IVA)', ask: 'A consultar', unpriced: (n) => `${n} línea(s) «A consultar» no incluidas en el total`, ignore: 'Si no has pedido tú este presupuesto, ignora este mensaje.', demo: '(PRECIOS DE DEMOSTRACIÓN)' },
  en: { title: 'Copy of your quote', intro: 'We have received your quote request. This is a copy of what you asked for, with the amounts calculated by Torivac.', ref: 'Ref.', item: 'Item', qty: 'Qty', unit: 'Unit', amount: 'Amount', total: 'Total (excl. VAT)', ask: 'On request', unpriced: (n) => `${n} line(s) marked “On request” are not included in the total`, ignore: 'If you did not request this quote, please ignore this message.', demo: '(DEMONSTRATION PRICES)' },
  fr: { title: 'Copie de votre devis', intro: 'Nous avons bien reçu votre demande de devis. Voici une copie de ce que vous avez demandé, avec les montants calculés par Torivac.', ref: 'Réf.', item: 'Article', qty: 'Qté', unit: 'Prix unit.', amount: 'Montant', total: 'Total (hors TVA)', ask: 'Sur demande', unpriced: (n) => `${n} ligne(s) « Sur demande » non incluse(s) dans le total`, ignore: 'Si vous n’avez pas demandé ce devis, ignorez ce message.', demo: '(PRIX DE DÉMONSTRATION)' },
  de: { title: 'Kopie Ihres Angebots', intro: 'Wir haben Ihre Angebotsanfrage erhalten. Dies ist eine Kopie Ihrer Anfrage mit den von Torivac berechneten Beträgen.', ref: 'Ref.', item: 'Artikel', qty: 'Menge', unit: 'Einzelpreis', amount: 'Betrag', total: 'Gesamt (ohne MwSt.)', ask: 'Auf Anfrage', unpriced: (n) => `${n} Position(en) „Auf Anfrage“ sind in der Summe nicht enthalten`, ignore: 'Wenn Sie dieses Angebot nicht angefordert haben, ignorieren Sie diese Nachricht bitte.', demo: '(DEMO-PREISE)' },
};
/** Asunto fijo de la copia al cliente (el mismo en todos los idiomas). */
export const copySubject = (number) => `Torivac · copia de tu presupuesto ${number}`;
/**
 * Copia del pedido para el CLIENTE → { subject, html, text }. Solo contenido generado por el servidor: texto fijo en el idioma del pedido, número, líneas (ref, nombre del catálogo, cantidad e
 * importes valorados por el servidor), total y la línea «si no lo pediste tú, ignora este mensaje». NADA escrito por el visitante (ni nombre, ni empresa, ni teléfono, ni notas) y sin adjuntos.
 */
export function customerCopyMail({ number, priced, lang, demo }, items) {
  const t = COPY_TEXT[lang] || COPY_TEXT.es, am = (n) => (n == null ? t.ask : money(n, lang));
  const rows = priced.lines.map((l) => `<tr><td style="font-family:monospace">${esc(l.ref)}</td><td>${esc(items[l.ref]?.n || '')}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${am(l.unit)}</td><td style="text-align:right"><b>${am(l.total)}</b></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">${esc(t.title)} ${esc(number)}${demo ? ` ${esc(t.demo)}` : ''}</h2><p>${esc(t.intro)}</p>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>${esc(t.ref)}</th><th>${esc(t.item)}</th><th>${esc(t.qty)}</th><th>${esc(t.unit)}</th><th>${esc(t.amount)}</th></tr>${rows}</table>
<p style="text-align:right;font-size:18px">${esc(t.total)}: <b>${money(priced.total, lang)}</b>${priced.unpriced ? `<br><small>${esc(t.unpriced(priced.unpriced))}</small>` : ''}</p>
<p style="color:#777;font-size:12px">${esc(t.ignore)}</p></div>`;
  const text = [`${t.title} ${number}${demo ? ` ${t.demo}` : ''}`, '', t.intro, '', ...priced.lines.map((l) => `${l.ref}\t${items[l.ref]?.n || ''}\tx${l.qty}\t${am(l.total)}`), '', `${t.total}: ${money(priced.total, lang)}`, priced.unpriced ? t.unpriced(priced.unpriced) : '', '', t.ignore].join('\n');
  return { subject: copySubject(number), html, text };
}
