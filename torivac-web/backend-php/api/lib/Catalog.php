<?php
/**
 * [CATALOG] Catálogo de referencias pedibles que genera la compilación del sitio (generated/catalog.json):
 *   items {ref:{n,pid}} · skus {sku de WooCommerce:id de producto} · rules [{pattern,pid}] (códigos nuevos de una tarifa que encajan en un producto)
 */
namespace Torivac;

final class Catalog
{
    private static $c = null;

    public static function load(?string $file = null): array
    {
        if (self::$c !== null && $file === null) return self::$c;
        $f = $file ?? (__DIR__ . '/../generated/catalog.json');
        $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
        self::$c = is_array($j) ? $j + ['items' => [], 'skus' => [], 'rules' => []] : ['items' => [], 'skus' => [], 'rules' => []];
        return self::$c;
    }

    /** sustituye el catálogo (pruebas) */
    public static function set(array $c): void { self::$c = $c + ['items' => [], 'skus' => [], 'rules' => []]; }

    public static function items(): array { return self::load()['items']; }

    /** contexto para PriceSheet::read */
    public static function sheetCtx(): array
    {
        $c = self::load();
        $d = Config::get('prices.decimals', null);
        return ['lines' => $c['items'], 'skus' => $c['skus'], 'rules' => $c['rules']] + (is_numeric($d) ? ['decimals' => (int) $d] : []);
    }
}
