// [USERS] Usuarios en KV: clave user:<email>. Nunca se devuelve ni se guarda la contraseña en claro.
import { hashPassword, verifyPassword } from './auth.js';
/** Clave KV de un usuario: user:<correo en minúsculas>. */
const key = (email) => `user:${String(email).trim().toLowerCase()}`;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Datos públicos del usuario, sin el hash ni la sal de la contraseña. */
const pub = (u) => ({ email: u.email, name: u.name, role: u.role, created: u.created });

/** Da de alta un usuario → { user } o { error, status? } si el correo, el rol o la contraseña no valen o ya existe. */
export async function createUser(env, { email, name, role, password }) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Correo no válido' };
  if (!['manager', 'client'].includes(role)) return { error: 'Rol no válido' };
  if (String(password || '').length < 10) return { error: 'La contraseña necesita al menos 10 caracteres' };
  if (await env.KV.get(key(email))) return { error: 'Ya existe un usuario con ese correo', status: 409 };
  const { hash, salt } = await hashPassword(password);
  const u = { email, name: String(name || email).slice(0, 80), role, hash, salt, created: new Date().toISOString() };
  await env.KV.put(key(email), JSON.stringify(u));
  return { user: pub(u) };
}
/** Lista los usuarios (solo datos públicos), recorriendo todas las páginas de KV. */
export async function listUsers(env) {
  const out = []; let cursor;
  do { const r = await env.KV.list({ prefix: 'user:', cursor }); for (const k of r.keys) { const raw = await env.KV.get(k.name); if (raw) out.push(pub(JSON.parse(raw))); } cursor = r.list_complete ? undefined : r.cursor; } while (cursor);
  return out;
}
/** Borra el usuario con ese correo (si no existe, no hace nada). */
export const deleteUser = (env, email) => env.KV.delete(key(email));
/** Comprueba credenciales. Devuelve el usuario público o null (mismo coste si no existe: evita enumerar usuarios por tiempo). */
export async function checkLogin(env, email, password) {
  const raw = await env.KV.get(key(email));
  const u = raw ? JSON.parse(raw) : null;
  const ok = await verifyPassword(String(password || ''), u ? u.hash : '00'.repeat(32), u ? u.salt : '00'.repeat(16));
  return u && ok ? pub(u) : null;
}
