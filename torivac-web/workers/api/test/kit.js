// Ayudas de las pruebas de seguridad: llamadas al Worker con IP, token y hora simulados, altas e inicios de sesión, pedidos de ejemplo y un buzón de Resend simulado.
import api from '../src/index.js';
import { createUser } from '../src/users.js';
import { req, mkEnv, PRICES } from './helpers.js';

/** Contraseñas de PRUEBA que cumplen la política de contraseñas nuevas (≥ 12, sin la parte local del correo, nada trivial). */
export const PW = { manager: 'Manager-Clave-2026', client: 'Cliente-Clave-2026' };
/** Llama al Worker: ip → CF-Connecting-IP, token → Bearer, origin, deps (now, fetchImpl, rand, purge…; sin purga aleatoria por defecto) → Response. */
export const call = (env, path, { method = 'GET', body, headers = {}, ip, token, origin, deps = {} } = {}) =>
  api.fetch(req(path, { method, body, headers: { ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), ...headers } }), env, {}, { purge: false, ...deps });
/** Da de alta un usuario y devuelve su inicio de sesión real { token, user, email } (por la API, desde la IP indicada). */
export async function signIn(env, email, role = 'client', { password = PW[role], ip = '198.51.100.250', name = 'Usuario ' + role } = {}) {
  const c = await createUser(env, { email, name, role, password });
  if (c.error) throw new Error('alta: ' + c.error);
  const r = await call(env, '/api/auth/login', { method: 'POST', body: { email, password }, ip });
  const j = await r.json(); if (!j.ok) throw new Error('login: ' + JSON.stringify(j));
  return { token: j.token, user: j.user, email, password };
}
/** Buzón de Resend simulado: fetchImpl guarda cada correo enviado en `sent` (cuerpo JSON ya leído) y responde 200. */
export function mailbox({ fail = false } = {}) {
  const sent = [];
  /** Resend simulado: guarda el correo, o responde 403 si la bandeja está configurada para fallar. */
  const fetchImpl = async (u, o) => { if (fail) return new Response('x', { status: 403 }); sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'm' + sent.length }), { status: 200 }); };
  return { sent, fetchImpl };
}
/** PDF mínimo en base64 (empieza por «%PDF-»). */
export const PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n').toString('base64');
export const REF = 'P16633', REF2 = 'P8339';
/** Pedido válido de ejemplo con referencias REALES del catálogo generado; over sustituye campos de primer nivel. */
export const order = (over = {}) => ({ customer: { name: 'Ana Pérez', company: 'ACME', email: 'victima@ejemplo.org', phone: '600', notes: 'urgente', privacy: true }, lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 3 }], lang: 'es', ...over });
/** Entorno de pruebas con Resend configurado, precios vigentes de ejemplo (P16633 y P8339) y los extras indicados. */
export async function orderEnv(extra = {}) {
  const env = mkEnv({ RESEND_API_KEY: 're_test', ...extra });
  await env.KV.put('prices:current', JSON.stringify({ ...PRICES, items: { [REF]: { p: 67.65 }, [REF2]: { p: 15.82, t: [[10, 15.1]] } } }));
  return env;
}
/** Todas las claves de KV (ordenadas) que empiezan por el prefijo. */
export const keys = (env, prefix = '') => [...env.KV.m.keys()].filter((k) => k.startsWith(prefix)).sort();
/** Proveedor de correo simulado (Resend o Brevo, según la URL a la que se llame): guarda cada petición { url, headers, body } en `calls`. `status` y `reply` fijan la respuesta (por defecto 200 con { id } de Resend o 201 con { messageId } de Brevo; un texto se envía tal cual); `throws` simula una caída de red. */
export function provider({ status, reply, throws } = {}) {
  const calls = [];
  /** fetch simulado: anota la petición y responde como el proveedor (o lanza, si se pidió una caída de red). */
  const fetchImpl = async (url, o) => {
    if (throws) throw new Error(throws);
    calls.push({ url, headers: o.headers, body: typeof o.body === 'string' ? JSON.parse(o.body) : String(o.body) });
    const brevo = String(url).includes('brevo.com');
    return new Response(typeof reply === 'string' ? reply : JSON.stringify(reply ?? (brevo ? { messageId: '<m1@smtp-relay.mailin.fr>' } : { id: 'm1' })), { status: status ?? (brevo ? 201 : 200) });
  };
  return { calls, fetchImpl };
}
let ipSeq = 0;
/** IP de prueba nueva en cada llamada (el límite de contacto es de 5 por visitante cada 10 minutos). */
export const freshIp = () => `10.30.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`;
/** POST /api/contact anónimo con un mensaje válido de ejemplo (over sustituye campos; el resto va a deps: now, rand, retryMs…) → { r (Response), j (JSON), ip }. */
export async function contactPost(env, box, over = {}, { ip = freshIp(), ...extra } = {}) {
  const r = await call(env, '/api/contact', { method: 'POST', body: { name: 'Ana Pérez', email: 'ana@acme.es', message: 'Necesito 50 toroidales', lang: 'es', privacy: true, ...over }, ip, deps: { fetchImpl: box.fetchImpl, ...extra } });
  return { r, j: await r.json(), ip };
}
/** Ejecuta fn con console.error capturado → las líneas que se escribieron en el registro del servidor (una cadena por llamada). */
export async function withLog(fn) {
  const orig = console.error, logs = [];
  console.error = (...a) => logs.push(a.map(String).join(' '));
  try { await fn(); } finally { console.error = orig; }
  return logs;
}
/** Registros (ya leídos) de los mensajes de contacto guardados en el KV del entorno, de la clave más reciente a la más antigua. */
export const messagesIn = (env) => keys(env, 'msg:').map((k) => JSON.parse(env.KV.m.get(k)));
