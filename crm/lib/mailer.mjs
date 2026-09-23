// ============================================================================
//  mailer.mjs
//  --------------------------------------------------------------------------
//  Envío por SMTP: el propio correo de la agencia (p. ej. Gmail con
//  contraseña de aplicación), sin ningún proveedor de email marketing de por
//  medio. createTransport() devuelve null si SMTP_HOST/SMTP_USER no están
//  configurados — el resto del CRM sigue funcionando igual, simplemente los
//  pasos de la secuencia se quedan "pendiente" hasta que se rellenen
//  (ver crm/.env.example).
// ============================================================================

import nodemailer from "nodemailer";

export function createTransport(smtp) {
  if (!smtp?.host || !smtp?.user) return null;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

export async function sendMail(transport, { to, from, subject, html }) {
  if (!transport) throw new Error("SMTP no configurado");
  return transport.sendMail({ to, from, subject, html });
}

// ---- Autotest: node crm/lib/mailer.mjs ----
// (createTransport no abre conexión de red: nodemailer solo construye el
// objeto. Verificarlo aquí no manda ningún correo real.)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("sin host/user -> null:", createTransport({ host: "", user: "" }) === null);
  console.log("sin config -> null:", createTransport(undefined) === null);
  const t = createTransport({ host: "smtp.ejemplo.com", port: 465, secure: true, user: "a@ejemplo.com", pass: "x" });
  console.log("con config -> transporte con sendMail:", typeof t?.sendMail === "function");
}
