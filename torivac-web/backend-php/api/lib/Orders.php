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
 * [TEXTO-PLANO] Los campos de texto de pedido y contacto solo admiten TEXTO PLANO y con límite de caracteres (PlainText: nada de etiquetas, código ni más de 2 enlaces): si no, 400 con
 * { error, code: plain_text | too_long | too_many_links, field }. Además el navegador manda `_e` (milisegundos entre cargar la página y enviar): si falta o es < 1200, 400 con code too_fast
 * (un bot que postea sin cargar la página). El texto que se guarda y se envía es el NORMALIZADO por PlainText, no el original.
 * [CONTACTO] POST /contact guarda SIEMPRE el mensaje (Messages, 400 días) antes de intentar el correo y responde { ok, id, emailed:{ sent, reason } } con 200 aunque el correo no saliera
 * (reason = sent · off · failed · skipped; el detalle, solo para gestores, queda en el registro). Si no se pudo guardar: 500 «No se pudo guardar el mensaje» y no se envía nada.
 */
namespace Torivac;

final class Orders
{
    /** Correo válido de un visitante: sin , ; < > " ( ) [ ] \ | ni espacios; parte local de ≤ 64 (letras, cifras y . _ % + ' -, sin puntos al principio, al final ni dobles); dominio con al menos un punto y extensión de 2 o más letras (o xn--). Ver validEmail. */
    const EMAIL = '/^(?=[^@]{1,64}@)[A-Za-z0-9_%+\'-]+(?:\.[A-Za-z0-9_%+\'-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/D';
    const LANGS = ['es', 'en', 'fr', 'de'];
    /** Milisegundos mínimos por defecto entre cargar la página y enviar el formulario (campo `_e`): menos = un bot. Se cambia con form_min_fill_ms en config.php (0 = no se exige `_e`). */
    const MIN_FILL_MS = 1200;
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

    /** Error de validación de un campo de texto → ['error' => castellano, 'code' => plain_text|too_long|too_many_links, 'field' => campo]; `code` y `field` son para que el navegador lo muestre traducido. */
    public static function plainError(string $code, string $field, int $max): array
    {
        $msg = $code === 'too_long' ? 'El texto es demasiado largo (máximo ' . $max . ' caracteres).' : ($code === 'too_many_links' ? 'Máximo ' . PlainTextRules::MAX_LINKS . ' enlaces por texto.' : 'Escribe solo texto: sin etiquetas, código ni más de ' . PlainTextRules::MAX_LINKS . ' enlaces.');
        return ['error' => $msg, 'code' => $code === 'not_text' ? 'plain_text' : $code, 'field' => $field];
    }

    /** Milisegundos mínimos entre cargar la página y enviar (config form_min_fill_ms; 1200 si falta o no es un número; 0 = no se exige `_e`). */
    public static function minFillMs(): int
    {
        $v = Config::get('form_min_fill_ms', self::MIN_FILL_MS);
        return is_numeric($v) ? max(0, (int) $v) : self::MIN_FILL_MS;
    }

    /** ¿Trae el cuerpo el campo `_e` (ms que tardó la persona) con un entero ≥ el mínimo? Si no, es un bot que no cargó la página: error con code too_fast. Con el mínimo en 0 no se exige. */
    private static function fillTimeError($raw): ?array
    {
        $min = self::minFillMs();
        if ($min === 0) return null;
        $e = $raw['_e'] ?? null;
        $ok = (is_int($e) || (is_float($e) && is_finite($e) && floor($e) == $e)) && $e >= $min;
        return $ok ? null : ['error' => 'Formulario incompleto. Recarga la página e inténtalo de nuevo.', 'code' => 'too_fast'];
    }

    /** Respuesta 400 de una validación fallida: el error en castellano y, si los hay, `code` y `field`. */
    public static function badRequest(array $p): Response
    {
        return new Response(['ok' => false, 'error' => $p['error']] + (isset($p['code']) ? ['code' => $p['code']] : []) + (isset($p['field']) ? ['field' => $p['field']] : []), 400);
    }

    /**
     * Limpia y valida los datos del solicitante (name, company, email, phone, notes: todas CADENAS) con las reglas de siempre: texto plano con el límite de cada campo (PlainText), nombre de al menos
     * 2 caracteres y correo válido en minúsculas. Lo usan el pedido de la web (parseOrder) y la edición desde el panel (Quotes), para que las dos apliquen exactamente lo mismo.
     * @param array<string,string> $f
     * @return array{customer?:array,error?:string,code?:string,field?:string}
     */
    public static function cleanCustomer(array $f): array
    {
        $t = [];
        foreach (['name' => false, 'company' => false, 'phone' => false, 'notes' => true] as $k => $multiline) {          // solo texto plano y con el límite de cada campo
            $max = PlainText::max('order', $k);
            $r = PlainText::check($f[$k], $max, $multiline);
            if (!$r['ok']) return self::plainError($r['code'], $k, $max);
            $t[$k] = $r['text'];
        }
        $customer = ['name' => $t['name'], 'company' => $t['company'], 'email' => strtolower(Util::line($f['email'], 254)), 'phone' => $t['phone'], 'notes' => $t['notes']];
        if (mb_strlen($customer['name']) < 2) return ['error' => 'Falta el nombre'];
        if (!self::validEmail($customer['email'])) return ['error' => 'Correo no válido'];
        return ['customer' => $customer];
    }

    /** @return array{order?:array,error?:string,code?:string,field?:string} */
    public static function parseOrder($raw, array $items): array
    {
        if (!is_array($raw)) return ['error' => 'Petición no válida'];
        if (!empty($raw['hp'])) return ['error' => 'Solicitud no válida'];                       // honeypot
        if (($t = self::fillTimeError($raw)) !== null) return $t;
        $c = is_array($raw['customer'] ?? null) ? $raw['customer'] : [];
        $f = [];
        foreach (['name', 'company', 'email', 'phone', 'notes'] as $k) {
            $f[$k] = self::str($c, $k);
            if ($f[$k] === null) return ['error' => 'Petición no válida'];                      // un campo de texto que no es una cadena (p. ej. un array) no se acepta
        }
        $cc = self::cleanCustomer($f);
        if (isset($cc['error'])) return $cc;
        $customer = $cc['customer'];
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

    /** @return array{contact?:array,error?:string,code?:string,field?:string} */
    public static function parseContact($raw): array
    {
        if (!is_array($raw)) return ['error' => 'Petición no válida'];
        if (!empty($raw['hp'])) return ['error' => 'Solicitud no válida'];
        if (($t = self::fillTimeError($raw)) !== null) return $t;
        $f = [];
        foreach (['name', 'email', 'message', 'lang', 'turnstileToken'] as $k) {
            $f[$k] = self::str($raw, $k);
            if ($f[$k] === null) return ['error' => 'Petición no válida'];
        }
        $text = [];
        foreach (['name' => false, 'message' => true] as $k => $multiline) {                   // solo texto plano y con el límite de cada campo
            $max = PlainText::max('contact', $k);
            $r = PlainText::check($f[$k], $max, $multiline);
            if (!$r['ok']) return self::plainError($r['code'], $k, $max);
            $text[$k] = $r['text'];
        }
        $m = ['name' => $text['name'], 'email' => strtolower(Util::line($f['email'], 254)), 'message' => $text['message'], 'lang' => in_array($f['lang'], self::LANGS, true) ? $f['lang'] : 'es', 'turnstile' => $f['turnstileToken']];
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
        if ($token === '' || strlen($token) > 2048) return false;                                  // los tokens de Cloudflare no pasan de 2048 caracteres
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
        $r = Mail::send(['to' => [$to], 'subject' => $c['subject'], 'html' => $c['html'], 'text' => $c['text']], 'order', $nowMs);       // sin adjunto y sin nada del visitante
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
        if (isset($parsed['error'])) return self::badRequest($parsed);
        $o = $parsed['order'];
        if (!self::verifyTurnstile($o['turnstile'], $req->ip)) return new Response(['ok' => false, 'error' => 'Verificación anti-spam fallida', 'code' => 'captcha'], 400);
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
        $team = Mail::send(['to' => self::team(), 'subject' => '[Web Torivac] Pedido ' . $number . ' · ' . $o['customer']['name'], 'html' => $mail['html'], 'text' => $mail['text'], 'replyTo' => $o['customer']['email'], 'attachments' => $att], 'order', $nowMs);
        $reason = self::sendCopy($o, $number, $priced, $demo, $cat, $nowMs);
        $emailed = ['team' => !empty($team['ok']), 'customer' => $reason === 'sent', 'skipped' => !empty($team['skipped']), 'customer_reason' => $reason];
        $why = !empty($team['ok']) ? '' : (!empty($team['skipped']) ? 'correo sin configurar' : mb_substr((string) ($team['error'] ?? 'fallo de envío'), 0, 160));
        $record['emailed'] = $emailed + ['reason' => (string) ($team['reason'] ?? (!empty($team['ok']) ? 'sent' : 'failed')), 'error' => $why];       // reason = sent · off · failed · skipped (aviso al equipo); error, solo para gestores
        Store::put('order:' . $number, $record, 400 * 86400);                                     // el panel marca los pedidos cuyo aviso por correo no salió
        return new Response(['ok' => true, 'number' => $number, 'total' => $priced['total'], 'unpriced' => $priced['unpriced'], 'emailed' => $emailed]);
    }

    /**
     * POST /contact: límite por visitante y anti-spam como siempre (5 / 10 min por ipKey, honeypot, `_e`, Turnstile); luego construye el registro, LO GUARDA (400 días), intenta el correo al equipo,
     * anota el resultado en el registro y responde { ok:true, id, emailed:{ sent, reason } } con 200 aunque el correo no saliera: el mensaje queda guardado y el equipo lo ve en el panel
     * (`emailed.error`, solo para gestores, nunca aquí). Si no se puede guardar → 500 «No se pudo guardar el mensaje» y NO se envía nada: nunca se dice «recibido» de lo que no está guardado.
     */
    public static function handleContact(Request $req, $raw, ?int $nowMs = null): Response
    {
        $notSaved = function (\Throwable $e) {                                                   // nunca «recibido» de lo que no está guardado: si el almacén falla, 500 con el texto acordado y el detalle al registro
            error_log('torivac-api: [contacto] No se pudo guardar el mensaje: ' . mb_substr($e->getMessage(), 0, 160));
            return new Response(['ok' => false, 'error' => 'No se pudo guardar el mensaje'], 500);
        };
        $p = self::parseContact($raw);                                                           // primero se valida: lo no válido (con el aviso que el visitante necesita) no gasta su cupo de 5 mensajes (igual que el Worker)
        if (isset($p['error'])) return self::badRequest($p);
        $c = $p['contact'];
        try { $rl = RateLimit::hit('contact', Request::ipKey($req->ip), 5, 600000, $nowMs); }
        catch (\Throwable $e) { return $notSaved($e); }                                           // sin almacén tampoco hay contador que aplicar: falla cerrado
        if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados mensajes seguidos.'], 429);
        if (!self::verifyTurnstile($c['turnstile'], $req->ip)) return new Response(['ok' => false, 'error' => 'Verificación anti-spam fallida', 'code' => 'captcha'], 400);
        try { $rec = Messages::create($c, $req->ip, $nowMs); }
        catch (\Throwable $e) { return $notSaved($e); }
        try {
            $m = Mail::contactMail($rec);
            $r = Mail::send(['to' => self::team(), 'subject' => $m['subject'], 'html' => $m['html'], 'text' => $m['text'], 'replyTo' => $c['email']], 'contact', $nowMs);
        } catch (\Throwable $e) {                                                                // el mensaje ya está guardado: nunca se convierte en un error para el visitante
            error_log('torivac-api: [contacto] Fallo inesperado al enviar ' . $rec['id'] . ': ' . mb_substr($e->getMessage(), 0, 160));
            $r = ['ok' => false, 'reason' => 'failed', 'error' => 'Fallo interno al enviar el correo'];
        }
        $emailed = ['sent' => !empty($r['ok']), 'reason' => (string) ($r['reason'] ?? (!empty($r['ok']) ? 'sent' : 'failed'))];
        if (!empty($r['error'])) $emailed['error'] = Mail::scrub($r['error']);
        try { Messages::setEmailed($rec, $emailed); }
        catch (\Throwable $e) { error_log('torivac-api: [contacto] No se pudo anotar el resultado del correo de ' . $rec['id'] . ': ' . mb_substr($e->getMessage(), 0, 160)); }
        return new Response(['ok' => true, 'id' => $rec['id'], 'emailed' => ['sent' => $emailed['sent'], 'reason' => $emailed['reason']]]);
    }
}
