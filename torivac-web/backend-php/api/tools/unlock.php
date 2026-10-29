<?php
/**
 * [UNLOCK-TOOL] Quita el bloqueo de una cuenta desde la línea de comandos: la salida si ningún manager puede entrar al panel para pulsar «Desbloquear» (por ejemplo, si alguien ha agotado
 * el bloqueo de la cuenta de quien administra la web):
 *   php api/tools/unlock.php correo@dominio.com          quita los bloqueos y pone a cero los contadores de esa cuenta (contraseñas, códigos y visitantes que fallaron contra ella)
 *   php api/tools/unlock.php correo@dominio.com --todo   además quita la «protección reforzada» que dejan los ataques repetidos
 * Hace lo mismo que el botón «Desbloquear» de Panel → Usuarios (Security::unlock) y no toca nada más: ni contraseñas ni sesiones.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../lib/autoload.php';

use Torivac\Config;
use Torivac\Security;
use Torivac\Store;
use Torivac\Users;

$args = array_slice($argv, 1);
$email = '';
foreach ($args as $a) if (strncmp($a, '--', 2) !== 0) $email = strtolower(trim($a));
if ($email === '') { fwrite(STDERR, "Uso: php unlock.php correo@dominio.com [--todo]\n"); exit(2); }
Config::load(__DIR__ . '/../config.php');
Store::bootstrap((string) Config::get('storage_dir', ''));
if (Users::find($email) === null) { fwrite(STDERR, "Error: no existe ninguna cuenta con el correo $email\n"); exit(1); }
$all = in_array('--todo', $args, true);
Security::unlock($email, $all);
echo "Cuenta desbloqueada: $email" . ($all ? ' (y sin protección reforzada)' : '') . "\n";
