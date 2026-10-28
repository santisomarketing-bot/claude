<?php
/**
 * [MAIL] Envío de correo con tres controladores (config mail.driver):
 *   resend → API HTTP de Resend (recomendado; hay que verificar el dominio con SPF/DKIM)
 *   mail   → función mail() de PHP (el propio hosting; sin garantías de entrega si el SPF del dominio no incluye el servidor)
 *   file   → guarda cada correo como JSON en storage/outbox (pruebas y entornos sin correo)
 * Sin controlador configurado no se envía nada y se devuelve ['skipped' => true]: el pedido se guarda igualmente.
 *
 * orderMail() compone el correo del pedido (HTML + texto) con las líneas, el total y los datos del cliente.
 */
namespace Torivac;

final class Mail
{
    /** @param array{to:string[],cc?:string[],subject:string,html?:string,text?:string,replyTo?:string,attachments?:array} $m */
    public static function send(array $m): array
    {
        $driver = (string) Config::get('mail.driver', 'none');
        $from = (string) Config::get('order_from', 'Torivac Web <pedidos@torivac.com>');
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
            return ['ok' => true, 'id' => basename($f)];
        }
        return ['ok' => false, 'skipped' => true];
    }

    private static function encodeHeader(string $s): string { return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }

    /** cabeceras y cuerpo MIME (alternativa texto/HTML + adjuntos) para mail() */
    public static function mime(string $from, array $m): array
    {
        $b1 = 'tv-' . bin2hex(random_bytes(8));
        $b2 = 'tv-' . bin2hex(random_bytes(8));
        $h = ['From: ' . $from, 'MIME-Version: 1.0'];
        if (!empty($m['cc'])) $h[] = 'Cc: ' . implode(', ', $m['cc']);
        if (!empty($m['replyTo'])) $h[] = 'Reply-To: ' . $m['replyTo'];
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
            $body .= "--$b1\r\nContent-Type: application/pdf; name=\"$name\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n" . chunk_split($a['content']);
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

    /** @return array{html:string,text:string} */
    public static function orderMail(array $d, array $items): array
    {
        $lang = $d['lang']; $c = $d['customer']; $p = $d['priced']; $number = $d['number']; $demo = !empty($d['demo']);
        $e = function ($v) { return Util::esc($v); };
        $rows = '';
        foreach ($p['lines'] as $l) {
            $rows .= '<tr><td style="font-family:monospace">' . $e($l['ref']) . '</td><td>' . $e($items[$l['ref']]['n'] ?? '') . '</td><td style="text-align:right">' . (int) $l['qty'] . '</td><td style="text-align:right">' . $e(self::money($l['unit'], $lang)) . '</td><td style="text-align:right"><b>' . $e(self::money($l['total'], $lang)) . '</b></td></tr>';
        }
        $html = '<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Nuevo pedido ' . $e($number) . ($demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : '') . '</h2>' .
            '<p><b>' . $e($c['name']) . '</b> ' . ($c['company'] !== '' ? '· ' . $e($c['company']) : '') . '<br>' . $e($c['email']) . ($c['phone'] !== '' ? ' · ' . $e($c['phone']) : '') . '</p>' .
            '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Ud.</th><th>Importe</th></tr>' . $rows . '</table>' .
            '<p style="text-align:right;font-size:18px">Total (sin IVA): <b>' . $e(self::money($p['total'], $lang)) . '</b>' . ($p['unpriced'] ? '<br><small>' . (int) $p['unpriced'] . ' línea(s) «A consultar» no incluidas en el total</small>' : '') . '</p>' .
            ($c['notes'] !== '' ? '<p><b>Notas:</b> ' . $e($c['notes']) . '</p>' : '') . '<p style="color:#777;font-size:12px">Idioma del cliente: ' . $e($lang) . ' · El PDF del presupuesto va adjunto.</p></div>';
        $lines = ['Nuevo pedido ' . $number . ($demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''), $c['name'] . ' <' . $c['email'] . '> ' . $c['phone'], ''];
        foreach ($p['lines'] as $l) $lines[] = $l['ref'] . "\t" . ($items[$l['ref']]['n'] ?? '') . "\tx" . (int) $l['qty'] . "\t" . self::money($l['total'], $lang);
        $lines[] = '';
        $lines[] = 'Total (sin IVA): ' . self::money($p['total'], $lang);
        if ($c['notes'] !== '') { $lines[] = ''; $lines[] = 'Notas: ' . $c['notes']; }
        return ['html' => $html, 'text' => implode("\n", $lines)];
    }
}
