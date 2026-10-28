<?php
/**
 * Pruebas de seguridad del acceso, las sesiones y los límites (informe del revisor del PHP: A2, A3, A4, A5, A12 · decisiones D2, D3 y D4). Cada hallazgo reproduce el ataque del informe y
 * comprueba que ya no funciona, y que lo legítimo sigue funcionando. Sin red ni servidor web.
 */
namespace Torivac\Tests;

require_once __DIR__ . '/support.php';

use Torivac\Auth;
use Torivac\Diag;
use Torivac\Http;
use Torivac\Orders;
use Torivac\RateLimit;
use Torivac\Request;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;
use Torivac\Util;

/** Pedido por el manejador desde una IP devolviendo solo el código HTTP (para las pruebas de límites). */
function sa_order_status($body, string $ip): int
{
    return so_post($body, $ip)->status;
}

/** Casos compartidos de la clave de límite por visitante (shared/ip-key.fixtures.json; en el paquete del hosting hay una copia junto a las pruebas). */
function ipkey_fixtures(): array
{
    $f = __DIR__ . '/../../../shared/ip-key.fixtures.json';
    if (!is_file($f)) $f = __DIR__ . '/ip-key.fixtures.json';
    return json_decode((string) file_get_contents($f), true);
}

/** Intento de acceso por el manejador desde una IP; devuelve la respuesta. */
function sa_login(string $email, string $pw, string $ip)
{
    return Router::handle(req('POST', '/auth/login', ['email' => $email, 'password' => $pw], [], $ip));
}

/** Llamada GET a una ruta con un token (o sin él) desde una IP. */
function sa_get(string $path, ?string $token, string $ip = '10.0.0.1')
{
    return Router::handle(req('GET', $path, null, $token === null ? [] : bearer($token), $ip));
}

/** Llamada GET /cron?token=… desde una IP. */
function sa_cron(string $token, string $ip)
{
    $q = req('GET', '/cron', null, [], $ip);
    $q->query = ['token' => $token];
    return Router::handle($q);
}

/** Token firmado a mano con el secreto de pruebas (para probar tokens que el servidor nunca emitiría). */
function sa_forge(array $payload, string $secret = SECRET): string
{
    $p = json_encode($payload);
    return Util::b64url($p) . '.' . Util::b64url(hash_hmac('sha256', $p, $secret, true));
}

/** D2 · Los mismos casos de ipKey que el Worker (shared/ip-key.fixtures.json): IPv4 tal cual, IPv6 por su /64, IPv4 dentro de IPv6 y lo ilegible = «0». */
function test_d2_ip_key_shared_cases()
{
    $fx = ipkey_fixtures();
    T::true(count($fx['cases']) >= 14, 'hay casos compartidos');
    foreach ($fx['cases'] as [$in, $out]) T::same($out, Request::ipKey($in), 'ipKey(' . json_encode($in) . ')');
    T::same('2001:0db8:0000:0000::/64', Request::ipKey("2001:db8::1\n"), 'ipKey recorta espacios y saltos de línea');
}

/** A2 · Los límites por visitante (acceso, pedido, contacto) cuentan por /64: 30 direcciones de un mismo /64 ya no son 30 visitantes, y otro /64 u otra IPv4 sí tienen cupo propio. */
function test_a2_ipv6_addresses_of_one_slash64_share_every_limit()
{
    fresh(); seedPrices();
    Users::create(['email' => 'boss@torivac.test', 'name' => 'Boss', 'role' => 'manager', 'password' => PW_JEFE]);
    $v6 = function ($i, $block = '12') { return sprintf('2001:db8:abcd:%s::%x', $block, $i); };
    $c401 = $c429 = 0;
    for ($i = 1; $i <= 30; $i++) { $st = sa_login('boss@torivac.test', 'mala' . $i, $v6($i))->status; if ($st === 401) $c401++; elseif ($st === 429) $c429++; }
    T::same([5, 25], [$c401, $c429], 'A2: 30 intentos contra boss@ desde 30 IPv6 de un /64 → 5 respuestas 401 y 25 respuestas 429 (antes 30 × 401)');
    T::same(401, sa_login('boss@torivac.test', 'mala', $v6(1, '13'))->status, 'otro /64 tiene su propio cupo');
    T::same(401, sa_login('boss@torivac.test', 'mala', '203.0.113.200')->status, 'y una IPv4 también');
    $codes = [];
    for ($i = 1; $i <= 9; $i++) $codes[] = sa_order_status(goodOrder(['customer' => so_customer(['email' => "c$i@acme.es"])]), $v6($i, '20'));
    T::same([200, 200, 200, 200, 200, 200, 200, 200, 429], $codes, 'pedidos: 9 desde un /64 → el 9.º recibe 429');
    T::same(200, sa_order_status(goodOrder(['customer' => so_customer(['email' => 'z@acme.es'])]), $v6(1, '21')), 'pedido desde otro /64: normal');
    $contact = ['name' => 'Luis', 'email' => 'l@x.es', 'message' => 'Quiero un toroidal de 500 VA', 'privacy' => true];
    $codes = [];
    for ($i = 1; $i <= 6; $i++) $codes[] = Router::handle(req('POST', '/contact', $contact, [], $v6($i, '30')))->status;
    T::same([200, 200, 200, 200, 200, 429], $codes, 'contacto: 6 desde un /64 → el 6.º recibe 429');
    for ($i = 0; $i < 8; $i++) sa_order_status(goodOrder(['customer' => so_customer(['email' => "m$i@acme.es"])]), '203.0.113.5');
    T::same(429, sa_order_status(goodOrder(['customer' => so_customer(['email' => 'm9@acme.es'])]), '::ffff:203.0.113.5'), 'una IPv4 escrita como ::ffff:a.b.c.d comparte el cupo de esa IPv4');
    T::same(200, sa_order_status(goodOrder(['customer' => so_customer(['email' => 'm10@acme.es'])]), '203.0.113.6'), 'otra IPv4 vecina tiene el suyo');
    T::same('2001:db8:abcd:20::1', Store::get(Store::keys('order:')[0])['ip'], 'el registro del pedido sigue guardando la IP COMPLETA');
}

/**
 * Seguridad 2 · Fuerza bruta: 5 contraseñas erróneas del mismo visitante contra una cuenta la bloquean 1 hora (desde el 5.º fallo; ni la contraseña buena entra); 15 fallos de un visitante contra
 * cualquier cuenta lo bloquean 1 hora; 30 fallos contra una cuenta, de cualquier visitante, la bloquean 1 hora. Todos cuentan también los correos que no existen y responden lo mismo.
 */
function test_d3_login_limits_per_ip_and_per_account()
{
    fresh();
    Users::create(['email' => 'boss@torivac.test', 'name' => 'Boss', 'role' => 'manager', 'password' => PW_JEFE]);
    $msg = 'Demasiados intentos fallidos. Vuelve a intentarlo en una hora.';
    // (a) visitante + cuenta: 5 fallos y el 6.º ya es 429; existe o no el usuario, igual
    $bodies = [];
    foreach (['boss@torivac.test', 'nadie@torivac.test'] as $email) {
        $codes = [];
        for ($i = 1; $i <= 8; $i++) $codes[] = sa_login($email, 'mala', '198.51.100.20')->status;
        T::same([401, 401, 401, 401, 401, 429, 429, 429], $codes, "(a) $email: 5 intentos fallidos y luego 429");
        $r = sa_login($email, 'mala', '198.51.100.20');
        $bodies[] = [$r->body['error'], array_keys($r->body), $r->headers['Retry-After'] === (string) $r->body['retry_after'], $r->body['retry_after'] >= 3590 && $r->body['retry_after'] <= 3600];
    }
    T::same([$msg, ['ok', 'error', 'retry_after'], true, true], $bodies[0], '(a) el 429 dice «una hora» y trae retry_after y Retry-After en segundos');
    T::same($bodies[0], $bodies[1], '(a) y es IDÉNTICO exista o no la cuenta');
    T::same(429, sa_login('boss@torivac.test', PW_JEFE, '198.51.100.20')->status, '(a) durante el bloqueo ni la contraseña buena entra');
    T::same(200, sa_login('boss@torivac.test', PW_JEFE, '198.51.100.21')->status, '(a) otro visitante con la misma cuenta NO está bloqueado: nadie puede dejar fuera al gestor equivocándose a propósito desde su IP');
    // el bloqueo no se alarga con más intentos
    $key = RateLimit::key('lgpair', '198.51.100.20:boss@torivac.test');
    $until = Store::get($key)['lockedUntil'];
    for ($i = 0; $i < 5; $i++) sa_login('boss@torivac.test', 'mala', '198.51.100.20');
    T::same($until, Store::get($key)['lockedUntil'], '(a) los intentos durante el bloqueo no lo alargan');
    // pasada la hora, vuelve a poder entrar (y a contar desde cero)
    $past = Util::nowMs() - 1000;
    Store::put($key, ['count' => 5, 'resetAt' => $past, 'lockedUntil' => $past], 3600);
    T::same(401, sa_login('boss@torivac.test', 'mala', '198.51.100.20')->status, '(a) tras la hora el intento se comprueba otra vez');
    T::same(1, Store::get($key)['count'], '(a) y la cuenta empieza de cero');
    // un acceso correcto antes del 5.º fallo pone a cero
    foreach ([1, 2, 3, 4] as $i) sa_login('carla@torivac.test', 'mala', '198.51.100.40');
    Users::create(['email' => 'carla@torivac.test', 'name' => 'Carla', 'role' => 'client', 'password' => PW_JEFE]);
    T::same(200, sa_login('carla@torivac.test', PW_JEFE, '198.51.100.40')->status, '(a) 4 fallos y luego la contraseña buena: entra');
    $codes = [];
    for ($i = 1; $i <= 5; $i++) $codes[] = sa_login('carla@torivac.test', 'mala', '198.51.100.40')->status;
    T::same([401, 401, 401, 401, 401], $codes, '(a) y el acceso correcto puso a cero la cuenta: otros 5 fallos, ninguno bloqueado antes de tiempo');
    // (b) un visitante contra cualquier cuenta: 15 fallos en una hora (pulverizado de contraseñas)
    $codes = [];
    for ($i = 1; $i <= 17; $i++) $codes[] = sa_login("u$i@torivac.test", 'mala', '198.51.100.30')->status;
    T::same([15, 2], [count(array_filter($codes, function ($c) { return $c === 401; })), count(array_filter($codes, function ($c) { return $c === 429; }))], '(b) 15 intentos fallidos con correos distintos desde una IP y el 16.º recibe 429');
    $r = sa_login('boss@torivac.test', PW_JEFE, '198.51.100.30');
    T::same([429, $msg], [$r->status, $r->body['error']], '(b) con esa IP bloqueada ni la contraseña buena entra, y el mensaje es el mismo');
    T::same(200, sa_login('boss@torivac.test', PW_JEFE, '198.51.100.31')->status, '(b) otra IP sigue entrando con su contraseña');
    // (c) una cuenta contra la que fallan 30 visitantes distintos
    fresh();
    Users::create(['email' => 'boss@torivac.test', 'name' => 'Boss', 'role' => 'manager', 'password' => PW_JEFE]);
    $codes = [];
    for ($i = 1; $i <= 30; $i++) $codes[] = sa_login('boss@torivac.test', 'mala' . $i, "192.0.2.$i")->status;
    T::same(array_fill(0, 30, 401), $codes, '(c) 30 fallos desde 30 IP distintas: 401 los 30');
    $r = sa_login('boss@torivac.test', PW_JEFE, '192.0.2.100');
    T::same([429, $msg], [$r->status, $r->body['error']], '(c) el 31.º intento, desde una IP nueva y con la contraseña buena, recibe el mismo 429 (último recurso contra un ataque repartido)');
    // las claves no llevan ni el correo ni la IP en claro
    $files = array_merge(kv_files('rl%3Algpair%3A'), kv_files('rl%3Algip%3A'), kv_files('rl%3Algacct%3A'));
    T::true(count($files) >= 3 && count(array_filter($files, function ($f) { return preg_match('/^rl%3Alg(pair|ip|acct)%3A[0-9a-f]{32}\.json$/', $f) === 1; })) === count($files), 'los contadores llevan solo el resumen sha-256 (nunca el correo ni la IP)');
    // tope de inundación: 30 intentos por visitante en 10 min, también los correctos
    fresh();
    Users::create(['email' => 'boss@torivac.test', 'name' => 'Boss', 'role' => 'manager', 'password' => PW_JEFE]);
    $codes = [];
    for ($i = 1; $i <= 31; $i++) $codes[] = sa_login('boss@torivac.test', PW_JEFE, '198.51.100.50')->status;
    T::same([30, 1], [count(array_filter($codes, function ($c) { return $c === 200; })), count(array_filter($codes, function ($c) { return $c === 429; }))], 'inundación: 30 accesos correctos y el 31.º recibe 429');
    T::same('Demasiados intentos. Espera unos minutos.', sa_login('boss@torivac.test', PW_JEFE, '198.51.100.50')->body['error'], 'con el texto de la inundación');
}

/** El texto del tiempo de espera: «una hora» si falta casi una hora entera; si no, minutos redondeados hacia arriba. */
function test_login_lock_wait_text()
{
    T::same(['una hora', 'una hora', '55 minutos', '2 minutos', 'un minuto', 'un minuto'], [Router::lockWait(3600), Router::lockWait(3300), Router::lockWait(3299), Router::lockWait(61), Router::lockWait(60), Router::lockWait(1)], 'lockWait');
}

/** Contadores de fallos (exceeded / fail / clear): ventana fija desde el primer fallo, sin sumar al mirar, y hit() sigue contando cada llamada. */
function test_d3_failure_counters_window_and_reset()
{
    fresh();
    for ($i = 0; $i < 3; $i++) RateLimit::fail('t', 'x', 1000, 5000);
    T::same([true, false, false], [RateLimit::exceeded('t', 'x', 3, 5500), RateLimit::exceeded('t', 'x', 4, 5500), RateLimit::exceeded('t', 'x', 3, 6001)], 'cuenta 3; mirar no suma; pasada la ventana ya no cuenta');
    T::same(1, RateLimit::fail('t', 'x', 1000, 7000), 'un fallo nuevo, fuera de la ventana, empieza otra');
    RateLimit::fail('t', 'x', 1000, 7100);
    RateLimit::clear('t', 'x');
    T::same(false, RateLimit::exceeded('t', 'x', 1, 7200), 'clear() pone a cero');
    $r = [RateLimit::hit('b', 'id', 2, 1000, 0)['allowed'], RateLimit::hit('b', 'id', 2, 1000, 1)['allowed'], RateLimit::hit('b', 'id', 2, 1000, 2)['allowed'], RateLimit::hit('b', 'id', 2, 1000, 1001)['allowed']];
    T::same([true, true, false, true], $r, 'hit(): cada llamada cuenta; la ventana se renueva al caducar');
    T::same(RateLimit::key('login', 'a@b.es'), 'rl:login:' . substr(hash('sha256', 'a@b.es'), 0, 32), 'clave = rl:<cubo>:<sha256 de 32 caracteres>');
}

/** A4 · Un correo de 300 caracteres ya no rompe el guardado ni se hace eco de la clave en el error; los contadores caducados se purgan «al vuelo» y no crecen sin límite. */
function test_a4_rate_limit_keys_are_bounded_and_expired_ones_purged()
{
    fresh();
    $long = str_repeat('a', 300) . '@x.es';
    $r = sa_login($long, 'x', '198.51.100.7');
    T::same(401, $r->status, 'A4: un correo de 300 caracteres da 401 y no 500');
    T::true(strpos(json_encode($r->body), 'rl:') === false && strpos(json_encode($r->body), 'aaaa') === false, 'ni se hace eco de la clave ni del correo');
    foreach (kv_files('rl%3A') as $f) T::true(strlen($f) <= 60 && strpos($f, 'aaaa') === false, "el nombre del fichero de un contador es corto y no lleva el correo: $f");
    $r2 = sa_login(str_repeat("\u{00e9}", 5000) . "\r\n" . str_repeat('b', 100000), str_repeat('p', 5000), '198.51.100.8');
    T::same(401, $r2->status, 'ni con un correo enorme y con caracteres raros');
    // purga de caducados
    fresh();
    $live = RateLimit::hit('login', 'vivo', 6);
    for ($i = 0; $i < 300; $i++) file_put_contents(Store::root() . '/kv/' . rawurlencode('rl:login:' . Util::sha32("viejo$i")) . '.json', json_encode(['v' => ['count' => 1, 'resetAt' => 1], 'x' => time() - 100]));
    T::same(301, count(kv_files('rl%3A')), 'hay 300 contadores caducados y 1 vivo');
    T::same(200, RateLimit::purgeExpired(), 'cada limpieza borra hasta 200 caducados');
    T::same(101, count(kv_files('rl%3A')), 'quedan 100 caducados y el vivo');
    T::same(100, RateLimit::purgeExpired(), 'la siguiente borra el resto');
    T::same([true, 1], [Store::get(RateLimit::key('login', 'vivo')) !== null, count(kv_files('rl%3A'))], 'el contador vivo sobrevive');
    // al vuelo: una de cada N llamadas limpia (aquí N = 1)
    for ($i = 0; $i < 250; $i++) file_put_contents(Store::root() . '/kv/' . rawurlencode('rl:order:' . Util::sha32("viejo$i")) . '.json', json_encode(['v' => ['count' => 1, 'resetAt' => 1], 'x' => time() - 100]));
    RateLimit::$purgeOneIn = 1;
    try { RateLimit::hit('login', 'otro', 6); } finally { RateLimit::$purgeOneIn = 0; }
    T::same(52, count(kv_files('rl%3A')), 'una llamada a hit() que dispara la limpieza borra hasta 200 caducados (quedan 50 + los 2 vivos)');
    // 200 intentos con correos distintos: ficheros acotados por IP y caducables (antes +200 sin tope)
    fresh();
    for ($i = 0; $i < 60; $i++) sa_login("u$i@x.es", 'x', '198.51.100.9');
    T::true(count(kv_files('rl%3A')) <= 2 * 31 + 1, 'una IP no puede crear más de ~30 contadores de acceso en 10 min (el resto recibe 429 sin crear ficheros)');
}

/** A12 · Un Bearer inválido (30 fallos / 10 min por visitante) y una llamada al cron con token erróneo (10 / 10 min) acaban en 429; una petición válida no consume cupo. */
function test_a12_bearer_and_cron_failure_limits()
{
    fresh();
    $codes = [];
    for ($i = 1; $i <= 31; $i++) $codes[] = sa_get('/users', 'token-falso-' . $i, '198.51.100.40')->status;
    T::same([30, 1], [count(array_filter($codes, function ($c) { return $c === 401; })), count(array_filter($codes, function ($c) { return $c === 429; }))], 'A12: 30 tokens falsos → 401 y el 31.º → 429 (antes 300 × 401)');
    T::same(429, sa_get('/users', MASTER_TOKEN, '198.51.100.40')->status, 'con esa IP bloqueada ni el token bueno se prueba');
    T::same(200, sa_get('/users', MASTER_TOKEN, '198.51.100.41')->status, 'otra IP entra con su token');
    T::same(['ok' => false, 'error' => 'Demasiados intentos. Espera unos minutos.'], sa_get('/auth/me', 'x', '198.51.100.40')->body, 'el 429 lleva el texto de siempre');
    // una petición válida no consume cupo
    fresh();
    $ok = 0;
    for ($i = 0; $i < 60; $i++) if (sa_get('/users', MASTER_TOKEN, '198.51.100.50')->status === 200) $ok++;
    T::same(60, $ok, '60 peticiones válidas seguidas, todas 200');
    $codes = [];
    for ($i = 1; $i <= 31; $i++) $codes[] = sa_get('/auth/me', 'falso' . $i, '198.51.100.50')->status;
    T::same(array_merge(array_fill(0, 30, 401), [429]), $codes, 'y los 30 fallos siguientes siguen contando desde cero');
    // las IPv6 de un /64 comparten el cupo
    fresh();
    $codes = [];
    for ($i = 1; $i <= 31; $i++) $codes[] = sa_get('/users', 'falso' . $i, sprintf('2001:db8:1:2::%x', $i))->status;
    T::same(429, end($codes), 'las direcciones de un /64 comparten los 30 fallos');
    // GET /prices con un token malo: sirve la vista pública y cuenta el fallo, pero no se corta con 429
    fresh(); seedPrices();
    $st = [];
    for ($i = 1; $i <= 32; $i++) $st[] = sa_get('/prices', 'viejo' . $i, '198.51.100.60')->status;
    T::same(array_fill(0, 32, 200), $st, 'GET /prices con un token malo sigue sirviendo la lista pública');
    T::same(429, sa_get('/users', 'otro', '198.51.100.60')->status, 'pero esos fallos cuentan para el resto de rutas');
    // cron por URL
    fresh(['cron_token' => CRON_TOKEN, 'prices' => ['csv_url' => 'https://sheet.test/x.csv']]);
    Http::$mock = function () { return [200, "ref;price\nR100;9\nTT0020210;12\nP16633;60\n"]; };
    $v = [];
    for ($i = 0; $i < 4; $i++) $v[] = sa_cron(CRON_TOKEN, '198.51.100.70')->status;
    T::same([200, 200, 200, 200], $v, 'el cron con el token bueno no gasta cupo');
    $codes = [];
    for ($i = 1; $i <= 11; $i++) $codes[] = sa_cron('falso-' . $i, '198.51.100.70')->status;
    T::same(array_merge(array_fill(0, 10, 401), [429]), $codes, 'A12: 10 llamadas con token erróneo → 401 y la 11.ª → 429 (antes 100 × 401)');
    T::same(429, sa_cron(CRON_TOKEN, '198.51.100.70')->status, 'con esa IP bloqueada ni el token bueno');
    T::same(200, sa_cron(CRON_TOKEN, '198.51.100.71')->status, 'otra IP sí');
    $q = req('GET', '/cron', null, [], '198.51.100.72'); $q->query = ['token' => ['a', 'b']];
    T::same(401, Router::handle($q)->status, 'un token que no es una cadena (?token[]=…) da 401 sin avisos');
}

/** D3 · Secretos con longitud mínima que fallan cerrado: session_secret ≥ 32 y sin «CAMBIA-ESTO», admin_token ≥ 32, cron_token ≥ 24; el diagnóstico y /health lo dicen con el NOMBRE del ajuste. */
function test_d3_secret_minimum_lengths_fail_closed()
{
    fresh();
    Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    $good = login_token('jefe@torivac.com', PW_JEFE);
    T::true($good !== null && sa_get('/auth/me', $good)->status === 200, 'con el secreto de pruebas (≥ 32) el acceso funciona');
    $payload = function () { $u = Users::find('jefe@torivac.com'); $now = Util::nowMs(); return ['sub' => 'jefe@torivac.com', 'iat' => $now - 1000, 'exp' => $now + 3600000, 'sid' => $u['sid']]; };
    foreach (['corto', str_repeat('x', 31), '', 'CAMBIA-ESTO-por-una-cadena-aleatoria-de-32-o-mas-caracteres', 'xx-cambia-esto-' . str_repeat('y', 40)] as $secret) {
        fresh(['session_secret' => $secret]);
        Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
        $r = sa_login('jefe@torivac.com', PW_JEFE, '203.0.113.1');
        T::true($r->status === 500 && strpos($r->body['error'], 'Configuración insegura: session_secret ') === 0 && !isset($r->body['token']), 'secreto «' . substr($secret, 0, 20) . '…» → el acceso responde 500 «Configuración insegura»');
        $forged = sa_forge($payload(), $secret);
        T::same(401, sa_get('/users', $forged)->status, 'un token bien firmado con ese secreto inseguro NO vale');
        if (strlen($secret) < 32 || stripos($secret, 'CAMBIA-ESTO') !== false) { $threw = false; try { Auth::signSession(['sub' => 'a', 'sid' => 'b'], $secret); } catch (\RuntimeException $e) { $threw = true; } T::true($threw, 'signSession() se niega a firmar con él'); }
    }
    fresh(['session_secret' => 'corto']);
    T::same('Configuración insegura: session_secret demasiado corto', sa_login('a@b.es', 'x', '203.0.113.2')->body['error'], 'el texto exacto para un secreto corto');
    T::same([true, false, false, false, false], [Util::secretEq('abc', 'abc'), Util::secretEq('abc', 'abcd'), Util::secretEq('abcd', 'abc'), Util::secretEq('abc', ''), Util::secretEq('abc', 'abd')], 'Util::secretEq compara resúmenes: da igual la longitud');
    // token maestro
    foreach ([[str_repeat('m', 31), 401], [str_repeat('m', 32), 200], ['', 401], [str_repeat('m', 100), 200]] as [$tok, $want]) {
        fresh(['admin_token' => $tok]);
        T::same($want, sa_get('/users', $tok === '' ? 'cualquiera' : $tok)->status, 'admin_token de ' . strlen($tok) . ' caracteres → ' . $want);
    }
    // cron
    foreach ([[str_repeat('c', 23), 401], [str_repeat('c', 24), 200]] as [$tok, $want]) {
        fresh(['cron_token' => $tok, 'prices' => ['csv_url' => 'https://sheet.test/x.csv']]);
        Http::$mock = function () { return [200, "ref;price\nR100;9\n"]; };
        T::same($want, sa_cron($tok, '203.0.113.3')->status, 'cron_token de ' . strlen($tok) . ' caracteres → ' . $want);
    }
    fresh(['cron_token' => '', 'prices' => ['csv_url' => 'https://sheet.test/x.csv']]);
    T::same(401, sa_cron('', '203.0.113.4')->status, 'sin cron_token la URL está desactivada');
    // diagnóstico y /health
    fresh(['session_secret' => 'corto-secreto', 'admin_token' => 'maestro-corto-123', 'cron_token' => 'cron-corto']);
    $st = []; $msg = '';
    foreach (Diag::run()['checks'] as $c) { $st[$c['id']] = $c['status']; $msg .= $c['msg'] . "\n"; }
    T::same(['fail', 'fail', 'fail'], [$st['secreto'], $st['token_maestro'], $st['cron_token']], 'el diagnóstico marca en rojo los tres');
    T::true(strpos($msg, 'session_secret') !== false && strpos($msg, 'admin_token') !== false && strpos($msg, 'cron_token') !== false, 'con el nombre del ajuste…');
    T::true(strpos($msg, 'corto-secreto') === false && strpos($msg, 'maestro-corto-123') === false && strpos($msg, 'cron-corto') === false, '…y sin el valor');
    $h = Router::handle(req('GET', '/health'));
    T::same([true, false, ['session_secret', 'admin_token', 'cron_token']], [$h->body['ok'], $h->body['config']['ok'], $h->body['config']['problems']], '/health sigue vivo y marca los ajustes inseguros por su nombre');
    T::true(strpos(json_encode($h->body), 'corto') === false || strpos(json_encode($h->body), 'corto-secreto') === false, '/health no enseña ningún valor');
    fresh();
    T::same(['ok', 'time', 'mail'], array_keys(Router::handle(req('GET', '/health'))->body), 'con la configuración bien, /health es el de siempre (más el estado del correo, sin textos de error)');
    fresh(['admin_token' => '', 'cron_token' => '']);
    T::same(false, array_key_exists('config', Router::handle(req('GET', '/health'))->body), 'admin_token y cron_token vacíos no son un problema (están desactivados a propósito)');
    foreach (['banana', '', 1, true] as $v) { fresh(['order_copy' => $v]); T::same(['order_copy'], Router::handle(req('GET', '/health'))->body['config']['problems'], 'order_copy = ' . json_encode($v) . ' (ni capped ni off) también se avisa en /health, por su nombre'); }
    foreach (['capped', 'off', ' OFF ', ' Capped'] as $v) { fresh(['order_copy' => $v]); T::same(false, array_key_exists('config', Router::handle(req('GET', '/health'))->body), 'order_copy = ' . json_encode($v) . ' es un valor válido'); }
}

/** D3 · Contraseñas nuevas: ≥ 12, sin la parte local del correo y fuera de la lista de triviales; por la API y por la herramienta de línea de comandos. Los usuarios ya creados no se tocan. */
function test_d3_password_policy_for_new_users()
{
    fresh();
    $bad = [
        ['maria@x.es', 'Corta-1234', 'La contraseña necesita al menos 12 caracteres'],
        ['maria@x.es', '12345678901', 'La contraseña necesita al menos 12 caracteres'],
        ['maria@x.es', 'Maria-Lopez-2026', 'La contraseña no puede contener tu correo'],
        ['maria@x.es', 'una-MARIA-cualquiera', 'La contraseña no puede contener tu correo'],
        ['ana.perez@x.es', 'AnaPerez-2026-x', 'La contraseña no puede contener tu correo'],
        ['ana+pedidos@x.es', 'Ana-2026-Larga-xx', 'La contraseña no puede contener tu correo'],
        ['jose@x.es', 'Password12345', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'password-2026-x', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', '123456789012', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', '1234567890ab', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'QWERTYuiop12', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'Torivac-Manager-2026', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'torivac2026!!!!', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'Contraseña-Larga-9', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'Bienvenido-2026-x', 'Esa contraseña es demasiado fácil de adivinar'],
        ['maria@x.es', 'Mía-María-Larga-1', 'La contraseña no puede contener tu correo'],
        ['jose@x.es', 'aaaaaaaaaaaa', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', 'abababababab', 'Esa contraseña es demasiado fácil de adivinar'],
        ['jose@x.es', str_repeat('Zq7-', 300), 'La contraseña es demasiado larga (máx. 1000 caracteres)'],
    ];
    foreach ($bad as [$email, $pw, $msg]) T::same(['error' => $msg], Users::create(['email' => $email, 'role' => 'client', 'password' => $pw]), 'rechazada: ' . substr($pw, 0, 24));
    T::same([], Users::all(), 'y no se crea ningún usuario');
    foreach ([['maria@x.es', 'Zx9-Qm4-Lp7!'], ['jo@x.es', 'Jo-Largo-Pass-9'], ['x@x.es', 'Correcta-Cliente-1'], ['n@x.es', 'ñandú-Ñoño-2026-áé']] as [$email, $pw]) T::true(isset(Users::create(['email' => $email, 'role' => 'client', 'password' => $pw])['user']), "vale: $pw");
    $r = Router::handle(req('POST', '/users', ['email' => 'nuevo@x.es', 'role' => 'client', 'password' => 'Password12345'], master()));
    T::same([400, 'Esa contraseña es demasiado fácil de adivinar'], [$r->status, $r->body['error'] ?? null], 'por la API: 400 con el motivo');
    T::same(201, Router::handle(req('POST', '/users', ['email' => 'nuevo@x.es', 'role' => 'client', 'password' => 'Una-Buena-Clave-77'], master()))->status, 'por la API: una buena, 201');
    // un usuario antiguo con una contraseña corta sigue entrando
    Store::put('user:viejo@x.es', ['email' => 'viejo@x.es', 'name' => 'Viejo', 'role' => 'client', 'hash' => Auth::hashPassword('corta1234'), 'created' => '2025-01-01T00:00:00.000Z']);
    T::true(login_token('viejo@x.es', 'corta1234') !== null, 'los usuarios ya creados no se tocan: el antiguo con su contraseña corta sigue entrando');
    // herramienta de línea de comandos
    $dir = tmp_dir('tv-cli-');
    $run = function (array $args) use ($dir) {
        $p = proc_open(array_merge([PHP_BINARY, dirname(__DIR__) . '/tools/create-user.php'], $args), [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, array_merge(getenv(), ['TORIVAC_STORAGE_DIR' => $dir]));
        $o = stream_get_contents($pipes[1]); $e = stream_get_contents($pipes[2]);
        return [proc_close($p), $o, $e];
    };
    try {
        [$rc, , $err] = $run(['jefa@torivac.com', 'Jefa', 'manager', 'Corta-123']);
        T::same([1, true], [$rc, strpos($err, 'La contraseña necesita al menos 12 caracteres') !== false], 'create-user.php rechaza una contraseña corta');
        [$rc, , $err] = $run(['jefa@torivac.com', 'Jefa', 'manager', 'Jefa-Directiva-2026']);
        T::same([1, true], [$rc, strpos($err, 'no puede contener tu correo') !== false], 'create-user.php rechaza una con la parte local del correo');
        [$rc, $out] = $run(['jefa@torivac.com', 'Jefa', 'manager', 'Clave-Directiva-2026!']);
        T::same([0, true], [$rc, strpos($out, 'Usuario creado: jefa@torivac.com (manager)') !== false], 'create-user.php crea el usuario con una buena');
        Store::init($dir);
        $u = Users::find('jefa@torivac.com');
        T::true($u !== null && preg_match('/^[0-9a-f]{32}$/', $u['sid']) === 1 && $u['sess_after'] === 0 && password_verify('Clave-Directiva-2026!', $u['hash']), 'y lo deja con su sid, sess_after = 0 y el hash de la contraseña');
    } finally { rmtree_all($dir); fresh(); }
}

/** D4 · La sesión va ligada al usuario: el token lleva {sub, iat, exp, sid} (sin rol), el rol sale del registro, los tokens sin sid no valen y el borrado + alta con el mismo correo no los resucita (A5). */
function test_d4_sessions_are_bound_to_the_user_record()
{
    fresh();
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    $login = sa_login('ana@acme.es', PW_ANA, '10.0.0.1');
    $t1 = $login->body['token'];
    $payload = json_decode(Util::unb64url(explode('.', $t1)[0]), true);
    $keys = array_keys($payload); sort($keys);
    T::same(['exp', 'iat', 'sid', 'sub'], $keys, 'el token lleva sub, iat, exp y sid (sin role ni name)');
    T::same(['ana@acme.es', 86400000, true], [$payload['sub'], $payload['exp'] - $payload['iat'], preg_match('/^[0-9a-f]{32}$/', $payload['sid']) === 1], 'sub, 24 h de vida y un sid de 16 bytes en hex');
    T::same(Users::find('ana@acme.es')['sid'], $payload['sid'], 'el sid es el del registro del usuario');
    T::same(['email', 'name', 'role', 'created'], array_keys($login->body['user']), 'la respuesta del acceso no enseña hash, sid ni sess_after');
    T::same([['email', 'name', 'role', 'created'], ['email', 'name', 'role', 'created']], [array_keys(Users::all()[0]), array_keys(Router::handle(req('GET', '/users', null, master()))->body['users'][1])], 'ni la lista de usuarios');
    T::same(['ok' => true, 'user' => ['sub' => 'ana@acme.es', 'role' => 'client', 'name' => 'Ana']], sa_get('/auth/me', $t1)->body, '/auth/me devuelve sub, role y name (del registro)');
    // el rol sale del registro, no del token
    $now = Util::nowMs(); $sid = $payload['sid'];
    $forged = sa_forge(['sub' => 'ana@acme.es', 'iat' => $now - 1000, 'exp' => $now + 3600000, 'sid' => $sid, 'role' => 'manager', 'name' => 'Admin']);
    T::same([403, 'client', 'Ana'], [sa_get('/users', $forged)->status, sa_get('/auth/me', $forged)->body['user']['role'], sa_get('/auth/me', $forged)->body['user']['name']], 'un role:manager dentro de un token válido se ignora: manda el registro');
    $rec = Users::find('jefe@torivac.com'); $tJ = login_token('jefe@torivac.com', PW_JEFE);
    T::same(200, sa_get('/users', $tJ)->status, 'el manager entra');
    Store::put('user:jefe@torivac.com', ['role' => 'client'] + $rec);
    T::same(403, sa_get('/users', $tJ)->status, 'si el registro pasa a client, su token vivo deja de ser de manager al instante');
    Store::put('user:jefe@torivac.com', $rec);
    // formatos antiguos o ajenos
    $old = sa_forge(['sub' => 'jefe@torivac.com', 'role' => 'manager', 'name' => 'Jefe', 'exp' => $now + 3600000]);
    T::same(401, sa_get('/users', $old)->status, 'un token del formato anterior (sin sid) no vale');
    foreach ([['sid' => 'otro-sid'], ['sid' => ''], ['sid' => 5], ['iat' => 'x'], ['exp' => 'x'], ['sub' => 'nadie@x.es']] as $change) {
        T::same(401, sa_get('/users', sa_forge($change + ['sub' => 'jefe@torivac.com', 'iat' => $now - 1000, 'exp' => $now + 3600000, 'sid' => $rec['sid']]))->status, 'token con ' . json_encode($change) . ' → 401');
    }
    T::same(401, sa_get('/users', sa_forge(['sub' => 'jefe@torivac.com', 'iat' => $now - 5000, 'exp' => $now - 1000, 'sid' => $rec['sid']]))->status, 'caducado → 401');
    // A5: borrar y recrear no resucita tokens
    $tTmp = null;
    Users::create(['email' => 'tmp@torivac.test', 'name' => 'Tmp', 'role' => 'manager', 'password' => 'Temporal-Clave-2026']);
    $tTmp = login_token('tmp@torivac.test', 'Temporal-Clave-2026');
    T::same(200, sa_get('/users', $tTmp)->status, 'A5: el manager temporal entra');
    Users::delete('tmp@torivac.test');
    T::same(401, sa_get('/users', $tTmp)->status, 'borrado → 401');
    Users::create(['email' => 'tmp@torivac.test', 'name' => 'Otro', 'role' => 'client', 'password' => 'Otra-Clave-Distinta-1']);
    T::same([401, 401], [sa_get('/users', $tTmp)->status, sa_get('/auth/me', $tTmp)->status], 'A5: recreado como client, el token viejo NO resucita (nuevo sid)');
    T::true(login_token('tmp@torivac.test', 'Otra-Clave-Distinta-1') !== null, 'y la persona nueva entra con su contraseña');
    // TTL de 24 h
    T::same(86400000, Auth::TTL_MS, 'la sesión dura 24 h');
    $tok = Auth::signSession(['sub' => 'a@b.es', 'sid' => 'x1'], SECRET, 1000);
    T::same([true, false], [Auth::verifySession($tok, SECRET, 1000 + 86400000 - 60000) !== null, Auth::verifySession($tok, SECRET, 1000 + 86400000 + 60000) !== null], 'vale a las 23 h 59 min y no a las 24 h 01 min');
}

/** D4 · POST /api/auth/logout invalida TODOS los tokens anteriores de esa persona (sess_after); el token maestro no tiene sesión; los de otras personas no se tocan. */
function test_d4_logout_revokes_every_earlier_token()
{
    fresh();
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    $a1 = login_token('ana@acme.es', PW_ANA, '10.0.0.1'); $a2 = login_token('ana@acme.es', PW_ANA, '10.0.0.2'); $j = login_token('jefe@torivac.com', PW_JEFE, '10.0.0.3');
    T::same([200, 200, 200], [sa_get('/auth/me', $a1)->status, sa_get('/auth/me', $a2)->status, sa_get('/auth/me', $j)->status], 'tres sesiones vivas');
    $lo = Router::handle(req('POST', '/auth/logout', null, bearer($a1)));
    T::same([200, ['ok' => true]], [$lo->status, $lo->body], 'logout responde {"ok":true}');
    T::same([401, 401, 200], [sa_get('/auth/me', $a1)->status, sa_get('/auth/me', $a2)->status, sa_get('/auth/me', $j)->status], 'las DOS sesiones de Ana mueren y la del manager sigue');
    $a3 = login_token('ana@acme.es', PW_ANA, '10.0.0.4');
    T::same(200, sa_get('/auth/me', $a3)->status, 'un acceso nuevo después del cierre vale');
    $sa = Users::find('ana@acme.es')['sess_after'];
    T::true(is_int($sa) && $sa > 0 && abs($sa - Util::nowMs()) < 60000, 'sess_after = ahora (milisegundos)');
    $sid = Users::find('ana@acme.es')['sid'];
    T::same([401, 200], [sa_get('/auth/me', Auth::signSession(['sub' => 'ana@acme.es', 'sid' => $sid], SECRET, $sa))->status, sa_get('/auth/me', Auth::signSession(['sub' => 'ana@acme.es', 'sid' => $sid], SECRET, $sa + 1))->status], 'un token emitido en el mismo milisegundo del cierre no vale; uno posterior sí');
    T::same([400, true], [Router::handle(req('POST', '/auth/logout', null, master()))->status, strpos(Router::handle(req('POST', '/auth/logout', null, master()))->body['error'], 'maestro') !== false], 'el token maestro no tiene sesión que cerrar: 400');
    T::same(401, Router::handle(req('POST', '/auth/logout'))->status, 'sin sesión: 401');
    T::same(401, Router::handle(req('POST', '/auth/logout', null, bearer('basura')))->status, 'con un token falso: 401');
    T::same([true, 200], [Router::handle(req('GET', '/auth/logout', null, bearer($a3)))->status >= 400, sa_get('/auth/me', $a3)->status], 'el logout es solo por POST: un GET no cierra nada');
    T::same(200, sa_get('/users', MASTER_TOKEN)->status, 'el token maestro sigue funcionando');
    // un usuario antiguo (sin sid ni sess_after) recibe su sid en el siguiente acceso correcto, sin perder nada
    $hash = Auth::hashPassword(PW_ANA);
    Store::put('user:vieja@acme.es', ['email' => 'vieja@acme.es', 'name' => 'Vieja', 'role' => 'client', 'hash' => $hash, 'created' => '2025-01-01T00:00:00.000Z']);
    $tv = login_token('vieja@acme.es', PW_ANA);
    $rec = Users::find('vieja@acme.es');
    T::true($tv !== null && preg_match('/^[0-9a-f]{32}$/', $rec['sid']) === 1 && $rec['sess_after'] === 0 && $rec['hash'] === $hash && $rec['name'] === 'Vieja' && $rec['created'] === '2025-01-01T00:00:00.000Z', 'usuario antiguo: recibe sid y sess_after = 0, y conserva hash, nombre y fecha');
    T::same(200, sa_get('/auth/me', $tv)->status, 'y su sesión nueva vale');
    T::same([200, 200], [Router::handle(req('POST', '/auth/logout', null, bearer($tv)))->status, Users::revokeSessions('vieja@acme.es') ? 200 : 0], 'y puede cerrar sesión');
    T::same(false, Users::revokeSessions('nadie@acme.es'), 'cerrar la sesión de alguien que no existe no crea nada');
    T::same(null, Users::find('nadie@acme.es'), 'y no deja registro');
}

/** A3 · El hash «señuelo» que iguala el tiempo de un usuario inexistente se genera con el coste actual de PASSWORD_DEFAULT (10 en PHP ≤ 8.3, 12 en 8.4) y se cachea; ya no es un literal de 61 caracteres. */
function test_a3_decoy_hash_follows_the_current_default_cost()
{
    fresh();
    $reset = function () { $p = new \ReflectionProperty(Auth::class, 'decoy'); $p->setAccessible(true); $p->setValue(null, null); };
    $reset();
    $h = Auth::decoyHash();
    $info = password_get_info($h);
    $cost = password_get_info(password_hash('x', PASSWORD_DEFAULT))['options']['cost'];
    T::same([60, 'bcrypt', $cost], [strlen($h), $info['algoName'], $info['options']['cost']], 'un hash bcrypt de 60 caracteres con el coste de PASSWORD_DEFAULT');
    T::true(!password_needs_rehash($h, PASSWORD_DEFAULT), 'y no necesita renovarse');
    T::same([$h, $h], [Auth::decoyHash(), Store::get('auth:decoy')], 'se cachea en memoria y se guarda en el almacén (no se recalcula en cada petición)');
    // uno guardado con un coste antiguo se renueva
    $reset();
    Store::put('auth:decoy', password_hash('x', PASSWORD_BCRYPT, ['cost' => 4]));
    $new = Auth::decoyHash();
    T::same([true, $cost], [$new !== Store::get('auth:decoy') ? false : true, password_get_info($new)['options']['cost']], 'un señuelo guardado con un coste más bajo se vuelve a generar con el actual');
    // el acceso con un usuario inexistente verifica contra él (no devuelve antes)
    $reset(); fresh();
    Users::create(['email' => 'real@x.es', 'name' => 'Real', 'role' => 'client', 'password' => PW_ANA]);
    $t = function ($email) { $s = microtime(true); Users::login($email, 'mala-clave-xx'); return microtime(true) - $s; };
    $t('real@x.es'); $t('nadie@x.es');
    for ($try = 0, $ok = false; $try < 3 && !$ok; $try++) {                                    // un servidor muy cargado puede falsear una medida: basta con que una de tres caiga en la banda
        $a = ($t('real@x.es') + $t('real@x.es')) / 2; $b = ($t('nadie@x.es') + $t('nadie@x.es')) / 2;
        $ok = $b > $a * 0.3 && $b < $a * 4;
    }
    T::true($ok, sprintf('el usuario inexistente también paga una verificación de contraseña completa (%.0f ms frente a %.0f ms del existente)', $b * 1000, $a * 1000));
}

/** Las respuestas con Origin ajeno o propio siguen igual y Vary lleva Origin y Authorization a la vez (antes el de la ruta pisaba al de CORS). */
function test_d6_vary_merges_origin_and_authorization()
{
    fresh(); seedPrices();
    $r = Router::handle(req('GET', '/prices', null, ['Origin' => 'https://demo.example', 'Host' => 'api.test']));
    T::same(['https://demo.example', 'Origin, Authorization'], [$r->headers['Access-Control-Allow-Origin'], $r->headers['Vary']], 'GET /prices con Origin: Vary = Origin, Authorization');
    $h = Router::handle(req('GET', '/health', null, ['Origin' => 'https://demo.example', 'Host' => 'api.test']));
    T::same('Origin', $h->headers['Vary'], 'las demás rutas con Origin: Vary = Origin');
    $e = Router::handle(req('GET', '/users', null, ['Origin' => 'https://demo.example', 'Host' => 'api.test']));
    T::same([401, 'https://demo.example', 'Origin'], [$e->status, $e->headers['Access-Control-Allow-Origin'], $e->headers['Vary']], 'y los errores también llevan las cabeceras CORS');
    T::same(403, Router::handle(req('GET', '/prices', null, ['Origin' => 'https://malo.example', 'Host' => 'api.test']))->status, 'un origen ajeno sigue dando 403');
}
