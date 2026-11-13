/**
 * [NEWCONTENT] Páginas NUEVAS (plan 2027): contenido que no viene de la web original y que solo se publica cuando está APROBADO.
 *
 * Cada archivo de data/content-new/*.json describe una página con una versión por idioma. Una versión tiene estado «borrador» (no se publica)
 * o «aprobado» (se publica). Aprobar exige quién, con qué función y cuándo:
 *   · castellano → función «comercial» (da el visto bueno a las afirmaciones y condiciones);
 *   · EN, FR, DE → función «traductor», y solo cuando la versión en castellano ya está aprobada.
 * Con --drafts (vista previa interna, nunca con --base) los borradores también se compilan, marcados como BORRADOR.
 *
 * Secciones: [LOAD] lectura y validación · [BUILD] conversión al modelo de página genérica.
 * Dependencias: node:fs, node:path. Lo usa site/build.mjs; lo prueba scripts/test-newcontent.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROLE = { es: 'comercial', en: 'traductor', fr: 'traductor', de: 'traductor' };
const RESERVED = /^(\/en|\/fr|\/de)?\/(product|categoria-producto|admin|api|assets|blog|tienda|shop|presupuesto|quote|devis|angebot|boutique)(\/|$)/;
const TEXT_FIELDS = ['title', 'meta_description', 'h1', 'lead'];

// ───────────────────────────────────────── [LOAD]
/** ¿Es un texto plano válido? (sin etiquetas ni entidades: el contenido nuevo se escribe en texto y el generador lo escapa). */
const plain = (s) => typeof s === 'string' && s.trim() !== '' && !/[<>]/.test(s);

/** Valida una versión (`v`) de la página `id` en el idioma `lang` y devuelve la lista de problemas (vacía si está bien). */
function checkVersion(id, lang, v, problems) {
  const at = `${id} [${lang}]`;
  if (!v || typeof v !== 'object') { problems.push(`${at}: falta la versión`); return; }
  if (!['borrador', 'aprobado'].includes(v.status)) problems.push(`${at}: estado «${v.status}» no válido (borrador o aprobado)`);
  for (const f of TEXT_FIELDS) if (f !== 'lead' && !plain(v[f])) problems.push(`${at}: «${f}» vacío o con etiquetas`);
  if (v.lead != null && !plain(v.lead)) problems.push(`${at}: «lead» con etiquetas`);
  if (plain(v.meta_description) && (v.meta_description.length < 50 || v.meta_description.length > 160)) problems.push(`${at}: meta_description de ${v.meta_description.length} caracteres (entre 50 y 160)`);
  if (plain(v.title) && v.title.length > 65) problems.push(`${at}: title de ${v.title.length} caracteres (máximo 65)`);
  if (!Array.isArray(v.sections) || !v.sections.length) problems.push(`${at}: sin secciones`);
  for (const [i, s] of (v.sections || []).entries()) {
    if (!plain(s.h2)) problems.push(`${at}: sección ${i + 1} sin h2 de texto plano`);
    if (!Array.isArray(s.p) || !s.p.length || !s.p.every(plain)) problems.push(`${at}: sección ${i + 1} sin párrafos de texto plano`);
  }
  for (const c of v.cta || []) {
    if (!plain(c.label)) problems.push(`${at}: botón sin texto`);
    if (typeof c.href !== 'string' || !/^(\/|https:\/\/)/.test(c.href)) problems.push(`${at}: enlace «${c.href}» (debe empezar por / o https://)`);
  }
  if (v.status === 'aprobado') {
    const a = v.approval || {};
    if (!plain(a.by)) problems.push(`${at}: aprobada sin indicar quién la aprueba (approval.by)`);
    if (a.role !== ROLE[lang]) problems.push(`${at}: debe aprobarla la función «${ROLE[lang]}» (consta «${a.role}»)`);
    if (!/^\d{4}-\d\d-\d\d$/.test(a.at || '')) problems.push(`${at}: aprobada sin fecha (approval.at AAAA-MM-DD)`);
  }
}

/**
 * Lee y valida data/content-new/*.json. `existing` es el conjunto de rutas ya ocupadas por otras páginas.
 * Devuelve { entries, problems }: cada entrada lleva su id, rutas por idioma y versiones por idioma.
 */
export function loadNewContent({ dir, langs, existing = new Set() }) {
  const problems = [], entries = [], ids = new Set(), taken = new Map();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); } catch { return { entries, problems }; }
  for (const f of files) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { problems.push(`${f}: JSON no válido (${e.message})`); continue; }
    const id = d.id;
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) { problems.push(`${f}: id no válido`); continue; }
    if (ids.has(id)) problems.push(`${f}: id «${id}» repetido`);
    ids.add(id);
    for (const l of Object.keys(d.langs || {})) {
      if (!langs.includes(l)) { problems.push(`${id}: idioma «${l}» desconocido`); continue; }
      const slug = (d.slug || {})[l];
      const prefix = l === 'es' ? '' : `/${l}`;
      if (typeof slug !== 'string' || !slug.startsWith(prefix + '/') || !slug.endsWith('/') || /[^a-z0-9/-]/.test(slug)) problems.push(`${id} [${l}]: ruta «${slug}» no válida (minúsculas, guiones y barras; ${prefix || 'sin prefijo'} al principio)`);
      else {
        if (RESERVED.test(slug)) problems.push(`${id} [${l}]: la ruta «${slug}» está reservada`);
        if (existing.has(slug)) problems.push(`${id} [${l}]: la ruta «${slug}» ya existe en la web`);
        if (taken.has(slug)) problems.push(`${id} [${l}]: la ruta «${slug}» ya la usa ${taken.get(slug)}`);
        taken.set(slug, id);
      }
      checkVersion(id, l, d.langs[l], problems);
    }
    const es = (d.langs || {}).es;
    for (const l of Object.keys(d.langs || {})) if (l !== 'es' && d.langs[l] && d.langs[l].status === 'aprobado' && !(es && es.status === 'aprobado')) problems.push(`${id} [${l}]: no se puede aprobar una traducción mientras el castellano no esté aprobado`);
    entries.push({ id, kind: d.kind || 'landing', slug: d.slug || {}, langs: d.langs || {}, notes: d.notes || [] });
  }
  return { entries, problems };
}

// ───────────────────────────────────────── [BUILD]
/** Bloques (modelo de página genérica) de una versión: h1, aviso de borrador, párrafo de entrada, secciones y botones. */
function blocksOf(v, draft) {
  const sections = [{ id: 'nc-0', form: false, blocks: [{ t: 'h', l: 1, x: v.h1 }] }];
  if (draft) sections[0].blocks.push({ t: 'p', h: '<strong>BORRADOR · pendiente de aprobación.</strong> Esta versión no está publicada.' });
  if (v.lead) sections[0].blocks.push({ t: 'p', h: escapeHtml(v.lead) });
  v.sections.forEach((s, i) => {
    const blocks = [{ t: 'h', l: 2, x: s.h2 }, ...s.p.map((p) => ({ t: 'p', h: escapeHtml(p) }))];
    if (i === v.sections.length - 1) for (const c of v.cta || []) blocks.push({ t: 'btn', x: c.label, href: c.href.startsWith('/') ? 'https://grupotorivac.com' + c.href : c.href, pdf: false });
    sections.push({ id: `nc-${i + 1}`, form: false, blocks });
  });
  return sections;
}

/** Escapa el texto para HTML. */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/**
 * Añade a `pages` (idioma → ruta → página) las versiones que toca publicar: las aprobadas y, con `drafts`, también los borradores.
 * Las equivalencias (hreflang, selector de idioma) solo enlazan versiones que se publican. Devuelve el recuento.
 */
export function applyNewContent(pages, entries, { drafts = false } = {}) {
  const count = { published: 0, drafts: 0, pending: 0 };
  for (const e of entries) {
    const show = Object.keys(e.langs).filter((l) => e.langs[l].status === 'aprobado' || drafts);
    for (const l of Object.keys(e.langs)) if (!show.includes(l)) count.pending++;
    for (const l of show) {
      const v = e.langs[l], draft = v.status !== 'aprobado';
      const alternates = Object.fromEntries(show.filter((o) => o !== l).map((o) => [o, e.slug[o]]));
      (pages[l] = pages[l] || {})[e.slug[l]] = { kind: 'page', lang: l, path: e.slug[l], title: (draft ? '[BORRADOR] ' : '') + v.title, meta_description: v.meta_description, alternates, source_url: null, new_content: e.id, sections: blocksOf(v, draft) };
      if (draft) count.drafts++; else count.published++;
    }
  }
  return count;
}
