<?php
/**
 * Pruebas de seguridad de los precios, los errores, las descargas, el lector de .xlsx, los datos de gestión y el despliegue (informe del revisor del PHP: A6, A7, A8, A9, A10, A11 ·
 * decisiones D5, D6, D8, D9 y D10). Cada hallazgo reproduce el ataque del informe y comprueba que ya no funciona, y que lo legítimo sigue funcionando.
 * Lo que necesita un servidor o un proceso aparte (memoria, display_errors, redirecciones) usa `php -S` o un proceso hijo en 127.0.0.1; no hay red.
 */
namespace Torivac\Tests;

require_once __DIR__ . '/support.php';

use Torivac\AdminData;
use Torivac\Auth;
use Torivac\Catalog;
use Torivac\Config;
use Torivac\Diag;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Prices;
use Torivac\Request;
use Torivac\Response;
use Torivac\Router;
use Torivac\Sheets;
use Torivac\Store;
use Torivac\Users;
use Torivac\Util;
use Torivac\Xlsx;

/** Guarda `$n` precios vigentes R0…R(n-1) con precio 10, 11, 12… */
function sd_seed(int $n): void
{
    $items = [];
    for ($i = 0; $i < $n; $i++) $items['R' . $i] = ['p' => 10.0 + $i];
    Store::put(Prices::KEY_CURRENT, Prices::forJson(['updated_at' => '2026-10-27T00:00:00.000Z', 'source' => 'test', 'currency' => 'EUR', 'mode' => 'live', 'items' => $items]));
}

/** Filas de una hoja con R0…R(total-1) al mismo precio que `sd_seed`, salvo las de `$retire`, que van con precio 0 (o con active = 0 si `$active`). */
function sd_rows(int $total, array $retire, bool $active = false): array
{
    $rows = [$active ? ['ref', 'price', 'active'] : ['ref', 'price']];
    for ($i = 0; $i < $total; $i++) {
        $gone = in_array($i, $retire, true);
        $rows[] = $active ? ['R' . $i, 10 + $i, $gone ? 0 : 1] : ['R' . $i, $gone ? 0 : 10 + $i];
    }
    return $rows;
}

/** Catálogo con R0…R(n-1) pedibles (para que la sincronización por el flujo normal reconozca esas referencias). */
function sd_catalog(int $n): void
{
    $items = [];
    for ($i = 0; $i < $n; $i++) $items['R' . $i] = ['n' => 'Resistencia ' . $i, 'pid' => 1];
    Catalog::set(['items' => $items, 'skus' => [], 'rules' => []]);
}

/** Ejecuta `$fn` con el registro de errores de PHP desviado a un fichero y devuelve [resultado, texto del registro]. */
function sd_with_error_log(callable $fn): array
{
    $f = tempnam(sys_get_temp_dir(), 'tv-log-');
    $old = ini_set('error_log', $f);
    try { $res = $fn(); } finally { ini_set('error_log', (string) $old); }
    $log = (string) file_get_contents($f);
    @unlink($f);
    return [$res, $log];
}

/** D5 · Una hoja que retira ≥ 10 referencias y más del 30 % de los precios vigentes, o tras la cual quedaría menos del 50 % (siendo ≥ 10), exige force: no se aplica en silencio. */
function test_d5_sheet_that_retires_many_prices_needs_force()
{
    $blockers = function (int $prev, array $retire, string $mode = 'merge', bool $active = false) {
        fresh(); sd_seed($prev);
        return Sheets::plan(sd_rows($prev, $retire, $active), 'upload', $mode, [])['blockers'];
    };
    $msg = function (array $b) { return implode(' | ', $b); };
    T::true(strpos($msg($blockers(20, range(0, 9))), 'La hoja retira 10 de 20 precios (50 %): confírmalo con force') !== false, 'W3: retirar 10 de 20 (50 %) → bloqueada');
    T::true(strpos($msg($blockers(20, range(0, 9), 'merge', true)), 'La hoja retira 10 de 20 precios (50 %)') !== false, 'lo mismo con active = 0');
    T::same([], $blockers(100, range(0, 9)), 'retirar 10 de 100 (10 %) pasa');
    T::same([], $blockers(100, range(0, 29)), 'retirar 30 de 100 (justo el 30 %, no lo supera) pasa');
    T::true(strpos($msg($blockers(100, range(0, 30))), 'La hoja retira 31 de 100 precios (31 %)') !== false, 'retirar 31 de 100 → bloqueada');
    T::same([], $blockers(20, range(0, 8)), 'retirar 9 de 20 (menos de 10 referencias) pasa');
    T::true(strpos($msg($blockers(10, range(0, 5))), 'Tras aplicar la hoja quedarían 4 de 10 precios vigentes (menos de la mitad): confírmalo con force') !== false, 'con 10 precios, retirar 6 deja menos del 50 % → bloqueada');
    fresh(); sd_seed(10);
    $conNuevas = sd_rows(10, range(0, 5)); for ($i = 100; $i < 103; $i++) $conNuevas[] = ['R' . $i, 5];
    T::same([], array_values(array_filter(Sheets::plan($conNuevas, 'upload', 'merge', [])['blockers'], function ($b) { return strpos($b, 'quedarían') !== false; })), 'si la misma hoja añade 3 referencias nuevas, el total que habría (7 de 10) ya no baja del 50 %: esa regla no salta (igual que el Worker)');
    T::same([], $blockers(10, range(0, 4)), 'retirar 5 de 10 (queda el 50 %) pasa');
    T::same([], $blockers(9, range(0, 8)), 'con menos de 10 precios vigentes la regla no se aplica');
    $b = $blockers(40, range(0, 39));
    T::true(count($b) >= 1 && strpos($msg($b), 'retira 40 de 40') !== false, 'una hoja que retira TODO se bloquea');
    // sync y vista previa con las mismas reglas
    fresh(); sd_seed(20);
    T::throws(function () { Sheets::sync(['rows' => sd_rows(20, range(0, 9)), 'ctx' => []]); }, '/Sincronización rechazada: La hoja retira 10 de 20 precios \(50 %\): confírmalo con force/', 'sync lo rechaza');
    T::same(20, count(Prices::load()['items']), 'y no toca los precios');
    $m = Sheets::sync(['rows' => sd_rows(20, range(0, 9)), 'ctx' => [], 'force' => true]);
    T::same([10, 10], [$m['refs'], $m['removed']], 'con force se aplica');
    // por el API: vista previa → needs_force; sin force 409; con force 200
    fresh(); sd_seed(20); sd_catalog(20);
    $csv = "ref;price\n" . implode("\n", array_map(function ($i) { return 'R' . $i . ';' . ($i < 10 ? '0' : (string) (10 + $i)); }, range(0, 19))) . "\n";
    $d = Router::handle(req('POST', '/prices/upload', ['csv' => $csv, 'dry_run' => true], master()))->body;
    T::same([true, 10], [$d['needs_force'], count($d['diff']['removed'])], 'vista previa: needs_force y 10 quitadas');
    T::true(strpos(implode(' ', $d['blockers']), 'La hoja retira 10 de 20 precios') !== false, 'y dice por qué');
    T::same(409, Router::handle(req('POST', '/prices/upload', ['csv' => $csv], master()))->status, 'subir sin force → 409');
    T::same(20, count(Prices::load()['items']), 'y no se aplica');
    T::same([200, 10], [($u = Router::handle(req('POST', '/prices/upload', ['csv' => $csv, 'force' => true], master())))->status, $u->body['meta']['refs']], 'con force → 200 y quedan 10');
}

/** D5 · massChange cuenta los precios retirados como cambios del 100 %. */
function test_d5_mass_change_counts_retired_prices()
{
    fresh(); sd_seed(12);
    $plan = Sheets::plan(sd_rows(12, range(0, 11)), 'upload', 'merge', []);
    $codes = array_map(function ($w) { return $w['code']; }, $plan['report']['warnings']);
    T::true(in_array('cambio_masivo', $codes, true), 'una hoja que solo retira 12 referencias con precio dispara «cambio_masivo»');
    $prev = Prices::load();
    T::same(null, Prices::massChange($prev, [], ['R0', 'R1', 'R2']), 'con menos de 10 referencias no hay aviso');
    T::same('cambio_masivo', Prices::massChange($prev, [], array_map(function ($i) { return 'R' . $i; }, range(0, 11)))['code'], 'retirar 12 de 12 con precio: aviso');
    T::same(null, Prices::massChange($prev, ['R0' => ['p' => 10.0]], ['R0']), 'si la hoja trae también un precio para esa referencia, gana el precio (no es una retirada)');
    T::same(null, Prices::massChange($prev, [], ['NOEXISTE1', 'NOEXISTE2', 'NOEXISTE3', 'NOEXISTE4', 'NOEXISTE5', 'NOEXISTE6', 'NOEXISTE7', 'NOEXISTE8', 'NOEXISTE9', 'NOEXISTE10']), 'retirar referencias que no tenían precio no cuenta');
}

/** D5 · La sincronización automática (cron, URL del cron, «Actualizar ahora») NUNCA aplica una hoja con bloqueos: conserva los precios, anota el motivo y el panel y el diagnóstico lo muestran. */
function test_d5_automatic_sync_never_applies_a_blocked_sheet()
{
    fresh(['cron_token' => CRON_TOKEN, 'prices' => ['csv_url' => 'https://sheet.test/x.csv']]);
    sd_catalog(40); sd_seed(40);
    $allZero = "ref;price\n" . implode("\n", array_map(function ($i) { return 'R' . $i . ';0'; }, range(0, 39))) . "\n";
    $allUp = "ref;price\n" . implode("\n", array_map(function ($i) { return 'R' . $i . ';' . (11 + $i); }, range(0, 39))) . "\n";
    Http::$mock = function () use (&$csv) { return [200, $csv]; };
    $csv = $allZero;
    $code = null; $text = '';
    try { Router::cron(); } catch (\RuntimeException $e) { $code = $e->getCode(); $text = $e->getMessage(); }
    T::same(409, $code, 'cron: la hoja vacía de precios se rechaza (409)');
    T::true(strpos($text, 'Sincronización rechazada: ') === 0 && strpos($text, 'La hoja retira 40 de 40 precios (100 %): confírmalo con force') !== false, 'con el motivo');
    $cur = Prices::load();
    T::same([40, 10.0, 49.0], [count($cur['items']), $cur['items']['R0']['p'], $cur['items']['R39']['p']], 'y los precios vigentes siguen intactos');
    $st = Store::get(Prices::KEY_SYNC);
    T::same([false, true, 'cron'], [$st['ok'], $st['blocked'], $st['reason']], 'el estado de la última sincronización guarda blocked y el motivo (reason = cron)');
    T::true(strpos($st['error'], 'La hoja retira 40 de 40') !== false && !empty($st['at']), 'y el error y la hora');
    $r = sa_cron_url();
    T::same([409, true], [$r->status, strpos($r->body['error'], 'La hoja retira 40 de 40') !== false], 'GET /cron?token=… responde 409 con el motivo y tampoco aplica nada');
    $r = Router::handle(req('POST', '/prices/refresh', null, master()));
    T::same([409, 'manual:master'], [$r->status, Store::get(Prices::KEY_SYNC)['reason']], '«Actualizar ahora» sin force también se rechaza (y deja su motivo)');
    T::same(40, count(Prices::load()['items']), 'sigue todo igual');
    // el panel y el diagnóstico lo muestran
    $diag = []; foreach (Diag::run()['checks'] as $c) $diag[$c['id']] = $c;
    T::true(isset($diag['sincronizacion_ultima']) && $diag['sincronizacion_ultima']['status'] === 'warn' && strpos($diag['sincronizacion_ultima']['msg'], 'BLOQUEÓ') !== false && strpos($diag['sincronizacion_ultima']['msg'], 'se conservan los precios vigentes') !== false, 'el diagnóstico avisa de la sincronización bloqueada');
    $mgr = Router::handle(req('GET', '/prices', null, master()))->body;
    T::same([false, true], [$mgr['sync']['ok'], $mgr['sync']['blocked']], 'GET /prices de un manager trae el estado de la última sincronización');
    $pub = Router::handle(req('GET', '/prices'));
    T::true(!array_key_exists('sync', $pub->body) && strpos(json_encode($pub->body), 'retira') === false, 'y el público no ve nada de eso');
    // con una hoja buena se aplica y el aviso desaparece
    $csv = $allUp;
    $meta = Router::cron();
    T::same([40, 11.0], [$meta['refs'], Prices::load()['items']['R0']['p']], 'una hoja buena se aplica');
    $st = Store::get(Prices::KEY_SYNC);
    T::same([true, false, ''], [$st['ok'], $st['blocked'], $st['error']], 'y el estado pasa a ok');
    $ids = array_map(function ($c) { return $c['id']; }, Diag::run()['checks']);
    T::true(!in_array('sincronizacion_ultima', $ids, true), 'y el diagnóstico deja de avisar');
    // un fallo que no es un bloqueo: la hoja no se puede leer
    Http::$mock = function () { return [500, 'x']; };
    $r = sa_cron_url();
    T::same([502, 'CSV 500'], [$r->status, $r->body['error']], 'si la hoja no se puede leer, el error es claro (502)');
    $st = Store::get(Prices::KEY_SYNC);
    T::same([false, false, 'CSV 500'], [$st['ok'], $st['blocked'], $st['error']], 'y el estado dice error (no blocked)');
    T::same(11.0, Prices::load()['items']['R0']['p'], 'los precios siguen como estaban');
}

/** Llamada GET /cron con el token de pruebas desde una IP libre. */
function sa_cron_url()
{
    static $n = 0;
    $q = req('GET', '/cron', null, [], '198.51.100.' . (100 + $n++));
    $q->query = ['token' => CRON_TOKEN];
    return Router::handle($q);
}

/** A6 · Un valor que no se puede codificar a JSON (1e999 = INF) ya no vacía lo guardado: enc() y Store::put() lanzan una excepción y lo anterior queda intacto. */
function test_a6_json_failures_throw_instead_of_nulling_data()
{
    fresh(); seedPrices();
    foreach ([INF, -INF, NAN, [1, INF], ['p' => NAN]] as $v) {
        $threw = false; try { Util::enc($v); } catch (\RuntimeException $e) { $threw = true; }
        T::true($threw, 'Util::enc lanza con ' . var_export($v, true));
    }
    $deep = []; $ref = &$deep; for ($i = 0; $i < 600; $i++) { $ref['a'] = []; $ref = &$ref['a']; } unset($ref);
    T::throws(function () use ($deep) { Util::enc($deep); }, '/No se puede codificar a JSON/', 'ni con demasiada profundidad');
    T::same('{"x":"é\\u0000"}', Util::enc(['x' => "é\0"]), 'y lo normal se codifica como siempre (sin escapar tildes)');
    $before = Prices::load();
    T::throws(function () { Store::put(Prices::KEY_CURRENT, ['items' => ['X' => ['p' => INF]]]); }, '/No se puede codificar a JSON/', 'Store::put lanza');
    T::same($before, Prices::load(), 'y la lista de precios que había queda intacta');
    T::same([], array_values(array_filter(scandir(Store::root() . '/kv'), function ($f) { return strpos($f, '.tmp') === 0; })), 'sin ficheros temporales colgados');
    T::throws(function () use ($before) { Prices::save(['items' => ['X' => ['p' => INF]], 'mode' => 'live'] + $before, $before); }, '/No se puede codificar/', 'Prices::save con un precio infinito lanza');
    T::same($before['items'], Prices::load()['items'], 'y no vacía la lista pública');
    // el ataque del informe: un CSV con 1e999
    fresh(); sd_catalog(3); sd_seed(3);
    $m = Sheets::sync(['rows' => Sheets::parseCsv("Referencia;Precio\nR0;12,5\nR1;1e999\nR2;4\n"), 'ctx' => []]);
    $raw = (string) file_get_contents(Store::root() . '/kv/' . rawurlencode('prices:current') . '.json');
    T::true(strpos($raw, '"v":null') === false && strpos($raw, 'Infinity') === false, 'A6: el CSV con 1e999 no deja un «null» en prices:current');
    $cur = Prices::load();
    T::same([3, 12.5, 11.0], [count($cur['items']), $cur['items']['R0']['p'], $cur['items']['R1']['p']], 'la celda 1e999 se ignora y el precio de esa referencia sigue como estaba (11)');
    $pub = Router::handle(req('GET', '/prices'));
    T::same(['live', 3], [$pub->body['prices']['mode'], count((array) $pub->body['prices']['items'])], 'y GET /prices sigue sirviendo la lista');
    // una respuesta que no se puede codificar no sale a medias
    [$out, $log] = sd_with_error_log(function () { ob_start(); (new Response(['x' => INF]))->send(); return ob_get_clean(); });
    T::true(preg_match('/^\{"ok":false,"error":"Error interno","id":"([0-9a-f]{8})"\}$/', $out, $mm) === 1 && strpos($log, 'torivac-api[' . $mm[1] . ']') !== false, 'Response::send: una respuesta imposible de codificar sale como 500 genérico con id, y el detalle va al registro');
}

/** A8 · La nota pública solo sale de una columna explícita: «Observaciones» (anotaciones internas) no se publica en GET /prices. */
function test_a8_internal_observations_are_not_published()
{
    fresh(); seedPrices();
    sd_catalog(2);
    $csv = "Referencia;Precio;Observaciones\nR0;12,50;Margen 45% - coste proveedor 6,90 - NO DIVULGAR\nR1;8;precio especial cliente X\n";
    T::same(200, Router::handle(req('POST', '/prices/upload', ['csv' => $csv, 'force' => true], master()))->status, 'se sube la hoja');
    $pub = json_encode(Router::handle(req('GET', '/prices'))->body);
    T::true(strpos($pub, 'Margen') === false && strpos($pub, 'NO DIVULGAR') === false && strpos($pub, 'precio especial') === false && strpos($pub, '"note"') === false, 'A8: la columna Observaciones no sale en el endpoint público');
    $csv2 = "Referencia;Precio;Nota web\nR0;12,50;Plazo 5 días\n";
    Router::handle(req('POST', '/prices/upload', ['csv' => $csv2, 'force' => true], master()));
    T::true(strpos(Util::enc(Router::handle(req('GET', '/prices'))->body), 'Plazo 5 días') !== false, 'y una columna explícita («Nota web») sí');
}

/** D6 · Ningún 500 devuelve el mensaje interno: respuesta genérica con id de 8 hex y el detalle al registro; los errores pensados para quien llama (400, 409, 502, 503…) conservan su texto. */
function test_d6_internal_errors_are_generic_and_logged_with_an_id()
{
    fresh(['prices' => ['csv_url' => 'https://sheet.test/x.csv']]);
    [$r, $log] = sd_with_error_log(function () {
        Http::$mock = function () { throw new \RuntimeException('detalle interno secreto en /var/www/vhosts/torivac/config.php'); };
        return Router::handle(req('POST', '/prices/refresh', null, master()));
    });
    $keys = array_keys($r->body); sort($keys);
    T::same([500, ['error', 'id', 'ok']], [$r->status, $keys], 'un fallo interno: 500 con ok, error e id');
    T::same('Error interno', $r->body['error'], 'el texto es genérico');
    T::true(preg_match('/^[0-9a-f]{8}$/', $r->body['id']) === 1 && strpos(json_encode($r->body), 'detalle') === false && strpos(json_encode($r->body), '/var/www') === false, 'con un id de 8 hex y sin nada interno');
    T::true(strpos($log, 'torivac-api[' . $r->body['id'] . ']') !== false && strpos($log, 'detalle interno secreto') !== false && strpos($log, 'RuntimeException') !== false, 'el detalle va al registro con ese mismo id');
    $cases = [
        [new \InvalidArgumentException('La hoja está vacía'), 400, 'La hoja está vacía'],
        [new \RuntimeException('Sincronización rechazada: x', 409), 409, 'Sincronización rechazada: x'],
        [new \RuntimeException('XLSX 404', 502), 502, 'XLSX 404'],
        [new \RuntimeException('La IA no está configurada', 503), 503, 'La IA no está configurada'],
        [new \RuntimeException('muy interno', 500), 500, 'Error interno'],
        [new \RuntimeException('muy interno'), 500, 'Error interno'],
        [new \RuntimeException('muy interno', 99), 500, 'Error interno'],
        [new \RuntimeException('muy interno', 600), 500, 'Error interno'],
        [new \TypeError('muy interno'), 500, 'Error interno'],
        [new \DomainException('muy interno'), 500, 'Error interno'],
    ];
    foreach ($cases as [$e, $st, $msg]) {
        [$resp] = sd_with_error_log(function () use ($e) { return Router::failure($e); });
        T::same([$st, $msg], [$resp->status, $resp->body['error']], get_class($e) . ' código ' . $e->getCode());
    }
    // la IA: antes un RuntimeException sin código devolvía su mensaje con un 500
    fresh(['ai' => ['anthropic_api_key' => 'sk-test']]); seedPrices();
    [$ai] = sd_with_error_log(function () { Http::$mock = function () { throw new \RuntimeException('la clave sk-test falló en el proxy 10.0.0.9'); }; return Router::handle(req('POST', '/prices/ai', ['instruction' => 'sube un 3 % las resistencias'], master())); });
    T::same([500, 'Error interno', false], [$ai->status, $ai->body['error'], strpos(json_encode($ai->body), 'sk-test') !== false], '/prices/ai: un fallo interno no devuelve su mensaje');
    $ai2 = Router::handle(req('POST', '/prices/ai', ['instruction' => 'ok'], master()));
    T::same([400, 'Escribe una instrucción (por ejemplo: «sube un 3 % las resistencias»)'], [$ai2->status, $ai2->body['error']], 'y los errores pensados para el usuario conservan su texto');
}

/** D6 · Tope REAL del cuerpo (se lee como mucho 6 MB + 1 byte, aunque Content-Length mienta o falte) y JSON anidado como mucho a 32 niveles → petición no válida (400). */
function test_d6_body_cap_and_json_depth()
{
    fresh(); seedPrices();
    $dir = tmp_dir('tv-body-');
    try {
        $f = $dir . '/cuerpo.bin';
        file_put_contents($f, str_repeat('a', 7000000));
        T::same(Request::MAX_BODY + 1, strlen(Request::readBody($f)), 'readBody lee como mucho MAX_BODY + 1 bytes de un cuerpo de 7 MB');
        file_put_contents($f, str_repeat('b', 1000));
        T::same(1000, strlen(Request::readBody($f)), 'y un cuerpo pequeño, entero');
    } finally { rmtree_all($dir); }
    $big = '{"a":"' . str_repeat('x', Request::MAX_BODY - 8) . '"}';
    T::same([Request::MAX_BODY, true], [strlen($big), is_array(req('POST', '/order', $big)->json())], 'un JSON de exactamente 6 000 000 bytes se acepta');
    $over = '{"a":"' . str_repeat('x', Request::MAX_BODY - 7) . '"}';
    T::same([Request::MAX_BODY + 1, null], [strlen($over), req('POST', '/order', $over)->json()], 'con 6 000 001 bytes ya no (json() devuelve null)');
    $r = Router::handle(req('POST', '/order', $over, [], '203.0.113.1'));
    T::same([400, 'Petición no válida'], [$r->status, $r->body['error']], 'y POST /order responde 400');
    T::same(null, req('POST', '/prices/upload', str_repeat('c', 3000001))->json(3000000), 'los límites propios de cada ruta (3 MB en la subida de hojas) siguen valiendo');
    $nest = function ($n) { return str_repeat('[', $n) . str_repeat(']', $n); };
    T::same([true, null, null], [is_array(req('POST', '/order', $nest(32))->json()), req('POST', '/order', $nest(33))->json(), req('POST', '/order', $nest(5000))->json()], 'JSON anidado: 32 niveles vale, 33 y 5000 no');
    $deepOrder = '{"customer":{"name":"Ana","email":"ana@acme.es","privacy":true},"lines":[{"ref":"TT0020210","qty":1,"x":' . $nest(40) . '}]}';
    $r = Router::handle(req('POST', '/order', $deepOrder, [], '203.0.113.2'));
    T::same([400, []], [$r->status, Store::keys('order:')], 'un pedido con un campo anidado a 40 niveles → 400 y no se guarda');
}

/** D6/A9 · Con el API real (`php -S`, display_errors=1 en el servidor): un aviso interno de PHP nunca llega a la respuesta, y un cuerpo de 7 MB o un JSON demasiado hondo dan 400. */
function test_d6_real_server_hides_php_warnings_and_rejects_oversized_bodies()
{
    $srv = api_server(['TORIVAC_SESSION_SECRET' => SECRET, 'TORIVAC_ADMIN_TOKEN' => MASTER_TOKEN, 'TORIVAC_MAIL_DRIVER' => 'file', 'TORIVAC_ORDER_TO' => 'info@grupotorivac.com']);
    if (!$srv) { fwrite(STDERR, "  · servidor real: sin proc_open, se omite\n"); return; }
    try {
        $post = function ($path, $body, array $h = []) use ($srv) { return Http::request('POST', $srv['base'] . $path, array_merge(['Content-Type: application/json'], $h), is_string($body) ? $body : json_encode($body), 60); };
        [, $control] = Http::request('GET', $srv['base'] . '/control', [], null, 10);
        T::true(strpos($control, 'Array to string conversion') !== false, 'control: con display_errors=1 en el servidor, un aviso de PHP SÍ se escribe en la respuesta de una ruta que no es del API');
        [$st, $body] = $post('/api/prices/upload', ['rows' => [[['x'], 'p'], ['a', 1]], 'dry_run' => true], ['Authorization: Bearer ' . MASTER_TOKEN]);
        T::true($st === 400 && is_array(json_decode($body, true)) && stripos($body, 'warning') === false && strpos($body, '.php') === false && strpos($body, 'Array to string') === false, 'A9: en el API el mismo aviso interno no llega a la respuesta (JSON limpio, ' . $st . ')');
        [$st, $body] = $post('/api/auth/login', ['email' => ['x'], 'password' => 'y']);
        T::true($st === 400 && is_array(json_decode($body, true)) && stripos($body, 'warning') === false, 'A9: {"email":["x"]} en el acceso → 400 limpio, sin la ruta del servidor');
        [$st, $body] = $post('/api/order', '{"customer":' . str_repeat('x', 7000000));
        T::same([400, 'Petición no válida'], [$st, json_decode($body, true)['error'] ?? null], 'un cuerpo de 7 MB → 400');
        [$st] = $post('/api/order', '{"customer":{"name":"Ana","email":"ana@acme.es","privacy":true},"lines":[{"ref":"X","qty":1,"x":' . str_repeat('[', 40) . str_repeat(']', 40) . '}]}');
        T::same(400, $st, 'un JSON anidado a 40 niveles → 400');
        [$st, $body] = Http::request('GET', $srv['base'] . '/api/health', [], null, 10);
        T::same([200, true], [$st, json_decode($body, true)['ok'] ?? null], 'el API real responde');
        [$st] = Http::request('GET', $srv['base'] . '/api/orders', [], null, 10);
        T::same(401, $st, 'y exige sesión');
        $cat = json_decode((string) file_get_contents(dirname(__DIR__) . '/generated/catalog.json'), true)['items'];
        $ref = array_keys($cat)[0];
        [$st, $body] = $post('/api/order', ['customer' => ['name' => 'Ana Pérez', 'email' => 'ana@acme.es', 'privacy' => true], 'lines' => [['ref' => (string) $ref, 'qty' => 2]], 'lang' => 'es', '_e' => 5000]);
        $j = json_decode($body, true);
        T::same([200, true, 'sent'], [$st, $j['ok'] ?? null, $j['emailed']['customer_reason'] ?? null], 'un pedido normal por el API real: 200 y copia enviada');
        $perm = fileperms($srv['dir'] . '/datos/kv') & 0777;
        T::same(0770, $perm, 'la carpeta de datos del API real se creó con permisos 0770');
    } finally { ($srv['stop'])(); }
}

/** D8/A7 · El lector de .xlsx tiene topes: una bomba de descompresión (aunque el libro mienta sobre su tamaño) o una columna absurda dan «La hoja es demasiado grande o está dañada» sin agotar la memoria. */
function test_a7_xlsx_reader_limits_memory_and_columns()
{
    $msg = 'La hoja es demasiado grande o está dañada';
    $dir = tmp_dir('tv-xlsx-');
    try {
        // bomba de descompresión: ~300 KB que inflan a 300 MB; declarando su tamaño real y mintiendo (1000 bytes)
        $bomb = deflate_bomb(300);
        $honest = zip_build(['[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => ['deflate' => $bomb, 'usize' => 314572800]]);
        $lying = zip_build(['[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => ['deflate' => $bomb, 'usize' => 1000]]);
        file_put_contents($dir . '/honesta.xlsx', $honest); file_put_contents($dir . '/miente.xlsx', $lying);
        foreach (['honesta', 'miente'] as $k) {
            [$rc, $out, $err] = php_child('try { Torivac\\Xlsx::read(file_get_contents(' . var_export($dir . "/$k.xlsx", true) . ')); echo "SIN ERROR"; } catch (\\InvalidArgumentException $e) { echo $e->getMessage(); }', ['memory_limit=64M']);
            T::same([0, $msg], [$rc, $out], "A7: bomba de 300 MB ($k) con memory_limit=64M → error claro y sin Fatal" . ($err !== '' ? ' · ' . substr($err, 0, 120) : ''));
        }
        // una celda con la columna ZZZZZ1 (el libro de 818 bytes del informe)
        file_put_contents($dir . '/col.xlsx', xlsx_with_sheet('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ref</t></is></c><c r="ZZZZZ1"><v>1</v></c></row></sheetData></worksheet>'));
        [$rc, $out] = php_child('try { Torivac\\Xlsx::read(file_get_contents(' . var_export($dir . '/col.xlsx', true) . ')); echo "SIN ERROR"; } catch (\\InvalidArgumentException $e) { echo $e->getMessage(); }', ['memory_limit=64M']);
        T::same([0, $msg], [$rc, $out], 'A7: columna ZZZZZ1 con memory_limit=64M → error claro');
    } finally { rmtree_all($dir); }
    $cell = function ($ref) { return xlsx_with_sheet('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ref</t></is></c><c r="' . $ref . '"><v>7</v></c></row></sheetData></worksheet>'); };
    $rowOf = function ($ref) use ($cell) { $s = Xlsx::read($cell($ref)); return $s[0]['rows'][0]; };
    T::same([16384, 7], [count($rowOf('XFD1')), $rowOf('XFD1')[16383]], 'la última columna de Excel (XFD) se lee');
    foreach (['XFE1', 'AAAA1', 'ZZZ1', 'ZZZZZZZZZZ1'] as $ref) T::throws(function () use ($cell, $ref) { Xlsx::read($cell($ref)); }, '/' . $msg . '/', "columna $ref → error claro");
    // demasiadas casillas (huecos incluidos): 100 filas con una celda en XFD = 1,6 M de casillas
    $row = '<row><c r="A1" t="inlineStr"><is><t>x</t></is></c><c r="XFD1"><v>1</v></c></row>';
    $many = xlsx_with_sheet('<worksheet><sheetData>' . str_repeat($row, 100) . '</sheetData></worksheet>');
    $few = xlsx_with_sheet('<worksheet><sheetData>' . str_repeat($row, 80) . '</sheetData></worksheet>');
    $f1 = tempnam(sys_get_temp_dir(), 'tv-x') . '.xlsx'; $f2 = tempnam(sys_get_temp_dir(), 'tv-x') . '.xlsx'; file_put_contents($f1, $many); file_put_contents($f2, $few);
    [$rc, $out] = php_child('try { Torivac\\Xlsx::read(file_get_contents(' . var_export($f1, true) . ')); echo "SIN ERROR"; } catch (\\InvalidArgumentException $e) { echo $e->getMessage(); }', ['memory_limit=96M']);
    T::same([0, $msg], [$rc, $out], 'más de 1 500 000 casillas (con los huecos) → error claro, sin agotar la memoria');
    [$rc, $out] = php_child('echo count(Torivac\\Xlsx::read(file_get_contents(' . var_export($f2, true) . '))[0]["rows"]);', ['memory_limit=96M']);
    T::same([0, '80'], [$rc, $out], 'y 80 filas con una celda en XFD (1 311 000 casillas) todavía se leen');
    @unlink($f1); @unlink($f2);
    // más de 200 000 filas
    $rows = '<row><c r="A1"><v>1</v></c></row>';
    T::throws(function () use ($rows) { Xlsx::read(xlsx_with_sheet('<worksheet><sheetData>' . str_repeat($rows, 200001) . '</sheetData></worksheet>')); }, '/' . $msg . '/', 'más de 200 000 filas → error claro');
    T::same(1000, count(Xlsx::read(xlsx_with_sheet('<worksheet><sheetData>' . str_repeat($rows, 1000) . '</sheetData></worksheet>'))[0]['rows']), 'y 1000 filas se leen');
}

/** D8/W11 · El XML se recorre en una sola pasada: miles de <row>, <c>, <si>, <Relationship> o <sheet> sin cerrar ya no son cuadráticos. */
function test_a7_xlsx_reader_is_linear_on_unclosed_elements()
{
    $time = function (callable $fn) { $s = microtime(true); $r = $fn(); return [microtime(true) - $s, $r]; };
    [$t, $sheets] = $time(function () { return Xlsx::read(xlsx_with_sheet('<worksheet><sheetData>' . str_repeat('<row>', 30000) . '</sheetData></worksheet>')); });
    T::true($t < 1.5 && $sheets[0]['rows'] === [], sprintf('30 000 <row> sin cerrar: %.2f s y ninguna fila', $t));
    [$t, $sheets] = $time(function () { return Xlsx::read(xlsx_with_sheet('<worksheet><sheetData><row>' . str_repeat('<c>', 30000) . '</row></sheetData></worksheet>')); });
    T::true($t < 1.5 && $sheets[0]['rows'] === [], sprintf('30 000 <c> sin cerrar: %.2f s', $t));
    [$t, $sheets] = $time(function () { return Xlsx::read(xlsx_with_sheet('<worksheet><sheetData><row><c t="inlineStr"><is>' . str_repeat('<t>', 30000) . '</is></c></row></sheetData></worksheet>')); });
    T::true($t < 1.5, sprintf('30 000 <t> sin cerrar: %.2f s', $t));
    [$t] = $time(function () { return Xlsx::read(xlsx_with_sheet('<worksheet><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>', '<sst>' . str_repeat('<si>', 30000) . '</sst>')); });
    T::true($t < 1.5, sprintf('30 000 <si> sin cerrar: %.2f s', $t));
    [$t] = $time(function () { return Xlsx::read(xlsx_with_sheet('<worksheet><sheetData><row><c t="inlineStr"><is>' . str_repeat('<rPh>', 30000) . '</is></c></row></sheetData></worksheet>')); });
    T::true($t < 1.5, sprintf('30 000 <rPh> sin cerrar: %.2f s', $t));
    foreach (['<sheet name="a" ' => 'xl/workbook.xml', '<Relationship Id="x" ' => 'xl/_rels/workbook.xml.rels'] as $open => $entry) {
        $wb = zip_build(['xl/workbook.xml' => '<workbook xmlns:r="x"><sheets>' . ($entry === 'xl/workbook.xml' ? str_repeat($open, 30000) : '') . '</sheets></workbook>', 'xl/_rels/workbook.xml.rels' => '<Relationships>' . ($entry !== 'xl/workbook.xml' ? str_repeat($open, 30000) : '') . '</Relationships>']);
        $err = null;
        [$t] = $time(function () use ($wb, &$err) { try { Xlsx::read($wb); } catch (\InvalidArgumentException $e) { $err = $e->getMessage(); } });
        T::true($t < 1.5 && $err === 'La hoja es demasiado grande o está dañada', sprintf('30 000 «%s» sin «>»: error claro en %.2f s', trim($open), $t));
    }
    // una etiqueta de atributos enorme tampoco
    T::throws(function () { Xlsx::read(xlsx_with_sheet('<worksheet><sheetData><row><c r="A1" ' . str_repeat('a', 5000) . '="x"><v>1</v></c></row></sheetData></worksheet>')); }, '/demasiado grande o está dañada/', 'una etiqueta con 5000 caracteres de atributos → error claro');
    // y lo normal sigue leyéndose igual (textos compartidos, inline, números, booleanos y huecos)
    $shared = '<sst><si><t>ref</t></si><si><t>price</t></si><si><r><t>A</t></r><r><t xml:space="preserve"> B</t></r><rPh><t>fonética</t></rPh></si></sst>';
    $sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>12.5</v></c><c r="D2" t="b"><v>1</v></c></row><row r="3"/><row r="4"><c r="A4" t="inlineStr"><is><t>R&amp;9</t></is></c><c r="B4"><v>3</v></c></row></sheetData></worksheet>';
    T::same([['ref', 'price'], ['A B', 12.5, '', true], ['R&9', 3]], Xlsx::read(xlsx_with_sheet($sheet, $shared))[0]['rows'], 'lectura normal intacta');
}

/** D8 · Una hoja .xlsx hostil hace fallar la sincronización con un error claro, conserva los precios vigentes y deja el motivo anotado. */
function test_d8_oversized_workbook_keeps_current_prices()
{
    $msg = 'La hoja es demasiado grande o está dañada';
    fresh(['prices' => ['xlsx_url' => 'https://x.test/a.xlsx']]);
    seedPrices();
    $before = Prices::load();
    $bomb = zip_build(['[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => ['deflate' => deflate_bomb(60), 'usize' => 5]]);
    Http::$mock = function () use ($bomb) { return [200, $bomb]; };
    T::throws(function () { Sheets::sync(['ctx' => []]); }, '/' . $msg . '/', 'la sincronización falla con el error claro');
    T::same($before, Prices::load(), 'y los precios vigentes siguen como estaban');
    $st = Store::get(Prices::KEY_SYNC);
    T::true($st['ok'] === false && $st['blocked'] === false && strpos($st['error'], $msg) !== false, 'el estado de la última sincronización lo anota');
    $r = Router::handle(req('POST', '/prices/refresh', null, master()));
    T::same([400, true], [$r->status, strpos($r->body['error'], $msg) !== false], 'y «Actualizar ahora» responde 400 con ese texto');
}

/** A11 · El cliente HTTP solo sigue http y https (una redirección a file:/// devolvía el contenido de ese fichero), con tope de tamaño de respuesta y sin llegar a redes internas desde un servidor público. */
function test_a11_http_client_protocols_size_and_private_redirects()
{
    fresh();
    // unidad: qué redirecciones se rechazan (sin red)
    $why = function (bool $pub, string $url, array $ips = []) { return Http::redirectProblem($pub, $url, $ips); };
    foreach (['file:///etc/hostname', 'gopher://127.0.0.1:70/_x', 'ftp://example.com/x', 'dict://127.0.0.1:11211/info', 'ldap://127.0.0.1/', '//example.com/x', '/solo/ruta', 'javascript:alert(1)', 'http:///sin-host', ''] as $u) T::true($why(false, $u) !== null, 'se rechaza la redirección a «' . $u . '» incluso desde un servidor local');
    T::same([null, null, null, null], [$why(true, 'https://sheet.test/x', ['8.8.8.8']), $why(true, 'http://sheet.test/x', ['2606:4700::1111']), $why(false, 'http://127.0.0.1:8080/x', ['127.0.0.1']), $why(false, 'http://sin-resolver.test/x', [])], 'https/http públicos valen; desde un servidor local se permite ir a otro local (las pruebas usan 127.0.0.1)');
    T::true($why(true, 'https://sin-resolver.test/x', []) !== null, 'desde un servidor público, un destino que no se puede resolver se rechaza (falla cerrado)');
    foreach (['127.0.0.1', '10.0.0.5', '172.16.5.5', '192.168.1.1', '169.254.169.254', '::1', 'fe80::1', 'fc00::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', '::10.0.0.1', '64:ff9b::a00:1', '2002:0a00:0001::1', '100.64.0.1', '224.0.0.1', '0.0.0.0', '240.0.0.1', 'no-es-una-ip'] as $ip) {
        T::true(Http::isPrivateIp($ip), "$ip es privada o reservada");
        T::true($why(true, 'http://interno.example/x', [$ip]) !== null, "desde un servidor público se rechaza una redirección que resuelve a $ip");
    }
    foreach (['8.8.8.8', '1.1.1.1', '2606:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:0808:0808::1'] as $ip) T::true(!Http::isPrivateIp($ip), "$ip es pública");
    Http::$resolver = function ($h) { return ['evil.example' => ['93.184.216.34', '10.0.0.5'], 'ok.example' => ['93.184.216.34'], 'v6.example' => ['2606:4700::1111']][$h] ?? []; };
    T::same([true, false, false, false, true, true], [Http::isPrivateHost('evil.example'), Http::isPrivateHost('ok.example'), Http::isPrivateHost('v6.example'), Http::isPrivateHost('noexiste.example'), Http::isPrivateHost('127.0.0.1'), Http::isPrivateHost('[::1]')], 'un nombre con una sola dirección privada entre varias cuenta como privado; las IP literales se miran tal cual');
    Http::$resolver = null;
    // real: servidor local con redirecciones peligrosas y respuestas enormes
    if (!function_exists('curl_init') || !function_exists('proc_open')) { fwrite(STDERR, "  · http: sin cURL o proc_open, se omite\n"); return; }
    $dir = tmp_dir('tv-http-');
    file_put_contents("$dir/r.php", '<?php
$p = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
if ($p === "/file") { header("Location: file:///etc/hostname", true, 302); return true; }
if ($p === "/gopher") { header("Location: gopher://127.0.0.1:1/_x", true, 302); return true; }
if ($p === "/ftp") { header("Location: ftp://127.0.0.1/x", true, 302); return true; }
if ($p === "/ok") { header("Content-Type: text/plain"); echo "hola"; return true; }
if ($p === "/big") { header("Content-Type: application/octet-stream"); $c = str_repeat("x", 1048576); for ($i = 0; $i < 30; $i++) { echo $c; flush(); } return true; }
if ($p === "/bigcl") { header("Content-Type: application/octet-stream"); header("Content-Length: 30000000"); $c = str_repeat("x", 1048576); for ($i = 0; $i < 30; $i++) { echo $c; flush(); } return true; }
if ($p === "/near") { header("Content-Type: application/octet-stream"); $c = str_repeat("y", 1048576); for ($i = 0; $i < 23; $i++) { echo $c; flush(); } return true; }
http_response_code(404);');
    $s = stream_socket_server('tcp://127.0.0.1:0');
    $port = (int) substr(stream_socket_get_name($s, false), strrpos(stream_socket_get_name($s, false), ':') + 1);
    fclose($s);
    putenv('NO_PROXY=127.0.0.1,localhost'); putenv('no_proxy=127.0.0.1,localhost');
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", "$dir/r.php"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $dir);
    try {
        for ($i = 0; $i < 50; $i++) { $c = @fsockopen('127.0.0.1', $port, $en, $es, 0.2); if ($c) { fclose($c); break; } usleep(100000); }
        $base = "http://127.0.0.1:$port";
        T::same([200, 'hola'], Http::request('GET', "$base/ok", [], null, 10), 'una descarga normal funciona');
        foreach (['/file' => 'file:///', '/gopher' => 'gopher', '/ftp' => 'ftp'] as $path => $what) {
            $res = null; $code = null; $text = '';
            try { $res = Http::request('GET', $base . $path, [], null, 10); } catch (\RuntimeException $e) { $code = $e->getCode(); $text = $e->getMessage(); }
            T::same([null, 502, true], [$res, $code, strpos($text, 'Redirección rechazada') === 0], "A11: la redirección a $what se rechaza (antes devolvía el contenido de /etc/hostname)");
        }
        foreach (['/big' => 'sin Content-Length', '/bigcl' => 'con Content-Length'] as $path => $what) {
            $res = null; $code = null; $text = '';
            try { $res = Http::request('GET', $base . $path, [], null, 30); } catch (\RuntimeException $e) { $code = $e->getCode(); $text = $e->getMessage(); }
            T::same([null, 502, 'La respuesta supera el tamaño permitido (25 MB)'], [$res, $code, $text], "una respuesta de 30 MB $what se corta");
        }
        [$st, $body] = Http::request('GET', "$base/near", [], null, 30);
        T::same([200, 23 * 1048576], [$st, strlen($body)], 'y una de 23 MB todavía se descarga entera');
    } finally { proc_terminate($proc); proc_close($proc); rmtree_all($dir); }
}

/** D9 · GET /api/admin/data: las propuestas y los datos de cobertura solo los ve un manager (el token maestro también); clientes y anónimos no; sin fichero → listas vacías, nunca un error. */
function test_d9_admin_data_is_only_for_managers()
{
    fresh();
    $dir = tmp_dir('tv-admin-');
    try {
        $f = $dir . '/admin-data.json';
        file_put_contents($f, '{"proposals":[{"id":"PR-14834","type":"legal","severity":"alta","title":"Aviso legal: faltan datos registrales"},{"id":"PR-25713","type":"voltage_tag","severity":"baja","title":"Etiqueta de tensión"}],"admin":{"products":[{"id":884,"name":"Serie TT"}],"byRef":{"TT0020210":{"cat":"Transformadores"}}}}');
        AdminData::setFile($f);
        Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
        Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
        $get = function (?string $tok, string $ip = '10.0.0.1') { return Router::handle(req('GET', '/admin/data', null, $tok === null ? [] : bearer($tok), $ip)); };
        T::same(401, $get(null)->status, 'anónimo → 401');
        T::same(401, $get('token-falso', '10.0.0.2')->status, 'token falso → 401');
        T::same(403, $get(login_token('ana@acme.es', PW_ANA))->status, 'cliente → 403');
        foreach ([['sesión de manager', login_token('jefe@torivac.com', PW_JEFE)], ['token maestro', MASTER_TOKEN]] as [$who, $tok]) {
            $r = $get($tok);
            T::same([200, 'no-store', true], [$r->status, $r->headers['Cache-Control'], $r->body['ok']], "$who: 200 y Cache-Control: no-store");
            $wire = json_decode(Util::enc($r->body), true);
            T::same([2, 'PR-14834', 884, 'Transformadores'], [count($wire['proposals']), $wire['proposals'][0]['id'], $wire['admin']['products'][0]['id'], $wire['admin']['byRef']['TT0020210']['cat']], "$who: las propuestas y los datos de cobertura tal cual");
        }
        T::same(['ok', 'proposals', 'admin'], array_keys($get(MASTER_TOKEN)->body), 'forma de la respuesta: ok, proposals, admin');
        // forma garantizada aunque el fichero falte o esté dañado
        $empty = '{"ok":true,"proposals":[],"admin":{"products":[],"byRef":{}}}';
        foreach ([['sin fichero', null], ['JSON roto', 'esto no es json {'], ['vacío', ''], ['otra forma', '{"proposals":"x","admin":[1,2]}'], ['lista en vez de objeto', '[1,2,3]'], ['byRef vacío', '{"proposals":[],"admin":{"products":[],"byRef":{}}}']] as [$what, $content]) {
            if ($content === null) AdminData::setFile($dir . '/no-existe.json'); else { file_put_contents($f, $content); AdminData::setFile($f); }
            T::same($empty, Util::enc($get(MASTER_TOKEN)->body), "$what: listas vacías y byRef como {} (nunca un error)");
        }
        AdminData::setFile(null);
        $d = json_decode(Util::enc($get(MASTER_TOKEN)->body), true);
        $real = json_decode((string) @file_get_contents(__DIR__ . '/../generated/admin-data.json'), true);       // lo que haya escrito el build (o el ejemplo): se compara con lo que sirve el API
        T::true($d['ok'] === true && is_array($d['proposals']) && is_array($d['admin']['products']) && is_array($d['admin']['byRef']), 'el fichero de generated/ se sirve con la forma esperada');
        T::same(is_array($real['proposals'] ?? null) ? count($real['proposals']) : 0, count($d['proposals']), 'y se sirve entero: las mismas propuestas que tiene el fichero (el build lo sustituye por el real)');
        // las rutas de gestión siguen cerradas al público
        T::same(401, Router::handle(req('GET', '/admin/data', null, [], '10.0.0.3'))->status, 'sin sesión el endpoint no se sirve');
    } finally { AdminData::setFile(null); rmtree_all($dir); }
}

/** D10/A10 · .htaccess pasa a lista blanca: Require all denied para todo salvo index.php (y la sintaxis equivalente de Apache 2.2); lib/, tools/, cron.php, config.php, generated/ y storage/ no se sirven. */
function test_d10_htaccess_is_a_whitelist()
{
    $ht = (string) file_get_contents(dirname(__DIR__) . '/.htaccess');
    T::true(preg_match('/<IfModule mod_authz_core\.c>\s*Require all denied\s*<FilesMatch "\^index\\\\\.php\$">\s*Require all allowed\s*<\/FilesMatch>\s*<\/IfModule>/', $ht) === 1, 'Apache 2.4: Require all denied y solo index.php con Require all allowed');
    T::true(preg_match('/<IfModule !mod_authz_core\.c>\s*Order deny,allow\s*Deny from all\s*<FilesMatch "\^index\\\\\.php\$">\s*Order allow,deny\s*Allow from all\s*<\/FilesMatch>\s*<\/IfModule>/', $ht) === 1, 'Apache 2.2: Order deny,allow, Deny from all y solo index.php permitido');
    T::true(strpos($ht, 'Options -Indexes') !== false, 'sin listado de carpetas');
    $lines = array_filter(array_map('trim', explode("\n", $ht)), function ($l) { return $l !== '' && $l[0] !== '#'; });
    $allows = array_values(array_filter($lines, function ($l) { return stripos($l, 'Require all granted') === 0 || stripos($l, 'Allow from') === 0 || stripos($l, 'Require all allowed') === 0; }));
    T::same(['Require all allowed', 'Allow from all'], $allows, 'solo hay permisos dentro de los FilesMatch de index.php');
    preg_match('/<FilesMatch "([^"]+)">/', $ht, $m);
    $re = '/' . $m[1] . '/';
    foreach (['index.php'] as $ok) T::same(1, preg_match($re, $ok), "se sirve $ok");
    foreach (['config.php', 'config.sample.php', 'cron.php', 'config.php.bak', 'config.php~', 'config.php.old', 'config.bak', '.env', 'error_log', 'backup.zip', 'dump.sql', 'index.php.bak', 'index.php~', 'Index.php', 'xindex.php', 'index.phps', 'index.php5', 'admin-data.json', 'catalog.json', 'create-user.php', 'check.php', 'Router.php', 'autoload.php', 'README.md', 'index.html', '.htaccess', '.git'] as $no) T::same(0, preg_match($re, $no), "no se sirve $no");
    // la raíz de la web ya reescribe /api/* a index.php: lo que hay en cada carpeta del API no necesita servirse
    foreach (['lib', 'tools', 'generated', 'tests'] as $d) T::true(is_dir(dirname(__DIR__) . '/' . $d), "existe api/$d (y queda cerrada por la lista blanca)");
    $base = tmp_dir('tv-ht-');                                                                 // api/storage no se versiona (en una copia limpia no existe): se comprueba lo que crea el almacén al iniciarse
    try {
        Store::init($base . '/storage');
        T::true(strpos((string) file_get_contents($base . '/storage/.htaccess'), 'Require all denied') !== false, 'un almacén dentro de la web (api/storage) se crea además con su propio .htaccess cerrado');
    } finally { rmtree_all($base); fresh(); }
}

/** D10/A10 · Ficheros nuevos 0660 y carpetas 0770 (con umask 022 salían 0664/0755, legibles por otros usuarios del hosting); un almacén anterior se cierra a «otros» en su siguiente uso. */
function test_d10_new_files_and_dirs_are_private()
{
    $old = umask(022);
    $base = tmp_dir('tv-perm-');
    $mode = function ($p) { return fileperms($p) & 0777; };
    try {
        $dir = $base . '/datos';
        Store::init($dir);
        T::same([0770, 0770, 0770, 0770], [$mode($dir), $mode("$dir/kv"), $mode("$dir/locks"), $mode("$dir/outbox")], 'carpetas del almacén nuevas: 0770 aunque el umask sea 022');
        Config::set(['storage_dir' => $dir, 'session_secret' => SECRET, 'mail' => ['driver' => 'file'], 'order_to' => ['info@grupotorivac.com']]);
        Store::put('prueba', ['a' => 1]);
        T::same(0660, $mode(Store::root() . '/kv/prueba.json'), 'fichero de datos nuevo: 0660');
        Store::locked('micandado', function () { return 1; });
        T::same(0660, $mode("$dir/locks/micandado.lock"), 'fichero de bloqueo nuevo: 0660');
        $r = Mail::send(['to' => ['info@grupotorivac.com'], 'subject' => 's', 'text' => 't']);
        T::same(0660, $mode("$dir/outbox/" . $r['id']), 'correo guardado por el controlador file: 0660');
        Store::put('prueba', ['a' => 2]);
        T::same(0660, $mode(Store::root() . '/kv/prueba.json'), 'y al reescribirlo sigue en 0660');
        T::same([], array_values(array_filter(scandir("$dir/kv"), function ($f) { return strpos($f, '.tmp') === 0; })), 'sin temporales sueltos');
        // almacén anterior: carpetas 0775 y ficheros 0664
        $oldDir = $base . '/viejo';
        foreach (['', '/kv', '/locks', '/outbox'] as $d) { mkdir($oldDir . $d, 0775, true); chmod($oldDir . $d, 0775); }
        file_put_contents("$oldDir/kv/user%3Aviejo.json", '{"v":{"email":"viejo"}}'); chmod("$oldDir/kv/user%3Aviejo.json", 0664);
        Store::init($oldDir);
        T::same([0, 0, 0, 0775], [$mode("$oldDir/kv") & 0007, $mode("$oldDir/locks") & 0007, $mode("$oldDir/outbox") & 0007, $mode($oldDir)], 'un almacén anterior: kv, locks y outbox se cierran a «otros» (sus ficheros 0664 dejan de ser alcanzables); la carpeta raíz, que no es nuestra, no se toca');
        T::same(['v' => ['email' => 'viejo']], json_decode((string) file_get_contents("$oldDir/kv/user%3Aviejo.json"), true), 'y los datos siguen leyéndose');
    } finally { umask($old); rmtree_all($base); fresh(); }
}

/** D10 · El diagnóstico comprueba lo nuevo: secretos cortos (por su nombre, nunca el valor), modo de la copia al cliente, tope diario y tope de pedidos por hora. */
function test_d10_diag_checks_the_new_settings()
{
    $run = function (array $cfg) {
        fresh($cfg);
        $o = [];
        foreach (Diag::run()['checks'] as $c) $o[$c['id']] = $c;
        return $o;
    };
    $c = $run([]);
    T::same(['ok', 'ok'], [$c['copia_cliente']['status'], $c['limite_pedidos']['status']], 'por defecto: copia con topes y límite de pedidos, ambos correctos');
    T::true(strpos($c['copia_cliente']['msg'], '2 por destinatario cada 24 h y 150 al día') !== false && strpos($c['limite_pedidos']['msg'], '120 pedidos por hora') !== false, 'y dicen los topes en vigor');
    T::true(!isset($c['cron_token']), 'sin cron_token no se comprueba');
    T::same(['ok', 'ok'], [$run(['order_copy' => 'off'])['copia_cliente']['status'], strpos($run(['order_copy' => 'off'])['copia_cliente']['msg'], 'desactivada') !== false ? 'ok' : 'mal'], 'order_copy = off: desactivada, sin problema');
    $c = $run(['order_copy' => 'banana']);
    T::true($c['copia_cliente']['status'] === 'warn' && strpos($c['copia_cliente']['msg'], 'banana') !== false && strpos($c['copia_cliente']['msg'], 'off') !== false, 'un valor de order_copy no válido avisa (se trata como off)');
    T::same('warn', $run(['order_copy_daily_max' => 'mucho'])['copia_cliente']['status'], 'order_copy_daily_max que no es un número: aviso');
    T::same('warn', $run(['order_copy_daily_max' => 5000])['copia_cliente']['status'], 'order_copy_daily_max muy alto: aviso');
    T::same('ok', $run(['order_copy_daily_max' => 300])['copia_cliente']['status'], 'order_copy_daily_max = 300: bien');
    T::same('warn', $run(['orders_per_hour_max' => 'x'])['limite_pedidos']['status'], 'orders_per_hour_max que no es un número: aviso');
    $c = $run(['admin_token' => 'corto', 'cron_token' => str_repeat('c', 10), 'session_secret' => 'CAMBIA-ESTO-por-una-cadena-aleatoria-de-32-o-mas-caracteres']);
    T::same(['fail', 'fail', 'fail'], [$c['token_maestro']['status'], $c['cron_token']['status'], $c['secreto']['status']], 'admin_token corto, cron_token corto y secreto de ejemplo: los tres en rojo');
    T::true(strpos($c['secreto']['msg'], 'valor de ejemplo') !== false && strpos($c['token_maestro']['msg'], 'admin_token tiene 5 caracteres') !== false && strpos($c['cron_token']['msg'], 'cron_token tiene 10 caracteres') !== false, 'con el nombre del ajuste y la longitud, no el valor');
    T::same(['ok', 'ok'], [$run(['cron_token' => str_repeat('c', 24)])['cron_token']['status'], $run(['admin_token' => str_repeat('m', 32)])['token_maestro']['status'] === 'warn' ? 'ok' : 'mal'], 'con las longitudes mínimas: cron_token correcto y admin_token solo avisa de que está activo');
}
