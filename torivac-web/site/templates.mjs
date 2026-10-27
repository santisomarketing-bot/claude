// [TEMPLATES] Plantillas HTML (funciones puras: datos → string). Cada una devuelve el <main> de su página;
// `layout()` lo envuelve con cabecera, pie, elementos flotantes y scripts.
// Datos: data/catalog/*.json (ver docs/ARQUITECTURA.md). Textos de interfaz: site/lib/i18n.mjs.

import { esc, attr, blocksHtml, inlineHtml, mapLink, plain, fmtDate } from './lib/render.mjs';
import { t, LANGS, countLabel, refLabel } from './lib/i18n.mjs';

const NAMES = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch' };
const pick = (obj, lang) => (obj && (obj[lang] ?? obj.es)) ?? '';

// ───────────────────────────────────────────────────────────── [LAYOUT] envoltorio común
export function layout(ctx, { title, description, body, template, alts = {}, scripts = [], hero = null, ogImage = null, noindex = false }) {
  const { lang, site } = ctx;
  const alt = (l) => alts[l] || site.home[l];
  // [NAV] menú principal: mismos 7 ítems y etiquetas que la web original (por idioma). `section` marca el activo.
  const nav = site.navItems[lang].map((n) => ({ label: n.label, pdf: n.key === 'catalog', current: n.key !== 'catalog' && (n.path === ctx.path || (n.key === ctx.section && ['products', 'blog'].includes(n.key))), href: n.key === 'catalog' ? (n.pdfFile ? ctx.asset('assets/pdf/' + n.pdfFile) : n.pdfUrl) : ctx.href(n.path) }));
  const langLinks = LANGS.map((l) => `<a href="${attr(ctx.href(alt(l)))}" hreflang="${l}" lang="${l}" ${l === lang ? 'aria-current="true"' : ''} title="${NAMES[l]}" data-set-lang="${l}">${l.toUpperCase()}</a>`).join('');
  const navHtml = nav.map((n) => `<a href="${attr(n.href)}"${n.current ? ' aria-current="page"' : ''}${n.pdf ? ' target="_blank" rel="noopener"' : ''}>${esc(n.label)}</a>`).join('');
  const f = site.footer[lang];
  const alternates = site.absBase ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${attr(site.absBase + alt(l))}">`).join('') : '';
  const canonical = site.absBase ? `<link rel="canonical" href="${attr(site.absBase + ctx.path)}">` : '';
  return `<!doctype html>
<html lang="${lang}" data-lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description || '')}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
${canonical}${alternates}
<meta name="theme-color" content="#100404">
<link rel="icon" href="${ctx.asset('assets/img/favicon.png')}" type="image/png">
${['fonts', 'tokens', 'base', 'layout', 'components', 'art'].map((c) => `<link rel="stylesheet" href="${ctx.asset(`assets/css/${c}.css`)}">`).join('\n')}
${ogImage ? `<meta property="og:image" content="${attr(ogImage)}">` : ''}
<meta property="og:title" content="${attr(title)}"><meta property="og:type" content="website">
</head>
<body class="tv tv-${template}" data-path="${attr(ctx.path)}">
<a class="skip" href="#content">${t('skip', lang)}</a>
${site.demo ? `<div class="demo-ribbon no-print" role="note">${t('demo_banner', lang)} · ${t('demo_prices', lang)}</div>` : ''}
<div class="lang-banner no-print" id="lang-banner" hidden><div class="container"><span data-lang-msg></span><a class="btn sm" href="#" data-lang-go></a><button class="btn sm ghost" type="button" data-lang-keep>${t('lang_dismiss', lang)}</button></div></div>
<header class="site-header no-print" id="site-header">
  <div class="container bar">
    <a class="brand" href="${attr(ctx.href(site.home[lang]))}" aria-label="Torivac"><img src="${ctx.asset(site.logo)}" alt="Torivac" width="150" height="54"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav" data-menu-toggle>☰ ${t('menu', lang)}</button>
    <nav class="nav" id="main-nav" aria-label="${attr(t('menu', lang))}">${navHtml}<a class="btn sm header-quote" href="${attr(ctx.href(site.quote[lang]))}" data-quote-link>${t('quote', lang)} <span class="count" data-quote-count>0</span></a></nav>
    <div class="lang" role="group" aria-label="${attr(t('language', lang))}">${langLinks}</div>
  </div>
</header>
${hero || ''}
<main id="content" tabindex="-1">
${body}
</main>
<footer class="site-footer on-dark">
  <div class="container">
    <div class="logo-row"><img src="${ctx.asset(site.logo)}" alt="Torivac" width="190" height="84" loading="lazy"></div>
    <div class="facts">
      <span class="fact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 21V5l9-2v18M13 8h7v13M4 21h16M7 8h3M7 12h3M7 16h3M16 12h1M16 16h1"/></svg><span>${site.meta.contact.address.map(esc).join('<br>')}</span></span>
      <a class="fact" href="tel:${attr(site.meta.contact.phone.replace(/\s/g, ''))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>${esc(site.meta.contact.phone)}</a>
      <a class="fact" href="mailto:${attr(site.meta.contact.email)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg>${esc(site.meta.contact.email)}</a>
    </div>
    <p class="legal">${esc(f.copyright)} ${f.links.map((l) => `<a href="${attr(l.href)}">${esc(l.label)}</a>`).join(' | ')}<br>${esc(f.devBy)} <a href="https://santisomarketing.com/" target="_blank" rel="noopener">Santiso Marketing</a></p>
    <div class="funding"><img src="${ctx.asset(site.funding[lang].img)}" alt="Cofinanciado por la Unión Europea · Ministerio de Hacienda · Fondos Europeos" width="520" height="68" loading="lazy"><p>${esc(f.funding)}</p></div>
  </div>
</footer>
<div class="fab-stack no-print">
  <button class="fab fab-top" type="button" data-top aria-label="${attr(t('back_to_top', lang))}">↑</button>
  <button class="fab fab-quote" type="button" data-open-quote aria-haspopup="dialog" aria-controls="quote-drawer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>${t('quote', lang)} <span class="count" data-quote-count>0</span></button>
</div>
<div class="scrim" data-scrim></div>
<aside class="quote-drawer no-print" id="quote-drawer" role="dialog" aria-modal="true" aria-label="${attr(t('quote_yours', lang))}" aria-hidden="true">
  <header><h2>${t('quote_yours', lang)}</h2><button class="icon-btn" type="button" data-close-quote aria-label="×">×</button></header>
  <div class="body" data-drawer-body></div>
  <footer data-drawer-foot></footer>
</aside>
<div class="toast" role="status" aria-live="polite" data-toast></div>
<script>window.TV_LANG=${JSON.stringify(lang)};window.TV_PATHS=${JSON.stringify({ quote: ctx.href(site.quote[lang]), home: Object.fromEntries(LANGS.map((l) => [l, ctx.href(alt(l))])) })};</script>
<script src="${ctx.asset('assets/data/catalog.js')}"></script>
<script src="${ctx.asset('assets/data/prices.js')}"></script>
<script src="${ctx.asset('assets/js/quote.js')}"></script>
<script src="${ctx.asset('assets/js/app.js')}"></script>
${scripts.map((s) => `<script src="${ctx.asset(s)}"></script>`).join('\n')}
</body>
</html>`;
}

// ───────────────────────────────────────────────────────────── [SHARED] migas, etiquetas de tensión, tarjeta de producto
export const crumbs = (ctx, items) => `<nav aria-label="breadcrumb"><ol class="crumbs">${items.map((i, k) => `<li>${i.href && k < items.length - 1 ? `<a href="${attr(i.href)}">${esc(i.label)}</a>` : `<span${k === items.length - 1 ? ' aria-current="page"' : ''}>${esc(i.label)}</span>`}</li>`).join('')}</ol></nav>`;

export function vtags(site, ids = [], limit = 6) {
  const out = ids.slice(0, limit).map((id) => {
    const v = site.vtags.get(id);
    if (!v) return '';
    const kind = v.kind === 'dc' ? ' dc' : v.kind === 'range' ? ' range' : v.kind === 'three-phase' ? ' three' : '';
    return `<span class="vtag${kind}" title="${attr(v.title || v.label)}">${esc(v.label)}</span>`;
  }).join('');
  return out ? `<div class="vtag-row">${out}</div>` : '';
}

export function productCard(ctx, p) {
  const lang = ctx.lang;
  const name = pick(p.name, lang);
  const im = p.images[0];
  const cats = p.category_ids.join(',');
  const nVar = p.variants.length;
  return `<a class="pcard" href="${attr(ctx.href(p.pathFor[lang]))}" data-pid="${p.id}" data-cats="${cats}" data-v="${(p.voltage_tags || []).join(',')}" data-q="${attr((name + ' ' + p.variants.map((v) => v.ref).join(' ')).toLowerCase())}">
  <div class="ph">${im ? `<img src="${attr(ctx.thumb(im))}" alt="${attr(pick(im.alt, lang) || name)}" loading="lazy" decoding="async" width="${im.w ? Math.min(480, im.w) : 480}" height="${im.h ? Math.round(Math.min(480, im.w || 480) * (im.h / (im.w || 1))) : 480}">` : ''}</div>
  <div class="tx"><h3>${esc(name)}</h3>${vtags(ctx.site, p.voltage_tags, 3)}<div class="meta"><span>${nVar ? refLabel(nVar, lang) : ''}</span><span class="go">${t('view_product', lang)} →</span></div></div>
</a>`;
}

/** árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
 *  La rama de la categoría activa queda abierta (data-open). */
export function catTree(ctx, activeId = null) {
  const lang = ctx.lang;
  const holds = (c) => c.id === activeId || c.children.some(holds);
  const link = (c) => `<a href="${attr(ctx.href(c.pathFor[lang]))}"${c.id === activeId ? ' aria-current="page"' : ''}><span>${esc(pick(c.name, lang))}</span><span class="n">${c.total}</span></a>`;
  const walk = (nodes) => `<ul>${nodes.map((c) => c.children.length
    ? `<li class="has-kids"${holds(c) ? ' data-open' : ''}>${link(c)}${walk(c.children)}</li>`
    : `<li>${link(c)}</li>`).join('')}</ul>`;
  return `<nav aria-label="${attr(t('categories', lang))}"><div class="cat-tree" data-tree>${walk(ctx.site.catTree)}</div></nav>`;
}

/** tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original */
export function categoryCards(ctx) {
  const { lang, site } = ctx;
  const cards = site.catTree.map((c) => {
    const desc = (c.description[lang] || c.description.es || []).find((b) => b.t === 'p');
    let txt = desc ? desc.h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
    // algunas descripciones originales son copia de otra categoría (ver docs/01-analisis/HALLAZGOS.md #3): en la tarjeta solo se usa si comparte alguna palabra significativa con el nombre
    const words = (pick(c.name, lang) || '').toLowerCase().split(/[^a-záéíóúñüçàâêèëîïôûäöß]+/).filter((w) => w.length > 4).map((w) => w.slice(0, 6));
    if (txt && words.length && !words.some((w) => txt.toLowerCase().includes(w))) txt = '';
    const im = c.image || site.prodById.get(c.firstProduct)?.images?.[0];
    return `<a class="ccard" href="${attr(ctx.href(c.pathFor[lang]))}"><div class="ph">${im ? `<img src="${attr(ctx.thumb(im))}" alt="" loading="lazy" decoding="async">` : ''}</div><div class="tx"><h3>${esc(pick(c.name, lang))}</h3>${txt ? `<p>${esc(txt.slice(0, 140))}${txt.length > 140 ? '…' : ''}</p>` : ''}<span class="meta"><span>${countLabel(c.total, lang)}</span><span class="go">${t('view_category', lang)} →</span></span></div></a>`;
  }).join('');
  return `<h2 class="sr-h">${t('categories', lang)}</h2><div class="ccards">${cards}</div>`;
}

// ───────────────────────────────────────────────────────────── [HOME]
export function homeBody(ctx, page) {
  const { lang, site } = ctx;
  const S = page.sections;
  const text = (sec) => sec.blocks.filter((b) => b.t === 'h' || b.t === 'p');
  const imgs = (sec) => sec.blocks.filter((b) => b.t === 'img');
  const btn = (sec) => sec.blocks.find((b) => b.t === 'btn');
  const heroSec = S[0];
  const h1 = heroSec.blocks.find((b) => b.t === 'h');
  const heroBg = heroSec.bg ? ctx.img(heroSec.bg) : '';
  const heroParas = heroSec.blocks.filter((b) => b.t === 'p');
  const heroBtn = btn(heroSec);
  const hero = `<section class="hero bp" style="${heroBg ? `background-image:url('${attr(heroBg)}')` : ''}" aria-labelledby="h-hero">
  <div class="container"><h1 id="h-hero">${esc(h1?.x || '')}</h1>${heroParas.map((p) => `<p>${inlineHtml(ctx, p.h)}</p>`).join('')}
  <div class="actions">${heroBtn ? `<a class="btn" href="${attr(mapLink(ctx, heroBtn.href))}">${esc(heroBtn.x)}</a>` : ''}<a class="btn ghost" href="${attr(ctx.href(site.quote[lang]))}">${t('quote', lang)} →</a></div></div>
  ${waveSvg()}
</section>`;
  const s1 = S[1], s2 = S[2], s3 = S[3], s4 = S[4], s5 = S[5];
  const eyebrowAndHead = (sec) => {
    const hs = sec.blocks.filter((b) => b.t === 'h');
    const eb = hs.find((h) => h.l >= 4), main = hs.find((h) => h.l <= 3);
    return `${eb ? `<p class="eyebrow">${esc(eb.x)}</p>` : ''}${main ? `<h2>${esc(main.x)}</h2>` : ''}`;
  };
  const paras = (sec) => sec.blocks.filter((b) => b.t === 'p').map((p) => `<p>${inlineHtml(ctx, p.h)}</p>`).join('');
  const bt = (sec, cls = '') => { const b = btn(sec); return b ? `<a class="btn ${cls}" href="${attr(mapLink(ctx, b.href))}">${esc(b.x)}</a>` : ''; };
  const im1 = imgs(s1)[0];
  const sec1 = `<section class="sec"><div class="container split">
    <figure class="photo-frame crop">${im1 ? `<img src="${attr(ctx.img(im1.img))}" alt="${attr(im1.alt || '')}" loading="lazy" width="${im1.img?.w || 768}" height="${im1.img?.h || 512}">` : ''}</figure>
    <div>${eyebrowAndHead(s1)}${paras(s1)}${bt(s1)}</div></div></section>`;
  const car2 = imgs(s2).map((i) => `<img src="${attr(ctx.thumb(i.img))}" alt="${attr(i.alt || '')}" loading="lazy">`).join('');
  const s2h = s2.blocks.filter((b) => b.t === 'h');
  const sec2 = `<section class="sec alt"><div class="container"><h2 class="center">${esc(s2h.find((h) => h.l <= 3)?.x || '')}</h2>
    <div class="split"><div class="card-shadow"><h3>${esc(s2h.find((h) => h.l >= 4)?.x || '')}</h3>${paras(s2)}${bt(s2)}</div><div class="photo-grid" aria-label="Fotos">${car2}</div></div></div></section>`;
  const tiles = page.services.map((c) => `<a class="tile" href="${attr(mapLink(ctx, c.href))}"><img src="${attr(ctx.img(c.icon))}" alt="" loading="lazy" width="92" height="92"><span>${esc(c.title)}</span></a>`).join('');
  const sec3 = `<section class="sec tight"><div class="container">${eyebrowAndHead(s3)}<div class="tiles">${tiles}</div></div></section>`;
  const cat = site.meta.catalogHref[lang];
  const sec4 = `<section class="sec tight dark on-dark bp"><div class="container split"><div>${eyebrowAndHead(s4)}${paras(s4)}</div><div class="center"><a class="btn" href="${attr(cat.local ? ctx.asset('assets/pdf/' + cat.file) : cat.url)}" target="_blank" rel="noopener">⬇ ${esc(btn(s4)?.x || t('catalog_dl', lang))}</a></div></div></section>`;
  const car5 = imgs(s5).map((i) => `<img src="${attr(ctx.thumb(i.img))}" alt="${attr(i.alt || '')}" loading="lazy">`).join('');
  const s5h = s5.blocks.filter((b) => b.t === 'h');
  const sec5 = `<section class="sec"><div class="container"><div class="photo-grid wide" aria-label="Fotos">${car5}</div>
    <div class="card-shadow" style="margin-top:var(--s-6)"><h2>${esc(s5h.find((h) => h.l <= 3)?.x || '')}</h2><h3>${esc(s5h.find((h) => h.l >= 4)?.x || '')}</h3>${paras(s5)}</div></div></section>`;
  const s6 = S[6];
  const s6h = s6.blocks.filter((b) => b.t === 'h');
  const contact = `<section class="sec alt" id="contacto"><div class="container split" style="align-items:start"><div><p class="eyebrow">${esc(s6h.find((h) => h.l >= 4)?.x || '')}</p><h2>${esc(s6h.find((h) => h.l <= 3)?.x || '')}</h2>${paras({ blocks: s6.blocks.filter((b) => b.t === 'p' && !/reCAPTCHA|^\./.test(b.h)).slice(0, 1) })}</div>${contactForm(ctx, 'home')}</div></section>`;
  return { hero, body: `${sec1}${sec2}${sec3}${sec4}${sec5}${contact}` };
}

/** onda de tensión animada (SVG) — elemento gráfico base del hero */
export const waveSvg = () => `<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <g class="w w1"><path d="M0 45 Q 90 -5 180 45 T 360 45 T 540 45 T 720 45 T 900 45 T 1080 45 T 1260 45 T 1440 45 T 1620 45 T 1800 45 T 1980 45 T 2160 45 T 2340 45 T 2520 45 T 2700 45 T 2880 45" fill="none" stroke="#f0a259" stroke-width="1.6" opacity=".9"/></g>
  <g class="w w2"><path d="M0 45 Q 60 5 120 45 T 240 45 T 360 45 T 480 45 T 600 45 T 720 45 T 840 45 T 960 45 T 1080 45 T 1200 45 T 1320 45 T 1440 45 T 1560 45 T 1680 45 T 1800 45 T 1920 45 T 2040 45 T 2160 45 T 2280 45 T 2400 45 T 2520 45 T 2640 45 T 2760 45 T 2880 45" fill="none" stroke="#ffb653" stroke-width="1" opacity=".55"/></g>
  <g class="w w3"><path d="M0 45 Q 120 -25 240 45 T 480 45 T 720 45 T 960 45 T 1200 45 T 1440 45 T 1680 45 T 1920 45 T 2160 45 T 2400 45 T 2640 45 T 2880 45" fill="none" stroke="#fff" stroke-width=".8" opacity=".3"/></g>
</svg>`;

// ───────────────────────────────────────────────────────────── [PAGES] páginas genéricas (empresa, proyectos, legales)
export function sectionsHtml(ctx, page) {
  return page.sections.map((s, i) => {
    if (s.form) return `<section class="sec alt"><div class="container split" style="align-items:start"><div class="prose">${blocksHtml(ctx, s.blocks.filter((b) => !(b.t === 'p' && /reCAPTCHA/i.test(b.h))), { demote: 0 })}</div>${contactForm(ctx, 'section')}</div></section>`;
    if (!s.blocks.length) return '';
    const isPhoto = (b) => b.t === 'img' && !(b.img && b.img.w && b.img.w <= 160);   // los iconos pequeños se quedan dentro del texto
    const hasImg = s.blocks.some(isPhoto);
    const hasText = s.blocks.some((b) => b.t === 'p' || b.t === 'h' || b.t === 'ul');
    const imgs = s.blocks.filter(isPhoto);
    const rest = s.blocks.filter((b) => !isPhoto(b));
    const bg = s.bg ? ` style="background-image:url('${attr(ctx.img(s.bg))}');background-size:cover;background-position:center"` : '';
    const dark = s.bg && !/formatorivac/.test(s.bg.src || '');
    if (hasImg && hasText) {
      const gal = imgs.length > 1 ? `<div class="carousel" tabindex="0">${imgs.map((b) => `<img src="${attr(ctx.thumb(b.img))}" alt="${attr(b.alt || '')}" loading="lazy">`).join('')}</div>` : `<figure class="photo-frame crop"><img src="${attr(ctx.img(imgs[0].img))}" alt="${attr(imgs[0].alt || '')}" loading="lazy"></figure>`;
      return `<section class="sec${i % 2 ? ' alt' : ''}"><div class="container split${i % 2 ? ' rev' : ''}">${gal}<div class="prose">${blocksHtml(ctx, rest, { demote: 0 })}</div></div></section>`;
    }
    if (hasImg) return `<section class="sec tight"><div class="container"><div class="carousel" tabindex="0">${imgs.map((b) => `<img src="${attr(ctx.thumb(b.img))}" alt="${attr(b.alt || '')}" loading="lazy">`).join('')}</div></div></section>`;
    return `<section class="sec${dark ? ' dark on-dark bp' : i % 2 ? ' alt' : ''}"${dark ? bg : ''}><div class="container"><div class="prose wide">${blocksHtml(ctx, s.blocks, { demote: 0 })}</div></div></section>`;
  }).join('\n');
}

export function genericPage(ctx, page) {
  const { lang } = ctx;
  const first = page.sections.find((s) => s.blocks.length);
  const h1 = first?.blocks.find((b) => b.t === 'h');
  const heroBg = page.sections.find((s) => s.bg && /hero|4Z0A|Blog|WhatsApp/i.test(s.bg.src))?.bg || page.sections.find((s) => s.bg)?.bg;
  // el primer encabezado se usa como h1 del hero y se quita del cuerpo
  const body = { ...page, sections: page.sections.map((s) => ({ ...s, blocks: s.blocks.slice() })) };
  if (h1) { const k = body.sections.findIndex((s) => s.blocks.includes(h1) || s.blocks.some((b) => b.t === 'h' && b.x === h1.x)); const idx = body.sections[k].blocks.findIndex((b) => b.t === 'h' && b.x === h1.x); body.sections[k].blocks.splice(idx, 1); }
  const title = h1?.x || page.title;
  // si la sección del título solo trae texto (sin fotos ni botones), ese texto pasa a ser el subtítulo del hero y la sección se retira
  let lead = '';
  const hs = body.sections.find((s) => s.blocks.length && s.bg);
  if (hs && hs === body.sections.find((s) => s.blocks.length) && hs.blocks.every((b) => b.t === 'p')) { lead = hs.blocks.map((b) => `<p class="lead">${inlineHtml(ctx, b.h)}</p>`).join(''); hs.blocks = []; }
  return {
    hero: `<section class="page-hero bp" ${heroBg ? `style="background-image:url('${attr(ctx.img(heroBg))}')"` : ''}><div class="container">${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(ctx.site.home[lang]) }, { label: title }])}<h1>${esc(title)}</h1>${lead}</div></section>`,
    body: sectionsHtml(ctx, body),
    title,
  };
}

// ───────────────────────────────────────────────────────────── [BLOG]
export function blogIndexBody(ctx, posts) {
  const { lang } = ctx;
  const cards = posts.map((p) => `<a class="post-card" href="${attr(ctx.href(p.path))}"><div class="im">${p.featured ? `<img src="${attr(ctx.thumb(p.featured))}" alt="" loading="lazy">` : ''}</div><div class="tx"><time datetime="${attr(p.date || '')}">${fmtDate(p.date, lang)}</time><h3>${esc(p.title)}</h3><p class="muted">${esc((p.excerpt || '').slice(0, 150))}${(p.excerpt || '').length > 150 ? '…' : ''}</p></div></a>`).join('');
  return `<section class="sec"><div class="container"><div class="posts">${cards}</div></div></section>`;
}
export function postBody(ctx, post) {
  const { lang } = ctx;
  const body = post.sections.flatMap((s) => s.blocks);
  const h1 = body.find((b) => b.t === 'h' && b.l === 1);
  const content = body.filter((b) => b !== h1);
  const hero = `<section class="page-hero bp" ${post.featured ? `style="background-image:url('${attr(ctx.img(post.featured))}')"` : ''}><div class="container">${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(ctx.site.home[lang]) }, { label: 'Blog', href: ctx.href(ctx.site.blog[lang]) }, { label: post.title }])}<h1>${esc(post.title)}</h1>${post.date ? `<p class="post-meta">${t('published', lang)} <time datetime="${attr(post.date)}">${fmtDate(post.date, lang)}</time></p>` : ''}</div></section>`;
  return { hero, body: `<article class="sec"><div class="container"><div class="prose">${blocksHtml(ctx, content, { demote: 0 })}</div></div></article>` };
}

// ───────────────────────────────────────────────────────────── [SHOP] listado / categoría
export function shopBody(ctx, { products, category = null, intro = [] }) {
  const { lang, site } = ctx;
  const vts = [...new Set(products.flatMap((p) => p.voltage_tags || []))].filter((id) => site.vtags.has(id));
  vts.sort((a, b) => (site.vtags.get(a).sort ?? 0) - (site.vtags.get(b).sort ?? 0));
  const chips = vts.map((id) => `<button class="chip" type="button" aria-pressed="false" data-vf="${attr(id)}">${esc(site.vtags.get(id).label)}</button>`).join('');
  const sidebar = `<aside class="sidebar no-print" id="filters" aria-label="${attr(t('filters', lang))}">
    <h2>${t('categories', lang)}</h2>${catTree(ctx, category?.id)}
    ${chips ? `<h2>${t('voltage', lang)}</h2><div class="chips" data-vchips>${chips}</div>` : ''}
    <h2>${t('search_ph', lang)}</h2><input class="search" type="search" placeholder="${attr(t('search_ph', lang))}" data-search aria-label="${attr(t('search_ph', lang))}">
    <p style="margin-top:var(--s-4)"><button class="btn sm ghost" type="button" data-clear-filters>${t('clear_filters', lang)}</button></p>
  </aside>`;
  const introHtml = intro.length ? `<div class="prose" style="margin-bottom:var(--s-5)">${blocksHtml(ctx, intro, { demote: 0, skipFirstHeading: true })}</div>` : '';
  const crumbsHtml = crumbs(ctx, [{ label: 'Torivac', href: ctx.href(site.home[lang]) }, { label: t('products', lang), href: category ? ctx.href(site.products[lang]) : null }, ...(category ? category.trail.map((c) => ({ label: pick(c.name, lang), href: ctx.href(c.pathFor[lang]) })) : [])]);
  return `<div class="container shop">
  ${sidebar}
  <div>
    ${crumbsHtml}
    ${introHtml}
    ${category ? '' : categoryCards(ctx)}
    <div class="toolbar"><button class="btn sm ghost filters-toggle" type="button" data-filters-toggle>☰ ${t('filters', lang)}</button><span class="count" data-count aria-live="polite">${countLabel(products.length, lang)}</span></div>
    <div class="pgrid" data-grid>${products.map((p) => productCard(ctx, p)).join('')}</div>
    <p class="notice" data-empty hidden>${t('no_results', lang)}</p>
  </div>
</div>`;
}

// ───────────────────────────────────────────────────────────── [PRODUCT] ficha
export function productBody(ctx, p, related) {
  const { lang, site } = ctx;
  const name = pick(p.name, lang);
  const useEs = !p.description[lang];
  const desc = useEs ? p.description.es : p.description[lang];
  const short = p.short[lang] || (useEs ? p.short.es : null) || [];
  const cat = p.mainCategory;
  const trail = cat ? cat.trail.map((c) => ({ label: pick(c.name, lang), href: ctx.href(c.pathFor[lang]) })) : [];
  const gal = p.images.length ? `<div class="gallery"><div class="main crop"><img data-main src="${attr(ctx.img(p.images[0]))}" alt="${attr(pick(p.images[0].alt, lang) || name)}" width="${p.images[0].w || 800}" height="${p.images[0].h || 800}"></div>${p.images.length > 1 ? `<div class="thumbs">${p.images.map((i, k) => `<button type="button" data-thumb="${attr(ctx.img(i))}" aria-current="${k === 0}" aria-label="${attr(name + ' ' + (k + 1))}"><img src="${attr(ctx.thumb(i))}" alt=""></button>`).join('')}</div>` : ''}</div>` : '<div></div>';
  const pdfs = p.pdfs.map((d) => {
    const nm = decodeURIComponent(d.url.split('/').pop());
    const local = site.pdfLocal.get(nm);
    return `<a class="btn ghost" href="${attr(local ? ctx.asset('assets/pdf/' + local) : d.url)}" target="_blank" rel="noopener">⬇ ${t('datasheet', lang)}${p.pdfs.length > 1 ? ' · ' + esc(nm.replace(/\.pdf$/i, '').slice(0, 24)) : ''}</a>`;
  }).join('');
  // tabla de modelos
  const variants = p.variants.length ? p.variants : [{ ref: 'P' + p.id, label: null, specs: {}, default: true }];
  const colCount = {};
  variants.forEach((v) => Object.keys(v.specs || {}).forEach((k) => { colCount[k] = (colCount[k] || 0) + 1; }));
  const cols = Object.keys(colCount).sort((a, b) => colCount[b] - colCount[a]).slice(0, 7);
  const rows = variants.map((v) => `<tr data-ref="${attr(v.ref)}">
    <td class="ref">${v.default ? '—' : esc(v.ref)}</td>
    ${v.default ? `<td colspan="${Math.max(1, cols.length)}">${esc(t('default_item', lang))}</td>` : cols.map((c) => `<td>${esc(v.specs?.[c]?.raw ?? '')}</td>`).join('')}
    <td class="price-cell" data-price-for="${attr(v.ref)}"></td>
    <td class="qty-cell"><div class="qty"><button type="button" data-dec aria-label="−">−</button><input type="number" inputmode="numeric" min="0" step="1" value="0" data-qty aria-label="${attr(t('qty', lang))} ${attr(v.ref)}"><button type="button" data-inc aria-label="+">+</button></div></td>
    <td class="add-cell"><button class="btn sm" type="button" data-add-row="${attr(v.ref)}">${t('add_to_quote', lang)}</button></td></tr>`).join('');
  const models = `<section id="modelos" aria-labelledby="h-models"><div class="models-bar"><h2 id="h-models" style="margin:0">${t('models', lang)}</h2><span><span class="price-demo" data-demo-flag hidden>DEMO</span></span></div>
    <p class="muted">${t('models_hint', lang)}</p>
    <div class="tbl-wrap models" tabindex="0" role="region" aria-label="${attr(t('models', lang))}"><table class="spec"><thead><tr><th>${t('ref', lang)}</th>${cols.length ? cols.map((c) => `<th>${esc(c)}</th>`).join('') : '<th></th>'}<th class="price-cell">${t('unit_price', lang)}</th><th>${t('qty', lang)}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p><button class="btn" type="button" data-add-selected>${t('add_selected', lang)}</button> <a class="btn ghost" href="${attr(ctx.href(site.quote[lang]))}">${t('quote', lang)} →</a></p></section>`;
  const notice = useEs && lang !== 'es' ? `<p class="notice">${t('translation_missing', lang)}</p>` : '';
  const rel = related.length ? `<section class="sec tight" style="padding-inline:0"><h2>${t('related', lang)}</h2><div class="pgrid">${related.map((r) => productCard(ctx, r)).join('')}</div></section>` : '';
  return `<div class="container shop">
  <aside class="sidebar no-print" id="filters" aria-label="${attr(t('categories', lang))}"><h2>${t('categories', lang)}</h2>${catTree(ctx, cat?.id)}</aside>
  <div>
    ${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(site.home[lang]) }, { label: t('products', lang), href: ctx.href(site.products[lang]) }, ...trail, { label: name }])}
    <button class="btn sm ghost filters-toggle" type="button" data-filters-toggle style="margin-bottom:var(--s-4)">☰ ${t('categories', lang)}</button>
    <article class="pdp" itemscope itemtype="https://schema.org/Product" data-pid="${p.id}">
      ${gal}
      <div><h1 itemprop="name">${esc(name)}</h1>${vtags(site, p.voltage_tags, 8)}
        <div class="short prose" style="margin-top:var(--s-4)">${blocksHtml(ctx, short, { demote: 2 })}</div>${notice}
        <div class="actions"><a class="btn" href="#modelos">${t('add_to_quote', lang)}</a>${pdfs}</div></div>
    </article>
    <div class="prose wide" style="margin-bottom:var(--s-6)">${blocksHtml(ctx, desc, { demote: 1 })}</div>
    ${models}
    ${rel}
  </div>
</div>`;
}

// ───────────────────────────────────────────────────────────── [QUOTE] página del presupuesto
export function quoteBody(ctx) {
  const { lang, site } = ctx;
  return `<section class="sec"><div class="container">
  <div class="qwrap">
    <div class="panel crop">
      <div class="models-bar"><h2 style="margin:0">${t('quote_yours', lang)}</h2><span class="price-demo" data-demo-flag hidden>${t('demo_prices', lang)}</span></div>
      <div data-quote-table></div>
      <p class="muted small" data-price-note></p>
      <p class="no-print"><button class="btn ghost sm" type="button" data-clear-quote>${t('clear', lang)}</button> <button class="btn ghost sm" type="button" data-refresh-prices>${t('refresh_prices', lang)}</button> <span class="muted small" data-price-stamp></span></p>
      <div class="drop no-print" data-drop tabindex="0" role="button" aria-label="CSV / Excel"><strong>CSV / Excel</strong><br><span class="muted small">${{ es: 'Arrastra aquí un archivo con columnas «referencia» y «cantidad», o haz clic para elegirlo.', en: 'Drop a file with “reference” and “quantity” columns here, or click to choose one.', fr: 'Déposez ici un fichier avec les colonnes « référence » et « quantité », ou cliquez pour le choisir.', de: 'Datei mit den Spalten „Artikelnummer“ und „Menge“ hierher ziehen oder klicken.' }[lang]}</span><input type="file" accept=".csv,.xlsx,.xls,text/csv" hidden data-file></div>
    </div>
    <form class="panel form no-print" data-quote-form novalidate>
      <h2>${t('your_data', lang)}</h2>
      <div class="grid2"><label>${t('name', lang)}<input type="text" name="name" autocomplete="name" required></label><label>${t('company', lang)}<input type="text" name="company" autocomplete="organization"></label></div>
      <div class="grid2"><label>${t('email', lang)}<input type="email" name="email" autocomplete="email" required></label><label>${t('phone', lang)}<input type="tel" name="phone" autocomplete="tel"></label></div>
      <label>${t('notes', lang)}<textarea name="notes"></textarea></label>
      <label class="check"><input type="checkbox" name="privacy" required> <span>${t('accept_privacy', lang)}</span></label>
      <div class="actions" style="display:flex;gap:var(--s-3);flex-wrap:wrap"><button class="btn" type="submit">${t('send_order', lang)}</button><button class="btn ghost" type="button" data-download-pdf>${t('download_pdf', lang)}</button></div>
      <p class="small muted">${t('send_hint', lang)}</p>
      ${site.demo ? `<p class="notice small">${t('demo_send_note', lang)}</p>` : ''}
      <div data-sent hidden class="notice ok" role="status"></div>
    </form>
  </div></div></section>`;
}

// ───────────────────────────────────────────────────────────── [CONTACT] formulario
export function contactForm(ctx, where = 'page') {
  const { lang, site } = ctx;
  return `<form class="form" data-contact-form novalidate aria-label="${attr(t('contact_us', lang))}">
    <label class="vh" for="cf-name-${where}">${t('name', lang)}</label><input id="cf-name-${where}" type="text" name="name" placeholder="${attr(t('name', lang))}" autocomplete="name" required>
    <label class="vh" for="cf-email-${where}">${t('email', lang)}</label><input id="cf-email-${where}" type="email" name="email" placeholder="${attr(t('email', lang))}" autocomplete="email" required>
    <label class="vh" for="cf-msg-${where}">${t('message', lang)}</label><textarea id="cf-msg-${where}" name="message" placeholder="${attr(t('message', lang))}" required></textarea>
    <label class="check"><input type="checkbox" name="privacy" required><span>${t('accept_privacy', lang)}</span></label>
    <div><button class="btn" type="submit">${t('send', lang)}</button></div>
    <p class="small muted">${t('recaptcha', lang)}</p>
    ${site.demo ? `<p class="notice small">${t('demo_send_note', lang)}</p>` : ''}
    <div data-sent hidden class="notice ok" role="status"></div>
  </form>`;
}

/** introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio) */
export function contactIntro(ctx, blocks) {
  return blocksHtml(ctx, blocks.filter((b) => !(b.t === 'p' && /^\s*\./.test(b.h.replace(/<[^>]+>/g, '')))), { demote: 0 });
}
