#!/usr/bin/env node
// [QA-DRAWINGS] Dibujos técnicos de las fichas (data/catalog/drawings.json, de scripts/extract_drawings.py).
//   node scripts/qa-drawings.mjs            compila una demo en una carpeta temporal y lo comprueba todo
//   node scripts/qa-drawings.mjs --dist=DIR usa una compilación que ya existe
// 1) Los dibujos guardados son exactamente lo que sale de los PDF (`extract_drawings.py --check`: vínculo de confianza alta, dibujo entero, sin tablas, imágenes idénticas).
// 2) Cada ficha con dibujos los lleva en los 4 idiomas (sección #dibujos, una figura por dibujo, <img> con alt en su idioma, ancho y alto, archivo existente) y ninguna ficha sin dibujos lleva la sección.
// 3) En un navegador (3 aspectos × escritorio y móvil × español e inglés) los dibujos se cargan, son visibles y no desbordan la pantalla.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
import { applyTerminology } from '../site/lib/terminology.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'en', 'fr', 'de'];
let fails = 0;
/** Anota una comprobación: ✓ o ✗ con su descripción. */
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

console.log('1) Lo guardado es lo que sale de los PDF');
try { const o = execFileSync('python3', ['-I', path.join(ROOT, 'scripts/extract_drawings.py'), '--check'], { cwd: ROOT, stdio: 'pipe' }).toString().trim(); ok(true, o); }
catch (e) { ok(false, 'extract_drawings.py --check: ' + String(e.stdout || e.stderr).trim().split('\n').slice(0, 4).join(' | ')); }

const arg = process.argv.find((a) => a.startsWith('--dist='));
const DIST = arg ? path.resolve(arg.slice(7)) : fs.mkdtempSync(path.join(os.tmpdir(), 'tv-dwg-'));
if (!arg) execFileSync('node', [path.join(ROOT, 'site/build.mjs'), `--out=${DIST}`], { cwd: ROOT, env: { ...process.env, TORIVAC_API: '' }, stdio: 'pipe' });
const dw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/drawings.json'), 'utf8'));
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/products.json'), 'utf8'));
// Los nombres que muestra la web llevan las correcciones de terminología (data/catalog/terminology.curated.json), igual que en el build: el alt se compara con ese nombre, no con el del catálogo en bruto.
applyTerminology({ rules: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/terminology.curated.json'), 'utf8')).rules, products });
const byId = new Map(dw.items.map((d) => [d.id, d]));
/** Ruta de la ficha de un producto en un idioma (la misma regla que site/build.mjs: la de la web original o /<idioma>/product/<slug>/). */
const pathOf = (p, l) => p.path[l] || (l === 'es' ? `/product/${p.slug.es}/` : `/${l}/product/${p.slug.es}/`);
const ALT = { es: /^Dibujo técnico con cotas de /, en: /^Dimensioned technical drawing of /, fr: /^Dessin technique coté de /, de: /^Bemaßte technische Zeichnung von / };
/** Deshace las entidades HTML básicas (&quot; &amp; &lt; &gt; &#39;) del atributo alt para compararlo con el texto plano. */
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");

console.log('\n2) Cada ficha con dibujos los lleva en los 4 idiomas');
let withDw = 0, bad = [];
for (const p of products) {
  const ids = dw.by_product[String(p.id)] || [];
  if (ids.length) withDw++;
  for (const l of LANGS) {
    const f = path.join(DIST, pathOf(p, l).replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(f)) { bad.push(`${p.id} [${l}]: no existe ${pathOf(p, l)}`); continue; }
    const html = fs.readFileSync(f, 'utf8'), has = /id="dibujos"/.test(html);
    if (!ids.length) { if (has) bad.push(`${p.id} [${l}]: lleva #dibujos sin tener dibujos`); continue; }
    if (!has) { bad.push(`${p.id} [${l}]: falta la sección #dibujos`); continue; }
    const sec = html.slice(html.indexOf('id="dibujos"'), html.indexOf('</section>', html.indexOf('id="dibujos"')));
    const figs = (sec.match(/<figure class="dwg">/g) || []).length;
    if (figs !== ids.length) bad.push(`${p.id} [${l}]: ${figs} figuras, debería haber ${ids.length}`);
    const imgs = [...sec.matchAll(/<img src="([^"]+)" alt="([^"]*)" width="(\d+)" height="(\d+)" loading="lazy" decoding="async">/g)];
    if (imgs.length !== ids.length) { bad.push(`${p.id} [${l}]: ${imgs.length} <img> completos, debería haber ${ids.length}`); continue; }
    imgs.forEach((m, i) => {
      const d = byId.get(ids[i]), name = (p.name[l] || p.name.es), alt = unesc(m[2]);
      if (!ALT[l].test(alt) || !alt.includes(name)) bad.push(`${p.id} [${l}]: alt «${alt.slice(0, 70)}» no es «Dibujo técnico … ${name}» en ${l}`);
      if (d.caption && !alt.includes(d.caption)) bad.push(`${p.id} [${l}]: el alt no lleva el pie «${d.caption}»`);
      if (+m[3] !== d.w || +m[4] !== d.h) bad.push(`${p.id} [${l}]: tamaño ${m[3]}×${m[4]} ≠ ${d.w}×${d.h}`);
      if (!fs.existsSync(path.join(DIST, d.file))) bad.push(`${p.id} [${l}]: no existe ${d.file} en la compilación`);
      if (!m[1].endsWith(d.file)) bad.push(`${p.id} [${l}]: src ${m[1]} no apunta a ${d.file}`);
    });
  }
}
ok(!bad.length, `${withDw} fichas con dibujos × 4 idiomas: sección, figuras, alt en su idioma, tamaño y archivo${bad.length ? ' — ' + bad.slice(0, 4).join(' · ') : ''}`);
ok(withDw >= 20 && Object.keys(dw.by_product).every((k) => products.some((p) => String(p.id) === k)), `los ${Object.keys(dw.by_product).length} productos de drawings.json existen en el catálogo`);

console.log('\n3) En un navegador: se cargan, se ven y no desbordan');
const { server, base } = await serve(DIST);
const browser = await chromium.launch();
try {
  /** Rutas de la ficha del producto `id` en cada idioma, para abrirla en el navegador. */
  const pick = (id) => { const p = products.find((x) => x.id === id); return Object.fromEntries(LANGS.map((l) => [l, pathOf(p, l)])); };
  const PAGES = [['doble motorizado', pick(308)], ['hembrilla HB4', pick(954)], ['reóstato tándem doble', pick(911)], ['botón BO', pick(932)]];
  const errs = [];
  for (const [label, paths] of PAGES) {
    for (const theme of ['ficha', 'clasico', 'original']) {
      for (const [w, h] of [[1440, 900], [390, 844]]) {
        for (const l of ['es', 'en']) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
          await ctx.addInitScript(([lang, th]) => { try { localStorage.setItem('tv_lang', lang); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); localStorage.setItem('tv-theme', th); localStorage.setItem('tv-consent', JSON.stringify({ v: 2, c: 0, a: 0, p: 0, t: Date.now() })); } catch (e) { /* sin almacenamiento */ } }, [l, theme]);
          const pg = await ctx.newPage();
          const pe = []; pg.on('pageerror', (e) => pe.push(e.message));
          await pg.goto(`${base}${paths[l]}index.html?tema=${theme}`);
          await pg.waitForSelector('#dibujos', { state: 'attached' });
          await pg.evaluate(() => document.querySelectorAll('#dibujos img').forEach((i) => { i.loading = 'eager'; }));
          await pg.locator('#dibujos').scrollIntoViewIfNeeded();
          await pg.waitForFunction(() => [...document.querySelectorAll('#dibujos img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
          const r = await pg.evaluate(() => {
            const imgs = [...document.querySelectorAll('#dibujos img')], W = window.innerWidth;
            return { n: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, small: imgs.filter((i) => { const b = i.getBoundingClientRect(); return b.width < 120 || b.height < 40; }).length, over: document.documentElement.scrollWidth > W + 1, outside: imgs.filter((i) => i.getBoundingClientRect().right > W + 1).length, theme: document.documentElement.getAttribute('data-theme') };
          });
          if (r.theme !== theme) errs.push(`${label} [${l} ${theme} ${w}]: aspecto «${r.theme}»`);
          if (r.loaded !== r.n || !r.n) errs.push(`${label} [${l} ${theme} ${w}]: ${r.loaded}/${r.n} dibujos cargados`);
          if (r.small) errs.push(`${label} [${l} ${theme} ${w}]: ${r.small} dibujos demasiado pequeños`);
          if (r.over || r.outside) errs.push(`${label} [${l} ${theme} ${w}]: desborda la pantalla`);
          if (pe.length) errs.push(`${label} [${l} ${theme} ${w}]: error de JS ${pe[0]}`);
          await ctx.close();
        }
      }
    }
  }
  ok(!errs.length, `${PAGES.length} fichas × 3 aspectos × escritorio y móvil × es y en: dibujos cargados, visibles y sin desbordes${errs.length ? ' — ' + errs.slice(0, 4).join(' · ') : ''}`);
} finally { await browser.close(); server.close(); if (!arg) fs.rmSync(DIST, { recursive: true, force: true }); }

console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ dibujos técnicos: coinciden con los PDF, están en cada ficha y en los 4 idiomas y se ven bien en los tres aspectos');
process.exit(fails ? 1 : 0);
