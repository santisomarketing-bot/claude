/**
 * [ADMIN-QUOTES] «Presupuestos recibidos» del panel real (admin-live.js): ver, EDITAR, DESCARGAR en PDF y REENVIAR por correo los presupuestos que la gente ha pedido desde la web.
 * Lo usan el rol Propietario (en el API, `client`: las personas dueñas de la web, NO compradores) y el manager. Contrato de las rutas: docs/PRESUPUESTOS-RECIBIDOS.md.
 *   · Lista con búsqueda (número, nombre, empresa, correo, referencia) y filtros (editados, reenviados, sin avisar al equipo).
 *   · Detalle: datos de la persona que lo pidió, líneas, total, nota, historial y, si se editó, lo que llegó originalmente de la web.
 *   · Edición: datos de la persona, cantidad y precio por línea (vacío = tarifa), quitar y añadir líneas por referencia, nota del presupuesto. Guardar manda la revisión que se cargó:
 *     si otra persona lo cambió entretanto, el servidor lo rechaza (409) y aquí se avisa para recargar.
 *   · PDF: se fabrica en ESTE navegador con TV.makeQuotePdf, en el idioma del pedido (Q.withLang) y con los precios GUARDADOS del presupuesto (nunca los de la tarifa de hoy).
 *     Descargar = archivo; reenviar = el mismo PDF en base64 dentro de POST /api/orders/<nº>/send (el servidor lo valida y no lo guarda).
 * Todo lo que viene del servidor o lo escribe una persona se escapa al pintarlo; el servidor lo vuelve a comprobar todo.
 *
 *   TV.AdminQuotes.view(ctx, arg) → Promise<string> con el HTML (arg: «» lista · «<nº>» detalle · «<nº>/editar» · «<nº>/enviar»)
 *   TV.AdminQuotes.bind(root, ctx) → engancha clics y cambios (una sola vez)
 *   ctx = { http(method, path, body), toast(msg), when(iso), session(), render() }
 * Secciones: [UTIL] [DATOS] [PDF] [LISTA] [DETALLE] [EDITAR] [ENVIAR] [EVENTOS]
 * Depende de: quote.js (TV.Quote), pdf.js (TV.makeQuotePdf), catalog.js (TV.items).
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var A = (TV.AdminQuotes = {});
  var Q = TV.Quote, ctx = null, bound = null;
  /** Estado del módulo: pedidos del listado, filtro, el presupuesto abierto, el borrador que se edita y si tiene cambios sin guardar. */
  var S = { orders: [], truncated: false, filter: { q: '', f: '' }, cur: null, draft: null, dirty: false };
  var EMAIL = /^[^@\s,;<>"()[\]\\]+@[^@\s,;<>"()[\]\\]+\.[A-Za-z]{2,}$/;

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Importe con la divisa de los precios (2 decimales); un valor vacío cuenta como 0. */
  function money(n) { return Q.money(n || 0); }
  /** Importe unitario (2 a 4 decimales) o «A consultar» si no hay precio. */
  function unit(n) { return n == null ? 'A consultar' : Q.unitMoney(n); }
  /** ¿Es la persona que entró un manager? (si no, es un propietario). */
  function isManager() { var s = ctx.session(); return !!s && s.role === 'manager'; }
  /** Nombre de una línea en el idioma del pedido (el del catálogo; la propia referencia si no está). */
  function nameOf(ref, lang) { var it = TV.items && TV.items[ref]; return (it && it.n && (it.n[lang] || it.n.es)) || ref; }
  /** Descarga `blob` como archivo `name` con un enlace temporal. */
  function download(blob, name) { var a = document.createElement('a'); a.hidden = true; a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  /** Pone un aviso (clase `ok` si salió bien) en el elemento [data-qr-msg] de la pantalla. */
  function say(text, ok) { var n = document.querySelector('[data-qr-msg]'); if (!n) return ctx.toast(text); n.hidden = !text; n.className = 'notice' + (ok ? ' ok' : ''); n.textContent = text; if (text) n.scrollIntoView({ block: 'nearest' }); }
  /** Texto de error del servidor para una respuesta fallida (con el aviso de conflicto y de correo apagado ya redactados). */
  function whyFail(r) {
    if (r && r.status === 409 && r.code === 'conflict') return 'Alguien ha modificado este presupuesto mientras lo editabas. Recarga y vuelve a intentarlo.';
    return (r && r.error) || 'No se pudo completar la acción';
  }
  /** Copia profunda de un dato JSON. */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  /** Número escrito por una persona («12,5» o «12.5») → número, o NaN si no vale. */
  function num(s) { s = String(s).trim().replace(',', '.'); return /^\d+(\.\d{1,4})?$/.test(s) ? Number(s) : NaN; }

  // ───────────────────────────────────────── [DATOS]
  /** Carga la lista de pedidos del servidor → Promise<{ok, error?}> (deja el resultado en el estado). */
  function loadList() {
    return ctx.http('GET', '/api/orders').then(function (r) { if (r.ok) { S.orders = r.orders || []; S.truncated = !!r.truncated; } return r; });
  }
  /** Carga un presupuesto del servidor → Promise<respuesta> (en `order` viene el registro). */
  function loadOne(number) {
    return ctx.http('GET', '/api/orders/' + encodeURIComponent(number)).then(function (r) { if (r.ok) S.cur = r.order; return r; });
  }
  /** Sustituye en la lista y en el estado el presupuesto `o` (tras guardar o reenviar). */
  function keep(o) { S.cur = o; S.orders = S.orders.map(function (x) { return x.number === o.number ? o : x; }); }

  // ───────────────────────────────────────── [PDF]
  /** Líneas del presupuesto `o` con la forma que espera el generador del PDF (precios guardados, nombres en el idioma del pedido). */
  function detailOf(o) {
    var lang = o.lang || 'es';
    return { lines: o.lines.map(function (l) { var it = (TV.items && TV.items[l.ref]) || {}; return { ref: l.ref, qty: l.qty, item: it, name: nameOf(l.ref, lang), spec: it.v || '', generic: !!it.d, unit: l.unit, total: l.total }; }), total: o.total, unpriced: o.lines.filter(function (l) { return l.total == null; }).length };
  }
  /** Fabrica el PDF del presupuesto `o` en el idioma del pedido (con su nota si la tiene) → { doc, filename, blob() }. */
  function makePdf(o) {
    var c = Object.assign({}, o.customer, { notes: [o.customer.notes, o.quoteNote].filter(Boolean).join('\n\n') });
    return Q.withLang(o.lang || 'es', function () { return TV.makeQuotePdf({ customer: c, number: o.number, detail: detailOf(o), date: (o.edited && o.edited.at) || o.at }); });
  }
  /** Descarga el PDF de `o`; si el generador falla lo dice (no se queda mudo). */
  function downloadPdf(o) {
    try { var res = makePdf(o); download(res.blob(), res.filename); }
    catch (e) { console.error(e); ctx.toast('⚠ No se pudo fabricar el PDF'); }
  }

  // ───────────────────────────────────────── [LISTA]
  /** Etiquetas de estado de un presupuesto (editado, reenviado, reenvío fallido y, para managers, sin aviso al equipo). */
  function tags(o) {
    var t = [];
    if (o.rev) t.push('<span class="tag" title="Editado por ' + esc((o.edited || {}).by || '') + '">Editado · rev. ' + Number(o.rev) + '</span>');
    if (o.lastSent) t.push(o.lastSent.ok ? '<span class="tag dim" title="' + esc(when(o.lastSent.at)) + '">Reenviado</span>' : '<span class="tag warn" title="El último reenvío no salió">Reenvío fallido</span>');
    if (isManager() && o.emailed && !o.emailed.team) t.push('<span class="tag warn" title="' + esc(o.emailed.error || '') + '">sin aviso por correo</span>');
    if (o.prices && o.prices.mode !== 'live') t.push('<span class="tag dim">DEMO</span>');
    return t.join(' ');
  }
  /** Fecha y hora legibles (la función del panel). */
  function when(iso) { return ctx.when(iso); }
  /** ¿Cumple el presupuesto `o` el filtro actual (texto y estado)? */
  function matches(o) {
    var f = S.filter, q = f.q.trim().toLowerCase();
    if (f.f === 'edited' && !o.rev) return false;
    if (f.f === 'sent' && !(o.lastSent && o.lastSent.ok)) return false;
    if (f.f === 'unsent' && o.lastSent) return false;
    if (f.f === 'nomail' && !(o.emailed && !o.emailed.team)) return false;
    if (!q) return true;
    var c = o.customer || {};
    return [o.number, c.name, c.company, c.email, c.phone, o.quoteNote].concat(o.lines.map(function (l) { return l.ref + ' ' + nameOf(l.ref, o.lang); })).join(' ').toLowerCase().indexOf(q) >= 0;
  }
  /** Filas de la tabla de la lista según el filtro. */
  function rowsHtml() {
    var rows = S.orders.filter(matches).map(function (o) {
      var c = o.customer || {};
      return '<tr><td class="mono"><a href="#recibidos/' + encodeURIComponent(o.number) + '">' + esc(o.number) + '</a></td><td>' + esc(when(o.at)) + '</td><td>' + esc(c.name || '') + '<br><span class="muted small">' + esc(c.company || '') + ' ' + esc(c.email || '') + '</span></td>' +
        '<td class="num">' + o.lines.length + '</td><td class="num">' + money(o.total) + '</td><td>' + tags(o) + '</td><td class="qr-act"><a class="btn sm ghost" href="#recibidos/' + encodeURIComponent(o.number) + '">Ver</a> <button class="btn sm ghost" type="button" data-qr-pdf="' + esc(o.number) + '">PDF</button> <a class="btn sm ghost" href="#recibidos/' + encodeURIComponent(o.number) + '/enviar">Reenviar</a></td></tr>';
    });
    return rows.length ? rows.join('') : '<tr><td colspan="7" class="muted">Ningún presupuesto cumple ese filtro.</td></tr>';
  }
  /** Vista de la lista: barra de búsqueda y filtro y tabla de presupuestos recibidos. */
  function listView() {
    return loadList().then(function (r) {
      if (!r.ok) return '<h1>Presupuestos recibidos</h1><p class="notice">' + esc(r.error || 'No se pudieron cargar los presupuestos') + '</p>';
      var mgr = isManager();
      return '<div data-qr-root><h1>Presupuestos recibidos</h1><p class="muted">Los presupuestos que la gente ha pedido desde la web. Puedes <strong>verlos, editarlos, descargarlos en PDF y reenviarlos</strong> por correo desde aquí. «Solicitante» es quien lo pidió; tú eres quien lo atiende.</p>' +
        (S.orders.length ? '<form class="prop-bar" data-qr-bar role="search"><label>Buscar<input type="search" data-qr-q placeholder="Nº, nombre, empresa, correo o referencia" value="' + esc(S.filter.q) + '"></label><label>Mostrar<select data-qr-f><option value="">Todos</option><option value="edited"' + (S.filter.f === 'edited' ? ' selected' : '') + '>Editados</option><option value="sent"' + (S.filter.f === 'sent' ? ' selected' : '') + '>Reenviados</option><option value="unsent"' + (S.filter.f === 'unsent' ? ' selected' : '') + '>Nunca reenviados</option>' + (mgr ? '<option value="nomail"' + (S.filter.f === 'nomail' ? ' selected' : '') + '>Sin aviso por correo</option>' : '') + '</select></label></form>' +
        '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Nº</th><th>Fecha</th><th>Solicitante</th><th>Líneas</th><th>Importe</th><th>Estado</th><th><span class="vh">Acciones</span></th></tr></thead><tbody data-qr-rows>' + rowsHtml() + '</tbody></table></div>' +
          (S.truncated ? '<p class="muted small">Se enseñan los más recientes; hay más antiguos que no caben en la lista.</p>' : '') + '<p><button class="btn sm ghost" type="button" data-qr-export>Exportar JSON</button></p>' : '<p class="notice">Todavía no ha llegado ningún presupuesto.</p>') + '</div>';
    });
  }

  // ───────────────────────────────────────── [DETALLE]
  /** Tabla de líneas de un presupuesto (referencia, nombre, cantidad, precio y total) con la etiqueta «precio manual» donde la persona fijó el precio. */
  function linesTable(lines, lang, total) {
    var un = lines.filter(function (l) { return l.total == null; }).length;
    return '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Precio ud.</th><th>Importe</th></tr></thead><tbody>' +
      lines.map(function (l) { return '<tr><td class="mono">' + esc(l.ref) + '</td><td>' + esc(nameOf(l.ref, lang)) + '</td><td class="num">' + Number(l.qty) + '</td><td class="num">' + esc(unit(l.unit)) + (l.manual ? ' <span class="tag dim">manual</span>' : '') + '</td><td class="num">' + (l.total == null ? 'A consultar' : esc(money(l.total))) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><th colspan="4" class="num">Total (sin IVA)</th><th class="num">' + esc(money(total)) + '</th></tr></tfoot></table></div>' + (un ? '<p class="muted small">' + un + ' línea(s) «A consultar» no suman en el total.</p>' : '');
  }
  /** Historial de un presupuesto: ediciones y reenvíos, del más reciente al más antiguo. */
  function historyHtml(o) {
    var h = (o.history || []).slice().reverse();
    if (!h.length) return '<p class="muted small">Sin cambios ni reenvíos todavía.</p>';
    return '<ul class="qr-hist">' + h.map(function (e) {
      return '<li><strong>' + esc(when(e.at)) + '</strong> · ' + (e.kind === 'send' ? (e.ok ? 'Reenviado a ' : '<span class="err">No se pudo reenviar a </span>') + esc((e.to || []).join(', ')) + (e.reason && !e.ok ? ' (' + esc(e.reason) + ')' : '') : 'Editado (revisión ' + Number(e.rev || 0) + ')') + ' · <span class="muted">' + esc(e.by || '') + '</span></li>';
    }).join('') + '</ul>';
  }
  /** Vista de detalle de un presupuesto. */
  function detailView(number) {
    return loadOne(number).then(function (r) {
      if (!r.ok) return '<div data-qr-root><p><a href="#recibidos">← Presupuestos recibidos</a></p><h1>Presupuesto</h1><p class="notice">' + esc(r.status === 404 ? 'No existe ese presupuesto.' : (r.error || 'No se pudo cargar el presupuesto')) + '</p></div>';
      var o = r.order, c = o.customer || {}, N = encodeURIComponent(o.number);
      return '<div data-qr-root><p><a href="#recibidos">← Presupuestos recibidos</a></p><h1>Presupuesto <span class="mono">' + esc(o.number) + '</span> ' + tags(o) + '</h1><p class="notice" data-qr-msg hidden></p>' +
        '<p class="qr-bar"><a class="btn" href="#recibidos/' + N + '/editar">Editar</a> <button class="btn ghost" type="button" data-qr-pdf="' + esc(o.number) + '">Descargar PDF</button> <a class="btn ghost" href="#recibidos/' + N + '/enviar">Reenviar por correo</a></p>' +
        '<div class="cols"><section class="panel"><h2>Solicitante</h2><p><strong>' + esc(c.name || '') + '</strong>' + (c.company ? ' · ' + esc(c.company) : '') + '<br>' + esc(c.email || '') + (c.phone ? ' · ' + esc(c.phone) : '') + '</p>' +
        '<p class="muted small">Pedido el ' + esc(when(o.at)) + ' · idioma ' + esc((o.lang || 'es').toUpperCase()) + (o.edited ? '<br>Editado el ' + esc(when(o.edited.at)) + ' por ' + esc(o.edited.by || '') : '') + '</p>' +
        (c.notes ? '<p><strong>Notas del solicitante</strong><br>' + esc(c.notes).replace(/\n/g, '<br>') + '</p>' : '') + (o.quoteNote ? '<p><strong>Nota del presupuesto</strong><br>' + esc(o.quoteNote).replace(/\n/g, '<br>') + '</p>' : '') + '</section>' +
        '<section class="panel"><h2>Historial</h2>' + historyHtml(o) + (isManager() && o.emailed && !o.emailed.team ? '<p class="notice">El aviso al equipo por correo no salió' + (o.emailed.error ? ': ' + esc(o.emailed.error) : '') + '.</p>' : '') + '</section></div>' +
        '<h2>Líneas</h2>' + linesTable(o.lines, o.lang, o.total) +
        (o.original ? '<details class="prop"><summary><strong>Ver lo que llegó de la web</strong> <span class="muted small">(' + esc(when(o.original.at)) + ')</span></summary>' + linesTable(o.original.lines, o.lang, o.original.total) + '<p class="muted small">Solicitante original: ' + esc(o.original.customer.name || '') + ' · ' + esc(o.original.customer.email || '') + '</p></details>' : '') + '</div>';
    });
  }

  // ───────────────────────────────────────── [EDITAR]
  /** Prepara el borrador de edición a partir del registro `o` (precio vacío = tarifa; el precio manual se enseña escrito). */
  function startDraft(o) {
    S.dirty = false;
    S.draft = { number: o.number, rev: o.rev || 0, lang: o.lang, customer: { name: o.customer.name || '', company: o.customer.company || '', email: o.customer.email || '', phone: o.customer.phone || '', notes: o.customer.notes || '' }, quoteNote: o.quoteNote || '',
      lines: o.lines.map(function (l) { return { ref: l.ref, qty: l.qty, manual: !!l.manual, price: l.manual && l.unit != null ? String(l.unit).replace('.', ',') : '', unit: l.unit }; }) };
  }
  /** Campo de texto del formulario de edición (`k` = clave de `customer` o «quoteNote»). */
  function field(label, k, value, o) {
    o = o || {};
    return '<label class="qr-f' + (o.wide ? ' wide' : '') + '">' + esc(label) + (o.area ? '<textarea data-qr-field="' + k + '" rows="3" maxlength="' + (o.max || 1000) + '">' + esc(value) + '</textarea>' : '<input data-qr-field="' + k + '" type="' + (o.type || 'text') + '" value="' + esc(value) + '" maxlength="' + (o.max || 200) + '"' + (o.req ? ' required' : '') + ' autocomplete="off">') + '</label>';
  }
  /** Tabla editable de líneas del borrador (cantidad y precio por línea, quitar). */
  function editLines() {
    var d = S.draft;
    return '<div class="tbl-wrap"><table class="spec qr-edit"><thead><tr><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Precio ud. (vacío = tarifa)</th><th><span class="vh">Quitar</span></th></tr></thead><tbody>' +
      d.lines.map(function (l, i) { return '<tr><td class="mono">' + esc(l.ref) + '</td><td>' + esc(nameOf(l.ref, d.lang)) + (l.unit != null && !l.manual ? '<br><span class="muted small">tarifa guardada: ' + esc(Q.unitMoney(l.unit)) + '</span>' : '') + '</td>' +
        '<td><input class="qr-n" type="number" min="1" max="1000000" step="1" value="' + Number(l.qty) + '" data-qr-qty="' + i + '" aria-label="Cantidad de ' + esc(l.ref) + '"></td>' +
        '<td><input class="qr-n" type="text" inputmode="decimal" value="' + esc(l.price) + '" data-qr-price="' + i + '" placeholder="tarifa" aria-label="Precio unitario de ' + esc(l.ref) + '"></td>' +
        '<td><button class="btn sm ghost" type="button" data-qr-rm="' + i + '" aria-label="Quitar ' + esc(l.ref) + '">✕</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="muted small">Si cambias la cantidad de una línea sin escribir precio, se valora con la <strong>tarifa de hoy</strong> para esa cantidad. Las líneas que no toques conservan su precio.</p>';
  }
  /** Pinta (o repinta) la zona de líneas del formulario de edición. */
  function paintLines() { var n = document.querySelector('[data-qr-lines]'); if (n) n.innerHTML = editLines(); }
  /** Vista de edición de un presupuesto. */
  function editView(number) {
    return loadOne(number).then(function (r) {
      if (!r.ok) return '<div data-qr-root><p><a href="#recibidos">← Presupuestos recibidos</a></p><p class="notice">' + esc(r.status === 404 ? 'No existe ese presupuesto.' : (r.error || 'No se pudo cargar')) + '</p></div>';
      startDraft(r.order);
      var d = S.draft, refs = Object.keys(TV.items || {}).slice(0, 4000).map(function (k) { return '<option value="' + esc(k) + '">' + esc(nameOf(k, 'es')) + '</option>'; }).join('');
      return '<div data-qr-root><p><a href="#recibidos/' + encodeURIComponent(number) + '">← Volver al presupuesto</a></p><h1>Editar <span class="mono">' + esc(number) + '</span></h1><p class="notice" data-qr-msg hidden></p>' +
        '<p class="muted">Lo que cambies se guarda como una nueva revisión; lo que llegó de la web se conserva y se puede consultar.</p>' +
        '<form class="form" data-qr-edit novalidate><section class="panel"><h2>Solicitante</h2><div class="qr-grid">' + field('Nombre', 'name', d.customer.name, { req: true, max: 120 }) + field('Empresa', 'company', d.customer.company, { max: 120 }) + field('Correo', 'email', d.customer.email, { type: 'email', req: true, max: 254 }) + field('Teléfono', 'phone', d.customer.phone, { max: 40 }) + field('Notas del solicitante', 'notes', d.customer.notes, { area: true, wide: true, max: 1000 }) + '</div></section>' +
        '<section class="panel"><h2>Líneas</h2><div data-qr-lines>' + editLines() + '</div><div class="qr-add"><label class="qr-f">Añadir referencia<input data-qr-ref list="qr-refs" placeholder="Escribe una referencia o un nombre" autocomplete="off"></label><datalist id="qr-refs">' + refs + '</datalist><button class="btn sm ghost" type="button" data-qr-add>Añadir línea</button></div></section>' +
        '<section class="panel"><h2>Nota del presupuesto</h2>' + field('Aparece en el PDF y en el correo (p. ej. validez de la oferta, plazo de entrega)', 'quoteNote', d.quoteNote, { area: true, wide: true, max: 1000 }) + '</section>' +
        '<p class="qr-bar"><button class="btn" type="submit" data-qr-save>Guardar cambios</button> <a class="btn ghost" href="#recibidos/' + encodeURIComponent(number) + '" data-qr-cancel>Cancelar</a></p></form></div>';
    });
  }
  /** Comprueba el borrador antes de mandarlo → texto del primer problema o ''. */
  function draftProblem() {
    var d = S.draft, c = d.customer;
    if (c.name.trim().length < 2) return 'Falta el nombre del solicitante.';
    if (!EMAIL.test(c.email.trim())) return 'El correo del solicitante no es válido.';
    if (!d.lines.length) return 'El presupuesto no puede quedarse sin líneas.';
    for (var i = 0; i < d.lines.length; i++) {
      var l = d.lines[i];
      if (!(Number.isInteger(l.qty) && l.qty >= 1 && l.qty <= 1000000)) return 'La cantidad de ' + l.ref + ' debe ser un número entero entre 1 y 1.000.000.';
      if (l.price !== '' && isNaN(num(l.price))) return 'El precio de ' + l.ref + ' no es válido (usa cifras, con coma o punto).';
    }
    return '';
  }
  /** Cuerpo del PUT con el borrador: el precio solo viaja si la persona lo escribió (o si había uno manual que ha vaciado: null = volver a la tarifa). */
  function draftBody() {
    var d = S.draft;
    return { rev: d.rev, customer: { name: d.customer.name.trim(), company: d.customer.company.trim(), email: d.customer.email.trim(), phone: d.customer.phone.trim(), notes: d.customer.notes.trim() }, quoteNote: d.quoteNote.trim(),
      lines: d.lines.map(function (l) { var x = { ref: l.ref, qty: l.qty }; if (l.price !== '') x.price = num(l.price); else if (l.manual) x.price = null; return x; }) };
  }
  /** Guarda la edición (PUT) y vuelve al detalle; si hay conflicto de revisión o un error de texto, lo dice sin perder lo escrito. */
  function saveEdit(btn) {
    var p = draftProblem(); if (p) return say(p);
    btn.disabled = true; say('');
    ctx.http('PUT', '/api/orders/' + encodeURIComponent(S.draft.number), draftBody()).then(function (r) {
      btn.disabled = false;
      if (!r.ok) return say(whyFail(r));
      S.dirty = false; keep(r.order); ctx.toast('Presupuesto guardado (revisión ' + Number(r.order.rev || 0) + ')'); location.hash = '#recibidos/' + encodeURIComponent(r.order.number);
    });
  }

  // ───────────────────────────────────────── [ENVIAR]
  /** Vista de reenvío: destinatarios (el del solicitante ya puesto), mensaje y copia para quien envía. */
  function sendView(number) {
    return loadOne(number).then(function (r) {
      if (!r.ok) return '<div data-qr-root><p><a href="#recibidos">← Presupuestos recibidos</a></p><p class="notice">' + esc(r.status === 404 ? 'No existe ese presupuesto.' : (r.error || 'No se pudo cargar')) + '</p></div>';
      var o = r.order, s = ctx.session() || {}, canCopy = EMAIL.test(String(s.email || ''));
      return '<div data-qr-root><p><a href="#recibidos/' + encodeURIComponent(number) + '">← Volver al presupuesto</a></p><h1>Reenviar <span class="mono">' + esc(number) + '</span></h1><p class="notice" data-qr-msg hidden></p>' +
        '<p class="muted">Se manda el presupuesto <strong>tal como está ahora</strong> (con lo que hayas editado), en PDF adjunto y en el idioma del pedido (' + esc((o.lang || 'es').toUpperCase()) + '). Las respuestas llegan al correo del equipo.</p>' +
        '<form class="form" data-qr-send novalidate><section class="panel"><label class="qr-f wide">Para (hasta 3 correos, separados por coma)<input data-qr-to type="text" value="' + esc((o.customer || {}).email || '') + '" autocomplete="off" required></label>' +
        '<label class="qr-f wide">Mensaje (opcional, solo texto)<textarea data-qr-message rows="5" maxlength="1500" placeholder="Hola, te adjunto el presupuesto revisado…"></textarea></label><p class="muted small" data-qr-count>0 / 1500</p>' +
        (canCopy ? '<label class="qr-chk"><input type="checkbox" data-qr-copy checked> Enviarme una copia (' + esc(s.email) + ')</label>' : '') + '</section>' +
        '<p class="qr-bar"><button class="btn" type="submit" data-qr-dosend>Enviar presupuesto</button> <a class="btn ghost" href="#recibidos/' + encodeURIComponent(number) + '">Cancelar</a></p></form></div>';
    });
  }
  /** Lee, comprueba y manda el reenvío: fabrica el PDF del presupuesto cargado y lo envía con POST; cuenta lo que pasó (salió, no salió, correo apagado, límite). */
  function doSend(btn) {
    var o = S.cur, to = document.querySelector('[data-qr-to]').value.split(/[,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
    to = to.filter(function (x, i) { return to.indexOf(x) === i; });
    if (!to.length || to.length > 3) return say('Escribe entre 1 y 3 correos.');
    if (!to.every(function (x) { return EMAIL.test(x); })) return say('Alguno de los correos no es válido.');
    var res; try { res = makePdf(o); } catch (e) { console.error(e); return say('No se pudo fabricar el PDF.'); }
    var pdf = String(res.doc.output('datauristring')).replace(/^data:[^,]*,/, ''), copy = document.querySelector('[data-qr-copy]');
    btn.disabled = true; say('Enviando…', true);
    ctx.http('POST', '/api/orders/' + encodeURIComponent(o.number) + '/send', { to: to, message: document.querySelector('[data-qr-message]').value.trim(), pdf: pdf, copyToMe: !!(copy && copy.checked) }).then(function (r) {
      btn.disabled = false;
      if (r.order) keep(r.order);
      if (!r.ok) return say(r.code === 'mail_off' ? (r.error || 'El correo no está configurado.') : whyFail(r));
      if (!r.sent) return say('No se pudo enviar el correo (' + (r.reason || 'error') + (r.error ? ': ' + r.error : '') + '). El presupuesto no se ha perdido: puedes reintentarlo o descargar el PDF.');
      ctx.toast('Presupuesto enviado a ' + to.join(', ')); location.hash = '#recibidos/' + encodeURIComponent(o.number);
    });
  }

  // ───────────────────────────────────────── [EVENTOS]
  /** Vista según la ruta: «» lista · «<nº>» detalle · «<nº>/editar» · «<nº>/enviar». */
  A.view = function (c, arg) {
    ctx = c; S.draft = null;
    var p = String(arg || '').split('/'), n = p[0], mode = p[1] || '';
    if (!n) return listView();
    if (!/^TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?$/.test(n)) return Promise.resolve('<div data-qr-root><p><a href="#recibidos">← Presupuestos recibidos</a></p><p class="notice">Número de presupuesto no válido.</p></div>');
    return mode === 'editar' ? editView(n) : mode === 'enviar' ? sendView(n) : detailView(n);
  };
  /** Engancha los eventos de la sección una sola vez (el contenedor del panel no se repinta, sus vistas sí). */
  A.bind = function (root, c) {
    ctx = c; if (bound === root) return; bound = root;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button,a'); if (!b || !root.querySelector('[data-qr-root]')) return;
      if (b.hasAttribute('data-qr-pdf')) { var n = b.getAttribute('data-qr-pdf'), o = (S.cur && S.cur.number === n ? S.cur : null) || S.orders.filter(function (x) { return x.number === n; })[0]; if (o) downloadPdf(o); }
      else if (b.hasAttribute('data-qr-export')) download(new Blob([JSON.stringify(S.orders, null, 1)], { type: 'application/json' }), 'presupuestos-recibidos.json');
      else if (b.hasAttribute('data-qr-rm')) { S.draft.lines.splice(+b.getAttribute('data-qr-rm'), 1); S.dirty = true; paintLines(); }
      else if (b.hasAttribute('data-qr-add')) addLine();
      else if (b.hasAttribute('data-qr-cancel') && S.dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) e.preventDefault();
    });
    root.addEventListener('submit', function (e) {
      if (!e.target.closest('[data-qr-root]')) return; e.preventDefault();
      if (e.target.hasAttribute('data-qr-edit')) saveEdit(e.target.querySelector('[data-qr-save]'));
      else if (e.target.hasAttribute('data-qr-send')) doSend(e.target.querySelector('[data-qr-dosend]'));
    });
    root.addEventListener('input', function (e) {
      var t = e.target; if (!t.closest || !t.closest('[data-qr-root]')) return;
      if (t.hasAttribute('data-qr-q')) { S.filter.q = t.value; repaintRows(); }
      else if (t.hasAttribute('data-qr-f')) { S.filter.f = t.value; repaintRows(); }
      else if (t.hasAttribute('data-qr-field') && S.draft) { var k = t.getAttribute('data-qr-field'); if (k === 'quoteNote') S.draft.quoteNote = t.value; else S.draft.customer[k] = t.value; S.dirty = true; }
      else if (t.hasAttribute('data-qr-qty') && S.draft) { var l = S.draft.lines[+t.getAttribute('data-qr-qty')]; l.qty = t.value === '' ? NaN : Number(t.value); S.dirty = true; }
      else if (t.hasAttribute('data-qr-price') && S.draft) { S.draft.lines[+t.getAttribute('data-qr-price')].price = t.value.trim(); S.dirty = true; }
      else if (t.hasAttribute('data-qr-message')) { var c2 = document.querySelector('[data-qr-count]'); if (c2) c2.textContent = t.value.length + ' / 1500'; }
    });
  };
  /** Repinta solo las filas de la lista con el filtro actual (así no se pierde el foco del buscador). */
  function repaintRows() { var n = document.querySelector('[data-qr-rows]'); if (n) n.innerHTML = rowsHtml(); }
  /** Añade al borrador la referencia escrita (si ya está, suma 1 a su cantidad; si no existe en el catálogo, avisa). */
  function addLine() {
    var i = document.querySelector('[data-qr-ref]'), v = String(i.value || '').trim().toLowerCase().replace(/\s+/g, ''); if (!v) return;
    var ref = Object.keys(TV.items || {}).filter(function (k) { return k.toLowerCase().replace(/\s+/g, '') === v; })[0];
    if (!ref) return say('Esa referencia no está en el catálogo. Elige una de la lista que aparece al escribir.');
    say('');
    var ex = S.draft.lines.filter(function (l) { return l.ref === ref; })[0];
    if (ex) ex.qty += 1; else S.draft.lines.push({ ref: ref, qty: 1, manual: false, price: '', unit: null });
    S.dirty = true; i.value = ''; paintLines();
  }
})();
