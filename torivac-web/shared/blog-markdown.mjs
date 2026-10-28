// [BLOG-MD] Conversor de texto (Markdown reducido) a HTML para las entradas del blog que se escriben en el panel.
// LA MISMA lógica vive en PHP (backend-php/api/lib/BlogMarkdown.php): shared/blog-markdown.fixtures.json es el contrato que cumplen las dos
// (scripts/test-blog-markdown.mjs y backend-php/api/tests/BlogMarkdownTest.php lo recorren). Si cambia una regla aquí, cambia en los dos y en las pruebas.
// El panel (assets/js/blog-markdown.js, generado por site/build.mjs) lo usa para la vista previa; el servidor, para la página que se publica.
//
// SEGURIDAD: TODO el texto se escapa; solo se emiten las etiquetas de abajo y los enlaces/imágenes solo admiten esquemas seguros. Si algo no encaja, sale como texto (nunca como HTML).
//   Bloques  # ## ### #### títulos (# y ## → h2: el h1 de la página es el título de la entrada) · párrafos · - * + listas · 1. 2) listas numeradas · > cita · --- línea · tablas con | · ![texto](imagen "pie")
//   En línea **negrita** · *cursiva* (o _cursiva_) · `código` · [texto](https://… | /ruta | #ancla | mailto: | tel:) · \* para escribir el signo tal cual
// Sin HTML en el texto, sin listas anidadas, sin código en bloque: lo que un blog técnico necesita y nada que pueda romper la página.
// La dirección de un enlace o imagen no lleva límite en la expresión (PCRE no admite repeticiones tan grandes de un grupo): safeUrl() la descarta si pasa de 2000 caracteres y queda solo el texto.
// PARIDAD CON PHP: todas las expresiones llevan el indicador `u` (cuentan CÓDIGOS DE PUNTO, como PCRE con /u) y los largos se cuentan en códigos de punto; `clean()` quita antes los caracteres de control e invisibles.

/** Escapa & < > " para texto y atributos. */
export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Quita los caracteres de control (salvo tabulador y salto de línea), los separadores de línea Unicode, los invisibles y las marcas de dirección de texto, y unifica los saltos de línea: lo que el conversor nunca debe ver. */
export const clean = (s) => String(s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/gu, '');

const STASH_OPEN = '\u0001';
const STASH_CLOSE = '\u0002';

/** Dirección permitida en un enlace, o null. Admite https://, http://, mailto:, tel:, /ruta (no //), #ancla. */
export function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s || Array.from(s).length > 2000 || /[\s"<>\\\u0000-\u001f]/u.test(s)) return null;
  if (/^[Hh][Tt][Tt][Pp][Ss]?:\/\/[^/?#]+/u.test(s)) return s;
  if (/^[Mm][Aa][Ii][Ll][Tt][Oo]:[^\s@]+@[^\s@]+$/u.test(s)) return s;
  if (/^[Tt][Ee][Ll]:[+0-9()-]+$/u.test(s)) return s;
  if (/^\/(?!\/)/u.test(s)) return s;
  if (/^#[A-Za-z0-9_-]+$/u.test(s)) return s;
  return null;
}

/** Dirección permitida en una imagen, o null: https:// o una ruta del propio sitio (/media/blog/…). */
export function safeImageUrl(u) {
  const s = safeUrl(u);
  return s && /^([Hh][Tt][Tt][Pp][Ss]:\/\/|\/)/u.test(s) ? s : null;
}

/** <img> de una imagen en Markdown (o null si la dirección no vale). `o.imgAttrs(src)` puede devolver width/height ya escapados (el servidor los conoce). */
function imgHtml(alt, url, o) {
  const src = safeImageUrl(url);
  if (!src) return null;
  const extra = typeof o.imgAttrs === 'function' ? o.imgAttrs(src) || '' : '';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${extra} loading="lazy" decoding="async">`;
}

const WORD = /[A-Za-z0-9À-ɏ]/u;
const SPACE = /\s/u;
/** Negrita y cursiva (** __ * _ y *** para las dos) con anidación SIEMPRE bien formada: un emparejamiento con pila; lo que no cierra se queda como texto. Trabaja sobre texto ya escapado. */
function emphasis(s) {
  const ch = Array.from(s);
  const out = [];                                   // trozos de texto o delimitadores { c, n, role }
  const stack = [];                                 // posiciones en `out` de delimitadores abiertos (como mucho 200; se mira como mucho los 24 de arriba)
  let text = '';
  /** Pasa el texto acumulado a la lista de trozos. */
  const flush = () => { if (text) { out.push(text); text = ''; } };
  let i = 0;
  while (i < ch.length) {
    const c = ch[i];
    if (c !== '*' && c !== '_') { text += c; i++; continue; }
    let j = i;
    while (j < ch.length && ch[j] === c) j++;
    const run = j - i;
    const before = i > 0 ? ch[i - 1] : '', after = j < ch.length ? ch[j] : '';
    let canOpen = after !== '' && !SPACE.test(after), canClose = before !== '' && !SPACE.test(before);
    if (c === '_') { canOpen = canOpen && !WORD.test(before); canClose = canClose && !WORD.test(after); }
    i = j;
    if (run > 3) { text += c.repeat(run); continue; }
    flush();
    // ***x*** = cursiva por fuera y negrita por dentro: al abrir se apila 1 y luego 2; al cerrar se cierra 2 y luego 1
    const sizes = run === 3 ? (canOpen && !canClose ? [1, 2] : canClose && !canOpen ? [2, 1] : null) : [run];
    if (!sizes) { text += c.repeat(run); continue; }
    for (const n of sizes) {
      const d = { c, n, role: '' };
      out.push(d);
      let closed = false;
      if (canClose && (run !== 3 || sizes[0] === 2)) {
        for (let k = stack.length - 1; k >= 0 && k >= stack.length - 24; k--) {
          const o = out[stack[k]];
          if (o.c === c && o.n === n) { o.role = 'o'; d.role = 'c'; stack.length = k; closed = true; break; }
        }
      }
      if (!closed && canOpen && (run !== 3 || sizes[0] === 1) && stack.length < 200) { d.role = 'p'; stack.push(out.length - 1); }
    }
  }
  flush();
  return out.map((x) => {
    if (typeof x === 'string') return x;
    const tag = x.n === 2 ? 'strong' : 'em';
    return x.role === 'c' ? `</${tag}>` : x.role === 'o' ? `<${tag}>` : x.c.repeat(x.n);     // los que no se emparejaron se quedan como texto
  }).join('');
}

/** Texto en línea (negrita, cursiva, código, enlaces, imágenes) → HTML ya escapado. */
export function inline(text, o = {}) {
  const stash = [];
  /** Guarda un trozo de HTML ya seguro y devuelve su marca de posición. */
  const put = (html) => { stash.push(html); return STASH_OPEN + (stash.length - 1) + STASH_CLOSE; };
  let s = clean(text);
  // 1) código: lo de dentro no se interpreta
  s = s.replace(/`([^`\n]+)`/gu, (m, c) => put(`<code>${escapeHtml(c)}</code>`));
  // 2) imágenes ![texto](dirección "pie")
  s = s.replace(/(?<!\\)!\[([^\]\n]{0,300})\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"\n]{0,300}")?\)/gu, (m, alt, url) => { const h = imgHtml(alt, url, o); return h ? put(h) : alt; });
  // 3) enlaces [texto](dirección "título"): las marcas de apertura y cierre se guardan aparte y el texto sigue su camino (así admite negrita dentro)
  s = s.replace(/(?<!\\)\[([^\]\n]{1,300})\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"([^"\n]{0,300})")?\)/gu, (m, txt, url, title) => {
    const href = safeUrl(url);
    if (!href) return txt;
    const ext = /^[Hh][Tt][Tt][Pp][Ss]?:/u.test(href) ? ' target="_blank" rel="noopener"' : '';
    return put(`<a href="${escapeHtml(href)}"${ext}${title ? ` title="${escapeHtml(title)}"` : ''}>`) + txt + put('</a>');
  });
  // 4) \* \_ \[ … → el signo tal cual
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/gu, (m, c) => put(escapeHtml(c)));
  // 5) todo lo demás es texto
  s = escapeHtml(s);
  // 6) énfasis
  s = emphasis(s);
  // 7) saltos de línea forzados y devolver lo guardado
  s = s.replace(/(?:(?<! ) {2,}|\\)\n/gu, '<br>\n').replace(/\n/gu, ' ').replace(/<br> /gu, '<br>');
  return s.replace(/\u0001([0-9]+)\u0002/gu, (m, n) => stash[+n]);
}

// ── bloques ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** ¿La línea está vacía o solo tiene espacios? */
const isBlank = (l) => /^\s*$/u.test(l);
const HEADING = /^(#{1,6})[ ]+(.{1,300}?)[ #]*$/u;
const RULE = /^ {0,3}([-*_])( ?\1){2,}\s*$/u;
const QUOTE = /^ {0,3}>/u;
const ITEM = /^ {0,3}([-*+]|[0-9]{1,9}[.)])[ ]+(.*)$/u;
const SEP = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/u;
const FIGURE = /^!\[([^\]\n]{0,300})\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"([^"\n]{0,300})")?\)$/u;

/** Celdas de una fila de tabla (\| escapa la barra). */
function splitRow(l) {
  let t = l.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/u).map((c) => c.trim().replace(/\\\|/gu, '|'));
}
/** ¿Esta línea y la siguiente abren una tabla? (una fila con barras y debajo la fila de guiones con las mismas columnas) */
const startsTable = (lines, i) => lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && SEP.test(lines[i + 1].trim()) && splitRow(lines[i]).length === splitRow(lines[i + 1]).length;
/** ¿Esta línea empieza un bloque distinto de un párrafo? */
const startsBlock = (lines, i) => HEADING.test(lines[i]) || RULE.test(lines[i]) || QUOTE.test(lines[i]) || ITEM.test(lines[i]) || startsTable(lines, i);

/** Markdown reducido → HTML. Opciones: tableLabel (nombre accesible de las tablas, «Tabla»), imgAttrs(src) (width/height de las imágenes que el servidor conoce). */
export function render(md, o = {}) {
  const lines = clean(md).replace(/\t/gu, '    ').split('\n');
  const label = o.tableLabel || 'Tabla';
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    let m = HEADING.exec(line);
    if (m) { const n = m[1].length <= 2 ? 2 : m[1].length === 3 ? 3 : 4; out.push(`<h${n}>${inline(m[2], o)}</h${n}>`); i++; continue; }
    if (RULE.test(line)) { out.push('<hr>'); i++; continue; }
    if (startsTable(lines, i)) {
      const head = splitRow(lines[i]);
      const cols = head.length;
      i += 2;
      const rows = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) { const r = splitRow(lines[i]); while (r.length < cols) r.push(''); rows.push(r.slice(0, cols)); i++; }
      const th = head.map((c) => `<th>${inline(c, o)}</th>`).join('');
      const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, o)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="tbl-wrap" tabindex="0" role="region" aria-label="${escapeHtml(label)}"><table class="spec"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }
    if (QUOTE.test(line)) {
      const paras = [[]];
      while (i < lines.length && QUOTE.test(lines[i])) { const t = lines[i].replace(/^ {0,3}> ?/u, ''); if (isBlank(t)) paras.push([]); else paras[paras.length - 1].push(t); i++; }
      out.push(`<blockquote>${paras.filter((p) => p.length).map((p) => `<p>${inline(p.join('\n'), o)}</p>`).join('')}</blockquote>`);
      continue;
    }
    m = ITEM.exec(line);
    if (m) {
      const ordered = /^[0-9]/u.test(m[1]);
      const items = [];
      while (i < lines.length) {
        const mm = ITEM.exec(lines[i]);
        if (mm && /^[0-9]/u.test(mm[1]) === ordered) { items.push(mm[2]); i++; continue; }
        if (!mm && !isBlank(lines[i]) && /^ {2,}\S/u.test(lines[i]) && items.length) { items[items.length - 1] += '\n' + lines[i].trim(); i++; continue; }   // continuación del elemento anterior
        if (isBlank(lines[i]) && i + 1 < lines.length) { const nx = ITEM.exec(lines[i + 1]); if (nx && /^[0-9]/u.test(nx[1]) === ordered) { i++; continue; } }   // línea en blanco entre elementos de la misma lista
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t, o)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !startsBlock(lines, i))) { para.push(lines[i]); i++; }
    const text = para.join('\n').trim();
    const f = FIGURE.exec(text);
    if (f) {
      const img = imgHtml(f[1], f[2], o);
      if (img) { out.push(`<figure>${img}${f[3] ? `<figcaption>${escapeHtml(f[3])}</figcaption>` : ''}</figure>`); continue; }
    }
    out.push(`<p>${inline(text, o)}</p>`);
  }
  return out.join('\n');
}

/** Texto plano de un trozo de HTML del conversor (sin etiquetas, sin entidades y con los espacios normalizados). */
function plainOfHtml(html) {
  return html
    .replace(/<\/(p|h[2-4]|li|tr|th|td|blockquote|figure|figcaption)>/gu, ' ')
    .replace(/<br>/gu, ' ')
    .replace(/<[^>]+>/gu, '')
    .replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&amp;/gu, '&')
    .replace(/\s+/gu, ' ').trim();
}
/** Texto de hasta `n` caracteres cortado en una palabra entera (con «…» si se recorta). */
function cutAtWord(text, n) {
  const t = Array.from(text);
  if (t.length <= n) return t.join('');
  return t.slice(0, n).join('').replace(/\s+\S*$/u, '').replace(/[\s,;:.\-–—]+$/u, '') + '…';
}

/** Texto plano de un Markdown (sin marcas ni etiquetas, espacios normalizados): extracto, longitud y llms.txt. */
export function toPlain(md) {
  return plainOfHtml(render(md, { tableLabel: 'x' }));
}

/** Extracto de hasta `n` caracteres cortado en una palabra entera (con «…» si se recorta). */
export function excerpt(md, n = 155) {
  return cutAtWord(toPlain(md), n);
}

/** Descripción automática: el primer párrafo del texto (sin títulos, listas ni tablas) cortado en una palabra entera; si no hay párrafos, el extracto de todo. Es lo que se usa cuando no se escribe resumen ni descripción para buscadores. */
export function lead(md, n = 155) {
  const html = render(md, { tableLabel: 'x' });
  const m = /<p>([\s\S]*?)<\/p>/u.exec(html);
  return cutAtWord(plainOfHtml(m ? m[1] : html), n);
}

const FOLD = { 'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i', 'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o', 'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'ñ': 'n', 'ç': 'c', 'ß': 'ss', 'œ': 'oe', 'æ': 'ae' };
/** Título → dirección: minúsculas, sin acentos, letras y cifras separadas por guiones, hasta 80 caracteres (cortado en un guion). */
export function slugify(title) {
  let s = String(title).toLowerCase().replace(/[áàäâãåéèëêíìïîóòöôõúùüûñçßœæ]/g, (c) => FOLD[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).replace(/-[^-]*$/, '') || s.slice(0, 80);
  return s.replace(/-+$/, '');
}
