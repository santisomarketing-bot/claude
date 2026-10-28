<?php
/** Autocarga mínima de las clases Torivac\* (cada una vive en lib/; las auxiliares comparten fichero con su clase principal) */
spl_autoload_register(function ($class) {
    if (strpos($class, 'Torivac\\') !== 0) return;
    $map = ['Response' => 'Request', 'Cors' => 'Request', 'RateLimit' => 'Request', 'Users' => 'Auth', 'Sheets' => 'Prices'];
    $short = substr($class, 8);
    $file = __DIR__ . '/' . ($map[$short] ?? $short) . '.php';
    if (is_file($file)) require_once $file;
});
