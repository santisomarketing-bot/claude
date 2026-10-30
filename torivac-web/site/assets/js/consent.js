/**
 * [CONSENT] Aviso de cookies y medición de Google (Analytics 4 y Google Ads) con Consent Mode v2 en modo «básico».
 * Qué se mide lo decide el manager en el panel (Ajustes → Google) y se guarda en el SERVIDOR: esta web lo pide con GET /api/google (una petición pequeña por sesión, guardada 2 minutos).
 * Sin servidor (web estática sola) se usan los IDs de arranque que lleva la propia página (bloque #tv-google, de site/google.config.json). Si no hay ningún ID, este archivo no hace NADA:
 * ni aviso, ni cookies, ni peticiones a Google, ni consentimiento declarado.
 *   · NADA de Google se descarga hasta que la persona acepta (analítica y/o publicidad). Antes solo se declara el consentimiento por defecto en «denegado» (una lista en memoria, sin red).
 *   · La decisión se guarda en localStorage `tv-consent` ({v,a,p,c,t}: a = estadísticas, p = publicidad, c = categorías que se ofrecieron) 12 meses; si luego aparece una categoría nueva
 *     (p. ej. se configura Ads), se vuelve a preguntar. «Configurar cookies» del pie la cambia cuando se quiera.
 *   · Retirar un permiso ya dado borra las cookies de Google y recarga la página (así gtag.js no sigue cargado sin permiso).
 *   · Modo «test» (entorno de pruebas): se enseña el aviso y se registran los eventos en la consola, pero NO se descarga gtag.js.
 *   · Dentro del panel (?embed=1) no hay aviso ni medición.
 * API: TV.track(kind, params) · kind: 'quote' (presupuesto/pedido enviado) o 'contact' (mensaje de contacto enviado) · TV.Consent.{open, state, loaded, mode, config}
 * NO se mide ningún clic en teléfono, WhatsApp ni correo (decisión del cliente): solo envíos de formulario completados.
 * Depende de: app.js (TV.toast), quote.js (TV.api, solo para saber la dirección del servidor). Sin librerías.
 */
(function () {
  'use strict';
  var TV = window.TV = window.TV || {}, doc = document, root = doc.documentElement;
  var el = doc.getElementById('tv-google'), cfg;
  try { cfg = JSON.parse(el.textContent); } catch (e) { return; }
  if (!cfg || (cfg.v !== 1 && cfg.v !== 2) || root.classList.contains('embed')) return;
  var KEY = 'tv-consent', CFGKEY = 'tv-google-cfg', TTL = (cfg.ttl || 365) * 864e5, TEST = cfg.mode === 'test';
  var hasA = false, hasP = false;                                                 // categorías que existen: Estadísticas (GA4) y Publicidad (Ads); se saben al cargar los ajustes
  var bar = doc.getElementById('tv-cookies'), state = null, loaded = false, configured = {}, opener = null, mem = null, started = false;
  var RX = { ga4: /^(?:G|GT)-[A-Z0-9]{6,14}$/, ads: /^AW-\d{6,12}$/, conv: /^AW-\d{6,12}\/[A-Za-z0-9_-]{8,40}$/ };
  /** Mensaje en la consola solo en modo prueba (para ver qué mandaría la web a Google). */
  function log() { if (TEST && window.console) console.info.apply(console, ['[Google · prueba]'].concat([].slice.call(arguments))); }

  // ───────────────────────────────────────── [AJUSTES] qué hay configurado: el servidor (panel) o, si no hay, lo que lleva la página
  /** Ajustes comprobados: solo se aceptan IDs con la forma que genera Google (lo demás se ignora); → { ga4, ads, conv:{quote, contact} }. */
  function clean(g) {
    g = g && typeof g === 'object' ? g : {}; var c = g.conv && typeof g.conv === 'object' ? g.conv : {};
    return { ga4: RX.ga4.test(String(g.ga4 || '')) ? g.ga4 : '', ads: RX.ads.test(String(g.ads || '')) ? g.ads : '', conv: { quote: RX.conv.test(String(c.quote || '')) ? c.quote : '', contact: RX.conv.test(String(c.contact || '')) ? c.contact : '' } };
  }
  /** Promise<ajustes del servidor | null>: GET /api/google (guardado 2 minutos en sessionStorage); null si no hay servidor, tarda más de 4 s o responde mal. Nunca rechaza. */
  function fetchRuntime() {
    return new Promise(function (resolve) {
      try { var c = JSON.parse(sessionStorage.getItem(CFGKEY)); if (c && Date.now() - c.t < 12e4 && c.g) return resolve(c.g); } catch (e) { /* sin caché */ }
      if (!TV.api || !TV.api.live || !TV.api.live()) return resolve(null);
      var ac = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ac) ac.abort(); resolve(null); }, 4000);
      fetch(TV.api.base() + '/api/google', { credentials: 'omit', signal: ac ? ac.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { clearTimeout(timer); var g = j && j.ok && j.google ? clean(j.google) : null; if (g) { try { sessionStorage.setItem(CFGKEY, JSON.stringify({ t: Date.now(), g: g })); } catch (e) { /* ignorar */ } } resolve(g); })
        .catch(function () { clearTimeout(timer); resolve(null); });
    });
  }

  // ───────────────────────────────────────── [DECISIÓN] lectura y escritura de la elección guardada
  /** Categorías que se ofrecen ahora, como texto: «a», «p», «ap» o «». */
  function offered() { return (hasA ? 'a' : '') + (hasP ? 'p' : ''); }
  /** Elección guardada {a,p,t} si existe, es de esta versión, no ha caducado y ya cubría todas las categorías que se ofrecen ahora; si no, null (hay que preguntar). */
  function read() {
    var s = mem;
    try { s = JSON.parse(localStorage.getItem(KEY)) || mem; } catch (e) { /* sin almacenamiento: vale la de esta página */ }
    var now = Date.now();
    if (!(s && s.v === 1 && typeof s.t === 'number' && now - s.t < TTL && s.t <= now + 864e5)) return null;
    var c = typeof s.c === 'string' ? s.c : 'ap';
    if (offered().split('').some(function (k) { return c.indexOf(k) < 0; })) return null;                                      // apareció una categoría que no se había preguntado
    return { a: s.a === 1, p: s.p === 1, t: s.t };
  }
  /** Guarda la elección con las categorías que se ofrecían (si el navegador no deja, se recuerda solo en esta página). */
  function write(s) {
    mem = { v: 1, a: s.a ? 1 : 0, p: s.p ? 1 : 0, c: offered(), t: s.t };
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* modo privado */ }
  }

  // ───────────────────────────────────────── [GTAG] consentimiento por defecto «denegado»; el script de Google solo se pide tras consentir
  /** gtag exige recibir el objeto `arguments`, no un array. */
  function gtag() { window.dataLayer.push(arguments); }
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
  var setEl, btnCfg, btnSave, boxA, boxP;
  /** ¿Se ve ahora una sección etiquetada `sec` de la política de cookies? (a = hay GA4 · p = hay Ads · any = alguna · none = ninguna). */
  function secOn(sec) { return sec === 'a' ? hasA : sec === 'p' ? hasP : sec === 'any' ? hasA || hasP : sec === 'none' ? !(hasA || hasP) : true; }
  /** Adapta el aviso y la política a lo que hay configurado: categorías, texto del aviso, secciones de la política y botón del pie. */
  function adaptUi() {
    [].forEach.call(doc.querySelectorAll('[data-cookie-sec]'), function (n) { n.hidden = !secOn(n.getAttribute('data-cookie-sec')); });
    if (!(hasA || hasP)) return;                                                     // sin nada que medir, el botón del pie sigue oculto y el aviso nunca sale
    [].forEach.call(doc.querySelectorAll('[data-cookie-settings]'), function (b) { b.hidden = false; b.addEventListener('click', function () { open(b); }); });
    if (!bar) return;
    [['a', hasA], ['p', hasP]].forEach(function (c) { var i = bar.querySelector('input[data-cat=' + c[0] + ']'); if (i) { i.closest('label').hidden = !c[1]; } });
    var both = bar.querySelector('[data-cookie-text=both]'), stats = bar.querySelector('[data-cookie-text=stats]');
    if (both && stats) { both.hidden = !hasP; stats.hidden = hasP; }
  }
  /** Abre o cierra el panel de categorías (con «Configurar»); al abrir, las casillas reflejan la elección actual. */
  function setConfig(open) {
    setEl.hidden = !open; btnSave.hidden = !open; btnCfg.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { if (boxA) boxA.checked = !!(state && state.a); if (boxP) boxP.checked = !!(state && state.p); }
  }
  /** Muestra el aviso (con el panel abierto si viene del pie) y lleva el foco a su primera casilla opcional. */
  function open(fromFooter) {
    opener = fromFooter || null; bar.hidden = false; setConfig(!!fromFooter);
    if (fromFooter) { var f = (hasA && boxA) || (hasP && boxP); if (f) f.focus(); }
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
  /** Engancha los botones del aviso y la tecla Esc (una vez). */
  function wireBar() {
    setEl = doc.getElementById('tv-cookies-set'); btnCfg = bar.querySelector('[data-cookie=config]'); btnSave = bar.querySelector('[data-cookie=save]');
    boxA = bar.querySelector('input[data-cat=a]'); boxP = bar.querySelector('input[data-cat=p]');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cookie]'); if (!b) return;
      var k = b.getAttribute('data-cookie');
      if (k === 'accept') save(true, true);
      else if (k === 'reject') save(false, false);
      else if (k === 'config') setConfig(setEl.hidden);
      else if (k === 'save') save(boxA && boxA.checked, boxP && boxP.checked);
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bar.hidden && state) close(); });      // con una elección ya guardada se puede cerrar sin cambiar nada
  }

  // ───────────────────────────────────────── [ARRANQUE]
  /** Arranca con los ajustes definitivos `g`: sin ningún ID no hace nada; con alguno declara el consentimiento por defecto, adapta la página y pregunta o aplica la elección guardada. */
  function start(g) {
    if (started) return; started = true;
    cfg.ga4 = g.ga4; cfg.ads = g.ads; cfg.conv = g.conv;
    hasA = !!cfg.ga4; hasP = !!cfg.ads;
    TV.Consent = { open: function () { if (bar) { open(null); setConfig(true); } }, state: function () { return state ? { a: state.a, p: state.p } : null; }, loaded: function () { return loaded; }, mode: cfg.mode, config: function () { return { ga4: cfg.ga4, ads: cfg.ads, conv: cfg.conv, active: hasA || hasP }; } };
    if (!hasA && !hasP) { adaptUi(); return; }                                       // nada que medir: ni aviso, ni gtag, ni consentimiento declarado
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) window.gtag = gtag;
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
    adaptUi();
    state = read();
    if (!bar) { if (state) apply(state); return; }
    wireBar();
    if (state) apply(state); else bar.hidden = false;
  }
  var seed = clean({ ga4: cfg.ga4, ads: cfg.ads, conv: cfg.conv });
  if (cfg.runtime) fetchRuntime().then(function (g) { start(g && (g.ga4 || g.ads) ? g : seed); });          // los ajustes del panel mandan; si el servidor no tiene IDs, valen los de arranque (p. ej. los ficticios del paquete de pruebas)
  else start(seed);
})();
