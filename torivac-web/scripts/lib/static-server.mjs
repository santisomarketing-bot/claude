// [STATIC-SERVER] Servidor estático mínimo para las pruebas de navegador (sirve dist/ por http como en producción).
//   const { server, base } = await serve(DIST);   …   server.close();
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.csv': 'text/csv', '.xlsx': 'application/octet-stream' };

/** Sirve root por http en un puerto libre de 127.0.0.1 (con gzip opcional del texto); devuelve { server, base }. */
export async function serve(root, { gzip = false } = {}) {
  const server = http.createServer((req, res) => {
    let u; try { u = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('400'); }          // un % mal formado no debe tumbar el servidor
    if (u.endsWith('/')) u += 'index.html';
    const base = path.resolve(root), fp = path.join(base, u);
    if (!fp.startsWith(base + path.sep) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('404'); }      // y nunca fuera de la carpeta (ni en una hermana con el mismo prefijo)
    const type = MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream';
    if (gzip && /^(text\/|application\/(json|xml)|image\/svg)/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {      // como el hosting real: texto comprimido
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=3600' });
      return fs.createReadStream(fp).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' });
    fs.createReadStream(fp).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
