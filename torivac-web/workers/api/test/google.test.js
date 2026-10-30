// [PRUEBAS-GOOGLE] Ajustes de Google del panel (src/google.js): validación de IDs y etiquetas (mismas reglas que el servidor PHP y que site/lib/google.mjs), lectura pública que solo enseña IDs y etiquetas
// completas de las conversiones activadas, y las rutas GET /api/google (público), GET y PUT /api/settings/google (solo managers). Sin red: KV en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkEnv, MASTER } from './helpers.js';
import { call, signIn } from './kit.js';
import { validate, publicView, loadSettings, blank, KEY } from '../src/google.js';

/** Cuerpo válido de ejemplo del PUT (se puede sobrescribir cualquier parte). */
const body = (over = {}) => ({ ga4: 'G-TEST123456', ads: 'AW-123456789', conversions: { quote: { label: 'AW-123456789/AbCdEfGhIj12', on: true }, contact: { label: 'AbCdEfGhIj34', on: true } }, ...over });
/** La vista pública que ve un visitante. */
const pub = async (env) => (await (await call(env, '/api/google')).json()).google;

test('Google · sin nada guardado todo está vacío, también para el visitante sin sesión', async () => {
  const env = mkEnv(), s = await loadSettings(env);
  assert.deepEqual(s, blank());
  assert.deepEqual(await pub(env), { ga4: '', ads: '', conv: { quote: '', contact: '' } });
});

test('Google · la validación acepta lo bueno, completa etiquetas con el ID de Ads y toma el ID de Ads de las etiquetas completas', () => {
  const v = validate(body());
  assert.ok(v.settings); assert.equal(v.settings.conversions.contact.label, 'AbCdEfGhIj34', 'la etiqueta suelta se guarda como se escribió');
  assert.equal(validate({ conversions: { quote: { label: 'AW-555555555/ZzZzZzZz99' } } }).settings.ads, 'AW-555555555', 'sin ID de Ads, sale de la etiqueta completa');
  const vacio = validate({}).settings; assert.equal(vacio.ga4, ''); assert.equal(vacio.conversions.quote.on, true, 'vacío = apagado, conversiones «on» por defecto');
  assert.equal(validate({ ga4: 'GT-ABCDEFGH', conversions: { quote: { on: false } } }).settings.conversions.quote.on, false, 'GT-… vale y «on:false» se respeta');
});

test('Google · la validación rechaza lo mal escrito diciendo el campo', () => {
  const casos = [
    [{ ga4: 'G-1' }, 'ga4'], [{ ga4: 'g-abcdefghij' }, 'ga4'], [{ ga4: 'G-ABCDEFGHIJ<script>' }, 'ga4'], [{ ads: '123456789' }, 'ads'], [{ ads: 'AW-12' }, 'ads'],
    [{ conversions: { quote: { label: 'AbCdEfGhIj12' } } }, 'conversions.quote'],                                                  // solo la etiqueta, sin ID de Ads
    [{ ads: 'AW-111111111', conversions: { contact: { label: 'AW-222222222/AbCdEfGhIj12' } } }, 'conversions.contact'],             // etiqueta de otra cuenta
    [{ ads: 'AW-111111111', conversions: { quote: { label: 'corta' } } }, 'conversions.quote'],
    [{ ads: 'AW-111111111', conversions: { quote: { label: 'AbCdEfGh IjK' } } }, 'conversions.quote'],
    [{ ads: 'AW-111111111', conversions: { quote: { label: 'AbCdEfGhIj12', on: 'si' } } }, 'conversions.quote'],
    [{ ads: 'AW-111111111', conversions: { quote: { label: ['x'] } } }, 'conversions.quote'],
    [{ ga4: ['G-ABCDEFGHIJ'] }, 'ga4'],
    [{ conversions: { quote: { label: 'AW-111111111/AbCdEfGhIj12' }, contact: { label: 'AW-222222222/AbCdEfGhIj12' } } }, 'conversions.contact'],   // dos etiquetas completas de cuentas distintas sin ID de Ads
  ];
  for (const [b, field] of casos) { const v = validate(b); assert.ok(v.error && v.field === field, `${JSON.stringify(b)} → ${v.field ?? 'aceptado'}`); }
  assert.ok(validate('texto').error && validate([1, 2]).error && validate(null).error, 'lo que no es un objeto, fuera');
});

test('Google · la vista pública solo trae etiquetas completas de conversiones activadas y con ID de Ads, y no enseña quién ni cuándo guardó', () => {
  const s = { ...validate(body()).settings, updated: null };
  assert.deepEqual(publicView(s), { ga4: 'G-TEST123456', ads: 'AW-123456789', conv: { quote: 'AW-123456789/AbCdEfGhIj12', contact: 'AW-123456789/AbCdEfGhIj34' } });
  s.conversions.contact.on = false; assert.equal(publicView(s).conv.contact, '', 'conversión apagada: la web no la recibe');
  s.ads = ''; assert.equal(publicView(s).conv.quote, '', 'sin ID de Ads no hay conversiones');
  assert.deepEqual(Object.keys(publicView(s)).sort(), ['ads', 'conv', 'ga4']);
});

test('Google · lo dañado o manipulado en KV no se cuela: loadSettings solo devuelve valores que cumplen las reglas', async () => {
  const env = mkEnv();
  await env.KV.put(KEY, JSON.stringify({ ga4: '<img src=x>', ads: 'AW-123456789', conversions: { quote: { label: '"><script>', on: false }, contact: 'no es un objeto' }, updated: { at: 5, by: 'x' } }));
  const s = await loadSettings(env);
  assert.equal(s.ga4, '', 'ID de Analytics roto → vacío'); assert.equal(s.ads, 'AW-123456789');
  assert.deepEqual(s.conversions.quote, { label: '', on: false }, 'etiqueta rota → vacía, «on» se conserva'); assert.deepEqual(s.conversions.contact, { label: '', on: true });
  assert.equal(s.updated, null, 'fecha mal formada → sin datos de quién guardó');
  await env.KV.put(KEY, 'basura {'); assert.deepEqual(await loadSettings(env), blank(), 'JSON roto → vacío');
});

test('Google · rutas: la lectura pública no pide sesión; ver y guardar es solo de managers (propietario 403, sin sesión 401); guardar deja quién y cuándo y un rechazo no toca lo guardado', async () => {
  const env = mkEnv(), mgr = await signIn(env, 'jefa@torivac.test', 'manager'), own = await signIn(env, 'duena@torivac.test', 'client');
  const r0 = await call(env, '/api/google'); assert.equal(r0.status, 200); assert.equal(r0.headers.get('Cache-Control'), 'public, max-age=60', 'caché corta pública');
  assert.equal((await call(env, '/api/settings/google')).status, 401, 'ver sin sesión');
  assert.equal((await call(env, '/api/settings/google', { method: 'PUT', body: body() })).status, 401, 'guardar sin sesión');
  assert.equal((await call(env, '/api/settings/google', { token: own.token })).status, 403, 'propietario no ve los ajustes');
  assert.equal((await call(env, '/api/settings/google', { method: 'PUT', body: body(), token: own.token })).status, 403, 'propietario no guarda');
  assert.equal((await pub(env)).ga4, '', 'el intento del propietario no cambió nada');

  const r = await call(env, '/api/settings/google', { method: 'PUT', body: body(), token: mgr.token }), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.settings.ga4, 'G-TEST123456'); assert.equal(j.settings.updated.by, 'jefa@torivac.test', 'queda quién guardó'); assert.match(j.settings.updated.at, /^\d{4}-\d\d-\d\dT/);
  assert.equal((await pub(env)).conv.contact, 'AW-123456789/AbCdEfGhIj34', 'la web recibe la etiqueta completa');
  assert.equal((await call(env, '/api/settings/google', { token: mgr.token })).status, 200, 'el manager lo ve');

  const bad = await call(env, '/api/settings/google', { method: 'PUT', body: { ga4: 'nope' }, token: mgr.token }), bj = await bad.json();
  assert.equal(bad.status, 400); assert.equal(bj.field, 'ga4');
  assert.equal((await pub(env)).ga4, 'G-TEST123456', 'un guardado rechazado no toca lo guardado');
  assert.equal((await call(env, '/api/settings/google', { method: 'PUT', body: { ga4: '', ads: '', conversions: {} }, token: mgr.token })).status, 200, 'vaciar apaga todo');
  assert.deepEqual(await pub(env), { ga4: '', ads: '', conv: { quote: '', contact: '' } });
  const m = await call(env, '/api/settings/google', { method: 'PUT', body: body(), token: MASTER }); assert.equal((await m.json()).settings.updated.by, 'maestro', 'el token maestro cuenta como «maestro»');
  const raro = await call(env, '/api/settings/google', { method: 'PUT', body: '"texto"', headers: {}, token: mgr.token }); assert.equal(raro.status, 400, 'un cuerpo que no es un objeto → 400');
});
