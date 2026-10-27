/**
 * [QUOTE-PAGE] Página completa del presupuesto: tabla editable, importación CSV/Excel, PDF y envío (simulado en demo).
 * Secciones: [TABLE] · [IMPORT] · [PDF] · [SEND] · [REFRESH]
 * Depende de: quote.js, app.js, pdf.js, SheetJS (window.XLSX) para .xlsx/.xls.
 * Producción (Sesión 3/6): el envío pasa a un Worker (Resend) que manda a info@ y mzamora@ con el PDF adjunto.
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, $ = TV.$, esc = TV.esc;
  var host = $('[data-quote-table]');

  // ───────────────────────────────────────── [TABLE]
  function render() {
    var d = Q.detail();
    if (!d.lines.length) { host.innerHTML = '<p class="muted">' + esc(Q.t('quote_empty')) + '</p>'; $('[data-price-note]').textContent = ''; return; }
    host.innerHTML = '<div class="tbl-wrap"><table class="qtable"><thead><tr><th>' + esc(Q.t('image')) + '</th><th>' + esc(Q.t('item')) + '</th><th>' + esc(Q.t('qty')) + '</th><th class="num">' + esc(Q.t('unit_price')) + '</th><th class="num">' + esc(Q.t('line_total')) + '</th><th></th></tr></thead><tbody>' +
      d.lines.map(function (l) {
        var th = TV.thumbSrc(l.ref);
        var url = Q.rel(l.item.p && (l.item.p[Q.lang] || l.item.p.es) || '/');
        return '<tr data-ref="' + esc(l.ref) + '"><td class="thumb">' + (th ? '<img src="' + esc(th) + '" alt="" width="52" height="52">' : '') + '</td>' +
          '<td><a class="name" href="' + esc(url) + '">' + esc(l.name) + '</a><span class="refc">' + esc(Q.shownRef(l.ref)) + (l.spec ? ' · ' + esc(l.spec) : '') + '</span></td>' +
          '<td><div class="qty"><button type="button" data-dec aria-label="−">−</button><input type="number" min="0" value="' + l.qty + '" data-q aria-label="' + esc(Q.t('qty')) + '"><button type="button" data-inc aria-label="+">+</button></div></td>' +
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
  function parseCsv(text) {
    var delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    return text.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return l.split(delim).map(function (c) { return c.replace(/^"|"$/g, '').trim(); }); });
  }
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
  function customer() { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o; }
  function download(res) { var a = document.createElement('a'); a.href = URL.createObjectURL(res.blob()); a.download = res.filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  $('[data-download-pdf]').addEventListener('click', function () {
    if (!Q.lines().length) return TV.toast(Q.t('quote_empty'));
    try { download(TV.makeQuotePdf({ customer: customer() })); } catch (e) { console.error(e); TV.toast('PDF ⚠'); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    form.querySelectorAll('.err').forEach(function (n) { n.remove(); });
    var bad = [];
    ['name', 'email', 'privacy'].forEach(function (k) {
      var el = form.elements[k]; var ok = el.type === 'checkbox' ? el.checked : (el.value || '').trim() && (k !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) { bad.push(el); var m = document.createElement('span'); m.className = 'err'; m.textContent = Q.t('required'); (el.closest('label') || el).insertAdjacentElement('afterend', m); }
    });
    if (!Q.lines().length) { TV.toast(Q.t('quote_empty')); return; }
    if (bad.length) { bad[0].focus(); return; }
    var c = customer(), res = TV.makeQuotePdf({ customer: c }), d = Q.detail();
    download(res);
    var body = Q.t('quote') + ' ' + res.number + '\n\n' + d.lines.map(function (l) { return '- ' + (l.generic ? '' : l.ref + ' · ') + l.name + ' × ' + l.qty + (l.total == null ? '' : ' = ' + Q.money(l.total)); }).join('\n') + '\n\n' + Q.t('total') + ': ' + Q.money(d.total) + '\n\n' + [c.name, c.company, c.email, c.phone].filter(Boolean).join(' · ') + (c.notes ? '\n\n' + c.notes : '') + '\n\n(PDF: ' + res.filename + ')';
    var to = ((TV.meta && TV.meta.recipients) || ['info@torivac.com']).join(',');
    var href = 'mailto:' + to + '?cc=' + encodeURIComponent(c.email) + '&subject=' + encodeURIComponent(Q.t('quote') + ' ' + res.number) + '&body=' + encodeURIComponent(body);
    try { var arr = JSON.parse(localStorage.getItem('tv_orders') || '[]'); arr.push({ number: res.number, at: new Date().toISOString(), customer: c, lines: d.lines.map(function (l) { return { ref: l.ref, qty: l.qty, unit: l.unit, total: l.total }; }), total: d.total, demo: !!(TV.prices && TV.prices.mode === 'demo') }); localStorage.setItem('tv_orders', JSON.stringify(arr)); } catch (x) { /* ignorar */ }
    var out = $('[data-sent]'); out.hidden = false;
    out.innerHTML = '<strong>' + esc(Q.t('order_sent')) + ' · ' + esc(res.number) + '</strong><br>' + esc(Q.t('order_sent_text')) + '<br><a class="btn sm" style="margin-top:8px" href="' + esc(href) + '">' + esc(Q.t('open_email')) + '</a>';
    out.focus && out.setAttribute('tabindex', '-1'); out.focus();
  });
})();
