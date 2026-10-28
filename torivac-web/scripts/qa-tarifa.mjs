#!/usr/bin/env node
// [QA-TARIFA] Extremo a extremo con una TARIFA en el formato real (Excel «Artículo · Descripción · Precio venta», precios con 8 decimales),
// datos SINTÉTICOS (no hay precios de Torivac en el repositorio):
//   panel real → subir .xlsx → vista previa (columnas, referencias nuevas, desconocidas) → aplicar → ficha del producto con las referencias nuevas
//   → presupuesto → pedido → el Worker acepta la referencia nueva y valora con la hoja → cambio de precios en el servidor llega a la web sin recompilar.
//   node scripts/qa-tarifa.mjs            contra el Worker torivac-api (en memoria)
//   node scripts/qa-tarifa.mjs --php      contra el API PHP de cPanel (php -S) · ver scripts/lib/backends.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBackend, MASTER_TOKEN } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// sitio compilado con API (valor provisional; la URL verdadera se inyecta al servir)
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-tarifa-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const sb = { window: {}, document: { getElementById: () => null } }; sb.window = sb; vm.createContext(sb);   // catalog.js lee el bloque JSON de arranque con document.getElementById (aquí no hay página: sin bloque)
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

// ───────────────────────────────────── backend + sitio
const be = await startBackend({ dist: DIST });
const { SITE, API, mails } = be;
console.log(`backend: ${be.kind}`);
await be.seedPrices({ ...prices, mode: 'live', updated_at: '2026-10-28T08:00:00.000Z' });
await be.addUser({ email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });

const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web). */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Abre un contexto (1440×1000, español fijado a mano) con el catálogo apuntando al API de pruebas; devuelve { ctx, page, errs }. */
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
  ok(/Filas reconocidas: 9 por referencia/.test(prev) || /Filas reconocidas: 6 por referencia · 3 como referencia nueva/.test(prev), 'dice cómo se reconoció cada fila de la tarifa');
  ok(/\b330 no vienen en la hoja y se conservan/.test(prev.replace(/\s+/g, ' ')) && (await page.locator('[data-force]').count()) === 0, 'por defecto (solo lo que trae): la tarifa trae 9 de 336 referencias, las otras 330 se conservan y no hace falta confirmar nada');
  await page.locator('input[name=upmode][value=replace]').check();                // el mismo archivo, pero reemplazando toda la lista
  await page.waitForFunction(() => /porque no están en la hoja/.test(document.querySelector('[data-draft]').innerText), null, { timeout: 15000 });
  ok(/\b330 se quedan sin precio porque no están en la hoja/.test((await page.locator('[data-draft]').innerText()).replace(/\s+/g, ' ')), 'en modo «reemplazar» la vista previa cuenta las 330 que se quedarían sin precio («Consultar»)');
  ok(await page.locator('[data-apply-upload]').isDisabled(), 'y Aplicar no se activa hasta confirmar que es intencionado');
  await page.locator('input[name=upmode][value=merge]').check();                  // vuelve a «solo lo que trae» y se aplica
  await page.waitForFunction(() => /se conservan/.test(document.querySelector('[data-draft]').innerText), null, { timeout: 15000 });
  await page.click('[data-apply-upload]'); await page.waitForTimeout(700);
  const pub = await fetch(API + '/api/prices').then((r) => r.json());
  const total0 = Object.keys(prices.items).length;
  ok(Object.keys(pub.prices.items).length === total0 + 3, `${total0 + 3} referencias publicadas (las ${total0} de antes + 3 nuevas): ${Object.keys(pub.prices.items).length}`);
  const other = Object.keys(prices.items).find((r) => !known.includes(r));
  ok(pub.prices.items[other] && pub.prices.items[other].p === prices.items[other].p, `una referencia que la tarifa no traía (${other}) conserva su precio`);
  ok(pub.prices.items[known[0]].p === 20.1235, `8 decimales de la hoja → 4 en el servidor (20,12345678 → ${pub.prices.items[known[0]].p})`);
  ok(pub.prices.items.TT0150117EM.pid === 884 && /152VA/.test(pub.prices.items.TT0150117EM.n), 'la referencia nueva queda dentro de la Serie TT con la descripción de la tarifa');
  ok(pub.prices.items.ZZ999 === undefined, 'el código desconocido no se publica');
  // otra hoja parcial: solo identifica por ID de producto (sin columna de referencia)
  const gen = Object.keys(items).find((r) => /^P\d+$/.test(r)), gid = gen.slice(1), idCsv = path.join(DIST, 'por-id.csv');
  fs.writeFileSync(idCsv, `ID;Precio\n${gid};12,34\n`);
  await page.setInputFiles('[data-file]', idCsv); await page.waitForFunction(() => /por ID de producto/.test(document.querySelector('[data-draft]').innerText), null, { timeout: 15000 });
  await page.click('[data-apply-upload]'); await page.waitForTimeout(700);
  const pub2 = await fetch(API + '/api/prices').then((r) => r.json());
  ok(pub2.prices.items[gen] && pub2.prices.items[gen].p === 12.34 && Object.keys(pub2.prices.items).length === total0 + 3, `una hoja solo con el ID de producto (${gid}) actualiza su línea ${gen} y no toca el resto`);
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
  const num = (sent.match(/TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?/) || [])[0];
  ok(!!num, `el Worker acepta la referencia nueva y da número de pedido ${num}`);
  const rec = await be.order(num);
  ok(rec.total === total && rec.lines[0].ref === 'TT0330212', `el servidor valora igual que la web: ${rec.total} €`);
  ok(mails.length === 2 && /TRAFO\. TOROIDAL 330VA/.test(mails[0].text), 'el correo al equipo lleva la descripción de la tarifa');

  console.log('\n4) el precio cambia en el servidor y llega a la web con «actualizar», sin recompilar');
  const cur = await be.getPrices(); cur.items[known[1]].p = 99.5; cur.updated_at = '2026-10-29T03:00:00.000Z'; await be.seedPrices(cur);
  await page.goto(SITE + TT_PAGE); await page.waitForTimeout(700);
  const after = await page.locator(`tr[data-ref="${known[1]}"] [data-price-for]`).innerText();
  ok(/99,5/.test(after), `la ficha muestra el precio nuevo del servidor: «${after.replace(/\s+/g, ' ')}»`);
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close(); }

console.log('\n5) sincronización automática: el mismo Excel, tal cual en Drive (descarga directa del .xlsx), sin pasar por el panel');
{ await be.seedPrices({ updated_at: null, source: 'none', currency: 'EUR', mode: 'none', items: {} });          // servidor sin precios (primera carga: no hay hoja anterior con la que comparar)
  await be.useSource('xlsx', fs.readFileSync(xlsx));
  const r = await fetch(API + '/api/prices/refresh', { method: 'POST', headers: { Authorization: 'Bearer ' + MASTER_TOKEN } }).then((x) => x.json());
  ok(r.ok === true && r.meta.source === 'xlsx-url', `«Actualizar ahora» lee el libro: origen ${r.meta && r.meta.source}${r.ok ? '' : ' · ' + r.error}`);
  const pub = await fetch(API + '/api/prices').then((x) => x.json());
  ok(Object.keys(pub.prices.items).length === 9, `9 referencias, igual que al subirlo por el panel: ${Object.keys(pub.prices.items).length}`);
  ok(pub.prices.items[known[0]].p === 20.1235 && pub.prices.items.TT0330212.pid === 884 && pub.prices.items.ZZ999 === undefined, 'mismos 4 decimales, referencia nueva dentro de la Serie TT y código desconocido fuera'); }

await browser.close(); await be.stop();
if (fails) { console.error(`\n✗ ${fails} fallos`); process.exit(1); }
console.log(`\n✓ tarifa real + ${be.kind}: lectura de columnas, referencias nuevas, precios en vivo y pedido correctos`);
