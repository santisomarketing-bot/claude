// [PRUEBAS-PRECIOS] Precios por categoría (docs/PRECIOS-Y-CLIENTES.md §2–§5, pruebas 1, 2, 4 y 5 del apartado 7): el cálculo de VIP / VIP +5 / VIP +10 / Normal con redondeo a 4 decimales, GET /api/prices según quién llama,
// los ajustes de precios (settings:pricing), la edición de un producto (PUT /api/prices/items/:ref) y la sincronización con la hoja, que no pisa lo editado a mano (`m`). Sin red: KV en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTER, TCTX, PRICES, mkEnv } from './helpers.js';
import { call, signIn, orderEnv, keys, freshIp } from './kit.js';
import { scale4, unitPrice, priceOrder, consultOrder, manualRefs, assertFinitePrices, massChange, mergePrices } from '../src/prices.js';
import { loadPricing, validate, approxPrice, parseItemEdit, tierPct, tierTable, blank, KEY } from '../src/pricing.js';
import { applyPriceChanges } from '../src/ai.js';
import { syncPrices } from '../src/sheets.js';
import api from '../src/index.js';

const REF = 'P16633', REF2 = 'P8339', REF3 = 'P15355';                   // referencias reales del catálogo; REF3 no tiene precio
/** Lista de precios de ejemplo en KV (VIP): REF con tramos, REF2 con decimales raros, REF3 sin precio, más productos «de mentira» para las reglas del aproximado. */
const ITEMS = {
  [REF]: { p: 100, t: [[10, 90], [50, 80]], note: 'Oferta' }, [REF2]: { p: 67.65, m: true, a: 70 },
  SMALL: { p: 4.2 }, FIXED: { p: 125.3, a: 99 }, NEVER: { p: 50, a: false }, ONLYA: { a: 50 }, ONLYM: { m: true },
};
/** Entorno con la lista de ejemplo, los ajustes por defecto (visitante: «Consultar precio»), un manager, el propietario y un cliente VIP +5 con sesión; `pricing` sustituye los ajustes guardados. */
async function setup({ pricing, items = ITEMS } = {}) {
  const env = await orderEnv(); await env.KV.delete(KEY);
  if (pricing) await env.KV.put(KEY, JSON.stringify(pricing));
  await env.KV.put('prices:current', JSON.stringify({ ...PRICES, source: 'upload:ana@torivac.com', items }));
  await env.KV.put('prices:meta', JSON.stringify({ at: '2026-10-27T10:00:00.000Z', reason: 'upload:ana@torivac.com', source: 'upload:ana@torivac.com', refs: 7, changed: 0, added: 7, removed: 0 }));
  await env.KV.put('prices:sync', JSON.stringify({ at: '2026-10-27T10:00:00.000Z', reason: 'cron', ok: true, blocked: false, error: '', refs: 7 }));
  const jefa = await signIn(env, 'jefa@torivac.com', 'manager', { ip: '10.9.0.1' }), duena = await signIn(env, 'duena@torivac.com', 'client', { ip: '10.9.0.2' });
  const cli = await signIn(env, 'cli@acme.es', 'customer', { ip: '10.9.0.3', tier: 'vip5' });
  return { env, jefa, duena, cli };
}
/** GET /api/prices con la sesión indicada (o sin ella) → { r (Response), j (JSON) }. */
async function getPrices(env, token) { const r = await call(env, '/api/prices', { token, ip: freshIp() }); return { r, j: await r.json() }; }
/** PUT /api/prices/items/<ref codificada> con el cuerpo dado → { r, j }. */
async function putItem(env, who, ref, body, extra = {}) { const r = await call(env, `/api/prices/items/${encodeURIComponent(ref)}`, { method: 'PUT', body, token: who && (who.token ?? who), ip: freshIp(), ...extra }); return { r, j: await r.json() }; }
/** Los precios vigentes guardados en KV (sin pasar por la API). */
const stored = (env) => JSON.parse(env.KV.m.get('prices:current'));
/** Cuerpo válido del PUT de ajustes de precios. */
const PRICING_OK = { tiers: { vip5: 4, vip10: 8.5, normal: 20 }, anon: 'normal', approx: { on: true, pct: 25 } };

// ───────────────────────────────────────── 1 · cálculo
test('Precios · cálculo: VIP es el precio base y VIP +5, VIP +10 y Normal lo escalan 5, 10 y 15 % (tramos incluidos) con redondeo a 4 decimales', () => {
  const t = { 'vip': 0, 'vip5': 5, 'vip10': 10, 'normal': 15 };
  const prices = { items: { A: { p: 100, t: [[10, 90], [50, 80]] }, B: { p: 67.65 }, C: {} } };
  assert.deepEqual([0, 5, 10, 15].map((pct) => unitPrice(prices, 'A', 1, pct)), [100, 105, 110, 115]);
  assert.deepEqual([0, 5, 10, 15].map((pct) => unitPrice(prices, 'A', 10, pct)), [90, 94.5, 99, 103.5], 'cada tramo se escala con el mismo porcentaje');
  assert.deepEqual([0, 5, 10, 15].map((pct) => unitPrice(prices, 'A', 60, pct)), [80, 84, 88, 92], 'el último tramo alcanzado');
  assert.deepEqual([0, 5, 10, 15].map((pct) => unitPrice(prices, 'B', 1, pct)), [67.65, 71.0325, 74.415, 77.7975], 'hasta 4 decimales');
  assert.equal(unitPrice(prices, 'C', 5, 15), null, 'una referencia sin precio sigue siendo «A consultar» en todas las categorías');
  assert.equal(unitPrice(prices, 'NO', 5, 15), null); assert.equal(unitPrice(prices, 'constructor', 5, 15), null);
  assert.deepEqual(Object.keys(t).map((k) => [k, tierPct({ tiers: { vip5: 5, vip10: 10, normal: 15 } }, k)]), Object.entries(t), 'VIP vale siempre 0');
});
test('Precios · cálculo con porcentajes cambiados y redondeo exacto a 4 decimales (el medio sube)', () => {
  assert.equal(scale4(67.65, 2.5), 69.3413, '67,65 × 1,025 = 69,34125 → 69,3413');
  assert.equal(scale4(12.375, 5), 12.9938, '12,375 × 1,05 = 12,99375 → 12,9938');
  assert.equal(scale4(0.001, 5), 0.0011); assert.equal(scale4(100, 0), 100); assert.equal(scale4(11.9, 7.25), 12.7628);
  assert.equal(scale4(12.37093203, 15), Math.round(12.37093203 * 1.15 * 1e4) / 1e4, 'si el precio trae más de 4 decimales se calcula en coma flotante');
  const pricing = { tiers: { vip5: 2.5, vip10: 7.25, normal: 20 } };
  assert.deepEqual(['vip', 'vip5', 'vip10', 'normal'].map((k) => unitPrice({ items: { B: { p: 67.65 } } }, 'B', 1, tierPct(pricing, k))), [67.65, 69.3413, 72.5546, 81.18]);
  const r = priceOrder({ items: { A: { p: 100, t: [[10, 90]] }, C: {} } }, [{ ref: 'A', qty: 10 }, { ref: 'C', qty: 3 }], 15);
  assert.deepEqual(r.lines.map((l) => [l.unit, l.total]), [[103.5, 1035], [null, null]]); assert.equal(r.total, 1035); assert.equal(r.unpriced, 1, 'la línea sin precio no suma');
  assert.deepEqual(priceOrder({ items: { A: { p: 3.3333 } } }, [{ ref: 'A', qty: 3 }], 10).lines[0], { ref: 'A', qty: 3, unit: 3.6666, total: 11 }, 'el importe de línea sigue siendo round2(unit × qty)');
  assert.deepEqual(consultOrder([{ ref: 'A', qty: 1 }, { ref: 'B', qty: 2 }]), { lines: [{ ref: 'A', qty: 1, unit: null, total: null }, { ref: 'B', qty: 2, unit: null, total: null }], total: 0, unpriced: 2 });
});
test('Precios · una referencia con solo `a` o `m` (sin `p`) se valora «A consultar», se puede guardar y no estorba', () => {
  const prices = { items: { X: { a: 50 }, Y: { m: true }, Z: { p: 5, m: true } } };
  assert.equal(unitPrice(prices, 'X', 1), null); assert.equal(unitPrice(prices, 'Y', 3, 15), null);
  assert.deepEqual(priceOrder(prices, [{ ref: 'X', qty: 1 }, { ref: 'Z', qty: 2 }]).lines.map((l) => l.total), [null, 10]);
  assert.doesNotThrow(() => assertFinitePrices(prices)); assert.deepEqual([...manualRefs(prices)].sort(), ['Y', 'Z']);
  assert.throws(() => assertFinitePrices({ items: { X: { p: NaN } } }), /Precio no válido/); assert.throws(() => assertFinitePrices({ items: { X: { a: -1 } } }), /Precio no válido/);
  assert.throws(() => assertFinitePrices({ items: { X: { a: true } } }), /Precio no válido/);
});
test('Precios · la categoría de un cliente se lee de su registro en cada petición: cambiarla vale al instante', async () => {
  const { env, duena, cli } = await setup();
  const before = (await getPrices(env, cli.token)).j.prices.items[REF].p;
  assert.equal(before, 105, 'VIP +5');
  const r = await call(env, '/api/customers/cli%40acme.es', { method: 'PUT', body: { tier: 'normal' }, token: duena.token, ip: freshIp() }); assert.equal(r.status, 200);
  assert.equal((await getPrices(env, cli.token)).j.prices.items[REF].p, 115, 'el mismo token ve ya la nueva categoría');
  await env.KV.put(KEY, JSON.stringify({ tiers: { vip5: 5, vip10: 10, normal: 30 }, anon: 'consult', approx: { on: false, pct: 15 } }));
  assert.equal((await getPrices(env, cli.token)).j.prices.items[REF].p, 130, 'y cambiar los porcentajes también');
});

// ───────────────────────────────────────── 2 · GET /api/prices según quién llama
test('GET /prices · manager y propietario ven el precio VIP con las marcas m y a; el manager, el detalle de la hoja y sync; el propietario, como el público; ambos meta.manual_count', async () => {
  const { env, jefa, duena } = await setup();
  const m = await getPrices(env, jefa.token);
  assert.equal(m.r.status, 200); assert.equal(m.r.headers.get('Cache-Control'), 'private, no-store'); assert.equal(m.r.headers.get('Vary'), 'Origin, Authorization');
  assert.deepEqual(m.j.prices.items[REF], { p: 100, t: [[10, 90], [50, 80]], note: 'Oferta' }); assert.deepEqual(m.j.prices.items[REF2], { p: 67.65, m: true, a: 70 }); assert.deepEqual(m.j.prices.items.NEVER, { p: 50, a: false });
  assert.equal(m.j.prices.source, 'upload:ana@torivac.com', 'el manager ve quién cargó la hoja'); assert.equal(m.j.meta.reason, 'upload:ana@torivac.com'); assert.equal(m.j.meta.manual_count, 2, 'REF2 y ONLYM'); assert.equal(m.j.sync.reason, 'cron');
  const o = await getPrices(env, duena.token);
  assert.equal(o.r.headers.get('Cache-Control'), 'private, no-store'); assert.deepEqual(o.j.prices.items[REF2], { p: 67.65, m: true, a: 70 }); assert.equal(o.j.prices.items[REF].p, 100, 'el propietario ve VIP');
  assert.equal(o.j.prices.source, 'upload', 'sin quién ni de dónde'); assert.equal(o.j.meta.reason, 'upload'); assert.equal(o.j.meta.manual_count, 2); assert.ok(!('sync' in o.j) && !JSON.stringify(o.j).includes('@'));
  const t = await getPrices(env, MASTER); assert.equal(t.j.prices.items[REF].p, 100); assert.equal(t.j.meta.manual_count, 2, 'el token maestro cuenta como manager');
});
test('GET /prices · un cliente ve los precios de SU categoría (p y tramos escalados), sin m, a ni el nombre de la categoría; el VIP no aparece', async () => {
  const { env, jefa, cli } = await setup();
  const c = await getPrices(env, cli.token);
  assert.equal(c.r.headers.get('Cache-Control'), 'private, no-store'); assert.equal(c.r.headers.get('Vary'), 'Origin, Authorization');
  assert.deepEqual(c.j.prices.items[REF], { p: 105, t: [[10, 94.5], [50, 84]], note: 'Oferta' }); assert.deepEqual(c.j.prices.items[REF2], { p: 71.0325 }, 'sin m ni a');
  assert.deepEqual(c.j.prices.items.NEVER, { p: 52.5 }); assert.ok(!('ONLYA' in c.j.prices.items) && !('ONLYM' in c.j.prices.items), 'lo que no tiene precio no sale');
  const txt = JSON.stringify(c.j);
  assert.ok(!/"[ma]":/.test(txt) && !/vip/i.test(txt) && !/normal/i.test(txt) && !txt.includes('@'), 'ni marcas ni categoría ni correos: ' + txt);
  assert.ok(!txt.includes('"p":100,') && !txt.includes('67.65') && !txt.includes('[10,90]'), 'el precio VIP no se publica a un cliente VIP +5');
  assert.equal(c.j.prices.source, 'upload'); assert.ok(!('sync' in c.j) && !('manual_count' in c.j.meta));
  await call(env, '/api/customers/cli%40acme.es', { method: 'PUT', body: { tier: 'vip10' }, token: jefa.token, ip: freshIp() });
  assert.deepEqual((await getPrices(env, cli.token)).j.prices.items[REF], { p: 110, t: [[10, 99], [50, 88]], note: 'Oferta' }, 'cambiar su tier cambia lo que ve');
  await call(env, '/api/customers/cli%40acme.es', { method: 'PUT', body: { tier: 'vip' }, token: jefa.token, ip: freshIp() });
  assert.equal((await getPrices(env, cli.token)).j.prices.items[REF].p, 100, 'un cliente VIP sí ve el precio VIP (el suyo)');
});
test('GET /prices · manual_skipped (cuántas manuales saltó la hoja) es del equipo: lo ven manager y propietario, no un cliente ni un visitante; lo que no tiene precio no sale para ellos', async () => {
  const { env, jefa, duena, cli } = await setup({ pricing: { tiers: { vip5: 5, vip10: 10, normal: 15 }, anon: 'normal', approx: { on: false, pct: 15 } }, items: { ...ITEMS, SINPRECIO: { pid: 884, n: 'Sin precio' } } });
  await env.KV.put('prices:meta', JSON.stringify({ at: '2026-10-27T10:00:00.000Z', reason: 'cron', source: 'sheet:ID', refs: 7, changed: 1, added: 0, removed: 0, manual_skipped: 3 }));
  assert.equal((await getPrices(env, jefa.token)).j.meta.manual_skipped, 3); assert.equal((await getPrices(env, duena.token)).j.meta.manual_skipped, 3);
  for (const token of [cli.token, undefined]) { const { j } = await getPrices(env, token); assert.ok(!('manual_skipped' in j.meta) && !JSON.stringify(j).includes('manual'), 'lo interno no sale'); assert.ok(!('SINPRECIO' in j.prices.items), 'sin precio no hay nada que enseñar'); assert.equal(j.meta.reason, 'cron'); }
  assert.ok('SINPRECIO' in (await getPrices(env, jefa.token)).j.prices.items, 'el equipo lo ve todo');
});
test('GET /prices · visitante con anon «normal»: precios Normal completos (con tramos), sin m ni a; el VIP no aparece; caché pública', async () => {
  const { env } = await setup({ pricing: { tiers: { vip5: 5, vip10: 10, normal: 15 }, anon: 'normal', approx: { on: true, pct: 15 } } });
  const v = await getPrices(env);
  assert.equal(v.r.headers.get('Cache-Control'), 'public, max-age=300'); assert.equal(v.r.headers.get('Vary'), 'Origin, Authorization');
  assert.deepEqual(v.j.prices.items[REF], { p: 115, t: [[10, 103.5], [50, 92]], note: 'Oferta' }); assert.deepEqual(v.j.prices.items[REF2], { p: 77.7975 }); assert.ok(!('approx' in v.j.prices), 'con anon normal no hay aproximados');
  const txt = JSON.stringify(v.j); assert.ok(!/"[ma]":/.test(txt) && !txt.includes('"p":100,') && !txt.includes('67.65'), txt);
  assert.equal(v.j.prices.source, 'upload');
});
test('GET /prices · visitante con anon «consult» y precio aproximado: una cifra por unidad, sin tramos, según las reglas del apartado 2', async () => {
  const { env } = await setup({ pricing: { tiers: { vip5: 5, vip10: 10, normal: 15 }, anon: 'consult', approx: { on: true, pct: 15 } } });
  const v = await getPrices(env);
  assert.equal(v.j.prices.approx, true); assert.equal(v.r.headers.get('Cache-Control'), 'public, max-age=300');
  assert.deepEqual(v.j.prices.items, { [REF]: { p: 115 }, [REF2]: { p: 70 }, SMALL: { p: 4.8 }, FIXED: { p: 99 }, ONLYA: { p: 50 } }, 'p + 15 % redondeado (≥ 10 € al euro; si no, 1 decimal); `a` número manda aunque no haya precio; `a: false` y sin precio, nada');
  const txt = JSON.stringify(v.j); assert.ok(!txt.includes('"t"') && !/"[ma]":/.test(txt) && !txt.includes('"p":100,') && !txt.includes('67.65') && !txt.includes('125.3'), 'sin tramos ni marcas ni el precio VIP: ' + txt);
  assert.equal(v.j.prices.source, 'upload');
});
test('GET /prices · reglas del aproximado: a false, a número, p con approx.pct y redondeo; nada sin precio ni `a`', () => {
  /** Ajustes con el aproximado encendido y ese porcentaje. */
  const pr = (pct) => ({ approx: { on: true, pct } }), off = { approx: { on: false, pct: 15 } };
  assert.equal(approxPrice({ p: 100, a: false }, pr(15)), null); assert.equal(approxPrice({ a: false }, pr(15)), null);
  assert.equal(approxPrice({ p: 100, a: 130 }, pr(15)), 130); assert.equal(approxPrice({ a: 0.5 }, pr(15)), 0.5, '`a` es tal cual');
  assert.equal(approxPrice({ p: 100 }, pr(15)), 115); assert.equal(approxPrice({ p: 100 }, pr(0)), 100); assert.equal(approxPrice({ p: 100 }, pr(200)), 300);
  assert.equal(approxPrice({ p: 9.99 }, pr(0)), 10, '9,99 → 1 decimal → 10'); assert.equal(approxPrice({ p: 9.5 }, pr(0)), 9.5); assert.equal(approxPrice({ p: 4.2 }, pr(15)), 4.8); assert.equal(approxPrice({ p: 9.2 }, pr(15)), 11, '9,2 × 1,15 = 10,58 → al euro: 11');
  assert.equal(approxPrice({ p: 10 }, pr(0)), 10); assert.equal(approxPrice({ p: 12.5 }, pr(0)), 13);
  assert.equal(approxPrice({ m: true }, pr(15)), null); assert.equal(approxPrice({}, pr(15)), null); assert.equal(approxPrice({ p: 0 }, pr(15)), null); assert.equal(approxPrice(null, pr(15)), null);
  assert.equal(approxPrice({ p: 100 }, off), null, 'con el aproximado apagado no se calcula'); assert.equal(approxPrice({ p: 100, a: 130 }, off), 130, '(la vista pública ya lo corta antes: aquí solo se aplican las reglas por referencia)');
});
test('GET /prices · visitante con anon «consult» y aproximado apagado (por defecto): ninguna cifra, mode «none»', async () => {
  const { env } = await setup();
  const v = await getPrices(env);
  assert.equal(v.r.status, 200); assert.deepEqual(v.j.prices.items, {}); assert.equal(v.j.prices.mode, 'none'); assert.ok(!('approx' in v.j.prices));
  assert.equal(v.r.headers.get('Vary'), 'Origin, Authorization'); assert.match(v.r.headers.get('Cache-Control'), /public/);
  const txt = JSON.stringify(v.j); assert.ok(!txt.includes('"p":') && !txt.includes('67.65') && !txt.includes('"m"'), txt);
  const env2 = mkEnv(); assert.deepEqual((await getPrices(env2)).j.prices.items, {}, 'sin nada guardado (ni ajustes ni precios) tampoco hay cifras');
});
test('GET /prices · una sesión no válida o caducada se trata como visitante (no es un error); un token borrado, también', async () => {
  const { env, jefa, cli } = await setup();
  const anon = (await getPrices(env)).j;
  const falso = await getPrices(env, 'x'.repeat(60)); assert.equal(falso.r.status, 200); assert.deepEqual(falso.j, anon); assert.match(falso.r.headers.get('Cache-Control'), /public/, 'visitante: caché pública');
  const r = await call(env, '/api/prices', { token: cli.token, ip: freshIp(), deps: { now: Date.now() + 25 * 3600 * 1000 } }); assert.equal(r.status, 200); assert.deepEqual(await r.json(), anon, 'caducada = visitante');
  await call(env, '/api/users/cli%40acme.es', { method: 'DELETE', token: jefa.token, ip: freshIp() });
  const borrado = await getPrices(env, cli.token); assert.equal(borrado.r.status, 200); assert.deepEqual(borrado.j, anon, 'si se borra la cuenta, su sesión deja de valer: visitante');
});

// ───────────────────────────────────────── 4 · ajustes de precios
test('Ajustes de precios · por defecto 5/10/15, consult, aproximado apagado; GET y PUT solo para manager y propietario', async () => {
  const { env, jefa, duena, cli } = await setup();
  assert.deepEqual(blank(), { tiers: { vip5: 5, vip10: 10, normal: 15 }, anon: 'consult', approx: { on: false, pct: 15 }, updated: null });
  const g = await call(env, '/api/settings/pricing', { token: jefa.token, ip: freshIp() }); assert.equal(g.status, 200); assert.equal(g.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await g.json(), { ok: true, pricing: blank() });
  for (const [who, st] of [[null, 401], [cli, 403]]) {
    assert.equal((await call(env, '/api/settings/pricing', { token: who && who.token, ip: freshIp() })).status, st);
    assert.equal((await call(env, '/api/settings/pricing', { method: 'PUT', body: PRICING_OK, token: who && who.token, ip: freshIp() })).status, st);
  }
  assert.equal((await call(env, '/api/settings/pricing', { token: duena.token, ip: freshIp() })).status, 200, 'el propietario puede ver');
  assert.equal((await call(env, '/api/settings/pricing', { token: 'falso'.repeat(10), ip: freshIp() })).status, 401);
  assert.deepEqual(await loadPricing(env), blank(), 'los intentos rechazados no guardan nada'); assert.equal(env.KV.m.has(KEY), false);
});
test('Ajustes de precios · guardar deja quién y cuándo (manager, propietario y token maestro) y los precios del visitante cambian al instante', async () => {
  const { env, jefa, duena } = await setup();
  const NOW = Date.parse('2026-10-29T10:00:00Z');
  let r = await call(env, '/api/settings/pricing', { method: 'PUT', body: PRICING_OK, token: jefa.token, ip: freshIp(), deps: { now: NOW } }), j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(j.pricing, { ...PRICING_OK, updated: { at: '2026-10-29T10:00:00.000Z', by: 'jefa@torivac.com' } });
  r = await call(env, '/api/settings/pricing', { method: 'PUT', body: { ...PRICING_OK, anon: 'consult' }, token: duena.token, ip: freshIp(), deps: { now: NOW + 1000 } }); assert.equal((await r.json()).pricing.updated.by, 'duena@torivac.com');
  r = await call(env, '/api/settings/pricing', { method: 'PUT', body: PRICING_OK, token: MASTER, ip: freshIp(), deps: { now: NOW + 2000 } }); assert.equal((await r.json()).pricing.updated.by, 'maestro');
  const v = await getPrices(env); assert.equal(v.j.prices.items[REF].p, 120, 'anon normal con el 20 % nuevo');
  assert.deepEqual((await (await call(env, '/api/settings/pricing', { token: jefa.token, ip: freshIp() })).json()).pricing, { ...PRICING_OK, updated: { at: '2026-10-29T10:00:02.000Z', by: 'maestro' } });
});
test('Ajustes de precios · validación: rangos, decimales, orden vip5 ≤ vip10 ≤ normal, anon, approx y cuerpos basura → 400 con su field; lo rechazado no toca lo guardado', async () => {
  const { env, jefa } = await setup();
  /** PUT de ajustes como manager → { status, j }. */
  const put = async (body) => { const r = await call(env, '/api/settings/pricing', { method: 'PUT', body, token: jefa.token, ip: freshIp() }); return { status: r.status, j: await r.json() }; };
  /** Cuerpo válido con campos sustituidos. */
  const con = (over) => ({ ...PRICING_OK, ...over });
  /** Cuerpo parcial con los porcentajes de categoría sustituidos. */
  const tiers = (t) => ({ tiers: { ...PRICING_OK.tiers, ...t } });
  /** Cuerpo parcial con el aproximado sustituido. */
  const approx = (a) => ({ approx: { ...PRICING_OK.approx, ...a } });
  const casos = [
    [con(tiers({ vip5: -1 })), 'tiers.vip5'], [con(tiers({ vip5: 101 })), 'tiers.vip5'], [con(tiers({ vip5: 5.123 })), 'tiers.vip5'], [con(tiers({ vip5: '5' })), 'tiers.vip5'], [con(tiers({ vip5: null })), 'tiers.vip5'],
    [con(tiers({ vip10: 100.5 })), 'tiers.vip10'], [con(tiers({ vip10: undefined })), 'tiers.vip10'], [con(tiers({ normal: 150 })), 'tiers.normal'], [con(tiers({ normal: 'alto' })), 'tiers.normal'], [con(tiers({ normal: NaN })), 'tiers.normal'],
    [con(tiers({ vip5: 9, vip10: 8 })), 'tiers.vip10'], [con(tiers({ vip10: 9, normal: 8.99 })), 'tiers.normal'], [con(tiers({ vip5: 30, vip10: 20, normal: 10 })), 'tiers.vip10'],
    [con({ anon: 'otro' }), 'anon'], [con({ anon: true }), 'anon'], [{ tiers: PRICING_OK.tiers, approx: PRICING_OK.approx }, 'anon'],
    [con(approx({ pct: -1 })), 'approx.pct'], [con(approx({ pct: 201 })), 'approx.pct'], [con(approx({ pct: '15' })), 'approx.pct'], [con(approx({ pct: 12.345 })), 'approx.pct'],
    [con(approx({ on: 'si' })), 'approx.on'], [con(approx({ on: 1 })), 'approx.on'], [con({ approx: 'no' }), 'approx.pct'], [con({ tiers: [5, 10, 15] }), 'tiers.vip5'],
  ];
  for (const [body, field] of casos) { const r = await put(body); assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(r.j.ok, false); assert.equal(r.j.field, field, JSON.stringify(body) + ' → ' + r.j.field); assert.ok(r.j.error); }
  for (const raro of ['"texto"', '[1,2]', 'null', '{}', 'esto no es json', '', '42']) { const r = await put(raro); assert.equal(r.status, 400, raro); assert.equal(r.j.ok, false); }
  const grande = await put(JSON.stringify({ ...PRICING_OK, relleno: 'x'.repeat(3000) })); assert.equal(grande.status, 400, 'cuerpo > 2 KB: «Petición no válida», como en Ajustes → Google'); assert.deepEqual(grande.j, { ok: false, error: 'Petición no válida', field: '' });
  assert.equal(env.KV.m.has(KEY), false, 'nada de lo rechazado se guardó');
  for (const ok of [con(tiers({ vip5: 0, vip10: 0, normal: 0 })), con(tiers({ vip5: 100, vip10: 100, normal: 100 })), con(tiers({ vip5: 2.25 })), con(approx({ pct: 0 })), con(approx({ pct: 200 })), con(approx({ pct: 12.5 })), con({ anon: 'consult' })]) assert.equal((await put(ok)).status, 200, JSON.stringify(ok));
  assert.equal((await put({ ...PRICING_OK, relleno: 1 })).status, 200, 'los campos que sobran se ignoran');
  assert.ok(!('relleno' in JSON.parse(env.KV.m.get(KEY))), 'y no se guardan');
});
test('Ajustes de precios · validate: forma de lo normalizado y orden de los errores', () => {
  assert.deepEqual(validate(PRICING_OK), { pricing: { tiers: PRICING_OK.tiers, anon: 'normal', approx: { on: true, pct: 25 } } });
  assert.equal(validate({}).field, 'tiers.vip5'); assert.equal(validate(null).field, ''); assert.equal(validate([]).field, '');
  assert.deepEqual(tierTable({ tiers: { vip5: 5, vip10: 10, normal: 15 } }), { vip: { label: 'VIP', pct: 0 }, vip5: { label: 'VIP +5', pct: 5 }, vip10: { label: 'VIP +10', pct: 10 }, normal: { label: 'Normal', pct: 15 } });
});
test('Ajustes de precios · un valor dañado en el almacén vuelve al valor por defecto (campo a campo); el JSON roto, a todo por defecto', async () => {
  const env = mkEnv();
  /** Guarda tal cual en KV unos ajustes (un objeto se serializa; un texto va como está). */
  const guardar = (v) => env.KV.put(KEY, typeof v === 'string' ? v : JSON.stringify(v));
  await guardar({ tiers: { vip5: 'x', vip10: 12, normal: 18 }, anon: 'otro', approx: { on: 'si', pct: 500 }, updated: { at: 5, by: 'x' } });
  assert.deepEqual(await loadPricing(env), { tiers: { vip5: 5, vip10: 12, normal: 18 }, anon: 'consult', approx: { on: false, pct: 15 }, updated: null }, 'cada campo malo → su valor por defecto');
  await guardar({ tiers: { vip5: 30, vip10: 20, normal: 10 }, anon: 'normal', approx: { on: true, pct: 40 } });
  assert.deepEqual((await loadPricing(env)).tiers, { vip5: 5, vip10: 10, normal: 15 }, 'si el orden está roto, vuelven los tres porcentajes');
  assert.deepEqual((await loadPricing(env)).approx, { on: true, pct: 40 }); assert.equal((await loadPricing(env)).anon, 'normal');
  await guardar({ tiers: { vip5: 1.234, vip10: 2, normal: 3 } }); assert.deepEqual((await loadPricing(env)).tiers, { vip5: 5, vip10: 10, normal: 15 }, 'un decimal de más → ese vuelve a 5, y con 5 > 2 el orden queda roto → vuelven los tres');
  await guardar({ updated: { at: '2026-10-29T10:00:00.000Z', by: 'jefa@torivac.com\nX' } }); assert.deepEqual((await loadPricing(env)).updated, { at: '2026-10-29T10:00:00.000Z', by: 'jefa@torivac.com X' });
  for (const malo of ['basura {', '"texto"', '[1]', 'null', '5']) { await guardar(malo); assert.deepEqual(await loadPricing(env), blank(), malo); }
});

// ───────────────────────────────────────── 5 · edición de un producto
test('Producto · editar p, t, a y manual: la marca m se pone sola con p o t, `a` no la pone, manual:false la quita; se guarda con histórico y fecha nueva', async () => {
  const { env, jefa, duena } = await setup({ items: { [REF]: { p: 100, t: [[10, 90]], note: 'Oferta' }, [REF2]: { p: 20 } } });
  const NOW = new Date('2026-10-29T10:00:00Z');
  let { r, j } = await putItem(env, jefa, REF, { p: 55.5 }, { deps: { now: NOW } });
  assert.equal(r.status, 200); assert.deepEqual(j, { ok: true, ref: REF, item: { p: 55.5, t: [[10, 90]], m: true } }, 'solo p, t, a y m; la nota no sale pero se conserva');
  assert.deepEqual(stored(env).items[REF], { p: 55.5, t: [[10, 90]], note: 'Oferta', m: true }); assert.equal(stored(env).updated_at, '2026-10-29T10:00:00.000Z'); assert.equal(stored(env).source, 'upload:ana@torivac.com', 'la lista sigue siendo la de la hoja'); assert.equal(stored(env).mode, 'live');
  const hist = keys(env, 'prices:history:'); assert.equal(hist.length, 1); assert.equal(JSON.parse(env.KV.m.get(hist[0])).items[REF].p, 100, 'el histórico guarda lo de antes');
  assert.equal(JSON.parse(env.KV.m.get('prices:meta')).reason, 'edit:jefa@torivac.com'); assert.equal(JSON.parse(env.KV.m.get('prices:meta')).source, 'edit');
  ({ j } = await putItem(env, duena, REF, { t: [[5, 50], [20, 45.5], [100, 40]] })); assert.deepEqual(j.item, { p: 55.5, t: [[5, 50], [20, 45.5], [100, 40]], m: true }, 'el propietario también edita');
  assert.equal(JSON.parse(env.KV.m.get('prices:meta')).reason, 'edit:duena@torivac.com');
  ({ j } = await putItem(env, jefa, REF, { t: [] })); assert.deepEqual(j.item, { p: 55.5, m: true }, '[] quita los tramos');
  ({ j } = await putItem(env, jefa, REF, { a: 99 })); assert.deepEqual(j.item, { p: 55.5, a: 99, m: true });
  ({ j } = await putItem(env, jefa, REF, { a: false })); assert.equal(j.item.a, false); assert.equal(stored(env).items[REF].a, false);
  ({ j } = await putItem(env, jefa, REF, { a: null })); assert.ok(!('a' in j.item) && !('a' in stored(env).items[REF]), 'null = seguir la regla');
  ({ j } = await putItem(env, jefa, REF, { manual: false })); assert.deepEqual(j.item, { p: 55.5 }, 'manual:false quita la marca'); assert.ok(!('m' in stored(env).items[REF]));
  ({ j } = await putItem(env, jefa, REF2, { a: 33 })); assert.deepEqual(j.item, { p: 20, a: 33 }, 'solo `a`: no se marca manual'); assert.ok(!manualRefs(stored(env)).has(REF2));
  ({ j } = await putItem(env, jefa, REF2, { a: 33, manual: true })); assert.deepEqual(j.item, { p: 20, a: 33, m: true }, 'manual:true marca sin tocar el precio');
  ({ j } = await putItem(env, jefa, REF2, { p: 21, manual: false })); assert.deepEqual(j.item, { p: 21, a: 33 }, 'manual explícito manda sobre la marca automática');
  ({ j } = await putItem(env, jefa, REF2, { p: 12.3456 })); assert.equal(j.item.p, 12.3456, 'hasta 4 decimales');
  ({ r, j } = await putItem(env, MASTER, REF2, { p: 10 })); assert.equal(r.status, 200); assert.equal(JSON.parse(env.KV.m.get('prices:meta')).reason, 'edit:maestro');
});
test('Producto · una edición que no cambia nada no escribe (ni histórico ni fecha nueva) y responde igual', async () => {
  const { env, jefa } = await setup({ items: { [REF]: { p: 100, m: true } } });
  const antes = env.KV.m.get('prices:current');
  let { r, j } = await putItem(env, jefa, REF, { a: null }); assert.equal(r.status, 200); assert.deepEqual(j, { ok: true, ref: REF, item: { p: 100, m: true } });
  ({ j } = await putItem(env, jefa, REF, { p: 100, t: [], manual: true })); assert.deepEqual(j.item, { p: 100, m: true });
  assert.equal(env.KV.m.get('prices:current'), antes, 'lo guardado es byte a byte lo de antes'); assert.equal(keys(env, 'prices:history:').length, 0); assert.equal(env.KV.m.has('prices:meta'), true);
  assert.equal(JSON.parse(env.KV.m.get('prices:meta')).reason, 'upload:ana@torivac.com', 'la meta tampoco cambió');
  ({ j } = await putItem(env, jefa, REF, { p: 101 })); assert.equal(j.item.p, 101); assert.equal(keys(env, 'prices:history:').length, 1, 'un cambio real sí');
});
test('Producto · p:null deja la referencia «A consultar» (y sin tramos); una referencia sin ningún dato queda sin entrada; una sin precio puede tener solo `a`', async () => {
  const { env, jefa } = await setup({ items: { [REF]: { p: 100, t: [[10, 90]] } } });
  let { j } = await putItem(env, jefa, REF, { p: null }); assert.deepEqual(j.item, { m: true }, 'quitar el precio también se queda a mano: la hoja no lo vuelve a poner'); assert.deepEqual(stored(env).items[REF], { m: true });
  ({ j } = await putItem(env, jefa, REF, { manual: false })); assert.deepEqual(j.item, {}); assert.ok(!(REF in stored(env).items), 'sin ningún dato → sin entrada');
  ({ j } = await putItem(env, jefa, REF3, { a: 80 })); assert.deepEqual(j.item, { a: 80 }); assert.deepEqual(stored(env).items[REF3], { a: 80 });
  ({ j } = await putItem(env, jefa, REF3, { a: null })); assert.deepEqual(j.item, {}); assert.ok(!(REF3 in stored(env).items));
  const { r, j: j2 } = await putItem(env, jefa, REF3, { t: [[2, 5]] }); assert.equal(r.status, 400, 'tramos sin precio base'); assert.equal(j2.field, 't');
});
test('Producto · referencia desconocida 404; la ref va codificada en la URL; vale una añadida por la hoja; constructor y __proto__ no son referencias', async () => {
  const { env, jefa } = await setup({ items: { 'AB/12': { p: 5, pid: 884, n: 'Añadida por la hoja' }, STALE: { p: 1 } } });
  for (const ref of ['NOEXISTE', 'constructor', '__proto__', 'toString', 'STALE', 'x'.repeat(300)]) {
    const { r, j } = await putItem(env, jefa, ref, { p: 1 }); assert.equal(r.status, 404, ref); assert.deepEqual(j, { ok: false, error: 'Referencia desconocida' });
  }
  assert.equal((await call(env, '/api/prices/items/%E0%A4%A', { method: 'PUT', body: { p: 1 }, token: jefa.token, ip: freshIp() })).status, 404, 'codificación rota');
  const { r, j } = await putItem(env, jefa, 'AB/12', { p: 6 }); assert.equal(r.status, 200); assert.deepEqual(j, { ok: true, ref: 'AB/12', item: { p: 6, m: true } });
  assert.deepEqual(stored(env).items['AB/12'], { p: 6, pid: 884, n: 'Añadida por la hoja', m: true }, 'n y pid se conservan: sigue siendo pedible');
  assert.deepEqual(Object.keys(stored(env).items).sort(), ['AB/12', 'STALE']);
  const sinPrecio = await putItem(env, jefa, 'AB/12', { p: null, manual: false }); assert.deepEqual(sinPrecio.j.item, {}); assert.deepEqual(stored(env).items['AB/12'], { pid: 884, n: 'Añadida por la hoja' }, 'la entrada que da de alta la referencia no se pierde');
});
test('Producto · cuerpos mal formados → 400 con su field (p, t, a, manual); sin permiso 403/401; cuerpo enorme 413', async () => {
  const { env, jefa, cli } = await setup();
  const casos = [
    [{ p: 0 }, 'p'], [{ p: -1 }, 'p'], [{ p: '5' }, 'p'], [{ p: 10_000_001 }, 'p'], [{ p: 1.23456 }, 'p'], [{ p: true }, 'p'], [{ p: [1] }, 'p'],
    [{ t: 5 }, 't'], [{ t: null }, 't'], [{ t: [[1, 5]] }, 't'], [{ t: [[2, 5], [2, 4]] }, 't'], [{ t: [[3, 5], [2, 4]] }, 't'], [{ t: [[2.5, 5]] }, 't'], [{ t: [[2, 0]] }, 't'], [{ t: [[2, 5, 1]] }, 't'], [{ t: [['2', 5]] }, 't'], [{ t: [[2]] }, 't'], [{ t: [5] }, 't'],
    [{ t: Array.from({ length: 9 }, (_, i) => [i + 2, 5]) }, 't'], [{ a: 0 }, 'a'], [{ a: -3 }, 'a'], [{ a: true }, 'a'], [{ a: '9' }, 'a'], [{ manual: 'si' }, 'manual'], [{ manual: null }, 'manual'], [{ manual: 1 }, 'manual'],
  ];
  for (const [body, field] of casos) { const { r, j } = await putItem(env, jefa, REF, body); assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(j.ok, false); assert.equal(j.field, field, JSON.stringify(body)); assert.ok(j.error); }
  for (const raro of ['"texto"', '[1]', 'null', '{}', 'no es json', '{"q":1}']) { const { r, j } = await putItem(env, jefa, REF, raro); assert.equal(r.status, 400, raro); assert.equal(j.ok, false); }
  assert.equal((await putItem(env, jefa, REF, JSON.stringify({ p: 5, relleno: 'x'.repeat(21_000) }))).r.status, 413, 'cuerpo > 20 KB');
  assert.equal(keys(env, 'prices:history:').length, 0, 'ninguna petición rechazada guardó nada'); assert.equal(stored(env).items[REF].p, 100);
  for (const ok of [{ p: 0.0001 }, { p: 10_000_000 }, { t: Array.from({ length: 8 }, (_, i) => [i + 2, 5]) }, { t: [[2, 5], [3, 4.5], [1000, 1]] }, { a: 0.5 }]) assert.equal((await putItem(env, jefa, REF, ok)).r.status, 200, JSON.stringify(ok));
  assert.equal((await putItem(env, cli, REF, { p: 1 })).r.status, 403, 'un cliente no edita precios'); assert.equal((await putItem(env, null, REF, { p: 1 })).r.status, 401); assert.equal((await putItem(env, 'falso'.repeat(10), REF, { p: 1 })).r.status, 401);
  assert.equal((await call(env, `/api/prices/items/${REF}`, { token: jefa.token, ip: freshIp() })).status, 404, 'solo existe PUT');
});

// ───────────────────────────────────────── 5 · sincronización con la hoja: lo manual no se toca
/** Sube una hoja CSV por la API (como el manager) con el catálogo de pruebas y devuelve { r, j }. */
async function upload(env, who, body) { const r = await call(env, '/api/prices/upload', { method: 'POST', body, token: who.token, ip: freshIp(), deps: { ctx: TCTX } }); return { r, j: await r.json() }; }
/** Lista de precios con una referencia manual (P16633) entre otras que la hoja sí puede cambiar. */
const SEED = { TT0020210: { p: 12.37, t: [[10, 11.9]] }, P16633: { p: 40, t: [[5, 38]], m: true, a: 70 }, R100: { p: 5.5 } };
test('Sincronización · modo merge: una referencia con m:true se conserva tal cual (aunque la hoja la cambie o la quite) y se cuenta en manual_skipped', async () => {
  const { env, jefa } = await setup({ items: SEED });
  const csv = 'ref;price;qty2;price2\nTT0020210;20;10;18\nP16633;99;;\nR100;0;;\n';                           // cambia TT0020210, pisaría P16633 y retira R100
  const dry = await upload(env, jefa, { csv, dry_run: true });
  assert.equal(dry.j.manual_skipped, 1, 'la vista previa también lo cuenta'); assert.deepEqual(dry.j.diff.changed, ['TT0020210'], 'P16633 no figura entre los cambios'); assert.deepEqual(dry.j.diff.removed, ['R100']);
  const { r, j } = await upload(env, jefa, { csv, mode: 'merge' });
  assert.equal(r.status, 200); assert.equal(j.meta.manual_skipped, 1); assert.equal(j.meta.mode, 'merge');
  assert.deepEqual(stored(env).items, { TT0020210: { p: 20, t: [[10, 18]], }, P16633: { p: 40, t: [[5, 38]], m: true, a: 70 } }, 'la manual igual que estaba (con m y a); lo demás, según la hoja');
  assert.equal(JSON.parse(env.KV.m.get('prices:meta')).manual_skipped, 1);
  const retira = await upload(env, jefa, { csv: 'ref;price\nP16633;0\n', mode: 'merge' }); assert.equal(retira.j.meta.manual_skipped, 1, 'una manual que la hoja pide quitar tampoco se quita'); assert.equal(stored(env).items.P16633.p, 40);
  const sinTocar = await upload(env, jefa, { csv: 'ref;price\nTT0020210;21\n', mode: 'merge' }); assert.equal(sinTocar.j.meta.manual_skipped, 0, 'si la hoja no la menciona, no se cuenta');
  const otro = await setup({ items: SEED }); const k = await upload(otro.env, otro.jefa, { csv: 'ref;price\nTT0020210;21\n', mode: 'merge' });
  assert.deepEqual([k.j.meta.kept, k.j.meta.manual_skipped], [1, 0], 'kept = precios de la hoja que no se tocan (R100); la manual no cuenta ahí');
  await putItem(env, jefa, 'P16633', { manual: false });
  const libre = await upload(env, jefa, { csv: 'ref;price\nP16633;99\n', mode: 'merge' }); assert.equal(libre.j.meta.manual_skipped, 0); assert.equal(stored(env).items.P16633.p, 99, 'quitada la marca, la hoja vuelve a mandar');
});
test('Sincronización · modo replace: la hoja sustituye a todo menos a lo manual, que se conserva tal cual aunque la hoja no lo traiga', async () => {
  const { env, jefa } = await setup({ items: SEED });
  const { r, j } = await upload(env, jefa, { csv: 'ref;price\nTT0020210;20\nR100;7\n', mode: 'replace' });
  assert.equal(r.status, 200); assert.equal(j.meta.mode, 'replace'); assert.equal(j.meta.manual_skipped, 1); assert.equal(j.meta.kept, 0, 'en replace no se conserva nada de lo que la hoja gestiona; lo manual va aparte, en manual_skipped');
  assert.deepEqual(stored(env).items, { TT0020210: { p: 20 }, R100: { p: 7 }, P16633: { p: 40, t: [[5, 38]], m: true, a: 70 } });
  const dos = await upload(env, jefa, { csv: 'ref;price\nP16633;1\nTT0020210;21\n', mode: 'replace' }); assert.equal(dos.j.meta.manual_skipped, 1); assert.equal(stored(env).items.P16633.p, 40); assert.ok(!('R100' in stored(env).items));
});
test('Sincronización · el cron y «Actualizar ahora» tampoco tocan lo manual', async () => {
  const { env, jefa } = await setup({ items: SEED });
  env.PRICE_CSV_URL = 'https://sheet.test/x.csv';
  /** Descarga simulada de la hoja: devuelve un CSV que cambia TT0020210 y R100 y pisaría la manual P16633. */
  const fetchImpl = async () => new Response('ref;price\nTT0020210;30\nP16633;1\nR100;9\n', { status: 200 });
  const r = await call(env, '/api/prices/refresh', { method: 'POST', token: jefa.token, ip: freshIp(), deps: { fetchImpl, ctx: TCTX } }), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.meta.manual_skipped, 1); assert.equal(stored(env).items.P16633.p, 40); assert.equal(stored(env).items.TT0020210.p, 30);
  const realFetch = globalThis.fetch; globalThis.fetch = fetchImpl;
  try { await api.scheduled({}, env, {}, { ctx: TCTX }); } finally { globalThis.fetch = realFetch; }
  assert.equal(stored(env).items.P16633.p, 40, 'tras el cron'); assert.equal(JSON.parse(env.KV.m.get('prices:meta')).manual_skipped, 1);
});
test('Sincronización · los chequeos de cambio masivo ignoran las referencias manuales', async () => {
  const manuales = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`M${i}`, { p: 10, m: true }])), normales = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`N${i}`, { p: 10 }]));
  /** Hoja CSV con las 12 referencias del prefijo y un precio base distinto en cada una (si fueran iguales saltaría el «precio de relleno»); con 0 las pide retirar. */
  const hoja = (pref, price) => ['ref;price', ...Array.from({ length: 12 }, (_, i) => `${pref}${i};${price ? price + i : 0}`)].join('\n');
  // una hoja que triplica (o retira) las 12 referencias manuales: no es un cambio masivo (no se tocan) y no pide force
  const e1 = await mkEnvWith(manuales);
  const ok = await syncPrices(e1, { rows: csvRows(hoja('M', 30)), source: 'upload:x', reason: 'upload:x', ctx: null });
  assert.equal(ok.manual_skipped, 12); assert.deepEqual(Object.values(JSON.parse(e1.KV.m.get('prices:current')).items).map((v) => v.p), Array(12).fill(10));
  const retira = await syncPrices(e1, { rows: csvRows(hoja('M', 0) + '\nQ0;5'), source: 'upload:x', reason: 'upload:x', ctx: null }); assert.equal(retira.manual_skipped, 12, 'retirar 12 manuales no es retirar precios');
  // la misma hoja sobre referencias NO manuales sí se rechaza
  const e2 = await mkEnvWith(normales);
  await assert.rejects(syncPrices(e2, { rows: csvRows(hoja('N', 30)), source: 'upload:x', reason: 'upload:x', ctx: null }), /cambia más de un 40 %/);
  assert.equal(massChange({ items: manuales }, Object.fromEntries(Object.keys(manuales).map((k) => [k, { p: 30 }])), []), null, 'massChange no cuenta las manuales');
  assert.equal(massChange({ items: { ...manuales, ...Object.fromEntries(Object.keys(normales).map((k) => [k, { p: 10 }])) } }, Object.fromEntries(Object.keys(normales).map((k) => [k, { p: 30 }])), []).count, 12, 'pero sí las normales de al lado');
  // la regla «quedarían menos de la mitad» tampoco cuenta lo manual: 10 normales + 10 manuales, la hoja deja 4 → 4 de 10 normales (< mitad) bloquea; con 6 no
  const mezcla = { ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`N${i}`, { p: 10 }])), ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`M${i}`, { p: 10, m: true }])) };
  const e3 = await mkEnvWith(mezcla);
  await assert.rejects(syncPrices(e3, { rows: csvRows(['ref;price', ...Array.from({ length: 4 }, (_, i) => `N${i};10`)].join('\n')), mode: 'replace', source: 'upload:x', reason: 'upload:x', ctx: null }), /había 10/, 'replace: 4 de 10 normales; las 10 manuales no hacen "volumen"');
  const bien = await syncPrices(e3, { rows: csvRows(['ref;price', ...Array.from({ length: 6 }, (_, i) => `N${i};10`)].join('\n')), mode: 'replace', source: 'upload:x', reason: 'upload:x', ctx: null }); assert.equal(bien.refs, 16);
});
/** Entorno solo con KV y esta lista de precios vigentes. */
async function mkEnvWith(items) { const env = mkEnv(); await env.KV.put('prices:current', JSON.stringify({ ...PRICES, items })); return env; }
/** Texto CSV (separador «;») → filas de celdas, como lo leería parseCsv. */
function csvRows(text) { return text.split('\n').map((l) => l.split(';')); }
test('Sincronización · mergePrices no modifica los objetos recibidos y deja intacta la referencia manual en los dos modos', () => {
  const prev = { items: { A: { p: 1, m: true }, B: { p: 2 } } }, sheet = { updated_at: 'x', items: { A: { p: 9 }, C: { p: 3 } } };
  const copia = JSON.stringify([prev, sheet]);
  assert.deepEqual(mergePrices(prev, sheet, ['B'], 'merge').items, { A: { p: 1, m: true }, C: { p: 3 } });
  assert.deepEqual(mergePrices(prev, sheet, [], 'replace').items, { C: { p: 3 }, A: { p: 1, m: true } });
  assert.deepEqual(mergePrices(prev, { items: {} }, ['A'], 'merge').items, { A: { p: 1, m: true }, B: { p: 2 } });
  assert.equal(JSON.stringify([prev, sheet]), copia);
});
test('Sincronización · la aplicación de la IA conserva m y a (y puede editar una referencia manual sin perder su marca)', async () => {
  const { env, jefa } = await setup({ items: { [REF2]: { p: 10, m: true, a: 15 }, [REF]: { p: 100, t: [[10, 90]] } } });
  const r = await call(env, '/api/prices/ai/apply', { method: 'POST', body: { changes: [{ ref: REF2, price: 20 }, { ref: REF, price: 110, tiers: [{ qty: 10, price: 99 }] }] }, token: jefa.token, ip: freshIp() }), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.applied, 2);
  assert.deepEqual(stored(env).items[REF2], { p: 20, m: true, a: 15 }, 'm y a se conservan'); assert.deepEqual(stored(env).items[REF], { p: 110, t: [[10, 99]] });
  await applyPriceChanges(env, { changes: [{ ref: REF2, next: { p: 21, t: [[3, 19]] } }] }, { who: 'x', now: new Date() }); assert.deepEqual(stored(env).items[REF2], { p: 21, t: [[3, 19]], m: true, a: 15 });
});
test('Precios · parseItemEdit: solo valida lo que viene y devuelve los tramos como pares nuevos', () => {
  const t = [[2, 5]], r = parseItemEdit({ t }); assert.deepEqual(r.change, { t: [[2, 5]] }); assert.notEqual(r.change.t, t);
  assert.deepEqual(parseItemEdit({ p: null, a: false, manual: true }).change, { p: null, a: false, manual: true });
});
