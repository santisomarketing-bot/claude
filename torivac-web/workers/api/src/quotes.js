// [QUOTES] Presupuestos recibidos (docs/PRESUPUESTOS-RECIBIDOS.md): ver, editar y reenviar por correo un pedido ya guardado. Las pueden usar `manager` y `client` (el PROPIETARIO de la web); el token maestro cuenta como manager.
//   GET  /api/orders/:número        → 200 { ok, order } · 404 { ok:false, error:'No existe ese presupuesto' } (también si el número no tiene la forma TV-AAAAMMDD-NNNN[-XXX]: el texto de la URL nunca llega a KV)
//   PUT  /api/orders/:número        → (cuerpo ≤ 100 KB; más → 413) edita solicitante, líneas (precio manual opcional) y nota; protegido por `rev`: 409 { code:'conflict', order } si otra persona lo cambió. Guarda `original` una vez, `rev`, `edited` e `history` (≤ 50).
//   POST /api/orders/:número/send   → (cuerpo ≤ 6 MB; más → 413) reenvía el presupuesto por correo (1 a 3 destinatarios, PDF validado, topes de 20/h por persona y 150/día), lo anota en `history` y `lastSent`; un fallo del proveedor NO es un error HTTP (sent:false).
// Orden de comprobaciones: 401 (sin sesión, en el router) → 404 (número o presupuesto) → 413/400 (cuerpo) → 409 (rev / correo apagado) → 429 (topes). Un propietario nunca ve la IP del pedido ni emailed.error (forClient).
import { json, readBody, jsonOf, round2 } from './util.js';
import { parseEdit, parseSend, isEmail } from './validate.js';
import { loadPrices, unitPrice, withSheetItems } from './prices.js';
import { hit } from './ratelimit.js';
import { sendMail, quoteMail, mailReady, teamRecipients } from './email.js';
import { forClient } from './orderlist.js';
import { intVar, ORDER_TTL, DAY, HOUR } from './orders.js';
import items from './generated/items.js';

/** Forma del número de un presupuesto: TV-AAAAMMDD-NNNN con el sufijo de 3 caracteres base36 (los antiguos no lo tienen). Es lo ÚNICO que se acepta de la URL. */
export const ORDER_NUMBER = /^TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?$/;
/** Máximo de entradas de `history` (se descartan las más antiguas). */
export const MAX_HISTORY = 50;
const NOT_FOUND = 'No existe ese presupuesto';
const CONFLICT = 'Alguien ha modificado este presupuesto: recarga y vuelve a intentarlo';
const MAIL_OFF = 'El correo no está configurado: el presupuesto no se puede enviar desde aquí. Descarga el PDF y envíalo tú.';
const TOO_MANY = 'Demasiados reenvíos seguidos. Espera un rato.';

/** 404 con el texto de siempre (número con forma no válida o presupuesto inexistente). */
const notFound = (cors) => json({ ok: false, error: NOT_FOUND }, 404, cors);
/** 400 con el error de validación { ok:false, error, code?, field? } (los dos últimos solo en errores de texto). */
const badRequest = (p, cors) => json({ ok: false, error: p.error, ...(p.code ? { code: p.code } : {}), ...(p.field ? { field: p.field } : {}) }, 400, cors);
/** Lee el cuerpo JSON con su tope → { body } (null si está vacío o roto: quien valida lo rechaza con 400) o { res } con el 413 si supera `max` bytes. */
async function readCapped(request, max, cors) {
  const bytes = await readBody(request, max);
  return bytes === null ? { res: json({ ok: false, error: 'La petición es demasiado grande' }, 413, cors) } : { body: jsonOf(bytes) };
}
/** El pedido tal como lo ve `who`: el manager (y el token maestro) lo ve entero; el propietario, sin la IP ni el texto de error del correo. */
const view = (who, order) => (who.role === 'manager' ? order : forClient(order));
/** Quién figura como autor de un cambio: el correo de la sesión, o «maestro» si es el token maestro. */
const author = (who) => (who.master ? 'maestro' : String(who.sub));
/** Revisión guardada de un pedido: `rev` si es un entero ≥ 1; si falta (nunca editado), 0. */
const revOf = (rec) => (Number.isInteger(rec.rev) && rec.rev > 0 ? rec.rev : 0);
/** Lista `history` con una entrada más, limitada a las MAX_HISTORY últimas. */
const pushHistory = (history, entry) => [...(Array.isArray(history) ? history : []), entry].slice(-MAX_HISTORY);

/** Pedido de KV por su número → objeto, o null si el número no tiene la forma válida, no existe o está dañado. Nunca toca KV con un número que no cumpla ORDER_NUMBER. */
async function readRecord(env, number) {
  if (!ORDER_NUMBER.test(number)) return null;
  const raw = await env.KV.get(`order:${number}`); if (!raw) return null;
  try { const o = JSON.parse(raw); return o && typeof o === 'object' && !Array.isArray(o) && o.customer && typeof o.customer === 'object' && Array.isArray(o.lines) ? o : null; } catch { return null; }
}
/** Guarda el pedido con el plazo de siempre (400 días desde ahora). */
const saveRecord = (env, number, rec) => env.KV.put(`order:${number}`, JSON.stringify(rec), ORDER_TTL);

/** GET /api/orders/:número → 200 { ok, order } (según el rol) o 404. */
async function handleGet(env, who, number, { cors }) {
  const rec = await readRecord(env, number); if (!rec) return notFound(cors);
  return json({ ok: true, order: view(who, rec) }, 200, cors);
}

/**
 * Líneas nuevas del presupuesto editado → { lines, total, unpriced, revalued }. Sin `price`, una línea que ya existía con la misma referencia y la misma cantidad conserva su unit/total/manual tal cual;
 * si cambió la cantidad, la línea es nueva o `price` es null, se valora con la tarifa vigente (puede quedar sin precio) y deja de ser manual; un número en `price` fija el precio unitario (manual:true).
 */
function priceLines(edit, rec, prices) {
  const before = new Map(rec.lines.filter((l) => l && typeof l.ref === 'string').map((l) => [l.ref, l]));
  let total = 0, unpriced = 0, revalued = false;
  const lines = edit.lines.map(({ ref, qty, price }) => {
    const prev = before.get(ref), keep = price === undefined && prev && prev.qty === qty;
    let unit, t, manual = false;
    if (typeof price === 'number') { unit = price; manual = true; }
    else if (keep) { unit = prev.unit ?? null; manual = prev.manual === true; }
    else { unit = unitPrice(prices, ref, qty); revalued = true; }
    t = keep ? (prev.total ?? null) : unit == null ? null : round2(unit * qty);
    if (t == null) unpriced++; else total += t;
    return { ref, qty, unit, total: t, ...(manual ? { manual: true } : {}) };
  });
  return { lines, total: round2(total), unpriced, revalued };
}

/** PUT /api/orders/:número → 200 { ok, order } con la edición guardada; 400 si el cuerpo no es válido; 404; 409 { code:'conflict', order } si `rev` no es la guardada. */
async function handleEdit(request, env, who, number, { cors, nowMs, catalog }) {
  const rec = await readRecord(env, number); if (!rec) return notFound(cors);
  const rb = await readCapped(request, 100_000, cors); if (rb.res) return rb.res;
  const prices = await loadPrices(env);
  const parsed = parseEdit(rb.body, withSheetItems(catalog, prices));                                  // JSON roto o vacío → null → «Petición no válida» (400)
  if (parsed.error) return badRequest(parsed, cors);
  const e = parsed.edit, rev = revOf(rec);
  if (e.rev !== rev) return json({ ok: false, code: 'conflict', error: CONFLICT, order: view(who, rec) }, 409, cors);
  const at = new Date(nowMs).toISOString(), p = priceLines(e, rec, prices);
  const next = {
    ...rec, ...(e.customer ? { customer: e.customer } : {}), lines: p.lines, total: p.total, unpriced: p.unpriced, rev: rev + 1, edited: { at, by: author(who) },
    original: rec.original ?? { at: rec.at, customer: rec.customer, lines: rec.lines, total: rec.total, unpriced: rec.unpriced },       // lo que llegó de la web, solo la primera vez
    history: pushHistory(rec.history, { at, by: author(who), kind: 'edit', rev: rev + 1 }),
    ...(p.revalued ? { prices: { updated_at: prices.updated_at, mode: prices.mode } } : {}),
  };
  if (e.quoteNote !== undefined) { if (e.quoteNote) next.quoteNote = e.quoteNote; else delete next.quoteNote; }
  await saveRecord(env, number, next);
  return json({ ok: true, order: view(who, next) }, 200, cors);
}

/**
 * Topes del reenvío, que se reservan ANTES de enviar y no se devuelven si el envío falla → true si se puede enviar. 20 por hora y persona (qsend) y ORDER_SEND_DAILY_MAX al día en total
 * (qsendday; 150 por defecto; 0 = sin tope diario, igual que en PHP; el tope por hora y persona sigue).
 */
async function sendAllowed(env, who, nowMs) {
  if (!(await hit(env, 'qsend', String(who.sub), { max: 20, windowMs: HOUR, now: nowMs })).allowed) return false;
  const daily = intVar(env.ORDER_SEND_DAILY_MAX, 150, 0);
  return daily === 0 || (await hit(env, 'qsendday', 'all', { max: daily, windowMs: DAY, now: nowMs })).allowed;
}

/**
 * POST /api/orders/:número/send → 200 { ok, sent, reason:'sent'|'failed'|'skipped', order, error? } (error solo para managers); 400 si el cuerpo no es válido; 404; 409 { code:'mail_off' } sin correo configurado
 * (sin gastar cupo ni anotar historial); 429 si se superan los topes. El correo lleva el texto fijo del idioma del pedido, el mensaje escapado, los precios GUARDADOS y el PDF adjunto; se anota en `history` y `lastSent` aunque falle.
 */
async function handleSend(request, env, who, number, { cors, nowMs, fetchImpl, catalog }) {
  const rec = await readRecord(env, number); if (!rec) return notFound(cors);
  const rb = await readCapped(request, 6_000_000, cors); if (rb.res) return rb.res;
  const parsed = parseSend(rb.body); if (parsed.error) return badRequest(parsed, cors);
  const s = parsed.send;
  if (!mailReady(env)) return json({ ok: false, code: 'mail_off', error: MAIL_OFF }, 409, cors);
  if (!(await sendAllowed(env, who, nowMs))) return json({ ok: false, error: TOO_MANY }, 429, cors);
  const prices = await loadPrices(env), me = String(who.sub).toLowerCase();
  const m = quoteMail({ number, lang: rec.lang, lines: rec.lines, total: rec.total, unpriced: rec.unpriced, quoteNote: rec.quoteNote, message: s.message, demo: !(rec.prices && rec.prices.mode === 'live') }, withSheetItems(catalog, prices));
  const cc = s.copyToMe && !who.master && isEmail(me) && !s.to.includes(me) ? [me] : undefined;
  const r = await sendMail(env, { to: s.to, cc, replyTo: teamRecipients(env)[0], subject: m.subject, html: m.html, text: m.text, attachments: [{ filename: `${number}.pdf`, content: s.pdf }] }, fetchImpl, { kind: 'order', now: nowMs });
  const ok = !!r.ok, reason = ok ? 'sent' : r.skipped ? 'skipped' : 'failed', at = new Date(nowMs).toISOString();
  const fresh = (await readRecord(env, number)) || rec;                                  // el envío tardó: se relee por si alguien editó mientras tanto
  const next = { ...fresh, history: pushHistory(fresh.history, { at, by: author(who), kind: 'send', rev: revOf(fresh), to: s.to, ok, reason }), lastSent: { at, by: author(who), to: s.to, ok, reason } };
  let saved = next;
  try { await saveRecord(env, number, next); }
  catch (e) { console.error('No se pudo anotar el reenvío', number, e && e.message); saved = fresh; }          // el correo ya salió: se dice la verdad del envío aunque no se pueda anotar
  return json({ ok: true, sent: ok, reason, ...(!ok && who.role === 'manager' && r.error ? { error: r.error } : {}), order: view(who, saved) }, 200, cors);
}

/**
 * Atiende GET /api/orders/:número · PUT /api/orders/:número · POST /api/orders/:número/send para `who` (ya autenticado como manager o propietario) → Response, o null si la ruta no es de este módulo.
 * El número se toma del texto de la URL SIN decodificar y solo se usa si cumple ORDER_NUMBER. `catalog` y `fetchImpl` se inyectan en las pruebas.
 */
export async function quoteRoute(request, env, { who, path, cors = {}, nowMs = Date.now(), fetchImpl = fetch, catalog = items }) {
  if (!path.startsWith('/api/orders/')) return null;
  const parts = path.slice('/api/orders/'.length).split('/'), number = parts[0], method = request.method;
  if (parts.length === 1 && method === 'GET') return await handleGet(env, who, number, { cors });
  if (parts.length === 1 && method === 'PUT') return await handleEdit(request, env, who, number, { cors, nowMs, catalog });
  if (parts.length === 2 && parts[1] === 'send' && method === 'POST') return await handleSend(request, env, who, number, { cors, nowMs, fetchImpl, catalog });
  return null;
}
