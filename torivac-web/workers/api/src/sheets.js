// [SHEETS] Lectura de la hoja de precios de Google (Drive) y sincronización a KV.
// Tres modos, en este orden:
//   1) cuenta de servicio (GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID): hoja de Google → Sheets API v4; si el archivo es un .xlsx subido a Drive sin convertir → se descarga con la API de Drive y se lee el libro
//   2) PRICE_XLSX_URL: descarga directa de un .xlsx (Drive «compartir con enlace»: https://drive.google.com/uc?export=download&id=<ID> · hoja de Google: https://docs.google.com/spreadsheets/d/<ID>/export?format=xlsx)
//   3) PRICE_CSV_URL: exportación CSV pública con enlace
// Libro .xlsx: PRICE_SHEET_NAME elige la hoja; sin nombre se usa la primera visible con columnas de referencia y precio (lector: shared/xlsx.mjs, con topes de tamaño).
// Descargas: redirecciones MANUALES (máx. 5 saltos, solo https: —y http: si la URL inicial ya era http:—) y tope de 25 MB de respuesta, contado de verdad.
// MODOS (PRICE_UPDATE_MODE · parámetro mode): «merge» (por defecto) = la hoja puede traer SOLO UNA PARTE del catálogo: cada fila reconocida (por referencia, SKU o ID) actualiza su referencia,
//   las filas con precio 0 o active = 0 la dejan sin precio y todo lo demás se conserva; «replace» = la hoja sustituye a toda la lista de precios.
// Seguridad (se rechaza salvo force=true): «precio de relleno», cambio masivo (más de la mitad de las referencias que ya tenían precio cambian más de un 40 % o se retiran), una hoja que RETIRA ≥ 10
//   referencias y más del 30 % de los precios vigentes, y una hoja tras cuya aplicación quedaría menos de la mitad de los precios vigentes (en replace, con cualquier número). La lectura automática
//   (cron y botón «Actualizar ahora») NUNCA aplica una hoja con bloqueos: conserva los precios vigentes y deja el motivo en prices:sync (ok / blocked / error).
import { ApiError, toB64Url } from './util.js';
import { KEY_CURRENT, KEY_META, KEY_SYNC, loadPrices, readPrices, diffPrices, updateMode, mergePrices, massChange, assertFinitePrices } from './prices.js';
import { readXlsx, pickSheet } from '../../../shared/xlsx.mjs';

const te = new TextEncoder();
const MAX_REDIRECTS = 5, MAX_DOWNLOAD = 25_000_000;
const TOO_BIG = 'La hoja es demasiado grande o está dañada';
/** Texto CSV → filas de celdas: separador «;» o «,» según la primera línea, comillas dobles; omite las filas vacías. */
export function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
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
  if (!r.ok) throw new ApiError(502, `Google OAuth ${r.status}`);
  return (await r.json()).access_token;
}

// ───────────────────────────────────────── [DESCARGAS] redirecciones controladas y tope de tamaño
/** True si el host es local o una IP literal (loopback, privada, enlace local): una redirección a ellos desde un host público se rechaza. */
function isLocalHost(h) {
  h = h.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) { const [a, b] = h.split('.').map(Number); return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); }
  return h.includes(':');                                                       // IPv6 literal (::1, fe80::…, fc00::…): no es un nombre de servidor público
}
/**
 * fetch con redirecciones MANUALES: como mucho 5 saltos, solo https: (y http: si la URL inicial ya era http:), nunca a un host local desde uno público y sin reenviar la cabecera Authorization
 * a otro origen → la Response final (no sigue más). Un destino no permitido o demasiados saltos lanzan ApiError 502.
 */
export async function fetchSafe(fetchImpl, url, init = {}) {
  let cur; try { cur = new URL(url); } catch { throw new ApiError(502, 'La dirección de la hoja de precios no es una URL válida'); }
  const firstHttp = cur.protocol === 'http:', firstLocal = isLocalHost(cur.hostname); let opts = { ...init };
  for (let hop = 0; ; hop++) {
    if (cur.protocol !== 'https:' && !(firstHttp && cur.protocol === 'http:')) throw new ApiError(502, `Redirección a un protocolo no permitido (${cur.protocol})`);
    if (!firstLocal && isLocalHost(cur.hostname)) throw new ApiError(502, 'Redirección a un servidor local no permitida');
    const res = await fetchImpl(hop === 0 && typeof url === 'string' ? url : cur.href, { ...opts, redirect: 'manual' });
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get('Location') : null;
    if (!loc) return res;
    if (hop >= MAX_REDIRECTS) throw new ApiError(502, 'Demasiadas redirecciones al descargar la hoja');
    const next = new URL(loc, cur);
    if (next.origin !== cur.origin && opts.headers) { const { Authorization, authorization, ...rest } = opts.headers; opts = { ...opts, headers: rest }; }
    cur = next;
  }
}
/** Cuerpo de una respuesta como bytes, contando de verdad lo que llega: más de `max` → ApiError 502 («La hoja es demasiado grande o está dañada»). */
export async function readBytes(res, max = MAX_DOWNLOAD) {
  if (Number(res.headers.get('Content-Length') || 0) > max) throw new ApiError(502, TOO_BIG);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader(), chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel().catch(() => {}); throw new ApiError(502, TOO_BIG); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

/** filas de la hoja de precios de un libro .xlsx descargado (bytes) → { rows, sheet }; si no es un libro, el error (ApiError 502) dice qué revisar */
async function xlsxRows(bytes, name, hint) {
  let sheets;
  try { sheets = await readXlsx(bytes); } catch (e) { throw new ApiError(502, `${e.message}${hint ? ` (${hint})` : ''}`); }
  let s;
  try { s = pickSheet(sheets, name); } catch (e) { throw new ApiError(502, e.message); }
  return { rows: s.rows, sheet: s.name };
}
/** Lee la hoja de precios de la primera fuente configurada (cuenta de servicio, XLSX o CSV) → { rows, source }; sin fuente, ApiError. */
export async function readSheetRows(env, fetchImpl = fetch) {
  const sheetName = env.PRICE_SHEET_NAME || '';
  if (env.GOOGLE_SERVICE_ACCOUNT && env.PRICE_SHEET_ID) {
    const id = env.PRICE_SHEET_ID;
    const token = await getAccessToken(JSON.parse(env.GOOGLE_SERVICE_ACCOUNT), fetchImpl);
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(env.PRICE_SHEET_RANGE || 'Precios!A:O')}?valueRenderOption=UNFORMATTED_VALUE`;
    const r = await fetchSafe(fetchImpl, url, auth);
    if (r.ok) return { rows: JSON.parse(new TextDecoder().decode(await readBytes(r))).values || [], source: `sheet:${id}` };
    // un .xlsx guardado tal cual en Drive (sin «Guardar como hoja de cálculo de Google») no se lee con la API de Sheets: se descarga con la de Drive
    const d = await fetchSafe(fetchImpl, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, auth);
    if (!d.ok) throw new ApiError(502, `No puedo leer el archivo de Drive: Sheets API ${r.status} · Drive API ${d.status} (¿está compartido con el correo de la cuenta de servicio?)`);
    return { rows: (await xlsxRows(await readBytes(d), sheetName, 'el archivo de Drive no es una hoja de Google ni un .xlsx')).rows, source: `drive-xlsx:${id}` };
  }
  if (env.PRICE_XLSX_URL) {
    const r = await fetchSafe(fetchImpl, env.PRICE_XLSX_URL);
    if (!r.ok) throw new ApiError(502, `XLSX ${r.status}`);
    return { rows: (await xlsxRows(await readBytes(r), sheetName, 'la URL no devolvió un libro: ¿el archivo está compartido con enlace?')).rows, source: 'xlsx-url' };
  }
  if (env.PRICE_CSV_URL) {
    const r = await fetchSafe(fetchImpl, env.PRICE_CSV_URL);
    if (!r.ok) throw new ApiError(502, `CSV ${r.status}`);
    return { rows: parseCsv(new TextDecoder().decode(await readBytes(r))), source: 'csv-url' };
  }
  throw new ApiError(502, 'Sin origen de precios: define GOOGLE_SERVICE_ACCOUNT + PRICE_SHEET_ID, PRICE_XLSX_URL o PRICE_CSV_URL');
}
/** Guarda unos precios nuevos: copia el anterior al histórico (90 días), escribe los vigentes y la meta (que borra el estado de error de un intento anterior). Lo usan la sincronización y los cambios por IA. */
export async function savePrices(env, next, prev, { now = new Date(), reason = 'manual', source = 'sheet', mode = null } = {}) {
  assertFinitePrices(next);                                                     // nunca se guarda un importe no finito (JSON.stringify lo convertiría en null y vaciaría la lista)
  const diff = diffPrices(prev, next);
  if (Object.keys(prev.items).length > 0) await env.KV.put(`prices:history:${now.toISOString()}`, JSON.stringify(prev), { expirationTtl: 60 * 60 * 24 * 90 });
  await env.KV.put(KEY_CURRENT, JSON.stringify(next));
  const meta = { at: now.toISOString(), reason, source, refs: Object.keys(next.items).length, changed: diff.changed.length, added: diff.added.length, removed: diff.removed.length, ...(mode ? { mode } : {}) };
  await env.KV.put(KEY_META, JSON.stringify(meta));
  return meta;
}
/**
 * Plan de una actualización, sin guardar nada: lee las filas, las aplica a los precios vigentes según `mode` («merge»: solo lo que trae la hoja; «replace»: sustituye todo) y lista lo que
 * exigiría confirmar (`blockers`). Lo usan la vista previa y la sincronización, para que enseñen y hagan exactamente lo mismo. → { next, prev, sheet, report, mode, kept, blockers }
 */
export async function planPrices(env, rows, source, mode, { now = new Date(), ctx = null } = {}) {
  mode = updateMode(mode);
  const { prices: sheet, report } = readPrices(rows, source, now, ctx || {});
  const prev = await loadPrices(env);
  const blockers = report.warnings.filter((w) => w.code === 'precio_de_relleno').map((w) => w.message), warnings = [...report.warnings];
  const mass = massChange(prev, sheet.items, report.retire);
  if (mass) { warnings.push(mass); blockers.push(mass.message); }
  const p = Object.keys(prev.items).length;
  const next = mergePrices(prev, sheet, report.retire, mode);
  const remain = Object.keys(next.items).length;
  const retired = mode === 'replace' ? [] : report.retire.filter((r) => Object.hasOwn(prev.items, r) && !Object.hasOwn(sheet.items, r));       // referencias con precio que la hoja quita de verdad
  if (retired.length >= 10 && retired.length > p * 0.3) blockers.push(`La hoja retira ${retired.length} de ${p} precios (${Math.round((100 * retired.length) / p)} %): confírmalo con force`);
  if (mode === 'replace') { if (p > 0 && remain < p * 0.5) blockers.push(`la hoja nueva tiene ${remain} referencias y había ${p} (¿hoja vacía o rota?)`); }
  else if (p >= 10 && remain < p * 0.5) blockers.push(`Tras aplicar la hoja quedarían ${remain} de ${p} precios vigentes (menos de la mitad): confírmalo con force`);
  const touched = new Set([...Object.keys(sheet.items), ...report.retire]);
  const kept = mode === 'replace' ? 0 : Object.keys(prev.items).filter((k) => !touched.has(k)).length;
  return { next, prev, sheet, report: { ...report, warnings }, mode, kept, blockers };
}
/** Anota en prices:sync el resultado del último intento de sincronización { at, reason, ok, blocked, error, refs? } (también el fallido o bloqueado); lo ven los managers en GET /api/prices. Un fallo al anotarlo nunca tapa el resultado real. */
async function recordSync(env, state) {
  try { await env.KV.put(KEY_SYNC, JSON.stringify(state)); } catch (err) { console.error('No se pudo anotar el estado de la sincronización', err && err.message); }
}
/** Lee la hoja (Drive, CSV o filas subidas), la valida con las reglas compartidas y la publica. `mode`: «merge» (por defecto, o PRICE_UPDATE_MODE) o «replace». ctx = contexto del catálogo (ver catalog.js); sin ctx se aceptan todas las referencias (pruebas).
 *  Se rechaza con ApiError 409 (salvo force=true) si hay bloqueos (ver arriba). Todo intento —correcto, fallido o bloqueado— deja su estado en prices:sync, y si falla los precios vigentes no se tocan. */
export async function syncPrices(env, { fetchImpl = fetch, now = new Date(), reason = 'manual', force = false, rows = null, source = null, ctx = null, mode = null } = {}) {
  const state = { at: now.toISOString(), reason: String(reason), ok: false, blocked: false, error: '' };
  try {
    const read = rows ? { rows, source: source || 'upload' } : await readSheetRows(env, fetchImpl);
    const plan = await planPrices(env, read.rows, read.source, mode ?? env.PRICE_UPDATE_MODE ?? 'merge', { now, ctx });
    if (!force && plan.blockers.length) { state.blocked = true; throw new ApiError(409, `Sincronización rechazada: ${plan.blockers.join('; ')}. Usa force=true si es intencionado.`); }
    const meta = await savePrices(env, plan.next, plan.prev, { now, reason, source: read.source, mode: plan.mode });
    await recordSync(env, { ...state, ok: true, refs: meta.refs });
    return { ...meta, kept: plan.kept, warnings: plan.report.warnings.map((w) => w.message).slice(0, 10) };
  } catch (e) {
    state.error = String((e && e.message) || e).slice(0, 500);
    await recordSync(env, state);
    throw e;
  }
}
