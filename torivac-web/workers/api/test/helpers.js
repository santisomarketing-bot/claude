// Utilidades de test: KV en memoria con list() y TTL ignorado, y fetch simulado.
export class FakeKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, String(v)); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = '' } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
export const mkEnv = (extra = {}) => ({ KV: new FakeKV(), ORDER_TO: 'info@grupotorivac.com, mzamora@torivac.com', ADMIN_API_TOKEN: 'master-token-123', SESSION_SECRET: 'x'.repeat(40), ALLOWED_ORIGINS: 'https://demo.example', ...extra });
export const req = (path, { method = 'GET', body, headers = {} } = {}) => new Request(`https://api.test${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
export const CATALOG = { 'TT0020210': { n: 'Transformador serie TT 20 VA', pid: 884 }, P16633: { n: 'Variador portátil', pid: 16633 }, R100: { n: 'Resistencia 100 W', pid: 1 } };
export const PRICES = { updated_at: '2026-10-27T00:00:00Z', source: 'test', currency: 'EUR', mode: 'live', items: { TT0020210: { p: 12.37, t: [[10, 11.9], [50, 11.4]] }, P16633: { p: 67.65 } } };
export const SHEET = 'ref;price;qty2;price2;qty3;price3;note;active\nTT0020210;12,37;10;11,9;50;11,4;DEMO;1\nP16633;67,65;;;;;;1\nR100;5,5;;;;;;1\nX0;1;;;;;;0\n';
export const TCTX = { lines: CATALOG, skus: { aaaa00000001: 16633 }, rules: [{ pattern: '^TT\\d{7}$', pid: 884 }] };   // contexto de catálogo de las pruebas (las reglas de verdad salen de generated/items.js)
