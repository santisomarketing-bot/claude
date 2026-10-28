#!/usr/bin/env node
// [QA-THEME] Aspectos de la web (Ficha técnica / Clásico / Original): compilaciones y banderas, hoja por capas, selector y persistencia, fuentes, sin JS, sin desbordes y reglas de diseño.
//   node scripts/qa-theme.mjs
// Compila 5 variantes en una carpeta temporal (no toca dist/) y las prueba por http:
//   demo     node site/build.mjs                                  → Ficha técnica por defecto + selector (cinta y pie) con los tres aspectos
//   prod     --base=…                                             → Ficha técnica, sin selector, CSS en capas
//   clasico  --base=… --theme=clasico                             → solo el aspecto «Clásico»: hoja sin capas y sin las fuentes nuevas
//   original --base=… --theme=original                            → solo «Original» (la web actual de grupotorivac.com): hoja de dos capas, sin las fuentes de Ficha técnica
//   conmut   --base=… --theme-switch                              → producción con selector
// Lo que se comprueba, y por qué: docs/DISENO-TEMAS.md (§ «Cómo se prueba»).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-theme-'));
const BASE = 'https://demo.torivac.example';
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Compila una variante del sitio en TMP/<name> con las opciones `args` y devuelve su carpeta. */
const build = (name, args) => { const dir = path.join(TMP, name); execFileSync('node', [path.join(ROOT, 'site/build.mjs'), ...args, `--out=${dir}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return dir; };
/** Texto del archivo `f` (ruta relativa) de la variante `dir`. */
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
/** Lista las reglas de estilo de un CSS (sin comentarios) como [{ selector, body, media }]; entra en los @media y salta @keyframes/@font-face. */
function rulesOf(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  /** Recorre src[i..] hasta cerrar el bloque actual; `media` es el @media que lo envuelve (o ''). */
  const walk = (i, media) => {
    let start = i;
    while (i < src.length) {
      const c = src[i];
      if (c === '{') {
        const head = src.slice(start, i).trim(); let depth = 1, j = i + 1;
        while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
        const inner = src.slice(i + 1, j - 1);
        if (/^@media/.test(head)) { const sub = rulesOf(inner); for (const r of sub) out.push({ ...r, media: head }); } else if (!/^@/.test(head)) out.push({ selector: head, body: inner, media });
        i = j; start = i; continue;
      }
      if (c === '}') return i;
      i++;
    }
    return i;
  };
  walk(0, '');
  return out;
}
/** Divide una lista de selectores por las comas de primer nivel (sin romper los paréntesis de :is(), :not()…). */
const splitSelectors = (list) => { const parts = []; let depth = 0, cur = ''; for (const ch of list) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { parts.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) parts.push(cur.trim()); return parts; };

try {
  // ───────────────────────────────────────── [DESIGN] reglas de diseño de las fuentes CSS
  console.log('\nReglas de diseño (fuentes CSS)');
  const fichaCss = fs.readFileSync(path.join(ROOT, 'site/assets/css/ficha.css'), 'utf8');
  const tokensCss = fs.readFileSync(path.join(ROOT, 'site/assets/css/ficha-tokens.css'), 'utf8');
  const fRules = rulesOf(fichaCss);
  ok(fRules.length > 150, `ficha.css se lee entero (${fRules.length} reglas)`);
  const loose = fRules.flatMap((r) => splitSelectors(r.selector)).filter((s) => !s.startsWith('[data-theme="ficha"]'));
  ok(!loose.length, 'todo selector de ficha.css empieza por [data-theme="ficha"] (si no, la regla se colaría en «Clásico»)' + (loose.length ? ': ' + loose.slice(0, 3).join(' | ') : ''));
  ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(fichaCss.replace(/\/\*[\s\S]*?\*\//g, '')), 'ficha.css no lleva colores sueltos: todo sale de ficha-tokens.css (var(--…))');
  ok(!/!important/.test(fichaCss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/background-image:none!important/g, '')), 'ficha.css solo usa !important para anular el fondo en línea de la portada y de las cabeceras');
  const tRules = rulesOf(tokensCss);
  ok(tRules.length === 1 && tRules[0].selector === '[data-theme="ficha"]' && !/[^-\w]color\s*:/.test(tRules[0].body.replace(/--[\w-]+\s*:/g, '')), 'ficha-tokens.css solo define variables dentro de [data-theme="ficha"]');
  for (const k of ['--ink', '--bg', '--paper', '--copper', '--font-display', '--font-mono', '--radius']) ok(new RegExp(`${k}\\s*:`).test(tokensCss), `ficha-tokens.css redefine ${k}`);

  const origCss = fs.readFileSync(path.join(ROOT, 'site/assets/css/original.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const origTok = fs.readFileSync(path.join(ROOT, 'site/assets/css/original-tokens.css'), 'utf8');
  const oRules = rulesOf(origCss);
  ok(oRules.length > 400, `original.css se lee entero (${oRules.length} reglas)`);
  const looseO = oRules.flatMap((r) => splitSelectors(r.selector)).filter((s) => !s.startsWith('[data-theme="original"]'));
  ok(!looseO.length, 'todo selector de original.css empieza por [data-theme="original"] (si no, la regla se colaría en los otros aspectos)' + (looseO.length ? ': ' + looseO.slice(0, 3).join(' | ') : ''));
  const imp = origCss.match(/[a-z-]+:[^;{}]*!important/g) || [];
  ok(imp.length <= 9 && imp.every((d) => /^(background:none|display:none|margin(-bottom)?:[^;!]*|padding:40px)!important$/.test(d)), `original.css solo usa !important para ocultar lo que no es del aspecto, anular el fondo en línea de las entradas y los márgenes que fijan las plantillas (${imp.length})`);
  const oTok = rulesOf(origTok);
  ok(oTok.length === 1 && oTok[0].selector === '[data-theme="original"]' && !/[^-\w]color\s*:/.test(oTok[0].body.replace(/--[\w-]+\s*:/g, '')), 'original-tokens.css solo define variables dentro de [data-theme="original"]');
  for (const k of ['--o-black', '--o-bg', '--o-brand', '--o-accent', '--o-font-title', '--o-font-body', '--font-display', '--radius']) ok(new RegExp(`${k}\\s*:`).test(origTok), `original-tokens.css define ${k}`);

  // ───────────────────────────────────────── [BUILD] compilaciones y banderas
  console.log('\nCompilaciones y banderas');
  const demo = build('demo', []), prod = build('prod', [`--base=${BASE}`]), clasico = build('clasico', [`--base=${BASE}`, '--theme=clasico']), orig = build('original', [`--base=${BASE}`, '--theme=original']), conmut = build('conmut', [`--base=${BASE}`, '--theme-switch']);
  let bad = 0; try { build('malo', ['--theme=otro']); } catch (e) { bad = e.status; }
  ok(bad === 2, `un aspecto desconocido se rechaza con código 2 (${bad})`);
  const hd = read(demo, 'index.html'), cd = read(demo, 'assets/css/site.css');
  ok(/<html [^>]*data-theme="ficha"/.test(hd), 'demo: el aspecto por defecto es ficha');
  ok(hd.includes('tema=(ficha|clasico|original)'), 'demo: la cabecera aplica ?tema= y la elección guardada antes de pintar (los tres aspectos)');
  ok((hd.match(/data-theme-switch="(ribbon|footer)"[^>]*hidden/g) || []).length === 2 && (hd.match(/data-set-theme="(ficha|clasico|original)"/g) || []).length === 6, 'demo: selector en la cinta y en el pie con los tres aspectos, ocultos hasta que carga el JS');
  ok(hd.includes('assets/css/site.css') && !/assets\/css\/(tokens|base|layout|components|art)\.css/.test(hd), 'demo: una sola hoja, site.css');
  ok(cd.includes('@layer classic,ficha,original;') && cd.includes('Archivo Expanded') && cd.includes('Chivo Mono') && cd.includes('PT Sans') && cd.includes('data:font/woff2'), 'demo: site.css lleva las tres capas y las fuentes en base64 (file://)');
  ok(['ficha.css', 'ficha-tokens.css', 'fonts-ficha.css', 'fonts-ficha-files.css', 'original.css', 'original-tokens.css', 'fonts-original.css', 'fonts-original-files.css'].every((f) => !fs.existsSync(path.join(demo, 'assets/css', f))), 'demo: los CSS de los aspectos no sobran sueltos en dist (viven dentro de site.css)');
  const hp = read(prod, 'index.html'), cp = read(prod, 'assets/css/site.css');
  ok(/data-theme="ficha"/.test(hp) && !hp.includes('tema=(') && !hp.includes('data-theme-switch'), 'prod: ficha, sin selector ni script de elección');
  ok(cp.includes('@layer classic,ficha;') && !cp.includes('data:font/woff2') && cp.includes('archivo-expanded-latin-wght-normal.woff2') && cp.includes('chivo-mono-latin-wght-normal.woff2'), 'prod: capas y fuentes como archivos woff2 (no base64)');
  ok(['archivo-latin-wght-normal', 'archivo-expanded-latin-wght-normal', 'chivo-mono-latin-wght-normal'].every((f) => new RegExp(`rel="preload"[^>]*${f}\\.woff2`).test(hp)), 'prod: precarga las 3 fuentes de la primera pantalla de ficha');
  ok(/rel="preload"[^>]*as="image"[^>]*fetchpriority="high"/.test(hp), 'prod: precarga la foto de la portada con prioridad alta');
  ok(['archivo-expanded-latin-wght-normal.woff2', 'chivo-mono-latin-wght-normal.woff2'].every((f) => fs.existsSync(path.join(prod, 'assets/fonts', f))), 'prod: las fuentes nuevas viajan en el paquete');
  const hc = read(clasico, 'index.html'), cc = read(clasico, 'assets/css/site.css');
  ok(/data-theme="clasico"/.test(hc) && !hc.includes('data-theme-switch'), 'clasico: aspecto clásico y sin selector');
  ok(!cc.includes('@layer') && !cc.includes('Archivo Expanded') && !cc.includes('[data-theme="ficha"]') && !cc.includes('[data-theme=ficha]'), 'clasico: la hoja es la de siempre (sin capas, sin fuentes ni reglas del aspecto nuevo)');
  ok(/rel="preload"[^>]*advent-pro-latin-wght-normal\.woff2/.test(hc) && !/archivo-expanded/.test(hc), 'clasico: precarga Archivo + Advent Pro, no las fuentes nuevas');
  ok(cc.length < cp.length * 0.7, `clasico: hoja más ligera (${(cc.length / 1024).toFixed(0)} KB frente a ${(cp.length / 1024).toFixed(0)} KB)`);
  const ho = read(orig, 'index.html'), co = read(orig, 'assets/css/site.css');
  ok(/data-theme="original"/.test(ho) && !ho.includes('data-theme-switch') && !ho.includes('tema=('), 'original: aspecto «Original» y sin selector');
  ok(co.includes('@layer classic,original;') && !co.includes('Archivo Expanded') && !co.includes('Chivo Mono') && !co.includes('[data-theme="ficha"]') && co.includes('PT Sans') && !co.includes('data:font/woff2'), 'original: hoja de dos capas, con PT Sans y sin las fuentes ni las reglas de Ficha técnica');
  ok(['archivo-latin-wght-normal', 'advent-pro-latin-wght-normal', 'pt-sans-latin-700-normal'].every((f) => new RegExp(`rel="preload"[^>]*${f}\\.woff2`).test(ho)) && !/archivo-expanded|chivo-mono/.test(ho), 'original: precarga Archivo, Advent Pro y PT Sans, no las fuentes de Ficha técnica');
  ok(!/class="[^"]*\b(o-only|l-n|l-o|o-skip|o-not)\b/.test(ho) && !ho.includes('class="hero-fig"') && !ho.includes('class="wave"'), 'original: el HTML sale limpio, sin los elementos de otros aspectos ni duplicados ocultos');
  ok(['pt-sans-latin-700-normal.woff2', 'advent-pro-latin-wght-normal.woff2'].every((f) => fs.existsSync(path.join(orig, 'assets/fonts', f))) && fs.existsSync(path.join(orig, 'assets/img/original')), 'original: las fuentes y las fotos propias del aspecto viajan en el paquete');
  ok(!fs.existsSync(path.join(prod, 'assets/img/original')) && !fs.existsSync(path.join(clasico, 'assets/img/original')), 'prod y clásico: las fotos del aspecto «Original» no viajan sin él');
  const hs = read(conmut, 'index.html');
  ok(hs.includes('tema=(ficha|clasico|original)') && hs.includes('data-theme-switch="footer"') && read(conmut, 'assets/css/site.css').includes('@layer classic,ficha,original;'), 'conmut: producción con selector (en el pie) y las tres hojas');

  // ───────────────────────────────────────── [BROWSER] selector, persistencia, fuentes, sin JS, desbordes
  const browser = await chromium.launch();
  const S = await serve(demo);
  /** Contexto de navegador con idioma ya elegido (sin avisos ni redirecciones) y las opciones `o`; `init` se ejecuta en cada página antes que nada. */
  const ctxOf = async (o = {}, init = null) => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...o }); await c.addInitScript(() => { try { localStorage.setItem('tv_lang_auto_done', '1'); localStorage.setItem('tv_lang', 'es'); localStorage.setItem('tv_lang_src', 'manual'); } catch (e) { /* ignorar */ } }); if (init) await c.addInitScript(init); return c; };
  /** Estado visible del aspecto en la página: atributo, almacenamiento, fuente y esquina de los botones, y qué botón del selector está pulsado. */
  const state = (page) => page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), stored: (() => { try { return localStorage.getItem('tv-theme'); } catch (e) { return 'ERR'; } })(), h1: getComputedStyle(document.querySelector('h1')).fontFamily, radius: getComputedStyle(document.querySelector('.btn')).borderRadius, pressed: [...document.querySelectorAll('[data-theme-switch] [aria-pressed="true"]')].map((b) => b.getAttribute('data-set-theme')).join(',') }));
  console.log('\nSelector de aspecto y persistencia (demo por http)');
  {
    const ctx = await ctxOf(); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(S.base + '/'); await page.waitForTimeout(400);
    let st = await state(page);
    ok(st.theme === 'ficha' && st.stored === null && /Archivo Expanded/.test(st.h1) && st.radius === '0px', `por defecto: ficha, titular en Archivo Expanded y esquinas rectas (${st.h1.split(',')[0]}, ${st.radius})`);
    ok(st.pressed === 'ficha,ficha', `los dos selectores marcan «Ficha técnica» (${st.pressed})`);
    ok(await page.locator('[data-theme-switch]').first().isVisible(), 'el selector es visible cuando carga el JS');
    const loaded = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')); });
    ok(loaded.includes('Archivo Expanded') && loaded.includes('Chivo Mono') && loaded.includes('Archivo'), `fuentes cargadas en ficha: ${[...new Set(loaded)].join(', ')}`);
    await page.click('[data-theme-switch="ribbon"] [data-set-theme="clasico"]'); await page.waitForTimeout(350);
    st = await state(page);
    ok(st.theme === 'clasico' && st.stored === 'clasico' && /Advent Pro/.test(st.h1) && st.radius === '3px', `clic en «Clásico»: atributo, almacenamiento, Advent Pro y esquinas de 3 px (${st.h1.split(',')[0]}, ${st.radius})`);
    ok(st.pressed === 'clasico,clasico', 'el selector del pie sigue al de la cinta');
    ok(await page.locator('.hero-fig').evaluate((e) => getComputedStyle(e).display) === 'none', 'en Clásico no se muestra la foto en recuadro de la portada');
    await page.goto(S.base + '/contacto/'); await page.waitForTimeout(300);
    ok((await state(page)).theme === 'clasico', 'otra página conserva la elección');
    await page.goto(S.base + '/?tema=ficha'); await page.waitForTimeout(300);
    st = await state(page); ok(st.theme === 'ficha' && st.stored === 'ficha', '?tema=ficha cambia el aspecto y lo recuerda');
    await page.goto(S.base + '/?tema=otro'); await page.waitForTimeout(300);
    ok((await state(page)).theme === 'ficha', '?tema con un valor desconocido se ignora');
    await page.focus('[data-theme-switch="footer"] [data-set-theme="clasico"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    ok((await state(page)).theme === 'clasico', 'el selector funciona con el teclado (Enter)');
    await page.click('[data-theme-switch="ribbon"] [data-set-theme="original"]'); await page.waitForTimeout(450);
    st = await state(page);
    const og = await page.evaluate(async () => { await document.fonts.ready; return { hero: getComputedStyle(document.querySelector('.hero')).minHeight, hdr: getComputedStyle(document.querySelector('.site-header')).backgroundColor, h1w: getComputedStyle(document.querySelector('.hero h1')).fontWeight, fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')), body: getComputedStyle(document.body).backgroundColor, quoteBtn: getComputedStyle(document.querySelector('.header-quote')).display }; });
    ok(st.theme === 'original' && st.stored === 'original' && /Advent Pro/.test(st.h1) && st.radius === '3px' && st.pressed === 'original,original', `clic en «Original»: atributo, almacenamiento, Advent Pro y selectores (${st.h1.split(',')[0]}, ${st.radius}, ${st.pressed})`);
    ok(og.hero === '594px' && og.hdr === 'rgb(20, 20, 20)' && og.body === 'rgb(244, 244, 244)' && og.h1w === '400', `«Original»: portada de 594 px, cabecera #141414, fondo #f4f4f4 y titular fino (${og.hero}, ${og.hdr}, ${og.body}, ${og.h1w})`);
    ok(og.fonts.includes('PT Sans') && og.fonts.includes('Advent Pro'), `«Original»: carga PT Sans y Advent Pro (${[...new Set(og.fonts)].join(', ')})`);
    ok(await page.locator('.hero-fig').evaluate((e) => getComputedStyle(e).display) === 'none' && await page.locator('.hero .btn.ghost').count() > 0 && await page.locator('.hero .btn.ghost').first().evaluate((e) => getComputedStyle(e).display) === 'none', '«Original»: sin la foto en recuadro ni el segundo botón de la portada (el presupuesto va en el botón flotante)');
    await page.goto(S.base + '/?tema=original'); await page.waitForTimeout(300);
    st = await state(page); ok(st.theme === 'original' && st.stored === 'original', '?tema=original cambia el aspecto y lo recuerda');
    await page.goto(S.base + '/product/transformadores-serie-tt/'); await page.waitForTimeout(500);
    const pr = await page.evaluate(() => ({ chips: document.querySelectorAll('.vtag').length, add: [...document.querySelectorAll('.btn')].some((b) => /presupuesto|quote/i.test(b.textContent) && getComputedStyle(b).display !== 'none'), gal: getComputedStyle(document.querySelector('.gallery')).borderTopWidth }));
    ok(pr.chips > 0 && pr.add, `«Original»: la ficha conserva las etiquetas de voltaje y el botón de presupuesto (${pr.chips} etiquetas)`);
    await page.goto(S.base + '/?tema=ficha'); await page.waitForTimeout(250);
    ok(!errs.length, 'sin errores de JS' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }
  {
    const ctx = await ctxOf({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } }); });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(S.base + '/'); await page.waitForTimeout(400);
    ok((await state(page)).theme === 'ficha', 'sin almacenamiento (modo privado): la web carga con el aspecto por defecto');
    await page.click('[data-theme-switch="footer"] [data-set-theme="clasico"]'); await page.waitForTimeout(200);
    ok((await state(page)).theme === 'clasico' && !errs.length, 'sin almacenamiento el selector cambia el aspecto de la página sin errores' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }
  {
    const ctx = await ctxOf({ javaScriptEnabled: false }); const page = await ctx.newPage();
    await page.goto(S.base + '/'); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), h1: getComputedStyle(document.querySelector('h1')).fontFamily, sw: [...document.querySelectorAll('[data-theme-switch]')].every((e) => getComputedStyle(e).display === 'none') }));
    ok(r.theme === 'ficha' && /Archivo Expanded/.test(r.h1) && r.sw, 'sin JavaScript: se ve la Ficha técnica y no hay botones inútiles');
    await ctx.close();
  }
  console.log('\nLa foto de la portada se descarga una sola vez, en cualquiera de los tres aspectos');
  for (const t of ['clasico', 'ficha', 'original']) {
    const ctx = await ctxOf({}, `try{localStorage.setItem('tv-theme','${t}')}catch(e){}`); const page = await ctx.newPage(); const urls = [];
    page.on('request', (r) => { if (/\.webp/.test(r.url())) urls.push(r.url()); });
    await page.goto(S.base + '/'); await page.waitForTimeout(900);
    const bg = await page.evaluate(() => { const m = /url\(["']?([^"')]+)/.exec(document.querySelector('.hero').getAttribute('style') || ''); return m ? m[1].split('/').pop() : ''; });
    const n = urls.filter((u) => u.endsWith(bg)).length;
    ok(bg && n === 1, `${t}: ${bg.slice(0, 30)} se pide ${n} vez`);
    await ctx.close();
  }
  console.log('\nSin desbordes ni textos fuera de la pantalla, en los tres aspectos');
  const PAGES = ['/', '/productos/', '/categoria-producto/transformadores/', '/product/transformadores-serie-tt/', '/presupuesto/', '/contacto/', '/torivac-empresa/', '/proyectos-empresariales/', '/blog/', '/aviso-legal-2/', '/en/', '/fr/', '/de/', '/de/product/transformadores-serie-tt/'];
  for (const t of ['ficha', 'clasico', 'original']) for (const w of [390, 768, 1024, 1240, 1440]) {
    const ctx = await ctxOf({ viewport: { width: w, height: 800 } }, `try{localStorage.setItem('tv-theme','${t}')}catch(e){}`); const page = await ctx.newPage(); const wide = [];
    for (const u of PAGES) {
      await page.goto(S.base + u); await page.waitForTimeout(120);
      const r = await page.evaluate(() => { const iw = innerWidth; const over = [...document.querySelectorAll('h1,h2,h3,.btn,.nav,.hero,.tile,.pcard')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > iw + 1 || b.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.sidebar,.quote-drawer,.carousel,.tbl-wrap,.torivac-floating-sidebar'); }).slice(0, 2).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]); return { sw: document.documentElement.scrollWidth, iw, over }; });
      if (r.sw > r.iw + 1 || r.over.length) wide.push(`${u} (${r.sw}/${r.iw} ${r.over.join(',')})`);
    }
    ok(!wide.length, `${t} a ${w} px: ${PAGES.length} páginas sin desborde horizontal` + (wide.length ? ' → ' + wide.slice(0, 3).join(' · ') : ''));
    await ctx.close();
  }
  S.server.close();
  console.log('\nProducción (hojas y fuentes reales por http)');
  for (const [name, dir, expectFont, expectNo] of [['prod (ficha)', prod, 'Archivo Expanded', 'Advent Pro'], ['clasico', clasico, 'Advent Pro', 'Archivo Expanded'], ['original', orig, 'Advent Pro', 'Archivo Expanded']]) {
    const srv = await serve(dir, { gzip: true }); const ctx = await ctxOf(); const page = await ctx.newPage(); const woff = [], errs = [];
    page.on('response', (r) => { if (/\.woff2/.test(r.url())) woff.push(`${r.status()} ${r.url().split('/').pop()}`); });
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(srv.base + '/'); await page.waitForTimeout(700);
    const h1 = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily);
    const loaded = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')); });
    ok(h1.includes(expectFont) && loaded.includes(expectFont) && !loaded.includes(expectNo), `${name}: el titular usa ${expectFont} y carga sus archivos woff2 (${woff.join(', ')})`);
    ok(woff.length && woff.every((w) => w.startsWith('200')), `${name}: todas las fuentes responden 200`);
    ok(!errs.length, `${name}: sin errores de consola` + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close(); srv.server.close();
  }
  await browser.close();
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ aspectos correctos');
process.exit(fails ? 1 : 0);
