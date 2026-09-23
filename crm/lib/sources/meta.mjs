// ============================================================================
//  sources/meta.mjs
//  --------------------------------------------------------------------------
//  Meta Lead Ads (Facebook / Instagram). El flujo real:
//    1) Meta llama GET /webhooks/meta para verificar la suscripción (una vez,
//       al configurarla en la app de Meta for Developers).
//    2) Por cada lead nuevo, Meta llama POST /webhooks/meta con un aviso
//       ("leadgen_id") firmado, SIN los datos del formulario.
//    3) Hay que pedir los datos reales a la Graph API con ese leadgen_id y
//       un Page Access Token (META_PAGE_ACCESS_TOKEN).
//
//  Documentación: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/
// ============================================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { buildLead } from "../schema.mjs";

// Nombres estándar que Meta usa en las preguntas "fijas" del formulario.
const CAMPOS_CONTACTO = {
  full_name: "name",
  first_name: "name",
  last_name: "name",
  email: "email",
  work_email: "email",
  phone_number: "phone",
  work_phone_number: "phone",
  company_name: "company",
};

// GET /webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// Devuelve el challenge (string) si el token coincide, o null si no.
export function verifyMetaHandshake(query, verifyToken) {
  if (!verifyToken) return null;
  if (query["hub.mode"] !== "subscribe") return null;
  if (query["hub.verify_token"] !== verifyToken) return null;
  return query["hub.challenge"] ?? null;
}

// Verifica la firma X-Hub-Signature-256 sobre el body crudo (Buffer).
export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader) return false;
  const [algo, sig] = String(signatureHeader).split("=");
  if (algo !== "sha256" || !sig) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Extrae los avisos "leadgen" de un payload de webhook de Meta.
export function parseMetaChanges(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue;
      const v = change.value || {};
      out.push({
        leadgenId: v.leadgen_id ? String(v.leadgen_id) : null,
        pageId: v.page_id ? String(v.page_id) : null,
        formId: v.form_id ? String(v.form_id) : null,
        adId: v.ad_id ? String(v.ad_id) : null,
        adgroupId: v.adgroup_id ? String(v.adgroup_id) : null,
        createdTime: v.created_time || null,
      });
    }
  }
  return out;
}

// Pide los datos del lead a la Graph API. fetchImpl es inyectable para tests.
export async function fetchMetaLeadData(leadgenId, { accessToken, apiVersion = "v21.0" }, fetchImpl = fetch) {
  const url = `https://graph.facebook.com/${apiVersion}/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetchImpl(url);
  const json = await res.json();
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${json?.error?.message || "error desconocido"}`);
  return json;
}

// graphResult = respuesta cruda de la Graph API para un leadgen_id.
// aviso = uno de los objetos que devuelve parseMetaChanges().
export function normalizeMetaLead(graphResult, aviso = {}) {
  const contact = {};
  const fields = {};
  for (const item of graphResult?.field_data || []) {
    const valor = item.values?.[0] ?? "";
    const destino = CAMPOS_CONTACTO[item.name];
    if (destino && !contact[destino]) contact[destino] = valor;
    else fields[item.name] = valor;
  }

  return buildLead({
    source: "meta",
    sourceId: graphResult?.id || aviso.leadgenId,
    contact,
    campaign: {
      formId: aviso.formId || graphResult?.form_id || null,
      adId: aviso.adId || graphResult?.ad_id || null,
      adgroupId: aviso.adgroupId || null,
      pageId: aviso.pageId || null,
    },
    fields,
    raw: { aviso, graphResult },
  });
}

// Lead "placeholder" cuando la llamada a la Graph API falla: no perdemos el
// aviso, queda marcado needsSync para reprocesar a mano con el leadgen_id.
export function buildPendingMetaLead(aviso, error) {
  const lead = buildLead({
    source: "meta",
    sourceId: aviso.leadgenId,
    campaign: { formId: aviso.formId, adId: aviso.adId, adgroupId: aviso.adgroupId, pageId: aviso.pageId },
    raw: { aviso, error: String(error?.message || error) },
  });
  lead.needsSync = true;
  return lead;
}

// ---- Autotest: node crm/lib/sources/meta.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const secret = "shhh";
  const body = Buffer.from(JSON.stringify({ ok: true }));
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  console.log("firma válida:", verifyMetaSignature(body, sig, secret) === true);
  console.log("firma inválida:", verifyMetaSignature(body, "sha256=deadbeef", secret) === false);
  console.log("handshake ok:", verifyMetaHandshake({ "hub.mode": "subscribe", "hub.verify_token": "t", "hub.challenge": "123" }, "t") === "123");

  const payload = { entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: "1", form_id: "9", ad_id: "8" } }] }] };
  const avisos = parseMetaChanges(payload);
  console.log("avisos:", avisos.length === 1, avisos[0].leadgenId === "1");

  const lead = normalizeMetaLead(
    { id: "1", field_data: [{ name: "full_name", values: ["Ana López"] }, { name: "email", values: ["ana@ejemplo.com"] }, { name: "presupuesto", values: ["1000€"] }] },
    avisos[0]
  );
  console.log("normaliza contacto:", lead.contact.name === "Ana López" && lead.contact.email === "ana@ejemplo.com");
  console.log("normaliza campo custom:", lead.fields.presupuesto === "1000€");
}
