<?php
/**
 * [PLAIN-TEXT-RULES] GENERADO por scripts/gen_plain_text_php.mjs desde shared/plain-text.mjs (no editar a mano: se regenera con `node scripts/gen_plain_text_php.mjs`).
 * Las mismas expresiones, límites y rangos de caracteres invisibles que usan el navegador y el Worker; PlainText.php las aplica.
 */
namespace Torivac;

final class PlainTextRules
{
    /** Límite de caracteres de cada campo de cada formulario. */
    const FIELDS = [
        'contact' => ['name' => 80, 'email' => 254, 'message' => 1000],
        'order' => ['name' => 80, 'company' => 120, 'email' => 254, 'phone' => 40, 'notes' => 500],
    ];
    /** Enlaces que se admiten en un mismo texto. */
    const MAX_LINKS = 2;
    /** Longitud mínima para mirar la proporción de signos de programación. */
    const SYMBOL_MIN_LENGTH = 15;
    /** Proporción máxima de signos de programación. */
    const SYMBOL_MAX_RATIO = 0.2;
    /** Clase PCRE (con /u) de los caracteres de control e invisibles que se eliminan. */
    const INVISIBLE = '[\\x{0}-\\x{8}\\x{b}-\\x{c}\\x{e}-\\x{1f}\\x{7f}-\\x{9f}\\x{ad}\\x{200b}-\\x{200f}\\x{2028}-\\x{2029}\\x{202a}-\\x{202e}\\x{2060}-\\x{2064}\\x{2066}-\\x{2069}\\x{feff}]';
    /** Reglas que rechazan el texto: [id, expresión, indicadores]. */
    const RULES = [
        ['markup-tag', '<[ \\t\\r\\n]*/?[ \\t\\r\\n]*(?:script|img|svg|iframe|frame|frameset|object|embed|applet|link|meta|style|base|form|input|button|textarea|select|option|body|html|head|title|a|b|i|u|s|p|div|span|table|tr|td|th|ul|ol|li|h[1-6]|br|hr|audio|video|source|track|math|details|summary|marquee|template|noscript|canvas|xml|use|image|animate|set|isindex|keygen)(?=[ \\t\\r\\n/>])[^>]*>', 'i'],
        ['markup-close', '<[ \\t\\r\\n]*/[ \\t\\r\\n]*[A-Za-z]', ''],
        ['markup-special', '<[!?%]', ''],
        ['markup-attr', '<[A-Za-z][A-Za-z0-9:_-]*[ \\t\\r\\n/]+[A-Za-z_:][A-Za-z0-9_:.-]*[ \\t\\r\\n]*=', ''],
        ['markup-open', '<[ \\t]*(?:script|iframe|img|svg|object|embed|style|link|meta|body|html)', 'i'],
        ['markup-entity', '&(?:lt|gt|#0*(?:60|62)|#x0*3[ce]);', 'i'],
        ['scheme', '(?<![A-Za-z0-9_])(?:javascript|vbscript|livescript)[ \\t\\r\\n]*:', 'i'],
        ['scheme-data', '(?<![A-Za-z0-9_])data[ \\t]*:[ \\t]*(?:text|image|application)[ \\t]*/', 'i'],
        ['template', '\\{\\{|\\}\\}|\\$\\{|#\\{|\\{%|%\\}', ''],
        ['sql-union', '(?<![A-Za-z0-9_])union[ \\t\\r\\n]+(?:all[ \\t\\r\\n]+)?select(?![A-Za-z0-9_])', 'i'],
        ['sql-stacked', ';[ \\t\\r\\n]*(?:(?:drop|truncate|alter)[ \\t\\r\\n]+(?:table|database|schema)|delete[ \\t\\r\\n]+from|insert[ \\t\\r\\n]+into|update[ \\t\\r\\n]+[A-Za-z0-9_.]+[ \\t\\r\\n]+set|shutdown(?![A-Za-z0-9_]))', 'i'],
        ['sql-names', '(?<![A-Za-z0-9_])(?:information_schema|xp_cmdshell|sysobjects|pg_sleep|waitfor[ \\t]+delay)(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?:sleep|benchmark)[ \\t]*\\([ \\t]*[0-9]', 'i'],
        ['sql-tautology', '(?<![A-Za-z0-9_])(?:or|and)[ \\t]+[0-9]+[ \\t]*=[ \\t]*[0-9]+|[\'"][ \\t]*(?:or|and)[ \\t]+[\'"]?[A-Za-z0-9_]+[\'"]?[ \\t]*(?:=|like)[ \\t]*[\'"]?[A-Za-z0-9_%]', 'i'],
        ['shell-subst', '\\$\\([^)]{1,200}\\)|`[^`\\n]{1,200}`', ''],
        ['shell-chain', '[;&|]{1,2}[ \\t]*(?:cat[ \\t]+/|wget[ \\t]|curl[ \\t]|bash(?![A-Za-z0-9_])|/bin/|nc[ \\t]+-|whoami(?![A-Za-z0-9_])|chmod[ \\t]|rm[ \\t]+-|powershell(?![A-Za-z0-9_])|cmd\\.exe)', 'i'],
        ['path', '\\.\\.[/\\\\]|(?<![A-Za-z0-9_])/etc/(?:passwd|shadow|hosts)|/proc/self|(?<![A-Za-z0-9_])[A-Za-z]:\\\\(?:windows|users|inetpub)', 'i'],
        ['script', '(?<![A-Za-z0-9_])(?:alert|prompt|confirm|eval|atob|settimeout|setinterval)\\(|document\\.(?:cookie|write|location)|window\\.(?:location|open)|\\.innerHTML|fromCharCode|base64_decode|shell_exec|passthru|phpinfo\\(|\\$_(?:GET|POST|REQUEST|SERVER|COOKIE)|(?<![A-Za-z0-9_])on(?:error|load|click|mouseover|focus|blur|submit|toggle|start|animationstart)[ \\t]*=', 'i'],
    ];
}
