// [THEMES] Aspectos de la web (fuente única): lista, orden en el selector y script de arranque que aplica el elegido ANTES del primer pintado.
// Ver docs/DISENO-TEMAS.md. Para añadir un aspecto: añadirlo aquí, su hoja en site/build.mjs [CSS] y su texto `theme_<nombre>` en site/lib/i18n.mjs.

/** Aspectos disponibles, en el orden del selector. El primero es el que se publica por defecto salvo que se pida otro con --theme. */
export const THEMES = ['ficha', 'clasico', 'original'];

/** Script de la cabecera (solo con selector de aspecto): aplica ?tema=<aspecto> o la elección guardada (localStorage `tv-theme`) antes de pintar, sin parpadeo. Es constante: la CSP lo admite por su huella (ver site/lib/hosting.mjs). */
export function themeBootJs(themes = THEMES) {
  const alt = themes.join('|'), cond = themes.map((t) => `v==='${t}'`).join('||');
  return `(function(){try{var m=/[?&]tema=(${alt})(?:&|$)/.exec(location.search),k='tv-theme',v=m?m[1]:localStorage.getItem(k);if(m)localStorage.setItem(k,v);if(${cond})document.documentElement.setAttribute('data-theme',v)}catch(e){}})();`;
}
