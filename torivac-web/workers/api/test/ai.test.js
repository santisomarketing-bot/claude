// Pruebas de [AI]: cambios de precios por instrucción en castellano (API de Anthropic simulada; no sale nada a la red).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChanges, buildTable, applyChanges, suggestPriceChanges, applyPriceChanges, TOOL } from '../src/ai.js';
import api from '../src/index.js';
import { mkEnv, req } from './helpers.js';

// referencias REALES del catálogo generado (site/build.mjs → src/generated/items.js)
const PRICES = { updated_at: '2026-10-28T00:00:00Z', source: 'test', currency: 'EUR', mode: 'live', items: { P8339: { p: 15.82, t: [[10, 15.1], [50, 14.4]] }, P8340: { p: 62.93 }, P884: { p: 49.95 } } };
const M = { Authorization: 'Bearer master-token-123' };
const aiReply = (input) => new Response(JSON.stringify({ content: [{ type: 'tool_use', name: TOOL, input }], usage: { input_tokens: 900, output_tokens: 120 } }), { status: 200 });
const env0 = (extra = {}) => { const env = mkEnv({ ANTHROPIC_API_KEY: 'sk-test', ...extra }); return env.KV.put('prices:current', JSON.stringify(PRICES)).then(() => env); };

test('IA · validación: referencias inexistentes, repetidas, precios absurdos y cambios nulos', () => {
  const v = validateChanges([
    { ref: 'P8339', price: 16.3, tiers: [{ qty: 10, price: 15.55 }, { qty: 50, price: 14.83 }] },
    { ref: 'NOEXISTE', price: 1 }, { ref: 'P8340', price: -4 }, { ref: 'P8340', price: 70 },                // la primera aparición es inválida: la repetición también se descarta (ambiguo → no se aplica)
    { ref: 'P884', price: 49.95 },                                  // igual que ahora → no es un cambio
    { ref: 'P8340', price: 71 },                                    // repetida
  ], PRICES);
  assert.deepEqual(v.changes.map((c) => c.ref), ['P8339']);
  assert.deepEqual(v.rejected.map((r) => `${r.ref}:${r.why}`).sort(), ['NOEXISTE:la referencia no existe', 'P8340:precio no válido', 'P8340:repetida', 'P8340:repetida'].sort());
  assert.equal(v.changes[0].pct, 3.03);
  assert.deepEqual(v.changes[0].next.t, [[10, 15.55], [50, 14.83]]);
});
test('IA · cambios muy grandes se marcan y el precio base sin tramos avisa', () => {
  const v = validateChanges([{ ref: 'P8340', price: 400 }, { ref: 'P8339', price: 20 }], PRICES);
  assert.equal(v.changes.find((c) => c.ref === 'P8340').large, true);
  assert.ok(v.warnings.some((w) => /P8339.*tramos/.test(w)));
  assert.ok(v.warnings.some((w) => /P8340.*muy grande/.test(w)));
});
test('IA · tabla del prompt: ref | nombre | precio | tramos', () => {
  const t = buildTable(PRICES);
  assert.match(t, /^P8339 \| Resistencias de frenado \| 15\.82 \| desde 10 uds = 15\.1; desde 50 uds = 14\.4/m);
});
test('IA · applyChanges no muta los precios originales y respeta tramos', () => {
  const v = validateChanges([{ ref: 'P8339', price: 16, tiers: [{ qty: 10, price: 15 }] }, { ref: 'P8340', price: 60 }], PRICES);
  const next = applyChanges(PRICES, v.changes, { now: new Date('2026-10-28T10:00:00Z') });
  assert.equal(PRICES.items.P8339.p, 15.82);                         // intactos
  assert.deepEqual(next.items.P8339, { p: 16, t: [[10, 15]] });
  assert.deepEqual(next.items.P8340, { p: 60 });
  assert.equal(next.updated_at, '2026-10-28T10:00:00.000Z');
});
test('IA · sin clave de API → 503; instrucción corta → 400; sin precios → 409', async () => {
  const sin = mkEnv(); await sin.KV.put('prices:current', JSON.stringify(PRICES));
  await assert.rejects(suggestPriceChanges(sin, 'sube un 3 % las resistencias'), (e) => e.status === 503);
  const env = await env0();
  await assert.rejects(suggestPriceChanges(env, 'ok'), (e) => e.status === 400);
  const vacio = mkEnv({ ANTHROPIC_API_KEY: 'k' });
  await assert.rejects(suggestPriceChanges(vacio, 'sube un 3 % las resistencias'), (e) => e.status === 409);
});
test('IA · propone con la herramienta, envía la lista de precios y descarta lo inventado', async () => {
  const env = await env0(); let sent;
  const fetchImpl = async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return aiReply({ summary: 'Sube un 3 % las resistencias', changes: [{ ref: 'P8339', price: 16.2946, tiers: [{ qty: 10, price: 15.553 }, { qty: 50, price: 14.832 }] }, { ref: 'P-FANTASMA', price: 9 }], warnings: ['Redondeo a 4 decimales'] }); };
  const r = await suggestPriceChanges(env, 'sube un 3 % las resistencias', { fetchImpl });
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.init.headers['x-api-key'], 'sk-test');
  assert.deepEqual(sent.body.tool_choice, { type: 'tool', name: TOOL });
  assert.match(sent.body.messages[0].content, /P8339 \| Resistencias de frenado \| 15\.82/);
  assert.equal(r.changes.length, 1); assert.equal(r.changes[0].next.p, 16.2946);
  assert.deepEqual(r.rejected.map((x) => x.ref), ['P-FANTASMA']);
  assert.ok(r.warnings.includes('Redondeo a 4 decimales'));
  assert.equal(r.usage.output_tokens, 120);
  // la propuesta NO se aplicó
  assert.equal(JSON.parse(await env.KV.get('prices:current')).items.P8339.p, 15.82);
});
test('IA · fallo del proveedor y respuesta sin herramienta → 502', async () => {
  const env = await env0();
  await assert.rejects(suggestPriceChanges(env, 'sube un 3 % las resistencias', { fetchImpl: async () => new Response('x', { status: 529 }) }), (e) => e.status === 502);
  await assert.rejects(suggestPriceChanges(env, 'sube un 3 % las resistencias', { fetchImpl: async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'no sé' }] }), { status: 200 }) }), (e) => e.status === 502);
});
test('IA · aplicar: valida otra vez en servidor, exige confirmación de cambios grandes y guarda histórico', async () => {
  const env = await env0();
  const prev = await suggestPriceChanges(env, 'sube un 3 % las resistencias', { fetchImpl: async () => aiReply({ summary: 's', changes: [{ ref: 'P8339', price: 16.2946 }, { ref: 'P8340', price: 400 }] }) });
  await assert.rejects(applyPriceChanges(env, { changes: prev.changes }, { who: 'm@x.es' }), (e) => e.status === 409);          // hay uno muy grande
  const r = await applyPriceChanges(env, { changes: prev.changes, confirm_large: true }, { who: 'm@x.es', now: new Date('2026-10-28T11:00:00Z') });
  assert.equal(r.applied, 2);
  const cur = JSON.parse(await env.KV.get('prices:current'));
  assert.equal(cur.items.P8339.p, 16.2946); assert.equal(cur.items.P8340.p, 400); assert.equal(cur.source, 'ia:m@x.es');
  assert.ok((await env.KV.list({ prefix: 'prices:history:' })).keys.length === 1);                                              // histórico para poder volver atrás
  // un navegador manipulado no puede colar referencias falsas ni precios negativos
  await assert.rejects(applyPriceChanges(env, { changes: [{ ref: 'FALSA', price: 1 }, { ref: 'P884', price: -1 }] }, {}), (e) => e.status === 400);
});
test('API · /api/prices/ai y /apply: solo manager, límite de uso y flujo completo', async () => {
  const env = await env0();
  const real = globalThis.fetch; globalThis.fetch = async () => aiReply({ summary: 'Resistencias +3 %', changes: [{ ref: 'P8339', price: 16.3, tiers: [{ qty: 10, price: 15.55 }] }] });
  try {
    const call = (p, body, headers = M) => api.fetch(req(p, { method: 'POST', body, headers }), env, {});
    assert.equal((await call('/api/prices/ai', { instruction: 'sube un 3 % las resistencias' }, {})).status, 401);                  // sin sesión
    const r = await (await call('/api/prices/ai', { instruction: 'sube un 3 % las resistencias' })).json();
    assert.equal(r.ok, true); assert.equal(r.changes[0].ref, 'P8339'); assert.equal(r.large, false);
    const ok = await (await call('/api/prices/ai/apply', { changes: r.changes })).json();
    assert.equal(ok.ok, true); assert.equal(ok.applied, 1);
    const pub = await (await api.fetch(req('/api/prices'), env, {})).json();
    assert.equal(pub.prices.items.P8339.p, 16.3);
    for (let i = 0; i < 14; i++) await call('/api/prices/ai', { instruction: 'sube un 3 % las resistencias' });
    assert.equal((await call('/api/prices/ai', { instruction: 'sube un 3 % las resistencias' })).status, 429);                      // 15 consultas / 10 min
  } finally { globalThis.fetch = real; }
});

test('API · decisiones sobre propuestas: se guardan por manager, se validan y se pueden deshacer', async () => {
  const env = await env0();
  const call = (m, body, headers = M) => api.fetch(req('/api/proposals/state', { method: m, body, headers }), env, {});
  assert.equal((await call('GET', undefined, {})).status, 401);
  assert.deepEqual((await (await call('GET')).json()).state, {});
  assert.equal((await call('POST', { id: 'PR-007', state: 'ok' })).status, 200);
  assert.equal((await call('POST', { id: 'malo', state: 'ok' })).status, 400);
  assert.equal((await call('POST', { id: 'PR-008', state: 'quizá' })).status, 400);
  const st = (await (await call('GET')).json()).state; assert.equal(st['PR-007'].state, 'ok'); assert.ok(st['PR-007'].by);
  await call('POST', { id: 'PR-007', state: '' });
  assert.deepEqual((await (await call('GET')).json()).state, {});
});
