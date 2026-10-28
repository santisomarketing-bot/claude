#!/usr/bin/env node
// [QA-ADMIN-LIVE] Sesión 7 · Panel REAL (admin-live.js) contra el Worker real en memoria (sin red, correo ni IA reales).
//   node scripts/qa-admin-live.mjs
// Comprueba: login (error y acierto), menús por rol, pedidos (manager ve todos, cliente solo los suyos), precios (estado, subida con vista previa y aplicar,
// sincronización manual), instrucción por IA (propone → vista previa → confirmar cambios grandes → aplicar), usuarios (alta/baja), propuestas persistentes,
// y que un cliente NO puede llamar a la API de un manager (403) aunque lo intente desde la consola.
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: worker } = await import(path.join(ROOT, 'workers/api/src/index.js'));
const { FakeKV } = await import(path.join(ROOT, 'workers/api/test/helpers.js'));
const { createUser } = await import(path.join(ROOT, 'workers/api/src/users.js'));
const { KEY_CURRENT } = await import(path.join(ROOT, 'workers/api/src/prices.js'));

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

const { server: site, base: SITE } = await serve(DIST);
const SHEET_CSV = `ref;price;qty2;price2\n${R_TT};88,5;10;85\n${R_RES};15,82;;\n${R_RES2};62,93;;\n${R_BO};49,128;;\n`;
const env = { KV: new FakeKV(), PRICE_CSV_URL: 'https://sheet.test/precios.csv', ORDER_TO: 'info@grupotorivac.com,mzamora@torivac.com', RESEND_API_KEY: 're_test', ANTHROPIC_API_KEY: 'sk-test', SESSION_SECRET: 'x'.repeat(40), ADMIN_API_TOKEN: 'master-test', ALLOWED_ORIGINS: SITE };
await env.KV.put(KEY_CURRENT, JSON.stringify({ ...prices, mode: 'live', updated_at: '2026-10-28T08:00:00.000Z' }));
await createUser(env, { email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });
await createUser(env, { email: 'marta@taller.es', name: 'Marta Taller', role: 'client', password: 'Cliente-Clave-2026' });
await createUser(env, { email: 'otro@cliente.es', name: 'Otro Cliente', role: 'client', password: 'Cliente-Clave-2026' });

let aiReply = null;                                                     // respuesta que dará la «IA» en cada prueba
const mails = [];
const mockFetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response('{"id":"m"}', { status: 200 }); }
  if (String(url).includes('sheet.test')) return new Response(SHEET_CSV, { status: 200 });
  if (String(url).includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'proponer_cambios_de_precios', input: aiReply }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
  throw new Error('red no permitida en el test: ' + url);
};
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
  aiReply = { summary: 'Sube un 3 % las resistencias de frenado', changes: [{ ref: R_RES, price: Math.round(before * 1.03 * 10000) / 10000 }, { ref: R_TT, price: 400 }], warnings: [] };
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
  ok((await env.KV.list({ prefix: 'prices:history:' })).keys.length >= 1, 'queda histórico para poder volver atrás');
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

await browser.close(); site.close(); api.close(); fs.rmSync(DIST, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ panel real: acceso, roles, pedidos, precios, IA, usuarios y propuestas correctos');
process.exit(fails ? 1 : 0);
