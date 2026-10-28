// [MAILAPI] Endpoints de gestión de los mensajes de contacto y del correo. SOLO managers (sesión de manager o token maestro): index.js ya comprobó el rol antes de llegar aquí.
//   GET /api/messages?limit=100        → { ok, items:[{ id, at, name, email, message, lang, ip, emailed:{ sent, reason, error? } }], truncated }   (más recientes primero; limit 1..300)
//   DELETE /api/messages/:id           → { ok:true } · 404 si no existe (derecho de supresión)
//   POST /api/mail/test { to? }        → { ok, driver, to:[…], sent, reason, error? }   (200 aunque el proveedor falle; 400 si `to` no es un correo; 10 pruebas / hora por usuario)
//   GET /api/mail/status               → { ok, driver, configured, problems:[nombres de ajustes], last:{ at, kind, ok, reason, error? } | null }
// Todo lo que sale de aquí es dato (JSON, sin caché): el contenido del visitante no se interpreta nunca como HTML; el panel lo escapa al pintarlo.
import { json, readBody, jsonDepthOk } from './util.js';
import { isEmail, oneLine } from './validate.js';
import { hit } from './ratelimit.js';
import { listMessages, deleteMessage } from './messages.js';
import { sendMail, testMail, mailDriver, teamRecipients, mailStatus } from './email.js';

/** Cabeceras de estas respuestas: nada de caché (son datos personales y estado vivo) y sin que el navegador adivine el tipo del contenido. */
const priv = (cors) => ({ ...cors, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
const HOUR = 60 * 60 * 1000;

/** GET /api/messages?limit=N: los mensajes más recientes primero (hasta 300; por defecto 100) con la IP y el estado del correo; un registro corrupto se omite. */
export async function handleMessageList(request, env, { cors = {} } = {}) {
  const r = await listMessages(env, { limit: new URL(request.url).searchParams.get('limit') });
  return json({ ok: true, items: r.items, truncated: r.truncated }, 200, priv(cors));
}
/** DELETE /api/messages/:id (el id llega tal cual viene en la URL, aún codificado): borra el mensaje; 404 si no existe o el id no tiene la forma CT-AAAAMMDD-NNNN-XXX. */
export async function handleMessageDelete(env, rawId, { cors = {} } = {}) {
  let id; try { id = decodeURIComponent(rawId); } catch { id = ''; }
  if (!(await deleteMessage(env, id))) return json({ ok: false, error: 'No existe ese mensaje' }, 404, priv(cors));
  return json({ ok: true }, 200, priv(cors));
}
/** Cuerpo JSON opcional de la petición → objeto ({} si no hay cuerpo), o null si es demasiado grande, anida demasiado, no es JSON o no es un objeto. */
async function optionalBody(request) {
  const bytes = await readBody(request, 10_000);
  if (!bytes) return null;
  if (!bytes.length) return {};
  const text = new TextDecoder().decode(bytes);
  if (!jsonDepthOk(text, 32)) return null;
  try { const b = JSON.parse(text); return b && typeof b === 'object' && !Array.isArray(b) ? b : null; } catch { return null; }
}
/**
 * POST /api/mail/test { to? }: envía «Torivac · prueba de correo» a `to` (un correo válido) o, si no se da, a los destinatarios de ORDER_TO. Responde 200 { ok, driver, to, sent, reason, error? } aunque el
 * proveedor falle (aquí SÍ va el `error` corto y sin secretos: es el diagnóstico); 400 si `to` no es un correo válido; 429 pasadas 10 pruebas por hora y usuario. Se anota como último intento (kind «test»).
 */
export async function handleMailTest(request, env, { who, cors = {}, nowMs = Date.now(), fetchImpl = fetch } = {}) {
  const b = await optionalBody(request);
  if (!b) return json({ ok: false, error: 'Petición no válida' }, 400, priv(cors));
  let to;
  if (b.to == null || (typeof b.to === 'string' && b.to.trim() === '')) to = teamRecipients(env);
  else {
    const t = typeof b.to === 'string' ? oneLine(b.to, 254) : '';
    if (!isEmail(t)) return json({ ok: false, error: 'Correo de destino no válido' }, 400, priv(cors));
    to = [t];
  }
  if (!(await hit(env, 'mail-test', who.sub, { max: 10, windowMs: HOUR, now: nowMs })).allowed) return json({ ok: false, error: 'Demasiadas pruebas de correo. Espera una hora.' }, 429, priv(cors));
  const m = testMail({ driver: mailDriver(env), at: new Date(nowMs).toISOString() });
  const r = await sendMail(env, { to, subject: m.subject, html: m.html, text: m.text }, fetchImpl, { kind: 'test', now: nowMs });
  return json({ ok: !!r.ok, driver: r.driver, to, sent: !!r.ok, reason: r.reason, ...(r.error ? { error: r.error } : {}) }, 200, priv(cors));
}
/** GET /api/mail/status: controlador activo, si está configurado, los NOMBRES de los ajustes que faltan (nunca valores) y el último intento de envío (null si todavía no hubo ninguno). */
export async function handleMailStatus(env, { cors = {} } = {}) {
  return json({ ok: true, ...(await mailStatus(env)) }, 200, priv(cors));
}
