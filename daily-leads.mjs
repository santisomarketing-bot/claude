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
  // --- Marketing / redes / agencia general ---
  'site:linkedin.com/posts "busco agencia de marketing"',
  'site:es.linkedin.com/posts "busco agencia" (marketing OR redes OR publicidad)',
  'site:es.linkedin.com/posts "recomendáis" agencia marketing OR redes sociales',
  'site:es.linkedin.com/posts "necesito una agencia" marketing OR redes',
  'site:es.linkedin.com/posts "busco" ("community manager" OR "llevar mis redes") España',
  'site:es.linkedin.com/posts "necesito ayuda con" (redes sociales OR marketing OR mi marca)',
  // --- Diseño / desarrollo web ---
  'site:linkedin.com/posts ("busco" OR "necesito" OR "recomendáis") ("diseño web" OR "web design" OR "diseñador web" OR "página web" OR "desarrollo web")',
  'site:es.linkedin.com/posts ("busco" OR "necesito") ("hacer una web" OR "rehacer la web" OR "tienda online" OR ecommerce)',
  // --- SEO / GEO (posicionamiento en buscadores y en motores generativos/IA) ---
  'site:linkedin.com/posts ("busco" OR "necesito" OR "recomendáis") ("agencia SEO" OR "consultor SEO" OR "posicionamiento web" OR SEO)',
  'site:linkedin.com/posts ("busco" OR "necesito") ("GEO" OR "Generative Engine Optimization" OR "posicionamiento en IA" OR "aparecer en ChatGPT")',
  // --- ADS / paid media ---
  'site:linkedin.com/posts ("busco" OR "necesito" OR "recomendáis") ("Google Ads" OR "Meta Ads" OR "campañas de ads" OR "gestión de ads" OR "agencia de publicidad")',
];

// Umbrales de frescura en días (para clasificar/etiquetar en el correo).
export const UMBRAL_FRESCO = 120; // 🟢
export const UMBRAL_RECIENTE = 365; // 🟡

// Ventana de recencia: solo se envían posts publicados dentro de estas horas.
// 24 h de lunes a viernes; 48 h en fin de semana (sábado y domingo).
export function ventanaHoras(ahoraMs) {
  const dow = new Date(ahoraMs).getUTCDay(); // 0=domingo ... 6=sábado
  const finde = dow === 0 || dow === 6;
  return finde ? 48 : 24;
}

// Filtra una lista de leads (ya fechados con decodeActivityDate) a la ventana.
export function filtraPorVentana(leads, ahoraMs) {
  const limite = ventanaHoras(ahoraMs);
  return leads.filter((l) => typeof l.horas === "number" && l.horas >= 0 && l.horas <= limite);
}

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
  const horas = (ahoraMs - ts) / 3600000;
  const dias = Math.round((ahoraMs - ts) / 86400000);
  const fecha = new Date(ts).toISOString().slice(0, 10);
  return { ts, fecha, horas, dias };
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
  const viernes = Date.UTC(2026, 7, 21, 15); // vie 21/08/2026 → ventana 24 h
  const sabado = Date.UTC(2026, 7, 22, 15); // sáb 22/08/2026 → ventana 48 h
  console.log("ventana viernes:", ventanaHoras(viernes), "h  | ventana sábado:", ventanaHoras(sabado), "h");

  // Un post viejo (2026-06) y uno simulado "de hace 10 h"
  const idViejo = extraeActivityId(
    "https://es.linkedin.com/posts/x_busco-agencia-activity-7473358870170505216-eGKW"
  );
  const dViejo = decodeActivityDate(idViejo, viernes);
  // Fabricamos un id "reciente": ts = ahora - 10h  →  id = ts << 22
  const tsReciente = viernes - 10 * 3600000;
  const idReciente = String(BigInt(tsReciente) << 22n);
  const dReciente = decodeActivityDate(idReciente, viernes);

  const leads = [
    { autor: "Post viejo", ...dViejo, pide: "busca agencia (viejo)", url: "https://a" },
    { autor: "Post reciente", ...dReciente, pide: "busca agencia (hoy)", url: "https://b" },
  ];
  const dentro = filtraPorVentana(leads, viernes);
  console.log("total:", leads.length, "→ dentro de ventana:", dentro.length, "(debe ser 1)");
  console.log("reciente horas:", dReciente.horas.toFixed(1), "| viejo horas:", Math.round(dViejo.horas));
  const html = construyeEmailHtml(dentro, viernes);
  console.log("html len:", html.length, "| solo el reciente:", html.includes("Post reciente") && !html.includes("Post viejo"));
}
