#!/usr/bin/env node
// [TEST-TERMINOLOGY] Pruebas de las correcciones de terminología (site/lib/terminology.mjs y data/catalog/terminology.curated.json): una regla solo toca su idioma, su destino y sus
// frases; avisa de lo que ya no aparece; y con el catálogo real todas las reglas surten efecto, el castellano, el francés, el alemán y las URL quedan como estaban, y en inglés ya no
// hay «inverter» ni «variable speed drive» donde el castellano dice «variador de tensión».
//   node scripts/test-terminology.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTerminology } from '../site/lib/terminology.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'data', 'catalog');
/** Lee un JSON de data/catalog. */
const load = (f) => JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8'));
/** Copia profunda de datos JSON. */
const clone = (o) => JSON.parse(JSON.stringify(o));
let pass = 0, fail = 0;
/** Anota una comprobación: correcta, o fallo con su mensaje. */
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };

// ── con datos sintéticos
{
  const products = [{ id: 1, name: { es: 'Variador', en: 'Motorized inverter', fr: 'Inverseur' }, short: { en: [{ t: 'p', h: 'An inverter, an Inverter and inverters.' }] }, seo: { en: { title: 'Motorized inverter - X', description: 'd' } } }];
  const categories = [{ id: 7, name: { en: 'Drives' }, description: { en: 'Three-phase drives' } }];
  const pages = { en: { '/en/': { title: 'Home drives', sections: [{ blocks: [{ h: 'Variable voltage drives' }] }] } }, es: { '/': { title: 'Home drives' } } };
  const rules = [
    { scope: 'product', id: 1, lang: 'en', fields: ['name', 'short', 'seo.title'], pairs: [['Motorized inverter', 'Motorized voltage variator'], ['inverters', 'voltage variators']] },
    { scope: 'category', id: 7, lang: 'en', fields: ['name'], pairs: [['Drives', 'Voltage variators']] },
    { scope: 'page', path: '/en/', lang: 'en', fields: ['*'], pairs: [['Variable voltage drives', 'Voltage variators']] },
  ];
  const r = applyTerminology({ rules, products, categories, pages });
  ok(products[0].name.en === 'Motorized voltage variator', 'sustituye el nombre del producto en inglés');
  ok(products[0].name.es === 'Variador' && products[0].name.fr === 'Inverseur', 'no toca otros idiomas');
  ok(products[0].seo.en.title === 'Motorized voltage variator - X', 'sustituye seo.title');
  ok(products[0].seo.en.description === 'd', 'no toca campos que la regla no nombra (seo.description)');
  ok(products[0].short.en[0].h === 'An inverter, an Inverter and voltage variators.', 'distingue mayúsculas y sustituye todas las apariciones literales dentro de bloques');
  ok(categories[0].name.en === 'Voltage variators' && categories[0].description.en === 'Three-phase drives', 'categoría: solo el campo pedido');
  ok(pages.en['/en/'].sections[0].blocks[0].h === 'Voltage variators' && pages.en['/en/'].title === 'Home drives', 'página: sustituye en todo el árbol y solo la frase pedida');
  ok(pages.es['/'].title === 'Home drives', 'página en otro idioma intacta');
  ok(r.applied.length === 3 && r.missing.length === 0, 'todas las reglas aplicadas, nada que avisar');
  const r2 = applyTerminology({ rules: [{ scope: 'product', id: 1, lang: 'en', fields: ['name'], pairs: [['Motorized inverter', 'x']] }, { scope: 'product', id: 99, lang: 'en', fields: ['name'], pairs: [['a', 'b']] }], products, categories, pages });
  ok(r2.missing.length === 2, 'avisa de una frase que ya no está y de un destino que no existe');
  ok(applyTerminology({}).applied.length === 0, 'sin reglas no hace nada');
}

// ── con el catálogo real
{
  const products = load('products.json'), categories = load('categories.json'), pages = load('pages.json');
  const before = clone({ products, categories, pages });
  const rules = load('terminology.curated.json').rules;
  ok(rules.length > 0 && rules.every((x) => x.lang === 'en'), 'todas las reglas son del inglés');
  const r = applyTerminology({ rules, products, categories, pages });
  ok(r.missing.length === 0, 'todas las frases de todas las reglas aparecen en el catálogo' + (r.missing.length ? ': ' + JSON.stringify(r.missing) : ''));
  /** Elemento de una lista de productos o categorías por su id. */
  const byId = (a, id) => a.find((x) => x.id === id);
  // castellano, francés, alemán y URL intactos
  for (const p of products) { const b = byId(before.products, p.id); for (const l of ['es', 'fr', 'de']) ok(JSON.stringify(p.name?.[l]) === JSON.stringify(b.name?.[l]) && JSON.stringify(p.description?.[l]) === JSON.stringify(b.description?.[l]), `producto ${p.id}: ${l} intacto`); ok(JSON.stringify(p.slug) === JSON.stringify(b.slug) && JSON.stringify(p.path) === JSON.stringify(b.path), `producto ${p.id}: URL intacta`); }
  for (const c of categories) { const b = byId(before.categories, c.id); ok(JSON.stringify(c.slug) === JSON.stringify(b.slug) && JSON.stringify(c.path) === JSON.stringify(b.path), `categoría ${c.id}: URL intacta`); for (const l of ['es', 'fr', 'de']) ok(JSON.stringify(c.name?.[l]) === JSON.stringify(b.name?.[l]), `categoría ${c.id}: nombre ${l} intacto`); }
  for (const l of ['es', 'fr', 'de']) ok(JSON.stringify(pages[l]) === JSON.stringify(before.pages[l]), `páginas ${l} intactas`);
  // los variadores de tensión ya no son «inverter» ni «variable speed drive» en inglés
  const bad = /inverter|variable speed drive|voltage drive|\bAC drives?\b/i;
  for (const id of [866, 867, 326, 328]) { const n = byId(products, id).name.en; ok(/voltage variator/i.test(n) && !bad.test(n), `producto ${id}: nombre en inglés correcto («${n}»)`); }
  for (const id of [37, 40]) { const n = byId(categories, id).name.en; ok(/voltage variators/i.test(n) && !bad.test(n), `categoría ${id}: nombre en inglés correcto («${n}»)`); }
  for (const id of [37, 40, 45]) ok(!bad.test(JSON.stringify(byId(categories, id).description.en)), `categoría ${id}: descripción en inglés sin «inverter»/«drive»`);
  for (const id of [874, 882, 886, 888, 965]) { const t = JSON.stringify([byId(products, id).short?.en, byId(products, id).description?.en]); ok(!/inverters can|inverter motor|voltage drives|variable voltage drives/i.test(t), `producto ${id}: sin los términos equivocados`); }
  ok(!/Toroidal shocks/.test(JSON.stringify(pages.en['/en/'])), 'portada: «Toroidal shocks» ya es «Toroidal chokes»');
  // lo que SÍ es inversor o variador de velocidad se queda
  ok(/inverter/i.test(byId(products, 973).name.en) && /Frequency inverters/.test(byId(products, 968).name.en), 'los inversores fotovoltaicos y de frecuencia siguen llamándose inverter');
}

console.log(`\n${fail ? '✗' : '✓'} terminología: ${pass} comprobaciones correctas${fail ? `, ${fail} FALLAN` : ''}`);
process.exit(fail ? 1 : 0);
