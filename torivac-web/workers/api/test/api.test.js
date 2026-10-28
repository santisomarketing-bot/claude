// Pruebas de [AUTH], [VALIDATE], [PRICES], [SHEETS], [ORDERS], [USERS] e [INDEX]: contraseñas y sesiones, pedidos, hoja de precios, roles, CORS, límites y cron.
// Sin red: KV en memoria y Resend/Google simulados con fetchImpl (ver helpers.js). Se ejecutan con `npm test` desde workers/api.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signSession, verifySession } from '../src/auth.js';
import { parseOrder, parseContact } from '../src/validate.js';
import { unitPrice, priceOrder, rowsToPrices, diffPrices } from '../src/prices.js';
import { parseCsv, syncPrices, getAccessToken } from '../src/sheets.js';
import { handleOrder } from '../src/orders.js';
import { createUser } from '../src/users.js';
import api from '../src/index.js';
import { mkEnv, req, CATALOG, PRICES, SHEET, TCTX } from './helpers.js';

/** Pedido válido de ejemplo { customer, lines, lang }; over sustituye campos para provocar cada error de validación. */
const goodOrder = (over = {}) => ({ customer: { name: 'Ana Pérez', company: 'ACME', email: 'ana@acme.es', phone: '600', notes: 'urgente', privacy: true }, lines: [{ ref: 'TT0020210', qty: 12 }, { ref: 'P16633', qty: 1 }], lang: 'es', ...over });

test('contraseñas: hash verificable y sal distinta', async () => {
  const a = await hashPassword('Clave-Segura-2026'), b = await hashPassword('Clave-Segura-2026');
  assert.notEqual(a.hash, b.hash);
  assert.ok(await verifyPassword('Clave-Segura-2026', a.hash, a.salt));
  assert.ok(!(await verifyPassword('otra', a.hash, a.salt)));
});
test('sesión firmada: válida, manipulada y caducada', async () => {
  const t = await signSession({ sub: 'a@b.c', role: 'manager', name: 'A' }, 'secreto-secreto-secreto-secreto-1');
  assert.deepEqual(await verifySession(t, 'secreto-secreto-secreto-secreto-1'), { sub: 'a@b.c', role: 'manager', name: 'A' });
  assert.equal(await verifySession(t.slice(0, -2) + 'xx', 'secreto-secreto-secreto-secreto-1'), null);
  assert.equal(await verifySession(t, 'otro'), null);
  const old = await signSession({ sub: 'a@b.c', role: 'client', name: 'A' }, 's'.repeat(32), 1000, Date.now() - 5000);
  assert.equal(await verifySession(old, 's'.repeat(32)), null);
});
test('validación de pedidos', () => {
  assert.ok(parseOrder(goodOrder(), CATALOG).order);
  assert.match(parseOrder(goodOrder({ lines: [{ ref: 'NOEXISTE', qty: 1 }] }), CATALOG).error, /desconocida/);
  assert.match(parseOrder(goodOrder({ lines: [{ ref: 'R100', qty: 0 }] }), CATALOG).error, /Cantidad/);
  assert.match(parseOrder(goodOrder({ lines: [{ ref: 'R100', qty: 1.5 }] }), CATALOG).error, /Cantidad/);
  assert.match(parseOrder(goodOrder({ customer: { ...goodOrder().customer, privacy: false } }), CATALOG).error, /privacidad/);
  assert.match(parseOrder(goodOrder({ customer: { ...goodOrder().customer, email: 'mal' } }), CATALOG).error, /Correo/);
  assert.ok(parseOrder(goodOrder({ hp: 'bot' }), CATALOG).error);
  assert.match(parseOrder(goodOrder({ pdf: 'AAAA' }), CATALOG).error, /PDF/);
  const dup = parseOrder(goodOrder({ lines: [{ ref: 'R100', qty: 2 }, { ref: 'R100', qty: 3 }] }), CATALOG).order;
  assert.deepEqual(dup.lines, [{ ref: 'R100', qty: 5 }]);                       // fusiona referencias repetidas
  assert.ok(parseContact({ name: 'Ana', email: 'a@b.es', message: 'Hola', privacy: true }).contact);
});
test('precios: tramos, céntimos y redondeo de línea', () => {
  assert.equal(unitPrice(PRICES, 'TT0020210', 1), 12.37);
  assert.equal(unitPrice(PRICES, 'TT0020210', 10), 11.9);
  assert.equal(unitPrice(PRICES, 'TT0020210', 49), 11.9);
  assert.equal(unitPrice(PRICES, 'TT0020210', 50), 11.4);
  assert.equal(unitPrice(PRICES, 'R100', 5), null);
  const r = priceOrder(PRICES, [{ ref: 'TT0020210', qty: 12 }, { ref: 'P16633', qty: 3 }, { ref: 'R100', qty: 4 }]);
  assert.equal(r.lines[0].total, 142.8);          // 12 × 11,90
  assert.equal(r.lines[1].total, 202.95);
  assert.equal(r.total, 345.75);
  assert.equal(r.unpriced, 1);
});
test('hoja → precios: coma decimal, tramos, active=0 y cabeceras obligatorias', () => {
  const p = rowsToPrices(parseCsv(SHEET), 't', new Date('2026-10-27T10:00:00Z'));
  assert.deepEqual(p.items.TT0020210, { p: 12.37, t: [[10, 11.9], [50, 11.4]], note: 'DEMO' });
  assert.equal(p.items.X0, undefined);
  assert.throws(() => rowsToPrices([['a', 'b'], [1, 2]]), /columnas/);
  const d = diffPrices(PRICES, p); assert.deepEqual(d.added, ['R100']); assert.equal(d.same, 2);
});
test('CSV con comillas y separadores dentro', () => {
  assert.deepEqual(parseCsv('ref;name\n"A;1";"dice ""hola"""\n'), [['ref', 'name'], ['A;1', 'dice "hola"']]);
});
test('sincronización por CSV: guarda, historial y rechaza hojas rotas', async () => {
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/export.csv' });
  /** Crea un fetch simulado que responde 200 con el texto dado. */
  const ok = (text) => async () => new Response(text, { status: 200 });
  const m1 = await syncPrices(env, { fetchImpl: ok(SHEET), reason: 'test' });
  assert.equal(m1.refs, 3);
  assert.equal(JSON.parse(await env.KV.get('prices:current')).items.R100.p, 5.5);
  await assert.rejects(() => syncPrices(env, { fetchImpl: ok('ref;price\nR100;1\n') }), /rechazada/);   // 1 de 3 refs (<50 %)
  const m2 = await syncPrices(env, { fetchImpl: ok('ref;price\nR100;1\n'), force: true });
  assert.equal(m2.refs, 1);
  assert.ok([...env.KV.m.keys()].some((k) => k.startsWith('prices:history:')));
  await assert.rejects(() => syncPrices(mkEnv(), {}), /Sin origen/);
});
test('cuenta de servicio: JWT RS256 con firma verificable', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const sa = { client_email: 'svc@proj.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n` };
  let assertion; const fetchImpl = async (u, o) => { assertion = o.body.get('assertion'); return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 }); };
  assert.equal(await getAccessToken(sa, fetchImpl, 1_800_000_000_000), 'tok');
  const [h, c, s] = assertion.split('.');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${c}`));
  assert.ok(ok); assert.equal(JSON.parse(Buffer.from(c, 'base64url')).iss, sa.client_email);
});
test('pedido: valora en servidor (ignora precios del cliente), guarda y envía a info@ y mzamora@ con PDF', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }); await env.KV.put('prices:current', JSON.stringify(PRICES));
  const sent = []; const fetchImpl = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'm' + sent.length }), { status: 200 }); };
  const body = goodOrder({ pdf: 'JVBERi0xLjQK', lines: [{ ref: 'TT0020210', qty: 12, unit: 0.01, total: 0.12 }, { ref: 'R100', qty: 4 }] });
  const res = await handleOrder(req('/api/order', { method: 'POST', body }), env, body, { fetchImpl, catalog: CATALOG, now: new Date('2026-10-28T07:00:00Z') });
  const j = await res.json();
  assert.equal(res.status, 200); assert.equal(j.number, 'TV-20261028-0001'); assert.equal(j.total, 142.8); assert.equal(j.unpriced, 1);
  assert.deepEqual(sent[0].to, ['info@grupotorivac.com', 'mzamora@torivac.com']);
  assert.equal(sent[0].reply_to, 'ana@acme.es'); assert.equal(sent[0].attachments[0].filename, 'TV-20261028-0001.pdf');
  assert.deepEqual(sent[1].to, ['ana@acme.es']);
  const rec = JSON.parse(await env.KV.get('order:TV-20261028-0001')); assert.equal(rec.lines[0].unit, 11.9); assert.equal(rec.total, 142.8);
  const j2 = await (await handleOrder(req('/api/order', { method: 'POST' }), env, body, { fetchImpl, catalog: CATALOG, now: new Date('2026-10-28T07:01:00Z') })).json();
  assert.equal(j2.number, 'TV-20261028-0002');
});
test('pedido: sin RESEND_API_KEY no falla (se guarda y se informa)', async () => {
  const env = mkEnv(); await env.KV.put('prices:current', JSON.stringify(PRICES));
  const j = await (await handleOrder(req('/api/order', { method: 'POST' }), env, goodOrder(), { catalog: CATALOG })).json();
  assert.equal(j.ok, true); assert.equal(j.emailed.skipped, true);
});
test('pedido: límite por IP', async () => {
  const env = mkEnv(); let last;
  for (let i = 0; i < 9; i++) last = await handleOrder(req('/api/order', { method: 'POST' }), env, goodOrder(), { catalog: CATALOG });
  assert.equal(last.status, 429);
});
test('API: login, roles, usuarios y pedidos propios', async () => {
  const env = mkEnv();
  await createUser(env, { email: 'jefe@torivac.com', name: 'Jefe', role: 'manager', password: 'Jefe-Clave-2026!' });
  await createUser(env, { email: 'ana@acme.es', name: 'Ana', role: 'client', password: 'Ana-Clave-2026!!' });
  assert.equal((await createUser(env, { email: 'ana@acme.es', role: 'client', password: 'otraclave-larga' })).status, 409);
  assert.ok((await createUser(env, { email: 'x@y.es', role: 'client', password: 'corta' })).error);
  /** POST /api/auth/login con el correo y la contraseña dados; devuelve la Response. */
  const login = async (email, password) => api.fetch(req('/api/auth/login', { method: 'POST', body: { email, password } }), env, {});
  assert.equal((await login('jefe@torivac.com', 'mala')).status, 401);
  const mt = (await (await login('jefe@torivac.com', 'Jefe-Clave-2026!')).json()).token;
  const ct = (await (await login('ana@acme.es', 'Ana-Clave-2026!!')).json()).token;
  /** Llama al Worker en la ruta p con el token t como Bearer y las opciones o (método, body); devuelve la Response. */
  const as = (t, p, o = {}) => api.fetch(req(p, { ...o, headers: { Authorization: `Bearer ${t}` } }), env, {});
  assert.equal((await as(ct, '/api/users')).status, 403);                         // un cliente no gestiona usuarios
  assert.equal((await as(mt, '/api/users')).status, 200);
  assert.equal((await as(ct, '/api/prices/refresh', { method: 'POST' })).status, 403);
  assert.equal((await api.fetch(req('/api/users'), env, {})).status, 401);
  await env.KV.put('order:A', JSON.stringify({ number: 'A', at: '2026-10-28', customer: { email: 'ana@acme.es' }, lines: [] }));
  await env.KV.put('order:B', JSON.stringify({ number: 'B', at: '2026-10-27', customer: { email: 'otro@x.es' }, lines: [] }));
  assert.equal((await (await as(ct, '/api/orders')).json()).orders.length, 1);
  assert.equal((await (await as(mt, '/api/orders')).json()).orders.length, 2);
  assert.equal((await as('master-token-123', '/api/users')).status, 200);        // token maestro = manager
});
test('API: bloqueo de login por intentos y CORS', async () => {
  const env = mkEnv(); let r;
  for (let i = 0; i < 7; i++) r = await api.fetch(req('/api/auth/login', { method: 'POST', body: { email: 'a@b.es', password: 'x' } }), env, {});
  assert.equal(r.status, 429);
  const bad = await api.fetch(new Request('https://api.test/api/prices', { headers: { Origin: 'https://evil.example' } }), env, {});
  assert.equal(bad.status, 403);
  const good = await api.fetch(new Request('https://api.test/api/prices', { headers: { Origin: 'https://demo.example' } }), env, {});
  assert.equal(good.headers.get('Access-Control-Allow-Origin'), 'https://demo.example');
});
test('API: subida de hoja (vista previa y aplicar) y cron', async () => {
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/x.csv' });
  await env.KV.put('prices:current', JSON.stringify(PRICES));
  const h = { Authorization: 'Bearer master-token-123' };
  const dry = await (await api.fetch(req('/api/prices/upload', { method: 'POST', body: { csv: SHEET, dry_run: true }, headers: h }), env, {}, { ctx: TCTX })).json();
  assert.equal(dry.dry_run, true); assert.deepEqual(dry.diff.added, ['R100']);
  const done = await (await api.fetch(req('/api/prices/upload', { method: 'POST', body: { csv: SHEET }, headers: h }), env, {}, { ctx: TCTX })).json();
  assert.equal(done.meta.refs, 3);
  const pub = await (await api.fetch(req('/api/prices'), env, {})).json(); assert.equal(pub.prices.items.R100.p, 5.5);
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('ref;price\nR100;9\nTT0020210;12\nP16633;60\n'); 
  try { await api.scheduled({}, env, {}, { ctx: TCTX }); } finally { globalThis.fetch = realFetch; }
  assert.equal(JSON.parse(await env.KV.get('prices:current')).items.R100.p, 9);   // el cron actualiza
});

test('hoja de precios con códigos nuevos (tarifa): se publican dentro de su producto y se pueden pedir', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }); await env.KV.put('prices:current', JSON.stringify(PRICES));
  const h = { Authorization: 'Bearer master-token-123' };
  const csv = 'Artículo,Descripción,Precio venta\nTT0020210,TRAFO TOROID 20VA 230V/2X10V,12.37093203\nTT0099999,TRAFO TOROID 99VA 230V/2X99V,45.5\nQQ1,algo raro,3\n';
  const dry = await (await api.fetch(req('/api/prices/upload', { method: 'POST', body: { csv, dry_run: true }, headers: h }), env, {}, { ctx: TCTX })).json();
  assert.deepEqual(dry.report.unknown, ['QQ1']); assert.deepEqual(dry.report.extras, ['TT0099999']);
  assert.ok(dry.report.warnings.some((w) => w.code === 'referencias_nuevas'));
  assert.equal(dry.report.columns.ref, 'Artículo'); assert.equal(dry.report.columns.price, 'Precio venta');
  const done = await (await api.fetch(req('/api/prices/upload', { method: 'POST', body: { csv }, headers: h }), env, {}, { ctx: TCTX })).json();
  assert.equal(done.ok, true); assert.equal(done.meta.refs, 2);
  const pub = await (await api.fetch(req('/api/prices'), env, {})).json();
  assert.deepEqual(pub.prices.items.TT0099999, { p: 45.5, pid: 884, n: 'TRAFO TOROID 99VA 230V/2X99V' });
  assert.equal(pub.prices.items.TT0020210.p, 12.3709);                    // 8 decimales → 4
  const sent = []; const fetchImpl = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'm' }), { status: 200 }); };
  const body = goodOrder({ lines: [{ ref: 'TT0099999', qty: 3 }] });
  const j = await (await handleOrder(req('/api/order', { method: 'POST' }), env, body, { fetchImpl, catalog: CATALOG })).json();
  assert.equal(j.ok, true); assert.equal(j.total, 136.5);                  // 3 × 45,5
  assert.match(sent[0].text, /TRAFO TOROID 99VA/);
  const bad = await (await handleOrder(req('/api/order', { method: 'POST' }), env, goodOrder({ lines: [{ ref: 'QQ1', qty: 1 }] }), { fetchImpl, catalog: CATALOG })).json();
  assert.equal(bad.ok, false); assert.match(bad.error, /Referencia desconocida/);
});
test('sincronización: un precio de relleno en casi todas las filas se rechaza salvo force', async () => {
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/x.csv' });
  const rows = ['ref;price']; for (let i = 0; i < 12; i++) rows.push(`R${i};22000`);
  /** fetch simulado que responde 200 con las filas del CSV de precio de relleno (rows). */
  const ok = async () => new Response(rows.join('\n'), { status: 200 });
  await assert.rejects(() => syncPrices(env, { fetchImpl: ok }), /relleno/);
  const m = await syncPrices(env, { fetchImpl: ok, force: true });
  assert.equal(m.refs, 12); assert.ok(m.warnings.some((w) => /relleno/.test(w)));
});

// ───────────────────────────────────────── privacidad, sesiones y correo: arreglos tras la revisión
test('GET /api/prices: el público no ve quién cargó la hoja ni el id de Drive; un manager sí', async () => {
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/x.csv' });
  await createUser(env, { email: 'jefa@torivac.com', name: 'Jefa', role: 'manager', password: 'Manager-Clave-2026' });
  const tok = (await (await api.fetch(req('/api/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: 'Manager-Clave-2026' } }), env, {})).json()).token;
  const h = { Authorization: `Bearer ${tok}` };
  await api.fetch(req('/api/prices/upload', { method: 'POST', body: { csv: SHEET }, headers: h }), env, {}, { ctx: TCTX });
  const pub = await api.fetch(req('/api/prices'), env, {}); const pj = await pub.json();
  assert.ok(!JSON.stringify(pj).includes('@') && !JSON.stringify(pj).includes('jefa'), 'ningún correo en la respuesta pública');
  assert.deepEqual([pj.meta.reason, pj.meta.source, pj.prices.source], ['upload', 'upload', 'upload']);
  assert.match(pub.headers.get('Cache-Control'), /public/); assert.equal(pub.headers.get('Vary'), 'Authorization');
  assert.equal(pj.prices.items.R100.p, 5.5, 'los precios siguen siendo públicos');
  const man = await api.fetch(req('/api/prices', { headers: h }), env, {}); const mj = await man.json();
  assert.equal(mj.meta.reason, 'upload:jefa@torivac.com'); assert.match(man.headers.get('Cache-Control'), /no-store/);
  const cli = await createUser(env, { email: 'ana@acme.es', name: 'Ana', role: 'client', password: 'Ana-Clave-2026!!' });
  const ct = (await (await api.fetch(req('/api/auth/login', { method: 'POST', body: { email: 'ana@acme.es', password: 'Ana-Clave-2026!!' } }), env, {})).json()).token;
  assert.ok(cli.user && !JSON.stringify(await (await api.fetch(req('/api/prices', { headers: { Authorization: `Bearer ${ct}` } }), env, {})).json()).includes('@'), 'un cliente tampoco ve correos');
});
test('un usuario borrado pierde la sesión al instante (las sesiones no tienen estado, se comprueba que siga existiendo)', async () => {
  const env = mkEnv();
  await createUser(env, { email: 'ana@acme.es', name: 'Ana', role: 'client', password: 'Ana-Clave-2026!!' });
  const tok = (await (await api.fetch(req('/api/auth/login', { method: 'POST', body: { email: 'ana@acme.es', password: 'Ana-Clave-2026!!' } }), env, {})).json()).token;
  /** GET /api/auth/me con la sesión de Ana; devuelve la Response. */
  const me = () => api.fetch(req('/api/auth/me', { headers: { Authorization: `Bearer ${tok}` } }), env, {});
  assert.equal((await me()).status, 200);
  await api.fetch(req('/api/users/ana%40acme.es', { method: 'DELETE', headers: { Authorization: 'Bearer master-token-123' } }), env, {});
  assert.equal((await me()).status, 401);
});
test('contacto: el correo al equipo escapa el HTML de nombre, correo y mensaje', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }); const sent = [];
  /** Resend simulado: guarda cada correo enviado en `sent`. */
  const fetchImpl = async (u, o) => { sent.push(JSON.parse(o.body)); return new Response('{"id":"m"}', { status: 200 }); };
  const { handleContact } = await import('../src/orders.js');
  const contact = { name: '<b>Ana</b>', email: 'a<img src=x onerror=1>@x.es', message: 'hola <script>alert(1)</script>\n& adiós', lang: 'es', turnstile: '' };
  await handleContact(req('/api/contact', { method: 'POST' }), env, contact, { fetchImpl });
  assert.ok(!/<(img|script)\b/i.test(sent[0].html) && sent[0].html.includes('&lt;b&gt;Ana&lt;/b&gt;'), 'sin etiquetas del visitante en el HTML: ' + sent[0].html);
  assert.match(sent[0].html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;<br>&amp; adiós/);
});
test('pedido: si el contador de KV va por detrás (no es atómico), el número no pisa un pedido ya guardado', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }); await env.KV.put('prices:current', JSON.stringify(PRICES));
  const now = new Date('2026-10-28T07:00:00Z'); const fetchImpl = async () => new Response('{"id":"m"}', { status: 200 });
  await env.KV.put('order:TV-20261028-0001', JSON.stringify({ number: 'TV-20261028-0001', marca: 'anterior' }));      // otro pedido simultáneo ya ocupó el 0001
  const j = await (await handleOrder(req('/api/order', { method: 'POST' }), env, goodOrder(), { fetchImpl, catalog: CATALOG, now })).json();
  assert.equal(j.number, 'TV-20261028-0002');
  assert.equal(JSON.parse(await env.KV.get('order:TV-20261028-0001')).marca, 'anterior');
});

// ───────────────────────────────────────── el correo es parte del resultado: nunca se afirma lo que no salió
test('pedido: se guarda siempre y el registro dice si el aviso por correo salió (el panel marca los que no)', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }); await env.KV.put('prices:current', JSON.stringify(PRICES));
  const now = new Date('2026-10-28T07:00:00Z');
  /** Resend simulado que rechaza todos los envíos (403: dominio sin verificar). */
  const down = async () => new Response('x', { status: 403 });                         // Resend rechaza (p. ej. dominio sin verificar)
  const j = await (await handleOrder(req('/api/order', { method: 'POST' }), env, goodOrder(), { fetchImpl: down, catalog: CATALOG, now })).json();
  assert.equal(j.ok, true); assert.deepEqual([j.emailed.team, j.emailed.customer], [false, false]);
  const rec = JSON.parse(await env.KV.get(`order:${j.number}`));
  assert.equal(rec.emailed.team, false); assert.equal(rec.emailed.error, 'Resend respondió 403');
  assert.equal(rec.customer.email, 'ana@acme.es', 'el pedido está completo aunque el correo fallara');
  /** Resend simulado que acepta todos los envíos. */
  const up = async () => new Response('{"id":"m"}', { status: 200 });
  const j2 = await (await handleOrder(req('/api/order', { method: 'POST' }), env, goodOrder(), { fetchImpl: up, catalog: CATALOG, now })).json();
  assert.deepEqual([j2.emailed.team, j2.emailed.customer], [true, true]);
  assert.equal(JSON.parse(await env.KV.get(`order:${j2.number}`)).emailed.error, '');
  const none = await (await handleOrder(req('/api/order', { method: 'POST' }), mkEnv(), goodOrder(), { catalog: CATALOG })).json();     // sin RESEND_API_KEY
  assert.equal(none.emailed.skipped, true);
});
test('contacto: si el correo no sale, el servidor responde con error (la web lo dice y ofrece el correo directo); si sale, ok', async () => {
  const { handleContact } = await import('../src/orders.js');
  const c = { name: 'Ana', email: 'ana@acme.es', message: 'Necesito 50 toroidales', lang: 'es', turnstile: '' };
  const ok = await handleContact(req('/api/contact', { method: 'POST' }), mkEnv({ RESEND_API_KEY: 're_test' }), c, { fetchImpl: async () => new Response('{"id":"m"}', { status: 200 }) });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).emailed, true);
  const bad = await handleContact(req('/api/contact', { method: 'POST' }), mkEnv({ RESEND_API_KEY: 're_test' }), c, { fetchImpl: async () => new Response('x', { status: 500 }) });
  assert.equal(bad.status, 502); const bj = await bad.json(); assert.equal(bj.ok, false); assert.match(bj.error, /No hemos podido enviar/);
  const skipped = await handleContact(req('/api/contact', { method: 'POST' }), mkEnv(), c, {});
  assert.equal(skipped.status, 502); assert.match((await skipped.json()).error, /no está configurado/);
});
