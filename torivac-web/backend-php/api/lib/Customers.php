<?php
/**
 * [CUSTOMERS] Cuentas de cliente (rol `customer`) que gestionan María y Xavi (rol `client`, «Propietario» en el panel) y los managers. Contrato único con workers/api: docs/PRECIOS-Y-CLIENTES.md §5.1.
 *   GET    /api/customers                    → { ok, customers:[{ email, name, tier, created, last_login? }], tiers:{ vip:{label,pct}, vip5:…, vip10:…, normal:… } }
 *   POST   /api/customers                    { email, name, password, tier } → 201 { ok, customer } · correo ya existente 409 · categoría o datos no válidos 400
 *   PUT    /api/customers/:correo            { tier?, name? } → { ok, customer } · solo cuentas `customer`: otro rol o inexistente 404
 *   POST   /api/customers/:correo/password   { password } → { ok } (mismas reglas que /users; cierra sus sesiones)
 *   DELETE /api/customers/:correo            → { ok } (cierra sus sesiones; NO borra sus presupuestos)
 * Solo las atiende Router tras comprobar que quien llama es `manager` o `client`. Actividad: customer.create · customer.tier (correo → categoría) · customer.password · customer.delete.
 * [SEGURIDAD] Nunca se toca una cuenta de otro rol (un propietario no puede cambiar la contraseña de un manager por aquí); las contraseñas siguen la política de Users::passwordProblem y nunca se anotan.
 */
namespace Torivac;

final class Customers
{
    /** Ruta de una cuenta: /customers/<correo> y, opcional, /password. El correo viene codificado en la URL. */
    const ROUTE = '#^/customers/([^/]+?)(/password)?$#D';
    /** Tamaño máximo del cuerpo de las peticiones de clientes (bytes). */
    const MAX_BODY = 10000;

    /** El 404 de una cuenta que no existe o no es de cliente. */
    private static function missing(): Response { return new Response(['ok' => false, 'error' => 'No existe ese cliente'], 404); }

    /** Una cuenta de cliente tal como sale al panel: { email, name, tier, created, last_login? } (sin rol, hash ni datos de sesión). Vale tanto un registro completo como Users::pub. */
    public static function view(array $u): array
    {
        return ['email' => $u['email'], 'name' => $u['name'], 'tier' => Pricing::tierOf($u['tier'] ?? null), 'created' => $u['created']] + (is_string($u['last_login'] ?? null) ? ['last_login' => $u['last_login']] : []);
    }

    /** Lee el cuerpo JSON (objeto): [objeto, null] o [null, respuesta 400/413]. */
    private static function body(Request $req): array
    {
        if (strlen($req->body) > self::MAX_BODY) return [null, new Response(['ok' => false, 'error' => 'La petición es demasiado grande'], 413)];
        $b = $req->json(self::MAX_BODY);
        if ($b === null || ($b && Util::isList($b))) return [null, new Response(['ok' => false, 'error' => 'Petición no válida'], 400)];
        return [$b, null];
    }

    /** Atiende cualquier ruta /customers… de una persona ya autenticada como manager o client (Router lo comprueba); el resto de roles recibe 403. */
    public static function handle(Request $req, array $who): Response
    {
        if (!Auth::requireRole($who, 'manager', 'client')) return new Response(['ok' => false, 'error' => 'No autorizado'], 403);
        $path = $req->path;
        $m = $req->method;
        if ($path === '/customers' && $m === 'GET') return self::index();
        if ($path === '/customers' && $m === 'POST') return self::create($req, $who);
        if (preg_match(self::ROUTE, $path, $x) === 1) {
            $email = strtolower(trim(rawurldecode($x[1])));
            $pw = ($x[2] ?? '') === '/password';
            if ($pw && $m === 'POST') return self::password($req, $who, $email);
            if (!$pw && $m === 'PUT') return self::update($req, $who, $email);
            if (!$pw && $m === 'DELETE') return self::delete($req, $who, $email);
        }
        return new Response(['ok' => false, 'error' => 'No encontrado'], 404);
    }

    /** GET /customers: todas las cuentas de cliente y las cuatro categorías con su porcentaje actual. */
    private static function index(): Response
    {
        return new Response(['ok' => true, 'customers' => array_map([self::class, 'view'], Users::customers()), 'tiers' => Pricing::tiersView(Pricing::load())], 200, ['Cache-Control' => 'private, no-store']);
    }

    /** POST /customers { email, name, password, tier }: crea la cuenta (mismas validaciones que POST /users) → 201 { ok, customer }; 409 si el correo ya existe; categoría inválida 400. */
    private static function create(Request $req, array $who): Response
    {
        [$b, $err] = self::body($req);
        if ($err !== null) return $err;
        $r = Users::create(['email' => $b['email'] ?? '', 'name' => $b['name'] ?? ($b['email'] ?? ''), 'password' => $b['password'] ?? '', 'tier' => $b['tier'] ?? null, 'role' => 'customer']);
        if (isset($r['error'])) return new Response(['ok' => false, 'error' => $r['error']], $r['status'] ?? 400);
        $c = self::view($r['user']);
        Audit::log('customer.create', $who, $req, Util::line($c['email'], 120) . ' (' . $c['tier'] . ')');
        return new Response(['ok' => true, 'customer' => $c], 201);
    }

    /** PUT /customers/:correo { tier?, name? }: cambia la categoría y/o el nombre de una cuenta de cliente. 404 antes que 400; sin ninguno de los dos, 400. La categoría vale al instante en su siguiente petición. */
    private static function update(Request $req, array $who, string $email): Response
    {
        $u = Users::find($email);
        if ($u === null || ($u['role'] ?? '') !== 'customer') return self::missing();
        [$b, $err] = self::body($req);
        if ($err !== null) return $err;
        $changes = [];
        if (array_key_exists('tier', $b)) {
            if (!Pricing::isTier($b['tier'])) return new Response(['ok' => false, 'error' => 'Categoría no válida'], 400);
            $changes['tier'] = $b['tier'];
        }
        if (array_key_exists('name', $b)) {
            $name = is_string($b['name']) ? Util::line($b['name'], 80) : '';
            if ($name === '') return new Response(['ok' => false, 'error' => 'Nombre no válido'], 400);
            $changes['name'] = $name;
        }
        if (!$changes) return new Response(['ok' => false, 'error' => 'Indica la categoría o el nombre'], 400);
        $before = Pricing::tierOf($u['tier'] ?? null);
        $new = Users::editCustomer($email, $changes);
        if ($new === null) return self::missing();                                              // la borraron entre medias
        if (isset($changes['tier']) && $changes['tier'] !== $before) Audit::log('customer.tier', $who, $req, Util::line($email, 120) . ' → ' . $changes['tier']);
        return new Response(['ok' => true, 'customer' => self::view($new)]);
    }

    /** POST /customers/:correo/password { password }: contraseña nueva con las reglas de siempre; cierra todas sus sesiones y olvida sus dispositivos. Solo cuentas de cliente (404 si no). */
    private static function password(Request $req, array $who, string $email): Response
    {
        $u = Users::find($email);
        if ($u === null || ($u['role'] ?? '') !== 'customer') return self::missing();
        [$b, $err] = self::body($req);
        if ($err !== null) return $err;
        $r = Users::setPassword($email, is_string($b['password'] ?? null) ? $b['password'] : '');
        if (isset($r['error'])) return new Response(['ok' => false, 'error' => $r['error']], $r['status'] ?? 400);
        Audit::log('customer.password', $who, $req, Util::line($email, 120));
        return new Response(['ok' => true]);
    }

    /** DELETE /customers/:correo: borra la cuenta de cliente (sus sesiones dejan de valer al instante); sus presupuestos NO se borran. Solo cuentas de cliente (404 si no). */
    private static function delete(Request $req, array $who, string $email): Response
    {
        $u = Users::find($email);
        if ($u === null || ($u['role'] ?? '') !== 'customer') return self::missing();
        Users::delete($email);
        Audit::log('customer.delete', $who, $req, Util::line($email, 120));
        return new Response(['ok' => true]);
    }
}
