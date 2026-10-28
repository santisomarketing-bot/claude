#!/usr/bin/env node
// [QA-TARIFA] Extremo a extremo con una TARIFA en el formato real (Excel «Artículo · Descripción · Precio venta», precios con 8 decimales),
// datos SINTÉTICOS (no hay precios de Torivac en el repositorio):
//   panel real → subir .xlsx → vista previa (columnas, referencias nuevas, desconocidas) → aplicar → ficha del producto con las referencias nuevas
//   → presupuesto → pedido → el Worker acepta la referencia nueva y valora con la hoja → cambio de precios en el servidor llega a la web sin recompilar.
//   node scripts/qa-tarifa.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: worker } = await import(path.join(ROOT, 'workers/api/src/index.js'));
const { FakeKV } = await import(path.join(ROOT, 'workers/api/test/helpers.js'));
const { createUser } = await import(path.join(ROOT, 'workers/api/src/users.js'));
const { KEY_CURRENT } = await import(path.join(ROOT, 'workers/api/src/prices.js'));

// sitio compilado con API (valor provisional; la URL verdadera se inyecta al servir)
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-tarifa-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const sb = { window: {} }; sb.window = sb; vm.createContext(sb);
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data', f), 'utf8'), sb);
const { items } = sb.TV;
const prices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/prices.json'), 'utf8'));      // hoja de DEMO del catálogo (el sitio con API no la lleva)
const ttRefs = Object.keys(items).filter((r) => items[r].pid === 884);         // los 28 códigos TT del PDF verificado
const TT_PAGE = items[ttRefs[0]].p.es;

// ───────────────────────────────────── tarifa sintética en formato real (xlsx con openpyxl)
const known = ttRefs.slice(0, 6), fresh = [['TT0150117EM', 'TRAFO TOROID 152VA 230V/117V-1.3A.', 37.01215908], ['TT0330212', 'TRAFO. TOROIDAL 330VA 230V/2x12V ', 60.09588284], ['TT00302075', 'TRAFO TOROIDAL 30VA 230V/2x7.5V', 24.38303161]];
const xlsx = path.join(DIST, 'tarifa-sintetica.xlsx');
const rowsPy = [...known.map((r, i) => [r, `TRAFO TOROIDAL ${20 + i * 10}VA 230V/2X${10 + i}V`, 20.12345678 + i]), ...fresh, ['ZZ999', 'código que no es de ninguna familia', 5]];
execFileSync('python3', ['-I', '-c', `
import json, sys, openpyxl
rows = json.loads(sys.argv[2]); wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Hoja1'
ws.append(['Artículo', 'Descripción', 'Precio venta'])
for r in rows: ws.append(r)
wb.save(sys.argv[1])`, xlsx, JSON.stringify(rowsPy)]);

// ───────────────────────────────────── Worker + sitio
const { server: site, base: SITE } = await serve(DIST);
const env = { KV: new FakeKV(), ORDER_TO: 'info@grupotorivac.com,mzamora@torivac.com', RESEND_API_KEY: 're_test', SESSION_SECRET: 'x'.repeat(40), ADMIN_API_TOKEN: 'master-test', ALLOWED_ORIGINS: SITE };
await env.KV.put(KEY_CURRENT, JSON.stringify({ ...prices, mode: 'live', updated_at: '2026-10-28T08:00:00.000Z' }));
await createUser(env, { email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });
const mails = [];
const mockFetch = async (url, init) => { if (String(url).includes('api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response('{"id":"m"}', { status: 200 }); } throw new Error('red no permitida en el test: ' + url); };
const api = http.createServer(async (rq, rs) => {
  const chunks = []; for await (const c of rq) chunks.push(c);
  const res = await worker.fetch(new Request(`http://127.0.0.1:${api.address().port}${rq.url}`, { method: rq.method, headers: rq.headers, body: ['GET', 'HEAD'].includes(rq.method) ? undefined : Buffer.concat(chunks) }), env, {}, { fetchImpl: mockFetch });
  rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
});
await new Promise((r) => api.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${api.address().port}`;

const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } });
  await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('http://api.invalid', API) }); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  return { ctx, page, errs };
};

console.log('\n1) el manager sube la tarifa (Excel con cabeceras «Artículo · Descripción · Precio venta»)');
{ const { ctx, page, errs } = await newPage();
  await page.goto(SITE + '/admin/index.html'); await page.fill('[name=email]', 'jefa@torivac.com'); await page.fill('[name=pass]', 'Manager-Clave-2026'); await page.click('button[type=submit]');
  await page.click('.side nav a[href="#precios"]'); await page.waitForSelector('[data-file]', { state: 'attached' });
  await page.setInputFiles('[data-file]', xlsx);
  await page.waitForSelector('[data-draft] .panel', { timeout: 15000 });
  const prev = await page.locator('[data-draft]').innerText();
  ok(/Columnas reconocidas/.test(prev) && /referencia ← «Artículo»/.test(prev) && /precio ← «Precio venta»/.test(prev) && /descripción ← «Descripción»/.test(prev), 'reconoce las columnas de la tarifa sin tocarla');
  ok(/3 referencias nuevas/.test(prev), 'avisa de las 3 referencias nuevas que se publican dentro de su producto');
  ok(/1 referencias de la hoja no están en la web/.test(prev), 'avisa del código desconocido y no lo publica');
  ok(!/parece un valor de relleno/.test(prev), 'una tarifa normal no se confunde con precios de relleno');
  ok(/sin precio/.test(prev) && /330|\d{3} /.test(prev), 'la vista previa cuenta las referencias de la web que se quedarían sin precio («Consultar»)');
  await page.locator('[data-force]').check();                                  // la tarifa solo trae 9 de 336 referencias: hay que confirmar que es intencionado
  await page.click('[data-apply-upload]'); await page.waitForTimeout(700);
  const pub = await fetch(API + '/api/prices').then((r) => r.json());
  ok(Object.keys(pub.prices.items).length === 9, `9 referencias publicadas (6 conocidas + 3 nuevas): ${Object.keys(pub.prices.items).length}`);
  ok(pub.prices.items[known[0]].p === 20.1235, `8 decimales de la hoja → 4 en el servidor (20,12345678 → ${pub.prices.items[known[0]].p})`);
  ok(pub.prices.items.TT0150117EM.pid === 884 && /152VA/.test(pub.prices.items.TT0150117EM.n), 'la referencia nueva queda dentro de la Serie TT con la descripción de la tarifa');
  ok(pub.prices.items.ZZ999 === undefined, 'el código desconocido no se publica');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close(); }

console.log('\n2) la web pública lee los precios del servidor (sin recompilar) y muestra las referencias nuevas en la ficha');
{ const { ctx, page, errs } = await newPage();
  await page.goto(SITE + TT_PAGE); await page.waitForSelector('#mas-referencias', { timeout: 10000 });
  const rows = await page.locator('#mas-referencias tbody tr').count();
  ok(rows === 3, `la sección «Más referencias de la tarifa» lista las 3 nuevas (${rows})`);
  const priced = await page.locator(`tr[data-ref="${known[0]}"] [data-price-for]`).innerText();
  ok(/20,1235/.test(priced), `la fila del PDF muestra el precio del servidor, no el de demostración: «${priced.replace(/\s+/g, ' ')}»`);
  const demo = await page.locator('[data-demo-flag]').first().isVisible();
  if (demo) console.log('   debug:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[data-demo-flag]')].map((e) => [e.hidden, getComputedStyle(e).display, e.textContent, e.parentElement.className]))), await page.evaluate(() => TV.prices.mode));
  ok(!demo, 'con precios del servidor ya no aparece la marca DEMO');
  await page.locator('#mas-referencias [data-extra-filter]').fill('330VA'); await page.waitForTimeout(150);
  ok((await page.locator('#mas-referencias tbody tr:visible').count()) === 1, 'el filtro de la lista encuentra «330VA»');
  const row = page.locator('#mas-referencias tr[data-ref="TT0330212"]');
  await row.locator('[data-qty]').fill('10'); await row.locator('[data-qty]').dispatchEvent('input');
  await row.locator('[data-add-row]').click(); await page.waitForTimeout(250);
  ok((await page.evaluate(() => TV.Quote.count())) === 10, '10 unidades de una referencia nueva en el presupuesto');

  console.log('\n3) presupuesto y pedido con la referencia nueva');
  await page.goto(SITE + '/presupuesto/index.html'); await page.waitForSelector('[data-quote-body] tr, .quote-lines tr, table tbody tr', { timeout: 8000 });
  const txt = await page.locator('main').innerText();
  const unit = 60.0959, total = round2(unit * 10);                           // 60,09588284 → 4 decimales; línea = 10 × 60,0959 = 600,96
  ok(/TRAFO\. TOROIDAL 330VA/.test(txt), 'la línea lleva el nombre de la tarifa');
  ok(txt.includes('60,0959') && /600,96/.test(txt.replace(/\s/g, ' ')), `precio unitario 60,0959 y total de línea ${total} (redondeo a 2 solo en el importe)`);
  const f = page.locator('[data-quote-form]');
  await f.locator('[name=name]').fill('Marta Prueba'); await f.locator('[name=email]').fill('cliente.prueba@example.com'); await f.locator('[name=privacy]').check();
  await f.locator('button[type=submit]').click(); await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
  const sent = await page.locator('[data-sent]').innerText();
  const num = (sent.match(/TV-\d{8}-\d{4}/) || [])[0];
  ok(!!num, `el Worker acepta la referencia nueva y da número de pedido ${num}`);
  const rec = JSON.parse(await env.KV.get(`order:${num}`));
  ok(rec.total === total && rec.lines[0].ref === 'TT0330212', `el servidor valora igual que la web: ${rec.total} €`);
  ok(mails.length === 2 && /TRAFO\. TOROIDAL 330VA/.test(mails[0].text), 'el correo al equipo lleva la descripción de la tarifa');

  console.log('\n4) el precio cambia en el servidor y llega a la web con «actualizar», sin recompilar');
  const cur = JSON.parse(await env.KV.get(KEY_CURRENT)); cur.items[known[1]].p = 99.5; cur.updated_at = '2026-10-29T03:00:00.000Z'; await env.KV.put(KEY_CURRENT, JSON.stringify(cur));
  await page.goto(SITE + TT_PAGE); await page.waitForTimeout(700);
  const after = await page.locator(`tr[data-ref="${known[1]}"] [data-price-for]`).innerText();
  ok(/99,5/.test(after), `la ficha muestra el precio nuevo del servidor: «${after.replace(/\s+/g, ' ')}»`);
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close(); }

await browser.close(); site.close(); api.close();
if (fails) { console.error(`\n✗ ${fails} fallos`); process.exit(1); }
console.log('\n✓ tarifa real: lectura de columnas, referencias nuevas, precios en vivo y pedido correctos');
