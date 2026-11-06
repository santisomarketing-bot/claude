// [OWNED] Presupuestos de un cliente con cuenta (rol customer; docs/PRECIOS-Y-CLIENTES.md §6): índice por propietario, límite de presupuestos por día, listado y versión reducida.
// Índice: oorder:<correo en minúsculas>:<nº de pedido> → valor = la fecha ISO del pedido (400 días, como el pedido). Lo escribe handleOrder al crear un presupuesto con sesión y es lo único que se recorre:
//   · para el LÍMITE de CUSTOMER_ORDERS_PER_DAY (3 por defecto) en ventana móvil de 24 h por persona: solo cuentan los presupuestos válidos y guardados (un 400 nunca escribe en el índice);
//   · para el LISTADO del cliente (GET /api/orders): los 100 más recientes, sin recorrer los pedidos de los demás.
// Como todo límite en KV es de «mejor esfuerzo»: una ráfaga en paralelo puede pasarse unas peticiones. El cliente nunca ve la IP, el estado del correo, el historial, el original, el propietario ni la categoría.
import { intVar, ymd, DAY } from './util.js';

export const MAX_OWNED = 100, MAX_OPS = 400, CHUNK = 10, DEFAULT_PER_DAY = 3;

/** Prefijo de las claves del índice de un propietario: oorder:<correo en minúsculas>: */
export const ownerPrefix = (email) => `oorder:${String(email).trim().toLowerCase()}:`;
/** Presupuestos por día que puede crear un cliente (variable CUSTOMER_ORDERS_PER_DAY: entero ≥ 1; si falta o no es válida, 3). */
export const dailyLimit = (env) => intVar(env.CUSTOMER_ORDERS_PER_DAY, DEFAULT_PER_DAY, 1);

/** Anota el pedido `number` (creado en `at`, ISO) en el índice de su propietario, con el plazo `ttl` del pedido. */
export async function indexOwned(env, email, number, at, ttl) { await env.KV.put(`${ownerPrefix(email)}${number}`, at, ttl); }
/** Todas las claves de KV con ese prefijo (recorre las páginas hasta `max` operaciones) → { keys, complete }. */
async function listAll(env, prefix, ops) {
  const keys = []; let cursor;
  for (;;) {
    if (ops.n >= MAX_OPS) return { keys, complete: false };
    ops.n++; const r = await env.KV.list({ prefix, cursor });
    for (const k of r.keys) keys.push(k.name);
    if (r.list_complete || !r.cursor) return { keys, complete: true };
    cursor = r.cursor;
  }
}
/** Cuántos presupuestos ha creado este propietario en las últimas 24 h (ventana móvil que termina en `nowMs`): mira solo los pedidos de hoy y de ayer (UTC) y compara su fecha guardada en el índice. */
export async function usedLast24h(env, email, nowMs) {
  const days = [...new Set([ymd(new Date(nowMs)), ymd(new Date(nowMs - DAY))])], ops = { n: 0 }, since = nowMs - DAY;
  let used = 0;
  for (const day of days) {
    const { keys } = await listAll(env, `${ownerPrefix(email)}TV-${day}-`, ops);
    for (const v of await Promise.all(keys.map((k) => env.KV.get(k)))) { const t = Date.parse(v); if (Number.isNaN(t) || t > since) used++; }          // una fecha ilegible cuenta (falla cerrado)
  }
  return used;
}
/** Pedido de KV (texto JSON) → objeto, o null si falta o está dañado. */
const parse = (raw) => { if (!raw) return null; try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : null; } catch { return null; } };
/**
 * Los presupuestos de un propietario (los MAX_OWNED más recientes, el más reciente primero) → { orders (registros completos de KV), truncated }. Lee el índice y luego cada pedido, con un tope de operaciones;
 * un pedido cuyo `owner` no sea ese correo no se devuelve nunca. truncated: hay más antiguos sin devolver, o KV cortó la lectura.
 */
export async function listOwned(env, email) {
  const me = String(email).trim().toLowerCase(), ops = { n: 0 }, out = []; let truncated = false;
  try {
    const { keys, complete } = await listAll(env, ownerPrefix(me), ops);
    const numbers = keys.map((k) => k.slice(ownerPrefix(me).length)).sort().reverse();                         // el contador más alto de un día = el más reciente
    if (!complete || numbers.length > MAX_OWNED) truncated = true;
    const want = numbers.slice(0, MAX_OWNED);
    for (let i = 0; i < want.length; i += CHUNK) {
      const room = Math.min(CHUNK, MAX_OPS - ops.n); if (room <= 0) { truncated = true; break; }
      const part = want.slice(i, i + room); ops.n += part.length;
      for (const raw of await Promise.all(part.map((n) => env.KV.get(`order:${n}`)))) { const o = parse(raw); if (o && o.owner === me && typeof o.at === 'string' && o.customer && typeof o.customer === 'object') out.push(o); }
      if (part.length < Math.min(CHUNK, want.length - i)) { truncated = true; break; }
    }
  } catch (e) { if (!out.length) throw e; console.error('Listado de presupuestos del cliente cortado por KV:', e && e.message); truncated = true; }
  out.sort((a, b) => b.at.localeCompare(a.at));
  return { orders: out, truncated };
}
/** Versión de un presupuesto para su CLIENTE: { number, at, customer, lines, total, unpriced, lang, quoteNote? }. Sin ip, emailed, history, lastSent, original, rev, edited, owner, prices ni priceTier. */
export function forCustomer(o) {
  const out = { number: o.number, at: o.at, customer: o.customer, lines: o.lines, total: o.total, unpriced: o.unpriced, lang: o.lang };
  if (typeof o.quoteNote === 'string' && o.quoteNote) out.quoteNote = o.quoteNote;
  return out;
}
