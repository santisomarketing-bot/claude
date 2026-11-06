// [USERS] Usuarios en KV: clave user:<email>. Nunca se devuelve ni se guarda la contraseña en claro.
// Registro: { email, name, role, tier?, last_login?, hash, salt, created, sid, sess_after }. Roles: manager, client (el PROPIETARIO) y customer (cliente con cuenta, de solo lectura; docs/PRECIOS-Y-CLIENTES.md).
// `tier` (vip|vip5|vip10|normal) solo existe en las cuentas customer (por defecto normal): la categoría de precio, que se lee del registro en cada petición.
// `sid` (16 bytes aleatorios en hex) ata las sesiones a ESTE registro: borrar y volver a crear al usuario no resucita sus tokens;
// `sess_after` (ms) es el momento del último «cerrar sesión»: vale solo un token emitido después. Los usuarios antiguos sin `sid` lo reciben en su siguiente inicio de sesión correcto.
import { hashPassword, verifyPassword, passwordProblem } from './passwords.js';
import { isEmail, oneLine } from './validate.js';
import { randomHex } from './util.js';
import { isTier } from './prices.js';

/** Clave KV de un usuario: user:<correo en minúsculas>. */
export const userKey = (email) => `user:${String(email).trim().toLowerCase()}`;
/** Datos públicos del usuario, sin el hash ni la sal de la contraseña ni los datos de sesión (y sin la categoría de precio: eso lo ve el equipo, no la persona). */
const pub = (u) => ({ email: u.email, name: u.name, role: u.role, created: u.created });
/** Categoría de precio de un registro de cliente: su `tier` si es una de las cuatro, y si falta o está dañado, normal. */
export const tierOf = (u) => (isTier(u && u.tier) ? u.tier : 'normal');
/** Datos del usuario para el equipo (GET/POST /api/users): como pub, más la categoría en las cuentas customer. */
const adminView = (u) => (u.role === 'customer' ? { ...pub(u), tier: tierOf(u) } : pub(u));
/** Ficha de un cliente para el equipo: { email, name, tier, created, last_login? }. */
const customerView = (u) => ({ email: u.email, name: u.name, tier: tierOf(u), created: u.created, ...(typeof u.last_login === 'string' ? { last_login: u.last_login } : {}) });
/** Identificador de sesión nuevo: 16 bytes aleatorios en hexadecimal (32 caracteres). */
export const newSid = () => randomHex(16);

/** Registro completo del usuario con ese correo, o null si no existe (o está dañado). */
export async function getUser(env, email) {
  const raw = await env.KV.get(userKey(email)); if (!raw) return null;
  try { const u = JSON.parse(raw); return u && typeof u === 'object' ? u : null; } catch { return null; }
}
/** Da de alta un usuario → { user } o { error, status? } si el correo, el rol, la categoría o la contraseña no valen o ya existe. Contraseña: mínimo 12, sin la parte local del correo ni triviales. `tier` solo cuenta para el rol customer (por defecto normal). */
export async function createUser(env, { email, name, role, password, tier } = {}) {
  if (typeof email !== 'string') return { error: 'Correo no válido' };
  email = email.trim().toLowerCase();
  if (!isEmail(email)) return { error: 'Correo no válido' };
  if (!['manager', 'client', 'customer'].includes(role)) return { error: 'Rol no válido' };
  if (role === 'customer' && tier != null && !isTier(tier)) return { error: 'Categoría no válida' };
  if (typeof password !== 'string') return { error: 'Contraseña no válida' };
  if (name != null && typeof name !== 'string') return { error: 'Nombre no válido' };
  const bad = passwordProblem(password, email); if (bad) return { error: bad };
  if (await env.KV.get(userKey(email))) return { error: 'Ya existe un usuario con ese correo', status: 409 };
  const { hash, salt } = await hashPassword(password);
  const u = { email, name: oneLine(name || email, 80) || email, role, ...(role === 'customer' ? { tier: tier == null ? 'normal' : tier } : {}), hash, salt, created: new Date().toISOString(), sid: newSid(), sess_after: 0 };
  await env.KV.put(userKey(email), JSON.stringify(u));
  return { user: adminView(u) };
}
/** Registros completos de todos los usuarios, recorriendo todas las páginas de KV (los dañados se saltan). */
async function allRecords(env) {
  const out = []; let cursor;
  do { const r = await env.KV.list({ prefix: 'user:', cursor }); for (const k of r.keys) { const raw = await env.KV.get(k.name); if (!raw) continue; try { const u = JSON.parse(raw); if (u && typeof u === 'object') out.push(u); } catch { /* registro dañado: se salta */ } } cursor = r.list_complete ? undefined : r.cursor; } while (cursor);
  return out;
}
/** Lista los usuarios (solo datos públicos; los de rol customer, además con su categoría), recorriendo todas las páginas de KV. */
export async function listUsers(env) { return (await allRecords(env)).map(adminView); }
/** Lista las cuentas de cliente (rol customer): [{ email, name, tier, created, last_login? }]. */
export async function listCustomers(env) { return (await allRecords(env)).filter((u) => u.role === 'customer').map(customerView); }
/** Registro de la cuenta customer con ese correo, o null si no existe o es de otro rol (esas cuentas no se tocan desde /api/customers). */
export async function getCustomer(env, email) { const u = await getUser(env, email); return u && u.role === 'customer' ? u : null; }
/** Cambia la categoría y/o el nombre de un cliente → { customer } o { error, status? } (404 si no existe o no es customer; 400 si algo no vale). `changes` solo lleva las claves que vinieron en la petición: { tier?, name? }. */
export async function updateCustomer(env, email, changes = {}) {
  const u = await getCustomer(env, email); if (!u) return { error: 'No existe ese cliente', status: 404 };
  const next = { ...u };
  if (Object.hasOwn(changes, 'tier')) { if (!isTier(changes.tier)) return { error: 'Categoría no válida' }; next.tier = changes.tier; }
  if (Object.hasOwn(changes, 'name')) {
    const nm = typeof changes.name === 'string' ? oneLine(changes.name, 80) : ''; if (!nm) return { error: 'Nombre no válido' };
    next.name = nm;
  }
  if (!Object.hasOwn(changes, 'tier') && !Object.hasOwn(changes, 'name')) return { error: 'Indica la categoría o el nombre' };
  await env.KV.put(userKey(u.email), JSON.stringify(next));
  return { customer: customerView(next) };
}
/** Cambia la contraseña de un cliente y cierra todas sus sesiones (nuevo `sid` y `sess_after` = ahora) → {} o { error, status? }. Mismas reglas de contraseña que el alta. */
export async function setCustomerPassword(env, email, password, now = Date.now()) {
  const u = await getCustomer(env, email); if (!u) return { error: 'No existe ese cliente', status: 404 };
  if (typeof password !== 'string') return { error: 'Contraseña no válida' };
  const bad = passwordProblem(password, u.email); if (bad) return { error: bad };
  const { hash, salt } = await hashPassword(password);
  await env.KV.put(userKey(u.email), JSON.stringify({ ...u, hash, salt, sid: newSid(), sess_after: now }));
  return {};
}
/** Borra la cuenta de un cliente (sus sesiones dejan de valer al instante; sus presupuestos se conservan) → {} o { error, status:404 } si no existe o no es customer. */
export async function deleteCustomer(env, email) {
  const u = await getCustomer(env, email); if (!u) return { error: 'No existe ese cliente', status: 404 };
  await env.KV.delete(userKey(u.email));
  return {};
}
/** Anota el último acceso (ISO) de una cuenta customer; vuelve a leer el registro para no pisar un cambio de categoría hecho mientras tanto. Un fallo no impide entrar. */
export async function touchLogin(env, email, nowMs) {
  try { const u = await getCustomer(env, email); if (u) await env.KV.put(userKey(u.email), JSON.stringify({ ...u, last_login: new Date(nowMs).toISOString() })); }
  catch (e) { console.error('No se pudo anotar el último acceso', e && e.message); }
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
