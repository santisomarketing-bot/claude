// El blog del panel (entradas, imágenes, páginas públicas) vive en el servidor PHP del hosting (backend-php/api): el Worker de Cloudflare no lo incluye y lo dice con claridad, sin esconder la ruta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkEnv } from './helpers.js';
import { call, signIn } from './kit.js';

test('BL1 · /api/blog/… responde 501 con un mensaje claro a un manager, 401 sin sesión y 403 a un cliente; /api/health no anuncia el blog', async () => {
  const env = mkEnv();
  const tj = (await signIn(env, 'jefa@torivac.test', 'manager', { ip: '10.8.9.1' })).token, tc = (await signIn(env, 'ana.compras@acme.test', 'client', { ip: '10.8.9.2' })).token;
  for (const p of ['/api/blog/posts', '/api/blog/images', '/api/blog']) {
    const r = await call(env, p, { token: tj });
    assert.equal(r.status, 501, p);
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.equal(j.code, 'blog_unavailable');
    assert.match(j.error, /servidor PHP/);
    assert.equal((await call(env, p)).status, 401, p + ' sin sesión');
    assert.equal((await call(env, p, { token: tc })).status, 403, p + ' cliente');
  }
  const h = await (await call(env, '/api/health')).json();
  assert.equal(h.features, undefined, 'el Worker no anuncia el blog');
});
