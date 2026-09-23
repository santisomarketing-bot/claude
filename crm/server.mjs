#!/usr/bin/env node
// ============================================================================
//  crm/server.mjs — CRM propio: leads de Meta Ads, Google Ads y formularios web
//  --------------------------------------------------------------------------
//  Servidor HTTP con Node puro (sin frameworks). Expone:
//
//    Webhooks de entrada (sin Basic Auth; cada uno se autentica a su manera):
//      GET  /webhooks/meta        verificación de la suscripción (Meta)
//      POST /webhooks/meta        lead nuevo de Meta Lead Ads
//      POST /webhooks/google      lead nuevo de Google Ads (Lead Form webhook)
//      POST /webhooks/web-form    lead nuevo de un formulario web
//
//    Dashboard + API (protegidos con Basic Auth: CRM_USER / CRM_PASS):
//      GET    /                   panel
//      GET    /api/leads          listar (filtros: source, status, q, from, to, limit, offset)
//      GET    /api/leads/export.csv
//      GET    /api/leads/:id
//      PATCH  /api/leads/:id      { status?, note? }
//      DELETE /api/leads/:id
//      GET    /api/stats
//
//    GET /health                  sin auth, para monitorización
//
//  Uso: npm run crm   (lee configuración de variables de entorno, ver .env.example)
//  Ver CRM_LEADS.md para la puesta en marcha completa.
// ============================================================================

import { createServer as createHttpServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { loadConfig } from "./lib/config.mjs";
import { LeadStore } from "./lib/store.mjs";
import { isValidStatus, STATUSES, SOURCES } from "./lib/schema.mjs";
import { checkBasicAuth } from "./lib/auth.mjs";
import { verifyMetaHandshake, verifyMetaSignature, parseMetaChanges, fetchMetaLeadData, normalizeMetaLead, buildPendingMetaLead } from "./lib/sources/meta.mjs";
import { verifyGoogleKey, normalizeGoogleLead } from "./lib/sources/google.mjs";
import { verifyWebformKey, normalizeWebformLead } from "./lib/sources/webform.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const BODY_LIMIT = 1_000_000; // 1 MB, de sobra para un lead

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

// ---------------------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------------------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType, "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error("Cuerpo demasiado grande"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseBody(raw, contentType) {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (ct === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(raw.toString("utf8")));
  }
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return {};
  }
}

function requireAuth(req, res, config) {
  if (checkBasicAuth(req.headers["authorization"], config.auth)) return true;
  res.writeHead(401, { "WWW-Authenticate": 'Basic realm="CRM Santiso Marketing"', "Content-Type": "text/plain; charset=utf-8" });
  res.end("Autenticación requerida");
  return false;
}

function serveStatic(res, filename) {
  const path = join(PUBLIC_DIR, filename);
  if (!existsSync(path)) return sendText(res, 404, "No encontrado");
  const body = readFileSync(path);
  res.writeHead(200, { "Content-Type": MIME[extname(path)] || "application/octet-stream", "Content-Length": body.length });
  res.end(body);
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(leads) {
  const cols = ["id", "receivedAt", "source", "site", "status", "name", "email", "phone", "company", "message"];
  const rows = leads.map((l) => [l.id, l.receivedAt, l.source, l.site || "", l.status, l.contact.name, l.contact.email, l.contact.phone, l.contact.company, l.message]);
  return [cols.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

export function createServer(config) {
  const store = new LeadStore(config.dataFile);

  return createHttpServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    res.on("finish", () => {
      console.log(`${req.method} ${path} -> ${res.statusCode} (${Date.now() - started}ms)`);
    });

    try {
      // ---- Salud ----
      if (req.method === "GET" && path === "/health") return sendJson(res, 200, { ok: true });

      // ---- Webhook: Meta Lead Ads ----
      if (path === "/webhooks/meta" && req.method === "GET") {
        const challenge = verifyMetaHandshake(query, config.meta.verifyToken);
        if (challenge == null) return sendText(res, 403, "Verificación fallida");
        return sendText(res, 200, challenge);
      }

      if (path === "/webhooks/meta" && req.method === "POST") {
        const raw = await readRawBody(req);
        if (!verifyMetaSignature(raw, req.headers["x-hub-signature-256"], config.meta.appSecret)) {
          return sendText(res, 401, "Firma inválida");
        }
        const payload = JSON.parse(raw.toString("utf8") || "{}");
        const avisos = parseMetaChanges(payload);
        for (const aviso of avisos) {
          if (!aviso.leadgenId) continue;
          let lead;
          try {
            const datos = await fetchMetaLeadData(aviso.leadgenId, config.meta);
            lead = normalizeMetaLead(datos, aviso);
          } catch (err) {
            lead = buildPendingMetaLead(aviso, err);
          }
          await store.addLead(lead);
        }
        // Meta espera un 200 rápido; si tarda/falla reintenta y duplicaríamos avisos.
        return sendText(res, 200, "EVENT_RECEIVED");
      }

      // ---- Webhook: Google Ads (Lead Form) ----
      if (path === "/webhooks/google" && req.method === "POST") {
        const raw = await readRawBody(req);
        const payload = parseBody(raw, req.headers["content-type"]);
        if (!verifyGoogleKey(payload, config.google.webhookKey)) return sendJson(res, 401, { error: "clave inválida" });
        const lead = normalizeGoogleLead(payload);
        const { created } = await store.addLead(lead);
        return sendJson(res, created ? 201 : 200, { success: true });
      }

      // ---- Webhook: formulario web ----
      if (path === "/webhooks/web-form") {
        res.setHeader("Access-Control-Allow-Origin", config.webform.corsOrigin);
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          return res.end();
        }

        if (req.method === "POST") {
          const raw = await readRawBody(req);
          const body = parseBody(raw, req.headers["content-type"]);
          const providedKey = req.headers["x-api-key"] || query.key || body.api_key;
          const site = verifyWebformKey(providedKey, config.webform.siteKeys);
          if (!site) return sendJson(res, 401, { error: "clave de sitio inválida" });

          const lead = normalizeWebformLead(body, site);
          if (!lead.contact.email && !lead.contact.phone) {
            return sendJson(res, 422, { error: "falta email o teléfono de contacto" });
          }
          await store.addLead(lead);

          if (body.redirect) {
            res.writeHead(302, { Location: String(body.redirect) });
            return res.end();
          }
          return sendJson(res, 201, { ok: true, id: lead.id });
        }
      }

      // ---- A partir de aquí: dashboard + API, requieren Basic Auth ----
      if (!requireAuth(req, res, config)) return;

      if (req.method === "GET" && path === "/") return serveStatic(res, "index.html");
      if (req.method === "GET" && path === "/app.js") return serveStatic(res, "app.js");
      if (req.method === "GET" && path === "/styles.css") return serveStatic(res, "styles.css");

      if (req.method === "GET" && path === "/api/stats") return sendJson(res, 200, await store.stats());

      if (req.method === "GET" && path === "/api/leads/export.csv") {
        const { items } = await store.listLeads({ ...query, limit: 100000, offset: 0 });
        const csv = toCsv(items);
        res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"' });
        return res.end(csv);
      }

      if (req.method === "GET" && path === "/api/leads") {
        const { source, status, q, from, to } = query;
        const limit = Math.min(Number(query.limit) || 50, 500);
        const offset = Number(query.offset) || 0;
        const result = await store.listLeads({ source, status, q, from, to, limit, offset });
        return sendJson(res, 200, result);
      }

      const leadIdMatch = path.match(/^\/api\/leads\/([^/]+)$/);
      if (leadIdMatch) {
        const id = decodeURIComponent(leadIdMatch[1]);
        if (req.method === "GET") {
          const lead = await store.getLead(id);
          return lead ? sendJson(res, 200, lead) : sendJson(res, 404, { error: "no encontrado" });
        }
        if (req.method === "PATCH") {
          const raw = await readRawBody(req);
          const body = parseBody(raw, req.headers["content-type"]);
          if (body.status && !isValidStatus(body.status)) {
            return sendJson(res, 400, { error: `status inválido, usa: ${STATUSES.join(", ")}` });
          }
          const lead = await store.updateLead(id, body);
          return lead ? sendJson(res, 200, lead) : sendJson(res, 404, { error: "no encontrado" });
        }
        if (req.method === "DELETE") {
          const ok = await store.deleteLead(id);
          return ok ? sendJson(res, 204, {}) : sendJson(res, 404, { error: "no encontrado" });
        }
      }

      return sendJson(res, 404, { error: "ruta no encontrada" });
    } catch (err) {
      console.error("Error en", req.method, path, err);
      const status = err.statusCode || 500;
      if (!res.headersSent) sendJson(res, status, { error: err.message || "error interno" });
    }
  });
}

// ---- Arranque directo: node crm/server.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  if (!config.auth.user || !config.auth.pass) {
    console.warn("⚠️  CRM_USER / CRM_PASS no configurados: el dashboard y la API quedarán inaccesibles.");
  }
  const server = createServer(config);
  server.listen(config.port, () => {
    console.log(`CRM escuchando en http://localhost:${config.port}  (fuentes: ${SOURCES.join(", ")})`);
    console.log(`Datos en: ${config.dataFile}`);
  });
}
