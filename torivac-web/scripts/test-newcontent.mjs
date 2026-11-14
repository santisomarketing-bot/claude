// [TEST-NEWCONTENT] Contenido nuevo (plan 2027): solo se publica lo APROBADO. Comprueba la validación (quién y con qué función aprueba), que un borrador no sale en la web,
// que las equivalencias entre idiomas solo enlazan versiones publicadas y que una compilación de producción con una versión aprobada pasa la auditoría SEO.
//   node scripts/test-newcontent.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadNewContent, applyNewContent } from '../site/lib/newcontent.mjs';
import { applyExport } from './apply_newcontent.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'en', 'fr', 'de'];
let fails = 0;
/** Anota una comprobación: ✓ o ✗ con su descripción. */
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

/** Página de ejemplo válida con el estado y la aprobación indicados por idioma. */
const sample = (over = {}) => ({
  id: 'prueba', slug: { es: '/pagina-de-prueba-nueva/', en: '/en/new-test-page/' },
  langs: {
    es: { status: 'aprobado', approval: { by: 'Ana Comercial', role: 'comercial', at: '2026-11-20' }, title: 'Página de prueba | Torivac', meta_description: 'Descripción de prueba con la longitud suficiente para pasar la validación del generador de páginas.', h1: 'Página de prueba', lead: 'Texto de entrada.', sections: [{ h2: 'Primera sección', p: ['Párrafo uno.'] }], cta: [{ label: 'Contactar', href: '/contacto/' }] },
    en: { status: 'borrador', title: 'Test page | Torivac', meta_description: 'Test description with enough length to pass the page generator validation rules for new content.', h1: 'Test page', sections: [{ h2: 'First section', p: ['Paragraph one.'] }] },
  }, ...over,
});
/** Escribe `obj` como data/content-new/<id>.json en una carpeta temporal nueva y devuelve la carpeta. */
const dirWith = (...objs) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-nc-')); objs.forEach((o, i) => fs.writeFileSync(path.join(d, `${i}-${o.id || 'x'}.json`), JSON.stringify(o))); return d; };
/** Problemas que devuelve la validación para una página. */
const problems = (o, existing) => loadNewContent({ dir: dirWith(o), langs: LANGS, existing }).problems;
/** Copia profunda para modificar un ejemplo sin tocar el original. */
const clone = (o) => JSON.parse(JSON.stringify(o));

console.log('1) Validación');
ok(problems(sample()).length === 0, 'una página válida (castellano aprobado por «comercial», inglés en borrador) no da problemas');
{ const o = clone(sample()); o.langs.es.approval.role = 'traductor'; ok(problems(o).some((p) => /función «comercial»/.test(p)), 'el castellano lo aprueba la función «comercial»: con «traductor» falla'); }
{ const o = clone(sample()); delete o.langs.es.approval; ok(problems(o).some((p) => /quién la aprueba/.test(p)), 'aprobada sin indicar quién: falla'); }
{ const o = clone(sample()); o.langs.es.approval.at = '20/11/2026'; ok(problems(o).some((p) => /sin fecha/.test(p)), 'aprobada con una fecha que no es AAAA-MM-DD: falla'); }
{ const o = clone(sample()); o.langs.en.status = 'aprobado'; o.langs.en.approval = { by: 'Luis', role: 'traductor', at: '2026-11-21' }; ok(problems(o).length === 0, 'inglés aprobado por «traductor» con el castellano ya aprobado: bien'); }
{ const o = clone(sample()); o.langs.es.status = 'borrador'; o.langs.en.status = 'aprobado'; o.langs.en.approval = { by: 'Luis', role: 'traductor', at: '2026-11-21' }; ok(problems(o).some((p) => /traducción mientras el castellano/.test(p)), 'no se aprueba una traducción si el castellano sigue en borrador'); }
{ const o = clone(sample()); o.langs.en.status = 'aprobado'; o.langs.en.approval = { by: 'Luis', role: 'comercial', at: '2026-11-21' }; ok(problems(o).some((p) => /función «traductor»/.test(p)), 'una traducción la aprueba la función «traductor»: con «comercial» falla'); }
{ const o = clone(sample()); o.langs.es.h1 = 'Hola <b>mundo</b>'; ok(problems(o).some((p) => /etiquetas/.test(p)), 'el contenido es texto plano: una etiqueta HTML falla'); }
{ const o = clone(sample()); o.langs.es.sections[0].p = ['<script>alert(1)</script>']; ok(problems(o).some((p) => /texto plano/.test(p)), 'un párrafo con <script> falla'); }
{ const o = clone(sample()); o.langs.es.meta_description = 'corta'; ok(problems(o).some((p) => /meta_description/.test(p)), 'meta_description fuera de 50–160 caracteres falla'); }
{ const o = clone(sample()); o.langs.es.title = 'x'.repeat(70); ok(problems(o).some((p) => /title de 70/.test(p)), 'title de más de 65 caracteres falla'); }
{ const o = clone(sample()); o.langs.es.cta[0].href = 'javascript:alert(1)'; ok(problems(o).some((p) => /enlace/.test(p)), 'un botón con javascript: falla'); }
{ const o = clone(sample()); o.slug.es = '/product/algo/'; ok(problems(o).some((p) => /reservada/.test(p)), 'una ruta reservada (/product/) falla'); }
{ const o = clone(sample()); o.slug.en = '/new-test-page/'; ok(problems(o).some((p) => /no válida/.test(p)), 'una ruta inglesa sin el prefijo /en/ falla'); }
ok(problems(sample(), new Set(['/pagina-de-prueba-nueva/'])).some((p) => /ya existe/.test(p)), 'una ruta que ya existe en la web falla');
{ const d = dirWith(sample(), { ...sample(), slug: { es: '/otra-ruta-distinta/', en: '/en/otra-ruta-en/' } }); ok(loadNewContent({ dir: d, langs: LANGS }).problems.some((p) => /id «prueba» repetido/.test(p)), 'un id repetido entre dos archivos falla'); }
{ const d = dirWith(sample(), { ...sample({ id: 'otra' }), slug: { es: '/otra-ruta-distinta/', en: '/en/new-test-page/' } }); ok(loadNewContent({ dir: d, langs: LANGS }).problems.some((p) => /ya la usa/.test(p)), 'una ruta usada por dos páginas falla'); }

console.log('\n2) Solo se publica lo aprobado');
{ const { entries } = loadNewContent({ dir: dirWith(sample()), langs: LANGS }); const pages = {}; const n = applyNewContent(pages, entries);
  ok(n.published === 1 && n.pending === 1 && Object.keys(pages.es || {}).length === 1 && !pages.en, 'sin --drafts: el castellano aprobado entra; el inglés en borrador no');
  ok(Object.keys(pages.es['/pagina-de-prueba-nueva/'].alternates).length === 0, 'el castellano no enlaza a un inglés que no se publica (sin hreflang a lo no publicado)');
  ok(!/BORRADOR/.test(JSON.stringify(pages)), 'lo publicado no lleva la marca de borrador');
  const pd = {}; const nd = applyNewContent(pd, entries, { drafts: true });
  ok(nd.published === 1 && nd.drafts === 1 && pd.en['/en/new-test-page/'].alternates.es === '/pagina-de-prueba-nueva/', 'con --drafts el inglés sale también, enlazado con el castellano');
  ok(/\[BORRADOR\]/.test(pd.en['/en/new-test-page/'].title) && /BORRADOR · pendiente de aprobación/.test(JSON.stringify(pd.en['/en/new-test-page/'].sections)), 'y va marcado como BORRADOR en el título y en el texto');
  const e = JSON.stringify(applyNewContent({}, [{ ...entries[0], langs: { es: { ...entries[0].langs.es, h1: 'A & B "c"' } } }], {}) && (() => { const q = {}; applyNewContent(q, [{ ...entries[0], langs: { es: { ...entries[0].langs.es, lead: 'a < b & "c"' } } }]); return q; })());
  ok(/a &lt; b &amp; &quot;c&quot;/.test(e), 'el texto se escapa al pasar a HTML'); }

console.log('\n3) Compilación completa (producción con --base)');
{
  const dir = dirWith(sample({ id: 'prueba-publicada', slug: { es: '/pagina-de-prueba-publicada/', en: '/en/published-test-page/' } }));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-nc-dist-'));
  const env = { ...process.env, TORIVAC_CONTENT_NEW: dir, TORIVAC_API: '' };
  execFileSync('node', [path.join(ROOT, 'site/build.mjs'), '--base=https://demo.torivac.example', `--out=${out}`], { env, stdio: 'pipe' });
  const f = path.join(out, 'pagina-de-prueba-publicada', 'index.html');
  ok(fs.existsSync(f), 'la versión aprobada existe en la compilación');
  ok(!fs.existsSync(path.join(out, 'en', 'published-test-page')), 'la versión en borrador no existe');
  const html = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  ok(/<h1[^>]*>[^<]*Página de prueba/.test(html) && !/BORRADOR/.test(html), 'tiene su h1 y ninguna marca de borrador');
  ok(!/<link[^>]*rel="alternate"[^>]*hreflang="en"/.test(html), 'no declara ningún hreflang hacia el inglés (esa versión no se publica)');
  const sm = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  ok(sm.includes('/pagina-de-prueba-publicada/') && !sm.includes('published-test-page'), 'el sitemap lleva la versión aprobada y no la del borrador');
  let seo = 0; try { execFileSync('python3', ['-I', path.join(ROOT, 'scripts/seo_check.py'), out, '--base=https://demo.torivac.example'], { stdio: 'pipe' }); } catch (e) { seo = e.status; }
  ok(seo === 0, 'la auditoría SEO (seo_check.py) no da errores');
  let rej = 0; try { execFileSync('node', [path.join(ROOT, 'site/build.mjs'), '--drafts', '--base=https://demo.torivac.example', `--out=${out}-x`], { env, stdio: 'pipe' }); } catch (e) { rej = e.status; }
  ok(rej === 2, '--drafts junto con --base se rechaza (un paquete nunca lleva borradores)');
  fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n4) Los archivos reales de data/content-new');
{ const r = loadNewContent({ dir: path.join(ROOT, 'data', 'content-new'), langs: LANGS }); ok(r.problems.length === 0, `validan sin problemas (${r.entries.length} páginas)${r.problems.length ? ': ' + r.problems[0] : ''}`);
  const pub = r.entries.flatMap((e) => Object.entries(e.langs).filter(([, v]) => v.status === 'aprobado').map(([l]) => `${e.id}[${l}]`));
  console.log(`     aprobadas y publicadas hoy: ${pub.length ? pub.join(', ') : 'ninguna (todo en borrador)'}`); }

console.log('\n5) Anotar en los archivos lo hecho en el panel (scripts/apply_newcontent.mjs)');
{
  const base = clone(sample()); base.langs.es.status = 'borrador'; delete base.langs.es.approval; base.history = [];
  const dir = dirWith(base), file = fs.readdirSync(dir)[0];
  /** Identificador de un hecho del registro de cambios (L + 12 cifras hexadecimales). */
  const L = (n) => `L${n.toString(16).padStart(12, '0')}`;
  const exp = { ok: true, kind: 'torivac-contenido-nuevo', pages: { prueba: {
    langs: { es: { status: 'aprobado', approval: { by: 'Marta Revisora', email: 'marta@torivac.test', role: 'comercial', at: '2026-11-21' }, text: { ...base.langs.es, title: 'Título aceptado desde el panel | Torivac' } } },
    history: [{ id: L(2), at: '2026-11-21T10:00:00.000Z', by: 'marta@torivac.test', name: 'Marta Revisora', role: 'reviewer', lang: 'es', action: 'aprobada', detail: 'como comercial' }, { id: L(1), at: '2026-11-21T09:00:00.000Z', by: 'jefa@torivac.test', name: 'Jefa', role: 'manager', lang: 'es', action: 'propuesta_aceptada', detail: 'P1' }] },
  nada: { langs: { es: { status: 'aprobado', approval: { by: 'X', role: 'comercial', at: '2026-11-21' }, text: base.langs.es } }, history: [] } } };
  const expFile = path.join(dir, '..', `exp-${path.basename(dir)}.json`); fs.writeFileSync(expFile, JSON.stringify(exp));
  /** Ejecuta scripts/apply_newcontent.mjs sobre el archivo y la carpeta de la prueba (más las opciones que se pasen); devuelve su salida. */
  const cli = (...a) => execFileSync('node', [path.join(ROOT, 'scripts/apply_newcontent.mjs'), `--file=${expFile}`, `--dir=${dir}`, ...a], { stdio: 'pipe' }).toString();
  const before = fs.readFileSync(path.join(dir, file), 'utf8');
  const dry = cli('--dry');
  ok(/COMPROBADO/.test(dry) && fs.readFileSync(path.join(dir, file), 'utf8') === before, '--dry comprueba y no escribe nada');
  ok(/«nada»|nada: no existe/.test(dry), 'una página que no existe en los archivos se omite (no se crea)');
  cli();
  const w = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  ok(w.langs.es.status === 'aprobado' && w.langs.es.approval.by === 'Marta Revisora' && w.langs.es.approval.role === 'comercial' && w.langs.es.approval.at === '2026-11-21', 'el castellano queda aprobado con quién, función y fecha');
  ok(!('email' in w.langs.es.approval), 'el correo no se escribe en el archivo (solo quién, función y fecha)');
  ok(w.langs.es.title === 'Título aceptado desde el panel | Torivac' && w.langs.en.status === 'borrador', 'el texto aceptado se anota y el inglés sigue en borrador');
  ok(w.history.length === 2 && w.history[0].id === L(2) && w.history[1].action === 'propuesta_aceptada', 'el registro entra ordenado, el más reciente primero');
  ok(loadNewContent({ dir, langs: LANGS }).problems.length === 0, 'lo escrito pasa la validación del generador');
  cli();
  ok(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).history.length === 2, 'aplicar dos veces lo mismo no duplica el registro (por id)');
  const nodir = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  ok(nodir.length === 1, 'no se creó ninguna página nueva');
  // un archivo que dejaría los datos inválidos no escribe nada
  const bad = clone(exp); bad.pages.prueba.langs.en = { status: 'aprobado', approval: { by: 'Marta', role: 'traductor', at: '2026-11-21' }, text: sample().langs.en }; bad.pages.prueba.langs.es = { status: 'borrador', approval: null, text: sample().langs.es };
  fs.writeFileSync(expFile, JSON.stringify(bad));
  const snap = fs.readFileSync(path.join(dir, file), 'utf8'); let code = 0, err = '';
  try { cli(); } catch (e) { code = e.status; err = String(e.stderr); }
  ok(code === 1 && /castellano/.test(err) && fs.readFileSync(path.join(dir, file), 'utf8') === snap, 'una traducción aprobada con el castellano en borrador se rechaza y no se escribe nada');
  fs.writeFileSync(expFile, JSON.stringify({ kind: 'otra-cosa', pages: {} })); code = 0;
  try { cli(); } catch (e) { code = e.status; }
  ok(code === 2, 'un archivo que no es de «Contenido nuevo» se rechaza');
  const r = applyExport({ pages: { prueba: { langs: { fr: { status: 'borrador', text: {} } }, history: [] } } }, { 'a.json': clone(base) });
  ok(r.skipped.some((x) => /\[fr\]/.test(x)), 'un idioma que la página no tiene se omite y se dice');
  fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(expFile, { force: true });
}

console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ contenido nuevo: solo se publica lo aprobado, con quién y con qué función');
process.exit(fails ? 1 : 0);
