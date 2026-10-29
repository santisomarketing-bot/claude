#!/usr/bin/env node
// [SMOKE] Prueba de humo del demo en un navegador real (Playwright). Modo file:// (doble clic) y capturas.
//   node scripts/smoke.mjs [--shots] [--lang=es]
// Comprueba: errores de consola/red local, que no haya texto desbordado, flujo de presupuesto (añadir, cantidades, total, PDF).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'data', 'raw', 'screens', 'demo');
/** Valor de la opción --k=valor de la línea de comandos (undefined si no se indicó). */
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}`)) || '').split('=')[1];
const shots = process.argv.includes('--shots');
const lang = arg('lang') || 'es';
fs.mkdirSync(SHOTS, { recursive: true });
/** URL file:// de la ruta p dentro de dist/ (las que acaban en «/» apuntan a su index.html). */
const url = (p) => 'file://' + path.join(DIST, p.replace(/^\//, ''), p.endsWith('/') ? 'index.html' : '');
const home = lang === 'es' ? '/' : `/${lang}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: lang === 'es' ? 'es-ES' : lang });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource.*favicon/.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => { if (!/google|gstatic|grupotorivac\.com\/wp-/.test(r.url())) problems.push('requestfailed: ' + r.url()); });

const results = [];
/** Visita la ruta p, ejecuta fn si se da, busca desbordes horizontales y (con --shots) captura la página; anota los problemas nuevos. */
async function visit(name, p, fn) {
  const before = problems.length;
  await page.goto(url(p), { waitUntil: 'load' });
  await page.waitForTimeout(300);
  if (fn) await fn();
  // desbordes horizontales
  const over = await page.evaluate(() => { const w = document.documentElement.clientWidth; const clipped = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)) return true; return false; }; return [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('.tbl-wrap,.carousel,.quote-drawer,.sidebar,.wave,.hero') && !clipped(e); }).slice(0, 4).map((e) => e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 40)); });
  if (over.length) problems.push(`desborde horizontal en ${name}: ${over.join(', ')}`);
  if (shots) { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } window.scrollTo(0, 0); }); await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, `${lang}-${name}.png`), fullPage: true }); }
  results.push({ name, path: p, newProblems: problems.length - before });
}

await visit('home', home);
await visit('productos', (await page.evaluate(() => 0), JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/meta.json'))).nav[lang][2].href.replace('https://grupotorivac.com', '')));
// tienda: todos los productos; de ahí, la ficha del primero
const SHOP = { es: '/tienda/', en: '/en/shop/', fr: '/fr/boutique/', de: '/de/shop/' };
await visit('tienda', SHOP[lang]);
const firstProd = await page.$eval('.pcard.store h3 a', (a) => a.getAttribute('href'));
await page.goto(new URL(firstProd, page.url()).href, { waitUntil: 'load' });
if (shots) await page.screenshot({ path: path.join(SHOTS, `${lang}-ficha.png`), fullPage: true });
// añadir al presupuesto
await page.fill('.models tbody tr:first-child [data-qty]', '12');
await page.click('.models tbody tr:first-child [data-add-row]');
await page.waitForTimeout(300);
const count = await page.$eval('.fab-quote [data-quote-count]', (e) => e.textContent);
results.push({ name: 'añadir-12', count });
if (shots) await page.screenshot({ path: path.join(SHOTS, `${lang}-ficha-añadido.png`) });
await page.click('[data-open-quote]'); await page.waitForTimeout(400);
if (shots) await page.screenshot({ path: path.join(SHOTS, `${lang}-cajon.png`) });
await page.keyboard.press('Escape');
await visit('presupuesto', JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/meta.json'))).nav[lang][0].href.replace('https://grupotorivac.com', '') && ({ es: '/presupuesto/', en: '/en/quote/', fr: '/fr/devis/', de: '/de/angebot/' })[lang], async () => {
  await page.fill('[data-quote-form] [name=name]', 'Prueba QA'); await page.fill('[data-quote-form] [name=email]', 'qa@example.com'); await page.check('[data-quote-form] [name=privacy]');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.click('[data-download-pdf]')]);
  results.push({ name: 'pdf', downloaded: !!dl, file: dl ? dl.suggestedFilename() : null });
  if (dl) await dl.saveAs(path.join(SHOTS, `${lang}-presupuesto.pdf`));
});
await visit('contacto', JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/meta.json'))).nav[lang][6].href.replace('https://grupotorivac.com', ''));
await visit('blog', JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/meta.json'))).nav[lang][5].href.replace('https://grupotorivac.com', ''));
await visit('empresa', JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/meta.json'))).nav[lang][1].href.replace('https://grupotorivac.com', ''));

// móvil
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await m.newPage();
await mp.goto(url(home), { waitUntil: 'load' });
if (shots) await mp.screenshot({ path: path.join(SHOTS, `${lang}-home-movil.png`), fullPage: true });
const mover = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
if (mover) problems.push('home móvil: scroll horizontal');
await browser.close();
console.log(JSON.stringify({ lang, results, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
