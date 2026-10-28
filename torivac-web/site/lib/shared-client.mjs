// [SHARED-CLIENT] Convierte un módulo ES de shared/ (la lógica que comparten el navegador, el Worker y el servidor PHP) en un script clásico para el navegador: sin `export`, dentro de una
// función propia y colgado de TV.<nombre>. Así el navegador usa EXACTAMENTE el código que usan el servidor y el Worker (y las mismas pruebas con los mismos casos).
//   classicScript(raíz, 'plain-text.mjs', { title, expose, patches }) → texto del script
// `patches` son cambios de texto exactos [buscar, poner] para lo que solo el navegador necesita; si el texto a buscar ya no está en el módulo, falla (nunca se queda a medias en silencio).
import fs from 'node:fs';
import path from 'node:path';

/** Texto del script clásico generado desde shared/<file>. `expose` es la expresión del objeto que se publica (p. ej. `{ check: checkText }`) en TV.<global>. */
export function classicScript(root, file, { title, global, expose, patches = [] }) {
  let src = fs.readFileSync(path.join(root, 'shared', file), 'utf8');
  for (const [from, to] of patches) {
    if (!src.includes(from)) throw new Error(`shared-client: ya no existe en shared/${file} el texto a cambiar: ${from.slice(0, 60)}…`);
    src = src.replace(from, to);
  }
  src = src.replace(/^export (const|function) /gm, '$1 ');
  if (/^export /m.test(src)) throw new Error(`shared-client: shared/${file} tiene un «export» que no se sabe convertir`);
  return `/* [${title}] GENERADO desde shared/${file} por site/build.mjs — no editar a mano */\n(function () {\n'use strict';\n${src}\nwindow.TV = window.TV || {}; TV.${global} = ${expose};\n})();\n`;
}

/** Script del validador de texto plano: TV.PlainText.check(valor, { max, multiline }) y los límites de cada campo. En un navegador sin lookbehind en las expresiones regulares (Safari < 16.4) se omiten las reglas que no entiende: el aviso es solo una cortesía y el servidor las aplica todas siempre. */
export function plainTextScript(root) {
  return classicScript(root, 'plain-text.mjs', {
    title: 'PLAIN-TEXT',
    global: 'PlainText',
    expose: '{ check: checkText, normalize: normalizeText, length: length, FIELDS: FIELDS, MAX_LINKS: MAX_LINKS, active: COMPILED.length, total: RULES.length }',
    patches: [['const COMPILED = RULES.map((r) => new RegExp(r.re, r.flags));', 'const COMPILED = RULES.map((r) => { try { return new RegExp(r.re, r.flags); } catch (e) { return null; } }).filter(Boolean);']],
  });
}

/** Script del conversor de texto del blog: TV.BlogMarkdown.render(texto, { tableLabel }) y compañía (la vista previa del editor del panel usa EXACTAMENTE el código que publica la página). En un navegador sin lookbehind (Safari < 16.4) el script no carga: el panel lo detecta y avisa de que no hay vista previa. */
export function blogMarkdownScript(root) {
  return classicScript(root, 'blog-markdown.mjs', {
    title: 'BLOG-MARKDOWN',
    global: 'BlogMarkdown',
    expose: '{ render: render, inline: inline, toPlain: toPlain, excerpt: excerpt, slugify: slugify, safeUrl: safeUrl, safeImageUrl: safeImageUrl, escapeHtml: escapeHtml, clean: clean }',
  });
}
