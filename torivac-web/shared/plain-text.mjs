// [PLAIN-TEXT] Los formularios públicos (contacto, pedido) aceptan SOLO TEXTO PLANO y con límites: nada de etiquetas HTML, scripts, enlaces en exceso ni líneas de código
// (inyección de HTML/JS, SQL, plantillas, órdenes de consola, rutas…). Es una defensa EN PROFUNDIDAD: la salida ya se escapa siempre (correo, panel, páginas) y no hay SQL;
// esto rechaza de entrada lo que no es un mensaje de una persona y le dice por qué a quien escribe de buena fe.
//
// UNA sola lógica para los tres sitios: el navegador (assets/js/plain-text.js, generado por site/build.mjs, da el aviso al momento), el Worker de Cloudflare (importa este módulo) y el
// servidor PHP (backend-php/api/lib/PlainText.php + PlainTextRules.php, generado por scripts/gen_plain_text_php.mjs). shared/plain-text.fixtures.json es el contrato que cumplen los tres.
// Las expresiones solo usan ASCII y clases explícitas (nada de \s, \w ni \b) para que JS y PCRE den lo mismo; lo no ASCII (caracteres invisibles) va como rangos de puntos de código.
//
//   normalizeText(valor, multilinea) → texto limpio (sin controles ni invisibles, saltos \n, espacios simples)
//   checkText(valor, { max, multiline }) → { ok:true, text } | { ok:false, code:'plain_text'|'too_long'|'too_many_links'|'not_text', text }
//   FIELDS → límite de caracteres de cada campo de cada formulario (el servidor y los atributos maxlength del HTML salen de aquí)

/** Límites por formulario y campo (caracteres, contados como letras: un acento o un emoji cuenta 1). */
export const FIELDS = {
  contact: { name: 80, email: 254, message: 1000 },
  order: { name: 80, company: 120, email: 254, phone: 40, notes: 500 },
};
/** Enlaces (http://, https://, www.) que se admiten en un mismo texto. */
export const MAX_LINKS = 2;
/** Un texto con una proporción alta de signos de programación ({ } [ ] < > \ | ^ ~ ` $ ; =) y al menos esta longitud se toma por código. */
export const SYMBOL_MIN_LENGTH = 15;
export const SYMBOL_MAX_RATIO = 0.2;

/** Rangos [desde, hasta] de puntos de código que se eliminan: controles (salvo tabulador, salto de línea y retorno), separadores de línea y de párrafo Unicode (U+2028 y U+2029), invisibles y marcas de dirección que sirven para ocultar texto. */
export const INVISIBLE = [[0, 8], [11, 12], [14, 31], [127, 159], [173, 173], [8203, 8207], [8232, 8233], [8234, 8238], [8288, 8292], [8294, 8297], [65279, 65279]];

const TAGS = 'script|img|svg|iframe|frame|frameset|object|embed|applet|link|meta|style|base|form|input|button|textarea|select|option|body|html|head|title|a|b|i|u|s|p|div|span|table|tr|td|th|ul|ol|li|h[1-6]|br|hr|audio|video|source|track|math|details|summary|marquee|template|noscript|canvas|xml|use|image|animate|set|isindex|keygen';

/** Reglas que rechazan el texto (cualquiera que case). `re` + `flags` valen igual en JS y en PCRE (ver arriba). Todas dan el mismo código al exterior para no enseñar qué regla saltó. */
export const RULES = [
  { id: 'markup-tag', re: `<[ \\t\\r\\n]*/?[ \\t\\r\\n]*(?:${TAGS})(?=[ \\t\\r\\n/>])[^>]*>`, flags: 'i' },
  { id: 'markup-close', re: '<[ \\t\\r\\n]*/[ \\t\\r\\n]*[A-Za-z]', flags: '' },
  { id: 'markup-special', re: '<[!?%]', flags: '' },
  { id: 'markup-attr', re: '<[A-Za-z][A-Za-z0-9:_-]*[ \\t\\r\\n/]+[A-Za-z_:][A-Za-z0-9_:.-]*[ \\t\\r\\n]*=', flags: '' },
  { id: 'markup-open', re: '<[ \\t]*(?:script|iframe|img|svg|object|embed|style|link|meta|body|html)', flags: 'i' },
  { id: 'markup-entity', re: '&(?:lt|gt|#0*(?:60|62)|#x0*3[ce]);', flags: 'i' },
  { id: 'scheme', re: '(?<![A-Za-z0-9_])(?:javascript|vbscript|livescript)[ \\t\\r\\n]*:', flags: 'i' },
  { id: 'scheme-data', re: '(?<![A-Za-z0-9_])data[ \\t]*:[ \\t]*(?:text|image|application)[ \\t]*/', flags: 'i' },
  { id: 'template', re: '\\{\\{|\\}\\}|\\$\\{|#\\{|\\{%|%\\}', flags: '' },
  { id: 'sql-union', re: '(?<![A-Za-z0-9_])union[ \\t\\r\\n]+(?:all[ \\t\\r\\n]+)?select(?![A-Za-z0-9_])', flags: 'i' },
  { id: 'sql-stacked', re: ';[ \\t\\r\\n]*(?:(?:drop|truncate|alter)[ \\t\\r\\n]+(?:table|database|schema)|delete[ \\t\\r\\n]+from|insert[ \\t\\r\\n]+into|update[ \\t\\r\\n]+[A-Za-z0-9_.]+[ \\t\\r\\n]+set|shutdown(?![A-Za-z0-9_]))', flags: 'i' },
  { id: 'sql-names', re: '(?<![A-Za-z0-9_])(?:information_schema|xp_cmdshell|sysobjects|pg_sleep|waitfor[ \\t]+delay)(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?:sleep|benchmark)[ \\t]*\\([ \\t]*[0-9]', flags: 'i' },
  { id: 'sql-tautology', re: '(?<![A-Za-z0-9_])(?:or|and)[ \\t]+[0-9]+[ \\t]*=[ \\t]*[0-9]+|[\'"][ \\t]*(?:or|and)[ \\t]+[\'"]?[A-Za-z0-9_]+[\'"]?[ \\t]*(?:=|like)[ \\t]*[\'"]?[A-Za-z0-9_%]', flags: 'i' },
  { id: 'shell-subst', re: '\\$\\([^)]{1,200}\\)|`[^`\\n]{1,200}`', flags: '' },
  { id: 'shell-chain', re: '[;&|]{1,2}[ \\t]*(?:cat[ \\t]+/|wget[ \\t]|curl[ \\t]|bash(?![A-Za-z0-9_])|/bin/|nc[ \\t]+-|whoami(?![A-Za-z0-9_])|chmod[ \\t]|rm[ \\t]+-|powershell(?![A-Za-z0-9_])|cmd\\.exe)', flags: 'i' },
  { id: 'path', re: '\\.\\.[/\\\\]|(?<![A-Za-z0-9_])/etc/(?:passwd|shadow|hosts)|/proc/self|(?<![A-Za-z0-9_])[A-Za-z]:\\\\(?:windows|users|inetpub)', flags: 'i' },
  { id: 'script', re: '(?<![A-Za-z0-9_])(?:alert|prompt|confirm|eval|atob|settimeout|setinterval)\\(|document\\.(?:cookie|write|location)|window\\.(?:location|open)|\\.innerHTML|fromCharCode|base64_decode|shell_exec|passthru|phpinfo\\(|\\$_(?:GET|POST|REQUEST|SERVER|COOKIE)|(?<![A-Za-z0-9_])on(?:error|load|click|mouseover|focus|blur|submit|toggle|start|animationstart)[ \\t]*=', flags: 'i' },
];

const COMPILED = RULES.map((r) => new RegExp(r.re, r.flags));
const INVISIBLE_RE = new RegExp('[' + INVISIBLE.map(([a, b]) => (a === b ? `\\u{${a.toString(16)}}` : `\\u{${a.toString(16)}}-\\u{${b.toString(16)}}`)).join('') + ']', 'gu');
const SYMBOLS = /[{}[\]<>\\|^~`$;=]/g;

/** Texto limpio: sin controles ni caracteres invisibles, saltos de línea \n, tabuladores y espacios repetidos como un espacio y, si el campo es de una línea, sin saltos. */
export function normalizeText(value, multiline = false) {
  let s = String(value).replace(INVISIBLE_RE, '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  if (!multiline) s = s.replace(/\n+/g, ' ');
  s = s.replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n').replace(/\n +/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Número de caracteres (puntos de código, no unidades UTF-16 ni bytes). */
export const length = (s) => Array.from(s).length;

/** Revisa un texto de formulario: { ok:true, text } con el texto ya limpio, o { ok:false, code } (`not_text` si ni siquiera es una cadena). Un campo vacío es válido: si es obligatorio lo decide quien llama. */
export function checkText(value, { max = 1000, multiline = false } = {}) {
  if (value === undefined || value === null) return { ok: true, text: '' };
  if (typeof value !== 'string') return { ok: false, code: 'not_text', text: '' };
  const text = normalizeText(value, multiline);
  if (length(text) > max) return { ok: false, code: 'too_long', text };
  if (COMPILED.some((re) => re.test(text))) return { ok: false, code: 'plain_text', text };
  if (length(text) >= SYMBOL_MIN_LENGTH && (text.match(SYMBOLS) || []).length / length(text) > SYMBOL_MAX_RATIO) return { ok: false, code: 'plain_text', text };
  if ((text.match(/(?:https?:\/\/|www\.)[^ \t\r\n]+/gi) || []).length > MAX_LINKS) return { ok: false, code: 'too_many_links', text };
  return { ok: true, text };
}
