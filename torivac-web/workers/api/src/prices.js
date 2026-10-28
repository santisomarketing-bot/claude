// [PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios).
// Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js):
//   { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note, n?, pid? } } }   (n/pid: referencia que añade la hoja dentro de un producto)
// Importes: el precio unitario conserva hasta 4 decimales (variaciones de céntimos); el importe de línea se redondea a 2.
import { round2 } from './util.js';
import { readSheet } from '../../../shared/price-sheet.mjs';
export const KEY_CURRENT = 'prices:current', KEY_META = 'prices:meta';

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
  const p = prices.items && prices.items[ref]; if (!p || typeof p.p !== 'number') return null;
  let u = p.p; for (const [min, price] of p.t || []) if (qty >= min) u = price; return u;
}
/** Valora las líneas {ref,qty}. Sin precio → unit/total null («Consultar»; no suman al total). */
export function priceOrder(prices, lines) {
  let total = 0, unpriced = 0;
  const out = lines.map((l) => { const unit = unitPrice(prices, l.ref, l.qty); const t = unit == null ? null : round2(unit * l.qty); if (t == null) unpriced++; else total += t; return { ...l, unit, total: t }; });
  return { lines: out, total: round2(total), unpriced };
}

/** filas (con filas de título delante si las hay) → { prices, report } usando las reglas compartidas de shared/price-sheet.mjs.
 *  ctx: { lines, skus, rules, decimals } (ver readSheet). report = { warnings, ignored, unknown, extras, columns, stats } */
export function readPrices(rows, source = 'sheet', now = new Date(), ctx = {}) {
  const r = readSheet(rows, ctx);
  const { items, ...report } = r;
  return { prices: { updated_at: now.toISOString(), source, currency: 'EUR', mode: 'live', items }, report };
}
/** igual que readPrices pero devuelve solo el objeto de precios (lo usan el cron y los tests) */
export function rowsToPrices(rows, source = 'sheet', now = new Date(), ctx = {}) { return readPrices(rows, source, now, ctx).prices; }
/** catálogo de referencias pedibles = las del sitio + las que la hoja de precios añadió dentro de un producto ({n, pid}) */
export function withSheetItems(catalog, prices) {
  const out = { ...catalog };
  for (const [ref, v] of Object.entries((prices && prices.items) || {})) if (!out[ref] && v.pid) out[ref] = { n: v.n || ref, pid: v.pid };
  return out;
}
/** Compara dos precios: { changed, added, removed } con las referencias afectadas y same con el número de las que no cambian. */
export function diffPrices(a, b) {
  const d = { changed: [], added: [], removed: [], same: 0 };
  for (const [k, y] of Object.entries(b.items)) { const x = a.items[k]; if (!x) d.added.push(k); else if (x.p !== y.p || JSON.stringify(x.t || []) !== JSON.stringify(y.t || [])) d.changed.push(k); else d.same++; }
  for (const k of Object.keys(a.items)) if (!b.items[k]) d.removed.push(k);
  return d;
}
