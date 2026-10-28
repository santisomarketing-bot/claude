<?php
/**
 * [STORE] Almacén clave-valor en ficheros JSON (sustituye a Cloudflare KV en un hosting con cPanel).
 *   claves: user:<email> · order:<nº> · prices:current · prices:meta · prices:history:<ts> · rl:<cubo>:<id> · counter:<yyyymmdd> · proposals:state
 * Escritura atómica (fichero temporal + rename) y bloqueo flock para los contadores. Caducidad opcional (TTL) comprobada al leer.
 * Seguridad: el directorio lleva .htaccess «Require all denied»; lo ideal es ponerlo FUERA de public_html (config storage_dir).
 */
namespace Torivac;

final class Store
{
    private static $root = '';

    /** crea las carpetas y protege el directorio */
    public static function init(string $dir): void
    {
        self::$root = rtrim($dir, '/\\');
        foreach (['', '/kv', '/locks', '/outbox'] as $d) {
            if (!is_dir(self::$root . $d) && !@mkdir(self::$root . $d, 0775, true) && !is_dir(self::$root . $d)) {
                throw new \RuntimeException('No puedo crear el directorio de datos: ' . self::$root . $d);
            }
        }
        $ht = self::$root . '/.htaccess';
        if (!is_file($ht)) @file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
        $ix = self::$root . '/index.html';
        if (!is_file($ix)) @file_put_contents($ix, '');
    }

    public static function root(): string { return self::$root; }

    private static function file(string $key): string { return self::$root . '/kv/' . rawurlencode($key) . '.json'; }

    /** valor guardado (array/escalar) o null si no existe o caducó */
    public static function get(string $key)
    {
        $f = self::file($key);
        if (!is_file($f)) return null;
        $raw = @file_get_contents($f);
        if ($raw === false) return null;
        $o = json_decode($raw, true);
        if (!is_array($o) || !array_key_exists('v', $o)) return null;
        if (isset($o['x']) && $o['x'] < time()) { @unlink($f); return null; }
        return $o['v'];
    }

    public static function put(string $key, $value, ?int $ttl = null): void
    {
        $o = ['v' => $value];
        if ($ttl) $o['x'] = time() + $ttl;
        $f = self::file($key);
        $tmp = tempnam(dirname($f), '.tmp');
        if ($tmp === false || file_put_contents($tmp, Util::enc($o), LOCK_EX) === false) throw new \RuntimeException('No puedo escribir en el directorio de datos');
        @chmod($tmp, 0664);
        if (!@rename($tmp, $f)) { @unlink($tmp); throw new \RuntimeException('No puedo guardar ' . $key); }
    }

    public static function delete(string $key): void { @unlink(self::file($key)); }

    /** claves que empiezan por un prefijo (sin las caducadas) */
    public static function keys(string $prefix): array
    {
        $out = [];
        foreach (glob(self::$root . '/kv/' . rawurlencode($prefix) . '*.json') ?: [] as $f) {
            $key = rawurldecode(substr(basename($f), 0, -5));
            if (self::get($key) !== null) $out[] = $key;
        }
        sort($out);
        return $out;
    }

    /** ejecuta $fn con un bloqueo exclusivo (contador de pedidos, límites de uso) */
    public static function locked(string $name, callable $fn)
    {
        $fh = fopen(self::$root . '/locks/' . preg_replace('/[^A-Za-z0-9_.-]/', '_', $name) . '.lock', 'c');
        if (!$fh) throw new \RuntimeException('No puedo crear el bloqueo');
        flock($fh, LOCK_EX);
        try { return $fn(); } finally { flock($fh, LOCK_UN); fclose($fh); }
    }

    /** borra lo caducado (lo llama el cron) */
    public static function purge(): int
    {
        $n = 0;
        foreach (glob(self::$root . '/kv/*.json') ?: [] as $f) {
            $o = json_decode((string) @file_get_contents($f), true);
            if (is_array($o) && isset($o['x']) && $o['x'] < time()) { @unlink($f); $n++; }
        }
        return $n;
    }
}
