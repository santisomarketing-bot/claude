#!/usr/bin/env node
// ============================================================================
//  NAP-W: presencia en directorios locales (Sesion 11 de AEO_PLAN.md)
//  --------------------------------------------------------------------------
//  NAP-W = Name, Address, Phone, Website. Este script comprueba, para una
//  lista de directorios locales, si el negocio aparece listado (via
//  "site:<directorio> <nombre>" en Google) y te da el link para verificarlo
//  a mano. Usa la misma sesion de Google que maps-scan.mjs/serp-scan.mjs.
//
//  OJO - alcance real: esto comprueba PRESENCIA (aparece o no en cada
//  directorio), no compara nombre/direccion/telefono/web campo a campo entre
//  directorios - cada directorio tiene su propio HTML y hacerlo bien para
//  todos de forma confiable no entra en el alcance de este script. Para
//  confirmar consistencia real, abri el link que te da cada fila y compara
//  a mano.
//
//  Uso:
//    npm install
//    npx playwright install chromium
//    npm run maps-login                     (misma sesion que maps-scan.mjs)
//    npm run napw-check -- --name="Cliente S.L." --out=napw-cliente
//
//  Flags:
//    --name=TEXTO         nombre del negocio a buscar (obligatorio)
//    --directories=fichero  lista propia de dominios de directorios, uno por
//                           linea (opcional, si no se usa la lista por defecto)
//    --out=nombre         base del fichero de salida (def. napw-check)
//    --delay=MS           pausa entre directorios (def. 3000, ritmo humano)
//    --headless           corre sin ventana (mismo aviso que maps-scan.mjs)
//    --login-only         solo abre el navegador para confirmar/iniciar sesion
//    --debug              muestra el resultado de cada directorio en consola
//
//  AVISO: igual que maps-scan.mjs/serp-scan.mjs - automatizar Google Search a
//  escala roza sus Terminos de Servicio. Uso interno de la agencia, ritmo
//  lento. Ver NAPW_CHECK.md.
// ============================================================================

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
const NAME = args.name ? String(args.name) : null;
const OUT = args.out ?? "napw-check";
const DELAY = parseInt(args.delay ?? "3000", 10);
const LOGIN_ONLY = Boolean(args["login-only"]);
const DEBUG = Boolean(args.debug);
const HEADLESS = Boolean(args.headless);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Directorios locales comunes (España + generalistas). Ajustable con
// --directories=fichero.txt (un dominio por linea) si te interesan otros.
export const DIRECTORIOS_DEFAULT = [
  "paginasamarillas.es",
  "qdq.com",
  "cylex.es",
  "europages.es",
  "yelp.es",
  "foursquare.com",
  "trustpilot.com",
  "guiaempresas.universia.es",
  "11870.com",
  "hotfrog.es",
];

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

// ---- una comprobacion: site:<directorio> "<nombre>" ------------------------
async function checkDirectorio(page, nombre, directorio) {
  const query = `site:${directorio} "${nombre}"`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=es`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(1200);

  const hrefs = await page
    .locator("#rso a:has(h3)")
    .evaluateAll((els) => els.map((el) => el.href))
    .catch(() => []);

  const encontrado = hrefs.length > 0;
  return { directorio, encontrado, url: hrefs[0] || "", totalResultados: hrefs.length, error: "" };
}

async function run(page) {
  const directorios = args.directories ? readLines(args.directories) : DIRECTORIOS_DEFAULT;
  const rows = [];
  for (const directorio of directorios) {
    try {
      const row = await checkDirectorio(page, NAME, directorio);
      rows.push(row);
      if (DEBUG) console.log(`  ${row.encontrado ? "✓" : "✗"} ${directorio} — ${row.encontrado ? row.url : "no encontrado"}`);
    } catch (err) {
      rows.push({ directorio, encontrado: false, url: "", totalResultados: 0, error: err.message });
      if (DEBUG) console.log(`  ✗ ${directorio} -> ${err.message}`);
    }
    await sleep(DELAY + Math.floor(Math.random() * 1000));
  }
  return rows;
}

async function main() {
  if (!NAME && !LOGIN_ONLY) {
    console.error("Falta --name=\"Nombre del negocio\"");
    process.exit(1);
  }
  if (HEADLESS && LOGIN_ONLY) {
    console.error("--headless no tiene sentido con --login-only (necesitas ver la ventana para iniciar sesion)");
    process.exit(1);
  }

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
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
    console.log("✅ Listo. Usa: npm run napw-check -- --name=\"Tu negocio\"");
    await ctx.close();
    process.exit(0);
  }

  console.log(`\n▶ napw-check — negocio="${NAME}" out=${OUT}.{csv,json}\n`);
  const rows = await run(page);
  const cols = ["directorio", "encontrado", "url", "totalResultados", "error"];

  writeFileSync(join(__dirname, `${OUT}.json`), JSON.stringify(rows, null, 2));
  writeFileSync(join(__dirname, `${OUT}.csv`), toCSV(rows, cols));

  const encontrados = rows.filter((r) => r.encontrado).length;
  console.log(`\nEncontrado en ${encontrados}/${rows.length} directorios. Salida: ${OUT}.csv / ${OUT}.json`);
  console.log(`Directorios donde NO aparece (altas a priorizar): ${rows.filter((r) => !r.encontrado).map((r) => r.directorio).join(", ") || "ninguno"}\n`);

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
