// [MESSAGES] Mensajes del formulario de contacto guardados en KV (retención de 400 días, como los pedidos: la caducidad la hace KV con expirationTtl, sin cron) y su listado/borrado acotados para el panel.
// Clave: msg:<fecha invertida>-<contador invertido>-<sufijo>, derivada del id CT-AAAAMMDD-NNNN-XXX. KV solo lista en orden ascendente; al invertir fecha y contador, UN list() devuelve primero los más recientes
// (1 operación de list + como mucho 300 de get —más los registros corruptos que se salten— por petición, sin recorrer todo el almacén). El id se puede volver a convertir en clave, así que borrar un mensaje es directo (sin índices aparte).
// Registro: { id, at, name, email, message, lang, ip, emailed:{ sent, reason:'sent'|'off'|'failed'|'skipped', error? } }. Son datos personales: solo los ve un gestor.

export const MSG_PREFIX = 'msg:';
export const MSG_TTL = { expirationTtl: 60 * 60 * 24 * 400 };
export const MSG_DEFAULT_LIMIT = 100, MSG_MAX_LIMIT = 300, CHUNK = 10, SLACK = 25;
const ID_RE = /^CT-(\d{8})-(\d{4,5})-([0-9A-Z]{3})$/;

/** Clave KV del mensaje con ese id (CT-AAAAMMDD-NNNN-XXX), o null si el id no tiene esa forma. Fecha y contador van invertidos (restados de 99999999 y 99999) y con ancho fijo para que el orden de claves sea el de más reciente primero. */
export function messageKey(id) {
  const m = ID_RE.exec(String(id)); if (!m) return null;
  return `${MSG_PREFIX}${String(99_999_999 - Number(m[1])).padStart(8, '0')}-${String(99_999 - Number(m[2])).padStart(5, '0')}-${m[3]}`;
}
/** Guarda (o sobrescribe) el registro de un mensaje con caducidad de 400 días; lanza si KV no deja escribir. */
export async function putMessage(env, record) { await env.KV.put(messageKey(record.id), JSON.stringify(record), MSG_TTL); }
/** True si ya hay un mensaje guardado con ese id. */
export async function messageExists(env, id) { return (await env.KV.get(messageKey(id))) !== null; }
/** Borra el mensaje con ese id → true si existía, false si no existe (o el id no es válido). */
export async function deleteMessage(env, id) {
  const key = messageKey(id); if (!key || (await env.KV.get(key)) === null) return false;
  await env.KV.delete(key); return true;
}

/** Texto de un campo del registro, o '' si no es una cadena (un registro dañado nunca rompe el listado). */
const str = (v) => (typeof v === 'string' ? v : '');
/** Registro de KV (texto JSON) → vista para el gestor { id, at, name, email, message, lang, ip, emailed:{ sent, reason, error? } }, o null si falta, no es JSON o no trae id y fecha. */
function view(raw) {
  let o; try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || typeof o.at !== 'string') return null;
  const e = o.emailed && typeof o.emailed === 'object' ? o.emailed : {};
  return { id: o.id, at: o.at, name: str(o.name), email: str(o.email), message: str(o.message), lang: str(o.lang), ip: str(o.ip), emailed: { sent: e.sent === true, reason: str(e.reason), ...(str(e.error) ? { error: str(e.error) } : {}) } };
}
/** `limit` pedido en la URL (texto o número) → entero entre 1 y 300; ausente o ilegible = 100. */
export function messageLimit(raw) {
  const n = raw == null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(MSG_MAX_LIMIT, Math.max(1, Math.floor(n))) : MSG_DEFAULT_LIMIT;
}
/** Nombres de las `fetch` claves de mensaje más recientes → { names, complete } (complete = KV ya no tiene más); sigue el cursor si devuelve páginas más cortas (como mucho 8 páginas). */
async function newestKeys(env, fetch) {
  const names = []; let cursor, complete = false;
  for (let i = 0; i < 8 && names.length < fetch; i++) {
    const r = await env.KV.list({ prefix: MSG_PREFIX, limit: fetch - names.length, cursor });
    for (const k of r.keys) names.push(k.name);
    if (r.list_complete || !r.cursor) { complete = true; break; }
    cursor = r.cursor;
  }
  return { names, complete };
}
/**
 * Mensajes para el panel (solo gestores) → { items (más recientes primero, hasta `limit`, 1..300), truncated }. Un list de KV (con unas claves de margen para los registros corruptos) + un get por mensaje, en grupos de 10:
 * un registro corrupto se omite y el hueco se rellena con el siguiente. truncated = hay más mensajes de los devueltos, o KV cortó la lectura a medias (p. ej. el tope de subconsultas del plan gratuito: se devuelve
 * lo leído); si falla desde el principio, lanza.
 */
export async function listMessages(env, { limit } = {}) {
  const want = messageLimit(limit), { names, complete } = await newestKeys(env, want + 1 + SLACK), items = []; let consumed = 0, truncated = false;
  try {
    while (items.length < want && consumed < names.length) {
      const part = names.slice(consumed, consumed + Math.min(CHUNK, want - items.length)); consumed += part.length;
      for (const raw of await Promise.all(part.map((n) => env.KV.get(n)))) { const v = raw ? view(raw) : null; if (v) items.push(v); }
    }
    truncated = consumed < names.length || !complete;
  } catch (e) { if (!items.length) throw e; console.error('Listado de mensajes cortado por KV:', e && e.message); truncated = true; }
  items.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return { items, truncated };
}
