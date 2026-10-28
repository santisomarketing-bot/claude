#!/usr/bin/env node
// [QA-UPDATE] Actualizar la web publicada sin que el navegador mezcle HTML nuevo con CSS o catálogo viejos.
// Reproduce lo que pasa en un hosting real: el HTML no se guarda (Cache-Control: no-cache) y los CSS/JS se guardan una semana (max-age=604800), igual que el .htaccess.
// Compila DOS versiones de producción (v1 = Ficha técnica, v2 = Clásico: hoja de estilos distinta), sirve una y, con el MISMO navegador y su caché, «publica» la otra:
//   1) la actualización se ve entera (HTML, CSS) en la primera visita tras publicar, y lo que no cambió (catálogo) no se descarga otra vez
//   2) volver atrás (publicar v1 de nuevo) también es inmediato y correcto
//   3) CONTROL: con las mismas direcciones sin huella (como antes) el navegador se queda con el CSS viejo: así se sabe que la prueba detecta el problema que la huella evita
//   node scripts/qa-update.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { freePort } from './lib/backends.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);

// ───────────────────────────────────────── [VERSIONES] dos compilaciones de producción con la misma URL base
const port = await freePort(), BASE = `http://127.0.0.1:${port}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-upd-'));
const DIR = { v1: path.join(TMP, 'v1'), v2: path.join(TMP, 'v2') };
await Promise.all([['v1', 'ficha'], ['v2', 'clasico']].map(([n, theme]) => run('node', [path.join(ROOT, 'site/build.mjs'), `--base=${BASE}`, '--php-api', `--out=${DIR[n]}`, `--theme=${theme}`, '--no-theme-switch'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })));

// ───────────────────────────────────────── [SERVIDOR] cabeceras de caché como el .htaccess: HTML sin caché, CSS/JS una semana, el resto un año
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain', '.xml': 'application/xml' };
let current = DIR.v1, strip = false;                   // qué versión «está publicada» y si se quitan las huellas de las direcciones (el control)
const server = http.createServer((req, res) => {
  let u; try { u = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('400'); }
  if (u.endsWith('/')) u += 'index.html';
  const root = path.resolve(current), fp = path.join(root, u);
  if (!fp.startsWith(root + path.sep) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const ext = path.extname(fp).toLowerCase();
  const cache = ext === '.html' ? 'no-cache' : ext === '.css' || ext === '.js' ? 'public, max-age=604800' : 'public, max-age=31536000';
  const head = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache };
  if (ext === '.html' && strip) { res.writeHead(200, head); return res.end(fs.readFileSync(fp, 'utf8').replace(/\?v=[0-9a-f]{10}/g, '')); }
  res.writeHead(200, head);
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

// ───────────────────────────────────────── [NAVEGADOR]
const browser = await chromium.launch();
let fails = 0;
/** Anota una comprobación: la cuenta como fallo si no se cumple y la imprime. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Qué ve la página tras cargar: aspecto, dirección y origen (red o caché) de site.css y catalog.js, y si la hoja en uso lleva la capa de «Ficha técnica». */
const look = (page) => page.evaluate(() => {
  // Dirección (sin el origen) y si vino de la red del recurso cuya URL contiene `needle`; null si la página no lo pidió.
  const res = (needle) => { const e = performance.getEntriesByType('resource').find((x) => x.name.includes(needle)); return e ? { url: e.name.replace(location.origin, ''), net: e.transferSize > 0 } : null; };
  const sheet = [...document.styleSheets].find((s) => s.href && s.href.includes('/assets/css/site.css'));
  let layerFicha = false;
  try { layerFicha = [...sheet.cssRules].some((r) => r.constructor.name === 'CSSLayerBlockRule' && r.name === 'ficha'); } catch (e) { /* hoja inaccesible */ }
  return { theme: document.documentElement.dataset.theme, css: res('/assets/css/site.css'), catalog: res('/assets/data/catalog.js'), layerFicha };
});
/** Pestaña nueva en un contexto nuevo (caché vacía). */
const newPage = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' }); return ctx.newPage(); };

console.log('1) publicar v1 y visitar: todo llega por la red; la segunda visita sale de la caché (la prueba tiene caché de verdad)');
let page = await newPage();
current = DIR.v1; strip = false;
await page.goto(BASE + '/'); const a1 = await look(page);
ok(a1.theme === 'ficha' && a1.layerFicha, `v1: aspecto ${a1.theme}, hoja con la capa de Ficha técnica`);
ok(/\/assets\/css\/site\.css\?v=[0-9a-f]{10}$/.test(a1.css?.url || ''), `la hoja se pide con huella: ${a1.css?.url}`);
ok(/\/assets\/data\/catalog\.js\?v=[0-9a-f]{10}$/.test(a1.catalog?.url || ''), `el catálogo también: ${a1.catalog?.url}`);
ok(a1.css.net && a1.catalog.net, 'primera visita: CSS y catálogo descargados');
await page.goto(BASE + '/en/'); const a2 = await look(page);
ok(!a2.css.net && !a2.catalog.net, 'otra página del mismo sitio: CSS y catálogo salen de la caché (max-age de una semana en vigor)');

console.log('\n2) «publicar» v2 (otra hoja de estilos): la primera visita ya la muestra entera, y solo se descarga lo que cambió');
current = DIR.v2;
await page.goto(BASE + '/'); const b1 = await look(page);
ok(b1.theme === 'clasico', `HTML nuevo (aspecto ${b1.theme})`);
ok(b1.css.url !== a1.css.url && b1.css.net, `hoja nueva pedida a la red: ${b1.css.url}`);
ok(!b1.layerFicha, 'la hoja en uso es la nueva (ya no tiene la capa de Ficha técnica), no la vieja de la caché');
ok(b1.catalog.url === a1.catalog.url && !b1.catalog.net, 'el catálogo no cambió: misma dirección y sin descargarlo otra vez');

console.log('\n3) volver atrás (publicar v1 otra vez): inmediato y correcto, con la hoja que ya estaba en caché');
current = DIR.v1;
await page.goto(BASE + '/'); const c1 = await look(page);
ok(c1.theme === 'ficha' && c1.layerFicha, 'vuelve el aspecto y la hoja de v1');
ok(c1.css.url === a1.css.url && !c1.css.net, 'sin descargar nada: la hoja de v1 seguía en la caché');
await page.context().close();

console.log('\n4) CONTROL: las mismas direcciones SIN huella (como antes de este arreglo): el navegador se queda con el CSS viejo');
page = await newPage();
strip = true; current = DIR.v1;
await page.goto(BASE + '/');
current = DIR.v2;
await page.goto(BASE + '/'); const d1 = await look(page);
ok(d1.theme === 'clasico' && d1.layerFicha === true, `reproducido: HTML nuevo (${d1.theme}) con la hoja vieja de la caché (la capa de Ficha técnica sigue ahí)`);
await page.context().close();

await browser.close();
server.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ actualización sin caché vieja: HTML y CSS siempre de la misma versión, lo que no cambia no se vuelve a descargar y el control reproduce el problema que se evita');
process.exit(fails ? 1 : 0);
