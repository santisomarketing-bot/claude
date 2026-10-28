// [XLSX] Lector mínimo de libros .xlsx (un zip con XML) SIN dependencias: lo usa el Worker para leer la tarifa directamente de Drive
// (descarga del .xlsx tal cual, sin convertirlo a hoja de Google). Port en PHP: backend-php/api/lib/Xlsx.php. Ambos se prueban contra los mismos
// libros (shared/xlsx/*.xlsx, generados por scripts/make_xlsx_fixtures.py) y el mismo resultado esperado (shared/xlsx/esperado.json).
//
//   readXlsx(bytes: Uint8Array) → Promise<[{ name, hidden, rows }]>   hojas en el orden del libro; rows = filas con contenido
//   pickSheet(sheets, name?)   → { name, rows }                      la hoja pedida por nombre o, si no hay nombre, la primera visible con cabecera de precios
//
// Valores: texto (cadenas compartidas, «inline», resultado de fórmula; el texto enriquecido se une y la fonética se ignora), números (JS number),
// booleanos y '' en las celdas intermedias vacías. Se descartan las filas sin contenido y las celdas vacías del final de cada fila.
// No soporta: zip64, libros cifrados, .xls antiguo (el servidor responde con un error claro).
// TOPES contra libros hostiles o dañados (error «La hoja es demasiado grande o está dañada»): 20 MB descomprimidos por entrada (se cuentan al descomprimir y se aborta al pasarse) y 64 MB por libro,
// columna ≤ 16 384 (XFD), ≤ 200 000 filas, ≤ 4 000 000 celdas (con las vacías de relleno), ≤ 256 hojas. El XML se recorre con indexOf (tiempo lineal, sin expresiones regulares que retrocedan sobre etiquetas sin cerrar).
import { findHeader } from './price-sheet.mjs';

const td = new TextDecoder();
const MAX_ENTRY = 20_000_000, MAX_TOTAL = 64_000_000, MAX_COLS = 16_384, MAX_ROWS = 200_000, MAX_CELLS = 4_000_000, MAX_SHEETS = 256, MAX_TAG = 4096;
const TOO_BIG = 'La hoja es demasiado grande o está dañada';
/** Enteros little-endian de 16 y 32 bits en la posición o de un DataView (formato del zip). */
const u16 = (d, o) => d.getUint16(o, true), u32 = (d, o) => d.getUint32(o, true);

/** índice del contenido del zip por nombre: { método, tamaño comprimido, posición de la cabecera local } (se lee del directorio central, al final del fichero) */
function zipEntries(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (u32(dv, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('El fichero no es un libro .xlsx (no es un zip válido)');
  const n = u16(dv, e + 10); let p = u32(dv, e + 16);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    if (p + 46 > bytes.length || u32(dv, p) !== 0x02014b50) throw new Error('El libro .xlsx está dañado (directorio del zip)');
    const nlen = u16(dv, p + 28), xlen = u16(dv, p + 30), clen = u16(dv, p + 32);
    out.set(td.decode(bytes.subarray(p + 46, p + 46 + nlen)), { method: u16(dv, p + 10), csize: u32(dv, p + 20), off: u32(dv, p + 42) });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/** descuenta n bytes del presupuesto de descompresión del libro; si se agota → «hoja demasiado grande o dañada» */
function spend(budget, n) { budget.left -= n; if (budget.left < 0) throw new Error(TOO_BIG); }
/** contenido de una entrada del zip (sin comprimir o deflate) como texto UTF-8; la descompresión se lee por trozos CONTANDO y se aborta al pasar de MAX_ENTRY (una bomba de 300 KB → 300 MB no se infla) */
async function entryText(bytes, ent, budget) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u32(dv, ent.off) !== 0x04034b50) throw new Error('El libro .xlsx está dañado (cabecera local)');
  const start = ent.off + 30 + u16(dv, ent.off + 26) + u16(dv, ent.off + 28);
  const raw = bytes.subarray(start, start + ent.csize);
  if (ent.method === 0) { if (raw.length > MAX_ENTRY) throw new Error(TOO_BIG); spend(budget, raw.length); return td.decode(raw); }
  if (ent.method !== 8) throw new Error('El libro .xlsx usa una compresión que no se soporta');
  const reader = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), dec = new TextDecoder(), parts = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > MAX_ENTRY) { await reader.cancel().catch(() => {}); throw new Error(TOO_BIG); }
      parts.push(dec.decode(value, { stream: true }));
    }
  } catch (e) { if (e && e.message === TOO_BIG) throw e; throw new Error('El libro .xlsx está dañado (compresión)'); }
  parts.push(dec.decode());
  spend(budget, total);
  return parts.join('');
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** entidades XML → texto (&amp; &lt; &#233; &#xE9;); un código fuera de rango (&#x110000;) se sustituye por el carácter de sustitución U+FFFD en vez de romper la lectura */
const unesc = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, g) => { if (g[0] !== '#') return ENT[g]; const cp = g[1] === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '\ufffd'; });
/** True si el código de carácter c puede ir en un nombre de atributo XML: letras, cifras, «_», «:», «.» y «-» */
const nameCh = (c) => (c >= 48 && c <= 58) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 46 || c === 45;
/** atributos de una etiqueta XML: ' r="A1" t="s"' → { r: 'A1', t: 's' } (recorrido lineal; solo comillas dobles, como escribe Excel) */
function attrs(s) {
  const o = Object.create(null), n = s.length; let i = 0;
  while (i < n) {
    let j = i; while (j < n && nameCh(s.charCodeAt(j))) j++;
    if (j === i) { i++; continue; }
    let k = j; while (k < n && s.charCodeAt(k) <= 32) k++;
    if (s[k] !== '=') { i = j; continue; }
    k++; while (k < n && s.charCodeAt(k) <= 32) k++;
    if (s[k] !== '"') { i = k; continue; }
    const e = s.indexOf('"', k + 1); if (e < 0) break;
    o[s.slice(i, j)] = unesc(s.slice(k + 1, e)); i = e + 1;
  }
  return o;
}
/** posición de la siguiente apertura «<etiqueta» (seguida de espacio, «>» o «/», para no confundir <c con <cols) desde `from`, o -1 */
function findOpen(xml, open, from) {
  for (let i = xml.indexOf(open, from); i >= 0; i = xml.indexOf(open, i + open.length)) {
    const c = xml.charCodeAt(i + open.length);
    if (c === 62 || c === 47 || c === 32 || c === 9 || c === 10 || c === 13) return i;
  }
  return -1;
}
/** Recorre los elementos «<tag …>…</tag>» y los autocerrados «<tag …/>» de xml[from, to) en orden y en tiempo LINEAL → { attr, bs, be }: texto de los atributos y rango del contenido (bs = be si no tiene). Una etiqueta sin cerrar = libro dañado. */
function* each(xml, tag, from = 0, to = xml.length) {
  const open = '<' + tag, close = '</' + tag + '>'; let p = from;
  for (;;) {
    const o = findOpen(xml, open, p); if (o < 0 || o >= to) return;
    const gt = xml.indexOf('>', o); if (gt < 0 || gt >= to || gt - o > MAX_TAG) throw new Error(TOO_BIG);
    const attr = xml.slice(o + open.length, gt);
    if (xml.charCodeAt(gt - 1) === 47) { p = gt + 1; yield { attr: attr.slice(0, -1), bs: gt + 1, be: gt + 1 }; continue; }
    const c = xml.indexOf(close, gt + 1); if (c < 0 || c >= to) throw new Error(TOO_BIG);
    p = c + close.length; yield { attr, bs: gt + 1, be: c };
  }
}
/** lo que hay entre la primera apertura `open` y el `close` que le sigue (por ejemplo <v>…</v>), o undefined si no hay */
const between = (s, open, close) => { const i = s.indexOf(open); if (i < 0) return undefined; const j = s.indexOf(close, i + open.length); return j < 0 ? undefined : s.slice(i + open.length, j); };
/** texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta (recorrido lineal) */
function tText(xml) {
  let s = xml;
  if (s.includes('<rPh')) {
    let out = '', p = 0;
    for (;;) { const i = findOpen(s, '<rPh', p); if (i < 0) break; const j = s.indexOf('</rPh>', i); if (j < 0) break; out += s.slice(p, i); p = j + 6; }
    s = out + s.slice(p);
  }
  let out = '', p = 0;
  for (;;) {
    const i = findOpen(s, '<t', p); if (i < 0) break;
    const gt = s.indexOf('>', i); if (gt < 0) break;
    if (gt - i > MAX_TAG || s.charCodeAt(gt - 1) === 47) { p = gt + 1; continue; }
    const c = s.indexOf('</t>', gt + 1); if (c < 0) break;
    out += unesc(s.slice(gt + 1, c)); p = c + 4;
  }
  return out;
}
/** cadenas compartidas del libro (xl/sharedStrings.xml): el texto de cada <si>, en orden */
function sharedStrings(xml) {
  const out = []; let p = 0;
  for (;;) {
    const o = findOpen(xml, '<si', p); if (o < 0) break;
    const gt = xml.indexOf('>', o); if (gt < 0 || gt - o > MAX_TAG) throw new Error(TOO_BIG);
    if (xml.charCodeAt(gt - 1) === 47) { p = gt + 1; continue; }
    const c = xml.indexOf('</si>', gt + 1); if (c < 0) throw new Error(TOO_BIG);
    out.push(tText(xml.slice(gt + 1, c))); p = c + 5;
  }
  return out;
}
/** letras de columna → posición: A=0, Z=25, AA=26 … XFD=16383; una columna por encima de XFD (o con tantas letras que lo parezca) = libro dañado */
const colIndex = (ref) => { let n = 0; const m = /^[A-Z]+/i.exec(ref || ''); for (const ch of m ? m[0] : '') { n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64); if (n > MAX_COLS) throw new Error(TOO_BIG); } return n - 1; };

/** celdas de una hoja → filas (ver cabecera); con topes de filas, columnas y celdas */
function sheetRows(xml, shared) {
  const rows = []; let nRows = 0, cells = 0;
  for (const r of each(xml, 'row')) {
    if (++nRows > MAX_ROWS) throw new Error(TOO_BIG);
    if (r.bs === r.be) continue;
    const row = []; let next = 0;
    for (const c of each(xml, 'c', r.bs, r.be)) {
      const a = attrs(c.attr), body = xml.slice(c.bs, c.be);
      const col = a.r ? colIndex(a.r) : next;
      next = col + 1;
      if (col >= MAX_COLS) throw new Error(TOO_BIG);
      cells += Math.max(1, col + 1 - row.length); if (cells > MAX_CELLS) throw new Error(TOO_BIG);
      const v = between(body, '<v>', '</v>');
      let val = '';
      if (a.t === 'inlineStr') val = tText(between(body, '<is>', '</is>') || '');
      else if (v !== undefined) {
        if (a.t === 's') val = shared[Number(v)] ?? '';
        else if (a.t === 'str' || a.t === 'd') val = unesc(v);
        else if (a.t === 'b') val = v.trim() === '1';
        else if (a.t === 'e') val = '';
        else { const n = Number(v); val = v.trim() === '' ? '' : Number.isFinite(n) ? n : unesc(v); }
      }
      while (row.length < col) row.push('');
      row[col] = val;
    }
    while (row.length && row[row.length - 1] === '') row.pop();
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

/** @returns {Promise<{name:string, hidden:boolean, rows:any[][]}[]>} */
export async function readXlsx(bytes) {
  const z = zipEntries(bytes), budget = { left: MAX_TOTAL };
  /** Texto de una entrada del zip por su nombre ('' si no existe). */
  const text = async (name) => { const e = z.get(name); return e ? entryText(bytes, e, budget) : ''; };
  const wb = await text('xl/workbook.xml');
  if (!wb) throw new Error('El fichero es un zip pero no un libro de Excel (.xlsx)');
  const rels = new Map();
  for (const m of each(await text('xl/_rels/workbook.xml.rels'), 'Relationship')) { const a = attrs(m.attr); if (a.Id) rels.set(a.Id, a.Target); }
  const shared = sharedStrings(await text('xl/sharedStrings.xml'));
  const sheets = []; let nSheets = 0;
  for (const m of each(wb, 'sheet')) {
    if (++nSheets > MAX_SHEETS) throw new Error(TOO_BIG);
    const a = attrs(m.attr);
    let target = rels.get(a['r:id']);
    if (!target) continue;
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = await text(target);
    sheets.push({ name: a.name ?? '', hidden: a.state === 'hidden' || a.state === 'veryHidden', rows: sheetRows(xml, shared) });
  }
  return sheets;
}

/** elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio */
export function pickSheet(sheets, name = '') {
  const want = String(name || '').trim().toLowerCase();
  if (want) {
    const s = sheets.find((x) => x.name.trim().toLowerCase() === want);
    if (!s) throw new Error(`El libro no tiene la hoja «${name}» (hojas: ${sheets.map((x) => x.name).join(', ') || 'ninguna'})`);
    return s;
  }
  const s = sheets.find((x) => !x.hidden && findHeader(x.rows));
  if (!s) throw new Error(`Ninguna hoja visible del libro tiene las columnas de referencia y de precio (hojas: ${sheets.map((x) => x.name).join(', ') || 'ninguna'})`);
  return s;
}
