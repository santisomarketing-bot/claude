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
import { findHeader } from './price-sheet.mjs';

const td = new TextDecoder();
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

/** contenido de una entrada del zip (sin comprimir o deflate) como texto UTF-8 */
async function entryText(bytes, ent) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u32(dv, ent.off) !== 0x04034b50) throw new Error('El libro .xlsx está dañado (cabecera local)');
  const start = ent.off + 30 + u16(dv, ent.off + 26) + u16(dv, ent.off + 28);
  const raw = bytes.subarray(start, start + ent.csize);
  if (ent.method === 0) return td.decode(raw);
  if (ent.method !== 8) throw new Error('El libro .xlsx usa una compresión que no se soporta');
  return td.decode(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** entidades XML → texto (&amp; &lt; &#233; &#xE9;) */
const unesc = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, g) => (g[0] === '#' ? String.fromCodePoint(g[1] === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10)) : ENT[g]));
/** atributos de una etiqueta XML: ' r="A1" t="s"' → { r: 'A1', t: 's' } */
const attrs = (s) => { const o = {}; for (const m of s.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) o[m[1]] = unesc(m[2]); return o; };
/** texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta */
const tText = (xml) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>\/]*)?>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join('');
/** letras de columna → posición: A=0, Z=25, AA=26 */
const colIndex = (ref) => { let n = 0; for (const ch of /^[A-Z]+/i.exec(ref || '')?.[0] || '') n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64); return n - 1; };

/** celdas de una hoja → filas (ver cabecera) */
function sheetRows(xml, shared) {
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (!rm[1]) continue;
    const row = []; let next = 0;
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(cm[1]), body = cm[2] || '';
      const col = a.r ? colIndex(a.r) : next;
      next = col + 1;
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = '';
      if (a.t === 'inlineStr') val = tText(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] || '');
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
  const z = zipEntries(bytes);
  /** Texto de una entrada del zip por su nombre ('' si no existe). */
  const text = async (name) => { const e = z.get(name); return e ? entryText(bytes, e) : ''; };
  const wb = await text('xl/workbook.xml');
  if (!wb) throw new Error('El fichero es un zip pero no un libro de Excel (.xlsx)');
  const rels = {};
  for (const m of (await text('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b([^>]*?)\/?>/g)) { const a = attrs(m[1]); if (a.Id) rels[a.Id] = a.Target; }
  const shared = [...(await text('xl/sharedStrings.xml')).matchAll(/<si(?:\s[^>\/]*)?>([\s\S]*?)<\/si>/g)].map((m) => tText(m[1]));
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1]);
    let target = rels[a['r:id']];
    if (!target) continue;
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = await text(target);
    sheets.push({ name: a.name, hidden: a.state === 'hidden' || a.state === 'veryHidden', rows: sheetRows(xml, shared) });
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
