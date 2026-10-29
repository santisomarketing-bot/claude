<?php
/**
 * [AUDIT] Registro de actividad del panel: quién entró, cuándo y desde dónde, y quién cambió qué (usuarios, precios, propuestas, blog, correo, copias).
 * Un fichero por día (UTC) en <datos>/audit/AAAA-MM-DD.jsonl, una línea JSON por hecho:
 *   { t: ISO, a: acción, u: quién (correo, «master» o «sistema»), r: rol, ip, ua: «Chrome · Windows», d: detalle corto }
 * Seguridad y límites:
 *   · Añadir una línea es atómico (LOCK_EX) y no lee el fichero: el coste no crece con el tamaño.
 *   · Nunca se anotan contraseñas, códigos, tokens ni textos largos: el detalle es una línea de hasta 200 caracteres sin saltos ni caracteres de control (un correo escrito con
 *     «\n» no puede inventar líneas del registro) y se enseña siempre escapado.
 *   · Un fichero diario no pasa de 2 MB (un atacante que provoque miles de hechos no llena el disco): en el último kilobyte se anota una sola línea «limite» y se calla el resto del día.
 *   · Los fallos de contraseña NO se anotan uno a uno (los bloqueos y los avisos sí): una vez por visitante y cuenta cada 10 minutos.
 *   · Se conserva 180 días (purge, lo llama el cron y, de vez en cuando, el propio registro).
 *   · Anotar nunca rompe la petición: cualquier fallo se ignora (va al registro de errores de PHP).
 * Solo los managers lo leen (GET /api/activity). Es un dato personal (correos e IP): ver docs/SEGURIDAD.md.
 *
 *   Audit::log(acción, quién, petición, detalle) · Audit::fromRequest(petición, quién, respuesta) (acciones de los managers, desde el Router)
 *   Audit::read(días, límite, filtros) · Audit::purge() · Audit::label(acción) · Audit::summary(días) (para el Diagnóstico)
 */
namespace Torivac;

final class Audit
{
    /** Días que se conserva el registro. */
    const KEEP_DAYS = 180;
    /** Tamaño máximo de un fichero diario (bytes). */
    const MAX_DAY_BYTES = 2000000;
    /** Largo máximo del detalle de un hecho (caracteres). */
    const MAX_DETAIL = 200;
    /** Hechos que se devuelven como mucho en una lectura. */
    const MAX_READ = 1000;

    /** Nombre en castellano de cada acción: lo que se enseña en el panel. */
    const LABELS = [
        'login.ok' => 'Entró al panel', 'login.fail' => 'Contraseña incorrecta', 'login.locked' => 'Acceso bloqueado una hora', 'login.pin_sent' => 'Código enviado por correo',
        'login.pin_ok' => 'Entró con código', 'login.pin_fail' => 'Código incorrecto', 'login.device' => 'Dispositivo recordado', 'logout' => 'Cerró sesión', 'devices.forget' => 'Olvidó sus dispositivos',
        'alert.repeated' => 'Aviso: intentos repetidos', 'alert.mail_failed' => 'El aviso por correo no se pudo enviar', 'user.create' => 'Usuario creado', 'user.delete' => 'Usuario borrado', 'user.unlock' => 'Cuenta desbloqueada', 'user.two_step' => 'Cambió el código por correo', 'user.password' => 'Cambió una contraseña',
        'prices.upload' => 'Subió una hoja de precios', 'prices.refresh' => 'Sincronizó los precios', 'prices.ai_apply' => 'Aplicó cambios de precios (IA)', 'prices.sync' => 'Sincronización automática de precios',
        'proposal.state' => 'Decidió una propuesta', 'blog.create' => 'Creó una entrada', 'blog.update' => 'Guardó una entrada', 'blog.delete' => 'Borró una entrada', 'blog.image_upload' => 'Subió una imagen',
        'blog.image_delete' => 'Borró una imagen', 'message.delete' => 'Borró un mensaje', 'mail.test' => 'Envió un correo de prueba', 'backup.create' => 'Creó una copia de seguridad',
        'backup.auto' => 'Copia de seguridad automática', 'backup.download' => 'Descargó una copia de seguridad', 'backup.delete' => 'Borró una copia de seguridad', 'limite' => 'Registro lleno por hoy',
    ];

    /** Carpeta del registro dentro de la carpeta de datos. */
    public static function dir(): string { return Store::root() . '/audit'; }

    /** Fichero de un día (AAAA-MM-DD en UTC). */
    private static function file(string $day): string { return self::dir() . '/' . $day . '.jsonl'; }

    /** Nombre legible de una acción (si no se conoce, la propia clave). */
    public static function label(string $action): string { return self::LABELS[$action] ?? $action; }

    /** «Chrome · Windows» a partir de la cabecera User-Agent (solo familia del navegador y del sistema: el texto entero es largo y no aporta). */
    public static function agent(string $ua): string
    {
        if ($ua === '') return '';
        $b = 'Otro';
        foreach (['Edg/' => 'Edge', 'OPR/' => 'Opera', 'Firefox/' => 'Firefox', 'Chrome/' => 'Chrome', 'Safari/' => 'Safari', 'curl/' => 'curl'] as $needle => $name) if (strpos($ua, $needle) !== false) { $b = $name; break; }
        $os = '';
        foreach (['Windows' => 'Windows', 'Android' => 'Android', 'iPhone' => 'iOS', 'iPad' => 'iOS', 'Mac OS X' => 'macOS', 'Linux' => 'Linux'] as $needle => $name) if (strpos($ua, $needle) !== false) { $os = $name; break; }
        return $os === '' ? $b : $b . ' · ' . $os;
    }

    /**
     * Anota un hecho. `$who` es el que lo hace (['sub','role'] como devuelve Auth::authenticate), o null si no hay sesión (un intento de acceso: entonces `$detail` suele llevar el correo).
     * Nunca lanza ni devuelve nada: anotar es opcional para que la petición salga bien.
     */
    public static function log(string $action, ?array $who, ?Request $req = null, string $detail = ''): void
    {
        try {
            if (Store::root() === '') return;
            $dir = self::dir();
            if (!is_dir($dir)) {
                if (!@mkdir($dir, Store::DIR_MODE, true) && !is_dir($dir)) return;
                @chmod($dir, Store::DIR_MODE);
            }
            $now = time();
            $f = self::file(gmdate('Y-m-d', $now));
            $e = [
                't' => gmdate('Y-m-d\TH:i:s\Z', $now), 'a' => $action,
                'u' => Util::line($who['sub'] ?? ($who === null ? '' : 'sistema'), 120), 'r' => (string) ($who['role'] ?? ''),
                'ip' => $req ? Util::line($req->ip, 45) : '', 'ua' => $req ? Util::line(self::agent($req->header('user-agent')), 40) : '', 'd' => Util::line($detail, self::MAX_DETAIL),
            ];
            $size = is_file($f) ? (int) @filesize($f) : 0;
            if ($size >= self::MAX_DAY_BYTES) return;
            if ($who === null && $size >= (int) (self::MAX_DAY_BYTES / 2)) return;                    // lo que hace alguien SIN sesión (intentos de acceso) no puede llenar el día entero: la mitad queda para lo que hacen los managers
            $line = Util::enc($e) . "\n";
            if ($size >= self::MAX_DAY_BYTES - 1000) {                                                // zona final: UNA línea que avisa y se rellena de saltos de línea hasta el tope (vacíos, nadie los lee) para que no entre nada más
                $line = Util::enc(['t' => $e['t'], 'a' => 'limite', 'u' => 'sistema', 'r' => '', 'ip' => '', 'ua' => '', 'd' => 'Se alcanzó el tamaño máximo del registro de hoy: no se anotan más hechos hasta mañana']) . "\n";
                $line .= str_repeat("\n", max(0, self::MAX_DAY_BYTES - $size - strlen($line)));
            }
            $new = !is_file($f);
            @file_put_contents($f, $line, FILE_APPEND | LOCK_EX);
            if ($new) { @chmod($f, Store::FILE_MODE); if (random_int(1, 20) === 1) self::purge(); }
        } catch (\Throwable $ex) {
            error_log('torivac-api: no se pudo anotar en el registro de actividad: ' . mb_substr($ex->getMessage(), 0, 160));
        }
    }

    /** ¿Conviene anotar este fallo de contraseña? Una vez por visitante y cuenta cada 10 minutos (un ataque no llena el registro). */
    public static function worthLoggingFail(string $ipKey, string $email): bool
    {
        try { return RateLimit::hit('auditfail', $ipKey . ':' . $email, 1, 600000)['allowed']; } catch (\Throwable $e) { return false; }
    }

    // ───────────────────────────────────────── [DESDE EL ROUTER] acciones de un manager
    /** Código del hecho y detalle (sin secretos) de una petición de un manager que salió bien, o null si no hay que anotarla. */
    public static function describe(Request $req, Response $res): ?array
    {
        if ($res->status < 200 || $res->status >= 300) return null;
        $m = $req->method;
        $p = $req->path;
        $b = is_array($res->body) ? $res->body : [];
        $in = $m === 'POST' || $m === 'DELETE' ? ($req->json() ?? []) : [];
        $s = function ($v, int $max = 120) { return is_scalar($v) ? Util::line((string) $v, $max) : ''; };
        if ($p === '/users' && $m === 'POST') return ['user.create', $s($in['email'] ?? '') . ' (' . $s($in['role'] ?? '', 10) . ')'];
        if (preg_match('#^/users/([^/]+)$#', $p, $x) && $m === 'DELETE') return ['user.delete', $s(rawurldecode($x[1]))];
        if (preg_match('#^/users/([^/]+)/unlock$#', $p, $x) && $m === 'POST') return ['user.unlock', $s(rawurldecode($x[1]))];
        if (preg_match('#^/users/([^/]+)/two-step$#', $p, $x) && $m === 'POST') return ['user.two_step', $s(rawurldecode($x[1])) . ' → ' . (($in['enabled'] ?? null) === false ? 'sin código' : 'con código')];
        if ($p === '/auth/logout' && $m === 'POST') return ['logout', ''];
        if ($p === '/auth/devices/forget' && $m === 'POST') return ['devices.forget', ''];
        if ($p === '/prices/refresh' && $m === 'POST') return ['prices.refresh', 'modo ' . $s($in['mode'] ?? 'por defecto', 20)];
        if ($p === '/prices/upload' && $m === 'POST' && empty($in['dry_run'])) return ['prices.upload', $s($b['meta']['refs'] ?? '?', 10) . ' referencias · modo ' . $s($b['meta']['mode'] ?? '', 10)];
        if ($p === '/prices/ai/apply' && $m === 'POST') return ['prices.ai_apply', $s($b['applied'] ?? '?', 10) . ' cambios'];
        if ($p === '/proposals/state' && $m === 'POST') return ['proposal.state', $s($in['id'] ?? '', 12) . ' → ' . ($s($in['state'] ?? '', 4) ?: 'pendiente')];
        if ($p === '/blog/posts' && $m === 'POST') return ['blog.create', $s($b['post']['title'] ?? '', 100)];
        if (preg_match('#^/blog/posts/(bp-[0-9a-f]{12})$#', $p, $x)) {
            if ($m === 'POST') return ['blog.update', $s($b['post']['title'] ?? '', 100) . ' · ' . $s($b['post']['status'] ?? '', 12)];
            if ($m === 'DELETE') return ['blog.delete', $x[1]];
        }
        if ($p === '/blog/images' && $m === 'POST') return ['blog.image_upload', $s($b['image']['file'] ?? '', 80)];
        if (preg_match('#^/blog/images/([a-z0-9-]+\.[a-z]+)$#', $p, $x) && $m === 'DELETE') return ['blog.image_delete', $x[1]];
        if (strpos($p, '/messages/') === 0 && $m === 'DELETE') return ['message.delete', $s(rawurldecode(substr($p, 10)), 40)];
        if ($p === '/mail/test' && $m === 'POST') return ['mail.test', $s(implode(', ', (array) ($b['to'] ?? [])), 120) . (!empty($b['sent']) ? ' · enviado' : ' · NO se envió')];
        if ($p === '/backups' && $m === 'POST') return ['backup.create', $s($b['backup']['file'] ?? '', 60)];
        if (preg_match('#^/backups/([A-Za-z0-9._-]+)$#', $p, $x) && $m === 'DELETE') return ['backup.delete', $x[1]];
        return null;
    }

    /** Anota la acción de un manager (o cliente) que acaba de hacer `$req` con la respuesta `$res`, si es de las que se registran. Nunca lanza. */
    public static function fromRequest(Request $req, ?array $who, Response $res): void
    {
        try {
            if ($who === null) return;
            $d = self::describe($req, $res);
            if ($d !== null) self::log($d[0], $who, $req, $d[1]);
        } catch (\Throwable $e) { error_log('torivac-api: registro de actividad: ' . mb_substr($e->getMessage(), 0, 160)); }
    }

    // ───────────────────────────────────────── [LECTURA]
    /** Días (AAAA-MM-DD, el más reciente primero) de los últimos `$days`. */
    private static function days(int $days): array
    {
        $out = [];
        for ($i = 0; $i < max(1, min(self::KEEP_DAYS, $days)); $i++) $out[] = gmdate('Y-m-d', time() - $i * 86400);
        return $out;
    }

    /**
     * Hechos de los últimos `$days` días, el más reciente primero, como mucho `$limit`. Filtros: `u` (parte del correo), `cat` (categoría = lo que va antes del punto de la acción: login, user, prices…) y
     * `q` (texto en el detalle o la acción). Devuelve ['items' => [...], 'truncated' => bool].
     * @return array{items:array,truncated:bool}
     */
    public static function read(int $days = 7, int $limit = 300, array $filters = []): array
    {
        $limit = max(1, min(self::MAX_READ, $limit));
        $u = strtolower(trim((string) ($filters['u'] ?? '')));
        $cat = strtolower(trim((string) ($filters['cat'] ?? '')));
        $q = mb_strtolower(trim((string) ($filters['q'] ?? '')), 'UTF-8');
        $out = [];
        $truncated = false;
        foreach (self::days($days) as $day) {
            $f = self::file($day);
            if (!is_file($f)) continue;
            $lines = @file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            for ($i = count($lines) - 1; $i >= 0; $i--) {
                $e = json_decode($lines[$i], true);
                if (!is_array($e) || !isset($e['t'], $e['a'])) continue;
                if ($u !== '' && strpos(strtolower((string) ($e['u'] ?? '')), $u) === false) continue;
                if ($cat !== '' && strtok((string) $e['a'], '.') !== $cat) continue;
                if ($q !== '' && mb_strpos(mb_strtolower((string) ($e['d'] ?? '') . ' ' . self::label((string) $e['a']), 'UTF-8'), $q) === false) continue;
                if (count($out) >= $limit) { $truncated = true; break 2; }
                $e['label'] = self::label((string) $e['a']);
                $out[] = $e;
            }
        }
        return ['items' => $out, 'truncated' => $truncated];
    }

    /** Resumen para el Diagnóstico: hechos de los últimos 7 días y de cuántos días hay fichero (sin leer más que contar líneas). @return array{events:int,days:int} */
    public static function summary(int $days = 7): array
    {
        $n = 0;
        $d = 0;
        foreach (self::days($days) as $day) {
            $f = self::file($day);
            if (!is_file($f)) continue;
            $d++;
            $n += count(@file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []);
        }
        return ['events' => $n, 'days' => $d];
    }

    /** Borra los ficheros de más de KEEP_DAYS días; devuelve cuántos. Nunca lanza. */
    public static function purge(): int
    {
        $n = 0;
        try {
            $limit = gmdate('Y-m-d', time() - self::KEEP_DAYS * 86400);
            foreach (glob(self::dir() . '/*.jsonl') ?: [] as $f) if (basename($f, '.jsonl') < $limit && @unlink($f)) $n++;
        } catch (\Throwable $e) { /* limpiar es opcional */ }
        return $n;
    }
}
