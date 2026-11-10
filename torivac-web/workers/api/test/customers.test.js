// [PRUEBAS-CLIENTES] Cuentas de cliente y presupuestos con categoría de precio (docs/PRECIOS-Y-CLIENTES.md §1, §5.1 y §6; pruebas 3, 6, 7 y 8 del apartado 7): el CRUD de /api/customers, el rol customer (solo lectura, tope de 3 al día),
// POST /api/order con y sin sesión (categoría, owner, priceTier, sesión caducada), la lectura reducida de sus presupuestos y PUT /api/orders/:n con `tier`. Sin red: KV en memoria y proveedor de correo simulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTER, setPricing } from './helpers.js';
import { call, signIn, orderEnv, order, provider, freshIp, keys, PW, PDF_B64, REF, REF2 } from './kit.js';
import { createUser, listUsers } from '../src/users.js';
import { KEY } from '../src/pricing.js';
import { ORDER_TTL } from '../src/orders.js';

const NOW = Date.parse('2026-10-28T08:00:00Z'), H = 3600 * 1000;
const REF3 = 'P15355';                                                             // referencia real del catálogo SIN precio en estas pruebas
const NOT_FOUND = { ok: false, error: 'No existe ese presupuesto' };
/** Entorno con precios (REF 67,65 y REF2 15,82 con tramo de 10 a 15,10), ajustes de precios por defecto (5/10/15 y el visitante en «A consultar»), un manager, el propietario y dos clientes con sesión: Ana (VIP +10) y Luis (Normal). */
async function setup(extra = {}) {
  const env = await orderEnv(extra); await env.KV.delete(KEY);
  const jefa = await signIn(env, 'jefa@torivac.com', 'manager', { ip: '10.9.0.1' }), duena = await signIn(env, 'duena@torivac.com', 'client', { ip: '10.9.0.2' });
  const ana = await signIn(env, 'ana@acme.es', 'customer', { ip: '10.9.0.3', tier: 'vip10' }), luis = await signIn(env, 'luis@acme.es', 'customer', { ip: '10.9.0.4' });
  return { env, jefa, duena, ana, luis };
}
/** POST /api/order con la sesión indicada (o sin ella) y la hora `now` → { r, j, box, sent } (sent = los correos enviados). `over` sustituye campos del pedido de ejemplo. */
async function place(env, who, over = {}, { now = NOW, box = provider(), headers } = {}) {
  const r = await call(env, '/api/order', { method: 'POST', body: order(over), token: who && (who.token ?? who), headers, ip: freshIp(), deps: { fetchImpl: box.fetchImpl, now: new Date(now) } });
  return { r, j: await r.json(), box, sent: box.calls.map((c) => c.body) };
}
/** Registro guardado en KV (sin pasar por la API). */
const stored = (env, n) => JSON.parse(env.KV.m.get(`order:${n}`));
/** Llamada a la API con la sesión indicada y una IP nueva; `now` fija la hora. */
const api = (env, who, path, { method = 'GET', body, now = NOW } = {}) => call(env, path, { method, body, token: who && (who.token ?? who), ip: freshIp(), deps: { now } });
/** Cuerpo mínimo válido del PUT de un presupuesto con las líneas de ejemplo y la revisión indicada. */
const edit = (rev, over = {}) => ({ rev, lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 3 }], ...over });

// ───────────────────────────────────────── 3 · clientes (CRUD)
test('Clientes · GET /customers lo ven manager, propietario y token maestro; trae las cuatro categorías con su porcentaje actual y el último acceso', async () => {
  const { env, jefa, duena } = await setup();
  for (const who of [jefa, duena, MASTER]) {
    const r = await api(env, who, '/api/customers'), j = await r.json();
    assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'no-store'); assert.equal(j.ok, true);
    assert.deepEqual(j.customers.map((c) => [c.email, c.name, c.tier]), [['ana@acme.es', 'Usuario customer', 'vip10'], ['luis@acme.es', 'Usuario customer', 'normal']], 'solo cuentas customer, no el equipo');
    assert.ok(j.customers.every((c) => /^\d{4}-\d\d-\d\dT/.test(c.created) && !('hash' in c) && !('salt' in c) && !('sid' in c) && !('role' in c)));
    assert.deepEqual(j.tiers, { vip: { label: 'VIP', pct: 0 }, vip5: { label: 'VIP +5', pct: 5 }, vip10: { label: 'VIP +10', pct: 10 }, normal: { label: 'Normal', pct: 15 } });
  }
  await env.KV.put(KEY, JSON.stringify({ tiers: { vip5: 3, vip10: 6, normal: 9.5 }, anon: 'consult', approx: { on: false, pct: 15 } }));
  assert.deepEqual((await (await api(env, jefa, '/api/customers')).json()).tiers.normal, { label: 'Normal', pct: 9.5 }, 'los porcentajes son los de los ajustes');
  const antes = (await (await api(env, jefa, '/api/customers')).json()).customers.find((c) => c.email === 'ana@acme.es');
  assert.match(antes.last_login, /^\d{4}-\d\d-\d\dT/, 'signIn ya inició sesión: queda anotado');
});
test('Clientes · alta: 201 con la ficha, categoría por defecto Normal, correo en minúsculas; duplicado 409; el cliente entra y no ve la categoría', async () => {
  const { env, jefa, duena } = await setup();
  let r = await api(env, duena, '/api/customers', { method: 'POST', body: { email: 'Nuevo@Cliente.ES', name: 'Nueva SL', password: 'Clave-Larga-2026' } }), j = await r.json();
  assert.equal(r.status, 201); assert.deepEqual(Object.keys(j.customer).sort(), ['created', 'email', 'name', 'tier']); assert.deepEqual([j.customer.email, j.customer.name, j.customer.tier], ['nuevo@cliente.es', 'Nueva SL', 'normal']);
  r = await api(env, jefa, '/api/customers', { method: 'POST', body: { email: 'vip@cliente.es', name: 'Vip', password: 'Clave-Larga-2026', tier: 'vip' } }); assert.equal((await r.json()).customer.tier, 'vip');
  for (const t of ['vip5', 'vip10', 'normal']) assert.equal((await (await api(env, jefa, '/api/customers', { method: 'POST', body: { email: `${t}@cliente.es`, name: t, password: 'Clave-Larga-2026', tier: t } })).json()).customer.tier, t);
  r = await api(env, jefa, '/api/customers', { method: 'POST', body: { email: 'nuevo@cliente.es', name: 'Otra', password: 'Otra-Clave-2026!' } }); assert.equal(r.status, 409); assert.equal((await r.json()).ok, false);
  r = await api(env, jefa, '/api/customers', { method: 'POST', body: { email: 'jefa@torivac.com', name: 'Pisar', password: 'Otra-Clave-2026!' } }); assert.equal(r.status, 409, 'no se puede pisar una cuenta del equipo');
  assert.equal((await api(env, jefa, '/api/users')).status, 200); assert.equal(JSON.parse(env.KV.m.get('user:jefa@torivac.com')).role, 'manager');
  const login = await call(env, '/api/auth/login', { method: 'POST', body: { email: 'nuevo@cliente.es', password: 'Clave-Larga-2026' }, ip: freshIp() }), lj = await login.json();
  assert.equal(login.status, 200); assert.deepEqual(lj.user, { email: 'nuevo@cliente.es', name: 'Nueva SL', role: 'customer', created: lj.user.created }, 'el usuario del login no trae la categoría');
  const me = await (await api(env, lj.token, '/api/auth/me')).json(); assert.deepEqual(me.user, { role: 'customer', sub: 'nuevo@cliente.es', name: 'Nueva SL' }, 'tampoco /auth/me'); assert.ok(!JSON.stringify(me).includes('tier'));
});
test('Clientes · alta: correo, nombre, contraseña y categoría se validan como en /users; lo rechazado no crea cuentas', async () => {
  const { env, jefa } = await setup(); const antes = (await listUsers(env)).length;
  /** POST /api/customers como manager con ese cuerpo → { status, j }. */
  const alta = async (b) => { const r = await api(env, jefa, '/api/customers', { method: 'POST', body: b }); return { status: r.status, j: await r.json() }; };
  const buena = { email: 'ok@cliente.es', name: 'Ok', password: 'Clave-Larga-2026' };
  const casos = [
    [{ ...buena, email: 'sin-arroba' }, 'Correo no válido'], [{ ...buena, email: 5 }, 'Correo no válido'], [{ ...buena, email: 'a'.repeat(250) + '@x.es' }, 'Correo no válido'], [{ ...buena, email: undefined }, 'Correo no válido'],
    [{ ...buena, password: 'corta' }, null], [{ ...buena, password: 'ok-ok-ok-ok-ok-ok' }, null], [{ ...buena, password: '123456789012' }, null], [{ ...buena, password: undefined }, 'Contraseña no válida'], [{ ...buena, password: 12345678901234 }, 'Contraseña no válida'],
    [{ ...buena, name: 5 }, 'Nombre no válido'], [{ ...buena, tier: 'oro' }, 'Categoría no válida'], [{ ...buena, tier: 5 }, 'Categoría no válida'], [{ ...buena, tier: 'VIP' }, 'Categoría no válida'],
  ];
  for (const [b, msg] of casos) { const r = await alta(b); assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(r.j.ok, false); if (msg) assert.equal(r.j.error, msg); else assert.ok(r.j.error, 'dice por qué la contraseña no vale'); }
  for (const raro of ['"texto"', '[1]', 'null', 'no json', '']) assert.equal((await alta(raro)).status, 400, raro);
  assert.equal((await listUsers(env)).length, antes, 'ninguna cuenta nueva');
  assert.equal((await alta({ ...buena, role: 'manager' })).status, 201, 'el rol del cuerpo se ignora: siempre customer'); assert.equal(JSON.parse(env.KV.m.get('user:ok@cliente.es')).role, 'customer');
});
test('Clientes · cambiar categoría y nombre: PUT /customers/:correo; otro rol o inexistente → 404; categoría o nombre inválidos → 400', async () => {
  const { env, jefa, duena } = await setup();
  let r = await api(env, duena, '/api/customers/ana%40acme.es', { method: 'PUT', body: { tier: 'vip5' } }), j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual([j.customer.email, j.customer.tier, j.customer.name], ['ana@acme.es', 'vip5', 'Usuario customer']); assert.equal(JSON.parse(env.KV.m.get('user:ana@acme.es')).tier, 'vip5');
  j = await (await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: { name: '  Ana   Acme  SL ' } })).json(); assert.deepEqual([j.customer.name, j.customer.tier], ['Ana Acme SL', 'vip5'], 'solo cambia lo que viene');
  j = await (await api(env, jefa, '/api/customers/ANA@acme.es', { method: 'PUT', body: { tier: 'vip', name: 'Ana' } })).json(); assert.deepEqual([j.customer.name, j.customer.tier], ['Ana', 'vip'], 'el correo de la URL no distingue mayúsculas');
  for (const raro of ['jefa%40torivac.com', 'duena%40torivac.com', 'nadie%40acme.es', 'ana%40acme.es%2F..']) {
    r = await api(env, jefa, `/api/customers/${raro}`, { method: 'PUT', body: { tier: 'vip' } }); assert.equal(r.status, 404, raro); assert.equal((await r.json()).ok, false);
  }
  assert.equal(JSON.parse(env.KV.m.get('user:jefa@torivac.com')).role, 'manager'); assert.ok(!('tier' in JSON.parse(env.KV.m.get('user:jefa@torivac.com'))), 'a las cuentas del equipo no se les pone categoría');
  for (const b of [{ tier: 'oro' }, { tier: 7 }, { name: '' }, { name: '   ' }, { name: 5 }, {}, { otro: 1 }]) { r = await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: b }); assert.equal(r.status, 400, JSON.stringify(b)); }
  assert.equal((await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: 'no es json' })).status, 400); assert.equal((await api(env, jefa, '/api/customers/%E0%A4%A', { method: 'PUT', body: { tier: 'vip' } })).status, 400);
  assert.equal(JSON.parse(env.KV.m.get('user:ana@acme.es')).tier, 'vip', 'lo rechazado no cambió nada');
  const nulo = await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: { tier: null } }); assert.equal(nulo.status, 400); assert.equal((await nulo.json()).error, 'Categoría no válida', 'tier presente pero null no es una categoría');
  assert.equal((await (await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: {} })).json()).error, 'Indica la categoría o el nombre');
  assert.equal((await api(env, jefa, '/api/customers/nadie%40acme.es', { method: 'PUT', body: 'no es json' })).status, 404, '404 antes que 400: primero se mira si la cuenta existe');
  assert.equal((await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: JSON.stringify({ name: 'x'.repeat(11_000) }) })).status, 413, 'cuerpo > 10 KB');
});
test('Clientes · contraseña nueva: mismas reglas, la anterior deja de valer y se cierran sus sesiones; solo cuentas customer', async () => {
  const { env, jefa, duena, ana } = await setup();
  /** POST /api/customers/<correo>/password como `who` → { status, j }. */
  const set = async (who, correo, password) => { const r = await api(env, who, `/api/customers/${correo}/password`, { method: 'POST', body: { password } }); return { status: r.status, j: await r.json() }; };
  for (const mala of ['corta', 'ana-ana-ana-ana', 'password1234', undefined, 5, ['x']]) { const r = await set(jefa, 'ana%40acme.es', mala); assert.equal(r.status, 400, String(mala)); assert.equal(r.j.ok, false); }
  assert.equal((await api(env, ana, '/api/orders')).status, 200, 'una contraseña rechazada no cierra la sesión');
  assert.equal((await set(jefa, 'jefa%40torivac.com', 'Nueva-Clave-2026!')).status, 404, 'no se cambia la clave de un manager desde aquí'); assert.equal((await set(jefa, 'duena%40torivac.com', 'Nueva-Clave-2026!')).status, 404); assert.equal((await set(jefa, 'nadie%40acme.es', 'Nueva-Clave-2026!')).status, 404);
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: PW.manager }, ip: freshIp() })).status, 200, 'la clave de jefa sigue igual');
  const ok = await set(duena, 'ana%40acme.es', 'Nueva-Clave-2026!'); assert.equal(ok.status, 200); assert.deepEqual(ok.j, { ok: true });
  assert.equal((await api(env, ana, '/api/orders')).status, 401, 'su sesión anterior se cerró');
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: { email: 'ana@acme.es', password: PW.customer }, ip: freshIp() })).status, 401, 'la antigua ya no vale');
  const nueva = await call(env, '/api/auth/login', { method: 'POST', body: { email: 'ana@acme.es', password: 'Nueva-Clave-2026!' }, ip: freshIp() }), nj = await nueva.json(); assert.equal(nueva.status, 200);
  assert.equal((await api(env, nj.token, '/api/orders')).status, 200, 'la sesión nueva sí');
  assert.equal(JSON.parse(env.KV.m.get('user:ana@acme.es')).tier, 'vip10', 'cambiar la clave no toca la categoría');
});
test('Clientes · borrar: cierra sus sesiones y no vuelve a entrar, pero sus presupuestos se conservan; otro rol o inexistente → 404', async () => {
  const { env, jefa, duena, ana } = await setup();
  const n = (await place(env, ana)).j.number;
  let r = await api(env, jefa, '/api/customers/jefa%40torivac.com', { method: 'DELETE' }); assert.equal(r.status, 404); assert.equal((await api(env, jefa, '/api/users')).status, 200, 'la cuenta del equipo sigue ahí');
  assert.equal((await api(env, jefa, '/api/customers/duena%40torivac.com', { method: 'DELETE' })).status, 404); assert.equal((await api(env, jefa, '/api/customers/nadie%40acme.es', { method: 'DELETE' })).status, 404);
  r = await api(env, duena, '/api/customers/ana%40acme.es', { method: 'DELETE' }); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
  assert.equal((await api(env, ana, '/api/orders')).status, 401, 'sin cuenta no hay sesión');
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: { email: 'ana@acme.es', password: PW.customer }, ip: freshIp() })).status, 401);
  assert.equal(stored(env, n).owner, 'ana@acme.es', 'su presupuesto sigue guardado'); assert.equal((await (await api(env, jefa, '/api/orders')).json()).orders.length, 1);
  assert.deepEqual((await (await api(env, jefa, '/api/customers')).json()).customers.map((c) => c.email), ['luis@acme.es']);
  assert.equal((await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'DELETE' })).status, 404, 'ya no existe');
  const otra = await createUser(env, { email: 'ana@acme.es', name: 'Otra Ana', role: 'customer', password: 'Otra-Clave-2026!' }); assert.ok(otra.user);
  const login = await (await call(env, '/api/auth/login', { method: 'POST', body: { email: 'ana@acme.es', password: 'Otra-Clave-2026!' }, ip: freshIp() })).json();
  assert.equal((await api(env, ana, '/api/orders')).status, 401, 'recrear la cuenta no resucita la sesión vieja'); assert.equal((await api(env, login.token, '/api/orders')).status, 200);
});
test('Clientes · un customer o un visitante no entran en /customers, /settings/pricing ni /prices/items (403 / 401); manager, propietario y maestro sí', async () => {
  const { env, jefa, duena, ana } = await setup();
  const rutas = [['GET', '/api/customers'], ['POST', '/api/customers', { email: 'x@y.es', name: 'X', password: 'Clave-Larga-2026' }], ['PUT', '/api/customers/luis%40acme.es', { tier: 'vip' }], ['POST', '/api/customers/luis%40acme.es/password', { password: 'Clave-Larga-2026' }],
    ['DELETE', '/api/customers/luis%40acme.es'], ['GET', '/api/settings/pricing'], ['PUT', '/api/settings/pricing', {}], ['PUT', `/api/prices/items/${REF}`, { p: 1 }]];
  for (const [method, path, body] of rutas) {
    const c = await api(env, ana, path, { method, body }); assert.equal(c.status, 403, `customer ${method} ${path}`); assert.deepEqual(await c.json(), { ok: false, error: 'Solo para managers' }); assert.equal((await api(env, null, path, { method, body })).status, 401, `visitante ${method} ${path}`);
    assert.equal((await api(env, 'falso'.repeat(10), path, { method, body })).status, 401, `token falso ${method} ${path}`);
  }
  assert.equal(JSON.parse(env.KV.m.get('user:luis@acme.es')).tier, 'normal', 'los intentos de un customer no cambiaron nada'); assert.equal((await listUsers(env)).length, 4);
  for (const who of [jefa, duena, MASTER]) assert.equal((await api(env, who, '/api/customers')).status, 200);
  assert.equal((await api(env, jefa, '/api/customers/luis%40acme.es', { method: 'PATCH', body: {} })).status, 404, 'métodos que no existen');
});
test('Clientes · /users ve y acepta el rol customer y su tier; los guardas de siempre siguen: /users, Google, correo y precios de la hoja solo para managers', async () => {
  const { env, jefa, duena, ana } = await setup();
  const lista = (await (await api(env, jefa, '/api/users')).json()).users; assert.deepEqual(lista.filter((u) => u.role === 'customer').map((u) => [u.email, u.tier]), [['ana@acme.es', 'vip10'], ['luis@acme.es', 'normal']]);
  assert.ok(lista.filter((u) => u.role !== 'customer').every((u) => !('tier' in u)), 'el equipo no tiene categoría');
  let r = await api(env, jefa, '/api/users', { method: 'POST', body: { email: 'c1@cliente.es', name: 'C1', role: 'customer', password: 'Clave-Larga-2026', tier: 'vip5' } }), j = await r.json(); assert.equal(r.status, 201); assert.deepEqual([j.user.role, j.user.tier], ['customer', 'vip5']);
  j = await (await api(env, jefa, '/api/users', { method: 'POST', body: { email: 'c2@cliente.es', name: 'C2', role: 'customer', password: 'Clave-Larga-2026' } })).json(); assert.equal(j.user.tier, 'normal', 'por defecto Normal');
  r = await api(env, jefa, '/api/users', { method: 'POST', body: { email: 'c3@cliente.es', name: 'C3', role: 'customer', password: 'Clave-Larga-2026', tier: 'oro' } }); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'Categoría no válida');
  j = await (await api(env, jefa, '/api/users', { method: 'POST', body: { email: 'm2@torivac.com', name: 'M2', role: 'manager', password: 'Clave-Larga-2026', tier: 'vip' } })).json(); assert.ok(!('tier' in j.user) && !('tier' in JSON.parse(env.KV.m.get('user:m2@torivac.com'))), 'tier solo para el rol customer');
  assert.equal((await api(env, jefa, '/api/users', { method: 'POST', body: { email: 'c4@cliente.es', role: 'otro', password: 'Clave-Larga-2026' } })).status, 400, 'Rol no válido');
  const creada = await createUser(env, { email: 'c5@cliente.es', name: 'C5', role: 'customer', password: 'Clave-Larga-2026', tier: 'vip10' }); assert.equal(creada.user.tier, 'vip10', 'el alta del Worker (createUser) lo acepta');
  assert.equal((await createUser(env, { email: 'c6@cliente.es', role: 'customer', password: 'Clave-Larga-2026', tier: 'oro' })).error, 'Categoría no válida');
  for (const [method, path, body] of [['GET', '/api/users'], ['POST', '/api/users', { email: 'z@z.es', role: 'customer', password: 'Clave-Larga-2026' }], ['DELETE', '/api/users/luis%40acme.es'], ['GET', '/api/settings/google'], ['GET', '/api/mail/status'], ['GET', '/api/messages'],
    ['POST', '/api/prices/refresh', {}], ['POST', '/api/prices/upload', { csv: 'ref;price\nA;1' }], ['POST', '/api/prices/ai', { instruction: 'sube un 3 % las resistencias' }], ['POST', '/api/prices/ai/apply', { changes: [] }], ['GET', '/api/admin/data'], ['GET', '/api/proposals/state']]) {
    assert.equal((await api(env, ana, path, { method, body })).status, 403, `customer ${method} ${path}`);
    if (method === 'POST' && (path === '/api/prices/refresh' || path === '/api/prices/upload')) continue;           // la hoja (subir Excel/CSV y «Actualizar ahora») también la lleva el propietario
    assert.equal((await api(env, duena, path, { method, body })).status, 403, `propietario ${method} ${path}`);
  }
  const subida = await api(env, duena, '/api/prices/upload', { method: 'POST', body: { csv: 'ref;price\nA;1', dry_run: true } }); assert.notEqual(subida.status, 403, 'el propietario puede previsualizar una hoja');
  assert.notEqual((await api(env, duena, '/api/prices/refresh', { method: 'POST', body: {} })).status, 403, 'y pulsar «Actualizar ahora»');
  assert.equal((await api(env, MASTER, '/api/users')).status, 200); assert.equal((await api(env, ana, '/api/auth/logout', { method: 'POST', now: Date.now() })).status, 200, 'un cliente puede cerrar su sesión'); assert.equal((await api(env, ana, '/api/auth/me', { now: Date.now() + 5 })).status, 401);
});

// ───────────────────────────────────────── 6 · pedidos
test('Pedido · un customer se valora con SU categoría (leída de su registro), ignora price/tier/unit del cuerpo y se anota con owner y priceTier; la respuesta trae remaining y no la categoría', async () => {
  const { env, jefa, ana } = await setup();
  const { r, j, box } = await place(env, ana, { tier: 'vip', lines: [{ ref: REF, qty: 2, price: 1, unit: 1, total: 1, tier: 'vip' }, { ref: REF2, qty: 3, price: 0.01 }, { ref: REF3, qty: 1 }], price: 0.01 });
  assert.equal(r.status, 200, JSON.stringify(j)); assert.deepEqual(Object.keys(j).sort(), ['emailed', 'number', 'ok', 'remaining', 'total', 'unpriced']); assert.equal(j.remaining, 2); assert.equal(j.unpriced, 1);
  const rec = stored(env, j.number);
  assert.deepEqual(rec.lines, [{ ref: REF, qty: 2, unit: 74.415, total: 148.83 }, { ref: REF2, qty: 3, unit: 17.402, total: 52.21 }, { ref: REF3, qty: 1, unit: null, total: null }], 'VIP +10: 67,65 × 1,10 y 15,82 × 1,10; sin precio → A consultar');
  assert.equal(rec.total, 201.04); assert.equal(j.total, 201.04); assert.equal(rec.owner, 'ana@acme.es'); assert.equal(rec.priceTier, 'vip10'); assert.equal(typeof rec.ip, 'string');
  assert.ok(!JSON.stringify(j).includes('vip10') && !('priceTier' in j) && !('owner' in j), 'el cliente no ve el nombre de su categoría');
  const tramo = await place(env, ana, { lines: [{ ref: REF2, qty: 10 }] }); assert.equal(stored(env, tramo.j.number).lines[0].unit, 16.61, 'el tramo también se escala: 15,10 × 1,10'); assert.equal(tramo.j.total, 166.1);
  await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'PUT', body: { tier: 'vip' } });
  const vip = await place(env, ana, { lines: [{ ref: REF, qty: 2 }] }); assert.deepEqual([stored(env, vip.j.number).lines[0].unit, stored(env, vip.j.number).priceTier, vip.j.remaining], [67.65, 'vip', 0], 'cambiar la categoría vale en el siguiente presupuesto');
  assert.equal(box.calls.length, 2, 'aviso al equipo y copia al solicitante, como siempre'); assert.deepEqual(box.calls[0].body.to, ['info@grupotorivac.com', 'mzamora@torivac.com']); assert.deepEqual(box.calls[1].body.to, ['victima@ejemplo.org']);
});
test('Pedido · el correo al equipo lleva la cuenta y la categoría; también el del visitante («A consultar») y el del token maestro', async () => {
  const { env, jefa, ana } = await setup();
  const a = await place(env, ana); assert.match(a.sent[0].text, /Cuenta: ana@acme\.es · Categoría de precio: VIP \+10/); assert.match(a.sent[0].html, /Cuenta: ana@acme\.es · Categoría de precio: VIP \+10/);
  const v = await place(env, null); assert.match(v.sent[0].text, /Cuenta: visitante sin sesión · Categoría de precio: A consultar/);
  const m = await place(env, MASTER); assert.match(m.sent[0].text, /Cuenta: token maestro · Categoría de precio: VIP/);
  const j = await place(env, jefa, { tier: 'normal' }); assert.match(j.sent[0].text, /Cuenta: jefa@torivac\.com · Categoría de precio: Normal/);
  assert.ok(!/Categoría de precio/.test(a.sent[1].text + a.sent[1].html), 'la copia al solicitante no lleva la categoría');
});
test('Pedido · un customer no necesita Turnstile, hp ni _e (hay sesión); un visitante sí', async () => {
  const { env, ana } = await setup({ TURNSTILE_SECRET: 'ts-secret', FORM_MIN_FILL_MS: '1200' });
  /** Turnstile simulado: siempre responde que la verificación falla. */
  const ts = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
  const v = await place(env, null, {}, { box: { fetchImpl: ts, calls: [] } }); assert.equal(v.r.status, 400); assert.equal(v.j.code, 'too_fast', 'el visitante sin _e');
  const v2 = await place(env, null, { _e: 5000 }, { box: { fetchImpl: ts, calls: [] } }); assert.equal(v2.j.code, 'captcha', 'y sin CAPTCHA');
  const c = await place(env, ana, { hp: 'bot' }); assert.equal(c.r.status, 200, JSON.stringify(c.j)); assert.equal(c.j.ok, true);
  const staff = await place(env, MASTER); assert.equal(staff.r.status, 200, 'el equipo con sesión tampoco');
});
test('Pedido · límite de 3 al día por persona: el 4.º → 429 daily_limit; un 400 no gasta cupo; los demás no se ven afectados', async () => {
  const { env, jefa, ana, luis } = await setup();
  const malo = await place(env, ana, { lines: [] }); assert.equal(malo.r.status, 400); assert.equal((await place(env, ana, { customer: { name: 'A' } })).r.status, 400);
  const res = []; for (let i = 0; i < 3; i++) res.push(await place(env, ana, {}, { now: NOW + i * 1000 }));
  assert.deepEqual(res.map((x) => x.r.status), [200, 200, 200], 'tras dos 400, los tres siguen entrando'); assert.deepEqual(res.map((x) => x.j.remaining), [2, 1, 0]);
  const cuarto = await place(env, ana, {}, { now: NOW + 5000 }); assert.equal(cuarto.r.status, 429);
  assert.deepEqual(cuarto.j, { ok: false, code: 'daily_limit', error: 'Has alcanzado el límite de 3 presupuestos al día. Vuelve a intentarlo mañana o escribe al equipo.' });
  assert.equal(keys(env, 'order:TV-').length, 3, 'el rechazado no se guardó'); assert.equal(cuarto.sent.length, 0, 'ni se envió nada');
  const bad = await place(env, ana, { lines: [] }, { now: NOW + 6000 }); assert.equal(bad.r.status, 400, 'un cuerpo malo sigue siendo un 400 (se valida antes del cupo)');
  assert.equal((await place(env, luis, {}, { now: NOW + 5000 })).r.status, 200, 'Luis tiene su propio cupo'); assert.equal((await place(env, null, {}, { now: NOW + 5000 })).r.status, 200, 'el visitante no tiene este tope');
  for (let i = 0; i < 5; i++) assert.equal((await place(env, jefa, {}, { now: NOW + 5000 + i })).r.status, 200, 'ni el equipo');
  assert.equal((await place(env, MASTER, {}, { now: NOW + 5000 })).r.status, 200);
});
test('Pedido · el límite es una ventana móvil de 24 h por persona (no un día de calendario) y CUSTOMER_ORDERS_PER_DAY lo cambia', async () => {
  const { env, ana } = await setup();
  const t0 = Date.parse('2026-10-28T23:00:00Z');
  for (const dt of [0, 30 * 60_000, 60 * 60_000]) assert.equal((await place(env, ana, {}, { now: t0 + dt })).r.status, 200);        // 23:00, 23:30 y 00:00 del día siguiente (UTC)
  assert.equal((await place(env, ana, {}, { now: t0 + 2 * H })).r.status, 429, 'a las 01:00 siguen contando los dos de ayer');
  assert.equal((await place(env, ana, {}, { now: t0 + 23 * H + 59 * 60_000 })).r.status, 429, 'a las 22:59 del día siguiente, el primero aún no ha cumplido 24 h');
  const libre = await place(env, ana, {}, { now: t0 + 24 * H + 60_000 }); assert.equal(libre.r.status, 200, 'cumplidas las 24 h del primero queda un hueco'); assert.equal(libre.j.remaining, 0);
  assert.equal((await place(env, ana, {}, { now: t0 + 24 * H + 120_000 })).r.status, 429, 'solo uno: el segundo y el tercero siguen dentro');
  const { env: e2, ana: a2 } = await setup({ CUSTOMER_ORDERS_PER_DAY: '1' });
  const uno = await place(e2, a2, {}, { now: NOW }); assert.equal(uno.j.remaining, 0); const dos = await place(e2, a2, {}, { now: NOW + 1000 });
  assert.equal(dos.r.status, 429); assert.match(dos.j.error, /límite de 1 presupuestos al día/, 'el número del texto es el límite configurado');
  const { env: e5, ana: a5 } = await setup({ CUSTOMER_ORDERS_PER_DAY: ' 5 ' });
  for (let i = 0; i < 5; i++) assert.equal((await place(e5, a5, {}, { now: NOW + i })).r.status, 200, 'los espacios se toleran como en el resto de variables'); assert.equal((await place(e5, a5, {}, { now: NOW + 9 })).r.status, 429);
  for (const mal of ['0', '-2', 'tres', '', '2.5', '99999999999', '3x']) {
    const { env: e3, ana: a3 } = await setup({ CUSTOMER_ORDERS_PER_DAY: mal });
    const out = []; for (let i = 0; i < 4; i++) out.push((await place(e3, a3, {}, { now: NOW + i })).r.status);
    assert.deepEqual(out, [200, 200, 200, 429], `«${mal}» no es válido → 3`);
  }
});
test('Pedido · una sesión no válida o caducada → 401 code session (no se trata como visitante) y no se guarda nada', async () => {
  const { env, jefa, ana } = await setup();
  const esperado = { ok: false, code: 'session', error: 'Tu sesión ha caducado. Vuelve a entrar.' };
  const falso = await place(env, 'x'.repeat(60)); assert.equal(falso.r.status, 401); assert.deepEqual(falso.j, esperado);
  const caducado = await place(env, ana, {}, { now: Date.now() + 25 * H }); assert.equal(caducado.r.status, 401); assert.deepEqual(caducado.j, esperado);
  await api(env, jefa, '/api/customers/ana%40acme.es', { method: 'DELETE' });
  const borrada = await place(env, ana); assert.equal(borrada.r.status, 401); assert.deepEqual(borrada.j, esperado);
  const raro = await place(env, null, {}, { headers: { Authorization: 'Bearer ' } }); assert.equal(raro.r.status, 200, 'un Authorization que no es un Bearer con token ni se mira');
  const roto = await place(env, null, { lines: [] }, { headers: { Authorization: 'Bearer abc' } }); assert.equal(roto.r.status, 401, 'la sesión se comprueba antes que el cuerpo');
  assert.equal(keys(env, 'order:TV-').length, 1, 'solo el del visitante'); assert.equal(keys(env, 'oorder:').length, 0);
  const cors = await call(env, '/api/order', { method: 'POST', body: order(), token: 'x'.repeat(60), origin: 'https://demo.example', ip: freshIp() }); assert.equal(cors.status, 401); assert.equal(cors.headers.get('Access-Control-Allow-Origin'), 'https://demo.example');
});
test('Pedido · visitante sin sesión: con anon «consult» todo sale «A consultar» (priceTier consult, sin owner); con «normal» se valora como Normal', async () => {
  const { env } = await setup();
  const c = await place(env, null); assert.equal(c.r.status, 200); assert.deepEqual([c.j.total, c.j.unpriced, 'remaining' in c.j], [0, 2, false]);
  const rec = stored(env, c.j.number); assert.deepEqual(rec.lines.map((l) => [l.unit, l.total]), [[null, null], [null, null]]); assert.deepEqual([rec.total, rec.unpriced, rec.priceTier], [0, 2, 'consult']); assert.ok(!('owner' in rec));
  assert.equal(keys(env, 'oorder:').length, 0, 'sin sesión no hay índice por propietario'); assert.equal(keys(env, 'uorder:').length, 1, 'el índice por correo de siempre sigue'); assert.equal(c.sent.length, 2);
  const lleno = await place(env, null, { lines: [{ ref: REF, qty: 2, price: 0.01 }] }); assert.equal(stored(env, lleno.j.number).lines[0].unit, null, 'el cuerpo nunca fija precios');
  await setPricing(env, { anon: 'normal' });
  const n = await place(env, null, { lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 10 }, { ref: REF3, qty: 1 }] }); const nrec = stored(env, n.j.number);
  assert.deepEqual(nrec.lines, [{ ref: REF, qty: 2, unit: 77.7975, total: 155.6 }, { ref: REF2, qty: 10, unit: 17.365, total: 173.65 }, { ref: REF3, qty: 1, unit: null, total: null }]);
  assert.deepEqual([nrec.priceTier, nrec.total, nrec.unpriced], ['normal', 329.25, 1]); assert.ok(!('owner' in nrec) && !('remaining' in n.j));
  await setPricing(env, { anon: 'normal', tiers: { vip5: 1, vip10: 2, normal: 3 } }); const n2 = await place(env, null, { lines: [{ ref: REF, qty: 1 }] }); assert.equal(stored(env, n2.j.number).lines[0].unit, 69.6795, 'con los porcentajes cambiados');
});
test('Pedido · manager y propietario: valoración VIP salvo que el cuerpo traiga tier; owner = su correo; tier inválido → 400', async () => {
  const { env, jefa, duena } = await setup();
  const v = await place(env, jefa); const rec = stored(env, v.j.number); assert.deepEqual(rec.lines.map((l) => l.unit), [67.65, 15.82]); assert.deepEqual([rec.priceTier, rec.owner], ['vip', 'jefa@torivac.com']); assert.ok(!('remaining' in v.j));
  for (const [t, unit] of [['vip', 67.65], ['vip5', 71.0325], ['vip10', 74.415], ['normal', 77.7975]]) {
    const x = await place(env, duena, { tier: t, lines: [{ ref: REF, qty: 1 }] }); assert.deepEqual([stored(env, x.j.number).lines[0].unit, stored(env, x.j.number).priceTier, stored(env, x.j.number).owner], [unit, t, 'duena@torivac.com'], t);
  }
  for (const t of ['oro', 5, 'VIP', ['vip'], true]) { const x = await place(env, jefa, { tier: t }); assert.equal(x.r.status, 400, String(t)); assert.equal(x.j.field, 'tier'); assert.equal(x.j.error, 'Categoría no válida'); }
  assert.equal((await place(env, jefa, { tier: null })).j.ok, true, 'tier null = sin tier'); assert.equal((await place(env, jefa, { tier: '' })).j.ok, true, 'y vacío también'); assert.equal(stored(env, (await place(env, MASTER, { tier: 'vip5', lines: [{ ref: REF, qty: 1 }] })).j.number).lines[0].unit, 71.0325);
  const m = stored(env, (await place(env, MASTER)).j.number); assert.ok(!('owner' in m), 'el token maestro no tiene correo'); assert.equal(m.priceTier, 'vip');
  const pdf = await place(env, jefa, { pdf: PDF_B64 }); assert.equal(pdf.sent[0].attachments[0].filename, `${pdf.j.number}.pdf`, 'el PDF sigue yendo al equipo');
});
test('Pedido · el índice por propietario oorder:<correo>:<nº> se escribe al crear (400 días) con la fecha del pedido', async () => {
  const { env, ana } = await setup();
  const { j } = await place(env, ana); const k = `oorder:ana@acme.es:${j.number}`;
  assert.deepEqual(keys(env, 'oorder:'), [k]); assert.equal(env.KV.m.get(k), '2026-10-28T08:00:00.000Z'); assert.ok(env.KV.exp.get(k) > Date.now() / 1000 + 399 * 86400, 'mismo plazo que el pedido');
  assert.ok(env.KV.exp.get(`order:${j.number}`) > Date.now() / 1000 + 399 * 86400); assert.equal(ORDER_TTL.expirationTtl, 400 * 86400);
});

// ───────────────────────────────────────── 7 · lectura del cliente
test('Lectura · el cliente ve SOLO sus presupuestos, reducidos, más recientes primero y con quota; los de otros y los del visitante no', async () => {
  const { env, jefa, duena, ana, luis } = await setup();
  const a1 = (await place(env, ana, {}, { now: NOW })).j.number, a2 = (await place(env, ana, { lines: [{ ref: REF, qty: 1 }] }, { now: NOW + H })).j.number;
  const l1 = (await place(env, luis, {}, { now: NOW + 2 * H })).j.number, v1 = (await place(env, null, {}, { now: NOW + 3 * H })).j.number, s1 = (await place(env, jefa, {}, { now: NOW + 4 * H })).j.number;
  const r = await api(env, ana, '/api/orders', { now: NOW + 5 * H }), j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(j.orders.map((o) => o.number), [a2, a1]); assert.deepEqual(j.quota, { limit: 3, used: 2 }); assert.ok(!('truncated' in j));
  for (const o of j.orders) assert.deepEqual(Object.keys(o).sort(), ['at', 'customer', 'lang', 'lines', 'number', 'total', 'unpriced'], 'forma reducida');
  assert.deepEqual(j.orders[1].lines, stored(env, a1).lines); assert.equal(j.orders[1].total, stored(env, a1).total); assert.deepEqual(j.orders[0].customer, stored(env, a2).customer);
  const txt = JSON.stringify(j); assert.ok(!/"(ip|emailed|history|lastSent|original|rev|edited|owner|prices|priceTier)":/.test(txt) && !txt.includes('203.0.113') && !txt.includes('vip10'), txt);
  assert.deepEqual((await (await api(env, luis, '/api/orders', { now: NOW + 5 * H })).json()).orders.map((o) => o.number), [l1]);
  assert.deepEqual((await (await api(env, ana, '/api/orders', { now: NOW + 26 * H })).json()).quota, { limit: 3, used: 0 }, 'quota.used cuenta las últimas 24 h');
  assert.deepEqual((await (await api(env, ana, '/api/orders', { now: NOW + 24 * H + 30 * 60_000 })).json()).quota, { limit: 3, used: 1 }, 'ventana móvil: el de las 09:00 aún cuenta a las 08:30 del día siguiente');
  const todos = (await (await api(env, duena, '/api/orders', { now: NOW + 5 * H })).json()).orders; assert.deepEqual(todos.map((o) => o.number).sort(), [a1, a2, l1, v1, s1].sort(), 'el propietario (client) sigue viendo todo');
  assert.ok(todos.every((o) => !('ip' in o) && !('error' in o.emailed)) && todos.find((o) => o.number === a1).owner === 'ana@acme.es', 'sin ip ni emailed.error, pero con owner y priceTier');
  const mgr = (await (await api(env, jefa, '/api/orders', { now: NOW + 5 * H })).json()).orders; assert.equal(mgr.length, 5); assert.ok(mgr.every((o) => typeof o.ip === 'string')); assert.equal(mgr.find((o) => o.number === v1).priceTier, 'consult');
  const cfg = await setup({ CUSTOMER_ORDERS_PER_DAY: '7' }); assert.equal((await (await api(cfg.env, cfg.ana, '/api/orders')).json()).quota.limit, 7);
});
test('Lectura · el listado del cliente trae como mucho los 100 más recientes (truncated) y no recorre los de otros', async () => {
  const { env, ana, luis } = await setup();
  for (let i = 1; i <= 105; i++) {                                              // pedidos de Ana y de Luis escritos directamente en KV, de uno en uno por día
    const day = new Date(Date.UTC(2026, 3, 1) + i * 86_400_000), n = `TV-${day.toISOString().slice(0, 10).replace(/-/g, '')}-0001-AAA`;
    for (const [who, owner] of [[ana, 'ana@acme.es'], [luis, 'luis@acme.es']]) { const num = who === ana ? n : n.replace('-AAA', '-BBB'); await env.KV.put(`order:${num}`, JSON.stringify({ number: num, at: day.toISOString(), customer: { name: owner, email: owner }, lines: [], total: 0, unpriced: 0, lang: 'es', owner, ip: '1.1.1.1' })); await env.KV.put(`oorder:${owner}:${num}`, day.toISOString()); }
  }
  const j = await (await api(env, ana, '/api/orders', { now: Date.UTC(2026, 9, 1) })).json();
  assert.equal(j.orders.length, 100); assert.equal(j.truncated, true); assert.ok(j.orders.every((o) => o.customer.email === 'ana@acme.es' && !('ip' in o)));
  assert.equal(j.orders[0].number, 'TV-20260715-0001-AAA', 'el más reciente primero'); assert.equal(j.orders[99].number, 'TV-20260407-0001-AAA'); assert.deepEqual(j.quota, { limit: 3, used: 0 });
});
test('Lectura · GET /orders/:n: el suyo en versión reducida (con la nota si la hay); el de otra persona, el del visitante y uno inexistente dan el mismo 404', async () => {
  const { env, jefa, ana, luis } = await setup();
  const a = (await place(env, ana)).j.number, l = (await place(env, luis)).j.number, v = (await place(env, null)).j.number, s = (await place(env, jefa)).j.number;
  const own = await api(env, ana, `/api/orders/${a}`), oj = await own.json(); assert.equal(own.status, 200); assert.deepEqual(Object.keys(oj), ['ok', 'order']);
  assert.deepEqual(Object.keys(oj.order).sort(), ['at', 'customer', 'lang', 'lines', 'number', 'total', 'unpriced']); assert.equal(oj.order.number, a);
  await api(env, jefa, `/api/orders/${a}`, { method: 'PUT', body: edit(0, { quoteNote: 'Validez 30 días.' }) });
  const conNota = (await (await api(env, ana, `/api/orders/${a}`)).json()).order; assert.equal(conNota.quoteNote, 'Validez 30 días.'); assert.ok(!('rev' in conNota) && !('edited' in conNota) && !('original' in conNota) && !('history' in conNota) && !('priceTier' in conNota) && !('owner' in conNota), 'sin lo que dejó la edición del equipo');
  assert.equal((await (await api(env, ana, '/api/orders')).json()).orders.find((o) => o.number === a).quoteNote, 'Validez 30 días.', 'y también en la lista');
  for (const n of [l, v, s, 'TV-20261028-9999-ZZZ', 'constructor', 'TV-20261028-0001']) { const r = await api(env, ana, `/api/orders/${n}`); assert.equal(r.status, 404, n); assert.deepEqual(await r.json(), NOT_FOUND); }
  assert.equal((await api(env, null, `/api/orders/${a}`)).status, 401);
  assert.equal((await api(env, jefa, `/api/orders/${a}`)).status, 200); assert.equal((await api(env, MASTER, `/api/orders/${l}`)).status, 200);
});
test('Lectura · PUT y send → 403 «Solo lectura» para el customer (aunque el presupuesto sea suyo o no exista) y no se toca nada', async () => {
  const { env, ana } = await setup(); const { j } = await place(env, ana), before = env.KV.m.get(`order:${j.number}`);
  const casos = [['PUT', j.number, edit(0, { quoteNote: 'hola' })], ['PUT', 'TV-20261028-9999-ZZZ', edit(0)], ['PUT', 'basura', {}], ['POST', `${j.number}/send`, { to: ['a@b.es'], pdf: PDF_B64 }], ['POST', 'TV-20261028-9999-ZZZ/send', {}]];
  for (const [method, rest, body] of casos) { const r = await api(env, ana, `/api/orders/${rest}`, { method, body }); assert.equal(r.status, 403, `${method} ${rest}`); assert.deepEqual(await r.json(), { ok: false, error: 'Solo lectura' }); }
  assert.equal(env.KV.m.get(`order:${j.number}`), before, 'el presupuesto no cambió'); assert.equal((await api(env, ana, `/api/orders/${j.number}`, { method: 'DELETE' })).status, 403, 'cualquier otro método tampoco');
  assert.equal(keys(env, 'rl:qsend').length, 0);
});
test('Lectura · CORS admite PUT y DELETE en el preflight', async () => {
  const { env } = await setup();
  const r = await call(env, '/api/customers/x%40y.es', { method: 'OPTIONS', origin: 'https://demo.example', ip: freshIp() });
  assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://demo.example'); assert.match(r.headers.get('Access-Control-Allow-Methods'), /PUT/); assert.match(r.headers.get('Access-Control-Allow-Methods'), /DELETE/); assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

// ───────────────────────────────────────── 8 · PUT /orders/:n con tier
test('PUT con tier · un presupuesto «A consultar» queda valorado con esa categoría aunque no cambie ninguna cantidad; priceTier pasa a ese valor', async () => {
  const { env, jefa, duena } = await setup();
  const n = (await place(env, null)).j.number; assert.equal(stored(env, n).priceTier, 'consult');
  const r = await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(0, { tier: 'vip5' }) }), j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j)); assert.deepEqual(j.order.lines, [{ ref: REF, qty: 2, unit: 71.0325, total: 142.07 }, { ref: REF2, qty: 3, unit: 16.611, total: 49.83 }]); assert.deepEqual([j.order.total, j.order.unpriced, j.order.priceTier, j.order.rev], [191.9, 0, 'vip5', 1]);
  assert.deepEqual(j.order.prices, { updated_at: '2026-10-27T00:00:00Z', mode: 'live' }); assert.equal(stored(env, n).priceTier, 'vip5'); assert.equal(j.order.original.unpriced, 2, 'lo que llegó de la web queda en original');
  const otra = await api(env, duena, `/api/orders/${n}`, { method: 'PUT', body: edit(1, { tier: 'normal' }) }); assert.deepEqual((await otra.json()).order.lines.map((l) => l.unit), [77.7975, 18.193], 'el propietario también puede, y revalora con la nueva categoría');
  const vip = await (await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(2, { tier: 'vip' }) })).json(); assert.deepEqual([vip.order.lines.map((l) => l.unit), vip.order.priceTier], [[67.65, 15.82], 'vip']);
});
test('PUT con tier · solo reprecia las líneas SIN price explícito: las de price numérico quedan manuales y `manual` desaparece de las demás', async () => {
  const { env, jefa } = await setup();
  const n = (await place(env, jefa)).j.number;                                                                  // VIP
  await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 2, price: 10.5 }, { ref: REF2, qty: 3 }] }) });
  const r = await (await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(1, { tier: 'normal', lines: [{ ref: REF, qty: 2, price: 10.5 }, { ref: REF2, qty: 3 }] }) })).json();
  assert.deepEqual(r.order.lines, [{ ref: REF, qty: 2, unit: 10.5, total: 21, manual: true }, { ref: REF2, qty: 3, unit: 18.193, total: 54.58 }], 'la manual sigue manual; la otra, a Normal (sin qty cambiada)');
  const m2 = (await place(env, jefa)).j.number; await api(env, jefa, `/api/orders/${m2}`, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 2, price: 10.5 }, { ref: REF2, qty: 3 }] }) });
  const sin = await (await api(env, jefa, `/api/orders/${m2}`, { method: 'PUT', body: edit(1, { tier: 'vip10' }) })).json();
  assert.deepEqual(sin.order.lines, [{ ref: REF, qty: 2, unit: 74.415, total: 148.83 }, { ref: REF2, qty: 3, unit: 17.402, total: 52.21 }], 'sin price en el cuerpo, lo que era manual vuelve a la tarifa de la categoría');
  const nul = await (await api(env, jefa, `/api/orders/${m2}`, { method: 'PUT', body: edit(2, { tier: 'vip5', lines: [{ ref: REF, qty: 2, price: null }, { ref: REF2, qty: 3, price: 0 }] }) })).json();
  assert.deepEqual(nul.order.lines, [{ ref: REF, qty: 2, unit: 71.0325, total: 142.07 }, { ref: REF2, qty: 3, unit: 0, total: 0, manual: true }], 'price:null vuelve a la tarifa de la categoría; price 0 es un precio manual');
});
test('PUT con tier · sin tier lo nuevo se valora con la categoría del presupuesto (VIP +10 aquí), lo demás se conserva y priceTier no cambia; tier inválido 400; tier null se ignora', async () => {
  const { env, jefa, ana } = await setup();
  const n = (await place(env, ana)).j.number; assert.equal(stored(env, n).priceTier, 'vip10');
  const sin = await (await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(0, { lines: [{ ref: REF, qty: 2 }, { ref: REF2, qty: 12 }, { ref: REF3, qty: 1 }] }) })).json();
  assert.deepEqual(sin.order.lines, [{ ref: REF, qty: 2, unit: 74.415, total: 148.83 }, { ref: REF2, qty: 12, unit: 16.61, total: 199.32 }, { ref: REF3, qty: 1, unit: null, total: null }], 'lo que no cambia se conserva; la qty cambiada se valora con la categoría del presupuesto (VIP +10: 15,10 × 1,10), no con el VIP');
  assert.equal(sin.order.priceTier, 'vip10', 'priceTier no cambia sin tier');
  const nulo = await (await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(1, { tier: null }) })).json(); assert.equal(nulo.ok, true); assert.equal(nulo.order.priceTier, 'vip10');
  for (const t of ['oro', 5, 'VIP', ['vip'], true]) { const r = await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(2, { tier: t }) }); assert.equal(r.status, 400, String(t)); const j = await r.json(); assert.equal(j.field, 'tier'); assert.equal(j.error, 'Categoría no válida'); }
  assert.equal(stored(env, n).rev, 2, 'los rechazados no guardaron nada');
  const conTier = await (await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(2, { tier: 'vip5', lines: [{ ref: REF, qty: 2 }] }) })).json(); assert.deepEqual(conTier.order.lines, [{ ref: REF, qty: 2, unit: 71.0325, total: 142.07 }]);
  assert.equal((await api(env, MASTER, `/api/orders/${n}`, { method: 'PUT', body: edit(3, { tier: 'normal' }) })).status, 200);
  const vacio = await (await api(env, jefa, `/api/orders/${n}`, { method: 'PUT', body: edit(4, { tier: '' }) })).json(); assert.equal(vacio.ok, true, 'tier vacío = no viene'); assert.equal(vacio.order.priceTier, 'normal', 'y deja el priceTier como estaba');
});
