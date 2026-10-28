/**
 * [ADMIN] Panel de gestión de Torivac (DEMO sin servidor): login con dos roles, menú lateral y vistas.
 *
 *  Roles:  manager → Resumen · Pedidos · Precios · Propuestas · Contenido · Estadísticas · Ajustes
 *          cliente → Presupuestador · Mis presupuestos · Lista de precios · Estadísticas
 *
 * ⚠ DEMO: el login es SOLO de demostración (credenciales en este fichero, sesión en sessionStorage). En producción (Sesión 7) el login
 *   lo resuelve un Worker (PBKDF2 + cookie HMAC, como whynot-sites/workers/admin) y los datos viven en un backend, no en localStorage.
 *
 * Secciones: [AUTH] [UTIL] [VIEWS] [PRICES] [PROMPT] [ROUTER]
 * Depende de: quote.js (TV.Quote, TV.prices), pdf.js (TV.makeQuotePdf), SheetJS (XLSX), assets/data/admin-data.js (TV.admin), proposals.js (TV.proposals)
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote;
  var root = document.getElementById('admin-root');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return Q.money(n || 0); };
  var ls = { get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignorar */ } }, del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignorar */ } } };

  // ───────────────────────────────────────── [AUTH] (DEMO)
  var USERS = [
    { email: 'manager@torivac.demo', pass: 'Torivac-Manager-2026', role: 'manager', name: 'Manager (demo)' },
    { email: 'cliente@torivac.demo', pass: 'Torivac-Cliente-2026', role: 'cliente', name: 'Cliente (demo)' },
  ];
  function session() { try { return JSON.parse(sessionStorage.getItem('tv_session') || 'null'); } catch (e) { return null; } }
  function login(email, pass) { var u = USERS.filter(function (x) { return x.email === String(email).trim().toLowerCase() && x.pass === pass; })[0]; if (!u) return null; sessionStorage.setItem('tv_session', JSON.stringify({ email: u.email, role: u.role, name: u.name })); return u; }
  function logout() { sessionStorage.removeItem('tv_session'); location.hash = ''; render(); }

  // ───────────────────────────────────────── [UTIL]
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function stem(w) { return w.length > 4 ? w.replace(/(es|s)$/, '') : w; }
  function csvParse(text) { return TV.csvParse(text); }
  function pnum(x) { if (x == null || x === '') return null; var s = String(x).replace(/\s| /g, ''); s = (s.indexOf(',') >= 0 && s.indexOf('.') < 0) ? s.replace(',', '.') : s.replace(/,/g, ''); var n = parseFloat(s); return isNaN(n) ? null : n; }
  var lastReport = null;
  /** Hoja → precios con las MISMAS reglas que el servidor (TV.PriceSheet = shared/price-sheet.mjs): cabeceras tolerantes, SKU, referencias nuevas por regla, avisos. */
  function rowsToPrices(rows, source) {
    var lines = {}; Object.keys(TV.items).forEach(function (r) { lines[r] = { n: TV.items[r].n.es, pid: TV.items[r].pid }; });
    var rd = TV.PriceSheet.readSheet(rows, { lines: lines, skus: (TV.sheet || {}).skus, rules: (TV.sheet || {}).rules });
    lastReport = rd;
    return { updated_at: new Date().toISOString(), source: source, currency: 'EUR', mode: 'live', items: rd.items };
  }
  function diffPrices(a, b) {
    var out = { added: [], changed: [], removed: [], same: 0 };
    Object.keys(b.items).forEach(function (k) { var x = a.items[k], y = b.items[k]; if (!x) out.added.push([k, null, y.p]); else if (x.p !== y.p || JSON.stringify(x.t || []) !== JSON.stringify(y.t || [])) out.changed.push([k, x.p, y.p]); else out.same++; });
    Object.keys(a.items).forEach(function (k) { if (!b.items[k]) out.removed.push([k, a.items[k].p, null]); });
    return out;
  }
  function itemName(ref) { var it = TV.items[ref]; return it ? (it.n.es + (it.d ? '' : ' · ' + ref)) : ref; }
  function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  function orders() { return ls.get('tv_orders', []); }

  // ───────────────────────────────────────── [VIEWS]
  var NAV = {
    manager: [['resumen', 'Resumen', '◧'], ['pedidos', 'Pedidos', '☰'], ['precios', 'Precios', '€'], ['propuestas', 'Propuestas', '✎'], ['contenido', 'Contenido', '▤'], ['estadisticas', 'Estadísticas', '◔'], ['ajustes', 'Ajustes', '⚙']],
    cliente: [['presupuestador', 'Presupuestador', '✚'], ['mis', 'Mis presupuestos', '☰'], ['lista', 'Lista de precios', '€'], ['estadisticas', 'Estadísticas', '◔']],
  };
  var V = {};

  V.resumen = function () {
    var o = orders(), P = TV.prices || {}, props = (TV.proposals || []), st = ls.get('tv_proposals_state', {}), pend = props.filter(function (p) { return !st[p.id]; }).length;
    var tot = o.reduce(function (n, x) { return n + (x.total || 0); }, 0), msgs = ls.get('tv_messages', []).length;
    var top = {}; o.forEach(function (x) { x.lines.forEach(function (l) { top[l.ref] = (top[l.ref] || 0) + l.qty; }); });
    var tops = Object.keys(top).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 5);
    var ov = !!ls.get('tv_prices_override', null);
    return '<h1>Resumen</h1><div class="kpis">' + kpi('Pedidos (demo)', o.length) + kpi('Importe pedido', money(tot)) + kpi('Mensajes de contacto', msgs) + kpi('Propuestas pendientes', pend) + kpi('Referencias con precio', Object.keys(P.items || {}).length) + '</div>' +
      '<div class="cols"><section class="panel"><h2>Hoja de precios</h2><p>Origen: <strong>' + esc(P.source || '—') + '</strong>' + (ov ? ' <span class="tag">cargada desde el panel</span>' : '') + '<br>Modo: <strong>' + esc(P.mode || '—') + '</strong> · actualizada ' + esc(P.updated_at ? new Date(P.updated_at).toLocaleString('es-ES') : '—') + '</p><p><a class="btn sm" href="#precios">Gestionar precios</a></p></section>' +
      '<section class="panel"><h2>Más pedidos</h2>' + (tops.length ? '<ol>' + tops.map(function (r) { return '<li>' + esc(itemName(r)) + ' <span class="muted">× ' + top[r] + '</span></li>'; }).join('') + '</ol>' : '<p class="muted">Aún no hay pedidos en este navegador. Crea uno desde la web (ficha → «Añadir al presupuesto» → «Enviar pedido»).</p>') + '</section></div>' +
      '<p class="notice">Los datos de este panel se guardan en el navegador (demo). En producción vienen del backend (Worker + D1) y se actualizan solos.</p>';
  };
  function kpi(l, v) { return '<div class="kpi"><span>' + esc(l) + '</span><strong>' + esc(v) + '</strong></div>'; }

  V.pedidos = function () {
    var o = orders().slice().reverse();
    var rows = o.map(function (x, i) { return '<tr><td class="mono">' + esc(x.number) + '</td><td>' + esc(new Date(x.at).toLocaleString('es-ES')) + '</td><td>' + esc(x.customer.name || '') + '<br><span class="muted small">' + esc(x.customer.company || '') + ' ' + esc(x.customer.email || '') + '</span></td><td class="num">' + x.lines.length + '</td><td class="num">' + money(x.total) + (x.demo ? ' <span class="tag">DEMO</span>' : '') + '</td><td><button class="btn sm ghost" data-pdf="' + (o.length - 1 - i) + '">PDF</button></td></tr>'; }).join('');
    return '<h1>Pedidos</h1>' + (o.length ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Líneas</th><th>Importe</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><p><button class="btn sm ghost" data-export-orders>Exportar JSON</button> <button class="btn sm ghost" data-clear-orders>Borrar pedidos de la demo</button></p>' : '<p class="notice">No hay pedidos todavía. Haz un pedido de prueba desde la web.</p>');
  };

  V.mis = function () { return V.pedidos().replace('<h1>Pedidos</h1>', '<h1>Mis presupuestos</h1>'); };

  V.precios = function () {
    var P = TV.prices || {}, ov = !!ls.get('tv_prices_override', null), n = Object.keys(P.items || {}).length;
    return '<h1>Precios</h1><div class="cols"><section class="panel"><h2>Estado</h2><p>Origen: <strong>' + esc(P.source || '—') + '</strong> ' + (ov ? '<span class="tag">hoja cargada desde el panel</span>' : '<span class="tag dim">hoja original</span>') + '<br>Modo: <strong>' + esc(P.mode || '—') + '</strong> · ' + n + ' referencias con precio<br>Última actualización: ' + esc(P.updated_at ? new Date(P.updated_at).toLocaleString('es-ES') : '—') + '</p>' +
      '<p><button class="btn" data-refresh>Actualizar ahora (manual)</button> ' + (ov ? '<button class="btn ghost" data-restore>Volver a la hoja original</button>' : '') + '</p><p class="muted small">Producción: la hoja de Drive se sincroniza sola cada 24 h (cron) y este botón fuerza la sincronización al instante.</p></section>' +
      '<section class="panel"><h2>Subir Excel / CSV</h2><div class="drop" data-drop tabindex="0" role="button"><strong>Arrastra la hoja aquí</strong><br><span class="muted small">.xlsx, .xls o .csv · acepta la plantilla (ref, price, qty2/price2…), una tarifa (Artículo · Descripción · Precio venta) o la exportación de WooCommerce (SKU · Producto · Precio)</span><input type="file" accept=".csv,.xlsx,.xls" hidden data-file></div><p class="small"><a href="../assets/data/prices.demo.xlsx" download>Descargar plantilla Excel (DEMO)</a> · <a href="../assets/data/prices.demo.csv" download>CSV</a></p></section></div>' +
      '<section class="panel"><h2>Actualizar con una instrucción</h2><p class="muted small">Escribe qué cambiar, en castellano. Se muestra una vista previa y solo se aplica si confirmas. Ej.: <em>sube un 3% las resistencias; baja 0,05 € los núcleos; redondea a 2 decimales</em></p><textarea data-prompt rows="3" placeholder="sube un 3% las resistencias"></textarea><p><button class="btn" data-run-prompt>Previsualizar</button></p><p class="muted small">Demo: reglas locales (sube/baja X% o X €, redondea, por producto o categoría). En producción las interpreta la IA y quedan como propuesta para aprobar.</p></section><div data-draft></div>';
  };

  V.lista = function () {
    var P = TV.prices || {}, rows = Object.keys(TV.items).filter(function (r) { return P.items && P.items[r]; }).slice(0, 400).map(function (r) { var p = P.items[r]; return '<tr><td class="mono">' + esc(TV.items[r].d ? '—' : r) + '</td><td>' + esc(TV.items[r].n.es) + '</td><td class="num">' + esc(Q.unitMoney(p.p)) + '</td><td class="small mono">' + esc((p.t || []).map(function (t) { return '≥' + t[0] + ': ' + Q.unitMoney(t[1]); }).join(' · ')) + '</td></tr>'; }).join('');
    return '<h1>Lista de precios</h1>' + (P.mode === 'demo' ? '<p class="notice">Precios de demostración — no son tarifas de Torivac.</p>' : '') + '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th>Precio ud.</th><th>Tramos</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  };

  V.propuestas = function () {
    var props = TV.proposals || [], st = ls.get('tv_proposals_state', {});
    if (!props.length) return '<h1>Propuestas</h1><p class="notice">No hay propuestas todavía. Aquí aparecerán las diferencias entre la web y los PDFs técnicos y los datos dudosos, para aprobarlos uno a uno antes de publicarlos.</p>';
    return '<h1>Propuestas de cambio</h1><p class="muted">Nada de esto está publicado: la web usa el dato original hasta que lo apruebes.</p>' + props.map(function (p) {
      var s = st[p.id];
      return '<article class="panel prop' + (s ? ' done' : '') + '"><div class="small muted">' + esc(p.type) + ' · ' + esc(p.product_name || p.product_id || '') + (p.ref ? ' · <span class="mono">' + esc(p.ref) + '</span>' : '') + '</div><h3 aria-level="2">' + esc(p.title || p.field || 'Cambio') + '</h3><div class="cols"><div><div class="small muted">Web actual</div><div class="val">' + esc(p.web_value == null ? '—' : p.web_value) + '</div></div><div><div class="small muted">Propuesto / PDF</div><div class="val new">' + esc(p.pdf_value == null ? '—' : p.pdf_value) + '</div></div></div>' + (p.evidence ? '<p class="small muted">Evidencia: ' + esc(p.evidence.file || '') + ' p.' + esc(p.evidence.page || '') + '</p>' : '') +
        (s ? '<p><span class="tag">' + (s === 'ok' ? 'Aprobada (pendiente de publicar)' : 'Rechazada') + '</span> <button class="btn sm ghost" data-prop="' + esc(p.id) + '" data-v="">Deshacer</button></p>' : '<p><button class="btn sm" data-prop="' + esc(p.id) + '" data-v="ok">Aprobar</button> <button class="btn sm ghost" data-prop="' + esc(p.id) + '" data-v="no">Rechazar</button></p>') + '</article>';
    }).join('');
  };

  V.contenido = function () {
    var A = (TV.admin && TV.admin.products) || [];
    var cell = function (s) { return '<td><span class="st st-' + esc(s) + '">' + ({ ok: 'OK', partial: 'Parcial', missing: 'Falta', identical_to_es: 'Sin traducir' }[s] || esc(s)) + '</span></td>'; };
    return '<h1>Contenido</h1><p class="muted">Estado de cada ficha por idioma, referencias pedibles y etiquetas de voltaje.</p><div class="tbl-wrap"><table class="spec"><thead><tr><th>Producto</th><th>ES</th><th>EN</th><th>FR</th><th>DE</th><th>Refs.</th><th>Voltaje</th><th>PDF</th></tr></thead><tbody>' +
      A.map(function (p) { return '<tr><td>' + esc(p.name) + '<br><span class="muted small">' + esc(p.cat) + '</span></td>' + cell('ok') + cell(p.st.en) + cell(p.st.fr) + cell(p.st.de) + '<td class="num">' + p.variants + '</td><td class="num">' + p.vtags + '</td><td class="num">' + p.pdfs + '</td></tr>'; }).join('') + '</tbody></table></div>';
  };

  V.estadisticas = function (s) {
    var cards = [['Google Business Profile', 'Búsquedas, vistas, llamadas, rutas y reseñas.', 'Business Profile Performance API'], ['Google Ads', 'Inversión, clics, conversiones y CPA.', 'Google Ads API (cuenta de Torivac)'], ['SEO (Search Console)', 'Impresiones, clics, posición media, páginas y consultas.', 'Search Console API'], ['Guías y contenido', 'Lecturas, descargas de catálogo/fichas y origen.', 'GA4 Data API + eventos de descarga']];
    return '<h1>Estadísticas</h1><p class="notice">Sin conexión todavía. Los datos reales se conectan en la <strong>Sesión 7</strong>; este panel no muestra cifras inventadas.</p><div class="cols cols3">' + cards.map(function (c) { return '<section class="panel"><h2>' + esc(c[0]) + '</h2><p>' + esc(c[1]) + '</p><p class="small muted">Fuente: ' + esc(c[2]) + '</p><p><span class="tag dim">Pendiente de conectar</span></p></section>'; }).join('') + '</div>' +
      (s && s.role === 'cliente' ? '<p class="muted small">Vista cliente: se mostrarán solo sus propios datos y los informes mensuales aprobados.</p>' : '<p class="muted small">Vista manager: todas las cuentas, comparativas y alertas. Estructura de conexiones reutilizada de los repos <code>reports</code>, <code>GOOGLE-BUSINESS---NOVEDADES-Y-LINKEDIN</code> y <code>aeo-core</code>.</p>');
  };

  V.ajustes = function () {
    var r = (TV.meta && TV.meta.recipients) || [];
    return '<h1>Ajustes</h1><section class="panel"><h2>Destinatarios del pedido</h2><p>' + r.map(esc).join(' · ') + '</p><p class="notice">Confirmado por el cliente: los pedidos llegan a <strong>info@grupotorivac.com</strong> (también para las pruebas) y a <strong>mzamora@torivac.com</strong>. El pie de la web mantiene <strong>info@torivac.com</strong> (contenido original). En el demo no se envía ningún correo.</p></section><section class="panel"><h2>Usuarios (demo)</h2><table class="spec"><tbody><tr><th>manager@torivac.demo</th><td>rol manager</td></tr><tr><th>cliente@torivac.demo</th><td>rol cliente</td></tr></tbody></table></section>';
  };

  V.presupuestador = function () {
    return '<h1>Presupuestador</h1><p class="muted">Sube un CSV o Excel con <em>referencia</em> y <em>cantidad</em> (o añade desde el catálogo), revisa con imágenes y exporta el PDF.</p><iframe class="embed-frame" title="Presupuestador" src="../presupuesto/index.html?embed=1"></iframe>';
  };

  // ───────────────────────────────────────── [PRICES] lógica de la vista Precios
  var draft = null;
  function showDraft(next, label, report) {
    draft = next; var d = diffPrices(TV.prices, next); var box = root.querySelector('[data-draft]');
    var rowsOf = function (arr, kind) { return arr.slice(0, 60).map(function (x) { return '<tr><td class="mono">' + esc(x[0]) + '</td><td>' + esc(itemName(x[0])) + '</td><td class="num">' + (x[1] == null ? '—' : esc(Q.unitMoney(x[1]))) + '</td><td class="num"><strong>' + (x[2] == null ? '—' : esc(Q.unitMoney(x[2]))) + '</strong></td><td><span class="tag ' + (kind === 'removed' ? 'dim' : '') + '">' + kind + '</span></td></tr>'; }).join(''); };
    box.innerHTML = '<section class="panel"><h2>Vista previa · ' + esc(label) + '</h2><p><strong>' + d.changed.length + '</strong> cambian · <strong>' + d.added.length + '</strong> nuevas · <strong>' + d.removed.length + '</strong> sin precio · ' + d.same + ' iguales</p>' + TV.priceReportHtml(report, esc) +
      ((d.changed.length + d.added.length + d.removed.length) ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Ref.</th><th>Producto</th><th>Antes</th><th>Después</th><th></th></tr></thead><tbody>' + rowsOf(d.changed, 'cambia') + rowsOf(d.added, 'nueva') + rowsOf(d.removed, 'removed') + '</tbody></table></div>' : '<p class="notice">No hay diferencias.</p>') +
      '<p><button class="btn" data-apply>Aplicar a la web</button> <button class="btn ghost" data-discard>Descartar</button></p></section>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function applyDraft() { if (!draft) return; ls.set('tv_prices_override', draft); Q.applyOverride(); draft = null; toast('Precios aplicados a la web (este navegador)'); render(); }
  function readUpload(f) {
    var r = new FileReader(), name = f.name;
    var go = function (rows) { try { var next = rowsToPrices(rows, name); showDraft(next, name, lastReport); } catch (e) { toast('⚠ ' + e.message); } };
    if (/\.xlsx?$/i.test(name) && window.XLSX) { r.onload = function () { var wb = XLSX.read(r.result, { type: 'array' }); go(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: true })); }; r.readAsArrayBuffer(f); }
    else { r.onload = function () { go(csvParse(String(r.result))); }; r.readAsText(f); }
  }

  // ───────────────────────────────────────── [PROMPT] instrucciones en castellano → reglas de precio (demo, sin IA)
  function itemHaystack(ref) { var a = TV.admin && TV.admin.byRef && TV.admin.byRef[ref]; var it = TV.items[ref]; return norm(it.n.es + ' ' + (a ? a.cat : '') + ' ' + ref); }
  function targetMatches(ref, target) {
    if (!target || /^(todo|todos|todas|todo el catalogo|todo)$/.test(target)) return true;
    var hay = itemHaystack(ref); return target.split(' ').filter(function (w) { return w.length > 2 && !/^(los|las|del|de|la|el|en|a|y)$/.test(w); }).every(function (w) { return hay.indexOf(stem(w)) >= 0; });
  }
  function parsePrompt(text) {
    var rules = [], parts = text.split(/[;\n]|\.\s+|\sy luego\s/i);
    parts.forEach(function (raw) {
      var s = norm(raw); if (!s) return; var m;
      if ((m = s.match(/redondea(?:r)?(?: a)? (\d) decimal/))) { rules.push({ op: 'round', dec: +m[1], target: '' }); return; }
      m = s.match(/(sube|subir|aumenta|aumentar|incrementa|incrementar|baja|bajar|reduce|reducir|rebaja|rebajar|disminuye|suma|sumar|anade|resta|restar|quita)\s+(?:un |el |en )?([\d.,]+)\s*(%|por ciento|eur|euros?|€)?\s*(?:a |de |en |las |los |todos los |todas las )*(.*)$/);
      if (!m) { rules.push({ op: 'unknown', text: raw.trim() }); return; }
      var neg = /^(baja|bajar|reduce|reducir|rebaja|rebajar|disminuye|resta|restar|quita)/.test(m[1]); var val = pnum(m[2]); var unit = m[3] === '%' || m[3] === 'por ciento' ? 'pct' : 'abs';
      rules.push({ op: unit, val: neg ? -val : val, target: m[4].replace(/\b(en total|a todos)\b/, '').trim() });
    });
    return rules;
  }
  function runPrompt(text) {
    var rules = parsePrompt(text), lastTarget = '';
    rules.forEach(function (r) { if (r.op === 'round' && !r.target) r.target = lastTarget; else if (r.op !== 'unknown') lastTarget = r.target; });   // «redondea» hereda el objetivo de la regla anterior
    var next = JSON.parse(JSON.stringify(TV.prices)), unknown = rules.filter(function (r) { return r.op === 'unknown'; });
    if (!rules.length) return toast('Escribe una instrucción');
    Object.keys(next.items).forEach(function (ref) {
      var it = next.items[ref];
      rules.forEach(function (r) {
        if (r.op === 'unknown' || !TV.items[ref] || !targetMatches(ref, r.target)) return;
        var f = function (v) { return r.op === 'pct' ? v * (1 + r.val / 100) : r.op === 'abs' ? v + r.val : r.op === 'round' ? Math.round(v * Math.pow(10, r.dec)) / Math.pow(10, r.dec) : v; };
        it.p = Math.max(0, Math.round(f(it.p) * 10000) / 10000); if (it.t) it.t = it.t.map(function (t) { return [t[0], Math.max(0, Math.round(f(t[1]) * 10000) / 10000)]; });
      });
    });
    next.mode = (TV.prices.mode === 'demo' ? 'demo' : 'live'); next.source = (TV.prices.source || 'hoja') + ' + instrucción'; next.updated_at = new Date().toISOString();
    showDraft(next, 'instrucción: «' + text.trim().slice(0, 80) + '»');
    if (unknown.length) toast('No entendí: ' + unknown.map(function (u) { return '«' + u.text + '»'; }).join(', '));
  }

  // ───────────────────────────────────────── [ROUTER]
  function bind() {
    var drop = root.querySelector('[data-drop]'), file = root.querySelector('[data-file]');
    if (drop) { drop.addEventListener('click', function () { file.click(); }); file.addEventListener('change', function () { if (file.files[0]) readUpload(file.files[0]); }); ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); }); drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) readUpload(e.dataTransfer.files[0]); }); }
  }
  function onClick(e) {
    var b = e.target.closest('button,a'); if (!b) return;
    if (b.hasAttribute('data-logout')) logout();
    else if (b.hasAttribute('data-refresh')) { b.disabled = true; TV.refreshPrices().then(function () { toast('Precios actualizados'); render(); }); }
    else if (b.hasAttribute('data-restore')) { ls.del('tv_prices_override'); if (TV._pricesBase) TV.prices = TV._pricesBase; Q.applyOverride(); toast('Hoja original restaurada'); render(); }
    else if (b.hasAttribute('data-run-prompt')) runPrompt(root.querySelector('[data-prompt]').value);
    else if (b.hasAttribute('data-apply')) applyDraft();
    else if (b.hasAttribute('data-discard')) { draft = null; root.querySelector('[data-draft]').innerHTML = ''; }
    else if (b.hasAttribute('data-prop')) { var st = ls.get('tv_proposals_state', {}); var v = b.getAttribute('data-v'); if (v) st[b.getAttribute('data-prop')] = v; else delete st[b.getAttribute('data-prop')]; ls.set('tv_proposals_state', st); render(); }
    else if (b.hasAttribute('data-pdf')) { var o = orders()[+b.getAttribute('data-pdf')]; if (!o) return; var det = { lines: o.lines.map(function (l) { var it = TV.items[l.ref] || {}; return { ref: l.ref, qty: l.qty, item: it, name: (it.n && it.n.es) || l.ref, spec: it.v || '', generic: !!it.d, unit: l.unit, total: l.total }; }), total: o.total, unpriced: o.lines.filter(function (l) { return l.total == null; }).length }; var res = TV.makeQuotePdf({ customer: o.customer, number: o.number, detail: det, date: o.at }); download(res.blob(), res.filename); }
    else if (b.hasAttribute('data-export-orders')) download(new Blob([JSON.stringify(orders(), null, 1)], { type: 'application/json' }), 'pedidos-demo.json');
    else if (b.hasAttribute('data-clear-orders')) { if (confirm('¿Borrar los pedidos de la demo?')) { ls.del('tv_orders'); render(); } }
  }
  function render() {
    var s = session();
    if (!s) {
      root.innerHTML = '<main class="login"><form class="panel form" data-login><img src="' + esc(document.getElementById('logo-src').value) + '" alt="Torivac" width="84" height="84" style="background:#100404;padding:10px;margin-bottom:16px;height:84px;width:84px"><h1>Acceso</h1><p class="notice">Login de <strong>demostración</strong> (sin servidor). Accesos de prueba:<br><span class="mono">manager@torivac.demo</span> / <span class="mono">Torivac-Manager-2026</span><br><span class="mono">cliente@torivac.demo</span> / <span class="mono">Torivac-Cliente-2026</span></p><label>Correo<input type="email" name="email" autocomplete="username" required></label><label>Contraseña<input type="password" name="pass" autocomplete="current-password" required></label><p class="err" data-err hidden>Credenciales incorrectas</p><button class="btn" type="submit">Entrar</button></form></main>';
      root.querySelector('[data-login]').addEventListener('submit', function (e) { e.preventDefault(); var f = e.target; if (login(f.email.value, f.pass.value)) { location.hash = ''; render(); } else root.querySelector('[data-err]').hidden = false; });
      return;
    }
    var nav = NAV[s.role], cur = (location.hash || '#').slice(1) || nav[0][0]; if (!nav.some(function (n) { return n[0] === cur; })) cur = nav[0][0];
    root.innerHTML = '<div class="shell"><aside class="side"><div class="side-top"><img src="' + esc(document.getElementById('logo-src').value) + '" alt="Torivac" width="88" height="88"><span class="role">' + esc(s.role === 'manager' ? 'Manager' : 'Cliente') + '</span></div><nav aria-label="Panel">' + nav.map(function (n) { return '<a href="#' + n[0] + '"' + (n[0] === cur ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + n[2] + '</span>' + esc(n[1]) + '</a>'; }).join('') + '</nav><div class="side-bot"><a href="../index.html">← Ir a la web</a><button class="btn sm ghost" data-logout type="button">Salir (' + esc(s.name) + ')</button></div></aside><main class="main">' + (V[cur] ? V[cur](s) : '') + '</main></div>';
    bind();
  }
  root.addEventListener('click', onClick);   // una sola vez (los nodos se repintan, el contenedor no)
  window.addEventListener('hashchange', render);
  TV.Quote.onChange(function (d) { if (d && d.type === 'prices') { /* sin repintar: lo hace la vista */ } });
  render();
})();
