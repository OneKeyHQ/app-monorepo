const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
}

function startStaticServer({
  rootDir,
  host = '127.0.0.1',
  port = 0,
  spaFallback = true,
} = {}) {
  const root = path.resolve(rootDir);
  const indexHtml = path.join(root, 'index.html');

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${host}`);
      const pathname = decodeURIComponent(url.pathname || '/');
      const rel = pathname === '/' ? '/index.html' : pathname;

      const requested = path.join(root, rel);
      if (!requested.startsWith(root)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(requested) && fs.statSync(requested).isFile()) {
        sendFile(res, requested);
        return;
      }

      // SPA routes should fall back to index.html (but do not mask missing assets).
      const ext = path.extname(rel);
      if (spaFallback && !ext && fs.existsSync(indexHtml)) {
        sendFile(res, indexHtml);
        return;
      }

      res.statusCode = 404;
      res.end('Not Found');
    } catch (e) {
      res.statusCode = 500;
      res.end(`Server Error: ${e?.message || String(e)}`);
    }
  });

  const started = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const addr = server.address();
      const actualPort =
        addr && typeof addr === 'object' ? addr.port : Number(port);
      resolve({
        server,
        host,
        port: actualPort,
        baseUrl: `http://${host}:${actualPort}`,
        close: () =>
          new Promise((r) => {
            try {
              server.close(() => r());
            } catch {
              r();
            }
          }),
      });
    });
  });

  return started;
}

module.exports = {
  startStaticServer,
};
