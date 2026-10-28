/**
 * [ADMIN-LIVE] Panel de gestión de Torivac CONECTADO AL WORKER (producción). Mismo aspecto que el demo (admin.css), datos y acciones reales.
 *
 *  Roles:  manager → Resumen · Pedidos · Mensajes · Precios · Propuestas · Contenido · Blog · Usuarios · Actividad · Estadísticas · Ajustes
 *          cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas
 *  El rol lo decide SIEMPRE el servidor (token firmado); este fichero solo decide qué menús mostrar. Un cliente que llamase a la API de un manager recibiría 403.
 *  Acceso en dos pasos: con la contraseña buena el servidor puede pedir un código que llega por correo (POST /api/auth/login → {step:'code'}); aquí se pinta esa segunda pantalla y se abre la sesión con POST /api/auth/verify.
 *
 *  Se carga en lugar de admin.js cuando la web se compila con TORIVAC_API (ver site/build.mjs). Sin API, el demo (admin.js) sigue funcionando solo.
 *
 * Secciones: [HTTP] [AUTH] [UTIL] [VIEWS] [PRICES] [AI] [PROPOSALS] [BLOG] [SECURITY] [ROUTER]
 * Depende de: quote.js (TV.Quote, TV.api, TV.csvParse), pdf.js (TV.makeQuotePdf), SheetJS (XLSX), admin-proposals.js (TV.AdminProposals: vista Propuestas), blog-markdown.js y admin-blog.js (TV.BlogMarkdown y TV.AdminBlog: vista Blog), admin-security.js (TV.AdminSecurity: Usuarios, Actividad y los paneles de seguridad de Ajustes). Las propuestas (TV.proposals) y los datos de cobertura (TV.admin) NO van en la web pública: se piden al servidor, solo a managers (GET /api/admin/data).
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, root = document.getElementById('admin-root');
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /** Importe formateado con la divisa y el idioma de la página (Q.money); un valor vacío cuenta como 0. */
  var money = function (n) { return Q.money(n || 0); };

  // ───────────────────────────────────────── [HTTP] llamadas al Worker con el token de la sesión
  /** method + ruta + cuerpo → Promise<{ok, status, …}>. Un 401 cierra la sesión (token caducado). Nunca rechaza: los errores de red vuelven como {ok:false}. */
  function http(method, path, body) {
    var s = session();
    return fetch(TV.api.base() + path, { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, s ? { Authorization: 'Bearer ' + s.token } : {}), body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }).then(function (j) { j.status = r.status; if (r.status === 401 && s && path !== '/api/auth/login') { endSession(); } return j; }); })
      .catch(function () { return { ok: false, error: 'No hay conexión con el servidor', status: 0 }; });
  }

  // ───────────────────────────────────────── [AUTH] sesión en sessionStorage (se borra al cerrar la pestaña)
  /** Sesión actual {token, email, name, role} o null. El rol del servidor ('client') se muestra como 'cliente'. */
  function session() { try { return JSON.parse(sessionStorage.getItem('tv_live') || 'null'); } catch (e) { return null; } }
  /** Segunda pantalla del acceso: null mientras se pide la contraseña; {challenge, hint, days, resendAt} cuando el servidor ha mandado un código por correo y falta escribirlo. Solo en memoria. */
  var pending = null;
  /** Aviso (una sola vez) en la pantalla de acceso: «Contraseña cambiada…», «El código ha caducado…». */
  var loginNote = '';
  /** Guarda la sesión que devuelve el servidor (token y datos de la persona). El rol del servidor ('client') se muestra como 'cliente'. */
  function openSession(r) { sessionStorage.setItem('tv_live', JSON.stringify({ token: r.token, email: r.user.email, name: r.user.name, role: r.user.role === 'manager' ? 'manager' : 'cliente' })); }
  /**
   * Entra con correo y contraseña. Devuelve Promise<string|null>: null si ha ido bien (sesión abierta) o si el servidor pide un código por correo (queda en `pending` y se pinta la pantalla del código), o el mensaje de error.
   */
  function login(email, pass) {
    return http('POST', '/api/auth/login', { email: email, password: pass }).then(function (r) {
      if (r.ok && r.step === 'code' && r.challenge) { pending = { challenge: r.challenge, hint: r.hint || '', days: Number(r.remember_days) || 30, resendAt: Date.now() + (Number(r.resend_after) || 45) * 1000 }; return null; }
      if (!r.ok || !r.token) return r.error || 'No se pudo entrar';
      openSession(r);
      return null;
    });
  }
  /** Comprueba el código escrito (POST /api/auth/verify). Promise<{done}|{back,msg}|{msg}>: sesión abierta · el código ya no sirve (se vuelve a la contraseña con el aviso) · error para mostrar sin salir de la pantalla. */
  function verifyCode(code, remember) {
    return http('POST', '/api/auth/verify', { challenge: pending.challenge, code: code, remember: !!remember }).then(function (r) {
      if (r.ok && r.token) { pending = null; openSession(r); return { done: true }; }
      if (r.status === 410 || r.code === 'expired' || r.code === 'exhausted') { pending = null; return { back: true, msg: r.error || 'El código ya no vale. Entra de nuevo.' }; }
      var left = r.code === 'wrong' && typeof r.left === 'number' ? '. Te quedan ' + r.left + (r.left === 1 ? ' intento.' : ' intentos.') : '';
      return { msg: (r.error || 'No se pudo comprobar el código') + left };
    });
  }
  /** Pide otro código por correo (el anterior deja de valer). Promise<{ok}|{back,msg}|{msg}>. */
  function resendCode() {
    return http('POST', '/api/auth/resend', { challenge: pending.challenge }).then(function (r) {
      if (r.ok) { pending.resendAt = Date.now() + (Number(r.resend_after) || 45) * 1000; return { ok: true }; }
      if (r.status === 410 || r.code === 'expired') { pending = null; return { back: true, msg: r.error || 'El código ha caducado. Entra de nuevo.' }; }
      return { msg: r.error || 'No se pudo reenviar el código' };
    });
  }
  /** Borra la sesión de este navegador y vuelve a la pantalla de acceso (sin avisar al servidor: lo usa también un 401, cuando el servidor ya la ha dado por caducada). */
  function endSession() { sessionStorage.removeItem('tv_live'); pending = null; location.hash = ''; render(); }
  /** Vuelve a la pantalla de acceso con un aviso (tras cambiar la contraseña propia: el servidor ya cerró todas las sesiones). */
  function relogin(msg) { loginNote = msg || ''; endSession(); }
  /** Cierra la sesión: el servidor invalida TODOS los tokens anteriores de esta persona (POST /api/auth/logout; si no responde, igualmente se sale de este navegador). */
  function logout() {
    var s = session(); if (!s) return endSession();
    fetch(TV.api.base() + '/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + s.token } }).catch(function () { /* sin conexión: se sale igual */ }).then(endSession);
  }
  /** Propuestas de cambio y datos de cobertura del catálogo, solo para managers (GET /api/admin/data); se piden una vez y se guardan en TV.proposals y TV.admin. Nunca rechaza. */
  function adminData() {
    if (TV.proposals && TV.admin) return Promise.resolve();
    return http('GET', '/api/admin/data').then(function (r) { TV.proposals = (r.ok && r.proposals) || []; TV.admin = (r.ok && r.admin) || { products: [], byRef: {} }; });
  }

  // ───────────────────────────────────────── [UTIL]
  /** Muestra un aviso breve (3,2 s) en pantalla. */
  function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200); }
  /** HTML de una tarjeta KPI con la etiqueta `l` y el valor `v`, ambos escapados. */
  function kpi(l, v) { return '<div class="kpi"><span>' + esc(l) + '</span><strong>' + esc(v) + '</strong></div>'; }
  /** Nombre legible de una referencia (nombre ES + ref si es un modelo concreto). */
  function itemName(ref) { var it = TV.items[ref]; return it ? (it.n.es + (it.d ? '' : ' · ' + ref)) : ref; }
  /** Fecha y hora local (es-ES) de una fecha ISO; «—» si viene vacía. */
  function when(iso) { return iso ? new Date(iso).toLocaleString('es-ES') : '—'; }
  /** Descarga `blob` como archivo `name` con un enlace temporal y libera la URL a los 800 ms. */
  function download(blob, name) { var a = document.createElement('a'); a.hidden = true; a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  /** Aviso de error del servidor con el mensaje devuelto. */
  function fail(r) { toast('⚠ ' + ((r && r.error) || 'Error')); }

  // ───────────────────────────────────────── [VIEWS] cada vista devuelve Promise<string> (HTML)
  var NAV = {
    manager: [['resumen', 'Resumen', '◧'], ['pedidos', 'Pedidos', '☰'], ['mensajes', 'Mensajes', '✉'], ['precios', 'Precios', '€'], ['propuestas', 'Propuestas', '✎'], ['contenido', 'Contenido', '▤'], ['blog', 'Blog', '✍'], ['usuarios', 'Usuarios', '☺'], ['actividad', 'Actividad', '☷'], ['estadisticas', 'Estadísticas', '◔'], ['ajustes', 'Ajustes', '⚙']],
    cliente: [['presupuestador', 'Presupuestador', '✚'], ['mis', 'Mis presupuestos', '☰'], ['lista', 'Lista de precios', '€'], ['estadisticas', 'Estadísticas', '◔']],
  };
  var V = {};
  var cache = { orders: [] };                       // últimos pedidos cargados (para regenerar su PDF sin volver a pedirlos)

  /** Aviso del Resumen cuando el correo no funciona (sin completar o el último envío falló): los pedidos y mensajes se guardan igual, pero nadie recibe el aviso. '' si todo va bien. */
  function mailWarn(ms) {
    if (!ms.ok) return '';
    var bad = !ms.configured || (ms.last && !ms.last.ok);
    return bad ? '<p class="notice"><strong>El correo no está funcionando.</strong> ' + (!ms.configured ? 'Falta configurar el envío' + (ms.problems && ms.problems.length ? ' (' + ms.problems.map(esc).join(', ') + ')' : '') + '.' : 'El último envío falló' + (ms.last && ms.last.error ? ': ' + esc(ms.last.error) : '') + '.') + ' Los pedidos y los mensajes se guardan igualmente (míralos en Pedidos y Mensajes). <a href="#ajustes">Revisar y enviar una prueba</a></p>' : '';
  }
  /** Vista Resumen (manager): con datos del Worker, KPIs, estado de la hoja de precios y sincronización, y los 5 últimos pedidos. */
  V.resumen = function () {
    return Promise.all([http('GET', '/api/orders'), http('GET', '/api/prices'), http('GET', '/api/proposals/state'), adminData(), http('GET', '/api/mail/status')]).then(function (a) {
      var o = (a[0].orders || []), P = (a[1].prices || {}), meta = a[1].meta || {}, st = (a[2].state || {}), props = TV.proposals || [];
      var pend = props.filter(function (p) { return !st[p.id]; }).length, tot = o.reduce(function (n, x) { return n + (x.total || 0); }, 0);
      return '<h1>Resumen</h1><div class="kpis">' + kpi('Pedidos', o.length) + kpi('Importe pedido', money(tot)) + kpi('Referencias con precio', Object.keys(P.items || {}).length) + kpi('Propuestas pendientes', pend) + '</div>' + mailWarn(a[4] || {}) +
        '<div class="cols"><section class="panel"><h2>Hoja de precios</h2><p>Origen: <strong>' + esc(P.source || '—') + '</strong><br>Modo: <strong>' + esc(P.mode || '—') + '</strong> · actualizada ' + esc(when(P.updated_at)) + '</p>' +
        '<p class="muted small">Última sincronización: ' + esc(when(meta.at)) + ' (' + esc(meta.reason || '—') + ') · ' + esc(meta.changed || 0) + ' cambian, ' + esc(meta.added || 0) + ' nuevas.</p></section>' +
        '<section class="panel"><h2>Últimos pedidos</h2>' + (o.length ? '<ul>' + o.slice(0, 5).map(function (x) { return '<li><span class="mono">' + esc(x.number) + '</span> · ' + esc(x.customer.name) + ' · ' + money(x.total) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Todavía no hay pedidos.</p>') + '</section></div>';
    });
  };

  /** Tabla de pedidos (manager: todos · cliente: solo los suyos, lo filtra el servidor). */
  function ordersView(title) {
    return http('GET', '/api/orders').then(function (r) {
      if (!r.ok) return '<h1>' + esc(title) + '</h1><p class="notice">' + esc(r.error || 'No se pudieron cargar los pedidos') + '</p>';
      cache.orders = r.orders || [];
      var rows = cache.orders.map(function (x, i) { return '<tr><td class="mono">' + esc(x.number) + (x.emailed && !x.emailed.team && (session() || {}).role === 'manager' ? '<br><span class="tag" title="' + esc(x.emailed.error || '') + '">sin aviso por correo</span>' : '') + '</td><td>' + esc(when(x.at)) + '</td><td>' + esc(x.customer.name || '') + '<br><span class="muted small">' + esc(x.customer.company || '') + ' ' + esc(x.customer.email || '') + '</span></td><td class="num">' + x.lines.length + '</td><td class="num">' + money(x.total) + (x.prices && x.prices.mode !== 'live' ? ' <span class="tag">DEMO</span>' : '') + '</td><td><button class="btn sm ghost" data-pdf="' + i + '">PDF</button></td></tr>'; }).join('');
      return '<h1>' + esc(title) + '</h1>' + (cache.orders.length ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Líneas</th><th>Importe</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + rows + '</tbody></table></div><p><button class="btn sm ghost" data-export-orders>Exportar JSON</button></p>' : '<p class="notice">Todavía no hay pedidos.</p>');
    });
  }
  /** Vista Pedidos (manager): tabla de todos los pedidos que devuelve el Worker. */
  V.pedidos = function () { return ordersView('Pedidos'); };
  /** Vista «Mis presupuestos» (cliente): sus propios pedidos; el filtro por usuario lo aplica el servidor. */
  V.mis = function () { return ordersView('Mis presupuestos'); };

  /** Vista Lista de precios (cliente): precios vigentes del Worker, sin IVA, con sus tramos (hasta 600 referencias). */
  V.lista = function () {
    return http('GET', '/api/prices').then(function (r) {
      var P = r.prices || { items: {} };
      var rows = Object.keys(TV.items).filter(function (k) { return P.items[k]; }).slice(0, 600).map(function (k) { var p = P.items[k]; return '<tr><td class="mono">' + esc(TV.items[k].d ? '—' : k) + '</td><td>' + esc(TV.items[k].n.es) + '</td><td class="num">' + esc(Q.unitMoney(p.p)) + '</td><td class="small">' + (p.t || []).map(function (t) { return 'desde ' + Number(t[0]) + ' uds. · ' + esc(Q.unitMoney(t[1])); }).join('<br>') + '</td></tr>'; }).join('');
      return '<h1>Lista de precios</h1><p class="muted small">Actualizada ' + esc(when(P.updated_at)) + ' · precios sin IVA</p><div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th>Precio ud.</th><th>Tramos</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  };

  /** Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1. */
  V.presupuestador = function () { return Promise.resolve('<h1>Presupuestador</h1><p class="muted">Sube un CSV o Excel con <em>referencia</em> y <em>cantidad</em> (o añade desde el catálogo), revisa con imágenes y exporta el PDF.</p><iframe class="embed-frame" title="Presupuestador" src="../presupuesto/index.html?embed=1"></iframe>'); };

  /** Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto. */
  V.contenido = function () { return adminData().then(function () {
    var A = (TV.admin && TV.admin.products) || [];
    /** Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir). */
    var cell = function (s) { return '<td><span class="st st-' + esc(s) + '">' + ({ ok: 'OK', partial: 'Parcial', missing: 'Falta', identical_to_es: 'Sin traducir' }[s] || esc(s)) + '</span></td>'; };
    return Promise.resolve('<h1>Contenido</h1><p class="muted">Estado de cada ficha por idioma, referencias pedibles y etiquetas de voltaje.</p><div class="tbl-wrap"><table class="spec"><thead><tr><th>Producto</th><th>ES</th><th>EN</th><th>FR</th><th>DE</th><th>Refs.</th><th>Voltaje</th><th>PDF</th></tr></thead><tbody>' +
      A.map(function (p) { return '<tr><td>' + esc(p.name) + '<br><span class="muted small">' + esc(p.cat) + '</span></td>' + cell('ok') + cell(p.st.en) + cell(p.st.fr) + cell(p.st.de) + '<td class="num">' + Number(p.variants) + '</td><td class="num">' + Number(p.vtags) + '</td><td class="num">' + Number(p.pdfs) + '</td></tr>'; }).join('') + '</tbody></table></div>');
  }); };

  /** Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras. */
  V.estadisticas = function () {
    var cards = [['Google Business Profile', 'Búsquedas, vistas, llamadas, rutas y reseñas.', 'Business Profile Performance API'], ['Google Ads', 'Inversión, clics, conversiones y CPA.', 'Google Ads API (cuenta de Torivac)'], ['SEO (Search Console)', 'Impresiones, clics, posición media, páginas y consultas.', 'Search Console API'], ['Guías y blog', 'Visitas y conversiones por entrada.', 'Analytics 4 Data API']];
    return Promise.resolve('<h1>Estadísticas</h1><p class="notice">Sin conexión todavía: cada fuente se conecta con las credenciales de Torivac. Este panel no muestra cifras inventadas.</p><div class="cols cols3">' + cards.map(function (c) { return '<section class="panel"><h2>' + esc(c[0]) + '</h2><p>' + esc(c[1]) + '</p><p class="small muted">Fuente: ' + esc(c[2]) + '</p></section>'; }).join('') + '</div>');
  };

  /** Etiqueta con el estado del aviso por correo de un mensaje o de un pedido (emailed.sent / reason; el texto del error solo lo trae el servidor a los gestores). */
  function mailTag(em) {
    em = em || {};
    var txt = { sent: 'Avisado por correo', off: 'Sin correo configurado', failed: 'El aviso por correo falló', skipped: 'Correo sin completar' }[em.reason] || (em.sent ? 'Avisado por correo' : 'Sin aviso por correo');
    return '<span class="tag' + (em.sent ? '' : ' warn') + '" title="' + esc(em.error || '') + '">' + (em.sent ? '✓ ' : '⚠ ') + esc(txt) + '</span>' + (em.error && !em.sent ? '<br><span class="muted small">' + esc(em.error) + '</span>' : '');
  }
  /** Vista Mensajes (manager): los mensajes del formulario de contacto, que el servidor guarda aunque el correo falle, con el estado del aviso por correo y el borrado individual. */
  V.mensajes = function () {
    return http('GET', '/api/messages?limit=200').then(function (r) {
      if (!r.ok) return '<h1>Mensajes</h1><p class="notice">' + esc(r.error || 'No se pudieron cargar los mensajes') + '</p>';
      var items = r.items || [];
      var rows = items.map(function (m) {
        return '<tr><td>' + esc(when(m.at)) + '<br><span class="mono small">' + esc(m.id) + '</span></td><td>' + esc(m.name) + '<br><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></td><td class="msg">' + esc(m.message) + '</td><td>' + mailTag(m.emailed) + '</td><td><button class="btn sm ghost" data-del-msg="' + esc(m.id) + '">Borrar</button></td></tr>';
      }).join('');
      return '<h1>Mensajes</h1><p class="muted small">Lo que escriben los visitantes en los formularios de contacto. Se guardan aquí aunque el correo falle; se borran solos a los 400 días.</p>' +
        (items.length ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Recibido</th><th>De</th><th>Mensaje</th><th>Aviso</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' + (r.truncated ? '<p class="muted small">Se muestran los más recientes; hay más.</p>' : '') : '<p class="muted">Todavía no hay mensajes.</p>');
    });
  };
  /** Panel «Correo» de Ajustes: controlador, si está completo, qué falta, el último intento (también el fallo) y el botón para mandar un correo de prueba. */
  function mailPanel(ms) {
    if (!ms.ok) return '';
    var l = ms.last;
    var last = l ? '<p class="small ' + (l.ok ? 'muted' : 'notice') + '">Último envío: ' + esc(when(l.at)) + ' (' + esc({ contact: 'contacto', order: 'pedido', test: 'prueba', security: 'seguridad' }[l.kind] || l.kind || '') + ') · ' + (l.ok ? 'correcto' : 'falló: ' + esc(l.error || l.reason || '')) + '</p>' : '<p class="muted small">Todavía no se ha enviado ningún correo.</p>';
    return '<section class="panel"><h2>Correo</h2><p>Controlador: <strong>' + esc(ms.driver || 'ninguno') + '</strong> · ' + (ms.configured ? '<span class="tag">✓ completo</span>' : '<span class="tag warn">⚠ incompleto</span>') + '</p>' +
      (ms.problems && ms.problems.length ? '<p class="notice small">Falta configurar: <span class="mono">' + ms.problems.map(esc).join('</span>, <span class="mono">') + '</span></p>' : '') + last +
      '<form class="form" data-mail-test-form><label>Enviar un correo de prueba a<input type="email" name="to" placeholder="tu@correo.com (vacío: a los destinatarios del pedido)" autocomplete="email"></label><p><button class="btn" type="submit">Enviar correo de prueba</button></p><div data-mail-result role="status" aria-live="polite"></div></form></section>';
  }

  /** Vista Ajustes (manager): datos de la sesión (GET /api/auth/me), tu cuenta y las copias de seguridad (admin-security.js), dónde se configuran los destinatarios del pedido y, con el API PHP, su autodiagnóstico (GET /api/diag). */
  V.ajustes = function () {
    return Promise.all([http('GET', '/api/auth/me'), http('GET', '/api/diag'), http('GET', '/api/mail/status')]).then(function (a) {
      return TV.AdminSecurity.settingsPanels(PCTX, (a[0] || {}).user).then(function (sec) { return a.concat([sec]); });
    }).then(function (a) {
      var r = a[0], dg = a[1] || {}, u = r.user || {}, ms = a[2] || {}, sec = a[3] || '';
      var sym = { ok: '✓', warn: '⚠', fail: '✗' };
      var diag = dg.ok && dg.checks ? '<section class="panel"><h2>Diagnóstico del servidor</h2><p class="small ' + (dg.fail ? 'notice' : 'muted') + '">' + (dg.fail ? esc(dg.fail) + ' problema(s) impiden que funcione' : 'Puede funcionar') + (dg.warn ? ' · ' + esc(dg.warn) + ' aviso(s)' : '') + '</p><ul class="diag">' + dg.checks.map(function (c) { return '<li><span aria-hidden="true">' + sym[c.status] + '</span> <span class="vh">' + esc(c.status) + ': </span>' + esc(c.msg) + '</li>'; }).join('') + '</ul></section>' : '';
      return '<h1>Ajustes</h1><section class="panel"><h2>Tu sesión</h2><p>' + esc(u.name || '') + ' · <span class="mono">' + esc(u.sub || u.email || '') + '</span> · ' + esc(u.role || '') + '</p></section>' + sec + mailPanel(ms) + '<section class="panel"><h2>Destinatarios del pedido</h2><p>Se configuran en el servidor, no en la web: en cPanel, <span class="mono">order_to</span> de <span class="mono">api/config.php</span>; en Cloudflare, la variable <span class="mono">ORDER_TO</span> del Worker. La web pública solo muestra el primero (' + esc(((TV.meta && TV.meta.recipients) || [])[0] || '—') + ') por si falla el envío.</p></section>' + diag;
    });
  };

  // ───────────────────────────────────────── [PRICES] estado, sincronización, subida de Excel/CSV con vista previa
  var draftRows = null, draftLabel = '', uploadMode = 'merge';
  /** Selector de lo que hace la hoja subida: actualizar solo lo que trae (por defecto; puede ser una parte del catálogo) o reemplazar toda la lista de precios. */
  function modeBox() {
    return '<fieldset class="mode" data-mode-box><legend class="small">¿Qué hace esta hoja?</legend>' +
      '<label class="small"><input type="radio" name="upmode" value="merge"' + (uploadMode === 'merge' ? ' checked' : '') + '> <strong>Actualizar solo lo que trae</strong> (recomendado). Puede ser una parte del catálogo: cada fila se reconoce por referencia, SKU o ID de producto y solo cambia su precio; lo demás se queda como está.</label>' +
      '<label class="small"><input type="radio" name="upmode" value="replace"' + (uploadMode === 'replace' ? ' checked' : '') + '> <strong>Reemplazar toda la lista</strong>. Lo que no esté en la hoja se queda sin precio («Consultar»).</label></fieldset>';
  }
  /** Vista Precios (manager): estado y sincronización de la hoja, subida de Excel/CSV con vista previa e instrucción a la IA. */
  V.precios = function () {
    return http('GET', '/api/prices').then(function (r) {
      var P = r.prices || { items: {} }, m = r.meta || {};
      return '<h1>Precios</h1><div class="cols"><section class="panel"><h2>Estado</h2><p>Origen: <strong>' + esc(P.source || '—') + '</strong><br>Modo: <strong>' + esc(P.mode || '—') + '</strong> · ' + Object.keys(P.items || {}).length + ' referencias con precio<br>Última actualización: ' + esc(when(P.updated_at)) + '</p>' +
        '<p class="muted small">Última sincronización: ' + esc(when(m.at)) + ' (' + esc(m.reason || '—') + (m.mode ? ' · ' + (m.mode === 'replace' ? 'reemplazó toda la lista' : 'solo lo que traía la hoja') : '') + ')</p><p><button class="btn" data-refresh>Actualizar ahora (manual)</button></p><p class="muted small">La hoja de Drive se sincroniza sola cada 24 h; este botón fuerza la sincronización al instante.</p></section>' +
        '<section class="panel"><h2>Subir Excel / CSV</h2>' + modeBox() + '<div class="drop" data-drop tabindex="0" role="button"><strong>Arrastra la hoja aquí</strong><br><span class="muted small">.xlsx, .xls o .csv · acepta la plantilla (ref, price, qty2/price2…), una tarifa (Artículo · Descripción · Precio venta), la exportación de WooCommerce (SKU · Producto · Precio) o una hoja por ID de producto (ID · Precio)</span><input type="file" accept=".csv,.xlsx,.xls" hidden data-file></div></section></div>' +
        '<div data-draft></div>' +
        '<section class="panel"><h2>Actualizar con una instrucción</h2><p class="muted small">Escribe qué cambiar, en castellano. La IA <strong>propone</strong> los cambios; ves la vista previa y solo se aplican si confirmas. Ej.: <em>sube un 3 % las resistencias y redondea a 2 decimales</em></p><textarea data-prompt rows="3" placeholder="sube un 3 % las resistencias"></textarea><p><button class="btn" data-run-prompt>Proponer cambios</button></p></section>';
    });
  };
  /** Filas (cabecera + datos) → vista previa de diferencias contra los precios vigentes (el servidor calcula la diferencia con el modo elegido; no se aplica nada). */
  function previewUpload(rows, label) {
    draftRows = rows; draftLabel = label;
    return http('POST', '/api/prices/upload', { rows: rows, dry_run: true, mode: uploadMode }).then(function (r) {
      var box = root.querySelector('[data-draft]'); if (!r.ok) { draftRows = null; box.innerHTML = ''; return fail(r); }
      var d = r.diff, merge = r.mode !== 'replace';
      /** Filas HTML (máx. 60) de las referencias `arr`, cada una con su producto y la etiqueta `kind`. */
      var list = function (arr, kind) { return arr.slice(0, 60).map(function (k) { return '<tr><td class="mono">' + esc(k) + '</td><td>' + esc(itemName(k)) + '</td><td>' + kind + '</td></tr>'; }).join(''); };
      var head = '<strong>' + d.changed.length + '</strong> cambian · <strong>' + d.added.length + '</strong> nuevas · <strong>' + d.removed.length + '</strong> ' + (merge ? 'se quedan sin precio' : 'se quedan sin precio porque no están en la hoja') + ' · ' + Number(d.same) + ' iguales' +
        (merge ? ' · <strong>' + Number(r.kept) + '</strong> no vienen en la hoja y se conservan' : '') + ' · ' + Number(r.refs) + ' filas reconocidas · ' + Number(r.total) + ' referencias con precio al terminar';
      var sure = r.needs_force ? '<div class="notice warn"><strong>Para aplicarlo hay que confirmarlo:</strong><ul>' + (r.blockers || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><label class="small"><input type="checkbox" data-force> Es intencionado: aplícalo</label></div>' : '';
      box.innerHTML = '<section class="panel"><h2>Vista previa · ' + esc(label) + '</h2><p>' + head + '</p>' + TV.priceReportHtml(r.report, esc) +
        ((d.changed.length + d.added.length + d.removed.length) ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + list(d.changed, 'cambia') + list(d.added, 'nueva') + list(d.removed, 'sin precio') + '</tbody></table></div>' : '<p class="notice">No hay diferencias.</p>') +
        sure + '<p><button class="btn" data-apply-upload' + (r.needs_force ? ' disabled' : '') + '>Aplicar a la web</button> <button class="btn ghost" data-discard>Descartar</button></p></section>';
      var cb = box.querySelector('[data-force]'); if (cb) cb.addEventListener('change', function () { box.querySelector('[data-apply-upload]').disabled = !cb.checked; });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  /** Lee el archivo subido (Excel o CSV) en el navegador y pide la vista previa. */
  function readUpload(f) {
    var r = new FileReader(), name = f.name;
    /** Pide la vista previa de las filas leídas, etiquetándola con el nombre del archivo. */
    var go = function (rows) { previewUpload(rows, name); };
    if (/\.xlsx?$/i.test(name) && window.XLSX) { r.onload = function () { var wb = XLSX.read(r.result, { type: 'array' }); go(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: true })); }; r.readAsArrayBuffer(f); }
    else { r.onload = function () { go(TV.csvParse(String(r.result))); }; r.readAsText(f); }
  }
  /** Publica la hoja subida (POST /api/prices/upload, con `force` si se marcó la casilla) y repinta; sin borrador no hace nada. */
  function applyUpload() {
    if (!draftRows) return;
    var force = !!(root.querySelector('[data-force]') || {}).checked;
    http('POST', '/api/prices/upload', { rows: draftRows, force: force, mode: uploadMode }).then(function (r) {
      if (!r.ok) return fail(r);
      draftRows = null;
      toast('Precios publicados · ' + Number(r.meta.refs) + ' referencias' + (r.meta.mode === 'merge' ? ' (' + Number(r.meta.changed) + ' cambian, ' + Number(r.meta.added) + ' nuevas, ' + Number(r.meta.kept) + ' conservadas)' : ''));
      render();
    });
  }

  // ───────────────────────────────────────── [AI] instrucción en castellano → cambios propuestos → vista previa → aplicar (con confirmación)
  var proposal = null;
  /** Envía la instrucción a la IA (POST /api/prices/ai) y muestra la propuesta de cambios para confirmarla; no aplica nada. */
  function runPrompt(text) {
    var box = root.querySelector('[data-draft]'); box.innerHTML = '<p class="notice">Consultando a la IA…</p>';
    http('POST', '/api/prices/ai', { instruction: text }).then(function (r) {
      if (!r.ok) { box.innerHTML = ''; return fail(r); }
      proposal = r;
      var rows = r.changes.slice(0, 80).map(function (c) { return '<tr' + (c.large ? ' class="warn"' : '') + '><td class="mono">' + esc(c.ref) + '</td><td>' + esc(itemName(c.ref)) + '</td><td class="num">' + (c.old ? esc(Q.unitMoney(c.old.p)) : '—') + '</td><td class="num"><strong>' + esc(Q.unitMoney(c.next.p)) + '</strong></td><td class="num">' + (c.pct == null ? '' : (c.pct > 0 ? '+' : '') + Number(c.pct) + ' %') + (c.large ? ' ⚠' : '') + '</td></tr>'; }).join('');
      box.innerHTML = '<section class="panel"><h2>Propuesta de la IA</h2><p>' + esc(r.summary) + '</p>' +
        (r.warnings.length ? '<div class="notice"><strong>Revisa:</strong><ul>' + r.warnings.slice(0, 8).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '') +
        (r.rejected.length ? '<p class="muted small">Descartado por no ser válido: ' + r.rejected.slice(0, 6).map(function (x) { return esc(x.ref + ' (' + x.why + ')'); }).join(', ') + '</p>' : '') +
        (r.changes.length ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th>Antes</th><th>Después</th><th>Δ</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="notice">La IA no propone ningún cambio.</p>') +
        (r.large ? '<p><label class="small"><input type="checkbox" data-confirm-large> Confirmo los cambios muy grandes marcados con ⚠</label></p>' : '') +
        (r.changes.length ? '<p><button class="btn" data-apply-ai>Aplicar a la web</button> <button class="btn ghost" data-discard>Descartar</button></p>' : '') + '</section>';
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  /** Aplica la propuesta vigente de la IA (POST /api/prices/ai/apply, confirmando los cambios grandes si se marcó) y repinta. */
  function applyProposal() {
    if (!proposal) return;
    var confirmLarge = !!(root.querySelector('[data-confirm-large]') || {}).checked;
    http('POST', '/api/prices/ai/apply', { changes: proposal.changes, confirm_large: confirmLarge }).then(function (r) { if (!r.ok) return fail(r); proposal = null; toast('Aplicados ' + r.applied + ' cambios de precio'); render(); });
  }

  // ───────────────────────────────────────── [PROPOSALS] propuestas de mejora: se editan, se prueban en la página real y se aplican (admin-proposals.js); aprobar NO publica nada por sí solo
  /** Lo que los módulos del panel (propuestas, blog, seguridad) necesitan de él: llamadas al servidor, avisos, fechas, los datos de gestión, la sesión, repintar la vista y volver a la pantalla de acceso con un aviso. */
  var PCTX = { http: function (m, p, b) { return http(m, p, b); }, toast: function (m) { toast(m); }, when: function (i) { return when(i); }, adminData: function () { return adminData(); }, session: function () { return session(); }, render: function () { render(); }, relogin: function (m) { relogin(m); } };
  /** Vista Propuestas (manager): editar, probar y aplicar cada propuesta de mejora (ver admin-proposals.js). */
  V.propuestas = function () { return TV.AdminProposals.view(PCTX); };

  // ───────────────────────────────────────── [BLOG] entradas del blog: lista y editor con vista previa, SEO, imágenes y traducciones (admin-blog.js); solo con el servidor PHP del hosting
  /** Vista Blog (manager): listado (#blog), entrada nueva (#blog/nueva) o edición (#blog/<id>); `arg` es lo que sigue a «blog/» en la dirección. */
  V.blog = function (s, arg) { return TV.AdminBlog.view(PCTX, arg || ''); };

  // ───────────────────────────────────────── [SECURITY] usuarios (con su código por correo, bloqueos y contraseñas), actividad del panel y, en Ajustes, tu cuenta y las copias de seguridad (admin-security.js)
  /** Vista «Usuarios» (manager): lista con último acceso, código por correo y bloqueos, alta, baja y contraseña nueva a una cuenta. */
  V.usuarios = function () { return TV.AdminSecurity.usersView(PCTX); };
  /** Vista «Actividad» (manager): quién entró y quién cambió qué, con filtros y descarga en CSV. */
  V.actividad = function () { return TV.AdminSecurity.activityView(PCTX); };

  // ───────────────────────────────────────── [ROUTER]
  /** Manejador único de clics del panel (delegación de eventos): salir, sincronizar precios, aplicar o descartar cambios, propuestas, usuarios y PDF. */
  function onClick(e) {
    var b = e.target.closest('button,a'); if (!b) return;
    if (b.hasAttribute('data-logout')) logout();
    else if (b.hasAttribute('data-refresh')) { b.disabled = true; http('POST', '/api/prices/refresh').then(function (r) { if (!r.ok) { b.disabled = false; return fail(r); } toast('Precios sincronizados · ' + r.meta.refs + ' referencias'); render(); }); }
    else if (b.hasAttribute('data-run-prompt')) runPrompt(root.querySelector('[data-prompt]').value);
    else if (b.hasAttribute('data-apply-ai')) applyProposal();
    else if (b.hasAttribute('data-apply-upload')) applyUpload();
    else if (b.hasAttribute('data-discard')) { draftRows = null; proposal = null; root.querySelector('[data-draft]').innerHTML = ''; }
    else if (b.hasAttribute('data-del-msg')) { if (confirm('¿Borrar este mensaje? No se puede deshacer.')) http('DELETE', '/api/messages/' + encodeURIComponent(b.getAttribute('data-del-msg'))).then(function (r) { if (!r.ok) return fail(r); toast('Mensaje borrado'); render(); }); }
    else if (b.hasAttribute('data-export-orders')) download(new Blob([JSON.stringify(cache.orders, null, 1)], { type: 'application/json' }), 'pedidos.json');
    else if (b.hasAttribute('data-pdf')) {
      var o = cache.orders[+b.getAttribute('data-pdf')]; if (!o) return;
      var det = { lines: o.lines.map(function (l) { var it = TV.items[l.ref] || {}; return { ref: l.ref, qty: l.qty, item: it, name: (it.n && it.n.es) || l.ref, spec: it.v || '', generic: !!it.d, unit: l.unit, total: l.total }; }), total: o.total, unpriced: o.lines.filter(function (l) { return l.total == null; }).length };
      var res = TV.makeQuotePdf({ customer: o.customer, number: o.number, detail: det, date: o.at }); download(res.blob(), res.filename);
    }
  }
  /** Eventos de la vista Precios (subida por arrastre) y del formulario de usuarios; se enlazan tras pintar cada vista. */
  function bind() {
    var drop = root.querySelector('[data-drop]'), file = root.querySelector('[data-file]');
    if (drop) {
      drop.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () { if (file.files[0]) readUpload(file.files[0]); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (x) { x.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (x) { x.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (x) { if (x.dataTransfer.files[0]) readUpload(x.dataTransfer.files[0]); });
    }
    var mb = root.querySelector('[data-mode-box]');
    if (mb) mb.addEventListener('change', function (e) { if (e.target.name !== 'upmode') return; uploadMode = e.target.value; if (draftRows) previewUpload(draftRows, draftLabel); });
    var mt = root.querySelector('[data-mail-test-form]');
    if (mt) mt.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, out = f.querySelector('[data-mail-result]'), btn = f.querySelector('button[type=submit]');
      btn.disabled = true; out.className = ''; out.textContent = 'Enviando…';
      http('POST', '/api/mail/test', f.to.value.trim() ? { to: f.to.value.trim() } : {}).then(function (r) {
        btn.disabled = false;
        if (r.sent === undefined) { out.className = 'notice'; out.textContent = '⚠ ' + (r.error || 'No se pudo enviar la prueba'); return; }
        var to = (r.to || []).join(', ');
        out.className = r.sent ? 'notice ok' : 'notice';
        out.textContent = r.sent ? '✓ Enviado a ' + to + ' con «' + (r.driver || '') + '». Si no llega en unos minutos, mira el spam y el SPF/DKIM del dominio.' : '✗ No se envió (' + (r.reason || 'error') + ')' + (r.error ? ': ' + r.error : '') + '.';
      });
    });
    if (root.querySelector('[data-pa-list]')) TV.AdminProposals.bind(root, PCTX);
    if (root.querySelector('[data-bl-root]')) TV.AdminBlog.bind(root, PCTX);
    if (root.querySelector('[data-sec-root],[data-sec-account]')) TV.AdminSecurity.bind(root, PCTX);
  }
  /** Logotipo de las pantallas de acceso (el mismo que el menú, sobre fondo oscuro). */
  function loginLogo() { return '<img src="' + esc(document.getElementById('logo-src').value) + '" alt="Torivac" width="84" height="84" style="background:#100404;padding:10px;margin-bottom:16px;height:84px;width:84px">'; }
  /** Muestra un error en el párrafo [data-err] de la pantalla de acceso (role=alert: lo anuncia el lector de pantalla). */
  function loginError(msg) { var err = root.querySelector('[data-err]'); err.textContent = msg; err.hidden = false; }
  /** Pantalla de acceso, primer paso: correo y contraseña. Si el servidor pide un código por correo, `login` deja el reto en `pending` y se repinta con la segunda pantalla. */
  function renderLogin() {
    var note = loginNote;                                // se queda hasta que la persona vuelva a entrar: un repintado (p. ej. por el cambio de #) no lo borra
    root.innerHTML = '<main class="login"><form class="panel form" data-login>' + loginLogo() + '<h1>Acceso</h1>' + (note ? '<p class="notice" role="status">' + esc(note) + '</p>' : '') + '<label>Correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="pass" type="password" autocomplete="current-password" required></label><p class="err" data-err hidden role="alert"></p><button class="btn" type="submit">Entrar</button></form></main>';
    root.querySelector('[data-login]').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, btn = f.querySelector('button[type=submit]'); root.querySelector('[data-err]').hidden = true; btn.disabled = true; loginNote = '';
      login(f.email.value, f.pass.value).then(function (msg) { if (!msg) { location.hash = ''; render(); } else { btn.disabled = false; loginError(msg); } });
    });
  }
  /** Segundo paso del acceso: el código de 6 cifras que llegó por correo, «recordar este dispositivo», «Reenviar» (con la espera que marca el servidor) y «Volver». */
  function renderCode() {
    var p = pending;
    root.innerHTML = '<main class="login"><form class="panel form" data-code-form novalidate>' + loginLogo() + '<h1>Código de verificación</h1>' +
      '<p>Te hemos mandado un código de 6 cifras a <strong class="mono">' + esc(p.hint) + '</strong>. Escríbelo aquí: caduca en 10 minutos y solo vale una vez.</p>' +
      '<label>Código<input name="code" type="text" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="12" required></label>' +
      '<label class="check"><input type="checkbox" name="remember" checked><span>Recordar este dispositivo ' + Number(p.days) + ' días <span class="muted small">(desmárcalo si es un ordenador compartido)</span></span></label>' +
      '<p class="err" data-err hidden role="alert"></p><button class="btn" type="submit">Entrar</button>' +
      '<p class="login-alt"><button class="btn sm ghost" type="button" data-code-resend></button> <button class="btn sm ghost" type="button" data-code-back>Volver</button></p></form></main>';
    var f = root.querySelector('[data-code-form]'), rs = f.querySelector('[data-code-resend]'), submit = f.querySelector('button[type=submit]');
    /** Pone en el botón de reenviar la espera que falta (o lo activa); se detiene solo cuando la pantalla se repinta. */
    var tick = function () {
      if (!document.body.contains(rs) || !pending) return clearInterval(renderCode._t);
      var left = Math.ceil((pending.resendAt - Date.now()) / 1000);
      rs.disabled = left > 0; rs.textContent = left > 0 ? 'Reenviar el código (' + left + ' s)' : 'Reenviar el código';
      if (left <= 0) clearInterval(renderCode._t);
    };
    clearInterval(renderCode._t); renderCode._t = setInterval(tick, 1000); tick();
    /** Vuelve a la primera pantalla (con un aviso, si lo hay). */
    var back = function (msg) { pending = null; loginNote = msg || ''; render(); };
    f.addEventListener('submit', function (e) {
      e.preventDefault(); root.querySelector('[data-err]').hidden = true; submit.disabled = true;
      verifyCode(f.code.value, f.remember.checked).then(function (r) {
        if (r.done) { location.hash = ''; return render(); }
        if (r.back) return back(r.msg);
        submit.disabled = false; loginError(r.msg); f.code.select();
      });
    });
    rs.addEventListener('click', function () {
      rs.disabled = true;
      resendCode().then(function (r) {
        if (r.back) return back(r.msg);
        if (r.msg) { loginError(r.msg); return tick(); }
        root.querySelector('[data-err]').hidden = true; toast('Código reenviado'); clearInterval(renderCode._t); renderCode._t = setInterval(tick, 1000); tick(); f.code.focus();
      });
    });
    f.querySelector('[data-code-back]').addEventListener('click', function () { back(''); });
    f.code.focus();
  }

  var renderSeq = 0;
  /** Pinta la pantalla de acceso (contraseña, o el código por correo si falta) o el panel (menú lateral + la vista de la ruta #hash); `renderSeq` descarta la respuesta de una vista si entretanto se pidió otra. */
  function render() {
    var seq = ++renderSeq, s = session(), logo = esc(document.getElementById('logo-src').value);
    if (!s) { if (pending) renderCode(); else renderLogin(); return; }
    var nav = NAV[s.role], raw = (location.hash || '#').slice(1) || nav[0][0], cur = raw.split('/')[0], arg = raw.slice(cur.length + 1); if (!nav.some(function (n) { return n[0] === cur; })) { cur = nav[0][0]; arg = ''; }
    root.innerHTML = '<div class="shell"><aside class="side"><div class="side-top"><img src="' + logo + '" alt="Torivac" width="88" height="88"><span class="role">' + esc(s.role === 'manager' ? 'Manager' : 'Cliente') + '</span></div><nav aria-label="Panel">' +
      nav.map(function (n) { return '<a href="#' + n[0] + '"' + (n[0] === cur ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + n[2] + '</span>' + esc(n[1]) + '</a>'; }).join('') + '</nav><div class="side-bot"><a href="../index.html">← Ir a la web</a><button class="btn sm ghost" data-logout type="button">Salir (' + esc(s.name || s.email) + ')</button></div></aside><main class="main" id="main"><p class="notice">Cargando…</p></main></div>';
    V[cur](s, arg).then(function (html) { var m = root.querySelector('#main'); if (!m || seq !== renderSeq) return; m.innerHTML = html; bind(); });       // si mientras tanto se pidió otra vista, esta respuesta se ignora
  }
  root.addEventListener('click', onClick);       // una sola vez (los nodos se repintan, el contenedor no)
  window.addEventListener('hashchange', render);
  render();
})();
