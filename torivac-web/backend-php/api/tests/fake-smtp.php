<?php
/**
 * Servidor SMTP falso SOLO para las pruebas (SmtpTest.php): escucha en 127.0.0.1 en un puerto libre, habla SMTP según un guion y anota todo lo que recibe.
 *   php fake-smtp.php <guion.json> <registro.jsonl>
 * Escribe «PORT=<puerto>» en la salida estándar cuando está listo y atiende UNA conexión (o hasta `connections`). Guion (todo opcional):
 *   greeting       "220 fake ESMTP" por defecto; "554 sin servicio" para rechazar; "mute" = no dice nada
 *   caps           líneas de capacidades tras EHLO (por defecto STARTTLS si starttls, AUTH si auth distinto de none)
 *   starttls       true = ofrece STARTTLS y cifra tras él (hace falta `cert`: un PEM con certificado y clave)
 *   implicit_tls   true = la conexión ya es TLS desde el primer byte (como el puerto 465)
 *   auth           "ok" (por defecto, PLAIN y LOGIN) · "plain" (solo PLAIN) · "login" (solo LOGIN) · "535" (rechaza con 535, y repite la contraseña recibida en su texto) · "none" (no anuncia AUTH)
 *   mail           "250 ok" por defecto · "550 5.7.1 remitente rechazado"
 *   rcpt           mapa correo → respuesta (por defecto "250 ok")
 *   data           "250 2.0.0 queued as FAKE1" por defecto · "554 5.3.0 fallo" tras DATA
 *   mute_after     nombre de una orden (EHLO, MAIL, RCPT, DATA…) tras la cual el servidor deja de contestar
 *   flood          true = tras EHLO contesta miles de líneas «250-…» sin terminar
 *   connections    cuántas conexiones atiende antes de salir (1 por defecto)
 * Registro (una línea JSON por evento): {"cmd":"EHLO x"} · {"auth":"…descifrado…"} · {"data_raw":[líneas tal como llegan]} · {"data":"mensaje con el punto ya quitado"}.
 */
$scenario = json_decode((string) file_get_contents($argv[1] ?? ''), true) ?: [];
$logFile = $argv[2] ?? '';
$log = function (array $e) use ($logFile) { if ($logFile !== '') file_put_contents($logFile, json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND); };
$ctx = stream_context_create(['ssl' => ['local_cert' => $scenario['cert'] ?? '', 'allow_self_signed' => true, 'verify_peer' => false]]);
$srv = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr, STREAM_SERVER_BIND | STREAM_SERVER_LISTEN, $ctx);
if (!$srv) { fwrite(STDERR, "no puedo escuchar: $errstr\n"); exit(1); }
echo 'PORT=' . parse_url('tcp://' . stream_socket_get_name($srv, false), PHP_URL_PORT) . "\n";
fflush(STDOUT);
$left = (int) ($scenario['connections'] ?? 1);
$deadline = time() + 40;                                           // por si una prueba se olvida de pararlo
while ($left-- > 0 && time() < $deadline) {
    $conn = @stream_socket_accept($srv, 30);
    if (!$conn) break;
    stream_set_timeout($conn, 20);
    $tls = false;
    if (!empty($scenario['implicit_tls'])) {
        stream_context_set_option($conn, 'ssl', 'local_cert', $scenario['cert'] ?? '');
        if (!@stream_socket_enable_crypto($conn, true, STREAM_CRYPTO_METHOD_TLS_SERVER)) { fclose($conn); continue; }
        $tls = true;
    }
    $say = function (string $line) use ($conn) { fwrite($conn, $line . "\r\n"); };
    $greeting = $scenario['greeting'] ?? '220 fake ESMTP';
    if ($greeting === 'mute') { sleep(20); fclose($conn); continue; }
    $say($greeting);
    if ((int) $greeting >= 400) { fclose($conn); continue; }
    $auth = $scenario['auth'] ?? 'ok';
    $mute = false;
    while (($line = fgets($conn, 4096)) !== false) {
        $line = rtrim($line, "\r\n");
        $verb = strtoupper(strtok($line, ' '));
        $log(['cmd' => preg_match('/^AUTH PLAIN /i', $line) ? 'AUTH PLAIN ***' : $line]);
        if ($mute) continue;
        if (isset($scenario['mute_after']) && $verb === strtoupper($scenario['mute_after'])) { $mute = true; if (!empty($scenario['flood'])) {} continue; }
        if ($verb === 'EHLO') {
            if (!empty($scenario['flood'])) { for ($i = 0; $i < 5000; $i++) $say('250-flood ' . $i); $say('250 fin'); continue; }
            $caps = $scenario['caps'] ?? array_values(array_filter([!empty($scenario['starttls']) && !$tls ? 'STARTTLS' : null, $auth === 'none' ? null : ($auth === 'plain' ? 'AUTH PLAIN' : ($auth === 'login' ? 'AUTH LOGIN' : 'AUTH PLAIN LOGIN')), '8BITMIME']));
            $lines = array_merge(['fake.test hola'], $caps);
            foreach ($lines as $i => $c) $say('250' . ($i === count($lines) - 1 ? ' ' : '-') . $c);
        } elseif ($verb === 'HELO') { $say('250 fake.test'); }
        elseif ($verb === 'STARTTLS') {
            $say('220 listo para TLS');
            stream_context_set_option($conn, 'ssl', 'local_cert', $scenario['cert'] ?? '');
            if (!@stream_socket_enable_crypto($conn, true, STREAM_CRYPTO_METHOD_TLS_SERVER)) { $log(['tls' => 'fallo']); break; }
            $tls = true;
            $log(['tls' => 'ok']);
        } elseif ($verb === 'AUTH') {
            $parts = explode(' ', $line, 3);
            if (strtoupper($parts[1] ?? '') === 'PLAIN') {
                $dec = (string) base64_decode($parts[2] ?? '');
                $log(['auth' => str_replace("\0", '<NUL>', $dec)]);
                $say($auth === '535' ? '535 5.7.8 clave rechazada: ' . str_replace("\0", ' ', $dec) : '235 2.7.0 autenticado');
            } else {
                $say('334 VXNlcm5hbWU6');
                $u = (string) base64_decode(trim((string) fgets($conn, 4096)));
                $say('334 UGFzc3dvcmQ6');
                $p = (string) base64_decode(trim((string) fgets($conn, 4096)));
                $log(['auth' => "$u<NUL>$p"]);
                $say($auth === '535' ? '535 5.7.8 clave rechazada: ' . $u . ' ' . $p : '235 2.7.0 autenticado');
            }
        } elseif ($verb === 'MAIL') { $say($scenario['mail'] ?? '250 2.1.0 ok'); }
        elseif ($verb === 'RCPT') {
            preg_match('/<([^>]*)>/', $line, $m);
            $say(($scenario['rcpt'] ?? [])[$m[1] ?? ''] ?? '250 2.1.5 ok');
        } elseif ($verb === 'DATA') {
            $say('354 envía el mensaje, termina con un punto');
            $raw = [];
            while (($l = fgets($conn, 65536)) !== false) {
                $l = rtrim($l, "\r\n");
                if ($l === '.') break;
                $raw[] = $l;
            }
            $log(['data_raw' => $raw]);
            $log(['data' => implode("\n", array_map(function ($x) { return strncmp($x, '..', 2) === 0 ? substr($x, 1) : $x; }, $raw))]);
            $say($scenario['data'] ?? '250 2.0.0 queued as FAKE1');
        } elseif ($verb === 'QUIT') { $say('221 adiós'); break; }
        else { $say('502 orden desconocida'); }
    }
    @fclose($conn);
}
