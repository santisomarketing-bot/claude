// [PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios).
// Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js):
//   { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note, n?, pid? } } }   (n/pid: referencia que añade la hoja dentro de un producto)
// Importes: el precio unitario conserva hasta 4 decimales (variaciones de céntimos); el importe de línea se redondea a 2.
// Las búsquedas por referencia usan Object.hasOwn: «constructor», «__proto__» o «toString» no son referencias.
import { round2, ApiError } from './util.js';
import { readSheet, applySheetItems } from '../../../shared/price-sheet.mjs';
export const KEY_CURRENT = 'prices:current', KEY_META = 'prices:meta', KEY_SYNC = 'prices:sync';      // KEY_SYNC = estado del ÚLTIMO intento de sincronización (también el fallido o bloqueado)

/** Precios vigentes guardados en KV; si todavía no hay, una hoja vacía (mode 'none'). */
export async function loadPrices(env) { const raw = await env.KV.get(KEY_CURRENT); return raw ? JSON.parse(raw) : { updated_at: null, source: 'none', currency: 'EUR', mode: 'none', items: {} }; }

/** Origen sin datos personales ni identificadores: «upload:ana@torivac.com» → «upload», «sheet:ID» → «sheet». */
export const coarse = (s) => String(s ?? '').split(':')[0];
/** Lo que ve cualquier visitante de GET /api/prices: igual que el original pero sin el correo de quien cargó la hoja ni el id del archivo de Drive. */
export function publicView(prices, meta) {
  return { prices: { ...prices, source: coarse(prices.source) }, meta: meta ? { ...meta, reason: coarse(meta.reason), source: coarse(meta.source) } : meta };
}
/** Precio unitario de ref para qty unidades (último tramo por cantidad alcanzado); null si no tiene precio. */
export function unitPrice(prices, ref, qty) {
  const p = prices.items && Object.hasOwn(prices.items, ref) ? prices.items[ref] : null; if (!p || typeof p.p !== 'number') return null;
  let u = p.p; for (const [min, price] of p.t || []) if (qty >= min) u = price; return u;
}
/** Valora las líneas {ref,qty}. Sin precio → unit/total null («Consultar»; no suman al total). */
export function priceOrder(prices, lines) {
  let total = 0, unpriced = 0;
  const out = lines.map((l) => { const unit = unitPrice(prices, l.ref, l.qty); const t = unit == null ? null : round2(unit * l.qty); if (t == null) unpriced++; else total += t; return { ...l, unit, total: t }; });
  return { lines: out, total: round2(total), unpriced };
}

/** filas (con filas de título delante si las hay) → { prices, report } usando las reglas compartidas de shared/price-sheet.mjs.
 *  ctx: { lines, skus, rules, decimals } (ver readSheet). report = { warnings, ignored, unknown, extras, columns, stats }. Una hoja inservible (vacía, sin cabecera) es un ApiError 400 con su explicación. */
export function readPrices(rows, source = 'sheet', now = new Date(), ctx = {}) {
  let r;
  try { r = readSheet(rows, ctx); } catch (e) { if (e && e.constructor === Error) throw new ApiError(400, e.message); throw e; }       // los Error simples de readSheet son explicaciones pensadas para la persona; un TypeError sería un fallo interno
  const { items, ...report } = r;
  return { prices: { updated_at: now.toISOString(), source, currency: 'EUR', mode: 'live', items }, report };
}
/** igual que readPrices pero devuelve solo el objeto de precios (lo usan el cron y los tests) */
export function rowsToPrices(rows, source = 'sheet', now = new Date(), ctx = {}) { return readPrices(rows, source, now, ctx).prices; }
/** catálogo de referencias pedibles = las del sitio + las que la hoja de precios añadió dentro de un producto ({n, pid}) */
export function withSheetItems(catalog, prices) {
  const out = { ...catalog };
  for (const [ref, v] of Object.entries((prices && prices.items) || {})) if (!Object.hasOwn(out, ref) && v.pid) out[ref] = { n: v.n || ref, pid: v.pid };
  return out;
}
/** Modo de actualización válido: «replace» (la hoja sustituye a toda la lista) o «merge» (solo lo que trae la hoja; es lo normal y vale para cualquier otro valor). */
export const updateMode = (m) => (m === 'replace' ? 'replace' : 'merge');
/**
 * Aplica una hoja ya leída (`sheet`) a los precios vigentes (`prev`). «merge»: quita las referencias de `retire` y pone o actualiza las que trae la hoja (si una referencia sale a la vez
 * para quitar y con precio, gana el precio); el resto se conserva tal cual. «replace»: la hoja sustituye a todo. Los metadatos (fecha, origen) son los de la hoja nueva.
 */
export function mergePrices(prev, sheet, retire, mode = 'merge') {
  return { ...sheet, items: applySheetItems(prev.items, sheet.items, retire, mode) };
}
/** Precio base vigente de ref en `prev`, o undefined si esa referencia no tiene precio propio. */
const basePrice = (prev, ref) => (prev.items && Object.hasOwn(prev.items, ref) ? prev.items[ref].p : undefined);
/**
 * Aviso «cambio_masivo» si ≥ 10 referencias ya tenían precio y más de la mitad cambia más de un 40 % (¿hoja equivocada, columna movida, otra unidad?); null si no.
 * Cuentan como cambio masivo las referencias con precio que la hoja pide RETIRAR (`retire`: precio 0 o active = 0), que pasan de tener precio a no tenerlo.
 */
export function massChange(prev, sheetItems, retire = []) {
  let n = 0, big = 0;
  for (const [ref, it] of Object.entries(sheetItems)) {
    const old = basePrice(prev, ref);
    if (typeof old !== 'number' || old <= 0) continue;
    n++; if (Math.abs(it.p - old) / old > 0.4) big++;
  }
  for (const ref of retire) {
    if (Object.hasOwn(sheetItems, ref)) continue;                              // si sale a la vez con precio, gana el precio (no se retira)
    const old = basePrice(prev, ref);
    if (typeof old === 'number' && old > 0) { n++; big++; }
  }
  if (n < 10 || big / n <= 0.5) return null;
  return { code: 'cambio_masivo', message: `Más de la mitad de las referencias que ya tenían precio cambia más de un 40 % o se retira (${big} de ${n}): ¿hoja equivocada, columna movida o cambio de unidades?`, count: big };
}
/** Compara dos precios: { changed, added, removed } con las referencias afectadas y same con el número de las que no cambian. */
export function diffPrices(a, b) {
  const d = { changed: [], added: [], removed: [], same: 0 };
  for (const [k, y] of Object.entries(b.items)) { const x = Object.hasOwn(a.items, k) ? a.items[k] : null; if (!x) d.added.push(k); else if (x.p !== y.p || JSON.stringify(x.t || []) !== JSON.stringify(y.t || [])) d.changed.push(k); else d.same++; }
  for (const k of Object.keys(a.items)) if (!Object.hasOwn(b.items, k)) d.removed.push(k);
  return d;
}
/** Comprueba que todos los importes y tramos sean cifras finitas y razonables antes de guardar (JSON.stringify convierte NaN e Infinity en null y vaciaría la lista); si no, lanza Error. */
export function assertFinitePrices(prices) {
  for (const [ref, it] of Object.entries(prices.items || {})) {
    // true si x no es una cifra finita entre 0 y 10 000 000 (el tope de cualquier cifra de una hoja)
    const bad = (x) => typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 1e7;
    if (!it || bad(it.p) || (it.t || []).some((t) => !Array.isArray(t) || bad(t[0]) || bad(t[1]))) throw new Error(`Precio no válido en ${String(ref).slice(0, 40)}`);
  }
}
