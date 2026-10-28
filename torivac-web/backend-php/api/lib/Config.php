<?php
/**
 * [CONFIG] Lee api/config.php (copia de config.sample.php) y la sirve con claves anidadas: Config::get('mail.driver', 'file').
 * Las variables de entorno TORIVAC_<CLAVE> (p. ej. TORIVAC_SESSION_SECRET) tienen prioridad: útil para pruebas y para hostings con panel de variables.
 */
namespace Torivac;

final class Config
{
    private static $data = [];

    public static function load(string $file): void
    {
        $c = is_file($file) ? require $file : [];
        self::$data = is_array($c) ? $c : [];
    }

    /** sustituye toda la configuración (pruebas) */
    public static function set(array $c): void { self::$data = $c; }

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
