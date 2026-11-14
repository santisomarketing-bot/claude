#!/usr/bin/env node
// [QA-NEWCONTENT-PANEL] «Contenido nuevo» y el rol Revisor en un navegador de verdad (Chromium) contra el servidor PHP (php -S): el manager ve los borradores y PROPONE cambios, crea desde Usuarios a la persona
// que es comercial y traductora (Revisor), ella acepta la propuesta, aprueba el castellano (como «comercial») y después el inglés (como «traductor»), el manager descarga lo aprobado, se anota en los archivos
// (scripts/apply_newcontent.mjs) y la compilación publica SOLO lo aprobado. También: el Revisor solo ve su sección y la API le niega todo lo demás, errores de texto plano, accesibilidad (axe) y móvil.
// Solo existe en el servidor PHP (el Worker de Cloudflare no lo trae y responde 501: lo cubre workers/api/test/newcontent.test.js).
//   node scripts/qa-newcontent-panel.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startBackend } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));

const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-nc-panel-'));
execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { env: { ...process.env, TORIVAC_API: 'http://api.invalid' }, stdio: 'pipe' });
const be = await startBackend({ kind: 'php', dist: DIST });
const { SITE, API } = be;
await be.addUser({ email: 'jefa@torivac.com', name: 'Jefa Torivac', role: 'manager', password: 'Manager-Clave-2026' });
await be.addUser({ email: 'marta@taller.es', name: 'Marta Propietaria', role: 'client', password: 'Cliente-Clave-2026' });
const REV_PASS = 'Revisora-Clave-2026';

const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, locale: 'es-ES' });
await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('http://api.invalid', API) }); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
page.on('dialog', (d) => d.accept());
/** Entra en /admin/ con ese correo y contraseña y espera a que salga el menú. */
const login = async (email, pass) => { await page.goto(SITE + '/admin/index.html'); await page.fill('[name=email]', email); await page.fill('[name=pass]', pass); await page.click('button[type=submit]'); await page.waitForSelector('.side nav a'); };
/** Sale del panel. */
const logout = async () => { await page.click('[data-logout]'); await page.waitForSelector('[name=email]'); };
/** Textos del menú lateral. */
const navs = () => page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.replace(/[^\p{L} ]/gu, '').trim()));
/** Aviso emergente. */
const toast = async () => { await page.waitForTimeout(350); return page.locator('#toast').innerText(); };
/** Abre una ruta del panel (#nuevo/…) y espera a que pinte. */
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForSelector('[data-nc-root]'); await page.waitForTimeout(150); };
/** axe-core sobre la pantalla actual. */
const axe = async (label) => {
  if (!AXE) return;
  await page.mouse.move(0, 0); await page.waitForTimeout(300); await page.evaluate(fs.readFileSync(AXE, 'utf8'));
  const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
  const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(bad.length === 0, `accesibilidad (axe) en ${label}: ${bad.length} problemas graves` + (bad.length ? ' — ' + bad.map((v) => `${v.id} (${v.nodes[0].target.join(' ')})`).join('; ') : ''));
};

try {
  console.log(`panel: ${SITE}/admin/ (${be.kind})`);
  console.log('\n1) el manager ve los borradores');
  await login('jefa@torivac.com', 'Manager-Clave-2026');
  ok((await navs()).includes('Contenido nuevo'), 'el menú del manager trae «Contenido nuevo»');
  await page.click('.side nav a[href="#nuevo"]'); await page.waitForSelector('[data-nc-root]');
  const list = await page.locator('[data-nc-root]').innerText();
  ok(/a-medida/.test(list) && /oem/.test(list) && (await page.locator('[data-nc-root] .tag').allInnerTexts()).every((t) => /borrador/i.test(t)) && await page.locator('[data-nc-root] .tag').count() === 4, 'lista las dos páginas nuevas, las cuatro versiones en borrador');
  ok(await page.locator('[data-nc-export]').count() === 1, 'el manager tiene el botón para descargar lo aprobado');
  await axe('la lista de contenido nuevo');
  await go('nuevo/a-medida/es');
  const det = await page.locator('[data-nc-root]').innerText();
  ok(/Fabricación|a medida/i.test(det) && /Solo el Revisor aprueba/.test(det), 've el texto vigente y que solo el Revisor aprueba');
  ok(await page.locator('[data-nc-approve]').count() === 0, 'y no tiene botón de aprobar');
  await axe('el detalle de una versión');

  console.log('\n2) el manager propone cambios (solo texto plano, solo lo que cambia)');
  const h1 = await page.inputValue('[name=h1]');
  /** Vuelve al texto actual (el botón repinta la vista) y espera a que el formulario se haya reiniciado. */
  const resetForm = async () => { await page.click('[data-nc-reset]'); await page.waitForFunction(() => !/<b>/.test(document.querySelector('[name=lead]')?.value || '') && !/^Sin encabezado/.test(document.querySelector('[name=sections]')?.value || '')); };
  /** Texto del aviso del formulario tras enviarlo (espera a que aparezca). */
  const formMsg = async () => { await page.waitForSelector('[data-nc-msg]:not([hidden])'); return page.locator('[data-nc-msg]').innerText(); };
  await page.fill('[name=lead]', 'Entradilla con <b>etiquetas</b>'); await page.click('[data-nc-propose] [type=submit]');
  ok(/texto plano/i.test(await formMsg()), 'una etiqueta HTML se rechaza con un mensaje claro');
  await resetForm();
  await page.click('[data-nc-propose] [type=submit]');
  ok(/No has cambiado nada/.test(await formMsg()), 'sin cambios no se envía nada');
  await page.fill('[name=sections]', 'Sin encabezado'); await page.click('[data-nc-propose] [type=submit]');
  ok(/## Encabezado/.test(await formMsg()), 'las secciones sin «## Encabezado» se explican');
  await resetForm();
  await page.fill('[name=h1]', h1 + ' para tu aplicación'); await page.fill('[name=note]', 'Más concreto');
  await page.click('[data-nc-propose] [type=submit]');
  await page.waitForSelector('.nc-prop');
  ok(/Propuesta enviada/.test(await toast()) && await page.locator('.nc-prop').count() === 1, 'la propuesta queda pendiente');
  const prop = await page.locator('.nc-prop').innerText();
  ok(prop.includes(h1 + ' para tu aplicación') && /Ahora/.test(prop) && /Más concreto/.test(prop) && !/Aceptar/.test(prop), 'enseña el antes y el después, su nota y no le deja decidir al manager');

  console.log('\n3) el manager crea al Revisor desde Usuarios');
  await page.click('.side nav a[href="#usuarios"]'); await page.waitForSelector('[data-sec-new-user]');
  const roles = await page.$$eval('[data-sec-new-user] [name=role] option', (o) => o.map((x) => x.value));
  ok(roles.includes('reviewer'), 'el formulario de alta ofrece el rol Revisor');
  await page.fill('[data-sec-new-user] [name=name]', 'Marta Revisora'); await page.fill('[data-sec-new-user] [name=email]', 'marta.revisora@torivac.com');
  await page.selectOption('[data-sec-new-user] [name=role]', 'reviewer'); await page.fill('[data-sec-new-user] [name=password]', REV_PASS); await page.click('[data-sec-new-user] [type=submit]');
  await page.waitForFunction(() => /marta\.revisora@torivac\.com/.test(document.body.innerText));
  ok(/Revisor/.test(await page.locator('tr:has-text("marta.revisora@torivac.com")').innerText()), 'queda en la lista de usuarios con el rol «Revisor»');
  await logout();

  console.log('\n4) la Revisora solo ve «Contenido nuevo» y la API le niega lo demás');
  await login('marta.revisora@torivac.com', REV_PASS);
  ok((await navs()).join() === 'Contenido nuevo', `su menú es solo «Contenido nuevo» (${(await navs()).join(' · ')})`);
  ok(/revisor/i.test(await page.locator('.side .role').innerText()), 'y el rótulo dice «Revisor»');
  await page.evaluate(() => { location.hash = '#precios'; }); await page.waitForSelector('[data-nc-root]');
  ok(await page.locator('.side nav a[aria-current=page]').innerText().then((t) => /Contenido nuevo/.test(t)), 'una dirección de otra sección la devuelve a su único menú');
  const codes = await page.evaluate(async (api) => { const t = JSON.parse(sessionStorage.getItem('tv_live')).token, out = {}; for (const p of ['/api/orders', '/api/messages', '/api/users', '/api/customers', '/api/admin/data', '/api/settings/google', '/api/newcontent/export']) out[p] = (await fetch(api + p, { headers: { Authorization: 'Bearer ' + t } })).status; return out; }, API);
  ok(Object.values(codes).every((c) => c === 403), `la API le responde 403 en todo lo demás: ${JSON.stringify(codes)}`);
  ok(await page.locator('[data-nc-export]').count() === 0, 'no tiene el botón de descargar (es del manager)');

  console.log('\n5) decide la propuesta y aprueba: castellano primero, como «comercial»');
  await go('nuevo/a-medida/en');
  ok(/Primero hay que aprobar el castellano/.test(await page.locator('[data-nc-root]').innerText()) && await page.locator('[data-nc-approve]').count() === 0, 'el inglés no se puede aprobar antes que el castellano');
  await go('nuevo/a-medida/es');
  ok(await page.locator('[data-nc-decide=accept]').count() === 1, 've los botones de aceptar y descartar');
  await page.click('[data-nc-decide=accept]');
  await page.waitForFunction(() => !document.querySelector('.nc-prop [data-nc-decide]'));
  ok(/Propuesta aceptada/.test(await toast()), 'acepta la propuesta');
  ok((await page.locator('.nc-prev h3').innerText()).endsWith('para tu aplicación'), 'el texto vigente ya es el propuesto');
  ok(await page.locator('[data-nc-approve]').isDisabled(), 'el botón de aprobar espera a que confirme que leyó el texto');
  await page.check('[data-nc-ok]');
  await page.click('[data-nc-approve]');
  await page.waitForFunction(() => /Aprobada como/.test(document.body.innerText));
  const apr = await page.locator('[data-nc-root]').innerText();
  ok(/Aprobada como «comercial» por Marta Revisora el \d{4}-\d\d-\d\d/.test(apr), 'queda aprobada como «comercial», con su nombre y la fecha');
  await go('nuevo/a-medida/en');
  ok(/como traductor/i.test(await page.locator('[data-nc-approve]').innerText()), 'ahora el inglés se aprueba como «traductor»');
  await page.check('[data-nc-ok]'); await page.click('[data-nc-approve]');
  await page.waitForFunction(() => /Aprobada como «traductor»/.test(document.body.innerText));
  ok(true, 'el inglés queda aprobado como «traductor»');

  console.log('\n6) registro de cambios');
  await go('nuevo/registro');
  const reg = await page.locator('[data-nc-root] table').innerText();
  ok(/Propuso un cambio/.test(reg) && /Aceptó una propuesta/.test(reg) && (reg.match(/Aprobó la versión/g) || []).length === 2 && /jefa@torivac\.com/.test(reg) && /marta\.revisora@torivac\.com/.test(reg), 'el registro dice quién propuso, quién aceptó y quién aprobó cada idioma');
  await axe('el registro de cambios');
  await logout();

  console.log('\n7) el manager descarga lo aprobado, se anota en los archivos y la web publica solo eso');
  await login('jefa@torivac.com', 'Manager-Clave-2026');
  await go('nuevo');
  ok(((await page.locator('[data-nc-root]').innerText()).match(/aprobado/gi) || []).length >= 2, 'la lista enseña las dos versiones aprobadas');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-nc-export]')]);
  const exp = path.join(os.tmpdir(), 'nc-export-' + Date.now() + '.json'); await dl.saveAs(exp);
  const ej = JSON.parse(fs.readFileSync(exp, 'utf8'));
  ok(ej.kind === 'torivac-contenido-nuevo' && ej.pages['a-medida'].langs.es.status === 'aprobado' && ej.pages['a-medida'].langs.en.approval.role === 'traductor' && !ej.pages.oem, 'el archivo lleva solo lo que cambió: a-medida aprobada en es y en');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-nc-content-')); for (const f of fs.readdirSync(path.join(ROOT, 'data/content-new'))) fs.copyFileSync(path.join(ROOT, 'data/content-new', f), path.join(work, f));
  const out = execFileSync('node', [path.join(ROOT, 'scripts/apply_newcontent.mjs'), `--file=${exp}`, `--dir=${work}`], { stdio: 'pipe' }).toString();
  ok(/ANOTADO: 1 página/.test(out), 'scripts/apply_newcontent.mjs lo anota en una copia de data/content-new');
  const rec = JSON.parse(fs.readFileSync(path.join(work, 'a-medida.json'), 'utf8'));
  ok(rec.langs.es.approval.by === 'Marta Revisora' && rec.langs.es.approval.role === 'comercial' && rec.history.length >= 4 && rec.langs.es.h1.endsWith('para tu aplicación'), 'el archivo lleva quién aprobó, con qué función, el texto aceptado y el registro');
  const site2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-nc-site-'));
  execFileSync('node', [path.join(ROOT, 'site/build.mjs'), '--base=https://demo.torivac.example', `--out=${site2}`], { env: { ...process.env, TORIVAC_CONTENT_NEW: work, TORIVAC_API: '' }, stdio: 'pipe' });
  const es = path.join(site2, 'fabricacion-transformadores-a-medida', 'index.html'), en = path.join(site2, 'en', 'custom-transformer-manufacturing', 'index.html'), oem = path.join(site2, 'fabricacion-transformadores-oem', 'index.html');
  ok(fs.existsSync(es) && fs.existsSync(en) && !fs.existsSync(oem), 'la compilación publica la página aprobada en castellano e inglés y NO la que sigue en borrador (OEM)');
  ok(/para tu aplicación/.test(fs.readFileSync(es, 'utf8')) && !/BORRADOR/.test(fs.readFileSync(es, 'utf8')), 'con el texto aceptado y sin marca de borrador');
  await page.evaluate(async () => {}); await go('nuevo');

  console.log('\n8) móvil');
  await page.setViewportSize({ width: 390, height: 800 }); await go('nuevo/a-medida/es');
  const over = await page.evaluate(() => { const W = window.innerWidth; return [...document.querySelectorAll('#main *')].filter((e) => e.getBoundingClientRect().right > W + 1 && !e.closest('.tbl-wrap')).slice(0, 4).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)); });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'el detalle no se sale de la pantalla en móvil' + (over.length ? ' — ' + over.join('; ') : ''));
  ok(errs.length === 0, 'sin errores de consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} finally {
  await browser.close(); await be.stop();
}
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ contenido nuevo: ver, proponer, decidir, aprobar, registrar y publicar solo lo aprobado');
process.exit(fails ? 1 : 0);
