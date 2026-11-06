<?php
/**
 * Pruebas de las cuentas de cliente y de los presupuestos con sesión (Customers.php, Orders::handleOrder, Quotes.php, docs/PRECIOS-Y-CLIENTES.md §5.1, §6 y §7.3, 7.6, 7.7, 7.8): el CRUD de /customers (manager y propietario sí,
 * cliente y visitante no; nunca se toca una cuenta de otro rol), /users con el rol customer, create-user.php, POST /order con sesión (categoría del registro, 3 al día, sesión inválida, visitante consult/normal, staff con `tier`),
 * la lectura reducida del cliente (GET /orders y /orders/:n solo lo suyo, PUT y send → 403) y `tier` en PUT /orders/:n. Sin red: el correo es el controlador «file».
 */
namespace Torivac\Tests;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

use Torivac\Audit;
use Torivac\Auth;
use Torivac\Config;
use Torivac\Orders;
use Torivac\Prices;
use Torivac\Pricing;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

/** Almacén con precios, un manager (Jefe) y un propietario (María, rol client) con sesión → ['mgr' => token, 'own' => token]. */
function cu_setup(array $cfg = []): array
{
    fresh($cfg); seedPrices();
    Users::create(['email' => 'jefe@torivac.test', 'name' => 'Jefe', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'maria@torivac.test', 'name' => 'María', 'role' => 'client', 'password' => PW_ANA]);
    return ['mgr' => login_token('jefe@torivac.test', PW_JEFE, '10.8.1.1'), 'own' => login_token('maria@torivac.test', PW_ANA, '10.8.1.2')];
}

/** Crea una cuenta de cliente con su categoría y devuelve su token de sesión. */
function cu_customer(string $email, string $tier = 'normal', string $ip = '10.8.3.1'): string
{
    Users::create(['email' => $email, 'name' => 'Cliente ' . $email, 'role' => 'customer', 'tier' => $tier, 'password' => PW_CLI]);
    return (string) login_token($email, PW_CLI, $ip);
}

/** Llama al API como el navegador: método, ruta, cuerpo y, si se da, el token de sesión. */
function cu_call(string $method, string $path, $body = null, ?string $token = null, string $ip = '10.0.0.1')
{
    return Router::handle(req($method, $path, $body, $token === null ? [] : bearer($token), $ip));
}

/** POST /order por el router, con una IP distinta cada vez (no se tropieza con el límite de 8 pedidos por visitante). */
function cu_order(?string $token, ?array $body = null, ?string $ip = null)
{
    static $n = 0;
    return Router::handle(req('POST', '/order', $body ?? goodOrder(), $token === null ? [] : bearer($token), $ip ?? ('198.51.100.' . (1 + ($n++ % 250)))));
}

/** El registro guardado de un presupuesto. */
function cu_rec(string $n): array { return (array) Store::get('order:' . $n); }

/** Cuerpo de edición con las dos líneas de siempre (TT0020210 × 12 y P16633 × 3) y la revisión que se da; `$over` sobrescribe cualquier clave. */
function cu_edit_body(array $over = [], int $rev = 0): array
{
    return $over + ['rev' => $rev, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3]]];
}

/** Correos al equipo (asunto «[Web Torivac] Pedido …») que hay en la bandeja de salida. */
function cu_team_mails(): array
{
    return array_values(array_filter(outbox(), function ($m) { return strpos((string) ($m['subject'] ?? ''), '[Web Torivac] Pedido') === 0; }));
}

// ───────────────────────────────────────── 3 · /customers

/** 7.3 · CRUD completo de cuentas de cliente como manager y como propietario: alta (201), duplicado (409), listado con las categorías, cambio de categoría y nombre, contraseña nueva y baja. */
function test_cu_crud_as_manager_and_owner()
{
    $s = cu_setup();
    $g = cu_call('GET', '/customers', null, $s['mgr']);
    T::same([200, true, [], ['vip' => ['label' => 'VIP', 'pct' => 0], 'vip5' => ['label' => 'VIP +5', 'pct' => 5], 'vip10' => ['label' => 'VIP +10', 'pct' => 10], 'normal' => ['label' => 'Normal', 'pct' => 15]]], [$g->status, $g->body['ok'], $g->body['customers'], $g->body['tiers']], 'sin clientes todavía; las cuatro categorías con su porcentaje');
    $r = cu_call('POST', '/customers', ['email' => 'Compras@Empresa.es', 'name' => 'Empresa S.L.', 'password' => PW_CLI, 'tier' => 'vip5'], $s['mgr']);
    T::same([201, true], [$r->status, $r->body['ok']], 'alta: 201');
    $c = $r->body['customer'];
    T::same(['compras@empresa.es', 'Empresa S.L.', 'vip5'], [$c['email'], $c['name'], $c['tier']], 'el correo se guarda en minúsculas, con nombre y categoría');
    T::same(['email', 'name', 'tier', 'created'], array_keys($c), 'forma del cliente: email, name, tier, created (sin rol, hash ni sid)');
    T::same(1, preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $c['created']), 'created en ISO UTC');
    T::true(strpos(json_encode($r->body), 'hash') === false && strpos(json_encode($r->body), 'sid') === false && strpos(json_encode($r->body), PW_CLI) === false, 'sin hash, sid ni contraseña');
    $stored = Users::find('compras@empresa.es');
    T::same(['customer', 'vip5'], [$stored['role'], $stored['tier']], 'queda como rol customer con su categoría');
    T::true(password_verify(PW_CLI, $stored['hash']), 'la contraseña se guarda con hash');
    // duplicados
    $d = cu_call('POST', '/customers', ['email' => 'compras@empresa.es', 'name' => 'Otra', 'password' => PW_CLI], $s['mgr']);
    T::same([409, false, 'Ya existe un usuario con ese correo'], [$d->status, $d->body['ok'], $d->body['error']], 'el mismo correo: 409');
    T::same(409, cu_call('POST', '/customers', ['email' => 'COMPRAS@EMPRESA.ES', 'password' => PW_CLI], $s['mgr'])->status, 'aunque cambien las mayúsculas');
    T::same(409, cu_call('POST', '/customers', ['email' => 'jefe@torivac.test', 'password' => PW_CLI], $s['mgr'])->status, 'el correo de un manager también está ocupado');
    // el propietario también da de alta, con la categoría por defecto (normal) y el nombre = correo si no lo da
    $o = cu_call('POST', '/customers', ['email' => 'ana@acme.es', 'password' => PW_CLI], $s['own']);
    T::same([201, 'normal', 'ana@acme.es'], [$o->status, $o->body['customer']['tier'], $o->body['customer']['name']], 'el propietario da de alta: categoría normal y nombre = correo por defecto');
    // listado
    $l = cu_call('GET', '/customers', null, $s['own'])->body['customers'];
    T::same(['ana@acme.es', 'compras@empresa.es'], array_column($l, 'email'), 'el listado, por correo');
    T::same(['normal', 'vip5'], array_column($l, 'tier'), 'con su categoría');
    T::true(!array_key_exists('last_login', $l[0]), 'sin last_login mientras no haya entrado');
    cu_call('POST', '/auth/login', ['email' => 'ana@acme.es', 'password' => PW_CLI], null, '10.8.4.4');
    $l = cu_call('GET', '/customers', null, $s['mgr'])->body['customers'];
    T::same(1, preg_match('/^\d{4}-\d{2}-\d{2}T/', (string) ($l[0]['last_login'] ?? '')), 'tras entrar, last_login');
    T::true(!in_array('jefe@torivac.test', array_column($l, 'email'), true) && !in_array('maria@torivac.test', array_column($l, 'email'), true), 'el equipo no sale en la lista de clientes');
    // cambiar categoría y nombre
    $u = cu_call('PUT', '/customers/ana@acme.es', ['tier' => 'vip10'], $s['own']);
    T::same([200, true, 'vip10', 'ana@acme.es'], [$u->status, $u->body['ok'], $u->body['customer']['tier'], $u->body['customer']['name']], 'PUT tier');
    $u = cu_call('PUT', '/customers/ana@acme.es', ['name' => '  Ana   Pérez  '], $s['mgr']);
    T::same(['Ana Pérez', 'vip10'], [$u->body['customer']['name'], $u->body['customer']['tier']], 'PUT name (limpio de espacios) sin tocar la categoría');
    $u = cu_call('PUT', '/customers/' . rawurlencode('Ana@Acme.es'), ['tier' => 'vip', 'name' => 'Ana P.'], $s['mgr']);
    T::same([200, 'vip', 'Ana P.'], [$u->status, $u->body['customer']['tier'], $u->body['customer']['name']], 'los dos a la vez, con el correo codificado en la URL y en mayúsculas');
    T::same(['vip', 'Ana P.'], [Users::find('ana@acme.es')['tier'], Users::find('ana@acme.es')['name']], 'guardado');
    // contraseña
    $old = (string) login_token('ana@acme.es', PW_CLI, '10.8.4.5');
    T::same(200, cu_call('GET', '/auth/me', null, $old)->status, 'su sesión vale');
    $p = cu_call('POST', '/customers/ana@acme.es/password', ['password' => 'Otra-Clave-Nueva-2027!'], $s['mgr']);
    T::same([200, true], [$p->status, $p->body['ok']], 'contraseña nueva: 200');
    T::same(401, cu_call('GET', '/auth/me', null, $old)->status, 'y sus sesiones anteriores se cierran');
    T::same([null, true], [login_token('ana@acme.es', PW_CLI, '10.8.4.6'), login_token('ana@acme.es', 'Otra-Clave-Nueva-2027!', '10.8.4.7') !== null], 'la contraseña vieja ya no entra; la nueva sí');
    // baja: sus presupuestos NO se borran
    $tok = (string) login_token('ana@acme.es', 'Otra-Clave-Nueva-2027!', '10.8.4.8');
    $n = cu_order($tok)->body['number'];
    $x = cu_call('DELETE', '/customers/ana@acme.es', null, $s['own']);
    T::same([200, true], [$x->status, $x->body['ok']], 'baja: 200');
    T::same([401, null], [cu_call('GET', '/auth/me', null, $tok)->status, Users::find('ana@acme.es')], 'su sesión deja de valer y la cuenta no existe');
    T::same('ana@acme.es', cu_rec($n)['owner'], 'pero su presupuesto sigue guardado');
    T::same(404, cu_call('DELETE', '/customers/ana@acme.es', null, $s['mgr'])->status, 'borrar otra vez: 404');
    T::same(['compras@empresa.es'], array_column(cu_call('GET', '/customers', null, $s['mgr'])->body['customers'], 'email'), 'queda una');
    // si se vuelve a crear con el mismo correo, la sesión antigua no resucita
    cu_call('POST', '/customers', ['email' => 'ana@acme.es', 'password' => PW_CLI], $s['mgr']);
    T::same(401, cu_call('GET', '/auth/me', null, $tok)->status, 'volver a crear la cuenta no resucita sus tokens anteriores');
}

/** 7.3 · Validación del alta: correo, nombre, contraseña (reglas de siempre) y categoría; el rol del cuerpo no cuenta; cuerpo roto. */
function test_cu_create_validation()
{
    $s = cu_setup();
    $ok = ['email' => 'nuevo@empresa.es', 'name' => 'Nuevo', 'password' => PW_CLI, 'tier' => 'vip10'];
    $cases = [
        ['sin correo', array_diff_key($ok, ['email' => 1]), 'Correo no válido'], ['correo mal escrito', ['email' => 'no-es-correo'] + $ok, 'Correo no válido'], ['correo con coma', ['email' => 'a@b.co,c@d.co'] + $ok, 'Correo no válido'],
        ['correo que no es texto', ['email' => ['a@b.co']] + $ok, 'Correo no válido'], ['sin contraseña', array_diff_key($ok, ['password' => 1]), 'La contraseña necesita al menos 12 caracteres'],
        ['contraseña corta', ['password' => 'Corta-1'] + $ok, 'La contraseña necesita al menos 12 caracteres'], ['contraseña con el correo', ['password' => 'Nuevo-Clave-Nuevo-1'] + $ok, 'La contraseña no puede contener tu correo'],
        ['contraseña trivial', ['password' => 'Password12345'] + $ok, 'Esa contraseña es demasiado fácil de adivinar'], ['contraseña que no es texto', ['password' => 12345678901234] + $ok, 'Contraseña no válida'],
        ['nombre que no es texto', ['name' => ['x']] + $ok, 'Nombre no válido'], ['categoría desconocida', ['tier' => 'oro'] + $ok, 'Categoría no válida'], ['categoría que no es texto', ['tier' => 5] + $ok, 'Categoría no válida'],
        ['categoría en mayúsculas', ['tier' => 'VIP'] + $ok, 'Categoría no válida'], ['categoría con +', ['tier' => 'vip+5'] + $ok, 'Categoría no válida'],
    ];
    foreach ($cases as [$why, $body, $error]) {
        $r = cu_call('POST', '/customers', $body, $s['mgr']);
        T::same([400, false, $error], [$r->status, $r->body['ok'], $r->body['error']], "$why → 400");
    }
    T::same(['jefe@torivac.test', 'maria@torivac.test'], array_column(Users::all(), 'email'), 'ninguna petición rechazada creó una cuenta');
    foreach (['esto no es JSON', '[1,2]', '', 'null'] as $raw) T::same([400, 'Petición no válida'], [cu_call('POST', '/customers', $raw, $s['mgr'])->status, cu_call('POST', '/customers', $raw, $s['mgr'])->body['error']], 'cuerpo «' . $raw . '»: 400');
    T::same(413, cu_call('POST', '/customers', $ok + ['relleno' => str_repeat('x', 10100)], $s['mgr'])->status, 'cuerpo de más de 10 KB: 413');
    // el rol que pida el cuerpo no cuenta: siempre se crea un cliente
    $r = cu_call('POST', '/customers', $ok + ['role' => 'manager'], $s['own']);
    T::same([201, 'customer'], [$r->status, Users::find('nuevo@empresa.es')['role']], 'role:manager en el cuerpo se ignora: la cuenta es de cliente');
    $r = cu_call('POST', '/customers', ['email' => 'sin.categoria@empresa.es', 'password' => PW_CLI, 'tier' => null], $s['mgr']);
    T::same(['normal'], [$r->body['customer']['tier']], 'tier null o ausente: normal');
    $r = cu_call('POST', '/customers', ['email' => 'saltos@empresa.es', 'password' => PW_CLI, 'name' => "Ana\r\nBcc: v@x.es"], $s['mgr']);
    T::same('Ana Bcc: v@x.es', $r->body['customer']['name'], 'el nombre va en una sola línea');
    foreach (['vip', 'vip5', 'vip10', 'normal'] as $i => $t) T::same($t, cu_call('POST', '/customers', ['email' => "t$i@empresa.es", 'password' => PW_CLI, 'tier' => $t], $s['mgr'])->body['customer']['tier'], "categoría $t vale");
}

/** 7.3 · Cambiar categoría o nombre: 404 si la cuenta no existe o no es de cliente (nunca se toca otro rol), 400 con datos malos, sin cambios si falla. */
function test_cu_update_validation_and_other_roles_untouched()
{
    $s = cu_setup();
    cu_call('POST', '/customers', ['email' => 'ana@acme.es', 'name' => 'Ana', 'password' => PW_CLI, 'tier' => 'vip5'], $s['mgr']);
    foreach ([['categoría desconocida', ['tier' => 'oro'], 'Categoría no válida'], ['categoría null', ['tier' => null], 'Categoría no válida'], ['categoría texto raro', ['tier' => 'VIP5'], 'Categoría no válida'], ['nombre vacío', ['name' => '  '], 'Nombre no válido'],
        ['nombre que no es texto', ['name' => 5], 'Nombre no válido'], ['sin nada', [], 'Indica la categoría o el nombre'], ['solo claves desconocidas', ['x' => 1], 'Indica la categoría o el nombre']] as [$why, $body, $error]) {
        $r = cu_call('PUT', '/customers/ana@acme.es', $body, $s['mgr']);
        T::same([400, false, $error], [$r->status, $r->body['ok'], $r->body['error']], "$why → 400");
    }
    foreach (['esto no es JSON', '[1]', ''] as $raw) T::same(400, cu_call('PUT', '/customers/ana@acme.es', $raw, $s['mgr'])->status, 'cuerpo «' . $raw . '»: 400');
    T::same(['Ana', 'vip5'], [Users::find('ana@acme.es')['name'], Users::find('ana@acme.es')['tier']], 'nada de eso cambió la cuenta');
    // cuentas que no son de cliente: 404 y no se tocan
    $hashJefe = Users::find('jefe@torivac.test')['hash'];
    $hashMaria = Users::find('maria@torivac.test')['hash'];
    foreach (['jefe@torivac.test' => 'manager', 'maria@torivac.test' => 'client', 'nadie@acme.es' => 'inexistente'] as $email => $why) {
        $a = cu_call('PUT', "/customers/$email", ['tier' => 'vip', 'name' => 'Hackeado'], $s['mgr']);
        T::same([404, false, 'No existe ese cliente'], [$a->status, $a->body['ok'], $a->body['error']], "PUT sobre $why: 404");
        T::same(404, cu_call('POST', "/customers/$email/password", ['password' => 'Otra-Clave-Nueva-2027!'], $s['mgr'])->status, "contraseña de $why: 404");
        T::same(404, cu_call('DELETE', "/customers/$email", null, $s['mgr'])->status, "DELETE de $why: 404");
    }
    T::same([$hashJefe, $hashMaria, 'Jefe', 'María', 'manager', 'client'], [Users::find('jefe@torivac.test')['hash'], Users::find('maria@torivac.test')['hash'], Users::find('jefe@torivac.test')['name'], Users::find('maria@torivac.test')['name'], Users::find('jefe@torivac.test')['role'], Users::find('maria@torivac.test')['role']], 'el manager y la propietaria siguen intactos');
    T::same(200, cu_call('GET', '/auth/me', null, $s['mgr'])->status, 'y con su sesión (la contraseña del manager no se cerró)');
    // contraseña: reglas de siempre
    T::same(401, cu_call('POST', '/customers/ana@acme.es/password', ['password' => 'Otra-Clave-Nueva-2027!'], 'token-que-no-vale')->status, 'sin sesión válida: 401');
    foreach ([['corta', 'Corta-1', 'La contraseña necesita al menos 12 caracteres'], ['con el correo', 'Ana-Clave-Larga-2027', 'La contraseña no puede contener tu correo'], ['trivial', 'Password12345', 'Esa contraseña es demasiado fácil de adivinar'], ['vacía', '', 'La contraseña necesita al menos 12 caracteres']] as [$why, $pw, $error]) {
        $r = cu_call('POST', '/customers/ana@acme.es/password', ['password' => $pw], $s['mgr']);
        T::same([400, $error], [$r->status, $r->body['error']], "contraseña $why → 400");
    }
    T::same(400, cu_call('POST', '/customers/ana@acme.es/password', ['password' => ['x']], $s['mgr'])->status, 'contraseña que no es texto: 400');
    T::same(400, cu_call('POST', '/customers/ana@acme.es/password', 'no json', $s['mgr'])->status, 'cuerpo roto: 400');
    T::true(login_token('ana@acme.es', PW_CLI, '10.8.5.9') !== null, 'la contraseña de Ana sigue siendo la de antes');
    T::same(404, cu_call('GET', '/customers/ana@acme.es', null, $s['mgr'])->status, 'GET de una cuenta: no existe esa ruta (404)');
    T::same(404, cu_call('DELETE', '/customers', null, $s['mgr'])->status, 'DELETE /customers: 404');
    T::same(404, cu_call('PUT', '/customers/ana@acme.es/password', ['password' => 'x'], $s['mgr'])->status, 'PUT en /password: 404');
}

/** 7.3 · Solo manager y client gestionan clientes: un cliente con usuario recibe 403 y un visitante o una sesión inválida 401, en todas las rutas; no se llega a tocar nada. */
function test_cu_roles_and_audit()
{
    $s = cu_setup();
    cu_call('POST', '/customers', ['email' => 'ana@acme.es', 'password' => PW_CLI, 'tier' => 'vip5'], $s['mgr']);
    $ana = (string) login_token('ana@acme.es', PW_CLI, '10.8.6.1');
    $routes = [['GET', '/customers', null], ['POST', '/customers', ['email' => 'x@acme.es', 'password' => PW_CLI]], ['PUT', '/customers/ana@acme.es', ['tier' => 'vip']], ['POST', '/customers/ana@acme.es/password', ['password' => 'Otra-Clave-Nueva-2027!']], ['DELETE', '/customers/ana@acme.es', null]];
    foreach ($routes as [$m, $path, $body]) {
        T::same(401, cu_call($m, $path, $body)->status, "$m $path sin sesión: 401");
        T::same(401, cu_call($m, $path, $body, 'token-que-no-vale')->status, "$m $path con sesión inválida: 401");
        T::same([403, false], [cu_call($m, $path, $body, $ana)->status, cu_call($m, $path, $body, $ana)->body['ok']], "$m $path como cliente: 403");
    }
    T::same(['vip5', 'ana@acme.es'], [Users::find('ana@acme.es')['tier'], Users::find('ana@acme.es')['email']], 'lo intentado por un cliente no cambió nada');
    T::same(null, Users::find('x@acme.es'), 'ni creó cuentas');
    T::same(200, cu_call('GET', '/auth/me', null, $ana)->status, 'y su sesión sigue');
    // un cliente no ve la lista de usuarios ni nada técnico
    foreach (['/users', '/diag', '/activity', '/messages', '/admin/data', '/mail/status', '/settings/google', '/backups', '/blog/posts'] as $path) T::same(403, cu_call('GET', $path, null, $ana)->status, "GET $path como cliente: 403");
    T::same(403, cu_call('POST', '/users', ['email' => 'otro@acme.es', 'role' => 'manager', 'password' => PW_CLI], $ana)->status, 'POST /users como cliente: 403');
    // Actividad
    cu_call('PUT', '/customers/ana@acme.es', ['tier' => 'normal'], $s['own']);
    cu_call('PUT', '/customers/ana@acme.es', ['name' => 'Solo nombre'], $s['own']);
    cu_call('PUT', '/customers/ana@acme.es', ['tier' => 'normal'], $s['own']);
    cu_call('POST', '/customers/ana@acme.es/password', ['password' => 'Otra-Clave-Nueva-2027!'], $s['mgr']);
    cu_call('DELETE', '/customers/ana@acme.es', null, $s['mgr']);
    $by = [];
    foreach (Audit::read(1, 100, ['cat' => 'customer'])['items'] as $e) $by[$e['a']][] = $e;
    T::same(['customer.create', 'customer.tier', 'customer.password', 'customer.delete'], array_values(array_intersect(['customer.create', 'customer.tier', 'customer.password', 'customer.delete'], array_keys($by))), 'las cuatro acciones quedan en Actividad');
    T::same(['ana@acme.es (vip5)', 'jefe@torivac.test', 'manager', 'Creó una cuenta de cliente'], [$by['customer.create'][0]['d'], $by['customer.create'][0]['u'], $by['customer.create'][0]['r'], $by['customer.create'][0]['label']], 'customer.create: correo y categoría, quién y con qué rol');
    T::same([1, 'ana@acme.es → normal', 'maria@torivac.test', 'client', 'Cambió la categoría de un cliente'], [count($by['customer.tier']), $by['customer.tier'][0]['d'], $by['customer.tier'][0]['u'], $by['customer.tier'][0]['r'], $by['customer.tier'][0]['label']], 'customer.tier solo cuando cambia la categoría: «correo → categoría» (cambiar solo el nombre o repetir la categoría no lo anota)');
    T::same(['ana@acme.es', 'Cambió la contraseña de un cliente'], [$by['customer.password'][0]['d'], $by['customer.password'][0]['label']], 'customer.password: sin la contraseña');
    T::same(['ana@acme.es', 'Borró una cuenta de cliente'], [$by['customer.delete'][0]['d'], $by['customer.delete'][0]['label']], 'customer.delete');
    T::true(strpos(json_encode(Audit::read(1, 100)['items']), 'Otra-Clave') === false && strpos(json_encode(Audit::read(1, 100)['items']), PW_CLI) === false, 'ninguna contraseña en el registro');
}

/** 7.3 · /users del manager ve y acepta el rol customer y su categoría; el propietario no lo ve; el cliente no tiene código por correo. */
function test_cu_users_route_with_customer_role()
{
    $s = cu_setup();
    $r = cu_call('POST', '/users', ['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'customer', 'tier' => 'vip10', 'password' => PW_CLI], $s['mgr']);
    T::same([201, true, 'customer', 'vip10'], [$r->status, $r->body['ok'], $r->body['user']['role'], $r->body['user']['tier']], 'POST /users acepta role customer con tier');
    $r = cu_call('POST', '/users', ['email' => 'bea@acme.es', 'name' => 'Bea', 'role' => 'customer', 'password' => PW_CLI], $s['mgr']);
    T::same('normal', $r->body['user']['tier'], 'sin tier: normal');
    $r = cu_call('POST', '/users', ['email' => 'cris@acme.es', 'role' => 'customer', 'tier' => 'oro', 'password' => PW_CLI], $s['mgr']);
    T::same([400, 'Categoría no válida'], [$r->status, $r->body['error']], 'categoría inválida: 400');
    $r = cu_call('POST', '/users', ['email' => 'dani@torivac.test', 'role' => 'client', 'tier' => 'vip', 'password' => PW_CLI], $s['mgr']);
    T::same([201, false, false], [$r->status, array_key_exists('tier', $r->body['user']), array_key_exists('tier', Users::find('dani@torivac.test'))], 'el tier solo existe en el rol customer: en client se ignora y no se guarda');
    T::same([400, 'Rol no válido'], [cu_call('POST', '/users', ['email' => 'e@acme.es', 'role' => 'cliente', 'password' => PW_CLI], $s['mgr'])->status, cu_call('POST', '/users', ['email' => 'e@acme.es', 'role' => 'cliente', 'password' => PW_CLI], $s['mgr'])->body['error']], 'rol desconocido: 400');
    $u = cu_call('GET', '/users', null, $s['mgr'])->body['users'];
    $by = [];
    foreach ($u as $x) $by[$x['email']] = $x;
    T::same(['vip10', 'normal'], [$by['ana@acme.es']['tier'], $by['bea@acme.es']['tier']], 'GET /users devuelve tier en las cuentas customer');
    T::same([false, false, false], [array_key_exists('tier', $by['jefe@torivac.test']), array_key_exists('tier', $by['maria@torivac.test']), array_key_exists('tier', $by['dani@torivac.test'])], 'y no en las demás');
    T::same(['n/a', 'customer'], [$by['ana@acme.es']['code'], $by['ana@acme.es']['role']], 'el cliente no usa el código por correo');
    T::same(403, cu_call('GET', '/users', null, $s['own'])->status, 'el propietario no ve la lista de usuarios');
    $tok = (string) login_token('ana@acme.es', PW_CLI, '10.8.7.1');
    $me = cu_call('GET', '/auth/me', null, $tok);
    T::same([200, 'customer'], [$me->status, $me->body['user']['role']], 'el cliente entra y /auth/me lo reconoce');
    $login = cu_call('POST', '/auth/login', ['email' => 'ana@acme.es', 'password' => PW_CLI], null, '10.8.7.2');
    T::same(['customer', 'vip10'], [$login->body['user']['role'], $login->body['user']['tier']], 'el acceso devuelve el usuario con su categoría');
    T::same(200, cu_call('POST', '/users/ana@acme.es/password', ['password' => 'Otra-Clave-Nueva-2027!'], $s['mgr'])->status, 'el manager también puede cambiarle la contraseña por /users');
    T::same(200, cu_call('DELETE', '/users/ana@acme.es', null, $s['mgr'])->status, 'y borrarlo por /users');
    T::same(401, cu_call('GET', '/auth/me', null, $tok)->status, 'sesión cerrada');
}

/** 7.3 · tools/create-user.php acepta el rol customer y un 5.º argumento con la categoría. */
function test_cu_create_user_tool_customer_and_tier()
{
    $dir = tmp_dir('tv-cli-');
    $run = function (array $args) use ($dir) {
        $p = proc_open(array_merge([PHP_BINARY, dirname(__DIR__) . '/tools/create-user.php'], $args), [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, array_merge(getenv(), ['TORIVAC_STORAGE_DIR' => $dir]));
        $o = stream_get_contents($pipes[1]); $e = stream_get_contents($pipes[2]);
        return [proc_close($p), $o, $e];
    };
    try {
        [$rc, $out] = $run(['ana@acme.es', 'Ana', 'customer', PW_CLI, 'vip10']);
        T::same([0, true], [$rc, strpos($out, 'Usuario creado: ana@acme.es (customer, categoría vip10)') !== false], 'customer con categoría');
        [$rc, $out] = $run(['bea@acme.es', 'Bea', 'customer', PW_CLI]);
        T::same([0, true], [$rc, strpos($out, 'Usuario creado: bea@acme.es (customer, categoría normal)') !== false], 'customer sin 5.º argumento: normal');
        [$rc, , $err] = $run(['cris@acme.es', 'Cris', 'customer', PW_CLI, 'oro']);
        T::same([1, true], [$rc, strpos($err, 'Categoría no válida') !== false], 'categoría desconocida: error');
        [$rc, $out] = $run(['dani@torivac.test', 'Dani', 'client', PW_CLI, 'vip']);
        T::same([0, true], [$rc, strpos($out, 'Usuario creado: dani@torivac.test (client)') !== false], 'en otro rol el 5.º argumento no se usa');
        [$rc, , $err] = $run(['x@acme.es', 'X', 'customer']);
        T::same([2, true], [$rc, strpos($err, 'manager|client|customer') !== false], 'el uso menciona los tres roles');
        Store::init($dir);
        T::same(['customer', 'vip10', 'normal', false], [Users::find('ana@acme.es')['role'], Users::find('ana@acme.es')['tier'], Users::find('bea@acme.es')['tier'], array_key_exists('tier', Users::find('dani@torivac.test'))], 'y queda guardado así');
        T::same(null, Users::find('cris@acme.es'), 'la rechazada no se creó');
    } finally { rmtree_all($dir); fresh(); }
}

// ───────────────────────────────────────── 6 · POST /order con sesión

/** 7.6 · Un cliente presupuesta con SU categoría (leída del registro), ignora `price`, `unit` y `tier` del cuerpo, no necesita Turnstile, hp ni _e, y el registro lleva owner y priceTier; responde `remaining`. */
function test_cu_order_customer_valued_with_own_tier()
{
    $s = cu_setup(['form_min_fill_ms' => 1200, 'turnstile_secret' => 'secreto-turnstile-de-pruebas']);
    $tok = cu_customer('ana@acme.es', 'vip5');
    $body = goodOrder(['tier' => 'vip', 'priceTier' => 'vip', 'owner' => 'otro@acme.es', 'hp' => 'soy un bot', 'lines' => [['ref' => 'TT0020210', 'qty' => 12, 'price' => 0.01, 'unit' => 0.02, 'total' => 0.2], ['ref' => 'P16633', 'qty' => 3, 'price' => 1]]]);
    $r = cu_order($tok, $body);
    T::same([200, true, 363.04, 0, 2], [$r->status, $r->body['ok'], $r->body['total'], $r->body['unpriced'], $r->body['remaining']], 'valorado con VIP +5; el cuerpo no fija precios ni categoría; quedan 2');
    $rec = cu_rec($r->body['number']);
    T::same([[['ref' => 'TT0020210', 'qty' => 12, 'unit' => 12.495, 'total' => 149.94], ['ref' => 'P16633', 'qty' => 3, 'unit' => 71.0325, 'total' => 213.1]], 'ana@acme.es', 'vip5'], [$rec['lines'], $rec['owner'], $rec['priceTier']], 'líneas con los precios VIP +5; owner = su correo (no el del cuerpo); priceTier = su categoría');
    T::same('ana@acme.es', $rec['customer']['email'], 'el solicitante es el que escribió en el formulario');
    $v = cu_order(null, goodOrder(['_e' => 5000]));
    T::same([400, 'captcha'], [$v->status, $v->body['code'] ?? null], 'el visitante, con Turnstile configurado y sin token, no pasa');
    T::same([400, 'too_fast'], [cu_order(null)->status, cu_order(null)->body['code'] ?? null], 'ni sin `_e`');
    T::same([400, 'Solicitud no válida'], [cu_order(null, goodOrder(['hp' => 'x', '_e' => 5000, 'turnstileToken' => 'tok']))->status, cu_order(null, goodOrder(['hp' => 'x', '_e' => 5000, 'turnstileToken' => 'tok']))->body['error']], 'ni con el honeypot relleno');
    // las validaciones normales siguen
    T::same([400, 'Referencia desconocida: NOPE'], [cu_order($tok, goodOrder(['lines' => [['ref' => 'NOPE', 'qty' => 1]]]))->status, cu_order($tok, goodOrder(['lines' => [['ref' => 'NOPE', 'qty' => 1]]]))->body['error']], 'una referencia desconocida sigue siendo 400');
    $noPriv = goodOrder(); $noPriv['customer']['privacy'] = false;
    T::same([400, 'Debes aceptar la política de privacidad'], [cu_order($tok, $noPriv)->status, cu_order($tok, $noPriv)->body['error']], 'la política de privacidad se sigue exigiendo');
    // la categoría se lee del registro EN CADA petición
    cu_call('PUT', '/customers/ana@acme.es', ['tier' => 'normal'], $s['own']);
    $r2 = cu_order($tok);
    T::same([397.61, 'normal'], [$r2->body['total'], cu_rec($r2->body['number'])['priceTier']], 'tras cambiarle la categoría a Normal, con el mismo token, el siguiente presupuesto sale a Normal');
    // y los porcentajes masivos valen al instante
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 20], 'anon' => 'consult', 'approx' => ['on' => false, 'pct' => 15], 'updated' => null]);
    $r3 = cu_order(cu_customer('bea@acme.es', 'normal', '10.8.3.2'));
    T::same(414.9, $r3->body['total'], 'con Normal al 20 %: 12×14.28 + 3×81.18');
    // aviso al equipo: cuenta y categoría
    $mails = cu_team_mails();
    $first = null;
    foreach ($mails as $m) if (strpos($m['subject'], $r->body['number']) !== false) $first = $m;
    T::true($first !== null && strpos($first['text'], 'Cuenta: ana@acme.es · Categoría de precio: VIP +5') !== false, 'el correo al equipo lleva la cuenta y la categoría (texto)');
    T::true(strpos($first['html'], 'Cuenta: ana@acme.es · Categoría de precio: VIP +5') !== false, 'y en el HTML');
    T::same('ana@acme.es', $first['replyTo'], 'Reply-To sigue siendo el solicitante');
}

/** 7.6 · Límite de 3 al día por persona (ventana móvil de 24 h): el 4.º es 429 daily_limit; un 400 no gasta cupo; se puede configurar; cada persona tiene el suyo; el personal no tiene límite. */
function test_cu_order_daily_limit()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'vip5');
    $bea = cu_customer('bea@acme.es', 'normal', '10.8.3.2');
    for ($i = 0; $i < 5; $i++) T::same(400, cu_order($ana, goodOrder(['lines' => [['ref' => 'NOPE', 'qty' => 1]]]))->status, "presupuesto inválido $i: 400");
    $left = [];
    for ($i = 0; $i < 3; $i++) { $r = cu_order($ana); $left[] = [$r->status, $r->body['remaining'] ?? null]; }
    T::same([[200, 2], [200, 1], [200, 0]], $left, 'los inválidos no gastaron cupo: tres válidos y `remaining` baja 2, 1, 0');
    $r = cu_order($ana);
    T::same([429, false, 'daily_limit', 'Has alcanzado el límite de 3 presupuestos al día. Vuelve a intentarlo mañana o escribe al equipo.'], [$r->status, $r->body['ok'], $r->body['code'], $r->body['error']], 'el 4.º: 429 daily_limit con su texto');
    T::same(false, array_key_exists('remaining', $r->body), 'sin remaining en el error');
    T::same(3, count(Orders::ownedBy('ana@acme.es')), 'no se guardó un 4.º presupuesto');
    $bad = cu_order($ana, goodOrder(['lines' => [['ref' => 'NOPE', 'qty' => 1]]]));
    T::same(400, $bad->status, 'con el cupo agotado, un cuerpo inválido sigue siendo 400 (se valida antes)');
    $rb = cu_order($bea);
    T::same([200, 2], [$rb->status, $rb->body['remaining']], 'otra persona tiene su propio cupo');
    $q = cu_call('GET', '/orders', null, $ana);
    T::same(['limit' => 3, 'used' => 3], $q->body['quota'], 'quota en GET /orders: limit y used');
    for ($i = 0; $i < 5; $i++) T::same(200, cu_order($s['mgr'])->status, "el manager no tiene límite ($i)");
    T::same(200, cu_order($s['own'])->status, 'ni la propietaria');
    // límite configurable
    Config::set(array_merge(Config::all(), ['customer_orders_per_day' => 1]));
    $cris = cu_customer('cris@acme.es', 'vip', '10.8.3.3');
    $rc = cu_order($cris);
    T::same([200, 0, 1], [$rc->status, $rc->body['remaining'], count(Orders::ownedBy('cris@acme.es'))], 'customer_orders_per_day = 1: el primero entra y no queda ninguno');
    $r = cu_order($cris);
    T::same([429, 'Has alcanzado el límite de 1 presupuestos al día. Vuelve a intentarlo mañana o escribe al equipo.'], [$r->status, $r->body['error']], 'el segundo: 429 con el límite configurado en el texto');
    $q = cu_call('GET', '/orders', null, $cris);
    T::same(['limit' => 1, 'used' => 1], $q->body['quota'], 'y quota lo refleja');
    // valores de configuración: entero ≥ 1; si no, 3
    foreach ([[5, 5], ['7', 7], [7.0, 7], [0, 3], [-2, 3], ['x', 3], ['', 3], [true, 3], [2.5, 3], ['2.5', 3], [[4], 3], [null, 3]] as [$cfg, $want]) {
        Config::set(array_merge(Config::all(), ['customer_orders_per_day' => $cfg]));
        T::same($want, Orders::customerDailyMax(), 'customer_orders_per_day = ' . json_encode($cfg) . ' → ' . $want);
    }
    putenv('TORIVAC_CUSTOMER_ORDERS_PER_DAY=9');
    try { T::same(9, Orders::customerDailyMax(), 'la variable de entorno TORIVAC_CUSTOMER_ORDERS_PER_DAY manda'); } finally { putenv('TORIVAC_CUSTOMER_ORDERS_PER_DAY'); }
}

/** 7.6 · La ventana de 24 h es móvil: el cupo se libera cuando el presupuesto más antiguo cumple 24 h. */
function test_cu_order_daily_limit_is_a_moving_24h_window()
{
    cu_setup();
    $who = ['sub' => 'ana@acme.es', 'role' => 'customer', 'tier' => 'normal'];
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'customer', 'tier' => 'normal', 'password' => PW_CLI]);
    $t0 = 1793170800000;                                                                       // 2026-10-28T07:00Z
    $post = function (int $ms, int $n) use ($who) { $b = goodOrder(); return Orders::handleOrder(req('POST', '/order', $b, [], '203.0.113.' . $n), $b, null, $ms, $who); };
    T::same([200, 200, 200], [$post($t0, 1)->status, $post($t0 + 3600000, 2)->status, $post($t0 + 7200000, 3)->status], 'tres presupuestos en dos horas');
    $r = $post($t0 + 23 * 3600000, 4);
    T::same([429, 'daily_limit'], [$r->status, $r->body['code']], 'a las 23 h: sigue el límite');
    $r = $post($t0 + 86400000 + 1, 5);
    T::same([200, 0], [$r->status, $r->body['remaining']], 'pasadas 24 h del primero: se libera uno (los otros dos siguen contando) y vuelve a quedar lleno');
    T::same(429, $post($t0 + 86400000 + 2, 6)->status, 'y se vuelve a llenar');
    T::same(200, $post($t0 + 86400000 + 3600000 + 1, 7)->status, 'una hora más tarde, el segundo cumple las 24 h y entra otro');
    T::same(3, Orders::usedIn24h('ana@acme.es', $t0 + 86400000 + 3600000 + 2), 'usedIn24h cuenta solo la ventana');
    T::same(0, Orders::usedIn24h('ana@acme.es', $t0 + 4 * 86400000), 'pasados varios días, 0');
    T::same(0, Orders::usedIn24h('otra@acme.es', $t0 + 1000), 'y por persona');
}

/** 7.6 · Una sesión inválida, caducada o de una cuenta borrada en POST /order es 401 con code «session» (no se trata como visitante); no se guarda nada ni se gasta cupo. */
function test_cu_order_invalid_session_is_401()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'normal');
    $gone = cu_customer('gone@acme.es', 'normal', '10.8.3.2');
    $out = cu_customer('out@acme.es', 'normal', '10.8.3.3');
    $sid = (string) Users::find('ana@acme.es')['sid'];
    $expired = Auth::signSession(['sub' => 'ana@acme.es', 'sid' => $sid], SECRET, Util_nowMs() - 90000000);
    Users::delete('gone@acme.es');
    Users::revokeSessions('out@acme.es');
    $want = [401, false, 'session', 'Tu sesión ha caducado. Vuelve a entrar.'];
    foreach (['token inválido' => 'esto-no-es-un-token', 'sesión caducada' => $expired, 'cuenta borrada' => $gone, 'sesiones cerradas' => $out, 'firma ajena' => $ana . 'x'] as $why => $tok) {
        $r = cu_order($tok);
        T::same($want, [$r->status, $r->body['ok'], $r->body['code'] ?? null, $r->body['error'] ?? null], "$why: 401 session");
    }
    T::same([], Store::names('order:'), 'no se guardó ningún presupuesto');
    $r1 = cu_order($ana);
    T::same([200, 2], [$r1->status, $r1->body['remaining']], 'la sesión buena sigue funcionando y los 401 no gastaron cupo');
    T::same(1, cu_order($ana)->body['remaining'], 'el cupo solo lo gastan los presupuestos guardados');
    $direct = Orders::handleOrder(req('POST', '/order', goodOrder(), bearer($ana), '203.0.113.50'), goodOrder());
    T::same([200, 'normal'], [$direct->status, cu_rec($direct->body['number'])['priceTier']], 'Orders::handleOrder llamado directamente con un Bearer válido también reconoce la sesión');
    $directBad = Orders::handleOrder(req('POST', '/order', goodOrder(), bearer('token-que-no-vale'), '203.0.113.51'), goodOrder());
    T::same([401, 'session'], [$directBad->status, $directBad->body['code'] ?? null], 'y con uno inválido, 401 session');
    $masterBad = Router::handle(req('POST', '/order', goodOrder(), ['Authorization' => 'Bearer ' . MASTER_TOKEN . 'x'], '198.51.100.99'));
    T::same([401, 'session'], [$masterBad->status, $masterBad->body['code'] ?? null], 'un token maestro mal escrito también es 401');
}

/** Milisegundos actuales (la prueba firma una sesión ya caducada). */
function Util_nowMs(): int { return \Torivac\Util::nowMs(); }

/** 7.6 · Visitante: con anon = consult todas las líneas salen «A consultar» (priceTier consult); con anon = normal, a precio Normal. Antispam como siempre y el cuerpo nunca fija categoría ni precio. */
function test_cu_order_visitor_consult_and_normal()
{
    $s = cu_setup();
    $r = cu_order(null, goodOrder(['tier' => 'vip', 'lines' => [['ref' => 'TT0020210', 'qty' => 12, 'price' => 1], ['ref' => 'P16633', 'qty' => 3, 'unit' => 1]]]));
    T::same([200, 0, 2, false], [$r->status, $r->body['total'], $r->body['unpriced'], array_key_exists('remaining', $r->body)], 'por defecto (consult): sin total y sin precios; unpriced = nº de líneas');
    $rec = cu_rec($r->body['number']);
    T::same([[['ref' => 'TT0020210', 'qty' => 12, 'unit' => null, 'total' => null], ['ref' => 'P16633', 'qty' => 3, 'unit' => null, 'total' => null]], 'consult', false, 0, 2], [$rec['lines'], $rec['priceTier'], array_key_exists('owner', $rec), $rec['total'], $rec['unpriced']], 'registro: líneas null, priceTier consult, sin owner');
    $t = cu_team_mails()[0];
    T::true(strpos($t['text'], 'Cuenta: visitante sin sesión · Categoría de precio: A consultar') !== false, 'el correo al equipo dice que es un visitante y «A consultar»');
    T::true(strpos($t['html'], '2 línea(s) «A consultar» no incluidas en el total') !== false, 'y las líneas a consultar (HTML)');
    // anon = normal
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'normal', 'approx' => ['on' => false, 'pct' => 15], 'updated' => null]);
    $r = cu_order(null, goodOrder(['tier' => 'vip']));
    T::same([200, 397.61, 0], [$r->status, $r->body['total'], $r->body['unpriced']], 'anon = normal: precio Normal (el `tier` del cuerpo no vale)');
    $rec = cu_rec($r->body['number']);
    T::same(['normal', 13.685, false], [$rec['priceTier'], $rec['lines'][0]['unit'], array_key_exists('owner', $rec)], 'registro: priceTier normal');
    // el aproximado no cambia el presupuesto del visitante
    Store::put(Pricing::KEY, ['tiers' => ['vip5' => 5, 'vip10' => 10, 'normal' => 15], 'anon' => 'consult', 'approx' => ['on' => true, 'pct' => 15], 'updated' => null]);
    T::same([0, 2], [cu_order(null)->body['total'], cu_order(null)->body['unpriced']], 'con aproximado activado, el presupuesto sigue «A consultar»');
    // un visitante con la IP limitada sigue limitado
    $codes = [];
    for ($i = 0; $i < 10; $i++) $codes[] = cu_order(null, null, '192.0.2.77')->status;
    T::same([8, 2], [count(array_keys($codes, 200)), count(array_keys($codes, 429))], 'el límite de 8 pedidos por visitante cada 10 minutos sigue');
}

/** 7.6 · Personal con sesión: valoración VIP salvo `tier` en el cuerpo (solo para ellos); owner = su correo; sin Turnstile; categoría inválida → 400. */
function test_cu_order_staff_with_tier()
{
    $s = cu_setup(['form_min_fill_ms' => 1200, 'turnstile_secret' => 'secreto-turnstile-de-pruebas']);
    foreach (['manager' => [$s['mgr'], 'jefe@torivac.test'], 'client' => [$s['own'], 'maria@torivac.test']] as $who => [$tok, $email]) {
        $r = cu_order($tok);
        T::same([200, 345.75, 0, false], [$r->status, $r->body['total'], $r->body['unpriced'], array_key_exists('remaining', $r->body)], "$who: VIP por defecto, sin Turnstile ni _e, sin remaining");
        $rec = cu_rec($r->body['number']);
        T::same([$email, 'vip', 11.9], [$rec['owner'], $rec['priceTier'], $rec['lines'][0]['unit']], "$who: owner = su correo y priceTier vip");
        foreach (['vip' => 345.75, 'vip5' => 363.04, 'vip10' => 380.33, 'normal' => 397.61] as $tier => $total) {
            $r = cu_order($tok, goodOrder(['tier' => $tier]));
            T::same([$total, $tier], [$r->body['total'], cu_rec($r->body['number'])['priceTier']], "$who: tier $tier → $total");
        }
        T::same(345.75, cu_order($tok, goodOrder(['tier' => null]))->body['total'], "$who: tier null = no viene (VIP)");
        T::same(345.75, cu_order($tok, goodOrder(['tier' => '']))->body['total'], "$who: tier vacío = no viene (VIP)");
        foreach (['oro', 'VIP', 5, ['vip'], true] as $bad) {
            $r = cu_order($tok, goodOrder(['tier' => $bad]));
            T::same([400, false, 'Categoría no válida', 'tier'], [$r->status, $r->body['ok'], $r->body['error'], $r->body['field'] ?? null], "$who: tier " . json_encode($bad) . ' → 400');
        }
    }
    // token maestro: VIP, sin owner (no es una persona)
    $r = Router::handle(req('POST', '/order', goodOrder(['tier' => 'normal']), master(), '198.51.100.88'));
    $rec = cu_rec($r->body['number']);
    T::same([200, 397.61, 'normal', false], [$r->status, $r->body['total'], $rec['priceTier'], array_key_exists('owner', $rec)], 'el token maestro puede fijar la categoría y no deja owner');
    $mm = null;
    foreach (cu_team_mails() as $m) if (strpos($m['subject'], $r->body['number']) !== false) $mm = $m;
    T::true($mm !== null && strpos($mm['text'], 'Cuenta: token maestro · Categoría de precio: Normal') !== false, 'y el aviso lo dice');
    // el personal no tiene que pasar el antispam; un cuerpo mal formado sigue siendo 400
    T::same(200, cu_order($s['mgr'], goodOrder(['hp' => 'x']))->status, 'con sesión no se exige el honeypot');
    T::same(400, cu_order($s['mgr'], goodOrder(['lines' => []]))->status, 'pero un presupuesto vacío sí es 400');
}

// ───────────────────────────────────────── 7 · Lectura del cliente

/** 7.7 · GET /orders de un cliente: solo los suyos (owner), reducidos (sin ip, emailed, history, lastSent, original, rev, edited, owner, prices, priceTier), el más reciente primero y con quota; el propietario sigue viendo todo. */
function test_cu_read_customer_lists_only_own_reduced()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'vip5');
    $bea = cu_customer('bea@acme.es', 'normal', '10.8.3.2');
    $who = function ($e) { return ['sub' => $e, 'role' => 'customer', 'tier' => Users::find($e)['tier']]; };
    $t0 = \Torivac\Util::nowMs() - 3 * 86400000;                                              // hace tres días: fuera de la ventana de 24 h
    $mk = function (string $email, int $ms, int $n) use ($who) { $b = goodOrder(['customer' => so_customer(['email' => $email])]); return Orders::handleOrder(req('POST', '/order', $b, [], '203.0.113.' . $n), $b, null, $ms, $who($email))->body['number']; };
    $a1 = $mk('ana@acme.es', $t0, 1);
    $b1 = $mk('bea@acme.es', $t0 + 1000, 2);
    $a2 = $mk('ana@acme.es', $t0 + 2000, 3);
    $v1 = Orders::handleOrder(req('POST', '/order', goodOrder(['customer' => so_customer(['email' => 'ana@acme.es'])]), [], '203.0.113.4'), goodOrder(['customer' => so_customer(['email' => 'ana@acme.es'])]), null, $t0 + 3000)->body['number'];
    $m1 = Orders::handleOrder(req('POST', '/order', goodOrder(), [], '203.0.113.5'), goodOrder(), null, $t0 + 4000, ['sub' => 'jefe@torivac.test', 'role' => 'manager'])->body['number'];
    cu_call('PUT', "/orders/$a1", cu_edit_body(['quoteNote' => 'Validez: 30 días.']), $s['mgr']);
    $r = cu_call('GET', '/orders', null, $ana);
    T::same([200, true, [$a2, $a1]], [$r->status, $r->body['ok'], array_column($r->body['orders'], 'number')], 've solo los suyos (no el de Bea, ni el del visitante con su mismo correo de solicitante, ni el del manager), el más reciente primero');
    T::same(['number', 'at', 'customer', 'lines', 'total', 'unpriced', 'lang'], array_keys($r->body['orders'][0]), 'forma reducida: number, at, customer, lines, total, unpriced, lang');
    T::same(['number', 'at', 'customer', 'lines', 'total', 'unpriced', 'lang', 'quoteNote'], array_keys($r->body['orders'][1]), 'y quoteNote cuando el equipo la puso');
    T::same('Validez: 30 días.', $r->body['orders'][1]['quoteNote'], 'con su texto');
    $txt = json_encode($r->body['orders']);
    foreach (['"ip"', 'emailed', 'history', 'lastSent', 'original', '"rev"', 'edited', '"owner"', '"prices"', 'priceTier', 'consult'] as $no) T::true(strpos($txt, $no) === false, "la lista del cliente no lleva «{$no}»");
    T::same(['limit' => 3, 'used' => 0], $r->body['quota'], 'quota: limit 3 y used = solo los de las últimas 24 h (estos son de octubre de 2026: ya no cuentan)');
    $r = cu_call('GET', '/orders', null, $bea);
    T::same([[$b1], false], [array_column($r->body['orders'], 'number'), array_key_exists('truncated', $r->body)], 'Bea ve el suyo');
    // el propietario y el manager siguen viendo todos
    $own = cu_call('GET', '/orders', null, $s['own'])->body['orders'];
    T::same(5, count($own), 'el propietario ve los cinco');
    T::true(!array_key_exists('ip', $own[0]) && array_key_exists('owner', $own[0]) && array_key_exists('priceTier', $own[0]), 'sin ip, con owner y priceTier');
    $mgr = cu_call('GET', '/orders', null, $s['mgr'])->body['orders'];
    T::true(count($mgr) === 5 && array_key_exists('ip', $mgr[0]), 'el manager, con ip');
    T::same(401, cu_call('GET', '/orders')->status, 'sin sesión: 401');
}

/** 7.7 · El detalle de un cliente: uno suyo en versión reducida; el de otro, el de un visitante o uno inexistente dan el MISMO 404; PUT y send → 403 «Solo lectura» sin mirar si existe. */
function test_cu_read_customer_detail_and_read_only()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'vip5');
    $bea = cu_customer('bea@acme.es', 'normal', '10.8.3.2');
    $mine = cu_order($ana)->body['number'];
    $theirs = cu_order($bea)->body['number'];
    $visitor = cu_order(null)->body['number'];
    $staff = cu_order($s['mgr'])->body['number'];
    $r = cu_call('GET', "/orders/$mine", null, $ana);
    T::same([200, true, ['number', 'at', 'customer', 'lines', 'total', 'unpriced', 'lang'], $mine, 363.04], [$r->status, $r->body['ok'], array_keys($r->body['order']), $r->body['order']['number'], $r->body['order']['total']], 'uno suyo: 200 reducido');
    T::same('private, no-store', $r->headers['Cache-Control'], 'sin caché');
    $missing = cu_call('GET', '/orders/TV-20990101-0001', null, $ana);
    T::same([404, false, 'No existe ese presupuesto'], [$missing->status, $missing->body['ok'], $missing->body['error']], 'uno que no existe: 404');
    foreach (['de otra persona' => $theirs, 'de un visitante' => $visitor, 'del personal' => $staff] as $why => $n) {
        $x = cu_call('GET', "/orders/$n", null, $ana);
        T::same([404, $missing->body], [$x->status, $x->body], "uno $why: el mismo 404 que si no existiera");
    }
    foreach (['/orders/..', '/orders/../x', '/orders/%2e%2e', '/orders/' . strtolower($mine), "/orders/{$mine}x"] as $weird) T::same(404, cu_call('GET', $weird, null, $ana)->status, "número raro $weird: 404");
    // solo lectura
    $before = cu_rec($mine);
    foreach ([$mine, $theirs, 'TV-20990101-0001'] as $n) {
        $put = cu_call('PUT', "/orders/$n", cu_edit_body(['quoteNote' => 'hackeado']), $ana);
        T::same([403, false, 'Solo lectura'], [$put->status, $put->body['ok'], $put->body['error']], "PUT $n: 403 Solo lectura");
        $send = cu_call('POST', "/orders/$n/send", ['to' => ['x@y.es'], 'pdf' => base64_encode("%PDF-1.4\n")], $ana);
        T::same([403, 'Solo lectura'], [$send->status, $send->body['error']], "send $n: 403 Solo lectura");
    }
    T::same($before, cu_rec($mine), 'no se tocó el presupuesto');
    T::same([], array_values(array_filter(outbox(), function ($m) { return strpos((string) ($m['subject'] ?? ''), 'Torivac · presupuesto') === 0; })), 'ni salió ningún reenvío');
    T::same(404, cu_call('PUT', '/orders/..', cu_edit_body(), $ana)->status, 'PUT con número raro: 404 (no 403)');
    T::same(404, cu_call('DELETE', "/orders/$mine", null, $ana)->status, 'DELETE: 404');
    T::same(404, cu_call('GET', "/orders/$mine/send", null, $ana)->status, 'GET /send: 404');
    T::same(401, cu_call('PUT', "/orders/$mine", cu_edit_body())->status, 'sin sesión: 401');
    // el propietario sigue viendo y editando todo
    $o = cu_call('GET', "/orders/$theirs", null, $s['own']);
    T::same([200, 'bea@acme.es', false], [$o->status, $o->body['order']['owner'], array_key_exists('ip', $o->body['order'])], 'el propietario ve el de Bea (sin ip)');
    T::same(200, cu_call('PUT', "/orders/$theirs", cu_edit_body(['quoteNote' => 'ok']), $s['own'])->status, 'y lo edita');
    T::same('ok', cu_call('GET', "/orders/$theirs", null, $bea)->body['order']['quoteNote'], 'Bea ve la nota del equipo en el suyo');
    // un cliente cuya cuenta se borra pierde la sesión
    Users::delete('ana@acme.es');
    T::same(401, cu_call('GET', "/orders/$mine", null, $ana)->status, 'cuenta borrada: 401');
}

/** 7.7 · quota.used cuenta solo las últimas 24 h; la lista se corta en los 100 más recientes; los pedidos antiguos sin owner no salen. */
function test_cu_read_customer_quota_and_cap_of_100()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'normal');
    $mk = function (string $num, string $at, ?string $owner) {
        Store::put('order:' . $num, ['number' => $num, 'at' => $at, 'customer' => ['name' => 'Ana', 'company' => '', 'email' => 'ana@acme.es', 'phone' => '', 'notes' => ''], 'lines' => [], 'total' => 0, 'unpriced' => 0, 'lang' => 'es', 'ip' => '1.1.1.1'] + ($owner !== null ? ['owner' => $owner] : []), 86400);
    };
    for ($i = 1; $i <= 105; $i++) $mk(sprintf('TV-20260101-%04d', $i), sprintf('2026-01-01T%02d:%02d:00.000Z', intdiv($i, 60) + 8, $i % 60), 'ana@acme.es');
    $mk('TV-20260101-0200', '2026-01-01T20:00:00.000Z', null);
    $mk('TV-20260101-0201', '2026-01-01T20:01:00.000Z', 'otra@acme.es');
    $r = cu_call('GET', '/orders', null, $ana);
    $nums = array_column($r->body['orders'], 'number');
    T::same([100, 'TV-20260101-0105', 'TV-20260101-0006', ['limit' => 3, 'used' => 0]], [count($nums), $nums[0], $nums[99], $r->body['quota']], 'los 100 más recientes, el último primero; los viejos no cuentan para la cuota');
    T::true(!in_array('TV-20260101-0200', $nums, true) && !in_array('TV-20260101-0201', $nums, true), 'ni los sin owner ni los de otra persona');
    $now = \Torivac\Util::nowMs();
    $b = goodOrder();
    Orders::handleOrder(req('POST', '/order', $b, [], '203.0.113.1'), $b, null, $now - 30 * 3600000, ['sub' => 'ana@acme.es', 'role' => 'customer', 'tier' => 'normal']);
    Orders::handleOrder(req('POST', '/order', $b, [], '203.0.113.2'), $b, null, $now - 3600000, ['sub' => 'ana@acme.es', 'role' => 'customer', 'tier' => 'normal']);
    T::same(['limit' => 3, 'used' => 1], cu_call('GET', '/orders', null, $ana)->body['quota'], 'used: el de hace 30 h ya no cuenta, el de hace 1 h sí');
    T::true(count(cu_call('GET', '/orders', null, $s['own'])->body['orders']) > 100, 'el propietario ve más de 100 (su tope es de 300)');
}

// ───────────────────────────────────────── 8 · PUT /orders/:n con tier

/** 7.8 · `tier` en PUT /orders/:n: las líneas sin precio explícito se valoran con esa categoría aunque no cambien de cantidad (y pierden `manual`); las de precio numérico quedan manual; priceTier pasa al valor; un presupuesto «A consultar» queda valorado. */
function test_cu_put_tier_reprices_lines_without_explicit_price()
{
    $s = cu_setup();
    $n = cu_order(null)->body['number'];                                                       // visitante con anon = consult: todo «A consultar»
    T::same(['consult', 0, 2], [cu_rec($n)['priceTier'], cu_rec($n)['total'], cu_rec($n)['unpriced']], 'parte de un presupuesto «A consultar»');
    $sin = cu_call('PUT', "/orders/$n", cu_edit_body(), $s['mgr']);
    T::same([200, 0, 2, 'consult'], [$sin->status, $sin->body['order']['total'], $sin->body['order']['unpriced'], $sin->body['order']['priceTier']], 'sin tier, todo como hasta ahora: sigue «A consultar» y priceTier no cambia');
    $r = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => 'vip5'], 1), $s['own']);
    $o = $r->body['order'];
    T::same([200, 363.04, 0, 'vip5', 2], [$r->status, $o['total'], $o['unpriced'], $o['priceTier'], $o['rev']], 'con tier vip5: valorado aunque las cantidades no cambiaron');
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 12.495, 'total' => 149.94], ['ref' => 'P16633', 'qty' => 3, 'unit' => 71.0325, 'total' => 213.1]], $o['lines'], 'líneas con los precios VIP +5, sin manual');
    T::same('2026-10-27T00:00:00.000Z', $o['prices']['updated_at'], 'prices pasa a ser la tarifa de ahora');
    // cambiar de categoría reprecia otra vez, aunque nada más cambie
    $o = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => 'vip'], 2), $s['mgr'])->body['order'];
    T::same([345.75, 'vip', 11.9], [$o['total'], $o['priceTier'], $o['lines'][0]['unit']], 'tier vip: VIP');
    $o = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => 'normal'], 3), $s['mgr'])->body['order'];
    T::same([397.61, 'normal'], [$o['total'], $o['priceTier']], 'tier normal');
    // un precio explícito queda manual; el resto se valora con la categoría
    $o = cu_call('PUT', "/orders/$n", ['tier' => 'vip10', 'rev' => 4, 'lines' => [['ref' => 'TT0020210', 'qty' => 12, 'price' => 10], ['ref' => 'P16633', 'qty' => 3]]], $s['mgr'])->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 10.0, 'total' => 120.0, 'manual' => true], ['ref' => 'P16633', 'qty' => 3, 'unit' => 74.415, 'total' => 223.25]], $o['lines'], 'price numérico: manual con su precio; la otra con VIP +10');
    T::same([343.25, 'vip10'], [$o['total'], $o['priceTier']], 'total y priceTier');
    // una línea que era manual y no trae price vuelve a la categoría (manual desaparece); price:null también
    $o = cu_call('PUT', "/orders/$n", ['tier' => 'vip5', 'rev' => 5, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3, 'price' => null]]], $s['mgr'])->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 12.495, 'total' => 149.94], ['ref' => 'P16633', 'qty' => 3, 'unit' => 71.0325, 'total' => 213.1]], $o['lines'], 'sin price (era manual) y price:null: categoría, sin manual');
    // sin tier no se revalora lo que no cambia, y priceTier se conserva
    cu_call('PUT', "/orders/$n", ['rev' => 6, 'lines' => [['ref' => 'TT0020210', 'qty' => 12, 'price' => 9.5], ['ref' => 'P16633', 'qty' => 3]]], $s['mgr']);
    $o = cu_call('PUT', "/orders/$n", ['rev' => 7, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3]]], $s['mgr'])->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 9.5, 'total' => 114.0, 'manual' => true], 71.0325, 'vip5'], [$o['lines'][0], $o['lines'][1]['unit'], $o['priceTier']], 'sin tier: lo guardado se conserva (manual incluido) y priceTier también');
    // una ref sin precio sigue «A consultar» con tier
    $o = cu_call('PUT', "/orders/$n", ['tier' => 'normal', 'rev' => 8, 'lines' => [['ref' => 'TT0020210', 'qty' => 1], ['ref' => 'R100', 'qty' => 2]]], $s['mgr'])->body['order'];
    T::same([14.2255, null, 14.23, 1], [$o['lines'][0]['unit'], $o['lines'][1]['unit'], $o['total'], $o['unpriced']], 'una referencia sin precio sigue «A consultar» en todas las categorías');
}

/** 7.8 · `tier` no válido → 400 «Categoría no válida» (field tier) sin cambiar nada; null o vacío = no viene; un cliente no puede (403 Solo lectura); conserva owner. */
function test_cu_put_tier_validation_roles_and_owner()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'vip5');
    $n = cu_order($ana)->body['number'];
    $before = cu_rec($n);
    foreach (['oro', 'VIP', 5, ['vip'], true, 'vip+5'] as $bad) {
        $r = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => $bad]), $s['mgr']);
        T::same([400, false, 'Categoría no válida', 'tier'], [$r->status, $r->body['ok'], $r->body['error'], $r->body['field'] ?? null], 'tier ' . json_encode($bad) . ' → 400');
    }
    T::same($before, cu_rec($n), 'nada cambió');
    foreach ([null, ''] as $none) {
        $r = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => $none], (int) (cu_rec($n)['rev'] ?? 0)), $s['mgr']);
        T::same([200, 'vip5', 363.04], [$r->status, $r->body['order']['priceTier'], $r->body['order']['total']], 'tier ' . json_encode($none) . ' = no viene: se conserva la categoría');
    }
    $x = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => 'vip']), $ana);
    T::same([403, 'Solo lectura'], [$x->status, $x->body['error']], 'un cliente no puede valorar (403)');
    $o = cu_call('PUT', "/orders/$n", cu_edit_body(['tier' => 'normal'], (int) cu_rec($n)['rev']), $s['own'])->body['order'];
    T::same(['ana@acme.es', 'normal'], [cu_rec($n)['owner'], cu_rec($n)['priceTier']], 'el propietario valora y el registro conserva el owner');
    T::same('ana@acme.es', cu_call('GET', '/orders', null, $ana)->body['orders'][0]['customer']['email'], 'y la clienta sigue viéndolo');
    T::same(397.61, cu_call('GET', "/orders/$n", null, $ana)->body['order']['total'], 'ya valorado a Normal');
}

/** 7.8 · Sin `tier` en el cuerpo, las líneas NUEVAS o con la cantidad cambiada se valoran con la categoría guardada en el registro (priceTier); «consult» las deja sin precio; un pedido antiguo sin priceTier, VIP; las que no cambian se conservan. */
function test_cu_put_without_tier_values_changed_lines_with_the_records_price_tier()
{
    $s = cu_setup();
    $ana = cu_customer('ana@acme.es', 'vip10');
    $n = cu_order($ana, goodOrder(['lines' => [['ref' => 'TT0020210', 'qty' => 2], ['ref' => 'P16633', 'qty' => 3]]]))->body['number'];
    T::same(['vip10', 13.607, 74.415], [cu_rec($n)['priceTier'], cu_rec($n)['lines'][0]['unit'], cu_rec($n)['lines'][1]['unit']], 'parte de un pedido VIP +10');
    $o = cu_call('PUT', "/orders/$n", cu_edit_body(['lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3]]]), $s['mgr'])->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 13.09, 'total' => 157.08], ['ref' => 'P16633', 'qty' => 3, 'unit' => 74.415, 'total' => 223.25]], $o['lines'], 'la línea con otra cantidad (12) usa el tramo VIP +10 y no el VIP; la que no cambia se conserva');
    T::same([380.33, 'vip10', 2], [$o['total'], $o['priceTier'], count($o['lines'])], 'total, priceTier intacto');
    // línea nueva y price:null: también con la categoría del registro; una referencia sin precio sigue «A consultar»
    $o = cu_call('PUT', "/orders/$n", ['rev' => 1, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 3, 'price' => null], ['ref' => 'R100', 'qty' => 1]]], $s['own'])->body['order'];
    T::same([13.09, 74.415, null, 1], [$o['lines'][0]['unit'], $o['lines'][1]['unit'], $o['lines'][2]['unit'], $o['unpriced']], 'price:null y las nuevas: VIP +10; la sin precio, null');
    // si cambia la tarifa de hoy, lo que no cambia NO se revalora, pero lo que cambia usa la de hoy con la categoría
    pr_seed_today_for_cu();
    $o = cu_call('PUT', "/orders/$n", ['rev' => 2, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 4]]], $s['mgr'])->body['order'];
    T::same([13.09, 110.0], [$o['lines'][0]['unit'], $o['lines'][1]['unit']], 'la línea que no cambia conserva su precio de antes; la de cantidad nueva usa la tarifa de hoy × 1,10 (100 → 110)');
    // un pedido «A consultar»: las líneas cambiadas o nuevas siguen sin precio
    $v = cu_order(null)->body['number'];
    $o = cu_call('PUT', "/orders/$v", cu_edit_body(['lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 1], ['ref' => 'R100', 'qty' => 2]]]), $s['mgr'])->body['order'];
    T::same([[null, null], [null, null], [null, null], 3, 0, 'consult'], [[$o['lines'][0]['unit'], $o['lines'][0]['total']], [$o['lines'][1]['unit'], $o['lines'][1]['total']], [$o['lines'][2]['unit'], $o['lines'][2]['total']], $o['unpriced'], $o['total'], $o['priceTier']], 'registro consult: con otra cantidad o nuevas, sin precio (unit y total null)');
    $o = cu_call('PUT', "/orders/$v", ['rev' => 1, 'lines' => [['ref' => 'TT0020210', 'qty' => 12, 'price' => 10], ['ref' => 'P16633', 'qty' => 1]]], $s['mgr'])->body['order'];
    T::same([['ref' => 'TT0020210', 'qty' => 12, 'unit' => 10.0, 'total' => 120.0, 'manual' => true], null], [$o['lines'][0], $o['lines'][1]['unit']], 'el precio manual de una línea sí vale en un registro consult');
    // un pedido antiguo sin priceTier: VIP, como hasta ahora
    $old = cu_order($s['mgr'], goodOrder(['lines' => [['ref' => 'TT0020210', 'qty' => 2]]]))->body['number'];
    $r = cu_rec($old); unset($r['priceTier'], $r['owner']); Store::put('order:' . $old, $r, 86400);
    $o = cu_call('PUT', "/orders/$old", cu_edit_body(['lines' => [['ref' => 'TT0020210', 'qty' => 12]]]), $s['mgr'])->body['order'];
    T::same([11.9, false], [$o['lines'][0]['unit'], array_key_exists('priceTier', $o)], 'sin priceTier en el registro: VIP y no se inventa la clave');
    // un registro con un priceTier raro se trata como antiguo (VIP)
    $r = cu_rec($old); $r['priceTier'] = 'oro'; Store::put('order:' . $old, $r, 86400);
    $o = cu_call('PUT', "/orders/$old", ['rev' => 1, 'lines' => [['ref' => 'TT0020210', 'qty' => 50]]], $s['mgr'])->body['order'];
    T::same([11.4, 'oro'], [$o['lines'][0]['unit'], $o['priceTier']], 'priceTier desconocido: VIP (y se deja como está)');
    // con tier en el cuerpo todo sigue igual: se revalora todo
    $o = cu_call('PUT', "/orders/$n", ['tier' => 'normal', 'rev' => 3, 'lines' => [['ref' => 'TT0020210', 'qty' => 12], ['ref' => 'P16633', 'qty' => 4]]], $s['mgr'])->body['order'];
    T::same([13.685, 115.0, 'normal'], [$o['lines'][0]['unit'], $o['lines'][1]['unit'], $o['priceTier']], 'con tier en el cuerpo se revalora todo con esa categoría');
}

/** Cambia la tarifa de hoy (P16633 pasa a 100 €) sin tocar lo guardado en los presupuestos. */
function pr_seed_today_for_cu(): void
{
    Store::put(Prices::KEY_CURRENT, Prices::forJson(['updated_at' => '2026-11-05T00:00:00.000Z', 'source' => 'test', 'currency' => 'EUR', 'mode' => 'live', 'items' => ['TT0020210' => ['p' => 12.37, 't' => [[10, 11.9], [50, 11.4]]], 'P16633' => ['p' => 100.0]]]));
}
