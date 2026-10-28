// Constructor mínimo de libros .xlsx para las pruebas (zip con deflate o sin comprimir): sirve para fabricar libros normales y también hostiles (bombas de inflado, celdas enormes, filas sin cerrar).
import zlib from 'node:zlib';

/** Zip en memoria con las entradas [{ name, data (Buffer o texto), stored? }]; deflate salvo stored → Uint8Array. */
export function mkZip(entries) {
  const files = [], central = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name), raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data), body = e.stored ? raw : zlib.deflateRawSync(raw, { level: 9 }), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.stored ? 0 : 8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(e.stored ? 0 : 8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    files.push(lh, name, body); central.push(Buffer.concat([ch, name])); off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...files, cd, end]));
}
/** Libro .xlsx con una hoja «Precios» cuyo contenido de <sheetData> es `sheetData` (texto) y, opcionalmente, cadenas compartidas; extra añade entradas al zip. */
export function mkBook(sheetData, { shared = null, extra = [], sheetName = 'Precios' } = {}) {
  const wb = `<?xml version="1.0"?><workbook xmlns="x" xmlns:r="y"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
  return mkZip([{ name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: rels }, ...(shared ? [{ name: 'xl/sharedStrings.xml', data: shared }] : []), { name: 'xl/worksheets/sheet1.xml', data: `<worksheet><sheetData>${sheetData}</sheetData></worksheet>` }, ...extra]);
}
/** Fila de texto en línea: <row><c r="A1" t="inlineStr"><is><t>…</t></is></c>…</row> con las celdas dadas (números → <v>). */
export const rowXml = (n, cells) => `<row r="${n}">${cells.map((v, i) => { const ref = String.fromCharCode(65 + i) + n; return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`; }).join('')}</row>`;
