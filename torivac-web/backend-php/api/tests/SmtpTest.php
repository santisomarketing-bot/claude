<?php
/**
 * Pruebas del cliente SMTP (Smtp.php) y del controlador smtp de Mail contra un servidor SMTP FALSO (fake-smtp.php, lanzado con proc_open en 127.0.0.1 y un puerto libre):
 * éxito, STARTTLS y TLS implícito con certificado autofirmado (verificado y sin verificar), AUTH PLAIN y LOGIN, 535 de autenticación, 550 de destinatario, conexión rechazada, servidor mudo
 * (tiempo máximo), respuestas absurdas, inyección de cabeceras y órdenes, contraseña sin cifrar a un servidor remoto y que ni el usuario ni la contraseña salen jamás en un error.
 */
namespace Torivac\Tests;

use Torivac\Config;
use Torivac\Mail;
use Torivac\Smtp;
use Torivac\Store;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Certificado autofirmado de pruebas (PEM con certificado y clave) creado una vez por ejecución; null si OpenSSL no puede crearlo (entonces se omiten las pruebas de TLS). */
function smtp_cert(): ?string
{
    static $pem = false;
    if ($pem !== false) return $pem;
    $pem = null;
    if (!function_exists('openssl_pkey_new')) return null;
    $key = @openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    if (!$key) return null;
    $csr = @openssl_csr_new(['commonName' => 'localhost'], $key, ['digest_alg' => 'sha256']);
    $x509 = $csr ? @openssl_csr_sign($csr, null, $key, 1, ['digest_alg' => 'sha256']) : false;
    if (!$x509) return null;
    openssl_x509_export($x509, $cert);
    openssl_pkey_export($key, $priv);
    $f = sys_get_temp_dir() . '/tv-smtp-cert-' . bin2hex(random_bytes(4)) . '.pem';
    file_put_contents($f, $cert . $priv);
    register_shutdown_function(function () use ($f) { @unlink($f); });
    return $pem = $f;
}

/**
 * Lanza el servidor SMTP falso con ese guion → ['port' => int, 'events' => fn(): array (lo recibido hasta ahora), 'stop' => fn()] o null si no se puede lanzar procesos.
 * @param array<string,mixed> $scenario
 */
function smtp_fake(array $scenario): ?array
{
    if (!function_exists('proc_open')) return null;
    $scn = tempnam(sys_get_temp_dir(), 'tv-scn-');
    $log = tempnam(sys_get_temp_dir(), 'tv-log-');
    file_put_contents($scn, json_encode($scenario));
    file_put_contents($log, '');
    $proc = proc_open([PHP_BINARY, __DIR__ . '/fake-smtp.php', $scn, $log], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($proc)) return null;
    $port = 0;
    $deadline = microtime(true) + 10;
    $buf = '';
    while (microtime(true) < $deadline) {
        $r = [$pipes[1]]; $w = $e = null;
        if (stream_select($r, $w, $e, 0, 200000) && ($l = fgets($pipes[1])) !== false) { $buf .= $l; if (preg_match('/PORT=(\d+)/', $buf, $m)) { $port = (int) $m[1]; break; } }
    }
    $stop = function () use ($proc, $pipes, $scn, $log) { @proc_terminate($proc); foreach ($pipes as $p) @fclose($p); @proc_close($proc); @unlink($scn); @unlink($log); };
    if ($port === 0) { $stop(); return null; }
    $events = function () use ($log) { return array_values(array_filter(array_map(function ($l) { return json_decode($l, true); }, file($log, FILE_IGNORE_NEW_LINES) ?: []))); };
    return ['port' => $port, 'events' => $events, 'stop' => $stop];
}

/** Ejecuta `$fn($puerto, $eventos)` con un servidor falso levantado y lo para siempre al terminar. Si no se puede lanzar procesos, lo dice y se omite. */
function with_smtp(array $scenario, callable $fn): void
{
    $s = smtp_fake($scenario);
    if ($s === null) { fwrite(STDERR, "  · smtp: no se puede lanzar el servidor falso, se omite\n"); return; }
    try { $fn($s['port'], $s['events']); } finally { ($s['stop'])(); }
}

/** Configuración SMTP de pruebas hacia el servidor falso (sin cifrar, pues es la propia máquina). */
function smtp_cfg(int $port, array $over = []): array { return $over + ['host' => '127.0.0.1', 'port' => $port, 'secure' => 'none', 'timeout' => 5]; }

/** Órdenes recibidas por el servidor falso, en orden (sin los datos del mensaje). */
function smtp_cmds(array $events): array { return array_values(array_map(function ($e) { return $e['cmd']; }, array_filter($events, function ($e) { return isset($e['cmd']); }))); }

/** Un mensaje mínimo con una línea que empieza por punto. */
const SMTP_MSG = "Subject: prueba\r\nFrom: p@t.com\r\n\r\nhola\r\n.punto al inicio\r\nfin\r\n";

/** Éxito sin cifrar: órdenes en el orden correcto, un RCPT por destinatario y mensaje entregado con «dot-stuffing». */
function test_smtp_success_commands_and_dot_stuffing()
{
    with_smtp([], function ($port, $events) {
        $r = Smtp::send(smtp_cfg($port), 'pedidos@grupotorivac.com', ['info@grupotorivac.com', 'mzamora@torivac.com'], SMTP_MSG);
        T::same(true, $r['ok'], 'envío correcto: ' . ($r['error'] ?? ''));
        $cmds = smtp_cmds($events());
        T::same(['MAIL FROM:<pedidos@grupotorivac.com>', 'RCPT TO:<info@grupotorivac.com>', 'RCPT TO:<mzamora@torivac.com>', 'DATA', 'QUIT'], array_slice($cmds, 1), 'MAIL, un RCPT por destinatario, DATA y QUIT');
        T::true(strpos($cmds[0], 'EHLO ') === 0, 'empieza por EHLO');
        $data = array_values(array_filter($events(), function ($e) { return isset($e['data']); }))[0];
        $raw = array_values(array_filter($events(), function ($e) { return isset($e['data_raw']); }))[0]['data_raw'];
        T::true(in_array('..punto al inicio', $raw, true), 'la línea que empieza por punto viaja con otro punto delante');
        T::true(strpos($data['data'], "\n.punto al inicio\n") !== false && strpos($data['data'], 'hola') !== false, 'y el servidor la recupera entera');
        T::same([], $r['rejected'], 'nadie rechazado');
    });
}

/** AUTH PLAIN y AUTH LOGIN: el servidor recibe usuario y contraseña bien codificados. */
function test_smtp_auth_plain_and_login()
{
    with_smtp(['auth' => 'plain'], function ($port, $events) {
        $r = Smtp::send(smtp_cfg($port, ['user' => 'pedidos@grupotorivac.com', 'pass' => 'clave-de-pruebas-1']), 'pedidos@grupotorivac.com', ['info@grupotorivac.com'], SMTP_MSG);
        T::same(true, $r['ok'], 'AUTH PLAIN: ' . ($r['error'] ?? ''));
        T::same('<NUL>pedidos@grupotorivac.com<NUL>clave-de-pruebas-1', array_values(array_filter($events(), function ($e) { return isset($e['auth']); }))[0]['auth'], 'usuario y clave en el PLAIN');
    });
    with_smtp(['auth' => 'login'], function ($port, $events) {
        $r = Smtp::send(smtp_cfg($port, ['user' => 'u@x.es', 'pass' => 'clave-de-pruebas-2']), 'pedidos@grupotorivac.com', ['info@grupotorivac.com'], SMTP_MSG);
        T::same(true, $r['ok'], 'AUTH LOGIN: ' . ($r['error'] ?? ''));
        T::same('u@x.es<NUL>clave-de-pruebas-2', array_values(array_filter($events(), function ($e) { return isset($e['auth']); }))[0]['auth'], 'usuario y clave en el LOGIN');
    });
    with_smtp(['auth' => 'none'], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['user' => 'u', 'pass' => 'secreto-largo']), 'p@t.com', ['info@grupotorivac.com'], SMTP_MSG);
        T::same(false, $r['ok'], 'si el servidor no ofrece AUTH y hay usuario, error');
        T::true(strpos($r['error'], 'no ofrece autenticación') !== false, 'dice por qué');
    });
}

/** 535: el error dice «SMTP 535 …» y NUNCA lleva el usuario ni la contraseña, aunque el servidor los repita en su texto. */
function test_smtp_535_error_never_echoes_credentials()
{
    foreach (['plain', 'login'] as $mech) {
        with_smtp(['auth' => '535', 'caps' => ['AUTH ' . strtoupper($mech)]], function ($port) use ($mech) {
            $r = Smtp::send(smtp_cfg($port, ['user' => 'usuario-secreto', 'pass' => 'hunter2-hunter2']), 'p@t.com', ['info@grupotorivac.com'], SMTP_MSG);
            T::same(false, $r['ok'], "535 ($mech)");
            T::true(strpos($r['error'], 'SMTP 535') === 0, "empieza por «SMTP 535» ($mech): " . $r['error']);
            T::true(strpos($r['error'], 'hunter2') === false && strpos($r['error'], 'usuario-secreto') === false, "ni la contraseña ni el usuario ($mech)");
        });
    }
}

/** 550 de destinatario: con uno solo, error; con dos y uno rechazado, el mensaje sale al bueno y el rechazado se avisa. */
function test_smtp_recipient_rejected()
{
    with_smtp(['rcpt' => ['malo@x.es' => '550 5.1.1 no existe ese buzón']], function ($port) {
        $r = Smtp::send(smtp_cfg($port), 'p@t.com', ['malo@x.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'SMTP 550') === 0], 'un solo destinatario rechazado → error SMTP 550');
    });
    with_smtp(['rcpt' => ['malo@x.es' => '550 5.1.1 no existe ese buzón']], function ($port, $events) {
        $r = Smtp::send(smtp_cfg($port), 'p@t.com', ['malo@x.es', 'bueno@x.es'], SMTP_MSG);
        T::same(true, $r['ok'], 'si alguien acepta, el mensaje sale');
        T::same(1, count($r['rejected']), 'y el rechazado se devuelve');
        T::true(strpos($r['rejected'][0], 'malo@x.es') === 0 && strpos($r['rejected'][0], '550') !== false, 'con su motivo');
        T::true(count(array_filter($events(), function ($e) { return isset($e['data']); })) === 1, 'se entregó una vez');
    });
}

/** Fallos del servidor: saludo 554, MAIL FROM rechazado, DATA rechazado. */
function test_smtp_server_errors_are_reported()
{
    with_smtp(['greeting' => '554 5.3.2 servicio no disponible'], function ($port) {
        $r = Smtp::send(smtp_cfg($port), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'SMTP 554') === 0], 'saludo 554');
    });
    with_smtp(['mail' => '550 5.7.1 remitente rechazado'], function ($port) {
        $r = Smtp::send(smtp_cfg($port), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'SMTP 550') === 0], 'MAIL FROM rechazado');
    });
    with_smtp(['data' => '554 5.3.0 transacción fallida'], function ($port) {
        $r = Smtp::send(smtp_cfg($port), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'SMTP 554') === 0], 'DATA rechazado');
    });
}

/** Conexión rechazada, servidor mudo (tiempo máximo) y respuestas absurdas (sin fin): nada se queda colgado ni agota la memoria. */
function test_smtp_refused_mute_and_flooding_servers()
{
    $s = stream_socket_server('tcp://127.0.0.1:0');                       // reservar un puerto y cerrarlo: nadie escucha
    $port = (int) parse_url('tcp://' . stream_socket_get_name($s, false), PHP_URL_PORT);
    fclose($s);
    $r = Smtp::send(smtp_cfg($port), 'p@t.com', ['a@b.es'], SMTP_MSG);
    T::same([false, true], [$r['ok'], strpos($r['error'], 'SMTP: no se pudo conectar a 127.0.0.1:' . $port) === 0], 'conexión rechazada: ' . $r['error']);
    with_smtp(['greeting' => 'mute'], function ($port) {
        $t0 = microtime(true);
        $r = Smtp::send(smtp_cfg($port, ['timeout' => 3]), 'p@t.com', ['a@b.es'], SMTP_MSG);
        $dt = microtime(true) - $t0;
        T::same(false, $r['ok'], 'servidor mudo');
        T::true(strpos($r['error'], 'sin respuesta') !== false, 'dice que no respondió: ' . $r['error']);
        T::true($dt < 7, 'y no se queda colgado (' . round($dt, 1) . ' s con un máximo de 3)');
    });
    with_smtp(['mute_after' => 'MAIL'], function ($port) {
        $t0 = microtime(true);
        $r = Smtp::send(smtp_cfg($port, ['timeout' => 3]), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true, true], [$r['ok'], strpos($r['error'], 'sin respuesta') !== false, (microtime(true) - $t0) < 7], 'el servidor deja de contestar a mitad de la conversación');
    });
    with_smtp(['flood' => true], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['timeout' => 5]), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'demasiado larga') !== false], 'miles de líneas «250-» seguidas se cortan: ' . $r['error']);
    });
}

/** Lo que no debe llegar a conectar: saltos de línea en remitente, destinatarios, usuario o contraseña; contraseña sin cifrar a un servidor remoto; ajustes absurdos. */
function test_smtp_rejects_bad_input_before_connecting()
{
    $cfg = ['host' => '127.0.0.1', 'port' => 9, 'secure' => 'none', 'timeout' => 3];                    // el puerto 9 no se llega a usar
    $cases = [
        ['remitente con salto', $cfg, "p@t.com\r\nRCPT TO:<x@y.es>", ['a@b.es'], 'remitente no válido'],
        ['destinatario con salto', $cfg, 'p@t.com', ["a@b.es>\r\nDATA\r\n<c@d.es"], 'destinatario no válido'],
        ['destinatario con coma', $cfg, 'p@t.com', ['a@b.es,c@d.es'], 'destinatario no válido'],
        ['sin destinatarios', $cfg, 'p@t.com', [], 'sin destinatarios'],
        ['usuario con salto', $cfg + ['user' => "u\r\nMAIL FROM:<x@y>", 'pass' => 'abc12345'], 'p@t.com', ['a@b.es'], 'caracteres no válidos'],
        ['contraseña con salto', $cfg + ['user' => 'u', 'pass' => "ab\r\nc"], 'p@t.com', ['a@b.es'], 'caracteres no válidos'],
        ['usuario sin contraseña', $cfg + ['user' => 'u'], 'p@t.com', ['a@b.es'], 'falta mail.smtp.pass'],
        ['contraseña sin cifrar a un servidor remoto', ['host' => 'mail.example.com', 'port' => 25, 'secure' => 'none', 'user' => 'u', 'pass' => 'clave-larga'], 'p@t.com', ['a@b.es'], 'no se envía la contraseña sin cifrar'],
        ['host con salto', ['host' => "127.0.0.1\r\nX", 'port' => 25, 'secure' => 'none'], 'p@t.com', ['a@b.es'], 'no es un servidor válido'],
        ['host vacío', ['host' => '', 'port' => 25], 'p@t.com', ['a@b.es'], 'no es un servidor válido'],
        ['puerto 0', ['port' => 0] + $cfg, 'p@t.com', ['a@b.es'], 'puerto'],
        ['puerto 70000', ['port' => 70000] + $cfg, 'p@t.com', ['a@b.es'], 'puerto'],
        ['cifrado desconocido', ['secure' => 'raro'] + $cfg, 'p@t.com', ['a@b.es'], 'secure'],
    ];
    foreach ($cases as [$name, $c, $from, $rcpts, $needle]) {
        $t0 = microtime(true);
        $r = Smtp::send($c, $from, $rcpts, SMTP_MSG);
        T::true(!$r['ok'] && stripos($r['error'], $needle) !== false && (microtime(true) - $t0) < 1, "$name → «{$needle}»: " . ($r['error'] ?? 'ok'));
    }
}

/** STARTTLS y TLS implícito con un certificado autofirmado: con verificación fallan; sin ella (insecure_tls) funcionan, y la contraseña solo viaja ya cifrada. */
function test_smtp_starttls_and_implicit_tls()
{
    $cert = smtp_cert();
    if ($cert === null) { fwrite(STDERR, "  · smtp: OpenSSL no puede crear un certificado de pruebas, se omiten las pruebas de TLS\n"); return; }
    with_smtp(['starttls' => true, 'cert' => $cert], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['secure' => 'tls', 'user' => 'u', 'pass' => 'clave-larga-1']), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'no se pudo cifrar') !== false], 'STARTTLS con certificado autofirmado y verificación activa → falla: ' . ($r['error'] ?? ''));
    });
    with_smtp(['starttls' => true, 'cert' => $cert], function ($port, $events) {
        $r = Smtp::send(smtp_cfg($port, ['secure' => 'tls', 'insecure_tls' => true, 'user' => 'u', 'pass' => 'clave-larga-2']), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same(true, $r['ok'], 'STARTTLS con insecure_tls → envía: ' . ($r['error'] ?? ''));
        $ev = $events();
        $iTls = array_search(['tls' => 'ok'], $ev, true);
        $iAuth = array_search(true, array_map(function ($e) { return isset($e['auth']); }, $ev), true);
        $iEhlo2 = null;
        foreach ($ev as $i => $e) if (isset($e['cmd']) && strpos($e['cmd'], 'EHLO') === 0 && $iTls !== false && $i > $iTls) { $iEhlo2 = $i; break; }
        T::true($iTls !== false && $iEhlo2 !== null && $iAuth !== false && $iTls < $iEhlo2 && $iEhlo2 < $iAuth, 'orden: STARTTLS → TLS ok → EHLO otra vez → AUTH (la contraseña solo va ya cifrada)');
    });
    with_smtp(['starttls' => true, 'cert' => $cert], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['secure' => 'tls', 'tls_name' => 'localhost', 'insecure_tls' => false]), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same(false, $r['ok'], 'con tls_name correcto pero certificado autofirmado (no de confianza) sigue fallando');
    });
    with_smtp(['implicit_tls' => true, 'cert' => $cert], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['secure' => 'ssl']), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same(false, $r['ok'], 'TLS implícito con verificación y certificado autofirmado → falla: ' . ($r['error'] ?? ''));
    });
    with_smtp(['implicit_tls' => true, 'cert' => $cert], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['secure' => 'ssl', 'insecure_tls' => true]), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same(true, $r['ok'], 'TLS implícito con insecure_tls → envía: ' . ($r['error'] ?? ''));
    });
    with_smtp([], function ($port) {
        $r = Smtp::send(smtp_cfg($port, ['secure' => 'tls']), 'p@t.com', ['a@b.es'], SMTP_MSG);
        T::same([false, true], [$r['ok'], strpos($r['error'], 'no ofrece STARTTLS') !== false], 'secure = tls y un servidor sin STARTTLS → NO se envía en claro');
    });
}

/** Mail::send con el controlador smtp: mensaje completo (cabeceras, MIME, adjunto), resultado veraz y último intento anotado, sin secretos. */
function test_mail_send_via_smtp_end_to_end()
{
    with_smtp([], function ($port, $events) {
        fresh(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => '127.0.0.1', 'port' => $port, 'secure' => 'none', 'timeout' => 5]]]);
        $r = Mail::send(['to' => ['info@grupotorivac.com', 'mzamora@torivac.com'], 'subject' => "Contacto web · Ana\r\nBcc: espia@evil.example", 'html' => '<p>Hola ñandú</p>', 'text' => "Hola ñandú\n.punto", 'replyTo' => 'ana@acme.es',
            'attachments' => [['filename' => 'TV-1.pdf', 'content' => base64_encode("%PDF-1.4\nprueba")]]], 'contact', 1793170800000);
        T::same([true, 'sent', 'smtp'], [$r['ok'], $r['reason'], $r['driver']], 'envío por SMTP: ' . ($r['error'] ?? ''));
        $msg = array_values(array_filter($events(), function ($e) { return isset($e['data']); }))[0]['data'];
        T::true(preg_match('/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+\/=]+\?=/m', $msg) === 1 && stripos($msg, "\nBcc:") === false, 'el asunto va codificado y en una sola línea (el Bcc colado quedó dentro del asunto, no como cabecera)');
        T::true(strpos($msg, 'To: info@grupotorivac.com, mzamora@torivac.com') !== false && strpos($msg, 'Reply-To: ana@acme.es') !== false && strpos($msg, 'From: Torivac Web <pedidos@grupotorivac.com>') !== false, 'To, Reply-To y From');
        T::true(preg_match('/^Date: \w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} \+0000$/m', $msg) === 1 && preg_match('/^Message-ID: <[0-9a-f]{24}@grupotorivac\.com>$/m', $msg) === 1, 'Date y Message-ID');
        T::true(strpos($msg, 'multipart/mixed') !== false && strpos($msg, 'filename="TV-1.pdf"') !== false, 'con el PDF adjunto');
        $last = Mail::last();
        T::same(['contact', true, 'sent', '2026-10-28T07:00:00.000Z'], [$last['kind'], $last['ok'], $last['reason'], $last['at']], 'mail:last anotado con el tipo y la hora');
    });
    with_smtp(['auth' => '535'], function ($port) {
        fresh(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => '127.0.0.1', 'port' => $port, 'secure' => 'none', 'timeout' => 5, 'user' => 'usuario-secreto-9', 'pass' => 'hunter2-hunter2']]]);
        $r = Mail::send(['to' => ['info@grupotorivac.com'], 'subject' => 'x', 'text' => 'x'], 'test');
        T::same([false, 'failed'], [$r['ok'], $r['reason']], 'autenticación rechazada → failed');
        T::true(strpos($r['error'], 'SMTP 535') === 0 && strpos($r['error'], 'hunter2') === false && strpos($r['error'], 'usuario-secreto') === false, 'el error corto no lleva usuario ni contraseña: ' . $r['error']);
        $stored = json_encode(Mail::last());
        T::true(strpos($stored, 'hunter2') === false && strpos($stored, 'usuario-secreto') === false, 'ni mail:last');
        T::true(strlen($r['error']) <= 160, 'y mide ≤ 160');
    });
    with_smtp(['rcpt' => ['dos@torivac.com' => '550 5.1.1 buzón inexistente']], function ($port) {
        fresh(['mail' => ['driver' => 'smtp', 'smtp' => ['host' => '127.0.0.1', 'port' => $port, 'secure' => 'none', 'timeout' => 5]]]);
        $r = Mail::send(['to' => ['uno@torivac.com', 'dos@torivac.com'], 'subject' => 'x', 'text' => 'x'], 'order');
        T::same([true, 'sent'], [$r['ok'], $r['reason']], 'un destinatario rechazado no impide el envío al otro');
        T::true(!empty($r['error']) && strpos($r['error'], 'dos@torivac.com') !== false, 'pero se avisa: ' . ($r['error'] ?? ''));
        T::true(!empty(Mail::last()['error']) && Mail::last()['ok'] === true, 'y mail:last lo recoge como aviso (ok con error)');
    });
}

/** El mensaje completo: nombre del remitente y asunto largos con caracteres no ASCII se codifican en palabras MIME cortas y sin partir ninguna letra. */
function test_mail_message_headers_are_encoded_safely()
{
    fresh(['order_from' => 'Torivac Web ñandú <pedidos@grupotorivac.com>']);
    $sender = Mail::sender();
    T::true($sender['ok'] && strpos($sender['header'], '=?UTF-8?B?') === 0 && substr($sender['header'], -26) === '<pedidos@grupotorivac.com>', 'el nombre con ñ va en una palabra MIME');
    T::same('Torivac Web ñandú <pedidos@grupotorivac.com>', $sender['from'], 'y `from` (para las APIs) lleva el nombre tal cual');
    $subject = str_repeat('Presupuesto ñandú útil · ', 6);
    $msg = Mail::message($sender, ['to' => ['a@b.es'], 'cc' => [], 'subject' => $subject, 'text' => 'x', 'html' => '<p>x</p>']);
    preg_match('/^Subject: (.*?)\r\n(?!\s)/ms', $msg, $m);
    $words = preg_split('/\r\n /', $m[1]);
    T::true(count($words) >= 3, 'un asunto largo se parte en varias palabras MIME');
    $back = '';
    foreach ($words as $w) { T::true(strlen($w) <= 75 && preg_match('/^=\?UTF-8\?B\?([A-Za-z0-9+\/=]+)\?=$/', $w, $mm) === 1, 'cada palabra MIME mide ≤ 75: ' . strlen($w)); $back .= base64_decode($mm[1]); }
    T::same($subject, $back, 'y juntas dan el asunto exacto, sin partir ninguna letra');
    T::true(strpos(explode("\r\n\r\n", $msg)[0], "\r\n\r\n") === false, 'las cabeceras acaban en una línea en blanco');
}
