// [INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h).
//   PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login
//   USUARIO   GET /api/auth/me · POST /api/auth/logout · GET /api/orders (manager: los 300 más recientes; client: solo los suyos, hasta 100)
//   MANAGER   POST /api/prices/refresh · POST /api/prices/upload · POST /api/prices/ai (propone) · POST /api/prices/ai/apply (aplica) · GET|POST /api/proposals/state · GET|POST|DELETE /api/users · GET /api/admin/data
// Todo límite por visitante usa ipKey (IPv6 → su /64). Ninguna respuesta 500 lleva texto interno: {"ok":false,"error":"Error interno","id":"<8 hex>"} y el detalle va al registro con ese id.
import { json, readJson, ApiError, clientIp, ipKey, randomHex } from './util.js';
import { isOriginAllowed, corsHeaders } from './cors.js';
import { authenticate, requireRole, signSession, secretOk } from './auth.js';
import { createUser, listUsers, deleteUser, getUser, verifyUser, ensureSession, logoutUser, publicUser } from './users.js';
import { hit, isBlocked, reset, purgeExpired } from './ratelimit.js';
import { parseContact } from './validate.js';
import { handleOrder, handleContact } from './orders.js';
import { listOrders } from './orderlist.js';
import { loadPrices, KEY_META, KEY_SYNC, diffPrices, publicView, updateMode } from './prices.js';
import { catalogCtx } from './catalog.js';
import { syncPrices, planPrices, parseCsv } from './sheets.js';
import { suggestPriceChanges, applyPriceChanges } from './ai.js';
import adminData from './generated/admin-data.js';

/** 429 con el texto de siempre (el mismo para cualquier límite de acceso: nunca distingue si un usuario existe). */
const tooMany = (cors) => json({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' }, 429, cors);
/** Ajustes mal puestos que se avisan en /api/health: solo sus NOMBRES (SESSION_SECRET, ADMIN_API_TOKEN, ORDER_COPY), nunca sus valores. */
export function configProblems(env) {
  const p = [];
  if (!secretOk(env.SESSION_SECRET)) p.push('SESSION_SECRET');                                                                      // ausente, de menos de 32 caracteres o sin cambiar: nadie puede iniciar sesión
  if (env.ADMIN_API_TOKEN != null && env.ADMIN_API_TOKEN !== '' && !secretOk(env.ADMIN_API_TOKEN)) p.push('ADMIN_API_TOKEN');       // de menos de 32 caracteres: el token maestro queda desactivado
  if (env.ORDER_COPY != null && !['capped', 'off'].includes(String(env.ORDER_COPY).trim().toLowerCase())) p.push('ORDER_COPY');      // valor desconocido: la copia al cliente queda en «off»
  return p;
}
/** Respuesta de error: un ApiError enseña su mensaje y estado; cualquier otra excepción se responde como «Error interno» con un id de 8 hex y el detalle va al registro con ese id. */
function fail(e, cors) {
  if (e instanceof ApiError) return json({ ok: false, error: e.message }, e.status, cors);
  const id = randomHex(4);
  console.error(`[error ${id}]`, e && e.stack ? e.stack : e);
  return json({ ok: false, error: 'Error interno', id }, 500, cors);
}
/** Quién llama + control de fallos de Bearer: sin Bearer → anónimo; con Bearer inválido cuenta un FALLO (30 / 10 min por ipKey) y, pasado el tope, responde { limited: true }. Una petición válida no consume cupo. */
async function identify(request, env, ipk, nowMs) {
  if (!/^Bearer\s+.+$/.test(request.headers.get('Authorization') || '')) return { who: null };
  if (await isBlocked(env, 'bearer', ipk, { max: 30, now: nowMs })) return { who: null, limited: true };
  const who = await authenticate(request, env, { now: nowMs });
  if (!who) await hit(env, 'bearer', ipk, { max: 30, now: nowMs });
  return { who };
}
/**
 * POST /api/auth/login. Límites (todos devuelven el mismo 429 y nunca distinguen si el usuario existe): por ipKey+correo 6 / 10 min · por ipKey sola 30 / 10 min contra cualquier cuenta ·
 * por CUENTA (independiente de la IP) 12 fallos / 15 min, contados solo para cuentas que existen y a cero tras un acceso correcto. Con SESSION_SECRET inseguro → 500 «Configuración insegura».
 */
async function handleLogin(request, env, { ipk, cors, nowMs }) {
  if (!secretOk(env.SESSION_SECRET)) {
    const s = env.SESSION_SECRET;
    return json({ ok: false, error: `Configuración insegura: SESSION_SECRET ${s == null || s === '' ? 'no configurado' : typeof s === 'string' && s.includes('CAMBIA-ESTO') ? 'sin cambiar (contiene «CAMBIA-ESTO»)' : 'demasiado corto (mínimo 32 caracteres)'}` }, 500, cors);
  }
  const b = await readJson(request, 10_000);
  if (!b || typeof b.email !== 'string' || typeof b.password !== 'string') return json({ ok: false, error: 'Petición no válida' }, 400, cors);
  const email = b.email.trim().toLowerCase();
  if (!(await hit(env, 'login-ip', ipk, { max: 30, now: nowMs })).allowed) return tooMany(cors);
  if (!(await hit(env, 'login', `${ipk}:${email}`, { max: 6, now: nowMs })).allowed) return tooMany(cors);
  const u = email.length <= 254 ? await getUser(env, email) : null;                       // un «correo» absurdo no llega a KV (clave demasiado larga): cuenta como inexistente
  if (u && (await isBlocked(env, 'login-acct', u.email, { max: 12, now: nowMs }))) return tooMany(cors);
  if (!(await verifyUser(u, b.password))) {
    if (u) await hit(env, 'login-acct', u.email, { max: 12, windowMs: 15 * 60 * 1000, now: nowMs });
    return json({ ok: false, error: 'Credenciales incorrectas' }, 401, cors);
  }
  await reset(env, 'login-acct', u.email);
  const user = await ensureSession(env, u);                                              // los usuarios antiguos reciben su sid ahora
  const iat = Math.max(nowMs, (Number(user.sess_after) || 0) + 1);                      // nunca antes del último «cerrar sesión»
  return json({ ok: true, token: await signSession({ sub: user.email, sid: user.sid }, env.SESSION_SECRET, undefined, iat), user: publicUser(user) }, 200, cors);
}

/** Enruta la petición (ya con CORS resuelto) → Response; las excepciones suben a fetch, que las convierte en «Error interno». */
async function route(request, env, deps, { path, cors, nowMs }) {
  const method = request.method, ipk = ipKey(clientIp(request)), fetchImpl = deps.fetchImpl || fetch;
  if (path === '/api/health') { const problems = configProblems(env); return json({ ok: true, time: new Date(nowMs).toISOString(), ...(problems.length ? { config: { ok: false, problems } } : {}) }, 200, cors); }
  if (path === '/api/prices' && method === 'GET') {
    const id = await identify(request, env, ipk, nowMs);                                  // con la IP bloqueada por Bearer fallidos no se prueba el token: se sirve la vista pública
    const p = await loadPrices(env); const meta = JSON.parse((await env.KV.get(KEY_META)) || 'null');
    const vary = { Vary: 'Origin, Authorization' };
    if (id.who && id.who.role === 'manager') { const sync = JSON.parse((await env.KV.get(KEY_SYNC)) || 'null'); return json({ prices: p, meta, ...(sync ? { sync } : {}) }, 200, { ...cors, 'Cache-Control': 'private, no-store', ...vary }); }      // un manager ve quién cargó la hoja, de dónde y cómo fue el último intento de sincronización; el público, no
    return json(publicView(p, meta), 200, { ...cors, 'Cache-Control': 'public, max-age=300', ...vary });
  }
  if (path === '/api/order' && method === 'POST') return await handleOrder(request, env, await readJson(request), { ...deps, cors });
  if (path === '/api/contact' && method === 'POST') { const p = parseContact(await readJson(request)); if (p.error) return json({ ok: false, error: p.error }, 400, cors); return await handleContact(request, env, p.contact, { ...deps, cors }); }
  if (path === '/api/auth/login' && method === 'POST') return await handleLogin(request, env, { ipk, cors, nowMs });
  const id = await identify(request, env, ipk, nowMs); if (id.limited) return tooMany(cors);
  const who = id.who;
  if (path === '/api/auth/me') return who ? json({ ok: true, user: who }, 200, cors) : json({ ok: false }, 401, cors);
  if (!who) return json({ ok: false, error: 'No autorizado' }, 401, cors);
  if (path === '/api/auth/logout' && method === 'POST') {                                // invalida TODOS los tokens anteriores de esta persona
    if (who.master) return json({ ok: false, error: 'El token maestro no tiene sesión que cerrar' }, 400, cors);
    await logoutUser(env, who.sub, nowMs); return json({ ok: true }, 200, cors);
  }
  if (path === '/api/orders' && method === 'GET') { const r = await listOrders(env, who, { now: nowMs }); return json({ ok: true, orders: r.orders, ...(r.truncated ? { truncated: true } : {}) }, 200, cors); }
  if (!requireRole(who, 'manager')) return json({ ok: false, error: 'Solo para managers' }, 403, cors);
  if (path === '/api/admin/data' && method === 'GET') return json({ ok: true, proposals: Array.isArray(adminData && adminData.proposals) ? adminData.proposals : [], admin: adminData && adminData.admin ? adminData.admin : { products: [], byRef: {} } }, 200, { ...cors, 'Cache-Control': 'no-store' });
  if (path === '/api/prices/refresh' && method === 'POST') { const rb = (await readJson(request, 10_000)) || {}; return json({ ok: true, meta: await syncPrices(env, { fetchImpl, reason: `manual:${who.sub}`, force: false, mode: rb.mode, ctx: deps.ctx || catalogCtx(env), now: new Date(nowMs) }) }, 200, cors); }
  if (path === '/api/prices/upload' && method === 'POST') {
    const b = (await readJson(request, 3_000_000)) || {}; const rows = Array.isArray(b.rows) ? b.rows : typeof b.csv === 'string' ? parseCsv(b.csv) : null;
    if (!rows || !rows.every(Array.isArray)) return json({ ok: false, error: 'Envía rows[] o csv' }, 400, cors);
    const sheetCtx = deps.ctx || catalogCtx(env), mode = updateMode(b.mode ?? env.PRICE_UPDATE_MODE);
    if (b.dry_run) {                                                                     // vista previa: nada se guarda; es el mismo plan que aplicará la subida
      const plan = await planPrices(env, rows, 'upload', mode, { ctx: sheetCtx, now: new Date(nowMs) }), rep = plan.report;
      return json({ ok: true, dry_run: true, mode: plan.mode, refs: Object.keys(plan.sheet.items).length, total: Object.keys(plan.next.items).length, kept: plan.kept, needs_force: plan.blockers.length > 0, blockers: plan.blockers, diff: diffPrices(plan.prev, plan.next),
        report: { warnings: rep.warnings, ignored: rep.ignored.slice(0, 40), unknown: rep.unknown.slice(0, 40), extras: rep.extras.slice(0, 40), retire: rep.retire.slice(0, 40), columns: rep.columns, stats: rep.stats } }, 200, cors);
    }
    return json({ ok: true, meta: await syncPrices(env, { rows, source: `upload:${who.sub}`, reason: `upload:${who.sub}`, force: b.force === true, ctx: sheetCtx, mode, now: new Date(nowMs) }) }, 200, cors);
  }
  if (path === '/api/prices/ai' && method === 'POST') {                                  // la IA PROPONE (no aplica); se limita porque cada llamada cuesta
    const rl = await hit(env, 'ai', who.sub, { max: 15, now: nowMs }); if (!rl.allowed) return json({ ok: false, error: 'Demasiadas consultas a la IA seguidas. Espera unos minutos.' }, 429, cors);
    return json({ ok: true, ...(await suggestPriceChanges(env, ((await readJson(request, 20_000)) || {}).instruction, { fetchImpl })) }, 200, cors);
  }
  if (path === '/api/prices/ai/apply' && method === 'POST') return json({ ok: true, ...(await applyPriceChanges(env, (await readJson(request)) || {}, { who: who.sub, now: new Date(nowMs) })) }, 200, cors);      // aplica lo que la persona ha revisado y confirmado
  if (path === '/api/proposals/state' && method === 'GET') return json({ ok: true, state: JSON.parse((await env.KV.get('proposals:state')) || '{}') }, 200, cors);
  if (path === '/api/proposals/state' && method === 'POST') {                            // aprobar / rechazar / deshacer una propuesta del panel (no publica nada por sí solo)
    const b = (await readJson(request, 20_000)) || {}; const pid = typeof b.id === 'string' ? b.id : '', st = typeof b.state === 'string' ? b.state : '';
    if (!/^PR-\d{3,5}$/.test(pid) || !['ok', 'no', ''].includes(st)) return json({ ok: false, error: 'Propuesta o estado no válidos' }, 400, cors);
    const state = JSON.parse((await env.KV.get('proposals:state')) || '{}'); if (st) state[pid] = { state: st, by: who.sub, at: new Date(nowMs).toISOString() }; else delete state[pid];
    await env.KV.put('proposals:state', JSON.stringify(state)); return json({ ok: true, state }, 200, cors);
  }
  if (path === '/api/users' && method === 'GET') return json({ ok: true, users: await listUsers(env) }, 200, cors);
  if (path === '/api/users' && method === 'POST') { const r = await createUser(env, (await readJson(request, 20_000)) || {}); return r.error ? json({ ok: false, error: r.error }, r.status || 400, cors) : json({ ok: true, user: r.user }, 201, cors); }
  if (path.startsWith('/api/users/') && method === 'DELETE') {
    let email; try { email = decodeURIComponent(path.split('/').pop()); } catch { return json({ ok: false, error: 'Correo no válido' }, 400, cors); }
    if (!email || email.length > 254) return json({ ok: false, error: 'Correo no válido' }, 400, cors);
    await deleteUser(env, email); return json({ ok: true }, 200, cors);
  }
  return json({ ok: false, error: 'No encontrado' }, 404, cors);
}

export default {
  /** Atiende cada petición HTTP: CORS, rutas públicas, login y rutas de sesión o de manager; deps = { fetchImpl, ctx, now, purge, rand } para pruebas. Una excepción NUNCA escapa sin cabeceras CORS. */
  async fetch(request, env, cfCtx, deps = {}) {
    const url = new URL(request.url); const origin = request.headers.get('Origin');
    if (origin && !isOriginAllowed(origin, env)) return json({ ok: false, error: 'Origen no permitido' }, 403);
    const cors = origin ? corsHeaders(origin) : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const nowMs = deps.now != null ? Number(deps.now) : Date.now();
    try {
      if (deps.purge === true || (deps.purge == null && Math.random() < 1 / 50)) {         // 1 de cada 50 peticiones limpia «al vuelo» hasta 200 registros rl:* caducados
        const p = purgeExpired(env, { now: nowMs }).catch((e) => console.error('Purga de rl:*', e && e.message));
        if (cfCtx && typeof cfCtx.waitUntil === 'function') cfCtx.waitUntil(p); else await p;
      }
      return await route(request, env, deps, { path, cors, nowMs });
    } catch (e) { return fail(e, cors); }
  },
  /** Tarea programada (cron): sincroniza los precios con la hoja de origen y limpia los registros de límites caducados; un fallo se anota en prices:meta y en el log, y no se propaga. */
  async scheduled(event, env, cfCtx, deps = {}) {
    try { const meta = await syncPrices(env, { fetchImpl: deps.fetchImpl || fetch, reason: 'cron', ctx: deps.ctx || catalogCtx(env) }); console.log('precios sincronizados', JSON.stringify(meta)); }
    catch (e) { console.error('Sincronización de precios fallida:', e.message); }
    try { await purgeExpired(env); } catch (e) { console.error('Purga de rl:*', e && e.message); }
  },
};
