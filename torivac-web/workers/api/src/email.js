// [EMAIL] Envío de correo por Resend o Brevo (HTTP, sin SDK) según EMAIL_PROVIDER (resend por defecto · brevo · none), con el MOTIVO veraz de cada intento y sin secretos en los errores.
// Resultado de sendMail: { ok, id?, reason:'sent'|'off'|'failed'|'skipped', error?, driver, status?, skipped? }. off = sin controlador (EMAIL_PROVIDER=none); skipped = faltan credenciales, remitente o destinatarios;
// failed = el proveedor respondió error o no respondió. `error` es un texto CORTO (≤ 160) y sin secretos, solo para gestores. Cada envío anota su resultado en mail:last (ver mailstate.js).
// Correos que se componen aquí: AVISO de pedido al equipo (con los datos del cliente y el PDF que fabricó su navegador), COPIA al cliente (solo texto fijo y datos valorados por el servidor),
// mensaje de CONTACTO para el equipo y PRUEBA del panel.
import { esc } from './util.js';
import { oneLine, isEmail } from './validate.js';
import { scrub, recordMail, readLast } from './mailstate.js';

// ───────────────────────────────────────── [CONTROLADORES] qué proveedor se usa, con qué ajustes y qué falta
const DEFAULT_FROM = 'Torivac Web <pedidos@torivac.com>';
const PROVIDERS = ['resend', 'brevo', 'none'];
const KEYS = { resend: 'RESEND_API_KEY', brevo: 'BREVO_API_KEY' };
const NAMES = { resend: 'Resend', brevo: 'Brevo' };
const TIMEOUT_MS = 15_000;

/** True si EMAIL_PROVIDER trae un valor que no es resend, brevo ni none (se trata como «none»: falla cerrado). Vacío o ausente = resend. */
const providerUnknown = (env) => { const v = env.EMAIL_PROVIDER == null ? '' : String(env.EMAIL_PROVIDER).trim().toLowerCase(); return v !== '' && !PROVIDERS.includes(v); };
/** Controlador de correo activo según EMAIL_PROVIDER: «resend» (por defecto), «brevo» o «none»; un valor desconocido falla cerrado y cuenta como «none». */
export function mailDriver(env) {
  const v = env.EMAIL_PROVIDER == null ? '' : String(env.EMAIL_PROVIDER).trim().toLowerCase();
  if (v === '') return 'resend';
  return PROVIDERS.includes(v) ? v : 'none';
}
/**
 * Remitente de ORDER_FROM («Nombre <correo@dominio>» o solo el correo; si falta, Torivac Web <pedidos@torivac.com>) → { ok:true, name, email, from } con `from` normalizado, o { ok:false }
 * si el correo no es válido, el nombre trae < > " \ o caracteres de control (inyección de cabeceras) o es larguísimo. Con Brevo el remitente debe estar verificado en su cuenta.
 */
export function parseSender(env) {
  const raw = env.ORDER_FROM == null || String(env.ORDER_FROM).trim() === '' ? DEFAULT_FROM : String(env.ORDER_FROM).trim();
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(raw)) return { ok: false };
  const m = /^(.*?)\s*<([^<>]+)>$/.exec(raw), email = (m ? m[2] : raw).trim(), name = m ? m[1].trim().replace(/^"(.*)"$/, '$1').trim() : '';
  if (!isEmail(email) || /["<>\\]/.test(name) || name.length > 80) return { ok: false };
  return { ok: true, name, email, from: name ? `${/[,;:@()[\]]/.test(name) ? `"${name}"` : name} <${email}>` : email };
}
/** Destinatarios del equipo: los correos válidos de ORDER_TO (separados por comas); los que no lo son se ignoran (y mailProblems avisa de ORDER_TO). */
export const teamRecipients = (env) => String(env.ORDER_TO ?? '').split(',').map((s) => s.trim()).filter((s) => isEmail(s));
/** Por qué NO se puede enviar ahora → { reason:'off'|'skipped', error }, o null si el controlador está listo (clave del proveedor y remitente válidos). */
function blocker(env, driver) {
  if (providerUnknown(env)) return { reason: 'off', error: 'EMAIL_PROVIDER no válido (usa resend, brevo o none)' };
  if (driver === 'none') return { reason: 'off', error: 'Sin controlador de correo (EMAIL_PROVIDER=none)' };
  if (!String(env[KEYS[driver]] ?? '').trim()) return { reason: 'skipped', error: `Falta ${KEYS[driver]}` };
  if (!parseSender(env).ok) return { reason: 'skipped', error: 'ORDER_FROM no válido (usa «Nombre <correo@dominio>»)' };
  return null;
}
/** True si el controlador activo puede enviar ahora (no es «none» y tiene su clave y un remitente válido). */
export const mailReady = (env) => blocker(env, mailDriver(env)) === null;
/** Ajustes de correo MAL puestos (solo nombres, nunca valores): EMAIL_PROVIDER desconocido u ORDER_FROM que no es «Nombre <correo@dominio>». Los avisa /api/health en config.problems. */
export function mailSettingProblems(env) {
  const p = [];
  if (providerUnknown(env)) p.push('EMAIL_PROVIDER');
  if (!parseSender(env).ok) p.push('ORDER_FROM');
  return p;
}
/** Ajustes que impiden o estorban el envío (solo nombres, nunca valores): los mal puestos, la clave del controlador activo (RESEND_API_KEY o BREVO_API_KEY) y los destinatarios de ORDER_TO. */
export function mailProblems(env) {
  const p = [], d = mailDriver(env), bad = mailSettingProblems(env);
  if (bad.includes('EMAIL_PROVIDER')) p.push('EMAIL_PROVIDER');
  if (d !== 'none' && !String(env[KEYS[d]] ?? '').trim()) p.push(KEYS[d]);
  if (bad.includes('ORDER_FROM')) p.push('ORDER_FROM');
  const to = String(env.ORDER_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!to.length || !to.every((s) => isEmail(s))) p.push('ORDER_TO');
  return p;
}
/** Estado del correo para el panel y la salud → { driver, configured, problems (nombres de ajustes), last (último intento o null) }; nunca lleva valores secretos. */
export async function mailStatus(env) {
  const driver = mailDriver(env), problems = mailProblems(env);
  return { driver, configured: driver !== 'none' && problems.length === 0, problems, last: await readLast(env) };
}

// ───────────────────────────────────────── [ENVÍO] sendMail → Resend o Brevo
/** Texto corto y sin secretos del fallo de un proveedor: «Brevo 401: mensaje» (mensaje ≤ 120 caracteres) o, si no dio mensaje, «Brevo respondió 401». */
async function providerError(env, name, res) {
  let msg = '';
  try { const j = JSON.parse((await res.text()).slice(0, 4000)), v = j && (j.message ?? (j.error && j.error.message) ?? j.error ?? j.name); msg = typeof v === 'string' ? scrub(env, v, 120) : ''; } catch { /* cuerpo vacío o que no es JSON */ }
  return scrub(env, msg ? `${name} ${res.status}: ${msg}` : `${name} respondió ${res.status}`);
}
/** POST JSON a la API de un proveedor y traduce la respuesta → { ok:true, reason:'sent', id? } o { ok:false, reason:'failed', status?, error }. Cualquier 2xx cuenta como aceptado; sin respuesta en 15 s se corta. */
async function callProvider(env, name, url, headers, body, idOf, fetchImpl) {
  let res;
  try { res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) }); }
  catch (e) { return { ok: false, reason: 'failed', error: scrub(env, `${name}: ${e && e.name === 'TimeoutError' ? 'sin respuesta en 15 s' : `no se pudo conectar (${(e && e.message) || e})`}`) }; }
  if (!res.ok) return { ok: false, reason: 'failed', status: res.status, error: await providerError(env, name, res) };
  let id; try { id = idOf(await res.json()); } catch { /* 2xx sin JSON: aceptado igualmente */ }
  return { ok: true, reason: 'sent', ...(id ? { id: String(id) } : {}) };
}
/** Lista de direcciones: una lista tal cual, un texto suelto como lista de uno, nada como lista vacía. */
const toList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
/** Prepara y envía por el controlador activo, sin anotar nada → { ok, id?, reason, skipped?, status?, error? }. Sin controlador, credenciales, remitente o destinatarios válidos no llama a ningún proveedor. */
async function deliver(env, driver, m, fetchImpl) {
  const block = blocker(env, driver);
  if (block) return { ok: false, skipped: true, reason: block.reason, error: block.error };
  const to = toList(m.to), cc = toList(m.cc);
  if (!to.length) return { ok: false, skipped: true, reason: 'skipped', error: 'Sin destinatarios (revisa ORDER_TO)' };
  if (![...to, ...cc].every((a) => typeof a === 'string' && isEmail(a))) return { ok: false, skipped: true, reason: 'skipped', error: 'Destinatario no válido' };      // nunca «a@b.co,otro»: una coma colaría a un tercero
  const sender = parseSender(env), key = String(env[KEYS[driver]]).trim(), subject = oneLine(m.subject, 200);
  const replyTo = typeof m.replyTo === 'string' && isEmail(m.replyTo) ? m.replyTo : '';                                           // un Reply-To no válido se omite; el correo sale igual
  const files = (Array.isArray(m.attachments) ? m.attachments : []).filter((a) => a && typeof a.filename === 'string' && typeof a.content === 'string');
  if (driver === 'brevo') {
    const body = { sender: { ...(sender.name ? { name: sender.name } : {}), email: sender.email }, to: to.map((email) => ({ email })), subject, htmlContent: m.html, textContent: m.text };
    if (cc.length) body.cc = cc.map((email) => ({ email })); if (replyTo) body.replyTo = { email: replyTo }; if (files.length) body.attachment = files.map((a) => ({ name: a.filename, content: a.content }));
    return await callProvider(env, NAMES.brevo, 'https://api.brevo.com/v3/smtp/email', { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' }, body, (j) => j.messageId, fetchImpl);
  }
  const body = { from: sender.from, to, subject, html: m.html, text: m.text };
  if (cc.length) body.cc = cc; if (replyTo) body.reply_to = replyTo; if (files.length) body.attachments = files;
  return await callProvider(env, NAMES.resend, 'https://api.resend.com/emails', { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body, (j) => j.id, fetchImpl);
}
/**
 * Envía un correo por el controlador activo → { ok, id?, reason, error?, driver, status?, skipped? } y anota el intento en mail:last (`kind`: 'order' · 'contact' · 'test'). El asunto va siempre en una línea;
 * un Reply-To no válido se omite. Los campos que ya usaban los pedidos (ok, id, skipped, status, error) se conservan. Nunca lanza por un fallo del proveedor ni de KV.
 */
export async function sendMail(env, m, fetchImpl = fetch, { kind = 'order', now = Date.now() } = {}) {
  const driver = mailDriver(env);
  const r = { ...(await deliver(env, driver, m, fetchImpl)), driver };
  await recordMail(env, kind, r, now);
  return r;
}

/** Importe en euros con el formato del idioma (es, en, fr, de); «—» si no hay importe. */
const money = (n, lang = 'es') => (n == null ? '—' : new Intl.NumberFormat({ es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' }[lang] || 'es-ES', { style: 'currency', currency: 'EUR' }).format(n));
/** Aviso del PDF para el equipo: el PDF lo genera el navegador del cliente y puede no coincidir con lo que valoró el servidor. */
export const PDF_NOTE = 'El PDF adjunto lo ha generado el navegador del cliente: el importe que vale es el calculado por el servidor (arriba)';
/** Correo de aviso de un pedido para el equipo → { html, text } con cliente, líneas, total, marca de precios de demostración y, si va PDF adjunto, el aviso de que el importe válido es el del servidor. */
export function orderMail({ number, customer, priced, lang, demo, hasPdf = false }, items) {
  const rows = priced.lines.map((l) => `<tr><td style="font-family:monospace">${esc(l.ref)}</td><td>${esc(items[l.ref]?.n || '')}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${money(l.unit, lang)}</td><td style="text-align:right"><b>${money(l.total, lang)}</b></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Nuevo pedido ${esc(number)}${demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''}</h2>
<p><b>${esc(customer.name)}</b> ${customer.company ? '· ' + esc(customer.company) : ''}<br>${esc(customer.email)}${customer.phone ? ' · ' + esc(customer.phone) : ''}</p>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>Ref.</th><th>Artículo</th><th>Cant.</th><th>Ud.</th><th>Importe</th></tr>${rows}</table>
<p style="text-align:right;font-size:18px">Total (sin IVA): <b>${money(priced.total, lang)}</b>${priced.unpriced ? `<br><small>${priced.unpriced} línea(s) «A consultar» no incluidas en el total</small>` : ''}</p>
${customer.notes ? `<p><b>Notas:</b> ${esc(customer.notes).replace(/\n/g, '<br>')}</p>` : ''}<p style="color:#777;font-size:12px">Idioma del cliente: ${esc(lang)}${hasPdf ? ` · El PDF del presupuesto va adjunto.</p><p style="color:#9c520f;font-size:12px"><b>${esc(PDF_NOTE)}.</b>` : ''}</p></div>`;
  const text = [`Nuevo pedido ${number}${demo ? ' (PRECIOS DE DEMOSTRACIÓN)' : ''}`, `${customer.name} <${customer.email}> ${customer.phone || ''}`, '', ...priced.lines.map((l) => `${l.ref}\t${items[l.ref]?.n || ''}\tx${l.qty}\t${money(l.total, lang)}`), '', `Total (sin IVA): ${money(priced.total, lang)}`, customer.notes ? `\nNotas: ${customer.notes}` : '', hasPdf ? `\n${PDF_NOTE}.` : ''].join('\n');
  return { html, text };
}

// ───────────────────────────────────────── [COPIA] correo al cliente: SOLO texto fijo y datos del servidor
/** Textos fijos de la copia en cada idioma del pedido (es, en, fr, de). Nada de lo que escribió el visitante entra aquí. */
const COPY_TEXT = {
  es: { title: 'Copia de tu presupuesto', intro: 'Hemos recibido tu solicitud de presupuesto. Esta es la copia de lo que has pedido, con los importes calculados por Torivac.', ref: 'Ref.', item: 'Artículo', qty: 'Cant.', unit: 'Ud.', amount: 'Importe', total: 'Total (sin IVA)', ask: 'A consultar', unpriced: (n) => `${n} línea(s) «A consultar» no incluidas en el total`, ignore: 'Si no has pedido tú este presupuesto, ignora este mensaje.', demo: '(PRECIOS DE DEMOSTRACIÓN)' },
  en: { title: 'Copy of your quote', intro: 'We have received your quote request. This is a copy of what you asked for, with the amounts calculated by Torivac.', ref: 'Ref.', item: 'Item', qty: 'Qty', unit: 'Unit', amount: 'Amount', total: 'Total (excl. VAT)', ask: 'On request', unpriced: (n) => `${n} line(s) marked “On request” are not included in the total`, ignore: 'If you did not request this quote, please ignore this message.', demo: '(DEMONSTRATION PRICES)' },
  fr: { title: 'Copie de votre devis', intro: 'Nous avons bien reçu votre demande de devis. Voici une copie de ce que vous avez demandé, avec les montants calculés par Torivac.', ref: 'Réf.', item: 'Article', qty: 'Qté', unit: 'Prix unit.', amount: 'Montant', total: 'Total (hors TVA)', ask: 'Sur demande', unpriced: (n) => `${n} ligne(s) « Sur demande » non incluse(s) dans le total`, ignore: 'Si vous n’avez pas demandé ce devis, ignorez ce message.', demo: '(PRIX DE DÉMONSTRATION)' },
  de: { title: 'Kopie Ihres Angebots', intro: 'Wir haben Ihre Angebotsanfrage erhalten. Dies ist eine Kopie Ihrer Anfrage mit den von Torivac berechneten Beträgen.', ref: 'Ref.', item: 'Artikel', qty: 'Menge', unit: 'Einzelpreis', amount: 'Betrag', total: 'Gesamt (ohne MwSt.)', ask: 'Auf Anfrage', unpriced: (n) => `${n} Position(en) „Auf Anfrage“ sind in der Summe nicht enthalten`, ignore: 'Wenn Sie dieses Angebot nicht angefordert haben, ignorieren Sie diese Nachricht bitte.', demo: '(DEMO-PREISE)' },
};
/** Asunto fijo de la copia al cliente (el mismo en todos los idiomas). */
export const copySubject = (number) => `Torivac · copia de tu presupuesto ${number}`;
/**
 * Copia del pedido para el CLIENTE → { subject, html, text }. Solo contenido generado por el servidor: texto fijo en el idioma del pedido, número, líneas (ref, nombre del catálogo, cantidad e
 * importes valorados por el servidor), total y la línea «si no lo pediste tú, ignora este mensaje». NADA escrito por el visitante (ni nombre, ni empresa, ni teléfono, ni notas) y sin adjuntos.
 */
export function customerCopyMail({ number, priced, lang, demo }, items) {
  const t = COPY_TEXT[lang] || COPY_TEXT.es, am = (n) => (n == null ? t.ask : money(n, lang));
  const rows = priced.lines.map((l) => `<tr><td style="font-family:monospace">${esc(l.ref)}</td><td>${esc(items[l.ref]?.n || '')}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${am(l.unit)}</td><td style="text-align:right"><b>${am(l.total)}</b></td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">${esc(t.title)} ${esc(number)}${demo ? ` ${esc(t.demo)}` : ''}</h2><p>${esc(t.intro)}</p>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;width:100%"><tr style="background:#100404;color:#fff"><th>${esc(t.ref)}</th><th>${esc(t.item)}</th><th>${esc(t.qty)}</th><th>${esc(t.unit)}</th><th>${esc(t.amount)}</th></tr>${rows}</table>
<p style="text-align:right;font-size:18px">${esc(t.total)}: <b>${money(priced.total, lang)}</b>${priced.unpriced ? `<br><small>${esc(t.unpriced(priced.unpriced))}</small>` : ''}</p>
<p style="color:#777;font-size:12px">${esc(t.ignore)}</p></div>`;
  const text = [`${t.title} ${number}${demo ? ` ${t.demo}` : ''}`, '', t.intro, '', ...priced.lines.map((l) => `${l.ref}\t${items[l.ref]?.n || ''}\tx${l.qty}\t${am(l.total)}`), '', `${t.total}: ${money(priced.total, lang)}`, priced.unpriced ? t.unpriced(priced.unpriced) : '', '', t.ignore].join('\n');
  return { subject: copySubject(number), html, text };
}

// ───────────────────────────────────────── [CONTACTO] mensaje del formulario → equipo, y prueba del panel
/**
 * Correo de un mensaje de contacto PARA EL EQUIPO → { subject, html, text }. Asunto «Contacto web · <nombre>» en una línea; nombre, correo, idioma, id del mensaje y texto del visitante van SIEMPRE
 * escapados en el HTML (el visitante puede escribir <script>…); el Reply-To lo pone quien envía (sendMail). Es dato no fiable: aquí solo se muestra.
 */
export function contactMail({ id, name, email, lang, message }) {
  const n = oneLine(name, 120), e = oneLine(email, 254), l = oneLine(lang, 8), i = oneLine(id, 40);
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px"><h2 style="margin:0;color:#9c520f">Mensaje de contacto de la web</h2>
<p><b>${esc(n)}</b> &lt;${esc(e)}&gt;<br><span style="color:#777;font-size:12px">Idioma: ${esc(l)} · Mensaje ${esc(i)}</span></p>
<p>${esc(message).replace(/\n/g, '<br>')}</p>
<p style="color:#777;font-size:12px">Responde a este correo para escribir a ${esc(n)}. El mensaje queda guardado en el panel (Mensajes) con el id ${esc(i)}.</p></div>`;
  const text = ['Mensaje de contacto de la web', `Nombre: ${n}`, `Correo: ${e}`, `Idioma: ${l}`, `Mensaje: ${i}`, '', String(message ?? ''), '', `Responde a este correo para escribir a ${n}. Queda guardado en el panel (Mensajes) con el id ${i}.`].join('\n');
  return { subject: `Contacto web · ${n}`, html, text };
}
/** Texto fijo del correo de prueba del panel. */
export const TEST_LINE = 'Si lees esto, el envío de correo de la web funciona.';
/** Correo de PRUEBA del panel → { subject, html, text }: asunto «Torivac · prueba de correo», texto fijo y, como datos, el controlador y la hora (ISO). */
export function testMail({ driver, at }) {
  const d = oneLine(driver, 20), t = oneLine(at, 40);
  return { subject: 'Torivac · prueba de correo', html: `<div style="font-family:Arial,sans-serif;max-width:720px"><p>${esc(TEST_LINE)}</p><p style="color:#777;font-size:12px">Controlador: ${esc(d)} · Hora: ${esc(t)}</p></div>`, text: `${TEST_LINE}\n\nControlador: ${d}\nHora: ${t}` };
}
