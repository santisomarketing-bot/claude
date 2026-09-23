// ============================================================================
//  config.mjs
//  --------------------------------------------------------------------------
//  Lee la configuración del CRM desde variables de entorno. Todo pasa por
//  loadConfig() para que el servidor y los tests puedan inyectar config propia
//  sin tocar process.env.
// ============================================================================

import { resolve } from "node:path";

// "site1:clave1,site2:clave2" -> Map clave -> nombre del sitio
function parseSiteKeys(value) {
  const map = new Map();
  for (const par of (value || "").split(",")) {
    const [site, key] = par.split(":").map((s) => s?.trim());
    if (site && key) map.set(key, site);
  }
  return map;
}

export function loadConfig(env = process.env) {
  return {
    port: Number(env.CRM_PORT) || 8787,
    dataFile: resolve(env.CRM_DATA_FILE || "crm/data/leads.json"),

    // Dashboard + /api/* (Basic Auth)
    auth: {
      user: env.CRM_USER || "",
      pass: env.CRM_PASS || "",
    },

    meta: {
      verifyToken: env.META_VERIFY_TOKEN || "",
      appSecret: env.META_APP_SECRET || "",
      pageAccessToken: env.META_PAGE_ACCESS_TOKEN || "",
      apiVersion: env.META_API_VERSION || "v21.0",
    },

    google: {
      webhookKey: env.GOOGLE_ADS_WEBHOOK_KEY || "",
    },

    webform: {
      // Claves por sitio cliente: "webweb:abc123,tiendaX:def456"
      siteKeys: parseSiteKeys(env.WEBFORM_API_KEYS),
      // Si no hay ninguna clave configurada, se acepta cualquier origen sin auth
      // (útil en desarrollo; en producción configura WEBFORM_API_KEYS).
      corsOrigin: env.WEBFORM_CORS_ORIGIN || "*",
    },

    // Envío de la secuencia de bienvenida (SMTP propio, p. ej. el Gmail de la
    // agencia). Sin SMTP_HOST/SMTP_USER configurados, el CRM funciona igual
    // pero no manda los correos (se quedan "pendiente" hasta que se configure).
    smtp: {
      host: env.SMTP_HOST || "",
      port: Number(env.SMTP_PORT) || 465,
      secure: env.SMTP_SECURE !== "false", // true por defecto (puerto 465)
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASS || "",
      from: env.SMTP_FROM || env.SMTP_USER || "",
    },

    // Datos de la agencia usados en el contenido de la secuencia de correos.
    agency: {
      name: env.AGENCY_NAME || "Santiso Marketing",
      websiteUrl: env.AGENCY_WEBSITE_URL || "",
      newsletterUrl: env.AGENCY_NEWSLETTER_URL || "",
      senderName: env.AGENCY_SENDER_NAME || "Santiso Marketing",
    },

    sequence: {
      checkIntervalMinutes: Number(env.SEQUENCE_CHECK_INTERVAL_MINUTES) || 5,
    },
  };
}
