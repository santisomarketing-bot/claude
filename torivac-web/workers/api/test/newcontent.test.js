// «Contenido nuevo» del panel (ver, proponer, aprobar y registro de cambios) vive en el servidor PHP del hosting: el Worker de Cloudflare no lo incluye y lo dice con claridad.
// Lo que SÍ comparte con PHP es el rol Revisor (comercial y traductor en una persona): se crea igual, entra igual y solo llega a /api/newcontent, nunca a presupuestos, precios, clientes ni ajustes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkEnv } from './helpers.js';
import { call, signIn } from './kit.js';

test('NC1 · /api/newcontent/… responde 501 al manager y al Revisor, 401 sin sesión y 403 a un cliente; /api/health no lo anuncia', async () => {
  const env = mkEnv();
  const tj = (await signIn(env, 'jefa@torivac.test', 'manager', { ip: '10.8.9.1' })).token, tc = (await signIn(env, 'ana.compras@acme.test', 'client', { ip: '10.8.9.2' })).token, tr = (await signIn(env, 'marta.revisora@torivac.test', 'reviewer', { ip: '10.8.9.3' })).token;
  for (const p of ['/api/newcontent', '/api/newcontent/export', '/api/newcontent/a-medida/es/approve']) {
    for (const t of [tj, tr]) {
      const r = await call(env, p, { token: t, method: p.endsWith('approve') ? 'POST' : 'GET' });
      assert.equal(r.status, 501, p);
      const j = await r.json();
      assert.deepEqual([j.ok, j.code], [false, 'newcontent_unavailable']);
      assert.match(j.error, /servidor PHP/);
    }
    assert.equal((await call(env, p)).status, 401, p + ' sin sesión');
    assert.equal((await call(env, p, { token: tc })).status, 403, p + ' propietario');
  }
  const h = await (await call(env, '/api/health')).json();
  assert.equal(h.features, undefined, 'el Worker no anuncia el contenido nuevo');
});

test('NC2 · el Revisor se crea y entra como cualquier cuenta, y solo tiene su sesión: nada de presupuestos, precios, clientes, mensajes ni usuarios', async () => {
  const env = mkEnv();
  const tj = (await signIn(env, 'jefa@torivac.test', 'manager', { ip: '10.8.9.4' })).token;
  const r = await call(env, '/api/users', { token: tj, method: 'POST', body: { email: 'marta.revisora@torivac.test', name: 'Marta Revisora', role: 'reviewer', password: 'Clave-Revision-2026!' } });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).user.role, 'reviewer');
  assert.equal((await call(env, '/api/users', { token: tj, method: 'POST', body: { email: 'x@torivac.test', role: 'revisor', password: 'Clave-Revision-2026!' } })).status, 400, 'un rol inventado se rechaza');
  const login = await (await call(env, '/api/auth/login', { method: 'POST', body: { email: 'marta.revisora@torivac.test', password: 'Clave-Revision-2026!' }, ip: '10.8.9.5' })).json();
  assert.equal(login.ok, true);
  assert.equal(login.user.role, 'reviewer');
  const tr = login.token;
  assert.equal((await (await call(env, '/api/auth/me', { token: tr })).json()).user.role, 'reviewer');
  for (const p of ['/api/orders', '/api/orders/TV-20260101-0001-ABC', '/api/messages', '/api/users', '/api/prices/items/R100', '/api/customers', '/api/admin/data', '/api/settings/google', '/api/blog/posts']) assert.equal((await call(env, p, { token: tr })).status, 403, `el Revisor no entra en ${p}`);
  assert.equal((await call(env, '/api/users', { token: tr, method: 'POST', body: { email: 'z@torivac.test', role: 'manager', password: 'Clave-Revision-2026!' } })).status, 403, 'no crea usuarios');
});
