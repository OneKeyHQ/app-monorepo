const { once } = require('node:events');
const http = require('node:http');

const {
  isSesFetchAbort,
  runSesNetworkChecks,
} = require('../../../../packages/shared/src/security/sesHarden/runtimeCheckNetwork');
const {
  createSesRuntimeCheckMiddleware,
} = require('../sesRuntimeCheckMiddleware');

let server;
let origin;
const sessionId = 'public-test-session';
const prefix = '/onekey-dev-session/ses-runtime-check';
const headers = { 'x-onekey-ses-session': sessionId };

async function startServer(session) {
  const middleware = createSesRuntimeCheckMiddleware(session);
  server = http.createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 418;
      res.end('next');
    }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  const currentServer = server;
  server = undefined;
  if (!currentServer?.listening) return;
  currentServer.closeAllConnections();
  await new Promise((resolve, reject) =>
    currentServer.close((error) => (error ? reject(error) : resolve())),
  );
});

test('fixture is disabled without a DevSession and leaves other paths alone', async () => {
  await startServer(undefined);
  expect((await fetch(`${origin}${prefix}/json`, { headers })).status).toBe(
    418,
  );
  expect((await fetch(`${origin}/other`)).status).toBe(418);
});

test('fixture rejects missing or mismatched session headers', async () => {
  await startServer(sessionId);
  expect((await fetch(`${origin}${prefix}/json`)).status).toBe(403);
  expect(
    (
      await fetch(`${origin}${prefix}/json`, {
        headers: { 'x-onekey-ses-session': 'wrong-session' },
      })
    ).status,
  ).toBe(403);
});

test('fixture validates methods, content types, fixed payload and body size', async () => {
  await startServer(sessionId);
  const request = (route, init) =>
    fetch(`${origin}${prefix}/${route}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });
  expect((await request('json', { method: 'POST' })).status).toBe(405);
  expect((await request('echo')).status).toBe(405);
  expect((await request('echo', { method: 'POST', body: '{}' })).status).toBe(
    415,
  );
  expect(
    (
      await request('echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"value":43}',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request('echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(1025),
      })
    ).status,
  ).toBe(413);
  const response = await request('json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({
    marker: 'onekey-ses-fixture-v1',
    method: 'GET',
    value: 42,
  });
});

test('real fetch probes pass for valid fixtures and detect a wrong session', async () => {
  await startServer(sessionId);
  const fixture = { baseUrl: `${origin}${prefix}`, sessionId };
  const checks = await runSesNetworkChecks(fixture);
  expect(checks.find((check) => check.name === 'fetch requests')).toMatchObject(
    { status: 'pass' },
  );
  expect(
    checks.find((check) => check.name === 'fetch cancellation'),
  ).toMatchObject({ status: 'pass' });
  const wrongSession = await runSesNetworkChecks({
    ...fixture,
    sessionId: 'wrong',
  });
  expect(
    wrongSession.find((check) => check.name === 'fetch requests'),
  ).toMatchObject({ status: 'fail', detail: 'fetch status/headers' });
  expect(
    wrongSession.find((check) => check.name === 'fetch cancellation'),
  ).toMatchObject({ status: 'fail' });
});

test('unavailable native network fixture is explicitly not exercised', async () => {
  const checks = await runSesNetworkChecks();
  expect(checks).toHaveLength(4);
  expect(checks.every((check) => check.status === 'info')).toBe(true);
});

test('abort detection accepts native FetchError causes and rejects unrelated failures', () => {
  class FetchError extends Error {}
  expect(isSesFetchAbort({ name: 'AbortError' })).toBe(true);
  expect(
    isSesFetchAbort({ name: 'Error', cause: { name: 'AbortError' } }),
  ).toBe(true);
  expect(isSesFetchAbort({ name: 'Error', message: 'aborted' })).toBe(false);
  expect(
    isSesFetchAbort(
      new FetchError('fetch failed: Fetch request has been canceled'),
    ),
  ).toBe(true);
  expect(
    isSesFetchAbort(new FetchError('fetch failed: Network request failed')),
  ).toBe(false);
  expect(
    isSesFetchAbort(new Error('fetch failed: Fetch request has been canceled')),
  ).toBe(false);
  expect(isSesFetchAbort({ name: 'Error', cause: { name: 'TypeError' } })).toBe(
    false,
  );
  expect(isSesFetchAbort(null)).toBe(false);
});
