/**
 * [APP] Comportamiento común a todas las páginas.
 * Secciones: [UTIL] · [MENU] menú móvil · [DRAWER] cajón del presupuesto · [FAB] botones flotantes · [LANG] idioma (detección + selector manual) · [THEME] aspecto · [ORIGINAL] menú flotante del aspecto «Original» · [PRICE-STAMP]
 * Depende de: quote.js (TV.Quote). Sin librerías.
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, lang = window.TV_LANG || 'es';
  /** Primer elemento que cumple el selector `s` dentro de `r` (por defecto, el documento); null si no hay ninguno. */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  /** Todos los elementos que cumplen el selector `s` dentro de `r`, como array de verdad (no NodeList). */
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ───────────────────────────────────────── [UTIL]
  var toastEl = $('[data-toast]'), toastT;
  /** Muestra `msg` durante 2,6 s en el aviso flotante de la página (no hace nada si la página no lo incluye). */
  TV.toast = function (msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600); };
  TV.esc = esc; TV.$ = $; TV.$$ = $$;
  /** URL de la imagen del producto `ref` relativa a la página actual, o '' si no tiene imagen. */
  function thumbSrc(ref) {
    var it = TV.items[ref] || {};
    if (it.img) return Q.assetUrl(it.img);
    return '';
  }
  TV.thumbSrc = thumbSrc;

  // ───────────────────────────────────────── [EMBED] ?embed=1: la página se muestra dentro del panel (sin cabecera, pie ni flotantes)
  if (/[?&]embed=1/.test(location.search)) document.documentElement.classList.add('embed');

  // ───────────────────────────────────────── [TREE] árbol de categorías: botones de plegado accesibles (el HTML llega desplegado)
  $$('[data-tree] li.has-kids').forEach(function (li, n) {
    var a = li.querySelector(':scope > a'), ul = li.querySelector(':scope > ul'); if (!a || !ul) return;
    var row = document.createElement('div'); row.className = 'row'; li.insertBefore(row, a); row.appendChild(a);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tgl'; ul.id = ul.id || 'tree-' + n; b.setAttribute('aria-controls', ul.id);
    var open = li.hasAttribute('data-open'); li.classList.toggle('collapsed', !open); b.setAttribute('aria-expanded', open); b.textContent = open ? '−' : '+'; b.setAttribute('aria-label', (a.textContent || '').replace(/\d+$/, '').trim());
    b.addEventListener('click', function () { var o = li.classList.toggle('collapsed') === false; b.setAttribute('aria-expanded', o); b.textContent = o ? '−' : '+'; });
    row.appendChild(b);
  });

  // ───────────────────────────────────────── [MENU]
  var header = $('#site-header'), mbtn = $('[data-menu-toggle]');
  if (mbtn) mbtn.addEventListener('click', function () { var o = header.classList.toggle('open'); mbtn.setAttribute('aria-expanded', o); });

  // ───────────────────────────────────────── [DRAWER] mini-presupuesto flotante
  var drawer = $('#quote-drawer'), scrim = $('[data-scrim]'), lastFocus = null;
  /** Abre el cajón del presupuesto: guarda el foco previo, muestra cajón y velo, pinta las líneas y enfoca el botón de cerrar. */
  function openDrawer() { if (!drawer) return; lastFocus = document.activeElement; drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); scrim.classList.add('open'); renderDrawer(); var c = $('[data-close-quote]', drawer); if (c) c.focus(); }
  /** Cierra el cajón del presupuesto y el velo, y devuelve el foco al elemento que lo abrió. */
  function closeDrawer() { if (!drawer) return; drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); scrim.classList.remove('open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  TV.openDrawer = openDrawer; TV.closeDrawer = closeDrawer;
  $$('[data-open-quote]').forEach(function (b) { b.addEventListener('click', openDrawer); });
  $$('[data-close-quote]').forEach(function (b) { b.addEventListener('click', closeDrawer); });
  if (scrim) scrim.addEventListener('click', function () { closeDrawer(); var s = $('#filters'); if (s) s.classList.remove('open'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); var s = $('#filters'); if (s) { s.classList.remove('open'); scrim.classList.remove('open'); } } });

  /** Pinta el cajón: líneas con miniatura, cantidades y total, o el aviso de presupuesto vacío con enlace a la página. */
  function renderDrawer() {
    var body = $('[data-drawer-body]', drawer), foot = $('[data-drawer-foot]', drawer);
    var d = Q.detail();
    if (!d.lines.length) { body.innerHTML = '<p class="muted">' + esc(Q.t('quote_empty')) + '</p>'; foot.innerHTML = '<a class="btn ghost" href="' + esc(window.TV_PATHS.quote) + '">' + esc(Q.t('quote')) + ' →</a>'; return; }
    body.innerHTML = d.lines.map(function (l) {
      var th = thumbSrc(l.ref);
      return '<div class="mini-line" data-ref="' + esc(l.ref) + '"><img src="' + esc(th) + '" alt="" width="48" height="48"><div><div class="n">' + esc(l.name) + '</div><div class="r">' + esc(Q.shownRef(l.ref)) + (l.spec ? ' · ' + esc(l.spec) : '') + '</div>' +
        '<div class="qty" style="margin-top:6px"><button type="button" data-d-dec aria-label="−">−</button><input type="number" min="0" value="' + Number(l.qty) + '" data-d-qty aria-label="' + esc(Q.t('qty')) + '"><button type="button" data-d-inc aria-label="+">+</button></div></div>' +
        '<div style="text-align:right"><div class="mono">' + (l.total == null ? esc(Q.t('on_request')) : esc(Q.money(l.total))) + '</div><button class="btn sm ghost" type="button" data-d-rm style="margin-top:6px">' + esc(Q.t('remove')) + '</button></div></div>';
    }).join('');
    foot.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px"><span>' + esc(Q.t('total')) + '</span><strong class="mono" style="font-size:1.4rem">' + esc(Q.money(d.total)) + '</strong></div>' +
      (d.unpriced ? '<p class="small muted" style="margin:0 0 10px">' + esc(Q.t('price_note_request')) + '</p>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="' + esc(window.TV_PATHS.quote) + '">' + esc(Q.t('send_order')) + '</a><button class="btn ghost" type="button" data-d-clear>' + esc(Q.t('clear')) + '</button></div>';
  }
  if (drawer) drawer.addEventListener('click', function (e) {
    var row = e.target.closest('.mini-line'); var ref = row && row.getAttribute('data-ref');
    if (e.target.closest('[data-d-rm]')) Q.remove(ref);
    else if (e.target.closest('[data-d-inc]')) Q.set(ref, (Q.lines().filter(function (l) { return l.ref === ref; })[0] || { qty: 0 }).qty + 1);
    else if (e.target.closest('[data-d-dec]')) Q.set(ref, (Q.lines().filter(function (l) { return l.ref === ref; })[0] || { qty: 1 }).qty - 1);
    else if (e.target.closest('[data-d-clear]')) Q.clear();
  });
  if (drawer) drawer.addEventListener('change', function (e) { if (e.target.matches('[data-d-qty]')) Q.set(e.target.closest('.mini-line').getAttribute('data-ref'), e.target.value); });
  // trampa de foco sencilla dentro del cajón
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !drawer || !drawer.classList.contains('open')) return;
    var f = $$('button,a[href],input', drawer).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ───────────────────────────────────────── [FAB] contadores y "subir"
  var fab = $('.fab-quote');
  /** Actualiza los contadores [data-quote-count] con el total de unidades del presupuesto. */
  function refreshCounts() { var n = Q.count(); $$('[data-quote-count]').forEach(function (el) { el.textContent = n; }); }
  Q.onChange(function (d) {
    refreshCounts();
    if (d && d.type === 'add' && fab) { fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); TV.toast(Q.t('added') + ' · ' + (TV.items[d.ref] ? (TV.items[d.ref].n[lang] || TV.items[d.ref].n.es) : d.ref) + ' × ' + d.qty); }
    if (drawer && drawer.classList.contains('open')) renderDrawer();
  });
  refreshCounts();
  var topBtn = $('[data-top]');
  if (topBtn) { window.addEventListener('scroll', function () { topBtn.classList.toggle('show', window.scrollY > 700); }, { passive: true }); topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }

  // ───────────────────────────────────────── [LANG] detección por navegador + selector manual
  // Reglas: 1) la elección MANUAL (clic en ES/EN/FR/DE) manda siempre y se recuerda.
  //         2) sin elección guardada, en la primera visita se usa el idioma del navegador: si hay versión en ese idioma se redirige a la página equivalente.
  //         3) la redirección automática ocurre una sola vez por visitante y SOLO desde una página en español (la versión por defecto, sin prefijo);
  //            quien llega a /en/, /fr/ o /de/ ya ha elegido idioma (enlace compartido, buscador): ahí solo se ofrece un aviso (cambiar / mantener).
  var SITE_LANGS = ['es', 'en', 'fr', 'de'];
  /** Lee la clave `k` de localStorage (sin `v`) o la guarda (con `v`); si el almacenamiento falla, devuelve null. */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  /** Primer idioma preferido del navegador que exista en la web (es, en, fr, de); null si ninguno. */
  function browserLang() { var arr = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'es']); for (var i = 0; i < arr.length; i++) { var c = String(arr[i]).toLowerCase().slice(0, 2); if (SITE_LANGS.indexOf(c) >= 0) return c; } return null; }
  $$('[data-set-lang]').forEach(function (a) { a.addEventListener('click', function () { store('tv_lang', a.getAttribute('data-set-lang')); store('tv_lang_src', 'manual'); }); });
  (function detect() {
    var pref = store('tv_lang'), src = store('tv_lang_src');
    var q = location.search || '';
    if (/nolang/.test(q)) return;
    if (pref && src === 'manual') { if (pref !== lang) offer(pref); return; }          // el usuario eligió: solo se ofrece, nunca se fuerza
    var bl = browserLang();
    if (!bl) return;
    if (!store('tv_lang_auto_done')) {                                                  // primera visita: redirección automática (una vez)
      store('tv_lang_auto_done', '1'); store('tv_lang', bl); store('tv_lang_src', 'auto');
      if (lang === 'es' && bl !== lang && window.TV_PATHS.home[bl]) { location.replace(window.TV_PATHS.home[bl]); return; }
    }
    if (bl !== lang && !sessionStorage.getItem('tv_lang_dismiss')) offer(bl);
  })();
  /** Muestra el aviso para cambiar al idioma `target` (en ese idioma): «cambiar» fija la elección y «mantener» conserva la actual. */
  function offer(target) {
    var bar = $('#lang-banner'); if (!bar || !window.TV_PATHS.home[target]) return;
    var d = (TV.i18n && TV.i18n[target]) || {};
    $('[data-lang-msg]', bar).textContent = (d.lang_banner || '') + ' ';
    var keep = $('[data-lang-keep]', bar); if (d.lang_dismiss) keep.textContent = d.lang_dismiss;      // todo el aviso en el idioma de la persona, no en el de la página
    var go = $('[data-lang-go]', bar); go.textContent = (d.lang_switch || 'OK') + ' → ' + target.toUpperCase(); go.href = window.TV_PATHS.home[target];
    go.addEventListener('click', function () { store('tv_lang', target); store('tv_lang_src', 'manual'); });
    $('[data-lang-keep]', bar).addEventListener('click', function () { try { sessionStorage.setItem('tv_lang_dismiss', '1'); } catch (e) { /* ignorar */ } store('tv_lang', lang); store('tv_lang_src', 'manual'); bar.hidden = true; });
    bar.hidden = false;
  }

  // ───────────────────────────────────────── [THEME] selector de aspecto (Ficha técnica / Clásico)
  // El aspecto lo fija <html data-theme>: el script de la cabecera ya aplicó ?tema= o la elección guardada antes de pintar. Aquí solo se enlazan los botones y se recuerda la elección.
  (function () {
    var groups = $$('[data-theme-switch]'), root = document.documentElement;
    if (!groups.length) return;
    /** Muestra los selectores (sin JS no hay botones inútiles) y marca como pulsado el del aspecto activo. */
    function paint() { var cur = root.getAttribute('data-theme'); groups.forEach(function (g) { g.hidden = false; $$('[data-set-theme]', g).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-set-theme') === cur ? 'true' : 'false'); }); }); }
    $$('[data-set-theme]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-set-theme'); root.setAttribute('data-theme', v); store('tv-theme', v); paint(); }); });
    paint();
  })();

  // ───────────────────────────────────────── [ORIGINAL] aspecto «Original»: menú flotante «Productos-Torivac» y redirección de las categorías de un solo producto
  //   El menú nace oculto (sin JS no serviría); aquí se enseña, se abre y se cierra (botón, fondo, Escape) y se despliegan sus categorías. La pista «Abrir productos» sale 4 s una vez por sesión, como en la web actual.
  (function () {
    var root = document.documentElement;
    if (root.getAttribute('data-theme') === 'original' && document.body.getAttribute('data-o-redirect')) { location.replace(document.body.getAttribute('data-o-redirect')); return; }   // la web actual manda esas categorías directamente a su producto
    var fl = $('[data-o-float]'); if (!fl) return;
    var tg = $('.torivac-sidebar-toggle', fl), panel = $('#o-panel', fl), last = null;
    fl.hidden = false;
    /** Abre o cierra el panel de categorías (y lo anuncia a los lectores de pantalla). */
    function setOpen(o) {
      fl.classList.toggle('is-open', o); tg.setAttribute('aria-expanded', o ? 'true' : 'false');
      if (o) { last = document.activeElement; var c = $('.torivac-sidebar-close', fl); if (c) c.focus(); } else if (last && last.focus) { last.focus(); }
    }
    tg.addEventListener('click', function () { setOpen(!fl.classList.contains('is-open')); });
    $$('[data-o-close]', fl).forEach(function (b) { b.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fl.classList.contains('is-open')) setOpen(false); });
    $$('.cat-icon', fl).forEach(function (b) { b.addEventListener('click', function () { var ul = document.getElementById(b.getAttribute('aria-controls')); var o = ul.hidden; ul.hidden = !o; b.setAttribute('aria-expanded', o ? 'true' : 'false'); b.textContent = o ? '−' : '+'; }); });
    try { if (!sessionStorage.getItem('tv_o_hint')) { sessionStorage.setItem('tv_o_hint', '1'); fl.classList.add('show-hint'); setTimeout(function () { fl.classList.remove('show-hint'); }, 4200); } } catch (e) { /* sin almacenamiento: sin pista */ }
  })();

  // ───────────────────────────────────────── [PRICE-STAMP] marca de demo y fecha de precios
  /** Pinta la marca «DEMO» (solo con precios de demostración) y la fecha de los precios. */
  function stamp() {
    var P = TV.prices || {};
    $$('[data-demo-flag]').forEach(function (e) { e.hidden = P.mode !== 'demo'; });
    $$('[data-price-stamp]').forEach(function (e) { e.textContent = P.updated_at ? Q.t('price_updated') + ': ' + new Date(P.updated_at).toLocaleString(Q.lang === 'en' ? 'en-GB' : Q.lang) : ''; });
  }
  stamp(); document.addEventListener('tv:prices', stamp);
  refreshCounts();

  // ───────────────────────────────────────── [ART] las espiras del bobinado toroidal se dibujan al entrar en pantalla (sin JS o con movimiento reducido ya se ven completas)
  (function () {
    var arts = $$('.toroid-art');
    if (!arts.length) return;
    if (!('IntersectionObserver' in window) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;     // espiras ya completas
    arts.forEach(function (a) { a.classList.add('armed'); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.15 });
    arts.forEach(function (a) { io.observe(a); });
  })();
})();
