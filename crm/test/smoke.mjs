#!/usr/bin/env node
// ============================================================================
//  crm/test/smoke.mjs
//  --------------------------------------------------------------------------
//  Prueba de humo end-to-end: levanta el servidor real en un puerto libre y
//  ejercita cada ruta con fetch(), sin tocar Meta/Google de verdad (se
//  intercepta la llamada a la Graph API). Sirve de regresión rápida tras
//  tocar crm/server.mjs o cualquier lib/*.
//
//  Uso: node crm/test/smoke.mjs   (o "npm run crm:test")
// ============================================================================

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../server.mjs";

const tmpDir = mkdtempSync(join(tmpdir(), "crm-smoke-"));
const config = {
  port: 0,
  dataFile: join(tmpDir, "leads.json"),
  auth: { user: "admin", pass: "s3cret" },
  meta: { verifyToken: "verify-me", appSecret: "app-secret", pageAccessToken: "page-token", apiVersion: "v21.0" },
  google: { webhookKey: "google-secret" },
  webform: { siteKeys: new Map([["clave-web", "webSantiso"]]), corsOrigin: "*" },
};

const AUTH = "Basic " + Buffer.from(`${config.auth.user}:${config.auth.pass}`).toString("base64");

// Intercepta las llamadas a la Graph API de Meta para no depender de la red.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (typeof url === "string" && url.startsWith("https://graph.facebook.com")) {
    return new Response(
      JSON.stringify({ id: "leadgen-1", field_data: [{ name: "full_name", values: ["Test Meta"] }, { name: "email", values: ["metatest@ejemplo.com"] }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  return realFetch(url, opts);
};

let server;
let pass = 0;
let fail = 0;

function ok(label) {
  pass++;
  console.log(`  ✓ ${label}`);
}
function ko(label, err) {
  fail++;
  console.error(`  ✗ ${label}\n    ${err.message || err}`);
}

async function step(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (err) {
    ko(label, err);
  }
}

async function main() {
  server = createServer(config);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  await step("GET /health sin auth -> 200", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  await step("GET / sin auth -> 401", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 401);
  });

  await step("GET / con auth -> 200 html", async () => {
    const res = await fetch(`${base}/`, { headers: { Authorization: AUTH } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
  });

  await step("OPTIONS /webhooks/web-form -> 204 con CORS", async () => {
    const res = await fetch(`${base}/webhooks/web-form`, { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });

  await step("POST /webhooks/web-form sin clave -> 401", async () => {
    const res = await fetch(`${base}/webhooks/web-form`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: "X", email: "x@x.com" }) });
    assert.equal(res.status, 401);
  });

  await step("POST /webhooks/web-form sin email/telefono -> 422", async () => {
    const res = await fetch(`${base}/webhooks/web-form`, { method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": "clave-web" }, body: JSON.stringify({ nombre: "Sin contacto" }) });
    assert.equal(res.status, 422);
  });

  let webLeadId;
  await step("POST /webhooks/web-form válido -> 201", async () => {
    const res = await fetch(`${base}/webhooks/web-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": "clave-web" },
      body: JSON.stringify({ nombre: "Laura Gómez", correo: "laura@ejemplo.com", mensaje: "Quiero una web nueva" }),
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.id);
    webLeadId = json.id;
  });

  await step("POST /webhooks/web-form urlencoded + redirect -> 302", async () => {
    const body = new URLSearchParams({ nombre: "Pedro", telefono: "600111222", redirect: "https://ejemplo.com/gracias" });
    const res = await fetch(`${base}/webhooks/web-form?key=clave-web`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, redirect: "manual", body });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://ejemplo.com/gracias");
  });

  await step("GET /webhooks/meta handshake correcto -> challenge", async () => {
    const res = await fetch(`${base}/webhooks/meta?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1234`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "1234");
  });

  await step("GET /webhooks/meta handshake incorrecto -> 403", async () => {
    const res = await fetch(`${base}/webhooks/meta?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=1234`);
    assert.equal(res.status, 403);
  });

  const metaPayload = JSON.stringify({ entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: "leadgen-1", form_id: "form-1" } }] }] });
  const metaSig = "sha256=" + createHmac("sha256", config.meta.appSecret).update(metaPayload).digest("hex");

  await step("POST /webhooks/meta firma inválida -> 401", async () => {
    const res = await fetch(`${base}/webhooks/meta`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef" }, body: metaPayload });
    assert.equal(res.status, 401);
  });

  await step("POST /webhooks/meta firma válida -> 200 y crea lead", async () => {
    const res = await fetch(`${base}/webhooks/meta`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": metaSig }, body: metaPayload });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "EVENT_RECEIVED");
  });

  await step("POST /webhooks/google clave inválida -> 401", async () => {
    const res = await fetch(`${base}/webhooks/google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ google_key: "mala" }) });
    assert.equal(res.status, 401);
  });

  await step("POST /webhooks/google clave válida -> crea lead", async () => {
    const res = await fetch(`${base}/webhooks/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ google_key: "google-secret", lead_id: "g1", user_column_data: [{ column_id: "FULL_NAME", string_value: "Google Test" }, { column_id: "EMAIL", string_value: "g@ejemplo.com" }] }),
    });
    assert.equal(res.status, 201);
  });

  await step("GET /api/stats -> 4 leads (2 web + 1 meta + 1 google)", async () => {
    const res = await fetch(`${base}/api/stats`, { headers: { Authorization: AUTH } });
    const stats = await res.json();
    assert.equal(stats.total, 4);
    assert.equal(stats.bySource.web, 2);
    assert.equal(stats.bySource.meta, 1);
    assert.equal(stats.bySource.google, 1);
  });

  await step("GET /api/leads?source=meta -> trae el lead normalizado", async () => {
    const res = await fetch(`${base}/api/leads?source=meta`, { headers: { Authorization: AUTH } });
    const { items } = await res.json();
    assert.equal(items.length, 1);
    assert.equal(items[0].contact.name, "Test Meta");
    assert.equal(items[0].contact.email, "metatest@ejemplo.com");
  });

  await step("PATCH /api/leads/:id status inválido -> 400", async () => {
    const res = await fetch(`${base}/api/leads/${webLeadId}`, { method: "PATCH", headers: { Authorization: AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ status: "no-existe" }) });
    assert.equal(res.status, 400);
  });

  await step("PATCH /api/leads/:id status + nota -> 200", async () => {
    const res = await fetch(`${base}/api/leads/${webLeadId}`, { method: "PATCH", headers: { Authorization: AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ status: "contactado", note: "Le llamo mañana" }) });
    assert.equal(res.status, 200);
    const lead = await res.json();
    assert.equal(lead.status, "contactado");
    assert.equal(lead.notes.length, 1);
  });

  await step("GET /api/leads/export.csv -> csv con cabecera", async () => {
    const res = await fetch(`${base}/api/leads/export.csv`, { headers: { Authorization: AUTH } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/csv/);
    const text = await res.text();
    assert.match(text.split("\n")[0], /^id,receivedAt,source/);
  });

  await step("DELETE /api/leads/:id -> 204 y luego 404", async () => {
    const del = await fetch(`${base}/api/leads/${webLeadId}`, { method: "DELETE", headers: { Authorization: AUTH } });
    assert.equal(del.status, 204);
    const get = await fetch(`${base}/api/leads/${webLeadId}`, { headers: { Authorization: AUTH } });
    assert.equal(get.status, 404);
  });
}

main()
  .catch((err) => {
    fail++;
    console.error("Error inesperado:", err);
  })
  .finally(() => {
    globalThis.fetch = realFetch;
    server?.close();
    rmSync(tmpDir, { recursive: true, force: true });
    console.log(`\n${pass} ok, ${fail} fallidas`);
    process.exit(fail ? 1 : 0);
  });
