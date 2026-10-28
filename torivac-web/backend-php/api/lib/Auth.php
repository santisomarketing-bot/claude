<?php
/**
 * [AUTH] Contraseñas (password_hash: bcrypt/argon2 según el hosting) y sesiones firmadas HMAC-SHA256 sin estado en servidor.
 * Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma); payload = {sub, role, name, exp(ms)}; caduca a los 7 días.
 * El token maestro (config admin_token) actúa como manager para scripts y CI.
 */
namespace Torivac;

final class Auth
{
    const TTL_MS = 604800000;

    /** Hash de contraseña (bcrypt/argon2 según el hosting) para guardar en el usuario. */
    public static function hashPassword(string $pw): string { return password_hash($pw, PASSWORD_DEFAULT); }

    /** Comprueba una contraseña contra su hash; un hash vacío nunca valida. */
    public static function verifyPassword(string $pw, string $hash): bool { return $hash !== '' && password_verify($pw, $hash); }

    /** Firma una sesión {sub, role, name, exp} con HMAC-SHA256 y la devuelve como token. */
    public static function signSession(array $u, string $secret, ?int $now = null, int $ttl = self::TTL_MS): string
    {
        $payload = Util::enc(['sub' => $u['sub'], 'role' => $u['role'], 'name' => $u['name'] ?? $u['sub'], 'exp' => ($now ?? Util::nowMs()) + $ttl]);
        return Util::b64url($payload) . '.' . Util::b64url(hash_hmac('sha256', $payload, $secret, true));
    }

    /** @return array{sub:string,role:string,name:string}|null */
    public static function verifySession(?string $token, string $secret, ?int $now = null): ?array
    {
        $parts = explode('.', (string) $token);
        if (count($parts) !== 2 || $secret === '') return null;
        $payload = Util::unb64url($parts[0]);
        $sig = Util::unb64url($parts[1]);
        if ($payload === '' || $sig === '' || !hash_equals(hash_hmac('sha256', $payload, $secret, true), $sig)) return null;
        $p = json_decode($payload, true);
        if (!is_array($p) || !isset($p['exp']) || ($now ?? Util::nowMs()) > $p['exp'] || !in_array($p['role'] ?? '', ['manager', 'client'], true) || !is_string($p['sub'] ?? null)) return null;
        return ['sub' => $p['sub'], 'role' => $p['role'], 'name' => $p['name'] ?? $p['sub']];
    }

    /** quién llama: ['role','sub','name','master'?] o null */
    public static function authenticate(Request $req): ?array
    {
        $t = $req->bearer();
        if ($t === null) return null;
        $master = (string) Config::get('admin_token', '');
        if ($master !== '' && hash_equals($master, $t)) return ['role' => 'manager', 'sub' => 'master', 'name' => 'master', 'master' => true];
        $s = self::verifySession($t, (string) Config::get('session_secret', ''));
        return ($s && Users::exists($s['sub'])) ? $s : null;                  // las sesiones no tienen estado: un usuario borrado pierde el acceso al instante
    }

    /** Dice si la sesión existe y su rol es uno de los permitidos. */
    public static function requireRole(?array $who, string ...$roles): bool { return $who !== null && in_array($who['role'], $roles, true); }
}

/** [USERS] Usuarios en el almacén (clave user:<email>); nunca se devuelve ni se guarda la contraseña en claro */
final class Users
{
    /** Clave del almacén de un usuario: user:<correo en minúsculas>. */
    private static function key(string $email): string { return 'user:' . strtolower(trim($email)); }

    /** Usuario sin el hash de la contraseña (lo que puede salir al navegador). */
    private static function pub(array $u): array { return ['email' => $u['email'], 'name' => $u['name'], 'role' => $u['role'], 'created' => $u['created']]; }

    /** @return array{user?:array,error?:string,status?:int} */
    public static function create(array $in): array
    {
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $email)) return ['error' => 'Correo no válido'];
        $role = $in['role'] ?? '';
        if (!in_array($role, ['manager', 'client'], true)) return ['error' => 'Rol no válido'];
        $pw = (string) ($in['password'] ?? '');
        if (strlen($pw) < 10) return ['error' => 'La contraseña necesita al menos 10 caracteres'];
        if (Store::get(self::key($email)) !== null) return ['error' => 'Ya existe un usuario con ese correo', 'status' => 409];
        $u = ['email' => $email, 'name' => Util::clean($in['name'] ?? $email, 80) ?: $email, 'role' => $role, 'hash' => Auth::hashPassword($pw), 'created' => Util::iso()];
        Store::put(self::key($email), $u);
        return ['user' => self::pub($u)];
    }

    /** Lista de todos los usuarios sin hash, ordenados por correo. */
    public static function all(): array
    {
        $out = [];
        foreach (Store::keys('user:') as $k) { $u = Store::get($k); if (is_array($u)) $out[] = self::pub($u); }
        return $out;
    }

    /** ¿Existe ese usuario? */
    public static function exists(string $email): bool { return Store::get(self::key($email)) !== null; }

    /** Borra un usuario por su correo. */
    public static function delete(string $email): void { Store::delete(self::key($email)); }

    /** comprueba credenciales (mismo coste si el usuario no existe: no se puede enumerar usuarios por tiempo) */
    public static function check(string $email, string $password): ?array
    {
        $u = Store::get(self::key($email));
        $dummy = '$2y$10$abcdefghijklmnopqrstuuIAKn3.x6Aid2f1l6TqV9z6c5nX5dB5uK';
        $ok = Auth::verifyPassword($password, is_array($u) ? (string) $u['hash'] : $dummy);
        return is_array($u) && $ok ? self::pub($u) : null;
    }
}
