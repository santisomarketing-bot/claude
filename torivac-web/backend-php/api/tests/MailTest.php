<?php
/**
 * Pruebas del correo (Mail.php): controladores y su elección, remitente, ajustes que faltan, Resend y Brevo con HTTP simulado (Http::$mock), último intento (mail:last), secretos
 * fuera de cualquier error y los correos de contacto y de prueba. El SMTP tiene sus pruebas en SmtpTest.php y los endpoints del panel en MessagesTest.php.
 */
namespace Torivac\Tests;

use Torivac\Config;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Store;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** mail.driver: resend, brevo, smtp, mail, file y none se reconocen (mayúsculas y espacios no importan); ausente = none; un valor desconocido falla cerrado como none y se avisa. */
function test_mail_driver_normalization()
{
    foreach (['resend', ' BREVO ', 'Smtp', 'mail', 'file', 'none'] as $v) { fresh(['mail' => ['driver' => $v]]); T::same([strtolower(trim($v)), false], [Mail::driver(), Mail::driverUnknown()], "driver «{$v}»"); }
    fresh(['mail' => []]);
    T::same(['none', false], [Mail::driver(), Mail::driverUnknown()], 'ausente = none, sin error');
    foreach (['paloma', 'sendgrid', ['resend'], 12] as $v) { fresh(['mail' => ['driver' => $v]]); T::same(['none', true], [Mail::driver(), Mail::driverUnknown()], 'desconocido «' . json_encode($v) . '» → none y se avisa'); }
    fresh(['mail' => ['driver' => 'paloma', 'resend_api_key' => 're_test']]);
    $r = Mail::send(mt_msg());
    T::same([false, 'off', true], [$r['ok'], $r['reason'], strpos($r['error'], 'mail.driver no válido') === 0], 'un driver desconocido no envía nada');
}

/** Remitente de order_from: «Nombre <correo>» o solo el correo; por defecto Torivac Web <pedidos@torivac.com>; cabeceras con salto, < > " \ o un correo roto no valen. */
function test_mail_sender_parsing()
{
    fresh(['order_from' => 'Torivac Web <pedidos@grupotorivac.com>']);
    $s = Mail::sender();
    T::same([true, 'Torivac Web', 'pedidos@grupotorivac.com', 'Torivac Web <pedidos@grupotorivac.com>'], [$s['ok'], $s['name'], $s['email'], $s['from']], 'nombre y correo');
    fresh(['order_from' => 'pedidos@grupotorivac.com']);
    T::same(['', 'pedidos@grupotorivac.com'], [Mail::sender()['name'], Mail::sender()['from']], 'solo el correo');
    fresh(['order_from' => '']);
    T::same('pedidos@torivac.com', Mail::sender()['email'], 'vacío = el remitente por defecto');
    fresh(['order_from' => 'Torivac, S.L. <a@b.es>']);
    T::same('"Torivac, S.L." <a@b.es>', Mail::sender()['from'], 'un nombre con coma va entre comillas');
    fresh(['order_from' => '"Torivac Web" <a@b.es>']);
    T::same('Torivac Web <a@b.es>', Mail::sender()['from'], 'comillas redundantes fuera');
    foreach (['esto no es un remitente', "Torivac <a@b.es>\r\nBcc: espia@evil.example", 'Tori<v>ac <a@b.es>', 'Tori"vac <a@b.es>', 'Tori\\vac <a@b.es>', str_repeat('x', 81) . ' <a@b.es>', 'Torivac <a@b>', "Tori\x00vac <a@b.es>", 'Torivac <a@b.es> extra'] as $bad) {
        fresh(['order_from' => $bad]);
        T::same(false, Mail::sender()['ok'], 'inválido: ' . json_encode($bad));
    }
    fresh(['order_from' => ['no', 'texto']]);
    T::same('pedidos@torivac.com', Mail::sender()['email'], 'si no es una cadena, el de por defecto');
}

/** Sin controlador, con credenciales incompletas, remitente roto o sin destinatarios válidos: nada se envía y reason dice por qué (off · skipped). */
function test_mail_blockers_and_problems()
{
    $calls = [];
    $cases = [
        [['driver' => 'none', 'resend_api_key' => 're_test'], [], 'off', 'mail.driver = none', []],
        [['driver' => 'resend'], [], 'skipped', 'Falta mail.resend_api_key', ['mail.resend_api_key']],
        [['driver' => 'resend', 'resend_api_key' => '   '], [], 'skipped', 'Falta mail.resend_api_key', ['mail.resend_api_key']],
        [['driver' => 'brevo', 'resend_api_key' => 're_test'], [], 'skipped', 'Falta mail.brevo_api_key', ['mail.brevo_api_key']],
        [['driver' => 'smtp'], [], 'skipped', 'Falta mail.smtp.host', ['mail.smtp.host']],
        [['driver' => 'smtp', 'smtp' => ['host' => 'localhost', 'user' => 'u']], [], 'skipped', 'Falta mail.smtp.pass', ['mail.smtp.pass']],
        [['driver' => 'smtp', 'smtp' => ['host' => 'localhost', 'secure' => 'raro']], [], 'sent_or_fail', null, ['mail.smtp.secure']],
        [['driver' => 'resend', 'resend_api_key' => 're_test'], ['order_from' => 'esto no vale'], 'skipped', 'order_from no válido', ['order_from']],
        [['driver' => 'resend', 'resend_api_key' => 're_test'], ['order_to' => []], 'skipped', 'Sin destinatarios', ['order_to']],
    ];
    foreach ($cases as [$mail, $extra, $reason, $needle, $problems]) {
        fresh(['mail' => $mail] + $extra);
        mt_http($calls);
        $before = count($calls);
        $to = array_key_exists('order_to', $extra) ? \Torivac\Orders::team() : ['info@grupotorivac.com'];
        $r = Mail::send(mt_msg(['to' => $to]));
        if ($reason === 'sent_or_fail') { T::true(in_array('mail.smtp.secure', Mail::problems(), true), 'secure absurdo: se avisa por nombre'); continue; }
        T::same([false, $reason, true], [$r['ok'], $r['reason'], !empty($r['skipped'])], 'bloqueado: ' . json_encode($mail));
        T::true(strpos($r['error'], $needle) !== false && strlen($r['error']) <= 160, 'dice por qué: ' . $r['error']);
        T::same($before, count($calls), 'no llama a ningún proveedor');
        foreach ($problems as $p) T::true(in_array($p, Mail::problems(), true), "problems() lleva «{$p}»");
        T::same(false, Mail::status()['configured'], 'y no está configurado');
    }
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    T::same([[], true, 'resend'], [Mail::problems(), Mail::status()['configured'], Mail::status()['driver']], 'todo bien: sin problemas y configured');
    foreach ([['a@b.es,c@d.es'], ["a@b.es\r\nBcc: x@y.es"], ['sin-arroba'], [''], [123]] as $to) {
        $r = Mail::send(mt_msg(['to' => $to]));
        T::same([false, 'skipped', 'Destinatario no válido'], [$r['ok'], $r['reason'], $r['error']], 'destinatario inválido ' . json_encode($to));
    }
    T::same(0, count($calls), 'ningún proveedor llamado con destinatarios inválidos');
}

/** Resend: POST /emails con la clave, cuerpo completo y errores cortos («Resend 403: …», «Resend respondió 500», «no se pudo conectar»). */
function test_mail_resend_request_and_errors()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    $calls = [];
    mt_http($calls, 200, '{"id":"abc123"}');
    $att = [['filename' => 'TV-1.pdf', 'content' => 'JVBERi0xLjQK']];
    $r = Mail::send(mt_msg(['attachments' => $att, 'cc' => ['cc@x.es']]), 'contact', 1793170800000);
    T::same([true, 'sent', 'abc123', 'resend'], [$r['ok'], $r['reason'], $r['id'], $r['driver']], 'envío correcto');
    $c = $calls[0];
    T::same(['POST', 'https://api.resend.com/emails'], [$c['method'], $c['url']], 'petición a Resend');
    T::true(in_array('Authorization: Bearer re_test', $c['headers'], true), 'con la clave en Authorization');
    T::same(['Torivac Web <pedidos@grupotorivac.com>', ['info@grupotorivac.com', 'mzamora@torivac.com'], 'Contacto web · Ana', 'ana@acme.es', ['cc@x.es'], $att], [$c['body']['from'], $c['body']['to'], $c['body']['subject'], $c['body']['reply_to'], $c['body']['cc'], $c['body']['attachments']], 'cuerpo');
    mt_http($calls, 403, '{"statusCode":403,"message":"The gmail.com domain is not verified.","name":"validation_error"}');
    $r = Mail::send(mt_msg());
    T::same([false, 'failed', 403, 'Resend 403: The gmail.com domain is not verified.'], [$r['ok'], $r['reason'], $r['status'], $r['error']], 'Resend rechaza con mensaje');
    mt_http($calls, 500, '<html>caído</html>');
    T::same('Resend respondió 500', Mail::send(mt_msg())['error'], 'sin mensaje del proveedor, solo el estado');
    mt_http($calls, 0, '');
    $r = Mail::send(mt_msg());
    T::same([false, 'failed', true], [$r['ok'], $r['reason'], strpos($r['error'], 'Resend: no se pudo conectar') === 0], 'sin respuesta de la red');
    mt_http($calls, 200, '{}', 'Resolving timed out');
    $r = Mail::send(mt_msg());
    T::same([false, 'failed', 'Resend: Resolving timed out'], [$r['ok'], $r['reason'], $r['error']], 'una excepción del cliente HTTP');
    mt_http($calls, 201, 'esto no es JSON');
    T::same([true, null], [Mail::send(mt_msg())['ok'], Mail::send(mt_msg())['id']], 'un 2xx sin JSON se acepta igualmente');
    $r = Mail::send(mt_msg(['replyTo' => 'no-es-un-correo', 'subject' => "Asunto\r\nBcc: espia@evil.example"]));
    $last = end($calls);
    T::true(!isset($last['body']['reply_to']) && strpos($last['body']['subject'], "\n") === false, 'un Reply-To roto se omite y el asunto va en una línea');
}

/** Brevo: POST /v3/smtp/email con api-key, sender, to, cc, replyTo, subject, htmlContent, textContent y attachment[{name, content}]; errores «Brevo <estado>: <mensaje ≤ 120>». */
function test_mail_brevo_request_and_errors()
{
    fresh(['mail' => ['driver' => 'brevo', 'brevo_api_key' => 'xkeysib-' . str_repeat('a', 40), 'resend_api_key' => 're_test']]);
    $calls = [];
    mt_http($calls, 201, '{"messageId":"<m1@smtp-relay.mailin.fr>"}');
    $r = Mail::send(mt_msg(['attachments' => [['filename' => 'TV-1.pdf', 'content' => 'JVBERi0xLjQK']], 'cc' => ['cc@x.es']]), 'order');
    T::same([true, 'sent', '<m1@smtp-relay.mailin.fr>', 'brevo'], [$r['ok'], $r['reason'], $r['id'], $r['driver']], 'envío correcto con Brevo');
    $c = $calls[0];
    T::same(['POST', 'https://api.brevo.com/v3/smtp/email'], [$c['method'], $c['url']], 'a la API de Brevo');
    T::true(in_array('api-key: xkeysib-' . str_repeat('a', 40), $c['headers'], true) && in_array('accept: application/json', $c['headers'], true) && in_array('Content-Type: application/json', $c['headers'], true), 'cabeceras api-key, accept y Content-Type');
    T::same([['name' => 'Torivac Web', 'email' => 'pedidos@grupotorivac.com'], [['email' => 'info@grupotorivac.com'], ['email' => 'mzamora@torivac.com']], [['email' => 'cc@x.es']], ['email' => 'ana@acme.es'], 'Contacto web · Ana', '<p>Hola</p>', 'Hola', [['name' => 'TV-1.pdf', 'content' => 'JVBERi0xLjQK']]],
        [$c['body']['sender'], $c['body']['to'], $c['body']['cc'], $c['body']['replyTo'], $c['body']['subject'], $c['body']['htmlContent'], $c['body']['textContent'], $c['body']['attachment']], 'cuerpo de Brevo');
    mt_http($calls, 401, '{"code":"unauthorized","message":"Key not found"}');
    $r = Mail::send(mt_msg());
    T::same([false, 'failed', 'Brevo 401: Key not found'], [$r['ok'], $r['reason'], $r['error']], 'Brevo rechaza la clave');
    mt_http($calls, 400, json_encode(['code' => 'invalid_parameter', 'message' => str_repeat('mensaje largo ', 30)]));
    $err = Mail::send(mt_msg())['error'];
    T::true(strpos($err, 'Brevo 400: mensaje largo') === 0 && strlen($err) <= 160 && strlen($err) > 100, 'el mensaje se recorta a 120 caracteres: ' . strlen($err));
    mt_http($calls, 400, '');
    T::same('Brevo respondió 400', Mail::send(mt_msg())['error'], 'sin cuerpo, solo el estado');
    fresh(['order_from' => 'pedidos@grupotorivac.com', 'mail' => ['driver' => 'brevo', 'brevo_api_key' => 'xkeysib-' . str_repeat('b', 40)]]);
    mt_http($calls, 201, '{"messageId":"x"}');
    Mail::send(mt_msg(['replyTo' => '']));
    $last = end($calls);
    T::same([['email' => 'pedidos@grupotorivac.com'], false], [$last['body']['sender'], isset($last['body']['replyTo'])], 'remitente sin nombre y sin replyTo cuando no lo hay');
}

/** Ninguna clave sale en ningún error ni en el último intento, aunque el proveedor la repita: «sk-SECRETO-123» configurada como clave no aparece en ninguna parte. */
function test_mail_secrets_never_leak()
{
    foreach ([['resend', 'resend_api_key', 'Resend'], ['brevo', 'brevo_api_key', 'Brevo']] as [$drv, $field, $name]) {
        fresh(['mail' => ['driver' => $drv, $field => 'sk-SECRETO-123-abcdef'], 'session_secret' => SECRET]);
        $calls = [];
        mt_http($calls, 401, json_encode(['message' => 'invalid token sk-SECRETO-123-abcdef (Bearer sk-SECRETO-123-abcdef) y ' . SECRET]));
        $r = Mail::send(mt_msg(), 'test');
        T::true(strpos(json_encode($r), 'SECRETO') === false && strpos(json_encode($r), SECRET) === false, "$name: ni en la respuesta de send()");
        T::true(strpos(json_encode(Mail::last()), 'SECRETO') === false && strpos(json_encode(Mail::last()), SECRET) === false, "$name: ni en mail:last");
        mt_http($calls, 200, '{}', 'fallo con la clave sk-SECRETO-123-abcdef dentro');
        $r = Mail::send(mt_msg());
        T::true(strpos(json_encode($r), 'SECRETO') === false, "$name: ni en una excepción del cliente HTTP");
        foreach (glob(Store::root() . '/kv/*.json') ?: [] as $f) T::true(strpos((string) file_get_contents($f), 'SECRETO') === false, "$name: ni en el almacén (" . basename($f) . ')');
    }
    fresh(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => 'h.example', 'user' => 'usuario-secreto', 'pass' => 'clave-secreta-larga']], 'admin_token' => MASTER_TOKEN]);
    T::same('Fallo con *** y ***: Bearer ***', Mail::scrub('Fallo con usuario-secreto y clave-secreta-larga: Bearer abcdef123456'), 'scrub tacha usuario, contraseña y Bearer');
    T::same('api-key: ***', Mail::scrub('api-key: xkeysib-' . str_repeat('z', 30)), 'scrub tacha api-key');
    T::same('token=***', Mail::scrub('token=' . str_repeat('A', 40)), 'y token=');
    T::same('algo ***', Mail::scrub('algo ' . str_repeat('Q', 40)), 'y las cadenas opacas de 32 o más');
    T::same(10, mb_strlen(Mail::scrub(str_repeat('ab ', 30), 10)), 'y recorta');
    T::same("una linea", Mail::scrub("una\r\nlinea"), 'y deja una sola línea');
}

/** mail:last se anota en CADA envío (pedido, copia, contacto, prueba), solo el último, con el tipo, la hora y el motivo; también el fallido, el omitido y el de un controlador apagado. */
function test_mail_last_attempt_is_recorded_on_every_send()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    T::same(null, Mail::last(), 'al principio no hay ninguno');
    $calls = [];
    mt_http($calls, 200);
    Mail::send(mt_msg(), 'order', 1793170800000);
    T::same(['at' => '2026-10-28T07:00:00.000Z', 'kind' => 'order', 'ok' => true, 'reason' => 'sent'], Mail::last(), 'tras un pedido');
    mt_http($calls, 403, '{"message":"dominio sin verificar"}');
    Mail::send(mt_msg(), 'contact', 1793170860000);
    T::same(['at' => '2026-10-28T07:01:00.000Z', 'kind' => 'contact', 'ok' => false, 'reason' => 'failed', 'error' => 'Resend 403: dominio sin verificar'], Mail::last(), 'tras un contacto fallido (solo el último)');
    Mail::send(mt_msg(['to' => ['roto']]), 'test', 1793170920000);
    T::same(['test', false, 'skipped', 'Destinatario no válido'], [Mail::last()['kind'], Mail::last()['ok'], Mail::last()['reason'], Mail::last()['error']], 'tras una prueba omitida');
    fresh(['mail' => ['driver' => 'none']]);
    Mail::send(mt_msg(), 'order');
    T::same([false, 'off'], [Mail::last()['ok'], Mail::last()['reason']], 'también con el controlador apagado');
    Store::put(Mail::KEY_LAST, ['at' => 'x']);
    T::same(null, Mail::last(), 'un registro dañado se ignora');
    T::true(strpos(json_encode(Mail::last()), '@') === false, 'sin datos del visitante');
    fresh(['mail' => ['driver' => 'file']]);
    $r = Mail::send(mt_msg(), 'contact');
    T::same([true, 'sent', 'file'], [$r['ok'], $r['reason'], $r['driver']], 'controlador file: guarda en outbox');
    $ob = outbox()[0];
    T::true(!isset($ob['cc']) && $ob['replyTo'] === 'ana@acme.es' && $ob['from'] === 'Torivac Web <pedidos@grupotorivac.com>', 'outbox: sin campos vacíos y con el remitente');
}

/** Correo de un mensaje de contacto para el equipo: asunto en una línea, todo lo del visitante escapado en el HTML y completo en el texto; y el correo de prueba del panel. */
function test_mail_contact_and_test_composers()
{
    fresh();
    $rec = ['id' => 'CT-20261028-0001-AB1', 'name' => "Eva\r\nBcc: espia@evil.example", 'email' => 'eva@acme.es', 'lang' => 'fr', 'message' => "hola <script>alert(1)</script>\n& \"adiós\""];
    $m = Mail::contactMail($rec);
    T::same('Contacto web · Eva Bcc: espia@evil.example', $m['subject'], 'asunto de una sola línea');
    T::true(strpos($m['html'], '<script>') === false && strpos($m['html'], '&lt;script&gt;alert(1)&lt;/script&gt;') !== false && strpos($m['html'], '&amp; &quot;adiós&quot;') !== false, 'HTML escapado');
    T::true(strpos($m['html'], 'hola &lt;script&gt;') !== false && strpos($m['html'], '<br>') !== false, 'con los saltos de línea');
    foreach (['Eva', 'eva@acme.es', 'Idioma: fr', 'CT-20261028-0001-AB1', '<script>alert(1)</script>'] as $s) T::true(strpos($m['text'], $s) !== false, "el texto lleva «{$s}»");
    $t = Mail::testMail('smtp', '2026-10-28T10:00:00.000Z');
    T::same('Torivac · prueba de correo', $t['subject'], 'asunto de la prueba');
    T::true(strpos($t['text'], 'Si lees esto, el envío de correo de la web funciona.') !== false && strpos($t['text'], 'smtp') !== false && strpos($t['html'], '2026-10-28T10:00:00.000Z') !== false, 'texto fijo, controlador y hora');
    $x = Mail::testMail("sm<tp>", 'a"b');
    T::true(strpos($x['html'], '<tp>') === false, 'y también escapa lo que no es fijo');
}

/** Diag::mail: avisa según el controlador (none, mail(), file, SMTP sin verificar…) y según el resultado del último envío real. */
function test_diag_mail_checks()
{
    $by = function (array $checks) { $o = []; foreach ($checks as $c) $o[$c['id']] = $c; return $o; };
    $run = function (array $cfg) use ($by) { fresh($cfg); return $by(\Torivac\Diag::mail(Mail::status())); };
    T::same('fail', $run(['mail' => ['driver' => 'none']])['correo']['status'], 'none → rojo');
    T::same('fail', $run(['mail' => ['driver' => 'paloma']])['correo']['status'], 'desconocido → rojo');
    T::same('fail', $run(['mail' => ['driver' => 'resend']])['correo']['status'], 'resend sin clave → rojo');
    T::same('fail', $run(['mail' => ['driver' => 'brevo']])['correo']['status'], 'brevo sin clave → rojo');
    T::same('fail', $run(['mail' => ['driver' => 'smtp']])['correo']['status'], 'smtp sin servidor → rojo');
    T::same('fail', $run(['mail' => ['driver' => 'resend', 'resend_api_key' => 'x'], 'order_from' => 'roto'])['correo']['status'], 'order_from roto → rojo');
    T::same('ok', $run(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']])['correo']['status'], 'resend con clave → verde');
    T::same('ok', $run(['mail' => ['driver' => 'brevo', 'brevo_api_key' => 'xkeysib-1']])['correo']['status'], 'brevo con clave → verde');
    $c = $run(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => 'mail.midominio.com', 'port' => 587, 'secure' => 'tls']]]);
    T::same(['ok', true], [$c['correo']['status'], strpos($c['correo']['msg'], 'mail.midominio.com:587') !== false], 'smtp → verde con servidor y puerto');
    $c = $run(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => 'localhost', 'insecure_tls' => true]]]);
    T::same('warn', $c['correo_tls']['status'], 'insecure_tls → aviso');
    $c = $run(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => 'smtp.remoto.example', 'secure' => 'none']]]);
    T::same('warn', $c['correo_cifrado']['status'], 'sin cifrar a un servidor remoto → aviso');
    $c = $run(['mail' => ['driver' => 'mail']]);
    T::same(['warn', true], [$c['correo']['status'], strpos($c['correo']['msg'], 'NO garantiza') !== false], 'mail() → aviso: no garantiza la entrega');
    T::same('warn', $run(['mail' => ['driver' => 'file']])['correo']['status'], 'file → aviso: no se envía');
    $c = $run(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]);
    T::same('warn', $c['correo_ultimo']['status'], 'sin ningún envío todavía → aviso: haz una prueba');
    $calls = [];
    mt_http($calls, 403, '{"message":"dominio sin verificar"}');
    Mail::send(mt_msg(), 'contact', 1793170800000);
    $c = $by(\Torivac\Diag::mail(Mail::status()));
    T::same(['warn', true], [$c['correo_ultimo']['status'], strpos($c['correo_ultimo']['msg'], 'FALLÓ') !== false && strpos($c['correo_ultimo']['msg'], 'dominio sin verificar') !== false], 'el último envío falló → aviso con el motivo');
    mt_http($calls, 200);
    Mail::send(mt_msg(), 'test');
    T::same('ok', $by(\Torivac\Diag::mail(Mail::status()))['correo_ultimo']['status'], 'el último envío salió bien → verde');
}
