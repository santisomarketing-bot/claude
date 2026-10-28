<?php
/**
 * [BACKUP-TOOL] Hace una copia de seguridad de los datos desde la línea de comandos (la misma que «Crear copia ahora» del panel) y dice dónde quedó:
 *   php api/tools/backup.php
 * Úsala antes de actualizar la web o de tocar la carpeta de datos. El archivo queda en <carpeta de datos>/backups/ y se baja desde Panel → Ajustes → Copias de seguridad (o por SFTP).
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../lib/autoload.php';

use Torivac\Backup;
use Torivac\Config;
use Torivac\Store;

Config::load(__DIR__ . '/../config.php');
Store::bootstrap((string) Config::get('storage_dir', ''));
$r = Backup::create('línea de comandos', false);
if (isset($r['error'])) { fwrite(STDERR, 'Error: ' . $r['error'] . "\n"); exit(1); }
echo 'Copia hecha: ' . Backup::dir() . '/' . $r['file'] . ' (' . $r['keys'] . ' registros, ' . $r['media'] . ' imágenes, ' . round($r['size'] / 1048576, 1) . " MB)\n";
