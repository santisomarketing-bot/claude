// ============================================================================
//  daily-leads.mjs
//  --------------------------------------------------------------------------
//  Utilidades para el envío diario de leads de LinkedIn por correo.
//
//  El buscador (WebSearch) lo ejecuta la sesión de Claude programada; este
//  módulo aporta lo que conviene tener VERSIONADO y probado:
//    - QUERIES: las consultas canónicas de intención de compra.
//    - extraeActivityId / decodeActivityDate: fecha real del post desde su ID.
//    - clasifica: 🟢/🟡/🔴 según antigüedad.
//    - construyeEmailHtml: el cuerpo del correo a partir de los leads.
//
//  Flujo diario (ver DAILY_LEADS.md):
//    1) La sesión corre WebSearch con cada QUERY.
//    2) Por cada resultado saca el activity-id de la URL y lo fecha aquí.
//    3) Ordena por frescura, arma el HTML y lo envía con Gmail a EMAIL_DESTINO.
// ============================================================================

export const EMAIL_DESTINO = "santisomarketing@gmail.com";

// Consultas de intención de compra (posts públicos, sin tocar el login).
// Edita/añade libremente: cuantas más, más cobertura.
export const QUERIES = [
  'site:linkedin.com/posts "busco agencia de marketing"',
  'site:es.linkedin.com/posts "busco agencia" (marketing OR redes OR publicidad)',
  'site:es.linkedin.com/posts "recomendáis" agencia marketing OR redes sociales',
  'site:es.linkedin.com/posts "necesito una agencia" marketing OR redes',
  'site:es.linkedin.com/posts "busco" ("community manager" OR "llevar mis redes") España',
  'site:es.linkedin.com/posts "necesito ayuda con" (redes sociales OR marketing OR mi marca)',
];

// Umbrales de frescura en días.
export const UMBRAL_FRESCO = 120; // 🟢
export const UMBRAL_RECIENTE = 365; // 🟡

// El activity-id de LinkedIn va embebido en la URL del post:
//   .../algo-activity-7473358870170505216-eGKW
export function extraeActivityId(url) {
  const m = String(url).match(/activity-(\d{15,25})/);
  return m ? m[1] : null;
}

// El id lleva el timestamp en ms en sus primeros bits: ts = id >> 22
export function decodeActivityDate(id, ahoraMs) {
  if (!id) return null;
  const ts = Number(BigInt(id) >> 22n);
  const dias = Math.round((ahoraMs - ts) / 86400000);
  const fecha = new Date(ts).toISOString().slice(0, 10);
  return { ts, fecha, dias };
}

export function clasifica(dias) {
  if (dias <= UMBRAL_FRESCO) return "🟢";
  if (dias <= UMBRAL_RECIENTE) return "🟡";
  return "🔴";
}

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// leads: [{autor, fecha, dias, pide, url}]  (ya fechados y ordenados o no)
export function construyeEmailHtml(leads, ahoraMs) {
  const orden = [...leads].sort((a, b) => a.dias - b.dias);
  const frescos = orden.filter((l) => l.dias <= UMBRAL_FRESCO);
  const recientes = orden.filter((l) => l.dias > UMBRAL_FRESCO && l.dias <= UMBRAL_RECIENTE);
  const viejos = orden.filter((l) => l.dias > UMBRAL_RECIENTE);
  const fechaHoy = new Date(ahoraMs).toISOString().slice(0, 10);

  const li = (l) =>
    `<li style="margin-bottom:6px"><b>${esc(l.autor)}</b> — ${esc(l.fecha)} — ${esc(l.pide)}<br>` +
    `<a href="${esc(l.url)}">Ver post</a></li>`;

  const bloque = (titulo, color, items) =>
    items.length
      ? `<h3 style="color:${color};margin-bottom:4px">${titulo}</h3><ul style="margin-top:0">${items.map(li).join("")}</ul>`
      : "";

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;max-width:640px">` +
    `<p>Barrido diario de posts <b>públicos</b> de LinkedIn pidiendo agencia de marketing (${fechaHoy}). ` +
    `Fecha decodificada del propio post para separar leads vivos de muertos.</p>` +
    bloque("🟢 Frescos (&lt; 4 meses)", "#1a7f37", frescos) +
    bloque("🟡 Recientes (&lt; 1 año)", "#9a6700", recientes) +
    (viejos.length
      ? `<h3 style="color:#a40e26;margin-bottom:4px">🔴 Viejos (referencia)</h3>` +
        `<p style="margin-top:0">${viejos.map((l) => `${esc(l.autor)} (${esc(l.fecha)})`).join(" · ")}</p>`
      : "") +
    (orden.length === 0 ? `<p>Hoy no hubo posts nuevos con intención de compra.</p>` : "") +
    `<hr style="border:none;border-top:1px solid #ddd;margin:16px 0">` +
    `<p style="color:#888;font-size:12px">Enviado automáticamente por tu buscador de oportunidades LinkedIn · Santiso Marketing</p>` +
    `</div>`
  );
}

// Autotest al ejecutar directamente: node daily-leads.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const ahora = Date.UTC(2026, 7, 21); // fecha fija para test reproducible
  const id = extraeActivityId(
    "https://es.linkedin.com/posts/micaelastrahovsky_busco-agencias-o-empresas-herramientas-ai-activity-7473358870170505216-eGKW"
  );
  const d = decodeActivityDate(id, ahora);
  console.log("id:", id, "→", d, clasifica(d.dias));
  const html = construyeEmailHtml(
    [{ autor: "Micaela Strahovsky", ...d, pide: "busca agencias herramientas AI", url: "https://x" }],
    ahora
  );
  console.log("html len:", html.length, "| contiene 🟢:", html.includes("🟢"));
}
