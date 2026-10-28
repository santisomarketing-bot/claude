<?php
/**
 * [AI] Cambios de precios por INSTRUCCIÓN EN CASTELLANO (panel «Precios» → «Actualizar con una instrucción»).
 *   POST /api/prices/ai        {instruction}                → propone cambios (NUNCA los aplica) + vista previa
 *   POST /api/prices/ai/apply  {changes, confirm_large?}    → aplica los cambios que la persona ya ha revisado
 * La IA solo PROPONE con una herramienta de esquema cerrado; el servidor valida (referencias que existen, importes razonables, tramos coherentes),
 * lo muestra como diferencias y solo escribe cuando la persona confirma. La IA no ve clientes ni pedidos: solo referencia, nombre, precio y tramos.
 * Port de workers/api/src/ai.js; llama a la API HTTP de Anthropic (config ai.anthropic_api_key, ai.model).
 */
namespace Torivac;

final class Ai
{
    const TOOL = 'proponer_cambios_de_precios';
    const MAX_CHANGES = 500;
    const MAX_REFS_IN_PROMPT = 3000;
    const LARGE_RATIO = 3;
    const MAX_PRICE = 1000000;

    /** Instrucciones de sistema de la IA: propone cambios de precios (no los aplica), solo con referencias de la lista y con importes en euros. */
    public static function system(): string
    {
        return 'Eres el asistente de precios de Torivac (fabricante de transformadores toroidales, variadores y estabilizadores de tensión, resistencias, botones de mando, etc.).' . "\n" .
            'Recibes la lista de precios actual (una referencia por línea: ref | nombre | precio unidad | tramos «desde N uds = precio») y una instrucción en castellano.' . "\n" .
            'Devuelve SOLO los cambios mínimos necesarios llamando a la herramienta ' . self::TOOL . '.' . "\n" . 'Reglas:' . "\n" .
            '- Usa únicamente referencias que aparecen en la lista. No inventes referencias ni nombres.' . "\n" .
            '- Cambia solo lo que se pide. Si se pide «subir un 3 % las resistencias», aplica el 3 % al precio base y a los tramos de TODAS las referencias cuyo nombre sea de resistencias.' . "\n" .
            '- Los precios son en euros, sin IVA, con hasta 4 decimales. Redondea solo si la instrucción lo pide.' . "\n" .
            '- Si la instrucción es ambigua o no se puede cumplir con la lista, no cambies nada: devuelve changes vacío y explica el motivo en summary.' . "\n" .
            '- summary: una frase en castellano que resuma lo que cambia (cuántas referencias, por qué criterio).';
    }

    /** Esquema JSON de la herramienta que debe rellenar la IA: resumen, cambios {ref, price, tiers} y avisos. */
    public static function toolSchema(): array
    {
        return ['type' => 'object', 'additionalProperties' => false, 'required' => ['summary', 'changes'], 'properties' => [
            'summary' => ['type' => 'string', 'description' => 'Resumen en castellano de lo que se cambia y por qué'],
            'changes' => ['type' => 'array', 'maxItems' => self::MAX_CHANGES, 'items' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['ref', 'price'], 'properties' => [
                'ref' => ['type' => 'string', 'description' => 'Referencia EXACTA de la lista'],
                'price' => ['type' => 'number', 'description' => 'Nuevo precio unidad base (EUR, sin IVA)'],
                'tiers' => ['type' => 'array', 'description' => 'Tramos nuevos completos (si cambian); omitir para dejar los actuales', 'items' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['qty', 'price'], 'properties' => ['qty' => ['type' => 'integer', 'minimum' => 2], 'price' => ['type' => 'number']]]],
            ]]],
            'warnings' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Dudas o cosas que la persona debería revisar'],
        ]];
    }

    /** lista de precios en texto compacto para el prompt */
    public static function buildTable(array $prices, array $catalog): string
    {
        $rows = [];
        $i = 0;
        foreach ($prices['items'] as $ref => $p) {
            if ($i++ >= self::MAX_REFS_IN_PROMPT) break;
            $t = $p['t'] ?? [];
            $rows[] = $ref . ' | ' . ($catalog[$ref]['n'] ?? '') . ' | ' . self::n($p['p']) . ($t ? ' | ' . implode('; ', array_map(function ($x) { return 'desde ' . $x[0] . ' uds = ' . self::n($x[1]); }, $t)) : '');
        }
        return implode("\n", $rows);
    }

    /** Número con hasta 8 decimales y sin ceros sobrantes, para escribirlo en la tabla que ve la IA. */
    private static function n($x): string { return rtrim(rtrim(sprintf('%.8F', (float) $x), '0'), '.'); }

    /**
     * Valida lo que devuelve la IA contra los precios y el catálogo reales.
     * @return array{changes:array,warnings:string[],rejected:array}
     */
    public static function validateChanges($raw, array $prices, array $catalog): array
    {
        $out = ['changes' => [], 'warnings' => [], 'rejected' => []];
        $list = Util::isList($raw) ? $raw : [];
        if (count($list) > self::MAX_CHANGES) $out['warnings'][] = 'La IA propuso ' . count($list) . ' cambios; se usan los ' . self::MAX_CHANGES . ' primeros.';
        $seen = [];
        foreach (array_slice($list, 0, self::MAX_CHANGES) as $c) {
            $c = is_array($c) ? $c : [];
            $ref = trim((string) ($c['ref'] ?? ''));
            if ($ref === '') { $out['rejected'][] = ['ref' => '(vacía)', 'why' => 'sin referencia']; continue; }
            if (isset($seen[$ref])) { $out['rejected'][] = ['ref' => $ref, 'why' => 'repetida']; continue; }
            $seen[$ref] = true;
            if (!isset($prices['items'][$ref]) && !isset($catalog[$ref])) { $out['rejected'][] = ['ref' => $ref, 'why' => 'la referencia no existe']; continue; }
            $p = isset($c['price']) && (is_int($c['price']) || is_float($c['price'])) ? (float) $c['price'] : null;
            if ($p === null || $p < 0 || $p > self::MAX_PRICE) { $out['rejected'][] = ['ref' => $ref, 'why' => 'precio no válido']; continue; }
            $old = $prices['items'][$ref] ?? null;
            $tiers = null;
            if (isset($c['tiers']) && is_array($c['tiers'])) {
                $tiers = [];
                foreach ($c['tiers'] as $t) {
                    $q = is_array($t) && isset($t['qty']) && is_numeric($t['qty']) ? (int) floor($t['qty']) : 0;
                    $v = is_array($t) && isset($t['price']) && is_numeric($t['price']) ? (float) $t['price'] : null;
                    if ($q >= 2 && $v !== null && $v >= 0 && $v <= self::MAX_PRICE) $tiers[] = [$q, Util::round4($v)];
                }
                usort($tiers, function ($a, $b) { return $a[0] <=> $b[0]; });
                foreach ($tiers as $t) { if ($t[1] > $p) { $out['warnings'][] = $ref . ': algún tramo cuesta más que el precio base.'; break; } }
            }
            $nextT = $tiers !== null ? $tiers : ($old['t'] ?? []);
            $next = ['p' => Util::round4($p)] + ($nextT ? ['t' => $nextT] : []);
            if ($tiers === null && $old && !empty($old['t']) && $old['p'] != $next['p']) $out['warnings'][] = $ref . ': el precio base cambia pero los tramos por cantidad se quedan como estaban (revisa).';
            $same = $old && $old['p'] == $next['p'] && Util::enc($old['t'] ?? []) === Util::enc($next['t'] ?? []);
            if ($same) continue;                                                              // la IA «cambió» algo que ya estaba así: no es un cambio
            $pct = $old && $old['p'] > 0 ? Util::round2((($next['p'] - $old['p']) / $old['p']) * 100) : null;
            $large = (bool) ($old && $old['p'] > 0 && ($next['p'] / $old['p'] > self::LARGE_RATIO || $next['p'] / $old['p'] < 1 / self::LARGE_RATIO));
            if ($large) $out['warnings'][] = $ref . ': cambio muy grande (' . self::n($old['p']) . ' → ' . self::n($next['p']) . ').';
            $out['changes'][] = ['ref' => $ref, 'name' => $catalog[$ref]['n'] ?? '', 'old' => $old ? ['p' => $old['p']] + (!empty($old['t']) ? ['t' => $old['t']] : []) : null, 'next' => $next, 'pct' => $pct, 'large' => $large];
        }
        return $out;
    }

    /** aplica cambios ya validados sobre unos precios (devuelve unos nuevos) */
    public static function applyChanges(array $prices, array $changes, string $source = 'ia', ?float $now = null): array
    {
        $next = ['updated_at' => Util::iso($now), 'source' => $source, 'mode' => 'live'] + $prices;
        foreach ($changes as $c) {
            $old = $prices['items'][$c['ref']] ?? [];
            $it = ['p' => $c['next']['p']] + $old;
            $it['p'] = $c['next']['p'];
            if (!empty($c['next']['t'])) $it['t'] = $c['next']['t']; else unset($it['t']);
            $next['items'][$c['ref']] = $it;
        }
        return $next;
    }

    /** Propone cambios (lanza \RuntimeException con código HTTP: 400 instrucción vacía, 503 IA sin configurar, 409 sin precios, 502 fallo de la IA) */
    public static function suggest($instruction, ?array $catalog = null): array
    {
        $text = trim((string) $instruction);
        if (mb_strlen($text) < 5) throw new \RuntimeException('Escribe una instrucción (por ejemplo: «sube un 3 % las resistencias»)', 400);
        if (mb_strlen($text) > 1000) throw new \RuntimeException('La instrucción es demasiado larga (máx. 1000 caracteres)', 400);
        $key = (string) Config::get('ai.anthropic_api_key', '');
        if ($key === '') throw new \RuntimeException('La IA no está configurada en el servidor (falta ai.anthropic_api_key)', 503);
        $prices = Prices::load();
        if (!$prices['items']) throw new \RuntimeException('Todavía no hay precios cargados', 409);
        $cat = Prices::withSheetItems($catalog ?? Catalog::items(), $prices);
        $body = ['model' => (string) Config::get('ai.model', 'claude-sonnet-5-5'), 'max_tokens' => 8000, 'system' => self::system(),
            'tools' => [['name' => self::TOOL, 'description' => 'Propone los cambios de precios que cumplen la instrucción', 'input_schema' => self::toolSchema()]], 'tool_choice' => ['type' => 'tool', 'name' => self::TOOL],
            'messages' => [['role' => 'user', 'content' => "Instrucción: «{$text}»\n\nLista de precios actual:\n" . self::buildTable($prices, $cat)]]];
        [$st, $resp] = Http::request('POST', rtrim((string) Config::get('ai.api_base', 'https://api.anthropic.com'), '/') . '/v1/messages', ['x-api-key: ' . $key, 'anthropic-version: 2023-06-01', 'Content-Type: application/json'], Util::enc($body), 120);
        if ($st !== 200) throw new \RuntimeException('La API de IA respondió ' . $st, 502);
        $data = json_decode($resp, true);
        $use = null;
        foreach ($data['content'] ?? [] as $b) { if (($b['type'] ?? '') === 'tool_use' && ($b['name'] ?? '') === self::TOOL) { $use = $b; break; } }
        if (!$use) throw new \RuntimeException('La IA no devolvió una propuesta utilizable', 502);
        $input = $use['input'] ?? [];
        $v = self::validateChanges($input['changes'] ?? [], $prices, $cat);
        $warnings = array_merge(array_slice(array_map('strval', is_array($input['warnings'] ?? null) ? $input['warnings'] : []), 0, 10), $v['warnings']);
        return ['summary' => mb_substr((string) ($input['summary'] ?? ''), 0, 400), 'changes' => $v['changes'], 'rejected' => $v['rejected'], 'warnings' => $warnings, 'large' => (bool) array_filter($v['changes'], function ($c) { return $c['large']; }), 'usage' => $data['usage'] ?? null];
    }

    /** Aplica los cambios revisados por la persona; vuelve a validarlo todo en servidor */
    public static function apply($body, string $who = 'manager', ?array $catalog = null, ?float $now = null): array
    {
        $prices = Prices::load();
        $cat = Prices::withSheetItems($catalog ?? Catalog::items(), $prices);
        $raw = [];
        foreach (is_array($body['changes'] ?? null) ? $body['changes'] : [] as $c) {
            $c = is_array($c) ? $c : [];
            $tiers = null;
            if (isset($c['next']['t']) && is_array($c['next']['t'])) $tiers = array_map(function ($t) { return ['qty' => $t[0] ?? null, 'price' => $t[1] ?? null]; }, $c['next']['t']);
            elseif (isset($c['tiers'])) $tiers = $c['tiers'];
            $raw[] = ['ref' => $c['ref'] ?? '', 'price' => $c['next']['p'] ?? ($c['price'] ?? null), 'tiers' => $tiers];
        }
        $v = self::validateChanges($raw, $prices, $cat);
        if (!$v['changes']) throw new \RuntimeException('No hay cambios válidos que aplicar', 400);
        if (array_filter($v['changes'], function ($c) { return $c['large']; }) && ($body['confirm_large'] ?? null) !== true) throw new \RuntimeException('Hay cambios muy grandes: confírmalos expresamente (confirm_large)', 409);
        $next = self::applyChanges($prices, $v['changes'], 'ia:' . $who, $now);
        $meta = Prices::save($next, $prices, 'ia:' . $who, 'ia:' . $who, $now);
        return ['meta' => $meta, 'applied' => count($v['changes']), 'rejected' => $v['rejected']];
    }
}
