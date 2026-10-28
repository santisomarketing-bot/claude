#!/usr/bin/env node
// [SINGLE-FILE] Convierte una página del demo en UN solo .html autosuficiente: hojas de estilo, scripts, fuentes e imágenes van dentro (base64).
//   node scripts/single_file.mjs dist/index.html entrega/Torivac-portada.html
// Sirve para enseñar la web donde no se puede descomprimir nada (vista previa del móvil, correo, un visor de archivos): se ve igual que en el navegador.
// Los enlaces a otras páginas no funcionan (cada página va suelta); para navegar, el .zip completo. Los PDF no se incrustan (siguen siendo enlaces).
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };

// ───────────────────────────────────────── [FILES] rutas locales y data: URI
/** Archivo local al que apunta una referencia del HTML o del CSS (null si es http, data:, un ancla o no existe). */
const localFile = (dir, ref) => {
  const r = String(ref || '').trim().replace(/^['"]|['"]$/g, '').split(/[?#]/)[0];
  if (!r || /^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(r)) return null;
  const f = path.resolve(dir, decodeURIComponent(r));
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
};
/** data: URI de un archivo de imagen o fuente (null si el tipo no se incrusta, p. ej. los PDF). */
const dataUri = (f) => {
  const mime = MIME[path.extname(f).toLowerCase()];
  return mime ? `data:${mime};base64,${fs.readFileSync(f).toString('base64')}` : null;
};

// ───────────────────────────────────────── [INLINE] CSS, atributos y scripts
/** CSS con cada url(...) local sustituida por su data: URI; `dir` es la carpeta del propio CSS. */
const inlineCss = (css, dir) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, ref) => {
  const f = localFile(dir, ref); const d = f && dataUri(f);
  return d ? `url(${d})` : m;                                                               // sin comillas: vale también dentro de un style="…"
});
/** Valor de un atributo de una etiqueta HTML (comillas dobles o simples); null si no lo lleva. */
const attrOf = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return m ? (m[1] ?? m[2]) : null; };

/** Página → HTML autosuficiente. Devuelve { html, images, bytes }. */
export function singleFile(inFile) {
  const dir = path.dirname(path.resolve(inFile));
  let html = fs.readFileSync(inFile, 'utf8'), images = 0;
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {                                          // hojas de estilo, icono y precargas
    const rel = (attrOf(tag, 'rel') || '').toLowerCase(), href = attrOf(tag, 'href');
    if (rel === 'preload') return '';
    const f = localFile(dir, href);
    if (!f) return tag;
    if (rel === 'stylesheet') return `<style>${inlineCss(fs.readFileSync(f, 'utf8'), path.dirname(f))}</style>`;
    const d = rel.includes('icon') && dataUri(f);
    return d ? tag.replace(href, d) : tag;
  });
  html = html.replace(/<script\b([^>]*)\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*)><\/script>/gi, (m, a1, s1, s2, a2) => {    // scripts → dentro (el orden se conserva)
    const f = localFile(dir, s1 || s2);
    return f ? `<script${a1}${a2}>${fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}</script>` : m;
  });
  /** data: URI de la imagen o fuente local a la que apunta `ref` (la cuenta en `images`); null si no hay nada que incrustar. */
  const inline = (ref) => { const f = localFile(dir, ref); const d = f && dataUri(f); if (d) images++; return d; };
  html = html.replace(/(\ssrc\s*=\s*)(?:"([^"]+)"|'([^']+)')/gi, (m, p, a, b) => { const d = inline(a || b); return d ? `${p}"${d}"` : m; });                // <img src>, <source src>
  html = html.replace(/(\ssrcset\s*=\s*)"([^"]+)"/gi, (m, p, v) => `${p}"${v.split(',').map((it) => { const [u, ...w] = it.trim().split(/\s+/); return [inline(u) || u, ...w].join(' '); }).join(', ')}"`);
  html = html.replace(/style\s*=\s*"([^"]*)"/gi, (m, v) => `style="${inlineCss(v, dir)}"`);                                                                      // fondos en línea
  return { html, images, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [inFile, outFile] = process.argv.slice(2);
  if (!inFile || !outFile) { console.error('Uso: node scripts/single_file.mjs <pagina.html> <salida.html>'); process.exit(2); }
  const r = singleFile(inFile);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, r.html);
  console.log(`✓ ${outFile} · ${(r.bytes / 1048576).toFixed(1)} MB · ${r.images} imágenes incrustadas`);
}
