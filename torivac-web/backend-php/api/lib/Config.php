<?php
/**
 * [CONFIG] Lee api/config.php (copia de config.sample.php) y la sirve con claves anidadas: Config::get('mail.driver', 'file').
 * Las variables de entorno TORIVAC_<CLAVE> (p. ej. TORIVAC_SESSION_SECRET) tienen prioridad: útil para pruebas y para hostings con panel de variables.
 */
namespace Torivac;

final class Config
{
    private static $data = [];

    /** Carga la configuración desde config.php (si falta, queda vacía) y fuerza a OPcache a releerla. */
    public static function load(string $file): void
    {
        if (is_file($file) && function_exists('opcache_invalidate')) @opcache_invalidate($file, true);      // un cambio en config.php se nota al instante aunque OPcache revalide cada minuto
        $c = is_file($file) ? require $file : [];
        self::$data = is_array($c) ? $c : [];
    }

    /** sustituye toda la configuración (pruebas) */
    public static function set(array $c): void { self::$data = $c; }

    /** toda la configuración cargada (para tachar los secretos de los textos de error; nunca se devuelve por la API) */
    public static function all(): array { return self::$data; }

    /** valor por ruta con puntos: 'prices.sheet_id' */
    public static function get(string $path, $default = null)
    {
        $env = getenv('TORIVAC_' . strtoupper(str_replace('.', '_', $path)));
        if ($env !== false && $env !== '') return $env;
        $v = self::$data;
        foreach (explode('.', $path) as $k) {
            if (!is_array($v) || !array_key_exists($k, $v)) return $default;
            $v = $v[$k];
        }
        return $v === null ? $default : $v;
    }
}
