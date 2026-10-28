<?php
/**
 * [PRICES] Precios vigentes, tramos por cantidad, valoración de pedidos en servidor (el cliente nunca fija precios) e histórico.
 *   { updated_at, source, currency, mode:'demo'|'live'|'none', items:{ ref:{ p, t:[[cantMin,precio],…], note?, n?, pid? } } }
 * Importes: el precio unitario conserva hasta 4 decimales; el importe de línea se redondea a 2.
 *
 * [SHEETS] Lectura de la hoja de Drive (Google Sheets API con cuenta de servicio, o CSV público con enlace), CSV con comillas y sincronización
 * con reglas de seguridad: se rechaza una hoja con < 50 % de las referencias que había o con «precio de relleno», salvo force.
 */
namespace Torivac;

final class Prices
{
    const KEY_CURRENT = 'prices:current';
    const KEY_META = 'prices:meta';

    public static function load(): array
    {
        $p = Store::get(self::KEY_CURRENT);
        return is_array($p) ? $p + ['items' => []] : ['updated_at' => null, 'source' => 'none', 'currency' => 'EUR', 'mode' => 'none', 'items' => []];
    }

    /** para JSON: items vacío → {} y claves numéricas siempre como objeto */
    public static function forJson(array $p): array
    {
        $p['items'] = (object) ($p['items'] ?? []);
        return $p;
    }

    public static function unit(array $prices, string $ref, int $qty): ?float
    {
        $p = $prices['items'][$ref] ?? null;
        if (!is_array($p) || !isset($p['p']) || !is_numeric($p['p'])) return null;
        $u = (float) $p['p'];
        foreach ($p['t'] ?? [] as $tier) { if ($qty >= $tier[0]) $u = (float) $tier[1]; }
        return $u;
    }

    /** valora líneas [{ref,qty}]; sin precio → unit/total null («Consultar»: no suman) */
    public static function priceOrder(array $prices, array $lines): array
    {
        $total = 0.0; $unpriced = 0; $out = [];
        foreach ($lines as $l) {
            $unit = self::unit($prices, $l['ref'], (int) $l['qty']);
            $t = $unit === null ? null : Util::round2($unit * $l['qty']);
            if ($t === null) $unpriced++; else $total += $t;
            $out[] = $l + ['unit' => $unit, 'total' => $t];
        }
        return ['lines' => $out, 'total' => Util::round2($total), 'unpriced' => $unpriced];
    }

    /** catálogo del sitio + referencias que la hoja añadió dentro de un producto */
    public static function withSheetItems(array $catalog, array $prices): array
    {
        $out = $catalog;
        foreach ($prices['items'] ?? [] as $ref => $v) {
            if (!isset($out[$ref]) && !empty($v['pid'])) $out[$ref] = ['n' => $v['n'] ?? (string) $ref, 'pid' => $v['pid']];
        }
        return $out;
    }

    /** diferencias entre dos juegos de precios */
    public static function diff(array $a, array $b): array
    {
        $d = ['changed' => [], 'added' => [], 'removed' => [], 'same' => 0];
        foreach ($b['items'] as $k => $y) {
            $x = $a['items'][$k] ?? null;
            if ($x === null) $d['added'][] = (string) $k;
            elseif ($x['p'] != $y['p'] || Util::enc($x['t'] ?? []) !== Util::enc($y['t'] ?? [])) $d['changed'][] = (string) $k;
            else $d['same']++;
        }
        foreach ($a['items'] as $k => $_) { if (!isset($b['items'][$k])) $d['removed'][] = (string) $k; }
        return $d;
    }

    /** guarda unos precios nuevos: el anterior pasa al histórico (90 días), se escriben los vigentes y la meta */
    public static function save(array $next, array $prev, string $reason = 'manual', string $source = 'sheet', ?float $now = null): array
    {
        $diff = self::diff($prev, $next);
        $iso = Util::iso($now);
        if ($prev['items']) Store::put('prices:history:' . $iso, self::forJson($prev), 90 * 86400);
        Store::put(self::KEY_CURRENT, self::forJson($next));
        $meta = ['at' => $iso, 'reason' => $reason, 'source' => $source, 'refs' => count($next['items']), 'changed' => count($diff['changed']), 'added' => count($diff['added']), 'removed' => count($diff['removed'])];
        Store::put(self::KEY_META, $meta);
        return $meta;
    }

    /** filas → ['prices' => …, 'report' => …] con las reglas compartidas de PriceSheet */
    public static function fromRows(array $rows, string $source, ?array $ctx = null, ?float $now = null): array
    {
        $r = PriceSheet::read($rows, $ctx ?? Catalog::sheetCtx());
        $items = $r['items'];
        unset($r['items']);
        return ['prices' => ['updated_at' => Util::iso($now), 'source' => $source, 'currency' => 'EUR', 'mode' => 'live', 'items' => $items], 'report' => $r];
    }
}

final class Sheets
{
    /** CSV (RFC 4180: comillas, separador , o ;, saltos de línea dentro de comillas) → filas */
    public static function parseCsv(string $text): array
    {
        $text = preg_replace('/^\xEF\xBB\xBF/', '', $text);
        $first = strtok($text, "\n") ?: '';
        $delim = substr_count($first, ';') >= substr_count($first, ',') ? ';' : ',';
        $rows = []; $row = []; $cell = ''; $q = false; $n = strlen($text);
        for ($i = 0; $i < $n; $i++) {
            $ch = $text[$i];
            if ($q) {
                if ($ch === '"') { if (($text[$i + 1] ?? '') === '"') { $cell .= '"'; $i++; } else $q = false; }
                else $cell .= $ch;
            } elseif ($ch === '"') $q = true;
            elseif ($ch === $delim) { $row[] = trim($cell); $cell = ''; }
            elseif ($ch === "\n") { $row[] = trim($cell); $cell = ''; if (array_filter($row, function ($c) { return $c !== ''; })) $rows[] = $row; $row = []; }
            elseif ($ch !== "\r") $cell .= $ch;
        }
        $row[] = trim($cell);
        if (array_filter($row, function ($c) { return $c !== ''; })) $rows[] = $row;
        return $rows;
    }

    /** cuenta de servicio de Google: array, ruta a un .json o texto JSON */
    private static function serviceAccount()
    {
        $sa = Config::get('prices.google_service_account', null);
        if (is_array($sa)) return $sa;
        if (is_string($sa) && $sa !== '') {
            $j = is_file($sa) ? json_decode((string) file_get_contents($sa), true) : json_decode($sa, true);
            if (is_array($j)) return $j;
        }
        return null;
    }

    /** token de acceso OAuth2 (JWT RS256 firmado con openssl) */
    public static function accessToken(array $sa, ?int $now = null): string
    {
        $iat = $now ?? time();
        $head = Util::b64url(Util::enc(['alg' => 'RS256', 'typ' => 'JWT']));
        $claim = Util::b64url(Util::enc(['iss' => $sa['client_email'], 'scope' => 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly', 'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $iat, 'exp' => $iat + 3600]));
        $key = openssl_pkey_get_private($sa['private_key']);
        if (!$key || !openssl_sign($head . '.' . $claim, $sig, $key, OPENSSL_ALGO_SHA256)) throw new \RuntimeException('La clave de la cuenta de servicio no es válida');
        $url = (string) Config::get('prices.google_oauth_url', 'https://oauth2.googleapis.com/token');
        [$st, $body] = Http::request('POST', $url, ['Content-Type: application/x-www-form-urlencoded'], http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $head . '.' . $claim . '.' . Util::b64url($sig)]));
        $j = json_decode($body, true);
        if ($st !== 200 || !isset($j['access_token'])) throw new \RuntimeException('Google OAuth ' . $st);
        return $j['access_token'];
    }

    /** filas de la hoja de precios de un libro .xlsx descargado (bytes); si no es un libro, el error dice qué revisar */
    private static function xlsxRows(string $bytes, string $hint): array
    {
        try { $sheets = Xlsx::read($bytes); } catch (\InvalidArgumentException $e) { throw new \InvalidArgumentException($e->getMessage() . ' (' . $hint . ')'); }
        return Xlsx::pick($sheets, (string) Config::get('prices.sheet_name', ''))['rows'];
    }

    /**
     * Tres orígenes, en este orden:
     *   1) cuenta de servicio + prices.sheet_id: hoja de Google → Sheets API; si es un .xlsx subido a Drive sin convertir → se descarga con la API de Drive y se lee el libro
     *   2) prices.xlsx_url: descarga directa de un .xlsx (Drive «compartir con enlace»: https://drive.google.com/uc?export=download&id=<ID> · hoja de Google: …/export?format=xlsx)
     *   3) prices.csv_url: exportación CSV pública con enlace
     * @return array{0:array,1:string} [filas, origen]
     */
    public static function readRows(): array
    {
        $sa = self::serviceAccount();
        $id = (string) Config::get('prices.sheet_id', '');
        if ($sa && $id !== '') {
            $token = self::accessToken($sa);
            $auth = ['Authorization: Bearer ' . $token];
            $base = rtrim((string) Config::get('prices.google_sheets_base', 'https://sheets.googleapis.com'), '/');
            $range = rawurlencode((string) Config::get('prices.sheet_range', 'Precios!A:O'));
            [$st, $body] = Http::request('GET', $base . '/v4/spreadsheets/' . rawurlencode($id) . '/values/' . $range . '?valueRenderOption=UNFORMATTED_VALUE', $auth);
            if ($st === 200) { $j = json_decode($body, true); return [$j['values'] ?? [], 'sheet:' . $id]; }
            // un .xlsx guardado tal cual en Drive (sin «Guardar como hoja de cálculo de Google») no se lee con la API de Sheets: se descarga con la de Drive
            $drive = rtrim((string) Config::get('prices.google_drive_base', 'https://www.googleapis.com'), '/');
            [$ds, $dbody] = Http::request('GET', $drive . '/drive/v3/files/' . rawurlencode($id) . '?alt=media', $auth);
            if ($ds !== 200) throw new \RuntimeException("No puedo leer el archivo de Drive: Sheets API $st · Drive API $ds (¿está compartido con el correo de la cuenta de servicio?)");
            return [self::xlsxRows($dbody, 'el archivo de Drive no es una hoja de Google ni un .xlsx'), 'drive-xlsx:' . $id];
        }
        $xlsx = (string) Config::get('prices.xlsx_url', '');
        if ($xlsx !== '') {
            [$st, $body] = Http::request('GET', $xlsx);
            if ($st !== 200) throw new \RuntimeException('XLSX ' . $st);
            return [self::xlsxRows($body, 'la URL no devolvió un libro: ¿el archivo está compartido con enlace?'), 'xlsx-url'];
        }
        $csv = (string) Config::get('prices.csv_url', '');
        if ($csv !== '') {
            [$st, $body] = Http::request('GET', $csv);
            if ($st !== 200) throw new \RuntimeException('CSV ' . $st);
            return [self::parseCsv($body), 'csv-url'];
        }
        throw new \RuntimeException('Sin origen de precios: configura prices.sheet_id + prices.google_service_account, prices.xlsx_url o prices.csv_url');
    }

    /**
     * Lee la hoja (Drive, CSV o filas subidas), valida y publica. ctx = contexto del catálogo (null → el del sitio; [] → aceptar todo, pruebas).
     * @return array meta + warnings
     */
    public static function sync(array $o = []): array
    {
        $o += ['reason' => 'manual', 'force' => false, 'rows' => null, 'source' => null, 'ctx' => null, 'now' => null];
        if ($o['rows'] !== null) { $rows = $o['rows']; $source = $o['source'] ?? 'upload'; }
        else { [$rows, $source] = self::readRows(); }
        $res = Prices::fromRows($rows, $source, $o['ctx'], $o['now']);
        $next = $res['prices'];
        $prev = Prices::load();
        $n = count($next['items']); $p = count($prev['items']);
        $filler = null;
        foreach ($res['report']['warnings'] as $w) { if ($w['code'] === 'precio_de_relleno') $filler = $w; }
        if (!$o['force'] && $filler) throw new \RuntimeException('Sincronización rechazada: ' . $filler['message'] . '. Usa force=true si es intencionado.', 409);
        if (!$o['force'] && $p > 0 && $n < $p * 0.5) throw new \RuntimeException("Sincronización rechazada: la hoja nueva tiene $n referencias y había $p (¿hoja vacía o rota?). Usa force=true si es intencionado.", 409);
        $meta = Prices::save($next, $prev, $o['reason'], $source, $o['now']);
        $meta['warnings'] = array_slice(array_map(function ($w) { return $w['message']; }, $res['report']['warnings']), 0, 10);
        return $meta;
    }
}
