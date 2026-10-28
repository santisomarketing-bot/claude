#!/usr/bin/env node
// [QA-PACKAGE] El paquete del hosting (cPanel/Plesk) tal y como se sube: lo genera package_cpanel.py (con sus verificaciones), se sirve con php -S
// (URLs limpias, API PHP real con almacén en ficheros, Resend simulado) y se recorre con el navegador:
// precios que llegan del servidor (el paquete NO lleva precios), presupuesto, pedido, panel y seguridad del API.
//   node scripts/qa-package.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBackend, freePort } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ───────────────────────────────────────── [PAQUETE] compilado con la URL local definitiva (la web lleva su propia URL de API)
const port = await freePort(), BASE = `http://127.0.0.1:${port}`;
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-pkg-'));
execFileSync('python3', ['-I', path.join(ROOT, 'scripts/package_cpanel.py'), `--base=${BASE}`, `--out=${OUT}`, '--keep', '--allow-dirty'], { stdio: 'pipe' });      // --allow-dirty: las pruebas empaquetan también con cambios sin commitear
const WWW = path.join(OUT, fs.readdirSync(OUT).find((d) => fs.statSync(path.join(OUT, d)).isDirectory()));
const sb = { window: {} }; sb.window = sb; vm.createContext(sb);
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(WWW, 'assets/data', f), 'utf8'), sb);
const { items, prices: bundled } = sb.TV;
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/prices.json'), 'utf8'));      // hoja de DEMO: hace de hoja de Drive en el servidor
/** Primera referencia pedible de un producto (código real del PDF o línea genérica P<id>). */
const pick = (pid) => Object.keys(items).find((r) => items[r].pid === pid);
const R = [pick(884), pick(8339)], Q = { [R[0]]: 12, [R[1]]: 2 };
/** Redondea a 2 decimales (importe de línea). */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Precio unitario de una referencia para una cantidad, con los tramos de la hoja. */
const unit = (ref, q) => { const p = demo.items[ref]; let u = p.p; for (const [m, x] of p.t || []) if (q >= m) u = x; return u; };
const expTotal = round2(R.reduce((s, r) => s + round2(unit(r, Q[r]) * Q[r]), 0));

const be = await startBackend({ kind: 'php', dist: WWW, port });
await be.seedPrices({ ...demo, mode: 'live', updated_at: new Date().toISOString() });
await be.addUser({ email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });

const browser = await chromium.launch();
let fails = 0;
/** Anota una comprobación: la cuenta como fallo si no se cumple y la imprime. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } });
// la política de seguridad de contenido (CSP) que pone el .htaccess real se aplica aquí a cada página: si algo de la web la incumple, sale como error de consola
const csp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(WWW, '.htaccess'), 'utf8'))[1];
await ctx.route('**/*', async (route) => {
  if (route.request().resourceType() !== 'document') return route.fallback();
  const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': csp } });
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });

console.log('\n1) el paquete no lleva precios; llegan del servidor');
ok(bundled.mode === 'none' && Object.keys(bundled.items).length === 0, `prices.js del paquete vacío (modo ${bundled.mode})`);
await page.goto(BASE + '/');
ok(/Torivac/.test(await page.title()), `portada con URL limpia: «${await page.title()}»`);
const meta = await page.evaluate(() => ({ api: TV.meta.api, demo: TV.meta.demo, rec: TV.meta.recipients, clean: TV.meta.clean }));
ok(meta.api === BASE && meta.demo === false && meta.clean === true, `TV.meta: api=${meta.api} demo=${meta.demo} clean=${meta.clean}`);
ok(meta.rec.length === 1 && meta.rec[0] === 'info@grupotorivac.com', `solo el correo general en el código público (${meta.rec.join(',')})`);
await page.goto(BASE + items[R[0]].p.es);
await page.waitForFunction(() => TV.prices && TV.prices.mode === 'live', null, { timeout: 8000 });
const shown = await page.locator(`tr[data-ref="${R[0]}"] [data-price-for]`).first().innerText();
ok(shown.includes(String(demo.items[R[0]].p).replace('.', ',')), `la ficha muestra el precio del servidor (${R[0]}: «${shown.replace(/\s+/g, ' ')}»)`);
ok(!(await page.locator('[data-demo-flag]').first().isVisible().catch(() => false)), 'sin marca DEMO');

console.log('\n2) presupuesto y pedido contra el API PHP del paquete');
await page.evaluate(([refs, q]) => { refs.forEach((r) => TV.Quote.add(r, q[r])); }, [R, Q]);
await page.goto(BASE + '/presupuesto/');
const f = page.locator('[data-quote-form]');
await f.locator('[name=name]').fill('Marta Paquete'); await f.locator('[name=company]').fill('Taller Test S.L.');
await f.locator('[name=email]').fill('cliente.prueba@example.com'); await f.locator('[name=privacy]').check();
await f.locator('button[type=submit]').click();
await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 10000 });
const num = ((await page.locator('[data-sent]').innerText()).match(/TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?/) || [])[0];
ok(!!num, `pedido aceptado: ${num}`);
const rec = await be.order(num);
ok(rec && rec.total === expTotal, `total del servidor ${rec && rec.total} = ${expTotal}`);
ok(be.mails.length === 2 && JSON.stringify(be.mails[0].to) === JSON.stringify(['info@grupotorivac.com', 'mzamora@torivac.com']), 'correo al equipo (info@ y mzamora@) + copia al cliente');
ok((be.mails[0].attachments || []).some((a) => /\.pdf$/.test(a.filename)), 'con el PDF del presupuesto adjunto');

console.log('\n3) idiomas y panel');
await page.goto(BASE + '/en/');
ok(/en$|en-/i.test(await page.evaluate(() => document.documentElement.lang)), 'inglés con URL limpia');
await page.goto(BASE + '/admin/');
await page.fill('[name=email]', 'jefa@torivac.com'); await page.fill('[name=pass]', 'Manager-Clave-2026'); await page.click('button[type=submit]');
await page.waitForSelector('.side nav a', { timeout: 8000 });
await page.waitForFunction(() => document.querySelectorAll('.kpi').length === 4, null, { timeout: 5000 }).catch(() => {});
ok((await page.locator('.kpi').count()) === 4, 'el manager entra en el panel y ve el resumen');
await page.click('.side nav a[href="#ajustes"]'); await page.waitForSelector('.diag li', { timeout: 8000 });
const diag = await page.locator('.diag').innerText();
ok((await page.locator('.diag li').count()) >= 10 && !/✗/.test(diag), `Ajustes → Diagnóstico del servidor: ${await page.locator('.diag li').count()} comprobaciones, sin fallos`);

console.log('\n4) seguridad del API');
/** Pide una ruta del API y devuelve el código HTTP y si la respuesta enseña código PHP. */
const peek = async (p) => { const r = await fetch(BASE + p); const t = await r.text(); return { s: r.status, php: /<\?php|namespace Torivac|session_secret/.test(t) }; };
for (const p of ['/api/config.php', '/api/config.sample.php', '/api/lib/Config.php', '/api/lib/autoload.php', '/api/cron.php', '/api/tools/create-user.php', '/api/generated/catalog.json']) {
  const r = await peek(p); ok(!r.php && [401, 403, 404].includes(r.s), `${p} no se sirve ni enseña código (HTTP ${r.s})`);
}
ok((await fetch(BASE + '/api/health').then((r) => r.json())).ok === true, '/api/health responde');
ok((await fetch(BASE + '/api/orders')).status === 401, 'pedidos sin sesión → 401');
ok((await fetch(BASE + '/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' })).status === 403, 'origen ajeno → 403');
ok(!errs.length, 'sin errores de consola ni incumplimientos de la CSP del .htaccess' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

await browser.close(); await be.stop(); fs.rmSync(OUT, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ paquete del hosting: sin precios, precios del servidor, pedido, panel y API cerrado correctos');
process.exit(fails ? 1 : 0);
