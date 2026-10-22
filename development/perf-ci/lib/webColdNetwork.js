/**
 * Network isolation for the web cold-start harness.
 *
 * Modes (PERF_WEB_COLD_NETWORK):
 * - fixtures (default): every request that leaves the local static server is
 *   answered from recorded API fixtures, replaced with an inert stub, or
 *   aborted and counted. Chromium also gets a host resolver rule that fails
 *   any lookup except 127.0.0.1, so a request the route misses cannot reach a
 *   real host either.
 * - record: same stubs and resolver rule, but calls to the endpoints listed in
 *   RECORDABLE_ENDPOINTS are forwarded from Node to an upstream origin and the
 *   JSON responses are written back to the fixture file. Any API call that
 *   cannot be recorded fails the recording and leaves the file untouched.
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
  'Recorded API responses replayed by development/perf-ci/run-web-cold.js. Refresh with `yarn perf:web:cold:record` (see development/perf-ci/README.md). One entry per line; keys are "<METHOD> <host><path>[?sorted, percent-encoded query][ <body>]".';

// Hosts the page loads data from. In record mode a call to one of them must be
// recorded or the recording fails; requests to any other host are only ever
// stubbed or aborted, so a new third-party dependency shows up as blocked.
const API_HOST_PATTERNS = [/\.onekeycn\.com$/, /^api\.hyperliquid\.xyz$/];

// Endpoints reviewed as returning public data only (no account, wallet or
// device data). The fixture file is committed to a public repository, so
// record mode refuses any other API call, any query parameter not listed for
// its endpoint and any POST body that does not match: review a new endpoint or
// parameter and add it here before recording it. `route` is "<METHOD>
// <host><path>"; listed parameters carry public values (networks, tokens,
// setting keys, paging), and `values` pins a parameter's value to a pattern.
const RECORDABLE_ENDPOINTS = [
  {
    route: 'GET earn.onekeycn.com/earn/v1/available-assets',
    query: ['type'],
  },
  { route: 'GET earn.onekeycn.com/earn/v1/block-region' },
  { route: 'GET earn.onekeycn.com/earn/v1/faq/list' },
  {
    route: 'POST earn.onekeycn.com/earn/v2/recommend',
    body: /^\{"accounts":\[\]\}$/,
  },
  { route: 'GET rebate.onekeycn.com/rebate/v1/invite/post-config' },
  {
    route: 'GET swap.onekeycn.com/swap/v1/native-token-config',
    query: ['networkId'],
  },
  { route: 'GET swap.onekeycn.com/swap/v1/networks', query: ['protocol'] },
  { route: 'GET swap.onekeycn.com/swap/v1/providers/list' },
  { route: 'GET swap.onekeycn.com/swap/v1/speed-config', query: ['networkId'] },
  { route: 'GET swap.onekeycn.com/swap/v1/swap-config' },
  {
    route: 'GET swap.onekeycn.com/swap/v1/token/detail',
    query: ['contractAddress', 'currency', 'networkId', 'protocol'],
  },
  { route: 'GET utility.onekeycn.com/utility/v1/app-update' },
  { route: 'GET utility.onekeycn.com/utility/v1/currency/exchange-rates/map' },
  {
    route: 'GET utility.onekeycn.com/utility/v1/market/tokens',
    query: ['category', 'ids', 'sparkline'],
  },
  {
    route: 'GET utility.onekeycn.com/utility/v1/perp-config',
    query: ['assetTypeVersion'],
  },
  { route: 'GET utility.onekeycn.com/utility/v1/setting', query: ['key'] },
  { route: 'GET utility.onekeycn.com/utility/v1/swap-tips' },
  { route: 'GET utility.onekeycn.com/utility/v2/market/banner/list' },
  {
    route:
      /^GET utility\.onekeycn\.com\/utility\/v2\/market\/banner\/(stock-)?token-list\/[0-9a-f]{24}$/,
    query: ['currency'],
  },
  {
    route: 'GET utility.onekeycn.com/utility/v2/market/basic-config',
    query: ['configVersion'],
  },
  {
    route: 'GET utility.onekeycn.com/utility/v2/market/token/list',
    query: [
      'currency',
      'limit',
      'minLiquidity',
      'networkId',
      'page',
      'timeFrame',
      'type',
    ],
  },
  {
    route: 'GET wallet.onekeycn.com/wallet/v1/health',
    query: ['_', 'timestamp'],
    values: { _: /^system_time_utils$/, timestamp: /^\d{13}$/ },
  },
  {
    route: 'GET wallet.onekeycn.com/wallet/v1/network/list',
    query: ['onlyEvmNetworks'],
  },
  { route: 'GET wallet.onekeycn.com/wallet/v1/portfolio/chains' },
  {
    route: 'POST api.hyperliquid.xyz/info',
    body: /^\{("dex":"[a-z]*",)?"type":"(allMids|allPerpMetas|meta|metaAndAssetCtxs|spotMeta|spotMetaAndAssetCtxs)"\}$/,
  },
];

// A request that carries one of these belongs to a signed-in user or browser
// session; its response must never be recorded.
const CREDENTIAL_HEADERS = [
  'authorization',
  'cookie',
  'x-onekey-request-token',
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

// The real API hosts answer with a Date header and expose every header to
// cross-origin callers. The app reads Date from each API response
// (systemTimeUtils), so replayed responses carry a current one too.
function apiResponseHeaders() {
  return {
    'access-control-expose-headers': '*',
    'cache-control': 'no-store',
    date: new Date().toUTCString(),
  };
}

// 1x1 transparent PNG; browsers sniff it fine for any image URL.
const STUB_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const STUB_DOCUMENT =
  '<!doctype html><html><head><meta charset="utf-8"><title>perf stub</title></head><body></body></html>';

// Query params that change on every call (e.g. the server-time probe on
// wallet/v1/health) and must not take part in fixture keys. This only affects
// matching; record mode accepts them only on routes whose RECORDABLE_ENDPOINTS
// entry lists them with a value pattern.
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

function shortHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
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
  return `sha256:${shortHash(normalized)}`;
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
    // Encoded so a value containing & or = cannot collide with another query.
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  const body = method.toUpperCase() === 'GET' ? '' : bodyKey(postData);
  return [`${routeKey({ method, url })}${query ? `?${query}` : ''}`, body]
    .filter(Boolean)
    .join(' ');
}

function isApiUrl(url) {
  const { hostname } = new URL(url);
  return API_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Why a request to an API host may not be recorded, or null when it may.
 */
function recordRefusal({ method, url, postData, headers }) {
  const credential = CREDENTIAL_HEADERS.find((name) => headers?.[name]);
  if (credential) return `carries ${credential}`;
  const route = routeKey({ method, url });
  const endpoint = RECORDABLE_ENDPOINTS.find((item) =>
    typeof item.route === 'string'
      ? item.route === route
      : item.route.test(route),
  );
  if (!endpoint) return 'endpoint not in RECORDABLE_ENDPOINTS';
  // Volatile parameters get no exemption here: a route must list them, and
  // the reasons never quote a parameter name, which could itself be data.
  for (const [name, value] of new URL(url).searchParams) {
    if (!(endpoint.query || []).includes(name)) {
      return 'query parameter not allowed for this endpoint';
    }
    if (endpoint.values?.[name] && !endpoint.values[name].test(value)) {
      return 'query parameter value not allowed for this endpoint';
    }
  }
  if (endpoint.body && !endpoint.body.test(bodyKey(postData))) {
    return 'request body not allowed for this endpoint';
  }
  return null;
}

// A path segment or query name is shown in logs and reports only when it
// looks like a plain word; ids, addresses, hashes and tokens become a
// placeholder.
function redactToken(token, placeholder) {
  const digits = token.replace(/\D/g, '').length;
  return /^[A-Za-z_][\w.-]{0,31}$/.test(token) && digits < 6
    ? token
    : placeholder;
}

// For logs and reports: drops query values, keeps only word-like path
// segments and query names, and (in redactRequest) hashes the body, because a
// refused or blocked request may carry data that must not be published.
function redactUrl(url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname
    .split('/')
    .map((segment) => (segment ? redactToken(segment, ':id') : segment))
    .join('/');
  const names = [
    ...new Set(
      [...parsed.searchParams.keys()].map((name) =>
        redactToken(name, ':param'),
      ),
    ),
  ].toSorted();
  return `${parsed.origin}${pathname}${names.length ? `?${names.join('&')}` : ''}`;
}

function redactRequest({ method, url, postData }) {
  const body =
    method.toUpperCase() !== 'GET' && postData
      ? ` body sha256:${shortHash(postData)}`
      : '';
  return `${method.toUpperCase()} ${redactUrl(url).replace(/^[a-z]+:\/\//, '')}${body}`;
}

// Writes next to the target and renames, so a failed or interrupted write
// never leaves a truncated file behind.
function writeFileAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stagedPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(stagedPath, content);
    fs.renameSync(stagedPath, filePath);
  } finally {
    fs.rmSync(stagedPath, { force: true });
  }
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

// Exact keys only: a query or body the recording never saw is blocked rather
// than answered with another variant's data. Params that legitimately change
// per call belong in VOLATILE_QUERY_KEYS.
function createFixtureStore(file) {
  const byKey = new Map(file.entries.map((entry) => [entry.key, entry]));
  return {
    size: byKey.size,
    lookup(request) {
      const key = requestKey(request);
      return { entry: byKey.get(key) || null, key };
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
 * An API call that could not be recorded is a failure, and `write` refuses to
 * touch the file while there is one, so a failed refresh can neither drop an
 * endpoint nor keep a stale answer for it. Failures are kept under a redacted
 * label (see redactRequest) because they end up in logs.
 */
function createRecorder({ fixturePath, source, fresh, log }) {
  const existing = fresh ? emptyFixtureFile() : readFixtureFile(fixturePath);
  const recorded = new Map();
  const failures = new Map();

  return {
    source,
    fail(label, reason) {
      failures.set(label, reason);
    },
    failures() {
      return [...failures].map(([request, reason]) => ({ request, reason }));
    },
    add({ key, label, status, contentType, body, scenario }) {
      const text = body.toString('utf8');
      let json;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }
      // Only a 2xx JSON answer (or an empty 204) can be replayed: redirects
      // were not followed, and block pages are not API responses.
      let problem = null;
      if (status < 200 || status >= 300) {
        problem = `upstream answered ${status}`;
      } else if (!text && status !== 204) {
        problem = `upstream answered ${status} with an empty body`;
      } else if (text && json === undefined) {
        problem = `upstream answered ${status} without JSON`;
      }
      if (problem) {
        failures.set(label, problem);
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
      if (failures.size) {
        throw new Error(
          `refusing to write ${fixturePath}: ${failures.size} API call(s) were not recorded`,
        );
      }
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
      writeFileAtomic(fixturePath, serializeFixtureFile(file));
      log(
        `recorded ${recorded.size} API fixture(s) from ${source}, kept ${kept.length}, wrote ${fixturePath}`,
      );
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
      url: truncateUrl(redactUrl(request.url())),
      resourceType: request.resourceType(),
      reason,
    });
    return route.abort('blockedbyclient');
  };

  await context.routeWebSocket(isExternal, (ws) => {
    // Not connecting to the server leaves the socket open and silent.
    stats.websockets.push(truncateUrl(redactUrl(ws.url())));
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
        headers: apiResponseHeaders(),
        body: SINK_RESPONSE_BODY,
      });
    }

    const keyInput = {
      method: request.method(),
      url,
      postData: request.postData(),
    };

    if (mode === 'record') {
      const label = redactRequest(keyInput);
      if (!isApiUrl(url)) {
        // Data calls to a host nobody reviewed must not pass silently; scripts,
        // styles and fonts from third parties are only blocked.
        if (resourceType === 'xhr' || resourceType === 'fetch') {
          recorder.fail(label, 'host not in API_HOST_PATTERNS');
        }
        return block(route, request, 'not-recordable');
      }
      const key = requestKey(keyInput);
      const refusal = recordRefusal({
        ...keyInput,
        headers: await request.allHeaders(),
      });
      if (refusal) {
        recorder.fail(label, refusal);
        return block(route, request, `record-refused: ${refusal}`);
      }
      const headers = { ...request.headers() };
      if (headers['user-agent']) {
        headers['user-agent'] = headers['user-agent'].replace(
          'HeadlessChrome',
          'Chrome',
        );
      }
      let response;
      try {
        // No redirects: a hop could leave the reviewed hosts, and this
        // Node-side request is not covered by the Chromium resolver rule.
        response = await route.fetch({
          url: RECORD_SOURCES[recorder.source](url),
          headers,
          maxRedirects: 0,
        });
      } catch (error) {
        // Only the first line: Playwright appends a call log with the
        // request headers and cookies.
        const reason = String(error?.message || error).split('\n')[0];
        recorder.fail(label, `fetch failed: ${reason}`);
        return block(route, request, `record-fetch-failed: ${reason}`);
      }
      const body = await response.body();
      if (
        recorder.add({
          key,
          label,
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

    const { entry, key } = fixtureStore.lookup(keyInput);
    if (!entry) return block(route, request, 'no-fixture');
    increment(stats.fixtureHits, key);
    if (latencyMs > 0) await sleep(latencyMs);
    return route.fulfill({
      status: entry.status,
      contentType: entry.contentType,
      headers: apiResponseHeaders(),
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
      url: truncateUrl(redactUrl(request.url())),
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
  recordRefusal,
  redactRequest,
  redactUrl,
  requestKey,
  resolveNetworkMode,
  resolveRecordSource,
  serializeFixtureFile,
  summarizeNetworkStats,
  writeFileAtomic,
};
