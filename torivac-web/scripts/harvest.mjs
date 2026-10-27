#!/usr/bin/env node
// Sesión 1 · Cosecha de datos en bruto de grupotorivac.com (WordPress + WooCommerce + WPML).
// Reanudable: si un fichero ya existe, se salta. Ritmo educado (concurrencia 4 + pausa).
//
//   node scripts/harvest.mjs            # todo
//   node scripts/harvest.mjs --only=rest,pdf
//
// Salida (data/raw/):
//   sitemaps/*.xml          sitemaps de Yoast
//   rest/<tipo>.<lang>.json contenido REST (wp/v2) completo, paginado y unido
//   store/products.<lang>.json  WooCommerce Store API (atributos, imágenes, categorías)
//   tree/product-tree.json  endpoint propio custom/v1/product-tree
//   html/<lang>/<slug>.html HTML renderizado de cada URL de los sitemaps (NO se versiona)
//   pdf/*.pdf               todos los PDF enlazados
//   manifest.json           recuento y fallos

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://grupotorivac.com";
const LANGS = ["es", "en", "fr", "de"];
const UA = "Mozilla/5.0 (compatible; SantisoMarketing-Migration/1.0; +https://santisomarketing.com)";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");
const only = (process.argv.find(a => a.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean);
const want = s => only.length === 0 || only.includes(s);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = async p => { try { await stat(p); return true; } catch { return false; } };
const manifest = { generated: null, base: BASE, sitemaps: {}, urls: {}, rest: {}, store: {}, pdfs: [], failures: [] };

async function get(url, { binary = false, tries = 4 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es,en;q=0.8" }, redirect: "follow" });
      if (res.status === 429 || res.status >= 500) throw new Error("HTTP " + res.status);
      if (!res.ok) { const e = new Error("HTTP " + res.status); e.status = res.status; e.final = true; throw e; }
      const total = res.headers.get("x-wp-total");
      const pages = res.headers.get("x-wp-totalpages");
      const data = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      return { data, total: total ? +total : null, pages: pages ? +pages : null, ct: res.headers.get("content-type") || "" };
    } catch (e) {
      last = e;
      if (e.final) break;
      await sleep(800 * (i + 1));
    }
  }
  throw last;
}

async function save(rel, content) {
  const p = path.join(ROOT, rel);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, content);
  return p;
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); await sleep(120); }
  }));
  return out;
}

const langOf = u => { const m = new URL(u).pathname.match(/^\/(en|fr|de)(\/|$)/); return m ? m[1] : "es"; };
const slugOf = u => (new URL(u).pathname.replace(/^\/|\/$/g, "").replace(/\//g, "__")) || "home";
const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

// ---------- 1. Sitemaps ----------
async function sitemaps() {
  const idx = (await get(`${BASE}/sitemap_index.xml`)).data;
  await save("sitemaps/sitemap_index.xml", idx);
  const subs = locs(idx);
  const all = new Set();
  for (const s of subs) {
    const name = path.basename(new URL(s).pathname);
    const xml = (await get(s)).data;
    await save("sitemaps/" + name, xml);
    const urls = locs(xml).filter(u => !/\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(u));
    manifest.sitemaps[name] = urls.length;
    urls.forEach(u => all.add(u));
    console.log("sitemap", name, urls.length);
  }
  return [...all];
}

// ---------- 2. REST (wp/v2) ----------
const REST_TYPES = ["pages", "posts", "product", "product_cat", "categories", "tags", "media", "product_tag", "product_brand", "elementor_library"];
async function rest() {
  for (const lang of LANGS) {
    for (const type of REST_TYPES) {
      const rel = `rest/${type}.${lang}.json`;
      if (await exists(path.join(ROOT, rel))) continue;
      const items = [];
      try {
        let page = 1, pages = 1;
        do {
          const u = `${BASE}/wp-json/wp/v2/${type}?per_page=100&page=${page}&lang=${lang}`;
          const r = await get(u);
          items.push(...JSON.parse(r.data));
          pages = r.pages || 1; page++;
          await sleep(150);
        } while (page <= pages);
        await save(rel, JSON.stringify(items));
        manifest.rest[`${type}.${lang}`] = items.length;
        console.log("rest", type, lang, items.length);
      } catch (e) {
        manifest.failures.push({ what: `rest ${type} ${lang}`, err: String(e.message || e) });
        console.warn("rest FAIL", type, lang, e.message);
      }
    }
  }
}

// ---------- 3. Store API + product tree ----------
async function store() {
  for (const lang of LANGS) {
    const rel = `store/products.${lang}.json`;
    if (await exists(path.join(ROOT, rel))) continue;
    try {
      const items = []; let page = 1, pages = 1;
      do {
        const r = await get(`${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}&lang=${lang}`);
        items.push(...JSON.parse(r.data)); pages = r.pages || 1; page++;
      } while (page <= pages);
      await save(rel, JSON.stringify(items));
      manifest.store[lang] = items.length;
      console.log("store", lang, items.length);
    } catch (e) { manifest.failures.push({ what: "store " + lang, err: String(e.message) }); }
  }
  for (const [name, p] of [["categories", "wc/store/v1/products/categories?per_page=100"], ["attributes", "wc/store/v1/products/attributes"]]) {
    for (const lang of LANGS) {
      const rel = `store/${name}.${lang}.json`;
      if (await exists(path.join(ROOT, rel))) continue;
      try { await save(rel, (await get(`${BASE}/wp-json/${p}${p.includes("?") ? "&" : "?"}lang=${lang}`)).data); } catch (e) { manifest.failures.push({ what: `store ${name} ${lang}`, err: String(e.message) }); }
    }
  }
  if (!(await exists(path.join(ROOT, "tree/product-tree.json")))) {
    try { await save("tree/product-tree.json", (await get(`${BASE}/wp-json/custom/v1/product-tree`)).data); } catch (e) { manifest.failures.push({ what: "product-tree", err: String(e.message) }); }
  }
}

// ---------- 4. HTML de cada URL ----------
// OJO: el sitemap de Yoast+WPML repite las URLs en español y NO lista /en /fr /de.
// Por eso la lista de URLs es la unión de: sitemap + enlaces de la REST + permalinks de la Store API + hreflang del propio HTML.
async function knownLinks() {
  const out = new Set();
  const host = new URL(BASE).host;
  const keep = u => { try { const x = new URL(u); if (x.host === host) { x.hash = ""; out.add(x.toString()); } } catch { /* ignora */ } };
  for (const lang of LANGS) {
    for (const type of ["pages", "posts", "product", "product_cat", "categories"]) {
      const p = path.join(ROOT, `rest/${type}.${lang}.json`);
      if (!(await exists(p))) continue;
      for (const it of JSON.parse(await readFile(p, "utf8"))) if (it.link) keep(it.link);
    }
    const sp = path.join(ROOT, `store/products.${lang}.json`);
    if (await exists(sp)) for (const it of JSON.parse(await readFile(sp, "utf8"))) { if (it.permalink) keep(it.permalink); for (const c of it.categories || []) if (c.link) keep(c.link); }
    keep(lang === "es" ? `${BASE}/` : `${BASE}/${lang}/`);
  }
  return out;
}
async function hreflangs(urls) {
  const found = new Set();
  for (const u of urls) {
    const p = path.join(ROOT, `html/${langOf(u)}/${slugOf(u)}.html`);
    if (!(await exists(p))) continue;
    const h = await readFile(p, "utf8");
    for (const m of h.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)) {
      const hl = /hreflang=["']([^"']+)["']/i.exec(m[0]); const hr = /href=["']([^"']+)["']/i.exec(m[0]);
      if (hl && hr && new URL(hr[1], BASE).host === new URL(BASE).host) found.add(new URL(hr[1], BASE).toString());
    }
  }
  return found;
}
async function html(urls) {
  const all = new Set([...urls, ...(await knownLinks())]);
  let ok = 0, skip = 0, round = 0;
  while (round < 3) {
    const todo = [...all].filter(u => !/\/(author|wp-content|wp-json|feed)\//.test(u) && !/\.(pdf|jpe?g|png|webp|gif|svg|xml)(\?|$)/i.test(u));
    await pool(todo, 4, async u => {
      const rel = `html/${langOf(u)}/${slugOf(u)}.html`;
      manifest.urls[u] = rel;
      if (await exists(path.join(ROOT, rel))) { skip++; return; }
      try { await save(rel, (await get(u)).data); ok++; if (ok % 50 === 0) console.log("html", ok, "/", todo.length); }
      catch (e) { if (!manifest.failures.some(f => f.what === "html " + u)) manifest.failures.push({ what: "html " + u, err: String(e.message) }); }
    });
    const before = all.size;
    for (const u of await hreflangs(todo)) all.add(u);
    console.log(`html ronda ${round}: ${todo.length} URLs, +${all.size - before} nuevas por hreflang`);
    if (all.size === before) break;
    round++;
  }
  console.log(`html: ${ok} nuevos, ${skip} ya estaban, ${all.size} URLs conocidas`);
}

// ---------- 5. PDFs ----------
async function pdfs() {
  const found = new Map(); // url -> fuentes
  const add = (u, src) => {
    try {
      const abs = new URL(u.replace(/&amp;/g, "&"), BASE);
      if (!/\.pdf(\?|#|$)/i.test(abs.pathname + abs.search)) return;
      abs.hash = "";
      const k = abs.toString();
      if (!found.has(k)) found.set(k, new Set());
      found.get(k).add(src);
    } catch { /* url rota */ }
  };
  // desde HTML cosechado
  const { readdir } = await import("node:fs/promises");
  for (const lang of LANGS) {
    const dir = path.join(ROOT, "html", lang);
    if (!(await exists(dir))) continue;
    for (const f of await readdir(dir)) {
      const h = await readFile(path.join(dir, f), "utf8");
      for (const m of h.matchAll(/(?:href|src|data-[a-z-]+)=["']([^"']+\.pdf[^"']*)["']/gi)) add(m[1], `html:${lang}/${f}`);
    }
  }
  // desde REST (contenido + media)
  for (const lang of LANGS) for (const type of REST_TYPES) {
    const p = path.join(ROOT, `rest/${type}.${lang}.json`);
    if (!(await exists(p))) continue;
    const raw = await readFile(p, "utf8");
    for (const m of raw.matchAll(/https?:[^"'\\\s]+?\.pdf/gi)) add(m[0], `rest:${type}.${lang}`);
    if (type === "media") for (const it of JSON.parse(raw)) if (it.mime_type === "application/pdf" && it.source_url) add(it.source_url, `media:${lang}`);
  }
  // el catálogo oficial enlazado en el menú
  add(`${BASE}/wp-content/uploads/2024/10/Torivac_2024.pdf`, "menu:catalogo");
  console.log("PDFs únicos encontrados:", found.size);
  const list = [...found.entries()];
  await pool(list, 3, async ([u, srcs]) => {
    const name = decodeURIComponent(path.basename(new URL(u).pathname)).replace(/[^\w.\-]+/g, "_");
    const rel = `pdf/${name}`;
    const rec = { url: u, file: rel, sources: [...srcs].slice(0, 8), nSources: srcs.size };
    try {
      let buf;
      if (await exists(path.join(ROOT, rel))) buf = await readFile(path.join(ROOT, rel));
      else { buf = (await get(u, { binary: true })).data; await save(rel, buf); }
      rec.bytes = buf.length; rec.sha256 = createHash("sha256").update(buf).digest("hex");
      console.log("pdf", name, (buf.length / 1048576).toFixed(2) + " MB");
    } catch (e) { rec.error = String(e.message); manifest.failures.push({ what: "pdf " + u, err: rec.error }); }
    manifest.pdfs.push(rec);
  });
}

// ---------- main ----------
await mkdir(ROOT, { recursive: true });
let urls = [];
if (want("sitemaps") || want("html")) urls = await sitemaps();
if (want("rest")) await rest();
if (want("store")) await store();
if (want("html")) await html(urls);
if (want("pdf")) await pdfs();
manifest.generated = "run";
const mp = path.join(ROOT, "manifest.json");
let prev = {}; try { prev = JSON.parse(await readFile(mp, "utf8")); } catch { /* primera vez */ }
await writeFile(mp, JSON.stringify({ ...prev, ...Object.fromEntries(Object.entries(manifest).filter(([k, v]) => !(typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) && !(Array.isArray(v) && v.length === 0))) }, null, 2));
console.log("Listo. Fallos:", manifest.failures.length);
