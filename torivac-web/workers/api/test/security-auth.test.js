// Pruebas de los arreglos de seguridad del ACCESO: D3 (límites de login, de Bearer, claves acotadas, secretos mínimos, contraseñas nuevas, comparación de secretos, purga), D4 (sesiones ligadas al usuario,
// revocables y de 24 h), D6 (errores sin texto interno, tope real del cuerpo, CORS en excepciones, anidamiento) y D9 (datos de gestión solo para managers). Cada prueba reproduce el ataque del
// informe y comprueba que ya no funciona y que lo legítimo sigue funcionando.
import test from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqual, toB64Url, jsonDepthOk } from '../src/util.js';
import { createUser, getUser, userKey } from '../src/users.js';
import { passwordProblem, hashPassword } from '../src/passwords.js';
import { purgeExpired } from '../src/ratelimit.js';
import { configProblems } from '../src/index.js';
import adminData from '../src/generated/admin-data.js';
import { mkEnv, FakeKV, MASTER, SESSION } from './helpers.js';
import { call, signIn, order, orderEnv, keys, PW } from './kit.js';

const TOO_MANY = 'Demasiados intentos. Espera unos minutos.';
let seq = 0;
/** IP de prueba distinta cada vez (para no tropezar con los límites por visitante cuando se hacen muchos intentos). */
const nextIp = () => `10.9.${(seq >> 8) & 255}.${seq++ & 255}`;
/** Intento de login con el correo y la contraseña dados desde la IP dada (por defecto una nueva) → Response. */
const attempt = (env, email, password, ip = nextIp(), deps = {}) => call(env, '/api/auth/login', { method: 'POST', body: { email, password }, ip, deps });
/** Token firmado a mano con HMAC-SHA256 (para forjar tokens con cualquier contenido y la clave que se quiera). */
async function forge(payload, secret) {
  const body = new TextEncoder().encode(JSON.stringify(payload)), k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${toB64Url(body)}.${toB64Url(new Uint8Array(await crypto.subtle.sign('HMAC', k, body)))}`;
}
/** Contenido (payload) de un token de sesión ya emitido. */
const payloadOf = (token) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
/** Ejecuta fn con console.error capturado → lo que se escribió en el registro (una cadena por llamada). */
async function withLog(fn) { const orig = console.error, logs = []; console.error = (...a) => logs.push(a.map(String).join(' ')); try { await fn(); } finally { console.error = orig; } return logs; }

// ───────────────────────────────────────── D3 · límites de login
test('D3 · login: límite por IP sola, 30 intentos / 10 min contra cualquier cuenta (pulverizado de contraseñas) (W2)', async () => {
  const env = mkEnv(); const codes = [];
  for (let i = 0; i < 33; i++) codes.push((await attempt(env, `user${i}@torivac.com`, 'Primavera2026', '203.0.113.5')).status);       // 33 cuentas distintas, una sola IP
  assert.deepEqual(codes.slice(0, 30), Array(30).fill(401)); assert.deepEqual(codes.slice(30), [429, 429, 429]);
  const r = await attempt(env, 'user0@torivac.com', 'x', '203.0.113.5'); assert.equal(r.status, 429); assert.equal((await r.json()).error, TOO_MANY);
  assert.equal((await attempt(env, 'user0@torivac.com', 'x', '203.0.113.6')).status, 401, 'otra IP no se ve afectada');
  assert.equal((await attempt(env, 'user0@torivac.com', 'x', '203.0.113.5', { now: Date.now() + 11 * 60_000 })).status, 401, 'a los 10 minutos se libera');
});
test('D3 · login: límite por IP+correo, 6 / 10 min, como antes; el mismo texto de siempre', async () => {
  const env = mkEnv(); const r = []; for (let i = 0; i < 8; i++) r.push(await attempt(env, 'a@b.es', 'x', '203.0.113.9'));
  assert.deepEqual(r.map((x) => x.status), [401, 401, 401, 401, 401, 401, 429, 429]); assert.equal((await r[7].json()).error, TOO_MANY);
});
test('D3 · login: límite por CUENTA, 12 fallos / 15 min desde IPs distintas; solo cuentas que existen (sin crear claves por correos inexistentes) (W2/A2)', async () => {
  const env = mkEnv(); const u = await signIn(env, 'jefa@torivac.com', 'manager');
  for (let i = 0; i < 12; i++) assert.equal((await attempt(env, 'jefa@torivac.com', 'mala-clave-1234')).status, 401, `fallo ${i + 1}`);      // 12 IPs distintas: ningún límite por IP salta
  const bloqueado = await attempt(env, 'jefa@torivac.com', u.password);                                                                       // la contraseña CORRECTA, desde una IP nueva
  assert.equal(bloqueado.status, 429); assert.equal((await bloqueado.json()).error, TOO_MANY, 'mismo texto de siempre');
  for (let i = 0; i < 15; i++) assert.equal((await attempt(env, 'fantasma@torivac.com', 'mala-clave-1234')).status, 401, 'una cuenta inexistente nunca se bloquea por cuenta');
  assert.equal(keys(env, 'rl:login-acct:').length, 1, 'solo la cuenta que existe tiene contador');
  assert.equal((await attempt(env, 'jefa@torivac.com', u.password, nextIp(), { now: Date.now() + 16 * 60_000 })).status, 200, 'pasados 15 minutos vuelve a entrar');
});
test('D3 · login: el contador por cuenta se pone a cero tras un acceso correcto', async () => {
  const env = mkEnv(); const u = await signIn(env, 'jefa@torivac.com', 'manager');
  for (let i = 0; i < 5; i++) await attempt(env, 'jefa@torivac.com', 'mala-clave-1234');
  assert.equal(keys(env, 'rl:login-acct:').length, 1);
  assert.equal((await attempt(env, 'jefa@torivac.com', u.password)).status, 200); assert.equal(keys(env, 'rl:login-acct:').length, 0, 'a cero');
  for (let i = 0; i < 11; i++) assert.equal((await attempt(env, 'jefa@torivac.com', 'mala-clave-1234')).status, 401);                          // 5 + 11 = 16 sin el reinicio ya estaría bloqueada
  assert.equal((await attempt(env, 'jefa@torivac.com', u.password)).status, 200, 'sigue pudiendo entrar');
});
test('D3 · Bearer inválido: 30 fallos / 10 min por IP → 429; las peticiones válidas no gastan cupo; en /api/prices un Bearer falso cuenta pero la IP bloqueada recibe la vista pública (A12)', async () => {
  const env = mkEnv(); const codes = [];
  for (let i = 0; i < 33; i++) codes.push((await call(env, '/api/users', { token: 'x'.repeat(40) + i, ip: '203.0.113.9' })).status);
  assert.deepEqual(codes.slice(0, 30), Array(30).fill(401)); assert.deepEqual(codes.slice(30), [429, 429, 429]);
  const bloqueada = await call(env, '/api/users', { token: MASTER, ip: '203.0.113.9' }); assert.equal(bloqueada.status, 429); assert.equal((await bloqueada.json()).error, TOO_MANY);
  for (let i = 0; i < 100; i++) assert.equal((await call(env, '/api/users', { token: MASTER, ip: '203.0.113.10' })).status, 200);                                  // 100 válidas desde otra IP: no gastan cupo
  await env.KV.put('prices:current', JSON.stringify({ updated_at: 'x', source: 'upload:jefa@torivac.com', currency: 'EUR', mode: 'live', items: {} }));
  /** Origen (source) de la lista de precios que ve quien llama con ese token desde esa IP: completo para un manager, solo «upload» para el público. */
  const visto = async (token, ip) => (await (await call(env, '/api/prices', { token, ip })).json()).prices.source;
  assert.equal(await visto(MASTER, '203.0.113.10'), 'upload:jefa@torivac.com', 'el manager ve el origen completo');
  for (let i = 0; i < 30; i++) assert.equal((await call(env, '/api/prices', { token: 'y'.repeat(40) + i, ip: '203.0.113.10' })).status, 200);       // 30 fallos en /api/prices: siguen siendo la vista pública
  assert.equal(await visto('z'.repeat(40), '203.0.113.10'), 'upload'); assert.equal(await visto(MASTER, '203.0.113.10'), 'upload', 'bloqueada: ni se prueba el token, se sirve la vista pública');
  assert.equal((await call(env, '/api/users', { token: MASTER, ip: '203.0.113.10' })).status, 429, 'y en el resto de rutas, 429');
  assert.equal((await call(env, '/api/prices', { ip: '203.0.113.11' })).status, 200, 'el público sin Bearer nunca se limita');
  assert.equal((await call(env, '/api/users', { token: 'z'.repeat(40), ip: '203.0.113.9', deps: { now: Date.now() + 11 * 60_000 } })).status, 401, 'a los 10 minutos se libera');
});
test('D3 · cada limitador guarda su estado en una clave de longitud acotada rl:<cubo>:<hash>: un correo enorme no rompe el guardado ni se hace eco de la clave (A4)', async () => {
  const env = mkEnv(); const largo = 'a'.repeat(600) + '@torivac.com';
  const r = await attempt(env, largo, 'x', '203.0.113.4'); assert.equal(r.status, 401); const txt = await r.text();
  assert.ok(!txt.includes('rl:') && !txt.includes('aaaa') && !/No puedo guardar/.test(txt));
  assert.ok(keys(env, 'rl:').length >= 2); for (const k of keys(env, 'rl:')) assert.match(k, /^rl:[a-z-]+:[0-9a-f]{32}$/, k);
  assert.ok(!keys(env).some((k) => k.includes('aaaaaaaa') || k.includes('203.0.113.4')), 'ni el correo ni la IP en las claves');
  assert.equal((await attempt(env, 'a'.repeat(5000), 'x', '203.0.113.4')).status, 401, 'tampoco con un correo de 5000 caracteres');
  assert.throws(() => { throw new Error('la clave antigua rl:login:IP:<correo> pasaba de 512 bytes'); }); await assert.rejects(env.KV.put(`rl:login:203.0.113.4:${largo}${'b'.repeat(10)}`, '1'), /UriTooLong/);
});
test('D3 · secretos mínimos: SESSION_SECRET < 32 o con «CAMBIA-ESTO» → login 500 «Configuración insegura» y ninguna sesión vale; ADMIN_API_TOKEN < 32 → el token maestro no vale; /api/health lo marca (nombre, no valor)', async () => {
  const sano = mkEnv(); const u = await signIn(sano, 'jefa@torivac.com', 'manager');
  const h0 = await (await call(sano, '/api/health')).json(); assert.equal(h0.ok, true); assert.ok(!('config' in h0), 'sana: sin aviso');
  for (const [secreto, re] of [['k3y-9xq-poca', /demasiado corto/], ['x'.repeat(31), /demasiado corto/], ['CAMBIA-ESTO-por-una-clave-aleatoria-larga-123456', /sin cambiar/], ['', /no configurado/], [undefined, /no configurado/]]) {
    const env = mkEnv({ KV: sano.KV, SESSION_SECRET: secreto });
    const r = await attempt(env, 'jefa@torivac.com', u.password); const j = await r.json();
    assert.equal(r.status, 500, String(secreto)); assert.match(j.error, /^Configuración insegura: SESSION_SECRET /); assert.match(j.error, re); assert.ok(!j.error.includes(String(secreto)) || !secreto, 'sin el valor');
    assert.equal((await call(env, '/api/users', { token: u.token })).status, 401, 'el token de antes ya no vale con un secreto inseguro');
    if (secreto) assert.equal((await call(env, '/api/auth/me', { token: await forge({ sub: 'jefa@torivac.com', iat: Date.now(), exp: Date.now() + 1e6, sid: (await getUser(sano, 'jefa@torivac.com')).sid }, secreto) })).status, 401, 'ni uno firmado con ese secreto');
    const h = await (await call(env, '/api/health')).json(); assert.equal(h.ok, true); assert.deepEqual(h.config, { ok: false, problems: ['SESSION_SECRET'] }); assert.ok(!JSON.stringify(h).includes(String(secreto || '\u0000')), 'el nombre, no el valor');
  }
  for (const corto of ['master-token-123', 'x'.repeat(31)]) {
    const env = mkEnv({ KV: sano.KV, ADMIN_API_TOKEN: corto });
    assert.equal((await call(env, '/api/users', { token: corto })).status, 401, 'el token maestro corto queda desactivado');
    const h = await (await call(env, '/api/health')).json(); assert.deepEqual(h.config, { ok: false, problems: ['ADMIN_API_TOKEN'] }); assert.ok(!JSON.stringify(h).includes(corto));
  }
  assert.equal((await call(mkEnv({ KV: sano.KV, ADMIN_API_TOKEN: undefined }), '/api/users', { token: 'undefined' })).status, 401);
  assert.equal((await call(sano, '/api/users', { token: MASTER })).status, 200, 'el token maestro de 32 o más caracteres sigue valiendo');
  assert.deepEqual(configProblems(mkEnv({ ORDER_COPY: 'quizá' })), ['ORDER_COPY']); assert.deepEqual(configProblems(mkEnv()), []);
});
test('D3 · contraseñas nuevas: mínimo 12, sin la parte local del correo y no triviales (los usuarios ya creados no se tocan)', async () => {
  const env = mkEnv(); const mal = (pw, email = 'maria.lopez@acme.es') => createUser(env, { email, name: 'M', role: 'client', password: pw });
  assert.match((await mal('Corta-123')).error, /al menos 12/);
  for (const pw of ['password1234', 'Password-2026-xx', '123456789012', 'qwertyuiop12', 'Torivac-Manager-2026', 'torivac2026!!!!', 'Administrador-2026-ok', 'aaaaaaaaaaaa', 'abababababab', 'Contraseña-2026-x', 'letmein-letmein']) assert.match((await mal(pw)).error, /demasiado fácil/, pw);
  assert.match((await mal('Maria.Lopez-2026!!')).error, /contener tu correo/); assert.match((await mal('xx-MARIALOPEZ-xx-1')).error, /contener tu correo/); assert.match((await mal('Maria-2026-clave-x', 'maria+tag@acme.es')).error, /contener tu correo/, 'también sin la etiqueta +algo'); assert.match((await mal('x'.repeat(1001))).error, /demasiado larga/);
  assert.equal((await createUser(env, { email: 'ab@acme.es', name: 'A', role: 'client', password: 'Clave-ab-Segura-2026' })).user.email, 'ab@acme.es', 'una parte local de menos de 3 caracteres no cuenta');
  for (const [i, pw] of ['Clave-Segura-2026x', 'correcto-caballo-pila-grapa', 'Xk9#mP2$vL7!qR', 'Manager-Clave-2026'].entries()) assert.ok((await mal(pw, `persona${i}@acme.es`)).user, pw);
  const vieja = await hashPassword('corta');                                                                                                   // usuario antiguo con una contraseña floja
  await env.KV.put(userKey('antiguo@acme.es'), JSON.stringify({ email: 'antiguo@acme.es', name: 'Antiguo', role: 'client', hash: vieja.hash, salt: vieja.salt, created: '2025-01-01T00:00:00.000Z' }));
  assert.equal((await attempt(env, 'antiguo@acme.es', 'corta')).status, 200, 'los usuarios ya creados siguen entrando');
  assert.equal(passwordProblem('Clave-Segura-2026x', 'a@b.es'), null);
  assert.equal((await createUser(env, { email: 'nombre.raro@acme.es', name: 'Ana\r\nBcc: x@y.zz', role: 'client', password: 'Clave-Segura-2026x' })).user.name, 'Ana Bcc: x@y.zz', 'el nombre del usuario va en una línea');
});
test('D3 · timingSafeEqual compara resúmenes SHA-256: igual resultado con cualquier longitud, sin salir antes si difieren', async () => {
  assert.equal(await timingSafeEqual('abc', 'abc'), true); assert.equal(await timingSafeEqual('abc', 'abd'), false); assert.equal(await timingSafeEqual('abc', 'abcd'), false); assert.equal(await timingSafeEqual('', ''), true); assert.equal(await timingSafeEqual('', 'a'), false);
  assert.equal(await timingSafeEqual('ñandú-€', 'ñandú-€'), true); assert.equal(await timingSafeEqual('a'.repeat(5000), 'a'.repeat(5000)), true); assert.equal(await timingSafeEqual('a'.repeat(5000), 'a'.repeat(4999) + 'b'), false);
  assert.equal(await timingSafeEqual(MASTER, MASTER.slice(0, -1)), false); assert.equal(await timingSafeEqual(MASTER, MASTER + 'x'), false);
});
test('D3 · los registros rl:* caducados se purgan «al vuelo» (hasta 200 por vez) para que no crezcan sin límite (A4)', async () => {
  const env = mkEnv(); const ahora = Date.now();
  for (let i = 0; i < 300; i++) await env.KV.put(`rl:login:${String(i).padStart(32, '0')}`, JSON.stringify({ count: 1, resetAt: ahora - 1000 }), { expirationTtl: 60 });
  for (let i = 0; i < 5; i++) await env.KV.put(`rl:order:${String(i).padStart(32, 'f')}`, JSON.stringify({ count: 1, resetAt: ahora + 600_000 }), { expirationTtl: 3600 });
  await env.KV.put('rl:legado:' + 'a'.repeat(32), JSON.stringify({ count: 1, resetAt: ahora - 5 }));                       // registro sin dato de caducidad: se juzga por su resetAt
  await env.KV.put('user:x@y.es', '{}');
  assert.equal(await purgeExpired(env, { now: ahora + 120_000 }), 200); assert.equal(await purgeExpired(env, { now: ahora + 120_000 }), 101);
  assert.equal(keys(env, 'rl:').length, 5, 'solo quedan los vigentes'); assert.ok(env.KV.m.has('user:x@y.es'), 'no toca nada que no sea rl:');
  const e2 = mkEnv(); for (let i = 0; i < 3; i++) await e2.KV.put(`rl:login:${String(i).padStart(32, '0')}`, JSON.stringify({ count: 1, resetAt: ahora - 1000 }), { expirationTtl: 60 });
  const orig = Date.now; Date.now = () => ahora + 120_000; try { await call(e2, '/api/health', { deps: { purge: true } }); } finally { Date.now = orig; }
  assert.equal(keys(e2, 'rl:').length, 0, 'el Worker purga 1 de cada 50 peticiones (aquí forzado)');
  const e3 = mkEnv(); await e3.KV.put(`rl:login:${'0'.repeat(32)}`, JSON.stringify({ count: 1, resetAt: ahora - 1000 }), { expirationTtl: 60 });
  await (await import('../src/index.js')).default.scheduled({}, e3, {}, { fetchImpl: async () => new Response('', { status: 500 }) }); assert.ok(keys(e3, 'rl:').length <= 1);
});

// ───────────────────────────────────────── D4 · sesiones
test('D4 · la sesión va ligada al registro del usuario: borrar y recrear al usuario con el mismo correo NO resucita sus tokens (W6)', async () => {
  const env = mkEnv(); const viejo = await signIn(env, 'exjefe@torivac.com', 'manager');
  assert.equal((await call(env, '/api/users', { token: viejo.token })).status, 200);
  await call(env, '/api/users/exjefe%40torivac.com', { method: 'DELETE', token: MASTER }); assert.equal((await call(env, '/api/users', { token: viejo.token })).status, 401, 'borrado: sin acceso');
  assert.equal((await createUser(env, { email: 'exjefe@torivac.com', name: 'Ex', role: 'client', password: 'Otra-Clave-Distinta-1' })).user.role, 'client');         // «degradado» a cliente con otra contraseña
  assert.equal((await call(env, '/api/users', { token: viejo.token })).status, 401, 'el token viejo ya no vale: el usuario recreado tiene otro sid');
  assert.equal((await call(env, '/api/auth/me', { token: viejo.token })).status, 401);
  const nuevo = await (await attempt(env, 'exjefe@torivac.com', 'Otra-Clave-Distinta-1')).json(); assert.equal(nuevo.user.role, 'client');
  assert.equal((await call(env, '/api/users', { token: nuevo.token })).status, 403); assert.equal((await call(env, '/api/auth/me', { token: nuevo.token })).status, 200);
});
test('D4 · el rol sale del registro del usuario, no del token: un token firmado con rol «manager» para un cliente sigue siendo de cliente', async () => {
  const env = mkEnv(); const ana = await signIn(env, 'ana.cliente@acme.es', 'client'); const rec = await getUser(env, 'ana.cliente@acme.es');
  const falso = await forge({ sub: 'ana.cliente@acme.es', role: 'manager', iat: Date.now(), exp: Date.now() + 1e7, sid: rec.sid }, SESSION);       // firma válida, rol inventado
  assert.equal((await call(env, '/api/users', { token: falso })).status, 403, 'es un cliente: 403'); assert.equal((await (await call(env, '/api/auth/me', { token: falso })).json()).user.role, 'client');
  assert.ok(!('role' in payloadOf(ana.token)), 'los tokens nuevos no llevan rol'); assert.deepEqual(Object.keys(payloadOf(ana.token)).sort(), ['exp', 'iat', 'sid', 'sub']);
});
test('D4 · los tokens antiguos (sin sid) no valen; el TTL de la sesión es de 24 h', async () => {
  const env = mkEnv(); const t0 = Date.parse('2026-10-28T08:00:00Z'); const u = await signIn(env, 'jefa@torivac.com', 'manager');
  const antiguo = await forge({ sub: 'jefa@torivac.com', role: 'manager', name: 'Jefa', exp: Date.now() + 7 * 86_400_000 }, SESSION);                    // formato de antes: rol en el token, 7 días, sin sid
  assert.equal((await call(env, '/api/users', { token: antiguo })).status, 401);
  assert.equal((await call(env, '/api/users', { token: await forge({ sub: 'jefa@torivac.com', iat: Date.now(), exp: Date.now() + 1e6, sid: '' }, SESSION) })).status, 401, 'sid vacío');
  const login = await (await attempt(env, 'jefa@torivac.com', u.password, nextIp(), { now: t0 })).json(); const p = payloadOf(login.token);
  assert.equal(p.exp - p.iat, 24 * 3600 * 1000); assert.equal(p.iat, t0);
  assert.equal((await call(env, '/api/auth/me', { token: login.token, deps: { now: t0 + 23 * 3_600_000 } })).status, 200);
  assert.equal((await call(env, '/api/auth/me', { token: login.token, deps: { now: t0 + 24 * 3_600_000 + 1 } })).status, 401, 'a las 24 h caduca');
});
test('D4 · POST /api/auth/logout invalida TODOS los tokens anteriores de la persona; un nuevo inicio de sesión vale; el token maestro → 400; sin sesión → 401', async () => {
  const env = mkEnv(); const a = await signIn(env, 'jefa@torivac.com', 'manager'); const b = await (await attempt(env, 'jefa@torivac.com', a.password)).json(); const otra = await signIn(env, 'ana.cliente@acme.es', 'client');
  assert.equal((await call(env, '/api/users', { token: a.token })).status, 200); assert.equal((await call(env, '/api/users', { token: b.token })).status, 200);
  const out = await call(env, '/api/auth/logout', { method: 'POST', token: a.token }); assert.equal(out.status, 200); assert.deepEqual(await out.json(), { ok: true });
  assert.equal((await call(env, '/api/users', { token: a.token })).status, 401); assert.equal((await call(env, '/api/users', { token: b.token })).status, 401, 'también el token de otro navegador');
  assert.equal((await call(env, '/api/auth/me', { token: otra.token })).status, 200, 'los tokens de otras personas no se tocan');
  const c = await (await attempt(env, 'jefa@torivac.com', a.password)).json(); assert.equal((await call(env, '/api/users', { token: c.token })).status, 200, 'iniciar sesión otra vez vale');
  const m = await call(env, '/api/auth/logout', { method: 'POST', token: MASTER }); assert.equal(m.status, 400); assert.equal((await m.json()).ok, false);
  assert.equal((await call(env, '/api/auth/logout', { method: 'POST' })).status, 401); assert.equal((await call(env, '/api/auth/logout', { method: 'POST', token: 'x'.repeat(40) })).status, 401);
  assert.ok((await getUser(env, 'jefa@torivac.com')).sess_after > 0);
  const t = Date.now() + 5000; await attempt(env, 'jefa@torivac.com', a.password, nextIp(), { now: t });
  await call(env, '/api/auth/logout', { method: 'POST', token: c.token, deps: { now: t } }); const d = await (await attempt(env, 'jefa@torivac.com', a.password, nextIp(), { now: t })).json();        // en el mismo milisegundo
  assert.equal((await call(env, '/api/auth/me', { token: d.token, deps: { now: t } })).status, 200, 'un token emitido justo después de cerrar sesión vale');
});
test('D4 · los usuarios antiguos (sin sid ni sess_after) reciben su sid en el siguiente inicio de sesión correcto', async () => {
  const env = mkEnv(); const { hash, salt } = await hashPassword('Clave-Antigua-2026!');
  await env.KV.put(userKey('antiguo@acme.es'), JSON.stringify({ email: 'antiguo@acme.es', name: 'Antiguo', role: 'manager', hash, salt, created: '2025-01-01T00:00:00.000Z' }));
  assert.equal((await getUser(env, 'antiguo@acme.es')).sid, undefined);
  const r = await (await attempt(env, 'antiguo@acme.es', 'Clave-Antigua-2026!')).json(); assert.equal(r.ok, true); assert.deepEqual(Object.keys(r.user).sort(), ['created', 'email', 'name', 'role'], 'la respuesta no lleva sid ni hash');
  const rec = await getUser(env, 'antiguo@acme.es'); assert.match(rec.sid, /^[0-9a-f]{32}$/); assert.equal(rec.sess_after, 0);
  assert.equal((await call(env, '/api/users', { token: r.token })).status, 200);
  const lista = await (await call(env, '/api/users', { token: MASTER })).json(); assert.ok(lista.users.every((u) => !('sid' in u) && !('hash' in u) && !('salt' in u) && !('sess_after' in u)), 'GET /api/users no expone datos de sesión');
});

// ───────────────────────────────────────── D6 · errores y cuerpo
test('D6 · ninguna respuesta 500 devuelve texto interno: {"ok":false,"error":"Error interno","id":"<8 hex>"}; el detalle va al registro con el mismo id (W9)', async () => {
  class BoomKV extends FakeKV { async get(k) { if (k === 'proposals:state') throw new Error('KV secreto interno 12345'); return super.get(k); } }
  const env = mkEnv({ KV: new BoomKV() }); let r, txt;
  const logs = await withLog(async () => { r = await call(env, '/api/proposals/state', { token: MASTER }); txt = await r.text(); });
  const j = JSON.parse(txt); assert.equal(r.status, 500); assert.deepEqual(Object.keys(j).sort(), ['error', 'id', 'ok']); assert.equal(j.ok, false); assert.equal(j.error, 'Error interno'); assert.match(j.id, /^[0-9a-f]{8}$/);
  assert.ok(!txt.includes('secreto') && !txt.includes('12345'), 'sin texto interno en la respuesta');
  assert.ok(logs.some((l) => l.includes(j.id) && l.includes('KV secreto interno 12345')), 'el detalle y el id van al registro');
  const m = await withLog(async () => { for (const [ruta, o] of [['/api/prices/ai/apply', { method: 'POST', token: MASTER, body: { changes: [null, 5, 'x', [1]] } }], ['/api/users/%E0%A4%A', { method: 'DELETE', token: MASTER }], ['/api/prices/upload', { method: 'POST', token: MASTER, body: { rows: [1, 2] } }]]) { const x = await call(env, ruta, o); assert.equal(x.status, 400, ruta); const xt = await x.text(); assert.ok(!/Cannot read|URI malformed|TypeError/.test(xt), xt); } });
  assert.deepEqual(m, [], 'esos casos son errores del cliente (400), no fallos internos');
  const ia = await call(env, '/api/prices/ai', { method: 'POST', token: MASTER, body: { instruction: 'x' } }); assert.equal(ia.status, 400); assert.match((await ia.json()).error, /Escribe una instrucción/, 'los errores previstos de la API sí enseñan su mensaje');
});
test('D6 · una excepción dentro de handleOrder responde 500 con cabeceras CORS (antes escapaba sin ellas, como 1101 de Cloudflare)', async () => {
  class PutBoomKV extends FakeKV { async put(k, v, o) { if (k.startsWith('order:')) throw new Error('boom'); return super.put(k, v, o); } }
  const env = await orderEnv({ KV: new PutBoomKV() }); await env.KV.put('prices:current', JSON.stringify({ items: {} }));
  let r; await withLog(async () => { r = await call(env, '/api/order', { method: 'POST', body: order(), origin: 'https://demo.example', ip: nextIp() }); });
  assert.equal(r.status, 500); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://demo.example'); assert.equal((await r.json()).error, 'Error interno');
  const deep = '['.repeat(200000) + ']'.repeat(200000);
  const bomba = await call(await orderEnv(), '/api/order', { method: 'POST', body: `{"customer":{"name":"Ana","email":"a@b.es","privacy":true},"lines":[{"ref":${deep},"qty":1}]}`, origin: 'https://demo.example', ip: nextIp() });
  assert.equal(bomba.status, 400); assert.equal(bomba.headers.get('Access-Control-Allow-Origin'), 'https://demo.example');
});
test('D6 · cuerpo con tope REAL de 6 MB: 30 MB sin Content-Length (por trozos) → rechazado y se deja de leer; hasta el tope vale (W9)', async () => {
  const env = await orderEnv(); let pulled = 0;
  const trozo = new TextEncoder().encode('x'.repeat(1 << 20));
  const stream = new ReadableStream({ pull(c) { if (pulled >= 30) return c.close(); pulled++; c.enqueue(trozo); } });
  const r = await (await import('../src/index.js')).default.fetch(new Request('https://api.test/api/order', { method: 'POST', body: stream, duplex: 'half', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '6.6.6.6' } }), env, {}, { purge: false });
  assert.equal(r.status, 400); assert.ok(pulled <= 12, `se dejó de leer pronto (${pulled} MB leídos de 30)`); assert.equal(keys(env, 'order:').length, 0, 'no se guardó nada');
  const grande = JSON.stringify({ ...order(), relleno: 'x'.repeat(5_000_000) });
  assert.equal((await call(env, '/api/order', { method: 'POST', body: grande, ip: nextIp() })).status, 200, 'un cuerpo de 5 MB vale');
  assert.equal((await call(env, '/api/order', { method: 'POST', body: JSON.stringify({ ...order(), relleno: 'x'.repeat(6_100_000) }), ip: nextIp() })).status, 400, 'más de 6 MB no');
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@b.es', password: 'x'.repeat(20_000) }), ip: nextIp() })).status, 400, 'el login tiene su propio tope pequeño');
});
test('D6 · JSON anidado a más de 32 niveles → 400; hasta 32 vale', async () => {
  const env = await orderEnv();
  /** Cuerpo de pedido con un nivel de anidamiento de n corchetes en un campo extra. */
  const con = (n) => `{"customer":{"name":"Ana","email":"a@b.es","privacy":true},"lines":[{"ref":"P16633","qty":1}],"x":${'['.repeat(n)}${']'.repeat(n)}}`;
  assert.equal((await call(env, '/api/order', { method: 'POST', body: con(40), ip: nextIp() })).status, 400); assert.equal((await call(env, '/api/order', { method: 'POST', body: con(29), ip: nextIp() })).status, 200, '1 + 29 + los niveles de dentro < 32');
  assert.equal(jsonDepthOk('[' .repeat(32) + ']'.repeat(32)), true); assert.equal(jsonDepthOk('['.repeat(33) + ']'.repeat(33)), false); assert.equal(jsonDepthOk('{"a":"[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[["}'), true, 'las llaves dentro de una cadena no cuentan');
  assert.equal(jsonDepthOk('{"a":"\\"[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[","b":1}'), true, 'comillas escapadas');
});
test('D6 · Vary = Origin, Authorization en /api/prices (público y manager), con y sin Origin', async () => {
  const env = mkEnv(); const u = await signIn(env, 'jefa@torivac.com', 'manager');
  for (const [o, t] of [['https://demo.example', undefined], [undefined, undefined], ['https://demo.example', u.token]]) { const r = await call(env, '/api/prices', { origin: o, token: t }); assert.equal(r.headers.get('Vary'), 'Origin, Authorization'); }
});

// ───────────────────────────────────────── D9 · datos de gestión solo para managers
test('D9 · GET /api/admin/data: solo managers (el token maestro también); anónimo 401, cliente 403; sin caché; el objeto generado tal cual (F3)', async () => {
  const env = mkEnv(); const jefa = await signIn(env, 'jefa@torivac.com', 'manager'), ana = await signIn(env, 'ana.cliente@acme.es', 'client');
  assert.equal((await call(env, '/api/admin/data')).status, 401); assert.equal((await call(env, '/api/admin/data', { token: ana.token })).status, 403);
  for (const token of [jefa.token, MASTER]) {
    const r = await call(env, '/api/admin/data', { token }); assert.equal(r.status, 200); assert.match(r.headers.get('Cache-Control'), /no-store/);
    const j = await r.json(); assert.equal(j.ok, true); assert.deepEqual(j.proposals, adminData.proposals); assert.deepEqual(j.admin, adminData.admin); assert.ok(Array.isArray(j.proposals) && Array.isArray(j.admin.products) && typeof j.admin.byRef === 'object');
  }
  assert.equal((await call(env, '/api/admin/data', { method: 'POST', token: MASTER })).status, 404);
});
test('anónimos y clientes no llegan a ninguna ruta de manager (matriz de rutas × credenciales)', async () => {
  const env = mkEnv(); const jefa = await signIn(env, 'jefa@torivac.com', 'manager'), ana = await signIn(env, 'ana.cliente@acme.es', 'client');
  const rutas = [['GET', '/api/users'], ['POST', '/api/users'], ['DELETE', '/api/users/z%40z.es'], ['POST', '/api/prices/refresh'], ['POST', '/api/prices/upload'], ['POST', '/api/prices/ai'], ['POST', '/api/prices/ai/apply'], ['GET', '/api/proposals/state'], ['POST', '/api/proposals/state'], ['GET', '/api/admin/data']];
  for (const [m, p] of rutas) {
    assert.equal((await call(env, p, { method: m, ip: nextIp() })).status, 401, `anónimo ${m} ${p}`); assert.equal((await call(env, p, { method: m, token: ana.token })).status, 403, `cliente ${m} ${p}`);
    assert.ok([200, 201, 400, 404, 409, 502, 503].includes((await call(env, p, { method: m, token: jefa.token, body: m === 'GET' || m === 'DELETE' ? undefined : {} })).status), `manager ${m} ${p}`);
  }
});

// ───────────────────────────────────────── D6 · entradas raras no provocan fallos internos
test('D6 · fuzz determinista: 800 peticiones con cuerpos raros a todas las rutas (anónimo, cliente, manager y maestro) no provocan ningún 500', async () => {
  let seed = 24681357;
  /** Número pseudoaleatorio en [0, 1) con semilla fija (la prueba es reproducible). */
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  /** Elemento al azar de una lista. */
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const atoms = [null, true, false, 0, -1, 1.5, 1e308, '', 'x', 'P16633', 'constructor', '__proto__', 'a@b.es', '\u0000', '\r\n', 'ñ'.repeat(300), [], {}, [null], [[]], { a: { b: [1] } }, 'A'.repeat(70000)];
  /** Valor JSON raro al azar: átomos, listas y objetos con las claves que usa el API. */
  const gen = (d = 0) => {
    const t = rnd(); if (d > 3 || t < 0.5) return pick(atoms);
    if (t < 0.75) return Array.from({ length: Math.floor(rnd() * 4) }, () => gen(d + 1));
    const o = {}; for (const k of ['email', 'password', 'customer', 'lines', 'ref', 'qty', 'name', 'pdf', 'copy', 'lang', 'changes', 'csv', 'rows', 'dry_run', 'mode', 'force', 'id', 'state', 'instruction', 'role', 'message', 'privacy', 'hp', 'turnstileToken', 'price', 'tiers', 'confirm_large', 'next']) if (rnd() < 0.25) o[k] = gen(d + 1);
    return o;
  };
  const env = await orderEnv(); const jefa = await signIn(env, 'jefa@torivac.com', 'manager'), ana = await signIn(env, 'ana.cliente@acme.es', 'client');
  const rutas = [['POST', '/api/order'], ['POST', '/api/contact'], ['POST', '/api/auth/login'], ['POST', '/api/users'], ['POST', '/api/prices/upload'], ['POST', '/api/prices/refresh'], ['POST', '/api/prices/ai'], ['POST', '/api/prices/ai/apply'], ['POST', '/api/proposals/state'], ['DELETE', '/api/users/x%40y.es'], ['GET', '/api/orders'], ['GET', '/api/prices'], ['GET', '/api/admin/data']];
  const malos = []; const orig = console.error; console.error = () => {};
  try {
    for (let i = 0; i < 800; i++) {
      const [m, p] = pick(rutas), tok = pick([jefa.token, jefa.token, MASTER, MASTER, ana.token, undefined]), body = m === 'GET' || m === 'DELETE' ? undefined : (rnd() < 0.1 ? 'no es json {' : JSON.stringify(gen()));
      const r = await call(env, p, { method: m, token: tok, body, ip: `10.${i >> 8}.${i & 255}.1`, deps: { fetchImpl: async () => new Response('{"id":"m"}'), now: Date.now() } });
      if (r.status === 500) malos.push([m, p, String(body).slice(0, 160)]);
    }
  } finally { console.error = orig; }
  assert.deepEqual(malos, [], 'ninguna entrada rara debe dar «Error interno»');
});
