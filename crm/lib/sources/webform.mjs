// ============================================================================
//  sources/webform.mjs
//  --------------------------------------------------------------------------
//  Formularios web propios o de clientes (contacto, presupuesto, landing...).
//  Cualquier web puede hacer POST a /webhooks/web-form con JSON o
//  application/x-www-form-urlencoded (para formularios HTML clásicos sin JS).
//  Se identifica el sitio por una API key (ver WEBFORM_API_KEYS en config.mjs).
// ============================================================================

import { buildLead } from "../schema.mjs";

// Alias en español/inglés que puede traer un <form> normal.
const ALIAS = {
  name: ["name", "nombre", "nombre_completo", "full_name"],
  email: ["email", "correo", "correo_electronico", "e-mail"],
  phone: ["phone", "telefono", "tel", "movil", "phone_number"],
  company: ["company", "empresa"],
  message: ["message", "mensaje", "comentario", "comentarios"],
};

function primero(body, claves) {
  for (const k of claves) {
    if (body[k] != null && body[k] !== "") return String(body[k]);
  }
  return "";
}

// Comprueba la API key recibida (header X-Api-Key, query ?key= o campo api_key
// del propio body) contra el mapa clave -> nombre de sitio. Devuelve el
// nombre del sitio si es válida, o null.
export function verifyWebformKey(providedKey, siteKeys) {
  if (!siteKeys || siteKeys.size === 0) return "sin-clave"; // no hay claves configuradas: modo abierto (dev)
  if (!providedKey) return null;
  return siteKeys.get(providedKey) || null;
}

// body = objeto plano ya parseado (de JSON o urlencoded).
export function normalizeWebformLead(body, site) {
  const usados = new Set();
  const contact = {
    name: primero(body, ALIAS.name),
    email: primero(body, ALIAS.email),
    phone: primero(body, ALIAS.phone),
    company: primero(body, ALIAS.company),
  };
  for (const claves of Object.values(ALIAS)) for (const k of claves) usados.add(k);
  usados.add("api_key");
  usados.add("redirect");

  const fields = {};
  for (const [k, v] of Object.entries(body)) {
    if (!usados.has(k)) fields[k] = v;
  }

  return buildLead({
    source: "web",
    site,
    contact,
    message: primero(body, ALIAS.message),
    fields,
    raw: body,
  });
}

// ---- Autotest: node crm/lib/sources/webform.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = new Map([["abc123", "webSantiso"]]);
  console.log("clave válida:", verifyWebformKey("abc123", keys) === "webSantiso");
  console.log("clave inválida:", verifyWebformKey("nope", keys) === null);
  console.log("sin claves = abierto:", verifyWebformKey(null, new Map()) === "sin-clave");

  const lead = normalizeWebformLead({ nombre: "Laura", correo: "laura@ejemplo.com", mensaje: "Quiero una web", presupuesto: "2000" }, "webSantiso");
  console.log("contacto:", lead.contact.name === "Laura" && lead.contact.email === "laura@ejemplo.com");
  console.log("mensaje:", lead.message === "Quiero una web");
  console.log("campo extra:", lead.fields.presupuesto === "2000");
}
