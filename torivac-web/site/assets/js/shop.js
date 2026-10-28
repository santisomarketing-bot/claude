/**
 * [SHOP] Listados (filtros por tensión y búsqueda) y fichas de producto (tabla de modelos con cantidades, galería).
 * Secciones: [FILTERS] filtros del listado · [MODELS] tabla de modelos · [EXTRAS] referencias que añade la hoja de precios · [GALLERY] galería · [PRICES] precios en las filas
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
    /** Aplica los filtros (tensiones marcadas y texto): oculta las fichas que no encajan y actualiza el contador y el aviso de vacío. */
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
  var rows = [];
  /** Cantidad entera ≥ 0 escrita en la fila `tr` (0 si el campo está vacío o no es un número). */
  function qtyOf(tr) { return Math.max(0, Math.floor(Number($('[data-qty]', tr).value) || 0)); }
  /** Conecta una fila de modelos (−, +, cantidad y «añadir») con el presupuesto y la registra para refrescar su precio. */
  function bindRow(tr) {
    var inp = $('[data-qty]', tr), ref = tr.getAttribute('data-ref');
    $('[data-inc]', tr).addEventListener('click', function () { inp.value = qtyOf(tr) + 1; updatePrice(tr); });
    $('[data-dec]', tr).addEventListener('click', function () { inp.value = Math.max(0, qtyOf(tr) - 1); updatePrice(tr); });
    inp.addEventListener('input', function () { updatePrice(tr); });
    $('[data-add-row]', tr).addEventListener('click', function () { var q = qtyOf(tr) || 1; Q.add(ref, q); inp.value = 0; updatePrice(tr); });
    rows.push(tr);
  }
  $$('.models tbody tr').forEach(bindRow);
  var addSel = $('[data-add-selected]');
  if (addSel) addSel.addEventListener('click', function () {
    var n = 0; rows.forEach(function (tr) { var q = qtyOf(tr); if (q > 0 && Q.add(tr.getAttribute('data-ref'), q)) { n++; $('[data-qty]', tr).value = 0; updatePrice(tr); } });
    if (!n) { TV.toast(Q.t('models_hint')); var f = $('[data-qty]', rows[0]); if (f) f.focus(); }
  });

  // ───────────────────────────────────────── [EXTRAS] referencias que la hoja de precios añade dentro de ESTE producto (una tarifa puede traer más códigos que la ficha)
  var pdp = $('.pdp'), pid = pdp ? Number(pdp.getAttribute('data-pid')) : 0, extraBox = null;
  /** HTML de la fila de una referencia que añade la hoja de precios: código, descripción, celda de precio, cantidad y botón añadir. */
  function extraRow(ref, descr) {
    var a = esc(ref);
    return '<tr data-ref="' + a + '" data-extra role="row"><td class="ref" role="cell" data-label="' + esc(Q.t('ref_model')) + '">' + a + '</td><td class="generic" role="cell">' + esc(descr) + '</td>' +
      '<td class="act" role="cell"><div class="act-in"><span class="price-cell" data-price-for="' + a + '"></span><div class="qty"><button type="button" data-dec aria-label="−">−</button><input type="number" inputmode="numeric" min="0" step="1" value="0" data-qty aria-label="' + esc(Q.t('qty')) + ' ' + a + '"><button type="button" data-inc aria-label="+">+</button></div>' +
      '<button class="btn sm" type="button" data-add-row="' + a + '">' + esc(Q.t('add_to_quote')) + '</button></div></td></tr>';
  }
  /** Pinta (o repinta) tras la tabla de modelos las referencias que la hoja de precios añade a ESTE producto, con su filtro. */
  function renderExtras() {
    if (!pid || !TV.prices || !TV.prices.items) return;
    var have = {}; $$('.models tbody tr[data-ref]').forEach(function (tr) { if (!tr.hasAttribute('data-extra')) have[tr.getAttribute('data-ref')] = 1; });
    var list = Object.keys(TV.prices.items).filter(function (r) { var it = TV.prices.items[r]; return it.pid === pid && !have[r]; });
    if (extraBox) { rows = rows.filter(function (tr) { return !tr.hasAttribute('data-extra'); }); extraBox.remove(); extraBox = null; }
    var host = $('#modelos'); if (!list.length || !host) return;
    extraBox = document.createElement('section'); extraBox.id = 'mas-referencias'; extraBox.setAttribute('aria-labelledby', 'h-more');
    extraBox.innerHTML = '<h2 id="h-more">' + esc(Q.t('more_refs')) + ' <span class="muted small">(' + list.length + ')</span></h2><p class="muted">' + esc(Q.t('more_refs_hint')) + '</p>' +
      '<input class="search" type="search" data-extra-filter placeholder="' + esc(Q.t('search_ph')) + '" aria-label="' + esc(Q.t('search_ph')) + '" style="max-width:420px;margin-bottom:var(--s-3)">' +
      '<div class="tbl-wrap models" tabindex="0"><table class="spec" role="table"><thead><tr role="row"><th class="ref" role="columnheader">' + esc(Q.t('ref_model')) + '</th><th role="columnheader">' + esc(Q.t('description_col')) + '</th><th class="act" role="columnheader">' + esc(Q.t('unit_price')) + ' · ' + esc(Q.t('qty')) + '</th></tr></thead><tbody role="rowgroup">' +
      list.map(function (r) { return extraRow(r, TV.prices.items[r].n || r); }).join('') + '</tbody></table></div>';
    host.parentNode.insertBefore(extraBox, host.nextSibling);
    $$('tbody tr', extraBox).forEach(bindRow);
    var f = $('[data-extra-filter]', extraBox);
    f.addEventListener('input', function () { var t = f.value.trim().toLowerCase(); $$('tbody tr', extraBox).forEach(function (tr) { tr.hidden = !!t && tr.textContent.toLowerCase().indexOf(t) < 0; }); });
    rows.forEach(updatePrice);
  }

  // ───────────────────────────────────────── [PRICES] precio unitario y tramos por fila
  /** Actualiza el precio unitario, los tramos y el importe de una fila de la tabla de modelos según la cantidad escrita. */
  function updatePrice(tr) {
    var ref = tr.getAttribute('data-ref'), cell = $('[data-price-for]', tr), q = qtyOf(tr) || 1;
    var u = Q.priceOf(ref, q), tiers = Q.tiersOf(ref);
    if (!cell) return;
    var html = u == null ? '<span class="muted">' + esc(Q.t('on_request')) + '</span>' : '<span class="mono">' + esc(Q.unitMoney(u)) + '</span>';
    if (tiers.length) html += tiers.map(function (t) { return '<span class="tier">' + esc(Q.t('tier_from')) + ' ' + Number(t[0]) + ' ' + esc(Q.t('units')) + ' · ' + esc(Q.unitMoney(t[1])) + '</span>'; }).join('');
    cell.innerHTML = html;
  }
  /** Actualiza el precio de todas las filas y muestra u oculta el aviso de demo según el modo de la hoja de precios. */
  function allPrices() { rows.forEach(updatePrice); $$('[data-demo-flag]').forEach(function (e) { e.hidden = !(TV.prices && TV.prices.mode === 'demo'); }); }
  /** Rehace las referencias extra y los precios de las filas; corre al cargar y en cada evento tv:prices. */
  function refresh() { renderExtras(); allPrices(); }
  refresh(); document.addEventListener('tv:prices', refresh);

  // ───────────────────────────────────────── [GALLERY]
  var main = $('[data-main]'), zoom = $('[data-zoom]');
  $$('[data-thumb]').forEach(function (b) { b.addEventListener('click', function () { main.src = b.getAttribute('data-thumb'); if (zoom) zoom.href = b.getAttribute('data-thumb'); $$('[data-thumb]').forEach(function (x) { x.setAttribute('aria-current', x === b); }); }); });
})();
