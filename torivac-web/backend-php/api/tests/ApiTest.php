<?php
/** Pruebas del API en PHP: equivalen a workers/api/test/api.test.js + ai.test.js (sin red: Resend, Google y Anthropic se simulan con Http::$mock) */
namespace Torivac\Tests;

require_once __DIR__ . '/support.php';

use Torivac\Ai;
use Torivac\Auth;
use Torivac\Catalog;
use Torivac\Diag;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Orders;
use Torivac\Prices;
use Torivac\Router;
use Torivac\Sheets;
use Torivac\Store;
use Torivac\Users;
use Torivac\Util;

/** Sesión firmada: válida, manipulada y caducada; la contraseña se guarda con hash. */
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

/** Alta de usuarios, duplicados, login (sin el hash en la respuesta) y bloqueo tras varios intentos. */
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

/** Tramos por cantidad, importe de línea redondeado a 2 decimales y diferencias entre hojas de precios. */
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

/** Sincronización de la hoja en modo «replace» (la hoja sustituye a toda la lista): rechaza hojas con menos del 50 % de referencias o con precio de relleno salvo force; guarda el histórico. */
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
    T::throws(function () { Sheets::sync(['ctx' => [], 'mode' => 'replace']); }, '/rechazada/', 'hoja con < 50 % de referencias');
    $m2 = Sheets::sync(['ctx' => [], 'force' => true, 'mode' => 'replace']);
    T::same(1, $m2['refs'], 'force');
    T::same(1, count(Store::keys('prices:history:')), 'histórico: la primera carga no tiene anterior; la segunda guarda la primera');
    $rows = [['ref', 'price']];
    for ($i = 0; $i < 12; $i++) $rows[] = ["R$i", 22000];
    T::throws(function () use ($rows) { Sheets::sync(['rows' => $rows, 'ctx' => [], 'mode' => 'replace']); }, '/relleno/', 'precio de relleno');
    T::same(12, Sheets::sync(['rows' => $rows, 'ctx' => [], 'force' => true, 'mode' => 'replace'])['refs'], 'relleno con force');
}

/** Actualización parcial (modo por defecto): la hoja puede traer solo una parte del catálogo, reconocida por referencia, SKU o ID; precio 0 o active = 0 quitan el precio; lo demás se conserva. */
function test_partial_price_updates()
{
    fresh();
    seedPrices();                                                                       // TT0020210 (con tramos) y P16633
    $up = function ($body) { $r = Router::handle(req('POST', '/prices/upload', $body, master())); return $r; };
    $items = function () { return \Torivac\Prices::load()['items']; };
    // 1) hoja parcial: una referencia, el SKU de P16633 y un código nuevo de la familia TT; la fila define el precio entero de su referencia (los tramos de antes se van)
    $r = $up(['csv' => "ref;price\nTT0020210;13,5\naaaa00000001;70\nTT0030210;9\n"]);
    T::same([200, 'merge', 3, 2, 1], [$r->status, $r->body['meta']['mode'], $r->body['meta']['refs'], $r->body['meta']['changed'], $r->body['meta']['added']], 'parcial: total, cambian 2, nueva 1');
    T::same([13.5, null, 70, 9, 884], [$items()['TT0020210']['p'], $items()['TT0020210']['t'] ?? null, $items()['P16633']['p'], $items()['TT0030210']['p'], $items()['TT0030210']['pid']], 'precios por referencia, por SKU y por familia nueva');
    // 2) otra hoja parcial con una sola referencia: el resto no se toca
    $r = $up(['csv' => "ref;price\nTT0030210;9,5\n"]);
    T::same([3, 1, 2], [$r->body['meta']['refs'], $r->body['meta']['changed'], $r->body['meta']['kept']], 'la hoja trae 1 referencia: 3 en total, 1 cambia y 2 se conservan');
    T::same([13.5, 70, 9.5], [$items()['TT0020210']['p'], $items()['P16633']['p'], $items()['TT0030210']['p']], 'lo que no traía la hoja sigue igual');
    // 3) por ID de producto (sin columna de referencia): P16633 tiene línea genérica; el producto 1 tiene modelos (R100) y se rechaza con motivo
    $r = $up(['csv' => "ID;Precio\n16633;71\n1;5\n", 'dry_run' => true]);
    T::same([true, 1, ['ref' => 0, 'sku' => 0, 'id' => 1, 'rule' => 0], 'el producto tiene modelos: poner el precio en la referencia de cada modelo'], [$r->body['dry_run'], $r->body['refs'], $r->body['report']['stats']['by'], $r->body['report']['ignored'][0]['reason']], 'vista previa por ID');
    T::same(70, $items()['P16633']['p'], 'la vista previa no guarda nada');
    // 4) vista previa en los dos modos
    $m = $up(['csv' => "ref;price\nTT0020210;14\n", 'dry_run' => true, 'mode' => 'merge'])->body;
    T::same(['merge', 3, 2, false, [], 1], [$m['mode'], $m['total'], $m['kept'], $m['needs_force'], $m['diff']['removed'], count($m['diff']['changed'])], 'merge: se conservan 2, nada se quita, no exige confirmar');
    $rp = $up(['csv' => "ref;price\nTT0020210;14\n", 'dry_run' => true, 'mode' => 'replace'])->body;
    T::same(['replace', 1, 0, true, 2], [$rp['mode'], $rp['total'], $rp['kept'], $rp['needs_force'], count($rp['diff']['removed'])], 'replace: lo que no trae queda sin precio y hay que confirmar');
    T::same(409, $up(['csv' => "ref;price\nTT0020210;14\n", 'mode' => 'replace'])->status, 'replace sin confirmar se rechaza');
    T::same(3, count($items()), 'y no toca nada');
    // 5) quitar precios: precio 0 y active = 0 (lo que está vacío no toca nada)
    $r = $up(['csv' => "ref;price;active\nTT0030210;0;1\nP16633;5;0\nTT0020210;;1\n"]);
    T::same([1, 2, ['TT0020210']], [$r->body['meta']['refs'], $r->body['meta']['removed'], array_keys($items())], 'precio 0 y active=0 quitan el precio; precio vacío no toca nada');
    // 6) replace con confirmación: la hoja sustituye a todo
    $up(['csv' => "ref;price\nP16633;80\nTT0030210;8\n", 'mode' => 'replace', 'force' => true]);
    T::same(['P16633', 'TT0030210'], array_keys($items()), 'replace + force sustituye toda la lista');
    // 7) el modo por defecto se puede fijar en la configuración
    fresh(['prices' => ['update_mode' => 'replace']]);
    seedPrices();
    $r = Router::handle(req('POST', '/prices/upload', ['csv' => "ref;price\nTT0020210;14\n", 'force' => true], master()));
    T::same(['replace', ['TT0020210']], [$r->body['meta']['mode'], array_keys(\Torivac\Prices::load()['items'])], 'prices.update_mode = replace');
}

/** Cambio masivo: si más de la mitad de las referencias que ya tenían precio cambia más de un 40 %, la sincronización se rechaza salvo force (hoja equivocada, columna movida, otra unidad). */
function test_mass_price_change_guard()
{
    fresh();
    Catalog::set(['items' => [], 'skus' => [], 'rules' => []]);
    $rows = function ($price) { $r = [['ref', 'price']]; for ($i = 0; $i < 12; $i++) $r[] = ['R' . $i, $price + $i]; return $r; };
    Sheets::sync(['rows' => $rows(100), 'ctx' => []]);
    T::throws(function () use ($rows) { Sheets::sync(['rows' => $rows(300), 'ctx' => []]); }, '/cambia más de un 40 %/', 'precios x3 en todas las referencias');
    T::same(100.0, (float) \Torivac\Prices::load()['items']['R0']['p'], 'y no se aplicó');
    T::same(3, Sheets::sync(['rows' => $rows(103), 'ctx' => []])['changed'] > 0 ? 3 : 0, 'una subida normal (3 %) pasa');
    T::same(true, Sheets::sync(['rows' => $rows(300), 'ctx' => [], 'force' => true])['changed'] === 12, 'con force se aplica');
    $few = [['ref', 'price'], ['R0', 1], ['R1', 1]];
    T::same(2, Sheets::sync(['rows' => $few, 'ctx' => []])['changed'], 'con menos de 10 referencias coincidentes no se aplica la regla');
}

/** CSV con comillas, separadores dentro de comillas, BOM y separador coma o punto y coma. */
function test_csv_parser()
{
    T::same([['ref', 'name'], ['A;1', 'dice "hola"']], Sheets::parseCsv("ref;name\n\"A;1\";\"dice \"\"hola\"\"\"\n"), 'comillas');
    T::same([['a', 'b'], ['1', '2']], Sheets::parseCsv("\xEF\xBB\xBFa,b\r\n1,2\r\n"), 'BOM y coma');
}

/** Token de la cuenta de servicio de Google: firma RS256 verificable con la clave pública. */
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

/** Pedido: el servidor valora con sus precios (ignora los del cliente), numera, guarda y envía. */
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

/** Validación del pedido (campos, cantidades, referencias, PDF, honeypot) y límite por IP. */
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

/** Envío con Resend: destinatarios, copia al cliente, responder-a y PDF adjunto. */
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

/** Cuerpo MIME para mail(): texto y HTML, adjunto y cabeceras. */
function test_mime_builder()
{
    [$h, $b] = Mail::mime('Torivac <p@t.com>', ['to' => ['a@b.es'], 'subject' => 'x', 'html' => '<b>hola</b>', 'text' => 'hola', 'replyTo' => 'c@d.es', 'attachments' => [['filename' => 'TV 1.pdf', 'content' => 'JVBERi0xLjQK']]]);
    T::true(strpos($h, 'multipart/mixed') !== false && strpos($h, 'Reply-To: c@d.es') !== false, 'cabeceras');
    T::true(strpos($b, 'filename="TV_1.pdf"') !== false && strpos($b, 'text/html') !== false && strpos($b, 'JVBERi0xLjQK') !== false, 'cuerpo con adjunto');
}

/** Formulario de contacto y reglas CORS (origen ajeno, el propio sitio y preflight). */
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

/** GET /prices: precios públicos con ETag (304) y `items` como objeto {} aunque esté vacío. */
function test_prices_endpoint_etag()
{
    fresh(); seedPrices();
    $r = Router::handle(req('GET', '/prices'));
    T::same(true, isset($r->headers['ETag']) && wire($r)['prices']['items']['TT0020210']['p'] === 12.37, 'precios públicos');
    T::same(304, Router::handle(req('GET', '/prices', null, ['If-None-Match' => $r->headers['ETag']]))->status, 'ETag → 304');
    fresh();
    T::same(true, json_encode(Router::handle(req('GET', '/prices'))->body['prices']['items']) === '{}', 'sin precios: items es {} y no []');
}

/** Subida de hojas (vista previa y aplicar), permisos por rol, referencia nueva por regla de familia y cron por URL con token. */
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

/** Un manager ve todos los pedidos y cada cliente solo los suyos; alta y baja de usuarios por el API. */
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

/** Servidor de IA simulado: contesta con una propuesta de cambios de precios (uso de herramienta de Anthropic). */
function ai_reply(array $input): callable
{
    return function ($m, $u, $h, $b) use ($input) { return [200, json_encode(['content' => [['type' => 'tool_use', 'name' => Ai::TOOL, 'input' => $input]], 'usage' => ['input_tokens' => 1, 'output_tokens' => 1]])]; };
}

/** IA de precios: valida y limita lo que propone; la propuesta no escribe nada y solo se aplica lo confirmado. */
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

/** Autodiagnóstico: una instalación a medias da errores que dicen qué arreglar, y una completa pasa sin fallos. */
function test_diag_checks()
{
    fresh();
    $byId = function ($r) { $o = []; foreach ($r['checks'] as $c) $o[$c['id']] = $c['status']; return $o; };
    $r = Diag::run(false, '/no/existe/config.php');
    $s = $byId($r);
    T::same(['fail', 'fail', 'ok'], [$s['config'], $s['manager'], $s['datos']], 'sin config.php ni managers falla; la carpeta de pruebas es escribible');
    \Torivac\Config::set(['storage_dir' => Store::root(), 'session_secret' => 'CAMBIA-ESTO-por-una-cadena-aleatoria-de-32-o-mas-caracteres']);
    T::same('fail', $byId(Diag::run(false, __DIR__ . '/../config.sample.php'))['secreto'], 'el session_secret del ejemplo no vale');
    \Torivac\Config::set(['storage_dir' => Store::root(), 'session_secret' => str_repeat('a1b2', 10), 'order_to' => ['info@grupotorivac.com', 'mzamora@torivac.com'], 'mail' => ['driver' => 'resend', 'resend_api_key' => 're_test'], 'prices' => ['xlsx_url' => 'https://x.test/t.xlsx']]);
    Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => 'Jefe-Clave-2026!']);
    Store::put(Prices::KEY_META, ['at' => gmdate('c'), 'refs' => 9, 'source' => 'xlsx-url']);
    $ok = Diag::run(false, __DIR__ . '/../config.sample.php');
    $s = $byId($ok);
    T::same(0, $ok['fail'], 'instalación completa: ningún fallo');
    T::same(['ok', 'ok', 'ok', 'ok', 'ok'], [$s['destinatarios'], $s['correo'], $s['precios'], $s['sincronizacion'], $s['manager']], 'destinatarios, correo, precios, sincronización y manager');
    \Torivac\Config::set(['storage_dir' => Store::root(), 'session_secret' => str_repeat('a1b2', 10), 'order_to' => ['no-es-un-correo'], 'mail' => ['driver' => 'none']]);
    $s = $byId(Diag::run(false, __DIR__ . '/../config.sample.php'));
    T::same(['fail', 'fail', 'warn'], [$s['destinatarios'], $s['correo'], $s['precios']], 'correos mal escritos, sin envío y sin origen de precios');
    // por el API: solo managers
    fresh();
    T::same(401, Router::handle(req('GET', '/diag'))->status, 'sin sesión');
    $d = Router::handle(req('GET', '/diag', null, master()));
    T::same([200, true], [$d->status, isset($d->body['checks'][0]['msg'])], 'el manager lo ve');
}

/** GET /prices: el público no ve quién cargó la hoja ni el id de Drive; un manager sí; un usuario borrado pierde la sesión; el contacto escapa el HTML. */
function test_privacy_session_revocation_and_contact_escaping()
{
    fresh();
    \Torivac\Config::set(['prices' => ['csv_url' => 'https://sheet.test/x.csv'], 'storage_dir' => Store::root(), 'session_secret' => SECRET, 'admin_token' => 'token-maestro-123', 'allowed_origins' => [], 'order_to' => ['info@grupotorivac.com'], 'mail' => ['driver' => 'file']]);
    Users::create(['email' => 'jefa@torivac.com', 'name' => 'Jefa', 'role' => 'manager', 'password' => 'Manager-Clave-2026']);
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => 'Ana-Clave-2026!!']);
    $tok = function ($e, $p) { return Router::handle(req('POST', '/auth/login', ['email' => $e, 'password' => $p]))->body['token']; };
    $jefa = $tok('jefa@torivac.com', 'Manager-Clave-2026');
    $ana = $tok('ana@acme.es', 'Ana-Clave-2026!!');
    Router::handle(req('POST', '/prices/upload', ['csv' => SHEET], ['Authorization' => 'Bearer ' . $jefa]));
    $pub = Router::handle(req('GET', '/prices'));
    $pj = wire($pub);
    T::true(strpos(json_encode($pj), '@') === false && strpos(json_encode($pj), 'jefa') === false, 'ningún correo en la respuesta pública');
    T::same(['upload', 'upload', 'upload'], [$pj['meta']['reason'], $pj['meta']['source'], $pj['prices']['source']], 'origen sin datos personales');
    T::same([true, 'Authorization'], [strpos($pub->headers['Cache-Control'], 'public') !== false, $pub->headers['Vary']], 'caché pública y Vary');
    T::same(5.5, $pj['prices']['items']['R100']['p'], 'los precios siguen siendo públicos');
    $man = Router::handle(req('GET', '/prices', null, ['Authorization' => 'Bearer ' . $jefa]));
    T::same(['upload:jefa@torivac.com', true], [wire($man)['meta']['reason'], strpos($man->headers['Cache-Control'], 'no-store') !== false], 'el manager ve el detalle y no se cachea');
    T::true(strpos(json_encode(wire(Router::handle(req('GET', '/prices', null, ['Authorization' => 'Bearer ' . $ana])))), '@') === false, 'un cliente tampoco ve correos');
    // sesión de un usuario borrado
    T::same(200, Router::handle(req('GET', '/auth/me', null, ['Authorization' => 'Bearer ' . $ana]))->status, 'sesión válida');
    Router::handle(req('DELETE', '/users/ana%40acme.es', null, ['Authorization' => 'Bearer ' . $jefa]));
    T::same(401, Router::handle(req('GET', '/auth/me', null, ['Authorization' => 'Bearer ' . $ana]))->status, 'borrado → sin sesión');
    T::same(200, Router::handle(req('GET', '/users', null, master()))->status, 'el token maestro sigue funcionando');
    // contacto con HTML malicioso
    Router::handle(req('POST', '/contact', ['name' => '<b>Ana</b>', 'email' => 'a<img/src=x/onerror=1>@x.es', 'message' => "hola <script>alert(1)</script>\n& adiós", 'privacy' => true]));
    $mail = outbox()[0] ?? null;
    T::true($mail && !preg_match('/<(img|script)\b/i', $mail['html']) && strpos($mail['html'], '&lt;b&gt;Ana&lt;/b&gt;') !== false, 'sin etiquetas del visitante en el HTML del correo');
}

/** Cliente HTTP real contra un servidor local: sigue redirecciones de los GET a mano, no manda la credencial a otro servidor y corta los bucles. */
function test_http_client_follows_redirects_without_leaking_credentials()
{
    if (!function_exists('curl_init') || !function_exists('proc_open')) { fwrite(STDERR, "  · http: sin cURL o proc_open, se omite\n"); return; }
    $dir = sys_get_temp_dir() . '/tv-http-' . bin2hex(random_bytes(4));
    mkdir($dir);
    file_put_contents("$dir/r.php", '<?php
$p = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
if ($p === "/a") { header("Location: /b", true, 302); return true; }
if ($p === "/x") { header("Location: http://localhost:" . $_SERVER["SERVER_PORT"] . "/b", true, 302); return true; }
if ($p === "/loop") { header("Location: /loop", true, 302); return true; }
if ($p === "/b") { header("Content-Type: text/plain"); echo isset($_SERVER["HTTP_AUTHORIZATION"]) ? "con-credencial" : "sin-credencial"; return true; }
http_response_code(404);');
    $s = stream_socket_server('tcp://127.0.0.1:0');
    $port = (int) substr(stream_socket_get_name($s, false), strrpos(stream_socket_get_name($s, false), ':') + 1);
    fclose($s);
    putenv('NO_PROXY=127.0.0.1,localhost'); putenv('no_proxy=127.0.0.1,localhost');
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", "$dir/r.php"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $dir);
    try {
        for ($i = 0; $i < 50; $i++) { $c = @fsockopen('127.0.0.1', $port, $en, $es, 0.2); if ($c) { fclose($c); break; } usleep(100000); }
        $auth = ['Authorization: Bearer secreto'];
        T::same([200, 'con-credencial'], Http::request('GET', "http://127.0.0.1:$port/a", $auth, null, 5), 'mismo servidor: sigue la redirección y conserva la credencial');
        T::same([200, 'sin-credencial'], Http::request('GET', "http://127.0.0.1:$port/x", $auth, null, 5), 'otro servidor: sigue la redirección pero sin la credencial');
        T::same([0, ''], Http::request('GET', "http://127.0.0.1:$port/loop", [], null, 5), 'un bucle de redirecciones se corta');
        T::same(302, Http::request('POST', "http://127.0.0.1:$port/a", [], '{}', 5)[0], 'un POST no se redirige');
    } finally {
        proc_terminate($proc);
        proc_close($proc);
        @unlink("$dir/r.php");
        @rmdir($dir);
    }
}

/** El correo es parte del resultado: el pedido se guarda siempre y dice si el aviso salió; el contacto falla si el mensaje no pudo enviarse. */
function test_email_status_is_never_overstated()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    seedPrices();
    Http::$mock = function () { return [403, 'x']; };                                    // Resend rechaza (p. ej. dominio sin verificar)
    $b = goodOrder();
    $r = Orders::handleOrder(req('POST', '/order', $b, [], '10.7.7.7'), $b);
    T::same([true, false, false], [$r->body['ok'], $r->body['emailed']['team'], $r->body['emailed']['customer']], 'pedido ok pero sin correo');
    $rec = Store::get('order:' . $r->body['number']);
    T::same([false, 'Resend respondió 403', 'ana@acme.es'], [$rec['emailed']['team'], $rec['emailed']['error'], $rec['customer']['email']], 'el registro lo dice y el pedido está completo');
    Http::$mock = function () { return [200, '{"id":"m"}']; };
    $b2 = goodOrder();
    $r2 = Orders::handleOrder(req('POST', '/order', $b2, [], '10.7.7.8'), $b2);
    T::same([true, true, ''], [$r2->body['emailed']['team'], $r2->body['emailed']['customer'], Store::get('order:' . $r2->body['number'])['emailed']['error']], 'con correo: team y cliente, sin error');
    $c = ['name' => 'Ana', 'email' => 'ana@acme.es', 'message' => 'Necesito 50 toroidales', 'privacy' => true];
    T::same(200, Router::handle(req('POST', '/contact', $c, [], '10.7.7.9'))->status, 'contacto con correo');
    Http::$mock = function () { return [500, 'x']; };
    $bad = Router::handle(req('POST', '/contact', $c, [], '10.7.7.10'));
    T::same([502, false], [$bad->status, $bad->body['ok']], 'contacto sin correo → error (la web lo dice)');
    fresh(['mail' => ['driver' => 'none']]);
    $skip = Router::handle(req('POST', '/contact', $c, [], '10.7.7.11'));
    T::same([502, true], [$skip->status, strpos($skip->body['error'], 'no está configurado') !== false], 'sin correo configurado → error claro');
}

/** El autodiagnóstico avisa si los últimos pedidos se guardaron sin que saliera su aviso por correo. */
function test_diag_warns_about_orders_without_email()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    seedPrices();
    Http::$mock = function () { return [403, 'x']; };
    $b = goodOrder();
    Orders::handleOrder(req('POST', '/order', $b, [], '10.8.8.8'), $b);
    $ids = array_map(function ($c) { return $c['id']; }, array_filter(Diag::run()['checks'], function ($c) { return $c['status'] === 'warn'; }));
    T::true(in_array('pedidos_sin_correo', $ids, true), 'avisa de pedidos sin correo');
    fresh(['mail' => ['driver' => 'file']]);
    seedPrices();
    $b2 = goodOrder();
    Orders::handleOrder(req('POST', '/order', $b2, [], '10.8.8.9'), $b2);
    $ids2 = array_map(function ($c) { return $c['id']; }, Diag::run()['checks']);
    T::true(!in_array('pedidos_sin_correo', $ids2, true), 'sin aviso cuando salió');
}
