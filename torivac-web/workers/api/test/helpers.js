// Utilidades de test: KV en memoria que imita las reglas de Cloudflare KV (clave ≤ 512 bytes, TTL ≥ 60 s, listado ordenado con páginas y fecha de caducidad), entorno de pruebas con secretos largos y fetch simulado.
// El TTL NO hace desaparecer las claves en get (los tests inyectan `now`): solo se anota para que list y la purga puedan verlo.
const te = new TextEncoder();
/** Comprueba la clave como lo haría KV: no vacía y de 512 bytes como máximo. */
const checkKey = (k) => { if (!k) throw new Error('KV: Zero-length key is not supported'); if (te.encode(String(k)).length > 512) throw new Error('KV: 414 UriTooLong (la clave supera 512 bytes)'); };
export class FakeKV {
  constructor({ pageSize = 1000 } = {}) { this.m = new Map(); this.exp = new Map(); this.pageSize = pageSize; }
  async get(k) { checkKey(k); return this.m.has(k) ? this.m.get(k) : null; }
  /** Guarda un valor; anota la caducidad si trae expirationTtl (KV exige al menos 60 s). */
  async put(k, v, opts = {}) {
    checkKey(k);
    if (opts && opts.expirationTtl != null && !(opts.expirationTtl >= 60)) throw new Error('KV: expiration_ttl debe ser de al menos 60 segundos');
    this.m.set(k, String(v)); if (opts && opts.expirationTtl) this.exp.set(k, Math.floor(Date.now() / 1000) + opts.expirationTtl); else this.exp.delete(k);
  }
  async delete(k) { checkKey(k); this.m.delete(k); this.exp.delete(k); }
  /** Claves con el prefijo, ordenadas, por páginas (cursor), con su dato de caducidad si lo tienen. */
  async list({ prefix = '', limit = 1000, cursor } = {}) {
    const all = [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort(), start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + Math.min(limit, this.pageSize)), end = start + page.length;
    return { keys: page.map((name) => (this.exp.has(name) ? { name, expiration: this.exp.get(name) } : { name })), list_complete: end >= all.length, cursor: end >= all.length ? undefined : String(end) };
  }
}
/** KV que cuenta las operaciones (get, put, list, delete), para comprobar los topes de operaciones por petición. */
export class CountKV extends FakeKV {
  constructor(o) { super(o); this.ops = { get: 0, put: 0, list: 0, delete: 0 }; }
  get total() { return this.ops.get + this.ops.put + this.ops.list + this.ops.delete; }
  async get(k) { this.ops.get++; return super.get(k); }
  async put(k, v, o) { this.ops.put++; return super.put(k, v, o); }
  async list(o) { this.ops.list++; return super.list(o); }
  async delete(k) { this.ops.delete++; return super.delete(k); }
}
/** Secretos de PRUEBA (no son claves reales) con la longitud mínima que exige el Worker: token maestro y secreto de sesión ≥ 32 caracteres. */
export const MASTER = 'master-test-0123456789abcdef0123456789abcdef';
export const SESSION = 'session-test-' + 'x'.repeat(40);
/** Entorno de pruebas del Worker: KV en memoria, destinatarios, token maestro, secreto de sesión y origen; extra sobrescribe valores. */
export const mkEnv = (extra = {}) => ({ KV: new FakeKV(), ORDER_TO: 'info@grupotorivac.com, mzamora@torivac.com', ADMIN_API_TOKEN: MASTER, SESSION_SECRET: SESSION, ALLOWED_ORIGINS: 'https://demo.example', ...extra });
/** Request de prueba a https://api.test: método, cabeceras y body (un objeto se serializa a JSON; un texto se envía tal cual). */
export const req = (path, { method = 'GET', body, headers = {} } = {}) => new Request(`https://api.test${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
export const CATALOG = { 'TT0020210': { n: 'Transformador serie TT 20 VA', pid: 884 }, P16633: { n: 'Variador portátil', pid: 16633 }, R100: { n: 'Resistencia 100 W', pid: 1 } };
export const PRICES = { updated_at: '2026-10-27T00:00:00Z', source: 'test', currency: 'EUR', mode: 'live', items: { TT0020210: { p: 12.37, t: [[10, 11.9], [50, 11.4]] }, P16633: { p: 67.65 } } };
export const SHEET = 'ref;price;qty2;price2;qty3;price3;note;active\nTT0020210;12,37;10;11,9;50;11,4;DEMO;1\nP16633;67,65;;;;;;1\nR100;5,5;;;;;;1\nX0;1;;;;;;0\n';
export const TCTX = { lines: CATALOG, skus: { aaaa00000001: 16633 }, rules: [{ pattern: '^TT\\d{7}$', pid: 884 }] };   // contexto de catálogo de las pruebas (las reglas de verdad salen de generated/items.js)
