<?php
/**
 * [INDEX] Punto de entrada del API (api/index.php). El .htaccess de la web reescribe /api/* hasta aquí.
 * Carga la configuración (config.php), inicializa el almacén de datos y despacha la petición.
 * Los errores de PHP NUNCA se escriben en la respuesta (display_errors a 0): enseñarían rutas del servidor; van al registro de errores del dominio.
 */
declare(strict_types=0);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('html_errors', '0');

require __DIR__ . '/lib/autoload.php';

use Torivac\Config;
use Torivac\Request;
use Torivac\Response;
use Torivac\Router;
use Torivac\Store;

Config::load(__DIR__ . '/config.php');
try {
    Store::bootstrap((string) Config::get('storage_dir', ''));
} catch (\Throwable $e) {
    $id = bin2hex(random_bytes(4));
    error_log('torivac-api[' . $id . ']: ' . $e->getMessage());                  // el detalle (con rutas) va al registro de errores del dominio, con este id, no a quien llame al API
    (new Response(['ok' => false, 'error' => 'El servidor no puede escribir en su directorio de datos (revisa storage_dir y sus permisos)', 'id' => $id], 500))->send();
    exit;
}
try {
    $req = Request::fromGlobals();
    Router::handle($req)->send();
} catch (\Throwable $e) {                                                                      // lo que Router::handle no recoja: respuesta genérica con un id y el detalle al registro
    Router::failure($e)->send();
}
