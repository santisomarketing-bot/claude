// ============================================================================
//  sources/google.mjs
//  --------------------------------------------------------------------------
//  Google Ads — formularios de generación de clientes potenciales (Lead Form
//  extensions). Se configura en Google Ads UI un "webhook delivery" con una
//  URL y una clave compartida ("google_key"); Google hace POST directo con
//  los datos del lead (no hace falta ir a buscarlos a otra API, a diferencia
//  de Meta).
//
//  Documentación: https://developers.google.com/google-ads/webhook
//
//  Forma típica del payload:
//  {
//    "google_key": "clave-compartida",
//    "lead_id": "...", "form_id": "...", "campaign_id": "...", "gcl_id": "...",
//    "api_version": "1.0", "is_test": false,
//    "user_column_data": [
//      { "column_id": "FULL_NAME", "string_value": "Ana López" },
//      { "column_id": "EMAIL", "string_value": "ana@ejemplo.com" }
//    ]
//  }
// ============================================================================

import { buildLead } from "../schema.mjs";

const CAMPOS_CONTACTO = {
  FULL_NAME: "name",
  FIRST_NAME: "name",
  LAST_NAME: "name",
  EMAIL: "email",
  WORK_EMAIL: "email",
  PHONE_NUMBER: "phone",
  WORK_PHONE_NUMBER: "phone",
  COMPANY_NAME: "company",
};

export function verifyGoogleKey(payload, expectedKey) {
  if (!expectedKey) return false;
  return payload?.google_key === expectedKey;
}

export function normalizeGoogleLead(payload) {
  const contact = {};
  const fields = {};
  for (const item of payload?.user_column_data || []) {
    const valor = item.string_value ?? "";
    const destino = CAMPOS_CONTACTO[item.column_id];
    const clave = item.column_name || item.column_id || "campo";
    if (destino && !contact[destino]) contact[destino] = valor;
    else fields[clave] = valor;
  }

  return buildLead({
    source: "google",
    sourceId: payload?.lead_id || null,
    contact,
    campaign: {
      id: payload?.campaign_id || null,
      adgroupId: payload?.ad_group_id || payload?.adgroup_id || null,
      formId: payload?.form_id || null,
      gclid: payload?.gcl_id || null,
    },
    fields,
    raw: payload,
  });
}

// ---- Autotest: node crm/lib/sources/google.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = {
    google_key: "clave",
    lead_id: "abc123",
    campaign_id: "999",
    form_id: "form1",
    user_column_data: [
      { column_id: "FULL_NAME", string_value: "Marc Puig" },
      { column_id: "EMAIL", string_value: "marc@ejemplo.com" },
      { column_id: "CUSTOM_QUESTION", column_name: "¿Cuándo empezamos?", string_value: "Lo antes posible" },
    ],
  };
  console.log("clave ok:", verifyGoogleKey(payload, "clave") === true);
  console.log("clave mal:", verifyGoogleKey(payload, "otra") === false);
  const lead = normalizeGoogleLead(payload);
  console.log("contacto:", lead.contact.name === "Marc Puig" && lead.contact.email === "marc@ejemplo.com");
  console.log("campo custom:", lead.fields["¿Cuándo empezamos?"] === "Lo antes posible");
  console.log("sourceId:", lead.sourceId === "abc123");
}
