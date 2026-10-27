// [PRICES] Hoja de precios → objeto de precios, tramos por cantidad y valoración de pedidos (siempre en servidor: el cliente nunca fija precios).
// Formato (idéntico al de scripts/build_prices.py y site/assets/js/quote.js):
//   { updated_at, source, currency, mode:'demo'|'live', items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note } } }
// Importes: el precio unitario conserva hasta 4 decimales (variaciones de céntimos); el importe de línea se redondea a 2.
import { round2 } from './util.js';
export const KEY_CURRENT = 'prices:current', KEY_META = 'prices:meta';

export async function loadPrices(env) { const raw = await env.KV.get(KEY_CURRENT); return raw ? JSON.parse(raw) : { updated_at: null, source: 'none', currency: 'EUR', mode: 'none', items: {} }; }

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

const num = (x) => { if (x == null || x === '') return null; let s = String(x).replace(/[\s ]/g, ''); s = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''); const n = parseFloat(s); return Number.isNaN(n) ? null : n; };

/** filas (primera = cabecera, en minúsculas o no) → objeto de precios. Ignora filas sin ref/price o con active=0/no/false. */
export function rowsToPrices(rows, source = 'sheet', now = new Date()) {
  if (!rows || rows.length < 2) throw new Error('La hoja está vacía');
  const head = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const ix = (n) => head.indexOf(n);
  if (ix('ref') < 0 || ix('price') < 0) throw new Error('La hoja necesita las columnas «ref» y «price»');
  const items = {};
  for (const r of rows.slice(1)) {
    const ref = String(r[ix('ref')] ?? '').trim(); if (!ref) continue;
    if (ix('active') >= 0 && ['0', 'no', 'false', 'n'].includes(String(r[ix('active')]).trim().toLowerCase())) continue;
    const p = num(r[ix('price')]); if (p == null || p < 0) continue;
    const t = []; for (const k of [2, 3, 4]) { const q = num(r[ix(`qty${k}`)]), pp = num(r[ix(`price${k}`)]); if (q && pp != null && pp >= 0) t.push([Math.floor(q), pp]); }
    t.sort((a, b) => a[0] - b[0]);
    items[ref] = { p, ...(t.length ? { t } : {}), ...(ix('note') >= 0 && r[ix('note')] ? { note: String(r[ix('note')]) } : {}) };
  }
  return { updated_at: now.toISOString(), source, currency: 'EUR', mode: 'live', items };
}
export function diffPrices(a, b) {
  const d = { changed: [], added: [], removed: [], same: 0 };
  for (const [k, y] of Object.entries(b.items)) { const x = a.items[k]; if (!x) d.added.push(k); else if (x.p !== y.p || JSON.stringify(x.t || []) !== JSON.stringify(y.t || [])) d.changed.push(k); else d.same++; }
  for (const k of Object.keys(a.items)) if (!b.items[k]) d.removed.push(k);
  return d;
}
