// [SEO] Datos estructurados JSON-LD (@graph) y metaetiquetas sociales. Solo con --base (necesitan URLs absolutas).
// Regla de oro: únicamente datos que existen en la web original / el catálogo (sin precios inventados, sin reseñas, sin valoraciones).
// Tipos: Organization (con logo, dirección, teléfono, correo, idiomas) · WebSite · WebPage/CollectionPage/ContactPage/AboutPage ·
//        BreadcrumbList · Product (sin "offers": el catálogo no publica precios) · ItemList (listados) · BlogPosting.

const LOCALE = { es: 'es_ES', en: 'en_GB', fr: 'fr_FR', de: 'de_DE' };
const LANG_NAME = { es: 'Spanish', en: 'English', fr: 'French', de: 'German' };
const PAGE_TYPE = { contact: 'ContactPage', blog: 'CollectionPage', shop: 'CollectionPage', home: 'WebPage', page: 'WebPage', post: 'WebPage', product: 'WebPage', quote: 'WebPage' };

export const ogLocale = (lang) => LOCALE[lang] || 'es_ES';

/** Recorta un texto a `max` caracteres sin partir palabras. */
export function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:.\-–]+$/, '') + '…';
}

/** Nodo Product de una ficha. `images`: URLs absolutas. */
export function productNode(base, { path, name, description, images, category }) {
  return {
    '@type': 'Product', '@id': `${base}${path}#product`, url: base + path, name,
    ...(description ? { description: clip(description, 500) } : {}),
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: 'Torivac' }, manufacturer: { '@id': `${base}/#organization` },
    ...(category ? { category } : {}),
  };
}
/** ItemList de un listado (productos de una categoría / todas las fichas). */
export function itemListNode(base, path, items) {
  return { '@type': 'ItemList', '@id': `${base}${path}#list`, numberOfItems: items.length, itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: base + it.path, name: it.name })) };
}
/** BlogPosting de una entrada. */
export function postNode(base, lang, { path, title, description, date, modified, image }) {
  return {
    '@type': 'BlogPosting', '@id': `${base}${path}#post`, mainEntityOfPage: { '@id': `${base}${path}#webpage` }, headline: clip(title, 110), inLanguage: lang,
    ...(description ? { description: clip(description, 300) } : {}), ...(date ? { datePublished: date } : {}), ...(modified || date ? { dateModified: modified || date } : {}),
    ...(image ? { image } : {}), author: { '@id': `${base}/#organization` }, publisher: { '@id': `${base}/#organization` },
  };
}

/**
 * Grafo completo de una página.
 * ctx: { lang, site, path }  ·  page: { template, title, description, crumbs:[{name,path}], extra:[nodos], image }
 */
export function pageGraph(ctx, page) {
  const { lang, site } = ctx; const base = site.absBase; if (!base) return null;
  const url = base + ctx.path;
  const home = base + site.home[lang];
  const c = site.meta.contact || {};
  const [street, cityLine] = c.address || [];
  const m = /^(\d{4,5})\s+(.+)$/.exec(cityLine || '');
  const logoUrl = base + '/' + site.logo.replace(/^\//, '');
  const org = {
    '@type': 'Organization', '@id': `${base}/#organization`, name: site.meta.name || 'Torivac', legalName: site.meta.legal_name, url: home, logo: { '@type': 'ImageObject', url: logoUrl },
    address: { '@type': 'PostalAddress', streetAddress: street, ...(m ? { postalCode: m[1], addressLocality: m[2] } : {}), addressCountry: 'ES' },
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer service', telephone: c.phone, email: c.email, availableLanguage: Object.values(LANG_NAME) }],
  };
  const website = { '@type': 'WebSite', '@id': `${base}/#website`, url: home, name: site.meta.name || 'Torivac', inLanguage: lang, publisher: { '@id': org['@id'] } };
  const crumbs = page.crumbs && page.crumbs.length > 1 ? page.crumbs : null;
  const webpage = {
    '@type': PAGE_TYPE[page.template] || 'WebPage', '@id': `${url}#webpage`, url, name: clip(page.title, 110), inLanguage: lang, isPartOf: { '@id': website['@id'] }, about: { '@id': org['@id'] },
    ...(page.description ? { description: clip(page.description, 300) } : {}), ...(page.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: page.image } } : {}),
    ...(crumbs ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
  };
  const nodes = [org, website, webpage];
  if (crumbs) nodes.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: String(x.name).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'), item: base + x.path })) });
  for (const n of page.extra || []) nodes.push(n);
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** <script type="application/ld+json"> seguro para incrustar (escapa < y el separador U+2028/2029). */
export function ldScript(graph) {
  if (!graph) return '';
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}</script>`;
}
