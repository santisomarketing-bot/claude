<?php
/**
 * [AUTH] Contraseñas (password_hash: bcrypt/argon2 según el hosting) y sesiones firmadas HMAC-SHA256.
 * Roles: 'manager' (todo) y 'client' (solo lo suyo). Token: base64url(payload).base64url(firma); payload = {sub, iat, exp(ms), sid}; caduca a las 24 h.
 * El token NO dice qué rol tiene ni qué nombre: al verificarlo se busca a la persona y de su registro salen el rol y el nombre. Además va ligado al registro del usuario:
 *   · sid        identificador de sesión del usuario (16 bytes al azar en hex, se crea al dar de alta; los usuarios antiguos lo reciben en su siguiente acceso correcto);
 *                borrar al usuario y volver a crearlo con el mismo correo da un sid nuevo y los tokens anteriores no resucitan;
 *   · sess_after milisegundos; un token solo vale si su iat es MAYOR (POST /api/auth/logout lo pone a «ahora» e invalida todos los tokens anteriores de esa persona).
 * Un token sin sid (formato anterior) no vale: todo el mundo vuelve a iniciar sesión una vez.
 * El token maestro (config admin_token) actúa como manager para scripts y CI, no tiene sesión.
 * Secretos que fallan cerrados: session_secret ≥ 32 caracteres y sin «CAMBIA-ESTO»; admin_token ≥ 32; cron_token ≥ 24. Si no se cumplen, esa función queda desactivada.
 */
namespace Torivac;

final class Auth
{
    /** Vida de una sesión: 24 horas. */
    const TTL_MS = 86400000;
    /** Longitud mínima del secreto que firma las sesiones. */
    const MIN_SESSION_SECRET = 32;
    /** Longitud mínima del token maestro (admin_token). */
    const MIN_ADMIN_TOKEN = 32;
    /** Longitud mínima del token de la tarea programada por URL (cron_token). */
    const MIN_CRON_TOKEN = 24;
    /** Texto del secreto de ejemplo de config.sample.php: un secreto que lo contiene no vale. */
    const SAMPLE_SECRET = 'CAMBIA-ESTO';

    /** Hash señuelo ya cargado en este proceso (ver decoyHash). */
    private static $decoy = null;

    /** Hash de contraseña (bcrypt/argon2 según el hosting) para guardar en el usuario. */
    public static function hashPassword(string $pw): string { return password_hash($pw, PASSWORD_DEFAULT); }

    /** Comprueba una contraseña contra su hash; un hash vacío nunca valida. */
    public static function verifyPassword(string $pw, string $hash): bool { return $hash !== '' && password_verify($pw, $hash); }

    /**
     * Hash «señuelo» para que comprobar una contraseña de un usuario que no existe tarde lo mismo que la de uno que sí existe. Se genera en tiempo de ejecución con el coste
     * actual de PASSWORD_DEFAULT (10 en PHP ≤ 8.3, 12 en 8.4: un literal fijo dejaba de igualar tiempos) y se guarda (auth:decoy) para no recalcularlo en cada petición;
     * si el almacén no deja escribir, queda al menos en memoria durante la petición.
     */
    public static function decoyHash(): string
    {
        if (self::$decoy !== null && !password_needs_rehash(self::$decoy, PASSWORD_DEFAULT)) return self::$decoy;
        $h = Store::get('auth:decoy');
        if (!is_string($h) || $h === '' || password_needs_rehash($h, PASSWORD_DEFAULT)) {
            $h = password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
            try { Store::put('auth:decoy', $h); } catch (\Throwable $e) { /* sin escritura: se usa solo en memoria */ }
        }
        self::$decoy = $h;
        return $h;
    }

    /** Qué le pasa a un secreto de sesión: 'demasiado corto', 'sin cambiar' (lleva el texto de ejemplo) o null si vale. */
    public static function secretProblem(string $s): ?string
    {
        if (strlen($s) < self::MIN_SESSION_SECRET) return 'demasiado corto';
        if (stripos($s, self::SAMPLE_SECRET) !== false) return 'sin cambiar';
        return null;
    }

    /** El secreto de sesión de la configuración si es seguro; null si falta, es corto o es el de ejemplo (entonces no se crean ni se aceptan sesiones). */
    public static function sessionSecret(): ?string
    {
        $s = (string) Config::get('session_secret', '');
        return self::secretProblem($s) === null ? $s : null;
    }

    /** El token maestro (admin_token) si tiene 32 caracteres o más; null si está vacío o es corto (entonces no vale ninguno). */
    public static function masterToken(): ?string
    {
        $t = (string) Config::get('admin_token', '');
        return strlen($t) >= self::MIN_ADMIN_TOKEN ? $t : null;
    }

    /** El token de la tarea programada por URL (cron_token) si tiene 24 caracteres o más; null si está vacío o es corto. */
    public static function cronToken(): ?string
    {
        $t = (string) Config::get('cron_token', '');
        return strlen($t) >= self::MIN_CRON_TOKEN ? $t : null;
    }

    /** Nombres (nunca valores) de los ajustes de seguridad mal puestos: session_secret (corto, vacío o de ejemplo), admin_token y cron_token (puestos pero cortos). */
    public static function configProblems(): array
    {
        $p = [];
        if (self::sessionSecret() === null) $p[] = 'session_secret';
        if ((string) Config::get('admin_token', '') !== '' && self::masterToken() === null) $p[] = 'admin_token';
        if ((string) Config::get('cron_token', '') !== '' && self::cronToken() === null) $p[] = 'cron_token';
        return $p;
    }

    /** Firma una sesión {sub, iat, exp, sid} con HMAC-SHA256 y la devuelve como token. `$u` lleva sub (correo) y sid del usuario; el secreto debe ser seguro. */
    public static function signSession(array $u, string $secret, ?int $now = null, int $ttl = self::TTL_MS): string
    {
        if (self::secretProblem($secret) !== null) throw new \RuntimeException('session_secret no es seguro');
        if (!isset($u['sub'], $u['sid']) || !is_string($u['sub']) || !is_string($u['sid']) || $u['sid'] === '') throw new \RuntimeException('La sesión necesita sub y sid');
        $iat = $now ?? Util::nowMs();
        $payload = Util::enc(['sub' => $u['sub'], 'iat' => $iat, 'exp' => $iat + $ttl, 'sid' => $u['sid']]);
        return Util::b64url($payload) . '.' . Util::b64url(hash_hmac('sha256', $payload, $secret, true));
    }

    /** Comprueba firma, forma y caducidad de un token. @return array{sub:string,iat:int,exp:int,sid:string}|null (aún falta comprobar el usuario: ver authenticate) */
    public static function verifySession(?string $token, string $secret, ?int $now = null): ?array
    {
        if ($token === null || strlen($token) > 4096 || self::secretProblem($secret) !== null) return null;
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;
        $payload = Util::unb64url($parts[0]);
        $sig = Util::unb64url($parts[1]);
        if ($payload === '' || $sig === '' || !hash_equals(hash_hmac('sha256', $payload, $secret, true), $sig)) return null;
        $p = json_decode($payload, true, 8);
        if (!is_array($p) || !is_string($p['sub'] ?? null) || !is_string($p['sid'] ?? null) || $p['sid'] === '' || !is_int($p['iat'] ?? null) || !is_int($p['exp'] ?? null)) return null;
        if (($now ?? Util::nowMs()) > $p['exp']) return null;
        return ['sub' => $p['sub'], 'iat' => $p['iat'], 'exp' => $p['exp'], 'sid' => $p['sid']];
    }

    /**
     * quién llama: ['role','sub','name','master'?] o null. Con un token de sesión: la firma es buena, no ha caducado, la persona existe, su sid coincide con el del token y el token
     * se emitió DESPUÉS de su último cierre de sesión (sess_after); el rol y el nombre salen del registro de la persona, no del token.
     */
    public static function authenticate(Request $req): ?array
    {
        $t = $req->bearer();
        if ($t === null) return null;
        $master = self::masterToken();
        if ($master !== null && Util::secretEq($master, $t)) return ['role' => 'manager', 'sub' => 'master', 'name' => 'master', 'master' => true];
        $secret = self::sessionSecret();
        if ($secret === null) return null;
        $s = self::verifySession($t, $secret);
        if (!$s) return null;
        $u = Users::find($s['sub']);
        if (!is_array($u) || !isset($u['sid']) || !is_string($u['sid']) || $u['sid'] === '' || !hash_equals($u['sid'], $s['sid'])) return null;
        if ($s['iat'] <= (int) ($u['sess_after'] ?? 0)) return null;
        if (!in_array($u['role'] ?? '', ['manager', 'client'], true)) return null;
        return ['sub' => (string) $u['email'], 'role' => $u['role'], 'name' => (string) ($u['name'] ?? $u['email'])];
    }

    /** Dice si la sesión existe y su rol es uno de los permitidos. */
    public static function requireRole(?array $who, string ...$roles): bool { return $who !== null && in_array($who['role'], $roles, true); }
}

/** [USERS] Usuarios en el almacén (clave user:<email>); nunca se devuelve ni se guarda la contraseña en claro, y sid / sess_after no salen al navegador */
final class Users
{
    /** Longitud mínima de una contraseña NUEVA (las de usuarios ya creados no se tocan). */
    const MIN_PASSWORD = 12;
    /** Contraseñas más largas se rechazan (bcrypt solo usa los primeros 72 bytes; evita enviar megabytes). */
    const MAX_PASSWORD = 1000;
    /** Una contraseña nueva no puede EMPEZAR por ninguna de estas (comparadas en minúsculas y sin signos): las más repetidas y el nombre de la empresa. */
    private const TRIVIAL = ['password', 'passw0rd', 'contrasena', '123456', 'qwerty', 'azerty', 'abc123', 'torivac', 'admin', 'letmein', 'welcome', 'iloveyou', 'changeme', 'cambiame', 'secreto', 'bienvenid'];

    /** Letras con acento (ya en minúscula) → su letra sin acento, para comparar contraseñas («Contraseña…» cuenta como «contrasena…»). */
    private const FOLD = ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'å' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o', 'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ñ' => 'n', 'ç' => 'c', 'ß' => 'ss'];

    /** Minúsculas, sin acentos y solo letras y cifras: «Torivac-Manager-2026» → «torivacmanager2026». */
    private static function flat(string $s): string { return (string) preg_replace('/[^a-z0-9]+/', '', strtr(mb_strtolower($s, 'UTF-8'), self::FOLD)); }

    /** Clave del almacén de un usuario: user:<correo en minúsculas>. */
    private static function key(string $email): string { return 'user:' . strtolower(trim($email)); }

    /** Usuario sin el hash de la contraseña ni los datos de sesión (lo que puede salir al navegador). */
    private static function pub(array $u): array { return ['email' => $u['email'], 'name' => $u['name'], 'role' => $u['role'], 'created' => $u['created']]; }

    /**
     * Por qué NO vale una contraseña nueva (texto para mostrar) o null si vale: mínimo 12 caracteres, que no contenga la parte local del correo (si tiene 3 o más letras y cifras),
     * que no empiece por una contraseña trivial («password…», «123456…», «torivac…», «qwerty…»…) ni tenga menos de 5 caracteres distintos.
     */
    public static function passwordProblem(string $pw, string $email = ''): ?string
    {
        if (strlen($pw) > self::MAX_PASSWORD) return 'La contraseña es demasiado larga (máx. ' . self::MAX_PASSWORD . ' caracteres)';
        if (mb_strlen($pw, 'UTF-8') < self::MIN_PASSWORD) return 'La contraseña necesita al menos ' . self::MIN_PASSWORD . ' caracteres';
        $n = self::flat($pw);
        $local = strtolower((string) strtok(trim($email), '@'));
        foreach (array_unique([$local, (string) strtok($local, '+')]) as $l) {
            $l = self::flat($l);
            if (strlen($l) >= 3 && strpos($n, $l) !== false) return 'La contraseña no puede contener tu correo';
        }
        foreach (self::TRIVIAL as $t) { if (strpos($n, $t) === 0) return 'Esa contraseña es demasiado fácil de adivinar'; }
        if (count(array_unique(str_split($pw))) < 5) return 'Esa contraseña es demasiado fácil de adivinar';
        return null;
    }

    /** @return array{user?:array,error?:string,status?:int} */
    public static function create(array $in): array
    {
        $email = $in['email'] ?? '';
        if (!is_string($email)) return ['error' => 'Correo no válido'];
        $email = strtolower(trim($email));
        if (!Orders::validEmail($email)) return ['error' => 'Correo no válido'];
        $role = $in['role'] ?? '';
        if (!in_array($role, ['manager', 'client'], true)) return ['error' => 'Rol no válido'];
        $pw = $in['password'] ?? '';
        if (!is_string($pw)) return ['error' => 'Contraseña no válida'];
        $name = $in['name'] ?? $email;
        if (!is_string($name)) return ['error' => 'Nombre no válido'];
        $bad = self::passwordProblem($pw, $email);
        if ($bad !== null) return ['error' => $bad];
        $u = ['email' => $email, 'name' => Util::line($name, 80) ?: $email, 'role' => $role, 'hash' => Auth::hashPassword($pw), 'created' => Util::iso(), 'sid' => bin2hex(random_bytes(16)), 'sess_after' => 0];
        $r = Store::locked('users', function () use ($email, $u) {
            if (Store::get(self::key($email)) !== null) return ['error' => 'Ya existe un usuario con ese correo', 'status' => 409];
            Store::put(self::key($email), $u);
            return ['user' => self::pub($u)];
        });
        if (isset($r['user'])) Auth::decoyHash();                                           // deja listo el hash señuelo (cálculo lento) para que ningún acceso lo pague
        return $r;
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

    /** Registro completo de un usuario (con hash, sid y sess_after: solo para uso interno), o null. */
    public static function find(string $email): ?array
    {
        $u = Store::get(self::key($email));
        return is_array($u) ? $u : null;
    }

    /** Borra un usuario por su correo (si se vuelve a crear tendrá otro sid: sus tokens anteriores no resucitan). */
    public static function delete(string $email): void
    {
        Store::locked('users', function () use ($email) { Store::delete(self::key($email)); });
    }

    /** Invalida TODOS los tokens emitidos hasta ahora para ese usuario (sess_after = ahora). Devuelve false si el usuario no existe. */
    public static function revokeSessions(string $email): bool
    {
        return (bool) Store::locked('users', function () use ($email) {
            $u = Store::get(self::key($email));
            if (!is_array($u)) return false;
            $u['sess_after'] = Util::nowMs();
            Store::put(self::key($email), $u);
            return true;
        });
    }

    /**
     * Comprueba credenciales (mismo coste si el usuario no existe: no se puede enumerar usuarios por tiempo). Si valen, devuelve el usuario público y su sid para firmar la sesión;
     * un usuario antiguo sin sid lo recibe aquí, y un hash con un coste anterior al actual se renueva.
     * @return array{user:array,sid:string}|null
     */
    public static function login(string $email, string $password): ?array
    {
        $u = Store::get(self::key($email));
        $rec = is_array($u) && isset($u['hash']) && is_string($u['hash']) ? $u : null;
        $ok = Auth::verifyPassword(substr($password, 0, self::MAX_PASSWORD), $rec !== null ? $rec['hash'] : Auth::decoyHash());
        if ($rec === null || !$ok) return null;
        $rec = self::upgrade($rec, $password);
        return $rec === null ? null : ['user' => self::pub($rec), 'sid' => $rec['sid']];
    }

    /** comprueba credenciales y devuelve el usuario público (sin sid), o null */
    public static function check(string $email, string $password): ?array
    {
        $r = self::login($email, $password);
        return $r === null ? null : $r['user'];
    }

    /** Pone al día el registro tras un acceso correcto: sid si no lo tenía y hash nuevo si el coste de PASSWORD_DEFAULT subió. Devuelve el registro, o null si lo borraron entre medias. */
    private static function upgrade(array $rec, string $password): ?array
    {
        $needsHash = password_needs_rehash($rec['hash'], PASSWORD_DEFAULT);
        if (!$needsHash && isset($rec['sid']) && is_string($rec['sid']) && $rec['sid'] !== '') return $rec;
        $newHash = $needsHash ? Auth::hashPassword($password) : null;                       // fuera del bloqueo: es lento
        return Store::locked('users', function () use ($rec, $newHash) {
            $cur = Store::get(self::key($rec['email']));
            if (!is_array($cur)) return null;
            if (!isset($cur['sid']) || !is_string($cur['sid']) || $cur['sid'] === '') $cur['sid'] = bin2hex(random_bytes(16));
            if (!isset($cur['sess_after'])) $cur['sess_after'] = 0;
            if ($newHash !== null && ($cur['hash'] ?? '') === $rec['hash']) $cur['hash'] = $newHash;
            Store::put(self::key($rec['email']), $cur);
            return $cur;
        });
    }
}
