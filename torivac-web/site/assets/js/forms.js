/**
 * [FORMS] Ayudas comunes de los formularios públicos (contacto y pedido): contador de caracteres, aviso por campo, traducción de los errores del servidor y tiempo de relleno.
 * Los límites (atributo maxlength) y las reglas de «solo texto plano» son las del servidor (TV.PlainText, generado desde shared/plain-text.mjs): aquí solo se avisa antes y en el idioma
 * de la página; el servidor lo vuelve a comprobar SIEMPRE.
 * Secciones: [TEXTOS] · [CAMPOS] · [CONTADOR] · [SERVIDOR]
 * Depende de: quote.js (TV.Quote), app.js (TV.$, TV.$$, TV.esc), plain-text.js (opcional: sin él solo se aplica el maxlength).
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote, $$ = TV.$$;
  var F = (TV.Forms = {});
  var T0 = Date.now();
  var seq = 0;

  /** Milisegundos desde que se empezó a cargar la página: el servidor exige un mínimo (`_e`) y un robot que envía sin cargarla no lo cumple. */
  F.elapsed = function () { return Math.round(window.performance && performance.now ? performance.now() : Date.now() - T0); };

  // ───────────────────────────────────────── [TEXTOS]
  /** Texto de interfaz `key` con {n} y {max} sustituidos por los valores de `vars`. */
  function text(key, vars) {
    var s = Q.t(key);
    Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  /** Aviso, en el idioma de la página, de un código de error del servidor (plain_text, too_long, too_many_links, too_fast y captcha: no se pudo comprobar que es una persona); '' si no se conoce. `max` es el límite del campo. */
  F.codeText = function (code, max) {
    if (code === 'plain_text') return text('err_plain_text');
    if (code === 'too_long') return text('err_too_long', { max: max });
    if (code === 'too_many_links') return text('err_too_many_links', { max: TV.PlainText ? TV.PlainText.MAX_LINKS : 2 });
    if (code === 'too_fast') return text('err_too_fast');
    if (code === 'captcha') return text('captcha_failed');
    return '';
  };

  // ───────────────────────────────────────── [CAMPOS]
  /** Quita los avisos de error del formulario y la marca de campo no válido. */
  F.clear = function (form) {
    $$('.err', form).forEach(function (n) { n.remove(); });
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
  };
  /** Marca el campo `el` como no válido y pone `msg` justo debajo, enlazado con aria-describedby para que el lector de pantalla lo lea al enfocar el campo. */
  F.fail = function (el, msg) {
    var m = document.createElement('span'); m.className = 'err'; m.id = 'err-' + (++seq); m.textContent = msg;
    el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', m.id);
    var at = el.closest('label') || el, next = at.nextElementSibling;
    if (next && next.classList.contains('count-row')) at = next;                                 // el contador queda pegado al campo y el aviso va debajo
    at.insertAdjacentElement('afterend', m);
    return m;
  };
  /** Límite de caracteres del campo (su maxlength); 1000 si no lo tiene. */
  function maxOf(el) { return el.maxLength > 0 ? el.maxLength : 1000; }
  /** Revisa con las reglas del servidor los campos de texto `names` del formulario: marca los que no valen y devuelve el primero (o null si todo está bien). Sin TV.PlainText no hace nada. */
  F.checkText = function (form, names) {
    var PT = TV.PlainText, first = null;
    if (!PT) return null;
    names.forEach(function (k) {
      var el = form.elements[k]; if (!el || !el.value) return;
      var r = PT.check(el.value, { max: maxOf(el), multiline: el.tagName === 'TEXTAREA' });
      if (!r.ok) { F.fail(el, F.codeText(r.code, maxOf(el)) || text('err_plain_text')); first = first || el; }
    });
    return first;
  };

  // ───────────────────────────────────────── [CONTADOR]
  /** Contador «n / máx» bajo cada textarea con maxlength, y un aviso para lectores de pantalla solo al acercarse al límite (a 50, 20 y 10 caracteres y al llegar a él) para no leer cada letra. */
  F.counters = function (form) {
    $$('textarea[maxlength]', form).forEach(function (ta) {
      var max = ta.maxLength, row = document.createElement('span'), box = document.createElement('span'), live = document.createElement('span'), band = 999;
      row.className = 'count-row'; box.className = 'count'; box.setAttribute('aria-hidden', 'true');
      live.className = 'vh'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
      row.appendChild(box); row.appendChild(live); ta.insertAdjacentElement('afterend', row);
      /** Pone el recuento actual y, si se cruza un umbral, el aviso hablado. */
      function update() {
        var n = ta.value.length, left = max - n;
        box.textContent = n + ' / ' + max; box.classList.toggle('full', left <= 0);
        var b = left <= 0 ? 0 : left <= 10 ? 10 : left <= 20 ? 20 : left <= 50 ? 50 : 999;
        if (b !== band) { band = b; live.textContent = b === 999 ? '' : text('chars_left', { n: Math.max(0, left) }); }
      }
      ta.addEventListener('input', update); form.addEventListener('reset', function () { setTimeout(update, 0); }); update();
    });
  };

  // ───────────────────────────────────────── [SERVIDOR]
  /**
   * Muestra la respuesta de error `r` del servidor ({status, code, field, error}). Si es un error de un campo (code + field) lo marca, lo enfoca y devuelve true; si no, devuelve el
   * aviso general en el idioma de la página ('' si no es un caso conocido: quien llama muestra «no hemos podido enviarlo»).
   */
  F.explain = function (form, r) {
    if (!r) return '';
    if (r.status === 429) return text('err_rate');
    if (r.status !== 400 || !r.code) return '';
    var el = r.field && form.elements[r.field];
    if (el && F.codeText(r.code, maxOf(el))) { F.fail(el, F.codeText(r.code, maxOf(el))); el.focus(); return true; }
    return F.codeText(r.code, 0);
  };
})();
