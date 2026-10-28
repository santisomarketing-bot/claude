#!/usr/bin/env node
// [QA-LANG] Sesión 13 · Detección de idioma del navegador + selector manual (Playwright, por http).
//   node scripts/qa-lang.mjs
// Casos: idioma del navegador soportado / no soportado / lista con preferencia secundaria · página interior · enlace directo a /fr/ ·
//        elección manual que manda · aviso «mantener» · el presupuesto sobrevive al cambio de idioma · selector accesible.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const { server, base } = await serve(DIST);
const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const pathOf = (p) => new URL(p.url()).pathname.replace(/index\.html$/, '');   // los enlaces del sitio terminan en index.html (funcionan también por file://)

// idioma del navegador → se simula con locale + navigator.languages (Playwright solo fija el primero)
async function visitor(languages, { storage } = {}) {
  const ctx = await browser.newContext({ locale: languages[0], viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(([langs]) => { Object.defineProperty(navigator, 'languages', { get: () => langs }); Object.defineProperty(navigator, 'language', { get: () => langs[0] }); }, [languages]);
  if (storage) await ctx.addInitScript(([kv]) => { try { for (const [k, v] of Object.entries(kv)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch (e) { /* ignorar */ } }, [storage]);
  const page = await ctx.newPage();
  return { ctx, page };
}
/** Espera a que la página termine de cargar y 150 ms más para que actúe la detección de idioma. */
const settle = (page) => page.waitForLoadState('load').then(() => page.waitForTimeout(150));
/** Valor de localStorage para la clave k en la página (null si no existe). */
const ls = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);

console.log('\n1) navegador en francés, primera visita a la portada española → va a /fr/ una sola vez');
{ const { ctx, page } = await visitor(['fr-FR', 'fr']);
  await page.goto(base + '/'); await page.waitForURL(/\/fr\//, { timeout: 5000 }).catch(() => {}); await settle(page);
  ok(pathOf(page).startsWith('/fr/'), `aterriza en ${pathOf(page)}`);
  ok((await ls(page, 'tv_lang')) === 'fr' && (await ls(page, 'tv_lang_src')) === 'auto', 'guarda fr como automático (no manual)');
  ok((await page.locator('html').getAttribute('lang')) === 'fr', '<html lang="fr">');
  // volver a la portada española (p. ej. con el botón atrás o un enlace) NO debe redirigir otra vez: solo avisa
  await page.goto(base + '/'); await settle(page);
  ok(pathOf(page) === '/', 'segunda visita a / se queda en español (sin redirección repetida)');
  ok(await page.locator('#lang-banner').isVisible(), 'y ofrece el aviso para cambiar a francés');
  await ctx.close(); }

console.log('\n2) elección manual: manda siempre y se recuerda');
{ const { ctx, page } = await visitor(['de-DE', 'de']);
  await page.goto(base + '/'); await page.waitForURL(/\/de\//, { timeout: 5000 }).catch(() => {}); await settle(page);
  ok(pathOf(page).startsWith('/de/'), `navegador alemán → ${pathOf(page)}`);
  await page.locator('a[data-set-lang="es"]').first().click(); await settle(page);
  ok(pathOf(page) === '/', 'el selector ES lleva a la portada española');
  ok((await ls(page, 'tv_lang')) === 'es' && (await ls(page, 'tv_lang_src')) === 'manual', 'queda guardado como manual');
  await page.goto(base + '/'); await settle(page);
  ok(pathOf(page) === '/' && !(await page.locator('#lang-banner').isVisible()), 'recargar no redirige ni molesta');
  await page.goto(base + '/de/'); await settle(page);
  ok(pathOf(page) === '/de/', 'un enlace directo a /de/ se respeta (no se fuerza a español)');
  ok(await page.locator('#lang-banner').isVisible(), 'pero se ofrece volver al idioma elegido');
  await ctx.close(); }

console.log('\n3) idioma no soportado o lista con preferencia secundaria');
{ const { ctx, page } = await visitor(['pt-BR', 'pt']);
  await page.goto(base + '/'); await settle(page);
  ok(pathOf(page) === '/' && !(await page.locator('#lang-banner').isVisible()), 'portugués: se queda en español, sin aviso');
  await ctx.close(); }
{ const { ctx, page } = await visitor(['pt-BR', 'en-GB', 'en']);
  await page.goto(base + '/'); await page.waitForURL(/\/en\//, { timeout: 5000 }).catch(() => {}); await settle(page);
  ok(pathOf(page).startsWith('/en/'), `pt-BR,en-GB → inglés (${pathOf(page)})`);
  await ctx.close(); }
{ const { ctx, page } = await visitor(['es-AR', 'es']);
  await page.goto(base + '/'); await settle(page);
  ok(pathOf(page) === '/' && !(await page.locator('#lang-banner').isVisible()), 'es-AR: español, sin aviso');
  await ctx.close(); }

console.log('\n4) página interior: redirige a la EQUIVALENTE, no a la portada');
{ const { ctx, page } = await visitor(['en-US', 'en']);
  await page.goto(base + '/presupuesto/'); await page.waitForURL(/\/en\/quote\//, { timeout: 5000 }).catch(() => {}); await settle(page);
  ok(pathOf(page) === '/en/quote/', `/presupuesto/ → ${pathOf(page)}`);
  await ctx.close(); }

console.log('\n5) enlace directo a otro idioma con navegador distinto: se respeta y se avisa');
{ const { ctx, page } = await visitor(['en-US', 'en']);
  await page.goto(base + '/fr/'); await settle(page);
  ok(pathOf(page) === '/fr/', 'no redirige desde /fr/');
  ok(await page.locator('#lang-banner').isVisible(), 'muestra el aviso en el idioma del navegador');
  const msg = await page.locator('#lang-banner').innerText();
  ok(/english|view|switch/i.test(msg), `aviso en inglés: «${msg.replace(/\s+/g, ' ').slice(0, 80)}»`);
  await page.locator('[data-lang-keep]').click();
  ok(!(await page.locator('#lang-banner').isVisible()) && (await ls(page, 'tv_lang')) === 'fr' && (await ls(page, 'tv_lang_src')) === 'manual', '«mantener» oculta el aviso y recuerda fr como manual');
  await page.goto(base + '/fr/'); await settle(page);
  ok(!(await page.locator('#lang-banner').isVisible()), 'no vuelve a molestar');
  await ctx.close(); }

console.log('\n6) el presupuesto sobrevive al cambio de idioma');
{ const { ctx, page } = await visitor(['es-ES', 'es'], { storage: { tv_lang: 'es', tv_lang_src: 'manual', tv_lang_auto_done: '1' } });
  await page.goto(base + '/'); await settle(page);
  await page.evaluate(() => TV.Quote.add(Object.keys(TV.items)[0], 3));
  for (const l of ['en', 'fr', 'de', 'es']) {
    await page.locator(`a[data-set-lang="${l}"]`).first().click(); await settle(page);
    const n = await page.evaluate(() => TV.Quote.count());
    ok(n === 3 && (await page.locator('html').getAttribute('lang')) === l, `${l}: 3 uds. en el presupuesto, <html lang="${l}">`);
  }
  await ctx.close(); }

console.log('\n7) selector accesible: enlaces con hreflang/lang, aria-current, navegable con teclado y en móvil');
{ const { ctx, page } = await visitor(['es-ES', 'es'], { storage: { tv_lang: 'es', tv_lang_src: 'manual' } });
  await page.goto(base + '/'); await settle(page);
  const sel = page.locator('a[data-set-lang]');
  const n = await sel.count(); ok(n >= 4, `${n} enlaces de idioma`);
  const attrs = await sel.evaluateAll((els) => els.slice(0, 4).map((e) => [e.getAttribute('hreflang'), e.getAttribute('lang'), e.getAttribute('aria-current'), e.getAttribute('title')]));
  ok(attrs.every((a) => a[0] && a[1] && a[3]), 'cada enlace lleva hreflang, lang y title (nombre del idioma)');
  ok(attrs.filter((a) => a[2] === 'true').length === 1 && attrs.find((a) => a[2] === 'true')[0] === 'es', 'solo el idioma actual lleva aria-current');
  const target = page.locator('a[data-set-lang="en"]').first();
  await target.focus(); await page.keyboard.press('Enter'); await settle(page);
  ok(pathOf(page).startsWith('/en/'), 'Enter sobre EN cambia de idioma');
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto(base + '/en/'); await settle(page);
  const burger = page.locator('[data-nav-toggle], .nav-toggle, button[aria-controls*="nav"]').first();
  if (await burger.count()) await burger.click().catch(() => {});
  const visible = await page.locator('a[data-set-lang]:visible').count();
  ok(visible >= 4, `en móvil (390 px) hay ${visible} enlaces de idioma visibles`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(!over, 'sin desbordamiento horizontal en móvil');
  await ctx.close(); }

await browser.close(); server.close();
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ idioma: detección, selector y persistencia correctos');
process.exit(fails ? 1 : 0);
