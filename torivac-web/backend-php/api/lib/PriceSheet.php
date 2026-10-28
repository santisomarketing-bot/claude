<?php
/**
 * [PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → precios. Port FIEL de shared/price-sheet.mjs:
 * las dos implementaciones se prueban con los mismos casos (shared/price-sheet.fixtures.json).
 *
 * FORMATOS: plantilla (ref · price · qty2/price2…), tarifa (Artículo · Descripción · Precio venta), exportación de WooCommerce (SKU · Producto · Precio · Oferta · Stock) y hojas por ID de producto (ID · Precio).
 * IDENTIFICADORES, en este orden por fila: 1) referencia/código técnico tal cual está en el catálogo (incluida la genérica «P<id>»); 2) SKU de WooCommerce → línea genérica de su producto;
 * 3) familia nueva por patrón (códigos nuevos de una tarifa); 4) si la fila NO trae referencia, el ID de producto de la columna ID/product_id. Un producto con modelos propios no se puede
 * valorar por SKU ni por ID (habría que elegir un modelo): se avisa y se pide la referencia de cada modelo.
 * ACTUALIZACIONES PARCIALES: la hoja puede traer solo una parte del catálogo; cada fila reconocida actualiza SOLO su referencia. `retire` lista las que la hoja pide dejar sin precio
 * (fila con active = 0 o con precio 0): el servidor las quita cuando actualiza «solo lo que trae la hoja» (Prices::merge).
 * Reglas: cabecera = primera fila (de las 12 primeras) con columna de referencia y de precio; «Oferta» y «Stock» no se usan; precio vacío o 0 = «Consultar»;
 * decimales del precio unitario 4 por defecto (máx. 6); «precio de relleno» (>60 % de filas con el mismo precio) se avisa.
 */
namespace Torivac;

final class PriceSheet
{
    const DEFAULT_DECIMALS = 4;

    /** campo → nombres de cabecera aceptados (ya normalizados por normHeader) */
    const ALIASES = [
        'ref' => ['ref', 'referencia', 'articulo', 'codigo', 'cod', 'sku', 'item', 'article', 'reference', 'partnumber', 'codigoarticulo', 'refarticulo'],
        'price' => ['price', 'precio', 'precioventa', 'pvp', 'tarifa', 'preciounitario', 'precioud', 'unitprice', 'importe', 'preciotarifa'],
        'name' => ['name_es', 'namees', 'nombre', 'descripcion', 'producto', 'product', 'description', 'concepto', 'denominacion'],
        'product_id' => ['productid', 'idproducto', 'idprod', 'pid', 'id'],
        'unit' => ['unit', 'unidad', 'ud'],
        'currency' => ['currency', 'moneda', 'divisa'],
        'note' => ['note', 'nota', 'notas', 'observaciones', 'comentario'],
        'active' => ['active', 'activo', 'visible'],
        'updated_at' => ['updatedat', 'actualizado', 'fechaactualizacion', 'fecha'],
        'offer' => ['oferta', 'offer', 'sale', 'preciooferta'],
        'stock' => ['stock', 'existencias', 'disponible'],
    ];

    private const FOLD = ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'å' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o', 'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ñ' => 'n', 'ç' => 'c', 'ß' => 'ss',
        'Á' => 'a', 'À' => 'a', 'Â' => 'a', 'Ä' => 'a', 'É' => 'e', 'È' => 'e', 'Ê' => 'e', 'Ë' => 'e', 'Í' => 'i', 'Î' => 'i', 'Ï' => 'i', 'Ó' => 'o', 'Ô' => 'o', 'Ö' => 'o', 'Ú' => 'u', 'Û' => 'u', 'Ü' => 'u', 'Ñ' => 'n', 'Ç' => 'c'];

    /** cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa) */
    public static function normHeader($h): string
    {
        $s = strtr((string) ($h === null ? '' : $h), self::FOLD);
        $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
        return str_replace('_', '', preg_replace('/[^a-z0-9_]/', '', $s));
    }

    /** referencia → clave de comparación: mayúsculas y sin espacios */
    public static function normRef($r): string
    {
        return strtoupper(preg_replace('/[\s\x{00a0}]+/u', '', (string) ($r === null ? '' : $r)));
    }

    /** número de una celda («27,75», «1.234,56», «1,234.56», «22 000», «€ 5»…); vacío o ilegible → null */
    public static function parseNumber($x): ?float
    {
        if ($x === null || $x === '') return null;
        if (is_int($x) || is_float($x)) return is_finite((float) $x) ? (float) $x : null;
        $s = preg_replace('/[\s\x{00a0}\x{202f}€$]/u', '', (string) $x);
        if ($s === '' || $s === null) return null;
        $c = strrpos($s, ',');
        $d = strrpos($s, '.');
        if ($c !== false && $d !== false) {
            $s = $c > $d ? str_replace(',', '.', str_replace('.', '', $s)) : str_replace(',', '', $s);
        } elseif ($c !== false) {
            $s = substr_count($s, ',') > 1 ? str_replace(',', '', $s) : str_replace(',', '.', $s);
        } elseif (substr_count($s, '.') > 1) {
            $s = str_replace('.', '', $s);
        }
        return is_numeric($s) ? (float) $s : null;
    }

    /** Cabecera: primera fila (de las 12 primeras) con una columna de referencia —o de ID de producto— y una de precio. @return array{index:int,map:array<string,int>,headers:string[]}|null */
    public static function findHeader(array $rows): ?array
    {
        $n = min(count($rows), 12);
        for ($i = 0; $i < $n; $i++) {
            $keys = array_map([self::class, 'normHeader'], array_values((array) $rows[$i]));
            $map = [];
            foreach (self::ALIASES as $field => $names) {
                foreach ($keys as $ix => $k) {
                    if (in_array($k, $names, true) && !in_array($ix, $map, true)) { $map[$field] = $ix; break; }
                }
            }
            foreach ($keys as $ix => $k) {
                if (preg_match('/^(qty|cant|cantidad)(\d)$/', $k, $m)) $map['qty' . $m[2]] = $ix;
                if (preg_match('/^(price|precio)(\d)$/', $k, $m)) $map['price' . $m[2]] = $ix;
            }
            if ((isset($map['ref']) || isset($map['product_id'])) && isset($map['price'])) {
                return ['index' => $i, 'map' => $map, 'headers' => array_map(function ($h) { return trim((string) ($h === null ? '' : $h)); }, array_values((array) $rows[$i]))];
            }
        }
        return null;
    }

    /**
     * @param array $rows matriz de celdas
     * @param array $ctx  lines {ref:{n,pid}} · skus {sku:pid} · rules [{pattern,pid}] · decimals int
     * @return array{items:array,warnings:array,ignored:array,unknown:array,extras:array,retire:array,columns:array,stats:array}   stats = rows, accepted, decimals, by{ref,sku,id,rule}
     */
    public static function read(array $rows, array $ctx = []): array
    {
        $dec = isset($ctx['decimals']) && is_int($ctx['decimals']) ? max(0, min(6, $ctx['decimals'])) : self::DEFAULT_DECIMALS;
        $lines = isset($ctx['lines']) && is_array($ctx['lines']) ? $ctx['lines'] : null;
        $skus = isset($ctx['skus']) && is_array($ctx['skus']) ? $ctx['skus'] : [];
        $rules = isset($ctx['rules']) && is_array($ctx['rules']) ? $ctx['rules'] : [];
        if (count($rows) < 2) throw new \InvalidArgumentException('La hoja está vacía');
        $h = self::findHeader($rows);
        if (!$h) throw new \InvalidArgumentException('No encuentro la cabecera: la hoja necesita las columnas de referencia (ref, Referencia, Artículo, Código, SKU… o ID de producto) y de precio (price, Precio, Precio venta, PVP…)');
        $map = $h['map'];
        $headers = $h['headers'];
        $warnings = []; $ignored = []; $unknown = []; $extras = []; $retire = []; $items = []; $seen = []; $by = ['ref' => 0, 'sku' => 0, 'id' => 0, 'rule' => 0];
        $norm = null;
        if ($lines !== null) { $norm = []; foreach (array_keys($lines) as $r) $norm[self::normRef((string) $r)] = (string) $r; }
        $col = function ($r, $f) use ($map) { return isset($map[$f]) && isset($r[$map[$f]]) ? $r[$map[$f]] : ''; };
        foreach (['offer' => 'Oferta', 'stock' => 'Stock'] as $f => $_) {
            if (isset($map[$f])) $warnings[] = ['code' => 'columna_no_usada', 'message' => 'La columna «' . $headers[$map[$f]] . '» no se usa (los precios de oferta y el stock no se publican)'];
        }
        $models = 'el producto tiene modelos: poner el precio en la referencia de cada modelo';
        /** Resuelve la fila a una línea del catálogo: ['target','kind','extra'?] · ['skip' => motivo] · ['unknown' => true]. Primero la referencia, luego el SKU, luego la familia nueva; el ID solo si la fila no trae referencia. */
        $resolve = function ($refRaw, $idRaw, $r) use ($norm, $lines, $skus, $rules, $col, $models) {
            if ($norm === null) return ['target' => $refRaw !== '' ? $refRaw : 'P' . $idRaw, 'kind' => $refRaw !== '' ? 'ref' : 'id'];
            if ($refRaw !== '') {
                $key = self::normRef($refRaw);
                if (isset($norm[$key])) return ['target' => $norm[$key], 'kind' => 'ref'];
                $pid = $skus[$refRaw] ?? ($skus[strtolower($refRaw)] ?? null);
                if ($pid !== null) {                                                           // fila por PRODUCTO (WooCommerce): precio de su línea genérica
                    $gen = self::normRef('P' . $pid);
                    return isset($norm[$gen]) ? ['target' => $norm[$gen], 'kind' => 'sku'] : ['skip' => $models];
                }
                foreach ($rules as $x) {
                    if (@preg_match('/' . str_replace('/', '\/', $x['pattern']) . '/i', $key)) {
                        $nm = trim(preg_replace('/\s+/', ' ', (string) ($col($r, 'name') ?: '')));
                        return ['target' => $key, 'kind' => 'rule', 'extra' => ['pid' => $x['pid'], 'n' => $nm !== '' ? $nm : $refRaw]];
                    }
                }
                return ['unknown' => true];
            }
            if (preg_match('/^P?(\d+)$/i', $idRaw, $m)) {                                       // fila identificada solo por el ID del producto
                $gen = self::normRef('P' . $m[1]);
                if (isset($norm[$gen])) return ['target' => $norm[$gen], 'kind' => 'id'];
                foreach ($lines as $l) { if ((string) ($l['pid'] ?? '') === $m[1]) return ['skip' => $models]; }
            }
            return ['unknown' => true];
        };
        /** Anota para retirar la línea a la que apunta la fila (si se reconoce); las desconocidas no cuentan como tales. */
        $retireRow = function ($refRaw, $idRaw, $r) use (&$retire, $resolve) { $rs = $resolve($refRaw, $idRaw, $r); if (isset($rs['target']) && !in_array($rs['target'], $retire, true)) $retire[] = $rs['target']; };
        $rowsRead = 0; $empty = 0;
        foreach (array_slice($rows, $h['index'] + 1) as $r) {
            $r = array_values((array) $r);
            $blank = true;
            foreach ($r as $c) { if ($c !== '' && $c !== null) { $blank = false; break; } }
            if ($blank) continue;
            $rowsRead++;
            $refRaw = trim(preg_replace('/[\s\x{00a0}]+/u', ' ', (string) $col($r, 'ref')));
            $idRaw = trim(preg_replace('/[\s\x{00a0}]+/u', ' ', (string) $col($r, 'product_id')));
            $ref = $refRaw !== '' ? $refRaw : $idRaw;
            if ($ref === '') continue;
            if (isset($map['active']) && in_array(strtolower(trim((string) $col($r, 'active'))), ['0', 'no', 'false', 'n', 'inactivo'], true)) { $ignored[] = ['ref' => $ref, 'reason' => 'desactivada (active = 0)']; $retireRow($refRaw, $idRaw, $r); continue; }
            $p0 = self::parseNumber($col($r, 'price'));
            if ($p0 === null) {
                $empty++;
                if (trim((string) $col($r, 'price')) !== '') $ignored[] = ['ref' => $ref, 'reason' => 'precio ilegible «' . mb_substr((string) $col($r, 'price'), 0, 20) . '»'];
                continue;
            }
            if ($p0 < 0) { $ignored[] = ['ref' => $ref, 'reason' => 'precio negativo']; continue; }
            if ($p0 == 0.0) { $ignored[] = ['ref' => $ref, 'reason' => 'precio 0 (se muestra «Consultar»)']; $retireRow($refRaw, $idRaw, $r); continue; }
            $price = round($p0, $dec);
            $rs = $resolve($refRaw, $idRaw, $r);
            if (isset($rs['skip'])) { $ignored[] = ['ref' => $ref, 'reason' => $rs['skip']]; continue; }
            if (isset($rs['unknown'])) { $unknown[] = $ref; continue; }
            $target = $rs['target'];
            $extra = $rs['extra'] ?? null;
            $t = [];
            foreach ([2, 3, 4] as $k) {
                $q = self::parseNumber($r[$map['qty' . $k] ?? -1] ?? null);
                $pp = self::parseNumber($r[$map['price' . $k] ?? -1] ?? null);
                if ($q && $q > 1 && $pp !== null && $pp >= 0) $t[] = [(int) floor($q), round($pp, $dec)];
            }
            usort($t, function ($a, $b) { return $a[0] <=> $b[0]; });
            $note = isset($map['note']) && $col($r, 'note') ? mb_substr((string) $col($r, 'note'), 0, 120) : '';
            if (array_key_exists($target, $seen)) {                                       // referencia repetida (p. ej. filas EN/FR/DE de WooCommerce)
                if ($seen[$target] != $price) $warnings[] = ['code' => 'duplicada', 'message' => '«' . $target . '» aparece varias veces con precios distintos (' . self::num($seen[$target]) . ' y ' . self::num($price) . '); se usa el primero'];
                continue;
            }
            $seen[$target] = $price; $by[$rs['kind']]++;
            $item = ['p' => $price];
            if ($t) $item['t'] = $t;
            if ($note !== '') $item['note'] = $note;
            if ($extra) $item += $extra;
            $items[$target] = $item;
            if ($extra) $extras[] = $target;
        }
        $n = count($items);
        if ($n >= 10) {                                                                      // precio de relleno
            $freq = [];
            foreach ($items as $v) { $k = (string) $v['p']; $freq[$k] = ($freq[$k] ?? 0) + 1; }
            arsort($freq);
            $top = array_key_first($freq);
            $cnt = $freq[$top];
            if ($cnt / $n > 0.6) $warnings[] = ['code' => 'precio_de_relleno', 'message' => 'El ' . (int) round(100 * $cnt / $n) . ' % de los precios es ' . $top . ': parece un valor de relleno, no una tarifa', 'count' => $cnt];
        }
        if ($unknown) $warnings[] = ['code' => 'referencias_desconocidas', 'message' => count($unknown) . ' referencias de la hoja no están en la web ni encajan en ninguna familia (no se publican)', 'count' => count($unknown)];
        if ($extras) $warnings[] = ['code' => 'referencias_nuevas', 'message' => count($extras) . ' referencias nuevas se publican dentro de su producto (códigos de la tarifa que el catálogo de la web no tenía)', 'count' => count($extras)];
        if ($empty) $warnings[] = ['code' => 'sin_precio', 'message' => $empty . ' filas sin precio: se muestran como «Consultar»', 'count' => $empty];
        $columns = [];
        foreach ($map as $f => $i) $columns[$f] = $headers[$i] ?? '';
        return ['items' => $items, 'warnings' => $warnings, 'ignored' => $ignored, 'unknown' => $unknown, 'extras' => $extras, 'retire' => $retire, 'columns' => $columns, 'stats' => ['rows' => $rowsRead, 'accepted' => $n, 'decimals' => $dec, 'by' => $by]];
    }

    /** número sin ceros sobrantes, como lo escribe JavaScript (10, 10.5) */
    private static function num($n): string
    {
        return rtrim(rtrim(sprintf('%.8F', $n), '0'), '.');
    }
}
