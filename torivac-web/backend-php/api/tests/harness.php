<?php
/**
 * [TESTS] Mini arnés de pruebas sin dependencias (no hace falta PHPUnit en el hosting):
 *   php tests/run.php            ejecuta todas las pruebas de tests/*Test.php
 * Cada fichero define funciones test_*; assertSame/assertTrue/assertThrows comparan y cuentan.
 */
namespace Torivac\Tests;

final class T
{
    public static $pass = 0;
    public static $fail = 0;
    public static $name = '';

    public static function same($expected, $actual, string $msg = ''): void
    {
        $e = json_encode($expected, JSON_UNESCAPED_UNICODE);
        $a = json_encode($actual, JSON_UNESCAPED_UNICODE);
        if ($e === $a) { self::$pass++; return; }
        self::$fail++;
        fwrite(STDERR, "  ✗ " . self::$name . ($msg ? " · $msg" : '') . "\n      esperado: $e\n      obtenido: $a\n");
    }

    public static function true($cond, string $msg = ''): void
    {
        if ($cond) { self::$pass++; return; }
        self::$fail++;
        fwrite(STDERR, "  ✗ " . self::$name . ($msg ? " · $msg" : '') . "\n");
    }

    public static function throws(callable $fn, string $pattern, string $msg = ''): void
    {
        try { $fn(); } catch (\Throwable $e) {
            if (preg_match($pattern, $e->getMessage())) { self::$pass++; return; }
            self::$fail++;
            fwrite(STDERR, "  ✗ " . self::$name . " · mensaje inesperado: " . $e->getMessage() . "\n");
            return;
        }
        self::$fail++;
        fwrite(STDERR, "  ✗ " . self::$name . " · no lanzó excepción" . ($msg ? " ($msg)" : '') . "\n");
    }
}
