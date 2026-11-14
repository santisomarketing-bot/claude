// [INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h).
//   PÚBLICO   GET /api/health · GET /api/prices (el servidor decide qué precios según quién llama: VIP para el equipo, la categoría de un cliente con sesión, y para el visitante nada, aproximados o Normal según Ajustes → Precios)
//             · GET /api/google (qué mide la web: solo IDs públicos) · POST /api/order (con sesión opcional: un cliente con cuenta paga su categoría y tiene 3 presupuestos al día; sin sesión, «A consultar» o Normal) · POST /api/contact · POST /api/auth/login
// Acceso: 5 contraseñas erróneas del mismo visitante contra una cuenta (o 15 contra cualquiera, o 30 contra una cuenta de cualquier visitante) = bloqueo de 1 hora; ver handleLogin.
//   USUARIO   GET /api/auth/me · POST /api/auth/logout
//   PRESUPUESTOS RECIBIDOS (manager y client = el PROPIETARIO de la web; ver quotes.js y docs/PRESUPUESTOS-RECIBIDOS.md): GET /api/orders (los 300 más recientes de todos; el propietario, sin IP ni emailed.error)
//             · GET|PUT /api/orders/:número (ver · editar con `rev`/409 y `tier` opcional) · POST /api/orders/:número/send (reenviar por correo con PDF; topes 20/h por persona y 150/día)
//   CLIENTE (rol customer, solo lectura; owned.js): GET /api/orders (solo los suyos, reducidos, con `quota`) · GET /api/orders/:número (si es suyo; si no, 404) · PUT y send → 403 «Solo lectura»
//   PRECIOS Y CLIENTES (manager y client; docs/PRECIOS-Y-CLIENTES.md): GET|POST /api/customers · PUT|DELETE /api/customers/:correo · POST /api/customers/:correo/password (customers.js)
//             · GET|PUT /api/settings/pricing (porcentajes de las categorías, qué ve el visitante, precio aproximado) · PUT /api/prices/items/:ref (editar el precio de un producto; pricing.js)
//   MANAGER   POST /api/prices/refresh · POST /api/prices/upload · POST /api/prices/ai (propone) · POST /api/prices/ai/apply (aplica) · GET|POST /api/proposals/state · GET|POST|DELETE /api/users · GET /api/admin/data · /api/blog/… y /api/newcontent/… (solo existen en el servidor PHP: aquí responden 501; el Revisor solo llega a /api/newcontent)
//             GET /api/messages · DELETE /api/messages/:id (mensajes de contacto) · POST /api/mail/test · GET /api/mail/status (correo) · GET|PUT /api/settings/google (medición de Google)
// Todo límite por visitante usa ipKey (IPv6 → su /64). Ninguna respuesta 500 lleva texto interno: {"ok":false,"error":"Error interno","id":"<8 hex>"} y el detalle va al registro con ese id.
import { json, readJson, ApiError, clientIp, ipKey, randomHex } from './util.js';
import { isOriginAllowed, corsHeaders } from './cors.js';
import { authenticate, requireRole, signSession, secretOk } from './auth.js';
import { createUser, listUsers, deleteUser, getUser, verifyUser, ensureSession, logoutUser, publicUser, touchLogin } from './users.js';
import { hit, isBlocked, reset, purgeExpired, failLock, lockedFor } from './ratelimit.js';
import { parseContact, minFillMs } from './validate.js';
import { proposalEntry } from './proposals.js';
import { handleOrder, handleContact } from './orders.js';
import { listOrders } from './orderlist.js';
import { listOwned, usedLast24h, dailyLimit, forCustomer } from './owned.js';
import { customerRoute } from './customers.js';
import { loadPricing, pricesView, handleGet as pricingGet, handlePut as pricingPut, handleItemEdit } from './pricing.js';
import { quoteRoute } from './quotes.js';
import { handlePublic as googlePublic, handleGet as googleGet, handlePut as googlePut, MAX_BODY as GOOGLE_MAX } from './google.js';
import { handleMessageList, handleMessageDelete, handleMailTest, handleMailStatus } from './mailapi.js';
import { mailStatus, mailSettingProblems } from './email.js';
import { loadPrices, KEY_META, KEY_SYNC, diffPrices, updateMode } from './prices.js';
import { catalogCtx } from './catalog.js';
import { syncPrices, planPrices, parseCsv } from './sheets.js';
import { suggestPriceChanges, applyPriceChanges } from './ai.js';
import adminData from './generated/admin-data.js';

/** 429 con el texto de siempre (inundación, Bearer): el mismo para cualquier límite de acceso, nunca distingue si un usuario existe. */
const tooMany = (cors) => json({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' }, 429, cors);
/** Texto del tiempo que queda de bloqueo: «una hora» si falta casi una hora entera; si no, «N minutos» (redondeado hacia arriba). */
export const lockWait = (secs) => { if (secs >= 3300) return 'una hora'; const m = Math.max(1, Math.ceil(secs / 60)); return m === 1 ? 'un minuto' : `${m} minutos`; };
/** El 429 del bloqueo por fallos de contraseña: el mismo para los tres motivos y exista o no la cuenta; dice cuánto falta (retry_after y Retry-After, en segundos). */
const locked = (cors, leftMs) => {
  const secs = Math.max(1, Math.ceil(leftMs / 1000));
  return json({ ok: false, error: `Demasiados intentos fallidos. Vuelve a intentarlo en ${lockWait(secs)}.`, retry_after: secs }, 429, { ...cors, 'Retry-After': String(secs) });
};
const HOUR_MS = 60 * 60 * 1000;
/** Clave PÚBLICA de Cloudflare Turnstile (TURNSTILE_SITEKEY) si está bien escrita; '' si no. Los formularios de la web solo piden el CAPTCHA cuando /api/health la anuncia junto al secreto. */
export function turnstileSitekey(env) {
  const k = String(env.TURNSTILE_SITEKEY || '').trim();
  return /^[0-9A-Za-z_-]{8,80}$/.test(k) ? k : '';
}
/** Ajustes mal puestos que se avisan en /api/health: solo sus NOMBRES (SESSION_SECRET, ADMIN_API_TOKEN, ORDER_COPY, EMAIL_PROVIDER, ORDER_FROM), nunca sus valores. */
export function configProblems(env) {
  const p = [];
  if (!secretOk(env.SESSION_SECRET)) p.push('SESSION_SECRET');                                                                      // ausente, de menos de 32 caracteres o sin cambiar: nadie puede iniciar sesión
  if (env.ADMIN_API_TOKEN != null && env.ADMIN_API_TOKEN !== '' && !secretOk(env.ADMIN_API_TOKEN)) p.push('ADMIN_API_TOKEN');       // de menos de 32 caracteres: el token maestro queda desactivado
  if (env.ORDER_COPY != null && !['capped', 'off'].includes(String(env.ORDER_COPY).trim().toLowerCase())) p.push('ORDER_COPY');      // valor desconocido: la copia al cliente queda en «off»
  if (String(env.TURNSTILE_SECRET || '').trim() && !turnstileSitekey(env)) p.push('TURNSTILE_SITEKEY');                          // con el secreto y sin la clave pública (o mal escrita) los formularios exigirían un CAPTCHA que la web no puede mostrar
  p.push(...mailSettingProblems(env));                                                                                              // EMAIL_PROVIDER desconocido (el correo queda apagado) u ORDER_FROM que no es «Nombre <correo@dominio>» (no se envía)
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
 * POST /api/auth/login, con protección contra la fuerza bruta: 5 contraseñas erróneas del mismo visitante (ipKey) contra una cuenta bloquean ESA pareja 1 HORA desde el 5.º fallo (ni la contraseña
 * correcta entra mientras dure, y no se comprueba); 15 fallos de un visitante contra cualquier cuenta lo bloquean 1 hora; 30 fallos contra una cuenta, de cualquier visitante, la bloquean 1 hora.
 * Los contadores cuentan también los correos que no existen y la respuesta es idéntica (429 con retry_after y Retry-After): no se distingue si la cuenta existe. Un acceso correcto pone a cero los
 * contadores de esa pareja y de esa cuenta. Además, tope de inundación: 30 intentos / 10 min por visitante. Con SESSION_SECRET inseguro → 500 «Configuración insegura».
 */
async function handleLogin(request, env, { ipk, cors, nowMs }) {
  if (!secretOk(env.SESSION_SECRET)) {
    const s = env.SESSION_SECRET;
    return json({ ok: false, error: `Configuración insegura: SESSION_SECRET ${s == null || s === '' ? 'no configurado' : typeof s === 'string' && s.includes('CAMBIA-ESTO') ? 'sin cambiar (contiene «CAMBIA-ESTO»)' : 'demasiado corto (mínimo 32 caracteres)'}` }, 500, cors);
  }
  const b = await readJson(request, 10_000);
  if (!b || typeof b.email !== 'string' || typeof b.password !== 'string') return json({ ok: false, error: 'Petición no válida' }, 400, cors);
  const email = b.email.trim().toLowerCase();
  if (!(await hit(env, 'login-ip', ipk, { max: 30, now: nowMs })).allowed) return tooMany(cors);   // inundación: ni se comprueba la contraseña
  const pair = `${ipk}:${email}`;
  const left = Math.max(await lockedFor(env, 'lgpair', pair, { now: nowMs }), await lockedFor(env, 'lgip', ipk, { now: nowMs }), await lockedFor(env, 'lgacct', email, { now: nowMs }));
  if (left > 0) return locked(cors, left);                                                         // bloqueado: ni la contraseña correcta entra
  const u = email.length <= 254 ? await getUser(env, email) : null;                                // un «correo» absurdo no llega a KV (clave demasiado larga): cuenta como inexistente
  if (!(await verifyUser(u, b.password))) {
    await failLock(env, 'lgpair', pair, { max: 5, windowMs: HOUR_MS, lockMs: HOUR_MS, now: nowMs });
    await failLock(env, 'lgip', ipk, { max: 15, windowMs: HOUR_MS, lockMs: HOUR_MS, now: nowMs });
    await failLock(env, 'lgacct', email, { max: 30, windowMs: HOUR_MS, lockMs: HOUR_MS, now: nowMs });
    return json({ ok: false, error: 'Credenciales incorrectas' }, 401, cors);
  }
  await reset(env, 'lgpair', pair); await reset(env, 'lgacct', email);
  const user = await ensureSession(env, u);                                              // los usuarios antiguos reciben su sid ahora
  if (user.role === 'customer') await touchLogin(env, user.email, nowMs);                // último acceso del cliente (lo ve el equipo en la lista de clientes)
  const iat = Math.max(nowMs, (Number(user.sess_after) || 0) + 1);                      // nunca antes del último «cerrar sesión»
  return json({ ok: true, token: await signSession({ sub: user.email, sid: user.sid }, env.SESSION_SECRET, undefined, iat), user: publicUser(user) }, 200, cors);
}

/** Enruta la petición (ya con CORS resuelto) → Response; las excepciones suben a fetch, que las convierte en «Error interno». */
async function route(request, env, deps, { path, cors, nowMs }) {
  const method = request.method, ipk = ipKey(clientIp(request)), fetchImpl = deps.fetchImpl || fetch;
  if (path === '/api/health') {
    const problems = configProblems(env), { driver, configured, last } = await mailStatus(env);
    const { error: _error, ...lastPublic } = last || {};                                  // /api/health es público: el último intento de correo va SIN el texto del error (eso es de GET /api/mail/status, solo managers)
    return json({ ok: true, time: new Date(nowMs).toISOString(), mail: { driver, configured, last: last ? lastPublic : null }, ...(problems.length ? { config: { ok: false, problems } } : {}), ...(String(env.TURNSTILE_SECRET || '').trim() && turnstileSitekey(env) ? { features: { turnstile: { sitekey: turnstileSitekey(env) } } } : {}) }, 200, cors);
  }
  if (path === '/api/prices' && method === 'GET') {
    const id = await identify(request, env, ipk, nowMs);                                  // con la IP bloqueada por Bearer fallidos no se prueba el token: se sirve la vista de visitante; una sesión no válida o caducada también es un visitante (no un error)
    const p = await loadPrices(env); const meta = JSON.parse((await env.KV.get(KEY_META)) || 'null'), pricing = await loadPricing(env);
    const sync = id.who && id.who.role === 'manager' ? JSON.parse((await env.KV.get(KEY_SYNC)) || 'null') : null;       // un manager ve quién cargó la hoja, de dónde y cómo fue el último intento de sincronización; nadie más
    const cache = id.who ? 'private, no-store' : 'public, max-age=300';                   // con sesión la respuesta es de esa persona (su categoría): nunca se comparte ni se guarda
    return json(pricesView(id.who, p, meta, sync, pricing), 200, { ...cors, 'Cache-Control': cache, Vary: 'Origin, Authorization' });
  }
  if (path === '/api/google' && method === 'GET') return await googlePublic(env, { cors });                 // qué mide la web (solo IDs públicos); lo edita un manager en Ajustes → Google
  if (path === '/api/order' && method === 'POST') {
    const id = await identify(request, env, ipk, nowMs); if (id.limited) return tooMany(cors);
    if (!id.who && /^Bearer\s+.+$/.test(request.headers.get('Authorization') || '')) return json({ ok: false, code: 'session', error: 'Tu sesión ha caducado. Vuelve a entrar.' }, 401, cors);        // con sesión no válida NO se trata como visitante
    return await handleOrder(request, env, await readJson(request), { ...deps, cors, who: id.who });
  }
  if (path === '/api/contact' && method === 'POST') { const p = parseContact(await readJson(request), { minFillMs: minFillMs(env) }); if (p.error) return json({ ok: false, error: p.error, ...(p.code ? { code: p.code } : {}), ...(p.field ? { field: p.field } : {}) }, 400, cors); return await handleContact(request, env, p.contact, { ...deps, cors }); }
  if (path === '/api/auth/login' && method === 'POST') return await handleLogin(request, env, { ipk, cors, nowMs });
  const id = await identify(request, env, ipk, nowMs); if (id.limited) return tooMany(cors);
  const who = id.who;
  if (path === '/api/auth/me') { if (!who) return json({ ok: false }, 401, cors); const { tier: _tier, ...me } = who; return json({ ok: true, user: me }, 200, cors); }          // un cliente nunca ve el nombre de su categoría
  if (!who) return json({ ok: false, error: 'No autorizado' }, 401, cors);
  if (path === '/api/auth/logout' && method === 'POST') {                                // invalida TODOS los tokens anteriores de esta persona
    if (who.master) return json({ ok: false, error: 'El token maestro no tiene sesión que cerrar' }, 400, cors);
    await logoutUser(env, who.sub, nowMs); return json({ ok: true }, 200, cors);
  }
  if (path === '/api/newcontent' || path.startsWith('/api/newcontent/')) return requireRole(who, 'manager', 'reviewer') ? json({ ok: false, error: 'El contenido nuevo del panel necesita el servidor PHP del hosting (esta instalación usa Cloudflare Workers, que no lo incluye).', code: 'newcontent_unavailable' }, 501, cors) : json({ ok: false, error: 'No autorizado' }, 403, cors);
  if (who.role === 'reviewer') return json({ ok: false, error: 'No autorizado' }, 403, cors);                 // el Revisor solo tiene su sesión y «Contenido nuevo»: nada de presupuestos, precios, clientes ni ajustes
  if (path === '/api/orders' && method === 'GET') {
    if (who.role === 'customer') {                                                       // solo los suyos (índice por propietario), reducidos, con lo que le queda de cupo
      const used = await usedLast24h(env, who.sub, nowMs), r = await listOwned(env, who.sub);
      return json({ ok: true, orders: r.orders.map(forCustomer), quota: { limit: dailyLimit(env), used }, ...(r.truncated ? { truncated: true } : {}) }, 200, cors);
    }
    const r = await listOrders(env, who, { now: nowMs }); return json({ ok: true, orders: r.orders, ...(r.truncated ? { truncated: true } : {}) }, 200, cors);
  }
  const quote = await quoteRoute(request, env, { who, path, cors, nowMs, fetchImpl, catalog: deps.catalog });          // ver, editar y reenviar un presupuesto: manager y propietario (client)
  if (quote) return quote;
  if (requireRole(who, 'manager', 'client') && (path === '/api/customers' || path.startsWith('/api/customers/') || path === '/api/settings/pricing' || path.startsWith('/api/prices/items/'))) {          // precios y clientes: manager y propietario (client); un customer sigue de largo hasta el 403 «Solo para managers»
    let r = null;
    if (path === '/api/customers' || path.startsWith('/api/customers/')) r = await customerRoute(request, env, { path, cors, nowMs });
    else if (path === '/api/settings/pricing' && method === 'GET') r = await pricingGet(env, { cors });
    else if (path === '/api/settings/pricing' && method === 'PUT') r = await pricingPut(request, env, { who, cors, now: new Date(nowMs) });
    else if (path.startsWith('/api/prices/items/') && method === 'PUT') r = await handleItemEdit(request, env, path.slice('/api/prices/items/'.length), { who, cors, now: new Date(nowMs), catalog: deps.catalog });
    return r || json({ ok: false, error: 'No encontrado' }, 404, cors);
  }
  const ownerPrices = method === 'POST' && (path === '/api/prices/refresh' || path === '/api/prices/upload');          // la hoja de precios (actualizar y subir Excel/CSV) también la lleva el propietario; la IA, no
  if (!requireRole(who, 'manager') && !(ownerPrices && requireRole(who, 'client'))) return json({ ok: false, error: 'Solo para managers' }, 403, cors);
  if (path === '/api/admin/data' && method === 'GET') return json({ ok: true, proposals: Array.isArray(adminData && adminData.proposals) ? adminData.proposals : [], admin: adminData && adminData.admin ? adminData.admin : { products: [], byRef: {} } }, 200, { ...cors, 'Cache-Control': 'no-store' });
  if (path === '/api/messages' && method === 'GET') return await handleMessageList(request, env, { cors });                  // mensajes de contacto (datos personales: solo managers)
  if (path.startsWith('/api/messages/') && method === 'DELETE') return await handleMessageDelete(env, path.slice('/api/messages/'.length), { cors });
  if (path === '/api/settings/google' && method === 'GET') return await googleGet(env, { cors });          // ajustes de Google del panel (solo managers)
  if (path === '/api/settings/google' && method === 'PUT') return await googlePut(env, await readJson(request, GOOGLE_MAX), { who, cors, now: new Date(nowMs) });
  if (path === '/api/mail/test' && method === 'POST') return await handleMailTest(request, env, { who, cors, nowMs, fetchImpl });
  if (path === '/api/mail/status' && method === 'GET') return await handleMailStatus(env, { cors });
  if (path === '/api/prices/refresh' && method === 'POST') { const rb = (await readJson(request, 10_000)) || {}; return json({ ok: true, meta: await syncPrices(env, { fetchImpl, reason: `manual:${who.sub}`, force: false, mode: rb.mode, ctx: deps.ctx || catalogCtx(env), now: new Date(nowMs) }) }, 200, cors); }
  if (path === '/api/prices/upload' && method === 'POST') {
    const b = (await readJson(request, 3_000_000)) || {}; const rows = Array.isArray(b.rows) ? b.rows : typeof b.csv === 'string' ? parseCsv(b.csv) : null;
    if (!rows || !rows.every(Array.isArray)) return json({ ok: false, error: 'Envía rows[] o csv' }, 400, cors);
    const sheetCtx = deps.ctx || catalogCtx(env), mode = updateMode(b.mode ?? env.PRICE_UPDATE_MODE);
    if (b.dry_run) {                                                                     // vista previa: nada se guarda; es el mismo plan que aplicará la subida
      const plan = await planPrices(env, rows, 'upload', mode, { ctx: sheetCtx, now: new Date(nowMs) }), rep = plan.report;
      return json({ ok: true, dry_run: true, mode: plan.mode, refs: Object.keys(plan.sheet.items).length, total: Object.keys(plan.next.items).length, kept: plan.kept, manual_skipped: plan.manual_skipped, needs_force: plan.blockers.length > 0, blockers: plan.blockers, diff: diffPrices(plan.prev, plan.next),
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
  if (path === '/api/proposals/state' && method === 'POST') {                            // aprobar (con SU texto), rechazar o deshacer una propuesta del panel (no publica nada por sí solo)
    const b = (await readJson(request, 20_000)) || {}; const pid = typeof b.id === 'string' ? b.id : '', st = typeof b.state === 'string' ? b.state : '';
    if (!/^PR-\d{3,6}$/.test(pid) || !['ok', 'no', ''].includes(st)) return json({ ok: false, error: 'Propuesta o estado no válidos' }, 400, cors);
    const state = JSON.parse((await env.KV.get('proposals:state')) || '{}');
    if (!st) delete state[pid];
    else {
      const e = proposalEntry(b, st, who.sub, nowMs);
      if (e.error) return json({ ok: false, error: e.error, ...(e.code ? { code: e.code } : {}), ...(e.field ? { field: e.field } : {}) }, 400, cors);
      state[pid] = e.entry;
    }
    await env.KV.put('proposals:state', JSON.stringify(state)); return json({ ok: true, state }, 200, cors);
  }
  if (path === '/api/users' && method === 'GET') return json({ ok: true, users: await listUsers(env) }, 200, cors);
  if (path === '/api/users' && method === 'POST') { const r = await createUser(env, (await readJson(request, 20_000)) || {}); return r.error ? json({ ok: false, error: r.error }, r.status || 400, cors) : json({ ok: true, user: r.user }, 201, cors); }
  if (path.startsWith('/api/users/') && method === 'DELETE') {
    let email; try { email = decodeURIComponent(path.split('/').pop()); } catch { return json({ ok: false, error: 'Correo no válido' }, 400, cors); }
    if (!email || email.length > 254) return json({ ok: false, error: 'Correo no válido' }, 400, cors);
    await deleteUser(env, email); return json({ ok: true }, 200, cors);
  }
  if (path === '/api/blog' || path.startsWith('/api/blog/')) return json({ ok: false, error: 'El blog del panel necesita el servidor PHP del hosting (esta instalación usa Cloudflare Workers, que no lo incluye).', code: 'blog_unavailable' }, 501, cors);
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
