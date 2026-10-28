<?php
/** Pruebas de BlogMarkdown con los casos compartidos con la versión JavaScript (shared/blog-markdown.fixtures.json) y comprobaciones de seguridad propias. */
namespace Torivac\Tests;

use Torivac\BlogMarkdown;

require_once __DIR__ . '/harness.php';

/** Casos compartidos con JavaScript (en el paquete del hosting no van las pruebas; junto a ellas hay una copia para trabajar solo con backend-php/). */
function bm_fixtures(): array
{
    $f = __DIR__ . '/../../../shared/blog-markdown.fixtures.json';
    if (!is_file($f)) $f = __DIR__ . '/blog-markdown.fixtures.json';
    return json_decode((string) file_get_contents($f), true);
}

/** La copia de los casos junto a las pruebas es idéntica a la compartida (si el repositorio completo está presente). */
function test_blog_markdown_fixtures_copy_is_identical()
{
    $shared = __DIR__ . '/../../../shared/blog-markdown.fixtures.json';
    if (is_file($shared)) T::true(file_get_contents($shared) === file_get_contents(__DIR__ . '/blog-markdown.fixtures.json'), 'tests/blog-markdown.fixtures.json es copia idéntica de shared/ (node scripts/test-blog-markdown.mjs --update la regenera)');
    else T::true(true);
}

/** El HTML de cada caso es EXACTAMENTE el que da JavaScript. */
function test_blog_markdown_render_matches_contract()
{
    foreach (bm_fixtures()['render'] as $c) T::same($c['html'], BlogMarkdown::render($c['md'], ['tableLabel' => 'Tabla']), 'render «' . $c['name'] . '»');
}

/** Texto plano y extracto, igual que en JavaScript. */
function test_blog_markdown_plain_and_excerpt_match_contract()
{
    $fx = bm_fixtures();
    foreach ($fx['plain'] as $c) T::same($c['text'], BlogMarkdown::toPlain($c['md']), 'toPlain ' . json_encode(mb_substr($c['md'], 0, 40), JSON_UNESCAPED_UNICODE));
    foreach ($fx['excerpt'] as $c) T::same($c['text'], BlogMarkdown::excerpt($c['md'], $c['n']), 'excerpt ' . json_encode(mb_substr($c['md'], 0, 40), JSON_UNESCAPED_UNICODE) . '/' . $c['n']);
    foreach ($fx['lead'] as $c) T::same($c['text'], BlogMarkdown::lead($c['md'], $c['n']), 'lead ' . json_encode(mb_substr($c['md'], 0, 40), JSON_UNESCAPED_UNICODE) . '/' . $c['n']);
}

/** Direcciones permitidas y prohibidas, igual que en JavaScript. */
function test_blog_markdown_safe_url_matches_contract()
{
    foreach (bm_fixtures()['safeUrl'] as $c) T::same($c['ok'], BlogMarkdown::safeUrl($c['url']) !== null, 'safeUrl ' . json_encode($c['url'], JSON_UNESCAPED_UNICODE));
}

/** Auditoría del HTML: solo etiquetas y atributos permitidos, texto sin < ni > sueltos y todo cerrado. Devuelve la lista de problemas. */
function bm_audit(string $html): array
{
    $tags = ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'strong', 'em', 'code', 'a', 'img', 'figure', 'figcaption', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
    $void = ['hr', 'br', 'img'];
    $bad = [];
    $stack = [];
    $last = 0;
    preg_match_all('%<(/?)([a-zA-Z0-9]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*>%', $html, $ms, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
    foreach ($ms as $m) {
        $between = substr($html, $last, $m[0][1] - $last);
        if (preg_match('/[<>]/', $between)) $bad[] = 'texto con < o > sin escapar: ' . substr($between, 0, 60);
        $last = $m[0][1] + strlen($m[0][0]);
        $close = $m[1][0]; $name = $m[2][0]; $attrs = $m[3][0];
        if (!in_array($name, $tags, true)) { $bad[] = 'etiqueta no permitida <' . $name . '>'; continue; }
        if ($close !== '') { if (array_pop($stack) !== $name) $bad[] = 'cierre desparejado </' . $name . '>'; continue; }
        if (!in_array($name, $void, true)) $stack[] = $name;
        preg_match_all('%\s+([a-z-]+)="([^"<>]*)"%', $attrs, $am, PREG_SET_ORDER);
        foreach ($am as $a) {
            $k = $a[1]; $v = str_replace('&amp;', '&', $a[2]);
            if ($name === 'a' && $k === 'href') { if (!preg_match('%^(https?://[^\s"<>]+|mailto:[^\s"<>]+|tel:[+0-9()-]+|/(?!/)[^\s"<>]*|#[A-Za-z0-9_-]+)$%i', $v)) $bad[] = 'href no permitido: ' . $v; }
            elseif ($name === 'img' && $k === 'src') { if (!preg_match('%^(https://|/(?!/))[^\s"<>]*$%i', $v)) $bad[] = 'src no permitido: ' . $v; }
            elseif ($name === 'a' && (($k === 'target' && $v === '_blank') || ($k === 'rel' && $v === 'noopener') || $k === 'title')) { /* permitido */ }
            elseif ($name === 'img' && in_array($k, ['alt', 'width', 'height'], true)) { /* permitido */ }
            elseif ($name === 'img' && (($k === 'loading' && $v === 'lazy') || ($k === 'decoding' && $v === 'async'))) { /* permitido */ }
            elseif ($name === 'div' && (($k === 'class' && $v === 'tbl-wrap') || ($k === 'tabindex' && $v === '0') || ($k === 'role' && $v === 'region') || $k === 'aria-label')) { /* permitido */ }
            elseif ($name === 'table' && $k === 'class' && $v === 'spec') { /* permitido */ }
            else $bad[] = "atributo no permitido $name.$k=\"$v\"";
        }
        if ($name === 'div' && strpos($attrs, 'class="tbl-wrap"') === false) $bad[] = 'div que no es el de la tabla';
        if (preg_match('/\son[a-z]+=/i', $attrs)) $bad[] = 'manejador de evento';
    }
    if (preg_match('/[<>]/', substr($html, $last))) $bad[] = 'texto final con < o > sin escapar';
    if ($stack) $bad[] = 'sin cerrar: ' . implode(',', $stack);
    return $bad;
}

/** Los ataques conocidos (scripts, javascript:, data:, atributos que se cuelan, // , etc.) salen como texto o no salen: nunca como HTML fuera de la lista. */
function test_blog_markdown_known_attacks_never_produce_forbidden_html()
{
    $attacks = [
        '<script>alert(1)</script>', '[x](javascript:alert(1))', '![x](javascript:alert(1))', '[x](data:text/html;base64,PHNjcmlwdD4=)', '"><img src=x onerror=alert(1)>', '[x](https://a.example/"onclick="alert(1))',
        '![x](/media/blog/a.jpg" onerror="alert(1))', '`</code><script>alert(1)</script>`', "| <script> |\n|---|\n| <img src=x onerror=y> |", '> <svg onload=alert(1)>', '# <iframe src=//evil>', '- <a href="javascript:x">x</a>',
        '[a](<javascript:alert(1)>)', "[a](java\tscript:alert(1))", '[a](&#106;avascript:alert(1))', '![a](//evil.example/a.png)', '[a](https://x.example/a b)', '**<b onmouseover=x>**', '_<i>_', '\\<script>',
        "[a](httpſ://x.example)", "[a](JAVASCRIPT:alert(1))", "[a](jaVaScRiPt:alert(1))", "[a]( javascript:alert(1))", "[a](\x01javascript:alert(1))", "[a](\u{200B}javascript:alert(1))", "![a](HTTP://x.example/a.png)",
    ];
    foreach ($attacks as $a) {
        $bad = bm_audit(BlogMarkdown::render($a, ['tableLabel' => 'Tabla']));
        T::true(!$bad, 'ataque ' . json_encode($a, JSON_UNESCAPED_UNICODE) . ' → ' . implode(' | ', $bad));
    }
}

/** Texto cualquiera (también con bytes que no son UTF-8) nunca rompe el conversor ni deja HTML fuera de la lista. */
function test_blog_markdown_random_input_stays_inside_allowed_html()
{
    $pieces = ['[', ']', '(', ')', '!', '*', '**', '_', '__', '`', '<', '>', '"', '\\', '|', '|---|', '-', '- ', '1. ', '# ', '## ', '> ', '---', ' ', '  ', "\n", "\n\n", 'a', 'texto', 'javascript:', 'https://x.example/', '/media/blog/a.jpg', 'onerror=', '<script>', '&amp;', '&', "'", "\t", "\r\n", "\xff", "\xc3", "\x00", "\u{85}", "\u{2028}"];
    mt_srand(4242);
    $n = count($pieces);
    for ($k = 0; $k < 3000; $k++) {
        $s = '';
        $len = 1 + mt_rand(0, 39);
        for ($j = 0; $j < $len; $j++) $s .= $pieces[mt_rand(0, $n - 1)];
        $bad = bm_audit(BlogMarkdown::render($s, ['tableLabel' => 'Tabla']));
        if ($bad) { T::true(false, 'entrada al azar ' . json_encode($s, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . ' → ' . implode(' | ', $bad)); return; }
        T::true(true);
    }
}

/** Entradas hostiles enormes se resuelven rápido (sin retroceso exponencial ni cuadrático) y sin salirse de lo permitido. */
function test_blog_markdown_huge_hostile_inputs_are_fast()
{
    $big = [
        'a×60000' => str_repeat('a', 60000), '*×30000' => str_repeat('*', 30000), '[×30000' => str_repeat('[', 30000), '**a ×15000' => str_repeat('**a ', 15000), '_×30000' => str_repeat('_', 30000), '|×30000' => str_repeat('|', 30000),
        '`×30000' => str_repeat('`', 30000), '[a](×10000' => str_repeat('[a](', 10000), '![×10000' => str_repeat('![a](', 10000), '- ×20000' => str_repeat("- a\n", 20000), '> ×20000' => str_repeat("> a\n", 20000),
        '| a |×5000' => str_repeat("| a | b |\n|---|---|\n" . str_repeat("| 1 | 2 |\n", 5), 3000), '# ×20000' => str_repeat("# t\n", 20000), '\\×30000' => str_repeat('\\', 30000), '<×30000' => str_repeat('<', 30000),
        ' ×60000' => str_repeat(' ', 60000) . 'x', '# +espacios' => '# a' . str_repeat(' ', 59000) . 'b', '# +almohadillas' => '# ' . str_repeat('#', 59000) . 'a', '|+espacios' => "| a |\n" . str_repeat(' ', 59000) . 'x|', '|---|+espacios' => "| a |\n|---" . str_repeat(' ', 59000) . 'x',
        'url larga' => '[a](' . str_repeat('x', 59000) . ')', 'url larga con paréntesis' => '[a](' . str_repeat('x', 1990) . '(' . str_repeat('y', 57000), 'espacios+salto' => str_repeat('a' . str_repeat(' ', 1000) . "\n", 50), 'espacios al final de línea' => str_repeat(' ', 59000) . "\n" . 'x',
        '\\+espacios' => str_repeat('\\ ', 29000), '1.×20000' => str_repeat("1. a\n", 20000), '(×30000' => str_repeat('(', 30000), ']×30000' => str_repeat(']', 30000), 'ancla' => str_repeat('[a](#b) ', 7000), '*a* ×15000' => str_repeat('*a* ', 15000), '***' => str_repeat('***a', 14000),
    ];
    foreach ($big as $name => $s) {
        $t = microtime(true);
        $html = BlogMarkdown::render($s, ['tableLabel' => 'Tabla']);
        $ms = (microtime(true) - $t) * 1000;
        T::true($ms < 1500, "entrada enorme «{$name}» tardó " . round($ms) . ' ms (máximo 1500)');
        T::true(!bm_audit($html), "entrada enorme «{$name}» sacó HTML no permitido");
    }
}

/** Los límites cuentan letras (códigos de punto), no bytes: una dirección de 2000 emojis cabe y una de 2001 no. */
function test_blog_markdown_url_limit_counts_code_points()
{
    T::true(BlogMarkdown::safeUrl('/' . str_repeat('é', 1999)) !== null, '2000 caracteres caben');
    T::true(BlogMarkdown::safeUrl('/' . str_repeat('é', 2000)) === null, '2001 caracteres no caben');
    T::true(BlogMarkdown::safeUrl('https://x.example/' . str_repeat('😀', 1982)) !== null, 'emojis cuentan 1');
    T::true(BlogMarkdown::safeUrl('https://x.example/' . str_repeat('😀', 1983)) === null, 'emojis: un carácter de más');
}

/** El tamaño de la dirección máxima (2000) sigue siendo un enlace en la página (PCRE no se rinde por la pila). */
function test_blog_markdown_longest_link_still_converts()
{
    $url = 'https://x.example/' . str_repeat('a', 1982);
    T::same('<p><a href="' . $url . '" target="_blank" rel="noopener">t</a></p>', BlogMarkdown::render("[t]($url)"), 'enlace de 2000 caracteres');
    $url2 = 'https://x.example/' . str_repeat('(a)', 660);
    T::same('<p><a href="' . $url2 . '" target="_blank" rel="noopener">t</a></p>', BlogMarkdown::render("[t]($url2)"), 'enlace con muchos paréntesis');
}

/** Bytes que no son UTF-8 se limpian (nunca llegan al HTML ni rompen el análisis). */
function test_blog_markdown_invalid_utf8_is_cleaned()
{
    $html = BlogMarkdown::render("Hola \xff\xfe mundo \xc3");
    T::true(preg_match('//u', $html) === 1, 'salida UTF-8 válida');
    T::true(strpos($html, '<p>Hola') === 0, 'párrafo conservado');
}
