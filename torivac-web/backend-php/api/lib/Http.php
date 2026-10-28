<?php
/**
 * [HTTP] Cliente HTTP saliente (cURL) para Resend, Anthropic y Google. En las pruebas se sustituye por una función
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
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_HTTPHEADER => $headers,
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return [$resp === false ? 0 : $code, $resp === false ? '' : (string) $resp];
    }
}
