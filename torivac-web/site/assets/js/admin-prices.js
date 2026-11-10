/**
 * [ADMIN-PRICES] Precios por categoría y editor de precios de producto del panel real (manager y Propietario): los porcentajes de las categorías, el precio para visitantes sin cuenta
 * y el precio de cada producto, que se puede modificar a mano.
 *   · El precio de la hoja es el VIP. VIP +5, VIP +10 y Normal suman un porcentaje SOBRE el VIP, igual para todos los productos (ajuste global, no un precio por producto).
 *   · Visitantes sin cuenta: o «Consultar precio» (los presupuestos salen «A consultar»), con un precio aproximado opcional calculado también de forma masiva, o el precio Normal.
 *   · Editor: precio VIP, tramos por cantidad y precio aproximado de cada producto. Lo editado a mano queda marcado «manual» y la sincronización de la hoja NO lo pisa; «Volver a la hoja» lo suelta.
 * El servidor valida todo otra vez. Todo texto se escapa al pintarlo. Contrato: docs/PRECIOS-Y-CLIENTES.md §5.2 y §5.3.
 *
 *   TV.AdminPrices.html(ctx) → Promise<string> con las dos secciones     TV.AdminPrices.bind(root, ctx) → engancha los eventos (una sola vez)
 *   ctx = { http(method, path, body), toast(msg) }
 * Secciones: [UTIL] [CATEGORIAS] [EDITOR] [EVENTOS]
 * Depende de: quote.js (TV.Quote: formato de importes) y catalog.js (TV.items: nombres de producto).
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var P = (TV.AdminPrices = {});
  var Q = TV.Quote, ctx = null, bound = null;
  /** Estado: ajustes de precios (GET /api/settings/pricing), precios base VIP con sus marcas (GET /api/prices) y la búsqueda del editor. */
  var S = { pricing: null, items: {}, manual: 0, q: '' };
  var MAX_ROWS = 40, TIERS = [['vip5', 'VIP +5'], ['vip10', 'VIP +10'], ['normal', 'Normal']];

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Número escrito por una persona («12,5» o «12.5») → número, o NaN si no vale. */
  function num(s) { s = String(s).trim().replace(',', '.'); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; }
  /** Número como se escribe en el panel: con coma decimal y sin ceros de más. */
  function show(n) { return String(n).replace('.', ','); }
  /** Precio de una categoría: base × (1 + porcentaje/100), redondeado a 4 decimales (la misma cuenta del servidor). */
  function tierPrice(base, pct) { return Math.round(base * (1 + pct / 100) * 10000) / 10000; }
  /** Pone un aviso en el elemento `sel` (clase `ok` si salió bien); sin texto lo oculta. */
  function say(sel, text, ok) { var n = document.querySelector(sel); if (!n) return ctx.toast(text); n.hidden = !text; n.className = 'notice' + (ok ? ' ok' : ''); n.textContent = text; if (text) n.scrollIntoView({ block: 'nearest' }); }
  /** Nombre y descripción de una referencia (catálogo, o el nombre que trajo la hoja). */
  function nameOf(ref) { var it = TV.items && TV.items[ref], sh = S.items[ref]; return it ? ((it.n && it.n.es) || ref) + (it.v ? ' — ' + it.v : '') : ((sh && sh.n) || ref); }
  /** Porcentajes vigentes de las categorías (los del formulario si se está editando; si no, los guardados). */
  function pcts() {
    var t = (S.pricing && S.pricing.tiers) || {};
    return { vip5: Number(t.vip5), vip10: Number(t.vip10), normal: Number(t.normal) };
  }

  // ───────────────────────────────────────── [CATEGORIAS]
  /** Sección «Categorías de precio»: porcentajes, ejemplo en vivo, precio para visitantes y precio aproximado. */
  function settingsHtml() {
    var s = S.pricing, t = s.tiers || {}, a = s.approx || {}, anon = s.anon === 'normal' ? 'normal' : 'consult';
    var rows = TIERS.map(function (k) {
      return '<tr><td><strong>' + esc(k[1]) + '</strong></td><td class="pr-pct"><label class="vh" for="pr-pct-' + k[0] + '">Porcentaje de ' + esc(k[1]) + ' sobre el VIP</label><input id="pr-pct-' + k[0] + '" class="qr-n" type="text" inputmode="decimal" data-pr-pct="' + k[0] + '" value="' + esc(show(t[k[0]])) + '"> %</td><td class="mono" data-pr-ex="' + k[0] + '"></td></tr>';
    }).join('');
    return '<section class="panel" data-pr-root><h2>Categorías de precio</h2><p>El precio de la hoja es el <strong>VIP</strong>. Cada cliente tiene una categoría (se asigna en <a href="#clientes">Clientes</a>) y las demás <strong>suman un porcentaje sobre el VIP</strong>, el mismo para todos los productos.</p>' +
      '<p class="notice" data-pr-msg hidden role="status"></p>' +
      '<form class="form" data-pr-settings novalidate><div class="tbl-wrap"><table class="spec"><thead><tr><th>Categoría</th><th>Sobre el VIP</th><th>Ejemplo: un producto de 100 € VIP</th></tr></thead><tbody><tr><td><strong>VIP</strong></td><td>precio base</td><td class="mono" data-pr-ex="vip"></td></tr>' + rows + '</tbody></table></div>' +
      '<h3>Visitantes sin cuenta</h3><fieldset class="mode"><legend class="vh">Qué ven los visitantes sin cuenta</legend>' +
      '<label class="qr-chk"><input type="radio" name="anon" value="consult"' + (anon === 'consult' ? ' checked' : '') + '><span><strong>No enseñar precios exactos</strong>: «Consultar precio». Los presupuestos de visitantes salen «A consultar» y vosotros los valoráis después.</span></label>' +
      '<label class="qr-chk"><input type="radio" name="anon" value="normal"' + (anon === 'normal' ? ' checked' : '') + '><span><strong>Enseñar el precio Normal</strong> y valorar con él los presupuestos de visitantes (solo los productos que tienen precio).</span></label></fieldset>' +
      '<div class="pr-approx" data-pr-approx><label class="qr-chk"><input type="checkbox" data-pr-approx-on' + (a.on ? ' checked' : '') + '><span>Enseñar un <strong>precio aproximado</strong> en la web (fichas y tienda), con el aviso «precio aproximado, el final se confirma por presupuesto»</span></label>' +
      '<label class="qr-f">Porcentaje sobre el VIP del precio aproximado<span class="muted small">Se redondea al euro y es para 1 unidad. Cada producto puede tener el suyo en el editor de abajo.</span><span><input class="qr-n" type="text" inputmode="decimal" data-pr-approx-pct value="' + esc(show(a.pct == null ? 15 : a.pct)) + '" aria-label="Porcentaje del precio aproximado"> %</span></label></div>' +
      '<p class="qr-bar"><button class="btn" type="submit" data-pr-save-settings>Guardar</button></p><p class="muted small" data-pr-when>' + (s.updated ? 'Guardado el ' + esc(new Date(s.updated.at).toLocaleString('es-ES')) + ' por ' + esc(s.updated.by || '') + '.' : 'Todavía no se ha guardado ningún ajuste: valen los de fábrica (5 %, 10 %, 15 %; sin precios públicos).') + '</p></form></section>';
  }
  /** Rellena el ejemplo de 100 € de cada categoría con los porcentajes escritos y desactiva el bloque del precio aproximado si los visitantes ven el precio Normal. */
  function paintExamples() {
    var f = document.querySelector('[data-pr-settings]'); if (!f) return;
    var v = { vip: 0 }; TIERS.forEach(function (k) { v[k[0]] = num(f.querySelector('[data-pr-pct="' + k[0] + '"]').value); });
    Object.keys(v).forEach(function (k) { var c = f.querySelector('[data-pr-ex="' + k + '"]'); if (c) c.textContent = isNaN(v[k]) ? '—' : Q.unitMoney(tierPrice(100, v[k])); });
    var ap = f.querySelector('[data-pr-approx]'); if (ap) ap.hidden = f.elements.anon.value === 'normal';
  }
  /** Lee el formulario de categorías como cuerpo del PUT; devuelve { body } o { error, field } si algo no es un número. */
  function readSettings(f) {
    var t = {}, bad = null;
    TIERS.forEach(function (k) { var n = num(f.querySelector('[data-pr-pct="' + k[0] + '"]').value); if (isNaN(n)) bad = bad || { error: 'El porcentaje de ' + k[1] + ' debe ser un número.', field: 'tiers.' + k[0] }; t[k[0]] = n; });
    var ap = num(f.querySelector('[data-pr-approx-pct]').value); if (isNaN(ap)) bad = bad || { error: 'El porcentaje del precio aproximado debe ser un número.', field: 'approx.pct' };
    if (bad) return bad;
    return { body: { tiers: t, anon: f.elements.anon.value, approx: { on: f.querySelector('[data-pr-approx-on]').checked, pct: ap } } };
  }
  /** Marca como inválido el campo del formulario de categorías que nombra `field` (y lo enfoca). */
  function markField(field) {
    document.querySelectorAll('[data-pr-settings] [aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    var sel = field && field.indexOf('tiers.') === 0 ? '[data-pr-pct="' + field.slice(6) + '"]' : field === 'approx.pct' ? '[data-pr-approx-pct]' : '';
    var el = sel && document.querySelector('[data-pr-settings] ' + sel); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
  /** Guarda los ajustes de precios (PUT /api/settings/pricing) y actualiza el estado. */
  function saveSettings(f) {
    var r = readSettings(f); markField(r.field);
    if (r.error) return say('[data-pr-msg]', r.error);
    var b = document.querySelector('[data-pr-save-settings]'); b.disabled = true;
    ctx.http('PUT', '/api/settings/pricing', r.body).then(function (x) {
      b.disabled = false;
      if (!x.ok) { markField(x.field); return say('[data-pr-msg]', x.error || 'No se pudo guardar'); }
      S.pricing = x.pricing; var w = document.querySelector('[data-pr-when]'); if (w && x.pricing.updated) w.textContent = 'Guardado el ' + new Date(x.pricing.updated.at).toLocaleString('es-ES') + ' por ' + (x.pricing.updated.by || '') + '.';
      say('[data-pr-msg]', 'Guardado. Vale desde ya para los clientes y la web.', true); paintRows();
    });
  }

  // ───────────────────────────────────────── [EDITOR]
  /** Referencias que enseña el editor: las que coinciden con la búsqueda (máx. 40) o, sin búsqueda, las editadas a mano. */
  function matches() {
    var q = S.q.trim().toLowerCase(), refs = Object.keys(TV.items || {}).concat(Object.keys(S.items).filter(function (r) { return !(TV.items && TV.items[r]); }));
    if (!q) return refs.filter(function (r) { return S.items[r] && S.items[r].m; }).slice(0, MAX_ROWS);
    return refs.filter(function (r) { return (r + ' ' + nameOf(r)).toLowerCase().indexOf(q) >= 0; }).slice(0, MAX_ROWS);
  }
  /** Texto de los tramos de un producto: «10:85,5; 50:80». */
  function tiersText(t) { return (t || []).map(function (x) { return Number(x[0]) + ':' + show(x[1]); }).join('; '); }
  /** Texto del aproximado de un producto: vacío (sigue la regla), «no» (nunca) o el número. */
  function approxText(a) { return a === false ? 'no' : typeof a === 'number' ? show(a) : ''; }
  /** Precios de las otras categorías de un producto, para verlos de un vistazo («VIP +5 105 · VIP +10 110 · Normal 115»). */
  function tierLine(p) {
    if (p == null) return '<span class="muted small">sin precio: «Consultar»</span>';
    var c = pcts(); return '<span class="muted small">' + TIERS.map(function (k) { return esc(k[1]) + ' ' + esc(Q.unitMoney(tierPrice(p, c[k[0]]))); }).join(' · ') + '</span>';
  }
  /** Fila del editor de la referencia `ref`: precio VIP, tramos, aproximado, marca «manual» y botones. */
  function rowHtml(ref) {
    var it = S.items[ref] || {}, e = esc(ref);
    return '<tr data-pr-row="' + e + '"><td class="mono">' + e + '</td><td>' + esc(nameOf(ref)) + '<br>' + tierLine(it.p) + '</td>' +
      '<td><input class="qr-n" type="text" inputmode="decimal" data-pr-p value="' + esc(it.p == null ? '' : show(it.p)) + '" placeholder="sin precio" aria-label="Precio VIP de ' + e + '"></td>' +
      '<td><input class="qr-n pr-t" type="text" data-pr-t value="' + esc(tiersText(it.t)) + '" placeholder="10:85; 50:80" aria-label="Tramos de ' + e + '"></td>' +
      '<td><input class="qr-n" type="text" data-pr-a value="' + esc(approxText(it.a)) + '" placeholder="regla" aria-label="Precio aproximado de ' + e + '"></td>' +
      '<td>' + (it.m ? '<span class="tag">manual</span>' : '<span class="muted small">hoja</span>') + '</td>' +
      '<td class="bl-actions"><button class="btn sm" type="button" data-pr-save="' + e + '">Guardar<span class="vh"> ' + e + '</span></button>' + (it.m ? ' <button class="btn sm ghost" type="button" data-pr-release="' + e + '" title="La próxima sincronización de la hoja podrá cambiar este precio">Volver a la hoja<span class="vh"> ' + e + '</span></button>' : '') + '</td></tr>';
  }
  /** Sección «Precios de productos»: buscador y tabla editable. */
  function editorHtml() {
    return '<section class="panel" data-pr-root><h2>Precios de productos</h2><p>Cambia a mano el <strong>precio VIP</strong>, los <strong>tramos por cantidad</strong> («desde 10 uds. a 85 €» se escribe <span class="mono">10:85</span>, separados por «;») o el <strong>precio aproximado</strong> de un producto (vacío = sigue la regla de arriba; «no» = nunca se enseña aproximado). Lo que guardes aquí queda <strong>manual</strong> y la hoja de Drive no lo pisa' + (S.manual ? ' (ahora hay <strong>' + Number(S.manual) + '</strong> productos así)' : '') + '.</p>' +
      '<p class="notice" data-pr-edit-msg hidden role="status"></p>' +
      '<form class="prop-bar" data-pr-bar role="search"><label>Buscar producto<input type="search" data-pr-q placeholder="Referencia o parte del nombre" value="' + esc(S.q) + '"></label></form>' +
      '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th>Precio VIP</th><th>Tramos</th><th>Aprox.</th><th>Origen</th><th><span class="vh">Acciones</span></th></tr></thead><tbody data-pr-rows>' + rowsHtml() + '</tbody></table></div></section>';
  }
  /** Filas del editor según la búsqueda actual (o el aviso de que hay que buscar). */
  function rowsHtml() {
    var list = matches();
    return list.length ? list.map(rowHtml).join('') : '<tr><td colspan="7" class="muted">' + (S.q.trim() ? 'Ningún producto coincide con esa búsqueda.' : 'Escribe una referencia o parte del nombre para buscar un producto. Aquí salen los que ya has editado a mano.') + '</td></tr>';
  }
  /** Repinta las filas del editor (sin tocar el buscador, para no perder el foco). */
  function paintRows() { var n = document.querySelector('[data-pr-rows]'); if (n) n.innerHTML = rowsHtml(); }
  /** Tramos escritos («10:85; 50:80») → [[10,85],[50,80]], o null si no tienen forma válida. */
  function parseTiers(s) {
    s = s.trim(); if (!s) return [];
    var out = [], ok = s.split(/[;\n]+/).every(function (x) { var m = /^\s*(\d+)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(x); if (!m) return false; out.push([Number(m[1]), num(m[2])]); return true; });
    return ok ? out : null;
  }
  /** Guarda los cambios de una fila (PUT /api/prices/items/:ref): solo manda lo que cambió; «p» o «tramos» dejan el producto como manual. */
  function saveRow(ref) {
    var tr = document.querySelector('[data-pr-row="' + ref.replace(/["\\]/g, '\\$&') + '"]'), it = S.items[ref] || {}, body = {};
    var pv = tr.querySelector('[data-pr-p]').value.trim(), tv = tr.querySelector('[data-pr-t]').value, av = tr.querySelector('[data-pr-a]').value.trim();
    if (pv !== (it.p == null ? '' : show(it.p))) {
      var p = pv === '' ? null : num(pv); if (p !== null && !(p > 0)) return say('[data-pr-edit-msg]', 'El precio de ' + ref + ' debe ser un número mayor que 0 (o déjalo vacío para quitárselo).');
      if (p === null && !confirm('¿Quitar el precio de ' + ref + '? Quedará «Consultar» para todos.')) return;
      body.p = p;
    }
    if (tv.trim() !== tiersText(it.t)) { var t = parseTiers(tv); if (t === null) return say('[data-pr-edit-msg]', 'Los tramos de ' + ref + ' se escriben «cantidad:precio» separados por «;», por ejemplo 10:85; 50:80.'); body.t = t; }
    if (av !== approxText(it.a)) { if (av === '') body.a = null; else if (/^(no|-)$/i.test(av)) body.a = false; else { var a = num(av); if (!(a > 0)) return say('[data-pr-edit-msg]', 'El precio aproximado de ' + ref + ' debe ser un número mayor que 0, «no» o vacío.'); body.a = a; } }
    if (!Object.keys(body).length) return say('[data-pr-edit-msg]', 'No has cambiado nada en ' + ref + '.');
    put(ref, body, 'Guardado ' + ref + (body.p !== undefined || body.t !== undefined ? ' (queda manual)' : ''));
  }
  /** Manda un cambio de producto al servidor y repinta su fila con lo que guardó. */
  function put(ref, body, okText) {
    ctx.http('PUT', '/api/prices/items/' + encodeURIComponent(ref), body).then(function (r) {
      if (!r.ok) return say('[data-pr-edit-msg]', r.error || 'No se pudo guardar');
      if (r.item && Object.keys(r.item).length) S.items[ref] = r.item; else delete S.items[ref];
      S.manual = Object.keys(S.items).filter(function (k) { return S.items[k].m; }).length;
      say('[data-pr-edit-msg]', okText, true); paintRows();
    });
  }

  // ───────────────────────────────────────── [EVENTOS]
  /** HTML de las dos secciones (categorías y editor) con los datos del servidor; sección vacía si el servidor es una versión antigua. */
  P.html = function (c) {
    ctx = c;
    return Promise.all([ctx.http('GET', '/api/settings/pricing'), ctx.http('GET', '/api/prices')]).then(function (rs) {
      if (!rs[0].ok || !rs[0].pricing) return '<p class="notice">' + esc(rs[0].error || 'No se pudieron cargar los ajustes de precios') + '</p>';
      S.pricing = rs[0].pricing; S.items = (rs[1].prices && rs[1].prices.items) || {}; S.manual = Number((rs[1].meta || {}).manual_count) || Object.keys(S.items).filter(function (k) { return S.items[k].m; }).length; S.q = '';
      return settingsHtml() + editorHtml();
    });
  };
  /** Engancha los eventos una sola vez (los nodos se repintan, el contenedor del panel no). */
  P.bind = function (root, c) {
    ctx = c; if (bound === root) { paintExamples(); return; } bound = root;
    root.addEventListener('submit', function (e) {
      if (e.target.hasAttribute('data-pr-settings')) { e.preventDefault(); saveSettings(e.target); }
      else if (e.target.hasAttribute('data-pr-bar')) e.preventDefault();                       // Intro en el buscador no recarga la página: la búsqueda ya se hace al escribir
    });
    root.addEventListener('input', function (e) {
      var t = e.target; if (!t.closest || !t.closest('[data-pr-root]')) return;
      if (t.hasAttribute('data-pr-q')) { S.q = t.value; paintRows(); }
      else if (t.hasAttribute('data-pr-pct')) paintExamples();                                 // el ejemplo de 100 € se recalcula al escribir; las filas del editor usan lo guardado
    });
    root.addEventListener('change', function (e) { if (e.target.name === 'anon') paintExamples(); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pr-save],[data-pr-release]'); if (!b) return;
      if (b.hasAttribute('data-pr-save')) saveRow(b.getAttribute('data-pr-save'));
      else { var ref = b.getAttribute('data-pr-release'); put(ref, { manual: false }, ref + ' vuelve a seguir la hoja de Drive'); }
    });
    paintExamples();
  };
})();
