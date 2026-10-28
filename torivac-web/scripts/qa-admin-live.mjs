#!/usr/bin/env node
// [QA-ADMIN-LIVE] Sesión 7 · Panel REAL (admin-live.js) contra el backend real (sin red, correo ni IA reales).
//   node scripts/qa-admin-live.mjs            contra el Worker torivac-api (en memoria)
//   node scripts/qa-admin-live.mjs --php      contra el API PHP de cPanel (php -S) · ver scripts/lib/backends.mjs
// Comprueba: login (error y acierto), menús por rol, pedidos (manager ve todos, cliente solo los suyos), precios (estado, subida con vista previa y aplicar,
// sincronización manual), instrucción por IA (propone → vista previa → confirmar cambios grandes → aplicar), usuarios (alta/baja), propuestas persistentes,
// y que un cliente NO puede llamar a la API de un manager (403) aunque lo intente desde la consola.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBackend } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// el sitio se compila con TORIVAC_API (valor provisional) para que /admin/ cargue el panel real; la URL verdadera se inyecta al servir
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-live-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const sb = { window: {} }; sb.window = sb; vm.createContext(sb);
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data', f), 'utf8'), sb);
const { items } = sb.TV;
const prices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/prices.json'), 'utf8'));      // hoja de DEMO del catálogo (el sitio con API no la lleva)
// 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
const pick = (pid) => Object.keys(items).find((r) => items[r].pid === pid);
const R_TT = pick(884), R_RES = pick(8339), R_RES2 = pick(8340), R_BO = pick(932);

const SHEET_CSV = `ref;price;qty2;price2\n${R_TT};88,5;10;85\n${R_RES};15,82;;\n${R_RES2};62,93;;\n${R_BO};49,128;;\n`;
const be = await startBackend({ dist: DIST });
const { SITE, API } = be;
console.log(`backend: ${be.kind}`);
be.setCsv(SHEET_CSV);
await be.seedPrices({ ...prices, mode: 'live', updated_at: '2026-10-28T08:00:00.000Z' });
await be.addUser({ email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });
await be.addUser({ email: 'marta@taller.es', name: 'Marta Taller', role: 'client', password: 'Cliente-Clave-2026' });
await be.addUser({ email: 'otro@cliente.es', name: 'Otro Cliente', role: 'client', password: 'Cliente-Clave-2026' });

const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('http://api.invalid', API) }); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  return { ctx, page, errs };
};
const login = async (page, email, pass) => { await page.goto(SITE + '/admin/index.html'); await page.fill('[name=email]', email); await page.fill('[name=pass]', pass); await page.click('button[type=submit]'); };
const navs = (page) => page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.trim()));
const toastText = async (page) => { await page.waitForTimeout(250); return page.locator('#toast').innerText(); };

// ───────────────────────────────────── pedido de prueba hecho desde la web (público) por Marta
const order = await fetch(API + '/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ customer: { name: 'Marta Taller', company: 'Taller S.L.', email: 'marta@taller.es', privacy: true }, lines: [{ ref: R_TT, qty: 12 }, { ref: R_BO, qty: 200 }], lang: 'es' }) }).then((r) => r.json());

console.log('\n1) acceso');
{ const { ctx, page, errs } = await newPage();
  await login(page, 'jefa@torivac.com', 'mala-clave-1234');
  await page.waitForSelector('[data-err]:not([hidden])', { timeout: 5000 });
  ok(/incorrect/i.test(await page.locator('[data-err]').innerText()), 'contraseña errónea → mensaje del servidor');
  await page.fill('[name=pass]', 'Manager-Clave-2026'); await page.click('button[type=submit]');
  await page.waitForSelector('.side nav a');
  ok((await navs(page)).length === 8, `manager: ${(await navs(page)).join(' · ')}`);
  await page.waitForFunction(() => document.querySelectorAll('.kpi').length === 4, null, { timeout: 5000 }).catch(() => {});      // los indicadores se pintan al llegar los pedidos
  ok(await page.locator('.kpi').count() === 4, 'Resumen con 4 indicadores');
  ok(/1/.test(await page.locator('.kpi').first().innerText()), 'cuenta el pedido hecho desde la web');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close(); }

console.log('\n2) pedidos: el manager ve todos, cada cliente solo los suyos');
{ const m = await newPage(); await login(m.page, 'jefa@torivac.com', 'Manager-Clave-2026'); await m.page.click('.side nav a[href="#pedidos"]'); await m.page.waitForSelector('table.spec');
  ok((await m.page.locator('table.spec tbody tr').count()) === 1 && /Marta Taller/.test(await m.page.locator('table.spec tbody').innerText()), `manager ve el pedido ${order.number}`);
  const [dl] = await Promise.all([m.page.waitForEvent('download'), m.page.click('[data-pdf]')]); ok(/\.pdf$/.test(dl.suggestedFilename()), `PDF regenerado (${dl.suggestedFilename()})`);
  await m.ctx.close();
  const c = await newPage(); await login(c.page, 'marta@taller.es', 'Cliente-Clave-2026'); await c.page.waitForSelector('.side nav a');
  ok((await navs(c.page)).length === 4 && !(await navs(c.page)).some((n) => /Usuarios|Precios$/.test(n)), `cliente: ${(await navs(c.page)).join(' · ')}`);
  await c.page.click('.side nav a[href="#mis"]'); await c.page.waitForSelector('table.spec');
  ok((await c.page.locator('table.spec tbody tr').count()) === 1, 'Marta ve su pedido');
  // un cliente NO puede usar la API de manager aunque lo intente a mano
  const tok = JSON.parse(await c.page.evaluate(() => sessionStorage.getItem('tv_live'))).token;
  const st = await c.page.evaluate(async ([a, t]) => ({ users: (await fetch(a + '/api/users', { headers: { Authorization: 'Bearer ' + t } })).status, refresh: (await fetch(a + '/api/prices/refresh', { method: 'POST', headers: { Authorization: 'Bearer ' + t } })).status, ai: (await fetch(a + '/api/prices/ai', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: '{"instruction":"sube todo un 50 %"}' })).status }), [API, tok]);
  ok(st.users === 403 && st.refresh === 403 && st.ai === 403, `cliente → /api/users ${st.users} · /prices/refresh ${st.refresh} · /prices/ai ${st.ai} (403)`);
  await c.ctx.close();
  const o = await newPage(); await login(o.page, 'otro@cliente.es', 'Cliente-Clave-2026'); await o.page.click('.side nav a[href="#mis"]'); await o.page.waitForSelector('main .notice:has-text("Todavía no hay pedidos")', { timeout: 5000 }).catch(() => {});
  ok(/Todavía no hay pedidos/.test(await o.page.locator('main').innerText()), 'otro cliente no ve el pedido de Marta');
  await o.ctx.close(); }

console.log('\n3) precios: subir hoja con vista previa y aplicar');
{ const { ctx, page } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026'); await page.click('.side nav a[href="#precios"]'); await page.waitForSelector('[data-drop]');
  ok(/referencias con precio/.test(await page.locator('main').innerText()), 'estado de la hoja');
  const csv = path.join(DIST, 'hoja.csv'); fs.writeFileSync(csv, `ref;price;qty2;price2\n${R_TT};99,99;10;95\n${R_RES};15,82;;\n${R_BO};49,128;;\n`);
  await page.setInputFiles('[data-file]', csv); await page.waitForSelector('[data-apply-upload]');
  const prev = await page.locator('[data-draft]').innerText();
  ok(/1\s*cambian/.test(prev.replace(/\n/g, ' ')) || /cambian/.test(prev), 'vista previa de diferencias');
  await page.click('[data-force]'); await page.click('[data-apply-upload]'); await page.waitForTimeout(600);
  const pub = await fetch(API + '/api/prices').then((r) => r.json());
  ok(pub.prices.items[R_TT].p === 99.99 && JSON.stringify(pub.prices.items[R_TT].t) === '[[10,95]]', 'precio publicado en el servidor (99,99 con tramo 10 uds = 95)');
  await page.click('[data-refresh]'); await page.waitForTimeout(700);
  const syn = (await fetch(API + '/api/prices').then((r) => r.json()));
  ok(syn.prices.items[R_TT].p === 88.5 && syn.meta.reason.startsWith('manual:') && Object.keys(syn.prices.items).length === 4, 'botón «Actualizar ahora»: vuelve a leer la hoja de Drive (precio 88,5)');
  await ctx.close(); }

console.log('\n4) instrucción en castellano con IA: propone → confirma → aplica');
{ const { ctx, page } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026'); await page.click('.side nav a[href="#precios"]'); await page.waitForSelector('[data-prompt]');
  const before = (await fetch(API + '/api/prices').then((r) => r.json())).prices.items[R_RES].p;
  be.setAi({ summary: 'Sube un 3 % las resistencias de frenado', changes: [{ ref: R_RES, price: Math.round(before * 1.03 * 10000) / 10000 }, { ref: R_TT, price: 400 }], warnings: [] });
  await page.fill('[data-prompt]', 'sube un 3 % las resistencias'); await page.click('[data-run-prompt]');
  await page.waitForSelector('[data-apply-ai]');
  const txt = await page.locator('[data-draft]').innerText();
  ok(/Sube un 3 % las resistencias/.test(txt) && txt.includes(R_RES) && /⚠/.test(txt), 'vista previa con los cambios y el aviso del cambio muy grande');
  ok((await fetch(API + '/api/prices').then((r) => r.json())).prices.items[R_RES].p === before, 'la propuesta todavía NO está aplicada');
  await page.click('[data-apply-ai]'); await page.waitForTimeout(400);
  ok(/muy grandes/i.test(await toastText(page)), 'sin confirmar el cambio grande, el servidor lo rechaza');
  await page.click('[data-confirm-large]'); await page.click('[data-apply-ai]'); await page.waitForTimeout(600);
  const after = (await fetch(API + '/api/prices').then((r) => r.json())).prices.items;
  ok(after[R_RES].p === Math.round(before * 1.03 * 10000) / 10000 && after[R_TT].p === 400, `aplicado tras confirmar (${before} → ${after[R_RES].p})`);
  ok((await be.historyCount()) >= 1, 'queda histórico para poder volver atrás');
  await ctx.close(); }

console.log('\n5) usuarios y propuestas');
{ const { ctx, page } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026');
  await page.click('.side nav a[href="#usuarios"]'); await page.waitForSelector('[data-new-user]');
  ok((await page.locator('table.spec tbody tr').count()) === 3, '3 usuarios');
  await page.fill('[data-new-user] [name=name]', 'Nuevo Cliente'); await page.fill('[data-new-user] [name=email]', 'nuevo@cliente.es'); await page.fill('[data-new-user] [name=password]', 'Clave-Nueva-2026'); await page.click('[data-new-user] button[type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('table.spec tbody tr').length === 4);
  ok(true, 'usuario creado (4)');
  const ok2 = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nuevo@cliente.es', password: 'Clave-Nueva-2026' }) }).then((r) => r.json());
  ok(ok2.ok === true && ok2.user.role === 'client', 'el usuario nuevo puede entrar como cliente');
  page.once('dialog', (d) => d.accept()); await page.click('[data-del-user="nuevo@cliente.es"]'); await page.waitForFunction(() => document.querySelectorAll('table.spec tbody tr').length === 3);
  ok(true, 'usuario borrado (3)');
  await page.click('.side nav a[href="#propuestas"]'); await page.waitForSelector('article.prop');
  const id = await page.locator('[data-prop][data-v="ok"]').first().getAttribute('data-prop');
  await page.locator('[data-prop][data-v="ok"]').first().click(); await page.waitForTimeout(500);
  await page.reload(); await page.waitForSelector('article.prop');
  const art = await page.locator(`article.prop:has([data-prop="${id}"])`).innerText();
  ok(/aprobada/i.test(art), `la aprobación de ${id} se conserva tras recargar (guardada en el servidor)` + (/aprobada/i.test(art) ? '' : ' — «' + art.replace(/\s+/g, ' ').slice(0, 160) + '»'));
  await page.click('[data-logout]'); await page.waitForSelector('[data-login]'); ok(true, 'salir devuelve al acceso');
  await ctx.close(); }

await browser.close(); await be.stop(); fs.rmSync(DIST, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : `\n✓ panel real + ${be.kind}: acceso, roles, pedidos, precios, IA, usuarios y propuestas correctos`);
process.exit(fails ? 1 : 0);
