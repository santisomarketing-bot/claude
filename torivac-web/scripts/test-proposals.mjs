#!/usr/bin/env node
// [TEST-PROPOSALS] Pruebas de la aplicación de las propuestas aprobadas con texto propio (site/lib/proposals-apply.mjs) y del archivo data/catalog/proposals.applied.json:
// sustituir un párrafo, traducir una descripción, cambiar el título de la portada, escapar siempre lo escrito y avisar de lo que no encaja. Con datos sintéticos y con el catálogo real.
//   node scripts/test-proposals.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyApproved, paragraphs, norm, parseTitles, textOfHtml } from '../site/lib/proposals-apply.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'data', 'catalog');
/** Lee un JSON de data/catalog. */
const load = (f) => JSON.parse(fs.readFileSync(path.join(CAT, f), 'utf8'));
let pass = 0, fail = 0;
/** Anota una comprobación: correcta, o fallo con su mensaje. */
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };
/** Copia profunda de datos JSON. */
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── piezas sueltas
ok(JSON.stringify(paragraphs('Uno\nDos\n\n\nTres <b>&</b>')) === JSON.stringify([{ t: 'p', h: 'Uno<br>Dos' }, { t: 'p', h: 'Tres &lt;b&gt;&amp;&lt;/b&gt;' }]), 'párrafos: líneas en blanco separan, saltos sueltos son <br> y todo se escapa');
ok(paragraphs('  \n\n ').length === 0, 'un texto vacío no da párrafos');
ok(norm('  Preferencias de “navegación”  — ') === 'preferencias de "navegación" -', 'norm: NBSP, comillas tipográficas, guiones y mayúsculas');
ok(textOfHtml('a <strong>b</strong> &amp; c&nbsp;d &#8217; &lt;x&gt;').replace(/\s+/g, ' ') === 'a b & c d ’ <x>', 'textOfHtml quita etiquetas y decodifica entidades');
ok(JSON.stringify(parseTitles('es: Uno\nen:  Two \nxx: no\nfr Falta\nde: Drei')) === JSON.stringify({ es: 'Uno', en: 'Two', de: 'Drei' }), 'parseTitles: solo líneas «xx: …» de idiomas válidos');
ok(parseTitles('nada') === null, 'parseTitles sin líneas válidas → null');

// ── datos sintéticos
/** Datos de prueba sintéticos: una página con título, párrafo, lista y tabla, una ficha de producto, una categoría y los títulos SEO. */
const synth = () => ({
  pages: { es: { '/aviso/': { sections: [{ blocks: [{ t: 'h', x: 'Datos del titular', l: 2 }, { t: 'p', h: 'El titular <strong>la ostenta: , con NIF: B1</strong> y nada más.' }, { t: 'ul', i: ['Uno', 'Texto <em>con</em> estilo para cambiar', 'Tres'] }, { t: 'table', rows: [[{ x: 'Celda A' }, { x: 'Celda B' }]] }] }, { blocks: [{ t: 'p', h: 'Otro párrafo' }] }] } }, de: { '/de/aviso/': { sections: [{ blocks: [{ t: 'p', h: 'Dit is Nederlands' }] }] } } },
  products: [{ id: 900, name: { es: 'Estabilizador BAVS' }, url: { es: '/product/bavs/', de: '/de/product/bavs/' }, short: { es: [{ t: 'p', h: 'Resumen' }] }, description: { es: [{ t: 'p', h: 'Texto en español' }], en: [{ t: 'p', h: 'Partial' }] } }],
  categories: [{ id: 5, path: { es: '/categoria/led/', de: '/de/categoria/led/' }, description: { es: [{ t: 'p', h: 'Soportes LED' }], de: [{ t: 'p', h: 'Metalen beugels voor 3 mm LED' }] } }],
  seo: { home_title: { es: 'Torivac' } },
});

let d = synth();
let r = applyApproved({ ...d, entries: [{ id: 'PR-1', mode: 'replace', find: 'la ostenta: , con NIF', text: 'El titular es Torivac S.L., con NIF B60784584.\n\nInscrita en el Registro Mercantil.', targets: [{ lang: 'es', path: '/aviso/' }] }] });
ok(r.applied.length === 1 && !r.notFound.length, 'replace en un párrafo: aplicado');
const secs = d.pages.es['/aviso/'].sections;
ok(secs[0].blocks.length === 5 && secs[0].blocks[1].h === 'El titular es Torivac S.L., con NIF B60784584.' && secs[0].blocks[2].h === 'Inscrita en el Registro Mercantil.', 'el párrafo se sustituye por dos (línea en blanco) y el resto queda igual');
ok(secs[0].blocks[0].x === 'Datos del titular' && secs[1].blocks[0].h === 'Otro párrafo', 'otros bloques y otras secciones intactos');

d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-2', mode: 'replace', find: 'TEXTO con estilo', text: 'Elemento <nuevo> & "claro"', targets: [{ lang: 'es', path: '/aviso/' }] }] });
ok(r.applied.length === 1 && d.pages.es['/aviso/'].sections[0].blocks[2].i[1] === 'Elemento &lt;nuevo&gt; &amp; &quot;claro&quot;' && d.pages.es['/aviso/'].sections[0].blocks[2].i[0] === 'Uno', 'replace en un elemento de lista (sin distinguir mayúsculas, texto escapado)');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-3', mode: 'replace', find: 'datos del titular', text: 'Titular del sitio', targets: [{ lang: 'es', path: '/aviso' }] }] });
ok(r.applied.length === 1 && d.pages.es['/aviso/'].sections[0].blocks[0].x === 'Titular del sitio', 'replace en un título (y la ruta se compara sin barra final)');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-4', mode: 'replace', find: 'Celda B', text: 'Nueva', targets: [{ lang: 'es', path: '/aviso/' }] }] });
ok(r.applied.length === 1 && d.pages.es['/aviso/'].sections[0].blocks[3].rows[0][1].x === 'Nueva', 'replace en la celda de una tabla');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-5', mode: 'replace', find: 'Metalen beugels', text: 'Metallhalterungen für 3-mm-LEDs', targets: [{ lang: 'de', path: '/de/categoria/led/' }, { lang: 'de', path: '/de/aviso/' }] }] });
ok(r.applied.length === 1 && d.categories[0].description.de[0].h === 'Metallhalterungen für 3-mm-LEDs' && d.pages.de['/de/aviso/'].sections[0].blocks[0].h === 'Dit is Nederlands', 'replace en una categoría; la otra página no tiene el texto y no se toca');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-6', mode: 'replace', find: 'Resumen', text: 'Resumen nuevo', targets: [{ lang: 'es', path: '/product/bavs/' }] }] });
ok(r.applied.length === 1 && d.products[0].short.es[0].h === 'Resumen nuevo' && d.products[0].description.es[0].h === 'Texto en español', 'replace en la ficha de un producto (resumen)');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-7', mode: 'translate', product_id: 900, lang: 'en', text: 'Single-phase stabiliser.\n\nSecond paragraph <b>x</b>' }] });
ok(r.applied.length === 1 && d.products[0].description.en.length === 2 && d.products[0].description.en[1].h === 'Second paragraph &lt;b&gt;x&lt;/b&gt;' && d.products[0].description.es[0].h === 'Texto en español', 'translate: la descripción en inglés pasa a ser su texto (escapado) y el español no se toca');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-8', mode: 'translate', product_id: 900, lang: 'es', text: 'x' }, { id: 'PR-9', mode: 'translate', product_id: 1, lang: 'en', text: 'x' }, { id: 'PR-10', mode: 'translate', product_id: 900, lang: 'en', text: '  ' }] });
ok(r.notFound.length === 3 && !r.applied.length && JSON.stringify(d.products[0].description.en) === '[{"t":"p","h":"Partial"}]', 'translate al español, a un producto que no existe o sin texto: no se aplica y se avisa');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-11', mode: 'title', text: 'es: Torivac · Transformadores\nen: Torivac · Transformers\nxx: no' }] });
ok(r.applied.length === 1 && d.seo.home_title.es === 'Torivac · Transformadores' && d.seo.home_title.en === 'Torivac · Transformers' && !('xx' in d.seo.home_title), 'title: títulos de la portada por idioma');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-12', mode: 'replace', find: 'no existe en ningún sitio', text: 'x', targets: [{ lang: 'es', path: '/aviso/' }] }, { id: 'PR-13', mode: 'replace', find: 'x', text: 'y', targets: [] }, { id: 'PR-14', mode: 'replace', text: 'y', targets: [{ lang: 'es', path: '/aviso/' }] }, { id: 'PR-15', mode: 'replace', find: 'Resumen', text: 'y', targets: [{ lang: 'es', path: '/pagina/que/no/existe/' }] }, { id: 'PR-16', mode: 'raro', text: 'y' }] });
ok(r.notFound.length === 5 && !r.applied.length && JSON.stringify(d) === JSON.stringify(synth()), 'lo que no encaja (texto ausente, sin destino, sin fragmento, página inexistente, modo raro) no cambia nada y se avisa');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-17', mode: 'add', text: 'Texto para colocar' }, { id: 'PR-18', mode: 'note', text: 'Decisión' }, { id: 'PR-19', text: 'sin modo' }] });
ok(r.manual.length === 3 && !r.applied.length && !r.notFound.length && JSON.stringify(d) === JSON.stringify(synth()), 'add, note y sin modo: no cambian nada solos (salen como trabajo manual)');
d = synth(); const e1 = { id: 'PR-20', mode: 'replace', find: 'Otro párrafo', text: 'Cambiado', targets: [{ lang: 'es', path: '/aviso/' }] };
applyApproved({ ...d, entries: [e1] }); const once = JSON.stringify(d); const d2 = synth(); applyApproved({ ...d2, entries: [e1] }); ok(once === JSON.stringify(d2), 'determinista: mismos datos y entradas → mismo resultado');
d = synth(); r = applyApproved({ ...d, entries: [{ id: 'PR-21', mode: 'replace', find: 'Otro párrafo', text: '<img src=x onerror=alert(1)>&lt;', targets: [{ lang: 'es', path: '/aviso/' }] }] });
ok(d.pages.es['/aviso/'].sections[1].blocks[0].h === '&lt;img src=x onerror=alert(1)&gt;&amp;lt;' && !/[<>]/.test(d.pages.es['/aviso/'].sections[1].blocks[0].h.replace(/<br>/g, '')), 'lo escrito nunca se convierte en HTML');

// ── catálogo real
const pages = load('pages.json'), products = load('products.json'), categories = load('categories.json');
/** Copia del catálogo real (páginas, productos, categorías y títulos SEO) para aplicar propuestas sin tocar los JSON. */
const real = () => ({ pages: clone(pages), products: clone(products), categories: clone(categories), seo: clone(load('seo-overrides.json')) });
let R = real();
r = applyApproved({ ...R, entries: [{ id: 'PR-57830', mode: 'replace', find: 'preferencias de navegación u publicitarias', text: 'preferencias de navegación o publicitarias que el Usuario, a los perfiles demográficos.', targets: [{ lang: 'es', path: '/aviso-legal-2/' }] }] });
ok(r.applied.length === 1, 'real · la frase rota del aviso legal se encuentra y se corrige' + (r.notFound.length ? ': ' + r.notFound[0].why : ''));
R = real(); r = applyApproved({ ...R, entries: [{ id: 'PR-47819', mode: 'replace', find: 'la ostenta: , con NIF: B60784584', text: 'El titular del sitio es TORIVAC S.L., con NIF B60784584.', targets: [{ lang: 'es', path: '/aviso-legal-2/' }, { lang: 'es', path: '/politica-de-privacidad/' }] }] });
ok(r.applied.length === 1 && /aviso-legal-2/.test(r.applied[0].where) && /politica-de-privacidad/.test(r.applied[0].where), 'real · el titular en blanco se corrige en el aviso legal y en la política de privacidad' + (r.notFound.length ? ': ' + r.notFound[0].why : ''));
R = real(); r = applyApproved({ ...R, entries: [{ id: 'PR-14528', mode: 'replace', find: 'Metalen beugels voor 3 mm', text: 'Metallhalterungen für 3-mm-LEDs aus Messing oder Duraluminium.', targets: ['/de/categoria-producto/geportaliseerd/geportaliseerde-led-3mm/', '/de/categoria-producto/portaleds/'].map((p) => ({ lang: 'de', path: p })) }] });
ok(r.applied.length === 1, 'real · el párrafo en neerlandés de la categoría alemana se sustituye' + (r.notFound.length ? ': ' + r.notFound[0].why : ''));
R = real(); const p900 = R.products.find((p) => p.id === 900);
r = applyApproved({ ...R, entries: [{ id: 'PR-14427', mode: 'translate', product_id: 900, lang: 'en', text: 'Single-phase voltage stabiliser BAVS series.' }] });
ok(r.applied.length === 1 && p900.description.en.length === 1, 'real · la descripción en inglés de la serie BAVS se sustituye');
/** Texto JSON de un objeto, para comparar datos completos. */
const has = (o) => JSON.stringify(o);
ok(has(pages).length > 1000 && has(pages) === has(load('pages.json')), 'los JSON de data/catalog no se tocan (se trabaja sobre copias)');

// ── el archivo guardado en el repositorio
const FILE = path.join(CAT, 'proposals.applied.json');
if (fs.existsSync(FILE)) {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const ids = new Set(load('proposals.json').map((p) => p.id));
  ok(Array.isArray(saved.entries), 'proposals.applied.json: lista de entradas');
  ok(saved.entries.every((e) => ids.has(e.id)), 'proposals.applied.json: todas las entradas son de propuestas que existen');
  R = real(); const rr = applyApproved({ ...R, entries: saved.entries });
  ok(!rr.notFound.length, 'proposals.applied.json: todo lo aprobado se puede aplicar' + (rr.notFound.length ? ': ' + rr.notFound.map((n) => `${n.id} (${n.why})`).join('; ') : ''));
}

console.log(`pruebas de las propuestas aprobadas: ${pass} comprobaciones correctas, ${fail} fallos`);
process.exit(fail ? 1 : 0);
