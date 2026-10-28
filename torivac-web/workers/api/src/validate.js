// [VALIDATE] Validación estricta de pedidos y mensajes de contacto. Todo lo que llega del navegador es no fiable.
// Reglas: todo texto debe ser una CADENA (si no, 400); los campos de una línea no llevan saltos ni caracteres de control (el asunto del correo al equipo lleva el nombre); las referencias
// se comprueban con Object.hasOwn (nombres como «constructor» o «__proto__» NO son referencias); el correo es estricto; el PDF se valida de verdad (base64 estricto, %PDF-, ≤ 4 MB).
// Los campos de texto de pedido y contacto solo admiten TEXTO PLANO y con límite de caracteres (shared/plain-text.mjs: sin etiquetas, código ni más de 2 enlaces): si no, 400 con
// { error, code: plain_text | too_long | too_many_links, field }. El navegador manda además `_e` (ms entre cargar la página y enviar): si falta o es < FORM_MIN_FILL_MS (1200), 400 con code too_fast.
import { checkText, FIELDS, MAX_LINKS } from '../../../shared/plain-text.mjs';
const LANGS = ['es', 'en', 'fr', 'de'];
/** Caracteres de control (C0 y C1), separadores de línea/párrafo Unicode y marcas de dirección de texto (igual que el API PHP): nunca van en un campo de una línea. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
const LOCAL = "[A-Za-z0-9_%+'-]+(?:\\.[A-Za-z0-9_%+'-]+)*";
/** Correo estricto (ASCII; igual que el del API PHP): parte local de letras, cifras y . _ % + ' - (sin puntos al principio, al final ni dobles), sin , ; < > " ( ) [ ] \ | ni espacios; dominio con al menos un punto y TLD de 2 o más letras (o «xn--»). */
const EMAIL = new RegExp(`^${LOCAL}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$`);
export const PDF_MAX_BYTES = 4_000_000;                                // 4 MB decodificados

/** Texto de UNA línea: sin \r \n \t ni otros caracteres de control (se sustituyen por un espacio), espacios colapsados, recortado y limitado a max caracteres. */
export const oneLine = (s, max) => String(s ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** Texto con saltos de línea (notas, mensajes): conserva \n y el tabulador, convierte \r\n y \r en \n y quita el resto de controles; recortado y limitado a max caracteres. */
export const multiLine = (s, max) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max);
/** True si `s` es un correo válido y estricto (≤ 254 caracteres, parte local ≤ 64). */
export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && s.indexOf('@') > 0 && s.indexOf('@') <= 64 && EMAIL.test(s);
/** True si el valor es ausente (undefined o null) o una cadena. */
const optText = (v) => v == null || typeof v === 'string';
/** True si v es un objeto «de verdad» (no null ni lista). */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Valida el PDF que manda el navegador → { b64 } normalizado (sin saltos de línea) o { error }. Base64 estricto (^[A-Za-z0-9+/]+={0,2}$ tras quitar los saltos de línea, con longitud múltiplo de 4),
 * que decodificado empiece por «%PDF-» y que no pase de 4 MB decodificados. El PDF lo fabrica el navegador del visitante: solo se adjunta al correo del equipo, nunca a terceros.
 */
export function parsePdf(raw) {
  if (typeof raw !== 'string' || raw.length > 6_000_000) return { error: 'PDF adjunto no válido' };
  const b64 = raw.replace(/[\r\n]+/g, '');
  if (b64.length < 8 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'PDF adjunto no válido' };
  const bytes = (b64.length / 4) * 3 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  if (bytes > PDF_MAX_BYTES) return { error: 'PDF adjunto no válido' };
  let head; try { head = atob(b64.slice(0, 8)); } catch { return { error: 'PDF adjunto no válido' }; }
  if (!head.startsWith('%PDF-')) return { error: 'PDF adjunto no válido' };
  return { b64 };
}

/** Milisegundos mínimos entre cargar la página y enviar el formulario (variable FORM_MIN_FILL_MS; 1200 si falta o no es un número; 0 = no se exige `_e`). */
export function minFillMs(env) {
  const v = env && env.FORM_MIN_FILL_MS;
  if (v == null || String(v).trim() === '') return 1200;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1200;
}
/** Error de `_e`: null si trae un entero ≥ el mínimo (o el mínimo es 0); si no, { error, code:'too_fast' }: un bot que postea sin cargar la página. */
function fillTimeError(raw, min) {
  if (!min) return null;
  return Number.isInteger(raw._e) && raw._e >= min ? null : { error: 'Formulario incompleto. Recarga la página e inténtalo de nuevo.', code: 'too_fast' };
}
/**
 * Revisa los campos de texto (`spec`: nombre → multilínea sí/no) de `src` con shared/plain-text.mjs y los límites de `form` → { out } con los textos NORMALIZADOS o { error, code, field }.
 * code = plain_text (etiquetas, código…) · too_long · too_many_links; el error va en castellano y code/field son para que el navegador lo muestre traducido.
 */
function textFields(src, form, spec) {
  const out = {};
  for (const [k, multiline] of Object.entries(spec)) {
    const max = FIELDS[form][k], r = checkText(src[k], { max, multiline });
    if (!r.ok) {
      const code = r.code === 'not_text' ? 'plain_text' : r.code;
      return { error: code === 'too_long' ? `El texto es demasiado largo (máximo ${max} caracteres).` : code === 'too_many_links' ? `Máximo ${MAX_LINKS} enlaces por texto.` : `Escribe solo texto: sin etiquetas, código ni más de ${MAX_LINKS} enlaces.`, code, field: k };
    }
    out[k] = r.text;
  }
  return { out };
}

/** Valida y normaliza el pedido del navegador (cliente, líneas pedibles de items, idioma, PDF) → { order } o { error, code?, field? }. `minFillMs` = tiempo mínimo de relleno (0 = no se exige; quien llama pasa minFillMs(env)). */
export function parseOrder(raw, items, { minFillMs: min = 0 } = {}) {
  if (!isObj(raw)) return { error: 'Petición no válida' };
  if (raw.hp) return { error: 'Solicitud no válida' };                                // honeypot
  const tooFast = fillTimeError(raw, min); if (tooFast) return tooFast;
  const c = isObj(raw.customer) ? raw.customer : {};
  if (!['name', 'company', 'email', 'phone', 'notes'].every((k) => optText(c[k])) || !optText(raw.lang) || !optText(raw.turnstileToken)) return { error: 'Petición no válida' };      // un campo de texto que no es una cadena (lista, objeto, número…) no se acepta
  const t = textFields(c, 'order', { name: false, company: false, phone: false, notes: true }); if (t.error) return t;       // solo texto plano y con el límite de cada campo
  const customer = { name: t.out.name, company: t.out.company, email: oneLine(c.email, 254).toLowerCase(), phone: t.out.phone, notes: t.out.notes };
  if (customer.name.length < 2) return { error: 'Falta el nombre' };
  if (!isEmail(customer.email)) return { error: 'Correo no válido' };
  if (c.privacy !== true) return { error: 'Debes aceptar la política de privacidad' };
  if (!Array.isArray(raw.lines) || !raw.lines.length) return { error: 'El presupuesto está vacío' };
  if (raw.lines.length > 200) return { error: 'Demasiadas líneas (máx. 200)' };
  const seen = new Map();
  for (const l of raw.lines) {
    const rawRef = isObj(l) ? l.ref ?? '' : '';
    if (typeof rawRef !== 'string') return { error: 'Petición no válida' };
    const ref = oneLine(rawRef, 60), qty = isObj(l) ? l.qty : undefined;
    if (!ref || !Object.hasOwn(items, ref)) return { error: `Referencia desconocida: ${ref || '(vacía)'}` };
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 1_000_000) return { error: `Cantidad no válida para ${ref}` };      // solo números enteros (ni «0x10» ni «12» entre comillas)
    const sum = (seen.get(ref) || 0) + qty; if (sum > 1_000_000) return { error: `Cantidad no válida para ${ref}` };
    seen.set(ref, sum);
  }
  const lang = LANGS.includes(raw.lang) ? raw.lang : 'es';
  let pdf = null;
  if (raw.pdf !== undefined && raw.pdf !== null && raw.pdf !== '' && raw.pdf !== false) { const p = parsePdf(raw.pdf); if (p.error) return { error: p.error }; pdf = p.b64; }          // ausente, nulo, vacío o false = sin PDF; cualquier otra cosa se valida
  return { order: { customer, lines: [...seen].map(([ref, qty]) => ({ ref, qty })), lang, pdf, copyToCustomer: raw.copy !== false, turnstile: raw.turnstileToken || '' } };
}
/** Valida y normaliza el formulario de contacto (honeypot, tiempo de relleno, nombre, correo, mensaje, privacidad) → { contact } o { error, code?, field? }. */
export function parseContact(raw, { minFillMs: min = 0 } = {}) {
  if (!isObj(raw)) return { error: 'Petición no válida' };
  if (raw.hp) return { error: 'Solicitud no válida' };
  const tooFast = fillTimeError(raw, min); if (tooFast) return tooFast;
  if (!['name', 'email', 'message', 'lang', 'turnstileToken'].every((k) => optText(raw[k]))) return { error: 'Petición no válida' };
  const t = textFields(raw, 'contact', { name: false, message: true }); if (t.error) return t;                           // solo texto plano y con el límite de cada campo
  const m = { name: t.out.name, email: oneLine(raw.email, 254).toLowerCase(), message: t.out.message, lang: LANGS.includes(raw.lang) ? raw.lang : 'es', turnstile: raw.turnstileToken || '' };
  if (m.name.length < 2) return { error: 'Falta el nombre' };
  if (!isEmail(m.email)) return { error: 'Correo no válido' };
  if (m.message.length < 3) return { error: 'Falta el mensaje' };
  if (raw.privacy !== true) return { error: 'Debes aceptar la política de privacidad' };
  return { contact: m };
}
