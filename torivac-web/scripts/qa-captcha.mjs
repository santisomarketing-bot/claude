#!/usr/bin/env node
// [QA-CAPTCHA] El CAPTCHA invisible OPCIONAL (Cloudflare Turnstile) en los formularios de contacto y de pedido, en un navegador de verdad (Chromium) sobre el paquete desplegado en un Apache real con PHP-FPM:
//   A) SIN claves (cómo se entrega): la página no habla con Cloudflare, no sale el aviso y los formularios funcionan como siempre.
//   B) CON claves, con una RÉPLICA de la API de Cloudflare (determinista, sin red): el script solo se descarga cuando alguien usa el formulario, el token viaja con el envío y el servidor lo comprueba
//      (otra réplica hace de «siteverify»), cada envío pide un token nuevo, y si el token es malo, no llega, el script está bloqueado o tarda demasiado, el formulario lo explica en el idioma de la página sin perder nada.
//      También el formulario de pedido (presupuesto) y la CSP real del .htaccess (sin errores de política en la consola).
//   C) CON claves, con Cloudflare de VERDAD: si desde aquí se llega a challenges.cloudflare.com, se usan las claves de PRUEBA oficiales de Cloudflare (siempre pasa / siempre bloquea, invisibles) y la
//      comprobación real del servidor (siteverify). Si no hay red hasta Cloudflare, esta parte se salta con un aviso (no falla).
// Necesita apache2, php-fpm y Playwright (npm i --no-save playwright); si falta Apache, avisa y sale sin fallo.
//   node scripts/qa-captcha.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { apacheAvailable } from './lib/apache.mjs';
import { deployPackage } from './lib/pkg-apache.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const why = apacheAvailable();
if (why) { console.log(`(se omite: ${why})`); process.exit(0); }
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));

let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const CF = 'https://challenges.cloudflare.com';
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const KEYS = { site: 'REPLICA-SITEKEY-1', secret: 'replica-secret-1234567890' };        // las claves de la réplica
const TEST_KEYS = { ok: '1x00000000000000000000BB', block: '2x00000000000000000000BB', secret: '1x0000000000000000000000000000000AA' };      // claves de PRUEBA oficiales de Cloudflare (invisible: siempre pasa / siempre bloquea; el secreto acepta cualquier token)

// ───────────────────────────────────── la réplica de «siteverify» (lo que el servidor PHP llama para comprobar el token)
const verify = { calls: [] };
const mock = http.createServer((req, res) => {
  const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => {
    const f = new URLSearchParams(Buffer.concat(ch).toString('utf8'));
    verify.calls.push({ secret: f.get('secret'), response: f.get('response'), remoteip: f.get('remoteip') });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: String(f.get('response')).startsWith('REPLICA-OK-') && f.get('secret') === KEYS.secret }));
  });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const MOCK = `http://127.0.0.1:${mock.address().port}/siteverify`;

// ───────────────────────────────────── la réplica del script de Cloudflare (misma API: render, execute, reset, remove)
const FAKE = `(function () {
  var n = 0, widgets = {};
  window.__ts = { renders: [], executes: 0, behavior: 'ok' };
  window.turnstile = {
    /** Crea un widget en el elemento y apunta con qué ajustes se creó (la prueba los lee). */
    render: function (el, o) { var id = 'fake-' + (++n); widgets[id] = { el: el, o: o }; el.setAttribute('data-fake-turnstile', id); window.__ts.renders.push({ id: id, sitekey: o.sitekey, appearance: o.appearance, execution: o.execution, language: o.language, size: o.size, field: o['response-field'] }); return id; },
    /** Lanza la comprobación del widget de ese elemento: según el comportamiento elegido, da un token bueno, uno malo, un error o no contesta. */
    execute: function (el) {
      var w = Object.keys(widgets).map(function (k) { return widgets[k]; }).filter(function (x) { return x.el === el; })[0]; if (!w) throw new Error('widget desconocido');
      var k = ++window.__ts.executes, b = window.__ts.behavior;
      if (b === 'hang') return;
      setTimeout(function () { if (b === 'error') w.o['error-callback']('300030'); else if (b === 'bad') w.o.callback('REPLICA-BAD-' + k); else w.o.callback('REPLICA-OK-' + k); }, 30);
    },
    /** Vuelve el widget a su estado inicial (la réplica no guarda nada). */
    reset: function () {}, remove: function () {}
  };
})();`;

const d = await deployPackage({ staging: true, local: true });
const errs = [];
/** Abre una página nueva (contexto limpio) con los avisos de error recogidos; `replica` sustituye el script de Cloudflare por la réplica y cuenta las descargas. */
async function open(browser, { replica = false, block = false, lang = 'es' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lang + '-ES' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('tv_lang', l); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } }, lang);
  const st = { loads: 0, cf: [], bodies: [] };
  if (replica || block) await ctx.route(CF + '/**', (route) => { st.loads++; return block ? route.abort('blockedbyclient') : route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE }); });
  else ctx.on('request', (r) => { if (r.url().startsWith(CF)) st.cf.push(r.url()); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|blockedbyclient|ERR_BLOCKED/.test(m.text())) errs.push(m.text()); });
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/(contact|order)$/.test(r.url())) st.bodies.push({ url: r.url(), body: JSON.parse(r.postData() || '{}') }); });
  return { ctx, page, st };
}
const contactPath = { es: '/contacto/', en: '/en/contact/', fr: '/fr/contactez-nous/', de: '/de/kontakt-us/' };
/** Rellena el formulario de contacto con datos válidos (tras un envío bueno el formulario se vacía). */
async function fillContact(page, text) {
  d.kvDrop('rl:contact:');                                       // el tope de mensajes por visitante (5 cada 10 minutos) no es lo que se prueba aquí
  const f = form(page);
  await f.locator('[name=name]').fill('Pedro Prueba'); await f.locator('[name=email]').fill('pedro@example.com'); await f.locator('[name=message]').fill(text); await f.locator('[name=privacy]').check();
  return f;
}
/** Rellena el formulario de contacto de la página y lo envía; devuelve el aviso que sale. */
async function sendContact(page, text = 'Necesito un transformador toroidal de 50 VA.') {
  const f = await fillContact(page, text);
  await f.locator('button[type=submit]').click();
  await f.locator('[data-sent]:not([hidden])').waitFor({ timeout: 25000 });
  return (await f.locator('[data-sent]').innerText()).replace(/\s+/g, ' ');
}
/** El formulario de contacto que se ve en la página (según el aspecto hay dos copias en el HTML y solo una se muestra). */
const form = (page) => page.locator('[data-contact-form]:visible').first();
/** Los mensajes de contacto que hay guardados en el servidor (los ve un manager). */
const messages = async () => (await d.api('/messages?limit=100', { token: d.token })).j.items || [];
/** Analiza con axe la pantalla actual y anota las violaciones graves. */
const axe = async (page, label) => {
  if (!AXE) return;
  await page.evaluate(fs.readFileSync(AXE, 'utf8'));
  const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
  const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(bad.length === 0, `accesibilidad (axe) en ${label}: ${bad.length} problemas graves` + (bad.length ? ' — ' + bad.map((v) => `${v.id} (${v.nodes[0].target.join(' ')})`).join('; ') : ''));
};

const browser = await chromium.launch();
try {
  console.log(`web: ${d.BASE} (Apache real + PHP-FPM)`);

  console.log('\nA) sin claves: nada cambia');
  let h = (await d.api('/health')).j;
  ok(h.features && h.features.turnstile === undefined, '/api/health no anuncia ningún CAPTCHA');
  { const { ctx, page, st } = await open(browser);
    await page.goto(d.BASE + contactPath.es);
    await form(page).locator('[name=name]').focus();
    await page.waitForTimeout(700);
    ok(st.cf.length === 0, 'la página no habla con Cloudflare (ni al cargar ni al usar el formulario)');
    ok(await form(page).locator('[data-captcha-note]').isHidden(), 'el aviso del CAPTCHA no se ve');
    ok(!/reCAPTCHA/i.test(await page.locator('body').innerText()), 'y la página ya no dice que está protegida por reCAPTCHA (no lo usa)');
    const txt = await sendContact(page);
    ok(/Mensaje recibido/.test(txt), `el mensaje se envía sin CAPTCHA: «${txt}»`);
    ok((await messages()).length === 1 && st.bodies[0] && !('turnstileToken' in st.bodies[0].body), 'queda guardado y la petición no lleva token');
    await ctx.close(); }

  console.log('\nB) con claves (réplica de Cloudflare)');
  d.setConfig({ turnstile_sitekey: KEYS.site, turnstile_secret: KEYS.secret, turnstile_url: MOCK });
  h = (await d.api('/health')).j;
  ok(h.features.turnstile && h.features.turnstile.sitekey === KEYS.site && !JSON.stringify(h).includes(KEYS.secret), '/api/health anuncia la clave pública y nunca el secreto');
  { const { ctx, page, st } = await open(browser, { replica: true });
    await page.goto(d.BASE + contactPath.es);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-contact-form] [data-captcha-note]')].some((n) => !n.hidden));
    ok(/Cloudflare Turnstile/.test(await form(page).locator('[data-captcha-note]').innerText()), 'sale el aviso «protegido por Cloudflare Turnstile»');
    await page.waitForTimeout(500);
    ok(st.loads === 0, 'al cargar la página NO se descarga el script de Cloudflare (no pesa en la carga ni en el LCP)');
    await form(page).locator('[name=name]').focus();
    await page.waitForFunction(() => window.__ts && window.__ts.renders.length === 1);
    ok(st.loads === 1, 'al empezar a usar el formulario se descarga (una vez)');
    const r0 = await page.evaluate(() => window.__ts.renders[0]);
    ok(r0.sitekey === KEYS.site && r0.appearance === 'interaction-only' && r0.execution === 'execute' && r0.language === 'es' && r0.field === false, `el widget se crea invisible, a la espera de enviar (${JSON.stringify(r0)})`);
    ok(await page.evaluate(() => window.__ts.executes) === 0, 'y todavía no ha lanzado ninguna comprobación');
    await axe(page, 'el formulario de contacto con el aviso del CAPTCHA');
    const t1 = await sendContact(page, 'Primer mensaje con CAPTCHA.');
    ok(/Mensaje recibido/.test(t1), 'con el token bueno, el mensaje se envía');
    const b1 = st.bodies.at(-1).body;
    ok(/^REPLICA-OK-\d+$/.test(b1.turnstileToken || ''), `la petición lleva el token (${b1.turnstileToken})`);
    ok(verify.calls.length === 1 && verify.calls[0].secret === KEYS.secret && verify.calls[0].response === b1.turnstileToken && verify.calls[0].remoteip, 'el servidor lo comprobó con el secreto, el token y la IP del visitante');
    ok((await messages()).length === 2, 'y el mensaje quedó guardado');
    const t2 = await sendContact(page, 'Segundo mensaje con CAPTCHA.');
    ok(/Mensaje recibido/.test(t2) && st.bodies.at(-1).body.turnstileToken !== b1.turnstileToken && await page.evaluate(() => window.__ts.executes) === 2 && st.loads === 1, 'cada envío pide un token nuevo (un token vale una vez) sin volver a descargar el script');

    console.log('\n   fallos que el visitante puede encontrarse');
    const n0 = (await messages()).length;
    await page.evaluate(() => { window.__ts.behavior = 'bad'; });
    await fillContact(page, 'Este usa un token falso.');
    await form(page).locator('button[type=submit]').click();
    await form(page).locator('[data-sent]:not([hidden])').waitFor();
    let say = (await form(page).locator('[data-sent]').innerText()).replace(/\s+/g, ' ');
    ok(/No hemos podido comprobar que eres una persona/.test(say) && /bloqueador de contenido/.test(say), `token falso → el servidor lo rechaza y la página lo explica: «${say.slice(0, 90)}…»`);
    ok((await messages()).length === n0, 'y no se guarda ningún mensaje');
    ok(await form(page).locator('button[type=submit]').isEnabled() && await form(page).locator('[name=message]').inputValue() === 'Este usa un token falso.', 'el botón vuelve a estar activo y lo escrito no se pierde');
    await page.evaluate(() => { window.__ts.behavior = 'error'; });
    await form(page).locator('button[type=submit]').click();
    await page.waitForFunction(() => window.__ts.executes === 4);
    await page.waitForTimeout(500);
    ok(!('turnstileToken' in st.bodies.at(-1).body) && /No hemos podido comprobar/.test(await form(page).locator('[data-sent]').innerText()), 'si Cloudflare da error, se envía sin token y el servidor lo rechaza con el mismo aviso');
    await page.evaluate(() => { window.__ts.behavior = 'hang'; TV.Captcha.wait = 600; });
    await form(page).locator('button[type=submit]').click();
    await page.waitForFunction(() => window.__ts.executes === 5);
    await page.waitForTimeout(1500);
    ok(!('turnstileToken' in st.bodies.at(-1).body) && st.bodies.length === 5 && await form(page).locator('button[type=submit]').isEnabled(), 'si la comprobación no termina (se espera lo justo), se envía sin token y el formulario queda usable');
    ok((await messages()).length === n0, 'ninguno de esos intentos guardó nada');
    await ctx.close(); }

  { const { ctx, page, st } = await open(browser, { block: true });
    await page.goto(d.BASE + contactPath.es);
    await form(page).locator('[name=name]').focus();
    await page.waitForTimeout(400);
    const n0 = (await messages()).length;
    const f = await fillContact(page, 'Con el bloqueador activado.');
    await f.locator('button[type=submit]').click();
    await f.locator('[data-sent]:not([hidden])').waitFor();
    const sayB = await f.locator('[data-sent]').innerText();
    ok(st.loads >= 1 && /No hemos podido comprobar que eres una persona/.test(sayB) && (await messages()).length === n0, 'con el script de Cloudflare bloqueado (bloqueador de contenido), el visitante lo lee en la página y no se guarda nada' + (st.loads >= 1 && /No hemos podido comprobar/.test(sayB) ? '' : ` — descargas: ${st.loads} · aviso: «${sayB}» · mensajes: ${(await messages()).length} (antes ${n0})`));
    await ctx.close(); }

  for (const lang of ['en', 'fr', 'de']) {
    const { ctx, page } = await open(browser, { replica: true, lang });
    await page.goto(d.BASE + contactPath[lang]);
    await form(page).locator('[name=name]').focus();
    await page.waitForFunction(() => window.__ts && window.__ts.renders.length === 1);
    await page.evaluate(() => { window.__ts.behavior = 'bad'; });
    const f = await fillContact(page, 'Test.');
    await f.locator('button[type=submit]').click();
    await f.locator('[data-sent]:not([hidden])').waitFor();
    const say = await f.locator('[data-sent]').innerText();
    const note = await f.locator('[data-captcha-note]').innerText();
    const exp = { en: [/could not verify that you are a person/, /Cloudflare Privacy Policy/], fr: [/pas pu vérifier que vous êtes une personne/, /Cloudflare/], de: [/nicht prüfen, ob Sie ein Mensch sind/, /Cloudflare/] }[lang];
    const wl = await page.evaluate(() => window.__ts.renders[0].language);
    ok(exp[0].test(say) && exp[1].test(note) && wl === lang, `${lang.toUpperCase()}: el aviso y el error salen en el idioma de la página y el widget recibe el idioma` + (exp[0].test(say) && exp[1].test(note) && wl === lang ? '' : ` — error: «${say}» · aviso: «${note}» · idioma del widget: ${wl}`));
    await ctx.close();
  }

  console.log('\n   formulario de pedido (presupuesto)');
  { const { ctx, page, st } = await open(browser, { replica: true });
    await page.goto(d.BASE + '/presupuesto/');
    await page.evaluate(() => { const r = Object.keys(TV.items).find((k) => TV.items[k].pid && !TV.items[k].d) || Object.keys(TV.items)[0]; TV.Quote.add(r, 3); });
    await page.reload();
    await page.waitForFunction(() => { const n = document.querySelector('[data-quote-form] [data-captcha-note]'); return n && !n.hidden; });
    const f = page.locator('[data-quote-form]');
    d.kvDrop('rl:order:');
    await f.locator('[name=name]').fill('Marta Prueba'); await f.locator('[name=email]').fill('marta@example.com'); await f.locator('[name=privacy]').check();
    await f.locator('button[type=submit]').click();
    await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 25000 });
    const body = st.bodies.find((b) => /\/api\/order$/.test(b.url));
    ok(body && /^REPLICA-OK-\d+$/.test(body.body.turnstileToken || '') && /TV-\d{8}-/.test(await page.locator('[data-sent]').innerText()), 'el pedido también lleva su token y el servidor lo acepta');
    ok(verify.calls.some((c) => c.response === body.body.turnstileToken), 'y lo comprobó con «siteverify»');
    await page.evaluate(() => { window.__ts.behavior = 'bad'; TV.Quote.add(Object.keys(TV.items)[0], 1); });
    await page.reload(); await page.locator('[data-quote-form] [name=name]').focus(); await page.waitForFunction(() => window.__ts && window.__ts.renders.length === 1);
    await page.evaluate(() => { window.__ts.behavior = 'bad'; });
    await f.locator('[name=name]').fill('Marta Prueba'); await f.locator('[name=email]').fill('marta@example.com'); await f.locator('[name=privacy]').check();
    await f.locator('button[type=submit]').click();
    await page.locator('[data-sent]:not([hidden])').waitFor();
    ok(/No hemos podido comprobar que eres una persona/.test(await page.locator('[data-sent]').innerText()) && (await page.evaluate(() => TV.Quote.kinds())) >= 1, 'con token malo, el pedido no se envía, se explica y el presupuesto se conserva');
    await ctx.close(); }

  console.log('\nC) con Cloudflare de verdad (claves de prueba oficiales)');
  const real = await chromium.launch(PROXY ? { proxy: { server: PROXY, bypass: '127.0.0.1,localhost,::1' } } : {});          // por el proxy del entorno solo sale lo de fuera (Cloudflare); la web de prueba (127.0.0.1) va directa
  const reach = await (async () => { try { const p = await (await real.newContext()).newPage(); const r = await p.goto(CF + '/turnstile/v0/api.js', { timeout: 15000 }); return !!r && r.status() === 200; } catch { return false; } })();
  if (!reach) console.log('  (se salta: desde aquí no se llega a challenges.cloudflare.com)');
  else {
    d.setConfig({ turnstile_sitekey: TEST_KEYS.ok, turnstile_secret: TEST_KEYS.secret, turnstile_url: undefined });
    { const { ctx, page, st } = await open(real);
      await page.goto(d.BASE + contactPath.es);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-contact-form] [data-captcha-note]')].some((n) => !n.hidden));
      ok(st.cf.length === 0, 'al cargar la página no hay ninguna petición a Cloudflare');
      await form(page).locator('[name=name]').focus();
      await page.waitForFunction(() => window.turnstile && [...document.querySelectorAll('[data-contact-form]')].some((f) => f.offsetParent && f.__captcha && f.__captcha.id), null, { timeout: 15000 });
      ok(st.cf.some((u) => /\/turnstile\/v0\/.*api\.js/.test(u)), 'al usar el formulario se descarga el script real de Cloudflare y se crea el widget (la CSP del .htaccess lo permite)');
      const n0 = (await messages()).length;
      const txt = await sendContact(page, 'Mensaje con Cloudflare Turnstile de verdad.');
      const tok = st.bodies.at(-1).body.turnstileToken;
      ok(/Mensaje recibido/.test(txt) && typeof tok === 'string' && tok.length > 10 && (await messages()).length === n0 + 1, `el widget real da un token (${String(tok).slice(0, 20)}…), el servidor lo comprueba con la API real de Cloudflare y el mensaje se guarda`);
      await ctx.close(); }
    d.setConfig({ turnstile_sitekey: TEST_KEYS.block });
    { const { ctx, page, st } = await open(real);
      await page.goto(d.BASE + contactPath.es);
      await form(page).locator('[name=name]').focus();
      await page.waitForFunction(() => window.turnstile && [...document.querySelectorAll('[data-contact-form]')].some((f) => f.offsetParent && f.__captcha && f.__captcha.id), null, { timeout: 15000 });
      const n0 = (await messages()).length;
      const f = await fillContact(page, 'Con la clave que siempre bloquea.');
      await f.locator('button[type=submit]').click();
      await f.locator('[data-sent]:not([hidden])').waitFor({ timeout: 30000 });
      ok(/No hemos podido comprobar que eres una persona/.test(await f.locator('[data-sent]').innerText()) && (await messages()).length === n0, 'con la clave de prueba que siempre bloquea, no se envía y se explica');
      await ctx.close(); }
  }
  await real.close();

  console.log('\nD) errores de la página');
  ok(errs.length === 0, `sin errores de JavaScript ni de política de seguridad (CSP) en la consola (${errs.length})` + (errs.length ? ' — ' + errs.slice(0, 4).join(' | ') : ''));
} catch (e) {
  fails++; console.error('  ✗ la prueba se interrumpió: ' + (e && e.stack || e));
  console.error(d.ap.log());
} finally {
  await browser.close();
  mock.close();
  await d.stop();
}
if (fails) { console.error(`\n${fails} comprobación(es) fallida(s)`); process.exit(1); }
console.log('\nTodo bien: CAPTCHA invisible opcional');
