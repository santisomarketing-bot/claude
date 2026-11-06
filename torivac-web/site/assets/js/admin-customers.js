/**
 * [ADMIN-CUSTOMERS] Vista «Clientes» del panel real (manager y Propietario): las cuentas de cliente de Torivac (rol `customer` del API), su CATEGORÍA DE PRECIO y su contraseña.
 * Un cliente entra al panel para revisar SUS presupuestos, crear presupuestos nuevos (hasta 3 al día) y ver los precios de su categoría; no puede editar ni reenviar nada.
 *   · Categorías: VIP (precio base) · VIP +5 · VIP +10 · Normal. Sus porcentajes son un ajuste global (vista Precios), no un precio por producto. Cambiar la categoría vale al instante.
 *   · Alta (nombre, correo, contraseña de al menos 12 caracteres y categoría), cambio de categoría, contraseña nueva (cierra sus sesiones) y baja (sus presupuestos se conservan).
 * El servidor valida todo otra vez y solo deja tocar cuentas de cliente. Todo texto se escapa al pintarlo. Contrato: docs/PRECIOS-Y-CLIENTES.md §5.1.
 *
 *   TV.AdminCustomers.view(ctx) → Promise<string> con el HTML de la vista     TV.AdminCustomers.bind(root, ctx) → engancha los eventos (una sola vez)
 *   ctx = { http(method, path, body), toast(msg), when(iso), render() }
 * Secciones: [UTIL] [VISTA] [EVENTOS]
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var C = (TV.AdminCustomers = {});
  var ctx = null, bound = null, tiers = {};
  var ORDER = ['vip', 'vip5', 'vip10', 'normal'];

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Pone un aviso en [data-cu-msg] (clase `ok` si salió bien); sin texto lo oculta. */
  function say(text, ok) { var n = document.querySelector('[data-cu-msg]'); if (!n) return ctx.toast(text); n.hidden = !text; n.className = 'notice' + (ok ? ' ok' : ''); n.textContent = text; if (text) n.scrollIntoView({ block: 'nearest' }); }
  /** Nombre de una categoría con su porcentaje («VIP +5 (+5 % sobre VIP)»); el VIP es el precio base. */
  function tierName(k) { var t = tiers[k] || { label: k, pct: 0 }; return t.label + (Number(t.pct) ? ' (+' + Number(t.pct) + ' % sobre VIP)' : ' (precio base)'); }
  /** Opciones <option> de las cuatro categorías con `sel` marcada. */
  function tierOptions(sel) { return ORDER.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(tierName(k)) + '</option>'; }).join(''); }

  // ───────────────────────────────────────── [VISTA]
  /** Fila de la tabla de un cliente: categoría editable, contraseña nueva y baja. */
  function rowHtml(c) {
    var e = esc(c.email);
    return '<tr><td>' + esc(c.name) + '</td><td class="mono">' + e + '</td>' +
      '<td><label class="vh" for="cu-t-' + e + '">Categoría de ' + e + '</label><select id="cu-t-' + e + '" data-cu-tier="' + e + '">' + tierOptions(c.tier || 'normal') + '</select></td>' +
      '<td>' + esc(ctx.when(c.created)) + '</td><td>' + esc(c.last_login ? ctx.when(c.last_login) : '—') + '</td>' +
      '<td class="bl-actions"><details class="cu-pw"><summary class="btn sm ghost">Contraseña<span class="vh"> de ' + e + '</span></summary><form class="form" data-cu-pw="' + e + '"><label>Nueva (mín. 12)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><button class="btn sm" type="submit">Guardar</button></form></details> ' +
      '<button class="btn sm ghost" type="button" data-cu-del="' + e + '">Borrar<span class="vh"> ' + e + '</span></button></td></tr>';
  }
  /** Vista Clientes: lista de cuentas con su categoría y formulario de alta. */
  C.view = function (c) {
    ctx = c;
    return ctx.http('GET', '/api/customers').then(function (r) {
      if (!r.ok) return '<h1>Clientes</h1><p class="notice">' + esc(r.error || 'No se pudieron cargar los clientes') + '</p>';
      tiers = r.tiers || {};
      var list = r.customers || [];
      return '<div data-cu-root><h1>Clientes</h1><p class="muted">Las cuentas de cliente entran al panel para <strong>revisar sus presupuestos</strong>, <strong>crear presupuestos nuevos</strong> (hasta 3 al día) y ver <strong>los precios de su categoría</strong>. No pueden editar ni reenviar nada. Los porcentajes de las categorías se cambian en <a href="#precios">Precios</a>.</p>' +
        '<p class="notice" data-cu-msg hidden role="status"></p>' +
        (list.length ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Nombre</th><th>Correo</th><th>Categoría de precio</th><th>Alta</th><th>Último acceso</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + list.map(rowHtml).join('') + '</tbody></table></div>' : '<p class="notice">Todavía no hay clientes. Crea el primero aquí abajo.</p>') +
        '<section class="panel"><h2>Nuevo cliente</h2><form class="form" data-cu-new novalidate><div class="qr-grid"><label class="qr-f">Nombre<input name="name" type="text" required maxlength="120" autocomplete="off"></label><label class="qr-f">Correo<input name="email" type="email" required maxlength="254" autocomplete="off"></label></div>' +
        '<div class="qr-grid"><label class="qr-f">Contraseña (mín. 12)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><label class="qr-f">Categoría de precio<select name="tier">' + tierOptions('normal') + '</select></label></div>' +
        '<p class="qr-bar"><button class="btn" type="submit">Crear cliente</button></p><p class="muted small">Díselo al cliente por un canal seguro: no mandes la contraseña por correo. Al borrar una cuenta se conservan sus presupuestos.</p></form></section></div>';
    });
  };

  // ───────────────────────────────────────── [EVENTOS]
  /** Crea la cuenta del formulario (POST /api/customers) y repinta la vista. */
  function create(f) {
    var body = { name: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value, tier: f.tier.value };
    if (!body.name || !body.email) return say('Escribe el nombre y el correo.');
    if (body.password.length < 12) return say('La contraseña debe tener al menos 12 caracteres.');
    ctx.http('POST', '/api/customers', body).then(function (r) {
      if (!r.ok) return say(r.error || 'No se pudo crear el cliente');
      ctx.toast('Cliente creado: ' + body.email); ctx.render();
    });
  }
  /** Cambia la categoría de un cliente (PUT /api/customers/:correo); si falla, avisa y repinta para no dejar un valor falso en el desplegable. */
  function setTier(sel) {
    var email = sel.getAttribute('data-cu-tier'), tier = sel.value;
    ctx.http('PUT', '/api/customers/' + encodeURIComponent(email), { tier: tier }).then(function (r) {
      if (!r.ok) { say(r.error || 'No se pudo cambiar la categoría'); return ctx.render(); }
      say('Categoría de ' + email + ': ' + (tiers[tier] ? tiers[tier].label : tier) + '. Vale desde ya.', true);
    });
  }
  /** Pone una contraseña nueva a un cliente (POST /api/customers/:correo/password); sus sesiones se cierran. */
  function setPassword(f) {
    var email = f.getAttribute('data-cu-pw'), pw = f.password.value;
    if (pw.length < 12) return say('La contraseña debe tener al menos 12 caracteres.');
    ctx.http('POST', '/api/customers/' + encodeURIComponent(email) + '/password', { password: pw }).then(function (r) {
      if (!r.ok) return say(r.error || 'No se pudo cambiar la contraseña');
      f.reset(); var d = f.closest('details'); if (d) d.open = false;
      say('Contraseña nueva guardada para ' + email + '. Sus sesiones se han cerrado.', true);
    });
  }
  /** Borra la cuenta de un cliente tras confirmarlo (DELETE /api/customers/:correo) y repinta. */
  function remove(email) {
    if (!confirm('¿Borrar la cuenta de ' + email + '? Sus presupuestos se conservan.')) return;
    ctx.http('DELETE', '/api/customers/' + encodeURIComponent(email)).then(function (r) {
      if (!r.ok) return say(r.error || 'No se pudo borrar');
      ctx.toast('Cliente borrado: ' + email); ctx.render();
    });
  }
  /** Engancha los eventos de la vista una sola vez (los nodos se repintan, el contenedor del panel no). */
  C.bind = function (root, c) {
    ctx = c; if (bound === root) return; bound = root;
    root.addEventListener('submit', function (e) {
      if (!e.target.closest('[data-cu-root]')) return;
      if (e.target.hasAttribute('data-cu-new')) { e.preventDefault(); create(e.target); }
      else if (e.target.hasAttribute('data-cu-pw')) { e.preventDefault(); setPassword(e.target); }
    });
    root.addEventListener('change', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-cu-tier')) setTier(e.target); });
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-cu-del]'); if (b) remove(b.getAttribute('data-cu-del')); });
  };
})();
