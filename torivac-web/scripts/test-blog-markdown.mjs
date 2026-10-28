#!/usr/bin/env node
// [TEST-BLOG-MD] Pruebas del conversor de texto del blog (shared/blog-markdown.mjs).
//   node scripts/test-blog-markdown.mjs            recorre shared/blog-markdown.fixtures.json (el contrato que también cumple backend-php/api/lib/BlogMarkdown.php),
//                                                  comprueba que NUNCA sale HTML fuera de la lista permitida (con miles de entradas al azar y ataques conocidos)
//                                                  y que ninguna entrada hostil tarda más de lo razonable (backtracking).
//   node scripts/test-blog-markdown.mjs --update   reescribe las salidas esperadas del archivo de contrato con lo que da ahora el código (revisa el diff a mano).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, toPlain, excerpt, slugify, safeUrl } from '../shared/blog-markdown.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'shared', 'blog-markdown.fixtures.json');
const fx = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const UPDATE = process.argv.includes('--update');
let pass = 0, fail = 0;
/** Anota una comprobación correcta o, si no se cumple, un fallo con su mensaje. */
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };
/** Comprueba que `got` es exactamente `want` y, si no, enseña los dos. */
const eq = (got, want, msg) => { if (got === want) pass++; else { fail++; console.error(`  ✗ ${msg}\n      esperado: ${JSON.stringify(want)}\n      obtenido: ${JSON.stringify(got)}`); } };

// ── 1) contrato ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const c of fx.render) { const got = render(c.md, { tableLabel: 'Tabla' }); if (UPDATE) c.html = got; else eq(got, c.html, `render «${c.name}»`); }
for (const c of fx.plain) { const got = toPlain(c.md); if (UPDATE) c.text = got; else eq(got, c.text, `toPlain ${JSON.stringify(c.md.slice(0, 40))}`); }
for (const c of fx.excerpt) { const got = excerpt(c.md, c.n); if (UPDATE) c.text = got; else eq(got, c.text, `excerpt ${JSON.stringify(c.md.slice(0, 40))}/${c.n}`); }
for (const c of fx.slug) { const got = slugify(c.title); if (UPDATE) c.slug = got; else eq(got, c.slug, `slugify ${JSON.stringify(c.title.slice(0, 40))}`); }
for (const c of fx.safeUrl) { const got = safeUrl(c.url) !== null; if (UPDATE) c.ok = got; else eq(got, c.ok, `safeUrl ${JSON.stringify(c.url)}`); }
if (UPDATE) {
  fs.writeFileSync(FIX, JSON.stringify(fx, null, 1) + '\n');
  fs.copyFileSync(FIX, path.join(ROOT, 'backend-php', 'api', 'tests', 'blog-markdown.fixtures.json'));     // copia junto a las pruebas de PHP (para trabajar solo con backend-php/)
  console.log('contrato reescrito: ' + path.relative(ROOT, FIX) + ' (y su copia en backend-php/api/tests/)');
  process.exit(0);
}

// ── 2) el HTML que sale solo puede ser el permitido ───────────────────────────────────────────────────────────────────────────
const TAGS = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'strong', 'em', 'code', 'a', 'img', 'figure', 'figcaption', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const VOID = new Set(['hr', 'br', 'img']);
const ATTR = /\s+([a-z-]+)="([^"<>]*)"/g;
/** Devuelve la lista de problemas del HTML (vacía si todo es lo permitido). */
function audit(html) {
  const bad = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*>/g;
  let last = 0, m;
  while ((m = re.exec(html))) {
    const between = html.slice(last, m.index);
    if (/[<>]/.test(between)) bad.push('texto con < o > sin escapar: ' + JSON.stringify(between.slice(0, 60)));
    last = re.lastIndex;
    const [, close, name, attrs] = m;
    if (!TAGS.has(name)) { bad.push('etiqueta no permitida <' + name + '>'); continue; }
    if (close) { if (stack.pop() !== name) bad.push('cierre desparejado </' + name + '>'); continue; }
    if (!VOID.has(name)) stack.push(name);
    for (const [, k, v] of attrs.matchAll(ATTR)) {
      if (name === 'a' && k === 'href') { if (!/^(https?:\/\/[^\s"<>]+|mailto:[^\s"<>]+|tel:[+0-9 ()-]+|\/(?!\/)[^\s"<>]*|#[A-Za-z0-9_-]+)$/i.test(v.replace(/&amp;/g, '&'))) bad.push('href no permitido: ' + v); }
      else if (name === 'img' && k === 'src') { if (!/^(https:\/\/|\/(?!\/))[^\s"<>]*$/i.test(v.replace(/&amp;/g, '&'))) bad.push('src no permitido: ' + v); }
      else if (name === 'a' && ((k === 'target' && v === '_blank') || (k === 'rel' && v === 'noopener') || k === 'title')) { /* permitido */ }
      else if (name === 'img' && ['alt', 'width', 'height'].includes(k)) { /* permitido */ }
      else if (name === 'img' && ((k === 'loading' && v === 'lazy') || (k === 'decoding' && v === 'async'))) { /* permitido */ }
      else if (name === 'div' && ((k === 'class' && v === 'tbl-wrap') || (k === 'tabindex' && v === '0') || (k === 'role' && v === 'region') || k === 'aria-label')) { /* permitido */ }
      else if (name === 'table' && k === 'class' && v === 'spec') { /* permitido */ }
      else bad.push(`atributo no permitido ${name}.${k}="${v}"`);
    }
    if (name === 'div' && !/class="tbl-wrap"/.test(attrs)) bad.push('div que no es el de la tabla');
    if (/\son[a-z]+=/i.test(attrs)) bad.push('manejador de evento');
  }
  if (/[<>]/.test(html.slice(last))) bad.push('texto final con < o > sin escapar');
  if (stack.length) bad.push('sin cerrar: ' + stack.join(','));
  return bad;
}
// ataques conocidos + entradas al azar con las piezas más peligrosas
const ATTACKS = [
  '<script>alert(1)</script>', '[x](javascript:alert(1))', '![x](javascript:alert(1))', '[x](data:text/html;base64,PHNjcmlwdD4=)', '"><img src=x onerror=alert(1)>', '[x](https://a.example/"onclick="alert(1))',
  '![x](/media/blog/a.jpg" onerror="alert(1))', '`</code><script>alert(1)</script>`', '| <script> |\n|---|\n| <img src=x onerror=y> |', '> <svg onload=alert(1)>', '# <iframe src=//evil>', '- <a href="javascript:x">x</a>',
  '[a](<javascript:alert(1)>)', '[a](java\tscript:alert(1))', '[a](&#106;avascript:alert(1))', '![a](//evil.example/a.png)', '[a](https://x.example/a b)', '**<b onmouseover=x>**', '_<i>_', '\\<script>',
];
const PIECES = ['[', ']', '(', ')', '!', '*', '**', '_', '__', '`', '<', '>', '"', '\\', '|', '|---|', '-', '- ', '1. ', '# ', '## ', '> ', '---', ' ', '  ', '\n', '\n\n', 'a', 'texto', 'javascript:', 'https://x.example/', '/media/blog/a.jpg', 'onerror=', '<script>', '&amp;', '&', "'", '\t', '\r\n'];
let seed = 12345;
/** Número pseudoaleatorio en [0,1) con semilla fija: la misma tanda de entradas hostiles en cada ejecución. */
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const t0 = Date.now();
for (const a of ATTACKS) { const bad = audit(render(a, { tableLabel: 'Tabla' })); ok(bad.length === 0, `ataque ${JSON.stringify(a)} → ${bad.join(' | ')}`); }
let worst = 0;
for (let n = 0; n < 20000; n++) {
  let s = '';
  const len = 1 + Math.floor(rnd() * 40);
  for (let k = 0; k < len; k++) s += PIECES[Math.floor(rnd() * PIECES.length)];
  const t1 = performance.now();
  const html = render(s, { tableLabel: 'Tabla' });
  worst = Math.max(worst, performance.now() - t1);
  const bad = audit(html);
  if (bad.length) { ok(false, `entrada al azar ${JSON.stringify(s)} → ${bad.join(' | ')}`); break; } else pass++;
}
console.log(`  (20 000 entradas al azar en ${Date.now() - t0} ms; la más lenta, ${worst.toFixed(1)} ms)`);

// ── 3) entradas hostiles enormes no se eternizan ───────────────────────────────────────────────────────────────────────────────
const BIG = { 'a×60000': 'a'.repeat(60000), '*×30000': '*'.repeat(30000), '[×30000': '['.repeat(30000), '**a ×15000': '**a '.repeat(15000), '_×30000': '_'.repeat(30000), '|×30000': '|'.repeat(30000), '`×30000': '`'.repeat(30000),
  '[a](×10000': '[a]('.repeat(10000), '![×10000': '![a]('.repeat(10000), '- ×20000': '- a\n'.repeat(20000), '> ×20000': '> a\n'.repeat(20000), '| a |×5000': ('| a | b |\n|---|---|\n' + '| 1 | 2 |\n'.repeat(5)).repeat(3000), '# ×20000': '# t\n'.repeat(20000), '\\×30000': '\\'.repeat(30000), '<×30000': '<'.repeat(30000), ' ×60000': ' '.repeat(60000) + 'x' };
for (const [name, s] of Object.entries(BIG)) {
  const t1 = performance.now();
  const html = render(s, { tableLabel: 'Tabla' });
  const ms = performance.now() - t1;
  ok(ms < 1500, `entrada enorme «${name}» tardó ${ms.toFixed(0)} ms (máximo 1500)`);
  ok(audit(html).length === 0, `entrada enorme «${name}» sacó HTML no permitido`);
}

console.log(`pruebas del conversor del blog: ${pass} comprobaciones correctas, ${fail} fallos`);
process.exit(fail ? 1 : 0);
