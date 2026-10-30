<?php
/**
 * Pruebas de «Presupuestos recibidos» (Quotes.php, docs/PRESUPUESTOS-RECIBIDOS.md §5): el rol client (propietario) ve todos los presupuestos; GET /orders/:número; PUT (editar: rev/409, precios
 * manuales, original, history ≤ 50); POST /orders/:número/send (reenvío con PDF, topes, mail_off, historial y lastSent) y el correo que compone Mail::quoteMail. Sin red ni servidor web:
 * el correo es el controlador «file» (bandeja de salida) o un Http::$mock.
 */
namespace Torivac\Tests;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

use Torivac\Audit;
use Torivac\Config;
use Torivac\Http;
use Torivac\Mail;
use Torivac\Prices;
use Torivac\Quotes;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

/** PDF mínimo válido (base64 canónico) para los reenvíos. */
function qt_pdf(): string { return base64_encode("%PDF-1.4\n% presupuesto de prueba\n"); }

/** Prepara el almacén con precios, un manager y un propietario con sesión y tres presupuestos de tres correos distintos → ['mgr' => token, 'own' => token, 'n' => [números]]. */
function qt_setup(array $cfg = []): array
{
    fresh($cfg); seedPrices();
    Users::create(['email' => 'jefe@torivac.test', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'duena@torivac.test', 'name' => 'Dueña', 'role' => 'client', 'password' => PW_ANA]);
    $n = [];
    foreach (['ana@acme.es', 'otro@x.es', 'tercero@y.es'] as $mail) $n[] = so_post(goodOrder(['customer' => so_customer(['email' => $mail])]))->body['number'];
    return ['mgr' => login_token('jefe@torivac.test', PW_JEFE, '10.9.0.1'), 'own' => login_token('duena@torivac.test', PW_ANA, '10.9.0.2'), 'n' => $n];
}

/** Llama al API como lo haría el navegador: método, ruta, cuerpo (array o texto) y cabeceras. */
function qt_call(string $method, string $path, $body = null, array $headers = []) { return Router::handle(req($method, $path, $body, $headers)); }

/** El registro guardado de un presupuesto. */
function qt_rec(string $n): array { return (array) Store::get('order:' . $n); }

/** Cuerpo de edición «sin cambios» a partir del registro guardado (rev, solicitante y líneas sin precio); `$over` sobrescribe cualquier clave. */
function qt_body(string $n, array $over = []): array
{
    $o = qt_rec($n);
    $c = $o['customer'];
    return $over + ['rev' => $o['rev'] ?? 0, 'customer' => ['name' => $c['name'], 'company' => $c['company'], 'email' => $c['email'], 'phone' => $c['phone'], 'notes' => $c['notes']],
        'lines' => array_map(function ($l) { return ['ref' => $l['ref'], 'qty' => $l['qty']]; }, $o['lines'])];
}

/** Cambia la tarifa vigente (para comprobar que lo guardado no se revalora solo). */
function qt_tariff(array $items, string $stamp = '2026-11-01T00:00:00.000Z'): void
{
    Store::put(Prices::KEY_CURRENT, Prices::forJson(['updated_at' => $stamp, 'source' => 'test', 'currency' => 'EUR', 'mode' => 'live', 'items' => $items]));
}

/** Correos de presupuesto reenviado que hay en la bandeja de salida (asunto «Torivac · presupuesto/quote/devis/Angebot TV-…»). */
function qt_sent(?array $to = null): array
{
    $out = [];
    foreach (outbox() as $m) {
        if (!preg_match('/^Torivac · (presupuesto|quote|devis|Angebot) TV-/u', (string) ($m['subject'] ?? ''))) continue;
        if ($to === null || ($m['to'] ?? null) === $to) $out[] = $m;
    }
    return $out;
}

/** POST /orders/:número/send con el PDF de prueba y los destinatarios dados (más cualquier campo extra). */
function qt_send(string $n, string $token, array $to = ['cliente@empresa.com'], array $extra = [])
{
    return qt_call('POST', "/orders/$n/send", $extra + ['to' => $to, 'pdf' => qt_pdf()], bearer($token));
}

// ───────────────────────────────────────── 1 · GET /orders: el propietario ve todo

/** 1 · client (propietario) ve los presupuestos de TODOS los correos, sin ip ni emailed.error; manager y token maestro los ven con ambos. */
function test_qt_client_sees_all_orders_without_ip_and_mail_error()
{
    $s = qt_setup();
    foreach ($s['n'] as $n) { $o = qt_rec($n); $o['emailed']['error'] = 'Resend respondió 403'; Store::put('order:' . $n, $o, 86400); }
    $own = qt_call('GET', '/orders', null, bearer($s['own']));
    T::same(200, $own->status, 'el propietario puede listar');
    $mails = array_map(function ($o) { return $o['customer']['email']; }, $own->body['orders']);
    sort($mails);
    T::same(['ana@acme.es', 'otro@x.es', 'tercero@y.es'], $mails, 've los tres, de tres correos distintos (ninguno es el suyo)');
    T::same(false, array_key_exists('truncated', $own->body), 'sin truncated');
    foreach ($own->body['orders'] as $o) T::true(!array_key_exists('ip', $o) && !array_key_exists('error', $o['emailed']) && array_key_exists('team', $o['emailed']), 'sin ip ni emailed.error (' . $o['number'] . ')');
    foreach ([['manager', bearer($s['mgr'])], ['token maestro', master()]] as [$who, $h]) {
        $all = qt_call('GET', '/orders', null, $h)->body['orders'];
        T::same([3, true, 'Resend respondió 403'], [count($all), isset($all[0]['ip']) && $all[0]['ip'] !== '', $all[0]['emailed']['error']], "$who: los tres con ip y emailed.error");
    }
    T::same(401, qt_call('GET', '/orders')->status, 'sin sesión: 401');
}

// ───────────────────────────────────────── 2 · GET /orders/:número

/** 2 · Ver uno: 200 con y sin ip según el rol, 404 si no existe, 404 con números raros (también para el propietario, nunca 403) y 401 sin sesión. */
function test_qt_get_one_order_and_weird_numbers()
{
    $s = qt_setup();
    $n = $s['n'][1];
    $own = qt_call('GET', "/orders/$n", null, bearer($s['own']));
    T::same([200, true, $n, 'otro@x.es', false], [$own->status, $own->body['ok'], $own->body['order']['number'], $own->body['order']['customer']['email'], array_key_exists('ip', $own->body['order'])], 'propietario: 200 sin ip');
    T::same(false, array_key_exists('error', $own->body['order']['emailed']), 'y sin emailed.error');
    foreach ([['manager', bearer($s['mgr'])], ['token maestro', master()]] as [$who, $h]) {
        $r = qt_call('GET', "/orders/$n", null, $h);
        T::same([200, true], [$r->status, array_key_exists('ip', $r->body['order']) && array_key_exists('error', $r->body['order']['emailed'])], "$who: 200 con ip y emailed.error");
    }
    Store::put('order:TV-20261028-0001-A1B', ['number' => 'TV-20261028-0001-A1B', 'at' => '2026-10-28T10:00:00.000Z', 'customer' => ['name' => 'N', 'email' => 'n@x.es'], 'lines' => [], 'total' => 0, 'ip' => '1.1.1.1'], 86400);
    T::same(200, qt_call('GET', '/orders/TV-20261028-0001-A1B', null, bearer($s['own']))->status, 'un número con sufijo -XXX también vale');
    $weird = ['/orders/', '/orders/..', '/orders/../config', '/orders/%2e%2e', '/orders/%2e%2e%2fconfig', '/orders/TV-2026-1', "/orders/$n/../x", '/orders/' . strtolower($n), "/orders/$n-abcd", "/orders/{$n}x",
        "/orders/$n\n", "/orders/$n%00", '/orders/TV-20990101-0001/x', "/orders/$n/send/x", '/orders/' . str_repeat('A', 500)];
    foreach (['propietario' => $s['own'], 'manager' => $s['mgr']] as $who => $tok) {
        foreach ($weird as $p) {
            $r = qt_call('GET', $p, null, bearer($tok));
            T::same([404, false], [$r->status, $r->body['ok']], "$who: «" . substr($p, 0, 40) . '» es 404');
        }
        $r = qt_call('GET', '/orders/TV-20990101-0001', null, bearer($tok));
        T::same([404, 'No existe ese presupuesto'], [$r->status, $r->body['error']], "$who: no existe → 404 con su texto");
        T::same([404, 'No existe ese presupuesto'], [qt_call('GET', '/orders/..', null, bearer($tok))->status, qt_call('GET', '/orders/../x', null, bearer($tok))->body['error']], "$who: forma no válida, el mismo 404");
        T::same(404, qt_call('DELETE', "/orders/$n", null, bearer($tok))->status, "$who: un método que no existe es 404, no 403");
    }
    T::same(401, qt_call('GET', "/orders/$n")->status, 'sin sesión: 401');
    T::same(401, qt_call('GET', "/orders/$n", null, bearer('token-que-no-vale'))->status, 'token inválido: 401');
    T::same(401, qt_call('GET', '/orders/..')->status, 'y con un número raro sin sesión también 401 (no se adivina nada)');
    T::same(401, qt_call('PUT', "/orders/$n", qt_body($n))->status, 'PUT sin sesión: 401');
    T::same(401, qt_call('POST', "/orders/$n/send", ['to' => ['a@b.co'], 'pdf' => qt_pdf()])->status, 'POST send sin sesión: 401');
}

// ───────────────────────────────────────── 3 · PUT /orders/:número

/** 3 · Editar: solicitante en minúsculas, líneas, nota; conserva unit de las líneas sin tocar, revalora al cambiar qty, guarda original, rev, edited y history, y no pierde ip ni emailed. */
function test_qt_put_edits_customer_lines_and_note()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $before = qt_rec($n);
    qt_tariff(['TT0020210' => ['p' => 20.0], 'P16633' => ['p' => 100.0], 'R100' => ['p' => 5.5]]);
    $body = qt_body($n, ['customer' => ['name' => 'Ana Pérez López', 'company' => 'ACME S.L.', 'email' => 'ANA.NUEVA@Acme.ES', 'phone' => '611', 'notes' => "Entrega\nen 10 días"],
        'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 4], ['ref' => 'R100', 'qty' => 2, 'price' => 3.5]], 'quoteNote' => "Validez: 30 días.\nIVA no incluido"]);
    $r = qt_call('PUT', "/orders/$n", $body, bearer($s['mgr']));
    T::same([200, true], [$r->status, $r->body['ok']], 'la edición sale bien');
    $o = $r->body['order'];
    T::same(['Ana Pérez López', 'ana.nueva@acme.es', "Entrega\nen 10 días"], [$o['customer']['name'], $o['customer']['email'], $o['customer']['notes']], 'solicitante nuevo, correo en minúsculas');
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 11.9, 'total' => 142.8], ['ref' => 'P16633', 'qty' => 4, 'unit' => 100.0, 'total' => 400.0], ['ref' => 'R100', 'qty' => 2, 'unit' => 3.5, 'total' => 7.0, 'manual' => true]], $o['lines'],
        'la línea sin tocar conserva su unit de antes; la que cambió de cantidad usa la tarifa de hoy; la nueva con precio es manual');
    T::same([549.8, 0], [$o['total'], $o['unpriced']], 'total y sin precio');
    T::same([1, 'jefe@torivac.test', "Validez: 30 días.\nIVA no incluido"], [$o['rev'], $o['edited']['by'], $o['quoteNote']], 'rev 1, quién editó y la nota');
    T::same(true, preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $o['edited']['at']) === 1, 'edited.at es ISO UTC');
    T::same(['at' => $before['at'], 'customer' => $before['customer'], 'lines' => $before['lines'], 'total' => 345.75, 'unpriced' => 0], $o['original'], 'original = lo que llegó de la web');
    T::same([[$o['edited']['at'], 'jefe@torivac.test', 'edit', 1]], array_map(function ($h) { return [$h['at'], $h['by'], $h['kind'], $h['rev']]; }, $o['history']), 'una anotación de edición');
    T::same('2026-11-01T00:00:00.000Z', $o['prices']['updated_at'], 'se revaloró con la tarifa de ahora: prices pasa a ser la de ahora');
    $disk = qt_rec($n);
    T::same([$before['ip'], $before['emailed'], $before['lang'], $before['number'], $before['at']], [$disk['ip'], $disk['emailed'], $disk['lang'], $disk['number'], $disk['at']], 'el registro no pierde ip ni emailed (ni número, fecha e idioma)');
    T::same($o, $disk, 'la respuesta es el registro guardado (un manager lo ve entero)');
    // quitar la nota con cadena vacía; sin quoteNote ni customer se conservan; si no se revalora nada, prices no cambia aunque la tarifa sea otra
    qt_tariff(['TT0020210' => ['p' => 30.0], 'P16633' => ['p' => 200.0], 'R100' => ['p' => 9.0]], '2026-12-01T00:00:00.000Z');
    $r2 = qt_call('PUT', "/orders/$n", ['rev' => 1, 'lines' => [['ref' => 'TT0020210', 'qty' => 12]]], bearer($s['mgr']));
    T::same([200, 'ana.nueva@acme.es', "Validez: 30 días.\nIVA no incluido", 1], [$r2->status, $r2->body['order']['customer']['email'], $r2->body['order']['quoteNote'], count($r2->body['order']['lines'])], 'sin customer ni quoteNote se conservan; se puede quitar una línea');
    $r3 = qt_call('PUT', "/orders/$n", ['rev' => 2, 'quoteNote' => '', 'lines' => [['ref' => 'TT0020210', 'qty' => 12]]], bearer($s['mgr']));
    T::same([200, false, 3], [$r3->status, array_key_exists('quoteNote', $r3->body['order']), $r3->body['order']['rev']], 'quoteNote vacía = quitarla');
    T::same(['2026-11-01T00:00:00.000Z', 11.9], [$r3->body['order']['prices']['updated_at'], $r3->body['order']['lines'][0]['unit']], 'si no se revalora nada, prices no cambia y la línea sigue en su precio guardado');
}

/** 3 · Precios: sin price se conserva si ref y qty son los mismos; price número = manual; price:null = tarifa; a consultar; 0 vale; decimales y topes. */
function test_qt_put_pricing_rules()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $h = bearer($s['mgr']);
    $r = qt_call('PUT', "/orders/$n", ['rev' => 0, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3, 'price' => 70.1234], ['ref' => 'R100', 'qty' => 5]]], $h);
    $o = $r->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 11.9, 'total' => 142.8], ['ref' => 'P16633', 'qty' => 3, 'unit' => 70.1234, 'total' => 210.37, 'manual' => true], ['ref' => 'R100', 'qty' => 5, 'unit' => null, 'total' => null]], $o['lines'],
        'manual con 4 decimales; sin precio en la tarifa = «a consultar»');
    T::same([353.17, 1], [$o['total'], $o['unpriced']], 'total = suma de los no nulos; unpriced = líneas sin precio');
    $r = qt_call('PUT', "/orders/$n", ['rev' => 1, 'lines' => [['ref' => 'TT0020210', 'qty' => 50], ['ref' => 'P16633', 'qty' => 3, 'price' => null], ['ref' => 'R100', 'qty' => 5]]], $h);
    $o = $r->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 50, 'unit' => 11.4, 'total' => 570.0], ['ref' => 'P16633', 'qty' => 3, 'unit' => 67.65, 'total' => 202.95], ['ref' => 'R100', 'qty' => 5, 'unit' => null, 'total' => null]], $o['lines'],
        'qty distinta = tramo de la tarifa; price:null = tarifa y desaparece manual');
    qt_tariff(['TT0020210' => ['p' => 12.37], 'P16633' => ['p' => 67.65], 'R100' => ['p' => 5.5]]);
    $o = qt_call('PUT', "/orders/$n", ['rev' => 2, 'lines' => [['ref' => 'TT0020210', 'qty' => 50], ['ref' => 'P16633', 'qty' => 3], ['ref' => 'R100', 'qty' => 5]]], $h)->body['order'];
    T::same([null, null], [$o['lines'][2]['unit'], $o['lines'][2]['total']], 'una línea «a consultar» NO se revalora sola aunque la tarifa ya tenga precio');
    $o = qt_call('PUT', "/orders/$n", ['rev' => 3, 'lines' => [['ref' => 'TT0020210', 'qty' => 50], ['ref' => 'P16633', 'qty' => 3], ['ref' => 'R100', 'qty' => 5, 'price' => null]]], $h)->body['order'];
    T::same([5.5, 27.5, 0, 800.45], [$o['lines'][2]['unit'], $o['lines'][2]['total'], $o['unpriced'], $o['total']], 'price:null la lleva a la tarifa de hoy (y TT50 sigue en 11,4 guardado)');
    $o = qt_call('PUT', "/orders/$n", ['rev' => 4, 'lines' => [['ref' => 'TT0020210', 'qty' => 1, 'price' => 0]], 'quoteNote' => ''], $h)->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 1, 'unit' => 0.0, 'total' => 0.0, 'manual' => true], 0.0, 0], [$o['lines'][0], $o['total'], $o['unpriced']], 'precio 0 es válido: línea valorada a 0');
    // topes y decimales del precio
    foreach ([[12.5, 200], [0.0001, 200], [9999999.9999, 200], [10000000, 200], [1.23456, 400], [10000000.01, 400], [-1, 400], [-0.0001, 400], ['12', 400], [true, 400], [[], 400], [['a' => 1], 400]] as [$price, $st]) {
        $rev = qt_rec($n)['rev'];
        $x = qt_call('PUT', "/orders/$n", ['rev' => $rev, 'lines' => [['ref' => 'TT0020210', 'qty' => 1, 'price' => $price]]], $h);
        T::same($st, $x->status, 'precio ' . json_encode($price) . ' → ' . $st);
        if ($st === 400) T::same('Precio no válido para TT0020210', $x->body['error'], 'precio ' . json_encode($price) . ': su texto');
    }
    $x = qt_call('PUT', "/orders/$n", '{"rev":' . qt_rec($n)['rev'] . ',"lines":[{"ref":"TT0020210","qty":1,"price":1e999}]}', $h);
    T::same(400, $x->status, 'un precio infinito (1e999) se rechaza');
    $big = qt_call('PUT', "/orders/$n", ['rev' => qt_rec($n)['rev'], 'lines' => [['ref' => 'TT0020210', 'qty' => 1000000, 'price' => 9999999.9999]]], $h)->body['order'];
    T::same([\Torivac\Util::round2(9999999.9999 * 1000000), 1000000], [$big['total'], $big['lines'][0]['qty']], 'cantidad máxima × precio máximo, redondeado a céntimos');
}

/** 3 · original se guarda una sola vez; rev sube de uno en uno; history crece y se corta en 50 (se descartan las más antiguas). */
function test_qt_put_original_once_and_history_capped_at_50()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $first = qt_rec($n);
    $original = null;
    for ($i = 1; $i <= 55; $i++) {
        $r = qt_call('PUT', "/orders/$n", qt_body($n, ['quoteNote' => "nota $i", 'customer' => ['name' => "Nombre $i", 'company' => '', 'email' => 'ana@acme.es', 'phone' => '', 'notes' => '']]), bearer($i % 2 ? $s['mgr'] : $s['own']));
        T::same(200, $r->status, "edición $i");
        if ($i === 1) $original = $r->body['order']['original'];
    }
    $o = qt_rec($n);
    T::same(55, $o['rev'], 'rev = número de ediciones');
    T::same(['at' => $first['at'], 'customer' => $first['customer'], 'lines' => $first['lines'], 'total' => $first['total'], 'unpriced' => $first['unpriced']], $o['original'], 'original = lo primero que llegó, aunque se edite 55 veces');
    T::same($original, $o['original'], 'y no cambió desde la primera edición');
    T::same([50, 6, 55, 'edit'], [count($o['history']), $o['history'][0]['rev'], $o['history'][49]['rev'], $o['history'][49]['kind']], 'history se corta en 50: se pierden las 5 más antiguas');
    T::same(['duena@torivac.test', 'jefe@torivac.test'], [$o['history'][48]['by'], $o['history'][49]['by']], 'cada anotación lleva quién editó');
    T::same('Nombre 55', $o['customer']['name'], 'y el registro tiene la última edición');
}

/** 3 · rev viejo → 409 con el registro actual; rev ausente o raro → 400; el 409 no cambia nada. */
function test_qt_put_conflict_on_stale_rev()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $a = qt_call('PUT', "/orders/$n", qt_body($n, ['quoteNote' => 'de Jefe']), bearer($s['mgr']));
    T::same([200, 1], [$a->status, $a->body['order']['rev']], 'la primera persona guarda (rev 0 → 1)');
    $b = qt_call('PUT', "/orders/$n", qt_body($n, ['rev' => 0, 'quoteNote' => 'de la dueña']), bearer($s['own']));
    T::same([409, false, 'conflict', 'Alguien ha modificado este presupuesto: recarga y vuelve a intentarlo'], [$b->status, $b->body['ok'], $b->body['code'], $b->body['error']], 'la segunda, con el rev que cargó (0), recibe 409');
    T::same([1, 'de Jefe', false], [$b->body['order']['rev'], $b->body['order']['quoteNote'], array_key_exists('ip', $b->body['order'])], 'el 409 trae el registro actual (sin ip para un propietario)');
    T::same(['de Jefe', 1], [qt_rec($n)['quoteNote'], qt_rec($n)['rev']], 'y no se guardó nada');
    $m = qt_call('PUT', "/orders/$n", qt_body($n, ['rev' => 0]), master());
    T::same([409, true], [$m->status, array_key_exists('ip', $m->body['order'])], 'el token maestro también recibe el 409, con ip');
    T::same(409, qt_call('PUT', "/orders/$n", qt_body($n, ['rev' => 7]), bearer($s['mgr']))->status, 'un rev adelantado tampoco coincide: 409');
    foreach ([['sin rev', ['lines' => [['ref' => 'TT0020210', 'qty' => 1]]]], ['rev texto', qt_body($n, ['rev' => '1'])], ['rev negativo', qt_body($n, ['rev' => -1])], ['rev decimal', qt_body($n, ['rev' => 1.5])], ['rev null', qt_body($n, ['rev' => null])]] as [$why, $body]) {
        $x = qt_call('PUT', "/orders/$n", $body, bearer($s['mgr']));
        T::same([400, 'rev'], [$x->status, $x->body['field'] ?? null], "$why: 400");
    }
    T::same(200, qt_call('PUT', "/orders/$n", qt_body($n, ['rev' => 1.0]), bearer($s['mgr']))->status, 'un 1.0 de JSON vale como entero');
}

/** 3 · Validación del PUT: referencia desconocida o repetida, cantidades, texto con HTML, correo, nombre, cuerpo grande o roto; nada de eso modifica el registro. */
function test_qt_put_validation()
{
    $s = qt_setup();
    Config::set(array_merge(Config::all(), ['form_min_fill_ms' => 1200, 'turnstile_secret' => 'secreto-turnstile-de-pruebas']));       // el panel no manda `_e` ni Turnstile ni privacy: ya hay sesión
    $n = $s['n'][0];
    $h = bearer($s['mgr']);
    $line = ['ref' => 'TT0020210', 'qty' => 1];
    $cust = ['name' => 'Ana', 'company' => '', 'email' => 'ana@acme.es', 'phone' => '', 'notes' => ''];
    $cases = [
        ['ref desconocida', ['lines' => [['ref' => 'NOPE', 'qty' => 1]]], 'Referencia desconocida: NOPE', null, null],
        ['ref vacía', ['lines' => [['ref' => '', 'qty' => 1]]], 'Referencia desconocida: (vacía)', null, null],
        ['ref repetida', ['lines' => [$line, ['ref' => 'P16633', 'qty' => 2], $line]], 'Línea repetida: TT0020210', null, null],
        ['qty 0', ['lines' => [['ref' => 'TT0020210', 'qty' => 0]]], 'Cantidad no válida para TT0020210', null, null],
        ['qty negativa', ['lines' => [['ref' => 'TT0020210', 'qty' => -3]]], 'Cantidad no válida para TT0020210', null, null],
        ['qty enorme', ['lines' => [['ref' => 'TT0020210', 'qty' => 1000001]]], 'Cantidad no válida para TT0020210', null, null],
        ['qty decimal', ['lines' => [['ref' => 'TT0020210', 'qty' => 1.5]]], 'Cantidad no válida para TT0020210', null, null],
        ['qty texto', ['lines' => [['ref' => 'TT0020210', 'qty' => '3']]], 'Cantidad no válida para TT0020210', null, null],
        ['qty ausente', ['lines' => [['ref' => 'TT0020210']]], 'Cantidad no válida para TT0020210', null, null],
        ['sin líneas', ['lines' => []], 'El presupuesto está vacío', null, null],
        ['líneas que no son lista', ['lines' => ['a' => $line]], 'El presupuesto está vacío', null, null],
        ['201 líneas', ['lines' => array_fill(0, 201, $line)], 'Demasiadas líneas (máx. 200)', null, null],
        ['ref que no es texto', ['lines' => [['ref' => ['x'], 'qty' => 1]]], 'Petición no válida', null, null],
        ['HTML en el nombre', ['customer' => ['name' => '<b>Ana</b>'] + $cust], null, 'plain_text', 'name'],
        ['HTML en la empresa', ['customer' => ['company' => '<script>alert(1)</script>'] + $cust], null, 'plain_text', 'company'],
        ['HTML en las notas', ['customer' => ['notes' => 'hola <img src=x onerror=alert(1)>'] + $cust], null, 'plain_text', 'notes'],
        ['teléfono largo', ['customer' => ['phone' => str_repeat('6', 41)] + $cust], null, 'too_long', 'phone'],
        ['nombre largo', ['customer' => ['name' => str_repeat('a', 81)] + $cust], null, 'too_long', 'name'],
        ['HTML en la nota del presupuesto', ['quoteNote' => 'Oferta <iframe src="x"></iframe>'], null, 'plain_text', 'quoteNote'],
        ['nota demasiado larga', ['quoteNote' => str_repeat('a', 1001)], null, 'too_long', 'quoteNote'],
        ['nota que no es texto', ['quoteNote' => 5], 'Petición no válida', null, null],
        ['nota null', ['quoteNote' => null], 'Petición no válida', null, null],
        ['correo malo', ['customer' => ['email' => 'no-es-un-correo'] + $cust], 'Correo no válido', null, null],
        ['correo con coma', ['customer' => ['email' => 'a@b.co,c@d.co'] + $cust], 'Correo no válido', null, null],
        ['nombre corto', ['customer' => ['name' => 'A'] + $cust], 'Falta el nombre', null, null],
        ['cliente sin una clave', ['customer' => ['name' => 'Ana', 'company' => '', 'email' => 'ana@acme.es', 'phone' => '']], 'Petición no válida', null, null],
        ['clave del cliente que no es texto', ['customer' => ['phone' => 600] + $cust], 'Petición no válida', null, null],
        ['cliente null', ['customer' => null], 'Petición no válida', null, null],
        ['cliente lista', ['customer' => ['Ana']], 'Petición no válida', null, null],
    ];
    foreach ($cases as [$why, $over, $error, $code, $field]) {
        $r = qt_call('PUT', "/orders/$n", $over + ['rev' => 0, 'lines' => [$line]], $h);
        T::same(400, $r->status, "$why: 400");
        T::same(false, $r->body['ok'], "$why: ok false");
        if ($error !== null) T::same($error, $r->body['error'], "$why: su texto");
        if ($code !== null) T::same([$code, $field], [$r->body['code'] ?? null, $r->body['field'] ?? null], "$why: code y field");
    }
    $r = qt_call('PUT', "/orders/$n", ['rev' => 0], $h);
    T::same([400, 'El presupuesto está vacío'], [$r->status, $r->body['error']], 'sin lines: 400');
    $disk = qt_rec($n);
    T::same([false, false, false], [array_key_exists('rev', $disk), array_key_exists('original', $disk), array_key_exists('history', $disk)], 'ninguna petición rechazada modificó el registro');
    $r = qt_call('PUT', "/orders/$n", 'esto no es JSON', $h);
    T::same([400, 'Petición no válida'], [$r->status, $r->body['error']], 'cuerpo que no es JSON: 400');
    T::same(400, qt_call('PUT', "/orders/$n", '[1,2,3]', $h)->status, 'cuerpo que es una lista: 400');
    T::same(400, qt_call('PUT', "/orders/$n", '', $h)->status, 'cuerpo vacío: 400');
    $r = qt_call('PUT', "/orders/$n", qt_body($n, ['relleno' => str_repeat('x', 100100)]), $h);
    T::same([413, false], [$r->status, $r->body['ok']], 'cuerpo de más de 100 KB: 413');
    T::same(404, qt_call('PUT', '/orders/TV-20990101-0001', qt_body($n), $h)->status, 'presupuesto que no existe: 404');
    T::same(404, qt_call('PUT', '/orders/..', qt_body($n), $h)->status, 'número raro: 404');
    T::same(404, qt_call('PUT', "/orders/$n/send", qt_body($n), $h)->status, 'PUT en /send: 404');
    T::same(401, qt_call('PUT', "/orders/$n", qt_body($n), bearer('token-que-no-vale'))->status, 'token inválido: 401');
    $ok = qt_call('PUT', "/orders/$n", qt_body($n, ['customer' => ['name' => 'Ana', 'company' => '', 'email' => 'ana@acme.es', 'phone' => '', 'notes' => 'Con 10 % de descuento & envío gratis']]), $h);
    T::same(200, $ok->status, 'sin privacy, sin hp, sin _e y sin Turnstile: una edición válida entra aunque la web los exija');
}

/** 3 · Roles: el propietario (client) edita y no ve la ip; el token maestro firma como «maestro»; el registro conserva la ip. */
function test_qt_put_roles_and_master()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $ip = qt_rec($n)['ip'];
    $own = qt_call('PUT', "/orders/$n", qt_body($n, ['quoteNote' => 'de la dueña']), bearer($s['own']));
    T::same([200, 'duena@torivac.test', false, false], [$own->status, $own->body['order']['edited']['by'], array_key_exists('ip', $own->body['order']), array_key_exists('error', $own->body['order']['emailed'])], 'el propietario edita; la respuesta no lleva ip ni emailed.error');
    T::same($ip, qt_rec($n)['ip'], 'pero la ip sigue guardada');
    $m = qt_call('PUT', "/orders/$n", qt_body($n, ['quoteNote' => 'del maestro']), master());
    T::same([200, 'maestro', 2, $ip], [$m->status, $m->body['order']['edited']['by'], $m->body['order']['rev'], $m->body['order']['ip']], 'el token maestro firma como «maestro» y ve la ip');
    T::same(['duena@torivac.test', 'maestro'], array_map(function ($h) { return $h['by']; }, qt_rec($n)['history']), 'el historial lleva a cada una');
}

// ───────────────────────────────────────── 4 · POST /orders/:número/send

/** 4 · Reenviar a 1 y a 3 destinatarios con adjunto: lista normalizada (minúsculas, sin repetir), Reply-To del equipo, cc solo con copyToMe, asunto fijo, historial y lastSent. */
function test_qt_send_basic_recipients_cc_and_history()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $r = qt_send($n, $s['mgr'], ['Cliente@Empresa.com'], ['message' => "Adjunto el presupuesto revisado.\nUn saludo."]);
    T::same([200, true, true, 'sent'], [$r->status, $r->body['ok'], $r->body['sent'], $r->body['reason']], 'sale bien');
    T::same(false, array_key_exists('error', $r->body), 'sin error cuando sale bien');
    $mail = qt_sent(['cliente@empresa.com'])[0] ?? null;
    T::true($mail !== null, 'el correo está en la bandeja, al destinatario en minúsculas');
    T::same([['cliente@empresa.com'], ['jefe@torivac.test'], 'info@grupotorivac.com', "Torivac · presupuesto $n"], [$mail['to'], $mail['cc'], $mail['replyTo'], $mail['subject']], 'to, cc (quien lo envía), Reply-To (primer correo del equipo) y asunto fijo');
    T::same([[['filename' => "$n.pdf", 'content' => qt_pdf()]], true], [$mail['attachments'], strpos($mail['from'], 'pedidos@grupotorivac.com') !== false], 'adjunto <número>.pdf y remitente fijo del dominio');
    $o = $r->body['order'];
    T::same([1, 'send', 0, ['cliente@empresa.com'], true, 'sent', 'jefe@torivac.test'], [count($o['history']), $o['history'][0]['kind'], $o['history'][0]['rev'], $o['history'][0]['to'], $o['history'][0]['ok'], $o['history'][0]['reason'], $o['history'][0]['by']], 'history anota el envío');
    T::same(['at' => $o['history'][0]['at'], 'by' => 'jefe@torivac.test', 'to' => ['cliente@empresa.com'], 'ok' => true, 'reason' => 'sent'], $o['lastSent'], 'lastSent');
    T::same($o, qt_rec($n), 'y el registro guardado es esa misma respuesta');
    T::same(0, $o['rev'] ?? 0, 'reenviar no cambia rev');
    // copyToMe:false, y el token maestro (no es un correo) no se pone en copia
    qt_send($n, $s['mgr'], ['b@x.es'], ['copyToMe' => false]);
    T::same(false, array_key_exists('cc', qt_sent(['b@x.es'])[0]), 'copyToMe:false → sin cc');
    $m = qt_call('POST', "/orders/$n/send", ['to' => ['c@x.es'], 'pdf' => qt_pdf()], master());
    T::same([200, false, 'maestro'], [$m->status, array_key_exists('cc', qt_sent(['c@x.es'])[0]), $m->body['order']['lastSent']['by']], 'el token maestro no va en copia y firma «maestro»');
    // tres destinatarios; mayúsculas y repetidos se unifican; si quien envía ya es destinatario no se duplica en cc
    $t = qt_send($n, $s['own'], ['A@x.es', 'b@x.es', 'a@X.es', 'duena@torivac.test']);
    T::same(200, $t->status, 'cuatro entradas pero tres correos distintos: vale');
    $mail3 = qt_sent(['a@x.es', 'b@x.es', 'duena@torivac.test'])[0] ?? null;
    T::true($mail3 !== null && !array_key_exists('cc', $mail3), 'los tres, en minúsculas y sin repetir; la dueña ya es destinatario → sin cc repetido');
    $t2 = qt_send($n, $s['own'], ['a@y.es', 'b@y.es', 'c@y.es']);
    T::same([200, ['duena@torivac.test']], [$t2->status, qt_sent(['a@y.es', 'b@y.es', 'c@y.es'])[0]['cc'] ?? null], 'tres destinatarios y la propietaria en copia');
    T::same(false, array_key_exists('ip', $t2->body['order']), 'a la propietaria la respuesta no le trae la ip');
    // reenviar y editar no se pisan: la edición conserva history y lastSent; el siguiente envío conserva la edición
    $e = qt_call('PUT', "/orders/$n", qt_body($n, ['quoteNote' => 'revisado']), bearer($s['mgr']));
    T::same([200, 1, 6, 'edit'], [$e->status, $e->body['order']['rev'], count($e->body['order']['history']), $e->body['order']['history'][5]['kind']], 'editar tras reenviar (el rev cargado sigue siendo 0) añade al historial y lo anterior se conserva');
    T::same(['a@y.es', 'b@y.es', 'c@y.es'], $e->body['order']['lastSent']['to'], 'y lastSent sigue ahí');
    $z = qt_send($n, $s['mgr'], ['z@x.es']);
    T::same([1, 'revisado', 7], [$z->body['order']['history'][6]['rev'], $z->body['order']['quoteNote'], count($z->body['order']['history'])], 'un envío posterior anota el rev actual y conserva la edición');
}

/** 4 · Validación del envío: 4 destinatarios, correo malo, sin pdf o pdf falso, mensaje con HTML, 404, 413; nada sale, nada se anota y no gastan cupo. */
function test_qt_send_validation_does_not_send_or_spend_quota()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $big = base64_encode("%PDF-1.4\n" . str_repeat('A', 4000001));
    $cases = [
        ['cuatro destinatarios', ['to' => ['a@x.es', 'b@x.es', 'c@x.es', 'd@x.es'], 'pdf' => qt_pdf()], 'Máximo 3 destinatarios', 'to'],
        ['to ausente', ['pdf' => qt_pdf()], 'Indica al menos un destinatario', 'to'],
        ['to vacío', ['to' => [], 'pdf' => qt_pdf()], 'Indica al menos un destinatario', 'to'],
        ['to texto', ['to' => 'a@x.es', 'pdf' => qt_pdf()], 'Indica al menos un destinatario', 'to'],
        ['correo malo', ['to' => ['no-es-correo'], 'pdf' => qt_pdf()], 'Correo de destino no válido', 'to'],
        ['uno bueno y otro malo', ['to' => ['a@x.es', 'malo'], 'pdf' => qt_pdf()], 'Correo de destino no válido', 'to'],
        ['correo con coma', ['to' => ['a@x.es,b@x.es'], 'pdf' => qt_pdf()], 'Correo de destino no válido', 'to'],
        ['correo con salto de línea y Bcc', ['to' => ["a@x.es\r\nBcc: v@x.es"], 'pdf' => qt_pdf()], 'Correo de destino no válido', 'to'],
        ['destinatario que no es texto', ['to' => [5], 'pdf' => qt_pdf()], 'Petición no válida', null],
        ['sin pdf', ['to' => ['a@x.es']], 'PDF adjunto no válido', 'pdf'],
        ['pdf null', ['to' => ['a@x.es'], 'pdf' => null], 'PDF adjunto no válido', 'pdf'],
        ['pdf vacío', ['to' => ['a@x.es'], 'pdf' => ''], 'PDF adjunto no válido', 'pdf'],
        ['pdf que no es base64', ['to' => ['a@x.es'], 'pdf' => 'esto <no> es base64'], 'PDF adjunto no válido', 'pdf'],
        ['base64 de algo que no es un PDF', ['to' => ['a@x.es'], 'pdf' => base64_encode('MZ no es un pdf')], 'PDF adjunto no válido', 'pdf'],
        ['pdf de más de 4 MB', ['to' => ['a@x.es'], 'pdf' => $big], 'PDF adjunto no válido', 'pdf'],
        ['pdf que no es texto', ['to' => ['a@x.es'], 'pdf' => 12345678], 'PDF adjunto no válido', 'pdf'],
    ];
    foreach ($cases as [$why, $body, $error, $field]) {
        $r = qt_call('POST', "/orders/$n/send", $body, bearer($s['mgr']));
        T::same([400, false, $error], [$r->status, $r->body['ok'], $r->body['error']], "$why: 400 con su texto");
        if ($field !== null) T::same($field, $r->body['field'] ?? null, "$why: field");
    }
    foreach ([['mensaje con HTML', '<b>hola</b>', 'plain_text'], ['mensaje con script', 'mira <script>alert(1)</script>', 'plain_text'], ['mensaje demasiado largo', str_repeat('a', 1501), 'too_long']] as [$why, $msg, $code]) {
        $r = qt_call('POST', "/orders/$n/send", ['to' => ['a@x.es'], 'pdf' => qt_pdf(), 'message' => $msg], bearer($s['mgr']));
        T::same([400, $code, 'message'], [$r->status, $r->body['code'] ?? null, $r->body['field'] ?? null], "$why: 400 con code y field");
    }
    $r = qt_call('POST', "/orders/$n/send", ['to' => ['a@x.es'], 'pdf' => qt_pdf(), 'message' => ['x']], bearer($s['mgr']));
    T::same([400, 'Petición no válida'], [$r->status, $r->body['error']], 'mensaje que no es texto: 400');
    T::same(404, qt_call('POST', '/orders/TV-20990101-0001/send', ['to' => ['a@x.es'], 'pdf' => qt_pdf()], bearer($s['mgr']))->status, 'presupuesto que no existe: 404');
    T::same(404, qt_call('POST', '/orders/../send', ['to' => ['a@x.es'], 'pdf' => qt_pdf()], bearer($s['own']))->status, 'número raro: 404 (también para el propietario)');
    T::same(404, qt_call('GET', "/orders/$n/send", null, bearer($s['mgr']))->status, 'GET en /send: 404');
    T::same(400, qt_call('POST', "/orders/$n/send", 'no es json', bearer($s['mgr']))->status, 'cuerpo que no es JSON: 400');
    $huge = qt_call('POST', "/orders/$n/send", '{"to":["a@x.es"],"pdf":"' . str_repeat('A', 6000100) . '"}', bearer($s['mgr']));
    T::same(413, $huge->status, 'cuerpo de más de 6 MB: 413');
    T::same([0, false, false], [count(qt_sent()), array_key_exists('history', qt_rec($n)), array_key_exists('lastSent', qt_rec($n))], 'no salió ningún correo y no se anotó nada');
    for ($i = 0; $i < 25; $i++) qt_call('POST', "/orders/$n/send", ['to' => ['malo'], 'pdf' => qt_pdf()], bearer($s['mgr']));
    $ok = qt_send($n, $s['mgr'], ['bueno@x.es']);
    T::same(200, $ok->status, 'tras 25 peticiones inválidas todavía se puede enviar: no gastaron cupo (el tope es 20 por hora)');
}

/** 4 · Asunto y texto fijo según el idioma del pedido (es, en, fr, de; otro = es); mensaje escapado con <br>; tabla con los precios GUARDADOS (no los de la tarifa); nota del presupuesto. */
function test_qt_send_language_escaping_and_stored_prices()
{
    $s = qt_setup();
    $msg = "Precio < 50 € & envío incluido\nSegunda línea";
    $want = [
        'es' => ['Torivac · presupuesto %s', 'Presupuesto %s', 'Te enviamos el presupuesto con los importes de Torivac', '345,75', '11,90', '20,00'],
        'en' => ['Torivac · quote %s', 'Quote %s', 'Here is the quote with the amounts from Torivac', '€345.75', '€11.90', '€20.00'],
        'fr' => ['Torivac · devis %s', 'Devis %s', 'Voici le devis avec les montants de Torivac', '345,75', '11,90', '20,00'],
        'de' => ['Torivac · Angebot %s', 'Angebot %s', 'Hier ist das Angebot mit den Beträgen von Torivac', '345,75', '11,90', '20,00'],
    ];
    $orders = [];
    foreach ($want as $lang => $_) $orders[$lang] = so_post(goodOrder(['lang' => $lang, 'customer' => so_customer(['email' => "cli-$lang@acme.es"])]))->body['number'];
    qt_tariff(['TT0020210' => ['p' => 20.0], 'P16633' => ['p' => 100.0]]);                             // la tarifa de hoy NO es la que se guardó en los pedidos
    foreach ($want as $lang => [$subject, $title, $intro, $total, $unit, $tariff]) {
        $n = $orders[$lang];
        $to = ["dest-$lang@empresa.com"];
        $r = qt_send($n, $s['mgr'], $to, ['message' => $msg]);
        T::same([200, true], [$r->status, $r->body['sent']], "$lang: enviado");
        $m = qt_sent($to)[0];
        T::same(sprintf($subject, $n), $m['subject'], "$lang: asunto fijo en su idioma");
        T::true(strpos($m['html'], '<h2 style="margin:0;color:#9c520f">' . sprintf($title, $n)) !== false, "$lang: título en su idioma");
        T::true(strpos($m['html'], sprintf($intro, $n)) !== false && strpos($m['text'], sprintf($intro, $n)) !== false, "$lang: texto fijo en su idioma (HTML y texto)");
        T::true(strpos($m['html'], $total) !== false && strpos($m['text'], $total) !== false, "$lang: total con el formato de su idioma");
        T::true(strpos($m['html'], 'Precio &lt; 50 € &amp; envío incluido<br>') !== false && strpos($m['html'], 'Precio < 50') === false, "$lang: el mensaje sale escapado y con los saltos como <br>");
        T::true(strpos($m['text'], "Precio < 50 € & envío incluido\nSegunda línea") !== false, "$lang: en texto plano, tal cual");
        T::true(strpos($m['html'], 'Transformador serie TT 20 VA') !== false && strpos($m['html'], 'TT0020210') !== false, "$lang: líneas con el nombre del catálogo");
        T::true(strpos($m['html'], $unit) !== false && strpos($m['html'], $tariff) === false, "$lang: lleva el precio guardado ($unit) y no el de la tarifa de hoy ($tariff)");
    }
    // idioma desconocido o ausente en el registro → castellano
    $n = so_post(goodOrder(['customer' => so_customer(['email' => 'raro@acme.es'])]))->body['number'];
    $o = qt_rec($n); $o['lang'] = 'xx'; Store::put('order:' . $n, $o, 86400);
    qt_send($n, $s['mgr'], ['raro@empresa.com']);
    T::same("Torivac · presupuesto $n", qt_sent(['raro@empresa.com'])[0]['subject'], 'idioma desconocido → es');
    // precios manuales y nota del presupuesto, escapados
    $n = $s['n'][0];
    qt_tariff(['TT0020210' => ['p' => 20.0], 'P16633' => ['p' => 100.0]]);
    qt_call('PUT', "/orders/$n", qt_body($n, ['lines' => [['ref' => 'TT0020210', 'qty' => 12, 'price' => 10.5], ['ref' => 'P16633', 'qty' => 3]], 'quoteNote' => "Validez: 30 días & pago a 30 días\nTransporte no incluido"]), bearer($s['mgr']));
    qt_send($n, $s['mgr'], ['nota@empresa.com']);
    $m = qt_sent(['nota@empresa.com'])[0];
    T::true(strpos($m['html'], '10,50') !== false && strpos($m['html'], '126,00') !== false, 'el precio manual (10,50) y su importe (126,00)');
    T::true(strpos($m['html'], '67,65') !== false && strpos($m['html'], '202,95') !== false, 'la línea sin tocar conserva su precio de antes (67,65), no el de la tarifa de hoy (100)');
    T::true(strpos($m['html'], '328,95') !== false && strpos($m['text'], '328,95') !== false, 'total del registro: 126 + 202,95');
    T::true(strpos($m['html'], 'Nota del presupuesto') !== false && strpos($m['html'], 'Validez: 30 días &amp; pago a 30 días<br>') !== false, 'la nota sale escapada y con <br>');
    T::true(strpos($m['text'], "Nota del presupuesto:\nValidez: 30 días & pago a 30 días\nTransporte no incluido") !== false, 'y en texto plano');
}

/** 4 · Mail::quoteMail escapa SIEMPRE lo que escribe una persona, aunque no pasara por PlainText (defensa en profundidad). */
function test_qt_quote_mail_escapes_everything()
{
    fresh();
    $m = Mail::quoteMail(['number' => 'TV-20261028-0001', 'lang' => 'es', 'lines' => [['ref' => '<b>X</b>', 'qty' => 1, 'unit' => 1.0, 'total' => 1.0], ['ref' => 'R2', 'qty' => 2, 'unit' => null, 'total' => null]], 'total' => 1.0, 'unpriced' => 1,
        'message' => "<script>alert(1)</script>\nlínea \"2\"", 'note' => '<img src=x onerror=1>'], ['<b>X</b>' => ['n' => '<i>nombre</i>']]);
    foreach (['<script', '<img', '<i>nombre', '<b>X'] as $bad) T::true(strpos($m['html'], $bad) === false, "el HTML no lleva «{$bad}» sin escapar");
    foreach (['&lt;script&gt;alert(1)&lt;/script&gt;<br>', '&lt;img src=x onerror=1&gt;', '&lt;i&gt;nombre&lt;/i&gt;', 'línea &quot;2&quot;', '—'] as $good) T::true(strpos($m['html'], $good) !== false, "el HTML lleva «{$good}»");
    T::same('Torivac · presupuesto TV-20261028-0001', $m['subject'], 'asunto fijo');
    T::true(strpos($m['text'], '1 línea(s) «A consultar» no incluidas en el total') !== false, 'aviso de líneas a consultar');
}

/** 4 · Topes: 20 por hora y persona (la 21.ª es 429 sin enviar), por persona y no global, la ventana se renueva, 150 al día en total (configurable, 0 = ninguno). */
function test_qt_send_rate_limits()
{
    $s = qt_setup();
    $n = $s['n'][0];
    $now = 1793170800000;
    $who = ['role' => 'manager', 'sub' => 'jefe@torivac.test'];
    for ($i = 1; $i <= 20; $i++) {
        $r = Quotes::handle(req('POST', "/orders/$n/send", ['to' => ['cliente@empresa.com'], 'pdf' => qt_pdf()]), $who, $now + $i);
        T::same(200, $r->status, "reenvío $i de 20");
    }
    $r = Quotes::handle(req('POST', "/orders/$n/send", ['to' => ['cliente@empresa.com'], 'pdf' => qt_pdf()]), $who, $now + 21);
    T::same([429, false, 'Demasiados reenvíos seguidos. Espera un rato.'], [$r->status, $r->body['ok'], $r->body['error']], 'el 21.º en una hora: 429');
    T::same([20, 20], [count(qt_sent()), count(qt_rec($n)['history'])], 'el 429 no envía ni anota');
    T::same(200, Quotes::handle(req('POST', "/orders/$n/send", ['to' => ['otra@empresa.com'], 'pdf' => qt_pdf()]), ['role' => 'client', 'sub' => 'duena@torivac.test'], $now + 22)->status, 'otra persona tiene su propio tope');
    $later = Quotes::handle(req('POST', "/orders/$n/send", ['to' => ['cliente@empresa.com'], 'pdf' => qt_pdf()]), $who, $now + 3600000 + 25);
    T::same(200, $later->status, 'pasada la hora la ventana se renueva');
    // tope diario en total
    $s2 = qt_setup(['order_send_daily_max' => 3]);
    $n2 = $s2['n'][0];
    foreach ([[$s2['mgr'], 'a1@x.es'], [$s2['own'], 'a2@x.es']] as [$tok, $to]) T::same(200, qt_send($n2, $tok, [$to])->status, "tope diario: $to");
    T::same(200, qt_call('POST', "/orders/$n2/send", ['to' => ['a3@x.es'], 'pdf' => qt_pdf()], master())->status, 'tope diario: el tercero (token maestro)');
    $r = qt_send($n2, $s2['own'], ['a4@x.es']);
    T::same([429, 'Demasiados reenvíos seguidos. Espera un rato.'], [$r->status, $r->body['error']], 'el cuarto del día, de cualquiera: 429');
    T::same(3, count(qt_sent()), 'solo salieron tres');
    $s3 = qt_setup(['order_send_daily_max' => 0]);
    foreach ([[$s3['mgr'], 'b1@x.es'], [$s3['own'], 'b2@x.es'], [$s3['mgr'], 'b3@x.es'], [$s3['own'], 'b4@x.es']] as [$tok, $to]) T::same(200, qt_send($s3['n'][0], $tok, [$to])->status, "sin tope diario (0): $to");
    $s4 = qt_setup(['order_send_daily_max' => 'mucho']);
    T::same([150, 200], [Quotes::sendDailyMax(), qt_send($s4['n'][0], $s4['mgr'], ['c1@x.es'])->status], 'un valor que no es número vuelve a 150');
}

/** 4 · Sin correo configurado: 409 mail_off, sin gastar cupo y sin anotar historial; al configurarlo, el mismo envío funciona. */
function test_qt_send_mail_off()
{
    $s = qt_setup(['mail' => ['driver' => 'none']]);
    $n = $s['n'][0];
    $r = qt_send($n, $s['mgr'], ['cliente@empresa.com']);
    T::same([409, false, 'mail_off', 'El correo no está configurado: el presupuesto no se puede enviar desde aquí. Descarga el PDF y envíalo tú.'], [$r->status, $r->body['ok'], $r->body['code'], $r->body['error']], '409 mail_off con su texto');
    for ($i = 0; $i < 25; $i++) qt_send($n, $s['own'], ['cliente@empresa.com']);
    T::same([false, false], [array_key_exists('history', qt_rec($n)), array_key_exists('lastSent', qt_rec($n))], 'no se anota nada en el historial');
    T::same(400, qt_send($n, $s['mgr'], ['malo'])->status, 'lo inválido sigue siendo 400 (antes que el 409)');
    Config::set(array_merge(Config::all(), ['mail' => ['driver' => 'file']]));
    $ok = qt_send($n, $s['own'], ['cliente@empresa.com']);
    T::same([200, true, 1], [$ok->status, $ok->body['sent'], count($ok->body['order']['history'])], 'con el correo configurado funciona: los 26 intentos de antes no gastaron cupo');
}

/** 4 · Fallo del proveedor: 200 con sent:false, historial ok:false y lastSent; error solo para manager y sin secretos; el cupo no se devuelve; el texto del error no se guarda. */
function test_qt_send_provider_failure()
{
    $s = qt_setup();
    Config::set(array_merge(Config::all(), ['mail' => ['driver' => 'resend', 'resend_api_key' => 're_test_clave_secreta_1234567890']]));
    Http::$mock = function () { return [403, 'x']; };
    $n = $s['n'][0];
    $r = qt_send($n, $s['mgr'], ['cliente@empresa.com']);
    T::same([200, true, false, 'failed', 'Resend respondió 403'], [$r->status, $r->body['ok'], $r->body['sent'], $r->body['reason'], $r->body['error'] ?? null], 'manager: 200, sent:false, reason failed y el error corto');
    T::true(strpos(json_encode($r->body), 're_test_clave_secreta') === false, 'sin secretos en la respuesta');
    $o = $r->body['order'];
    T::same([false, 'failed', 'send', 1], [$o['history'][0]['ok'], $o['history'][0]['reason'], $o['history'][0]['kind'], count($o['history'])], 'el fallo queda en history');
    T::same([false, 'failed', ['cliente@empresa.com']], [$o['lastSent']['ok'], $o['lastSent']['reason'], $o['lastSent']['to']], 'y en lastSent');
    T::true(strpos(json_encode(qt_rec($n)), 'Resend respondió') === false, 'el texto del error NO se guarda en el registro');
    $p = qt_send($n, $s['own'], ['cliente@empresa.com']);
    T::same([200, false, 'failed', false, false], [$p->status, $p->body['sent'], $p->body['reason'], array_key_exists('error', $p->body), array_key_exists('ip', $p->body['order'])], 'propietario: mismo resultado, pero sin error ni ip');
    for ($i = 0; $i < 18; $i++) qt_send($n, $s['mgr'], ['cliente@empresa.com']);
    $x = qt_send($n, $s['mgr'], ['cliente@empresa.com']);
    T::same([200, false], [$x->status, $x->body['sent']], 'el 20.º envío del manager (todos fallidos) todavía se intenta');
    $y = qt_send($n, $s['mgr'], ['cliente@empresa.com']);
    T::same([429, 'Demasiados reenvíos seguidos. Espera un rato.'], [$y->status, $y->body['error']], 'los envíos fallidos gastan cupo: el 21.º es 429');
    T::same([21, false], [count(qt_rec($n)['history']), qt_rec($n)['history'][20]['ok']], 'el 429 no anota nada: 20 del manager + 1 de la propietaria');
}

/** Auditoría: cada edición y cada reenvío queda en Actividad; el correo del destinatario va con la parte local enmascarada. */
function test_qt_edit_and_send_are_audited()
{
    $s = qt_setup();
    $n = $s['n'][0];
    qt_call('PUT', "/orders/$n", qt_body($n, ['quoteNote' => 'x']), bearer($s['mgr']));
    qt_send($n, $s['own'], ['Cliente@Empresa.com', 'otra.persona@correo.es']);
    qt_call('POST', "/orders/$n/send", ['to' => ['x@y.es'], 'pdf' => qt_pdf()], master());
    $items = Audit::read(1, 50, ['cat' => 'order'])['items'];
    $by = [];
    foreach ($items as $e) $by[$e['a'] . '|' . $e['u']] = $e;
    T::same("$n rev 1", $by['order.edit|jefe@torivac.test']['d'] ?? null, 'order.edit con el número y el rev');
    T::same(['Editó un presupuesto recibido', 'manager'], [$by['order.edit|jefe@torivac.test']['label'] ?? null, $by['order.edit|jefe@torivac.test']['r'] ?? null], 'con su nombre en castellano y el rol');
    T::same("$n → c***@empresa.com, o***@correo.es", $by['order.send|duena@torivac.test']['d'] ?? null, 'order.send con las partes locales enmascaradas');
    T::same('client', $by['order.send|duena@torivac.test']['r'] ?? null, 'y el rol de la propietaria');
    T::same("$n → x***@y.es", $by['order.send|master']['d'] ?? null, 'el token maestro también queda');
    T::true(strpos(json_encode($items), 'otra.persona') === false && strpos(json_encode($items), 'cliente@empresa') === false, 'ningún correo completo en el registro');
    qt_call('PUT', "/orders/$n", qt_body($n, ['rev' => 0]), bearer($s['mgr']));
    T::same(1, count(array_filter(Audit::read(1, 50, ['cat' => 'order'])['items'], function ($e) { return $e['a'] === 'order.edit'; })), 'una edición rechazada (409) no se anota');
}
