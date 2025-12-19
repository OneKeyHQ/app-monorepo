import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dns from 'node:dns';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const INGEST_ENDPOINT =
  'http://127.0.0.1:7242/ingest/d0a054d6-27f2-44db-b38c-b5c647a9ff28';

// Prefer IPv4 to avoid common IPv6 routing issues in some networks.
dns.setDefaultResultOrder('ipv4first');

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

// #region agent log helper
function debugLog(location, message, data, hypothesisId, runId) {
  if (
    !process.env.OAUTH_LAB_LOG_TO_INGEST &&
    process.env.OAUTH_LAB_LOG_TO_INGEST !== '1'
  ) {
    return;
  }
  // Avoid logging secrets/tokens.
  const payload = {
    sessionId: 'oauth-lab',
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  fetch(INGEST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

function openInBrowser(url) {
  // macOS / linux / windows best-effort
  const platform = process.platform;
  const cmd =
    platform === 'darwin'
      ? 'open'
      : platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args =
    platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const runId = `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const noOpen = process.argv.includes('--no-open');

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET; // optional for A/B testing
  const tokenTimeoutMs = Number(process.env.TOKEN_TIMEOUT_MS || 30000);

  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxyUrl) {
    // Use proxy if present (common in corp networks; browser works but Node doesn't).
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }

  if (!clientId) {
    // eslint-disable-next-line no-console
    console.error('Missing env: CLIENT_ID');
    process.exit(1);
  }

  debugLog(
    'desktop-oauth-lab:index.mjs:startup',
    'Lab started',
    {
      hasClientId: true,
      hasClientSecret: Boolean(clientSecret),
      noOpen,
      node: process.version,
    },
    'H0',
    runId,
  );

  // PKCE
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(sha256(codeVerifier));

  debugLog(
    'desktop-oauth-lab:index.mjs:pkce',
    'PKCE generated',
    { codeVerifierLength: codeVerifier.length, codeChallengeLength: codeChallenge.length },
    'H1',
    runId,
  );

  const scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  // Start local server on random port
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');

      debugLog(
        'desktop-oauth-lab:index.mjs:callback',
        'Callback received',
        { hasCode: Boolean(code), hasError: Boolean(error), error },
        'H2',
        runId,
      );

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('You can close this window and return to the terminal.');

      if (!code) {
        // eslint-disable-next-line no-console
        console.error('No authorization code received.');
        return;
      }

      // Exchange code -> tokens
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      });
      if (clientSecret) {
        tokenParams.set('client_secret', clientSecret);
      }

      debugLog(
        'desktop-oauth-lab:index.mjs:token_params',
        'Token params ready',
        {
          hasClientSecret: Boolean(clientSecret),
          keys: Array.from(tokenParams.keys()),
          redirectUriHost: new URL(redirectUri).host,
          tokenTimeoutMs,
          hasProxy: Boolean(proxyUrl),
        },
        'H3',
        runId,
      );

      let resp;
      try {
        resp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams,
          signal: AbortSignal.timeout(tokenTimeoutMs),
        });
      } catch (e) {
        debugLog(
          'desktop-oauth-lab:index.mjs:token_fetch_error',
          'Token fetch failed',
          {
            name: e?.name,
            message: e?.message,
            causeCode: e?.cause?.code,
            causeName: e?.cause?.name,
          },
          'H4',
          runId,
        );
        throw e;
      }

      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      debugLog(
        'desktop-oauth-lab:index.mjs:token_response',
        'Token response received',
        {
          status: resp.status,
          ok: resp.ok,
          error: json?.error,
          errorDescription: json?.error_description,
        },
        'H4',
        runId,
      );

      // eslint-disable-next-line no-console
      console.log('Token exchange status:', resp.status);
      // eslint-disable-next-line no-console
      console.log('Token exchange response (redacted):', {
        error: json?.error,
        error_description: json?.error_description,
        has_id_token: Boolean(json?.id_token),
        has_access_token: Boolean(json?.access_token),
        has_refresh_token: Boolean(json?.refresh_token),
      });
    } finally {
      setTimeout(() => server.close(), 500);
    }
  });

  const port = await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr && addr.port) resolve(addr.port);
      else reject(new Error('Failed to get port'));
    });
  });

  const redirectUri = `http://127.0.0.1:${port}/callback`;

  debugLog(
    'desktop-oauth-lab:index.mjs:server',
    'Local server listening',
    { redirectUri },
    'H2',
    runId,
  );

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  debugLog(
    'desktop-oauth-lab:index.mjs:auth_url',
    'Auth URL built',
    { responseType: authUrl.searchParams.get('response_type'), redirectUriHost: new URL(redirectUri).host },
    'H5',
    runId,
  );

  // eslint-disable-next-line no-console
  console.log('\nOpen this URL to login:\n');
  // eslint-disable-next-line no-console
  console.log(authUrl.href);
  // eslint-disable-next-line no-console
  console.log('\nWaiting for callback on:', redirectUri, '\n');

  if (!noOpen) {
    const opened = openInBrowser(authUrl.href);
    debugLog(
      'desktop-oauth-lab:index.mjs:open',
      'Attempted to open browser',
      { opened },
      'H5',
      runId,
    );
  }
}

// eslint-disable-next-line no-console
main().catch((e) => console.error(e));


