#!/usr/bin/env node
// [PROBE-ORIGINAL-HEROES] Lee (solo GET) las páginas de categoría de la web actual de grupotorivac.com y descarga la foto grande que muestran junto al texto
// (bloque `torivac-cat-media`), para el aspecto «Original». Guarda las fotos en site/assets/img/original/ y el mapa categoría → foto en data/catalog/original-layout.json (clave `hero`).
// Uso: node scripts/probe_original_heroes.mjs   (≈ 60 peticiones, con pausa entre ellas)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog/categories.json'), 'utf8'));
const layoutFile = path.join(ROOT, 'data/catalog/original-layout.json');
const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
const OUT = path.join(ROOT, 'site/assets/img/original'); fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (compatible; TorivacMigration/1.0; read-only)';
// Pausa de 800 ms entre peticiones a la web actual (solo lectura, sin cargarla).
const pause = () => new Promise((r) => setTimeout(r, 800));
const hero = {};
for (const c of cats) {
  if (!/^\/categoria-producto\//.test(c.path.es)) continue;
  const r = await fetch('https://grupotorivac.com' + c.path.es, { headers: { 'User-Agent': UA }, redirect: 'manual' }); await pause();
  if (r.status !== 200) { console.log(c.id, c.name.es, '→', r.status, '(redirige a su producto)'); continue; }
  const html = await r.text();
  const m = /<div class="torivac-cat-media">\s*<img[^>]*src="([^"]+)"/.exec(html);
  if (!m) { console.log(c.id, c.name.es, '→ sin foto grande'); continue; }
  const url = m[1], ext = (url.match(/\.(jpe?g|png|webp)(\?|$)/i) || [, 'jpg'])[1].toLowerCase();
  const file = `${(c.slug.es || 'cat' + c.id).replace(/[^a-z0-9-]/gi, '-')}.${ext}`;
  const img = await fetch(url, { headers: { 'User-Agent': UA } }); await pause();
  const buf = Buffer.from(await img.arrayBuffer());
  fs.writeFileSync(path.join(OUT, file), buf);
  hero[c.id] = { file: 'assets/img/original/' + file, w: null, h: null, bytes: buf.length, sha: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10) };
  console.log(c.id, c.name.es, '→', file, buf.length);
}
layout.hero = hero;
fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 1) + '\n');
