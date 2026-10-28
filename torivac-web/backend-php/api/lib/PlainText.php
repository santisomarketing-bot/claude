<?php
/**
 * [PLAIN-TEXT] Los formularios públicos (contacto, pedido) aceptan SOLO TEXTO PLANO y con límites: sin etiquetas HTML, scripts, enlaces en exceso ni líneas de código (HTML/JS, SQL,
 * plantillas, órdenes de consola, rutas…). Defensa en profundidad: la salida ya se escapa siempre y no hay SQL; esto rechaza de entrada lo que no es un mensaje de una persona.
 * Es la misma lógica que shared/plain-text.mjs (navegador y Worker); las expresiones y límites vienen de PlainTextRules.php (generado desde ese módulo) y
 * tests/plain-text.fixtures.json (copia de shared/plain-text.fixtures.json) es el contrato que cumplen las dos. Si una regla cambia, se cambia allí y se regenera.
 *
 *   PlainText::normalize($valor, $multilinea)        → texto limpio (sin controles ni invisibles, saltos \n, espacios simples)
 *   PlainText::check($valor, $max, $multilinea)      → ['ok'=>bool, 'text'=>limpio, 'code'=>'' | plain_text | too_long | too_many_links | not_text]
 *   PlainText::max('contact', 'message')             → límite de caracteres de un campo (PlainTextRules::FIELDS)
 */
namespace Torivac;

final class PlainText
{
    /** Clase PCRE de los espacios que recorta trim() de JavaScript (el recorte debe dar lo mismo en los dos lados). */
    const TRIM = '[\x{9}-\x{d}\x{20}\x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}]';

    /** Texto limpio: sin controles ni caracteres invisibles, saltos de línea \n, tabuladores y espacios repetidos como un espacio y, si el campo es de una línea, sin saltos. */
    public static function normalize(string $value, bool $multiline = false): string
    {
        $s = preg_replace('/' . PlainTextRules::INVISIBLE . '/u', '', $value);
        if ($s === null) return '';
        $s = preg_replace('/\r\n?/', "\n", $s);
        $s = str_replace("\t", ' ', $s);
        if (!$multiline) $s = preg_replace('/\n+/', ' ', $s);
        $s = preg_replace(['/ {2,}/', '/ +\n/', '/\n +/', '/\n{3,}/'], [' ', "\n", "\n", "\n\n"], $s);
        return (string) preg_replace('/^' . self::TRIM . '+|' . self::TRIM . '+$/u', '', $s);
    }

    /** Número de caracteres (letras, no bytes: «é» y un emoji cuentan 1). */
    public static function length(string $s): int
    {
        return mb_strlen($s, 'UTF-8');
    }

    /** Límite de caracteres del campo `$field` del formulario `$form` (PlainTextRules::FIELDS). */
    public static function max(string $form, string $field): int
    {
        return (int) (PlainTextRules::FIELDS[$form][$field] ?? 1000);
    }

    /**
     * Revisa un texto de formulario. null = campo ausente (válido y vacío). Si no es una cadena → not_text; si no es UTF-8 válido o salta una regla → plain_text (también si el motor
     * de expresiones falla: se rechaza por precaución); si pasa del máximo → too_long; si lleva más enlaces de los permitidos → too_many_links. Un campo vacío es válido: si es obligatorio lo decide quien llama.
     * @param mixed $value
     * @return array{ok:bool,text:string,code:string}
     */
    public static function check($value, int $max = 1000, bool $multiline = false): array
    {
        if ($value === null) return ['ok' => true, 'text' => '', 'code' => ''];
        if (!is_string($value)) return ['ok' => false, 'text' => '', 'code' => 'not_text'];
        if (!mb_check_encoding($value, 'UTF-8')) return ['ok' => false, 'text' => '', 'code' => 'plain_text'];
        $text = self::normalize($value, $multiline);
        $len = self::length($text);
        if ($len > $max) return ['ok' => false, 'text' => $text, 'code' => 'too_long'];
        foreach (PlainTextRules::RULES as [$id, $re, $flags]) {
            if (preg_match('~' . str_replace('~', '\~', $re) . '~' . $flags, $text) !== 0) return ['ok' => false, 'text' => $text, 'code' => 'plain_text'];     // 1 = salta la regla; false = el motor falló (se rechaza)
        }
        if ($len >= PlainTextRules::SYMBOL_MIN_LENGTH && preg_match_all('/[{}\[\]<>\\\\|^~`$;=]/', $text) / $len > PlainTextRules::SYMBOL_MAX_RATIO) return ['ok' => false, 'text' => $text, 'code' => 'plain_text'];
        if (preg_match_all('~(?:https?://|www\.)[^ \t\r\n]+~i', $text) > PlainTextRules::MAX_LINKS) return ['ok' => false, 'text' => $text, 'code' => 'too_many_links'];
        return ['ok' => true, 'text' => $text, 'code' => ''];
    }
}
