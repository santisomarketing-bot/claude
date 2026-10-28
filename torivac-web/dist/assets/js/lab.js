/**
 * [LAB] Osciloscopio esquemático de un variador de tensión (categoría «Variadores de tensión»).
 * Dos ondas sinusoidales: la de ENTRADA (230 V, fija, discontinua) y la de SALIDA (cobre) cuya amplitud sigue al mando (0–230 V).
 * Es una ilustración: no mide nada ni promete prestaciones. Respeta prefers-reduced-motion (onda quieta) y funciona con teclado (input range).
 * Secciones: [WAVE] generador de la onda · [UI] mando y lectura · [LOOP] animación suave
 * Depende de: nada (JS vanilla). Marcado generado por templates.mjs → waveLab().
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-lab]');
  if (!root) return;

  // ───────────────────────────────────────── [WAVE] y = 120 − A·sin(2π·ciclos·x/640 + fase); amplitud máxima 100 u. (de 240 de alto)
  var W = 640, MID = 120, MAX = 100, CYCLES = 3, STEP = 8;
  function path(amp, phase) {
    var d = '';
    for (var x = 0; x <= W; x += STEP) {
      var y = MID - amp * Math.sin((2 * Math.PI * CYCLES * x) / W + phase);
      d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
    }
    return d;
  }

  // ───────────────────────────────────────── [UI] mando (0–230 V) → amplitud y lectura
  var range = root.querySelector('[data-wl-range]'), outPath = root.querySelector('[data-wl-out-path]'), inPath = root.querySelector('[data-wl-in]'), read = root.querySelector('[data-wl-readout]');
  var phase = 0, volts = Number(range.value), shown = volts, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw() {
    inPath.setAttribute('d', path(MAX, phase));
    outPath.setAttribute('d', path((MAX * shown) / 230, phase));
  }
  range.addEventListener('input', function () {
    volts = Number(range.value);
    read.textContent = volts + ' V ~';
    range.setAttribute('aria-valuetext', volts + ' V');
    if (reduce) { shown = volts; draw(); }
  });
  range.setAttribute('aria-valuetext', volts + ' V');

  // ───────────────────────────────────────── [LOOP] la fase avanza y la amplitud «persigue» al mando (sensación de regulación continua); se pausa fuera de pantalla
  var raf = 0, visible = true;
  function tick() {
    phase += 0.045;
    shown += (volts - shown) * 0.18;
    draw();
    raf = visible ? requestAnimationFrame(tick) : 0;
  }
  draw();
  if (!reduce) {
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }).observe(root);
    raf = requestAnimationFrame(tick);
  }
})();
