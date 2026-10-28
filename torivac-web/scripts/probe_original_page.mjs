#!/usr/bin/env node
// [PROBE-PAGE] Mide una página de la web ACTUAL (grupotorivac.com) para clonar su maqueta en el aspecto «Original». Solo lectura: una carga GET por página.
//   node scripts/probe_original_page.mjs <url> [ancho=1440]            lista plana ordenada por posición: bloques con fondo, borde o sombra, textos (tipografía, color), imágenes y botones
//   node scripts/probe_original_page.mjs <url> [ancho=1440] --fondos   fondos (imagen, tamaño, posición) y capas ::before/::after (velos con degradado)
// Con los datos se escribe la hoja site/assets/css/original.css y los ids de sección de data/catalog/original-layout.json («sections»). Ver docs/DISENO-TEMAS.md.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
const W = +(args.find((a) => /^\d+$/.test(a)) || 1440);
const BGS = args.includes('--fondos');
if (!url || !/^https:\/\/(www\.)?grupotorivac\.com\//.test(url)) { console.error('uso: node scripts/probe_original_page.mjs https://grupotorivac.com/<ruta>/ [ancho] [--fondos]'); process.exit(2); }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: W, height: 900 }, locale: 'es-ES', isMobile: W < 700 })).newPage();
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
// recorre la página para que carguen las imágenes y los fondos diferidos y vuelve arriba
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 100)); } scrollTo({ top: 0, behavior: 'instant' }); });
await page.waitForTimeout(600);

const rows = await page.evaluate((bgs) => {
  const out = [];
  // Caja de un elemento como [x, y de página, ancho, alto] redondeada.
  const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]; };
  if (bgs) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 30) continue;
      for (const ps of [null, '::before', '::after']) {
        const s = getComputedStyle(el, ps);
        if (ps && (s.content === 'none' || s.content === 'normal')) continue;
        const hasImg = s.backgroundImage && s.backgroundImage !== 'none';
        if (!hasImg && !(ps && s.backgroundColor !== 'rgba(0, 0, 0, 0)')) continue;
        out.push({ el: el.tagName.toLowerCase() + '.' + String(el.className).split(/\s+/).slice(0, 3).join('.').slice(0, 40), ps: ps || '', rect: box(el), bi: hasImg ? s.backgroundImage.replace(/https:\/\/grupotorivac.com\/wp-content\/uploads\//g, '~/').slice(0, 180) : '', bc: s.backgroundColor, size: s.backgroundSize, pos: s.backgroundPosition, op: s.opacity });
      }
    }
    return out;
  }
  const root = document.querySelector('#Content, main, #content, .elementor') || document.body;
  for (const el of [document.querySelector('header, #Header_wrapper, .elementor-location-header'), ...root.querySelectorAll('*'), document.querySelector('footer')].filter(Boolean)) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 6) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const tag = el.tagName.toLowerCase();
    const hasBg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || (s.backgroundImage && s.backgroundImage !== 'none');
    const sides = ['top', 'right', 'bottom', 'left'];
    const hasBd = sides.some((k) => parseFloat(s.getPropertyValue(`border-${k}-width`)) > 0 && s.getPropertyValue(`border-${k}-style`) !== 'none');
    const hasSh = s.boxShadow && s.boxShadow !== 'none';
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    const isImg = tag === 'img' || (tag === 'svg' && r.width > 40);
    const isForm = ['input', 'textarea', 'button', 'select'].includes(tag);
    if (!(hasBg || hasBd || hasSh || ownText || isImg || isForm)) continue;
    const o = { y: Math.round(r.y + scrollY), tag: tag + (typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).filter((c) => !/^elementor-(element|widget)-?[0-9a-f]{5,}/.test(c)).slice(0, 3).join('.').slice(0, 46) : ''), rect: box(el) };
    if (hasBg) { o.bg = s.backgroundColor; if (s.backgroundImage !== 'none') o.bgi = `${s.backgroundImage.slice(0, 70)} ${s.backgroundSize} ${s.backgroundPosition}`; }
    if (hasBd) o.bd = sides.map((k) => `${parseFloat(s.getPropertyValue(`border-${k}-width`))}:${s.getPropertyValue(`border-${k}-color`).replace(/rgba?\(|\)| /g, '')}`).join(' ');
    if (hasSh) o.sh = s.boxShadow.slice(0, 70);
    if (ownText || isForm) { o.txt = (ownText || el.getAttribute('placeholder') || el.value || '').slice(0, 48); o.f = `${s.fontFamily.split(',')[0].replace(/"/g, '')} ${s.fontSize}/${s.lineHeight} w${s.fontWeight}${s.textTransform !== 'none' ? ' ' + s.textTransform : ''}${s.letterSpacing !== 'normal' ? ' ls' + s.letterSpacing : ''} ${s.color.replace(/rgba?\(|\)| /g, '')} ${s.textAlign}`; }
    if (s.padding !== '0px') o.pad = s.padding;
    if (s.borderRadius !== '0px') o.rad = s.borderRadius;
    if (isImg) o.src = (el.currentSrc || el.getAttribute('src') || '').split('/').pop().slice(0, 40);
    out.push(o);
  }
  return out.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || a.rect[0] - b.rect[0]);
}, BGS);
for (const r of rows) console.log(JSON.stringify(r));
await browser.close();
