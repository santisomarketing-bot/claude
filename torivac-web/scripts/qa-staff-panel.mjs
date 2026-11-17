#!/usr/bin/env node
// [QA-STAFF-PANEL] La propietaria y el comercial (Revisor) en el panel real, en un navegador de verdad contra el backend (Worker o PHP): ven Mensajes y Presupuestos recibidos, las burbujas «nuevos» del menú,
// el comercial solo lee, y quien pidió presupuesto o escribió SIN cuenta aparece en «Solicitantes sin cuenta» y se le crea la cuenta de cliente con un clic (datos prellenados y contraseña generada).
//   node scripts/qa-staff-panel.mjs            contra el Worker torivac-api (en memoria)
//   node scripts/qa-staff-panel.mjs --php      contra el API PHP (php -S)
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

const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-staff-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const sb = { window: {}, document: { getElementById: () => null } }; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data/catalog.js'), 'utf8'), sb);
const items = sb.TV.items, pick = (pid) => Object.keys(items).find((r) => items[r].pid === pid);
const R1 = pick(884), R2 = pick(8339);
const be = await startBackend({ dist: DIST });
const { API } = be, SITE = be.SITE;
console.log(`backend: ${be.kind}`);
await be.addUser({ email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });
await be.addUser({ email: 'maria@torivac.com', name: 'María Gómez', role: 'client', password: 'Propietaria-Clave-2026' });
await be.addUser({ email: 'carlos@torivac.com', name: 'Carlos Comercial', role: 'reviewer', password: 'Comercial-Clave-2026!' });

/** POST JSON al API de pruebas (con el origen de la web) → el cuerpo de la respuesta. */
const post = (p, body) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => ({})));
const o1 = await post('/api/order', { customer: { name: 'Laura Ruiz', company: 'Talleres Ruiz S.L.', email: 'laura@talleres-ruiz.example', phone: '+34 600 111 222', privacy: true }, lines: [{ ref: R1, qty: 12 }, { ref: R2, qty: 5 }], lang: 'es' });
const o2 = await post('/api/order', { customer: { name: 'Paul Harris', company: '', email: 'paul@harris-electrical.example', privacy: true }, lines: [{ ref: R2, qty: 40 }], lang: 'en' });
await post('/api/contact', { name: 'Javier Mora', email: 'javier@mora-ingenieria.example', message: 'Necesitamos un toroidal de 300 VA con dos secundarios.', privacy: true, lang: 'es' });
await post('/api/contact', { name: 'Laura Ruiz', email: 'laura@talleres-ruiz.example', message: '¿Hacéis envíos a Portugal?', privacy: true, lang: 'es' });

const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Contexto nuevo (un navegador limpio) con la web apuntando al API de pruebas. */
const newCtx = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'es-ES' });
  await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('http://api.invalid', API) }); });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  return { ctx, page, errs };
};
/** Entra en /admin/ con ese correo y contraseña y espera a que salga el menú. */
const login = async (page, email, pass) => { await page.goto(SITE + '/admin/index.html'); await page.waitForSelector('[name=email]'); await page.fill('[name=email]', email); await page.fill('[name=pass]', pass); await page.click('button[type=submit]'); await page.waitForSelector('.side nav a'); };
/** Textos del menú sin las burbujas. */
const navs = (page) => page.$$eval('.side nav a', (a) => a.map((x) => { const c = x.cloneNode(true); c.querySelectorAll('.nb').forEach((n) => n.remove()); return c.textContent.replace(/[^\p{L} ]/gu, '').trim(); }));
/** Número de la burbuja de una sección del menú (0 si no hay). */
const bubble = async (page, k) => { const l = page.locator(`.side nav a[href="#${k}"] .nb`); return (await l.count()) ? parseInt(await l.innerText(), 10) : 0; };
/** Espera a que la burbuja tome ese valor (hay una petición por medio). */
const bubbleIs = async (page, k, n) => { await page.waitForFunction(([key, v]) => { const el = document.querySelector(`.side nav a[href="#${key}"] .nb`); return (el ? parseInt(el.textContent, 10) : 0) === v; }, [k, n], { timeout: 8000 }).catch(() => {}); return (await bubble(page, k)) === n; };

try {
  console.log('\n1) la propietaria: menú con Mensajes y burbujas de nuevos');
  const own = await newCtx(); const p = own.page;
  await login(p, 'maria@torivac.com', 'Propietaria-Clave-2026');
  ok((await navs(p)).includes('Mensajes'), `el menú de la propietaria trae «Mensajes» (${(await navs(p)).join(' · ')})`);
  ok(await bubbleIs(p, 'recibidos', 2), 'burbuja en «Presupuestos recibidos»: 2 pedidos nuevos');
  ok(await bubbleIs(p, 'mensajes', 2), 'burbuja en «Mensajes»: 2 mensajes nuevos');
  ok(/nuevos/.test(await p.locator('.side nav a[href="#mensajes"] .nb').innerText()), 'y la burbuja lleva texto para lectores de pantalla («nuevos»)');
  await p.click('.side nav a[href="#mensajes"]'); await p.waitForSelector('table.spec');
  const msgs = await p.locator('main').innerText();
  ok(/Javier Mora/.test(msgs) && /toroidal de 300 VA/.test(msgs) && /Laura Ruiz/.test(msgs), 've los dos mensajes de contacto');
  ok(!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(msgs), 'sin la IP de quien escribe');
  ok(await p.locator('[data-del-msg]').count() === 2 && await p.locator('a:has-text("Crear cliente")').count() === 2, 'puede borrar y «Crear cliente» en cada mensaje');
  ok(await bubbleIs(p, 'mensajes', 0), 'al abrir Mensajes, su burbuja desaparece');
  ok(await bubble(p, 'recibidos') === 2, 'la de Presupuestos recibidos sigue (no la ha abierto)');

  console.log('\n2) pedidos sin cuenta → crear cliente con un clic');
  await p.click('.side nav a[href="#recibidos"]'); await p.waitForSelector('table.spec');
  ok(await bubbleIs(p, 'recibidos', 0), 'al abrir Presupuestos recibidos, su burbuja desaparece');
  await p.click(`a[href="#recibidos/${encodeURIComponent(o1.number)}"]`); await p.waitForSelector('[data-qr-root] h1 span.mono');
  ok(await p.locator('a:has-text("Crear cuenta de cliente")').count() === 1, 'el detalle de un pedido sin cuenta ofrece «Crear cuenta de cliente»');
  await p.click('a:has-text("Crear cuenta de cliente")'); await p.waitForSelector('[data-cu-root]'); await p.waitForTimeout(700);
  ok(/Solicitantes sin cuenta \(3\)/.test(await p.locator('main').innerText()), 'Clientes enseña «Solicitantes sin cuenta (3)»: Laura (pedido y mensaje), Paul y Javier');
  ok(await p.locator('[data-cu-new] [name=email]').inputValue() === 'laura@talleres-ruiz.example' && await p.locator('[data-cu-new] [name=name]').inputValue() === 'Talleres Ruiz S.L.', 'el formulario viene con el correo y la empresa de quien pidió');
  const row = await p.locator('tr:has-text("laura@talleres-ruiz.example")').innerText();
  ok(/1\s+1/.test(row.replace(/\s+/g, ' ')) || /\b1\b.*\b1\b/.test(row.replace(/\s+/g, ' ')), 'y su fila cuenta 1 pedido y 1 mensaje');
  await p.click('[data-cu-gen]');
  const pw = await p.locator('[data-cu-new] [name=password]').inputValue();
  ok(pw.length === 16 && /^[A-Za-z2-9]+$/.test(pw) && (await p.locator('[data-cu-new] [name=password]').getAttribute('type')) === 'text', `«Generar una segura» pone una contraseña de 16 caracteres a la vista (${pw.length})`);
  await p.selectOption('[data-cu-new] [name=tier]', 'vip5'); await p.click('[data-cu-new] button[type=submit]');
  await p.waitForSelector('tr:has-text("laura@talleres-ruiz.example") select[data-cu-tier]');
  ok(!/Solicitantes sin cuenta \(3\)/.test(await p.locator('main').innerText()) && /Solicitantes sin cuenta \(2\)/.test(await p.locator('main').innerText()), 'la cuenta queda creada y Laura sale de los solicitantes (quedan 2)');
  const c = await newCtx(); await login(c.page, 'laura@talleres-ruiz.example', pw);
  ok((await navs(c.page)).join() === 'Nuevo presupuesto,Mis presupuestos,Lista de precios', 'Laura entra con la contraseña generada y ve el menú de cliente (sin burbujas)');
  ok(await c.page.locator('.side nav .nb').count() === 0, 'un cliente con cuenta no tiene burbujas');
  await c.ctx.close();
  // una persona que escribe desde Mensajes también se puede convertir en cliente
  await p.click('.side nav a[href="#mensajes"]'); await p.waitForSelector('table.spec');
  await p.click('tr:has-text("Javier Mora") a:has-text("Crear cliente")'); await p.waitForSelector('[data-cu-new]'); await p.waitForTimeout(500);
  ok(await p.locator('[data-cu-new] [name=email]').inputValue() === 'javier@mora-ingenieria.example', 'desde un mensaje, «Crear cliente» lleva su correo al formulario');

  console.log('\n3) llega un mensaje nuevo: la burbuja sube al volver a entrar');
  await post('/api/contact', { name: 'Anna Keller', email: 'anna@keller-elektro.example', message: 'Guten Tag, wir suchen einen Spartransformator.', privacy: true, lang: 'de' });
  await own.page.evaluate(() => sessionStorage.removeItem('tv_live')); await login(own.page, 'maria@torivac.com', 'Propietaria-Clave-2026');
  ok(await bubbleIs(own.page, 'mensajes', 1), 'tras entrar de nuevo, «Mensajes» marca 1 (solo el último, lo anterior ya está visto)');
  ok(await bubble(own.page, 'recibidos') === 0, 'y Presupuestos recibidos, 0');

  console.log('\n4) el comercial: lee presupuestos y mensajes, no edita ni borra');
  const com = await newCtx(); const q = com.page;
  await login(q, 'carlos@torivac.com', 'Comercial-Clave-2026!');
  ok((await navs(q)).join() === 'Presupuestos recibidos,Mensajes,Contenido nuevo', `su menú: presupuestos recibidos, mensajes y contenido nuevo (${(await navs(q)).join(' · ')})`);
  ok(/comercial/i.test(await q.locator('.side .role').innerText()), 'el rótulo dice «Comercial · Revisor»');
  ok(await bubbleIs(q, 'recibidos', 2) && await bubbleIs(q, 'mensajes', 3), 'burbujas: 2 pedidos y 3 mensajes nuevos');
  await q.click('.side nav a[href="#recibidos"]'); await q.waitForSelector('table.spec');
  ok(await q.locator('a:has-text("Reenviar")').count() === 0, 'en la lista no hay «Reenviar»');
  await q.click(`a[href="#recibidos/${encodeURIComponent(o2.number)}"]`); await q.waitForSelector('[data-qr-root] h1 span.mono');
  ok(await q.locator('a:has-text("Editar")').count() === 0 && await q.locator('a:has-text("Reenviar por correo")').count() === 0 && await q.locator('a:has-text("Crear cuenta")').count() === 0, 'en el detalle no hay Editar, Reenviar ni Crear cuenta');
  ok(await q.locator('[data-qr-pdf]').count() === 1, 'pero sí «Descargar PDF»');
  await q.evaluate(() => { location.hash = '#recibidos/' + location.hash.split('/')[1] + '/editar'; }); await q.waitForTimeout(600);
  ok(await q.locator('[data-qr-edit]').count() === 0, 'ni siquiera abriendo la dirección de editar');
  await q.click('.side nav a[href="#mensajes"]'); await q.waitForSelector('table.spec');
  ok(await q.locator('[data-del-msg]').count() === 0 && await q.locator('a:has-text("Crear cliente")').count() === 0, 'en Mensajes no hay Borrar ni Crear cliente');
  const st = await q.evaluate(async (api) => { const t = JSON.parse(sessionStorage.getItem('tv_live')).token, h = { Authorization: 'Bearer ' + t }; return [(await fetch(api + '/api/customers', { headers: h })).status, (await fetch(api + '/api/prices/items/R100', { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: '{}' })).status, (await fetch(api + '/api/users', { headers: h })).status]; }, API);
  ok(st.every((x) => x === 403), `la API le niega clientes, precios y usuarios: ${st.join(', ')}`);
  await com.ctx.close();

  console.log('\n5) el manager también ve las burbujas');
  const mg = await newCtx(); await login(mg.page, 'jefa@torivac.com', 'Manager-Clave-2026');
  ok(await bubbleIs(mg.page, 'recibidos', 2) && await bubbleIs(mg.page, 'mensajes', 3), 'manager: 2 pedidos y 3 mensajes nuevos');
  await mg.page.click('.side nav a[href="#mensajes"]'); await mg.page.waitForSelector('table.spec');
  ok(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|127\.0\.0\.1|::1/.test(await mg.page.evaluate(async (api) => { const t = JSON.parse(sessionStorage.getItem('tv_live')).token; return JSON.stringify((await (await fetch(api + '/api/messages', { headers: { Authorization: 'Bearer ' + t } })).json()).items[0]); }, API)), 'el manager sigue viendo la IP en la respuesta de la API');
  await mg.ctx.close();
  ok(own.errs.length === 0, 'sin errores de consola' + (own.errs.length ? ': ' + own.errs.slice(0, 3).join(' | ') : ''));
  await own.ctx.close();
} finally { await browser.close(); await be.stop(); }
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ propietaria y comercial: mensajes, presupuestos, burbujas de nuevos y cuentas de cliente desde los solicitantes');
process.exit(fails ? 1 : 0);
