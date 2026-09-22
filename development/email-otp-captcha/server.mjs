import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env.OTP_CAPTCHA_PORT || 8799);
const files = new Map([
  ['/captcha.html', ['captcha.html', 'text/html; charset=utf-8']],
  ['/captcha.js', ['captcha.js', 'application/javascript; charset=utf-8']],
]);

createServer(async (request, response) => {
  const path = new URL(request.url || '/', 'http://localhost').pathname;
  const file = files.get(path);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, {
      'Content-Type': file[1],
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; style-src 'unsafe-inline'; img-src data:",
    });
    response.end(content);
  } catch {
    response.writeHead(500).end();
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`CAPTCHA test page: http://127.0.0.1:${port}/captcha.html`);
});
