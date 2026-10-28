#!/usr/bin/env node
// [BUILD] Generador del sitio estático Torivac (demo).  Uso:  node site/build.mjs [--base=https://dominio] [--out=carpeta]
// Lee data/catalog/*.json (fuente única de verdad) y escribe dist/ (HTML por idioma + assets + datos para JS).
// Secciones: [LOAD] [CATS] [PRODUCTS] [SITE] [EMIT] [DATA] [ASSETS]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ctx, writeFile, esc, attr, mapLink, plain } from './lib/render.mjs';
import { LANGS, T, t } from './lib/i18n.mjs';
import * as TPL from './templates.mjs';
import { productNode, itemListNode, postNode } from './lib/seo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'data', 'catalog');
const arg0 = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const DIST = arg0('out') ? path.resolve(arg0('out')) : path.join(ROOT, 'dist');            // --out=carpeta (p. ej. para auditar SEO con --base sin tocar dist/)
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const ABS = arg('base') || '';
const jl = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8')); } catch { return d; } };

// ───────────────────────────────────────────────────────────── [LOAD]
const meta = jl('meta.json', {});
const rawCats = jl('categories.json', []);
const rawProducts = jl('products.json', []);
const pages = jl('pages.json', {});
const vtagList = jl('voltage-tags.json', []);
const prices = jl('prices.json', { updated_at: null, source: 'none', currency: 'EUR', mode: 'demo', items: {} });
const thumbs = jl('thumbs.json', {});
const imageMap = jl('image-map.json', {});
const proposals = jl('proposals.json', []);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// ───────────────────────────────────────────────────────────── [CATS] limpieza del árbol (duplicados → fusionados) y rutas
const normName = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.replace(/s$/, '')).join(' ');
const byId = new Map(rawCats.map((c) => [c.id, { ...c, children: [], direct: new Set() }]));
for (const p of rawProducts) for (const cid of p.category_ids) byId.get(cid)?.direct.add(p.id);
const depthOf = (c) => { let d = 0, x = c; while (x && x.parent) { d++; x = byId.get(x.parent); } return d; };
const canonical = new Map();
const canon = (id) => { while (canonical.has(id)) id = canonical.get(id); return id; };
const groups = new Map();
for (const c of [...byId.values()].sort((a, b) => depthOf(a) - depthOf(b) || a.id - b.id)) {
  const key = `${canon(c.parent)}|${normName(c.name.es)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
  if (groups.get(key).length > 1) {
    const m = groups.get(key);
    const keep = m.slice().sort((a, b) => b.direct.size - a.direct.size || a.id - b.id)[0];
    for (const o of m) if (o !== keep) canonical.set(o.id, keep.id);
    for (const o of m) if (o === keep) canonical.delete(o.id);
  }
}
const aliasPaths = [];            // [{from:{lang:path}, to:canonicalId}]
for (const [id, to] of canonical) { const c = byId.get(id); aliasPaths.push({ from: c.path, to: canon(to), id }); }
const products = rawProducts.map((p) => ({ ...p, category_ids: [...new Set(p.category_ids.map(canon))], voltage_tags: p.voltage_tags || [], variants: p.variants || [], pdfs: p.pdfs || [] }));
const nodes = new Map();
for (const c of byId.values()) {
  if (canonical.has(c.id)) continue;
  nodes.set(c.id, { ...c, parent: canon(c.parent) || 0, children: [], pathFor: {}, trail: [] });
}
for (const c of nodes.values()) for (const l of LANGS) c.pathFor[l] = c.path[l] || (l === 'es' ? c.path.es : `/${l}${c.path.es}`);
for (const c of nodes.values()) { const par = nodes.get(c.parent); if (par && par !== c) par.children.push(c); }
const subtreeIds = (c) => [c.id, ...c.children.flatMap(subtreeIds)];
const prodIdsOf = (c) => { const ids = new Set(subtreeIds(c)); return products.filter((p) => p.category_ids.some((x) => ids.has(x))).map((p) => p.id); };
for (const c of nodes.values()) c.total = prodIdsOf(c).length;
const HIDE = new Set(['sin-categorizar']);
const visible = (c) => c.total > 0 && !HIDE.has(c.slug.es);
const prune = (arr) => arr.filter(visible).sort((a, b) => (a.name.es || '').localeCompare(b.name.es || 'es')).map((c) => { c.children = prune(c.children); return c; });
const catTree = prune([...nodes.values()].filter((c) => !nodes.get(c.parent) || c.parent === 0));
const flatVisible = []; (function w(a, trail = []) { for (const c of a) { c.trail = [...trail, c]; flatVisible.push(c); w(c.children, c.trail); } })(catTree);
const catById = new Map(flatVisible.map((c) => [c.id, c]));
const aliases = new Map();       // ruta antigua → ruta canónica (se emiten como páginas de redirección)
for (const a of aliasPaths) { const to = catById.get(a.to); if (!to) continue; for (const l of LANGS) if (a.from[l] && a.from[l] !== to.pathFor[l]) aliases.set(a.from[l], to.pathFor[l]); }

// ───────────────────────────────────────────────────────────── [PRODUCTS] rutas por idioma, categoría principal
for (const p of products) {
  p.pathFor = {};
  for (const l of LANGS) p.pathFor[l] = p.path[l] || (l === 'es' ? `/product/${p.slug.es}/` : `/${l}/product/${p.slug.es}/`);
  const cats = p.category_ids.map((id) => catById.get(id)).filter(Boolean);
  p.mainCategory = cats.sort((a, b) => b.trail.length - a.trail.length || a.id - b.id)[0] || null;
  p.images = (p.images || []).filter((i) => i.file || i.src);
  // aún no hay variantes (se rellenan en la sesión 2 desde PDFs): cada producto sigue siendo pedible como línea genérica
}
const prodById = new Map(products.map((p) => [p.id, p]));
site_prodById_placeholder();
function site_prodById_placeholder() {}
const vtags = new Map(vtagList.map((v, i) => [v.id, { ...v, sort: v.sort ?? i }]));

// ───────────────────────────────────────────────────────────── [SITE] estructura global por idioma
const pth = (u) => { const p = new URL(u, 'https://grupotorivac.com').pathname; return p.endsWith('/') || /\.\w{2,5}$/.test(p) ? p : p + '/'; };
const pdfDir = path.join(ROOT, 'data', 'raw', 'pdf');
const pdfLocal = new Map();
if (fs.existsSync(pdfDir)) for (const f of fs.readdirSync(pdfDir)) { const s = fs.statSync(path.join(pdfDir, f)).size; if (s <= 14 * 1048576) pdfLocal.set(f, f); }
const logoKey = Object.keys(imageMap).find((k) => /Torivac_negativo/i.test(k));
const fundES = Object.keys(imageMap).find((k) => /MANUAL-FEDER/i.test(k));
const fundOT = Object.keys(imageMap).find((k) => /Logotipos_FondosEuropeos/i.test(k));
const logo = imageMap[logoKey]?.file || 'assets/img/logo.png';
const NAVKEYS = ['home', 'company', 'products', 'projects', 'catalog', 'blog', 'contact'];
const site = { registry: [], meta, demo: meta.price_mode === 'demo', absBase: ABS, logo, catTree, vtags, pdfLocal, aliases, paths: new Set(), funding: {}, home: {}, products: {}, blog: {}, quote: {}, contact: {}, company: {}, projects: {}, navItems: {}, footer: {}, nav: {} };
const QSLUG = { es: '/presupuesto/', en: '/en/quote/', fr: '/fr/devis/', de: '/de/angebot/' };
meta.catalogHref = {};
for (const l of LANGS) {
  const items = meta.nav[l];
  site.navItems[l] = items.map((n, i) => {
    const key = NAVKEYS[i];
    if (key === 'catalog') {
      const file = decodeURIComponent(n.href.split('/').pop());
      const local = pdfLocal.has(file);
      meta.catalogHref[l] = { file, local, url: n.href };
      return { key, label: n.label, pdfFile: local ? file : null, pdfUrl: n.href };
    }
    return { key, label: n.label, path: pth(n.href) };
  });
  for (const n of site.navItems[l]) if (n.key !== 'catalog') site[n.key][l] = n.path;
  site.quote[l] = QSLUG[l];
  site.funding[l] = { img: imageMap[l === 'es' ? fundES : fundOT]?.file || '' };
  const f = meta.footer[l];
  const lines = f.lines;
  site.footer[l] = {
    copyright: lines.find((x) => /^(©|\d{4}\s)/.test(x)) || '© Torivac',
    devBy: lines.find((x) => /Desarrollado|Developed|Développé|Entwickelt/.test(x)) || '',
    funding: f.funding_text || '',
    links: f.links.slice(0, 3).map((x) => ({ label: x.label, href: x.href })),
  };
}

site.prodById = prodById;
for (const c of flatVisible) c.firstProduct = prodIdsOf(c)[0];
// rutas lógicas existentes (para reescribir enlaces internos)
for (const l of LANGS) for (const p of Object.keys(pages[l] || {})) site.paths.add(p);
for (const p of products) for (const l of LANGS) site.paths.add(p.pathFor[l]);
for (const c of flatVisible) for (const l of LANGS) site.paths.add(c.pathFor[l]);
for (const l of LANGS) { site.paths.add(site.quote[l]); site.paths.add(site.products[l]); }
for (const [from] of aliases) site.paths.add(from);
// el carrito / tienda de WooCommerce se sustituyen por el presupuesto y el listado
for (const l of LANGS) for (const old of ['/carrito/', '/en/carrito/', '/fr/carrito/', '/de/carrito/', '/tienda/', '/en/tienda/', '/shop/', '/en/shop/']) if (!site.paths.has(old)) aliases.set(old, old.includes('carrito') ? QSLUG[old.startsWith('/en') ? 'en' : old.startsWith('/fr') ? 'fr' : old.startsWith('/de') ? 'de' : 'es'] : site.products[old.startsWith('/en') ? 'en' : 'es']);

// ───────────────────────────────────────────────────────────── [EMIT]
let count = 0;
const emit = (p, html) => { writeFile(DIST, p.replace(/^\//, '') + (p.endsWith('/') ? 'index.html' : ''), html); count++; };
const mkctx = (lang, p, section) => { const c = new Ctx({ lang, path: p, site }); c.section = section; return c; };
const LEGAL_MIN = 700;
// [SEO] migas de pan y nodos JSON-LD (solo se emiten con --base; ver site/lib/seo.mjs)
// título ≤ 65: «Nombre · Torivac» si cabe; si no, solo el nombre (recortado). Las categorías homónimas llevan el nombre del padre.
const fitTitle = (name) => { const full = `${name} · Torivac`; return full.length <= 65 ? full : (name.length <= 65 ? name : name.slice(0, 64).replace(/\s+\S*$/, '') + '…'); };
const crumbHome = (lang) => ({ name: t('home', lang), path: site.home[lang] });
const crumbProducts = (lang) => ({ name: t('products', lang), path: site.products[lang] });
const pickAlt = (a, lang) => (a && (a[lang] || a.es)) || '';
const absImg = (im) => (ABS && im && im.file ? ABS + '/' + im.file : null);

for (const lang of LANGS) {
  const L = pages[lang] || {};
  const alts = (pagePath) => { const a = L[pagePath]?.alternates || {}; return Object.fromEntries(Object.entries(a).filter(([, v]) => v && site.paths.has(v))); };

  // home
  const homePath = site.home[lang];
  if (L[homePath]) {
    const ctx = mkctx(lang, homePath, 'home');
    const h = TPL.homeBody(ctx, L[homePath]);
    emit(homePath, TPL.layout(ctx, { title: L[homePath].title || 'Torivac', description: L[homePath].meta_description, template: 'home', hero: h.hero, body: h.body, alts: alts(homePath), scripts: ['assets/js/contact.js'], crumbs: [crumbHome(lang)] }));
  }

  // listado de productos (la página "Productos" de la web original aporta el texto de introducción)
  {
    const pp = site.products[lang];
    const ctx = mkctx(lang, pp, 'products');
    const intro = (L[pp]?.sections || []).flatMap((s) => s.blocks);
    const h1 = intro.find((b) => b.t === 'h');
    const title = h1?.x || t('products', lang);
    const hero = `<section class="page-hero bp"><div class="container"><h1>${esc(title)}</h1></div></section>`;
    const alt = Object.fromEntries(LANGS.map((l) => [l, site.products[l]]));
    emit(pp, TPL.layout(ctx, { title: L[pp]?.title || title, description: L[pp]?.meta_description, template: 'shop', hero, body: TPL.shopBody(ctx, { products, intro: [] }), alts: alt, scripts: ['assets/js/shop.js'], crumbs: [crumbHome(lang), crumbProducts(lang)], ld: [itemListNode(ABS, pp, products.map((x) => ({ path: x.pathFor[lang], name: x.name[lang] || x.name.es })))] }));
  }

  // categorías (nombres repetidos en el mismo idioma → se desambiguan en el <title> con el nombre del padre)
  const dupNames = new Map(); for (const c of flatVisible) { const k = `${lang}|${c.name[lang] || c.name.es}`; dupNames.set(k, (dupNames.get(k) || 0) + 1); }
  for (const c of flatVisible) {
    const cp = c.pathFor[lang];
    const ctx = mkctx(lang, cp, 'products');
    const ids = new Set(prodIdsOf(c));
    const name = c.name[lang] || c.name.es;
    const hero = `<section class="page-hero bp"><div class="container"><h1>${esc(name)}</h1></div></section>`;
    const alt = Object.fromEntries(LANGS.map((l) => [l, c.pathFor[l]]));
    emit(cp, TPL.layout(ctx, { title: fitTitle(dupNames.get(`${lang}|${name}`) > 1 && c.trail.length > 1 ? `${name} (${c.trail[c.trail.length - 2].name[lang] || c.trail[c.trail.length - 2].name.es})` : name), description: c.seo?.[lang]?.description || c.seo?.es?.description, template: 'shop', hero, body: TPL.shopBody(ctx, { products: products.filter((p) => ids.has(p.id)), category: c, intro: (c.description[lang] || c.description.es || []) }), alts: alt, scripts: ['assets/js/shop.js'], crumbs: [crumbHome(lang), crumbProducts(lang), ...c.trail.map((x) => ({ name: x.name[lang] || x.name.es, path: x.pathFor[lang] }))], ld: [itemListNode(ABS, cp, products.filter((x) => ids.has(x.id)).map((x) => ({ path: x.pathFor[lang], name: x.name[lang] || x.name.es })))] }));
  }

  // fichas de producto
  for (const p of products) {
    const pp = p.pathFor[lang];
    const ctx = mkctx(lang, pp, 'products');
    const name = p.name[lang] || p.name.es;
    const rel = p.related.map((id) => prodById.get(id)).filter(Boolean);
    const alt = Object.fromEntries(LANGS.map((l) => [l, p.pathFor[l]]));
    const seo = p.seo[lang] || p.seo.es || {};
    emit(pp, TPL.layout(ctx, { title: (seo.title || fitTitle(name)).replace(/&amp;/g, '&'), description: seo.description, template: 'product', body: TPL.productBody(ctx, p, rel), alts: alt, scripts: ['assets/js/shop.js'], ogImage: p.images[0] && (ABS ? ABS + '/' + p.images[0].file : undefined), images: p.images.slice(0, 4).map((im) => ({ file: im.file, alt: pickAlt(im.alt, lang) })), crumbs: [crumbHome(lang), crumbProducts(lang), ...(p.mainCategory ? p.mainCategory.trail.map((x) => ({ name: x.name[lang] || x.name.es, path: x.pathFor[lang] })) : []), { name, path: pp }], ld: [productNode(ABS, { path: pp, name, description: plain(p.short?.[lang] || p.short?.es || []), images: p.images.slice(0, 4).map(absImg).filter(Boolean), category: p.mainCategory ? (p.mainCategory.name[lang] || p.mainCategory.name.es) : null })] }));
  }

  // blog
  const posts = Object.values(L).filter((x) => x.kind === 'post').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  {
    const bp = site.blog[lang];
    const ctx = mkctx(lang, bp, 'blog');
    const first = (L[bp]?.sections || []).flatMap((s) => s.blocks).find((b) => b.t === 'h');
    const hero = `<section class="page-hero bp"><div class="container"><h1>${esc(first?.x || 'Blog')}</h1></div></section>`;
    emit(bp, TPL.layout(ctx, { title: L[bp]?.title || 'Blog', description: L[bp]?.meta_description, template: 'blog', hero, body: TPL.blogIndexBody(ctx, posts), alts: alts(bp), crumbs: [crumbHome(lang), { name: first?.x || 'Blog', path: bp }] }));
  }
  const bp0 = site.blog[lang];
  for (const post of posts) {
    const ctx = mkctx(lang, post.path, 'blog');
    const b = TPL.postBody(ctx, post);
    emit(post.path, TPL.layout(ctx, { title: post.title, description: post.meta_description || post.excerpt, template: 'post', hero: b.hero, body: b.body, alts: alts(post.path), ogImage: post.featured && ABS ? ABS + '/' + post.featured.file : undefined, crumbs: [crumbHome(lang), { name: 'Blog', path: bp0 }, { name: post.title, path: post.path }], ld: [postNode(ABS, lang, { path: post.path, title: post.title, description: post.meta_description || post.excerpt, date: post.date, image: post.featured && ABS ? ABS + '/' + post.featured.file : undefined })] }));
  }

  // contacto
  {
    const cp = site.contact[lang];
    const ctx = mkctx(lang, cp, 'contact');
    const pg = L[cp];
    const bl = (pg?.sections || []).flatMap((s) => s.blocks);
    const head = bl.filter((b) => b.t === 'h' || b.t === 'p').filter((b) => !(b.t === 'p' && /reCAPTCHA/i.test(b.h)));
    const h1 = head.find((b) => b.t === 'h');
    const title = h1?.x || t('contact_us', lang);
    const hero = `<section class="page-hero bp"><div class="container"><h1>${esc(title)}</h1></div></section>`;
    const body = `<section class="sec"><div class="container split" style="align-items:start"><div class="prose">${TPL.contactIntro(ctx, head.filter((b) => b !== h1))}</div>${TPL.contactForm(ctx, 'page')}</div></section>`;
    emit(cp, TPL.layout(ctx, { title: pg?.title || title, description: pg?.meta_description, template: 'contact', hero, body, alts: alts(cp), scripts: ['assets/js/contact.js'], crumbs: [crumbHome(lang), { name: title, path: cp }] }));
  }

  // presupuesto
  {
    const qp = site.quote[lang];
    const ctx = mkctx(lang, qp, 'quote');
    const hero = `<section class="page-hero bp"><div class="container"><h1>${t('quote_yours', lang)}</h1></div></section>`;
    const alt = Object.fromEntries(LANGS.map((l) => [l, site.quote[l]]));
    emit(qp, TPL.layout(ctx, { title: `${t('quote', lang)} · Torivac`, description: '', template: 'quote', hero, body: TPL.quoteBody(ctx), alts: alt, scripts: ['assets/vendor/jspdf.umd.min.js', 'assets/vendor/jspdf.plugin.autotable.min.js', 'assets/vendor/xlsx.mini.min.js', 'assets/js/pdf.js', 'assets/js/quote-page.js'], noindex: true }));
  }

  // páginas genéricas (empresa, proyectos, legales…)
  const special = new Set([homePath, site.products[lang], site.blog[lang], site.contact[lang]]);
  for (const [pp, pg] of Object.entries(L)) {
    if (pg.kind !== 'page' || special.has(pp)) continue;
    const words = pg.sections.reduce((n, s) => n + s.blocks.length, 0);
    if (words < 2) continue;                       // p. ej. política de cookies: es un shortcode dinámico de Complianz
    const ctx = mkctx(lang, pp, 'page');
    const g = TPL.genericPage(ctx, pg);
    emit(pp, TPL.layout(ctx, { title: pg.title || g.title, description: pg.meta_description, template: 'page', hero: g.hero, body: g.body, alts: alts(pp), crumbs: [crumbHome(lang), { name: pg.title || g.title, path: pp }] }));
  }
}
// redirecciones de rutas fusionadas / sustituidas
for (const [from, to] of aliases) {
  if (!from.endsWith('/')) continue;
  const depth = from.split('/').filter(Boolean).length;
  const up = '../'.repeat(depth);
  const target = up + to.replace(/^\//, '') + 'index.html';
  emit(from, `<!doctype html><meta charset="utf-8"><title>Redirect</title><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${attr(target)}"><link rel="canonical" href="${attr(ABS + to)}"><a href="${attr(target)}">→</a>`);
}
// raíz de /en, /fr, /de ya emitida como home; portada del demo
console.log(`HTML emitidos: ${count}`);

// ───────────────────────────────────────────────────────────── [DATA] datos para el navegador (compatibles con file://)
const itemsJs = {};
for (const p of products) {
  const vs = p.variants.length ? p.variants : [{ ref: 'P' + p.id, specs: {}, default: true }];
  for (const v of vs) {
    const specLabel = Object.entries(v.specs || {}).slice(0, 4).map(([k, x]) => `${k} ${x.raw}`).join(' · ');
    const im = (v.image || p.images[0]) || {};
    itemsJs[v.ref] = { pid: p.id, n: Object.fromEntries(LANGS.map((l) => [l, p.name[l] || p.name.es])), v: specLabel, d: !!v.default, p: p.pathFor, img: im.thumb || im.file || null, th: im.file ? (thumbs[im.file] ? im.file : null) : null };
  }
}
// [WORKER] referencias pedibles para validar pedidos en el servidor (workers/api): { ref: { n: nombre ES, pid } }
{
  const wk = path.join(ROOT, 'workers', 'api', 'src', 'generated');
  fs.mkdirSync(wk, { recursive: true });
  const slim = Object.fromEntries(Object.entries(itemsJs).map(([ref, i]) => [ref, { n: i.n.es, pid: i.pid }]));
  fs.writeFileSync(path.join(wk, 'items.js'), `// GENERADO por site/build.mjs (no editar a mano). refs pedibles: { ref: { n: nombre ES, pid } }\nexport default ${JSON.stringify(slim)};\n`);
}
const i18n = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(Object.keys(T).map((k) => [k, T[k][l] ?? T[k].es]))]));
const thumbsUsed = Object.fromEntries(Object.entries(thumbs).filter(([k]) => k !== '__logo' && Object.values(itemsJs).some((i) => i.th === k)));
const catalogJs = `/* [DATA] generado por site/build.mjs — no editar */\nwindow.TV=window.TV||{};\nTV.meta=${JSON.stringify({ currency: meta.currency || 'EUR', demo: site.demo, recipients: meta.order_recipients?.to || [], api: process.env.TORIVAC_API || meta.api_base || '', contact: meta.contact })};\nTV.i18n=${JSON.stringify(i18n)};\nTV.items=${JSON.stringify(itemsJs)};\nTV.thumbs=${JSON.stringify(thumbsUsed)};\nTV.logo=${JSON.stringify(thumbs.__logo || null)};\n`;
writeFile(DIST, 'assets/data/catalog.js', catalogJs);
writeFile(DIST, 'assets/data/prices.js', `/* [DATA] precios — se regenera con scripts/build_prices.py (Sesión 6) */\nwindow.TV=window.TV||{};\nTV.prices=${JSON.stringify(prices)};\n`);
writeFile(DIST, 'assets/data/proposals.js', `window.TV=window.TV||{};TV.proposals=${JSON.stringify(proposals)};\n`);

// [ADMIN] datos de cobertura para la vista Contenido + página /admin/
const adminProducts = products.map((p) => ({ id: p.id, name: p.name.es, cat: p.mainCategory ? p.mainCategory.name.es : '', st: { en: p.translation_status.en, fr: p.translation_status.fr, de: p.translation_status.de }, variants: p.variants.length, vtags: (p.voltage_tags || []).length, pdfs: p.pdfs.length }));
const byRef = {}; for (const p of products) { const vs = p.variants.length ? p.variants : [{ ref: 'P' + p.id }]; for (const v of vs) byRef[v.ref] = { cat: p.mainCategory ? p.mainCategory.trail.map((c) => c.name.es).join(' ') : '' }; }
writeFile(DIST, 'assets/data/admin-data.js', `window.TV=window.TV||{};TV.admin=${JSON.stringify({ products: adminProducts, byRef })};\n`);
for (const f of ['prices.demo.xlsx', 'prices.demo.csv']) if (fs.existsSync(path.join(CAT, f))) { fs.mkdirSync(path.join(DIST, 'assets', 'data'), { recursive: true }); fs.copyFileSync(path.join(CAT, f), path.join(DIST, 'assets', 'data', f)); }
{
  const ctx = mkctx('es', '/admin/', 'admin');
  const a = (s) => ctx.asset(s);
  writeFile(DIST, 'admin/index.html', `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Panel · Torivac (demo)</title><link rel="icon" href="${a('assets/img/favicon.png')}">${['fonts', 'tokens', 'base', 'layout', 'components', 'admin'].map((c) => `<link rel="stylesheet" href="${a(`assets/css/${c}.css`)}">`).join('')}</head><body class="admin tv-admin" data-path="/admin/"><input type="hidden" id="logo-src" value="${a(site.logo)}"><div id="admin-root"></div><div class="toast" id="toast" role="status"></div><script>window.TV_LANG='es';</script><script src="${a('assets/data/catalog.js')}"></script><script src="${a('assets/data/prices.js')}"></script><script src="${a('assets/data/proposals.js')}"></script><script src="${a('assets/data/admin-data.js')}"></script><script src="${a('assets/js/quote.js')}"></script><script src="${a('assets/vendor/jspdf.umd.min.js')}"></script><script src="${a('assets/vendor/jspdf.plugin.autotable.min.js')}"></script><script src="${a('assets/vendor/xlsx.mini.min.js')}"></script><script src="${a('assets/js/pdf.js')}"></script><script src="${a('assets/js/admin.js')}"></script></body></html>`);
  count++;
}

// ───────────────────────────────────────────────────────────── [ASSETS] estáticos
const SRC = path.join(ROOT, 'site', 'assets');
const copyDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const e of fs.readdirSync(a, { withFileTypes: true })) { const s = path.join(a, e.name), d = path.join(b, e.name); e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } };
copyDir(SRC, path.join(DIST, 'assets'));
fs.mkdirSync(path.join(DIST, 'assets', 'pdf'), { recursive: true });
for (const f of pdfLocal.keys()) fs.copyFileSync(path.join(pdfDir, f), path.join(DIST, 'assets', 'pdf', f));
// portada del demo: abre el español; selector con los 4 idiomas en demo.html
fs.writeFileSync(path.join(DIST, 'README-DEMO.txt'), `Torivac · demo (no es la web oficial)\nAbre index.html (español). Idiomas: en/index.html, fr/index.html, de/index.html.\nPrecios y envío de pedido: SIMULADOS.\n`);
// ───────────────────────────────────────────────────────────── [SEO-FILES] sitemap.xml (hreflang + imágenes), robots.txt, llms.txt, llms-full.txt (solo con --base)
if (ABS) {
  const reg = site.registry, regPaths = new Set(reg.map((r) => r.path));
  const xml = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const url = (r) => {
    const alt = Object.entries({ ...r.alts, [r.lang]: r.path }).filter(([, pth]) => regPaths.has(pth));
    const links = alt.length > 1 ? alt.map(([l, pth]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xml(ABS + pth)}"/>`).join('') + (r.alts.es || r.lang === 'es' ? `<xhtml:link rel="alternate" hreflang="x-default" href="${xml(ABS + (r.lang === 'es' ? r.path : r.alts.es))}"/>` : '') : '';
    const imgs = r.images.filter((i) => i.file).map((i) => `<image:image><image:loc>${xml(ABS + '/' + i.file)}</image:loc>${i.alt ? `<image:caption>${xml(i.alt.slice(0, 250))}</image:caption>` : ''}</image:image>`).join('');
    return `<url><loc>${xml(ABS + r.path)}</loc>${links}${imgs}</url>`;
  };
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${reg.map(url).join('')}</urlset>`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${ABS}/sitemap.xml\n`);
  // llms.txt: índice para modelos de lenguaje (qué es Torivac, páginas clave y fichas por idioma). llms-full.txt: lo mismo con el texto de cada ficha.
  const LNAME = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch' };
  const c = meta.contact || {};
  const head = `# Torivac\n\n> ${meta.legal_name || 'Torivac S.L.'} — fabricante europeo de transformadores toroidales y convencionales, variadores y estabilizadores de tensión, resistencias y bancos de carga, reóstatos y potenciómetros bobinados, botones de mando, hembrillas, portaleds, bobinas encapsuladas y núcleos. ${(c.address || []).join(', ')}. Tel. ${c.phone}. ${c.email}.\n\nPrecios: la web no publica tarifas; los pedidos se hacen por referencia y cantidad y se reciben como presupuesto en PDF.\n`;
  const sec = (title, rows) => `\n## ${title}\n${rows.join('\n')}\n`;
  let short = head, full = head;
  for (const lang of LANGS) {
    const pagesL = reg.filter((r) => r.lang === lang);
    const key = pagesL.filter((r) => ['home', 'contact', 'blog'].includes(r.template) || r.path === site.products[lang]);
    short += sec(`${LNAME[lang]} · páginas`, key.map((r) => `- [${r.title}](${ABS}${r.path})${r.description ? ': ' + r.description : ''}`));
    const prods = products.map((x) => ({ x, path: x.pathFor[lang], name: x.name[lang] || x.name.es, desc: plain(x.short?.[lang] || x.short?.es || []) }));
    short += sec(`${LNAME[lang]} · productos`, prods.map((r) => `- [${r.name}](${ABS}${r.path})${r.desc ? ': ' + r.desc.slice(0, 160) : ''}`));
    full += sec(`${LNAME[lang]} · productos (texto completo)`, prods.map((r) => `### ${r.name}\n${ABS}${r.path}\n${r.desc}\n${r.x.voltage_tags?.length ? 'Tensiones: ' + r.x.voltage_tags.join(', ') + '\n' : ''}`));
  }
  fs.writeFileSync(path.join(DIST, 'llms.txt'), short);
  fs.writeFileSync(path.join(DIST, 'llms-full.txt'), full);
  console.log(`SEO: sitemap ${reg.length} URLs · llms.txt ${(short.length / 1024).toFixed(0)} KB · llms-full.txt ${(full.length / 1024).toFixed(0)} KB`);
}
console.log('dist listo:', DIST);
