// [TURNSTILE] Verificación opcional: si TURNSTILE_SECRET no está definido el control se omite (entorno de pruebas); si lo está, falla cerrado.
export async function verifyTurnstile(env, token, ip, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }); if (ip) body.set('remoteip', ip);
  try { const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body }); return r.ok && (await r.json()).success === true; } catch { return false; }
}
