/**
 * [CONTACT] Formularios de contacto (página Contacto, bloque de la portada y bloque «Contacta con nosotros» de las fichas y entradas de «Original»).
 * Con TV.meta.api (producción): POST /api/contact al servidor (workers/api o backend-php: honeypot, tiempo mínimo de relleno, solo texto plano y con límite de caracteres, límite por IP,
 * Turnstile opcional). El servidor guarda el mensaje SIEMPRE (se ve en el panel) y avisa por correo al equipo; aquí se avisa de lo que no vale en el idioma de la página.
 * Sin API (DEMO): no se envía nada; se valida, se guarda el mensaje en localStorage (tv_messages) y se muestra un borrador mailto:.
 * Depende de: quote.js (TV.Quote, TV.api), app.js, forms.js (TV.Forms), plain-text.js (TV.PlainText).
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, F = TV.Forms;
  TV.$$('[data-contact-form]').forEach(function (f) {
    F.counters(f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {}; new FormData(f).forEach(function (v, k) { d[k] = v; });
      var out = f.querySelector('[data-sent]');
      F.clear(f); out.hidden = true;
      ['name', 'email', 'message', 'privacy'].forEach(function (k) {
        var el = f.elements[k]; if (!el) return;
        var ok = el.type === 'checkbox' ? el.checked : (el.value || '').trim() && (k !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
        if (!ok) F.fail(el, Q.t('required'));
      });
      F.checkText(f, ['name', 'message']);
      var bad = f.querySelector('[aria-invalid="true"]');
      if (bad) { bad.focus(); return; }
      if (TV.api.live()) {                                                              // producción
        var btn = f.querySelector('button[type=submit]'), label = btn.textContent; btn.disabled = true; btn.textContent = Q.t('sending');
        TV.api.post('/api/contact', { name: d.name, email: d.email, message: d.message, privacy: !!d.privacy, lang: Q.lang, hp: d.hp || '', _e: F.elapsed() }).then(function (r) {
          btn.disabled = false; btn.textContent = label;
          if (r && r.ok) { out.hidden = false; out.className = 'notice ok'; out.innerHTML = '<strong>' + TV.esc(Q.t('message_received')) + '</strong>'; out.setAttribute('tabindex', '-1'); out.focus(); f.reset(); return; }
          var why = F.explain(f, r);
          if (why === true) return;                                                     // error de un campo: ya está marcado y enfocado
          var mail = ((TV.meta && TV.meta.recipients) || ['info@grupotorivac.com'])[0];
          out.hidden = false; out.className = 'notice';
          out.innerHTML = why ? TV.esc(why) : TV.esc(Q.t('send_failed')) + ' <a href="mailto:' + TV.esc(mail) + '">' + TV.esc(mail) + '</a>';
          out.setAttribute('tabindex', '-1'); out.focus();
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
