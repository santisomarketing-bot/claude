<?php
/**
 * Pruebas de los precios por categoría (Pricing.php, docs/PRECIOS-Y-CLIENTES.md §7): el cálculo de las cuatro categorías (VIP, VIP +5, VIP +10, Normal) con tramos y redondeo a 4 decimales, GET /prices según quién llama
 * (manager y propietario, cliente, visitante con anon normal / consult + aproximado / consult apagado), los ajustes GET y PUT /settings/pricing, la edición de un producto PUT /prices/items/:ref (marca «manual», aproximado,
 * histórico) y que la sincronización con la hoja (merge y replace) y la IA respeten lo editado a mano. Los pedidos y los clientes están en CustomersTest.php. Sin red: el correo es el controlador «file».
 */
namespace Torivac\Tests;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

use Torivac\Ai;
use Torivac\Audit;
use Torivac\Catalog;
use Torivac\Prices;
use Torivac\Pricing;
use Torivac\Router;
use Torivac\Sheets;
use Torivac\Store;
use Torivac\Users;

/** Almacén con precios, un manager (Jefe), un propietario (María, rol client) y un cliente de cada categoría con sesión → ['mgr' => token, 'own' => token, 'cust' => [categoría => token]]. */
function pr_setup(array $cfg = []): array
{
    fresh($cfg); seedPrices();
    Users::create(['email' => 'jefe@torivac.test', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'maria@torivac.test', 'name' => 'María', 'role' => 'client', 'password' => PW_ANA]);
    $s = ['mgr' => login_token('jefe@torivac.test', PW_JEFE, '10.9.1.1'), 'own' => login_token('maria@torivac.test', PW_ANA, '10.9.1.2'), 'cust' => []];
    foreach (Pricing::TIERS as $i => $t) {
        Users::create(['email' => "cli-$t@acme.es", 'name' => "Cliente $t", 'role' => 'customer', 'tier' => $t, 'password' => PW_CLI]);
        $s['cust'][$t] = login_token("cli-$t@acme.es", PW_CLI, '10.9.2.' . ($i + 1));
    }
    return $s;
}

/** Llama al API como el navegador: método, ruta, cuerpo (array o texto) y, si se da, el token de sesión. */
function pr_call(string $method, string $path, $body = null, ?string $token = null, string $ip = '10.0.0.1')
{
    return Router::handle(req($method, $path, $body, $token === null ? [] : bearer($token), $ip));
}

/** Guarda unos ajustes de precios directamente en el almacén (lo que no se da queda como por defecto). */
function pr_settings(array $over): void { Store::put(Pricing::KEY, array_replace_recursive(Pricing::defaults(), $over)); }

/** Guarda una lista de precios directamente en el almacén. */
function pr_prices(array $items, array $over = []): void
{
    Store::put(Prices::KEY_CURRENT, Prices::forJson($over + ['updated_at' => '2026-10-27T00:00:00.000Z', 'source' => 'upload:jefe@torivac.test', 'currency' => 'EUR', 'mode' => 'live', 'items' => $items]));
}

/** Los precios de una respuesta de GET /prices (items) como array. */
function pr_items($resp): array { return wire($resp)['prices']['items']; }

// ───────────────────────────────────────── 1 · Cálculo

/** 7.1 · Las cuatro categorías sobre `p` y los tramos, con los porcentajes por defecto (5/10/15) y con otros; sin precio → null. */
function test_pr_tier_math_defaults_and_custom_percentages()
{
    fresh(); seedPrices();
    $p = Prices::load();
    $d = Pricing::load();
    T::same(['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'consult', 'approx' => ['on' => false, 'pct' => 15], 'updated' => null], $d, 'ajustes por defecto: 5/10/15, visitante a consultar, aproximado apagado');
    $want = ['vip' => [12.37, 11.9, 11.4], 'vip5' => [12.9885, 12.495, 11.97], 'vip10' => [13.607, 13.09, 12.54], 'normal' => [14.2255, 13.685, 13.11]];       // p, tramo desde 10, tramo desde 50
    foreach ($want as $tier => [$u1, $u10, $u50]) {
        T::same([$u1, $u10, $u50, $u1], [Pricing::unit($p, 'TT0020210', 1, $tier, $d), Pricing::unit($p, 'TT0020210', 10, $tier, $d), Pricing::unit($p, 'TT0020210', 50, $tier, $d), Pricing::unit($p, 'TT0020210', 9, $tier, $d)], "$tier: precio por cantidad (el último tramo alcanzado)");
        T::same(['p' => $u1, 't' => [[10, $u10], [50, $u50]]], Pricing::tierItems($p, $tier, $d)['TT0020210'], "$tier: p y tramos escalados");
    }
    T::same(['p' => 77.7975], Pricing::tierItems($p, 'normal', $d)['P16633'], 'sin tramos no sale `t`');
    T::same(null, Pricing::unit($p, 'NOPE', 1, 'normal', $d), 'una referencia que no existe no tiene precio');
    // otros porcentajes: valen para todos los productos a la vez
    pr_settings(['tiers' => ['vip5' => 3, 'vip10' => 7, 'normal' => 20]]);
    $c = Pricing::load();
    T::same([12.7411, 13.2359, 14.844], [Pricing::unit($p, 'TT0020210', 1, 'vip5', $c), Pricing::unit($p, 'TT0020210', 1, 'vip10', $c), Pricing::unit($p, 'TT0020210', 1, 'normal', $c)], 'con 3/7/20 %');
    T::same([69.6795, 72.3855, 81.18], [Pricing::unit($p, 'P16633', 3, 'vip5', $c), Pricing::unit($p, 'P16633', 3, 'vip10', $c), Pricing::unit($p, 'P16633', 3, 'normal', $c)], 'y en otro producto');
    T::same(12.37, Pricing::unit($p, 'TT0020210', 1, 'vip', $c), 'el VIP no cambia con los porcentajes (siempre 0)');
    // redondeo a 4 decimales (precio unitario) y a 2 (importe de línea)
    pr_prices(['R100' => ['p' => 1.2345, 't' => [[10, 1.0001]]], 'TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]]], 'P16633' => ['p' => 67.65]]);
    $p2 = Prices::load();
    $d2 = Pricing::defaults();
    T::same([1.4197, 1.1501, 1.2962, 1.0501], [Pricing::unit($p2, 'R100', 1, 'normal', $d2), Pricing::unit($p2, 'R100', 10, 'normal', $d2), Pricing::unit($p2, 'R100', 1, 'vip5', $d2), Pricing::unit($p2, 'R100', 10, 'vip5', $d2)], 'el precio unitario conserva hasta 4 decimales (1,419675 → 1,4197)');
    $o = Pricing::priceOrder($p2, [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3], ['ref' => 'NOPE', 'qty' => 1]], 'normal', $d2);
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 13.685, 'total' => 164.22], ['ref' => 'P16633', 'qty' => 3, 'unit' => 77.7975, 'total' => 233.39], ['ref' => 'NOPE', 'qty' => 1, 'unit' => null, 'total' => null]], $o['lines'], 'importe de línea = round2(unit × qty); sin precio = null');
    T::same([397.61, 1], [$o['total'], $o['unpriced']], 'el total suma las líneas y la que no tiene precio no suma');
    $vip = Pricing::priceOrder($p2, [['ref' => 'TT0020210', 'qty' => 12]], 'vip', $d2);
    T::same([11.9, 142.8], [$vip['lines'][0]['unit'], $vip['total']], 'VIP: lo de siempre');
    $c = Pricing::consultOrder([['ref' => 'A', 'qty' => 2], ['ref' => 'B', 'qty' => 1]]);
    T::same([[['ref' => 'A', 'qty' => 2, 'unit' => null, 'total' => null], ['ref' => 'B', 'qty' => 1, 'unit' => null, 'total' => null]], 0, 2], [$c['lines'], $c['total'], $c['unpriced']], '«A consultar»: todas las líneas sin precio y unpriced = nº de líneas');
}

/** 7.1 · Una entrada que solo lleva `a` o `m` (sin `p`) sigue siendo «A consultar» en Prices::unit/priceOrder y en todas las categorías, sin avisos. */
function test_pr_entries_without_p_are_still_to_consult()
{
    fresh(); seedPrices();
    pr_prices(['TT0020210' => ['p' => 12.37], 'R100' => ['a' => 40], 'P16633' => ['m' => true], 'X1' => ['a' => false, 'm' => true]]);
    $p = Prices::load();
    $warn = [];
    set_error_handler(function ($no, $str) use (&$warn) { $warn[] = $str; return true; });
    try {
        T::same([null, null, null, 12.37], [Prices::unit($p, 'R100', 5), Prices::unit($p, 'P16633', 1), Prices::unit($p, 'X1', 1), Prices::unit($p, 'TT0020210', 1)], 'Prices::unit: sin `p` es null');
        $o = Prices::priceOrder($p, [['ref' => 'R100', 'qty' => 2], ['ref' => 'TT0020210', 'qty' => 1]]);
        T::same([[null, null], [12.37, 12.37], 24.74 - 12.37, 1], [[$o['lines'][0]['unit'], $o['lines'][0]['total']], [$o['lines'][1]['unit'], $o['lines'][1]['total']], $o['total'], $o['unpriced']], 'Prices::priceOrder: la línea sin precio no suma');
        foreach (Pricing::TIERS as $t) T::same([null, null], [Pricing::unit($p, 'R100', 1, $t), Pricing::unit($p, 'P16633', 1, $t)], "$t: sin precio sigue siendo null");
        T::same(['TT0020210'], array_keys(Pricing::tierItems($p, 'normal')), 'las entradas sin precio no salen en la vista de una categoría');
        T::same([], array_keys(Prices::diff($p, $p)['changed']), 'Prices::diff aguanta entradas sin `p`');
        $q = $p; $q['items']['R100']['a'] = 41;
        T::same(['R100'], Prices::diff($p, $q)['changed'], 'y cambiar solo `a` cuenta como cambio');
        Ai::buildTable($p, Catalog::items());
        Ai::validateChanges([['ref' => 'R100', 'price' => 9]], $p, Catalog::items());
    } finally { restore_error_handler(); }
    T::same([], $warn, 'ninguna de esas llamadas lanza avisos de PHP');
}

// ───────────────────────────────────────── 4 · Ajustes de precios

/** 7.4 · GET /settings/pricing: valores por defecto; PUT valida (orden vip5 ≤ vip10 ≤ normal, rangos, decimales, tipos) y guarda quién y cuándo; un valor dañado en el almacén vuelve al de por defecto. */
function test_pr_settings_defaults_validation_and_saved_by()
{
    $s = pr_setup();
    $g = pr_call('GET', '/settings/pricing', null, $s['mgr']);
    T::same([200, true, ['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'consult', 'approx' => ['on' => false, 'pct' => 15], 'updated' => null]], [$g->status, $g->body['ok'], $g->body['pricing']], 'por defecto: nada público hasta que se active');
    $good = ['tiers' => ['vip5' => 4, 'vip10' => 9.5, 'normal' => 14.25], 'anon' => 'normal', 'approx' => ['on' => true, 'pct' => 20]];
    $r = pr_call('PUT', '/settings/pricing', $good, $s['mgr']);
    $j = wire($r);
    T::same([200, true, $good['tiers'], 'normal', ['on' => true, 'pct' => 20]], [$r->status, $j['ok'], $j['pricing']['tiers'], $j['pricing']['anon'], $j['pricing']['approx']], 'guarda y devuelve los ajustes');
    T::same('jefe@torivac.test', $j['pricing']['updated']['by'], 'quién guardó');
    T::same(1, preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $j['pricing']['updated']['at']), 'y cuándo (ISO UTC)');
    T::same($j['pricing'], wire(pr_call('GET', '/settings/pricing', null, $s['own']))['pricing'], 'el propietario lo ve igual');
    $m = wire(pr_call('PUT', '/settings/pricing', $good, $s['own']));
    T::same('maria@torivac.test', $m['pricing']['updated']['by'], 'y el propietario también puede guardar: queda su correo');
    T::same('maestro', wire(Router::handle(req('PUT', '/settings/pricing', $good, master())))['pricing']['updated']['by'], 'el token maestro cuenta como «maestro»');
    // validación: cada error dice el campo
    $base = ['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'consult', 'approx' => ['on' => false, 'pct' => 15]];
    $with = function (array $over) use ($base) { return array_replace_recursive($base, $over); };
    $cases = [
        ['vip5 negativo', $with(['tiers' => ['vip5' => -1]]), 'tiers.vip5'], ['vip5 pasa de 100', $with(['tiers' => ['vip5' => 100.5]]), 'tiers.vip5'], ['vip5 con 3 decimales', $with(['tiers' => ['vip5' => 5.123]]), 'tiers.vip5'],
        ['vip5 texto', $with(['tiers' => ['vip5' => '5']]), 'tiers.vip5'], ['vip5 null', $with(['tiers' => ['vip5' => null]]), 'tiers.vip5'], ['vip5 booleano', $with(['tiers' => ['vip5' => true]]), 'tiers.vip5'],
        ['vip10 texto', $with(['tiers' => ['vip10' => 'x']]), 'tiers.vip10'], ['normal pasa de 100', $with(['tiers' => ['normal' => 101]]), 'tiers.normal'], ['normal negativo', $with(['tiers' => ['normal' => -0.5]]), 'tiers.normal'],
        ['vip5 mayor que vip10', $with(['tiers' => ['vip5' => 12]]), 'tiers.vip10'], ['vip10 mayor que normal', $with(['tiers' => ['vip10' => 20]]), 'tiers.normal'],
        ['anon desconocido', $with(['anon' => 'todos']), 'anon'], ['anon que no es texto', $with(['anon' => 5]), 'anon'], ['anon null', $with(['anon' => null]), 'anon'],
        ['approx.pct negativo', $with(['approx' => ['pct' => -1]]), 'approx.pct'], ['approx.pct pasa de 200', $with(['approx' => ['pct' => 201]]), 'approx.pct'], ['approx.pct texto', $with(['approx' => ['pct' => '15']]), 'approx.pct'],
        ['approx.on texto', $with(['approx' => ['on' => 'si']]), 'approx.on'], ['approx.on número', $with(['approx' => ['on' => 1]]), 'approx.on'], ['approx.on null', $with(['approx' => ['on' => null]]), 'approx.on'],
        ['sin tiers', array_diff_key($base, ['tiers' => 1]), 'tiers.vip5'], ['sin anon', array_diff_key($base, ['anon' => 1]), 'anon'], ['sin approx', array_diff_key($base, ['approx' => 1]), 'approx.pct'],
        ['tiers que no es un objeto', $with(['tiers' => 7]), 'tiers.vip5'], ['objeto vacío', [], 'tiers.vip5'],
    ];
    foreach ($cases as [$why, $body, $field]) {
        $x = pr_call('PUT', '/settings/pricing', $body, $s['mgr']);
        T::same([400, false, $field], [$x->status, $x->body['ok'], $x->body['field'] ?? null], "$why → 400 con field $field");
        T::true(is_string($x->body['error']) && $x->body['error'] !== '', "$why: lleva un texto de error");
    }
    foreach ([[0, 0, 0], [0, 100, 100], [10, 10, 10], [7.25, 7.25, 99.99]] as [$a, $b, $c]) T::same(200, pr_call('PUT', '/settings/pricing', $with(['tiers' => ['vip5' => $a, 'vip10' => $b, 'normal' => $c]]), $s['mgr'])->status, "vale $a/$b/$c (0–100, hasta 2 decimales, vip5 ≤ vip10 ≤ normal)");
    foreach ([0, 200, 33.33] as $pct) T::same(200, pr_call('PUT', '/settings/pricing', $with(['approx' => ['pct' => $pct]]), $s['mgr'])->status, "approx.pct $pct vale");
    // cuerpo basura
    foreach (['texto suelto', '[1,2,3]', '', 'null', '"x"', '7'] as $raw) {
        $x = pr_call('PUT', '/settings/pricing', $raw, $s['mgr']);
        T::same([400, 'Petición no válida'], [$x->status, $x->body['error']], 'cuerpo «' . $raw . '»: 400');
    }
    $big = pr_call('PUT', '/settings/pricing', $base + ['relleno' => str_repeat('x', 2100)], $s['mgr']);
    T::same(400, $big->status, 'cuerpo de más de 2 KB: rechazado');
    T::same(200, pr_call('PUT', '/settings/pricing', $base + ['extra' => 'se ignora'], $s['mgr'])->status, 'una clave de más no estorba');
    $saved = wire(pr_call('GET', '/settings/pricing', null, $s['mgr']))['pricing'];
    T::same(['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'consult', 'approx' => ['on' => false, 'pct' => 15]], ['tiers' => $saved['tiers'], 'anon' => $saved['anon'], 'approx' => $saved['approx']], 'los rechazados no tocaron lo guardado (lo último que valió)');
    $log = array_values(array_filter(Audit::read(1, 100, ['cat' => 'settings'])['items'], function ($e) { return $e['a'] === 'settings.pricing'; }));
    T::true(count($log) >= 3 && $log[count($log) - 1]['u'] === 'jefe@torivac.test' && $log[count($log) - 1]['label'] === 'Cambió los ajustes de precios', 'cada guardado queda en Actividad con su nombre en castellano');
}

/** 7.4 · Solo manager y client leen y guardan los ajustes: un cliente con usuario recibe 403 y un visitante 401. */
function test_pr_settings_roles()
{
    $s = pr_setup();
    $body = ['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'normal', 'approx' => ['on' => false, 'pct' => 15]];
    foreach (['GET' => null, 'PUT' => $body] as $m => $b) {
        T::same(401, pr_call($m, '/settings/pricing', $b)->status, "$m sin sesión: 401");
        T::same(401, pr_call($m, '/settings/pricing', $b, 'token-que-no-vale')->status, "$m con sesión inválida: 401");
        T::same(403, pr_call($m, '/settings/pricing', $b, $s['cust']['normal'])->status, "$m como cliente: 403");
        T::same(200, pr_call($m, '/settings/pricing', $b, $s['own'])->status, "$m como propietario: 200");
        T::same(200, pr_call($m, '/settings/pricing', $b, $s['mgr'])->status, "$m como manager: 200");
    }
    T::same(404, pr_call('DELETE', '/settings/pricing', null, $s['mgr'])->status, 'otro método: 404');
    pr_settings(['anon' => 'consult']);
    pr_call('PUT', '/settings/pricing', array_replace($body, ['anon' => 'normal']), $s['cust']['vip']);
    T::same('consult', Pricing::load()['anon'], 'y un PUT de un cliente no guarda nada');
}

/** 7.4 · load() solo devuelve valores válidos: lo dañado o manipulado en el almacén vuelve al valor por defecto y nunca rompe la forma. */
function test_pr_settings_load_ignores_garbage()
{
    fresh();
    $def = Pricing::defaults();
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 'x', 'vip10' => -3, 'normal' => 500], 'anon' => 'raro', 'approx' => ['on' => 'yes', 'pct' => 9999], 'updated' => ['at' => 5, 'by' => 'x']]);
    T::same($def, Pricing::load(), 'todo dañado → por defecto');
    Store::put(Pricing::KEY, 'basura');
    T::same($def, Pricing::load(), 'un valor que no es un objeto → por defecto');
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 3, 'vip10' => 'x', 'normal' => 20], 'anon' => 'normal']);
    $l = Pricing::load();
    T::same([['vip5' => 3, 'vip10' => 10, 'normal' => 20], 'normal', ['on' => false, 'pct' => 15], null], [$l['tiers'], $l['anon'], $l['approx'], $l['updated']], 'cada valor dañado vuelve al suyo (y la forma siempre es completa)');
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 12, 'vip10' => 'x', 'normal' => 20]]);
    T::same(['vip5' => 5, 'vip10' => 10, 'normal' => 15], Pricing::load()['tiers'], 'si, tras arreglar los valores, el orden vip5 ≤ vip10 ≤ normal no se cumple, vuelven los tres 5/10/15');
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 20, 'vip10' => 10, 'normal' => 15]]);
    T::same(['vip5' => 5, 'vip10' => 10, 'normal' => 15], Pricing::load()['tiers'], 'porcentajes en desorden guardados a mano → por defecto');
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 1.005, 'vip10' => 10, 'normal' => 15], 'approx' => ['on' => true, 'pct' => 0], 'updated' => ['at' => '2026-11-01T10:00:00.000Z', 'by' => "ana@x.es\nfalso"]]);
    $l = Pricing::load();
    T::same([5, true, 0, 'ana@x.es falso'], [$l['tiers']['vip5'], $l['approx']['on'], $l['approx']['pct'], $l['updated']['by']], 'tres decimales → por defecto; approx.pct 0 vale; `by` sin saltos de línea');
    T::same(['5', '15'], [(string) Pricing::load()['tiers']['vip5'], (string) Pricing::load()['tiers']['normal']], 'y las claves sueltas no estorban');
}

// ───────────────────────────────────────── 2 · GET /prices según quién llama

/** 7.2 · Manager y propietario ven los precios VIP con las marcas `m` y `a`; el manager además el detalle de la hoja; ambos `meta.manual_count`; nunca se cachea. */
function test_pr_get_prices_staff_sees_vip_with_marks()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9]], 'm' => true, 'a' => 125], 'P16633' => ['p' => 67.65, 'a' => false], 'R100' => ['m' => true]]);
    Store::put(Prices::KEY_META, ['at' => '2026-10-27T00:00:00.000Z', 'reason' => 'upload:jefe@torivac.test', 'source' => 'upload:jefe@torivac.test', 'refs' => 3, 'changed' => 0, 'added' => 3, 'removed' => 0, 'manual_skipped' => 2]);
    Store::put(Prices::KEY_SYNC, ['at' => '2026-10-27T00:00:00.000Z', 'reason' => 'cron', 'ok' => true, 'blocked' => false, 'error' => '']);
    foreach (['manager' => $s['mgr'], 'propietario' => $s['own']] as $who => $tok) {
        $r = pr_call('GET', '/prices', null, $tok);
        $j = wire($r);
        T::same(200, $r->status, "$who: 200");
        T::same(['p' => 12.37, 't' => [[10, 11.9]], 'm' => true, 'a' => 125], $j['prices']['items']['TT0020210'], "$who: precio VIP con m y a");
        T::same(['p' => 67.65, 'a' => false], $j['prices']['items']['P16633'], "$who: a:false se enseña");
        T::same(['m' => true], $j['prices']['items']['R100'], "$who: una entrada sin precio también");
        T::same(2, $j['meta']['manual_count'], "$who: meta.manual_count = referencias editadas a mano");
        T::same(['private, no-store', 'Authorization'], [$r->headers['Cache-Control'], $r->headers['Vary']], "$who: Cache-Control private, no-store y Vary: Authorization");
    }
    $m = wire(pr_call('GET', '/prices', null, $s['mgr']));
    T::same(['upload:jefe@torivac.test', 'upload:jefe@torivac.test', 'cron'], [$m['meta']['reason'], $m['prices']['source'], $m['sync']['reason']], 'el manager ve quién cargó la hoja, de dónde y el estado de la sincronización');
    T::same(2, $m['meta']['manual_skipped'], 'y cuántas manuales respetó la última sincronización');
    $o = wire(pr_call('GET', '/prices', null, $s['own']));
    T::same(['upload', 'upload', false], [$o['meta']['reason'], $o['prices']['source'], array_key_exists('sync', $o)], 'el propietario, como el público: sin quién ni de dónde y sin sync');
    T::true(strpos(json_encode($o), '@') === false, 'ningún correo en la respuesta del propietario');
    $mm = wire(Router::handle(req('GET', '/prices', null, master())));
    T::same(2, $mm['meta']['manual_count'], 'el token maestro cuenta como manager');
    Store::delete(Prices::KEY_META);
    T::same(2, wire(pr_call('GET', '/prices', null, $s['mgr']))['meta']['manual_count'], 'sin meta guardada, manual_count sigue saliendo');
}

/** 7.2 · Un cliente ve los precios de SU categoría (p y tramos escalados, sin m, a ni nombre de categoría); el VIP no aparece; cambiar su categoría cambia lo que ve en la petición siguiente. */
function test_pr_get_prices_customer_sees_own_tier()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]], 'm' => true, 'a' => 125, 'note' => 'DEMO'], 'P16633' => ['p' => 67.65, 'a' => false], 'R100' => ['m' => true]]);
    $want = ['vip' => [12.37, 11.9, 11.4, 67.65], 'vip5' => [12.9885, 12.495, 11.97, 71.0325], 'vip10' => [13.607, 13.09, 12.54, 74.415], 'normal' => [14.2255, 13.685, 13.11, 77.7975]];
    foreach ($want as $tier => [$p, $t10, $t50, $p2]) {
        $r = pr_call('GET', '/prices', null, $s['cust'][$tier]);
        $j = wire($r);
        T::same(['p' => $p, 't' => [[10, $t10], [50, $t50]], 'note' => 'DEMO'], $j['prices']['items']['TT0020210'], "$tier: sus precios y tramos, sin m ni a (la nota pública se queda)");
        T::same(['p' => $p2], $j['prices']['items']['P16633'], "$tier: sin tramos");
        T::same(['TT0020210', 'P16633'], array_keys($j['prices']['items']), "$tier: lo que no tiene precio no sale");
        T::same(['private, no-store', 'Authorization'], [$r->headers['Cache-Control'], $r->headers['Vary']], "$tier: Cache-Control private, no-store y Vary: Authorization");
        $txt = json_encode($j);
        foreach (['"m"', '"a"', 'manual_count', 'manual_skipped', 'vip', 'normal', 'tier'] as $no) T::true(strpos($txt, $no) === false, "$tier: la respuesta no lleva «{$no}»");
        T::same('upload', $j['prices']['source'], "$tier: el origen sin detalle");
    }
    $vip5 = json_encode(wire(pr_call('GET', '/prices', null, $s['cust']['vip5'])));
    foreach (['12.37', '11.9', '11.4', '67.65'] as $vipPrice) T::true(strpos($vip5, '"' . $vipPrice . '"') === false && !preg_match('/[:\[,]' . preg_quote($vipPrice, '/') . '[,\]}]/', $vip5), "VIP +5: el precio VIP $vipPrice no aparece");
    // la categoría se lee del registro en cada petición
    pr_call('PUT', '/customers/cli-vip5@acme.es', ['tier' => 'normal'], $s['own']);
    T::same(14.2255, wire(pr_call('GET', '/prices', null, $s['cust']['vip5']))['prices']['items']['TT0020210']['p'], 'con el mismo token, tras cambiarle la categoría a Normal ya ve los precios Normal');
    pr_settings(['tiers' => ['vip5' => 1, 'vip10' => 2, 'normal' => 50]]);
    T::same(18.555, wire(pr_call('GET', '/prices', null, $s['cust']['vip5']))['prices']['items']['TT0020210']['p'], 'y los porcentajes masivos valen al instante: Normal al 50 %');
    // sin categoría guardada (cuenta antigua) o dañada → Normal
    $u = Store::get('user:cli-vip10@acme.es'); unset($u['tier']); Store::put('user:cli-vip10@acme.es', $u);
    pr_settings([]);
    T::same(14.2255, wire(pr_call('GET', '/prices', null, $s['cust']['vip10']))['prices']['items']['TT0020210']['p'], 'sin tier en el registro: Normal');
}

/** 7.2 · Visitante: según anon. Con `normal` ve los precios Normal completos (con tramos), sin m ni a. */
function test_pr_get_prices_visitor_anon_normal()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]], 'm' => true, 'a' => 125], 'P16633' => ['p' => 67.65], 'R100' => ['a' => 40]]);
    pr_settings(['anon' => 'normal']);
    $r = Router::handle(req('GET', '/prices'));
    $j = wire($r);
    T::same(['TT0020210' => ['p' => 14.2255, 't' => [[10, 13.685], [50, 13.11]]], 'P16633' => ['p' => 77.7975]], $j['prices']['items'], 'precios Normal completos, con tramos, sin m ni a ni entradas sin precio');
    T::same(['live', false], [$j['prices']['mode'], array_key_exists('approx', $j['prices'])], 'mode intacto y sin marca de aproximado');
    T::same(['public, max-age=300', 'Authorization'], [$r->headers['Cache-Control'], $r->headers['Vary']], 'caché pública y Vary: Authorization');
    T::true(isset($r->headers['ETag']) && Router::handle(req('GET', '/prices', null, ['If-None-Match' => $r->headers['ETag']]))->status === 304, 'ETag → 304');
    $txt = json_encode($j);
    foreach (['12.37', '11.9', '11.4', '67.65', '"m"', '"a"', '125', '40'] as $no) T::true(strpos($txt, $no) === false, "no sale «{$no}» (VIP ni marcas)");
    pr_settings(['anon' => 'normal', 'tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 30]]);
    T::same(16.0810, wire(Router::handle(req('GET', '/prices')))['prices']['items']['TT0020210']['p'], 'cambiar el porcentaje Normal cambia el precio público');
    T::true(Router::handle(req('GET', '/prices', null, ['If-None-Match' => $r->headers['ETag']]))->status === 200, 'y el ETag ya no vale');
}

/** 7.2 · Visitante con anon = consult y aproximado: `{ ref: { p } }` solo donde las reglas de §2 dan un valor (a número, a:false, sin precio), sin tramos, con `prices.approx: true`. */
function test_pr_get_prices_visitor_consult_with_approx()
{
    $s = pr_setup();
    pr_prices([
        'A1' => ['p' => 100, 't' => [[10, 90]]], 'A2' => ['p' => 12.37], 'A3' => ['p' => 5], 'A4' => ['p' => 12.37, 'a' => 125], 'A5' => ['p' => 12.37, 'a' => false], 'A6' => ['a' => 40], 'A7' => ['m' => true],
        'A8' => ['p' => 8], 'A9' => ['p' => 100, 'a' => 0], 'A10' => ['p' => 100, 'a' => 'x'], 'A11' => ['p' => 100, 'a' => -5, 'm' => true], 'A12' => ['a' => false, 'm' => true], 'A13' => ['p' => 9.5],
    ]);
    pr_settings(['anon' => 'consult', 'approx' => ['on' => true, 'pct' => 15]]);
    $r = Router::handle(req('GET', '/prices'));
    $j = wire($r);
    $expect = ['A1' => 115, 'A2' => 14, 'A3' => 5.8, 'A4' => 125, 'A6' => 40, 'A8' => 9.2, 'A9' => 115, 'A10' => 115, 'A11' => 115, 'A13' => 11];
    T::same(array_map(function ($v) { return ['p' => $v]; }, $expect), $j['prices']['items'], 'aproximados: a número manda; a:false y sin precio no salen; ≥ 10 € a euro entero, menos a 1 decimal; sin tramos ni marcas');
    T::same([true, 'live'], [$j['prices']['approx'], $j['prices']['mode']], 'prices.approx: true');
    T::same(['public, max-age=300', 'Authorization'], [$r->headers['Cache-Control'], $r->headers['Vary']], 'caché pública y Vary: Authorization');
    $txt = json_encode($j);
    foreach (['"t"', '"m"', '"a"', '90', '"note"'] as $no) T::true(strpos($txt, $no) === false, "no sale «{$no}»");
    pr_settings(['anon' => 'consult', 'approx' => ['on' => true, 'pct' => 20]]);
    T::same([120, 125, 40], array_map(function ($k) { return wire(Router::handle(req('GET', '/prices')))['prices']['items'][$k]['p']; }, ['A1', 'A4', 'A6']), 'approx.pct 20: A1 sube; el aproximado explícito no depende del porcentaje');
    pr_settings(['anon' => 'consult', 'approx' => ['on' => true, 'pct' => 0]]);
    T::same(100, wire(Router::handle(req('GET', '/prices')))['prices']['items']['A1']['p'], 'approx.pct 0: el aproximado es el precio VIP redondeado (el administrador lo decide)');
    // las cuentas con sesión no ven aproximados: ven lo suyo
    T::same(12.37, wire(pr_call('GET', '/prices', null, $s['mgr']))['prices']['items']['A2']['p'], 'el manager sigue viendo el VIP');
}

/** 7.2 · Visitante con anon = consult y aproximado apagado: nada (items {} y mode «none»), sin sync ni marcas. */
function test_pr_get_prices_visitor_consult_off()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 12.37, 'a' => 125], 'P16633' => ['p' => 67.65]]);
    $r = Router::handle(req('GET', '/prices'));
    $j = wire($r);
    T::same([[], 'none', false], [$j['prices']['items'], $j['prices']['mode'], array_key_exists('approx', $j['prices'])], 'por defecto no sale ningún precio');
    T::same('{}', json_encode($r->body['prices']['items']), 'items es {} y no []');
    T::same(['public, max-age=300', 'Authorization'], [$r->headers['Cache-Control'], $r->headers['Vary']], 'Vary: Authorization también aquí');
    $txt = json_encode($j);
    foreach (['12.37', '67.65', '125', 'manual'] as $no) T::true(strpos($txt, $no) === false, "no sale «{$no}»");
    pr_settings(['anon' => 'consult', 'approx' => ['on' => false, 'pct' => 15]]);
    T::same('none', wire(Router::handle(req('GET', '/prices')))['prices']['mode'], 'con approx.on a false, igual');
}

/** 7.2 · Una sesión inválida o caducada en GET /prices se trata como visitante (no es un error); una cuenta borrada, también. */
function test_pr_get_prices_invalid_session_is_a_visitor()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 12.37], 'P16633' => ['p' => 67.65]]);
    pr_settings(['anon' => 'normal']);
    $visitor = wire(Router::handle(req('GET', '/prices')));
    T::same(200, pr_call('GET', '/prices', null, 'token-que-no-vale')->status, 'un token inválido: 200');
    T::same($visitor, wire(pr_call('GET', '/prices', null, 'token-que-no-vale')), 'y la misma vista que un visitante');
    $old = \Torivac\Auth::signSession(['sub' => 'jefe@torivac.test', 'sid' => (string) Users::find('jefe@torivac.test')['sid']], SECRET, \Torivac\Util::nowMs() - 90000000);
    $r = pr_call('GET', '/prices', null, $old);
    T::same([200, $visitor], [$r->status, wire($r)], 'una sesión caducada: visitante, sin VIP');
    Users::delete('cli-vip5@acme.es');
    $r = pr_call('GET', '/prices', null, $s['cust']['vip5']);
    T::same([200, $visitor], [$r->status, wire($r)], 'la sesión de una cuenta borrada: visitante');
    pr_settings(['anon' => 'consult']);
    T::same('none', wire(pr_call('GET', '/prices', null, 'token-que-no-vale'))['prices']['mode'], 'con anon = consult, un token inválido tampoco ve precios');
    Users::revokeSessions('cli-vip10@acme.es');
    T::same('none', wire(pr_call('GET', '/prices', null, $s['cust']['vip10']))['prices']['mode'], 'tras cerrar sus sesiones, igual');
}

// ───────────────────────────────────────── 5 · Edición de un producto

/** 7.5 · PUT /prices/items/:ref: cambia p, tramos y aproximado; la marca `m` se pone sola al tocar p o t; guarda con histórico (razón edit:<correo>) y queda en Actividad. */
function test_pr_item_edit_p_t_a_and_auto_mark()
{
    $s = pr_setup();
    $before = Prices::load();
    $r = pr_call('PUT', '/prices/items/TT0020210', ['p' => 20], $s['mgr']);
    T::same([200, true, 'TT0020210', ['p' => 20, 't' => [[10, 11.9], [50, 11.4]], 'm' => true]], [$r->status, $r->body['ok'], $r->body['ref'], wire($r)['item']], 'p nuevo: conserva los tramos y se marca como manual solo');
    $cur = Prices::load();
    T::same([20, true], [$cur['items']['TT0020210']['p'], $cur['items']['TT0020210']['m']], 'queda guardado');
    T::same('P16633', array_keys($cur['items'])[1], 'las demás referencias no se tocan');
    T::true($cur['updated_at'] !== $before['updated_at'] && preg_match('/^\d{4}-\d{2}-\d{2}T/', $cur['updated_at']) === 1, 'updated_at nuevo');
    $hist = Store::keys('prices:history:');
    T::same(1, count($hist), 'el estado anterior pasa al histórico');
    T::same(12.37, Store::get($hist[0])['items']['TT0020210']['p'], 'y es el de antes de editar');
    T::same(['edit:jefe@torivac.test', 'edit'], [Store::get(Prices::KEY_META)['reason'], Store::get(Prices::KEY_META)['source']], 'meta: razón edit:<correo>');
    $log = array_values(array_filter(Audit::read(1, 50, ['cat' => 'price'])['items'], function ($e) { return $e['a'] === 'price.edit'; }));
    T::same([1, 'TT0020210', 'jefe@torivac.test', 'Editó el precio de un producto'], [count($log), $log[0]['d'] ?? null, $log[0]['u'] ?? null, $log[0]['label'] ?? null], 'Actividad: price.edit con la referencia');
    // tramos
    $r = pr_call('PUT', '/prices/items/TT0020210', ['t' => [[5, 18.5], [20, 17]]], $s['own']);
    T::same(['p' => 20, 't' => [[5, 18.5], [20, 17]], 'm' => true], wire($r)['item'], 'los tramos se reemplazan (el propietario también puede)');
    T::same('edit:maria@torivac.test', Store::get(Prices::KEY_META)['reason'], 'la razón lleva a quien editó (aquí, la propietaria)');
    T::same(['p' => 20, 'm' => true], wire(pr_call('PUT', '/prices/items/TT0020210', ['t' => []], $s['mgr']))['item'], 't:[] quita los tramos');
    // aproximado: no marca como manual
    $r = pr_call('PUT', '/prices/items/P16633', ['a' => 80], $s['mgr']);
    T::same(['p' => 67.65, 'a' => 80], wire($r)['item'], 'a número: aproximado explícito, sin marca manual');
    T::same(['p' => 67.65, 'a' => false], wire(pr_call('PUT', '/prices/items/P16633', ['a' => false], $s['mgr']))['item'], 'a:false = nunca aproximado');
    T::same(['p' => 67.65], wire(pr_call('PUT', '/prices/items/P16633', ['a' => null], $s['mgr']))['item'], 'a:null = seguir la regla');
    // una referencia del catálogo que no tenía precio
    $r = pr_call('PUT', '/prices/items/R100', ['p' => 5.5, 't' => [[10, 5]]], $s['mgr']);
    T::same(['p' => 5.5, 't' => [[10, 5]], 'm' => true], wire($r)['item'], 'una referencia sin precio se crea con p y tramos');
    T::same(5.5, Prices::unit(Prices::load(), 'R100', 1), 'y ya se puede valorar');
    // marca manual
    T::same(['p' => 5.5, 't' => [[10, 5]]], wire(pr_call('PUT', '/prices/items/R100', ['manual' => false], $s['mgr']))['item'], 'manual:false quita la marca (la hoja podrá cambiarlo)');
    T::same(['p' => 5.5, 't' => [[10, 5]], 'm' => true], wire(pr_call('PUT', '/prices/items/R100', ['manual' => true], $s['mgr']))['item'], 'manual:true la pone sin tocar el precio');
    T::same(['p' => 6, 't' => [[10, 5]]], wire(pr_call('PUT', '/prices/items/R100', ['p' => 6, 'manual' => false], $s['mgr']))['item'], 'p con manual:false: el precio cambia y la marca se quita (lo explícito manda)');
    T::same(6.1234, wire(pr_call('PUT', '/prices/items/R100', ['p' => 6.1234, 'manual' => false], $s['mgr']))['item']['p'], 'hasta 4 decimales');
    // el token maestro firma «maestro»
    pr_call('PUT', '/prices/items/R100', ['p' => 7], null);
    T::same(401, pr_call('PUT', '/prices/items/R100', ['p' => 7])->status, 'sin sesión no se edita');
    Router::handle(req('PUT', '/prices/items/R100', ['p' => 7], master()));
    T::same('edit:maestro', Store::get(Prices::KEY_META)['reason'], 'el token maestro: edit:maestro');
}

/** 7.5 · Quitar el precio deja «A consultar» y marcado como manual (la hoja no lo vuelve a poner); una referencia sin ningún dato queda sin entrada; un cambio nulo no escribe. */
function test_pr_item_edit_remove_price_and_empty_entry()
{
    $s = pr_setup();
    $r = pr_call('PUT', '/prices/items/TT0020210', ['p' => null], $s['mgr']);
    T::same([200, ['m' => true]], [$r->status, wire($r)['item']], 'p:null quita el precio y los tramos, y queda marcado como manual');
    T::same(['m' => true], Prices::load()['items']['TT0020210'], 'la entrada sigue ahí: la hoja no volverá a ponerle precio');
    T::same(null, Prices::unit(Prices::load(), 'TT0020210', 1), 'y es «A consultar»');
    $r = pr_call('PUT', '/prices/items/TT0020210', ['manual' => false], $s['mgr']);
    T::same([200, '{}'], [$r->status, json_encode($r->body['item'])], 'sin ningún dato (ni precio, ni tramos, ni a, ni m) el item sale vacío ({})');
    T::true(!array_key_exists('TT0020210', Prices::load()['items']), 'y la referencia queda sin entrada');
    $stamp = Prices::load()['updated_at'];
    $n = count(Store::keys('prices:history:'));
    $r = pr_call('PUT', '/prices/items/TT0020210', ['manual' => false], $s['mgr']);
    T::same([200, $stamp, $n], [$r->status, Prices::load()['updated_at'], count(Store::keys('prices:history:'))], 'un cambio que no cambia nada responde 200 sin escribir ni tocar la fecha');
    // una entrada de la hoja con datos propios (nombre, producto) se queda aunque se le quite todo lo editable
    pr_prices(['TT0099999' => ['p' => 45.5, 'pid' => 884, 'n' => 'TRAFO 99VA']]);
    Catalog::set(['items' => ['TT0020210' => ['n' => 'x', 'pid' => 884]], 'skus' => [], 'rules' => []]);
    T::same(200, pr_call('PUT', '/prices/items/TT0099999', ['p' => null, 'manual' => false], $s['mgr'])->status, 'una referencia que añadió la hoja también se edita');
    T::same(['pid' => 884, 'n' => 'TRAFO 99VA'], Prices::load()['items']['TT0099999'], 'y conserva su nombre y producto para poder seguir presupuestándola «A consultar»');
}

/** 7.5 · Referencia desconocida → 404 (la ref va codificada en la URL: barras, espacios, acentos); el catálogo y las referencias que añadió la hoja valen. */
function test_pr_item_edit_unknown_ref_and_url_encoding()
{
    $s = pr_setup();
    $r = pr_call('PUT', '/prices/items/NOPE', ['p' => 1], $s['mgr']);
    T::same([404, false, 'Referencia desconocida'], [$r->status, $r->body['ok'], $r->body['error']], 'referencia que no existe: 404');
    $same = Store::get(Prices::KEY_CURRENT);
    T::same(404, pr_call('PUT', '/prices/items/NOPE', 'esto no es JSON', $s['mgr'])->status, 'el 404 va antes que el 400 del cuerpo');
    T::same($same, Store::get(Prices::KEY_CURRENT), 'no se escribió nada');
    Catalog::set(['items' => ['TT0020210' => ['n' => 'a', 'pid' => 884], 'AB/12 ñ' => ['n' => 'con barra y eñe', 'pid' => 5], '100%' => ['n' => 'porcentaje', 'pid' => 6]], 'skus' => [], 'rules' => []]);
    $r = pr_call('PUT', '/prices/items/' . rawurlencode('AB/12 ñ'), ['p' => 3.5], $s['mgr']);
    T::same([200, 'AB/12 ñ', ['p' => 3.5, 'm' => true]], [$r->status, $r->body['ref'], wire($r)['item']], 'AB/12 ñ → %2F, espacio y acento codificados');
    T::same(3.5, Prices::load()['items']['AB/12 ñ']['p'], 'guardado con la ref decodificada');
    T::same(200, pr_call('PUT', '/prices/items/' . rawurlencode('100%'), ['p' => 1], $s['mgr'])->status, 'una ref con % también');
    T::same(404, pr_call('PUT', '/prices/items/' . rawurlencode('ab/12 ñ'), ['p' => 3.5], $s['mgr'])->status, 'las mayúsculas cuentan');
    T::same(404, pr_call('PUT', '/prices/items/' . rawurlencode('../../config'), ['p' => 3.5], $s['mgr'])->status, 'una ref con rutas raras: 404');
    // una referencia que añadió la hoja dentro de un producto vale
    pr_prices(['TT0099999' => ['p' => 45.5, 'pid' => 884, 'n' => 'TRAFO 99VA'], 'XX1' => ['p' => 2]]);
    T::same(200, pr_call('PUT', '/prices/items/TT0099999', ['a' => 50], $s['mgr'])->status, 'una ref que añadió la hoja (con producto) se puede editar');
    T::same(404, pr_call('PUT', '/prices/items/XX1', ['a' => 50], $s['mgr'])->status, 'una con precio pero que no está en el catálogo ni lleva producto, no');
    T::same(404, pr_call('PUT', '/prices/items/', ['p' => 1], $s['mgr'])->status, 'sin referencia: 404');
}

/** 7.5 · Cuerpos mal formados → 400 con field (p, t, a, manual); nada se guarda; solo manager y client editan. */
function test_pr_item_edit_validation_and_roles()
{
    $s = pr_setup();
    $h = $s['mgr'];
    $before = Store::get(Prices::KEY_CURRENT);
    $cases = [
        ['p 0', ['p' => 0], 'p'], ['p negativo', ['p' => -1], 'p'], ['p texto', ['p' => '12'], 'p'], ['p booleano', ['p' => true], 'p'], ['p lista', ['p' => [1]], 'p'], ['p enorme', ['p' => 10000001], 'p'],
        ['p con 5 decimales', ['p' => 1.23456], 'p'], ['p infinito', '{"p":1e999}', 'p'],
        ['t que no es lista', ['t' => 'x'], 't'], ['t objeto', ['t' => ['a' => [2, 1]]], 't'], ['t null', ['t' => null], 't'], ['9 tramos', ['t' => [[2, 9], [3, 8], [4, 7], [5, 6], [6, 5], [7, 4], [8, 3], [9, 2], [10, 1]]], 't'],
        ['tramo de 1 elemento', ['t' => [[5]]], 't'], ['tramo de 3 elementos', ['t' => [[5, 1, 1]]], 't'], ['tramo que no es lista', ['t' => [5]], 't'], ['cantidad 1', ['t' => [[1, 9]]], 't'], ['cantidad 0', ['t' => [[0, 9]]], 't'],
        ['cantidad decimal', ['t' => [[2.5, 9]]], 't'], ['cantidad texto', ['t' => [['5', 9]]], 't'], ['cantidades repetidas', ['t' => [[5, 10], [5, 9]]], 't'], ['cantidades en desorden', ['t' => [[10, 9], [5, 8]]], 't'],
        ['precio de tramo 0', ['t' => [[5, 0]]], 't'], ['precio de tramo con 5 decimales', ['t' => [[5, 1.23456]]], 't'], ['precio de tramo texto', ['t' => [[5, '9']]], 't'],
        ['a 0', ['a' => 0], 'a'], ['a negativo', ['a' => -3], 'a'], ['a true', ['a' => true], 'a'], ['a texto', ['a' => 'x'], 'a'], ['a lista', ['a' => [1]], 'a'],
        ['manual texto', ['manual' => 'si'], 'manual'], ['manual null', ['manual' => null], 'manual'], ['manual 1', ['manual' => 1], 'manual'],
        ['objeto vacío', [], ''], ['solo claves desconocidas', ['x' => 1], ''],
    ];
    foreach ($cases as [$why, $body, $field]) {
        $x = pr_call('PUT', '/prices/items/TT0020210', $body, $h);
        T::same([400, false, $field], [$x->status, $x->body['ok'], $x->body['field'] ?? null], "$why → 400 con field «{$field}»");
        T::true(is_string($x->body['error'] ?? null) && $x->body['error'] !== '', "$why: con texto de error");
    }
    // tramos sin precio base
    $x = pr_call('PUT', '/prices/items/R100', ['t' => [[5, 1]]], $h);
    T::same([400, 't'], [$x->status, $x->body['field'] ?? null], 'tramos en una referencia sin precio: 400');
    $x = pr_call('PUT', '/prices/items/TT0020210', ['p' => null, 't' => [[5, 1]]], $h);
    T::same([400, 't'], [$x->status, $x->body['field'] ?? null], 'p:null con tramos nuevos: 400');
    // cuerpo
    foreach (['esto no es JSON', '[1,2]', '', 'null'] as $raw) T::same([400, 'Petición no válida'], [pr_call('PUT', '/prices/items/TT0020210', $raw, $h)->status, pr_call('PUT', '/prices/items/TT0020210', $raw, $h)->body['error']], 'cuerpo «' . $raw . '»: 400');
    T::same(413, pr_call('PUT', '/prices/items/TT0020210', ['p' => 1, 'x' => str_repeat('a', 20100)], $h)->status, 'cuerpo de más de 20 KB: 413');
    T::same($before, Store::get(Prices::KEY_CURRENT), 'ninguna petición rechazada tocó los precios');
    T::same([], Store::keys('prices:history:'), 'ni escribió histórico');
    // límites que sí valen
    T::same(200, pr_call('PUT', '/prices/items/TT0020210', ['p' => 10000000, 't' => [[2, 0.0001], [1000000, 9999999.9999]]], $h)->status, 'p = 10 000 000, tramos con 4 decimales y 8 como máximo');
    $eight = [[2, 9], [3, 8], [4, 7], [5, 6], [6, 5], [7, 4], [8, 3], [9, 2]];
    T::same(8, count(wire(pr_call('PUT', '/prices/items/TT0020210', ['t' => $eight], $h))['item']['t']), '8 tramos valen');
    // roles
    $body = ['p' => 21];
    T::same(401, pr_call('PUT', '/prices/items/TT0020210', $body)->status, 'visitante: 401');
    T::same(401, pr_call('PUT', '/prices/items/TT0020210', $body, 'token-que-no-vale')->status, 'sesión inválida: 401');
    foreach (Pricing::TIERS as $t) T::same(403, pr_call('PUT', '/prices/items/TT0020210', $body, $s['cust'][$t])->status, "cliente $t: 403");
    T::same(200, pr_call('PUT', '/prices/items/TT0020210', ['p' => 22], $s['own'])->status, 'el propietario edita precios');
    T::same(404, pr_call('GET', '/prices/items/TT0020210', null, $s['mgr'])->status, 'GET en esa ruta: 404');
    T::same(404, pr_call('DELETE', '/prices/items/TT0020210', null, $s['mgr'])->status, 'DELETE: 404');
}

// ───────────────────────────────────────── 5 · La hoja y la IA respetan lo manual

/** Hoja de prueba con las referencias del catálogo. */
function pr_sheet(): string
{
    return SHEET;
}

/** 7.5 · Sincronización «merge»: una referencia con m:true no se toca (aunque la hoja la cambie o la retire) y se cuenta en meta.manual_skipped; lo demás se actualiza y conserva su `a`. */
function test_pr_sync_merge_does_not_touch_manual()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 20, 't' => [[10, 18]], 'm' => true], 'P16633' => ['p' => 60, 'a' => 99], 'R100' => ['m' => true]]);
    // la hoja trae TT0020210 (12,37), P16633 (67,65) y R100 (5,5); X0 (active 0) no existe
    $r = pr_call('POST', '/prices/upload', ['csv' => pr_sheet(), 'force' => true], $s['mgr']);
    T::same([200, 'merge', 2], [$r->status, $r->body['meta']['mode'], $r->body['meta']['manual_skipped']], 'merge: se respetan 2 manuales');
    $cur = Prices::load()['items'];
    T::same(['p' => 20, 't' => [[10, 18]], 'm' => true], $cur['TT0020210'], 'la manual con precio queda tal cual (aunque la hoja diga 12,37 con tramos)');
    T::same(['m' => true], $cur['R100'], 'la manual sin precio sigue sin precio aunque la hoja traiga 5,5');
    T::same(['p' => 67.65, 'a' => 99], $cur['P16633'], 'lo demás se actualiza y conserva su aproximado `a`');
    T::same(2, Store::get(Prices::KEY_META)['manual_skipped'], 'meta guardada con manual_skipped');
    T::same(2, wire(pr_call('GET', '/prices', null, $s['mgr']))['meta']['manual_skipped'], 'y el manager la ve en GET /prices');
    // retirar: una fila inactiva o a 0 quita el precio salvo si es manual
    $r = pr_call('POST', '/prices/upload', ['csv' => "ref;price;active\nTT0020210;0;0\nP16633;0;1\nR100;3;1\n", 'force' => true], $s['mgr']);
    T::same([200, 2], [$r->status, $r->body['meta']['manual_skipped']], 'la hoja pide quitar TT0020210 y P16633 y poner R100: las manuales (TT0020210 y R100) se respetan');
    $cur = Prices::load()['items'];
    T::same([20, ['a' => 99], ['m' => true]], [$cur['TT0020210']['p'], $cur['P16633'], $cur['R100']], 'TT0020210 intacta; P16633 pierde el precio pero conserva `a`; R100 sigue sin precio');
    // vista previa: dice lo mismo que hará
    $dry = pr_call('POST', '/prices/upload', ['csv' => pr_sheet(), 'dry_run' => true], $s['mgr'])->body;
    T::same([2, ['P16633'], [], []], [$dry['manual_skipped'], $dry['diff']['changed'], $dry['diff']['added'], $dry['diff']['removed']], 'la vista previa cuenta las manuales y no las enseña como cambios (solo P16633 recupera su precio)');
    // sin manuales el contador es 0
    $s2 = pr_setup();
    $r = pr_call('POST', '/prices/upload', ['csv' => pr_sheet(), 'force' => true], $s2['mgr']);
    T::same(0, $r->body['meta']['manual_skipped'], 'sin manuales, manual_skipped = 0');
}

/** 7.5 · Sincronización «replace»: la hoja sustituye a todo MENOS lo manual (que se conserva tal cual, esté o no en la hoja) y se cuenta en manual_skipped. */
function test_pr_sync_replace_does_not_touch_manual()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 20, 'm' => true], 'P16633' => ['p' => 60, 'a' => 99], 'R100' => ['p' => 4, 'm' => true, 'a' => 7]]);
    $r = pr_call('POST', '/prices/upload', ['csv' => "ref;price\nTT0020210;12,37\nP16633;67,65\n", 'mode' => 'replace', 'force' => true], $s['mgr']);
    T::same([200, 'replace', 2], [$r->status, $r->body['meta']['mode'], $r->body['meta']['manual_skipped']], 'replace: se respetan las 2 manuales');
    $cur = Prices::load()['items'];
    T::same([['p' => 20, 'm' => true], ['p' => 67.65, 'a' => 99], ['p' => 4, 'm' => true, 'a' => 7]], [$cur['TT0020210'], $cur['P16633'], $cur['R100']], 'las manuales intactas aunque la hoja las cambie (TT0020210) o no las traiga (R100); lo demás, de la hoja, con su `a`');
    // en replace una referencia no manual que la hoja no trae se va
    pr_prices(['TT0020210' => ['p' => 20], 'P16633' => ['p' => 60], 'R100' => ['m' => true]]);
    $r = pr_call('POST', '/prices/upload', ['csv' => "ref;price\nTT0020210;12,37\n", 'mode' => 'replace', 'force' => true], $s['mgr']);
    $cur = Prices::load()['items'];
    T::same([['p' => 12.37], false, ['m' => true], 1], [$cur['TT0020210'], array_key_exists('P16633', $cur), $cur['R100'], $r->body['meta']['manual_skipped']], 'la no manual ausente de la hoja se quita; la manual sin precio se queda');
    // la configuración por defecto (cron) usa el mismo camino
    \Torivac\Config::set(array_merge(\Torivac\Config::all(), ['prices' => ['csv_url' => 'https://sheet.test/x.csv', 'update_mode' => 'replace']]));
    \Torivac\Http::$mock = function () { return [200, "ref;price\nTT0020210;11\nP16633;66\nR100;3\n"]; };
    pr_prices(['TT0020210' => ['p' => 20, 'm' => true], 'P16633' => ['p' => 60], 'R100' => ['p' => 4]]);
    $meta = Router::cron();
    $cur = Prices::load()['items'];
    T::same([20, 66, 3, 1], [$cur['TT0020210']['p'], $cur['P16633']['p'], $cur['R100']['p'], $meta['manual_skipped']], 'el cron (replace) también respeta lo manual');
}

/** 7.5 · Las reglas de cambio masivo ignoran las referencias manuales: una hoja que cambiaría de golpe solo lo manual se acepta; la misma hoja sobre referencias no manuales se rechaza. */
function test_pr_sync_mass_change_rules_ignore_manual()
{
    fresh();
    $items = []; $cat = [];
    for ($i = 0; $i < 12; $i++) { $items["M$i"] = ['p' => 10, 'm' => true]; $cat["M$i"] = ['n' => "Manual $i", 'pid' => 1]; }
    $items['N0'] = ['p' => 10]; $cat['N0'] = ['n' => 'Normal 0', 'pid' => 1];
    Catalog::set(['items' => $cat, 'skus' => [], 'rules' => []]);
    pr_prices($items);
    $csv = "Referencia;Precio\n" . implode("\n", array_map(function ($i) { return 'M' . $i . ';' . (100 + $i); }, range(0, 11))) . "\nN0;10.5\n";
    $m = Sheets::sync(['rows' => Sheets::parseCsv($csv)]);
    $cur = Prices::load()['items'];
    T::same([12, 10.5, 10.0], [$m['manual_skipped'], $cur['N0']['p'], $cur['M3']['p']], '12 manuales cambiarían un 900 %: no cuenta (se respetan), la hoja se aplica');
    // la misma hoja con todo SIN marca manual sí se rechaza
    $plain = array_map(function ($it) { unset($it['m']); return $it; }, $items);
    pr_prices($plain);
    $code = null; $text = '';
    try { Sheets::sync(['rows' => Sheets::parseCsv($csv)]); } catch (\RuntimeException $e) { $code = $e->getCode(); $text = $e->getMessage(); }
    T::same([409, true], [$code, strpos($text, 'cambia más de un 40 %') !== false], 'sin la marca manual, el cambio masivo se rechaza');
    // retirar todo lo manual tampoco bloquea
    pr_prices($items);
    $m = Sheets::sync(['rows' => Sheets::parseCsv("Referencia;Precio;Activo\n" . implode("\n", array_map(function ($i) { return 'M' . $i . ';0;0'; }, range(0, 11))) . "\nN0;10;1\n")]);
    T::same([12, 12], [$m['manual_skipped'], count(array_filter(Prices::load()['items'], function ($it) { return !empty($it['m']); }))], 'una hoja que retira 12 manuales de 13 no dispara «retira muchos»: las manuales no cuentan y siguen ahí');
    // replace: la regla «la hoja tiene menos de la mitad» no cuenta lo manual
    pr_prices($items);
    $m = Sheets::sync(['rows' => Sheets::parseCsv("Referencia;Precio\nN0;10\n"), 'mode' => 'replace']);
    T::same([12, 10, 13], [$m['manual_skipped'], Prices::load()['items']['N0']['p'], count(Prices::load()['items'])], 'replace con una hoja corta: lo manual no cuenta para el umbral del 50 % y se conserva entero');
}

/** 7.5 · La IA (apply) conserva la marca `m` y el aproximado `a` de lo que cambia; una entrada sin precio no rompe a la IA. */
function test_pr_ai_apply_keeps_manual_mark()
{
    $s = pr_setup();
    pr_prices(['TT0020210' => ['p' => 20, 't' => [[10, 18]], 'm' => true, 'a' => 25], 'P16633' => ['p' => 60], 'R100' => ['m' => true]]);
    $r = pr_call('POST', '/prices/ai/apply', ['changes' => [['ref' => 'TT0020210', 'price' => 21, 'tiers' => [['qty' => 10, 'price' => 19]]], ['ref' => 'P16633', 'price' => 61], ['ref' => 'R100', 'price' => 3]]], $s['mgr']);
    T::same([200, 3], [$r->status, $r->body['applied']], 'se aplican los tres cambios');
    $cur = Prices::load()['items'];
    T::same(['p' => 21.0, 't' => [[10, 19.0]], 'm' => true, 'a' => 25], array_intersect_key($cur['TT0020210'], array_flip(['p', 't', 'm', 'a'])), 'TT0020210 cambia de precio y sigue manual, con su aproximado');
    T::same([61.0, false], [$cur['P16633']['p'], array_key_exists('m', $cur['P16633'])], 'lo que no era manual sigue sin marca');
    T::same([3.0, true], [$cur['R100']['p'], $cur['R100']['m']], 'una entrada que solo era manual conserva la marca al ponerle precio');
    pr_prices(['R100' => ['m' => true], 'P16633' => ['a' => 40]]);
    T::same(200, pr_call('POST', '/prices/ai/apply', ['changes' => [['ref' => 'R100', 'price' => 6]]], $s['mgr'])->status, 'la IA aplica sobre una entrada sin precio previo');
    T::same(403, pr_call('POST', '/prices/ai/apply', ['changes' => []], $s['own'])->status, 'la IA y las demás rutas de precios siguen siendo solo del manager (propietario: 403)');
    foreach (['/prices/ai', '/prices/ai/apply'] as $path) {
        T::same([403, 403], [pr_call('POST', $path, ['instruction' => 'sube un 3 % las resistencias', 'csv' => SHEET], $s['own'])->status, pr_call('POST', $path, ['instruction' => 'sube un 3 % las resistencias', 'csv' => SHEET], $s['cust']['normal'])->status], "$path: propietario y cliente, 403");
    }
    foreach (['/prices/upload', '/prices/refresh'] as $path) {                            // la hoja (subir Excel/CSV y «Actualizar ahora») también la lleva el propietario; el cliente final, no
        T::same(403, pr_call('POST', $path, ['csv' => SHEET, 'dry_run' => true], $s['cust']['normal'])->status, "$path: el cliente final, 403");
        T::same(401, pr_call('POST', $path, ['csv' => SHEET, 'dry_run' => true])->status, "$path: sin sesión, 401");
    }
    $own = pr_call('POST', '/prices/upload', ['csv' => pr_sheet(), 'dry_run' => true], $s['own']);
    T::same([200, true], [$own->status, $own->body['dry_run'] ?? null], 'el propietario previsualiza la hoja');
    T::same(200, pr_call('POST', '/prices/upload', ['csv' => pr_sheet(), 'force' => true], $s['own'])->status, 'el propietario aplica la hoja');
    $rf = pr_call('POST', '/prices/refresh', null, $s['own']); T::true($rf->status !== 403 && $rf->status !== 401, 'y puede pulsar «Actualizar ahora» (nunca 403): ' . $rf->status);
}
