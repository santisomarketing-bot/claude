/**
 * [ADMIN-CUSTOMERS] Vista «Clientes» del panel real (manager y Propietario): las cuentas de cliente de Torivac (rol `customer` del API), su CATEGORÍA DE PRECIO y su contraseña.
 * Un cliente entra al panel para revisar SUS presupuestos, crear presupuestos nuevos (hasta 3 al día) y ver los precios de su categoría; no puede editar ni reenviar nada.
 *   · Categorías: VIP (precio base) · VIP +5 · VIP +10 · Normal. Sus porcentajes son un ajuste global (vista Precios), no un precio por producto. Cambiar la categoría vale al instante.
 *   · Alta (nombre, correo, contraseña de al menos 12 caracteres y categoría), cambio de categoría, contraseña nueva (cierra sus sesiones) y baja (sus presupuestos se conservan).
 *   · Solicitantes sin cuenta: quien pide un presupuesto o escribe por Contacto sin tener cuenta queda en Presupuestos recibidos y Mensajes, pero NO como cliente (las cuentas se crean a mano, con su contraseña y su
 *     categoría). Aquí se listan esas personas y «Crear cuenta» pasa sus datos al formulario; «Generar» propone una contraseña segura (se muestra una sola vez). También se llega desde un presupuesto o un mensaje
 *     con #clientes/crear/<correo>.
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
  var ctx = null, bound = null, tiers = {}, contacts = {}, accounts = {};
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

  /** Contraseña aleatoria de 16 caracteres (sin letras que se confunden: 0/O, 1/l/I) con crypto.getRandomValues y sin sesgo; cumple las reglas del servidor (≥ 12, más de 4 caracteres distintos). */
  function genPassword() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', out = '', buf = new Uint8Array(1), lim = 256 - (256 % A.length);
    while (out.length < 16) { crypto.getRandomValues(buf); if (buf[0] < lim) out += A.charAt(buf[0] % A.length); }
    return out;
  }
  /** Personas que pidieron presupuesto (sin cuenta) o escribieron por Contacto y todavía no son cliente → { correo: { name, company, phone, orders, messages, last } }, y rellena `contacts`. */
  function buildContacts(orders, messages, list) {
    var have = {}, out = {};
    list.forEach(function (u) { have[String(u.email || '').toLowerCase()] = 1; });
    accounts = have;
    /** Suma un contacto (pedido o mensaje) a la persona con ese correo, si todavía no es cliente; guarda el primer nombre, empresa y teléfono que vea y el contacto más reciente. */
    function add(email, name, company, phone, at, kind) {
      var k = String(email || '').toLowerCase().trim(); if (!k || have[k]) return;
      var x = out[k] = out[k] || { email: k, name: '', company: '', phone: '', orders: 0, messages: 0, last: '' };
      if (!x.name && name) x.name = name; if (!x.company && company) x.company = company; if (!x.phone && phone) x.phone = phone;
      x[kind]++; if (String(at || '') > x.last) x.last = String(at || '');
    }
    (orders || []).forEach(function (o) { if (!o.owner && o.customer) add(o.customer.email, o.customer.name, o.customer.company, o.customer.phone, o.at, 'orders'); });
    (messages || []).forEach(function (m) { add(m.email, m.name, '', '', m.at, 'messages'); });
    contacts = out; return out;
  }
  /** Tabla «Solicitantes sin cuenta» (los 50 más recientes) con el botón «Crear cuenta» de cada uno. */
  function contactsHtml() {
    var list = Object.keys(contacts).map(function (k) { return contacts[k]; }).sort(function (a, b) { return String(b.last).localeCompare(String(a.last)); });
    var rows = list.slice(0, 50).map(function (x) {
      var e = esc(x.email);
      return '<tr><td>' + esc(x.company || x.name) + (x.company && x.name ? '<br><span class="muted small">' + esc(x.name) + '</span>' : '') + '</td><td class="mono">' + e + '</td><td>' + esc(x.phone || '—') + '</td><td class="num">' + x.orders + '</td><td class="num">' + x.messages + '</td><td class="small">' + esc(x.last ? ctx.when(x.last) : '—') + '</td>' +
        '<td class="bl-actions"><button class="btn sm ghost" type="button" data-cu-from="' + e + '">Crear cuenta<span class="vh"> para ' + e + '</span></button></td></tr>';
    }).join('');
    return '<section class="panel"><h2>Solicitantes sin cuenta (' + list.length + ')</h2><p class="muted small">Quien pide un presupuesto o escribe por Contacto <strong>sin tener cuenta</strong> aparece en Presupuestos recibidos y en Mensajes, pero no queda como cliente: las cuentas se crean a mano, con su contraseña y su categoría de precio. «Crear cuenta» pasa sus datos al formulario de abajo.</p>' +
      (list.length ? '<div class="tbl-wrap"><table class="spec" data-cu-contacts><thead><tr><th>Quién</th><th>Correo</th><th>Teléfono</th><th>Pedidos</th><th>Mensajes</th><th>Último contacto</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' + (list.length > 50 ? '<p class="muted small">Se muestran los 50 más recientes.</p>' : '') : '<p class="muted">Ahora mismo todas las personas que han pedido o escrito ya tienen cuenta.</p>') + '</section>';
  }

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
  /** Vista Clientes: lista de cuentas con su categoría, solicitantes sin cuenta y formulario de alta. `arg` = «crear/<correo>» abre el formulario con los datos de esa persona. */
  C.view = function (c, arg) {
    ctx = c;
    var pre = /^crear\/(.+)$/.exec(String(arg || '')), want = ''; try { want = pre ? decodeURIComponent(pre[1]).toLowerCase() : ''; } catch (e) { want = ''; }
    return Promise.all([ctx.http('GET', '/api/customers'), ctx.http('GET', '/api/orders'), ctx.http('GET', '/api/messages?limit=200')]).then(function (all) {
      var r = all[0];
      if (!r.ok) return '<h1>Clientes</h1><p class="notice">' + esc(r.error || 'No se pudieron cargar los clientes') + '</p>';
      tiers = r.tiers || {};
      var list = r.customers || [];
      buildContacts(all[1] && all[1].ok ? all[1].orders : [], all[2] && all[2].ok ? all[2].items : [], list);
      return '<div data-cu-root' + (want ? ' data-cu-prefill="' + esc(want) + '"' : '') + '><h1>Clientes</h1><p class="muted">Las cuentas de cliente entran al panel para <strong>revisar sus presupuestos</strong>, <strong>crear presupuestos nuevos</strong> (hasta 3 al día) y ver <strong>los precios de su categoría</strong>. No pueden editar ni reenviar nada. Los porcentajes de las categorías se cambian en <a href="#precios">Precios</a>.</p>' +
        '<p class="notice" data-cu-msg hidden role="status"></p>' +
        (list.length ? '<div class="tbl-wrap"><table class="spec" data-cu-accounts><thead><tr><th>Nombre</th><th>Correo</th><th>Categoría de precio</th><th>Alta</th><th>Último acceso</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + list.map(rowHtml).join('') + '</tbody></table></div>' : '<p class="notice">Todavía no hay clientes. Crea el primero aquí abajo.</p>') +
        contactsHtml() +
        '<section class="panel" id="cu-nuevo"><h2>Nuevo cliente</h2><form class="form" data-cu-new novalidate><div class="qr-grid"><label class="qr-f">Nombre<input name="name" type="text" required maxlength="120" autocomplete="off"></label><label class="qr-f">Correo<input name="email" type="email" required maxlength="254" autocomplete="off"></label></div>' +
        '<div class="qr-grid"><label class="qr-f">Contraseña (mín. 12) <button class="btn sm ghost" type="button" data-cu-gen>Generar una segura</button><input name="password" type="password" minlength="12" required autocomplete="new-password"></label><label class="qr-f">Categoría de precio<select name="tier">' + tierOptions('normal') + '</select></label></div>' +
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
  /** Pasa los datos de un solicitante al formulario «Nuevo cliente» (nombre o empresa y correo), avisa si ya tiene cuenta y lleva el foco a la contraseña. */
  function prefill(email) {
    var f = document.querySelector('[data-cu-new]'), x = contacts[email], k = String(email || '').toLowerCase(); if (!f) return;
    f.name.value = x ? (x.company || x.name || '') : ''; f.email.value = email;
    if (accounts[k]) say('Esa persona ya tiene cuenta de cliente (' + email + '): cámbiale la categoría o la contraseña en la tabla de arriba.');
    var sec = document.getElementById('cu-nuevo'); if (sec) sec.scrollIntoView({ block: 'start' });
    f.password.focus();
  }
  /** Rellena la contraseña con una aleatoria, la muestra en claro para poder copiarla y avisa de que no se vuelve a ver. */
  function generate(f) {
    var pw = genPassword(); f.password.type = 'text'; f.password.value = pw; f.password.select();
    say('Contraseña generada: cópiala ahora y pásasela al cliente por un canal seguro (no se vuelve a mostrar).', true);
  }
  /** Engancha los eventos de la vista una sola vez (los nodos se repintan, el contenedor del panel no). */
  C.bind = function (root, c) {
    ctx = c;
    var pre = root.querySelector('[data-cu-root][data-cu-prefill]'); if (pre) { var em = pre.getAttribute('data-cu-prefill'); pre.removeAttribute('data-cu-prefill'); prefill(em); }          // llegada desde un presupuesto o un mensaje: #clientes/crear/<correo>
    if (bound === root) return; bound = root;
    root.addEventListener('submit', function (e) {
      if (!e.target.closest('[data-cu-root]')) return;
      if (e.target.hasAttribute('data-cu-new')) { e.preventDefault(); create(e.target); }
      else if (e.target.hasAttribute('data-cu-pw')) { e.preventDefault(); setPassword(e.target); }
    });
    root.addEventListener('change', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-cu-tier')) setTier(e.target); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cu-del],[data-cu-from],[data-cu-gen]'); if (!b || !b.closest('[data-cu-root]')) return;
      if (b.hasAttribute('data-cu-del')) remove(b.getAttribute('data-cu-del'));
      else if (b.hasAttribute('data-cu-from')) prefill(b.getAttribute('data-cu-from'));
      else generate(b.closest('form'));
    });
  };
})();
