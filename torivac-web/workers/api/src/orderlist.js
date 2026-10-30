// [ORDERLIST] GET /api/orders sin recorrer todo el almacén: acotado en pedidos y en operaciones de KV por petición.
//   MANAGER y CLIENTE recorren igual los prefijos de fecha order:TV-AAAAMMDD- hacia atrás desde hoy hasta reunir 300 pedidos o llegar a 120 días, con un máximo de 400 operaciones de KV (list + get).
//   El rol «client» es el PROPIETARIO de la web (no un comprador): ve TODOS los presupuestos recibidos, pero nunca la IP del pedido ni emailed.error (forClient). El índice uorder:<sha256(correo)[:32]>:<nº>
//   se sigue escribiendo al crear el pedido (orders.js) pero ya no se usa para listar.
// Si se corta antes de agotar lo que había, la respuesta lleva truncated:true.
import { ymd } from './orders.js';

export const MAX_MANAGER = 300, MAX_DAYS = 120, MAX_OPS = 400, CHUNK = 10;

/** Pedido de KV (texto JSON) → objeto, o null si falta o está dañado. */
const parse = (raw) => { if (!raw) return null; try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : null; } catch { return null; } };
/** Versión de un pedido para un CLIENTE: sin la IP del emisor ni el texto de error del aviso por correo (eso es solo para managers). */
export function forClient(o) {
  const { ip, ...rest } = o;
  if (rest.emailed && typeof rest.emailed === 'object') { const { error, ...em } = rest.emailed; rest.emailed = em; }
  return rest;
}
/** Todas las claves de KV con ese prefijo (cada página es una operación; para si se agotan las operaciones) → { keys, complete }. */
async function listKeys(env, prefix, ops) {
  const keys = []; let cursor;
  for (;;) {
    if (ops.n >= MAX_OPS) return { keys, complete: false };
    ops.n++; const r = await env.KV.list({ prefix, cursor });
    for (const k of r.keys) keys.push(k.name);
    if (r.list_complete || !r.cursor) return { keys, complete: true };
    cursor = r.cursor;
  }
}
/** Lee los pedidos de las claves dadas (las más recientes primero) hasta `want` pedidos o hasta agotar las operaciones → { done } con false si quedaron claves sin leer. */
async function readOrders(env, names, out, want, ops) {
  for (let i = 0; i < names.length; i += CHUNK) {
    const room = Math.min(CHUNK, want - out.length, MAX_OPS - ops.n);
    if (room <= 0) return false;
    const part = names.slice(i, i + room); ops.n += part.length;
    for (const raw of await Promise.all(part.map((n) => env.KV.get(n)))) { const o = parse(raw); if (o) out.push(o); }
    if (part.length < Math.min(CHUNK, names.length - i)) return false;                 // el cupo acotó el trozo: quedan claves sin leer
  }
  return true;
}
/** Pedidos visibles para `who` (los más recientes de todos; el rol client, sin IP ni error de correo) → { orders (más recientes primero), truncated }. `now` en ms (para pruebas). */
export async function listOrders(env, who, { now = Date.now() } = {}) {
  const ops = { n: 0 }, out = []; let truncated = false;
  try { truncated = await scan(env, now, ops, out); }
  catch (e) { if (!out.length) throw e; console.error('Listado de pedidos cortado por KV:', e && e.message); truncated = true; }          // p. ej. el tope de subconsultas del plan gratuito: se devuelve lo leído, marcado como cortado
  let orders = out.filter((o) => o && typeof o.at === 'string' && o.customer && typeof o.customer === 'object');
  if (who.role !== 'manager') orders = orders.map(forClient);                                                    // el propietario (client) ve todos, pero sin IP ni emailed.error
  orders.sort((a, b) => b.at.localeCompare(a.at));
  return { orders, truncated };
}
/** Recorre KV llenando `out` con los pedidos leídos (los más recientes primero) → true si se cortó antes de agotar lo que había. */
async function scan(env, now, ops, out) {
  let truncated = false;
  for (let d0 = 0; d0 < MAX_DAYS && !truncated && out.length < MAX_MANAGER; d0 += CHUNK) {
    const days = Array.from({ length: Math.min(CHUNK, MAX_DAYS - d0) }, (_, i) => ymd(new Date(now - (d0 + i) * 86_400_000)));
    const lists = await Promise.all(days.map((day) => listKeys(env, `order:TV-${day}-`, ops)));         // las listas de unos días a la vez (cada una cuenta como operación)
    for (const l of lists) {
      if (!l.complete) truncated = true;
      const names = l.keys.sort().reverse();                                                          // dentro de un día, el contador más alto = el más reciente
      if (out.length >= MAX_MANAGER) { if (names.length) truncated = true; continue; }
      if (!(await readOrders(env, names, out, MAX_MANAGER, ops))) truncated = true;
    }
  }
  if (!truncated && out.length >= MAX_MANAGER) truncated = true;                                      // justo 300: puede haber más antiguos sin mirar
  return truncated;
}
