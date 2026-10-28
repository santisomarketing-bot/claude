// [PASSWORDS] Contraseñas con PBKDF2-HMAC-SHA256 (100 000 iteraciones, el máximo de Workers; sal de 16 B) y política de contraseñas nuevas.
import { timingSafeEqual, toHex, fromHex } from './util.js';

const ITER = 100_000;
const te = new TextEncoder();
const MIN_LEN = 12, MAX_LEN = 1000;
/** Prefijos de contraseñas triviales (se comparan sin mayúsculas, sin acentos y sin signos): «password…», «123456…», «torivac…», «qwerty…», la del demo (Torivac-Manager-2026), etc. Misma lista que el API PHP. */
const TRIVIAL = ['password', 'passw0rd', 'contrasena', '123456', 'qwerty', 'azerty', 'abc123', 'torivac', 'admin', 'letmein', 'welcome', 'iloveyou', 'changeme', 'cambiame', 'secreto', 'bienvenid'];

/** Deriva 256 bits de la contraseña con PBKDF2-HMAC-SHA256 y la sal dada (ITER iteraciones); devuelve Uint8Array. */
async function pbkdf2(password, salt) {
  const k = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, k, 256));
}
/** Genera una sal aleatoria de 16 B y devuelve { hash, salt } en hexadecimal, listos para guardar en el usuario. */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: toHex(await pbkdf2(password, salt)), salt: toHex(salt) };
}
/** True si la contraseña con esa sal da el hash guardado (comparación en tiempo constante, también en longitud). */
export async function verifyPassword(password, hashHex, saltHex) {
  return timingSafeEqual(toHex(await pbkdf2(password, fromHex(saltHex))), hashHex);
}
/** Minúsculas, sin acentos y solo letras y cifras: «Torivac-Manager-2026» → «torivacmanager2026». */
const flat = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/**
 * Motivo por el que una contraseña NUEVA no vale (texto para mostrar), o null si vale: mínimo 12 caracteres (y como mucho 1000), que no contenga la parte local del correo (también sin la
 * etiqueta «+algo»; si tiene 3 o más letras y cifras), que no empiece por una contraseña trivial y que tenga al menos 5 caracteres distintos. Solo se aplica al dar de alta (los usuarios
 * ya creados no se tocan). Se comparan sin acentos («Contraseña…» cuenta como «contrasena…»), algo más estricto que el PHP.
 */
export function passwordProblem(password, email = '') {
  const pw = String(password ?? '');
  if (pw.length > MAX_LEN) return `La contraseña es demasiado larga (máx. ${MAX_LEN} caracteres)`;
  if ([...pw].length < MIN_LEN) return `La contraseña necesita al menos ${MIN_LEN} caracteres`;
  const f = flat(pw), local = String(email).trim().toLowerCase().split('@')[0];
  for (const l of new Set([local, local.split('+')[0]])) { const t = flat(l); if (t.length >= 3 && f.includes(t)) return 'La contraseña no puede contener tu correo'; }
  if (TRIVIAL.some((t) => f.startsWith(t)) || new Set([...pw]).size < 5) return 'Esa contraseña es demasiado fácil de adivinar';
  return null;
}
