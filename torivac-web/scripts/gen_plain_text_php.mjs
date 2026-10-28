#!/usr/bin/env node
// [GEN-PLAIN-TEXT-PHP] Escribe backend-php/api/lib/PlainTextRules.php a partir de shared/plain-text.mjs: las MISMAS expresiones, límites y rangos de caracteres para el servidor PHP.
//   node scripts/gen_plain_text_php.mjs            reescribe el archivo
//   node scripts/gen_plain_text_php.mjs --check    no escribe; sale con 1 si el archivo está desfasado
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS, MAX_LINKS, SYMBOL_MIN_LENGTH, SYMBOL_MAX_RATIO, INVISIBLE, RULES } from '../shared/plain-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'backend-php', 'api', 'lib', 'PlainTextRules.php');
/** Cadena PHP entre comillas simples (escapa \ y '). */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
/** Clase PCRE de los rangos de puntos de código invisibles. */
const invisibleClass = '[' + INVISIBLE.map(([a, b]) => (a === b ? `\\x{${a.toString(16)}}` : `\\x{${a.toString(16)}}-\\x{${b.toString(16)}}`)).join('') + ']';

/** Texto del archivo PHP. */
function build() {
  const fields = Object.entries(FIELDS).map(([f, o]) => `        ${q(f)} => [${Object.entries(o).map(([k, v]) => `${q(k)} => ${v}`).join(', ')}],`).join('\n');
  const rules = RULES.map((r) => `        [${q(r.id)}, ${q(r.re)}, ${q(r.flags)}],`).join('\n');
  return `<?php
/**
 * [PLAIN-TEXT-RULES] GENERADO por scripts/gen_plain_text_php.mjs desde shared/plain-text.mjs (no editar a mano: se regenera con \`node scripts/gen_plain_text_php.mjs\`).
 * Las mismas expresiones, límites y rangos de caracteres invisibles que usan el navegador y el Worker; PlainText.php las aplica.
 */
namespace Torivac;

final class PlainTextRules
{
    /** Límite de caracteres de cada campo de cada formulario. */
    const FIELDS = [
${fields}
    ];
    /** Enlaces que se admiten en un mismo texto. */
    const MAX_LINKS = ${MAX_LINKS};
    /** Longitud mínima para mirar la proporción de signos de programación. */
    const SYMBOL_MIN_LENGTH = ${SYMBOL_MIN_LENGTH};
    /** Proporción máxima de signos de programación. */
    const SYMBOL_MAX_RATIO = ${SYMBOL_MAX_RATIO};
    /** Clase PCRE (con /u) de los caracteres de control e invisibles que se eliminan. */
    const INVISIBLE = ${q(invisibleClass)};
    /** Reglas que rechazan el texto: [id, expresión, indicadores]. */
    const RULES = [
${rules}
    ];
}
`;
}

const text = build();
if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have !== text) { console.error('✗ backend-php/api/lib/PlainTextRules.php está desfasado: ejecuta `node scripts/gen_plain_text_php.mjs`'); process.exit(1); }
  console.log('✓ PlainTextRules.php al día');
} else {
  fs.writeFileSync(OUT, text);
  console.log('escrito ' + path.relative(ROOT, OUT));
}
