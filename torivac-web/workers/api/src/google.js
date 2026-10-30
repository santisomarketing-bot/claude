// [GOOGLE] Ajustes de medición de Google (Analytics 4, Google Ads y la etiqueta de cada conversión) que el manager edita en el panel (Ajustes → Google) y que la web lee SIN recompilar.
// Se guardan en KV (clave `settings:google`, sin caducidad). Contrato único con el servidor PHP: docs/GOOGLE.md §11 (mismas reglas que site/lib/google.mjs y site/assets/js/consent.js).
//   GET  /api/google            PÚBLICO: { ok, google:{ ga4, ads, conv:{ quote, contact } } } — solo IDs (salen en el código de cualquier web); conv = etiqueta COMPLETA y solo si está activada y hay ID de Ads.
//   GET  /api/settings/google   manager: { ok, settings:{ ga4, ads, conversions:{ quote:{label,on}, contact:{label,on} }, updated:{at,by}|null } }
//   PUT  /api/settings/google   manager: valida y guarda; error → 400 { ok:false, error, field }.
// Las dos conversiones son las que mide la web: `quote` (el presupuesto y el pedido son el mismo envío) y `contact`. Teléfono, WhatsApp y correo no se miden.
import { json } from './util.js';

/** Clave de KV de los ajustes. */
export const KEY = 'settings:google';
/** Conversiones que mide la web, con el nombre que se le enseña a la persona. */
export const KINDS = { quote: 'Presupuesto enviado', contact: 'Mensaje de contacto enviado' };
const RX = { ga4: /^(?:G|GT)-[A-Z0-9]{6,14}$/, ads: /^AW-\d{6,12}$/, label: /^[A-Za-z0-9_-]{8,40}$/, full: /^(AW-\d{6,12})\/([A-Za-z0-9_-]{8,40})$/ };
/** Tamaño máximo del cuerpo del PUT en bytes. */
export const MAX_BODY = 5000;

/** Ajustes vacíos (nada que medir). */
export const blank = () => ({ ga4: '', ads: '', conversions: { quote: { label: '', on: true }, contact: { label: '', on: true } }, updated: null });
/** ¿Es `v` un objeto «normal» (no lista ni null)? */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Ajustes guardados; si no hay o están dañados, los vacíos. Siempre con la forma completa y solo valores que cumplen las reglas (lo guardado a mano o por una versión vieja no se cuela). */
export async function loadSettings(env) {
  const out = blank(); let s;
  try { s = JSON.parse((await env.KV.get(KEY)) || 'null'); } catch { return out; }
  if (!isObj(s)) return out;
  if (typeof s.ga4 === 'string' && RX.ga4.test(s.ga4)) out.ga4 = s.ga4;
  if (typeof s.ads === 'string' && RX.ads.test(s.ads)) out.ads = s.ads;
  for (const k of Object.keys(KINDS)) {
    const c = isObj(s.conversions) && isObj(s.conversions[k]) ? s.conversions[k] : {};
    let l = typeof c.label === 'string' ? c.label : '';
    if (l !== '' && !RX.label.test(l) && !RX.full.test(l)) l = '';
    out.conversions[k] = { label: l, on: c.on !== false };
  }
  if (isObj(s.updated) && typeof s.updated.at === 'string' && typeof s.updated.by === 'string') out.updated = { at: s.updated.at, by: s.updated.by.replace(/[\r\n\t]/g, ' ').slice(0, 120) };
  return out;
}

/** Etiqueta COMPLETA (AW-…/etiqueta) a partir de lo guardado y del ID de Ads; '' si no se puede completar. */
export function fullLabel(label, ads) {
  if (RX.full.test(label)) return label;
  return RX.label.test(label) && RX.ads.test(ads) ? `${ads}/${label}` : '';
}

/** Lo que la web puede ver: IDs y etiquetas completas de las conversiones activadas (con ID de Ads). */
export function publicView(s) {
  const conv = {};
  for (const k of Object.keys(KINDS)) { const c = s.conversions[k]; conv[k] = c.on && s.ads !== '' ? fullLabel(c.label, s.ads) : ''; }
  return { ga4: s.ga4, ads: s.ads, conv };
}

/**
 * Valida el cuerpo del PUT → { settings } (normalizados, sin `updated`) o { error, field }.
 * Reglas: IDs con la forma de Google; etiqueta completa (con el mismo ID que `ads`) o solo la parte final (necesita `ads`); si hay etiquetas completas y `ads` está vacío, `ads` sale de ellas; `on` es booleano.
 */
export function validate(raw) {
  if (!isObj(raw)) return { error: 'Petición no válida', field: '' };
  for (const k of ['ga4', 'ads']) if (raw[k] != null && typeof raw[k] !== 'string') return { error: 'Petición no válida', field: k };
  const ga4 = String(raw.ga4 ?? '').trim(); let ads = String(raw.ads ?? '').trim();
  if (ga4 !== '' && !RX.ga4.test(ga4)) return { error: 'El ID de Analytics debe tener la forma G-XXXXXXXXXX.', field: 'ga4' };
  if (ads !== '' && !RX.ads.test(ads)) return { error: 'El ID de Google Ads debe tener la forma AW-123456789.', field: 'ads' };
  const input = isObj(raw.conversions) ? raw.conversions : {}, conv = {};
  for (const [k, name] of Object.entries(KINDS)) {
    const c = isObj(input[k]) ? input[k] : {}, field = `conversions.${k}`;
    if ('label' in c && typeof c.label !== 'string') return { error: 'Petición no válida', field };
    if ('on' in c && typeof c.on !== 'boolean') return { error: 'Petición no válida', field };
    const l = String(c.label ?? '').trim();
    if (l !== '') {
      const m = RX.full.exec(l);
      if (m) { if (ads !== '' && m[1] !== ads) return { error: `La etiqueta de «${name}» es de otra cuenta de Ads (${m[1]}).`, field }; }
      else if (!RX.label.test(l)) return { error: `La etiqueta de «${name}» no es válida: pega AW-123456789/AbCdEfGhIjK o solo AbCdEfGhIjK.`, field };
    }
    conv[k] = { label: l, on: c.on !== false };
  }
  if (ads === '') {                                                                               // sin ID de Ads: se toma de las etiquetas completas; solo la etiqueta no vale
    for (const [k, name] of Object.entries(KINDS)) {
      const l = conv[k].label; if (l === '') continue;
      const m = RX.full.exec(l);
      if (!m) return { error: `Para usar solo la etiqueta de «${name}» escribe antes el ID de Google Ads.`, field: `conversions.${k}` };
      if (ads === '') ads = m[1]; else if (ads !== m[1]) return { error: 'Las etiquetas son de cuentas de Ads distintas.', field: `conversions.${k}` };
    }
  }
  return { settings: { ga4, ads, conversions: conv } };
}

/** GET /api/google (público): lo que necesita la web, con caché corta. */
export async function handlePublic(env, { cors = {} } = {}) {
  return json({ ok: true, google: publicView(await loadSettings(env)) }, 200, { ...cors, 'Cache-Control': 'public, max-age=60', Vary: 'Origin' });
}
/** GET /api/settings/google (manager): los ajustes tal como están guardados. */
export async function handleGet(env, { cors = {} } = {}) {
  return json({ ok: true, settings: await loadSettings(env) }, 200, { ...cors, 'Cache-Control': 'no-store' });
}
/** PUT /api/settings/google (manager): valida, guarda con quién y cuándo y devuelve los ajustes; `raw` es el cuerpo ya leído (null si no era JSON válido). */
export async function handlePut(env, raw, { who, cors = {}, now = new Date() } = {}) {
  if (raw === null || raw === undefined) return json({ ok: false, error: 'Petición no válida', field: '' }, 400, cors);
  const v = validate(raw);
  if (v.error) return json({ ok: false, error: v.error, field: v.field }, 400, cors);
  const by = String(who && who.master ? 'maestro' : (who && who.sub) || '').replace(/[\r\n\t]/g, ' ').slice(0, 120);
  try { await env.KV.put(KEY, JSON.stringify({ ...v.settings, updated: { at: (now instanceof Date ? now : new Date(now)).toISOString(), by } })); }
  catch (e) { console.error('[google] No se pudieron guardar los ajustes', e && e.message); return json({ ok: false, error: 'No se pudieron guardar los ajustes' }, 500, cors); }
  return json({ ok: true, settings: await loadSettings(env) }, 200, { ...cors, 'Cache-Control': 'no-store' });
}
