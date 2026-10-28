// [CATALOG] Contexto del catálogo para leer hojas de precios: líneas pedibles del sitio, SKU de WooCommerce y reglas de códigos nuevos (generado por site/build.mjs).
// PRICE_DECIMALS (variable del Worker, opcional): decimales del precio unitario al importar (por defecto 4, máximo 6).
import items, { skus, rules } from './generated/items.js';
export const catalogItems = items;
/** Contexto del catálogo para leer hojas de precios: { lines, skus, rules } y decimals si PRICE_DECIMALS es un entero. */
export function catalogCtx(env = {}) {
  const d = env.PRICE_DECIMALS;
  return { lines: items, skus, rules, ...(d != null && d !== '' && Number.isInteger(Number(d)) ? { decimals: Number(d) } : {}) };
}
