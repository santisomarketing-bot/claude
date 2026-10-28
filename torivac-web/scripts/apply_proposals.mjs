#!/usr/bin/env node
// [APPLY-PROPOSALS] Pasa a la web las propuestas que el manager aprobó con su texto en el panel (Propuestas → «Descargar aprobadas»).
//   node scripts/apply_proposals.mjs --file=propuestas-aprobadas-2026-10-28.json            comprueba y guarda en data/catalog/proposals.applied.json (se mezcla con lo que ya hubiera, por id)
//   node scripts/apply_proposals.mjs --file=… --replace                                       el archivo guardado pasa a ser EXACTAMENTE lo del archivo descargado (así se deshace lo que ya no está aprobado)
//   node scripts/apply_proposals.mjs --file=… --dry                                           solo comprueba y cuenta: no guarda nada
// Antes de guardar prueba cada propuesta sobre el catálogo real (site/lib/proposals-apply.mjs, la misma función que usa la compilación): si el texto a sustituir ya no está, o falta la página,
// lo dice y no guarda (salvo --allow-missing). Después hay que compilar y empaquetar la web: node site/build.mjs / scripts/package_cpanel.py (ver docs/PROPUESTAS.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyApproved } from '../site/lib/proposals-apply.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'data', 'catalog');
const MODES = ['replace', 'translate', 'title', 'add', 'note'], LANGS = ['es', 'en', 'fr', 'de'];
/** Valor de la opción --k=valor de la línea de comandos ('' si no se pasó). */
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
/** ¿Se pasó la opción --k? */
const flag = (k) => process.argv.includes(`--${k}`);
/** Lee un JSON de data/catalog (o el valor por defecto si no existe). */
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8')); } catch { return d; } };
/** Termina con un mensaje de error. */
const die = (m, code = 1) => { console.error('✗ ' + m); process.exit(code); };

const file = arg('file');
if (!file) die('Falta --file=<archivo descargado del panel>. Ejemplo: node scripts/apply_proposals.mjs --file=propuestas-aprobadas-2026-10-28.json', 2);
let exp;
try { exp = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); } catch (e) { die(`No puedo leer ${file}: ${e.message}`, 2); }
if (!exp || exp.kind !== 'torivac-propuestas-aprobadas' || !Array.isArray(exp.approved)) die('Ese archivo no es una descarga de «Propuestas aprobadas» del panel (falta kind «torivac-propuestas-aprobadas» o la lista approved).', 2);

const proposals = new Map(load('proposals.json', []).map((p) => [p.id, p]));
const bad = [];
/** Texto recortado de una entrada del archivo (cadena o vacío). */
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const entries = [];
for (const a of exp.approved) {
  if (!a || typeof a.id !== 'string' || !proposals.has(a.id)) { bad.push(`${a && a.id}: no es una propuesta que exista`); continue; }
  const p = proposals.get(a.id);
  const mode = MODES.includes(a.mode) ? a.mode : 'note';
  const targets = (Array.isArray(a.targets) ? a.targets : []).filter((t) => t && LANGS.includes(t.lang) && typeof t.path === 'string' && t.path.startsWith('/')).map((t) => ({ lang: t.lang, path: t.path }));
  entries.push({
    id: a.id, type: p.type, field: p.field, title: p.title, mode, lang: LANGS.includes(a.lang) ? a.lang : (LANGS.includes(p.lang) ? p.lang : undefined),
    product_id: Number.isInteger(p.product_id) ? p.product_id : undefined, category_id: Number.isInteger(p.category_id) ? p.category_id : undefined,
    targets: targets.length ? targets : undefined, find: str(a.find, 300) || undefined, text: str(a.text, 3000) || undefined, note: str(a.note, 500) || undefined, by: str(a.by, 120) || undefined, at: str(a.at, 40) || undefined,
  });
}
if (bad.length) die('Hay propuestas que no se reconocen:\n  ' + bad.join('\n  '), 2);

// prueba sobre el catálogo real (copias: no se toca nada)
const clone = (o) => JSON.parse(JSON.stringify(o));
const rep = applyApproved({ entries, pages: clone(load('pages.json', {})), products: clone(load('products.json', [])), categories: clone(load('categories.json', [])), seo: clone(load('seo-overrides.json', {})), langs: LANGS });
console.log(`Propuestas aprobadas en el archivo: ${exp.approved.length}`);
for (const a of rep.applied) console.log(`  ✓ ${a.id} → ${a.where}`);
for (const m of rep.manual) console.log(`  ✎ ${m.id} (${m.mode}) queda anotada para trabajo a mano: no cambia la web sola`);
for (const n of rep.notFound) console.log(`  ✗ ${n.id} → ${n.why}`);
if (rep.notFound.length && !flag('allow-missing')) die(`${rep.notFound.length} propuesta(s) no se pueden aplicar tal como están. Corrígelas en el panel (el fragmento a sustituir tiene que aparecer en la página) y descarga de nuevo, o usa --allow-missing para guardar el resto.`, 2);
if (flag('dry')) { console.log('\n(--dry: no se ha guardado nada)'); process.exit(0); }

// guardar (mezcla por id, o reemplazo con --replace)
const FILE = path.join(CAT, 'proposals.applied.json');
const prev = load('proposals.applied.json', { entries: [] }).entries || [];
const skip = new Set(rep.notFound.map((n) => n.id));
const keep = entries.filter((e) => !skip.has(e.id));
const byId = new Map(flag('replace') ? [] : prev.map((e) => [e.id, e]));
for (const e of keep) byId.set(e.id, e);
const out = { _doc: 'Propuestas del panel aprobadas por un manager con SU texto. Lo escribe scripts/apply_proposals.mjs a partir de la descarga «Propuestas aprobadas»; site/build.mjs lo aplica al compilar (replace, translate, title) y las add/note esperan trabajo a mano. Para volver atrás, borra la entrada (o usa --replace con una descarga sin ella). Ver docs/PROPUESTAS.md.', generated_at: new Date().toISOString(), entries: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
console.log(`\n✓ Guardado ${path.relative(ROOT, FILE)}: ${out.entries.length} entrada(s) (${keep.length} de este archivo). Ahora compila y empaqueta la web (docs/PROPUESTAS.md).`);
