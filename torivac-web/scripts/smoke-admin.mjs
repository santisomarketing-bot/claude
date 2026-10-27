#!/usr/bin/env node
// [SMOKE-ADMIN] Prueba del panel (file://): login por rol, subida de Excel de precios, instrucción de precios, aplicar y verlo en la web.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'data/raw/screens/demo'); fs.mkdirSync(SHOTS, { recursive: true });
const out = []; const ok = (name, cond, extra = '') => { out.push({ name, ok: !!cond, extra }); };
const problems = [];
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const p = await c.newPage();
p.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
await p.goto(`file://${D}/admin/index.html`); await p.waitForTimeout(300);
// login incorrecto
await p.fill('[name=email]', 'x@y.z'); await p.fill('[name=pass]', 'mal'); await p.click('button[type=submit]');
ok('login incorrecto muestra error', await p.isVisible('[data-err]'));
// manager
await p.fill('[name=email]', 'manager@torivac.demo'); await p.fill('[name=pass]', 'Torivac-Manager-2026'); await p.click('button[type=submit]'); await p.waitForTimeout(300);
ok('manager ve menú de 7 secciones', (await p.$$eval('.side nav a', (a) => a.length)) === 7);
await p.screenshot({ path: path.join(SHOTS, 'admin-resumen.png') });
await p.click('.side nav a[href="#precios"]'); await p.waitForTimeout(300);
// subir la hoja DEMO modificada (un precio cambiado + una referencia nueva)
const tmp = path.join(ROOT, 'data/raw/screens/demo/test-prices.csv');
const csv = fs.readFileSync(path.join(ROOT, 'data/catalog/prices.demo.csv'), 'utf8').replace(/^﻿/, '').split('\n');
const cols = csv[0].split(';'); const iP = cols.indexOf('price');
const row = csv[1].split(';'); const oldP = row[iP]; row[iP] = '99.99'; csv[1] = row.join(';');
fs.writeFileSync(tmp, csv.join('\n'));
await p.setInputFiles('[data-file]', tmp); await p.waitForTimeout(500);
ok('vista previa de diferencias (1 cambio)', /1\s*<\/strong>\s*cambian|<strong>1<\/strong> cambian/.test(await p.innerHTML('[data-draft]')) || (await p.innerText('[data-draft]')).includes('1 cambian'));
await p.screenshot({ path: path.join(SHOTS, 'admin-precios-preview.png'), fullPage: true });
await p.click('[data-apply]'); await p.waitForTimeout(400);
const ref = row[0];
// verificar en la web: el precio de esa referencia cambió
await p.goto(`file://${D}/presupuesto/index.html`); await p.waitForTimeout(300);
const unit = await p.evaluate((r) => window.TV.Quote.priceOf(r, 1), ref);
ok('la web usa el precio cargado desde el panel', unit === 99.99, `ref ${ref} antes ${oldP} ahora ${unit}`);
// instrucción en castellano
await p.goto(`file://${D}/admin/index.html#precios`); await p.waitForTimeout(300);
const before = await p.evaluate(() => { const i = Object.keys(window.TV.items).find((k) => /resistencia/i.test(window.TV.items[k].n.es) && window.TV.prices.items[k]); return [i, window.TV.prices.items[i].p]; });
await p.fill('[data-prompt]', 'sube un 3% las resistencias; redondea a 2 decimales'); await p.click('[data-run-prompt]'); await p.waitForTimeout(400);
const txt = await p.innerText('[data-draft]');
ok('instrucción genera vista previa con cambios', /cambian/.test(txt) && !/0 cambian/.test(txt), txt.split('\n').slice(0, 3).join(' | '));
await p.click('[data-apply]'); await p.waitForTimeout(400);
const after = await p.evaluate((i) => window.TV.prices.items[i].p, before[0]);
ok('el precio de una resistencia subió ~3%', Math.abs(after - Math.round(before[1] * 1.03 * 100) / 100) < 0.011, `${before[1]} → ${after}`);
await p.click('[data-restore]'); await p.waitForTimeout(300);
ok('restaurar hoja original', !(await p.evaluate(() => localStorage.getItem('tv_prices_override'))));
// cliente
await p.click('[data-logout]'); await p.waitForTimeout(200);
await p.fill('[name=email]', 'cliente@torivac.demo'); await p.fill('[name=pass]', 'Torivac-Cliente-2026'); await p.click('button[type=submit]'); await p.waitForTimeout(500);
ok('cliente ve 4 secciones y no ve Precios de gestión', (await p.$$eval('.side nav a', (a) => a.length)) === 4 && !(await p.$$eval('.side nav a', (a) => a.some((x) => /^Precios$/.test(x.textContent.trim().replace(/^\S\s*/, ''))))));
ok('presupuestador embebido', await p.isVisible('iframe.embed-frame'));
await p.screenshot({ path: path.join(SHOTS, 'admin-cliente.png') });
await b.close();
console.log(JSON.stringify({ results: out, problems }, null, 1));
process.exit(out.every((x) => x.ok) && !problems.length ? 0 : 1);
