<?php
/**
 * [DIAG] Autodiagnóstico del servidor para quien despliega en un hosting con Apache y PHP (cPanel, Plesk…): versión de PHP, extensiones, carpeta de datos, configuración, correo,
 * origen de precios, primer manager y última sincronización; y, si se mira por web, qué servidor es y qué IP ve del visitante. Se ve de dos formas:
 *   php api/tools/check.php [--net]      por línea de comandos (--net prueba además la salida a Internet)
 *   GET /api/diag                        solo managers (el panel lo muestra en Ajustes)
 * Cada comprobación es ['id', 'status' => ok|warn|fail, 'msg']; «fail» impide que la web funcione, «warn» es algo a revisar.
 */
namespace Torivac;

final class Diag
{
    const SAMPLE_SECRET = Auth::SAMPLE_SECRET;

    /** Una comprobación. */
    private static function c(string $id, string $status, string $msg): array { return ['id' => $id, 'status' => $status, 'msg' => $msg]; }

    /**
     * Dice si un directorio está dentro de la web (cualquiera podría pedir sus ficheros si el .htaccess no se respetara): bajo la carpeta que contiene api/ (la web)
     * o bajo DOCUMENT_ROOT cuando se mira por web. Por línea de comandos no hay DOCUMENT_ROOT, y la primera comprobación basta.
     */
    private static function insideWebRoot(string $dir): bool
    {
        $real = realpath($dir);
        if (!$real) return false;
        $roots = [dirname(__DIR__, 2)];
        if (!empty($_SERVER['DOCUMENT_ROOT'])) $roots[] = (string) $_SERVER['DOCUMENT_ROOT'];
        foreach ($roots as $r) {
            $rr = realpath($r);
            if ($rr && strpos($real . '/', rtrim($rr, '/') . '/') === 0) return true;
        }
        return false;
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
    public static function run(bool $net = false, ?string $configFile = null, ?Request $req = null): array
    {
        $k = [];
        $k[] = version_compare(PHP_VERSION, '7.4.0', '>=')
            ? self::c('php', version_compare(PHP_VERSION, '8.1.0', '>=') ? 'ok' : 'warn', 'PHP ' . PHP_VERSION . (version_compare(PHP_VERSION, '8.1.0', '>=') ? '' : ' (funciona, pero se recomienda 8.1 o superior: cPanel → MultiPHP Manager · Plesk → Ajustes de PHP del dominio)'))
            : self::c('php', 'fail', 'PHP ' . PHP_VERSION . ': hace falta 7.4 o superior (cPanel → MultiPHP Manager · Plesk → Ajustes de PHP del dominio)');
        $miss = array_values(array_filter(['curl', 'mbstring', 'openssl', 'json', 'zlib'], function ($e) { return !extension_loaded($e); }));
        $k[] = $miss ? self::c('extensiones', 'fail', 'Faltan extensiones de PHP: ' . implode(', ', $miss) . ' (cPanel → Seleccionar versión de PHP → Extensiones · Plesk: las instala quien administra el servidor)') : self::c('extensiones', 'ok', 'Extensiones curl, mbstring, openssl, json y zlib activas');
        $pm = self::bytes((string) ini_get('post_max_size'));
        $k[] = ($pm !== null && $pm < 8 * 1048576)
            ? self::c('subida', 'warn', 'post_max_size es ' . ini_get('post_max_size') . ': un presupuesto con un PDF grande podría rechazarse; se recomienda 8M o más (cPanel → MultiPHP INI Editor · Plesk → Ajustes de PHP → post_max_size)')
            : self::c('subida', 'ok', 'post_max_size ' . (ini_get('post_max_size') ?: 'sin límite') . ': caben los PDF de los presupuestos');
        $cfgFile = $configFile ?? (dirname(__DIR__) . '/config.php');
        $k[] = is_file($cfgFile) ? self::c('config', 'ok', 'api/config.php existe') : self::c('config', 'fail', 'No existe api/config.php: copia api/config.sample.php como config.php y rellénalo');
        $dir = Store::root();                                                  // la carpeta que se está usando de verdad (storage_dir o, si falta, api/storage)
        $probe = $dir !== '' ? $dir . '/.escritura-' . bin2hex(random_bytes(3)) : '';
        if ($dir === '' || !is_dir($dir) || @file_put_contents($probe, 'x') === false) $k[] = self::c('datos', 'fail', 'No puedo escribir en la carpeta de datos «' . $dir . '»: créala y dale permiso de escritura para el usuario de la web, o escribe en storage_dir otra carpeta que sí lo permita');
        else {
            @unlink($probe);
            $k[] = self::insideWebRoot($dir) ? self::c('datos', 'warn', 'La carpeta de datos «' . $dir . '» está dentro de la web (protegida con .htaccess): lo ideal es una carpeta fuera de la carpeta pública y su ruta en storage_dir (cPanel: /home/CUENTA/torivac-datos · Plesk: la crea quien administra el servidor, ver la guía de Plesk). Comprueba en el navegador que sus ficheros no se abren (p. ej. /api/storage/index.html debe dar «Prohibido»)') : self::c('datos', 'ok', 'Carpeta de datos fuera de la web y con permiso de escritura: ' . $dir);
            if (Store::note() !== '') $k[] = self::c('datos_desvio', 'warn', Store::note() . ': corrige storage_dir en config.php (o déjalo vacío para que se elija sola)');
        }
        $sec = (string) Config::get('session_secret', '');
        $sp = Auth::secretProblem($sec);
        $k[] = $sp !== null ? self::c('secreto', 'fail', 'session_secret debe ser una cadena aleatoria de 32 o más caracteres (no la del ejemplo): ' . ($sp === 'sin cambiar' ? 'sigue siendo el valor de ejemplo' : 'ahora tiene ' . strlen($sec)) . '; mientras tanto NADIE puede iniciar sesión') : self::c('secreto', 'ok', 'session_secret definido (' . strlen($sec) . ' caracteres)');
        $at = (string) Config::get('admin_token', '');
        if ($at === '') $k[] = self::c('token_maestro', 'ok', 'Sin token maestro (solo entran usuarios con contraseña)');
        elseif (strlen($at) < Auth::MIN_ADMIN_TOKEN) $k[] = self::c('token_maestro', 'fail', 'admin_token tiene ' . strlen($at) . ' caracteres y hacen falta ' . Auth::MIN_ADMIN_TOKEN . ' o más: mientras tanto el token maestro está DESACTIVADO (no entra nadie con él)');
        else $k[] = self::c('token_maestro', 'warn', 'admin_token está activo: úsalo para crear el primer manager y vacíalo después');
        $ct = (string) Config::get('cron_token', '');
        if ($ct !== '') $k[] = strlen($ct) < Auth::MIN_CRON_TOKEN
            ? self::c('cron_token', 'fail', 'cron_token tiene ' . strlen($ct) . ' caracteres y hacen falta ' . Auth::MIN_CRON_TOKEN . ' o más: mientras tanto la URL /api/cron?token=… está DESACTIVADA (usa el cron por línea de comandos o alarga el token)')
            : self::c('cron_token', 'ok', 'cron_token definido (' . strlen($ct) . ' caracteres): la sincronización por URL está activa');
        $to = Orders::team();
        $bad = array_values(array_filter($to, function ($e) { return !Orders::validEmail($e); }));
        $k[] = (!$to || $bad) ? self::c('destinatarios', 'fail', 'order_to vacío o con correos no válidos' . ($bad ? ': ' . implode(', ', $bad) : '')) : self::c('destinatarios', 'ok', 'Los pedidos y mensajes llegan a ' . implode(' y ', $to));
        $drv = (string) Config::get('mail.driver', 'none');
        if ($drv === 'resend') $k[] = (string) Config::get('mail.resend_api_key', '') === '' ? self::c('correo', 'fail', 'mail.driver es resend pero falta mail.resend_api_key') : self::c('correo', 'ok', 'Correo con Resend (recuerda verificar el dominio de order_from: SPF y DKIM)');
        elseif ($drv === 'mail') $k[] = self::c('correo', 'warn', 'Correo con mail() del hosting: sin garantías de entrega; se recomienda Resend');
        elseif ($drv === 'file') $k[] = self::c('correo', 'warn', 'Modo pruebas: los correos se guardan en la carpeta de datos (outbox) y no se envían');
        else $k[] = self::c('correo', 'fail', 'mail.driver = none: no se envía ningún correo (el pedido se guarda, pero nadie lo recibe)');
        $copy = Config::get('order_copy', 'capped');
        $mode = Orders::copyMode();
        $dmRaw = Config::get('order_copy_daily_max', null);
        $dm = Orders::copyDailyMax();
        if ($mode === 'capped') $k[] = ($dmRaw !== null && !is_numeric($dmRaw)) || $dm > 1000
            ? self::c('copia_cliente', 'warn', 'Copia del presupuesto al cliente activa (máx. ' . Orders::COPY_PER_RECIPIENT . ' por destinatario cada 24 h) pero order_copy_daily_max ' . (is_numeric($dmRaw) ? 'vale ' . $dm . ', demasiado alto para evitar abusos' : 'no es un número: se usa ' . $dm))
            : self::c('copia_cliente', 'ok', 'Copia del presupuesto al cliente activa: solo texto fijo y sin adjunto; máx. ' . Orders::COPY_PER_RECIPIENT . ' por destinatario cada 24 h y ' . $dm . ' al día en total');
        elseif (Orders::copyModeValid()) $k[] = self::c('copia_cliente', 'ok', 'Copia del presupuesto al cliente desactivada (order_copy = off): solo se avisa al equipo');
        else $k[] = self::c('copia_cliente', 'warn', 'order_copy tiene un valor no válido («' . mb_substr(is_scalar($copy) ? (string) $copy : gettype($copy), 0, 30) . '»): se trata como off y no se envía copia al cliente (valores válidos: capped y off)');
        $oh = Config::get('orders_per_hour_max', null);
        $k[] = $oh !== null && !is_numeric($oh)
            ? self::c('limite_pedidos', 'warn', 'orders_per_hour_max no es un número: se usa ' . Orders::ordersPerHourMax() . ' pedidos por hora')
            : self::c('limite_pedidos', 'ok', 'Límite global de ' . Orders::ordersPerHourMax() . ' pedidos por hora (protege la cuota del correo y el buzón del equipo)');
        $hasSa = Config::get('prices.google_service_account', '') && Config::get('prices.sheet_id', '');
        $src = $hasSa ? 'cuenta de servicio + id de archivo de Drive' : (Config::get('prices.xlsx_url', '') ? 'descarga directa de un .xlsx' : (Config::get('prices.csv_url', '') ? 'CSV público de una hoja de Google' : ''));
        $k[] = $src === '' ? self::c('precios', 'warn', 'Sin origen de precios: solo se pueden subir hojas a mano desde el panel') : self::c('precios', 'ok', 'Precios desde: ' . $src);
        $meta = Store::get(Prices::KEY_META);
        if (is_array($meta) && !empty($meta['at'])) {
            $age = (time() - (int) strtotime((string) $meta['at'])) / 3600;
            $k[] = $age <= 36 ? self::c('sincronizacion', 'ok', 'Últimos precios: ' . $meta['at'] . ' (' . ($meta['refs'] ?? '?') . ' referencias, ' . ($meta['source'] ?? '?') . ')')
                : self::c('sincronizacion', 'warn', 'Los precios llevan ' . round($age / 24) . ' días sin actualizarse: ¿está programado el cron diario (api/cron.php)?');
        } else $k[] = self::c('sincronizacion', 'warn', 'Todavía no hay precios cargados: sube una hoja desde el panel o ejecuta api/cron.php');
        $sync = Store::get(Prices::KEY_SYNC);
        if (is_array($sync) && empty($sync['ok'])) $k[] = self::c('sincronizacion_ultima', 'warn', 'La última sincronización de precios (' . ($sync['at'] ?? '?') . ', ' . ($sync['reason'] ?? '?') . ') ' . (!empty($sync['blocked']) ? 'se BLOQUEÓ por seguridad' : 'falló') . ' y se conservan los precios vigentes: ' . ($sync['error'] ?? ''));
        $orders = array_slice(Store::names('order:'), 0, 20);                    // los 20 últimos pedidos (solo se leen esos, aunque haya miles): ¿salió el aviso por correo?
        $lost = 0;
        foreach ($orders as $key) { $o = Store::get($key); if (is_array($o) && isset($o['emailed']) && empty($o['emailed']['team'])) $lost++; }
        if ($lost) $k[] = self::c('pedidos_sin_correo', 'warn', "$lost de los últimos " . count($orders) . ' pedidos se guardaron pero su aviso por correo no salió (se marcan «sin aviso por correo» en Pedidos): revisa el correo del servidor');
        $managers = array_filter(Users::all(), function ($u) { return $u['role'] === 'manager'; });
        $k[] = $managers ? self::c('manager', 'ok', count($managers) . ' manager(s) creado(s)') : self::c('manager', 'fail', 'No hay ningún manager: crea el primero con  php api/tools/create-user.php correo "Nombre" manager "contraseña"');
        $k[] = is_file(dirname(__DIR__) . '/generated/catalog.json') ? self::c('catalogo', 'ok', 'Catálogo de referencias presente') : self::c('catalogo', 'fail', 'Falta api/generated/catalog.json (se genera al compilar la web)');
        if (PHP_SAPI !== 'cli') $k = array_merge($k, self::web($req, $_SERVER));
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

    /**
     * Comprobaciones que solo tienen sentido al mirar por web: qué servidor atiende (¿se aplica el .htaccess?), qué IP ve del visitante detrás de un proxy y si la
     * petición llegó por HTTPS. `$server` es $_SERVER (en las pruebas, uno simulado); `$req` es la petición, para comparar su IP con la de la conexión.
     * @return array<int,array{id:string,status:string,msg:string}>
     */
    public static function web(?Request $req, array $server): array
    {
        $k = [];
        $sw = (string) ($server['SERVER_SOFTWARE'] ?? '');
        if ($sw !== '') $k[] = (stripos($sw, 'nginx') !== false && !preg_match('/apache|litespeed/i', $sw))
            ? self::c('servidor', 'warn', 'El servidor web es «' . $sw . '», sin Apache: el .htaccess no se aplica (URLs limpias, cabeceras de seguridad, redirecciones y la ruta /api no funcionarán). En Plesk: Dominios → tu dominio → Ajustes de PHP → «Ejecutar PHP como: aplicación FPM servida por Apache» (ver la guía de Plesk)')
            : self::c('servidor', 'ok', 'Servidor web: ' . $sw);
        $peer = Request::normalizeIp((string) ($server['REMOTE_ADDR'] ?? ''));
        if ($req !== null && $peer !== null) {
            if ($req->ip !== $peer) $k[] = self::c('ip_visitante', 'ok', 'Hay un proxy delante (nginx, Cloudflare…): la IP del visitante (' . $req->ip . ') se lee de sus cabeceras y los límites por IP funcionan por visitante');
            elseif (Request::isTrustedProxy($peer, Request::proxyList($server))) $k[] = self::c('ip_visitante', 'warn', 'Todas las visitas llegan con la IP interna ' . $peer . ': hay un proxy delante que no pasa la IP real, así que los límites por IP (pedidos, mensajes, intentos de acceso) se compartirían entre todos los visitantes. Hace falta que el proxy envíe X-Forwarded-For (el nginx de Plesk lo hace por defecto; si sale este aviso, mira la guía de Plesk)');
            else $k[] = self::c('ip_visitante', 'ok', 'El servidor ve la IP real del visitante (' . $req->ip . '): los límites por IP funcionan por visitante');
        }
        $https = (!empty($server['HTTPS']) && $server['HTTPS'] !== 'off') || (($server['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $k[] = $https ? self::c('https', 'ok', 'La web se sirve por HTTPS') : self::c('https', 'warn', 'Esta petición no llegó por HTTPS: activa el certificado gratuito del hosting (cPanel → SSL/TLS Status → AutoSSL · Plesk → Certificados SSL/TLS → Let\'s Encrypt)');
        return $k;
    }
}
