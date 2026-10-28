// [SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV.
// Dos modos, en este orden:  1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID) → Sheets API v4;  2) PRICE_CSV_URL (exportación CSV pública con enlace).
// Seguridad: la sincronización se niega a publicar si la hoja nueva tiene < 50 % de las referencias que ya había (hoja vacía/rota) salvo force=true.
import { toB64Url } from './util.js';
import { KEY_CURRENT, KEY_META, loadPrices, readPrices, diffPrices } from './prices.js';

const te = new TextEncoder();
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
const pemToDer = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
/** token de acceso OAuth2 de una cuenta de servicio (JWT RS256 firmado con WebCrypto) */
export async function getAccessToken(sa, fetchImpl = fetch, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = toB64Url(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = toB64Url(te.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = toB64Url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(`${head}.${claim}`))));
  const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }) });
  if (!r.ok) throw new Error(`Google OAuth ${r.status}`);
  return (await r.json()).access_token;
}
export async function readSheetRows(env, fetchImpl = fetch) {
  if (env.GOOGLE_SERVICE_ACCOUNT && env.PRICE_SHEET_ID) {
    const token = await getAccessToken(JSON.parse(env.GOOGLE_SERVICE_ACCOUNT), fetchImpl);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.PRICE_SHEET_ID)}/values/${encodeURIComponent(env.PRICE_SHEET_RANGE || 'Precios!A:O')}?valueRenderOption=UNFORMATTED_VALUE`;
    const r = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Sheets API ${r.status}`);
    return { rows: (await r.json()).values || [], source: `sheet:${env.PRICE_SHEET_ID}` };
  }
  if (env.PRICE_CSV_URL) {
    const r = await fetchImpl(env.PRICE_CSV_URL, { redirect: 'follow' });
    if (!r.ok) throw new Error(`CSV ${r.status}`);
    return { rows: parseCsv(await r.text()), source: 'csv-url' };
  }
  throw new Error('Sin origen de precios: define GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID o PRICE_CSV_URL');
}
/** Lee la hoja, valida, guarda en KV (con histórico de 10 versiones) y devuelve estadísticas. */
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
