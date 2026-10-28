<?php
/**
 * Pruebas de las propuestas EDITABLES del panel (Proposals.php y POST/GET /api/proposals/state): el manager aprueba con SU texto, rechaza con una nota o deshace; todo es texto plano
 * con límites, solo lo hacen los managers y aprobar no publica nada por sí solo.
 */
namespace Torivac\Tests;

use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Gestor y cliente con sesión → [token del gestor, token del cliente]. */
function pr_tokens(): array
{
    Users::create(['email' => 'jefa@torivac.test', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'ana.compras@acme.test', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    return [login_token('jefa@torivac.test', PW_JEFE, '10.7.9.1'), login_token('ana.compras@acme.test', PW_ANA, '10.7.9.2')];
}

/** POST /proposals/state con ese cuerpo y token (null = sin sesión) → Response. */
function pr_post(array $body, ?string $tok): \Torivac\Response { return Router::handle(req('POST', '/proposals/state', $body, $tok ? ['Authorization' => 'Bearer ' . $tok] : [])); }

/** P1 · Aprobar con SU texto: se guarda tal cual (limpio de controles y espacios repetidos) con modo, fragmento a sustituir y nota; el GET lo devuelve y quien lo hizo y cuándo. */
function test_proposals_approve_with_the_managers_own_text()
{
    fresh(); [$tj] = pr_tokens();
    $r = pr_post(['id' => 'PR-14528', 'state' => 'ok', 'mode' => 'replace', 'find' => "  Metalen beugels voor 3 mm   LED's ", 'text' => "  Metallhalterungen\t\tfür 3-mm-LEDs aus Messing\n\n\n\nund Duraluminium  ", 'note' => 'Revisado por Eva'], $tj);
    T::same(200, $r->status, 'aprobar con texto');
    $e = $r->body['state']['PR-14528'];
    T::same(['state', 'by', 'at', 'mode', 'text', 'find', 'note'], array_keys($e), 'campos guardados (sin los vacíos)');
    T::same("Metallhalterungen für 3-mm-LEDs aus Messing\n\nund Duraluminium", $e['text'], 'el texto se guarda limpio (tabuladores y saltos de más fuera)');
    T::same("Metalen beugels voor 3 mm LED's", $e['find'], 'el fragmento, en una línea y sin espacios repetidos');
    T::same(['replace', 'jefa@torivac.test'], [$e['mode'], $e['by']], 'modo y quién');
    T::true(preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $e['at']) === 1, 'cuándo, en ISO');
    $g = Router::handle(req('GET', '/proposals/state', null, ['Authorization' => 'Bearer ' . $tj]))->body['state'];
    T::same($e, $g['PR-14528'], 'el GET devuelve lo mismo');
    // volver a aprobar con otro texto sustituye la entrada entera (no mezcla campos de antes)
    $r = pr_post(['id' => 'PR-14528', 'state' => 'ok', 'mode' => 'note', 'text' => 'Otro'], $tj);
    T::same(['state', 'by', 'at', 'mode', 'text'], array_keys($r->body['state']['PR-14528']), 'la entrada nueva sustituye a la anterior');
}

/** P2 · Sin texto sigue funcionando como siempre (aprobar, rechazar y deshacer); rechazar admite una nota. */
function test_proposals_plain_approve_reject_and_undo_still_work()
{
    fresh(); [$tj] = pr_tokens();
    T::same(['state', 'by', 'at'], array_keys(pr_post(['id' => 'PR-14834', 'state' => 'ok'], $tj)->body['state']['PR-14834']), 'aprobar sin texto');
    $r = pr_post(['id' => 'PR-25713', 'state' => 'no', 'note' => 'Ya lo ha revisado la asesoría'], $tj);
    T::same(['no', 'Ya lo ha revisado la asesoría'], [$r->body['state']['PR-25713']['state'], $r->body['state']['PR-25713']['note']], 'rechazar con nota');
    pr_post(['id' => 'PR-14834', 'state' => ''], $tj);
    $s = Router::handle(req('GET', '/proposals/state', null, ['Authorization' => 'Bearer ' . $tj]))->body['state'];
    T::same(['PR-25713'], array_keys($s), 'deshacer quita solo esa');
    T::same('{}', json_encode(pr_post(['id' => 'PR-25713', 'state' => '', 'text' => 'se ignora'], $tj)->body['state']), 'deshacer no guarda texto');
}

/** P3 · Solo texto plano y con límites: etiquetas, scripts y código se rechazan con code y field; demasiado largo también; no se guarda nada. */
function test_proposals_text_is_plain_and_limited()
{
    fresh(); [$tj] = pr_tokens();
    foreach (['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'javascript:alert(1)', '{{7*7}}', '1; DROP TABLE users; --'] as $h) {
        foreach (['text', 'find', 'note'] as $f) {
            $r = pr_post(['id' => 'PR-11111', 'state' => 'ok', $f => 'Hola ' . $h], $tj);
            T::same([400, 'plain_text', $f], [$r->status, $r->body['code'] ?? null, $r->body['field'] ?? null], "«{$h}» en $f");
        }
    }
    $r = pr_post(['id' => 'PR-11111', 'state' => 'ok', 'text' => str_repeat('a', 3001)], $tj);
    T::same([400, 'too_long', 'text'], [$r->status, $r->body['code'], $r->body['field']], '3001 caracteres → too_long');
    T::same(200, pr_post(['id' => 'PR-11111', 'state' => 'ok', 'text' => str_repeat('palabra ', 374)], $tj)->status, 'casi 3000 caracteres → bien');
    T::same([400, 'too_long'], [($r = pr_post(['id' => 'PR-11112', 'state' => 'ok', 'find' => str_repeat('b', 301)], $tj))->status, $r->body['code']], '301 en find → too_long');
    T::same([400, 'too_long'], [($r = pr_post(['id' => 'PR-11113', 'state' => 'no', 'note' => str_repeat('c', 501)], $tj))->status, $r->body['code']], '501 en note → too_long');
    T::same(400, pr_post(['id' => 'PR-11114', 'state' => 'ok', 'text' => ['a']], $tj)->status, 'un texto que no es cadena');
    T::same(400, pr_post(['id' => 'PR-11114', 'state' => 'ok', 'mode' => 'borrar-todo'], $tj)->status, 'modo desconocido');
    T::same(400, pr_post(['id' => 'PR-11114', 'state' => 'ok', 'mode' => ['replace']], $tj)->status, 'modo que no es cadena');
    $s = Router::handle(req('GET', '/proposals/state', null, ['Authorization' => 'Bearer ' . $tj]))->body['state'];
    T::same(['PR-11111'], array_keys($s), 'solo se guardó lo válido');
    // un texto técnico normal pasa
    $r = pr_post(['id' => 'PR-11115', 'state' => 'ok', 'text' => "Tensión de 0 a 230 V (50/60 Hz); potencia hasta 4.000 VA. Si V<Vn y I>In, ver tabla."], $tj);
    T::same(200, $r->status, 'texto técnico con < > ; ( )');
}

/** P4 · Identificadores: PR- y de 3 a 6 cifras; solo managers (cliente 403, sin sesión 401); un cuerpo roto no rompe nada. */
function test_proposals_ids_and_roles()
{
    fresh(); [$tj, $ta] = pr_tokens();
    foreach (['PR-12', 'PR-1234567', 'pr-12345', 'PR-12345 ', '../x', 'PR-1e3', ''] as $bad) T::same(400, pr_post(['id' => $bad, 'state' => 'ok'], $tj)->status, 'id no válido «' . $bad . '»');
    foreach (['PR-123', 'PR-123456'] as $good) T::same(200, pr_post(['id' => $good, 'state' => 'ok'], $tj)->status, 'id válido «' . $good . '»');
    T::same(400, pr_post(['id' => 'PR-12345', 'state' => 'quizá'], $tj)->status, 'estado no válido');
    T::same(403, pr_post(['id' => 'PR-12345', 'state' => 'ok', 'text' => 'x'], $ta)->status, 'un cliente no puede');
    T::same(401, pr_post(['id' => 'PR-12345', 'state' => 'ok'], null)->status, 'sin sesión no puede');
    T::same(403, Router::handle(req('GET', '/proposals/state', null, ['Authorization' => 'Bearer ' . $ta]))->status, 'un cliente no lo lee');
    T::same(401, Router::handle(req('GET', '/proposals/state'))->status, 'sin sesión no lo lee');
    $before = json_encode(Store::get('proposals:state'));
    pr_post(['id' => 'PR-55555', 'state' => 'ok', 'text' => '<b>x</b>'], $tj);
    T::same($before, json_encode(Store::get('proposals:state')), 'un rechazo no toca lo guardado');
}
