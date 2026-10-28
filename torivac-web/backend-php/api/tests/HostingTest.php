<?php
/**
 * Pruebas de lo que cambia de un hosting a otro (cPanel, Plesk…): la carpeta de datos que se elige, la IP real del visitante detrás de un proxy (el nginx de
 * Plesk, Cloudflare) y las comprobaciones del diagnóstico que dependen del servidor. Sin red ni servidor web: todo con rutas temporales y $_SERVER simulado.
 */
namespace Torivac\Tests;

require_once __DIR__ . '/support.php';

use Torivac\Config;
use Torivac\Diag;
use Torivac\Request;
use Torivac\Store;

/** Carpeta temporal nueva y vacía para una prueba. */
function hosting_tmpdir(): string
{
    $d = sys_get_temp_dir() . '/tv-host-' . bin2hex(random_bytes(4));
    mkdir($d, 0775, true);
    return $d;
}

/** Borra una carpeta temporal con todo lo que lleva dentro. */
function hosting_rmtree(string $dir): void
{
    if (is_link($dir) || is_file($dir)) { @unlink($dir); return; }
    foreach (scandir($dir) ?: [] as $f) if ($f !== '.' && $f !== '..') hosting_rmtree($dir . '/' . $f);
    @rmdir($dir);
}

/** Estado de cada comprobación del diagnóstico por su id. */
function hosting_status(array $checks): array
{
    $o = [];
    foreach ($checks as $c) $o[$c['id']] = $c['status'];
    return $o;
}

/** IP del visitante: sin proxy no se puede falsear con cabeceras; detrás de un proxy de confianza (nginx de Plesk, Cloudflare) se lee X-Forwarded-For de derecha a izquierda. */
function test_client_ip_behind_proxies()
{
    $ip = function ($remote, $h = [], $extra = []) { return Request::clientIp($remote, $h, $extra); };
    T::same('203.0.113.9', $ip('203.0.113.9', ['x-forwarded-for' => '1.1.1.1', 'cf-connecting-ip' => '2.2.2.2']), 'conexión directa: las cabeceras no cuentan (no se puede saltar el límite de intentos)');
    T::same('198.51.100.7', $ip('127.0.0.1', ['x-forwarded-for' => '198.51.100.7']), 'nginx en la misma máquina: la IP que añadió');
    T::same('198.51.100.7', $ip('127.0.0.1', ['x-forwarded-for' => '9.9.9.9, 198.51.100.7']), 'lo que el visitante escribe a la izquierda no cuenta');
    T::same('198.51.100.7', $ip('10.1.2.3', ['x-forwarded-for' => '198.51.100.7, 10.1.2.4']), 'los saltos internos al final de la cadena se saltan');
    T::same('2001:db8::5', $ip('::1', ['x-forwarded-for' => '2001:DB8:0:0:0:0:0:5']), 'IPv6 en forma normal');
    T::same('198.51.100.7', $ip('::ffff:127.0.0.1', ['x-forwarded-for' => '198.51.100.7:5555']), 'IPv4 dentro de IPv6 y con puerto');
    T::same('198.51.100.7', $ip('104.16.0.1', ['cf-connecting-ip' => '198.51.100.7', 'x-forwarded-for' => '9.9.9.9']), 'Cloudflare: CF-Connecting-IP');
    T::same('198.51.100.7', $ip('104.16.0.1', ['x-forwarded-for' => '9.9.9.9, 198.51.100.7']), 'Cloudflare sin CF-Connecting-IP: la cadena');
    T::same('127.0.0.1', $ip('127.0.0.1', ['cf-connecting-ip' => '198.51.100.7']), 'CF-Connecting-IP no vale si quien conecta no es Cloudflare');
    T::same('198.51.100.7', $ip('127.0.0.1', ['cf-connecting-ip' => '9.9.9.9', 'x-forwarded-for' => '198.51.100.7']), 'nginx delante de Apache con Cloudflare por detrás: manda la cadena');
    T::same('10.0.0.5', $ip('127.0.0.1', ['x-forwarded-for' => '10.0.0.5']), 'red interna entera: vale la primera dirección');
    T::same('198.51.100.7', $ip('203.0.113.50', ['x-forwarded-for' => '198.51.100.7'], ['203.0.113.0/24']), 'proxy propio dado en trusted_proxies');
    T::same('203.0.113.50', $ip('203.0.113.50', ['x-forwarded-for' => '198.51.100.7']), 'sin trusted_proxies ese proxy no se cree');
    T::same('198.51.100.7', $ip('192.0.2.10', ['x-forwarded-for' => '198.51.100.7'], ['192.0.2.10']), 'la propia IP del servidor (nginx conectando por la IP pública)');
    T::same('0.0.0.0', $ip('no-es-una-ip'), 'conexión sin IP válida');
    T::same('127.0.0.1', $ip('127.0.0.1', ['x-forwarded-for' => 'basura, otra']), 'cabecera ilegible: se queda con quien conecta');
}

/** Pertenencia a una red: límites, máscaras que no son múltiplo de 8, IPv6, familias distintas, IP suelta y /0. */
function test_ip_in_net()
{
    T::same([true, true, false, false], [Request::inNet('10.255.255.255', '10.0.0.0/8'), Request::inNet('172.31.255.255', '172.16.0.0/12'), Request::inNet('172.32.0.0', '172.16.0.0/12'), Request::inNet('11.0.0.0', '10.0.0.0/8')], 'límites de las redes privadas');
    T::same([true, false], [Request::inNet('173.245.63.255', '173.245.48.0/20'), Request::inNet('173.245.64.0', '173.245.48.0/20')], '/20 de Cloudflare');
    T::same([true, false, false], [Request::inNet('2606:4700::1', '2606:4700::/32'), Request::inNet('2606:4701::1', '2606:4700::/32'), Request::inNet('10.0.0.1', '2606:4700::/32')], 'IPv6 y familias distintas');
    T::same([true, false, true, false], [Request::inNet('203.0.113.7', '203.0.113.7'), Request::inNet('203.0.113.8', '203.0.113.7'), Request::inNet('8.8.8.8', '0.0.0.0/0'), Request::inNet('no', '10.0.0.0/8')], 'IP suelta, /0 e IP no válida');
    T::same([true, true, false], [Request::isTrustedProxy('127.0.0.1'), Request::isTrustedProxy('172.67.1.1'), Request::isTrustedProxy('8.8.8.8')], 'loopback y Cloudflare sí, una IP cualquiera no');
}

/** Proxies de confianza extra: los de config (lista o texto con comas) más la dirección del propio servidor. */
function test_proxy_list()
{
    Config::set(['trusted_proxies' => '203.0.113.0/24, 198.51.100.9']);
    T::same(['203.0.113.0/24', '198.51.100.9', '192.0.2.10'], Request::proxyList(['SERVER_ADDR' => '192.0.2.10']), 'texto con comas + SERVER_ADDR');
    Config::set(['trusted_proxies' => ['203.0.113.0/24']]);
    T::same(['203.0.113.0/24'], Request::proxyList(['SERVER_ADDR' => 'basura']), 'lista; un SERVER_ADDR ilegible se ignora');
    Config::set([]);
    T::same(['::1'], Request::proxyList(['SERVER_ADDR' => '::1']), 'solo SERVER_ADDR');
}

/** Petición real (a partir de $_SERVER): nginx de Plesk que llama a Apache por la IP pública de la máquina, y conexión directa con cabeceras falsas. */
function test_request_from_globals_ip()
{
    $keep = $_SERVER;
    try {
        Config::set([]);
        $_SERVER = ['REQUEST_METHOD' => 'POST', 'REQUEST_URI' => '/api/order', 'REMOTE_ADDR' => '198.51.100.20', 'SERVER_ADDR' => '198.51.100.20', 'HTTP_X_FORWARDED_FOR' => '9.9.9.9, 203.0.113.99'];
        T::same(['/order', '203.0.113.99'], [Request::fromGlobals()->path, Request::fromGlobals()->ip], 'nginx → Apache por la IP pública del servidor');
        $_SERVER = ['REQUEST_METHOD' => 'POST', 'REQUEST_URI' => '/api/auth/login', 'REMOTE_ADDR' => '203.0.113.99', 'SERVER_ADDR' => '198.51.100.20', 'HTTP_X_FORWARDED_FOR' => '9.9.9.9', 'HTTP_CF_CONNECTING_IP' => '8.8.8.8'];
        T::same('203.0.113.99', Request::fromGlobals()->ip, 'conexión directa con cabeceras falsas: gana la IP real');
        $_SERVER = ['REQUEST_METHOD' => 'GET', 'REQUEST_URI' => '/api/prices', 'REMOTE_ADDR' => '203.0.113.99', 'SERVER_ADDR' => '198.51.100.20'];
        T::same('203.0.113.99', Request::fromGlobals()->ip, 'mod_remoteip ya entregó la IP real en REMOTE_ADDR');
    } finally {
        $_SERVER = $keep;
    }
}

/** Carpeta de datos: la configurada, un almacén que ya tiene datos, la primera que se pueda crear, o error claro; un fichero en medio hace de «raíz de solo lectura» (Plesk). */
function test_store_picks_a_usable_data_folder()
{
    $base = hosting_tmpdir();
    try {
        file_put_contents("$base/archivo", 'x');                               // nada se puede crear por debajo de un fichero: como la raíz de la cuenta en Plesk
        $bad = "$base/archivo/torivac-datos";
        $web = "$base/web/api/storage";
        $home = "$base/home/torivac-datos";
        T::same(['/home/u/torivac-datos', '/srv/web/api/storage'], Store::candidates('/home/u/', '/srv/web/api/'), 'cPanel: carpeta personal primero y api/storage al final');
        T::same(['/srv/web/api/storage'], Store::candidates('', '/srv/web/api'), 'sin carpeta personal solo api/storage');
        T::same($web, Store::bootstrap('', [$bad, $web]), 'salta la que no se puede crear y usa la siguiente');
        T::same('', Store::note(), 'sin desvío no hay aviso');
        T::true(is_file("$web/.htaccess") && is_dir("$web/kv") && is_dir("$web/locks"), 'el almacén queda listo y protegido');
        T::same($web, Store::bootstrap('', [$home, $web]), 'un almacén que ya existe no cambia de sitio aunque aparezca una carpeta mejor');
        T::true(!is_dir($home), 'y la otra no se crea');
        T::same("$base/fijo", Store::bootstrap("$base/fijo", [$web]), 'storage_dir válida: manda sobre todo');
        T::same('', Store::note(), 'sin aviso');
        T::same($web, Store::bootstrap($bad, [$web]), 'storage_dir inservible: se desvía al almacén que hay');
        T::true(strpos(Store::note(), $bad) !== false && strpos(Store::note(), $web) !== false, 'el aviso dice cuál se quiso y cuál se usa');
        T::throws(function () use ($bad) { Store::bootstrap($bad, [$bad . '2']); }, '/ninguna carpeta de datos/', 'nada sirve');
        if (function_exists('posix_geteuid') && posix_geteuid() !== 0) {          // root puede escribir en cualquier sitio: esta parte solo vale con un usuario normal
            $ro = "$base/solo-lectura";
            Store::init($ro);
            chmod($ro, 0555);
            T::same($ro, Store::bootstrap('', [$ro]), 'si nada se puede escribir se usa el almacén existente (solo lectura) en vez de caer');
            chmod($ro, 0775);
        }
    } finally {
        hosting_rmtree($base);
        fresh();
    }
}

/** El diagnóstico avisa cuando la carpeta de datos configurada no sirvió y se usó otra; por línea de comandos sabe si la carpeta cae dentro de la web. */
function test_diag_reports_data_folder_deviation()
{
    $base = hosting_tmpdir();
    $inside = dirname(__DIR__, 2) . '/storage-prueba-' . bin2hex(random_bytes(3));   // dentro de backend-php/: la carpeta que contiene api/ (la «web» en esta prueba)
    try {
        file_put_contents("$base/archivo", 'x');
        Store::bootstrap("$base/archivo/datos", ["$base/ok"]);
        Config::set(['storage_dir' => "$base/archivo/datos", 'session_secret' => str_repeat('a1b2', 10), 'order_to' => ['info@grupotorivac.com'], 'mail' => ['driver' => 'none']]);
        $s = hosting_status(Diag::run(false, '/no/existe/config.php')['checks']);
        T::same(['ok', 'warn'], [$s['datos'], $s['datos_desvio']], 'carpeta fuera de la web y aviso del desvío');
        Store::bootstrap($inside, []);
        $s2 = hosting_status(Diag::run(false, '/no/existe/config.php')['checks']);
        T::same(['warn', false], [$s2['datos'], isset($s2['datos_desvio'])], 'una carpeta dentro de la web se avisa también por línea de comandos, sin aviso de desvío');
    } finally {
        hosting_rmtree($base);
        hosting_rmtree($inside);
        fresh();
    }
}

/** Comprobaciones de servidor del diagnóstico: nginx sin Apache ignora el .htaccess; la IP del visitante tras un proxy; HTTPS. */
function test_diag_web_checks()
{
    fresh();
    $nginx = hosting_status(Diag::web(null, ['SERVER_SOFTWARE' => 'nginx/1.24.0', 'HTTPS' => 'on']));
    T::same(['warn', 'ok'], [$nginx['servidor'], $nginx['https']], 'nginx solo: el .htaccess no se aplica');
    foreach (['Apache/2.4.58 (Unix)', 'LiteSpeed'] as $sw) T::same('ok', hosting_status(Diag::web(null, ['SERVER_SOFTWARE' => $sw]))['servidor'], "$sw respeta el .htaccess");
    T::same('warn', hosting_status(Diag::web(null, ['SERVER_SOFTWARE' => 'Apache', 'HTTPS' => 'off']))['https'], 'HTTP sin cifrar');
    T::same('ok', hosting_status(Diag::web(null, ['SERVER_SOFTWARE' => 'Apache', 'HTTP_X_FORWARDED_PROTO' => 'https']))['https'], 'HTTPS terminado en un proxy');
    $ipOf = function (string $remote, string $clientIp, array $extra = []) {
        $r = Request::fake('GET', '/diag', null, [], $clientIp);
        $c = Diag::web($r, ['SERVER_SOFTWARE' => 'Apache', 'REMOTE_ADDR' => $remote] + $extra);
        foreach ($c as $x) if ($x['id'] === 'ip_visitante') return $x['status'] . ':' . (strpos($x['msg'], 'proxy delante (') !== false ? 'proxy' : (strpos($x['msg'], 'IP interna') !== false ? 'interna' : 'real'));
        return 'nada';
    };
    T::same('ok:proxy', $ipOf('127.0.0.1', '198.51.100.7'), 'la IP salió de las cabeceras del proxy');
    T::same('warn:interna', $ipOf('127.0.0.1', '127.0.0.1'), 'todas las visitas con la IP interna: el proxy no pasa la real');
    T::same('warn:interna', $ipOf('198.51.100.20', '198.51.100.20', ['SERVER_ADDR' => '198.51.100.20']), 'nginx llamando por la IP pública del servidor sin pasar la real');
    T::same('ok:real', $ipOf('198.51.100.7', '198.51.100.7', ['SERVER_ADDR' => '198.51.100.20']), 'Apache ya ve la IP real (mod_remoteip o conexión directa)');
    T::same('nada', $ipOf('', '0.0.0.0'), 'sin REMOTE_ADDR no se afirma nada');
}
