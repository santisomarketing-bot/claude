// [PKG-APACHE] Despliega un paquete de la web (producción o pruebas) en un Apache REAL con PHP-FPM y deja a mano lo que hace falta para probarlo: peticiones con el Host y el esquema que se quiera,
// llamadas al API con la sesión de un manager recién creado y una imagen PNG válida de cualquier tamaño. Lo usan scripts/qa-blog-apache.mjs (peticiones directas) y scripts/qa-blog-panel.mjs (navegador).
//   const d = await deployPackage({ staging, local })    local = true: la web es http://127.0.0.1:<puerto> (para abrirla con un navegador); si no, https://example.test (o pruebas.example.test) detrás de un «proxy» (cabecera X-Forwarded-Proto)
//   d.req(ruta, { method, headers, body }) → { s, h, t, b }     d.api(ruta, { method, body, token }) → { s, j, h }     d.token (sesión del manager jefa@torivac.com)     d.BASE · d.www · d.ap · await d.stop()
//   Código por correo: el paquete se despliega con la verificación en dos pasos DESACTIVADA (two_step.enabled = false) para que las pruebas que no hablan de ella entren con la contraseña sola.
//   Para probarla: deployPackage({ …, config: { two_step: { enabled: true } } }) o, ya desplegado, d.setConfig({ two_step: {…} }) (sustituye ese apartado entero de config.php).
//   d.outbox() → los correos guardados (controlador «file») · d.lastCode(correo) → el último código de 6 cifras que se mandó a ese correo, o null
//   d.kvKeys(prefijo) · d.kvGet(clave) · d.kvEdit(clave, fn) · d.kvDrop(prefijo): mirar y tocar el almacén de datos (p. ej. adelantar el reloj de un código: kvEdit('pin:<id>', (v) => ({ ...v, last: v.last - 60000 })))
//   d.api(ruta, { headers: { 'x-forwarded-for': '203.0.113.7' } }) se hace pasar por otro visitante.
//   png(w, h, [r, g, b]) → Buffer con un PNG válido
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';
import net from 'node:net';
import http from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startApache } from './apache.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Puerto TCP libre en 127.0.0.1. */
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

/** PNG de colores lisos de w×h píxeles (válido de verdad: con sus sumas de control). */
export function png(w, h, rgb = [200, 40, 40]) {
  /** Suma de control CRC-32 de un trozo de bytes. */
  const crc = (b) => { let c = ~0 >>> 0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; };
  /** Trozo de PNG: longitud, tipo, datos y suma de control. */
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Despliega un paquete (producción o pruebas) en un Apache real → { www, ap, port, host, req(), api(), stop() } */
async function deploy({ staging }) {
  const port = await freePort();
  const host = staging ? 'pruebas.example.test' : 'example.test';
  const BASE = `https://${host}`;
  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-blog-pkg-')); fs.chmodSync(OUT, 0o755);
  execFileSync('python3', ['-I', path.join(ROOT, 'scripts/package_cpanel.py'), `--base=${BASE}`, ...(staging ? ['--staging'] : []), `--out=${OUT}`, '--keep', '--allow-dirty'], { stdio: 'pipe' });
  const www = path.join(OUT, fs.readdirSync(OUT).find((d) => fs.statSync(path.join(OUT, d)).isDirectory()));
  spawnSync('chmod', ['-R', 'a+rX', www]);
  const ap = await startApache({ docroot: www, port });
  const MASTER = 'master-test-' + 'a1b2c3d4e5f6a7b8c9d0'.repeat(2);
  const cfg = { storage_dir: ap.dataDir, session_secret: 'session-test-' + 'x'.repeat(40), admin_token: MASTER, order_to: ['info@grupotorivac.com'], order_from: 'Torivac Web <pedidos@grupotorivac.com>', mail: { driver: 'file' }, form_min_fill_ms: 0 };
  fs.writeFileSync(path.join(www, 'api/config.php'), `<?php\nreturn json_decode(<<<'JSON'\n${JSON.stringify(cfg)}\nJSON\n, true);\n`); fs.chmodSync(path.join(www, 'api/config.php'), 0o644);
  /** Petición con las cabeceras que se indiquen (incluido Host, que fetch no deja cambiar); por defecto como llega detrás del proxy con https → { s, h, t, b } */
  const req = (p, { method = 'GET', headers = {}, body = null } = {}) => new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, agent: false, headers: { host, 'x-forwarded-proto': 'https', ...(body ? { 'content-length': Buffer.byteLength(body) } : {}), ...headers } }, (rs) => { const ch = []; rs.on('data', (d) => ch.push(d)); rs.on('end', () => { const b = Buffer.concat(ch); res({ s: rs.statusCode, h: rs.headers, t: b.toString('utf8'), b }); }); });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
  /** Llamada JSON al API → { s, j } */
  const api = async (p, { method = 'GET', body, token } = {}) => { const r = await req('/api' + p, { method, headers: { 'content-type': 'application/json', origin: BASE, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? null : JSON.stringify(body) }); let j = null; try { j = JSON.parse(r.t); } catch { /* no es JSON */ } return { s: r.s, j, h: r.h }; };
  let r = await api('/users', { method: 'POST', token: MASTER, body: { email: 'jefa@torivac.com', name: 'Jefa', role: 'manager', password: 'Manager-Clave-2026' } });
  if (r.s !== 201) throw new Error('no se pudo crear el manager: ' + r.s + ' ' + JSON.stringify(r.j));
  r = await api('/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: 'Manager-Clave-2026' } });
  return { www, ap, port, host, BASE, req, api, token: r.j.token, stop: async () => { await ap.stop(); fs.rmSync(OUT, { recursive: true, force: true }); } };
}


/** Token maestro de las pruebas (solo sirve para crear el primer manager). */
export const MASTER = 'master-test-' + 'a1b2c3d4e5f6a7b8c9d0'.repeat(2);
/** Contraseña del manager de las pruebas. */
export const MANAGER_PASS = 'Manager-Clave-2026';

/** Despliega el paquete en un Apache real → { www, ap, port, host, BASE, req, api, token, stop } (ver la cabecera). */
export async function deployPackage({ staging = false, local = false, config = null } = {}) {
  const port = await freePort();
  const host = local ? `127.0.0.1:${port}` : staging ? 'pruebas.example.test' : 'example.test';
  const BASE = local ? `http://${host}` : `https://${host}`;
  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-blog-pkg-')); fs.chmodSync(OUT, 0o755);
  execFileSync('python3', ['-I', path.join(ROOT, 'scripts/package_cpanel.py'), `--base=${BASE}`, ...(staging || local ? ['--staging'] : []), `--out=${OUT}`, '--keep', '--allow-dirty'], { stdio: 'pipe' });
  const www = path.join(OUT, fs.readdirSync(OUT).find((d) => fs.statSync(path.join(OUT, d)).isDirectory()));
  spawnSync('chmod', ['-R', 'a+rX', www]);
  const ap = await startApache({ docroot: www, port, phpIni: { 'opcache.enable': '0' } });          // sin caché de código: un config.php reescrito vale en la petición siguiente
  let cfg = { storage_dir: ap.dataDir, session_secret: 'session-test-' + 'x'.repeat(40), admin_token: MASTER, order_to: ['info@grupotorivac.com'], order_from: 'Torivac Web <pedidos@grupotorivac.com>', mail: { driver: 'file' }, form_min_fill_ms: 0, two_step: { enabled: false } };
  /** Escribe api/config.php con `c`. */
  const writeCfg = (c) => { fs.writeFileSync(path.join(www, 'api/config.php'), `<?php\nreturn json_decode(<<<'JSON'\n${JSON.stringify(c)}\nJSON\n, true);\n`); fs.chmodSync(path.join(www, 'api/config.php'), 0o644); };
  writeCfg(cfg);
  /** Cambia apartados de config.php (cada clave de primer nivel que se pase sustituye a la de antes). */
  const setConfig = (patch) => { cfg = { ...cfg, ...patch }; writeCfg(cfg); };
  /** Correos guardados por el controlador «file», del más antiguo al más reciente (por la hora del fichero: el nombre solo tiene segundos) → [{ file, to, subject, text, html }] */
  const outbox = () => { const dir = path.join(ap.dataDir, 'outbox'); try { return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => a.t - b.t || (a.f < b.f ? -1 : 1)).map(({ f }) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) })); } catch { return []; } };
  /** Fichero del almacén de una clave (p. ej. «pin:<id>»): kv/<clave con % >.json. */
  const kvFile = (key) => path.join(ap.dataDir, 'kv', encodeURIComponent(key) + '.json');
  /** Claves del almacén que empiezan por `prefix`, más recientes primero. */
  const kvKeys = (prefix) => { try { return fs.readdirSync(path.join(ap.dataDir, 'kv')).filter((f) => f.endsWith('.json')).map((f) => decodeURIComponent(f.slice(0, -5))).filter((k) => k.startsWith(prefix)).sort((a, b) => fs.statSync(kvFile(b)).mtimeMs - fs.statSync(kvFile(a)).mtimeMs); } catch { return []; } };
  /** Borra del almacén todas las claves que empiezan por `prefix` (p. ej. 'rl:contact:' para volver a empezar los límites por visitante) → cuántas. */
  const kvDrop = (prefix) => { let n = 0; for (const k of kvKeys(prefix)) { try { fs.unlinkSync(kvFile(k)); n++; } catch { /* ya no está */ } } return n; };
  /** Lee el valor guardado en una clave del almacén, o null. */
  const kvGet = (key) => { try { return JSON.parse(fs.readFileSync(kvFile(key), 'utf8')).v; } catch { return null; } };
  /** Cambia el valor de una clave del almacén con `fn(valor) → valor nuevo` (para adelantar el reloj de un código, por ejemplo). */
  const kvEdit = (key, fn) => { const o = JSON.parse(fs.readFileSync(kvFile(key), 'utf8')); o.v = fn(o.v); fs.writeFileSync(kvFile(key), JSON.stringify(o)); };
  /** El último código de acceso (6 cifras, sin espacio) que se mandó a `email`, o null si no se mandó ninguno. */
  const lastCode = (email) => { const m = outbox().reverse().find((x) => [].concat(x.to || []).map((t) => String(t).toLowerCase()).includes(String(email).toLowerCase()) && /Tu código de acceso/.test(x.text || '')); const c = m && /^ {4}(\d{3}) (\d{3})$/m.exec(m.text); return c ? c[1] + c[2] : null; };
  /** Petición con las cabeceras que se indiquen (incluido Host, que fetch no deja cambiar); por defecto como llega detrás del proxy con https → { s, h, t, b } */
  const req = (p, { method = 'GET', headers = {}, body = null } = {}) => new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, agent: false, headers: { host, ...(local ? {} : { 'x-forwarded-proto': 'https' }), ...(body ? { 'content-length': Buffer.byteLength(body) } : {}), ...headers } }, (rs) => { const ch = []; rs.on('data', (d) => ch.push(d)); rs.on('end', () => { const b = Buffer.concat(ch); res({ s: rs.statusCode, h: rs.headers, t: b.toString('utf8'), b }); }); });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
  /** Llamada JSON al API → { s, j, h }. `headers` añade cabeceras (p. ej. X-Forwarded-For: 203.0.113.7 para hacerse pasar por otro visitante: el Apache de pruebas confía en la conexión local). */
  const api = async (p, { method = 'GET', body, token, headers = {} } = {}) => { const r = await req('/api' + p, { method, headers: { 'content-type': 'application/json', origin: BASE, ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: body === undefined ? null : JSON.stringify(body) }); let j = null; try { j = JSON.parse(r.t); } catch { /* no es JSON */ } return { s: r.s, j, h: r.h }; };
  let r = await api('/users', { method: 'POST', token: MASTER, body: { email: 'jefa@torivac.com', name: 'Jefa', role: 'manager', password: MANAGER_PASS } });
  if (r.s !== 201) throw new Error('no se pudo crear el manager: ' + r.s + ' ' + JSON.stringify(r.j));
  r = await api('/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: MANAGER_PASS } });
  const token = r.j.token;
  if (config) setConfig(config);
  return { www, ap, port, host, BASE, req, api, token, setConfig, outbox, lastCode, kvKeys, kvGet, kvEdit, kvDrop, stop: async () => { await ap.stop(); fs.rmSync(OUT, { recursive: true, force: true }); } };
}
