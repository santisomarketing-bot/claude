// ============================================================================
//  google-reviews-prompts.mjs
//  --------------------------------------------------------------------------
//  Lógica versionada del respondedor de reseñas de Google Business Profile.
//  La orquestación (disparador, IA, publicar la respuesta) vive en Make.com
//  (ver GOOGLE_REVIEWS.md) porque ahí ya tienes la conexión con Google Business
//  Profile. Este módulo aporta lo que conviene tener VERSIONADO y probado:
//
//    - decideRuta: 4-5★ → autopublicar · 1-3★ → borrador para aprobar.
//    - promptRespuesta: el prompt que se pega en el módulo de IA de Make.
//    - recortaRespuesta: límite de longitud razonable para una reseña.
//
//  Flujo (ver GOOGLE_REVIEWS.md):
//    1) Make detecta una reseña nueva (Watch Reviews) en cualquier cliente.
//    2) Router: decideRuta() según las estrellas.
//    3) Módulo de IA con el prompt de promptRespuesta().
//    4) 4-5★: publica la respuesta directa (Create/Update a Review Reply).
//       1-3★: manda un email de borrador y NO publica sola.
// ============================================================================

// A partir de esta puntuación (inclusive) la respuesta se publica sola.
export const UMBRAL_AUTOPUBLICAR = 4;

// Límite honesto de longitud: Google admite mucho más, pero una respuesta
// larga se lee como corporativa. Nos quedamos cortos y humanos.
export const LIMITE_CARACTERES = 350;

// true → autopublicar (4-5★) · false → borrador para aprobar (1-3★).
export function decideRuta(estrellas) {
  const n = Number(estrellas);
  if (!Number.isFinite(n)) throw new Error("estrellas debe ser un número (1-5).");
  return n >= UMBRAL_AUTOPUBLICAR;
}

// cliente: { nombre, tono, sector? }  — fila del Sheet "Clientes GBP" (ver GOOGLE_REVIEWS.md)
// reseña:  { autor, estrellas, texto }
export function promptRespuesta(cliente, reseña) {
  const autopublicar = decideRuta(reseña.estrellas);
  const tono = cliente.tono || "cercano y profesional";

  const base =
    `Eres quien gestiona las reseñas de Google Business Profile de "${cliente.nombre}"` +
    (cliente.sector ? ` (${cliente.sector})` : "") +
    `. Tono de la marca: ${tono}.\n\n` +
    `Reseña de ${reseña.autor || "un cliente"} (${reseña.estrellas}★):\n"${reseña.texto || "(sin texto, solo puntuación)"}"\n\n` +
    `Escribe la respuesta pública a esa reseña. Reglas:\n` +
    `- Máximo ${LIMITE_CARACTERES} caracteres, sin emojis de más, sin firmar con el nombre de una persona.\n` +
    `- Menciona algo concreto de la reseña si lo hay; nada de plantilla genérica.\n` +
    `- No inventes datos (precios, plazos, nombres de empleados) que no estén en la reseña.\n` +
    `- No repitas literalmente el nombre del negocio más de una vez.`;

  if (autopublicar) {
    return (
      base +
      `\n- Agradece de forma genuina y, si encaja, invita a volver o a recomendar.` +
      `\nDevuelve SOLO el texto de la respuesta, sin comillas ni explicaciones.`
    );
  }

  return (
    base +
    `\n- Es una reseña de ${reseña.estrellas}★: tono empático, sin ponerte a la defensiva, sin excusas largas.` +
    `\n- Reconoce el problema, discúlpate si aplica, e invita a resolverlo fuera de la reseña (teléfono o email).` +
    `\n- No prometas compensaciones ni soluciones concretas que el negocio no te ha confirmado.` +
    `\nDevuelve SOLO el texto de la respuesta (es un BORRADOR: alguien del equipo lo revisará antes de publicarlo).`
  );
}

export function recortaRespuesta(texto, limite = LIMITE_CARACTERES) {
  const t = String(texto || "").trim();
  if (t.length <= limite) return t;
  return t.slice(0, limite - 1).trimEnd() + "…";
}

// Asunto del email de borrador para reseñas 1-3★ (módulo Gmail en Make).
export function asuntoBorrador(cliente, reseña) {
  return `Reseña ${reseña.estrellas}★ de ${cliente.nombre} — borrador de respuesta pendiente de aprobar`;
}

export function cuerpoBorrador(cliente, reseña, respuestaIA) {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;max-width:640px">` +
    `<p>Nueva reseña de <b>${reseña.estrellas}★</b> en <b>${cliente.nombre}</b> de ${cliente.tono ? "" : ""}${
      reseña.autor || "un cliente"
    }:</p>` +
    `<blockquote style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #ddd;color:#555">${
      reseña.texto || "(sin texto, solo puntuación)"
    }</blockquote>` +
    `<p><b>Borrador de respuesta propuesto:</b></p>` +
    `<blockquote style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #1a7f37">${respuestaIA}</blockquote>` +
    `<p style="color:#888;font-size:12px">No se ha publicado nada todavía. Publícala a mano en Google Business Profile (o edítala primero).</p>` +
    `</div>`
  );
}

// ---- Autotest: node google-reviews-prompts.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const cliente = { nombre: "Clínica Demo", tono: "cercano y profesional", sector: "clínica dental" };

  const positiva = { autor: "Marta", estrellas: 5, texto: "Muy contenta, me atendieron rapidísimo y sin dolor." };
  const negativa = { autor: "Javier", estrellas: 2, texto: "Esperé 40 minutos con cita previa, mala organización." };

  console.log("ruta positiva (debe ser true):", decideRuta(positiva.estrellas));
  console.log("ruta negativa (debe ser false):", decideRuta(negativa.estrellas));
  console.log("\n-- prompt 5★ --\n", promptRespuesta(cliente, positiva));
  console.log("\n-- prompt 2★ --\n", promptRespuesta(cliente, negativa));

  const larga = "Gracias ".repeat(80);
  console.log("\nrecorte largo → longitud:", recortaRespuesta(larga).length, "(debe ser <=", LIMITE_CARACTERES, ")");

  console.log("\nasunto:", asuntoBorrador(cliente, negativa));
}
