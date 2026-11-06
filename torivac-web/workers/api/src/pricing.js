// [PRICING] Precios por categoría (docs/PRECIOS-Y-CLIENTES.md): ajustes que editan el manager y el propietario, GET /api/prices según quién llama y edición de un producto desde el panel.
// Se guardan en KV (clave `settings:pricing`, sin caducidad). Contrato único con el servidor PHP.
//   GET  /api/settings/pricing    manager y client: { ok, pricing:{ tiers:{vip5,vip10,normal}, anon, approx:{on,pct}, updated:{at,by}|null } }
//   PUT  /api/settings/pricing    manager y client: valida y guarda; error → 400 { ok:false, error, field } (field: tiers.vip5 · tiers.vip10 · tiers.normal · anon · approx.pct · approx.on); cuerpo ≤ 2 KB (más → 400 «Petición no válida», como en Google)
//   PUT  /api/prices/items/:ref   manager y client: edita p / t / a / manual de UN producto (precio VIP), con histórico; la sincronización con la hoja no toca lo marcado `m`.
// Categorías: vip (precio de la hoja, 0 %), vip5, vip10 y normal (los porcentajes 5/10/15 son globales y editables). Quien no tiene cuenta ve, según `anon`, «A consultar» (con un precio aproximado opcional) o el precio Normal.
import { json, readBody, jsonOf } from './util.js';
import { TIERS, scale4, roundHalfUp, loadPrices, publicView, manualRefs, withSheetItems } from './prices.js';
import { savePrices } from './sheets.js';
import items from './generated/items.js';

/** Clave de KV de los ajustes de precios. */
export const KEY = 'settings:pricing';
/** Tamaño máximo del cuerpo del PUT de ajustes, en bytes. */
export const MAX_BODY = 2048;
/** Tamaño máximo del cuerpo del PUT de un producto, en bytes. */
export const MAX_ITEM_BODY = 20000;
/** Nombre de cada categoría tal como lo ve el equipo. */
export const LABELS = { vip: 'VIP', vip5: 'VIP +5', vip10: 'VIP +10', normal: 'Normal' };
/** Etiqueta de la categoría con la que se valoró un presupuesto: la de las cuatro categorías, o «A consultar» (priceTier 'consult'). */
export const tierLabel = (t) => (t === 'consult' ? 'A consultar' : LABELS[t] || String(t));

/** Ajustes por defecto: porcentajes 5/10/15, quien no tiene cuenta ve «Consultar precio» y el precio aproximado está apagado (nada público hasta que se active). */
export const blank = () => ({ tiers: { vip5: 5, vip10: 10, normal: 15 }, anon: 'consult', approx: { on: false, pct: 15 }, updated: null });
/** ¿Es `v` un objeto «normal» (no lista ni null)? */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** True si `x` es un porcentaje de categoría válido: número entre 0 y 100 con hasta 2 decimales. */
const tierPctOk = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
/** True si `x` es el porcentaje del precio aproximado: número entre 0 y 200 con hasta 2 decimales. */
const approxPctOk = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 200 && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;

/** Ajustes guardados; si no hay o están dañados, los de por defecto. Siempre con la forma completa y solo valores válidos (cada valor dañado vuelve al suyo por defecto; si los tres porcentajes no cumplen vip5 ≤ vip10 ≤ normal, vuelven los tres). */
export async function loadPricing(env) {
  const out = blank(); let s;
  try { s = JSON.parse((await env.KV.get(KEY)) || 'null'); } catch { return out; }
  if (!isObj(s)) return out;
  const t = isObj(s.tiers) ? s.tiers : {}, tiers = { ...out.tiers };
  for (const k of Object.keys(tiers)) if (tierPctOk(t[k])) tiers[k] = t[k];
  if (tiers.vip5 <= tiers.vip10 && tiers.vip10 <= tiers.normal) out.tiers = tiers;
  if (s.anon === 'consult' || s.anon === 'normal') out.anon = s.anon;
  const a = isObj(s.approx) ? s.approx : {};
  if (typeof a.on === 'boolean') out.approx.on = a.on;
  if (approxPctOk(a.pct)) out.approx.pct = a.pct;
  if (isObj(s.updated) && typeof s.updated.at === 'string' && typeof s.updated.by === 'string') out.updated = { at: s.updated.at, by: s.updated.by.replace(/[\r\n\t]/g, ' ').slice(0, 120) };
  return out;
}
/** Porcentaje que una categoría suma al precio VIP: 0 para vip, el de los ajustes para las demás. */
export const tierPct = (pricing, tier) => (tier === 'vip' ? 0 : Number(pricing.tiers[tier]) || 0);
/** Las cuatro categorías con su nombre y su porcentaje actual: { vip:{label:'VIP',pct:0}, vip5:{label:'VIP +5',pct}, … } (lo que lista GET /api/customers). */
export const tierTable = (pricing) => Object.fromEntries(TIERS.map((t) => [t, { label: LABELS[t], pct: tierPct(pricing, t) }]));

/**
 * Valida el cuerpo del PUT de ajustes → { pricing } (normalizado, sin `updated`) o { error, field }. Reglas: porcentajes de categoría numéricos 0–100 con hasta 2 decimales y vip5 ≤ vip10 ≤ normal;
 * anon = «consult» o «normal»; approx.pct entre 0 y 200; approx.on booleano. Todos los campos son obligatorios. Si el orden no se cumple, el error cae en el porcentaje que lo rompe (vip10 o normal).
 */
export function validate(raw) {
  if (!isObj(raw)) return { error: 'Petición no válida', field: '' };
  const t = isObj(raw.tiers) ? raw.tiers : {}, tiers = {};
  for (const k of ['vip5', 'vip10', 'normal']) {
    if (!tierPctOk(t[k])) return { error: `El porcentaje de ${LABELS[k]} debe ser un número entre 0 y 100, con hasta 2 decimales.`, field: `tiers.${k}` };
    tiers[k] = t[k];
  }
  if (tiers.vip10 < tiers.vip5) return { error: 'VIP +10 no puede ser menor que VIP +5.', field: 'tiers.vip10' };
  if (tiers.normal < tiers.vip10) return { error: 'Normal no puede ser menor que VIP +10.', field: 'tiers.normal' };
  if (raw.anon !== 'consult' && raw.anon !== 'normal') return { error: 'Elige qué ve quien no tiene cuenta: «consult» (consultar precio) o «normal» (precio Normal).', field: 'anon' };
  const a = isObj(raw.approx) ? raw.approx : {};
  if (!approxPctOk(a.pct)) return { error: 'El porcentaje del precio aproximado debe ser un número entre 0 y 200.', field: 'approx.pct' };
  if (typeof a.on !== 'boolean') return { error: 'Activar el precio aproximado es sí o no.', field: 'approx.on' };
  return { pricing: { tiers, anon: raw.anon, approx: { on: a.on, pct: a.pct } } };
}
/** GET /api/settings/pricing (manager y client): los ajustes tal como están guardados. */
export async function handleGet(env, { cors = {} } = {}) {
  return json({ ok: true, pricing: await loadPricing(env) }, 200, { ...cors, 'Cache-Control': 'no-store' });
}
/** Quién figura como autor de un cambio: el correo de la sesión, o «maestro» si es el token maestro (sin saltos de línea y ≤ 120 caracteres). */
const by = (who) => String(who && who.master ? 'maestro' : (who && who.sub) || '').replace(/[\r\n\t]/g, ' ').slice(0, 120);
/** Lee el cuerpo JSON con su tope → { body } (null si está vacío o roto: quien valida lo rechaza con 400) o { res } con el 413 si supera `max` bytes. */
async function readCapped(request, max, cors) {
  const bytes = await readBody(request, max);
  return bytes === null ? { res: json({ ok: false, error: 'La petición es demasiado grande' }, 413, cors) } : { body: jsonOf(bytes) };
}
/** PUT /api/settings/pricing (manager y client): valida, guarda con quién y cuándo y devuelve los ajustes; cuerpo ≤ 2 KB (un cuerpo más grande, roto o que no es un objeto es 400 «Petición no válida», igual que en Ajustes → Google). */
export async function handlePut(request, env, { who, cors = {}, now = new Date() } = {}) {
  const v = validate(jsonOf(await readBody(request, MAX_BODY)));
  if (v.error) return json({ ok: false, error: v.error, field: v.field }, 400, cors);
  try { await env.KV.put(KEY, JSON.stringify({ ...v.pricing, updated: { at: (now instanceof Date ? now : new Date(now)).toISOString(), by: by(who) } })); }
  catch (e) { console.error('[pricing] No se pudieron guardar los ajustes', e && e.message); return json({ ok: false, error: 'No se pudieron guardar los ajustes' }, 500, cors); }
  return json({ ok: true, pricing: await loadPricing(env) }, 200, { ...cors, 'Cache-Control': 'no-store' });
}

// ───────────────────────────────────────── [VISTAS] lo que devuelve GET /api/prices según quién llama
/** Precio aproximado de un producto para quien no tiene cuenta (`anon` = consult y approx.on), o null si no se enseña: item.a === false → nada; a número > 0 → ese; si no, p + approx.pct % redondeado (≥ 10 € al euro, si no a 1 decimal). */
export function approxPrice(item, pricing) {
  if (!item || typeof item !== 'object') return null;
  if (item.a === false) return null;
  if (typeof item.a === 'number' && item.a > 0) return item.a;
  if (typeof item.p === 'number' && item.p > 0 && pricing.approx.on) { const v = scale4(item.p, pricing.approx.pct); return v >= 10 ? roundHalfUp(v) : roundHalfUp(v * 10) / 10; }
  return null;
}
/** Los productos CON PRECIO de la lista, con los importes escalados a la categoría de `pct` (p y cada tramo) y sin las marcas internas `m` y `a`; los que no tienen precio no salen. */
function scaledItems(list, pct) {
  const out = {};
  for (const [ref, it] of Object.entries(list || {})) {
    if (!it || typeof it !== 'object') continue;
    const { m: _m, a: _a, ...rest } = it;
    if (typeof rest.p !== 'number') continue;                                         // sin precio no hay nada que enseñar
    rest.p = scale4(rest.p, pct); if (Array.isArray(rest.t)) rest.t = rest.t.map(([q, v]) => [q, scale4(v, pct)]);
    out[ref] = rest;
  }
  return out;
}
/**
 * Cuerpo de GET /api/prices para `who` (null = visitante o sesión no válida) → { prices, meta, sync? }. El servidor decide qué contiene: manager y client ven el precio VIP con las marcas `m` y `a` (y `meta.manual_count`; el manager,
 * además, el detalle de la hoja y `sync`); un customer, los precios de SU categoría (sin `m`, `a` ni el nombre de la categoría); el visitante, según los ajustes: Normal completo, aproximados (`prices.approx: true`, sin tramos) o nada (mode 'none').
 * El precio VIP y el de otra categoría no se publican jamás a quien no corresponde.
 */
export function pricesView(who, prices, meta, sync, pricing) {
  const pub = publicView(prices, meta);
  const pubMeta = pub.meta ? (({ manual_skipped: _skipped, ...rest }) => rest)(pub.meta) : pub.meta;               // cuántas referencias manuales saltó la hoja es un dato interno del equipo
  if (who && who.role === 'manager') return { prices, meta: { ...(meta || {}), manual_count: manualRefs(prices).size }, ...(sync ? { sync } : {}) };
  if (who && who.role === 'client') return { prices: pub.prices, meta: { ...(pub.meta || {}), manual_count: manualRefs(prices).size } };
  if (who && who.role === 'customer') return { prices: { ...pub.prices, items: scaledItems(prices.items, tierPct(pricing, who.tier)) }, meta: pubMeta };
  if (pricing.anon === 'normal') return { prices: { ...pub.prices, items: scaledItems(prices.items, tierPct(pricing, 'normal')) }, meta: pubMeta };
  if (!pricing.approx.on) return { prices: { ...pub.prices, mode: 'none', items: {} }, meta: pubMeta };
  const approx = {};
  for (const [ref, it] of Object.entries(prices.items || {})) { const a = approxPrice(it, pricing); if (a != null) approx[ref] = { p: a }; }
  return { prices: { ...pub.prices, items: approx, approx: true }, meta: pubMeta };
}

// ───────────────────────────────────────── [PRODUCTO] PUT /api/prices/items/:ref
/** True si `x` es un precio válido de producto: número mayor que 0 y de hasta 10 000 000 con hasta 4 decimales. */
const itemPriceOk = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 10_000_000 && Math.abs(x * 1e4 - Math.round(x * 1e4)) < 1e-6;
/**
 * Valida el cuerpo de la edición de un producto → { change } o { error, field }. change = { p?: número|null, t?: [[cantMin, precio], …], a?: número|false|null, manual?: boolean } (solo lo que vino).
 * p: precio VIP unitario o null (quitarlo); t: de 0 a 8 tramos con cantMin entero ≥ 2 estrictamente creciente; a: aproximado (> 0), false (nunca) o null (seguir la regla); manual: boolean.
 */
export function parseItemEdit(raw) {
  if (!isObj(raw)) return { error: 'Petición no válida', field: '' };
  const change = {};
  if (Object.hasOwn(raw, 'p')) {
    if (raw.p !== null && !itemPriceOk(raw.p)) return { error: 'El precio debe ser un número mayor que 0 y de hasta 10 000 000, con hasta 4 decimales (o null para quitarlo).', field: 'p' };
    change.p = raw.p;
  }
  if (Object.hasOwn(raw, 't')) {
    if (!Array.isArray(raw.t) || raw.t.length > 8) return { error: 'Los tramos son una lista de 0 a 8 pares [cantidad mínima, precio].', field: 't' };
    let last = 1;
    for (const x of raw.t) {
      if (!Array.isArray(x) || x.length !== 2 || !Number.isInteger(x[0]) || x[0] < 2 || x[0] <= last || !itemPriceOk(x[1])) return { error: 'Cada tramo es [cantidad mínima, precio]: cantidad entera desde 2, siempre mayor que la del tramo anterior, y un precio válido.', field: 't' };
      last = x[0];
    }
    change.t = raw.t.map(([q, v]) => [q, v]);
  }
  if (Object.hasOwn(raw, 'a')) {
    if (raw.a !== null && raw.a !== false && !itemPriceOk(raw.a)) return { error: 'El precio aproximado debe ser un número mayor que 0, false (no mostrar) o null (seguir la regla).', field: 'a' };
    change.a = raw.a;
  }
  if (Object.hasOwn(raw, 'manual')) {
    if (typeof raw.manual !== 'boolean') return { error: 'La marca manual es sí o no.', field: 'manual' };
    change.manual = raw.manual;
  }
  if (!Object.keys(change).length) return { error: 'No hay nada que cambiar: envía p, t, a o manual.', field: '' };
  return { change };
}
/** El producto con los cambios aplicados → { item } (sin las claves vacías) o { error, field } si quedarían tramos sin precio base. Con p o t en el cambio se marca `m` sola, salvo que `manual` diga otra cosa. */
function applyItemEdit(old, change) {
  const item = { ...old };
  if (Object.hasOwn(change, 'p')) { if (change.p === null) delete item.p; else item.p = change.p; }
  if (Object.hasOwn(change, 't')) { if (change.t.length) item.t = change.t; else delete item.t; }
  if (Object.hasOwn(change, 'a')) { if (change.a === null) delete item.a; else item.a = change.a; }
  if (item.p === undefined && item.t && item.t.length) {
    if (Object.hasOwn(change, 't')) return { error: 'Los tramos necesitan un precio base: pon también el precio.', field: 't' };
    delete item.t;                                                                    // se quitó el precio: sus tramos ya no significan nada
  }
  const manual = Object.hasOwn(change, 'manual') ? change.manual : Object.hasOwn(change, 'p') || Object.hasOwn(change, 't') ? true : item.m === true;
  if (manual) item.m = true; else delete item.m;
  return { item };
}
/** Lo que se devuelve de un producto: solo { p?, t?, a?, m? }. */
const itemView = (it) => Object.fromEntries(['p', 't', 'a', 'm'].filter((k) => it[k] !== undefined).map((k) => [k, it[k]]));
/**
 * PUT /api/prices/items/:ref → 200 { ok, ref, item } con el producto ya guardado; 404 { ok:false, error:'Referencia desconocida' } si no está en el catálogo ni la añadió la hoja; 400 { ok:false, error, field }; 413.
 * Guarda como precio VIP, con histórico (razón `edit:<correo>`) y fecha nueva (si la edición no cambia nada, no escribe); una referencia que se queda sin ningún dato pierde su entrada. `rawRef` es el texto de la URL (codificado).
 */
export async function handleItemEdit(request, env, rawRef, { who, cors = {}, now = new Date(), catalog = items } = {}) {
  let ref; try { ref = decodeURIComponent(rawRef); } catch { ref = ''; }
  const prices = await loadPrices(env);
  if (!ref || ref.length > 100 || !Object.hasOwn(withSheetItems(catalog, prices), ref)) return json({ ok: false, error: 'Referencia desconocida' }, 404, cors);
  const rb = await readCapped(request, MAX_ITEM_BODY, cors); if (rb.res) return rb.res;
  const p = parseItemEdit(rb.body); if (p.error) return json({ ok: false, error: p.error, field: p.field }, 400, cors);
  const old = Object.hasOwn(prices.items, ref) ? prices.items[ref] : {}, e = applyItemEdit(old, p.change);
  if (e.error) return json({ ok: false, error: e.error, field: e.field }, 400, cors);
  const at = now instanceof Date ? now : new Date(now), list = { ...prices.items };
  if (JSON.stringify(itemView(e.item)) !== JSON.stringify(itemView(old))) {                  // si la edición no cambia nada no se escribe (ni histórico ni fecha nueva)
    if (Object.keys(e.item).length) list[ref] = e.item; else delete list[ref];
    const next = { ...prices, updated_at: at.toISOString(), items: list, ...(prices.mode === 'none' ? { mode: 'live', source: 'edit' } : {}) };          // una lista que nace de editar a mano ya no es «sin precios»
    await savePrices(env, next, prices, { now: at, reason: `edit:${by(who)}`, source: 'edit' });
  }
  return json({ ok: true, ref, item: itemView(e.item) }, 200, { ...cors, 'Cache-Control': 'no-store' });
}
