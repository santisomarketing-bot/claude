<?php
/**
 * [HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google (sigue hasta 5 redirecciones de los GET, p. ej. la descarga de Drive). En las pruebas se sustituye por una función
 * (Http::$mock) para no salir a Internet.
 */
namespace Torivac;

final class Http
{
    /** @var callable|null function(string $method, string $url, array $headers, ?string $body): array{0:int,1:string} */
    public static $mock = null;

    /**
     * @param string[] $headers líneas «Nombre: valor»
     * @return array{0:int,1:string} [código HTTP, cuerpo]; código 0 = fallo de red
     */
    public static function request(string $method, string $url, array $headers = [], ?string $body = null, int $timeout = 25): array
    {
        if (self::$mock !== null) return call_user_func(self::$mock, $method, $url, $headers, $body);
        if (!function_exists('curl_init')) throw new \RuntimeException('Falta la extensión cURL de PHP en este hosting');
        $host0 = (string) parse_url($url, PHP_URL_HOST);
        for ($hop = 0; $hop < 6; $hop++) {                                  // las redirecciones se siguen a mano: con open_basedir algunos PHP rechazan CURLOPT_FOLLOWLOCATION
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_HTTPHEADER => $headers,
            ]);
            if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            $resp = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $next = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL);
            curl_close($ch);
            if ($resp === false) return [0, ''];
            if ($next !== '' && $code >= 300 && $code < 400 && strtoupper($method) === 'GET') {
                if ((string) parse_url($next, PHP_URL_HOST) !== $host0) {   // a otro servidor no se le manda la credencial
                    $headers = array_values(array_filter($headers, function ($h) { return stripos($h, 'authorization:') !== 0; }));
                }
                $url = $next;
                continue;
            }
            return [$code, (string) $resp];
        }
        return [0, ''];
    }
}
