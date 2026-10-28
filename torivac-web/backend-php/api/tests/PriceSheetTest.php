<?php
/** Pruebas de PriceSheet con los casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json) */
namespace Torivac\Tests;

use Torivac\PriceSheet;

/** Casos compartidos con la versión JavaScript (shared/price-sheet.fixtures.json). */
function fixtures(): array
{
    $f = __DIR__ . '/../../../shared/price-sheet.fixtures.json';
    if (!is_file($f)) $f = __DIR__ . '/price-sheet.fixtures.json';          // en el paquete del hosting se copia junto a las pruebas
    return json_decode(file_get_contents($f), true);
}

/** Cada caso de hoja → precios, desconocidas, nuevas y filas ignoradas esperados. */
function test_price_sheet_cases()
{
    foreach (fixtures()['cases'] as $c) {
        T::$name = 'price_sheet · ' . $c['name'];
        $r = PriceSheet::read($c['rows'], $c['ctx'] ?? []);
        $e = $c['expect'];
        if (isset($e['items'])) foreach ($e['items'] as $ref => $want) T::same($want, $r['items'][$ref] ?? null, "item $ref");
        if (isset($e['itemSample'])) foreach ($e['itemSample'] as $ref => $want) T::same($want['p'], $r['items'][$ref]['p'] ?? null, "muestra $ref");
        if (isset($e['acceptedCount'])) T::same($e['acceptedCount'], count($r['items']), 'nº aceptadas');
        if (isset($e['unknown'])) T::same($e['unknown'], $r['unknown'], 'desconocidas');
        if (isset($e['extras'])) T::same($e['extras'], $r['extras'], 'nuevas');
        if (isset($e['retire'])) T::same($e['retire'], $r['retire'], 'a retirar');
        if (isset($e['by'])) T::same($e['by'], $r['stats']['by'], 'filas por tipo de coincidencia');
        if (isset($e['ignoredReasons'])) {
            $got = array_values(array_unique(array_map(function ($x) { return $x['reason']; }, $r['ignored'])));
            $want = array_values(array_unique($e['ignoredReasons']));
            sort($got); sort($want);
            T::same($want, $got, 'filas ignoradas');
        }
        $codes = array_map(function ($w) { return $w['code']; }, $r['warnings']);
        $want = $e['warningCodes'];
        sort($codes); sort($want);
        T::same($want, $codes, 'avisos');
    }
}

/** Números de celda: coma o punto decimal, miles, símbolos de moneda y texto ilegible. */
function test_price_sheet_numbers()
{
    foreach (fixtures()['numbers'] as [$raw, $want]) {
        T::same($want, PriceSheet::parseNumber($raw), 'número «' . json_encode($raw) . '»');
    }
}

/** Hojas sin cabecera reconocible o vacías: error claro. */
function test_price_sheet_errors()
{
    T::throws(function () { PriceSheet::read(fixtures()['no_header']); }, '/columnas de referencia/');
    T::throws(function () { PriceSheet::read([['ref', 'price']]); }, '/vacía/');
}
