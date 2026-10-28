// [USERS] Usuarios en KV: clave user:<email>. Nunca se devuelve ni se guarda la contraseña en claro.
// Registro: { email, name, role, hash, salt, created, sid, sess_after }. `sid` (16 bytes aleatorios en hex) ata las sesiones a ESTE registro: borrar y volver a crear al usuario no resucita sus tokens;
// `sess_after` (ms) es el momento del último «cerrar sesión»: vale solo un token emitido después. Los usuarios antiguos sin `sid` lo reciben en su siguiente inicio de sesión correcto.
import { hashPassword, verifyPassword, passwordProblem } from './passwords.js';
import { isEmail, oneLine } from './validate.js';
import { randomHex } from './util.js';

/** Clave KV de un usuario: user:<correo en minúsculas>. */
export const userKey = (email) => `user:${String(email).trim().toLowerCase()}`;
/** Datos públicos del usuario, sin el hash ni la sal de la contraseña ni los datos de sesión. */
const pub = (u) => ({ email: u.email, name: u.name, role: u.role, created: u.created });
/** Identificador de sesión nuevo: 16 bytes aleatorios en hexadecimal (32 caracteres). */
export const newSid = () => randomHex(16);

/** Registro completo del usuario con ese correo, o null si no existe (o está dañado). */
export async function getUser(env, email) {
  const raw = await env.KV.get(userKey(email)); if (!raw) return null;
  try { const u = JSON.parse(raw); return u && typeof u === 'object' ? u : null; } catch { return null; }
}
/** Da de alta un usuario → { user } o { error, status? } si el correo, el rol o la contraseña no valen o ya existe. Contraseña: mínimo 12, sin la parte local del correo ni triviales. */
export async function createUser(env, { email, name, role, password } = {}) {
  if (typeof email !== 'string') return { error: 'Correo no válido' };
  email = email.trim().toLowerCase();
  if (!isEmail(email)) return { error: 'Correo no válido' };
  if (!['manager', 'client'].includes(role)) return { error: 'Rol no válido' };
  if (typeof password !== 'string') return { error: 'Contraseña no válida' };
  if (name != null && typeof name !== 'string') return { error: 'Nombre no válido' };
  const bad = passwordProblem(password, email); if (bad) return { error: bad };
  if (await env.KV.get(userKey(email))) return { error: 'Ya existe un usuario con ese correo', status: 409 };
  const { hash, salt } = await hashPassword(password);
  const u = { email, name: oneLine(name || email, 80) || email, role, hash, salt, created: new Date().toISOString(), sid: newSid(), sess_after: 0 };
  await env.KV.put(userKey(email), JSON.stringify(u));
  return { user: pub(u) };
}
/** Lista los usuarios (solo datos públicos), recorriendo todas las páginas de KV. */
export async function listUsers(env) {
  const out = []; let cursor;
  do { const r = await env.KV.list({ prefix: 'user:', cursor }); for (const k of r.keys) { const raw = await env.KV.get(k.name); if (raw) out.push(pub(JSON.parse(raw))); } cursor = r.list_complete ? undefined : r.cursor; } while (cursor);
  return out;
}
/** Borra el usuario con ese correo (si no existe, no hace nada). Sus sesiones dejan de valer al instante: un usuario recreado con el mismo correo recibe un `sid` nuevo. */
export const deleteUser = (env, email) => env.KV.delete(userKey(email));
/** Comprueba la contraseña contra el registro u (null = no existe: se gasta el mismo tiempo para no enumerar usuarios por tiempo) → true solo si el usuario existe y la contraseña es la suya. */
export async function verifyUser(u, password) {
  const ok = await verifyPassword(String(password ?? ''), u && u.hash ? u.hash : '00'.repeat(32), u && u.salt ? u.salt : '00'.repeat(16));
  return !!u && ok;
}
/** Comprueba credenciales. Devuelve el usuario público o null (mismo coste si no existe). */
export async function checkLogin(env, email, password) {
  const u = await getUser(env, email);
  return (await verifyUser(u, password)) ? pub(u) : null;
}
/** Garantiza que el registro tenga `sid` y `sess_after` (los usuarios antiguos no los traen) y lo guarda si hizo falta → el registro actualizado. */
export async function ensureSession(env, u) {
  if (typeof u.sid === 'string' && /^[0-9a-f]{32}$/.test(u.sid) && typeof u.sess_after === 'number') return u;
  const v = { ...u, sid: typeof u.sid === 'string' && /^[0-9a-f]{32}$/.test(u.sid) ? u.sid : newSid(), sess_after: Number(u.sess_after) || 0 };
  await env.KV.put(userKey(v.email), JSON.stringify(v));
  return v;
}
/** Cierra la sesión: `sess_after` = ahora, de modo que TODOS los tokens emitidos antes de este momento dejan de valer. → true si el usuario existe. */
export async function logoutUser(env, email, now = Date.now()) {
  const u = await getUser(env, email); if (!u) return false;
  await env.KV.put(userKey(u.email), JSON.stringify({ ...u, sess_after: now }));
  return true;
}
export { pub as publicUser };
