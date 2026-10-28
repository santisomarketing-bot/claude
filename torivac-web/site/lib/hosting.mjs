// [HOSTING] Archivos de servidor para publicar en un hosting con cPanel o Plesk (Apache o LiteSpeed; en Plesk, con PHP servido por Apache): .htaccess, robots.txt de pruebas y 404 por idioma.
// Se generan solo con --base (producción o dominio de pruebas); la compilación de demostración (doble clic) no los necesita.
//
//   htaccess({ base, staging, aliases, pdfRedirects, apiOrigin, phpApi, langs })  → texto del .htaccess de la raíz
//   langHtaccess(lang, basePath)                                                    → .htaccess de /en /fr /de (solo fija su 404)
//   robotsTxt({ base, staging })                                                    → robots.txt (en pruebas: Disallow total)
// Todo va envuelto en <IfModule> para que un módulo ausente nunca provoque un error 500. Los sondeos de WordPress (wp-login.php, xmlrpc.php, wp-admin…) reciben 410 sin llegar a PHP.

/** Escapa un texto para usarlo literal dentro de una expresión regular de Apache. */
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Expresión de Apache con las rutas que solo existen en un WordPress (y que los escáneres prueban a diario). `bp` es la ruta base del sitio. Se comprueba en scripts/package_cpanel.py. */
export const WP_PROBES = (bp) => `^${rx(bp)}/(?:wp-login\\.php|xmlrpc\\.php|wp-(?:config|cron|signup|activate|mail|trackback|comments-post|links-opml)\\.php|wp-(?:admin|includes|json)(?:/.*)?|wp-content/(?:plugins|themes|mu-plugins|upgrade)(?:/.*)?)$`;

/** ruta base del sitio: «https://x.com/prueba/» → «/prueba» («» si está en la raíz del dominio) */
export const basePathOf = (base) => new URL(base).pathname.replace(/\/+$/, '');

/**
 * Reglas del blog que se escribe en el panel (PHP, api/page.php): las entradas nuevas (/blog/<slug>/ y /en|fr|de/blog/<slug>/), el listado del blog (que mezcla las nuevas con las de la web original), las imágenes
 * subidas (/media/blog/<archivo>) y, en producción, sitemap.xml, llms.txt y llms-full.txt (que añaden las entradas nuevas). Todo con la dirección original, sin parámetros (page.php decide por REQUEST_URI).
 * En el dominio de pruebas no hay sitemap ni llms (no se indexa), así que esas tres no se reescriben.
 */
export const BLOG_RULES = ({ staging = false } = {}) => [
  '# Blog escrito en el panel: PHP pinta las entradas con las plantillas de la web (api/page.php). El listado también pasa por PHP para mezclar las entradas nuevas con las de siempre',
  'RewriteCond %{REQUEST_FILENAME} !-d',
  'RewriteRule ^(?:(?:en|fr|de)/)?blog/[a-z0-9][a-z0-9-]{1,78}[a-z0-9]/?$ api/page.php [L]',
  'RewriteRule ^(?:(?:en|fr|de)/)?blog/?$ api/page.php [L]',
  'RewriteRule ^media/blog/[a-z0-9][a-z0-9-]{0,50}-[0-9a-f]{12}\\.(?:jpg|png|webp)$ api/page.php [L]',
  ...(staging ? [] : ['RewriteRule ^(?:sitemap\\.xml|llms\\.txt|llms-full\\.txt)$ api/page.php [L]']),
];

/** Genera el .htaccess de la raíz: HTTPS, host único, 301 de URLs antiguas, caché, cabeceras de seguridad (CSP), noindex en pruebas y reescritura de /api. */
export function htaccess({ base, staging = false, aliases = new Map(), pdfRedirects = [], apiOrigin = '', phpApi = false, langs = ['en', 'fr', 'de'], scriptHashes = [] }) {
  const u = new URL(base), bp = basePathOf(base), https = u.protocol === 'https:';
  const host = u.hostname, www = host.startsWith('www.'), apex = host.split('.').length === 2;
  const origin = u.origin;
  const connect = ["'self'", apiOrigin && apiOrigin !== origin ? apiOrigin : ''].filter(Boolean).join(' ');
  // script-src SIN 'unsafe-inline': los únicos scripts en línea son constantes y entran por su huella SHA-256 (scriptHashes); todo lo demás son archivos de la propia web. Así una inyección de HTML no puede ejecutar código.
  const csp = `default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'${scriptHashes.map((h) => ` 'sha256-${h}'`).join('')}; connect-src ${connect}; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`;
  const L = [];
  L.push(`# GENERADO por site/build.mjs (no editar a mano: se regenera en cada compilación).`);
  L.push(`# Torivac · ${staging ? 'ENTORNO DE PRUEBAS (noindex)' : 'producción'} · ${origin}${bp}/`);
  L.push(`Options -Indexes`, `DirectoryIndex index.html`, `AddDefaultCharset UTF-8`, '');
  L.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', `RewriteBase ${bp || ''}/`);
  if (https) L.push('# HTTPS siempre (el certificado lo da el hosting: AutoSSL en cPanel, Let\'s Encrypt en Plesk)', 'RewriteCond %{HTTPS} !=on', 'RewriteCond %{HTTP:X-Forwarded-Proto} !=https', `RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`);
  if (www) L.push('# un solo host: con www', `RewriteCond %{HTTP_HOST} ^${rx(host.slice(4))}$ [NC]`, `RewriteRule ^ ${origin}%{REQUEST_URI} [L,R=301]`);
  else if (apex) L.push('# un solo host: sin www', `RewriteCond %{HTTP_HOST} ^www\\.${rx(host)}$ [NC]`, `RewriteRule ^ ${origin}%{REQUEST_URI} [L,R=301]`);
  L.push('# nada de ficheros ni carpetas ocultos (.git, .env…), salvo .well-known (certificados)', 'RewriteRule (^|/)\\.(?!well-known(/|$)) - [F,L]');
  L.push('# /index.html → /', 'RewriteCond %{THE_REQUEST} \\s/+(.*/)?index\\.html[\\s?] [NC]', 'RewriteRule ^(.*/)?index\\.html$ ' + (bp || '') + '/$1 [L,R=301,NE]');
  if (phpApi) L.push('# API de pedidos, contacto, precios y panel (PHP). La cabecera Authorization se pasa a PHP de forma explícita: algunos PHP-FPM/CGI de hosting compartido la descartan',
    'RewriteCond %{HTTP:Authorization} .', 'RewriteRule ^ - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]', 'RewriteRule ^api/(?!(?:index|page)\\.php)(.*)$ api/index.php [QSA,L]');
  if (phpApi) L.push(...BLOG_RULES({ staging }));
  L.push('</IfModule>', '');
  if (aliases.size || pdfRedirects.length) {
    L.push('# URLs antiguas → URL actual (duplicados de la web original fusionados; PDF que antes vivían en /wp-content/uploads)', '<IfModule mod_alias.c>');
    for (const [from, to] of aliases) L.push(`RedirectMatch 301 ^${rx(bp + from.replace(/\/$/, ''))}/?$ ${bp}${to}`);
    for (const [name, local] of pdfRedirects) L.push(`RedirectMatch 301 ^${rx(bp)}/wp-content/uploads/.+/${rx(name)}$ ${bp}/assets/pdf/${local}`);
    L.push('</IfModule>', '');
  }
  // Esta web NO es WordPress. Los escáneres que buscan WordPress (wp-login, xmlrpc, wp-admin, plugins…) reciben «410 Gone» al instante: no llegan a PHP, no llenan el registro de errores y se dan por vencidos antes.
  // Las fotos y PDF antiguos de /wp-content/uploads siguen redirigiendo (arriba); solo se cierran el acceso, la administración, el API y los plugins y temas.
  L.push('# Sondeos de WordPress (esta web no lo usa): 410 sin gastar PHP', '<IfModule mod_alias.c>', `RedirectMatch 410 ${WP_PROBES(bp)}`, '</IfModule>', '');
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
  if (staging) L.push('# ENTORNO DE PRUEBAS · para cerrarlo a tu IP (no uses «Privacidad de directorios» de cPanel ni «Password-Protected Directories» de Plesk: la contraseña choca con la cabecera Authorization del panel), descomenta y pon tu IP:',
    '# <IfModule mod_authz_core.c>', '#   Require ip 203.0.113.7', '# </IfModule>', '');
  L.push('# nada de ficheros ocultos ni de trabajo', '<IfModule mod_authz_core.c>', '  <FilesMatch "^\\.(?!well-known)|\\.(md|map|sh|py|log)$">', '    Require all denied', '  </FilesMatch>', '</IfModule>', '');
  void langs;
  return L.join('\n');
}

/** .htaccess de /en, /fr, /de: solo cambia la página 404 para que se muestre en el idioma de la sección */
export const langHtaccess = (lang, bp) => `# GENERADO por site/build.mjs\nErrorDocument 404 ${bp}/${lang}/404.html\n`;

/** Genera robots.txt: en pruebas prohíbe todo; en producción permite el sitio, cierra /admin/ y /api/ y enlaza el sitemap. */
export const robotsTxt = ({ base, staging }) => staging
  ? `# ENTORNO DE PRUEBAS: no indexar\nUser-agent: *\nDisallow: /\n`
  : `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${base.replace(/\/$/, '')}/sitemap.xml\n`;
