// [VALIDATE] Validación estricta de pedidos y mensajes de contacto. Todo lo que llega del navegador es no fiable.
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/;
const LANGS = ['es', 'en', 'fr', 'de'];
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

export function parseOrder(raw, items) {
  if (!raw || typeof raw !== 'object') return { error: 'Petición no válida' };
  if (raw.hp) return { error: 'Solicitud no válida' };                                // honeypot
  const c = raw.customer || {};
  const customer = { name: clean(c.name, 120), company: clean(c.company, 120), email: clean(c.email, 254).toLowerCase(), phone: clean(c.phone, 40), notes: clean(c.notes, 2000) };
  if (customer.name.length < 2) return { error: 'Falta el nombre' };
  if (!EMAIL.test(customer.email)) return { error: 'Correo no válido' };
  if (c.privacy !== true) return { error: 'Debes aceptar la política de privacidad' };
  if (!Array.isArray(raw.lines) || !raw.lines.length) return { error: 'El presupuesto está vacío' };
  if (raw.lines.length > 200) return { error: 'Demasiadas líneas (máx. 200)' };
  const seen = new Map();
  for (const l of raw.lines) {
    const ref = clean(l && l.ref, 60); const qty = Number(l && l.qty);
    if (!ref || !items[ref]) return { error: `Referencia desconocida: ${ref || '(vacía)'}` };
    if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) return { error: `Cantidad no válida para ${ref}` };
    seen.set(ref, (seen.get(ref) || 0) + qty);
  }
  const lang = LANGS.includes(raw.lang) ? raw.lang : 'es';
  let pdf = null;
  if (raw.pdf) { if (typeof raw.pdf !== 'string' || raw.pdf.length > 5_500_000 || !raw.pdf.startsWith('JVBER')) return { error: 'PDF adjunto no válido' }; pdf = raw.pdf; }
  return { order: { customer, lines: [...seen].map(([ref, qty]) => ({ ref, qty })), lang, pdf, copyToCustomer: raw.copy !== false, turnstile: raw.turnstileToken || '' } };
}
export function parseContact(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Petición no válida' };
  if (raw.hp) return { error: 'Solicitud no válida' };
  const m = { name: clean(raw.name, 120), email: clean(raw.email, 254).toLowerCase(), message: clean(raw.message, 5000), lang: LANGS.includes(raw.lang) ? raw.lang : 'es', turnstile: raw.turnstileToken || '' };
  if (m.name.length < 2) return { error: 'Falta el nombre' };
  if (!EMAIL.test(m.email)) return { error: 'Correo no válido' };
  if (m.message.length < 3) return { error: 'Falta el mensaje' };
  if (raw.privacy !== true) return { error: 'Debes aceptar la política de privacidad' };
  return { contact: m };
}
