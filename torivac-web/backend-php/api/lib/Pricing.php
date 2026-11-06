<?php
/**
 * [PRICING] Precios por categoría de cliente, ajustes de precios y edición de producto a producto (contrato único con workers/api: docs/PRECIOS-Y-CLIENTES.md).
 *   CATEGORÍAS  TIERS = vip · vip5 · vip10 · normal. El precio de la hoja es el VIP; VIP +5 = ×1,05, VIP +10 = ×1,10, Normal = ×1,15 (los porcentajes son masivos y se editan en settings:pricing).
 *               precio(categoría, ref, cantidad) = redondeo a 4 decimales de precioVIP(ref, cantidad) × (1 + porcentaje/100); los tramos se escalan igual. Sin precio = «A consultar» (null) en todas.
 *   APROXIMADO  Solo para el visitante con anon = consult y approx.on: por referencia, `a:false` = nunca · `a` número > 0 = ese · si no, redondeo4(p × (1 + approx.pct/100)) redondeado a euro entero (≥ 10) o a 1 decimal.
 *   AJUSTES     settings:pricing (sin caducidad): { tiers:{vip5,vip10,normal}, anon:'consult'|'normal', approx:{on,pct}, updated:{at,by}|null }. load() devuelve siempre la forma completa y solo valores válidos.
 *     GET /api/settings/pricing  → { ok, pricing }        (manager y client)
 *     PUT /api/settings/pricing  → valida y guarda con quién y cuándo; error → 400 { ok:false, error, field } con field = tiers.vip5|tiers.vip10|tiers.normal|anon|approx.pct|approx.on
 *   PRODUCTO    PUT /api/prices/items/:ref { p?, t?, a?, manual? } (manager y client): precio VIP unitario, tramos, aproximado y marca «manual» (m:true = la hoja no lo pisa). Guarda con histórico (razón edit:<correo>).
 * [SEGURIDAD] El VIP nunca sale a quien no corresponde: los visitantes y los clientes (`customer`) solo reciben precios ya escalados a lo suyo y sin las marcas internas `m` y `a`. Todo texto de error va en castellano.
 */
namespace Torivac;

final class Pricing
{
    /** Clave del almacén de los ajustes de precios. */
    const KEY = 'settings:pricing';
    /** Categorías de precio, de la más barata a la más cara. */
    const TIERS = ['vip', 'vip5', 'vip10', 'normal'];
    /** Nombre que se enseña de cada categoría (y «consult» para un presupuesto valorado «A consultar»). */
    const LABELS = ['vip' => 'VIP', 'vip5' => 'VIP +5', 'vip10' => 'VIP +10', 'normal' => 'Normal', 'consult' => 'A consultar'];
    /** Porcentajes por defecto sobre el VIP (el VIP es el precio base: siempre 0). */
    const DEFAULT_TIERS = ['vip5' => 5, 'vip10' => 10, 'normal' => 15];
    /** Qué ve y presupuesta quien no ha entrado: «consult» (precio a consultar) o «normal» (precio de la categoría Normal). */
    const ANON = ['consult', 'normal'];
    /** Porcentaje por defecto del precio aproximado. */
    const DEFAULT_APPROX_PCT = 15;
    /** Tamaño máximo del cuerpo del PUT de ajustes (bytes). */
    const MAX_BODY = 2048;
    /** Tamaño máximo del cuerpo de la edición de un producto (bytes). */
    const ITEM_MAX_BODY = 20000;
    /** Precio máximo de una referencia (euros). */
    const MAX_PRICE = 10000000;
    /** Tramos por cantidad como mucho en una referencia. */
    const MAX_TIERS = 8;

    // ───────────────────────────────────────── [CATEGORÍAS]
    /** ¿Es una de las cuatro categorías (vip, vip5, vip10, normal)? */
    public static function isTier($v): bool { return is_string($v) && in_array($v, self::TIERS, true); }

    /** La categoría guardada de una cuenta; si falta o no vale, «normal». */
    public static function tierOf($v): string { return self::isTier($v) ? $v : 'normal'; }

    /** Nombre en castellano de una categoría (o de «consult»); si no se conoce, el propio texto. */
    public static function label(string $tier): string { return self::LABELS[$tier] ?? $tier; }

    /** Ajustes por defecto: porcentajes 5/10/15, visitante en «consult», aproximado apagado (nada público hasta que se active). */
    public static function defaults(): array
    {
        return ['tiers' => self::DEFAULT_TIERS, 'anon' => 'consult', 'approx' => ['on' => false, 'pct' => self::DEFAULT_APPROX_PCT], 'updated' => null];
    }

    /** ¿Es `$v` un porcentaje válido? Un número JSON (no texto) entre 0 y `$max`, con hasta 2 decimales. */
    private static function isPct($v, float $max): bool
    {
        if (!is_int($v) && !is_float($v)) return false;
        $f = (float) $v;
        return is_finite($f) && $f >= 0 && $f <= $max && abs($f * 100 - round($f * 100)) < 1e-7;
    }

    /**
     * Ajustes guardados; si no hay o están dañados, los de por defecto. Siempre con la forma completa y solo valores que cumplen las reglas: cada valor dañado vuelve al suyo por defecto y, si aun así
     * los porcentajes no cumplen vip5 ≤ vip10 ≤ normal, los tres vuelven a 5/10/15 (lo guardado a mano o por una versión vieja no se cuela).
     */
    public static function load(): array
    {
        $s = Store::get(self::KEY);
        $out = self::defaults();
        if (!is_array($s)) return $out;
        $t = is_array($s['tiers'] ?? null) ? $s['tiers'] : [];
        $tiers = [];
        foreach (self::DEFAULT_TIERS as $k => $def) $tiers[$k] = self::isPct($t[$k] ?? null, 100) ? $t[$k] : $def;
        if ($tiers['vip5'] <= $tiers['vip10'] && $tiers['vip10'] <= $tiers['normal']) $out['tiers'] = $tiers;
        if (is_string($s['anon'] ?? null) && in_array($s['anon'], self::ANON, true)) $out['anon'] = $s['anon'];
        $a = is_array($s['approx'] ?? null) ? $s['approx'] : [];
        if (($a['on'] ?? null) === true) $out['approx']['on'] = true;
        if (self::isPct($a['pct'] ?? null, 200)) $out['approx']['pct'] = $a['pct'];
        if (is_array($s['updated'] ?? null) && is_string($s['updated']['at'] ?? null) && is_string($s['updated']['by'] ?? null)) $out['updated'] = ['at' => $s['updated']['at'], 'by' => Util::line($s['updated']['by'], 120)];
        return $out;
    }

    /** Porcentaje que se suma al VIP en esa categoría según los ajustes (0 para el VIP y para lo desconocido). */
    public static function pct(array $settings, string $tier): float
    {
        return $tier === 'vip' || !isset($settings['tiers'][$tier]) ? 0.0 : (float) $settings['tiers'][$tier];
    }

    /** Las cuatro categorías con su nombre y porcentaje, tal como las enseña GET /customers: { vip:{label,pct}, vip5:…, vip10:…, normal:… }. */
    public static function tiersView(array $settings): array
    {
        $out = [];
        foreach (self::TIERS as $k) $out[$k] = ['label' => self::LABELS[$k], 'pct' => $k === 'vip' ? 0 : ($settings['tiers'][$k] ?? self::DEFAULT_TIERS[$k])];
        return $out;
    }

    // ───────────────────────────────────────── [CÁLCULO]
    /** Escala un precio VIP con un porcentaje: redondeo a 4 decimales de `$v × (1 + $pct/100)`. */
    public static function scale($v, float $pct): float { return Util::round4((float) $v * (1 + $pct / 100)); }

    /** Precio unitario de una referencia para una cantidad en una categoría (último tramo alcanzado, escalado); null si no tiene precio. */
    public static function unit(array $prices, string $ref, int $qty, string $tier, ?array $settings = null): ?float
    {
        $u = Prices::unit($prices, $ref, $qty);
        return $u === null ? null : self::scale($u, self::pct($settings ?? self::load(), $tier));
    }

    /** Valora líneas [{ref,qty}] en una categoría: sin precio → unit/total null (no suman). Devuelve ['lines','total','unpriced'] como Prices::priceOrder. */
    public static function priceOrder(array $prices, array $lines, string $tier, ?array $settings = null): array
    {
        $settings = $settings ?? self::load();
        $total = 0.0; $unpriced = 0; $out = [];
        foreach ($lines as $l) {
            $unit = self::unit($prices, $l['ref'], (int) $l['qty'], $tier, $settings);
            $t = $unit === null ? null : Util::round2($unit * $l['qty']);
            if ($t === null) $unpriced++; else $total += $t;
            $out[] = $l + ['unit' => $unit, 'total' => $t];
        }
        return ['lines' => $out, 'total' => Util::round2($total), 'unpriced' => $unpriced];
    }

    /** Valora «A consultar» todas las líneas (presupuesto de un visitante con anon = consult): unit y total null, total 0 y `unpriced` = nº de líneas. */
    public static function consultOrder(array $lines): array
    {
        $out = [];
        foreach ($lines as $l) $out[] = $l + ['unit' => null, 'total' => null];
        return ['lines' => $out, 'total' => 0.0, 'unpriced' => count($out)];
    }

    /** ¿Tiene esta referencia un precio base utilizable? (un `p` numérico; las que solo llevan `a` o `m` no.) */
    private static function hasPrice($it): bool { return is_array($it) && isset($it['p']) && is_numeric($it['p']); }

    /**
     * Las referencias con precio, con `p` y los tramos `t` escalados a esa categoría: lo que ven un `customer` (la suya) y un visitante con anon = normal (Normal). Se conservan los datos públicos de siempre
     * (`note`, `n`, `pid` de las referencias que añadió la hoja) y NUNCA salen las marcas internas `m` y `a`. Las referencias sin precio no salen.
     */
    public static function tierItems(array $prices, string $tier, ?array $settings = null): array
    {
        $pct = self::pct($settings ?? self::load(), $tier);
        $out = [];
        foreach ($prices['items'] ?? [] as $ref => $it) {
            if (!self::hasPrice($it)) continue;
            unset($it['m'], $it['a']);
            $it['p'] = self::scale($it['p'], $pct);
            if (!empty($it['t']) && is_array($it['t'])) {
                $it['t'] = array_map(function ($x) use ($pct) { return [$x[0], self::scale($x[1], $pct)]; }, array_values($it['t']));
            } else {
                unset($it['t']);
            }
            $out[$ref] = $it;
        }
        return $out;
    }

    // ───────────────────────────────────────── [APROXIMADO]
    /** Redondeo del precio aproximado: a euro entero desde 10 €; por debajo, a 1 decimal. */
    public static function approxRound(float $v): float { return $v >= 10 ? round($v) : round($v, 1); }

    /**
     * Precio aproximado de UNA unidad de una referencia, o null si no se enseña. En este orden: 1) `a === false` → nunca; 2) `a` es un número > 0 → ese (vale aunque no haya precio de hoja); 3) con `p` válido
     * y approx.on → approxRound(redondeo4(p × (1 + approx.pct/100))); 4) nada.
     */
    public static function approxPrice($item, array $settings): ?float
    {
        if (!is_array($item)) return null;
        if (array_key_exists('a', $item)) {
            if ($item['a'] === false) return null;
            if ((is_int($item['a']) || is_float($item['a'])) && $item['a'] > 0) return (float) $item['a'];
        }
        if (!empty($settings['approx']['on']) && self::hasPrice($item) && $item['p'] > 0) return self::approxRound(self::scale($item['p'], (float) ($settings['approx']['pct'] ?? self::DEFAULT_APPROX_PCT)));
        return null;
    }

    /** Lo que ve el visitante con anon = consult y approx.on: { ref: { p: aproximado } } solo donde hay valor, sin tramos y sin nada más. */
    public static function approxItems(array $prices, array $settings): array
    {
        $out = [];
        if (empty($settings['approx']['on'])) return $out;
        $refs = array_keys($prices['items'] ?? []);
        foreach ($refs as $ref) {
            $v = self::approxPrice($prices['items'][$ref], $settings);
            if ($v !== null) $out[$ref] = ['p' => $v];
        }
        return $out;
    }

    /**
     * Los precios que ve un VISITANTE (sin sesión o con sesión no válida) según los ajustes: anon = normal → precios Normal completos; anon = consult con approx.on → aproximados (`approx: true`);
     * anon = consult sin aproximado → nada (items vacío y mode «none»). Devuelve el documento de precios (sin pasar aún por publicView).
     */
    public static function visitorPrices(array $prices, array $settings): array
    {
        if ($settings['anon'] === 'normal') { $prices['items'] = self::tierItems($prices, 'normal', $settings); return $prices; }
        if (!empty($settings['approx']['on'])) { $prices['items'] = self::approxItems($prices, $settings); $prices['approx'] = true; return $prices; }
        $prices['items'] = [];
        $prices['mode'] = 'none';
        return $prices;
    }

    /** Los precios que ve un cliente (`customer`) con la categoría `$tier`: sus precios escalados, sin `m` ni `a` y sin decir cómo se llama su categoría. */
    public static function customerPrices(array $prices, string $tier, array $settings): array
    {
        $prices['items'] = self::tierItems($prices, $tier, $settings);
        return $prices;
    }

    // ───────────────────────────────────────── [AJUSTES] GET y PUT /settings/pricing
    /**
     * Valida el cuerpo del PUT y devuelve ['pricing' => ajustes normalizados (sin `updated`)] o ['error' => castellano, 'field' => tiers.vip5|tiers.vip10|tiers.normal|anon|approx.pct|approx.on|''].
     * Todos los campos son obligatorios. Reglas: porcentajes numéricos 0–100 con hasta 2 decimales y vip5 ≤ vip10 ≤ normal (si no se cumple, el error es del que sobra: vip10 o normal); anon ∈ consult|normal;
     * approx.pct numérico 0–200 con hasta 2 decimales; approx.on booleano.
     * @param mixed $raw
     */
    public static function validate($raw): array
    {
        if (!is_array($raw) || ($raw && Util::isList($raw))) return ['error' => 'Petición no válida', 'field' => ''];
        $t = $raw['tiers'] ?? null;
        $tiers = [];
        foreach (self::DEFAULT_TIERS as $k => $_) {
            $v = is_array($t) && !Util::isList($t) ? ($t[$k] ?? null) : null;
            if (!self::isPct($v, 100)) return ['error' => 'El porcentaje de «' . self::LABELS[$k] . '» debe ser un número entre 0 y 100, con hasta 2 decimales.', 'field' => 'tiers.' . $k];
            $tiers[$k] = $v;
        }
        if ($tiers['vip5'] > $tiers['vip10']) return ['error' => 'El porcentaje de «VIP +10» no puede ser menor que el de «VIP +5».', 'field' => 'tiers.vip10'];
        if ($tiers['vip10'] > $tiers['normal']) return ['error' => 'El porcentaje de «Normal» no puede ser menor que el de «VIP +10».', 'field' => 'tiers.normal'];
        $anon = $raw['anon'] ?? null;
        if (!is_string($anon) || !in_array($anon, self::ANON, true)) return ['error' => 'Elige qué ve el visitante: «consult» (precio a consultar) o «normal».', 'field' => 'anon'];
        $ap = $raw['approx'] ?? null;
        $ap = is_array($ap) && !Util::isList($ap) ? $ap : [];
        if (!self::isPct($ap['pct'] ?? null, 200)) return ['error' => 'El porcentaje del precio aproximado debe ser un número entre 0 y 200, con hasta 2 decimales.', 'field' => 'approx.pct'];
        if (!is_bool($ap['on'] ?? null)) return ['error' => 'Indica si el precio aproximado está activado (true o false).', 'field' => 'approx.on'];
        return ['pricing' => ['tiers' => $tiers, 'anon' => $anon, 'approx' => ['on' => $ap['on'], 'pct' => $ap['pct']]]];
    }

    /** GET /settings/pricing (manager y client): los ajustes tal como están guardados (forma completa, con `updated`). */
    public static function handleGet(): Response
    {
        return new Response(['ok' => true, 'pricing' => self::load()], 200, ['Cache-Control' => 'no-store']);
    }

    /** Número sin ceros sobrantes para el registro de Actividad (5, 7.5). */
    private static function fmt($n): string { return rtrim(rtrim(sprintf('%.2F', (float) $n), '0'), '.'); }

    /** PUT /settings/pricing (manager y client): valida, guarda con quién y cuándo, lo anota en Actividad y devuelve los ajustes. Cuerpo ≤ 2 KB. */
    public static function handlePut(Request $req, array $who, ?int $nowMs = null): Response
    {
        $b = $req->json(self::MAX_BODY);
        if ($b === null) return new Response(['ok' => false, 'error' => 'Petición no válida', 'field' => ''], 400);
        $v = self::validate($b);
        if (isset($v['error'])) return new Response(['ok' => false, 'error' => $v['error'], 'field' => $v['field']], 400);
        $s = $v['pricing'] + ['updated' => ['at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'by' => Util::line((string) (empty($who['master']) ? ($who['sub'] ?? '') : 'maestro'), 120)]];
        try { Store::put(self::KEY, $s); }
        catch (\Throwable $e) { error_log('torivac-api: [precios] No se pudieron guardar los ajustes: ' . mb_substr($e->getMessage(), 0, 160)); return new Response(['ok' => false, 'error' => 'No se pudieron guardar los ajustes'], 500); }
        $t = $s['tiers'];
        Audit::log('settings.pricing', $who, $req, 'VIP+5 ' . self::fmt($t['vip5']) . ' % · VIP+10 ' . self::fmt($t['vip10']) . ' % · Normal ' . self::fmt($t['normal']) . ' % · visitante: ' . ($s['anon'] === 'normal' ? 'precio Normal' : 'a consultar')
            . ' · aproximado: ' . ($s['approx']['on'] ? self::fmt($s['approx']['pct']) . ' %' : 'apagado'));
        return new Response(['ok' => true, 'pricing' => self::load()], 200, ['Cache-Control' => 'no-store']);
    }

    // ───────────────────────────────────────── [PRODUCTO] PUT /prices/items/:ref
    /** ¿Es un precio válido para una referencia? Un número (no texto) mayor que 0, de hasta 10 000 000 y con hasta 4 decimales. */
    private static function validPrice($v): bool
    {
        return (is_int($v) || is_float($v)) && is_finite((float) $v) && $v > 0 && $v <= self::MAX_PRICE && round((float) $v, 4) == (float) $v;
    }

    /** Entero de un valor JSON (un entero, o un decimal sin parte fraccionaria); null si no lo es. */
    private static function whole($v): ?int
    {
        if (is_int($v)) return $v;
        return is_float($v) && is_finite($v) && floor($v) == $v && abs($v) < 1e15 ? (int) $v : null;
    }

    /**
     * Valida el cuerpo de la edición de un producto, sin tocar el almacén. Devuelve solo las claves que vienen: ['p' => float|null, 't' => [[cantMin, precio],…], 'a' => float|false|null, 'manual' => bool]
     * o ['error' => castellano, 'field' => p|t|a|manual|'']. p: número > 0 ≤ 10 000 000 con hasta 4 decimales, o null (quita el precio). t: 0 a 8 tramos [cantMin entero ≥ 2 estrictamente creciente, precio como p].
     * a: número > 0, false (nunca aproximado) o null (seguir la regla). manual: booleano. Un cuerpo sin ninguna de las cuatro claves no cambia nada: 400.
     */
    public static function parseItemEdit(array $b): array
    {
        $out = [];
        if (array_key_exists('p', $b)) {
            if ($b['p'] === null) $out['p'] = null;
            elseif (self::validPrice($b['p'])) $out['p'] = (float) $b['p'];
            else return ['error' => 'El precio debe ser un número mayor que 0 y de hasta 10 000 000, con hasta 4 decimales (o null para dejarlo «A consultar»).', 'field' => 'p'];
        }
        if (array_key_exists('t', $b)) {
            $t = $b['t'];
            if (!is_array($t) || ($t && !Util::isList($t))) return ['error' => 'Los tramos deben ser una lista de pares [cantidad mínima, precio].', 'field' => 't'];
            if (count($t) > self::MAX_TIERS) return ['error' => 'Máximo ' . self::MAX_TIERS . ' tramos por referencia.', 'field' => 't'];
            $list = [];
            $last = 1;
            foreach ($t as $row) {
                if (!is_array($row) || !Util::isList($row) || count($row) !== 2) return ['error' => 'Cada tramo es un par [cantidad mínima, precio].', 'field' => 't'];
                $q = self::whole($row[0]);
                if ($q === null || $q < 2) return ['error' => 'La cantidad mínima de cada tramo debe ser un entero de 2 o más.', 'field' => 't'];
                if ($q <= $last) return ['error' => 'Las cantidades de los tramos deben ir de menor a mayor, sin repetirse.', 'field' => 't'];
                if (!self::validPrice($row[1])) return ['error' => 'El precio de cada tramo debe ser un número mayor que 0, con hasta 4 decimales.', 'field' => 't'];
                $last = $q;
                $list[] = [$q, (float) $row[1]];
            }
            $out['t'] = $list;
        }
        if (array_key_exists('a', $b)) {
            $a = $b['a'];
            if ($a === null || $a === false) $out['a'] = $a;
            elseif (self::validPrice($a)) $out['a'] = (float) $a;
            else return ['error' => 'El precio aproximado debe ser un número mayor que 0, false (nunca aproximado) o null (seguir la regla).', 'field' => 'a'];
        }
        if (array_key_exists('manual', $b)) {
            if (!is_bool($b['manual'])) return ['error' => 'manual debe ser true o false.', 'field' => 'manual'];
            $out['manual'] = $b['manual'];
        }
        if (!$out) return ['error' => 'No hay nada que cambiar: indica p, t, a o manual.', 'field' => ''];
        return $out;
    }

    /**
     * Aplica una edición ya validada (parseItemEdit) a la entrada actual de una referencia (`$old`, [] si no tiene). Quitar el precio (p:null) quita también los tramos; unos tramos sin precio base son
     * un error (field t); la marca `m:true` se pone sola si el cuerpo trae p o t, salvo que traiga manual:false (que la quita) o manual:true. Devuelve ['item' => entrada nueva] o ['error','field'].
     */
    public static function applyItemEdit(array $old, array $c): array
    {
        $it = $old;
        if (array_key_exists('p', $c)) { if ($c['p'] === null) unset($it['p'], $it['t']); else $it['p'] = $c['p']; }
        if (array_key_exists('t', $c)) { if ($c['t']) $it['t'] = $c['t']; else unset($it['t']); }
        if (!isset($it['p']) && isset($it['t'])) {
            if (!empty($c['t'])) return ['error' => 'Los tramos necesitan un precio base: indica también p.', 'field' => 't'];
            unset($it['t']);
        }
        if (array_key_exists('a', $c)) { if ($c['a'] === null) unset($it['a']); else $it['a'] = $c['a']; }
        $manual = $c['manual'] ?? null;
        if ($manual === true) $it['m'] = true;
        elseif ($manual === false) unset($it['m']);
        elseif (array_key_exists('p', $c) || array_key_exists('t', $c)) $it['m'] = true;
        return ['item' => $it];
    }

    /** De una entrada de precios, solo los cuatro datos que se editan y se devuelven, en este orden: p, t, a, m. */
    public static function project(array $it): array
    {
        $o = [];
        foreach (['p', 't', 'a', 'm'] as $k) if (array_key_exists($k, $it)) $o[$k] = $it[$k];
        return $o;
    }

    /**
     * PUT /prices/items/:ref (manager y client): cambia el precio VIP, los tramos, el aproximado o la marca «manual» de UNA referencia. Orden de los errores: 404 (referencia desconocida) → 413/400 (cuerpo) → guardar.
     * Lee y escribe bajo el bloqueo de precios (una sincronización a la vez no lo pisa). Guarda con histórico (razón edit:<correo>) y `updated_at` nuevo; si no cambia nada no escribe. Una entrada sin ningún dato queda sin entrada.
     */
    public static function handleItem(Request $req, array $who, string $ref, ?int $nowMs = null): Response
    {
        $known = Prices::withSheetItems(Catalog::items(), Prices::load());
        if ($ref === '' || !isset($known[$ref])) return new Response(['ok' => false, 'error' => 'Referencia desconocida'], 404);
        if (strlen($req->body) > self::ITEM_MAX_BODY) return new Response(['ok' => false, 'error' => 'La petición es demasiado grande'], 413);
        $b = $req->json(self::ITEM_MAX_BODY);
        if ($b === null || ($b && Util::isList($b))) return new Response(['ok' => false, 'error' => 'Petición no válida', 'field' => ''], 400);
        $c = self::parseItemEdit($b);
        if (isset($c['error'])) return new Response(['ok' => false, 'error' => $c['error'], 'field' => $c['field']], 400);
        $by = !empty($who['master']) ? 'maestro' : Util::line((string) ($who['sub'] ?? ''), 254);
        $now = $nowMs === null ? null : $nowMs / 1000;
        $r = Store::locked('prices', function () use ($ref, $c, $by, $now) {
            $prices = Prices::load();
            $old = is_array($prices['items'][$ref] ?? null) ? $prices['items'][$ref] : [];
            $a = self::applyItemEdit($old, $c);
            if (isset($a['error'])) return $a;
            $it = $a['item'];
            if (Util::enc(self::project($it)) === Util::enc(self::project($old))) return ['item' => $it, 'saved' => false];
            $next = $prices;
            $next['updated_at'] = Util::iso($now);
            if (($next['mode'] ?? 'none') === 'none') { $next['mode'] = 'live'; $next['source'] = 'edit'; }                // una lista que nace de editar a mano ya no es «sin precios»
            if ($it) $next['items'][$ref] = $it; else unset($next['items'][$ref]);                                           // sin ningún dato, sin entrada
            Prices::save($next, $prices, 'edit:' . $by, 'edit', $now);
            return ['item' => $it, 'saved' => true];
        });
        if (isset($r['error'])) return new Response(['ok' => false, 'error' => $r['error'], 'field' => $r['field']], 400);
        if ($r['saved']) Audit::log('price.edit', $who, $req, $ref);
        return new Response(['ok' => true, 'ref' => $ref, 'item' => Util::obj(self::project($r['item']))]);
    }
}
