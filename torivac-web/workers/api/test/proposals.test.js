// Pruebas de las propuestas EDITABLES del panel (src/proposals.js y POST/GET /api/proposals/state): el manager aprueba con SU texto, rechaza con una nota o deshace; todo es texto plano
// con límites, solo lo hacen los managers y aprobar no publica nada por sí solo. Mismos casos que backend-php/api/tests/ProposalsTest.php.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalEntry, MODES } from '../src/proposals.js';
import { mkEnv } from './helpers.js';
import { call, signIn } from './kit.js';

/** Entorno con un manager y un cliente con sesión → { env, tj, ta, post(body, token), get(token) }. */
async function setup() {
  const env = mkEnv();
  const tj = (await signIn(env, 'jefa@torivac.test', 'manager', { ip: '10.7.9.1' })).token, ta = (await signIn(env, 'ana.compras@acme.test', 'client', { ip: '10.7.9.2' })).token;
  /** POST /api/proposals/state con ese cuerpo y token (sin token = sin sesión) → { status, body }. */
  const post = async (body, token) => { const r = await call(env, '/api/proposals/state', { method: 'POST', body, token }); return { status: r.status, body: await r.json() }; };
  /** GET /api/proposals/state con ese token → { status, body }. */
  const get = async (token) => { const r = await call(env, '/api/proposals/state', { token }); return { status: r.status, body: await r.json() }; };
  return { env, tj, ta, post, get };
}

test('P1 · aprobar con SU texto: se guarda limpio (controles y espacios de más fuera) con modo, fragmento y nota; el GET lo devuelve con quién y cuándo', async () => {
  const { tj, post, get } = await setup();
  const r = await post({ id: 'PR-14528', state: 'ok', mode: 'replace', find: "  Metalen beugels voor 3 mm   LED's ", text: "  Metallhalterungen\t\tfür 3-mm-LEDs aus Messing\n\n\n\nund Duraluminium  ", note: 'Revisado por Eva' }, tj);
  assert.equal(r.status, 200);
  const e = r.body.state['PR-14528'];
  assert.deepEqual(Object.keys(e), ['state', 'by', 'at', 'mode', 'text', 'find', 'note']);
  assert.equal(e.text, 'Metallhalterungen für 3-mm-LEDs aus Messing\n\nund Duraluminium');
  assert.equal(e.find, "Metalen beugels voor 3 mm LED's");
  assert.deepEqual([e.mode, e.by], ['replace', 'jefa@torivac.test']);
  assert.match(e.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual((await get(tj)).body.state['PR-14528'], e);
  const r2 = await post({ id: 'PR-14528', state: 'ok', mode: 'note', text: 'Otro' }, tj);                                    // volver a aprobar sustituye la entrada entera
  assert.deepEqual(Object.keys(r2.body.state['PR-14528']), ['state', 'by', 'at', 'mode', 'text']);
});

test('P2 · sin texto sigue funcionando como siempre: aprobar, rechazar con nota y deshacer', async () => {
  const { tj, post, get } = await setup();
  assert.deepEqual(Object.keys((await post({ id: 'PR-14834', state: 'ok' }, tj)).body.state['PR-14834']), ['state', 'by', 'at']);
  const r = await post({ id: 'PR-25713', state: 'no', note: 'Ya lo ha revisado la asesoría' }, tj);
  assert.deepEqual([r.body.state['PR-25713'].state, r.body.state['PR-25713'].note], ['no', 'Ya lo ha revisado la asesoría']);
  await post({ id: 'PR-14834', state: '' }, tj);
  assert.deepEqual(Object.keys((await get(tj)).body.state), ['PR-25713']);
  assert.deepEqual((await post({ id: 'PR-25713', state: '', text: 'se ignora' }, tj)).body.state, {});
});

test('P3 · solo texto plano y con límites: etiquetas, scripts y código se rechazan con code y field; demasiado largo también; no se guarda nada', async () => {
  const { tj, post, get } = await setup();
  for (const h of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'javascript:alert(1)', '{{7*7}}', '1; DROP TABLE users; --']) {
    for (const f of ['text', 'find', 'note']) {
      const r = await post({ id: 'PR-11111', state: 'ok', [f]: 'Hola ' + h }, tj);
      assert.deepEqual([r.status, r.body.code, r.body.field], [400, 'plain_text', f], `«${h}» en ${f}`);
    }
  }
  let r = await post({ id: 'PR-11111', state: 'ok', text: 'a'.repeat(3001) }, tj);
  assert.deepEqual([r.status, r.body.code, r.body.field], [400, 'too_long', 'text']);
  assert.equal((await post({ id: 'PR-11111', state: 'ok', text: 'palabra '.repeat(374) }, tj)).status, 200, 'casi 3000 caracteres → bien');
  r = await post({ id: 'PR-11112', state: 'ok', find: 'b'.repeat(301) }, tj); assert.deepEqual([r.status, r.body.code], [400, 'too_long']);
  r = await post({ id: 'PR-11113', state: 'no', note: 'c'.repeat(501) }, tj); assert.deepEqual([r.status, r.body.code], [400, 'too_long']);
  assert.equal((await post({ id: 'PR-11114', state: 'ok', text: ['a'] }, tj)).status, 400, 'un texto que no es cadena');
  assert.equal((await post({ id: 'PR-11114', state: 'ok', mode: 'borrar-todo' }, tj)).status, 400, 'modo desconocido');
  assert.equal((await post({ id: 'PR-11114', state: 'ok', mode: ['replace'] }, tj)).status, 400, 'modo que no es cadena');
  assert.deepEqual(Object.keys((await get(tj)).body.state), ['PR-11111'], 'solo se guardó lo válido');
  assert.equal((await post({ id: 'PR-11115', state: 'ok', text: 'Tensión de 0 a 230 V (50/60 Hz); potencia hasta 4.000 VA. Si V<Vn y I>In, ver tabla.' }, tj)).status, 200, 'texto técnico con < > ; ( )');
});

test('P4 · identificadores PR- de 3 a 6 cifras, solo managers (cliente 403, sin sesión 401) y un rechazo no toca lo guardado', async () => {
  const { env, tj, ta, post, get } = await setup();
  for (const bad of ['PR-12', 'PR-1234567', 'pr-12345', 'PR-12345 ', '../x', 'PR-1e3', '']) assert.equal((await post({ id: bad, state: 'ok' }, tj)).status, 400, `id no válido «${bad}»`);
  for (const good of ['PR-123', 'PR-123456']) assert.equal((await post({ id: good, state: 'ok' }, tj)).status, 200, `id válido «${good}»`);
  assert.equal((await post({ id: 'PR-12345', state: 'quizá' }, tj)).status, 400);
  assert.equal((await post({ id: 'PR-12345', state: 'ok', text: 'x' }, ta)).status, 403, 'un cliente no puede');
  assert.equal((await post({ id: 'PR-12345', state: 'ok' }, undefined)).status, 401, 'sin sesión no puede');
  assert.equal((await get(ta)).status, 403); assert.equal((await get(undefined)).status, 401);
  const before = env.KV.m.get('proposals:state');
  await post({ id: 'PR-55555', state: 'ok', text: '<b>x</b>' }, tj);
  assert.equal(env.KV.m.get('proposals:state'), before, 'un rechazo no toca lo guardado');
});

test('P5 · proposalEntry: modos válidos, campos vacíos sin guardar y nada de campos sueltos', () => {
  assert.deepEqual(MODES, ['replace', 'translate', 'title', 'add', 'note']);
  const e = proposalEntry({ mode: '', text: '', find: null, note: '   ', extra: 'x', by: 'otro' }, 'ok', 'jefa@x.es', Date.parse('2026-10-28T10:00:00Z'));
  assert.deepEqual(e.entry, { state: 'ok', by: 'jefa@x.es', at: '2026-10-28T10:00:00.000Z' }, 'lo vacío y lo desconocido no se guarda');
  for (const m of MODES) assert.equal(proposalEntry({ mode: m }, 'ok', 'a', 0).entry.mode, m);
});
