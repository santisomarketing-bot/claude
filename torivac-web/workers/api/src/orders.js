// [ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por email (equipo + copia al cliente, con el PDF).
import { json, clientIp } from './util.js';
import { parseOrder } from './validate.js';
import { loadPrices, priceOrder } from './prices.js';
import { verifyTurnstile } from './turnstile.js';
import { hit } from './ratelimit.js';
import { sendMail, orderMail } from './email.js';
import items from './generated/items.js';

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
export async function nextNumber(env, now) { const k = `counter:${ymd(now)}`; const n = Number((await env.KV.get(k)) || 0) + 1; await env.KV.put(k, String(n), { expirationTtl: 60 * 60 * 48 }); return `TV-${ymd(now)}-${String(n).padStart(4, '0')}`; }

export async function handleOrder(request, env, raw, { fetchImpl = fetch, now = new Date(), catalog = items, cors = {} } = {}) {
  const ip = clientIp(request);
  const rl = await hit(env, 'order', ip, { max: 8, now: now.getTime() });
  if (!rl.allowed) return json({ ok: false, error: 'Demasiados pedidos seguidos. Inténtalo en unos minutos.' }, 429, cors);
  const parsed = parseOrder(raw, catalog);
  if (parsed.error) return json({ ok: false, error: parsed.error }, 400, cors);
  const o = parsed.order;
  if (!(await verifyTurnstile(env, o.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  const prices = await loadPrices(env);
  const priced = priceOrder(prices, o.lines);                       // el cliente no puede fijar precios
  const number = await nextNumber(env, now);
  const demo = prices.mode !== 'live';
  const record = { number, at: now.toISOString(), customer: o.customer, lines: priced.lines, total: priced.total, unpriced: priced.unpriced, lang: o.lang, prices: { updated_at: prices.updated_at, mode: prices.mode }, ip };
  await env.KV.put(`order:${number}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 400 });
  const { html, text } = orderMail({ number, customer: o.customer, priced, lang: o.lang, demo }, catalog);
  const to = String(env.ORDER_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const attachments = o.pdf ? [{ filename: `${number}.pdf`, content: o.pdf }] : undefined;
  const team = await sendMail(env, { to, subject: `[Web Torivac] Pedido ${number} · ${o.customer.name}`, html, text, replyTo: o.customer.email, attachments }, fetchImpl);
  let customerMail = { ok: false, skipped: true };
  if (o.copyToCustomer) customerMail = await sendMail(env, { to: [o.customer.email], subject: `Torivac · copia de tu presupuesto ${number}`, html, text, attachments }, fetchImpl);
  return json({ ok: true, number, total: priced.total, unpriced: priced.unpriced, emailed: { team: !!team.ok, customer: !!customerMail.ok, skipped: !!team.skipped } }, 200, cors);
}
export async function handleContact(request, env, contact, { fetchImpl = fetch, cors = {} } = {}) {
  const ip = clientIp(request);
  const rl = await hit(env, 'contact', ip, { max: 5 });
  if (!rl.allowed) return json({ ok: false, error: 'Demasiados mensajes seguidos.' }, 429, cors);
  if (!(await verifyTurnstile(env, contact.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  const to = String(env.ORDER_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const r = await sendMail(env, { to, subject: `[Web Torivac] Contacto · ${contact.name}`, text: `${contact.name} <${contact.email}> (${contact.lang})\n\n${contact.message}`, html: `<p><b>${contact.name.replace(/[<>&]/g, '')}</b> &lt;${contact.email}&gt; (${contact.lang})</p><p>${contact.message.replace(/[<>&]/g, '').replace(/\n/g, '<br>')}</p>`, replyTo: contact.email }, fetchImpl);
  return json({ ok: true, emailed: !!r.ok, skipped: !!r.skipped }, 200, cors);
}
