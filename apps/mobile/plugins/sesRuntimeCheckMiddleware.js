const PREFIX = '/onekey-dev-session/ses-runtime-check/';
const MARKER = 'onekey-ses-fixture-v1';

function createSesRuntimeCheckMiddleware(sessionId) {
  return (req, res, next) => {
    if (!sessionId || !req.url?.startsWith(PREFIX)) return next();
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers['x-onekey-ses-session'] !== sessionId) {
      res.statusCode = 403;
      res.end('Invalid DevSession.');
      return undefined;
    }
    const route = req.url.slice(PREFIX.length).split('?')[0];
    const send = (status, method) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('x-onekey-ses-fixture', MARKER);
      res.end(JSON.stringify({ marker: MARKER, method, value: 42 }));
    };
    if (route === 'json' || route === 'slow') {
      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end();
        return undefined;
      }
      if (route === 'slow') {
        const timer = setTimeout(() => send(200, 'GET'), 1200);
        res.once('close', () => clearTimeout(timer));
      } else send(200, 'GET');
      return undefined;
    }
    if (route !== 'echo') {
      res.statusCode = 404;
      res.end();
      return undefined;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return undefined;
    }
    if (req.headers['content-type'] !== 'application/json') {
      res.statusCode = 415;
      res.end();
      return undefined;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (res.writableEnded) return;
      body += chunk;
      if (Buffer.byteLength(body) > 1024) {
        res.statusCode = 413;
        res.end();
        body = '';
      }
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      // Accept only the public probe payload; this is not an arbitrary echo service.
      if (body !== '{"value":42}') {
        res.statusCode = 400;
        res.end();
      } else send(200, 'POST');
    });
    return undefined;
  };
}

module.exports = { createSesRuntimeCheckMiddleware };
