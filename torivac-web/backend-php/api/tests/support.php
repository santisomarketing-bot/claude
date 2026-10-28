<?php
/** Preparación común de las pruebas: almacén temporal, configuración de pruebas, catálogo sintético y peticiones simuladas */
namespace Torivac\Tests;

use Torivac\Catalog;
use Torivac\Config;
use Torivac\Http;
use Torivac\Prices;
use Torivac\Request;
use Torivac\Store;

const SECRET = 'x-secreto-de-pruebas-de-al-menos-32-caracteres';

/** Almacén temporal nuevo, configuración y catálogo sintéticos de las pruebas. */
function fresh(array $cfg = []): void
{
    $dir = sys_get_temp_dir() . '/tv-php-test-' . bin2hex(random_bytes(4));
    Store::init($dir);
    Config::set($cfg + ['storage_dir' => $dir, 'session_secret' => SECRET, 'admin_token' => 'token-maestro-123', 'allowed_origins' => ['https://demo.example'],
        'order_to' => ['info@grupotorivac.com', 'mzamora@torivac.com'], 'order_from' => 'Torivac Web <pedidos@grupotorivac.com>', 'mail' => ['driver' => 'file']]);
    Catalog::set(['items' => ['TT0020210' => ['n' => 'Transformador serie TT 20 VA', 'pid' => 884], 'P16633' => ['n' => 'Variador portátil', 'pid' => 16633], 'R100' => ['n' => 'Resistencia 100 W', 'pid' => 1]],
        'skus' => ['aaaa00000001' => 16633], 'rules' => [['pattern' => '^TT\d{7}$', 'pid' => 884]]]);
    Http::$mock = null;
}

/** Precios de ejemplo: TT0020210 con tramos y P16633. */
function prices(): array
{
    return ['updated_at' => '2026-10-27T00:00:00.000Z', 'source' => 'test', 'currency' => 'EUR', 'mode' => 'live', 'items' => ['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]]], 'P16633' => ['p' => 67.65]]];
}

/** Guarda los precios de ejemplo en el almacén. */
function seedPrices(): void { Store::put(Prices::KEY_CURRENT, Prices::forJson(prices())); }

/** Pedido válido de ejemplo (se puede sobrescribir cualquier campo). */
function goodOrder(array $over = []): array
{
    return $over + ['customer' => ['name' => 'Ana Pérez', 'company' => 'ACME', 'email' => 'ana@acme.es', 'phone' => '600', 'notes' => 'urgente', 'privacy' => true], 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3]], 'lang' => 'es'];
}

/** Petición simulada para llamar al Router sin servidor web. */
function req(string $method, string $path, $body = null, array $headers = [], string $ip = '10.0.0.1'): Request { return Request::fake($method, $path, $body, $headers, $ip); }

/** cuerpo de una respuesta tal y como lo recibe un cliente (JSON → arrays): los `items` de precios viajan como objeto y en el servidor son stdClass */
function wire($resp): array { return json_decode(\Torivac\Util::enc($resp->body), true); }

/** Cabecera de autenticación con el token maestro. */
function master(): array { return ['Authorization' => 'Bearer token-maestro-123']; }

/** correos guardados por el controlador «file» */
function outbox(): array
{
    $out = [];
    foreach (glob(Store::root() . '/outbox/*.json') ?: [] as $f) $out[] = json_decode((string) file_get_contents($f), true);
    return $out;
}

const SHEET = "ref;price;qty2;price2;qty3;price3;note;active\nTT0020210;12,37;10;11,9;50;11,4;DEMO;1\nP16633;67,65;;;;;;1\nR100;5,5;;;;;;1\nX0;1;;;;;;0\n";
