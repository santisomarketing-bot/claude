// [AUTH] Sesiones firmadas HMAC-SHA256 sin estado en el token, pero LIGADAS al registro del usuario, y autenticación de cada petición.
// Patrón de whynot-sites/workers/admin (users.js). Roles: 'manager' (todo) y 'client' (solo lo suyo).
// Token: base64url(payload).base64url(firma). payload = { sub:email, iat, exp, sid }. Caduca a las 24 h. El ROL no va en el token: sale SIEMPRE del registro del usuario.
// Al verificar: firma correcta, no caducado, el usuario existe, payload.sid === user.sid y payload.iat > user.sess_after (cerrar sesión invalida todos los tokens anteriores).
// Los tokens de antes de este formato (sin sid) no valen. Secretos: SESSION_SECRET y ADMIN_API_TOKEN deben tener ≥ 32 caracteres (SESSION_SECRET, además, sin «CAMBIA-ESTO»); si no, esa función queda desactivada.
import { timingSafeEqual, toB64Url, fromB64Url, utf8 } from './util.js';
import { getUser } from './users.js';
export { hashPassword, verifyPassword } from './passwords.js';

const TTL_MS = 24 * 60 * 60 * 1000;
export const MIN_SECRET = 32;

/** True si el secreto es una cadena de al menos `min` caracteres y no es el marcador de ejemplo («CAMBIA-ESTO»). */
export const secretOk = (s, min = MIN_SECRET) => typeof s === 'string' && s.length >= min && !s.includes('CAMBIA-ESTO');
/** Firma HMAC-SHA256 de bytes con la clave secret; devuelve Uint8Array. */
async function hmac(bytes, secret) {
  const k = await crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes));
}
/** Crea el token de sesión «datos.firma» (base64url) con { sub, iat, exp, sid }; caduca a los ttlMs (24 horas por defecto). Con un secreto inseguro lanza Error. */
export async function signSession({ sub, sid }, secret, ttlMs = TTL_MS, now = Date.now()) {
  if (!secretOk(secret)) throw new Error('SESSION_SECRET inseguro');
  const payload = utf8(JSON.stringify({ sub, iat: now, exp: now + ttlMs, sid }));
  return `${toB64Url(payload)}.${toB64Url(await hmac(payload, secret))}`;
}
/** Comprueba firma, caducidad y forma de un token de sesión → { sub, iat, exp, sid }, o null si no es válido (o el secreto es inseguro). No mira el registro del usuario: eso lo hace authenticate. */
export async function verifySession(token, secret, now = Date.now()) {
  if (!secretOk(secret)) return null;
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  let payload, sig;
  try { payload = fromB64Url(parts[0]); sig = fromB64Url(parts[1]); } catch { return null; }
  if (!(await timingSafeEqual(toB64Url(await hmac(payload, secret)), toB64Url(sig)))) return null;
  let p; try { p = JSON.parse(new TextDecoder().decode(payload)); } catch { return null; }
  if (!p || typeof p !== 'object' || typeof p.sub !== 'string' || typeof p.sid !== 'string' || !/^[0-9a-f]{32}$/.test(p.sid)) return null;      // sin sid (token antiguo) = inválido
  if (typeof p.iat !== 'number' || typeof p.exp !== 'number' || now > p.exp) return null;
  return { sub: p.sub, iat: p.iat, exp: p.exp, sid: p.sid };
}
/** Token de la cabecera «Authorization: Bearer …» de la petición, o null si no viene. */
export const bearer = (request) => (/^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '') || [])[1] || null;
/**
 * Quién llama: {role:'manager'|'client', sub, name, master?} o null. ADMIN_API_TOKEN (≥ 32 caracteres) actúa como manager (scripts/CI; se compara por resúmenes SHA-256, en tiempo constante también
 * en la longitud). Una sesión solo vale si su usuario sigue existiendo, el `sid` coincide con el del registro y se emitió después del último «cerrar sesión»; el rol sale del registro, no del token.
 */
export async function authenticate(request, env, { now = Date.now() } = {}) {
  const t = bearer(request); if (!t) return null;
  if (secretOk(env.ADMIN_API_TOKEN) && (await timingSafeEqual(t, env.ADMIN_API_TOKEN))) return { role: 'manager', sub: 'master', name: 'master', master: true };
  const s = await verifySession(t, env.SESSION_SECRET, now); if (!s) return null;
  const u = await getUser(env, s.sub);
  if (!u || typeof u.sid !== 'string' || !(await timingSafeEqual(s.sid, u.sid))) return null;      // usuario borrado o recreado (otro sid): el token no vale
  if (!(s.iat > (Number(u.sess_after) || 0))) return null;                                          // emitido antes de cerrar sesión
  if (!['manager', 'client'].includes(u.role)) return null;
  return { sub: u.email, role: u.role, name: u.name || u.email };
}
/** True si hay una persona autenticada (who) y su rol es uno de los indicados. */
export const requireRole = (who, ...roles) => !!who && roles.includes(who.role);
