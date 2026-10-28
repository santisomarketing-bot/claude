<?php
/**
 * Pruebas de la seguridad de acceso de la sesión «Seguridad 3»: verificación en dos pasos por correo (código, dispositivo recordado, cuentas de confianza), respuesta a ataques repetidos, desbloqueo de
 * cuentas, cambio de contraseña, registro de actividad y copias de seguridad (crear, descargar con enlace firmado, restaurar). El correo es el controlador «file»: el código se lee de la carpeta outbox.
 */
namespace Torivac\Tests;

use Torivac\Audit;
use Torivac\Backup;
use Torivac\Blog;
use Torivac\Config;
use Torivac\Diag;
use Torivac\Http;
use Torivac\Mail;
use Torivac\RateLimit;
use Torivac\Router;
use Torivac\Security;
use Torivac\Store;
use Torivac\Users;
use Torivac\Util;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Prepara el almacén con el código por correo ACTIVADO (la configuración normal) y un manager (jefa) y un cliente (ana). `$extra` cambia ajustes de two_step. */
function ss_setup(array $extra = []): void
{
    fresh(['two_step' => $extra + ['enabled' => true]]);
    Users::create(['email' => 'jefa@torivac.com', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'ana@acme.es', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
}

/** Vacía el outbox (los correos que ha «enviado» el controlador file). */
function ss_clear_outbox(): void { foreach (glob(Store::root() . '/outbox/*.json') ?: [] as $f) @unlink($f); }

/** El código de 6 cifras del último correo de seguridad enviado a `$to` (null si no hay). Se vacía el outbox antes de cada acción para que no haya dudas. */
function ss_code(string $to): ?string
{
    foreach (array_reverse(outbox()) as $m) {
        if (in_array($to, (array) ($m['to'] ?? []), true) && preg_match('/\b(\d{3}) (\d{3})\b/', (string) ($m['text'] ?? ''), $x)) return $x[1] . $x[2];
    }
    return null;
}

/** POST /auth/login. */
function ss_login(string $email, string $pw, string $ip = '10.0.0.1', array $headers = [])
{
    return Router::handle(req('POST', '/auth/login', ['email' => $email, 'password' => $pw], $headers, $ip));
}

/** POST /auth/verify. */
function ss_verify(string $challenge, string $code, bool $remember = false, string $ip = '10.0.0.1', array $headers = [])
{
    return Router::handle(req('POST', '/auth/verify', ['challenge' => $challenge, 'code' => $code, 'remember' => $remember], $headers, $ip));
}

/** Entra como manager con su código (sin recordar el dispositivo) y devuelve el token. */
function ss_manager_token(string $ip = '10.0.0.1'): string
{
    ss_clear_outbox();
    $r = ss_login('jefa@torivac.com', PW_JEFE, $ip);
    $v = ss_verify($r->body['challenge'], (string) ss_code('jefa@torivac.com'), false, $ip);
    return (string) ($v->body['token'] ?? '');
}

/** Llamada autenticada con un token. */
function ss_call(string $method, string $path, $body, string $token, string $ip = '10.0.0.1')
{
    return Router::handle(req($method, $path, $body, bearer($token), $ip));
}

/** Pone a cero el tope de códigos por hora de una cuenta (una prueba que pide muchos no debe chocar con él salvo que lo pruebe). */
function ss_reset_sends(string $email = 'jefa@torivac.com'): void { RateLimit::clear('pinsend', $email); }

/** La configuración normal de las pruebas con estos cambios encima (a diferencia de `Config::all() + [...]`, aquí gana lo nuevo). */
function ss_config(array $over): void
{
    Config::set(array_merge(['storage_dir' => Store::root(), 'session_secret' => SECRET, 'admin_token' => MASTER_TOKEN, 'order_to' => ['info@grupotorivac.com', 'mzamora@torivac.com'],
        'order_from' => 'Torivac Web <pedidos@grupotorivac.com>', 'mail' => ['driver' => 'file'], 'form_min_fill_ms' => 0, 'two_step' => ['enabled' => true]], $over));
}

/** El valor de la cookie de dispositivo que fijó una respuesta (null si no la hay). */
function ss_cookie($resp): ?string
{
    $h = (string) ($resp->headers['Set-Cookie'] ?? '');
    return preg_match('/^(tv_dev_[0-9a-f]{10}=[0-9a-f.]+);/', $h, $m) ? $m[1] : null;
}

/** SS1 · Un manager con la contraseña buena recibe un código por correo y solo con él obtiene la sesión; el código no va en el asunto ni en claro en el almacén. */
function test_step_manager_must_give_the_email_code()
{
    ss_setup();
    ss_clear_outbox();
    $r = ss_login('jefa@torivac.com', PW_JEFE);
    T::same([200, true, 'code'], [$r->status, $r->body['ok'], $r->body['step'] ?? null], 'con la contraseña buena pide el código');
    T::true(!isset($r->body['token']) && !isset($r->body['user']), 'y todavía no hay sesión');
    T::true(preg_match('/^[0-9a-f]{32}$/', $r->body['challenge']) === 1 && strpos($r->body['hint'], 'j') === 0 && substr($r->body['hint'], -12) === '@torivac.com' && strpos($r->body['hint'], 'efa') === false, 'el aviso oculta el correo: ' . $r->body['hint']);
    T::same([600, 45, 30], [$r->body['ttl'], $r->body['resend_after'], $r->body['remember_days']], 'validez, espera de reenvío y días de recuerdo');
    $mail = outbox();
    T::same(1, count($mail), 'sale un solo correo');
    T::same(['jefa@torivac.com'], $mail[0]['to'], 'a la dirección de la cuenta');
    $code = ss_code('jefa@torivac.com');
    T::true($code !== null && strlen($code) === 6 && strpos($mail[0]['subject'], $code) === false, 'el código no va en el asunto');
    $raw = json_encode(Store::get('pin:' . $r->body['challenge']));
    T::true(strpos($raw, $code) === false && strpos($raw, substr($code, 0, 3) . ' ') === false, 'el código no se guarda en claro (solo su hash)');
    $bad = ss_verify($r->body['challenge'], $code === '000000' ? '111111' : '000000');
    T::same([401, 4, 'wrong'], [$bad->status, $bad->body['left'] ?? null, $bad->body['code'] ?? null], 'un código incorrecto dice cuántos intentos quedan');
    $ok = ss_verify($r->body['challenge'], substr($code, 0, 3) . ' ' . substr($code, 3));
    T::same([200, 'jefa@torivac.com', 'manager'], [$ok->status, $ok->body['user']['email'] ?? null, $ok->body['user']['role'] ?? null], 'con el código (aunque se escriba con espacio) entra');
    T::same(200, ss_call('GET', '/auth/me', null, $ok->body['token'])->status, 'el token sirve');
    T::same(410, ss_verify($r->body['challenge'], $code)->status, 'un código solo vale una vez');
    T::same(1, count(array_filter(Audit::read(1, 50)['items'], function ($e) { return $e['a'] === 'login.pin_ok'; })), 'queda anotado en la actividad');
}

/** SS2 · Los clientes no piden código (solo si hay ataques repetidos); sin correo capaz de enviar, nadie lo pide (no se queda nadie fuera). */
function test_step_clients_and_missing_mail_do_not_need_a_code()
{
    ss_setup();
    $r = ss_login('ana@acme.es', PW_ANA);
    T::same([200, true], [$r->status, isset($r->body['token'])], 'un cliente entra con la contraseña');
    ss_config(['mail' => ['driver' => 'none']]);
    $m = ss_login('jefa@torivac.com', PW_JEFE);
    T::same([200, true], [$m->status, isset($m->body['token'])], 'sin correo configurado el manager entra solo con la contraseña');
    T::same('warn', array_values(array_filter(Diag::security(), function ($c) { return $c['id'] === 'codigo_correo'; }))[0]['status'], 'y el Diagnóstico avisa de que el código está inactivo');
}

/** SS3 · Cinco códigos erróneos anulan ese código (y bloquean la pareja visitante+cuenta una hora); hay que volver a entrar con la contraseña. */
function test_step_five_wrong_codes_kill_the_challenge()
{
    ss_setup();
    ss_clear_outbox();
    $id = ss_login('jefa@torivac.com', PW_JEFE)->body['challenge'];
    $code = (string) ss_code('jefa@torivac.com');
    $wrong = $code === '123456' ? '654321' : '123456';
    $left = [];
    for ($i = 0; $i < 5; $i++) { $r = ss_verify($id, $wrong); $left[] = $r->body['left'] ?? null; }
    T::same([4, 3, 2, 1, 0], $left, 'quedan 4, 3, 2, 1 y 0 intentos');
    T::same('exhausted', $r->body['code'], 'al quinto se anula');
    T::same(410, ss_verify($id, $code)->status, 'el código anulado ya no existe, ni siquiera el bueno');
    T::true(Security::lockLeft('jefa@torivac.com') > 3000000, 'la pareja visitante+cuenta queda bloqueada casi una hora');
    ss_clear_outbox();
    $again = ss_login('jefa@torivac.com', PW_JEFE);
    T::same([429, 0], [$again->status, count(outbox())], 'con la contraseña buena no se manda otro código mientras dure el bloqueo');
    $other = ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.77');
    T::same('code', $other->body['step'] ?? null, 'otro visitante sí puede pedir el suyo (el bloqueo es de esa pareja)');
    T::same(410, ss_verify(str_repeat('a', 32), '123456', false, '10.9.9.9')->status, 'un identificador que no existe: caducado');
    T::same(410, ss_verify('no-valido', '123456', false, '10.9.9.9')->status, 'uno mal formado también');
}

/** SS4 · Reenviar el código: espera entre envíos, como mucho 3 envíos por intento, y el código anterior deja de valer. */
function test_step_resend_rules()
{
    ss_setup();
    ss_clear_outbox();
    $id = ss_login('jefa@torivac.com', PW_JEFE)->body['challenge'];
    $first = (string) ss_code('jefa@torivac.com');
    $r = Router::handle(req('POST', '/auth/resend', ['challenge' => $id]));
    T::same([429, 'wait'], [$r->status, $r->body['code'] ?? null], 'hay que esperar entre un envío y otro');
    $age = function () use ($id) { $p = Store::get('pin:' . $id); $p['last'] -= 60000; Store::put('pin:' . $id, $p, 600); };
    $age();
    ss_clear_outbox();
    $r = Router::handle(req('POST', '/auth/resend', ['challenge' => $id]));
    T::same(200, $r->status, 'pasada la espera, se reenvía');
    $second = (string) ss_code('jefa@torivac.com');
    T::true($second !== '' && $second !== $first, 'con un código nuevo');
    T::same(401, ss_verify($id, $first)->status, 'el anterior ya no vale');
    $age();
    T::same(200, Router::handle(req('POST', '/auth/resend', ['challenge' => $id]))->status, 'segundo reenvío');
    $age();
    $r = Router::handle(req('POST', '/auth/resend', ['challenge' => $id]));
    T::same([429, 'no_more'], [$r->status, $r->body['code'] ?? null], 'un tercero no: como mucho 3 envíos');
    T::same(410, Router::handle(req('POST', '/auth/resend', ['challenge' => 'x']))->status, 'sin identificador válido: caducado');
}

/** SS5 · Dispositivo recordado: cookie firmada, HttpOnly, de 30 días y solo de esa cuenta; deja de valer al olvidarla, al cambiar la contraseña o al borrar y recrear la cuenta. */
function test_step_remembered_device()
{
    ss_setup();
    ss_clear_outbox();
    $r = ss_login('jefa@torivac.com', PW_JEFE);
    $v = ss_verify($r->body['challenge'], (string) ss_code('jefa@torivac.com'), true);
    $cookie = ss_cookie($v);
    T::true($cookie !== null, 'con «recordar» sale una cookie de dispositivo');
    $h = $v->headers['Set-Cookie'];
    T::true(strpos($h, 'HttpOnly') !== false && strpos($h, 'SameSite=Strict') !== false && strpos($h, 'Max-Age=2592000') !== false && strpos($h, 'Path=/api') !== false && strpos($h, 'Secure') === false, 'HttpOnly, SameSite, 30 días, solo para el API y sin Secure por HTTP: ' . $h);
    ss_clear_outbox();
    $https2 = ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.6');
    $rq = req('POST', '/auth/verify', ['challenge' => $https2->body['challenge'], 'code' => (string) ss_code('jefa@torivac.com'), 'remember' => true], [], '10.0.0.6');
    $rq->https = true;
    T::true(strpos(Router::handle($rq)->headers['Set-Cookie'] ?? '', '; Secure') !== false, 'por HTTPS la cookie lleva Secure');
    ss_clear_outbox();
    $d = ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.7', ['Cookie' => $cookie]);
    T::same([200, true, 0], [$d->status, isset($d->body['token']), count(outbox())], 'con la cookie entra sin código y sin enviar correo');
    T::true(count(array_filter(Audit::read(1, 80)['items'], function ($e) { return $e['a'] === 'login.device'; })) >= 2, 'se anota el dispositivo recordado (al darlo de alta y al usarlo)');
    ss_reset_sends();
    $other = ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.8', ['Cookie' => preg_replace('/\.[0-9a-f]{64}$/', '.' . str_repeat('0', 64), $cookie)]);
    T::same('code', $other->body['step'] ?? null, 'una cookie con la firma cambiada no vale');
    $ana = ss_login('ana@acme.es', PW_ANA, '10.0.0.9', ['Cookie' => $cookie]);
    T::true(isset($ana->body['token']), 'una cookie de otra cuenta no abre esta (y los clientes no la necesitan)');
    $u = Users::find('jefa@torivac.com');
    $old = Security::issueDevice($u, time() - 40 * 86400);
    ss_reset_sends();
    T::same('code', ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.10', ['Cookie' => $old['name'] . '=' . $old['value']])->body['step'] ?? null, 'una cookie caducada no vale');
    ss_reset_sends();
    // olvidar los dispositivos
    $tok = $d->body['token'];
    T::same(200, ss_call('POST', '/auth/devices/forget', [], $tok)->status, 'olvidar mis dispositivos');
    T::same('code', ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.11', ['Cookie' => $cookie])->body['step'] ?? null, 'después, la cookie vieja no vale');
    // cambiar la contraseña también los invalida; borrar y recrear la cuenta, también
    ss_reset_sends();
    ss_clear_outbox();
    $r = ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.12');
    $cookie2 = ss_cookie(ss_verify($r->body['challenge'], (string) ss_code('jefa@torivac.com'), true, '10.0.0.12'));
    T::true($cookie2 !== null && isset(ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.13', ['Cookie' => $cookie2])->body['token']), 'una cookie nueva vale');
    Users::setPassword('jefa@torivac.com', 'Otra-Clave-Directiva-2027!');
    ss_reset_sends();
    T::same('code', ss_login('jefa@torivac.com', 'Otra-Clave-Directiva-2027!', '10.0.0.14', ['Cookie' => $cookie2])->body['step'] ?? null, 'cambiar la contraseña olvida los dispositivos');
    ss_reset_sends();
    ss_clear_outbox();
    $c3 = ss_cookie(ss_verify(ss_login('jefa@torivac.com', 'Otra-Clave-Directiva-2027!', '10.0.0.15')->body['challenge'], (string) ss_code('jefa@torivac.com'), true, '10.0.0.15'));
    Users::delete('jefa@torivac.com');
    Users::create(['email' => 'jefa@torivac.com', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    ss_reset_sends();
    T::same('code', ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.16', ['Cookie' => $c3])->body['step'] ?? null, 'borrar y volver a crear la cuenta no resucita sus dispositivos');
}

/** SS6 · Cuentas de confianza (casilla, lista en config.php) y interruptores: nadie se queda fuera. Si el correo falla justo al pedir el código, se dice y no queda nada pendiente. */
function test_step_exemptions_and_switches()
{
    ss_setup();
    $set = function ($flag) { return Router::handle(req('POST', '/users/jefa%40torivac.com/two-step', ['enabled' => $flag], master())); };
    $r = $set(false);
    T::same([200, 'exempt'], [$r->status, $r->body['code'] ?? null], 'la casilla «sin código» deja la cuenta de confianza');
    T::true(isset(ss_login('jefa@torivac.com', PW_JEFE)->body['token']), 'y entra solo con la contraseña');
    T::same('exempt', array_values(array_filter(Router::handle(req('GET', '/users', null, master()))->body['users'], function ($u) { return $u['email'] === 'jefa@torivac.com'; }))[0]['code'], 'la lista de usuarios lo dice');
    T::same('required', $set(true)->body['code'], 'volver a pedir el código');
    T::same('code', ss_login('jefa@torivac.com', PW_JEFE, '10.0.0.2')->body['step'] ?? null, 'otra vez pide código');
    ss_setup(['exempt' => ['JEFA@torivac.com ']]);
    T::true(isset(ss_login('jefa@torivac.com', PW_JEFE)->body['token']), 'la lista two_step.exempt de config.php también (sin importar mayúsculas)');
    ss_setup(['enabled' => false]);
    T::true(isset(ss_login('jefa@torivac.com', PW_JEFE)->body['token']), 'two_step.enabled = false: nadie pide código');
    // interruptor por variable de entorno (llega como texto)
    ss_setup();
    putenv('TORIVAC_TWO_STEP_ENABLED=false');
    T::true(isset(ss_login('jefa@torivac.com', PW_JEFE)->body['token']), 'TORIVAC_TWO_STEP_ENABLED=false (texto) también lo apaga');
    putenv('TORIVAC_TWO_STEP_ENABLED');
    // el correo falla: se dice, no se abre sesión y no queda un código pendiente
    ss_setup();
    ss_config(['mail' => ['driver' => 'resend', 'resend_api_key' => 're_pruebas_123456']]);
    Http::$mock = function () { return [403, '{"message":"dominio sin verificar"}']; };
    $f = ss_login('jefa@torivac.com', PW_JEFE);
    T::same([503, 'pin_mail_failed', false], [$f->status, $f->body['code'] ?? null, isset($f->body['token'])], 'si el correo falla, se dice y no se abre sesión');
    T::same([], kv_files('pin%3A'), 'y no queda ningún código pendiente');
    Http::$mock = null;
}

/** SS7 · La casilla de código por correo, el desbloqueo y la contraseña de otra cuenta son cosas de managers. */
function test_step_user_actions_are_for_managers()
{
    ss_setup(['enabled' => false]);
    $ana = (string) login_token('ana@acme.es', PW_ANA);
    foreach (['two-step' => ['enabled' => false], 'unlock' => [], 'password' => ['password' => 'Nueva-Clave-Cliente-2027!']] as $what => $body) {
        T::same(403, ss_call('POST', '/users/jefa%40torivac.com/' . $what, $body, $ana)->status, "un cliente no puede: $what");
        T::same(401, Router::handle(req('POST', '/users/jefa%40torivac.com/' . $what, $body))->status, "sin sesión tampoco: $what");
        T::same(404, Router::handle(req('POST', '/users/nadie%40x.es/' . $what, $body, master()))->status, "una cuenta que no existe: $what");
    }
    T::same(400, Router::handle(req('POST', '/users/jefa%40torivac.com/two-step', ['enabled' => 'no'], master()))->status, 'enabled tiene que ser true o false');
    T::same(400, Router::handle(req('POST', '/users/ana%40acme.es/password', ['password' => 'corta'], master()))->status, 'una contraseña débil se rechaza');
    $r = Router::handle(req('POST', '/users/ana%40acme.es/password', ['password' => 'Nueva-Clave-Cliente-2027!'], master()));
    T::same(200, $r->status, 'un manager (aquí el token maestro) pone una contraseña nueva');
    T::same(401, ss_call('GET', '/auth/me', null, $ana)->status, 'la sesión vieja de Ana se cierra');
    T::same([null, true], [login_token('ana@acme.es', PW_ANA, '10.0.0.7'), login_token('ana@acme.es', 'Nueva-Clave-Cliente-2027!', '10.0.0.7') !== null], 'la contraseña vieja ya no entra y la nueva sí');
}

/** SS8 · Cambiar la contraseña propia: pide la actual (5 fallos por hora), cierra todas las sesiones y exige entrar de nuevo. */
function test_step_change_own_password()
{
    ss_setup(['enabled' => false]);
    $t = (string) login_token('ana@acme.es', PW_ANA);
    $t2 = (string) login_token('ana@acme.es', PW_ANA, '10.0.0.3');
    T::same(400, ss_call('POST', '/auth/password', ['current' => 'no-es-esta', 'password' => 'Nueva-Clave-Cliente-2027!'], $t)->status, 'con la actual mal: 400');
    T::same(400, ss_call('POST', '/auth/password', ['current' => PW_ANA, 'password' => 'corta'], $t)->status, 'con una nueva débil: 400');
    T::same(400, Router::handle(req('POST', '/auth/password', ['current' => 'x', 'password' => 'y'], master()))->status, 'el token maestro no tiene contraseña');
    $r = ss_call('POST', '/auth/password', ['current' => PW_ANA, 'password' => 'Nueva-Clave-Cliente-2027!'], $t);
    T::same([200, true], [$r->status, $r->body['relogin'] ?? null], 'con la actual bien se cambia y se pide entrar de nuevo');
    T::same([401, 401], [ss_call('GET', '/auth/me', null, $t)->status, ss_call('GET', '/auth/me', null, $t2)->status], 'todas sus sesiones se cierran');
    T::same([null, true], [login_token('ana@acme.es', PW_ANA, '10.0.0.4'), login_token('ana@acme.es', 'Nueva-Clave-Cliente-2027!', '10.0.0.4') !== null], 'entra con la nueva');
    $t3 = (string) login_token('ana@acme.es', 'Nueva-Clave-Cliente-2027!', '10.0.0.5');
    $st = [];
    for ($i = 0; $i < 6; $i++) $st[] = ss_call('POST', '/auth/password', ['current' => 'mala-' . $i, 'password' => 'Otra-Clave-Cliente-2028!!'], $t3)->status;
    T::same([400, 400, 400, 400, 400, 429], $st, 'a los 5 fallos se bloquea probar la contraseña actual');
    T::same(429, ss_call('POST', '/auth/password', ['current' => 'Nueva-Clave-Cliente-2027!', 'password' => 'Otra-Clave-Cliente-2028!!'], $t3)->status, 'ni la buena entra mientras dure');
}

/** SS9 · Ataques repetidos: tres bloqueos en 24 h → UN aviso por correo y código en dispositivos nuevos 7 días; sin avisos de rutina; una cuenta de confianza solo recibe el aviso. */
function test_step_repeated_attacks_alert_once_and_require_a_code()
{
    ss_setup(['enabled' => false]);                                                            // sin código de rutina: solo el reforzado por ataques
    $lock = function (string $email, string $ip) { for ($i = 0; $i < 5; $i++) ss_login($email, 'mala-contraseña-' . $i, $ip); };
    ss_clear_outbox();
    $lock('ana@acme.es', '10.1.0.1');
    $lock('ana@acme.es', '10.1.0.2');
    T::same([0, false], [count(outbox()), isset(Users::find('ana@acme.es')['atk_until'])], 'dos bloqueos no avisan ni refuerzan nada (sin avisos de rutina)');
    T::true(isset(ss_login('ana@acme.es', PW_ANA, '10.1.0.9')->body['token']), 'y Ana sigue entrando solo con la contraseña');
    $lock('ana@acme.es', '10.1.0.3');
    $mails = outbox();
    T::same(1, count($mails), 'al tercero sale UN aviso');
    T::same(['info@grupotorivac.com', 'mzamora@torivac.com'], $mails[0]['to'], 'a los destinatarios de los pedidos (alert_to vacío)');
    T::true(strpos($mails[0]['text'], 'ana@acme.es') !== false && strpos($mails[0]['text'], PW_ANA) === false && strpos($mails[0]['text'], '3 bloqueos') !== false, 'dice qué cuenta y cuántos bloqueos, sin contraseñas');
    T::true(Users::find('ana@acme.es')['atk_until'] > Util::nowMs() + 6 * 86400000, 'la cuenta queda reforzada unos 7 días');
    $lock('ana@acme.es', '10.1.0.4');
    $lock('ana@acme.es', '10.1.0.5');
    T::same(1, count(outbox()), 'más bloqueos el mismo día no repiten el aviso');
    // reforzada: entrar desde un dispositivo nuevo pide código; con la cookie del dispositivo ya conocido, no
    ss_clear_outbox();
    $r = ss_login('ana@acme.es', PW_ANA, '10.1.0.20');
    T::same('code', $r->body['step'] ?? null, 'ahora Ana pide código en un dispositivo nuevo');
    T::same(['ana@acme.es'], outbox()[0]['to'], 'al correo de la cuenta');
    T::true(strpos(outbox()[0]['text'], 'intentos repetidos') !== false, 'y se lo explica');
    $ok = ss_verify($r->body['challenge'], (string) ss_code('ana@acme.es'), true, '10.1.0.20');
    T::same(200, $ok->status, 'con el código entra');
    $cookie = ss_cookie($ok);
    T::true(isset(ss_login('ana@acme.es', PW_ANA, '10.1.0.21', ['Cookie' => $cookie])->body['token']), 'el dispositivo recordado entra sin código');
    // una cuenta de confianza solo recibe el aviso
    ss_setup(['enabled' => false]);
    Router::handle(req('POST', '/users/ana%40acme.es/two-step', ['enabled' => false], master()));
    ss_clear_outbox();
    foreach (['10.2.0.1', '10.2.0.2', '10.2.0.3'] as $ip) $lock('ana@acme.es', $ip);
    T::same(1, count(outbox()), 'la cuenta de confianza recibe el aviso');
    T::true(isset(ss_login('ana@acme.es', PW_ANA, '10.2.0.30')->body['token']), 'pero no se le pide código');
    // lo que no existe no genera avisos ni estado
    ss_setup(['enabled' => false]);
    ss_clear_outbox();
    foreach (['10.3.0.1', '10.3.0.2', '10.3.0.3', '10.3.0.4'] as $ip) $lock('fantasma@x.es', $ip);
    T::same([0, []], [count(outbox()), kv_files('rl%3Aatk')], 'una cuenta que no existe no da avisos ni contadores de ataque');
    // el interruptor
    ss_setup(['enabled' => false, 'on_attack' => false]);
    ss_clear_outbox();
    foreach (['10.4.0.1', '10.4.0.2', '10.4.0.3'] as $ip) $lock('ana@acme.es', $ip);
    T::same(0, count(outbox()), 'con two_step.on_attack = false no hay aviso ni refuerzo');
}

/** SS10 · El bloqueo de la cuenta entera (30 fallos repartidos entre muchas direcciones) cuenta como ataque repetido al instante. */
function test_step_distributed_attack_counts_at_once()
{
    ss_setup(['enabled' => false]);
    ss_clear_outbox();
    for ($i = 1; $i <= 30; $i++) ss_login('ana@acme.es', 'mala-' . $i, '10.5.' . intdiv($i, 250) . '.' . ($i % 250 + 1));
    T::true(RateLimit::lockedFor('lgacct', 'ana@acme.es') > 0, 'la cuenta queda bloqueada');
    T::same(1, count(outbox()), 'sale el aviso a la primera');
    T::true(Users::find('ana@acme.es')['atk_until'] > Util::nowMs(), 'y queda reforzada');
}

/** SS11 · Otro manager desbloquea una cuenta (la pareja visitante+cuenta, la cuenta y el visitante) y la lista dice cuáles están bloqueadas; la protección reforzada se puede quitar aparte. */
function test_step_unlock_account()
{
    ss_setup(['enabled' => false]);
    for ($i = 0; $i < 5; $i++) ss_login('ana@acme.es', 'mala-' . $i, '10.6.0.1');
    T::same(429, ss_login('ana@acme.es', PW_ANA, '10.6.0.1')->status, 'bloqueada una hora');
    $find = function () { return array_values(array_filter(Router::handle(req('GET', '/users', null, master()))->body['users'], function ($u) { return $u['email'] === 'ana@acme.es'; }))[0]; };
    T::true($find()['locked_for'] > 3000, 'la lista de usuarios enseña los segundos de bloqueo');
    $r = Router::handle(req('POST', '/users/ana%40acme.es/unlock', [], master()));
    T::same(200, $r->status, 'otro manager desbloquea');
    T::same(0, $find()['locked_for'], 'ya no figura bloqueada');
    T::true(isset(ss_login('ana@acme.es', PW_ANA, '10.6.0.1')->body['token']), 'y Ana entra desde la misma dirección');
    Users::set('ana@acme.es', ['atk_until' => Util::nowMs() + 5 * 86400000]);
    Router::handle(req('POST', '/users/ana%40acme.es/unlock', [], master()));
    T::true($find()['reinforced_until'] !== null, 'desbloquear no quita la protección reforzada');
    Router::handle(req('POST', '/users/ana%40acme.es/unlock', ['clear_reinforced' => true], master()));
    T::same(null, $find()['reinforced_until'], 'pero se puede quitar a propósito');
    T::true(count(array_filter(Audit::read(1, 80)['items'], function ($e) { return $e['a'] === 'user.unlock'; })) === 3, 'cada desbloqueo queda anotado');
}

/** SS12 · Registro de actividad: qué se anota, con qué detalle, cuánto ocupa y quién lo lee. */
function test_step_audit_log()
{
    ss_setup();
    $tok = ss_manager_token();
    ss_call('POST', '/users', ['email' => "nuevo@acme.es\nFalso: x", 'name' => 'N', 'role' => 'client', 'password' => 'Clave-Nueva-Cliente-2027!'], $tok);
    ss_call('POST', '/users', ['email' => 'nuevo@acme.es', 'name' => 'Nuevo', 'role' => 'client', 'password' => 'Clave-Nueva-Cliente-2027!'], $tok);
    ss_call('POST', '/prices/upload', ['csv' => SHEET], $tok);
    ss_call('POST', '/prices/upload', ['csv' => SHEET, 'dry_run' => true], $tok);
    ss_call('DELETE', '/users/nuevo%40acme.es', null, $tok);
    $ev = Audit::read(1, 100)['items'];
    $by = function ($a) use ($ev) { return array_values(array_filter($ev, function ($e) use ($a) { return $e['a'] === $a; })); };
    T::same(1, count($by('user.create')), 'se anota crear un usuario (solo el que salió bien)');
    T::same('nuevo@acme.es (client)', $by('user.create')[0]['d'], 'con su correo y rol, sin contraseña');
    T::same(1, count($by('prices.upload')), 'una subida de precios cuenta; la vista previa no');
    T::same(1, count($by('user.delete')), 'y borrar un usuario');
    T::true(strpos(json_encode($ev), 'Clave-Nueva') === false && strpos(json_encode($ev), PW_JEFE) === false && strpos(json_encode($ev), SECRET) === false, 'ninguna contraseña ni secreto en el registro');
    T::same(['jefa@torivac.com', 'manager', '10.0.0.1'], [$by('user.create')[0]['u'], $by('user.create')[0]['r'], $by('user.create')[0]['ip']], 'quién, con qué rol y desde dónde');
    T::same('Entró con código', $by('login.pin_ok')[0]['label'], 'cada hecho lleva su nombre en castellano');
    // un nombre con saltos de línea no inventa líneas
    Audit::log('user.create', ['sub' => 'x@y.es', 'role' => 'manager'], null, "falso\n{\"a\":\"login.ok\"}");
    $lines = file(Audit::dir() . '/' . gmdate('Y-m-d') . '.jsonl', FILE_IGNORE_NEW_LINES);
    T::true(count(array_filter($lines, function ($l) { return json_decode($l, true) === null; })) === 0 && strpos(end($lines), "\\n") === false, 'todas las líneas son JSON y un salto en el detalle no crea otra');
    // filtros
    T::same(true, count(Audit::read(1, 100, ['cat' => 'user'])['items']) === count(array_filter($ev, function ($e) { return strpos($e['a'], 'user.') === 0; })) + 1, 'filtro por categoría');
    T::same(1, count(Audit::read(1, 100, ['q' => 'referencias'])['items']), 'filtro por texto del detalle');
    T::same(0, count(Audit::read(1, 100, ['u' => 'otra@persona.es'])['items']), 'filtro por persona');
    T::same(2, count(Audit::read(1, 2)['items']), 'límite de resultados');
    T::true(Audit::read(1, 2)['truncated'], 'y dice que hay más');
    // la API
    T::same(200, ss_call('GET', '/activity?days=1&limit=5', null, $tok)->status, 'GET /activity para un manager');
    T::same(401, Router::handle(req('GET', '/activity'))->status, 'sin sesión no');
    T::same(403, ss_call('GET', '/activity', null, (string) login_token('ana@acme.es', PW_ANA, '10.7.0.1'))->status, 'ni un cliente');
    // fallos de contraseña: no se anota uno a uno
    ss_setup(['enabled' => false]);
    for ($i = 0; $i < 4; $i++) ss_login('ana@acme.es', 'mala-' . $i, '10.7.0.5');
    T::same(1, count(array_filter(Audit::read(1, 100)['items'], function ($e) { return $e['a'] === 'login.fail'; })), 'cuatro fallos seguidos del mismo visitante: una sola línea');
    ss_login('ana@acme.es', 'mala-5', '10.7.0.5');
    T::same(1, count(array_filter(Audit::read(1, 100)['items'], function ($e) { return $e['a'] === 'login.locked'; })), 'y el bloqueo, otra');
}

/** SS13 · Tamaño y limpieza del registro: un día no pasa de 2 MB (con una línea de aviso) y lo de más de 180 días se borra. */
function test_step_audit_caps_and_purge()
{
    ss_setup();
    $dir = Audit::dir();
    mkdir($dir, 0770, true);
    $f = $dir . '/' . gmdate('Y-m-d') . '.jsonl';
    file_put_contents($f, str_repeat('x', Audit::MAX_DAY_BYTES - 300));
    Audit::log('login.ok', ['sub' => 'a@b.es', 'role' => 'manager'], null, 'cerca del tope');
    Audit::log('login.ok', ['sub' => 'a@b.es', 'role' => 'manager'], null, 'ya pasado');
    $size = filesize($f);
    T::true($size >= Audit::MAX_DAY_BYTES - 300 && $size < Audit::MAX_DAY_BYTES + 800, 'el fichero no pasa del tope por más hechos que lleguen');
    T::true(strpos((string) file_get_contents($f), '"a":"limite"') !== false && substr_count((string) file_get_contents($f), '"a":"limite"') === 1, 'queda UNA línea que dice que el registro está lleno');
    file_put_contents($dir . '/2020-01-01.jsonl', "{}\n");
    file_put_contents($dir . '/' . gmdate('Y-m-d', time() - 100 * 86400) . '.jsonl', "{}\n");
    T::same(1, Audit::purge(), 'se borra lo de más de 180 días');
    T::true(is_file($dir . '/' . gmdate('Y-m-d', time() - 100 * 86400) . '.jsonl') && !is_file($dir . '/2020-01-01.jsonl'), 'y se conserva lo reciente');
    T::same(1, Audit::summary(1)['days'], 'el resumen cuenta los días con registro');
}

/** SS14 · Copia de seguridad: se crea desde el panel, se baja con un enlace firmado de 2 minutos y se restaura entera (datos con su caducidad e imágenes); nada de secretos ni contadores. */
function test_step_backup_create_download_restore()
{
    ss_setup(['enabled' => false]);
    $tok = (string) login_token('jefa@torivac.com', PW_JEFE);
    Store::put('order:TV-20261028-0001-AAA', ['number' => 'TV-20261028-0001-AAA', 'customer' => ['name' => 'Ana Pérez ñ'], 'total' => 12.5], 400 * 86400);
    Store::put('prices:current', ['items' => ['R100' => ['p' => 5.5]]]);
    Store::put('rl:loginip:abc', ['count' => 1, 'resetAt' => Util::nowMs() + 60000]);
    Store::put('pin:' . str_repeat('a', 32), ['e' => 'x']);
    Store::put('auth:decoy', 'hash');
    $img = Blog::saveImage('Foto', bl_img('png'), 'jefa@torivac.com', 1700000000000)['image'];
    Blog::create(['lang' => 'es', 'title' => 'Entrada de prueba', 'slug' => 'entrada-prueba', 'markdown' => 'Texto', 'status' => 'draft'], 'jefa@torivac.com');
    $r = ss_call('POST', '/backups', [], $tok);
    T::same([200, true], [$r->status, $r->body['ok']], 'un manager crea una copia');
    $b = $r->body['backup'];
    T::true(preg_match('/^backup-\d{8}-\d{6}-[0-9a-f]{4}\.jsonl\.gz$/', $b['file']) === 1 && $b['media'] === 1 && $b['keys'] >= 5, 'nombre, imágenes y registros: ' . json_encode($b));
    $path = Backup::dir() . '/' . $b['file'];
    T::same('0660', substr(sprintf('%o', fileperms($path)), -4), 'permisos 0660 (nada legible por otros usuarios del hosting)');
    $dump = (string) shell_exec('zcat ' . escapeshellarg($path));
    T::true(strpos($dump, 'TV-20261028-0001-AAA') !== false && strpos($dump, 'user:jefa@torivac.com') !== false && strpos($dump, 'rl:loginip') === false && strpos($dump, '"k":"pin:') === false && strpos($dump, 'auth:decoy') === false && strpos($dump, SECRET) === false, 'lleva pedidos y usuarios; no contadores, códigos pendientes ni secretos');
    $l = ss_call('GET', '/backups', null, $tok)->body;
    T::same([1, true, 8], [count($l['backups']), $l['auto'], $l['keep']], 'la lista la enseña');
    T::same(403, ss_call('GET', '/backups', null, (string) login_token('ana@acme.es', PW_ANA, '10.8.0.1'))->status, 'un cliente no la ve');
    T::same(401, Router::handle(req('GET', '/backups'))->status, 'ni sin sesión');
    // descarga con enlace firmado
    $link = ss_call('POST', '/backups/' . $b['file'] . '/link', [], $tok)->body;
    T::same(120, $link['expires_in'], 'el enlace vale 2 minutos');
    $dl = Router::handle(req('GET', '/backups/' . $b['file'] . '?t=' . $link['token']));
    T::same([200, $path, 'attachment; filename="' . $b['file'] . '"'], [$dl->status, $dl->file, $dl->headers['Content-Disposition']], 'con el enlace se descarga el archivo');
    T::same(['jefa@torivac.com'], array_values(array_unique(array_map(function ($e) { return $e['u']; }, array_filter(Audit::read(1, 60)['items'], function ($e) { return $e['a'] === 'backup.download'; })))), 'y queda anotado quién lo descargó');
    T::same(403, Router::handle(req('GET', '/backups/' . $b['file']))->status, 'sin enlace no');
    T::same(403, Router::handle(req('GET', '/backups/' . $b['file'] . '?t=' . substr($link['token'], 0, -3) . 'abc'))->status, 'con la firma cambiada no');
    $expired = Backup::link($b['file'], 'jefa@torivac.com', time() - 3600);
    T::same(403, Router::handle(req('GET', '/backups/' . $b['file'] . '?t=' . $expired))->status, 'caducado no');
    T::same(403, Router::handle(req('GET', '/backups/backup-20200101-000000-abcd.jsonl.gz?t=' . $link['token']))->status, 'el enlace de una copia no vale para otra');
    T::same(404, Router::handle(req('GET', '/backups/../../kv/user.json?t=x', null, master()))->status, 'nada de rutas raras (ni siquiera para un manager)');
    // restaurar en otra carpeta de datos vacía
    $arch = tmp_dir('tv-bk-') . '/copia.jsonl.gz';
    copy($path, $arch);
    fresh(['two_step' => ['enabled' => false]]);
    $dry = Backup::restore($arch, false, true);
    T::same([true, 0], [isset($dry['keys']) && $dry['keys'] >= 5, $dry['written']], 'ensayo: cuenta sin escribir');
    T::same([], Store::keys('order:'), 'y no escribió nada');
    $res = Backup::restore($arch);
    T::true(isset($res['written']) && $res['written'] === $res['keys'] + $res['media'], 'restaura todo');
    $o = Store::get('order:TV-20261028-0001-AAA');
    T::same('Ana Pérez ñ', $o['customer']['name'], 'el pedido vuelve con sus tildes');
    $raw = json_decode((string) file_get_contents(Store::root() . '/kv/' . rawurlencode('order:TV-20261028-0001-AAA') . '.json'), true);
    T::true(isset($raw['x']) && $raw['x'] > time() + 399 * 86400, 'y con su caducidad de 400 días');
    T::same(bl_img('png'), (string) file_get_contents(Blog::mediaDir() . '/' . $img['file']), 'la imagen vuelve idéntica');
    T::true(Users::find('jefa@torivac.com') !== null && Blog::resolve('es', 'entrada-prueba') !== null, 'usuarios y entradas del blog vuelven');
    T::same([], kv_files('rl%3A'), 'sin contadores');
    $again = Backup::restore($arch);
    T::true(isset($again['error']) && !empty($again['existing']), 'sobre datos ya existentes no sobrescribe sin --force');
    T::true(isset(Backup::restore($arch, true)['written']), 'con --force sí');
    // incompleta o dañada: no se toca nada
    $cut = tmp_dir('tv-bk-') . '/cortada.jsonl.gz';
    $lines = explode("\n", trim((string) shell_exec('zcat ' . escapeshellarg($arch))));
    $gz = gzopen($cut, 'wb6'); gzwrite($gz, implode("\n", array_slice($lines, 0, -1)) . "\n"); gzclose($gz);
    fresh(['two_step' => ['enabled' => false]]);
    T::true(isset(Backup::restore($cut)['error']) && Store::keys('user:') === [], 'una copia sin su cierre se rechaza y no escribe nada');
    file_put_contents($cut, 'esto no es un gzip');
    T::true(isset(Backup::restore($cut)['error']), 'ni un archivo que no es una copia');
}

/** SS15 · Copias: se guardan solo las 8 últimas, la semanal se hace una vez por semana y se puede apagar. */
function test_step_backup_schedule_and_prune()
{
    ss_setup(['enabled' => false]);
    $a = Backup::maybeWeekly('cron');
    T::true($a !== null && isset($a['file']), 'se crea la primera copia automática');
    T::same('cron', json_decode((string) file_get_contents(Backup::dir() . '/' . $a['file'] . '.json'), true)['by'], 'y dice quién la hizo');
    T::same(null, Backup::maybeWeekly(), 'otra al momento no');
    $meta = Backup::dir() . '/' . $a['file'] . '.json';
    $m = json_decode((string) file_get_contents($meta), true);
    $m['at'] = gmdate('Y-m-d\TH:i:s\Z', time() - 8 * 86400);
    file_put_contents($meta, json_encode($m));
    Store::put('backup:attempt', time() - 10, 7200);
    T::same(null, Backup::maybeWeekly(), 'ni si se intentó hace menos de una hora (no se repite un fallo sin parar)');
    Store::delete('backup:attempt');
    T::true(Backup::maybeWeekly() !== null, 'pasada la semana, sí');
    // las 8 últimas
    for ($i = 0; $i < 10; $i++) { usleep(1100000 / 10); Backup::create('x', false); }
    $names = array_map(function ($b) { return $b['file']; }, Backup::list());
    T::same(8, count($names), 'solo se conservan 8 copias');
    T::same(8, count(glob(Backup::dir() . '/*.jsonl.gz.json')), 'y sus fichas');
    // apagada
    ss_setup(['enabled' => false]);
    ss_config(['two_step' => ['enabled' => false], 'backup' => ['auto' => false]]);
    T::same(null, Backup::maybeWeekly(), 'con backup.auto = false no se hace sola');
    $b = Router::handle(req('GET', '/backups', null, master()));
    T::same([false, null], [$b->body['auto'], $b->body['next']], 'y el panel lo dice');
    // programar al final de la petición no hace nada en pruebas
    T::same(false, Backup::$scheduling, 'las pruebas no programan copias al terminar el proceso');
    // borrar
    ss_setup(['enabled' => false]);
    $c = Backup::create('x', false);
    T::same(200, Router::handle(req('DELETE', '/backups/' . $c['file'], null, master()))->status, 'borrar una copia');
    T::same([], Backup::list(), 'y desaparece de la lista');
    T::same(404, Router::handle(req('DELETE', '/backups/' . $c['file'], null, master()))->status, 'una que ya no existe: 404');
}

/** SS16 · /health cuenta qué trae el servidor (y la clave PÚBLICA del CAPTCHA solo si están las dos claves) y el Diagnóstico explica cada medida. */
function test_step_health_features_and_diagnostics()
{
    ss_setup();
    $f = Router::handle(req('GET', '/health'))->body['features'];
    T::same([true, true, true, true, false], [$f['blog'], $f['activity'], $f['backups'], $f['two_step'], isset($f['turnstile'])], 'blog, actividad, copias y código por correo; el CAPTCHA no');
    ss_config(['turnstile_sitekey' => '0x4AAAAAAABBBBCCCC', 'turnstile_secret' => '']);
    T::same(false, isset(Router::handle(req('GET', '/health'))->body['features']['turnstile']), 'solo la clave pública: el CAPTCHA no se ofrece');
    ss_config(['turnstile_sitekey' => '0x4AAAAAAABBBBCCCC', 'turnstile_secret' => 'secreto-turnstile-123456']);
    $h = Router::handle(req('GET', '/health'))->body;
    T::same(['sitekey' => '0x4AAAAAAABBBBCCCC'], $h['features']['turnstile'], 'con las dos, se ofrece la clave pública');
    T::true(strpos(json_encode($h), 'secreto-turnstile') === false, 'y el secreto jamás sale');
    $st = function () { $o = []; foreach (Diag::security() as $c) $o[$c['id']] = $c['status']; return $o; };
    T::same(['codigo_correo' => 'ok', 'alertas' => 'ok', 'actividad' => 'ok', 'copias' => 'warn', 'captcha' => 'ok'], $st(), 'con el código activo, sin copias todavía y el CAPTCHA puesto');
    ss_config(['turnstile_secret' => 'solo-secreto-123456']);
    T::same('fail', $st()['captcha'], 'el secreto sin la clave pública bloquearía los formularios: fallo');
    ss_config([]);
    Router::handle(req('POST', '/users/jefa%40torivac.com/two-step', ['enabled' => false], master()));
    T::same('warn', $st()['codigo_correo'], 'si todos los managers son de confianza, el Diagnóstico avisa de que nadie pide código');
    Backup::create('x');
    T::same('ok', $st()['copias'], 'con una copia reciente, bien');
}
