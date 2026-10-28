<?php
/**
 * [INDEX] Punto de entrada del API (api/index.php). El .htaccess de la web reescribe /api/* hasta aquí.
 * Carga la configuración (config.php), inicializa el almacén de datos y despacha la petición.
 */
declare(strict_types=0);

require __DIR__ . '/lib/autoload.php';

use Torivac\Config;
use Torivac\Request;
use Torivac\Response;
use Torivac\Router;
use Torivac\Store;

Config::load(__DIR__ . '/config.php');
try {
    Store::init((string) Config::get('storage_dir', __DIR__ . '/storage'));
} catch (\Throwable $e) {
    (new Response(['ok' => false, 'error' => 'El servidor no puede escribir en su directorio de datos (revisa storage_dir y sus permisos)'], 500))->send();
    exit;
}
$req = Request::fromGlobals();
Router::handle($req)->send();
