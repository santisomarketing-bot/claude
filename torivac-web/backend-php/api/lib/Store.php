<?php
/**
 * [STORE] Almacén clave-valor en ficheros JSON (sustituye a Cloudflare KV en un hosting con Apache y PHP: cPanel, Plesk…).
 *   claves: user:<email> · order:<nº> · prices:current · prices:meta · prices:sync · prices:history:<ts> · rl:<cubo>:<sha256 de 32 caracteres del id> · counter:<yyyymmdd> · proposals:state · auth:decoy
 * Escritura atómica (fichero temporal + rename) y bloqueo flock para los contadores. Caducidad opcional (TTL) comprobada al leer.
 * Seguridad: el directorio lleva .htaccess «Require all denied»; lo ideal es ponerlo FUERA de la web (config storage_dir; vacío = automático, ver bootstrap()).
 * Permisos: ficheros nuevos 0660 y carpetas 0770 (nada legible por otros usuarios del hosting: hay hashes de contraseñas y datos personales de pedidos).
 */
namespace Torivac;

final class Store
{
    /** Permisos de las carpetas nuevas (propietario y grupo; «otros» nada). */
    const DIR_MODE = 0770;
    /** Permisos de los ficheros nuevos (propietario y grupo; «otros» nada). */
    const FILE_MODE = 0660;

    private static $root = '';
    private static $note = '';

    /**
     * Carpetas donde guardar los datos cuando `storage_dir` está vacío, de mejor a peor:
     *   1) «torivac-datos» en la carpeta personal de la cuenta (cPanel: /home/CUENTA/torivac-datos): FUERA de la web, sin riesgo;
     *   2) api/storage, dentro de la web y protegida con .htaccess: funciona en cualquier hosting. En Plesk es lo que se usa salvo que quien administra el servidor
     *      cree «torivac-datos» en la raíz de la cuenta (/var/www/vhosts/DOMINIO), que el usuario de la web normalmente no puede escribir.
     */
    public static function candidates(?string $home = null, ?string $apiDir = null): array
    {
        if ($home === null) {
            $pw = function_exists('posix_getpwuid') && function_exists('posix_geteuid') ? @posix_getpwuid(posix_geteuid()) : false;
            $home = is_array($pw) && !empty($pw['dir']) ? (string) $pw['dir'] : (string) getenv('HOME');
        }
        $home = rtrim($home, '/\\');
        return array_merge($home !== '' ? [$home . '/torivac-datos'] : [], [rtrim($apiDir ?? dirname(__DIR__), '/\\') . '/storage']);
    }

    /**
     * Prepara el almacén y devuelve su carpeta. Orden: 1) `$configured` (config storage_dir) si se puede usar; 2) una de `candidates()` que YA sea un almacén
     * (así los datos nunca se parten en dos si luego se crea una carpeta mejor: para moverlos hay que copiarlos y escribir storage_dir); 3) la primera de
     * `candidates()` que se pueda crear y escribir; 4) si nada se puede escribir, la primera que ya tenga datos (se lee y el diagnóstico avisa).
     * Si hubo que desviarse de `$configured`, `note()` lo cuenta. Lanza RuntimeException si no hay ninguna carpeta posible.
     */
    public static function bootstrap(string $configured = '', ?array $candidates = null): string
    {
        $cands = $candidates ?? self::candidates();
        $pick = null;
        if ($configured !== '' && self::usable($configured)) $pick = $configured;
        if ($pick === null) foreach ($cands as $d) if (self::initialized($d) && self::usable($d)) { $pick = $d; break; }
        if ($pick === null) foreach ($cands as $d) if (self::usable($d)) { $pick = $d; break; }
        if ($pick === null) foreach (array_merge($configured !== '' ? [$configured] : [], $cands) as $d) if (self::initialized($d)) { $pick = $d; break; }
        if ($pick === null) throw new \RuntimeException('No hay ninguna carpeta de datos que se pueda crear y escribir');
        self::init($pick);
        self::$note = ($configured !== '' && $pick !== $configured) ? 'storage_dir «' . $configured . '» no se puede usar (no existe y no se puede crear, o no se puede escribir): se usa «' . self::$root . '»' : '';
        return self::$root;
    }

    /** Dice si una carpeta sirve de almacén: existe (o se puede crear con sus subcarpetas) y se puede escribir en ella. */
    private static function usable(string $dir): bool
    {
        try { self::init($dir); } catch (\RuntimeException $e) { return false; }
        return @is_writable(self::$root);
    }

    /** Dice si una carpeta ya es un almacén de este API (tiene su subcarpeta kv). */
    private static function initialized(string $dir): bool { return @is_dir(rtrim($dir, '/\\') . '/kv'); }

    /** Aviso de bootstrap(): se usó una carpeta distinta de la configurada ('' si todo normal). */
    public static function note(): string { return self::$note; }

    /**
     * crea las carpetas y protege el directorio. Las carpetas nuevas quedan en 0770 aunque el umask del servidor diga otra cosa; en un almacén anterior (0775/0755), kv, locks y
     * outbox se cierran a «otros»: sin permiso de paso en la carpeta, sus ficheros (aunque sean 0664) dejan de ser alcanzables por otros usuarios del hosting.
     */
    public static function init(string $dir): void
    {
        self::$root = rtrim($dir, '/\\');
        foreach (['', '/kv', '/locks', '/outbox'] as $d) {
            $p = self::$root . $d;
            if (!@is_dir($p)) {
                if (!@mkdir($p, self::DIR_MODE, true) && !@is_dir($p)) throw new \RuntimeException('No puedo crear el directorio de datos: ' . $p);
                @chmod($p, self::DIR_MODE);
            } elseif ($d !== '' && (@fileperms($p) & 0007)) {
                @chmod($p, self::DIR_MODE);
            }
        }
        $ht = self::$root . '/.htaccess';
        if (!is_file($ht)) @file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
        $ix = self::$root . '/index.html';
        if (!is_file($ix)) @file_put_contents($ix, '');
    }

    /** Carpeta de datos en uso. */
    public static function root(): string { return self::$root; }

    /** Fichero JSON que guarda una clave (la clave se codifica para que sea un nombre de fichero válido). */
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

    /**
     * Guarda un valor de forma atómica (fichero temporal + rename) con caducidad opcional en segundos. Si el valor no se puede codificar a JSON LANZA una excepción
     * y lo que había guardado queda como estaba (nunca se escribe un «null» que vacíe la clave).
     */
    public static function put(string $key, $value, ?int $ttl = null): void
    {
        $o = ['v' => $value];
        if ($ttl) $o['x'] = time() + $ttl;
        $json = Util::enc($o);
        $f = self::file($key);
        $tmp = tempnam(dirname($f), '.tmp');
        if ($tmp === false) throw new \RuntimeException('No puedo escribir en el directorio de datos');
        if (file_put_contents($tmp, $json, LOCK_EX) === false) { @unlink($tmp); throw new \RuntimeException('No puedo escribir en el directorio de datos'); }
        @chmod($tmp, self::FILE_MODE);
        if (!@rename($tmp, $f)) { @unlink($tmp); throw new \RuntimeException('No puedo guardar ' . $key); }
    }

    /** Borra una clave. */
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

    /** Claves que empiezan por un prefijo SIN leer sus ficheros ni mirar la caducidad, de la más reciente (orden descendente) a la más antigua: para listar «los últimos N». */
    public static function names(string $prefix): array
    {
        $out = [];
        foreach (glob(self::$root . '/kv/' . rawurlencode($prefix) . '*.json', GLOB_NOSORT) ?: [] as $f) $out[] = rawurldecode(substr(basename($f), 0, -5));
        rsort($out, SORT_STRING);
        return $out;
    }

    /** ejecuta $fn con un bloqueo exclusivo (contador de pedidos, límites de uso) */
    public static function locked(string $name, callable $fn)
    {
        $p = self::$root . '/locks/' . preg_replace('/[^A-Za-z0-9_.-]/', '_', $name) . '.lock';
        $new = !is_file($p);
        $fh = fopen($p, 'c');
        if (!$fh) throw new \RuntimeException('No puedo crear el bloqueo');
        if ($new) @chmod($p, self::FILE_MODE);
        flock($fh, LOCK_EX);
        try { return $fn(); } finally { flock($fh, LOCK_UN); fclose($fh); }
    }

    /** borra lo caducado (lo llama el cron) y los temporales de escrituras interrumpidas (más de una hora) */
    public static function purge(): int
    {
        $n = 0;
        foreach (glob(self::$root . '/kv/*.json') ?: [] as $f) {
            $o = json_decode((string) @file_get_contents($f), true);
            if (is_array($o) && isset($o['x']) && $o['x'] < time()) { @unlink($f); $n++; }
        }
        foreach (glob(self::$root . '/kv/.tmp*') ?: [] as $f) { if ((int) @filemtime($f) < time() - 3600) @unlink($f); }
        return $n;
    }

    /**
     * Borra hasta `$max` registros de límite de uso (rl:*) caducados, mirando como mucho `$maxScan` ficheros (a partir de una posición al azar si hay más): es la limpieza «al vuelo»
     * que evita que crezcan sin límite aunque nadie llame al cron. Devuelve cuántos borró.
     */
    public static function purgeRl(int $max = 200, int $maxScan = 2000): int
    {
        $files = glob(self::$root . '/kv/' . rawurlencode('rl:') . '*.json', GLOB_NOSORT) ?: [];
        if (count($files) > $maxScan) $files = array_slice($files, random_int(0, count($files) - $maxScan), $maxScan);
        $n = 0;
        foreach ($files as $f) {
            if ($n >= $max) break;
            $o = json_decode((string) @file_get_contents($f), true);
            if (is_array($o) && isset($o['x']) && $o['x'] < time() && @unlink($f)) $n++;
        }
        return $n;
    }
}
