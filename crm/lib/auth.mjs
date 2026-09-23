// ============================================================================
//  auth.mjs
//  --------------------------------------------------------------------------
//  Basic Auth para el dashboard y /api/*. Comparación en tiempo constante
//  para no filtrar la contraseña por temporización.
// ============================================================================

import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Devuelve true si las credenciales del header Authorization coinciden.
export function checkBasicAuth(authHeader, { user, pass }) {
  if (!user || !pass) return false; // sin credenciales configuradas -> nunca autoriza
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  const gotUser = decoded.slice(0, sep);
  const gotPass = decoded.slice(sep + 1);
  return safeEqual(gotUser, user) && safeEqual(gotPass, pass);
}
