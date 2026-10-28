#!/usr/bin/env node
// [QA-A11Y] Sesión 16 · Accesibilidad WCAG 2.1 AA con axe-core sobre una muestra estratificada (2 páginas por plantilla e idioma, escritorio y móvil).
//   node scripts/qa-a11y.mjs [--per=2] [--dir=dist]
// axe-core: `npm i -D axe-core` o AXE_PATH=/ruta/axe.min.js (la prueba lo busca en node_modules y en /tmp/axe-install).
// Falla con violaciones «serious» o «critical» (contraste, nombres accesibles, ARIA, formularios…). Las «moderate/minor» se listan como aviso.
// Además de la muestra de páginas, analiza los formularios de contacto y de presupuesto EN ESTADO DE ERROR (campos obligatorios vacíos, texto no válido, contador cerca del límite) en los cuatro idiomas.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Valor de la opción --k=valor de la línea de comandos, o d si no se indicó. */
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const DIST = path.resolve(ROOT, opt('dir', 'dist')), PER = Number(opt('per', 2));
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));
if (!AXE) { console.error('Falta axe-core: npm i -D axe-core (o AXE_PATH=…)'); process.exit(2); }
const axeSrc = fs.readFileSync(AXE, 'utf8');

// muestra: por idioma y plantilla (clase tv-<plantilla> del <body>), repartida por el listado
const byKey = new Map();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!(d === DIST && ['assets', 'admin'].includes(e.name))) walk(p); continue; }
    if (e.name !== 'index.html') continue;
    const head = fs.readFileSync(p, 'utf8').slice(0, 4000);
    if (/http-equiv="refresh"/i.test(head)) continue;
    const tpl = (head.match(/<body class="tv tv-([a-z]+)/) || [])[1]; if (!tpl) continue;
    const route = '/' + path.relative(DIST, path.dirname(p)).split(path.sep).join('/') + (path.dirname(p) === DIST ? '' : '/');
    const lang = (route.match(/^\/(en|fr|de)\//) || [, 'es'])[1];
    const k = `${lang}|${tpl}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(route);
  }
})(DIST);
const sample = [];
for (const [, routes] of byKey) { routes.sort(); const step = Math.max(1, Math.floor(routes.length / PER)); for (let i = 0; i < Math.min(PER, routes.length); i++) sample.push(routes[Math.min(routes.length - 1, i * step)]); }

const { server, base } = await serve(DIST);
const browser = await chromium.launch();
const found = new Map();   // regla|impacto → { help, nodes:[{url, vp, target, summary}] }
let runs = 0;
/** Analiza con axe la página que `page` tiene abierta y anota las violaciones bajo la etiqueta `label` (ruta o ruta + estado) en el tamaño `vpName`. */
async function scan(page, label, vpName) {
  await page.mouse.move(0, 0); await page.waitForTimeout(400);                    // el puntero fuera y las transiciones de color terminadas: si no, axe mide un color intermedio del botón recién pulsado
  await page.evaluate(axeSrc);
  const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }));
  runs++;
  for (const v of res.violations) {
    const k = `${v.id}|${v.impact}`; if (!found.has(k)) found.set(k, { id: v.id, impact: v.impact, help: v.help, nodes: [] });
    for (const n of v.nodes.slice(0, 3)) found.get(k).nodes.push({ url: label, vp: vpName, target: n.target.join(' ').slice(0, 90), summary: (n.failureSummary || '').split('\n')[1] || '' });
  }
}
for (const vp of [{ n: 'escritorio', w: 1440, h: 900 }, { n: 'móvil', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang_auto_done', '1'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang', document.documentElement.lang || 'es'); } catch (e) { /* ignorar */ } });
  const page = await ctx.newPage();
  for (const url of sample) {
    await page.goto(base + url, { waitUntil: 'load' }); await page.waitForTimeout(250);
    await scan(page, url, vp.n);
  }
  // formularios en estado de error: obligatorios vacíos, texto no válido y contador cerca del límite, en los cuatro idiomas
  for (const lang of ['es', 'en', 'fr', 'de']) {
    const contact = (byKey.get(`${lang}|contact`) || [])[0], quote = (byKey.get(`${lang}|quote`) || [])[0];
    if (contact) {
      await page.goto(base + contact, { waitUntil: 'load' }); await page.waitForTimeout(250);
      const f = page.locator('[data-contact-form]').first();
      await f.locator('button[type=submit]').click(); await f.locator('.err').first().waitFor({ timeout: 3000 });
      await scan(page, contact + ' (obligatorios sin rellenar)', vp.n);
      await f.locator('[name=name]').fill('Ana <b>Prueba</b>'); await f.locator('[name=email]').fill('ana@example.com'); await f.locator('[name=message]').fill('palabra '.repeat(118)); await f.locator('[name=privacy]').check();
      await f.locator('button[type=submit]').click(); await f.locator('.err').first().waitFor({ timeout: 3000 });
      await scan(page, contact + ' (texto no válido y contador cerca del límite)', vp.n);
    }
    if (quote) {
      await page.goto(base + quote, { waitUntil: 'load' }); await page.waitForTimeout(250);
      await page.evaluate(() => { const r = Object.keys(TV.items)[0]; TV.Quote.add(r, 3); });
      await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(250);
      const q = page.locator('[data-quote-form]');
      await q.locator('button[type=submit]').click(); await q.locator('.err').first().waitFor({ timeout: 3000 });
      await scan(page, quote + ' (obligatorios sin rellenar)', vp.n);
      await q.locator('[name=name]').fill('Ana'); await q.locator('[name=email]').fill('ana@example.com'); await q.locator('[name=privacy]').check(); await q.locator('[name=notes]').fill('Entrega <script>x</script>');
      await q.locator('button[type=submit]').click(); await q.locator('.err').first().waitFor({ timeout: 3000 });
      await scan(page, quote + ' (notas no válidas)', vp.n);
    }
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(`${sample.length} páginas + formularios con errores × 2 tamaños = ${runs} análisis axe (${path.basename(path.dirname(path.dirname(AXE)))})`);
let hard = 0;
for (const impact of ['critical', 'serious', 'moderate', 'minor']) {
  const rows = [...found.values()].filter((f) => f.impact === impact);
  console.log(`\n${impact.toUpperCase()}: ${rows.length} reglas`);
  for (const f of rows) {
    if (impact === 'critical' || impact === 'serious') hard++;
    const pages = new Set(f.nodes.map((n) => n.url));
    console.log(`  ✗ ${f.id} — ${f.help} (${pages.size} páginas)`);
    for (const n of f.nodes.slice(0, 3)) console.log(`      · ${n.url} [${n.vp}] ${n.target} ${n.summary ? '→ ' + n.summary.trim().slice(0, 100) : ''}`);
  }
}
console.log(hard ? `\n✗ ${hard} reglas serias/críticas incumplidas` : '\n✓ sin violaciones serias ni críticas (WCAG 2.1 AA)');
process.exit(hard ? 1 : 0);
