/**
 * [CONSENT] Aviso de cookies y medición de Google (Analytics 4 y Google Ads) con Consent Mode v2 en modo «básico».
 * Solo existe en compilaciones con IDs de Google (site/google.config.json → bloque #tv-google de cada página). Sin IDs, la página no carga este archivo ni nada de Google.
 *   · NADA de Google se descarga hasta que la persona acepta (analítica y/o publicidad). Antes solo se declara el consentimiento por defecto en «denegado» (una lista en memoria, sin red).
 *   · La decisión se guarda en localStorage `tv-consent` ({v,a,p,t}: a = estadísticas, p = publicidad) 12 meses; con «Configurar cookies» del pie se cambia cuando se quiera.
 *   · Retirar un permiso ya dado borra las cookies de Google y recarga la página (así gtag.js no sigue cargado sin permiso).
 *   · Modo «test» (entorno de pruebas): se enseña el aviso y se registran los eventos en la consola, pero NO se descarga gtag.js.
 *   · Dentro del panel (?embed=1) no hay aviso ni medición.
 * API: TV.track(kind, params) · kind: 'quote' (presupuesto/pedido enviado) o 'contact' (mensaje de contacto enviado) · TV.Consent.{open, state, loaded, mode}
 * NO se mide ningún clic en teléfono, WhatsApp ni correo (decisión del cliente): solo envíos de formulario completados.
 * Depende de: app.js (TV.toast). Sin librerías.
 */
(function () {
  'use strict';
  var TV = window.TV = window.TV || {}, doc = document, root = doc.documentElement;
  var el = doc.getElementById('tv-google'), cfg;
  try { cfg = JSON.parse(el.textContent); } catch (e) { return; }
  if (!cfg || cfg.v !== 1 || root.classList.contains('embed')) return;
  var KEY = 'tv-consent', TTL = (cfg.ttl || 365) * 864e5, TEST = cfg.mode === 'test';
  var hasA = !!cfg.ga4, hasP = !!cfg.ads;                                         // categorías que existen: Estadísticas (GA4) y Publicidad (Ads)
  var bar = doc.getElementById('tv-cookies'), state = null, loaded = false, configured = {}, opener = null, mem = null;
  /** Mensaje en la consola solo en modo prueba (para ver qué mandaría la web a Google). */
  function log() { if (TEST && window.console) console.info.apply(console, ['[Google · prueba]'].concat([].slice.call(arguments))); }

  // ───────────────────────────────────────── [DECISIÓN] lectura y escritura de la elección guardada
  /** Elección guardada {a,p,t} si existe, es de esta versión y no ha caducado; si no, null (hay que preguntar). */
  function read() {
    var s = mem;
    try { s = JSON.parse(localStorage.getItem(KEY)) || mem; } catch (e) { /* sin almacenamiento: vale la de esta página */ }
    var now = Date.now();
    return s && s.v === 1 && typeof s.t === 'number' && now - s.t < TTL && s.t <= now + 864e5 ? { a: s.a === 1, p: s.p === 1, t: s.t } : null;
  }
  /** Guarda la elección (si el navegador no deja, se recuerda solo en esta página). */
  function write(s) {
    mem = { v: 1, a: s.a ? 1 : 0, p: s.p ? 1 : 0, t: s.t };
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* modo privado */ }
  }

  // ───────────────────────────────────────── [GTAG] consentimiento por defecto «denegado»; el script de Google solo se pide tras consentir
  window.dataLayer = window.dataLayer || [];
  /** gtag exige recibir el objeto `arguments`, no un array. */
  function gtag() { window.dataLayer.push(arguments); }
  if (!window.gtag) window.gtag = gtag;
  gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
  /** Descarga gtag.js una sola vez (en modo prueba, no). */
  function load() {
    if (loaded) return;
    loaded = true;
    if (TEST) { log('no se descarga gtag.js'); return; }
    var s = doc.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4 || cfg.ads);
    doc.head.appendChild(s);
    gtag('js', new Date());
  }
  /** Activa la medición de un ID una sola vez por página. */
  function conf(id) { if (!configured[id]) { configured[id] = 1; gtag('config', id); log('config', id); } }
  /** Aplica la elección: actualiza el consentimiento y, si hay algo permitido, carga Google y activa solo los IDs permitidos. */
  function apply(s) {
    var a = s.a && hasA, p = s.p && hasP, g = function (b) { return b ? 'granted' : 'denied'; };
    gtag('consent', 'update', { analytics_storage: g(a), ad_storage: g(p), ad_user_data: g(p), ad_personalization: g(p) });
    if (a || p) { load(); if (a) conf(cfg.ga4); if (p) conf(cfg.ads); }
  }
  /** Borra las cookies de Google de esta web (en el dominio y en los de arriba). */
  function wipe() {
    var names = (doc.cookie || '').split(';').map(function (c) { return c.split('=')[0].trim(); }).filter(function (n) { return /^(_ga|_gid|_gat|_gcl_|_gac_|__gads|__gpi|FPAU|FPLC|FPGCL)/.test(n); });
    var host = location.hostname.split('.'), ds = [''], i;
    for (i = 0; i < host.length - 1; i++) ds.push('; domain=' + host.slice(i).join('.'), '; domain=.' + host.slice(i).join('.'));
    names.forEach(function (n) { ds.forEach(function (d) { doc.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d; }); });
  }

  // ───────────────────────────────────────── [EVENTOS] solo envíos de formulario completados, solo con permiso
  /** Registra una conversión: 'quote' (presupuesto/pedido enviado) o 'contact' (mensaje enviado). Sin elección o sin el permiso de esa categoría, no hace nada. */
  TV.track = function (kind, p) {
    p = p || {};
    var s = state; if (!s || (kind !== 'quote' && kind !== 'contact')) return;
    var a = s.a && hasA, ad = s.p && hasP, lead = { lead_type: kind, language: root.lang || 'es' };
    if (p.items) lead.items = p.items;
    if (a) { lead.send_to = cfg.ga4; gtag('event', 'generate_lead', lead); log('generate_lead', lead); }
    if (ad && cfg.conv && cfg.conv[kind]) { var c = { send_to: cfg.conv[kind] }; if (p.id) c.transaction_id = String(p.id); gtag('event', 'conversion', c); log('conversion', c); }
  };

  // ───────────────────────────────────────── [AVISO] mostrar, configurar, guardar
  if (!bar) { state = read(); if (state) apply(state); return; }
  var setEl = doc.getElementById('tv-cookies-set'), btnCfg = bar.querySelector('[data-cookie=config]'), btnSave = bar.querySelector('[data-cookie=save]');
  var boxA = bar.querySelector('input[data-cat=a]'), boxP = bar.querySelector('input[data-cat=p]');
  /** Abre o cierra el panel de categorías (con «Configurar»); al abrir, las casillas reflejan la elección actual. */
  function setConfig(open) {
    setEl.hidden = !open; btnSave.hidden = !open; btnCfg.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { if (boxA) boxA.checked = !!(state && state.a); if (boxP) boxP.checked = !!(state && state.p); }
  }
  /** Muestra el aviso (con el panel abierto si viene del pie) y lleva el foco a su primera casilla opcional. */
  function open(fromFooter) {
    opener = fromFooter || null; bar.hidden = false; setConfig(!!fromFooter);
    if (fromFooter) { var f = boxA || boxP; if (f) f.focus(); }
  }
  /** Cierra el aviso y devuelve el foco a donde estaba (el botón del pie) o al inicio de la página. */
  function close() {
    bar.hidden = true; setConfig(false);
    if (opener && opener.isConnected) opener.focus(); else { doc.body.setAttribute('tabindex', '-1'); doc.body.focus(); doc.body.removeAttribute('tabindex'); }
    opener = null;
  }
  /** Guarda la elección, cierra el aviso y la aplica; si se retira un permiso que ya estaba en uso, borra las cookies y recarga. */
  function save(a, p) {
    var prev = state;
    state = { a: !!(a && hasA), p: !!(p && hasP), t: Date.now() };
    write(state); close();
    if (loaded && prev && ((prev.a && !state.a) || (prev.p && !state.p))) {
      gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      wipe(); location.reload(); return;
    }
    apply(state);
    if (TV.toast) TV.toast(bar.getAttribute('data-saved') || '');
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cookie]'); if (!b) return;
    var k = b.getAttribute('data-cookie');
    if (k === 'accept') save(true, true);
    else if (k === 'reject') save(false, false);
    else if (k === 'config') setConfig(setEl.hidden);
    else if (k === 'save') save(boxA && boxA.checked, boxP && boxP.checked);
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bar.hidden && state) close(); });      // con una elección ya guardada se puede cerrar sin cambiar nada
  // botones «Configurar cookies» del pie: existen en el HTML ocultos (sin JavaScript no hay nada que configurar)
  [].forEach.call(doc.querySelectorAll('[data-cookie-settings]'), function (b) { b.hidden = false; b.addEventListener('click', function () { open(b); }); });

  state = read();
  if (state) apply(state); else bar.hidden = false;
  TV.Consent = { open: function () { open(null); setConfig(true); }, state: function () { return state ? { a: state.a, p: state.p } : null; }, loaded: function () { return loaded; }, mode: cfg.mode };
})();
