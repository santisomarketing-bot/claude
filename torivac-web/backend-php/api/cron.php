<?php
/**
 * [CRON] Sincroniza los precios desde la hoja de Drive y limpia lo caducado.
 *   cPanel → «Trabajos de Cron» → una vez al día (p. ej. 03:00):  /usr/local/bin/php /home/CUENTA/public_html/api/cron.php
 *   Plesk  → «Tareas programadas» → «Ejecutar un script PHP» → ruta  …/api/cron.php  (o «Obtener una URL» con cron_token)
 * Sale con código 0 si todo fue bien y 1 si la hoja se rechazó (hoja rota, precios de relleno…): el detalle queda en la salida.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Solo por línea de comandos (o GET /api/cron?token=… con cron_token configurado)'); }

require __DIR__ . '/lib/autoload.php';

use Torivac\Config;
use Torivac\Router;
use Torivac\Store;

Config::load(__DIR__ . '/config.php');
Store::bootstrap((string) Config::get('storage_dir', ''));
try {
    $meta = Router::cron();
    echo gmdate('c') . ' precios sincronizados: ' . json_encode($meta, JSON_UNESCAPED_UNICODE) . "\n";
} catch (\Throwable $e) {
    fwrite(STDERR, gmdate('c') . ' sincronización fallida: ' . $e->getMessage() . "\n");
    exit(1);
}
