<?php
/**
 * [ORDERS] POST /api/order y POST /api/contact: valida lo que llega del navegador (no es fiable), valora el pedido en servidor con los precios
 * VIGENTES (ignora cualquier precio que mande el cliente), numera TV-AAAAMMDD-NNNN, guarda y envía por correo al equipo (con el PDF) y, si procede, una copia al cliente.
 * Defensas: honeypot, límite por visitante (Request::ipKey) y límite global de pedidos por hora, Turnstile opcional, referencias solo del catálogo (o añadidas por la hoja de
 * precios), cantidades enteras 1..1 000 000, todos los campos de texto deben ser cadenas, los de una línea no admiten saltos ni caracteres de control, y el PDF se valida de verdad.
 *
 * [COPIA-AL-CLIENTE] Hoy cualquiera puede enviar un pedido: la copia no puede llevar nada que haya escrito el visitante (ver Mail::copyMail) ni adjunto. Modo `order_copy`:
 *   'capped' (por defecto) = se envía con topes: 2 copias por destinatario cada 24 h (clave = sha256 del correo) y `order_copy_daily_max` (150) al día en total;
 *   'off' o CUALQUIER otro valor = nunca se envía copia (falla cerrado; «capped» se reconoce sin importar mayúsculas ni espacios). Superado un tope el pedido se registra y se avisa al equipo igual; solo la copia no sale.
 * La respuesta dice qué pasó con la copia en emailed.customer_reason: sent · not_requested · off · limit · failed · skipped (correo sin configurar).
 * [PDF] El PDF que manda el navegador solo va al EQUIPO: base64 estricto, decodificado empieza por «%PDF-» y pesa ≤ 4 MB; se reenvía ya normalizado.
 */
namespace Torivac;

final class Orders
{
    /** Correo válido de un visitante: sin , ; < > " ( ) [ ] \ | ni espacios; parte local de ≤ 64 (letras, cifras y . _ % + ' -, sin puntos al principio, al final ni dobles); dominio con al menos un punto y extensión de 2 o más letras (o xn--). Ver validEmail. */
    const EMAIL = '/^(?=[^@]{1,64}@)[A-Za-z0-9_%+\'-]+(?:\.[A-Za-z0-9_%+\'-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/D';
    const LANGS = ['es', 'en', 'fr', 'de'];
    /** Peso máximo del PDF del navegador una vez decodificado (4 MB). */
    const PDF_MAX_BYTES = 4000000;
    /** Copias al cliente que puede recibir un mismo destinatario cada 24 h. */
    const COPY_PER_RECIPIENT = 2;

    /** ¿Es un correo válido? Cadena de ≤ 254 caracteres que cumple EMAIL y además pasa filter_var(FILTER_VALIDATE_EMAIL). */
    public static function validEmail($e): bool
    {
        return is_string($e) && strlen($e) <= 254 && preg_match(self::EMAIL, $e) === 1 && filter_var($e, FILTER_VALIDATE_EMAIL) !== false;
    }

    /** Texto de un campo del cuerpo: '' si falta o es null; null si NO es una cadena (número, lista, objeto…), y entonces la petición se rechaza. */
    private static function str(array $a, string $k): ?string
    {
        if (!array_key_exists($k, $a) || $a[$k] === null) return '';
        return is_string($a[$k]) ? $a[$k] : null;
    }

    /**
     * Valida el PDF que manda el navegador y lo devuelve normalizado (base64 canónico, sin saltos), o null si no vale: cadena base64 estricta (tras quitar saltos de línea), que
     * decodificada empiece por «%PDF-» y pese como máximo PDF_MAX_BYTES.
     */
    public static function normalizePdf($v): ?string
    {
        if (!is_string($v)) return null;
        $s = str_replace(["\r", "\n"], '', $v);
        $n = strlen($s);
        if ($n < 8 || $n > (int) (self::PDF_MAX_BYTES * 4 / 3) + 8) return null;
        $ok = strspn($s, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/');
        if ($ok === 0 || ($ok < $n && substr($s, $ok) !== '=' && substr($s, $ok) !== '==')) return null;     // solo el relleno final (= o ==) puede no ser del alfabeto
        $bin = base64_decode($s, true);
        if ($bin === false || strlen($bin) > self::PDF_MAX_BYTES || substr($bin, 0, 5) !== '%PDF-') return null;
        return base64_encode($bin);
    }

    /** @return array{order?:array,error?:string} */
    public static function parseOrder($raw, array $items): array
    {
        if (!is_array($raw)) return ['error' => 'Petición no válida'];
        if (!empty($raw['hp'])) return ['error' => 'Solicitud no válida'];                       // honeypot
        $c = is_array($raw['customer'] ?? null) ? $raw['customer'] : [];
        $f = [];
        foreach (['name', 'company', 'email', 'phone', 'notes'] as $k) {
            $f[$k] = self::str($c, $k);
            if ($f[$k] === null) return ['error' => 'Petición no válida'];                      // un campo de texto que no es una cadena (p. ej. un array) no se acepta
        }
        $customer = ['name' => Util::line($f['name'], 120), 'company' => Util::line($f['company'], 120), 'email' => strtolower(Util::line($f['email'], 254)), 'phone' => Util::line($f['phone'], 40), 'notes' => Util::text($f['notes'], 2000)];
        if (mb_strlen($customer['name']) < 2) return ['error' => 'Falta el nombre'];
        if (!self::validEmail($customer['email'])) return ['error' => 'Correo no válido'];
        if (($c['privacy'] ?? null) !== true) return ['error' => 'Debes aceptar la política de privacidad'];
        if (!is_array($raw['lines'] ?? null) || !$raw['lines']) return ['error' => 'El presupuesto está vacío'];
        if (count($raw['lines']) > 200) return ['error' => 'Demasiadas líneas (máx. 200)'];
        $seen = [];
        foreach ($raw['lines'] as $l) {
            $rawRef = is_array($l) ? ($l['ref'] ?? '') : '';
            if (!is_string($rawRef)) return ['error' => 'Petición no válida'];
            $ref = Util::line($rawRef, 60);
            $q = is_array($l) ? ($l['qty'] ?? null) : null;
            if ($ref === '' || !isset($items[$ref])) return ['error' => 'Referencia desconocida: ' . ($ref === '' ? '(vacía)' : $ref)];
            if (!(is_int($q) || (is_float($q) && floor($q) == $q)) || $q < 1 || $q > 1000000) return ['error' => 'Cantidad no válida para ' . $ref];
            $seen[$ref] = ($seen[$ref] ?? 0) + (int) $q;
        }
        $lang = $raw['lang'] ?? 'es';
        if (!is_string($lang)) return ['error' => 'Petición no válida'];
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'es';
        $token = $raw['turnstileToken'] ?? '';
        if (!is_string($token)) return ['error' => 'Petición no válida'];
        $pdf = null;
        if (array_key_exists('pdf', $raw) && $raw['pdf'] !== null && $raw['pdf'] !== '' && $raw['pdf'] !== false) {
            $pdf = self::normalizePdf($raw['pdf']);
            if ($pdf === null) return ['error' => 'PDF adjunto no válido'];
        }
        $lines = [];
        foreach ($seen as $ref => $qty) $lines[] = ['ref' => (string) $ref, 'qty' => $qty];
        return ['order' => ['customer' => $customer, 'lines' => $lines, 'lang' => $lang, 'pdf' => $pdf, 'copyToCustomer' => ($raw['copy'] ?? true) !== false, 'turnstile' => $token]];
    }

    /** @return array{contact?:array,error?:string} */
    public static function parseContact($raw): array
    {
        if (!is_array($raw)) return ['error' => 'Petición no válida'];
        if (!empty($raw['hp'])) return ['error' => 'Solicitud no válida'];
        $f = [];
        foreach (['name', 'email', 'message', 'lang', 'turnstileToken'] as $k) {
            $f[$k] = self::str($raw, $k);
            if ($f[$k] === null) return ['error' => 'Petición no válida'];
        }
        $m = ['name' => Util::line($f['name'], 120), 'email' => strtolower(Util::line($f['email'], 254)), 'message' => Util::text($f['message'], 5000), 'lang' => in_array($f['lang'], self::LANGS, true) ? $f['lang'] : 'es', 'turnstile' => $f['turnstileToken']];
        if (mb_strlen($m['name']) < 2) return ['error' => 'Falta el nombre'];
        if (!self::validEmail($m['email'])) return ['error' => 'Correo no válido'];
        if (mb_strlen($m['message']) < 3) return ['error' => 'Falta el mensaje'];
        if (($raw['privacy'] ?? null) !== true) return ['error' => 'Debes aceptar la política de privacidad'];
        return ['contact' => $m];
    }

    /** Turnstile opcional: sin secreto se omite; con secreto, falla cerrado */
    public static function verifyTurnstile(string $token, string $ip): bool
    {
        $secret = (string) Config::get('turnstile_secret', '');
        if ($secret === '') return true;
        if ($token === '') return false;
        try {
            [$st, $body] = Http::request('POST', (string) Config::get('turnstile_url', 'https://challenges.cloudflare.com/turnstile/v0/siteverify'), ['Content-Type: application/x-www-form-urlencoded'], http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => $ip]));
            $j = json_decode($body, true);
            return $st === 200 && ($j['success'] ?? false) === true;
        } catch (\Throwable $e) { return false; }
    }

    /** destinatarios del equipo: config order_to (array o texto separado por comas) */
    public static function team(): array
    {
        $t = Config::get('order_to', []);
        if (is_string($t)) $t = explode(',', $t);
        return array_values(array_filter(array_map('trim', (array) $t)));
    }

    /** Modo de la copia al cliente: 'capped' (con topes) o 'off'. Solo el texto «capped» (sin importar mayúsculas ni espacios alrededor) activa la copia; si no está puesto, es capped; CUALQUIER otro valor (también uno que no sea un texto) es off. */
    public static function copyMode(): string
    {
        $v = Config::get('order_copy', 'capped');
        return is_string($v) && strtolower(trim($v)) === 'capped' ? 'capped' : 'off';
    }

    /** ¿Tiene order_copy un valor reconocido (capped u off, sin importar mayúsculas ni espacios) o no está puesto? Si no, se trata como off y el diagnóstico y /health avisan. */
    public static function copyModeValid(): bool
    {
        $v = Config::get('order_copy', null);
        return $v === null || (is_string($v) && in_array(strtolower(trim($v)), ['capped', 'off'], true));
    }

    /** Tope de copias al cliente en total por cada 24 h (config order_copy_daily_max; 150 si falta o no es un número; 0 = ninguna). */
    public static function copyDailyMax(): int
    {
        $v = Config::get('order_copy_daily_max', 150);
        return is_numeric($v) ? max(0, (int) $v) : 150;
    }

    /** Tope global de pedidos por hora (config orders_per_hour_max; 120 si falta o no es un número): protege la cuota del correo y el buzón del equipo. */
    public static function ordersPerHourMax(): int
    {
        $v = Config::get('orders_per_hour_max', 120);
        return is_numeric($v) ? max(0, (int) $v) : 120;
    }

    /** Siguiente número de pedido TV-AAAAMMDD-NNNN (contador diario con bloqueo para que dos pedidos no repitan número). */
    public static function nextNumber(?int $nowMs = null): string
    {
        $ymd = gmdate('Ymd', (int) floor(($nowMs ?? Util::nowMs()) / 1000));
        $n = Store::locked('counter', function () use ($ymd) {
            $k = 'counter:' . $ymd;
            $n = (int) Store::get($k) + 1;
            Store::put($k, $n, 172800);
            return $n;
        });
        return 'TV-' . $ymd . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Decide y envía la copia al cliente. Devuelve el motivo para emailed.customer_reason: 'not_requested' (el visitante mandó copy:false), 'off' (order_copy no es capped),
     * 'skipped' (correo sin configurar), 'limit' (tope por destinatario o diario), y si se intentó: 'sent' o 'failed'. Cada intento cuenta para los topes, salga o no.
     */
    private static function sendCopy(array $o, string $number, array $priced, bool $demo, array $cat, ?int $nowMs): string
    {
        if (!$o['copyToCustomer']) return 'not_requested';
        if (self::copyMode() !== 'capped') return 'off';
        if (!Mail::enabled()) return 'skipped';
        $to = $o['customer']['email'];
        if (!RateLimit::hit('copyto', $to, self::COPY_PER_RECIPIENT, 86400000, $nowMs)['allowed']) return 'limit';                  // clave = sha256 del correo, nunca el correo
        if (!RateLimit::hit('copyday', 'all', self::copyDailyMax(), 86400000, $nowMs)['allowed']) return 'limit';
        $c = Mail::copyMail(['number' => $number, 'priced' => $priced, 'lang' => $o['lang'], 'demo' => $demo], $cat);
        $r = Mail::send(['to' => [$to], 'subject' => $c['subject'], 'html' => $c['html'], 'text' => $c['text']]);                    // sin adjunto y sin nada del visitante
        if (!empty($r['ok'])) return 'sent';
        return !empty($r['skipped']) ? 'skipped' : 'failed';
    }

    /** POST /order: valida, valora con los precios del servidor, guarda el pedido y envía el correo al equipo (con el PDF del cliente) y, si procede, la copia al cliente. */
    public static function handleOrder(Request $req, $raw, ?array $catalog = null, ?int $nowMs = null): Response
    {
        $rl = RateLimit::hit('order', Request::ipKey($req->ip), 8, 600000, $nowMs);
        if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados pedidos seguidos. Inténtalo en unos minutos.'], 429);
        $prices = Prices::load();
        $cat = Prices::withSheetItems($catalog ?? Catalog::items(), $prices);                      // las referencias que la hoja añadió dentro de un producto también son pedibles
        $parsed = self::parseOrder($raw, $cat);
        if (isset($parsed['error'])) return new Response(['ok' => false, 'error' => $parsed['error']], 400);
        $o = $parsed['order'];
        if (!self::verifyTurnstile($o['turnstile'], $req->ip)) return new Response(['ok' => false, 'error' => 'Verificación anti-spam fallida'], 400);
        $gl = RateLimit::hit('orderhour', 'all', self::ordersPerHourMax(), 3600000, $nowMs);       // tope global: protege la cuota del correo y el buzón del equipo (solo cuentan pedidos válidos)
        if (!$gl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados pedidos seguidos. Inténtalo en unos minutos.'], 429);
        $priced = Prices::priceOrder($prices, $o['lines']);                                        // el cliente no puede fijar precios
        $number = self::nextNumber($nowMs);
        $demo = ($prices['mode'] ?? '') !== 'live';
        $record = ['number' => $number, 'at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'customer' => $o['customer'], 'lines' => $priced['lines'], 'total' => $priced['total'], 'unpriced' => $priced['unpriced'], 'lang' => $o['lang'],
            'prices' => ['updated_at' => $prices['updated_at'] ?? null, 'mode' => $prices['mode'] ?? null], 'ip' => $req->ip];
        Store::put('order:' . $number, $record, 400 * 86400);                                     // primero se guarda (si el correo falla, el pedido no se pierde)
        $hasPdf = $o['pdf'] !== null;
        $mail = Mail::orderMail(['number' => $number, 'customer' => $o['customer'], 'priced' => $priced, 'lang' => $o['lang'], 'demo' => $demo, 'pdf' => $hasPdf], $cat);
        $att = $hasPdf ? [['filename' => $number . '.pdf', 'content' => $o['pdf']]] : [];         // el PDF del visitante solo va al equipo
        $team = Mail::send(['to' => self::team(), 'subject' => '[Web Torivac] Pedido ' . $number . ' · ' . $o['customer']['name'], 'html' => $mail['html'], 'text' => $mail['text'], 'replyTo' => $o['customer']['email'], 'attachments' => $att]);
        $reason = self::sendCopy($o, $number, $priced, $demo, $cat, $nowMs);
        $emailed = ['team' => !empty($team['ok']), 'customer' => $reason === 'sent', 'skipped' => !empty($team['skipped']), 'customer_reason' => $reason];
        $why = !empty($team['ok']) ? '' : (!empty($team['skipped']) ? 'correo sin configurar' : (isset($team['status']) ? 'Resend respondió ' . $team['status'] : mb_substr((string) ($team['error'] ?? 'fallo de envío'), 0, 120)));
        $record['emailed'] = $emailed + ['error' => $why];
        Store::put('order:' . $number, $record, 400 * 86400);                                     // el panel marca los pedidos cuyo aviso por correo no salió
        return new Response(['ok' => true, 'number' => $number, 'total' => $priced['total'], 'unpriced' => $priced['unpriced'], 'emailed' => $emailed]);
    }

    /** POST /contact: valida el mensaje y lo envía al equipo con el correo del visitante como responder-a. */
    public static function handleContact(Request $req, $raw): Response
    {
        $rl = RateLimit::hit('contact', Request::ipKey($req->ip), 5);
        if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados mensajes seguidos.'], 429);
        $p = self::parseContact($raw);
        if (isset($p['error'])) return new Response(['ok' => false, 'error' => $p['error']], 400);
        $c = $p['contact'];
        if (!self::verifyTurnstile($c['turnstile'], $req->ip)) return new Response(['ok' => false, 'error' => 'Verificación anti-spam fallida'], 400);
        $r = Mail::send(['to' => self::team(), 'subject' => '[Web Torivac] Contacto · ' . $c['name'], 'text' => $c['name'] . ' <' . $c['email'] . '> (' . $c['lang'] . ")\n\n" . $c['message'],
            'html' => '<p><b>' . Util::esc($c['name']) . '</b> &lt;' . Util::esc($c['email']) . '&gt; (' . Util::esc($c['lang']) . ')</p><p>' . nl2br(Util::esc($c['message'])) . '</p>', 'replyTo' => $c['email']]);
        if (empty($r['ok'])) return new Response(['ok' => false, 'error' => !empty($r['skipped']) ? 'El envío de correo no está configurado en el servidor' : 'No hemos podido enviar el mensaje', 'emailed' => false, 'skipped' => !empty($r['skipped'])], 502);   // sin correo no hay mensaje: la web avisa y ofrece escribir directamente
        return new Response(['ok' => true, 'emailed' => true, 'skipped' => false]);
    }
}
