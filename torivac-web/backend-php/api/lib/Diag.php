<?php
/**
 * [DIAG] Autodiagnóstico del servidor para quien despliega en cPanel: versión de PHP, extensiones, carpeta de datos, configuración, correo,
 * origen de precios, primer manager y última sincronización. Se ve de dos formas:
 *   php api/tools/check.php [--net]      por línea de comandos (--net prueba además la salida a Internet)
 *   GET /api/diag                        solo managers (el panel lo muestra en Ajustes)
 * Cada comprobación es ['id', 'status' => ok|warn|fail, 'msg']; «fail» impide que la web funcione, «warn» es algo a revisar.
 */
namespace Torivac;

final class Diag
{
    const SAMPLE_SECRET = 'CAMBIA-ESTO';

    /** Una comprobación. */
    private static function c(string $id, string $status, string $msg): array { return ['id' => $id, 'status' => $status, 'msg' => $msg]; }

    /** Dice si un directorio está dentro de la carpeta pública de la web (cualquiera podría pedir sus ficheros si el .htaccess falla). */
    private static function insideWebRoot(string $dir): bool
    {
        $root = isset($_SERVER['DOCUMENT_ROOT']) ? realpath((string) $_SERVER['DOCUMENT_ROOT']) : false;
        $real = realpath($dir);
        return $root && $real && strpos($real . '/', rtrim($root, '/') . '/') === 0;
    }

    /** Valor de php.ini con sufijo (8M, 512K, 1G) → bytes; 0 o -1 = sin límite → null. */
    private static function bytes(string $v): ?int
    {
        $v = trim($v);
        if ($v === '' || (int) $v <= 0) return null;
        $n = (int) $v;
        switch (strtoupper(substr($v, -1))) { case 'G': return $n * 1073741824; case 'M': return $n * 1048576; case 'K': return $n * 1024; default: return $n; }
    }

    /**
     * Ejecuta todas las comprobaciones.
     * @return array{checks:array,fail:int,warn:int}
     */
    public static function run(bool $net = false, ?string $configFile = null): array
    {
        $k = [];
        $k[] = version_compare(PHP_VERSION, '7.4.0', '>=')
            ? self::c('php', version_compare(PHP_VERSION, '8.1.0', '>=') ? 'ok' : 'warn', 'PHP ' . PHP_VERSION . (version_compare(PHP_VERSION, '8.1.0', '>=') ? '' : ' (funciona, pero se recomienda 8.1 o superior: MultiPHP Manager en cPanel)'))
            : self::c('php', 'fail', 'PHP ' . PHP_VERSION . ': hace falta 7.4 o superior (MultiPHP Manager en cPanel)');
        $miss = array_values(array_filter(['curl', 'mbstring', 'openssl', 'json', 'zlib'], function ($e) { return !extension_loaded($e); }));
        $k[] = $miss ? self::c('extensiones', 'fail', 'Faltan extensiones de PHP: ' . implode(', ', $miss) . ' (cPanel → Seleccionar versión de PHP → Extensiones)') : self::c('extensiones', 'ok', 'Extensiones curl, mbstring, openssl, json y zlib activas');
        $pm = self::bytes((string) ini_get('post_max_size'));
        $k[] = ($pm !== null && $pm < 8 * 1048576)
            ? self::c('subida', 'warn', 'post_max_size es ' . ini_get('post_max_size') . ': un presupuesto con un PDF grande podría rechazarse; se recomienda 8M o más (cPanel → MultiPHP INI Editor)')
            : self::c('subida', 'ok', 'post_max_size ' . (ini_get('post_max_size') ?: 'sin límite') . ': caben los PDF de los presupuestos');
        $cfgFile = $configFile ?? (dirname(__DIR__) . '/config.php');
        $k[] = is_file($cfgFile) ? self::c('config', 'ok', 'api/config.php existe') : self::c('config', 'fail', 'No existe api/config.php: copia api/config.sample.php como config.php y rellénalo');
        $dir = Store::root();                                                  // la carpeta que se está usando de verdad (storage_dir o, si falta, api/storage)
        $probe = $dir !== '' ? $dir . '/.escritura-' . bin2hex(random_bytes(3)) : '';
        if ($dir === '' || !is_dir($dir) || @file_put_contents($probe, 'x') === false) $k[] = self::c('datos', 'fail', 'No puedo escribir en la carpeta de datos «' . $dir . '» (storage_dir): créala y dale permisos de escritura');
        else {
            @unlink($probe);
            $k[] = self::insideWebRoot($dir) ? self::c('datos', 'warn', 'La carpeta de datos está dentro de la web (protegida con .htaccess): lo ideal es moverla fuera de public_html y cambiar storage_dir') : self::c('datos', 'ok', 'Carpeta de datos fuera de la web y con permiso de escritura');
        }
        $sec = (string) Config::get('session_secret', '');
        $k[] = (strlen($sec) < 32 || strpos($sec, self::SAMPLE_SECRET) !== false) ? self::c('secreto', 'fail', 'session_secret debe ser una cadena aleatoria de 32 o más caracteres (no la del ejemplo)') : self::c('secreto', 'ok', 'session_secret definido (' . strlen($sec) . ' caracteres)');
        $k[] = (string) Config::get('admin_token', '') !== '' ? self::c('token_maestro', 'warn', 'admin_token está activo: úsalo para crear el primer manager y vacíalo después') : self::c('token_maestro', 'ok', 'Sin token maestro (solo entran usuarios con contraseña)');
        $to = Orders::team();
        $bad = array_values(array_filter($to, function ($e) { return !preg_match(Orders::EMAIL, $e); }));
        $k[] = (!$to || $bad) ? self::c('destinatarios', 'fail', 'order_to vacío o con correos no válidos' . ($bad ? ': ' . implode(', ', $bad) : '')) : self::c('destinatarios', 'ok', 'Los pedidos y mensajes llegan a ' . implode(' y ', $to));
        $drv = (string) Config::get('mail.driver', 'none');
        if ($drv === 'resend') $k[] = (string) Config::get('mail.resend_api_key', '') === '' ? self::c('correo', 'fail', 'mail.driver es resend pero falta mail.resend_api_key') : self::c('correo', 'ok', 'Correo con Resend (recuerda verificar el dominio de order_from: SPF y DKIM)');
        elseif ($drv === 'mail') $k[] = self::c('correo', 'warn', 'Correo con mail() del hosting: sin garantías de entrega; se recomienda Resend');
        elseif ($drv === 'file') $k[] = self::c('correo', 'warn', 'Modo pruebas: los correos se guardan en la carpeta de datos (outbox) y no se envían');
        else $k[] = self::c('correo', 'fail', 'mail.driver = none: no se envía ningún correo (el pedido se guarda, pero nadie lo recibe)');
        $hasSa = Config::get('prices.google_service_account', '') && Config::get('prices.sheet_id', '');
        $src = $hasSa ? 'cuenta de servicio + id de archivo de Drive' : (Config::get('prices.xlsx_url', '') ? 'descarga directa de un .xlsx' : (Config::get('prices.csv_url', '') ? 'CSV público de una hoja de Google' : ''));
        $k[] = $src === '' ? self::c('precios', 'warn', 'Sin origen de precios: solo se pueden subir hojas a mano desde el panel') : self::c('precios', 'ok', 'Precios desde: ' . $src);
        $meta = Store::get(Prices::KEY_META);
        if (is_array($meta) && !empty($meta['at'])) {
            $age = (time() - (int) strtotime((string) $meta['at'])) / 3600;
            $k[] = $age <= 36 ? self::c('sincronizacion', 'ok', 'Últimos precios: ' . $meta['at'] . ' (' . ($meta['refs'] ?? '?') . ' referencias, ' . ($meta['source'] ?? '?') . ')')
                : self::c('sincronizacion', 'warn', 'Los precios llevan ' . round($age / 24) . ' días sin actualizarse: ¿está programado el cron diario (api/cron.php)?');
        } else $k[] = self::c('sincronizacion', 'warn', 'Todavía no hay precios cargados: sube una hoja desde el panel o ejecuta api/cron.php');
        $orders = array_slice(Store::keys('order:'), -20);                       // los 20 últimos pedidos: ¿salió el aviso por correo?
        $lost = 0;
        foreach ($orders as $key) { $o = Store::get($key); if (is_array($o) && isset($o['emailed']) && empty($o['emailed']['team'])) $lost++; }
        if ($lost) $k[] = self::c('pedidos_sin_correo', 'warn', "$lost de los últimos " . count($orders) . ' pedidos se guardaron pero su aviso por correo no salió (se marcan «sin aviso por correo» en Pedidos): revisa el correo del servidor');
        $managers = array_filter(Users::all(), function ($u) { return $u['role'] === 'manager'; });
        $k[] = $managers ? self::c('manager', 'ok', count($managers) . ' manager(s) creado(s)') : self::c('manager', 'fail', 'No hay ningún manager: crea el primero con  php api/tools/create-user.php correo "Nombre" manager "contraseña"');
        $k[] = is_file(dirname(__DIR__) . '/generated/catalog.json') ? self::c('catalogo', 'ok', 'Catálogo de referencias presente') : self::c('catalogo', 'fail', 'Falta api/generated/catalog.json (se genera al compilar la web)');
        if (PHP_SAPI !== 'cli') {
            $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
            $k[] = $https ? self::c('https', 'ok', 'La web se sirve por HTTPS') : self::c('https', 'warn', 'Esta petición no llegó por HTTPS: activa AutoSSL en cPanel (Seguridad → SSL/TLS Status)');
        }
        if ($net) {
            foreach (['https://api.resend.com' => 'Resend', 'https://oauth2.googleapis.com' => 'Google', 'https://api.anthropic.com' => 'Anthropic'] as $url => $name) {
                try { [$st] = Http::request('GET', $url, [], null, 8); } catch (\Throwable $e) { $st = 0; }
                $k[] = $st > 0 ? self::c('red_' . strtolower($name), 'ok', "Salida a $name correcta (HTTP $st)") : self::c('red_' . strtolower($name), 'warn', "No hay salida a $name: el hosting bloquea conexiones HTTPS salientes o no hay cURL");
            }
        }
        $fail = count(array_filter($k, function ($x) { return $x['status'] === 'fail'; }));
        $warn = count(array_filter($k, function ($x) { return $x['status'] === 'warn'; }));
        return ['checks' => $k, 'fail' => $fail, 'warn' => $warn];
    }
}
