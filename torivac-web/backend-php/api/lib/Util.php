<?php
/**
 * [UTIL] Utilidades sin estado: codificaciones, redondeo, escape HTML y comparaciones seguras.
 * Compatible con PHP 7.4 o superior (sin match, str_contains ni argumentos con nombre).
 */
namespace Torivac;

final class Util
{
    /** binario → base64 URL-safe sin relleno */
    public static function b64url(string $bin): string { return rtrim(strtr(base64_encode($bin), '+/', '-_'), '='); }

    /** base64 URL-safe → binario ('' si no es válido) */
    public static function unb64url(string $s): string
    {
        $p = strtr($s, '-_', '+/');
        $p .= str_repeat('=', (4 - strlen($p) % 4) % 4);
        $r = base64_decode($p, true);
        return $r === false ? '' : $r;
    }

    /** importe de línea: 2 decimales (mitad hacia arriba, igual que el navegador y el Worker) */
    public static function round2($n): float { return round((float) $n, 2); }

    /** precio unitario: 4 decimales (variaciones de céntimos) */
    public static function round4($n): float { return round((float) $n, 4); }

    /** escape para HTML */
    public static function esc($v): string { return htmlspecialchars((string) ($v === null ? '' : $v), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

    /** comparación en tiempo constante */
    public static function eq($a, $b): bool { return hash_equals((string) $a, (string) $b); }

    public static function startsWith(string $h, string $n): bool { return $n === '' || strncmp($h, $n, strlen($n)) === 0; }

    /** milisegundos desde 1970 */
    public static function nowMs(): int { return (int) floor(microtime(true) * 1000); }

    /** ISO 8601 con milisegundos y Z, como JavaScript (new Date().toISOString()) */
    public static function iso(?float $t = null): string
    {
        $t = $t ?? microtime(true);
        return gmdate('Y-m-d\TH:i:s', (int) floor($t)) . sprintf('.%03dZ', (int) (($t - floor($t)) * 1000));
    }

    /** un array vacío debe salir como {} en JSON (no como []): lo necesitan items de precios y mapas */
    public static function obj(array $a)
    {
        return $a ? $a : new \stdClass();
    }

    /** JSON legible y fiel: sin escapar tildes ni barras */
    public static function enc($v): string
    {
        $s = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        return $s === false ? 'null' : $s;
    }

    /** cadena limpia de caracteres de control y recortada */
    public static function clean($s, int $max): string
    {
        $s = preg_replace('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', '', (string) ($s === null ? '' : $s));
        $s = trim((string) $s);
        return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
    }

    /** ¿es una lista (array indexado 0..n-1)? (array_is_list existe solo desde PHP 8.1) */
    public static function isList($a): bool
    {
        if (!is_array($a)) return false;
        $i = 0;
        foreach ($a as $k => $_) { if ($k !== $i++) return false; }
        return true;
    }
}
