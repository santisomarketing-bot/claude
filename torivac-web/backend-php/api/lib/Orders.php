<?php
/**
 * [ORDERS] POST /api/order y POST /api/contact: valida lo que llega del navegador (no es fiable), valora el pedido en servidor con los precios
 * VIGENTES (ignora cualquier precio que mande el cliente), numera TV-AAAAMMDD-NNNN, guarda y envía por correo al equipo (con el PDF) y copia al cliente.
 * Defensas: honeypot, límite por IP, Turnstile opcional, referencias solo del catálogo (o añadidas por la hoja de precios), cantidades enteras 1..1 000 000.
 */
namespace Torivac;

final class Orders
{
    const EMAIL = '/^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/';
    const LANGS = ['es', 'en', 'fr', 'de'];

    /** @return array{order?:array,error?:string} */
    public static function parseOrder($raw, array $items): array
    {
        if (!is_array($raw)) return ['error' => 'Petición no válida'];
        if (!empty($raw['hp'])) return ['error' => 'Solicitud no válida'];                       // honeypot
        $c = is_array($raw['customer'] ?? null) ? $raw['customer'] : [];
        $customer = ['name' => Util::clean($c['name'] ?? '', 120), 'company' => Util::clean($c['company'] ?? '', 120), 'email' => strtolower(Util::clean($c['email'] ?? '', 254)), 'phone' => Util::clean($c['phone'] ?? '', 40), 'notes' => Util::clean($c['notes'] ?? '', 2000)];
        if (mb_strlen($customer['name']) < 2) return ['error' => 'Falta el nombre'];
        if (!preg_match(self::EMAIL, $customer['email'])) return ['error' => 'Correo no válido'];
        if (($c['privacy'] ?? null) !== true) return ['error' => 'Debes aceptar la política de privacidad'];
        if (!is_array($raw['lines'] ?? null) || !$raw['lines']) return ['error' => 'El presupuesto está vacío'];
        if (count($raw['lines']) > 200) return ['error' => 'Demasiadas líneas (máx. 200)'];
        $seen = [];
        foreach ($raw['lines'] as $l) {
            $ref = Util::clean(is_array($l) ? ($l['ref'] ?? '') : '', 60);
            $q = is_array($l) ? ($l['qty'] ?? null) : null;
            if ($ref === '' || !isset($items[$ref])) return ['error' => 'Referencia desconocida: ' . ($ref === '' ? '(vacía)' : $ref)];
            if (!(is_int($q) || (is_float($q) && floor($q) == $q)) || $q < 1 || $q > 1000000) return ['error' => 'Cantidad no válida para ' . $ref];
            $seen[$ref] = ($seen[$ref] ?? 0) + (int) $q;
        }
        $lang = in_array($raw['lang'] ?? '', self::LANGS, true) ? $raw['lang'] : 'es';
        $pdf = null;
        if (!empty($raw['pdf'])) {
            if (!is_string($raw['pdf']) || strlen($raw['pdf']) > 5500000 || strpos($raw['pdf'], 'JVBER') !== 0) return ['error' => 'PDF adjunto no válido'];
            $pdf = $raw['pdf'];
        }
        $lines = [];
        foreach ($seen as $ref => $qty) $lines[] = ['ref' => (string) $ref, 'qty' => $qty];
        return ['order' => ['customer' => $customer, 'lines' => $lines, 'lang' => $lang, 'pdf' => $pdf, 'copyToCustomer' => ($raw['copy'] ?? true) !== false, 'turnstile' => (string) ($raw['turnstileToken'] ?? '')]];
    }

    /** @return array{contact?:array,error?:string} */
    public static function parseContact($raw): array
    {
        if (!is_array($raw)) return ['error' => 'Petición no válida'];
        if (!empty($raw['hp'])) return ['error' => 'Solicitud no válida'];
        $m = ['name' => Util::clean($raw['name'] ?? '', 120), 'email' => strtolower(Util::clean($raw['email'] ?? '', 254)), 'message' => Util::clean($raw['message'] ?? '', 5000), 'lang' => in_array($raw['lang'] ?? '', self::LANGS, true) ? $raw['lang'] : 'es', 'turnstile' => (string) ($raw['turnstileToken'] ?? '')];
        if (mb_strlen($m['name']) < 2) return ['error' => 'Falta el nombre'];
        if (!preg_match(self::EMAIL, $m['email'])) return ['error' => 'Correo no válido'];
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

    /** POST /order: valida, valora con los precios del servidor, guarda el pedido y envía el correo al equipo y la copia al cliente. */
    public static function handleOrder(Request $req, $raw, ?array $catalog = null, ?int $nowMs = null): Response
    {
        $rl = RateLimit::hit('order', $req->ip, 8, 600000, $nowMs);
        if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados pedidos seguidos. Inténtalo en unos minutos.'], 429);
        $prices = Prices::load();
        $cat = Prices::withSheetItems($catalog ?? Catalog::items(), $prices);                      // las referencias que la hoja añadió dentro de un producto también son pedibles
        $parsed = self::parseOrder($raw, $cat);
        if (isset($parsed['error'])) return new Response(['ok' => false, 'error' => $parsed['error']], 400);
        $o = $parsed['order'];
        if (!self::verifyTurnstile($o['turnstile'], $req->ip)) return new Response(['ok' => false, 'error' => 'Verificación anti-spam fallida'], 400);
        $priced = Prices::priceOrder($prices, $o['lines']);                                        // el cliente no puede fijar precios
        $number = self::nextNumber($nowMs);
        $demo = ($prices['mode'] ?? '') !== 'live';
        $record = ['number' => $number, 'at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'customer' => $o['customer'], 'lines' => $priced['lines'], 'total' => $priced['total'], 'unpriced' => $priced['unpriced'], 'lang' => $o['lang'],
            'prices' => ['updated_at' => $prices['updated_at'] ?? null, 'mode' => $prices['mode'] ?? null], 'ip' => $req->ip];
        Store::put('order:' . $number, $record, 400 * 86400);                                     // primero se guarda (si el correo falla, el pedido no se pierde)
        $mail = Mail::orderMail(['number' => $number, 'customer' => $o['customer'], 'priced' => $priced, 'lang' => $o['lang'], 'demo' => $demo], $cat);
        $att = $o['pdf'] ? [['filename' => $number . '.pdf', 'content' => $o['pdf']]] : [];
        $team = Mail::send(['to' => self::team(), 'subject' => '[Web Torivac] Pedido ' . $number . ' · ' . $o['customer']['name'], 'html' => $mail['html'], 'text' => $mail['text'], 'replyTo' => $o['customer']['email'], 'attachments' => $att]);
        $cust = ['ok' => false, 'skipped' => true];
        if ($o['copyToCustomer']) $cust = Mail::send(['to' => [$o['customer']['email']], 'subject' => 'Torivac · copia de tu presupuesto ' . $number, 'html' => $mail['html'], 'text' => $mail['text'], 'attachments' => $att]);
        $emailed = ['team' => !empty($team['ok']), 'customer' => !empty($cust['ok']), 'skipped' => !empty($team['skipped'])];
        $why = !empty($team['ok']) ? '' : (!empty($team['skipped']) ? 'correo sin configurar' : (isset($team['status']) ? 'Resend respondió ' . $team['status'] : mb_substr((string) ($team['error'] ?? 'fallo de envío'), 0, 120)));
        $record['emailed'] = $emailed + ['error' => $why];
        Store::put('order:' . $number, $record, 400 * 86400);                                     // el panel marca los pedidos cuyo aviso por correo no salió
        return new Response(['ok' => true, 'number' => $number, 'total' => $priced['total'], 'unpriced' => $priced['unpriced'], 'emailed' => $emailed]);
    }

    /** POST /contact: valida el mensaje y lo envía al equipo con el correo del visitante como responder-a. */
    public static function handleContact(Request $req, $raw): Response
    {
        $rl = RateLimit::hit('contact', $req->ip, 5);
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
