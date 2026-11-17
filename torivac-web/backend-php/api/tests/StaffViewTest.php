<?php
/**
 * Pruebas de lo que ven la propietaria (rol client) y el comercial (rol reviewer, el Revisor) además de su panel: los mensajes de contacto y los presupuestos recibidos, SIN la IP ni el motivo técnico del correo.
 * La propietaria lee y borra mensajes y edita y reenvía presupuestos; el comercial solo lee (editar, reenviar y borrar → 403 «Solo lectura»); un cliente con cuenta sigue sin ver mensajes.
 */
namespace Torivac\Tests;

use Torivac\Messages;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Manager, propietaria, comercial y cliente con sesión → [manager, propietaria, comercial, cliente]. */
function sv_tokens(): array
{
    Users::create(['email' => 'jefa@torivac.test', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'maria@torivac.test', 'name' => 'María', 'role' => 'client', 'password' => PW_ANA]);
    Users::create(['email' => 'carlos.comercial@torivac.test', 'name' => 'Carlos', 'role' => 'reviewer', 'password' => 'Clave-Comercial-2026!']);
    Users::create(['email' => 'luis.cliente@acme.test', 'name' => 'Comprador', 'role' => 'customer', 'password' => PW_CLI]);
    return [login_token('jefa@torivac.test', PW_JEFE, '10.7.1.1'), login_token('maria@torivac.test', PW_ANA, '10.7.1.2'), login_token('carlos.comercial@torivac.test', 'Clave-Comercial-2026!', '10.7.1.3'), login_token('luis.cliente@acme.test', PW_CLI, '10.7.1.4')];
}

/** Un mensaje con IP y un fallo de correo guardado → su id. */
function sv_message(): string
{
    $rec = Messages::create(['name' => 'Javier Mora', 'email' => 'javier@mora.test', 'message' => 'Necesito un toroidal de 300 VA', 'lang' => 'es'], '203.0.113.9');
    Messages::setEmailed($rec, ['sent' => false, 'reason' => 'failed', 'error' => 'Resend 403: dominio sin verificar']);
    return $rec['id'];
}

/** S1 · Mensajes: el manager los ve completos; la propietaria y el comercial, sin `ip` ni `emailed.error`; un cliente con cuenta, nada. */
function test_staff_messages_are_visible_without_ip_or_mail_error()
{
    fresh(); [$tj, $to, $tc, $tu] = sv_tokens(); $id = sv_message();
    $m = Router::handle(req('GET', '/messages', null, bearer($tj)))->body['items'][0];
    T::same(['203.0.113.9', 'Resend 403: dominio sin verificar'], [$m['ip'], $m['emailed']['error']], 'el manager ve la IP y el motivo técnico');
    foreach (['propietaria' => $to, 'comercial' => $tc] as $who => $tok) {
        $r = Router::handle(req('GET', '/messages', null, bearer($tok)));
        T::same(200, $r->status, "$who: ve los mensajes");
        $x = $r->body['items'][0];
        T::same([$id, 'Javier Mora', 'Necesito un toroidal de 300 VA', false, false, 'failed'], [$x['id'], $x['name'], $x['message'], isset($x['ip']), isset($x['emailed']['error']), $x['emailed']['reason']], "$who: nombre y texto sí; IP y motivo técnico no");
        T::same('no-store', $r->headers['Cache-Control'], "$who: sin caché");
    }
    T::same(403, Router::handle(req('GET', '/messages', null, bearer($tu)))->status, 'un cliente con cuenta no');
    T::same(401, Router::handle(req('GET', '/messages'))->status, 'sin sesión tampoco');
}

/** S2 · Borrar un mensaje: el manager y la propietaria sí; el comercial no (403 y no se borra). */
function test_staff_messages_delete_is_for_manager_and_owner_only()
{
    fresh(); [$tj, $to, $tc] = sv_tokens(); $a = sv_message(); $b = sv_message();
    T::same(403, Router::handle(req('DELETE', "/messages/$a", null, bearer($tc)))->status, 'el comercial no borra');
    T::true(Store::get("msg:$a") !== null, 'y no se borró');
    T::same(200, Router::handle(req('DELETE', "/messages/$a", null, bearer($to)))->status, 'la propietaria borra');
    T::same(404, Router::handle(req('DELETE', "/messages/$a", null, bearer($to)))->status, 'un mensaje ya borrado: 404');
    T::same(200, Router::handle(req('DELETE', "/messages/$b", null, bearer($tj)))->status, 'el manager borra');
    T::same(404, Router::handle(req('POST', '/messages', [], bearer($tc)))->status, 'otras rutas de mensajes: 404');
}

/** S3 · Presupuestos: el comercial los ve todos (sin IP), pero no edita ni reenvía; la propietaria sí edita. */
function test_reviewer_sees_all_quotes_read_only()
{
    fresh(); publicAtSheetPrice(); seedPrices(); [$tj, $to, $tc, $tu] = sv_tokens();
    $o = Router::handle(req('POST', '/order', goodOrder(), [], '10.7.2.1'));
    T::same(200, $o->status, 'pedido de un visitante');
    $n = $o->body['number'];
    $l = Router::handle(req('GET', '/orders', null, bearer($tc)));
    T::same([200, [$n], false], [$l->status, array_column($l->body['orders'], 'number'), isset($l->body['orders'][0]['ip'])], 'el comercial ve la lista, sin IP');
    $d = Router::handle(req('GET', "/orders/$n", null, bearer($tc)));
    T::same([200, $n, false], [$d->status, $d->body['order']['number'], isset($d->body['order']['ip'])], 'y el detalle, sin IP');
    T::same(403, Router::handle(req('PUT', "/orders/$n", ['rev' => 0, 'lines' => [['ref' => 'TT0020210', 'qty' => 2]]], bearer($tc)))->status, 'no edita');
    T::same(403, Router::handle(req('POST', "/orders/$n/send", ['to' => ['a@b.es']], bearer($tc)))->status, 'no reenvía');
    T::same(403, Router::handle(req('PUT', '/orders/TV-20260101-0001-ABC', ['rev' => 0, 'lines' => []], bearer($tc)))->status, 'ni siquiera se mira si el número existe');
    T::same(404, Router::handle(req('GET', '/orders/TV-20260101-0001-ABC', null, bearer($tc)))->status, 'un número que no existe: 404');
    T::same(200, Router::handle(req('GET', "/orders/$n", null, bearer($to)))->status, 'la propietaria lo ve');
    foreach (['/prices/items/R100', '/customers', '/users', '/admin/data', '/settings/google', '/activity', '/backups', '/blog/posts', '/mail/status'] as $p) T::same(403, Router::handle(req('GET', $p, null, bearer($tc)))->status, "el comercial no entra en $p");
}
