<?php
/** Preparación común de las pruebas: almacén temporal, configuración de pruebas, catálogo sintético y peticiones simuladas */
namespace Torivac\Tests;

use Torivac\AdminData;
use Torivac\Backup;
use Torivac\Catalog;
use Torivac\Config;
use Torivac\Http;
use Torivac\Prices;
use Torivac\RateLimit;
use Torivac\Request;
use Torivac\Router;
use Torivac\Store;

const SECRET = 'x-secreto-de-pruebas-de-al-menos-32-caracteres';
/** Token maestro de PRUEBAS (≥ 32 caracteres: uno más corto queda desactivado). */
const MASTER_TOKEN = 'token-maestro-de-pruebas-de-al-menos-32-caracteres';
/** Token de cron de PRUEBAS (≥ 24 caracteres). */
const CRON_TOKEN = 'cron-de-pruebas-de-al-menos-24-caracteres';
/** Contraseñas de PRUEBAS que cumplen la política (≥ 12, sin la parte local del correo ni nada trivial). */
const PW_JEFE = 'Clave-Directiva-2026!';
const PW_ANA = 'Clave-Cliente-2026!!';

/** Almacén temporal nuevo, configuración y catálogo sintéticos de las pruebas. */
function fresh(array $cfg = []): void
{
    $dir = sys_get_temp_dir() . '/tv-php-test-' . bin2hex(random_bytes(4));
    Store::init($dir);
    Config::set($cfg + ['storage_dir' => $dir, 'session_secret' => SECRET, 'admin_token' => MASTER_TOKEN, 'allowed_origins' => ['https://demo.example'],
        'order_to' => ['info@grupotorivac.com', 'mzamora@torivac.com'], 'order_from' => 'Torivac Web <pedidos@grupotorivac.com>', 'mail' => ['driver' => 'file'], 'form_min_fill_ms' => 0, 'two_step' => ['enabled' => false]]);        // las pruebas de formularios no mandan `_e` salvo las que prueban justo eso; el código por correo está apagado salvo en SecurityStepTest (con la configuración normal, todo manager lo pide y las pruebas de acceso no tendrían token)
    Catalog::set(['items' => ['TT0020210' => ['n' => 'Transformador serie TT 20 VA', 'pid' => 884], 'P16633' => ['n' => 'Variador portátil', 'pid' => 16633], 'R100' => ['n' => 'Resistencia 100 W', 'pid' => 1]],
        'skus' => ['aaaa00000001' => 16633], 'rules' => [['pattern' => '^TT\d{7}$', 'pid' => 884]]]);
    Http::$mock = null;
    Http::$resolver = null;
    AdminData::setFile(null);
    RateLimit::$purgeOneIn = 0;                                                           // las pruebas no dejan que una limpieza al azar cambie lo que miran
    Backup::$scheduling = false;                                                          // la copia semanal programada para el final de la petición no se crea al terminar el proceso de pruebas
}

/** Precios de ejemplo: TT0020210 con tramos y P16633. */
function prices(): array
{
    return ['updated_at' => '2026-10-27T00:00:00.000Z', 'source' => 'test', 'currency' => 'EUR', 'mode' => 'live', 'items' => ['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]]], 'P16633' => ['p' => 67.65]]];
}

/** Guarda los precios de ejemplo en el almacén. */
function seedPrices(): void { Store::put(Prices::KEY_CURRENT, Prices::forJson(prices())); }

/** Pedido válido de ejemplo (se puede sobrescribir cualquier campo). */
function goodOrder(array $over = []): array
{
    return $over + ['customer' => ['name' => 'Ana Pérez', 'company' => 'ACME', 'email' => 'ana@acme.es', 'phone' => '600', 'notes' => 'urgente', 'privacy' => true], 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3]], 'lang' => 'es'];
}

/** Petición simulada para llamar al Router sin servidor web. */
function req(string $method, string $path, $body = null, array $headers = [], string $ip = '10.0.0.1'): Request { return Request::fake($method, $path, $body, $headers, $ip); }

/** cuerpo de una respuesta tal y como lo recibe un cliente (JSON → arrays): los `items` de precios viajan como objeto y en el servidor son stdClass */
function wire($resp): array { return json_decode(\Torivac\Util::enc($resp->body), true); }

/** Cabecera de autenticación con el token maestro. */
function master(): array { return ['Authorization' => 'Bearer ' . MASTER_TOKEN]; }

/** Cabecera de autenticación con un token de sesión. */
function bearer(string $token): array { return ['Authorization' => 'Bearer ' . $token]; }

/** Inicia sesión por el API y devuelve el token (null si no entra). */
function login_token(string $email, string $pw, string $ip = '10.0.0.1'): ?string
{
    $r = Router::handle(req('POST', '/auth/login', ['email' => $email, 'password' => $pw], [], $ip));
    return $r->status === 200 ? $r->body['token'] : null;
}

/** Nombres de los ficheros del almacén (kv/) que empiezan por un prefijo ya codificado como en disco («rl%3A» para las claves rl:). */
function kv_files(string $encodedPrefix = ''): array
{
    $out = [];
    foreach (glob(Store::root() . '/kv/' . $encodedPrefix . '*.json') ?: [] as $f) $out[] = basename($f);
    return $out;
}

/** correos guardados por el controlador «file» */
function outbox(): array
{
    $out = [];
    foreach (glob(Store::root() . '/outbox/*.json') ?: [] as $f) $out[] = json_decode((string) file_get_contents($f), true);
    return $out;
}

const SHEET = "ref;price;qty2;price2;qty3;price3;note;active\nTT0020210;12,37;10;11,9;50;11,4;DEMO;1\nP16633;67,65;;;;;;1\nR100;5,5;;;;;;1\nX0;1;;;;;;0\n";

/** Carpeta temporal nueva y vacía para una prueba (la borra quien la pide con rmtree_all). */
function tmp_dir(string $prefix = 'tv-sec-'): string
{
    $d = sys_get_temp_dir() . '/' . $prefix . bin2hex(random_bytes(4));
    mkdir($d, 0775, true);
    return $d;
}

/** Borra una carpeta temporal con todo lo que lleva dentro. */
function rmtree_all(string $dir): void
{
    if (is_link($dir) || is_file($dir)) { @unlink($dir); return; }
    foreach (scandir($dir) ?: [] as $f) if ($f !== '.' && $f !== '..') rmtree_all($dir . '/' . $f);
    @rmdir($dir);
}

/**
 * Ejecuta código PHP en un proceso aparte (con la autocarga del API) y devuelve [código de salida, salida estándar, salida de error]. Sirve para lo que no debe tumbar la prueba si falla
 * (memoria, tiempo) y para los scripts de línea de comandos. `$ini` = ajustes de php.ini («memory_limit=64M»), `$env` = variables de entorno extra.
 */
function php_child(string $code, array $ini = [], array $env = [], int $timeoutSec = 120): array
{
    $f = tempnam(sys_get_temp_dir(), 'tv-child-') . '.php';
    file_put_contents($f, "<?php\nrequire " . var_export(dirname(__DIR__) . '/lib/autoload.php', true) . ";\n" . $code);
    $cmd = [PHP_BINARY];
    foreach ($ini as $i) { $cmd[] = '-d'; $cmd[] = $i; }
    $cmd[] = $f;
    $p = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, array_merge(getenv(), ['NO_PROXY' => '127.0.0.1,localhost', 'no_proxy' => '127.0.0.1,localhost'], $env));
    stream_set_timeout($pipes[1], $timeoutSec);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    $rc = proc_close($p);
    @unlink($f);
    return [$rc, (string) $out, (string) $err];
}

/**
 * Arranca el API REAL (api/index.php) con `php -S` en un puerto libre; la configuración va por variables de entorno TORIVAC_* (no hay config.php). La ruta /control hace saltar un aviso
 * de PHP a propósito (para comprobar que, con display_errors=1 en el servidor, el API no deja que un aviso llegue a la respuesta).
 * @return array{base:string,dir:string,stop:callable}|null  null si el entorno no deja lanzar procesos
 */
function api_server(array $env, array $ini = ['display_errors=1']): ?array
{
    if (!function_exists('proc_open')) return null;
    $dir = tmp_dir('tv-srv-');
    $router = $dir . '/router.php';
    file_put_contents($router, "<?php\n\$p = parse_url(\$_SERVER['REQUEST_URI'], PHP_URL_PATH);\nif (\$p === '/control') { \$a = [1]; echo 'control:' . \$a; return true; }\n\$_SERVER['SCRIPT_NAME'] = '/api/index.php';\nrequire " . var_export(dirname(__DIR__) . '/index.php', true) . ";\nreturn true;\n");
    $s = stream_socket_server('tcp://127.0.0.1:0');
    $port = (int) substr(stream_socket_get_name($s, false), strrpos(stream_socket_get_name($s, false), ':') + 1);
    fclose($s);
    $cmd = [PHP_BINARY];
    foreach ($ini as $i) { $cmd[] = '-d'; $cmd[] = $i; }
    array_push($cmd, '-S', "127.0.0.1:$port", $router);
    $e = array_merge(getenv(), ['NO_PROXY' => '127.0.0.1,localhost', 'no_proxy' => '127.0.0.1,localhost', 'TORIVAC_STORAGE_DIR' => $dir . '/datos'], $env);
    putenv('NO_PROXY=127.0.0.1,localhost'); putenv('no_proxy=127.0.0.1,localhost');
    $proc = proc_open($cmd, [1 => ['file', '/dev/null', 'w'], 2 => ['file', $dir . '/server.log', 'w']], $pipes, $dir, $e);
    for ($i = 0; $i < 60; $i++) { $c = @fsockopen('127.0.0.1', $port, $en, $es, 0.2); if ($c) { fclose($c); break; } usleep(100000); }
    return ['base' => "http://127.0.0.1:$port", 'dir' => $dir, 'stop' => function () use ($proc, $dir) { proc_terminate($proc); proc_close($proc); rmtree_all($dir); }];
}

/**
 * Zip mínimo hecho a mano con las entradas que se le den: nombre => contenido (se comprime con deflate; los nombres que acaban en «!» se guardan SIN comprimir) o nombre =>
 * ['deflate' => flujo ya comprimido, 'usize' => tamaño que declara] (para meter una bomba de descompresión sin tenerla entera en memoria). `$lie` cambia el tamaño sin comprimir
 * que declara el directorio central de TODAS las entradas (para probar que el tope vale aunque el libro mienta).
 */
function zip_build(array $entries, ?int $lie = null): string
{
    $local = ''; $central = ''; $n = 0;
    foreach ($entries as $name => $content) {
        $stored = substr($name, -1) === '!';
        $name = rtrim($name, '!');
        if (is_array($content)) { $data = $content['deflate']; $crc = 0; $usize = $lie ?? $content['usize']; }
        else { $data = $stored ? $content : gzdeflate($content); $crc = crc32($content); $usize = $lie ?? strlen($content); }
        $off = strlen($local);
        $local .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0, $stored ? 0 : 8, 0, 0x21, $crc, strlen($data), $usize, strlen($name), 0) . $name . $data;
        $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, $stored ? 0 : 8, 0, 0x21, $crc, strlen($data), $usize, strlen($name), 0, 0, 0, 0, 0, $off) . $name;
        $n++;
    }
    return $local . $central . pack('VvvvvVVv', 0x06054b50, 0, 0, $n, $n, strlen($central), strlen($local), 0);
}

/** Libro con una sola hoja «Precios» cuyo XML de hoja es `$sheetXml` (más, si se quiere, las cadenas compartidas). */
function xlsx_with_sheet(string $sheetXml, string $sharedXml = ''): string
{
    $e = ['[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => '<workbook xmlns:r="x"><sheets><sheet name="Precios" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml' => $sheetXml];
    if ($sharedXml !== '') $e['xl/sharedStrings.xml'] = $sharedXml;
    return zip_build($e);
}

/** Datos del cliente de un pedido de prueba (cualquier campo se puede sobrescribir). */
function so_customer(array $over = []): array
{
    return $over + ['name' => 'Ana Pérez', 'company' => 'ACME', 'email' => 'ana@acme.es', 'phone' => '600', 'notes' => 'urgente', 'privacy' => true];
}

/** Envía un pedido por el manejador; cada llamada usa por defecto una IP distinta (no se tropieza con el límite por visitante). */
function so_post($body, ?string $ip = null, ?int $now = null)
{
    static $n = 0;
    $ip = $ip ?? ('203.0.113.' . (1 + ($n++ % 250)));
    return \Torivac\Orders::handleOrder(req('POST', '/order', $body, [], $ip), $body, null, $now);
}

/** Flujo deflate (sin cabecera zlib) de `$mb` megabytes de espacios, hecho por trozos: ocupa unos 300 KB comprimido y 300 MB descomprimido (la «bomba» del informe). */
function deflate_bomb(int $mb = 300): string
{
    $ctx = deflate_init(ZLIB_ENCODING_RAW, ['level' => 9]);
    $chunk = str_repeat(' ', 1048576);
    $out = '';
    for ($i = 0; $i < $mb; $i++) $out .= deflate_add($ctx, $chunk, ZLIB_NO_FLUSH);
    return $out . deflate_add($ctx, '', ZLIB_FINISH);
}

/** Correo de ejemplo al equipo con todos los campos. */
function mt_msg(array $over = []): array
{
    return $over + ['to' => ['info@grupotorivac.com', 'mzamora@torivac.com'], 'subject' => 'Contacto web · Ana', 'html' => '<p>Hola</p>', 'text' => 'Hola', 'replyTo' => 'ana@acme.es'];
}

/** HTTP simulado que guarda cada petición en `$calls` y responde `$status` / `$body` (o lanza si `$throw`). */
function mt_http(array &$calls, int $status = 200, string $body = '{"id":"m1"}', ?string $throw = null): void
{
    Http::$mock = function ($method, $url, $headers, $payload) use (&$calls, $status, $body, $throw) {
        if ($throw !== null) throw new \RuntimeException($throw);
        $calls[] = ['method' => $method, 'url' => $url, 'headers' => $headers, 'body' => json_decode((string) $payload, true)];
        return [$status, $body];
    };
}

/** Imágenes de 1×1 píxel válidas (PNG, JPEG y WebP). */
function bl_img(string $kind = 'png'): string
{
    $b = ['png' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'jpg' => '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'webp' => 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='][$kind];
    return (string) base64_decode($b, true);
}

/** PNG que dice tener esas dimensiones (solo la cabecera: basta para que se rechace por tamaño). */
function bl_png_dims(int $w, int $h): string { return "\x89PNG\r\n\x1a\n" . pack('N', 13) . 'IHDR' . pack('NN', $w, $h) . "\x08\x02\x00\x00\x00" . pack('N', 0) . pack('N', 0) . 'IEND' . pack('N', 0); }
