<?php
/** Ejecuta todas las pruebas: php tests/run.php  (código de salida 1 si alguna falla). Con un argumento solo carga los archivos *Test.php cuyo nombre lo contenga: php tests/run.php Blog */
require __DIR__ . '/../lib/autoload.php';
require __DIR__ . '/harness.php';

use Torivac\Tests\T;

$files = glob(__DIR__ . '/*Test.php');
sort($files);
$only = $argv[1] ?? '';
if ($only !== '') $files = array_values(array_filter($files, fn ($f) => stripos(basename($f), $only) !== false));
foreach ($files as $f) {
    require_once $f;
}
foreach (get_defined_functions()['user'] as $fn) {
    if (strpos($fn, 'test_') !== 0 && strpos($fn, '\\test_') === false && !preg_match('/(^|\\\\)test_/', $fn)) continue;
    T::$name = $fn;
    try { $fn(); } catch (\Throwable $e) { T::$fail++; fwrite(STDERR, "  ✗ $fn lanzó " . get_class($e) . ': ' . $e->getMessage() . ' en ' . basename($e->getFile()) . ':' . $e->getLine() . "\n"); }
}
echo 'pruebas PHP: ' . T::$pass . ' comprobaciones correctas, ' . T::$fail . " fallos\n";
exit(T::$fail ? 1 : 0);
