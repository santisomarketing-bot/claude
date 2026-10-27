// [AUTH] Contraseñas PBKDF2-HMAC-SHA256 (100 000 it., sal de 16 B) y sesiones firmadas HMAC-SHA256 sin estado en servidor.
// Patrón de whynot-sites/workers/admin (users.js). Roles: 'manager' (todo) y 'client' (solo lo suyo).
// Token: base64url(payload).base64url(firma). payload = { sub:email, role, name, exp }. Caduca a los 7 días.
import { timingSafeEqual, toB64Url, fromB64Url, toHex, fromHex } from './util.js';

const ITER = 100_000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const te = new TextEncoder();

async function pbkdf2(password, salt) {
  const k = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, k, 256));
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: toHex(await pbkdf2(password, salt)), salt: toHex(salt) };
}
export async function verifyPassword(password, hashHex, saltHex) {
  return timingSafeEqual(toHex(await pbkdf2(password, fromHex(saltHex))), hashHex);
}
async function hmac(bytes, secret) {
  const k = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes));
}
export async function signSession({ sub, role, name }, secret, ttlMs = TTL_MS, now = Date.now()) {
  const payload = te.encode(JSON.stringify({ sub, role, name, exp: now + ttlMs }));
  return `${toB64Url(payload)}.${toB64Url(await hmac(payload, secret))}`;
}
export async function verifySession(token, secret, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !secret) return null;
  let payload, sig;
  try { payload = fromB64Url(parts[0]); sig = fromB64Url(parts[1]); } catch { return null; }
  if (!timingSafeEqual(toHex(await hmac(payload, secret)), toHex(sig))) return null;
  let p; try { p = JSON.parse(new TextDecoder().decode(payload)); } catch { return null; }
  if (typeof p.exp !== 'number' || now > p.exp || !['manager', 'client'].includes(p.role) || typeof p.sub !== 'string') return null;
  return { sub: p.sub, role: p.role, name: p.name || p.sub };
}
const bearer = (request) => (/^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '') || [])[1] || null;
/** Quién llama: {role:'manager'|'client', sub, name, master?} o null. ADMIN_API_TOKEN actúa como manager (scripts/CI). */
export async function authenticate(request, env) {
  const t = bearer(request); if (!t) return null;
  if (env.ADMIN_API_TOKEN && timingSafeEqual(t, env.ADMIN_API_TOKEN)) return { role: 'manager', sub: 'master', name: 'master', master: true };
  return verifySession(t, env.SESSION_SECRET);
}
export const requireRole = (who, ...roles) => !!who && roles.includes(who.role);
