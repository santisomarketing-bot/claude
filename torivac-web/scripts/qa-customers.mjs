#!/usr/bin/env node
// [QA-CUSTOMERS] Precios por categoría, cuentas de cliente y precios aproximados · panel REAL + web contra el backend real (sin red, correo ni IA reales).
//   node scripts/qa-customers.mjs            contra el Worker torivac-api (en memoria)
//   node scripts/qa-customers.mjs --php      contra el API PHP de cPanel/Plesk (php -S) · ver scripts/lib/backends.mjs
// Contrato: docs/PRECIOS-Y-CLIENTES.md. Comprueba: qué precios da GET /api/prices según quién llama (el VIP nunca sale a un cliente ni a un visitante), las cuatro categorías sobre el precio
// base y sus tramos, el precio aproximado y su regla, la vista Clientes (alta, categoría, contraseña, baja), la vista Precios (porcentajes, visitantes, editor con marca «manual» que la hoja no pisa),
// la cuenta de cliente de solo lectura (menú, «Aplicar mis precios», 3 presupuestos al día, solo ve los suyos, no edita ni reenvía) y el selector de categoría al editar un presupuesto.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBackend, MASTER_TOKEN } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-cust-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const sb = { window: {}, document: { getElementById: () => null } }; sb.window = sb; vm.createContext(sb);
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data', f), 'utf8'), sb);
const { items } = sb.TV;
const pick = (pid) => Object.keys(items).find((r) => items[r].pid === pid);
const R_TT = pick(884), R_RES = pick(8339), R_BO = pick(932), R_NOP = pick(8340);        // R_NOP: sin precio en la hoja de estas pruebas

const be = await startBackend({ dist: DIST });
const { SITE, API } = be;
console.log(`backend: ${be.kind}`);
// precios base = VIP (la hoja): R_TT 100 € con tramo desde 10 uds. a 90 €, R_RES 20 €, R_BO 40 €; R_NOP no tiene precio
await be.seedPrices({ updated_at: '2026-10-28T08:00:00.000Z', source: 'sheet', currency: 'EUR', mode: 'live', items: { [R_TT]: { p: 100, t: [[10, 90]] }, [R_RES]: { p: 20 }, [R_BO]: { p: 40 } } });
const PW = { jefa: 'Manager-Clave-2026', maria: 'Propietaria-Clave-2026', ana: 'Acceso-Seguro-Uno-2026', luis: 'Acceso-Seguro-Dos-2026' };
await be.addUser({ email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: PW.jefa });
await be.addUser({ email: 'maria@torivac.com', name: 'María Torivac', role: 'client', password: PW.maria });
await be.addUser({ email: 'ana@cliente.es', name: 'Ana Cliente', role: 'customer', password: PW.ana, tier: 'vip5' });
await be.addUser({ email: 'luis@cliente.es', name: 'Luis Cliente', role: 'customer', password: PW.luis });          // sin categoría: Normal

const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Llamada al API desde Node: { status, j } (con token de sesión opcional). */
const api = async (p, { method = 'GET', token, body } = {}) => { const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', Origin: SITE, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, j: await r.json().catch(() => ({})), h: r.headers }; };
/** Entra por el API con correo y contraseña → token de sesión. */
const tokenOf = async (email, pw) => { const r = await api('/api/auth/login', { method: 'POST', body: { email, password: pw } }); if (!r.j.token) throw new Error('login ' + email + ': ' + JSON.stringify(r.j)); return r.j.token; };
/** Abre un contexto (1440×900) con el catálogo apuntando al API de pruebas; devuelve { ctx, page, errs }. */
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('http://api.invalid', API) }); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|Blocked script execution/.test(m.text())) errs.push(m.text()); });
  return { ctx, page, errs };
};
/** Abre /admin/ y entra con el correo y la contraseña dados; espera al menú. */
const login = async (page, email, pass) => { await page.goto(SITE + '/admin/index.html'); await page.fill('[name=email]', email); await page.fill('[name=pass]', pass); await page.click('button[type=submit]'); await page.waitForSelector('.side nav a'); };
/** Textos de los enlaces del menú lateral sin el icono. */
const navs = async (page) => (await page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.trim()))).map((n) => n.slice(1).trim());
/** Va a una dirección del panel y espera a que salga el elemento `sel`. */
const go = async (page, hash, sel) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForSelector(sel, { timeout: 8000 }); };
const tJ = await tokenOf('jefa@torivac.com', PW.jefa), tM = await tokenOf('maria@torivac.com', PW.maria), tA = await tokenOf('ana@cliente.es', PW.ana), tL = await tokenOf('luis@cliente.es', PW.luis);
const pr = async (token) => (await api('/api/prices', { token })).j.prices || {};
const line = (order, ref) => order.lines.find((l) => l.ref === ref);

console.log('\n1) GET /api/prices: cada quien ve lo suyo y el VIP no se filtra');
{ const anon0 = await pr(); ok(!Object.keys(anon0.items || {}).length, 'visitante con los ajustes de fábrica: ningún precio («Consultar»)');
  const vip = await pr(tJ), vipM = await pr(tM);
  ok(vip.items[R_TT].p === 100 && vipM.items[R_TT].p === 100 && JSON.stringify(vip.items[R_TT].t) === '[[10,90]]', 'manager y propietario ven el precio base (VIP)');
  const ana = await pr(tA), luis = await pr(tL);
  ok(ana.items[R_TT].p === 105 && JSON.stringify(ana.items[R_TT].t) === '[[10,94.5]]' && ana.items[R_RES].p === 21 && ana.items[R_BO].p === 42, 'una cuenta VIP +5 ve el VIP + 5 % (también en los tramos)');
  ok(luis.items[R_TT].p === 115 && JSON.stringify(luis.items[R_TT].t) === '[[10,103.5]]', 'una cuenta sin categoría es Normal: VIP + 15 %');
  ok(!R_NOP || !(R_NOP in ana.items), 'un producto sin precio sigue sin precio en todas las categorías');
  const raw = JSON.stringify([ana, luis]); ok(!/"p":100\b|"p":20\b|"p":40\b|\[10,90\]/.test(raw), 'el precio VIP no aparece en lo que reciben los clientes');
  ok(!('m' in ana.items[R_TT]) && !('a' in ana.items[R_TT]), 'y tampoco las marcas internas (manual, aproximado)');
  ok(/Authorization/i.test((await api('/api/prices')).h.get('vary') || ''), 'la respuesta lleva Vary: Authorization (no se mezclan en cachés)');
  // visitante: aproximado
  await be.setPricing({ approx: { on: true, pct: 15 } });
  const ap = await pr(); ok(ap.approx === true && ap.items[R_TT].p === 115 && ap.items[R_RES].p === 23 && ap.items[R_BO].p === 46 && !ap.items[R_TT].t, 'visitante con «aproximado»: VIP + 15 % redondeado al euro, para 1 unidad y sin tramos');
  ok(!JSON.stringify(ap).includes('"p":100'), '… y sin el precio VIP');
  const aq = await api('/api/order', { method: 'POST', body: { customer: { name: 'Visita', email: 'visita@x.es', privacy: true }, lines: [{ ref: R_TT, qty: 12 }, { ref: R_RES, qty: 3 }], lang: 'es' } });
  const qa = await api('/api/orders/' + aq.j.number, { token: tJ });
  ok(aq.status === 200 && aq.j.unpriced === 2 && aq.j.total === 0 && qa.j.order.priceTier === 'consult' && line(qa.j.order, R_TT).unit === null, 'un presupuesto de visitante sale «A consultar» (sin importes)');
  global.ANON_NUMBER = aq.j.number;
  await be.setPricing({ anon: 'normal' });
  const an = await pr(); ok(an.items[R_TT].p === 115 && !an.approx && JSON.stringify(an.items[R_TT].t) === '[[10,103.5]]', 'con «visitantes ven el precio Normal»: lista Normal completa');
  const aq2 = await api('/api/order', { method: 'POST', body: { customer: { name: 'Visita', email: 'visita@x.es', privacy: true }, lines: [{ ref: R_TT, qty: 12 }], lang: 'es' } });
  const qa2 = await api('/api/orders/' + aq2.j.number, { token: tJ }); ok(qa2.j.order.priceTier === 'normal' && line(qa2.j.order, R_TT).unit === 103.5 && qa2.j.order.total === 1242, '… y el presupuesto de un visitante se valora como Normal');
  await be.setPricing({ approx: { on: true, pct: 15 } }); }

console.log('\n2) Clientes (API): alta, categoría, contraseña y baja; solo managers y propietarios');
{ const un = (await api('/api/customers')).status, cu = (await api('/api/customers', { token: tA })).status; ok(un === 401 && cu === 403, `sin sesión ${un} · un cliente ${cu}`);
  const list = (await api('/api/customers', { token: tM })).j; ok(list.ok && list.customers.length === 2 && list.customers.find((c) => c.email === 'ana@cliente.es').tier === 'vip5' && list.customers.find((c) => c.email === 'luis@cliente.es').tier === 'normal' && list.tiers.vip5.pct === 5, 'el propietario ve las 2 cuentas con su categoría y los porcentajes');
  ok(!list.customers.some((c) => c.email === 'jefa@torivac.com' || c.email === 'maria@torivac.com'), 'las cuentas del equipo no salen en Clientes');
  const mk = await api('/api/customers', { method: 'POST', token: tM, body: { email: 'nuevo@cliente.es', name: 'Nuevo Cliente', password: 'Acceso-Seguro-Tres-2026', tier: 'vip10' } });
  ok(mk.status < 300 && mk.j.ok, 'el propietario da de alta un cliente VIP +10');
  ok((await api('/api/customers', { method: 'POST', token: tM, body: { email: 'nuevo@cliente.es', name: 'Otra', password: 'Acceso-Seguro-Tres-2026', tier: 'vip' } })).status === 409, 'el mismo correo otra vez → 409');
  ok((await api('/api/customers', { method: 'POST', token: tM, body: { email: 'x@cliente.es', name: 'X', password: 'corta', tier: 'vip' } })).status === 400 && (await api('/api/customers', { method: 'POST', token: tM, body: { email: 'y@cliente.es', name: 'Y', password: 'Acceso-Seguro-Tres-2026', tier: 'oro' } })).status === 400, 'contraseña corta y categoría inventada → 400');
  const tN = await tokenOf('nuevo@cliente.es', 'Acceso-Seguro-Tres-2026'); const nv = await pr(tN); ok(nv.items[R_TT].p === 110, 'su sesión ve VIP + 10 % al instante');
  ok((await api('/api/customers/nuevo@cliente.es', { method: 'PUT', token: tM, body: { tier: 'vip' } })).j.ok && (await pr(tN)).items[R_TT].p === 100, 'cambiarle la categoría a VIP vale al instante (misma sesión)');
  ok((await api('/api/customers/maria@torivac.com', { method: 'PUT', token: tM, body: { tier: 'vip' } })).status === 404 && (await api('/api/customers/' + encodeURIComponent('jefa@torivac.com'), { method: 'DELETE', token: tM })).status === 404, 'no se puede tocar una cuenta del equipo desde Clientes (404)');
  ok((await api('/api/customers/nuevo@cliente.es/password', { method: 'POST', token: tM, body: { password: 'Otra-Clave-Larga-2026' } })).j.ok && (await api('/api/prices', { token: tN })).status === 200 && (await api('/api/orders', { token: tN })).status === 401, 'contraseña nueva: se cierran sus sesiones');
  ok((await api('/api/customers/nuevo@cliente.es', { method: 'DELETE', token: tM })).j.ok && (await api('/api/auth/login', { method: 'POST', body: { email: 'nuevo@cliente.es', password: 'Otra-Clave-Larga-2026' } })).status === 401, 'borrar la cuenta: ya no puede entrar'); }

console.log('\n3) Ajustes de precios (API)');
{ const g = (await api('/api/settings/pricing', { token: tM })).j.pricing; ok(g.tiers.vip5 === 5 && g.tiers.normal === 15 && g.anon === 'consult' && g.approx.on === true, 'los ajustes que fijó la prueba están guardados');
  ok((await api('/api/settings/pricing', { token: tA })).status === 403 && (await api('/api/settings/pricing')).status === 401, 'un cliente 403 · sin sesión 401');
  const bad = await api('/api/settings/pricing', { method: 'PUT', token: tM, body: { tiers: { vip5: 12, vip10: 8, normal: 15 }, anon: 'consult', approx: { on: false, pct: 15 } } }); ok(bad.status === 400 && /^tiers\./.test(bad.j.field), `vip5 mayor que vip10 → 400 (${bad.j.field})`);
  const set = await api('/api/settings/pricing', { method: 'PUT', token: tM, body: { tiers: { vip5: 6, vip10: 11, normal: 16 }, anon: 'consult', approx: { on: true, pct: 20 } } }); ok(set.j.ok && set.j.pricing.updated.by === 'maria@torivac.com', 'el propietario cambia los porcentajes (queda quién)');
  ok((await pr(tA)).items[R_TT].p === 106 && (await pr()).items[R_TT].p === 120, 'los porcentajes nuevos mandan al instante (VIP +5 = 106; aproximado 20 % = 120)');
  await be.setPricing({ approx: { on: true, pct: 15 } }); }

console.log('\n4) Panel · el propietario: Clientes y Precios');
{ const { ctx, page, errs } = await newPage(); await login(page, 'maria@torivac.com', PW.maria);
  ok((await navs(page)).join(' · ') === 'Nuevo presupuesto · Presupuestos recibidos · Clientes · Precios · Lista de precios · Estadísticas', `menú del propietario: ${(await navs(page)).join(' · ')}`);
  await go(page, '#clientes', '[data-cu-root]'); ok((await page.locator('[data-cu-root] tbody tr').count()) === 2, 'Clientes: las 2 cuentas');
  await page.fill('[data-cu-new] [name=name]', 'Nuevo Cliente'); await page.fill('[data-cu-new] [name=email]', 'nuevo@cliente.es'); await page.fill('[data-cu-new] [name=password]', 'Acceso-Seguro-Tres-2026'); await page.selectOption('[data-cu-new] [name=tier]', 'vip10'); await page.click('[data-cu-new] button[type=submit]');
  await page.waitForSelector('[data-cu-tier="nuevo@cliente.es"]', { timeout: 8000 });
  ok((await api('/api/customers', { token: tM })).j.customers.find((c) => c.email === 'nuevo@cliente.es').tier === 'vip10', 'alta desde el panel con su categoría');
  await page.selectOption('[data-cu-tier="nuevo@cliente.es"]', 'normal'); await page.waitForFunction(() => /Normal/.test((document.querySelector('[data-cu-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  ok((await api('/api/customers', { token: tM })).j.customers.find((c) => c.email === 'nuevo@cliente.es').tier === 'normal', 'cambiar la categoría en el desplegable se guarda');
  await page.locator('tr:has([data-cu-tier="nuevo@cliente.es"]) summary').click(); await page.fill('tr:has([data-cu-tier="nuevo@cliente.es"]) [data-cu-pw] [name=password]', 'Clave-Nueva-Del-Panel-26'); await page.click('tr:has([data-cu-tier="nuevo@cliente.es"]) [data-cu-pw] button');
  await page.waitForFunction(() => /Contraseña nueva guardada/.test((document.querySelector('[data-cu-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  ok((await api('/api/auth/login', { method: 'POST', body: { email: 'nuevo@cliente.es', password: 'Clave-Nueva-Del-Panel-26' } })).status === 200, 'contraseña nueva desde el panel');
  page.once('dialog', (d) => d.accept()); await page.click('[data-cu-del="nuevo@cliente.es"]'); await page.waitForFunction(() => !document.querySelector('[data-cu-tier="nuevo@cliente.es"]'), null, { timeout: 8000 });
  ok((await api('/api/customers', { token: tM })).j.customers.length === 2, 'borrar desde el panel (con confirmación)');
  // Precios: porcentajes
  await go(page, '#precios', '[data-pr-settings]');
  ok((await page.locator('[data-pr-ex=vip]').innerText()).includes('100') && (await page.locator('[data-pr-ex=normal]').innerText()).includes('115'), 'el ejemplo de 100 € muestra VIP 100 y Normal 115');
  await page.fill('[data-pr-pct=vip5]', '6'); ok((await page.locator('[data-pr-ex=vip5]').innerText()).includes('106'), 'y se recalcula al escribir (VIP +5 = 106)');
  await page.fill('[data-pr-pct=vip10]', '5'); await page.click('[data-pr-save-settings]'); await page.waitForFunction(() => document.querySelector('[data-pr-pct=vip10]').getAttribute('aria-invalid') === 'true', null, { timeout: 5000 }).catch(() => {});
  ok((await page.locator('[data-pr-pct=vip10]').getAttribute('aria-invalid')) === 'true' && (await api('/api/settings/pricing', { token: tM })).j.pricing.tiers.vip5 === 5, 'un orden imposible (VIP +5 mayor que VIP +10) se rechaza junto al campo y no se guarda');
  await page.fill('[data-pr-pct=vip10]', '11'); await page.fill('[data-pr-pct=normal]', '16'); await page.click('[data-pr-save-settings]'); await page.waitForFunction(() => /^Guardado/.test((document.querySelector('[data-pr-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  const sv = (await api('/api/settings/pricing', { token: tM })).j.pricing; ok(sv.tiers.vip5 === 6 && sv.tiers.vip10 === 11 && sv.tiers.normal === 16, 'porcentajes guardados desde el panel (6, 11 y 16)');
  await page.check('[name=anon][value=normal]'); ok(await page.locator('[data-pr-approx]').isHidden(), 'con «visitantes ven el precio Normal» el bloque del aproximado se oculta');
  await page.check('[name=anon][value=consult]'); await page.fill('[data-pr-pct=vip5]', '5'); await page.fill('[data-pr-pct=vip10]', '10'); await page.fill('[data-pr-pct=normal]', '15'); await page.check('[data-pr-approx-on]'); await page.fill('[data-pr-approx-pct]', '15'); await page.click('[data-pr-save-settings]');
  await page.waitForFunction(() => /^Guardado/.test((document.querySelector('[data-pr-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  ok((await pr()).items[R_TT].p === 115, 'vuelven los porcentajes de fábrica con el aproximado activado (visitante: 115)');
  // editor de productos
  await page.fill('[data-pr-q]', R_TT.slice(0, 7)); await page.waitForSelector(`[data-pr-row="${R_TT}"]`, { timeout: 5000 });
  ok(/VIP \+5/.test(await page.locator(`[data-pr-row="${R_TT}"]`).innerText()), 'el editor enseña también lo que pagan las otras categorías');
  await page.fill(`[data-pr-row="${R_TT}"] [data-pr-p]`, '120'); await page.fill(`[data-pr-row="${R_TT}"] [data-pr-t]`, '10:95; 50:80'); await page.click(`[data-pr-save="${R_TT}"]`);
  await page.waitForFunction(() => /Guardado/.test((document.querySelector('[data-pr-edit-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  const it = (await pr(tM)).items[R_TT]; ok(it.p === 120 && JSON.stringify(it.t) === '[[10,95],[50,80]]' && it.m === true, 'precio y tramos guardados a mano: quedan marcados «manual»');
  ok((await pr(tL)).items[R_TT].p === 138 && /manual/i.test(await page.locator(`[data-pr-row="${R_TT}"]`).innerText()), 'una cuenta Normal ya ve 120 + 15 % = 138, y el editor muestra la marca «manual»');
  await page.fill(`[data-pr-row="${R_TT}"] [data-pr-t]`, 'diez por ciento'); await page.click(`[data-pr-save="${R_TT}"]`);
  ok(/tramos/i.test(await page.locator('[data-pr-edit-msg]').innerText()), 'unos tramos mal escritos se avisan sin guardar');
  // la hoja no pisa lo manual
  be.setCsv(`ref;price;qty2;price2\n${R_TT};77;;\n${R_RES};21;;\n`); const sy = await api('/api/prices/refresh', { method: 'POST', token: MASTER_TOKEN, body: {} });
  const after = (await pr(tJ)).items; ok(sy.j.ok && after[R_TT].p === 120 && after[R_RES].p === 21 && (sy.j.meta.manual_skipped || 0) >= 1, 'la sincronización con la hoja actualiza lo demás (R_RES 21) y NO toca lo manual (sigue 120)');
  await page.fill('[data-pr-q]', ''); await page.fill('[data-pr-q]', R_TT.slice(0, 7)); await page.waitForSelector(`[data-pr-release="${R_TT}"]`); await page.click(`[data-pr-release="${R_TT}"]`);
  await page.waitForFunction((r) => !document.querySelector(`[data-pr-release="${r}"]`), R_TT, { timeout: 5000 });
  await api('/api/prices/refresh', { method: 'POST', token: MASTER_TOKEN, body: {} }); ok((await pr(tJ)).items[R_TT].p === 77, '«Volver a la hoja» suelta la marca: la siguiente sincronización lo cambia (77)');
  // aproximado por producto
  await page.fill('[data-pr-q]', R_RES.slice(0, 6)); await page.waitForSelector(`[data-pr-row="${R_RES}"]`); await page.fill(`[data-pr-row="${R_RES}"] [data-pr-a]`, 'no'); await page.click(`[data-pr-save="${R_RES}"]`);
  await page.waitForFunction(() => /Guardado/.test((document.querySelector('[data-pr-edit-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  const ap2 = await pr(); ok(!(R_RES in ap2.items) && R_TT in ap2.items && (await pr(tJ)).items[R_RES].m !== true, '«no» en el aproximado de un producto lo deja en «Consultar» para los visitantes, sin marcarlo manual');
  await page.fill(`[data-pr-row="${R_RES}"] [data-pr-a]`, '30'); await page.click(`[data-pr-save="${R_RES}"]`); await page.waitForFunction(() => /Guardado/.test((document.querySelector('[data-pr-edit-msg]') || {}).textContent || ''), null, { timeout: 5000 });
  ok((await pr()).items[R_RES].p === 30, 'y un número es el aproximado de ese producto (30)');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : '')); await ctx.close(); }
await api('/api/prices/items/' + encodeURIComponent(R_RES), { method: 'PUT', token: tM, body: { a: null } });
be.setCsv(`ref;price;qty2;price2\n${R_TT};100;10;90\n${R_RES};20;;\n${R_BO};40;;\n`); await api('/api/prices/refresh', { method: 'POST', token: MASTER_TOKEN, body: {} });

console.log('\n5) Panel · el cliente: solo lectura, «Aplicar mis precios» y 3 presupuestos al día');
{ const { ctx, page, errs } = await newPage(); await login(page, 'ana@cliente.es', PW.ana);
  ok((await navs(page)).join(' · ') === 'Nuevo presupuesto · Mis presupuestos · Lista de precios' && (await page.locator('.side .role').textContent()).trim() === 'Cliente', `menú del cliente: ${(await navs(page)).join(' · ')}`);
  await go(page, '#lista', 'table.spec'); const lp = await page.locator('main').innerText(); ok(lp.includes('105,00') && !lp.includes('100,00') && !/VIP/.test(lp), 'Lista de precios: sus precios (105,00), sin el VIP ni el nombre de su categoría');
  ok(!(await page.locator('main').innerText()).includes('Clientes') && (await api('/api/customers', { token: tA })).status === 403, 'no ve Clientes ni puede llamar a esa API (403)');
  await go(page, '#presupuestador', 'iframe.embed-frame'); const frame = await (await page.$('iframe.embed-frame')).contentFrame(); await frame.waitForSelector('[data-apply-bar]', { timeout: 10000 });
  await frame.evaluate(([r]) => { window.TV.Quote.clear(); window.TV.Quote.add(r, 12); }, [R_TT]); await frame.waitForSelector('tr[data-ref]');
  ok(/—/.test(await frame.locator('tr[data-ref]').first().innerText()) && !/94,50/.test(await frame.locator('tr[data-ref]').first().innerText()), 'el presupuesto sale sin importes hasta pulsar «Aplicar mis precios»');
  await frame.click('[data-apply-prices]'); await frame.waitForFunction(() => /94,50/.test(document.querySelector('tr[data-ref]').innerText), null, { timeout: 5000 });
  ok(/1\.134,00|1134,00/.test(await frame.locator('.qtotal').innerText()), 'al pulsarlo salen sus precios: 12 uds. × 94,50 = 1.134,00');
  ok((await frame.locator('[name=name]').inputValue()) === 'Ana Cliente' && (await frame.locator('[name=email]').inputValue()) === 'ana@cliente.es', 'el formulario sale con su nombre y su correo');
  await frame.check('[name=privacy]'); await frame.click('[data-quote-form] button[type=submit]'); await frame.waitForSelector('[data-sent]:not([hidden]) strong', { timeout: 10000 });
  const sent = await frame.locator('[data-sent]').innerText(); const num = (sent.match(/TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?/) || [])[0];
  ok(!!num && /: 2/.test(sent), `enviado desde el panel: ${num} · «${sent.split('\n').pop().trim()}»`);
  const rec = (await api('/api/orders/' + num, { token: tJ })).j.order; ok(rec.owner === 'ana@cliente.es' && rec.priceTier === 'vip5' && line(rec, R_TT).unit === 94.5 && rec.total === 1134, 'el servidor lo valoró con su categoría y lo guardó a su nombre');
  // 2 más por el API (3 en total) y el 4.º se rechaza
  const post = (token) => api('/api/order', { method: 'POST', token, body: { customer: { name: 'Ana Cliente', email: 'ana@cliente.es', privacy: true }, lines: [{ ref: R_RES, qty: 2 }], lang: 'es', price: 1, tier: 'vip' } });
  const p2 = await post(tA), p3 = await post(tA), p4 = await post(tA);
  ok(p2.status === 200 && p3.status === 200 && p2.j.remaining === 1 && p3.j.remaining === 0, 'el 2.º y el 3.º entran (quedan 1 y 0)');
  ok(p4.status === 429 && p4.j.code === 'daily_limit', `el 4.º del día se rechaza: «${p4.j.error}»`);
  const r2 = (await api('/api/orders/' + p2.j.number, { token: tJ })).j.order; ok(line(r2, R_RES).unit === 21 && r2.priceTier === 'vip5', 'un precio o una categoría puestos en el cuerpo se ignoran (R_RES a 21)');
  const l0 = (await api('/api/order', { method: 'POST', token: tL, body: { customer: { name: 'Luis', email: 'luis@cliente.es', privacy: true }, lines: [{ ref: R_BO, qty: 1 }], lang: 'es' } })).j;
  ok(l0.ok, 'otro cliente tiene su propio cupo (Luis entra)');
  ok((await api('/api/order', { method: 'POST', token: 'x.y.z', body: { customer: { name: 'Z', email: 'z@z.es', privacy: true }, lines: [{ ref: R_BO, qty: 1 }], lang: 'es' } })).status === 401, 'una sesión caducada o falsa al enviar → 401 (no se trata como visitante)');
  // solo lectura
  await go(page, '#recibidos', 'table.spec'); const mine = await page.locator('main').innerText();
  ok(mine.includes(num) && mine.includes(p2.j.number) && !mine.includes(l0.number) && /hoy llevas\s*3/.test(mine), 'Mis presupuestos: solo los suyos (3) y el contador «hoy llevas 3»');
  ok((await page.locator('table.spec a:has-text("Reenviar")').count()) === 0, 'la lista no ofrece reenviar');
  await go(page, '#recibidos/' + num, '[data-qr-root] h1 .mono'); ok((await page.locator('a:has-text("Editar")').count()) === 0 && (await page.locator('a:has-text("Reenviar por correo")').count()) === 0 && (await page.locator('[data-qr-pdf]').count()) === 1 && !/Historial/.test(await page.locator('main').innerText()), 'el detalle no tiene Editar ni Reenviar ni historial; sí Descargar PDF');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-qr-pdf]')]); ok(/\.pdf$/.test(dl.suggestedFilename()), `y el PDF se descarga (${dl.suggestedFilename()})`);
  await go(page, '#recibidos/' + num + '/editar', '[data-qr-root] h1 .mono'); ok((await page.locator('[data-qr-edit]').count()) === 0, 'escribir la dirección de editar lleva al detalle (solo lectura)');
  const ro = await api('/api/orders/' + num, { method: 'PUT', token: tA, body: { rev: 0, lines: [{ ref: R_TT, qty: 1 }] } }), snd = await api('/api/orders/' + num + '/send', { method: 'POST', token: tA, body: { to: ['a@b.es'], pdf: 'x' } });
  ok(ro.status === 403 && snd.status === 403, `por el API: editar ${ro.status} · reenviar ${snd.status} (403)`);
  const other = await api('/api/orders/' + l0.number, { token: tA }), mineApi = (await api('/api/orders', { token: tA })).j;
  ok(other.status === 404 && mineApi.orders.length === 3 && mineApi.quota.limit === 3 && mineApi.quota.used === 3 && mineApi.orders.every((o) => !('ip' in o) && !('emailed' in o) && !('history' in o) && !('owner' in o)), 'el presupuesto de otro cliente es un 404 y lo suyo llega reducido (sin IP, correo ni historial)');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : '')); await ctx.close();
  global.ANA_NUMBER = num; global.LUIS_NUMBER = l0.number; }

console.log('\n6) Panel · el equipo ve la categoría de cada presupuesto y puede valorarlo con otra');
{ const { ctx, page, errs } = await newPage(); await login(page, 'jefa@torivac.com', PW.jefa);
  await go(page, '#recibidos/' + global.ANA_NUMBER, '[data-qr-root] h1 .mono'); const det = await page.locator('main').innerText();
  ok(/Cuenta de cliente: ana@cliente\.es/.test(det) && /Valorado con:\s*VIP \+5/.test(det), 'el detalle enseña la cuenta del cliente y «Valorado con: VIP +5»');
  await go(page, '#recibidos/' + global.ANA_NUMBER + '/editar', '[data-qr-edit]'); await page.selectOption('[data-qr-tier]', 'normal'); await page.click('[data-qr-save]'); await page.waitForSelector('[data-qr-root] h1 .tag', { timeout: 8000 });
  const ed = (await api('/api/orders/' + global.ANA_NUMBER, { token: tJ })).j.order; ok(ed.priceTier === 'normal' && line(ed, R_TT).unit === 103.5 && ed.total === 1242 && ed.rev === 1, 'editar con «Valorar con Normal» reprecia las líneas sin precio escrito (94,50 → 103,50)');
  await go(page, '#recibidos/' + global.ANON_NUMBER + '/editar', '[data-qr-edit]'); await page.selectOption('[data-qr-tier]', 'vip'); await page.click('[data-qr-save]'); await page.waitForSelector('[data-qr-root] h1 .tag', { timeout: 8000 });
  const an = (await api('/api/orders/' + global.ANON_NUMBER, { token: tJ })).j.order; ok(an.priceTier === 'vip' && line(an, R_TT).unit === 90 && line(an, R_TT).total === 1080 && an.unpriced === 0, 'un presupuesto de visitante «A consultar» se valora con la categoría elegida (VIP: 12 × 90 = 1.080)');
  // editar sin elegir categoría: lo nuevo se valora con la del presupuesto (nunca regala el VIP) y un presupuesto «A consultar» deja lo nuevo sin precio
  const cur = (await api('/api/orders/' + global.ANA_NUMBER, { token: tJ })).j.order;
  const ed2 = await api('/api/orders/' + global.ANA_NUMBER, { method: 'PUT', token: tJ, body: { rev: cur.rev, lines: [...cur.lines.map((l) => ({ ref: l.ref, qty: l.qty })), { ref: R_BO, qty: 1 }] } });
  ok(ed2.j.ok && line(ed2.j.order, R_BO).unit === 46 && line(ed2.j.order, R_TT).unit === 103.5, 'añadir una línea sin elegir categoría la valora con la del presupuesto (Normal: 40 × 1,15 = 46, no 40) y conserva el resto');
  const cq = await api('/api/order', { method: 'POST', body: { customer: { name: 'Visita Dos', email: 'visita2@x.es', privacy: true }, lines: [{ ref: R_TT, qty: 2 }], lang: 'es' } });
  const cc = (await api('/api/orders/' + cq.j.number, { token: tJ })).j.order;
  const ed3 = await api('/api/orders/' + cq.j.number, { method: 'PUT', token: tJ, body: { rev: cc.rev || 0, lines: [{ ref: R_TT, qty: 3 }, { ref: R_BO, qty: 1 }] } });
  ok(ed3.j.ok && ed3.j.order.priceTier === 'consult' && ed3.j.order.unpriced === 2 && line(ed3.j.order, R_BO).unit === null, 'en un presupuesto «A consultar», cambiar o añadir líneas sin elegir categoría las deja «A consultar»');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : '')); await ctx.close(); }

console.log('\n7) Web pública: precios aproximados y «Consultar», sin precios exactos');
{ const { ctx, page, errs } = await newPage(); await page.goto(SITE + '/tienda/index.html'); await page.waitForSelector('[data-price]:not([hidden])', { timeout: 10000 }); await page.waitForTimeout(800);
  const cards = await page.$$eval('[data-price]', (e) => e.map((x) => x.textContent.trim()));
  ok(cards.some((t) => /≈/.test(t)) && !cards.some((t) => /\b100,00\b|\b90,00\b/.test(t)), 'la tienda enseña precios con «≈» y ninguno exacto');
  ok(await page.locator('[data-approx-note]').first().isVisible(), 'con el aviso «precios aproximados, el final se confirma por presupuesto»');
  const prodPath = items[R_TT].p.es; await page.goto(SITE + prodPath + 'index.html'); await page.waitForSelector('[data-price-for]'); await page.waitForTimeout(800);
  const cell = await page.locator(`tr[data-ref="${R_TT}"] [data-price-for]`).innerText(); ok(/≈/.test(cell) && !/Desde|from|10 uds/i.test(cell), `la ficha del producto también (${cell.replace(/\s+/g, ' ')}) y sin tramos`);
  const detail = await page.evaluate(([r]) => { const Q = window.TV.Quote; Q.clear(); Q.add(r, 12); const d = Q.detail(); return { unit: d.lines[0].unit, total: d.total, unpriced: d.unpriced }; }, [R_TT]);
  ok(detail.unit === null && detail.total === 0 && detail.unpriced === 1, 'el presupuesto del visitante no valora: «A consultar»');
  await be.setPricing({ approx: { on: false, pct: 15 } }); await page.goto(SITE + '/tienda/index.html'); await page.waitForSelector('[data-price]:not([hidden])', { timeout: 10000 }); await page.waitForTimeout(800);
  ok((await page.$$eval('[data-price]', (e) => e.every((x) => /Consultar/.test(x.textContent)))) && !(await page.locator('[data-approx-note]').first().isVisible()), 'sin aproximado activado, todo es «Consultar» y no hay aviso');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : '')); await ctx.close(); }

await browser.close(); await be.stop(); fs.rmSync(DIST, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : `\n✓ precios por categoría + ${be.kind}: categorías, clientes, solo lectura, 3 al día, aproximados y precios manuales correctos`);
process.exit(fails ? 1 : 0);
