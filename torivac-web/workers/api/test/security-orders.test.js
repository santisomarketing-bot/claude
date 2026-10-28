// Pruebas de los arreglos de seguridad del PEDIDO y de la CLAVE DE LÍMITE: D1 (copia al cliente, PDF, topes, campos de una línea, correo estricto, solo cadenas),
// D2 (ipKey y /64) y D7 (visibilidad, número de pedido, listado acotado, referencias con Object.hasOwn). Cada prueba reproduce el ataque del informe del revisor y comprueba que ya no funciona
// y que lo legítimo sigue funcionando. Mismos nombres que en el PHP en lo posible (D1 · …).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ipKey } from '../src/util.js';
import { parseOrder, parseContact, isEmail, parsePdf } from '../src/validate.js';
import { copyMode, intVar, uorderPrefix } from '../src/orders.js';
import { mkEnv, CountKV, FakeKV, CATALOG, MASTER } from './helpers.js';
import { call, signIn, mailbox, order, orderEnv, keys, PDF_B64, REF, REF2 } from './kit.js';

const FX = JSON.parse(fs.readFileSync(new URL('../../../shared/ip-key.fixtures.json', import.meta.url), 'utf8'));
let seq = 0;
/** IP de prueba distinta cada vez (así el límite por visitante de 8 pedidos no interfiere con pruebas que envían muchos). */
const nextIp = () => `10.${(seq >> 16) & 255}.${(seq >> 8) & 255}.${seq++ & 255}`;
/** POST /api/order anónimo desde la IP dada con el cuerpo dado y el buzón dado → { r (Response), j (JSON) }. */
const post = async (env, box, body, ip = nextIp(), extra = {}) => { const r = await call(env, '/api/order', { method: 'POST', body, ip, deps: { fetchImpl: box.fetchImpl, ...extra } }); return { r, j: await r.json() }; };

// ───────────────────────────────────────── D1 · copia al cliente
test('D1 · la copia al cliente solo lleva contenido del servidor: ni nombre, ni empresa, ni teléfono, ni notas, ni adjunto; asunto fijo (W1)', async () => {
  const env = await orderEnv(); const box = mailbox();
  const phishing = 'IMPORTANTE: su cuenta Torivac ha sido bloqueada. Verifique en http://torivac-verifica.example/login';
  const { r, j } = await post(env, box, order({ customer: { name: 'Soporte Torivac', company: 'Banco Falso S.A.', email: 'victima@ejemplo.org', phone: '+34 600 111 222', notes: phishing, privacy: true }, pdf: PDF_B64 }));     // anónimo, sin identificarse
  assert.equal(r.status, 200); assert.equal(j.ok, true);
  assert.equal(box.sent.length, 2);
  const team = box.sent.find((m) => m.to.includes('info@grupotorivac.com')), copy = box.sent.find((m) => m.to[0] === 'victima@ejemplo.org');
  assert.deepEqual(copy.to, ['victima@ejemplo.org']);
  assert.equal(copy.subject, `Torivac · copia de tu presupuesto ${j.number}`);
  assert.equal(copy.attachments, undefined, 'la copia no lleva adjunto'); assert.equal(copy.reply_to, undefined);
  for (const s of ['Soporte Torivac', 'Banco Falso', '600 111 222', 'torivac-verifica', 'IMPORTANTE', 'bloqueada', 'Verifique']) assert.ok(!copy.html.includes(s) && !copy.text.includes(s) && !copy.subject.includes(s), `nada del visitante en la copia: ${s}`);
  for (const s of [j.number, REF, REF2, 'Si no has pedido tú este presupuesto, ignora este mensaje.']) assert.ok(copy.text.includes(s), `la copia lleva ${s}`);
  assert.match(copy.html, /67,65/); assert.match(copy.html, /Total \(sin IVA\)/);                 // líneas valoradas por el servidor
  assert.equal(team.attachments[0].content, PDF_B64, 'el PDF del visitante solo va al equipo');
  assert.ok(team.text.includes('El PDF adjunto lo ha generado el navegador del cliente: el importe que vale es el calculado por el servidor (arriba)') && team.html.includes('el importe que vale es el calculado por el servidor (arriba)'));
  assert.ok(team.text.includes(phishing), 'el equipo sí ve lo que escribió el visitante');
  assert.deepEqual(j.emailed, { team: true, customer: true, skipped: false, customer_reason: 'sent' });
});
test('D1 · idioma de la copia: texto fijo en el idioma del pedido (es, en, fr, de)', async () => {
  const want = { es: 'Si no has pedido tú este presupuesto, ignora este mensaje.', en: 'If you did not request this quote, please ignore this message.', fr: 'Si vous n’avez pas demandé ce devis, ignorez ce message.', de: 'Wenn Sie dieses Angebot nicht angefordert haben, ignorieren Sie diese Nachricht bitte.' };
  for (const [lang, line] of Object.entries(want)) {
    const env = await orderEnv(); const box = mailbox(); const { j } = await post(env, box, order({ lang }));
    assert.equal(j.ok, true); const copy = box.sent.find((m) => m.to[0] === 'victima@ejemplo.org');
    assert.ok(copy.text.includes(line), `${lang}: ${line}`); assert.equal(copy.subject, `Torivac · copia de tu presupuesto ${j.number}`, 'el asunto es fijo en todos los idiomas');
  }
});
test('D1 · ORDER_COPY: capped por defecto; off (o cualquier valor desconocido) nunca envía copia; customer_reason dice por qué', async () => {
  const run = async (extra, body = order()) => { const env = await orderEnv(extra); const box = mailbox(); const { j } = await post(env, box, body); return { j, box }; };
  let x = await run({}); assert.deepEqual([x.j.emailed.customer, x.j.emailed.customer_reason, x.box.sent.length], [true, 'sent', 2]);       // por defecto = capped
  x = await run({ ORDER_COPY: 'capped' }); assert.equal(x.j.emailed.customer_reason, 'sent');
  x = await run({ ORDER_COPY: ' CAPPED ' }); assert.equal(x.j.emailed.customer_reason, 'sent', 'sin importar mayúsculas ni espacios');
  for (const v of ['off', 'OFF', '', 'on', 'always', 'true', 'capped,x', '0']) { x = await run({ ORDER_COPY: v }); assert.deepEqual([x.j.emailed.customer, x.j.emailed.customer_reason, x.box.sent.length], [false, 'off', 1], `ORDER_COPY=«${v}» falla cerrado`); }
  assert.equal(copyMode({}), 'capped'); assert.equal(copyMode({ ORDER_COPY: 'otro' }), 'off');
  x = await run({}, order({ copy: false })); assert.deepEqual([x.j.emailed.customer, x.j.emailed.customer_reason, x.box.sent.length], [false, 'not_requested', 1]);           // el visitante no la quiere
  const sin = mkEnv(); await sin.KV.put('prices:current', JSON.stringify({ items: { [REF]: { p: 1 } } })); const nobox = mailbox();
  const s = await post(sin, nobox, order()); assert.deepEqual([s.j.emailed.skipped, s.j.emailed.customer_reason, nobox.sent.length], [true, 'skipped', 0]);          // sin RESEND_API_KEY
  const bad = mailbox({ fail: true }); const f = await post(await orderEnv(), bad, order());
  assert.deepEqual([f.j.ok, f.j.emailed.team, f.j.emailed.customer, f.j.emailed.customer_reason], [true, false, false, 'failed']);                                   // Resend rechaza: el pedido se guarda igual
});
test('D1 · tope por destinatario: 2 copias cada 24 h (clave con hash: nunca el correo en la clave); pasado el tope el pedido se registra y se avisa al equipo, pero no hay copia', async () => {
  const env = await orderEnv(); const box = mailbox(); const t0 = Date.parse('2026-10-28T08:00:00Z');
  /** Envía un pedido de ejemplo con la fecha y el correo dados desde una IP nueva. */
  const send = (at, email = 'victima@ejemplo.org') => post(env, box, order({ customer: { name: 'Ana', email, privacy: true } }), nextIp(), { now: new Date(at) });
  const r = []; for (let i = 0; i < 4; i++) r.push((await send(t0 + i * 60_000)).j);
  assert.deepEqual(r.map((x) => x.emailed.customer_reason), ['sent', 'sent', 'limit', 'limit']);
  assert.deepEqual(r.map((x) => x.emailed.team), [true, true, true, true], 'el equipo recibe siempre el aviso');
  assert.equal(box.sent.filter((m) => m.to[0] === 'victima@ejemplo.org').length, 2, 'solo 2 copias al tercero');
  for (const x of r) assert.ok(JSON.parse(await env.KV.get(`order:${x.number}`)), 'todos los pedidos quedan registrados');
  assert.ok(keys(env, 'rl:copy-to:').length === 1 && !keys(env).some((k) => k.includes('victima') || k.includes('ejemplo.org')), 'ninguna clave lleva el correo');
  assert.match(keys(env, 'rl:copy-to:')[0], /^rl:copy-to:[0-9a-f]{32}$/);
  const otro = await send(t0 + 5 * 60_000, 'otra@ejemplo.org'); assert.equal(otro.j.emailed.customer_reason, 'sent', 'otro destinatario no se ve afectado');
  const may = await send(t0 + 6 * 60_000, 'VICTIMA@EJEMPLO.ORG'); assert.equal(may.j.emailed.customer_reason, 'limit', 'las mayúsculas no esquivan el tope');
  const tarde = await send(t0 + 25 * 3_600_000); assert.equal(tarde.j.emailed.customer_reason, 'sent', 'pasadas 24 h vuelve a poder recibirla');
});
test('D1 · tope diario total de copias: ORDER_COPY_DAILY_MAX (150 por defecto)', async () => {
  const env = await orderEnv({ ORDER_COPY_DAILY_MAX: '3' }); const box = mailbox(); const t0 = Date.parse('2026-10-28T08:00:00Z');
  const reasons = []; for (let i = 0; i < 5; i++) reasons.push((await post(env, box, order({ customer: { name: 'Ana', email: `c${i}@ejemplo.org`, privacy: true } }), `203.0.113.${i + 1}`, { now: new Date(t0 + i * 1000) })).j.emailed.customer_reason);
  assert.deepEqual(reasons, ['sent', 'sent', 'sent', 'limit', 'limit']);
  assert.equal(box.sent.filter((m) => m.to[0].startsWith('c')).length, 3);
  assert.equal(intVar(undefined, 150), 150); assert.equal(intVar('abc', 150), 150); assert.equal(intVar('-5', 150), 150); assert.equal(intVar('0', 150, 0), 0); assert.equal(intVar('0', 120, 1), 120);
  const cero = await orderEnv({ ORDER_COPY_DAILY_MAX: '0' }); assert.equal((await post(cero, mailbox(), order())).j.emailed.customer_reason, 'limit', 'con 0 no sale ninguna copia');
});
test('D1 · tope global de pedidos por hora (ORDERS_PER_HOUR_MAX, 120 por defecto): 429 con el texto de siempre; las peticiones no válidas no gastan cupo', async () => {
  const env = await orderEnv({ ORDERS_PER_HOUR_MAX: '5' }); const box = mailbox(); const t0 = Date.parse('2026-10-28T08:00:00Z');
  for (let i = 0; i < 20; i++) assert.equal((await post(env, box, { customer: { name: 'x' } }, `198.51.100.${i + 1}`, { now: new Date(t0) })).r.status, 400);       // basura desde 20 IP distintas: no cuenta
  const codes = []; for (let i = 0; i < 7; i++) codes.push((await post(env, box, order(), `203.0.113.${i + 1}`, { now: new Date(t0 + i * 1000) })).r.status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
  const last = await post(env, box, order(), '203.0.113.99', { now: new Date(t0 + 10_000) }); assert.equal(last.j.error, 'Demasiados pedidos seguidos. Inténtalo en unos minutos.');
  const later = await post(env, box, order(), '203.0.113.98', { now: new Date(t0 + 61 * 60_000) }); assert.equal(later.r.status, 200, 'pasada la hora vuelve a aceptar');
  const def = await orderEnv(); const cods = []; for (let i = 0; i < 123; i++) cods.push((await post(def, mailbox(), order({ copy: false }), nextIp(), { now: new Date(t0 + i) })).r.status);
  assert.equal(cods.filter((c) => c === 200).length, 120, 'por defecto 120 pedidos por hora'); assert.deepEqual(cods.slice(120), [429, 429, 429]);
});

// ───────────────────────────────────────── D1 · PDF del visitante
test('D1 · PDF adjunto: base64 estricto, empieza por %PDF-, ≤ 4 MB decodificados; normalizado (sin saltos) y solo al equipo; si no cumple → 400 «PDF adjunto no válido»', async () => {
  const env = await orderEnv(); const box = mailbox();
  const malos = {
    'JVBER + texto que no es base64': 'JVBERi0xLjQK<<<no es un PDF>>>', 'base64 válido que no es un PDF': Buffer.from('hola mundo, no soy un PDF').toString('base64'),
    'con espacios': PDF_B64.slice(0, 20) + ' ' + PDF_B64.slice(20), 'con tabulador': PDF_B64.slice(0, 20) + '\t' + PDF_B64.slice(20), 'relleno en medio': PDF_B64.slice(0, 16) + '=' + PDF_B64.slice(16),
    'longitud no múltiplo de 4': PDF_B64.slice(0, -1), 'más de dos «=»': 'JVBERi0===', 'url-safe': PDF_B64.replace(/\+/g, '-').replace(/\//g, '_') + '-_', 'vacío tras quitar saltos': '\r\n', 'número': 12345678, 'cero': 0, 'true': true, 'lista': [PDF_B64], 'objeto': { a: PDF_B64 },
    'más de 4 MB': Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(4 * 1024 * 1024)]).toString('base64'),
  };
  for (const [que, pdf] of Object.entries(malos)) { const { r, j } = await post(env, box, order({ pdf }), nextIp()); assert.equal(r.status, 400, que); assert.equal(j.error, 'PDF adjunto no válido', que); }
  assert.equal(box.sent.length, 0, 'ningún correo salió con un PDF no válido');
  /** PDF en base64 que decodificado pesa exactamente n bytes (empieza por «%PDF-»). */
  const pdfDe = (n) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n - 9)]).toString('base64');
  assert.equal(parsePdf(pdfDe(4_000_000)).b64, pdfDe(4_000_000), '4 MB justos valen'); assert.equal(parsePdf(pdfDe(4_000_001)).error, 'PDF adjunto no válido', 'un byte más, no');
  const mime = PDF_B64.match(/.{1,16}/g).join('\r\n');                                               // base64 con saltos de línea cada 16 caracteres (estilo MIME)
  const ok = await post(env, box, order({ pdf: mime })); assert.equal(ok.r.status, 200);
  const team = box.sent.find((m) => m.to.includes('info@grupotorivac.com')); assert.equal(team.attachments[0].content, PDF_B64, 'se adjunta ya normalizado, sin saltos');
  assert.ok(!/[\r\n]/.test(team.attachments[0].content)); assert.equal(box.sent.find((m) => m.to[0] === 'victima@ejemplo.org').attachments, undefined);
  const sinPdf = await post(env, mailbox(), order()); assert.equal(sinPdf.r.status, 200, 'sin PDF también vale');
  for (const vacio of [null, '', false]) assert.equal((await post(env, mailbox(), order({ pdf: vacio }))).r.status, 200, `pdf ${JSON.stringify(vacio)} = sin PDF`);
});

// ───────────────────────────────────────── D1 · campos de una línea, correo estricto, solo cadenas
test('D1 · campos de una línea sin \\r \\n \\t ni controles: el asunto del correo al equipo no admite inyección de cabeceras (W10); las notas conservan los saltos de línea', async () => {
  const env = await orderEnv(); const box = mailbox();
  const { j } = await post(env, box, order({ customer: { name: 'Ana\r\nBcc: espia@evil.example\r\nX-Foo: 1', company: 'ACME\tS.L.\u0007', phone: '600\n123\u0000', email: 'ana@acme.es', notes: 'línea 1\r\nlínea 2\u0007\u001b[31m rojo\tfin', privacy: true } }));
  assert.equal(j.ok, true); const team = box.sent[0];
  assert.ok(!/[\r\n]/.test(team.subject), 'el asunto va en una línea'); assert.match(team.subject, /^\[Web Torivac\] Pedido TV-\d{8}-\d{4}-[0-9A-Z]{3} · Ana Bcc: espia@evil\.example X-Foo: 1$/);
  const rec = JSON.parse(await env.KV.get(`order:${j.number}`)).customer;
  assert.equal(rec.name, 'Ana Bcc: espia@evil.example X-Foo: 1'); assert.equal(rec.company, 'ACME S.L.'); assert.equal(rec.phone, '600 123');
  assert.equal(rec.notes, 'línea 1\nlínea 2[31m rojo fin', 'las notas conservan \\n; el tabulador pasa a un espacio y se quitan los controles raros');
  for (const bad of ['\r', '\u0007', '\u001b']) assert.ok(!rec.notes.includes(bad));
  const c = parseContact({ name: 'Eve\r\nBcc: x@y.zz', email: 'e@e.es', message: 'hola\r\ndos\u0007', privacy: true }).contact;
  assert.equal(c.name, 'Eve Bcc: x@y.zz'); assert.equal(c.message, 'hola\ndos');
});
test('D1 · correo estricto: sin , ; < > " ( ) [ ] \\ | ni espacios; parte local ≤ 64; dominio con punto y TLD ≥ 2 (A13)', () => {
  const malos = ['victima@x.co,root', 'a@b.es;c@d.es', 'a<b>@x.es', 'a@x.es>', '"a"@x.es', 'a(b)@x.es', 'a[b]@x.es', 'a\\b@x.es', 'a|b@x.es', 'a b@x.es', 'a@x .es', 'a!b@x.es', 'a#b@x.es', 'a=b@x.es', 'a*b@x.es', 'a/b@x.es', 'a@x', 'a@x.e', 'a@.es', 'a@x..es', '.a@x.es', 'a.@x.es', 'a..b@x.es', '@x.es', 'a@@x.es', 'a@b@x.es', `${'a'.repeat(65)}@x.es`, `a@${'b'.repeat(64)}.es`, 'ñ@x.es', 'a@ñ.es', 'a@-x.es', 'a@x-.es', 'a@x.123', 'a@[127.0.0.1]', ''];
  for (const m of malos) assert.equal(isEmail(m), false, m);
  for (const b of ['a@x.es', 'ana.perez+pedidos@sub.acme.co.uk', "o'brien@x.ie", 'a%b@x.es', `${'a'.repeat(64)}@x.es`, 'a_b-c@my-company.es', 'a@xn--p1ai.xn--p1ai']) assert.equal(isEmail(b), true, b);
  assert.equal(isEmail(`a@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(63)}.es`), false, 'más de 254 caracteres');
  assert.match(parseOrder(order({ customer: { name: 'Ana', email: 'victima@x.co,root', privacy: true } }), CATALOG).error, /Correo no válido/);
});
test('D1 · todos los campos de texto del pedido, del contacto y del login deben ser cadenas, si no → 400 (A9)', async () => {
  const env = await orderEnv(); const box = mailbox();
  for (const [campo, valor] of [['name', ['x']], ['name', { a: 1 }], ['name', 12], ['company', ['x']], ['phone', 600123123], ['notes', ['a', 'b']], ['email', ['a@b.es']], ['email', { x: 1 }]]) {
    const { r, j } = await post(env, box, order({ customer: { name: 'Ana', email: 'a@b.es', privacy: true, [campo]: valor } }), nextIp());
    assert.equal(r.status, 400, `${campo}=${JSON.stringify(valor)}`); assert.equal(j.ok, false);
  }
  for (const over of [{ lang: ['es'] }, { turnstileToken: { a: 1 } }, { customer: ['x'] }, { customer: 'Ana' }, { lines: [{ ref: ['P16633'], qty: 1 }] }, { lines: [{ ref: REF, qty: [3] }] }, { lines: [{ ref: REF, qty: true }] }, { lines: [{ ref: REF, qty: '0x10' }] }, { lines: [{ ref: REF, qty: '12' }] }, { lines: [{ ref: REF, qty: '1e3' }] }, { lines: ['P16633'] }, { lines: [null] }]) {
    const { r } = await post(env, box, order(over), nextIp()); assert.equal(r.status, 400, JSON.stringify(over));
  }
  const { r: ok } = await post(env, box, order({ lines: [{ ref: REF, qty: 12 }] })); assert.equal(ok.status, 200, 'una cantidad numérica sigue valiendo');
  assert.equal((await call(env, '/api/contact', { method: 'POST', body: { name: ['x', 'y'], email: 'a@b.es', message: 'hola', privacy: true }, ip: '203.0.113.1', deps: { fetchImpl: box.fetchImpl } })).status, 400);
  assert.equal((await call(env, '/api/contact', { method: 'POST', body: { name: 'Ana', email: 'a@b.es', message: ['hola'], privacy: true }, ip: '203.0.113.1' })).status, 400);
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: { email: ['jefa@torivac.com'], password: 'x' }, ip: '203.0.113.2' })).status, 400);
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: { email: 'jefa@torivac.com', password: { a: 1 } }, ip: '203.0.113.2' })).status, 400);
  assert.equal((await call(env, '/api/auth/login', { method: 'POST', body: {}, ip: '203.0.113.2' })).status, 400);
  assert.equal((await call(env, '/api/users', { method: 'POST', token: (await signIn(env, 'jefa@torivac.com', 'manager')).token, body: { email: ['x@y.es'], role: 'client', password: 'Contraseña-Larga-12' } })).status, 400);
  assert.equal(parseContact({ name: 'Ana', email: 'a@b.es', message: 'hola', privacy: true }).contact.name, 'Ana');
});

test('D1 · cantidades: números enteros de 1 a 1 000 000, también sumando líneas repetidas; nada de «0x10», cifras entre comillas, booleanos ni listas', () => {
  /** Valida un pedido con esas líneas contra el catálogo de pruebas. */
  const q = (lines) => parseOrder(order({ lines }), CATALOG);
  assert.deepEqual(q([{ ref: 'R100', qty: 1_000_000 }]).order.lines, [{ ref: 'R100', qty: 1_000_000 }]); assert.deepEqual(q([{ ref: 'R100', qty: 1e3 }]).order.lines, [{ ref: 'R100', qty: 1000 }]);
  for (const bad of [0, -1, 1.5, 1_000_001, '0x10', '12', ' 5', '', true, [3], null, NaN, '1e3']) assert.match(q([{ ref: 'R100', qty: bad }]).error, /Cantidad no válida para R100/, JSON.stringify(bad));
  assert.match(q([{ ref: 'R100', qty: 600_000 }, { ref: 'R100', qty: 600_000 }]).error, /Cantidad no válida para R100/, 'la suma de líneas repetidas también tiene tope');
  assert.deepEqual(q([{ ref: 'R100', qty: 2 }, { ref: 'R100', qty: 3 }]).order.lines, [{ ref: 'R100', qty: 5 }]);
  assert.equal(q([{ ref: ['R100'], qty: 1 }]).error, 'Petición no válida', 'una referencia que no es una cadena'); assert.equal(q(['R100']).error, 'Referencia desconocida: (vacía)');
});

// ───────────────────────────────────────── D2 · ipKey y /64
test('D2 · ipKey: todos los casos compartidos de shared/ip-key.fixtures.json (IPv4 tal cual, IPv6 → /64 canónico, ::ffff:a.b.c.d → IPv4, ilegible → «0»)', () => {
  assert.ok(FX.cases.length >= 14);
  for (const [entrada, salida] of FX.cases) assert.equal(ipKey(entrada), salida, `ipKey(${JSON.stringify(entrada)})`);
  for (const [a, b] of [['2001:db8:1:2::1', '2001:db8:1:2:ffff:ffff:ffff:ffff'], ['2001:DB8:1:2:0:0:0:5', '2001:db8:1:2::9']]) assert.equal(ipKey(a), ipKey(b));
  assert.notEqual(ipKey('2001:db8:1:2::1'), ipKey('2001:db8:1:3::1'));
  assert.equal(ipKey(null), '0'); assert.equal(ipKey(undefined), '0'); assert.equal(ipKey('01.2.3.4'), '0'); assert.equal(ipKey('256.1.1.1'), '0'); assert.equal(ipKey('1:2:3:4:5:6:7:8:9'), '0'); assert.equal(ipKey('1::2::3'), '0');
});
test('D2 · 100 direcciones de UN /64 comparten el límite del pedido (W1): solo 8 pasan; otro /64 u otra IPv4 no se ven afectados', async () => {
  const env = await orderEnv(); const box = mailbox(); const codes = [];
  for (let i = 0; i < 100; i++) codes.push((await post(env, box, order({ customer: { name: 'Bot', email: `v${i}@ejemplo.org`, privacy: true } }), `2001:db8:abcd:12:${(i + 1).toString(16)}::1`)).r.status);
  assert.equal(codes.filter((c) => c === 200).length, 8); assert.equal(codes.filter((c) => c === 429).length, 92);
  assert.equal((await post(env, box, order(), '2001:db8:abcd:13::1')).r.status, 200, 'otro /64');
  assert.equal((await post(env, box, order(), '203.0.113.7')).r.status, 200, 'otra IPv4');
  assert.equal(box.sent.filter((m) => /^v\d+@/.test(m.to[0])).length, 8, 'solo 8 correos a terceros desde ese /64');
  assert.ok(keys(env, 'rl:order:').length <= 3, 'una clave por visitante, no por dirección');
});
test('D2 · el límite del contacto también agrupa por /64', async () => {
  const env = mkEnv({ RESEND_API_KEY: 're_test' }); const box = mailbox(); const codes = [];
  for (let i = 0; i < 9; i++) codes.push((await call(env, '/api/contact', { method: 'POST', body: { name: 'Eve', email: 'e@e.es', message: 'hola ' + i, privacy: true }, ip: `2001:db8:1:1:${i + 1}::2`, deps: { fetchImpl: box.fetchImpl } })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429, 429, 429]);
});

// ───────────────────────────────────────── D7 · pedidos: visibilidad, número, listado, referencias
test('D7 · un cliente nunca ve la IP del pedido ni emailed.error (solo los managers); y sigue viendo los pedidos cuyo correo coincide con el suyo (W7)', async () => {
  const env = await orderEnv(); const box = mailbox({ fail: true }); const ana = await signIn(env, 'ana.compras@acme.es', 'client'), jefa = await signIn(env, 'jefa@torivac.com', 'manager');
  const { j } = await post(env, box, order({ customer: { name: 'Pedido falso', email: 'ANA.COMPRAS@acme.es', privacy: true } }), '5.5.5.5');        // cualquiera puede poner el correo de Ana en un pedido
  assert.equal(j.ok, true);
  const verCliente = (await (await call(env, '/api/orders', { token: ana.token })).json()).orders[0];
  assert.equal(verCliente.number, j.number); assert.ok(!('ip' in verCliente), 'sin IP'); assert.ok(verCliente.emailed && !('error' in verCliente.emailed), 'sin emailed.error'); assert.equal(verCliente.emailed.team, false);
  const verManager = (await (await call(env, '/api/orders', { token: jefa.token })).json()).orders[0];
  assert.equal(verManager.ip, '5.5.5.5'); assert.equal(verManager.emailed.error, 'Resend respondió 403');
  const otra = await signIn(env, 'otra.persona@acme.es', 'client'); assert.deepEqual((await (await call(env, '/api/orders', { token: otra.token })).json()).orders, [], 'otro cliente no ve nada');
});
test('D7 · número de pedido TV-AAAAMMDD-NNNN-XXX (XXX aleatorio base36): 30 pedidos simultáneos con el contador de KV por detrás ya no se pisan (W5)', async () => {
  class StaleKV extends FakeKV { async get(k) { return k.startsWith('counter:') ? null : super.get(k); } }                            // el contador nunca avanza: todos reciben el mismo NNNN
  const env = await orderEnv({ KV: new StaleKV() }); await env.KV.put('prices:current', JSON.stringify({ items: { [REF]: { p: 67.65 } } })); const box = mailbox();
  let n = 0; const rand = () => { const k = n++; return [k % 36, Math.floor(k / 36) % 36, Math.floor(k / 1296) % 36]; };               // sufijos distintos y deterministas
  const res = await Promise.all(Array.from({ length: 30 }, (_, i) => post(env, box, order(), `203.0.${i}.9`, { now: new Date('2026-10-28T08:00:00Z'), rand })));
  const nums = res.map((x) => x.j.number); assert.equal(new Set(nums).size, 30, 'números distintos'); for (const x of nums) assert.match(x, /^TV-20261028-0001-[0-9A-Z]{3}$/);
  assert.equal(keys(env, 'order:').length, 30, '30 registros, no uno');
  const sin = await post(await orderEnv(), mailbox(), order()); assert.match(sin.j.number, /^TV-\d{8}-\d{4}-[0-9A-Z]{3}$/);
  const dos = new Set(); for (let i = 0; i < 5; i++) dos.add((await post(await orderEnv(), mailbox(), order(), `203.0.113.${i + 1}`)).j.number.slice(-3)); assert.ok(dos.size > 1, 'el sufijo es aleatorio');
});
test('D7 · GET /api/orders del manager: prefijos de fecha hacia atrás, 300 pedidos como mucho, 400 operaciones de KV como mucho y truncated:true si cortó (W4)', async () => {
  const kv = new CountKV(); const env = mkEnv({ KV: kv }); const jefa = await signIn(env, 'jefa@torivac.com', 'manager'); const now = Date.parse('2026-10-28T12:00:00Z');
  for (let d = 0; d < 100; d++) for (let k = 1; k <= 15; k++) {                                   // 1500 pedidos en 100 días
    const day = new Date(now - d * 86_400_000).toISOString().slice(0, 10).replace(/-/g, ''), number = `TV-${day}-${String(k).padStart(4, '0')}-AB${k % 10}`;
    await kv.put(`order:${number}`, JSON.stringify({ number, at: new Date(now - d * 86_400_000 - (16 - k) * 60_000).toISOString(), ip: '203.0.113.9', customer: { name: 'n', email: 'otro@x.es' }, lines: [], total: 1 }));
  }
  kv.ops = { get: 0, put: 0, list: 0, delete: 0 };
  const r = await (await call(env, '/api/orders', { token: jefa.token, deps: { now } })).json();
  assert.equal(r.orders.length, 300); assert.equal(r.truncated, true); assert.ok(kv.total <= 400 + 3, `operaciones de KV por petición: ${kv.total}`);          // la autenticación añade 1 lectura (el usuario)
  assert.ok(kv.ops.get <= 303 && kv.ops.list <= 120, JSON.stringify(kv.ops));
  const ats = r.orders.map((o) => o.at); assert.deepEqual(ats, [...ats].sort().reverse(), 'los más recientes primero'); assert.equal(r.orders[0].number.slice(3, 11), '20261028');
  assert.ok(r.orders.every((o) => o.ip === '203.0.113.9'), 'el manager ve la IP');
});
test('D7 · GET /api/orders del manager con pocos pedidos: devuelve todos (incluidos los antiguos sin sufijo), no marca truncated y no mira más allá de 120 días', async () => {
  const env = mkEnv(); const jefa = await signIn(env, 'jefa@torivac.com', 'manager'); const now = Date.parse('2026-10-28T12:00:00Z');
  /** Fecha AAAAMMDD y marca de tiempo de hace n días respecto a `now`. */
  const ago = (n) => { const d = new Date(now - n * 86_400_000); return [d.toISOString().slice(0, 10).replace(/-/g, ''), d.toISOString()]; };
  /** Guarda un pedido mínimo en KV con su número y fecha. */
  const put = (number, at) => env.KV.put(`order:${number}`, JSON.stringify({ number, at, customer: { name: 'n', email: 'x@y.es' }, lines: [], total: 1 }));
  await put('TV-20261028-0003-ZZZ', '2026-10-28T10:00:00.000Z'); await put('TV-20261028-0002', '2026-10-28T09:00:00.000Z');       // el segundo es un pedido antiguo (sin sufijo)
  await put(`TV-${ago(8)[0]}-0001`, ago(8)[1]); await put(`TV-${ago(119)[0]}-0001-AAA`, ago(119)[1]);                               // el último día de la ventana
  await put(`TV-${ago(120)[0]}-0001-AAA`, ago(120)[1]); await put(`TV-${ago(241)[0]}-0001-AAA`, ago(241)[1]);                      // fuera de la ventana de 120 días
  const r = await (await call(env, '/api/orders', { token: jefa.token, deps: { now } })).json();
  assert.deepEqual(r.orders.map((o) => o.number), ['TV-20261028-0003-ZZZ', 'TV-20261028-0002', `TV-${ago(8)[0]}-0001`, `TV-${ago(119)[0]}-0001-AAA`]);
  assert.ok(!('truncated' in r), 'no se cortó nada');
  assert.equal((await (await call(env, '/api/orders', { token: MASTER, deps: { now } })).json()).orders.length, 4, 'el token maestro también');
});
test('D7 · GET /api/orders del cliente: índice uorder:<sha256(correo)[:32]>:<nº> (máx. 100, más recientes); los pedidos antiguos sin índice dejan de aparecer', async () => {
  const kv = new CountKV(); const env = await orderEnv({ KV: kv }); await kv.put('prices:current', JSON.stringify({ items: { [REF]: { p: 1 } } })); const box = mailbox();
  const ana = await signIn(env, 'ana.compras@acme.es', 'client');
  await kv.put('order:TV-20260101-0001', JSON.stringify({ number: 'TV-20260101-0001', at: '2026-01-01T09:00:00.000Z', customer: { name: 'Ana', email: 'ana.compras@acme.es' }, lines: [], total: 1 }));      // pedido antiguo SIN índice
  const t0 = Date.parse('2026-10-28T08:00:00Z');
  for (let i = 0; i < 3; i++) await post(env, box, order({ customer: { name: 'Ana', email: 'ana.compras@acme.es', privacy: true }, copy: false }), `203.0.113.${i + 1}`, { now: new Date(t0 + i * 60_000) });
  await post(env, box, order({ customer: { name: 'Otro', email: 'otro@x.es', privacy: true } }), '203.0.113.50', { now: new Date(t0) });
  assert.equal(keys(env, 'uorder:').length, 4); assert.ok(keys(env, 'uorder:').every((k) => /^uorder:[0-9a-f]{32}:TV-\d{8}-\d{4}-[0-9A-Z]{3}$/.test(k)), 'sin el correo en la clave'); assert.ok(!keys(env).filter((k) => !k.startsWith('user:')).some((k) => k.includes('acme')), 'ninguna clave (salvo la del propio usuario) lleva el correo');
  kv.ops = { get: 0, put: 0, list: 0, delete: 0 };
  const r = await (await call(env, '/api/orders', { token: ana.token, deps: { now: t0 + 3_600_000 } })).json();
  assert.equal(r.orders.length, 3, 'sus 3 pedidos; el antiguo sin índice no aparece'); assert.ok(r.orders.every((o) => o.customer.email === 'ana.compras@acme.es' && !('ip' in o)));
  assert.ok(kv.ops.list <= 2 && kv.ops.get <= 5, 'sin recorrer todo el almacén: ' + JSON.stringify(kv.ops)); assert.ok(!('truncated' in r));
  const muchos = mkEnv({ KV: new FakeKV({ pageSize: 40 }) }); const bea = await signIn(muchos, 'bea.compras@acme.es', 'client'); const pre = await uorderPrefix('bea.compras@acme.es');
  for (let i = 0; i < 130; i++) { const number = `TV-20261028-${String(i + 1).padStart(4, '0')}-AAA`; await muchos.KV.put(`order:${number}`, JSON.stringify({ number, at: new Date(t0 + i * 1000).toISOString(), customer: { name: 'B', email: 'bea.compras@acme.es' }, lines: [], total: 1 })); await muchos.KV.put(pre + number, '1'); }
  const b = await (await call(muchos, '/api/orders', { token: bea.token })).json();
  assert.equal(b.orders.length, 100); assert.equal(b.truncated, true); assert.equal(b.orders[0].number, 'TV-20261028-0130-AAA', 'las 100 más recientes, a través de varias páginas de list'); assert.equal(b.orders[99].number, 'TV-20261028-0031-AAA');
});
test('D7 · referencias: «constructor», «__proto__», «toString»… no son referencias válidas (Object.hasOwn) ni en el pedido ni al aplicar cambios de IA (W8)', async () => {
  const env = await orderEnv(); const box = mailbox(); const jefa = await signIn(env, 'jefa@torivac.com', 'manager');
  for (const ref of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
    const { r, j } = await post(env, box, order({ lines: [{ ref, qty: 1 }] }), nextIp());
    assert.equal(r.status, 400, ref); assert.match(j.error, /Referencia desconocida/);
    assert.equal(parseOrder(order({ lines: [{ ref, qty: 1 }] }), CATALOG).error, `Referencia desconocida: ${ref}`);
  }
  assert.equal(box.sent.length, 0);
  const ap = await call(env, '/api/prices/ai/apply', { method: 'POST', token: jefa.token, body: { changes: [{ ref: 'constructor', price: 1 }, { ref: '__proto__', price: 2 }, { ref: 'toString', price: 3 }] } });
  assert.equal(ap.status, 400, 'ninguno es válido'); assert.ok(!Object.hasOwn(JSON.parse(await env.KV.get('prices:current')).items, 'constructor'));
  const ok = await call(env, '/api/prices/ai/apply', { method: 'POST', token: jefa.token, body: { changes: [{ ref: 'constructor', price: 1 }, { ref: REF, price: 70 }] } });
  const oj = await ok.json(); assert.equal(oj.applied, 1); assert.deepEqual(oj.rejected.map((x) => x.ref), ['constructor']); assert.deepEqual(Object.keys(JSON.parse(await env.KV.get('prices:current')).items).sort(), [REF, REF2].sort());
  assert.equal((await post(env, box, order({ lines: [{ ref: REF, qty: 2 }] }), '203.0.113.201')).r.status, 200, 'una referencia real sigue valiendo');
});
test('D7 · si KV corta el listado a medias (p. ej. el tope de subconsultas del plan gratuito) se devuelve lo leído con truncated:true; si falla desde el principio, es un error interno sin texto interno', async () => {
  class LimitKV extends FakeKV { constructor() { super(); this.n = 0; this.limit = Infinity; } async get(k) { if (this.n++ >= this.limit) throw new Error('Too many subrequests'); return super.get(k); } }
  const kv = new LimitKV(); const env = mkEnv({ KV: kv }); const jefa = await signIn(env, 'jefa@torivac.com', 'manager'); const now = Date.parse('2026-10-28T12:00:00Z');
  for (let k = 1; k <= 60; k++) { const number = `TV-20261028-${String(k).padStart(4, '0')}-AAA`; await env.KV.put(`order:${number}`, JSON.stringify({ number, at: new Date(now - (61 - k) * 60_000).toISOString(), customer: { name: 'n', email: 'x@y.es' }, lines: [], total: 1 })); }
  kv.limit = kv.n + 2 + 25;                                                                       // la autenticación gasta 2 lecturas; luego caben 25 pedidos
  let r; await quiet(async () => { r = await call(env, '/api/orders', { token: jefa.token, deps: { now } }); }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.truncated, true); assert.ok(j.orders.length >= 10 && j.orders.length < 60, `devuelve lo leído (${j.orders.length})`); assert.equal(j.orders[0].number, 'TV-20261028-0060-AAA', 'los más recientes primero');
  kv.limit = kv.n + 2; let r2; await quiet(async () => { r2 = await call(env, '/api/orders', { token: jefa.token, deps: { now } }); });
  assert.equal(r2.status, 500); assert.equal((await r2.json()).error, 'Error interno');
});
test('D1 · si KV falla al reservar el tope de la copia, el pedido ya guardado no se convierte en error: se responde 200 con customer_reason «failed»', async () => {
  class CopyBoomKV extends FakeKV { async put(k, v, o) { if (k.startsWith('rl:copy-to:')) throw new Error('boom'); return super.put(k, v, o); } }
  const env = await orderEnv({ KV: new CopyBoomKV() }); const box = mailbox(); let res;
  await quiet(async () => { res = await post(env, box, order()); });
  assert.equal(res.r.status, 200); assert.deepEqual([res.j.emailed.team, res.j.emailed.customer, res.j.emailed.customer_reason], [true, false, 'failed']); assert.equal(box.sent.length, 1, 'solo el aviso al equipo');
  assert.ok(JSON.parse(await env.KV.get(`order:${res.j.number}`)).emailed, 'el pedido queda guardado con su estado de correo');
});
/** Ejecuta fn con console.error silenciado (los fallos provocados a propósito no ensucian la salida de las pruebas). */
async function quiet(fn) { const orig = console.error; console.error = () => {}; try { await fn(); } finally { console.error = orig; } }
