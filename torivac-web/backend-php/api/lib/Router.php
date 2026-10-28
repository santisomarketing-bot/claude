<?php
/**
 * [ROUTER] Rutas del API (equivalentes a workers/api/src/index.js: la web usa el mismo contrato con el Worker o con este PHP).
 *   PÚBLICO   GET /api/health · GET /api/prices · POST /api/order · POST /api/contact · POST /api/auth/login
 *   USUARIO   GET /api/auth/me · GET /api/orders (manager: todos; cliente: solo los suyos)
 *   MANAGER   GET /api/diag · POST /api/prices/refresh · POST /api/prices/upload · POST /api/prices/ai (propone) · POST /api/prices/ai/apply (aplica)
 *             GET|POST /api/proposals/state · GET|POST|DELETE /api/users
 *   CRON      GET /api/cron?token=… (alternativa a `php cron.php` si el hosting no deja programar por línea de comandos)
 */
namespace Torivac;

final class Router
{
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
            $r->headers += $cors;
            return $r;
        } catch (\InvalidArgumentException $e) {                                              // hoja o petición mal formada: error de quien la envía
            return new Response(['ok' => false, 'error' => $e->getMessage()], 400, $cors);
        } catch (\Throwable $e) {
            $code = $e instanceof \RuntimeException && $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            if ($code === 500) error_log('torivac-api: ' . $e->getMessage() . ' en ' . basename($e->getFile()) . ':' . $e->getLine());
            return new Response(['ok' => false, 'error' => $e->getMessage() ?: 'Error interno'], $code, $cors);
        }
    }

    /** Tabla de rutas: públicas, de usuario autenticado y de manager (ver la lista de la cabecera). */
    private static function route(Request $req, ?array $catalog): Response
    {
        $path = $req->path;
        $m = $req->method;
        if ($path === '/health') return new Response(['ok' => true, 'time' => Util::iso()]);
        if ($path === '/prices' && $m === 'GET') {
            $prices = Prices::load();
            $meta = Store::get(Prices::KEY_META);
            $me = $req->bearer() !== null ? Auth::authenticate($req) : null;                   // un manager ve quién cargó la hoja y de dónde; el público, no
            if ($me && $me['role'] === 'manager') return new Response(['prices' => Prices::forJson($prices), 'meta' => $meta], 200, ['Cache-Control' => 'private, no-store', 'Vary' => 'Authorization']);
            $pub = Prices::publicView($prices, $meta);
            $body = ['prices' => Prices::forJson($pub['prices']), 'meta' => $pub['meta']];
            $etag = '"' . md5(Util::enc($body)) . '"';
            $h = ['Cache-Control' => 'public, max-age=300', 'ETag' => $etag, 'Vary' => 'Authorization'];
            if ($req->header('if-none-match') === $etag) return new Response([], 304, $h);
            return new Response($body, 200, $h);
        }
        if ($path === '/order' && $m === 'POST') return Orders::handleOrder($req, $req->json(), $catalog);
        if ($path === '/contact' && $m === 'POST') return Orders::handleContact($req, $req->json());
        if ($path === '/auth/login' && $m === 'POST') {
            $b = $req->json() ?? [];
            $email = strtolower(trim((string) ($b['email'] ?? '')));
            $rl = RateLimit::hit('login', $req->ip . ':' . $email, 6);
            if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados intentos. Espera unos minutos.'], 429);
            $u = Users::check($email, (string) ($b['password'] ?? ''));
            if (!$u) return new Response(['ok' => false, 'error' => 'Credenciales incorrectas'], 401);
            return new Response(['ok' => true, 'token' => Auth::signSession(['sub' => $u['email'], 'role' => $u['role'], 'name' => $u['name']], (string) Config::get('session_secret', '')), 'user' => $u]);
        }
        if ($path === '/cron' && $m === 'GET') {
            $tok = (string) Config::get('cron_token', '');
            if ($tok === '' || !hash_equals($tok, (string) ($req->query['token'] ?? ''))) return new Response(['ok' => false, 'error' => 'No autorizado'], 401);
            return new Response(['ok' => true, 'meta' => self::cron()]);
        }
        $who = Auth::authenticate($req);
        if ($path === '/auth/me') return $who ? new Response(['ok' => true, 'user' => $who]) : new Response(['ok' => false], 401);
        if (!$who) return new Response(['ok' => false, 'error' => 'No autorizado'], 401);
        if ($path === '/orders' && $m === 'GET') {
            $out = [];
            foreach (Store::keys('order:') as $k) {
                $o = Store::get($k);
                if (is_array($o) && ($who['role'] === 'manager' || ($o['customer']['email'] ?? '') === $who['sub'])) $out[] = $o;
            }
            usort($out, function ($a, $b) { return strcmp($b['at'], $a['at']); });
            return new Response(['ok' => true, 'orders' => $out]);
        }
        if (!Auth::requireRole($who, 'manager')) return new Response(['ok' => false, 'error' => 'Solo para managers'], 403);
        if ($path === '/diag' && $m === 'GET') return new Response(['ok' => true] + Diag::run(false, null, $req));                            // autodiagnóstico de la instalación (solo managers)
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
            try { return new Response(['ok' => true] + Ai::suggest(($req->json() ?? [])['instruction'] ?? '', $catalog)); }
            catch (\RuntimeException $e) { return new Response(['ok' => false, 'error' => $e->getMessage()], $e->getCode() ?: 500); }
        }
        if ($path === '/prices/ai/apply' && $m === 'POST') {                                 // aplica lo que la persona ha revisado y confirmado
            try { return new Response(['ok' => true] + Ai::apply($req->json() ?? [], $who['sub'], $catalog)); }
            catch (\RuntimeException $e) { return new Response(['ok' => false, 'error' => $e->getMessage()], $e->getCode() ?: 500); }
        }
        if ($path === '/proposals/state' && $m === 'GET') return new Response(['ok' => true, 'state' => Util::obj((array) Store::get('proposals:state'))]);
        if ($path === '/proposals/state' && $m === 'POST') {                                 // aprobar / rechazar / deshacer una propuesta (no publica nada por sí solo)
            $b = $req->json() ?? [];
            $id = (string) ($b['id'] ?? '');
            $st = (string) ($b['state'] ?? '');
            if (!preg_match('/^PR-\d{3,6}$/', $id) || !in_array($st, ['ok', 'no', ''], true)) return new Response(['ok' => false, 'error' => 'Propuesta o estado no válidos'], 400);
            $state = (array) Store::get('proposals:state');
            if ($st !== '') $state[$id] = ['state' => $st, 'by' => $who['sub'], 'at' => Util::iso()]; else unset($state[$id]);
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

    /** sincroniza los precios (cron diario) y limpia lo caducado */
    public static function cron(): array
    {
        $meta = Sheets::sync(['reason' => 'cron']);
        Store::purge();
        return $meta;
    }
}
