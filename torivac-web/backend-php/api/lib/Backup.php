<?php
/**
 * [BACKUP] Copias de seguridad de los datos de la web (pedidos, mensajes, usuarios, precios, propuestas, entradas del blog e imágenes subidas) que se pueden descargar desde el panel.
 * Una copia es UN archivo `backup-AAAAMMDD-HHMMSS-<32 hex al azar>.jsonl.gz` en <datos>/backups/ (junto a una ficha .json con su resumen): gzip de líneas JSON, una por dato:
 *   { torivac_backup: 1, created, by, auto }                         cabecera
 *   { k: «order:TV-…», v: {…}, x?: caducidad }                       un dato del almacén (x = cuándo caduca, en segundos; los pedidos y mensajes caducan a los 400 días)
 *   { m: «archivo.webp», b64: «…» }                                   una imagen del blog
 *   { end: 1, keys: N, media: M }                                    cierre (una copia sin él está incompleta y no se restaura)
 * Qué NO entra: los contadores de límite de uso (rl:), los códigos pendientes (pin:), el índice de bloqueos (lgidx:), el hash señuelo y las propias copias; tampoco el registro de actividad ni config.php
 * (los secretos nunca van a una copia). Las copias SÍ llevan los hash de las contraseñas y datos personales de los pedidos: solo las descarga un manager, con un enlace firmado de 2 minutos que se anota
 * en el registro de actividad, y la carpeta de datos está cerrada a la web.
 * Cuándo: una vez por semana, sola (con la primera entrada de un manager al panel pasada la semana, o con el cron diario) y cuando un manager pulsa «Crear copia ahora». Se guardan las 8 últimas.
 * Restaurar: `php api/tools/restore.php archivo.jsonl.gz` (ver docs/SEGURIDAD.md). Ajustes (config.php): backup.auto (true por defecto) y backup.media (true: con las imágenes).
 *
 *   Backup::create(quién, automática) · maybeWeekly() · scheduleWeekly() · list() · handle(petición, quién) · download(petición) · restore(archivo, forzar, ensayo) · prune()
 */
namespace Torivac;

final class Backup
{
    /** Copias que se conservan (las más recientes). */
    const KEEP = 8;
    /** Segundos entre dos copias automáticas (una semana). */
    const EVERY = 604800;
    /** Segundos que vale un enlace de descarga. */
    const LINK_TTL = 120;
    /** Bytes de imágenes que entran como mucho en una copia (si hay más, se avisa y las que no caben se dejan fuera). */
    const MAX_MEDIA_BYTES = 400000000;
    /** Nombre de un archivo de copia. */
    const NAME = 'backup-[0-9]{8}-[0-9]{6}-[0-9a-f]{4,32}\.jsonl\.gz';
    /** Claves del almacén que NO entran en una copia (por su comienzo). */
    const SKIP = ['rl:', 'pin:', 'lgidx:', 'auth:decoy', 'backup:'];

    /** Si es false, scheduleWeekly() no programa nada (lo desactivan las pruebas para que no se creen copias al terminar el proceso). */
    public static $scheduling = true;

    // ───────────────────────────────────────── [AJUSTES Y RUTAS]
    /** ¿Están activas las copias automáticas semanales? (config backup.auto; sí por defecto). */
    public static function enabled(): bool
    {
        $v = Config::get('backup.auto', true);
        return !(is_string($v) ? in_array(strtolower(trim($v)), ['false', 'off', '0', 'no'], true) : $v === false);
    }

    /** ¿Entran las imágenes del blog en la copia? (config backup.media; sí por defecto). */
    public static function includeMedia(): bool
    {
        $v = Config::get('backup.media', true);
        return !(is_string($v) ? in_array(strtolower(trim($v)), ['false', 'off', '0', 'no'], true) : $v === false);
    }

    /** Carpeta de las copias dentro de la carpeta de datos. */
    public static function dir(): string { return Store::root() . '/backups'; }

    /** Ruta de un archivo de copia por su nombre, o null si el nombre no es el de una copia (nada de rutas ni nombres raros). */
    public static function path(string $file): ?string { return preg_match('/^' . self::NAME . '$/D', $file) === 1 ? self::dir() . '/' . $file : null; }

    /** ¿Es la ruta de descarga de una copia (/backups/<archivo>)? */
    public static function isDownloadPath(string $path): bool { return preg_match('#^/backups/' . self::NAME . '$#D', $path) === 1; }

    // ───────────────────────────────────────── [LISTA]
    /** Las copias que hay, la más reciente primero: file, size, at (ISO), by, auto, keys, media. Solo cuenta las que tienen su archivo. */
    public static function list(): array
    {
        $out = [];
        foreach (glob(self::dir() . '/backup-*.jsonl.gz') ?: [] as $f) {
            $name = basename($f);
            if (self::path($name) === null) continue;
            $meta = json_decode((string) @file_get_contents($f . '.json'), true);
            $meta = is_array($meta) ? $meta : [];
            $at = is_string($meta['at'] ?? null) ? $meta['at'] : gmdate('Y-m-d\TH:i:s\Z', (int) @filemtime($f));
            $out[] = ['file' => $name, 'size' => (int) @filesize($f), 'at' => $at, 'by' => (string) ($meta['by'] ?? ''), 'auto' => !empty($meta['auto']), 'keys' => (int) ($meta['keys'] ?? 0), 'media' => (int) ($meta['media'] ?? 0)];
        }
        usort($out, function ($a, $b) { return strcmp($b['file'], $a['file']); });
        return $out;
    }

    /** Borra las copias más antiguas y deja las KEEP más recientes. Devuelve cuántas borró. */
    public static function prune(): int
    {
        $n = 0;
        foreach (array_slice(self::list(), self::KEEP) as $b) {
            $p = self::path($b['file']);
            if ($p !== null && @unlink($p)) { @unlink($p . '.json'); $n++; }
        }
        return $n;
    }

    // ───────────────────────────────────────── [CREAR]
    /** ¿Es una clave que no entra en la copia? */
    private static function skipped(string $key): bool
    {
        foreach (self::SKIP as $p) if (strncmp($key, $p, strlen($p)) === 0) return true;
        return false;
    }

    /**
     * Hace una copia ahora. `$by` es quién la pide (correo o «sistema»). Si ya se está haciendo otra, no empieza (409). Se escribe en un archivo temporal y solo al terminar se pone con su nombre:
     * nunca queda una copia a medias con nombre de copia.
     * @return array{file?:string,size?:int,keys?:int,media?:int,skipped_media?:int,error?:string,status?:int}
     */
    public static function create(string $by, bool $auto = false): array
    {
        $dir = self::dir();
        if (!is_dir($dir)) {
            if (!@mkdir($dir, Store::DIR_MODE, true) && !is_dir($dir)) return ['error' => 'No se puede crear la carpeta de copias', 'status' => 500];
            @chmod($dir, Store::DIR_MODE);
        }
        $lk = @fopen(Store::root() . '/locks/backup.lock', 'c');
        if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { if ($lk) fclose($lk); return ['error' => 'Ya se está haciendo una copia: espera un momento', 'status' => 409]; }
        $tmp = $dir . '/.tmp-' . bin2hex(random_bytes(4));
        try {
            $gz = @gzopen($tmp, 'wb6');
            if (!$gz) return ['error' => 'No se puede escribir la copia (¿falta espacio en el servidor?)', 'status' => 500];
            gzwrite($gz, Util::enc(['torivac_backup' => 1, 'created' => Util::iso(), 'by' => $by, 'auto' => $auto]) . "\n");
            $keys = 0;
            foreach (glob(Store::root() . '/kv/*.json') ?: [] as $f) {
                $key = rawurldecode(substr(basename($f), 0, -5));
                if (self::skipped($key)) continue;
                $o = json_decode((string) @file_get_contents($f), true);
                if (!is_array($o) || !array_key_exists('v', $o) || (isset($o['x']) && $o['x'] < time())) continue;
                gzwrite($gz, Util::enc(['k' => $key, 'v' => $o['v']] + (isset($o['x']) ? ['x' => (int) $o['x']] : [])) . "\n");
                $keys++;
            }
            $media = 0;
            $left = 0;
            $bytes = 0;
            if (self::includeMedia()) foreach (glob(Blog::mediaDir() . '/*') ?: [] as $f) {
                $name = basename($f);
                if (preg_match(Blog::MEDIA_RE, $name) !== 1 || !is_file($f)) continue;
                $size = (int) @filesize($f);
                if ($bytes + $size > self::MAX_MEDIA_BYTES) { $left++; continue; }
                $raw = @file_get_contents($f);
                if ($raw === false) continue;
                gzwrite($gz, Util::enc(['m' => $name, 'b64' => base64_encode($raw)]) . "\n");
                $bytes += $size;
                $media++;
            }
            gzwrite($gz, Util::enc(['end' => 1, 'keys' => $keys, 'media' => $media]) . "\n");
            gzclose($gz);
            $name = 'backup-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(16)) . '.jsonl.gz';
            @chmod($tmp, Store::FILE_MODE);
            if (!@rename($tmp, $dir . '/' . $name)) { @unlink($tmp); return ['error' => 'No se pudo guardar la copia', 'status' => 500]; }
            $size = (int) @filesize($dir . '/' . $name);
            @file_put_contents($dir . '/' . $name . '.json', Util::enc(['at' => gmdate('Y-m-d\TH:i:s\Z'), 'by' => $by, 'auto' => $auto, 'keys' => $keys, 'media' => $media, 'skipped_media' => $left]));
            @chmod($dir . '/' . $name . '.json', Store::FILE_MODE);
            self::prune();
            return ['file' => $name, 'size' => $size, 'keys' => $keys, 'media' => $media, 'skipped_media' => $left];
        } catch (\Throwable $e) {
            @unlink($tmp);
            error_log('torivac-api: copia de seguridad: ' . mb_substr($e->getMessage(), 0, 200));
            return ['error' => 'No se pudo hacer la copia de seguridad', 'status' => 500];
        } finally {
            flock($lk, LOCK_UN);
            fclose($lk);
        }
    }

    /** Hace la copia semanal si hace falta: han pasado EVERY segundos desde la última (o no hay ninguna) y no se intentó hace menos de una hora (para no repetir un fallo sin parar). Nunca lanza. */
    public static function maybeWeekly(string $by = 'sistema'): ?array
    {
        try {
            if (!self::enabled() || Store::root() === '') return null;
            $last = self::list()[0]['at'] ?? null;
            if ($last !== null && time() - (int) strtotime($last) < self::EVERY) return null;
            $a = Store::get('backup:attempt');
            if (is_int($a) && time() - $a < 3600) return null;
            Store::put('backup:attempt', time(), 7200);
            $r = self::create($by, true);
            if (isset($r['error'])) { error_log('torivac-api: copia semanal no hecha: ' . $r['error']); return null; }
            Audit::log('backup.auto', ['sub' => 'sistema', 'role' => ''], null, $r['file'] . ' · ' . $r['keys'] . ' registros, ' . $r['media'] . ' imágenes');
            return $r;
        } catch (\Throwable $e) {
            error_log('torivac-api: copia semanal: ' . mb_substr($e->getMessage(), 0, 160));
            return null;
        }
    }

    /** Programa la copia semanal para cuando se haya enviado la respuesta (sin hacer esperar a quien entra al panel): con PHP-FPM la respuesta ya salió; con otros PHP, tarda unos segundos más. */
    public static function scheduleWeekly(): void
    {
        if (!self::$scheduling || !self::enabled()) return;
        register_shutdown_function(function () {
            if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
            self::maybeWeekly('sistema');
        });
    }

    // ───────────────────────────────────────── [API] solo managers
    /** Token de un enlace de descarga: caducidad.correo.firma (HMAC con session_secret, ligado al archivo y a quien lo pidió). */
    public static function link(string $file, string $email, ?int $now = null): ?string
    {
        $secret = Auth::sessionSecret();
        if ($secret === null) return null;
        $exp = ($now ?? time()) + self::LINK_TTL;
        return $exp . '.' . Util::b64url($email) . '.' . hash_hmac('sha256', 'backup|' . $file . '|' . $exp . '|' . $email, $secret);
    }

    /** Comprueba un token de descarga para ese archivo → el correo de quien pidió el enlace, o null si es falso, de otro archivo o caducó. */
    public static function verifyLink($token, string $file, ?int $now = null): ?string
    {
        $secret = Auth::sessionSecret();
        if ($secret === null || !is_string($token) || !preg_match('/^(\d{9,11})\.([A-Za-z0-9_-]{1,300})\.([0-9a-f]{64})$/D', $token, $m)) return null;
        $email = Util::unb64url($m[2]);
        if ($email === '' || (int) $m[1] < ($now ?? time())) return null;
        return hash_equals(hash_hmac('sha256', 'backup|' . $file . '|' . $m[1] . '|' . $email, $secret), $m[3]) ? $email : null;
    }

    /** Un 4xx/5xx con su mensaje. */
    private static function err(string $msg, int $status): Response { return new Response(['ok' => false, 'error' => $msg], $status); }

    /**
     * GET /backups (lista y estado) · POST /backups (crear ahora; 6 por hora y manager) · POST /backups/<archivo>/link (enlace de descarga de 2 minutos) · DELETE /backups/<archivo>.
     * El que llama ya es un manager (lo comprueba el Router).
     */
    public static function handle(Request $req, array $who): Response
    {
        $p = $req->path;
        $m = $req->method;
        if ($p === '/backups' && $m === 'GET') {
            $list = self::list();
            $next = $list ? gmdate('Y-m-d\TH:i:s\Z', (int) strtotime($list[0]['at']) + self::EVERY) : null;
            return new Response(['ok' => true, 'backups' => $list, 'auto' => self::enabled(), 'media' => self::includeMedia(), 'keep' => self::KEEP, 'next' => self::enabled() ? $next : null]);
        }
        if ($p === '/backups' && $m === 'POST') {
            if (!RateLimit::hit('bkmake', (string) $who['sub'], 6, 3600000)['allowed']) return self::err('Demasiadas copias seguidas. Espera un rato.', 429);
            $r = self::create((string) $who['sub'], false);
            return isset($r['error']) ? self::err($r['error'], $r['status'] ?? 500) : new Response(['ok' => true, 'backup' => $r]);
        }
        if (preg_match('#^/backups/(' . self::NAME . ')/link$#D', $p, $x) && $m === 'POST') {
            if (!is_file((string) self::path($x[1]))) return self::err('No existe esa copia', 404);
            $t = self::link($x[1], (string) $who['sub']);
            return $t === null ? self::err('Configuración insegura: session_secret', 500) : new Response(['ok' => true, 'file' => $x[1], 'token' => $t, 'expires_in' => self::LINK_TTL]);
        }
        if (self::isDownloadPath($p) && $m === 'DELETE') {
            $f = (string) self::path(basename($p));
            if (!is_file($f)) return self::err('No existe esa copia', 404);
            @unlink($f);
            @unlink($f . '.json');
            return new Response(['ok' => true]);
        }
        return self::err('No encontrado', 404);
    }

    /** GET /backups/<archivo>?t=<token>: envía el archivo de la copia si el enlace es válido (lo firmó un manager hace menos de 2 minutos). 30 intentos por hora y visitante; no se distingue «no existe» de «enlace malo». */
    public static function download(Request $req): Response
    {
        $ipk = Request::ipKey($req->ip);
        if (!RateLimit::hit('bkdl', $ipk, 30, 3600000)['allowed']) return self::err('Demasiados intentos. Espera un rato.', 429);
        $file = basename($req->path);
        $email = self::verifyLink($req->query['t'] ?? null, $file);
        $path = self::path($file);
        if ($email === null || $path === null || !is_file($path)) return self::err('Enlace no válido o caducado', 403);
        Audit::log('backup.download', ['sub' => $email, 'role' => 'manager'], $req, $file);
        $r = new Response([], 200, ['Content-Type' => 'application/gzip', 'Content-Disposition' => 'attachment; filename="' . $file . '"', 'Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff']);
        $r->file = $path;
        return $r;
    }

    // ───────────────────────────────────────── [RESTAURAR]
    /**
     * Restaura una copia en la carpeta de datos actual (lo usa tools/restore.php). Comprueba que el archivo está completo (tiene su cierre y los recuentos coinciden) ANTES de escribir nada.
     * Si la carpeta ya tiene datos (usuarios o pedidos), solo escribe con `$force`; entonces sobrescribe los datos que vienen en la copia y deja los demás. `$dry`: solo cuenta, no escribe.
     * @return array{keys?:int,media?:int,written?:int,error?:string,existing?:bool}
     */
    public static function restore(string $file, bool $force = false, bool $dry = false): array
    {
        $gz = @gzopen($file, 'rb');
        if (!$gz) return ['error' => 'No se puede abrir el archivo de la copia'];
        $head = null;
        $end = null;
        $keys = 0;
        $media = 0;
        $items = [];
        while (($line = gzgets($gz)) !== false) {
            $o = json_decode($line, true);
            if (!is_array($o)) continue;
            if (isset($o['torivac_backup'])) { $head = $o; continue; }
            if (isset($o['end'])) { $end = $o; continue; }
            if (isset($o['k']) && array_key_exists('v', $o) && is_string($o['k']) && preg_match('/^[\x21-\x7e]{1,300}$/D', $o['k']) && !self::skipped($o['k'])) { $keys++; continue; }
            if (isset($o['m'], $o['b64']) && is_string($o['m']) && preg_match(Blog::MEDIA_RE, $o['m']) === 1) $media++;
        }
        gzclose($gz);
        if ($head === null || $end === null || (int) $end['keys'] !== $keys || (int) $end['media'] !== $media) return ['error' => 'La copia está incompleta o dañada: no se restaura nada'];
        $existing = (bool) (Store::keys('user:') || Store::names('order:'));
        if ($existing && !$force) return ['error' => 'La carpeta de datos ya tiene datos (usuarios o pedidos): usa --force para sobrescribir con la copia', 'existing' => true, 'keys' => $keys, 'media' => $media];
        if ($dry) return ['keys' => $keys, 'media' => $media, 'written' => 0, 'existing' => $existing];
        $written = 0;
        $gz = gzopen($file, 'rb');
        while (($line = gzgets($gz)) !== false) {
            $o = json_decode($line, true);
            if (!is_array($o)) continue;
            if (isset($o['k']) && array_key_exists('v', $o) && is_string($o['k']) && preg_match('/^[\x21-\x7e]{1,300}$/D', $o['k']) && !self::skipped($o['k'])) {
                $ttl = isset($o['x']) ? (int) $o['x'] - time() : null;
                if ($ttl !== null && $ttl < 1) continue;
                Store::put($o['k'], $o['v'], $ttl);
                $written++;
            } elseif (isset($o['m'], $o['b64']) && is_string($o['m']) && preg_match(Blog::MEDIA_RE, $o['m']) === 1) {
                $bin = base64_decode((string) $o['b64'], true);
                if ($bin === false || @getimagesizefromstring($bin) === false) continue;
                $dir = Blog::mediaDir();
                if (!is_dir($dir) && !@mkdir($dir, Store::DIR_MODE, true) && !is_dir($dir)) continue;
                if (@file_put_contents($dir . '/' . $o['m'], $bin) !== false) { @chmod($dir . '/' . $o['m'], Store::FILE_MODE); $written++; }
            }
        }
        gzclose($gz);
        return ['keys' => $keys, 'media' => $media, 'written' => $written, 'existing' => $existing];
    }
}
