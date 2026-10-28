// [INDEX] Router del Worker torivac-api + tarea programada (precios cada 24 h).
//   PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login
//   USUARIO   GET /api/auth/me · GET /api/orders (manager: todos; client: solo los suyos)
//   MANAGER   POST /api/prices/refresh · POST /api/prices/upload · POST /api/prices/ai (propone) · POST /api/prices/ai/apply (aplica) · GET|POST /api/proposals/state · GET|POST|DELETE /api/users
import { json, readJson } from './util.js';
import { isOriginAllowed, corsHeaders } from './cors.js';
import { authenticate, requireRole, signSession } from './auth.js';
import { checkLogin, createUser, listUsers, deleteUser } from './users.js';
import { hit } from './ratelimit.js';
import { parseContact } from './validate.js';
import { handleOrder, handleContact } from './orders.js';
import { loadPrices, KEY_META, readPrices, diffPrices } from './prices.js';
import { catalogCtx } from './catalog.js';
import { syncPrices, parseCsv } from './sheets.js';
import { suggestPriceChanges, applyPriceChanges } from './ai.js';

export default {
  async fetch(request, env, ctx, deps = {}) {
    const url = new URL(request.url); const origin = request.headers.get('Origin');
    if (origin && !isOriginAllowed(origin, env)) return json({ ok: false, error: 'Origen no permitido' }, 403);
    const cors = origin ? corsHeaders(origin) : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/api/health') return json({ ok: true, time: new Date().toISOString() }, 200, cors);
      if (path === '/api/prices' && request.method === 'GET') { const p = await loadPrices(env); const meta = JSON.parse((await env.KV.get(KEY_META)) || 'null'); return json({ prices: p, meta }, 200, { ...cors, 'Cache-Control': 'public, max-age=300' }); }
      if (path === '/api/order' && request.method === 'POST') return handleOrder(request, env, await readJson(request), { ...deps, cors });
      if (path === '/api/contact' && request.method === 'POST') { const p = parseContact(await readJson(request)); if (p.error) return json({ ok: false, error: p.error }, 400, cors); return handleContact(request, env, p.contact, { ...deps, cors }); }
      if (path === '/api/auth/login' && request.method === 'POST') {
        const b = (await readJson(request)) || {}; const email = String(b.email || '').trim().toLowerCase();
        const rl = await hit(env, 'login', `${request.headers.get('CF-Connecting-IP') || '0'}:${email}`, { max: 6 });
        if (!rl.allowed) return json({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' }, 429, cors);
        const u = await checkLogin(env, email, b.password);
        if (!u) return json({ ok: false, error: 'Credenciales incorrectas' }, 401, cors);
        return json({ ok: true, token: await signSession({ sub: u.email, role: u.role, name: u.name }, env.SESSION_SECRET), user: u }, 200, cors);
      }
      const who = await authenticate(request, env);
      if (path === '/api/auth/me') return who ? json({ ok: true, user: who }, 200, cors) : json({ ok: false }, 401, cors);
      if (!who) return json({ ok: false, error: 'No autorizado' }, 401, cors);
      if (path === '/api/orders' && request.method === 'GET') {
        const out = []; let cursor;
        do { const r = await env.KV.list({ prefix: 'order:', cursor }); for (const k of r.keys) { const o = JSON.parse((await env.KV.get(k.name)) || 'null'); if (o && (who.role === 'manager' || o.customer.email === who.sub)) out.push(o); } cursor = r.list_complete ? undefined : r.cursor; } while (cursor);
        return json({ ok: true, orders: out.sort((a, b) => b.at.localeCompare(a.at)) }, 200, cors);
      }
      if (!requireRole(who, 'manager')) return json({ ok: false, error: 'Solo para managers' }, 403, cors);
      if (path === '/api/prices/refresh' && request.method === 'POST') return json({ ok: true, meta: await syncPrices(env, { fetchImpl: deps.fetchImpl || fetch, reason: `manual:${who.sub}`, force: false, ctx: deps.ctx || catalogCtx(env) }) }, 200, cors);
      if (path === '/api/prices/upload' && request.method === 'POST') {
        const b = (await readJson(request, 3_000_000)) || {}; const rows = Array.isArray(b.rows) ? b.rows : typeof b.csv === 'string' ? parseCsv(b.csv) : null;
        if (!rows) return json({ ok: false, error: 'Envía rows[] o csv' }, 400, cors);
        const sheetCtx = deps.ctx || catalogCtx(env);
        if (b.dry_run) {                                                              // vista previa: nada se guarda
          const { prices: next, report } = readPrices(rows, 'upload', new Date(), sheetCtx); const cur = await loadPrices(env);
          return json({ ok: true, dry_run: true, refs: Object.keys(next.items).length, diff: diffPrices(cur, next), report: { warnings: report.warnings, ignored: report.ignored.slice(0, 40), unknown: report.unknown.slice(0, 40), extras: report.extras.slice(0, 40), columns: report.columns, stats: report.stats } }, 200, cors);
        }
        return json({ ok: true, meta: await syncPrices(env, { rows, source: `upload:${who.sub}`, reason: `upload:${who.sub}`, force: b.force === true, ctx: sheetCtx }) }, 200, cors);
      }
      if (path === '/api/prices/ai' && request.method === 'POST') {                  // la IA PROPONE (no aplica); se limita porque cada llamada cuesta
        const rl = await hit(env, 'ai', who.sub, { max: 15 }); if (!rl.allowed) return json({ ok: false, error: 'Demasiadas consultas a la IA seguidas. Espera unos minutos.' }, 429, cors);
        try { return json({ ok: true, ...(await suggestPriceChanges(env, ((await readJson(request)) || {}).instruction, { fetchImpl: deps.fetchImpl || fetch })) }, 200, cors); }
        catch (e) { return json({ ok: false, error: e.message }, e.status || 500, cors); }
      }
      if (path === '/api/prices/ai/apply' && request.method === 'POST') {          // aplica lo que la persona ha revisado y confirmado
        try { return json({ ok: true, ...(await applyPriceChanges(env, (await readJson(request)) || {}, { who: who.sub })) }, 200, cors); }
        catch (e) { return json({ ok: false, error: e.message }, e.status || 500, cors); }
      }
      if (path === '/api/proposals/state' && request.method === 'GET') return json({ ok: true, state: JSON.parse((await env.KV.get('proposals:state')) || '{}') }, 200, cors);
      if (path === '/api/proposals/state' && request.method === 'POST') {            // aprobar / rechazar / deshacer una propuesta del panel (no publica nada por sí solo)
        const b = (await readJson(request)) || {}; const id = String(b.id || ''), st = String(b.state || '');
        if (!/^PR-\d{3,5}$/.test(id) || !['ok', 'no', ''].includes(st)) return json({ ok: false, error: 'Propuesta o estado no válidos' }, 400, cors);
        const state = JSON.parse((await env.KV.get('proposals:state')) || '{}'); if (st) state[id] = { state: st, by: who.sub, at: new Date().toISOString() }; else delete state[id];
        await env.KV.put('proposals:state', JSON.stringify(state)); return json({ ok: true, state }, 200, cors);
      }
      if (path === '/api/users' && request.method === 'GET') return json({ ok: true, users: await listUsers(env) }, 200, cors);
      if (path === '/api/users' && request.method === 'POST') { const r = await createUser(env, (await readJson(request)) || {}); return r.error ? json({ ok: false, error: r.error }, r.status || 400, cors) : json({ ok: true, user: r.user }, 201, cors); }
      if (path.startsWith('/api/users/') && request.method === 'DELETE') { await deleteUser(env, decodeURIComponent(path.split('/').pop())); return json({ ok: true }, 200, cors); }
      return json({ ok: false, error: 'No encontrado' }, 404, cors);
    } catch (e) { console.error(e); return json({ ok: false, error: e.message || 'Error interno' }, 500, cors); }
  },
  async scheduled(event, env, cfCtx, deps = {}) {
    try { const meta = await syncPrices(env, { reason: 'cron', ctx: deps.ctx || catalogCtx(env) }); console.log('precios sincronizados', JSON.stringify(meta)); }
    catch (e) { console.error('Sincronización de precios fallida:', e.message); }
  },
};
