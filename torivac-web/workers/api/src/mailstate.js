// [MAILSTATE] Último intento de envío de correo (clave KV mail:last, solo el último, igual que prices:sync) y limpieza de secretos en los textos de error que ven los gestores.
// mail:last = { at, kind:'contact'|'order'|'test', ok, reason:'sent'|'off'|'failed'|'skipped', error? }. No lleva datos del visitante (ni correo, ni nombre, ni mensaje).
import { oneLine } from './validate.js';

export const KEY_MAIL_LAST = 'mail:last';
/** Nombres de ajuste cuyo valor es secreto: sus valores exactos se tachan de cualquier texto de error. */
const SECRET_NAME = /KEY|SECRET|TOKEN|PASS|ACCOUNT|AUTH/i;
/** Formas típicas de clave o token (Bearer …, api-key: …, re_…, sk-…, xkeysib-…, cadenas opacas de 32 o más caracteres) que se tachan aunque no sean ninguna del entorno. */
const SECRET_SHAPES = [
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi, '$1 ***'],
  [/\b(api[-_ ]?key|apikey|token|secret|password|passwd|authorization)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2***'],
  [/\bre_[A-Za-z0-9]{16,}/g, '***'],
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{6,}/g, '***'],
  [/\bx(?:keysib|smtpsib)-[A-Za-z0-9-]{16,}/g, '***'],
  [/\b[A-Za-z0-9_-]{32,}\b/g, '***'],
];

/** Texto de error de UNA línea, sin secretos y de como mucho `max` caracteres: tacha los valores exactos de los secretos del entorno (claves, tokens, contraseñas) y las formas típicas de clave. */
export function scrub(env, text, max = 160) {
  let s = oneLine(text, 2000);
  for (const [k, v] of Object.entries(env || {})) if (SECRET_NAME.test(k) && typeof v === 'string' && v.length >= 6) s = s.split(v).join('***');
  for (const [re, to] of SECRET_SHAPES) s = s.replace(re, to);
  return s.slice(0, max).trimEnd();
}
/** Anota en mail:last el resultado del último intento de envío (también el fallido, el omitido y el de un controlador apagado); sobrescribe. Un fallo al anotarlo nunca tapa el resultado real del envío. */
export async function recordMail(env, kind, r, nowMs = Date.now()) {
  try {
    const state = { at: new Date(nowMs).toISOString(), kind, ok: !!r.ok, reason: String(r.reason || (r.ok ? 'sent' : 'failed')), ...(r.error ? { error: scrub(env, r.error) } : {}) };
    await env.KV.put(KEY_MAIL_LAST, JSON.stringify(state));
  } catch (e) { console.error('No se pudo anotar el último intento de correo', e && e.message); }
}
/** Último intento de envío guardado en mail:last → { at, kind, ok, reason, error? }, o null si no hay ninguno o está dañado. */
export async function readLast(env) {
  try {
    const o = JSON.parse((await env.KV.get(KEY_MAIL_LAST)) || 'null');
    if (!o || typeof o !== 'object' || typeof o.at !== 'string' || typeof o.kind !== 'string') return null;
    return { at: o.at, kind: o.kind, ok: o.ok === true, reason: String(o.reason ?? ''), ...(typeof o.error === 'string' && o.error ? { error: o.error } : {}) };
  } catch { return null; }
}
