// [UTIL] Respuestas JSON, escape HTML, comparación en tiempo constante, codificaciones.
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function timingSafeEqual(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export const toB64Url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const fromB64Url = (str) => { const p = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); };
export const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
export const fromHex = (hex) => { const o = new Uint8Array(hex.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i * 2, 2), 16); return o; };
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || '0.0.0.0';
export async function readJson(request, maxBytes = 6_000_000) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > maxBytes) return null;
  try { return await request.json(); } catch { return null; }
}
