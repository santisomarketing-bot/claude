// Dashboard del CRM. JS plano, sin build ni dependencias.
// STATUSES debe reflejar crm/lib/schema.mjs (STATUSES / STATUS_LABELS).
const STATUSES = ["nuevo", "contactado", "respondio", "reunion", "presupuesto", "ganado", "perdido"];
const STATUS_LABELS = { nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", reunion: "Reunión", presupuesto: "Presupuesto", ganado: "Ganado", perdido: "Perdido" };
const SOURCE_LABELS = { meta: "Meta Ads", google: "Google Ads", web: "Formulario web" };
// Debe reflejar crm/lib/sequence.mjs (SEQUENCE_STEPS) y store.mjs (estados de paso).
const SEQUENCE_LABELS = { confirmacion: "Confirmación de recepción", web: "Invitación a la web", newsletter: "Newsletter" };
const SEQUENCE_STATUS_LABELS = { pendiente: "Pendiente", enviado: "Enviado ✓", cancelado: "Cancelado", error: "Error", omitido: "Omitido" };

const state = { q: "", source: "", status: "", limit: 50, offset: 0, total: 0 };

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) p.set(k, v);
  return p.toString();
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.headers.get("content-type")?.includes("json") ? res.json() : res.text();
}

// ---- Estadísticas ----
async function loadStats() {
  const stats = await api("/api/stats");
  const el = document.getElementById("stats");
  el.innerHTML = "";
  const tile = (label, value) => {
    const div = document.createElement("div");
    div.className = "tile";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    div.append(strong, span);
    return div;
  };
  el.append(tile("Total", stats.total));
  for (const src of ["meta", "google", "web"]) el.append(tile(SOURCE_LABELS[src], stats.bySource[src] || 0));
  el.append(tile("Nuevos", stats.byStatus.nuevo || 0));
  el.append(tile("Ganados", stats.byStatus.ganado || 0));
}

// ---- Listado ----
function renderRows(items) {
  const body = document.getElementById("leads-body");
  body.innerHTML = "";
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Sin resultados</td></tr>';
    return;
  }
  for (const lead of items) {
    const tr = document.createElement("tr");
    tr.dataset.id = lead.id;
    tr.className = "clickable";

    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDate(lead.receivedAt);

    const tdSource = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge badge-${lead.source}`;
    badge.textContent = SOURCE_LABELS[lead.source] || lead.source;
    tdSource.append(badge);

    const tdContact = document.createElement("td");
    const name = document.createElement("div");
    name.className = "contact-name";
    name.textContent = lead.contact.name || "(sin nombre)";
    const sub = document.createElement("div");
    sub.className = "contact-sub";
    sub.textContent = [lead.contact.email, lead.contact.phone].filter(Boolean).join(" · ");
    tdContact.append(name, sub);

    const tdCampaign = document.createElement("td");
    tdCampaign.textContent = lead.site || lead.campaign?.formId || lead.campaign?.id || "—";

    const tdMessage = document.createElement("td");
    tdMessage.className = "truncate";
    tdMessage.textContent = lead.message || "";
    tdMessage.title = lead.message || "";

    const tdStatus = document.createElement("td");
    const select = document.createElement("select");
    select.className = "status-select";
    for (const s of STATUSES) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = STATUS_LABELS[s];
      if (s === lead.status) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener("click", (e) => e.stopPropagation());
    select.addEventListener("change", async (e) => {
      e.stopPropagation();
      await api(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value }) });
      loadStats();
    });
    tdStatus.append(select);

    tr.append(tdDate, tdSource, tdContact, tdCampaign, tdMessage, tdStatus);
    tr.addEventListener("click", () => openDetail(lead.id));
    body.append(tr);
  }
}

async function loadLeads() {
  const body = document.getElementById("leads-body");
  body.innerHTML = '<tr><td colspan="6" class="empty">Cargando…</td></tr>';
  const params = { q: state.q, source: state.source, status: state.status, limit: state.limit, offset: state.offset };
  const { items, total } = await api(`/api/leads?${qs(params)}`);
  state.total = total;
  renderRows(items);
  document.getElementById("page-info").textContent = total === 0 ? "0 resultados" : `${state.offset + 1}–${Math.min(state.offset + state.limit, total)} de ${total}`;
  document.getElementById("prev").disabled = state.offset === 0;
  document.getElementById("next").disabled = state.offset + state.limit >= total;
  document.getElementById("export").href = `/api/leads/export.csv?${qs({ q: state.q, source: state.source, status: state.status })}`;
}

function refreshAll() {
  loadStats().catch(console.error);
  loadLeads().catch((err) => {
    document.getElementById("leads-body").innerHTML = `<tr><td colspan="6" class="empty">Error: ${esc(err.message)}</td></tr>`;
  });
}

// ---- Detalle ----
async function openDetail(id) {
  const panel = document.getElementById("detail");
  const body = document.getElementById("detail-body");
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  body.innerHTML = "<p>Cargando…</p>";

  const lead = await api(`/api/leads/${id}`);

  body.innerHTML = `
    <h2>${esc(lead.contact.name || "(sin nombre)")}</h2>
    <p class="detail-sub">${esc(SOURCE_LABELS[lead.source] || lead.source)} · ${esc(fmtDate(lead.receivedAt))}</p>
    <dl class="detail-fields">
      ${lead.contact.email ? `<dt>Email</dt><dd><a href="mailto:${esc(lead.contact.email)}">${esc(lead.contact.email)}</a></dd>` : ""}
      ${lead.contact.phone ? `<dt>Teléfono</dt><dd><a href="tel:${esc(lead.contact.phone)}">${esc(lead.contact.phone)}</a></dd>` : ""}
      ${lead.contact.company ? `<dt>Empresa</dt><dd>${esc(lead.contact.company)}</dd>` : ""}
      ${lead.site ? `<dt>Sitio</dt><dd>${esc(lead.site)}</dd>` : ""}
      ${lead.message ? `<dt>Mensaje</dt><dd>${esc(lead.message)}</dd>` : ""}
    </dl>
    ${Object.keys(lead.fields || {}).length ? `<h3>Campos adicionales</h3><dl class="detail-fields">${Object.entries(lead.fields).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
    <h3>Estado</h3>
    <select id="detail-status"></select>
    <h3>Notas</h3>
    <ul id="detail-notes" class="notes"></ul>
    <textarea id="detail-note-text" placeholder="Añadir nota…" rows="2"></textarea>
    <button id="detail-note-add" type="button">Añadir nota</button>
    <h3>Secuencia de bienvenida</h3>
    <ul id="detail-sequence" class="sequence"></ul>
    <button id="detail-sequence-cancel" type="button" class="secondary">Cancelar secuencia</button>
    <details class="raw"><summary>Datos originales (raw)</summary><pre></pre></details>
  `;

  const statusSel = document.getElementById("detail-status");
  for (const s of STATUSES) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = STATUS_LABELS[s];
    if (s === lead.status) opt.selected = true;
    statusSel.append(opt);
  }
  statusSel.addEventListener("change", async () => {
    await api(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: statusSel.value }) });
    loadStats();
    loadLeads();
  });

  const notesList = document.getElementById("detail-notes");
  for (const n of lead.notes || []) {
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = fmtDate(n.at);
    li.append(time, document.createTextNode(": " + n.text));
    notesList.append(li);
  }

  document.getElementById("detail-note-add").addEventListener("click", async () => {
    const textarea = document.getElementById("detail-note-text");
    const text = textarea.value.trim();
    if (!text) return;
    await api(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: text }) });
    openDetail(id); // recarga con la nota nueva
  });

  const sequenceList = document.getElementById("detail-sequence");
  const pasos = lead.sequence || [];
  for (const paso of pasos) {
    const li = document.createElement("li");
    li.className = `seq-${paso.status}`;
    const nombre = document.createElement("span");
    nombre.className = "seq-nombre";
    nombre.textContent = SEQUENCE_LABELS[paso.id] || paso.id;
    const estado = document.createElement("span");
    estado.className = "seq-estado";
    const cuando = paso.sentAt ? fmtDate(paso.sentAt) : `programado ${fmtDate(paso.scheduledFor)}`;
    estado.textContent = `${SEQUENCE_STATUS_LABELS[paso.status] || paso.status} · ${cuando}`;
    li.append(nombre, estado);
    sequenceList.append(li);
  }
  const cancelBtn = document.getElementById("detail-sequence-cancel");
  const quedanPendientes = pasos.some((p) => p.status === "pendiente");
  cancelBtn.disabled = !quedanPendientes;
  cancelBtn.addEventListener("click", async () => {
    await api(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancelSequence: true }) });
    openDetail(id);
  });

  // Se rellena con textContent (no interpolado en el template) para evitar problemas de escapado con JSON.
  body.querySelector(".raw pre").textContent = JSON.stringify(lead.raw, null, 2);
}

function closeDetail() {
  const panel = document.getElementById("detail");
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden", "true");
}

// ---- Cableado inicial ----
function initStatusFilter() {
  const sel = document.getElementById("status");
  for (const s of STATUSES) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = STATUS_LABELS[s];
    sel.append(opt);
  }
}

let searchTimer;
document.getElementById("q").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value.trim();
    state.offset = 0;
    loadLeads();
  }, 300);
});
document.getElementById("source").addEventListener("change", (e) => {
  state.source = e.target.value;
  state.offset = 0;
  loadLeads();
});
document.getElementById("status").addEventListener("change", (e) => {
  state.status = e.target.value;
  state.offset = 0;
  loadLeads();
});
document.getElementById("refresh").addEventListener("click", refreshAll);
document.getElementById("prev").addEventListener("click", () => {
  state.offset = Math.max(0, state.offset - state.limit);
  loadLeads();
});
document.getElementById("next").addEventListener("click", () => {
  state.offset += state.limit;
  loadLeads();
});
document.getElementById("detail-close").addEventListener("click", closeDetail);
document.getElementById("detail").addEventListener("click", (e) => {
  if (e.target.id === "detail") closeDetail();
});

initStatusFilter();
refreshAll();

// Enlace directo desde los correos de aviso al equipo: /?lead=<id>
const leadDesdeUrl = new URLSearchParams(location.search).get("lead");
if (leadDesdeUrl) openDetail(leadDesdeUrl);
