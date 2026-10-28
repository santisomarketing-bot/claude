// [HOSTING] Archivos de servidor para publicar en un hosting con cPanel (Apache o LiteSpeed): .htaccess, robots.txt de pruebas y 404 por idioma.
// Se generan solo con --base (producción o dominio de pruebas); la compilación de demostración (doble clic) no los necesita.
//
//   htaccess({ base, staging, aliases, pdfRedirects, apiOrigin, phpApi, langs })  → texto del .htaccess de la raíz
//   langHtaccess(lang, basePath)                                                    → .htaccess de /en /fr /de (solo fija su 404)
//   robotsTxt({ base, staging })                                                    → robots.txt (en pruebas: Disallow total)
// Todo va envuelto en <IfModule> para que un módulo ausente nunca provoque un error 500.

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ruta base del sitio: «https://x.com/prueba/» → «/prueba» («» si está en la raíz del dominio) */
export const basePathOf = (base) => new URL(base).pathname.replace(/\/+$/, '');

export function htaccess({ base, staging = false, aliases = new Map(), pdfRedirects = [], apiOrigin = '', phpApi = false, langs = ['en', 'fr', 'de'] }) {
  const u = new URL(base), bp = basePathOf(base), https = u.protocol === 'https:';
  const host = u.hostname, www = host.startsWith('www.'), apex = host.split('.').length === 2;
  const origin = u.origin;
  const connect = ["'self'", apiOrigin && apiOrigin !== origin ? apiOrigin : ''].filter(Boolean).join(' ');
  const csp = `default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src ${connect}; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`;
  const L = [];
  L.push(`# GENERADO por site/build.mjs (no editar a mano: se regenera en cada compilación).`);
  L.push(`# Torivac · ${staging ? 'ENTORNO DE PRUEBAS (noindex)' : 'producción'} · ${origin}${bp}/`);
  L.push(`Options -Indexes`, `DirectoryIndex index.html`, `AddDefaultCharset UTF-8`, '');
  L.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', `RewriteBase ${bp || ''}/`);
  if (https) L.push('# HTTPS siempre (el certificado lo da AutoSSL de cPanel)', 'RewriteCond %{HTTPS} !=on', 'RewriteCond %{HTTP:X-Forwarded-Proto} !=https', `RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`);
  if (www) L.push('# un solo host: con www', `RewriteCond %{HTTP_HOST} ^${rx(host.slice(4))}$ [NC]`, `RewriteRule ^ ${origin}%{REQUEST_URI} [L,R=301]`);
  else if (apex) L.push('# un solo host: sin www', `RewriteCond %{HTTP_HOST} ^www\\.${rx(host)}$ [NC]`, `RewriteRule ^ ${origin}%{REQUEST_URI} [L,R=301]`);
  L.push('# /index.html → /', 'RewriteCond %{THE_REQUEST} \\s/+(.*/)?index\\.html[\\s?] [NC]', 'RewriteRule ^(.*/)?index\\.html$ ' + (bp || '') + '/$1 [L,R=301,NE]');
  if (phpApi) L.push('# API de pedidos, contacto, precios y panel (PHP)', 'RewriteRule ^api/(?!index\\.php)(.*)$ api/index.php [QSA,L]');
  L.push('</IfModule>', '');
  if (aliases.size || pdfRedirects.length) {
    L.push('# URLs antiguas → URL actual (duplicados de la web original fusionados; PDF que antes vivían en /wp-content/uploads)', '<IfModule mod_alias.c>');
    for (const [from, to] of aliases) L.push(`RedirectMatch 301 ^${rx(bp + from.replace(/\/$/, ''))}/?$ ${bp}${to}`);
    for (const [name, local] of pdfRedirects) L.push(`RedirectMatch 301 ^${rx(bp)}/wp-content/uploads/.+/${rx(name)}$ ${bp}/assets/pdf/${local}`);
    L.push('</IfModule>', '');
  }
  L.push(`ErrorDocument 404 ${bp}/404.html`, '');
  L.push('<IfModule mod_deflate.c>', '  AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/xml application/javascript text/javascript application/json image/svg+xml', '</IfModule>', '');
  L.push('<IfModule mod_expires.c>', '  ExpiresActive On',
    '  ExpiresByType font/woff2 "access plus 1 year"', '  ExpiresByType image/webp "access plus 1 year"', '  ExpiresByType image/png "access plus 1 year"', '  ExpiresByType image/jpeg "access plus 1 year"', '  ExpiresByType image/svg+xml "access plus 1 year"',
    '  ExpiresByType text/css "access plus 1 week"', '  ExpiresByType application/javascript "access plus 1 week"', '  ExpiresByType text/javascript "access plus 1 week"', '  ExpiresByType application/pdf "access plus 1 month"', '  ExpiresByType text/html "access plus 0 seconds"', '</IfModule>', '');
  L.push('<IfModule mod_headers.c>',
    '  Header always set X-Content-Type-Options "nosniff"', '  Header always set X-Frame-Options "SAMEORIGIN"', '  Header always set Referrer-Policy "strict-origin-when-cross-origin"', '  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"',
    `  Header always set Content-Security-Policy "${csp}"`,
    ...(https ? [`  Header always set Strict-Transport-Security "max-age=${staging ? 300 : 31536000}"`] : []),
    ...(staging ? ['  Header always set X-Robots-Tag "noindex, nofollow, noarchive"'] : []),
    '  <FilesMatch "\\.(html)$">', '    Header set Cache-Control "no-cache"', '  </FilesMatch>', '</IfModule>', '');
  L.push('# nada de ficheros ocultos ni de trabajo', '<IfModule mod_authz_core.c>', '  <FilesMatch "^\\.(?!well-known)|\\.(md|map|sh|py|log)$">', '    Require all denied', '  </FilesMatch>', '</IfModule>', '');
  void langs;
  return L.join('\n');
}

/** .htaccess de /en, /fr, /de: solo cambia la página 404 para que se muestre en el idioma de la sección */
export const langHtaccess = (lang, bp) => `# GENERADO por site/build.mjs\nErrorDocument 404 ${bp}/${lang}/404.html\n`;

export const robotsTxt = ({ base, staging }) => staging
  ? `# ENTORNO DE PRUEBAS: no indexar\nUser-agent: *\nDisallow: /\n`
  : `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${base.replace(/\/$/, '')}/sitemap.xml\n`;
