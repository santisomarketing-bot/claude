// ============================================================================
//  google-novedades-prompts.mjs
//  --------------------------------------------------------------------------
//  Lógica versionada del publicador semanal de "Novedades" (Updates/Local
//  Posts) de Google Business Profile. La orquestación (disparador semanal,
//  IA, publicar el post) vive en Make.com (ver GOOGLE_NOVEDADES.md). Este
//  módulo aporta lo que conviene tener VERSIONADO y probado:
//
//    - TEMAS: la rotación de ángulos para no publicar siempre lo mismo.
//    - siguienteTema: qué tema toca esta semana según el último usado.
//    - promptNovedad: el prompt que se pega en el módulo de IA de Make.
//    - recortaResumen: límite real de Google Business Profile (1500 car.).
//
//  Flujo (ver GOOGLE_NOVEDADES.md):
//    1) Cada semana, Make lee la fila de cada cliente activo en el Sheet
//       "Clientes GBP" (nombre, tono, temas propios, último tema usado).
//    2) siguienteTema() decide el ángulo del post de esta semana.
//    3) Módulo de IA con el prompt de promptNovedad() redacta el texto.
//    4) Make publica el post (Create a Post) y actualiza "último tema" en
//       la fila del cliente para que la próxima semana rote al siguiente.
// ============================================================================

// Google Business Profile corta el resumen de un post en ~1500 caracteres.
export const LIMITE_CARACTERES = 1500;

// Rotación de ángulos por defecto (se puede pisar con `temasCliente` por fila).
export const TEMAS = ["oferta_o_promocion", "consejo_util", "detras_de_camaras", "novedad_del_negocio", "testimonio_o_caso"];

// último: el tema usado la semana pasada (o null/"" la primera vez).
// propios: lista opcional de temas específicos del cliente que sustituye a TEMAS.
export function siguienteTema(ultimo, propios) {
  const lista = Array.isArray(propios) && propios.length ? propios : TEMAS;
  const i = lista.indexOf(ultimo);
  return lista[(i + 1) % lista.length];
}

const ETIQUETA_TEMA = {
  oferta_o_promocion: "una oferta, promoción o servicio destacado del negocio",
  consejo_util: "un consejo útil relacionado con el sector del negocio (no un anuncio directo)",
  detras_de_camaras: "algo de \"detrás de cámaras\": el equipo, el local, cómo se trabaja",
  novedad_del_negocio: "una novedad real del negocio (horario, servicio nuevo, producto nuevo)",
  testimonio_o_caso: "un caso de éxito o testimonio genérico (sin inventar nombres reales de clientes)",
};

// cliente: { nombre, tono, sector?, temas? } — fila del Sheet "Clientes GBP".
// tema: uno de TEMAS (o de cliente.temas) — normalmente el de siguienteTema().
export function promptNovedad(cliente, tema) {
  const tono = cliente.tono || "cercano y profesional";
  const angulo = ETIQUETA_TEMA[tema] || tema;

  return (
    `Eres quien redacta la publicación semanal de "Novedades" en el Google Business ` +
    `Profile de "${cliente.nombre}"${cliente.sector ? ` (${cliente.sector})` : ""}. Tono de la marca: ${tono}.\n\n` +
    `Esta semana el ángulo del post es: ${angulo}.\n\n` +
    `Escribe el texto del post. Reglas:\n` +
    `- Máximo ${LIMITE_CARACTERES} caracteres, pero apunta a 250-400: los posts cortos se leen mejor.\n` +
    `- Nada de precios, plazos, horarios ni datos concretos que no te haya dado el negocio: si el ángulo` +
    ` los necesita, deja un hueco genérico en vez de inventarlos (ej. "consulta disponibilidad").\n` +
    `- Una sola llamada a la acción clara al final (llamar, visitar la web, pasarse por el local).\n` +
    `- Sin hashtags, sin exceso de emojis (0-1 si aporta), sin mayúsculas sostenidas.\n` +
    `Devuelve SOLO el texto del post, sin comillas ni explicaciones.`
  );
}

export function recortaResumen(texto, limite = LIMITE_CARACTERES) {
  const t = String(texto || "").trim();
  if (t.length <= limite) return t;
  return t.slice(0, limite - 1).trimEnd() + "…";
}

// Asunto/cuerpo del email-resumen semanal que audita lo publicado (opcional,
// ver GOOGLE_NOVEDADES.md — módulo Gmail al final del escenario).
export function asuntoResumen(fechaISO) {
  return `Novedades Google Business publicadas — semana del ${fechaISO}`;
}

export function cuerpoResumen(publicaciones) {
  const li = (p) =>
    `<li style="margin-bottom:8px"><b>${p.cliente}</b> — tema: ${p.tema}<br>` +
    `<span style="color:#555">${p.texto}</span></li>`;
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;max-width:640px">` +
    `<p>Posts publicados esta semana en Google Business Profile:</p>` +
    `<ul style="margin-top:0">${publicaciones.map(li).join("")}</ul>` +
    `<hr style="border:none;border-top:1px solid #ddd;margin:16px 0">` +
    `<p style="color:#888;font-size:12px">Enviado automáticamente por el publicador semanal · Santiso Marketing</p>` +
    `</div>`
  );
}

// ---- Autotest: node google-novedades-prompts.mjs ----
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("rotación completa desde vacío:");
  let ultimo = "";
  for (let i = 0; i < TEMAS.length + 2; i++) {
    ultimo = siguienteTema(ultimo);
    console.log(" ", i + 1, "->", ultimo);
  }

  const cliente = { nombre: "Clínica Demo", tono: "cercano y profesional", sector: "clínica dental" };
  console.log("\n-- prompt oferta_o_promocion --\n", promptNovedad(cliente, "oferta_o_promocion"));

  const propios = ["cita_urgente", "financiacion"];
  console.log("\nrotación con temas propios del cliente:");
  console.log(" siguiente tras 'cita_urgente':", siguienteTema("cita_urgente", propios));
  console.log(" siguiente tras 'financiacion':", siguienteTema("financiacion", propios));

  const largo = "Ven a vernos ".repeat(200);
  console.log("\nrecorte largo → longitud:", recortaResumen(largo).length, "(debe ser <=", LIMITE_CARACTERES, ")");
}
