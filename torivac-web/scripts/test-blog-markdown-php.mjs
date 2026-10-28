#!/usr/bin/env node
// [TEST-BLOG-MD-PHP] Compara el conversor de texto del blog de JavaScript (shared/blog-markdown.mjs, el que usa la vista previa del panel) con el de PHP (backend-php/api/lib/BlogMarkdown.php, el que publica la página):
// decenas de miles de textos al azar —con las piezas más peligrosas, espacios raros de Unicode, emojis, acentos y direcciones de todo tipo— y la salida tiene que ser IDÉNTICA en las dos.
// Además PCRE no puede fallar (límites de retroceso o de pila) con ninguno de esos textos.
//   node scripts/test-blog-markdown-php.mjs [--n=30000] [--seed=1]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { render, toPlain, excerpt, safeUrl } from '../shared/blog-markdown.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Valor de la opción --k=valor (o el valor por defecto). */
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const N = Number(arg('n', '30000')), SEED = Number(arg('seed', '1'));
if (spawnSync('php', ['-v']).status !== 0) { console.log('· PHP no está instalado: se salta la comparación JS ↔ PHP'); process.exit(0); }

let seed = SEED * 7919 + 13;
/** Número pseudoaleatorio en [0,1) con semilla fija: la misma tanda en cada ejecución. */
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
/** Un elemento al azar de una lista. */
const pick = (a) => a[Math.floor(rnd() * a.length)];
const PIECES = ['[', ']', '(', ')', '!', '![', '](', '*', '**', '***', '_', '__', '`', '``', '<', '>', '"', '\\', '\\*', '|', '|---|', '| --- | :-: |', ':---:', '-', '- ', '* ', '+ ', '1. ', '2) ', '# ', '## ', '### ', '##### ', '#', '> ', '>', '---', '***', '___', ' ', '  ', '   ', '    ', '\t', '\n', '\n\n', '\r\n', '\r',
  'a', 'texto', 'Voltaje', 'TOROIDAL', 'x_y_z', 'snake_case_word', '2*3*4', 'javascript:', 'JavaScript:alert(1)', 'https://x.example/', 'HTTPS://X.EX/A', 'http://a.example/p?q=1&r=2#h', 'httpſ://x.ex/', 'mailto:a@b.co', 'MAILTO:a@b.co', 'tel:+34600000000', 'tel:+34 600', '/media/blog/a.jpg', '//evil.example/', '#ancla', '#a b', 'onerror=', '<script>', '&amp;', '&', "'", ' "pie" ', '"t"', '(a)', '((a))', '(a(b))',
  ' ', '　', ' ', ' ', ' ', '\u0085', '﻿', '​', '‎', '‮', '­', '\u0000', '\u0001', '\u0002', '\u007f', '\u009f', '😀', '👨‍👩‍👧', 'é', 'ñ', 'ß', 'İ', 'ſ', 'K', 'Ω', '漢字', 'ا', '́', 'À', 'ɏ', 'Ɛ'];
/** Un texto al azar con entre 1 y `max` piezas. */
const gen = (max) => { let s = ''; const len = 1 + Math.floor(rnd() * max); for (let i = 0; i < len; i++) s += pick(PIECES); return s; };

const cases = [];
for (let i = 0; i < N; i++) cases.push({ md: gen(i % 5 === 0 ? 80 : 25), n: 20 + Math.floor(rnd() * 280) });
// estructurados: enlaces, imágenes, tablas, listas y citas bien formados con ruido
for (let i = 0; i < Math.floor(N / 5); i++) {
  const url = pick(['https://x.example/a', '/ruta/b', '#c', 'mailto:a@b.co', 'tel:+3460', 'javascript:alert(1)', 'https://x.example/' + 'a'.repeat(Math.floor(rnd() * 30)), '/media/blog/a-1234abcd.jpg', 'HTTP://UP.EX', '(x)', 'a(b)c', 'a b']);
  cases.push({ md: pick(['', gen(3)]) + pick(['[', '![']) + gen(3) + '](' + url + pick(['', ' "t"', ' "', ' "a"b"']) + ')' + gen(3), n: 100 });
  cases.push({ md: pick(['| a | b |\n|---|---|\n| ', '|a|b\n--|--\n', '| a |\n| --- |\n']) + gen(6) + pick(['', ' |', '\n| x | y |']) + gen(4), n: 100 });
  cases.push({ md: pick(['- ', '1. ', '> ', '* ', '2) ']) + gen(6) + '\n' + pick(['  ', '', '- ', '> ', '3. ', '\n']) + gen(6), n: 100 });
}
const urls = ['', ' ', 'https://x', 'https://', 'http://a/b?c#d', 'HTTP://A', 'Https://A.example', 'httpſ://a.example', 'ftp://a', 'mailto:a@b', 'mailto:a@', 'MailTo:a@b.c', 'tel:123', 'tel:+34 123', 'TEL:+34', '/a', '//a', '/', '#a', '#', '#a b', 'javascript:alert(1)', 'a"b', 'a<b', 'a\\b', 'a\tb', 'a b', 'a\u0085b', '​https://x.example', 'https://x.example/' + 'é'.repeat(1982), 'https://x.example/' + 'é'.repeat(1983), '/' + '😀'.repeat(1999), '/' + '😀'.repeat(2000)];
for (const u of urls) cases.push({ md: 'x', n: 10, url: u });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmd-'));
const inFile = path.join(tmp, 'in.json');
fs.writeFileSync(inFile, JSON.stringify(cases));
const t0 = Date.now();
const r = spawnSync('php', [path.join(ROOT, 'backend-php', 'api', 'tests', 'blog-markdown-batch.php'), inFile], { encoding: 'utf8', maxBuffer: 1 << 30 });
fs.rmSync(tmp, { recursive: true, force: true });
if (r.status !== 0) { console.error('✗ PHP falló:\n' + (r.stderr || r.stdout).slice(0, 2000)); process.exit(1); }
const php = JSON.parse(r.stdout);
let pass = 0, fail = 0;
/** Muestra los primeros desacuerdos con detalle. */
const bad = (kind, c, a, b) => { fail++; if (fail <= 8) console.error(`  ✗ ${kind}: ${JSON.stringify(c.md.length > 200 ? c.md.slice(0, 200) + '…' : c.md)}\n      JS : ${JSON.stringify(a)}\n      PHP: ${JSON.stringify(b)}`); };
cases.forEach((c, i) => {
  const p = php[i];
  if (p.fail) bad('PCRE falló ' + p.fail + ' vez/veces', c, '', '');
  if (c.url !== undefined) { const js = safeUrl(c.url); if (js === p.url) pass++; else bad('safeUrl', { md: c.url }, js, p.url); }
  const h = render(c.md, { tableLabel: 'Tabla' });
  if (h === p.html) pass++; else bad('render', c, h, p.html);
  if (c.n !== undefined && c.url === undefined) {
    const t = toPlain(c.md); if (t === p.plain) pass++; else bad('toPlain', c, t, p.plain);
    const e = excerpt(c.md, c.n); if (e === p.excerpt) pass++; else bad('excerpt/' + c.n, c, e, p.excerpt);
  }
});
console.log(`  (${cases.length} textos comparados en ${Date.now() - t0} ms)`);
console.log(`comparación JS ↔ PHP del conversor del blog: ${pass} comprobaciones iguales, ${fail} diferencias`);
process.exit(fail ? 1 : 0);
