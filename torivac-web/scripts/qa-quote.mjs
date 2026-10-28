#!/usr/bin/env node
// [QA-QUOTE] Sesión 5 · Presupuesto realista de punta a punta en los 4 idiomas (Playwright, modo file://).
//   node scripts/qa-quote.mjs
// Escenario: transformador toroidal (serie TT), resistencias y botones de baquelita, con cantidades que cruzan tramos de precio
// (1, 3, 10, 55, 200 uds.) y precios con céntimos. Se comprueba, con un cálculo INDEPENDIENTE hecho aquí en Node:
//   · precio unitario por tramo y total por línea (redondeo a 2 decimales) y total general,
//   · lo que muestra la tabla de la página de presupuesto y lo que sale en el PDF (texto extraído con pdftotext),
//   · que el PDF incluye cada referencia/nombre y el total formateado en el idioma de la página.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { serve } from './lib/static-server.mjs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'qa-quote-'));

// ───────────────────────────────────────── [DATA] mismos datos que carga el navegador, leídos en Node
const sandbox = { window: {}, TV: undefined };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['catalog.js', 'prices.js']) vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data', f), 'utf8'), sandbox);
const { items, prices } = sandbox.TV;
/** Redondea un importe a 2 decimales (cálculo propio de la prueba, independiente del código de la web). */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Precio unitario esperado de ref para qty unidades (último tramo alcanzado, o el base); null si no tiene precio. */
function unitPrice(ref, qty) {
  const p = prices.items[ref]; if (!p) return null;
  let u = p.p; for (const [q, x] of p.t || []) if (qty >= q) u = x; return u;
}

// ───────────────────────────────────────── [SCENARIO] qué se pide (por nombre ES del producto; si no hay variantes, la línea genérica)
const WANT = [
  { re: /^Transformador Serie TT$/i, qtys: [1, 3, 10, 55] },
  { re: /^Resistencias de frenado$/i, qtys: [2, 50] },
  { re: /^Botones de mando serie BO \(brillante\)$/i, qtys: [200, 10] },
];
const byProduct = new Map();
for (const [ref, it] of Object.entries(items)) { const k = it.pid; if (!byProduct.has(k)) byProduct.set(k, { name: it.n.es, refs: [], path: it.p }); byProduct.get(k).refs.push(ref); }
const plan = [];
for (const w of WANT) {
  const prod = [...byProduct.values()].find((p) => w.re.test(p.name));
  if (!prod) { console.error('✗ no encuentro el producto', w.re); process.exit(1); }
  prod.refs.slice(0, w.qtys.length).forEach((ref, i) => plan.push({ ref, name: prod.name, qty: w.qtys[i], path: prod.path }));
}
const expected = plan.map((l) => { const u = unitPrice(l.ref, l.qty); return { ...l, unit: u, total: u == null ? null : round2(u * l.qty) }; });
const expTotal = round2(expected.reduce((s, l) => s + (l.total || 0), 0));
console.log(`Escenario: ${expected.length} líneas · total esperado ${expTotal} (sin IVA)`);
expected.forEach((l) => console.log(`  ${l.ref}\t${l.name}\t×${l.qty}\t${l.unit}\t${l.total}`));

// Por defecto se prueba por http (como en producción). Con --file se usa file:// (doble clic): el Chromium de pruebas pierde a veces
// localStorage entre ficheros file:// (no ocurre por http; sí ocurre en una página de 2 líneas) → ahí la prueba puede fallar sin que sea un fallo de la web.
const useFile = process.argv.includes('--file');
const served = useFile ? null : await serve(DIST);
const server = served && served.server, BASE = served && served.base;
const browser = await chromium.launch();
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };
/** Texto con los espacios duros (U+00A0, U+202F) pasados a espacio normal y los repetidos colapsados, para comparar importes. */
const norm = (s) => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

for (const lang of ['es', 'en', 'fr', 'de']) {
  console.log(`\n── ${lang.toUpperCase()}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: lang === 'es' ? 'es-ES' : lang });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  /** URL de la ruta p: por http si hay servidor de pruebas (BASE) o file:// sobre dist/ con --file. */
  const file = (p) => BASE ? BASE + (p.startsWith('/') ? p : '/' + p) : 'file://' + path.join(DIST, p.replace(/^\//, ''), p.endsWith('/') ? 'index.html' : '');
  // un idioma elegido a mano no se pisa: así la prueba no depende de la detección automática (cada idioma usa un contexto nuevo = almacenamiento vacío)
  await page.addInitScript(([l]) => { try { localStorage.setItem('tv_lang', l); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang_auto_done', '1'); } catch (e) { /* ignorar */ } }, [lang]);

  // 1) añadir desde la ficha de cada producto, como lo haría una persona (cantidades en la tabla de modelos)
  const groups = [...new Set(expected.map((l) => l.path))];
  for (const logical of groups) {
    const rel = items[expected.find((l) => l.path === logical).ref].p[lang] || items[expected.find((l) => l.path === logical).ref].p.es;
    const lines = expected.filter((l) => l.path === logical);
    await page.goto(file(rel));
    for (const l of lines) {
      const row = page.locator(`.models tbody tr[data-ref="${l.ref}"]`);
      if (!(await row.count())) { ok(false, `fila ${l.ref} en ${rel}`); continue; }
      await row.locator('[data-qty]').fill(String(l.qty));
    }
    await page.locator('[data-add-selected]').click();
    await page.waitForFunction((n) => TV.Quote.kinds() >= n, 0);                       // la línea ya está en el presupuesto
    await page.waitForTimeout(250);                                                    // deja que el navegador persista localStorage antes de navegar
  }

  // 2) página de presupuesto
  const quoteRel = lang === 'es' ? '/presupuesto/' : { en: '/en/quote/', fr: '/fr/devis/', de: '/de/angebot/' }[lang];
  await page.goto(file(quoteRel));
  const got = await page.evaluate(() => { const d = TV.Quote.detail(); return { lines: d.lines.map((l) => ({ ref: l.ref, qty: l.qty, unit: l.unit, total: l.total })), total: d.total, money: TV.Quote.money(d.total) }; });
  ok(got.lines.length === expected.length, `${got.lines.length}/${expected.length} líneas en el presupuesto`);
  for (const e of expected) {
    const g = got.lines.find((x) => x.ref === e.ref);
    ok(g && g.qty === e.qty && g.unit === e.unit && g.total === e.total, `${e.ref} ×${e.qty}: unitario ${g && g.unit} / total ${g && g.total} (esperado ${e.unit} / ${e.total})`);
  }
  ok(got.total === expTotal, `total ${got.total} = ${expTotal}`);
  const shown = norm(await page.locator('.qtotal strong').innerText());
  ok(shown === norm(got.money), `la página muestra «${shown}»`);

  // 3) PDF: se descarga, se lee y contiene lo mismo
  await page.locator('[data-quote-form] [name="name"]').fill('Cliente de Prueba');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download-pdf]').click()]);
  const pdf = path.join(TMP, `${lang}.pdf`); await dl.saveAs(pdf);
  const txt = norm(execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }));
  ok(txt.length > 200, `PDF con texto (${txt.length} caracteres)`);
  for (const e of expected) { const nm = (items[e.ref].n[lang] || e.name).slice(0, 14).toLowerCase(); ok(txt.toLowerCase().includes(nm), `PDF contiene «${nm}»`); }
  ok(txt.includes(norm(got.money)), `PDF contiene el total «${norm(got.money)}»` + (txt.includes(norm(got.money)) ? '' : ` — en el PDF: «${(txt.match(/Total[^\n]{0,40}/i) || ['(sin línea Total)'])[0]}» ${JSON.stringify((txt.match(/9\S{0,3}907[^\n]{0,12}/) || [''])[0])}`));
  ok(!errs.length, 'sin errores de consola' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
await browser.close();
if (server) server.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ presupuesto realista correcto en es/en/fr/de');
process.exit(fails ? 1 : 0);
