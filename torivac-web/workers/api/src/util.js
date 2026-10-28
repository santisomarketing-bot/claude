// [UTIL] Respuestas JSON, errores de la API, escape HTML, comparación de secretos en tiempo constante, codificaciones, clave de límite por visitante (ipKey) y lectura acotada del cuerpo.
const te = new TextEncoder();

/** Error con estado HTTP cuyo mensaje SÍ se puede mostrar a quien llama; cualquier otra excepción se responde como «Error interno» (sin texto interno). */
export class ApiError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); } }

/** Respuesta JSON con el estado y las cabeceras indicados; nunca se cachea (no-store). */
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
/** Escapa & < > y comillas para incrustar un valor en HTML; null o undefined dan una cadena vacía. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Bytes bien formados de un texto UTF-8. */
export const utf8 = (s) => te.encode(String(s));
/** SHA-256 de un texto (UTF-8) → Uint8Array de 32 bytes. */
export const sha256 = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(s)));
/** SHA-256 de un texto en hexadecimal minúsculas (64 caracteres). */
export const sha256Hex = async (s) => toHex(await sha256(s));
/** Compara dos textos en tiempo constante TAMBIÉN en longitud: compara sus resúmenes SHA-256, así que no sale antes si las longitudes difieren. */
export async function timingSafeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let d = 0; for (let i = 0; i < 32; i++) d |= x[i] ^ y[i];
  return d === 0;
}
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
/** Identificador aleatorio de n bytes en hexadecimal (p. ej. el id de un error interno: 4 bytes = 8 caracteres). */
export const randomHex = (n) => toHex(crypto.getRandomValues(new Uint8Array(n)));
/** IP del cliente que informa Cloudflare (CF-Connecting-IP); 0.0.0.0 si falta. Es la IP COMPLETA: para limitar usa ipKey. */
export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || '0.0.0.0';

// ───────────────────────────────────────── [IPKEY] clave de límite por visitante
/** «a.b.c.d» (cuatro octetos decimales 0–255, sin ceros a la izquierda) → [a, b, c, d]; null si no es una IPv4 válida. */
function parseV4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s); if (!m) return null;
  const o = m.slice(1).map((x) => (x.length > 1 && x[0] === '0' ? NaN : Number(x)));
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}
/** IPv6 (con «::», IPv4 final y «%zona» opcionales) → 8 grupos de 16 bits; null si no es válida. */
function parseV6(raw) {
  let s = raw; const z = s.indexOf('%'); if (z >= 0) s = s.slice(0, z);
  if (!s.includes(':')) return null;
  const lc = s.lastIndexOf(':'), tail = s.slice(lc + 1);
  if (tail.includes('.')) {                                                   // IPv4 incrustada («::ffff:203.0.113.5»): pasa a dos grupos hexadecimales
    const v4 = parseV4(tail); if (!v4) return null;
    s = `${s.slice(0, lc + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const dbl = s.indexOf('::'); if (dbl !== s.lastIndexOf('::')) return null;  // más de un «::» (también «:::»)
  let groups;
  if (dbl >= 0) {
    const head = s.slice(0, dbl), rest = s.slice(dbl + 2), h = head ? head.split(':') : [], r = rest ? rest.split(':') : [];
    if (h.length + r.length > 7) return null;
    groups = [...h, ...Array(8 - h.length - r.length).fill('0'), ...r];
  } else groups = s.split(':');
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}
/**
 * Clave de límite por visitante: IPv4 tal cual; IPv6 → su /64 en formato canónico «xxxx:xxxx:xxxx:xxxx::/64» (quien controla una dirección controla todo su /64: sin agrupar,
 * cada dirección sería un cubo nuevo); IPv4 escrita como IPv6 («::ffff:a.b.c.d» o «::ffff:hhhh:hhhh») → esa IPv4; ilegible o vacía → «0». Casos compartidos: shared/ip-key.fixtures.json.
 */
export function ipKey(ip) {
  const s = String(ip ?? '').trim();
  const v4 = parseV4(s); if (v4) return v4.join('.');
  const g = parseV6(s); if (!g) return '0';
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.');
  return `${g.slice(0, 4).map((x) => x.toString(16).padStart(4, '0')).join(':')}::/64`;
}

// ───────────────────────────────────────── [BODY] lectura del cuerpo con tope real
/** True si el JSON `text` no anida más de `max` niveles de [] o {} (recorrido lineal; las cadenas largas se saltan con indexOf, sin mirarlas carácter a carácter). */
export function jsonDepthOk(text, max = 32) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 34) {                                                           // «"»: salta la cadena entera (cuidando las comillas escapadas)
      let j = i + 1;
      for (;;) {
        j = text.indexOf('"', j); if (j < 0) return true;                     // cadena sin cerrar: JSON.parse dirá que no es válido
        let k = j - 1, bs = 0; while (k > i && text.charCodeAt(k) === 92) { bs++; k--; }
        if (bs % 2 === 0) break; j++;
      }
      i = j;
    } else if (c === 91 || c === 123) { if (++depth > max) return false; }
    else if (c === 93 || c === 125) depth--;
  }
  return true;
}
/** Lee el cuerpo de la petición contando los bytes que llegan de verdad (no basta Content-Length: con transferencia por trozos no existe); más de maxBytes → null. */
export async function readBody(request, maxBytes) {
  if (Number(request.headers.get('Content-Length') || 0) > maxBytes) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader(), chunks = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
  } catch { return null; }
  const out = new Uint8Array(total); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
/** Cuerpo JSON de la petición, o null si supera maxBytes (contados de verdad), anida más de 32 niveles o no es JSON válido. */
export async function readJson(request, maxBytes = 6_000_000) {
  const bytes = await readBody(request, maxBytes); if (!bytes || !bytes.length) return null;
  const text = new TextDecoder().decode(bytes);
  if (!jsonDepthOk(text, 32)) return null;
  try { return JSON.parse(text); } catch { return null; }
}
