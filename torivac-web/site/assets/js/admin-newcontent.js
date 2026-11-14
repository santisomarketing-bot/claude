/**
 * [ADMIN-NEWCONTENT] Vista «Contenido nuevo» del panel real (admin-live.js): las páginas nuevas del plan 2027 en borrador, para que el Revisor (la persona que es a la vez comercial y traductora) y el
 * manager las vean, PROPONGAN cambios y las APRUEBEN, con el registro de lo que se hizo. Nada de esto publica por sí solo: la web es estática; lo aprobado se descarga (manager) y se anota en los
 * archivos data/content-new/*.json con `node scripts/apply_newcontent.mjs`, y la siguiente compilación publica solo lo aprobado.
 *   · Manager: ve, propone y descarga.   · Revisor: además acepta o descarta las propuestas y aprueba o retira la aprobación (castellano primero, con la función «comercial»; EN, FR y DE después, como «traductor»).
 *   · Todo es TEXTO PLANO (el servidor lo vuelve a comprobar con las mismas reglas que el generador) y todo lo que se pinta se escapa. El servidor decide quién puede qué; aquí solo se muestran los botones que valen.
 *   · Secciones en el cuadro de edición: «## Encabezado» y debajo los párrafos separados por una línea en blanco. Botones: «Texto | /enlace/», uno por línea.
 *
 *   TV.AdminNewContent.view(ctx, arg) → Promise<string> con el HTML (arg: '' lista · 'registro' registro de cambios · '<id>/<idioma>' una versión)     TV.AdminNewContent.bind(root, ctx) → engancha los botones
 *   ctx = { http(method, path, body), toast(msg), when(iso), session(), render() }
 * Contrato y flujo: docs/CONTENIDO-NUEVO.md. Secciones: [UTIL] [TEXTO] [LISTA] [VERSION] [REGISTRO] [ACCIONES]
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var N = (TV.AdminNewContent = {});
  var ctx = null, bound = null, data = null;
  var LANGS = ['es', 'en', 'fr', 'de'], LANG_NAME = { es: 'Castellano', en: 'Inglés', fr: 'Francés', de: 'Alemán' }, FIELD_NAME = { title: 'Título (SEO)', meta_description: 'Descripción (SEO)', h1: 'Título principal (H1)', lead: 'Entradilla', sections: 'Secciones', cta: 'Botones' };

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Aviso del formulario o de la vista. */
  function say(text, ok) { if (ok) ctx.toast(text); else ctx.toast('⚠ ' + text); }
  /** Aviso de que la sección no está disponible (el Worker de Cloudflare no la trae). */
  function unavailable(r) {
    return '<h1>Contenido nuevo</h1><p class="notice">' + esc(r && r.status === 501 ? 'El contenido nuevo del panel necesita el servidor PHP del hosting (esta instalación usa Cloudflare Workers, que no lo incluye).' : (r && r.error) || 'No se pudo cargar.') + '</p>';
  }
  /** Página del listado por id. */
  function pageOf(id) { return ((data && data.pages) || []).filter(function (p) { return p.id === id; })[0] || null; }
  /** Nombre en castellano de una acción del registro. */
  function actionName(a) { return (data && data.actions && data.actions[a]) || a; }
  /** Marca del estado de una versión: aprobada (quién, función y fecha) o borrador. */
  function statusTag(v) {
    if (v.status === 'aprobado' && v.approval) return '<span class="tag">Aprobado</span> <span class="small">' + esc(v.approval.by) + ' · ' + esc(v.approval.role) + ' · ' + esc(v.approval.at) + '</span>';
    return '<span class="tag dim">Borrador</span>' + (v.approval_outdated ? ' <span class="small muted">(la aprobación anterior no vale: el texto cambió)</span>' : '');
  }
  /** Propuestas pendientes de una versión. */
  function pending(v) { return (v.proposals || []).filter(function (p) { return p.status === 'pendiente'; }); }

  // ───────────────────────────────────────── [TEXTO] pasar el texto de una versión a los cuadros de edición y volver
  /** Secciones → texto de edición: «## Encabezado» y los párrafos separados por una línea en blanco. */
  function sectionsToText(sections) { return (sections || []).map(function (s) { return '## ' + s.h2 + '\n\n' + (s.p || []).join('\n\n'); }).join('\n\n'); }
  /** Texto de edición → {sections} o {error}. Cada sección empieza por «## Encabezado»; las líneas seguidas forman un párrafo y una línea en blanco separa párrafos. */
  function textToSections(txt) {
    var out = [], cur = null, para = [];
    /** Cierra el párrafo en curso. */
    function flush() { if (para.length && cur) cur.p.push(para.join(' ')); para = []; }
    var lines = String(txt || '').replace(/\r\n?/g, '\n').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (/^##\s+/.test(l)) { flush(); cur = { h2: l.replace(/^##\s+/, '').trim(), p: [] }; out.push(cur); }
      else if (l === '') flush();
      else { if (!cur) return { error: 'El texto de las secciones debe empezar por «## Encabezado» en la primera línea.' }; para.push(l); }
    }
    flush();
    for (var j = 0; j < out.length; j++) if (!out[j].h2 || !out[j].p.length) return { error: 'Cada sección necesita un encabezado y al menos un párrafo (la sección ' + (j + 1) + ' no los tiene).' };
    return out.length ? { sections: out } : { error: 'Escribe al menos una sección.' };
  }
  /** Botones → texto de edición: «Texto | /enlace/», uno por línea. */
  function ctaToText(cta) { return (cta || []).map(function (c) { return c.label + ' | ' + c.href; }).join('\n'); }
  /** Texto de edición → {cta} o {error}. */
  function textToCta(txt) {
    var out = [], lines = String(txt || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim(); if (!l) continue;
      var k = l.lastIndexOf('|'); if (k < 1) return { error: 'Cada botón se escribe «Texto | /enlace/» (en la línea ' + (i + 1) + ' falta la barra).' };
      out.push({ label: l.slice(0, k).trim(), href: l.slice(k + 1).trim() });
    }
    return { cta: out };
  }
  /** Representación en texto de un campo (para compararlo y mostrar el antes y el después). */
  function fieldText(k, v) { return k === 'sections' ? sectionsToText(v) : k === 'cta' ? ctaToText(v) : String(v == null ? '' : v); }

  // ───────────────────────────────────────── [LISTA]
  /** Fila de una versión (idioma) en la lista de una página. */
  function langRow(p, l) {
    var v = p.langs[l], np = pending(v).length;
    return '<tr><td>' + esc(LANG_NAME[l]) + ' <span class="mono muted small">' + esc((p.slug || {})[l] || '') + '</span></td><td>' + statusTag(v) + '</td><td class="small">' + (np ? '<strong>' + np + '</strong> pendiente' + (np > 1 ? 's' : '') : '—') + (v.stale_edit ? '<br><span class="tag warn">edición antigua ignorada</span>' : '') + '</td>' +
      '<td class="bl-actions"><a class="btn sm ghost" href="#nuevo/' + encodeURIComponent(p.id) + '/' + l + '">Ver y revisar<span class="vh"> ' + esc(p.id) + ' en ' + esc(LANG_NAME[l]) + '</span></a></td></tr>';
  }
  /** Vista de la lista: una tarjeta por página, con su estado por idioma y las notas pendientes. */
  function listView() {
    var me = data.me || {}, pages = data.pages || [];
    var head = '<h1>Contenido nuevo</h1><p class="muted">Páginas nuevas del plan 2027 redactadas por nosotros: <strong>no se publica nada hasta que el Revisor lo aprueba</strong>. El castellano se aprueba primero (como «comercial»; confirma lo que se afirma y las condiciones) y después las traducciones (como «traductor»). Aprobar no publica por sí solo: lo aprobado se anota en los archivos y entra en la siguiente actualización de la web.</p>' +
      '<p>' + (me.can_export ? '<button class="btn" type="button" data-nc-export>Descargar para anotar en los archivos</button> ' : '') + '<a class="btn ghost" href="#nuevo/registro">Registro de cambios</a></p>';
    if (!pages.length) return '<div data-nc-root>' + head + '<p class="notice">No hay páginas nuevas en esta versión de la web.</p></div>';
    return '<div data-nc-root>' + head + pages.map(function (p) {
      var notes = (p.notes || []).length ? '<details><summary class="small">Notas del equipo (' + p.notes.length + ')</summary><ul class="small">' + p.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></details>' : '';
      return '<section class="panel"><h2>' + esc(p.id) + '</h2><div class="tbl-wrap"><table class="spec"><thead><tr><th>Idioma</th><th>Estado</th><th>Propuestas</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + LANGS.filter(function (l) { return p.langs[l]; }).map(function (l) { return langRow(p, l); }).join('') + '</tbody></table></div>' + notes + '</section>';
    }).join('') + '</div>';
  }

  // ───────────────────────────────────────── [VERSION] una versión: texto, propuestas, formulario y aprobación
  /** Vista previa del texto vigente. */
  function preview(t) {
    return '<article class="nc-prev"><h3>' + esc(t.h1) + '</h3>' + (t.lead ? '<p><em>' + esc(t.lead) + '</em></p>' : '') + (t.sections || []).map(function (s) { return '<h4>' + esc(s.h2) + '</h4>' + (s.p || []).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join(''); }).join('') +
      ((t.cta || []).length ? '<p>' + t.cta.map(function (c) { return '<span class="tag">' + esc(c.label) + '</span> <span class="mono small muted">' + esc(c.href) + '</span>'; }).join(' · ') + '</p>' : '') + '</article>' +
      '<p class="small muted">Título SEO: «' + esc(t.title) + '» (' + esc(t.title.length) + '/' + Number(data.limits.title) + ') · Descripción: «' + esc(t.meta_description) + '» (' + esc(t.meta_description.length) + ' caracteres, entre ' + Number(data.limits.meta_min) + ' y ' + Number(data.limits.meta_max) + ')</p>';
  }
  /** Una propuesta pendiente (o decidida): quién, cuándo, la nota, el antes y el después de cada campo y, si es el Revisor, los botones. */
  function proposalBox(p, cur, canDecide) {
    var fields = Object.keys(p.fields || {}).map(function (k) {
      return '<div class="nc-diff"><strong>' + esc(FIELD_NAME[k] || k) + '</strong><div class="nc-before"><span class="small muted">Ahora</span><pre>' + esc(fieldText(k, cur[k])) + '</pre></div><div class="nc-after"><span class="small muted">Propuesta</span><pre>' + esc(fieldText(k, p.fields[k])) + '</pre></div></div>';
    }).join('');
    var pr = (p.problems || []).length ? '<p class="notice"><strong>Con este cambio el texto no cumpliría las reglas:</strong> ' + p.problems.map(esc).join(' · ') + '</p>' : '';
    var st = p.status === 'pendiente' ? '' : ' · <span class="tag dim">' + (p.status === 'aceptada' ? 'Aceptada' : 'Descartada') + '</span> ' + esc(p.decided_by || '') + ' · ' + esc(ctx.when(p.decided_at)) + (p.decided_note ? ' · «' + esc(p.decided_note) + '»' : '');
    var btns = p.status === 'pendiente' && canDecide ? '<p><label class="small">Nota (opcional)<input type="text" maxlength="' + Number(data.limits.note) + '" data-nc-dnote="' + esc(p.id) + '"></label></p><p><button class="btn sm" type="button" data-nc-decide="accept" data-nc-pid="' + esc(p.id) + '"' + ((p.problems || []).length ? ' disabled' : '') + '>Aceptar (cambia el texto y retira la aprobación)</button> <button class="btn sm ghost" type="button" data-nc-decide="reject" data-nc-pid="' + esc(p.id) + '">Descartar</button></p>' : '';
    return '<div class="panel nc-prop"><p class="small"><strong>' + esc(p.name || p.by) + '</strong> <span class="muted">' + esc(p.by) + '</span> · ' + esc(ctx.when(p.at)) + st + '</p>' + (p.note ? '<p>«' + esc(p.note) + '»</p>' : '') + fields + pr + btns + '</div>';
  }
  /** Formulario «Proponer un cambio» con el texto vigente puesto: solo se envía lo que la persona cambia. */
  function proposeForm(t) {
    var L = data.limits;
    return '<section class="panel"><h2>Proponer un cambio</h2><p class="muted small">Cambia lo que quieras; solo se envía lo que cambies. Es texto plano (sin etiquetas ni código). La propuesta no cambia nada hasta que el Revisor la acepte.</p>' +
      '<form class="form qr-f" data-nc-propose novalidate>' +
      '<label>Título SEO <span class="muted small" data-nc-count="title"></span><input name="title" type="text" maxlength="' + Number(L.title) + '" value="' + esc(t.title) + '"></label>' +
      '<label>Descripción SEO (entre ' + Number(L.meta_min) + ' y ' + Number(L.meta_max) + ') <span class="muted small" data-nc-count="meta_description"></span><textarea name="meta_description" rows="3" maxlength="' + Number(L.meta_max) + '">' + esc(t.meta_description) + '</textarea></label>' +
      '<label>Título principal (H1)<input name="h1" type="text" maxlength="' + Number(L.h1) + '" value="' + esc(t.h1) + '"></label>' +
      '<label>Entradilla<textarea name="lead" rows="2" maxlength="' + Number(L.lead) + '">' + esc(t.lead) + '</textarea></label>' +
      '<label>Secciones <span class="muted small">(«## Encabezado» y debajo los párrafos, separados por una línea en blanco)</span><textarea name="sections" rows="14">' + esc(sectionsToText(t.sections)) + '</textarea></label>' +
      '<label>Botones <span class="muted small">(«Texto | /enlace/», uno por línea; máximo ' + Number(L.cta) + ')</span><textarea name="cta" rows="3">' + esc(ctaToText(t.cta)) + '</textarea></label>' +
      '<label>Por qué lo propones (nota para quien decide)<input name="note" type="text" maxlength="' + Number(L.note) + '"></label>' +
      '<p class="notice" data-nc-msg hidden></p><p><button class="btn" type="submit">Enviar propuesta</button> <button class="btn ghost" type="button" data-nc-reset>Volver al texto actual</button></p></form></section>';
  }
  /** Caja de aprobación: el Revisor aprueba o retira; el manager solo ve el estado. */
  function approveBox(p, l, v) {
    var me = data.me || {}, fn = (data.functions || {})[l] || '';
    if (!me.can_decide) return '<section class="panel"><h2>Aprobación</h2><p class="muted">Solo el Revisor aprueba. ' + (v.status === 'aprobado' ? '' : 'Esta versión se aprobaría como «' + esc(fn) + '».') + '</p></section>';
    if (v.status === 'aprobado') return '<section class="panel"><h2>Aprobación</h2><p>Aprobada como «' + esc(v.approval.role) + '» por <strong>' + esc(v.approval.by) + '</strong> el ' + esc(v.approval.at) + '. Se publicará en la siguiente actualización de la web.</p><p><button class="btn ghost" type="button" data-nc-withdraw>Retirar la aprobación</button></p></section>';
    var np = pending(v).length;
    return '<section class="panel"><h2>Aprobación</h2><p>Al aprobar dices, como <strong>' + esc(fn) + '</strong>, que este texto es correcto' + (l === 'es' ? ': lo que afirma y las condiciones que da.' : ' en ' + esc(LANG_NAME[l]) + ' y fiel al castellano aprobado.') + '</p>' +
      (np ? '<p class="notice">Hay <strong>' + np + '</strong> propuesta' + (np > 1 ? 's' : '') + ' pendiente' + (np > 1 ? 's' : '') + ' sin decidir: si las aceptas después, la aprobación se retira.</p>' : '') +
      (v.can_approve ? '<p><label class="small"><input type="checkbox" data-nc-ok> He leído el texto completo y lo doy por bueno</label></p><p><button class="btn" type="button" data-nc-approve disabled>Aprobar como ' + esc(fn) + '</button></p>' : '<p class="notice">' + esc(v.approve_problem || 'No se puede aprobar todavía.') + '</p>') + '</section>';
  }
  /** Vista de una versión (página + idioma). */
  function versionView(id, l) {
    var p = pageOf(id), v = p && p.langs[l];
    if (!v) return '<div data-nc-root><p><a href="#nuevo">← Contenido nuevo</a></p><p class="notice">No existe esa versión.</p></div>';
    var canDecide = !!(data.me || {}).can_decide, t = v.text;
    var props = v.proposals || [], open = props.filter(function (x) { return x.status === 'pendiente'; }), done = props.filter(function (x) { return x.status !== 'pendiente'; });
    var log = (p.log || []).filter(function (e) { return e.lang === l; });
    return '<div data-nc-root data-nc-id="' + esc(id) + '" data-nc-lang="' + esc(l) + '"><p><a href="#nuevo">← Contenido nuevo</a></p><h1>' + esc(id) + ' · ' + esc(LANG_NAME[l]) + '</h1><p>' + statusTag(v) + ' <span class="mono small muted">' + esc((p.slug || {})[l] || '') + '</span></p>' +
      (v.stale_edit ? '<p class="notice">Había una edición hecha en el panel sobre una versión anterior del archivo: <strong>manda el archivo</strong> y esa edición se ignora.</p>' : '') +
      (v.edited ? '<p class="notice ok">El texto de abajo incluye cambios aceptados en el panel que todavía no están anotados en los archivos (el manager los descarga y los anota).</p>' : '') +
      '<div class="cols"><section class="panel"><h2>Texto vigente</h2>' + preview(t) + '</section>' + approveBox(p, l, v) + '</div>' +
      '<h2>Propuestas pendientes (' + open.length + ')</h2>' + (open.length ? open.map(function (x) { return proposalBox(x, t, canDecide); }).join('') : '<p class="muted">No hay propuestas pendientes.</p>') +
      proposeForm(t) +
      (done.length ? '<details><summary>Propuestas ya decididas (' + done.length + ')</summary>' + done.map(function (x) { return proposalBox(x, t, false); }).join('') + '</details>' : '') +
      '<h2>Registro de esta versión</h2>' + logTable(log) + '</div>';
  }

  // ───────────────────────────────────────── [REGISTRO]
  /** Tabla de hechos del registro. */
  function logTable(items) {
    if (!items.length) return '<p class="muted">Todavía no hay nada registrado.</p>';
    return '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Cuándo</th><th>Quién</th><th>Idioma</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>' + items.map(function (e) {
      return '<tr><td class="small">' + esc(ctx.when(e.at)) + '</td><td class="small">' + esc(e.name || e.by) + '<br><span class="muted mono">' + esc(e.by) + '</span></td><td>' + esc(LANG_NAME[e.lang] || e.lang) + '</td><td>' + esc(actionName(e.action)) + '</td><td class="small">' + esc(e.detail || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  /** Vista del registro de cambios de todas las páginas, el más reciente primero. */
  function logView() {
    var all = [];
    (data.pages || []).forEach(function (p) { (p.log || []).forEach(function (e) { all.push(Object.assign({ page: p.id }, e)); }); });
    all.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return '<div data-nc-root><p><a href="#nuevo">← Contenido nuevo</a></p><h1>Registro de cambios</h1><p class="muted">Quién propuso, aceptó, descartó, aprobó o retiró una aprobación, y cuándo. Lo que ya está anotado en los archivos sale también del propio archivo (campo «history»). Se muestran los últimos 100 hechos de cada página.</p>' + logTable(all.slice(0, 300).map(function (e) { return Object.assign({}, e, { detail: e.page + (e.detail ? ' · ' + e.detail : '') }); })) + '</div>';
  }

  /** Punto de entrada de la vista: pide los datos al servidor y pinta la lista, el registro o una versión según `arg`. */
  N.view = function (c, arg) {
    ctx = c;
    return ctx.http('GET', '/api/newcontent').then(function (r) {
      if (!r.ok) return unavailable(r);
      data = r;
      if (arg === 'registro') return logView();
      var m = /^([a-z0-9-]+)\/(es|en|fr|de)$/.exec(arg || '');
      return m ? versionView(m[1], m[2]) : listView();
    });
  };

  // ───────────────────────────────────────── [ACCIONES]
  /** Muestra u oculta un aviso del formulario. */
  function formMsg(form, text) { var n = form.querySelector('[data-nc-msg]'); n.hidden = !text; n.textContent = text || ''; }
  /** Contadores de caracteres del título y de la descripción. */
  function counters(root) {
    ['title', 'meta_description'].forEach(function (k) {
      var i = root.querySelector('[name="' + k + '"]'), n = root.querySelector('[data-nc-count="' + k + '"]'); if (!i || !n) return;
      var L = data.limits, len = i.value.length, bad = k === 'title' ? len > L.title : (len < L.meta_min || len > L.meta_max);
      n.textContent = len + (k === 'title' ? '/' + L.title : ' caracteres'); n.style.color = bad ? '#a32100' : '';
    });
  }
  /** Lo escrito en el formulario → cuerpo de la propuesta con SOLO lo que cambió respecto al texto vigente, o {error}. */
  function readForm(form, cur) {
    var body = {}, f = form.elements;
    ['title', 'meta_description', 'h1', 'lead'].forEach(function (k) { var v = String(f[k].value).replace(/\s+/g, ' ').trim(); if (v !== String(cur[k] || '')) body[k] = v; });
    var s = textToSections(f.sections.value); if (s.error) return { error: s.error };
    if (fieldText('sections', s.sections) !== fieldText('sections', cur.sections)) body.sections = s.sections;
    var c = textToCta(f.cta.value); if (c.error) return { error: c.error };
    if (fieldText('cta', c.cta) !== fieldText('cta', cur.cta)) body.cta = c.cta;
    if (!Object.keys(body).length) return { error: 'No has cambiado nada del texto actual.' };
    body.note = f.note.value.trim();
    return { body: body };
  }
  /** Ruta de la versión que se está viendo. */
  function here(root) { var r = root.querySelector('[data-nc-root]'); return r ? '/api/newcontent/' + r.getAttribute('data-nc-id') + '/' + r.getAttribute('data-nc-lang') : ''; }
  /** Descarga lo que hay que anotar en los archivos (GET /api/newcontent/export). */
  function doExport() {
    ctx.http('GET', '/api/newcontent/export').then(function (r) {
      if (!r.ok) return say(r.error || 'No se pudo descargar', false);
      var blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' }), a = document.createElement('a');
      a.hidden = true; a.href = URL.createObjectURL(blob); a.download = 'contenido-nuevo-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      var n = Object.keys(r.pages || {}).length; say(n ? 'Descargado: ' + n + ' página(s) con cambios por anotar' : 'No hay nada nuevo por anotar en los archivos', true);
    });
  }
  /** Engancha los clics, cambios y envíos de la vista (delegación de eventos sobre `root`: se enlazan UNA sola vez; `ctx` se actualiza en cada vista). */
  N.bind = function (root, c) {
    ctx = c;
    var box = root.querySelector('[data-nc-root]'); if (box) { counters(box); }
    if (bound === root) return;
    bound = root;
    root.addEventListener('input', function (e) {
      if (!e.target.closest('[data-nc-root]')) return;
      if (e.target.matches('[name="title"],[name="meta_description"]')) counters(root);
      if (e.target.matches('[data-nc-ok]')) { var b = root.querySelector('[data-nc-approve]'); if (b) b.disabled = !e.target.checked; }
    });
    root.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-nc-propose]'); if (!form) return;
      e.preventDefault();
      var id = form.closest('[data-nc-root]').getAttribute('data-nc-id'), l = form.closest('[data-nc-root]').getAttribute('data-nc-lang'), p = pageOf(id), cur = p && p.langs[l] && p.langs[l].text;
      if (!cur) return;
      var r = readForm(form, cur); if (r.error) return formMsg(form, r.error);
      formMsg(form, '');
      var btn = form.querySelector('[type=submit]'); btn.disabled = true;
      ctx.http('POST', here(root) + '/propose', r.body).then(function (res) {
        btn.disabled = false;
        if (!res.ok) return formMsg(form, res.error || 'No se pudo enviar la propuesta');
        say('Propuesta enviada', true); ctx.render();
      });
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !b.closest('[data-nc-root]')) return;
      if (b.hasAttribute('data-nc-export')) return doExport();
      var path = here(root);
      if (b.hasAttribute('data-nc-reset')) { ctx.render(); return; }
      if (b.hasAttribute('data-nc-decide')) {
        var pid = b.getAttribute('data-nc-pid'), accept = b.getAttribute('data-nc-decide') === 'accept', noteEl = root.querySelector('[data-nc-dnote="' + pid + '"]');
        if (accept && !window.confirm('Aceptar esta propuesta cambia el texto vigente y retira la aprobación de esta versión si la tenía. ¿Continuar?')) return;
        b.disabled = true;
        ctx.http('POST', path + '/proposals/' + pid, { decision: accept ? 'accept' : 'reject', note: noteEl ? noteEl.value.trim() : '' }).then(function (res) { if (!res.ok) { b.disabled = false; return say(res.error || 'No se pudo decidir', false); } say(accept ? 'Propuesta aceptada' : 'Propuesta descartada', true); ctx.render(); });
      } else if (b.hasAttribute('data-nc-approve')) {
        b.disabled = true;
        ctx.http('POST', path + '/approve').then(function (res) { if (!res.ok) { b.disabled = false; return say(res.error || 'No se pudo aprobar', false); } say('Versión aprobada', true); ctx.render(); });
      } else if (b.hasAttribute('data-nc-withdraw')) {
        if (!window.confirm('Retirar la aprobación devuelve esta versión a borrador (si es el castellano, también las traducciones). ¿Continuar?')) return;
        b.disabled = true;
        ctx.http('POST', path + '/withdraw').then(function (res) { if (!res.ok) { b.disabled = false; return say(res.error || 'No se pudo retirar', false); } say('Aprobación retirada', true); ctx.render(); });
      }
    });
  };
})();
