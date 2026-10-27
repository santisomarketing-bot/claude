#!/usr/bin/env node
// Sesión 1 · Capturas y volcado de estilos de las plantillas clave de grupotorivac.com.
//   node scripts/screenshots.mjs
// Salida:
//   data/raw/screens/<nombre>.<desktop|mobile>.png   (página completa)
//   data/analysis/design-dump.json                   tokens CSS, tipografías, elementos fijos/flotantes, menú, botones
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // playwright está instalado globalmente (ESM no usa NODE_PATH)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "raw");
const BASE = "https://grupotorivac.com";
const rj = async p => JSON.parse(await readFile(path.join(RAW, p), "utf8"));

const posts = await rj("rest/posts.es.json");
const store = await rj("store/products.es.json");
const variable = store.find(p => p.type === "variable");
const withTable = store.find(p => /<table/i.test(p.description || ""));
const pick = (arr, f) => (arr.find(f) || arr[0] || {}).permalink;

const PAGES = [
  ["home-es", `${BASE}/`],
  ["home-en", `${BASE}/en/`],
  ["home-fr", `${BASE}/fr/`],
  ["home-de", `${BASE}/de/`],
  ["productos", `${BASE}/productos/`],
  ["categoria-transformadores", `${BASE}/categoria-producto/transformadores/`],
  ["categoria-variadores", `${BASE}/categoria-producto/variadores-de-tension/`],
  ["producto-simple", store[0].permalink],
  ["producto-tabla", withTable?.permalink || store[1].permalink],
  ["producto-variable", variable?.permalink || store[2].permalink],
  ["empresa", `${BASE}/torivac-empresa/`],
  ["proyectos", `${BASE}/proyectos-empresariales/`],
  ["blog", `${BASE}/blog/`],
  ["blog-post", posts[0]?.link],
  ["contacto", `${BASE}/contacto/`],
  ["productos-en", `${BASE}/en/products/`],
].filter(([, u]) => u);

const browser = await chromium.launch();
const dump = { generated_for: BASE, pages: {} };
await mkdir(path.join(RAW, "screens"), { recursive: true });

for (const [name, url] of PAGES) {
  for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: size, userAgent: "Mozilla/5.0 (compatible; SantisoMarketing-Migration/1.0)", deviceScaleFactor: 1, isMobile: vp === "mobile" });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      // dispara lazy-load
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(700);
      if (vp === "desktop") {
        dump.pages[name] = { url, ...(await page.evaluate(() => {
          const cs = (el, props) => { const s = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, s.getPropertyValue(p)])); };
          const rootVars = {};
          for (const sheet of document.styleSheets) { try { for (const r of sheet.cssRules) if (r.selectorText === ":root" || r.selectorText === ".elementor-kit-5" || /^\.elementor-kit/.test(r.selectorText || "")) for (const p of r.style) if (p.startsWith("--")) rootVars[p] = r.style.getPropertyValue(p).trim(); } catch { /* CORS */ } }
          const sample = sel => { const e = document.querySelector(sel); return e ? { sel, text: (e.textContent || "").trim().slice(0, 60), ...cs(e, ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "background-color", "background-image", "border", "border-radius", "padding", "margin", "text-transform", "box-shadow"]) } : null; };
          const fixed = [...document.querySelectorAll("*")].filter(e => { const p = getComputedStyle(e).position; return (p === "fixed" || p === "sticky") && e.offsetWidth > 0; }).slice(0, 25).map(e => ({ tag: e.tagName.toLowerCase(), id: e.id, cls: String(e.className).slice(0, 100), position: getComputedStyle(e).position, rect: (r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }))(e.getBoundingClientRect()), text: (e.textContent || "").trim().slice(0, 50) }));
          const navLinks = [...document.querySelectorAll("header a, .elementor-location-header a, nav a")].slice(0, 80).map(a => ({ t: (a.textContent || "").trim().slice(0, 50), h: a.href })).filter(x => x.t);
          const fonts = [...document.fonts].map(f => `${f.family} ${f.weight} ${f.style} [${f.status}]`);
          const btns = [...document.querySelectorAll("a.elementor-button, button, .button, .btn, input[type=submit]")].slice(0, 6).map(b => ({ text: (b.textContent || b.value || "").trim().slice(0, 40), cls: String(b.className).slice(0, 80), ...cs(b, ["font-family", "font-size", "font-weight", "color", "background-color", "border", "border-radius", "padding", "text-transform"]) }));
          const colors = {}; for (const e of document.querySelectorAll("body *")) { const s = getComputedStyle(e); for (const k of ["color", "background-color"]) { const v = s.getPropertyValue(k); if (v && v !== "rgba(0, 0, 0, 0)") colors[v] = (colors[v] || 0) + 1; } }
          const topColors = Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 18);
          return {
            title: document.title, lang: document.documentElement.lang, docHeight: document.documentElement.scrollHeight, bodyClasses: document.body.className,
            rootVars, fonts, topColors, fixed, navLinks, buttons: btns,
            samples: ["body", "h1", "h2", "h3", "h4", "p", "a", "header", ".elementor-location-header", "footer", ".elementor-location-footer", ".woocommerce-loop-product__title", ".price", ".product_title", ".elementor-widget-nav-menu a", ".elementor-nav-menu--main a"].map(sample).filter(Boolean),
          };
        })) };
      }
      // el banner de cookies (Complianz, cookiewall a pantalla completa) y la insignia de reCAPTCHA tapan la captura: se registran arriba (fixed) y se ocultan aquí
      await page.addStyleTag({ content: "#cmplz-cookiebanner-container,.cmplz-cookiebanner,.cmplz-soft-cookiewall,.grecaptcha-badge{display:none!important}" });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(RAW, "screens", `${name}.${vp}.png`), fullPage: true });
      console.log("ok", name, vp);
    } catch (e) { console.warn("FAIL", name, vp, e.message); (dump.failures ||= []).push({ name, vp, err: e.message }); }
    await ctx.close();
  }
}
await browser.close();
await mkdir(path.join(ROOT, "data", "analysis"), { recursive: true });
await writeFile(path.join(ROOT, "data", "analysis", "design-dump.json"), JSON.stringify(dump, null, 1));
console.log("design-dump.json escrito");
