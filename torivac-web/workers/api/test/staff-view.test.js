// Lo que ven la propietaria (rol client) y el comercial (rol reviewer, el Revisor) además de su panel: los mensajes de contacto y los presupuestos recibidos, SIN la IP ni el motivo técnico del correo.
// La propietaria lee y borra mensajes y edita y reenvía presupuestos; el comercial solo lee (editar, reenviar y borrar → 403 «Solo lectura»); un cliente con cuenta sigue sin ver mensajes. Igual que backend-php/api/tests/StaffViewTest.php.
import test from 'node:test';
import assert from 'node:assert/strict';
import { orderEnv, call, signIn, provider, contactPost, order, freshIp, PW } from './kit.js';
import { messageKey } from '../src/messages.js';

/** Entorno con manager, propietaria, comercial y cliente con sesión → { env, tj, to, tc, tu }. */
async function setup() {
  const env = await orderEnv();
  const tj = (await signIn(env, 'jefa@torivac.test', 'manager', { ip: freshIp() })).token, to = (await signIn(env, 'maria@torivac.test', 'client', { ip: freshIp() })).token;
  const tc = (await signIn(env, 'carlos.comercial@torivac.test', 'reviewer', { ip: freshIp() })).token, tu = (await signIn(env, 'luis.cliente@acme.test', 'customer', { ip: freshIp() })).token;
  return { env, tj, to, tc, tu };
}
/** Guarda un mensaje con IP y con un fallo de correo en el registro (como si el proveedor hubiera rechazado el envío) → su id. */
async function message(env) {
  const { j } = await contactPost(env, provider(), { name: 'Javier Mora', message: 'Necesito un toroidal de 300 VA' });
  const rec = JSON.parse(env.KV.m.get(messageKey(j.id)));
  rec.emailed = { sent: false, reason: 'failed', error: 'Resend 403: dominio sin verificar' };
  await env.KV.put(messageKey(j.id), JSON.stringify(rec));
  return j.id;
}

test('S1 · mensajes: el manager los ve completos; la propietaria y el comercial, sin ip ni emailed.error; un cliente con cuenta, nada', async () => {
  const { env, tj, to, tc, tu } = await setup(); const id = await message(env);
  const m = (await (await call(env, '/api/messages', { token: tj })).json()).items[0];
  assert.deepEqual([!!m.ip, m.emailed.error], [true, 'Resend 403: dominio sin verificar'], 'el manager ve la IP y el motivo técnico');
  for (const [who, tok] of [['propietaria', to], ['comercial', tc]]) {
    const r = await call(env, '/api/messages', { token: tok });
    assert.equal(r.status, 200, `${who}: ve los mensajes`);
    const x = (await r.json()).items[0];
    assert.deepEqual([x.id, x.name, x.message, 'ip' in x, 'error' in x.emailed, x.emailed.reason], [id, 'Javier Mora', 'Necesito un toroidal de 300 VA', false, false, 'failed'], `${who}: nombre y texto sí; IP y motivo técnico no`);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal((await call(env, '/api/messages', { token: tu })).status, 403, 'un cliente con cuenta no');
  assert.equal((await call(env, '/api/messages')).status, 401, 'sin sesión tampoco');
});

test('S2 · borrar un mensaje: el manager y la propietaria sí; el comercial no (403 y no se borra)', async () => {
  const { env, tj, to, tc } = await setup(); const a = await message(env), b = await message(env);
  assert.equal((await call(env, `/api/messages/${a}`, { method: 'DELETE', token: tc })).status, 403, 'el comercial no borra');
  assert.ok(env.KV.m.has(messageKey(a)), 'y no se borró');
  assert.equal((await call(env, `/api/messages/${a}`, { method: 'DELETE', token: to })).status, 200, 'la propietaria borra');
  assert.equal((await call(env, `/api/messages/${a}`, { method: 'DELETE', token: to })).status, 404, 'ya borrado: 404');
  assert.equal((await call(env, `/api/messages/${b}`, { method: 'DELETE', token: tj })).status, 200, 'el manager borra');
  assert.equal((await call(env, '/api/messages', { method: 'POST', token: tc, body: {} })).status, 404, 'otras rutas de mensajes: 404');
});

test('S3 · presupuestos: el comercial los ve todos (sin IP) pero no edita ni reenvía; no entra en precios, clientes, usuarios ni ajustes', async () => {
  const { env, to, tc } = await setup();
  const r0 = await call(env, '/api/order', { method: 'POST', body: order(), ip: freshIp(), deps: { fetchImpl: provider().fetchImpl } });
  const n = (await r0.json()).number;
  assert.ok(n, 'pedido de un visitante');
  const l = await (await call(env, '/api/orders', { token: tc })).json();
  assert.deepEqual([l.orders.map((x) => x.number), 'ip' in l.orders[0]], [[n], false], 'el comercial ve la lista, sin IP');
  const d = await (await call(env, `/api/orders/${n}`, { token: tc })).json();
  assert.deepEqual([d.order.number, 'ip' in d.order], [n, false], 'y el detalle, sin IP');
  assert.equal((await call(env, `/api/orders/${n}`, { method: 'PUT', token: tc, body: { rev: 0, lines: [] } })).status, 403, 'no edita');
  assert.equal((await call(env, `/api/orders/${n}/send`, { method: 'POST', token: tc, body: { to: ['a@b.es'] } })).status, 403, 'no reenvía');
  assert.equal((await call(env, '/api/orders/TV-20260101-0001-ABC', { method: 'PUT', token: tc, body: { rev: 0, lines: [] } })).status, 403, 'ni se mira si el número existe');
  assert.equal((await call(env, `/api/orders/${n}`, { token: to })).status, 200, 'la propietaria lo ve');
  for (const p of ['/api/prices/items/R100', '/api/customers', '/api/users', '/api/admin/data', '/api/settings/google', '/api/blog/posts', '/api/mail/status']) assert.equal((await call(env, p, { token: tc })).status, 403, `el comercial no entra en ${p}`);
});
