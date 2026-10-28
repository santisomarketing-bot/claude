<?php
/**
 * [BLOG-MD] Conversor de texto (Markdown reducido) a HTML para las entradas del blog que se escriben en el panel: el MISMO que shared/blog-markdown.mjs (el panel lo usa para la vista previa
 * y este lo usa para la página que se publica). shared/blog-markdown.fixtures.json es el contrato que cumplen los dos, y scripts/test-blog-markdown-php.mjs compara las salidas de los dos
 * con decenas de miles de textos al azar. Si cambia una regla en uno, cambia en el otro.
 *
 * SEGURIDAD: TODO el texto se escapa; solo se emiten las etiquetas permitidas y los enlaces/imágenes solo admiten esquemas seguros (https, http, mailto, tel, rutas del sitio y anclas). Lo que no
 * encaja sale como texto, nunca como HTML. Si PCRE falla en una expresión (límite de retroceso o de pila con una entrada hostil), ese paso se salta: el texto sigue escapado.
 *   Bloques  # ## ### #### títulos (# y ## → h2: el h1 de la página es el título de la entrada) · párrafos · - * + listas · 1. 2) listas numeradas · > cita · --- línea · tablas con | · ![texto](imagen "pie")
 *   En línea **negrita** · *cursiva* (o _cursiva_) · `código` · [texto](https://… | /ruta | #ancla | mailto: | tel:) · \* para escribir el signo tal cual
 *
 * Paridad con JavaScript: todas las expresiones son /u (cuentan códigos de punto) y «espacio» es el \s de JavaScript (no el de PCRE: difieren en U+0085 y U+FEFF); los largos se cuentan en códigos de punto.
 *   BlogMarkdown::render($md, ['tableLabel' => 'Tabla', 'imgAttrs' => fn($src) => ' width="800" height="600"']) → HTML
 *   BlogMarkdown::toPlain($md) · excerpt($md, 155) · inline($texto) · safeUrl($url) · safeImageUrl($url) · escapeHtml($s) · clean($s)
 */
namespace Torivac;

final class BlogMarkdown
{
    /** El \s de JavaScript, para meterlo en una clase de caracteres PCRE. */
    private const WS = '\t\n\x{0B}\x{0C}\r\x{20}\x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';
    /** Expresiones ya compiladas (con {WS} resuelto), por nombre. */
    private static $rx = [];
    /** Veces que PCRE ha fallado (límite de retroceso o de pila) desde que arrancó el proceso: con textos normales tiene que seguir en 0 (lo comprueban las pruebas). */
    public static $failures = 0;

    /** Expresión PCRE por nombre: el código fuente está aquí abajo, escrito tal cual (nowdoc) con {WS} por el \s de JavaScript. */
    private static function rx(string $name): string
    {
        if (isset(self::$rx[$name])) return self::$rx[$name];
        $src = [
            'url_http' => <<<'RX'
%^[Hh][Tt][Tt][Pp][Ss]?://[^/?#]+%uD
RX,
            'url_mailto' => <<<'RX'
%^[Mm][Aa][Ii][Ll][Tt][Oo]:[^{WS}@]+@[^{WS}@]+$%uD
RX,
            'url_tel' => <<<'RX'
%^[Tt][Ee][Ll]:[+0-9()-]+$%uD
RX,
            'url_ext' => <<<'RX'
%^[Hh][Tt][Tt][Pp][Ss]?:%u
RX,
            'url_path' => <<<'RX'
%^/(?!/)%uD
RX,
            'url_anchor' => <<<'RX'
%^#[A-Za-z0-9_-]+$%uD
RX,
            'url_bad' => <<<'RX'
%[{WS}"<>\\\x{0}-\x{1F}]%u
RX,
            'img_ok' => <<<'RX'
%^([Hh][Tt][Tt][Pp][Ss]://|/)%uD
RX,
            'code' => <<<'RX'
%`([^`\n]+)`%u
RX,
            'image' => <<<'RX'
%(?<!\\)!\[([^\]\n]{0,300})\]\(((?:[^(){WS}]++|\([^(){WS}]*+\))++)(?:[{WS}]+"[^"\n]{0,300}")?\)%u
RX,
            'link' => <<<'RX'
%(?<!\\)\[([^\]\n]{1,300})\]\(((?:[^(){WS}]++|\([^(){WS}]*+\))++)(?:[{WS}]+"([^"\n]{0,300})")?\)%u
RX,
            'escape' => <<<'RX'
%\\([\\`*_{}[\]()#+\-.!|>~])%u
RX,
            'hardbreak' => <<<'RX'
%(?:(?<! ) {2,}|\\)\n%u
RX,
            'stash' => <<<'RX'
%\x{1}([0-9]+)\x{2}%u
RX,
            'blank' => <<<'RX'
%^[{WS}]*$%uD
RX,
            'heading' => <<<'RX'
%^(#{1,6})[ ]+(.{1,300}?)[ #]*$%uD
RX,
            'rule' => <<<'RX'
%^ {0,3}([-*_])( ?\1){2,}[{WS}]*$%uD
RX,
            'quote' => <<<'RX'
%^ {0,3}>%u
RX,
            'quote_strip' => <<<'RX'
%^ {0,3}> ?%u
RX,
            'item' => <<<'RX'
%^ {0,3}([-*+]|[0-9]{1,9}[.)])[ ]+(.*)$%uD
RX,
            'cont' => <<<'RX'
%^ {2,}[^{WS}]%u
RX,
            'sep' => <<<'RX'
%^\|?[{WS}]*:?-+:?[{WS}]*(\|[{WS}]*:?-+:?[{WS}]*)*\|?$%uD
RX,
            'figure' => <<<'RX'
%^!\[([^\]\n]{0,300})\]\(((?:[^(){WS}]++|\([^(){WS}]*+\))++)(?:[{WS}]+"([^"\n]{0,300})")?\)$%uD
RX,
            'cell_split' => <<<'RX'
%(?<!\\)\|%u
RX,
            'jtrim_l' => <<<'RX'
%^[{WS}]+%u
RX,
            'jtrim_r' => <<<'RX'
%(?<![{WS}])[{WS}]+$%uD
RX,
            'ws' => <<<'RX'
%[{WS}]%u
RX,
            'word' => <<<'RX'
%^[A-Za-z0-9\x{C0}-\x{24F}]$%u
RX,
            'clean' => <<<'RX'
%[\x{0}-\x{8}\x{B}\x{C}\x{E}-\x{1F}\x{7F}-\x{9F}\x{AD}\x{200B}-\x{200F}\x{2028}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{2069}\x{FEFF}]%u
RX,
        ];
        if (!isset($src[$name])) throw new \InvalidArgumentException('expresión desconocida: ' . $name);
        return self::$rx[$name] = str_replace('{WS}', self::WS, $src[$name]);
    }

    // ───────────────────────────────────────── [PIEZAS] escapes, direcciones y espacios
    /** Escapa & < > " para texto y atributos. */
    public static function escapeHtml(string $s): string { return str_replace(['&', '<', '>', '"'], ['&amp;', '&lt;', '&gt;', '&quot;'], $s); }

    /** Recorta los espacios como String.trim de JavaScript. */
    private static function jstrim(string $s): string
    {
        $r = preg_replace(self::rx('jtrim_l'), '', $s);
        if ($r === null) { self::$failures++; return $s; }
        $q = preg_replace(self::rx('jtrim_r'), '', $r);      // desde el principio de cada tanda de espacios: coste lineal aunque haya tandas enormes
        if ($q === null) { self::$failures++; return $r; }
        return $q;
    }

    /** ¿Es un solo carácter de espacio (el \s de JavaScript)? */
    private static function isSpace(string $c): bool { return $c !== '' && preg_match(self::rx('ws'), $c) === 1; }

    /** ¿Empieza por una cifra ASCII? */
    private static function isDigit(string $c): bool { return $c !== '' && strpos('0123456789', $c[0]) !== false; }

    /** ¿Es una letra o cifra de las que cuentan para el subrayado (_)? (A-Z a-z 0-9 y U+00C0–U+024F) */
    private static function isWord(string $c): bool { return $c !== '' && preg_match(self::rx('word'), $c) === 1; }

    /** Texto sin caracteres de control (salvo tabulador y salto de línea), separadores de línea Unicode, invisibles ni marcas de dirección, y con los saltos de línea unificados. */
    public static function clean(string $s): string
    {
        if (!preg_match('//u', $s)) $s = (string) mb_convert_encoding($s, 'UTF-8', 'UTF-8');
        $s = (string) preg_replace('/\r\n?/', "\n", $s);
        $r = preg_replace(self::rx('clean'), '', $s);
        return $r === null ? '' : $r;
    }

    /** Dirección permitida en un enlace, o null. Admite https://, http://, mailto:, tel:, /ruta (no //), #ancla. */
    public static function safeUrl($u): ?string
    {
        $s = self::jstrim((string) ($u ?? ''));
        if ($s === '' || mb_strlen($s, 'UTF-8') > 2000 || preg_match(self::rx('url_bad'), $s) !== 0) return null;
        foreach (['url_http', 'url_mailto', 'url_tel', 'url_path', 'url_anchor'] as $k) if (preg_match(self::rx($k), $s) === 1) return $s;
        return null;
    }

    /** Dirección permitida en una imagen, o null: https:// o una ruta del propio sitio (/media/blog/…). */
    public static function safeImageUrl($u): ?string
    {
        $s = self::safeUrl($u);
        return $s !== null && preg_match(self::rx('img_ok'), $s) === 1 ? $s : null;
    }

    /** <img> de una imagen en Markdown (o null si la dirección no vale). `$o['imgAttrs']($src)` puede devolver width/height ya escapados (el servidor los conoce). */
    private static function imgHtml(string $alt, string $url, array $o): ?string
    {
        $src = self::safeImageUrl($url);
        if ($src === null) return null;
        $extra = isset($o['imgAttrs']) && is_callable($o['imgAttrs']) ? (string) (($o['imgAttrs'])($src) ?: '') : '';
        return '<img src="' . self::escapeHtml($src) . '" alt="' . self::escapeHtml($alt) . '"' . $extra . ' loading="lazy" decoding="async">';
    }

    // ───────────────────────────────────────── [ÉNFASIS] negrita y cursiva con anidación siempre bien formada
    /** Negrita y cursiva (** __ * _ y *** para las dos) con anidación SIEMPRE bien formada: un emparejamiento con pila; lo que no cierra se queda como texto. Trabaja sobre texto ya escapado. */
    private static function emphasis(string $s): string
    {
        $ch = preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY);
        if ($ch === false) return $s;
        $n = count($ch);
        $out = [];                                  // trozos de texto (string) o delimitadores ['c' => carácter, 'n' => 1|2, 'role' => '' | 'o' | 'c' | 'p']
        $stack = [];                                // posiciones en $out de delimitadores abiertos (como mucho 200; se miran como mucho los 24 de arriba)
        $text = '';
        $i = 0;
        while ($i < $n) {
            $c = $ch[$i];
            if ($c !== '*' && $c !== '_') { $text .= $c; $i++; continue; }
            $j = $i;
            while ($j < $n && $ch[$j] === $c) $j++;
            $run = $j - $i;
            $before = $i > 0 ? $ch[$i - 1] : '';
            $after = $j < $n ? $ch[$j] : '';
            $canOpen = $after !== '' && !self::isSpace($after);
            $canClose = $before !== '' && !self::isSpace($before);
            if ($c === '_') { $canOpen = $canOpen && !self::isWord($before); $canClose = $canClose && !self::isWord($after); }
            $i = $j;
            if ($run > 3) { $text .= str_repeat($c, $run); continue; }
            if ($text !== '') { $out[] = $text; $text = ''; }
            // ***x*** = cursiva por fuera y negrita por dentro: al abrir se apila 1 y luego 2; al cerrar se cierra 2 y luego 1
            $sizes = $run === 3 ? ($canOpen && !$canClose ? [1, 2] : ($canClose && !$canOpen ? [2, 1] : null)) : [$run];
            if ($sizes === null) { $text .= str_repeat($c, $run); continue; }
            foreach ($sizes as $sz) {
                $out[] = ['c' => $c, 'n' => $sz, 'role' => ''];
                $di = count($out) - 1;
                $closed = false;
                if ($canClose && ($run !== 3 || $sizes[0] === 2)) {
                    for ($k = count($stack) - 1; $k >= 0 && $k >= count($stack) - 24; $k--) {
                        $oi = $stack[$k];
                        if ($out[$oi]['c'] === $c && $out[$oi]['n'] === $sz) { $out[$oi]['role'] = 'o'; $out[$di]['role'] = 'c'; $stack = array_slice($stack, 0, $k); $closed = true; break; }
                    }
                }
                if (!$closed && $canOpen && ($run !== 3 || $sizes[0] === 1) && count($stack) < 200) { $out[$di]['role'] = 'p'; $stack[] = $di; }
            }
        }
        if ($text !== '') $out[] = $text;
        $html = '';
        foreach ($out as $x) {
            if (is_string($x)) { $html .= $x; continue; }
            $tag = $x['n'] === 2 ? 'strong' : 'em';
            $html .= $x['role'] === 'c' ? "</$tag>" : ($x['role'] === 'o' ? "<$tag>" : str_repeat($x['c'], $x['n']));     // los que no se emparejaron se quedan como texto
        }
        return $html;
    }

    /** preg_replace_callback que, si PCRE falla (límite de retroceso o de pila), deja el texto como estaba: el paso siguiente lo escapa igualmente. */
    private static function rcb(string $name, callable $cb, string $s): string
    {
        $r = preg_replace_callback(self::rx($name), $cb, $s);
        if ($r === null) { self::$failures++; return $s; }
        return $r;
    }

    // ───────────────────────────────────────── [EN LÍNEA]
    /** Texto en línea (negrita, cursiva, código, enlaces, imágenes) → HTML ya escapado. */
    public static function inline(string $text, array $o = []): string
    {
        $stash = [];
        /** Guarda un trozo de HTML ya seguro y devuelve su marca de posición. */
        $put = function (string $html) use (&$stash): string { $stash[] = $html; return "\x01" . (count($stash) - 1) . "\x02"; };
        $s = self::clean($text);
        // 1) código: lo de dentro no se interpreta
        $s = self::rcb('code', function ($m) use ($put) { return $put('<code>' . self::escapeHtml($m[1]) . '</code>'); }, $s);
        // 2) imágenes ![texto](dirección "pie")
        $s = self::rcb('image', function ($m) use ($put, $o) { $h = self::imgHtml($m[1], $m[2], $o); return $h !== null ? $put($h) : $m[1]; }, $s);
        // 3) enlaces [texto](dirección "título"): las marcas de apertura y cierre se guardan aparte y el texto sigue su camino (así admite negrita dentro)
        $s = self::rcb('link', function ($m) use ($put) {
            $href = self::safeUrl($m[2]);
            if ($href === null) return $m[1];
            $title = $m[3] ?? '';
            $ext = preg_match(self::rx('url_ext'), $href) === 1 ? ' target="_blank" rel="noopener"' : '';
            return $put('<a href="' . self::escapeHtml($href) . '"' . $ext . ($title !== '' ? ' title="' . self::escapeHtml($title) . '"' : '') . '>') . $m[1] . $put('</a>');
        }, $s);
        // 4) \* \_ \[ … → el signo tal cual
        $s = self::rcb('escape', function ($m) use ($put) { return $put(self::escapeHtml($m[1])); }, $s);
        // 5) todo lo demás es texto
        $s = self::escapeHtml($s);
        // 6) énfasis
        $s = self::emphasis($s);
        // 7) saltos de línea forzados y devolver lo guardado
        $r = preg_replace(self::rx('hardbreak'), "<br>\n", $s);
        if ($r === null) { self::$failures++; $r = $s; }
        $s = str_replace('<br> ', '<br>', str_replace("\n", ' ', $r));
        return self::rcb('stash', function ($m) use ($stash) { return $stash[(int) $m[1]] ?? ''; }, $s);
    }

    // ───────────────────────────────────────── [BLOQUES]
    /** ¿La línea está vacía o solo tiene espacios? */
    private static function isBlank(string $l): bool { return preg_match(self::rx('blank'), $l) === 1; }

    /** Celdas de una fila de tabla (\| escapa la barra). */
    private static function splitRow(string $l): array
    {
        $t = self::jstrim($l);
        if (substr($t, 0, 1) === '|') $t = substr($t, 1);
        if (substr($t, -1) === '|' && substr($t, -2) !== '\\|') $t = substr($t, 0, -1);
        $cells = preg_split(self::rx('cell_split'), $t);
        if ($cells === false) $cells = [$t];
        return array_map(function ($c) { return str_replace('\\|', '|', self::jstrim($c)); }, $cells);
    }

    /** ¿Esta línea y la siguiente abren una tabla? (una fila con barras y debajo la fila de guiones con las mismas columnas) */
    private static function startsTable(array $lines, int $i): bool
    {
        return strpos($lines[$i], '|') !== false && $i + 1 < count($lines) && strpos($lines[$i + 1], '|') !== false && preg_match(self::rx('sep'), self::jstrim($lines[$i + 1])) === 1
            && count(self::splitRow($lines[$i])) === count(self::splitRow($lines[$i + 1]));
    }

    /** ¿Esta línea empieza un bloque distinto de un párrafo? */
    private static function startsBlock(array $lines, int $i): bool
    {
        return preg_match(self::rx('heading'), $lines[$i]) === 1 || preg_match(self::rx('rule'), $lines[$i]) === 1 || preg_match(self::rx('quote'), $lines[$i]) === 1
            || preg_match(self::rx('item'), $lines[$i]) === 1 || self::startsTable($lines, $i);
    }

    /** Markdown reducido → HTML. Opciones: tableLabel (nombre accesible de las tablas, «Tabla»), imgAttrs(src) (width/height de las imágenes que el servidor conoce). */
    public static function render(string $md, array $o = []): string
    {
        $lines = explode("\n", str_replace("\t", '    ', self::clean($md)));
        $n = count($lines);
        $label = $o['tableLabel'] ?? 'Tabla';
        $out = [];
        $i = 0;
        while ($i < $n) {
            $line = $lines[$i];
            if (self::isBlank($line)) { $i++; continue; }
            if (preg_match(self::rx('heading'), $line, $m) === 1) {
                $lv = strlen($m[1]) <= 2 ? 2 : (strlen($m[1]) === 3 ? 3 : 4);
                $out[] = "<h$lv>" . self::inline($m[2], $o) . "</h$lv>"; $i++; continue;
            }
            if (preg_match(self::rx('rule'), $line) === 1) { $out[] = '<hr>'; $i++; continue; }
            if (self::startsTable($lines, $i)) {
                $head = self::splitRow($lines[$i]);
                $cols = count($head);
                $i += 2;
                $rows = [];
                while ($i < $n && !self::isBlank($lines[$i]) && strpos($lines[$i], '|') !== false) {
                    $r = self::splitRow($lines[$i]);
                    while (count($r) < $cols) $r[] = '';
                    $rows[] = array_slice($r, 0, $cols);
                    $i++;
                }
                $th = implode('', array_map(function ($c) use ($o) { return '<th>' . self::inline($c, $o) . '</th>'; }, $head));
                $tr = implode('', array_map(function ($r) use ($o) { return '<tr>' . implode('', array_map(function ($c) use ($o) { return '<td>' . self::inline($c, $o) . '</td>'; }, $r)) . '</tr>'; }, $rows));
                $out[] = '<div class="tbl-wrap" tabindex="0" role="region" aria-label="' . self::escapeHtml((string) $label) . '"><table class="spec"><thead><tr>' . $th . '</tr></thead><tbody>' . $tr . '</tbody></table></div>';
                continue;
            }
            if (preg_match(self::rx('quote'), $line) === 1) {
                $paras = [[]];
                while ($i < $n && preg_match(self::rx('quote'), $lines[$i]) === 1) {
                    $t = preg_replace(self::rx('quote_strip'), '', $lines[$i], 1);
                    if (self::isBlank((string) $t)) $paras[] = []; else $paras[count($paras) - 1][] = $t;
                    $i++;
                }
                $out[] = '<blockquote>' . implode('', array_map(function ($p) use ($o) { return '<p>' . self::inline(implode("\n", $p), $o) . '</p>'; }, array_values(array_filter($paras, function ($p) { return count($p) > 0; })))) . '</blockquote>';
                continue;
            }
            if (preg_match(self::rx('item'), $line, $m) === 1) {
                $ordered = self::isDigit($m[1]);
                $items = [];
                while ($i < $n) {
                    $has = preg_match(self::rx('item'), $lines[$i], $mm) === 1;
                    if ($has && self::isDigit($mm[1]) === $ordered) { $items[] = $mm[2]; $i++; continue; }
                    if (!$has && !self::isBlank($lines[$i]) && preg_match(self::rx('cont'), $lines[$i]) === 1 && count($items)) { $items[count($items) - 1] .= "\n" . self::jstrim($lines[$i]); $i++; continue; }   // continuación del elemento anterior
                    if (self::isBlank($lines[$i]) && $i + 1 < $n) { $nx = preg_match(self::rx('item'), $lines[$i + 1], $nn) === 1; if ($nx && self::isDigit($nn[1]) === $ordered) { $i++; continue; } }   // línea en blanco entre elementos de la misma lista
                    break;
                }
                $tag = $ordered ? 'ol' : 'ul';
                $out[] = "<$tag>" . implode('', array_map(function ($t) use ($o) { return '<li>' . self::inline($t, $o) . '</li>'; }, $items)) . "</$tag>";
                continue;
            }
            $para = [];
            while ($i < $n && !self::isBlank($lines[$i]) && (count($para) === 0 || !self::startsBlock($lines, $i))) { $para[] = $lines[$i]; $i++; }
            $text = self::jstrim(implode("\n", $para));
            if (preg_match(self::rx('figure'), $text, $f) === 1) {
                $img = self::imgHtml($f[1], $f[2], $o);
                if ($img !== null) { $out[] = '<figure>' . $img . (($f[3] ?? '') !== '' ? '<figcaption>' . self::escapeHtml($f[3]) . '</figcaption>' : '') . '</figure>'; continue; }
            }
            $out[] = '<p>' . self::inline($text, $o) . '</p>';
        }
        return implode("\n", $out);
    }

    // ───────────────────────────────────────── [TEXTO PLANO]
    /** Texto plano de un Markdown (sin marcas ni etiquetas, espacios normalizados): extracto, longitud y llms.txt. */
    public static function toPlain(string $md): string
    {
        $h = self::render($md, ['tableLabel' => 'x']);
        $h = (string) preg_replace('%</(p|h[2-4]|li|tr|th|td|blockquote|figure|figcaption)>%u', ' ', $h);
        $h = str_replace('<br>', ' ', $h);
        $h = (string) preg_replace('%<[^>]+>%u', '', $h);
        $h = str_replace(['&lt;', '&gt;', '&quot;', '&amp;'], ['<', '>', '"', '&'], $h);
        return self::jstrim((string) preg_replace('%[' . self::WS . ']+%u', ' ', $h));
    }

    /** Extracto de hasta `$n` caracteres (códigos de punto) cortado en una palabra entera (con «…» si se recorta). */
    public static function excerpt(string $md, int $n = 155): string
    {
        $t = self::toPlain($md);
        if (mb_strlen($t, 'UTF-8') <= $n) return $t;
        $cut = mb_substr($t, 0, $n, 'UTF-8');
        $cut = (string) preg_replace('%[' . self::WS . ']+[^' . self::WS . ']*$%u', '', $cut);
        $cut = (string) preg_replace('%[' . self::WS . ',;:.\-–—]+$%u', '', $cut);
        return $cut . '…';
    }
}
