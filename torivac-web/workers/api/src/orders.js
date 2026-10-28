// [ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por correo: AVISO al equipo (con el PDF que fabricó el navegador) y, según ORDER_COPY y con topes,
// COPIA al cliente con contenido generado solo por el servidor (sin PDF ni texto del visitante). Número de pedido TV-AAAAMMDD-NNNN-XXX (XXX aleatorio: dos pedidos simultáneos no se pisan).
// Claves KV: order:<nº completo> (400 días) · uorder:<sha256(correo)[:32]>:<nº> (índice de «mis pedidos» del cliente, valor mínimo) · counter:<AAAAMMDD> (contador de «mejor esfuerzo»).
import { json, clientIp, ipKey, esc, sha256Hex } from './util.js';
import { parseOrder } from './validate.js';
import { loadPrices, priceOrder, withSheetItems } from './prices.js';
import { verifyTurnstile } from './turnstile.js';
import { hit } from './ratelimit.js';
import { sendMail, orderMail, customerCopyMail } from './email.js';
import items from './generated/items.js';

const DAY = 24 * 60 * 60 * 1000, HOUR = 60 * 60 * 1000;
const ORDER_TTL = { expirationTtl: 60 * 60 * 24 * 400 };
const TOO_MANY = 'Demasiados pedidos seguidos. Inténtalo en unos minutos.';
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Fecha en UTC como AAAAMMDD, para el número de pedido y su contador diario. */
export const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
/** Entero de una variable de entorno (texto de cifras); si falta, no es un entero o es menor que `min`, vale `def`. */
export const intVar = (v, def, min = 0) => { const s = String(v ?? '').trim(); if (!/^\d{1,9}$/.test(s)) return def; const n = Number(s); return n >= min ? n : def; };
/** Modo de la copia al cliente: «capped» (por defecto, con topes) u «off» (nunca); cualquier otro valor falla cerrado y cuenta como «off». */
export const copyMode = (env) => (env.ORDER_COPY == null ? 'capped' : String(env.ORDER_COPY).trim().toLowerCase() === 'capped' ? 'capped' : 'off');
/** 3 caracteres aleatorios base36 en mayúsculas para cerrar el número de pedido; `rand(n)` devuelve n enteros sin signo (se puede inyectar en las pruebas). */
export function randomSuffix(rand = (n) => crypto.getRandomValues(new Uint32Array(n))) { return Array.from(rand(3), (v) => BASE36[v % 36]).join(''); }
/** Parte «TV-AAAAMMDD-NNNN» del número: contador diario en KV de «mejor esfuerzo» (no es atómico; si KV lo rechaza, un número de respaldo por segundos del día: el pedido nunca se pierde por esto). */
async function baseNumber(env, now) {
  const k = `counter:${ymd(now)}`; let n;
  try { n = Number((await env.KV.get(k)) || 0) + 1; await env.KV.put(k, String(n), { expirationTtl: 60 * 60 * 48 }); }
  catch { n = Math.floor((now.getTime() % DAY) / 1000) + 1; }
  return `TV-${ymd(now)}-${String(n).padStart(4, '0')}`;
}
/** Siguiente número de pedido completo (TV-AAAAMMDD-NNNN-XXX). */
export async function nextNumber(env, now, rand) { return `${await baseNumber(env, now)}-${randomSuffix(rand)}`; }
/** Prefijo de las claves del índice de pedidos de un cliente: uorder:<32 primeros hex del SHA-256 de su correo en minúsculas>: (nunca el correo en la clave). */
export async function uorderPrefix(email) { return `uorder:${(await sha256Hex(String(email).trim().toLowerCase())).slice(0, 32)}:`; }

/**
 * Decide y, si procede, envía la copia al cliente → motivo: 'sent' | 'failed' | 'not_requested' (el visitante mandó copy:false) | 'off' (ORDER_COPY no es «capped») | 'skipped' (correo sin configurar) |
 * 'limit' (más de 2 copias a ese destinatario en 24 h, o tope diario total ORDER_COPY_DAILY_MAX). Los topes se reservan antes de enviar y no se devuelven si el envío falla (falla cerrado).
 */
async function sendCopy(env, { o, number, priced, demo, cat, nowMs, fetchImpl }) {
  if (!o.copyToCustomer) return 'not_requested';
  if (copyMode(env) !== 'capped') return 'off';
  if (!env.RESEND_API_KEY) return 'skipped';
  if (!(await hit(env, 'copy-to', o.customer.email, { max: 2, windowMs: DAY, now: nowMs })).allowed) return 'limit';
  if (!(await hit(env, 'copy-day', 'all', { max: intVar(env.ORDER_COPY_DAILY_MAX, 150, 0), windowMs: DAY, now: nowMs })).allowed) return 'limit';
  const m = customerCopyMail({ number, priced, lang: o.lang, demo }, cat);
  const r = await sendMail(env, { to: [o.customer.email], subject: m.subject, html: m.html, text: m.text }, fetchImpl);          // sin adjuntos y sin reply_to: nada del visitante
  return r.ok ? 'sent' : 'failed';
}

/** POST /api/order: límites (por visitante y global), validación, valoración en servidor con los precios vigentes, guardado en KV, aviso al equipo y copia al cliente. */
export async function handleOrder(request, env, raw, { fetchImpl = fetch, now = new Date(), catalog = items, cors = {}, rand } = {}) {
  const at = now instanceof Date ? now : new Date(now), nowMs = at.getTime();
  const ip = clientIp(request);
  const rl = await hit(env, 'order', ipKey(ip), { max: 8, now: nowMs });                       // por visitante (IPv6: su /64)
  if (!rl.allowed) return json({ ok: false, error: TOO_MANY }, 429, cors);
  const prices = await loadPrices(env);
  const cat = withSheetItems(catalog, prices);                      // las referencias que la hoja añadió dentro de un producto también son pedibles
  const parsed = parseOrder(raw, cat);
  if (parsed.error) return json({ ok: false, error: parsed.error }, 400, cors);
  const o = parsed.order;
  if (!(await verifyTurnstile(env, o.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  if (!(await hit(env, 'order-hour', 'all', { max: intVar(env.ORDERS_PER_HOUR_MAX, 120, 0), windowMs: HOUR, now: nowMs })).allowed) return json({ ok: false, error: TOO_MANY }, 429, cors);   // global: protege la cuota de Resend y el buzón
  const priced = priceOrder(prices, o.lines);                       // el cliente no puede fijar precios
  const base = await baseNumber(env, at);
  let number = `${base}-${randomSuffix(rand)}`;
  for (let i = 0; i < 4 && (await env.KV.get(`order:${number}`)); i++) number = `${base}-${randomSuffix(rand)}`;     // KV no es atómico: si coincide con uno ya guardado, otro sufijo
  if (await env.KV.get(`order:${number}`)) throw new Error('No se pudo asignar un número de pedido libre');
  const demo = prices.mode !== 'live';
  const record = { number, at: at.toISOString(), customer: o.customer, lines: priced.lines, total: priced.total, unpriced: priced.unpriced, lang: o.lang, prices: { updated_at: prices.updated_at, mode: prices.mode }, ip };
  await env.KV.put(`order:${number}`, JSON.stringify(record), ORDER_TTL);         // primero se guarda (si el correo falla, el pedido no se pierde)
  try { await env.KV.put(`${await uorderPrefix(o.customer.email)}${number}`, '1', ORDER_TTL); }        // índice de «mis pedidos» del cliente
  catch (e) { console.error('No se pudo indexar el pedido', number, e && e.message); }
  const { html, text } = orderMail({ number, customer: o.customer, priced, lang: o.lang, demo, hasPdf: !!o.pdf }, cat);
  const to = String(env.ORDER_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const attachments = o.pdf ? [{ filename: `${number}.pdf`, content: o.pdf }] : undefined;      // el PDF del visitante SOLO va al equipo
  const team = await sendMail(env, { to, subject: `[Web Torivac] Pedido ${number} · ${o.customer.name}`, html, text, replyTo: o.customer.email, attachments }, fetchImpl);
  let reason;
  try { reason = await sendCopy(env, { o, number, priced, demo, cat, nowMs, fetchImpl }); }
  catch (e) { console.error('Copia al cliente fallida', number, e && e.message); reason = 'failed'; }          // el pedido ya está guardado y el equipo avisado: un fallo de KV aquí no lo convierte en un error para el cliente
  const emailed = { team: !!team.ok, customer: reason === 'sent', skipped: !!team.skipped, customer_reason: reason };
  const why = team.ok ? '' : team.skipped ? 'correo sin configurar' : team.status ? `Resend respondió ${team.status}` : String(team.error || 'fallo de envío').slice(0, 120);
  try { await env.KV.put(`order:${number}`, JSON.stringify({ ...record, emailed: { ...emailed, error: why } }), ORDER_TTL); }   // el panel marca los pedidos cuyo aviso por correo no salió
  catch (e) { console.error('No se pudo anotar el resultado del correo', number, e && e.message); }
  return json({ ok: true, number, total: priced.total, unpriced: priced.unpriced, emailed }, 200, cors);
}
/** POST /api/contact: límite por visitante, anti-spam y envío del mensaje al equipo; responde { ok, emailed, skipped }. */
export async function handleContact(request, env, contact, { fetchImpl = fetch, cors = {} } = {}) {
  const ip = clientIp(request);
  const rl = await hit(env, 'contact', ipKey(ip), { max: 5 });
  if (!rl.allowed) return json({ ok: false, error: 'Demasiados mensajes seguidos.' }, 429, cors);
  if (!(await verifyTurnstile(env, contact.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  const to = String(env.ORDER_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const r = await sendMail(env, { to, subject: `[Web Torivac] Contacto · ${contact.name}`, text: `${contact.name} <${contact.email}> (${contact.lang})\n\n${contact.message}`, html: `<p><b>${esc(contact.name)}</b> &lt;${esc(contact.email)}&gt; (${esc(contact.lang)})</p><p>${esc(contact.message).replace(/\n/g, '<br>')}</p>`, replyTo: contact.email }, fetchImpl);
  if (!r.ok) return json({ ok: false, error: r.skipped ? 'El envío de correo no está configurado en el servidor' : 'No hemos podido enviar el mensaje', emailed: false, skipped: !!r.skipped }, 502, cors);   // sin correo no hay mensaje: la web avisa y ofrece escribir directamente
  return json({ ok: true, emailed: true, skipped: false }, 200, cors);
}
