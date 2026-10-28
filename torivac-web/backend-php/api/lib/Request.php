<?php
/**
 * [REQUEST] Petición entrante (método, ruta tras /api, cabeceras, JSON, IP) + respuesta JSON + CORS + límite de uso.
 * Pensado para que las pruebas puedan construir peticiones sin servidor web (Request::fake).
 */
namespace Torivac;

final class Request
{
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
        $r->ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $fwd = $r->headers['cf-connecting-ip'] ?? '';
        if ($fwd !== '' && filter_var($fwd, FILTER_VALIDATE_IP)) $r->ip = $fwd;
        parse_str($_SERVER['QUERY_STRING'] ?? '', $r->query);
        return $r;
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
