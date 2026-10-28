#!/usr/bin/env node
// [PERF] Sesión 16 · Rendimiento en móvil: FCP, LCP, CLS y bytes transferidos con CPU ×4 más lenta y red «4G lenta» (1,6 Mbps, 150 ms).
//   node scripts/perf.mjs [--dir=dist]      Objetivo del proyecto: LCP < 2,5 s (el contrato de Why Not pide < 2 s con hosting real y brotli/CDN).
// El servidor de pruebas comprime en gzip el texto, como haría el hosting; las imágenes ya vienen en webp.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/static-server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = (process.argv.find((a) => a.startsWith('--dir=')) || '').split('=')[1];
const DIST = path.resolve(ROOT, dirArg || 'dist');
const { server, base } = await serve(DIST, { gzip: true });
const sb = { window: {} }; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(DIST, 'assets/data/catalog.js'), 'utf8'), sb);
const it = sb.TV.items;
const PAGES = [['/', 'portada'], ['/en/', 'portada EN'], ['/productos/', 'productos'], [it.P884.p.es, 'ficha TT'], [it.P932.p.es, 'ficha botones'], ['/presupuesto/', 'presupuesto'], ['/contacto/', 'contacto']];
const browser = await chromium.launch();
const rows = [];
for (const [url, name] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  await ctx.addInitScript(() => { try { localStorage.setItem('tv_lang_auto_done', '1'); localStorage.setItem('tv_lang_src', 'manual'); localStorage.setItem('tv_lang', document.documentElement.lang || 'es'); } catch (e) { /* ignorar */ } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  let bytes = 0, reqs = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; reqs++; });
  await page.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, longMs: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.longMs += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => ({ ...window.__m, fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0 }));
  rows.push({ name, url, fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), cls: +m.cls.toFixed(3), tbt: Math.round(m.longMs), kb: Math.round(bytes / 1024), reqs });
  await ctx.close();
}
await browser.close(); server.close();
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('página', 14), pad('FCP ms', 8), pad('LCP ms', 8), pad('CLS', 7), pad('TBT~ms', 8), pad('KB', 7), 'peticiones');
for (const r of rows) console.log(pad(r.name, 14), pad(r.fcp, 8), pad(r.lcp, 8), pad(r.cls, 7), pad(r.tbt, 8), pad(r.kb, 7), r.reqs);
const worst = Math.max(...rows.map((r) => r.lcp));
console.log(worst <= 2500 ? `\n✓ LCP máximo ${worst} ms (≤ 2500)` : `\n✗ LCP máximo ${worst} ms (> 2500)`);
fs.writeFileSync(path.join(ROOT, 'data', 'analysis', 'perf-mobile.json'), JSON.stringify(rows, null, 1));
process.exit(worst <= 2500 ? 0 : 1);
