/**
 * [ADMIN-LIVE] Panel de gestión de Torivac CONECTADO AL WORKER (producción). Mismo aspecto que el demo (admin.css), datos y acciones reales.
 *
 *  Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Usuarios · Estadísticas · Ajustes
 *          cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas
 *  El rol lo decide SIEMPRE el servidor (token firmado); este fichero solo decide qué menús mostrar. Un cliente que llamase a la API de un manager recibiría 403.
 *
 *  Se carga en lugar de admin.js cuando la web se compila con TORIVAC_API (ver site/build.mjs). Sin API, el demo (admin.js) sigue funcionando solo.
 *
 * Secciones: [HTTP] [AUTH] [UTIL] [VIEWS] [PRICES] [AI] [USERS] [PROPOSALS] [ROUTER]
 * Depende de: quote.js (TV.Quote, TV.api, TV.csvParse), pdf.js (TV.makeQuotePdf), SheetJS (XLSX), assets/data/admin-data.js (TV.admin), proposals.js (TV.proposals)
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
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }).then(function (j) { j.status = r.status; if (r.status === 401 && s && path !== '/api/auth/login') { logout(); } return j; }); })
      .catch(function () { return { ok: false, error: 'No hay conexión con el servidor', status: 0 }; });
  }

  // ───────────────────────────────────────── [AUTH] sesión en sessionStorage (se borra al cerrar la pestaña)
  /** Sesión actual {token, email, name, role} o null. El rol del servidor ('client') se muestra como 'cliente'. */
  function session() { try { return JSON.parse(sessionStorage.getItem('tv_live') || 'null'); } catch (e) { return null; } }
  /** Entra con correo y contraseña. Devuelve Promise<string|null>: null si ha ido bien, o el mensaje de error. */
  function login(email, pass) {
    return http('POST', '/api/auth/login', { email: email, password: pass }).then(function (r) {
      if (!r.ok) return r.error || 'No se pudo entrar';
      sessionStorage.setItem('tv_live', JSON.stringify({ token: r.token, email: r.user.email, name: r.user.name, role: r.user.role === 'manager' ? 'manager' : 'cliente' }));
      return null;
    });
  }
  /** Cierra la sesión y vuelve a la pantalla de acceso. */
  function logout() { sessionStorage.removeItem('tv_live'); location.hash = ''; render(); }

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
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  /** Aviso de error del servidor con el mensaje devuelto. */
  function fail(r) { toast('⚠ ' + ((r && r.error) || 'Error')); }

  // ───────────────────────────────────────── [VIEWS] cada vista devuelve Promise<string> (HTML)
  var NAV = {
    manager: [['resumen', 'Resumen', '◧'], ['pedidos', 'Pedidos', '☰'], ['precios', 'Precios', '€'], ['propuestas', 'Propuestas', '✎'], ['contenido', 'Contenido', '▤'], ['usuarios', 'Usuarios', '☺'], ['estadisticas', 'Estadísticas', '◔'], ['ajustes', 'Ajustes', '⚙']],
    cliente: [['presupuestador', 'Presupuestador', '✚'], ['mis', 'Mis presupuestos', '☰'], ['lista', 'Lista de precios', '€'], ['estadisticas', 'Estadísticas', '◔']],
  };
  var V = {};
  var cache = { orders: [] };                       // últimos pedidos cargados (para regenerar su PDF sin volver a pedirlos)

  /** Vista Resumen (manager): con datos del Worker, KPIs, estado de la hoja de precios y sincronización, y los 5 últimos pedidos. */
  V.resumen = function () {
    return Promise.all([http('GET', '/api/orders'), http('GET', '/api/prices'), http('GET', '/api/proposals/state')]).then(function (a) {
      var o = (a[0].orders || []), P = (a[1].prices || {}), meta = a[1].meta || {}, st = (a[2].state || {}), props = TV.proposals || [];
      var pend = props.filter(function (p) { return !st[p.id]; }).length, tot = o.reduce(function (n, x) { return n + (x.total || 0); }, 0);
      return '<h1>Resumen</h1><div class="kpis">' + kpi('Pedidos', o.length) + kpi('Importe pedido', money(tot)) + kpi('Referencias con precio', Object.keys(P.items || {}).length) + kpi('Propuestas pendientes', pend) + '</div>' +
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
      var rows = cache.orders.map(function (x, i) { return '<tr><td class="mono">' + esc(x.number) + '</td><td>' + esc(when(x.at)) + '</td><td>' + esc(x.customer.name || '') + '<br><span class="muted small">' + esc(x.customer.company || '') + ' ' + esc(x.customer.email || '') + '</span></td><td class="num">' + x.lines.length + '</td><td class="num">' + money(x.total) + (x.prices && x.prices.mode !== 'live' ? ' <span class="tag">DEMO</span>' : '') + '</td><td><button class="btn sm ghost" data-pdf="' + i + '">PDF</button></td></tr>'; }).join('');
      return '<h1>' + esc(title) + '</h1>' + (cache.orders.length ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Líneas</th><th>Importe</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><p><button class="btn sm ghost" data-export-orders>Exportar JSON</button></p>' : '<p class="notice">Todavía no hay pedidos.</p>');
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
      var rows = Object.keys(TV.items).filter(function (k) { return P.items[k]; }).slice(0, 600).map(function (k) { var p = P.items[k]; return '<tr><td class="mono">' + esc(TV.items[k].d ? '—' : k) + '</td><td>' + esc(TV.items[k].n.es) + '</td><td class="num">' + esc(Q.unitMoney(p.p)) + '</td><td class="small">' + (p.t || []).map(function (t) { return 'desde ' + t[0] + ' uds. · ' + esc(Q.unitMoney(t[1])); }).join('<br>') + '</td></tr>'; }).join('');
      return '<h1>Lista de precios</h1><p class="muted small">Actualizada ' + esc(when(P.updated_at)) + ' · precios sin IVA</p><div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th>Precio ud.</th><th>Tramos</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  };

  /** Vista Presupuestador (cliente): incrusta la página del presupuesto en un iframe con ?embed=1. */
  V.presupuestador = function () { return Promise.resolve('<h1>Presupuestador</h1><p class="muted">Sube un CSV o Excel con <em>referencia</em> y <em>cantidad</em> (o añade desde el catálogo), revisa con imágenes y exporta el PDF.</p><iframe class="embed-frame" title="Presupuestador" src="../presupuesto/index.html?embed=1"></iframe>'); };

  /** Vista Contenido (manager): estado de traducción por idioma, referencias y etiquetas de voltaje de cada producto. */
  V.contenido = function () {
    var A = (TV.admin && TV.admin.products) || [];
    /** Celda con la insignia del estado de traducción `s` (OK, Parcial, Falta o Sin traducir). */
    var cell = function (s) { return '<td><span class="st st-' + esc(s) + '">' + ({ ok: 'OK', partial: 'Parcial', missing: 'Falta', identical_to_es: 'Sin traducir' }[s] || esc(s)) + '</span></td>'; };
    return Promise.resolve('<h1>Contenido</h1><p class="muted">Estado de cada ficha por idioma, referencias pedibles y etiquetas de voltaje.</p><div class="tbl-wrap"><table class="spec"><thead><tr><th>Producto</th><th>ES</th><th>EN</th><th>FR</th><th>DE</th><th>Refs.</th><th>Voltaje</th><th>PDF</th></tr></thead><tbody>' +
      A.map(function (p) { return '<tr><td>' + esc(p.name) + '<br><span class="muted small">' + esc(p.cat) + '</span></td>' + cell('ok') + cell(p.st.en) + cell(p.st.fr) + cell(p.st.de) + '<td class="num">' + p.variants + '</td><td class="num">' + p.vtags + '</td><td class="num">' + p.pdfs + '</td></tr>'; }).join('') + '</tbody></table></div>');
  };

  /** Vista Estadísticas: tarjetas de las fuentes aún sin conectar (Business Profile, Ads, Search Console, GA4), sin cifras. */
  V.estadisticas = function () {
    var cards = [['Google Business Profile', 'Búsquedas, vistas, llamadas, rutas y reseñas.', 'Business Profile Performance API'], ['Google Ads', 'Inversión, clics, conversiones y CPA.', 'Google Ads API (cuenta de Torivac)'], ['SEO (Search Console)', 'Impresiones, clics, posición media, páginas y consultas.', 'Search Console API'], ['Guías y blog', 'Visitas y conversiones por entrada.', 'Analytics 4 Data API']];
    return Promise.resolve('<h1>Estadísticas</h1><p class="notice">Sin conexión todavía: cada fuente se conecta con las credenciales de Torivac. Este panel no muestra cifras inventadas.</p><div class="cols cols3">' + cards.map(function (c) { return '<section class="panel"><h2>' + esc(c[0]) + '</h2><p>' + esc(c[1]) + '</p><p class="small muted">Fuente: ' + esc(c[2]) + '</p></section>'; }).join('') + '</div>');
  };

  /** Vista Ajustes (manager): datos de la sesión (GET /api/auth/me), dónde se configuran los destinatarios del pedido y, con el API PHP, su autodiagnóstico (GET /api/diag). */
  V.ajustes = function () {
    return Promise.all([http('GET', '/api/auth/me'), http('GET', '/api/diag')]).then(function (a) {
      var r = a[0], dg = a[1] || {}, u = r.user || {};
      var sym = { ok: '✓', warn: '⚠', fail: '✗' };
      var diag = dg.ok && dg.checks ? '<section class="panel"><h2>Diagnóstico del servidor</h2><p class="small ' + (dg.fail ? 'notice' : 'muted') + '">' + (dg.fail ? esc(dg.fail) + ' problema(s) impiden que funcione' : 'Puede funcionar') + (dg.warn ? ' · ' + esc(dg.warn) + ' aviso(s)' : '') + '</p><ul class="diag">' + dg.checks.map(function (c) { return '<li><span aria-hidden="true">' + sym[c.status] + '</span> <span class="vh">' + esc(c.status) + ': </span>' + esc(c.msg) + '</li>'; }).join('') + '</ul></section>' : '';
      return '<h1>Ajustes</h1><section class="panel"><h2>Tu sesión</h2><p>' + esc(u.name || '') + ' · <span class="mono">' + esc(u.sub || u.email || '') + '</span> · ' + esc(u.role || '') + '</p></section><section class="panel"><h2>Destinatarios del pedido</h2><p>Se configuran en el servidor, no en la web: en cPanel, <span class="mono">order_to</span> de <span class="mono">api/config.php</span>; en Cloudflare, la variable <span class="mono">ORDER_TO</span> del Worker. La web pública solo muestra el primero (' + esc(((TV.meta && TV.meta.recipients) || [])[0] || '—') + ') por si falla el envío.</p></section>' + diag;
    });
  };

  // ───────────────────────────────────────── [PRICES] estado, sincronización, subida de Excel/CSV con vista previa
  var draftRows = null;
  /** Vista Precios (manager): estado y sincronización de la hoja, subida de Excel/CSV con vista previa e instrucción a la IA. */
  V.precios = function () {
    return http('GET', '/api/prices').then(function (r) {
      var P = r.prices || { items: {} }, m = r.meta || {};
      return '<h1>Precios</h1><div class="cols"><section class="panel"><h2>Estado</h2><p>Origen: <strong>' + esc(P.source || '—') + '</strong><br>Modo: <strong>' + esc(P.mode || '—') + '</strong> · ' + Object.keys(P.items || {}).length + ' referencias con precio<br>Última actualización: ' + esc(when(P.updated_at)) + '</p>' +
        '<p class="muted small">Última sincronización: ' + esc(when(m.at)) + ' (' + esc(m.reason || '—') + ')</p><p><button class="btn" data-refresh>Actualizar ahora (manual)</button></p><p class="muted small">La hoja de Drive se sincroniza sola cada 24 h; este botón fuerza la sincronización al instante.</p></section>' +
        '<section class="panel"><h2>Subir Excel / CSV</h2><div class="drop" data-drop tabindex="0" role="button"><strong>Arrastra la hoja aquí</strong><br><span class="muted small">.xlsx, .xls o .csv · acepta la plantilla (ref, price, qty2/price2…), una tarifa (Artículo · Descripción · Precio venta) o la exportación de WooCommerce (SKU · Producto · Precio)</span><input type="file" accept=".csv,.xlsx,.xls" hidden data-file></div></section></div>' +
        '<div data-draft></div>' +
        '<section class="panel"><h2>Actualizar con una instrucción</h2><p class="muted small">Escribe qué cambiar, en castellano. La IA <strong>propone</strong> los cambios; ves la vista previa y solo se aplican si confirmas. Ej.: <em>sube un 3 % las resistencias y redondea a 2 decimales</em></p><textarea data-prompt rows="3" placeholder="sube un 3 % las resistencias"></textarea><p><button class="btn" data-run-prompt>Proponer cambios</button></p></section>';
    });
  };
  /** Filas (cabecera + datos) → vista previa de diferencias contra los precios vigentes (el servidor calcula la diferencia; no se aplica nada). */
  function previewUpload(rows, label) {
    draftRows = rows;
    return http('POST', '/api/prices/upload', { rows: rows, dry_run: true }).then(function (r) {
      var box = root.querySelector('[data-draft]'); if (!r.ok) { draftRows = null; box.innerHTML = ''; return fail(r); }
      var d = r.diff;
      /** Filas HTML (máx. 60) de las referencias `arr`, cada una con su producto y la etiqueta `kind`. */
      var list = function (arr, kind) { return arr.slice(0, 60).map(function (k) { return '<tr><td class="mono">' + esc(k) + '</td><td>' + esc(itemName(k)) + '</td><td>' + kind + '</td></tr>'; }).join(''); };
      box.innerHTML = '<section class="panel"><h2>Vista previa · ' + esc(label) + '</h2><p><strong>' + d.changed.length + '</strong> cambian · <strong>' + d.added.length + '</strong> nuevas · <strong>' + d.removed.length + '</strong> sin precio · ' + d.same + ' iguales · ' + r.refs + ' referencias en la hoja</p>' + TV.priceReportHtml(r.report, esc) +
        ((d.changed.length + d.added.length + d.removed.length) ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th></th></tr></thead><tbody>' + list(d.changed, 'cambia') + list(d.added, 'nueva') + list(d.removed, 'sin precio') + '</tbody></table></div>' : '<p class="notice">No hay diferencias.</p>') +
        '<p><label class="small"><input type="checkbox" data-force> Es intencionado aunque desaparezcan muchas referencias o la hoja tenga precios de relleno</label></p><p><button class="btn" data-apply-upload>Aplicar a la web</button> <button class="btn ghost" data-discard>Descartar</button></p></section>';
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
    http('POST', '/api/prices/upload', { rows: draftRows, force: force }).then(function (r) { if (!r.ok) return fail(r); draftRows = null; toast('Precios publicados · ' + r.meta.refs + ' referencias'); render(); });
  }

  // ───────────────────────────────────────── [AI] instrucción en castellano → cambios propuestos → vista previa → aplicar (con confirmación)
  var proposal = null;
  /** Envía la instrucción a la IA (POST /api/prices/ai) y muestra la propuesta de cambios para confirmarla; no aplica nada. */
  function runPrompt(text) {
    var box = root.querySelector('[data-draft]'); box.innerHTML = '<p class="notice">Consultando a la IA…</p>';
    http('POST', '/api/prices/ai', { instruction: text }).then(function (r) {
      if (!r.ok) { box.innerHTML = ''; return fail(r); }
      proposal = r;
      var rows = r.changes.slice(0, 80).map(function (c) { return '<tr' + (c.large ? ' class="warn"' : '') + '><td class="mono">' + esc(c.ref) + '</td><td>' + esc(itemName(c.ref)) + '</td><td class="num">' + (c.old ? esc(Q.unitMoney(c.old.p)) : '—') + '</td><td class="num"><strong>' + esc(Q.unitMoney(c.next.p)) + '</strong></td><td class="num">' + (c.pct == null ? '' : (c.pct > 0 ? '+' : '') + c.pct + ' %') + (c.large ? ' ⚠' : '') + '</td></tr>'; }).join('');
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

  // ───────────────────────────────────────── [PROPOSALS] decisiones sobre propuestas (se guardan en el servidor; aprobar NO publica nada por sí solo)
  var propState = {};
  /** Vista Propuestas (manager): lista las propuestas de cambio con su estado en el servidor para aprobar, rechazar o deshacer. */
  V.propuestas = function () {
    return http('GET', '/api/proposals/state').then(function (r) {
      propState = r.state || {}; var props = TV.proposals || [];
      if (!props.length) return '<h1>Propuestas</h1><p class="notice">No hay propuestas todavía.</p>';
      return '<h1>Propuestas de cambio</h1><p class="muted">Nada de esto está publicado: la web usa el dato original hasta que lo apruebes.</p>' + props.map(function (p) {
        var s = propState[p.id] && propState[p.id].state;
        return '<article class="panel prop' + (s ? ' done' : '') + '"><div class="small muted">' + esc(p.type) + ' · ' + esc(p.product_name || p.product_id || '') + (p.ref ? ' · <span class="mono">' + esc(p.ref) + '</span>' : '') + '</div><h3 aria-level="2">' + esc(p.title || p.field || 'Cambio') + '</h3>' +
          (p.web_value ? '<p class="small"><strong>Web:</strong> ' + esc(p.web_value) + '</p>' : '') + (p.pdf_value ? '<p class="small"><strong>PDF:</strong> ' + esc(p.pdf_value) + '</p>' : '') + (p.recommendation ? '<p class="small muted">' + esc(p.recommendation) + '</p>' : '') +
          (s ? '<p><span class="tag">' + (s === 'ok' ? 'Aprobada (pendiente de publicar)' : 'Rechazada') + '</span> <button class="btn sm ghost" data-prop="' + esc(p.id) + '" data-v="">Deshacer</button></p>' : '<p><button class="btn sm" data-prop="' + esc(p.id) + '" data-v="ok">Aprobar</button> <button class="btn sm ghost" data-prop="' + esc(p.id) + '" data-v="no">Rechazar</button></p>') + '</article>';
      }).join('');
    });
  };

  // ───────────────────────────────────────── [USERS] altas y bajas de usuarios (managers y clientes)
  /** Vista «Usuarios» (manager): lista de usuarios con alta y baja de managers y clientes. */
  V.usuarios = function () {
    return http('GET', '/api/users').then(function (r) {
      var rows = (r.users || []).map(function (u) { return '<tr><td>' + esc(u.name) + '</td><td class="mono">' + esc(u.email) + '</td><td>' + (u.role === 'manager' ? 'Manager' : 'Cliente') + '</td><td>' + esc(when(u.created)) + '</td><td><button class="btn sm ghost" data-del-user="' + esc(u.email) + '">Borrar</button></td></tr>'; }).join('');
      return '<h1>Usuarios</h1><div class="tbl-wrap"><table class="spec"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Alta</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<section class="panel"><h2>Nuevo usuario</h2><form class="form" data-new-user><div class="grid2"><label>Nombre<input name="name" required></label><label>Correo<input name="email" type="email" required></label></div><div class="grid2"><label>Rol<select name="role"><option value="client">Cliente</option><option value="manager">Manager</option></select></label><label>Contraseña (mín. 10)<input name="password" type="password" minlength="10" required autocomplete="new-password"></label></div><p><button class="btn" type="submit">Crear usuario</button></p></form></section>';
    });
  };

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
    else if (b.hasAttribute('data-prop')) { http('POST', '/api/proposals/state', { id: b.getAttribute('data-prop'), state: b.getAttribute('data-v') }).then(function (r) { if (!r.ok) return fail(r); render(); }); }
    else if (b.hasAttribute('data-del-user')) { if (confirm('¿Borrar a ' + b.getAttribute('data-del-user') + '?')) http('DELETE', '/api/users/' + encodeURIComponent(b.getAttribute('data-del-user'))).then(function (r) { if (!r.ok) return fail(r); toast('Usuario borrado'); render(); }); }
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
    var nu = root.querySelector('[data-new-user]');
    if (nu) nu.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target;
      http('POST', '/api/users', { name: f.name.value, email: f.email.value, role: f.role.value, password: f.password.value }).then(function (r) { if (!r.ok) return fail(r); toast('Usuario creado'); render(); });
    });
  }
  var renderSeq = 0;
  /** Pinta la pantalla de acceso o el panel (menú lateral + la vista de la ruta #hash); `renderSeq` descarta la respuesta de una vista si entretanto se pidió otra. */
  function render() {
    var seq = ++renderSeq, s = session(), logo = esc(document.getElementById('logo-src').value);
    if (!s) {
      root.innerHTML = '<main class="login"><form class="panel form" data-login><img src="' + logo + '" alt="Torivac" width="84" height="84" style="background:#100404;padding:10px;margin-bottom:16px;height:84px;width:84px"><h1>Acceso</h1><label>Correo<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="pass" type="password" autocomplete="current-password" required></label><p class="err" data-err hidden role="alert"></p><button class="btn" type="submit">Entrar</button></form></main>';
      root.querySelector('[data-login]').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target, err = root.querySelector('[data-err]'); err.hidden = true;
        login(f.email.value, f.pass.value).then(function (msg) { if (!msg) { location.hash = ''; render(); } else { err.textContent = msg; err.hidden = false; } });
      });
      return;
    }
    var nav = NAV[s.role], cur = (location.hash || '#').slice(1) || nav[0][0]; if (!nav.some(function (n) { return n[0] === cur; })) cur = nav[0][0];
    root.innerHTML = '<div class="shell"><aside class="side"><div class="side-top"><img src="' + logo + '" alt="Torivac" width="88" height="88"><span class="role">' + esc(s.role === 'manager' ? 'Manager' : 'Cliente') + '</span></div><nav aria-label="Panel">' +
      nav.map(function (n) { return '<a href="#' + n[0] + '"' + (n[0] === cur ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + n[2] + '</span>' + esc(n[1]) + '</a>'; }).join('') + '</nav><div class="side-bot"><a href="../index.html">← Ir a la web</a><button class="btn sm ghost" data-logout type="button">Salir (' + esc(s.name || s.email) + ')</button></div></aside><main class="main" id="main"><p class="notice">Cargando…</p></main></div>';
    V[cur](s).then(function (html) { var m = root.querySelector('#main'); if (!m || seq !== renderSeq) return; m.innerHTML = html; bind(); });       // si mientras tanto se pidió otra vista, esta respuesta se ignora
  }
  root.addEventListener('click', onClick);       // una sola vez (los nodos se repintan, el contenedor no)
  window.addEventListener('hashchange', render);
  render();
})();
