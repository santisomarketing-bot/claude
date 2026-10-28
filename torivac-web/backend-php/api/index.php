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
    Store::bootstrap((string) Config::get('storage_dir', ''));
} catch (\Throwable $e) {
    error_log('[torivac] ' . $e->getMessage());                                  // el detalle (con rutas) va al registro de errores del dominio, no a quien llame al API
    (new Response(['ok' => false, 'error' => 'El servidor no puede escribir en su directorio de datos (revisa storage_dir y sus permisos)'], 500))->send();
    exit;
}
$req = Request::fromGlobals();
Router::handle($req)->send();
