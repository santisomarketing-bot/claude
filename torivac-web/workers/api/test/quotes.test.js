// [PRUEBAS-PRESUPUESTOS] Presupuestos recibidos (docs/PRESUPUESTOS-RECIBIDOS.md, sección 5): el rol client (propietario) ve todos los pedidos sin IP; GET /api/orders/:número; PUT (editar con rev/409, precios manuales,
// original, history ≤ 50); POST send (reenvío con PDF, 1 a 3 destinatarios, topes, mail_off, historial y lastSent) y el correo quoteMail. Sin red: KV en memoria y proveedor de correo simulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTER } from './helpers.js';
import { call, signIn, orderEnv, order, provider, freshIp, keys, PDF_B64, REF, REF2 } from './kit.js';
import { quoteMail } from '../src/email.js';
import { rlKey } from '../src/ratelimit.js';
import { parseEdit, parseSend } from '../src/validate.js';
import items from '../src/generated/items.js';

const REF3 = 'P15355';                                                    // referencia real del catálogo SIN precio en el entorno de pruebas (sale «A consultar»)
const NOW = Date.parse('2026-10-29T10:00:00Z');
/** Entorno con precios de ejemplo, un propietario (client) y un manager ya con sesión. */
async function setup(extra = {}) {
  const env = await orderEnv(extra), jefa = await signIn(env, 'jefa@torivac.com', 'manager', { ip: '10.9.0.1' }), duena = await signIn(env, 'duena@torivac.com', 'client', { ip: '10.9.0.2' });
  return { env, jefa, duena };
}
/** Hace un pedido real por la API pública (el equipo y la copia salen con `box`) → su número. `over` sustituye campos del pedido de ejemplo. */
async function place(env, box = provider(), over = {}) {
  const j = await (await call(env, '/api/order', { method: 'POST', body: order(over), ip: freshIp(), deps: { fetchImpl: box.fetchImpl, now: new Date('2026-10-28T08:00:00Z') } })).json();
  assert.equal(j.ok, true, JSON.stringify(j)); return j.number;
}
/** Registro guardado en KV (sin pasar por la API). */
const stored = (env, n) => JSON.parse(env.KV.m.get(`order:${n}`));
/** Llamada autenticada: GET/PUT/POST a /api/orders/<resto>. */
const q = (env, who, rest, { method = 'GET', body, deps = {}, ip = '10.9.0.9' } = {}) => call(env, `/api/orders/${rest}`, { method, body, token: who && (who.token ?? who), ip, deps: { now: NOW, ...deps } });
/** Cuerpo mínimo válido del PUT con las líneas de ejemplo (REF×2 y REF2×3) y la revisión indicada. */
const edit = (rev, over = {}) => ({ rev, lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 3 }], ...over });
/** Cuerpo válido del POST send. */
const send = (over = {}) => ({ to: ['cliente@empresa.com'], message: 'Adjunto el presupuesto revisado.', pdf: PDF_B64, ...over });
/** Cambia la tarifa vigente (precios de REF y REF2) para comprobar qué líneas se revaloran. */
const setPrices = (env, p1, p2, at = '2026-10-29T00:00:00Z') => env.KV.put('prices:current', JSON.stringify({ updated_at: at, source: 'test', currency: 'EUR', mode: 'live', items: { [REF]: { p: p1 }, [REF2]: { p: p2, t: [[10, p2 - 1]] } } }));

// ───────────────────────────────────────── 1 · listado del propietario
test('Presupuestos · client (propietario) ve TODOS los pedidos de varios correos, sin ip ni emailed.error; el manager los ve con ambos', async () => {
  const { env, jefa, duena } = await setup(), fail = provider({ status: 403, reply: { message: 'dominio no verificado' } });
  const n1 = await place(env, fail, { customer: { name: 'Uno', email: 'uno@a.es', privacy: true } }), n2 = await place(env, fail, { customer: { name: 'Dos', email: 'dos@b.es', privacy: true } }), n3 = await place(env, fail, { customer: { name: 'Tres', email: 'tres@c.es', privacy: true } });
  const own = (await (await call(env, '/api/orders', { token: duena.token, deps: { now: NOW } })).json()).orders, mgr = (await (await call(env, '/api/orders', { token: jefa.token, deps: { now: NOW } })).json()).orders;
  assert.deepEqual(own.map((o) => o.number).sort(), [n1, n2, n3].sort()); assert.deepEqual(mgr.map((o) => o.number).sort(), [n1, n2, n3].sort());
  assert.ok(own.every((o) => !('ip' in o) && o.emailed && !('error' in o.emailed)), 'el propietario no ve ip ni emailed.error');
  assert.ok(mgr.every((o) => typeof o.ip === 'string' && o.emailed.error), 'el manager ve ip y emailed.error');
});

// ───────────────────────────────────────── 2 · GET /api/orders/:número
test('Presupuestos · GET /orders/:n: 200 según el rol (con y sin ip), también con el token maestro', async () => {
  const { env, jefa, duena } = await setup(), fail = provider({ status: 403 }), n = await place(env, fail);
  const m = await q(env, jefa, n); assert.equal(m.status, 200); const mj = await m.json();
  assert.deepEqual(Object.keys(mj).sort(), ['ok', 'order']); assert.equal(mj.order.number, n); assert.equal(typeof mj.order.ip, 'string'); assert.ok(mj.order.emailed.error);
  const c = await (await q(env, duena, n)).json(); assert.equal(c.ok, true); assert.equal(c.order.number, n); assert.ok(!('ip' in c.order) && !('error' in c.order.emailed));
  assert.equal((await q(env, MASTER, n)).status, 200);
});
test('Presupuestos · GET /orders/:n: 404 si no existe y con cualquier número raro (nunca se usa el texto de la URL para tocar KV); 401 sin sesión', async () => {
  const { env, jefa, duena } = await setup(); await place(env);
  const gets = []; const kvGet = env.KV.get.bind(env.KV); env.KV.get = async (k) => { gets.push(k); return kvGet(k); };
  const raros = ['TV-20261028-9999-ZZZ', 'TV-20261028-0001-abc', 'TV-2026102-0001', 'TV-20261028-0001-ABCD', 'TV-20261028-0001-AB', '..%2F..%2Fetc%2Fpasswd', 'constructor', '__proto__', 'TV-20261028-0001-ABC%20', 'TV-20261028-0001-ABC%0A', '%00', '%20', 'TV-20261028-0001-ABC%2Fsend', 'x'.repeat(700), 'TV-20261028-0001-%41%42%43'];
  for (const raro of raros) for (const who of [jefa, duena]) {
    const r = await q(env, who, raro); assert.equal(r.status, 404, raro);
    const j = await r.json(); assert.equal(j.ok, false);
    assert.equal(j.error, 'No existe ese presupuesto', raro);
    assert.deepEqual(Object.keys(j).sort(), ['error', 'ok']);
  }
  assert.ok(!gets.some((k) => k.startsWith('order:') && !/^order:TV-20261028-9999-ZZZ$/.test(k)), 'solo se lee KV con números de forma válida: ' + gets.filter((k) => k.startsWith('order:')).join(','));
  for (const raro of ['%2e%2e', '..', '%2e%2e%2f%2e%2e', '%2E%2E/orders/x']) for (const who of [jefa, duena]) {                      // la URL ya los resuelve FUERA de /api/orders/ (WHATWG): nunca 200 ni se lee ningún pedido
    const r = await q(env, who, raro); assert.ok([403, 404].includes(r.status), `${raro} → ${r.status}`);
  }
  assert.equal((await q(env, jefa, 'TV-20261028-9999-ZZZ')).status, 404);
  for (const [method, rest, body] of [['GET', 'TV-20261028-0001-AAA'], ['PUT', 'TV-20261028-0001-AAA', edit(0)], ['POST', 'TV-20261028-0001-AAA/send', send()]]) {
    assert.equal((await q(env, null, rest, { method, body })).status, 401, `${method} sin sesión`);
    assert.equal((await q(env, 'token-falso', rest, { method, body })).status, 401, `${method} con token falso`);
  }
});

// ───────────────────────────────────────── 3 · PUT /api/orders/:número
test('Presupuestos · PUT: edita solicitante y líneas, conserva el unit de las líneas sin tocar aunque la tarifa cambie, revalora al cambiar qty y guarda original, rev, edited e history', async () => {
  const { env, jefa } = await setup(), n = await place(env), before = stored(env, n);
  assert.deepEqual(before.lines.map((l) => [l.ref, l.qty, l.unit, l.total]), [[REF, 2, 67.65, 135.3], [REF2, 3, 15.82, 47.46]]);
  await setPrices(env, 70, 20);                                                                                      // la tarifa de hoy es otra
  const body = edit(0, { customer: { name: 'Ana Pérez López', company: 'ACME SL', email: 'ANA@acme.es', phone: '600 111', notes: 'Entrega en nave 2' }, lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 12 }, { ref: REF3, qty: 4 }], quoteNote: 'Validez de la oferta: 30 días.\nPortes no incluidos.' });
  const r = await q(env, jefa, n, { method: 'PUT', body }); assert.equal(r.status, 200); const j = await r.json(); assert.deepEqual(Object.keys(j).sort(), ['ok', 'order']);
  const o = j.order;
  assert.deepEqual(o.customer, { name: 'Ana Pérez López', company: 'ACME SL', email: 'ana@acme.es', phone: '600 111', notes: 'Entrega en nave 2' });
  assert.deepEqual(o.lines[0], { ref: REF, qty: 2, unit: 67.65, total: 135.3 }, 'sin tocar: se conserva el precio de cuando se pidió, no el de la tarifa de hoy');
  assert.deepEqual(o.lines[1], { ref: REF2, qty: 12, unit: 19, total: 228 }, 'qty cambiada: tarifa vigente para esa cantidad (tramo de 10)');
  assert.deepEqual(o.lines[2], { ref: REF3, qty: 4, unit: null, total: null }, 'línea nueva sin precio: A consultar');
  assert.equal(o.total, 363.3); assert.equal(o.unpriced, 1);
  assert.equal(o.rev, 1); assert.deepEqual(o.edited, { at: new Date(NOW).toISOString(), by: 'jefa@torivac.com' });
  assert.deepEqual(o.original, { at: before.at, customer: before.customer, lines: before.lines, total: before.total, unpriced: before.unpriced }, 'lo que llegó de la web');
  assert.equal(o.quoteNote, 'Validez de la oferta: 30 días.\nPortes no incluidos.');
  assert.deepEqual(o.history, [{ at: new Date(NOW).toISOString(), by: 'jefa@torivac.com', kind: 'edit', rev: 1 }]);
  assert.deepEqual(o.prices, { updated_at: '2026-10-29T00:00:00Z', mode: 'live' }, 'al revalorar con la tarifa vigente, prices pasa a ser la de ahora');
  assert.equal(o.ip, before.ip); assert.deepEqual(o.emailed, before.emailed); assert.equal(o.number, n); assert.equal(o.at, before.at);
  assert.deepEqual(stored(env, n), o, 'lo guardado es lo devuelto');
});
test('Presupuestos · PUT: price fija el unitario a mano (manual), price:null vuelve a la tarifa, el precio manual se conserva si no se toca y original se guarda UNA sola vez', async () => {
  const { env, jefa } = await setup(), n = await place(env), before = stored(env, n);
  let r = await (await q(env, jefa, n, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 2, price: 10.5 }, { ref: REF2, qty: 3, price: 0 }] }) })).json();
  assert.deepEqual(r.order.lines, [{ ref: REF, qty: 2, unit: 10.5, total: 21, manual: true }, { ref: REF2, qty: 3, unit: 0, total: 0, manual: true }]); assert.equal(r.order.total, 21); assert.equal(r.order.unpriced, 0);
  assert.equal(r.order.prices.updated_at, before.prices.updated_at, 'nada se revaloró con la tarifa: prices no cambia');
  r = await (await q(env, jefa, n, { method: 'PUT', body: edit(1, { lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 3, price: 12.3456 }] }) })).json();
  assert.deepEqual(r.order.lines, [{ ref: REF, qty: 2, unit: 10.5, total: 21, manual: true }, { ref: REF2, qty: 3, unit: 12.3456, total: 37.04, manual: true }], 'sin price y misma qty: se conserva, también lo manual');
  assert.equal(r.order.rev, 2); assert.deepEqual(r.order.original, { at: before.at, customer: before.customer, lines: before.lines, total: before.total, unpriced: before.unpriced }, 'original NO se pisa en la segunda edición');
  r = await (await q(env, jefa, n, { method: 'PUT', body: edit(2, { lines: [{ ref: REF, qty: 2, price: null }, { ref: REF2, qty: 5 }] }) })).json();
  assert.deepEqual(r.order.lines, [{ ref: REF, qty: 2, unit: 67.65, total: 135.3 }, { ref: REF2, qty: 5, unit: 15.82, total: 79.1 }], 'null vuelve a la tarifa y qty cambiada también; manual desaparece');
  assert.equal(r.order.total, 214.4); assert.deepEqual(r.order.history.map((h) => [h.kind, h.rev]), [['edit', 1], ['edit', 2], ['edit', 3]]);
});
test('Presupuestos · PUT: customer y quoteNote son opcionales (si faltan se conservan); quoteNote "" la quita; el token maestro firma como «maestro»', async () => {
  const { env, jefa } = await setup(), n = await place(env), before = stored(env, n);
  let o = (await (await q(env, jefa, n, { method: 'PUT', body: edit(0, { quoteNote: 'Entrega en 10 días' }) })).json()).order;
  assert.deepEqual(o.customer, before.customer, 'sin customer en el cuerpo: igual'); assert.equal(o.quoteNote, 'Entrega en 10 días');
  o = (await (await q(env, jefa, n, { method: 'PUT', body: edit(1) })).json()).order; assert.equal(o.quoteNote, 'Entrega en 10 días', 'sin quoteNote: se conserva');
  o = (await (await q(env, MASTER, n, { method: 'PUT', body: edit(2, { quoteNote: '' }) })).json()).order; assert.ok(!('quoteNote' in o), 'cadena vacía = quitarla'); assert.equal(o.edited.by, 'maestro'); assert.equal(o.history[2].by, 'maestro');
});
test('Presupuestos · PUT: el propietario (client) también edita, pero la respuesta no lleva ip ni emailed.error; en KV el registro conserva ip y emailed', async () => {
  const { env, duena } = await setup(), n = await place(env, provider({ status: 403 })), before = stored(env, n);
  const j = await (await q(env, duena, n, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 7 }] }) })).json();
  assert.equal(j.ok, true); assert.ok(!('ip' in j.order) && !('error' in j.order.emailed)); assert.equal(j.order.edited.by, 'duena@torivac.com');
  const s = stored(env, n); assert.equal(s.ip, before.ip); assert.deepEqual(s.emailed, before.emailed); assert.ok(s.emailed.error, 'el error del correo sigue guardado');
  assert.ok(env.KV.exp.get(`order:${n}`) > Date.now() / 1000 + 399 * 86400, 'se guarda con el plazo de 400 días desde esta edición');
});
test('Presupuestos · PUT: history se corta en 50 entradas (se descartan las más antiguas)', async () => {
  const { env, jefa } = await setup(), n = await place(env); let rev = 0, o;
  for (let i = 0; i < 53; i++) { const r = await q(env, jefa, n, { method: 'PUT', body: edit(rev, { lines: [{ ref: REF, qty: (i % 9) + 1 }] }), deps: { now: NOW + i * 1000 } }); assert.equal(r.status, 200, `edición ${i + 1}`); o = (await r.json()).order; rev = o.rev; }
  assert.equal(o.rev, 53); assert.equal(o.history.length, 50); assert.equal(o.history[0].rev, 4, 'las 3 primeras se descartaron'); assert.equal(o.history[49].rev, 53);
});
test('Presupuestos · PUT: 409 con una revisión vieja (con el registro actual) y sin cambiar nada', async () => {
  const { env, jefa, duena } = await setup(), n = await place(env);
  assert.equal((await q(env, jefa, n, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 9 }] }) })).status, 200);
  const antes = env.KV.m.get(`order:${n}`);
  const r = await q(env, duena, n, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 1 }] }) }), j = await r.json();
  assert.equal(r.status, 409); assert.deepEqual(Object.keys(j).sort(), ['code', 'error', 'ok', 'order']); assert.equal(j.ok, false); assert.equal(j.code, 'conflict');
  assert.equal(j.error, 'Alguien ha modificado este presupuesto: recarga y vuelve a intentarlo'); assert.equal(j.order.rev, 1); assert.equal(j.order.lines[0].qty, 9); assert.ok(!('ip' in j.order), 'el 409 al propietario tampoco lleva ip');
  assert.equal(env.KV.m.get(`order:${n}`), antes, 'no se guardó nada');
  assert.equal((await q(env, duena, n, { method: 'PUT', body: edit(5) })).status, 409, 'una revisión futura tampoco coincide');
  assert.equal((await q(env, duena, n, { method: 'PUT', body: edit(1, { lines: [{ ref: REF, qty: 1 }] }) })).status, 200, 'con la revisión actual sí');
});
test('Presupuestos · PUT: 400 con ref desconocida, repetida, qty no válida, precio no válido, texto con HTML, correo malo, nombre corto, rev ausente o cuerpo roto; 404 antes que 400; el registro no cambia', async () => {
  const { env, jefa } = await setup(), n = await place(env), antes = env.KV.m.get(`order:${n}`);
  /** Solicitante válido de ejemplo con los campos que se indiquen cambiados. */
  const cust = (o) => ({ name: 'Ana Pérez', company: '', email: 'ana@acme.es', phone: '', notes: '', ...o });
  const casos = [
    ['ref desconocida', edit(0, { lines: [{ ref: 'NOEXISTE', qty: 1 }] }), 'Referencia desconocida: NOEXISTE'], ['ref vacía', edit(0, { lines: [{ qty: 1 }] }), 'Referencia desconocida: (vacía)'],
    ['constructor', edit(0, { lines: [{ ref: 'constructor', qty: 1 }] }), 'Referencia desconocida: constructor'],
    ['repetida', edit(0, { lines: [{ ref: REF, qty: 1 }, { ref: REF, qty: 2 }] }), `Línea repetida: ${REF}`],
    ['qty 0', edit(0, { lines: [{ ref: REF, qty: 0 }] }), `Cantidad no válida para ${REF}`], ['qty decimal', edit(0, { lines: [{ ref: REF, qty: 1.5 }] }), `Cantidad no válida para ${REF}`],
    ['qty texto', edit(0, { lines: [{ ref: REF, qty: '3' }] }), `Cantidad no válida para ${REF}`], ['qty enorme', edit(0, { lines: [{ ref: REF, qty: 1_000_001 }] }), `Cantidad no válida para ${REF}`],
    ['price negativo', edit(0, { lines: [{ ref: REF, qty: 1, price: -1 }] }), `Precio no válido para ${REF}`], ['price 5 decimales', edit(0, { lines: [{ ref: REF, qty: 1, price: 1.23456 }] }), `Precio no válido para ${REF}`],
    ['price texto', edit(0, { lines: [{ ref: REF, qty: 1, price: '2' }] }), `Precio no válido para ${REF}`], ['price enorme', edit(0, { lines: [{ ref: REF, qty: 1, price: 10_000_001 }] }), `Precio no válido para ${REF}`],
    ['sin líneas', edit(0, { lines: [] }), 'El presupuesto está vacío'], ['lines no es lista', edit(0, { lines: 'x' }), 'El presupuesto está vacío'],
    ['201 líneas', edit(0, { lines: Array.from({ length: 201 }, (_, i) => ({ ref: Object.keys(items)[i], qty: 1 })) }), 'Demasiadas líneas (máx. 200)'],
    ['nombre corto', edit(0, { customer: cust({ name: 'A' }) }), 'Falta el nombre'], ['correo malo', edit(0, { customer: cust({ email: 'ana@@acme' }) }), 'Correo no válido'],
    ['HTML en empresa', edit(0, { customer: cust({ company: '<script>alert(1)</script>' }) }), null, { code: 'plain_text', field: 'company' }],
    ['HTML en notas', edit(0, { customer: cust({ notes: 'hola <img src=x onerror=alert(1)>' }) }), null, { code: 'plain_text', field: 'notes' }],
    ['nombre largo', edit(0, { customer: cust({ name: 'N'.repeat(81) }) }), null, { code: 'too_long', field: 'name' }],
    ['cliente sin una clave', edit(0, { customer: { name: 'Ana Pérez', email: 'ana@acme.es' } }), 'Petición no válida'], ['cliente con número', edit(0, { customer: cust({ phone: 600 }) }), 'Petición no válida'],
    ['cliente no es objeto', edit(0, { customer: 'Ana' }), 'Petición no válida'],
    ['nota con HTML', edit(0, { quoteNote: '<b>oferta</b>' }), null, { code: 'plain_text', field: 'quoteNote' }], ['nota larga', edit(0, { quoteNote: 'x'.repeat(1001) }), null, { code: 'too_long', field: 'quoteNote' }],
    ['nota 3 enlaces', edit(0, { quoteNote: 'http://a.es http://b.es http://c.es' }), null, { code: 'too_many_links', field: 'quoteNote' }], ['nota no es texto', edit(0, { quoteNote: 5 }), 'Petición no válida'],
    ['sin rev', { lines: [{ ref: REF, qty: 1 }] }, 'Falta rev: la revisión del presupuesto que cargaste', { field: 'rev' }], ['rev texto', edit('0'), 'Falta rev: la revisión del presupuesto que cargaste', { field: 'rev' }], ['rev negativa', edit(-1), 'Falta rev: la revisión del presupuesto que cargaste', { field: 'rev' }], ['rev decimal', edit(0.5), 'Falta rev: la revisión del presupuesto que cargaste', { field: 'rev' }],
    ['customer null', edit(0, { customer: null }), 'Petición no válida'], ['quoteNote null', edit(0, { quoteNote: null }), 'Petición no válida'],
    ['cuerpo vacío', undefined, 'Petición no válida'], ['no es JSON', 'esto no es json', 'Petición no válida'], ['lista', [1, 2], 'Petición no válida'],
  ];
  for (const [nombre, body, error, extra] of casos) {
    const r = await q(env, jefa, n, { method: 'PUT', body }), j = await r.json();
    assert.equal(r.status, 400, nombre); assert.equal(j.ok, false, nombre); if (error) { assert.equal(j.error, error, nombre); assert.deepEqual(Object.keys(j).sort(), extra ? ['error', 'field', 'ok'] : ['error', 'ok'], nombre); }
    if (extra) { assert.equal(j.code, extra.code, nombre); assert.equal(j.field, extra.field, nombre); assert.ok(j.error, nombre); }
  }
  const grande = await q(env, jefa, n, { method: 'PUT', body: edit(0, { quoteNote: 'a'.repeat(120_000) }) }); assert.equal(grande.status, 413); assert.deepEqual(await grande.json(), { ok: false, error: 'La petición es demasiado grande' });
  assert.equal(env.KV.m.get(`order:${n}`), antes, 'ninguna petición mala cambió el registro');
  assert.equal((await q(env, jefa, 'TV-20261028-9999-ZZZ', { method: 'PUT', body: 'basura' })).status, 404, 'un presupuesto inexistente da 404 aunque el cuerpo sea malo');
});

// ───────────────────────────────────────── 4 · POST /api/orders/:número/send
test('Presupuestos · send: manda a 1 destinatario con el PDF adjunto, asunto fijo, Reply-To del equipo y copia al emisor; responde sent:true y anota history y lastSent', async () => {
  const { env, duena } = await setup(), n = await place(env), box = provider();
  const r = await q(env, duena, `${n}/send`, { method: 'POST', body: send({ to: ['Cliente@Empresa.com'] }), deps: { fetchImpl: box.fetchImpl } }), j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(Object.keys(j).sort(), ['ok', 'order', 'reason', 'sent']); assert.equal(j.ok, true); assert.equal(j.sent, true); assert.equal(j.reason, 'sent');
  assert.equal(box.calls.length, 1); const m = box.calls[0].body;
  assert.deepEqual(m.to, ['cliente@empresa.com']); assert.deepEqual(m.cc, ['duena@torivac.com']); assert.equal(m.reply_to, 'info@grupotorivac.com'); assert.equal(m.subject, `Torivac · presupuesto ${n}`);
  assert.deepEqual(m.attachments, [{ filename: `${n}.pdf`, content: PDF_B64 }]); assert.ok(m.html.includes('Adjunto el presupuesto revisado.') && m.text.includes('Adjunto el presupuesto revisado.'));
  const at = new Date(NOW).toISOString(), h = j.order.history; assert.deepEqual(h[h.length - 1], { at, by: 'duena@torivac.com', kind: 'send', rev: 0, to: ['cliente@empresa.com'], ok: true, reason: 'sent' });
  assert.deepEqual(j.order.lastSent, { at, by: 'duena@torivac.com', to: ['cliente@empresa.com'], ok: true, reason: 'sent' }); assert.ok(!('ip' in j.order), 'el propietario no ve la ip');
  assert.deepEqual(stored(env, n).lastSent, j.order.lastSent, 'guardado en KV'); assert.equal(stored(env, n).rev, undefined, 'reenviar no es editar: no sube rev');
});
test('Presupuestos · send: hasta 3 destinatarios (sin repetir, en minúsculas); copyToMe false o el token maestro no ponen cc; no se pone cc si el emisor ya es destinatario', async () => {
  const { env, jefa } = await setup(), n = await place(env), box = provider();
  /** POST send como `who` con ese cuerpo; comprueba el 200 y devuelve el cuerpo del último correo enviado. */
  const go = async (who, body) => { const r = await q(env, who, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } }); assert.equal(r.status, 200); return box.calls[box.calls.length - 1].body; };
  let m = await go(jefa, send({ to: ['a@x.es', 'B@x.es', 'c@x.es', 'a@X.es'] })); assert.deepEqual(m.to, ['a@x.es', 'b@x.es', 'c@x.es']); assert.deepEqual(m.cc, ['jefa@torivac.com']);
  m = await go(jefa, send({ copyToMe: false })); assert.ok(!('cc' in m), 'copyToMe:false → sin cc');
  m = await go(jefa, send({ copyToMe: true, to: ['JEFA@torivac.com'] })); assert.ok(!('cc' in m), 'ya va en to: no se duplica');
  m = await go(MASTER, send({ copyToMe: true })); assert.ok(!('cc' in m), 'el token maestro no tiene correo');
  m = await go(jefa, { to: ['a@x.es'], pdf: PDF_B64 }); assert.deepEqual(m.cc, ['jefa@torivac.com'], 'copyToMe es true por defecto'); assert.ok(!m.html.includes('undefined'), 'sin mensaje: sin hueco');
  const e = await go(jefa, { to: ['a@x.es'], pdf: PDF_B64, message: '' }); assert.ok(e.html);
});
test('Presupuestos · send: 400 con 4 destinatarios, correo malo, sin to, sin pdf, PDF falso o enorme, mensaje con HTML, demasiado largo o no es texto; 404 antes que 400; no se envía ni se anota nada', async () => {
  const { env, jefa } = await setup(), n = await place(env), box = provider(), antes = env.KV.m.get(`order:${n}`), enviados0 = box.calls.length;
  const falso = Buffer.from('esto no es un pdf, pero es base64 válido').toString('base64');
  const casos = [
    ['4 destinatarios', send({ to: ['a@x.es', 'b@x.es', 'c@x.es', 'd@x.es'] }), 'Máximo 3 destinatarios', { field: 'to' }], ['to vacío', send({ to: [] }), 'Indica al menos un destinatario', { field: 'to' }], ['sin to', { message: 'hola', pdf: PDF_B64 }, 'Indica al menos un destinatario', { field: 'to' }],
    ['to es texto', send({ to: 'a@x.es' }), 'Indica al menos un destinatario', { field: 'to' }], ['to con número', send({ to: [5] }), 'Petición no válida'],
    ['correo malo', send({ to: ['no-es-correo'] }), 'Correo de destino no válido', { field: 'to' }], ['una coma cuela a un tercero', send({ to: ['a@x.es,b@x.es'] }), 'Correo de destino no válido', { field: 'to' }], ['uno bueno y uno malo', send({ to: ['a@x.es', 'b@@x'] }), 'Correo de destino no válido', { field: 'to' }],
    ['sin pdf', { to: ['a@x.es'], message: 'hola' }, 'PDF adjunto no válido', { field: 'pdf' }], ['pdf null', send({ pdf: null }), 'PDF adjunto no válido', { field: 'pdf' }], ['pdf vacío', send({ pdf: '' }), 'PDF adjunto no válido', { field: 'pdf' }],
    ['pdf falso', send({ pdf: falso }), 'PDF adjunto no válido', { field: 'pdf' }], ['pdf no base64', send({ pdf: '%PDF-1.4 !!!' }), 'PDF adjunto no válido', { field: 'pdf' }], ['pdf de 4,1 MB', send({ pdf: Buffer.from('%PDF-' + 'x'.repeat(4_100_000)).toString('base64') }), 'PDF adjunto no válido', { field: 'pdf' }],
    ['mensaje con HTML', send({ message: 'Hola <script>alert(1)</script>' }), null, { code: 'plain_text', field: 'message' }], ['mensaje con enlace html', send({ message: '<a href="http://x.es">pulsa</a>' }), null, { code: 'plain_text', field: 'message' }],
    ['mensaje largo', send({ message: 'x'.repeat(1501) }), null, { code: 'too_long', field: 'message' }], ['mensaje 3 enlaces', send({ message: 'http://a.es http://b.es http://c.es' }), null, { code: 'too_many_links', field: 'message' }],
    ['mensaje no es texto', send({ message: ['x'] }), 'Petición no válida'], ['cuerpo vacío', undefined, 'Petición no válida'], ['lista', [1], 'Petición no válida'],
  ];
  for (const [nombre, body, error, extra] of casos) {
    const r = await q(env, jefa, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } }), j = await r.json();
    assert.equal(r.status, 400, nombre); assert.equal(j.ok, false, nombre); if (error) { assert.equal(j.error, error, nombre); assert.deepEqual(Object.keys(j).sort(), extra ? ['error', 'field', 'ok'] : ['error', 'ok'], nombre); }
    if (extra) { assert.equal(j.code, extra.code, nombre); assert.equal(j.field, extra.field, nombre); }
  }
  const enorme = await q(env, jefa, `${n}/send`, { method: 'POST', body: send({ pdf: Buffer.from('%PDF-' + 'x'.repeat(4_500_000)).toString('base64') }), deps: { fetchImpl: box.fetchImpl } }); assert.equal(enorme.status, 413, 'cuerpo de más de 6 MB'); assert.equal((await enorme.json()).error, 'La petición es demasiado grande');
  assert.equal(box.calls.length, enviados0, 'no se envió nada'); assert.equal(env.KV.m.get(`order:${n}`), antes, 'no se anotó nada')
  assert.equal((await q(env, jefa, 'TV-20261028-9999-ZZZ/send', { method: 'POST', body: 'basura', deps: { fetchImpl: box.fetchImpl } })).status, 404);
  const sinCupo = await q(env, jefa, `${n}/send`, { method: 'POST', body: send(), deps: { fetchImpl: box.fetchImpl } }); assert.equal(sinCupo.status, 200);
});
test('Presupuestos · send: el asunto y el texto fijo salen en el idioma del pedido (es, en, fr, de) y la ficha lleva el nombre del catálogo', async () => {
  const { env, jefa } = await setup(); const esperado = { es: ['Torivac · presupuesto', 'Importe'], en: ['Torivac · quote', 'Amount'], fr: ['Torivac · devis', 'Montant'], de: ['Torivac · Angebot', 'Betrag'] };
  for (const [lang, [asunto, etiqueta]] of Object.entries(esperado)) {
    const n = await place(env, provider(), { lang }), box = provider();
    assert.equal((await q(env, jefa, `${n}/send`, { method: 'POST', body: send(), deps: { fetchImpl: box.fetchImpl } })).status, 200);
    const m = box.calls[0].body; assert.equal(m.subject, `${asunto} ${n}`, lang); assert.ok(m.html.includes(`>${etiqueta}<`), `${lang}: etiqueta ${etiqueta}`); assert.ok(m.html.includes(items[REF].n), 'nombre del catálogo');
  }
});
test('Presupuestos · send: el mensaje de la persona y la nota salen ESCAPADOS (saltos de línea → <br>) y la tabla lleva los precios GUARDADOS, no los de la tarifa', async () => {
  const { env, jefa } = await setup(), n = await place(env);
  await q(env, jefa, n, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 2, price: 55.55 }, { ref: REF2, qty: 3 }], quoteNote: 'Pago a 30 días & "portes" <incluidos>\nSegunda línea' }) });
  await setPrices(env, 999, 888);                                                                                    // la tarifa de hoy no debe colarse
  const box = provider(); const msg = 'Hola & gracias, <3 "ok" \'sí\'\nUn saludo';
  assert.equal((await q(env, jefa, `${n}/send`, { method: 'POST', body: send({ message: msg }), deps: { fetchImpl: box.fetchImpl } })).status, 200);
  const m = box.calls[0].body;
  assert.ok(m.html.includes('Hola &amp; gracias, &lt;3 &quot;ok&quot; &#39;sí&#39;<br>Un saludo'), 'mensaje escapado con <br>'); assert.ok(!m.html.includes('<3') && !m.html.includes('Hola & gracias'));
  assert.ok(m.html.includes('Pago a 30 días &amp; &quot;portes&quot; &lt;incluidos&gt;<br>Segunda línea'), 'nota escapada'); assert.ok(m.text.includes('Hola & gracias, <3 "ok"') && m.text.includes('Nota del presupuesto'), 'la versión de texto lleva el texto tal cual');
  assert.ok(m.html.includes('55,55') && m.html.includes('111,10'), 'precio manual guardado y su importe'); assert.ok(m.html.includes('15,82') && m.html.includes('47,46'), 'la línea sin tocar conserva su precio de entonces');
  assert.ok(!m.html.includes('999') && !m.html.includes('888'), 'nada de la tarifa de hoy'); assert.ok(m.html.includes('158,56'), 'total del registro (111,10 + 47,46)');
});
test('Presupuestos · send: topes — 20 por hora y persona (el 21.º da 429 y vuelve a la hora siguiente), por persona y no global; los fallos también gastan cupo', async () => {
  const { env, jefa, duena } = await setup(), n = await place(env), box = provider(), body = send();
  /** POST send como `who`, `ms` milisegundos después del instante base de la prueba → Response. */
  const go = (who, ms = 0) => q(env, who, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl, now: NOW + ms } });
  for (let i = 1; i <= 20; i++) assert.equal((await go(jefa, i * 1000)).status, 200, `envío ${i}`);
  const r = await go(jefa, 21_000), j = await r.json(); assert.equal(r.status, 429); assert.deepEqual(j, { ok: false, error: 'Demasiados reenvíos seguidos. Espera un rato.' }); assert.equal(box.calls.length, 20, 'el 21.º no se envió');
  assert.equal((await go(duena, 22_000)).status, 200, 'otra persona tiene su propio tope'); assert.equal((await go(jefa, 61 * 60_000)).status, 200, 'pasada la hora, vuelve a poder');
  const malo = provider({ status: 403 }); const env2 = (await setup()).env; const n2 = await place(env2), jefa2 = await signIn(env2, 'jefa2@torivac.com', 'manager', { ip: '10.9.0.3' });
  for (let i = 0; i < 20; i++) assert.equal((await q(env2, jefa2, `${n2}/send`, { method: 'POST', body, deps: { fetchImpl: malo.fetchImpl, now: NOW + i } })).status, 200);
  assert.equal((await q(env2, jefa2, `${n2}/send`, { method: 'POST', body, deps: { fetchImpl: malo.fetchImpl, now: NOW + 99 } })).status, 429, 'los envíos fallidos no devuelven el cupo');
});
test('Presupuestos · send: tope diario total (ORDER_SEND_DAILY_MAX, 150 por defecto; 0 = sin tope diario)', async () => {
  const { env, jefa, duena } = await setup({ ORDER_SEND_DAILY_MAX: '3' }), n = await place(env), box = provider(), body = send();
  /** POST send como `who`, `ms` milisegundos después del instante base de la prueba → Response. */
  const go = (who, ms) => q(env, who, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl, now: NOW + ms } });
  assert.equal((await go(jefa, 1)).status, 200); assert.equal((await go(duena, 2)).status, 200); assert.equal((await go(jefa, 3)).status, 200);
  const r = await go(duena, 4); assert.equal(r.status, 429); assert.equal((await r.json()).error, 'Demasiados reenvíos seguidos. Espera un rato.'); assert.equal(box.calls.length, 3);
  assert.equal((await go(jefa, 24 * 3_600_000 + 10)).status, 200, 'al día siguiente se renueva');
  const cero = await setup({ ORDER_SEND_DAILY_MAX: '0' }), n0 = await place(cero.env); for (let i = 0; i < 3; i++) assert.equal((await q(cero.env, cero.jefa, `${n0}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl, now: NOW + i } })).status, 200, '0 = sin tope diario (el tope por hora y persona sigue)');
  const def = await setup({ ORDER_SEND_DAILY_MAX: 'mucho' }), nd = await place(def.env); assert.equal((await q(def.env, def.jefa, `${nd}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } })).status, 200, 'un valor ilegible vale 150');
});
test('Presupuestos · send: sin correo configurado → 409 mail_off, sin historial y sin gastar cupo', async () => {
  const { env, jefa } = await setup({ EMAIL_PROVIDER: 'none' }), n = await place(env), box = provider(), antes = env.KV.m.get(`order:${n}`), body = send();
  for (let i = 0; i < 25; i++) {
    const r = await q(env, jefa, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } }), j = await r.json();
    assert.equal(r.status, 409); assert.deepEqual(j, { ok: false, code: 'mail_off', error: 'El correo no está configurado: el presupuesto no se puede enviar desde aquí. Descarga el PDF y envíalo tú.' });
  }
  assert.equal(box.calls.length, 0); assert.equal(env.KV.m.get(`order:${n}`), antes, 'sin historial'); assert.equal(env.KV.m.has(await rlKey('qsend', 'jefa@torivac.com')) || env.KV.m.has(await rlKey('qsendday', 'all')), false, 'no se reservó ningún cupo');
  delete env.EMAIL_PROVIDER; assert.equal((await q(env, jefa, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } })).status, 200, 'sin haber gastado cupo, 25 intentos después sigue pudiendo enviar');
  const sinClave = await setup({ RESEND_API_KEY: undefined }), ns = await place(sinClave.env, provider()); assert.equal((await q(sinClave.env, sinClave.jefa, `${ns}/send`, { method: 'POST', body })).status, 409, 'sin clave del proveedor también');
});
test('Presupuestos · send: si el proveedor falla NO es un error HTTP: sent:false, reason failed, history ok:false y lastSent; el texto del error solo lo ve un manager y sin secretos', async () => {
  const { env, jefa, duena } = await setup(), n = await place(env), box = provider({ status: 403, reply: { message: 'La clave re_test no vale' } }), body = send();
  const m = await q(env, jefa, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } }), mj = await m.json();
  assert.equal(m.status, 200); assert.equal(mj.ok, true); assert.equal(mj.sent, false); assert.equal(mj.reason, 'failed'); assert.ok(mj.error && !mj.error.includes('re_test'), 'error limpio de secretos: ' + mj.error); assert.deepEqual(Object.keys(mj).sort(), ['error', 'ok', 'order', 'reason', 'sent']);
  assert.deepEqual(mj.order.lastSent, { at: new Date(NOW).toISOString(), by: 'jefa@torivac.com', to: ['cliente@empresa.com'], ok: false, reason: 'failed' }); assert.equal(mj.order.history.at(-1).ok, false); assert.equal(mj.order.history.at(-1).reason, 'failed');
  assert.ok(!JSON.stringify(stored(env, n).history).includes('re_test') && !('error' in stored(env, n).lastSent), 'el error del proveedor no se guarda en el historial');
  const c = await (await q(env, duena, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: box.fetchImpl } })).json();
  assert.equal(c.sent, false); assert.ok(!('error' in c), 'el propietario no recibe el texto del error'); assert.deepEqual(Object.keys(c).sort(), ['ok', 'order', 'reason', 'sent']); assert.equal(c.order.history.length, 2);
  const caida = provider({ throws: 'ECONNRESET' }); const k = await (await q(env, jefa, `${n}/send`, { method: 'POST', body, deps: { fetchImpl: caida.fetchImpl } })).json(); assert.equal(k.sent, false); assert.equal(k.reason, 'failed');
});
test('Presupuestos · send: también con Brevo (adjunto en el formato del proveedor); la edición y el reenvío no se pisan entre sí', async () => {
  const { env, jefa } = await setup({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-prueba-0123456789' }), n = await place(env, provider()), box = provider();
  const j = await (await q(env, jefa, `${n}/send`, { method: 'POST', body: send({ to: ['a@x.es', 'b@x.es'] }), deps: { fetchImpl: box.fetchImpl } })).json();
  assert.equal(j.sent, true); const b = box.calls[0].body; assert.deepEqual(b.to, [{ email: 'a@x.es' }, { email: 'b@x.es' }]); assert.deepEqual(b.attachment, [{ name: `${n}.pdf`, content: PDF_B64 }]); assert.deepEqual(b.replyTo, { email: 'info@grupotorivac.com' });
  const e = await (await q(env, jefa, n, { method: 'PUT', body: edit(0, { quoteNote: 'Tras el reenvío' }) })).json(); assert.equal(e.ok, true); assert.equal(e.order.history.map((h) => h.kind).join(), 'send,edit', 'la edición conserva el historial del reenvío'); assert.ok(e.order.lastSent.ok);
});

// ───────────────────────────────────────── 5 · formas de respuesta (las usa la prueba de paridad con PHP) y piezas sueltas
test('Presupuestos · formas de respuesta: ok/order, conflict, mail_off, 429, 404 y 401 tienen exactamente las claves del contrato', async () => {
  const { env, jefa } = await setup(), n = await place(env), box = provider(), keysOf = async (r) => Object.keys(await r.json()).sort();
  assert.deepEqual(await keysOf(await q(env, jefa, n)), ['ok', 'order']); assert.deepEqual(await keysOf(await q(env, jefa, n, { method: 'PUT', body: edit(0) })), ['ok', 'order']);
  assert.deepEqual(await keysOf(await q(env, jefa, n, { method: 'PUT', body: edit(0) })), ['code', 'error', 'ok', 'order']); assert.deepEqual(await keysOf(await q(env, jefa, `${n}/send`, { method: 'POST', body: send(), deps: { fetchImpl: box.fetchImpl } })), ['ok', 'order', 'reason', 'sent']);
  assert.deepEqual(await keysOf(await q(env, jefa, 'TV-20261028-9999-ZZZ')), ['error', 'ok']); assert.deepEqual(await keysOf(await q(env, null, n)), ['error', 'ok']);
  const r = await q(env, jefa, n, { method: 'DELETE' }); assert.ok([403, 404, 405].includes(r.status), 'DELETE no existe: ' + r.status);
});
test('Presupuestos · quoteMail: texto fijo en es/en/fr/de, escapa mensaje y nota, "A consultar" sin precio y sin HTML de la persona', () => {
  const base = { number: 'TV-20261028-0001-ABC', lines: [{ ref: REF, qty: 2, unit: 10, total: 20 }, { ref: REF3, qty: 1, unit: null, total: null }], total: 20, unpriced: 1, quoteNote: '<b>nota</b>', message: '<img src=x onerror=alert(1)>\nlinea 2' };
  for (const [lang, asunto, sinPrecio] of [['es', 'Torivac · presupuesto', 'A consultar'], ['en', 'Torivac · quote', 'On request'], ['fr', 'Torivac · devis', 'Sur demande'], ['de', 'Torivac · Angebot', 'Auf Anfrage'], ['xx', 'Torivac · presupuesto', 'A consultar']]) {
    const m = quoteMail({ ...base, lang }, items); assert.equal(m.subject, `${asunto} TV-20261028-0001-ABC`, lang); assert.ok(m.html.includes(sinPrecio), lang);
    assert.ok(!m.html.includes('<img') && !m.html.includes('<b>nota') && m.html.includes('&lt;img src=x onerror=alert(1)&gt;<br>linea 2') && m.html.includes('&lt;b&gt;nota&lt;/b&gt;'), lang);
  }
  const sinTodo = quoteMail({ ...base, lang: 'es', quoteNote: undefined, message: '' }, items); assert.ok(!sinTodo.html.includes('Nota del presupuesto')); assert.ok(quoteMail({ ...base, lang: 'es', demo: true }, items).html.includes('PRECIOS DE DEMOSTRACIÓN'));
});
test('Presupuestos · parseEdit y parseSend: normalizan (minúsculas, sin repetidos, -0 → 0) y no aceptan nada que no sea del contrato', () => {
  const cat = { [REF]: { n: 'A' }, [REF2]: { n: 'B' } };
  const e = parseEdit({ rev: 3, lines: [{ ref: REF, qty: 1, price: -0 }, { ref: REF2, qty: 2, price: null }], quoteNote: '  nota  ' }, cat).edit;
  assert.equal(e.rev, 3); assert.ok(Object.is(e.lines[0].price, 0)); assert.equal(e.lines[1].price, null); assert.equal(e.quoteNote, 'nota'); assert.ok(!('customer' in e));
  assert.ok(!('price' in parseEdit({ rev: 0, lines: [{ ref: REF, qty: 1 }] }, cat).edit.lines[0]), 'sin price en la entrada, sin price en la salida');
  assert.equal(parseEdit({ rev: 0, lines: [{ ref: REF, qty: 1, price: NaN }] }, cat).error, `Precio no válido para ${REF}`);
  const s = parseSend({ to: [' A@X.es ', 'a@x.es'], pdf: PDF_B64 }).send; assert.deepEqual(s.to, ['a@x.es']); assert.equal(s.message, ''); assert.equal(s.copyToMe, true);
  assert.equal(parseSend({ to: ['a@x.es'], pdf: PDF_B64, copyToMe: false }).send.copyToMe, false); assert.equal(parseSend({ to: ['a@x.es'], pdf: PDF_B64, copyToMe: 'no' }).send.copyToMe, true, 'solo false exacto la desactiva');
});
