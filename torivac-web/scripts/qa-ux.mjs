#!/usr/bin/env node
// [QA-UX] Sesión 10 · Control riguroso de experiencia de usuario sobre TODAS las páginas del demo (Playwright, por http).
//   node scripts/qa-ux.mjs [--limit=N] [--mobile | --width=1280] [--only=/ruta/] [--workers=4] [--out=informe.json]
// Por página mide (tras recorrerla entera para que carguen las imágenes diferidas):
//   DUROS (fallan la prueba)   cualquier petición a otro dominio (la demo debe ser autónoma) · desborde horizontal · imagen rota · imagen deformada (relación de aspecto distinta con object-fit:fill) ·
//                              restos de código visibles ([vc_…], &#…, {{…}}, undefined/NaN…) · errores de consola o de red local · ids duplicados
//   AVISOS                     imagen recortada >40 % por object-fit:cover · imagen ampliada >1,6× su tamaño real (borrosa) · texto cortado por overflow ·
//                              enlaces/botones sin nombre accesible · bloques de texto en otro idioma que el de la página (sin el aviso de «sin traducir»)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
/** Valor de la opción --k=valor de la línea de comandos, o d si no se indicó. */
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const MOBILE = process.argv.includes('--mobile');
const WIDTH = Number(opt('width', MOBILE ? 390 : 1440));
const LIMIT = Number(opt('limit', 0)), WORKERS = Number(opt('workers', 4)), ONLY = opt('only', ''), OUT = opt('out', path.join(ROOT, 'data', 'analysis', MOBILE ? 'qa-ux-mobile.json' : WIDTH === 1440 ? 'qa-ux-desktop.json' : `qa-ux-w${WIDTH}.json`));

// ───────────────────────────────────────── páginas a recorrer: todas las indexables (sin redirecciones ni /assets/ ni /admin/)
const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['assets', 'admin'].includes(e.name) || d !== DIST) walk(p); }
    else if (e.name === 'index.html') {
      const head = fs.readFileSync(p, 'utf8').slice(0, 600);
      if (/http-equiv="refresh"/i.test(head)) continue;
      pages.push('/' + path.relative(DIST, path.dirname(p)).split(path.sep).join('/') + (path.dirname(p) === DIST ? '' : '/'));
    }
  }
})(DIST);
pages.sort();
let todo = ONLY ? pages.filter((p) => p.startsWith(ONLY)) : pages;
if (LIMIT) { const step = Math.max(1, Math.floor(todo.length / LIMIT)); todo = todo.filter((_, i) => i % step === 0).slice(0, LIMIT); }

// ───────────────────────────────────────── comprobaciones dentro de la página (se serializa a texto: sin cierres externos)
/** Comprobaciones que se ejecutan DENTRO de la página (se serializa a texto): desbordes, imágenes rotas o deformadas, restos de código, ids duplicados… */
const inPage = () => {
  const out = { overflow: [], broken: [], distorted: [], cropped: [], upscaled: [], clipped: [], noname: [], shortcode: [], dupIds: [], lang: [], notice: false };
  /** True si el elemento es visible: mide más de 1 px y no está oculto por visibility, display ni opacity. */
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  /** Descripción corta del elemento para el informe: etiqueta#id.clase1.clase2. */
  const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  // desborde horizontal
  const W = window.innerWidth;
  if (document.documentElement.scrollWidth > W + 1) {
    const bad = [...document.querySelectorAll('body *')].filter((e) => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return r.right > W + 2 && getComputedStyle(e).position !== 'fixed'; });
    const leaf = bad.filter((e) => !bad.some((o) => o !== e && e.contains(o)));
    out.overflow = leaf.slice(0, 4).map((e) => `${desc(e)} (${Math.round(e.getBoundingClientRect().right)}px > ${W})`);
    if (!out.overflow.length) out.overflow = [`scrollWidth ${document.documentElement.scrollWidth} > ${W}`];
  }
  // imágenes
  for (const img of document.images) {
    if (!vis(img)) continue;
    const r = img.getBoundingClientRect(), nw = img.naturalWidth, nh = img.naturalHeight, src = (img.currentSrc || img.src || '').split('/').slice(-2).join('/');
    if (img.complete && nw === 0) { out.broken.push(src); continue; }
    if (!nw || !nh) continue;
    const cs = getComputedStyle(img), fit = cs.objectFit;
    const cw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);   // caja de contenido: el relleno no deforma
    const ch = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
    const ra = cw / ch, na = nw / nh;
    if (fit === 'fill' || fit === '') { if (Math.abs(ra - na) / na > 0.06) out.distorted.push(`${src} ${Math.round(cw)}×${Math.round(ch)} vs ${nw}×${nh}`); }
    else if (fit === 'cover') { const visible = Math.min(ra / na, na / ra); if (visible < 0.6) out.cropped.push(`${src} se ve el ${Math.round(visible * 100)} % (${Math.round(r.width)}×${Math.round(r.height)} vs ${nw}×${nh})`); }
    if (r.width > nw * 1.6 && nw > 40 && !/svg/i.test(src)) out.upscaled.push(`${src} ${Math.round(r.width)}px de ${nw}px`);
  }
  // texto cortado por overflow (no es truncado intencionado con puntos suspensivos ni line-clamp)
  for (const el of document.querySelectorAll('main *, .site-header *, footer *')) {
    if (!vis(el) || !el.childNodes.length) continue;
    const cs = getComputedStyle(el);
    if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue;
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
    if (!(el.innerText || '').trim()) continue;
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
    if ((dx > 3 || dy > 3) && !el.matches('.tbl-wrap, .thumb, .ph, .ratio, .art-host')) out.clipped.push(`${desc(el)} (+${Math.max(dx, dy)}px) «${el.innerText.trim().slice(0, 40)}»`);
  }
  // nombres accesibles
  for (const el of document.querySelectorAll('a[href], button')) {
    if (!vis(el)) continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || [...el.querySelectorAll('img')].map((i) => i.alt).join('') || '').trim();
    if (!name) out.noname.push(`${desc(el)} ${(el.getAttribute('href') || '').slice(0, 50)}`);
  }
  // restos de código y marcadores
  const txt = document.body.innerText || '';
  for (const rx of [/\[\/?(vc_|et_pb|elementor|wpforms|caption|gallery)[^\]]{0,40}\]/i, /&#\d{2,5};/, /\{\{|\{%|%\}/, /\b(undefined|NaN|\[object Object\])\b/, /<\/?(div|span|p|br|strong)[ >]/i, /lorem ipsum/i, /[ÂÃ][\u00A0-\u00BF]|â€/]) {      // mojibake: «Â©», «Ã©», «â€™» (no «GRÂCE»: con los titulares en mayúsculas de la Ficha técnica «Â» + letra es francés correcto)
    const m = txt.match(rx); if (m) out.shortcode.push(`${rx.source.slice(0, 30)} → «${txt.slice(Math.max(0, m.index - 20), m.index + 40).replace(/\s+/g, ' ')}»`);
  }
  // ids duplicados
  const seen = {}; for (const e of document.querySelectorAll('[id]')) seen[e.id] = (seen[e.id] || 0) + 1;
  out.dupIds = Object.entries(seen).filter(([, n]) => n > 1).map(([k, n]) => `${k}×${n}`).slice(0, 5);
  // idioma de los bloques de texto
  const SW = {
    es: 'el la los las de del que y en un una por con para es se su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros'.split(' '),
    en: 'the of and to in is that for it as was with be by on not he this are or his from at which but have an had they you were their one all we can her has there been if more when will would who so no what up out about into than them only other new some could time these two may then do first any like my now over such our man me even most made after also did many before must through back years where much your way well down should because each just those people how too little state good very make world still own see men work long get here between both life being under never day same another know while last might us great old year off come since against go came right used take three'.split(' '),
    fr: 'le la les de des du un une et en que qui dans pour par sur au aux avec ne pas plus ce cette ces se sa son ses est sont être a ont il elle ils elles nous vous leur leurs mais ou où donc car si comme tout tous toute toutes très aussi bien fait faire peut même entre sans sous chez ainsi dont alors après avant depuis lors cela ceci celui celle'.split(' '),
    nl: 'de het een en van in is dat op te voor met zijn als aan er niet ook maar om bij door uit naar dit die dan wordt worden kan zich heeft hebben over of wat werd tot nog onder bij deze ze zij wij u je ik hij we geen meer al wel hun haar kunnen moet moeten dus zeer'.split(' '),
    de: 'der die das den dem des und in zu von mit für auf ist im ein eine einen einem einer eines nicht sich auch es an als bei nach aus wie wird werden sind oder aber wenn noch nur über um so zum zur durch vor bis unter dass kann können wir sie ihr ihre sein seine dieser diese dieses haben hat hatte mehr sehr schon dann was wo man'.split(' '),
  };
  const lang = document.documentElement.lang || 'es';
  out.notice = !!document.querySelector('.notice');
  /** Palabras de un texto en minúsculas (solo letras), para contarlas contra las listas de palabras frecuentes de cada idioma. */
  const words = (t) => t.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  for (const el of document.querySelectorAll('main p, main li, main td, main dd')) {
    if (!vis(el) || el.closest('.notice, .demo-ribbon, [data-drawer-body]')) continue;
    const t = (el.innerText || '').trim(); const w = words(t); if (w.length < 14) continue;
    const sc = Object.fromEntries(Object.entries(SW).map(([l, list]) => [l, w.filter((x) => list.includes(x)).length]));
    const dom = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
    if (dom[0] !== lang && dom[1] >= 4 && dom[1] >= (sc[lang] || 0) * 2 + 2) out.lang.push(`${dom[0]}: «${t.slice(0, 70).replace(/\s+/g, ' ')}»`);
  }
  return out;
};

// ───────────────────────────────────────── ejecución
const { server, base } = await serve(DIST);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH <= 600 ? 844 : 900 }, locale: 'es-ES' });
await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang_auto_done', '1'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang', document.documentElement.lang || 'es'); } catch (e) { /* ignorar */ } });
const results = []; let idx = 0, done = 0; const t0 = Date.now();
/** Trabajador en paralelo: toma la siguiente página de todo, la recorre entera y guarda en results sus incidencias y errores. */
async function worker() {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('JS: ' + e.message.slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('consola: ' + m.text().slice(0, 120)); });
  page.on('requestfailed', (r) => { if (r.url().startsWith(base)) errs.push('red: ' + r.url().replace(base, '')); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) errs.push('externo (la demo debe ser autónoma): ' + u.slice(0, 110)); });
  page.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400 && !/favicon/.test(r.url())) errs.push(`HTTP ${r.status()}: ${r.url().replace(base, '')}`); });
  while (true) {
    const i = idx++; if (i >= todo.length) break;
    const url = todo[i]; errs.length = 0;
    try {
      await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(120);
      const r = await page.evaluate(inPage);
      results.push({ url, ...r, errors: [...errs] });
    } catch (e) { results.push({ url, fatal: String(e).slice(0, 160), errors: [...errs] }); }
    if (++done % 100 === 0) console.log(`  ${done}/${todo.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  await page.close();
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close(); server.close();

// ───────────────────────────────────────── informe
const HARD = ['overflow', 'broken', 'distorted', 'shortcode', 'dupIds', 'errors', 'fatal'];
const SOFT = ['cropped', 'upscaled', 'clipped', 'noname', 'lang'];
const tally = {};
for (const r of results) for (const k of [...HARD, ...SOFT]) { const v = r[k]; if (v && (Array.isArray(v) ? v.length : true)) (tally[k] ||= []).push(r); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ viewport: `${WIDTH}px`, pages: results.length, tally: Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v.length])), results }, null, 1));
console.log(`\n${results.length} páginas (ancho ${WIDTH}px) en ${Math.round((Date.now() - t0) / 1000)} s`);
let hard = 0;
for (const [title, keys] of [['DUROS', HARD], ['AVISOS', SOFT]]) {
  console.log(`\n${title}`);
  for (const k of keys) {
    const rs = tally[k] || []; if (!rs.length) { console.log(`  ✓ ${k}: 0`); continue; }
    if (title === 'DUROS') hard += rs.length;
    console.log(`  ✗ ${k}: ${rs.length} páginas`);
    for (const r of rs.slice(0, 4)) console.log(`      · ${r.url}  ${(Array.isArray(r[k]) ? r[k][0] : r[k]) || ''}`);
  }
}
console.log(hard ? `\n✗ ${hard} incidencias duras` : '\n✓ sin incidencias duras');
process.exit(hard ? 1 : 0);
