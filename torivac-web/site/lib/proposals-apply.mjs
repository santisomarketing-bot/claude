// [PROPOSALS-APPLY] Aplica al contenido de la web las propuestas que el manager aprobó con SU texto desde el panel (data/catalog/proposals.applied.json, que sale de
// scripts/apply_proposals.mjs a partir del archivo que descarga el panel). La usan site/build.mjs (al compilar) y scripts/apply_proposals.mjs (para probar antes de guardar):
// la misma función, así lo que se comprueba es lo que se publica.
//
//   applyApproved({ entries, pages, products, categories, seo, langs }) → { applied:[{id,where}], notFound:[{id,why}], manual:[{id,mode}] }
//
// Cada entrada: { id, mode, lang?, product_id?, category_id?, targets?:[{lang,path}], find?, text }
//   replace   → en cada página destino, el PRIMER bloque (párrafo, título, elemento de lista o celda) cuyo texto contiene `find` se sustituye por `text` (varios párrafos si hay líneas en blanco)
//   translate → la descripción del producto en `lang` pasa a ser `text`
//   title     → el título de la portada por idioma (una línea «es: …» por idioma) pasa a seo.home_title
//   add · note → no cambian nada solos: son decisiones o textos para que alguien los coloque (salen en `manual`)
// Todo se escapa al insertarlo (el texto del manager nunca es HTML). Se modifica lo que se pasa (compilación en memoria; los JSON de data/catalog no se tocan).
import { esc } from './render.mjs';

/** Entidades HTML más comunes → texto. */
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()];
  });
}
/** Texto de un trozo de HTML en línea (sin etiquetas ni entidades). */
export const textOfHtml = (h) => decode(String(h ?? '').replace(/<[^>]+>/g, ' '));
/** Texto comparable: sin tildes de comillas y guiones tipográficos, espacios únicos, minúsculas. */
export const norm = (s) => String(s ?? '').normalize('NFC').replace(/[   ]/g, ' ').replace(/[“”«»„‟]/g, '"').replace(/[‘’‚‛`´]/g, "'").replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

/** Texto del manager → bloques `p` (un párrafo por grupo de líneas separado por una línea en blanco; los saltos sueltos son <br>), todo escapado. */
export function paragraphs(text) {
  return String(text).replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => ({ t: 'p', h: p.split('\n').map((l) => esc(l.trim())).join('<br>') }));
}

/** Dónde está el texto de un bloque que se puede sustituir → lista de «sitios»: { text, set(newText) } (cada sitio sabe cómo cambiarse). Tipos: p · h · ul/ol · celdas de tabla. */
function* spots(blocks) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b || typeof b !== 'object') continue;
    if (b.t === 'p' && typeof b.h === 'string') yield { text: textOfHtml(b.h), replace: (txt) => { const ps = paragraphs(txt); if (ps.length) blocks.splice(i, 1, { ...b, h: ps[0].h }, ...ps.slice(1)); } };
    else if (b.t === 'h' && typeof b.x === 'string') yield { text: b.x, replace: (txt) => { const one = String(txt).replace(/\s+/g, ' ').trim(); blocks[i] = { ...b, x: one, ...(typeof b.h === 'string' ? { h: esc(one) } : {}) }; } };
    else if ((b.t === 'ul' || b.t === 'ol') && Array.isArray(b.i)) {
      for (let k = 0; k < b.i.length; k++) yield { text: textOfHtml(b.i[k]), replace: (txt) => { b.i[k] = esc(String(txt).replace(/\s+/g, ' ').trim()); } };
    } else if (b.t === 'table' && Array.isArray(b.rows)) {
      for (const row of b.rows) for (const cell of row || []) if (cell && typeof cell.x === 'string') yield { text: cell.x, replace: (txt) => { cell.x = String(txt).replace(/\s+/g, ' ').trim(); if (typeof cell.h === 'string') cell.h = esc(cell.x); } };
    }
  }
}
/** Todas las listas de bloques de una página (secciones) → array de arrays. */
const pageBlocks = (pg) => (Array.isArray(pg && pg.sections) ? pg.sections.map((s) => s.blocks).filter(Array.isArray) : []);
/** Sustituye el primer sitio de `lists` cuyo texto contiene `find` → true si lo encontró. */
function replaceIn(lists, find, text) {
  const needle = norm(find);
  if (!needle) return false;
  for (const blocks of lists) for (const s of spots(blocks)) if (norm(s.text).includes(needle)) { s.replace(text); return true; }
  return false;
}

/** Listas de bloques de la página `path` en `lang`: una página suelta (pages), la ficha de un producto (description y short) o una categoría (description); [] si no existe. Las rutas se comparan sin barra final. */
function listsFor(path, lang, { pages, products, categories }) {
  /** ¿Son la misma ruta (sin contar la barra final)? */
  const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
  const pg = pages && pages[lang] && Object.keys(pages[lang]).find((k) => same(k, path));
  if (pg) return { where: `página ${path}`, lists: pageBlocks(pages[lang][pg]) };
  const p = (products || []).find((x) => same(x.url && x.url[lang], path));
  if (p) return { where: `ficha ${path}`, lists: [p.short && p.short[lang], p.description && p.description[lang]].filter(Array.isArray) };
  const c = (categories || []).find((x) => same(x.path && x.path[lang], path));
  if (c) return { where: `categoría ${path}`, lists: [c.description && c.description[lang]].filter(Array.isArray) };
  return { where: path, lists: [] };
}

/** Líneas «es: título» → { es, en, fr, de } (solo los idiomas que vengan); null si no hay ninguna válida. */
export function parseTitles(text, langs = ['es', 'en', 'fr', 'de']) {
  const out = {};
  for (const line of String(text).split('\n')) { const m = /^\s*([a-z]{2})\s*:\s*(.+?)\s*$/.exec(line); if (m && langs.includes(m[1])) out[m[1]] = m[2]; }
  return Object.keys(out).length ? out : null;
}

/** Aplica las entradas aprobadas (ver arriba) → { applied, notFound, manual }. No lanza por una entrada que no encaja: la anota en notFound. */
export function applyApproved({ entries = [], pages = {}, products = [], categories = [], seo = {}, langs = ['es', 'en', 'fr', 'de'] }) {
  const rep = { applied: [], notFound: [], manual: [] };
  for (const e of entries) {
    if (!e || typeof e.id !== 'string') continue;
    if (e.mode === 'add' || e.mode === 'note' || !e.mode) { rep.manual.push({ id: e.id, mode: e.mode || 'note' }); continue; }
    const text = typeof e.text === 'string' ? e.text.trim() : '';
    if (!text) { rep.notFound.push({ id: e.id, why: 'no tiene texto' }); continue; }
    if (e.mode === 'title') {
      const t = parseTitles(text, langs);
      if (!t) { rep.notFound.push({ id: e.id, why: 'el título debe ir en líneas «es: …», «en: …»…' }); continue; }
      seo.home_title = { ...(seo.home_title || {}), ...t };
      rep.applied.push({ id: e.id, where: `título de la portada (${Object.keys(t).join(', ')})` });
    } else if (e.mode === 'translate') {
      const p = products.find((x) => x.id === e.product_id);
      if (!p || !langs.includes(e.lang) || e.lang === 'es') { rep.notFound.push({ id: e.id, why: 'producto o idioma no válido' }); continue; }
      p.description = p.description || {};
      p.description[e.lang] = paragraphs(text);
      rep.applied.push({ id: e.id, where: `descripción de «${(p.name && p.name.es) || p.id}» en ${e.lang}` });
    } else if (e.mode === 'replace') {
      const targets = (Array.isArray(e.targets) && e.targets.length ? e.targets : []).filter((t) => t && typeof t.path === 'string' && langs.includes(t.lang));
      if (!targets.length) { rep.notFound.push({ id: e.id, why: 'sin página destino' }); continue; }
      if (!e.find) { rep.notFound.push({ id: e.id, why: 'sin texto a sustituir' }); continue; }
      const done = [];
      for (const t of targets) { const f = listsFor(t.path, t.lang, { pages, products, categories }); if (f.lists.length && replaceIn(f.lists, e.find, text)) done.push(f.where); }
      if (done.length) rep.applied.push({ id: e.id, where: done.join(' · ') });
      else rep.notFound.push({ id: e.id, why: `no encuentro «${String(e.find).slice(0, 60)}» en ${targets.map((t) => t.path).join(', ')}` });
    } else rep.notFound.push({ id: e.id, why: `modo desconocido «${e.mode}»` });
  }
  return rep;
}
