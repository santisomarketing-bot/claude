/**
 * [ADMIN-BLOG] Vista «Blog» del panel real (admin-live.js, solo managers): escribir, ordenar y publicar las entradas del blog sin tocar archivos. Las entradas viven en la carpeta de datos del servidor
 * (no en los archivos de la web) y se publican en /blog/<dirección>/ con SEO completo (título, descripción, canonical, hreflang, Open Graph, JSON-LD, sitemap.xml y llms.txt); ver docs/BLOG.md.
 *   · Listado con filtros (idioma, estado, texto) y estado de cada entrada: publicada, programada (con fecha futura) o borrador.
 *   · Editor: texto en Markdown reducido con barra de herramientas y vista previa EN VIVO (TV.BlogMarkdown: el mismo conversor que usa el servidor al publicar), imagen destacada e imágenes en el texto
 *     (se comprimen en el navegador antes de subirlas), dirección, resumen, SEO con vista previa de Google y lista de comprobación, fecha y estado, traducciones enlazadas y «Ver como saldrá»
 *     (la página real, con una dirección firmada de una hora, aunque sea un borrador y sin que la indexe nadie).
 * Todo lo que escribe la persona se pone como texto (nunca como HTML) salvo el resultado del conversor, que escapa todo y solo emite etiquetas permitidas. El servidor lo vuelve a comprobar todo.
 *
 *   TV.AdminBlog.view(ctx, arg) → Promise<string> con el HTML de la vista (arg: «» listado · «nueva» o «nueva?lang=en&tr=<id>» entrada nueva · «<id>» editar)
 *   TV.AdminBlog.bind(root, ctx) → engancha clics, teclas y cambios (una sola vez)      TV.AdminBlog.dirty() → ¿hay cambios sin guardar?
 *   ctx = { http(method, path, body), toast(msg), when(iso) }
 * Secciones: [UTIL] [DATOS] [LISTA] [EDITOR] [SEO] [TEXTO] [IMAGENES] [GUARDAR] [EVENTOS]
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var B = (TV.AdminBlog = {});
  var ctx = null;
  var LANGS = ['es', 'en', 'fr', 'de'], LANG_NAME = { es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán' };
  /** Estado del módulo: entradas del listado, hora del servidor, límites, imágenes subidas, la entrada que se edita y si tiene cambios sin guardar. */
  var S = { posts: [], skew: 0, limits: {}, images: [], cur: null, dirty: false, slugAuto: false, filter: { lang: '', status: '', q: '' }, tab: 'both', picking: null };

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Número con cero a la izquierda a dos cifras. */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** Fecha ISO → valor de un <input type="datetime-local"> en la hora del navegador ('' si no hay). */
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** Valor de un <input type="datetime-local"> (hora del navegador) → ISO en UTC «AAAA-MM-DDTHH:MM:SSZ», o null. */
  function fromLocalInput(v) { if (!v) return null; var d = new Date(v); return isNaN(d) ? null : d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  /** Ruta de la web dentro del dominio («» o «/prueba») según dónde está el panel (/admin/). */
  function siteBase() { return location.pathname.replace(/\/admin(?:\/.*)?$/, ''); }
  /** Dirección pública completa de una ruta de la web. */
  function publicUrl(path) { return location.origin + siteBase() + path; }
  /** Ruta pública de una entrada de ese idioma y dirección. */
  function pathOf(lang, slug) { return (lang === 'es' ? '' : '/' + lang) + '/blog/' + slug + '/'; }
  /** Ahora, según el reloj del servidor (la diferencia con el del navegador se mide al cargar el listado). */
  function nowMs() { return Date.now() + S.skew; }
  /** Estado de una entrada del listado o del editor: «live» (publicada y ya visible), «scheduled» (publicada con fecha futura) o «draft». */
  function stateOf(p) { if (p.status !== 'published') return 'draft'; var t = Date.parse(p.date || ''); return !isNaN(t) && t > nowMs() ? 'scheduled' : 'live'; }
  /** Etiqueta HTML del estado de una entrada. */
  function stateTag(p) {
    var s = stateOf(p);
    return s === 'live' ? '<span class="tag bl-state">Publicada</span>' : s === 'scheduled' ? '<span class="tag dim bl-state">Programada · ' + esc(shortDate(p.date)) + '</span>' : '<span class="tag warn bl-state">Borrador</span>';
  }
  /** Fecha corta local (dd/mm/aaaa hh:mm) de una fecha ISO. */
  function shortDate(iso) { var d = new Date(iso); return isNaN(d) ? '—' : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** Título + «…» recortado a `n` caracteres. */
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
  /** Dirección a partir de un título (el mismo slugify que el servidor, sale de shared/blog-markdown.mjs). */
  function slugify(t) { return TV.BlogMarkdown ? TV.BlogMarkdown.slugify(t) : String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); }
  /** Aviso de que el blog no está disponible en este servidor. */
  function unavailable(r) { return '<h1>Blog</h1><p class="notice">' + esc(r && r.error ? r.error : 'El blog no está disponible en este servidor.') + '</p>'; }
  /** Parte «nueva?lang=en&tr=bp-…» o «bp-…» en { id, q }. */
  function parseArg(arg) {
    var i = arg.indexOf('?'), id = i < 0 ? arg : arg.slice(0, i), q = {};
    if (i >= 0) arg.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { id: id, q: q };
  }

  // ───────────────────────────────────────── [DATOS] carga desde el servidor
  /** Entrada vacía para empezar a escribir (idioma, y si viene de «Crear la traducción», enlazada con la original). */
  function blank(lang, tr) {
    var p = { lang: lang, title: '', slug: '', excerpt: '', seo_title: '', seo_description: '', markdown: '', image: null, status: 'draft', date: null, translations: {} };
    if (tr) { var o = S.posts.filter(function (x) { return x.id === tr; })[0]; if (o && o.lang !== lang) p.translations[o.lang] = o.id; }
    return p;
  }
  /** Pide el listado (con la hora y los límites del servidor). Devuelve Promise<null|respuesta con error>. */
  function loadList() {
    return ctx.http('GET', '/api/blog/posts').then(function (r) {
      if (!r.ok) return r;
      S.posts = r.posts || []; S.limits = r.limits || {}; S.skew = Date.parse(r.now || '') ? Date.parse(r.now) - Date.now() : 0;
      return null;
    });
  }
  /** Prepara lo que necesita la vista pedida (listado; o listado + imágenes + la entrada). Devuelve Promise<null|respuesta con error>. */
  function load(a) {
    return loadList().then(function (err) {
      if (err) return err;
      if (a.id === '') return null;
      return ctx.http('GET', '/api/blog/images').then(function (im) {
        if (!im.ok) return im;
        S.images = im.images || [];
        if (a.id === 'nueva') { S.cur = blank(LANGS.indexOf(a.q.lang) >= 0 ? a.q.lang : 'es', a.q.tr || ''); S.slugAuto = true; S.dirty = false; return null; }
        return ctx.http('GET', '/api/blog/posts/' + encodeURIComponent(a.id)).then(function (r) {
          if (!r.ok) return r;
          S.cur = r.post; S.cur.translations = r.post.translations || {}; S.slugAuto = false; S.dirty = false; return null;
        });
      });
    });
  }

  // ───────────────────────────────────────── [LISTA]
  /** Entradas del listado que pasan el filtro actual. */
  function filtered() {
    var f = S.filter, q = f.q.trim().toLowerCase();
    return S.posts.filter(function (p) {
      return (!f.lang || p.lang === f.lang) && (!f.status || stateOf(p) === f.status) && (!q || (p.title + ' ' + p.slug).toLowerCase().indexOf(q) >= 0);
    });
  }
  /** Filas de la tabla del listado. */
  function rowsHtml() {
    var list = filtered();
    if (!list.length) return '<tr><td colspan="5" class="muted">' + (S.posts.length ? 'Ninguna entrada coincide con el filtro.' : 'Todavía no hay entradas. Pulsa «Nueva entrada» para escribir la primera.') + '</td></tr>';
    return list.map(function (p) {
      var tr = LANGS.filter(function (l) { return l !== p.lang && S.posts.some(function (x) { return x.grp === p.grp && x.lang === l; }); });
      return '<tr><td><a href="#blog/' + esc(p.id) + '"><strong>' + esc(p.title) + '</strong></a><br><span class="muted small mono">' + esc(p.path) + '</span></td><td>' + esc(LANG_NAME[p.lang]) + '</td><td>' + stateTag(p) + '</td><td>' + esc(p.date ? shortDate(p.date) : '—') +
        '</td><td>' + (tr.length ? tr.map(function (l) { return '<span class="tag dim">' + l.toUpperCase() + '</span>'; }).join(' ') : '<span class="muted small">—</span>') + '</td><td class="bl-actions"><a class="btn sm ghost" href="#blog/' + esc(p.id) + '">Editar</a>' +
        (stateOf(p) === 'live' ? ' <a class="btn sm ghost" href="' + esc(publicUrl(p.path)) + '" target="_blank" rel="noopener">Ver<span class="vh"> «' + esc(p.title) + '» en la web</span></a>' : '') + ' <button class="btn sm ghost" type="button" data-bl="del-row" data-id="' + esc(p.id) + '">Borrar</button></td></tr>';
    }).join('');
  }
  /** Vista del listado: contadores, filtros y tabla. */
  function listHtml() {
    var n = { live: 0, scheduled: 0, draft: 0 };
    S.posts.forEach(function (p) { n[stateOf(p)]++; });
    /** Una <option> con su valor y su texto, marcada si es la actual. */
    var opt = function (v, t, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + t + '</option>'; };
    return '<div data-bl-root data-bl-mode="list"><h1>Blog</h1><p class="muted">Escribe y publica entradas sin tocar archivos. Se ven en <span class="mono">/blog/</span> junto a las que ya tenía la web, con su SEO, en el mapa del sitio y en <span class="mono">llms.txt</span>.</p>' +
      '<div class="kpis">' + [['Publicadas', n.live], ['Programadas', n.scheduled], ['Borradores', n.draft]].map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><strong>' + k[1] + '</strong></div>'; }).join('') + '</div>' +
      '<div class="prop-bar"><label>Idioma<select data-bl-filter="lang">' + opt('', 'Todos', S.filter.lang) + LANGS.map(function (l) { return opt(l, LANG_NAME[l], S.filter.lang); }).join('') + '</select></label>' +
      '<label>Estado<select data-bl-filter="status">' + opt('', 'Todos', S.filter.status) + opt('live', 'Publicadas', S.filter.status) + opt('scheduled', 'Programadas', S.filter.status) + opt('draft', 'Borradores', S.filter.status) + '</select></label>' +
      '<label>Buscar<input type="search" data-bl-filter="q" value="' + esc(S.filter.q) + '" placeholder="título o dirección"></label><a class="btn" href="#blog/nueva">Nueva entrada</a></div>' +
      '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Entrada</th><th>Idioma</th><th>Estado</th><th>Fecha</th><th>Traducciones</th><th><span class="vh">Acciones</span></th></tr></thead><tbody data-bl-rows>' + rowsHtml() + '</tbody></table></div></div>';
  }

  // ───────────────────────────────────────── [EDITOR] formulario
  /** Contador «n/máx» de un campo de una línea. */
  function countHtml(name, max) { return '<span class="bl-count" data-bl-count="' + name + '" data-max="' + max + '"></span>'; }
  /** Cuadro de la imagen destacada: vista previa, texto alternativo y botones. */
  function coverHtml() {
    var im = S.cur.image, L = S.limits;
    return '<section class="panel"><h2>Imagen destacada</h2><p class="muted small">Sale al principio de la entrada, en el listado del blog y al compartirla en redes. Se comprime en tu navegador antes de subirla.</p>' +
      '<div class="bl-cover" data-bl-cover>' + (im ? '<img src="' + esc(siteBase() + '/media/blog/' + im.file) + '" alt="" width="160" height="90">' : '<span class="muted small">Sin imagen</span>') + '</div>' +
      '<p class="actions"><button class="btn sm" type="button" data-bl="pick-cover">' + (im ? 'Cambiar imagen' : 'Elegir o subir imagen') + '</button>' + (im ? ' <button class="btn sm ghost" type="button" data-bl="clear-cover">Quitar</button>' : '') + '</p>' +
      '<label' + (im ? '' : ' hidden') + ' data-bl-alt-wrap>Texto alternativo de la imagen (obligatorio: lo leen los lectores de pantalla y Google) ' + countHtml('image_alt', L.alt || 200) +
      '<input data-bl-f="image_alt" maxlength="' + (L.alt || 200) + '" value="' + esc(im ? im.alt : '') + '" placeholder="Describe lo que se ve, p. ej. «Transformador toroidal de 300 VA sobre fondo gris»"></label></section>';
  }
  /** Barra de herramientas del texto. */
  function toolbarHtml() {
    /** Un botón de la barra: acción, rótulo (HTML) y ayuda. */
    var b = function (a, t, title) { return '<button type="button" class="btn sm ghost" data-bl="tool" data-tool="' + a + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + t + '</button>'; };
    return '<div class="bl-tools" role="toolbar" aria-label="Formato del texto">' + b('h2', 'Título', 'Título de apartado (##)') + b('h3', 'Subtítulo', 'Subtítulo (###)') + b('bold', '<strong>N</strong>', 'Negrita (Ctrl+B)') + b('italic', '<em>C</em>', 'Cursiva (Ctrl+I)') +
      b('link', 'Enlace', 'Enlace') + b('ul', '• Lista', 'Lista con viñetas') + b('ol', '1. Lista', 'Lista numerada') + b('quote', 'Cita', 'Cita') + b('table', 'Tabla', 'Tabla') + b('hr', '―', 'Línea separadora') + b('image', 'Imagen', 'Insertar una imagen') + '</div>';
  }
  /** Cuadro del texto: barra, caja de texto y vista previa en vivo. */
  function textHtml() {
    var L = S.limits;
    return '<section class="panel"><h2>Texto</h2><p class="muted small">Escribe con formato sencillo: <span class="mono">## Título</span>, <span class="mono">**negrita**</span>, <span class="mono">*cursiva*</span>, <span class="mono">- lista</span>, <span class="mono">[texto](https://…)</span>, <span class="mono">&gt; cita</span> y tablas con <span class="mono">|</span>. No hace falta saber HTML (y no se admite: cualquier etiqueta se escribe tal cual).</p>' +
      toolbarHtml() + '<div class="bl-tabs" role="group" aria-label="Qué mostrar"><button type="button" class="btn sm ghost" data-bl="tab" data-v="write" aria-pressed="' + (S.tab === 'write') + '">Escribir</button><button type="button" class="btn sm ghost" data-bl="tab" data-v="preview" aria-pressed="' + (S.tab === 'preview') + '">Vista previa</button><button type="button" class="btn sm ghost" data-bl="tab" data-v="both" aria-pressed="' + (S.tab === 'both') + '">Las dos</button><span class="bl-count" data-bl-words></span></div>' +
      '<div class="bl-text bl-tab-' + S.tab + '" data-bl-textwrap><label class="bl-write"><span class="vh">Texto de la entrada</span><textarea data-bl-f="markdown" rows="22" spellcheck="true" maxlength="' + (L.markdown || 60000) + '">' + esc(S.cur.markdown) + '</textarea></label><div class="bl-prev"><div class="prose" data-bl-prev aria-live="polite"></div></div></div></section>';
  }
  /** Cuadro de SEO: título y descripción para buscadores, aspecto en Google y lista de comprobación. */
  function seoHtml() {
    var L = S.limits;
    return '<section class="panel"><h2>SEO: cómo sale en Google</h2><div class="serp" data-bl-serp aria-label="Vista previa en buscadores"></div>' +
      '<label>Título para buscadores (si lo dejas vacío, se usa el título) ' + countHtml('seo_title', L.seo_title || 120) + '<input data-bl-f="seo_title" maxlength="' + (L.seo_title || 120) + '" value="' + esc(S.cur.seo_title) + '"></label>' +
      '<label>Descripción para buscadores (si la dejas vacía, se usa el resumen o el principio del texto) ' + countHtml('seo_description', L.seo_description || 200) + '<textarea data-bl-f="seo_description" rows="3" maxlength="' + (L.seo_description || 200) + '">' + esc(S.cur.seo_description) + '</textarea></label>' +
      '<h3>Lista de comprobación</h3><ul class="bl-check" data-bl-check></ul></section>';
  }
  /** Cuadro de traducciones: un desplegable por idioma con las entradas de ese idioma que se pueden enlazar. */
  function translationsHtml() {
    var cur = S.cur, groups = {};
    S.posts.forEach(function (p) { groups[p.grp] = (groups[p.grp] || 0) + 1; });
    var mine = (cur.id && S.posts.filter(function (x) { return x.id === cur.id; })[0]) || null;
    return '<section class="panel" data-bl-trs><h2>Traducciones</h2><p class="muted small">Enlaza esta entrada con la misma entrada en otro idioma: Google recibe el aviso (hreflang) y el selector de idioma de la web lleva a la traducción. Cada traducción la escribes tú (o quien traduzca): la web no traduce nada sola.</p>' +
      LANGS.filter(function (l) { return l !== cur.lang; }).map(function (l) {
        var sel = cur.translations[l] || '';
        var opts = S.posts.filter(function (p) { return p.lang === l && p.id !== cur.id && (groups[p.grp] === 1 || (mine && p.grp === mine.grp) || p.id === sel); });
        return '<div class="bl-tr"><label>' + esc(LANG_NAME[l]) + '<select data-bl-tr="' + l + '"><option value="">— sin traducción —</option>' + opts.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.title) + (stateOf(p) === 'live' ? '' : ' (' + (stateOf(p) === 'draft' ? 'borrador' : 'programada') + ')') + '</option>'; }).join('') + '</select></label>' +
          (cur.id && !sel ? ' <a class="btn sm ghost" href="#blog/nueva?lang=' + l + '&amp;tr=' + esc(cur.id) + '">Crear la traducción en ' + esc(LANG_NAME[l].toLowerCase()) + '</a>' : '') + '</div>';
      }).join('') + '</section>';
  }
  /** Vista del editor completo. */
  function editorHtml() {
    var p = S.cur, L = S.limits, isNew = !p.id;
    return '<div data-bl-root data-bl-mode="edit"><p class="small"><a href="#blog">← Volver al listado</a></p><h1>' + (isNew ? 'Nueva entrada' : 'Editar entrada') + '</h1>' +
      '<div class="bl-bar" role="group" aria-label="Acciones"><span data-bl-state></span><span class="muted small" data-bl-dirty role="status"></span><span class="grow"></span><button class="btn" type="button" data-bl="save">Guardar</button><button class="btn ghost" type="button" data-bl="preview">Ver como saldrá</button>' +
      '<a class="btn ghost" data-bl-view target="_blank" rel="noopener" hidden>Ver en la web</a>' + (isNew ? '' : '<button class="btn ghost" type="button" data-bl="delete">Borrar</button>') + '</div>' +
      '<p class="notice" data-bl-msg hidden role="alert"></p>' +
      '<form class="form bl-form" data-bl-form novalidate><section class="panel"><h2>Datos básicos</h2><div class="grid2"><label>Idioma<select data-bl-f="lang"' + (isNew ? '' : ' disabled aria-describedby="bl-lang-note"') + '>' + LANGS.map(function (l) { return '<option value="' + l + '"' + (l === p.lang ? ' selected' : '') + '>' + esc(LANG_NAME[l]) + '</option>'; }).join('') + '</select></label>' +
      (isNew ? '' : '<p class="muted small" id="bl-lang-note">El idioma de una entrada no se cambia: crea otra en el otro idioma y enlázala como traducción.</p>') + '</div>' +
      '<label>Título (es el título principal de la página) ' + countHtml('title', L.title || 120) + '<input data-bl-f="title" maxlength="' + (L.title || 120) + '" value="' + esc(p.title) + '" required></label>' +
      '<label>Dirección en la web (slug) <input data-bl-f="slug" maxlength="' + (L.slug || 80) + '" value="' + esc(p.slug) + '" spellcheck="false" autocapitalize="off"></label><p class="muted small bl-url" data-bl-url></p>' +
      '<label>Resumen (aparece en el listado del blog; sin descripción SEO, también en Google) ' + countHtml('excerpt', L.excerpt || 300) + '<textarea data-bl-f="excerpt" rows="3" maxlength="' + (L.excerpt || 300) + '">' + esc(p.excerpt) + '</textarea></label></section>' +
      coverHtml() + textHtml() + seoHtml() +
      '<section class="panel"><h2>Publicación</h2><div class="grid2"><label>Estado<select data-bl-f="status"><option value="draft"' + (p.status === 'draft' ? ' selected' : '') + '>Borrador (no se ve en la web)</option><option value="published"' + (p.status === 'published' ? ' selected' : '') + '>Publicada</option></select></label>' +
      '<label>Fecha de publicación<input type="datetime-local" data-bl-f="date" value="' + esc(toLocalInput(p.date)) + '"></label></div><p class="muted small" data-bl-when></p><p><button class="btn sm ghost" type="button" data-bl="now">Poner la fecha de ahora</button></p></section>' +
      translationsHtml() + '</form></div>';
  }
  /** Mensaje de la barra superior (error o aviso); '' lo oculta. */
  function msg(text, kind) { var m = document.querySelector('[data-bl-msg]'); if (!m) return; m.hidden = !text; m.textContent = text || ''; m.className = 'notice' + (kind === 'ok' ? ' ok' : ''); }

  // ───────────────────────────────────────── [SEO] vista previa de Google y lista de comprobación
  /** Texto de la descripción que usará la web: la de SEO, el resumen o el principio del texto. */
  function effectiveDescription() {
    var c = S.cur;
    if (c.seo_description.trim()) return c.seo_description.trim();
    if (c.excerpt.trim()) return c.excerpt.trim();
    return TV.BlogMarkdown ? TV.BlogMarkdown.lead(c.markdown, 160) : '';
  }
  /** Lista [{ok, text}] de comprobaciones de SEO de la entrada actual (consejos, no bloquean el guardado). */
  function checks() {
    var c = S.cur, out = [], md = c.markdown, BM = TV.BlogMarkdown, html = BM ? BM.render(md, { tableLabel: 'Tabla' }) : '';
    var t = (c.seo_title.trim() || c.title.trim()), d = effectiveDescription();
    var words = BM ? BM.toPlain(md).split(/\s+/).filter(Boolean).length : md.split(/\s+/).filter(Boolean).length;
    out.push([t.length >= 25 && t.length <= 65, 'Título para buscadores de 25 a 65 caracteres (ahora ' + t.length + ').']);
    out.push([d.length >= 70 && d.length <= 160, 'Descripción de 70 a 160 caracteres (ahora ' + d.length + ').']);
    out.push([!!c.slug && c.slug.length <= 60, 'Dirección corta (hasta 60 caracteres) y con las palabras importantes' + (c.slug ? ' (ahora ' + c.slug.length + ').' : '.')]);
    out.push([words >= 300, 'Al menos 300 palabras (ahora ' + words + '): los textos muy cortos posicionan peor.']);
    out.push([/<h2>/.test(html), 'Tiene al menos un apartado con título (## Título).']);
    var lv = (html.match(/<h([2-4])>/g) || []).map(function (x) { return +x[2]; }), jump = lv.some(function (x, i) { return i > 0 && x > lv[i - 1] + 1; });
    out.push([!jump, 'Los títulos no se saltan niveles (de ## no se pasa a ####).']);
    out.push([!c.image || !!c.image.alt.trim(), 'La imagen destacada lleva texto alternativo.']);
    out.push([!/alt=""/.test(html), 'Todas las imágenes del texto llevan texto alternativo.']);
    out.push([/href="\//.test(html), 'Enlaza a alguna página de la propia web (producto, categoría, contacto…): ayuda a Google y a quien lee.']);
    return out;
  }
  /** Repinta la vista previa de Google y la lista de comprobación. */
  function updateSeo() {
    var c = S.cur, serp = document.querySelector('[data-bl-serp]'), list = document.querySelector('[data-bl-check]');
    if (serp) serp.innerHTML = '<div class="serp-title">' + esc(cut(c.seo_title.trim() || c.title.trim() || 'Título de la entrada', 62)) + '</div><div class="serp-url">' + esc(publicUrl(pathOf(c.lang, c.slug || 'direccion')).replace(/^https?:\/\//, '')) + '</div><div class="serp-desc">' + esc(cut(effectiveDescription() || 'Sin descripción: Google elegirá un trozo del texto.', 158)) + '</div>';
    if (list) list.innerHTML = checks().map(function (x) { return '<li class="' + (x[0] ? 'ok' : 'warn') + '"><span aria-hidden="true">' + (x[0] ? '✓' : '⚠') + '</span> <span class="vh">' + (x[0] ? 'Bien: ' : 'Mejorable: ') + '</span>' + esc(x[1]) + '</li>'; }).join('');
  }

  // ───────────────────────────────────────── [TEXTO] vista previa en vivo, barra de herramientas
  /** Pinta la vista previa del texto con el MISMO conversor que usa el servidor (TV.BlogMarkdown). */
  function updatePreview() {
    var el = document.querySelector('[data-bl-prev]'); if (!el) return;
    if (!TV.BlogMarkdown) { el.innerHTML = '<p class="notice">La vista previa necesita un navegador más reciente (Chrome, Edge, Firefox o Safari 16.4 o superior). Puedes escribir y guardar igualmente; «Ver como saldrá» enseña la página real.</p>'; return; }
    var base = siteBase();
    var html = TV.BlogMarkdown.render(S.cur.markdown, { tableLabel: 'Tabla' });
    el.innerHTML = base ? html.replace(/(href|src)="\//g, '$1="' + base + '/') : html;
    var w = document.querySelector('[data-bl-words]');
    if (w) w.textContent = TV.BlogMarkdown.toPlain(S.cur.markdown).split(/\s+/).filter(Boolean).length + ' palabras';
  }
  /** Pone al día los contadores de caracteres de los campos con límite (en rojo si se pasan). */
  function updateCounts() {
    [].forEach.call(document.querySelectorAll('[data-bl-count]'), function (el) {
      var name = el.getAttribute('data-bl-count'), max = +el.getAttribute('data-max'), v = name === 'image_alt' ? (S.cur.image ? S.cur.image.alt : '') : S.cur[name] || '';
      var n = Array.from(v).length; el.textContent = n + '/' + max; el.classList.toggle('full', n >= max);
    });
  }
  /** Dirección completa que tendrá la entrada, con aviso si cambia la de una ya publicada. */
  function updateUrl() {
    var c = S.cur, el = document.querySelector('[data-bl-url]'); if (!el) return;
    var orig = c.id ? S.posts.filter(function (x) { return x.id === c.id; })[0] : null;
    el.textContent = 'Será: ' + publicUrl(pathOf(c.lang, c.slug || '…')) + (orig && orig.slug !== c.slug && orig.status === 'published' ? '  ·  la dirección anterior seguirá funcionando y redirigirá a la nueva.' : '');
  }
  /** Texto de la sección «Publicación» según estado y fecha, y la etiqueta de estado de la barra. */
  function updateWhen() {
    var c = S.cur, el = document.querySelector('[data-bl-when]'), st = document.querySelector('[data-bl-state]'), v = document.querySelector('[data-bl-view]');
    var s = stateOf(c);
    if (el) el.textContent = c.status === 'draft' ? 'Es un borrador: no se ve en la web, ni en el listado, ni en el mapa del sitio. Usa «Ver como saldrá» para revisarlo.' : s === 'scheduled' ? 'Se publicará solo el ' + shortDate(c.date) + ' (queda programada).' : c.date ? 'Visible desde el ' + shortDate(c.date) + '.' : 'Al guardar se publica con la fecha de ahora.';
    if (st) st.innerHTML = stateTag(c.status === 'published' && !c.date ? { status: 'published', date: new Date(nowMs()).toISOString() } : c);
    if (v) { v.hidden = !(c.id && s === 'live'); if (c.id) v.href = publicUrl(pathOf(c.lang, c.slug)); }
  }
  /** Marca el estado «con cambios sin guardar». */
  function setDirty(d) { S.dirty = d; var el = document.querySelector('[data-bl-dirty]'); if (el) el.textContent = d ? '● Cambios sin guardar' : ''; }
  /** Pone al día todo lo que depende de los campos. */
  function refresh() { updateCounts(); updateUrl(); updateWhen(); updateSeo(); }
  /** Inserta `text` en la caja de texto sustituyendo la selección; deja el cursor al final de lo insertado. */
  function insertText(ta, text) { var a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + text + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + text.length; ta.focus(); fieldChanged(ta); }
  /** Rodea la selección con `pre` y `post` (o pone `ph` si no hay selección). */
  function wrap(ta, pre, post, ph) { var a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b) || ph; ta.value = ta.value.slice(0, a) + pre + sel + post + ta.value.slice(b); ta.selectionStart = a + pre.length; ta.selectionEnd = a + pre.length + sel.length; ta.focus(); fieldChanged(ta); }
  /** Antepone `prefix` a cada línea de la selección (o a la línea del cursor); con `numbered` las numera. */
  function prefixLines(ta, prefix, numbered) {
    var v = ta.value, a = v.lastIndexOf('\n', ta.selectionStart - 1) + 1, e = v.indexOf('\n', ta.selectionEnd); if (e < 0) e = v.length;
    var lines = v.slice(a, e).split('\n').map(function (l, i) { return (numbered ? (i + 1) + '. ' : prefix) + l; });
    ta.value = v.slice(0, a) + lines.join('\n') + v.slice(e); ta.selectionStart = a; ta.selectionEnd = a + lines.join('\n').length; ta.focus(); fieldChanged(ta);
  }
  /** Ejecuta una herramienta de la barra sobre la caja de texto. */
  function tool(name) {
    var ta = document.querySelector('[data-bl-f=markdown]'); if (!ta) return;
    if (name === 'h2') prefixLines(ta, '## ');
    else if (name === 'h3') prefixLines(ta, '### ');
    else if (name === 'bold') wrap(ta, '**', '**', 'texto en negrita');
    else if (name === 'italic') wrap(ta, '*', '*', 'texto en cursiva');
    else if (name === 'ul') prefixLines(ta, '- ');
    else if (name === 'ol') prefixLines(ta, '', true);
    else if (name === 'quote') prefixLines(ta, '> ');
    else if (name === 'hr') insertText(ta, '\n\n---\n\n');
    else if (name === 'table') insertText(ta, '\n\n| Columna 1 | Columna 2 |\n|---|---|\n| Dato | Dato |\n\n');
    else if (name === 'link') { var u = prompt('Dirección del enlace (https://…, /ruta-de-la-web/, mailto:… o tel:…):', 'https://'); if (u) wrap(ta, '[', '](' + u.trim() + ')', 'texto del enlace'); }
    else if (name === 'image') openPicker('text');
  }

  // ───────────────────────────────────────── [IMAGENES] subir (comprimiendo en el navegador) y elegir
  /** ¿Sabe este navegador guardar imágenes WebP desde un canvas? (si no, se usa JPEG). */
  function canWebp() { try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } }
  /** Archivo de imagen → Promise<{ data: base64, mime, w, h, bytes }> redimensionado a 1600 px como mucho y recodificado (WebP o JPEG) hasta que pese menos que el límite del servidor. */
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image(), max = (S.limits.image_bytes || 2500000) * 0.9;
      /** Con la imagen abierta: la redimensiona y recodifica hasta que cabe en el límite. */
      img.onload = function () {
        URL.revokeObjectURL(url);
        var side = 1600, tries = [[1, 0.84], [1, 0.72], [0.8, 0.7], [0.62, 0.66], [0.45, 0.6]], i = 0;
        /** Intenta una combinación de tamaño y calidad; si no cabe en el límite, la siguiente. */
        function attempt() {
          var k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)) * tries[i][0];
          var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
          c.toBlob(function (blob) {
            if (!blob) return reject(new Error('No se pudo preparar la imagen'));
            if (blob.size > max && i < tries.length - 1) { i++; return attempt(); }
            if (blob.size > max) return reject(new Error('La imagen sigue pesando demasiado aun comprimida'));
            var r = new FileReader();
            /** Con el archivo leído: entrega los datos en base64. */
            r.onload = function () { resolve({ data: String(r.result).replace(/^data:[^,]*,/, ''), mime: blob.type, w: w, h: h, bytes: blob.size }); };
            /** Si no se puede leer el archivo recodificado. */
            r.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
            r.readAsDataURL(blob);
          }, canWebp() ? 'image/webp' : 'image/jpeg', tries[i][1]);
        }
        attempt();
      };
      /** Si el navegador no puede abrir el archivo como imagen. */
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Ese archivo no es una imagen que el navegador pueda abrir (usa JPG, PNG o WebP)')); };
      img.src = url;
    });
  }
  /** Sube un archivo de imagen (comprimido) y devuelve Promise<imagen del servidor | null si falló, con el aviso ya mostrado>. */
  function upload(file) {
    msg('Preparando y subiendo la imagen…', 'ok');
    return compress(file).then(function (c) {
      var name = (S.cur.title || file.name || 'imagen').replace(/\.[a-z0-9]{2,5}$/i, '');
      return ctx.http('POST', '/api/blog/images', { name: name, data: c.data }).then(function (r) {
        if (!r.ok) { msg('⚠ ' + (r.error || 'No se pudo subir la imagen')); return null; }
        S.images = [r.image].concat(S.images.filter(function (x) { return x.file !== r.image.file; }));
        msg('');
        ctx.toast('Imagen subida (' + Math.round(c.bytes / 1024) + ' KB)');
        return r.image;
      });
    }).catch(function (e) { msg('⚠ ' + e.message); return null; });
  }
  /** Contenido del cuadro de imágenes: subir una nueva y rejilla de las ya subidas. */
  function pickerHtml() {
    return '<form method="dialog" class="bl-picker"><h2>Imágenes</h2><p class="muted small">Sube una imagen nueva (JPG, PNG o WebP) o elige una de las ya subidas.</p><p><label class="btn sm">Subir una imagen<input type="file" accept="image/*" hidden data-bl-file></label></p>' +
      '<div class="bl-grid" role="list">' + (S.images.length ? S.images.map(function (im) { return '<button type="button" class="bl-thumb" role="listitem" data-bl="choose" data-file="' + esc(im.file) + '"><img src="' + esc(siteBase() + '/media/blog/' + im.file) + '" alt="" loading="lazy" width="120" height="80"><span class="small">' + esc(im.w + '×' + im.h) + '</span></button>'; }).join('') : '<p class="muted">Todavía no hay imágenes subidas.</p>') + '</div>' +
      '<div data-bl-picked hidden><h3>Imagen elegida</h3><label>Texto alternativo (obligatorio)<input data-bl-pickalt maxlength="' + (S.limits.alt || 200) + '" placeholder="Describe lo que se ve"></label><label data-bl-capwrap hidden>Pie de foto (opcional)<input data-bl-pickcap maxlength="200"></label><p><button class="btn" type="button" data-bl="use">Usar esta imagen</button></p></div>' +
      '<p><button class="btn ghost" value="cancel">Cerrar</button></p></form>';
  }
  /** Abre el cuadro de imágenes para `target` («cover» = imagen destacada, «text» = insertar en el texto). */
  function openPicker(target) {
    S.picking = { target: target, file: '' };
    var dlg = document.querySelector('[data-bl-dialog]');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.setAttribute('data-bl-dialog', ''); dlg.className = 'bl-dialog'; dlg.setAttribute('aria-label', 'Imágenes'); document.body.appendChild(dlg); }
    dlg.innerHTML = pickerHtml();
    var cap = dlg.querySelector('[data-bl-capwrap]'); if (cap) cap.hidden = target !== 'text';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  /** Cierra el cuadro de imágenes. */
  function closePicker() { var dlg = document.querySelector('[data-bl-dialog]'); if (dlg) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } S.picking = null; }
  /** Marca una imagen del cuadro como elegida y pide su texto alternativo. */
  function chooseImage(file) {
    var dlg = document.querySelector('[data-bl-dialog]'); if (!dlg || !S.picking) return;
    S.picking.file = file;
    [].forEach.call(dlg.querySelectorAll('.bl-thumb'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-file') === file)); });
    var box = dlg.querySelector('[data-bl-picked]'); box.hidden = false;
    var alt = dlg.querySelector('[data-bl-pickalt]'); if (S.picking.target === 'cover' && S.cur.image && S.cur.image.file === file) alt.value = S.cur.image.alt; alt.focus();
  }
  /** Usa la imagen elegida: como destacada o insertada en el texto. */
  function useImage() {
    var dlg = document.querySelector('[data-bl-dialog]'); if (!dlg || !S.picking || !S.picking.file) return;
    var alt = dlg.querySelector('[data-bl-pickalt]').value.trim(), cap = dlg.querySelector('[data-bl-pickcap]').value.trim();
    if (!alt) { alt = ''; dlg.querySelector('[data-bl-pickalt]').setAttribute('aria-invalid', 'true'); dlg.querySelector('[data-bl-pickalt]').focus(); return; }
    var im = S.images.filter(function (x) { return x.file === S.picking.file; })[0] || {};
    if (S.picking.target === 'cover') { S.cur.image = { file: S.picking.file, alt: alt, w: im.w, h: im.h }; var cov = document.querySelector('[data-bl-cover]').closest('section'); var tmp = document.createElement('div'); tmp.innerHTML = coverHtml(); cov.parentNode.replaceChild(tmp.firstChild, cov); }
    else { var ta = document.querySelector('[data-bl-f=markdown]'); insertText(ta, '\n\n![' + alt.replace(/[\[\]\n]/g, ' ') + '](/media/blog/' + S.picking.file + (cap ? ' "' + cap.replace(/["\n]/g, ' ') + '"' : '') + ')\n\n'); }
    setDirty(true); closePicker(); refresh(); updatePreview();
  }

  // ───────────────────────────────────────── [GUARDAR] guardar, ver como saldrá, borrar
  /** Cuerpo que se envía al servidor con lo que hay en el formulario. */
  function payload() {
    var c = S.cur, b = { title: c.title, slug: c.slug, excerpt: c.excerpt, seo_title: c.seo_title, seo_description: c.seo_description, markdown: c.markdown, image: c.image ? { file: c.image.file, alt: c.image.alt } : null, status: c.status, date: c.date, translations: {} };
    LANGS.forEach(function (l) { if (l !== c.lang) b.translations[l] = c.translations[l] || ''; });
    if (!c.id) { b.lang = c.lang; Object.keys(b.translations).forEach(function (l) { if (!b.translations[l]) delete b.translations[l]; }); }
    return b;
  }
  /** Marca el campo con error que dijo el servidor y enseña el mensaje. */
  function showError(r) {
    msg('⚠ ' + ((r && r.error) || 'No se pudo guardar'));
    var map = { title: 'title', slug: 'slug', excerpt: 'excerpt', seo_title: 'seo_title', seo_description: 'seo_description', markdown: 'markdown', image_alt: 'image_alt', image: 'image_alt', status: 'status', date: 'date', lang: 'lang' };
    var el = r && r.field && document.querySelector('[data-bl-f=' + (map[r.field] || r.field) + ']');
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
  /** Guarda la entrada (crea o actualiza). Devuelve Promise<boolean>. */
  function save() {
    var c = S.cur;
    msg('Guardando…', 'ok');
    [].forEach.call(document.querySelectorAll('[aria-invalid]'), function (e) { e.removeAttribute('aria-invalid'); });
    return ctx.http('POST', c.id ? '/api/blog/posts/' + encodeURIComponent(c.id) : '/api/blog/posts', payload()).then(function (r) {
      if (!r.ok) { showError(r); return false; }
      var wasNew = !c.id;
      S.cur = r.post; S.cur.translations = r.post.translations || {};
      setDirty(false); msg(''); ctx.toast(wasNew ? 'Entrada creada' : 'Guardado');
      if (wasNew) { location.hash = '#blog/' + r.post.id; return true; }
      var ix = S.posts.map(function (p) { return p.id; }).indexOf(r.post.id);
      if (ix >= 0) S.posts[ix] = Object.assign({}, S.posts[ix], { title: r.post.title, slug: r.post.slug, status: r.post.status, date: r.post.date, path: r.post.path, image: r.post.image });
      refresh();
      return true;
    });
  }
  /** «Ver como saldrá»: guarda y abre la página real con una dirección firmada de una hora (sirve también para borradores y programadas). */
  function preview() {
    var w = window.open('', '_blank');
    save().then(function (ok) {
      if (!ok || !S.cur.id) { if (w) w.close(); return; }
      ctx.http('POST', '/api/blog/posts/' + encodeURIComponent(S.cur.id) + '/preview').then(function (r) {
        if (!r.ok) { if (w) w.close(); return msg('⚠ ' + (r.error || 'No se pudo preparar la vista previa')); }
        var url = location.origin + siteBase() + r.path + '?' + r.query;
        if (w) w.location = url; else msg('Tu navegador ha bloqueado la ventana nueva. Abre la vista previa desde aquí: ' + url);
      });
    });
  }
  /** Borra la entrada indicada tras confirmar. */
  function remove(id, title, after) {
    if (!confirm('¿Borrar la entrada «' + title + '»? Deja de verse en la web y no se puede deshacer.')) return;
    ctx.http('DELETE', '/api/blog/posts/' + encodeURIComponent(id)).then(function (r) { if (!r.ok) return msg('⚠ ' + (r.error || 'No se pudo borrar')); setDirty(false); ctx.toast('Entrada borrada'); after(); });
  }

  // ───────────────────────────────────────── [EVENTOS]
  /** Lee un campo del formulario y lo pasa a la entrada que se edita. */
  function fieldChanged(el) {
    var name = el.getAttribute('data-bl-f'), c = S.cur; if (!name) return;
    if (el.hasAttribute('aria-invalid')) el.removeAttribute('aria-invalid');
    if (name === 'image_alt') { if (c.image) c.image.alt = el.value; }
    else if (name === 'date') c.date = fromLocalInput(el.value);
    else if (name === 'slug') { c.slug = el.value; S.slugAuto = false; }
    else if (name === 'title') { c.title = el.value; if (S.slugAuto) { c.slug = slugify(c.title); var sl = document.querySelector('[data-bl-f=slug]'); if (sl) sl.value = c.slug; } }
    else if (name === 'lang') { c.lang = el.value; c.translations = {}; var ts = document.querySelector('[data-bl-trs]'); if (ts) { var tmp = document.createElement('div'); tmp.innerHTML = translationsHtml(); ts.parentNode.replaceChild(tmp.firstChild, ts); } }
    else c[name] = el.value;
    setDirty(true);
    if (name === 'markdown') updatePreview();
    refresh();
  }
  /** Engancha los clics, cambios y teclas del listado y del editor (delegación de eventos sobre `root`, una sola vez). */
  B.bind = function (root, c) {
    ctx = c;
    if (!root.__blBound) {
      root.__blBound = true;
      root.addEventListener('input', function (e) { var t = e.target; if (t.hasAttribute && t.hasAttribute('data-bl-f')) fieldChanged(t); else if (t.getAttribute && t.getAttribute('data-bl-filter') === 'q') { S.filter.q = t.value; var rb = root.querySelector('[data-bl-rows]'); if (rb) rb.innerHTML = rowsHtml(); } });
      root.addEventListener('change', function (e) {
        var t = e.target;
        if (t.hasAttribute('data-bl-f')) return fieldChanged(t);
        if (t.hasAttribute('data-bl-filter')) { S.filter[t.getAttribute('data-bl-filter')] = t.value; var rb = root.querySelector('[data-bl-rows]'); if (rb) rb.innerHTML = rowsHtml(); return; }
        if (t.hasAttribute('data-bl-tr')) { S.cur.translations[t.getAttribute('data-bl-tr')] = t.value; setDirty(true); }
      });
      root.addEventListener('keydown', function (e) {
        var ta = e.target; if (!ta.matches || !ta.matches('[data-bl-f=markdown]')) return;
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) { if (e.key === 'b' || e.key === 'B') { e.preventDefault(); tool('bold'); } else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); tool('italic'); } else if (e.key === 's' || e.key === 'S') { e.preventDefault(); save(); } }
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-bl]'); if (!b) return;
        var a = b.getAttribute('data-bl');
        if (a === 'save') save();
        else if (a === 'preview') preview();
        else if (a === 'delete') remove(S.cur.id, S.cur.title, function () { location.hash = '#blog'; });
        else if (a === 'del-row') { var p = S.posts.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0]; if (p) remove(p.id, p.title, function () { S.posts = S.posts.filter(function (x) { return x.id !== p.id; }); root.querySelector('[data-bl-rows]').innerHTML = rowsHtml(); }); }
        else if (a === 'tool') tool(b.getAttribute('data-tool'));
        else if (a === 'now') { S.cur.date = fromLocalInput(toLocalInput(new Date(nowMs()).toISOString())); var d = root.querySelector('[data-bl-f=date]'); if (d) d.value = toLocalInput(S.cur.date); setDirty(true); refresh(); }
        else if (a === 'tab') { S.tab = b.getAttribute('data-v'); var tw = root.querySelector('[data-bl-textwrap]'); if (tw) tw.className = 'bl-text bl-tab-' + S.tab; [].forEach.call(root.querySelectorAll('[data-bl=tab]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }
        else if (a === 'pick-cover') openPicker('cover');
        else if (a === 'clear-cover') { S.cur.image = null; var cs = root.querySelector('[data-bl-cover]').closest('section'), tmp = document.createElement('div'); tmp.innerHTML = coverHtml(); cs.parentNode.replaceChild(tmp.firstChild, cs); setDirty(true); refresh(); }
      });
    }
    // el cuadro de imágenes vive fuera de root (es un <dialog>): sus clics y su selector de archivo se enganchan una vez en el documento
    if (!document.__blDlgBound) {
      document.__blDlgBound = true;
      document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-bl-dialog] [data-bl]'); if (!b) return; var a = b.getAttribute('data-bl'); if (a === 'choose') chooseImage(b.getAttribute('data-file')); else if (a === 'use') useImage(); });
      document.addEventListener('change', function (e) {
        var f = e.target; if (!f.hasAttribute || !f.hasAttribute('data-bl-file') || !f.files[0]) return;
        upload(f.files[0]).then(function (im) { if (!im) return; var dlg = document.querySelector('[data-bl-dialog]'); if (!dlg) return; var tg = S.picking && S.picking.target; dlg.innerHTML = pickerHtml(); var cap = dlg.querySelector('[data-bl-capwrap]'); if (cap) cap.hidden = tg !== 'text'; chooseImage(im.file); });
      });
      window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
      // salir del editor con cambios sin guardar pide confirmación (menú lateral, enlaces del panel)
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || !S.dirty || a.getAttribute('href') === location.hash) return;
        if (confirm('Hay cambios sin guardar en la entrada. ¿Salir sin guardarlos?')) S.dirty = false; else { e.preventDefault(); e.stopPropagation(); }
      }, true);
      window.addEventListener('hashchange', function () { if (!/^#blog\//.test(location.hash)) S.dirty = false; });
    }
    if (root.querySelector('[data-bl-mode=edit]')) { updatePreview(); refresh(); setDirty(S.dirty); }
  };
  /** Vista del blog: listado o editor según `arg` (ver la cabecera). */
  B.view = function (c, arg) {
    ctx = c;
    var a = parseArg(arg || '');
    if (a.id !== '' && a.id !== 'nueva' && !/^bp-[0-9a-f]{12}$/.test(a.id)) a.id = '';
    return load(a).then(function (err) {
      if (err) return unavailable(err);
      return a.id === '' ? listHtml() : editorHtml();
    });
  };
  /** ¿Hay cambios sin guardar en el editor? */
  B.dirty = function () { return S.dirty; };
})();
