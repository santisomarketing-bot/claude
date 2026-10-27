/**
 * [QUOTE-ENGINE] Motor del presupuesto/pedido de Torivac.
 * Sin dependencias. Funciona con file:// (los datos llegan como variables globales: TV.items, TV.prices, TV.i18n).
 *
 * Secciones:  [STATE] estado persistente · [FORMAT] formato de importes · [PRICES] precios y tramos · [API] TorivacQuote · [REFRESH] actualización manual de precios
 *
 * Contrato de datos (lo genera site/build.mjs / scripts/build_prices.py):
 *   TV.items[ref]  = { pid, n:{es,en,fr,de}, v:"texto de especificaciones", d:true si es línea genérica, p:{lang:ruta}, img, th:clave de miniatura PDF }
 *   TV.prices      = { updated_at, source, currency, mode:"demo"|"live", items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note } } }
 * Importes: el precio unitario conserva hasta 4 decimales (variaciones de céntimos); el importe de cada línea se redondea a 2.
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var KEY = 'tv_quote_v1';
  var lang = window.TV_LANG || document.documentElement.lang || 'es';
  var LOCALE = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' }[lang] || 'es-ES';

  // ───────────────────────────────────────── [OVERRIDE] precios cargados desde el panel (demo): sustituyen a TV.prices en este navegador
  //   En producción la hoja de Drive manda (Worker + cron 24 h); aquí `tv_prices_override` hace de "hoja viva" para poder probar el flujo Excel → web.
  function applyOverride() {
    try { var o = JSON.parse(localStorage.getItem('tv_prices_override') || 'null'); if (o && o.items) { TV._pricesBase = TV._pricesBase || TV.prices; TV.prices = o; } } catch (e) { /* sin override */ }
  }
  applyOverride();

  // ───────────────────────────────────────── [STATE]
  var lines = load();
  var listeners = [];
  //   Respaldo SOLO para file:// (demo abierto con doble clic): Chrome a veces entrega a la página siguiente un localStorage vacío.
  //   Se duplica el presupuesto en window.name (viaja con la pestaña) con una marca de tiempo; manda la copia más reciente.
  //   No se usa en http(s): window.name sería legible por otros sitios abiertos en la misma pestaña.
  var STAMP = 'tv_quote_t', NAME = 'tvq1:', FILE = location.protocol === 'file:';
  function clean(r) { return Array.isArray(r) ? r.filter(function (l) { return l && l.ref && l.qty > 0; }) : []; }
  function load() {
    var ls = [], lt = 0, nm = null;
    try { ls = clean(JSON.parse(localStorage.getItem(KEY) || '[]')); lt = Number(localStorage.getItem(STAMP)) || 0; } catch (e) { /* sin almacenamiento */ }
    if (FILE && String(window.name).indexOf(NAME) === 0) { try { nm = JSON.parse(String(window.name).slice(NAME.length)); } catch (e) { nm = null; } }
    return nm && Number(nm.t) > lt ? clean(nm.l) : ls;
  }
  function save() {
    var t = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(lines)); localStorage.setItem(STAMP, String(t)); } catch (e) { /* modo privado: se mantiene en memoria */ }
    if (FILE) { try { window.name = NAME + JSON.stringify({ t: t, l: lines }); } catch (e) { /* ignorar */ } }
  }
  function emit(detail) {
    save();
    listeners.forEach(function (fn) { try { fn(detail); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent('tv:quote', { detail: detail || {} }));
  }

  // ───────────────────────────────────────── [FORMAT]
  var nf2, nfu;
  function buildFormats() {
    var cur = (TV.prices && TV.prices.currency) || (TV.meta && TV.meta.currency) || 'EUR';
    nf2 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur });
    nfu = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  buildFormats();
  function money(n) { return nf2.format(n); }
  function unitMoney(n) { return nfu.format(n); }
  function t(key) { var d = (TV.i18n && TV.i18n[lang]) || {}; return d[key] != null ? d[key] : key; }
  /** ruta relativa a una página lógica (/en/product/x/) desde la página actual */
  function rel(logical) {
    var cur = (document.body.getAttribute('data-path') || '/').split('/').filter(Boolean).length;
    return (cur ? new Array(cur + 1).join('../') : './') + logical.replace(/^\//, '') + (logical.slice(-1) === '/' ? 'index.html' : '');
  }
  function assetUrl(a) { var cur = (document.body.getAttribute('data-path') || '/').split('/').filter(Boolean).length; return (cur ? new Array(cur + 1).join('../') : './') + a; }

  // ───────────────────────────────────────── [PRICES]
  /** precio unitario aplicable a `qty` unidades de `ref` (null = sin precio → "consultar") */
  function priceOf(ref, qty) {
    var p = TV.prices && TV.prices.items && TV.prices.items[ref];
    if (!p || p.p == null) return null;
    var unit = p.p;
    (p.t || []).forEach(function (tier) { if (qty >= tier[0]) unit = tier[1]; });
    return unit;
  }
  function tiersOf(ref) { var p = TV.prices && TV.prices.items && TV.prices.items[ref]; return (p && p.t) || []; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // ───────────────────────────────────────── [API]
  var API = {
    lines: function () { return lines.slice(); },
    count: function () { return lines.reduce(function (n, l) { return n + l.qty; }, 0); },
    kinds: function () { return lines.length; },
    has: function (ref) { return lines.some(function (l) { return l.ref === ref; }); },
    add: function (ref, qty) {
      qty = Math.max(0, Math.floor(Number(qty) || 0)); if (!TV.items || !TV.items[ref] || !qty) return false;
      var l = lines.filter(function (x) { return x.ref === ref; })[0];
      if (l) l.qty += qty; else lines.push({ ref: ref, qty: qty });
      emit({ type: 'add', ref: ref, qty: qty }); return true;
    },
    set: function (ref, qty) {
      qty = Math.max(0, Math.floor(Number(qty) || 0));
      var i = lines.findIndex(function (x) { return x.ref === ref; });
      if (i < 0) return API.add(ref, qty);
      if (!qty) lines.splice(i, 1); else lines[i].qty = qty;
      emit({ type: 'set', ref: ref, qty: qty }); return true;
    },
    remove: function (ref) { API.set(ref, 0); },
    clear: function () { lines = []; emit({ type: 'clear' }); },
    /** líneas detalladas + total (solo suma las que tienen precio) */
    detail: function () {
      var sum = 0, unpriced = 0;
      var out = lines.map(function (l) {
        var it = TV.items[l.ref] || {}; var unit = priceOf(l.ref, l.qty);
        var total = unit == null ? null : round2(unit * l.qty);
        if (total == null) unpriced++; else sum += total;
        return { ref: l.ref, qty: l.qty, item: it, name: (it.n && (it.n[lang] || it.n.es)) || l.ref, spec: it.v || '', generic: !!it.d, unit: unit, total: total };
      });
      return { lines: out, total: round2(sum), unpriced: unpriced };
    },
    onChange: function (fn) { listeners.push(fn); },
    applyOverride: function () { applyOverride(); buildFormats(); document.dispatchEvent(new CustomEvent('tv:prices')); emit({ type: 'prices' }); },
    money: money, unitMoney: unitMoney, priceOf: priceOf, tiersOf: tiersOf, t: t, rel: rel, assetUrl: assetUrl, lang: lang,
    /** nombre de línea listo para mostrar */
    label: function (d) { return d.name + (d.spec ? ' — ' + d.spec : ''); },
    /** referencia visible (las líneas genéricas P#### no se muestran como referencia) */
    shownRef: function (ref) { return TV.items[ref] && TV.items[ref].d ? '—' : ref; },
    /** importa filas {ref, qty}: devuelve {added, unknown[]} */
    importRows: function (rows) {
      var idx = {}; Object.keys(TV.items).forEach(function (k) { idx[String(k).toLowerCase().replace(/\s+/g, '')] = k; });
      var added = 0, unknown = [];
      rows.forEach(function (r) {
        var key = String(r.ref || '').toLowerCase().replace(/\s+/g, ''); var q = Math.floor(Number(String(r.qty).replace(',', '.')) || 0);
        if (!key) return; if (idx[key] && q > 0) { var l = lines.filter(function (x) { return x.ref === idx[key]; })[0]; if (l) l.qty += q; else lines.push({ ref: idx[key], qty: q }); added++; } else unknown.push(r.ref);
      });
      emit({ type: 'import', added: added }); return { added: added, unknown: unknown };
    },
  };
  TV.Quote = API;

  // ───────────────────────────────────────── [CSV] lector RFC 4180 (comillas, separador , o ;, saltos de línea dentro de comillas)
  TV.csvParse = function (text) {
    text = String(text).replace(/^\ufeff/, '');
    var first = text.split('\n')[0], delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n') { row.push(cell.trim()); cell = ''; if (row.some(function (c) { return c !== ''; })) rows.push(row); row = []; }
      else if (ch !== '\r') cell += ch;
    }
    row.push(cell.trim()); if (row.some(function (c) { return c !== ''; })) rows.push(row);
    return rows;
  };

  // ───────────────────────────────────────── [REFRESH] recarga manual de precios (el cron de 24 h lo hace el servidor; ver Sesión 6)
  TV.refreshPrices = function () {
    return new Promise(function (resolve) {
      var s = document.querySelector('script[src*="assets/data/prices.js"]'); if (!s) return resolve(false);
      var url = s.getAttribute('src').split('?')[0] + '?t=' + Date.now();
      var n = document.createElement('script'); n.src = url;
      n.onload = function () { applyOverride(); buildFormats(); document.dispatchEvent(new CustomEvent('tv:prices')); emit({ type: 'prices' }); resolve(true); };
      n.onerror = function () { resolve(false); };
      document.head.appendChild(n);
    });
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) { lines = load(); emit({ type: 'sync' }); } });
})();
