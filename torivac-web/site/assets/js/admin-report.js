/**
 * [ADMIN-REPORT] Informe de lectura de una hoja de precios para la vista previa del panel: columnas reconocidas, avisos, referencias nuevas y filas que no se publican.
 * Lo comparten admin.js (demo, en el navegador) y admin-live.js (real, el informe viene del servidor). Sin dependencias.
 *
 *   TV.priceReportHtml(report, esc) → HTML ('' si no hay informe)
 *   report = { warnings:[{code,message}], ignored:[{ref,reason}], unknown:[ref], extras:[ref], columns:{campo:cabecera}, stats:{rows,accepted,decimals} }
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var LABEL = { ref: 'referencia', price: 'precio', name: 'descripción', note: 'nota', active: 'activa', currency: 'moneda', unit: 'unidad', product_id: 'producto', updated_at: 'fecha', offer: 'oferta', stock: 'stock', qty2: 'tramo 2', price2: 'precio tramo 2', qty3: 'tramo 3', price3: 'precio tramo 3', qty4: 'tramo 4', price4: 'precio tramo 4' };
  /** HTML del informe de lectura de la hoja (columnas, avisos y listas plegables); `esc` escapa el texto; '' sin informe. */
  TV.priceReportHtml = function (rep, esc) {
    if (!rep) return '';
    var out = '', cols = rep.columns || {};
    var shown = Object.keys(cols).filter(function (k) { return LABEL[k]; }).map(function (k) { return LABEL[k] + ' ← «' + cols[k] + '»'; });
    if (shown.length) out += '<p class="muted small">Columnas reconocidas: ' + esc(shown.join(' · ')) + (rep.stats ? ' · ' + rep.stats.accepted + ' de ' + rep.stats.rows + ' filas con precio · ' + rep.stats.decimals + ' decimales' : '') + '</p>';
    (rep.warnings || []).forEach(function (w) { out += '<p class="notice' + (/relleno|duplicada/.test(w.code || '') ? ' warn' : '') + '">' + esc(w.message) + '</p>'; });
    /** Bloque <details> con `title` y hasta 40 elementos formateados con `fmt` (añade «…» si hay más); '' si la lista está vacía. */
    var list = function (arr, title, fmt) { return arr && arr.length ? '<details><summary>' + esc(title) + ' (' + arr.length + ')</summary><p class="small mono" style="overflow-wrap:anywhere">' + arr.slice(0, 40).map(fmt).join(' · ') + (arr.length > 40 ? ' …' : '') + '</p></details>' : ''; };
    out += list(rep.extras, 'Referencias nuevas que se publican dentro de su producto', function (r) { return esc(r); });
    out += list(rep.unknown, 'Referencias de la hoja que no encajan en ningún producto (no se publican)', function (r) { return esc(r); });
    out += list(rep.ignored, 'Filas ignoradas', function (x) { return esc(x.ref) + ' — ' + esc(x.reason); });
    return out;
  };
})();
