#!/usr/bin/env node
// [QA-APACHE] El paquete tal como se sube, sobre un Apache REAL con PHP-FPM (como Plesk y cPanel), con su .htaccess de verdad: URLs limpias, redirecciones, 404 por idioma, ficheros ocultos,
// sondeos de WordPress (410), cabeceras de seguridad y CSP, compresión y caché, la carpeta api/ cerrada para lo que existe y abierta para las rutas del API, la cabecera Authorization hasta PHP,
// un mensaje de verdad, el bloqueo de 1 hora y, con un segundo paquete de PRODUCCIÓN, HTTPS obligatorio, un solo host (www → sin www), HSTS, sitemap, llms.txt y robots.txt.
// Las demás pruebas usan `php -S`, que NO lee el .htaccess: esta es la que lo comprueba. Necesita apache2 y php-fpm (sudo apt-get install apache2 php8.3-fpm); si no están, avisa y sale sin fallo.
//   node scripts/qa-apache.mjs
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { apacheAvailable, startApache } from './lib/apache.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const why = apacheAvailable();
if (why) { console.log(`(se omite: ${why})`); process.exit(0); }
const net = await import('node:net');
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const BASE = `http://127.0.0.1:${port}`;
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ───────────────────────────────────────── [PAQUETE] compilado con la URL local y desplegado en la raíz del Apache
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-apache-pkg-')); fs.chmodSync(OUT, 0o755);
execFileSync('python3', ['-I', path.join(ROOT, 'scripts/package_cpanel.py'), `--base=${BASE}`, '--staging', `--out=${OUT}`, '--keep', '--allow-dirty'], { stdio: 'pipe' });
const WWW = path.join(OUT, fs.readdirSync(OUT).find((d) => fs.statSync(path.join(OUT, d)).isDirectory()));
spawnSync('chmod', ['-R', 'a+rX', WWW]);
const ap = await startApache({ docroot: WWW, port });
const MASTER = 'master-test-' + 'a1b2c3d4e5f6a7b8c9d0'.repeat(2);
/** Escribe api/config.php con la carpeta de datos indicada (fuera de la web por defecto). */
const writeCfg = (extra = {}) => {
  const cfg = { storage_dir: ap.dataDir, session_secret: 'session-test-' + 'x'.repeat(40), admin_token: MASTER, order_to: ['info@grupotorivac.com', 'mzamora@torivac.com'], order_from: 'Torivac Web <pedidos@grupotorivac.com>', mail: { driver: 'file' }, form_min_fill_ms: 0, two_step: { enabled: false }, ...extra };          // el código por correo se prueba aparte (qa-security-panel.mjs): aquí el manager entra con la contraseña sola
  fs.writeFileSync(path.join(WWW, 'api/config.php'), `<?php\nreturn json_decode(<<<'JSON'\n${JSON.stringify(cfg)}\nJSON\n, true);\n`); fs.chmodSync(path.join(WWW, 'api/config.php'), 0o644);
};
writeCfg();
/** GET (sin seguir redirecciones) de una ruta → { s: estado, h: cabeceras, t: cuerpo } */
const get = async (p, { headers = {}, method = 'GET' } = {}) => { const r = await fetch(BASE + p, { redirect: 'manual', headers, method }); return { s: r.status, h: r.headers, t: await r.text() }; };
/** Llamada JSON al API → { s, j } */
const api = async (p, { method = 'GET', body, token, headers = {} } = {}) => { const r = await fetch(BASE + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), Origin: BASE, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null), h: r.headers }; };
const ht = fs.readFileSync(path.join(WWW, '.htaccess'), 'utf8');

try {
  console.log(`servidor: Apache real + PHP-FPM en ${BASE}`);
  console.log('\n1) URLs, redirecciones y 404 por idioma');
  let r = await get('/'); ok(r.s === 200 && /<html lang="es"/.test(r.t), 'portada 200 en español');
  for (const l of ['en', 'fr', 'de']) { r = await get(`/${l}/`); ok(r.s === 200 && new RegExp(`<html lang="${l}"`).test(r.t), `/${l}/ 200`); }
  r = await get('/presupuesto'); ok(r.s === 301 && r.h.get('location') === BASE + '/presupuesto/', `/presupuesto → 301 ${r.h.get('location')}`);
  r = await get('/presupuesto/'); ok(r.s === 200, 'URL limpia /presupuesto/ 200');
  r = await get('/index.html'); ok(r.s === 301 && r.h.get('location') === BASE + '/', `/index.html → 301 ${r.h.get('location')}`);
  r = await get('/en/index.html'); ok(r.s === 301 && r.h.get('location') === BASE + '/en/', `/en/index.html → 301 ${r.h.get('location')}`);
  const e404 = fs.readFileSync(path.join(WWW, '404.html'), 'utf8'), e404en = fs.readFileSync(path.join(WWW, 'en/404.html'), 'utf8');
  r = await get('/no-existe/'); ok(r.s === 404 && r.t === e404, '404 en español con su página');
  r = await get('/en/no-existe/'); ok(r.s === 404 && r.t === e404en && r.t !== e404, '404 en inglés con la página en inglés');
  const alias = /^RedirectMatch 301 \^(\S+?)\/\?\$ (\S+)$/m.exec(ht);
  if (alias) { r = await get(alias[1].replace(/\\/g, '') + '/'); ok(r.s === 301 && r.h.get('location') === BASE + alias[2], `URL antigua ${alias[1]} → 301 ${alias[2]}`); }
  const pdf = /^RedirectMatch 301 \^\/wp-content\/uploads\/\.\+\/(\S+)\$ (\S+)$/m.exec(ht);
  if (pdf) { r = await get('/wp-content/uploads/2024/05/' + pdf[1].replace(/\\/g, '')); ok(r.s === 301 && r.h.get('location') === BASE + pdf[2], `PDF antiguo de WordPress → 301 ${pdf[2]}`); r = await get(pdf[2]); ok(r.s === 200 && /pdf/.test(r.h.get('content-type') || ''), 'y el PDF nuevo se sirve'); }

  console.log('\n2) ficheros ocultos, listados y sondeos de WordPress');
  for (const p of ['/.git/config', '/.env', '/.htaccess']) { r = await get(p); ok(r.s === 403, `${p} → 403`); }
  fs.writeFileSync(path.join(WWW, 'notas.md'), 'privado'); fs.writeFileSync(path.join(WWW, 'x.js.map'), '{}'); fs.writeFileSync(path.join(WWW, 'run.sh'), 'echo'); spawnSync('chmod', ['a+r', path.join(WWW, 'notas.md'), path.join(WWW, 'x.js.map'), path.join(WWW, 'run.sh')]);
  for (const p of ['/notas.md', '/x.js.map', '/run.sh']) { r = await get(p); ok(r.s === 403, `${p} (fichero de trabajo) → 403`); }
  r = await get('/assets/img/'); ok(r.s === 403 || r.s === 404, `sin listado de carpetas (${r.s})`);
  r = await get('/.well-known/acme-challenge/x'); ok(r.s !== 403, '/.well-known/ sigue accesible (certificados): ' + r.s);
  for (const p of ['/wp-login.php', '/xmlrpc.php', '/wp-admin/', '/wp-admin/admin-ajax.php', '/wp-json/wp/v2/users', '/wp-includes/js/jquery.js', '/wp-config.php', '/wp-content/plugins/x/readme.txt', '/wp-content/themes/y/style.css']) { r = await get(p); ok(r.s === 410, `${p} → 410`); }

  console.log('\n3) cabeceras de seguridad, compresión y caché');
  r = await get('/'); const csp = r.h.get('content-security-policy') || '';
  ok(/script-src 'self'( 'sha256-[^']+')* https:\/\/challenges\.cloudflare\.com;/.test(csp) && !/unsafe-inline/.test(csp.split(';').find((d) => d.trim().startsWith('script-src')) || '') && /frame-src 'self' https:\/\/challenges\.cloudflare\.com;/.test(csp) && /frame-ancestors 'self'/.test(csp) && /object-src 'none'/.test(csp), 'CSP: scripts solo propios, con huella o del CAPTCHA de Cloudflare (opcional), sin unsafe-inline; frame-ancestors y object-src');
  ok(!/https:\/\/(?!challenges\.cloudflare\.com)[a-z0-9.-]+/i.test(csp.replace(/connect-src[^;]*;?/, '')), 'y la CSP no admite ningún otro origen de terceros (Cloudflare Turnstile es el único)');
  ok(r.h.get('x-content-type-options') === 'nosniff' && r.h.get('x-frame-options') === 'SAMEORIGIN' && /strict-origin/.test(r.h.get('referrer-policy') || '') && /camera=\(\)/.test(r.h.get('permissions-policy') || ''), 'nosniff, X-Frame-Options, Referrer-Policy y Permissions-Policy');
  ok(/noindex/.test(r.h.get('x-robots-tag') || ''), 'entorno de pruebas: X-Robots-Tag noindex');
  ok(!r.h.get('strict-transport-security'), 'sin HSTS sobre http (solo se manda cuando la web es https)');
  ok(/no-cache/.test(r.h.get('cache-control') || ''), 'el HTML se revalida siempre (Cache-Control: no-cache)');
  const gz = await fetch(BASE + '/', { headers: { 'Accept-Encoding': 'gzip' } }); ok((gz.headers.get('content-encoding') || '') === 'gzip', 'HTML comprimido con gzip');
  const css = /href="([^"]+site\.css[^"]*)"/.exec((await get('/')).t); ok(!!css && /\?v=[0-9a-f]{10}$/.test(css[1]), `la hoja de estilos lleva huella de versión (${css && css[1]})`);
  if (css) { r = await get('/' + css[1].replace(/^\.?\//, '')); const exp = Date.parse(r.h.get('expires') || ''); ok(r.s === 200 && exp - Date.now() > 6 * 864e5, `CSS con caché de una semana (Expires ${r.h.get('expires')})`); }
  r = await get('/robots.txt'); ok(/Disallow: \//.test(r.t), 'robots.txt del entorno de pruebas prohíbe todo');

  console.log('\n4) la carpeta api/: lista blanca, Authorization hasta PHP y almacén');
  r = await api('/health'); ok(r.s === 200 && r.j && r.j.ok === true, '/api/health 200 desde PHP-FPM');
  for (const p of ['/api/config.php', '/api/config.sample.php', '/api/lib/Config.php', '/api/lib/autoload.php', '/api/cron.php', '/api/tools/create-user.php', '/api/tools/check.php', '/api/generated/catalog.json', '/api/generated/admin-data.json', '/api/storage/kv/user%3Ax.json', '/api/tests/run.php']) {
    const x = await get(p); ok(!/<\?php|namespace Torivac|session_secret|"proposals"/.test(x.t) && [401, 403, 404].includes(x.s), `${p} no se sirve ni enseña código ni datos (HTTP ${x.s})`);
  }
  r = await api('/users', { method: 'POST', token: MASTER, body: { email: 'jefa@torivac.com', name: 'Jefa', role: 'manager', password: 'Manager-Clave-2026' } }); ok(r.s === 201, 'el token maestro crea el primer manager (Authorization llega a PHP)');
  r = await api('/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: 'Manager-Clave-2026' } }); const tok = r.j && r.j.token; ok(r.s === 200 && !!tok, 'login real');
  r = await api('/auth/me', { token: tok }); ok(r.s === 200 && r.j.user && (r.j.user.sub || r.j.user.email) === 'jefa@torivac.com' && r.j.user.role === 'manager', 'GET /api/auth/me con Bearer → 200 (la cabecera Authorization atraviesa Apache y PHP-FPM)' + (r.s === 200 ? '' : ' — ' + r.s + ' ' + JSON.stringify(r.j)));
  r = await api('/orders', {}); ok(r.s === 401, 'pedidos sin sesión → 401');
  r = await api('/order', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } }); ok(r.s === 403, 'origen ajeno → 403');
  r = await api('/contact', { method: 'POST', body: { name: 'Pedro Prueba', email: 'pedro@example.com', message: 'Necesito un toroidal de 50 VA.', privacy: true, lang: 'es' } });
  ok(r.s === 200 && r.j.ok === true && r.j.emailed && r.j.emailed.sent === true, `mensaje de contacto guardado y avisado (correo «file»): ${JSON.stringify(r.j && r.j.emailed)}`);
  r = await api('/messages', { token: tok }); ok(r.s === 200 && r.j.items.length === 1 && r.j.items[0].email === 'pedro@example.com', 'y el manager lo ve en Mensajes');
  r = await api('/contact', { method: 'POST', body: { name: 'Eva', email: 'eva@example.com', message: '<script>alert(1)</script>', privacy: true } }); ok(r.s === 400 && r.j.code === 'plain_text', 'texto con código → 400 plain_text');
  r = await api('/diag', { token: tok }); ok(r.s === 200 && !r.j.fail, `Diagnóstico del servidor sin fallos graves: ${r.j && r.j.fail} fallos, ${r.j && r.j.warn} avisos`);
  if (r.j && r.j.checks) for (const c of r.j.checks.filter((x) => x.status !== 'ok')) console.log(`     · ${c.status}: ${c.msg}`);
  for (let i = 0; i < 4; i++) await api('/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: 'mala-clave-' + i } });
  r = await api('/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: 'mala-clave-5' } }); r = await api('/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: 'Manager-Clave-2026' } });
  ok(r.s === 429 && /una hora/.test(r.j.error) && Number(r.h.get('retry-after')) > 3000, `5 fallos → bloqueo de 1 hora aunque la contraseña sea la buena (${r.s}, Retry-After ${r.h.get('retry-after')})`);

  console.log('\n5) con la carpeta de datos DENTRO de la web (Plesk sin permisos de raíz): protegida');
  const inside = path.join(WWW, 'api/storage'); fs.mkdirSync(inside, { recursive: true }); spawnSync('chown', ['-R', 'www-data:www-data', inside]);
  writeCfg({ storage_dir: inside }); await get('/api/health');
  r = await api('/contact', { method: 'POST', body: { name: 'Luis Dentro', email: 'luis@example.com', message: 'Mensaje con la carpeta de datos dentro de la web.', privacy: true, lang: 'es' }, headers: { 'X-Forwarded-For': '203.0.113.9' } }); ok(r.s === 200 || r.s === 429, `mensaje con el almacén dentro de la web (${r.s})`);
  const files = fs.existsSync(path.join(inside, 'kv')) ? fs.readdirSync(path.join(inside, 'kv')) : [];
  ok(files.length > 0, `el almacén escribe dentro de api/storage/kv (${files.length} ficheros)`);
  for (const f of files.slice(0, 3)) { const x = await get('/api/storage/kv/' + encodeURIComponent(f)); ok(!/luis|Luis|torivac|"v"/.test(x.t) && [401, 403, 404].includes(x.s), `api/storage/kv/${f.slice(0, 30)}… no se sirve (${x.s})`); }
  const sx = await get('/api/storage/'); ok([401, 403, 404].includes(sx.s), `api/storage/ no se lista (${sx.s})`);
  // la copia de seguridad y el registro de actividad también viven en la carpeta de datos: tampoco se bajan por la web
  await api('/users', { method: 'POST', token: MASTER, body: { email: 'jefa2@torivac.com', name: 'Jefa Dos', role: 'manager', password: 'Manager-Clave-2026' } });
  r = await api('/auth/login', { method: 'POST', body: { email: 'jefa2@torivac.com', password: 'Manager-Clave-2026' } });
  const tok2 = r.j && r.j.token;
  r = await api('/backups', { method: 'POST', token: tok2, body: {} });
  ok(r.s === 200 && r.j && r.j.backup && r.j.backup.file, 'con el almacén dentro de la web se puede hacer una copia de seguridad desde el panel');
  const bf = r.j && r.j.backup && r.j.backup.file, day = new Date().toISOString().slice(0, 10);
  ok(!!bf && fs.existsSync(path.join(inside, 'backups', bf)) && fs.existsSync(path.join(inside, 'audit', day + '.jsonl')), 'la copia y el registro de actividad existen en la carpeta de datos');
  for (const p of ['/api/storage/backups/' + bf, '/api/storage/backups/' + bf + '.json', '/api/storage/audit/' + day + '.jsonl', '/api/storage/audit/']) {
    const x = await get(p); ok([401, 403, 404].includes(x.s) && !/torivac_backup|"a":"login|"k":"user:/.test(x.t), `${p.slice(0, 56)}… no se sirve (${x.s}): ni la copia ni el registro de actividad se bajan por la web`);
  }

  const errLog = ap.log();
  const bad = errLog.split('\n').filter((l) => /\[core:alert\]|Invalid command|Argument for|Syntax error|AH\d+: .*(\.htaccess)/.test(l) && !/AH01630/.test(l));
  ok(bad.length === 0, 'Apache no se queja de ninguna directiva del .htaccess' + (bad.length ? ': ' + bad[0].slice(0, 200) : ''));
  ok(!/PHP (Fatal|Parse|Warning)/.test(errLog), 'PHP no registra errores fatales ni avisos' + (/PHP (Fatal|Parse|Warning)/.test(errLog) ? ': ' + (errLog.match(/PHP (Fatal|Parse|Warning)[^\n]*/) || [''])[0].slice(0, 200) : ''));

  // ───────────────────────────────────────── producción: un segundo paquete (https, sin pruebas) sobre otro Apache
  console.log('\n6) producción: HTTPS obligatorio, un solo host, HSTS, sitemap, llms.txt y robots.txt');
  const port2 = await new Promise((res) => { const sv = net.createServer(); sv.listen(0, '127.0.0.1', () => { const p = sv.address().port; sv.close(() => res(p)); }); });
  const PROD = 'https://example.test';
  const OUT2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-apache-prod-')); fs.chmodSync(OUT2, 0o755);
  execFileSync('python3', ['-I', path.join(ROOT, 'scripts/package_cpanel.py'), `--base=${PROD}`, `--out=${OUT2}`, '--keep', '--allow-dirty'], { stdio: 'pipe' });
  const WWW2 = path.join(OUT2, fs.readdirSync(OUT2).find((d) => fs.statSync(path.join(OUT2, d)).isDirectory()));
  spawnSync('chmod', ['-R', 'a+rX', WWW2]);
  const ap2 = await startApache({ docroot: WWW2, port: port2 });
  try {
    /** GET con las cabeceras que se indiquen (incluido Host, que fetch no deja cambiar) → { s, h, t } */
    const raw = (p, headers = {}) => new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: port2, path: p, headers }, (rs) => { let t = ''; rs.setEncoding('utf8'); rs.on('data', (d) => { t += d; }); rs.on('end', () => res({ s: rs.statusCode, h: rs.headers, t })); }).on('error', rej); });
    const H = { host: 'example.test', 'x-forwarded-proto': 'https' };
    let x = await raw('/', { host: 'example.test' }); ok(x.s === 301 && x.h.location === PROD + '/', `http sin cabecera de https → 301 a ${x.h.location}`);
    x = await raw('/presupuesto/?a=1', { host: 'example.test' }); ok(x.s === 301 && x.h.location === PROD + '/presupuesto/?a=1', 'y conserva la ruta y los parámetros');
    x = await raw('/', H); ok(x.s === 200, 'detrás del proxy (X-Forwarded-Proto: https) se sirve sin redirigir en bucle');
    ok(/max-age=31536000/.test(x.h['strict-transport-security'] || ''), `HSTS de un año (${x.h['strict-transport-security']})`);
    ok(!x.h['x-robots-tag'] && !/name="robots"[^>]*noindex/i.test(x.t), 'producción: sin noindex en cabecera ni en la página');
    ok(new RegExp(`<link rel="canonical" href="${PROD}/"`).test(x.t), 'canonical absoluto con https');
    x = await raw('/', { host: 'www.example.test', 'x-forwarded-proto': 'https' }); ok(x.s === 301 && x.h.location === PROD + '/', `www → 301 al dominio sin www (${x.h.location})`);
    x = await raw('/robots.txt', H); ok(x.s === 200 && /Disallow: \/admin\//.test(x.t) && /Disallow: \/api\//.test(x.t) && x.t.includes(`Sitemap: ${PROD}/sitemap.xml`), 'robots.txt: permite el sitio, cierra /admin/ y /api/ y enlaza el sitemap');
    x = await raw('/sitemap.xml', H); const urls = (x.t.match(/<loc>/g) || []).length; ok(x.s === 200 && /xml/.test(x.h['content-type'] || '') && urls > 500 && /xhtml:link rel="alternate" hreflang="en"/.test(x.t) && /image:loc/.test(x.t), `sitemap.xml: ${urls} direcciones con hreflang e imágenes`);
    x = await raw('/llms.txt', H); ok(x.s === 200 && /text\/plain/.test(x.h['content-type'] || '') && /Torivac/.test(x.t) && x.t.includes(PROD + '/'), `llms.txt servido como texto (${x.t.length} caracteres)`);
    x = await raw('/llms-full.txt', H); ok(x.s === 200 && x.t.length > 5000, `llms-full.txt (${x.t.length} caracteres)`);
    x = await raw('/en/', H); ok(x.s === 200 && x.t.includes(`<link rel="alternate" hreflang="es" href="${PROD}/"`) && x.t.includes('hreflang="x-default"'), 'hreflang cruzado entre idiomas con x-default');
    x = await raw('/api/health', H); ok(x.s === 500 || x.s === 200, 'la API responde en producción (200 o 500 de configuración ausente: sin config.php)');
  } finally { await ap2.stop(); fs.rmSync(OUT2, { recursive: true, force: true }); }
} catch (e) {
  fails++; console.error('  ✗ error en la prueba: ' + (e && e.stack || e)); console.error(ap.log());
} finally {
  await ap.stop(); fs.rmSync(OUT, { recursive: true, force: true });
}
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ Apache real + PHP-FPM: URLs, redirecciones, 404, ocultos, WordPress 410, cabeceras, api/ cerrada, Authorization, contacto y bloqueo correctos');
process.exit(fails ? 1 : 0);
