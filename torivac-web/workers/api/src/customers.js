// [CUSTOMERS] Cuentas de cliente (rol customer; docs/PRECIOS-Y-CLIENTES.md §5.1). Las gestionan el manager y el propietario (client); un customer o un visitante no llegan aquí (403 / 401 en el router).
//   GET    /api/customers                    → { ok, customers:[{ email, name, tier, created, last_login? }], tiers:{ vip:{label,pct}, vip5, vip10, normal } }
//   POST   /api/customers { email, name, password, tier } → 201 { ok, customer } (correo ya existente → 409; categoría por defecto: normal)
//   PUT    /api/customers/:correo { tier?, name? }        → 200 { ok, customer } (otro rol o inexistente → 404)
//   POST   /api/customers/:correo/password { password }   → 200 { ok } y se cierran sus sesiones
//   DELETE /api/customers/:correo                         → 200 { ok } (borra la cuenta y cierra sus sesiones; no borra sus presupuestos; otro rol o inexistente → 404)
// El correo de la URL va codificado. Contraseña y correo con las reglas de siempre (/api/users). Las cuentas de otros roles no se tocan desde aquí. Orden de los errores: 404 (cuenta) → 413/400 (cuerpo).
import { json, readBody, jsonOf } from './util.js';
import { createUser, getCustomer, listCustomers, updateCustomer, setCustomerPassword, deleteCustomer } from './users.js';
import { loadPricing, tierTable } from './pricing.js';

/** Tamaño máximo de los cuerpos de estas rutas, en bytes. */
export const MAX_BODY = 10_000;
/** Respuesta de error { ok:false, error } con el estado del resultado de users.js (400 por defecto). */
const fail = (r, cors) => json({ ok: false, error: r.error }, r.status || 400, cors);
/** El 404 de una cuenta que no existe o no es de cliente (también se responde antes de mirar el cuerpo). */
const missing = (cors) => json({ ok: false, error: 'No existe ese cliente' }, 404, cors);
/** Cuerpo JSON de la petición como objeto → { body } o { res } con el error (413 si pasa del tope; 400 «Petición no válida» si no es un objeto JSON). */
async function readObject(request, cors) {
  const bytes = await readBody(request, MAX_BODY);
  if (bytes === null) return { res: json({ ok: false, error: 'La petición es demasiado grande' }, 413, cors) };
  const body = jsonOf(bytes);
  return body && typeof body === 'object' && !Array.isArray(body) ? { body } : { res: json({ ok: false, error: 'Petición no válida' }, 400, cors) };
}
/**
 * Atiende /api/customers[/…] para `who` (ya comprobado: manager o client) → Response, o null si la ruta o el método no son de este módulo. `nowMs` es la hora de la petición (cierra las sesiones al cambiar la contraseña).
 * El correo de la URL se decodifica y debe ser un texto de ≤ 254 caracteres (si no, 400 «Correo no válido»).
 */
export async function customerRoute(request, env, { path, cors = {}, nowMs = Date.now() }) {
  const parts = path.slice('/api/customers'.length).split('/').slice(1), method = request.method;      // '' → []; '/a%40b.es/password' → ['a%40b.es', 'password']
  if (!parts.length) {
    if (method === 'GET') return json({ ok: true, customers: await listCustomers(env), tiers: tierTable(await loadPricing(env)) }, 200, { ...cors, 'Cache-Control': 'no-store' });
    if (method === 'POST') {
      const rb = await readObject(request, cors); if (rb.res) return rb.res;
      const r = await createUser(env, { email: rb.body.email, name: rb.body.name, password: rb.body.password, tier: rb.body.tier, role: 'customer' });
      if (r.error) return fail(r, cors);
      const { role: _role, ...customer } = r.user;                                    // la ficha del cliente lleva email, name, tier y created
      return json({ ok: true, customer }, 201, cors);
    }
    return null;
  }
  let email; try { email = decodeURIComponent(parts[0]); } catch { return json({ ok: false, error: 'Correo no válido' }, 400, cors); }
  if (!email || email.length > 254) return json({ ok: false, error: 'Correo no válido' }, 400, cors);
  if (parts.length === 1 && method === 'PUT') {
    if (!(await getCustomer(env, email))) return missing(cors);                        // 404 antes que 400
    const rb = await readObject(request, cors); if (rb.res) return rb.res;
    const r = await updateCustomer(env, email, Object.fromEntries(['tier', 'name'].filter((k) => Object.hasOwn(rb.body, k)).map((k) => [k, rb.body[k]])));
    return r.error ? fail(r, cors) : json({ ok: true, customer: r.customer }, 200, cors);
  }
  if (parts.length === 1 && method === 'DELETE') { const r = await deleteCustomer(env, email); return r.error ? fail(r, cors) : json({ ok: true }, 200, cors); }
  if (parts.length === 2 && parts[1] === 'password' && method === 'POST') {
    if (!(await getCustomer(env, email))) return missing(cors);                        // 404 antes que 400
    const rb = await readObject(request, cors); if (rb.res) return rb.res;
    const r = await setCustomerPassword(env, email, rb.body.password, nowMs);
    return r.error ? fail(r, cors) : json({ ok: true }, 200, cors);
  }
  return null;
}
