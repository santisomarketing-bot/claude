<?php
/**
 * [PAGE] Punto de entrada de las páginas que pinta el servidor (api/page.php): las entradas del blog escritas en el panel, el listado del blog con ellas, sus imágenes y el sitemap.xml, llms.txt y
 * llms-full.txt con ellas añadidas. El .htaccess de la web reescribe hasta aquí SOLO esas direcciones (/blog/…, /media/blog/…, /sitemap.xml, /llms.txt, /llms-full.txt); lo que se sirve se decide por la
 * dirección original (REQUEST_URI), no por parámetros, así que llamar a este archivo directamente no sirve nada. Ver lib/BlogPage.php.
 * Si algo falla, el visitante nunca ve un error de PHP: el listado y los mapas caen al archivo estático de la compilación y el resto responde 503 sin detalles (el detalle va al registro con un id).
 */
declare(strict_types=0);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('html_errors', '0');

require __DIR__ . '/lib/autoload.php';

use Torivac\BlogPage;
use Torivac\Config;
use Torivac\Store;

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$hdr = [];
foreach ($_SERVER as $k => $v) if (strncmp($k, 'HTTP_', 5) === 0) $hdr[strtolower(str_replace('_', '-', substr($k, 5)))] = (string) $v;
try {
    Config::load(__DIR__ . '/config.php');
    Store::bootstrap((string) Config::get('storage_dir', ''));
    BlogPage::send(BlogPage::handle($method, $uri, $hdr), $method);
} catch (\Throwable $e) {
    $id = bin2hex(random_bytes(4));
    error_log('torivac-page[' . $id . ']: ' . get_class($e) . ': ' . mb_substr($e->getMessage(), 0, 300) . ' en ' . basename($e->getFile()) . ':' . $e->getLine());
    $route = BlogPage::route($uri);
    $static = null;                                                                          // sin la carpeta de datos, el listado y los mapas siguen saliendo tal como los dejó la compilación
    if ($route && $route['kind'] === 'index') $static = BlogPage::root() . ($route['lang'] === 'es' ? '' : '/' . $route['lang']) . '/blog/index.html';
    if ($route && $route['kind'] === 'file') $static = BlogPage::root() . '/' . $route['name'];
    if ($static !== null && is_file($static)) {
        header('Content-Type: ' . ($route['kind'] === 'index' ? 'text/html; charset=utf-8' : (substr($static, -4) === '.xml' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8')));
        header('Cache-Control: no-store');
        header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
        if ($method !== 'HEAD') readfile($static);
    } else {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        header('Retry-After: 120');
        header('Cache-Control: no-store');
        header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
        echo "Service Unavailable\n";
    }
}
