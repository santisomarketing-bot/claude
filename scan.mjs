#!/usr/bin/env node
// ============================================================================
//  LinkedIn Opportunity Scanner
//  --------------------------------------------------------------------------
//  Abre TU Chrome con TU sesion de LinkedIn ya iniciada, scrollea el feed
//  N veces (por defecto 25), extrae cada post y filtra las OPORTUNIDADES
//  comerciales (gente que necesita marketing), descartando ofertas de empleo
//  y ruido publicitario.
//
//  Uso:
//    npm install
//    npx playwright install chromium        (solo la primera vez)
//    npm run login                          (abre navegador, inicias sesion a mano)
//    npm run scan -- --scrolls=25           (scrollea y extrae)
//
//  Flags:
//    --scrolls=N       numero de scrolls (def. 25)
//    --min-score=N     score minimo para considerar oportunidad (def. 4)
//    --out=fichero     base del fichero de salida (def. leads)  -> leads.csv / leads.json
//    --headful         muestra el navegador (por defecto ya es visible)
//    --login-only      solo abre el navegador para que inicies sesion y guarda la sesion
//    --delay=MS        pausa entre scrolls en ms (def. 2500, ritmo humano)
//
//  AVISO: automatizar LinkedIn va contra sus Terminos. Se usa TU sesion y un
//  ritmo lento para minimizar riesgo, pero el riesgo no es cero. Usalo con criterio.
// ============================================================================

import { chromium } from "playwright";
import { SIGNALS, DESCARTES, IGNORAR_AUTORES } from "./signals.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, ".chrome-profile"); // sesion persistente (en .gitignore)

// ---- parseo de flags -------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);
const SCROLLS = parseInt(args.scrolls ?? "25", 10);
const MIN_SCORE = parseInt(args["min-score"] ?? "4", 10);
const OUT = args.out ?? "leads";
const DELAY = parseInt(args.delay ?? "2500", 10);
const LOGIN_ONLY = Boolean(args["login-only"]);

// ---- utilidades ------------------------------------------------------------
const normaliza = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/\s+/g, " ")
    .trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- puntuacion de un post -------------------------------------------------
function evalua(post) {
  const t = normaliza(post.texto);
  const autor = normaliza(post.autor);

  // descarte por autor (marca/anunciante)
  if (IGNORAR_AUTORES.some((m) => autor.includes(m))) {
    return { descartado: "autor-ignorado", score: 0, señales: [] };
  }
  // descarte duro (hiring / spam)
  const hit = DESCARTES.find((d) => t.includes(d));
  if (hit) return { descartado: `descarte:${hit}`, score: 0, señales: [] };

  // suma de señales
  let score = 0;
  const señales = [];
  for (const s of SIGNALS) {
    const m = s.patrones.find((p) => t.includes(p));
    if (m) {
      score += s.peso;
      señales.push({ id: s.id, etiqueta: s.etiqueta, match: m, peso: s.peso });
    }
  }
  return { descartado: null, score, señales };
}

// ---- extraccion del DOM (corre dentro de la pagina) ------------------------
async function extraePosts(page) {
  return page.evaluate(() => {
    const out = [];
    const vistos = new Set();
    // Contenedores de post: estables por data-urn de actividad
    const nodos = document.querySelectorAll(
      'div[data-urn*="urn:li:activity"], div.feed-shared-update-v2, div.fie-impression-container'
    );
    for (const n of nodos) {
      const urn = n.getAttribute("data-urn") || "";
      const texto = (n.innerText || "").trim();
      if (!texto || texto.length < 20) continue;

      // autor
      const actor =
        n.querySelector(".update-components-actor__name") ||
        n.querySelector(".update-components-actor__title") ||
        n.querySelector('a[href*="/in/"]') ||
        n.querySelector('a[href*="/company/"]');
      const autor = actor ? (actor.innerText || actor.textContent || "").trim().split("\n")[0] : "";

      // link al post / perfil
      const link =
        n.querySelector('a.update-components-actor__meta-link')?.href ||
        n.querySelector('a[href*="/in/"]')?.href ||
        n.querySelector('a[href*="/company/"]')?.href ||
        (urn ? `https://www.linkedin.com/feed/update/${urn}/` : "");

      const clave = urn || texto.slice(0, 120);
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      out.push({ urn, autor, texto, link });
    }
    return out;
  });
}

// ---- CSV -------------------------------------------------------------------
function toCSV(rows) {
  const cols = ["score", "autor", "señales", "match", "texto", "link"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const head = cols.join(",");
  const body = rows
    .map((r) =>
      [
        r.score,
        r.autor,
        r.señales.map((s) => s.etiqueta).join(" | "),
        r.señales.map((s) => s.match).join(" | "),
        r.texto.slice(0, 500),
        r.link,
      ]
        .map(esc)
        .join(",")
    )
    .join("\n");
  return head + "\n" + body + "\n";
}

// ---- main ------------------------------------------------------------------
(async () => {
  console.log(`\n▶ LinkedIn Opportunity Scanner`);
  console.log(`  scrolls=${SCROLLS}  min-score=${MIN_SCORE}  delay=${DELAY}ms  out=${OUT}.{csv,json}\n`);

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });

  // ¿sesion iniciada?
  const loggedIn = await page
    .waitForSelector('div[data-urn*="urn:li:activity"], .feed-shared-update-v2, .share-box-feed-entry__wrapper', {
      timeout: 8000,
    })
    .then(() => true)
    .catch(() => false);

  if (LOGIN_ONLY || !loggedIn) {
    console.log("🔑 Inicia sesion en LinkedIn en la ventana que se ha abierto.");
    console.log("   Cuando veas tu feed cargado, vuelve aqui y pulsa ENTER.");
    await new Promise((res) => {
      process.stdin.resume();
      process.stdin.once("data", () => res());
    });
    if (LOGIN_ONLY) {
      console.log("✅ Sesion guardada. Ya puedes lanzar: npm run scan -- --scrolls=25");
      await ctx.close();
      process.exit(0);
    }
  }

  // ---- scroll + captura incremental ----
  const acumulado = new Map(); // clave -> post
  for (let i = 1; i <= SCROLLS; i++) {
    const lote = await extraePosts(page);
    for (const p of lote) acumulado.set(p.urn || p.texto.slice(0, 120), p);
    process.stdout.write(`  scroll ${i}/${SCROLLS} — ${acumulado.size} posts capturados\r`);
    await page.mouse.wheel(0, 1600 + Math.floor(Math.random() * 600)); // ritmo/altura variable
    await sleep(DELAY + Math.floor(Math.random() * 800));
  }
  console.log("");

  // ---- evaluacion ----
  const evaluados = [];
  for (const p of acumulado.values()) {
    const e = evalua(p);
    if (e.descartado) continue;
    if (e.score < MIN_SCORE) continue;
    evaluados.push({ ...p, score: e.score, señales: e.señales });
  }
  evaluados.sort((a, b) => b.score - a.score);

  // ---- salida ----
  writeFileSync(join(__dirname, `${OUT}.json`), JSON.stringify(evaluados, null, 2));
  writeFileSync(join(__dirname, `${OUT}.csv`), toCSV(evaluados));

  console.log(`\n✅ ${acumulado.size} posts analizados → ${evaluados.length} oportunidades (score ≥ ${MIN_SCORE})`);
  console.log(`   ${OUT}.csv  /  ${OUT}.json\n`);
  if (evaluados.length) {
    console.log("TOP:");
    for (const r of evaluados.slice(0, 10)) {
      console.log(`  [${r.score}] ${r.autor} — ${r.señales.map((s) => s.etiqueta).join(", ")}`);
    }
  } else {
    console.log("Sin oportunidades en este barrido. Baja --min-score o amplia signals.mjs.");
  }

  await ctx.close();
  process.exit(0);
})().catch((err) => {
  console.error("\n✖ Error:", err.message);
  process.exit(1);
});
