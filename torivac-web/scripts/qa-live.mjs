#!/usr/bin/env node
// [QA-LIVE] Sesión 9/6 · La web de producción contra el backend REAL: sin red, sin enviar correo de verdad.
//   node scripts/qa-live.mjs            contra el Worker torivac-api (workers/api, KV en memoria)
//   node scripts/qa-live.mjs --php      contra el API PHP de cPanel (backend-php/api, php -S, almacén en ficheros)
// Cadena: navegador (Playwright) → dist/ servido por http → backend (Resend simulado) · ver scripts/lib/backends.mjs.
// Se comprueba: pedido con PDF adjunto a info@ y mzamora@ + copia al cliente, repricing en servidor, vaciado del presupuesto,
// fallo del servidor (mensaje + mailto, el presupuesto se conserva), honeypot, formulario de contacto (el mensaje queda guardado aunque el correo falle), solo texto plano y con límite
// (aviso en el idioma de la página, y el servidor lo exige aunque se salte el navegador), tiempo mínimo de relleno, CORS.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { startBackend } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// ───────────────────────────────────────── [DATA]
const sb = { window: {}, document: { getElementById: () => null } }; sb.window = sb; vm.createContext(sb);   // catalog.js lee el bloque JSON de arranque con document.getElementById (aquí no hay página: sin bloque)
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data', f), 'utf8'), sb);
const { items, prices } = sb.TV;
// 1.ª línea pedible de un producto: su código real si el PDF lo da (TT…), o la línea genérica P<id>
const pick = (pid) => Object.keys(items).find((r) => items[r].pid === pid);
const REFS = [pick(884), pick(8339), pick(932)], QTY = { [REFS[0]]: 12, [REFS[1]]: 2, [REFS[2]]: 200 };
/** Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web). */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Precio unitario esperado de ref para q unidades: el del último tramo por cantidad alcanzado, o el base. */
const unit = (ref, q) => { const p = prices.items[ref]; let u = p.p; for (const [m, x] of p.t || []) if (q >= m) u = x; return u; };
const expTotal = round2(REFS.reduce((s, r) => s + round2(unit(r, QTY[r]) * QTY[r]), 0));

// ───────────────────────────────────────── [SITE] + [BACKEND]
const be = await startBackend({ dist: DIST });
const { SITE, API, mails } = be;
console.log(`backend: ${be.kind}`);
await be.seedPrices({ ...prices, mode: 'live', updated_at: new Date().toISOString() });

// ───────────────────────────────────────── [BROWSER]
const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } });
// el sitio se compila SIN API (demo); aquí se le «enchufa» el Worker como haría TORIVAC_API en el build de producción
await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + `\nTV.meta.api=${JSON.stringify(API)};TV.meta.demo=false;\n` }); });
const page = await ctx.newPage();
let failNext = false;                                                  // el servidor «se cae» una vez: la web debe avisar y no perder el presupuesto
await page.route('**/api/order', (route) => { if (failNext && route.request().method() === 'POST') { failNext = false; return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"ok":false,"error":"fallo simulado"}' }); } return route.fallback(); });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });

console.log('\n1) pedido real');
await page.goto(SITE + '/presupuesto/');
await page.evaluate(([refs, qty]) => { refs.forEach((r) => TV.Quote.add(r, qty[r])); }, [REFS, QTY]);
await page.reload();
ok((await page.evaluate(() => TV.Quote.kinds())) === 3, '3 líneas en el presupuesto');
const f = page.locator('[data-quote-form]');
await f.locator('[name=name]').fill('Marta Prueba'); await f.locator('[name=company]').fill('Taller Test S.L.');
await f.locator('[name=email]').fill('cliente.prueba@example.com'); await f.locator('[name=phone]').fill('+34 600 000 000');
await f.locator('[name=notes]').fill('Entrega a la semana que viene');
await f.locator('[name=privacy]').check();
await f.locator('button[type=submit]').click();
await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
const sent = await page.locator('[data-sent]').innerText();
const num = (sent.match(/TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?/) || [])[0];
ok(!!num, `número de pedido del servidor: ${num}`);
ok(/recibido|copia/i.test(sent), `mensaje de éxito: «${sent.replace(/\s+/g, ' ').slice(0, 90)}»`);
ok((await page.evaluate(() => TV.Quote.count())) === 0, 'el presupuesto se vacía tras enviarlo');
ok(mails.length === 2, `2 correos (equipo + copia al cliente): ${mails.length}`);
const team = mails[0] || {}, copy = mails[1] || {};
ok(JSON.stringify(team.to) === JSON.stringify(['info@grupotorivac.com', 'mzamora@torivac.com']), `equipo: ${JSON.stringify(team.to)}`);
ok(team.reply_to === 'cliente.prueba@example.com', `responder-a = cliente (${team.reply_to})`);
ok(JSON.stringify(copy.to) === JSON.stringify(['cliente.prueba@example.com']), 'copia al cliente');
const att = (team.attachments || [])[0];
ok(att && /\.pdf$/.test(att.filename) && String(att.content).startsWith('JVBER'), `PDF adjunto (${att && att.filename}, ${att ? Math.round(att.content.length * 0.75 / 1024) : 0} KB)`);
for (const r of REFS) ok(String(team.html).includes(r), `el correo incluye ${r}`);
const stored = await be.order(num);
ok(stored && stored.total === expTotal, `total fijado en servidor ${stored && stored.total} = ${expTotal}`);
ok(stored && stored.customer.company === 'Taller Test S.L.' && stored.lines.length === 3, 'pedido guardado con cliente y 3 líneas');

console.log('\n2) el servidor falla: se avisa, hay alternativa por correo y no se pierde el presupuesto');
mails.length = 0;
await page.evaluate(([refs, qty]) => { refs.forEach((r) => TV.Quote.add(r, qty[r])); }, [REFS, QTY]);
await page.reload(); failNext = true;
await f.locator('[name=name]').fill('Marta Prueba'); await f.locator('[name=email]').fill('cliente.prueba@example.com'); await f.locator('[name=privacy]').check();
await f.locator('button[type=submit]').click();
await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
const errTxt = await page.locator('[data-sent]').innerText();
ok(/no hemos podido/i.test(errTxt) && (await page.locator('[data-sent] a[href^="mailto:info@"]').count()) === 1, `mensaje de error con mailto: «${errTxt.replace(/\s+/g, ' ').slice(0, 100)}»`);
ok((await page.evaluate(() => TV.Quote.kinds())) === 3 && mails.length === 0, 'el presupuesto sigue intacto y no se envió nada');

console.log('\n3) honeypot: un bot que rellena el campo oculto es rechazado');
await page.evaluate(() => { document.querySelector('[data-quote-form] [name=hp]').value = 'http://spam'; });
await f.locator('button[type=submit]').click();
await page.waitForTimeout(600);
ok(mails.length === 0 && (await page.evaluate(() => TV.Quote.kinds())) === 3, 'ni correo ni vaciado');

console.log('\n4) formulario de contacto');
await page.goto(SITE + '/contacto/');
const cf = page.locator('[data-contact-form]').first();
await cf.locator('[name=name]').fill('Pedro Contacto'); await cf.locator('[name=email]').fill('pedro@example.com');
await cf.locator('[name=message]').fill('Necesito un transformador toroidal de 2x12 V y 50 VA.'); await cf.locator('[name=privacy]').check();
await cf.locator('button[type=submit]').click();
await cf.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
ok(/recibido/i.test(await cf.locator('[data-sent]').innerText()), 'mensaje de confirmación');
const cm = mails.at(-1) || {};
ok(JSON.stringify(cm.to) === JSON.stringify(['info@grupotorivac.com', 'mzamora@torivac.com']) && /toroidal/.test(JSON.stringify(cm)), 'llega a info@ y mzamora@ con el texto del mensaje');

console.log('\n4b) el correo falla (Resend rechaza, p. ej. dominio sin verificar): el pedido y el mensaje quedan guardados y la web no promete una copia que no sale');
be.setMailDown(true); mails.length = 0;
await page.goto(SITE + '/presupuesto/');
await page.evaluate(([refs, qty]) => { refs.forEach((r) => TV.Quote.add(r, qty[r])); }, [REFS, QTY]);
await page.reload();
const f2 = page.locator('[data-quote-form]');
await f2.locator('[name=name]').fill('Marta Prueba'); await f2.locator('[name=email]').fill('cliente.prueba@example.com'); await f2.locator('[name=privacy]').check();
await f2.locator('button[type=submit]').click(); await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
const t2 = (await page.locator('[data-sent]').innerText()).replace(/\s+/g, ' ');
const num2 = (t2.match(/TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?/) || [])[0];
ok(!!num2 && /no hemos podido enviarte la confirmación/i.test(t2) && !/te hemos enviado una confirmación/i.test(t2) && (await page.locator('[data-sent] a[href^="mailto:info@"]').count()) === 1, `pedido registrado SIN afirmar que se envió copia, con el correo directo: «${t2.slice(0, 150)}»`);
const rec2 = await be.order(num2);
ok(rec2 && rec2.emailed && rec2.emailed.team === false && /403/.test(rec2.emailed.error), `el pedido queda guardado y marcado «aviso por correo no enviado» (${rec2 && rec2.emailed && rec2.emailed.error})`);
await page.goto(SITE + '/contacto/');
const cf2 = page.locator('[data-contact-form]').first();
await cf2.locator('[name=name]').fill('Pedro Contacto'); await cf2.locator('[name=email]').fill('pedro@example.com'); await cf2.locator('[name=message]').fill('Necesito un transformador de 50 VA.'); await cf2.locator('[name=privacy]').check();
await cf2.locator('button[type=submit]').click(); await cf2.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
const ct2 = (await cf2.locator('[data-sent]').innerText()).replace(/\s+/g, ' ');
const saved2 = (await be.messages()).find((m) => /transformador de 50 VA/.test(m.message));
ok(/recibido/i.test(ct2) && saved2 && saved2.emailed && saved2.emailed.sent === false, `contacto con el correo caído: el mensaje queda GUARDADO (se ve en el panel) y marcado «sin enviar por correo» (${saved2 && JSON.stringify(saved2.emailed).slice(0, 80)})`);
be.setMailDown(false);

console.log('\n4c) solo texto plano y con límite de caracteres: el navegador avisa en el idioma de la página y no envía nada');
await page.goto(SITE + '/contacto/');
const cf3 = page.locator('[data-contact-form]').first();
const nMsgs = (await be.messages()).length; mails.length = 0;
await cf3.locator('[name=message]').fill('Hola');
ok(((await cf3.locator('.count').innerText()) || '').replace(/\s+/g, '') === '4/1000', `contador de caracteres: «${await cf3.locator('.count').innerText()}»`);
ok((await cf3.locator('[name=message]').getAttribute('maxlength')) === '1000' && (await cf3.locator('[name=name]').getAttribute('maxlength')) === '80', 'maxlength en los campos');
await cf3.locator('[name=name]').fill('Pedro <script>alert(1)</script>'); await cf3.locator('[name=email]').fill('pedro@example.com');
await cf3.locator('[name=message]').fill('Necesito un transformador de 50 VA.'); await cf3.locator('[name=privacy]').check();
await cf3.locator('button[type=submit]').click();
await cf3.locator('.err').first().waitFor({ timeout: 4000 });
ok(/solo texto normal/i.test(await cf3.locator('.err').first().innerText()) && (await cf3.locator('[name=name]').getAttribute('aria-invalid')) === 'true', `etiquetas HTML en el nombre: «${await cf3.locator('.err').first().innerText()}»`);
ok((await cf3.locator('[name=name]').getAttribute('aria-describedby')) === (await cf3.locator('.err').first().getAttribute('id')), 'el aviso está enlazado con el campo (aria-describedby)');
await cf3.locator('[name=name]').fill('Pedro Contacto'); await cf3.locator('[name=message]').fill('palabra '.repeat(126));
ok((await cf3.locator('[name=message]').inputValue()).length === 1000 && /1000\s*\/\s*1000/.test(await cf3.locator('.count').innerText()) && (await cf3.locator('.count.full').count()) === 1, 'al escribir más de 1000 caracteres el navegador corta en 1000 y el contador lo marca');
await cf3.locator('[name=message]').evaluate((el) => { el.value = 'palabra '.repeat(126); el.dispatchEvent(new Event('input', { bubbles: true })); });         // sin maxlength efectivo (valor puesto por un script)
await cf3.locator('button[type=submit]').click();
await cf3.locator('.err').first().waitFor({ timeout: 4000 });
ok(/demasiado largo.*1000/i.test(await cf3.locator('.err').first().innerText()), `más de 1000 caracteres (valor puesto por programa): «${await cf3.locator('.err').first().innerText()}»`);
ok((await be.messages()).length === nMsgs && mails.length === 0, 'no se envió nada al servidor');
// si alguien se salta el navegador, el servidor lo rechaza igual (con el código y el campo para que la web lo muestre)
const hostile = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ name: 'Eva', email: 'eva@example.com', message: '<img src=x onerror=alert(1)> hola', privacy: true, _e: 9000 }) });
const hb = await hostile.json().catch(() => ({}));
ok(hostile.status === 400 && hb.code === 'plain_text' && hb.field === 'message', `servidor: HTML en el mensaje → ${hostile.status} ${hb.code}/${hb.field}`);
const longMsg = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ name: 'Eva', email: 'eva@example.com', message: 'palabra '.repeat(126), privacy: true, _e: 9000 }) });
const lb = await longMsg.json().catch(() => ({}));
ok(longMsg.status === 400 && lb.code === 'too_long' && lb.field === 'message', `servidor: 1008 caracteres → ${longMsg.status} ${lb.code}/${lb.field}`);
ok((await be.messages()).length === nMsgs, 'el servidor no guardó nada de lo rechazado');
// presupuesto: las notas también
await page.goto(SITE + '/presupuesto/');
await page.evaluate(([refs, qty]) => { refs.forEach((r) => TV.Quote.add(r, qty[r])); }, [REFS, QTY]);
await page.reload();
const f3 = page.locator('[data-quote-form]');
await f3.locator('[name=name]').fill('Marta Prueba'); await f3.locator('[name=email]').fill('cliente.prueba@example.com'); await f3.locator('[name=privacy]').check();
await f3.locator('[name=notes]').fill('Mira esto: <b onmouseover=alert(1)>entrega</b>');
await f3.locator('button[type=submit]').click();
await f3.locator('.err').first().waitFor({ timeout: 4000 });
ok(/solo texto normal/i.test(await f3.locator('.err').first().innerText()) && mails.length === 0 && (await page.evaluate(() => TV.Quote.kinds())) === 3, 'presupuesto: etiquetas HTML en las notas → aviso, no se envía y el presupuesto se conserva');
await f3.locator('[name=notes]').evaluate((el) => { el.value = 'x'.repeat(501); el.dispatchEvent(new Event('input', { bubbles: true })); });
await f3.locator('button[type=submit]').click();
await f3.locator('.err').first().waitFor({ timeout: 4000 });
ok(/demasiado largo.*500/i.test(await f3.locator('.err').first().innerText()), `presupuesto: más de 500 caracteres en las notas: «${await f3.locator('.err').first().innerText()}»`);

console.log('\n4d) tiempo mínimo de relleno: enviar al instante de cargar la página (un robot) no vale; esperando un poco, sí');
await be.setMinFill(1200);
await page.goto(SITE + '/contacto/');
const cf4 = page.locator('[data-contact-form]').first();
const nMsgs2 = (await be.messages()).length;
await cf4.locator('[name=name]').fill('Pedro Contacto'); await cf4.locator('[name=email]').fill('pedro@example.com'); await cf4.locator('[name=message]').fill('Necesito un transformador de 80 VA.'); await cf4.locator('[name=privacy]').check();
const elapsed = await page.evaluate(() => TV.Forms.elapsed());
if (elapsed < 1100) await cf4.locator('button[type=submit]').click(); else console.log('  (la máquina es lenta: ' + elapsed + ' ms desde la carga; se omite el envío «rápido»)');
if (elapsed < 1100) {
  await cf4.locator('[data-sent]:not([hidden])').waitFor({ timeout: 8000 });
  ok(/demasiado rápido/i.test(await cf4.locator('[data-sent]').innerText()) && (await be.messages()).length === nMsgs2, `enviado a los ${elapsed} ms: «${(await cf4.locator('[data-sent]').innerText()).replace(/\s+/g, ' ')}» y no se guardó nada`);
  await page.waitForTimeout(1300);
  await cf4.locator('button[type=submit]').click();
  await page.waitForFunction(() => /recibido/i.test(document.querySelector('[data-contact-form] [data-sent]').textContent), null, { timeout: 8000 });
  ok((await be.messages()).length === nMsgs2 + 1, 'pasado el tiempo mínimo, el mismo formulario se acepta');
}
await be.setMinFill(0);

console.log('\n5) CORS: un origen ajeno no puede usar el API');
const bad = await fetch(API + '/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
ok(bad.status === 403, `origen ajeno → ${bad.status}`);
ok(!errs.length, 'sin errores de consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

await browser.close(); await be.stop();
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : `\n✓ web + ${be.kind}: pedido, contacto y errores correctos`);
process.exit(fails ? 1 : 0);
