<?php
/**
 * [MESSAGES] Mensajes del formulario de contacto: se guardan SIEMPRE (antes de intentar el correo) para que nadie pierda un mensaje ni se quede sin saber si salió el aviso.
 * Clave del almacén: msg:<id> con id CT-AAAAMMDD-NNNN-XXX (CT = contacto; NNNN = contador diario; XXX = 3 caracteres aleatorios base36 en mayúsculas, por si dos mensajes coinciden).
 * Retención de 400 días como los pedidos (Store caduca el registro; el cron lo borra). Son DATOS PERSONALES: solo los ve un gestor (GET /api/messages) y la IP completa solo se guarda aquí.
 * Registro: { id, at, name, email, message, lang, ip, emailed:{ sent, reason: sent|off|failed|skipped, error? } }; `error` es un texto corto y sin secretos, solo para gestores.
 *   Messages::create()      guarda el mensaje recién llegado (con el correo aún sin confirmar)
 *   Messages::setEmailed()  anota en el registro lo que pasó con el correo
 *   Messages::recent()      los más recientes primero, hasta 300, tolerando registros dañados
 *   Messages::delete()      borra uno (derecho de supresión)
 */
namespace Torivac;

final class Messages
{
    const PREFIX = 'msg:';
    /** 400 días, en segundos. */
    const TTL = 34560000;
    const DEFAULT_LIMIT = 100;
    const MAX_LIMIT = 300;
    const ID_RE = '/^CT-(\d{8})-(\d{4,5})-([0-9A-Z]{3})$/D';

    /** Id nuevo CT-AAAAMMDD-NNNN-XXX: contador diario con bloqueo (dos mensajes no repiten número) + sufijo aleatorio. Lanza si el almacén no deja escribir. */
    public static function nextId(?int $nowMs = null): string
    {
        $ymd = gmdate('Ymd', (int) floor(($nowMs ?? Util::nowMs()) / 1000));
        $n = Store::locked('counter', function () use ($ymd) {
            $k = 'counter:ct:' . $ymd;
            $n = (int) Store::get($k) + 1;
            Store::put($k, $n, 172800);
            return $n;
        });
        $s = '';
        for ($i = 0; $i < 3; $i++) $s .= '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[random_int(0, 35)];
        return 'CT-' . $ymd . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT) . '-' . $s;
    }

    /** ¿Tiene esa forma un id de mensaje? */
    public static function validId($id): bool { return is_string($id) && preg_match(self::ID_RE, $id) === 1; }

    /**
     * Crea y GUARDA el registro de un mensaje ya validado y limpio (name, email, message, lang) con la IP del visitante. Hasta saber el resultado del correo, el registro no afirma nada falso
     * (emailed = sent false, failed, «Envío sin confirmar»). Lanza si no se puede guardar (el que llama responde 500 y no envía nada).
     * @param array{name:string,email:string,message:string,lang:string} $c
     */
    public static function create(array $c, string $ip, ?int $nowMs = null): array
    {
        $rec = ['id' => self::nextId($nowMs), 'at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'name' => $c['name'], 'email' => $c['email'], 'message' => $c['message'], 'lang' => $c['lang'], 'ip' => $ip,
            'emailed' => ['sent' => false, 'reason' => 'failed', 'error' => 'Envío sin confirmar']];
        Store::put(self::PREFIX . $rec['id'], $rec, self::TTL);
        return $rec;
    }

    /** Anota en el registro el resultado del correo: ['sent' => bool, 'reason' => …, 'error'? => …]. Lanza si no se puede guardar. */
    public static function setEmailed(array $rec, array $emailed): void
    {
        $rec['emailed'] = $emailed;
        Store::put(self::PREFIX . $rec['id'], $rec, self::TTL);
    }

    /** Vista de un registro para el gestor, o null si falta algo esencial (id y fecha en texto) o no es un registro. */
    private static function view($o): ?array
    {
        if (!is_array($o) || !self::validId($o['id'] ?? null) || !is_string($o['at'] ?? null)) return null;
        $str = function ($v) { return is_string($v) ? $v : ''; };
        $e = is_array($o['emailed'] ?? null) ? $o['emailed'] : [];
        $emailed = ['sent' => ($e['sent'] ?? false) === true, 'reason' => $str($e['reason'] ?? '')];
        if ($str($e['error'] ?? '') !== '') $emailed['error'] = $str($e['error']);
        return ['id' => $o['id'], 'at' => $o['at'], 'name' => $str($o['name'] ?? ''), 'email' => $str($o['email'] ?? ''), 'message' => $str($o['message'] ?? ''), 'lang' => $str($o['lang'] ?? ''), 'ip' => $str($o['ip'] ?? ''), 'emailed' => $emailed];
    }

    /** `limit` pedido en la URL → entero entre 1 y 300; ausente o ilegible = 100. */
    public static function limit($raw): int
    {
        if (is_string($raw) && preg_match('/^\s*-?\d+(\.\d+)?\s*$/', $raw)) return max(1, min(self::MAX_LIMIT, (int) floor((float) $raw)));
        return is_int($raw) ? max(1, min(self::MAX_LIMIT, $raw)) : self::DEFAULT_LIMIT;
    }

    /**
     * Los mensajes más recientes primero (hasta `$limit`, 1..300) → ['items' => […], 'truncated' => bool]. Solo se leen los ficheros necesarios (los nombres se ordenan sin abrirlos);
     * un registro dañado se omite y el hueco se rellena con el siguiente. truncated = hay más mensajes de los devueltos.
     */
    public static function recent(int $limit = self::DEFAULT_LIMIT): array
    {
        $limit = max(1, min(self::MAX_LIMIT, $limit));
        $names = Store::names(self::PREFIX);
        $items = [];
        $used = 0;
        foreach ($names as $name) {
            if (count($items) >= $limit) break;
            $used++;
            $v = self::view(Store::get($name));
            if ($v !== null) $items[] = $v;
        }
        usort($items, function ($a, $b) { return strcmp($b['at'], $a['at']) ?: strcmp($b['id'], $a['id']); });
        return ['items' => $items, 'truncated' => $used < count($names)];
    }

    /** Borra el mensaje con ese id → true si existía; false si no existe o el id no tiene la forma CT-AAAAMMDD-NNNN-XXX (nunca alcanza otras claves del almacén). */
    public static function delete($id): bool
    {
        if (!self::validId($id) || Store::get(self::PREFIX . $id) === null) return false;
        Store::delete(self::PREFIX . $id);
        return true;
    }
}
