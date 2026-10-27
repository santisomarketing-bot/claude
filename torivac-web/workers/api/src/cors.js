// [CORS] Solo los orígenes de ALLOWED_ORIGINS (y los *.pages.dev si ALLOW_PAGES_DEV=1) pueden llamar al API desde un navegador.
export function isOriginAllowed(origin, env) {
  if (!origin) return true;                                 // llamadas servidor-a-servidor / curl
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  if (env.ALLOW_PAGES_DEV === '1' && /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.pages\.dev$/.test(origin)) return true;
  return false;
}
export const corsHeaders = (origin) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' });
