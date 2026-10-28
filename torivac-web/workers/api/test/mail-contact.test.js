// [PRUEBAS-CONTACTO] Pruebas de M1 (POST /api/contact guarda SIEMPRE y `emailed` dice la verdad), M3 (controladores Resend y Brevo con fetch simulado, remitente, EMAIL_PROVIDER) y M4 (secretos y datos del visitante).
// Sin red: KV en memoria y proveedores simulados con provider() (ver kit.js). Mismos nombres que en el PHP en lo posible (M1 · …).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeKV, mkEnv, MASTER } from './helpers.js';
import { call, signIn, provider, contactPost, withLog, messagesIn, orderEnv, order, keys, freshIp, PDF_B64 } from './kit.js';
import { messageKey } from '../src/messages.js';
import { mailDriver, parseSender, teamRecipients, mailProblems, contactMail } from '../src/email.js';
import { scrub } from '../src/mailstate.js';

const DAY400 = 400 * 86_400;
/** Segundos de caducidad que le quedan a una clave del KV de pruebas (la fecha de caducidad se anota al guardar). */
const ttlOf = (env, key) => env.KV.exp.get(key) - Math.floor(Date.now() / 1000);
/** Registro del mensaje con ese id, tal como está guardado en KV. */
const stored = (env, id) => JSON.parse(env.KV.m.get(messageKey(id)));

// ───────────────────────────────────────── M1 · el mensaje se guarda siempre y el correo dice la verdad
test('M1 · contacto con Resend: se guarda con todos los campos y 400 días de retención, el correo al equipo sale completo y la respuesta es { ok, id, emailed:{ sent, reason } } sin error', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }), box = provider(), t0 = Date.parse('2026-10-28T09:30:00Z');
  const { r, j, ip } = await contactPost(env, box, {}, { now: t0 });
  assert.equal(r.status, 200); assert.deepEqual(Object.keys(j).sort(), ['emailed', 'id', 'ok']); assert.equal(j.ok, true);
  assert.match(j.id, /^CT-20261028-0001-[0-9A-Z]{3}$/); assert.deepEqual(j.emailed, { sent: true, reason: 'sent' });
  assert.equal(box.calls.length, 1); const c = box.calls[0];
  assert.equal(c.url, 'https://api.resend.com/emails'); assert.equal(c.headers.Authorization, 'Bearer re_test');
  assert.deepEqual(c.body.to, ['info@grupotorivac.com', 'mzamora@torivac.com'], 'los destinatarios de ORDER_TO'); assert.equal(c.body.subject, 'Contacto web · Ana Pérez');
  assert.equal(c.body.reply_to, 'ana@acme.es'); assert.equal(c.body.from, 'Torivac Web <pedidos@torivac.com>');
  for (const s of ['Ana Pérez', 'ana@acme.es', 'Idioma: es', j.id, 'Necesito 50 toroidales']) { assert.ok(c.body.text.includes(s), `texto: ${s}`); assert.ok(c.body.html.includes(s), `html: ${s}`); }
  assert.deepEqual(stored(env, j.id), { id: j.id, at: '2026-10-28T09:30:00.000Z', name: 'Ana Pérez', email: 'ana@acme.es', message: 'Necesito 50 toroidales', lang: 'es', ip, emailed: { sent: true, reason: 'sent' } });
  const ttl = ttlOf(env, messageKey(j.id)); assert.ok(ttl > DAY400 - 30 && ttl <= DAY400, `retención de 400 días (${ttl} s)`);
  assert.equal(env.KV.m.get('counter:ct:20261028'), '1', 'contador propio de los mensajes'); assert.ok(!env.KV.m.has('counter:20261028'), 'no toca el de los pedidos');
  assert.ok(!keys(env).some((k) => k.includes('acme') || k.includes(ip)), 'ni el correo ni la IP en ninguna clave');
});
test('M1 · si Resend rechaza el envío: 200 con sent:false/failed (el visitante no ve el error) y el registro guarda el error corto «Resend 403: …»', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }), box = provider({ status: 403, reply: { statusCode: 403, message: 'The gmail.com domain is not verified.', name: 'validation_error' } });
  const { r, j } = await contactPost(env, box);
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.deepEqual(j.emailed, { sent: false, reason: 'failed' });
  assert.deepEqual(stored(env, j.id).emailed, { sent: false, reason: 'failed', error: 'Resend 403: The gmail.com domain is not verified.' });
  const sinMensaje = await contactPost(env, provider({ status: 500, reply: '<html>caído</html>' }));
  assert.equal(stored(env, sinMensaje.j.id).emailed.error, 'Resend respondió 500', 'sin mensaje del proveedor, solo el estado');
  const red = await contactPost(env, provider({ throws: 'getaddrinfo ENOTFOUND api.resend.com' }));
  assert.deepEqual(red.j.emailed, { sent: false, reason: 'failed' }); assert.equal(stored(env, red.j.id).emailed.error, 'Resend: no se pudo conectar (getaddrinfo ENOTFOUND api.resend.com)');
});
test('M1 · sin controlador o con credenciales incompletas: el mensaje se guarda igual y reason dice por qué (off · skipped) sin llamar a ningún proveedor', async () => {
  const casos = [
    [{ EMAIL_PROVIDER: 'none', RESEND_API_KEY: 're_test' }, 'off', /EMAIL_PROVIDER=none/],
    [{ EMAIL_PROVIDER: 'paloma', RESEND_API_KEY: 're_test' }, 'off', /EMAIL_PROVIDER no válido/],
    [{}, 'skipped', /Falta RESEND_API_KEY/],
    [{ EMAIL_PROVIDER: 'brevo', RESEND_API_KEY: 're_test' }, 'skipped', /Falta BREVO_API_KEY/],
    [{ RESEND_API_KEY: 're_test', ORDER_FROM: 'esto no es un remitente' }, 'skipped', /ORDER_FROM no válido/],
    [{ RESEND_API_KEY: 're_test', ORDER_FROM: 'Torivac <a@b.es>\r\nBcc: espia@evil.example' }, 'skipped', /ORDER_FROM no válido/],
    [{ RESEND_API_KEY: 're_test', ORDER_TO: ' , ,' }, 'skipped', /Sin destinatarios/],
    [{ RESEND_API_KEY: 're_test', ORDER_TO: 'info@x.es,esto-no-es-un-correo' }, 'sent', null],           // un destinatario mal escrito se ignora y el otro lo recibe
  ];
  for (const [extra, reason, error] of casos) {
    const env = mkEnv(extra), box = provider(); const { r, j } = await contactPost(env, box);
    assert.equal(r.status, 200, JSON.stringify(extra)); assert.equal(j.ok, true); assert.deepEqual(j.emailed, { sent: reason === 'sent', reason }, JSON.stringify(extra));
    const rec = stored(env, j.id); assert.equal(rec.message, 'Necesito 50 toroidales', 'guardado igualmente');
    if (error) { assert.equal(box.calls.length, 0, 'ningún proveedor llamado'); assert.match(rec.emailed.error, error); assert.ok(rec.emailed.error.length <= 160); } else { assert.deepEqual(box.calls[0].body.to, ['info@x.es']); assert.ok(!('error' in rec.emailed)); }
  }
});
test('M1 · Brevo: POST https://api.brevo.com/v3/smtp/email con api-key, sender, to, replyTo, subject, htmlContent y textContent; 201 → sent', async () => {
  const env = mkEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-FALSA-123', ORDER_FROM: 'Torivac Web <pedidos@grupotorivac.com>' }), box = provider();
  const { r, j } = await contactPost(env, box, { name: 'Eva Ruiz', email: 'eva@cliente.es', message: 'Hola\nsegunda línea' });
  assert.equal(r.status, 200); assert.deepEqual(j.emailed, { sent: true, reason: 'sent' }); assert.equal(box.calls.length, 1); const c = box.calls[0];
  assert.equal(c.url, 'https://api.brevo.com/v3/smtp/email'); assert.deepEqual(c.headers, { 'api-key': 'xkeysib-FALSA-123', 'Content-Type': 'application/json', accept: 'application/json' });
  assert.deepEqual(Object.keys(c.body).sort(), ['htmlContent', 'replyTo', 'sender', 'subject', 'textContent', 'to']);
  assert.deepEqual(c.body.sender, { name: 'Torivac Web', email: 'pedidos@grupotorivac.com' }); assert.deepEqual(c.body.to, [{ email: 'info@grupotorivac.com' }, { email: 'mzamora@torivac.com' }]);
  assert.deepEqual(c.body.replyTo, { email: 'eva@cliente.es' }); assert.equal(c.body.subject, 'Contacto web · Eva Ruiz');
  assert.ok(c.body.htmlContent.includes('Hola<br>segunda línea') && c.body.textContent.includes('Hola\nsegunda línea') && c.body.textContent.includes(j.id));
  assert.deepEqual(stored(env, j.id).emailed, { sent: true, reason: 'sent' });
});
test('M1 · Brevo rechaza: «Brevo <estado>: <mensaje>» (mensaje recortado a 120, sin eco de la clave); sin mensaje, «Brevo respondió <estado>»', async () => {
  const KEY = 'sk-SECRETO-123', env = mkEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: KEY });
  const largo = await contactPost(env, provider({ status: 401, reply: { code: 'unauthorized', message: `Key not found: ${KEY} ${'palabra '.repeat(40)}` } }));
  const e1 = stored(env, largo.j.id).emailed; assert.equal(e1.reason, 'failed'); assert.match(e1.error, /^Brevo 401: Key not found: \*\*\* [a-z ]+$/); assert.ok(e1.error.length <= 'Brevo 401: '.length + 120 && e1.error.length >= 'Brevo 401: '.length + 100, `mensaje recortado a 120 (${e1.error.length})`); assert.ok(!e1.error.includes(KEY));
  const corto = await contactPost(env, provider({ status: 400, reply: { code: 'invalid_parameter', message: 'Sender is not valid' } })); assert.equal(stored(env, corto.j.id).emailed.error, 'Brevo 400: Sender is not valid');
  const mudo = await contactPost(env, provider({ status: 503, reply: '' })); assert.equal(stored(env, mudo.j.id).emailed.error, 'Brevo respondió 503');
  const red = await contactPost(env, provider({ throws: `fallo de red con ${KEY}` })); assert.equal(stored(env, red.j.id).emailed.error, 'Brevo: no se pudo conectar (fallo de red con ***)');
  assert.equal(messagesIn(env).length, 4); assert.ok(!JSON.stringify([...env.KV.m.values()]).includes(KEY), 'la clave no está en ningún registro');
});
test('M1 · el almacenamiento caído devuelve 500 «No se pudo guardar el mensaje», lo registra en el log, NO envía nada y nunca dice «recibido»', async () => {
  class MsgDeadKV extends FakeKV { async put(k, v, o) { if (k.startsWith('msg:')) throw new Error('KV PUT failed: 500'); return super.put(k, v, o); } }
  class AllDeadKV extends FakeKV { async put() { throw new Error('KV PUT failed: 500'); } }
  for (const KV of [new MsgDeadKV(), new AllDeadKV()]) {
    const env = mkEnv({ KV, RESEND_API_KEY: 're_test' }), box = provider(); let res;
    const logs = await withLog(async () => { res = await contactPost(env, box); });
    assert.equal(res.r.status, 500); assert.deepEqual(res.j, { ok: false, error: 'No se pudo guardar el mensaje' }); assert.equal(box.calls.length, 0, 'sin guardar no se envía: ni «recibido» ni correo');
    assert.ok(logs.some((l) => l.includes('No se pudo guardar el mensaje') && l.includes('KV PUT failed: 500')), 'el detalle va al log del servidor'); assert.ok(!logs.join('\n').includes('Necesito 50 toroidales') && !logs.join('\n').includes('ana@acme.es'), 'sin datos del visitante en el log');
  }
  const sinKv = mkEnv({ KV: undefined, RESEND_API_KEY: 're_test' }); let r2; await withLog(async () => { r2 = await contactPost(sinKv, provider()); });
  assert.equal(r2.r.status, 500); assert.equal(r2.j.error, 'No se pudo guardar el mensaje', 'sin almacén tampoco');
});
test('M1 · si solo falla la segunda escritura (KV: 1 escritura por segundo y clave) se reintenta una vez; si falla también, la respuesta sigue diciendo la verdad del correo y el registro no afirma que salió', async () => {
  /** KV que rechaza la segunda escritura de una clave de mensaje las `fails` primeras veces que se intenta. */
  class SlowKV extends FakeKV { constructor(fails) { super(); this.fails = fails; this.n = new Map(); } async put(k, v, o) { if (k.startsWith('msg:')) { const n = (this.n.get(k) || 0) + 1; this.n.set(k, n); if (n >= 2 && n < 2 + this.fails) throw new Error('KV PUT failed: 429 Too Many Requests'); } return super.put(k, v, o); } }
  const uno = mkEnv({ KV: new SlowKV(1), RESEND_API_KEY: 're_test' }); const a = await contactPost(uno, provider(), {}, { retryMs: 0 });
  assert.deepEqual(a.j.emailed, { sent: true, reason: 'sent' }); assert.deepEqual(stored(uno, a.j.id).emailed, { sent: true, reason: 'sent' }, 'el reintento dejó el resultado real');
  const dos = mkEnv({ KV: new SlowKV(2), RESEND_API_KEY: 're_test' }); let b; const logs = await withLog(async () => { b = await contactPost(dos, provider(), {}, { retryMs: 0 }); });
  assert.equal(b.r.status, 200); assert.deepEqual(b.j.emailed, { sent: true, reason: 'sent' }, 'el correo sí salió y se dice');
  assert.deepEqual(stored(dos, b.j.id).emailed, { sent: false, reason: 'failed', error: 'Envío sin confirmar' }, 'el registro no afirma lo que no pudo anotar'); assert.ok(logs.some((l) => l.includes('No se pudo anotar el resultado del correo')));
});
test('M1 · los límites de contacto siguen igual: 6.º mensaje de un visitante → 429 sin guardar ni enviar; honeypot, campos no válidos y Turnstile fallido → 400 sin guardar ni enviar', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }), box = provider(), ip = '203.0.113.77'; const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await contactPost(env, box, { message: `mensaje ${i}` }, { ip })).r.status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]); assert.equal(messagesIn(env).length, 5); assert.equal(box.calls.length, 5);
  assert.equal((await contactPost(env, box, { message: 'otro /64' }, { ip: '2001:db8:5:5::1' })).r.status, 200, 'otro visitante no se ve afectado');
  const e2 = mkEnv({ RESEND_API_KEY: 're_test' }), b2 = provider();
  for (const over of [{ hp: 'soy un bot' }, { name: 'A' }, { email: 'no-es-correo' }, { message: 'ab' }, { privacy: false }, { name: ['x'] }, { message: 5 }]) assert.equal((await contactPost(e2, b2, over)).r.status, 400, JSON.stringify(over));
  const e3 = mkEnv({ RESEND_API_KEY: 're_test', TURNSTILE_SECRET: 'turnstile-falso' }), b3 = provider();
  /** fetch que responde al desafío de Turnstile con éxito o fracaso y deja pasar lo demás al proveedor simulado. */
  const conTurnstile = (ok) => ({ calls: b3.calls, fetchImpl: async (u, o) => (String(u).includes('turnstile') ? new Response(JSON.stringify({ success: ok })) : b3.fetchImpl(u, o)) });
  const mal = await contactPost(e3, conTurnstile(false), { turnstileToken: 'tok' }); assert.equal(mal.r.status, 400); assert.equal(mal.j.error, 'Verificación anti-spam fallida');
  assert.equal((await contactPost(e3, conTurnstile(true), {})).r.status, 400, 'sin token'); assert.equal(messagesIn(e2).length + messagesIn(e3).length, 0, 'nada guardado'); assert.equal(b2.calls.length + b3.calls.length, 0, 'nada enviado');
  assert.equal((await contactPost(e3, conTurnstile(true), { turnstileToken: 'tok' })).r.status, 200, 'con Turnstile bueno sí pasa'); assert.equal(messagesIn(e3).length, 1);
});
test('M1 · ids CT-AAAAMMDD-NNNN-XXX: el contador sube por día, el sufijo es aleatorio y 30 mensajes simultáneos con el contador de KV por detrás no se pisan', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }), box = provider(); const ids = [];
  for (const [i, when] of ['2026-10-28T08:00:00Z', '2026-10-28T08:01:00Z', '2026-10-29T08:00:00Z'].entries()) ids.push((await contactPost(env, box, { message: `mensaje ${i}` }, { now: Date.parse(when) })).j.id);
  assert.deepEqual(ids.map((x) => x.slice(0, 16)), ['CT-20261028-0001', 'CT-20261028-0002', 'CT-20261029-0001']); for (const id of ids) assert.match(id, /^CT-\d{8}-\d{4}-[0-9A-Z]{3}$/);
  class StaleKV extends FakeKV { async get(k) { return k.startsWith('counter:') ? null : super.get(k); } }                // el contador nunca avanza: todos reciben el mismo NNNN
  const rancio = mkEnv({ KV: new StaleKV(), RESEND_API_KEY: 're_test' }); let n = 0; const rand = () => { const k = n++; return [k % 36, Math.floor(k / 36) % 36, Math.floor(k / 1296) % 36]; };
  const res = await Promise.all(Array.from({ length: 30 }, () => contactPost(rancio, provider(), {}, { now: Date.parse('2026-10-28T08:00:00Z'), rand })));
  assert.equal(new Set(res.map((x) => x.j.id)).size, 30, 'ids distintos'); assert.equal(messagesIn(rancio).length, 30, '30 registros, no uno');
  const dos = new Set(); for (let i = 0; i < 5; i++) dos.add((await contactPost(mkEnv({ RESEND_API_KEY: 're_test' }), box)).j.id.slice(-3)); assert.ok(dos.size > 1, 'el sufijo es aleatorio');
});

// ───────────────────────────────────────── M4 · el mensaje del visitante es dato, nunca marcado
test('M4 · el formulario solo admite texto plano: etiquetas y scripts → 400 (no se guarda ni se envía nada); un texto normal con & < \" \' sí, guardado tal cual y con el HTML del correo escapado', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }), box = provider();
  for (const [field, bad] of [['name', '<b>Eve</b>'], ['message', '<script>alert(1)</script>'], ['message', '<img src=x onerror=alert(2)>']]) {
    const { r, j } = await contactPost(env, box, { [field]: bad });
    assert.equal(r.status, 400, bad); assert.equal(j.code, 'plain_text'); assert.equal(j.field, field);
  }
  assert.equal(box.calls.length, 0, 'no se envió nada'); assert.equal(keys(env, 'msg:').length, 0, 'ni se guardó');
  const msg = 'Precio < 50 € & envío "urgente" \'simples\'\nSi V<Vn y I>In ¿qué protección?';
  const { r, j } = await contactPost(env, box, { name: 'Eva\r\nBcc: espia@evil.example', message: msg });
  assert.equal(r.status, 200);
  const c = box.calls[0].body; assert.ok(!/[\r\n]/.test(c.subject), 'asunto en una línea'); assert.equal(c.subject, 'Contacto web · Eva Bcc: espia@evil.example');
  assert.ok(c.html.includes('Precio &lt; 50 € &amp; envío &quot;urgente&quot; &#39;simples&#39;<br>Si V&lt;Vn y I&gt;In'), 'el HTML del correo va escapado: ' + c.html);
  assert.equal(stored(env, j.id).message, msg, 'se guarda tal cual'); assert.equal(stored(env, j.id).name, 'Eva Bcc: espia@evil.example', 'y el nombre en una sola línea');
});
test('M4 · defensa en profundidad: aunque llegara marcado hasta el compositor del correo (contactMail), el HTML sale escapado y el asunto en una línea', () => {
  const m = contactMail({ id: 'CT-20261028-0001-AAA', name: '<b>Eve</b>\r\nBcc: espia@evil.example', email: 'e@e.es', lang: 'es', message: '<script>alert(1)</script>\n<img src=x onerror=alert(2)> & "comillas"' });
  assert.ok(!/[\r\n]/.test(m.subject)); assert.ok(!/<(script|img)\b/i.test(m.html), m.html);
  assert.ok(m.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;img src=x onerror=alert(2)&gt; &amp; &quot;comillas&quot;') && m.html.includes('<b>&lt;b&gt;Eve&lt;/b&gt; Bcc: espia@evil.example</b>'));
});
test('M4 · una clave «sk-SECRETO-123» que el proveedor repite en su error no aparece en ninguna respuesta, registro, estado, correo ni log (Resend y Brevo)', async () => {
  const KEY = 'sk-SECRETO-123', SECRETO = 'SECRETO-123';
  for (const [nombre, extra] of [['Resend', { RESEND_API_KEY: KEY }], ['Brevo', { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: KEY, RESEND_API_KEY: undefined }]]) {
    const env = await orderEnv(extra), jefa = await signIn(env, 'jefa@torivac.com', 'manager'), vistas = []; const reply = { message: `Invalid API key ${KEY} (Bearer ${KEY}) api-key: ${KEY} token=${MASTER} ${'a1B2'.repeat(12)}`, code: 'unauthorized' };
    const logs = await withLog(async () => {
      const box = provider({ status: 401, reply });
      vistas.push(await (await call(env, '/api/contact', { method: 'POST', body: { name: 'Ana', email: 'a@b.es', message: 'hola', privacy: true }, ip: freshIp(), deps: { fetchImpl: box.fetchImpl } })).text());
      vistas.push(await (await call(env, '/api/order', { method: 'POST', body: order(), ip: freshIp(), deps: { fetchImpl: box.fetchImpl } })).text());
      const prueba = await call(env, '/api/mail/test', { method: 'POST', token: jefa.token, body: {}, deps: { fetchImpl: box.fetchImpl } }); const pj = await prueba.clone().json(); vistas.push(await prueba.text());
      assert.equal(pj.ok, false); assert.match(pj.error, new RegExp(`^${nombre} 401: Invalid API key \\*\\*\\* \\(Bearer \\*\\*\\*\\) api-key: \\*\\*\\* token=\\*\\*\\* `)); assert.ok(pj.error.length <= 160);
      for (const ruta of ['/api/mail/status', '/api/messages', '/api/orders']) vistas.push(await (await call(env, ruta, { token: jefa.token })).text());
      vistas.push(await (await call(env, '/api/health')).text());
      vistas.push(await (await call(env, '/api/mail/test', { method: 'POST', token: MASTER, body: {}, deps: { fetchImpl: provider({ throws: `socket cerrado ${KEY}` }).fetchImpl } })).text());      // y una caída de red cuyo texto lleva la clave
    });
    const todo = [...vistas, ...logs, ...env.KV.m.values()].join('\n');
    assert.ok(!todo.includes(SECRETO), `${nombre}: la clave aparece en alguna salida`); assert.ok(!todo.includes(MASTER), `${nombre}: el token maestro tampoco`);
    assert.equal(JSON.parse(env.KV.m.get('mail:last')).error, `${nombre}: no se pudo conectar (socket cerrado ***)`, 'el último intento guarda el error ya limpio');
  }
});
test('M4 · scrub: tacha valores exactos del entorno y formas típicas de clave (Bearer, api-key, re_…, sk-…, xkeysib-…, cadenas opacas) y deja el resto', () => {
  const env = { RESEND_API_KEY: 'clave-propia-9999', ORDER_TO: 'info@x.es', KV: {} };
  assert.equal(scrub(env, 'falla con clave-propia-9999 en la cabecera'), 'falla con *** en la cabecera');
  assert.equal(scrub(env, 'Bearer abcdef123456 y Basic dXNlcjpwYXNz y re_abcdefghijklmnopqr y sk-live_abc12345 y xkeysib-0123456789abcdef0123'), 'Bearer *** y Basic *** y *** y *** y ***');
  assert.equal(scrub(env, 'api-key: zzzzzzzz, password=hunter2; token = abc'), 'api-key: ***, password=***; token = ***');
  assert.equal(scrub(env, `id ${'a'.repeat(40)} fin`), 'id *** fin');
  assert.equal(scrub(env, 'El dominio grupotorivac.com no está verificado, re-envía la petición\nmañana'), 'El dominio grupotorivac.com no está verificado, re-envía la petición mañana', 'texto normal intacto y en una línea');
  assert.equal(scrub(env, 'x'.repeat(500)), '***', 'una cadena opaca larga se tacha entera'); assert.equal(scrub(env, 'palabra '.repeat(100)).length, 159, 'tope de 160 (el último espacio sobra)'); assert.equal(scrub(env, 'abc '.repeat(100), 20), 'abc abc abc abc abc');
  assert.equal(scrub(env, undefined), ''); assert.equal(scrub(null, 'sin entorno'), 'sin entorno');
});

// ───────────────────────────────────────── M3 · controladores, remitente y pedidos
test('M3 · EMAIL_PROVIDER: resend por defecto (también vacío), brevo y none; mayúsculas y espacios no importan; un valor desconocido falla cerrado como «none»', () => {
  for (const [v, d] of [[undefined, 'resend'], [null, 'resend'], ['', 'resend'], ['  ', 'resend'], ['resend', 'resend'], [' Brevo ', 'brevo'], ['BREVO', 'brevo'], ['none', 'none'], ['NONE', 'none'], ['sendgrid', 'none'], ['smtp', 'none'], ['0', 'none']]) assert.equal(mailDriver({ EMAIL_PROVIDER: v }), d, String(v));
  assert.deepEqual(mailProblems(mkEnv({ EMAIL_PROVIDER: 'sendgrid' })), ['EMAIL_PROVIDER']);
});
test('M3 · remitente ORDER_FROM: «Nombre <correo@dominio>» o solo el correo (por defecto Torivac Web <pedidos@torivac.com>); controles, < > " \\ o un correo roto no valen', () => {
  assert.deepEqual(parseSender({}), { ok: true, name: 'Torivac Web', email: 'pedidos@torivac.com', from: 'Torivac Web <pedidos@torivac.com>' });
  assert.deepEqual(parseSender({ ORDER_FROM: '  Torivac Web <pedidos@grupotorivac.com> ' }), { ok: true, name: 'Torivac Web', email: 'pedidos@grupotorivac.com', from: 'Torivac Web <pedidos@grupotorivac.com>' });
  assert.deepEqual(parseSender({ ORDER_FROM: 'pedidos@grupotorivac.com' }), { ok: true, name: '', email: 'pedidos@grupotorivac.com', from: 'pedidos@grupotorivac.com' });
  assert.deepEqual(parseSender({ ORDER_FROM: '"Torivac, S.L." <pedidos@grupotorivac.com>' }), { ok: true, name: 'Torivac, S.L.', email: 'pedidos@grupotorivac.com', from: '"Torivac, S.L." <pedidos@grupotorivac.com>' }, 'con coma, el nombre va entre comillas');
  assert.deepEqual(parseSender({ ORDER_FROM: '<pedidos@grupotorivac.com>' }), { ok: true, name: '', email: 'pedidos@grupotorivac.com', from: 'pedidos@grupotorivac.com' });
  assert.equal(parseSender({ ORDER_FROM: '' }).ok, true, 'vacío = el de siempre');
  for (const malo of ['Torivac', 'Torivac <pedidos>', 'Torivac <pedidos@x.es> más', 'A<B <pedidos@x.es>', 'Torivac\r\nBcc: x@y.es <pedidos@x.es>', 'Torivac <pedidos@x.es>\nBcc: x@y.es', 'Tori\u0007vac <pedidos@x.es>', '"a\\b" <pedidos@x.es>', `${'N'.repeat(81)} <pedidos@x.es>`, 'Torivac <a@b.es,c@d.es>', 'Torivac <<pedidos@x.es>>']) assert.equal(parseSender({ ORDER_FROM: malo }).ok, false, JSON.stringify(malo));
  assert.deepEqual(teamRecipients({ ORDER_TO: ' a@b.es , ,c@d.es,no-valido, e@f.es ' }), ['a@b.es', 'c@d.es', 'e@f.es']);
});
test('M3 · pedido con Brevo: aviso al equipo con el PDF en attachment[{ name, content }] y copia al cliente; el pedido guarda reason y error del aviso', async () => {
  const env = await orderEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-FALSA-123', RESEND_API_KEY: undefined, ORDER_FROM: 'Torivac Web <pedidos@grupotorivac.com>' }), box = provider();
  const r = await call(env, '/api/order', { method: 'POST', body: order({ pdf: PDF_B64 }), ip: freshIp(), deps: { fetchImpl: box.fetchImpl } }); const j = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(j.emailed, { team: true, customer: true, skipped: false, customer_reason: 'sent' }, 'la respuesta del pedido no cambia de forma'); assert.equal(box.calls.length, 2);
  const team = box.calls.find((c) => c.body.to.some((t) => t.email === 'info@grupotorivac.com')).body, copy = box.calls.find((c) => c.body.to[0].email === 'victima@ejemplo.org').body;
  assert.deepEqual(team.attachment, [{ name: `${j.number}.pdf`, content: PDF_B64 }]); assert.equal(team.replyTo.email, 'victima@ejemplo.org'); assert.ok(!('attachment' in copy) && !('replyTo' in copy), 'la copia al cliente sin adjunto ni Reply-To');
  assert.equal(team.subject, `[Web Torivac] Pedido ${j.number} · Ana Pérez`);
  const rec = JSON.parse(env.KV.m.get(`order:${j.number}`)); assert.deepEqual(rec.emailed, { team: true, customer: true, skipped: false, customer_reason: 'sent', reason: 'sent', error: '' });
  assert.equal(JSON.parse(env.KV.m.get('mail:last')).kind, 'order');
});
test('M3 · pedido con el aviso rechazado o sin controlador: el pedido guarda emailed.reason y emailed.error; la respuesta pública no cambia; el error solo lo ve un manager', async () => {
  const env = await orderEnv(), jefa = await signIn(env, 'jefa@torivac.com', 'manager'), ana = await signIn(env, 'victima@ejemplo.org', 'client');
  const box = provider({ status: 403, reply: { statusCode: 403, message: 'The domain is not verified', name: 'validation_error' } });
  const r = await call(env, '/api/order', { method: 'POST', body: order(), ip: freshIp(), deps: { fetchImpl: box.fetchImpl } }); const j = await r.json();
  assert.deepEqual(j.emailed, { team: false, customer: false, skipped: false, customer_reason: 'failed' });
  const rec = JSON.parse(env.KV.m.get(`order:${j.number}`)); assert.equal(rec.emailed.reason, 'failed'); assert.equal(rec.emailed.error, 'Resend 403: The domain is not verified');
  const vistoManager = (await (await call(env, '/api/orders', { token: jefa.token })).json()).orders[0].emailed, vistoCliente = (await (await call(env, '/api/orders', { token: ana.token })).json()).orders[0].emailed;
  assert.equal(vistoManager.error, 'Resend 403: The domain is not verified'); assert.equal(vistoManager.reason, 'failed'); assert.ok(!('error' in vistoCliente), 'el cliente no ve el error'); assert.equal(vistoCliente.reason, 'failed');
  for (const [extra, reason] of [[{ EMAIL_PROVIDER: 'none' }, 'off'], [{ RESEND_API_KEY: undefined }, 'skipped']]) {
    const e2 = await orderEnv(extra), b2 = provider(); const x = await (await call(e2, '/api/order', { method: 'POST', body: order(), ip: freshIp(), deps: { fetchImpl: b2.fetchImpl } })).json();
    assert.equal(x.ok, true); assert.deepEqual([x.emailed.team, x.emailed.skipped, x.emailed.customer_reason], [false, true, 'skipped']); assert.equal(b2.calls.length, 0);
    const rec2 = JSON.parse(e2.KV.m.get(`order:${x.number}`)); assert.deepEqual([rec2.emailed.reason, rec2.emailed.error], [reason, 'correo sin configurar']);
  }
});
