/**
 * [QUOTE-PAGE] Página completa del presupuesto: tabla editable, importación CSV/Excel, PDF y envío (simulado en demo).
 * Secciones: [TABLE] · [IMPORT] · [PDF] · [SEND] · [REFRESH]
 * Depende de: quote.js, app.js, forms.js (TV.Forms), plain-text.js (TV.PlainText), pdf.js, SheetJS (window.XLSX) para .xlsx/.xls.
 * Producción (Sesión 3/6): el envío pasa a un Worker (Resend) que manda a info@ y mzamora@ con el PDF adjunto.
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, F = TV.Forms, $ = TV.$, esc = TV.esc;
  var host = $('[data-quote-table]');

  // ───────────────────────────────────────── [TABLE]
  /** Pinta la tabla del presupuesto (imagen, línea, cantidad editable, precio y total) o el aviso de presupuesto vacío. */
  function render() {
    var d = Q.detail();
    if (!d.lines.length) { host.innerHTML = '<p class="muted">' + esc(Q.t('quote_empty')) + '</p>'; $('[data-price-note]').textContent = ''; return; }
    host.innerHTML = '<div class="tbl-wrap"><table class="qtable"><thead><tr><th>' + esc(Q.t('image')) + '</th><th>' + esc(Q.t('item')) + '</th><th>' + esc(Q.t('qty')) + '</th><th class="num">' + esc(Q.t('unit_price')) + '</th><th class="num">' + esc(Q.t('line_total')) + '</th><th><span class="vh">' + esc(Q.t('remove')) + '</span></th></tr></thead><tbody>' +
      d.lines.map(function (l) {
        var th = TV.thumbSrc(l.ref);
        var url = Q.rel(l.item.p && (l.item.p[Q.lang] || l.item.p.es) || '/');
        return '<tr data-ref="' + esc(l.ref) + '"><td class="thumb">' + (th ? '<img src="' + esc(th) + '" alt="" width="52" height="52">' : '') + '</td>' +
          '<td><a class="name" href="' + esc(url) + '">' + esc(l.name) + '</a><span class="refc">' + esc(Q.shownRef(l.ref)) + (l.spec ? ' · ' + esc(l.spec) : '') + '</span></td>' +
          '<td><div class="qty"><button type="button" data-dec aria-label="−">−</button><input type="number" min="0" value="' + Number(l.qty) + '" data-q aria-label="' + esc(Q.t('qty')) + '"><button type="button" data-inc aria-label="+">+</button></div></td>' +
          '<td class="num">' + (l.unit == null ? '<span class="muted">' + esc(Q.t('on_request')) + '</span>' : esc(Q.unitMoney(l.unit))) + '</td>' +
          '<td class="num"><strong>' + (l.total == null ? '<span class="muted">' + esc(Q.t('on_request')) + '</span>' : esc(Q.money(l.total))) + '</strong></td>' +
          '<td><button class="btn sm ghost" type="button" data-rm>' + esc(Q.t('remove')) + '</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="qtotal"><span>' + esc(Q.t('total')) + '</span><strong class="mono">' + esc(Q.money(d.total)) + '</strong></div>';
    $('[data-price-note]').textContent = d.unpriced ? Q.t('price_note_request') : '';
  }
  host.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-ref]'); if (!tr) return; var ref = tr.getAttribute('data-ref');
    var cur = (Q.lines().filter(function (l) { return l.ref === ref; })[0] || { qty: 0 }).qty;
    if (e.target.closest('[data-rm]')) Q.remove(ref); else if (e.target.closest('[data-inc]')) Q.set(ref, cur + 1); else if (e.target.closest('[data-dec]')) Q.set(ref, cur - 1);
  });
  host.addEventListener('change', function (e) { if (e.target.matches('[data-q]')) Q.set(e.target.closest('tr').getAttribute('data-ref'), e.target.value); });
  Q.onChange(render); document.addEventListener('tv:prices', render); render();
  $('[data-clear-quote]').addEventListener('click', function () { if (confirm(Q.t('clear') + '?')) Q.clear(); });

  // ───────────────────────────────────────── [REFRESH]
  $('[data-refresh-prices]').addEventListener('click', function () { var b = this; b.disabled = true; TV.refreshPrices().then(function (ok) { b.disabled = false; TV.toast(ok ? Q.t('price_updated') : '⚠'); }); });

  // ───────────────────────────────────────── [IMPORT] CSV / Excel con columnas referencia + cantidad
  var drop = $('[data-drop]'), file = $('[data-file]');
  var RX_REF = /^(ref|referencia|reference|r[ée]f[ée]rence|artikel|artikelnummer|codigo|código|code|sku|modelo|model)/i, RX_QTY = /^(cant|qty|quantity|quantit|uds|unid|menge|stk|pcs|units)/i;
  /** Importa filas de CSV/Excel: detecta las columnas de referencia y cantidad (o usa la 1.ª y 2.ª) y avisa de las desconocidas. */
  function handleRows(rows) {
    if (!rows.length) return TV.toast('⚠');
    var head = rows[0].map(function (x) { return String(x || '').trim(); });
    var iRef = head.findIndex(function (h) { return RX_REF.test(h); }), iQty = head.findIndex(function (h) { return RX_QTY.test(h); });
    var data = rows.slice(1);
    if (iRef < 0 || iQty < 0) { iRef = 0; iQty = 1; data = rows; }        // sin cabecera: columna 1 = referencia, 2 = cantidad
    var res = Q.importRows(data.map(function (r) { return { ref: r[iRef], qty: r[iQty] }; }));
    TV.toast(res.added + ' ✓' + (res.unknown.length ? ' · ' + res.unknown.length + ' ?' : ''));
    var n = $('[data-import-note]') || (function () { var p = document.createElement('p'); p.className = 'notice small'; p.setAttribute('data-import-note', ''); drop.insertAdjacentElement('afterend', p); return p; })();
    n.hidden = !res.unknown.length; n.textContent = res.unknown.length ? '? ' + res.unknown.slice(0, 12).join(', ') + (res.unknown.length > 12 ? '…' : '') : '';
  }
  /** Convierte texto CSV en filas de celdas con el lector compartido TV.csvParse (quote.js). */
  function parseCsv(text) { return TV.csvParse(text); }
  /** Lee el archivo elegido o soltado (Excel con SheetJS, primera hoja, o CSV como texto) y pasa sus filas a handleRows. */
  function readFile(f) {
    if (!f) return; var name = f.name.toLowerCase(), r = new FileReader();
    if (/\.xlsx?$/.test(name) && window.XLSX) { r.onload = function () { var wb = XLSX.read(r.result, { type: 'array' }); handleRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false })); }; r.readAsArrayBuffer(f); }
    else { r.onload = function () { handleRows(parseCsv(String(r.result))); }; r.readAsText(f); }
  }
  drop.addEventListener('click', function () { file.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  file.addEventListener('change', function () { readFile(file.files[0]); file.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { readFile(e.dataTransfer.files[0]); });

  // ───────────────────────────────────────── [PDF] + [SEND]
  var form = $('[data-quote-form]');
  F.counters(form);
  /** Datos del formulario del presupuesto como objeto {campo: valor}, sin el campo honeypot `hp` (antispam). */
  function customer() { var o = {}; new FormData(form).forEach(function (v, k) { if (k !== 'hp') o[k] = v; }); return o; }
  /** Descarga el PDF `res` ({blob(), filename}) con un enlace temporal y libera la URL del blob a los 800 ms. */
  function download(res) { var a = document.createElement('a'); a.href = URL.createObjectURL(res.blob()); a.download = res.filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  $('[data-download-pdf]').addEventListener('click', function () {
    if (!Q.lines().length) return TV.toast(Q.t('quote_empty'));
    try { download(TV.makeQuotePdf({ customer: customer() })); } catch (e) { console.error(e); TV.toast('PDF ⚠'); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    F.clear(form); $('[data-sent]').hidden = true;
    ['name', 'email', 'privacy'].forEach(function (k) {
      var el = form.elements[k]; var ok = el.type === 'checkbox' ? el.checked : (el.value || '').trim() && (k !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
      if (!ok) F.fail(el, Q.t('required'));
    });
    F.checkText(form, ['name', 'company', 'phone', 'notes']);                                   // solo texto plano y con el límite de cada campo (el servidor lo vuelve a comprobar)
    if (!Q.lines().length) { TV.toast(Q.t('quote_empty')); return; }
    var bad = form.querySelector('[aria-invalid="true"]');
    if (bad) { bad.focus(); return; }
    var c = customer(), res = TV.makeQuotePdf({ customer: c }), d = Q.detail(), out = $('[data-sent]');
    if (TV.api.live()) return sendLive(c, res, d, out);
    sendDemo(c, res, d, out);
  });
  // ───────────────────────────────────────── [SEND-LIVE] producción: POST al Worker (precios y totales los fija el servidor)
  /** Envía el pedido al servidor (POST /api/order) con el PDF adjunto; los precios y totales los fija el servidor. */
  function sendLive(c, res, d, out) {
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; var label = btn.textContent; btn.textContent = Q.t('sending');
    var pdf = String(res.doc.output('datauristring')).replace(/^data:[^,]*,/, '');
    TV.api.post('/api/order', { customer: { name: c.name, company: c.company, email: c.email, phone: c.phone, notes: c.notes, privacy: !!c.privacy }, lines: d.lines.map(function (l) { return { ref: l.ref, qty: l.qty }; }), lang: Q.lang, pdf: pdf, hp: new FormData(form).get('hp') || '', _e: F.elapsed() }).then(function (r) {
      btn.disabled = false; btn.textContent = label; out.hidden = false; out.setAttribute('tabindex', '-1');
      if (r && r.ok) {
        var copy = !!(r.emailed && r.emailed.customer), mailto = ((TV.meta && TV.meta.recipients) || ['info@grupotorivac.com'])[0];      // solo se dice «te hemos enviado una confirmación» si salió (el servidor puede no enviarla: sin correo configurado, tope de envíos…)
        out.className = 'notice ok'; out.innerHTML = '<strong>' + esc(Q.t('order_sent')) + ' · ' + esc(r.number) + '</strong><br>' + (copy ? esc(Q.t('order_received')) : esc(Q.t('order_received_nocopy')) + ' <a href="mailto:' + esc(mailto) + '">' + esc(mailto) + '</a>') +
          '<br><button class="btn sm ghost" type="button" style="margin-top:8px" data-pdf-again>' + esc(Q.t('download_pdf')) + '</button>';
        var again = out.querySelector('[data-pdf-again]'); if (again) again.addEventListener('click', function () { try { download(res); } catch (e) { console.error(e); TV.toast('PDF ⚠'); } });      // la copia por correo NO lleva el PDF: se ofrece aquí, ya generado
        Q.clear(); form.reset();
      } else {
        var why = F.explain(form, r);
        if (why === true) { out.hidden = true; return; }                                         // error de un campo: ya está marcado y enfocado
        var mail = ((TV.meta && TV.meta.recipients) || ['info@grupotorivac.com'])[0];
        out.className = 'notice';
        out.innerHTML = why ? esc(why) : esc(Q.t('send_failed')) + ' <a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a>' + (r && r.error && r.error !== 'network' ? '<br><span class="small muted">' + esc(r.error) + '</span>' : '');
      }
      out.focus();
    });
  }

  // ───────────────────────────────────────── [SEND-DEMO] demo: descarga el PDF, guarda el pedido en localStorage y ofrece un borrador mailto:
  /** Demo sin servidor: descarga el PDF, guarda el pedido en localStorage y ofrece un borrador de correo (mailto:). */
  function sendDemo(c, res, d, out) {
    download(res);
    var body = Q.t('quote') + ' ' + res.number + '\n\n' + d.lines.map(function (l) { return '- ' + (l.generic ? '' : l.ref + ' · ') + l.name + ' × ' + l.qty + (l.total == null ? '' : ' = ' + Q.money(l.total)); }).join('\n') + '\n\n' + Q.t('total') + ': ' + Q.money(d.total) + '\n\n' + [c.name, c.company, c.email, c.phone].filter(Boolean).join(' · ') + (c.notes ? '\n\n' + c.notes : '') + '\n\n(PDF: ' + res.filename + ')';
    var to = ((TV.meta && TV.meta.recipients) || ['info@grupotorivac.com']).join(',');
    var href = 'mailto:' + to + '?cc=' + encodeURIComponent(c.email) + '&subject=' + encodeURIComponent(Q.t('quote') + ' ' + res.number) + '&body=' + encodeURIComponent(body);
    try { var arr = JSON.parse(localStorage.getItem('tv_orders') || '[]'); arr.push({ number: res.number, at: new Date().toISOString(), customer: c, lines: d.lines.map(function (l) { return { ref: l.ref, qty: l.qty, unit: l.unit, total: l.total }; }), total: d.total, demo: !!(TV.prices && TV.prices.mode === 'demo') }); localStorage.setItem('tv_orders', JSON.stringify(arr)); } catch (x) { /* ignorar */ }
    out.hidden = false;
    out.innerHTML = '<strong>' + esc(Q.t('order_sent')) + ' · ' + esc(res.number) + '</strong><br>' + esc(Q.t('order_sent_text')) + '<br><a class="btn sm" style="margin-top:8px" href="' + esc(href) + '">' + esc(Q.t('open_email')) + '</a>';
    out.focus && out.setAttribute('tabindex', '-1'); out.focus();
  }
})();
