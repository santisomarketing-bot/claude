<?php
/** Pruebas del API en PHP: equivalen a workers/api/test/api.test.js + ai.test.js (sin red: Resend, Google y Anthropic se simulan con Http::$mock) */
namespace Torivac\Tests;

require_once __DIR__ . '/support.php';

use Torivac\Ai;
use Torivac\Auth;
use Torivac\Catalog;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Orders;
use Torivac\Prices;
use Torivac\Router;
use Torivac\Sheets;
use Torivac\Store;
use Torivac\Users;
use Torivac\Util;

function test_auth_sessions()
{
    fresh();
    $tok = Auth::signSession(['sub' => 'a@b.es', 'role' => 'manager', 'name' => 'A'], SECRET, 1000);
    T::same(['sub' => 'a@b.es', 'role' => 'manager', 'name' => 'A'], Auth::verifySession($tok, SECRET, 2000), 'sesión válida');
    T::same(null, Auth::verifySession($tok, SECRET, 1000 + Auth::TTL_MS + 1), 'caducada');
    T::same(null, Auth::verifySession($tok, 'otro-secreto-distinto-de-32-caracteres-xx', 2000), 'firma de otra clave');
    [$p, $s] = explode('.', $tok);
    T::same(null, Auth::verifySession(Util::b64url('{"sub":"a@b.es","role":"manager","exp":99999999999999}') . '.' . $s, SECRET, 2000), 'payload manipulado');
    $h = Auth::hashPassword('Clave-Segura-2026');
    T::true(Auth::verifyPassword('Clave-Segura-2026', $h) && !Auth::verifyPassword('otra', $h), 'contraseña');
}

function test_users_and_login()
{
    fresh();
    T::same(['error' => 'Correo no válido'], Users::create(['email' => 'x', 'role' => 'manager', 'password' => '1234567890']), 'correo');
    T::same(['error' => 'La contraseña necesita al menos 10 caracteres'], Users::create(['email' => 'a@b.es', 'role' => 'manager', 'password' => 'corta']), 'contraseña corta');
    $r = Users::create(['email' => 'Jefe@Torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => 'Jefe-Clave-2026!']);
    T::same('jefe@torivac.com', $r['user']['email'], 'correo en minúsculas');
    T::same(409, Users::create(['email' => 'jefe@torivac.com', 'role' => 'client', 'password' => 'Jefe-Clave-2026!'])['status'], 'duplicado');
    T::same(true, Users::check('jefe@torivac.com', 'Jefe-Clave-2026!') !== null && Users::check('jefe@torivac.com', 'mala') === null && Users::check('nadie@x.es', 'Jefe-Clave-2026!') === null, 'login');
    $l = Router::handle(req('POST', '/auth/login', ['email' => 'jefe@torivac.com', 'password' => 'Jefe-Clave-2026!']))->body;
    T::true($l['ok'] && isset($l['token']) && !isset($l['user']['hash']), 'login devuelve token y usuario sin hash');
    $me = Router::handle(req('GET', '/auth/me', null, ['Authorization' => 'Bearer ' . $l['token']]))->body;
    T::same('manager', $me['user']['role'], '/auth/me');
    for ($i = 0; $i < 7; $i++) $last = Router::handle(req('POST', '/auth/login', ['email' => 'jefe@torivac.com', 'password' => 'mala'], [], '10.9.9.9'));
    T::same(429, $last->status, 'límite de intentos');
}

function test_prices_tiers_and_rounding()
{
    $p = prices();
    T::same([12.37, 11.9, 11.9, 11.4, null], [Prices::unit($p, 'TT0020210', 1), Prices::unit($p, 'TT0020210', 10), Prices::unit($p, 'TT0020210', 49), Prices::unit($p, 'TT0020210', 50), Prices::unit($p, 'R100', 5)], 'tramos');
    $r = Prices::priceOrder($p, [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3], ['ref' => 'R100', 'qty' => 4]]);
    T::same([142.8, 202.95, 345.75, 1], [$r['lines'][0]['total'], $r['lines'][1]['total'], $r['total'], $r['unpriced']], 'importes (12 × 11,90 · 3 × 67,65)');
    $d = Prices::diff($p, ['items' => ['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]]], 'P16633' => ['p' => 67.65], 'R100' => ['p' => 5.5]]]);
    T::same(['R100'], $d['added'], 'diff: nuevas');
    T::same(2, $d['same'], 'diff: iguales');
}

function test_sheet_sync_rules()
{
    fresh();
    Http::$mock = function ($m, $u) { return [200, SHEET]; };
    \Torivac\Config::set(['prices' => ['csv_url' => 'https://sheet.test/x.csv']] + ['storage_dir' => Store::root(), 'session_secret' => SECRET]);
    Catalog::set(['items' => [], 'skus' => [], 'rules' => []]);
    $m1 = Sheets::sync(['reason' => 'test', 'ctx' => []]);
    T::same(3, $m1['refs'], 'refs publicadas');
    T::same(5.5, Prices::load()['items']['R100']['p'], 'precio');
    Http::$mock = function ($m, $u) { return [200, "ref;price\nR100;1\n"]; };
    T::throws(function () { Sheets::sync(['ctx' => []]); }, '/rechazada/', 'hoja con < 50 % de referencias');
    $m2 = Sheets::sync(['ctx' => [], 'force' => true]);
    T::same(1, $m2['refs'], 'force');
    T::same(1, count(Store::keys('prices:history:')), 'histórico: la primera carga no tiene anterior; la segunda guarda la primera');
    $rows = [['ref', 'price']];
    for ($i = 0; $i < 12; $i++) $rows[] = ["R$i", 22000];
    T::throws(function () use ($rows) { Sheets::sync(['rows' => $rows, 'ctx' => []]); }, '/relleno/', 'precio de relleno');
    T::same(12, Sheets::sync(['rows' => $rows, 'ctx' => [], 'force' => true])['refs'], 'relleno con force');
}

function test_csv_parser()
{
    T::same([['ref', 'name'], ['A;1', 'dice "hola"']], Sheets::parseCsv("ref;name\n\"A;1\";\"dice \"\"hola\"\"\"\n"), 'comillas');
    T::same([['a', 'b'], ['1', '2']], Sheets::parseCsv("\xEF\xBB\xBFa,b\r\n1,2\r\n"), 'BOM y coma');
}

function test_google_jwt()
{
    fresh();
    $k = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($k, $pem);
    $pub = openssl_pkey_get_details($k)['key'];
    $sa = ['client_email' => 'svc@proj.iam.gserviceaccount.com', 'private_key' => $pem];
    $assertion = null;
    Http::$mock = function ($m, $u, $h, $b) use (&$assertion) { parse_str($b, $f); $assertion = $f['assertion']; return [200, '{"access_token":"tok"}']; };
    T::same('tok', Sheets::accessToken($sa, 1800000000), 'token');
    [$h, $c, $s] = explode('.', $assertion);
    T::same(1, openssl_verify($h . '.' . $c, Util::unb64url($s), $pub, OPENSSL_ALGO_SHA256), 'firma RS256');
    T::same('svc@proj.iam.gserviceaccount.com', json_decode(Util::unb64url($c), true)['iss'], 'iss');
}

function test_order_flow_server_side_pricing()
{
    fresh(); seedPrices();
    $body = goodOrder(['pdf' => 'JVBERi0xLjQK', 'lines' => [['ref' => 'TT0020210', 'qty' => 12, 'unit' => 0.01, 'total' => 0.12], ['ref' => 'R100', 'qty' => 4]]]);
    $r = Orders::handleOrder(req('POST', '/order', $body), $body, null, 1793170800000);          // 2026-10-28T07:00Z
    T::same([200, 'TV-20261028-0001', 142.8, 1], [$r->status, $r->body['number'], $r->body['total'], $r->body['unpriced']], 'valora con los precios del servidor (ignora los del cliente)');
    $mails = outbox();
    usort($mails, function ($a, $b) { return count($b['to']) <=> count($a['to']); });
    T::same(['info@grupotorivac.com', 'mzamora@torivac.com'], $mails[0]['to'], 'equipo');
    T::same('ana@acme.es', $mails[0]['replyTo'], 'reply-to');
    T::same('TV-20261028-0001.pdf', $mails[0]['attachments'][0]['filename'], 'PDF adjunto');
    T::same(['ana@acme.es'], $mails[1]['to'], 'copia al cliente');
    $rec = Store::get('order:TV-20261028-0001');
    T::same([11.9, 142.8], [$rec['lines'][0]['unit'], $rec['total']], 'pedido guardado');
    $r2 = Orders::handleOrder(req('POST', '/order', $body), $body, null, 1793170860000);
    T::same('TV-20261028-0002', $r2->body['number'], 'numeración correlativa');
}

function test_order_validation_and_limits()
{
    fresh(); seedPrices();
    $bad = function ($o) { return Orders::handleOrder(req('POST', '/order', $o, [], '10.1.1.' . mt_rand(1, 200)), $o)->body['error'] ?? null; };
    T::same('Solicitud no válida', $bad(goodOrder(['hp' => 'bot'])), 'honeypot');
    T::same('Debes aceptar la política de privacidad', $bad(goodOrder(['customer' => ['name' => 'Ana', 'email' => 'a@b.es', 'privacy' => false]])), 'privacidad');
    T::same('Referencia desconocida: NOEXISTE', $bad(goodOrder(['lines' => [['ref' => 'NOEXISTE', 'qty' => 1]]])), 'referencia');
    T::same('Cantidad no válida para TT0020210', $bad(goodOrder(['lines' => [['ref' => 'TT0020210', 'qty' => 0]]])), 'cantidad 0');
    T::same('Cantidad no válida para TT0020210', $bad(goodOrder(['lines' => [['ref' => 'TT0020210', 'qty' => 1.5]]])), 'cantidad decimal');
    T::same('El presupuesto está vacío', $bad(goodOrder(['lines' => []])), 'vacío');
    T::same('PDF adjunto no válido', $bad(goodOrder(['pdf' => 'no-es-un-pdf'])), 'PDF');
    $last = null;
    for ($i = 0; $i < 9; $i++) $last = Orders::handleOrder(req('POST', '/order', null, [], '10.8.8.8'), goodOrder());
    T::same(429, $last->status, 'límite por IP');
}

function test_order_with_resend_driver()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]); seedPrices();
    $sent = [];
    Http::$mock = function ($m, $u, $h, $b) use (&$sent) { $sent[] = ['url' => $u, 'h' => $h, 'b' => json_decode($b, true)]; return [200, '{"id":"m' . count($sent) . '"}']; };
    $body = goodOrder(['pdf' => 'JVBERi0xLjQK']);
    $r = Orders::handleOrder(req('POST', '/order', $body), $body);
    T::same([true, true, false], [$r->body['emailed']['team'], $r->body['emailed']['customer'], $r->body['emailed']['skipped']], 'envío por Resend');
    T::same('https://api.resend.com/emails', $sent[0]['url'], 'URL');
    T::true(in_array('Authorization: Bearer re_test', $sent[0]['h'], true), 'clave');
    T::same(['info@grupotorivac.com', 'mzamora@torivac.com'], $sent[0]['b']['to'], 'destinatarios');
    T::same('Torivac Web <pedidos@grupotorivac.com>', $sent[0]['b']['from'], 'remitente');
    T::same('JVBERi0xLjQK', $sent[0]['b']['attachments'][0]['content'], 'adjunto');
    fresh(['mail' => ['driver' => 'none']]); seedPrices();
    $r = Orders::handleOrder(req('POST', '/order'), goodOrder());
    T::same([true, true], [$r->body['ok'], $r->body['emailed']['skipped']], 'sin controlador no falla: se guarda y se avisa');
}

function test_mime_builder()
{
    [$h, $b] = Mail::mime('Torivac <p@t.com>', ['to' => ['a@b.es'], 'subject' => 'x', 'html' => '<b>hola</b>', 'text' => 'hola', 'replyTo' => 'c@d.es', 'attachments' => [['filename' => 'TV 1.pdf', 'content' => 'JVBERi0xLjQK']]]);
    T::true(strpos($h, 'multipart/mixed') !== false && strpos($h, 'Reply-To: c@d.es') !== false, 'cabeceras');
    T::true(strpos($b, 'filename="TV_1.pdf"') !== false && strpos($b, 'text/html') !== false && strpos($b, 'JVBERi0xLjQK') !== false, 'cuerpo con adjunto');
}

function test_contact_and_cors()
{
    fresh();
    $c = ['name' => 'Luis', 'email' => 'l@x.es', 'message' => 'Quiero un toroidal de 500 VA', 'privacy' => true];
    $r = Router::handle(req('POST', '/contact', $c));
    T::same(true, $r->body['ok'], 'contacto');
    $m = outbox()[0];
    T::same(['info@grupotorivac.com', 'mzamora@torivac.com'], $m['to'], 'llega a info@ y mzamora@');
    $bad = Router::handle(req('GET', '/prices', null, ['Origin' => 'https://malo.example', 'Host' => 'api.test']));
    T::same(403, $bad->status, 'origen ajeno');
    $good = Router::handle(req('GET', '/prices', null, ['Origin' => 'https://demo.example', 'Host' => 'api.test']));
    T::same('https://demo.example', $good->headers['Access-Control-Allow-Origin'], 'origen permitido');
    $same = Router::handle(req('GET', '/prices', null, ['Origin' => 'https://web.torivac.test', 'Host' => 'web.torivac.test']));
    T::same(200, $same->status, 'el propio origen siempre puede');
    T::same(204, Router::handle(req('OPTIONS', '/order', null, ['Origin' => 'https://demo.example']))->status, 'preflight');
}

function test_prices_endpoint_etag()
{
    fresh(); seedPrices();
    $r = Router::handle(req('GET', '/prices'));
    T::same(true, isset($r->headers['ETag']) && wire($r)['prices']['items']['TT0020210']['p'] === 12.37, 'precios públicos');
    T::same(304, Router::handle(req('GET', '/prices', null, ['If-None-Match' => $r->headers['ETag']]))->status, 'ETag → 304');
    fresh();
    T::same(true, json_encode(Router::handle(req('GET', '/prices'))->body['prices']['items']) === '{}', 'sin precios: items es {} y no []');
}

function test_manager_upload_roles_and_cron()
{
    fresh(); seedPrices();
    $cli = Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => 'Ana-Clave-2026!!']);
    $tok = Router::handle(req('POST', '/auth/login', ['email' => 'ana@acme.es', 'password' => 'Ana-Clave-2026!!']))->body['token'];
    T::same(403, Router::handle(req('POST', '/prices/upload', ['csv' => SHEET], ['Authorization' => 'Bearer ' . $tok]))->status, 'cliente no sube precios');
    T::same(401, Router::handle(req('GET', '/orders'))->status, 'sin sesión');
    $dry = Router::handle(req('POST', '/prices/upload', ['csv' => SHEET, 'dry_run' => true], master()))->body;
    T::same([true, ['R100'], 'ref'], [$dry['dry_run'], $dry['diff']['added'], $dry['report']['columns']['ref']], 'vista previa con informe');
    T::same(3, Router::handle(req('POST', '/prices/upload', ['csv' => SHEET], master()))->body['meta']['refs'], 'aplicar');
    T::same(5.5, wire(Router::handle(req('GET', '/prices')))['prices']['items']['R100']['p'], 'publicado');
    T::same(400, Router::handle(req('POST', '/prices/upload', ['csv' => "a;b\n1;2\n"], master()))->status, 'hoja sin cabecera reconocible: 400');
    // tarifa con una referencia nueva por regla
    $csv = "Artículo,Descripción,Precio venta\nTT0099999,TRAFO TOROID 99VA,45.5\n";
    Router::handle(req('POST', '/prices/upload', ['csv' => $csv, 'force' => true], master()));
    $pub = wire(Router::handle(req('GET', '/prices')))['prices']['items']['TT0099999'];
    T::same(['p' => 45.5, 'pid' => 884, 'n' => 'TRAFO TOROID 99VA'], $pub, 'referencia nueva dentro de su producto');
    $ord = goodOrder(['lines' => [['ref' => 'TT0099999', 'qty' => 3]]]);
    T::same(136.5, Orders::handleOrder(req('POST', '/order', $ord, [], '10.5.5.5'), $ord)->body['total'], 'y se puede pedir');
    // cron por URL
    \Torivac\Config::set(['cron_token' => 'cron-secreto', 'prices' => ['csv_url' => 'https://sheet.test/x.csv'], 'storage_dir' => Store::root(), 'session_secret' => SECRET, 'mail' => ['driver' => 'file']]);
    Http::$mock = function () { return [200, "ref;price\nR100;9\nTT0020210;12\nP16633;60\n"]; };
    T::same(401, Router::handle(req('GET', '/cron'))->status, 'cron sin token');
    $q = req('GET', '/cron'); $q->query = ['token' => 'cron-secreto'];
    T::same(200, Router::handle($q)->status, 'cron con token');
}

function test_orders_visibility_and_users_api()
{
    fresh(); seedPrices();
    Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => 'Jefe-Clave-2026!']);
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => 'Ana-Clave-2026!!']);
    $b1 = goodOrder(); Orders::handleOrder(req('POST', '/order', $b1, [], '10.2.2.2'), $b1);
    $b2 = goodOrder(['customer' => ['name' => 'Otro', 'email' => 'otro@x.es', 'privacy' => true]]); Orders::handleOrder(req('POST', '/order', $b2, [], '10.3.3.3'), $b2);
    $tJ = Router::handle(req('POST', '/auth/login', ['email' => 'jefe@torivac.com', 'password' => 'Jefe-Clave-2026!']))->body['token'];
    $tA = Router::handle(req('POST', '/auth/login', ['email' => 'ana@acme.es', 'password' => 'Ana-Clave-2026!!']))->body['token'];
    T::same(2, count(Router::handle(req('GET', '/orders', null, ['Authorization' => 'Bearer ' . $tJ]))->body['orders']), 'el manager ve todos');
    T::same(1, count(Router::handle(req('GET', '/orders', null, ['Authorization' => 'Bearer ' . $tA]))->body['orders']), 'el cliente solo los suyos');
    T::same(201, Router::handle(req('POST', '/users', ['email' => 'nuevo@x.es', 'name' => 'N', 'role' => 'client', 'password' => 'Nueva-Clave-2026!'], ['Authorization' => 'Bearer ' . $tJ]))->status, 'alta de usuario');
    T::same(3, count(Router::handle(req('GET', '/users', null, ['Authorization' => 'Bearer ' . $tJ]))->body['users']), 'lista');
    Router::handle(req('DELETE', '/users/nuevo%40x.es', null, ['Authorization' => 'Bearer ' . $tJ]));
    T::same(2, count(Users::all()), 'baja de usuario');
    $st = Router::handle(req('POST', '/proposals/state', ['id' => 'PR-14834', 'state' => 'ok'], ['Authorization' => 'Bearer ' . $tJ]))->body;
    T::same('ok', $st['state']['PR-14834']['state'], 'aprobar propuesta');
    T::same(400, Router::handle(req('POST', '/proposals/state', ['id' => 'xx', 'state' => 'ok'], ['Authorization' => 'Bearer ' . $tJ]))->status, 'id no válido');
    Router::handle(req('POST', '/proposals/state', ['id' => 'PR-14834', 'state' => ''], ['Authorization' => 'Bearer ' . $tJ]));
    T::same('{}', json_encode(Router::handle(req('GET', '/proposals/state', null, ['Authorization' => 'Bearer ' . $tJ]))->body['state']), 'deshacer');
}

function ai_reply(array $input): callable
{
    return function ($m, $u, $h, $b) use ($input) { return [200, json_encode(['content' => [['type' => 'tool_use', 'name' => Ai::TOOL, 'input' => $input]], 'usage' => ['input_tokens' => 1, 'output_tokens' => 1]])]; };
}

function test_ai_validation_and_flow()
{
    fresh(['ai' => ['anthropic_api_key' => 'sk-test']]);
    Store::put(Prices::KEY_CURRENT, Prices::forJson(['updated_at' => 'x', 'source' => 'test', 'currency' => 'EUR', 'mode' => 'live', 'items' => ['P8339' => ['p' => 15.82, 't' => [[10, 15.1], [50, 14.4]]], 'P8340' => ['p' => 62.93], 'TT0020210' => ['p' => 49.95]]]));
    Catalog::set(['items' => ['P8339' => ['n' => 'Resistencias de frenado', 'pid' => 8339], 'P8340' => ['n' => 'Resistencias helicoidales', 'pid' => 8340], 'TT0020210' => ['n' => 'TT', 'pid' => 884]], 'skus' => [], 'rules' => []]);
    $v = Ai::validateChanges([['ref' => 'P8339', 'price' => 16.3, 'tiers' => [['qty' => 10, 'price' => 15.55], ['qty' => 50, 'price' => 14.83]]], ['ref' => 'NOEXISTE', 'price' => 1], ['ref' => 'P8340', 'price' => -4], ['ref' => 'P8340', 'price' => 70], ['ref' => 'TT0020210', 'price' => 49.95]], Prices::load(), Catalog::items());
    T::same(['P8339'], array_map(function ($c) { return $c['ref']; }, $v['changes']), 'solo cambios reales');
    $rej = array_map(function ($r) { return $r['ref'] . ':' . $r['why']; }, $v['rejected']); sort($rej);
    T::same(['NOEXISTE:la referencia no existe', 'P8340:precio no válido', 'P8340:repetida'], $rej, 'rechazadas');
    $big = Ai::validateChanges([['ref' => 'P8340', 'price' => 400], ['ref' => 'P8339', 'price' => 20]], Prices::load(), Catalog::items());
    T::same(true, $big['changes'][0]['large'], 'cambio grande');
    T::true((bool) array_filter($big['warnings'], function ($w) { return preg_match('/P8339.*tramos/', $w); }), 'aviso de tramos');
    // propuesta → no escribe → aplicar con confirmación
    Http::$mock = ai_reply(['summary' => 'Sube un 3 % las resistencias', 'changes' => [['ref' => 'P8339', 'price' => 16.2946], ['ref' => 'P8340', 'price' => 400]], 'warnings' => []]);
    $r = Router::handle(req('POST', '/prices/ai', ['instruction' => 'sube un 3 % las resistencias'], master()))->body;
    T::same([true, true, 2], [$r['ok'], $r['large'], count($r['changes'])], 'propuesta');
    T::same(15.82, Prices::load()['items']['P8339']['p'], 'la propuesta no escribe nada');
    $noConfirm = Router::handle(req('POST', '/prices/ai/apply', ['changes' => $r['changes']], master()));
    T::same(409, $noConfirm->status, 'sin confirmar el cambio grande se rechaza');
    $ok = Router::handle(req('POST', '/prices/ai/apply', ['changes' => $r['changes'], 'confirm_large' => true], master()))->body;
    T::same([true, 2], [$ok['ok'], $ok['applied']], 'aplicado');
    $cur = Prices::load();
    T::same([16.2946, 400.0], [$cur['items']['P8339']['p'], $cur['items']['P8340']['p']], 'nuevos precios');
    T::same('ia:master', $cur['source'], 'origen');
    T::true(count(Store::keys('prices:history:')) >= 1, 'histórico para volver atrás');
    // sin clave, instrucción corta, sin precios
    fresh();
    T::same(503, Router::handle(req('POST', '/prices/ai', ['instruction' => 'sube un 3 % las resistencias'], master()))->status, 'IA sin configurar');
    fresh(['ai' => ['anthropic_api_key' => 'sk']]);
    T::same(400, Router::handle(req('POST', '/prices/ai', ['instruction' => 'ok'], master()))->status, 'instrucción corta');
    T::same(409, Router::handle(req('POST', '/prices/ai', ['instruction' => 'sube un 3 % las resistencias'], master()))->status, 'sin precios cargados');
}
