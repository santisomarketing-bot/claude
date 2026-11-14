<?php
/**
 * Pruebas de «Contenido nuevo» del panel (NewContent.php, rutas /api/newcontent/…) y del rol Revisor: ver borradores, proponer, decidir, aprobar con la función que toca y registro de cambios.
 * El Revisor solo llega a «Contenido nuevo»; solo él aprueba; el castellano se aprueba antes que las traducciones; cambiar el texto retira la aprobación; el archivo manda si cambió después.
 */
namespace Torivac\Tests;

use Torivac\NewContent;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

const PW_REV = 'Clave-Revision-2026!';

/** Texto válido de ejemplo de una versión (título ≤ 65, descripción 50–160, texto plano). */
function nc_text(string $lang, string $title = ''): array
{
    return ['title' => $title ?: 'Fabricación a medida de transformadores ' . strtoupper($lang), 'meta_description' => 'Fabricamos transformadores a medida para tu aplicación; estudiamos cada caso con tus datos técnicos.', 'h1' => 'Fabricación a medida', 'lead' => 'Estudiamos tu aplicación.',
        'sections' => [['h2' => 'Cómo trabajamos', 'p' => ['Recibimos tus datos y respondemos con una propuesta.']], ['h2' => 'Solicitar una evaluación', 'p' => ['Escríbenos desde el contacto.']]], 'cta' => [['label' => 'Contacto', 'href' => '/contacto/']]];
}

/** Escribe el archivo de páginas de pruebas (como lo haría el build) y lo activa. $over cambia partes de la página `a-medida`. */
function nc_pages(array $over = []): string
{
    $page = ['id' => 'a-medida', 'kind' => 'landing', 'slug' => ['es' => '/a-medida/', 'en' => '/en/custom/'], 'notes' => ['Pendiente de revisión'], 'history' => [],
        'langs' => ['es' => ['status' => 'borrador'] + nc_text('es'), 'en' => ['status' => 'borrador'] + nc_text('en')]];
    $page = array_replace_recursive($page, $over);
    $f = sys_get_temp_dir() . '/tv-nc-' . bin2hex(random_bytes(4)) . '.json';
    file_put_contents($f, json_encode(['pages' => [$page]], JSON_UNESCAPED_UNICODE));
    NewContent::setFile($f);
    return $f;
}

/** Manager, Revisor y propietario con sesión → [manager, revisor, propietario]. */
function nc_tokens(): array
{
    Users::create(['email' => 'jefa@torivac.test', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    $r = Users::create(['email' => 'marta.revisora@torivac.test', 'name' => 'Marta Revisora', 'role' => 'reviewer', 'password' => PW_REV]);
    Users::create(['email' => 'ana.compras@acme.test', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    T::same('reviewer', $r['user']['role'] ?? null, 'el rol Revisor existe');
    return [login_token('jefa@torivac.test', PW_JEFE, '10.8.1.1'), login_token('marta.revisora@torivac.test', PW_REV, '10.8.1.2'), login_token('ana.compras@acme.test', PW_ANA, '10.8.1.3')];
}

/** Petición al API con token. */
function nc_call(string $method, string $path, ?string $tok, $body = null): \Torivac\Response { return Router::handle(req($method, $path, $body, $tok ? bearer($tok) : [])); }

/** N1 · El Revisor llega a «Contenido nuevo» y a su sesión, y a nada más; el propietario y el visitante no ven «Contenido nuevo». */
function test_newcontent_the_reviewer_only_reaches_new_content()
{
    fresh(); nc_pages(); [$tj, $tr, $ta] = nc_tokens();
    T::same(200, nc_call('GET', '/newcontent', $tr)->status, 'el Revisor ve el contenido nuevo');
    T::same(200, nc_call('GET', '/newcontent', $tj)->status, 'el manager también');
    T::same(403, nc_call('GET', '/newcontent', $ta)->status, 'el propietario no');
    T::same(401, nc_call('GET', '/newcontent', null)->status, 'sin sesión, tampoco');
    foreach (['/orders', '/orders/TV-20260101-0001-ABC', '/messages', '/users', '/prices/items/R100', '/customers', '/admin/data', '/settings/google', '/activity', '/backups', '/blog/posts'] as $p) T::same(403, nc_call('GET', $p, $tr)->status, "el Revisor no entra en $p");
    T::same(403, nc_call('POST', '/users', $tr, ['email' => 'x@y.test', 'role' => 'manager', 'password' => PW_ANA])->status, 'el Revisor no crea usuarios');
    T::same(200, nc_call('GET', '/auth/me', $tr)->status, 'su sesión funciona');
    T::same('reviewer', nc_call('GET', '/auth/me', $tr)->body['user']['role'], 'el rol que ve el panel');
    $r = nc_call('POST', '/users', $tj, ['email' => 'otra@torivac.test', 'name' => 'Otra', 'role' => 'reviewer', 'password' => PW_ANA . 'x']);
    T::same(201, $r->status, 'el manager crea un Revisor desde el panel');
    T::same(400, nc_call('POST', '/users', $tj, ['email' => 'otra2@torivac.test', 'role' => 'revisor', 'password' => PW_ANA . 'x'])->status, 'un rol inventado se rechaza');
    T::same('reviewer', nc_call('GET', '/auth/me', login_token('otra@torivac.test', PW_ANA . 'x', '10.8.1.9'))->body['user']['role'] ?? null, 'la cuenta nueva entra como Revisor');
}

/** N2 · Listado: cada idioma con su estado, el texto vigente y quién puede hacer qué. */
function test_newcontent_listing_shows_drafts_and_what_each_role_can_do()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    $b = wire(nc_call('GET', '/newcontent', $tr));
    T::same(['a-medida'], array_column($b['pages'], 'id'), 'la página');
    $p = $b['pages'][0];
    T::same(['borrador', 'borrador'], [$p['langs']['es']['status'], $p['langs']['en']['status']], 'los dos idiomas en borrador');
    T::same([true, false], [$p['langs']['es']['can_approve'], $p['langs']['en']['can_approve']], 'el castellano se puede aprobar; el inglés aún no (falta el castellano)');
    T::same('Fabricación a medida', $p['langs']['es']['text']['h1'], 'el texto vigente');
    T::same(true, $b['me']['can_decide'], 'el Revisor decide');
    T::same(false, wire(nc_call('GET', '/newcontent', $tj))['me']['can_decide'], 'el manager no decide');
    T::same(['es' => 'comercial', 'en' => 'traductor', 'fr' => 'traductor', 'de' => 'traductor'], $b['functions'], 'función de cada idioma');
}

/** N3 · Aprobar: solo el Revisor, con la función del idioma, primero el castellano; queda quién, función, fecha y el registro. */
function test_newcontent_approval_rules_and_record()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    T::same(403, nc_call('POST', '/newcontent/a-medida/es/approve', $tj)->status, 'el manager no aprueba');
    T::same(409, nc_call('POST', '/newcontent/a-medida/en/approve', $tr)->status, 'el inglés no se aprueba antes que el castellano');
    $r = nc_call('POST', '/newcontent/a-medida/es/approve', $tr);
    T::same(200, $r->status, 'aprueba el castellano');
    $a = wire($r)['page']['langs']['es']['approval'];
    T::same(['Marta Revisora', 'marta.revisora@torivac.test', 'comercial', gmdate('Y-m-d')], [$a['by'], $a['email'], $a['role'], $a['at']], 'quién, función y fecha');
    T::same(409, nc_call('POST', '/newcontent/a-medida/es/approve', $tr)->status, 'no se aprueba dos veces');
    $r = nc_call('POST', '/newcontent/a-medida/en/approve', $tr);
    T::same(200, $r->status, 'ahora sí el inglés');
    T::same('traductor', wire($r)['page']['langs']['en']['approval']['role'], 'con la función traductor');
    T::same(404, nc_call('POST', '/newcontent/a-medida/fr/approve', $tr)->status, 'un idioma que la página no tiene');
    T::same(404, nc_call('POST', '/newcontent/nada/es/approve', $tr)->status, 'una página que no existe');
    $log = wire(nc_call('GET', '/newcontent', $tr))['pages'][0]['log'];
    T::same(['aprobada', 'aprobada'], array_column($log, 'action'), 'las dos aprobaciones en el registro');
    T::same('marta.revisora@torivac.test', $log[0]['by'], 'con quién las hizo');
}

/** N4 · Proponer: lo puede hacer el manager o el Revisor; solo texto plano y con límites; solo se guarda lo que cambia. */
function test_newcontent_proposals_are_plain_text_and_only_what_changes()
{
    fresh(); nc_pages(); [$tj, $tr, $ta] = nc_tokens();
    T::same(403, nc_call('POST', '/newcontent/a-medida/es/propose', $ta, ['title' => 'Otro'])->status, 'el propietario no propone');
    $r = nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['title' => 'Fabricación a medida de transformadores', 'h1' => 'Fabricación a medida', 'note' => 'Título más directo']);
    T::same(201, $r->status, 'propone el manager');
    $pr = wire($r)['proposal'];
    T::same(['title'], array_keys($pr['fields']), 'solo el campo que cambia (el H1 era el mismo)');
    T::same(['pendiente', 'jefa@torivac.test', []], [$pr['status'], $pr['by'], $pr['problems']], 'pendiente, de quién y sin problemas');
    T::same(400, nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['title' => 'Fabricación a medida de transformadores ES'])->status, 'sin cambios respecto al texto vigente no hay propuesta');
    foreach ([['h1' => '<script>alert(1)</script>'], ['lead' => 'Hola <b>mundo</b>'], ['title' => str_repeat('x', 66)], ['sections' => [['h2' => 'A', 'p' => []]]], ['sections' => 'no'], ['cta' => [['label' => 'Ir', 'href' => 'javascript:alert(1)']]], ['note' => '<img src=x>']] as $bad) {
        $res = nc_call('POST', '/newcontent/a-medida/es/propose', $tr, $bad + ['title' => 'Otro título válido distinto']);
        T::true($res->status === 400 || ($res->status === 201 && !empty($res->body['proposal']['problems'])), 'se rechaza o se marca con problemas: ' . json_encode($bad));
    }
    $pend = wire(nc_call('GET', '/newcontent', $tr))['pages'][0]['langs']['es']['proposals'];
    T::true(count($pend) >= 1 && $pend[0]['status'] === 'pendiente', 'la propuesta aparece pendiente');
    T::same(['title'], array_keys($pend[count($pend) - 1]['fields']), 'se conservó tal cual la primera');
}

/** N5 · Decidir una propuesta: solo el Revisor; aceptar cambia el texto vigente y retira la aprobación (con registro); descartar no cambia nada. */
function test_newcontent_accepting_a_proposal_changes_the_text_and_withdraws_the_approval()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    nc_call('POST', '/newcontent/a-medida/es/approve', $tr);
    $p1 = wire(nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['title' => 'Transformadores a medida para industria']))['proposal']['id'];
    $p2 = wire(nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['h1' => 'Transformadores a medida']))['proposal']['id'];
    T::same(403, nc_call('POST', "/newcontent/a-medida/es/proposals/$p1", $tj, ['decision' => 'accept'])->status, 'el manager no decide');
    T::same(400, nc_call('POST', "/newcontent/a-medida/es/proposals/$p1", $tr, ['decision' => 'quizá'])->status, 'decisión no válida');
    T::same(404, nc_call('POST', '/newcontent/a-medida/es/proposals/Pdeadbeef', $tr, ['decision' => 'accept'])->status, 'propuesta que no existe');
    $r = nc_call('POST', "/newcontent/a-medida/es/proposals/$p2", $tr, ['decision' => 'reject', 'note' => 'Mejor el original']);
    T::same(200, $r->status, 'descarta una');
    $es = wire($r)['page']['langs']['es'];
    T::same(['Fabricación a medida', 'aprobado'], [$es['text']['h1'], $es['status']], 'descartar no cambia el texto ni la aprobación');
    $r = nc_call('POST', "/newcontent/a-medida/es/proposals/$p1", $tr, ['decision' => 'accept']);
    $es = wire($r)['page']['langs']['es'];
    T::same(['Transformadores a medida para industria', 'borrador', null], [$es['text']['title'], $es['status'], $es['approval']], 'aceptar cambia el texto y la versión vuelve a borrador');
    T::same(409, nc_call('POST', "/newcontent/a-medida/es/proposals/$p1", $tr, ['decision' => 'accept'])->status, 'una propuesta ya decidida no se decide otra vez');
    $acts = array_column(wire(nc_call('GET', '/newcontent', $tr))['pages'][0]['log'], 'action');
    foreach (['aprobada', 'propuesta', 'propuesta_descartada', 'propuesta_aceptada', 'aprobacion_invalidada'] as $a) T::true(in_array($a, $acts, true), "el registro lleva «{$a}»");
    T::same(200, nc_call('POST', '/newcontent/a-medida/es/approve', $tr)->status, 'se puede aprobar de nuevo el texto nuevo');
    T::same('Transformadores a medida para industria', wire(nc_call('GET', '/newcontent', $tr))['pages'][0]['langs']['es']['text']['title'], 'el texto aprobado es el nuevo');
}

/** N6 · Una propuesta que dejaría el texto fuera de las reglas (título de más de 65, descripción corta) se avisa y no se puede aceptar. */
function test_newcontent_a_proposal_that_breaks_the_rules_cannot_be_accepted()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    $r = nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['meta_description' => 'Corta']);
    $bad = wire($r);
    T::same(201, $r->status, 'se guarda para poder comentarla');
    T::true(count($bad['proposal']['problems']) === 1 && strpos($bad['proposal']['problems'][0], 'descripción') !== false, 'avisa del problema');
    $a = nc_call('POST', '/newcontent/a-medida/es/proposals/' . $bad['proposal']['id'], $tr, ['decision' => 'accept']);
    T::same(400, $a->status, 'no se puede aceptar');
    T::true(strpos($a->body['error'], 'No se puede aceptar') === 0, 'con motivo');
    T::same(200, nc_call('POST', '/newcontent/a-medida/es/proposals/' . $bad['proposal']['id'], $tr, ['decision' => 'reject'])->status, 'sí se puede descartar');
}

/** N7 · Retirar la aprobación: vuelve a borrador; al retirar el castellano las traducciones aprobadas también (no pueden publicarse sin él). */
function test_newcontent_withdrawing_spanish_also_withdraws_translations()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    T::same(409, nc_call('POST', '/newcontent/a-medida/es/withdraw', $tr)->status, 'no se retira lo que no está aprobado');
    nc_call('POST', '/newcontent/a-medida/es/approve', $tr); nc_call('POST', '/newcontent/a-medida/en/approve', $tr);
    T::same(403, nc_call('POST', '/newcontent/a-medida/es/withdraw', $tj)->status, 'el manager no retira');
    $r = nc_call('POST', '/newcontent/a-medida/es/withdraw', $tr);
    $l = wire($r)['page']['langs'];
    T::same(['borrador', 'borrador'], [$l['es']['status'], $l['en']['status']], 'las dos vuelven a borrador');
    $acts = array_column(wire($r)['page']['log'], 'action');
    T::same(['aprobacion_retirada', 'aprobacion_retirada', 'aprobada', 'aprobada'], $acts, 'registro: retirada del castellano, del inglés por arrastre y las dos aprobaciones');
}

/** N8 · Exportar: solo managers; lleva lo que cambió respecto al archivo y el registro nuevo; tras anotarlo en el archivo ya no sale nada. */
function test_newcontent_export_lists_only_what_the_files_do_not_have_yet()
{
    fresh(); $f = nc_pages(); [$tj, $tr] = nc_tokens();
    T::same(['ok' => true, 'pages' => []], array_intersect_key(wire(nc_call('GET', '/newcontent/export', $tj)), ['ok' => 1, 'pages' => 1]), 'sin cambios, nada que exportar');
    T::same(403, nc_call('GET', '/newcontent/export', $tr)->status, 'el Revisor no exporta');
    nc_call('POST', '/newcontent/a-medida/es/approve', $tr);
    $pid = wire(nc_call('POST', '/newcontent/a-medida/en/propose', $tj, ['h1' => 'Custom manufacturing']))['proposal']['id'];
    nc_call('POST', "/newcontent/a-medida/en/proposals/$pid", $tr, ['decision' => 'accept']);
    $x = wire(nc_call('GET', '/newcontent/export', $tj));
    $pg = $x['pages']['a-medida'];
    T::same(['es', 'en'], array_keys($pg['langs']), 'los dos idiomas cambiaron');
    T::same(['aprobado', 'comercial'], [$pg['langs']['es']['status'], $pg['langs']['es']['approval']['role']], 'el castellano, aprobado como comercial');
    T::same(['borrador', 'Custom manufacturing'], [$pg['langs']['en']['status'], $pg['langs']['en']['text']['h1']], 'el inglés, con el texto aceptado');
    T::true(!isset($pg['langs']['es']['approval']['th']), 'la huella interna no sale');
    T::same(['propuesta_aceptada', 'propuesta', 'aprobada'], array_column($pg['history'], 'action'), 'el registro nuevo, el más reciente primero');
    // el script de aplicar anota esto en el archivo: se simula escribiendo un archivo con ese estado y su historial
    $applied = ['langs' => ['es' => ['status' => 'aprobado', 'approval' => ['by' => $pg['langs']['es']['approval']['by'], 'role' => 'comercial', 'at' => gmdate('Y-m-d')]], 'en' => ['h1' => 'Custom manufacturing']], 'history' => $pg['history']];
    nc_pages($applied);
    $again = wire(nc_call('GET', '/newcontent/export', $tj));
    T::same([], $again['pages'], 'tras anotarlo en el archivo no queda nada por exportar');
    $v = wire(nc_call('GET', '/newcontent', $tr))['pages'][0];
    T::same(['aprobado', 'Custom manufacturing'], [$v['langs']['es']['status'], $v['langs']['en']['text']['h1']], 'el estado es el mismo antes y después de anotarlo');
    T::same(3, count($v['log']), 'el registro no se duplica (mismo id en el archivo y en el servidor)');
}

/** N9 · Si el archivo cambia después de una edición hecha en el panel, manda el archivo (la edición vieja se ignora y se avisa); una aprobación de un texto que ya no es ese no vale. */
function test_newcontent_the_file_wins_when_it_changed_after_an_edit()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    nc_call('POST', '/newcontent/a-medida/es/approve', $tr);
    $pid = wire(nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['title' => 'Título del panel']))['proposal']['id'];
    nc_call('POST', "/newcontent/a-medida/es/proposals/$pid", $tr, ['decision' => 'accept']);
    nc_call('POST', '/newcontent/a-medida/es/approve', $tr);
    nc_pages(['langs' => ['es' => ['title' => 'Título cambiado en el archivo']]]);          // alguien tocó el archivo a mano
    $es = wire(nc_call('GET', '/newcontent', $tr))['pages'][0]['langs']['es'];
    T::same(['Título cambiado en el archivo', true, 'borrador'], [$es['text']['title'], $es['stale_edit'], $es['status']], 'manda el archivo, se avisa y la aprobación (de otro texto) no vale');
    T::same(true, $es['approval_outdated'] || $es['status'] === 'borrador', 'aprobación no válida');
}

/** N10 · El archivo ya aprobado (anotado antes) cuenta como aprobado; un estado del servidor no lo toca hasta que se acepte un cambio. */
function test_newcontent_file_approvals_count_and_edits_withdraw_them()
{
    fresh(); nc_pages(['langs' => ['es' => ['status' => 'aprobado', 'approval' => ['by' => 'Marta', 'role' => 'comercial', 'at' => '2026-11-20']]]]); [$tj, $tr] = nc_tokens();
    $es = wire(nc_call('GET', '/newcontent', $tr))['pages'][0]['langs']['es'];
    T::same(['aprobado', 'Marta', 'comercial'], [$es['status'], $es['approval']['by'], $es['approval']['role']], 'aprobado en el archivo');
    $pid = wire(nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['lead' => 'Estudiamos cada aplicación.']))['proposal']['id'];
    $r = nc_call('POST', "/newcontent/a-medida/es/proposals/$pid", $tr, ['decision' => 'accept']);
    T::same(['borrador', 'Estudiamos cada aplicación.'], [wire($r)['page']['langs']['es']['status'], wire($r)['page']['langs']['es']['text']['lead']], 'aceptar un cambio retira la aprobación del archivo');
}

/** N11 · Auditoría: proponer, decidir, aprobar y retirar quedan en el registro de actividad del panel con su nombre en castellano. */
function test_newcontent_actions_are_in_the_activity_log()
{
    fresh(); nc_pages(); [$tj, $tr] = nc_tokens();
    $pid = wire(nc_call('POST', '/newcontent/a-medida/es/propose', $tj, ['title' => 'Un título nuevo y claro']))['proposal']['id'];
    nc_call('POST', "/newcontent/a-medida/es/proposals/$pid", $tr, ['decision' => 'accept']);
    nc_call('POST', '/newcontent/a-medida/es/approve', $tr); nc_call('POST', '/newcontent/a-medida/es/withdraw', $tr);
    $acts = array_column(wire(nc_call('GET', '/activity?days=1', $tj))['items'], 'a');
    foreach (['newcontent.propose', 'newcontent.decide', 'newcontent.approve', 'newcontent.withdraw'] as $a) T::true(in_array($a, $acts, true), "actividad: $a");
    T::same('Aprobó contenido nuevo', \Torivac\Audit::label('newcontent.approve'), 'nombre en castellano');
}

/** N12 · Sin archivo generado o dañado no hay páginas, nunca un error; /health anuncia la función. */
function test_newcontent_without_file_is_empty_and_health_announces_it()
{
    fresh(); [$tj] = nc_tokens();
    NewContent::setFile('/nonexistent/newcontent.json');
    T::same([], wire(nc_call('GET', '/newcontent', $tj))['pages'], 'sin archivo, lista vacía');
    $f = sys_get_temp_dir() . '/tv-nc-bad-' . bin2hex(random_bytes(3)) . '.json'; file_put_contents($f, '{no es json'); NewContent::setFile($f);
    T::same([], wire(nc_call('GET', '/newcontent', $tj))['pages'], 'archivo dañado, lista vacía');
    T::same(404, nc_call('POST', '/newcontent/a-medida/es/approve', login_token('marta.revisora@torivac.test', PW_REV, '10.8.1.4'))->status, 'sin páginas, nada que aprobar');
    T::same(true, wire(Router::handle(req('GET', '/health')))['features']['newcontent'], '/health anuncia «newcontent»');
}
