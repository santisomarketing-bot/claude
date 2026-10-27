/**
 * [CONTACT] Formularios de contacto (página Contacto y bloque de la home).
 * DEMO: no se envía nada; se valida, se guarda el mensaje en localStorage (tv_messages) y se muestra un borrador mailto:.
 * Producción (Sesión 9): POST a un Worker de Cloudflare (Turnstile + Resend) como en whynot-sites/workers/forms.
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote;
  TV.$$('[data-contact-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {}; new FormData(f).forEach(function (v, k) { d[k] = v; });
      var bad = [];
      f.querySelectorAll('.err').forEach(function (n) { n.remove(); });
      ['name', 'email', 'message', 'privacy'].forEach(function (k) {
        var el = f.elements[k]; if (!el) return;
        var ok = el.type === 'checkbox' ? el.checked : (el.value || '').trim() && (k !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
        el.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok) { bad.push(el); var m = document.createElement('span'); m.className = 'err'; m.textContent = Q.t('required'); (el.closest('label') || el).insertAdjacentElement('afterend', m); }
      });
      if (bad.length) { bad[0].focus(); return; }
      try { var arr = JSON.parse(localStorage.getItem('tv_messages') || '[]'); arr.push({ at: new Date().toISOString(), name: d.name, email: d.email, message: d.message }); localStorage.setItem('tv_messages', JSON.stringify(arr)); } catch (x) { /* ignorar */ }
      var to = (TV.meta && TV.meta.recipients || ['info@torivac.com']).join(',');
      var href = 'mailto:' + to + '?subject=' + encodeURIComponent('Contacto web · ' + d.name) + '&body=' + encodeURIComponent(d.message + '\n\n— ' + d.name + ' <' + d.email + '>');
      var out = f.querySelector('[data-sent]');
      out.hidden = false; out.innerHTML = '<strong>' + TV.esc(Q.t('order_sent')) + '</strong> · ' + TV.esc(Q.t('order_sent_text')) + ' <a href="' + href + '">' + TV.esc(Q.t('open_email')) + '</a>';
      f.reset();
    });
  });
})();
