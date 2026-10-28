<?php
/**
 * [HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google (sigue hasta 5 redirecciones de los GET, p. ej. la descarga de Drive). En las pruebas se sustituye por una función
 * (Http::$mock) para no salir a Internet.
 * Defensas (la URL sale de la configuración, pero un salto de la cadena de redirecciones no es de fiar):
 *   · solo http y https, también en las redirecciones (una a file:///etc/… devolvía el contenido de ese fichero);
 *   · tope de tamaño de la respuesta (25 MB): si la hoja o el libro lo supera se corta y se avisa;
 *   · si la URL de partida es un servidor PÚBLICO, una redirección a un servidor que resuelve a una IP privada, de loopback o de enlace local se rechaza (y la conexión se fija
 *     a la IP ya comprobada, para que un DNS que cambie entre la comprobación y la conexión no llegue a una red interna). Si la URL de partida ya es local (las pruebas usan 127.0.0.1) se permite.
 */
namespace Torivac;

final class Http
{
    /** Tamaño máximo de una respuesta descargada: 25 MB. */
    const MAX_BYTES = 25000000;

    /** @var callable|null function(string $method, string $url, array $headers, ?string $body): array{0:int,1:string} */
    public static $mock = null;

    /** @var callable|null function(string $host): string[] — sustituye al DNS (pruebas: nunca se sale a la red) */
    public static $resolver = null;

    /** Direcciones IP de un servidor: la propia si ya es una IP; si no, las que resuelve el DNS (IPv4 e IPv6). Vacío si no resuelve. */
    public static function hostIps(string $host): array
    {
        $host = trim($host, '[]');
        if ($host === '') return [];
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) return [$host];
        if (self::$resolver !== null) return array_values(array_map('strval', (array) call_user_func(self::$resolver, $host)));
        $ips = [];
        $v4 = @gethostbynamel($host);
        if (is_array($v4)) foreach ($v4 as $ip) $ips[] = $ip;
        $v6 = function_exists('dns_get_record') ? @dns_get_record($host, DNS_AAAA) : false;
        if (is_array($v6)) foreach ($v6 as $r) { if (!empty($r['ipv6'])) $ips[] = $r['ipv6']; }
        return $ips;
    }

    /** Redes que filter_var NO marca como privadas y que una redirección tampoco debe alcanzar: compartida de operador (CGNAT), pruebas de IETF, multidifusión e IPv4 «compatible» dentro de IPv6. */
    private const EXTRA_NETS = ['100.64.0.0/10', '192.0.0.0/24', '198.18.0.0/15', '224.0.0.0/4', 'ff00::/8', '::/96'];

    /**
     * ¿Es una IP privada, de loopback, de enlace local o reservada? Las que nunca debe alcanzar una redirección desde un servidor público. Usa filter_var con
     * FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE, pero antes pasa ::ffff:10.0.0.1 a 10.0.0.1 (filter_var da por buena la forma «mapeada») y después mira las IPv4 que
     * van dentro de una IPv6 de NAT64 (64:ff9b::/96) o 6to4 (2002::/16). Lo que no es una IP cuenta como no válido (true).
     */
    public static function isPrivateIp(string $ip): bool
    {
        $n = Request::normalizeIp($ip);
        if ($n === null) return true;
        if (filter_var($n, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return true;
        foreach (self::EXTRA_NETS as $net) { if (Request::inNet($n, $net)) return true; }
        $bin = @inet_pton($n);
        if ($bin !== false && strlen($bin) === 16) {
            if (Request::inNet($n, '64:ff9b::/96')) return self::isPrivateIp((string) inet_ntop(substr($bin, 12, 4)));
            if (Request::inNet($n, '2002::/16')) return self::isPrivateIp((string) inet_ntop(substr($bin, 2, 4)));
        }
        return false;
    }

    /** ¿Alguna de las direcciones de ese servidor es privada o local? */
    public static function isPrivateHost(string $host): bool
    {
        foreach (self::hostIps($host) as $ip) { if (self::isPrivateIp($ip)) return true; }
        return false;
    }

    /**
     * Motivo por el que se rechaza una redirección a `$next` (null = vale): solo http y https; y si la URL de partida era un servidor público (`$initialPublic`), el destino
     * tiene que resolver (`$ips` = sus direcciones) y ninguna puede ser privada o local. Función pura: no resuelve nada.
     */
    public static function redirectProblem(bool $initialPublic, string $next, array $ips): ?string
    {
        $scheme = strtolower((string) parse_url($next, PHP_URL_SCHEME));
        if ($scheme !== 'http' && $scheme !== 'https') return 'Redirección rechazada: solo se siguen enlaces http y https';
        if ((string) parse_url($next, PHP_URL_HOST) === '') return 'Redirección rechazada: la dirección no tiene servidor';
        if ($initialPublic) {
            if (!$ips) return 'Redirección rechazada: no se puede comprobar a qué dirección apunta';                    // sin poder resolverlo no se sabe si es una red interna: falla cerrado
            foreach ($ips as $ip) { if (self::isPrivateIp((string) $ip)) return 'Redirección rechazada: lleva a una dirección privada o local'; }
        }
        return null;
    }

    /**
     * @param string[] $headers líneas «Nombre: valor»
     * @return array{0:int,1:string} [código HTTP, cuerpo]; código 0 = fallo de red. Lanza RuntimeException (502) si una redirección no se admite o la respuesta supera MAX_BYTES.
     */
    public static function request(string $method, string $url, array $headers = [], ?string $body = null, int $timeout = 25): array
    {
        if (self::$mock !== null) return call_user_func(self::$mock, $method, $url, $headers, $body);
        if (!function_exists('curl_init')) throw new \RuntimeException('Falta la extensión cURL de PHP en este hosting');
        $host0 = strtolower(trim((string) parse_url($url, PHP_URL_HOST), '[]'));
        $initialPublic = !self::isPrivateHost($host0);
        $pin = null;
        for ($hop = 0; $hop < 6; $hop++) {                                  // las redirecciones se siguen a mano: con open_basedir algunos PHP rechazan CURLOPT_FOLLOWLOCATION
            $buf = '';
            $over = false;
            $ch = curl_init($url);
            $opts = [
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_MAXFILESIZE => self::MAX_BYTES,
                CURLOPT_WRITEFUNCTION => function ($c, $chunk) use (&$buf, &$over) {          // el cuerpo se acumula aquí, con tope
                    if (strlen($buf) + strlen($chunk) > Http::MAX_BYTES) { $over = true; return 0; }
                    $buf .= $chunk;
                    return strlen($chunk);
                },
            ];
            if ($pin !== null) $opts[CURLOPT_RESOLVE] = [$pin];
            curl_setopt_array($ch, $opts);
            if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            $done = curl_exec($ch);
            $errno = curl_errno($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $next = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL);
            curl_close($ch);
            if ($over || $errno === CURLE_FILESIZE_EXCEEDED) throw new \RuntimeException('La respuesta supera el tamaño permitido (' . (int) (self::MAX_BYTES / 1000000) . ' MB)', 502);
            if ($done === false) return [0, ''];
            if ($next !== '' && $code >= 300 && $code < 400 && strtoupper($method) === 'GET') {
                $nextHost = strtolower(trim((string) parse_url($next, PHP_URL_HOST), '[]'));
                $ips = self::hostIps($nextHost);
                $why = self::redirectProblem($initialPublic, $next, $ips);
                if ($why !== null) throw new \RuntimeException($why, 502);
                if ($nextHost !== $host0) {                                 // a otro servidor no se le manda la credencial
                    $headers = array_values(array_filter($headers, function ($h) { return stripos($h, 'authorization:') !== 0; }));
                }
                $pin = null;
                $v4 = array_values(array_filter($ips, function ($ip) { return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false; }));
                if ($initialPublic && $v4 && filter_var($nextHost, FILTER_VALIDATE_IP) === false) {
                    $port = parse_url($next, PHP_URL_PORT) ?: (strtolower((string) parse_url($next, PHP_URL_SCHEME)) === 'https' ? 443 : 80);
                    $pin = $nextHost . ':' . $port . ':' . implode(',', $v4);
                }
                $url = $next;
                continue;
            }
            return [$code, $buf];
        }
        return [0, ''];
    }
}
