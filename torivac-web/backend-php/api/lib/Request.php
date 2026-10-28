<?php
/**
 * [REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP del visitante) + respuesta JSON + CORS + límite de uso.
 * Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake).
 * [CLIENT-IP] La IP del visitante sale de REMOTE_ADDR; solo si quien conecta es un proxy de confianza (una red privada, la propia dirección del servidor, Cloudflare
 * o lo que pongas en `trusted_proxies`) se lee la cadena X-Forwarded-For de derecha a izquierda. Así funciona detrás del nginx de Plesk y nadie puede falsear su IP con cabeceras.
 */
namespace Torivac;

final class Request
{
    /** Redes privadas y locales: un proxy de la propia máquina (nginx delante de Apache en Plesk) o de la red interna. */
    const PRIVATE_NETS = ['127.0.0.0/8', '::1/128', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', 'fc00::/7', 'fe80::/10'];
    /** Redes de Cloudflare (https://www.cloudflare.com/ips-v4 y /ips-v6): si la web va detrás de su proxy, quien conecta es uno de sus servidores. */
    const CLOUDFLARE_NETS = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];

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
        $r->body = (string) file_get_contents('php://input');
        $r->ip = self::clientIp((string) ($_SERVER['REMOTE_ADDR'] ?? ''), $r->headers, self::proxyList($_SERVER));
        parse_str($_SERVER['QUERY_STRING'] ?? '', $r->query);
        return $r;
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

    /** petición simulada para pruebas */
    public static function fake(string $method, string $path, $body = null, array $headers = [], string $ip = '10.0.0.1'): self
    {
        $r = new self();
        $r->method = $method;
        $r->path = $path;
        foreach ($headers as $k => $v) $r->headers[strtolower($k)] = $v;
        $r->body = $body === null ? '' : (is_string($body) ? $body : Util::enc($body));
        $r->ip = $ip;
        return $r;
    }

    /** Valor de una cabecera de la petición (nombre sin distinguir mayúsculas); cadena vacía si no existe. */
    public function header(string $name): string { return $this->headers[strtolower($name)] ?? ''; }

    /** cuerpo JSON como array (null si no es válido o supera el límite) */
    public function json(int $maxBytes = 6000000): ?array
    {
        if (strlen($this->body) > $maxBytes) return null;
        $j = json_decode($this->body, true);
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

    /** Envía código, cabeceras y cuerpo JSON (sin cuerpo en 204 y 304). */
    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $k => $v) header($k . ': ' . $v);
        if ($this->status !== 204 && $this->status !== 304) echo Util::enc($this->body);
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

/** [RATE-LIMIT] ventana fija por cubo e identificador (aprox.), con bloqueo para que dos peticiones simultáneas no se pisen */
final class RateLimit
{
    /** @return array{allowed:bool,remaining:int,resetAt:int} */
    public static function hit(string $bucket, string $id, int $max = 5, int $windowMs = 600000, ?int $nowMs = null): array
    {
        $now = $nowMs ?? Util::nowMs();
        $key = 'rl:' . $bucket . ':' . $id;
        return Store::locked('rl', function () use ($key, $now, $max, $windowMs) {
            $r = Store::get($key);
            if (!is_array($r) || $r['resetAt'] <= $now) $r = ['count' => 0, 'resetAt' => $now + $windowMs];
            $r['count']++;
            Store::put($key, $r, max(60, (int) ceil(($r['resetAt'] - $now) / 1000)));
            return ['allowed' => $r['count'] <= $max, 'remaining' => max(0, $max - $r['count']), 'resetAt' => $r['resetAt']];
        });
    }
}
