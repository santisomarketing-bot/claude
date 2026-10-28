#!/usr/bin/env node
// [QA-SECURITY-PANEL] El acceso en dos pasos y la seguridad del panel, en un navegador de verdad (Chromium) sobre el paquete desplegado en un Apache real con PHP-FPM y el correo guardado en una carpeta
// (controlador «file»: el código llega a <datos>/outbox y la prueba lo lee de ahí, como lo leería una persona de su bandeja):
//   1) la dueña (cuenta de confianza) entra solo con la contraseña · 2) un manager normal recibe un código, lo escribe (con un fallo antes), marca «recordar este dispositivo» y entra
//   3) en ese navegador no se lo vuelve a pedir · 4) en otro navegador sí; «Volver», reenviar el código (con la espera) y el código viejo deja de valer
//   5) cinco códigos erróneos bloquean, y otro manager desbloquea desde Usuarios · 6) Usuarios: la casilla «código por correo», alta, baja y contraseña nueva
//   7) ataques repetidos: tres visitantes distintos bloquean a una cuenta → UN aviso por correo y código en dispositivos nuevos; los bloqueos sueltos no avisan; «Desbloquear» lo quita
//   8) Actividad: filtros, marcas de aviso, descarga CSV sin fórmulas · 9) Ajustes: tu cuenta, olvidar dispositivos, copias de seguridad (crear, descargar, restaurable, borrar), cambiar la contraseña
//   10) el interruptor de emergencia (two_step.enabled = false) y el correo sin completar (no se pide código a nadie) · 11) clientes: sin Usuarios ni Actividad · 12) móvil: sin desbordes
// Con axe-core (accesibilidad) sobre la pantalla del código, Usuarios, Actividad y Ajustes. Necesita apache2, php-fpm y Playwright (npm i --no-save playwright); si falta Apache, avisa y sale sin fallo.
//   node scripts/qa-security-panel.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { apacheAvailable } from './lib/apache.mjs';
import { deployPackage, MANAGER_PASS } from './lib/pkg-apache.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const why = apacheAvailable();
if (why) { console.log(`(se omite: ${why})`); process.exit(0); }
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));

let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const OWNER = 'jefa@torivac.com', OWNER_PASS = MANAGER_PASS;                    // la dueña de la web: cuenta de confianza
const PARTNER = 'socio@torivac.com', PARTNER_PASS = 'Tornillo-Verde-2026!';      // otro manager: pide código
const CLIENT = 'cliente@empresa.com', CLIENT_PASS = 'Resistencia-Azul-77';       // un cliente

const d = await deployPackage({ staging: true, local: true });
const browser = await chromium.launch();
const errs = [];
/** Abre un navegador nuevo (sin cookies ni sesión) con sus avisos de error y de confirmación recogidos → { ctx, page, dialogs } */
async function fresh({ width = 1440, height = 1000, clock = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'es-ES', acceptDownloads: true });
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', async (dl) => { dialogs.push(dl.message()); await dl.accept(); });
  if (clock) await page.clock.install();
  return { ctx, page, dialogs };
}
/** Escribe correo y contraseña en la pantalla de acceso y pulsa «Entrar». */
async function signIn(page, email, pass) {
  await page.goto(d.BASE + '/admin/index.html');
  await page.fill('[data-login] [name=email]', email); await page.fill('[data-login] [name=pass]', pass); await page.click('[data-login] button[type=submit]');
}
/** Espera a que el panel esté pintado (menú lateral). */
const panel = (page) => page.waitForSelector('.side nav a', { timeout: 8000 });
/** Espera a la pantalla del código. */
const codeScreen = (page) => page.waitForSelector('[data-code-form]', { timeout: 8000 });
/** Texto del aviso emergente del panel (#toast), tras una pausa corta para que aparezca. */
const toast = async (page) => { await page.waitForTimeout(350); return page.locator('#toast').innerText(); };
/** Otro código que no sea `real` (para equivocarse a propósito). */
const wrongCode = (real) => (real === '000000' ? '111111' : '000000');
/** Analiza con axe la pantalla actual y anota las violaciones graves. */
const axe = async (page, label) => {
  if (!AXE) return;
  await page.mouse.move(0, 0); await page.waitForTimeout(400);
  await page.evaluate(fs.readFileSync(AXE, 'utf8'));
  const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
  const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(bad.length === 0, `accesibilidad (axe) en ${label}: ${bad.length} problemas graves` + (bad.length ? ' — ' + bad.map((v) => `${v.id} (${v.nodes[0].target.join(' ')})`).join('; ') : ''));
};
/** Guarda una captura de la pantalla si se pidió (QA_SHOTS=<carpeta>): sirve para mirar cómo quedó, no es una comprobación. */
const shot = async (page, name) => { if (process.env.QA_SHOTS) { fs.mkdirSync(process.env.QA_SHOTS, { recursive: true }); await page.waitForTimeout(300); await page.screenshot({ path: path.join(process.env.QA_SHOTS, name + '.png'), fullPage: true }); } };
/** Cabeceras para hacerse pasar por otro visitante en el API. */
const visitor = (n) => ({ 'x-forwarded-for': `203.0.113.${n}` });
/** Intentos de acceso con contraseña mala desde otro «visitante» (para provocar un bloqueo de una hora). */
const hammer = async (email, n) => { for (let i = 0; i < 5; i++) await d.api('/auth/login', { method: 'POST', body: { email, password: 'No-es-esta-' + i }, headers: visitor(n) }); };

try {
  console.log(`panel: ${d.BASE}/admin/ (Apache real + PHP-FPM, correo en carpeta)`);

  // ── preparación: la dueña es de confianza, hay otro manager y un cliente; se activa el código por correo
  let r = await d.api('/users', { method: 'POST', token: d.token, body: { email: PARTNER, name: 'Socio', role: 'manager', password: PARTNER_PASS } });
  ok(r.s === 201, 'se crea el segundo manager');
  r = await d.api('/users', { method: 'POST', token: d.token, body: { email: CLIENT, name: 'Cliente', role: 'client', password: CLIENT_PASS } });
  ok(r.s === 201, 'se crea un cliente');
  d.setConfig({ two_step: { enabled: true } });
  r = await d.api(`/users/${OWNER}/two-step`, { method: 'POST', token: d.token, body: { enabled: false } });
  ok(r.s === 200 && r.j.code === 'exempt', 'la dueña pasa a ser cuenta de confianza (no pide código)');

  console.log('\n1) la dueña entra solo con la contraseña');
  const A = await fresh();
  await signIn(A.page, OWNER, OWNER_PASS);
  await panel(A.page);
  const navA = await A.page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.replace(/[^\p{L} ]/gu, '').trim()));
  ok(!(await A.page.$('[data-code-form]')), 'no aparece la pantalla del código');
  ok(navA.includes('Usuarios') && navA.includes('Actividad') && navA.length === 11, `el menú del manager trae Usuarios y Actividad (${navA.join(' · ')})`);
  ok(d.lastCode(OWNER) === null, 'no se le mandó ningún código por correo');
  ok(!(await A.ctx.cookies()).some((c) => c.name.startsWith('tv_dev_')), 'y no se guardó ningún dispositivo');

  console.log('\n2) un manager normal recibe un código por correo');
  const B = await fresh();
  await signIn(B.page, PARTNER, PARTNER_PASS);
  await codeScreen(B.page);
  ok(/Código de verificación/.test(await B.page.locator('h1').innerText()), 'tras la contraseña buena sale la pantalla del código (no se abre la sesión)');
  ok(!(await B.page.evaluate(() => sessionStorage.getItem('tv_live'))), 'todavía no hay sesión guardada en el navegador');
  const hint = await B.page.locator('.login p strong.mono').innerText();
  ok(hint === 's****@torivac.com', `dice adónde se mandó el código sin enseñar el correo entero (${hint})`);
  const attrs = await B.page.$eval('[name=code]', (e) => ({ ac: e.autocomplete, im: e.inputMode, focus: document.activeElement === e }));
  ok(attrs.ac === 'one-time-code' && attrs.im === 'numeric' && attrs.focus, 'el campo es numérico, sugiere el código del correo/SMS y ya está enfocado');
  ok(await B.page.isChecked('[name=remember]') && /30 días/.test(await B.page.locator('.check').innerText()), '«Recordar este dispositivo 30 días» viene marcado');
  ok(/Reenviar el código \(\d+ s\)/.test(await B.page.locator('[data-code-resend]').innerText()) && await B.page.isDisabled('[data-code-resend]'), 'reenviar está desactivado y cuenta los segundos');
  const mail1 = d.outbox().filter((m) => [].concat(m.to).includes(PARTNER));
  ok(mail1.length === 1 && /^ {4}\d{3} \d{3}$/m.test(mail1[0].text) && !/\d{6}|\d{3} \d{3}/.test(mail1[0].subject), 'llegó UN correo con el código de 6 cifras y el asunto no lo lleva (no se ve en las notificaciones)');
  await shot(B.page, '01-codigo-escritorio');
  await axe(B.page, 'la pantalla del código');
  const real1 = d.lastCode(PARTNER);
  await B.page.fill('[name=code]', wrongCode(real1)); await B.page.click('[data-code-form] button[type=submit]');
  await B.page.waitForSelector('[data-err]:not([hidden])');
  ok(/Código incorrecto\. Te quedan 4 intentos\./.test(await B.page.locator('[data-err]').innerText()), 'un código malo no entra y dice cuántos intentos quedan');
  await B.page.fill('[name=code]', real1.slice(0, 3) + ' ' + real1.slice(3));            // con el espacio, tal como se lee en el correo
  await B.page.click('[data-code-form] button[type=submit]');
  await panel(B.page);
  ok((await B.page.evaluate(() => JSON.parse(sessionStorage.getItem('tv_live')).email)) === PARTNER, 'el código bueno (escrito con el espacio del correo) abre la sesión');
  const dev = (await B.ctx.cookies()).find((c) => c.name.startsWith('tv_dev_'));
  const days = dev ? (dev.expires - Date.now() / 1000) / 86400 : 0;
  ok(dev && dev.httpOnly && dev.sameSite === 'Strict' && days > 29 && days <= 30.1, `queda una cookie de dispositivo (HttpOnly, SameSite=Strict, ${days.toFixed(1)} días)`);
  const navB = await B.page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.replace(/[^\p{L} ]/gu, '').trim()));
  ok(navB.includes('Actividad'), 'y el manager ve el menú completo');

  console.log('\n3) en ese navegador no se lo vuelve a pedir');
  await B.page.click('[data-logout]');
  await B.page.waitForSelector('[data-login]');
  await B.page.fill('[data-login] [name=email]', PARTNER); await B.page.fill('[data-login] [name=pass]', PARTNER_PASS); await B.page.click('[data-login] button[type=submit]');
  await panel(B.page);
  ok(!(await B.page.$('[data-code-form]')), 'al volver a entrar con la contraseña, pasa directo');
  ok(d.outbox().filter((m) => [].concat(m.to).includes(PARTNER)).length === 1, 'y no se mandó otro correo');

  console.log('\n4) en otro navegador sí, y se puede reenviar');
  const C = await fresh({ clock: true });
  await signIn(C.page, PARTNER, PARTNER_PASS);
  await codeScreen(C.page);
  await C.page.click('[data-code-back]');
  await C.page.waitForSelector('[data-login]');
  ok(await C.page.inputValue('[data-login] [name=email]') === '' && !(await C.page.evaluate(() => sessionStorage.getItem('tv_live'))), '«Volver» deja la pantalla de la contraseña, sin sesión');
  await C.page.fill('[data-login] [name=email]', PARTNER); await C.page.fill('[data-login] [name=pass]', PARTNER_PASS); await C.page.click('[data-login] button[type=submit]');
  await codeScreen(C.page);
  const oldCode = d.lastCode(PARTNER);
  ok(d.outbox().filter((m) => [].concat(m.to).includes(PARTNER)).length === 3, 'en un navegador sin dispositivo recordado, vuelve a mandar el código');
  await C.page.clock.fastForward(46000);
  ok(await C.page.isEnabled('[data-code-resend]') && (await C.page.locator('[data-code-resend]').innerText()) === 'Reenviar el código', 'pasada la espera (46 s), «Reenviar el código» se activa');
  await C.page.click('[data-code-resend]');
  await C.page.waitForSelector('[data-err]:not([hidden])');
  ok(/espera|segundos/i.test(await C.page.locator('[data-err]').innerText()), 'si el servidor aún no deja reenviar, lo dice (la espera también la exige el servidor, no solo la pantalla)');
  const pinKey = d.kvKeys('pin:')[0];
  d.kvEdit(pinKey, (v) => ({ ...v, last: v.last - 60000 }));                              // el servidor ve que ya pasó la espera
  await C.page.click('[data-code-resend]');
  await C.page.waitForFunction(() => ((document.getElementById('toast') || {}).textContent || '') === 'Código reenviado');
  const newCode = d.lastCode(PARTNER);
  ok(newCode && newCode !== oldCode && d.outbox().filter((m) => [].concat(m.to).includes(PARTNER)).length === 4, 'el reenvío manda otro código por correo');
  await C.page.fill('[name=code]', oldCode); await C.page.click('[data-code-form] button[type=submit]');
  await C.page.waitForSelector('[data-err]:not([hidden])');
  ok(/Código incorrecto/.test(await C.page.locator('[data-err]').innerText()), 'el código anterior ya no vale');
  await C.page.fill('[name=code]', newCode); await C.page.uncheck('[name=remember]'); await C.page.click('[data-code-form] button[type=submit]');
  await panel(C.page);
  ok(!(await C.ctx.cookies()).some((c) => c.name.startsWith('tv_dev_')), 'sin marcar «recordar», no se guarda el dispositivo');
  await C.ctx.close();

  console.log('\n5) cinco códigos erróneos bloquean; otro manager desbloquea');
  const D = await fresh();
  await signIn(D.page, PARTNER, PARTNER_PASS);
  await codeScreen(D.page);
  const real5 = d.lastCode(PARTNER);
  const bad5 = wrongCode(real5);
  for (let i = 1; i <= 4; i++) {
    await D.page.fill('[name=code]', bad5); await D.page.click('[data-code-form] button[type=submit]');
    await D.page.waitForFunction((n) => /Te quedan/.test(((document.querySelector('[data-err]') || {}).textContent || '')) && ((document.querySelector('[data-err]') || {}).textContent || '').includes('quedan ' + n), 5 - i);
  }
  ok(/Te quedan 1 intento\./.test(await D.page.locator('[data-err]').innerText()), 'el cuarto fallo avisa de que queda 1 intento (en singular)');
  await D.page.fill('[name=code]', bad5); await D.page.click('[data-code-form] button[type=submit]');
  await D.page.waitForSelector('[data-login]');
  ok(/Demasiados códigos erróneos/.test(await D.page.locator('.login .notice').innerText()), 'el quinto fallo descarta el código y vuelve a la contraseña con el motivo');
  await D.page.fill('[data-login] [name=email]', PARTNER); await D.page.fill('[data-login] [name=pass]', PARTNER_PASS); await D.page.click('[data-login] button[type=submit]');
  await D.page.waitForSelector('[data-err]:not([hidden])');
  ok(/hora|bloque|Vuelve a intentarlo/i.test(await D.page.locator('[data-err]').innerText()) && !(await D.page.$('[data-code-form]')), 'mientras dura el bloqueo no se manda otro código (ni con la contraseña buena)');
  const sent5 = d.outbox().filter((m) => [].concat(m.to).includes(PARTNER)).length;
  await A.page.click('.side nav a[href="#usuarios"]');
  await A.page.waitForSelector('[data-sec-mode=users]');
  const rowP = A.page.locator('tr', { hasText: PARTNER });
  const tP = await rowP.innerText();
  ok(/bloqueada/i.test(tP), 'en Usuarios, la cuenta del socio sale «Bloqueada» (otro manager lo ve)' + (/bloqueada/i.test(tP) ? '' : ' — fila: ' + JSON.stringify(tP)));
  await rowP.locator('[data-sec-unlock]').click();
  ok(/Cuenta desbloqueada/.test(await toast(A.page)), 'el botón «Desbloquear» la libera');
  await A.page.waitForFunction((e) => { const t = [...document.querySelectorAll('tr')].find((x) => x.textContent.includes(e)); return t && !/bloqueada/i.test(t.textContent); }, PARTNER);
  await D.page.fill('[data-login] [name=pass]', PARTNER_PASS); await D.page.click('[data-login] button[type=submit]');
  await codeScreen(D.page);
  ok(d.outbox().filter((m) => [].concat(m.to).includes(PARTNER)).length === sent5 + 1, 'y ya puede entrar: se le manda un código nuevo');
  await D.page.fill('[name=code]', d.lastCode(PARTNER)); await D.page.click('[data-code-form] button[type=submit]');
  await panel(D.page);
  ok(true, 'entra con el código nuevo');
  await D.ctx.close();

  console.log('\n6) Usuarios: la casilla «código por correo», alta, baja y contraseña nueva');
  await A.page.click('.side nav a[href="#actividad"]');
  await A.page.click('.side nav a[href="#usuarios"]');
  await A.page.waitForSelector('[data-sec-mode=users]');
  const heads = await A.page.$$eval('[data-sec-mode=users] thead th', (t) => t.map((x) => x.textContent.trim()).filter(Boolean));
  ok(['Nombre', 'Correo', 'Rol', 'Último acceso', 'Código por correo', 'Estado'].every((h) => heads.includes(h)), `columnas: ${heads.join(' · ')}`);
  const rowO = A.page.locator('tr', { hasText: OWNER });
  ok(await rowO.locator('select[data-sec-two-step]').inputValue() === '0' && /\(tú\)/.test(await rowO.innerText()) && !(await rowO.locator('[data-sec-del-user]').count()), 'la dueña figura como cuenta de confianza y no tiene botón de borrarse a sí misma');
  ok(await A.page.locator('tr', { hasText: PARTNER }).locator('select[data-sec-two-step]').inputValue() === '1', 'el socio sí pide código');
  ok(!(await A.page.locator('tr', { hasText: CLIENT }).locator('select').count()), 'los clientes no llevan casilla (solo piden código tras ataques repetidos)');
  ok(/\d{2}\/\d{2}\/\d{4}/.test(await A.page.locator('tr', { hasText: PARTNER }).innerText()), 'se ve el último acceso del socio');
  await shot(A.page, '02-usuarios');
  await axe(A.page, 'la vista Usuarios');
  await A.page.locator('tr', { hasText: PARTNER }).locator('select[data-sec-two-step]').selectOption('0');
  ok(/Cuenta de confianza/.test(await toast(A.page)), 'cambiar el socio a «cuenta de confianza» lo avisa');
  r = await d.api('/users', { token: d.token });
  ok(r.j.users.find((u) => u.email === PARTNER).code === 'exempt', 'y el servidor lo guarda');
  await A.page.locator('tr', { hasText: PARTNER }).locator('select[data-sec-two-step]').selectOption('1');
  await A.page.waitForTimeout(400);
  r = await d.api('/users', { token: d.token });
  ok(r.j.users.find((u) => u.email === PARTNER).code === 'required', 'volver a «Sí, lo pide» también se guarda');
  await A.page.fill('[data-sec-new-user] [name=name]', 'Nueva Persona'); await A.page.fill('[data-sec-new-user] [name=email]', 'nueva@empresa.com');
  await A.page.selectOption('[data-sec-new-user] [name=role]', 'manager'); await A.page.fill('[data-sec-new-user] [name=password]', 'aaaaaaaaaaaaaaaa');
  await A.page.click('[data-sec-new-user] button[type=submit]');
  ok(/fácil de adivinar/i.test(await toast(A.page)), 'una contraseña floja se rechaza con el motivo');
  await A.page.fill('[data-sec-new-user] [name=password]', 'Carrete-Cobre-2026');
  await A.page.click('[data-sec-new-user] button[type=submit]');
  await A.page.waitForFunction(() => [...document.querySelectorAll('tr')].some((x) => x.textContent.includes('nueva@empresa.com')));
  ok(true, 'el alta de un usuario aparece en la lista');
  await A.page.selectOption('[data-sec-reset-pw] [name=email]', CLIENT); await A.page.fill('[data-sec-reset-pw] [name=password]', 'Bobina-Plata-2026');
  await A.page.click('[data-sec-reset-pw] button[type=submit]');
  ok(/Contraseña nueva guardada/.test(await toast(A.page)), 'se pone una contraseña nueva a otra cuenta');
  r = await d.api('/auth/login', { method: 'POST', body: { email: CLIENT, password: CLIENT_PASS } });
  ok(r.s === 401, 'la contraseña vieja del cliente ya no entra');
  r = await d.api('/auth/login', { method: 'POST', body: { email: CLIENT, password: 'Bobina-Plata-2026' } });
  ok(r.s === 200 && r.j.token, 'y la nueva sí');
  await A.page.locator('tr', { hasText: 'nueva@empresa.com' }).locator('[data-sec-del-user]').click();
  await A.page.waitForFunction(() => ![...document.querySelectorAll('tr')].some((x) => x.textContent.includes('nueva@empresa.com')));
  ok(A.dialogs.some((m) => /nueva@empresa\.com/.test(m)), 'borrar un usuario pide confirmación y lo quita');

  console.log('\n7) ataques repetidos: un solo aviso, y código en dispositivos nuevos');
  /** Los correos de «intentos repetidos» que se han mandado (el aviso al equipo). */
  const alerts = () => d.outbox().filter((m) => /intentos repetidos/.test(m.subject || ''));
  ok(alerts().length === 0, 'hasta ahora (varios bloqueos sueltos y desbloqueos) no se ha mandado ningún aviso de rutina');
  await hammer(CLIENT, 1);
  r = await d.api('/auth/login', { method: 'POST', body: { email: CLIENT, password: 'Bobina-Plata-2026' }, headers: visitor(1) });
  ok(r.s === 429, 'cinco contraseñas malas desde un visitante bloquean la cuenta una hora (ni la buena entra desde ahí)');
  ok(alerts().length === 0, 'un bloqueo suelto NO avisa por correo');
  await hammer(CLIENT, 2);
  ok(alerts().length === 0, 'dos tampoco');
  await hammer(CLIENT, 3);
  ok(alerts().length === 1 && /3 bloqueos/.test(alerts()[0].text) && !/Bobina|No-es-esta/.test(alerts()[0].text + alerts()[0].html), 'al tercero en 24 h llega UN aviso al equipo, sin contraseñas');
  ok([].concat(alerts()[0].to).includes('info@grupotorivac.com'), 'va a quien recibe los pedidos');
  await hammer(CLIENT, 4);
  ok(alerts().length === 1, 'y no se repite el mismo día');
  await A.page.click('.side nav a[href="#usuarios"]'); await A.page.click('.side nav a[href="#actividad"]'); await A.page.click('.side nav a[href="#usuarios"]');
  await A.page.waitForSelector('[data-sec-mode=users]');
  const rowC = A.page.locator('tr', { hasText: CLIENT });
  const tC = await rowC.innerText();
  ok(/protección reforzada hasta/i.test(tC), 'Usuarios marca la cuenta con «Protección reforzada»' + (/protección reforzada hasta/i.test(tC) ? '' : ' — fila: ' + JSON.stringify(tC)));
  const E = await fresh();
  await signIn(E.page, CLIENT, 'Bobina-Plata-2026');
  await codeScreen(E.page);
  ok(/intentos repetidos/.test(d.outbox().filter((m) => [].concat(m.to).includes(CLIENT)).pop().text), 'un cliente con la cuenta reforzada recibe el código (y el correo explica por qué)');
  await E.page.fill('[name=code]', d.lastCode(CLIENT)); await E.page.click('[data-code-form] button[type=submit]');
  await panel(E.page);
  const navE = await E.page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.replace(/[^\p{L} ]/gu, '').trim()));
  ok(navE.join() === 'Presupuestador,Mis presupuestos,Lista de precios,Estadísticas', `el cliente entra a su panel (${navE.join(' · ')})`);
  await E.page.goto(d.BASE + '/admin/index.html#actividad'); await panel(E.page);
  ok(await E.page.locator('.side nav a[aria-current=page]').innerText().then((t) => /Presupuestador/.test(t)), 'si un cliente escribe #actividad en la dirección, no ve nada de eso');
  r = await d.api('/activity', { token: (await E.page.evaluate(() => JSON.parse(sessionStorage.getItem('tv_live')).token)) });
  ok(r.s === 403, 'y el servidor le niega el registro de actividad (403)');
  await E.ctx.close();
  await rowC.locator('[data-sec-unlock]').click();
  ok(/desbloqueada/.test(await toast(A.page)), '«Desbloquear» quita también la protección reforzada');
  await A.page.waitForFunction((e) => { const t = [...document.querySelectorAll('tr')].find((x) => x.textContent.includes(e)); return t && !/protección reforzada/i.test(t.textContent); }, CLIENT);
  r = await d.api('/auth/login', { method: 'POST', body: { email: CLIENT, password: 'Bobina-Plata-2026' } });
  ok(r.s === 200 && r.j.token, 'y el cliente vuelve a entrar con la contraseña sola');

  console.log('\n8) Actividad: filtros, marcas y CSV');
  await d.api('/auth/login', { method: 'POST', body: { email: '=1+1@evil.test', password: 'No-importa-nada' }, headers: visitor(9) });
  await A.page.click('.side nav a[href="#actividad"]');
  await A.page.waitForSelector('[data-sec-mode=activity] [data-sec-rows] tr');
  const labels = await A.page.$$eval('[data-sec-rows] tr td:nth-child(3)', (t) => t.map((x) => x.textContent.trim()));
  ok(['Código enviado por correo', 'Entró con código', 'Dispositivo recordado', 'Código incorrecto', 'Cuenta desbloqueada', 'Aviso: intentos repetidos', 'Acceso bloqueado una hora'].every((l) => labels.includes(l)), 'el registro tiene lo que pasó: código enviado, entró con código, dispositivo recordado, código incorrecto, desbloqueos, bloqueos y el aviso');
  ok(await A.page.locator('[data-sec-rows] .tag.warn').count() > 3, 'los fallos, bloqueos y avisos salen marcados');
  const alertRow = A.page.locator('[data-sec-rows] tr', { hasText: 'Aviso: intentos repetidos' }).first();
  ok(/cliente@empresa\.com · 3 bloqueos en 24 h/.test(await alertRow.innerText()), 'el aviso dice qué cuenta y cuántos bloqueos');
  ok(/127\.0\.0\.1/.test(await A.page.locator('[data-sec-rows] tr', { hasText: 'Entró con código' }).first().innerText()) && /Chrome|HeadlessChrome|Otro/.test(await A.page.locator('[data-sec-rows] tr', { hasText: 'Entró con código' }).first().innerText()), 'cada hecho lleva la dirección y el navegador desde donde se hizo');
  await shot(A.page, '03-actividad');
  await axe(A.page, 'la vista Actividad');
  await A.page.selectOption('[data-sec-filters] [name=cat]', 'backup'); await A.page.click('[data-sec-filters] button[type=submit]');
  await A.page.waitForFunction(() => /Copia de seguridad automática/.test(((document.querySelector('[data-sec-rows]') || {}).textContent || '')) && document.querySelectorAll('[data-sec-rows] tr').length === 1);
  ok(true, 'filtrando «Copias» solo sale la copia automática de la primera entrada de un manager');
  await A.page.selectOption('[data-sec-filters] [name=cat]', 'message'); await A.page.click('[data-sec-filters] button[type=submit]');
  await A.page.waitForFunction(() => /No hay actividad con esos filtros/.test(((document.querySelector('[data-sec-rows]') || {}).textContent || '')));
  ok(true, 'un filtro sin resultados lo dice («Mensajes»: nadie ha borrado ninguno)');
  await A.page.selectOption('[data-sec-filters] [name=cat]', 'login'); await A.page.fill('[data-sec-filters] [name=u]', 'socio'); await A.page.click('[data-sec-filters] button[type=submit]');
  await A.page.waitForFunction(() => document.querySelectorAll('[data-sec-rows] tr').length > 3 && ![...document.querySelectorAll('[data-sec-rows] tr')].some((x) => /cliente@|jefa@/.test(x.textContent)));
  const only = await A.page.$$eval('[data-sec-rows] tr td:nth-child(2)', (t) => t.map((x) => x.textContent));
  ok(only.length > 3 && only.every((t) => /socio@/.test(t)), `filtrando «Accesos» de «socio» solo salen los suyos (${only.length} hechos)`);
  await A.page.selectOption('[data-sec-filters] [name=cat]', ''); await A.page.fill('[data-sec-filters] [name=u]', ''); await A.page.fill('[data-sec-filters] [name=q]', 'evil.test'); await A.page.click('[data-sec-filters] button[type=submit]');
  await A.page.waitForFunction(() => document.querySelectorAll('[data-sec-rows] tr').length === 1 && /evil/.test(((document.querySelector('[data-sec-rows]') || {}).textContent || '')));
  const dl = A.page.waitForEvent('download');
  await A.page.click('[data-sec-csv]');
  const csv = fs.readFileSync(await (await dl).path(), 'utf8');
  ok(csv.charCodeAt(0) === 0xFEFF && /^﻿"Cuándo \(UTC\)";"Quién";"Rol";"Qué";"Detalle";"IP";"Navegador"/.test(csv), 'la descarga CSV lleva su cabecera (y la marca UTF-8 para que Excel respete las tildes)');
  ok(csv.includes('"\'=1+1@evil.test"') && !/;"=1\+1@evil/.test(csv), 'un correo escrito como fórmula (=1+1@…) sale neutralizado en el CSV, no se ejecuta en la hoja de cálculo');
  await A.page.fill('[data-sec-filters] [name=q]', ''); await A.page.click('[data-sec-filters] button[type=submit]');

  console.log('\n9) Ajustes: tu cuenta, dispositivos y copias de seguridad');
  await A.page.click('.side nav a[href="#ajustes"]');
  await A.page.waitForSelector('[data-sec-account]');
  ok(/cuenta es de confianza/.test(await A.page.locator('[data-sec-account] p').first().innerText()), '«Tu cuenta y tu seguridad» explica que la cuenta de la dueña es de confianza');
  await A.page.waitForSelector('[data-sec-mode=backups]');
  /** Las filas de la tabla de copias de seguridad de Ajustes. */
  const bkRows = () => A.page.locator('[data-sec-mode=backups] tbody tr');
  const bk0 = await bkRows().allInnerTexts();
  ok(bk0.length === 1 && /automática/.test(bk0[0]) && /una cada semana/.test(await A.page.locator('[data-sec-mode=backups]').innerText()), 'ya hay una copia, hecha sola con la primera entrada de un manager (después, una cada semana)');
  await shot(A.page, '04-ajustes');
  await axe(A.page, 'Ajustes (cuenta y copias)');
  await A.page.click('[data-sec-bk-now]');
  await A.page.waitForFunction(() => document.querySelectorAll('[data-sec-mode=backups] tbody tr').length === 2);
  ok(/jefa@torivac\.com/.test(await bkRows().first().innerText()), '«Crear copia ahora» hace otra a nombre de quien la pide');
  const dl2 = A.page.waitForEvent('download');
  await bkRows().first().locator('[data-sec-dl]').click();
  const dl2r = await dl2;
  ok(/^backup-\d{8}-\d{6}-[0-9a-f]{4}\.jsonl\.gz$/.test(dl2r.suggestedFilename()), `la descarga se llama ${dl2r.suggestedFilename()}`);
  const gz = zlib.gunzipSync(fs.readFileSync(await dl2r.path())).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
  ok(gz[0].torivac_backup === 1 && gz[gz.length - 1].end === 1 && gz[gz.length - 1].keys === gz.filter((x) => x.k).length && gz.some((x) => x.k && x.k.startsWith('user:')), `el archivo es una copia completa (${gz.length} líneas, con su cabecera, su cierre con el recuento y los usuarios)`);
  ok(!gz.some((x) => x.k && /^(rl:|pin:|lgidx:|backup:)/.test(x.k)), 'y no mete contadores, códigos temporales ni su propio estado');
  ok(!JSON.stringify(gz).includes('session-test-'), 'ni el secreto de sesión de config.php');
  await bkRows().first().locator('[data-sec-del-bk]').click();
  await A.page.waitForFunction(() => document.querySelectorAll('[data-sec-mode=backups] tbody tr').length === 1);
  ok(A.dialogs.some((m) => /Borrar esta copia/.test(m)) && /automática/.test(await bkRows().first().innerText()), 'borrar una copia pide confirmación y la quita (queda la automática)');
  await A.page.click('[data-sec-forget]');
  ok(/Dispositivos olvidados/.test(await toast(A.page)), '«Olvidar mis dispositivos recordados» lo confirma');
  // el socio tenía dispositivo recordado en B: tras olvidarlo él mismo, vuelve a pedirle el código
  await B.page.goto(d.BASE + '/admin/index.html');
  ok(!!(await B.page.$('.side nav a')), 'la sesión que ya estaba abierta (en otro navegador) sigue abierta');
  await B.page.click('[data-logout]'); await B.page.waitForSelector('[data-login]');
  await B.page.fill('[data-login] [name=email]', PARTNER); await B.page.fill('[data-login] [name=pass]', PARTNER_PASS); await B.page.click('[data-login] button[type=submit]');
  await panel(B.page);
  ok(!(await B.page.$('[data-code-form]')), 'el dispositivo recordado del socio sigue valiendo (olvidar dispositivos solo afecta a quien lo pide)');
  // cambio de contraseña propia
  await A.page.fill('[data-sec-own-pw] [name=current]', 'esta-no-es-la-clave'); await A.page.fill('[data-sec-own-pw] [name=password]', 'Estaño-Brillante-2027');
  await A.page.click('[data-sec-own-pw] button[type=submit]');
  ok(/no es correcta/.test(await toast(A.page)), 'cambiar la contraseña con la actual mal escrita se rechaza');
  await A.page.fill('[data-sec-own-pw] [name=current]', OWNER_PASS); await A.page.fill('[data-sec-own-pw] [name=password]', 'aaaaaaaaaaaaaaaa');
  await A.page.click('[data-sec-own-pw] button[type=submit]');
  ok(/fácil de adivinar/.test(await toast(A.page)), 'una contraseña nueva floja se rechaza con el motivo');
  await A.page.fill('[data-sec-own-pw] [name=password]', 'Estaño-Brillante-2027');
  await A.page.click('[data-sec-own-pw] button[type=submit]');
  await A.page.waitForSelector('[data-login]');
  ok(/Contraseña cambiada: entra con la nueva/.test(await A.page.locator('.login .notice').innerText()), 'cambiada la contraseña, vuelve a la pantalla de acceso con un aviso');
  r = await d.api('/orders', { token: d.token });
  ok(r.s === 401, 'y la sesión que había (la de antes del cambio) ya no vale en ningún sitio');
  await A.page.fill('[data-login] [name=email]', OWNER); await A.page.fill('[data-login] [name=pass]', OWNER_PASS); await A.page.click('[data-login] button[type=submit]');
  await A.page.waitForSelector('[data-err]:not([hidden])');
  ok(/Credenciales incorrectas/.test(await A.page.locator('[data-err]').innerText()), 'la contraseña vieja ya no entra');
  await A.page.fill('[data-login] [name=pass]', 'Estaño-Brillante-2027'); await A.page.click('[data-login] button[type=submit]');
  await panel(A.page);
  ok(true, 'la nueva sí');

  console.log('\n10) interruptor de emergencia y correo sin completar');
  d.setConfig({ two_step: { enabled: false } });
  const F = await fresh();
  await signIn(F.page, PARTNER, PARTNER_PASS);
  await panel(F.page);
  ok(true, 'con two_step.enabled = false, el socio entra con la contraseña sola (nadie se queda fuera)');
  await F.page.click('.side nav a[href="#usuarios"]'); await F.page.waitForSelector('[data-sec-mode=users]');
  ok(/Desactivado en el servidor/.test(await F.page.locator('[data-sec-mode=users]').innerText()), 'Usuarios dice que el código está desactivado en el servidor');
  await F.ctx.close();
  d.setConfig({ two_step: { enabled: true }, mail: { driver: 'none' } });
  const G = await fresh();
  await signIn(G.page, PARTNER, PARTNER_PASS);
  await panel(G.page);
  ok(true, 'si el correo no funciona, no se pide código (no se manda uno que no llegaría)');
  await G.page.click('.side nav a[href="#usuarios"]'); await G.page.waitForSelector('[data-sec-mode=users]');
  ok(/no se pide código a nadie/.test(await G.page.locator('[data-sec-mode=users] .notice').first().innerText()), 'y Usuarios lo avisa para que se arregle el correo');
  await G.ctx.close();
  d.setConfig({ two_step: { enabled: true }, mail: { driver: 'file' } });

  console.log('\n11) móvil (390 px)');
  const M2 = await fresh({ width: 390, height: 800 });
  await signIn(M2.page, PARTNER, PARTNER_PASS);
  await codeScreen(M2.page);
  ok(await M2.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'la pantalla del código no desborda en 390 px');
  await shot(M2.page, '05-codigo-movil');
  await M2.page.fill('[name=code]', d.lastCode(PARTNER)); await M2.page.click('[data-code-form] button[type=submit]');
  await panel(M2.page);
  for (const v of ['usuarios', 'actividad', 'ajustes']) {
    await M2.page.goto(d.BASE + '/admin/index.html#' + v); await M2.page.waitForSelector('#main h1');
    await M2.page.waitForTimeout(500);
    ok(await M2.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `«${v}» no desborda la página en 390 px (las tablas se desplazan dentro de su marco)`);
    await shot(M2.page, '06-' + v + '-movil');
  }
  await M2.page.screenshot({ path: path.join(process.env.TMPDIR || '/tmp', 'qa-security-ajustes-movil.png'), fullPage: true });
  await M2.ctx.close();

  console.log('\n12) errores de la página');
  ok(errs.length === 0, `sin errores de JavaScript ni de consola en toda la prueba (${errs.length})` + (errs.length ? ' — ' + errs.slice(0, 4).join(' | ') : ''));
  await A.ctx.close(); await B.ctx.close();
} catch (e) {
  fails++; console.error('  ✗ la prueba se interrumpió: ' + (e && e.stack || e));
  console.error(d.ap.log());
} finally {
  await browser.close();
  await d.stop();
}
if (fails) { console.error(`\n${fails} comprobación(es) fallida(s)`); process.exit(1); }
console.log('\nTodo bien: acceso en dos pasos y seguridad del panel');
