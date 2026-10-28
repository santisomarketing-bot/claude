// [ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por email (equipo + copia al cliente, con el PDF).
import { json, clientIp, esc } from './util.js';
import { parseOrder } from './validate.js';
import { loadPrices, priceOrder, withSheetItems } from './prices.js';
import { verifyTurnstile } from './turnstile.js';
import { hit } from './ratelimit.js';
import { sendMail, orderMail } from './email.js';
import items from './generated/items.js';

/** Fecha en UTC como AAAAMMDD, para el número de pedido y su contador diario. */
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
/** Siguiente número de pedido del día (TV-AAAAMMDD-NNNN), con un contador en KV que caduca a las 48 h. */
export async function nextNumber(env, now) { const k = `counter:${ymd(now)}`; const n = Number((await env.KV.get(k)) || 0) + 1; await env.KV.put(k, String(n), { expirationTtl: 60 * 60 * 48 }); return `TV-${ymd(now)}-${String(n).padStart(4, '0')}`; }

/** POST /api/order: límite por IP, validación, valoración en servidor con los precios vigentes, guardado en KV y correos. */
export async function handleOrder(request, env, raw, { fetchImpl = fetch, now = new Date(), catalog = items, cors = {} } = {}) {
  const ip = clientIp(request);
  const rl = await hit(env, 'order', ip, { max: 8, now: now.getTime() });
  if (!rl.allowed) return json({ ok: false, error: 'Demasiados pedidos seguidos. Inténtalo en unos minutos.' }, 429, cors);
  const prices = await loadPrices(env);
  const cat = withSheetItems(catalog, prices);                      // las referencias que la hoja añadió dentro de un producto también son pedibles
  const parsed = parseOrder(raw, cat);
  if (parsed.error) return json({ ok: false, error: parsed.error }, 400, cors);
  const o = parsed.order;
  if (!(await verifyTurnstile(env, o.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  const priced = priceOrder(prices, o.lines);                       // el cliente no puede fijar precios
  let number = await nextNumber(env, now);
  for (let i = 0; i < 4 && (await env.KV.get(`order:${number}`)); i++) number = await nextNumber(env, now);   // KV no es atómico: si dos pedidos coinciden, el segundo coge el siguiente número
  const demo = prices.mode !== 'live';
  const record = { number, at: now.toISOString(), customer: o.customer, lines: priced.lines, total: priced.total, unpriced: priced.unpriced, lang: o.lang, prices: { updated_at: prices.updated_at, mode: prices.mode }, ip };
  const TTL = { expirationTtl: 60 * 60 * 24 * 400 };
  await env.KV.put(`order:${number}`, JSON.stringify(record), TTL);                // primero se guarda (si el correo falla, el pedido no se pierde)
  const { html, text } = orderMail({ number, customer: o.customer, priced, lang: o.lang, demo }, cat);
  const to = String(env.ORDER_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const attachments = o.pdf ? [{ filename: `${number}.pdf`, content: o.pdf }] : undefined;
  const team = await sendMail(env, { to, subject: `[Web Torivac] Pedido ${number} · ${o.customer.name}`, html, text, replyTo: o.customer.email, attachments }, fetchImpl);
  let customerMail = { ok: false, skipped: true };
  if (o.copyToCustomer) customerMail = await sendMail(env, { to: [o.customer.email], subject: `Torivac · copia de tu presupuesto ${number}`, html, text, attachments }, fetchImpl);
  const emailed = { team: !!team.ok, customer: !!customerMail.ok, skipped: !!team.skipped };
  const why = team.ok ? '' : team.skipped ? 'correo sin configurar' : team.status ? `Resend respondió ${team.status}` : String(team.error || 'fallo de envío').slice(0, 120);
  await env.KV.put(`order:${number}`, JSON.stringify({ ...record, emailed: { ...emailed, error: why } }), TTL);   // el panel marca los pedidos cuyo aviso por correo no salió
  return json({ ok: true, number, total: priced.total, unpriced: priced.unpriced, emailed }, 200, cors);
}
/** POST /api/contact: límite por IP, anti-spam y envío del mensaje al equipo; responde { ok, emailed, skipped }. */
export async function handleContact(request, env, contact, { fetchImpl = fetch, cors = {} } = {}) {
  const ip = clientIp(request);
  const rl = await hit(env, 'contact', ip, { max: 5 });
  if (!rl.allowed) return json({ ok: false, error: 'Demasiados mensajes seguidos.' }, 429, cors);
  if (!(await verifyTurnstile(env, contact.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  const to = String(env.ORDER_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const r = await sendMail(env, { to, subject: `[Web Torivac] Contacto · ${contact.name}`, text: `${contact.name} <${contact.email}> (${contact.lang})\n\n${contact.message}`, html: `<p><b>${esc(contact.name)}</b> &lt;${esc(contact.email)}&gt; (${esc(contact.lang)})</p><p>${esc(contact.message).replace(/\n/g, '<br>')}</p>`, replyTo: contact.email }, fetchImpl);
  if (!r.ok) return json({ ok: false, error: r.skipped ? 'El envío de correo no está configurado en el servidor' : 'No hemos podido enviar el mensaje', emailed: false, skipped: !!r.skipped }, 502, cors);   // sin correo no hay mensaje: la web avisa y ofrece escribir directamente
  return json({ ok: true, emailed: true, skipped: false }, 200, cors);
}
