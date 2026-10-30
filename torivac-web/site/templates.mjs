// [TEMPLATES] Plantillas HTML (funciones puras: datos → string). Cada una devuelve el <main> de su página;
// `layout()` lo envuelve con cabecera, pie, elementos flotantes y scripts.
// Datos: data/catalog/*.json (ver docs/ARQUITECTURA.md). Textos de interfaz: site/lib/i18n.mjs.

import { esc, attr, blocksHtml, inlineHtml, mapLink, plain, fmtDate, hText } from './lib/render.mjs';
import { t, LANGS, countLabel, refLabel } from './lib/i18n.mjs';
import { pageGraph, ldScript, jsonScript, ogLocale, clip } from './lib/seo.mjs';
import { THEMES, themeBootJs } from './lib/themes.mjs';
import { bootData, verifyMeta } from './lib/google.mjs';
import { cookieBlocks, cookieTitle } from './lib/cookies.mjs';
import { FIELDS } from '../shared/plain-text.mjs';

const NAMES = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch' };
/** Valor de un campo traducible en el idioma `lang` (español si falta; '' si no hay objeto). */
const pick = (obj, lang) => (obj && (obj[lang] ?? obj.es)) ?? '';




// ───────────────────────────────────────────────────────────── [ART] piezas gráficas técnicas (SVG propio, sin librerías)
/** Bobinado toroidal visto desde arriba (mismo motivo que el logotipo): 56 espiras que se «dibujan» al entrar en pantalla (CSS + IntersectionObserver en app.js). */
export function toroidArt() {
  const N = 56, R0 = 78, R1 = 168; let turns = '';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, b = a + 0.09, c = (c0, r) => `${(200 + Math.cos(c0) * r).toFixed(1)} ${(200 + Math.sin(c0) * r).toFixed(1)}`;
    turns += `<path class="tt" pathLength="1" style="--i:${i}" d="M${c(a, R0)} C${c(a + 0.02, R0 + 30)} ${c(b - 0.02, R1 - 30)} ${c(b, R1)}"/>`;
  }
  return `<svg class="toroid-art" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="200" cy="200" r="${R0 - 6}" opacity=".5"/><circle cx="200" cy="200" r="${R1 + 6}" opacity=".5"/>${turns}</g></svg>`;
}
/** Osciloscopio esquemático de un variador de tensión: la onda de salida (cobre) se reduce al mover el mando; la de entrada (230 V) queda fija. JS: assets/js/lab.js */
export function waveLab(ctx) {
  const { lang } = ctx;
  const grid = Array.from({ length: 7 }, (_, i) => `<line x1="0" x2="640" y1="${i * 40}" y2="${i * 40}"/>`).join('') + Array.from({ length: 17 }, (_, i) => `<line y1="0" y2="240" x1="${i * 40}" x2="${i * 40}"/>`).join('');
  return `<section class="wave-lab" aria-labelledby="h-lab" data-lab>
  <div class="wl-head"><h2 id="h-lab">${t('lab_title', lang)}</h2><p>${t('lab_hint', lang)}</p></div>
  <div class="wl-grid">
    <svg viewBox="0 0 640 240" role="img" aria-label="${attr(t('lab_aria', lang))}"><g class="wl-grid-lines">${grid}</g><line class="wl-axis" x1="0" x2="640" y1="120" y2="120"/><path class="wl-in" data-wl-in d="M0 120"/><path class="wl-out" data-wl-out-path d="M0 120"/></svg>
    <div class="wl-ctl">
      <label for="wl-range">${t('lab_knob', lang)}</label>
      <input id="wl-range" type="range" min="0" max="230" step="1" value="230" data-wl-range>
      <dl><div><dt>${t('lab_in', lang)}</dt><dd class="mono">230 V ~</dd></div><div><dt>${t('lab_out', lang)}</dt><dd class="mono" data-wl-readout aria-live="polite">230 V ~</dd></div></dl>
      <p class="muted small">${t('lab_note', lang)}</p>
    </div>
  </div>
</section>`;
}

// ───────────────────────────────────────────────────────────── [A11Y] orden de encabezados
/** El contenido original salta de nivel (H1→H4). Se corrige en la ACCESIBILIDAD (aria-level) sin tocar la etiqueta, así el diseño no cambia:
 *  ningún encabezado sube más de un nivel respecto al anterior. */
export function headingOrder(html) {
  let prev = 0;
  return String(html).replace(/<h([1-6])((?:\s[^>]*)?)>/g, (m, lv, attrs = '') => {
    const level = +lv; const eff = prev === 0 ? level : Math.min(level, prev + 1);
    prev = eff;
    if (eff === level || /\saria-level=/.test(attrs)) return m;
    return `<h${lv}${attrs} aria-level="${eff}">`;
  });
}

// ───────────────────────────────────────────────────────────── [META] descripción válida (la web original trae «%» o nada en varias páginas)
/** Usa la descripción original si es útil; si no, el primer párrafo real de la página (sin inventar nada); como último recurso, la descripción de la portada en ese idioma (`fallback`, texto de la web original; sin ella, ninguna). */
export function metaDescription(desc, bodyHtml, fallback = '') {
  // Una descripción sirve si tiene al menos 50 caracteres y no es solo signos o cifras.
  const ok = (d) => d && d.replace(/\s+/g, ' ').trim().length >= 50 && !/^[\W\d_]*$/.test(d);
  if (ok(desc)) return clip(desc, 158);
  for (const m of String(bodyHtml || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const txt = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (txt.length >= 60 && !/^[\W\d_]*$/.test(txt)) return clip(txt, 158);
  }
  return fallback ? clip(fallback, 158) : '';
}

// ───────────────────────────────────────────────────────────── [LAYOUT] envoltorio común
/** Aviso para el demo (solo sin --base): si la página se abre sin sus hojas de estilo (p. ej. index.html dentro del .zip sin extraer), enseña arriba cómo abrirla bien. */
const cssGuard = (msg) => `<script>(function(){try{if(!getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()){var d=document.createElement('div');d.setAttribute('role','alert');d.style.cssText='font:16px/1.5 Arial,sans-serif;background:#ffb653;color:#100404;padding:14px 18px;border-bottom:3px solid #9c520f';d.textContent=${JSON.stringify(msg)};document.body.insertBefore(d,document.body.firstChild);}}catch(e){}})();</script>`;

// ───────────────────────────────────────────────────────────── [THEME] aspecto: «Ficha técnica» (nuevo) o «Clásico» (el original). Ver docs/DISENO-TEMAS.md
/** Script de la cabecera (solo si hay selector de aspecto): aplica ?tema= o la elección guardada ANTES del primer pintado, para que no parpadee el otro aspecto. */
const THEME_BOOT = `<script>${themeBootJs()}</script>`;
/** Fuentes que se precargan en producción según el aspecto por defecto (solo las que se ven en la primera pantalla). */
const PRELOAD_FONTS = { ficha: ['archivo-latin-wght-normal', 'archivo-expanded-latin-wght-normal', 'chivo-mono-latin-wght-normal'], clasico: ['archivo-latin-wght-normal', 'advent-pro-latin-wght-normal'], original: ['archivo-latin-wght-normal', 'advent-pro-latin-wght-normal', 'pt-sans-latin-700-normal'] };

// ───────────────────────────────────────────────────────────── [ORIGINAL] piezas del aspecto «Original» (la web actual de grupotorivac.com)
// Con selector de aspecto, el HTML lleva los elementos de los tres aspectos y cada hoja de estilos muestra los suyos (los del resto, con `display:none`).
// Compilando SOLO «Original» (site.ONLY_O) el HTML sale ya limpio: sin lo que no se ve. Sin «Original» (site.O falso) nada de esto se emite y el HTML es idéntico al de siempre.
/** Clase de un bloque que solo existe en «Original»: con selector lleva `o-only` (la hoja de los otros aspectos lo oculta); compilando solo «Original», va tal cual. */
export const oc = (site, cls = '') => (site.ONLY_O ? cls : `${cls} o-only`.trim());
/** Rótulo que cambia según el aspecto: sin «Original», el de siempre; solo «Original», el de la web actual; con selector, los dos (cada hoja muestra uno). Los textos ya vienen escapados. */
export const lbl = (site, def, orig) => (!site.O ? def : site.ONLY_O ? orig : `<span class="l-n">${def}</span><span class="l-o">${orig}</span>`);
/** Dirección a la que apunta una tarjeta o un enlace de categoría: en «Original» solo, una categoría hoja con UN producto lleva directa a ese producto (la web actual la redirige). */
export const oHref = (site, c, lang) => { const lp = site.ONLY_O && site.leafProduct && site.leafProduct.get(c.id); return lp ? lp.pathFor[lang] : c.pathFor[lang]; };
/** Menú flotante «Productos-Torivac»: pestaña en el borde izquierdo que abre un panel oscuro con las categorías (dos niveles, en el orden de la web actual). Nace oculto: app.js lo muestra (sin JS no serviría). */
function floatMenu(ctx) {
  const { lang, site } = ctx;
  const roots = site.orderPanel.length ? site.orderPanel : site.catTree;
  const items = roots.map((c, i) => {
    const kids = c.children || [], name = esc(pick(c.name, lang));
    return `<li class="torivac-cat-item${kids.length ? ' has-children' : ''}"><div class="cat-row"><a class="cat-name" href="${attr(ctx.href(oHref(site, c, lang)))}">${name}</a>${kids.length ? `<button type="button" class="cat-icon" aria-expanded="false" aria-controls="o-sub-${i}" aria-label="${attr(pick(c.name, lang))}">+</button>` : ''}</div>${kids.length ? `<ul class="torivac-subcat-list" id="o-sub-${i}" hidden>${kids.map((k) => `<li class="torivac-subcat-item"><a href="${attr(ctx.href(oHref(site, k, lang)))}">${esc(pick(k.name, lang))}</a></li>`).join('')}</ul>` : ''}</li>`;
  }).join('');
  return `<div class="${oc(site, 'torivac-floating-sidebar')}" data-o-float hidden>
  <button class="torivac-sidebar-toggle" type="button" aria-expanded="false" aria-controls="o-panel"><span class="label">${esc(t('o_tab', lang))}</span></button>
  <span class="torivac-hint" aria-hidden="true">${esc(t('o_hint', lang))}</span>
  <div class="torivac-sidebar-backdrop" data-o-close></div>
  <div class="torivac-sidebar-panel" id="o-panel" role="dialog" aria-label="${attr(t('o_panel_title', lang))}">
    <button class="torivac-sidebar-close" type="button" data-o-close aria-label="${attr(t('o_close', lang))}">×</button>
    <h3 class="torivac-cat-sidebar-title">${esc(t('o_panel_title', lang))}</h3>
    <ul class="torivac-cat-list"><li class="torivac-cat-item o-shoplink"><div class="cat-row"><a class="cat-name" href="${attr(ctx.href(site.shop[lang]))}">${esc(t('shop', lang))}</a></div></li>${items}</ul>
  </div>
</div>`;
}
/** Selector de aspecto: dos botones con aria-pressed. Nace oculto (sin JS no serviría de nada); assets/js/app.js lo muestra, marca el activo y guarda la elección. `where` distingue el de la cinta y el del pie. */
const themeSwitch = (lang, where) => `<span class="theme-switch" role="group" aria-label="${attr(t('theme', lang))}" data-theme-switch="${where}" hidden><span class="ts-label">${t('theme', lang)}</span>${THEMES.map((k) => `<button type="button" data-set-theme="${k}" aria-pressed="false">${t('theme_' + k, lang)}</button>`).join('')}</span>`;

/** Envuelve `hero` + `body` en la página HTML completa (SEO, cabecera, pie, presupuesto, scripts) y la registra para el sitemap. */
export function layout(ctx, { title, description, body, template, alts = {}, scripts = [], hero = null, ogImage = null, noindex = false, crumbs = null, ld = [], images = [], preloadImage = null, bodyClass = '', oRedirect = '', dyn = false }) {
  const { lang, site } = ctx;
  if (/data-contact-form/.test(`${hero || ''}${body}`)) scripts = [...new Set(['assets/js/plain-text.js', 'assets/js/forms.js', 'assets/js/captcha.js', 'assets/js/contact.js', ...scripts])];          // en cualquier página con formulario de contacto (también el bloque «Contacta con nosotros» de las fichas y entradas de «Original»)
  if (!dyn) description = metaDescription(description, body, site.homeMeta?.[lang]);
  const alt = (l) => (l === lang ? ctx.path : (alts[l] || site.home[l]));         // selector de idioma: sin traducción cae a la portada de ese idioma
  // registro de páginas indexables → sitemap (con hreflang e imágenes) y llms.txt; ver site/build.mjs [SEO-FILES]
  if (!noindex && !dyn && site.registry) site.registry.push({ path: ctx.path, lang, template, title, description: description || '', alts: Object.fromEntries(LANGS.filter((l) => alts[l]).map((l) => [l, alts[l]])), images });
  // [NAV] menú principal: mismos 7 ítems y etiquetas que la web original (por idioma). `section` marca el activo.
  const nav = site.navItems[lang].map((n) => ({ label: n.label, pdf: n.key === 'catalog', shop: n.key === 'shop', current: n.key !== 'catalog' && (n.path === ctx.path || (n.key === ctx.section && ['products', 'blog'].includes(n.key))), href: n.key === 'catalog' ? (n.pdfFile ? ctx.asset('assets/pdf/' + n.pdfFile) : n.pdfUrl) : ctx.href(n.path) }));
  const langLinks = LANGS.map((l) => `<a href="${attr(ctx.href(alt(l)))}" hreflang="${l}" lang="${l}" ${l === lang ? 'aria-current="true"' : ''} title="${NAMES[l]}" data-set-lang="${l}"${l !== lang && !alts[l] ? ' class="no-tr"' : ''}>${l.toUpperCase()}</a>`).join('');
  const navHtml = nav.map((n) => `<a href="${attr(n.href)}"${n.shop ? ' class="o-skip"' : ''}${n.current ? ' aria-current="page"' : ''}${n.pdf ? ' target="_blank" rel="noopener"' : ''}>${esc(n.label)}</a>`).join('');
  const f = site.footer[lang];
  // hreflang: SOLO idiomas con traducción real de ESTA página (un hreflang a la portada de otro idioma es un error de SEO)
  const hreflangs = LANGS.filter((l) => l === lang || alts[l]);
  const alternates = site.absBase && hreflangs.length > 1 ? hreflangs.map((l) => `<link rel="alternate" hreflang="${l}" href="${attr(site.absBase + alt(l))}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${attr(site.absBase + (hreflangs.includes('es') ? alt('es') : alt(hreflangs[0])))}">` : '';
  // [SOCIAL] Open Graph + Twitter. og:image: la de la página o, si no hay, el logotipo (siempre absoluto: las redes no entienden rutas relativas).
  const ogImg = site.absBase ? (ogImage || site.absBase + '/' + site.logo.replace(/^\//, '')) : null;
  const ogDesc = clip(description || title, 200);
  const social = [`<meta property="og:title" content="${attr(title)}">`, `<meta property="og:description" content="${attr(ogDesc)}">`, '<meta property="og:type" content="' + (template === 'post' ? 'article' : template === 'product' ? 'product' : 'website') + '">', `<meta property="og:site_name" content="Torivac">`, `<meta property="og:locale" content="${ogLocale(lang)}">`,
    site.absBase ? `<meta property="og:url" content="${attr(site.absBase + ctx.path)}">` : '', ogImg ? `<meta property="og:image" content="${attr(ogImg)}">` : '', `<meta name="twitter:card" content="${ogImg ? 'summary_large_image' : 'summary'}">`].filter(Boolean).join('');
  const canonical = site.absBase ? `<link rel="canonical" href="${attr(site.absBase + ctx.path)}">` : '';
  return `<!doctype html>
<html lang="${lang}" data-lang="${lang}" data-theme="${site.theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description || '')}">
${noindex || site.staging ? '<meta name="robots" content="noindex,nofollow">' : ''}
${site.google ? verifyMeta(site.google) : ''}
${dyn ? '@@TV:links@@' : canonical + alternates}
<meta name="theme-color" content="#100404">
<link rel="icon" href="${ctx.asset('assets/img/favicon.png')}" type="image/png">
${site.themeSwitch ? THEME_BOOT : ''}
${site.absBase ? PRELOAD_FONTS[site.theme].map((f) => `<link rel="preload" href="${ctx.asset(`assets/fonts/${f}.woff2`)}" as="font" type="font/woff2" crossorigin>`).join('') : ''}${preloadImage ? `<link rel="preload" href="${attr(preloadImage)}" as="image" fetchpriority="high">` : ''}<link rel="stylesheet" href="${ctx.asset('assets/css/site.css')}">
${dyn ? '@@TV:social@@' : social}
${dyn ? '@@TV:ld@@' : noindex ? '' : ldScript(pageGraph(ctx, { template, title, description, crumbs, extra: ld, image: ogImg }))}
</head>
<body class="tv tv-${template}${bodyClass ? ' ' + bodyClass : ''}" data-path="${dyn ? '@@TV:path@@' : attr(ctx.path)}"${oRedirect ? ` data-o-redirect="${attr(ctx.href(oRedirect))}"` : ''}>
<a class="skip" href="#content">${t('skip', lang)}</a>
${site.google?.active && !dyn404(template) ? cookieBar(ctx) : ''}
${site.absBase ? '' : cssGuard(t('css_missing', lang))}
${site.demo ? `<div class="demo-ribbon no-print" role="region" aria-label="${attr(t('demo_banner', lang))}"><span>${t('demo_banner', lang)} · ${t('demo_prices', lang)}</span>${site.themeSwitch ? themeSwitch(lang, 'ribbon') : ''}</div>` : ''}
${site.staging ? `<div class="demo-ribbon no-print" role="region" aria-label="${attr(t('staging_banner', lang))}"><span>${t('staging_banner', lang)}</span>${site.themeSwitch ? themeSwitch(lang, 'ribbon') : ''}</div>` : ''}
<div class="lang-banner no-print" id="lang-banner" role="region" aria-label="${attr(t('language', lang))}" hidden><div class="container"><span data-lang-msg></span><a class="btn sm" href="#" data-lang-go></a><button class="btn sm ghost" type="button" data-lang-keep>${t('lang_dismiss', lang)}</button></div></div>
<header class="site-header no-print" id="site-header">
  <div class="container bar">
    <a class="brand" href="${attr(ctx.href(site.home[lang]))}" aria-label="Torivac"><img src="${ctx.asset(site.logo)}" alt="Torivac" width="54" height="54"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav" data-menu-toggle>☰ ${t('menu', lang)}</button>
    <nav class="nav" id="main-nav" aria-label="${attr(t('menu', lang))}">${navHtml}<a class="btn sm header-quote" href="${attr(ctx.href(site.quote[lang]))}" data-quote-link>${t('quote', lang)} <span class="count" data-quote-count>0</span></a></nav>
    <div class="lang" role="group" aria-label="${attr(t('language', lang))}">${dyn ? '@@TV:langlinks@@' : langLinks}</div>
  </div>
</header>
<main id="content" tabindex="-1">
${headingOrder(`${hero || ''}${body}`)}
</main>
<footer class="site-footer on-dark">
  <div class="container">
    <div class="logo-row"><img src="${ctx.asset(site.logo)}" alt="Torivac" width="84" height="84" loading="lazy"></div>
    <div class="facts">
      <span class="fact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 21V5l9-2v18M13 8h7v13M4 21h16M7 8h3M7 12h3M7 16h3M16 12h1M16 16h1"/></svg><span>${site.meta.contact.address.map(esc).join('<br>')}</span></span>
      <a class="fact" href="tel:${attr(site.meta.contact.phone.replace(/\s/g, ''))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>${esc(site.meta.contact.phone)}</a>
      <a class="fact" href="mailto:${attr(site.meta.contact.email)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg>${esc(site.meta.contact.email)}</a>
    </div>
    <p class="legal">${esc(f.copyright)} ${f.links.map((l) => `<a href="${attr(l.path ? ctx.href(l.path) : l.href)}">${esc(l.label)}</a>`).join(' | ')}${site.google?.active ? ` | <button class="linklike" type="button" data-cookie-settings hidden>${esc(t('cookie_settings', lang))}</button>` : ''}<br>${esc(f.devBy)} <a href="https://santisomarketing.com/" target="_blank" rel="noopener">Santiso Marketing</a></p>
    ${site.themeSwitch ? `<div class="theme-row no-print">${themeSwitch(lang, 'footer')}</div>` : ''}
    <div class="funding"><img src="${ctx.asset(site.funding[lang].img)}" alt="Cofinanciado por la Unión Europea · Ministerio de Hacienda · Fondos Europeos" width="${site.funding[lang].w}" height="${site.funding[lang].h}" loading="lazy">${site.O ? `<span class="${oc(site, 'o-li')}" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" focusable="false"><rect x="1" y="1" width="22" height="22" rx="3"/><g class="in"><circle cx="7.4" cy="7.6" r="1.7"/><rect x="5.9" y="10.2" width="3" height="8"/><path d="M11.2 10.2h2.9v1.1c.5-.8 1.5-1.3 2.7-1.3 2.3 0 3.1 1.5 3.1 3.6v4.6h-3v-4.1c0-1-.3-1.7-1.3-1.7-1.1 0-1.5.8-1.5 1.8v4h-2.9z"/></g></svg></span>` : ''}<p>${esc(f.funding)}</p></div>
  </div>
</footer>
${site.O && ['shop', 'product'].includes(template) ? floatMenu(ctx) : ''}
<div class="fab-stack no-print">
  <button class="fab fab-top" type="button" data-top aria-label="${attr(t('back_to_top', lang))}">↑</button>
  ${template === 'quote' ? '' : `<button class="fab fab-quote" type="button" data-open-quote aria-haspopup="dialog" aria-controls="quote-drawer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>${t('quote', lang)} <span class="count" data-quote-count>0</span></button>`}
</div>
<div class="scrim" data-scrim></div>
<aside class="quote-drawer no-print" id="quote-drawer" role="dialog" aria-modal="true" aria-label="${attr(t('quote_yours', lang))}" aria-hidden="true">
  <header><h2>${t('quote_yours', lang)}</h2><button class="icon-btn" type="button" data-close-quote aria-label="×">×</button></header>
  <div class="body" data-drawer-body></div>
  <footer data-drawer-foot></footer>
</aside>
<div class="toast" role="status" aria-live="polite" data-toast></div>
${dyn ? '<script type="application/json" id="tv-boot">@@TV:boot@@</script>' : jsonScript('tv-boot', { lang, paths: { quote: ctx.href(site.quote[lang]), home: Object.fromEntries(LANGS.map((l) => [l, ctx.href(alt(l))])) } })}
<script src="${ctx.asset('assets/data/catalog.js')}"></script>
<script src="${ctx.asset('assets/data/prices.js')}"></script>
<script src="${ctx.asset('assets/js/quote.js')}"></script>
<script src="${ctx.asset('assets/js/app.js')}"></script>
${site.google?.active ? `${jsonScript('tv-google', bootData(site.google))}\n<script src="${ctx.asset('assets/js/consent.js')}"></script>\n` : ''}${scripts.map((s) => `<script src="${ctx.asset(s)}"></script>`).join('\n')}
</body>
</html>`;
}

// ───────────────────────────────────────────────────────────── [COOKIES] aviso de cookies y política (solo con IDs de Google, ver site/lib/google.mjs)
/** Las páginas de error no llevan aviso (se sirven en cualquier profundidad y no miden nada). */
const dyn404 = (template) => template === 'notfound';
/**
 * Aviso de cookies: banda inferior sin bloquear la página, con «Rechazar todas» y «Aceptar todas» con el mismo peso visual y «Configurar» para elegir por categoría.
 * Va en el HTML (oculto): sin JavaScript no se muestra y tampoco se mide nada. Solo salen las categorías que están configuradas (Estadísticas = GA4, Publicidad = Ads). Lo maneja assets/js/consent.js.
 */
export function cookieBar(ctx) {
  const { lang, site } = ctx, g = site.google, rt = !!g.runtime;
  const policy = site.cookies?.[lang] ? `<a href="${attr(ctx.href(site.cookies[lang]))}">${esc(t('cookie_more', lang))}</a>` : '';
  /** Casilla de una categoría opcional del aviso (a = estadísticas, p = publicidad) con su explicación. */
  const row = (cat, k) => `<label class="cookie-row"><input type="checkbox" data-cat="${cat}"><span><b>${esc(t(k, lang))}</b> ${esc(t(k + '_d', lang))}</span></label>`;
  /** Párrafo del aviso (`both` = estadísticas y publicidad · `stats` = solo estadísticas); en runtime salen los dos y consent.js deja visible el que toca. */
  const text = (kind, k, on) => `<p data-cookie-text="${kind}"${on ? '' : ' hidden'}>${esc(t(k, lang))} ${policy}</p>`;
  return `<div class="cookie-bar no-print" id="tv-cookies" role="region" aria-label="${attr(t('cookie_region', lang))}" data-saved="${attr(t('cookie_saved', lang))}" hidden>
  <div class="container cookie-in">
    <div class="cookie-txt"><p class="cookie-title">${esc(t('cookie_title', lang))}</p>${rt ? text('both', 'cookie_text', !!g.ads) + text('stats', 'cookie_text_stats', !g.ads) : text(g.ads ? 'both' : 'stats', g.ads ? 'cookie_text' : 'cookie_text_stats', true)}</div>
    <div class="cookie-set" id="tv-cookies-set" hidden>
      <label class="cookie-row"><input type="checkbox" checked disabled><span><b>${esc(t('cookie_necessary', lang))}</b> ${esc(t('cookie_necessary_d', lang))}</span></label>
      ${rt || g.ga4 ? row('a', 'cookie_stats') : ''}${rt || g.ads ? row('p', 'cookie_ads') : ''}
    </div>
    <div class="cookie-btns">
      <button class="btn" type="button" data-cookie="reject">${esc(t('cookie_reject', lang))}</button>
      <button class="btn" type="button" data-cookie="accept">${esc(t('cookie_accept', lang))}</button>
      <button class="btn ghost" type="button" data-cookie="config" aria-expanded="false" aria-controls="tv-cookies-set">${esc(t('cookie_config', lang))}</button>
      <button class="btn" type="button" data-cookie="save" hidden>${esc(t('cookie_save', lang))}</button>
    </div>
  </div>
</div>`;
}
/** Convierte [texto](destino) de los textos de la política en enlaces: legal/privacy → los del pie del idioma; https://… → externo. Todo lo demás se escapa. */
function policyInline(ctx, text) {
  const f = ctx.site.footer[ctx.lang].links;
  const dest = { legal: f[0]?.href, privacy: f[1]?.href };
  return esc(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, to) => {
    const href = dest[to] || (/^https:\/\//.test(to) ? to : '');
    return href ? `<a href="${attr(href)}"${/^https:\/\/(?!grupotorivac\.com)/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>` : label;
  });
}
/** Página «Política de cookies»: { hero, body, title } como genericPage. Lo que lista depende de lo configurado (cookieBlocks). */
export function cookiePage(ctx, title) {
  const { lang, site } = ctx, g = site.google || {}, rt = !!g.runtime;
  const seed = { a: !!g.ga4, p: !!g.ads };
  /** ¿Se ve ahora una sección etiquetada `sec`, según lo configurado al compilar? (consent.js la corrige después con los ajustes del servidor). */
  const on = (sec) => ({ a: seed.a, p: seed.p, any: seed.a || seed.p, none: !(seed.a || seed.p) }[sec]);
  const blocks = cookieBlocks(lang, { ga4: !!g.active && !!g.ga4, ads: !!g.active && !!g.ads, themeSwitch: !!site.themeSwitch, all: rt });
  const lead = blocks.find((b) => b.t === 'lead');
  /** Atributos de una sección etiquetada (solo en runtime): `data-cookie-sec` y, si no toca, `hidden`. */
  const at = (sec) => (rt && sec ? ` data-cookie-sec="${sec}"${on(sec) ? '' : ' hidden'}` : '');
  const html = blocks.filter((b) => b.t !== 'lead').map((b) => {
    if (b.t === 'h2' || b.t === 'h3') return `<${b.t}${at(b.sec)}>${esc(b.x)}</${b.t}>`;
    if (b.t === 'p') return `<p${at(b.sec)}>${policyInline(ctx, b.x)}</p>`;
    return `<div class="tbl-wrap"${at(b.sec)} tabindex="0" role="region" aria-label="${attr(b.cols.join(' · '))}"><table class="spec cookie-table"><thead><tr>${b.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr${at(r[4])}>${r.slice(0, 4).map((c, i) => (i === 0 ? `<th scope="row">${c.split(', ').map((n) => `<code>${esc(n)}</code>`).join('<br>')}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }).join('\n');
  return {
    title, description: lead ? lead.x : '',
    hero: `<section class="page-hero bp"><div class="container">${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(site.home[lang]) }, { label: title }])}<h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead.x)}</p>` : ''}</div></section>`,
    body: `<section class="sec"><div class="container prose cookie-doc">${html}</div></section>`,
  };
}
export { cookieTitle };

// ───────────────────────────────────────────────────────────── [SHARED] migas, etiquetas de tensión, tarjeta de producto
/** Migas de pan (nav + ol): todas enlazadas salvo la última, que lleva aria-current=page. */
export const crumbs = (ctx, items) => `<nav aria-label="breadcrumb"><ol class="crumbs">${items.map((i, k) => `<li>${i.href && k < items.length - 1 ? `<a href="${attr(i.href)}">${esc(i.label)}</a>` : `<span${k === items.length - 1 ? ' aria-current="page"' : ''}>${esc(i.label)}</span>`}</li>`).join('')}</ol></nav>`;

/** Texto de un campo traducible (objeto por idioma o cadena) en el idioma `lang`, con respaldo al español. */
const vtext = (x, lang) => (x && typeof x === 'object' ? x[lang] || x.es : x) || '';
/** Fila de etiquetas de tensión (hasta `limit`) de un producto; '' si no hay ninguna conocida. */
export function vtags(site, ids = [], limit = 6, lang = 'es') {
  const out = ids.slice(0, limit).map((id) => {
    const v = site.vtags.get(id);
    if (!v) return '';
    const kind = v.kind === 'dc' ? ' dc' : v.kind === 'range' ? ' range' : v.kind === 'three-phase' ? ' three' : '';
    return `<span class="vtag${kind}" title="${attr(vtext(v.title, lang) || vtext(v.label, lang))}">${esc(vtext(v.label, lang))}</span>`;
  }).join('');
  return out ? `<div class="vtag-row">${out}</div>` : '';
}

/** Tarjeta de un producto del listado: foto, nombre, etiquetas de tensión y nº de referencias, con data-* para filtrar. */
export function productCard(ctx, p) {
  const lang = ctx.lang;
  const name = pick(p.name, lang);
  const im = p.images[0];
  const cats = p.category_ids.join(',');
  const nVar = p.variants.length;
  return `<a class="pcard" href="${attr(ctx.href(p.pathFor[lang]))}" data-pid="${p.id}" data-cats="${cats}" data-v="${(p.voltage_tags || []).join(',')}" data-q="${attr((name + ' ' + p.variants.map((v) => v.ref).join(' ')).toLowerCase())}">
  <div class="ph">${im ? `<img src="${attr(ctx.thumb(im))}" alt="${attr(pick(im.alt, lang) || name)}" loading="lazy" decoding="async" width="${im.w ? Math.min(480, im.w) : 480}" height="${im.h ? Math.round(Math.min(480, im.w || 480) * (im.h / (im.w || 1))) : 480}">` : ''}</div>
  <div class="tx"><h3>${esc(name)}</h3>${vtags(ctx.site, p.voltage_tags, 3, lang)}<div class="meta"><span>${nVar ? refLabel(nVar, lang) : ''}</span><span class="go">${t('view_product', lang)} →</span></div></div>
</a>`;
}

/** árbol de categorías para la barra lateral. HTML plano (visible sin JS); app.js lo pliega y añade botones accesibles (aria-expanded).
 *  La rama de la categoría activa queda abierta (data-open). */
export function catTree(ctx, activeId = null) {
  const lang = ctx.lang;
  // Indica si la categoría `c` es la activa o contiene a la activa entre sus descendientes.
  const holds = (c) => c.id === activeId || c.children.some(holds);
  // Enlace a una categoría con su nombre y su nº de productos; marca aria-current si es la activa.
  const link = (c) => `<a href="${attr(ctx.href(c.pathFor[lang]))}"${c.id === activeId ? ' aria-current="page"' : ''}><span>${esc(pick(c.name, lang))}</span><span class="n">${c.total}</span></a>`;
  // Lista anidada del árbol de categorías; abre (data-open) las ramas que contienen la activa.
  const walk = (nodes) => `<ul>${nodes.map((c) => c.children.length
    ? `<li class="has-kids"${holds(c) ? ' data-open' : ''}>${link(c)}${walk(c.children)}</li>`
    : `<li>${link(c)}</li>`).join('')}</ul>`;
  return `<nav aria-label="${attr(t('categories', lang))}"><div class="cat-tree" data-tree>${walk(ctx.site.catTree)}</div></nav>`;
}

/** Texto recortado a `max` caracteres en el último espacio (sin partir palabras) y con «…» si se ha recortado; `max` Infinity = íntegro. */
const cut = (txt, max) => { if (txt.length <= max) return txt; const k = txt.lastIndexOf(' ', max); return txt.slice(0, k > max * 0.6 ? k : max).replace(/[\s,;:.]+$/, '') + '…'; };
/** tarjetas de categorías de primer nivel (página "Productos"): imagen, nombre y arranque de su descripción original */
export function categoryCards(ctx, list = null, opts = {}) {
  const { lang, site } = ctx;
  let nodes = list || site.catTree;
  // «Original»: las tarjetas salen en el orden de la web actual (portada de Productos: sus 11 categorías; categoría: sus subcategorías). Con selector, el orden va en --o-i y lo aplica la hoja de «Original»; solo «Original», se ordena aquí.
  let rank = null;
  if (site.O) {
    const order = list ? (site.orderSub.get(opts.parent && opts.parent.id) || []) : site.orderShop;
    rank = new Map(nodes.map((c, i) => { const k = order.indexOf(c); return [c, k >= 0 ? k : (list ? order.length + i : -1)]; }));
    if (site.ONLY_O) { nodes = nodes.filter((c) => rank.get(c) >= 0).sort((a, b) => rank.get(a) - rank.get(b)); }
  }
  const limit = opts.limit === 0 ? Infinity : (opts.limit || 140);   // limit 0 = texto íntegro (páginas de categoría: la original muestra la descripción completa)
  const cards = nodes.map((c) => {
    const desc = (c.description[lang] || c.description.es || []).find((b) => b.t === 'p');
    let txt = desc ? desc.h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
    // algunas descripciones originales son copia de otra categoría (ver docs/01-analisis/HALLAZGOS.md #3): en la tarjeta solo se usa si comparte alguna palabra significativa con el nombre
    // sin tildes en la comparación («Nucleos» ↔ «núcleos»)
    const fold = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const words = fold(pick(c.name, lang) || '').split(/[^a-zñüçß]+/).filter((w) => w.length > 4).map((w) => w.slice(0, 6));
    if (opts.guard && txt && words.length && !words.some((w) => fold(txt).includes(w))) txt = '';
    const im = c.image || site.prodById.get(c.firstProduct)?.images?.[0];
    const oi = rank ? (rank.get(c) >= 0 ? ` style="--o-i:${rank.get(c)}"` : '') : '';
    const skip = rank && rank.get(c) < 0 ? ' o-skip' : '';          // sin sitio en el orden de la web actual (p. ej. «Equipos electrónicos» en la portada): solo existe en los otros aspectos (la hoja de «Original» lo oculta)
    return `<a class="ccard${skip}"${oi} href="${attr(ctx.href(oHref(site, c, lang)))}"><div class="ph">${im ? `<img src="${attr(ctx.thumb(im))}" alt="" loading="lazy" decoding="async">` : ''}</div><div class="tx"><h3>${esc(pick(c.name, lang))}</h3>${txt ? `<p>${esc(cut(txt, limit))}</p>` : ''}<span class="meta"><span>${countLabel(c.total, lang)}</span><span class="go">${lbl(site, esc(t('view_category', lang)) + ' →', esc(t('o_more', lang)) + ' ›')}</span></span></div></a>`;
  }).join('');
  return `<h2 class="${opts.heading ? 'sub-h' : 'sr-h'}">${opts.heading || t('categories', lang)}</h2><div class="ccards${opts.long ? ' long' : ''}">${cards}</div>`;
}

// ───────────────────────────────────────────────────────────── [HOME]
/** «Original»: atributo style con la foto de fondo de una sección (los trazos del logotipo de la web actual), en una variable que solo pinta la hoja de ese aspecto. Una URL dentro de una variable se resuelve desde la hoja que la usa (assets/css/site.css), de ahí «../media/…» y no la ruta de la página. */
const oSecImg = (site, sec) => (site.O && sec.bg?.file ? ` style="--o-sec-img:url('${attr(sec.bg.file.replace(/^assets\//, '../'))}')"` : '');
/** Portada: devuelve { hero, body, heroImg } con el hero, cinco secciones (fotos, servicios, catálogo), el formulario de contacto y la URL de la foto de portada (se precarga en la cabecera: es el elemento más grande de la primera pantalla). */
export function homeBody(ctx, page) {
  const { lang, site } = ctx;
  const S = page.sections;
  // Bloques de título y párrafo de una sección (hoy sin uso en homeBody).
  const text = (sec) => sec.blocks.filter((b) => b.t === 'h' || b.t === 'p');
  // Bloques de imagen de una sección.
  const imgs = (sec) => sec.blocks.filter((b) => b.t === 'img');
  // Primer bloque de botón de una sección (undefined si no tiene).
  const btn = (sec) => sec.blocks.find((b) => b.t === 'btn');
  const heroSec = S[0];
  const h1 = heroSec.blocks.find((b) => b.t === 'h');
  const heroBg = heroSec.bg ? ctx.img(heroSec.bg) : '';
  const heroParas = heroSec.blocks.filter((b) => b.t === 'p');
  const heroBtn = btn(heroSec);
  // «Original»: clase que engancha cada sección de la portada con la hoja de la web actual (sin «Original» no se emite y el HTML sale idéntico)
  const oh = (cls) => (site.O ? ` ${cls}` : '');
  // «Original»: variable con la foto de fondo de una sección de la portada.
  const oBg = (sec) => oSecImg(site, sec);
  const hero = `<section class="hero bp${oh('o-hero')}" style="${heroBg ? `background-image:url('${attr(heroBg)}')` : ''}" aria-labelledby="h-hero">
  <div class="container"><h1 id="h-hero">${esc(h1?.x || '')}</h1>${heroParas.map((p) => `<p>${inlineHtml(ctx, p.h)}</p>`).join('')}
  <div class="actions">${heroBtn ? `<a class="btn" href="${attr(mapLink(ctx, heroBtn.href))}">${esc(heroBtn.x)}</a>` : ''}${site.ONLY_O ? '' : `<a class="btn ghost${oh('o-skip')}" href="${attr(ctx.href(site.quote[lang]))}">${t('quote', lang)} →</a>`}</div></div>
  ${heroBg && !site.ONLY_O ? `<div class="hero-fig" aria-hidden="true"><div class="hero-img" style="background-image:url('${attr(heroBg)}')"></div></div>` : ''}
  ${site.ONLY_O ? '' : waveSvg()}
</section>`;
  const s1 = S[1], s2 = S[2], s3 = S[3], s4 = S[4], s5 = S[5];
  // HTML del antetítulo (encabezado de nivel 4 o más) y del título h2 (nivel 3 o menos) de una sección.
  const eyebrowAndHead = (sec) => {
    const hs = sec.blocks.filter((b) => b.t === 'h');
    const eb = hs.find((h) => h.l >= 4), main = hs.find((h) => h.l <= 3);
    return `${eb ? `<p class="eyebrow">${esc(eb.x)}</p>` : ''}${main ? `<h2>${hText(site, main)}</h2>` : ''}`;
  };
  // HTML de los párrafos de una sección, con los enlaces internos reescritos.
  const paras = (sec) => sec.blocks.filter((b) => b.t === 'p').map((p) => `<p>${inlineHtml(ctx, p.h)}</p>`).join('');
  // Enlace-botón (clase btn + `cls`) del botón de una sección; '' si no tiene.
  const bt = (sec, cls = '') => { const b = btn(sec); return b ? `<a class="btn ${cls}" href="${attr(mapLink(ctx, b.href))}">${esc(b.x)}</a>` : ''; };
  const im1 = imgs(s1)[0] || (site.homeEs ? imgs(site.homeEs.sections[1])[0] : undefined);   // en la web actual la portada traducida no trae la foto de «Fabricación a medida»: se usa la del castellano (es la misma foto)
  const sec1 = `<section class="sec${oh('o-fab')}"><div class="container split">
    <figure class="photo-frame crop">${im1 ? `<img src="${attr(ctx.img(im1.img))}" alt="${attr(im1.alt || '')}" loading="lazy" width="${im1.img?.w || 768}" height="${im1.img?.h || 512}">` : ''}</figure>
    <div>${eyebrowAndHead(s1)}${paras(s1)}${bt(s1)}</div></div></section>`;
  // «Original»: la web actual enseña un carrusel de una foto cada vez; aquí sale la primera (grande) y, con selector de aspecto, las demás las oculta su hoja
  const car2 = imgs(s2).slice(0, site.ONLY_O ? 1 : undefined).map((i, k) => `<img src="${attr(site.O && k === 0 ? ctx.img(i.img) : ctx.thumb(i.img))}" alt="${attr(i.alt || '')}" loading="lazy">`).join('');
  const s2h = s2.blocks.filter((b) => b.t === 'h');
  const sec2 = `<section class="sec alt art-host${oh('o-mfg')}"${oBg(s2)}>${site.ONLY_O ? '' : toroidArt()}<div class="container"><h2 class="center">${esc(s2h.find((h) => h.l <= 3)?.x || '')}</h2>
    <div class="split"><div class="card-shadow"><h3>${esc(s2h.find((h) => h.l >= 4)?.x || '')}</h3>${paras(s2)}${bt(s2)}</div><div class="photo-grid" aria-label="Fotos">${car2}</div></div></div></section>`;
  const tiles = page.services.map((c) => `<a class="tile" href="${attr(mapLink(ctx, c.href))}"><img src="${attr(ctx.img(c.icon))}" alt="" loading="lazy" width="92" height="92"><span>${esc(c.title)}</span></a>`).join('');
  // «Original»: la web actual cierra la rejilla de servicios con una foto que ocupa dos casillas
  const s3img = site.O ? imgs(s3)[0] : null;
  const tilePhoto = s3img ? `<span class="${oc(site, 'tile tile-photo')}"><img src="${attr(ctx.img(s3img.img))}" alt="${attr(s3img.alt || '')}" loading="lazy" width="${s3img.img?.w || 568}" height="${s3img.img?.h || 284}"></span>` : '';
  const sec3 = `<section class="sec tight${oh('o-serv')}"><div class="container">${eyebrowAndHead(s3)}<div class="tiles">${tiles}${tilePhoto}</div></div></section>`;
  const cat = site.meta.catalogHref[lang];
  const catTxt = esc(btn(s4)?.x || t('catalog_dl', lang));
  const sec4 = `<section class="sec tight dark on-dark bp${oh('o-cat')}"><div class="container split"><div>${eyebrowAndHead(s4)}${paras(s4)}</div><div class="center"><a class="btn" href="${attr(cat.local ? ctx.asset('assets/pdf/' + cat.file) : cat.url)}" target="_blank" rel="noopener">${lbl(site, `⬇ ${catTxt}`, `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5M12 10v7m-3-3 3 3 3-3"/></svg>${catTxt}`)}</a></div></div></section>`;
  const car5 = imgs(s5).slice(0, site.ONLY_O ? 1 : undefined).map((i, k) => `<img src="${attr(site.O && k === 0 ? ctx.img(i.img) : ctx.thumb(i.img))}" alt="${attr(i.alt || '')}" loading="lazy">`).join('');
  const s5h = s5.blocks.filter((b) => b.t === 'h');
  const sec5 = `<section class="sec${oh('o-pres')}"${oBg(s5)}><div class="container"><div class="photo-grid wide" aria-label="Fotos">${car5}</div>
    <div class="card-shadow" style="margin-top:var(--s-6)"><h2>${esc(s5h.find((h) => h.l <= 3)?.x || '')}</h2>${site.O ? '<div class="cs-body">' : ''}<h3>${esc(s5h.find((h) => h.l >= 4)?.x || '')}</h3>${paras(s5)}${site.O ? '</div>' : ''}</div></div></section>`;   // «Original»: el título va fuera del recuadro blanco (cs-body) y los otros aspectos no ven la diferencia
  const s6 = S[6];
  const s6h = s6.blocks.filter((b) => b.t === 'h');
  const contact = `<section class="sec alt${oh('o-contact')}" id="contacto"><div class="container split" style="align-items:start"><div><p class="eyebrow">${esc(s6h.find((h) => h.l >= 4)?.x || '')}</p><h2>${hText(site, s6h.find((h) => h.l <= 3))}</h2>${paras({ blocks: s6.blocks.filter((b) => b.t === 'p' && !/reCAPTCHA|^\./.test(b.h)).slice(0, 1) })}</div>${contactForm(ctx, 'home')}</div></section>`;
  return { hero, body: `${sec1}${sec2}${sec3}${sec4}${sec5}${contact}`, heroImg: heroBg };
}

/** onda de tensión animada (SVG) — elemento gráfico base del hero */
export const waveSvg = () => `<svg class="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <g class="w w1"><path d="M0 45 Q 90 -5 180 45 T 360 45 T 540 45 T 720 45 T 900 45 T 1080 45 T 1260 45 T 1440 45 T 1620 45 T 1800 45 T 1980 45 T 2160 45 T 2340 45 T 2520 45 T 2700 45 T 2880 45" fill="none" stroke="#f0a259" stroke-width="1.6" opacity=".9"/></g>
  <g class="w w2"><path d="M0 45 Q 60 5 120 45 T 240 45 T 360 45 T 480 45 T 600 45 T 720 45 T 840 45 T 960 45 T 1080 45 T 1200 45 T 1320 45 T 1440 45 T 1560 45 T 1680 45 T 1800 45 T 1920 45 T 2040 45 T 2160 45 T 2280 45 T 2400 45 T 2520 45 T 2640 45 T 2760 45 T 2880 45" fill="none" stroke="#ffb653" stroke-width="1" opacity=".55"/></g>
  <g class="w w3"><path d="M0 45 Q 120 -25 240 45 T 480 45 T 720 45 T 960 45 T 1200 45 T 1440 45 T 1680 45 T 1920 45 T 2160 45 T 2400 45 T 2640 45 T 2880 45" fill="none" stroke="#fff" stroke-width=".8" opacity=".3"/></g>
</svg>`;

// ───────────────────────────────────────────────────────────── [PAGES] páginas genéricas (empresa, proyectos, legales)
/** «Original»: bloques de una sección de tarjetas (Misión, Visión, Valores…) con cada icono y el texto que le sigue dentro de su propia tarjeta; lo que va antes del primer icono (título) queda fuera. Los otros aspectos ven el mismo flujo, solo con un div más. */
function cardsHtml(ctx, blocks) {
  // Indica si el bloque es un icono pequeño (60 × 60) y no una foto.
  const isIcon = (b) => b.t === 'img' && b.img && b.img.w && b.img.w <= 160;
  const k = blocks.findIndex(isIcon);
  if (k < 0) return blocksHtml(ctx, blocks, { demote: 0 });
  const groups = [];
  for (const b of blocks.slice(k)) { if (isIcon(b)) groups.push([b]); else groups[groups.length - 1].push(b); }
  return `${blocksHtml(ctx, blocks.slice(0, k), { demote: 0 })}<div class="o-card-row">${groups.map((g) => `<div class="o-card">${blocksHtml(ctx, g, { demote: 0 })}</div>`).join('')}</div>`;
}

/** Secciones de una página genérica en HTML (texto, foto o carrusel, fondo oscuro, formulario de contacto), alternando el fondo. Con «Original», cada sección lleva además clases según cómo la maqueta la web actual (site.oSections, por id de sección de Elementor, igual en los cuatro idiomas). */
export function sectionsHtml(ctx, page) {
  const { site } = ctx;
  return page.sections.map((s, i) => {
    const oh = (site.O && site.oSections.get(s.id)) || {};                       // cómo la maqueta la web actual: kind (photo-text, card-photo, photo-card, cards, dark-cta, dark-photo), photo (left|right), title (el h2 va centrado sobre las dos columnas), art (trazos del logotipo)
    // Clases de la sección: las de siempre y, con «Original», las del tipo, el lado de la foto y el arte de fondo.
    const cls = (base) => (site.O && oh.kind ? `${base} o-sec o-${oh.kind}${oh.photo ? ' o-photo-' + oh.photo : ''}${oh.art ? ' o-art-' + oh.art : ''}` : base);
    const art = oh.art ? oSecImg(site, { bg: oh.artImg ? { file: oh.artImg } : s.bg }) : '';
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
      const only1 = site.ONLY_O && oh.kind;                                   // «Original» solo: la web actual enseña un carrusel de una foto cada vez; aquí sale la primera
      const gal = imgs.length > 1 && !only1 ? `<div class="carousel" tabindex="0">${imgs.map((b) => `<img src="${attr(ctx.thumb(b.img))}" alt="${attr(b.alt || '')}" loading="lazy">`).join('')}</div>` : `<figure class="photo-frame crop"><img src="${attr(ctx.img(imgs[0].img))}" alt="${attr(imgs[0].alt || '')}" loading="lazy"></figure>`;
      let prose = blocksHtml(ctx, rest, { demote: 0 });
      if (site.O && oh.kind) {
        // «Original»: el título h2 va fuera del recuadro (centrado sobre las dos columnas) y el resto, dentro de `o-box`; los otros aspectos solo ven un div más
        const k = oh.title ? rest.findIndex((b) => b.t === 'h' && b.l <= 3) : -1;
        const head = k >= 0 ? blocksHtml(ctx, [rest[k]], { demote: 0 }) : '';
        prose = `${head}<div class="o-box">${blocksHtml(ctx, k >= 0 ? rest.filter((_, j) => j !== k) : rest, { demote: 0 })}</div>`;
      }
      return `<section class="${cls(`sec${i % 2 ? ' alt' : ''}`)}"${art}><div class="container split${i % 2 ? ' rev' : ''}">${gal}<div class="prose">${prose}</div></div></section>`;
    }
    if (hasImg) return `<section class="sec tight"><div class="container"><div class="carousel" tabindex="0">${imgs.map((b) => `<img src="${attr(ctx.thumb(b.img))}" alt="${attr(b.alt || '')}" loading="lazy">`).join('')}</div></div></section>`;
    const flow = site.O && oh.kind === 'cards' ? cardsHtml(ctx, s.blocks) : blocksHtml(ctx, s.blocks, { demote: 0 });
    return `<section class="${cls(`sec${dark ? ' dark on-dark bp' : i % 2 ? ' alt' : ''}`)}"${dark ? bg : art}><div class="container"><div class="prose wide">${flow}</div></div></section>`;
  }).join('\n');
}

/** Página genérica (empresa, proyectos, legales…): devuelve { hero, body, title }; el primer encabezado pasa a h1 del hero. */
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
    hero: `<section class="page-hero bp${heroBg ? ' has-fig' : ''}" ${heroBg ? `style="background-image:url('${attr(ctx.img(heroBg))}')"` : ''}><div class="container">${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(ctx.site.home[lang]) }, { label: title }])}<h1>${esc(title)}</h1>${lead}</div>${heroBg && !ctx.site.ONLY_O ? `<div class="hero-fig" aria-hidden="true"><div class="hero-img" style="background-image:url('${attr(ctx.img(heroBg))}')"></div></div>` : ''}</section>`,
    body: sectionsHtml(ctx, body),
    title,
  };
}

// ───────────────────────────────────────────────────────────── [BLOG]
/** «Original»: bloque «Contacta con nosotros» (texto de la portada y formulario) que la web actual repite al pie de cada ficha de producto y de cada entrada del blog; '' si la portada no lo trae. `where` hace únicos los ids del formulario; `wrap` lo mete en un `container` (en las fichas ya va dentro de uno). */
function contactBlockO(ctx, where, wrap = false) {
  const { lang, site } = ctx;
  const cb = site.contactBlocks[lang];
  if (!(site.O && cb && cb.title)) return '';
  const id = where === 'prod' ? 'h-pc' : `h-pc-${where}`;
  const inner = `<div class="split" style="align-items:start"><div>${cb.kicker ? `<p class="eyebrow">${esc(cb.kicker)}</p>` : ''}<h2 id="${id}">${hText(site, { x: cb.title, h: cb.titleH })}</h2>${cb.text ? `<p>${esc(cb.text.replace(/<[^>]+>/g, ''))}</p>` : ''}</div>${contactForm(ctx, where)}</div>`;
  return `<section class="${oc(site, 'sec o-contact')}" aria-labelledby="${id}">${wrap ? `<div class="container">${inner}</div>` : inner}</section>`;
}

/**
 * Tarjeta de una entrada en el listado del blog. Con `dyn` (plantilla de las entradas que se crean desde el panel, ver backend-php/api/lib/BlogPage.php) cada dato variable es una marca @@TV:…@@
 * que rellena el servidor: href (con @@TV:slug@@), cardimg (la <img> o nada), date, datefmt, title y excerpt.
 */
export function postCard(ctx, p, dyn = false) {
  const { lang } = ctx;
  const href = dyn ? ctx.href(`${lang === 'es' ? '' : '/' + lang}/blog/@@TV:slug@@/`) : ctx.href(p.path);
  const im = dyn ? '@@TV:cardimg@@' : p.featured ? `<img src="${attr(ctx.thumb(p.featured))}" alt="" loading="lazy">` : '';
  const excerpt = dyn ? '@@TV:excerpt@@' : `${esc((p.excerpt || '').slice(0, 150))}${(p.excerpt || '').length > 150 ? '…' : ''}`;
  return `<a class="post-card" href="${attr(href)}"><div class="im">${im}</div><div class="tx"><time datetime="${dyn ? '@@TV:date@@' : attr(p.date || '')}">${dyn ? '@@TV:datefmt@@' : fmtDate(p.date, lang)}</time><h3>${dyn ? '@@TV:title@@' : esc(p.title)}</h3><p class="muted">${excerpt}</p>${ctx.site.O ? `<span class="${oc(ctx.site, 'o-more')}">${t('read_more', lang)}</span>` : ''}</div></a>`;
}
/** Listado del blog: tarjetas con imagen, fecha, título y extracto (150 caracteres) de cada entrada. */
export function blogIndexBody(ctx, posts) {
  return `<section class="sec"><div class="container"><div class="posts">${posts.map((p) => postCard(ctx, p)).join('')}</div></div></section>`;
}
/**
 * Entrada de blog: devuelve { hero, body } con migas, h1, fecha y el contenido sin su H1 original. Con `dyn` es la plantilla de las entradas que se crean desde el panel: lo variable son marcas
 * @@TV:…@@ (title, date, datefmt, herostyle, banner, cover, content) que rellena el servidor (BlogPage.php); la estructura es la misma que la de las entradas de la web original.
 * La imagen destacada sale en la cabecera (fondo en «Clásico», banner en «Original») y, como la primera foto de las entradas de la web original, al principio del texto (se oculta en «Original», que ya la enseña de banner).
 */
export function postBody(ctx, post, dyn = false) {
  const { lang } = ctx;
  const site = ctx.site;
  const body = dyn ? [] : post.sections.flatMap((s) => s.blocks);
  const h1 = body.find((b) => b.t === 'h' && b.l === 1);
  const content = body.filter((b) => b !== h1);
  const title = dyn ? '@@TV:title@@' : post.title;
  // «Original»: la foto de la entrada va como cabecera de contenido (1140 × 280) y el título debajo; los otros aspectos la usan de fondo del hero
  const banner = dyn ? (site.O ? '@@TV:banner@@' : '') : site.O && post.featured ? `<img class="${oc(site, 'o-banner')}" src="${attr(ctx.img(post.featured))}" alt="" width="1140" height="280" decoding="async">` : '';
  const heroStyle = dyn ? (!site.ONLY_O ? '@@TV:herostyle@@' : '') : (post.featured && !site.ONLY_O ? `style="background-image:url('${attr(ctx.img(post.featured))}')"` : '');
  const when = dyn || post.date ? `<p class="post-meta">${t('published', lang)} <time datetime="${dyn ? '@@TV:date@@' : attr(post.date)}">${dyn ? '@@TV:datefmt@@' : fmtDate(post.date, lang)}</time></p>` : '';
  const hero = `<section class="page-hero bp" ${heroStyle}><div class="container">${banner}${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(ctx.site.home[lang]) }, { label: 'Blog', href: ctx.href(ctx.site.blog[lang]) }, { label: title }])}<h1>${esc(title)}</h1>${when}</div></section>`;
  // «Original»: la foto con la que empieza el texto es la misma de la cabecera (la web actual la enseña una sola vez): se oculta en ese aspecto y se omite si va solo
  const dup = !dyn && site.O && post.featured && content[0] && content[0].t === 'img' && content[0].img && content[0].img.file === post.featured.file;
  const text = dyn ? (site.ONLY_O ? '' : '@@TV:cover@@') + '@@TV:content@@' : dup ? `${site.ONLY_O ? '' : `<div class="o-dup">${blocksHtml(ctx, [content[0]], { demote: 0 })}</div>`}${blocksHtml(ctx, content.slice(1), { demote: 0 })}` : blocksHtml(ctx, content, { demote: 0 });
  return { hero, body: `<article class="sec"><div class="container"><div class="prose">${text}</div></div></article>${contactBlockO(ctx, 'post', true)}` };
}

// ───────────────────────────────────────────────────────────── [SHOP] listado / categoría
/** Listado de productos (tienda o categoría): barra lateral con categorías, tensiones y búsqueda, subcategorías y tarjetas. */
export function shopBody(ctx, { products, category = null, intro = [] }) {
  const { lang, site } = ctx;
  const OO = site.ONLY_O;                                                    // compilación solo «Original»: sin barra lateral, filtros ni listado de productos donde la web actual no los tiene
  const vts = [...new Set(products.flatMap((p) => p.voltage_tags || []))].filter((id) => site.vtags.has(id) && site.vtags.get(id).filter !== false);
  vts.sort((a, b) => (site.vtags.get(a).sort ?? 0) - (site.vtags.get(b).sort ?? 0));
  const chips = vts.map((id) => `<button class="chip" type="button" aria-pressed="false" data-vf="${attr(id)}">${esc(vtext(site.vtags.get(id).label, lang))}</button>`).join('');
  const sidebar = `<aside class="sidebar no-print" id="filters" aria-label="${attr(t('filters', lang))}">
    <h2>${t('categories', lang)}</h2>${catTree(ctx, category?.id)}
    ${!category ? `<p class="side-shop" style="margin-top:var(--s-4)"><a class="btn sm" href="${attr(ctx.href(site.shop[lang]))}">${esc(t('shop', lang))} →</a></p>` : `${chips ? `<h2>${t('voltage', lang)}</h2><div class="chips" data-vchips>${chips}</div>` : ''}
    <h2>${t('search_ph', lang)}</h2><input class="search" type="search" placeholder="${attr(t('search_ph', lang))}" data-search aria-label="${attr(t('search_ph', lang))}">
    <p style="margin-top:var(--s-4)"><button class="btn sm ghost" type="button" data-clear-filters>${t('clear_filters', lang)}</button></p>`}
  </aside>`;
  const introHtml = intro.length ? `<div class="prose" style="margin-bottom:var(--s-5)">${blocksHtml(ctx, intro, { demote: 0, skipFirstHeading: true })}</div>` : '';
  const crumbsHtml = crumbs(ctx, [{ label: 'Torivac', href: ctx.href(site.home[lang]) }, { label: t('products', lang), href: category ? ctx.href(site.products[lang]) : null }, ...(category ? category.trail.map((c) => ({ label: pick(c.name, lang), href: ctx.href(c.pathFor[lang]) })) : [])]);
  // «Original»: la categoría lleva su foto grande al lado del texto, como la web actual (solo las categorías que allí la tienen)
  const heroIm = category && site.O ? site.heroOf.get(category.id) : null;
  const intro2 = category && site.O && introHtml
    ? `<div class="cat-split${heroIm ? '' : ' no-media'}">${heroIm ? `<figure class="${oc(site, 'cat-media')}"><img src="${attr(ctx.asset(heroIm.file))}" alt="${attr(pick(category.name, lang))}" width="${heroIm.w}" height="${heroIm.h}" decoding="async"></figure>` : ''}${introHtml}</div>`
    : introHtml;
  const showProducts = !!category && !(OO && category.children.length);                      // la portada de «Productos» solo enseña categorías: todos los productos están en la tienda
  const skipGrid = site.O && !OO && category && category.children.length ? ' o-skip' : '';   // «Original» con selector de aspecto: la web actual no lista productos en una categoría con subcategorías (los otros aspectos sí)
  const leafList = site.O && category && !category.children.length && products.length > 1;      // categoría hoja con varios productos: «Productos» + «Mostrando los N resultados»
  const listHead = leafList ? `<h2 class="${oc(site, 'o-prod-h')}">${esc(t('products', lang))}</h2><p class="${oc(site, 'o-count')}">${esc(t('o_results_n', lang).replace('{n}', products.length))}</p>` : '';
  return `<div class="container shop">
  ${OO ? '' : sidebar}
  <div>
    ${crumbsHtml}
    ${intro2}
    ${category && category.id === 19 ? waveLab(ctx) : ''}
    ${category ? '' : `<p class="shop-cta"><a class="btn" href="${attr(ctx.href(site.shop[lang]))}">${esc(t('shop_cta', lang))} →</a></p>`}
    ${category ? (category.children.length ? categoryCards(ctx, category.children, { heading: lbl(site, t('explore_sub', lang), esc(t('o_subcats', lang))), limit: 0, long: true, parent: category }) : '') : categoryCards(ctx, null, { guard: true })}
    ${showProducts ? `${listHead}${OO ? '' : `<div class="toolbar${skipGrid}"><button class="btn sm ghost filters-toggle" type="button" data-filters-toggle>☰ ${t('filters', lang)}</button><span class="count" data-count aria-live="polite">${countLabel(products.length, lang)}</span></div>`}
    <div class="pgrid${skipGrid}" data-grid>${products.map((p) => productCard(ctx, p)).join('')}</div>
    <p class="notice${skipGrid}" data-empty hidden>${t('no_results', lang)}</p>` : ''}
  </div>
</div>`;
}

// ───────────────────────────────────────────────────────────── [STORE] tienda: todos los productos
/** Tarjeta de un producto en la tienda: foto, categoría, nombre, tensiones, precio y compra (el precio y el «añadir al presupuesto» los pinta shop.js con los precios vigentes; sin JS queda el enlace a la ficha).
 *  No es un enlace entero (dentro llevaría botones): el enlace del nombre se estira sobre la tarjeta con CSS. `data-*` sirven para filtrar y ordenar. */
export function storeCard(ctx, p, tops) {
  const { lang, site } = ctx;
  const name = pick(p.name, lang);
  const href = ctx.href(p.pathFor[lang]);
  const im = p.images[0];
  const nVar = p.variants.length;
  const top = p.mainCategory ? p.mainCategory.trail[0] : null;
  const ref = nVar <= 1 ? (nVar ? p.variants[0].ref : 'P' + p.id) : '';          // referencia única: se puede añadir desde la tarjeta; con varias hay que elegir modelo en la ficha
  const go = nVar > 1 ? `<a class="btn sm" href="${attr(ctx.href(p.pathFor[lang], '#modelos'))}">${esc(t('choose_model', lang))}</a>` : `<a class="btn sm ghost" href="${attr(href)}">${esc(t('view_product', lang))}</a>`;
  return `<article class="pcard store" data-pid="${p.id}"${ref ? ` data-ref="${attr(ref)}"` : ''} data-cats="${p.category_ids.join(',')}" data-top="${tops.join(',')}" data-v="${(p.voltage_tags || []).join(',')}" data-name="${attr(name.toLowerCase())}" data-cat="${attr(top ? pick(top.name, lang).toLowerCase() : '')}" data-q="${attr((name + ' ' + p.variants.map((v) => v.ref).join(' ')).toLowerCase())}">
  <a class="ph${im ? '' : ' noimg'}" href="${attr(href)}" tabindex="-1" aria-hidden="true">${im ? `<img src="${attr(ctx.thumb(im))}" alt="" loading="lazy" decoding="async" width="${im.w ? Math.min(480, im.w) : 480}" height="${im.h ? Math.round(Math.min(480, im.w || 480) * (im.h / (im.w || 1))) : 480}">` : `<img src="${attr(ctx.asset(site.logo))}" alt="" loading="lazy" decoding="async" width="120" height="120">`}</a>
  <div class="tx">${top ? `<p class="pcat">${esc(pick(top.name, lang))}</p>` : ''}<h3><a href="${attr(href)}">${esc(name)}</a></h3>${vtags(site, p.voltage_tags, 3, lang)}
    <p class="price" data-price hidden></p>
    <div class="buy" data-buy>${go}</div>${nVar > 1 ? `<p class="meta"><span>${refLabel(nVar, lang)}</span></p>` : ''}</div>
</article>`;
}
/** Tienda: barra lateral con categorías (de primer nivel), tensiones y búsqueda; barra de orden y contador; y todos los productos como tarjetas de tienda. Filtros y orden: assets/js/shop.js. */
export function storeBody(ctx, { products }) {
  const { lang, site } = ctx;
  /** Ids de las categorías de primer nivel a las que pertenece el producto `p` (la tienda filtra por ellas). */
  const topsOf = (p) => [...new Set(p.category_ids.map((id) => site.catById.get(id)).filter(Boolean).map((c) => c.trail[0].id))];
  const list = products.slice().sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang), lang, { sensitivity: 'base' }));
  const counts = new Map();
  for (const p of list) for (const id of topsOf(p)) counts.set(id, (counts.get(id) || 0) + 1);
  const catBtns = site.catTree.filter((c) => counts.get(c.id)).map((c) => `<button class="catf" type="button" aria-pressed="false" data-cf="${c.id}"><span>${esc(pick(c.name, lang))}</span><span class="n">${counts.get(c.id)}</span></button>`).join('');
  const vts = [...new Set(list.flatMap((p) => p.voltage_tags || []))].filter((id) => site.vtags.has(id) && site.vtags.get(id).filter !== false);
  vts.sort((a, b) => (site.vtags.get(a).sort ?? 0) - (site.vtags.get(b).sort ?? 0));
  const chips = vts.map((id) => `<button class="chip" type="button" aria-pressed="false" data-vf="${attr(id)}">${esc(vtext(site.vtags.get(id).label, lang))}</button>`).join('');
  const sidebar = `<aside class="sidebar no-print" id="filters" aria-label="${attr(t('filters', lang))}">
    <div class="fgroup"><h2>${t('categories', lang)}</h2><div class="catf-list" role="group" aria-label="${attr(t('categories', lang))}">${catBtns}</div></div>
    ${chips ? `<div class="fgroup"><h2>${t('voltage', lang)}</h2><div class="chips" data-vchips>${chips}</div></div>` : ''}
    <div class="fgroup"><h2>${t('search_ph', lang)}</h2><input class="search" type="search" placeholder="${attr(t('search_ph', lang))}" data-search aria-label="${attr(t('search_ph', lang))}">
    <p style="margin-top:var(--s-4)"><button class="btn sm ghost" type="button" data-clear-filters>${t('clear_filters', lang)}</button></p></div>
  </aside>`;
  const crumbsHtml = crumbs(ctx, [{ label: 'Torivac', href: ctx.href(site.home[lang]) }, { label: t('products', lang), href: ctx.href(site.products[lang]) }, { label: t('shop', lang) }]);
  const sorts = [['name', 'sort_name'], ['price_asc', 'sort_price_asc'], ['price_desc', 'sort_price_desc'], ['category', 'sort_category']];
  const sort = `<label class="sort">${t('sort_by', lang)} <select data-sort>${sorts.map(([v, k]) => `<option value="${v}"${v.startsWith('price') ? ' data-needs-price' : ''}>${esc(t(k, lang))}</option>`).join('')}</select></label>`;
  return `<div class="container shop store-page">
  ${sidebar}
  <div>
    ${crumbsHtml}
    <p class="store-intro">${esc(t('shop_intro', lang))}</p>
    <div class="toolbar"><div class="tb-l"><button class="btn sm ghost filters-toggle" type="button" data-filters-toggle>☰ ${t('filters', lang)}</button><span class="count" data-count aria-live="polite">${countLabel(list.length, lang)}</span><span class="price-demo" data-demo-flag hidden>DEMO</span></div>${sort}</div>
    <div class="pgrid store-grid" data-grid>${list.map((p) => storeCard(ctx, p, topsOf(p))).join('')}</div>
    <p class="notice" data-empty hidden>${t('no_results', lang)}</p>
  </div>
</div>`;
}

// ───────────────────────────────────────────────────────────── [PRODUCT] ficha
/** Ficha de producto: galería, etiquetas de tensión, descripción, fichas PDF, tabla de modelos con cantidades y relacionados. */
export function productBody(ctx, p, related) {
  const { lang, site } = ctx;
  const OO = site.ONLY_O;                                                    // compilación solo «Original»: sin barra lateral de categorías (la web actual no la tiene en las fichas)
  const name = pick(p.name, lang);
  const useEs = !p.description[lang];
  const desc = useEs ? p.description.es : p.description[lang];
  const short = p.short[lang] || (useEs ? p.short.es : null) || [];
  const cat = p.mainCategory;
  const trail = cat ? cat.trail.map((c) => ({ label: pick(c.name, lang), href: ctx.href(c.pathFor[lang]) })) : [];
  // «Original»: lupa que abre la foto grande (como la web actual); shop.js la mantiene al cambiar de miniatura
  const zoom = p.images.length && site.O ? `<a class="${oc(site, 'zoom')}" data-zoom href="${attr(ctx.img(p.images[0]))}" target="_blank" rel="noopener" aria-label="${attr(t('o_zoom', lang))}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></a>` : '';
  const gal = p.images.length ? `<div class="gallery"><div class="main crop"><img data-main src="${attr(ctx.img(p.images[0]))}" alt="${attr(pick(p.images[0].alt, lang) || name)}" width="${p.images[0].w || 800}" height="${p.images[0].h || 800}">${zoom}</div>${p.images.length > 1 ? `<div class="thumbs">${p.images.map((i, k) => `<button type="button" data-thumb="${attr(ctx.img(i))}" aria-current="${k === 0}" aria-label="${attr(name + ' ' + (k + 1))}"><img src="${attr(ctx.thumb(i))}" alt=""></button>`).join('')}</div>` : ''}</div>` : '<div></div>';
  // la ficha original ya lleva en su texto corto el enlace «Ver ficha técnica» (que «Original» pinta como botón): el botón que genera esta plantilla repetiría el mismo PDF
  const shortHtml = blocksHtml(ctx, short, { demote: 2 });
  const shortHasPdf = /<a [^>]*href="[^"]*\.pdf/i.test(shortHtml);
  const pdfs = (OO && shortHasPdf ? [] : p.pdfs).map((d) => {
    const nm = decodeURIComponent(d.url.split('/').pop());
    const local = site.pdfLocal.get(nm);
    const more = p.pdfs.length > 1 ? ' · ' + esc(nm.replace(/\.pdf$/i, '').slice(0, 24)) : '';
    return `<a class="btn ghost${shortHasPdf ? ' o-dup' : ''}" href="${attr(local ? ctx.asset('assets/pdf/' + local) : d.url)}" target="_blank" rel="noopener">${lbl(site, `⬇ ${t('datasheet', lang)}${more}`, `${esc(t('o_datasheet', lang))}${more}`)}</a>`;
  }).join('');
  // tabla de modelos
  const variants = p.variants.length ? p.variants : [{ ref: 'P' + p.id, label: null, specs: {}, default: true }];
  const colCount = {};
  variants.forEach((v) => Object.keys(v.specs || {}).forEach((k) => { colCount[k] = (colCount[k] || 0) + 1; }));
  // columnas públicas: las más frecuentes, hasta 9, con nombre corto (las etiquetas largas son descripciones de cotas de un dibujo y no caben como cabecera)
  const cols = Object.keys(colCount).filter((c) => c.length <= 32).sort((a, b) => colCount[b] - colCount[a]).slice(0, 9);
  const rows = variants.map((v) => `<tr data-ref="${attr(v.ref)}" role="row">
    <td class="ref" role="cell" data-label="${attr(t('ref_model', lang))}">${v.default ? '—' : v.code ? esc(v.ref) : esc(pick(v.label, lang) || v.ref)}</td>
    ${v.default ? `<td class="generic" role="cell" colspan="${Math.max(1, cols.length)}">${esc(t('default_item', lang))}</td>` : cols.map((c) => `<td role="cell" data-label="${attr(c)}">${esc(v.specs?.[c]?.raw ?? '')}</td>`).join('')}
    <td class="act" role="cell"><div class="act-in"><span class="price-cell" data-price-for="${attr(v.ref)}"></span><div class="qty"><button type="button" data-dec aria-label="−">−</button><input type="number" inputmode="numeric" min="0" step="1" value="0" data-qty aria-label="${attr(t('qty', lang))} ${attr(v.code ? v.ref : pick(v.label, lang) || v.ref)}"><button type="button" data-inc aria-label="+">+</button></div><button class="btn sm" type="button" data-add-row="${attr(v.ref)}">${t('add_to_quote', lang)}</button></div></td></tr>`).join('');
  const models = `<section id="modelos" aria-labelledby="h-models"><div class="models-bar"><h2 id="h-models" style="margin:0">${t('models', lang)}</h2><span><span class="price-demo" data-demo-flag hidden>DEMO</span></span></div>
    <p class="muted">${t('models_hint', lang)}</p>
    <div class="tbl-wrap models" tabindex="0"><table class="spec" role="table"><thead><tr role="row"><th class="ref" role="columnheader">${t('ref_model', lang)}</th>${cols.length ? cols.map((c) => `<th role="columnheader">${esc(c)}</th>`).join('') : `<th role="columnheader"><span class="vh">${t('item', lang)}</span></th>`}<th class="act" role="columnheader">${t('unit_price', lang)} · ${t('qty', lang)}</th></tr></thead><tbody role="rowgroup">${rows}</tbody></table></div>
    <p><button class="btn" type="button" data-add-selected>${t('add_selected', lang)}</button> <a class="btn ghost" href="${attr(ctx.href(site.quote[lang]))}">${t('quote', lang)} →</a></p></section>`;
  const notice = useEs && lang !== 'es' ? `<p class="notice">${t('translation_missing', lang)}</p>` : '';
  // «Original»: la potencia que ofrece el producto, como botones «3000 VA» (solo informativos: se pide por referencia en «Modelos»)
  const power = site.O ? (p.attributes || []).find((a) => /^potencia$/i.test(a.name)) : null;
  const attrsHtml = power && power.values.length ? `<div class="${oc(site, 'pdp-attrs')}"><p class="attr-label">${esc(t('o_attr_power', lang))}</p><div class="attr-chips">${power.values.map((v, i) => `<span class="attr-chip${i === 0 ? ' on' : ''}">${esc(v)} VA</span>`).join('')}</div></div>` : '';
  // «Original»: bloque de contacto de la web actual al pie de cada ficha (mismos textos que el de la portada, en cada idioma)
  const contact = contactBlockO(ctx, 'prod');
  const rel = related.length ? `<section class="sec tight related" style="padding-inline:0"><h2>${lbl(site, t('related', lang), esc(t('o_related', lang)))}</h2><div class="pgrid">${related.map((r) => productCard(ctx, r)).join('')}</div>${site.O ? `<p class="${oc(site, 'o-all')}"><a class="btn" href="${attr(ctx.href(site.products[lang]))}">${esc(t('o_all_catalog', lang))}</a></p>` : ''}</section>` : '';
  const leadImg = site.O && desc && desc[0] && desc[0].t === 'img';                              // la descripción empieza por un dibujo: «Original» lo pone a la izquierda del texto y la tabla
  return `<div class="container shop">
  ${OO ? '' : `<aside class="sidebar no-print" id="filters" aria-label="${attr(t('categories', lang))}"><h2>${t('categories', lang)}</h2>${catTree(ctx, cat?.id)}</aside>`}
  <div>
    ${crumbs(ctx, [{ label: 'Torivac', href: ctx.href(site.home[lang]) }, { label: t('products', lang), href: ctx.href(site.products[lang]) }, ...trail, { label: name }])}
    ${OO ? '' : `<button class="btn sm ghost filters-toggle" type="button" data-filters-toggle style="margin-bottom:var(--s-4)">☰ ${t('categories', lang)}</button>`}
    <article class="pdp" itemscope itemtype="https://schema.org/Product" data-pid="${p.id}">
      ${gal}
      <div><h1 itemprop="name">${esc(name)}</h1>${vtags(site, p.voltage_tags, 8, lang)}
        <div class="short prose" style="margin-top:var(--s-4)">${shortHtml}</div>${notice}${attrsHtml}
        <div class="actions"><a class="btn" href="#modelos">${t('add_to_quote', lang)}</a>${pdfs}</div></div>
    </article>
    <div class="prose wide pdp-desc${leadImg ? ' has-lead' : ''}" style="margin-bottom:var(--s-6)">${blocksHtml(ctx, desc, { demote: 1 })}</div>
    ${models}
    ${contact}
    ${rel}
  </div>
</div>`;
}

// ───────────────────────────────────────────────────────────── [QUOTE] página del presupuesto
/** Página del presupuesto: tabla del pedido, carga de CSV/Excel y formulario de datos para enviarlo o descargar el PDF. */
export function quoteBody(ctx) {
  const { lang, site } = ctx;
  return `<section class="sec"><div class="container">
  <div class="qwrap">
    <div class="panel crop">
      <div class="models-bar"><h2 style="margin:0">${t('quote_yours', lang)}</h2><span class="price-demo" data-demo-flag hidden>${t('demo_prices', lang)}</span></div>
      <div data-quote-table></div>
      <p class="muted small" data-price-note></p>
      <p class="no-print"><button class="btn ghost sm" type="button" data-clear-quote>${t('clear', lang)}</button> <button class="btn ghost sm" type="button" data-refresh-prices>${t('refresh_prices', lang)}</button> <span class="muted small" data-price-stamp></span></p>
      <div class="drop no-print" data-drop tabindex="0" role="button" aria-label="CSV / Excel"><strong>CSV / Excel</strong><br><span class="muted small">${esc(t('drop_hint', lang))}</span><input type="file" accept=".csv,.xlsx,.xls,text/csv" hidden data-file></div>
    </div>
    <form class="panel form no-print" data-quote-form novalidate>
      <h2>${t('your_data', lang)}</h2>
      <div class="grid2"><label>${t('name', lang)}<input type="text" name="name" autocomplete="name" maxlength="${FIELDS.order.name}" required></label><label>${t('company', lang)}<input type="text" name="company" autocomplete="organization" maxlength="${FIELDS.order.company}"></label></div>
      <div class="grid2"><label>${t('email', lang)}<input type="email" name="email" autocomplete="email" maxlength="${FIELDS.order.email}" required></label><label>${t('phone', lang)}<input type="tel" name="phone" autocomplete="tel" maxlength="${FIELDS.order.phone}"></label></div>
      <label>${t('notes', lang)}<textarea name="notes" maxlength="${FIELDS.order.notes}"></textarea></label>
      <input class="hp" type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="check"><input type="checkbox" name="privacy" required> <span>${t('accept_privacy', lang)}</span></label>
      <div><div class="captcha-slot" data-captcha-slot></div><div class="actions" style="display:flex;gap:var(--s-3);flex-wrap:wrap"><button class="btn" type="submit">${t('send_order', lang)}</button><button class="btn ghost" type="button" data-download-pdf>${t('download_pdf', lang)}</button></div></div>
      <p class="small muted">${t('send_hint', lang)}</p>
      <p class="small muted" data-captcha-note hidden>${t('captcha_note', lang)}</p>
      ${site.demo ? `<p class="notice small">${t('demo_send_note', lang)}</p>` : ''}
      <div data-sent hidden class="notice ok" role="status"></div>
    </form>
  </div></div></section>`;
}

// ───────────────────────────────────────────────────────────── [CONTACT] formulario
/** Formulario de contacto accesible (nombre, email, mensaje, privacidad y campo trampa antispam); `where` hace únicos los ids. */
export function contactForm(ctx, where = 'page') {
  const { lang, site } = ctx;
  return `<form class="form" data-contact-form novalidate aria-label="${attr(t('contact_us', lang))}">
    <label class="vh" for="cf-name-${where}">${t('name', lang)}</label><input id="cf-name-${where}" type="text" name="name" placeholder="${attr(t('name', lang))}" autocomplete="name" maxlength="${FIELDS.contact.name}" required>
    <label class="vh" for="cf-email-${where}">${t('email', lang)}</label><input id="cf-email-${where}" type="email" name="email" placeholder="${attr(t('email', lang))}" autocomplete="email" maxlength="${FIELDS.contact.email}" required>
    <label class="vh" for="cf-msg-${where}">${t('message', lang)}</label><textarea id="cf-msg-${where}" name="message" placeholder="${attr(t('message', lang))}" maxlength="${FIELDS.contact.message}" required></textarea>
    <input class="hp" type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label class="check"><input type="checkbox" name="privacy" required><span>${t('accept_privacy', lang)}</span></label>
    <div><div class="captcha-slot" data-captcha-slot></div><button class="btn" type="submit">${t('send', lang)}</button></div>
    <p class="small muted" data-captcha-note hidden>${t('captcha_note', lang)}</p>
    ${site.demo ? `<p class="notice small">${t('demo_send_note', lang)}</p>` : ''}
    <div data-sent hidden class="notice ok" role="status"></div>
  </form>`;
}

/** introducción de la página de contacto: textos originales (sin el formulario de WPForms, que se sustituye por el propio) */
export function contactIntro(ctx, blocks) {
  return blocksHtml(ctx, blocks.filter((b) => !(b.t === 'p' && /^\s*\./.test(b.h.replace(/<[^>]+>/g, '')))), { demote: 0 });
}

/** «Original»: página de contacto como la de la web actual: recuadro blanco con sombra naranja y el formulario a la izquierda; a la derecha el texto y los datos (dirección, teléfono, correo) con su icono. `blocks` son los textos de la página sin el título (que es el h1); `logo` es la foto del logotipo si la página la trae y `bg` la del fondo de la sección (trazos del logotipo). Con selector de aspecto va aparte del bloque de siempre (el formulario lleva otros ids). */
export function contactPageOriginal(ctx, blocks, logo, bg) {
  const { site } = ctx;
  const k = blocks.findIndex((b, j) => b.t === 'h' && j > 0);                       // el segundo encabezado abre la columna de datos
  const left = k > 0 ? blocks.slice(0, k) : blocks.slice(0, 2), right = k > 0 ? blocks.slice(k) : blocks.slice(2);
  // Texto de un párrafo sin etiquetas.
  const plainOf = (b) => b.h.replace(/<[^>]+>/g, '').trim();
  const mail = right.find((b) => b.t === 'p' && /@/.test(b.h)), tel = right.find((b) => b.t === 'p' && /^[\s+\d().-]{7,}$/.test(plainOf(b)));
  const addr = tel ? right[right.indexOf(tel) - 1] : null;
  const rows = [[addr, 'pin'], [tel, 'tel'], [mail, 'mail']].filter(([b]) => b && b.t === 'p');
  const text = right.filter((b) => !rows.some(([r]) => r === b));
  const ICON = { pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>', tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>' };
  // Fila de datos de contacto («Original»): icono, texto y enlace de teléfono o correo según el tipo.
  const li = ([b, kind]) => { const x = plainOf(b); const inner = kind === 'tel' ? `<a href="tel:${attr(x.replace(/[^\d+]/g, ''))}">${esc(x)}</a>` : kind === 'mail' ? `<a href="mailto:${attr(x)}">${esc(x)}</a>` : esc(x); return `<li><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">${ICON[kind]}</svg><span>${inner}</span></li>`; };
  const logoImg = logo && logo.img && !logo.img.missing_local ? `<img class="o-cp-logo" src="${attr(ctx.img(logo.img))}" alt="" width="130" height="130" loading="lazy">` : '';
  // Encabezados de un trozo de HTML con aria-level 2.
  const lv2 = (h) => h.replace(/<h([1-6])>/g, '<h$1 aria-level="2">');                        // todos los encabezados del bloque cuelgan del h1 de la página (con el bloque de siempre oculto al lado, el orden automático los subiría a 3)
  return `<section class="${oc(site, 'sec o-contact-page')}"${oSecImg(site, { bg })}><div class="container"><div class="o-cp-grid">
    <div class="o-form-card">${lv2(blocksHtml(ctx, left, { demote: 0 }))}${contactForm(ctx, 'opage')}</div>
    <div class="o-cp-info">${lv2(blocksHtml(ctx, text, { demote: 0 }))}<ul class="o-rows">${rows.map(li).join('')}</ul>${addr ? `<p class="o-map"><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(plainOf(addr))}" target="_blank" rel="noopener">${esc(t('o_map', ctx.lang))}</a></p>` : ''}${logoImg}</div>
  </div></div></section>`;
}
