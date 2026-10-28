<?php
/**
 * Pruebas del formulario de contacto que de verdad funciona (Messages.php, Orders::handleContact y las rutas del panel): el mensaje se guarda SIEMPRE y el estado del correo es veraz;
 * GET/DELETE /messages, POST /mail/test, GET /mail/status y el bloque `mail` de /health; solo texto plano con límites; antispam por tiempo de relleno (`_e`) y sin secretos en ninguna respuesta.
 */
namespace Torivac\Tests;

use Torivac\Config;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Messages;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Contacto válido de ejemplo (se puede sobrescribir cualquier campo). */
function ms_contact(array $over = []): array { return $over + ['name' => 'Ana Pérez', 'email' => 'ana@acme.es', 'message' => 'Necesito 50 toroidales', 'lang' => 'es', 'privacy' => true]; }

/** POST /contact desde esa IP → Response. */
function ms_post(array $body, string $ip = '10.9.0.1'): \Torivac\Response { return Router::handle(req('POST', '/contact', $body, [], $ip)); }

/** Un gestor y un cliente con sesión → [token del gestor, token del cliente]. */
function ms_tokens(): array
{
    Users::create(['email' => 'jefa@torivac.test', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'ana.compras@acme.test', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    return [login_token('jefa@torivac.test', PW_JEFE, '10.9.9.1'), login_token('ana.compras@acme.test', PW_ANA, '10.9.9.2')];
}

/** Guarda `$n` mensajes de ejemplo, uno por minuto desde `$t0` (ms), y devuelve sus ids del más antiguo al más reciente. */
function ms_seed(int $n, int $t0 = 1793170800000): array
{
    $ids = [];
    for ($i = 0; $i < $n; $i++) {
        $rec = Messages::create(['name' => 'Persona ' . ($i + 1), 'email' => 'p' . ($i + 1) . '@acme.es', 'message' => 'Mensaje número ' . ($i + 1), 'lang' => 'es'], '203.0.113.' . ($i % 200 + 1), $t0 + $i * 60000);
        Messages::setEmailed($rec, ['sent' => true, 'reason' => 'sent']);
        $ids[] = $rec['id'];
    }
    return $ids;
}

/** M1 · El mensaje se guarda con todos los campos, 400 días de retención y contador propio, y la respuesta es { ok, id, emailed:{ sent, reason } } sin error. */
function test_contact_saves_message_and_reports_the_truth()
{
    fresh(['mail' => ['driver' => 'file']]);
    $r = ms_post(ms_contact());
    T::same(200, $r->status, 'contacto correcto');
    T::same(['ok', 'id', 'emailed'], array_keys($r->body), 'forma de la respuesta');
    T::same([true, ['sent' => true, 'reason' => 'sent']], [$r->body['ok'], $r->body['emailed']], 'correo enviado (outbox)');
    T::true(preg_match('/^CT-\d{8}-0001-[0-9A-Z]{3}$/', $r->body['id']) === 1, 'id CT-AAAAMMDD-NNNN-XXX: ' . $r->body['id']);
    $rec = Store::get('msg:' . $r->body['id']);
    T::same(['Ana Pérez', 'ana@acme.es', 'Necesito 50 toroidales', 'es', '10.9.0.1', ['sent' => true, 'reason' => 'sent']], [$rec['name'], $rec['email'], $rec['message'], $rec['lang'], $rec['ip'], $rec['emailed']], 'registro completo con la IP');
    $raw = json_decode((string) file_get_contents(Store::root() . '/kv/' . rawurlencode('msg:' . $r->body['id']) . '.json'), true);
    $ttl = $raw['x'] - time();
    T::true($ttl > 400 * 86400 - 60 && $ttl <= 400 * 86400, "retención de 400 días ($ttl s)");
    T::same(1, Store::get('counter:ct:' . gmdate('Ymd')), 'contador propio de los mensajes');
    T::true(Store::get('counter:' . gmdate('Ymd')) === null, 'sin tocar el de los pedidos');
    $out = outbox()[0];
    T::same(['info@grupotorivac.com', 'mzamora@torivac.com'], $out['to'], 'el correo va a los destinatarios del equipo');
    T::true(strpos($out['subject'], 'Contacto web · Ana Pérez') === 0 && $out['replyTo'] === 'ana@acme.es' && strpos($out['text'], $r->body['id']) !== false, 'con asunto, Reply-To y el id del mensaje');
    $r2 = ms_post(ms_contact(['name' => 'Luis']), '10.9.0.2');
    T::true(preg_match('/^CT-\d{8}-0002-[0-9A-Z]{3}$/', $r2->body['id']) === 1, 'el contador sube');
}

/** M1 · Si el correo falla, se omite o está apagado: 200 igualmente, el mensaje queda guardado y `reason` dice por qué (el detalle solo en el registro). */
function test_contact_email_status_failed_off_skipped()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    $calls = [];
    mt_http($calls, 403, '{"message":"The gmail.com domain is not verified."}');
    $r = ms_post(ms_contact());
    T::same([200, true, ['sent' => false, 'reason' => 'failed']], [$r->status, $r->body['ok'], $r->body['emailed']], 'Resend rechaza: 200 y failed, sin error en la respuesta pública');
    T::same(['sent' => false, 'reason' => 'failed', 'error' => 'Resend 403: The gmail.com domain is not verified.'], Store::get('msg:' . $r->body['id'])['emailed'], 'el registro guarda el error corto');
    $r = ms_post(ms_contact(), '10.9.0.2');
    T::same('failed', $r->body['emailed']['reason'], 'cada mensaje con su estado');
    fresh(['mail' => ['driver' => 'none', 'resend_api_key' => 're_test']]);
    $r = ms_post(ms_contact());
    T::same([200, ['sent' => false, 'reason' => 'off']], [$r->status, $r->body['emailed']], 'sin controlador: off');
    T::true(strpos(Store::get('msg:' . $r->body['id'])['emailed']['error'], 'mail.driver = none') !== false && Store::get('msg:' . $r->body['id'])['message'] === 'Necesito 50 toroidales', 'guardado igualmente');
    fresh(['mail' => ['driver' => 'resend']]);
    $r = ms_post(ms_contact());
    T::same(['sent' => false, 'reason' => 'skipped'], $r->body['emailed'], 'sin clave: skipped');
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test'], 'order_to' => ['info@grupotorivac.com', 'esto-no-es-un-correo']]);
    $calls = [];
    mt_http($calls, 200, '{"id":"m"}');
    $r = ms_post(ms_contact());
    T::same(['sent' => false, 'reason' => 'skipped'], $r->body['emailed'], 'un destinatario mal escrito en order_to impide el envío y se dice');
}

/** M1 · Si el almacén no deja guardar: 500 «No se pudo guardar el mensaje», se registra y NO se envía nada; nunca «recibido» de lo que no está guardado. */
function test_contact_not_saved_is_a_500_and_sends_nothing()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    $calls = [];
    mt_http($calls, 200, '{"id":"m"}');
    $kv = Store::root() . '/kv';
    rename($kv, $kv . '-roto');
    file_put_contents($kv, 'esto es un fichero, no una carpeta');                              // escribir en kv/ falla aunque se ejecute como root
    $log = tempnam(sys_get_temp_dir(), 'tv-log-');
    $prev = ini_set('error_log', $log);
    $r = ms_post(ms_contact());
    ini_set('error_log', (string) $prev);
    unlink($kv);
    rename($kv . '-roto', $kv);
    T::same([500, false, 'No se pudo guardar el mensaje'], [$r->status, $r->body['ok'], $r->body['error']], '500 con el texto acordado');
    T::same(0, count($calls), 'no se envió ningún correo');
    T::true(strpos((string) file_get_contents($log), '[contacto] No se pudo guardar') !== false, 'y queda en el registro del servidor');
    unlink($log);
    T::same(0, count(Store::names('msg:')), 'y no quedó ningún mensaje a medias');
}

/** M1 · Los límites y el antispam de siempre siguen: 6.º mensaje → 429 sin guardar; honeypot, campos no válidos, privacidad y Turnstile fallido → 400 sin guardar ni enviar. */
function test_contact_limits_and_antispam_still_apply()
{
    fresh(['mail' => ['driver' => 'file']]);
    $codes = [];
    for ($i = 0; $i < 6; $i++) $codes[] = ms_post(ms_contact(), '10.9.1.1')->status;
    T::same([200, 200, 200, 200, 200, 429], $codes, '5 por visitante cada 10 min');
    T::same(5, count(Store::names('msg:')), 'el 429 no guardó nada');
    T::same(5, count(outbox()), 'ni envió nada');
    $n = count(Store::names('msg:'));
    foreach ([['hp' => 'soy un bot'], ['name' => 'A'], ['email' => 'roto'], ['message' => 'ok'], ['privacy' => false], ['name' => ['a']], ['message' => 12], ['email' => ['x@y.es']]] as $i => $bad) {
        $r = ms_post(ms_contact($bad), '10.9.2.' . $i);
        T::same(400, $r->status, 'campo no válido ' . json_encode($bad));
    }
    T::same($n, count(Store::names('msg:')), 'nada guardado con datos no válidos');
    fresh(['mail' => ['driver' => 'file'], 'turnstile_secret' => 'ts-secreto']);
    Http::$mock = function () { return [200, '{"success":false}']; };
    $r = ms_post(ms_contact(['turnstileToken' => 'abc']));
    T::same([400, 'Verificación anti-spam fallida', 0, 0], [$r->status, $r->body['error'], count(Store::names('msg:')), count(outbox())], 'Turnstile fallido: ni guarda ni envía');
}

/** Texto plano y límites: etiquetas, scripts, SQL, plantillas, consola y rutas se rechazan con code y field; demasiado largo o con muchos enlaces también; nada se guarda ni se envía. */
function test_contact_plain_text_and_limits_over_the_api()
{
    fresh(['mail' => ['driver' => 'file']]);
    $hostile = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'javascript:alert(1)', "' OR '1'='1", '1; DROP TABLE users; --', '{{7*7}}', '${jndi:ldap://x.example/a}', '$(whoami)', 'foo; cat /etc/passwd', '../../../../etc/passwd', 'a=b;c=d;e=f;g=h;i=j;k=l'];
    $i = 0;
    foreach ($hostile as $h) {
        foreach (['name', 'message'] as $field) {
            $r = ms_post(ms_contact([$field => $field === 'name' ? 'Ana ' . $h : 'Hola. ' . $h]), '10.9.3.' . (++$i));
            T::same([400, 'plain_text', $field], [$r->status, $r->body['code'] ?? null, $r->body['field'] ?? null], "«{$h}» en $field");
        }
    }
    T::same(0, count(Store::names('msg:')) + count(outbox()), 'no se guardó ni se envió nada');
    $r = ms_post(ms_contact(['message' => str_repeat('a', 1001)]), '10.9.4.1');
    T::same([400, 'too_long', 'message'], [$r->status, $r->body['code'], $r->body['field']], '1001 caracteres → too_long');
    T::true(strpos($r->body['error'], '1000') !== false, 'y el error dice el máximo');
    T::same(200, ms_post(ms_contact(['message' => str_repeat('a', 1000)]), '10.9.4.2')->status, '1000 caracteres → bien');
    $r = ms_post(ms_contact(['name' => str_repeat('N', 81)]), '10.9.4.3');
    T::same([400, 'too_long', 'name'], [$r->status, $r->body['code'], $r->body['field']], 'nombre de 81 → too_long');
    $r = ms_post(ms_contact(['message' => 'mira https://a.example y http://b.example y www.c.example']), '10.9.4.4');
    T::same([400, 'too_many_links'], [$r->status, $r->body['code']], '3 enlaces → too_many_links');
    $r = ms_post(ms_contact(['message' => "Necesito 3 toroidales de 500 VA, 230V/2x24V (50-60Hz).\nSi V<Vn y I>In ¿qué protección? Precio < 50 € & envío 'urgente'; gracias \"de antemano\"."]), '10.9.4.5');
    T::same(200, $r->status, 'un mensaje técnico normal, con < > & \' " ; se acepta');
    $stored = Store::get('msg:' . $r->body['id']);
    T::true(strpos($stored['message'], "Precio < 50 € & envío 'urgente'; gracias \"de antemano\".") !== false, 'y se guarda tal cual (se escapa al mostrarlo)');
    $r = ms_post(ms_contact(['name' => "Eva\u{200B}  \t Gil", 'message' => "linea 1\r\n\r\n\r\n\r\nlinea 2   \t fin"]), '10.9.4.6');
    $stored = Store::get('msg:' . $r->body['id']);
    T::same(['Eva Gil', "linea 1\n\nlinea 2 fin"], [$stored['name'], $stored['message']], 'se guarda el texto NORMALIZADO (sin invisibles, espacios y líneas en blanco de más)');
}

/** Antispam por tiempo: con form_min_fill_ms = 1200 el cuerpo debe traer `_e` (entero ≥ 1200); sin él, con un número menor o con un texto → 400 too_fast. 0 lo desactiva. */
function test_contact_and_order_fill_time_check()
{
    fresh(['mail' => ['driver' => 'file'], 'form_min_fill_ms' => 1200]); seedPrices();
    $c = ms_contact();
    foreach ([[null, false], [0, false], [800, false], [1199, false], ['5000', false], [-5000, false], [[5000], false], [1200, true], [5000, true], [1500.0, true], [86400000 * 3, true]] as $i => [$e, $ok]) {
        $body = $e === null ? $c : $c + ['_e' => $e];
        $r = ms_post($body, '10.9.5.' . ($i + 1));
        T::same($ok ? 200 : [400, 'too_fast'], $ok ? $r->status : [$r->status, $r->body['code'] ?? null], '_e = ' . json_encode($e));
    }
    $b = goodOrder();
    $r = \Torivac\Orders::handleOrder(req('POST', '/order', $b, [], '10.9.6.1'), $b);
    T::same([400, 'too_fast'], [$r->status, $r->body['code'] ?? null], 'el pedido sin _e → too_fast');
    $b = goodOrder(['_e' => 4000]);
    T::same(200, \Torivac\Orders::handleOrder(req('POST', '/order', $b, [], '10.9.6.2'), $b)->status, 'el pedido con _e → bien');
    fresh(['mail' => ['driver' => 'file'], 'form_min_fill_ms' => 0]);
    T::same(200, ms_post($c, '10.9.7.1')->status, 'con form_min_fill_ms = 0 no se exige');
    fresh(['mail' => ['driver' => 'file']]);
    Config::set(['mail' => ['driver' => 'file']] + ['storage_dir' => Store::root(), 'session_secret' => SECRET]);
    T::same([400, 'too_fast'], [ms_post($c, '10.9.7.2')->status, ms_post($c, '10.9.7.3')->body['code']], 'por defecto (sin la clave) se exige: 1200');
}

/** Pedido: mismos límites de texto plano (nombre 80, empresa 120, teléfono 40, notas 500) y mismo 400 con code y field. */
function test_order_plain_text_and_limits_over_the_api()
{
    fresh(['mail' => ['driver' => 'file']]); seedPrices();
    $post = function (array $customer, string $ip) { $b = goodOrder(['customer' => $customer + goodOrder()['customer']]); return \Torivac\Orders::handleOrder(req('POST', '/order', $b, [], $ip), $b); };
    $i = 0;
    foreach (['name' => '<b>Ana</b>', 'company' => 'ACME <script>x</script>', 'phone' => 'javascript:alert(1)', 'notes' => "' OR '1'='1"] as $field => $bad) {
        $r = $post([$field => $bad], '10.9.8.' . (++$i));
        T::same([400, 'plain_text', $field], [$r->status, $r->body['code'] ?? null, $r->body['field'] ?? null], "$field con código");
    }
    foreach (['name' => 81, 'company' => 121, 'phone' => 41, 'notes' => 501] as $field => $len) {
        $r = $post([$field => str_repeat('x', $len)], '10.9.8.' . (++$i));
        T::same([400, 'too_long', $field], [$r->status, $r->body['code'] ?? null, $r->body['field'] ?? null], "$field de $len → too_long");
    }
    T::same(200, $post(['notes' => str_repeat('n ', 250)], '10.9.8.20')->status, 'notas de 500 → bien');
    T::same(0, count(Store::names('order:')) - 1, 'solo se guardó el pedido válido');
}

/** M2 · GET /messages: solo gestor (anónimo 401, cliente 403), más recientes primero, todos los campos, sin caché y límite acotado a 1..300 (100 por defecto). */
function test_messages_list_permissions_order_and_limit()
{
    fresh(); [$mgr, $cli] = ms_tokens();
    $ids = ms_seed(5);
    T::same(401, Router::handle(req('GET', '/messages'))->status, 'anónimo → 401');
    T::same(403, Router::handle(req('GET', '/messages', null, bearer($cli)))->status, 'cliente → 403');
    T::same(200, Router::handle(req('GET', '/messages', null, master()))->status, 'el token maestro vale');
    $r = Router::handle(req('GET', '/messages', null, bearer($mgr)));
    T::same([200, 'no-store', 'nosniff'], [$r->status, $r->headers['Cache-Control'], $r->headers['X-Content-Type-Options']], 'sin caché');
    T::same([true, false, array_reverse($ids)], [$r->body['ok'], $r->body['truncated'], array_map(function ($m) { return $m['id']; }, $r->body['items'])], 'más recientes primero');
    T::same(['at', 'email', 'emailed', 'id', 'ip', 'lang', 'message', 'name'], (function ($k) { sort($k); return $k; })(array_keys($r->body['items'][0])), 'todos los campos');
    $two = Router::handle(req('GET', '/messages?limit=2', null, bearer($mgr)));
    T::same([2, true, [$ids[4], $ids[3]]], [count($two->body['items']), $two->body['truncated'], array_map(function ($m) { return $m['id']; }, $two->body['items'])], 'limit=2');
    foreach (['limit=0' => 1, 'limit=-5' => 1, 'limit=abc' => 5, 'limit=' => 5, 'limit=1000' => 5, 'limit=1e9' => 5] as $q => $n) {
        $x = Router::handle(req('GET', '/messages?' . $q, null, bearer($mgr)));
        T::same([200, $n], [$x->status, count($x->body['items'])], $q);
    }
    ms_seed(130, 1793270800000);
    T::same([100, true], [count(Router::handle(req('GET', '/messages', null, bearer($mgr)))->body['items']), Router::handle(req('GET', '/messages', null, bearer($mgr)))->body['truncated']], 'por defecto 100 y truncated');
    T::same([135, false], [count(Router::handle(req('GET', '/messages?limit=300', null, bearer($mgr)))->body['items']), Router::handle(req('GET', '/messages?limit=300', null, bearer($mgr)))->body['truncated']], 'limit=300 → todos (135)');
}

/** M2 · Un registro corrupto se omite sin romper la lista y el hueco se rellena con el siguiente; un registro sin id válido tampoco vale. */
function test_messages_list_tolerates_corrupt_records()
{
    fresh(); [$mgr] = ms_tokens();
    $ids = ms_seed(4);
    file_put_contents(Store::root() . '/kv/' . rawurlencode('msg:' . $ids[2]) . '.json', '{esto no es json');
    Store::put('msg:CT-29991231-9999-ZZZ', ['id' => 'CT-29991231-9999-ZZZ']);                         // sin fecha
    Store::put('msg:CT-29991231-9998-ZZZ', ['id' => 'otro-id', 'at' => 'x']);                         // id sin forma
    $j = Router::handle(req('GET', '/messages?limit=3', null, bearer($mgr)))->body;
    T::same([true, [$ids[3], $ids[1], $ids[0]]], [$j['ok'], array_map(function ($m) { return $m['id']; }, $j['items'])], 'se salta los dañados y rellena hasta 3');
}

/** M2/M4 · El contenido del visitante es dato: se devuelve tal cual dentro del JSON, nunca como HTML ni con cabeceras. */
function test_messages_list_returns_visitor_text_as_data()
{
    fresh(['mail' => ['driver' => 'file']]); [$mgr] = ms_tokens();
    $rec = Messages::create(['name' => "Eva\r\nBcc: espia@evil.example", 'email' => 'e@x.es', 'message' => '<img src=x onerror=alert(1)> "comillas" & </script>', 'lang' => 'es'], '1.2.3.4');
    $r = Router::handle(req('GET', '/messages', null, bearer($mgr)));
    T::same('application/json; charset=utf-8', $r->headers['Content-Type'], 'JSON');
    T::same('<img src=x onerror=alert(1)> "comillas" & </script>', $r->body['items'][0]['message'], 'tal cual dentro del JSON');
    T::true(strpos(\Torivac\Util::enc($r->body), '</script>') !== false && $rec['id'] === $r->body['items'][0]['id'], 'y no se interpreta');
}

/** M2 · DELETE /messages/:id borra uno (derecho de supresión); 404 si no existe, ya se borró o el id no tiene forma de id; nunca alcanza otras claves; cliente 403. */
function test_messages_delete_and_cannot_reach_other_keys()
{
    fresh(); [$mgr, $cli] = ms_tokens();
    [$a, $b] = ms_seed(2);
    T::same(401, Router::handle(req('DELETE', "/messages/$a"))->status, 'anónimo → 401');
    T::same(403, Router::handle(req('DELETE', "/messages/$a", null, bearer($cli)))->status, 'cliente → 403');
    T::same(1, count(array_filter([Store::get("msg:$a")])), 'y no se borró');
    $r = Router::handle(req('DELETE', "/messages/$a", null, bearer($mgr)));
    T::same([200, ['ok' => true], null, true], [$r->status, $r->body, Store::get("msg:$a"), Store::get("msg:$b") !== null], 'borra uno');
    Store::put('prices:meta', ['x' => 1]); Store::put('order:TV-20261028-0001', ['x' => 1]);
    foreach ([$a, 'CT-20261028-9999-ZZZ', 'nada', '..%2F..%2Fprices%3Ameta', 'order%3ATV-20261028-0001', 'prices:meta', 'ct-20261028-0001-aaa', "$b%20", rawurlencode("$b/../x"), '%E0%A4%A'] as $id) {
        $x = Router::handle(req('DELETE', '/messages/' . $id, null, bearer($mgr)));
        T::same([404, false], [$x->status, $x->body['ok']], "404: $id");
    }
    T::true(Store::get('prices:meta') !== null && Store::get('order:TV-20261028-0001') !== null && Store::get("msg:$b") !== null, 'ninguna clave ajena se tocó');
}

/** M2 · POST /mail/test: envía «Torivac · prueba de correo» a los destinatarios del equipo o a `to`; 200 aunque falle (con el error corto); 400 si `to` no vale; 10 por hora y usuario; cliente 403. */
function test_mail_test_endpoint()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]); [$mgr, $cli] = ms_tokens();
    $calls = [];
    mt_http($calls, 200, '{"id":"m1"}');
    T::same(401, Router::handle(req('POST', '/mail/test', []))->status, 'anónimo → 401');
    T::same(403, Router::handle(req('POST', '/mail/test', [], bearer($cli)))->status, 'cliente → 403');
    T::same(0, count($calls), 'sin enviar nada a quien no puede');
    $r = Router::handle(req('POST', '/mail/test', [], bearer($mgr)));
    T::same([200, true, 'resend', ['info@grupotorivac.com', 'mzamora@torivac.com'], true, 'sent'], [$r->status, $r->body['ok'], $r->body['driver'], $r->body['to'], $r->body['sent'], $r->body['reason']], 'a los destinatarios del equipo');
    T::true(!isset($r->body['error']), 'sin error cuando sale bien');
    $c = $calls[0]['body'];
    T::true($c['subject'] === 'Torivac · prueba de correo' && strpos($c['text'], 'Si lees esto, el envío de correo de la web funciona.') !== false && strpos($c['text'], 'resend') !== false, 'asunto y texto fijos, y el controlador');
    $r = Router::handle(req('POST', '/mail/test', ['to' => 'prueba@mi-empresa.es'], bearer($mgr)));
    T::same(['prueba@mi-empresa.es'], [$r->body['to'][0]] , 'a `to`');
    T::same(200, Router::handle(req('POST', '/mail/test', null, bearer($mgr)))->status, 'sin cuerpo = destinatarios del equipo');
    foreach (['no-es-un-correo', 'a@b.es,c@d.es', "a@b.es\r\nBcc: x@y.es", ['a@b.es'], 123, str_repeat('x', 300) . '@a.es'] as $to) T::same(400, Router::handle(req('POST', '/mail/test', ['to' => $to], bearer($mgr)))->status, 'to inválido ' . json_encode($to));
    $n = count($calls);
    $bad = Router::handle(new \Torivac\Request()); unset($bad);
    $req = req('POST', '/mail/test', null, bearer($mgr)); $req->body = '[1,2]';
    T::same(400, Router::handle($req)->status, 'un cuerpo que es una lista');
    $req = req('POST', '/mail/test', null, bearer($mgr)); $req->body = '{no json';
    T::same(400, Router::handle($req)->status, 'un cuerpo que no es JSON');
    T::same($n, count($calls), 'los 400 no enviaron nada');
    mt_http($calls, 401, '{"message":"API key is invalid: re_test"}');
    $r = Router::handle(req('POST', '/mail/test', ['to' => 'a@b.es'], bearer($mgr)));
    T::same([200, false, false, 'failed'], [$r->status, $r->body['ok'], $r->body['sent'], $r->body['reason']], 'el proveedor falla: 200 con ok:false');
    T::true(strpos($r->body['error'], 'Resend 401: API key is invalid') === 0 && strpos($r->body['error'], 're_test') === false && strlen($r->body['error']) <= 160, 'con el error corto y sin la clave: ' . $r->body['error']);
    fresh(['mail' => ['driver' => 'none']]); [$mgr] = ms_tokens();
    $r = Router::handle(req('POST', '/mail/test', ['to' => 'a@b.es'], bearer($mgr)));
    T::same([false, 'off', true], [$r->body['ok'], $r->body['reason'], isset($r->body['error'])], 'sin controlador: off y por qué');
}

/** M2 · 10 pruebas por hora y usuario: la 11.ª es 429, otro gestor tiene su cupo. */
function test_mail_test_endpoint_rate_limit()
{
    fresh(['mail' => ['driver' => 'file']]); [$mgr] = ms_tokens();
    Users::create(['email' => 'segundo@torivac.test', 'name' => 'Segundo', 'role' => 'manager', 'password' => PW_JEFE]);
    $otro = login_token('segundo@torivac.test', PW_JEFE, '10.9.9.3');
    $codes = [];
    for ($i = 0; $i < 11; $i++) $codes[] = Router::handle(req('POST', '/mail/test', [], bearer($mgr)))->status;
    T::same(array_merge(array_fill(0, 10, 200), [429]), $codes, 'la 11.ª es 429');
    T::same(10, count(outbox()), 'la 11.ª no envió nada');
    T::same(200, Router::handle(req('POST', '/mail/test', [], bearer($otro)))->status, 'otro gestor tiene su cupo');
}

/** M2 · GET /mail/status: driver, configured, problems (nombres), last (null al principio; luego el último intento); cliente 403; sin secretos. */
function test_mail_status_endpoint_and_health()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]); [$mgr, $cli] = ms_tokens();
    T::same(401, Router::handle(req('GET', '/mail/status'))->status, 'anónimo → 401');
    T::same(403, Router::handle(req('GET', '/mail/status', null, bearer($cli)))->status, 'cliente → 403');
    T::same(['ok' => true, 'driver' => 'resend', 'configured' => true, 'problems' => [], 'last' => null], Router::handle(req('GET', '/mail/status', null, bearer($mgr)))->body, 'sin envíos todavía');
    $calls = [];
    mt_http($calls, 403, '{"message":"dominio sin verificar"}');
    ms_post(ms_contact(), '10.9.9.9');
    $s = Router::handle(req('GET', '/mail/status', null, bearer($mgr)))->body;
    T::same(['contact', false, 'failed', 'Resend 403: dominio sin verificar'], [$s['last']['kind'], $s['last']['ok'], $s['last']['reason'], $s['last']['error']], 'tras un contacto fallido');
    mt_http($calls, 200);
    Router::handle(req('POST', '/mail/test', [], bearer($mgr)));
    $s = Router::handle(req('GET', '/mail/status', null, bearer($mgr)))->body;
    T::same(['test', true, 'sent', false], [$s['last']['kind'], $s['last']['ok'], $s['last']['reason'], isset($s['last']['error'])], 'tras una prueba: solo el último, sin error');
    $h = Router::handle(req('GET', '/health'))->body;
    T::same(['driver' => 'resend', 'configured' => true, 'last' => ['at' => $s['last']['at'], 'kind' => 'test', 'ok' => true, 'reason' => 'sent']], $h['mail'], '/health (público) lleva el estado del correo');
    mt_http($calls, 401, '{"message":"clave re_test mala"}');
    Router::handle(req('POST', '/mail/test', [], bearer($mgr)));
    $h = Router::handle(req('GET', '/health'))->body;
    T::true(!isset($h['mail']['last']['error']) && strpos(json_encode($h), 'Resend 401') === false && strpos(json_encode($h), 're_test') === false, '/health nunca lleva el texto del error ni la clave');
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => '', 'smtp' => ['host' => '']], 'order_from' => 'esto no vale', 'order_to' => ['roto']]); [$mgr] = ms_tokens();
    $s = Router::handle(req('GET', '/mail/status', null, bearer($mgr)))->body;
    T::same([false, ['mail.resend_api_key', 'order_from', 'order_to']], [$s['configured'], $s['problems']], 'los problemas son NOMBRES de ajustes');
    T::true(strpos(json_encode($s), 'esto no vale') === false && strpos(json_encode($s), 'roto') === false, 'nunca los valores');
    $h = Router::handle(req('GET', '/health'))->body;
    T::true(in_array('order_from', $h['config']['problems'], true), '/health avisa por nombre de un order_from roto');
    fresh(['mail' => ['driver' => 'paloma']]);
    T::true(in_array('mail.driver', Router::handle(req('GET', '/health'))->body['config']['problems'], true), 'y de un mail.driver desconocido');
}

/** M4 · Con una clave «sk-SECRETO-123» configurada, no aparece en ninguna respuesta de los endpoints de correo ni en el almacén aunque el proveedor la repita. */
function test_mail_endpoints_never_leak_the_key()
{
    fresh(['mail' => ['driver' => 'brevo', 'brevo_api_key' => 'sk-SECRETO-123-abcdef']]); [$mgr] = ms_tokens();
    $calls = [];
    mt_http($calls, 401, json_encode(['message' => 'invalid token sk-SECRETO-123-abcdef (Bearer sk-SECRETO-123-abcdef)']));
    ms_post(ms_contact(), '10.9.9.8');
    $vistas = [json_encode(Router::handle(req('POST', '/mail/test', ['to' => 'a@b.es'], bearer($mgr)))->body)];
    foreach (['/messages', '/mail/status', '/health', '/diag'] as $p) $vistas[] = json_encode(Router::handle(req('GET', $p, null, bearer($mgr)))->body);
    foreach ($vistas as $v) T::true(strpos($v, 'SECRETO') === false, 'sin la clave: ' . substr($v, 0, 80));
    foreach (glob(Store::root() . '/kv/*.json') ?: [] as $f) T::true(strpos((string) file_get_contents($f), 'SECRETO') === false, 'ni en el almacén: ' . basename($f));
}

/** El diagnóstico avisa si los últimos mensajes de contacto se guardaron sin que saliera su aviso por correo. */
function test_diag_warns_about_messages_without_email()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    $calls = [];
    mt_http($calls, 403, '{"message":"x"}');
    ms_post(ms_contact(), '10.9.10.1'); ms_post(ms_contact(), '10.9.10.2');
    $ids = array_map(function ($c) { return $c['id']; }, \Torivac\Diag::run(false, '/nonexistent/config.php')['checks']);
    T::true(in_array('mensajes_sin_correo', $ids, true), 'aviso: 2 mensajes sin su correo');
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    mt_http($calls, 200);
    ms_post(ms_contact(), '10.9.10.3');
    $ids = array_map(function ($c) { return $c['id']; }, \Torivac\Diag::run(false, '/nonexistent/config.php')['checks']);
    T::true(!in_array('mensajes_sin_correo', $ids, true), 'y ninguno si todos salieron');
}
