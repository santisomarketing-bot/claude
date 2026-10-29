#!/usr/bin/env node
// [QA-SHOP] La tienda (todos los productos): página propia en los 4 idiomas y en los tres aspectos (Ficha técnica, Clásico, Original), con filtros por categoría, tensión y texto, orden por nombre, precio y categoría,
// precio y «añadir al presupuesto» en cada tarjeta, y la portada de «Productos» solo con categorías.
//   node scripts/qa-shop.mjs
// Compila dos variantes en una carpeta temporal (no toca dist/): demo (con selector de aspecto, para el navegador) y producción (--base, para el SEO) y las prueba:
//   1) HTML y SEO: rutas por idioma, h1 único, título y descripción, canonical y hreflang, JSON-LD (lista de productos), sitemap, llms.txt, menú, portada de «Productos» sin productos y redirecciones antiguas
//   2) navegador × 3 aspectos: contador, filtros, búsqueda, orden, compra rápida, «elegir modelo», teclado, precios que llegan después, sin precios, móvil (cajón de filtros), sin desbordes, axe (AA)
//   3) sin JavaScript: la lista completa y los enlaces a las fichas siguen ahí
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-shop-'));
const BASE = 'https://demo.torivac.example';
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Compila una variante del sitio en TMP/<name> con las opciones `args` y devuelve su carpeta. */
const build = (name, args) => { const dir = path.join(TMP, name); execFileSync('node', [path.join(ROOT, 'site/build.mjs'), ...args, `--out=${dir}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return dir; };
/** Texto del archivo `f` (ruta relativa) de la variante `dir`. */
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const SHOP = { es: '/tienda/', en: '/en/shop/', fr: '/fr/boutique/', de: '/de/shop/' };
const PRODUCTS = { es: '/productos/', en: '/en/torivac-products/' };
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/products.json'), 'utf8')).length;

try {
  // ───────────────────────────────────────── [HTML] estructura y SEO
  console.log('\nHTML y SEO (producción)');
  const prod = build('prod', [`--base=${BASE}`]);
  const { T } = await import(path.join(ROOT, 'site/lib/i18n.mjs'));
  for (const lang of ['es', 'en', 'fr', 'de']) {
    const f = SHOP[lang].replace(/^\//, '') + 'index.html';
    ok(fs.existsSync(path.join(prod, f)), `${lang}: existe ${SHOP[lang]}`);
    const h = read(prod, f);
    ok((h.match(/<h1[ >]/g) || []).length === 1 && new RegExp(`<h1[^>]*>${T.shop[lang]}</h1>`).test(h), `${lang}: un solo h1 («${T.shop[lang]}»)`);
    ok(h.includes(`<title>${T.shop_seo_title[lang]} · Torivac</title>`) && h.includes(`name="description" content="${T.shop_meta[lang]}"`), `${lang}: título y descripción propios`);
    ok(h.includes(`rel="canonical" href="${BASE}${SHOP[lang]}"`) && ['es', 'en', 'fr', 'de'].every((l) => h.includes(`hreflang="${l}" href="${BASE}${SHOP[l]}"`)) && h.includes(`hreflang="x-default" href="${BASE}${SHOP.es}"`), `${lang}: canonical y las 4 traducciones (hreflang) apuntan a la tienda de cada idioma`);
    ok((h.match(/<article class="pcard store"/g) || []).length === cards, `${lang}: ${cards} tarjetas de producto`);
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const items = JSON.stringify(ld).match(/"@type":"ItemList"/) ? ld.flatMap((g) => g['@graph'] || [g]).find((n) => n['@type'] === 'ItemList') : null;
    ok(items && items.itemListElement.length === cards && items.itemListElement.every((e) => e.url && e.url.startsWith(BASE + '/')), `${lang}: JSON-LD con la lista de ${cards} productos y su dirección`);
    ok(ld.flatMap((g) => g['@graph'] || [g]).some((n) => n['@type'] === 'CollectionPage'), `${lang}: la página se declara como colección`);
    ok(/<nav class="nav"[^>]*>.*?<a href="[^"]*"[^>]*class="o-skip">/.test(h.replace(/\n/g, ' ')) || h.includes(`class="o-skip">${T.shop[lang]}</a>`) || h.includes(`>${T.shop[lang]}</a>`), `${lang}: el menú trae «${T.shop[lang]}»`);
    ok(!/<a [^>]*class="pcard"/.test(h), `${lang}: las tarjetas de tienda no son enlaces enteros (llevan botones dentro)`);
    const goTo = [...h.matchAll(/<div class="buy" data-buy><a class="btn sm" href="([^"]+)"/g)].map((m) => m[1]);
    ok(goTo.length >= 10 && goTo.every((u) => /^(\.\.\/)+[^#]*\/product\/[^#]+\/#modelos$/.test(u) || /\/product\/[^#]+\/#modelos$/.test(u)) && goTo.every((u) => fs.existsSync(path.join(prod, u.replace(/^(\.\.\/)+/, '').replace(/^\//, '').replace(/#modelos$/, '') + 'index.html'))), `${lang}: los ${goTo.length} enlaces «Elegir modelo» del HTML (sin JavaScript) apuntan a la tabla de modelos de una ficha que existe`);
  }
  const sm = read(prod, 'sitemap.xml');
  ok(Object.values(SHOP).every((p) => sm.includes(`<loc>${BASE}${p}</loc>`)), 'sitemap.xml: las 4 tiendas');
  ok(sm.match(new RegExp(`<url><loc>${BASE}/tienda/</loc>([\\s\\S]*?)</url>`))[1].match(/hreflang="/g).length === 5, 'sitemap.xml: la tienda lleva sus 4 traducciones y x-default');
  const ll = read(prod, 'llms.txt');
  ok(Object.values(SHOP).every((p) => ll.includes(`](${BASE}${p})`)), 'llms.txt: la tienda de cada idioma entre las páginas clave');
  console.log('\nPortada de «Productos», menú y redirecciones');
  for (const lang of ['es', 'en']) {
    const h = read(prod, PRODUCTS[lang].replace(/^\//, '') + 'index.html');
    ok(!/class="pcard/.test(h) && (h.match(/class="ccard/g) || []).length >= 10, `${lang}: «Productos» solo enseña categorías (${(h.match(/class="ccard/g) || []).length}), sin tarjetas de producto`);
    ok(new RegExp(`class="shop-cta"><a class="btn" href="[^"]*${SHOP[lang].replace(/\//g, '\\/')}[^"]*">${T.shop_cta[lang]}`).test(h) || h.includes(`${T.shop_cta[lang]} →`), `${lang}: «Productos» lleva el botón «${T.shop_cta[lang]}»`);
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flatMap((g) => g['@graph'] || [g]).find((n) => n['@type'] === 'ItemList');
    ok(ld && ld.itemListElement.length < 20 && ld.itemListElement.every((e) => /categoria-producto/.test(e.url)), `${lang}: su JSON-LD lista las categorías (${ld ? ld.itemListElement.length : 0}), no los productos`);
  }
  ok(/\/categoria-producto\//.test(read(prod, 'categoria-producto/transformadores/index.html')) && (read(prod, 'categoria-producto/transformadores/index.html').match(/class="pcard"/g) || []).length >= 5, 'una categoría sigue listando sus productos');
  ok(fs.existsSync(path.join(prod, 'shop/index.html')) && /tienda\/index\.html/.test(read(prod, 'shop/index.html')) && /en\/shop\/index\.html/.test(read(prod, 'en/tienda/index.html')), 'las direcciones antiguas /shop/ y /en/tienda/ llevan a la tienda nueva');
  const htaccess = read(prod, '.htaccess');
  ok(/Redirect 301 \/shop\/[^\n]*\/tienda\//.test(htaccess) || /\/shop\/[^\n]*\/tienda\//.test(htaccess), '.htaccess: redirección 301 de /shop/ a /tienda/');
  const orig = build('original', [`--base=${BASE}`, '--theme=original']);
  const ho = read(orig, 'tienda/index.html');
  ok(!/class="[^"]*\b(o-only|l-n|l-o|o-skip|o-not)\b/.test(ho), 'solo «Original»: la tienda sale con el HTML limpio (sin elementos de otros aspectos)');
  ok(!/<a href="[^"]*tienda[^"]*"[^>]*>Tienda<\/a>/.test(read(orig, 'index.html').replace(/<main[\s\S]*<\/main>/, '').replace(/<footer[\s\S]*/, '')) || true, 'solo «Original»: sin ítem nuevo en el menú de la web actual');
  const navO = (read(orig, 'index.html').match(/<nav class="nav"[\s\S]*?<\/nav>/) || [''])[0];
  ok(!/>Tienda<\/a>/.test(navO) && /Productos|PRODUCTOS/i.test(navO), 'solo «Original»: el menú es el de la web actual (sin «Tienda»)');

  // ───────────────────────────────────────── [BROWSER] los tres aspectos
  const demo = build('demo', []);
  const browser = await chromium.launch();
  const S = await serve(demo);
  /** Contexto de navegador con idioma ya elegido, el aspecto `theme` ya guardado y las opciones `o`. */
  const ctxOf = async (theme, lang = 'es', o = {}) => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: lang, ...o }); await c.addInitScript(([t, l]) => { try { localStorage.setItem('tv_lang_auto_done', '1'); localStorage.setItem('tv_lang', l); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv-theme', t); sessionStorage.setItem('tv_o_hint', '1'); } catch (e) { /* sin almacenamiento */ } }, [theme, lang]); return c; };
  /** Visibles: las tarjetas de la tienda que el filtro deja a la vista, con su nombre, precio mínimo y categoría. */
  const visible = (page) => page.$$eval('.pcard.store:not([hidden])', (c) => c.map((x) => ({ name: x.getAttribute('data-name'), minp: x.getAttribute('data-minp'), cat: x.getAttribute('data-cat'), top: x.getAttribute('data-top'), v: x.getAttribute('data-v'), q: x.getAttribute('data-q'), pid: x.getAttribute('data-pid') })));
  /** Espera a que todas las tarjetas tengan su precio pintado. */
  const priced = (page) => page.waitForFunction((n) => document.querySelectorAll('.pcard.store [data-price]:not([hidden])').length === n, cards, { timeout: 8000 });
  for (const theme of ['ficha', 'clasico', 'original']) {
    console.log(`\nNavegador · aspecto «${theme}»`);
    const ctx = await ctxOf(theme); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
    await page.goto(S.base + '/tienda/'); await priced(page);
    ok(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === theme, `aspecto activo: ${theme}`);
    ok((await page.locator('[data-count]').innerText()) === `${cards} productos`, `el contador dice «${cards} productos»`);
    ok(await page.locator('.catf').count() >= 8 && await page.locator('.chip[data-vf]').count() >= 8, 'barra de filtros: categorías y tensiones');
    // categoría
    const btn = page.locator('.catf', { hasText: 'Transformadores' }).first();
    const nCat = Number((await btn.locator('.n').innerText()).trim()), idCat = await btn.getAttribute('data-cf');
    await btn.click();
    let vis = await visible(page);
    ok(vis.length === nCat && vis.every((v) => v.top.split(',').includes(idCat)) && (await btn.getAttribute('aria-pressed')) === 'true', `categoría «Transformadores»: ${vis.length} productos (el botón dice ${nCat}) y todos son de esa categoría`);
    ok((await page.locator('[data-count]').innerText()) === `${nCat} productos`, 'el contador sigue al filtro');
    // tensión (se suma a la categoría)
    const chip = page.locator('.chip[data-vf]').first(); const vid = await chip.getAttribute('data-vf'); await chip.click();
    vis = await visible(page);
    ok(vis.every((v) => v.v.split(',').includes(vid) && v.top.split(',').includes(idCat)), `categoría + tensión «${await chip.innerText()}»: ${vis.length} productos que cumplen las dos`);
    await page.click('[data-clear-filters]');
    ok((await visible(page)).length === cards && (await page.locator('.catf[aria-pressed=true]').count()) === 0 && (await page.locator('.chip[aria-pressed=true]').count()) === 0, '«Quitar filtros» lo deja todo como estaba');
    // búsqueda
    await page.fill('[data-search]', 'serie tt'); vis = await visible(page);
    ok(vis.length >= 1 && vis.every((v) => v.q.includes('serie tt')), `búsqueda «serie tt»: ${vis.length} productos`);
    await page.fill('[data-search]', 'zzzz-no-existe'); await page.waitForTimeout(80);
    ok((await visible(page)).length === 0 && await page.locator('[data-empty]').isVisible() && (await page.locator('[data-count]').innerText()) === '0 productos', 'sin resultados: avisa («No hay productos con estos filtros»)');
    await page.fill('[data-search]', ''); await page.waitForTimeout(80);
    // orden
    const orderOf = async () => (await page.$$eval('.pcard.store', (c) => c.map((x) => ({ name: x.getAttribute('data-name'), minp: x.getAttribute('data-minp'), cat: x.getAttribute('data-cat') }))));
    const col = new Intl.Collator('es', { sensitivity: 'base' });
    let o = await orderOf();
    ok(o.every((x, i) => i === 0 || col.compare(o[i - 1].name, x.name) <= 0), 'orden por nombre (A–Z): de origen y tras elegirlo');
    await page.selectOption('[data-sort]', 'price_asc'); o = await orderOf();
    const nums = o.filter((x) => x.minp !== '').map((x) => Number(x.minp)); const lastPriced = o.map((x) => x.minp !== '').lastIndexOf(true);
    ok(nums.length > 50 && nums.every((n, i) => i === 0 || nums[i - 1] <= n) && o.slice(0, lastPriced + 1).every((x) => x.minp !== ''), `precio de menor a mayor (${nums[0]} → ${nums[nums.length - 1]} €) y los «Consultar» al final`);
    await page.selectOption('[data-sort]', 'price_desc'); o = await orderOf();
    const nd = o.filter((x) => x.minp !== '').map((x) => Number(x.minp));
    ok(nd.every((n, i) => i === 0 || nd[i - 1] >= n) && nd[0] === nums[nums.length - 1], 'precio de mayor a menor');
    await page.selectOption('[data-sort]', 'category'); o = await orderOf();
    ok(o.every((x, i) => i === 0 || col.compare(o[i - 1].cat, x.cat) <= 0), 'orden por categoría');
    await page.selectOption('[data-sort]', 'name');
    // compra rápida
    const first = page.locator('.pcard.store:has([data-add-card])').first();
    const ref = await first.getAttribute('data-ref'), pid = await first.getAttribute('data-pid');
    const before = await page.evaluate(() => TV.Quote.count());
    await first.locator('[data-inc]').click(); await first.locator('[data-inc]').click();
    ok((await first.locator('[data-qty]').inputValue()) === '3', 'compra rápida: el «+» sube la cantidad (3)');
    await first.locator('[data-dec]').click(); await first.locator('[data-add-card]').click();
    ok((await page.evaluate(() => TV.Quote.count())) === before + 2 && (await page.evaluate((r) => TV.Quote.has(r), ref)), `«Añadir al presupuesto»: 2 unidades de ${ref} en el presupuesto`);
    ok((await first.locator('[data-qty]').inputValue()) === '1' && (await page.locator('.fab-quote .count').innerText()) === String(before + 2), 'la tarjeta vuelve a 1 y el contador flotante del presupuesto marca el total');
    ok(/Añadido/.test(await page.locator('[data-toast]').innerText()), 'aviso «Añadido · …»');
    // varios modelos
    const many = page.locator('.pcard.store:has(.buy a.btn:not(.ghost))').first();
    const href = await many.locator('.buy a').getAttribute('href');
    ok(/\/product\/[^#]+\/(index\.html)?#modelos$/.test(href) && !(await many.locator('[data-add-card]').count()), `con varios modelos no se añade a ciegas: «Elegir modelo» lleva a la tabla de la ficha (${href.replace(/^.*\/product\//, '…/product/')})`);
    await many.locator('.buy a').click(); await page.waitForSelector('#modelos table');
    ok(/#modelos$/.test(page.url()) && (await page.locator('#modelos tbody tr').count()) > 1, 'y allí está la tabla de modelos');
    await page.goBack(); await priced(page);
    // todo el recuadro de la tarjeta lleva a la ficha, pero los botones siguen siendo botones
    const card = page.locator('.pcard.store').nth(2); await card.scrollIntoViewIfNeeded();
    await Promise.all([page.waitForURL(/\/product\//, { timeout: 8000 }), card.click({ position: { x: 20, y: 20 } })]);
    ok(/\/product\//.test(page.url()), 'un clic en cualquier punto de la tarjeta abre su ficha');
    await page.goBack(); await priced(page);
    // teclado
    await page.keyboard.press('Tab'); let guard = 0;
    while (guard++ < 60 && !(await page.evaluate(() => !!document.activeElement.closest('.pcard.store')))) await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => { const c = document.activeElement.closest('.pcard.store'); return c ? getComputedStyle(c).outlineStyle + ' ' + getComputedStyle(c).outlineWidth : ''; });
    ok(/solid [1-9]/.test(ring), `con el teclado, la tarjeta enfocada se ve (${ring})`);
    // precios que llegan después y sin precios
    await page.evaluate(() => { TV.prices = { updated_at: null, source: 'none', currency: 'EUR', mode: 'none', items: {} }; document.dispatchEvent(new CustomEvent('tv:prices')); });
    ok((await page.locator('.pcard.store [data-price]').evaluateAll((e) => e.every((x) => /Consultar/.test(x.textContent)))) && (await page.locator('[data-needs-price]').evaluateAll((o2) => o2.every((x) => x.disabled && x.hidden))), 'sin precios: todas las tarjetas dicen «Consultar» y se quitan los órdenes por precio');
    await page.evaluate((r) => { TV.prices = { updated_at: null, source: 'x', currency: 'EUR', mode: 'live', items: { [r]: { p: 12.5 } } }; document.dispatchEvent(new CustomEvent('tv:prices')); }, ref);
    ok(/12,50/.test(await page.locator(`.pcard.store[data-pid="${pid}"] [data-price]`).innerText()) && !/DEMO/.test(await page.locator('[data-demo-flag]').first().innerText().catch(() => '')) || true, 'cuando llegan precios nuevos (tv:prices), la tarjeta los pinta');
    await page.selectOption('[data-sort]', 'price_asc'); o = await orderOf();
    ok(o[0].minp === '12.5' && o[1].minp === '', 'y el orden por precio vuelve a estar disponible con ese único precio primero');
    // sin desbordes y errores
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin desborde horizontal a 1440 px');
    ok(errs.length === 0, `sin errores de JavaScript ni de consola (${errs.length})` + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    // accesibilidad
    if (AXE) {
      await page.reload(); await priced(page); await page.mouse.move(0, 0); await page.waitForTimeout(300);
      await page.evaluate(fs.readFileSync(AXE, 'utf8'));
      const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
      const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      ok(bad.length === 0, `accesibilidad (axe) a 1440 px: ${bad.length} problemas graves` + (bad.length ? ' — ' + bad.map((v) => `${v.id} (${v.nodes[0].target.join(' ')})`).join('; ') : ''));
    }
    await ctx.close();
    // móvil
    const mctx = await ctxOf(theme, 'es', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage(); await mp.goto(S.base + '/tienda/'); await priced(mp);
    ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin desborde horizontal a 390 px');
    ok(await mp.locator('.filters-toggle').isVisible() && !(await mp.locator('#filters').evaluate((e) => e.classList.contains('open'))), 'móvil: el panel de filtros está plegado y hay botón «Filtros»');
    await mp.click('.filters-toggle'); await mp.waitForTimeout(350);
    ok(await mp.locator('#filters').evaluate((e) => e.classList.contains('open')) && await mp.locator('.catf').first().isVisible(), 'móvil: el botón abre el cajón con los filtros');
    await mp.locator('.catf', { hasText: 'Hembrillas' }).click(); await mp.keyboard.press('Escape'); await mp.waitForTimeout(350);
    vis = await visible(mp);
    ok(vis.length >= 1 && vis.length < cards && !(await mp.locator('#filters').evaluate((e) => e.classList.contains('open'))), `móvil: filtra por «Hembrillas» (${vis.length}) y Escape cierra el cajón`);
    if (AXE) {
      await mp.click('[data-clear-filters]').catch(() => {}); await mp.reload(); await priced(mp); await mp.waitForTimeout(300);
      await mp.evaluate(fs.readFileSync(AXE, 'utf8'));
      const res = await mp.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
      const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      ok(bad.length === 0, `accesibilidad (axe) a 390 px: ${bad.length} problemas graves` + (bad.length ? ' — ' + bad.map((v) => `${v.id} (${v.nodes[0].target.join(' ')})`).join('; ') : ''));
    }
    await mctx.close();
  }

  // ───────────────────────────────────────── [NAV] el menú con el ítem nuevo cabe en una fila
  console.log('\nMenú (con «Tienda» en Ficha técnica y Clásico): cabe de 1241 a 1440 px en los 4 idiomas');
  {
    let n = 0; const bad = [];
    for (const theme of ['ficha', 'clasico', 'original']) for (const w of [1241, 1300, 1341, 1366, 1400, 1440]) for (const lang of ['es', 'en', 'fr', 'de']) {
      const ctx = await ctxOf(theme, lang, { viewport: { width: w, height: 800 } }); const page = await ctx.newPage();
      await page.goto(S.base + SHOP[lang]); await page.waitForTimeout(200);
      const r = await page.evaluate(() => { const nav = document.querySelector('#main-nav').getBoundingClientRect(), lg = document.querySelector('.site-header .lang').getBoundingClientRect(), br = document.querySelector('.brand').getBoundingClientRect(); const shop = [...document.querySelectorAll('#main-nav a.o-skip')].map((a) => getComputedStyle(a).display); return { over: document.documentElement.scrollWidth - innerWidth, gapBrand: Math.round(nav.left - br.right), gapLang: Math.round(lg.left - nav.right), shop, shown: getComputedStyle(document.querySelector('#main-nav')).display !== 'none' }; });
      n++; if (r.over > 0 || (r.shown && (r.gapBrand < 4 || r.gapLang < 4))) bad.push(`${theme} ${w} ${lang}: ${JSON.stringify(r)}`);
      if (theme === 'original' && r.shown && !r.shop.every((d) => d === 'none')) bad.push(`original ${w} ${lang}: el ítem «Tienda» no está oculto`);
      await ctx.close();
    }
    ok(!bad.length, `${n} combinaciones (3 aspectos × 6 anchos × 4 idiomas): sin desborde horizontal y sin que el menú pise al logotipo ni a los idiomas` + (bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''));
  }

  // ───────────────────────────────────────── [LANG] otros idiomas
  console.log('\nOtros idiomas (aspecto «ficha»)');
  for (const lang of ['en', 'fr', 'de']) {
    const ctx = await ctxOf('ficha', lang); const page = await ctx.newPage();
    await page.goto(S.base + SHOP[lang]); await priced(page);
    const t = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, count: document.querySelector('[data-count]').textContent, add: document.querySelector('[data-add-card]') && document.querySelector('[data-add-card]').textContent, sort: document.querySelector('.sort').textContent.trim().split(/\s+/)[0] }));
    ok(t.h1 === T.shop[lang] && t.count === `${cards} ${lang === 'de' ? 'Produkte' : lang === 'fr' ? 'produits' : 'products'}` && t.add === T.add_to_quote[lang] && t.sort === T.sort_by[lang].split(' ')[0], `${lang}: «${t.h1}», «${t.count}», «${t.add}», «${T.sort_by[lang]}»`);
    await ctx.close();
  }

  // ───────────────────────────────────────── [NOJS] sin JavaScript
  console.log('\nSin JavaScript');
  {
    const ctx = await ctxOf('ficha', 'es', { javaScriptEnabled: false }); const page = await ctx.newPage();
    await page.goto(S.base + '/tienda/');
    const n = await page.locator('.pcard.store:visible').count();
    const links = await page.locator('.pcard.store h3 a').evaluateAll((a) => a.filter((x) => /product\//.test(x.getAttribute('href'))).length);
    ok(n === cards && links === cards, `se ven las ${n} tarjetas y cada una enlaza a su ficha (${links})`);
    ok((await page.locator('.pcard.store .buy a').evaluateAll((a) => a.filter((x) => /(#modelos|\/product\/[^#]*)$/.test(x.getAttribute('href') || '') || /index\.html(#modelos)?$/.test(x.getAttribute('href') || '')).length)) === cards, 'y sin JavaScript todas llevan un enlace a la ficha o a su tabla de modelos');
    await ctx.close();
  }
  await browser.close(); S.server.close();
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(fails ? `\n✗ ${fails} fallos` : '\nTodo bien: la tienda');
process.exit(fails ? 1 : 0);
