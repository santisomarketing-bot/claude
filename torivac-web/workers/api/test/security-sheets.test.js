// Pruebas de los arreglos de seguridad de la HOJA DE PRECIOS y las DESCARGAS: D5 (borrado masivo en modo «fusionar», cifras finitas, columna «nota»), D8 (topes del lector de .xlsx, redirecciones
// controladas y tope de tamaño de la descarga). Cada prueba reproduce el ataque del informe del revisor y comprueba que ya no funciona y que lo legítimo sigue funcionando.
import test from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/index.js';
import items from '../src/generated/items.js';
import { massChange, diffPrices, withSheetItems, KEY_META, KEY_SYNC } from '../src/prices.js';
import { syncPrices, savePrices, planPrices, fetchSafe, readBytes, readSheetRows } from '../src/sheets.js';
import { ApiError } from '../src/util.js';
import { readXlsx } from '../../../shared/xlsx.mjs';
import { mkEnv, MASTER, SHEET, TCTX } from './helpers.js';
import { call, keys } from './kit.js';
import { mkBook, mkZip, rowXml } from './zip.js';

const REFS = Object.keys(items).slice(0, 40);                                  // referencias REALES del catálogo generado
const TOO = /La hoja es demasiado grande o está dañada/;
/** Entorno con los precios vigentes de las n primeras referencias (precio 10 + posición). */
const seeded = async (n = 40, extra = {}) => { const env = mkEnv(extra); await env.KV.put('prices:current', JSON.stringify({ updated_at: 'x', source: 'sheet', currency: 'EUR', mode: 'live', items: Object.fromEntries(REFS.slice(0, n).map((r, i) => [r, { p: 10 + i }])) })); return env; };
/** Hoja CSV con las n primeras referencias: f(i) da su precio (0 = retirar) y act(i) su columna active. */
const csv = (n, f, act = () => 1) => 'ref;price;active\n' + REFS.slice(0, n).map((r, i) => `${r};${f(i)};${act(i)}`).join('\n') + '\n';
/** Número de referencias con precio guardadas ahora mismo. */
const nPrices = async (env) => Object.keys(JSON.parse(await env.KV.get('prices:current')).items).length;
/** POST /api/prices/upload como manager (token maestro) con el cuerpo dado → { r, j }. */
const upload = async (env, body) => { const r = await call(env, '/api/prices/upload', { method: 'POST', token: MASTER, body }); return { r, j: await r.json() }; };
/** Ejecuta fn con console.error silenciado → lo que se habría escrito en el registro. */
async function quiet(fn) { const orig = console.error, logs = []; console.error = (...a) => logs.push(a.map(String).join(' ')); try { await fn(); } finally { console.error = orig; } return logs; }

// ───────────────────────────────────────── D5 · borrado masivo en modo «fusionar»
test('D5 · una hoja con todos los precios a 0 (o active = 0) en modo fusionar se bloquea sin force: vista previa con needs_force, aplicar → 409 y los precios vigentes intactos (W3)', async () => {
  for (const [que, hoja] of [['precio 0', csv(40, () => 0)], ['active = 0', csv(40, (i) => 10 + i, () => 0)]]) {
    const env = await seeded(); const dry = await upload(env, { csv: hoja, dry_run: true });
    assert.equal(dry.j.needs_force, true, que); assert.ok(dry.j.blockers.some((b) => /La hoja retira 40 de 40 precios \(100 %\): confírmalo con force/.test(b)), JSON.stringify(dry.j.blockers)); assert.equal(dry.j.diff.removed.length, 40);
    const ap = await upload(env, { csv: hoja }); assert.equal(ap.r.status, 409, que); assert.match(ap.j.error, /Sincronización rechazada: .*retira 40 de 40/); assert.deepEqual(Object.keys(ap.j).sort(), ['error', 'ok']);
    assert.equal(await nPrices(env), 40, 'los precios vigentes no se tocaron'); assert.equal(keys(env, 'prices:history:').length, 0);
    const forzado = await upload(env, { csv: hoja, force: true }); assert.equal(forzado.r.status, 200); assert.equal(forzado.j.meta.removed, 40); assert.equal(await nPrices(env), 0, 'con force (intencionado) sí se aplica');
  }
  const env = await seeded(); const rp = await upload(env, { csv: csv(3, (i) => 5 + i), mode: 'replace' }); assert.equal(rp.r.status, 409, 'replace sigue protegido como antes'); assert.match(rp.j.error, /la hoja nueva tiene 3 referencias y había 40/);
});
test('D5 · umbrales: retira ≥ 10 y > 30 % de los precios vigentes → bloquea; en cualquier modo, si quedaría < 50 % (siendo ≥ 10) → bloquea; una hoja normal pasa', async () => {
  /** Plan de actualización (sin guardar) de una hoja CSV en el modo dado, con el catálogo real. */
  const plan = async (env, hoja, mode = 'merge') => { const rows = hoja.trim().split('\n').map((l) => l.split(';')); return planPrices(env, rows, 'upload', mode, { ctx: { lines: items } }); };
  let env = await seeded(40); const mayor = (k) => csv(40, (i) => (i < k ? 0 : 10 + i));                       // retira k y deja el resto igual
  assert.deepEqual((await plan(env, mayor(12))).blockers, [], '12 de 40 = 30 %: no supera el 30 %');
  const b13 = (await plan(env, mayor(13))).blockers; assert.ok(b13.length === 1 && /^La hoja retira 13 de 40 precios \(33 %\): confírmalo con force$/.test(b13[0]), JSON.stringify(b13));
  assert.deepEqual((await plan(env, mayor(9))).blockers, [], 'menos de 10 referencias: no salta');
  assert.deepEqual((await plan(env, csv(40, (i) => 10 + i))).blockers, [], 'una hoja normal sin cambios pasa');
  assert.deepEqual((await plan(env, csv(5, (i) => 10 + i + 0.5))).blockers, [], 'una hoja parcial que solo cambia unas pocas pasa');
  env = await seeded(12); const p12 = await plan(env, csv(12, (i) => (i < 9 ? 0 : 10 + i)));                    // 9 retiradas (< 10) pero quedarían 3 de 12
  assert.ok(p12.blockers.some((b) => /quedarían 3 de 12 precios vigentes \(menos de la mitad\)/.test(b)), JSON.stringify(p12.blockers));
  env = await seeded(9); assert.deepEqual((await plan(env, csv(9, () => 0))).blockers, [], 'con menos de 10 precios vigentes no se aplican estas reglas');
  env = await seeded(40); const rep = await plan(env, csv(15, (i) => 10 + i), 'replace'); assert.ok(rep.blockers.some((b) => /la hoja nueva tiene 15 referencias y había 40/.test(b)));
  assert.equal(rep.blockers.length, 1, 'sin avisos repetidos en replace');
});
test('D5 · massChange cuenta también las referencias que la hoja retira (precio 0 o active = 0)', () => {
  const prev = { items: Object.fromEntries(REFS.slice(0, 20).map((r, i) => [r, { p: 10 + i }])) };
  assert.equal(massChange(prev, {}, REFS.slice(0, 9)), null, 'menos de 10 consideradas');
  const m = massChange(prev, {}, REFS.slice(0, 12)); assert.equal(m.code, 'cambio_masivo'); assert.equal(m.count, 12); assert.match(m.message, /se retira/);
  assert.equal(massChange(prev, Object.fromEntries(REFS.slice(0, 12).map((r, i) => [r, { p: 10 + i }])), REFS.slice(0, 12)), null, 'si sale a la vez con precio, gana el precio: no se retira');
  assert.equal(massChange(prev, Object.fromEntries(REFS.slice(0, 20).map((r, i) => [r, { p: 10 + i }])), []), null);
  assert.equal(massChange(prev, {}, ['NOEXISTE1', 'NOEXISTE2', ...REFS.slice(20, 40)]), null, 'retirar lo que no tenía precio no es un cambio');
});
test('D5 · la lectura automática (cron y «Actualizar ahora») nunca aplica una hoja con bloqueos: conserva los precios y deja el motivo en prices:sync (ok / blocked / error); solo lo ve un manager', async () => {
  const env = await seeded(40, { PRICE_CSV_URL: 'https://sheet.test/x.csv' }); let hoja = csv(40, () => 0); const fetchImpl = async () => new Response(hoja, { status: 200 });
  /** Estado del último intento de sincronización guardado en prices:sync. */
  const sync = async () => JSON.parse(await env.KV.get(KEY_SYNC));
  const r = await call(env, '/api/prices/refresh', { method: 'POST', token: MASTER, deps: { fetchImpl } }); const j = await r.json();
  assert.equal(r.status, 409); assert.equal(j.ok, false); assert.match(j.error, /Sincronización rechazada/); assert.equal(await nPrices(env), 40, 'los precios vigentes siguen intactos');
  let st = await sync(); assert.deepEqual([st.ok, st.blocked], [false, true]); assert.match(st.error, /retira 40 de 40/); assert.match(st.reason, /^manual:/); assert.ok(st.at);
  const man = await (await call(env, '/api/prices', { token: MASTER })).json(); assert.deepEqual(man.sync, st, 'el manager ve el estado del último intento');
  const pub = await (await call(env, '/api/prices')).json(); const txt = JSON.stringify(pub);
  assert.ok(!('sync' in pub) && !txt.includes('retira') && !txt.includes('manual:'), 'el público no ve el estado interno');
  const logs = await quiet(async () => { await api.scheduled({}, env, {}, { fetchImpl }); }); assert.ok(logs.some((l) => /Sincronización de precios fallida/.test(l)));        // el cron: lo mismo
  st = await sync(); assert.deepEqual([st.ok, st.blocked, st.reason], [false, true, 'cron']); assert.equal(await nPrices(env), 40, 'el cron tampoco la aplica');
  hoja = csv(40, (i) => 10 + i + 1);                                                                          // una hoja sana (todas suben 1 €)
  const ok = await call(env, '/api/prices/refresh', { method: 'POST', token: MASTER, deps: { fetchImpl } }); assert.equal(ok.status, 200);
  st = await sync(); assert.deepEqual([st.ok, st.blocked, st.error, st.refs], [true, false, '', 40], 'un intento correcto lo anota y borra el aviso');
  /** fetch simulado que responde 404 a todo. */
  const caida = async () => new Response('no', { status: 404 }); await call(env, '/api/prices/refresh', { method: 'POST', token: MASTER, deps: { fetchImpl: caida } });
  st = await sync(); assert.deepEqual([st.ok, st.blocked, st.error], [false, false, 'CSV 404']); assert.equal(JSON.parse(await env.KV.get(KEY_META)).refs, 40, 'la meta del último éxito sigue ahí');
  const subida = await upload(env, { csv: csv(40, () => 0) }); assert.equal(subida.r.status, 409); st = await sync(); assert.deepEqual([st.blocked, st.reason], [true, 'upload:master'], 'también una subida manual rechazada deja su estado');
});
test('D5 · cifras finitas: nunca se guarda prices:current con valores no finitos (1e999 vaciaba la lista) (A6)', async () => {
  const env = await seeded(3); const antes = await env.KV.get('prices:current');
  const prev = JSON.parse(antes);
  for (const malo of [NaN, Infinity, -1, 1e8, '12']) await assert.rejects(savePrices(env, { ...prev, items: { ...prev.items, [REFS[0]]: { p: malo } } }, prev), /Precio no válido/, String(malo));
  await assert.rejects(savePrices(env, { ...prev, items: { ...prev.items, [REFS[0]]: { p: 5, t: [[10, NaN]] } } }, prev), /Precio no válido/);
  assert.equal(await env.KV.get('prices:current'), antes, 'los precios vigentes siguen intactos');
  const hoja = `ref;price\n${REFS[0]};1e999\n${REFS[1]};99999999999\n${REFS[2]};12,5\n`;
  const d = await upload(env, { csv: hoja, dry_run: true }); assert.equal(d.j.ok, true); assert.equal(d.j.refs, 1); assert.ok(d.j.report.ignored.length === 2 && d.j.report.ignored.every((x) => /precio ilegible/.test(x.reason)));
  const ap = await upload(env, { csv: hoja }); assert.equal(ap.r.status, 200);
  const guardado = JSON.parse(await env.KV.get('prices:current')); assert.equal(guardado.items[REFS[2]].p, 12.5); assert.equal(guardado.items[REFS[0]].p, 10, 'la fila ilegible no tocó su referencia');
  assert.ok(Object.values(guardado.items).every((v) => Number.isFinite(v.p)), 'ningún null ni infinito');
  const ia = await call(env, '/api/prices/ai/apply', { method: 'POST', token: MASTER, body: `{"changes":[{"ref":"${REFS[0]}","price":1e999},{"ref":"${REFS[1]}","price":-3}]}` });
  assert.equal(ia.status, 400, 'la IA no puede colar un importe infinito'); assert.equal(await nPrices(env), 3);
});
test('D5 · la columna «nota» pública solo sale de cabeceras explícitas (nota, nota web…): «Observaciones» o «Comentario» con anotaciones internas no se publican (A8)', async () => {
  const env = mkEnv(); const interno = 'Margen 45% - coste proveedor 6,90 - NO DIVULGAR';
  await upload(env, { csv: `ref;price;Observaciones;Comentario;Notas\n${REFS[0]};12,5;${interno};otro comentario interno;nota interna\n` });
  const pub = JSON.stringify(await (await call(env, '/api/prices')).json()); assert.ok(!pub.includes('Margen') && !pub.includes('coste proveedor') && !pub.includes('comentario interno') && !pub.includes('nota interna'), pub);
  const guardado = JSON.parse(await env.KV.get('prices:current')); assert.ok(!('note' in guardado.items[REFS[0]]));
  await upload(env, { csv: `ref;price;nota web\n${REFS[0]};12,5;Oferta de lanzamiento\n` });
  assert.equal((await (await call(env, '/api/prices')).json()).prices.items[REFS[0]].note, 'Oferta de lanzamiento', 'una columna explícitamente pública sí se publica');
});
test('prices · diffPrices y withSheetItems no confunden «constructor» o «__proto__» con referencias existentes', () => {
  const d = diffPrices({ items: {} }, { items: JSON.parse('{"constructor":{"p":1},"toString":{"p":2}}') }); assert.deepEqual(d.added.sort(), ['constructor', 'toString']); assert.deepEqual(d.changed, []);
  const cat = withSheetItems({}, { items: JSON.parse('{"constructor":{"p":1,"pid":5,"n":"x"}}') }); assert.deepEqual(cat.constructor, { n: 'x', pid: 5 }, 'una referencia añadida por la hoja con ese nombre sí entra en el catálogo, como propia');
  assert.equal(Object.hasOwn(withSheetItems({}, { items: {} }), 'constructor'), false);
});

// ───────────────────────────────────────── D8 · lector de .xlsx
test('D8 · xlsx: bomba de inflado (unos KB → decenas de MB): error claro y rápido, sin inflarlo entero (W11)', async () => {
  const bomba = mkBook(' '.repeat(40_000_000)); assert.ok(bomba.length < 100_000, 'el libro hostil pesa poco comprimido: ' + bomba.length);
  const t0 = performance.now(); await assert.rejects(readXlsx(bomba), TOO); assert.ok(performance.now() - t0 < 3000, 'rápido');
  await assert.rejects(readXlsx(mkBook('', { shared: '<sst>' + ' '.repeat(30_000_000) + '</sst>' })), TOO, 'también en sharedStrings');
  await assert.rejects(readXlsx(mkZip([{ name: 'xl/workbook.xml', data: '<workbook/>'.padEnd(21_000_000, ' '), stored: true }])), TOO, 'ni una entrada guardada sin comprimir de más de 20 MB');
  const quinta = mkZip([{ name: 'xl/workbook.xml', data: '<workbook xmlns:r="y"><sheets>' + '<sheet name="P" sheetId="1" r:id="rId1"/>'.repeat(5) + '</sheets></workbook>' }, { name: 'xl/_rels/workbook.xml.rels', data: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' }, { name: 'xl/worksheets/sheet1.xml', data: '<worksheet><sheetData>' + ' '.repeat(15_000_000) + '</sheetData></worksheet>' }]);
  await assert.rejects(readXlsx(quinta), TOO, 'una misma hoja citada 5 veces (5 × 15 MB) agota el presupuesto total del libro (64 MB)');
  assert.equal((await readXlsx(mkBook(' '.repeat(15_000_000) + rowXml(1, ['ref', 'price']) + rowXml(2, ['P16633', 10]))))[0].rows.length, 2, 'una hoja grande pero dentro de los topes (15 MB) sí se lee');
});
test('D8 · xlsx: columna ≤ 16 384 (XFD), filas ≤ 200 000 y celdas ≤ 4 000 000 (con las vacías de relleno)', async () => {
  /** Libro con una sola celda en la columna dada. */
  const hoja = (ref) => mkBook(`<row r="1"><c r="${ref}1" t="inlineStr"><is><t>x</t></is></c></row>`);
  const t0 = performance.now(); await assert.rejects(readXlsx(hoja('ZZZZZZZZZZ')), TOO); await assert.rejects(readXlsx(hoja('XFE')), TOO); await assert.rejects(readXlsx(hoja('AAAAA')), TOO); assert.ok(performance.now() - t0 < 1000);
  const xfd = (await readXlsx(hoja('XFD')))[0].rows[0]; assert.equal(xfd.length, 16384); assert.equal(xfd[16383], 'x');
  /** Libro con n filas de una celda cada una. */
  const filas = (n) => mkBook('<row><c r="A1"><v>1</v></c></row>'.repeat(n));
  assert.equal((await readXlsx(filas(200_000)))[0].rows.length, 200_000); await assert.rejects(readXlsx(filas(200_001)), TOO);
  await assert.rejects(readXlsx(mkBook('<row><c r="XFD1"><v>1</v></c></row>'.repeat(3000))), TOO, '3000 filas con una celda en XFD = 49 millones de celdas');
  assert.equal((await readXlsx(mkBook('<row><c r="XFD1"><v>1</v></c></row>'.repeat(200))))[0].rows.length, 200, 'hasta 200 filas anchas valen');
});
test('D8 · xlsx: etiquetas sin cerrar no cuestan tiempo cuadrático (30 000 <row> o <c> sin cerrar) y dan el error claro (W11)', async () => {
  for (const [que, xml] of [['filas', '<row r="1">'.repeat(30000)], ['celdas', '<row r="1">' + '<c r="A1">'.repeat(30000) + '</row>'], ['valores', '<row r="1"><c r="A1">' + '<v>'.repeat(60000) + '</c></row>'], ['texto', '<row r="1"><c r="A1" t="inlineStr"><is>' + '<t>'.repeat(60000) + '</is></c></row>']]) {
    const t0 = performance.now(); let err; try { await readXlsx(mkBook(xml)); } catch (e) { err = e; }
    assert.ok(performance.now() - t0 < 1000, `${que}: ${Math.round(performance.now() - t0)} ms`);
    if (que === 'filas' || que === 'celdas') assert.match(err.message, TOO, que); else assert.ok(!err || TOO.test(err.message), que);
  }
  const t1 = performance.now(); await readXlsx(mkBook('<row r="1">' + '<c r="A1"/>'.repeat(50000) + '</row>')); assert.ok(performance.now() - t1 < 1000, 'celdas autocerradas');
  const sst = '<sst>' + '<si><t>'.repeat(30000) + '</sst>'; const t2 = performance.now(); await assert.rejects(readXlsx(mkBook('', { shared: sst })), TOO); assert.ok(performance.now() - t2 < 1000);
});
test('D8 · xlsx: un libro normal se lee igual que antes (cadenas compartidas, texto enriquecido, en línea, números, booleanos, entidades) y una entidad fuera de rango no lo rompe', async () => {
  const libro = mkBook('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>a &amp; b &#233;</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>P16633</t></is></c><c r="B2"><v>12.5</v></c><c r="C2" t="b"><v>1</v></c><c r="E2" t="inlineStr"><is><t>&#x110000;</t></is></c></row><row r="3"/>',
    { shared: '<sst><si><t>ref</t></si><si><r><t>pre</t></r><r><t xml:space="preserve">cio</t></r><rPh><t>ふ</t></rPh></si></sst>' });
  assert.deepEqual(await readXlsx(libro), [{ name: 'Precios', hidden: false, rows: [['ref', 'precio', '', 'a & b é'], ['P16633', 12.5, true, '', '\ufffd']] }]);
});
test('D8 · sync con un libro hostil: ApiError claro, los precios vigentes se conservan y el motivo queda en prices:meta', async () => {
  const env = await seeded(5, { PRICE_XLSX_URL: 'https://drive.test/uc?export=download&id=X' }); const bomba = mkBook(' '.repeat(40_000_000));
  /** fetchImpl de la prueba: siempre devuelve el libro hostil. */
  const fetchImpl = async () => new Response(bomba, { status: 200 });
  await assert.rejects(syncPrices(env, { fetchImpl, ctx: TCTX }), (e) => e instanceof ApiError && e.status === 502 && TOO.test(e.message) && /compartido con enlace/.test(e.message));
  assert.equal(await nPrices(env), 5); assert.match(JSON.parse(await env.KV.get(KEY_SYNC)).error, TOO);
  const r = await call(env, '/api/prices/refresh', { method: 'POST', token: MASTER, deps: { fetchImpl } }); assert.equal(r.status, 502); assert.match((await r.json()).error, TOO);
});

// ───────────────────────────────────────── D8 · descargas
/** fetch simulado que sirve las respuestas de `chain` en orden y anota cada llamada [url, init]. */
const scripted = (chain) => { const calls = []; const f = async (u, o) => { calls.push([String(u), o]); const x = chain.shift(); return typeof x === 'function' ? x() : x; }; f.calls = calls; return f; };
/** Respuesta de redirección 302 a la dirección dada. */
const redir = (to) => new Response(null, { status: 302, headers: { Location: to } });
test('D8 · descargas: redirecciones manuales con un máximo de 5 saltos, solo https: (http: si la URL inicial ya era http:), sin reenviar Authorization a otro origen', async () => {
  const cinco = scripted([redir('/a'), redir('https://otro.test/b'), redir('https://otro.test/c'), redir('d'), redir('https://tercero.test/e'), new Response('fin', { status: 200 })]);
  const r = await fetchSafe(cinco, 'https://sheet.test/x', { headers: { Authorization: 'Bearer tok', Accept: '*/*' } });
  assert.equal(await r.text(), 'fin'); assert.equal(cinco.calls.length, 6); assert.ok(cinco.calls.every(([, o]) => o.redirect === 'manual'), 'siempre redirect: manual');
  assert.deepEqual(cinco.calls.map(([u]) => u), ['https://sheet.test/x', 'https://sheet.test/a', 'https://otro.test/b', 'https://otro.test/c', 'https://otro.test/d', 'https://tercero.test/e']);
  assert.equal(cinco.calls[1][1].headers.Authorization, 'Bearer tok', 'mismo origen: se mantiene'); assert.equal(cinco.calls[2][1].headers.Authorization, undefined, 'otro origen: se quita'); assert.equal(cinco.calls[2][1].headers.Accept, '*/*');
  await assert.rejects(fetchSafe(scripted(Array.from({ length: 7 }, () => redir('/x'))), 'https://sheet.test/x'), /Demasiadas redirecciones/);
  for (const destino of ['file:///etc/hostname', 'gopher://x.test/', 'ftp://x.test/f', 'http://x.test/', 'data:text/plain,hola', 'javascript:alert(1)']) await assert.rejects(fetchSafe(scripted([redir(destino), new Response('NO')]), 'https://sheet.test/x'), (e) => e instanceof ApiError && e.status === 502 && /protocolo no permitido/.test(e.message), destino);
  const http = scripted([redir('http://otro.test/b'), new Response('ok')]); assert.equal(await (await fetchSafe(http, 'http://sheet.test/x')).text(), 'ok', 'si empezó en http:, se permite http:');
  await assert.rejects(fetchSafe(scripted([redir('https://otro.test/b'), redir('file:///etc/passwd')]), 'http://sheet.test/x'), /protocolo no permitido/);
  for (const local of ['https://127.0.0.1/secreto', 'https://localhost/x', 'https://[::1]/x', 'https://169.254.169.254/latest', 'https://10.0.0.5/x', 'https://192.168.1.1/x', 'https://172.16.0.1/x', 'https://intranet.local/x']) await assert.rejects(fetchSafe(scripted([redir(local), new Response('NO')]), 'https://sheet.test/x'), /servidor local/, local);
  assert.equal(await (await fetchSafe(scripted([redir('http://127.0.0.1:9/b'), new Response('ok')]), 'http://127.0.0.1:8/x')).text(), 'ok', 'si la URL inicial ya es local (pruebas) se permite');
  assert.equal((await fetchSafe(scripted([new Response('x', { status: 404 })]), 'https://sheet.test/x')).status, 404, 'un 404 no es una redirección');
  assert.equal((await fetchSafe(scripted([new Response(null, { status: 302 })]), 'https://sheet.test/x')).status, 302, 'una 302 sin Location se devuelve tal cual');
});
test('D8 · una hoja cuya URL redirige a file:/// o a un host local no se lee (el contenido de /etc/hostname no llega a la hoja) (A11)', async () => {
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/x.csv' });
  await assert.rejects(readSheetRows(env, scripted([redir('file:///etc/hostname'), new Response('ref;price\nP16633;1\n')])), /protocolo no permitido/);
  const env2 = mkEnv({ PRICE_XLSX_URL: 'https://sheet.test/x.xlsx' }); await assert.rejects(readSheetRows(env2, scripted([redir('https://127.0.0.1:8080/x')])), /servidor local/);
  const ok = await readSheetRows(env, scripted([redir('/export.csv'), new Response('ref;price\nP16633;1\n')])); assert.deepEqual(ok.rows, [['ref', 'price'], ['P16633', '1']]);
});
test('D8 · tope de tamaño de la respuesta (25 MB): por Content-Length y contando lo que llega, también por trozos', async () => {
  await assert.rejects(readBytes(new Response('x', { headers: { 'Content-Length': '30000000' } })), (e) => e instanceof ApiError && TOO.test(e.message));
  let pulled = 0; const trozo = new Uint8Array(1 << 20);
  const infinita = new Response(new ReadableStream({ pull(c) { if (pulled >= 60) return c.close(); pulled++; c.enqueue(trozo); } }));
  await assert.rejects(readBytes(infinita), TOO); assert.ok(pulled <= 28, `se dejó de leer a tiempo (${pulled} MB)`);
  assert.equal((await readBytes(new Response(new Uint8Array(24_000_000)))).length, 24_000_000, '24 MB valen');
  assert.deepEqual(Array.from(await readBytes(new Response('hola'))), [104, 111, 108, 97]);
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/x.csv' }); await assert.rejects(readSheetRows(env, scripted([new Response('x', { headers: { 'Content-Length': '99000000' } })])), TOO);
});
test('D8 · los orígenes de precios siguen funcionando como antes (CSV, libro de Drive, Sheets API) con las descargas controladas', async () => {
  const env = mkEnv({ PRICE_CSV_URL: 'https://sheet.test/export.csv' });
  const m = await syncPrices(env, { fetchImpl: scripted([new Response(SHEET)]), ctx: TCTX, mode: 'replace' }); assert.equal(m.refs, 3); assert.equal(m.source, 'csv-url');
  const llamadas = scripted([new Response(SHEET)]); await syncPrices(env, { fetchImpl: llamadas, ctx: TCTX, force: true }); assert.equal(llamadas.calls[0][0], 'https://sheet.test/export.csv');
  const libro = mkBook(rowXml(1, ['ref', 'price']) + rowXml(2, ['P16633', 70.25])); const e2 = mkEnv({ PRICE_XLSX_URL: 'https://drive.test/uc?id=A' });
  const m2 = await syncPrices(e2, { fetchImpl: scripted([redir('https://cdn.drive.test/file'), new Response(libro)]), ctx: TCTX }); assert.equal(m2.refs, 1); assert.equal(JSON.parse(await e2.KV.get('prices:current')).items.P16633.p, 70.25);
});
