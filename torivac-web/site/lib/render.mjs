// [RENDER] Utilidades del generador: escape, rutas relativas, enlaces internos, bloques semánticos → HTML.
//
// RUTAS: el demo se puede abrir con doble clic (file://). Por eso todos los enlaces internos son RELATIVOS y
// terminan en index.html. Las URLs lógicas (las mismas que la web original: /product/x/, /en/…) se conservan como estructura
// de carpetas, de modo que al publicar en un servidor las URLs son idénticas (SEO intacto).

import fs from 'node:fs';
import path from 'node:path';

export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const attr = esc;

/** ruta lógica de página ('/en/product/x/') → carpeta de salida relativa a dist ('en/product/x') */
export const dirOf = (p) => p.replace(/^\/|\/$/g, '');

// Demo (file://): los enlaces a carpetas terminan en index.html. Producción (--base): URLs limpias, sin index.html (Apache sirve la carpeta).
let clean = false;
export const setCleanUrls = (v) => { clean = !!v; };
/** URL relativa desde la página `from` hasta la página lógica `to` (+hash opcional). */
export function rel(from, to, hash = '') {
  const up = '../'.repeat(dirOf(from).split('/').filter(Boolean).length) || './';
  const target = to.replace(/^\//, '');
  return up + target + (to.endsWith('/') && !clean ? 'index.html' : '') + hash;
}
/** URL relativa a un asset ('assets/css/x.css') desde la página `from`. */
export function asset(from, a) {
  const up = '../'.repeat(dirOf(from).split('/').filter(Boolean).length) || './';
  return up + a.replace(/^\//, '');
}

/** Contexto de render: se crea una vez por página */
export class Ctx {
  constructor({ lang, path: p, site }) { this.lang = lang; this.path = p; this.site = site; }
  href(to, hash) { return rel(this.path, to, hash); }
  asset(a) { return asset(this.path, a); }
  img(ref) { return ref && ref.file ? this.asset(ref.file) : ref?.src || ''; }
  thumb(ref) { return ref && ref.thumb ? this.asset(ref.thumb) : ref?.src || ''; }
}

/** Reescribe un enlace de la web original a su equivalente local (página, PDF) o lo deja absoluto. */
export function mapLink(ctx, href) {
  if (!href) return href;
  if (/^(mailto:|tel:|#)/.test(href)) return href;
  let u;
  try { u = new URL(href, 'https://grupotorivac.com'); } catch { return href; }
  if (u.host !== 'grupotorivac.com') return href;
  const p = u.pathname.endsWith('/') || /\.[a-z0-9]{2,5}$/i.test(u.pathname) ? u.pathname : u.pathname + '/';
  if (/\.pdf$/i.test(p)) {
    const name = decodeURIComponent(p.split('/').pop());
    const local = ctx.site.pdfLocal.get(name);
    return local ? ctx.asset('assets/pdf/' + local) : u.toString();
  }
  if (ctx.site.paths.has(p)) return ctx.href(p, u.hash);
  const alias = ctx.site.aliases.get(p);
  if (alias) return ctx.href(alias, u.hash);
  return u.toString(); // lo demás sigue apuntando a la web original
}

/** HTML inline de un bloque (los enlaces internos se reescriben). */
export function inlineHtml(ctx, h) {
  return String(h || '').replace(/<a href="([^"]+)">/g, (m, href) => {
    const mapped = mapLink(ctx, href.replace(/&amp;/g, '&'));
    const ext = /^https?:/.test(mapped) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${attr(mapped)}"${ext}>`;
  });
}

const tbl = (b, lang) => {
  const rows = b.rows;
  const head = rows[0].every((c) => c.th) || rows[0].length > 1 && rows.length > 2 && rows[0].every((c) => c.x) && rows[1].some((c) => /\d/.test(c.x)) ? rows[0] : null;
  const body = head ? rows.slice(1) : rows;
  const cell = (c, tag) => `<${tag}${c.th && tag === 'td' ? ' scope="row"' : ''}>${esc(c.x)}</${tag}>`;
  // fila única con una sola celda = título de la tabla (así la maqueta la original)
  let caption = b.cap || '';
  let rest = body, headRow = head;
  if (!caption && rows[0].length === 1 && rows.length > 2) { caption = rows[0][0].x; headRow = rows[1]; rest = rows.slice(2); }
  return `<div class="tbl-wrap" tabindex="0" role="region" aria-label="${attr(caption || 'tabla')}"><table class="spec">${caption ? `<caption>${esc(caption)}</caption>` : ''}${headRow ? `<thead><tr>${headRow.map((c) => cell(c, 'th')).join('')}</tr></thead>` : ''}<tbody>${rest.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody></table></div>`;
};

/** Bloques semánticos → HTML. opts.demote: sube el nivel de los encabezados (h1→h2…) para que la plantilla sea dueña del h1. */
export function blocksHtml(ctx, blocks = [], opts = {}) {
  const { demote = 0, skipFirstHeading = false } = opts;
  let skipped = !skipFirstHeading;
  return blocks.map((b) => {
    switch (b.t) {
      case 'h': {
        if (!skipped) { skipped = true; return ''; }
        const l = Math.min(6, Math.max(2, b.l + demote));
        return `<h${l}>${esc(b.x)}</h${l}>`;
      }
      case 'p': return b.q ? `<blockquote>${inlineHtml(ctx, b.h)}</blockquote>` : `<p>${inlineHtml(ctx, b.h)}</p>`;
      case 'ul': { const tag = b.o ? 'ol' : 'ul'; return `<${tag}>${b.i.map((i) => `<li>${inlineHtml(ctx, i)}</li>`).join('')}</${tag}>`; }
      case 'table': return tbl(b, ctx.lang);
      case 'img': {
        const im = b.img;
        if (!im || im.missing_local) return '';   // nunca se enlaza a imágenes de otros dominios
        const src = ctx.img(im);
        if (!src) return '';
        const w = im?.w ? ` width="${im.w}" height="${im.h}"` : '';
        if (im?.w && im.w <= 160) return `<img class="icon" src="${attr(src)}" alt="" aria-hidden="true"${w} loading="lazy" decoding="async">`;   // iconos (60×60 de Misión/Visión/Valores): en línea, sin marco
        const el = `<img src="${attr(src)}" alt="${attr(b.alt || '')}"${w} loading="lazy" decoding="async">`;
        // la web original enlaza las fotos a su versión grande (lightbox) en SU servidor: aquí no se hotlinkea (y un enlace con solo una imagen sin alt no tiene nombre accesible)
        const lightbox = b.href && /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(b.href);
        return `<figure>${b.href && !lightbox ? `<a href="${attr(mapLink(ctx, b.href))}"${b.alt ? '' : ' aria-label="' + attr(mapLink(ctx, b.href)) + '"'}>${el}</a>` : el}</figure>`;
      }
      case 'btn': {
        const href = mapLink(ctx, b.href);
        const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
        return `<p><a class="btn${b.pdf ? ' ghost' : ''}" href="${attr(href)}"${ext}>${b.pdf ? '<span aria-hidden="true">⬇</span> ' : ''}${esc(b.x)}</a></p>`;
      }
      case 'embed': return `<iframe src="${attr(b.src)}" loading="lazy" allowfullscreen title="Video"></iframe>`;
      case 'hr': return '<hr>';
      default: return '';
    }
  }).join('\n');
}

export const plain = (blocks = []) => blocks.map((b) => (b.t === 'h' ? b.x : b.t === 'p' ? b.h.replace(/<[^>]+>/g, '') : b.t === 'ul' ? b.i.join(' ') : '')).join(' ').replace(/\s+/g, ' ').trim();

export const fmtDate = (iso, lang) => { try { return new Date(iso).toLocaleDateString({ es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' }[lang], { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return iso || ''; } };

export function writeFile(root, p, content) {
  const f = path.join(root, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
