// [AI] Cambios de precios por INSTRUCCIÓN EN CASTELLANO (panel «Precios» → «Actualizar con una instrucción»).
//   POST /api/prices/ai        {instruction}                → propone cambios (NUNCA los aplica) + vista previa
//   POST /api/prices/ai/apply  {changes, confirm_large?}    → aplica los cambios ya revisados por la persona
// Criterio (el mismo que «Pedile cambios a la IA» de whynot-sites): la IA solo PROPONE un conjunto mínimo de cambios con una herramienta de
// esquema cerrado; el Worker lo valida (referencias que existen, importes razonables, tramos coherentes), lo muestra en forma de diferencias y
// solo se escribe cuando la persona confirma. La IA no ve datos de clientes ni pedidos: únicamente referencia, nombre, precio y tramos.
// Llama directo a la API HTTP de Anthropic por fetch (el runtime de Workers no admite el SDK sin nodejs_compat).
import items from './generated/items.js';
import { loadPrices } from './prices.js';
import { savePrices } from './sheets.js';
import { round2 } from './util.js';

export const TOOL = 'proponer_cambios_de_precios';
const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_CHANGES = 500, MAX_REFS_IN_PROMPT = 3000, LARGE_RATIO = 3, MAX_PRICE = 1_000_000;

export const SYSTEM = `Eres el asistente de precios de Torivac (fabricante de transformadores toroidales, variadores y estabilizadores de tensión, resistencias, botones de mando, etc.).
Recibes la lista de precios actual (una referencia por línea: ref | nombre | precio unidad | tramos «desde N uds = precio») y una instrucción en castellano.
Devuelve SOLO los cambios mínimos necesarios llamando a la herramienta ${TOOL}.
Reglas:
- Usa únicamente referencias que aparecen en la lista. No inventes referencias ni nombres.
- Cambia solo lo que se pide. Si se pide «subir un 3 % las resistencias», aplica el 3 % al precio base y a los tramos de TODAS las referencias cuyo nombre sea de resistencias.
- Los precios son en euros, sin IVA, con hasta 4 decimales. Redondea solo si la instrucción lo pide.
- Si la instrucción es ambigua o no se puede cumplir con la lista, no cambies nada: devuelve changes vacío y explica el motivo en summary.
- summary: una frase en castellano que resuma lo que cambia (cuántas referencias, por qué criterio).`;

/** Esquema de la herramienta (cerrado: la IA no puede añadir campos). */
export const TOOL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['summary', 'changes'],
  properties: {
    summary: { type: 'string', description: 'Resumen en castellano de lo que se cambia y por qué' },
    changes: {
      type: 'array', maxItems: MAX_CHANGES,
      items: {
        type: 'object', additionalProperties: false, required: ['ref', 'price'],
        properties: {
          ref: { type: 'string', description: 'Referencia EXACTA de la lista' },
          price: { type: 'number', description: 'Nuevo precio unidad base (EUR, sin IVA)' },
          tiers: { type: 'array', description: 'Tramos nuevos completos (si cambian); omitir para dejar los actuales', items: { type: 'object', additionalProperties: false, required: ['qty', 'price'], properties: { qty: { type: 'integer', minimum: 2 }, price: { type: 'number' } } } },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' }, description: 'Dudas o cosas que la persona debería revisar' },
  },
};

/** Lista de precios en texto compacto para el prompt: «ref | nombre | 12.3456 | desde 10 uds = 11.9; desde 50 uds = 11.4». */
export function buildTable(prices, catalog = items) {
  const rows = Object.entries(prices.items).slice(0, MAX_REFS_IN_PROMPT).map(([ref, p]) => `${ref} | ${(catalog[ref] && catalog[ref].n) || ''} | ${p.p}${(p.t || []).length ? ' | ' + p.t.map(([q, v]) => `desde ${q} uds = ${v}`).join('; ') : ''}`);
  return rows.join('\n');
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Valida lo que devuelve la IA contra los precios y el catálogo reales.
 * → { changes:[{ref,name,old:{p,t},next:{p,t},pct,large}], warnings:[], rejected:[{ref,why}] }
 */
export function validateChanges(raw, prices, catalog = items) {
  const out = { changes: [], warnings: [], rejected: [] };
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > MAX_CHANGES) out.warnings.push(`La IA propuso ${list.length} cambios; se usan los ${MAX_CHANGES} primeros.`);
  const seen = new Set();
  for (const c of list.slice(0, MAX_CHANGES)) {
    const ref = String((c && c.ref) || '').trim();
    if (!ref) { out.rejected.push({ ref: '(vacía)', why: 'sin referencia' }); continue; }
    if (seen.has(ref)) { out.rejected.push({ ref, why: 'repetida' }); continue; }
    seen.add(ref);
    if (!prices.items[ref] && !catalog[ref]) { out.rejected.push({ ref, why: 'la referencia no existe' }); continue; }
    const p = num(c.price);
    if (p == null || p < 0 || p > MAX_PRICE) { out.rejected.push({ ref, why: 'precio no válido' }); continue; }
    const old = prices.items[ref] || null;
    let tiers = null;
    if (Array.isArray(c.tiers)) {
      tiers = c.tiers.map((t) => [Math.floor(num(t && t.qty) || 0), num(t && t.price)]).filter(([q, v]) => q >= 2 && v != null && v >= 0 && v <= MAX_PRICE).sort((a, b) => a[0] - b[0]).map(([q, v]) => [q, r4(v)]);
      if (tiers.some(([, v]) => v > p)) out.warnings.push(`${ref}: algún tramo cuesta más que el precio base.`);
    }
    const nextT = tiers != null ? tiers : (old && old.t) || [];
    const next = { p: r4(p), ...(nextT.length ? { t: nextT } : {}) };
    if (tiers == null && old && old.t && old.t.length && old.p !== next.p) out.warnings.push(`${ref}: el precio base cambia pero los tramos por cantidad se quedan como estaban (revisa).`);
    const same = old && old.p === next.p && JSON.stringify(old.t || []) === JSON.stringify(next.t || []);
    if (same) continue;                                                          // la IA «cambió» algo que ya estaba así: no es un cambio
    const pct = old && old.p > 0 ? round2(((next.p - old.p) / old.p) * 100) : null;
    const large = !!(old && old.p > 0 && (next.p / old.p > LARGE_RATIO || next.p / old.p < 1 / LARGE_RATIO));
    if (large) out.warnings.push(`${ref}: cambio muy grande (${old.p} → ${next.p}).`);
    out.changes.push({ ref, name: (catalog[ref] && catalog[ref].n) || '', old: old ? { p: old.p, ...(old.t && old.t.length ? { t: old.t } : {}) } : null, next, pct, large });
  }
  return out;
}

/** Aplica cambios ya validados sobre unos precios (devuelve unos nuevos; no toca los originales). */
export function applyChanges(prices, changes, { now = new Date(), source = 'ia' } = {}) {
  const next = { ...prices, updated_at: now.toISOString(), source, mode: 'live', items: { ...prices.items } };
  for (const c of changes) {
    const old = prices.items[c.ref] || {};
    next.items[c.ref] = { ...old, p: c.next.p, ...(c.next.t && c.next.t.length ? { t: c.next.t } : {}) };
    if (!(c.next.t && c.next.t.length)) delete next.items[c.ref].t;
  }
  return next;
}

async function callAnthropic(env, instruction, table, fetchImpl) {
  const res = await fetchImpl(API_URL, {
    method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL, max_tokens: 8000, system: SYSTEM,
      tools: [{ name: TOOL, description: 'Propone los cambios de precios que cumplen la instrucción', input_schema: TOOL_SCHEMA }], tool_choice: { type: 'tool', name: TOOL },
      messages: [{ role: 'user', content: `Instrucción: «${instruction}»\n\nLista de precios actual:\n${table}` }],
    }),
  });
  if (!res.ok) { const e = new Error(`La API de IA respondió ${res.status}`); e.status = 502; throw e; }
  const data = await res.json();
  const use = (data.content || []).find((b) => b.type === 'tool_use' && b.name === TOOL);
  if (!use) { const e = new Error('La IA no devolvió una propuesta utilizable'); e.status = 502; throw e; }
  return { input: use.input || {}, usage: data.usage || null };
}

/** Propone cambios para una instrucción. Lanza Error con .status (400 instrucción vacía, 503 IA sin configurar, 502 fallo de la IA). */
export async function suggestPriceChanges(env, instruction, { fetchImpl = fetch } = {}) {
  const text = String(instruction || '').trim();
  if (text.length < 5) { const e = new Error('Escribe una instrucción (por ejemplo: «sube un 3 % las resistencias»)'); e.status = 400; throw e; }
  if (text.length > 1000) { const e = new Error('La instrucción es demasiado larga (máx. 1000 caracteres)'); e.status = 400; throw e; }
  if (!env.ANTHROPIC_API_KEY) { const e = new Error('La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY)'); e.status = 503; throw e; }
  const prices = await loadPrices(env);
  if (!Object.keys(prices.items).length) { const e = new Error('Todavía no hay precios cargados'); e.status = 409; throw e; }
  const { input, usage } = await callAnthropic(env, text, buildTable(prices), fetchImpl);
  const v = validateChanges(input.changes, prices);
  const warnings = [...(Array.isArray(input.warnings) ? input.warnings.map(String).slice(0, 10) : []), ...v.warnings];
  return { summary: String(input.summary || '').slice(0, 400), changes: v.changes, rejected: v.rejected, warnings, large: v.changes.some((c) => c.large), usage };
}

/** Aplica los cambios que la persona ha revisado. Vuelve a validarlo todo en servidor (no se fía de lo que manda el navegador). */
export async function applyPriceChanges(env, body, { who = 'manager', now = new Date() } = {}) {
  const prices = await loadPrices(env);
  const raw = Array.isArray(body && body.changes) ? body.changes.map((c) => ({ ref: c.ref, price: c.next ? c.next.p : c.price, tiers: c.next && c.next.t ? c.next.t.map(([qty, price]) => ({ qty, price })) : c.tiers })) : [];
  const v = validateChanges(raw, prices);
  if (!v.changes.length) { const e = new Error('No hay cambios válidos que aplicar'); e.status = 400; throw e; }
  if (v.changes.some((c) => c.large) && body.confirm_large !== true) { const e = new Error('Hay cambios muy grandes: confírmalos expresamente (confirm_large)'); e.status = 409; throw e; }
  const next = applyChanges(prices, v.changes, { now, source: `ia:${who}` });
  const meta = await savePrices(env, next, prices, { now, reason: `ia:${who}`, source: `ia:${who}` });
  return { meta, applied: v.changes.length, rejected: v.rejected };
}
