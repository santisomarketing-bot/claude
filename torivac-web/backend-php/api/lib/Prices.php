<?php
/**
 * [PRICES] Precios vigentes, tramos por cantidad, valoración de pedidos en servidor (el cliente nunca fija precios) e histórico.
 *   { updated_at, source, currency, mode:'demo'|'live'|'none', items:{ ref:{ p, t:[[cantMin,precio],…], note?, n?, pid? } } }
 * Importes: el precio unitario conserva hasta 4 decimales; el importe de línea se redondea a 2.
 *
 * [SHEETS] Lectura de la hoja de Drive (Google Sheets API con cuenta de servicio, o CSV público con enlace), CSV con comillas y sincronización.
 * MODOS (prices.update_mode · parámetro mode): «merge» (por defecto) = la hoja puede traer SOLO UNA PARTE del catálogo: cada fila reconocida (por referencia, SKU o ID) actualiza su
 * referencia, las filas con precio 0 o active = 0 la dejan sin precio y todo lo demás se conserva; «replace» = la hoja sustituye a toda la lista de precios.
 * Reglas de seguridad (se rechaza salvo force): «precio de relleno», cambio masivo (más de la mitad de las referencias que ya tenían precio cambian más de un 40 %; retirar un precio
 * cuenta como cambio), una hoja que RETIRA 10 o más referencias y más del 30 % de los precios vigentes, y una hoja tras la cual quedaría menos del 50 % de los precios vigentes (si eran 10 o más).
 * La sincronización automática (cron, «Actualizar ahora») NUNCA aplica una hoja con bloqueos: conserva los precios vigentes y deja el motivo en prices:sync (lo muestran el panel y el diagnóstico).
 */
namespace Torivac;

final class Prices
{
    const KEY_CURRENT = 'prices:current';
    const KEY_META = 'prices:meta';
    /** Estado del ÚLTIMO intento de sincronización (también el fallido o bloqueado): {at, reason, ok, blocked, error}. Lo ven los managers (GET /prices y /diag). */
    const KEY_SYNC = 'prices:sync';

    /** Precios vigentes; si todavía no hay, devuelve una hoja vacía (modo none). */
    public static function load(): array
    {
        $p = Store::get(self::KEY_CURRENT);
        return is_array($p) ? $p + ['items' => []] : ['updated_at' => null, 'source' => 'none', 'currency' => 'EUR', 'mode' => 'none', 'items' => []];
    }

    /** Origen sin datos personales ni identificadores: «upload:ana@torivac.com» → «upload», «sheet:ID» → «sheet». */
    public static function coarse($s): string { return explode(':', (string) $s)[0]; }

    /** Lo que ve cualquier visitante de GET /prices: igual que el original pero sin el correo de quien cargó la hoja ni el id del archivo de Drive. */
    public static function publicView(array $prices, $meta): array
    {
        $prices['source'] = self::coarse($prices['source'] ?? '');
        if (is_array($meta)) { $meta['reason'] = self::coarse($meta['reason'] ?? ''); $meta['source'] = self::coarse($meta['source'] ?? ''); }
        return ['prices' => $prices, 'meta' => $meta];
    }

    /** para JSON: items vacío → {} y claves numéricas siempre como objeto */
    public static function forJson(array $p): array
    {
        $p['items'] = (object) ($p['items'] ?? []);
        return $p;
    }

    /** Precio unitario de una referencia para una cantidad, aplicando el último tramo alcanzado; null si no tiene precio. */
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

    /** Modo de actualización válido: «replace» (la hoja sustituye a toda la lista) o «merge» (solo lo que trae la hoja; es lo normal y vale para cualquier otro valor). */
    public static function mode($m): string { return $m === 'replace' ? 'replace' : 'merge'; }

    /**
     * Aplica una hoja ya leída (`$sheet`) a los precios vigentes (`$prev`). «merge»: quita las referencias de `$retire` y pone o actualiza las que trae la hoja (si una referencia
     * sale a la vez para quitar y con precio, gana el precio); el resto se conserva tal cual. «replace»: la hoja sustituye a todo. Los metadatos (fecha, origen) son los de la hoja nueva.
     */
    public static function merge(array $prev, array $sheet, array $retire, string $mode = 'merge'): array
    {
        if ($mode === 'replace') return $sheet;
        $items = $prev['items'] ?? [];
        foreach ($retire as $ref) unset($items[$ref]);
        foreach ($sheet['items'] as $ref => $it) $items[$ref] = $it;
        return ['items' => $items] + $sheet;
    }

    /**
     * Aviso «cambio_masivo» si ≥ 10 referencias de la hoja ya tenían precio y más de la mitad cambia más de un 40 % (¿hoja equivocada, columna movida, otra unidad?); null si no.
     * Las referencias que la hoja pide RETIRAR (`$retire`) y que tenían precio cuentan como cambiadas al 100 %; si la hoja trae también un precio para esa referencia, gana el precio.
     */
    public static function massChange(array $prev, array $sheetItems, array $retire = []): ?array
    {
        $n = 0; $big = 0;
        foreach ($sheetItems as $ref => $it) {
            $old = $prev['items'][$ref]['p'] ?? null;
            if (!is_numeric($old) || $old <= 0) continue;
            $n++;
            if (abs($it['p'] - $old) / $old > 0.4) $big++;
        }
        foreach ($retire as $ref) {
            if (isset($sheetItems[$ref])) continue;
            $old = $prev['items'][$ref]['p'] ?? null;
            if (!is_numeric($old) || $old <= 0) continue;
            $n++; $big++;
        }
        if ($n < 10 || $big / $n <= 0.5) return null;
        return ['code' => 'cambio_masivo', 'message' => 'Más de la mitad de las referencias que ya tenían precio cambia más de un 40 % o se retira (' . $big . ' de ' . $n . '): ¿hoja equivocada, columna movida o cambio de unidades?', 'count' => $big];
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
    public static function save(array $next, array $prev, string $reason = 'manual', string $source = 'sheet', ?float $now = null, ?string $mode = null): array
    {
        $diff = self::diff($prev, $next);
        $iso = Util::iso($now);
        if ($prev['items']) Store::put('prices:history:' . $iso, self::forJson($prev), 90 * 86400);
        Store::put(self::KEY_CURRENT, self::forJson($next));
        $meta = ['at' => $iso, 'reason' => $reason, 'source' => $source, 'refs' => count($next['items']), 'changed' => count($diff['changed']), 'added' => count($diff['added']), 'removed' => count($diff['removed'])];
        if ($mode !== null) $meta['mode'] = $mode;
        Store::put(self::KEY_META, $meta);
        return $meta;
    }

    /** Anota el resultado del último intento de sincronización (ver KEY_SYNC); un fallo al anotarlo nunca tapa el resultado real. */
    public static function recordSync(array $state): void
    {
        try { Store::put(self::KEY_SYNC, $state); } catch (\Throwable $e) { error_log('torivac-api: no se pudo anotar el estado de la sincronización: ' . $e->getMessage()); }
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
        if (!$key || !openssl_sign($head . '.' . $claim, $sig, $key, OPENSSL_ALGO_SHA256)) throw new \RuntimeException('La clave de la cuenta de servicio no es válida', 502);
        $url = (string) Config::get('prices.google_oauth_url', 'https://oauth2.googleapis.com/token');
        [$st, $body] = Http::request('POST', $url, ['Content-Type: application/x-www-form-urlencoded'], http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $head . '.' . $claim . '.' . Util::b64url($sig)]));
        $j = json_decode($body, true);
        if ($st !== 200 || !isset($j['access_token'])) throw new \RuntimeException('Google OAuth ' . $st, 502);
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
            if ($ds !== 200) throw new \RuntimeException("No puedo leer el archivo de Drive: Sheets API $st · Drive API $ds (¿está compartido con el correo de la cuenta de servicio?)", 502);
            return [self::xlsxRows($dbody, 'el archivo de Drive no es una hoja de Google ni un .xlsx'), 'drive-xlsx:' . $id];
        }
        $xlsx = (string) Config::get('prices.xlsx_url', '');
        if ($xlsx !== '') {
            [$st, $body] = Http::request('GET', $xlsx);
            if ($st !== 200) throw new \RuntimeException('XLSX ' . $st, 502);
            return [self::xlsxRows($body, 'la URL no devolvió un libro: ¿el archivo está compartido con enlace?'), 'xlsx-url'];
        }
        $csv = (string) Config::get('prices.csv_url', '');
        if ($csv !== '') {
            [$st, $body] = Http::request('GET', $csv);
            if ($st !== 200) throw new \RuntimeException('CSV ' . $st, 502);
            return [self::parseCsv($body), 'csv-url'];
        }
        throw new \RuntimeException('Sin origen de precios: configura prices.sheet_id + prices.google_service_account, prices.xlsx_url o prices.csv_url', 503);
    }

    /**
     * Plan de una actualización, sin guardar nada: lee las filas, las aplica a los precios vigentes según `$mode` («merge»: solo lo que trae la hoja; «replace»: sustituye todo) y
     * lista lo que exigiría confirmar (`blockers`). Lo usan la vista previa y la sincronización, para que enseñen y hagan exactamente lo mismo.
     * @return array{next:array,prev:array,sheet:array,report:array,mode:string,kept:int,blockers:string[]}
     */
    public static function plan(array $rows, string $source, $mode, ?array $ctx = null, ?float $now = null): array
    {
        $mode = Prices::mode($mode);
        $res = Prices::fromRows($rows, $source, $ctx, $now);
        $sheet = $res['prices'];
        $report = $res['report'];
        $prev = Prices::load();
        $blockers = [];
        foreach ($report['warnings'] as $w) { if ($w['code'] === 'precio_de_relleno') $blockers[] = $w['message']; }
        $mass = Prices::massChange($prev, $sheet['items'], $report['retire']);
        if ($mass) { $report['warnings'][] = $mass; $blockers[] = $mass['message']; }
        $n = count($sheet['items']); $p = count($prev['items']);
        if ($mode === 'replace' && $p > 0 && $n < $p * 0.5) $blockers[] = "la hoja nueva tiene $n referencias y había $p (¿hoja vacía o rota?)";
        $next = Prices::merge($prev, $sheet, $report['retire'], $mode);
        $remain = count($next['items']);                                                         // referencias con precio que habría tras aplicar la hoja
        $gone = $p - count(array_intersect_key($prev['items'], $next['items']));                 // precios vigentes que desaparecerían (en «merge», solo los que la hoja retira)
        if ($mode === 'merge' && $gone >= 10 && $gone > $p * 0.3) $blockers[] = 'La hoja retira ' . $gone . ' de ' . $p . ' precios (' . (int) round(100 * $gone / $p) . ' %): confírmalo con force';
        if ($mode === 'merge' && $p >= 10 && $remain < $p * 0.5) $blockers[] = 'Tras aplicar la hoja quedarían ' . $remain . ' de ' . $p . ' precios vigentes (menos de la mitad): confírmalo con force';
        $kept = $mode === 'replace' ? 0 : $p - count(array_intersect_key($prev['items'], $sheet['items'] + array_fill_keys($report['retire'], 1)));
        return ['next' => $next, 'prev' => $prev, 'sheet' => $sheet, 'report' => $report, 'mode' => $mode, 'kept' => $kept, 'blockers' => $blockers];
    }

    /**
     * Lee la hoja (Drive, CSV o filas subidas), valida y publica. `mode` («merge» por defecto, o prices.update_mode; «replace» sustituye toda la lista). ctx = contexto del catálogo (null → el del sitio; [] → aceptar todo, pruebas).
     * @return array meta + warnings
     */
    public static function sync(array $o = []): array
    {
        $o += ['reason' => 'manual', 'force' => false, 'rows' => null, 'source' => null, 'ctx' => null, 'now' => null, 'mode' => null];
        $state = ['at' => Util::iso($o['now']), 'reason' => (string) $o['reason'], 'ok' => false, 'blocked' => false, 'error' => ''];
        try {
            if ($o['rows'] !== null) { $rows = $o['rows']; $source = $o['source'] ?? 'upload'; }
            else { [$rows, $source] = self::readRows(); }
            $plan = self::plan($rows, $source, $o['mode'] ?? Config::get('prices.update_mode', 'merge'), $o['ctx'], $o['now']);
            if (!$o['force'] && $plan['blockers']) { $state['blocked'] = true; throw new \RuntimeException('Sincronización rechazada: ' . implode('; ', $plan['blockers']) . '. Usa force=true si es intencionado.', 409); }
            $meta = Prices::save($plan['next'], $plan['prev'], $o['reason'], $source, $o['now'], $plan['mode']);
            $meta['kept'] = $plan['kept'];
            $meta['warnings'] = array_slice(array_map(function ($w) { return $w['message']; }, $plan['report']['warnings']), 0, 10);
            Prices::recordSync(['ok' => true, 'refs' => $meta['refs']] + $state);
            return $meta;
        } catch (\Throwable $e) {                                                                // los precios vigentes NO se tocan: se anota por qué y se vuelve a lanzar
            $state['error'] = mb_substr($e->getMessage(), 0, 500);
            Prices::recordSync($state);
            throw $e;
        }
    }
}
