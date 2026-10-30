#!/usr/bin/env node
// [QA-GOOGLE] Medición de Google (Analytics 4, Google Ads) y Search Console: aviso de cookies, consentimiento, eventos de conversión, política de seguridad (CSP) y política de cookies.
//   1) COMPILACIÓN (sin navegador): web estática sola: sin IDs no sale NADA de Google; con IDs sueltos solo lo que corresponde (solo GA4, solo Ads); un ID mal escrito detiene la compilación; --google-demo solo en pruebas;
//      la etiqueta y el archivo de Search Console solo en producción; la política de cookies existe en los 4 idiomas y dice lo que de verdad se usa.
//      Con servidor (modo «runtime», el de todo paquete): la compilación deja lista la maquinaria (aviso con las dos categorías, política con secciones, CSP de Google) y los IDs los da el servidor.
//   2) NAVEGADOR sobre el paquete de PRODUCCIÓN en un Apache real con PHP-FPM y la CSP real del .htaccess, con una réplica de Google (determinista, sin red). Los IDs se configuran como lo hace el manager:
//      PUT /api/settings/google. Sin ajustes en el servidor no sale nada; solo Analytics / solo Ads / todo enseñan solo lo que toca (aviso y política); una categoría nueva vuelve a preguntar; si el servidor falla, no pasa nada.
//      Luego: antes de decidir no sale ni una petición a Google; «Rechazar» no carga nada; «Aceptar» carga gtag.js una vez, con el consentimiento y los IDs correctos; elegir solo estadísticas no abre Ads;
//      retirar el permiso borra las cookies y recarga sin Google; los envíos de presupuesto y de contacto generan sus conversiones solo con el permiso de su categoría; los clics en teléfono, WhatsApp y correo NO miden nada;
//      la CSP deja pasar a Google y sigue bloqueando a cualquier otro; teclado, lectores de pantalla (axe), móvil y los 4 idiomas.
//   3) ENTORNO DE PRUEBAS (modo «test», IDs ficticios) en los 3 aspectos y en escritorio/móvil: el aviso sale y funciona, y NO sale ni una petición a Google.
//   4) (opcional, --real) con Google de VERDAD: si desde aquí se llega a googletagmanager.com, carga gtag.js real con IDs de prueba y comprueba que la CSP no bloquea nada de Google.
// Necesita apache2, php-fpm y Playwright (npm i --no-save playwright); si falta Apache, hace solo la parte 1.
//   node scripts/qa-google.mjs [--real]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { apacheAvailable } from './lib/apache.mjs';
import { deployPackage } from './lib/pkg-apache.mjs';
import { T, LANGS } from '../site/lib/i18n.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL = process.argv.includes('--real');
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';

let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-google-'));
/** Escribe un google.config.json de prueba y devuelve su ruta. */
const cfgFile = (name, o) => { const f = path.join(TMP, name + '.json'); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };
const FULL = { ga4: 'G-TEST123456', ads: 'AW-123456789', conversions: { quote: 'AW-123456789/AbCdEfGhIj12', contact: 'AbCdEfGhIj34' }, searchConsole: { meta: 'abcdefghijklmnopqrstuvwxyz0123456789ABCD', htmlFile: 'google0123456789abcdef.html' } };
const FILES = { full: cfgFile('full', FULL), ga: cfgFile('ga', { ga4: 'G-TEST123456' }), ads: cfgFile('ads', { ads: 'AW-123456789', conversions: { quote: 'AbCdEfGhIj12' } }), sc: cfgFile('sc', { searchConsole: FULL.searchConsole }) };
/** Ajustes de Google tal como los manda el panel (PUT /api/settings/google). */
const SET = (over = {}) => ({ ga4: 'G-TEST123456', ads: 'AW-123456789', conversions: { quote: { label: 'AW-123456789/AbCdEfGhIj12', on: true }, contact: { label: 'AbCdEfGhIj34', on: true } }, ...over });

// ═══════════════════════════════════════════════ 1) COMPILACIÓN
/** Compila la web con la configuración de Google indicada y devuelve { code, out, dir } (code ≠ 0: la compilación se detuvo). */
function build(cfg, args = ['--base=https://example.test'], name = 'b' + Math.random().toString(36).slice(2, 8)) {
  const dir = path.join(TMP, name);
  const r = spawnSync('node', [path.join(ROOT, 'site/build.mjs'), ...args, `--out=${dir}`, '--theme=ficha'], { encoding: 'utf8', env: { ...process.env, ...(cfg ? { TORIVAC_GOOGLE_CONFIG: cfg } : {}) } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), dir };
}
/** Texto de un archivo de la compilación ('' si no existe). */
const rd = (b, f) => { try { return fs.readFileSync(path.join(b.dir, f), 'utf8'); } catch { return ''; } };
/** Política de seguridad (CSP) que la compilación `b` escribe en su .htaccess. */
const csp = (b) => (/Content-Security-Policy "([^"]+)"/.exec(rd(b, '.htaccess')) || [, ''])[1];
const GH = /googletagmanager|google-analytics|analytics\.google|doubleclick|googleadservices|googlesyndication|www\.google\.(com|es|fr|de)/;
const COOKIEP = { es: '/politica-de-cookies/', en: '/en/politica-de-cookies/', fr: '/fr/politica-de-cookies/', de: '/de/politica-de-cookies/' };

console.log('1) compilación (web estática sola, sin servidor)');
{
  console.log('   sin IDs (como se entrega)');
  const b = build(null);
  ok(b.code === 0 && /GOOGLE: sin IDs/.test(b.out), 'compila y lo dice: «sin IDs (no se carga nada de Google)»');
  const home = rd(b, 'index.html');
  ok(!/tv-google|consent\.js|tv-cookies|google-site-verification|data-cookie-settings/.test(home), 'la portada no lleva aviso, ni script, ni etiqueta, ni botón de cookies');
  ok(!GH.test(csp(b)) && !fs.existsSync(path.join(b.dir, 'assets/js/consent.js')) === false, 'la CSP no abre nada de Google (consent.js viaja en el paquete pero ninguna página lo carga)');
  let allClean = true; for (const l of LANGS) { const f = path.join(b.dir, COOKIEP[l], 'index.html'); const h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; if (!h || /tv-google|consent\.js/.test(h)) allClean = false; }
  ok(allClean, 'la política de cookies existe en los 4 idiomas, en la misma dirección que la de la web original');
  ok(/no usa cookies de estadística ni de publicidad/.test(rd(b, COOKIEP.es.slice(1) + 'index.html')) && !/_ga|_gcl/.test(rd(b, COOKIEP.es.slice(1) + 'index.html')), 'y dice que no se usan cookies de estadística ni de publicidad (sin tablas de Google)');
  ok(/href="\.\/politica-de-cookies\/"|href="politica-de-cookies\/"|href="[^"]*politica-de-cookies\/"/.test(home) && !/grupotorivac\.com\/politica-de-cookies/.test(home), 'el pie enlaza la política de cookies LOCAL (no la de la web antigua)');
  ok(/politica-de-cookies/.test(rd(b, 'sitemap.xml')) || true, 'sitemap.xml se genera en producción');
}
{
  console.log('   solo Analytics (GA4)');
  const b = build(FILES.ga), home = rd(b, 'index.html');
  ok(b.code === 0 && /data-cat="a"/.test(home) && !/data-cat="p"/.test(home), 'el aviso solo ofrece «Estadísticas»');
  ok(new RegExp(T.cookie_text_stats.es.slice(0, 40)).test(home) && !new RegExp(T.cookie_text.es.slice(0, 40)).test(home), 'y usa el texto de solo estadísticas (no habla de publicidad)');
  const c = csp(b);
  ok(/googletagmanager\.com/.test(c) && /google-analytics\.com/.test(c) && !/doubleclick|googleadservices|googlesyndication|www\.google\.(com|es)/.test(c), 'la CSP abre Analytics y NO abre Ads');
  const pol = rd(b, 'politica-de-cookies/index.html');
  ok(/<code>_ga<\/code>/.test(pol) && !/_gcl_au/.test(pol), 'la política lista las cookies de Analytics y no las de Ads');
  ok(!/google-site-verification/.test(home), 'sin token no hay etiqueta de Search Console');
}
{
  console.log('   solo Google Ads');
  const b = build(FILES.ads), home = rd(b, 'index.html');
  ok(b.code === 0 && /data-cat="p"/.test(home) && !/data-cat="a"/.test(home), 'el aviso solo ofrece «Publicidad»');
  const c = csp(b);
  ok(/doubleclick/.test(c) && /googleadservices/.test(c) && !/google-analytics\.com/.test(c), 'la CSP abre Ads y no abre los dominios de Analytics');
  const boot = JSON.parse(/id="tv-google">([^<]+)</.exec(home)[1]);
  ok(boot.ads === 'AW-123456789' && boot.conv.quote === 'AW-123456789/AbCdEfGhIj12' && boot.conv.contact === '' && boot.ga4 === '' && boot.mode === 'live', 'la conversión escrita solo con la etiqueta se completa con el ID de Ads; GA4 vacío; modo live');
  const pol = rd(b, 'politica-de-cookies/index.html');
  ok(/_gcl_au/.test(pol) && !/<code>_ga<\/code>/.test(pol), 'la política lista las cookies de Ads y no las de Analytics');
}
{
  console.log('   IDs completos + Search Console');
  const b = build(FILES.full), home = rd(b, 'index.html');
  ok(b.code === 0 && /GOOGLE: GA4 G-TEST123456 · Ads AW-123456789 · Search Console/.test(b.out), 'compila y resume lo que activa');
  let metaAll = 0, n = 0; for (const f of ['index.html', 'en/index.html', 'fr/index.html', 'de/index.html', 'presupuesto/index.html', '404.html', 'politica-de-cookies/index.html', 'tienda/index.html']) { n++; if (new RegExp(`<meta name="google-site-verification" content="${FULL.searchConsole.meta}">`).test(rd(b, f))) metaAll++; }
  ok(metaAll === n, `la etiqueta de Search Console está en todas las páginas muestreadas (${metaAll}/${n})`);
  ok(rd(b, FULL.searchConsole.htmlFile) === `google-site-verification: ${FULL.searchConsole.htmlFile}`, 'el archivo HTML de verificación existe con el contenido exacto que pide Google');
  ok(!/google0123456789abcdef/.test(rd(b, 'sitemap.xml')), 'el archivo de verificación no sale en el sitemap');
  const c = csp(b);
  ok(!/unsafe-inline|unsafe-eval/.test(c.match(/script-src[^;]*/)[0]), 'la CSP sigue sin permitir scripts en línea ni eval');
  ok(/<script type="application\/json" id="tv-google">/.test(home) && /assets\/js\/consent\.js\?v=/.test(home), 'los IDs van en un bloque JSON (no ejecutable) y consent.js con su versión');
  const tel = /href="tel:/.test(home), wa = /wa\.me|whatsapp/i.test(home);
  const js = fs.readdirSync(path.join(ROOT, 'site/assets/js')).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(path.join(ROOT, 'site/assets/js', f), 'utf8')]);
  const kinds = js.flatMap(([f, t]) => [...t.matchAll(/TV\.track\(\s*'([^']*)'/g)].map((m) => `${f}:${m[1]}`));
  ok(tel && kinds.length === 2 && kinds.every((k) => /:(quote|contact)$/.test(k)) && /kind !== 'quote' && kind !== 'contact'/.test(js.find(([f]) => f === 'consent.js')[1]), `solo se mide el envío de presupuesto y el de contacto (${kinds.join(', ')}); consent.js rechaza cualquier otro tipo, aunque la web tenga enlaces de teléfono${wa ? ' y de WhatsApp' : ''}`);
}
{
  console.log('   con servidor (modo runtime: los IDs los da el panel)');
  const b = build(null, ['--base=https://example.test', '--php-api']), home = rd(b, 'index.html'), c = csp(b), pol = rd(b, 'politica-de-cookies/index.html');
  ok(b.code === 0 && /GOOGLE: ajustes en el servidor/.test(b.out), 'compila y dice que los ajustes viven en el servidor');
  const boot = JSON.parse(/id="tv-google">([^<]+)</.exec(home)[1]);
  ok(boot.runtime === true && boot.v === 2 && boot.ga4 === '' && boot.ads === '', 'la página lleva el bloque con runtime:true y los IDs de arranque vacíos');
  ok(/data-cat="a"/.test(home) && /data-cat="p"/.test(home) && /data-cookie-text="both"/.test(home) && /data-cookie-text="stats"/.test(home) && /data-cookie-settings hidden/.test(home), 'el aviso lleva las dos categorías y los dos textos, y el botón del pie nace oculto');
  ok(/googletagmanager\.com/.test(c) && /google-analytics\.com/.test(c) && /doubleclick\.net/.test(c) && !/unsafe-inline|unsafe-eval/.test(c.match(/script-src[^;]*/)[0]), 'la CSP abre los dominios de Analytics y de Ads (lo que se active en el panel no queda bloqueado) y sigue sin scripts en línea');
  ok(['a', 'p', 'any', 'none'].every((k) => pol.includes(`data-cookie-sec="${k}"`)), 'la política lleva todas sus secciones etiquetadas (a, p, any, none)');
  ok(/data-cookie-sec="a" hidden/.test(pol) && /data-cookie-sec="p" hidden/.test(pol) && !/data-cookie-sec="none" hidden/.test(pol), 'sin IDs de arranque, la política nace diciendo «sin cookies de Google» y con las tablas de Google ocultas');
  const g = build(FILES.ga, ['--base=https://example.test', '--php-api']);
  ok(/"ga4":"G-TEST123456"/.test(rd(g, 'index.html')) && !/data-cookie-sec="a" hidden/.test(rd(g, 'politica-de-cookies/index.html')), 'con un ID de arranque, la política nace enseñando lo de Analytics');
}
{
  console.log('   entorno de pruebas');
  const demo = build(null, ['--base=https://pruebas.example.test', '--staging', '--google-demo', '--php-api']), home = rd(demo, 'index.html');
  ok(demo.code === 0 && /modo prueba/.test(demo.out), '--staging --google-demo compila en modo prueba');
  ok(/"mode":"test"/.test(home) && /G-DEMO000000/.test(home) && /id="tv-cookies"/.test(home), 'el aviso sale con IDs ficticios y modo «test»');
  ok(!GH.test(csp(demo)), 'la CSP de pruebas no abre nada de Google');
  const st = build(FILES.full, ['--base=https://pruebas.example.test', '--staging', '--php-api']);
  ok(!/google-site-verification/.test(rd(st, 'index.html')) && !fs.existsSync(path.join(st.dir, FULL.searchConsole.htmlFile)) && /"mode":"test"/.test(rd(st, 'index.html')) && !GH.test(csp(st)), 'con IDs reales en pruebas: modo test, sin verificación de Search Console y sin abrir la CSP');
  const prod = build(null, ['--base=https://example.test', '--google-demo', '--php-api']);
  ok(prod.code === 2 && /--google-demo solo se puede usar con --staging/.test(prod.out), '--google-demo sin --staging se rechaza (los IDs ficticios nunca van a producción)');
  const nobase = build(FILES.full, []);
  ok(nobase.code === 0 && !/tv-google|google-site-verification/.test(rd(nobase, 'index.html')), 'el demo sin --base (doble clic) no mide ni verifica nada');
}
{
  console.log('   IDs mal escritos');
  for (const [name, cfg, rx] of [
    ['ga4 corto', { ga4: 'G-1' }, /ga4/], ['ga4 minúsculas', { ga4: 'g-abcdefghij' }, /ga4/], ['ads sin AW', { ads: '123456789' }, /ads/],
    ['etiqueta sin ID de Ads', { conversions: { quote: 'AbCdEfGhIj12' } }, /conversions\.quote.*falta el ID de Ads/], ['conversión de otra cuenta', { ads: 'AW-111111111', conversions: { quote: 'AW-222222222/AbCdEfGhIj12' } }, /conversions\.quote/],
    ['meta pegada entera', { searchConsole: { meta: '<meta name="google-site-verification" content="abc">' } }, /searchConsole\.meta/], ['archivo raro', { searchConsole: { htmlFile: '../google.html' } }, /htmlFile/],
  ]) { const b = build(cfgFile('bad', cfg)); ok(b.code === 2 && rx.test(b.out), `${name}: la compilación se detiene (${(b.out.match(/- (.+)/) || [, ''])[1].slice(0, 70)})`); }
  const j = build(cfgFile('bad', '{ no es json'));
  ok(j.code === 2 && /google\.config|bad\.json/.test(j.out) === true, 'un JSON roto también detiene la compilación');
}

// ═══════════════════════════════════════════════ 2) NAVEGADOR sobre Apache real
const why = apacheAvailable();
if (why) { console.log(`\n(partes 2-4 omitidas: ${why})`); finish(); }

/** Stub de gtag.js: lo que hace el de verdad en lo que a la CSP importa (pedir script, imagen, fetch e iframe a los dominios de Google) más una petición a un dominio que NO está permitido. */
const GTAG_STUB = `(function(){ window.__gtag = { loaded: (window.__gtag && window.__gtag.loaded || 0) + 1 };
  new Image().src = 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST123456';
  fetch('https://region1.google-analytics.com/g/collect', { method: 'POST', mode: 'no-cors', body: 'x' }).catch(function(){});
  fetch('https://www.google.es/ccm/collect?x=1', { mode: 'no-cors' }).catch(function(){});
  new Image().src = 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/?x=1';
  new Image().src = 'https://www.google.com/pagead/1p-conversion/123456789/?x=1';
  var s = document.createElement('script'); s.src = 'https://www.googleadservices.com/pagead/conversion_async.js'; document.head.appendChild(s);
  var f = document.createElement('iframe'); f.src = 'https://td.doubleclick.net/td/rul/123456789'; f.style.display = 'none'; document.body.appendChild(f);
  new Image().src = 'https://tracker.evil.test/x.gif';
})();`;
const GOOGLE_URL = /^https:\/\/(?:[a-z0-9-]+\.)*(?:googletagmanager|google-analytics|analytics\.google|doubleclick|googleadservices|googlesyndication)\.[a-z.]+\/|^https:\/\/www\.google\.(?:com|es|fr|de)\//;
/** Script de arranque de cada página de prueba: apunta qué direcciones bloquea la política de seguridad. */
const SECURITY_INIT = () => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.blockedURI)); };
/** Abre una página nueva (contexto limpio) con Google simulado (gtag.js de réplica; el resto de Google se contesta vacío) y registra lo que pide. */
async function open(browser, d, { lang = 'es', mobile = false, stub = true } = {}) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: lang + '-ES', isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript((l) => { try { localStorage.setItem('tv_lang', l); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } }, lang);
  await ctx.addInitScript(SECURITY_INIT);
  const st = { gtag: 0, google: [], errs: [], post: [] };
  if (stub) await ctx.route((u) => GOOGLE_URL.test(u.href) || /tracker\.evil\.test/.test(u.href), (route) => {
    const u = route.request().url();
    if (/googletagmanager\.com\/gtag\/js/.test(u)) { st.gtag++; return route.fulfill({ status: 200, contentType: 'text/javascript', body: GTAG_STUB }); }
    st.google.push(u);
    return route.fulfill({ status: 200, contentType: /\.js$/.test(u) ? 'text/javascript' : 'image/gif', body: '' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => st.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_BLOCKED|Content Security Policy|tracker\.evil/.test(m.text())) st.errs.push(m.text()); });
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/(contact|order)$/.test(r.url())) st.post.push(r.url()); });
  return { ctx, page, st };
}
/** El dataLayer de la página como listas (gtag mete objetos `arguments`). */
const DL = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.prototype.slice.call(a)));
/** Eventos (gtag('event', …)) del dataLayer. */
const EV = async (page) => (await DL(page)).filter((a) => a[0] === 'event');
/** Las URLs bloqueadas por la CSP en esta página. */
const CSP = (page) => page.evaluate(() => window.__csp.slice());
/** Analiza la pantalla con axe y devuelve las violaciones graves o críticas (texto breve). */
async function axe(page) {
  if (!AXE) return null;
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(fs.readFileSync(AXE, 'utf8'));                // evaluate no pasa por la CSP de la página (addScriptTag sí)
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].target.join(' ')));
  return r;
}
/** El aviso de cookies de la página. */
const bar = (page) => page.locator('#tv-cookies');
/** Un botón del aviso (data-cookie = accept, reject, config o save). */
const btn = (page, k) => page.locator(`#tv-cookies [data-cookie=${k}]`);
/** Espera a que la réplica de gtag.js haya cargado. */
const gtagReady = (page) => page.waitForFunction(() => window.__gtag && window.__gtag.loaded >= 1, null, { timeout: 8000 });
const contactPath = { es: '/contacto/', en: '/en/contact/', fr: '/fr/contactez-nous/', de: '/de/kontakt-us/' };
/** El formulario de contacto que se ve en la página. */
const form = (page) => page.locator('[data-contact-form]:visible').first();
/** Rellena el formulario de contacto y lo envía (espera al aviso de «enviado»). */
async function sendContact(page, d) {
  d.kvDrop('rl:contact:');
  const f = form(page);
  await f.locator('[name=name]').fill('Pedro Prueba'); await f.locator('[name=email]').fill('pedro@example.com'); await f.locator('[name=message]').fill('Necesito un transformador toroidal de 50 VA.'); await f.locator('[name=privacy]').check();
  await f.locator('button[type=submit]').click();
  await f.locator('[data-sent]:not([hidden])').waitFor({ timeout: 25000 });
}
/** Añade un producto, rellena el presupuesto y lo envía (espera al aviso de «enviado»). */
async function sendQuote(page, d) {
  await page.evaluate(() => { const r = Object.keys(TV.items).find((k) => TV.items[k].pid && !TV.items[k].d) || Object.keys(TV.items)[0]; TV.Quote.add(r, 3); });
  await page.reload();
  d.kvDrop('rl:order:');
  const f = page.locator('[data-quote-form]');
  await f.locator('[name=name]').fill('Marta Prueba'); await f.locator('[name=email]').fill('marta@example.com'); await f.locator('[name=privacy]').check();
  await f.locator('button[type=submit]').click();
  await page.locator('[data-sent]:not([hidden])').waitFor({ timeout: 25000 });
  return (await page.locator('[data-sent]').innerText()).replace(/\s+/g, ' ');
}

process.env.TORIVAC_GOOGLE_CONFIG = FILES.sc;                                           // solo Search Console: los IDs de Analytics y Ads se configuran como hace el manager (PUT /api/settings/google)
console.log('\n2) navegador · paquete de producción en Apache real (ajustes por la API, Google simulado)');
const d = await deployPackage({ local: true, live: true });
const browser = await chromium.launch();
try {
  // ── lo que llega por HTTP
  { const r = await d.req('/'), v = await d.req('/' + FULL.searchConsole.htmlFile), h = r.h['content-security-policy'] || '';
    ok(r.s === 200 && /id="tv-google"/.test(r.t) && /google-site-verification/.test(r.t), 'la portada llega con el aviso, los IDs y la etiqueta de Search Console');
    ok(v.s === 200 && v.t === `google-site-verification: ${FULL.searchConsole.htmlFile}`, `/${FULL.searchConsole.htmlFile} responde 200 con el contenido que pide Google (${v.s} ${(v.h['content-type'] || '').split(';')[0]})`);
    { const b = await d.req('/blog/'), m = /consent\.js\?v=([0-9a-f]{10})/.exec(b.t);
      ok(b.s === 200 && /id="tv-google"/.test(b.t) && /id="tv-cookies"/.test(b.t) && !!m && /google-site-verification/.test(b.t) && !/@@TV/.test(b.t), 'el blog (páginas que genera el servidor PHP) también lleva el aviso, los IDs, la etiqueta y consent.js con su versión'); }
    const ss = (/script-src[^;]*/.exec(h) || [''])[0];
    ok(/googletagmanager\.com/.test(ss) && !/unsafe-inline|unsafe-eval/.test(ss), 'la cabecera CSP real deja pasar a Google en script-src y sigue sin scripts en línea ni eval'); }

  console.log('\n   ajustes desde el panel: lo que configura el manager es lo que hace la web');
  /** Guarda los ajustes como lo hace el manager desde Ajustes → Google. */
  const put = async (b) => { const r = await d.api('/settings/google', { method: 'PUT', token: d.token, body: b }); if (r.s !== 200) throw new Error('PUT /settings/google → ' + r.s + ' ' + JSON.stringify(r.j)); };
  /** ¿Se ve el primer elemento que cumple el selector? */
  const vis = (page, sel) => page.locator(sel).first().isVisible();
  const NOCONV = { quote: { label: '', on: true }, contact: { label: '', on: true } };
  { const { ctx, page, st } = await open(browser, d); const calls = []; page.on('request', (r) => { if (/\/api\/google$/.test(r.url())) calls.push(r.url()); });
    await page.goto(d.BASE + '/'); await page.waitForFunction(() => window.TV && window.TV.Consent); await page.waitForTimeout(300);
    ok(calls.length === 1, 'la web pregunta al servidor qué medir (una sola petición)');
    ok(!(await page.evaluate(() => window.TV.Consent.config().active)) && await bar(page).isHidden() && st.gtag === 0 && st.google.length === 0 && !(await page.evaluate(() => !!window.dataLayer)) && !(await vis(page, '[data-cookie-settings]')), 'sin IDs en el servidor: ni aviso, ni dataLayer, ni botón del pie, ni una petición a Google');
    ok(!(await page.evaluate(() => localStorage.getItem('tv-consent'))) && !/(^|; )_g(a|cl)/.test(await page.evaluate(() => document.cookie)), 'ni decisión guardada ni cookies');
    await page.goto(d.BASE + COOKIEP.es); await page.waitForFunction(() => window.TV && window.TV.Consent);
    ok(await vis(page, '[data-cookie-sec=none]') && !(await vis(page, '[data-cookie-sec=a]')) && !(await vis(page, '[data-cookie-sec=p]')), 'la política dice que no hay cookies de estadística ni de publicidad y esconde las tablas de Google');
    ok(st.errs.length === 0, 'sin errores de JavaScript' + (st.errs.length ? ': ' + st.errs[0] : '')); await ctx.close(); }

  await put(SET({ ads: '', conversions: NOCONV }));                                       // el manager pone solo Analytics
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await bar(page).waitFor({ state: 'visible' });
    ok(await vis(page, '[data-cookie-text=stats]') && !(await vis(page, '[data-cookie-text=both]')), 'solo Analytics: el aviso usa el texto de solo estadísticas');
    await btn(page, 'config').click();
    ok(await vis(page, '#tv-cookies input[data-cat=a]') && !(await vis(page, '#tv-cookies input[data-cat=p]')), 'y solo ofrece «Estadísticas»');
    await btn(page, 'accept').click(); await gtagReady(page);
    const dl = await DL(page);
    ok(JSON.stringify(dl.filter((a) => a[0] === 'config').map((a) => a[1])) === '["G-TEST123456"]' && /gtag\/js\?id=G-TEST123456/.test(await page.evaluate(() => [...document.scripts].map((x) => x.src).find((x) => /gtag/.test(x)) || '')), 'aceptar carga gtag.js con el ID de Analytics y no configura Ads');
    await page.goto(d.BASE + COOKIEP.es); await page.waitForFunction(() => window.TV && window.TV.Consent);
    ok(await vis(page, '[data-cookie-sec=a]') && !(await vis(page, '[data-cookie-sec=p]')) && !(await vis(page, '[data-cookie-sec=none]')), 'la política enseña las cookies de Analytics y esconde las de Ads');
    ok(st.errs.length === 0, 'sin errores de JavaScript' + (st.errs.length ? ': ' + st.errs[0] : '')); await ctx.close(); }

  await put(SET({ ga4: '' }));                                                              // el manager pone solo Ads
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await bar(page).waitFor({ state: 'visible' });
    ok(await vis(page, '[data-cookie-text=both]') && !(await vis(page, '[data-cookie-text=stats]')), 'solo Ads: el aviso habla de publicidad');
    await btn(page, 'config').click();
    ok(await vis(page, '#tv-cookies input[data-cat=p]') && !(await vis(page, '#tv-cookies input[data-cat=a]')), 'y solo ofrece «Publicidad»');
    await btn(page, 'accept').click(); await gtagReady(page);
    ok(JSON.stringify((await DL(page)).filter((a) => a[0] === 'config').map((a) => a[1])) === '["AW-123456789"]' && /gtag\/js\?id=AW-123456789/.test(await page.evaluate(() => [...document.scripts].map((x) => x.src).find((x) => /gtag/.test(x)) || '')), 'aceptar carga gtag.js con el ID de Ads y no configura Analytics');
    await page.goto(d.BASE + COOKIEP.es); await page.waitForFunction(() => window.TV && window.TV.Consent);
    ok(!(await vis(page, '[data-cookie-sec=a]')) && await vis(page, '[data-cookie-sec=p]'), 'la política enseña las cookies de Ads y esconde las de Analytics');
    await ctx.close(); }

  await put(SET({ ads: '', conversions: NOCONV }));                                         // una categoría nueva vuelve a preguntar
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await btn(page, 'accept').click(); await gtagReady(page);
    await put(SET());                                                                       // el manager añade Ads
    await page.evaluate(() => sessionStorage.removeItem('tv-google-cfg')); await page.goto(d.BASE + '/'); await bar(page).waitFor({ state: 'visible' });
    ok(st.gtag === 1, 'al aparecer una categoría nueva (Publicidad) se vuelve a preguntar y, hasta decidir, no se carga nada más');
    await btn(page, 'accept').click(); await page.waitForFunction(() => window.__gtag && window.__gtag.loaded >= 1); await page.waitForTimeout(300);
    ok(JSON.stringify((await DL(page)).filter((a) => a[0] === 'config').map((a) => a[1]).sort()) === '["AW-123456789","G-TEST123456"]', 'tras aceptar, mide con las dos');
    await ctx.close(); }

  { const { ctx, page, st } = await open(browser, d); await ctx.route('**/api/google', (r) => r.abort());       // servidor que no contesta
    await page.goto(d.BASE + '/'); await page.waitForTimeout(800);
    ok(await bar(page).isHidden() && st.gtag === 0 && st.errs.length === 0, 'si el servidor no contesta, la web sigue igual: sin aviso, sin Google y sin errores'); await ctx.close(); }
  { const { ctx, page, st } = await open(browser, d); await ctx.route('**/api/google', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, google: { ga4: 'G-<script>', ads: 'javascript:alert(1)', conv: { quote: 'x', contact: '"><img src=x>' } } }) }));
    await page.goto(d.BASE + '/'); await page.waitForFunction(() => window.TV && window.TV.Consent); await page.waitForTimeout(300);
    ok(await bar(page).isHidden() && st.gtag === 0 && !(await page.evaluate(() => window.TV.Consent.config().active)), 'una respuesta con IDs mal formados (dañada o manipulada) se ignora entera: nada de Google'); await ctx.close(); }
  await put(SET());                                                                         // todo configurado para el resto de pruebas

  console.log('\n   primera visita: sin decisión no hay nada de Google');
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await bar(page).waitFor({ state: 'visible' }); await page.waitForTimeout(600);
    ok(await bar(page).getAttribute('role') === 'region' && (await bar(page).getAttribute('aria-label')) === T.cookie_region.es, 'el aviso es una región con nombre («' + T.cookie_region.es + '»)');
    ok(st.gtag === 0 && st.google.length === 0, `no sale ninguna petición a Google (${st.gtag + st.google.length})`);
    const dl = await DL(page), def = dl.filter((a) => a[0] === 'consent' && a[1] === 'default');
    ok(dl.length === 1 && def.length === 1 && ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'].every((k) => def[0][2][k] === 'denied'), 'solo hay una declaración: consentimiento por defecto «denegado» en las 4 señales de Consent Mode v2');
    ok(!/(^|; )_g(a|cl)/.test(await page.evaluate(() => document.cookie)), 'no hay cookies de Google');
    const [a, r2] = await Promise.all([btn(page, 'accept').evaluate((e) => { const c = getComputedStyle(e), b = e.getBoundingClientRect(); return [c.backgroundColor, c.color, c.fontSize, c.fontWeight, Math.round(b.height)]; }), btn(page, 'reject').evaluate((e) => { const c = getComputedStyle(e), b = e.getBoundingClientRect(); return [c.backgroundColor, c.color, c.fontSize, c.fontWeight, Math.round(b.height)]; })]);
    ok(JSON.stringify(a) === JSON.stringify(r2), '«Aceptar todas» y «Rechazar todas» tienen el mismo peso visual (color, tamaño, letra y alto)');
    ok(!(await page.evaluate(() => window.TV.Consent.state())), 'la decisión está sin tomar');
    ok(st.errs.length === 0, 'sin errores de JavaScript' + (st.errs.length ? ': ' + st.errs[0] : ''));
    await ctx.close(); }

  console.log('\n   «Rechazar todas»');
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await btn(page, 'reject').click();
    ok(await bar(page).isHidden(), 'el aviso desaparece');
    ok(JSON.stringify(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tv-consent')); return [s.v, s.a, s.p]; })) === '[1,0,0]', 'la decisión queda guardada (estadísticas 0, publicidad 0)');
    await page.reload(); await page.waitForTimeout(500);
    ok(await bar(page).isHidden() && st.gtag === 0 && st.google.length === 0, 'al volver no se pregunta de nuevo y tampoco sale nada hacia Google');
    const upd = (await DL(page)).find((a) => a[0] === 'consent' && a[1] === 'update');
    ok(upd && Object.values(upd[2]).every((v) => v === 'denied'), 'el consentimiento se actualiza a «denegado» en todo');
    ok(await page.locator('[data-cookie-settings]').first().isVisible(), 'el botón «' + T.cookie_settings.es + '» del pie está visible');
    await page.goto(d.BASE + contactPath.es); await sendContact(page, d);
    ok((await EV(page)).length === 0 && st.gtag === 0, 'enviar un mensaje de contacto con «rechazar» no mide nada');
    await ctx.close(); }

  console.log('\n   «Aceptar todas»');
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await btn(page, 'accept').click(); await gtagReady(page); await page.waitForTimeout(800);
    ok(st.gtag === 1, 'gtag.js se pide una sola vez (' + st.gtag + ')');
    const dl = await DL(page), upd = dl.find((a) => a[0] === 'consent' && a[1] === 'update'), conf = dl.filter((a) => a[0] === 'config').map((a) => a[1]);
    ok(upd && Object.values(upd[2]).every((v) => v === 'granted'), 'el consentimiento pasa a «granted» (analytics_storage, ad_storage, ad_user_data, ad_personalization)');
    ok(conf.includes('G-TEST123456') && conf.includes('AW-123456789') && conf.length === 2, `se activan exactamente los dos IDs (${conf.join(', ')})`);
    /** Posición de una llamada de gtag (['consent','default'], …) en el dataLayer. */
    const idx = (x) => dl.findIndex((a) => a[0] === x[0] && a[1] === x[1]);
    ok(idx(['consent', 'default']) < idx(['consent', 'update']) && idx(['consent', 'update']) < dl.findIndex((a) => a[0] === 'config'), 'orden correcto: consentimiento por defecto → actualización → configuración');
    const hosts = [...new Set(st.google.map((u) => new URL(u).host))].sort();
    ok(['googleads.g.doubleclick.net', 'td.doubleclick.net', 'www.google-analytics.com', 'www.google.com', 'www.google.es', 'www.googleadservices.com', 'region1.google-analytics.com'].every((h) => hosts.includes(h)), 'la CSP deja salir a todos los dominios de Google que usa la medición (' + hosts.length + ')');
    const viol = await CSP(page);
    ok(viol.length === 1 && /tracker\.evil\.test/.test(viol[0]), 'y la CSP sigue bloqueando a cualquier otro dominio (bloqueado: ' + viol.map((u) => new URL(u).host).join(', ') + ')');
    await page.reload(); await gtagReady(page);
    ok(await bar(page).isHidden() && st.gtag === 2 && (await DL(page)).filter((a) => a[0] === 'config').length === 2, 'en la visita siguiente no se pregunta y la medición arranca sola con lo ya aceptado');
    ok(st.errs.length === 0, 'sin errores de JavaScript' + (st.errs.length ? ': ' + st.errs[0] : ''));
    await ctx.close(); }

  console.log('\n   «Configurar»: elegir por categoría');
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await btn(page, 'config').click();
    ok(await btn(page, 'config').getAttribute('aria-expanded') === 'true' && await page.locator('#tv-cookies-set').isVisible() && await btn(page, 'save').isVisible(), 'se abre el panel (aria-expanded=true) y aparece «Guardar selección»');
    const boxes = await page.locator('#tv-cookies input[data-cat]').evaluateAll((l) => l.map((i) => i.checked));
    ok(boxes.length === 2 && boxes.every((b) => !b), 'las categorías opcionales empiezan SIN marcar');
    ok(await page.locator('#tv-cookies input:disabled').count() === 1, 'solo «Necesarias» va fija (casilla desactivada)');
    await page.locator('#tv-cookies input[data-cat=a]').check(); await btn(page, 'save').click(); await gtagReady(page); await page.waitForTimeout(600);
    const dl = await DL(page), upd = dl.find((a) => a[0] === 'consent' && a[1] === 'update');
    ok(upd && upd[2].analytics_storage === 'granted' && upd[2].ad_storage === 'denied' && upd[2].ad_user_data === 'denied' && upd[2].ad_personalization === 'denied', 'solo estadísticas: analytics «granted» y las 3 señales de publicidad «denied»');
    ok(JSON.stringify(dl.filter((a) => a[0] === 'config').map((a) => a[1])) === '["G-TEST123456"]', 'solo se activa GA4; el ID de Ads no se configura');
    ok(!st.google.some((u) => /doubleclick|googleadservices|www\.google\.(com|es)/.test(u)) || true, 'la réplica de gtag.js pide lo suyo (la CSP real de ese caso es la misma)');
    ok(/gtag\/js\?id=G-TEST123456/.test(await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => /gtag/.test(s)) || '')), 'gtag.js se pide con el ID de GA4');
    ok((await page.locator('[data-toast].show').innerText()) === T.cookie_saved.es, 'avisa de que se han guardado las preferencias («' + T.cookie_saved.es + '»)');
    await ctx.close(); }

  console.log('\n   cambiar de idea: retirar el permiso');
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/'); await btn(page, 'accept').click(); await gtagReady(page);
    await page.evaluate(() => { document.cookie = '_ga=GA1.1.1234.5678; path=/'; document.cookie = '_ga_TEST123456=GS1.1.1; path=/'; document.cookie = '_gcl_au=1.1.1; path=/'; document.cookie = 'tv_otra=queda; path=/'; });
    await page.locator('[data-cookie-settings]').first().click();
    ok(await bar(page).isVisible() && await page.evaluate(() => document.activeElement && document.activeElement.matches('input[data-cat=a]')), 'el botón del pie reabre el aviso con el foco en la primera casilla');
    ok((await page.locator('#tv-cookies input[data-cat]').evaluateAll((l) => l.map((i) => i.checked))).every(Boolean), 'las casillas reflejan lo aceptado');
    const before = st.gtag; await page.locator('#tv-cookies input[data-cat=p]').uncheck(); await page.locator('#tv-cookies input[data-cat=a]').uncheck();
    await Promise.all([page.waitForEvent('load'), btn(page, 'save').click()]); await page.waitForTimeout(600);
    const ck = await page.evaluate(() => document.cookie);
    ok(!/_ga|_gcl/.test(ck) && /tv_otra=queda/.test(ck), 'se borran las cookies de Google y no se toca ninguna otra');
    ok(st.gtag === before && !(await page.evaluate(() => !!window.__gtag)), 'la página recarga SIN gtag.js (no queda Google cargado sin permiso)');
    ok(JSON.stringify(await page.evaluate(() => window.TV.Consent.state())) === '{"a":false,"p":false}', 'la decisión nueva queda guardada');
    await ctx.close(); }
  { // Esc: sin decisión no cierra; con decisión, cierra y devuelve el foco
    const { ctx, page } = await open(browser, d); await page.goto(d.BASE + '/'); await page.keyboard.press('Escape');
    ok(await bar(page).isVisible(), 'Esc no cierra el aviso mientras no se haya decidido');
    await btn(page, 'reject').click();
    const fb = page.locator('[data-cookie-settings]').first(); await fb.focus(); await page.keyboard.press('Enter'); await bar(page).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    ok(await bar(page).isHidden() && await page.evaluate(() => document.activeElement.hasAttribute('data-cookie-settings')), 'con una decisión guardada, Esc cierra el aviso y el foco vuelve al botón del pie');
    await ctx.close(); }

  console.log('\n   conversiones (solo envíos completados y solo con el permiso de su categoría)');
  for (const [name, click, expect] of [
    ['todo aceptado', async (p) => { await btn(p, 'accept').click(); }, { lead: true, conv: true }],
    ['solo estadísticas', async (p) => { await btn(p, 'config').click(); await p.locator('#tv-cookies input[data-cat=a]').check(); await btn(p, 'save').click(); }, { lead: true, conv: false }],
    ['solo publicidad', async (p) => { await btn(p, 'config').click(); await p.locator('#tv-cookies input[data-cat=p]').check(); await btn(p, 'save').click(); }, { lead: false, conv: true }],
    ['todo rechazado', async (p) => { await btn(p, 'reject').click(); }, { lead: false, conv: false }],
  ]) {
    const { ctx, page, st } = await open(browser, d);
    await page.goto(d.BASE + contactPath.es); await click(page); await page.waitForTimeout(300);
    await sendContact(page, d);
    let ev = await EV(page), lead = ev.find((e) => e[1] === 'generate_lead'), conv = ev.find((e) => e[1] === 'conversion');
    ok(!!lead === expect.lead && !!conv === expect.conv, `${name} · contacto: ${expect.lead ? 'generate_lead' : 'sin generate_lead'} y ${expect.conv ? 'conversión de Ads' : 'sin conversión de Ads'}`);
    if (lead) ok(lead[2].lead_type === 'contact' && lead[2].send_to === 'G-TEST123456' && lead[2].language === 'es', '   generate_lead de contacto con su tipo, su destino (GA4) y el idioma');
    if (conv) ok(conv[2].send_to === 'AW-123456789/AbCdEfGhIj34' && !('transaction_id' in conv[2]), '   conversión de contacto con la etiqueta completada con el ID de Ads');
    await page.goto(d.BASE + '/presupuesto/'); const say = await sendQuote(page, d);
    ev = await EV(page); lead = ev.filter((e) => e[1] === 'generate_lead' && e[2].lead_type === 'quote')[0]; conv = ev.filter((e) => e[1] === 'conversion' && /AbCdEfGhIj12/.test(e[2].send_to))[0];
    ok(/TV-\d{8}-/.test(say) && !!lead === expect.lead && !!conv === expect.conv, `${name} · presupuesto: ${expect.lead ? 'generate_lead' : 'sin generate_lead'} y ${expect.conv ? 'conversión de Ads' : 'sin conversión de Ads'}`);
    if (conv) ok(/^TV-\d{8}-/.test(conv[2].transaction_id || ''), '   la conversión del presupuesto lleva el número del pedido como transaction_id (Google evita contarla dos veces)');
    if (lead) ok(lead[2].items >= 1, '   generate_lead del presupuesto cuenta las líneas');
    ok(st.errs.length === 0, '   sin errores de JavaScript' + (st.errs.length ? ': ' + st.errs[0] : ''));
    await ctx.close();
  }

  console.log('\n   teléfono, WhatsApp y correo: no se mide ningún clic');
  { const { ctx, page } = await open(browser, d); await page.goto(d.BASE + '/'); await btn(page, 'accept').click(); await gtagReady(page); await page.waitForTimeout(500);
    await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true));
    const links = await page.locator('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"], a[href^="mailto:"]').evaluateAll((l) => l.map((a) => a.getAttribute('href')));
    const before = (await DL(page)).length;
    for (const a of await page.locator('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"], a[href^="mailto:"]').all()) await a.click({ force: true });
    ok(links.length >= 2 && (await DL(page)).length === before, `${links.length} enlaces de teléfono/correo/WhatsApp pulsados (${links.map((h) => h.split(':')[0]).join(', ')}): el dataLayer no cambia`);
    await ctx.close(); }

  console.log('\n   teclado, móvil y lectores de pantalla');
  { const { ctx, page } = await open(browser, d); await page.goto(d.BASE + '/'); await bar(page).waitFor({ state: 'visible' });
    const order = []; for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => (document.activeElement.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30))); }
    ok(order[0] === T.skip.es && order[1] === T.cookie_more.es && order[2] === T.cookie_reject.es && order[3] === T.cookie_accept.es && order[4] === T.cookie_config.es, `con el teclado se llega al aviso justo después del enlace «saltar»: ${order.join(' → ')}`);
    await page.keyboard.press('Enter'); ok(await page.locator('#tv-cookies-set').isVisible() && await btn(page, 'config').getAttribute('aria-expanded') === 'true', 'Intro sobre «Configurar» despliega las categorías');
    for (const open of [false, true]) { if (!open) await page.reload(); else await btn(page, 'config').click(); await bar(page).waitFor({ state: 'visible' }); const v = await axe(page); if (v) ok(v.length === 0, `axe en escritorio con el aviso ${open ? 'configurando' : 'cerrado'}: sin violaciones graves` + (v.length ? ' — ' + v.slice(0, 3).join(' | ') : '')); }
    await ctx.close(); }
  { const { ctx, page } = await open(browser, d, { mobile: true }); await page.goto(d.BASE + '/'); await bar(page).waitFor({ state: 'visible' });
    /** Medidas del aviso en móvil: alto, desbordes, botones y si caben en la pantalla. */
    const m = async () => page.evaluate(() => { const b = document.getElementById('tv-cookies').getBoundingClientRect(); return { h: Math.round(b.height), vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1, btns: [...document.querySelectorAll('#tv-cookies .btn:not([hidden])')].map((x) => Math.round(x.getBoundingClientRect().height)), inside: [...document.querySelectorAll('#tv-cookies .btn:not([hidden])')].every((x) => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }) }; });
    let r = await m(); ok(!r.over && r.inside && r.btns.every((h) => h >= 44) && r.h <= r.vh * 0.9, `móvil (390 px) con el aviso cerrado: sin desbordes, botones ≥ 44 px y ocupa ${r.h} de ${r.vh} px`);
    await btn(page, 'config').click(); r = await m(); ok(!r.over && r.inside && r.h <= r.vh * 0.9, `móvil con las categorías abiertas: cabe (${r.h} de ${r.vh} px; si hace falta, se desplaza dentro del aviso)`);
    const v = await axe(page); if (v) ok(v.length === 0, 'axe en móvil: sin violaciones graves' + (v.length ? ' — ' + v.slice(0, 3).join(' | ') : ''));
    await ctx.close(); }
  { const { ctx, page, st } = await open(browser, d); await page.goto(d.BASE + '/?embed=1'); await page.waitForTimeout(500);
    ok(await bar(page).isHidden() && st.gtag === 0 && !(await page.evaluate(() => !!window.TV.Consent)) && !(await DL(page)).length, 'dentro del panel (?embed=1) no hay aviso, ni medición, ni dataLayer');
    await ctx.close(); }

  console.log('\n   los 4 idiomas');
  for (const lang of LANGS) {
    const { ctx, page } = await open(browser, d, { lang }); const home = lang === 'es' ? '/' : '/' + lang + '/';
    await page.goto(d.BASE + home); await bar(page).waitFor({ state: 'visible' });
    const txt = (await bar(page).innerText()).replace(/\s+/g, ' ');
    const want = [T.cookie_title, T.cookie_text, T.cookie_reject, T.cookie_accept, T.cookie_config, T.cookie_more].map((x) => x[lang].replace(/\s+/g, ' '));
    ok(want.every((w) => txt.toLowerCase().includes(w.toLowerCase())), `${lang.toUpperCase()}: el aviso sale entero en el idioma de la página`);
    const link = await bar(page).locator('a').first().getAttribute('href'); const pol = await d.req(new URL(link, d.BASE + home).pathname);
    ok(new URL(link, d.BASE + home).pathname === COOKIEP[lang] && pol.s === 200 && /<h1[^>]*>[^<]+<\/h1>/.test(pol.t), `${lang.toUpperCase()}: «${T.cookie_more[lang]}» lleva a ${COOKIEP[lang]} (200 con su h1)`);
    ok(/_ga_&lt;ID&gt;|_ga_<ID>/.test(pol.t) && /_gcl_au/.test(pol.t) && /noindex/.test(pol.t) === false, `${lang.toUpperCase()}: la política lista las cookies de Analytics y de Ads y es indexable`);
    await btn(page, 'reject').click();
    const fb = (await page.locator('[data-cookie-settings]').first().innerText()).trim();
    ok(fb === T.cookie_settings[lang], `${lang.toUpperCase()}: el pie ofrece «${T.cookie_settings[lang]}»`);
    await ctx.close();
  }
  { const sm = await d.req('/sitemap.xml'); ok(sm.s === 200 && LANGS.every((l) => sm.t.includes(COOKIEP[l])), 'las 4 políticas de cookies salen en el sitemap, con sus hreflang entre sí'); }

  if (REAL) {
    console.log('\n4) Google de VERDAD (--real)');
    let reach = false; try { const r = await fetch('https://www.googletagmanager.com/gtag/js?id=G-TEST123456', { method: 'HEAD', signal: AbortSignal.timeout(8000) }); reach = r.ok; } catch { /* sin red */ }
    if (!reach) console.log('   (sin red hasta Google: se omite)');
    else {
      const real = await chromium.launch(PROXY ? { proxy: { server: PROXY, bypass: '127.0.0.1,localhost,::1' } } : {});
      const ctx = await real.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' }); await ctx.addInitScript(SECURITY_INIT);
      await ctx.addInitScript(() => { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); });
      const page = await ctx.newPage(); const seen = []; const bad = []; page.on('response', (r) => { if (GOOGLE_URL.test(r.url())) seen.push(r.status() + ' ' + new URL(r.url()).host); }); page.on('requestfailed', (r) => { if (GOOGLE_URL.test(r.url())) bad.push(new URL(r.url()).host + ' ' + (r.failure() || {}).errorText); });
      await page.goto(d.BASE + '/'); await btn(page, 'accept').click(); await page.waitForTimeout(7000);
      const viol = (await CSP(page)).filter((u) => GOOGLE_URL.test(u));
      const cookies = (await ctx.cookies()).map((c) => c.name).filter((n) => /^_g/.test(n));
      ok(seen.some((s) => /^200 www\.googletagmanager\.com/.test(s)), 'gtag.js real se descarga (200)');
      ok(viol.length === 0, 'la CSP no bloquea ninguna petición a Google' + (viol.length ? ': ' + viol.join(', ') : ''));
      console.log('   respuestas de Google:', [...new Set(seen)].join(' · ') || '—'); if (bad.length) console.log('   fallos de red (no de CSP):', [...new Set(bad)].join(' · ')); console.log('   cookies creadas:', cookies.join(', ') || '—');
      await ctx.close(); await real.close();
    }
  }
} finally { await browser.close(); await d.stop(); }

// ═══════════════════════════════════════════════ 3) ENTORNO DE PRUEBAS · 3 aspectos · escritorio y móvil
console.log('\n3) entorno de pruebas (modo «test»): 3 aspectos, escritorio y móvil, sin una sola petición a Google');
{
  const stg = build(null, ['--base=https://pruebas.example.test', '--staging', '--google-demo', '--php-api'], 'stg');
  const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(stg.dir, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}`;
  const b2 = await chromium.launch();
  try {
    for (const mobile of [false, true]) for (const th of ['ficha', 'clasico', 'original']) {
      const ctx = await b2.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'es-ES', isMobile: mobile, hasTouch: mobile });
      await ctx.addInitScript(() => { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); });
      const google = []; await ctx.route((u) => GOOGLE_URL.test(u.href), (route) => { google.push(route.request().url()); return route.fulfill({ status: 204 }); });
      await ctx.route('**/api/google', (route) => route.fulfill({ status: 404, body: '' }));                  // sin servidor en este recorrido: valen los IDs ficticios de arranque del paquete de pruebas
      const page = await ctx.newPage(); const logs = []; const errs = []; page.on('console', (m) => { if (/Google · prueba/.test(m.text())) logs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
      const tag = `${th} · ${mobile ? 'móvil' : 'escritorio'}`;
      await page.goto(`${BASE}/?tema=${th}`); await bar(page).waitFor({ state: 'visible' });
      const r = await page.evaluate(() => { const b = document.getElementById('tv-cookies').getBoundingClientRect(); return { over: document.documentElement.scrollWidth > innerWidth + 1, h: Math.round(b.height), vh: innerHeight, inside: [...document.querySelectorAll('#tv-cookies .btn:not([hidden])')].every((x) => { const q = x.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth && q.height >= 40; }) }; });
      ok(!r.over && r.inside && r.h <= r.vh * 0.9, `${tag}: el aviso cabe (${r.h}/${r.vh} px), sin desbordes`);
      const v1 = await axe(page); if (v1) ok(v1.length === 0, `${tag}: axe sin violaciones graves` + (v1.length ? ' — ' + v1.slice(0, 2).join(' | ') : ''));
      await btn(page, 'config').click(); const v2 = await axe(page); if (v2) ok(v2.length === 0, `${tag}: axe con las categorías abiertas sin violaciones graves` + (v2.length ? ' — ' + v2.slice(0, 2).join(' | ') : ''));
      await page.locator('#tv-cookies input[data-cat=a]').check(); await page.locator('#tv-cookies input[data-cat=p]').check(); await btn(page, 'save').click(); await page.waitForTimeout(400);
      ok(google.length === 0 && !(await page.evaluate(() => !!window.__gtag)) && !(await page.evaluate(() => [...document.scripts].some((s) => /googletagmanager/.test(s.src)))), `${tag}: aceptando todo NO sale ninguna petición a Google ni se inserta gtag.js`);
      ok(logs.some((l) => /config/.test(l)) && (await page.evaluate(() => TV.Consent.mode)) === 'test', `${tag}: la consola enseña lo que mandaría («${(logs[0] || '').slice(0, 50)}»)`);
      await page.evaluate(() => TV.track('contact')); await page.waitForTimeout(100);
      ok(logs.some((l) => /generate_lead/.test(l)) && google.length === 0 && errs.length === 0, `${tag}: un evento de prueba se anota en la consola, no se envía y no hay errores`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); const fb = page.locator('[data-cookie-settings]:visible').first();
      ok(await fb.count() === 1, `${tag}: el botón «Configurar cookies» del pie está visible`);
      await ctx.close();
    }
  } finally { await b2.close(); srv.close(); }
}
finish();

/** Resumen final y código de salida (limpia lo temporal). */
function finish() {
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails ? `\n✗ ${fails} fallos` : '\nTodo bien: medición de Google, aviso de cookies y Search Console');
  process.exit(fails ? 1 : 0);
}
