/**
 * [ADMIN-GOOGLE] Sección «Google · medición y conversiones» de Ajustes (solo managers): el ID de Google Analytics 4, el de Google Ads y la etiqueta de cada conversión, sin recompilar la web.
 * Lo que se guarda vive en el servidor (PUT /api/settings/google); la web lo lee con GET /api/google (público: solo IDs, que salen en el código de cualquier página) en la primera página de cada sesión
 * y lo aplica en unos minutos (consent.js). Con todo vacío la web no carga nada de Google ni enseña aviso de cookies. Contrato: docs/GOOGLE.md §Ajustes en el panel.
 *   · Dos conversiones: «Presupuesto enviado» (presupuesto y pedido son el MISMO envío en esta web) y «Mensaje de contacto enviado». Teléfono, WhatsApp y correo NO se miden (decisión de Torivac).
 *   · La etiqueta se puede pegar completa (AW-123456789/AbCdEfGhIjK) o solo la parte final; se completa con el ID de Ads. Cada conversión se puede apagar sin borrar su etiqueta.
 *   · «Comprobar» pide a la web lo mismo que pide un visitante y dice qué cargará y qué categorías del aviso de cookies saldrán.
 * El servidor valida todo otra vez; aquí solo se avisa pronto de lo evidente. Todo texto se escapa al pintarlo.
 *
 *   TV.AdminGoogle.panel(ctx) → Promise<string> con el HTML de la sección (vacío si el servidor no la tiene)     TV.AdminGoogle.bind(root, ctx) → engancha los botones (una sola vez)
 *   ctx = { http(method, path, body), toast(msg), when(iso) }
 * Secciones: [UTIL] [PANEL] [EVENTOS]
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var G = (TV.AdminGoogle = {});
  var ctx = null, bound = null;
  var RX = { ga4: /^(?:G|GT)-[A-Z0-9]{6,14}$/, ads: /^AW-\d{6,12}$/, label: /^[A-Za-z0-9_-]{8,40}$/, full: /^(AW-\d{6,12})\/([A-Za-z0-9_-]{8,40})$/ };
  var KINDS = [['quote', 'Presupuesto enviado', 'Cuando alguien envía el presupuesto desde la web (el pedido es el mismo envío).'], ['contact', 'Mensaje de contacto enviado', 'Cuando alguien envía el formulario de contacto.']];

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Pone un aviso en [data-gg-msg] (clase `ok` si salió bien); `field` (opcional) marca el campo con el error. */
  function say(text, ok, field) {
    var n = document.querySelector('[data-gg-msg]'); if (!n) return ctx.toast(text);
    n.hidden = !text; n.className = 'notice' + (ok ? ' ok' : ''); n.textContent = text;
    [].forEach.call(document.querySelectorAll('[data-gg-root] [aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); });
    var f = field && document.querySelector('[data-gg-root] [data-gg="' + field + '"]'); if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
  }
  /** Etiqueta de conversión completa (AW-…/etiqueta) a partir de lo escrito y del ID de Ads; '' si no se puede completar. */
  function full(label, ads) {
    label = String(label || '').trim(); var m = RX.full.exec(label); if (m) return label;
    return RX.label.test(label) && RX.ads.test(ads) ? ads + '/' + label : '';
  }
  /** Lo escrito en el formulario como cuerpo del PUT. */
  function read() {
    /** Texto escrito (sin espacios de los lados) en el campo `k` del formulario; vacío si el campo no existe. */
    function q(k) { var i = document.querySelector('[data-gg-root] [data-gg="' + k + '"]'); return i ? i.value.trim() : ''; }
    /** ¿Está marcada la casilla «Medir» de la conversión `k`? */
    function on(k) { var i = document.querySelector('[data-gg-root] [data-gg-on="' + k + '"]'); return !!(i && i.checked); }
    return { ga4: q('ga4'), ads: q('ads'), conversions: { quote: { label: q('quote'), on: on('quote') }, contact: { label: q('contact'), on: on('contact') } } };
  }
  /** Primer problema evidente del cuerpo (ID mal escrito, etiqueta sin ID de Ads…) → { field, text } o null. */
  function problem(b) {
    if (b.ga4 && !RX.ga4.test(b.ga4)) return { field: 'ga4', text: 'El ID de Analytics debe tener la forma G-XXXXXXXXXX.' };
    if (b.ads && !RX.ads.test(b.ads)) return { field: 'ads', text: 'El ID de Google Ads debe tener la forma AW-123456789.' };
    for (var i = 0; i < KINDS.length; i++) {
      var k = KINDS[i][0], l = b.conversions[k].label;
      if (!l) continue;
      var m = RX.full.exec(l);
      if (!m && !RX.label.test(l)) return { field: k, text: 'La etiqueta de «' + KINDS[i][1] + '» no es válida: pega AW-123456789/AbCdEfGhIjK o solo AbCdEfGhIjK.' };
      if (!m && !b.ads) return { field: k, text: 'Para usar solo la etiqueta de «' + KINDS[i][1] + '» escribe antes el ID de Google Ads.' };
      if (m && b.ads && m[1] !== b.ads) return { field: k, text: 'La etiqueta de «' + KINDS[i][1] + '» es de otra cuenta de Ads (' + m[1] + ').' };
    }
    return null;
  }

  // ───────────────────────────────────────── [PANEL]
  /** HTML de la sección con los ajustes `s` ({ ga4, ads, conversions:{quote:{label,on}, contact:{…}}, updated }). */
  function html(s, when) {
    var c = s.conversions || {};
    var rows = KINDS.map(function (k) {
      var v = c[k[0]] || { label: '', on: true };
      return '<tr><td><strong>' + esc(k[1]) + '</strong><br><span class="muted small">' + esc(k[2]) + '</span></td><td><input class="qr-n gg-l" type="text" data-gg="' + k[0] + '" value="' + esc(v.label || '') + '" placeholder="AW-123456789/AbCdEfGhIjK" maxlength="60" autocomplete="off" aria-label="Etiqueta de conversión: ' + esc(k[1]) + '"></td>' +
        '<td><label class="qr-chk"><input type="checkbox" data-gg-on="' + k[0] + '"' + (v.on === false ? '' : ' checked') + '> Medir</label></td></tr>';
    }).join('');
    return '<section class="panel" data-gg-root><h2>Google · medición y conversiones</h2>' +
      '<p>La web mide con Google Analytics y Google Ads <strong>solo si la persona acepta las cookies</strong>. Lo que pongas aquí se aplica a la web en unos minutos, sin recompilar. <strong>Con todo vacío, la web no carga nada de Google ni enseña aviso de cookies.</strong></p>' +
      '<p class="notice small">La web antigua mide con Google Tag Manager (<span class="mono">GTM-K93FKL89</span>). Usa aquí la <strong>misma propiedad de Analytics</strong> y las <strong>mismas acciones de conversión de Ads</strong> (Ads → Objetivos → Conversiones → la acción → Etiqueta), y no dejes activas a la vez las dos webs midiendo lo mismo: se contaría doble.</p>' +
      '<p class="notice" data-gg-msg hidden role="status"></p>' +
      '<form class="form" data-gg-form novalidate><div class="qr-grid"><label class="qr-f">ID de medición de Analytics (G-…)<input type="text" data-gg="ga4" value="' + esc(s.ga4 || '') + '" placeholder="G-XXXXXXXXXX" maxlength="20" autocomplete="off"></label>' +
      '<label class="qr-f">ID de Google Ads (AW-…)<input type="text" data-gg="ads" value="' + esc(s.ads || '') + '" placeholder="AW-123456789" maxlength="20" autocomplete="off"></label></div>' +
      '<h3>Conversiones</h3><div class="tbl-wrap"><table class="spec"><thead><tr><th>Cuándo cuenta</th><th>Etiqueta de conversión de Ads</th><th>Estado</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="muted small">Se envían <strong>solo envíos completados</strong>. El teléfono, WhatsApp y el correo no se miden. En Analytics el evento es <span class="mono">generate_lead</span> (márcalo como «evento clave» en Analytics).</p>' +
      '<p class="qr-bar"><button class="btn" type="submit" data-gg-save>Guardar</button> <button class="btn ghost" type="button" data-gg-check>Comprobar qué carga la web</button></p>' +
      '<p class="muted small" data-gg-when>' + (s.updated ? 'Guardado el ' + esc(when(s.updated.at)) + ' por ' + esc(s.updated.by || '') + '.' : 'Todavía no se ha guardado ningún ajuste.') + '</p><div data-gg-check-out role="status" aria-live="polite"></div></form>' +
      '<p class="muted small">Search Console no se configura aquí: su etiqueta o archivo de verificación van en la compilación (<span class="mono">site/google.config.json</span>; ver <span class="mono">docs/GOOGLE.md</span>).</p></section>';
  }
  /** Promise<string> con la sección (vacía si el servidor no la ofrece, p. ej. una versión antigua). */
  G.panel = function (c) {
    ctx = c;
    return ctx.http('GET', '/api/settings/google').then(function (r) { return r.ok && r.settings ? html(r.settings, ctx.when) : ''; });
  };

  // ───────────────────────────────────────── [EVENTOS]
  /** Guarda los ajustes (PUT) y repinta el estado; los errores del servidor marcan su campo. */
  function save(btn) {
    var b = read(), p = problem(b); if (p) return say(p.text, false, p.field);
    btn.disabled = true; say('');
    ctx.http('PUT', '/api/settings/google', b).then(function (r) {
      btn.disabled = false;
      if (!r.ok) return say(r.error || 'No se pudo guardar', false, r.field && (r.field.indexOf('conversions.') === 0 ? r.field.slice(12) : r.field));
      var w = document.querySelector('[data-gg-when]'); if (w && r.settings && r.settings.updated) w.textContent = 'Guardado el ' + ctx.when(r.settings.updated.at) + ' por ' + (r.settings.updated.by || '') + '.';
      say('Guardado. La web lo aplicará en unos minutos (la primera página de cada sesión lo pide al servidor).', true);
    });
  }
  /** Pide a la web lo mismo que un visitante (GET /api/google) y cuenta qué cargaría y qué categorías de cookies ofrecería. */
  function check(btn) {
    var out = document.querySelector('[data-gg-check-out]'); btn.disabled = true; out.textContent = 'Comprobando…';
    ctx.http('GET', '/api/google').then(function (r) {
      btn.disabled = false;
      var g = r.google; if (!r.ok || !g) { out.className = 'notice'; out.textContent = '⚠ ' + (r.error || 'No se pudo comprobar'); return; }
      var cats = [g.ga4 ? 'Estadísticas' : '', g.ads ? 'Publicidad' : ''].filter(Boolean), conv = [g.conv && g.conv.quote ? 'presupuesto enviado' : '', g.conv && g.conv.contact ? 'contacto enviado' : ''].filter(Boolean);
      out.className = cats.length ? 'notice ok' : 'notice';
      out.innerHTML = cats.length ? 'La web enseñará el aviso de cookies con: <strong>' + esc(cats.join(' y ')) + '</strong>. Si la persona acepta, cargará ' + esc([g.ga4 ? 'Analytics ' + g.ga4 : '', g.ads ? 'Ads ' + g.ads : ''].filter(Boolean).join(' y ')) + (conv.length ? ' y medirá: ' + esc(conv.join(', ')) : ' (sin conversiones de Ads)') + '.' : 'Ahora mismo la web <strong>no carga nada de Google ni enseña aviso de cookies</strong> (no hay IDs).';
    });
  }
  /** Engancha el formulario y el botón «Comprobar» una sola vez (los nodos se repintan, el contenedor del panel no). */
  G.bind = function (root, c) {
    ctx = c; if (bound === root) return; bound = root;
    root.addEventListener('submit', function (e) { if (!e.target.hasAttribute('data-gg-form')) return; e.preventDefault(); save(e.target.querySelector('[data-gg-save]')); });
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-gg-check]'); if (b) check(b); });
  };
})();
