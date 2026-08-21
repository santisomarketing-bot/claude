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
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, ".chrome-profile"); // sesion persistente (en .gitignore)
// Chromium a usar. Normalmente Playwright usa el suyo (npx playwright install chromium).
// Si defines CHROME_PATH, usa ese binario (util cuando ya hay un Chromium en el sistema).
const CHROME_PATH = process.env.CHROME_PATH || undefined;
const LAUNCH_BASE = CHROME_PATH ? { executablePath: CHROME_PATH } : {};

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
const HTML = args.html ? String(args.html) : null; // modo offline: parsea un HTML guardado
const DEBUG = Boolean(args.debug); // muestra la disposicion de cada post

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
  const autor = normaliza(post.autor || "");

  // descarte de anuncios (LinkedIn marca "Promocionado")
  if (post.promocionado) return { descartado: "anuncio", score: 0, señales: [] };
  // descarte por autor (marca/anunciante)
  if (autor && IGNORAR_AUTORES.some((m) => autor.includes(m))) {
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
//  LinkedIn (diseño 2024+) usa clases ofuscadas que cambian por sesion, sin
//  data-urn ni feed-shared-update-v2. El ancla ESTABLE es role="listitem":
//  cada post del feed es un [role="listitem"] con su barra de acciones.
async function extraePosts(page) {
  return page.evaluate(() => {
    const out = [];
    // Compatibilidad con LinkedIn clasico (data-urn) + LinkedIn nuevo (role=listitem)
    const nodos = document.querySelectorAll(
      '[role="listitem"], div[data-urn*="urn:li:activity"], div.feed-shared-update-v2'
    );
    for (const n of nodos) {
      const raw = (n.innerText || "").replace(/\s+/g, " ").trim();
      if (!raw || raw.length < 25) continue;
      // solo posts del feed (empiezan por "Publicación en el feed" en el UI nuevo)
      // pero aceptamos tambien el clasico sin ese prefijo.
      const esFeedNuevo = /Publicaci[oó]n en el feed/i.test(raw);
      const urn = n.getAttribute("data-urn") || "";
      if (!esFeedNuevo && !urn) continue;

      const promocionado = /\bPromocionado\b/i.test(raw);

      const a =
        n.querySelector('a[href*="/in/"]') ||
        n.querySelector('a[href*="/company/"]') ||
        n.querySelector('a[href*="/school/"]');
      const link = a ? a.href : urn ? `https://www.linkedin.com/feed/update/${urn}/` : "";

      out.push({ urn, texto: raw, link, promocionado });
    }
    return out;
  });
}

// ---- parseo del autor real a partir del texto del post ---------------------
//  Formatos vistos en el feed nuevo (tras "Publicación en el feed "):
//    "<Autor> • 1er/2º/3er+ ..."                     -> post directo
//    "Sugerencias <Autor> • ..."                     -> sugerido
//    "<X> recomienda esto <Autor> • ..."             -> reshare (autor real = despues)
//    "<X> han comentado <Autor> • ..."               -> aparece por comentario
//    "<X> han/ha compartido esto <Autor> • ..."      -> compartido
//    "<Empresa> 12.345 seguidores Promocionado ..."  -> anuncio
export function parseAutor(textoRaw) {
  let s = (textoRaw || "").replace(/^Publicaci[oó]n en el feed\s*/i, "");
  s = s.replace(/^Sugerencias\s+/i, "");
  // quita "X y N contactos más siguen esta página"
  s = s.replace(/^.*?siguen esta p[aá]gina\s+/i, "");
  // reshare / comentario / compartido: el autor real va DESPUES del verbo
  s = s.replace(/^.*?\b(recomienda esto|han comentado|ha comentado|han compartido esto|ha compartido esto|comparte esto)\s+/i, "");
  // autor = hasta " • " (grado de conexion) o " N seguidores" o doble espacio
  let autor = s.split(/\s•\s|\s[\d.,]+\sseguidores/i)[0];
  autor = autor.split(/\s{2,}/)[0].trim();
  // recorta marca temporal que a veces queda pegada ("denarius 3 días", "... 12 min")
  autor = autor.replace(/\s+\d+\s*(min|h|hora|horas|d|d[ií]a|d[ií]as|sem|semana|semanas|mes|meses|a[nñ]o|a[nñ]os)\b.*$/i, "");
  autor = autor.replace(/\s+(Seguir|Conectar|Editado)\b.*$/i, "").trim();
  return autor.slice(0, 80);
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

// ---- evaluacion + salida (compartido por modo en vivo y modo offline) ------
function procesa(acumulado) {
  const evaluados = [];
  const traza = [];
  for (const p of acumulado.values()) {
    if (!p.autor) p.autor = parseAutor(p.texto); // autor real desde el texto
    const e = evalua(p);
    traza.push({ autor: p.autor, ...e });
    if (e.descartado) continue;
    if (e.score < MIN_SCORE) continue;
    evaluados.push({ ...p, score: e.score, señales: e.señales });
  }

  if (DEBUG) {
    console.log("\n── DEBUG: disposicion de cada post ──");
    for (const x of traza) {
      const estado = x.descartado
        ? `✗ ${x.descartado}`
        : x.score >= MIN_SCORE
        ? `✓ score ${x.score} [${x.señales.map((s) => s.match).join(", ")}]`
        : `· score ${x.score} (bajo umbral)`;
      console.log(`  ${estado.padEnd(38)} ${x.autor}`);
    }
    console.log("──────────────────────────────────────\n");
  }
  evaluados.sort((a, b) => b.score - a.score);

  writeFileSync(join(__dirname, `${OUT}.json`), JSON.stringify(evaluados, null, 2));
  writeFileSync(join(__dirname, `${OUT}.csv`), toCSV(evaluados));

  console.log(`\n✅ ${acumulado.size} posts analizados → ${evaluados.length} oportunidades (score ≥ ${MIN_SCORE})`);
  console.log(`   ${OUT}.csv  /  ${OUT}.json\n`);
  if (evaluados.length) {
    console.log("TOP:");
    for (const r of evaluados.slice(0, 12)) {
      console.log(`  [${r.score}] ${r.autor} — ${r.señales.map((s) => s.etiqueta).join(", ")}`);
    }
  } else {
    console.log("Sin oportunidades en este barrido. Baja --min-score o amplia signals.mjs.");
  }
  return evaluados;
}

// ---- MODO OFFLINE: parsea un HTML guardado (sin tocar LinkedIn) -------------
async function correOffline() {
  const ruta = isAbsolute(HTML) ? HTML : join(process.cwd(), HTML);
  console.log(`\n▶ Modo offline — analizando HTML guardado: ${ruta}`);
  console.log(`  min-score=${MIN_SCORE}  out=${OUT}.{csv,json}\n`);
  const html = readFileSync(ruta, "utf8");
  const browser = await chromium.launch({ headless: true, ...LAUNCH_BASE });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const lote = await extraePosts(page);
  await browser.close();
  const acumulado = new Map();
  for (const p of lote) acumulado.set(p.urn || p.texto.slice(0, 120), p);
  procesa(acumulado);
  process.exit(0);
}

// ---- main ------------------------------------------------------------------
(async () => {
  if (HTML) return correOffline();

  console.log(`\n▶ LinkedIn Opportunity Scanner`);
  console.log(`  scrolls=${SCROLLS}  min-score=${MIN_SCORE}  delay=${DELAY}ms  out=${OUT}.{csv,json}\n`);

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
    ...LAUNCH_BASE,
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

  procesa(acumulado);

  await ctx.close();
  process.exit(0);
})().catch((err) => {
  console.error("\n✖ Error:", err.message);
  process.exit(1);
});
