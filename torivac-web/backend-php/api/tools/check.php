<?php
/**
 * [CHECK] Comprobación de la instalación desde la línea de comandos (Terminal de cPanel, SSH o, en Plesk, una tarea programada de «Ejecutar un comando»):
 *   php api/tools/check.php           revisa PHP, extensiones, carpeta de datos, config.php, correo, precios y primer manager
 *   php api/tools/check.php --net     además prueba la salida a Internet (Resend, Google, Anthropic)
 * Sale con código 1 si hay algo que impide funcionar (✗); los avisos (⚠) son cosas a revisar.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../lib/autoload.php';

use Torivac\Config;
use Torivac\Diag;
use Torivac\Store;

Config::load(__DIR__ . '/../config.php');
try { Store::bootstrap((string) Config::get('storage_dir', '')); } catch (\Throwable $e) { /* Diag lo cuenta como fallo de la carpeta de datos */ }
$r = Diag::run(in_array('--net', $argv, true), __DIR__ . '/../config.php');
$sym = ['ok' => '✓', 'warn' => '⚠', 'fail' => '✗'];
foreach ($r['checks'] as $c) echo $sym[$c['status']] . ' ' . $c['msg'] . "\n";
echo "\n" . ($r['fail'] ? "✗ {$r['fail']} problema(s) que impiden funcionar" : '✓ La instalación puede funcionar') . ($r['warn'] ? " · ⚠ {$r['warn']} aviso(s)" : '') . "\n";
exit($r['fail'] ? 1 : 0);
