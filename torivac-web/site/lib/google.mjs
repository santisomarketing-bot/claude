// [GOOGLE] Configuración de Google Analytics 4, Google Ads y Search Console (site/google.config.json) y todo lo que de ella depende en la compilación.
//   · MODO «runtime» (compilaciones con servidor, que son todas las que se publican): los IDs de GA4/Ads y las conversiones se guardan en el SERVIDOR y se cambian desde el panel del manager (Ajustes → Google);
//     la web lleva siempre el aviso (oculto) y consent.js, que pregunta al servidor (GET /api/google) qué hay configurado; sin IDs allí no sale NADA visible, no se pide nada a Google y no se pone ninguna cookie.
//     google.config.json solo da los valores de ARRANQUE (si el servidor no tiene IDs) y los de Search Console, que sí deben ir en el HTML (la etiqueta) o ser un archivo.
//   · Sin servidor (demo con doble clic o web estática sola): como antes, solo con los IDs de este archivo; con los IDs vacíos NO se añade nada.
//   · Los IDs son públicos (salen en el código de cualquier web); aquí no hay claves. Si uno está mal escrito la compilación se detiene con el motivo (un ID roto dejaría la medición muerta sin avisar).
//   · Producción (--base sin --staging): modo «live». Pruebas (--staging): modo «test» = se enseña el aviso y se registran los eventos en la consola, pero NO se descarga nada de Google.
//   · Sin --base (demo con doble clic) no hay medición de ningún tipo.
// Lo usa site/build.mjs; el comportamiento en el navegador está en site/assets/js/consent.js; las reglas de la CSP, en site/lib/hosting.mjs. Guía: docs/GOOGLE.md
import fs from 'node:fs';

/** Formatos aceptados (los que genera Google): medición GA4 «G-…» (o etiqueta de Google «GT-…»), cuenta de Ads «AW-…», etiqueta de conversión, token de la etiqueta meta de Search Console y nombre de su archivo HTML. */
export const RX = {
  ga4: /^(?:G|GT)-[A-Z0-9]{6,14}$/,
  ads: /^AW-\d{6,12}$/,
  label: /^[A-Za-z0-9_-]{8,40}$/,
  meta: /^[A-Za-z0-9_-]{20,100}$/,
  file: /^google[0-9a-f]{16}\.html$/,
};

/** IDs ficticios del paquete de pruebas con `--google-demo`: enseñan el aviso de cookies y registran eventos en la consola, pero en modo «test» no salen a Google. Producción los rechaza. */
export const DEMO = { ga4: 'G-DEMO000000', ads: 'AW-0000000000', conversions: { quote: 'AW-0000000000/DEMOquote0000', contact: 'AW-0000000000/DEMOcontact00' }, searchConsole: { meta: '', htmlFile: '' } };

/** Texto limpio de un valor de configuración ('' si no es una cadena). */
const s = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Lee y comprueba la configuración. Devuelve { cfg, errors }: cfg ya normalizado ({ ga4, ads, conv:{quote,contact}, meta, htmlFile }) y la lista de errores (vacía si todo está bien).
 * Una conversión puede escribirse completa («AW-123456789/AbC…») o solo con la etiqueta («AbC…», que usa el ID de Ads); si solo hay conversiones completas, el ID de Ads se toma de ellas.
 */
export function normalize(raw = {}) {
  const errors = [];
  const cfg = { ga4: s(raw.ga4), ads: s(raw.ads), conv: { quote: '', contact: '' }, meta: s(raw.searchConsole?.meta), htmlFile: s(raw.searchConsole?.htmlFile) };
  if (cfg.ga4 && !RX.ga4.test(cfg.ga4)) errors.push(`ga4 «${cfg.ga4}» no parece un ID de medición de GA4 (G-XXXXXXXXXX)`);
  if (cfg.ads && !RX.ads.test(cfg.ads)) errors.push(`ads «${cfg.ads}» no parece un ID de Google Ads (AW-123456789)`);
  for (const k of ['quote', 'contact']) {
    const v = s(raw.conversions?.[k]);
    if (!v) continue;
    const m = /^(AW-\d{6,12})\/([A-Za-z0-9_-]{8,40})$/.exec(v);
    if (m) {
      if (cfg.ads && m[1] !== cfg.ads) errors.push(`conversions.${k} usa ${m[1]}, pero ads es ${cfg.ads}`);
      if (!cfg.ads) cfg.ads = m[1];
      cfg.conv[k] = v;
    } else if (RX.label.test(v)) {
      if (!cfg.ads) errors.push(`conversions.${k} es solo la etiqueta «${v}»: falta el ID de Ads (ads)`);
      else cfg.conv[k] = `${cfg.ads}/${v}`;
    } else errors.push(`conversions.${k} «${v}» no es una etiqueta de conversión (AW-123456789/AbCdEfGhIjK o solo AbCdEfGhIjK)`);
  }
  if (cfg.meta && !RX.meta.test(cfg.meta)) errors.push('searchConsole.meta debe ser solo el token del atributo content de la etiqueta (sin <meta …>)');
  if (cfg.htmlFile && !RX.file.test(cfg.htmlFile)) errors.push(`searchConsole.htmlFile «${cfg.htmlFile}» no es el nombre de un archivo de verificación (googleXXXXXXXXXXXXXXXX.html)`);
  return { cfg, errors };
}

/**
 * Configuración efectiva de ESTA compilación.
 *   file: ruta de google.config.json · base: --base (vacío = demo sin servidor) · staging: --staging · demo: --google-demo (IDs ficticios, solo con --staging)
 * Devuelve { active, test, ga4, ads, conv, verify: { meta, file }, errors } — `active`: hay algo que medir (aviso + script); `test`: no se descarga nada de Google.
 */
export function loadGoogle({ file, base = '', staging = false, demo = false, runtime = false, env = process.env }) {
  const path = env.TORIVAC_GOOGLE_CONFIG || file;
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') return { ...inactive(), errors: [`${path}: ${e.message}`] }; }
  if (demo) {
    if (!staging) return { ...inactive(), errors: ['--google-demo solo se puede usar con --staging (los IDs ficticios nunca van a producción)'] };
    raw = DEMO;
  }
  const { cfg, errors } = normalize(raw);
  if (errors.length) return { ...inactive(), errors };
  if (!base) return inactive();                                                                  // demo con doble clic: sin servidor no hay medición
  const rt = !!runtime;                                                                           // con servidor: los IDs se leen de él en el navegador; la compilación solo deja lista la maquinaria
  const active = rt || !!(cfg.ga4 || cfg.ads);
  return {
    active, runtime: rt, test: staging, ga4: cfg.ga4, ads: cfg.ads, conv: cfg.conv, demo,
    csp: rt ? { ga4: true, ads: true } : { ga4: !!cfg.ga4, ads: !!cfg.ads },                    // qué dominios de Google abre la política de seguridad (en runtime, los dos conjuntos: lo que se active desde el panel no puede quedar bloqueado)
    verify: staging ? { meta: '', file: '' } : { meta: cfg.meta, file: cfg.htmlFile },           // el entorno de pruebas es noindex: no se verifica en Search Console
    errors: [],
  };
}

/** Configuración sin nada activo. */
function inactive() { return { active: false, runtime: false, csp: { ga4: false, ads: false }, test: false, ga4: '', ads: '', conv: { quote: '', contact: '' }, demo: false, verify: { meta: '', file: '' }, errors: [] }; }

/** Datos que lee consent.js (bloque <script type="application/json" id="tv-google">). Solo IDs públicos (los de arranque), el modo y si debe preguntar al servidor (`runtime`). */
export function bootData(g) {
  return { v: 2, mode: g.test ? 'test' : 'live', runtime: !!g.runtime, ga4: g.ga4, ads: g.ads, conv: g.conv, ttl: 365 };
}

/** Etiqueta meta de verificación de Search Console ('' si no hay token). Va en todas las páginas; no mide nada. */
export function verifyMeta(g) {
  return g.verify.meta ? `<meta name="google-site-verification" content="${g.verify.meta}">` : '';
}

/** Contenido del archivo HTML de verificación de Search Console (Google lo exige exactamente así). */
export const verifyFileBody = (name) => `google-site-verification: ${name}`;

/**
 * Orígenes de Google que la política de seguridad (CSP) debe dejar pasar, por directiva. Solo en modo «live» y solo los de lo que está configurado:
 * con solo GA4 no se abre nada de Ads. Fuente: la guía oficial de CSP de Google para gtag.js; docs/GOOGLE.md explica cómo ampliar si Google cambia de dominio.
 */
export function cspHosts(g) {
  const out = { script: [], connect: [], img: [], frame: [] };
  if (!g.active || g.test || !(g.csp.ga4 || g.csp.ads)) return out;
  out.script.push('https://www.googletagmanager.com');
  out.connect.push('https://*.googletagmanager.com');
  out.img.push('https://*.googletagmanager.com');
  if (g.csp.ga4) {
    out.connect.push('https://*.google-analytics.com', 'https://*.analytics.google.com');
    out.img.push('https://*.google-analytics.com');
  }
  if (g.csp.ads) {
    out.script.push('https://www.googleadservices.com', 'https://*.doubleclick.net', 'https://www.google.com');
    out.connect.push('https://*.doubleclick.net', 'https://www.google.com', 'https://pagead2.googlesyndication.com', ...TLDS.map((x) => `https://www.google.${x}`));
    out.img.push('https://*.doubleclick.net', 'https://www.google.com', 'https://www.googleadservices.com', ...TLDS.map((x) => `https://www.google.${x}`));
    out.frame.push('https://*.doubleclick.net');
  }
  return out;
}
/** Dominios nacionales de Google por los que Ads puede enviar la conversión según el país del visitante (los mercados de la web: España, Francia, Alemania). */
const TLDS = ['es', 'fr', 'de'];
