/**
 * [QUOTE-ENGINE] Motor del presupuesto/pedido de Torivac.
 * Sin dependencias. Funciona con file:// (los datos llegan como variables globales: TV.items, TV.prices, TV.i18n).
 *
 * Secciones:  [STATE] estado persistente · [FORMAT] formato de importes · [PRICES] precios y tramos · [API] TorivacQuote · [REFRESH] actualización manual de precios
 *
 * Contrato de datos (lo genera site/build.mjs / scripts/build_prices.py):
 *   TV.items[ref]  = { pid, n:{es,en,fr,de}, v:"texto de especificaciones", d:true si es línea genérica, c:1 si la referencia es un código real de fabricante, p:{lang:ruta}, img, th:clave de miniatura PDF }
 *   TV.prices      = { updated_at, source, currency, mode:"demo"|"live", items:{ ref:{ p:precioBase, t:[[cantMin,precio],…], note, n?, pid? } } }   (n/pid: referencia nueva que la hoja añade dentro de un producto)
 * Importes: el precio unitario conserva hasta 4 decimales (variaciones de céntimos); el importe de cada línea se redondea a 2.
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var KEY = 'tv_quote_v1';
  var lang = window.TV_LANG || document.documentElement.lang || 'es';
  var LOCALES = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };
  var LOCALE = LOCALES[lang] || 'es-ES';

  /** ¿`k` es una clave PROPIA de `o`? (con `o[k]` a secas, «constructor», «__proto__» o «toString» pasarían por referencias válidas) */
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  // ───────────────────────────────────────── [OVERRIDE] precios cargados desde el panel (demo): sustituyen a TV.prices en este navegador
  //   En producción la hoja de Drive manda (servidor + cron 24 h); aquí `tv_prices_override` hace de "hoja viva" para poder probar el flujo Excel → web.
  //   Con servidor (TV.meta.api) NO se aplica: un valor ajeno en el almacenamiento del navegador no puede dejar precios falsos persistentes.
  function applyOverride() {
    if (!(TV.meta && TV.meta.api)) { try { var o = JSON.parse(localStorage.getItem('tv_prices_override') || 'null'); if (o && o.items) { TV._pricesBase = TV._pricesBase || TV.prices; TV.prices = o; } } catch (e) { /* sin override */ } }
    mergeSheetItems();
  }
  /** La hoja de precios puede traer referencias nuevas dentro de un producto (prices.items[ref] = {p, n, pid}): se suman a TV.items para poder presupuestarlas (x:1 = viene de la hoja). */
  function mergeSheetItems() {
    var P = TV.prices && TV.prices.items; if (!P || !TV.items) return;
    var byPid = {}; Object.keys(TV.items).forEach(function (r) { var it = TV.items[r]; if (it.pid && !byPid[it.pid]) byPid[it.pid] = it; });
    Object.keys(P).forEach(function (ref) {
      var sh = P[ref]; if (!sh.pid || own(TV.items, ref) || !byPid[sh.pid]) return;
      var b = byPid[sh.pid];
      TV.items[ref] = { pid: sh.pid, n: b.n, v: sh.n || '', d: false, c: 1, x: 1, p: b.p, img: b.img, th: b.th };
    });
  }
  applyOverride();

  // ───────────────────────────────────────── [STATE]
  var lines = load();
  var listeners = [];
  //   Respaldo SOLO para file:// (demo abierto con doble clic): Chrome a veces entrega a la página siguiente un localStorage vacío.
  //   Se duplica el presupuesto en window.name (viaja con la pestaña) con una marca de tiempo; manda la copia más reciente.
  //   No se usa en http(s): window.name sería legible por otros sitios abiertos en la misma pestaña.
  var STAMP = 'tv_quote_t', NAME = 'tvq1:', FILE = location.protocol === 'file:';
  //   Las referencias que la hoja de precios añade (x:1) llegan con los precios, después de cargar esto: no se puede exigir que ya estén en TV.items. Solo se descartan las que no son texto y los nombres de Object.prototype.
  /** Filtra las líneas guardadas: conserva solo las {ref, qty > 0} válidas; si `r` no es un array devuelve []. */
  function clean(r) { return Array.isArray(r) ? r.filter(function (l) { return l && typeof l.ref === 'string' && l.ref && l.qty > 0 && !own(Object.prototype, l.ref); }) : []; }
  /** Carga las líneas del presupuesto de localStorage; con file:// manda la copia de window.name si es más reciente. */
  function load() {
    var ls = [], lt = 0, nm = null;
    try { ls = clean(JSON.parse(localStorage.getItem(KEY) || '[]')); lt = Number(localStorage.getItem(STAMP)) || 0; } catch (e) { /* sin almacenamiento */ }
    if (FILE && String(window.name).indexOf(NAME) === 0) { try { nm = JSON.parse(String(window.name).slice(NAME.length)); } catch (e) { nm = null; } }
    return nm && Number(nm.t) > lt ? clean(nm.l) : ls;
  }
  /** Guarda las líneas y su marca de tiempo en localStorage (si falla, quedan en memoria) y, con file://, una copia en window.name. */
  function save() {
    var t = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(lines)); localStorage.setItem(STAMP, String(t)); } catch (e) { /* modo privado: se mantiene en memoria */ }
    if (FILE) { try { window.name = NAME + JSON.stringify({ t: t, l: lines }); } catch (e) { /* ignorar */ } }
  }
  /** Guarda el presupuesto y avisa del cambio `detail` a los oyentes registrados y con el evento tv:quote del documento. */
  function emit(detail) {
    save();
    listeners.forEach(function (fn) { try { fn(detail); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent('tv:quote', { detail: detail || {} }));
  }

  // ───────────────────────────────────────── [FORMAT]
  var nf2, nfu;
  /** Crea los formateadores de moneda (importes a 2 decimales, precios unitarios de 2 a 4) con la divisa de los precios o EUR. */
  function buildFormats() {
    var cur = (TV.prices && TV.prices.currency) || (TV.meta && TV.meta.currency) || 'EUR';
    nf2 = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur });
    nfu = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  buildFormats();
  /** Formatea un importe (2 decimales) en la divisa y el idioma de la página. */
  function money(n) { return nf2.format(n); }
  /** Formatea un precio unitario (de 2 a 4 decimales) en la divisa y el idioma de la página. */
  function unitMoney(n) { return nfu.format(n); }
  /** Texto de interfaz `key` en el idioma de la página (TV.i18n); si no existe devuelve la propia clave. */
  function t(key) { var d = (TV.i18n && TV.i18n[lang]) || {}; return d[key] != null ? d[key] : key; }
  /** ruta relativa a una página lógica (/en/product/x/) desde la página actual */
  function rel(logical) {
    var cur = (document.body.getAttribute('data-path') || '/').split('/').filter(Boolean).length;
    return (cur ? new Array(cur + 1).join('../') : './') + logical.replace(/^\//, '') + (logical.slice(-1) === '/' && !(TV.meta && TV.meta.clean) ? 'index.html' : '');
  }
  /** Ruta relativa al archivo `a` del sitio desde la página actual (antepone tantos «../» como niveles indica data-path). */
  function assetUrl(a) { var cur = (document.body.getAttribute('data-path') || '/').split('/').filter(Boolean).length; return (cur ? new Array(cur + 1).join('../') : './') + a; }

  // ───────────────────────────────────────── [PRICES]
  /** precio unitario aplicable a `qty` unidades de `ref` (null = sin precio → "consultar") */
  function priceOf(ref, qty) {
    var p = TV.prices && own(TV.prices.items, ref) ? TV.prices.items[ref] : null;
    if (!p || p.p == null) return null;
    var unit = p.p;
    (p.t || []).forEach(function (tier) { if (qty >= tier[0]) unit = tier[1]; });
    return unit;
  }
  /** Tramos de precio por cantidad de `ref` como [[cantMin, precio], …]; [] si no tiene. */
  function tiersOf(ref) { var p = TV.prices && own(TV.prices.items, ref) ? TV.prices.items[ref] : null; return (p && p.t) || []; }
  /** Redondea a 2 decimales compensando el error de coma flotante. */
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /** Cantidad de una celda CSV/Excel: entero ≥ 0; «1.000» y «1,000» son mil (millares), «12,0» es doce; 0 si no se entiende. */
  function qtyOf(x) {
    if (typeof x === 'number') return Math.floor(x) || 0;
    var s = String(x == null ? '' : x).replace(/[\s\u00a0]/g, '');
    s = /^\d{1,3}([.,]\d{3})+$/.test(s) ? s.replace(/[.,]/g, '') : s.replace(',', '.');
    return Math.floor(Number(s) || 0);
  }

  // ───────────────────────────────────────── [API]
  var API = {
    /** Copia de las líneas del presupuesto [{ref, qty}]; modificarla no altera el estado. */
    lines: function () { return lines.slice(); },
    /** Total de unidades del presupuesto (suma de las cantidades de todas las líneas). */
    count: function () { return lines.reduce(function (n, l) { return n + l.qty; }, 0); },
    /** Número de referencias distintas (líneas) del presupuesto. */
    kinds: function () { return lines.length; },
    /** Indica si el presupuesto ya tiene una línea con la referencia `ref`. */
    has: function (ref) { return lines.some(function (l) { return l.ref === ref; }); },
    /** Suma `qty` unidades de `ref` (crea la línea si falta); false si la referencia no existe o la cantidad no es válida. */
    add: function (ref, qty) {
      qty = Math.max(0, Math.floor(Number(qty) || 0)); if (!own(TV.items, ref) || !qty) return false;
      var l = lines.filter(function (x) { return x.ref === ref; })[0];
      if (l) l.qty += qty; else lines.push({ ref: ref, qty: qty });
      emit({ type: 'add', ref: ref, qty: qty }); return true;
    },
    /** Fija la cantidad de `ref`: 0 elimina la línea y, si la línea no existía, equivale a añadirla. */
    set: function (ref, qty) {
      qty = Math.max(0, Math.floor(Number(qty) || 0));
      var i = lines.findIndex(function (x) { return x.ref === ref; });
      if (i < 0) return API.add(ref, qty);
      if (!qty) lines.splice(i, 1); else lines[i].qty = qty;
      emit({ type: 'set', ref: ref, qty: qty }); return true;
    },
    /** Elimina la línea de `ref` (fija su cantidad a 0). */
    remove: function (ref) { API.set(ref, 0); },
    /** Vacía el presupuesto y avisa del cambio. */
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
    /** Registra `fn(detail)` para que se llame en cada cambio del presupuesto o de los precios. */
    onChange: function (fn) { listeners.push(fn); },
    /** Reaplica los precios cargados desde el panel, rehace los formatos y avisa a la página (evento tv:prices y cambio «prices»). */
    applyOverride: function () { applyOverride(); buildFormats(); document.dispatchEvent(new CustomEvent('tv:prices')); emit({ type: 'prices' }); },
    /** Ejecuta `fn()` con el idioma, los textos y los formatos de importe de `l` (es, en, fr o de) y vuelve después al de la página: sirve para fabricar el PDF de un presupuesto en el idioma de quien lo pidió. Devuelve lo que devuelva `fn`. */
    withLang: function (l, fn) {
      if (!own(LOCALES, l) || l === lang) return fn();
      var prev = { lang: lang, locale: LOCALE, shown: API.lang };
      lang = l; LOCALE = LOCALES[l]; API.lang = l; buildFormats();
      try { return fn(); } finally { lang = prev.lang; LOCALE = prev.locale; API.lang = prev.shown; buildFormats(); }
    },
    money: money, unitMoney: unitMoney, priceOf: priceOf, tiersOf: tiersOf, t: t, rel: rel, assetUrl: assetUrl, lang: lang,
    /** nombre de línea listo para mostrar */
    label: function (d) { return d.name + (d.spec ? ' — ' + d.spec : ''); },
    /** referencia visible (las líneas genéricas P#### no se muestran como referencia) */
    shownRef: function (ref) { return own(TV.items, ref) && TV.items[ref].c ? ref : '—'; },
    /** importa filas {ref, qty}: devuelve {added, unknown[]} */
    importRows: function (rows) {
      var idx = Object.create(null); Object.keys(TV.items).forEach(function (k) { idx[String(k).toLowerCase().replace(/\s+/g, '')] = k; });
      var added = 0, unknown = [];
      rows.forEach(function (r) {
        var key = String(r.ref || '').toLowerCase().replace(/\s+/g, ''); var q = qtyOf(r.qty);
        if (!key) return; if (idx[key] && q > 0) { var l = lines.filter(function (x) { return x.ref === idx[key]; })[0]; if (l) l.qty += q; else lines.push({ ref: idx[key], qty: q }); added++; } else unknown.push(r.ref);
      });
      emit({ type: 'import', added: added }); return { added: added, unknown: unknown };
    },
  };
  TV.Quote = API;

  // ───────────────────────────────────────── [CSV] lector RFC 4180 (comillas, separador , o ;, saltos de línea dentro de comillas)
  // ───────────────────────────────────────── [API] Worker de producción (workers/api). Sin TV.meta.api → modo demo (envío simulado).
  TV.api = {
    /** URL base del Worker de la API (TV.meta.api) sin barras finales; cadena vacía si no hay API. */
    base: function () { return String((TV.meta && TV.meta.api) || '').replace(/\/+$/, ''); },
    /** Indica si hay API de producción configurada (false = modo demo, con el envío simulado). */
    live: function () { return !!TV.api.base(); },
    /** POST JSON a `path` de la API; devuelve siempre una Promise con la respuesta y su `status` (los fallos vuelven como {ok:false}). */
    post: function (path, body) {
      return fetch(TV.api.base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }).then(function (j) { j.status = r.status; return j; }); })
        .catch(function () { return { ok: false, error: 'network', status: 0 }; });
    }
  };

  // ───────────────────────────────────────── [LIVE] precios vigentes del servidor (producción)
  //   El snapshot de la compilación (assets/data/prices.js) es solo el respaldo: con TV.meta.api manda lo que devuelva GET /api/prices (hoja de Drive, cada 24 h o al pulsar «actualizar»).
  TV.loadLivePrices = function () {
    if (!TV.api.live()) return Promise.resolve(false);
    return fetch(TV.api.base() + '/api/prices', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var p = j && j.prices; if (!p || !p.items || p.mode === 'none' || !Object.keys(p.items).length) return false;
      TV._pricesSnapshot = TV._pricesSnapshot || TV.prices; TV.prices = p; mergeSheetItems(); buildFormats();
      document.dispatchEvent(new CustomEvent('tv:prices')); emit({ type: 'prices' }); return true;
    }).catch(function () { return false; });
  };
  if (TV.api.live()) TV.loadLivePrices();

  /** Lector CSV (RFC 4180): texto → filas de celdas; detecta el separador , o ; en la 1.ª línea, admite comillas y quita el BOM. */
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
  /** Recarga los precios a mano: del servidor si hay API; en la demo, volviendo a cargar assets/data/prices.js. */
  TV.refreshPrices = function () {
    if (TV.api.live()) return TV.loadLivePrices();
    return new Promise(function (resolve) {
      var s = document.querySelector('script[src*="assets/data/prices.js"]'); if (!s) return resolve(false);
      var url = s.getAttribute('src').split('?')[0] + '?t=' + Date.now();
      var n = document.createElement('script'); n.src = url;
      /** Al cargar el script de precios recién pedido: reaplica el override, rehace formatos, avisa del cambio y resuelve con true. */
      n.onload = function () { applyOverride(); buildFormats(); document.dispatchEvent(new CustomEvent('tv:prices')); emit({ type: 'prices' }); resolve(true); };
      /** Si falla la carga del script de precios, resuelve la promesa con false. */
      n.onerror = function () { resolve(false); };
      document.head.appendChild(n);
    });
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) { lines = load(); emit({ type: 'sync' }); } });
})();
