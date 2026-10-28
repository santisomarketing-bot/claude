#!/usr/bin/env node
// [AUDIT-I18N] Lista, por idioma, los textos de interfaz que escribió el proyecto (los de site/lib/i18n.mjs) y que NO existen tal cual en la web original, para que alguien que domine
// cada idioma los valide antes de publicar. Los textos del contenido (fichas, páginas, entradas, menús y pie) vienen de la web original sin tocar y no pasan por aquí.
//   node scripts/audit_i18n.mjs            reescribe docs/TEXTOS-DE-INTERFAZ.md
//   node scripts/audit_i18n.mjs --check    no escribe nada; sale con 1 si el documento está desfasado respecto a i18n.mjs o a la web original
// Un texto cuenta como «de la web original» si aparece tal cual (sin mayúsculas ni comillas tipográficas) en alguna página, ficha o categoría de ESE idioma.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, LANGS } from '../site/lib/i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'data', 'catalog');
const OUT = path.join(ROOT, 'docs', 'TEXTOS-DE-INTERFAZ.md');
/** Lee un JSON de data/catalog. */
const j = (f) => JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8'));
const NAME = { es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán' };
/** Categorías de la web original cuyo nombre sirve de referencia de vocabulario (se omiten las que tienen la traducción sin completar o mezclada con otro idioma: están como propuestas en el panel). */
const GLOSSARY = [51, 52, 56, 60, 19, 122, 88, 22, 30, 96, 39, 63];

/** Texto comparable: minúsculas, comillas tipográficas normalizadas y espacios simples. */
const norm = (s) => String(s).toLowerCase().normalize('NFC').replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/\s+/g, ' ').trim();
/** Texto de una lista de bloques semánticos (títulos, párrafos, listas y tablas) como lista de cadenas sin etiquetas. */
function blockTexts(blocks) {
  const out = [];
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    if (b.x) out.push(b.x);
    if (typeof b.h === 'string') out.push(b.h.replace(/<[^>]+>/g, ''));
    for (const i of b.i || []) out.push(String(i).replace(/<[^>]+>/g, ''));
    for (const r of b.rows || []) for (const c of r) out.push(c.x || '');
  }
  return out;
}
/** Todo el texto de la web original en el idioma `l`, normalizado en una sola cadena. */
function corpusOf(l, pages, products, cats) {
  const parts = [];
  for (const pg of Object.values(pages[l] || {})) { parts.push(pg.title || '', pg.meta_description || ''); for (const s of pg.sections || []) parts.push(...blockTexts(s.blocks)); }
  for (const p of products) { parts.push(p.name?.[l] || ''); for (const k of ['description', 'short']) parts.push(...blockTexts(p[k]?.[l])); }
  for (const c of cats) { parts.push(c.name?.[l] || ''); parts.push(...blockTexts(c.description?.[l])); }
  return norm(parts.join(' \n '));
}
/** Escapa las barras verticales de una celda de tabla Markdown. */
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Genera el texto del documento. */
function build() {
  const pages = j('pages.json'), products = j('products.json'), cats = j('categories.json');
  const corpus = Object.fromEntries(LANGS.map((l) => [l, corpusOf(l, pages, products, cats)]));
  const keys = Object.keys(T);
  /** ¿El texto de la clave `key` en el idioma `l` aparece tal cual en la web original? */
  const orig = (key, l) => { const s = T[key][l]; return s != null && norm(s).length >= 3 && corpus[l].includes(norm(s)); };
  const L = [];
  L.push('# Textos de interfaz escritos por el proyecto (para validar por idioma)', '');
  L.push('> GENERADO por `node scripts/audit_i18n.mjs` a partir de `site/lib/i18n.mjs` y de la web original. No editar a mano: para cambiar un texto, cámbialo en `site/lib/i18n.mjs` y regenera este documento.', '');
  L.push('## Por qué existe', '');
  L.push('La web conserva **tal cual** los textos de la web actual de grupotorivac.com en los cuatro idiomas: fichas, categorías, páginas, entradas, menús y pie. Nada de eso se ha traducido ni reformulado.');
  L.push('Los textos de abajo son los **únicos** que no vienen de ella: botones, etiquetas y avisos de la experiencia nueva (presupuesto, filtros, formularios, panel). Los escribió el proyecto en los cuatro idiomas y **hay que validarlos** antes de publicar: un cambio de palabra puede cambiar el significado de un término técnico.', '');
  L.push('## Cómo validarlos', '');
  L.push('1. Abre la sección de tu idioma. Cada fila trae el texto en español como referencia, el texto en tu idioma y la clave.');
  L.push('2. Comprueba que el significado es el mismo que el español y que los **términos técnicos usan la palabra que ya usa la web** (mira el glosario de abajo).');
  L.push('3. Si cambias algo, anota la clave y el texto correcto; se corrige en `site/lib/i18n.mjs` y se regenera este documento.', '');
  L.push('Las filas con ✓ ya existen tal cual en la web original en ese idioma (por ejemplo, «Contacto» o «Productos»): no hace falta revisarlas y no se listan.', '');
  // glosario: cómo traduce la web original sus categorías principales
  L.push('## Glosario de la web original (las palabras que hay que respetar)', '');
  L.push('| Español | Inglés | Francés | Alemán |', '|---|---|---|---|');
  const byId = new Map(cats.map((c) => [c.id, c]));
  for (const id of GLOSSARY) { const c = byId.get(id); if (c) L.push(`| ${cell(c.name.es)} | ${cell(c.name.en || '—')} | ${cell(c.name.fr || '—')} | ${cell(c.name.de || '—')} |`); }
  L.push('', 'Ojo: la web original no es del todo uniforme: «variador de tensión» aparece como *voltage variators*, *voltage regulator* o *variator* según la ficha, y hay categorías sin traducir o con texto en otro idioma que no se listan aquí (están como propuestas en el panel). Cuando un texto de interfaz nombre uno de estos términos, se usa el de la categoría correspondiente de la tabla, nunca uno inventado.', '');
  for (const l of ['en', 'fr', 'de']) {
    const rows = keys.filter((k) => T[k][l] != null && !orig(k, l));
    const skipped = keys.length - rows.length;
    L.push(`## ${NAME[l]} (${rows.length} textos a validar${skipped ? `; ${skipped} ya existen tal cual en la web original` : ''})`, '');
    L.push(`| Clave | Español (referencia) | ${NAME[l]} |`, '|---|---|---|');
    for (const k of rows) L.push(`| \`${k}\` | ${cell(T[k].es)} | ${cell(T[k][l])} |`);
    L.push('');
  }
  return L.join('\n');
}

const text = build();
if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have !== text) { console.error('✗ docs/TEXTOS-DE-INTERFAZ.md está desfasado: ejecuta `node scripts/audit_i18n.mjs`'); process.exit(1); }
  console.log('✓ docs/TEXTOS-DE-INTERFAZ.md al día');
} else {
  fs.writeFileSync(OUT, text);
  const n = (text.match(/^\| `/gm) || []).length;
  console.log(`escrito ${path.relative(ROOT, OUT)} · ${n} filas a validar entre los tres idiomas`);
}
