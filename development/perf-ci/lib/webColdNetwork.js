/**
 * Network isolation for the web cold-start harness.
 *
 * Modes (PERF_WEB_COLD_NETWORK):
 * - fixtures (default): every request that leaves the local static server is
 *   answered from recorded API fixtures, replaced with an inert stub, or
 *   aborted and counted. Chromium also gets a host resolver rule that fails
 *   any lookup except 127.0.0.1, so a request the route misses cannot reach a
 *   real host either.
 * - record: same stubs and resolver rule, but API calls are forwarded from
 *   Node to an upstream origin and the JSON responses are written back to the
 *   fixture file.
 * - live: no interception; the page talks to the real APIs.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NETWORK_MODES = ['fixtures', 'record', 'live'];

const DEFAULT_FIXTURE_PATH = path.join(
  __dirname,
  '..',
  'fixtures',
  'web-cold-api.json',
);

const FIXTURE_FILE_COMMENT =
  'Recorded API responses replayed by development/perf-ci/run-web-cold.js. Refresh with `yarn perf:web:cold:record` (see development/perf-ci/README.md). One entry per line; keys are "<METHOD> <host><path>[?sorted query][ <body>]".';

// API hosts whose responses may be recorded. Requests to other hosts are only
// ever stubbed or aborted, so a new third-party dependency shows up as blocked.
const RECORDABLE_HOST_PATTERNS = [
  /\.onekeycn\.com$/,
  /^api\.hyperliquid\.xyz$/,
];

// Upstream origins for record mode. `test` keeps the production URL in the
// fixture key and only changes where the response is fetched from.
const RECORD_SOURCES = {
  production: (url) => url,
  test: (url) => {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace(
      /\.onekeycn\.com$/,
      '.onekeytest.com',
    );
    return parsed.toString();
  },
};

// Fire-and-forget endpoints that must never reach a real server and whose
// response the page ignores.
const SINK_PATH_PATTERNS = [/^\/utility\/v1\/track\//];
const SINK_RESPONSE_BODY = JSON.stringify({
  code: 0,
  message: 'Success',
  data: null,
});

// 1x1 transparent PNG; browsers sniff it fine for any image URL.
const STUB_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const STUB_DOCUMENT =
  '<!doctype html><html><head><meta charset="utf-8"><title>perf stub</title></head><body></body></html>';

// Query params that change on every call (e.g. the server-time probe on
// wallet/v1/health) and must not take part in fixture keys.
const VOLATILE_QUERY_KEYS = new Set(['timestamp']);

const MAX_INLINE_BODY_KEY_LENGTH = 256;
const MAX_REPORTED_URL_LENGTH = 300;

function resolveNetworkMode(value = process.env.PERF_WEB_COLD_NETWORK) {
  const mode = (value || 'fixtures').trim();
  if (!NETWORK_MODES.includes(mode)) {
    throw new Error(
      `unknown PERF_WEB_COLD_NETWORK "${mode}". Known: ${NETWORK_MODES.join(', ')}`,
    );
  }
  return mode;
}

function resolveRecordSource(value = process.env.PERF_WEB_COLD_RECORD_SOURCE) {
  const source = (value || 'production').trim();
  if (!RECORD_SOURCES[source]) {
    throw new Error(
      `unknown PERF_WEB_COLD_RECORD_SOURCE "${source}". Known: ${Object.keys(
        RECORD_SOURCES,
      ).join(', ')}`,
    );
  }
  return source;
}

function isolatedChromiumArgs(mode) {
  if (mode === 'live') return [];
  return [
    '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  ];
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function bodyKey(postData) {
  if (!postData) return '';
  let normalized = postData;
  try {
    normalized = canonicalJson(JSON.parse(postData));
  } catch {
    // Not JSON: key on the raw body.
  }
  if (normalized.length <= MAX_INLINE_BODY_KEY_LENGTH) return normalized;
  return `sha256:${crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, 16)}`;
}

function routeKey({ method, url }) {
  const parsed = new URL(url);
  return `${method.toUpperCase()} ${parsed.host}${parsed.pathname}`;
}

function requestKey({ method, url, postData }) {
  const parsed = new URL(url);
  const query = [...parsed.searchParams.entries()]
    .filter(([key]) => !VOLATILE_QUERY_KEYS.has(key))
    .toSorted(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const body = method.toUpperCase() === 'GET' ? '' : bodyKey(postData);
  return [`${routeKey({ method, url })}${query ? `?${query}` : ''}`, body]
    .filter(Boolean)
    .join(' ');
}

function isRecordableUrl(url) {
  const { hostname } = new URL(url);
  return RECORDABLE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isSinkUrl(url) {
  const { pathname } = new URL(url);
  return SINK_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function emptyFixtureFile() {
  return {
    _comment: FIXTURE_FILE_COMMENT,
    recordedAt: null,
    source: null,
    entries: [],
  };
}

function readFixtureFile(filePath) {
  if (!fs.existsSync(filePath)) return emptyFixtureFile();
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    ...emptyFixtureFile(),
    ...raw,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
  };
}

// One entry per line keeps refresh diffs readable per endpoint.
function serializeFixtureFile(file) {
  const { entries, ...meta } = file;
  const metaLines = Object.entries(meta).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`,
  );
  const entryLines = entries
    .toSorted((a, b) => a.key.localeCompare(b.key))
    .map((entry) => `    ${JSON.stringify(entry)}`);
  return [
    '{',
    ...metaLines,
    '  "entries": [',
    entryLines.join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n');
}

function createFixtureStore(file) {
  const byKey = new Map();
  const byRoute = new Map();
  for (const entry of file.entries) {
    byKey.set(entry.key, entry);
    const [method, hostPath] = entry.key.split(' ');
    const route = `${method} ${hostPath.split('?')[0]}`;
    if (!byRoute.has(route)) byRoute.set(route, entry);
  }
  return {
    size: byKey.size,
    lookup(request) {
      const key = requestKey(request);
      const exact = byKey.get(key);
      if (exact) return { entry: exact, key, fallback: false };
      // Query values such as contract addresses can vary between runs; any
      // response recorded for the same GET route has the right shape.
      if (request.method.toUpperCase() === 'GET') {
        const sameRoute = byRoute.get(routeKey(request));
        if (sameRoute) return { entry: sameRoute, key, fallback: true };
      }
      return { entry: null, key, fallback: false };
    },
  };
}

function fixtureBody(entry) {
  return entry.json !== undefined ? JSON.stringify(entry.json) : entry.text;
}

/**
 * Collects upstream responses during a record run. Existing entries are kept
 * and re-recorded keys replace them, so a partial run (one scenario, one
 * device profile) only adds to the file; `fresh` starts from an empty file.
 */
function createRecorder({ fixturePath, source, fresh, log }) {
  const existing = fresh ? emptyFixtureFile() : readFixtureFile(fixturePath);
  const recorded = new Map();
  const skipped = new Map();

  return {
    source,
    add({ key, status, contentType, body, scenario }) {
      const text = body.toString('utf8');
      let json;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }
      if (status >= 400 || (text && json === undefined)) {
        // Block pages and other non-JSON answers are not API responses.
        skipped.set(key, status);
        return false;
      }
      const entry = recorded.get(key) || {
        key,
        status,
        contentType: contentType || 'application/json; charset=utf-8',
        scenarios: [],
        ...(json === undefined ? { text: '' } : { json }),
      };
      if (!entry.scenarios.includes(scenario)) {
        entry.scenarios = [...entry.scenarios, scenario].toSorted();
      }
      recorded.set(key, entry);
      return true;
    },
    write() {
      const kept = [];
      for (const entry of existing.entries) {
        const replacement = recorded.get(entry.key);
        if (replacement) {
          replacement.scenarios = [
            ...new Set([...(entry.scenarios || []), ...replacement.scenarios]),
          ].toSorted();
        } else {
          kept.push(entry);
        }
      }
      const file = {
        _comment: FIXTURE_FILE_COMMENT,
        recordedAt: new Date().toISOString(),
        source,
        entries: [...kept, ...recorded.values()],
      };
      fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
      fs.writeFileSync(fixturePath, serializeFixtureFile(file));
      log(
        `recorded ${recorded.size} API fixture(s) from ${source}, kept ${kept.length}, wrote ${fixturePath}`,
      );
      for (const [key, status] of skipped) {
        if (!recorded.has(key)) {
          log(`record: no JSON response (status ${status}) for ${key}`);
        }
      }
    },
  };
}

function truncateUrl(url) {
  return url.length > MAX_REPORTED_URL_LENGTH
    ? `${url.slice(0, MAX_REPORTED_URL_LENGTH)}…`
    : url;
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Installs the routes for one browser context and returns the per-run stats.
 */
async function installNetworkIsolation({
  context,
  mode,
  localOrigin,
  fixtureStore,
  recorder,
  scenarioName,
  latencyMs = 0,
}) {
  const stats = {
    mode,
    fixtureHits: {},
    fixtureFallbackHits: {},
    recorded: {},
    stubbed: {},
    blocked: [],
    websockets: [],
  };
  if (mode === 'live') return stats;

  const handledRequests = new WeakSet();
  const isExternal = (url) =>
    /^(https?|wss?):$/.test(url.protocol) && url.origin !== localOrigin;

  const block = (route, request, reason) => {
    stats.blocked.push({
      method: request.method(),
      url: truncateUrl(request.url()),
      resourceType: request.resourceType(),
      reason,
    });
    return route.abort('blockedbyclient');
  };

  await context.routeWebSocket(isExternal, (ws) => {
    // Not connecting to the server leaves the socket open and silent.
    stats.websockets.push(truncateUrl(ws.url()));
  });

  const handleRoute = async (route) => {
    const request = route.request();
    handledRequests.add(request);
    const url = request.url();
    const resourceType = request.resourceType();

    if (resourceType === 'image') {
      increment(stats.stubbed, 'image');
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: STUB_IMAGE,
      });
    }
    if (resourceType === 'document') {
      increment(stats.stubbed, 'document');
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: STUB_DOCUMENT,
      });
    }
    if (isSinkUrl(url)) {
      increment(stats.stubbed, 'sink');
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: SINK_RESPONSE_BODY,
      });
    }

    const keyInput = {
      method: request.method(),
      url,
      postData: request.postData(),
    };

    if (mode === 'record') {
      if (!isRecordableUrl(url)) return block(route, request, 'not-recordable');
      const key = requestKey(keyInput);
      const headers = { ...request.headers() };
      if (headers['user-agent']) {
        headers['user-agent'] = headers['user-agent'].replace(
          'HeadlessChrome',
          'Chrome',
        );
      }
      let response;
      try {
        response = await route.fetch({
          url: RECORD_SOURCES[recorder.source](url),
          headers,
        });
      } catch (error) {
        // Only the first line: Playwright appends a call log with the
        // request headers and cookies.
        const reason = String(error?.message || error).split('\n')[0];
        return block(route, request, `record-fetch-failed: ${reason}`);
      }
      const body = await response.body();
      if (
        recorder.add({
          key,
          status: response.status(),
          contentType: response.headers()['content-type'],
          body,
          scenario: scenarioName,
        })
      ) {
        increment(stats.recorded, key);
      }
      return route.fulfill({ response, body });
    }

    const { entry, key, fallback } = fixtureStore.lookup(keyInput);
    if (!entry) return block(route, request, 'no-fixture');
    increment(fallback ? stats.fixtureFallbackHits : stats.fixtureHits, key);
    if (latencyMs > 0) await sleep(latencyMs);
    return route.fulfill({
      status: entry.status,
      contentType: entry.contentType,
      headers: { 'cache-control': 'no-store' },
      body: fixtureBody(entry),
    });
  };
  await context.route(isExternal, (route) =>
    handleRoute(route).catch(() => {
      // The run ended and closed the context while this request was pending.
    }),
  );

  // Anything the route did not see and still failed was stopped by the
  // resolver rule; count it so the report never under-states escapes.
  context.on('requestfailed', (request) => {
    if (handledRequests.has(request)) return;
    let parsed;
    try {
      parsed = new URL(request.url());
    } catch {
      return;
    }
    if (!isExternal(parsed)) return;
    stats.blocked.push({
      method: request.method(),
      url: truncateUrl(request.url()),
      resourceType: request.resourceType(),
      reason: `not-routed: ${request.failure()?.errorText || 'failed'}`,
    });
  });

  return stats;
}

function countValues(counts) {
  return Object.values(counts || {}).reduce((total, value) => total + value, 0);
}

function summarizeNetworkStats(stats) {
  return {
    fixtureRequestCount: countValues(stats?.fixtureHits),
    fixtureFallbackRequestCount: countValues(stats?.fixtureFallbackHits),
    recordedRequestCount: countValues(stats?.recorded),
    stubbedRequestCount: countValues(stats?.stubbed),
    blockedRequestCount: stats?.blocked?.length || 0,
    websocketCount: stats?.websockets?.length || 0,
  };
}

module.exports = {
  DEFAULT_FIXTURE_PATH,
  NETWORK_MODES,
  createFixtureStore,
  createRecorder,
  installNetworkIsolation,
  isolatedChromiumArgs,
  readFixtureFile,
  requestKey,
  resolveNetworkMode,
  resolveRecordSource,
  serializeFixtureFile,
  summarizeNetworkStats,
};
