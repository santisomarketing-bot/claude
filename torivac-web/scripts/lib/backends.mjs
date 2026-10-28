// [BACKENDS] Servidores de API intercambiables para las pruebas de navegador: el Worker (workers/api, en memoria) o el PHP (backend-php/api, con `php -S`).
// Los mismos guiones (qa-live, qa-admin-live, qa-tarifa) corren contra los dos: si el contrato de un backend se desvía, falla la misma comprobación.
//
//   const be = await startBackend({ kind: backendKind(), dist, port? });   (port: solo PHP, cuando la web ya lleva la URL compilada)   kind: 'worker' (por defecto) | 'php' (flag --php o TV_BACKEND=php)
//   be.SITE   web que ve el navegador            be.API   URL base del API (Worker: otro puerto con CORS · PHP: el mismo origen que la web)
//   be.mails  correos «enviados» (Resend simulado) · be.setMailDown(true) Resend rechaza los envíos · be.setAi(reply) lo que contestará la IA · be.setCsv(texto) la hoja de Drive
//   await be.seedPrices(obj) · be.getPrices() · be.addUser({ email, name, role, password }) · be.order(número) · be.historyCount()
//   be.setMinFill(ms) tiempo mínimo de relleno de los formularios (0 por defecto en las pruebas, para no esperar; el real es 1200) · await be.messages() los mensajes de contacto guardados
//   await be.useSource('xlsx', bytes) cambia el origen de los precios de la hoja CSV a un libro .xlsx de Drive (descarga directa)
//   await be.stop()
// Servicios externos simulados (sin red): Resend (/emails), Anthropic (/v1/messages), la hoja CSV (/precios.csv) y el libro Excel (/precios.xlsx).
/** Secretos de PRUEBA (no son claves reales): con la longitud mínima que exige el servidor (sesión y token maestro ≥ 32, cron ≥ 24). */
export const MASTER_TOKEN = 'master-test-' + 'a1b2c3d4e5f6a7b8c9d0'.repeat(2);
export const CRON_TOKEN = 'cron-test-' + 'f6e5d4c3b2a1f0e9d8c7'.repeat(1);
export const SESSION_SECRET = 'session-test-' + 'x'.repeat(40);
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Backend elegido por la línea de comandos: 'php' con --php (o TV_BACKEND=php), 'worker' por defecto. */
export const backendKind = () => (process.argv.includes('--php') || process.env.TV_BACKEND === 'php' ? 'php' : 'worker');

/** Puerto TCP libre en 127.0.0.1. */
export const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
/** Cuerpo completo de una petición HTTP entrante, como Buffer. */
const readBody = async (rq) => { const c = []; for await (const x of rq) c.push(x); return Buffer.concat(c); };

/** servicios de terceros simulados; la misma lógica sirve al Worker (fetchImpl) y al PHP (servidor http) */
function externals() {
  const st = { mails: [], aiReply: null, csv: '', xlsx: null, mailDown: false };
  /** Responde a los servicios externos simulados (Resend, Anthropic, hoja CSV, libro Excel) y guarda lo que se les envía. */
  const handle = async (url, init = {}) => {
    const u = String(url);
    if (/\/emails$/.test(u) || u.includes('api.resend.com')) { if (st.mailDown) return { status: 403, body: '{"message":"dominio sin verificar"}' }; st.mails.push(JSON.parse(init.body)); return { status: 200, body: JSON.stringify({ id: 'mail_' + st.mails.length }) }; }
    if (/\/precios\.xlsx$/.test(u)) return st.xlsx ? { status: 200, body: st.xlsx, binary: true } : { status: 404, body: 'sin libro' };
    if (/\/precios\.csv$/.test(u) || u.includes('sheet.test')) return { status: 200, body: st.csv };
    if (/\/v1\/messages$/.test(u) || u.includes('api.anthropic.com')) return { status: 200, body: JSON.stringify({ content: [{ type: 'tool_use', name: 'proponer_cambios_de_precios', input: st.aiReply }], usage: { input_tokens: 1, output_tokens: 1 } }) };
    throw new Error('red no permitida en el test: ' + u);
  };
  return { st, handle };
}

// ───────────────────────────────────────────────────────────── [WORKER]
/** Arranca el Worker torivac-api en memoria (KV simulado) detrás de un servidor http, con la web en otro puerto; misma interfaz que startPhp. */
async function startWorker({ dist, orderTo, orderFrom }) {
  const { default: worker } = await import(path.join(ROOT, 'workers/api/src/index.js'));
  const { FakeKV } = await import(path.join(ROOT, 'workers/api/test/helpers.js'));
  const { createUser } = await import(path.join(ROOT, 'workers/api/src/users.js'));
  const { KEY_CURRENT } = await import(path.join(ROOT, 'workers/api/src/prices.js'));
  const { st, handle } = externals();
  const { server: site, base: SITE } = await serve(dist);
  const env = { KV: new FakeKV(), PRICE_CSV_URL: 'https://sheet.test/precios.csv', ORDER_TO: orderTo, ORDER_FROM: orderFrom, RESEND_API_KEY: 're_test', ANTHROPIC_API_KEY: 'sk-test', SESSION_SECRET, ADMIN_API_TOKEN: MASTER_TOKEN, ALLOWED_ORIGINS: SITE, FORM_MIN_FILL_MS: '0' };
  /** fetch simulado del Worker: delega en los servicios externos simulados. */
  const mockFetch = async (url, init) => { const r = await handle(url, init); return new Response(r.body, { status: r.status }); };
  const api = http.createServer(async (rq, rs) => {
    const body = await readBody(rq);
    const res = await worker.fetch(new Request(`http://127.0.0.1:${api.address().port}${rq.url}`, { method: rq.method, headers: rq.headers, body: ['GET', 'HEAD'].includes(rq.method) ? undefined : body }), env, {}, { fetchImpl: mockFetch });
    rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
  });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  return {
    kind: 'worker', SITE, API: `http://127.0.0.1:${api.address().port}`, mails: st.mails, env,
    setAi: (reply) => { st.aiReply = reply; }, setCsv: (text) => { st.csv = text; }, setMailDown: (v) => { st.mailDown = !!v; }, setMinFill: (ms) => { env.FORM_MIN_FILL_MS = String(ms); },
    messages: async () => { const out = []; for (const k of (await env.KV.list({ prefix: 'msg:' })).keys) out.push(JSON.parse(await env.KV.get(k.name))); return out; },
    useSource: async (kind, bytes) => { if (kind !== 'xlsx') throw new Error('origen no soportado: ' + kind); st.xlsx = Buffer.from(bytes); env.PRICE_XLSX_URL = 'https://sheet.test/precios.xlsx'; env.PRICE_CSV_URL = ''; },
    seedPrices: async (p) => { await env.KV.put(KEY_CURRENT, JSON.stringify(p)); },
    getPrices: async () => JSON.parse(await env.KV.get(KEY_CURRENT)),
    addUser: async (u) => { await createUser(env, u); },
    order: async (num) => JSON.parse((await env.KV.get(`order:${num}`)) || 'null'),
    historyCount: async () => (await env.KV.list({ prefix: 'prices:history:' })).keys.length,
    stop: async () => { site.close(); api.close(); },
  };
}

// ───────────────────────────────────────────────────────────── [PHP]
/** emula el .htaccess de la web: todo lo que cuelga de /api va a api/index.php; el resto lo sirve el propio php -S */
const ROUTER = `<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api(/|$)#', $path)) { $_SERVER['SCRIPT_NAME'] = '/api/index.php'; require $_SERVER['DOCUMENT_ROOT'] . '/api/index.php'; return true; }
return false;
`;

/** Arranca el API PHP con php -S sobre una copia de api/ y enlaces a la web; devuelve la misma interfaz que startWorker. */
async function startPhp({ dist, orderTo, orderFrom, port: wanted }) {
  const { st, handle } = externals();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-php-be-'));
  const store = path.join(work, 'datos');                                   // fuera del docroot, como se recomienda en cPanel
  const www = path.join(work, 'www'), apiDir = path.join(www, 'api');       // docroot = enlaces a dist/ (no se ensucia) + la carpeta api/ de verdad
  fs.mkdirSync(www);
  for (const e of fs.readdirSync(dist)) if (e !== 'api') fs.symlinkSync(path.join(dist, e), path.join(www, e));
  const apiSrc = fs.existsSync(path.join(dist, 'api')) ? path.join(dist, 'api') : path.join(ROOT, 'backend-php/api');          // un paquete ya lleva su api/
  fs.cpSync(apiSrc, apiDir, { recursive: true, filter: (s) => !/[\\/](tests|storage)([\\/]|$)/.test(s) && !/config\.php$/.test(s) });
  const mock = http.createServer(async (rq, rs) => {
    const body = (await readBody(rq)).toString('utf8');
    try { const r = await handle(`http://mock${rq.url}`, { body }); rs.writeHead(r.status, { 'Content-Type': r.binary ? 'application/octet-stream' : 'application/json' }); rs.end(r.body); }
    catch (e) { rs.writeHead(500); rs.end(String(e.message)); }
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const MOCK = `http://127.0.0.1:${mock.address().port}`;
  const cfg = { storage_dir: store, form_min_fill_ms: 0, session_secret: SESSION_SECRET, admin_token: MASTER_TOKEN, allowed_origins: [], order_to: orderTo.split(','), order_from: orderFrom, cron_token: CRON_TOKEN,
    mail: { driver: 'resend', resend_api_key: 're_test', api_base: MOCK }, prices: { csv_url: `${MOCK}/precios.csv`, decimals: 4 }, ai: { anthropic_api_key: 'sk-test', api_base: MOCK, model: 'claude-sonnet-5-5' },
    two_step: { enabled: false } };          // el código por correo se prueba aparte (scripts/qa-security-panel.mjs): aquí los managers entran con la contraseña sola
  /** Escribe api/config.php con la configuración de pruebas (PHP la lee en cada petición). */
  const writeCfg = () => fs.writeFileSync(path.join(apiDir, 'config.php'), `<?php\nreturn json_decode(<<<'JSON'\n${JSON.stringify(cfg, null, 1)}\nJSON\n, true);\n`);
  writeCfg();
  fs.writeFileSync(path.join(work, 'router.php'), ROUTER);
  const port = wanted || await freePort();
  const env = { ...process.env, PHP_CLI_SERVER_WORKERS: '6', NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
  const child = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', www, path.join(work, 'router.php')], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = ''; child.stderr.on('data', (d) => { log += d; }); child.stdout.on('data', (d) => { log += d; });
  const SITE = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {                                            // espera a que responda
    try { if ((await fetch(SITE + '/api/health')).ok) break; } catch { /* aún arrancando */ }
    if (i === 59) throw new Error('php -S no arranca:\n' + log);
    await new Promise((r) => setTimeout(r, 100));
  }
  /** Ruta del fichero del almacén que corresponde a una clave. */
  const kv = (key) => path.join(store, 'kv', encodeURIComponent(key) + '.json');
  /** Valor guardado en el almacén del PHP para una clave (null si no existe). */
  const read = (key) => { try { return JSON.parse(fs.readFileSync(kv(key), 'utf8')).v; } catch { return null; } };
  return {
    kind: 'php', SITE, API: SITE, mails: st.mails, log: () => log,
    setAi: (reply) => { st.aiReply = reply; }, setCsv: (text) => { st.csv = text; }, setMailDown: (v) => { st.mailDown = !!v; }, setMinFill: (ms) => { cfg.form_min_fill_ms = ms; writeCfg(); },
    messages: async () => fs.readdirSync(path.join(store, 'kv')).filter((f) => f.startsWith(encodeURIComponent('msg:'))).map((f) => JSON.parse(fs.readFileSync(path.join(store, 'kv', f), 'utf8')).v),
    useSource: async (kind, bytes) => { if (kind !== 'xlsx') throw new Error('origen no soportado: ' + kind); st.xlsx = Buffer.from(bytes); cfg.prices = { xlsx_url: `${MOCK}/precios.xlsx`, decimals: 4 }; writeCfg(); },
    seedPrices: async (p) => { fs.writeFileSync(kv('prices:current'), JSON.stringify({ v: p })); },
    getPrices: async () => read('prices:current'),
    addUser: async (u) => { execFileSync('php', [path.join(apiDir, 'tools/create-user.php'), u.email, u.name, u.role, u.password], { stdio: 'pipe' }); },
    order: async (num) => read('order:' + num),
    historyCount: async () => fs.readdirSync(path.join(store, 'kv')).filter((f) => f.startsWith(encodeURIComponent('prices:history:'))).length,
    stop: async () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* ya parado */ } mock.close(); fs.rmSync(work, { recursive: true, force: true }); },
  };
}

/** Arranca el backend pedido ('worker' o 'php') y devuelve su interfaz común. */
export async function startBackend({ kind = backendKind(), dist, port, orderTo = 'info@grupotorivac.com,mzamora@torivac.com', orderFrom = 'Torivac Web <pedidos@grupotorivac.com>' }) {
  return kind === 'php' ? startPhp({ dist, orderTo, orderFrom, port }) : startWorker({ dist, orderTo, orderFrom });
}
