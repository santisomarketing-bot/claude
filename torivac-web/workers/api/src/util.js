// [UTIL] Respuestas JSON, escape HTML, comparación en tiempo constante, codificaciones.

/** Respuesta JSON con el estado y las cabeceras indicados; nunca se cachea (no-store). */
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
/** Escapa & < > y comillas para incrustar un valor en HTML; null o undefined dan una cadena vacía. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Compara dos textos en tiempo constante (false si su longitud difiere) para no revelar por tiempo dónde difieren. */
export function timingSafeEqual(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
/** Bytes → base64url sin relleno. */
export const toB64Url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
/** base64url (con o sin relleno) → Uint8Array. */
export const fromB64Url = (str) => { const p = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); };
/** Bytes → texto hexadecimal en minúsculas. */
export const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
/** Texto hexadecimal → Uint8Array. */
export const fromHex = (hex) => { const o = new Uint8Array(hex.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i * 2, 2), 16); return o; };
/** Redondea a 2 decimales (1.005 → 1.01). */
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** IP del cliente que informa Cloudflare (CF-Connecting-IP); 0.0.0.0 si falta. */
export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || '0.0.0.0';
/** Cuerpo JSON de la petición, o null si supera maxBytes (por Content-Length) o no es JSON válido. */
export async function readJson(request, maxBytes = 6_000_000) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > maxBytes) return null;
  try { return await request.json(); } catch { return null; }
}
