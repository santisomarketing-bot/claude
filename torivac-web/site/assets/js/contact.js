/**
 * [CONTACT] Formularios de contacto (página Contacto y bloque de la home).
 * Con TV.meta.api (producción): POST /api/contact al Worker (workers/api: honeypot, límite por IP, Turnstile opcional, Resend).
 * Sin API (DEMO): no se envía nada; se valida, se guarda el mensaje en localStorage (tv_messages) y se muestra un borrador mailto:.
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
      var out = f.querySelector('[data-sent]');
      if (TV.api.live()) {                                                              // producción
        var btn = f.querySelector('button[type=submit]'), label = btn.textContent; btn.disabled = true; btn.textContent = Q.t('sending');
        TV.api.post('/api/contact', { name: d.name, email: d.email, message: d.message, privacy: !!d.privacy, lang: Q.lang, hp: d.hp || '' }).then(function (r) {
          btn.disabled = false; btn.textContent = label; out.hidden = false;
          if (r && r.ok) { out.className = 'notice ok'; out.innerHTML = '<strong>' + TV.esc(Q.t('message_received')) + '</strong>'; f.reset(); }
          else { var mail = ((TV.meta && TV.meta.recipients) || ['info@grupotorivac.com'])[0]; out.className = 'notice'; out.innerHTML = TV.esc(Q.t('send_failed')) + ' <a href="mailto:' + TV.esc(mail) + '">' + TV.esc(mail) + '</a>'; }
        });
        return;
      }
      try { var arr = JSON.parse(localStorage.getItem('tv_messages') || '[]'); arr.push({ at: new Date().toISOString(), name: d.name, email: d.email, message: d.message }); localStorage.setItem('tv_messages', JSON.stringify(arr)); } catch (x) { /* ignorar */ }
      var to = (TV.meta && TV.meta.recipients || ['info@grupotorivac.com']).join(',');
      var href = 'mailto:' + to + '?subject=' + encodeURIComponent('Contacto web · ' + d.name) + '&body=' + encodeURIComponent(d.message + '\n\n— ' + d.name + ' <' + d.email + '>');
      out.hidden = false; out.innerHTML = '<strong>' + TV.esc(Q.t('order_sent')) + '</strong> · ' + TV.esc(Q.t('order_sent_text')) + ' <a href="' + href + '">' + TV.esc(Q.t('open_email')) + '</a>';
      f.reset();
    });
  });
})();
