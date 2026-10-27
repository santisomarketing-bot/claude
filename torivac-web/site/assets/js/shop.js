/**
 * [SHOP] Listados (filtros por tensión y búsqueda) y fichas de producto (tabla de modelos con cantidades, galería).
 * Secciones: [FILTERS] filtros del listado · [MODELS] tabla de modelos · [GALLERY] galería · [PRICES] precios en las filas
 * Depende de: quote.js, app.js (TV.$, TV.$$, TV.toast).
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, $ = TV.$, $$ = TV.$$, esc = TV.esc;

  // ───────────────────────────────────────── [FILTERS]
  var grid = $('[data-grid]');
  if (grid) {
    var cards = $$('.pcard', grid), active = {}, text = '';
    var count = $('[data-count]'), empty = $('[data-empty]');
    var apply = function () {
      var n = 0, vs = Object.keys(active).filter(function (k) { return active[k]; });
      cards.forEach(function (c) {
        var ok = true;
        if (vs.length) { var cv = (c.getAttribute('data-v') || '').split(','); ok = vs.some(function (v) { return cv.indexOf(v) >= 0; }); }
        if (ok && text) ok = (c.getAttribute('data-q') || '').indexOf(text) >= 0;
        c.hidden = !ok; if (ok) n++;
      });
      if (count) count.textContent = n + ' ' + (n === 1 ? (Q.t('result_one') || Q.t('results')) : Q.t('results'));
      if (empty) empty.hidden = n > 0;
    };
    $$('[data-vf]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-vf'); active[k] = !active[k]; b.setAttribute('aria-pressed', active[k]); apply(); }); });
    var s = $('[data-search]'); if (s) s.addEventListener('input', function () { text = s.value.trim().toLowerCase(); apply(); });
    var clr = $('[data-clear-filters]'); if (clr) clr.addEventListener('click', function () { active = {}; text = ''; if (s) s.value = ''; $$('[data-vf]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); apply(); });
  }
  // barra lateral desplegable en móvil
  var side = $('#filters'), scrim = $('[data-scrim]');
  $$('[data-filters-toggle]').forEach(function (b) { b.addEventListener('click', function () { side.classList.add('open'); scrim.classList.add('open'); }); });

  // ───────────────────────────────────────── [MODELS]
  var rows = $$('.models tbody tr');
  function qtyOf(tr) { return Math.max(0, Math.floor(Number($('[data-qty]', tr).value) || 0)); }
  rows.forEach(function (tr) {
    var inp = $('[data-qty]', tr), ref = tr.getAttribute('data-ref');
    $('[data-inc]', tr).addEventListener('click', function () { inp.value = qtyOf(tr) + 1; updatePrice(tr); });
    $('[data-dec]', tr).addEventListener('click', function () { inp.value = Math.max(0, qtyOf(tr) - 1); updatePrice(tr); });
    inp.addEventListener('input', function () { updatePrice(tr); });
    $('[data-add-row]', tr).addEventListener('click', function () { var q = qtyOf(tr) || 1; Q.add(ref, q); inp.value = 0; updatePrice(tr); });
  });
  var addSel = $('[data-add-selected]');
  if (addSel) addSel.addEventListener('click', function () {
    var n = 0; rows.forEach(function (tr) { var q = qtyOf(tr); if (q > 0 && Q.add(tr.getAttribute('data-ref'), q)) { n++; $('[data-qty]', tr).value = 0; updatePrice(tr); } });
    if (!n) { TV.toast(Q.t('models_hint')); var f = $('[data-qty]', rows[0]); if (f) f.focus(); }
  });

  // ───────────────────────────────────────── [PRICES] precio unitario y tramos por fila
  function updatePrice(tr) {
    var ref = tr.getAttribute('data-ref'), cell = $('[data-price-for]', tr), q = qtyOf(tr) || 1;
    var u = Q.priceOf(ref, q), tiers = Q.tiersOf(ref);
    if (!cell) return;
    var html = u == null ? '<span class="muted">' + esc(Q.t('on_request')) + '</span>' : '<span class="mono">' + esc(Q.unitMoney(u)) + '</span>';
    if (tiers.length) html += tiers.map(function (t) { return '<span class="tier">' + esc(Q.t('tier_from')) + ' ' + t[0] + ' ' + esc(Q.t('units')) + ' · ' + esc(Q.unitMoney(t[1])) + '</span>'; }).join('');
    cell.innerHTML = html;
  }
  function allPrices() { rows.forEach(updatePrice); $$('[data-demo-flag]').forEach(function (e) { e.hidden = !(TV.prices && TV.prices.mode === 'demo'); }); }
  allPrices(); document.addEventListener('tv:prices', allPrices);

  // ───────────────────────────────────────── [GALLERY]
  var main = $('[data-main]');
  $$('[data-thumb]').forEach(function (b) { b.addEventListener('click', function () { main.src = b.getAttribute('data-thumb'); $$('[data-thumb]').forEach(function (x) { x.setAttribute('aria-current', x === b); }); }); });
})();
