#!/usr/bin/env node
// [QA-LIVE] Sesión 9/6 · La web de producción contra el Worker REAL (workers/api) en memoria: sin red, sin enviar correo de verdad.
//   node scripts/qa-live.mjs
// Cadena: navegador (Playwright) → dist/ servido por http → Worker torivac-api (KV en memoria, Resend simulado).
// Se comprueba: pedido con PDF adjunto a info@ y mzamora@ + copia al cliente, repricing en servidor, vaciado del presupuesto,
// fallo del servidor (mensaje + mailto, el presupuesto se conserva), honeypot, formulario de contacto, CORS.
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const { default: worker } = await import(path.join(ROOT, 'workers/api/src/index.js'));
const { FakeKV } = await import(path.join(ROOT, 'workers/api/test/helpers.js'));
const { KEY_CURRENT } = await import(path.join(ROOT, 'workers/api/src/prices.js'));

// ───────────────────────────────────────── [DATA]
const sb = { window: {} }; sb.window = sb; vm.createContext(sb);
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data', f), 'utf8'), sb);
const { items, prices } = sb.TV;
const REFS = ['P884', 'P8339', 'P932'], QTY = { P884: 12, P8339: 2, P932: 200 };
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const unit = (ref, q) => { const p = prices.items[ref]; let u = p.p; for (const [m, x] of p.t || []) if (q >= m) u = x; return u; };
const expTotal = round2(REFS.reduce((s, r) => s + round2(unit(r, QTY[r]) * QTY[r]), 0));

// ───────────────────────────────────────── [SITE] + [WORKER]
const { server: site, base: SITE } = await serve(DIST);
const env = { KV: new FakeKV(), ORDER_TO: 'info@torivac.com,mzamora@torivac.com', ORDER_FROM: 'Torivac Web <pedidos@torivac.com>', RESEND_API_KEY: 're_test', SESSION_SECRET: 'x'.repeat(40), ADMIN_API_TOKEN: 'master-test', ALLOWED_ORIGINS: SITE };
await env.KV.put(KEY_CURRENT, JSON.stringify({ ...prices, mode: 'live', updated_at: new Date().toISOString() }));
const mails = []; let failNext = false;
const mockFetch = async (url, init) => { if (String(url).includes('api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'mail_' + mails.length }), { status: 200 }); } throw new Error('red no permitida en el test: ' + url); };
const api = http.createServer(async (rq, rs) => {
  const chunks = []; for await (const c of rq) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://127.0.0.1:${api.address().port}${rq.url}`, { method: rq.method, headers: rq.headers, body: ['GET', 'HEAD'].includes(rq.method) ? undefined : body });
  const res = failNext && rq.url.startsWith('/api/order') && rq.method === 'POST' ? (failNext = false, new Response(JSON.stringify({ ok: false, error: 'fallo simulado' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': SITE } })) : await worker.fetch(request, env, {}, { fetchImpl: mockFetch });
  rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
});
await new Promise((r) => api.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${api.address().port}`;

// ───────────────────────────────────────── [BROWSER]
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } });
// el sitio se compila SIN API (demo); aquí se le «enchufa» el Worker como haría TORIVAC_API en el build de producción
await ctx.route('**/assets/data/catalog.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + `\nTV.meta.api=${JSON.stringify(API)};TV.meta.demo=false;\n` }); });
const page = await ctx.newPage();
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
const num = (sent.match(/TV-\d{8}-\d{4}/) || [])[0];
ok(!!num, `número de pedido del servidor: ${num}`);
ok(/recibido|copia/i.test(sent), `mensaje de éxito: «${sent.replace(/\s+/g, ' ').slice(0, 90)}»`);
ok((await page.evaluate(() => TV.Quote.count())) === 0, 'el presupuesto se vacía tras enviarlo');
ok(mails.length === 2, `2 correos (equipo + copia al cliente): ${mails.length}`);
const team = mails[0] || {}, copy = mails[1] || {};
ok(JSON.stringify(team.to) === JSON.stringify(['info@torivac.com', 'mzamora@torivac.com']), `equipo: ${JSON.stringify(team.to)}`);
ok(team.reply_to === 'cliente.prueba@example.com' || team.replyTo === 'cliente.prueba@example.com' || JSON.stringify(team).includes('cliente.prueba@example.com'), 'responder-a = cliente');
ok(JSON.stringify(copy.to) === JSON.stringify(['cliente.prueba@example.com']), 'copia al cliente');
const att = (team.attachments || [])[0];
ok(att && /\.pdf$/.test(att.filename) && String(att.content).startsWith('JVBER'), `PDF adjunto (${att && att.filename}, ${att ? Math.round(att.content.length * 0.75 / 1024) : 0} KB)`);
for (const r of REFS) ok(String(team.html).includes(r), `el correo incluye ${r}`);
const stored = JSON.parse((await env.KV.get(`order:${num}`)) || 'null');
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
ok(JSON.stringify(cm.to) === JSON.stringify(['info@torivac.com', 'mzamora@torivac.com']) && /toroidal/.test(JSON.stringify(cm)), 'llega a info@ y mzamora@ con el texto del mensaje');

console.log('\n5) CORS: un origen ajeno no puede usar el API');
const bad = await fetch(API + '/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
ok(bad.status === 403, `origen ajeno → ${bad.status}`);
ok(!errs.length, 'sin errores de consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

await browser.close(); site.close(); api.close();
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ web + Worker: pedido, contacto y errores correctos');
process.exit(fails ? 1 : 0);
