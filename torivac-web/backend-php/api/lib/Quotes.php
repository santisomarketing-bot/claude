<?php
/**
 * [QUOTES] Presupuestos recibidos: ver, editar y reenviar por correo desde el panel (contrato único con workers/api: docs/PRESUPUESTOS-RECIBIDOS.md). Las personas con rol `client` son las PROPIETARIAS de la web
 * (no compradores) y, igual que un manager, ven todos los presupuestos; el token maestro cuenta como manager. Todas las rutas exigen sesión (las atiende Router tras autenticar):
 *   GET  /orders/:número        → { ok, order } (un propietario, sin `ip` ni `emailed.error`) · 404 si no existe o el número no tiene la forma TV-AAAAMMDD-NNNN[-XXX]
 *   PUT  /orders/:número        → edita solicitante, líneas (cantidad y precio manual) y nota; `rev` evita pisar el cambio de otra persona (409 conflict); guarda `original` una sola vez, `history` (≤ 50) y `edited`
 *   POST /orders/:número/send   → reenvía por correo (1..3 destinatarios) con el PDF del navegador adjunto; topes de 20/hora por persona y 150/día; 409 mail_off si el correo no está configurado
 * [RECORD] order:<número> conserva SIEMPRE lo que ya traía (ip, emailed, prices…): solo se añaden campos opcionales (rev, edited, original, quoteNote, lines[].manual, history, lastSent). El PDF no se guarda.
 * [SEGURIDAD] El número de la URL solo se acepta con ROUTE (nunca toca ficheros); todo texto de una persona pasa por PlainText y sale escapado en el correo; el PDF se valida (Orders::normalizePdf);
 * el asunto, el remitente y el texto de apoyo son fijos del servidor; la edición va bajo el bloqueo del almacén (Store::locked) para que dos ediciones no se pisen; y cada edición o reenvío queda en Actividad.
 */
namespace Torivac;

final class Quotes
{
    /** Ruta de un presupuesto: número con la forma TV-AAAAMMDD-NNNN (con sufijo opcional -XXX) y, si acaba en /send, el reenvío. */
    const ROUTE = '#^/orders/(TV-\d{8}-\d{4}(?:-[0-9A-Z]{3})?)(/send)?$#D';
    /** Plazo de conservación del registro: 400 días desde la última escritura (igual que un pedido nuevo). */
    const TTL = 400 * 86400;
    /** Tamaño máximo del cuerpo de una edición (bytes). */
    const EDIT_MAX_BYTES = 100000;
    /** Líneas por presupuesto, como al pedir. */
    const MAX_LINES = 200;
    /** Longitud máxima de la nota del presupuesto (caracteres). */
    const NOTE_MAX = 1000;
    /** Longitud máxima del mensaje que acompaña a un reenvío (caracteres). */
    const MESSAGE_MAX = 1500;
    /** Anotaciones que conserva `history` (las más antiguas se descartan). */
    const HISTORY_MAX = 50;
    /** Destinatarios máximos de un reenvío. */
    const MAX_TO = 3;
    /** Reenvíos por persona y hora. */
    const SEND_PER_HOUR = 20;
    /** Texto del 409 cuando el correo no está configurado. */
    const MAIL_OFF = 'El correo no está configurado: el presupuesto no se puede enviar desde aquí. Descarga el PDF y envíalo tú.';

    /** Tope de reenvíos en total por cada 24 h (config order_send_daily_max / env ORDER_SEND_DAILY_MAX; 150 si falta o no es un número; 0 = sin tope). */
    public static function sendDailyMax(): int
    {
        $v = Config::get('order_send_daily_max', 150);
        return is_numeric($v) ? max(0, (int) $v) : 150;
    }

    /** Atiende cualquier ruta que empiece por /orders/ de una persona ya autenticada: valida la forma del número (404 si no vale) y despacha a ver, editar o reenviar. `$nowMs` solo lo usan las pruebas. */
    public static function handle(Request $req, array $who, ?int $nowMs = null): Response
    {
        if (!Auth::requireRole($who, 'manager', 'client')) return new Response(['ok' => false, 'error' => 'No autorizado'], 403);
        if (preg_match(self::ROUTE, $req->path, $m) !== 1) return self::missing();                 // forma no válida (../, %2e%2e, vacío…): igual que si no existiera, y jamás se usa para tocar ficheros
        $number = $m[1];
        $send = ($m[2] ?? '') === '/send';
        if (!$send && $req->method === 'GET') return self::show($number, $who);
        if (!$send && $req->method === 'PUT') return self::edit($req, $who, $number, $nowMs);
        if ($send && $req->method === 'POST') return self::send($req, $who, $number, $nowMs);
        return new Response(['ok' => false, 'error' => 'No encontrado'], 404);
    }

    /** El 404 de un presupuesto que no existe. */
    private static function missing(): Response { return new Response(['ok' => false, 'error' => 'No existe ese presupuesto'], 404); }

    /** ¿Es manager (o el token maestro)? Un propietario (client) no ve la IP ni el motivo técnico del fallo del correo. */
    private static function isManager(array $who): bool { return ($who['role'] ?? '') === 'manager'; }

    /** El registro tal como lo ve quien llama: completo para un manager; sin `ip` ni `emailed.error` para un propietario. */
    private static function view(array $o, array $who): array { return self::isManager($who) ? $o : Router::forClient($o); }

    /** Quién firma una edición o un reenvío: el correo de la persona, o «maestro» si entra con el token maestro. */
    private static function by(array $who): string { return !empty($who['master']) ? 'maestro' : Util::line((string) ($who['sub'] ?? ''), 254); }

    /** Instante ISO (UTC) de la operación; `$nowMs` solo lo fijan las pruebas. */
    private static function at(?int $nowMs): string { return Util::iso($nowMs === null ? null : $nowMs / 1000); }

    /** Parte local enmascarada de un correo para el registro de Actividad: «a***@dominio.com». */
    private static function mask(string $email): string
    {
        $at = strrpos($email, '@');
        return $at === false ? '***' : substr($email, 0, 1) . '***' . substr($email, $at);
    }

    /**
     * Lee el cuerpo JSON (objeto) con su tope: [objeto, null] o [null, respuesta de error]. Pasado el tope → 413; vacío, mal formado o una lista → 400.
     * @return array{0:?array,1:?Response}
     */
    private static function body(Request $req, int $max): array
    {
        if (strlen($req->body) > $max) return [null, new Response(['ok' => false, 'error' => 'La petición es demasiado grande'], 413)];
        $b = $req->json($max);
        if ($b === null || ($b && Util::isList($b))) return [null, new Response(['ok' => false, 'error' => 'Petición no válida'], 400)];
        return [$b, null];
    }

    /** Entero ≥ 0 de un valor JSON (un entero, o un decimal sin parte fraccionaria); null si no lo es. */
    private static function whole($v): ?int
    {
        if (is_int($v)) return $v;
        return is_float($v) && is_finite($v) && floor($v) == $v && abs($v) < 1e15 ? (int) $v : null;
    }

    // ───────────────────────────────────────── [VER] GET /orders/:número
    /** GET /orders/:número → 200 { ok, order } (sin ip ni emailed.error para un propietario) o 404. */
    private static function show(string $number, array $who): Response
    {
        $o = Store::get('order:' . $number);
        if (!is_array($o)) return self::missing();
        return new Response(['ok' => true, 'order' => self::view($o, $who)], 200, ['Cache-Control' => 'private, no-store']);
    }

    // ───────────────────────────────────────── [EDITAR] PUT /orders/:número
    /**
     * Valida el cuerpo de una edición contra el catálogo `$items`, sin tocar el almacén. Devuelve ['rev' => int, 'customer'? => limpio, 'lines' => [{ref, qty, mode: keep|tariff|manual, price?}], 'note'? => texto]
     * o ['error', code?, field?]. `customer` y `quoteNote` solo salen si el cuerpo los trae (si faltan se conservan); si vienen, deben ser: cinco cadenas, y una cadena (vacía = quitar la nota).
     * @return array{rev?:int,customer?:array,lines?:array,note?:string,error?:string,code?:string,field?:string}
     */
    public static function parseEdit(array $b, array $items): array
    {
        $rev = array_key_exists('rev', $b) ? self::whole($b['rev']) : null;
        if ($rev === null || $rev < 0) return ['error' => 'Falta rev: la revisión del presupuesto que cargaste', 'field' => 'rev'];
        $out = ['rev' => $rev];
        if (array_key_exists('customer', $b)) {
            $c = $b['customer'];
            if (!is_array($c) || Util::isList($c)) return ['error' => 'Petición no válida'];
            $f = [];
            foreach (['name', 'company', 'email', 'phone', 'notes'] as $k) {
                if (!array_key_exists($k, $c) || !is_string($c[$k])) return ['error' => 'Petición no válida'];       // las cinco claves, y cadenas
                $f[$k] = $c[$k];
            }
            $cc = Orders::cleanCustomer($f);
            if (isset($cc['error'])) return $cc;
            $out['customer'] = $cc['customer'];
        }
        if (!is_array($b['lines'] ?? null) || !$b['lines'] || !Util::isList($b['lines'])) return ['error' => 'El presupuesto está vacío'];
        if (count($b['lines']) > self::MAX_LINES) return ['error' => 'Demasiadas líneas (máx. ' . self::MAX_LINES . ')'];
        $seen = [];
        $lines = [];
        foreach ($b['lines'] as $l) {
            $rawRef = is_array($l) ? ($l['ref'] ?? '') : '';
            if (!is_string($rawRef)) return ['error' => 'Petición no válida'];
            $ref = Util::line($rawRef, 60);
            if ($ref === '' || !isset($items[$ref])) return ['error' => 'Referencia desconocida: ' . ($ref === '' ? '(vacía)' : $ref)];
            $qty = self::whole($l['qty'] ?? null);
            if ($qty === null || $qty < 1 || $qty > 1000000) return ['error' => 'Cantidad no válida para ' . $ref];
            if (isset($seen[$ref])) return ['error' => 'Línea repetida: ' . $ref];
            $seen[$ref] = true;
            $line = ['ref' => $ref, 'qty' => $qty, 'mode' => 'keep'];
            if (array_key_exists('price', $l)) {
                $p = $l['price'];
                if ($p === null) $line['mode'] = 'tariff';                                                    // «vuelve a la tarifa vigente»
                elseif ((is_int($p) || is_float($p)) && $p >= 0 && $p <= 10000000 && round($p, 4) == $p) { $line['mode'] = 'manual'; $line['price'] = (float) $p; }
                else return ['error' => 'Precio no válido para ' . $ref];
            }
            $lines[] = $line;
        }
        $out['lines'] = $lines;
        if (array_key_exists('quoteNote', $b)) {
            if (!is_string($b['quoteNote'])) return ['error' => 'Petición no válida'];
            $r = PlainText::check($b['quoteNote'], self::NOTE_MAX, true);
            if (!$r['ok']) return Orders::plainError($r['code'], 'quoteNote', self::NOTE_MAX);
            $out['note'] = $r['text'];
        }
        return $out;
    }

    /**
     * Valora las líneas de una edición. `keep` (sin `price`): si la línea ya estaba con la misma referencia Y la misma cantidad se conserva tal cual (unit, total, manual); si no, tarifa vigente.
     * `tariff` (price:null) y las líneas nuevas o con otra cantidad: tarifa vigente para esa cantidad (puede ser «a consultar»). `manual`: el precio que puso la persona. Devuelve [líneas, total, sin precio, ¿se usó la tarifa?].
     * @return array{0:array,1:float,2:int,3:bool}
     */
    private static function priceLines(array $parsed, array $stored, array $prices): array
    {
        $old = [];
        foreach ($stored as $l) { if (is_array($l) && isset($l['ref'])) $old[(string) $l['ref']] = $l; }
        $out = [];
        $total = 0.0;
        $unpriced = 0;
        $revalued = false;
        foreach ($parsed as $l) {
            $ref = $l['ref'];
            $qty = $l['qty'];
            $before = $old[$ref] ?? null;
            if ($l['mode'] === 'manual') {
                $unit = $l['price'];
                $t = Util::round2($unit * $qty);
                $manual = true;
            } elseif ($l['mode'] === 'keep' && $before !== null && (int) ($before['qty'] ?? 0) === $qty) {
                $unit = $before['unit'] ?? null;
                $t = $before['total'] ?? null;
                $manual = !empty($before['manual']);
            } else {
                $unit = Prices::unit($prices, $ref, $qty);
                $t = $unit === null ? null : Util::round2($unit * $qty);
                $manual = false;
                $revalued = true;
            }
            if ($t === null) $unpriced++; else $total += $t;
            $out[] = ['ref' => $ref, 'qty' => $qty, 'unit' => $unit, 'total' => $t] + ($manual ? ['manual' => true] : []);
        }
        return [$out, Util::round2($total), $unpriced, $revalued];
    }

    /**
     * PUT /orders/:número: edita el presupuesto (ver la cabecera y docs/PRESUPUESTOS-RECIBIDOS.md §3). Orden de los errores: 404 → 413/400 (cuerpo y texto) → 409 (rev distinta de la guardada, con el registro actual).
     * Lee, comprueba `rev` y escribe bajo el bloqueo del almacén: dos ediciones a la vez no se pisan (la segunda recibe el 409). Conserva todo lo que no se toca (ip, emailed, lastSent…).
     */
    private static function edit(Request $req, array $who, string $number, ?int $nowMs): Response
    {
        if (!is_array(Store::get('order:' . $number))) return self::missing();
        [$b, $err] = self::body($req, self::EDIT_MAX_BYTES);
        if ($err !== null) return $err;
        $prices = Prices::load();
        $items = Prices::withSheetItems(Catalog::items(), $prices);
        $p = self::parseEdit($b, $items);
        if (isset($p['error'])) return Orders::badRequest($p);
        $by = self::by($who);
        $at = self::at($nowMs);
        $res = Store::locked('orderedit', function () use ($number, $p, $prices, $by, $at, $who) {
            $o = Store::get('order:' . $number);
            if (!is_array($o)) return self::missing();
            $cur = (int) ($o['rev'] ?? 0);
            if ($p['rev'] !== $cur) return new Response(['ok' => false, 'code' => 'conflict', 'error' => 'Alguien ha modificado este presupuesto: recarga y vuelve a intentarlo', 'order' => self::view($o, $who)], 409);
            [$lines, $total, $unpriced, $revalued] = self::priceLines($p['lines'], (array) ($o['lines'] ?? []), $prices);
            $new = $o;
            if (!isset($o['original'])) $new['original'] = ['at' => $o['at'] ?? null, 'customer' => $o['customer'] ?? [], 'lines' => $o['lines'] ?? [], 'total' => $o['total'] ?? 0, 'unpriced' => $o['unpriced'] ?? 0];      // lo que llegó de la web: una sola vez
            if (isset($p['customer'])) $new['customer'] = $p['customer'];
            $new['lines'] = $lines;
            $new['total'] = $total;
            $new['unpriced'] = $unpriced;
            if (isset($p['note'])) { if ($p['note'] === '') unset($new['quoteNote']); else $new['quoteNote'] = $p['note']; }
            if ($revalued) $new['prices'] = ['updated_at' => $prices['updated_at'] ?? null, 'mode' => $prices['mode'] ?? null];
            $new['rev'] = $cur + 1;
            $new['edited'] = ['at' => $at, 'by' => $by];
            $new['history'] = self::pushHistory($o, ['at' => $at, 'by' => $by, 'kind' => 'edit', 'rev' => $cur + 1]);
            Store::put('order:' . $number, $new, self::TTL);
            return new Response(['ok' => true, 'order' => self::view($new, $who)], 200, ['Cache-Control' => 'private, no-store']);
        });
        if ($res->status === 200) Audit::log('order.edit', $who, $req, $number . ' rev ' . ($res->body['order']['rev'] ?? '?'));
        return $res;
    }

    /** `history` del registro con una anotación más, quedándose con las HISTORY_MAX últimas. */
    private static function pushHistory(array $o, array $entry): array
    {
        $h = is_array($o['history'] ?? null) ? array_values($o['history']) : [];
        $h[] = $entry;
        return array_slice($h, -self::HISTORY_MAX);
    }

    // ───────────────────────────────────────── [REENVIAR] POST /orders/:número/send
    /**
     * Valida el cuerpo de un reenvío: `to` (lista de 1..3 correos válidos; se pasan a minúsculas y se quitan los repetidos), `message` (texto plano ≤ 1500, opcional), `pdf` (obligatorio, Orders::normalizePdf)
     * y `copyToMe` (true salvo que sea exactamente false). Devuelve ['to', 'message', 'pdf', 'copyToMe'] o ['error', code?, field?].
     * @return array{to?:array,message?:string,pdf?:string,copyToMe?:bool,error?:string,code?:string,field?:string}
     */
    public static function parseSend(array $b): array
    {
        $raw = $b['to'] ?? null;
        if (!is_array($raw) || !Util::isList($raw) || !$raw) return ['error' => 'Indica al menos un destinatario', 'field' => 'to'];
        if (count($raw) > 20) return ['error' => 'Máximo ' . self::MAX_TO . ' destinatarios', 'field' => 'to'];
        $to = [];
        foreach ($raw as $e) {
            if (!is_string($e)) return ['error' => 'Petición no válida'];
            $a = strtolower(Util::line($e, 254));
            if (!Orders::validEmail($a)) return ['error' => 'Correo de destino no válido', 'field' => 'to'];
            if (!in_array($a, $to, true)) $to[] = $a;
        }
        if (count($to) > self::MAX_TO) return ['error' => 'Máximo ' . self::MAX_TO . ' destinatarios', 'field' => 'to'];
        $msg = $b['message'] ?? '';
        if ($msg === null) $msg = '';
        if (!is_string($msg)) return ['error' => 'Petición no válida'];
        $r = PlainText::check($msg, self::MESSAGE_MAX, true);
        if (!$r['ok']) return Orders::plainError($r['code'], 'message', self::MESSAGE_MAX);
        $pdf = Orders::normalizePdf($b['pdf'] ?? null);
        if ($pdf === null) return ['error' => 'PDF adjunto no válido', 'field' => 'pdf'];
        return ['to' => $to, 'message' => $r['text'], 'pdf' => $pdf, 'copyToMe' => ($b['copyToMe'] ?? true) !== false];
    }

    /**
     * POST /orders/:número/send: reenvía el presupuesto por correo con el PDF adjunto. Orden: 404 → 413/400 → 409 mail_off (no gasta cupo ni anota nada) → 429 (topes: 20/hora por persona y el diario; cuentan
     * aunque el envío falle) → envío → anotación en `history` y `lastSent` (también si falla). Un fallo del proveedor NO es un error HTTP: responde 200 con sent:false. `error` solo para managers y sin secretos.
     */
    private static function send(Request $req, array $who, string $number, ?int $nowMs): Response
    {
        $o = Store::get('order:' . $number);
        if (!is_array($o)) return self::missing();
        [$b, $err] = self::body($req, Request::MAX_BODY);
        if ($err !== null) return $err;
        $p = self::parseSend($b);
        if (isset($p['error'])) return Orders::badRequest($p);
        if (!Mail::enabled()) return new Response(['ok' => false, 'code' => 'mail_off', 'error' => self::MAIL_OFF], 409);
        $tooMany = new Response(['ok' => false, 'error' => 'Demasiados reenvíos seguidos. Espera un rato.'], 429);
        if (!RateLimit::hit('qsend', (string) ($who['sub'] ?? ''), self::SEND_PER_HOUR, 3600000, $nowMs)['allowed']) return $tooMany;
        $day = self::sendDailyMax();
        if ($day > 0 && !RateLimit::hit('qsendday', 'all', $day, 86400000, $nowMs)['allowed']) return $tooMany;
        $items = Prices::withSheetItems(Catalog::items(), Prices::load());
        $lang = in_array($o['lang'] ?? 'es', Orders::LANGS, true) ? $o['lang'] : 'es';
        $mail = Mail::quoteMail(['number' => $number, 'lang' => $lang, 'lines' => (array) ($o['lines'] ?? []), 'total' => $o['total'] ?? 0, 'unpriced' => $o['unpriced'] ?? 0,
            'demo' => (($o['prices']['mode'] ?? '') !== 'live'), 'message' => $p['message'], 'note' => (string) ($o['quoteNote'] ?? '')], $items);
        $m = ['to' => $p['to'], 'subject' => $mail['subject'], 'html' => $mail['html'], 'text' => $mail['text'], 'attachments' => [['filename' => $number . '.pdf', 'content' => $p['pdf']]]];
        $reply = Orders::team()[0] ?? '';
        if ($reply !== '') $m['replyTo'] = $reply;
        $me = strtolower((string) ($who['sub'] ?? ''));
        if ($p['copyToMe'] && empty($who['master']) && Orders::validEmail($me) && !in_array($me, $p['to'], true)) $m['cc'] = [$me];     // en copia quien lo envía (no el token maestro)
        $r = Mail::send($m, 'order', $nowMs);
        $sent = !empty($r['ok']);
        $reason = $sent ? 'sent' : (!empty($r['skipped']) ? 'skipped' : 'failed');
        $by = self::by($who);
        $at = self::at($nowMs);
        try {
            $o = Store::locked('orderedit', function () use ($number, $o, $p, $by, $at, $sent, $reason) {
                $cur = Store::get('order:' . $number);
                if (!is_array($cur)) $cur = $o;
                $cur['history'] = self::pushHistory($cur, ['at' => $at, 'by' => $by, 'kind' => 'send', 'rev' => (int) ($cur['rev'] ?? 0), 'to' => $p['to'], 'ok' => $sent, 'reason' => $reason]);
                $cur['lastSent'] = ['at' => $at, 'by' => $by, 'to' => $p['to'], 'ok' => $sent, 'reason' => $reason];
                Store::put('order:' . $number, $cur, self::TTL);
                return $cur;
            });
        } catch (\Throwable $e) {                                                                            // el correo ya salió (o falló): nunca se convierte en un error por no poder anotarlo
            error_log('torivac-api: [reenvío] No se pudo anotar el resultado de ' . $number . ': ' . mb_substr($e->getMessage(), 0, 160));
        }
        Audit::log('order.send', $who, $req, $number . ' → ' . implode(', ', array_map(function ($a) { return self::mask($a); }, $p['to'])) . ($sent ? '' : ' (NO se envió)'));
        $body = ['ok' => true, 'sent' => $sent, 'reason' => $reason, 'order' => self::view($o, $who)];
        if (self::isManager($who) && !empty($r['error'])) $body['error'] = Mail::scrub($r['error']);
        return new Response($body, 200, ['Cache-Control' => 'private, no-store']);
    }
}
