#!/usr/bin/env node
// [QA-BLOG-APACHE] El blog del panel sobre un Apache REAL con PHP-FPM, con los paquetes tal como se suben: se crean entradas por el API como lo haría el panel (entrada publicada con imagen y tabla,
// su traducción, un borrador, una programada y una con la dirección cambiada) y se mira lo que ve el público y los buscadores: la página de la entrada con la cabecera, menú y pie de la web (todos sus
// enlaces relativos resuelven), título, descripción, canonical, hreflang, Open Graph, JSON-LD, una sola h1; el listado /blog/ con las entradas nuevas entre las de siempre; sitemap.xml, llms.txt y
// llms-full.txt con las nuevas; redirecciones (dirección antigua, sin barra), borrador/programada = 404, la vista previa firmada, las imágenes con caché, métodos no permitidos y que page.php a pelo no sirve nada.
// Con un paquete de PRUEBAS aparte se comprueba que las entradas salen con noindex y que no se reescribe sitemap ni llms (no existen en pruebas).
// Necesita apache2 y php-fpm (sudo apt-get install apache2 php8.3-fpm); si no están, avisa y sale sin fallo.
//   node scripts/qa-blog-apache.mjs
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { apacheAvailable } from './lib/apache.mjs';
import { deployPackage, png } from './lib/pkg-apache.mjs';

const why = apacheAvailable();
if (why) { console.log(`(se omite: ${why})`); process.exit(0); }
let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

/** Todas las direcciones relativas (href/src) de una página → absolutas contra la dirección de la propia página. */
function localLinks(html, pageUrl) {
  const out = new Set();
  for (const m of html.matchAll(/\s(?:href|src)="([^"#]+)"/g)) {
    const u = m[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(u) || u.startsWith('mailto:') || u.startsWith('tel:')) continue;
    out.add(new URL(u, pageUrl).pathname + new URL(u, pageUrl).search);
  }
  return [...out];
}

const prod = await deployPackage({ staging: false });
try {
  const { req, api, token: T, host } = prod;
  const H = { host };
  console.log(`servidor: Apache real + PHP-FPM · producción https://${host}`);

  console.log('\n1) el servidor tiene el blog y las plantillas');
  let r = await api('/health'); ok(r.s === 200 && r.j.features && r.j.features.blog === true, 'GET /api/health anuncia el blog');
  for (const l of ['es', 'en', 'fr', 'de']) ok(fs.existsSync(path.join(prod.www, `api/generated/blog-shell.${l}.json`)), `plantilla del servidor en ${l}`);
  for (const f of ['/api/generated/blog-shell.es.json', '/api/page.php', '/api/lib/BlogPage.php', '/api/lib/Blog.php']) { r = await req(f); ok(![200].includes(r.s) || !/@@TV:|namespace Torivac/.test(r.t), `${f} no enseña plantillas ni código (HTTP ${r.s})`); }
  r = await req('/api/page.php'); ok(r.s === 404 && !/<html/i.test(r.t.slice(0, 20)), `llamar a /api/page.php a pelo no sirve nada (${r.s})`);
  r = await req('/api/page.php?kind=media&f=x-0123456789ab.png'); ok(r.s === 404, 'ni con parámetros inventados (se decide por la dirección original)');

  console.log('\n2) crear entradas por el API (como hace el panel)');
  const img = png(64, 32);
  r = await api('/blog/images', { method: 'POST', token: T, body: { name: 'Toroidal 300 VA.png', data: img.toString('base64') } });
  ok(r.s === 201 && r.j.image && /^toroidal-300-va-[0-9a-f]{12}\.png$/.test(r.j.image.file) && r.j.image.w === 64 && r.j.image.h === 32, `imagen subida: ${r.j && r.j.image && r.j.image.file}`);
  const file = r.j.image.file;
  const md = `Elegir un transformador toroidal empieza por la potencia: suma la de todo lo que va a alimentar y deja un **20 %** de margen. Consulta también [nuestros toroidales](/product/transformadores-toroidales/) y la [guía de la UE](https://commission.europa.eu/).\n\n## Potencia y margen\n\nCon una carga de 120 VA conviene un transformador de 150 VA.\n\n![Toroidal de 300 VA sobre fondo rojo](/media/blog/${file} "Toroidal de 300 VA")\n\n### Series habituales\n\n| Serie | Potencia (VA) |\n|---|---|\n| TT | 20 |\n| TTE | 300 |\n\n- Menos calentamiento\n- Menos ruido\n\n> Un margen del 20 % alarga la vida útil.`;
  r = await api('/blog/posts', { method: 'POST', token: T, body: { lang: 'es', title: 'Cómo elegir un transformador toroidal', slug: 'como-elegir-un-transformador-toroidal', excerpt: 'Guía rápida para elegir la potencia de un transformador toroidal.', seo_title: 'Cómo elegir un transformador toroidal | Torivac', seo_description: 'Guía para elegir la potencia de un transformador toroidal: margen del 20 %, series habituales y errores frecuentes.', markdown: md, image: { file, alt: 'Transformador toroidal de 300 VA sobre fondo rojo' }, status: 'published', date: '2026-01-15T09:00:00Z' } });
  ok(r.s === 201 && r.j.post.live === true, `entrada en español publicada (${r.s})`); const es = r.j.post;
  r = await api('/blog/posts', { method: 'POST', token: T, body: { lang: 'en', title: 'How to choose a toroidal transformer', slug: 'how-to-choose-a-toroidal-transformer', markdown: 'Choosing a toroidal transformer starts with power: add up everything it will supply and leave a **20 %** margin.\n\n## Power and margin\n\nA 120 VA load calls for a 150 VA transformer.', status: 'published', date: '2026-01-16T09:00:00Z', translations: { es: es.id } } });
  ok(r.s === 201, `su traducción en inglés (${r.s}${r.j && r.j.error ? ' ' + r.j.error : ''})`); const en = r.j.post;
  r = await api('/blog/posts', { method: 'POST', token: T, body: { lang: 'es', title: 'Borrador sin publicar', slug: 'borrador-sin-publicar', markdown: 'Todavía no.', status: 'draft' } }); const draft = r.j.post; ok(r.s === 201 && draft.status === 'draft', 'borrador creado');
  r = await api('/blog/posts', { method: 'POST', token: T, body: { lang: 'es', title: 'Entrada programada', slug: 'entrada-programada', markdown: 'En el futuro.', status: 'published', date: new Date(Date.now() + 5 * 864e5).toISOString() } }); const fut = r.j.post; ok(r.s === 201 && fut.live === false, 'programada: publicada con fecha futura (no se ve todavía)');
  r = await api('/blog/posts', { method: 'POST', token: T, body: { lang: 'es', title: 'Dirección que cambia', slug: 'direccion-antigua', markdown: 'Texto que cambiará de dirección.', status: 'published', date: '2026-01-10T09:00:00Z' } }); const mv = r.j.post;
  r = await api('/blog/posts/' + mv.id, { method: 'POST', token: T, body: { slug: 'direccion-nueva' } }); ok(r.s === 200 && r.j.post.slug === 'direccion-nueva', 'cambio de dirección');

  console.log('\n3) la página de la entrada: lo que ve el público y los buscadores');
  const P = '/blog/como-elegir-un-transformador-toroidal/';
  r = await req(P); const page = r.t;
  ok(r.s === 200 && /text\/html; charset=utf-8/.test(r.h['content-type'] || ''), `GET ${P} → 200 HTML`);
  ok(!/@@TV:|@@TVV:/.test(page), 'sin marcas de plantilla sin rellenar');
  ok(/<html lang="es"/.test(page) && /<title>Cómo elegir un transformador toroidal \| Torivac<\/title>/.test(page), 'idioma y título para buscadores');
  ok(page.includes('<meta name="description" content="Guía para elegir la potencia de un transformador toroidal: margen del 20 %, series habituales y errores frecuentes.">'), 'meta description');
  ok((page.match(/<h1[ >]/g) || []).length === 1 && page.includes('<h1>Cómo elegir un transformador toroidal</h1>'), 'una sola h1 con el título');
  ok(page.includes(`<link rel="canonical" href="https://${host}${P}">`), 'canonical absoluto con https');
  ok(page.includes(`hreflang="en" href="https://${host}/en/blog/how-to-choose-a-toroidal-transformer/"`) && page.includes(`hreflang="es" href="https://${host}${P}"`) && page.includes(`hreflang="x-default" href="https://${host}${P}"`), 'hreflang es + en + x-default');
  ok(!/hreflang="fr" href|hreflang="de" href/.test(page), 'sin hreflang a idiomas sin traducción');
  for (const x of ['og:title" content="Cómo elegir un transformador toroidal | Torivac"', 'og:type" content="article"', `og:url" content="https://${host}${P}"`, `og:image" content="https://${host}/media/blog/${file}"`, 'og:image:alt" content="Transformador toroidal de 300 VA sobre fondo rojo"', 'article:published_time" content="2026-01-15T09:00:00Z"', 'twitter:card" content="summary_large_image"']) ok(page.includes(x), `Open Graph: ${x.slice(0, 50)}`);
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(page)[1]);
  ok(ld['@graph'].map((n) => n['@type']).join() === 'Organization,WebSite,WebPage,BreadcrumbList,BlogPosting', 'JSON-LD: Organization, WebSite, WebPage, BreadcrumbList y BlogPosting');
  const bp = ld['@graph'].find((n) => n['@type'] === 'BlogPosting');
  ok(bp.headline === 'Cómo elegir un transformador toroidal' && bp.datePublished === '2026-01-15T09:00:00Z' && bp.image === `https://${host}/media/blog/${file}` && bp.inLanguage === 'es', 'BlogPosting: titular, fecha, imagen e idioma');
  ok(page.includes('<time datetime="2026-01-15T09:00:00Z">15 de enero de 2026</time>'), 'fecha larga en español');
  ok(page.includes('<h2>Potencia y margen</h2>') && page.includes('<h3>Series habituales</h3>') && page.includes('<strong>20 %</strong>') && page.includes('<blockquote>'), 'el texto convertido (títulos, negrita, cita)');
  ok(page.includes('aria-label="Tabla"') && page.includes('<th>Potencia (VA)</th>'), 'tabla con nombre accesible');
  ok(page.includes(`<img src="/media/blog/${file}" alt="Toroidal de 300 VA sobre fondo rojo" width="64" height="32" loading="lazy" decoding="async">`), 'imagen del texto con alt, tamaño y carga diferida');
  ok(page.includes(`<div class="prose"><div class="o-dup"><figure><img src="/media/blog/${file}" alt="Transformador toroidal de 300 VA sobre fondo rojo" width="64" height="32" decoding="async"></figure></div>`) && page.includes(`style="background-image:url('/media/blog/${file}')"`), 'imagen destacada: al principio del texto (con alt y tamaño) y de fondo de la cabecera');
  ok(page.includes('href="https://commission.europa.eu/" target="_blank" rel="noopener"') && page.includes('href="/product/transformadores-toroidales/"'), 'enlace externo seguro e interno');
  ok(/<header class="site-header/.test(page) && /<footer class="site-footer/.test(page) && /id="main-nav"/.test(page) && page.includes('data-set-lang="en"'), 'cabecera, menú, selector de idioma y pie de la web');
  ok(/<a href="\/en\/blog\/how-to-choose-a-toroidal-transformer\/" hreflang="en"/.test(page) && /<a href="\/fr\/" hreflang="fr"[^>]*class="no-tr"/.test(page), 'selector: la traducción real y, sin ella, la portada marcada');
  ok(/Content-Security-Policy/i.test(Object.keys(r.h).join()) && /script-src 'self'/.test(r.h['content-security-policy'] || ''), 'la CSP de la web también cubre estas páginas');
  ok(!/<script(?![^>]*\bsrc=)(?![^>]*application\/(?:ld\+)?json)[^>]*>/i.test(page), 'ningún script en línea ejecutable (la CSP no lo dejaría)');
  ok(!r.h['x-robots-tag'] && !/name="robots"/.test(page), 'producción: indexable');
  ok(r.h['cache-control'] === 'public, max-age=60' && r.h.etag && r.h['last-modified'] && r.h.expires, `caché de 1 min con ETag y una sola política (${r.h['cache-control']})`);
  const gz = await req(P, { headers: { 'accept-encoding': 'gzip' } }); ok(gz.h['content-encoding'] === 'gzip', 'comprimida con gzip');
  const c304 = await req(P, { headers: { 'if-none-match': r.h.etag } }); ok(c304.s === 304, 'ETag → 304');
  const missing = [];
  for (const l of localLinks(page, `https://${host}${P}`)) { if (/^\/(?:product|categoria|tienda|contacto|presupuesto|torivac-empresa|proyectos)/.test(l) || l.startsWith('/en/') || l.startsWith('/fr/') || l.startsWith('/de/') || l === '/' || l === '/blog/' || l.startsWith('/guia/')) continue; const x = await req(l, { method: 'HEAD' }); if (x.s >= 400) missing.push(`${l} (${x.s})`); }
  ok(missing.length === 0, `todos los CSS, JS, imágenes y logotipos de la página resuelven (nada roto a esa profundidad)${missing.length ? ': ' + missing.slice(0, 4).join(', ') : ''}`);
  const nav = []; for (const l of localLinks(page, `https://${host}${P}`).filter((u) => /^\/(?:contacto|presupuesto|torivac-empresa|proyectos)\/?$/.test(u) || u === '/')) { const x = await req(l, { method: 'HEAD' }); if (x.s >= 400) nav.push(`${l} (${x.s})`); }
  ok(nav.length === 0, 'los enlaces del menú relativos a la raíz funcionan desde la entrada' + (nav.length ? ': ' + nav.join(', ') : ''));
  const E = '/en/blog/how-to-choose-a-toroidal-transformer/';
  r = await req(E); ok(r.s === 200 && /<html lang="en"/.test(r.t) && r.t.includes('Published') && r.t.includes('<time datetime="2026-01-16T09:00:00Z">16 January 2026</time>') && r.t.includes(`hreflang="es" href="https://${host}${P}"`), 'la traducción en inglés: idioma, "Published", fecha en inglés y hreflang a la española');

  console.log('\n4) borrador, programada, direcciones antiguas, sin barra, métodos');
  for (const u of ['/blog/borrador-sin-publicar/', '/blog/entrada-programada/', '/en/blog/borrador-sin-publicar/', '/blog/no-existe-nada/']) { r = await req(u); ok(r.s === 404 && /<html lang="(es|en)"/.test(r.t) && !/Borrador sin publicar|Entrada programada/.test(r.t), `${u} → 404 con la página «no encontrado»`); }
  r = await req('/blog/direccion-antigua/'); ok(r.s === 301 && r.h.location === '/blog/direccion-nueva/', `dirección antigua → 301 ${r.h.location}`);
  r = await req('/blog/direccion-nueva'); ok(r.s === 301 && r.h.location === '/blog/direccion-nueva/', 'sin barra final → 301 a la barra');
  r = await req('/blog/direccion-nueva/'); ok(r.s === 200, 'la nueva dirección sirve');
  for (const m of ['POST', 'PUT', 'DELETE']) { r = await req(P, { method: m, body: '{}' }); ok(r.s === 405, `${m} → 405`); }
  r = await req(P, { method: 'HEAD' }); ok(r.s === 200 && r.t === '', 'HEAD vale y sin cuerpo');
  const pv = await api(`/blog/posts/${draft.id}/preview`, { method: 'POST', token: T });
  ok(pv.s === 200 && /^tvp=bp-[0-9a-f]{12}\.\d+\.[0-9a-f]{64}$/.test(pv.j.query), 'el panel pide la dirección firmada del borrador');
  r = await req(pv.j.path + '?' + pv.j.query); ok(r.s === 200 && r.t.includes('Borrador sin publicar') && /name="robots" content="noindex,nofollow"/.test(r.t) && /noindex/.test(r.h['x-robots-tag'] || '') && /no-store/.test(r.h['cache-control'] || ''), 'con la firma se ve el borrador, sin indexar ni cachear');
  r = await req(pv.j.path + '?' + pv.j.query.slice(0, -2) + '00'); ok(r.s === 404, 'una firma alterada no vale');
  const pf = await api(`/blog/posts/${fut.id}/preview`, { method: 'POST', token: T }); r = await req(pf.j.path + '?' + pf.j.query); ok(r.s === 200 && r.t.includes('Entrada programada'), 'la programada también se previsualiza con su firma');

  console.log('\n5) el listado /blog/ con las entradas nuevas entre las de siempre');
  r = await req('/blog/'); const idx = r.t;
  ok(r.s === 200 && !/@@TV:/.test(idx), '/blog/ 200');
  const cards = [...idx.matchAll(/<a class="post-card" href="([^"]+)"/g)].map((m) => m[1]);
  ok(cards.length === 21 + 2, `21 de la web original + 2 nuevas publicadas en español = ${cards.length}`);
  ok(cards.some((c) => c === '../blog/como-elegir-un-transformador-toroidal/') && cards.some((c) => c === '../blog/direccion-nueva/') && !cards.some((c) => /borrador|programada|direccion-antigua/.test(c)), 'están las nuevas visibles y no el borrador, la programada ni la dirección antigua');
  const dates = [...idx.matchAll(/<time datetime="([^"]+)"/g)].map((m) => m[1].slice(0, 19));
  ok(dates.every((d, i) => i === 0 || d <= dates[i - 1].slice(0, 19)) || dates.map((d) => d.replace('Z', '')).every((d, i, a) => i === 0 || d.slice(0, 10) <= a[i - 1].slice(0, 10)), 'ordenado por fecha, la más reciente primero');
  ok(idx.includes('<h3>Cómo elegir un transformador toroidal</h3>') && idx.includes(`<img src="/media/blog/${file}" alt="" loading="lazy">`), 'tarjeta con título e imagen');
  r = await req('/blog'); ok(r.s === 301 && /\/blog\/$/.test(r.h.location || ''), `/blog → ${r.h.location} (la barra final la pone Apache para las carpetas; el resto del camino lo hace PHP)`);
  r = await req('/en/blog/'); const cardsEn = [...r.t.matchAll(/<a class="post-card" href="([^"]+)"/g)].map((m) => m[1]);
  ok(r.s === 200 && cardsEn.length === 22 && cardsEn.includes('../../en/blog/how-to-choose-a-toroidal-transformer/'), `/en/blog/: 21 + 1 nueva = ${cardsEn.length}`);
  r = await req('/fr/blog/'); ok(r.s === 200 && [...r.t.matchAll(/<a class="post-card"/g)].length === 21, '/fr/blog/: solo las 21 de siempre');
  r = await req('/blog/', { headers: { 'if-none-match': 'x' } }); ok(r.s === 200 && r.h.etag, 'listado con ETag');

  console.log('\n6) sitemap.xml, llms.txt y llms-full.txt con las entradas nuevas');
  r = await req('/sitemap.xml'); const sm = r.t;
  ok(r.s === 200 && /application\/xml/.test(r.h['content-type'] || ''), 'sitemap.xml 200 XML');
  ok(sm.includes(`<loc>https://${host}${P}</loc>`) && sm.includes(`<loc>https://${host}${E}</loc>`) && sm.includes(`<loc>https://${host}/blog/direccion-nueva/</loc>`), 'las entradas nuevas están');
  ok(!/borrador-sin-publicar|entrada-programada|direccion-antigua/.test(sm), 'sin borrador, programada ni dirección antigua');
  ok(sm.includes(`<loc>https://${host}${P}</loc><xhtml:link rel="alternate" hreflang="es" href="https://${host}${P}"/><xhtml:link rel="alternate" hreflang="en" href="https://${host}${E}"/><xhtml:link rel="alternate" hreflang="x-default" href="https://${host}${P}"/>`), 'con hreflang cruzado y x-default');
  ok(sm.includes(`<image:loc>https://${host}/media/blog/${file}</image:loc><image:caption>Transformador toroidal de 300 VA sobre fondo rojo</image:caption>`), 'con la imagen y su texto alternativo');
  ok((sm.match(/<url>/g) || []).length > 700 && sm.endsWith('</urlset>'), 'sigue llevando las 750 direcciones de siempre y cierra bien');
  const xl = spawnSync('xmllint', ['--noout', '-'], { input: sm, encoding: 'utf8' }); ok(xl.error ? true : xl.status === 0, 'XML bien formado' + (xl.error ? ' (xmllint no instalado: sin comprobar)' : ''));
  r = await req('/llms.txt'); const lt = r.t;
  ok(r.s === 200 && /text\/plain/.test(r.h['content-type'] || ''), 'llms.txt 200 texto');
  ok(lt.includes('## Español · entradas del blog\n- [Cómo elegir un transformador toroidal](https://' + host + P + '): Guía rápida para elegir la potencia de un transformador toroidal.\n'), 'la entrada nueva va la primera bajo «entradas del blog»');
  ok(/## English · entradas del blog\n- \[How to choose a toroidal transformer\]/.test(lt), 'y la inglesa bajo su idioma');
  ok(/\n- \[Aplicaciones de los transformadores en la industria actual\]\(https:\/\/example\.test\/aplicaciones/.test(lt), 'las 21 entradas de la web original también están listadas');
  ok(!/Borrador sin publicar|Entrada programada/.test(lt), 'sin borradores');
  r = await req('/llms-full.txt'); ok(r.s === 200 && r.t.includes('### Cómo elegir un transformador toroidal\nhttps://' + host + P + '\n2026-01-15\nElegir un transformador toroidal empieza por la potencia') && r.t.includes('### Aplicaciones de los transformadores en la industria actual'), 'llms-full.txt: texto completo de las nuevas y de las de siempre');

  console.log('\n7) imágenes subidas');
  r = await req('/media/blog/' + file); ok(r.s === 200 && r.h['content-type'] === 'image/png' && r.h['cache-control'] === 'public, max-age=31536000, immutable' && r.h['x-content-type-options'] === 'nosniff' && Buffer.compare(r.b, img) === 0, 'la imagen se sirve tal cual, con caché de un año y nosniff');
  ok(/default-src/.test(r.h['content-security-policy'] || '') && !/unsafe-inline'[^;]*script/.test(r.h['content-security-policy'] || ''), 'con la CSP de la web (y nosniff: el navegador no la interpreta como página)');
  r = await req('/media/blog/' + file, { headers: { 'if-none-match': r.h.etag } }); ok(r.s === 304, 'ETag → 304');
  for (const bad of ['/media/blog/' + file + '.php', '/media/blog/nada-0123456789ab.png', '/media/blog/..%2f..%2fapi%2fconfig.php', '/media/blog/%2e%2e/%2e%2e/api/config.php', '/media/blog/']) { r = await req(bad); ok([403, 404].includes(r.s) && !/<\?php|session_secret/.test(r.t), `${bad} → ${r.s}, sin enseñar nada`); }
  r = await api('/blog/images/' + file, { method: 'DELETE', token: T }); ok(r.s === 409, 'una imagen en uso no se borra (409)');

  console.log('\n8) el resto de la web sigue igual');
  for (const u of ['/', '/en/', '/contacto/', '/presupuesto/', '/aplicaciones-de-los-transformadores-en-la-industria-actual/', '/en/aplicaciones-de-los-transformadores-en-la-industria-actual/', '/robots.txt']) { r = await req(u); ok(r.s === 200, `${u} 200`); }
  r = await req('/aplicaciones-de-los-transformadores-en-la-industria-actual/'); ok(/<h1>Aplicaciones de los transformadores en la industria actual<\/h1>/.test(r.t) && r.t.includes('"@type":"BlogPosting"'), 'una entrada original sigue siendo la página estática');
  r = await api('/blog/posts', { token: T }); ok(r.s === 200 && r.j.posts.length === 5, 'el listado del panel: 5 entradas (publicadas, borrador y programada)');
  r = await api('/blog/posts'); ok(r.s === 401, 'sin sesión no se listan');
  const t0 = Date.now(); for (let i = 0; i < 10; i++) await req(P); const ms = (Date.now() - t0) / 10; ok(ms < 150, `la página de una entrada responde en ${ms.toFixed(0)} ms de media`);

  const errLog = prod.ap.log();
  ok(!/PHP (Fatal|Parse|Warning|Notice|Deprecated)/.test(errLog), 'PHP no registra errores ni avisos' + (/PHP (Fatal|Parse|Warning|Notice|Deprecated)[^\n]*/.exec(errLog) ? ': ' + /PHP (Fatal|Parse|Warning|Notice|Deprecated)[^\n]*/.exec(errLog)[0].slice(0, 200) : ''));
  ok(!errLog.split('\n').some((l) => /\[core:alert\]|Invalid command|AH\d+: .*(\.htaccess)/.test(l)), 'Apache no se queja del .htaccess');

  console.log('\n9) eliminar una entrada la quita de todas partes');
  r = await api('/blog/posts/' + mv.id, { method: 'DELETE', token: T }); ok(r.s === 200, 'borrar');
  r = await req('/blog/direccion-nueva/'); ok(r.s === 404, 'su página: 404');
  r = await req('/blog/direccion-antigua/'); ok(r.s === 404, 'y la dirección antigua también');
  r = await req('/sitemap.xml'); ok(!r.t.includes('direccion-nueva'), 'fuera del sitemap');
  r = await req('/blog/'); ok(![...r.t.matchAll(/direccion-nueva/g)].length, 'fuera del listado');
  void en;
} catch (e) {
  fails++; console.error('  ✗ error en la prueba: ' + (e && e.stack || e)); console.error(prod.ap.log());
} finally { await prod.stop(); }

// ───────────────────────────────────────── pruebas: noindex y sin reescritura de sitemap/llms
console.log('\n10) dominio de pruebas: las entradas salen con noindex');
const st = await deployPackage({ staging: true });
try {
  const { req, api, token: T } = st;
  let r = await api('/blog/posts', { method: 'POST', token: T, body: { lang: 'es', title: 'Entrada en pruebas', slug: 'entrada-en-pruebas', markdown: 'Texto de prueba suficiente para publicar.', status: 'published', date: '2026-01-15T09:00:00Z' } });
  ok(r.s === 201, 'entrada creada en el entorno de pruebas');
  r = await req('/blog/entrada-en-pruebas/'); ok(r.s === 200 && /<meta name="robots" content="noindex,nofollow">/.test(r.t) && /noindex/.test(r.h['x-robots-tag'] || ''), 'noindex en la página y en la cabecera');
  ok(!r.t.includes('rel="canonical" href="https://example.test'), 'canonical con el dominio de pruebas');
  r = await req('/sitemap.xml'); ok(r.s === 404, 'sin sitemap.xml en pruebas (no se indexa)');
  r = await req('/llms.txt'); ok(r.s === 404, 'sin llms.txt en pruebas');
  r = await req('/blog/'); ok(r.s === 200 && r.t.includes('entrada-en-pruebas'), 'el listado también la muestra');
  r = await req('/robots.txt'); ok(/Disallow: \//.test(r.t), 'robots.txt prohíbe todo');
  const errLog = st.ap.log(); ok(!/PHP (Fatal|Parse|Warning|Notice|Deprecated)/.test(errLog), 'PHP sin errores');
} catch (e) {
  fails++; console.error('  ✗ error en la prueba: ' + (e && e.stack || e)); console.error(st.ap.log());
} finally { await st.stop(); }

console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ Blog sobre Apache real + PHP-FPM: entradas, SEO, hreflang, JSON-LD, listado, sitemap, llms, imágenes, borradores, redirecciones y pruebas correctos');
process.exit(fails ? 1 : 0);
