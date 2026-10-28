<?php
/**
 * [CREATE-USER] Crea un usuario desde la línea de comandos (el primer manager, o clientes):
 *   php api/tools/create-user.php correo@dominio.com "Nombre Apellido" manager "contraseña de al menos 12 caracteres"
 * Roles: manager (todo) · client (solo sus pedidos). La contraseña se guarda con password_hash. Se rechaza una contraseña de menos de 12 caracteres, que contenga la parte local del
 * correo o que sea de las más típicas (password…, 123456…, torivac…, qwerty…). Los usuarios ya creados no se tocan.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../lib/autoload.php';

use Torivac\Config;
use Torivac\Store;
use Torivac\Users;

if ($argc < 5) { fwrite(STDERR, "Uso: php create-user.php correo \"Nombre\" manager|client \"contraseña\"\n"); exit(2); }
Config::load(__DIR__ . '/../config.php');
Store::bootstrap((string) Config::get('storage_dir', ''));
$r = Users::create(['email' => $argv[1], 'name' => $argv[2], 'role' => $argv[3], 'password' => $argv[4]]);
if (isset($r['error'])) { fwrite(STDERR, 'Error: ' . $r['error'] . "\n"); exit(1); }
echo 'Usuario creado: ' . $r['user']['email'] . ' (' . $r['user']['role'] . ")\n";
