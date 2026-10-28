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
