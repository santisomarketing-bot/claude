<?php
/**
 * [RESTORE] Restaura una copia de seguridad (archivo .jsonl.gz que hizo el panel o tools/backup.php) en la carpeta de datos de esta instalación:
 *   php api/tools/restore.php ARCHIVO.jsonl.gz --dry-run     cuenta lo que trae y comprueba que está completa, sin escribir nada
 *   php api/tools/restore.php ARCHIVO.jsonl.gz               restaura (solo si la carpeta de datos está vacía)
 *   php api/tools/restore.php ARCHIVO.jsonl.gz --force       restaura sobrescribiendo lo que ya haya con lo que trae la copia (lo que la copia no trae se queda)
 * Antes de escribir se comprueba que la copia está entera. No toca config.php. Después de restaurar, las sesiones y los dispositivos recordados de los usuarios siguen valiendo.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../lib/autoload.php';

use Torivac\Backup;
use Torivac\Config;
use Torivac\Store;

$args = array_slice($argv, 1);
$file = '';
foreach ($args as $a) if (strncmp($a, '--', 2) !== 0) $file = $a;
if ($file === '') { fwrite(STDERR, "Uso: php restore.php ARCHIVO.jsonl.gz [--dry-run] [--force]\n"); exit(2); }
Config::load(__DIR__ . '/../config.php');
Store::bootstrap((string) Config::get('storage_dir', ''));
$r = Backup::restore($file, in_array('--force', $args, true), in_array('--dry-run', $args, true));
if (isset($r['error'])) { fwrite(STDERR, 'Error: ' . $r['error'] . "\n"); exit(1); }
echo (in_array('--dry-run', $args, true) ? 'La copia está completa: ' . $r['keys'] . ' registros y ' . $r['media'] . " imágenes (no se ha escrito nada).\n" : 'Restaurado: ' . $r['written'] . ' elementos (' . $r['keys'] . ' registros y ' . $r['media'] . " imágenes) en la carpeta de datos.\n");
