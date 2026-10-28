/**
 * [CAPTCHA] CAPTCHA invisible OPCIONAL (Cloudflare Turnstile) en los formularios de contacto y de pedido.
 * Solo se activa si el servidor lo dice: GET /api/health trae `features.turnstile.sitekey` cuando en config.php (o en el Worker) están puestas la clave pública Y la secreta. Sin eso este
 * fichero no hace nada, no carga nada de terceros y los formularios se envían como siempre (la defensa de siempre sigue: trampa, tiempo mínimo, texto plano, topes por visitante).
 * Cuando está activo:
 *   · al cargar la página se pregunta al servidor (una petición pequeña) y se enseña el aviso «protegido por Cloudflare Turnstile» (la web NO usa reCAPTCHA ni dice que lo use);
 *   · el script de Cloudflare (challenges.cloudflare.com) NO se descarga al cargar la página: solo cuando alguien empieza a usar el formulario (primer foco o clic), así no pesa en la
 *     carga ni en el LCP, y quien solo mira la web no habla con Cloudflare;
 *   · al enviar, el widget se ejecuta de forma invisible y el token viaja en `turnstileToken`; si Cloudflare necesita una interacción, su casilla aparece en el hueco del formulario;
 *   · cada token vale una vez y 5 minutos: se pide uno nuevo en cada envío;
 *   · si no se consigue token (bloqueador de contenido, sin red, 20 s de espera) el formulario se envía igualmente SIN token: el servidor decide (con el CAPTCHA activo responde 400
 *     «Verificación anti-spam fallida», código `captcha`) y la página lo explica en el idioma del visitante (TV.Forms).
 * API: TV.Captcha.init(form) engancha el formulario (aviso + precarga) · TV.Captcha.attach(form, body) → Promise<body> con `turnstileToken` si hay · TV.Captcha.token(form) → Promise<string> ('' si no hay).
 * Secciones: [SERVIDOR] [SCRIPT] [WIDGET] [API]
 * Depende de: quote.js (TV.Quote, TV.api). El hueco del widget ([data-captcha-slot]) y el aviso ([data-captcha-note], oculto) los pone la plantilla del formulario.
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote;
  var C = (TV.Captcha = {});
  /** Dirección oficial del script de Turnstile (render=explicit: no busca widgets solo, los creamos nosotros). */
  var SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var feature = null, scriptP = null;
  /** Milisegundos que se espera a un token antes de enviar sin él (modificable: la prueba del navegador lo acorta). */
  C.wait = 20000;

  // ───────────────────────────────────────── [SERVIDOR]
  /** Promise<string>: la clave pública de Turnstile que anuncia el servidor, o '' si el CAPTCHA no está activado (o no hay API, o el servidor no responde). Una sola consulta por página. Nunca rechaza. */
  function sitekey() {
    if (!feature) {
      feature = !TV.api.live() ? Promise.resolve('') : fetch(TV.api.base() + '/api/health', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { var t = j && j.features && j.features.turnstile; return t && /^[0-9A-Za-z_-]{8,80}$/.test(String(t.sitekey || '')) ? String(t.sitekey) : ''; })
        .catch(function () { return ''; });
    }
    return feature;
  }

  // ───────────────────────────────────────── [SCRIPT]
  /** Promise<turnstile>: descarga el script de Cloudflare la primera vez (y lo vuelve a intentar si falló: bloqueador, red). */
  function load() {
    if (scriptP) return scriptP;
    scriptP = new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      var s = document.createElement('script');
      s.src = SRC; s.async = true; s.defer = true;
      /** El script cargó: ya existe `window.turnstile`. */
      s.onload = function () { if (window.turnstile) resolve(window.turnstile); else reject(new Error('turnstile')); };
      /** El script no se pudo descargar (bloqueador de contenido, sin red). */
      s.onerror = function () { reject(new Error('blocked')); };
      document.head.appendChild(s);
    });
    scriptP.catch(function () { scriptP = null; });
    return scriptP;
  }

  // ───────────────────────────────────────── [WIDGET]
  /** Estado del widget de un formulario: {id, slot, waiting}. */
  function state(form) { return form.__captcha || (form.__captcha = { id: null, slot: form.querySelector('[data-captcha-slot]'), waiting: null }); }
  /** Entrega el token (o '' si falló) a quien lo está esperando. */
  function settle(w, tk) { var f = w.waiting; w.waiting = null; if (f) f(tk); }
  /** Promise<turnstile>: carga el script y crea el widget del formulario (invisible hasta que se ejecuta; solo se ve si Cloudflare pide una interacción). */
  function ensure(form, key) {
    var w = state(form);
    return load().then(function (ts) {
      if (w.id === null) w.id = ts.render(w.slot, {
        sitekey: key, execution: 'execute', appearance: 'interaction-only', size: 'flexible', theme: 'light', language: Q.lang, 'response-field': false,
        /** Cloudflare dio el token: se entrega a quien espera el envío. */
        callback: function (tk) { settle(w, tk); },
        /** Cloudflare no pudo comprobar (error de red, clave rechazada…): se entrega '' y el envío sigue sin token. */
        'error-callback': function () { settle(w, ''); return true; },
        /** La interacción que pedía Cloudflare caducó: se entrega ''. */
        'timeout-callback': function () { settle(w, ''); },
        /** Cloudflare necesita que la persona pulse su casilla: se le hace sitio y se acerca el hueco a la vista. */
        'before-interactive-callback': function () { w.slot.classList.add('on'); w.slot.scrollIntoView({ block: 'center', behavior: 'smooth' }); },
        /** La persona ya la pulsó: el hueco vuelve a no ocupar nada. */
        'after-interactive-callback': function () { w.slot.classList.remove('on'); }
      });
      return ts;
    });
  }

  // ───────────────────────────────────────── [API]
  /** Promise<string>: un token nuevo de Turnstile para este envío, o '' si el CAPTCHA no está activo o no se pudo conseguir. Nunca rechaza. */
  C.token = function (form) {
    return sitekey().then(function (key) {
      if (!key || !state(form).slot) return '';
      var w = state(form);
      return ensure(form, key).then(function (ts) {
        return new Promise(function (resolve) {
          var done = false, timer = setTimeout(function () { finish(''); }, C.wait);
          /** Termina la espera una sola vez con el token (o ''). */
          function finish(tk) { if (done) return; done = true; clearTimeout(timer); w.waiting = null; resolve(tk); }
          w.waiting = finish;
          try { ts.reset(w.id); ts.execute(w.slot); } catch (e) { finish(''); }
        });
      });
    }).catch(function () { return ''; });
  };
  /** Promise<object>: `body` con `turnstileToken` si hay CAPTCHA y se consiguió token; si no, tal cual. */
  C.attach = function (form, body) {
    return C.token(form).then(function (tk) { if (tk) body.turnstileToken = tk; return body; });
  };
  /** Engancha un formulario: si el servidor activó el CAPTCHA, enseña el aviso y precarga el script cuando alguien empieza a usarlo. Sin CAPTCHA no hace nada. */
  C.init = function (form) {
    if (!form || form.__captchaInit || !TV.api.live()) return;
    form.__captchaInit = true;
    sitekey().then(function (key) {
      var slot = form.querySelector('[data-captcha-slot]');
      if (!key || !slot) return;
      var note = form.querySelector('[data-captcha-note]'); if (note) note.hidden = false;
      /** Primer uso del formulario: se descarga el script (no antes). */
      function warm() { form.removeEventListener('focusin', warm); form.removeEventListener('pointerdown', warm); ensure(form, key).catch(function () { /* sin script: al enviar se manda sin token y el servidor decide */ }); }
      form.addEventListener('focusin', warm); form.addEventListener('pointerdown', warm);
    });
  };
})();
