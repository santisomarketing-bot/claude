// [PROPOSALS] Decisiones del manager sobre las propuestas de mejora del panel (clave KV proposals:state: id de la propuesta → entrada). Igual que backend-php/api/lib/Proposals.php.
// Una entrada es { state: ok|no, by, at } y, si el manager ha editado la propuesta, también:
//   mode  → qué hace su texto: replace (sustituye el párrafo de la web que contiene `find`) · translate (descripción del producto en otro idioma) · title (título de la portada, una línea
//           «es: …» por idioma) · add (texto que falta y se añade) · note (decisión o dato para el equipo, sin cambio automático)
//   text  → SU versión del texto (≤ 3000 caracteres) · find → fragmento de la web que se sustituye (≤ 300) · note → nota libre (≤ 500)
// Todo es TEXTO PLANO (las mismas reglas que los formularios públicos, shared/plain-text.mjs). Aprobar NO publica nada por sí solo: el texto aprobado se descarga desde el panel y se aplica
// en la siguiente actualización de la web (scripts/apply_proposals.mjs).
import { checkText, MAX_LINKS } from '../../../shared/plain-text.mjs';

/** Valores válidos de `mode`. */
export const MODES = ['replace', 'translate', 'title', 'add', 'note'];
/** Límites de caracteres de cada campo de texto y si admite varias líneas. */
const FIELDS = { text: { max: 3000, multiline: true }, find: { max: 300, multiline: false }, note: { max: 500, multiline: true } };

/**
 * Valida el cuerpo de POST /api/proposals/state para el estado `ok` o `no` → { entry } con los textos ya normalizados (sin controles ni invisibles) o { error, code?, field? }. Los campos
 * ausentes o vacíos no se guardan; un campo que no es una cadena, un `mode` desconocido o un texto que no es texto plano o se pasa del límite dan error.
 */
export function proposalEntry(b, state, by, nowMs) {
  const e = { state, by, at: new Date(nowMs).toISOString() };
  if (b.mode != null && b.mode !== '') {
    if (typeof b.mode !== 'string' || !MODES.includes(b.mode)) return { error: 'Modo no válido', code: 'mode', field: 'mode' };
    e.mode = b.mode;
  }
  for (const [k, { max, multiline }] of Object.entries(FIELDS)) {
    const v = b[k];
    if (v == null || v === '') continue;
    if (typeof v !== 'string') return { error: 'Petición no válida', code: 'plain_text', field: k };
    const r = checkText(v, { max, multiline });
    if (!r.ok) {
      const code = r.code === 'not_text' ? 'plain_text' : r.code;
      return { error: code === 'too_long' ? `El texto es demasiado largo (máximo ${max} caracteres).` : code === 'too_many_links' ? `Máximo ${MAX_LINKS} enlaces por texto.` : `Escribe solo texto: sin etiquetas, código ni más de ${MAX_LINKS} enlaces.`, code, field: k };
    }
    if (r.text !== '') e[k] = r.text;
  }
  return { entry: e };
}
