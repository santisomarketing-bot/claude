// [TERMINOLOGY] Correcciones de terminología por idioma, aplicadas en memoria al compilar (los JSON de data/catalog no se tocan; se revierte borrando la regla).
// Nacen de una traducción automática que dejó «variador de tensión» como «inverter» o «variable speed drive» (un variador de tensión es un autotransformador variable,
// no un inversor ni un variador de velocidad). Cada regla dice DÓNDE se aplica (un producto, una categoría o una página, en un idioma) y QUÉ frases cambian; una frase que
// ya no aparece se avisa (`missing`) para que la regla no se pudra en silencio. Las URL y los slugs no se cambian: solo lo que lee el visitante.
//
//   applyTerminology({ rules, products, categories, pages }) → { applied:[{rule, hits}], missing:[{rule, from}] }
//
// Regla: { scope:'product'|'category'|'page', id?, path?, lang, fields:[…], pairs:[[de, a], …], why }
//   fields (producto): name · short · description · seo.title · seo.description · (categoría): name · description · (página): '*' = toda la página
//   pairs: se sustituye TODA aparición literal (distingue mayúsculas) dentro de esos campos.

/** Sustituye `de` por `a` en todas las cadenas de `v` (cadena, lista u objeto); devuelve [nuevoValor, número de sustituciones]. */
function replaceDeep(v, de, a) {
  if (typeof v === 'string') { const n = v.split(de).length - 1; return n ? [v.split(de).join(a), n] : [v, 0]; }
  if (Array.isArray(v)) { let hits = 0; const out = v.map((x) => { const [y, n] = replaceDeep(x, de, a); hits += n; return y; }); return [out, hits]; }
  if (v && typeof v === 'object') { let hits = 0; const out = {}; for (const k of Object.keys(v)) { const [y, n] = replaceDeep(v[k], de, a); hits += n; out[k] = y; } return [out, hits]; }
  return [v, 0];
}

/** Lee el campo `field` de `target` en el idioma `lang` → { get(), set(valor) } (null si no existe). */
function slot(scope, target, lang, field) {
  if (scope === 'page') return field === '*' ? { get: () => target, set: (v) => { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, v); } } : null;
  if (field.startsWith('seo.')) { const k = field.slice(4); const s = target.seo?.[lang]; return s && k in s ? { get: () => s[k], set: (v) => { s[k] = v; } } : null; }
  const holder = target[field]; return holder && lang in holder && holder[lang] != null ? { get: () => holder[lang], set: (v) => { holder[lang] = v; } } : null;
}

/** Aplica las reglas sobre los datos en memoria y cuenta las sustituciones de cada una. */
export function applyTerminology({ rules = [], products = [], categories = [], pages = {} }) {
  const applied = [], missing = [];
  rules.forEach((rule, idx) => {
    const label = `${rule.scope}:${rule.id ?? rule.path}/${rule.lang}`;
    const target = rule.scope === 'product' ? products.find((p) => p.id === rule.id)
      : rule.scope === 'category' ? categories.find((c) => c.id === rule.id)
      : rule.scope === 'page' ? pages?.[rule.lang]?.[rule.path] : null;
    if (!target) { missing.push({ rule: label, from: '(destino no encontrado)' }); return; }
    const slots = rule.fields.map((f) => slot(rule.scope, target, rule.lang, f)).filter(Boolean);
    let total = 0;
    for (const [de, a] of rule.pairs) {
      let hits = 0;
      for (const s of slots) { const [nv, n] = replaceDeep(s.get(), de, a); if (n) { s.set(nv); hits += n; } }
      if (!hits) missing.push({ rule: label, from: de }); else total += hits;
    }
    applied.push({ rule: label, hits: total, why: rule.why || '' });
  });
  return { applied, missing };
}
