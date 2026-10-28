/**
 * [ADMIN-PROPOSALS] Vista «Propuestas» del panel real (admin-live.js): cada propuesta de mejora se puede EDITAR, PROBAR en la página real y APLICAR.
 *   · Editar: la persona escribe SU texto (cómo debe quedar el párrafo, la traducción que falta, el título de la portada o la decisión que toma).
 *   · Probar: abre la página real en un marco y enseña el cambio puesto en su sitio (resaltado) sin publicar nada; la web de verdad no cambia.
 *   · Aplicar: guarda SU versión como aprobada en el servidor (POST /api/proposals/state con text, find, mode y note). Aprobar NO publica nada por sí solo: el texto aprobado se descarga
 *     (botón «Descargar aprobadas») y se incorpora a la web en la siguiente actualización (scripts/apply_proposals.mjs → site/lib/proposals-apply.mjs).
 * Todo lo que escribe la persona se pone con textContent (nunca como HTML). Los textos son texto plano: el servidor lo vuelve a comprobar.
 *
 *   TV.AdminProposals.view(ctx)  → Promise<string> con el HTML de la vista   ·   TV.AdminProposals.bind(root, ctx) → engancha los clics y teclas
 *   ctx = { http(method, path, body), toast(msg), when(iso), adminData() }
 * Secciones: [CLASES] [DESTINOS] [HTML] [PREVIA] [ACCIONES] [EXPORTAR]
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var A = (TV.AdminProposals = {});
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var LANGS = ['es', 'en', 'fr', 'de'], LANG_NAME = { es: 'español', en: 'inglés', fr: 'francés', de: 'alemán' };
  var TYPE_NAME = {
    legal: 'Texto legal', missing_data: 'Dato que falta', missing_translation: 'Traducción que falta', wrong_language: 'Texto en otro idioma', name_mismatch: 'Nombre distinto al del PDF', voltage_tag: 'Etiqueta de voltaje',
    seo_title: 'Título SEO', web_pdf_table: 'Tabla distinta al PDF', pdf_uncertain_model: 'Modelo dudoso del PDF', pdf_no_variants: 'PDF sin modelos', pdf_family_without_product: 'PDF sin ficha', duplicate_product: 'Fichas duplicadas', wpml_link: 'Enlace de traducción',
  };
  var SEV = { alta: 0, media: 1, baja: 2 };
  var ctx = null, propState = {}, filter = { status: 'pending', type: '', q: '' };

  // ───────────────────────────────────────── [CLASES] qué se puede hacer con cada tipo de propuesta
  /** Cómo se edita una propuesta: replace (sustituir un párrafo de la web) · translate (descripción de un producto en otro idioma) · title (títulos de la portada) · decide (una decisión o dato para el equipo). */
  function kindOf(p) {
    if (p.type === 'missing_translation') return 'translate';
    if (p.type === 'seo_title') return 'title';
    if (['wrong_language', 'name_mismatch', 'voltage_tag', 'legal', 'missing_data'].indexOf(p.type) >= 0) return 'replace';
    return 'decide';
  }
  /** Fragmento literal de la web que describe la propuesta: el texto más largo entre comillas ('…' o «…») de web_value o, si no hay, web_value entero (sin puntos suspensivos al final). */
  function literal(p) {
    var w = String(p.web_value == null ? '' : p.web_value), found = [], m, re = /'([^']{12,})'|«([^»]{12,})»/g;
    while ((m = re.exec(w))) found.push(m[1] || m[2]);
    found.sort(function (a, b) { return b.length - a.length; });
    return String(found[0] || w).replace(/[\s….]+$/, '').trim();
  }
  /** ¿Aparece entre comillas en web_value (es decir, es un trozo literal de la página y no una descripción del problema)? */
  function hasQuoted(p) { return /'[^']{12,}'|«[^»]{12,}»/.test(String(p.web_value || '')); }
  /** Modo por defecto de una propuesta de tipo «replace»: sustituir si hay un trozo literal; añadir un párrafo nuevo si solo hay una descripción del problema. */
  function defaultMode(p) {
    var k = kindOf(p);
    if (k === 'translate') return 'translate';
    if (k === 'title') return 'title';
    if (k === 'replace') return hasQuoted(p) || ['wrong_language', 'name_mismatch', 'voltage_tag'].indexOf(p.type) >= 0 ? 'replace' : 'add';
    return 'note';
  }

  // ───────────────────────────────────────── [DESTINOS] en qué páginas de la web se ve cada propuesta
  /** Idioma de una ruta de la web (/en/…, /fr/…, /de/…; el resto es español). */
  function langOfPath(path) { var m = /^\/(en|fr|de)\//.exec(path); return m ? m[1] : 'es'; }
  /** Páginas [{lang, path, label}] donde la propuesta se aplicaría, sin repetir: las que trae (pages), la ruta entre paréntesis del nombre, la ficha del producto, la categoría o las portadas (títulos). */
  function targets(p) {
    var out = [], seen = {}, adm = TV.admin || {};
    /** Añade una página destino si no estaba ya. */
    function add(lang, path, label) { if (!path || seen[lang + path]) return; seen[lang + path] = 1; out.push({ lang: lang, path: path, label: label || path }); }
    (Array.isArray(p.pages) ? p.pages : []).forEach(function (x) { add(langOfPath(x), x); });
    var m = /\((\/[^)\s]*)\)/.exec(String(p.product_name || '')); if (m) add(p.lang || langOfPath(m[1]), m[1]);
    var lang = LANGS.indexOf(p.lang) >= 0 ? p.lang : 'es';
    if (p.product_id != null) { var pr = (adm.products || []).filter(function (x) { return x.id === p.product_id; })[0]; if (pr && pr.paths) add(lang, pr.paths[lang], 'Ficha en ' + LANG_NAME[lang]); }
    if (p.category_id != null && adm.cats && adm.cats[p.category_id]) add(lang, adm.cats[p.category_id][lang], 'Categoría en ' + LANG_NAME[lang]);
    if (p.type === 'missing_data' && /titular/i.test(String(p.field))) { add('es', '/aviso-legal-2/', 'Aviso legal'); add('es', '/politica-de-privacidad/', 'Política de privacidad'); }       // el titular en blanco está en las dos páginas
    if (p.type === 'seo_title' && adm.homes) LANGS.forEach(function (l) { add(l, adm.homes[l], 'Portada en ' + LANG_NAME[l]); });
    return out;
  }
  /** Ruta de la web → dirección que se abre desde /admin/ (un nivel por encima), en modo «embed» y con index.html si la web no usa URL limpias. */
  function frameUrl(path) {
    var u = '../' + String(path).replace(/^\/+/, '');
    if (!(TV.meta && TV.meta.clean) && /\/$/.test(u)) u += 'index.html';
    return u + '?embed=1';
  }

  // ───────────────────────────────────────── [HTML]
  /** Estado guardado de una propuesta: 'ok' · 'no' · ''. */
  function statusOf(id) { return (propState[id] && propState[id].state) || ''; }
  /** Etiqueta de estado de la cabecera de una tarjeta. */
  function stateTag(s) { return s === 'ok' ? '<span class="tag">✓ Aprobada con tu versión</span>' : s === 'no' ? '<span class="tag dim">Descartada</span>' : ''; }
  /** Texto del campo principal según el tipo de edición. */
  function labelText(kind, mode) {
    if (kind === 'translate') return 'Traducción (la web la mostrará tal cual)';
    if (kind === 'title') return 'Títulos de la portada (una línea por idioma: «es: …», «en: …»)';
    if (kind === 'decide') return 'Tu decisión o el dato correcto';
    return mode === 'note' ? 'Tu decisión o el dato correcto' : mode === 'add' ? 'Párrafo nuevo' : 'Cómo debe quedar el párrafo (entero)';
  }
  /** Valor inicial del campo de texto: lo guardado y, si no hay, los títulos actuales (propuesta SEO) o nada. */
  function initialText(p, e) {
    if (e && typeof e.text === 'string') return e.text;
    if (kindOf(p) === 'title') { var out = [], re = /\b(es|en|fr|de):\s*([^]*?)(?=\s·\s(?:es|en|fr|de):|$)/g, m, src = String(p.pdf_value || ''); while ((m = re.exec(src))) out.push(m[1] + ': ' + m[2].trim()); return out.join('\n'); }
    return '';
  }
  /** HTML de los botones de modo (sustituir / añadir / solo decisión) de una propuesta de tipo «replace». */
  function modeRadios(id, mode) {
    var opts = [['replace', 'Sustituir el párrafo que contiene el texto de arriba'], ['add', 'Añadir un párrafo nuevo a la página'], ['note', 'Solo guardar mi decisión (no cambia la web)']];
    return '<fieldset class="modes"><legend>Qué hago con mi texto</legend>' + opts.map(function (o) { return '<label class="check"><input type="radio" name="mode-' + esc(id) + '" value="' + o[0] + '"' + (mode === o[0] ? ' checked' : '') + '> <span>' + esc(o[1]) + '</span></label>'; }).join('') + '</fieldset>';
  }
  /** HTML de una propuesta: cabecera plegable con su estado y, dentro, lo que dice la web, el formulario de edición y el sitio de la vista previa. */
  function cardHtml(p, open) {
    var id = p.id, e = propState[id] || {}, s = e.state || '', kind = kindOf(p), mode = e.mode || defaultMode(p), tg = targets(p);
    var find = typeof e.find === 'string' ? e.find : (kind === 'replace' ? literal(p) : '');
    var canTry = tg.length > 0 && kind !== 'decide';
    var head = '<summary><span class="tag dim">' + esc(TYPE_NAME[p.type] || p.type) + '</span> ' + (p.severity ? '<span class="tag ' + (p.severity === 'alta' ? 'warn' : 'dim') + '">' + esc(p.severity) + '</span> ' : '') + '<strong>' + esc(p.title || p.field || 'Cambio') + '</strong> ' + stateTag(s) + '</summary>';
    var info = '<p class="small muted">' + esc(p.product_name || '') + (p.ref ? ' · <span class="mono">' + esc(p.ref) + '</span>' : '') + (p.lang ? ' · ' + esc(LANG_NAME[p.lang] || p.lang) : '') + ' · <span class="mono">' + esc(id) + '</span></p>' +
      (p.web_value ? '<p class="small"><strong>Web:</strong> ' + esc(p.web_value) + '</p>' : '') + (p.pdf_value ? '<p class="small"><strong>PDF / dato propuesto:</strong> ' + esc(p.pdf_value) + '</p>' : '') + (p.recommendation ? '<p class="small muted">' + esc(p.recommendation) + '</p>' : '');
    var fields = (kind === 'replace' ? modeRadios(id, mode) + '<label>Texto que hay ahora en la web (basta un trozo del párrafo)<input name="find" maxlength="300" value="' + esc(find) + '"></label>' : '') +
      '<label><span data-lbl>' + esc(labelText(kind, mode)) + '</span><textarea name="text" rows="' + (kind === 'title' ? 5 : 6) + '" maxlength="3000">' + esc(initialText(p, e)) + '</textarea></label>' +
      '<label>Nota (opcional)<input name="note" maxlength="500" value="' + esc(e.note || '') + '"></label>';
    var actions = '<div class="actions">' + (kind === 'replace' && tg.length ? '<button class="btn sm ghost" type="button" data-pa="load">Traer el párrafo de la web</button> ' : '') + (canTry ? '<button class="btn sm ghost" type="button" data-pa="try">Probar en la página</button> ' : '') +
      '<button class="btn sm" type="submit">' + (s === 'ok' ? 'Guardar cambios' : 'Aplicar') + '</button> ' + (s !== 'no' ? '<button class="btn sm ghost" type="button" data-pa="discard">Descartar</button> ' : '') + (s ? '<button class="btn sm ghost" type="button" data-pa="undo">Deshacer</button>' : '') + '</div>';
    var meta = s ? '<p class="small muted">' + (s === 'ok' ? 'Aprobada' : 'Descartada') + ' por ' + esc(e.by || '') + ' · ' + esc(ctx.when(e.at)) + (s === 'ok' && (e.mode === 'replace' || e.mode === 'translate' || e.mode === 'title') ? ' · se publicará en la siguiente actualización de la web' : s === 'ok' ? ' · queda anotada para quien la coloque' : '') + '</p>' : '';
    var tryBox = '<div class="tryarea" data-try hidden>' + (tg.length > 1 ? '<label>Página <select data-pa-target>' + tg.map(function (t, i) { return '<option value="' + i + '">' + esc(t.label) + ' (' + esc(t.path) + ')</option>'; }).join('') + '</select></label>' : '') + '<div class="serp" data-serp hidden></div><p class="small" data-try-msg role="status" aria-live="polite"></p><div data-frame></div></div>';
    return '<details class="panel prop' + (s ? ' done' : '') + '" data-id="' + esc(id) + '"' + (open ? ' open' : '') + '>' + head + '<div class="prop-body">' + info + meta + '<form class="form" data-pform novalidate>' + fields + actions + '<p class="small" data-msg role="status" aria-live="polite"></p></form>' + tryBox + '</div></details>';
  }
  /** Propuestas que cumplen el filtro actual (estado, tipo y búsqueda), las más graves primero. */
  function filtered() {
    var q = filter.q.trim().toLowerCase();
    return (TV.proposals || []).filter(function (p) {
      var s = statusOf(p.id);
      if (filter.status === 'pending' && s) return false;
      if (filter.status === 'ok' && s !== 'ok') return false;
      if (filter.status === 'no' && s !== 'no') return false;
      if (filter.type && p.type !== filter.type) return false;
      return !q || [p.title, p.product_name, p.web_value, p.pdf_value, p.recommendation, p.id, p.field].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (SEV[a.severity] == null ? 3 : SEV[a.severity]) - (SEV[b.severity] == null ? 3 : SEV[b.severity]); });
  }
  /** Contadores por estado (pendientes · aprobadas · descartadas · todas). */
  function counts() {
    var c = { pending: 0, ok: 0, no: 0, all: 0 };
    (TV.proposals || []).forEach(function (p) { var s = statusOf(p.id); c.all++; if (s === 'ok') c.ok++; else if (s === 'no') c.no++; else c.pending++; });
    return c;
  }
  /** Barra de filtros: estado (botones), tipo, búsqueda y la descarga de las aprobadas. */
  function barHtml() {
    var c = counts(), types = {};
    (TV.proposals || []).forEach(function (p) { types[p.type] = (types[p.type] || 0) + 1; });
    var chips = [['pending', 'Pendientes'], ['ok', 'Aprobadas'], ['no', 'Descartadas'], ['all', 'Todas']].map(function (x) { return '<button type="button" class="btn sm' + (filter.status === x[0] ? '' : ' ghost') + '" data-pa="status" data-v="' + x[0] + '" aria-pressed="' + (filter.status === x[0]) + '">' + x[1] + ' (' + c[x[0]] + ')</button>'; }).join(' ');
    var opts = '<option value="">Todos los tipos</option>' + Object.keys(types).sort().map(function (t) { return '<option value="' + esc(t) + '"' + (filter.type === t ? ' selected' : '') + '>' + esc(TYPE_NAME[t] || t) + ' (' + types[t] + ')</option>'; }).join('');
    return '<div class="prop-bar"><div role="group" aria-label="Estado de las propuestas">' + chips + '</div><label>Tipo<select data-pa-type>' + opts + '</select></label><label>Buscar<input type="search" data-pa-q value="' + esc(filter.q) + '" placeholder="texto, producto, PR-…"></label>' +
      '<button class="btn sm" type="button" data-pa="export"' + (c.ok ? '' : ' disabled') + '>Descargar aprobadas (' + c.ok + ')</button></div>';
  }
  /** HTML de la lista (tarjetas) del filtro actual; el sitio de las tarjetas se rellena aparte para no perder el foco al teclear en la búsqueda. */
  function listHtml() {
    var list = filtered();
    return list.length ? list.map(function (p) { return cardHtml(p, false); }).join('') : '<p class="notice">No hay propuestas con este filtro.</p>';
  }
  /** Vista Propuestas: explicación en tres pasos, barra de filtros y la lista. */
  A.view = function (c) {
    ctx = c;
    return Promise.all([ctx.http('GET', '/api/proposals/state'), ctx.adminData()]).then(function (a) {
      propState = (a[0] && a[0].state) || {};
      if (!(TV.proposals || []).length) return '<h1>Propuestas</h1><p class="notice">No hay propuestas todavía.</p>';
      return '<h1>Propuestas de cambio</h1><p class="muted">Aquí están las mejoras que se han detectado. <strong>Nada está publicado:</strong> la web usa el dato original hasta que lo apruebes. Para cada una puedes <strong>1) escribir tu versión</strong>, <strong>2) probarla</strong> en la página real (no se publica) y <strong>3) aplicarla</strong>: queda aprobada con tu texto y se publica en la siguiente actualización de la web (descarga las aprobadas con el botón de abajo).</p>' +
        '<div data-pa-bar>' + barHtml() + '</div><div data-pa-list>' + listHtml() + '</div>';
    });
  };

  // ───────────────────────────────────────── [PREVIA] la página real con el cambio puesto (en un marco sin scripts; nada se publica)
  /** Texto comparable: sin comillas ni guiones tipográficos, espacios únicos, minúsculas. */
  function norm(s) { return String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/[“”«»„‟]/g, '"').replace(/[‘’‚‛`´]/g, "'").replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase(); }
  /** Elemento de texto más pequeño de la página (párrafo, título, elemento de lista o celda) cuyo texto contiene `find`; null si no hay. */
  function findBlock(doc, find) {
    var needle = norm(find), best = null, bestLen = 1e9;
    if (!needle) return null;
    var els = doc.querySelectorAll('main p, main li, main td, main th, main h1, main h2, main h3, main h4, main h5, main h6, main dd, main dt, main figcaption, main blockquote');
    for (var i = 0; i < els.length; i++) {
      var t = norm(els[i].textContent);
      if (t.indexOf(needle) >= 0 && t.length < bestLen) { best = els[i]; bestLen = t.length; }
    }
    return best;
  }
  /** Resalta un elemento del marco para que se vea dónde cae el cambio. */
  function mark(el) { el.setAttribute('data-tv-try', ''); el.style.outline = '3px solid #e8a100'; el.style.outlineOffset = '2px'; el.style.background = '#fff4d6'; }
  /** Párrafos de un texto: separados por líneas en blanco, sin vacíos. */
  function paras(text) { return String(text).replace(/\r\n?/g, '\n').split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean); }
  /** Pone el texto de la persona en un elemento (con textContent) y, si hay varios párrafos y el elemento es un párrafo, añade los demás detrás. */
  function putText(el, text) {
    var ps = paras(text), first = ps[0] || '';
    el.textContent = first.replace(/\s*\n\s*/g, ' '); mark(el);
    if (el.tagName === 'P') { var last = el; ps.slice(1).forEach(function (t) { var n = el.ownerDocument.createElement('p'); n.textContent = t.replace(/\s*\n\s*/g, ' '); mark(n); last.parentNode.insertBefore(n, last.nextSibling); last = n; }); }
  }
  /** Descripción meta de la página del marco ('' si no la tiene). */
  function metaDesc(doc) { var m = doc.querySelector('meta[name="description"]'); return m ? m.getAttribute('content') || '' : ''; }
  /**
   * Pone en el documento `doc` del marco la versión `v` ({mode, find, text}) de la propuesta `p` para la página `t` → { ok, msg, serp? }. Cada modo cambia un sitio distinto: replace (el párrafo), add (un
   * párrafo nuevo al final), translate (la descripción de la ficha) y title (el título de la pestaña; el resultado de búsqueda se dibuja en el panel). Nada se guarda.
   */
  function previewIn(doc, p, v, t) {
    doc.documentElement.classList.add('embed');
    var main = doc.querySelector('main') || doc.body;
    if (v.mode === 'replace') {
      var el = findBlock(doc, v.find);
      if (!el) return { ok: false, msg: 'No encuentro ese texto en esta página (puede estar cambiado, partido en varios estilos o ser solo la descripción del problema). Corrige el recuadro «Texto que hay ahora en la web», prueba con «Traer el párrafo de la web» o elige «Añadir un párrafo nuevo».' };
      putText(el, v.text); el.scrollIntoView({ block: 'center' });
      return { ok: true, msg: 'Así quedaría el párrafo (resaltado). La web de verdad no ha cambiado.' };
    }
    if (v.mode === 'add') {
      var box = doc.createElement('div'); mark(box); box.style.padding = '12px'; box.style.margin = '16px 0';
      var tag = doc.createElement('p'); tag.textContent = 'Texto nuevo (aquí se añadiría; su sitio exacto lo decide quien lo coloque)'; tag.style.fontSize = '12px'; tag.style.fontWeight = '700'; box.appendChild(tag);
      paras(v.text).forEach(function (x) { var n = doc.createElement('p'); n.textContent = x.replace(/\s*\n\s*/g, ' '); box.appendChild(n); });
      (main.querySelector('.container') || main).appendChild(box); box.scrollIntoView({ block: 'center' });
      return { ok: true, msg: 'Así se vería el párrafo nuevo (al final de la página, resaltado). La web de verdad no ha cambiado.' };
    }
    if (v.mode === 'translate') {
      var d = doc.querySelector('.pdp-desc');
      if (!d) return { ok: false, msg: 'Esta página no tiene la descripción de una ficha de producto.' };
      while (d.firstChild) d.removeChild(d.firstChild);
      paras(v.text).forEach(function (x) { var n = doc.createElement('p'); n.textContent = x.replace(/\s*\n\s*/g, ' '); d.appendChild(n); });
      mark(d); [].forEach.call(doc.querySelectorAll('main article .notice'), function (n) { n.style.display = 'none'; }); d.scrollIntoView({ block: 'center' });
      return { ok: true, msg: 'Así se vería la descripción con tu traducción (resaltada); el aviso de «traducción pendiente» desaparecería. La web de verdad no ha cambiado.' };
    }
    if (v.mode === 'title') {
      var line = String(v.text).split('\n').map(function (l) { var m = /^\s*([a-z]{2})\s*:\s*(.+?)\s*$/.exec(l); return m ? [m[1], m[2]] : null; }).filter(Boolean).filter(function (x) { return x[0] === t.lang; })[0];
      if (!line) return { ok: false, msg: 'No hay una línea «' + t.lang + ': …» en tu texto para esta portada.' };
      doc.title = line[1];
      return { ok: true, msg: 'Así se vería el título de esta portada en una búsqueda (a la derecha del texto, lo que Google recorta pasa de ~60 caracteres).', serp: { title: line[1], url: String(location.origin) + t.path, desc: metaDesc(doc) } };
    }
    return { ok: false, msg: 'Esta propuesta es una decisión: no tiene vista previa.' };
  }
  /** Dibuja el resultado de búsqueda de ejemplo (título, dirección y descripción) con los textos de la persona, sin HTML. */
  function drawSerp(box, s) {
    box.hidden = !s; if (!s) return;
    box.textContent = '';
    ['title', 'url', 'desc'].forEach(function (k) { var n = document.createElement('div'); n.className = 'serp-' + k; n.textContent = s[k] + (k === 'title' ? ' (' + s[k].length + ' caracteres)' : ''); box.appendChild(n); });
  }
  /** Lee la versión de la persona del formulario de una tarjeta → {mode, find, text, note}. */
  function readForm(card, p) {
    var f = card.querySelector('[data-pform]'), kind = kindOf(p), mode = kind === 'replace' ? ((f.querySelector('input[type=radio]:checked') || {}).value || 'replace') : defaultMode(p);
    return { mode: mode, find: f.elements.find ? f.elements.find.value : '', text: f.elements.text.value, note: f.elements.note.value };
  }
  /** Abre (o actualiza) la vista previa de una tarjeta: el marco con la página destino elegida y el cambio puesto. */
  function runTry(card, p) {
    var tg = targets(p), sel = card.querySelector('[data-pa-target]'), t = tg[sel ? +sel.value : 0], box = card.querySelector('[data-try]'), msg = card.querySelector('[data-try-msg]'), holder = card.querySelector('[data-frame]'), serp = card.querySelector('[data-serp]');
    var v = readForm(card, p);
    if (!t) return;
    if (!v.text.trim()) { box.hidden = false; msg.textContent = 'Escribe primero tu texto para poder probarlo.'; return; }
    box.hidden = false; msg.textContent = 'Cargando la página…'; drawSerp(serp, null);
    holder.textContent = '';
    var ifr = document.createElement('iframe');
    ifr.className = 'tryframe'; ifr.title = 'Vista previa de ' + t.path + ' con tu cambio (no está publicado)'; ifr.setAttribute('sandbox', 'allow-same-origin');
    ifr.addEventListener('load', function () {
      var doc = ifr.contentDocument, r;
      if (!doc || !doc.body || !doc.body.firstChild) { msg.textContent = 'No se ha podido abrir la página ' + t.path + '.'; return; }
      r = previewIn(doc, p, v, t); msg.textContent = r.msg; drawSerp(serp, r.serp || null); box.setAttribute('data-try-ok', r.ok ? '1' : '0');
    });
    ifr.src = frameUrl(t.path); holder.appendChild(ifr);
  }
  /** «Traer el párrafo de la web»: abre la página, busca el párrafo que contiene el texto indicado y lo pone entero en el recuadro para editarlo en su sitio. */
  function runLoad(card, p) {
    var tg = targets(p), sel = card.querySelector('[data-pa-target]'), t = tg[sel ? +sel.value : 0], f = card.querySelector('[data-pform]'), msg = card.querySelector('[data-msg]');
    if (!t) return;
    msg.textContent = 'Buscando el párrafo…';
    var ifr = document.createElement('iframe'); ifr.setAttribute('sandbox', 'allow-same-origin'); ifr.style.display = 'none'; ifr.title = 'carga';
    ifr.addEventListener('load', function () {
      var el = ifr.contentDocument && findBlock(ifr.contentDocument, f.elements.find.value);
      if (el) { f.elements.text.value = el.textContent.replace(/\s+/g, ' ').trim(); msg.textContent = 'Párrafo cargado: edítalo como debe quedar.'; f.elements.text.focus(); }
      else msg.textContent = 'No encuentro ese texto en ' + t.path + '. Escribe en «Texto que hay ahora en la web» un trozo que aparezca tal cual.';
      ifr.remove();
    });
    ifr.src = frameUrl(t.path); card.appendChild(ifr);
  }

  // ───────────────────────────────────────── [ACCIONES] aplicar, descartar, deshacer
  /** Mensaje de error del servidor para un campo: lo pone en la tarjeta y marca el campo si el servidor dijo cuál. */
  function showError(card, r) {
    var msg = card.querySelector('[data-msg]'), f = card.querySelector('[data-pform]');
    msg.textContent = '⚠ ' + ((r && r.error) || 'No se pudo guardar');
    var el = r && r.field && f.elements[r.field]; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
  /** Vuelve a pintar una tarjeta con el estado actual, manteniéndola abierta. */
  function redraw(card, id) {
    var p = (TV.proposals || []).filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var tmp = document.createElement('div'); tmp.innerHTML = cardHtml(p, true);
    card.parentNode.replaceChild(tmp.firstChild, card);
    refreshBar();
  }
  /** Repinta la barra de filtros (los contadores cambian al aprobar o descartar). */
  function refreshBar() { var bar = document.querySelector('[data-pa-bar]'); if (bar) { var q = bar.querySelector('[data-pa-q]'), had = q && document.activeElement === q; bar.innerHTML = barHtml(); if (had) bar.querySelector('[data-pa-q]').focus(); } }
  /** Guarda el estado de una propuesta en el servidor (ok con su texto, no con nota, o '' para deshacer) y repinta la tarjeta. */
  function save(card, p, state) {
    var body = { id: p.id, state: state }, msg = card.querySelector('[data-msg]');
    if (state) {
      var v = readForm(card, p);
      if (state === 'ok') {
        if (v.mode !== 'note' && !v.text.trim()) { msg.textContent = 'Escribe tu texto (o elige «Solo guardar mi decisión» y apunta la decisión).'; card.querySelector('[name=text]').focus(); return; }
        if (v.mode === 'replace' && !v.find.trim()) { msg.textContent = 'Indica un trozo del texto que hay ahora en la web.'; card.querySelector('[name=find]').focus(); return; }
        body.mode = v.mode; body.text = v.text; if (v.mode === 'replace') body.find = v.find;
      }
      body.note = v.note;
    }
    msg.textContent = 'Guardando…';
    ctx.http('POST', '/api/proposals/state', body).then(function (r) {
      if (!r.ok) return showError(card, r);
      propState = r.state || {};
      ctx.toast(state === 'ok' ? 'Aprobada con tu texto' : state === 'no' ? 'Descartada' : 'Deshecho');
      if (filter.status !== 'all' && ((filter.status === 'pending' && state) || (filter.status === 'ok' && state !== 'ok') || (filter.status === 'no' && state !== 'no'))) { card.remove(); refreshBar(); } else redraw(card, p.id);
    });
  }

  // ───────────────────────────────────────── [EXPORTAR] las aprobadas, para incorporarlas a la web
  /** Datos de las propuestas aprobadas con su texto → objeto que se descarga como JSON (lo lee scripts/apply_proposals.mjs). */
  function exportData() {
    var approved = [], rejected = [];
    (TV.proposals || []).forEach(function (p) {
      var e = propState[p.id]; if (!e) return;
      if (e.state === 'no') { rejected.push({ id: p.id, note: e.note || '', by: e.by, at: e.at }); return; }
      var tg = targets(p);
      approved.push({ id: p.id, type: p.type, field: p.field, title: p.title, lang: p.lang || undefined, product_id: p.product_id == null ? undefined : p.product_id, category_id: p.category_id == null ? undefined : p.category_id, product_name: p.product_name || undefined,
        web_value: p.web_value || undefined, mode: e.mode || 'note', find: e.find || undefined, text: e.text || undefined, note: e.note || undefined, targets: (e.mode === 'replace' ? tg : []).map(function (t) { return { lang: t.lang, path: t.path }; }), by: e.by, at: e.at });
    });
    return { kind: 'torivac-propuestas-aprobadas', version: 1, generated_at: new Date().toISOString(), site: location.origin, approved: approved, rejected: rejected };
  }
  /** Descarga las propuestas aprobadas como archivo JSON (propuestas-aprobadas-AAAA-MM-DD.json). */
  function doExport() {
    var blob = new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'propuestas-aprobadas-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  A.exportData = exportData;

  /** Engancha los clics, cambios y envíos de la vista (delegación de eventos sobre `root`). Los eventos se enlazan UNA sola vez (root no se repinta, sus nodos sí); `ctx` se actualiza cada vez. */
  A.bind = function (root, c) {
    ctx = c;
    if (root.__paBound) return;
    root.__paBound = true;
    /** Propuesta de la tarjeta que contiene el elemento. */
    var cardOf = function (el) { var card = el.closest ? el.closest('details.prop') : null; return card ? { card: card, p: (TV.proposals || []).filter(function (x) { return x.id === card.getAttribute('data-id'); })[0] } : null; };
    /** Repinta la lista con el filtro actual. */
    var relist = function () { var l = root.querySelector('[data-pa-list]'); if (l) { l.innerHTML = listHtml(); refreshBar(); } };
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pa]'); if (!b) return;
      var act = b.getAttribute('data-pa'), c1 = cardOf(b);
      if (act === 'status') { filter.status = b.getAttribute('data-v'); relist(); }
      else if (act === 'export') doExport();
      else if (c1 && c1.p) {
        if (act === 'try') runTry(c1.card, c1.p);
        else if (act === 'load') runLoad(c1.card, c1.p);
        else if (act === 'discard') save(c1.card, c1.p, 'no');
        else if (act === 'undo') save(c1.card, c1.p, '');
      }
    });
    root.addEventListener('submit', function (e) { var c1 = e.target.hasAttribute && e.target.hasAttribute('data-pform') ? cardOf(e.target) : null; if (c1 && c1.p) { e.preventDefault(); save(c1.card, c1.p, 'ok'); } });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-pa-type')) { filter.type = t.value; relist(); }
      else if (t.hasAttribute('data-pa-q')) { filter.q = t.value; relist(); var q = root.querySelector('[data-pa-q]'); if (q) q.focus(); }
      else if (t.hasAttribute('data-pa-target')) { var c1 = cardOf(t); if (c1 && c1.p) runTry(c1.card, c1.p); }
      else if (t.type === 'radio') { var c2 = cardOf(t); if (c2) { var lbl = c2.card.querySelector('[data-lbl]'); if (lbl) lbl.textContent = labelText('replace', t.value); } }
    });
    root.addEventListener('input', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });
  };
})();
