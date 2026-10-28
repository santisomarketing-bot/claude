// [ORDERS] POST /api/order → valida, valora en servidor con los precios VIGENTES, guarda y envía por correo: AVISO al equipo (con el PDF que fabricó el navegador) y, según ORDER_COPY y con topes,
// COPIA al cliente con contenido generado solo por el servidor (sin PDF ni texto del visitante). Número de pedido TV-AAAAMMDD-NNNN-XXX (XXX aleatorio: dos pedidos simultáneos no se pisan).
// POST /api/contact → guarda SIEMPRE el mensaje (CT-AAAAMMDD-NNNN-XXX, ver messages.js), intenta el correo al equipo y dice la verdad sobre él en `emailed`.
// Claves KV: order:<nº completo> (400 días) · uorder:<sha256(correo)[:32]>:<nº> (índice de «mis pedidos» del cliente, valor mínimo) · counter:<AAAAMMDD> y counter:ct:<AAAAMMDD> (contadores de «mejor esfuerzo»)
// · msg:… (mensajes de contacto, 400 días).
import { json, clientIp, ipKey, sha256Hex } from './util.js';
import { parseOrder } from './validate.js';
import { loadPrices, priceOrder, withSheetItems } from './prices.js';
import { verifyTurnstile } from './turnstile.js';
import { hit } from './ratelimit.js';
import { sendMail, orderMail, customerCopyMail, contactMail, mailReady, teamRecipients } from './email.js';
import { putMessage, messageExists } from './messages.js';
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
/** Parte «<prefijo>-AAAAMMDD-NNNN» del número (TV = pedidos, CT = mensajes de contacto): contador diario en KV de «mejor esfuerzo» (no es atómico; si KV lo rechaza, un número de respaldo por segundos del día: el pedido nunca se pierde por esto). */
async function baseNumber(env, now, prefix = 'TV') {
  const k = prefix === 'TV' ? `counter:${ymd(now)}` : `counter:${prefix.toLowerCase()}:${ymd(now)}`; let n;
  try { n = Number((await env.KV.get(k)) || 0) + 1; await env.KV.put(k, String(n), { expirationTtl: 60 * 60 * 48 }); }
  catch { n = Math.floor((now.getTime() % DAY) / 1000) + 1; }
  return `${prefix}-${ymd(now)}-${String(n).padStart(4, '0')}`;
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
  if (!mailReady(env)) return 'skipped';
  if (!(await hit(env, 'copy-to', o.customer.email, { max: 2, windowMs: DAY, now: nowMs })).allowed) return 'limit';
  if (!(await hit(env, 'copy-day', 'all', { max: intVar(env.ORDER_COPY_DAILY_MAX, 150, 0), windowMs: DAY, now: nowMs })).allowed) return 'limit';
  const m = customerCopyMail({ number, priced, lang: o.lang, demo }, cat);
  const r = await sendMail(env, { to: [o.customer.email], subject: m.subject, html: m.html, text: m.text }, fetchImpl, { kind: 'order', now: nowMs });          // sin adjuntos y sin reply_to: nada del visitante
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
  const attachments = o.pdf ? [{ filename: `${number}.pdf`, content: o.pdf }] : undefined;      // el PDF del visitante SOLO va al equipo
  const team = await sendMail(env, { to: teamRecipients(env), subject: `[Web Torivac] Pedido ${number} · ${o.customer.name}`, html, text, replyTo: o.customer.email, attachments }, fetchImpl, { kind: 'order', now: nowMs });
  let reason;
  try { reason = await sendCopy(env, { o, number, priced, demo, cat, nowMs, fetchImpl }); }
  catch (e) { console.error('Copia al cliente fallida', number, e && e.message); reason = 'failed'; }          // el pedido ya está guardado y el equipo avisado: un fallo de KV aquí no lo convierte en un error para el cliente
  const emailed = { team: !!team.ok, customer: reason === 'sent', skipped: !!team.skipped, customer_reason: reason };
  const why = team.ok ? '' : team.skipped ? 'correo sin configurar' : String(team.error || 'fallo de envío').slice(0, 160);
  try { await env.KV.put(`order:${number}`, JSON.stringify({ ...record, emailed: { ...emailed, reason: team.reason, error: why } }), ORDER_TTL); }   // el panel marca los pedidos cuyo aviso por correo no salió: reason = sent · off · failed · skipped (aviso al equipo); error, solo para managers (forClient lo quita)
  catch (e) { console.error('No se pudo anotar el resultado del correo', number, e && e.message); }
  return json({ ok: true, number, total: priced.total, unpriced: priced.unpriced, emailed }, 200, cors);
}
/** Espera `ms` milisegundos (0 = no espera). */
const sleep = (ms) => (ms > 0 ? new Promise((res) => setTimeout(res, ms)) : Promise.resolve());
/**
 * POST /api/contact: límite por visitante y anti-spam como siempre (5 / 10 min por ipKey, Turnstile); luego construye el registro, LO GUARDA (msg:…, 400 días), intenta el correo al equipo, anota el resultado
 * en el registro y responde { ok:true, id, emailed:{ sent, reason } } con 200 aunque el correo no saliera: el mensaje queda guardado y el equipo lo ve en el panel (`emailed.error`, solo para managers, nunca aquí).
 * Si no se puede guardar (KV no escribe) → 500 «No se pudo guardar el mensaje» y NO se envía nada: nunca se dice «recibido» de lo que no está guardado. `now`, `rand` y `retryMs` se inyectan en las pruebas.
 */
export async function handleContact(request, env, contact, { fetchImpl = fetch, cors = {}, now = new Date(), rand, retryMs = 1100 } = {}) {
  const at = now instanceof Date ? now : new Date(now), nowMs = at.getTime(), ip = clientIp(request);
  /** 500 «No se pudo guardar el mensaje» (el detalle va al registro del servidor, sin datos del visitante). */
  const notSaved = (id, e) => { console.error('[contacto] No se pudo guardar el mensaje', id || '', e && e.message); return json({ ok: false, error: 'No se pudo guardar el mensaje' }, 500, cors); };
  let rl; try { rl = await hit(env, 'contact', ipKey(ip), { max: 5, now: nowMs }); } catch (e) { return notSaved('', e); }       // si el almacén no responde, tampoco hay límite que aplicar: se falla cerrado
  if (!rl.allowed) return json({ ok: false, error: 'Demasiados mensajes seguidos.' }, 429, cors);
  if (!(await verifyTurnstile(env, contact.turnstile, ip, fetchImpl))) return json({ ok: false, error: 'Verificación anti-spam fallida' }, 400, cors);
  let id, record;
  try {
    const base = await baseNumber(env, at, 'CT');
    id = `${base}-${randomSuffix(rand)}`;
    for (let i = 0; i < 4 && (await messageExists(env, id)); i++) id = `${base}-${randomSuffix(rand)}`;           // KV no es atómico: si coincide con uno ya guardado, otro sufijo
    if (await messageExists(env, id)) throw new Error('No se pudo asignar un id libre');
    record = { id, at: at.toISOString(), name: contact.name, email: contact.email, message: contact.message, lang: contact.lang, ip, emailed: { sent: false, reason: 'failed', error: 'Envío sin confirmar' } };       // hasta saber el resultado, el registro no afirma nada que no sea cierto
    await putMessage(env, record);
  } catch (e) { return notSaved(id, e); }
  let r;
  try {
    const m = contactMail(record);
    r = await sendMail(env, { to: teamRecipients(env), subject: m.subject, html: m.html, text: m.text, replyTo: contact.email }, fetchImpl, { kind: 'contact', now: nowMs });
  } catch (e) { console.error('[contacto] Fallo inesperado al enviar', id, e && e.message); r = { ok: false, reason: 'failed', error: 'Fallo interno al enviar el correo' }; }          // el mensaje ya está guardado: nunca se convierte en un error para el visitante
  const emailed = { sent: !!r.ok, reason: r.reason, ...(!r.ok && r.error ? { error: r.error } : {}) };
  try { await putMessage(env, { ...record, emailed }); }
  catch {                                                                                                           // KV admite una escritura por segundo en la misma clave: si la segunda llegó demasiado pronto, se reintenta una vez
    await sleep(retryMs);
    try { await putMessage(env, { ...record, emailed }); } catch (e) { console.error('[contacto] No se pudo anotar el resultado del correo', id, e && e.message); }
  }
  return json({ ok: true, id, emailed: { sent: emailed.sent, reason: emailed.reason } }, 200, cors);
}
