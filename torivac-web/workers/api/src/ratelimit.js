// [RATE-LIMIT] Ventana fija por clave en KV (aprox.; KV es eventualmente consistente). Patrón de whynot-sites/forms.
export async function hit(env, bucket, id, { max = 5, windowMs = 10 * 60 * 1000, now = Date.now() } = {}) {
  const key = `rl:${bucket}:${id}`;
  const raw = await env.KV.get(key);
  let r = raw ? JSON.parse(raw) : null;
  if (!r || r.resetAt <= now) r = { count: 0, resetAt: now + windowMs };
  r.count += 1;
  await env.KV.put(key, JSON.stringify(r), { expirationTtl: Math.max(60, Math.ceil((r.resetAt - now) / 1000)) });
  return { allowed: r.count <= max, remaining: Math.max(0, max - r.count), resetAt: r.resetAt };
}
