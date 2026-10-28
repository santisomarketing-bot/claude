#!/usr/bin/env node
// [QA-ART] Sesión 12 · Piezas gráficas: osciloscopio del variador (4 idiomas, ratón/teclado, movimiento reducido) y bobinado toroidal de la portada.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const { server, base } = await serve(DIST);
const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const CAT = { es: '/categoria-producto/variadores-de-tension/', en: '/en/categoria-producto/voltage-variators-adjustable-autotransformers/', fr: '/fr/categoria-producto/regulateurs-de-tension-autotransformateurs-reglables/', de: '/de/categoria-producto/spannungsregler-einstellbare-spartransformatoren/' };
for (const lang of ['es', 'en', 'fr', 'de']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(([l]) => { localStorage.setItem('tv_lang', l); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); }, [lang]);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  console.log(`\n${lang.toUpperCase()}`);
  await page.goto(base + CAT[lang]); await page.waitForTimeout(400);
  const lab = page.locator('[data-lab]'); ok((await lab.count()) === 1, 'osciloscopio presente');
  const title = await lab.locator('h2').innerText(); ok(title.length > 8, `título «${title}»`);
  const d0 = await lab.locator('[data-wl-out-path]').getAttribute('d');
  await lab.locator('[data-wl-range]').fill('40'); await page.waitForTimeout(700);
  ok((await lab.locator('[data-wl-readout]').innerText()) === '40 V ~', 'la lectura sigue al mando (40 V)');
  const d1 = await lab.locator('[data-wl-out-path]').getAttribute('d');
  /** Amplitud vertical (máx − mín de y) de los tramos «L x y» de un trazado SVG d. */
  const amp = (d) => { const ys = [...d.matchAll(/L\d+ ([\d.]+)/g)].map((m) => +m[1]); return Math.max(...ys) - Math.min(...ys); };
  ok(amp(d1) < amp(d0) * 0.5, `la amplitud de salida baja (${amp(d0).toFixed(0)} → ${amp(d1).toFixed(0)})`);
  await lab.locator('[data-wl-range]').focus(); await page.keyboard.press('Home'); await page.waitForTimeout(500);
  ok((await lab.locator('[data-wl-readout]').innerText()) === '0 V ~', 'teclado: Inicio lleva a 0 V');
  ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}
// movimiento reducido: onda quieta y espiras completas
{ const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); });
  const page = await ctx.newPage();
  console.log('\nmovimiento reducido');
  await page.goto(base + CAT.es); await page.waitForTimeout(300);
  const a = await page.locator('[data-wl-in]').getAttribute('d'); await page.waitForTimeout(500); const b = await page.locator('[data-wl-in]').getAttribute('d');
  ok(a === b, 'la onda no se anima');
  await page.goto(base + '/'); await page.waitForTimeout(300);
  ok(!(await page.locator('.toroid-art').evaluate((e) => e.classList.contains('armed'))), 'las espiras no se «arman» (se ven completas)');
  await ctx.close(); }
// portada normal: las espiras se dibujan al entrar en pantalla
{ const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); });
  const page = await ctx.newPage();
  console.log('\nportada');
  await page.goto(base + '/'); await page.waitForTimeout(300);
  ok((await page.locator('.toroid-art .tt').count()) === 56, '56 espiras');
  ok(!(await page.locator('.toroid-art').evaluate((e) => e.classList.contains('in'))), 'antes de verse no están dibujadas');
  await page.locator('.toroid-art').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  ok(await page.locator('.toroid-art').evaluate((e) => e.classList.contains('in')), 'al entrar en pantalla se dibujan');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'sin desbordamiento horizontal');
  await ctx.close(); }
await browser.close(); server.close();
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ piezas gráficas correctas');
process.exit(fails ? 1 : 0);
