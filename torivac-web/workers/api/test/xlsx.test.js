// Lector de .xlsx del servidor (shared/xlsx.mjs): mismos libros y mismo resultado esperado que el port en PHP (backend-php/api/tests/XlsxTest.php).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readXlsx, pickSheet } from '../../../shared/xlsx.mjs';
import { readSheet } from '../../../shared/price-sheet.mjs';

const dir = new URL('../../../shared/xlsx/', import.meta.url);
const esperado = JSON.parse(fs.readFileSync(new URL('esperado.json', dir), 'utf8'));
/** Bytes del libro .xlsx de pruebas f, leído de shared/xlsx/. */
const book = (f) => new Uint8Array(fs.readFileSync(new URL(f, dir)));

for (const [file, exp] of Object.entries(esperado)) {
  test(`xlsx · ${file}: hojas, orden, ocultas y filas = resultado esperado`, async () => {
    assert.deepEqual(await readXlsx(book(file)), exp);
  });
}

test('xlsx · pickSheet: la primera hoja visible con cabecera de precios, o la pedida por nombre', async () => {
  const a = await readXlsx(book('artesanal.xlsx'));
  assert.equal(pickSheet(a).name, 'Tarifa');                         // «Notas & avisos» no tiene cabecera; «Oculta» está oculta
  assert.equal(pickSheet(a, ' tarifa ').name, 'Tarifa');
  assert.throws(() => pickSheet(a, 'Precios'), /no tiene la hoja «Precios»/);
  const o = await readXlsx(book('tarifa-openpyxl.xlsx'));
  assert.equal(pickSheet(o).name, 'Tarifa');
  assert.throws(() => pickSheet([{ name: 'Notas', hidden: false, rows: [['hola']] }]), /Ninguna hoja visible/);
});

test('xlsx · una tarifa de Excel pasa por las mismas reglas que un CSV (8 decimales → 4, referencia nueva por regla, código desconocido fuera)', async () => {
  const rows = pickSheet(await readXlsx(book('tarifa-openpyxl.xlsx'))).rows;
  const ctx = { lines: { TT0150117EM: { n: 'x', pid: 884 } }, rules: [{ pattern: '^TT\\d{7,8}[A-Z]{0,3}$', pid: 884 }] };
  const r = readSheet(rows, ctx);
  assert.equal(r.items.TT0150117EM.p, 37.0122);
  assert.equal(r.items.TT0330212.pid, 884);                          // nueva, encaja en la familia TT
  assert.equal(r.items.TT0330212.n, 'TRAFO. TOROIDAL 330VA 230V/2x12V');
  assert.deepEqual(r.unknown, ['ZZ999']);
});

test('xlsx · ficheros que no son un libro dan un error claro', async () => {
  await assert.rejects(() => readXlsx(new TextEncoder().encode('ref;price\nA;1\n')), /no es un zip válido/);
  await assert.rejects(() => readXlsx(new Uint8Array(fs.readFileSync(new URL('esperado.json', dir)))), /no es un zip válido/);
});

// ───────────────────────────────────────── sincronización de precios desde un .xlsx de Drive (sheets.js)
import { syncPrices } from '../src/sheets.js';
import { mkEnv, TCTX } from './helpers.js';

/** Response simulada con los bytes del libro f y el estado indicado (200 por defecto). */
const bytesRes = (f, status = 200) => new Response(book(f), { status });
const TT_CTX = { lines: { TT0150117EM: { n: 'x', pid: 884 }, TT0330212: { n: 'x', pid: 884 } }, rules: [{ pattern: '^TT\\d{7,8}[A-Z]{0,3}$', pid: 884 }] };

test('sync · PRICE_XLSX_URL: lee el Excel (varias hojas), publica referencias nuevas de su familia y avisa de las desconocidas', async () => {
  const env = mkEnv({ PRICE_XLSX_URL: 'https://drive.test/uc?export=download&id=ABC' });
  let asked; const fetchImpl = async (u) => { asked = String(u); return bytesRes('tarifa-openpyxl.xlsx'); };
  const m = await syncPrices(env, { fetchImpl, reason: 'test', ctx: TT_CTX });
  assert.equal(asked, 'https://drive.test/uc?export=download&id=ABC');
  assert.equal(m.source, 'xlsx-url');
  assert.equal(m.refs, 3);                                              // TT0150117EM, TT0330212 y TT00302075 (ZZ999 no encaja en ninguna familia)
  const cur = JSON.parse(await env.KV.get('prices:current'));
  assert.equal(cur.items.TT0150117EM.p, 37.0122);
  assert.equal(cur.items.TT00302075.pid, 884);
});

test('sync · PRICE_SHEET_NAME elige la hoja del libro y un nombre inexistente da un error que lista las hojas', async () => {
  /** fetch simulado que siempre devuelve el libro artesanal.xlsx. */
  const fetchImpl = async () => bytesRes('artesanal.xlsx');
  const ok = mkEnv({ PRICE_XLSX_URL: 'https://x.test/a.xlsx', PRICE_SHEET_NAME: 'Tarifa' });
  assert.equal((await syncPrices(ok, { fetchImpl, ctx: { lines: { TT0020210: { n: 'x', pid: 884 } } } })).refs, 1);
  const bad = mkEnv({ PRICE_XLSX_URL: 'https://x.test/a.xlsx', PRICE_SHEET_NAME: 'Precios' });
  await assert.rejects(() => syncPrices(bad, { fetchImpl, ctx: TCTX }), /no tiene la hoja «Precios» \(hojas: Notas & avisos, Oculta, Tarifa\)/);
});

test('sync · si la URL no devuelve un libro (p. ej. la página de acceso de Drive) el error dice qué revisar', async () => {
  const env = mkEnv({ PRICE_XLSX_URL: 'https://x.test/a.xlsx' });
  await assert.rejects(() => syncPrices(env, { fetchImpl: async () => new Response('<html>Inicia sesión</html>', { status: 200 }), ctx: TCTX }), /no es un zip válido.*compartido con enlace/);
  await assert.rejects(() => syncPrices(env, { fetchImpl: async () => new Response('no', { status: 404 }), ctx: TCTX }), /XLSX 404/);
});

test('sync · cuenta de servicio: hoja de Google → Sheets API; .xlsx subido a Drive → la API de Sheets falla y se descarga con la de Drive', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const sa = JSON.stringify({ client_email: 'svc@proj.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n` });
  const calls = []; let scope;
  /** Crea el fetch simulado de Google: OAuth siempre válido; Sheets da valores si sheetsOk o falla con 400; Drive sirve el libro. */
  const mk = (sheetsOk) => async (u, o) => {
    u = String(u); calls.push(u);
    if (u.includes('oauth2')) { scope = JSON.parse(Buffer.from(o.body.get('assertion').split('.')[1], 'base64url')).scope; return new Response('{"access_token":"tok"}', { status: 200 }); }
    if (u.includes('sheets.googleapis.com')) return sheetsOk ? new Response(JSON.stringify({ values: [['ref', 'price'], ['R100', 5.5], ['P16633', 67.65], ['TT0020210', 12.37]] }), { status: 200 }) : new Response('{"error":{"status":"FAILED_PRECONDITION"}}', { status: 400 });
    if (u.includes('drive/v3/files/FILE1?alt=media')) return bytesRes('tarifa-openpyxl.xlsx');
    throw new Error('url inesperada ' + u);
  };
  const env = mkEnv({ GOOGLE_SERVICE_ACCOUNT: sa, PRICE_SHEET_ID: 'FILE1' });
  const m1 = await syncPrices(env, { fetchImpl: mk(true), ctx: TCTX });
  assert.equal(m1.source, 'sheet:FILE1');
  assert.ok(/spreadsheets\.readonly/.test(scope) && /drive\.readonly/.test(scope), 'el token pide leer hojas y archivos de Drive');
  calls.length = 0;
  const m2 = await syncPrices(env, { fetchImpl: mk(false), ctx: TT_CTX, force: true });
  assert.equal(m2.source, 'drive-xlsx:FILE1');
  assert.equal(m2.refs, 3);
  assert.ok(calls.some((u) => u.includes('sheets.googleapis.com')) && calls.some((u) => u.includes('drive/v3/files/FILE1')), 'probó Sheets y luego Drive');
  // ni Sheets ni Drive: error con los dos códigos y la pista de compartir el archivo
  const dead = async (u) => (String(u).includes('oauth2') ? new Response('{"access_token":"tok"}', { status: 200 }) : new Response('x', { status: 404 }));
  await assert.rejects(() => syncPrices(env, { fetchImpl: dead, ctx: TCTX }), /Sheets API 404 · Drive API 404.*compartido con el correo de la cuenta de servicio/);
});
