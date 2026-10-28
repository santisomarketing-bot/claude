#!/usr/bin/env node
// [QA-ADMIN-LIVE] Sesión 7 · Panel REAL (admin-live.js) contra el backend real (sin red, correo ni IA reales).
//   node scripts/qa-admin-live.mjs            contra el Worker torivac-api (en memoria)
//   node scripts/qa-admin-live.mjs --php      contra el API PHP de cPanel (php -S) · ver scripts/lib/backends.mjs
// Comprueba: login (error y acierto), menús por rol, pedidos (manager ve todos, cliente solo los suyos), precios (estado, subida con vista previa y aplicar,
// sincronización manual), instrucción por IA (propone → vista previa → confirmar cambios grandes → aplicar), usuarios (alta/baja), propuestas persistentes,
// que un cliente NO puede llamar a la API de un manager (403) aunque lo intente desde la consola, las propuestas editables (editar, probar en la página real, aplicar, descartar y descargar), los mensajes de contacto (ver, estado del aviso, borrar), el panel de Correo (prueba
// y fallo explicado) y el bloqueo de una hora tras 5 contraseñas erróneas.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBackend, MASTER_TOKEN } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// el sitio se compila con TORIVAC_API (valor provisional) para que /admin/ cargue el panel real; la URL verdadera se inyecta al servir
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-live-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const sb = { window: {}, document: { getElementById: () => null } }; sb.window = sb; vm.createContext(sb);   // catalog.js lee el bloque JSON de arranque con document.getElementById (aquí no hay página: sin bloque)
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
await be.addUser({ email: 'bloqueo@cliente.es', name: 'Cliente Bloqueo', role: 'client', password: 'Cliente-Clave-2026' });          // solo para la prueba de fuerza bruta (la última: bloquea a este visitante con esta cuenta)

const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Abre un contexto (1440×900) con el catálogo apuntando al API de pruebas; devuelve { ctx, page, errs } (errs = errores de JS). */
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('http://api.invalid', API) }); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|Blocked script execution/.test(m.text())) errs.push(m.text()); });          // «Blocked script execution»: el marco de la vista previa de Propuestas no ejecuta scripts a propósito (sandbox)
  return { ctx, page, errs };
};
/** Abre /admin/ y envía el formulario de acceso con el correo y la contraseña dados (no espera al resultado). */
const login = async (page, email, pass) => { await page.goto(SITE + '/admin/index.html'); await page.fill('[name=email]', email); await page.fill('[name=pass]', pass); await page.click('button[type=submit]'); };
/** Textos de los enlaces del menú lateral del panel. */
const navs = (page) => page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.trim()));
/** Texto del aviso emergente (#toast), leído tras una pausa corta para que aparezca. */
const toastText = async (page) => { await page.waitForTimeout(250); return page.locator('#toast').innerText(); };

// ───────────────────────────────────── pedido de prueba hecho desde la web (público) por Marta
be.setMailDown(true);                                                      // este pedido se hace con Resend rechazando los envíos: el panel debe marcarlo
const order = await fetch(API + '/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ customer: { name: 'Marta Taller', company: 'Taller S.L.', email: 'marta@taller.es', privacy: true }, lines: [{ ref: R_TT, qty: 12 }, { ref: R_BO, qty: 200 }], lang: 'es' }) }).then((r) => r.json());
be.setMailDown(false);

console.log('\n1) acceso');
{ const { ctx, page, errs } = await newPage();
  await login(page, 'jefa@torivac.com', 'mala-clave-1234');
  await page.waitForSelector('[data-err]:not([hidden])', { timeout: 5000 });
  ok(/incorrect/i.test(await page.locator('[data-err]').innerText()), 'contraseña errónea → mensaje del servidor');
  await page.fill('[name=pass]', 'Manager-Clave-2026'); await page.click('button[type=submit]');
  await page.waitForSelector('.side nav a');
  ok((await navs(page)).length === 11 && (await navs(page)).some((n) => /Blog/.test(n)) && (await navs(page)).some((n) => /Actividad/.test(n)), `manager: ${(await navs(page)).join(' · ')}`);
  await page.waitForFunction(() => document.querySelectorAll('.kpi').length === 4, null, { timeout: 5000 }).catch(() => {});      // los indicadores se pintan al llegar los pedidos
  ok(await page.locator('.kpi').count() === 4, 'Resumen con 4 indicadores');
  ok(/1/.test(await page.locator('.kpi').first().innerText()), 'cuenta el pedido hecho desde la web');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close(); }

console.log('\n2) pedidos: el manager ve todos, cada cliente solo los suyos');
{ const m = await newPage(); await login(m.page, 'jefa@torivac.com', 'Manager-Clave-2026'); await m.page.click('.side nav a[href="#pedidos"]'); await m.page.waitForSelector('table.spec');
  ok((await m.page.locator('table.spec tbody tr').count()) === 1 && /Marta Taller/.test(await m.page.locator('table.spec tbody').innerText()), `manager ve el pedido ${order.number}`);
  ok(/sin aviso por correo/i.test(await m.page.locator('table.spec tbody').innerText()), 'el manager ve la marca «sin aviso por correo» (el correo no salió)');
  const [dl] = await Promise.all([m.page.waitForEvent('download'), m.page.click('[data-pdf]')]); ok(/\.pdf$/.test(dl.suggestedFilename()), `PDF regenerado (${dl.suggestedFilename()})`);
  await m.ctx.close();
  const c = await newPage(); await login(c.page, 'marta@taller.es', 'Cliente-Clave-2026'); await c.page.waitForSelector('.side nav a');
  ok((await navs(c.page)).length === 4 && !(await navs(c.page)).some((n) => /Usuarios|Precios$|Blog/.test(n)), `cliente: ${(await navs(c.page)).join(' · ')}`);
  await c.page.click('.side nav a[href="#mis"]'); await c.page.waitForSelector('table.spec');
  ok((await c.page.locator('table.spec tbody tr').count()) === 1 && !/sin aviso por correo/i.test(await c.page.locator('table.spec tbody').innerText()), 'Marta ve su pedido (sin la marca interna)');
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
  ok(/no vienen en la hoja y se conservan/.test(prev) && (await page.locator('[data-force]').count()) === 0, 'por defecto actualiza solo lo que trae la hoja: el resto se conserva y no hace falta confirmar nada');
  await page.click('[data-apply-upload]'); await page.waitForTimeout(600);
  const pub = await fetch(API + '/api/prices').then((r) => r.json());
  ok(pub.prices.items[R_TT].p === 99.99 && JSON.stringify(pub.prices.items[R_TT].t) === '[[10,95]]', 'precio publicado en el servidor (99,99 con tramo 10 uds = 95)');
  ok(Object.keys(pub.prices.items).length === Object.keys(prices.items).length, `y las demás referencias siguen con su precio (${Object.keys(pub.prices.items).length})`);
  await page.click('[data-refresh]'); await page.waitForTimeout(700);
  const syn = (await fetch(API + '/api/prices', { headers: { Authorization: 'Bearer ' + MASTER_TOKEN } }).then((r) => r.json()));      // el detalle (quién y de dónde) solo lo ve un manager
  ok(syn.prices.items[R_TT].p === 88.5 && syn.meta.reason.startsWith('manual:') && syn.meta.mode === 'merge' && Object.keys(syn.prices.items).length === Object.keys(prices.items).length, 'botón «Actualizar ahora»: vuelve a leer la hoja de Drive (precio 88,5) y actualiza solo esas 4 referencias');
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

console.log('\n5) usuarios y salir');
{ const { ctx, page } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026');
  await page.click('.side nav a[href="#usuarios"]'); await page.waitForSelector('[data-sec-new-user]');
  ok((await page.locator('table.spec tbody tr').count()) === 4, '4 usuarios');
  await page.fill('[data-sec-new-user] [name=name]', 'Nuevo Cliente'); await page.fill('[data-sec-new-user] [name=email]', 'nuevo@cliente.es'); await page.fill('[data-sec-new-user] [name=password]', 'Clave-Nueva-2026'); await page.click('[data-sec-new-user] button[type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('table.spec tbody tr').length === 5);
  ok(true, 'usuario creado (5)');
  const ok2 = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nuevo@cliente.es', password: 'Clave-Nueva-2026' }) }).then((r) => r.json());
  ok(ok2.ok === true && ok2.user.role === 'client', 'el usuario nuevo puede entrar como cliente');
  page.once('dialog', (d) => d.accept()); await page.click('[data-sec-del-user="nuevo@cliente.es"]'); await page.waitForFunction(() => document.querySelectorAll('table.spec tbody tr').length === 4);
  ok(true, 'usuario borrado (4)');
  await page.click('.side nav a[href="#actividad"]'); await page.waitForSelector('#main h1:has-text("Actividad")');
  if (be.kind === 'php') { await page.waitForSelector('[data-sec-rows] tr'); ok(/Entró al panel/.test(await page.locator('[data-sec-rows]').innerText()) && /Usuario creado/.test(await page.locator('[data-sec-rows]').innerText()), 'Actividad (servidor PHP): se ve quién entró y quién creó el usuario'); }
  else ok(/solo está disponible con el servidor PHP/.test(await page.locator('#main .notice').innerText()), 'Actividad (Worker de Cloudflare): lo dice con claridad en vez de romperse');
  await page.click('.side nav a[href="#ajustes"]'); await page.waitForSelector('[data-mail-test-form]');
  ok(be.kind === 'php' ? (await page.locator('[data-sec-account]').count()) === 1 && (await page.locator('[data-sec-mode=backups]').count()) === 1 : (await page.locator('[data-sec-account]').count()) === 0 && (await page.locator('[data-sec-mode=backups]').count()) === 0, be.kind === 'php' ? 'Ajustes (servidor PHP): salen «Tu cuenta y tu seguridad» y las copias' : 'Ajustes (Worker): no salen paneles que el Worker no tiene');
  await page.click('[data-logout]'); await page.waitForSelector('[data-login]'); ok(true, 'salir devuelve al acceso');
  await ctx.close(); }

console.log('\n6) mensajes de contacto: el panel los muestra aunque el correo falle, con su estado, y se pueden borrar');
{ const post = (over) => fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ name: 'Pedro Contacto', email: 'pedro@example.com', message: 'Necesito un transformador de 50 VA.', privacy: true, lang: 'es', _e: 9000, ...over }) }).then((r) => r.json());
  const a = await post({ message: 'Primer mensaje: aviso correcto.' });
  be.setMailDown(true); const b = await post({ name: 'Eva Segunda', email: 'eva@example.com', message: 'Segundo mensaje: el correo estaba caído.' }); be.setMailDown(false);
  ok(a.ok && a.emailed.sent === true && b.ok && b.emailed.sent === false, `la API guarda los dos y dice si el aviso salió (${a.emailed && a.emailed.sent}/${b.emailed && b.emailed.sent})`);
  const { ctx, page } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026');
  await page.click('.side nav a[href="#mensajes"]'); await page.waitForSelector('table.spec');
  const txt = await page.locator('table.spec tbody').innerText();
  ok((await page.locator('table.spec tbody tr').count()) === 2 && /Primer mensaje/.test(txt) && /Segundo mensaje/.test(txt), 'Mensajes: los dos, el más reciente primero');
  ok(/Avisado por correo/i.test(txt) && /El aviso por correo falló/i.test(txt) && /dominio sin verificar/.test(txt), 'cada uno con el estado de su aviso por correo (y el motivo del fallo)' + (/Avisado por correo/i.test(txt) && /El aviso por correo falló/i.test(txt) && /dominio sin verificar/.test(txt) ? '' : ' — «' + txt.replace(/\s+/g, ' ').slice(0, 400) + '»'));
  ok(/Eva Segunda/.test(await page.locator('table.spec tbody tr').first().innerText()), 'el más reciente va arriba');
  page.once('dialog', (d) => d.accept()); await page.click(`[data-del-msg="${b.id}"]`); await page.waitForFunction(() => document.querySelectorAll('table.spec tbody tr').length === 1);
  ok(!/Segundo mensaje/.test(await page.locator('table.spec tbody').innerText()), 'borrar uno lo quita (y solo ese)');
  const cl = await newPage(); await login(cl.page, 'marta@taller.es', 'Cliente-Clave-2026'); await cl.page.waitForSelector('.side nav a');
  const ctok = JSON.parse(await cl.page.evaluate(() => sessionStorage.getItem('tv_live'))).token;
  const cst = await cl.page.evaluate(async ([ap, t]) => ({ list: (await fetch(ap + '/api/messages', { headers: { Authorization: 'Bearer ' + t } })).status, del: (await fetch(ap + '/api/messages/x', { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } })).status, test: (await fetch(ap + '/api/mail/test', { method: 'POST', headers: { Authorization: 'Bearer ' + t } })).status, mail: (await fetch(ap + '/api/mail/status', { headers: { Authorization: 'Bearer ' + t } })).status }), [API, ctok]);
  ok(cst.list === 403 && cst.del === 403 && cst.test === 403 && cst.mail === 403, `un cliente no ve mensajes ni toca el correo: ${JSON.stringify(cst)}`);
  const anon = await fetch(API + '/api/messages', { headers: { Origin: SITE } }); ok(anon.status === 401, `sin sesión → ${anon.status}`);
  await cl.ctx.close(); await ctx.close(); }

console.log('\n7) correo: el panel dice cómo está, manda una prueba y, si falla, explica por qué');
{ const { ctx, page } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026');
  await page.click('.side nav a[href="#ajustes"]'); await page.waitForSelector('[data-mail-test-form]');
  const panel = await page.locator('main').innerText();
  ok(/Controlador:\s*resend/i.test(panel) && /completo/i.test(panel), 'Ajustes → Correo: controlador y si está completo' + (/Controlador:\s*resend/i.test(panel) && /completo/i.test(panel) ? '' : ' — «' + panel.replace(/\s+/g, ' ').slice(0, 400) + '»'));
  be.mails.length = 0;
  await page.click('[data-mail-test-form] button[type=submit]'); await page.waitForFunction(() => /Enviado a|No se envió/.test(document.querySelector('[data-mail-result]').textContent), null, { timeout: 8000 });
  ok(/Enviado a/.test(await page.locator('[data-mail-result]').innerText()) && be.mails.length === 1 && /prueba/i.test(be.mails[0].subject || ''), `correo de prueba enviado a los destinatarios del pedido: «${(await page.locator('[data-mail-result]').innerText()).slice(0, 70)}»`);
  be.setMailDown(true);
  await page.click('[data-mail-test-form] button[type=submit]'); await page.waitForFunction(() => /No se envió/.test(document.querySelector('[data-mail-result]').textContent), null, { timeout: 8000 });
  ok(/dominio sin verificar/.test(await page.locator('[data-mail-result]').innerText()), `si falla, el motivo exacto: «${(await page.locator('[data-mail-result]').innerText()).slice(0, 90)}»`);
  await page.click('.side nav a[href="#resumen"]'); await page.waitForSelector('.kpi');
  ok(/El correo no está funcionando/.test(await page.locator('main').innerText()), 'el Resumen avisa de que el correo no funciona');
  const health = await fetch(API + '/api/health', { headers: { Origin: SITE } }).then((r) => r.json());
  ok(health.mail && health.mail.driver === 'resend' && health.mail.configured === true && health.mail.last && health.mail.last.ok === false && !('error' in health.mail.last), `/api/health (público) cuenta el estado del correo sin revelar el error: ${JSON.stringify(health.mail)}`);
  be.setMailDown(false); await ctx.close(); }

console.log('\n8) fuerza bruta: 5 contraseñas erróneas bloquean ese acceso durante una hora (aunque la siguiente sea la buena)');
{ const login1 = (password) => fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ email: 'bloqueo@cliente.es', password }) }).then(async (r) => ({ status: r.status, retry: r.headers.get('retry-after'), body: await r.json().catch(() => ({})) }));
  const seen = []; for (let i = 0; i < 5; i++) seen.push((await login1('mala-clave-' + i)).status);
  ok(seen.slice(0, 4).every((c) => c === 401), `los 4 primeros fallos: 401 (${seen.join(', ')})`);
  const good = await login1('Cliente-Clave-2026');
  ok(good.status === 429 && /una hora/i.test(good.body.error || '') && Number(good.retry) > 3500 && Number(good.retry) <= 3600 && good.body.retry_after === Number(good.retry), `con la contraseña BUENA tras 5 fallos: ${good.status}, «${good.body.error}», espera ${good.retry} s`);
  const { ctx, page } = await newPage(); await login(page, 'bloqueo@cliente.es', 'Cliente-Clave-2026'); await page.waitForSelector('[data-err]:not([hidden])', { timeout: 5000 });
  ok(/una hora/i.test(await page.locator('[data-err]').innerText()) && (await page.locator('.side nav a').count()) === 0, `el panel lo muestra: «${await page.locator('[data-err]').innerText()}»`);
  const other = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ email: 'marta@taller.es', password: 'Cliente-Clave-2026' }) }).then((r) => r.status);
  ok(other === 200, `otra cuenta del mismo visitante sigue entrando (${other})`);
  await ctx.close(); }

console.log('\n9) propuestas editables: escribir tu versión, probarla en la página real, aplicarla y descargar lo aprobado');
{ const { ctx, page, errs } = await newPage(); await login(page, 'jefa@torivac.com', 'Manager-Clave-2026');
  await page.click('.side nav a[href="#propuestas"]'); await page.waitForSelector('details.prop');
  const total = await page.locator('details.prop').count();
  ok(total > 100, `la vista lista las propuestas pendientes (${total})`);
  /** Busca una propuesta por texto (la búsqueda se confirma con Intro) y la deja abierta; devuelve su tarjeta. */
  const open = async (q) => { await page.fill('[data-pa-q]', q); await page.press('[data-pa-q]', 'Enter'); await page.waitForFunction((n) => document.querySelectorAll('details.prop').length === n, 1, { timeout: 5000 }); const card = page.locator('details.prop').first(); await card.locator('summary').click(); return card; };
  /** Vacía la búsqueda y la confirma (para volver a ver todas las del estado elegido). */
  const clearQ = async () => { await page.fill('[data-pa-q]', ''); await page.press('[data-pa-q]', 'Enter'); };
  // a) sustituir un párrafo del aviso legal: traer el párrafo, cambiarlo, probarlo y aplicarlo
  let card = await open('PR-57830');
  ok((await card.locator('[name=find]').inputValue()).startsWith('preferencias de navegación u publicitarias'), 'el trozo a sustituir sale de lo que la propuesta cita');
  ok((await card.locator('input[type=radio]:checked').getAttribute('value')) === 'replace', 'por defecto: sustituir el párrafo');
  await card.locator('[data-pa=load]').click(); await page.waitForFunction(() => /perfiles demogr/.test(document.querySelector('details.prop[open] [name=text]').value), null, { timeout: 8000 });
  const par = await card.locator('[name=text]').inputValue();
  ok(par.length > 80 && /preferencias de navegación u publicitarias/.test(par), `«Traer el párrafo de la web» pone el párrafo entero para editarlo (${par.length} caracteres)`);
  const fixed = par.replace('navegación u publicitarias', 'navegación o publicitarias');
  await card.locator('[name=text]').fill(fixed);
  await card.locator('[data-pa=try]').click(); await page.waitForFunction(() => /Así quedaría el párrafo/.test(document.querySelector('details.prop[open] [data-try-msg]').textContent), null, { timeout: 8000 });
  const fr = card.locator('iframe.tryframe'); const inner = await (await fr.elementHandle()).contentFrame();
  const hl = await inner.evaluate(() => { const e = document.querySelector('[data-tv-try]'); return e ? e.textContent : null; });
  ok(hl && /navegación o publicitarias/.test(hl) && !/navegación u publicitarias/.test(hl), 'la vista previa enseña la página real con el párrafo cambiado y resaltado');
  const live = await fetch(SITE + '/aviso-legal-2/index.html').then((r) => r.text());
  ok(/navegación u publicitarias/.test(live) && !/navegación o publicitarias/.test(live), 'y la web de verdad NO ha cambiado');
  await card.locator('button[type=submit]').click(); await page.waitForFunction((n) => document.querySelectorAll('details.prop').length < n, 1, { timeout: 5000 }).catch(() => {});
  ok(/Aprobada con tu texto/.test(await toastText(page)), 'Aplicar guarda la propuesta aprobada con tu texto');
  // b) persiste en el servidor
  await page.reload(); await page.waitForSelector('[data-pa-list]');
  await page.click('[data-pa=status][data-v=ok]'); await page.waitForSelector('details.prop');
  card = page.locator('details.prop').first(); await card.locator('summary').click();
  ok((await page.locator('details.prop').count()) === 1 && /aprobada con tu versión/i.test(await card.locator('summary').innerText()) && (await card.locator('[name=text]').inputValue()) === fixed, 'tras recargar sigue aprobada y con SU texto (guardado en el servidor)');
  // c) lo descargado se puede aplicar a la web
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-pa=export]')]);
  const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(exp.kind === 'torivac-propuestas-aprobadas' && exp.approved.length === 1 && exp.approved[0].id === 'PR-57830' && exp.approved[0].mode === 'replace' && exp.approved[0].text === fixed && exp.approved[0].targets.some((t) => t.path === '/aviso-legal-2/'), 'Descargar aprobadas: JSON con el texto, el modo y la página destino');
  const expFile = path.join(os.tmpdir(), 'tv-aprobadas-' + process.pid + '.json'); fs.writeFileSync(expFile, JSON.stringify(exp));
  const cli = spawnSync('node', [path.join(ROOT, 'scripts/apply_proposals.mjs'), `--file=${expFile}`, '--dry'], { encoding: 'utf8' });
  ok(cli.status === 0 && /✓ PR-57830/.test(cli.stdout), `scripts/apply_proposals.mjs lo acepta: ${(cli.stdout || cli.stderr).split('\n').find((l) => /PR-57830/.test(l)) || (cli.stderr || '').slice(0, 120)}`);
  fs.rmSync(expFile, { force: true });
  // d) texto no válido: el servidor lo rechaza y la tarjeta lo dice junto al campo
  await page.click('[data-pa=status][data-v=all]'); await clearQ(); await page.waitForSelector('details.prop');
  card = await open('PR-57830');
  await card.locator('[name=text]').fill('Esto lleva <script>alert(1)</script> dentro');
  await card.locator('button[type=submit]').click(); await page.waitForFunction(() => /Escribe solo texto/.test(document.querySelector('details.prop[open] [data-msg]').textContent), null, { timeout: 5000 });
  ok((await card.locator('[name=text]').getAttribute('aria-invalid')) === 'true', 'un texto con código se rechaza con aviso junto al campo');
  await card.locator('[name=text]').fill(fixed);
  // e) deshacer
  await card.locator('[data-pa=undo]').click(); await page.waitForFunction(() => !/aprobada con tu versión/i.test(document.querySelector('details.prop[open] summary').textContent), null, { timeout: 5000 });
  ok(Object.keys((await fetch(API + '/api/proposals/state', { headers: { Authorization: 'Bearer ' + MASTER_TOKEN } }).then((r) => r.json())).state).length === 0, 'Deshacer deja el servidor como estaba');
  // f) traducción que falta: se prueba en la ficha, con el aviso de «traducción pendiente» fuera
  await page.click('[data-pa=status][data-v=pending]'); await clearQ(); await page.waitForSelector('details.prop');
  card = await open('PR-14427');
  ok((await card.locator('[name=text]').inputValue()) === '' && /Traducción/.test(await card.locator('[data-lbl]').innerText()), 'una traducción que falta empieza vacía (nunca se traduce sola) y pide la traducción');
  await card.locator('[name=text]').fill('Single-phase voltage stabiliser, BAVS series.\n\nSecond paragraph of the translation.');
  await card.locator('[data-pa=try]').click(); await page.waitForFunction(() => /Así se vería la descripción/.test(document.querySelector('details.prop[open] [data-try-msg]').textContent), null, { timeout: 8000 });
  const inner2 = await (await card.locator('iframe.tryframe').elementHandle()).contentFrame();
  const desc = await inner2.evaluate(() => { const d = document.querySelector('.pdp-desc'); return d ? d.textContent.trim() : null; });
  ok(desc && /Single-phase voltage stabiliser/.test(desc) && /Second paragraph/.test(desc), 'la ficha en inglés enseña tu traducción');
  await card.locator('button[type=submit]').click(); await page.waitForTimeout(500);
  // g) descartar con una nota
  card = await open('PR-14528');
  await card.locator('[name=note]').fill('Lo traduce la agencia');
  await card.locator('[data-pa=discard]').click(); await page.waitForTimeout(500);
  await page.click('[data-pa=status][data-v=no]'); await clearQ(); await page.waitForSelector('details.prop');
  ok((await page.locator('details.prop').count()) === 1 && /descartada/i.test(await page.locator('details.prop').first().innerText()), 'Descartar la manda a «Descartadas»');
  const st = (await fetch(API + '/api/proposals/state', { headers: { Authorization: 'Bearer ' + MASTER_TOKEN } }).then((r) => r.json())).state;
  ok(st['PR-14528'] && st['PR-14528'].state === 'no' && st['PR-14528'].note === 'Lo traduce la agencia' && st['PR-14427'] && st['PR-14427'].mode === 'translate' && /Second paragraph/.test(st['PR-14427'].text), 'el servidor guarda la nota del descarte y la traducción aprobada');
  // h) título SEO: sale con los cuatro idiomas y se ve como en una búsqueda
  await page.click('[data-pa=status][data-v=pending]'); await clearQ(); await page.waitForSelector('details.prop');
  card = await open('PR-94529');
  const lines = (await card.locator('[name=text]').inputValue()).split('\n');
  ok(lines.length === 4 && lines.every((l, i) => l.startsWith(['es', 'en', 'fr', 'de'][i] + ': ')), 'el título de la portada sale con una línea por idioma: ' + lines.map((l) => l.slice(0, 18)).join(' | '));
  await card.locator('[data-pa=try]').click(); await page.waitForSelector('details.prop[open] .serp:not([hidden])', { timeout: 8000 });
  ok(/Torivac/.test(await card.locator('.serp-title').innerText()) && (await card.locator('.serp-url').innerText()).startsWith('http'), 'se dibuja como resultado de búsqueda');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close(); }

await browser.close(); await be.stop(); fs.rmSync(DIST, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : `\n✓ panel real + ${be.kind}: acceso, roles, pedidos, precios, IA, usuarios y propuestas correctos`);
process.exit(fails ? 1 : 0);
