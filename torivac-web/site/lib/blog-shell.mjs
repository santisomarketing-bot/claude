// [BLOG-SHELL] Plantillas de las páginas del blog que genera el SERVIDOR (backend-php/api/lib/BlogPage.php) para las entradas que se escriben en el panel.
// La web compilada ya trae las 21 entradas por idioma de la web original como páginas estáticas; las nuevas viven en la carpeta de datos y se pintan al pedirlas, con ESTA misma cabecera, menú, pie y
// estilos: aquí se prepara, para cada idioma, la página completa con marcas @@TV:…@@ en lo variable (título, fecha, texto, imagen, enlaces de idioma…) y el servidor solo las rellena (escapando siempre).
//   blogShell({ lang, site, mkctx, posts }) → objeto que se guarda en api/generated/blog-shell.<idioma>.json (solo con --base y --php-api)
//   splitIndex(html)                        → { pre, post }: el listado del blog (/blog/) partido justo donde van las tarjetas
//   llmsHeads(lang)                         → los títulos de las secciones de entradas de llms.txt y llms-full.txt (el servidor añade ahí las nuevas)
//   dateKit(lang)                           → { pattern, months }: cómo se escribe una fecha larga en ese idioma (sale de Intl, igual que las fechas de las entradas de la web)
// Marcas que rellena el servidor: seotitle · description · links · social · ld · path · langlinks · boot · title · date · datefmt · herostyle · banner · content (entrada) y slug · cardimg · excerpt (tarjeta).

import { t } from './i18n.mjs';
import { pageGraph, ogLocale } from './seo.mjs';
import * as TPL from '../templates.mjs';

/** Locale de cada idioma para las fechas. */
const LOC = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };
/** Nombre de cada idioma en su idioma. */
const NAMES = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch' };

/** Cómo se escribe una fecha larga en ese idioma: patrón con {d} {m} {y} y nombres de los doce meses (de Intl: lo mismo que enseñan las fechas de las entradas de la web). */
export function dateKit(lang) {
  const f = new Intl.DateTimeFormat(LOC[lang], { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const pattern = f.formatToParts(new Date(Date.UTC(2025, 2, 5, 12))).map((x) => (x.type === 'day' ? '{d}' : x.type === 'month' ? '{m}' : x.type === 'year' ? '{y}' : x.value)).join('');
  const mf = new Intl.DateTimeFormat(LOC[lang], { month: 'long', timeZone: 'UTC' });
  return { pattern, months: Array.from({ length: 12 }, (_, i) => mf.format(new Date(Date.UTC(2025, i, 15)))) };
}

/** Títulos de las secciones de entradas del blog en llms.txt (corto) y llms-full.txt (con el texto), por idioma. */
export const llmsHeads = (lang) => ({ short: `## ${NAMES[lang]} · entradas del blog`, full: `## ${NAMES[lang]} · entradas del blog (texto completo)` });

/** Parte el HTML del listado del blog (/blog/) en lo que va antes y después de las tarjetas. Falla si la estructura de blogIndexBody cambió (nunca se queda a medias en silencio). */
export function splitIndex(html) {
  const open = '<div class="posts">', close = '</div></div></section>';
  const a = html.indexOf(open);
  const b = a < 0 ? -1 : html.indexOf(close, a);
  if (a < 0 || b < 0) throw new Error('blog-shell: el listado del blog ya no tiene la estructura <div class="posts">…</div> esperada');
  return { pre: html.slice(0, a + open.length), post: html.slice(b) };
}

/**
 * Plantillas del blog de un idioma. `mkctx(lang, ruta, sección)` crea el contexto de render; `posts` son las entradas estáticas de la web original (sus tarjetas se guardan para mezclarlas, por fecha, con las nuevas).
 * Las rutas de las plantillas se calculan a la profundidad real de las páginas del servidor (/blog/<slug>/ → 2 niveles; /en/blog/<slug>/ → 3), así los enlaces relativos del menú, el pie y los estilos valen.
 */
export function blogShell({ lang, site, mkctx, posts }) {
  const pre = lang === 'es' ? '' : '/' + lang;
  const sctx = mkctx(lang, `${pre}/blog/tv/`, 'blog');
  const pb = TPL.postBody(sctx, null, true);
  const post = TPL.layout(sctx, { title: '@@TV:seotitle@@', description: '@@TV:description@@', template: 'post', hero: pb.hero, body: pb.body, dyn: true });
  const ictx = mkctx(lang, site.blog[lang], 'blog');
  const nodes = pageGraph(sctx, { template: 'post', title: '' })['@graph'];                    // [Organization, WebSite, …]: lo fijo de este idioma; el servidor añade WebPage, BreadcrumbList y BlogPosting
  const dk = dateKit(lang);
  const abs = site.absBase;
  return {
    v: 1, lang, base: abs, staging: !!site.staging, locale: ogLocale(lang), month: dk.months, datePattern: dk.pattern,
    names: NAMES, home: site.home, blog: site.blog, quote: site.quote, logo: abs + '/' + site.logo.replace(/^\//, ''),
    crumb: { home: t('home', lang), blog: 'Blog' },
    tableLabel: t('blog_table', lang),                                                            // nombre accesible de las tablas del texto
    ld: { org: nodes[0], website: nodes[1] },
    parts: {
      banner: site.O ? `<img class="${TPL.oc(site, 'o-banner')}" src="@@TV:imgsrc@@" alt="" width="1140" height="280" decoding="async">` : '',
      herostyle: site.ONLY_O ? '' : `style="background-image:url('@@TV:imgsrc@@')"`,
      cardimg: '<img src="@@TV:imgsrc@@" alt="" loading="lazy">',
    },
    post,
    card: TPL.postCard(ictx, null, true),
    cards: posts.map((p) => ({ d: p.date || '', h: TPL.postCard(ictx, p) })),
    llms: llmsHeads(lang),
    index: null,                                                                                   // { pre, post }: lo rellena build.mjs con el listado ya terminado (con las huellas de versión resueltas)
  };
}

