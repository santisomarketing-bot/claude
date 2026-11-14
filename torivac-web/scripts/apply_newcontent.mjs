#!/usr/bin/env node
// [APPLY-NEWCONTENT] Anota en data/content-new/*.json lo hecho en el panel «Contenido nuevo»: textos aceptados, quién aprobó cada idioma (y con qué función y cuándo) y el registro de cambios.
//   node scripts/apply_newcontent.mjs --file=contenido-nuevo-2026-11-20.json            comprueba y escribe en los archivos
//   node scripts/apply_newcontent.mjs --file=… --dry                                    solo comprueba y cuenta: no escribe nada
// El archivo lo descarga un manager desde el panel (Contenido nuevo → «Descargar para anotar») o sale de GET /api/newcontent/export. Solo toca las páginas que ya existen (no crea ninguna),
// escribe el texto vigente de cada idioma que cambió, su estado (aprobado/borrador) y su aprobación {by, role, at}, y añade al `history` de la página los hechos que aún no tenía (por id).
// Antes de escribir valida el resultado con las mismas reglas que la compilación (site/lib/newcontent.mjs): si algo no cuadra no se escribe nada. Después: compilar y empaquetar (docs/CONTENIDO-NUEVO.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNewContent } from '../site/lib/newcontent.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'en', 'fr', 'de'];
const TEXT = ['title', 'meta_description', 'h1', 'lead', 'sections', 'cta'];
const KEEP_HISTORY = 300;
/** Valor de la opción --k=valor ('' si no se pasó). */
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
/** Termina con un mensaje de error. */
const die = (m, code = 1) => { console.error('✗ ' + m); process.exit(code); };

/**
 * Aplica el archivo exportado `exp` a las páginas `files` (nombre de archivo → objeto de la página) y devuelve el recuento. Función pura: no escribe nada.
 * Ver el comentario de cabecera para las reglas.
 */
export function applyExport(exp, files) {
  const done = { pages: 0, langs: 0, history: 0, skipped: [] };
  for (const [id, change] of Object.entries(exp.pages || {})) {
    const hit = Object.entries(files).find(([, d]) => d.id === id);
    if (!hit) { done.skipped.push(`${id}: no existe en data/content-new (no se crea)`); continue; }
    const d = hit[1];
    let touched = false;
    for (const [l, c] of Object.entries(change.langs || {})) {
      if (!LANGS.includes(l) || !d.langs || !d.langs[l]) { done.skipped.push(`${id} [${l}]: esa versión no existe en el archivo`); continue; }
      const v = d.langs[l];
      for (const k of TEXT) {
        if (k === 'lead' && !(c.text || {}).lead) { delete v.lead; continue; }
        if (c.text && c.text[k] !== undefined) v[k] = c.text[k];
      }
      v.status = c.status === 'aprobado' ? 'aprobado' : 'borrador';
      if (v.status === 'aprobado' && c.approval) v.approval = { by: c.approval.by, role: c.approval.role, at: c.approval.at };
      else delete v.approval;
      done.langs++; touched = true;
    }
    const have = new Set((d.history || []).map((e) => e.id));
    const add = (change.history || []).filter((e) => e && !have.has(e.id)).map((e) => ({ id: e.id, at: e.at, by: e.by, name: e.name || undefined, lang: e.lang, action: e.action, detail: e.detail || '' }));
    if (add.length) { d.history = [...add, ...(d.history || [])].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, KEEP_HISTORY); done.history += add.length; touched = true; }
    if (touched) done.pages++;
  }
  return done;
}

/** Orden de las claves de una versión en el archivo (el mismo de siempre, para que el diff de git sea pequeño). */
const ORDER = ['status', 'approval', 'title', 'meta_description', 'h1', 'lead', 'sections', 'cta'];
/** Copia de `v` con las claves en el orden del archivo (las que no conozco, al final). */
const ordered = (v) => Object.fromEntries([...ORDER.filter((k) => k in v), ...Object.keys(v).filter((k) => !ORDER.includes(k))].map((k) => [k, v[k]]));

/** Punto de entrada de la línea de comandos. */
function main() {
  const file = arg('file'), dry = process.argv.includes('--dry'), dir = arg('dir') || path.join(ROOT, 'data', 'content-new');
  if (!file) die('Falta --file=<archivo descargado del panel>. Ejemplo: node scripts/apply_newcontent.mjs --file=contenido-nuevo-2026-11-20.json', 2);
  let exp; try { exp = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); } catch (e) { die(`No puedo leer ${file}: ${e.message}`, 2); }
  if (!exp || exp.kind !== 'torivac-contenido-nuevo' || typeof exp.pages !== 'object' || Array.isArray(exp.pages)) die('Ese archivo no es una descarga de «Contenido nuevo» del panel (falta kind «torivac-contenido-nuevo» o el objeto pages).', 2);
  const names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const files = Object.fromEntries(names.map((n) => [n, JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))]));
  const done = applyExport(exp, files);
  for (const n of names) if (files[n].langs) for (const l of Object.keys(files[n].langs)) files[n].langs[l] = ordered(files[n].langs[l]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-nc-apply-'));
  for (const n of names) fs.writeFileSync(path.join(tmp, n), JSON.stringify(files[n]));
  const check = loadNewContent({ dir: tmp, langs: LANGS });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (check.problems.length) die('Con esos cambios los archivos no pasarían la validación; no se escribe nada:\n  - ' + check.problems.join('\n  - '));
  for (const s of done.skipped) console.log('  · se omite ' + s);
  console.log(`${dry ? 'COMPROBADO (no se escribe)' : 'ANOTADO'}: ${done.pages} página(s), ${done.langs} versión(es) de idioma y ${done.history} hecho(s) nuevos en el registro.`);
  if (dry) return;
  for (const n of names) fs.writeFileSync(path.join(dir, n), JSON.stringify(files[n], null, 2) + '\n');
  console.log('Siguiente paso: node site/build.mjs (publica solo lo aprobado) y scripts/package_cpanel.py. Ver docs/CONTENIDO-NUEVO.md.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
