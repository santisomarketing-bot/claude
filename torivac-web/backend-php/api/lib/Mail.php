<?php
/**
 * [MAIL] Envío de correo con tres controladores (config mail.driver):
 *   resend → API HTTP de Resend (recomendado; hay que verificar el dominio con SPF/DKIM)
 *   mail   → función mail() de PHP (el propio hosting; sin garantías de entrega si el SPF del dominio no incluye el servidor)
 *   file   → guarda cada correo como JSON en storage/outbox (pruebas y entornos sin correo)
 * Sin controlador configurado no se envía nada y se devuelve ['skipped' => true]: el pedido se guarda igualmente.
 *
 * orderMail() compone el correo del pedido para el EQUIPO (HTML + texto, con los datos que escribió el visitante y su PDF adjunto).
 * copyMail() compone la copia para el CLIENTE: solo contenido generado por el servidor (texto fijo en el idioma del pedido, número, líneas valoradas, total); NADA escrito
 * por el visitante (ni nombre, ni empresa, ni teléfono, ni notas) y SIN adjunto: si no, el correo corporativo sería un relé de mensajes de cualquiera hacia terceros.
 */
namespace Torivac;

final class Mail
{
    /** Línea fija que acompaña al PDF en el correo al equipo: el PDF lo fabrica el navegador del cliente y no vincula. */
    const PDF_NOTE = 'El PDF adjunto lo ha generado el navegador del cliente: el importe que vale es el calculado por el servidor (arriba).';

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

    /** ¿Hay un controlador de correo listo para enviar? (resend con clave, mail o file) */
    public static function enabled(): bool
    {
        $driver = (string) Config::get('mail.driver', 'none');
        if ($driver === 'resend') return (string) Config::get('mail.resend_api_key', '') !== '';
        return $driver === 'mail' || $driver === 'file';
    }

    /** @param array{to:string[],cc?:string[],subject:string,html?:string,text?:string,replyTo?:string,attachments?:array} $m */
    public static function send(array $m): array
    {
        $driver = (string) Config::get('mail.driver', 'none');
        $from = (string) Config::get('order_from', 'Torivac Web <pedidos@torivac.com>');
        foreach ((array) ($m['to'] ?? []) as $a) { if (!is_string($a) || !Orders::validEmail($a)) return ['ok' => false, 'error' => 'Destinatario no válido']; }     // nunca «a@b.co,otro»: una coma en To: manda el correo a quien no toca
        $m['subject'] = trim((string) preg_replace('/[\x00-\x1f\x7f]+/', ' ', (string) ($m['subject'] ?? '')));                                           // un asunto nunca lleva saltos de línea
        if ($driver === 'resend') {
            $key = (string) Config::get('mail.resend_api_key', '');
            if ($key === '') return ['ok' => false, 'skipped' => true];
            $body = ['from' => $from, 'to' => $m['to'], 'subject' => $m['subject'], 'html' => $m['html'] ?? '', 'text' => $m['text'] ?? ''];
            if (!empty($m['cc'])) $body['cc'] = $m['cc'];
            if (!empty($m['replyTo'])) $body['reply_to'] = $m['replyTo'];
            if (!empty($m['attachments'])) $body['attachments'] = $m['attachments'];
            try {
                [$st, $resp] = Http::request('POST', rtrim((string) Config::get('mail.api_base', 'https://api.resend.com'), '/') . '/emails', ['Authorization: Bearer ' . $key, 'Content-Type: application/json'], Util::enc($body));
            } catch (\Throwable $e) { return ['ok' => false, 'error' => $e->getMessage()]; }
            if ($st < 200 || $st >= 300) return ['ok' => false, 'status' => $st];
            $j = json_decode($resp, true);
            return ['ok' => true, 'id' => $j['id'] ?? null];
        }
        if ($driver === 'mail') {
            [$headers, $body] = self::mime($from, $m);
            $ok = @mail(implode(',', $m['to']), self::encodeHeader($m['subject']), $body, $headers);
            return ['ok' => (bool) $ok];
        }
        if ($driver === 'file') {
            $f = Store::root() . '/outbox/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.json';
            file_put_contents($f, Util::enc($m + ['from' => $from]));
            @chmod($f, Store::FILE_MODE);
            return ['ok' => true, 'id' => basename($f)];
        }
        return ['ok' => false, 'skipped' => true];
    }

    /** Codifica un asunto con caracteres no ASCII como palabra MIME UTF-8 en base64. */
    private static function encodeHeader(string $s): string { return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }

    /** cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail() */
    public static function mime(string $from, array $m): array
    {
        $b1 = 'tv-' . bin2hex(random_bytes(8));
        $b2 = 'tv-' . bin2hex(random_bytes(8));
        $h = ['From: ' . preg_replace('/[\r\n]+/', ' ', $from), 'MIME-Version: 1.0'];
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
}
