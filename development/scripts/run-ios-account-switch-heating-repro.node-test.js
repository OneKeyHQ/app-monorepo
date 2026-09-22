const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  parseNativeLog,
  readBuildProvenance,
  redactNetworkRequest,
  summarizeAcceptance,
  summarizeEvents,
  summarizeNativeLog,
  summarizeSamples,
} = require('./run-ios-account-switch-heating-repro');

const context = {
  formalStartedAt: '2026-09-22T12:00:00.000Z',
  formalEndedAt: '2026-09-22T12:03:10.000Z',
  localUtcOffsetMinutes: 480,
};

test('counts relative axios, absolute fetch and malformed start entries, inheriting multiline RPC timestamps', () => {
  const { events } = parseNativeLog(
    [
      '20:00:01 | DEBUG : app => network => start : ["axios:get:/wallet/v1/token/list?accountId=secret&balance=123"]',
      '20:00:02 | DEBUG : app => network => start : ["fetch:POST:https://api.example.org/v1/tokens/0x1234567890abcdef1234567890abcdef12345678?address=private"]',
      '[BgTransport] dispatchRemoteRequest: callId=1, type=service-call, method=serviceToken.fetchAccountTokens',
      '20:00:03 | DEBUG : app => network => start : ["unexpected encoding"]',
      '[BgTransport] dispatchRemoteRequest: callId=2, type=service-call, method=serviceToken.abortFetchAccountTokens',
    ].join('\n'),
    context,
  );
  const summary = summarizeEvents(
    events,
    Date.parse(context.formalStartedAt),
    Date.parse(context.formalEndedAt),
  );
  assert.equal(summary.networkRequestCount, 3);
  assert.equal(summary.bgRpcCount, 2);
  assert.equal(summary.fetchAccountTokens, 1);
  assert.equal(summary.abortFetchAccountTokens, 1);
  assert.equal(summary.unparsedNetworkCount, 1);
  assert.equal(events[2].atMs, Date.parse('2026-09-22T12:00:02.000Z'));
  assert.match(
    JSON.stringify(summary.networkTop),
    /\[relative\]\/wallet\/v1\/token\/list/u,
  );
  assert.doesNotMatch(
    JSON.stringify(summary),
    /secret|balance|private|1234567890abcdef/u,
  );
});

test('redacts query, credentials, numeric ids, account ids, and encoded path identifiers', () => {
  for (const [url, expected] of [
    [
      'https://user:password@api.example.org/v1/account/alias?secret=1',
      'GET api.example.org/v1/account/[id]',
    ],
    ['/v2/hd-7--0/token/12345', 'GET [relative]/v2/[id]/token/[id]'],
    [
      '/v1/address/%30x1234567890abcdef1234567890abcdef12345678',
      'GET [relative]/v1/address/[id]',
    ],
    ['/v1/token/invalid%escape', 'GET [relative]/v1/token/[id]'],
  ])
    assert.equal(
      redactNetworkRequest(`axios:get:${url}, requestId: ignored`),
      expected,
    );
});

test('uses supplied local UTC offset across midnight and leaves absent timestamps unmeasured', () => {
  const { events } = parseNativeLog(
    [
      '[BgTransport] dispatchRemoteRequest: callId=1, method=serviceToken.fetchAccountTokens',
      '23:59:59 | DEBUG : app => network => start : ["axios:get:/v1/one"]',
      '00:00:01 | DEBUG : app => network => start : ["axios:get:/v1/two"]',
    ].join('\n'),
    { formalStartedAt: '2026-09-22T15:59:58.000Z', localUtcOffsetMinutes: 480 },
  );
  assert.equal(events[0].atMs, null);
  assert.equal(events[1].atMs, Date.parse('2026-09-22T15:59:59.000Z'));
  assert.equal(events[2].atMs, Date.parse('2026-09-22T16:00:01.000Z'));
});

test('aligns last30 to actual formal end and excludes diagnostic samples from formal RSS', () => {
  const samples = [
    { elapsedSec: 1, cpu: 30, rssMB: 100 },
    { elapsedSec: 159, cpu: 999, rssMB: 150 },
    { elapsedSec: 161, cpu: 60, rssMB: 200 },
    { elapsedSec: 189, cpu: 80, rssMB: 250 },
    { elapsedSec: 200, cpu: 999, rssMB: 999 },
    { elapsedSec: 251, cpu: 10, rssMB: 300 },
    { elapsedSec: 265, cpu: 20, rssMB: 310 },
    { elapsedSec: 309, cpu: 30, rssMB: 305 },
  ];
  const summary = summarizeSamples(samples, {
    ...context,
    observation: {
      startedAt: '2026-09-22T12:04:10.000Z',
      endedAt: '2026-09-22T12:05:10.000Z',
    },
  });
  assert.equal(summary.last30.cpuAvg, 70);
  assert.equal(summary.last30.cpuMax, 80);
  assert.equal(summary.formal.rssDeltaMB, 150);
  assert.equal(summary.cooldown.after10.cpuAvg, 25);
  assert.equal(summary.cooldown.complete, true);
  assert.match(summary.memoryMetric, /host ps/u);
});

test('does not infer build commit from checkout and requires a matching installed bundle hash', () => {
  assert.equal(readBuildProvenance({}).status, 'UNMEASURED');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'heating-build-manifest-'),
  );
  const manifestPath = path.join(directory, 'manifest.json');
  try {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        buildCommitSha: 'a'.repeat(40),
        mainBundleSha256: 'bundle',
        status: 'pretend',
        sensitive: 'must not copy',
      }),
    );
    assert.equal(
      readBuildProvenance({ manifestPath, mainBundleSha256: 'other' }).status,
      'FAIL',
    );
    const provenance = readBuildProvenance({
      manifestPath,
      mainBundleSha256: 'bundle',
    });
    assert.equal(provenance.status, 'MEASURED');
    assert.equal(provenance.sensitive, undefined);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missing performance measurements cannot become PASS from functional completion', () => {
  const acceptance = summarizeAcceptance({
    functionalPassed: true,
    evidenceCollected: true,
    maxPositiveDriftMs: 0,
    processSummary: summarizeSamples([], context),
    nativeLog: null,
    buildProvenance: { status: 'UNMEASURED' },
  });
  assert.equal(acceptance.status, 'INCOMPLETE');
  assert.equal(
    acceptance.checks.find((check) => check.name === 'last30CpuAvg').status,
    'UNMEASURED',
  );
  assert.equal(
    acceptance.checks.find(
      (check) => check.name === 'physicalDeviceThermalState',
    ).status,
    'UNMEASURED',
  );
});

const referenceDirectory = path.resolve(
  __dirname,
  '../output/perf-sessions/account-switch-heating/2026-09-22T12-48-09-580Z',
);
test(
  'reproduces the original native logger formal, last60 and six-switch counts when the local reference is available',
  {
    skip: !fs.existsSync(
      path.join(referenceDirectory, 'native-log-segment.log'),
    ),
  },
  () => {
    const run = JSON.parse(
      fs.readFileSync(path.join(referenceDirectory, 'run-meta.json'), 'utf8'),
    );
    const readLines = (name) =>
      fs
        .readFileSync(path.join(referenceDirectory, name), 'utf8')
        .trim()
        .split('\n')
        .map(JSON.parse);
    const summary = summarizeNativeLog(
      path.join(referenceDirectory, 'native-log-segment.log'),
      {
        ...run,
        actionTimeline: readLines('action-timeline.jsonl'),
        localUtcOffsetMinutes: 480,
      },
    );
    assert.equal(summary.windows.formal.networkRequestCount, 798);
    assert.equal(summary.windows.formal.bgRpcCount, 3538);
    assert.equal(summary.windows.last60.networkRequestCount, 352);
    assert.equal(summary.windows.last60.bgRpcCount, 2079);
    assert.equal(summary.windows.allNetworks.networkRequestCount, 241);
    assert.equal(summary.windows.allNetworks.bgRpcCount, 1203);
    assert.equal(summary.windows.allNetworks.fetchAccountTokens, 126);
    const processSummary = summarizeSamples(
      readLines('process-samples.jsonl'),
      run,
    );
    assert.equal(processSummary.last30.cpuAvg, 200.2);
    assert.equal(processSummary.last30.cpuMax, 299.3);
  },
);
