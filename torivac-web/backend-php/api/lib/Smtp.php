<?php
/**
 * [SMTP] Cliente SMTP mínimo y seguro (sin librerías) para enviar el correo por el buzón del propio hosting (Plesk, cPanel…) o por cualquier servidor SMTP.
 * Habla con stream_socket_client: saludo 220 → EHLO → STARTTLS (secure = tls) → AUTH PLAIN o LOGIN → MAIL FROM → RCPT TO (uno por destinatario) → DATA → QUIT.
 *   · Cifrado: secure = 'ssl' (TLS implícito, puerto 465), 'tls' (STARTTLS, puerto 587; si el servidor no lo ofrece NO se envía) o 'none' (sin cifrar, puerto 25). El certificado del servidor se
 *     VERIFICA (cadena y nombre) salvo insecure_tls = true; tls_name permite comprobar el certificado contra otro nombre que el host al que se conecta (p. ej. conectar a 127.0.0.1
 *     y verificar «mail.midominio.com»).
 *   · Contraseña: nunca viaja sin cifrar por una red (secure = none solo se admite con usuario y contraseña si el servidor es la propia máquina: 127.0.0.1, ::1 o localhost).
 *   · Cada respuesta se comprueba. Si algo falla, el error es «SMTP <código> <texto>» (≤ 100 caracteres del texto del servidor) o un texto propio; JAMÁS lleva el usuario ni la contraseña.
 *   · Remitente, destinatarios, usuario y contraseña no admiten saltos de línea ni caracteres de control (inyección de órdenes SMTP o de cabeceras): se rechazan antes de conectar.
 *   · Nada se queda colgado: tiempo total de la conversación `timeout` (15 s por defecto, 3..60) y, para el envío del mensaje, hasta 30 s más.
 *   · DATA con CRLF y «dot-stuffing» (una línea que empieza por punto lleva otro punto delante).
 * Si el servidor acepta al menos un destinatario, el mensaje se envía a esos y los rechazados se devuelven en `rejected` (el aviso lo da Mail); si rechaza a todos, es un error.
 */
namespace Torivac;

final class Smtp
{
    /** Tiempo total por defecto de la conversación, en segundos. */
    const TIMEOUT = 15;
    /** Segundos extra que se conceden al envío del cuerpo del mensaje (adjuntos grandes). */
    const DATA_EXTRA = 30;
    /** Líneas y bytes máximos de una respuesta del servidor (un servidor hostil no puede agotar la memoria). */
    const MAX_REPLY_LINES = 200;
    const MAX_REPLY_BYTES = 65536;

    /**
     * Envía un mensaje ya compuesto (cabeceras + cuerpo MIME) por SMTP.
     * @param array{host:string,port?:int,secure?:string,user?:string,pass?:string,helo?:string,timeout?:int,insecure_tls?:bool,tls_name?:string} $cfg
     * @param string[] $rcpts destinatarios (sobre)
     * @return array{ok:bool,error?:string,rejected?:string[],text?:string}
     */
    public static function send(array $cfg, string $mailFrom, array $rcpts, string $data): array
    {
        $secure = strtolower(trim((string) ($cfg['secure'] ?? 'tls')));
        $host = trim((string) ($cfg['host'] ?? ''));
        $port = (int) ($cfg['port'] ?? ($secure === 'ssl' ? 465 : ($secure === 'none' ? 25 : 587)));
        $user = (string) ($cfg['user'] ?? '');
        $pass = (string) ($cfg['pass'] ?? '');
        $timeout = max(3, min(60, (int) ($cfg['timeout'] ?? self::TIMEOUT)));
        $bad = self::problem($host, $port, $secure, $user, $pass, $mailFrom, $rcpts);
        if ($bad !== null) return ['ok' => false, 'error' => $bad];
        $ssl = !empty($cfg['insecure_tls'])
            ? ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]
            : ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false, 'peer_name' => (string) (($cfg['tls_name'] ?? '') !== '' ? $cfg['tls_name'] : $host)];
        $ssl['SNI_enabled'] = true;
        $ssl['SNI_server_name'] = (string) (($cfg['tls_name'] ?? '') !== '' ? $cfg['tls_name'] : $host);
        $where = $host . ':' . $port;
        $deadline = microtime(true) + $timeout;
        $fp = null;
        try {
            $errno = 0; $errstr = '';
            $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . (strpos($host, ':') !== false ? '[' . $host . ']' : $host) . ':' . $port;
            $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => $ssl]));
            if (!$fp) throw new \RuntimeException('SMTP: no se pudo conectar a ' . $where . ' (' . self::why($errstr, $errno) . ')');
            [$code, $text] = self::reply($fp, $deadline, $where);
            if ($code !== 220) throw self::fail($code, $text);
            $helo = self::heloName($cfg);
            [$code, $text] = self::cmd($fp, 'EHLO ' . $helo, $deadline, $where);
            if ($code !== 250) { [$code, $text] = self::cmd($fp, 'HELO ' . $helo, $deadline, $where); if ($code !== 250) throw self::fail($code, $text); }
            $caps = self::caps($text);
            if ($secure === 'tls') {
                if (!isset($caps['STARTTLS'])) throw new \RuntimeException('SMTP: el servidor ' . $where . ' no ofrece STARTTLS (usa secure = ssl o none, o revisa el puerto)');
                [$code, $text] = self::cmd($fp, 'STARTTLS', $deadline, $where);
                if ($code !== 220) throw self::fail($code, $text);
                stream_context_set_option($fp, ['ssl' => $ssl]);
                $ok = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($ok !== true) throw new \RuntimeException('SMTP: no se pudo cifrar la conexión con ' . $where . ' (' . self::why('', 0) . ')');
                [$code, $text] = self::cmd($fp, 'EHLO ' . $helo, $deadline, $where);
                if ($code !== 250) throw self::fail($code, $text);
                $caps = self::caps($text);
            }
            if ($user !== '') self::auth($fp, $caps, $user, $pass, $deadline, $where);
            [$code, $text] = self::cmd($fp, 'MAIL FROM:<' . $mailFrom . '>', $deadline, $where);
            if ($code !== 250) throw self::fail($code, $text);
            $accepted = []; $rejected = []; $firstFail = null;
            foreach ($rcpts as $r) {
                [$code, $text] = self::cmd($fp, 'RCPT TO:<' . $r . '>', $deadline, $where);
                if ($code === 250 || $code === 251) $accepted[] = $r;
                else { $rejected[] = $r . ' (' . self::short($code, $text) . ')'; if ($firstFail === null) $firstFail = [$code, $text]; }
            }
            if (!$accepted) throw self::fail($firstFail[0], $firstFail[1]);
            [$code, $text] = self::cmd($fp, 'DATA', $deadline, $where);
            if ($code !== 354) throw self::fail($code, $text);
            $body = (string) preg_replace('/^\./m', '..', (string) preg_replace('/\r\n|\r|\n/', "\r\n", $data));
            if (substr($body, -2) !== "\r\n") $body .= "\r\n";
            $deadline = max($deadline, microtime(true) + self::DATA_EXTRA);
            self::write($fp, $body . ".\r\n", $deadline, $where);
            [$code, $text] = self::reply($fp, $deadline, $where);
            if ($code !== 250) throw self::fail($code, $text);
            try { self::write($fp, "QUIT\r\n", microtime(true) + 3, $where); } catch (\Throwable $e) { /* el mensaje ya está entregado */ }
            return ['ok' => true, 'rejected' => $rejected, 'text' => self::oneLine($text, 100)];
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            foreach ([$pass, $user] as $secret) { if (strlen($secret) >= 3) $msg = str_replace([$secret, base64_encode($secret)], '***', $msg); }          // un servidor que repite la contraseña o el usuario en su error no los destapa
            return ['ok' => false, 'error' => self::oneLine($msg, 200)];
        } finally {
            if (is_resource($fp)) @fclose($fp);
        }
    }

    /** Primer problema de los datos de entrada (null = todo bien): servidor, puerto, cifrado, usuario, contraseña, remitente y destinatarios. */
    private static function problem(string $host, int $port, string $secure, string $user, string $pass, string $mailFrom, array $rcpts): ?string
    {
        if ($host === '' || !preg_match('/^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?|[0-9A-Fa-f:.]+)$/', $host)) return 'SMTP: mail.smtp.host no es un servidor válido';
        if ($port < 1 || $port > 65535) return 'SMTP: mail.smtp.port no es un puerto válido';
        if (!in_array($secure, ['ssl', 'tls', 'none'], true)) return 'SMTP: mail.smtp.secure debe ser ssl, tls o none';
        if (preg_match('/[\x00-\x1f\x7f]/', $user . $pass)) return 'SMTP: el usuario o la contraseña llevan caracteres no válidos';
        if ($user !== '' && $pass === '') return 'SMTP: falta mail.smtp.pass';
        if ($user !== '' && $secure === 'none' && !in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true)) return 'SMTP: no se envía la contraseña sin cifrar a ' . $host . ' (usa secure = ssl o tls)';
        if (!Orders::validEmail($mailFrom)) return 'SMTP: remitente no válido';
        if (!$rcpts) return 'SMTP: sin destinatarios';
        foreach ($rcpts as $r) if (!is_string($r) || !Orders::validEmail($r)) return 'SMTP: destinatario no válido';
        return null;
    }

    /** Nombre con el que nos presentamos en EHLO: mail.smtp.helo, o el del servidor web, o el de la máquina; solo letras, cifras, puntos y guiones. */
    private static function heloName(array $cfg): string
    {
        foreach ([(string) ($cfg['helo'] ?? ''), (string) ($_SERVER['SERVER_NAME'] ?? ''), (string) @gethostname()] as $n) {
            $n = preg_replace('/[^A-Za-z0-9.-]/', '', $n);
            if ($n !== '' && strlen($n) <= 253) return $n;
        }
        return 'localhost';
    }

    /** Capacidades que anuncia el servidor en su respuesta a EHLO: nombre en mayúsculas → resto de la línea. */
    private static function caps(string $text): array
    {
        $o = [];
        foreach (explode("\n", $text) as $i => $line) {
            if ($i === 0) continue;                                        // la primera línea es el saludo del servidor, no una capacidad
            $parts = preg_split('/\s+/', trim($line), 2);
            if ($parts && $parts[0] !== '') $o[strtoupper($parts[0])] = $parts[1] ?? '';
        }
        return $o;
    }

    /** Autentica con PLAIN (si lo anuncia) o LOGIN. Error: «SMTP 535 …» si el servidor rechaza las credenciales; nunca incluye el usuario ni la contraseña. */
    private static function auth($fp, array $caps, string $user, string $pass, float $deadline, string $where): void
    {
        $mechs = isset($caps['AUTH']) ? preg_split('/\s+/', strtoupper($caps['AUTH'])) : [];
        if (in_array('PLAIN', $mechs, true)) {
            [$code, $text] = self::cmd($fp, 'AUTH PLAIN ' . base64_encode("\0" . $user . "\0" . $pass), $deadline, $where, true);
            if ($code !== 235) throw self::fail($code, $text);
        } elseif (in_array('LOGIN', $mechs, true)) {
            [$code, $text] = self::cmd($fp, 'AUTH LOGIN', $deadline, $where);
            if ($code !== 334) throw self::fail($code, $text);
            [$code, $text] = self::cmd($fp, base64_encode($user), $deadline, $where, true);
            if ($code !== 334) throw self::fail($code, $text);
            [$code, $text] = self::cmd($fp, base64_encode($pass), $deadline, $where, true);
            if ($code !== 235) throw self::fail($code, $text);
        } else {
            throw new \RuntimeException('SMTP: el servidor ' . $where . ' no ofrece autenticación PLAIN ni LOGIN');
        }
    }

    /** Envía una orden (sin CR/LF dentro) y devuelve la respuesta [código, texto]. `$secret` = la orden lleva credenciales: nunca entra en ningún mensaje de error. */
    private static function cmd($fp, string $line, float $deadline, string $where, bool $secret = false): array
    {
        if (preg_match('/[\r\n\x00]/', $line)) throw new \RuntimeException('SMTP: orden con caracteres no válidos');
        self::write($fp, $line . "\r\n", $deadline, $where);
        return self::reply($fp, $deadline, $where);
    }

    /** Escribe todo el texto, por trozos, sin pasarse del plazo. */
    private static function write($fp, string $s, float $deadline, string $where): void
    {
        $len = strlen($s);
        for ($off = 0; $off < $len;) {
            $rem = $deadline - microtime(true);
            if ($rem <= 0) throw new \RuntimeException('SMTP: sin respuesta de ' . $where . ' en el tiempo permitido');
            stream_set_timeout($fp, max(1, (int) ceil($rem)));
            $n = @fwrite($fp, substr($s, $off, 16384));
            if ($n === false || $n === 0) throw new \RuntimeException('SMTP: ' . $where . ' cerró la conexión');
            $off += $n;
        }
    }

    /** Lee una respuesta completa (varias líneas «250-…» y la última «250 …») → [código, texto de las líneas unidas por salto]. Con tope de líneas, de bytes y de tiempo. */
    private static function reply($fp, float $deadline, string $where): array
    {
        $texts = []; $bytes = 0;
        for ($i = 0; $i < self::MAX_REPLY_LINES; $i++) {
            $rem = $deadline - microtime(true);
            if ($rem <= 0) throw new \RuntimeException('SMTP: sin respuesta de ' . $where . ' en el tiempo permitido');
            stream_set_timeout($fp, max(1, (int) ceil($rem)));
            $line = fgets($fp, 2048);
            if ($line === false) {
                $meta = stream_get_meta_data($fp);
                throw new \RuntimeException(!empty($meta['timed_out']) ? 'SMTP: sin respuesta de ' . $where . ' en el tiempo permitido' : 'SMTP: ' . $where . ' cerró la conexión');
            }
            $bytes += strlen($line);
            if ($bytes > self::MAX_REPLY_BYTES) throw new \RuntimeException('SMTP: respuesta demasiado larga de ' . $where);
            if (!preg_match('/^(\d{3})([ -])(.*)$/', rtrim($line, "\r\n"), $m)) throw new \RuntimeException('SMTP: respuesta que no es SMTP de ' . $where);
            $texts[] = $m[3];
            if ($m[2] === ' ') return [(int) $m[1], implode("\n", $texts)];
        }
        throw new \RuntimeException('SMTP: respuesta demasiado larga de ' . $where);
    }

    /** Excepción «SMTP <código> <texto>» para una respuesta que no es la esperada. */
    private static function fail(int $code, string $text): \RuntimeException
    {
        return new \RuntimeException('SMTP ' . self::short($code, $text));
    }

    /** «550 5.1.1 texto…» recortado a 100 caracteres y en una línea. */
    private static function short(int $code, string $text): string { return self::oneLine($code . ' ' . $text, 104); }

    /** Texto de UNA línea recortado a `$max` caracteres (sin saltos ni caracteres de control). */
    private static function oneLine(string $s, int $max): string
    {
        $t = trim((string) preg_replace('/[\x00-\x1f\x7f\s]+/', ' ', $s));
        return function_exists('mb_substr') ? mb_substr($t, 0, $max, 'UTF-8') : substr($t, 0, $max);
    }

    /** Motivo legible de un fallo de conexión o de cifrado: el texto del sistema y, si lo hay, la causa de OpenSSL (certificado caducado, nombre que no coincide…). */
    private static function why(string $errstr, int $errno): string
    {
        $last = error_get_last();
        $msg = trim($errstr !== '' ? $errstr : ($last['message'] ?? ''));
        if (preg_match('/error:[0-9A-F]+:[^:]*:[^:]*:(.+)$/', $msg, $m)) $msg = trim($m[1]);        // «error:0A000086:SSL routines::certificate verify failed» → «certificate verify failed»
        $msg = preg_replace('/^(stream_socket_client|stream_socket_enable_crypto)\(\): /', '', $msg);
        return self::oneLine($msg !== '' ? $msg : ($errno ? 'error ' . $errno : 'sin detalle'), 120);
    }
}
