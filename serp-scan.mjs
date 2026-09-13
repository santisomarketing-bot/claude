#!/usr/bin/env node
// ============================================================================
//  Analisis de SERP de Google: AI Overview / Ads / Local Pack (Sesion 9)
//  --------------------------------------------------------------------------
//  Para cada busqueda, detecta si aparece AI Overview, cuantos Ads hay, y si
//  hay Local Pack (y en que posicion aparece una marca, si se le pasa). Usa tu
//  sesion de Google - mismo patron y misma sesion que maps-scan.mjs.
//
//  Uso:
//    npm install
//    npx playwright install chromium
//    npm run maps-login                     (misma sesion que usa maps-scan.mjs)
//    npm run serp-scan -- --input=terminos.txt --out=serp-cliente
//
//  Formato de --input: una busqueda por linea, "termino;ubicacion;marca_objetivo"
//  (ubicacion y marca_objetivo opcionales):
//    mejor agencia de marketing en barcelona
//    gimnasio en sevilla;Sevilla;Fitness Park
//
//  Flags:
//    --input=fichero   lista de busquedas (obligatorio salvo --login-only)
//    --out=nombre      base del fichero de salida (def. serp-scan)
//    --delay=MS        pausa entre busquedas (def. 3000, ritmo humano)
//    --login-only      solo abre el navegador para confirmar/iniciar sesion
//    --debug           muestra el resultado de cada fila en consola
//
//  AVISO: igual que maps-scan.mjs - automatizar Google Search a escala roza
//  sus Terminos de Servicio. Uso interno de la agencia, ritmo lento. Ver
//  SERP_SCAN.md.
// ============================================================================

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildUule } from "./maps-scan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, ".chrome-profile-maps"); // misma sesion de Google que maps-scan.mjs
const CHROME_PATH = process.env.CHROME_PATH || undefined;
const LAUNCH_BASE = CHROME_PATH ? { executablePath: CHROME_PATH } : {};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);
const INPUT = args.input ? String(args.input) : null;
const OUT = args.out ?? "serp-scan";
const DELAY = parseInt(args.delay ?? "3000", 10);
const LOGIN_ONLY = Boolean(args["login-only"]);
const DEBUG = Boolean(args.debug);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Frases de aviso que Google muestra junto a un AI Overview. Se usan frases de
// disclosure (mas estables que clases CSS/data-attrid, que cambian seguido)
// en vez de un selector visual.
const AI_OVERVIEW_MARCADORES = [
  "la ia puede cometer errores",
  "generative ai is experimental",
  "las respuestas generadas por ia",
  "ai overview",
];

export function detectaAiOverview(textoPagina) {
  const t = textoPagina.toLowerCase();
  return AI_OVERVIEW_MARCADORES.some((m) => t.includes(m));
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

// ---- una busqueda: AI Overview + Ads + Local Pack --------------------------
// Selectores/heuristicas dependen del HTML/texto actual de Google - mismo
// aviso que el resto de este repo: probar con --debug antes de correr en masa.
async function analizarBusqueda(page, term, location, target) {
  const params = new URLSearchParams({ q: term, hl: "es" });
  if (location) params.set("uule", buildUule(location));
  const url = `https://www.google.com/search?${params.toString()}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(1500);

  const textoPagina = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  const aiOverview = detectaAiOverview(textoPagina);

  const ads = await page
    .locator('span:text-is("Anuncio"), span:text-is("Ad")')
    .count()
    .catch(() => 0);

  const bloquesLocalPack = await page
    .locator('div[role="feed"] div[role="article"], div[jsname][data-cid]')
    .allInnerTexts()
    .catch(() => []);
  const listaLocalPack = bloquesLocalPack.map((t) => t.split("\n")[0].trim()).filter(Boolean);
  const localPack = listaLocalPack.length > 0;
  const posicionLocalPack = target
    ? (listaLocalPack.findIndex((n) => n.toLowerCase().includes(target.toLowerCase())) + 1 || null)
    : null;

  return { term, location: location || "", target: target || "", aiOverview, ads, localPack, posicionLocalPack, error: "" };
}

async function run(page) {
  const lineas = readLines(INPUT);
  const rows = [];
  for (const linea of lineas) {
    const [term, location, target] = linea.split(";").map((s) => (s || "").trim());
    try {
      const row = await analizarBusqueda(page, term, location, target);
      rows.push(row);
      if (DEBUG) {
        const posTxt = row.posicionLocalPack ? ` pos=${row.posicionLocalPack}` : "";
        console.log(`  ✓ "${term}"${location ? " (" + location + ")" : ""} -> AI Overview=${row.aiOverview} ads=${row.ads} local-pack=${row.localPack}${posTxt}`);
      }
    } catch (err) {
      rows.push({ term, location: location || "", target: target || "", aiOverview: false, ads: 0, localPack: false, posicionLocalPack: null, error: err.message });
      if (DEBUG) console.log(`  ✗ "${term}" -> ${err.message}`);
    }
    await sleep(DELAY + Math.floor(Math.random() * 1000));
  }
  return rows;
}

async function main() {
  if (!INPUT && !LOGIN_ONLY) {
    console.error("Falta --input=fichero (una busqueda por linea, ver SERP_SCAN.md)");
    process.exit(1);
  }

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
    ...LAUNCH_BASE,
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });

  if (LOGIN_ONLY) {
    console.log("🔑 Si te pide iniciar sesion, hacelo en la ventana que se abrió.");
    console.log("   Cuando termines, volvé acá y pulsá ENTER.");
    await new Promise((res) => {
      process.stdin.resume();
      process.stdin.once("data", () => res());
    });
    console.log("✅ Listo. Usa: npm run serp-scan -- --input=terminos.txt");
    await ctx.close();
    process.exit(0);
  }

  console.log(`\n▶ serp-scan — out=${OUT}.{csv,json}\n`);
  const rows = await run(page);
  const cols = ["term", "location", "target", "aiOverview", "ads", "localPack", "posicionLocalPack", "error"];

  writeFileSync(join(__dirname, `${OUT}.json`), JSON.stringify(rows, null, 2));
  writeFileSync(join(__dirname, `${OUT}.csv`), toCSV(rows, cols));
  console.log(`\n${rows.length} busqueda(s) analizadas. Salida: ${OUT}.csv / ${OUT}.json\n`);

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
