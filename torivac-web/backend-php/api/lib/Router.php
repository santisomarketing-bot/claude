<?php
/**
 * [ROUTER] Rutas del API (equivalentes a workers/api/src/index.js: la web usa el mismo contrato con el Worker o con este PHP).
 *   PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login
 *   USUARIO   GET /api/auth/me · POST /api/auth/logout (cierra TODAS las sesiones de esa persona) · GET /api/orders (manager: los 300 últimos; cliente: los suyos, hasta 100)
 *   MANAGER   GET /api/diag · GET /api/admin/data · GET /api/messages?limit= · DELETE /api/messages/:id · POST /api/mail/test · GET /api/mail/status · POST /api/prices/refresh · POST /api/prices/upload · POST /api/prices/ai (propone) · POST /api/prices/ai/apply (aplica)
 *             GET|POST /api/proposals/state · GET|POST|DELETE /api/users
 *   CRON      GET /api/cron?token=… (alternativa a `php cron.php` si el hosting no deja programar por línea de comandos)
 *
 * [LIMITES] Todo límite por visitante usa Request::ipKey (una IPv6 cuenta por su /64). ACCESO (POST /auth/login), contra la fuerza bruta: 5 contraseñas erróneas desde el mismo visitante contra la misma
 * cuenta bloquean ESA pareja durante 1 HORA (desde el 5.º fallo; durante el bloqueo ni la contraseña correcta entra y no se comprueba); 15 fallos en 1 hora desde un visitante con cualquier cuenta lo
 * bloquean 1 hora; 30 fallos en 1 hora contra una cuenta (desde cualquier visitante) la bloquean 1 hora; todos cuentan también los correos que no existen y responden lo mismo (429 con retry_after y
 * Retry-After en segundos, sin distinguir si la cuenta existe). Un acceso correcto pone a cero los contadores de esa pareja y de esa cuenta. Además, tope de inundación: 30 intentos / 10 min por visitante.
 * Un Bearer inválido (30 fallos / 10 min por visitante) y una llamada al cron con token erróneo (10 / 10 min) también acaban en 429; solo cuentan los fallos.
 * [ERRORES] Un 500 nunca enseña el mensaje interno: {"ok":false,"error":"Error interno","id":"<8 hex>"} y el detalle va a error_log con ese mismo id.
 */
namespace Torivac;

final class Router
{
    /** Intentos de acceso por visitante en 10 min (cuentan todos, también los correctos): tope de inundación. */
    const LOGIN_PER_IP = 30;
    /** Contraseñas erróneas seguidas de un visitante contra una misma cuenta antes de bloquear esa pareja. */
    const LOGIN_FAILS_PAIR = 5;
    /** Contraseñas erróneas de un visitante contra cualquier cuenta, en una hora, antes de bloquear al visitante. */
    const LOGIN_FAILS_VISITOR = 15;
    /** Contraseñas erróneas contra una cuenta, de cualquier visitante, en una hora, antes de bloquear la cuenta. */
    const LOGIN_FAILS_ACCOUNT = 30;
    /** Ventana en la que se cuentan los fallos de acceso, y duración del bloqueo: 1 hora. */
    const LOGIN_LOCK_MS = 3600000;
    /** Fallos con un Bearer inválido por visitante antes de bloquearle. */
    const BEARER_FAILS = 30;
    /** Fallos en la llamada al cron por visitante antes de bloquearle. */
    const CRON_FAILS = 10;
    /** Ventana de los fallos de token y de cron: 10 min. */
    const FAIL_WINDOW_MS = 600000;
    /** Pedidos que se devuelven como máximo a un manager. */
    const ORDERS_MANAGER = 300;
    /** Pedidos que se devuelven como máximo a un cliente. */
    const ORDERS_CLIENT = 100;
    /** Ficheros de pedidos (los más recientes) que se miran como mucho al listar los de un cliente. */
    const ORDERS_CLIENT_SCAN = 3000;

    /** Atiende una petición: comprueba el origen (CORS), despacha a la ruta y convierte las excepciones en respuestas JSON con su código. */
    public static function handle(Request $req, ?array $catalog = null): Response
    {
        $cors = [];
        $origin = $req->header('origin');
        if ($origin !== '' && !Cors::allowed($origin, $req->header('host'))) return new Response(['ok' => false, 'error' => 'Origen no permitido'], 403);
        if ($origin !== '') $cors = Cors::headers($origin);
        if ($req->method === 'OPTIONS') return new Response([], 204, $cors);
        try {
            $r = self::route($req, $catalog);
        } catch (\Throwable $e) {
            $r = self::failure($e);
        }
        if ($cors) {
            $r->headers += $cors;
            $r->headers['Vary'] = self::mergeVary((string) ($r->headers['Vary'] ?? ''), 'Origin');
        }
        return $r;
    }

    /** Une dos valores de la cabecera Vary sin repetir (Origin va primero): la respuesta depende del origen Y de la sesión, y una caché compartida debe saberlo. */
    private static function mergeVary(string $current, string $add): string
    {
        $out = [$add];
        foreach (explode(',', $current) as $v) { $v = trim($v); if ($v !== '' && strcasecmp($v, $add) !== 0) $out[] = $v; }
        return implode(', ', $out);
    }

    /**
     * Convierte una excepción en la respuesta que ve quien llama: una petición o hoja mal formada (InvalidArgumentException) = 400 con su mensaje; un RuntimeException con código HTTP
     * 400-599 distinto de 500 es un mensaje pensado para quien llama (sync rechazada 409, IA sin configurar 503…) y sale tal cual; CUALQUIER otra cosa es un fallo interno: respuesta
     * genérica con un id de 8 hex y el detalle (clase, mensaje, fichero:línea) al registro de errores con ese id. Nunca se devuelve getMessage() de un fallo interno.
     */
    public static function failure(\Throwable $e): Response
    {
        if ($e instanceof \InvalidArgumentException) return new Response(['ok' => false, 'error' => $e->getMessage()], 400);
        $code = $e instanceof \RuntimeException ? (int) $e->getCode() : 0;
        if ($code >= 400 && $code < 600 && $code !== 500) return new Response(['ok' => false, 'error' => $e->getMessage()], $code);
        $id = bin2hex(random_bytes(4));
        error_log('torivac-api[' . $id . ']: ' . get_class($e) . ': ' . mb_substr($e->getMessage(), 0, 300) . ' en ' . basename($e->getFile()) . ':' . $e->getLine());
        return new Response(['ok' => false, 'error' => 'Error interno', 'id' => $id], 500);
    }

    /** El 429 de siempre (inundación, Bearer, cron): mismo texto para todos, exista o no el usuario. */
    private static function tooMany(): Response { return new Response(['ok' => false, 'error' => 'Demasiados intentos. Espera unos minutos.'], 429); }

    /** Texto del tiempo que queda de bloqueo: «una hora» si falta casi una hora entera; si no, «N minutos» (redondeado hacia arriba). */
    public static function lockWait(int $secs): string
    {
        if ($secs >= 3300) return 'una hora';
        $m = max(1, (int) ceil($secs / 60));
        return $m === 1 ? 'un minuto' : $m . ' minutos';
    }

    /** El 429 del bloqueo por fallos de contraseña: el mismo para los tres motivos y exista o no la cuenta; dice cuánto falta (retry_after y Retry-After, en segundos). */
    private static function locked(int $leftMs): Response
    {
        $secs = max(1, (int) ceil($leftMs / 1000));
        return new Response(['ok' => false, 'error' => 'Demasiados intentos fallidos. Vuelve a intentarlo en ' . self::lockWait($secs) . '.', 'retry_after' => $secs], 429, ['Retry-After' => (string) $secs]);
    }

    /**
     * Autentica la petición. Devuelve [quién|null, respuesta 429|null]. Sin Bearer no hay nada que probar. Con Bearer, un visitante (ipKey) con 30 fallos en 10 min ni siquiera llega a
     * probar el token (429); un token inválido suma un fallo y uno válido no consume cupo.
     * @return array{0:?array,1:?Response}
     */
    private static function authenticate(Request $req): array
    {
        if ($req->bearer() === null) return [null, null];
        $ipk = Request::ipKey($req->ip);
        if (RateLimit::exceeded('bearer', $ipk, self::BEARER_FAILS)) return [null, self::tooMany()];
        $who = Auth::authenticate($req);
        if (!$who) RateLimit::fail('bearer', $ipk, self::FAIL_WINDOW_MS);
        return [$who, null];
    }

    /** GET /health: vivo, estado del correo (controlador, si está configurado y último intento SIN el texto del error) y, si algún ajuste está mal (secreto de sesión, token maestro o de cron, modo de la copia al cliente, mail.driver, order_from), lo dice con su NOMBRE (nunca el valor). */
    private static function health(): Response
    {
        $b = ['ok' => true, 'time' => Util::iso()];
        $p = Auth::configProblems();
        if (!Orders::copyModeValid()) $p[] = 'order_copy';
        if (Mail::driverUnknown()) $p[] = 'mail.driver';
        if (!Mail::sender()['ok']) $p[] = 'order_from';
        $st = Mail::status();
        $last = $st['last'];
        if ($last !== null) unset($last['error']);                                              // /health es público: el texto del error es de GET /mail/status (solo managers)
        $b['mail'] = ['driver' => $st['driver'], 'configured' => $st['configured'], 'last' => $last];
        if ($p) $b['config'] = ['ok' => false, 'problems' => $p];
        return new Response($b);
    }

    /** GET /prices: el público ve la lista sin quién la cargó ni de dónde; un manager lo ve todo (y el estado de la última sincronización). Con la IP bloqueada por tokens fallidos se sirve la vista pública. */
    private static function prices(Request $req): Response
    {
        $prices = Prices::load();
        $meta = Store::get(Prices::KEY_META);
        [$me] = self::authenticate($req);                                                       // un manager ve quién cargó la hoja y de dónde; el público, no
        if ($me && $me['role'] === 'manager') {
            $body = ['prices' => Prices::forJson($prices), 'meta' => $meta];
            $sync = Store::get(Prices::KEY_SYNC);
            if (is_array($sync)) $body['sync'] = $sync;
            return new Response($body, 200, ['Cache-Control' => 'private, no-store', 'Vary' => 'Authorization']);
        }
        $pub = Prices::publicView($prices, $meta);
        $body = ['prices' => Prices::forJson($pub['prices']), 'meta' => $pub['meta']];
        $etag = '"' . md5(Util::enc($body)) . '"';
        $h = ['Cache-Control' => 'public, max-age=300', 'ETag' => $etag, 'Vary' => 'Authorization'];
        if ($req->header('if-none-match') === $etag) return new Response([], 304, $h);
        return new Response($body, 200, $h);
    }

    /**
     * POST /auth/login: contraseña con coste igual exista o no el usuario, token ligado al sid del usuario y protección contra la fuerza bruta (ver la cabecera): 5 fallos de un visitante contra una cuenta,
     * 15 de un visitante contra cualquiera y 30 contra una cuenta desde cualquiera → bloqueo de 1 hora. Los contadores cuentan los correos que no existen igual que los que sí (la respuesta no los distingue).
     */
    private static function login(Request $req): Response
    {
        $b = $req->json() ?? [];
        $email = $b['email'] ?? '';
        $pass = $b['password'] ?? '';
        if (!is_string($email) || !is_string($pass)) return new Response(['ok' => false, 'error' => 'Petición no válida'], 400);
        $secret = Auth::sessionSecret();
        if ($secret === null) {
            $why = Auth::secretProblem((string) Config::get('session_secret', '')) === 'sin cambiar' ? 'sin cambiar (sigue el valor de ejemplo)' : 'demasiado corto';
            return new Response(['ok' => false, 'error' => 'Configuración insegura: session_secret ' . $why], 500);
        }
        $email = strtolower(trim(substr($email, 0, 320)));
        $ipk = Request::ipKey($req->ip);
        if (!RateLimit::hit('loginip', $ipk, self::LOGIN_PER_IP)['allowed']) return self::tooMany();       // inundación: ni se comprueba la contraseña
        $pair = $ipk . ':' . $email;
        $left = max(RateLimit::lockedFor('lgpair', $pair), RateLimit::lockedFor('lgip', $ipk), RateLimit::lockedFor('lgacct', $email));
        if ($left > 0) return self::locked($left);                                                          // bloqueado: ni la contraseña correcta entra, y no se gasta tiempo en comprobarla
        $r = Users::login($email, $pass);
        if ($r === null) {
            RateLimit::failLock('lgpair', $pair, self::LOGIN_FAILS_PAIR, self::LOGIN_LOCK_MS, self::LOGIN_LOCK_MS);
            RateLimit::failLock('lgip', $ipk, self::LOGIN_FAILS_VISITOR, self::LOGIN_LOCK_MS, self::LOGIN_LOCK_MS);
            RateLimit::failLock('lgacct', $email, self::LOGIN_FAILS_ACCOUNT, self::LOGIN_LOCK_MS, self::LOGIN_LOCK_MS);
            return new Response(['ok' => false, 'error' => 'Credenciales incorrectas'], 401);
        }
        RateLimit::clear('lgpair', $pair);
        RateLimit::clear('lgacct', $email);
        return new Response(['ok' => true, 'token' => Auth::signSession(['sub' => $r['user']['email'], 'sid' => $r['sid']], $secret), 'user' => $r['user']]);
    }

    /** GET /cron?token=…: sincroniza los precios si el token es el de cron_token (≥ 24 caracteres); 10 fallos / 10 min por visitante → 429; sin cron_token válido la URL está desactivada (401). */
    private static function cronByUrl(Request $req): Response
    {
        $tok = Auth::cronToken();
        if ($tok === null) return new Response(['ok' => false, 'error' => 'No autorizado'], 401);
        $ipk = Request::ipKey($req->ip);
        if (RateLimit::exceeded('cron', $ipk, self::CRON_FAILS)) return self::tooMany();
        $given = $req->query['token'] ?? '';
        if (!is_string($given) || !Util::secretEq($tok, $given)) {
            RateLimit::fail('cron', $ipk, self::FAIL_WINDOW_MS);
            return new Response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
        return new Response(['ok' => true, 'meta' => self::cron()]);
    }

    /** Un pedido tal como lo ve un cliente: sin la IP desde la que se hizo ni el motivo técnico del fallo del correo (eso es solo para managers). */
    private static function forClient(array $o): array
    {
        unset($o['ip']);
        if (isset($o['emailed']) && is_array($o['emailed'])) unset($o['emailed']['error']);
        return $o;
    }

    /** GET /orders: un manager recibe los 300 pedidos más recientes; un cliente, los suyos (los que llevan su correo) hasta 100, mirando solo los 3000 más recientes. `truncated:true` si se cortó. */
    private static function orders(array $who): Response
    {
        $mgr = $who['role'] === 'manager';
        $cap = $mgr ? self::ORDERS_MANAGER : self::ORDERS_CLIENT;
        $names = Store::names('order:');                                                        // solo los nombres: no se lee ningún fichero hasta saber cuáles interesan
        $truncated = false;
        if (!$mgr && count($names) > self::ORDERS_CLIENT_SCAN) { $names = array_slice($names, 0, self::ORDERS_CLIENT_SCAN); $truncated = true; }
        $out = [];
        foreach ($names as $k) {
            $o = Store::get($k);
            if (!is_array($o)) continue;
            if (!$mgr && ($o['customer']['email'] ?? '') !== $who['sub']) continue;
            if (count($out) >= $cap) { $truncated = true; break; }
            $out[] = $mgr ? $o : self::forClient($o);
        }
        usort($out, function ($a, $b) { return strcmp((string) ($b['at'] ?? ''), (string) ($a['at'] ?? '')); });
        $body = ['ok' => true, 'orders' => $out];
        if ($truncated) $body['truncated'] = true;
        return new Response($body);
    }

    /** GET /messages?limit=N: los mensajes de contacto más recientes primero (1..300, 100 por defecto) con la IP y el estado del correo; un registro dañado se omite. */
    private static function messages(Request $req): Response
    {
        $r = Messages::recent(Messages::limit($req->query['limit'] ?? null));
        return new Response(['ok' => true, 'items' => $r['items'], 'truncated' => $r['truncated']], 200, ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    /**
     * POST /mail/test { to? }: envía «Torivac · prueba de correo» a `to` (un correo válido) o, si no se da, a los destinatarios de order_to. Responde 200 { ok, driver, to, sent, reason, error? } aunque el
     * proveedor falle (aquí SÍ va el `error` corto y sin secretos: es el diagnóstico); 400 si el cuerpo o `to` no valen; 429 pasadas 10 pruebas por hora y usuario. Se anota como último intento (kind test).
     */
    private static function mailTest(Request $req, array $who): Response
    {
        $b = trim($req->body) === '' ? [] : $req->json(10000);
        if (!is_array($b) || (Util::isList($b) && $b)) return new Response(['ok' => false, 'error' => 'Petición no válida'], 400);
        if (!array_key_exists('to', $b) || $b['to'] === null || (is_string($b['to']) && trim($b['to']) === '')) $to = Orders::team();
        else {
            $t = is_string($b['to']) ? Util::line($b['to'], 254) : '';
            if (!Orders::validEmail($t)) return new Response(['ok' => false, 'error' => 'Correo de destino no válido'], 400);
            $to = [$t];
        }
        if (!RateLimit::hit('mailtest', (string) $who['sub'], 10, 3600000)['allowed']) return new Response(['ok' => false, 'error' => 'Demasiadas pruebas de correo. Espera una hora.'], 429);
        $m = Mail::testMail(Mail::driver(), Util::iso());
        $r = Mail::send(['to' => $to, 'subject' => $m['subject'], 'html' => $m['html'], 'text' => $m['text']], 'test');
        return new Response(['ok' => !empty($r['ok']), 'driver' => $r['driver'], 'to' => $to, 'sent' => !empty($r['ok']), 'reason' => (string) $r['reason']] + (!empty($r['error']) ? ['error' => $r['error']] : []));
    }

    /** Tabla de rutas: públicas, de usuario autenticado y de manager (ver la lista de la cabecera). */
    private static function route(Request $req, ?array $catalog): Response
    {
        $path = $req->path;
        $m = $req->method;
        if ($path === '/health') return self::health();
        if ($path === '/prices' && $m === 'GET') return self::prices($req);
        if ($path === '/order' && $m === 'POST') return Orders::handleOrder($req, $req->json(), $catalog);
        if ($path === '/contact' && $m === 'POST') return Orders::handleContact($req, $req->json());
        if ($path === '/auth/login' && $m === 'POST') return self::login($req);
        if ($path === '/cron' && $m === 'GET') return self::cronByUrl($req);
        [$who, $blocked] = self::authenticate($req);
        if ($blocked) return $blocked;
        if ($path === '/auth/me') return $who ? new Response(['ok' => true, 'user' => $who]) : new Response(['ok' => false], 401);
        if (!$who) return new Response(['ok' => false, 'error' => 'No autorizado'], 401);
        if ($path === '/auth/logout' && $m === 'POST') {                                        // invalida TODOS los tokens anteriores de esta persona
            if (!empty($who['master'])) return new Response(['ok' => false, 'error' => 'El token maestro no tiene sesión que cerrar'], 400);
            Users::revokeSessions($who['sub']);
            return new Response(['ok' => true]);
        }
        if ($path === '/orders' && $m === 'GET') return self::orders($who);
        if (!Auth::requireRole($who, 'manager')) return new Response(['ok' => false, 'error' => 'Solo para managers'], 403);
        if ($path === '/diag' && $m === 'GET') return new Response(['ok' => true] + Diag::run(false, null, $req));                            // autodiagnóstico de la instalación (solo managers)
        if ($path === '/admin/data' && $m === 'GET') {                                          // propuestas y datos de cobertura: ya no se publican en la web, solo los ven los managers
            $d = AdminData::load();
            return new Response(['ok' => true, 'proposals' => $d['proposals'], 'admin' => $d['admin']], 200, ['Cache-Control' => 'no-store']);
        }
        if ($path === '/messages' && $m === 'GET') return self::messages($req);                                // mensajes de contacto (datos personales: solo managers)
        if (strpos($path, '/messages/') === 0 && $m === 'DELETE') return Messages::delete(rawurldecode(substr($path, 10))) ? new Response(['ok' => true]) : new Response(['ok' => false, 'error' => 'No existe ese mensaje'], 404);
        if ($path === '/mail/test' && $m === 'POST') return self::mailTest($req, $who);
        if ($path === '/mail/status' && $m === 'GET') return new Response(['ok' => true] + Mail::status());
        if ($path === '/prices/refresh' && $m === 'POST') return new Response(['ok' => true, 'meta' => Sheets::sync(['reason' => 'manual:' . $who['sub'], 'mode' => ($req->json() ?? [])['mode'] ?? null])]);
        if ($path === '/prices/upload' && $m === 'POST') {
            $b = $req->json(3000000) ?? [];
            $rows = isset($b['rows']) && is_array($b['rows']) ? $b['rows'] : (isset($b['csv']) && is_string($b['csv']) ? Sheets::parseCsv($b['csv']) : null);
            if ($rows === null) return new Response(['ok' => false, 'error' => 'Envía rows[] o csv'], 400);
            $mode = Prices::mode($b['mode'] ?? Config::get('prices.update_mode', 'merge'));
            if (!empty($b['dry_run'])) {                                                      // vista previa: nada se guarda; es el mismo plan que aplicará la subida
                $plan = Sheets::plan($rows, 'upload', $mode);
                $rep = $plan['report'];
                return new Response(['ok' => true, 'dry_run' => true, 'mode' => $plan['mode'], 'refs' => count($plan['sheet']['items']), 'total' => count($plan['next']['items']), 'kept' => $plan['kept'],
                    'needs_force' => (bool) $plan['blockers'], 'blockers' => $plan['blockers'], 'diff' => Prices::diff($plan['prev'], $plan['next']),
                    'report' => ['warnings' => $rep['warnings'], 'ignored' => array_slice($rep['ignored'], 0, 40), 'unknown' => array_slice($rep['unknown'], 0, 40), 'extras' => array_slice($rep['extras'], 0, 40), 'retire' => array_slice($rep['retire'], 0, 40), 'columns' => Util::obj($rep['columns']), 'stats' => $rep['stats']]]);
            }
            return new Response(['ok' => true, 'meta' => Sheets::sync(['rows' => $rows, 'source' => 'upload:' . $who['sub'], 'reason' => 'upload:' . $who['sub'], 'force' => ($b['force'] ?? null) === true, 'mode' => $mode])]);
        }
        if ($path === '/prices/ai' && $m === 'POST') {                                       // la IA PROPONE (no aplica); se limita porque cada llamada cuesta
            $rl = RateLimit::hit('ai', $who['sub'], 15);
            if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiadas consultas a la IA seguidas. Espera unos minutos.'], 429);
            return new Response(['ok' => true] + Ai::suggest(($req->json() ?? [])['instruction'] ?? '', $catalog));
        }
        if ($path === '/prices/ai/apply' && $m === 'POST') return new Response(['ok' => true] + Ai::apply($req->json() ?? [], $who['sub'], $catalog));      // aplica lo que la persona ha revisado y confirmado
        if ($path === '/proposals/state' && $m === 'GET') return new Response(['ok' => true, 'state' => Util::obj((array) Store::get('proposals:state'))]);
        if ($path === '/proposals/state' && $m === 'POST') {                                 // aprobar (con SU texto), rechazar o deshacer una propuesta (no publica nada por sí solo)
            $b = $req->json() ?? [];
            $id = is_string($b['id'] ?? null) ? $b['id'] : '';
            $st = is_string($b['state'] ?? null) ? $b['state'] : '';
            if (!preg_match('/^PR-\d{3,6}$/', $id) || !in_array($st, ['ok', 'no', ''], true)) return new Response(['ok' => false, 'error' => 'Propuesta o estado no válidos'], 400);
            $state = (array) Store::get('proposals:state');
            if ($st === '') unset($state[$id]);
            else {
                $e = Proposals::entry($b, $st, $who['sub']);
                if (isset($e['error'])) return Orders::badRequest($e);
                $state[$id] = $e['entry'];
            }
            Store::put('proposals:state', (object) $state);
            return new Response(['ok' => true, 'state' => Util::obj($state)]);
        }
        if ($path === '/users' && $m === 'GET') return new Response(['ok' => true, 'users' => Users::all()]);
        if ($path === '/users' && $m === 'POST') {
            $r = Users::create($req->json() ?? []);
            return isset($r['error']) ? new Response(['ok' => false, 'error' => $r['error']], $r['status'] ?? 400) : new Response(['ok' => true, 'user' => $r['user']], 201);
        }
        if (strpos($path, '/users/') === 0 && $m === 'DELETE') { Users::delete(rawurldecode(substr($path, 7))); return new Response(['ok' => true]); }
        return new Response(['ok' => false, 'error' => 'No encontrado'], 404);
    }

    /** sincroniza los precios (cron diario) y limpia lo caducado (también si la hoja se rechaza: esa limpieza no depende de la hoja) */
    public static function cron(): array
    {
        try { return Sheets::sync(['reason' => 'cron']); }
        finally { Store::purge(); }
    }
}
