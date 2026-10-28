<?php
/**
 * [SECURITY] Medidas de acceso que van más allá de la contraseña y del bloqueo de una hora:
 *   · VERIFICACIÓN EN DOS PASOS POR CORREO. Un manager que escribe bien su contraseña recibe un código de 6 cifras en su correo (vale 10 minutos y 5 intentos) y lo escribe para entrar.
 *     Si marca «recordar este dispositivo», una cookie firmada (HttpOnly, 30 días) evita volver a pedirlo en ese navegador. Quedan fuera las cuentas de confianza (casilla «sin código» en
 *     Usuarios o `two_step.exempt` en config.php) y todo el sistema si `two_step.enabled` es false. Solo se pide si el correo puede salir (Mail::enabled): sin él, nadie se queda fuera.
 *   · ATAQUES REPETIDOS. Sin avisos de rutina: solo cuando una cuenta acumula 3 bloqueos en 24 horas (o el bloqueo por cuenta, que indica un ataque repartido entre muchas direcciones)
 *     se envía UN aviso por correo (como mucho uno al día por cuenta) y, durante 7 días, esa cuenta pide el código por correo en los dispositivos nuevos. Las cuentas de confianza solo reciben el aviso.
 *   · DESBLOQUEO. Otro manager puede quitar el bloqueo de una cuenta (y los contadores de fallos) desde el panel: se guarda qué visitantes fallaron contra esa cuenta (lgidx:) para poder limpiarlos.
 *   · CONTRASEÑA. Cambiar la propia (pide la actual) y que un manager ponga una nueva a otra persona: ambos cierran sesiones y olvidan los dispositivos recordados.
 * Todo lo que guarda es mínimo y caduca: el código (hash HMAC con session_secret, nunca en claro) en pin:<id>, los contadores en rl:…, el índice de visitantes en lgidx:… (2 h).
 * Ajustes (config.php): two_step.enabled · two_step.remember_days · two_step.exempt · two_step.on_attack · alert_to (quién recibe el aviso; por defecto, order_to).
 *
 *   Security::codeReason(usuario) · deviceTrusted(petición, usuario) · issueDevice(usuario) · startChallenge(usuario, petición, motivo) · verify(id, código, petición) · resend(id, petición)
 *   Security::lockoutHappened(correo, petición, peso) · lockLeft(correo) · unlock(correo) · noteAttempt(correo, visitante) · forgetDevices(correo)
 */
namespace Torivac;

final class Security
{
    /** Segundos que vale un código. */
    const PIN_TTL = 600;
    /** Intentos de un mismo código antes de anularlo. */
    const PIN_TRIES = 5;
    /** Envíos de código por intento de acceso (el primero y dos reenvíos). */
    const PIN_SENDS = 3;
    /** Milisegundos mínimos entre dos envíos del código. */
    const PIN_RESEND_WAIT_MS = 45000;
    /** Códigos que se envían a una cuenta por hora. */
    const PIN_SENDS_PER_HOUR = 6;
    /** Códigos erróneos de un visitante contra una cuenta antes de bloquear esa pareja una hora. */
    const PIN_PAIR_FAILS = 5;
    /** Códigos erróneos contra una cuenta, de cualquier visitante, antes de bloquearla una hora. */
    const PIN_ACCOUNT_FAILS = 20;
    /** Duración de los bloqueos de código: 1 hora. */
    const LOCK_MS = 3600000;
    /** Bloqueos de una cuenta en la ventana de arriba que se consideran «ataque repetido». */
    const ATTACK_LOCKS = 3;
    /** Ventana en la que se cuentan los bloqueos: 24 horas. */
    const ATTACK_WINDOW_MS = 86400000;
    /** Cuánto dura la protección reforzada tras un ataque repetido: 7 días. */
    const ATTACK_MS = 604800000;

    // ───────────────────────────────────────── [AJUSTES]
    /** Un ajuste booleano de config.php o de una variable de entorno (que llega como texto: «false», «off», «0», «no» = no). */
    private static function flag($v, bool $default): bool
    {
        if ($v === null || $v === '') return $default;
        if (is_string($v)) return !in_array(strtolower(trim($v)), ['false', 'off', '0', 'no', 'n'], true);
        return (bool) $v;
    }

    /** ¿Está activa la verificación por correo para los managers? (config two_step.enabled; sí por defecto). */
    public static function twoStepEnabled(): bool { return self::flag(Config::get('two_step.enabled', true), true); }

    /** ¿Se refuerza una cuenta tras ataques repetidos? (config two_step.on_attack; sí por defecto). */
    public static function attackProtection(): bool { return self::flag(Config::get('two_step.on_attack', true), true); }

    /** Días que se recuerda un dispositivo tras dar el código (config two_step.remember_days; 30 por defecto, de 1 a 90; 0 = no se ofrece recordar). */
    public static function rememberDays(): int
    {
        $v = Config::get('two_step.remember_days', 30);
        return is_numeric($v) ? max(0, min(90, (int) $v)) : 30;
    }

    /** Correos que nunca piden código (config two_step.exempt: lista o texto separado por comas), en minúsculas. */
    public static function exemptList(): array
    {
        $v = Config::get('two_step.exempt', []);
        $list = is_string($v) ? explode(',', $v) : (array) $v;
        return array_values(array_filter(array_map(function ($e) { return strtolower(trim((string) $e)); }, $list), function ($e) { return $e !== ''; }));
    }

    /** Quién recibe el aviso de ataques repetidos: config alert_to (lista o texto separado por comas, solo correos válidos) o, si está vacío, los destinatarios de los pedidos (order_to). */
    public static function alertRecipients(): array
    {
        $v = Config::get('alert_to', []);
        $list = is_string($v) ? explode(',', $v) : (array) $v;
        $ok = array_values(array_filter(array_map(function ($e) { return strtolower(trim((string) $e)); }, $list), function ($e) { return $e !== '' && Orders::validEmail($e); }));
        return $ok ?: Orders::team();
    }

    // ───────────────────────────────────────── [QUIÉN PIDE CÓDIGO]
    /** ¿Es una cuenta de confianza? Con la casilla «sin código» (two_step = false) o en la lista two_step.exempt. */
    public static function isExempt(array $u): bool
    {
        return ($u['two_step'] ?? null) === false || in_array(strtolower((string) ($u['email'] ?? '')), self::exemptList(), true);
    }

    /** Estado para mostrar de un usuario: 'required' (pide código al entrar), 'exempt' (cuenta de confianza), 'off' (la verificación está desactivada en el servidor) o 'n/a' (clientes: solo la piden tras ataques). */
    public static function codeStatus(array $u): string
    {
        if (($u['role'] ?? '') !== 'manager') return 'n/a';
        if (!self::twoStepEnabled()) return 'off';
        return self::isExempt($u) ? 'exempt' : 'required';
    }

    /** ¿Está esa cuenta en protección reforzada (ataques repetidos recientes)? */
    public static function underAttack(array $u, ?int $nowMs = null): bool { return (int) ($u['atk_until'] ?? 0) > ($nowMs ?? Util::nowMs()); }

    /**
     * Por qué hay que pedir código a esta persona al entrar, o null si no: 'two_step' (manager con verificación activa) o 'attack' (protección reforzada tras ataques repetidos).
     * Sin correo capaz de enviar no se pide nunca (nadie se queda fuera) y una cuenta de confianza nunca lo pide.
     */
    public static function codeReason(array $u, ?int $nowMs = null): ?string
    {
        if (!Mail::enabled() || self::isExempt($u)) return null;
        if (($u['role'] ?? '') === 'manager' && self::twoStepEnabled()) return 'two_step';
        if (self::attackProtection() && self::underAttack($u, $nowMs)) return 'attack';
        return null;
    }

    // ───────────────────────────────────────── [DISPOSITIVOS DE CONFIANZA]
    /** Nombre de la cookie del dispositivo de una cuenta: una por cuenta (un ordenador compartido entre dos managers no mezcla sus dispositivos). */
    public static function deviceCookieName(string $email): string { return 'tv_dev_' . substr(hash('sha256', strtolower($email)), 0, 10); }

    /** Firma de un dispositivo: ligada al identificador de sesión del usuario (si se borra y se vuelve a crear, no vale), a su época de dispositivos (olvidarlos los invalida) y a la caducidad. */
    private static function deviceSig(array $u, string $dev, int $exp, string $secret): string
    {
        return hash_hmac('sha256', 'device|' . (string) ($u['sid'] ?? '') . '|' . (int) ($u['dev_epoch'] ?? 0) . '|' . strtolower((string) $u['email']) . '|' . $dev . '|' . $exp, $secret);
    }

    /** Cookie de un dispositivo recién verificado → ['name', 'value', 'max_age'], o null si no hay secreto seguro o no se ofrece recordar. */
    public static function issueDevice(array $u, ?int $now = null): ?array
    {
        $secret = Auth::sessionSecret();
        $days = self::rememberDays();
        if ($secret === null || $days < 1) return null;
        $exp = ($now ?? time()) + $days * 86400;
        $dev = bin2hex(random_bytes(12));
        return ['name' => self::deviceCookieName((string) $u['email']), 'value' => $dev . '.' . $exp . '.' . self::deviceSig($u, $dev, $exp, $secret), 'max_age' => $days * 86400];
    }

    /** ¿Trae la petición una cookie de dispositivo válida (firma buena, sin caducar y de ESTA cuenta)? */
    public static function deviceTrusted(Request $req, array $u, ?int $now = null): bool
    {
        $secret = Auth::sessionSecret();
        if ($secret === null) return false;
        $v = $req->cookie(self::deviceCookieName((string) ($u['email'] ?? '')));
        if (!preg_match('/^([0-9a-f]{24})\.(\d{9,11})\.([0-9a-f]{64})$/D', $v, $m)) return false;
        return (int) $m[2] > ($now ?? time()) && hash_equals(self::deviceSig($u, $m[1], (int) $m[2], $secret), $m[3]);
    }

    /** Valor de la cabecera Set-Cookie de un dispositivo: HttpOnly (el JavaScript de la página no la ve), SameSite=Strict, solo para el API y con Secure si la petición llegó por HTTPS. */
    public static function cookieHeader(array $dev, Request $req): string
    {
        return $dev['name'] . '=' . $dev['value'] . '; Max-Age=' . (int) $dev['max_age'] . '; Path=' . $req->apiBase . '; HttpOnly; SameSite=Strict' . ($req->https ? '; Secure' : '');
    }

    /** Hace que todos los dispositivos recordados de esa cuenta dejen de valer (sube su época). Devuelve false si la cuenta no existe. */
    public static function forgetDevices(string $email): bool
    {
        $u = Users::find($email);
        return $u !== null && Users::set($email, ['dev_epoch' => (int) ($u['dev_epoch'] ?? 0) + 1]) !== null;
    }

    // ───────────────────────────────────────── [CÓDIGO POR CORREO]
    /** «m****@torivac.com»: el correo con casi todo oculto, para decir adónde se mandó el código sin enseñarlo entero. */
    public static function hint(string $email): string
    {
        $at = strrpos($email, '@');
        if ($at === false) return '';
        return substr($email, 0, 1) . str_repeat('*', max(2, min(6, $at - 1))) . substr($email, $at);
    }

    /** Envía el código por correo al usuario → resultado de Mail::send. El código no va en el asunto (se vería en notificaciones). */
    private static function sendCode(array $u, string $code, Request $req, string $why): array
    {
        $when = gmdate('d/m/Y H:i') . ' UTC';
        $ip = Util::line($req->ip, 45);
        $extra = $why === 'attack' ? 'Te lo pedimos porque se han detectado intentos repetidos de entrar en tu cuenta.' : '';
        $text = "Tu código de acceso al panel de Torivac es:\n\n    " . substr($code, 0, 3) . ' ' . substr($code, 3) . "\n\nCaduca en 10 minutos y solo vale una vez. Si no has intentado entrar tú, ignora este mensaje: sin el código nadie puede acceder"
            . ($extra !== '' ? "\n\n$extra" : '') . "\n\n(Intento de acceso desde la dirección $ip el $when.)\n";
        $html = '<p>Tu código de acceso al panel de Torivac es:</p><p style="font-size:28px;letter-spacing:6px;font-family:monospace"><strong>' . Util::esc(substr($code, 0, 3) . ' ' . substr($code, 3)) . '</strong></p>'
            . '<p>Caduca en 10 minutos y solo vale una vez. Si no has intentado entrar tú, ignora este mensaje: sin el código nadie puede acceder.</p>' . ($extra !== '' ? '<p>' . Util::esc($extra) . '</p>' : '')
            . '<p style="color:#666;font-size:12px">Intento de acceso desde la dirección ' . Util::esc($ip) . ' el ' . Util::esc($when) . '.</p>';
        return Mail::send(['to' => [strtolower((string) $u['email'])], 'subject' => 'Torivac · tu código de acceso al panel', 'text' => $text, 'html' => $html], 'security');
    }

    /**
     * Crea un código para esa persona, lo guarda (solo su hash HMAC) y se lo manda por correo. `$why`: 'two_step' o 'attack'.
     * @return array{id?:string,hint?:string,error?:string,status?:int,code?:string}
     */
    public static function startChallenge(array $u, Request $req, string $why): array
    {
        $secret = Auth::sessionSecret();
        if ($secret === null) return ['error' => 'Configuración insegura: session_secret', 'status' => 500];
        $email = strtolower((string) $u['email']);
        if (!RateLimit::hit('pinsend', $email, self::PIN_SENDS_PER_HOUR, 3600000)['allowed']) return ['error' => 'Se han pedido demasiados códigos. Espera un rato y vuelve a entrar.', 'status' => 429, 'code' => 'too_many_codes'];
        $id = bin2hex(random_bytes(16));
        $code = sprintf('%06d', random_int(0, 999999));
        $now = Util::nowMs();
        Store::put('pin:' . $id, ['e' => $email, 'h' => hash_hmac('sha256', $id . '|' . $code, $secret), 'n' => 0, 's' => 1, 'at' => $now, 'last' => $now, 'w' => $why], self::PIN_TTL + 60);
        $r = self::sendCode($u, $code, $req, $why);
        if (empty($r['ok'])) {
            Store::delete('pin:' . $id);
            Audit::log('login.pin_fail', ['sub' => $email, 'role' => (string) ($u['role'] ?? '')], $req, 'no se pudo enviar el código por correo (' . Mail::scrub($r['error'] ?? $r['reason'] ?? '?', 80) . ')');
            return ['error' => 'No hemos podido enviarte el código por correo. Inténtalo dentro de unos minutos o avisa a quien administra la web.', 'status' => 503, 'code' => 'pin_mail_failed'];
        }
        Audit::log('login.pin_sent', ['sub' => $email, 'role' => (string) ($u['role'] ?? '')], $req, $why === 'attack' ? 'protección reforzada' : '');
        return ['id' => $id, 'hint' => self::hint($email)];
    }

    /**
     * Reenvía un código nuevo (el anterior deja de valer): como mucho PIN_SENDS envíos por intento de acceso, con PIN_RESEND_WAIT_MS entre ellos.
     * @return array{ok?:bool,error?:string,status?:int,code?:string}
     */
    public static function resend(string $id, Request $req): array
    {
        $secret = Auth::sessionSecret();
        if ($secret === null || !preg_match('/^[0-9a-f]{32}$/D', $id)) return ['error' => 'El código ha caducado. Vuelve a entrar con tu contraseña.', 'status' => 410, 'code' => 'expired'];
        return Store::locked('pin', function () use ($id, $req, $secret) {
            $rec = Store::get('pin:' . $id);
            if (!is_array($rec)) return ['error' => 'El código ha caducado. Vuelve a entrar con tu contraseña.', 'status' => 410, 'code' => 'expired'];
            $now = Util::nowMs();
            if ((int) $rec['s'] >= self::PIN_SENDS) return ['error' => 'Ya se ha reenviado el código el máximo de veces. Vuelve a entrar con tu contraseña.', 'status' => 429, 'code' => 'no_more'];
            if ($now - (int) $rec['last'] < self::PIN_RESEND_WAIT_MS) return ['error' => 'Espera unos segundos antes de pedir otro código.', 'status' => 429, 'code' => 'wait'];
            $u = Users::find((string) $rec['e']);
            if ($u === null || !RateLimit::hit('pinsend', (string) $rec['e'], self::PIN_SENDS_PER_HOUR, 3600000)['allowed']) return ['error' => 'No se puede reenviar el código ahora.', 'status' => 429, 'code' => 'too_many_codes'];
            $code = sprintf('%06d', random_int(0, 999999));
            $r = self::sendCode($u, $code, $req, (string) ($rec['w'] ?? 'two_step'));
            if (empty($r['ok'])) return ['error' => 'No hemos podido enviarte el código por correo. Inténtalo dentro de unos minutos.', 'status' => 503, 'code' => 'pin_mail_failed'];
            $rec['h'] = hash_hmac('sha256', $id . '|' . $code, $secret);
            $rec['n'] = 0;
            $rec['s'] = (int) $rec['s'] + 1;
            $rec['last'] = $now;
            Store::put('pin:' . $id, $rec, max(60, self::PIN_TTL - (int) (($now - (int) $rec['at']) / 1000)));
            Audit::log('login.pin_sent', ['sub' => (string) $rec['e'], 'role' => (string) ($u['role'] ?? '')], $req, 'reenviado');
            return ['ok' => true];
        });
    }

    /**
     * Comprueba un código. Bien → ['email', 'why'] y el código queda gastado. Mal → 'error' con 'left' (intentos que quedan) y, con PIN_TRIES fallos, el código se anula. Además de los 5 intentos por
     * código hay bloqueo de una hora: 5 códigos erróneos de un visitante contra una cuenta, o 20 contra la cuenta desde cualquier visitante (que cuentan como ataque repetido).
     * @return array{email?:string,why?:string,error?:string,left?:int,status?:int,code?:string}
     */
    public static function verify(string $id, string $code, Request $req): array
    {
        $secret = Auth::sessionSecret();
        $expired = ['error' => 'El código ha caducado. Vuelve a entrar con tu contraseña.', 'status' => 410, 'code' => 'expired'];
        if ($secret === null || !preg_match('/^[0-9a-f]{32}$/D', $id)) return $expired;
        $ipk = Request::ipKey($req->ip);
        if (!RateLimit::hit('pinip', $ipk, 30, 600000)['allowed']) return ['error' => 'Demasiados intentos. Espera unos minutos.', 'status' => 429, 'code' => 'flood'];
        $rec = Store::get('pin:' . $id);
        if (!is_array($rec)) return $expired;
        $email = (string) $rec['e'];
        $left = max(RateLimit::lockedFor('pinpair', $ipk . ':' . $email), RateLimit::lockedFor('pinacct', $email));
        if ($left > 0) return ['error' => 'Demasiados códigos erróneos. Vuelve a intentarlo en ' . Router::lockWait((int) ceil($left / 1000)) . '.', 'status' => 429, 'code' => 'locked', 'retry_after' => (int) ceil($left / 1000)];
        $code = (string) preg_replace('/\D+/', '', $code);
        $res = Store::locked('pin', function () use ($id, $code, $secret) {                // un solo intento a la vez: nadie prueba varios códigos en paralelo para saltarse el tope de 5
            $cur = Store::get('pin:' . $id);
            if (!is_array($cur)) return ['gone' => true];
            $ok = strlen($code) === 6 && hash_equals((string) $cur['h'], hash_hmac('sha256', $id . '|' . $code, $secret));
            if ($ok) { Store::delete('pin:' . $id); return ['ok' => true, 'why' => (string) ($cur['w'] ?? 'two_step')]; }
            $cur['n'] = (int) $cur['n'] + 1;
            if ($cur['n'] >= self::PIN_TRIES) { Store::delete('pin:' . $id); return ['ok' => false, 'left' => 0, 'dead' => true]; }
            Store::put('pin:' . $id, $cur, max(60, self::PIN_TTL - (int) ((Util::nowMs() - (int) $cur['at']) / 1000)));
            return ['ok' => false, 'left' => self::PIN_TRIES - $cur['n']];
        });
        if (!empty($res['gone'])) return $expired;
        $u = Users::find($email);
        $who = ['sub' => $email, 'role' => (string) ($u['role'] ?? '')];
        if (!empty($res['ok'])) {
            RateLimit::clear('pinpair', $ipk . ':' . $email);
            RateLimit::clear('pinacct', $email);
            return ['email' => $email, 'why' => $res['why']];
        }
        $l1 = RateLimit::failLock('pinpair', $ipk . ':' . $email, self::PIN_PAIR_FAILS, self::LOCK_MS, self::LOCK_MS);
        $l2 = RateLimit::failLock('pinacct', $email, self::PIN_ACCOUNT_FAILS, self::LOCK_MS, self::LOCK_MS);
        self::noteAttempt($email, $ipk);
        Audit::log('login.pin_fail', $who, $req, 'código incorrecto');
        if ($l1 > 0 || $l2 > 0) self::lockoutHappened($email, $req, $l2 > 0 ? self::ATTACK_LOCKS : 1);
        if (!empty($res['dead'])) return ['error' => 'Demasiados códigos erróneos. Vuelve a entrar con tu contraseña para pedir otro.', 'status' => 401, 'code' => 'exhausted', 'left' => 0];
        return ['error' => 'Código incorrecto', 'status' => 401, 'left' => (int) $res['left'], 'code' => 'wrong'];
    }

    // ───────────────────────────────────────── [BLOQUEOS, ATAQUES REPETIDOS Y DESBLOQUEO]
    /** Clave del índice de visitantes que han fallado contra una cuenta. */
    private static function idxKey(string $email): string { return 'lgidx:' . Util::sha32(strtolower($email)); }

    /** Anota que ese visitante (clave de IP) ha fallado contra esa cuenta: así se puede ver si está bloqueada y desbloquearla sin conocer las IP de antemano. El índice caduca a las 2 horas y guarda 40 como mucho. */
    public static function noteAttempt(string $email, string $ipKey): void
    {
        try {
            $email = strtolower($email);
            Store::locked('lgidx', function () use ($email, $ipKey) {
                $k = self::idxKey($email);
                $list = Store::get($k);
                $list = is_array($list) ? $list : [];
                if (!in_array($ipKey, $list, true)) { $list[] = $ipKey; $list = array_slice($list, -40); }
                Store::put($k, array_values($list), 7200);
            });
        } catch (\Throwable $e) { /* el índice es una comodidad: no debe romper el acceso */ }
    }

    /** Milisegundos que le quedan de bloqueo a una cuenta por cualquiera de los motivos (contraseña o código, por visitante o por cuenta); 0 si no está bloqueada. */
    public static function lockLeft(string $email): int
    {
        $email = strtolower($email);
        $m = max(RateLimit::lockedFor('lgacct', $email), RateLimit::lockedFor('pinacct', $email));
        $list = Store::get(self::idxKey($email));
        foreach (is_array($list) ? $list : [] as $ipk) $m = max($m, RateLimit::lockedFor('lgpair', $ipk . ':' . $email), RateLimit::lockedFor('pinpair', $ipk . ':' . $email));
        return $m;
    }

    /**
     * Quita el bloqueo de una cuenta y pone a cero sus contadores (por cuenta y por cada visitante que había fallado contra ella; también el bloqueo del propio visitante, para que quien
     * se bloqueó a sí mismo pueda entrar). Con `$clearReinforced` quita además la protección reforzada tras ataques repetidos.
     */
    public static function unlock(string $email, bool $clearReinforced = false): void
    {
        $email = strtolower($email);
        foreach (['lgacct', 'pinacct', 'atk', 'atkmail', 'pinsend'] as $bucket) RateLimit::clear($bucket, $email);
        $list = Store::get(self::idxKey($email));
        foreach (is_array($list) ? $list : [] as $ipk) {
            foreach (['lgpair', 'pinpair'] as $bucket) RateLimit::clear($bucket, $ipk . ':' . $email);
            RateLimit::clear('lgip', (string) $ipk);
        }
        Store::delete(self::idxKey($email));
        if ($clearReinforced) Users::set($email, ['atk_until' => null]);
    }

    /**
     * Un bloqueo acaba de empezar contra una cuenta (`$weight` 1 = el de un visitante; ATTACK_LOCKS = el de la cuenta entera o 20 códigos erróneos: un ataque repartido). Si la cuenta suma ATTACK_LOCKS
     * bloqueos en 24 horas se considera un ataque repetido: protección reforzada 7 días (código por correo en dispositivos nuevos) y UN aviso por correo (como mucho uno al día por cuenta).
     * Una cuenta que no existe no se protege ni da lugar a avisos. Nunca lanza.
     */
    public static function lockoutHappened(string $email, Request $req, int $weight = 1): void
    {
        try {
            if (!self::attackProtection()) return;
            $email = strtolower(trim($email));
            $u = Users::find($email);
            if ($u === null) return;
            $n = 0;
            for ($i = 0; $i < max(1, $weight); $i++) $n = RateLimit::fail('atk', $email, self::ATTACK_WINDOW_MS);
            if ($n < self::ATTACK_LOCKS) return;
            Users::set($email, ['atk_until' => Util::nowMs() + self::ATTACK_MS]);
            if (!RateLimit::hit('atkmail', $email, 1, 86400000)['allowed']) return;
            Audit::log('alert.repeated', ['sub' => 'sistema', 'role' => ''], $req, $email . ' · ' . $n . ' bloqueos en 24 h' . (self::isExempt($u) ? ' (cuenta de confianza: solo aviso)' : ''));
            self::alertMail($u, $n);
        } catch (\Throwable $e) {
            error_log('torivac-api: aviso de ataque repetido: ' . mb_substr($e->getMessage(), 0, 160));
        }
    }

    /** Correo de aviso al equipo por intentos repetidos contra una cuenta (sin ninguna contraseña ni código). */
    private static function alertMail(array $u, int $locks): void
    {
        $email = (string) $u['email'];
        $exempt = self::isExempt($u);
        $how = $exempt ? 'Es una cuenta de confianza (no pide código por correo), así que solo se avisa.' : 'Durante 7 días esa cuenta pide un código por correo al entrar desde dispositivos nuevos.';
        $text = "Se han detectado intentos repetidos de entrar en la cuenta $email del panel de Torivac: $locks bloqueos de acceso en las últimas 24 horas.\n\n"
            . "Cada intento se bloquea una hora tras 5 contraseñas erróneas. $how\n\n"
            . "Qué hacer: si es una persona de tu equipo que se está equivocando, no hace falta nada. Si no, cambia la contraseña de esa cuenta (Panel → Usuarios) y mira Panel → Actividad para ver desde qué direcciones se intentó.\n\n"
            . "Este aviso solo se envía cuando el patrón se repite, como mucho una vez al día por cuenta.\n";
        $html = '<p>Se han detectado <strong>intentos repetidos</strong> de entrar en la cuenta <strong>' . Util::esc($email) . '</strong> del panel de Torivac: ' . (int) $locks . ' bloqueos de acceso en las últimas 24 horas.</p>'
            . '<p>Cada intento se bloquea una hora tras 5 contraseñas erróneas. ' . Util::esc($how) . '</p>'
            . '<p><strong>Qué hacer:</strong> si es una persona de tu equipo que se está equivocando, no hace falta nada. Si no, cambia la contraseña de esa cuenta (Panel → Usuarios) y mira Panel → Actividad para ver desde qué direcciones se intentó.</p>'
            . '<p style="color:#666;font-size:12px">Este aviso solo se envía cuando el patrón se repite, como mucho una vez al día por cuenta.</p>';
        Mail::send(['to' => self::alertRecipients(), 'subject' => 'Torivac · intentos repetidos de acceso a una cuenta', 'text' => $text, 'html' => $html], 'security');
    }
}
