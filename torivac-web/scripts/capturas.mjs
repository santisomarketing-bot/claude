#!/usr/bin/env node
// [CAPTURAS] Capturas de pantalla de las vistas clave del demo (para revisar sin abrir nada) + PDF de ejemplo.
//   node scripts/capturas.mjs [carpeta-salida]        (por defecto entrega/capturas)
// Sirve dist/ por http, recorre el flujo de un cliente (ficha → presupuesto → PDF) y el panel de gestión, y guarda PNG numerados.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'entrega', 'capturas'));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await serve(DIST);

const sb = { window: {} }; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data/catalog.js'), 'utf8'), sb);
const items = sb.TV.items;

const browser = await chromium.launch();
const mk = async (w, h, lang = 'es') => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: lang === 'es' ? 'es-ES' : lang, acceptDownloads: true, deviceScaleFactor: w < 600 ? 2 : 1 });
  await ctx.addInitScript(([l]) => { try { localStorage.setItem('tv_lang', l); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } }, [lang]);
  return { ctx, page: await ctx.newPage() };
};
let n = 0;
const shot = async (page, name, opts = {}) => { n++; const f = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f, ...opts }); console.log('  ' + path.basename(f)); };
const settle = (page, ms = 500) => page.waitForLoadState('load').then(() => page.waitForTimeout(ms));

// ───────────────────────────── escritorio, español
{ const { ctx, page } = await mk(1440, 900);
  await page.goto(base + '/'); await settle(page);
  await shot(page, 'inicio-es');
  await shot(page, 'inicio-es-completa', { fullPage: true });
  await page.goto(base + '/productos/'); await settle(page);
  await shot(page, 'productos');
  const first = page.locator('a[href*="categoria-producto"]').first();
  const href = await first.getAttribute('href');
  await page.goto(new URL(href, page.url()).href); await settle(page);
  await shot(page, 'categoria', { fullPage: false });

  // ficha del transformador toroidal serie TT, con cantidades
  const byPid = (pid) => Object.keys(items).find((r) => items[r].pid === pid);
  const ttPath = items[byPid(884)].p.es;
  await page.goto(base + ttPath); await settle(page);
  await page.locator('[data-qty]').first().fill('12');
  await page.locator('[data-qty]').first().dispatchEvent('input');
  await page.locator('.models').first().scrollIntoViewIfNeeded();
  await shot(page, 'ficha-transformador-TT');
  await page.locator('[data-add-selected]').click();
  for (const [ref, q] of [[byPid(8339), 2], [byPid(932), 200]]) await page.evaluate(([r, qq]) => TV.Quote.add(r, qq), [ref, q]);
  await page.waitForTimeout(300);
  await page.locator('[data-open-quote]').first().click(); await page.waitForTimeout(500);
  await shot(page, 'cajon-presupuesto');

  await page.goto(base + '/presupuesto/'); await settle(page);
  await page.locator('[data-quote-form] [name=name]').fill('Marta Prueba');
  await page.locator('[data-quote-form] [name=company]').fill('Taller Ejemplo S.L.');
  await page.locator('[data-quote-form] [name=email]').fill('marta@example.com');
  await shot(page, 'presupuesto', { fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download-pdf]').click()]);
  const pdf = path.join(OUT, 'ejemplo-presupuesto.pdf'); await dl.saveAs(pdf);
  n++; execFileSync('pdftoppm', ['-png', '-r', '70', '-f', '1', '-l', '1', pdf, path.join(OUT, `${String(n).padStart(2, '0')}-pdf-presupuesto`)]);
  const gen = fs.readdirSync(OUT).find((f) => /pdf-presupuesto.*\.png$/.test(f)); if (gen) { fs.renameSync(path.join(OUT, gen), path.join(OUT, `${String(n).padStart(2, '0')}-pdf-presupuesto.png`)); console.log(`  ${String(n).padStart(2, '0')}-pdf-presupuesto.png`); }
  await ctx.close(); }

// ───────────────────────────── panel de gestión
{ const { ctx, page } = await mk(1440, 900);
  await page.goto(base + '/admin/'); await page.waitForTimeout(400);
  await shot(page, 'panel-login');
  await page.fill('[name=email]', 'manager@torivac.demo'); await page.fill('[name=pass]', 'Torivac-Manager-2026'); await page.click('button[type=submit]'); await page.waitForTimeout(500);
  await shot(page, 'panel-manager-resumen');
  for (const [h, name] of [['#precios', 'panel-precios'], ['#propuestas', 'panel-propuestas']]) {
    const a = page.locator(`.side nav a[href="${h}"]`);
    if (await a.count()) { await a.click(); await page.waitForTimeout(500); await shot(page, name); }
  }
  await ctx.close(); }

// ───────────────────────────── otros idiomas y móvil
for (const lang of ['fr', 'de']) { const { ctx, page } = await mk(1440, 900, lang); await page.goto(base + `/${lang}/`); await settle(page); await shot(page, `inicio-${lang}`); await ctx.close(); }
{ const { ctx, page } = await mk(390, 844);
  await page.goto(base + '/'); await settle(page); await shot(page, 'movil-inicio');
  await page.goto(base + items[byPid(884)].p.es); await settle(page); await page.locator('.models').first().scrollIntoViewIfNeeded(); await shot(page, 'movil-ficha');
  await ctx.close(); }

await browser.close(); server.close();
console.log(`\n${n} capturas en ${OUT}`);
