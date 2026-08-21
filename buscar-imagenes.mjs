#!/usr/bin/env node
// ============================================================================
//  Buscador de imágenes de referencia (Google Imágenes)
//  --------------------------------------------------------------------------
//  Abre Google Imágenes con TU navegador, busca un tema, hace scroll para
//  cargar resultados y te deja una GALERÍA HTML de referencias para diseñar
//  portadas y contenido de LinkedIn / Instagram / blog.
//
//  Cada tarjeta enlaza a la imagen ORIGINAL (a máxima resolución) y a la
//  PÁGINA FUENTE (para dar crédito / ver el contexto). Las miniaturas se
//  descargan a tu ordenador para que la galería se vea sin conexión.
//
//  Uso:
//    npm install
//    npx playwright install chromium         (solo la primera vez)
//    npm run imagenes -- "branding minimalista"
//    npm run imagenes -- "gimnasio" --para=instagram --n=60 --abrir
//
//  Flags:
//    --para=TIPO     ajusta formato y palabras clave segun el destino:
//                    linkedin | linkedin-banner | instagram | instagram-story | blog
//    --n=N           numero de referencias a recoger (def. 40)
//    --out=carpeta   carpeta base de salida (def. referencias)
//    --abrir         abre la galeria en el navegador al terminar
//    --full          intenta ademas descargar las imagenes a resolucion original
//    --headless      ejecuta el navegador oculto (por defecto es visible)
//    --scrolls=N     tope de scrolls para cargar resultados (def. 12)
//
//  Nota honesta: Google Imagenes indexa imagenes de terceros. Sirven como
//  REFERENCIA / inspiracion. Revisa la licencia en la pagina fuente antes de
//  reutilizar una imagen en una publicacion. Para stock con licencia lista
//  para usar, mira la skill de Adobe Express del equipo.
// ============================================================================

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, ".chrome-profile"); // sesion persistente (en .gitignore)
const CHROME_PATH = process.env.CHROME_PATH || undefined;
const LAUNCH_BASE = CHROME_PATH ? { executablePath: CHROME_PATH } : {};

// ---- parseo de flags -------------------------------------------------------
const rawArgs = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of rawArgs) {
  if (a.startsWith("--")) {
    const [k, v] = a.replace(/^--/, "").split("=");
    flags[k] = v === undefined ? true : v;
  } else {
    positional.push(a);
  }
}

const CONSULTA = (flags.q ? String(flags.q) : positional.join(" ")).trim();
const PARA = String(flags.para ?? "").toLowerCase();
const N = parseInt(flags.n ?? "40", 10);
const OUT_BASE = String(flags.out ?? "referencias");
const ABRIR = Boolean(flags.abrir);
const FULL = Boolean(flags.full);
const HEADLESS = Boolean(flags.headless);
const MAX_SCROLLS = parseInt(flags.scrolls ?? "12", 10);

// ---- presets por destino ---------------------------------------------------
// Cada preset añade palabras clave utiles y fija el filtro de proporcion (tbs)
// de Google: iar:xw (panoramica), iar:w (apaisada), iar:s (cuadrada), iar:t (vertical).
const PRESETS = {
  "linkedin": {
    kw: "post design cover graphic",
    tbs: "iar:w", // apaisada (imagen de post ~1200x627)
    etiqueta: "LinkedIn · post apaisado",
  },
  "linkedin-banner": {
    kw: "banner cover header design",
    tbs: "iar:xw", // panoramica (portada/banner 1584x396)
    etiqueta: "LinkedIn · banner panoramico",
  },
  "instagram": {
    kw: "instagram post design layout",
    tbs: "iar:s", // cuadrada (1080x1080)
    etiqueta: "Instagram · post cuadrado",
  },
  "instagram-story": {
    kw: "instagram story design vertical",
    tbs: "iar:t", // vertical (1080x1920)
    etiqueta: "Instagram · story vertical",
  },
  "blog": {
    kw: "blog header hero cover illustration",
    tbs: "iar:w,isz:l", // apaisada y grande
    etiqueta: "Blog · cabecera apaisada",
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slug = (s) =>
  (s || "busqueda")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "busqueda";

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

if (!CONSULTA) {
  console.error(`\n✗ Falta el tema a buscar.\n`);
  console.error(`  Ejemplos:`);
  console.error(`    npm run imagenes -- "branding minimalista"`);
  console.error(`    npm run imagenes -- "cafeteria de especialidad" --para=instagram --n=60 --abrir`);
  console.error(`\n  Presets --para=  ${Object.keys(PRESETS).join(" | ")}\n`);
  process.exit(1);
}

// ---- construccion de la URL de busqueda ------------------------------------
const preset = PRESETS[PARA] || null;
const consultaFinal = preset ? `${CONSULTA} ${preset.kw}` : CONSULTA;

const urlBusqueda = () => {
  const p = new URLSearchParams({
    q: consultaFinal,
    tbm: "isch", // Google Imagenes
    hl: "es",
    safe: "active",
  });
  if (preset?.tbs) p.set("tbs", preset.tbs);
  return `https://www.google.com/search?${p.toString()}`;
};

// ---- consentimiento de cookies (primera visita) ----------------------------
async function aceptarConsent(page) {
  try {
    const enConsent =
      page.url().includes("consent.google.") ||
      (await page.$('form[action*="consent"], div[aria-modal="true"]'));
    if (!enConsent) return;
    const textos = ["Aceptar todo", "Acepto", "Accept all", "I agree", "Rechazar todo", "Reject all"];
    for (const t of textos) {
      const btn = page.locator(`button:has-text("${t}"), [role="button"]:has-text("${t}")`).first();
      if (await btn.count().catch(() => 0)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        break;
      }
    }
  } catch {
    /* si no aparece, seguimos */
  }
}

// ---- extraccion de resultados desde el DOM ---------------------------------
// Google envuelve cada resultado en un <a href=".../imgres?imgurl=...&imgrefurl=...">
// De ahi sacamos la imagen ORIGINAL (imgurl) y la PAGINA FUENTE (imgrefurl).
async function extraeResultados(page) {
  return page.evaluate(() => {
    const out = [];
    const vistos = new Set();
    const anchors = Array.from(document.querySelectorAll('a[href*="imgres"], a[href*="/imgres"]'));
    for (const a of anchors) {
      let href = a.href || a.getAttribute("href") || "";
      if (!href) continue;
      let imgurl = "";
      let imgrefurl = "";
      try {
        const u = new URL(href, location.origin);
        imgurl = u.searchParams.get("imgurl") || "";
        imgrefurl = u.searchParams.get("imgrefurl") || "";
      } catch {
        continue;
      }
      if (!imgurl) continue;
      if (vistos.has(imgurl)) continue;
      vistos.add(imgurl);
      const img = a.querySelector("img") || a.parentElement?.querySelector("img");
      const thumb = img ? img.currentSrc || img.src || "" : "";
      const titulo = (img && (img.alt || img.getAttribute("alt"))) || "";
      out.push({ imgurl, imgrefurl, thumb, titulo });
    }
    return out;
  });
}

// ---- descarga de una URL a fichero -----------------------------------------
async function descarga(url, destino) {
  try {
    if (url.startsWith("data:")) {
      const coma = url.indexOf(",");
      const meta = url.slice(5, coma); // p.ej. image/jpeg;base64
      const datos = url.slice(coma + 1);
      const buf = meta.includes("base64")
        ? Buffer.from(datos, "base64")
        : Buffer.from(decodeURIComponent(datos), "utf8");
      writeFileSync(destino, buf);
      return true;
    }
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.google.com/" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return false; // basura / pixel vacio
    writeFileSync(destino, buf);
    return true;
  } catch {
    return false;
  }
}

// ---- abrir un fichero en el navegador / visor por defecto ------------------
function abrirFichero(ruta) {
  const plat = process.platform;
  const cmd = plat === "darwin" ? "open" : plat === "win32" ? "start" : "xdg-open";
  const child =
    plat === "win32"
      ? spawn("cmd", ["/c", "start", "", ruta], { detached: true, stdio: "ignore" })
      : spawn(cmd, [ruta], { detached: true, stdio: "ignore" });
  child.unref();
}

// ---- galeria HTML ----------------------------------------------------------
function generaGaleria({ consulta, etiqueta, items, carpeta }) {
  const fecha = new Date().toLocaleString("es-ES");
  const tarjetas = items
    .map((it, i) => {
      const src = it.thumbLocal || it.thumb || it.imgurl;
      const fuente = it.imgrefurl || it.imgurl;
      const dominio = (() => {
        try {
          return new URL(fuente).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })();
      const titulo = escapeHtml(it.titulo || `Referencia ${i + 1}`);
      return `      <figure class="card">
        <a class="thumb" href="${escapeHtml(it.imgurl)}" target="_blank" rel="noopener" title="Abrir imagen original">
          <img loading="lazy" src="${escapeHtml(src)}" alt="${titulo}">
        </a>
        <figcaption>
          <p class="tit">${titulo}</p>
          <div class="links">
            <a href="${escapeHtml(it.imgurl)}" target="_blank" rel="noopener">Original</a>
            <a href="${escapeHtml(fuente)}" target="_blank" rel="noopener">${escapeHtml(dominio || "Fuente")}</a>
          </div>
        </figcaption>
      </figure>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Referencias · ${escapeHtml(consulta)}</title>
<style>
  :root { --bg:#0b0d10; --card:#14181d; --line:#232a31; --tx:#e8edf2; --mut:#8b97a3; --acc:#5eead4; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--tx);
         font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  header { position:sticky; top:0; z-index:5; padding:20px 28px;
           background:rgba(11,13,16,.86); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
  h1 { margin:0 0 4px; font-size:20px; letter-spacing:-.2px; }
  h1 span { color:var(--acc); }
  .meta { color:var(--mut); font-size:13px; }
  .meta b { color:var(--tx); font-weight:600; }
  main { padding:22px 28px 60px; }
  .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); }
  .card { margin:0; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden;
          display:flex; flex-direction:column; transition:transform .12s ease, border-color .12s ease; }
  .card:hover { transform:translateY(-3px); border-color:var(--acc); }
  .thumb { display:block; aspect-ratio:4/3; background:#0f1317; overflow:hidden; }
  .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  figcaption { padding:10px 12px 12px; }
  .tit { margin:0 0 8px; font-size:12.5px; color:var(--tx); max-height:2.8em; overflow:hidden; }
  .links { display:flex; gap:8px; }
  .links a { flex:1; text-align:center; text-decoration:none; font-size:12px; padding:6px 8px;
             border:1px solid var(--line); border-radius:8px; color:var(--mut); background:#0f1317;
             white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .links a:first-child { color:#04211d; background:var(--acc); border-color:var(--acc); font-weight:600; }
  footer { color:var(--mut); font-size:12px; padding:0 28px 40px; }
</style>
</head>
<body>
<header>
  <h1>Referencias · <span>${escapeHtml(consulta)}</span></h1>
  <div class="meta">
    <b>${items.length}</b> resultados${etiqueta ? ` · ${escapeHtml(etiqueta)}` : ""} ·
    generado el ${escapeHtml(fecha)}
  </div>
</header>
<main>
  <div class="grid">
${tarjetas}
  </div>
</main>
<footer>
  Imágenes indexadas por Google como <b>referencia visual</b>. Revisa la licencia en la
  página fuente antes de reutilizar una imagen en una publicación.
</footer>
</body>
</html>`;
}

// ---- principal -------------------------------------------------------------
(async () => {
  console.log(`\n▶ Buscador de imágenes de referencia`);
  console.log(`  tema="${CONSULTA}"${preset ? `  para=${PARA} (${preset.etiqueta})` : ""}  n=${N}\n`);

  const carpeta = join(__dirname, OUT_BASE, slug(CONSULTA) + (PARA ? "-" + slug(PARA) : ""));
  const dirThumbs = join(carpeta, "miniaturas");
  const dirFull = join(carpeta, "originales");
  mkdirSync(dirThumbs, { recursive: true });
  if (FULL) mkdirSync(dirFull, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    viewport: { width: 1360, height: 940 },
    args: ["--disable-blink-features=AutomationControlled"],
    ...LAUNCH_BASE,
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await page.goto(urlBusqueda(), { waitUntil: "domcontentloaded", timeout: 45000 });
    await aceptarConsent(page);
    // tras el consent puede recargar; nos aseguramos de estar en la busqueda
    if (!page.url().includes("tbm=isch") && !page.url().includes("udm=2")) {
      await page.goto(urlBusqueda(), { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    }

    // scroll hasta reunir N resultados (o agotar scrolls)
    let items = [];
    let sinCambios = 0;
    for (let s = 0; s < MAX_SCROLLS; s++) {
      items = await extraeResultados(page);
      process.stdout.write(`\r  cargando… ${items.length} referencias`);
      if (items.length >= N) break;
      const antes = items.length;
      await page.mouse.wheel(0, 2600);
      await sleep(1100);
      // intenta pulsar "Mostrar mas resultados" si aparece
      const masBtn = page.locator('input[type="button"], button', { hasText: /más resultados|more results/i }).first();
      if (await masBtn.count().catch(() => 0)) {
        await masBtn.click({ timeout: 1500 }).catch(() => {});
        await sleep(900);
      }
      const despues = (await extraeResultados(page)).length;
      sinCambios = despues === antes ? sinCambios + 1 : 0;
      if (sinCambios >= 3) break; // no cargan mas
    }
    process.stdout.write("\n");

    items = (await extraeResultados(page)).slice(0, N);
    if (!items.length) {
      console.error(
        `\n✗ No se han extraído resultados. Google pudo mostrar un captcha o cambiar el layout.\n` +
          `  Prueba sin --headless para resolver el captcha a mano, o reintenta en un rato.\n`
      );
      await ctx.close();
      process.exit(2);
    }

    // descarga de miniaturas (y opcional originales)
    console.log(`  descargando miniaturas…`);
    let okThumb = 0;
    let okFull = 0;
    await Promise.all(
      items.map(async (it, i) => {
        const nombre = String(i + 1).padStart(3, "0");
        if (it.thumb) {
          const dest = join(dirThumbs, `${nombre}.jpg`);
          if (await descarga(it.thumb, dest)) {
            it.thumbLocal = "miniaturas/" + nombre + ".jpg";
            okThumb++;
          }
        }
        if (FULL && it.imgurl) {
          const ext = (it.imgurl.match(/\.(jpe?g|png|webp|gif)(?=$|\?)/i)?.[1] || "jpg").toLowerCase();
          const dest = join(dirFull, `${nombre}.${ext}`);
          if (await descarga(it.imgurl, dest)) okFull++;
        }
      })
    );

    // ficheros de salida
    const html = generaGaleria({
      consulta: CONSULTA,
      etiqueta: preset?.etiqueta || "",
      items,
      carpeta,
    });
    const rutaHtml = join(carpeta, "galeria.html");
    writeFileSync(rutaHtml, html, "utf8");
    writeFileSync(
      join(carpeta, "referencias.json"),
      JSON.stringify(
        {
          consulta: CONSULTA,
          consultaFinal,
          preset: PARA || null,
          fecha: new Date().toISOString(),
          total: items.length,
          items: items.map((it) => ({
            titulo: it.titulo,
            original: it.imgurl,
            fuente: it.imgrefurl,
            miniatura: it.thumbLocal || null,
          })),
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(`\n✓ Listo: ${items.length} referencias`);
    console.log(`  miniaturas descargadas: ${okThumb}/${items.length}${FULL ? `   originales: ${okFull}/${items.length}` : ""}`);
    console.log(`  carpeta:  ${carpeta}`);
    console.log(`  galería:  ${rutaHtml}`);
    console.log(`  datos:    ${join(carpeta, "referencias.json")}\n`);

    if (ABRIR) {
      abrirFichero(rutaHtml);
      console.log(`  (abriendo la galería en tu navegador…)\n`);
    } else {
      console.log(`  Ábrela con:  npm run imagenes -- ... --abrir   (o abre galeria.html a mano)\n`);
    }
  } finally {
    await ctx.close().catch(() => {});
  }
})().catch((e) => {
  console.error("\n✗ Error:", e?.message || e, "\n");
  process.exit(1);
});
