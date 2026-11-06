// Run: node development/scripts/app-update-mock-server.js
// In desktop Dev Settings, disable Test Endpoint and add an enabled custom
// Utility API endpoint at http://127.0.0.1:3188. Use an isolated app profile.
// Reload the desktop renderer after saving the endpoint to clear its cached
// Utility API client.
// Build both renderer and main with VERSION=6.6.0 (or another version below
// 6.6.1); the normal newer-version check rejects current or newer clients.
// The Electron app directory's package.json metadata.version must also be
// 6.6.0; launching bare main.js reports Electron's version via app.getVersion().
// Build main with ONEKEY_ALLOW_SKIP_GPG_VERIFICATION=false.
// This only mocks the release notice. The app still fetches the real production
// HTTPS feed, package, and ASC signature and performs its normal verification.

const crypto = require('node:crypto');
const http = require('node:http');

const port = 3188;
const release = JSON.stringify({
  code: 0,
  data: {
    version: '6.6.1',
    updateStrategy: 2,
    downloadUrl:
      'https://web.onekey-asset.com/app-monorepo/v6.6.1/OneKey-Wallet-6.6.1-win-x64.exe',
    fileSize: 165_092_224,
    changeLog: '## QA\n\nBackground update acceptance',
    summary: 'QA update',
  },
});
const fixtureSha256 = crypto.createHash('sha256').update(release).digest('hex');
const updatePath = '/utility/v1/app-update';
const telemetryPath = `${updatePath}/telemetry`;
const featuredPath = `${updatePath}/featured-changelog-preview`;

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const knownPath = [updatePath, telemetryPath, featuredPath].includes(
      pathname,
    );
    const origin = req.headers.origin;
    if (
      knownPath &&
      (origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001')
    ) {
      if (origin === 'http://localhost:3001') {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
      } else {
        res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3001');
      }
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'content-type, authorization, x-onekey-custom-user-agent, x-onekey-request-id, x-amzn-trace-id, x-onekey-request-currency, x-onekey-instance-id, x-onekey-request-locale, x-onekey-request-theme, x-onekey-request-platform, x-onekey-request-platform-name, x-onekey-request-device-name, x-onekey-request-version, x-onekey-hide-asset-details, x-onekey-request-build-number, x-onekey-request-jsbundle-version',
      );
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    let status = 404;
    let body = JSON.stringify({ code: 404, data: null });
    if (req.method === 'OPTIONS' && knownPath) {
      status = 204;
      body = '';
    } else if (req.method === 'GET' && pathname === updatePath) {
      status = 200;
      body = release;
    } else if (req.method === 'POST' && pathname === telemetryPath) {
      req.resume();
      status = 200;
      body = JSON.stringify({ code: 0, data: null });
    } else if (req.method === 'GET' && pathname === featuredPath) {
      status = 200;
      body = JSON.stringify({ code: 0, data: {} });
    }
    res.writeHead(status);
    res.end(body);
    process.stdout.write(
      `${new Date().toISOString()} ${req.method} ${pathname} ${status}\n`,
    );
  })
  .listen(port, '127.0.0.1', () => {
    process.stdout.write(
      `MOCK_URL=http://127.0.0.1:${port} FIXTURE_SHA256=${fixtureSha256}\n`,
    );
  });
