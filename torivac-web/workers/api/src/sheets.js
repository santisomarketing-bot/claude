// [SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV.
// Tres modos, en este orden:
//   1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID): hoja de Google → Sheets API v4; si el archivo es un .xlsx subido a Drive sin convertir → se descarga con la API de Drive y se lee el libro
//   2) PRICE_XLSX_URL: descarga directa de un .xlsx (Drive «compartir con enlace»: https://drive.google.com/uc?export=download&id=<ID> · hoja de Google: https://docs.google.com/spreadsheets/d/<ID>/export?format=xlsx)
//   3) PRICE_CSV_URL: exportación CSV pública con enlace
// Libro .xlsx: PRICE_SHEET_NAME elige la hoja; sin nombre se usa la primera visible con columnas de referencia y precio (lector: shared/xlsx.mjs).
// Seguridad: la sincronización se niega a publicar si la hoja nueva tiene < 50 % de las referencias que ya había (hoja vacía/rota) salvo force=true.
import { toB64Url } from './util.js';
import { KEY_CURRENT, KEY_META, loadPrices, readPrices, diffPrices } from './prices.js';
import { readXlsx, pickSheet } from '../../../shared/xlsx.mjs';

const te = new TextEncoder();
/** Texto CSV → filas de celdas: separador «;» o «,» según la primera línea, comillas dobles; omite las filas vacías. */
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split('\n')[0]; const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === delim) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); cell = ''; if (row.some((c) => c !== '')) rows.push(row); row = []; }
    else if (ch !== '\r') cell += ch;
  }
  row.push(cell.trim()); if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}
/** Clave privada PEM (PKCS8) → bytes DER, sin las líneas de cabecera ni espacios. */
const pemToDer = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
/** token de acceso OAuth2 de una cuenta de servicio (JWT RS256 firmado con WebCrypto) */
export async function getAccessToken(sa, fetchImpl = fetch, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = toB64Url(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = toB64Url(te.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = toB64Url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(`${head}.${claim}`))));
  const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }) });
  if (!r.ok) throw new Error(`Google OAuth ${r.status}`);
  return (await r.json()).access_token;
}
/** filas de la hoja de precios de un libro .xlsx descargado (bytes) → { rows, sheet }; si no es un libro, el error dice qué revisar */
async function xlsxRows(bytes, name, hint) {
  let sheets;
  try { sheets = await readXlsx(bytes); } catch (e) { throw new Error(`${e.message}${hint ? ` (${hint})` : ''}`); }
  const s = pickSheet(sheets, name);
  return { rows: s.rows, sheet: s.name };
}
/** Lee la hoja de precios de la primera fuente configurada (cuenta de servicio, XLSX o CSV) → { rows, source }; sin fuente, Error. */
export async function readSheetRows(env, fetchImpl = fetch) {
  const sheetName = env.PRICE_SHEET_NAME || '';
  if (env.GOOGLE_SERVICE_ACCOUNT && env.PRICE_SHEET_ID) {
    const id = env.PRICE_SHEET_ID;
    const token = await getAccessToken(JSON.parse(env.GOOGLE_SERVICE_ACCOUNT), fetchImpl);
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(env.PRICE_SHEET_RANGE || 'Precios!A:O')}?valueRenderOption=UNFORMATTED_VALUE`;
    const r = await fetchImpl(url, auth);
    if (r.ok) return { rows: (await r.json()).values || [], source: `sheet:${id}` };
    // un .xlsx guardado tal cual en Drive (sin «Guardar como hoja de cálculo de Google») no se lee con la API de Sheets: se descarga con la de Drive
    const d = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, auth);
    if (!d.ok) throw new Error(`No puedo leer el archivo de Drive: Sheets API ${r.status} · Drive API ${d.status} (¿está compartido con el correo de la cuenta de servicio?)`);
    return { rows: (await xlsxRows(new Uint8Array(await d.arrayBuffer()), sheetName, 'el archivo de Drive no es una hoja de Google ni un .xlsx')).rows, source: `drive-xlsx:${id}` };
  }
  if (env.PRICE_XLSX_URL) {
    const r = await fetchImpl(env.PRICE_XLSX_URL, { redirect: 'follow' });
    if (!r.ok) throw new Error(`XLSX ${r.status}`);
    return { rows: (await xlsxRows(new Uint8Array(await r.arrayBuffer()), sheetName, 'la URL no devolvió un libro: ¿el archivo está compartido con enlace?')).rows, source: 'xlsx-url' };
  }
  if (env.PRICE_CSV_URL) {
    const r = await fetchImpl(env.PRICE_CSV_URL, { redirect: 'follow' });
    if (!r.ok) throw new Error(`CSV ${r.status}`);
    return { rows: parseCsv(await r.text()), source: 'csv-url' };
  }
  throw new Error('Sin origen de precios: define GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID, PRICE_XLSX_URL o PRICE_CSV_URL');
}
/** Guarda unos precios nuevos: copia el anterior al histórico (90 días), escribe los vigentes y la meta. Lo usan la sincronización y los cambios por IA. */
export async function savePrices(env, next, prev, { now = new Date(), reason = 'manual', source = 'sheet' } = {}) {
  const diff = diffPrices(prev, next);
  if (Object.keys(prev.items).length > 0) await env.KV.put(`prices:history:${now.toISOString()}`, JSON.stringify(prev), { expirationTtl: 60 * 60 * 24 * 90 });
  await env.KV.put(KEY_CURRENT, JSON.stringify(next));
  const meta = { at: now.toISOString(), reason, source, refs: Object.keys(next.items).length, changed: diff.changed.length, added: diff.added.length, removed: diff.removed.length };
  await env.KV.put(KEY_META, JSON.stringify(meta));
  return meta;
}
/** Lee la hoja (Drive, CSV o filas subidas), la valida con las reglas compartidas y la publica. ctx = contexto del catálogo (ver catalog.js); sin ctx se aceptan todas las referencias (pruebas).
 *  Se rechaza: hoja con < 50 % de las referencias que había, o con «precio de relleno» (más del 60 % de filas con el mismo precio), salvo force=true. */
export async function syncPrices(env, { fetchImpl = fetch, now = new Date(), reason = 'manual', force = false, rows = null, source = null, ctx = null } = {}) {
  const read = rows ? { rows, source: source || 'upload' } : await readSheetRows(env, fetchImpl);
  const { prices: next, report } = readPrices(read.rows, read.source, now, ctx || {});
  const prev = await loadPrices(env);
  const n = Object.keys(next.items).length, p = Object.keys(prev.items).length;
  const filler = report.warnings.find((w) => w.code === 'precio_de_relleno');
  if (!force && filler) throw new Error(`Sincronización rechazada: ${filler.message}. Usa force=true si es intencionado.`);
  if (!force && p > 0 && n < p * 0.5) throw new Error(`Sincronización rechazada: la hoja nueva tiene ${n} referencias y había ${p} (¿hoja vacía o rota?). Usa force=true si es intencionado.`);
  const meta = await savePrices(env, next, prev, { now, reason, source: read.source });
  return { ...meta, warnings: report.warnings.map((w) => w.message).slice(0, 10) };
}
