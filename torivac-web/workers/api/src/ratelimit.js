// [RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.
// La clave NUNCA lleva el identificador en claro: rl:<cubo>:<SHA-256 hex (32 primeros)> → longitud acotada (KV admite 512 bytes), sin correos ni IP en las claves y sin eco de la clave en los errores.
// Cada registro se guarda con expirationTtl (KV lo borra solo al caducar); además, purgeExpired limpia «al vuelo» lo caducado que pudiera quedar.
import { sha256Hex } from './util.js';

/** Clave KV del limitador: rl:<cubo>:<32 primeros hex del SHA-256 del identificador>. */
export async function rlKey(bucket, id) { return `rl:${bucket}:${(await sha256Hex(id)).slice(0, 32)}`; }
/** Lee el registro { count, resetAt } vigente del cubo, o null si no hay o ya caducó. */
async function read(env, key, now) {
  const raw = await env.KV.get(key); if (!raw) return null;
  try { const r = JSON.parse(raw); return r && typeof r.count === 'number' && r.resetAt > now ? r : null; } catch { return null; }
}
/** Cuenta una acción en el cubo (ventana fija de windowMs desde la primera) → { allowed, remaining, resetAt, count }; allowed es false cuando se supera `max`. */
export async function hit(env, bucket, id, { max = 5, windowMs = 10 * 60 * 1000, now = Date.now() } = {}) {
  const key = await rlKey(bucket, id);
  const r = (await read(env, key, now)) || { count: 0, resetAt: now + windowMs };
  r.count += 1;
  await env.KV.put(key, JSON.stringify(r), { expirationTtl: Math.max(60, Math.ceil((r.resetAt - now) / 1000)) });
  return { allowed: r.count <= max, remaining: Math.max(0, max - r.count), resetAt: r.resetAt, count: r.count };
}
/** True si el cubo ya está en el máximo dentro de su ventana vigente. Solo lee: sirve para contadores que cuentan únicamente los fallos (se llama a hit tras cada fallo). */
export async function isBlocked(env, bucket, id, { max, now = Date.now() }) {
  const r = await read(env, await rlKey(bucket, id), now);
  return !!r && r.count >= max;
}
/** Pone a cero el cubo (p. ej. tras un acceso correcto). */
export async function reset(env, bucket, id) { await env.KV.delete(await rlKey(bucket, id)); }
/** Borra hasta `limit` registros rl:* caducados (por su dato de caducidad en KV o, si no lo trae, por su resetAt) → cuántos borró. Se llama «al vuelo» en 1 de cada 50 peticiones. */
export async function purgeExpired(env, { now = Date.now(), limit = 200 } = {}) {
  const page = await env.KV.list({ prefix: 'rl:', limit });
  let deleted = 0;
  for (const k of page.keys) {
    let expired;
    if (typeof k.expiration === 'number') expired = k.expiration * 1000 <= now;
    else { try { const v = JSON.parse(await env.KV.get(k.name)); expired = !v || !(v.resetAt > now); } catch { expired = true; } }
    if (expired) { await env.KV.delete(k.name); deleted++; }
  }
  return deleted;
}
