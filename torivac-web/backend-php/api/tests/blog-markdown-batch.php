<?php
/**
 * [BLOG-MD] Ejecutor por lotes para comparar PHP con JavaScript: php blog-markdown-batch.php entradas.json
 * Lee una lista de {md, n} y escribe en la salida estándar, en JSON, las salidas de BlogMarkdown (render, toPlain, excerpt, lead) y cuántas veces falló PCRE. Lo usa scripts/test-blog-markdown-php.mjs.
 */
require __DIR__ . '/../lib/autoload.php';

use Torivac\BlogMarkdown;

$in = json_decode((string) file_get_contents($argv[1] ?? ''), true);
if (!is_array($in)) { fwrite(STDERR, "entrada no válida\n"); exit(2); }
$out = [];
foreach ($in as $c) {
    $f0 = BlogMarkdown::$failures;
    $row = ['html' => BlogMarkdown::render($c['md'], ['tableLabel' => 'Tabla'])];
    if (isset($c['n'])) { $row['plain'] = BlogMarkdown::toPlain($c['md']); $row['excerpt'] = BlogMarkdown::excerpt($c['md'], (int) $c['n']); $row['lead'] = BlogMarkdown::lead($c['md'], (int) $c['n']); }
    if (isset($c['url'])) $row['url'] = BlogMarkdown::safeUrl($c['url']);
    if (isset($c['title'])) $row['slug'] = \Torivac\Blog::slugify($c['title']);
    $row['fail'] = BlogMarkdown::$failures - $f0;
    $out[] = $row;
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
