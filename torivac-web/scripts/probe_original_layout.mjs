#!/usr/bin/env node
// [PROBE-ORIGINAL-LAYOUT] Lee (solo GET, sin escribir nada en la web original) el ORDEN en que la web actual de grupotorivac.com enseña sus categorías,
// y lo guarda en data/catalog/original-layout.json para el aspecto «Original»:
//   shop   ids de las categorías de la portada de /productos/ en su orden
//   panel  ids de las categorías raíz del menú flotante «Productos-Torivac» en su orden
//   sub    { idCategoría: [ids de sus subcategorías en el orden de «Explora las subcategorías»] }
// Uso: node scripts/probe_original_layout.mjs   (≈ 15 peticiones, con pausa entre ellas)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/categories.json'), 'utf8'));
const UA = 'Mozilla/5.0 (compatible; TorivacMigration/1.0; read-only)';
const norm = (u) => { try { const p = new URL(u, 'https://grupotorivac.com').pathname; return p.endsWith('/') ? p : p + '/'; } catch { return ''; } };
const byPath = new Map(cats.map((c) => [norm(c.path.es), c]));
/** Descarga una página de la web original (GET) y devuelve su HTML. */
const get = async (p) => { const r = await fetch('https://grupotorivac.com' + p, { headers: { 'User-Agent': UA }, redirect: 'follow' }); await new Promise((x) => setTimeout(x, 900)); return r.text(); };
/** Ids de categoría, en orden y sin repetir, de los enlaces `href` que cumplen `re` dentro de `html`. */
const idsOf = (html, re) => { const out = []; for (const m of html.matchAll(re)) { const c = byPath.get(norm(m[1])); if (c && !out.includes(c.id)) out.push(c.id); } return out; };

const shopHtml = await get('/productos/');
const shop = idsOf(shopHtml.slice(shopHtml.indexOf('PRODUCTOS A MEDIDA')), /<a[^>]+href="([^"]*\/categoria-producto\/[^"]*)"[^>]*>/g);
const prodHtml = await get('/product/aros-con-flecha-2/');
const panelSeg = prodHtml.slice(prodHtml.indexOf('torivac-cat-list'), prodHtml.indexOf('torivac-cat-list') + 160000);
const panel = [];
for (const m of panelSeg.matchAll(/torivac-cat-item[^>]*>\s*<button[^>]*>\s*<span class="cat-name">\s*<a href="([^"]+)"/g)) { const c = byPath.get(norm(m[1])); if (c && !panel.includes(c.id)) panel.push(c.id); }
const sub = {};
const hasKids = new Set(cats.map((c) => c.parent).filter(Boolean));
for (const c of cats.filter((x) => hasKids.has(x.id) && norm(x.path.es).split('/').length <= 5)) {
  const html = await get(c.path.es);
  const seg = html.slice(html.indexOf('cat-section-title'));
  const ids = idsOf(seg, /<a class="subcat-card" href="([^"]+)"/g);
  if (ids.length) sub[c.id] = ids;
  console.log(c.id, c.name.es, '→', ids.join(','));
}
fs.writeFileSync(path.join(ROOT, 'data/catalog/original-layout.json'), JSON.stringify({ _doc: 'Orden de las categorías en la web actual de grupotorivac.com (scripts/probe_original_layout.mjs). Lo usa el aspecto «Original».', shop, panel, sub }, null, 1) + '\n');
console.log('shop', shop.join(','), '\npanel', panel.join(','));
