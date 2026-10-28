// [PRUEBAS-CORREO-PANEL] Pruebas de M2 (endpoints de gestión: GET/DELETE /api/messages, POST /api/mail/test, GET /api/mail/status y el bloque `mail` de /api/health) y de su seguridad (M4):
// solo gestores, nada de secretos en ninguna respuesta y los datos del visitante tratados como dato. Sin red: KV en memoria y proveedores simulados con provider() (ver kit.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeKV, CountKV, mkEnv, MASTER } from './helpers.js';
import { call, signIn, provider, contactPost, keys } from './kit.js';
import { messageKey } from '../src/messages.js';

/** Entorno con Resend configurado y un gestor y un cliente con sesión → { env, mgr (token), cli (token) }. */
async function setup(extra = {}) {
  const env = mkEnv({ RESEND_API_KEY: 're_test', ...extra });
  const mgr = (await signIn(env, 'jefa@torivac.test', 'manager')).token, cli = (await signIn(env, 'ana.compras@acme.test', 'client')).token;
  return { env, mgr, cli };
}
/** Guarda `n` mensajes de contacto de ejemplo (uno por minuto desde `t0`) → ids, del más antiguo al más reciente. */
async function seed(env, n, t0 = Date.parse('2026-10-28T08:00:00Z')) {
  const ids = [], box = provider();
  for (let i = 0; i < n; i++) ids.push((await contactPost(env, box, { name: `Persona ${i + 1}`, message: `Mensaje número ${i + 1}` }, { now: t0 + i * 60_000 })).j.id);
  return ids;
}

// ───────────────────────────────────────── permisos (M2)
test('M2 · todas las rutas de gestión: anónimo 401, cliente 403, gestor y token maestro sí', async () => {
  const { env, mgr, cli } = await setup();
  const [id] = await seed(env, 1);
  const rutas = [['GET', '/api/messages'], ['DELETE', `/api/messages/${id}`], ['POST', '/api/mail/test'], ['GET', '/api/mail/status']];
  for (const [method, path] of rutas) {
    assert.equal((await call(env, path, { method, body: method === 'POST' ? {} : undefined })).status, 401, `anónimo ${method} ${path}`);
    assert.equal((await call(env, path, { method, token: cli, body: method === 'POST' ? {} : undefined })).status, 403, `cliente ${method} ${path}`);
  }
  assert.equal((await call(env, '/api/messages', { token: mgr })).status, 200);
  assert.equal((await call(env, '/api/mail/status', { token: MASTER })).status, 200, 'el token maestro vale');
  assert.equal((await call(env, '/api/messages', { token: 'x'.repeat(40) })).status, 401, 'un token inventado no');
  assert.equal(keys(env, 'msg:').length, 1, 'ninguna de las llamadas rechazadas borró nada');
});

// ───────────────────────────────────────── GET /api/messages
test('M2 · GET /api/messages: los más recientes primero, con todos los campos, sin caché y límite acotado a 1..300 (100 por defecto)', async () => {
  const { env, mgr } = await setup();
  const ids = await seed(env, 5);
  const r = await call(env, '/api/messages', { token: mgr }), j = await r.json();
  assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'no-store'); assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(j.ok, true); assert.equal(j.truncated, false); assert.deepEqual(j.items.map((m) => m.id), [...ids].reverse(), 'más recientes primero');
  assert.deepEqual(Object.keys(j.items[0]).sort(), ['at', 'email', 'emailed', 'id', 'ip', 'lang', 'message', 'name']);
  assert.deepEqual(j.items[0].emailed, { sent: true, reason: 'sent' });
  const dos = await (await call(env, '/api/messages?limit=2', { token: mgr })).json();
  assert.equal(dos.items.length, 2); assert.equal(dos.truncated, true, 'hay más de los devueltos'); assert.deepEqual(dos.items.map((m) => m.id), [ids[4], ids[3]]);
  for (const q of ['limit=0', 'limit=-5', 'limit=abc', 'limit=', 'limit=1e9']) {
    const x = await (await call(env, `/api/messages?${q}`, { token: mgr })).json();
    assert.equal(x.ok, true, q); assert.ok(x.items.length >= 1 && x.items.length <= 5, q);
  }
  assert.equal((await (await call(env, '/api/messages?limit=0', { token: mgr })).json()).items.length, 1, 'limit 0 se sube a 1');
  assert.equal((await (await call(env, '/api/messages?limit=1000', { token: mgr })).json()).items.length, 5, 'limit 1000 se baja a 300 (hay 5)');
});
test('M2 · GET /api/messages con más de 100 mensajes devuelve 100 y truncated:true; con limit=300 devuelve hasta 300', async () => {
  const { env, mgr } = await setup();
  const t0 = Date.parse('2026-10-20T08:00:00Z');
  for (let i = 0; i < 130; i++) {                                                          // directo en KV: 130 contactos por la API chocarían con el límite de 5 por visitante
    const id = `CT-20261020-${String(i + 1).padStart(4, '0')}-AAA`;
    await env.KV.put(messageKey(id), JSON.stringify({ id, at: new Date(t0 + i * 1000).toISOString(), name: 'N' + i, email: 'a@b.es', message: 'm' + i, lang: 'es', ip: '1.2.3.4', emailed: { sent: true, reason: 'sent' } }));
  }
  const a = await (await call(env, '/api/messages', { token: mgr })).json();
  assert.equal(a.items.length, 100); assert.equal(a.truncated, true); assert.equal(a.items[0].id, 'CT-20261020-0130-AAA'); assert.equal(a.items[99].id, 'CT-20261020-0031-AAA');
  const b = await (await call(env, '/api/messages?limit=300', { token: mgr })).json();
  assert.equal(b.items.length, 130); assert.equal(b.truncated, false);
});
test('M2 · GET /api/messages: un registro corrupto se omite sin romper la lista y el hueco se rellena con el siguiente', async () => {
  const { env, mgr } = await setup();
  const ids = await seed(env, 4);
  await env.KV.put(messageKey(ids[2]), '{esto no es json');                                // el segundo más reciente, dañado
  await env.KV.put(messageKey('CT-29991231-9999-ZZZ'), JSON.stringify({ id: 'CT-29991231-9999-ZZZ' }));   // sin fecha: tampoco vale
  const j = await (await call(env, '/api/messages?limit=3', { token: mgr })).json();
  assert.equal(j.ok, true); assert.deepEqual(j.items.map((m) => m.id), [ids[3], ids[1], ids[0]], 'se salta los dos dañados y rellena hasta 3');
  assert.equal(j.truncated, false);
});
test('M2/M4 · el contenido del visitante es dato: se devuelve tal cual dentro del JSON (JSON, nunca HTML), con el nombre en una sola línea; las etiquetas ni se aceptan', async () => {
  const { env, mgr } = await setup();
  const txt = 'Precio < 50 € & "comillas" y </ese> final';
  assert.equal((await contactPost(env, provider(), { message: '<img src=x onerror=alert(1)>' })).r.status, 400, 'una etiqueta HTML no entra');
  const { j } = await contactPost(env, provider(), { name: 'Eva\r\nBcc: espia@evil.example', message: 'Precio < 50 € & "comillas"' });
  const r = await call(env, '/api/messages', { token: mgr });
  assert.match(r.headers.get('Content-Type'), /application\/json/); const x = await r.json();
  assert.equal(x.items[0].message, 'Precio < 50 € & "comillas"', 'se guarda y se devuelve tal cual'); assert.ok(!/[\r\n]/.test(x.items[0].name), 'el nombre es de una sola línea');
  assert.equal(x.items[0].id, j.id); assert.ok(txt);
});

// ───────────────────────────────────────── DELETE /api/messages/:id
test('M2 · DELETE /api/messages/:id borra uno (derecho de supresión); 404 si no existe, si ya se borró o si el id no tiene forma de id', async () => {
  const { env, mgr } = await setup();
  const [a, b] = await seed(env, 2);
  const del = await call(env, `/api/messages/${a}`, { method: 'DELETE', token: mgr });
  assert.equal(del.status, 200); assert.deepEqual(await del.json(), { ok: true }); assert.equal(del.headers.get('Cache-Control'), 'no-store');
  assert.equal(env.KV.m.has(messageKey(a)), false); assert.equal(env.KV.m.has(messageKey(b)), true, 'el otro sigue');
  for (const id of [a, 'CT-20261028-9999-ZZZ', 'nada', '..%2F..%2Fprices%3Acurrent', '%E0%A4%A', 'order:TV-1', encodeURIComponent('msg:x')]) {
    const r = await call(env, `/api/messages/${id}`, { method: 'DELETE', token: mgr });
    assert.equal(r.status, 404, id); assert.equal((await r.json()).ok, false);
  }
  const lista = await (await call(env, '/api/messages', { token: mgr })).json();
  assert.deepEqual(lista.items.map((m) => m.id), [b], 'solo queda el no borrado');
});
test('M2 · DELETE de un mensaje no puede alcanzar otras claves del almacén (pedidos, precios, usuarios)', async () => {
  const { env, mgr } = await setup();
  await env.KV.put('prices:current', '{"items":{}}'); await env.KV.put('order:TV-20261028-0001-AAA', '{}');
  const antes = keys(env).length;
  for (const id of ['prices:current', 'order:TV-20261028-0001-AAA', 'user:jefa@torivac.test', 'CT-20261028-0001-AAA/../order', 'CT-20261028-0001-AAA ', 'ct-20261028-0001-aaa']) {
    await call(env, `/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE', token: mgr });
  }
  assert.equal(keys(env).length, antes, 'no se borró ninguna clave ajena');
});

// ───────────────────────────────────────── POST /api/mail/test
test('M2 · POST /api/mail/test: envía «Torivac · prueba de correo» a los destinatarios del equipo (o a `to`) y responde { ok, driver, to, sent, reason }', async () => {
  const { env, mgr } = await setup();
  const box = provider(), at = Date.parse('2026-10-28T10:00:00Z');
  const a = await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: {}, deps: { fetchImpl: box.fetchImpl, now: at } }), ja = await a.json();
  assert.equal(a.status, 200); assert.deepEqual(ja, { ok: true, driver: 'resend', to: ['info@grupotorivac.com', 'mzamora@torivac.com'], sent: true, reason: 'sent' });
  assert.equal(a.headers.get('Cache-Control'), 'no-store');
  const c = box.calls[0].body; assert.equal(c.subject, 'Torivac · prueba de correo'); assert.ok(c.text.includes('Si lees esto, el envío de correo de la web funciona.')); assert.ok(c.text.includes('resend') && c.text.includes('2026-10-28T10:00:00.000Z'));
  const b = await (await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: { to: 'prueba@mi-empresa.es' }, deps: { fetchImpl: box.fetchImpl, now: at } })).json();
  assert.deepEqual(b.to, ['prueba@mi-empresa.es']); assert.deepEqual(box.calls[1].body.to, ['prueba@mi-empresa.es']);
  const sinCuerpo = await call(env, '/api/mail/test', { method: 'POST', token: mgr, deps: { fetchImpl: box.fetchImpl, now: at } });
  assert.equal(sinCuerpo.status, 200, 'sin cuerpo = destinatarios del equipo');
});
test('M2 · POST /api/mail/test con Brevo: usa la API de Brevo y dice el controlador', async () => {
  const { env, mgr } = await setup({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-' + 'a'.repeat(40), RESEND_API_KEY: undefined });
  const box = provider();
  const j = await (await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: { to: 'a@b.es' }, deps: { fetchImpl: box.fetchImpl } })).json();
  assert.equal(j.driver, 'brevo'); assert.equal(j.sent, true); assert.equal(box.calls[0].url, 'https://api.brevo.com/v3/smtp/email'); assert.equal(box.calls[0].body.to[0].email, 'a@b.es');
});
test('M2 · POST /api/mail/test: si el proveedor falla responde 200 con ok:false, reason y el error CORTO y sin secretos (es el diagnóstico); sin controlador, off/skipped', async () => {
  const { env, mgr } = await setup();
  const box = provider({ status: 401, reply: { message: 'API key is invalid: re_test' } });
  const r = await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: { to: 'a@b.es' }, deps: { fetchImpl: box.fetchImpl } }), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, false); assert.equal(j.sent, false); assert.equal(j.reason, 'failed'); assert.ok(j.error.length <= 160);
  assert.match(j.error, /^Resend 401: API key is invalid/); assert.ok(!j.error.includes('re_test'), 'la clave tachada');
  for (const [extra, reason] of [[{ EMAIL_PROVIDER: 'none' }, 'off'], [{ RESEND_API_KEY: '' }, 'skipped']]) {
    const e = await setup(extra), x = await (await call(e.env, '/api/mail/test', { method: 'POST', token: e.mgr, body: { to: 'a@b.es' }, deps: { fetchImpl: box.fetchImpl } })).json();
    assert.equal(x.ok, false); assert.equal(x.reason, reason); assert.ok(x.error);
  }
});
test('M2 · POST /api/mail/test: un `to` que no es un correo válido es 400; ni una lista ni una coma cuelan a un tercero', async () => {
  const { env, mgr } = await setup();
  const box = provider();
  for (const to of ['no-es-un-correo', 'a@b.es,c@d.es', 'a@b.es\r\nBcc: x@y.es', ['a@b.es'], 123, { a: 1 }, 'x'.repeat(300) + '@a.es']) {
    const r = await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: { to }, deps: { fetchImpl: box.fetchImpl } });
    assert.equal(r.status, 400, JSON.stringify(to)); assert.equal((await r.json()).ok, false);
  }
  assert.equal((await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: '[1,2]', deps: { fetchImpl: box.fetchImpl } })).status, 400, 'un cuerpo que no es un objeto');
  assert.equal((await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: '{no json', deps: { fetchImpl: box.fetchImpl } })).status, 400);
  assert.equal(box.calls.length, 0, 'no se envió nada');
});
test('M2 · POST /api/mail/test: 10 pruebas por hora y usuario; la 11.ª es 429 y a la hora siguiente vuelve a poder (cada gestor tiene su cupo)', async () => {
  const { env, mgr } = await setup();
  const otro = (await signIn(env, 'segundo@torivac.test', 'manager')).token, box = provider(), t0 = Date.parse('2026-10-28T10:00:00Z');
  for (let i = 0; i < 10; i++) assert.equal((await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: {}, deps: { fetchImpl: box.fetchImpl, now: t0 + i * 1000 } })).status, 200, 'prueba ' + (i + 1));
  const r = await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: {}, deps: { fetchImpl: box.fetchImpl, now: t0 + 20_000 } });
  assert.equal(r.status, 429); assert.equal(box.calls.length, 10, 'la 11.ª no envió nada');
  assert.equal((await call(env, '/api/mail/test', { method: 'POST', token: otro, body: {}, deps: { fetchImpl: box.fetchImpl, now: t0 + 20_000 } })).status, 200, 'otro gestor tiene su cupo');
  assert.equal((await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: {}, deps: { fetchImpl: box.fetchImpl, now: t0 + 61 * 60_000 } })).status, 200, 'pasada la hora, otra vez');
});

// ───────────────────────────────────────── GET /api/mail/status y /api/health
test('M2 · GET /api/mail/status: sin envíos, last:null; tras un contacto y tras una prueba, el último intento (solo el último) con su tipo', async () => {
  const { env, mgr } = await setup();
  const s0 = await (await call(env, '/api/mail/status', { token: mgr })).json();
  assert.deepEqual(s0, { ok: true, driver: 'resend', configured: true, problems: [], last: null });
  await contactPost(env, provider({ status: 403, reply: { message: 'domain not verified' } }), {}, { now: Date.parse('2026-10-28T09:00:00Z') });
  const s1 = await (await call(env, '/api/mail/status', { token: mgr })).json();
  assert.deepEqual(s1.last, { at: '2026-10-28T09:00:00.000Z', kind: 'contact', ok: false, reason: 'failed', error: 'Resend 403: domain not verified' });
  await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: {}, deps: { fetchImpl: provider().fetchImpl, now: Date.parse('2026-10-28T09:05:00Z') } });
  const s2 = await (await call(env, '/api/mail/status', { token: mgr })).json();
  assert.deepEqual(s2.last, { at: '2026-10-28T09:05:00.000Z', kind: 'test', ok: true, reason: 'sent' }, 'solo el último, y sin error si salió bien');
});
test('M2/M4 · GET /api/mail/status: los problemas son NOMBRES de ajustes, nunca valores; configured sale de ellos', async () => {
  const { env, mgr } = await setup({ RESEND_API_KEY: '', ORDER_FROM: 'esto no vale', ORDER_TO: 'roto' });
  const j = await (await call(env, '/api/mail/status', { token: mgr })).json();
  assert.equal(j.configured, false); assert.deepEqual([...j.problems].sort(), ['ORDER_FROM', 'ORDER_TO', 'RESEND_API_KEY']);
  assert.ok(!JSON.stringify(j).includes('esto no vale') && !JSON.stringify(j).includes('roto'), 'ningún valor');
  const none = await (await call((await setup({ EMAIL_PROVIDER: 'none' })).env, '/api/mail/status', { token: MASTER })).json();
  assert.equal(none.driver, 'none'); assert.equal(none.configured, false);
  const brevo = await setup({ EMAIL_PROVIDER: 'brevo', RESEND_API_KEY: undefined });
  const b = await (await call(brevo.env, '/api/mail/status', { token: brevo.mgr })).json();
  assert.equal(b.driver, 'brevo'); assert.deepEqual(b.problems, ['BREVO_API_KEY']);
});
test('M2 · /api/health (público) lleva mail:{ driver, configured, last } sin el texto del error ni ningún secreto', async () => {
  const { env, mgr } = await setup();
  await contactPost(env, provider({ status: 401, reply: { message: 'bad key re_test' } }), {}, { now: Date.parse('2026-10-28T09:00:00Z') });
  const r = await call(env, '/api/health'), j = await r.json();
  assert.equal(j.ok, true); assert.deepEqual(j.mail, { driver: 'resend', configured: true, last: { at: '2026-10-28T09:00:00.000Z', kind: 'contact', ok: false, reason: 'failed' } });
  const txt = JSON.stringify(j); for (const s of ['re_test', 'bad key', 'Resend 401', 'RESEND', MASTER]) assert.ok(!txt.includes(s), `health no debe llevar «${s}»`);
  assert.ok(mgr);
});
test('M4 · una clave «sk-SECRETO-123» configurada como secreto no aparece en ninguna respuesta de los endpoints de correo aunque el proveedor la repita', async () => {
  const { env, mgr } = await setup({ RESEND_API_KEY: 'sk-SECRETO-123-abcdef' });
  const box = provider({ status: 401, reply: { message: 'invalid token sk-SECRETO-123-abcdef (Bearer sk-SECRETO-123-abcdef)' } });
  await contactPost(env, box); await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: { to: 'a@b.es' }, deps: { fetchImpl: box.fetchImpl } });
  const vistas = [];
  for (const p of ['/api/messages', '/api/mail/status', '/api/health']) vistas.push(await (await call(env, p, { token: mgr })).text());
  vistas.push(await (await call(env, '/api/mail/test', { method: 'POST', token: mgr, body: { to: 'a@b.es' }, deps: { fetchImpl: box.fetchImpl } })).text());
  for (const v of vistas) assert.ok(!v.includes('SECRETO'), v.slice(0, 120));
  for (const [k, v] of env.KV.m) assert.ok(!v.includes('SECRETO'), `ni en el almacén (${k})`);
});
test('M2 · los endpoints de correo no hacen más lecturas de KV de las necesarias (un list y un get por mensaje, sin recorrer el almacén)', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test', KV: new CountKV() }), mgr = (await signIn(env, 'jefa@torivac.test', 'manager')).token;
  await seed(env, 3);
  const antes = { ...env.KV.ops };
  await call(env, '/api/messages?limit=3', { token: mgr });
  assert.equal(env.KV.ops.list - antes.list, 1, 'un solo list'); assert.ok(env.KV.ops.get - antes.get <= 3 + 3 + 6, `gets: ${env.KV.ops.get - antes.get}`); assert.equal(env.KV.ops.put - antes.put, 0, 'listar no escribe');
  assert.ok(FakeKV);
});
