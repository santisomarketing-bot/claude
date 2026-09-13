#!/usr/bin/env node
// ============================================================================
//  Google Maps bulk scan (Sesion 8 de AEO_PLAN.md)
//  --------------------------------------------------------------------------
//  Automatiza en masa lo que una extension de Local SEO hace ficha a ficha:
//  sacar CID/Place ID/NAP+ de una lista de negocios, o ver en que posicion del
//  local pack aparece una marca simulando busquedas desde distintas ciudades
//  (via UULE). Usa TU sesion de Google (como scan.mjs con LinkedIn).
//
//  Uso:
//    npm install
//    npx playwright install chromium        (si no esta instalado)
//    npm run maps-login                     (abre navegador, inicias sesion a mano)
//    npm run maps-scan -- --mode=extract --input=negocios.txt
//    npm run maps-scan -- --mode=grid --input=grid.txt --out=grid-cliente
//    npm run maps-scan -- --mode=heatmap --center=41.3874,2.1686 --term="peluqueria" \
//      --target="Cliente S.L." --radius-km=5 --size=5 --out=radar-cliente
//    npm run maps-scan -- --mode=prospect --input=categorias.txt --out=prospectos-cliente
//
//  Formato de --input segun --mode (heatmap no usa --input, ver flags):
//    extract:  una busqueda o URL de Maps por linea
//              "Cliente S.L. Barcelona"
//              "https://www.google.com/maps/place/..."
//    grid:     "termino;ciudad;marca_objetivo" por linea (marca_objetivo opcional)
//              "agencia de marketing;Barcelona;Santiso Marketing"
//    prospect: "categoria;ubicacion" por linea
//              "gimnasio;Vigo"
//
//  Flags:
//    --mode=extract|grid|heatmap|prospect  que hacer (def. extract)
//    --input=fichero       lista de entradas (extract/grid/prospect, obligatorio salvo --login-only)
//    --center=LAT,LNG      centro de la cuadricula (heatmap, obligatorio)
//    --term=TEXTO          termino de busqueda (heatmap, obligatorio)
//    --target=TEXTO        nombre del negocio a ubicar en los resultados (heatmap)
//    --radius-km=N         radio de la cuadricula en km (heatmap, def. 5)
//    --size=N              tamano de la cuadricula NxN, impar (heatmap, def. 5)
//    --min-reviews=N       umbral de resenas para marcar un negocio como prospecto (prospect, def. 15)
//    --check-website=N     a cuantos prospectos (los que menos resenas tienen) confirmarles
//                          si tienen web, abriendo su ficha (prospect, def. 0 = no comprobar)
//    --out=nombre          base del fichero de salida (def. maps-scan)
//    --delay=MS            pausa entre negocios/busquedas (def. 3000, ritmo humano)
//    --login-only          solo abre el navegador para iniciar sesion y guarda la sesion
//    --debug               muestra el resultado de cada fila en consola
//
//  El CSV de --mode=heatmap (row,col,distancia_km,direccion,posicion) es el
//  formato que espera directamente el panel "Radar Local" (Artifact) — ver
//  MAPS_SCAN.md.
//
//  AVISO: automatizar Google Maps/Search a escala roza sus Terminos de Servicio.
//  Se usa TU sesion y un ritmo lento para minimizar riesgo, pero el riesgo no es
//  cero. Pensado para uso interno de la agencia sobre sus propios clientes, no
//  para scrapear terceros a gran escala. Ver MAPS_SCAN.md.
// ============================================================================

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, ".chrome-profile-maps"); // sesion propia, separada de LinkedIn (en .gitignore)
const CHROME_PATH = process.env.CHROME_PATH || undefined;
const LAUNCH_BASE = CHROME_PATH ? { executablePath: CHROME_PATH } : {};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);
const MODE = args.mode ?? "extract";
const INPUT = args.input ? String(args.input) : null;
const OUT = args.out ?? "maps-scan";
const DELAY = parseInt(args.delay ?? "3000", 10);
const LOGIN_ONLY = Boolean(args["login-only"]);
const DEBUG = Boolean(args.debug);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- UULE: simula que la busqueda se hace desde una ubicacion concreta -----
// Formato documentado y usado por varias herramientas de rank tracking; no hay
// API oficial de Google para esto, asi que Google puede dejar de respetarlo en
// cualquier momento sin aviso. Verificar manualmente el primer uso.
export function buildUule(location) {
  const encoded = Buffer.from(String.fromCharCode(location.length) + location, "latin1").toString("base64");
  return `w+CAIQICI${encoded}`;
}

// ---- CID / Place ID desde la URL de una ficha de Google Maps ----------------
// Google mete "!1s0x<hex_place>:0x<hex_cid>" en la URL de cualquier ficha. Es
// estructura de URL, no del DOM visual, asi que es mas estable que el resto.
export function extractIdsFromMapsUrl(url) {
  const m = url.match(/!1s(0x[0-9a-fA-F]+):(0x[0-9a-fA-F]+)/);
  if (!m) return { placeFtid: null, cid: null };
  return { placeFtid: `${m[1]}:${m[2]}`, cid: BigInt(m[2]).toString(10) };
}

function readLines(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function toCSV(rows, cols) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return cols.join(",") + "\n" + rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n") + "\n";
}

// ---- modo extract: CID/Place ID/NAP+ de un negocio --------------------------
// Selectores basados en el DOM tipico (locale es-ES) de Google Maps a fecha de
// esta sesion. Si Google cambia el HTML esto se rompe - mismo mantenimiento que
// "Support new LinkedIn DOM" en scan.mjs. Probar primero con --debug sobre un
// negocio conocido antes de correr una lista grande.
async function extractOne(page, query) {
  const isUrl = /^https?:\/\//i.test(query);
  const target = isUrl ? query : `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/maps\/place\//, { timeout: 15000 }).catch(() => {});
  await sleep(1500);

  const url = page.url();
  const { placeFtid, cid } = extractIdsFromMapsUrl(url);

  const getAttr = async (selector, attr) => {
    try {
      return (await page.locator(selector).first().getAttribute(attr)) || "";
    } catch {
      return "";
    }
  };
  const getText = async (selector) => {
    try {
      return (await page.locator(selector).first().innerText()) || "";
    } catch {
      return "";
    }
  };

  const nombre = await getText("h1");
  const direccionLabel = await getAttr('button[data-item-id="address"]', "aria-label");
  const telefonoLabel = await getAttr('button[data-item-id^="phone"]', "aria-label");
  const web = await getAttr('a[data-item-id="authority"]', "href");
  const ratingLabel = await getAttr('span[role="img"][aria-label*="estrella" i], span[role="img"][aria-label*="star" i]', "aria-label");

  return {
    query,
    url,
    placeFtid: placeFtid || "",
    cid: cid || "",
    nombre,
    direccion: direccionLabel.replace(/^direcci[oó]n:\s*/i, "").replace(/^address:\s*/i, ""),
    telefono: telefonoLabel.replace(/^tel[eé]fono:\s*/i, "").replace(/^phone:\s*/i, ""),
    web,
    rating: ratingLabel,
    error: "",
  };
}

async function runExtract(page) {
  const queries = readLines(INPUT);
  const rows = [];
  for (const q of queries) {
    try {
      const row = await extractOne(page, q);
      rows.push(row);
      if (DEBUG) console.log(`  ✓ ${q} -> cid=${row.cid || "?"} ${row.nombre}`);
    } catch (err) {
      rows.push({ query: q, url: "", placeFtid: "", cid: "", nombre: "", direccion: "", telefono: "", web: "", rating: "", error: err.message });
      if (DEBUG) console.log(`  ✗ ${q} -> ${err.message}`);
    }
    await sleep(DELAY + Math.floor(Math.random() * 1000));
  }
  return rows;
}

// ---- modo grid: ranking en el local pack por ubicacion simulada -------------
// La deteccion del "local pack" (los 3 resultados de Maps dentro de la busqueda
// normal) es lo mas propenso a romperse si Google cambia el layout - mismo aviso
// que arriba, revisar con --debug antes de correr en masa.
async function gridOne(page, term, location, target) {
  const uule = buildUule(location);
  const url = `https://www.google.com/search?q=${encodeURIComponent(term)}&uule=${encodeURIComponent(uule)}&hl=es`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(1500);

  const bloques = await page
    .locator('div[role="feed"] div[role="article"], div[jsname][data-cid]')
    .allInnerTexts()
    .catch(() => []);

  const lista = bloques.map((t) => t.split("\n")[0].trim()).filter(Boolean);
  const posicion = target ? (lista.findIndex((n) => n.toLowerCase().includes(target.toLowerCase())) + 1 || null) : null;
  const competidoresAntes = posicion ? lista.slice(0, posicion - 1) : lista;

  return {
    term,
    location,
    target: target || "",
    posicion,
    competidoresAntes: competidoresAntes.join(" | "),
    totalDetectados: lista.length,
    error: "",
  };
}

async function runGrid(page) {
  const lineas = readLines(INPUT);
  const rows = [];
  for (const linea of lineas) {
    const [term, location, target] = linea.split(";").map((s) => (s || "").trim());
    try {
      const row = await gridOne(page, term, location, target);
      rows.push(row);
      if (DEBUG) console.log(`  ✓ "${term}" en ${location} -> posicion ${row.posicion ?? "no detectada"}`);
    } catch (err) {
      rows.push({ term, location, target: target || "", posicion: null, competidoresAntes: "", totalDetectados: 0, error: err.message });
      if (DEBUG) console.log(`  ✗ "${term}" en ${location} -> ${err.message}`);
    }
    await sleep(DELAY + Math.floor(Math.random() * 1000));
  }
  return rows;
}

// ---- modo heatmap: cuadricula geografica real alrededor de un punto --------
// A diferencia del modo grid (que simula ciudades con nombre vía UULE, no
// oficial), esto navega directo a una URL de Google Maps con coordenadas
// explicitas (formato real y documentado: /maps/search/<termino>/@lat,lng,zoom).
// Sigue dependiendo del DOM para leer la lista de resultados - mismo aviso que
// el resto del archivo.
const KM_POR_GRADO_LAT = 111.32;

export function direccionCompass(dr, dc) {
  if (dr === 0 && dc === 0) return "Centro";
  const angulo = Math.atan2(-dr, dc) * (180 / Math.PI);
  const dirs = ["E", "NE", "N", "NO", "O", "SO", "S", "SE"];
  const idx = Math.round(((angulo + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export function puntoDeCuadricula(centerLat, centerLng, row, col, centerIdx, stepKm) {
  const dr = row - centerIdx;
  const dc = col - centerIdx;
  const distanciaKm = stepKm * Math.sqrt(dr * dr + dc * dc);
  const deltaLat = (-dr * stepKm) / KM_POR_GRADO_LAT;
  const deltaLng = (dc * stepKm) / (KM_POR_GRADO_LAT * Math.cos((centerLat * Math.PI) / 180));
  return {
    row,
    col,
    lat: +(centerLat + deltaLat).toFixed(6),
    lng: +(centerLng + deltaLng).toFixed(6),
    distancia_km: +distanciaKm.toFixed(1),
    direccion: direccionCompass(dr, dc),
  };
}

async function heatmapPoint(page, term, lat, lng, target) {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(term)}/@${lat},${lng},15z`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(1800);

  const bloques = await page
    .locator('div[role="feed"] div[role="article"], div[jsname][data-cid]')
    .allInnerTexts()
    .catch(() => []);

  const lista = bloques.map((t) => t.split("\n")[0].trim()).filter(Boolean);
  const posicion = target ? (lista.findIndex((n) => n.toLowerCase().includes(target.toLowerCase())) + 1 || null) : null;

  return { posicion, totalDetectados: lista.length };
}

async function runHeatmap(page) {
  if (!args.center || !args.term) {
    console.error("Falta --center=LAT,LNG y --term=... para --mode=heatmap");
    process.exit(1);
  }
  const [centerLat, centerLng] = String(args.center).split(",").map(Number);
  const size = parseInt(args.size ?? "5", 10);
  const radiusKm = parseFloat(args["radius-km"] ?? "5");
  const term = String(args.term);
  const target = args.target ? String(args.target) : "";
  const centerIdx = (size - 1) / 2;
  const stepKm = radiusKm / centerIdx;

  const rows = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const p = puntoDeCuadricula(centerLat, centerLng, row, col, centerIdx, stepKm);
      try {
        const { posicion } = await heatmapPoint(page, term, p.lat, p.lng, target);
        rows.push({ ...p, posicion, error: "" });
        if (DEBUG) console.log(`  ✓ [${p.row},${p.col}] ${p.direccion} ${p.distancia_km}km -> posicion ${posicion ?? "no encontrada"}`);
      } catch (err) {
        rows.push({ ...p, posicion: null, error: err.message });
        if (DEBUG) console.log(`  ✗ [${p.row},${p.col}] ${p.direccion} -> ${err.message}`);
      }
      await sleep(DELAY + Math.floor(Math.random() * 1000));
    }
  }
  return rows;
}

// ---- modo prospect: negocios con poca presencia digital (leads de SEO local)
// Lista los resultados de una busqueda de categoria+ubicacion (misma lectura
// del panel de resultados que gridOne), parsea rating/resenas del texto de
// cada tarjeta, y marca como "prospecto" a los que tienen pocas resenas -
// senal de que todavia no invirtieron en su presencia digital. Opcionalmente
// confirma si tienen web abriendo la ficha de los N con menos resenas
// (reutiliza extractOne, mas lento, por eso es opt-in con --check-website).
export function parseRatingYResenas(textoCrudo) {
  const m = textoCrudo.match(/(\d[.,]\d)\s*\(?([\d.,]+)?\)?/);
  if (!m) return { rating: null, resenas: null };
  const rating = Number(m[1].replace(",", "."));
  const resenas = m[2] ? Number(m[2].replace(/[.,]/g, "")) : null;
  return { rating: Number.isNaN(rating) ? null : rating, resenas: Number.isNaN(resenas) ? null : resenas };
}

async function prospectOne(page, categoria, ubicacion) {
  const uule = buildUule(ubicacion);
  const url = `https://www.google.com/search?q=${encodeURIComponent(categoria)}&uule=${encodeURIComponent(uule)}&hl=es`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(1500);

  const bloques = await page
    .locator('div[role="feed"] div[role="article"], div[jsname][data-cid]')
    .allInnerTexts()
    .catch(() => []);

  return bloques
    .map((texto) => {
      const nombre = (texto.split("\n")[0] || "").trim();
      const { rating, resenas } = parseRatingYResenas(texto);
      return { nombre, rating, resenas };
    })
    .filter((b) => b.nombre);
}

async function runProspect(page) {
  const lineas = readLines(INPUT);
  const minResenas = parseInt(args["min-reviews"] ?? "15", 10);
  const checkWebsite = parseInt(args["check-website"] ?? "0", 10);
  const rows = [];

  for (const linea of lineas) {
    const [categoria, ubicacion] = linea.split(";").map((s) => (s || "").trim());
    let candidatos = [];
    try {
      candidatos = await prospectOne(page, categoria, ubicacion);
    } catch (err) {
      rows.push({ categoria, ubicacion, nombre: "", rating: "", resenas: "", tieneWeb: "", error: err.message });
      if (DEBUG) console.log(`  ✗ "${categoria}" en ${ubicacion} -> ${err.message}`);
      await sleep(DELAY + Math.floor(Math.random() * 1000));
      continue;
    }

    const prospectos = candidatos
      .filter((c) => c.resenas == null || c.resenas < minResenas)
      .sort((a, b) => (a.resenas ?? 0) - (b.resenas ?? 0));

    let comprobados = 0;
    for (const c of prospectos) {
      let tieneWeb = "sin comprobar";
      if (comprobados < checkWebsite) {
        try {
          const detalle = await extractOne(page, `${c.nombre} ${ubicacion}`);
          tieneWeb = detalle.web ? "si" : "no";
        } catch {
          tieneWeb = "error";
        }
        comprobados++;
        await sleep(DELAY + Math.floor(Math.random() * 1000));
      }
      rows.push({ categoria, ubicacion, nombre: c.nombre, rating: c.rating ?? "", resenas: c.resenas ?? "", tieneWeb, error: "" });
      if (DEBUG) console.log(`  · ${c.nombre} — ${c.rating ?? "?"}★ (${c.resenas ?? "?"} reseñas) web=${tieneWeb}`);
    }
    await sleep(DELAY + Math.floor(Math.random() * 1000));
  }
  return rows;
}

// ---- main --------------------------------------------------------------------
async function main() {
  if (MODE !== "heatmap" && !INPUT && !LOGIN_ONLY) {
    console.error("Falta --input=fichero (ver MAPS_SCAN.md para el formato segun --mode)");
    process.exit(1);
  }

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
    ...LAUNCH_BASE,
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  await page.goto("https://www.google.com/maps", { waitUntil: "domcontentloaded" });

  const loggedIn = await page
    .locator('a[aria-label*="Iniciar sesión" i], a[aria-label*="Sign in" i]')
    .first()
    .isVisible()
    .then((visible) => !visible)
    .catch(() => true);

  if (LOGIN_ONLY || !loggedIn) {
    console.log("🔑 Inicia sesion en tu cuenta de Google en la ventana que se abrió.");
    console.log("   Cuando la veas activa, volvé acá y pulsá ENTER.");
    await new Promise((res) => {
      process.stdin.resume();
      process.stdin.once("data", () => res());
    });
    if (LOGIN_ONLY) {
      console.log("✅ Sesión guardada. Ya podés lanzar: npm run maps-scan -- --mode=extract --input=negocios.txt");
      await ctx.close();
      process.exit(0);
    }
  }

  console.log(`\n▶ maps-scan — modo=${MODE} out=${OUT}.{csv,json}\n`);

  const runners = { grid: runGrid, heatmap: runHeatmap, prospect: runProspect, extract: runExtract };
  const columnas = {
    grid: ["term", "location", "target", "posicion", "competidoresAntes", "totalDetectados", "error"],
    heatmap: ["row", "col", "distancia_km", "direccion", "posicion", "lat", "lng", "error"],
    prospect: ["categoria", "ubicacion", "nombre", "rating", "resenas", "tieneWeb", "error"],
    extract: ["query", "url", "placeFtid", "cid", "nombre", "direccion", "telefono", "web", "rating", "error"],
  };
  const rows = await (runners[MODE] ?? runExtract)(page);
  const cols = columnas[MODE] ?? columnas.extract;

  writeFileSync(join(__dirname, `${OUT}.json`), JSON.stringify(rows, null, 2));
  writeFileSync(join(__dirname, `${OUT}.csv`), toCSV(rows, cols));
  console.log(`\n${rows.length} fila(s) procesadas. Salida: ${OUT}.csv / ${OUT}.json\n`);

  await ctx.close();
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("\n✖ Error:", err.message);
    process.exit(1);
  });
}
