#!/usr/bin/env node
// [TEST-PLAIN-TEXT] Pruebas del validador de texto plano de los formularios (shared/plain-text.mjs) contra su contrato (shared/plain-text.fixtures.json), que también cumple el servidor PHP.
// Además comprueba que backend-php/api/lib/PlainTextRules.php está al día y que ningún texto razonable de las pruebas de aceptación se rechaza.
//   node scripts/test-plain-text.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkText, normalizeText } from '../shared/plain-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'plain-text.fixtures.json'), 'utf8'));
let pass = 0, fail = 0;
/** Anota una comprobación: correcta, o fallo con su mensaje. */
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };

for (const c of fx.accept) { const r = checkText(c.text, { max: 1000, multiline: c.multiline }); ok(r.ok, `debería aceptarse «${c.name}» (${r.code})`); }
for (const c of fx.reject) { const r = checkText(c.text, { max: 1000, multiline: true }); ok(!r.ok && r.code === c.code, `debería rechazarse «${c.name}» con ${c.code} (dio ${r.ok ? 'aceptado' : r.code})`); }
for (const c of fx.normalize) { const got = normalizeText(c.text, c.multiline); ok(got === c.out, `normalizar «${c.name}»: esperado ${JSON.stringify(c.out)}, obtenido ${JSON.stringify(got)}`); }
for (const c of fx.limits) { const r = checkText(c.text, { max: c.max, multiline: c.multiline }); ok(r.ok === c.ok && (c.ok || r.code === 'too_long'), `límite «${c.name}»`); }
// null/undefined = campo ausente: válido y vacío
ok(checkText(undefined).ok && checkText(null).text === '', 'ausente = vacío válido');
// el archivo PHP generado está al día
const gen = spawnSync('node', [path.join(ROOT, 'scripts', 'gen_plain_text_php.mjs'), '--check'], { encoding: 'utf8' });
ok(gen.status === 0, 'backend-php/api/lib/PlainTextRules.php desfasado: node scripts/gen_plain_text_php.mjs');
// rendimiento: textos hostiles largos no se eternizan
for (const [name, s] of Object.entries({ 'a×60000': 'a'.repeat(60000), '<×30000': '<'.repeat(30000), '(×30000': '('.repeat(30000), '$(×20000': '$('.repeat(20000), '`×30000': '`'.repeat(30000), 'or ×20000': 'or '.repeat(20000), '; ×20000': '; '.repeat(20000), '<a ×10000': '<a '.repeat(10000), 'http ×20000': 'http://'.repeat(20000), '\\×30000': '\\'.repeat(30000) })) {
  const t0 = performance.now();
  checkText(s, { max: 1e9, multiline: true });
  const ms = performance.now() - t0;
  ok(ms < 1500, `texto enorme «${name}» tardó ${ms.toFixed(0)} ms`);
}
console.log(`pruebas del validador de texto plano: ${pass} comprobaciones correctas, ${fail} fallos`);
process.exit(fail ? 1 : 0);
