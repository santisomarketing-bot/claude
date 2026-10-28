<?php
/**
 * [REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP del visitante) + respuesta JSON + CORS + límite de uso.
 * Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake).
 * [CLIENT-IP] La IP del visitante sale de REMOTE_ADDR; solo si quien conecta es un proxy de confianza (una red privada, la propia dirección del servidor, Cloudflare
 * o lo que pongas en `trusted_proxies`) se lee la cadena X-Forwarded-For de derecha a izquierda. Así funciona detrás del nginx de Plesk y nadie puede falsear su IP con cabeceras.
 * [IP-KEY] TODO límite por visitante usa Request::ipKey(): una IPv4 tal cual y una IPv6 agrupada por su /64 (quien tiene un /64 controla todas sus direcciones: sin agrupar,
 * cada una sería un contador nuevo y el límite no serviría). Los contadores (RateLimit) guardan su estado bajo una clave de longitud fija: rl:<cubo>:<sha256 del id>.
 */
namespace Torivac;

final class Request
{
    /** Redes privadas y locales: un proxy de la propia máquina (nginx delante de Apache en Plesk) o de la red interna. */
    const PRIVATE_NETS = ['127.0.0.0/8', '::1/128', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', 'fc00::/7', 'fe80::/10'];
    /** Redes de Cloudflare (https://www.cloudflare.com/ips-v4 y /ips-v6): si la web va detrás de su proxy, quien conecta es uno de sus servidores. */
    const CLOUDFLARE_NETS = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];

    /** Tope del cuerpo de una petición (6 MB): se lee como mucho esto, diga lo que diga Content-Length (o aunque no venga, con transferencia por trozos). */
    const MAX_BODY = 6000000;
    /** Anidamiento máximo del JSON que se acepta (más profundo = petición no válida). */
    const JSON_DEPTH = 32;

    public $method = 'GET';
    public $path = '/';
    public $headers = [];
    public $body = '';
    public $ip = '0.0.0.0';
    public $query = [];

    /** construye la petición real a partir de $_SERVER; la ruta es lo que sigue a «/api» */
    public static function fromGlobals(): self
    {
        $r = new self();
        $r->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $p = preg_match('#/api(?=/|$)#', $uri, $m, PREG_OFFSET_CAPTURE) ? substr($uri, $m[0][1] + 4) : $uri;   // «/prueba/api/prices» → «/prices» (la web puede vivir en una subcarpeta)
        $r->path = rtrim($p === '' ? '/' : $p, '/') ?: '/';
        foreach ($_SERVER as $k => $v) {
            if (Util::startsWith($k, 'HTTP_')) $r->headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string) $v;
        }
        if (isset($_SERVER['CONTENT_TYPE'])) $r->headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        if (!isset($r->headers['authorization']) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $r->headers['authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        $r->body = self::readBody();
        $r->ip = self::clientIp((string) ($_SERVER['REMOTE_ADDR'] ?? ''), $r->headers, self::proxyList($_SERVER));
        parse_str($_SERVER['QUERY_STRING'] ?? '', $r->query);
        return $r;
    }

    /**
     * Lee el cuerpo de la petición (por defecto php://input) con un tope REAL: como mucho MAX_BODY + 1 bytes pasan a memoria, diga lo que diga Content-Length o aunque no lo diga
     * (transferencia por trozos). Un cuerpo que pase de MAX_BODY llega con MAX_BODY + 1 bytes y json() lo rechaza.
     */
    public static function readBody(string $source = 'php://input'): string
    {
        return (string) file_get_contents($source, false, null, 0, self::MAX_BODY + 1);
    }

    /**
     * Proxies de confianza además de las redes privadas y Cloudflare: los de config `trusted_proxies` (lista o texto separado por comas) y la propia dirección
     * del servidor (SERVER_ADDR): el nginx de Plesk, si conecta a Apache por la IP pública de la máquina, llega con esa IP como origen.
     */
    public static function proxyList(array $server): array
    {
        $cfg = Config::get('trusted_proxies', []);
        $list = is_string($cfg) ? array_filter(array_map('trim', explode(',', $cfg))) : (array) $cfg;
        $self = self::normalizeIp((string) ($server['SERVER_ADDR'] ?? ''));
        if ($self !== null) $list[] = $self;
        return array_values(array_map('strval', $list));
    }

    /** Una IP escrita de cualquier forma (con corchetes, con puerto, IPv4 dentro de IPv6…) en su forma normal; null si no es una IP. */
    public static function normalizeIp(string $s): ?string
    {
        $s = trim($s);
        if (preg_match('/^\[([^\]]+)\](?::\d+)?$/', $s, $m)) $s = $m[1];
        elseif (preg_match('/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/', $s, $m)) $s = $m[1];
        $bin = $s === '' ? false : @inet_pton($s);
        if ($bin === false) return null;
        if (strlen($bin) === 16 && substr($bin, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") $bin = substr($bin, 12);       // ::ffff:1.2.3.4 → 1.2.3.4
        return inet_ntop($bin);
    }

    /** True si la IP está dentro de la red `a.b.c.d/n` o `x::/n` (una IP suelta cuenta como red de una sola dirección). */
    public static function inNet(string $ip, string $net): bool
    {
        $parts = explode('/', $net, 2);
        $a = @inet_pton($ip);
        $b = @inet_pton($parts[0]);
        if ($a === false || $b === false || strlen($a) !== strlen($b)) return false;
        $bits = isset($parts[1]) ? max(0, min(strlen($b) * 8, (int) $parts[1])) : strlen($b) * 8;
        $bytes = intdiv($bits, 8);
        if ($bytes && strncmp($a, $b, $bytes) !== 0) return false;
        $rest = $bits % 8;
        if ($rest) {
            $mask = (0xFF << (8 - $rest)) & 0xFF;
            if ((ord($a[$bytes]) & $mask) !== (ord($b[$bytes]) & $mask)) return false;
        }
        return true;
    }

    /** True si `$ip` es un proxy de confianza: red privada o local, Cloudflare o una de las redes extra de `trusted_proxies`. */
    public static function isTrustedProxy(string $ip, array $extra = []): bool
    {
        foreach (array_merge(self::PRIVATE_NETS, self::CLOUDFLARE_NETS, array_map('strval', array_values($extra))) as $net) if (self::inNet($ip, $net)) return true;
        return false;
    }

    /**
     * IP del visitante. Una conexión directa NO se puede falsear con cabeceras (se usa REMOTE_ADDR tal cual). Solo si quien conecta es un proxy de confianza
     * se mira detrás de él: Cloudflare manda la IP en CF-Connecting-IP; los demás proxies (nginx de Plesk) añaden la dirección de quien les llamó al final de
     * X-Forwarded-For, así que se recorre esa cadena de derecha a izquierda y se toma la primera dirección que no sea de un proxy de confianza: lo que el
     * visitante escriba más a la izquierda no cuenta. Si toda la cadena es de confianza (una red interna), vale la primera. En Plesk lo normal es que Apache
     * (mod_remoteip) ya entregue la IP real en REMOTE_ADDR y nada de esto haga falta; es la red de seguridad cuando no lo hace.
     * `$headers` lleva los nombres en minúsculas; `$extra`, redes o IP de proxies propios (ver proxyList).
     */
    public static function clientIp(string $remote, array $headers, array $extra = []): string
    {
        $peer = self::normalizeIp($remote);
        if ($peer === null) return '0.0.0.0';
        if (!self::isTrustedProxy($peer, $extra)) return $peer;
        $cf = self::normalizeIp((string) ($headers['cf-connecting-ip'] ?? ''));
        if ($cf !== null) foreach (self::CLOUDFLARE_NETS as $net) if (self::inNet($peer, $net)) return $cf;
        $chain = [];
        foreach (explode(',', (string) ($headers['x-forwarded-for'] ?? '')) as $part) {
            $ip = self::normalizeIp($part);
            if ($ip !== null) $chain[] = $ip;
        }
        $chain[] = $peer;
        for ($i = count($chain) - 1; $i >= 0; $i--) if (!self::isTrustedProxy($chain[$i], $extra)) return $chain[$i];
        return $chain[0];
    }

    /**
     * Clave de límite por visitante: una IPv4 tal cual; una IPv6, su /64 en forma canónica «xxxx:xxxx:xxxx:xxxx::/64» (hextetos de 4 dígitos en minúsculas); una IPv4 escrita
     * como IPv6 (::ffff:a.b.c.d o ::ffff:hhhh:hhhh), la IPv4; lo ilegible o vacío, «0». Casos compartidos con el Worker: shared/ip-key.fixtures.json.
     */
    public static function ipKey(string $ip): string
    {
        $s = trim($ip);
        $z = strpos($s, '%');
        if ($z !== false) $s = substr($s, 0, $z);                                            // zona de una IPv6 (fe80::1%eth0)
        $n = self::normalizeIp($s);
        $bin = $n === null ? false : @inet_pton($n);
        if ($bin === false) return '0';
        if (strlen($bin) === 4) return (string) $n;
        $h = unpack('n4', substr($bin, 0, 8));
        return sprintf('%04x:%04x:%04x:%04x::/64', $h[1], $h[2], $h[3], $h[4]);
    }

    /** petición simulada para pruebas */
    public static function fake(string $method, string $path, $body = null, array $headers = [], string $ip = '10.0.0.1'): self
    {
        $r = new self();
        $r->method = $method;
        if (($q = strpos($path, '?')) !== false) { parse_str(substr($path, $q + 1), $r->query); $path = substr($path, 0, $q); }          // «/messages?limit=5»: la ruta por un lado y los parámetros por otro, como en una petición real
        $r->path = $path;
        foreach ($headers as $k => $v) $r->headers[strtolower($k)] = $v;
        $r->body = $body === null ? '' : (is_string($body) ? $body : Util::enc($body));
        $r->ip = $ip;
        return $r;
    }

    /** Valor de una cabecera de la petición (nombre sin distinguir mayúsculas); cadena vacía si no existe. */
    public function header(string $name): string { return $this->headers[strtolower($name)] ?? ''; }

    /** cuerpo JSON como array (null si no es válido, está anidado a más de 32 niveles o supera el límite de bytes) */
    public function json(int $maxBytes = self::MAX_BODY): ?array
    {
        if (strlen($this->body) > min($maxBytes, self::MAX_BODY)) return null;
        $j = json_decode($this->body, true, self::JSON_DEPTH + 1);                              // el «depth» de PHP cuenta también el nivel de los valores sueltos: para admitir 32 niveles de listas u objetos hace falta 33
        return is_array($j) ? $j : null;
    }

    /** Token de la cabecera «Authorization: Bearer …», o null. */
    public function bearer(): ?string
    {
        return preg_match('/^Bearer\s+(.+)$/i', $this->header('authorization'), $m) ? trim($m[1]) : null;
    }
}

/** Respuesta lista para enviar o para inspeccionar en pruebas */
final class Response
{
    public $status;
    public $body;
    public $headers;

    /** Respuesta con cuerpo JSON, código HTTP y cabeceras (por defecto JSON UTF-8 y sin caché). */
    public function __construct(array $body, int $status = 200, array $headers = [])
    {
        $this->status = $status;
        $this->body = $body;
        $this->headers = $headers + ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'];
    }

    /** Envía código, cabeceras y cuerpo JSON (sin cuerpo en 204 y 304). Si el cuerpo no se puede codificar responde un 500 genérico con un id (el detalle va al registro). */
    public function send(): void
    {
        $status = $this->status;
        $out = '';
        if ($status !== 204 && $status !== 304) {
            try { $out = Util::enc($this->body); }
            catch (\Throwable $e) {
                $id = bin2hex(random_bytes(4));
                error_log('torivac-api[' . $id . ']: respuesta que no se puede codificar: ' . $e->getMessage());
                $status = 500;
                $out = '{"ok":false,"error":"Error interno","id":"' . $id . '"}';
            }
        }
        http_response_code($status);
        foreach ($this->headers as $k => $v) header($k . ': ' . $v);
        echo $out;
    }
}

/** [CORS] Mismo origen siempre permitido; otros orígenes solo si están en config allowed_origins */
final class Cors
{
    /** Dice si un origen puede usar el API: el propio sitio, las peticiones sin Origin o los de allowed_origins. */
    public static function allowed(?string $origin, ?string $host = null): bool
    {
        if ($origin === null || $origin === '') return true;                       // servidor a servidor / curl
        $host = $host ?? ($_SERVER['HTTP_HOST'] ?? '');
        $o = parse_url($origin);
        if ($o && isset($o['host']) && $host !== '') {
            $oh = $o['host'] . (isset($o['port']) ? ':' . $o['port'] : '');
            if (strcasecmp($oh, $host) === 0) return true;                         // la propia web
        }
        $list = Config::get('allowed_origins', []);
        if (is_string($list)) $list = array_filter(array_map('trim', explode(',', $list)));
        return in_array($origin, (array) $list, true);
    }

    /** Cabeceras CORS para un origen permitido. */
    public static function headers(string $origin): array
    {
        return ['Access-Control-Allow-Origin' => $origin, 'Access-Control-Allow-Methods' => 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers' => 'Content-Type,Authorization', 'Access-Control-Max-Age' => '86400', 'Vary' => 'Origin'];
    }
}

/**
 * [RATE-LIMIT] ventana fija por cubo e identificador (aprox.), con bloqueo para que dos peticiones simultáneas no se pisen.
 * Cada contador vive en la clave rl:<cubo>:<sha256 del identificador, 32 caracteres> (longitud acotada y sin datos personales: un correo de 300 caracteres no rompe el guardado)
 * y los registros caducados se borran «al vuelo» (1 de cada 50 llamadas borra hasta 200), así no crecen sin límite.
 *   hit()      cuenta CADA llamada (intentos, pedidos…) y dice si cabe en el máximo
 *   exceeded() / fail() / clear()   contador de FALLOS (acceso con token erróneo, contraseña mala…): exceeded() mira sin sumar, fail() anota un fallo, clear() lo pone a cero
 */
final class RateLimit
{
    /** Una de cada tantas llamadas aprovecha para borrar registros caducados (0 = nunca; las pruebas lo cambian). */
    public static $purgeOneIn = 50;
    /** Máximo de registros caducados que borra cada limpieza. */
    const PURGE_MAX = 200;

    /** Clave del almacén de un contador: rl:<cubo>:<sha256 del identificador, 32 caracteres>. */
    public static function key(string $bucket, string $id): string { return 'rl:' . $bucket . ':' . Util::sha32($id); }

    /** @return array{allowed:bool,remaining:int,resetAt:int} */
    public static function hit(string $bucket, string $id, int $max = 5, int $windowMs = 600000, ?int $nowMs = null): array
    {
        $now = $nowMs ?? Util::nowMs();
        $key = self::key($bucket, $id);
        $out = Store::locked('rl', function () use ($key, $now, $max, $windowMs) {
            $r = Store::get($key);
            if (!is_array($r) || !isset($r['resetAt'], $r['count']) || $r['resetAt'] <= $now) $r = ['count' => 0, 'resetAt' => $now + $windowMs];
            $r['count']++;
            Store::put($key, $r, max(60, (int) ceil(($r['resetAt'] - $now) / 1000)));
            return ['allowed' => $r['count'] <= $max, 'remaining' => max(0, $max - $r['count']), 'resetAt' => $r['resetAt']];
        });
        self::maybePurge();
        return $out;
    }

    /** ¿Ha llegado el contador de fallos de ese cubo e identificador a `$max` en la ventana actual? No suma nada. */
    public static function exceeded(string $bucket, string $id, int $max, ?int $nowMs = null): bool
    {
        $r = Store::get(self::key($bucket, $id));
        return is_array($r) && isset($r['resetAt'], $r['count']) && $r['resetAt'] > ($nowMs ?? Util::nowMs()) && $r['count'] >= $max;
    }

    /** Anota un fallo (la ventana cuenta desde el primero) y devuelve cuántos lleva en ella. */
    public static function fail(string $bucket, string $id, int $windowMs, ?int $nowMs = null): int
    {
        $now = $nowMs ?? Util::nowMs();
        $key = self::key($bucket, $id);
        $n = Store::locked('rl', function () use ($key, $now, $windowMs) {
            $r = Store::get($key);
            if (!is_array($r) || !isset($r['resetAt'], $r['count']) || $r['resetAt'] <= $now) $r = ['count' => 0, 'resetAt' => $now + $windowMs];
            $r['count']++;
            Store::put($key, $r, max(60, (int) ceil(($r['resetAt'] - $now) / 1000)));
            return (int) $r['count'];
        });
        self::maybePurge();
        return $n;
    }

    /**
     * Anota un fallo de un contador con BLOQUEO: los fallos se cuentan en una ventana de `$windowMs` desde el primero y, al llegar al `$max`-ésimo, el contador queda bloqueado `$lockMs`
     * desde ESE momento (pasado ese tiempo empieza de cero). Un fallo anotado durante el bloqueo no lo alarga. Devuelve cuántos milisegundos de bloqueo quedan (0 = no bloqueado).
     */
    public static function failLock(string $bucket, string $id, int $max, int $windowMs, int $lockMs, ?int $nowMs = null): int
    {
        $now = $nowMs ?? Util::nowMs();
        $key = self::key($bucket, $id);
        $left = Store::locked('rl', function () use ($key, $now, $max, $windowMs, $lockMs) {
            $r = Store::get($key);
            if (is_array($r) && isset($r['lockedUntil']) && $r['lockedUntil'] > $now) return (int) ($r['lockedUntil'] - $now);          // ya bloqueado: no se alarga
            if (!is_array($r) || !isset($r['resetAt'], $r['count']) || $r['resetAt'] <= $now || (isset($r['lockedUntil']) && $r['lockedUntil'] <= $now)) $r = ['count' => 0, 'resetAt' => $now + $windowMs];
            $r['count']++;
            if ($r['count'] >= $max) { $r['lockedUntil'] = $now + $lockMs; $r['resetAt'] = $r['lockedUntil']; }
            Store::put($key, $r, max(60, (int) ceil(($r['resetAt'] - $now) / 1000)));
            return isset($r['lockedUntil']) ? (int) ($r['lockedUntil'] - $now) : 0;
        });
        self::maybePurge();
        return (int) $left;
    }

    /** Milisegundos que le quedan de bloqueo a un contador con bloqueo (failLock); 0 si no está bloqueado. No suma nada. */
    public static function lockedFor(string $bucket, string $id, ?int $nowMs = null): int
    {
        $r = Store::get(self::key($bucket, $id));
        $now = $nowMs ?? Util::nowMs();
        return is_array($r) && isset($r['lockedUntil']) && $r['lockedUntil'] > $now ? (int) ($r['lockedUntil'] - $now) : 0;
    }

    /** Pone a cero el contador de fallos (tras un acceso correcto). */
    public static function clear(string $bucket, string $id): void
    {
        $key = self::key($bucket, $id);
        Store::locked('rl', function () use ($key) { Store::delete($key); });
    }

    /** Borra ahora hasta PURGE_MAX registros de límite caducados; devuelve cuántos. */
    public static function purgeExpired(): int
    {
        return (int) Store::locked('rl', function () { return Store::purgeRl(self::PURGE_MAX); });
    }

    /** Con probabilidad 1/purgeOneIn limpia registros caducados; un fallo al limpiar nunca rompe la petición. */
    private static function maybePurge(): void
    {
        if (self::$purgeOneIn < 1 || random_int(1, self::$purgeOneIn) !== 1) return;
        try { self::purgeExpired(); } catch (\Throwable $e) { /* limpiar es opcional */ }
    }
}
