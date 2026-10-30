<?php
/**
 * [MAIL] Envío de correo con seis controladores (config mail.driver) y el MOTIVO veraz de cada intento:
 *   resend → API HTTP de Resend (hay que verificar el dominio de order_from con SPF/DKIM)
 *   brevo  → API HTTP de Brevo (el remitente o su dominio debe estar verificado/autenticado en Brevo)
 *   smtp   → servidor SMTP (el buzón del propio hosting, Plesk o cPanel, o cualquier otro): ver Smtp.php y mail.smtp en config.sample.php
 *   mail   → función mail() de PHP (el propio hosting; devuelve true cuando el servidor LOCAL acepta el mensaje, no cuando llega: sin garantías de entrega)
 *   file   → guarda cada correo como JSON en storage/outbox (pruebas y entornos sin correo)
 *   none   → no envía nada (cualquier otro valor se trata como none: falla cerrado)
 * send() devuelve { ok, id?, reason, error?, driver, skipped?, status?, note? } SIN lanzar nunca por un fallo del proveedor:
 *   reason = sent · off (sin controlador) · failed (el proveedor respondió error o no respondió) · skipped (faltan credenciales, remitente o destinatarios).
 *   error = texto CORTO (≤ 160) y SIN secretos (scrub) para los gestores; con ok = true, un error es un AVISO (p. ej. un destinatario rechazado por el servidor SMTP).
 * Cada envío (pedido, copia al cliente, contacto y prueba) anota su resultado en la clave mail:last (solo el último, sin datos del visitante). status() lo junta con el controlador y los ajustes
 * que faltan (por NOMBRE, nunca valores) para el panel, /health y el diagnóstico.
 *
 * orderMail() compone el correo del pedido para el EQUIPO (HTML + texto, con los datos que escribió el visitante y su PDF adjunto).
 * copyMail() compone la copia para el CLIENTE: solo contenido generado por el servidor (texto fijo en el idioma del pedido, número, líneas valoradas, total); NADA escrito
 * por el visitante (ni nombre, ni empresa, ni teléfono, ni notas) y SIN adjunto: si no, el correo corporativo sería un relé de mensajes de cualquiera hacia terceros.
 * quoteMail() compone el presupuesto que un propietario o manager REENVÍA desde el panel (con el PDF adjunto): texto fijo en el idioma del pedido, líneas y total guardados, su mensaje (texto plano, escapado) y la nota del presupuesto.
 * contactMail() compone el aviso de un mensaje de contacto para el equipo (todo lo del visitante, escapado) y testMail() el correo de prueba del panel.
 */
namespace Torivac;

final class Mail
{
    /** Línea fija que acompaña al PDF en el correo al equipo: el PDF lo fabrica el navegador del cliente y no vincula. */
    const PDF_NOTE = 'El PDF adjunto lo ha generado el navegador del cliente: el importe que vale es el calculado por el servidor (arriba).';
    /** Línea fija del correo de prueba del panel. */
    const TEST_LINE = 'Si lees esto, el envío de correo de la web funciona.';
    /** Controladores de correo que se reconocen. */
    const DRIVERS = ['resend', 'brevo', 'smtp', 'mail', 'file', 'none'];
    /** Clave del almacén con el resultado del último intento de envío. */
    const KEY_LAST = 'mail:last';
    /** Remitente si order_from falta. */
    const DEFAULT_FROM = 'Torivac Web <pedidos@torivac.com>';

    /** Textos FIJOS de la copia al cliente, por idioma (es, en, fr, de). {n} = nº de líneas «a consultar». */
    private const COPY = [
        'es' => ['title' => 'Copia de tu presupuesto', 'intro' => 'Hemos recibido tu solicitud de presupuesto. Esta es la copia de lo que has pedido, con los importes calculados por Torivac.',
            'ref' => 'Ref.', 'item' => 'Artículo', 'qty' => 'Cant.', 'unit' => 'Ud.', 'amount' => 'Importe', 'total' => 'Total (sin IVA)',
            'unpriced' => '{n} línea(s) «A consultar» no incluidas en el total', 'demo' => '(PRECIOS DE DEMOSTRACIÓN)', 'ignore' => 'Si no has pedido tú este presupuesto, ignora este mensaje.'],
        'en' => ['title' => 'Copy of your quote', 'intro' => 'We have received your quote request. This is a copy of what you asked for, with the amounts calculated by Torivac.',
            'ref' => 'Ref.', 'item' => 'Item', 'qty' => 'Qty', 'unit' => 'Unit', 'amount' => 'Amount', 'total' => 'Total (excl. VAT)',
            'unpriced' => '{n} line(s) marked “On request” are not included in the total', 'demo' => '(DEMONSTRATION PRICES)', 'ignore' => 'If you did not request this quote, please ignore this message.'],
        'fr' => ['title' => 'Copie de votre devis', 'intro' => 'Nous avons bien reçu votre demande de devis. Voici une copie de ce que vous avez demandé, avec les montants calculés par Torivac.',
            'ref' => 'Réf.', 'item' => 'Article', 'qty' => 'Qté', 'unit' => 'Prix unit.', 'amount' => 'Montant', 'total' => 'Total (hors TVA)',
            'unpriced' => '{n} ligne(s) « Sur demande » non incluse(s) dans le total', 'demo' => '(PRIX DE DÉMONSTRATION)', 'ignore' => 'Si vous n’avez pas demandé ce devis, ignorez ce message.'],
        'de' => ['title' => 'Kopie Ihres Angebots', 'intro' => 'Wir haben Ihre Angebotsanfrage erhalten. Dies ist eine Kopie Ihrer Anfrage mit den von Torivac berechneten Beträgen.',
            'ref' => 'Ref.', 'item' => 'Artikel', 'qty' => 'Menge', 'unit' => 'Einzelpreis', 'amount' => 'Betrag', 'total' => 'Gesamt (ohne MwSt.)',
            'unpriced' => '{n} Position(en) „Auf Anfrage“ sind in der Summe nicht enthalten', 'demo' => '(DEMO-PREISE)', 'ignore' => 'Wenn Sie dieses Angebot nicht angefordert haben, ignorieren Sie diese Nachricht bitte.'],
    ];

    /** Textos FIJOS del correo de un presupuesto reenviado desde el panel (Quotes), por idioma. {n} = número del presupuesto. Las cabeceras de la tabla y el total salen de COPY. */
    private const QUOTE = [
        'es' => ['subject' => 'Torivac · presupuesto {n}', 'title' => 'Presupuesto', 'intro' => 'Te enviamos el presupuesto con los importes de Torivac. Lo encontrarás también adjunto en PDF.',
            'message' => 'Mensaje', 'note' => 'Nota del presupuesto', 'reply' => 'Si tienes cualquier duda, responde a este correo.'],
        'en' => ['subject' => 'Torivac · quote {n}', 'title' => 'Quote', 'intro' => 'Here is the quote with the amounts from Torivac. You will also find it attached as a PDF.',
            'message' => 'Message', 'note' => 'Quote note', 'reply' => 'If you have any questions, just reply to this email.'],
        'fr' => ['subject' => 'Torivac · devis {n}', 'title' => 'Devis', 'intro' => 'Voici le devis avec les montants de Torivac. Vous le trouverez aussi en pièce jointe au format PDF.',
            'message' => 'Message', 'note' => 'Note du devis', 'reply' => 'Pour toute question, répondez simplement à cet e-mail.'],
        'de' => ['subject' => 'Torivac · Angebot {n}', 'title' => 'Angebot', 'intro' => 'Hier ist das Angebot mit den Beträgen von Torivac. Sie finden es auch als PDF im Anhang.',
            'message' => 'Nachricht', 'note' => 'Hinweis zum Angebot', 'reply' => 'Bei Fragen antworten Sie einfach auf diese E-Mail.'],
    ];


    // ───────────────────────────────────────── [CONTROLADORES] qué se usa, con qué ajustes y qué falta
    /** ¿mail.driver tiene un valor que no es ninguno de los conocidos? (vacío o ausente = none, que no es un error). */
    public static function driverUnknown(): bool
    {
        $v = Config::get('mail.driver', '');
        return is_string($v) ? (trim($v) !== '' && !in_array(strtolower(trim($v)), self::DRIVERS, true)) : true;
    }

    /** Controlador activo según mail.driver: resend, brevo, smtp, mail, file o none; ausente o un valor desconocido = none (falla cerrado). */
    public static function driver(): string
    {
        $v = Config::get('mail.driver', 'none');
        $v = is_string($v) ? strtolower(trim($v)) : '';
        return in_array($v, self::DRIVERS, true) ? $v : 'none';
    }

    /**
     * Remitente de order_from («Nombre <correo@dominio>» o solo el correo; si falta, Torivac Web <pedidos@torivac.com>) → ['ok'=>true, 'name', 'email', 'from' (normalizado, para las APIs),
     * 'header' (para las cabeceras del correo: el nombre con caracteres no ASCII va codificado)] o ['ok'=>false] si el correo no es válido, el nombre lleva < > " \ o caracteres de control
     * (inyección de cabeceras) o es larguísimo.
     */
    public static function sender(): array
    {
        $raw = Config::get('order_from', self::DEFAULT_FROM);
        $raw = is_string($raw) && trim($raw) !== '' ? trim($raw) : self::DEFAULT_FROM;
        if (preg_match('/[\x00-\x1f\x7f]|\xc2[\x80-\x9f]|\xe2\x80[\xa8\xa9]/', $raw)) return ['ok' => false];
        if (preg_match('/^(.*?)\s*<([^<>]+)>$/s', $raw, $m)) { $name = trim($m[1]); $email = trim($m[2]); if (preg_match('/^"(.*)"$/s', $name, $q)) $name = trim($q[1]); }
        else { $name = ''; $email = $raw; }
        if (!Orders::validEmail($email) || preg_match('/["<>\\\\]/', $name) || mb_strlen($name) > 80) return ['ok' => false];
        $quoted = $name !== '' && preg_match('/[,;:@()\[\]]/', $name) ? '"' . $name . '"' : $name;
        $display = $name === '' ? '' : (preg_match('/[^\x20-\x7e]/', $name) ? self::encodeHeader($name) : $quoted);
        return ['ok' => true, 'name' => $name, 'email' => $email, 'from' => $name === '' ? $email : $quoted . ' <' . $email . '>', 'header' => $display === '' ? $email : $display . ' <' . $email . '>'];
    }

    /** Ajustes del servidor SMTP (mail.smtp): host, port, secure, user, pass, helo, timeout, insecure_tls, tls_name. */
    public static function smtpConfig(): array
    {
        $c = Config::get('mail.smtp', []);
        return is_array($c) ? $c : [];
    }

    /** Por qué NO se puede enviar ahora → ['reason' => 'off'|'skipped', 'error' => …], o null si el controlador está listo (credenciales y remitente válidos). */
    public static function blocker(string $driver): ?array
    {
        if (self::driverUnknown()) return ['reason' => 'off', 'error' => 'mail.driver no válido (usa resend, brevo, smtp, mail, file o none)'];
        if ($driver === 'none') return ['reason' => 'off', 'error' => 'Sin controlador de correo (mail.driver = none)'];
        if ($driver === 'resend' && trim((string) Config::get('mail.resend_api_key', '')) === '') return ['reason' => 'skipped', 'error' => 'Falta mail.resend_api_key'];
        if ($driver === 'brevo' && trim((string) Config::get('mail.brevo_api_key', '')) === '') return ['reason' => 'skipped', 'error' => 'Falta mail.brevo_api_key'];
        if ($driver === 'smtp') {
            $c = self::smtpConfig();
            if (trim((string) ($c['host'] ?? '')) === '') return ['reason' => 'skipped', 'error' => 'Falta mail.smtp.host'];
            if ((string) ($c['user'] ?? '') !== '' && (string) ($c['pass'] ?? '') === '') return ['reason' => 'skipped', 'error' => 'Falta mail.smtp.pass'];
        }
        if (!self::sender()['ok']) return ['reason' => 'skipped', 'error' => 'order_from no válido (usa «Nombre <correo@dominio>»)'];
        return null;
    }

    /** ¿Hay un controlador de correo listo para enviar? (no es none y tiene sus credenciales y un remitente válido) */
    public static function enabled(): bool { return self::blocker(self::driver()) === null; }

    /** Ajustes que impiden o estorban el envío (solo NOMBRES, nunca valores): mail.driver desconocido, la clave o el servidor del controlador activo, order_from y order_to. */
    public static function problems(): array
    {
        $p = [];
        $d = self::driver();
        if (self::driverUnknown()) $p[] = 'mail.driver';
        if ($d === 'resend' && trim((string) Config::get('mail.resend_api_key', '')) === '') $p[] = 'mail.resend_api_key';
        if ($d === 'brevo' && trim((string) Config::get('mail.brevo_api_key', '')) === '') $p[] = 'mail.brevo_api_key';
        if ($d === 'smtp') {
            $c = self::smtpConfig();
            if (trim((string) ($c['host'] ?? '')) === '') $p[] = 'mail.smtp.host';
            if ((string) ($c['user'] ?? '') !== '' && (string) ($c['pass'] ?? '') === '') $p[] = 'mail.smtp.pass';
            if (isset($c['secure']) && !in_array(strtolower((string) $c['secure']), ['ssl', 'tls', 'none'], true)) $p[] = 'mail.smtp.secure';
            if (isset($c['port']) && (!is_numeric($c['port']) || (int) $c['port'] < 1 || (int) $c['port'] > 65535)) $p[] = 'mail.smtp.port';
        }
        if (!self::sender()['ok']) $p[] = 'order_from';
        $to = Orders::team();
        if (!$to || array_filter($to, function ($e) { return !Orders::validEmail($e); })) $p[] = 'order_to';
        return $p;
    }

    /** Estado del correo para el panel, /health y el diagnóstico → ['driver', 'configured', 'problems' (nombres de ajustes), 'last' (último intento o null)]; nunca lleva valores secretos. */
    public static function status(): array
    {
        $d = self::driver();
        $problems = self::problems();
        return ['driver' => $d, 'configured' => $d !== 'none' && !$problems, 'problems' => $problems, 'last' => self::last()];
    }

    /** Último intento de envío guardado en mail:last → ['at', 'kind', 'ok', 'reason', 'error'?] o null si no hay ninguno o está dañado. */
    public static function last(): ?array
    {
        $o = Store::get(self::KEY_LAST);
        if (!is_array($o) || !isset($o['at']) || !is_string($o['at']) || !isset($o['kind']) || !is_string($o['kind'])) return null;
        $r = ['at' => $o['at'], 'kind' => $o['kind'], 'ok' => ($o['ok'] ?? false) === true, 'reason' => is_string($o['reason'] ?? null) ? $o['reason'] : ''];
        if (is_string($o['error'] ?? null) && $o['error'] !== '') $r['error'] = $o['error'];
        return $r;
    }

    /** Anota el resultado de un envío en mail:last (sobrescribe; un fallo al anotar nunca tapa el resultado real del envío). `$kind`: order · contact · test. */
    private static function record(string $kind, array $r, ?int $nowMs): void
    {
        try {
            $st = ['at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'kind' => $kind, 'ok' => !empty($r['ok']), 'reason' => (string) ($r['reason'] ?? (!empty($r['ok']) ? 'sent' : 'failed'))];
            if (!empty($r['error'])) $st['error'] = self::scrub($r['error']);
            Store::put(self::KEY_LAST, $st);
        } catch (\Throwable $e) { error_log('torivac-api: no se pudo anotar el último intento de correo: ' . mb_substr($e->getMessage(), 0, 160)); }
    }

    // ───────────────────────────────────────── [SECRETOS] ningún error lleva claves, contraseñas ni usuarios
    /** Valores secretos de la configuración (de claves cuyo nombre contiene key, secret, token, pass, account, auth o user), de 6 o más caracteres. */
    private static function secrets(): array
    {
        $out = [];
        $walk = function ($a) use (&$walk, &$out) {
            foreach ($a as $k => $v) {
                if (is_array($v)) { $walk($v); continue; }
                if (is_string($v) && strlen($v) >= 6 && preg_match('/key|secret|token|pass|account|auth|user/i', (string) $k)) $out[$v] = true;
            }
        };
        $walk(Config::all());
        foreach (['mail.resend_api_key', 'mail.brevo_api_key', 'mail.smtp.pass', 'mail.smtp.user', 'admin_token', 'session_secret', 'cron_token', 'turnstile_secret'] as $path) {
            $v = Config::get($path, '');
            if (is_string($v) && strlen($v) >= 6) $out[$v] = true;                          // también si vienen de una variable de entorno TORIVAC_…
        }
        $list = array_keys($out);
        usort($list, function ($a, $b) { return strlen($b) - strlen($a); });                // primero los largos
        return $list;
    }

    /**
     * Texto de UNA línea, sin secretos y de como mucho `$max` caracteres: tacha los valores exactos de los secretos de la configuración y las formas típicas de clave
     * (Bearer …, api-key: …, re_…, sk-…, xkeysib-…, cadenas opacas de 32 o más caracteres).
     */
    public static function scrub($text, int $max = 160): string
    {
        $s = Util::line(is_scalar($text) ? (string) $text : '', 2000);
        foreach (self::secrets() as $v) $s = str_replace($v, '***', $s);
        $shapes = [
            ['/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{6,}/i', '$1 ***'],
            ['/\b(api[-_ ]?key|apikey|token|secret|password|passwd|authorization)(\s*[:=]\s*)[^\s,;]+/i', '$1$2***'],
            ['/\bre_[A-Za-z0-9]{16,}/', '***'],
            ['/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{6,}/', '***'],
            ['/\bx(?:keysib|smtpsib)-[A-Za-z0-9-]{16,}/', '***'],
            ['/\b[A-Za-z0-9_-]{32,}\b/', '***'],
        ];
        foreach ($shapes as [$re, $to]) { $r = preg_replace($re, $to, $s); if ($r !== null) $s = $r; }
        return rtrim(mb_substr($s, 0, $max, 'UTF-8'));
    }

    // ───────────────────────────────────────── [ENVÍO] send → el controlador activo
    /**
     * Envía un correo por el controlador activo → ['ok', 'id'?, 'reason', 'error'?, 'driver', 'skipped'?, 'status'?, 'note'?] y anota el intento en mail:last (`$kind`: 'order' · 'contact' · 'test').
     * El asunto va siempre en una línea; un Reply-To no válido se omite; un destinatario no válido (también «a@b.co,otro») impide el envío. Nunca lanza por un fallo del proveedor.
     * @param array{to:string[],cc?:string[],subject:string,html?:string,text?:string,replyTo?:string,attachments?:array} $m
     */
    public static function send(array $m, string $kind = 'order', ?int $nowMs = null): array
    {
        $driver = self::driver();
        try { $r = self::deliver($driver, $m); }
        catch (\Throwable $e) { $r = ['ok' => false, 'reason' => 'failed', 'error' => self::scrub(get_class($e) === 'RuntimeException' ? $e->getMessage() : 'Fallo interno al enviar el correo')]; }
        $r['driver'] = $driver;
        if (!empty($r['reason']) && in_array($r['reason'], ['off', 'skipped'], true)) $r['skipped'] = true;
        if ($kind !== 'security') self::record($kind, $r, $nowMs);               // los correos de seguridad (códigos y avisos) NO se anotan: /api/health es público y enseñaría cuándo se mandó uno (y, con ello, que esa cuenta existe); sus fallos van a la actividad del panel
        return $r;
    }

    /** Prepara y envía por `$driver`, sin anotar nada. Sin controlador, credenciales, remitente o destinatarios válidos no llama a ningún proveedor. */
    private static function deliver(string $driver, array $m): array
    {
        $block = self::blocker($driver);
        if ($block) return ['ok' => false, 'reason' => $block['reason'], 'error' => $block['error']];
        $to = array_values((array) ($m['to'] ?? []));
        $cc = array_values((array) ($m['cc'] ?? []));
        if (!$to) return ['ok' => false, 'reason' => 'skipped', 'error' => 'Sin destinatarios (revisa order_to)'];
        foreach (array_merge($to, $cc) as $a) { if (!is_string($a) || !Orders::validEmail($a)) return ['ok' => false, 'reason' => 'skipped', 'error' => 'Destinatario no válido']; }     // nunca «a@b.co,otro»: una coma en To: manda el correo a quien no toca
        $sender = self::sender();
        $m['to'] = $to;
        $m['cc'] = $cc;
        $m['subject'] = trim((string) preg_replace('/[\x00-\x1f\x7f]+/', ' ', (string) ($m['subject'] ?? '')));                                           // un asunto nunca lleva saltos de línea
        $m['replyTo'] = isset($m['replyTo']) && is_string($m['replyTo']) && Orders::validEmail($m['replyTo']) ? $m['replyTo'] : '';                      // un Reply-To no válido se omite
        if ($driver === 'resend') return self::viaResend($m, $sender);
        if ($driver === 'brevo') return self::viaBrevo($m, $sender);
        if ($driver === 'smtp') return self::viaSmtp($m, $sender);
        if ($driver === 'mail') return self::viaMail($m, $sender);
        return self::viaFile($m, $sender);
    }

    /** Resend: POST /emails con la clave en Authorization. */
    private static function viaResend(array $m, array $sender): array
    {
        $body = ['from' => $sender['from'], 'to' => $m['to'], 'subject' => $m['subject'], 'html' => $m['html'] ?? '', 'text' => $m['text'] ?? ''];
        if (!empty($m['cc'])) $body['cc'] = $m['cc'];
        if ($m['replyTo'] !== '') $body['reply_to'] = $m['replyTo'];
        if (!empty($m['attachments'])) $body['attachments'] = $m['attachments'];
        $key = trim((string) Config::get('mail.resend_api_key', ''));
        return self::callProvider('Resend', rtrim((string) Config::get('mail.api_base', 'https://api.resend.com'), '/') . '/emails', ['Authorization: Bearer ' . $key, 'Content-Type: application/json'], $body, 'id');
    }

    /** Brevo: POST /v3/smtp/email con la clave en api-key (sender, to, cc, replyTo, subject, htmlContent, textContent y attachment[{name, content}]). */
    private static function viaBrevo(array $m, array $sender): array
    {
        $body = ['sender' => ($sender['name'] !== '' ? ['name' => $sender['name']] : []) + ['email' => $sender['email']], 'to' => array_map(function ($e) { return ['email' => $e]; }, $m['to']), 'subject' => $m['subject'], 'htmlContent' => $m['html'] ?? '', 'textContent' => $m['text'] ?? ''];
        if (!empty($m['cc'])) $body['cc'] = array_map(function ($e) { return ['email' => $e]; }, $m['cc']);
        if ($m['replyTo'] !== '') $body['replyTo'] = ['email' => $m['replyTo']];
        if (!empty($m['attachments'])) $body['attachment'] = array_map(function ($a) { return ['name' => (string) $a['filename'], 'content' => (string) $a['content']]; }, $m['attachments']);
        $key = trim((string) Config::get('mail.brevo_api_key', ''));
        return self::callProvider('Brevo', rtrim((string) Config::get('mail.brevo_api_base', 'https://api.brevo.com'), '/') . '/v3/smtp/email', ['api-key: ' . $key, 'Content-Type: application/json', 'accept: application/json'], $body, 'messageId');
    }

    /** POST JSON a la API de un proveedor y traduce la respuesta → ['ok'=>true,'reason'=>'sent','id'?] o ['ok'=>false,'reason'=>'failed','status'?,'error']. Cualquier 2xx cuenta como aceptado. */
    private static function callProvider(string $name, string $url, array $headers, array $body, string $idField): array
    {
        try { [$st, $resp] = Http::request('POST', $url, $headers, Util::enc($body), 15); }
        catch (\Throwable $e) { return ['ok' => false, 'reason' => 'failed', 'error' => self::scrub($name . ': ' . $e->getMessage())]; }
        if ($st === 0) return ['ok' => false, 'reason' => 'failed', 'error' => self::scrub($name . ': no se pudo conectar (sin respuesta del servicio)')];
        if ($st < 200 || $st >= 300) return ['ok' => false, 'reason' => 'failed', 'status' => $st, 'error' => self::providerError($name, $st, (string) $resp)];
        $j = json_decode((string) $resp, true);
        $id = is_array($j) && isset($j[$idField]) && is_scalar($j[$idField]) ? (string) $j[$idField] : null;
        return ['ok' => true, 'reason' => 'sent', 'id' => $id];
    }

    /** Texto corto y sin secretos del fallo de un proveedor: «Brevo 401: mensaje» (mensaje ≤ 120 caracteres) o, si no dio mensaje, «Brevo respondió 401». */
    private static function providerError(string $name, int $status, string $resp): string
    {
        $msg = '';
        $j = json_decode(substr($resp, 0, 4000), true);
        if (is_array($j)) {
            $v = $j['message'] ?? (is_array($j['error'] ?? null) ? ($j['error']['message'] ?? null) : ($j['error'] ?? null)) ?? ($j['name'] ?? null);
            if (is_string($v)) $msg = self::scrub($v, 120);
        }
        return self::scrub($msg !== '' ? $name . ' ' . $status . ': ' . $msg : $name . ' respondió ' . $status);
    }

    /** SMTP: compone el mensaje completo y lo entrega con Smtp (destinatarios = to + cc). Un destinatario rechazado por el servidor no impide el envío a los demás, pero se avisa. */
    private static function viaSmtp(array $m, array $sender): array
    {
        $data = self::message($sender, $m);
        $r = Smtp::send(self::smtpConfig(), $sender['email'], array_merge($m['to'], $m['cc']), $data);
        if (empty($r['ok'])) return ['ok' => false, 'reason' => 'failed', 'error' => self::scrub($r['error'] ?? 'SMTP: fallo de envío')];
        $out = ['ok' => true, 'reason' => 'sent'];
        if (!empty($r['rejected'])) $out['error'] = self::scrub('El servidor SMTP rechazó a: ' . implode('; ', $r['rejected']));
        return $out;
    }

    /** mail() de PHP: true = lo aceptó el servicio de correo LOCAL del hosting (no que llegue); false = lo rechazó. Pasa el remitente al sobre con -f cuando es seguro. */
    private static function viaMail(array $m, array $sender): array
    {
        if (!function_exists('mail')) return ['ok' => false, 'reason' => 'failed', 'error' => 'La función mail() no está disponible en este hosting'];
        [$headers, $body] = self::mime($sender['header'], $m);
        $extra = preg_match('/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/', $sender['email']) ? '-f' . $sender['email'] : '';
        $ok = $extra !== '' ? @mail(implode(',', $m['to']), self::encodeHeader($m['subject']), $body, $headers, $extra) : @mail(implode(',', $m['to']), self::encodeHeader($m['subject']), $body, $headers);
        return $ok ? ['ok' => true, 'reason' => 'sent', 'note' => 'mail() no garantiza la entrega'] : ['ok' => false, 'reason' => 'failed', 'error' => 'mail() devolvió false (revisa el servicio de correo del hosting)'];
    }

    /** file: guarda el correo como JSON en la carpeta outbox de los datos (pruebas y entornos sin correo: no sale por correo). */
    private static function viaFile(array $m, array $sender): array
    {
        $f = Store::root() . '/outbox/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.json';
        if (empty($m['cc'])) unset($m['cc']);
        if (($m['replyTo'] ?? '') === '') unset($m['replyTo']);
        if (@file_put_contents($f, Util::enc($m + ['from' => $sender['from']])) === false) return ['ok' => false, 'reason' => 'failed', 'error' => 'No se pudo escribir en la carpeta outbox'];
        @chmod($f, Store::FILE_MODE);
        return ['ok' => true, 'reason' => 'sent', 'id' => basename($f), 'note' => 'solo guardado en outbox, no sale por correo'];
    }

    /** Codifica un texto con caracteres no ASCII como palabras MIME UTF-8 en base64 (varias, de como mucho ~45 bytes, sin partir un carácter) unidas por un salto de línea plegado. */
    private static function encodeHeader(string $s): string
    {
        if (!preg_match('/[^\x20-\x7e]/', $s)) return $s;
        $words = []; $cur = '';
        foreach (preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: [$s] as $ch) {
            if ($cur !== '' && strlen($cur . $ch) > 45) { $words[] = $cur; $cur = ''; }
            $cur .= $ch;
        }
        if ($cur !== '') $words[] = $cur;
        return implode("\r\n ", array_map(function ($w) { return '=?UTF-8?B?' . base64_encode($w) . '?='; }, $words));
    }

    /** Mensaje completo para SMTP: Date, Message-ID, To, Subject y las cabeceras MIME de mime(), una línea en blanco y el cuerpo. */
    public static function message(array $sender, array $m): string
    {
        [$headers, $body] = self::mime($sender['header'], $m);
        $domain = substr((string) strrchr($sender['email'], '@'), 1);
        $extra = ['Date: ' . gmdate('D, d M Y H:i:s') . ' +0000', 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>', 'To: ' . implode(', ', $m['to']), 'Subject: ' . self::encodeHeader((string) $m['subject'])];
        return implode("\r\n", $extra) . "\r\n" . $headers . "\r\n\r\n" . $body;
    }

    /** cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail() y SMTP */
    public static function mime(string $from, array $m): array
    {
        $b1 = 'tv-' . bin2hex(random_bytes(8));
        $b2 = 'tv-' . bin2hex(random_bytes(8));
        $h = ['From: ' . preg_replace('/[\r\n]+(?![ \t])/', ' ', $from), 'MIME-Version: 1.0'];
        $cc = array_filter((array) ($m['cc'] ?? []), function ($a) { return is_string($a) && Orders::validEmail($a); });
        if ($cc) $h[] = 'Cc: ' . implode(', ', $cc);
        if (!empty($m['replyTo']) && is_string($m['replyTo']) && Orders::validEmail($m['replyTo'])) $h[] = 'Reply-To: ' . $m['replyTo'];
        $alt = "--$b2\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($m['text'] ?? '')) .
            "--$b2\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($m['html'] ?? '')) . "--$b2--\r\n";
        if (empty($m['attachments'])) {
            $h[] = "Content-Type: multipart/alternative; boundary=\"$b2\"";
            return [implode("\r\n", $h), $alt];
        }
        $h[] = "Content-Type: multipart/mixed; boundary=\"$b1\"";
        $body = "--$b1\r\nContent-Type: multipart/alternative; boundary=\"$b2\"\r\n\r\n$alt";
        foreach ($m['attachments'] as $a) {
            $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $a['filename']);
            $content = preg_replace('/[^A-Za-z0-9+\/=]/', '', (string) $a['content']);                       // solo base64: ni saltos ni cabeceras colados en el adjunto
            $body .= "--$b1\r\nContent-Type: application/pdf; name=\"$name\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n" . chunk_split($content);
        }
        return [implode("\r\n", $h), $body . "--$b1--\r\n"];
    }


    // ───────────────────────────────────────── [CONTACTO Y PRUEBA] correos que no son pedidos
    /**
     * Aviso de un mensaje de contacto PARA EL EQUIPO → ['subject', 'html', 'text']. Asunto «Contacto web · <nombre>» en una línea; nombre, correo, idioma, id del mensaje y texto del visitante
     * van SIEMPRE escapados en el HTML (aunque el formulario ya solo admite texto plano); el Reply-To lo pone quien envía (send). Es dato no fiable: aquí solo se muestra.
     * @param array{id:string,name:string,email:string,lang:string,message:string} $r
     */
    public static function contactMail(array $r): array
    {
        $n = Util::line($r['name'] ?? '', 120); $e = Util::line($r['email'] ?? '', 254); $l = Util::line($r['lang'] ?? '', 8); $i = Util::line($r['id'] ?? '', 40);
        $msg = (string) ($r['message'] ?? '');
        $html = '<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Mensaje de contacto de la web</h2>' .
            '<p><b>' . Util::esc($n) . '</b> &lt;' . Util::esc($e) . '&gt;<br><span style="color:#777;font-size:12px">Idioma: ' . Util::esc($l) . ' · Mensaje ' . Util::esc($i) . '</span></p>' .
            '<p>' . nl2br(Util::esc($msg), false) . '</p>' .
            '<p style="color:#777;font-size:12px">Responde a este correo para escribir a ' . Util::esc($n) . '. El mensaje queda guardado en el panel (Mensajes) con el id ' . Util::esc($i) . '.</p></div>';
        $text = implode("\n", ['Mensaje de contacto de la web', 'Nombre: ' . $n, 'Correo: ' . $e, 'Idioma: ' . $l, 'Mensaje: ' . $i, '', $msg, '', 'Responde a este correo para escribir a ' . $n . '. Queda guardado en el panel (Mensajes) con el id ' . $i . '.']);
        return ['subject' => 'Contacto web · ' . $n, 'html' => $html, 'text' => $text];
    }

    /** Correo de PRUEBA del panel → ['subject', 'html', 'text']: asunto «Torivac · prueba de correo», texto fijo y, como datos, el controlador y la hora (ISO). */
    public static function testMail(string $driver, string $at): array
    {
        $d = Util::line($driver, 20); $t = Util::line($at, 40);
        return ['subject' => 'Torivac · prueba de correo', 'html' => '<div style="font-family:Arial,sans-serif;max-width:720px"><p>' . Util::esc(self::TEST_LINE) . '</p><p style="color:#777;font-size:12px">Controlador: ' . Util::esc($d) . ' · Hora: ' . Util::esc($t) . '</p></div>', 'text' => self::TEST_LINE . "\n\nControlador: " . $d . "\nHora: " . $t];
    }

    /** importe con el formato del idioma del cliente (es 1.234,56 €, en €1,234.56, fr 1 234,56 €, de 1.234,56 €) */
    public static function money($n, string $lang = 'es'): string
    {
        if ($n === null) return '—';
        $nb = "\u{00a0}";
        switch ($lang) {
            case 'en': return '€' . number_format((float) $n, 2, '.', ',');
            case 'fr': return number_format((float) $n, 2, ',', "\u{202f}") . $nb . '€';
            default: return number_format((float) $n, 2, ',', '.') . $nb . '€';
        }
    }

    /**
     * Correo del pedido PARA EL EQUIPO. `$d['pdf']` (bool) dice si lleva el PDF del cliente: entonces añade la línea fija de que lo generó el navegador y el importe que vale es el del servidor.
     * @return array{html:string,text:string}
     */
    public static function orderMail(array $d, array $items): array
    {
        $lang = $d['lang']; $c = $d['customer']; $p = $d['priced']; $number = $d['number']; $demo = !empty($d['demo']); $pdf = !empty($d['pdf']);
        $e = function ($v) { return Util::esc($v); };
        $rows = '';
        foreach ($p['lines'] as $l) {
            $rows .= '<tr><td style="font-family:monospace">' . $e($l['ref']) . '</td><td>' . $e($items[$l['ref']]['n'] ?? '') . '</td><td style="text-align:right">' . (int) $l['qty'] . '</td><td style="text-align:right">' . $e(self::money($l['unit'], $lang)) . '</td><td style="text-align:right"><b>' . $e(self::money($l['total'], $lang)) . '</b></td></tr>';
        }
        $html = '<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Nuevo pedido ' . $e($number) . ($demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : '') . '</h2>' .
            '<p><b>' . $e($c['name']) . '</b> ' . ($c['company'] !== '' ? '· ' . $e($c['company']) : '') . '<br>' . $e($c['email']) . ($c['phone'] !== '' ? ' · ' . $e($c['phone']) : '') . '</p>' .
            '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Ud.</th><th>Importe</th></tr>' . $rows . '</table>' .
            '<p style="text-align:right;font-size:18px">Total (sin IVA): <b>' . $e(self::money($p['total'], $lang)) . '</b>' . ($p['unpriced'] ? '<br><small>' . (int) $p['unpriced'] . ' línea(s) «A consultar» no incluidas en el total</small>' : '') . '</p>' .
            ($c['notes'] !== '' ? '<p><b>Notas:</b> ' . $e($c['notes']) . '</p>' : '') . '<p style="color:#777;font-size:12px">Idioma del cliente: ' . $e($lang) . '</p>' .
            ($pdf ? '<p style="color:#9c520f;font-size:12px"><b>' . $e(self::PDF_NOTE) . '</b></p>' : '') . '</div>';
        $lines = ['Nuevo pedido ' . $number . ($demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''), $c['name'] . ' <' . $c['email'] . '> ' . $c['phone'], ''];
        foreach ($p['lines'] as $l) $lines[] = $l['ref'] . "\t" . ($items[$l['ref']]['n'] ?? '') . "\tx" . (int) $l['qty'] . "\t" . self::money($l['total'], $lang);
        $lines[] = '';
        $lines[] = 'Total (sin IVA): ' . self::money($p['total'], $lang);
        if ($c['notes'] !== '') { $lines[] = ''; $lines[] = 'Notas: ' . $c['notes']; }
        if ($pdf) { $lines[] = ''; $lines[] = self::PDF_NOTE; }
        return ['html' => $html, 'text' => implode("\n", $lines)];
    }

    /**
     * Copia del presupuesto PARA EL CLIENTE: asunto fijo «Torivac · copia de tu presupuesto <número>», sin adjunto, y un cuerpo hecho SOLO con texto fijo en el idioma del pedido
     * (es, en, fr, de), el número de pedido, las líneas (referencia, nombre del catálogo, cantidad e importes valorados por el servidor), el total y la línea de «si no lo has pedido tú,
     * ignóralo». No usa ningún dato escrito por el visitante: ni nombre, ni empresa, ni teléfono, ni notas.
     * @return array{subject:string,html:string,text:string}
     */
    public static function copyMail(array $d, array $items): array
    {
        $lang = in_array($d['lang'] ?? 'es', Orders::LANGS, true) ? $d['lang'] : 'es';
        $t = self::COPY[$lang];
        $p = $d['priced'];
        $number = (string) $d['number'];
        $demo = !empty($d['demo']);
        $e = function ($v) { return Util::esc($v); };
        $rows = '';
        $lines = [$t['title'] . ' ' . $number . ($demo ? ' ' . $t['demo'] : ''), '', $t['intro'], ''];
        foreach ($p['lines'] as $l) {
            $name = (string) ($items[$l['ref']]['n'] ?? '');
            $rows .= '<tr><td style="font-family:monospace">' . $e($l['ref']) . '</td><td>' . $e($name) . '</td><td style="text-align:right">' . (int) $l['qty'] . '</td><td style="text-align:right">' . $e(self::money($l['unit'], $lang)) . '</td><td style="text-align:right"><b>' . $e(self::money($l['total'], $lang)) . '</b></td></tr>';
            $lines[] = $l['ref'] . "\t" . $name . "\tx" . (int) $l['qty'] . "\t" . self::money($l['total'], $lang);
        }
        $unpriced = $p['unpriced'] ? str_replace('{n}', (string) (int) $p['unpriced'], $t['unpriced']) : '';
        $lines[] = '';
        $lines[] = $t['total'] . ': ' . self::money($p['total'], $lang);
        if ($unpriced !== '') $lines[] = $unpriced;
        $lines[] = '';
        $lines[] = $t['ignore'];
        $html = '<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">' . $e($t['title']) . ' ' . $e($number) . ($demo ? ' ' . $e($t['demo']) : '') . '</h2>' .
            '<p>' . $e($t['intro']) . '</p>' .
            '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>' . $e($t['ref']) . '</th><th>' . $e($t['item']) . '</th><th>' . $e($t['qty']) . '</th><th>' . $e($t['unit']) . '</th><th>' . $e($t['amount']) . '</th></tr>' . $rows . '</table>' .
            '<p style="text-align:right;font-size:18px">' . $e($t['total']) . ': <b>' . $e(self::money($p['total'], $lang)) . '</b>' . ($unpriced !== '' ? '<br><small>' . $e($unpriced) . '</small>' : '') . '</p>' .
            '<p style="color:#777;font-size:12px">' . $e($t['ignore']) . '</p></div>';
        return ['subject' => 'Torivac · copia de tu presupuesto ' . $number, 'html' => $html, 'text' => implode("\n", $lines)];
    }

    /**
     * Correo de un presupuesto REENVIADO desde el panel (POST /orders/:número/send) → ['subject', 'html', 'text']. Asunto y texto fijos del servidor en el idioma del pedido (es, en, fr, de);
     * la tabla lleva las líneas y el total GUARDADOS en el registro (nunca los de la tarifa de hoy); el mensaje de la persona (`message`) y la nota del presupuesto (`note`) son texto plano
     * y salen SIEMPRE escapados, con los saltos de línea como <br>. El PDF va como adjunto (lo añade quien llama) y nada de lo que llega es HTML.
     * @param array{number:string,lang?:string,lines?:array,total?:mixed,unpriced?:mixed,demo?:bool,message?:string,note?:string} $d
     * @return array{subject:string,html:string,text:string}
     */
    public static function quoteMail(array $d, array $items): array
    {
        $lang = in_array($d['lang'] ?? 'es', Orders::LANGS, true) ? $d['lang'] : 'es';
        $c = self::COPY[$lang];
        $q = self::QUOTE[$lang];
        $number = (string) $d['number'];
        $demo = !empty($d['demo']);
        $message = (string) ($d['message'] ?? '');
        $note = (string) ($d['note'] ?? '');
        $e = function ($v) { return Util::esc($v); };
        $intro = str_replace('{n}', $number, $q['intro']);
        $rows = '';
        $lines = [$q['title'] . ' ' . $number . ($demo ? ' ' . $c['demo'] : ''), '', $intro, ''];
        if ($message !== '') { $lines[] = $q['message'] . ':'; $lines[] = $message; $lines[] = ''; }
        foreach ((array) ($d['lines'] ?? []) as $l) {
            $ref = (string) ($l['ref'] ?? '');
            $name = (string) ($items[$ref]['n'] ?? '');
            $qty = (int) ($l['qty'] ?? 0);
            $rows .= '<tr><td style="font-family:monospace">' . $e($ref) . '</td><td>' . $e($name) . '</td><td style="text-align:right">' . $qty . '</td><td style="text-align:right">' . $e(self::money($l['unit'] ?? null, $lang)) . '</td><td style="text-align:right"><b>' . $e(self::money($l['total'] ?? null, $lang)) . '</b></td></tr>';
            $lines[] = $ref . "\t" . $name . "\tx" . $qty . "\t" . self::money($l['total'] ?? null, $lang);
        }
        $unpriced = !empty($d['unpriced']) ? str_replace('{n}', (string) (int) $d['unpriced'], $c['unpriced']) : '';
        $lines[] = '';
        $lines[] = $c['total'] . ': ' . self::money($d['total'] ?? 0, $lang);
        if ($unpriced !== '') $lines[] = $unpriced;
        if ($note !== '') { $lines[] = ''; $lines[] = $q['note'] . ':'; $lines[] = $note; }
        $lines[] = '';
        $lines[] = $q['reply'];
        $html = '<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">' . $e($q['title']) . ' ' . $e($number) . ($demo ? ' ' . $e($c['demo']) : '') . '</h2>' .
            '<p>' . $e($intro) . '</p>' .
            ($message !== '' ? '<p style="border-left:3px solid #9c520f;padding-left:10px"><b>' . $e($q['message']) . '</b><br>' . nl2br($e($message), false) . '</p>' : '') .
            '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>' . $e($c['ref']) . '</th><th>' . $e($c['item']) . '</th><th>' . $e($c['qty']) . '</th><th>' . $e($c['unit']) . '</th><th>' . $e($c['amount']) . '</th></tr>' . $rows . '</table>' .
            '<p style="text-align:right;font-size:18px">' . $e($c['total']) . ': <b>' . $e(self::money($d['total'] ?? 0, $lang)) . '</b>' . ($unpriced !== '' ? '<br><small>' . $e($unpriced) . '</small>' : '') . '</p>' .
            ($note !== '' ? '<p><b>' . $e($q['note']) . '</b><br>' . nl2br($e($note), false) . '</p>' : '') .
            '<p style="color:#777;font-size:12px">' . $e($q['reply']) . '</p></div>';
        return ['subject' => str_replace('{n}', $number, $q['subject']), 'html' => $html, 'text' => implode("\n", $lines)];
    }
}
