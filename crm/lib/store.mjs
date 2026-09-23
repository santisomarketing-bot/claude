// ============================================================================
//  store.mjs
//  --------------------------------------------------------------------------
//  Almacén de leads en un único fichero JSON (sin base de datos externa).
//  Pensado para el volumen de una agencia (decenas/cientos de leads al mes),
//  no para alto tráfico. Escrituras serializadas con una cola en memoria para
//  evitar carreras entre webhooks que llegan casi a la vez.
// ============================================================================

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class LeadStore {
  constructor(filePath) {
    this.filePath = filePath;
    this._writeQueue = Promise.resolve();
    this._leads = this._load();
  }

  _load() {
    if (!existsSync(this.filePath)) return [];
    const raw = readFileSync(this.filePath, "utf8").trim();
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      throw new Error(`No se pudo leer ${this.filePath}: ${err.message}`);
    }
  }

  _persist() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this._leads, null, 2) + "\n", "utf8");
  }

  // Serializa todas las escrituras (add/update/delete) en orden de llegada.
  _enqueue(fn) {
    this._writeQueue = this._writeQueue.then(fn, fn);
    return this._writeQueue;
  }

  // Evita duplicados cuando la misma fuente reintenta el mismo evento
  // (p. ej. Meta reenvía si no respondes 200 a tiempo).
  _findDuplicate(source, sourceId) {
    if (!sourceId) return null;
    return this._leads.find((l) => l.source === source && l.sourceId === sourceId) || null;
  }

  async addLead(lead) {
    return this._enqueue(() => {
      const dup = this._findDuplicate(lead.source, lead.sourceId);
      if (dup) return { lead: dup, created: false };
      this._leads.unshift(lead);
      this._persist();
      return { lead, created: true };
    });
  }

  async getLead(id) {
    return this._leads.find((l) => l.id === id) || null;
  }

  async updateLead(id, { status, note } = {}) {
    return this._enqueue(() => {
      const lead = this._leads.find((l) => l.id === id);
      if (!lead) return null;
      if (status) lead.status = status;
      if (note) lead.notes.push({ at: new Date().toISOString(), text: String(note) });
      lead.updatedAt = new Date().toISOString();
      this._persist();
      return lead;
    });
  }

  async deleteLead(id) {
    return this._enqueue(() => {
      const idx = this._leads.findIndex((l) => l.id === id);
      if (idx === -1) return false;
      this._leads.splice(idx, 1);
      this._persist();
      return true;
    });
  }

  async listLeads({ source, status, q, from, to, limit = 50, offset = 0 } = {}) {
    let items = this._leads;
    if (source) items = items.filter((l) => l.source === source);
    if (status) items = items.filter((l) => l.status === status);
    if (from) items = items.filter((l) => l.receivedAt >= from);
    if (to) items = items.filter((l) => l.receivedAt <= to);
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((l) => {
        const hay = [l.contact.name, l.contact.email, l.contact.phone, l.contact.company, l.message, l.campaign?.name, l.site]
          .filter(Boolean)
          .join(" \n ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    const total = items.length;
    const page = items.slice(offset, offset + limit);
    return { items: page, total };
  }

  async stats() {
    const bySource = {};
    const byStatus = {};
    for (const l of this._leads) {
      bySource[l.source] = (bySource[l.source] || 0) + 1;
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    }
    return { total: this._leads.length, bySource, byStatus };
  }
}
