// [APACHE] Un Apache REAL con PHP-FPM (como en Plesk y cPanel) para probar el paquete tal como se sube: el .htaccess de verdad (reescrituras, 410, cabeceras, 404 por idioma, ruta /api, cabecera
// Authorization hacia PHP-FPM), no un servidor de pruebas que lo imite. Necesita los paquetes apache2 y php8.3-fpm (sudo apt-get install apache2 php8.3-fpm); si no están, las pruebas que lo usan
// se saltan con un aviso claro (apacheAvailable() devuelve el motivo).
//
//   const why = apacheAvailable();                                  → '' si se puede usar, o el motivo por el que no
//   const ap = await startApache({ docroot, port?, extraConf? });    → { url, port, dir, dataDir, stop(), log() }
//     docroot = carpeta del paquete descomprimido (con .htaccess y api/). Apache corre como www-data y PHP-FPM también; la carpeta de datos va FUERA del docroot y es de www-data.
//   await ap.stop()
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const MODULES = ['mpm_event', 'authz_core', 'authz_host', 'authn_core', 'access_compat', 'alias', 'dir', 'env', 'expires', 'filter', 'deflate', 'headers', 'mime', 'rewrite', 'setenvif', 'proxy', 'proxy_fcgi', 'autoindex'];
/** Primera ruta que existe de una lista, o ''. */
const firstExisting = (list) => list.find((p) => fs.existsSync(p)) || '';

/** '' si hay Apache y PHP-FPM utilizables; si no, el motivo (qué instalar). */
export function apacheAvailable() {
  const apache = firstExisting(['/usr/sbin/apache2', '/usr/sbin/httpd']), fpm = firstExisting(['/usr/sbin/php-fpm8.3', '/usr/sbin/php-fpm8.2', '/usr/sbin/php-fpm8.4', '/usr/sbin/php-fpm8.1', '/usr/sbin/php-fpm']);
  if (!apache) return 'falta Apache (sudo apt-get install apache2)';
  if (!fpm) return 'falta PHP-FPM (sudo apt-get install php8.3-fpm)';
  if (process.getuid && process.getuid() !== 0) return 'hace falta ejecutar como root (Apache y PHP-FPM cambian al usuario www-data)';
  if (spawnSync('id', ['www-data']).status !== 0) return 'falta el usuario www-data';
  if (!fs.existsSync('/usr/lib/apache2/modules/mod_rewrite.so')) return 'faltan los módulos de Apache en /usr/lib/apache2/modules';
  return '';
}
/** Puerto TCP libre en 127.0.0.1. */
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
/** Espera (hasta `ms`) a que algo responda en el puerto. */
async function waitPort(port, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ok = await new Promise((r) => { const s = net.connect(port, '127.0.0.1', () => { s.destroy(); r(true); }); s.on('error', () => r(false)); });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** Arranca PHP-FPM y Apache sobre `docroot`. `extraConf` se añade al final de la configuración de Apache (p. ej. otro <VirtualHost> o directivas de prueba). */
export async function startApache({ docroot, port, extraConf = '', phpIni = {} }) {
  const why = apacheAvailable(); if (why) throw new Error('Apache real no disponible: ' + why);
  const apacheBin = firstExisting(['/usr/sbin/apache2', '/usr/sbin/httpd']);
  const fpmBin = firstExisting(['/usr/sbin/php-fpm8.3', '/usr/sbin/php-fpm8.2', '/usr/sbin/php-fpm8.4', '/usr/sbin/php-fpm8.1', '/usr/sbin/php-fpm']);
  port = port || await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-apache-')); fs.chmodSync(dir, 0o755);
  const dataDir = path.join(dir, 'datos'); fs.mkdirSync(dataDir); spawnSync('chown', ['-R', 'www-data:www-data', dataDir]);
  const sock = path.join(dir, 'fpm.sock'), logs = path.join(dir, 'logs'); fs.mkdirSync(logs); fs.chmodSync(logs, 0o777);
  // PHP-FPM: un pool como el de Plesk (usuario del sitio, socket)
  fs.writeFileSync(path.join(dir, 'fpm.conf'), `[global]\npid = ${dir}/fpm.pid\nerror_log = ${logs}/fpm-error.log\ndaemonize = no\n[www]\nuser = www-data\ngroup = www-data\nlisten = ${sock}\nlisten.owner = www-data\nlisten.group = www-data\npm = static\npm.max_children = 6\nclear_env = no\n` +
    Object.entries({ 'error_log': path.join(logs, 'php-error.log'), 'log_errors': 'On', 'display_errors': 'Off', 'post_max_size': '8M', 'upload_max_filesize': '8M', 'memory_limit': '256M', ...phpIni }).map(([k, v]) => `php_admin_value[${k}] = ${v}\n`).join(''));
  const fpm = spawn(fpmBin, ['--nodaemonize', '--fpm-config', path.join(dir, 'fpm.conf'), '--allow-to-run-as-root'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let fpmLog = ''; fpm.stderr.on('data', (d) => { fpmLog += d; }); fpm.stdout.on('data', (d) => { fpmLog += d; });
  for (let i = 0; i < 60 && !fs.existsSync(sock); i++) await new Promise((r) => setTimeout(r, 100));
  if (!fs.existsSync(sock)) { try { process.kill(-fpm.pid); } catch { /* ya parado */ } throw new Error('PHP-FPM no arranca:\n' + fpmLog); }
  // Apache
  const load = MODULES.map((m) => `LoadModule ${m}_module /usr/lib/apache2/modules/mod_${m}.so`).join('\n');
  fs.writeFileSync(path.join(dir, 'apache.conf'), `ServerRoot "${dir}"\nPidFile "${dir}/apache.pid"\nListen 127.0.0.1:${port}\nServerName 127.0.0.1\nUser www-data\nGroup www-data\nServerLimit 2\nThreadsPerChild 16\nStartServers 1\nMinSpareThreads 4\nMaxSpareThreads 16\n${load}\n` +
    `ErrorLog "${logs}/apache-error.log"\nLogLevel warn\nLogFormat "%h %>s %m %U%q" tv\nCustomLog "${logs}/apache-access.log" tv\nTypesConfig /etc/mime.types\nDocumentRoot "${docroot}"\n` +
    `<Directory />\n  AllowOverride None\n  Require all denied\n</Directory>\n<Directory "${docroot}">\n  AllowOverride All\n  Require all granted\n</Directory>\n` +
    `<FilesMatch "\\.php$">\n  SetHandler "proxy:unix:${sock}|fcgi://localhost"\n</FilesMatch>\nDirectoryIndex index.html index.php\n${extraConf}\n`);
  const t = spawnSync(apacheBin, ['-t', '-f', path.join(dir, 'apache.conf')], { encoding: 'utf8' });
  if (t.status !== 0) { try { process.kill(-fpm.pid); } catch { /* ya parado */ } throw new Error('configuración de Apache no válida:\n' + t.stderr); }
  const ap = spawn(apacheBin, ['-f', path.join(dir, 'apache.conf'), '-DFOREGROUND'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let apLog = ''; ap.stderr.on('data', (d) => { apLog += d; }); ap.stdout.on('data', (d) => { apLog += d; });
  if (!(await waitPort(port, 8000))) { try { process.kill(-ap.pid); process.kill(-fpm.pid); } catch { /* ya parado */ } throw new Error('Apache no arranca:\n' + apLog + '\n' + (fs.existsSync(path.join(logs, 'apache-error.log')) ? fs.readFileSync(path.join(logs, 'apache-error.log'), 'utf8') : '')); }
  return {
    url: `http://127.0.0.1:${port}`, port, dir, dataDir,
    /** Últimas líneas de los registros de Apache y de PHP (para entender un fallo). */
    log: () => ['apache-error.log', 'php-error.log', 'fpm-error.log'].map((f) => { try { return `── ${f}\n` + fs.readFileSync(path.join(logs, f), 'utf8').split('\n').slice(-25).join('\n'); } catch { return ''; } }).join('\n'),
    /** Para Apache y PHP-FPM y borra la carpeta temporal (el docroot no se toca). */
    stop: async () => { for (const p of [ap, fpm]) { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* ya parado */ } } await new Promise((r) => setTimeout(r, 300)); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
