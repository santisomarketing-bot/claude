<?php
/**
 * Pruebas de seguridad de los pedidos y del contacto (informe del revisor del PHP: A1, A9, A13 · decisiones D1 y D7). Cada hallazgo reproduce el ataque del informe y comprueba
 * que ya no funciona, y que lo legítimo sigue funcionando. Sin red ni servidor web (el correo es el controlador «file» o un Http::$mock).
 */
namespace Torivac\Tests;

require_once __DIR__ . '/support.php';

use Torivac\Ai;
use Torivac\Catalog;
use Torivac\Diag;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Orders;
use Torivac\PriceSheet;
use Torivac\Prices;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

/** El correo guardado en la bandeja de salida cuyo destinatario es `$to` (o null). */
function so_mail_to(array $to): ?array
{
    foreach (outbox() as $m) { if (($m['to'] ?? null) === $to) return $m; }
    return null;
}

/** Ejecuta `$fn` y devuelve los avisos y notas de PHP que haya provocado (deben ser ninguno). */
function so_warnings(callable $fn): array
{
    $w = [];
    set_error_handler(function ($no, $str) use (&$w) { $w[] = $str; return true; });
    try { $fn(); } finally { restore_error_handler(); }
    return $w;
}

/** A1 · La copia al cliente solo lleva contenido del servidor: nada de lo que escribió el visitante y SIN adjunto; el PDF y los datos del visitante solo van al equipo. */
function test_a1_copy_to_customer_has_only_server_text_and_no_attachment()
{
    fresh(); seedPrices();
    $pdf = base64_encode("%PDF-1.4\n% pdf escrito por el atacante\n");
    $b = goodOrder(['customer' => so_customer(['name' => 'Soporte Banco X', 'company' => 'Banco Falso S.A.', 'email' => 'victima@tercero.example', 'phone' => '+34 600 111 222', 'notes' => 'Su cuenta está bloqueada, verifique en http://phishing.example/login (importe < 50 € & envío)']), 'pdf' => $pdf]);
    $r = so_post($b, '203.0.113.9', 1793170800000);
    T::same([200, true, true, false, 'sent'], [$r->status, $r->body['emailed']['team'], $r->body['emailed']['customer'], $r->body['emailed']['skipped'], $r->body['emailed']['customer_reason']], 'pedido aceptado y copia enviada');
    $copy = so_mail_to(['victima@tercero.example']);
    $team = so_mail_to(['info@grupotorivac.com', 'mzamora@torivac.com']);
    T::true($copy !== null && $team !== null, 'salen dos correos: el del equipo y la copia');
    $all = $copy['subject'] . "\n" . $copy['html'] . "\n" . $copy['text'];
    foreach (['Soporte Banco', 'Banco Falso', 'phishing', '600 111 222', 'bloqueada', 'victima@tercero.example', 'Banco X'] as $needle) T::true(stripos($all, $needle) === false, "la copia no lleva «{$needle}»");
    T::same('Torivac · copia de tu presupuesto TV-20261028-0001', $copy['subject'], 'asunto fijo con el número de pedido');
    T::true(empty($copy['attachments']) && !isset($copy['replyTo']) && !isset($copy['cc']), 'la copia va sin adjunto, sin responder-a y sin copia oculta');
    foreach (['TT0020210', 'Transformador serie TT 20 VA', 'P16633', 'Variador portátil', '345,75', 'TV-20261028-0001', 'Si no has pedido tú este presupuesto, ignora este mensaje.'] as $must) T::true(strpos($copy['text'], $must) !== false, "la copia lleva «{$must}»");
    T::true(strpos($copy['html'], 'Si no has pedido tú este presupuesto, ignora este mensaje.') !== false, 'y la línea de «ignora este mensaje» también en el HTML');
    T::same(['TV-20261028-0001.pdf', $pdf], [$team['attachments'][0]['filename'], $team['attachments'][0]['content']], 'el PDF solo va al equipo');
    T::true(strpos($team['text'], 'phishing.example') !== false && strpos($team['html'], 'importe &lt; 50 € &amp; envío') !== false, 'al equipo sí le llega lo que escribió el visitante (escapado en el HTML)');
    T::true(strpos($team['text'], Mail::PDF_NOTE) !== false && strpos($team['html'], 'El PDF adjunto lo ha generado el navegador del cliente') !== false, 'y el correo al equipo avisa de que el PDF lo fabricó el navegador');
    $rec = Store::get('order:TV-20261028-0001');
    T::same([200, 'sent', 'Soporte Banco X'], [$r->status, $rec['emailed']['customer_reason'], $rec['customer']['name']], 'el pedido queda guardado con lo que escribió el visitante');
    $h = Orders::handleOrder(req('POST', '/order', goodOrder(['customer' => so_customer(['name' => 'Soporte Banco <b>X</b>'])]), [], '10.8.8.9'), goodOrder(['customer' => so_customer(['name' => 'Soporte Banco <b>X</b>'])]));
    T::same([400, 'plain_text', 'name'], [$h->status, $h->body['code'] ?? null, $h->body['field'] ?? null], 'y una etiqueta HTML en el nombre ya ni se acepta: solo texto plano');
}

/** A1 · El texto fijo de la copia sale en el idioma del pedido (es, en, fr, de) y el asunto es siempre el mismo. */
function test_d1_copy_text_follows_the_order_language()
{
    fresh(); seedPrices();
    $bye = ['es' => 'Si no has pedido tú este presupuesto, ignora este mensaje.', 'en' => 'If you did not request this quote, please ignore this message.', 'fr' => 'Si vous n’avez pas demandé ce devis, ignorez ce message.', 'de' => 'Wenn Sie dieses Angebot nicht angefordert haben, ignorieren Sie diese Nachricht bitte.'];
    $money = ['es' => '345,75', 'en' => '€345.75', 'fr' => '345,75', 'de' => '345,75'];
    foreach ($bye as $lang => $line) {
        $email = "cliente-$lang@acme.es";
        $r = so_post(goodOrder(['customer' => so_customer(['email' => $email]), 'lang' => $lang]));
        $copy = so_mail_to([$email]);
        T::true($copy !== null && strpos($copy['text'], $line) !== false && strpos($copy['html'], $line) !== false, "$lang: la línea de «ignora este mensaje» en su idioma");
        T::true(strpos($copy['text'], $money[$lang]) !== false, "$lang: el total con el formato de su idioma");
        T::same('Torivac · copia de tu presupuesto ' . $r->body['number'], $copy['subject'], "$lang: el asunto es fijo");
    }
    $en = so_mail_to(['cliente-en@acme.es']);
    T::true(strpos($en['text'], 'Copy of your quote') !== false && strpos($en['text'], 'Amount') === false && strpos($en['html'], '>Amount<') !== false, 'inglés: título y columnas en inglés');
    $unk = so_post(goodOrder(['customer' => so_customer(['email' => 'raro@acme.es']), 'lang' => 'xx']));
    T::true(strpos(so_mail_to(['raro@acme.es'])['text'], $bye['es']) !== false && $unk->status === 200, 'un idioma desconocido cae en castellano');
}

/** A1 · El PDF del visitante se valida de verdad (base64 estricto, %PDF-, ≤ 4 MB) y se reenvía normalizado, solo al equipo. */
function test_a1_pdf_is_validated_and_normalized()
{
    fresh(); seedPrices();
    $pdf = "%PDF-1.4\n" . str_repeat('contenido de prueba ', 20);
    $bad = [
        'JVBERi0xLjQK<<<no es un PDF>>>' => 'caracteres que no son base64',
        base64_encode('hola, esto no es un pdf ni de lejos') => 'base64 válido pero no empieza por %PDF-',
        'JVBERi0xLjQK!!!' => 'relleno con signos',
        'JVBERi0xLjQ==' => 'relleno de más',
        '=JVBERi0xLjQK' => 'relleno al principio',
        'JVBER' => 'demasiado corto',
        'JVBERi0x LjQK' => 'un espacio en medio',
        'JVBERi0x%PDF' => 'símbolos fuera del alfabeto',
        str_repeat('A', 5400000) => 'más larga de lo que cabe en 4 MB',
        base64_encode('%PDF-' . str_repeat('x', 4000000 - 4)) => 'decodificado pasa de 4 MB (4 000 001 bytes)',
    ];
    foreach ($bad as $v => $why) {
        $r = so_post(goodOrder(['pdf' => $v]));
        T::same([400, 'PDF adjunto no válido'], [$r->status, $r->body['error'] ?? null], "se rechaza: $why");
    }
    foreach ([['x'], 123, true, (object) []] as $v) T::same(400, so_post(goodOrder(['pdf' => $v]))->status, 'un PDF que no es una cadena (' . gettype($v) . ') se rechaza');
    T::same([], outbox(), 'y de los rechazados no sale ningún correo');
    T::same([], Store::keys('order:'), 'ni se guarda ningún pedido');
    // lo legítimo
    $r = so_post(goodOrder(['pdf' => chunk_split(base64_encode($pdf), 76, "\r\n")]));
    T::same(200, $r->status, 'un PDF en base64 con saltos de línea cada 76 caracteres vale');
    $team = so_mail_to(['info@grupotorivac.com', 'mzamora@torivac.com']);
    T::same(base64_encode($pdf), $team['attachments'][0]['content'], 'y se envía normalizado: una sola línea, sin \\r\\n');
    $exact = '%PDF-' . str_repeat('x', 4000000 - 5);
    T::same(200, so_post(goodOrder(['customer' => so_customer(['email' => 'otro@acme.es']), 'pdf' => base64_encode($exact)]))->status, 'un PDF de exactamente 4 000 000 bytes vale');
    $none = so_post(goodOrder(['customer' => so_customer(['email' => 'sin-pdf@acme.es'])]));
    T::same(200, $none->status, 'sin PDF el pedido vale');
    foreach (outbox() as $m) { if (($m['to'] ?? []) === ['sin-pdf@acme.es']) T::true(empty($m['attachments']), 'la copia, sin adjunto'); elseif (isset($m['subject']) && strpos($m['subject'], $none->body['number']) !== false) T::true(empty($m['attachments']) && strpos($m['text'], 'El PDF adjunto') === false, 'sin PDF, el correo al equipo no habla de ningún PDF'); }
    foreach (['', null, false] as $v) T::same(200, so_post(goodOrder(['customer' => so_customer(['email' => 'vacio' . strlen((string) $v) . '@acme.es']), 'pdf' => $v]))->status, 'pdf vacío o nulo = sin PDF');
}

/** D1 · order_copy: capped por defecto, off y cualquier otro valor = no se envía copia (falla cerrado); copy:false y correo sin configurar también tienen su motivo. */
function test_d1_copy_mode_off_unknown_values_and_reasons()
{
    $reason = function (array $cfg, array $over = []) {
        fresh($cfg); seedPrices();
        $r = so_post(goodOrder($over));
        return [$r->body['emailed']['customer_reason'], $r->body['emailed']['customer'], count(array_filter(outbox(), function ($m) { return ($m['to'] ?? []) === ['ana@acme.es']; }))];
    };
    T::same(['sent', true, 1], $reason([]), 'sin order_copy: capped (se envía)');
    T::same(['sent', true, 1], $reason(['order_copy' => 'capped']), 'capped');
    T::same(['off', false, 0], $reason(['order_copy' => 'off']), 'off: nunca se envía copia');
    foreach (['CAPPED', 'Capped', ' capped', 'capped ', "\tcapped\n"] as $v) T::same(['sent', true, 1], $reason(['order_copy' => $v]), '«' . json_encode($v) . '» se reconoce como capped (sin importar mayúsculas ni espacios)');
    foreach (['on', 'true', 'OFF', '', 'none', 'yes', 'all', 'capped,x', 'cap', 'capped2', 1, true, false, 0, ['capped']] as $v) T::same(['off', false, 0], $reason(['order_copy' => $v]), 'valor no reconocido «' . json_encode($v) . '» = off (falla cerrado)');
    T::same(['not_requested', false, 0], $reason([], ['copy' => false]), 'copy:false → not_requested');
    T::same(['sent', true, 1], $reason([], ['copy' => true]), 'copy:true se envía');
    T::same(['sent', true, 1], $reason([], ['copy' => 'no']), 'solo copy:false (booleano) la quita');
    T::same(['not_requested', false, 0], $reason(['order_copy' => 'off'], ['copy' => false]), 'si el visitante no la pidió, el motivo es not_requested aunque order_copy sea off');
    T::same(['skipped', false, 0], $reason(['mail' => ['driver' => 'none']]), 'correo sin configurar → skipped');
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]); seedPrices();
    Http::$mock = function () { return [403, 'x']; };
    $r = so_post(goodOrder());
    T::same([true, false, false, 'failed'], [$r->body['ok'], $r->body['emailed']['team'], $r->body['emailed']['customer'], $r->body['emailed']['customer_reason']], 'Resend rechaza → failed (el pedido se guarda igual)');
    T::same('failed', Store::get('order:' . $r->body['number'])['emailed']['customer_reason'], 'y el registro del pedido lo dice');
    Http::$mock = function () { return [200, '{"id":"m"}']; };
    $ok = so_post(goodOrder(['customer' => so_customer(['email' => 'nuevo@acme.es'])]));
    T::same(['sent', true], [$ok->body['emailed']['customer_reason'], $ok->body['emailed']['customer']], 'con Resend bien → sent');
    $keys = array_keys($ok->body['emailed']); sort($keys);
    T::same(['customer', 'customer_reason', 'skipped', 'team'], $keys, 'la respuesta lleva exactamente team, customer, skipped y customer_reason (sin el error)');
}

/** D1 · Topes de la copia: 2 por destinatario cada 24 h (clave = sha256 del correo) y `order_copy_daily_max` al día en total; superado un tope, el pedido y el aviso al equipo salen igual. */
function test_d1_copy_caps_per_recipient_and_per_day()
{
    fresh(); seedPrices();
    $t0 = 1793170800000;                                                                  // 2026-10-28T07:00Z
    $go = function ($email, $now) { return so_post(goodOrder(['customer' => so_customer(['email' => $email])]), null, $now); };
    $r1 = $go('ana@acme.es', $t0); $r2 = $go('ANA@acme.es', $t0 + 60000); $r3 = $go('ana@acme.es', $t0 + 120000);
    T::same(['sent', 'sent', 'limit'], [$r1->body['emailed']['customer_reason'], $r2->body['emailed']['customer_reason'], $r3->body['emailed']['customer_reason']], 'la 3.ª copia al mismo destinatario (aunque cambie la mayúscula) no sale');
    T::same([200, true, false, true], [$r3->status, $r3->body['ok'], $r3->body['emailed']['customer'], $r3->body['emailed']['team']], 'pero el pedido se registra y el equipo recibe su aviso');
    T::true(Store::get('order:' . $r3->body['number']) !== null, 'el pedido está guardado');
    $toAna = array_filter(outbox(), function ($m) { return ($m['to'] ?? []) === ['ana@acme.es']; });
    T::same(2, count($toAna), 'a ana@acme.es solo llegaron 2 copias');
    T::same('sent', $go('otra@acme.es', $t0 + 180000)->body['emailed']['customer_reason'], 'otro destinatario no se ve afectado');
    T::same('limit', $go('ana@acme.es', $t0 + 23 * 3600000)->body['emailed']['customer_reason'], 'a las 23 h sigue el tope');
    T::same('sent', $go('ana@acme.es', $t0 + 25 * 3600000)->body['emailed']['customer_reason'], 'pasadas 24 h vuelve a salir');
    // la clave guarda el sha256 del correo, nunca el correo
    $files = kv_files('rl%3Acopyto%3A');
    $want = 'rl%3Acopyto%3A' . substr(hash('sha256', 'ana@acme.es'), 0, 32) . '.json';
    T::true(in_array($want, $files, true), 'clave = rl:copyto:<sha256 del correo en minúsculas>');
    foreach ($files as $f) T::true(preg_match('/^rl%3Acopyto%3A[0-9a-f]{32}\.json$/', $f) === 1 && stripos($f, 'acme') === false && strpos($f, '%40') === false, "el nombre del fichero no lleva el correo: $f");
    // tope diario en total
    fresh(['order_copy_daily_max' => 2]); seedPrices();
    $a = $go('a1@acme.es', $t0); $b = $go('a2@acme.es', $t0 + 1000); $c = $go('a3@acme.es', $t0 + 2000);
    T::same(['sent', 'sent', 'limit'], [$a->body['emailed']['customer_reason'], $b->body['emailed']['customer_reason'], $c->body['emailed']['customer_reason']], 'order_copy_daily_max = 2: la 3.ª copia del día, a quien sea, no sale');
    T::same([true, true], [$c->body['ok'], $c->body['emailed']['team']], 'el pedido y el aviso al equipo salen igual');
    T::same('sent', $go('a4@acme.es', $t0 + 25 * 3600000)->body['emailed']['customer_reason'], 'y al día siguiente vuelve a haber cupo');
    fresh(['order_copy_daily_max' => 0]); seedPrices();
    T::same('limit', $go('a1@acme.es', $t0)->body['emailed']['customer_reason'], 'order_copy_daily_max = 0 → ninguna copia');
    fresh(['order_copy_daily_max' => 'mucho']); seedPrices();
    T::same('sent', $go('a1@acme.es', $t0)->body['emailed']['customer_reason'], 'un valor que no es un número vale el tope por defecto (150)');
    T::same(150, Orders::copyDailyMax(), 'por defecto 150');
}

/** D1 · Tope global de pedidos por hora (orders_per_hour_max, 120 por defecto): 429 y no se guarda nada; solo cuentan los pedidos válidos. */
function test_d1_global_orders_per_hour_cap()
{
    fresh(['orders_per_hour_max' => 2]); seedPrices();
    $t0 = 1793170800000;
    T::same(400, so_post(goodOrder(['lines' => []]), null, $t0)->status, 'un pedido no válido (400)…');
    T::same(400, so_post(goodOrder(['customer' => so_customer(['email' => 'x'])]), null, $t0)->status, '…y otro…');
    T::same([200, 200], [so_post(goodOrder(), null, $t0 + 1000)->status, so_post(goodOrder(), null, $t0 + 2000)->status], '…no gastan el cupo: los 2 válidos pasan');
    $r = so_post(goodOrder(), null, $t0 + 3000);
    T::same([429, 'Demasiados pedidos seguidos. Inténtalo en unos minutos.'], [$r->status, $r->body['error'] ?? null], 'el 3.º pedido de la hora, de quien sea, recibe 429');
    T::same(2, count(Store::keys('order:')), 'y no se guarda');
    T::same(200, so_post(goodOrder(), null, $t0 + 3601000)->status, 'pasada la hora vuelve a admitir pedidos');
    fresh(); seedPrices();
    T::same(120, Orders::ordersPerHourMax(), 'por defecto 120 pedidos por hora');
    fresh(['orders_per_hour_max' => 'x']);
    T::same(120, Orders::ordersPerHourMax(), 'un valor que no es un número vale 120');
}

/** A13 · Los campos de una línea no admiten saltos de línea ni controles (asunto del correo al equipo); las notas conservan los saltos pero no los controles raros. */
function test_a13_single_line_fields_and_notes_are_cleaned()
{
    fresh(); seedPrices();
    $b = goodOrder(['customer' => so_customer(['name' => "Juan\r\nBcc: espia@evil.test\r\nX-Inyectado: si", 'company' => "ACME\r\nContent-Type: text/html", 'phone' => "1\t2\r\nSubject: hola", 'email' => "Ana@Acme.ES",
        'notes' => "linea1\r\nlinea2\x00\x07\x1b[31m rojo\u{202E}\u{2028}fin\ttab"])]);
    $r = so_post($b, null, 1793170800000);
    $rec = Store::get('order:' . $r->body['number']);
    T::same(['Juan Bcc: espia@evil.test X-Inyectado: si', 'ACME Content-Type: text/html', '1 2 Subject: hola', 'ana@acme.es'], [$rec['customer']['name'], $rec['customer']['company'], $rec['customer']['phone'], $rec['customer']['email']], 'sin saltos de línea ni tabuladores');
    T::same("linea1\nlinea2[31m rojofin tab", $rec['customer']['notes'], 'las notas conservan los saltos de línea; los tabuladores pasan a un espacio y se quitan los demás controles y los separadores de línea Unicode');
    $team = so_mail_to(['info@grupotorivac.com', 'mzamora@torivac.com']);
    T::true(preg_match('/[\r\n]/', $team['subject']) === 0 && $team['subject'] === '[Web Torivac] Pedido ' . $r->body['number'] . ' · Juan Bcc: espia@evil.test X-Inyectado: si', 'el asunto del correo al equipo es de una sola línea');
    T::same('ana@acme.es', $team['replyTo'], 'responder-a limpio');
    // la capa de correo es la última defensa: un asunto, un responder-a y un adjunto con saltos de línea no inyectan cabeceras
    [$h, $body] = Mail::mime('Torivac <p@t.com>', ['to' => ['a@b.es'], 'subject' => 'x', 'html' => 'h', 'text' => 't', 'replyTo' => "a@b.co\r\nBcc: x@y.co", 'cc' => ["c@d.co\r\nBcc: z@y.co"],
        'attachments' => [['filename' => 'a.pdf', 'content' => "JVBERi0xLjQK\r\nX-Header: inyectado en el adjunto\r\n--tv-00\r\n"]]]);
    T::true(strpos($h, 'Bcc:') === false && strpos($h, 'Reply-To') === false && strpos($h, 'Cc:') === false, 'mime(): un responder-a o un cc con saltos de línea no entran en las cabeceras');
    T::true(strpos($body, 'X-Header') === false && strpos($body, "JVBERi0xLjQKXHeaderinyectadoenel") !== false, 'mime(): el adjunto se reduce a base64 puro');
    $sent = Mail::send(['to' => ['victima@x.co,root'], 'subject' => "Asunto\r\nBcc: x@y.co", 'text' => 'x']);
    T::same([false, 'Destinatario no válido', 'skipped'], [$sent['ok'], $sent['error'], $sent['reason']], 'send(): una coma en el destinatario no manda el correo a otro');
    $sent2 = Mail::send(['to' => ['info@grupotorivac.com'], 'subject' => "Asunto\r\nBcc: x@y.co", 'text' => 'x']);
    $stored = so_mail_to(['info@grupotorivac.com']);
    T::true($sent2['ok'] && $stored !== null && $stored['subject'] === 'Asunto Bcc: x@y.co', 'send(): el asunto pierde los saltos de línea');
}

/** A13 · Correo del visitante: la expresión del servidor es más estricta que la de antes (sin , ; < > " ( ) [ ] \ | ni espacios) y además pasa filter_var. */
function test_a13_email_validation_is_strict()
{
    $bad = ['victima@x.co,root', 'a@b.co;c@d.co', '<a@b.co>', '"a"@b.co', 'a@b', 'a@b.c', 'a b@c.co', 'a@b..co', '.a@b.co', 'a.@b.co', str_repeat('a', 65) . '@x.co', 'a(b)@c.co', 'a[b]@c.co', 'a\\b@c.co', 'a|b@c.co',
        "a@b.co\n", ' a@b.co', 'a@b.co ', 'a@-b.co', 'a@b-.co', 'a@b.c0', 'a@@b.co', '@b.co', 'a@.co', 'a@b.co.', 'ñ@x.co', 'a@münchen.de', 'a@' . str_repeat('x', 64) . '.co', 'a@b.' . str_repeat('c', 64),
        str_repeat('a', 60) . '@' . str_repeat(str_repeat('b', 50) . '.', 4) . 'co', 'a,b@c.co', 'a@b.co,d@e.co', "a@b.co\r\nBcc: x@y.co", 'a<img/src=x/onerror=1>@x.es', 'a=b@c.co', 'a#b@c.co', 'a$b@c.co', 'a`b@c.co', 'a{b}@c.co', 'a/b@c.co', 'a*b@c.co', 'a?b@c.co', 'a!b@c.co', 'a&b@c.co'];
    foreach ($bad as $e) T::true(!Orders::validEmail($e), 'no válido: ' . json_encode($e));
    $good = ['ana@acme.es', "o'brien@x.ie", 'a+b@c.co', 'jose.luis_perez-1@sub.dominio.com', 'x@xn--bcher-kva.example', 'USER@EXAMPLE.COM', 'a%b@c.co', 'a@b.co', 'info@grupotorivac.com', 'mzamora@torivac.com', str_repeat('a', 64) . '@x.co', 'a@b.museum'];
    foreach ($good as $e) T::true(Orders::validEmail($e), 'válido: ' . json_encode($e));
    T::true(!Orders::validEmail(['a@b.co']) && !Orders::validEmail(null) && !Orders::validEmail(5), 'solo una cadena puede ser un correo');
    fresh(); seedPrices();
    $r = so_post(goodOrder(['customer' => so_customer(['email' => 'victima@x.co,root'])]));
    T::same([400, 'Correo no válido', []], [$r->status, $r->body['error'] ?? null, outbox()], 'A13: «victima@x.co,root» ya no llega ni al pedido ni al To:');
    $c = Router::handle(req('POST', '/contact', ['name' => 'Luis', 'email' => 'a@b.co;c@d.co', 'message' => 'Quiero un toroidal', 'privacy' => true], [], '203.0.113.77'));
    T::same([400, 'Correo no válido'], [$c->status, $c->body['error'] ?? null], 'ni al formulario de contacto');
    fresh(['order_to' => ['info@grupotorivac.com', 'otro@x.co;malo@y.co']]);
    $st = []; foreach (Diag::run()['checks'] as $ck) $st[$ck['id']] = $ck['status'];
    T::same('fail', $st['destinatarios'], 'el diagnóstico marca un order_to con correos no válidos');
}

/** A9 · Todos los campos de texto del pedido, el contacto y el acceso deben ser cadenas: un array o un número se rechaza con 400 y sin avisos de PHP. */
function test_a9_non_string_fields_are_rejected_without_php_warnings()
{
    fresh(); seedPrices();
    $w = so_warnings(function () {
        $order = function (array $customer = [], array $over = []) { return so_post(goodOrder(['customer' => so_customer($customer)] + $over)); };
        foreach (['name' => ['x', 'y'], 'company' => 123, 'email' => ['ana@acme.es'], 'phone' => ['6'], 'notes' => ['n'], 'name ' => (object) ['a' => 1]] as $k => $v) {
            $r = $order([trim($k) => $v]);
            T::same([400, 'Petición no válida'], [$r->status, $r->body['error'] ?? null], "customer.$k que no es una cadena → 400");
        }
        foreach (['lang' => ['es'], 'turnstileToken' => ['x'], 'pdf' => ['x']] as $k => $v) T::same(400, $order([], [$k => $v])->status, "$k que no es una cadena → 400");
        T::same(400, so_post(goodOrder(['lines' => [['ref' => ['TT0020210'], 'qty' => 1]]]))->status, 'lines[].ref que no es una cadena → 400');
        T::same(400, so_post(goodOrder(['lines' => [['ref' => 'TT0020210', 'qty' => '5']]]))->status, 'qty como texto → 400 (cantidad no válida)');
        T::same(200, $order(['company' => null, 'phone' => null, 'notes' => null])->status, 'los opcionales pueden venir a null');
        $c = ['name' => 'Luis', 'email' => 'l@x.es', 'message' => 'Quiero un toroidal de 500 VA', 'privacy' => true];
        foreach (['name' => ['x'], 'email' => ['l@x.es'], 'message' => ['m'], 'lang' => ['es'], 'turnstileToken' => ['t']] as $k => $v) {
            $r = Router::handle(req('POST', '/contact', [$k => $v] + $c, [], '203.0.113.' . mt_rand(100, 250)));
            T::same(400, $r->status, "contacto: $k que no es una cadena → 400");
        }
        foreach ([['email' => ['x'], 'password' => 'clave'], ['email' => 'a@b.es', 'password' => ['x']], ['email' => 5, 'password' => 'x'], ['email' => 'a@b.es', 'password' => (object) []]] as $i => $b) {
            T::same(400, Router::handle(req('POST', '/auth/login', $b, [], '203.0.113.' . (150 + $i)))->status, 'acceso con email o password que no es una cadena → 400');
        }
        foreach ([['email' => ['x'], 'role' => 'client', 'password' => 'Clave-Cliente-2026!!'], ['email' => 'n@x.es', 'role' => 'client', 'password' => ['x']], ['email' => 'n@x.es', 'role' => ['client'], 'password' => 'Clave-Cliente-2026!!'], ['email' => 'n@x.es', 'name' => ['x'], 'role' => 'client', 'password' => 'Clave-Cliente-2026!!']] as $b) {
            T::same(400, Router::handle(req('POST', '/users', $b, master()))->status, 'alta de usuario con un campo que no es una cadena → 400');
        }
    });
    T::same([], $w, 'ninguno de esos casos provoca avisos de PHP (antes: «Array to string conversion»)');
    T::same(0, count(Store::keys('order:')) - 1, 'solo se guardó el pedido válido');
}

/** D7 · A un cliente no se le devuelve la IP del pedido ni el motivo técnico del fallo del correo; un manager (y el token maestro) lo ve todo. */
function test_d7_client_orders_hide_ip_and_mail_error()
{
    fresh(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test']]); seedPrices();
    Http::$mock = function () { return [403, 'x']; };
    Users::create(['email' => 'jefe@torivac.com', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    $r = so_post(goodOrder(), '198.51.100.44');
    T::same([200, false], [$r->status, $r->body['emailed']['team']], 'pedido guardado con el aviso por correo fallido');
    so_post(goodOrder(['customer' => so_customer(['email' => 'otro@x.es'])]), '198.51.100.45');
    $tA = login_token('ana@acme.es', PW_ANA); $tJ = login_token('jefe@torivac.com', PW_JEFE);
    $ana = Router::handle(req('GET', '/orders', null, bearer($tA)))->body['orders'];
    T::same(1, count($ana), 'Ana ve solo el suyo');
    T::true(!array_key_exists('ip', $ana[0]) && !array_key_exists('error', $ana[0]['emailed']), 'sin ip ni emailed.error');
    T::same([false, 'ana@acme.es', 'TT0020210'], [$ana[0]['emailed']['team'], $ana[0]['customer']['email'], $ana[0]['lines'][0]['ref']], 'el resto del pedido sigue igual (también emailed.team)');
    foreach ([['token de sesión de manager', $tJ], ['token maestro', MASTER_TOKEN]] as [$who, $t]) {
        $all = Router::handle(req('GET', '/orders', null, bearer($t)))->body['orders'];
        $mine = array_values(array_filter($all, function ($o) { return $o['customer']['email'] === 'ana@acme.es'; }))[0];
        T::same([2, '198.51.100.44', 'Resend respondió 403'], [count($all), $mine['ip'], $mine['emailed']['error']], "$who: ve todos los pedidos con la IP y el error del correo");
    }
    // un anónimo que pone el correo de Ana en SU pedido lo ve aparecer en la lista de Ana (la regla no cambia), pero sin IP
    so_post(goodOrder(['customer' => so_customer(['name' => 'Intruso', 'email' => 'ANA@acme.es'])]), '198.51.100.99');
    $ana2 = Router::handle(req('GET', '/orders', null, bearer($tA)))->body['orders'];
    T::same([2, false], [count($ana2), array_key_exists('ip', $ana2[0])], 'un pedido ajeno con su correo aparece en la lista de Ana, pero sin la IP de quien lo hizo');
}

/** D7 · El listado de pedidos no revienta con miles: un manager recibe los 300 más recientes y un cliente hasta 100 de los suyos, con truncated:true si se cortó. */
function test_d7_orders_list_is_capped()
{
    fresh(); seedPrices();
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    Users::create(['email' => 'bea@acme.es', 'name' => 'Bea', 'role' => 'client', 'password' => 'Clave-Otra-Persona-2026']);
    for ($i = 1; $i <= 470; $i++) {
        $num = 'TV-20261001-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT);
        $mail = $i % 4 === 0 ? 'ana@acme.es' : ($i === 3 ? 'bea@acme.es' : 'otro@x.es');
        Store::put('order:' . $num, ['number' => $num, 'at' => gmdate('Y-m-d\TH:i:s.000\Z', 1790000000 + $i * 60), 'customer' => ['name' => 'N', 'email' => $mail], 'lines' => [], 'total' => 1, 'ip' => '10.0.0.1', 'emailed' => ['team' => true, 'error' => '']], 86400);
    }
    $tM = login_token('ana@acme.es', PW_ANA);
    $m = Router::handle(req('GET', '/orders', null, master()))->body;
    T::same([300, true, 'TV-20261001-0470', 'TV-20261001-0171'], [count($m['orders']), $m['truncated'] ?? false, $m['orders'][0]['number'], $m['orders'][299]['number']], 'manager: los 300 más recientes, el último primero, y truncated');
    $a = Router::handle(req('GET', '/orders', null, bearer($tM)))->body;
    T::same([100, true, 'TV-20261001-0468'], [count($a['orders']), $a['truncated'] ?? false, $a['orders'][0]['number']], 'cliente con 117 pedidos: 100 y truncated');
    $b = Router::handle(req('GET', '/orders', null, bearer(login_token('bea@acme.es', 'Clave-Otra-Persona-2026'))))->body;
    T::same([1, false], [count($b['orders']), array_key_exists('truncated', $b)], 'cliente con uno solo: sin truncated');
    for ($i = 471; $i <= 500; $i++) Store::delete('order:TV-20261001-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT));
    for ($i = 1; $i <= 170; $i++) Store::delete('order:TV-20261001-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT));
    $m2 = Router::handle(req('GET', '/orders', null, master()))->body;
    T::same([300, false], [count($m2['orders']), array_key_exists('truncated', $m2)], 'manager con exactamente 300: sin truncated');
}

/** D7/W8 · Nombres como «constructor», «__proto__» o «toString» no son referencias del catálogo (en PHP los arrays no tienen el problema; se cubre con una prueba). */
function test_d7_prototype_names_are_not_valid_references()
{
    fresh(); seedPrices();
    foreach (['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '__construct', 'prototype', '0', '-1', 'length', 'tt0020210'] as $ref) {
        $r = so_post(goodOrder(['lines' => [['ref' => $ref, 'qty' => 1]]]));
        T::same(400, $r->status, 'pedido con la referencia «' . $ref . '» → 400');
    }
    $v = Ai::validateChanges([['ref' => 'constructor', 'price' => 1], ['ref' => '__proto__', 'price' => 1], ['ref' => 'toString', 'price' => 1]], Prices::load(), Catalog::items());
    T::same([[], 3], [$v['changes'], count($v['rejected'])], 'la IA tampoco puede proponer precios para esos nombres');
    $r = PriceSheet::read([['ref', 'price'], ['constructor', '5'], ['__proto__', '6'], ['TT0020210', '7']], ['lines' => ['TT0020210' => ['n' => 'x', 'pid' => 884]]]);
    T::same([['constructor', '__proto__'], ['TT0020210']], [$r['unknown'], array_keys($r['items'])], 'y una hoja con esos nombres los deja como desconocidos');
}
