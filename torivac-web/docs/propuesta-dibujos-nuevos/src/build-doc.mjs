// Documento de validación: dibujos técnicos, versión actual (izquierda) y versión nueva (derecha).
//   node build-doc.mjs <carpeta-salida>
// Páginas A4 apaisadas de tamaño fijo; se comprueba que nada desborde.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const RD = process.cwd(); // se ejecuta desde docs/propuesta-dibujos-nuevos
const { chromium } = createRequire(path.resolve(RD, '../../package.json'))('playwright');
const FONTS = path.resolve(RD, '../../site/assets/fonts');
const OUT = path.resolve(process.argv[2] || RD + '/out');
fs.mkdirSync(OUT, { recursive: true });
const M = JSON.parse(fs.readFileSync(RD + '/out/manifest.json', 'utf8'));
const TOTAL = M.length;
const FECHA = '17/11/2026';
const logo = 'data:image/png;base64,' + fs.readFileSync(RD + '/src/logo.png').toString('base64');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64 = (f, mime) => `data:${mime};base64,` + fs.readFileSync(f).toString('base64');

const CSS = `
@font-face{font-family:'Archivo';src:url('file://${FONTS}/archivo-latin-wght-normal.woff2') format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Archivo';src:url('file://${FONTS}/archivo-latin-ext-wght-normal.woff2') format('woff2');font-weight:100 900;unicode-range:U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'ArchivoX';src:url('file://${FONTS}/archivo-expanded-latin-wght-normal.woff2') format('woff2');font-weight:100 900}
@font-face{font-family:'ChivoMono';src:url('file://${FONTS}/chivo-mono-latin-wght-normal.woff2') format('woff2');font-weight:100 900}
@font-face{font-family:'Chivo Mono';src:url('file://${FONTS}/chivo-mono-latin-wght-normal.woff2') format('woff2');font-weight:100 900}
:root{--ink:#100404;--muted:#5a524d;--paper:#f6f3ec;--paper2:#e0dacf;--copper:#ba6b1e;--copper-d:#8f4a0d;--line:rgba(16,4,4,.2);--mark:#b3261e}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:var(--ink);font-family:'Archivo',sans-serif;font-size:9.4pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.page:last-child{page-break-after:auto}
header.ph{position:absolute;left:10mm;right:10mm;top:6mm;height:8mm;display:flex;align-items:center;justify-content:space-between;border-bottom:.25mm solid var(--line);font-family:'ChivoMono',monospace;font-size:6.8pt;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
header.ph .l{display:flex;align-items:center;gap:3mm}
header.ph img{height:4.4mm;display:block}
footer.pf{position:absolute;left:10mm;right:10mm;bottom:5mm;height:6mm;display:flex;align-items:flex-end;justify-content:space-between;border-top:.25mm solid var(--line);padding-top:1.2mm;font-family:'ChivoMono',monospace;font-size:6.8pt;letter-spacing:.06em;color:var(--muted)}
.body{position:absolute;left:10mm;right:10mm;top:17mm;bottom:13mm}
.kick{font-family:'ChivoMono',monospace;font-size:7.6pt;letter-spacing:.16em;text-transform:uppercase;color:var(--copper-d);font-weight:600}
h1{font-family:'ArchivoX','Archivo',sans-serif;font-weight:800;letter-spacing:-.01em;line-height:1.08}
h2{font-family:'ArchivoX','Archivo',sans-serif;font-weight:800;font-size:15pt;line-height:1.15;letter-spacing:-.01em}
h3{font-family:'ChivoMono',monospace;font-size:7.4pt;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-d);font-weight:600;border-bottom:.25mm solid var(--line);padding-bottom:.9mm;margin-bottom:2mm}
p{margin-bottom:1.6mm}
ul.pl{list-style:none}
ul.pl li{padding-left:3.8mm;position:relative;margin-bottom:1.5mm;font-size:9.2pt;line-height:1.4}
ul.pl li::before{content:'';position:absolute;left:0;top:1.9mm;width:1.5mm;height:1.5mm;background:var(--copper)}
ul.pl.no li::before{background:var(--ink)}
ol.st{list-style:none;counter-reset:s}
ol.st li{counter-increment:s;display:grid;grid-template-columns:6mm 1fr;gap:2.4mm;margin-bottom:2mm;font-size:9.2pt;line-height:1.4}
ol.st li::before{content:counter(s);width:5.2mm;height:4.4mm;background:var(--ink);color:#fff;font:700 8pt/4.4mm 'ArchivoX',sans-serif;text-align:center;margin-top:.2mm}
.box{border-left:1.3mm solid var(--copper);background:#fbf6ee;padding:2.4mm 3.6mm;font-size:8.8pt;line-height:1.42;margin-bottom:2.6mm}
.box b{font-family:'ChivoMono',monospace;font-size:6.9pt;letter-spacing:.12em;text-transform:uppercase;color:var(--copper-d);display:block;margin-bottom:.8mm}
.sw{display:flex;gap:3mm;align-items:center;margin-bottom:1.6mm;font-size:8.8pt}
.sw i{display:inline-block;width:9mm;height:3.2mm}
.cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7mm;align-items:start}
.cols>*{min-width:0}
/* portada */
.cover{background:var(--ink);color:#fff}
.cover .in{position:absolute;left:18mm;top:20mm;right:18mm;bottom:16mm}
.cover .kick{color:#f0a259}
.cover h1{font-size:34pt;margin:4mm 0 4mm;max-width:170mm}
.cover p.lead{font-size:12pt;line-height:1.45;max-width:150mm;color:#e9e3da}
.cover .demo{position:absolute;right:0;bottom:0;display:grid;grid-template-columns:1fr 1fr;gap:3mm;width:110mm}
.cover .demo .pn{height:76mm;position:relative;display:flex;align-items:center;justify-content:center}
.cover .demo .pn.a{background:#fff}.cover .demo .pn.b{background:var(--paper)}
.cover .meta{position:absolute;left:0;bottom:0;font-family:'ChivoMono',monospace;font-size:7.4pt;letter-spacing:.12em;text-transform:uppercase;color:#cfc6ba;line-height:1.9}
.cover .meta b{color:#fff;font-weight:600}
.cover img.lg{height:10mm;display:block}
/* pareja */
.item{position:absolute;left:0;right:0}
.it-h{display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;height:10.5mm;border-bottom:.35mm solid var(--ink);padding-bottom:1.3mm}
.it-h .t{display:flex;align-items:baseline;gap:3mm;min-width:0}
.it-h .no{font-family:'ArchivoX',sans-serif;font-weight:800;font-size:15pt;line-height:1}
.it-h .no small{font-size:7pt;color:var(--muted);font-weight:500;letter-spacing:.06em}
.it-h .nm{font-weight:700;font-size:10.6pt;line-height:1.15}
.it-h .cp{font-family:'ChivoMono',monospace;font-size:8.4pt;color:var(--copper-d);white-space:nowrap}
.it-h .src{font-family:'ChivoMono',monospace;font-size:6.4pt;letter-spacing:.04em;color:var(--muted);text-align:right;line-height:1.35;white-space:nowrap}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:3mm}
.pn{position:relative;border:.25mm solid var(--line);display:flex;align-items:flex-start;justify-content:center;padding:7mm 4mm 3mm}
.pn.a{background:#fff}.pn.b{background:var(--paper);--dwg-bg:#f6f3ec}
.pn .tag{position:absolute;left:0;top:0;font-family:'ChivoMono',monospace;font-size:6.8pt;letter-spacing:.14em;text-transform:uppercase;padding:.9mm 2.6mm;font-weight:600}
.pn.a .tag{background:#e9e3da;color:var(--ink)}
.pn.b .tag{background:var(--copper);color:#fff}
.pn img,.pn svg{display:block}
.ck{display:flex;gap:7mm;align-items:center;margin-top:2.6mm;font-size:8.4pt;height:5mm}
.ck span{display:inline-flex;align-items:center;gap:1.8mm;white-space:nowrap}
.ck span::before{content:'';width:3.4mm;height:3.4mm;border:.35mm solid var(--ink);display:inline-block}
.ck .fl{flex:1;border-bottom:.25mm solid var(--line);height:4mm;display:block;margin-bottom:-.6mm}
.ck .fl::before{display:none}
.nota{font-size:7.8pt;color:var(--muted);line-height:1.35;margin-top:1.4mm}
/* hoja de validación */
table.vl{width:100%;border-collapse:collapse;font-size:7.4pt}
table.vl th{font-family:'ChivoMono',monospace;font-weight:600;font-size:6.2pt;letter-spacing:.1em;text-transform:uppercase;color:var(--copper-d);text-align:left;border-bottom:.3mm solid var(--ink);padding:0 .8mm 1mm}
table.vl td{border-bottom:.2mm solid var(--line);padding:.55mm .8mm;height:6.45mm;vertical-align:middle;white-space:nowrap;overflow:hidden}
table.vl td.n{font-family:'ChivoMono',monospace;color:var(--muted);width:6mm}
table.vl td.c{width:10mm;text-align:center}
table.vl td.c i{display:inline-block;width:3mm;height:3mm;border:.3mm solid var(--ink);vertical-align:middle}
table.vl td.d{max-width:46mm;text-overflow:ellipsis}
table.vl td.d small{color:var(--muted);margin-left:1mm;font-family:'ChivoMono',monospace;font-size:6.4pt}
.sig{display:flex;gap:10mm;margin-top:4mm;font-size:8.6pt}
.sig span{display:block;border-bottom:.3mm solid var(--ink);flex:1;height:7mm;position:relative}
.sig span em{position:absolute;left:0;top:0;font-style:normal;font-family:'ChivoMono',monospace;font-size:6.4pt;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
`;

// ── dibujos
let svgN = 0;
function figure(item, side, s) {
  // s = mm por punto. side: 'old' | 'new'
  const d = item[side];
  const w = (d.pt[0] * s).toFixed(2), h = (d.pt[1] * s).toFixed(2);
  if (side === 'old') return `<img src="${b64(d.file, 'image/webp')}" alt="" style="width:${w}mm;height:${h}mm">`;
  if (d.type === 'png') return `<img src="${b64(d.file, 'image/png')}" alt="" style="width:${w}mm;height:${h}mm">`;
  const id = 'c' + (++svgN);
  let svg = fs.readFileSync(d.file, 'utf8')
    .replace(/id="c"/g, `id="${id}"`).replace(/url\(#c\)/g, `url(#${id})`)
    .replace(/ width="[\d.]+" height="[\d.]+"/, ` style="width:${w}mm;height:${h}mm"`);
  return svg;
}
function prodNames(item) {
  const n = item.products.map((p) => p.name);
  const uniq = [...new Set(n)];
  return uniq.length > 2 ? uniq.slice(0, 2).join(' · ') + ` · +${uniq.length - 2}` : uniq.join(' · ');
}
const NOTES = {
  'reostato-pc-anclaje': 'En el PDF este dibujo es una imagen. La versión nueva la vuelve a renderizar a mayor resolución, la recolorea y completa la leyenda «Anclaje Mod. PC-1000», que el recorte actual corta por abajo.',
  'cuba-de-aceite': 'En el PDF este dibujo es una imagen pixelada de 277 × 279 px. La versión nueva está redibujada a mano: mismas tres cotas (A, B, C), con el borne y el piloto en el mismo sitio. Es el único dibujo con trazado nuevo.',
};
// escala de una pareja y alto de figura
const PANEL_W = 128; // mm de dibujo útil por panel
const FIG_SINGLE = 144, FIG_HALF = 58;
function plan(item) {
  const maxW = Math.max(item.old.pt[0], item.new.pt[0]);
  const maxH = Math.max(item.old.pt[1], item.new.pt[1]);
  const sw = PANEL_W / maxW;
  const hN = sw * maxH;
  let s, figH, half = false;
  if (hN <= FIG_HALF / 0.72) { half = true; s = Math.min(sw, FIG_HALF / maxH); figH = Math.min(FIG_HALF, maxH * s); }
  else { s = Math.min(sw, FIG_SINGLE / maxH); figH = maxH * s; }
  return { s, figH, half };
}
const OVER = 33; // título + hueco + relleno del panel + casillas + holgura
const AVAIL = 210 - 17 - 13;
function noteH(item) { return NOTES[item.id] ? 12 : 0; }

const pages = [];
let cur = null;
for (const it of M) {
  const p = plan(it);
  const need = OVER + p.figH + noteH(it);
  if (!cur || cur.used + need > AVAIL) { cur = { items: [], used: 0 }; pages.push(cur); }
  cur.items.push({ it, p, y: cur.used });
  cur.used += need + 1;
}
const NP = 2 + pages.length + 1;

function chrome(n, mid) {
  return `<header class="ph"><div class="l"><img src="${logo}" alt=""><span>Dibujos técnicos · validación del nuevo diseño</span></div><span>${mid || ''}</span></header>
<footer class="pf"><span>Documento para validar · ${FECHA}</span><span>Página ${n} de ${NP}</span></footer>`;
}

const html = [];
// 1 · portada
{
  const it = M.find((m) => m.id === 'hembrilla-hb4');
  const s = Math.min(46 / it.old.pt[0], 62 / Math.max(it.old.pt[1], it.new.pt[1]));
  html.push(`<section class="page cover"><div class="in">
<img class="lg" src="${logo}" alt="" style="filter:brightness(0) invert(1)">
<div style="margin-top:18mm"><span class="kick">Propuesta de diseño · para validar por el cliente</span>
<h1>Dibujos técnicos de producto</h1>
<p class="lead">Los ${TOTAL} dibujos que se publican en las fichas, con la versión actual a la izquierda y la versión nueva a la derecha, a la misma escala.</p></div>
<div class="meta"><b>${TOTAL}</b> dibujos · <b>${new Set(M.flatMap((m) => m.products.map((p) => p.id))).size}</b> productos<br>Torivac · torivac.santisomarketing.com<br>${FECHA}</div>
<div class="demo"><div class="pn a">${figure(it, 'old', s)}</div><div class="pn b" style="--dwg-bg:#f6f3ec">${figure(it, 'new', s)}</div></div>
</div></section>`);
}
// 2 · qué cambia y cómo validar
{
  const nVec = M.filter((m) => m.kind === 'vector').length;
  html.push(`<section class="page">${chrome(2, 'Léelo antes de comparar')}<div class="body">
<span class="kick">Cómo leer este documento</span><h2 style="margin:1mm 0 4mm">Qué cambia y qué no en la versión nueva</h2>
<div class="cols">
<div><h3>Lo que no cambia</h3><ul class="pl no">
<li><b>Medidas, cotas, flechas, letras y referencias.</b> En ${nVec} de los ${TOTAL} dibujos cada línea sale del trazado vectorial del PDF del fabricante; no se ha medido ni retocado nada a mano.</li>
<li><b>Qué dibujo lleva cada producto</b> y el orden en que aparecen en la ficha.</li>
<li><b>Los textos dentro del dibujo</b> (Ø, ROSCA, VA…) siguen como en el PDF y no se traducen; no forman parte de esta propuesta.</li></ul>
<div class="box" style="margin-top:3mm"><b>A la misma escala</b>Cada pareja se muestra con el mismo tamaño real, para que las diferencias de línea y color se vean sin que el tamaño engañe.</div></div>
<div><h3>Lo que cambia</h3><ul class="pl">
<li><b>Color con los de la web:</b> contorno en tinta cálida; cotas, flechas y letras en cobre.</li>
<li><b>Grosores en tres niveles</b>, iguales en todos los dibujos (silueta, contorno, detalle y cotas).</li>
<li><b>Rellenos grises</b> de secciones y bases sustituidos por un tinte cobre suave.</li>
<li><b>Fondo transparente:</b> el dibujo toma el papel de la ficha y deja de ser un rectángulo blanco.</li>
<li><b>Vectorial (SVG):</b> nítido al ampliar y en pantallas de alta densidad. Peso total similar: unos 600 KB comprimidos frente a los 700 KB de hoy.</li>
<li><b>Marcas de esquina</b> de plano técnico; son un detalle opcional y se pueden quitar.</li>
<li><b>Separación original entre vistas:</b> la versión actual elimina los espacios en blanco entre vistas; la nueva los conserva.</li></ul>
<div style="margin-top:2.6mm"><div class="sw"><i style="background:#100404"></i>Tinta: contorno y siluetas</div><div class="sw"><i style="background:#a45c18"></i>Cobre: cotas, flechas y letras</div><div class="sw"><i style="background:#e8d5bb"></i>Tinte cobre: rellenos y secciones</div></div></div>
<div><h3>Dos excepciones</h3><ul class="pl">
<li><b>N.º 43 · Reóstato con anclaje PC-1000.</b> En el PDF es una imagen. Se ha vuelto a renderizar a más resolución y recoloreado, y se completa la leyenda «Anclaje Mod. PC-1000», que el recorte actual corta.</li>
<li><b>N.º 44 · Cuba de aceite.</b> En el PDF es una imagen pixelada de 277 × 279 px. Está redibujada a mano con las mismas cotas A, B y C; es el único dibujo con trazado nuevo y conviene mirarlo con más atención.</li></ul>
<h3 style="margin-top:4mm">Cómo validar</h3><ol class="st">
<li><span>Compara cada pareja: a la izquierda la versión actual, a la derecha la nueva.</span></li>
<li><span>Marca <b>Aprobar nueva</b>, <b>Mantener actual</b> o <b>Corregir</b> y anota qué cambiar.</span></li>
<li><span>Devuelve la <b>hoja de validación</b> (última página) o este documento marcado.</span></li></ol>
<div class="box"><b>Después de aprobar</b>Las versiones aprobadas sustituyen a las actuales en las fichas; las que no se aprueben siguen como están.</div></div>
</div></div></section>`);
}
// 3.. · parejas
pages.forEach((pg, pi) => {
  const first = pg.items[0].it.n, last = pg.items[pg.items.length - 1].it.n;
  const mid = first === last ? `Dibujo ${first} de ${TOTAL}` : `Dibujos ${first}–${last} de ${TOTAL}`;
  const off = 0;
  const items = pg.items.map(({ it, p, y: y0 }) => {
    const y = y0 + off;
    const note = NOTES[it.id] ? `<div class="nota"><b>Nota:</b> ${esc(NOTES[it.id])}</div>` : '';
    return `<div class="item" style="top:${y.toFixed(2)}mm">
<div class="it-h"><div class="t"><span class="no">${String(it.n).padStart(2, '0')}<small> /${TOTAL}</small></span><span class="nm">${esc(prodNames(it))}</span>${it.caption ? `<span class="cp">${esc(it.caption)}</span>` : ''}</div>
<div class="src">${esc(it.pdf)} · pág. ${it.page}<br>${esc(it.id)}</div></div>
<div class="pair"><div class="pn a" style="height:${(p.figH + 10).toFixed(2)}mm"><span class="tag">Versión actual</span>${figure(it, 'old', p.s)}</div>
<div class="pn b" style="height:${(p.figH + 10).toFixed(2)}mm"><span class="tag">Versión nueva</span>${figure(it, 'new', p.s)}</div></div>
<div class="ck"><span>Aprobar nueva</span><span>Mantener actual</span><span>Corregir:</span><span class="fl"></span></div>${note}</div>`;
  }).join('');
  html.push(`<section class="page">${chrome(3 + pi, mid)}<div class="body">${items}</div></section>`);
});
// última · hoja de validación
{
  const half = Math.ceil(M.length / 2);
  const col = (arr) => `<table class="vl"><thead><tr><th>N.º</th><th>Dibujo</th><th>Nueva</th><th>Actual</th><th>Corregir</th></tr></thead><tbody>${arr.map((m) => `<tr><td class="n">${String(m.n).padStart(2, '0')}</td><td class="d">${esc(prodNames(m).replace(/^Reostatos y potenciometros bobinados/, 'Reóstatos bobinados'))}${m.caption ? `<small>${esc(m.caption)}</small>` : ''}</td><td class="c"><i></i></td><td class="c"><i></i></td><td class="c"><i></i></td></tr>`).join('')}</tbody></table>`;
  html.push(`<section class="page">${chrome(NP, 'Hoja de validación')}<div class="body">
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:2.4mm"><div><span class="kick">Hoja de validación</span><h2 style="margin-top:.6mm">Una marca por dibujo</h2></div><div style="font-size:8.2pt;color:var(--muted);max-width:120mm;text-align:right">Marca una casilla por dibujo. Los comentarios de «Corregir» van en la página del dibujo o en el correo de respuesta, citando el número.</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">${col(M.slice(0, half))}${col(M.slice(half))}</div>
<div class="sig"><span><em>Validado por</em></span><span><em>Fecha</em></span><span><em>Firma</em></span></div>
</div></section>`);
}

const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Torivac · Dibujos técnicos · validación del nuevo diseño</title><style>${CSS}</style></head><body>${html.join('\n')}</body></html>`;
const htmlFile = path.join(OUT, 'doc.html');
fs.writeFileSync(htmlFile, doc);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + htmlFile);
await page.evaluate(() => document.fonts.ready);
// control de desbordes
const issues = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.page').forEach((pg, i) => {
    const r = pg.getBoundingClientRect();
    pg.querySelectorAll('.body *, .cover .in *').forEach((el) => {
      if (el.closest('svg') && el.tagName !== 'svg') return;
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) return;
      if (b.bottom > r.bottom - 0.5 * 3.78 || b.right > r.right + 0.5 || b.left < r.left - 0.5) out.push(`p${i + 1}: ${el.tagName}.${el.className && el.className.baseVal === undefined ? el.className : ''} sale por (${Math.round(b.right - r.right)},${Math.round(b.bottom - r.bottom)})`);
    });
    // contenido de .body dentro de su caja
    const body = pg.querySelector('.body');
    if (body) {
      const bb = body.getBoundingClientRect();
      body.querySelectorAll('.item').forEach((it) => { const ib = it.getBoundingClientRect(); if (ib.bottom > bb.bottom + 1) out.push(`p${i + 1}: .item pasa el cuerpo en ${Math.round(ib.bottom - bb.bottom)}px`); });
    }
  });
  return out;
});
console.log('desbordes:', issues.length); issues.slice(0, 30).forEach((x) => console.log('  ', x));
const pdfFile = path.join(OUT, 'Torivac-Dibujos-tecnicos-validacion-cliente.pdf');
await page.pdf({ path: pdfFile, width: '297mm', height: '210mm', printBackground: true });
await browser.close();
console.log('páginas previstas', NP, '→', pdfFile, (fs.statSync(pdfFile).size / 1024 | 0) + ' KB');
