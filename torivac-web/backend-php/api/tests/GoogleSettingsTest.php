<?php
/**
 * Pruebas de los ajustes de Google del panel (GoogleSettings.php): validación de IDs y etiquetas (las mismas reglas que el Worker y que site/lib/google.mjs), lectura pública que solo enseña IDs y etiquetas
 * completas de las conversiones activadas, y las rutas GET /google (público), GET y PUT /settings/google (solo managers, con anotación en Actividad).
 */
namespace Torivac\Tests;

use Torivac\Audit;
use Torivac\GoogleSettings;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Cuerpo válido de ejemplo del PUT (se puede sobrescribir cualquier parte). */
function gs_body(array $over = []): array
{
    return $over + ['ga4' => 'G-TEST123456', 'ads' => 'AW-123456789', 'conversions' => ['quote' => ['label' => 'AW-123456789/AbCdEfGhIj12', 'on' => true], 'contact' => ['label' => 'AbCdEfGhIj34', 'on' => true]]];
}

/** Un manager y un cliente (propietario) con sesión → [token del manager, token del propietario]. */
function gs_tokens(): array
{
    Users::create(['email' => 'jefa@torivac.test', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'duena@torivac.test', 'name' => 'Dueña', 'role' => 'client', 'password' => PW_ANA]);
    return [login_token('jefa@torivac.test', PW_JEFE, '10.9.9.1'), login_token('duena@torivac.test', PW_ANA, '10.9.9.2')];
}

/** Sin nada guardado todo está vacío y la vista pública no trae IDs. */
function test_google_vacio_por_defecto(): void
{
    fresh();
    $s = GoogleSettings::load();
    T::same('', $s['ga4']); T::same('', $s['ads']); T::same(null, $s['updated']);
    T::same(['ga4' => '', 'ads' => '', 'conv' => ['quote' => '', 'contact' => '']], GoogleSettings::publicView($s), 'vista pública vacía');
    T::same(['ga4' => '', 'ads' => '', 'conv' => ['quote' => '', 'contact' => '']], wire(Router::handle(req('GET', '/google')))['google'], 'GET /google sin sesión también vacío');
}

/** La validación acepta lo bueno, completa etiquetas con el ID de Ads y toma el ID de Ads de las etiquetas completas. */
function test_google_validacion_acepta(): void
{
    fresh();
    $v = GoogleSettings::validate(gs_body());
    T::true(isset($v['settings']), 'cuerpo completo válido');
    T::same('AbCdEfGhIj34', $v['settings']['conversions']['contact']['label'], 'la etiqueta suelta se guarda como se escribió');
    $v = GoogleSettings::validate(['conversions' => ['quote' => ['label' => 'AW-555555555/ZzZzZzZz99']]]);
    T::same('AW-555555555', $v['settings']['ads'] ?? null, 'sin ID de Ads, sale de la etiqueta completa');
    $v = GoogleSettings::validate([]);
    T::true(isset($v['settings']) && $v['settings']['ga4'] === '' && $v['settings']['conversions']['quote']['on'] === true, 'vacío = apagado, conversiones «on» por defecto');
    $v = GoogleSettings::validate(['ga4' => 'GT-ABCDEFGH', 'conversions' => ['quote' => ['on' => false]]]);
    T::true(isset($v['settings']) && $v['settings']['conversions']['quote']['on'] === false, 'GT-… vale y «on:false» se respeta');
}

/** La validación rechaza lo mal escrito diciendo el campo. */
function test_google_validacion_rechaza(): void
{
    fresh();
    foreach ([
        [['ga4' => 'G-1'], 'ga4'], [['ga4' => 'g-abcdefghij'], 'ga4'], [['ga4' => 'G-ABCDEFGHIJ<script>'], 'ga4'], [['ads' => '123456789'], 'ads'], [['ads' => 'AW-12'], 'ads'],
        [['conversions' => ['quote' => ['label' => 'AbCdEfGhIj12']]], 'conversions.quote'],                                                  // solo la etiqueta, sin ID de Ads
        [['ads' => 'AW-111111111', 'conversions' => ['contact' => ['label' => 'AW-222222222/AbCdEfGhIj12']]], 'conversions.contact'],       // etiqueta de otra cuenta
        [['ads' => 'AW-111111111', 'conversions' => ['quote' => ['label' => 'corta']]], 'conversions.quote'],
        [['ads' => 'AW-111111111', 'conversions' => ['quote' => ['label' => 'AbCdEfGh IjK']]], 'conversions.quote'],
        [['ads' => 'AW-111111111', 'conversions' => ['quote' => ['label' => 'AbCdEfGhIj12', 'on' => 'si']]], 'conversions.quote'],
        [['ads' => 'AW-111111111', 'conversions' => ['quote' => ['label' => ['x']]]], 'conversions.quote'],
        [['ga4' => ['G-ABCDEFGHIJ']], 'ga4'],
        [['conversions' => ['quote' => ['label' => 'AW-111111111/AbCdEfGhIj12'], 'contact' => ['label' => 'AW-222222222/AbCdEfGhIj12']]], 'conversions.contact'],      // dos etiquetas completas de cuentas distintas sin ID de Ads
    ] as [$body, $field]) {
        $v = GoogleSettings::validate($body);
        T::true(isset($v['error']) && $v['field'] === $field, json_encode($body) . ' → ' . ($v['field'] ?? 'aceptado'));
    }
    T::true(isset(GoogleSettings::validate('texto')['error']) && isset(GoogleSettings::validate([1, 2])['error']), 'lo que no es un objeto, fuera');
}

/** La vista pública solo trae etiquetas completas de conversiones activadas y con ID de Ads. */
function test_google_vista_publica(): void
{
    fresh();
    $v = GoogleSettings::validate(gs_body())['settings'] + ['updated' => null];
    T::same(['ga4' => 'G-TEST123456', 'ads' => 'AW-123456789', 'conv' => ['quote' => 'AW-123456789/AbCdEfGhIj12', 'contact' => 'AW-123456789/AbCdEfGhIj34']], GoogleSettings::publicView($v), 'etiquetas completas');
    $v['conversions']['contact']['on'] = false;
    T::same('', GoogleSettings::publicView($v)['conv']['contact'], 'conversión apagada: la web no la recibe');
    $v['ads'] = '';
    T::same('', GoogleSettings::publicView($v)['conv']['quote'], 'sin ID de Ads no hay conversiones');
    T::true(!array_key_exists('updated', GoogleSettings::publicView($v)) && !array_key_exists('conversions', GoogleSettings::publicView($v)), 'la vista pública no enseña quién ni cuándo guardó');
}

/** Lo dañado o manipulado en el almacén no se cuela: load() solo devuelve valores que cumplen las reglas. */
function test_google_load_ignora_basura(): void
{
    fresh();
    Store::put(GoogleSettings::KEY, ['ga4' => '<img src=x>', 'ads' => 'AW-123456789', 'conversions' => ['quote' => ['label' => '"><script>', 'on' => false], 'contact' => 'no es un objeto'], 'updated' => ['at' => 5, 'by' => 'x']]);
    $s = GoogleSettings::load();
    T::same('', $s['ga4'], 'ID de Analytics roto → vacío'); T::same('AW-123456789', $s['ads']);
    T::same(['label' => '', 'on' => false], $s['conversions']['quote'], 'etiqueta rota → vacía, «on» se conserva');
    T::same(['label' => '', 'on' => true], $s['conversions']['contact']);
    T::same(null, $s['updated'], 'fecha mal formada → sin datos de quién guardó');
    Store::put(GoogleSettings::KEY, 'basura');
    T::same('', GoogleSettings::load()['ads'], 'valor que no es un objeto → vacío');
}

/** Rutas: la lectura pública no pide sesión; ver y guardar es solo de managers; un propietario recibe 403 y sin sesión 401; guardar queda en Actividad. */
function test_google_rutas_y_permisos(): void
{
    fresh();
    [$mgr, $own] = gs_tokens();
    $pub = Router::handle(req('GET', '/google'));
    T::same(200, $pub->status); T::same('public, max-age=60', $pub->headers['Cache-Control'] ?? null, 'caché corta pública');
    T::same(401, Router::handle(req('GET', '/settings/google'))->status, 'ver sin sesión → 401');
    T::same(401, Router::handle(req('PUT', '/settings/google', gs_body()))->status, 'guardar sin sesión → 401');
    T::same(403, Router::handle(req('GET', '/settings/google', null, bearer($own)))->status, 'propietario no ve los ajustes');
    T::same(403, Router::handle(req('PUT', '/settings/google', gs_body(), bearer($own)))->status, 'propietario no guarda');
    T::same('', wire(Router::handle(req('GET', '/google')))['google']['ga4'], 'el intento del propietario no cambió nada');

    $r = Router::handle(req('PUT', '/settings/google', gs_body(), bearer($mgr)));
    $j = wire($r);
    T::same(200, $r->status); T::same('G-TEST123456', $j['settings']['ga4']); T::same('jefa@torivac.test', $j['settings']['updated']['by'], 'queda quién guardó');
    $g = wire(Router::handle(req('GET', '/google')))['google'];
    T::same('AW-123456789/AbCdEfGhIj34', $g['conv']['contact'], 'la web recibe la etiqueta completa');
    T::same(200, Router::handle(req('GET', '/settings/google', null, bearer($mgr)))->status, 'el manager lo ve');
    $log = Audit::read(1, 50, []);
    T::true(count(array_filter($log['items'], fn ($e) => $e['a'] === 'settings.google' && $e['u'] === 'jefa@torivac.test')) === 1, 'queda en Actividad');

    $bad = Router::handle(req('PUT', '/settings/google', ['ga4' => 'nope'], bearer($mgr)));
    T::same(400, $bad->status); T::same('ga4', $bad->body['field']);
    T::same('G-TEST123456', wire(Router::handle(req('GET', '/google')))['google']['ga4'], 'un guardado rechazado no toca lo guardado');
    T::same(200, Router::handle(req('PUT', '/settings/google', ['ga4' => '', 'ads' => '', 'conversions' => []], bearer($mgr)))->status, 'vaciar apaga todo');
    T::same(['ga4' => '', 'ads' => '', 'conv' => ['quote' => '', 'contact' => '']], wire(Router::handle(req('GET', '/google')))['google']);
    T::same('maestro', wire(Router::handle(req('PUT', '/settings/google', gs_body(), master())))['settings']['updated']['by'], 'el token maestro cuenta como «maestro»');
}
