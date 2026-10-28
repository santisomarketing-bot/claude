<?php
/** Pruebas de PlainText con los casos compartidos con la versión JavaScript (shared/plain-text.fixtures.json). */
namespace Torivac\Tests;

use Torivac\PlainText;

require_once __DIR__ . '/harness.php';

/** Casos compartidos con JavaScript (en el paquete del hosting hay una copia junto a las pruebas). */
function pt_fixtures(): array
{
    $f = __DIR__ . '/../../../shared/plain-text.fixtures.json';
    if (!is_file($f)) $f = __DIR__ . '/plain-text.fixtures.json';
    return json_decode((string) file_get_contents($f), true);
}

/** La copia de los casos junto a las pruebas es idéntica a la compartida (si el repositorio completo está presente). */
function test_plain_text_fixtures_copy_is_identical()
{
    $shared = __DIR__ . '/../../../shared/plain-text.fixtures.json';
    if (is_file($shared)) T::true(file_get_contents($shared) === file_get_contents(__DIR__ . '/plain-text.fixtures.json'), 'tests/plain-text.fixtures.json es copia idéntica de shared/');
    else T::true(true);
}

/** Lo que una persona escribe de verdad (técnico, con signos, en cuatro idiomas) se acepta. */
function test_plain_text_accepts_real_messages()
{
    foreach (pt_fixtures()['accept'] as $c) {
        $r = PlainText::check($c['text'], 1000, (bool) $c['multiline']);
        T::true($r['ok'], 'debería aceptarse «' . $c['name'] . '» (' . $r['code'] . ')');
    }
}

/** HTML, scripts, SQL, plantillas, consola, rutas, signos de programación, demasiados enlaces y lo que no es texto se rechazan con el código esperado. */
function test_plain_text_rejects_code_and_markup()
{
    foreach (pt_fixtures()['reject'] as $c) {
        $r = PlainText::check($c['text'], 1000, true);
        T::same($c['code'], $r['ok'] ? 'aceptado' : $r['code'], 'debería rechazarse «' . $c['name'] . '»');
    }
}

/** La limpieza (invisibles, controles, saltos, espacios, recorte) da lo mismo que en JavaScript. */
function test_plain_text_normalize_matches_javascript()
{
    foreach (pt_fixtures()['normalize'] as $c) T::same($c['out'], PlainText::normalize($c['text'], (bool) $c['multiline']), 'normalizar «' . $c['name'] . '»');
}

/** Los límites cuentan letras (un acento o un emoji cuenta 1) y rechazan con too_long. */
function test_plain_text_limits_count_characters_not_bytes()
{
    foreach (pt_fixtures()['limits'] as $c) {
        $r = PlainText::check($c['text'], (int) $c['max'], (bool) $c['multiline']);
        T::same((bool) $c['ok'], $r['ok'], 'límite «' . $c['name'] . '»');
        if (!$c['ok']) T::same('too_long', $r['code'], 'límite «' . $c['name'] . '» da too_long');
    }
    T::same(['ok' => true, 'text' => '', 'code' => ''], PlainText::check(null), 'ausente = vacío válido');
    T::same('plain_text', PlainText::check("abc\xC3\x28def")['code'], 'UTF-8 inválido se rechaza');
}

/** Los límites de cada campo son los acordados (contacto: mensaje 1000; pedido: notas 500). */
function test_plain_text_field_limits()
{
    T::same(1000, PlainText::max('contact', 'message'));
    T::same(500, PlainText::max('order', 'notes'));
    T::same(80, PlainText::max('contact', 'name'));
    T::same(1000, PlainText::max('nope', 'nope'), 'campo desconocido = 1000');
}

/** Textos hostiles enormes no se eternizan ni agotan el motor de expresiones (se rechazan o se aceptan, pero rápido). */
function test_plain_text_hostile_long_inputs_are_fast()
{
    $big = ['a' => str_repeat('a', 60000), '<' => str_repeat('<', 30000), '(' => str_repeat('(', 30000), '$(' => str_repeat('$(', 20000), '`' => str_repeat('`', 30000), 'or' => str_repeat('or ', 20000), ';' => str_repeat('; ', 20000), '<a' => str_repeat('<a ', 10000), 'http' => str_repeat('http://', 20000), '\\' => str_repeat('\\', 30000)];
    foreach ($big as $name => $s) {
        $t0 = microtime(true);
        PlainText::check($s, 1000000000, true);
        T::true((microtime(true) - $t0) < 1.5, 'texto enorme «' . $name . '» rápido');
    }
}
