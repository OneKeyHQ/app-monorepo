const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  preserveNativeLogBeforeLaunch,
  startNativeLogCapture,
  parseNativeLog,
  describeCensusWindow,
  summarizeObservedCensusWindows,
  readBuildProvenance,
  redactNetworkRequest,
  summarizeAcceptance,
  summarizeEvents,
  summarizeNativeLog,
  summarizeFpsPhase,
  summarizeSamples,
} = require('./run-ios-account-switch-heating-repro');

test('FPS acceptance weights actual time and tolerates an isolated low minimum', () => {
  const samples = Array.from({ length: 30 }, (_, index) => [
    index * 1000,
    (index + 1) * 1000,
    1000,
    index === 10 ? 12 : 60,
    0,
  ]);
  const result = summarizeFpsPhase(
    [{ fpsSamplingAvailable: 1, fpsSamples: samples }],
    0,
    30_000,
  );
  assert.equal(result.min, 12);
  assert.equal(result.timeWeightedP10, 60);
  assert.equal(result.coveragePct, 100);
  assert.equal(result.maxConsecutiveLowWindows, 1);
  assert.equal(result.status, 'PASS');
  const long = summarizeFpsPhase(
    [
      {
        fpsSamplingAvailable: 1,
        fpsSamples: [
          [0, 3000, 3000, 36, 0],
          [3000, 30_000, 27_000, 1620, 0],
        ],
      },
    ],
    0,
    30_000,
  );
  assert.equal(long.timeWeightedP10, 12);
  assert.equal(long.below30TimePct, 10);
  assert.equal(long.maxConsecutiveLowWindows, 1);
  assert.equal(long.maxConsecutiveLowDurationMs, 3000);
  assert.equal(long.status, 'FAIL');
});

test('short census closing FPS segments retain time weight and bridge continuous low windows', () => {
  const result = summarizeFpsPhase(
    [
      {
        fpsSamplingAvailable: 1,
        fpsSamples: [
          [0, 1000, 1000, 20, 0],
          [1000, 1500, 500, 10, 0],
          [1500, 2500, 1000, 20, 0],
          [2500, 30_000, 27_500, 1650, 0],
        ],
      },
    ],
    0,
    30_000,
  );
  assert.equal(result.shortSampleCount, 1);
  assert.equal(result.maxConsecutiveLowWindows, 2);
  assert.equal(result.maxConsecutiveLowDurationMs, 2500);
  assert.equal(result.validDurationMs, 30_000);
  assert.equal(result.status, 'FAIL');
});

test('FPS phase gaps, lifecycle boundaries, clock jumps and overlaps never manufacture a pass', () => {
  const run = (samples, start = 0, end = 10_000) =>
    summarizeFpsPhase(
      [{ fpsSamplingAvailable: 1, fpsSamples: samples }],
      start,
      end,
    );
  const boundary = run(
    [
      [0, 1000, 1000, 60, 0],
      [1000, 2000, 1000, 60, 0],
      [2000, 10_000, 8000, 480, 0],
    ],
    500,
  );
  assert.equal(boundary.boundarySampleCount, 1);
  assert.equal(boundary.validDurationMs, 9000);
  assert.equal(boundary.status, 'UNMEASURED');
  const lifecycle = run([
    [0, 8000, 8000, 480, 0],
    [8000, 10_000, 2000, 0, 1],
  ]);
  assert.equal(lifecycle.invalidLifecycleDurationMs, 2000);
  assert.equal(lifecycle.status, 'UNMEASURED');
  assert.equal(run([[0, 10_000, 5000, 300, 0]]).status, 'UNMEASURED');
  assert.equal(
    run([
      [0, 10_000, 10_000, 600, 0],
      [0, 10_000, 10_000, 600, 0],
    ]).status,
    'UNMEASURED',
  );
  const gap = run([
    [0, 1000, 1000, 20, 0],
    [1100, 2100, 1000, 20, 0],
    [2100, 10_000, 7900, 474, 0],
  ]);
  assert.equal(gap.maxConsecutiveLowWindows, 1);
  assert.equal(
    summarizeFpsPhase([{ jsFpsMin: 12 }], 0, 10_000).status,
    'UNMEASURED',
  );
});

test('legacy FPS minima cannot fail the new experience or resource acceptance', () => {
  const observed = summarizeObservedCensusWindows(
    [
      describeCensusWindow(
        {
          windowEndedAt: Date.parse(context.formalStartedAt) + 30_000,
          windowMs: 30_000,
          jsFpsMin: 12,
        },
        context.formalStartedAt,
        context.formalEndedAt,
      ),
    ],
    Date.parse(context.formalStartedAt),
    Date.parse(context.formalEndedAt),
  );
  assert.equal(observed.observedWindowThresholdFailure, false);
  const acceptance = summarizeAcceptance({
    functionalPassed: true,
    evidenceCollected: true,
    maxPositiveDriftMs: 0,
    processSummary: summarizeSamples([], context),
    nativeLog: { ...observed, windows: { last60: {} } },
    buildProvenance: { status: 'MEASURED' },
  });
  assert.equal(acceptance.experience.status, 'INCOMPLETE');
  assert.equal(acceptance.resources.status, 'INCOMPLETE');
  assert.equal(acceptance.status, 'INCOMPLETE');
  assert.equal(acceptance.legacyFpsMinimum.observedWorst.value, 12);
});

test('preserves the previous native log before a fresh app launch', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'native-log-prepare-'),
  );
  const logPath = path.join(directory, 'app-latest.log');
  try {
    fs.writeFileSync(logPath, 'previous run\n');
    preserveNativeLogBeforeLaunch({ logPath, outputDir: directory });
    assert.equal(fs.existsSync(logPath), false);
    assert.equal(
      fs.readFileSync(
        path.join(directory, 'native-log-before-run.log'),
        'utf8',
      ),
      'previous run\n',
    );
    fs.writeFileSync(logPath, 'another run\n');
    assert.throws(() =>
      preserveNativeLogBeforeLaunch({ logPath, outputDir: directory }),
    );
    assert.equal(fs.readFileSync(logPath, 'utf8'), 'another run\n');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects native logger rotation that leaves no active log', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'native-log-stopped-'),
  );
  const logPath = path.join(directory, 'app-latest.log');
  fs.writeFileSync(logPath, 'before run\n');
  const capture = startNativeLogCapture({ logPath, outputDir: directory });
  try {
    fs.appendFileSync(logPath, 'captured\n');
    fs.renameSync(logPath, path.join(directory, 'app-rolled.log'));
    const result = await capture.stop();
    assert.equal(result.complete, false);
    assert.deepEqual(result.errors, ['native-active-log-missing']);
    assert.equal(fs.readFileSync(capture.outputPath, 'utf8'), 'captured\n');
  } finally {
    await capture.stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('captures native file rotation once without including pre-run bytes', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'native-log-rotation-'),
  );
  const logPath = path.join(directory, 'app-latest.log');
  fs.writeFileSync(logPath, 'old latest\n');
  fs.writeFileSync(path.join(directory, 'app-old.log'), 'old archive\n');
  const capture = startNativeLogCapture({ logPath, outputDir: directory });
  try {
    fs.appendFileSync(logPath, 'first RPC\n');
    fs.renameSync(logPath, path.join(directory, 'app-2026-09-22.0.log'));
    fs.writeFileSync(logPath, 'second RPC\n');
    fs.renameSync(logPath, path.join(directory, 'app-2026-09-22.1.log'));
    fs.writeFileSync(logPath, 'third RPC\n');
    const result = await capture.stop();
    assert.equal(result.complete, true);
    assert.equal(result.sources.length, 3);
    assert.equal(
      fs.readFileSync(capture.outputPath, 'utf8'),
      'first RPC\nsecond RPC\nthird RPC\n',
    );
    assert.deepEqual(await capture.stop(), result);
    assert.equal(fs.readFileSync(logPath, 'utf8'), 'third RPC\n');
  } finally {
    await capture.stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const context = {
  formalStartedAt: '2026-09-22T12:00:00.000Z',
  formalEndedAt: '2026-09-22T12:03:10.000Z',
  localUtcOffsetMinutes: 480,
};

test('only uninterrupted Home idle can satisfy post-operation CPU and RSS checks', () => {
  const samples = Array.from({ length: 70 }, (_, index) => ({
    elapsedSec: 191 + index,
    cpu: index < 10 ? 100 : 20,
    rssMB: index < 60 ? 900 : 950,
  }));
  const evaluate = (kind) => {
    const processSummary = summarizeSamples(samples, {
      ...context,
      observation: {
        kind,
        startedAt: context.formalEndedAt,
        endedAt: '2026-09-22T12:04:20.000Z',
      },
    });
    return summarizeAcceptance({
      functionalPassed: true,
      evidenceCollected: true,
      maxPositiveDriftMs: 0,
      processSummary,
      nativeLog: { windows: { last60: {}, allNetworks: null } },
      buildProvenance: { status: 'MEASURED' },
    }).checks.filter((check) => check.name.startsWith('immediateIdle'));
  };
  assert.deepEqual(
    evaluate('post-QA Home idle').map(({ name, value, status }) => ({
      name,
      value,
      status,
    })),
    [
      { name: 'immediateIdleCpuAfter10s', value: 20, status: 'PASS' },
      { name: 'immediateIdleRssAfter60s', value: 0, status: 'PASS' },
    ],
  );
  assert.ok(
    evaluate('post-diagnostic Home cooldown').every(
      (check) => check.status === 'UNMEASURED',
    ),
  );
});

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

test('census payload clock determines the measured window and overlap, not delayed logger output', () => {
  const report = describeCensusWindow(
    {
      windowEndedAt: Date.parse('2026-09-22T12:03:09.500Z'),
      loggedAt: '2026-09-22T12:03:12.000Z',
      windowMs: 30_100,
      gcCount: 777,
    },
    context.formalStartedAt,
    context.formalEndedAt,
  );
  assert.equal(report.windowStart, '2026-09-22T12:02:39.400Z');
  assert.equal(report.windowEnd, '2026-09-22T12:03:09.500Z');
  assert.equal(report.windowEndSource, 'payload windowEndedAt');
  assert.equal(report.boundaryPrecisionMs, 1);
  assert.equal(report.formalLast30OverlapMs, 29_500);
  assert.equal(report.formalLast30UncoveredMs, 500);
  assert.equal(report.matchesFormalLast30, false);
  assert.equal(report.gcCount, 777);
});

test('legacy census timing remains coarse and a suspended window does not invent a wall-clock start', () => {
  const legacy = describeCensusWindow(
    { loggedAt: '2026-09-22T12:03:00.000Z', windowMs: 30_000 },
    context.formalStartedAt,
    context.formalEndedAt,
  );
  assert.equal(legacy.windowStart, '2026-09-22T12:02:30.000Z');
  assert.equal(legacy.formalLast30OverlapMs, 20_000);
  assert.equal(legacy.boundaryPrecisionMs, 1000);
  assert.equal(legacy.matchesFormalLast30, false);
  const suspended = describeCensusWindow(
    { ...legacy, suspendedCount: 1 },
    context.formalStartedAt,
    context.formalEndedAt,
  );
  assert.equal(suspended.windowStart, null);
  assert.equal(suspended.formalLast30OverlapMs, null);
  assert.equal(suspended.matchesFormalLast30, false);
});

test('a nearest census never becomes an exact last30 acceptance sample', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heating-census-'));
  const logPath = path.join(directory, 'native.log');
  try {
    fs.writeFileSync(
      logPath,
      `20:03:12 | DEBUG : app => perf => runtimeHealthCensus : ${JSON.stringify([{ windowEndedAt: Date.parse('2026-09-22T12:03:09.500Z'), windowMs: 30_100, gcCount: 777 }])}\n`,
    );
    const nativeLog = summarizeNativeLog(logPath, context);
    assert.equal(nativeLog.lastFormalCensus.gcCount, 777);
    assert.equal(nativeLog.lastFormalCensusEndGapMs, 500);
    assert.equal(nativeLog.formalLast30Census.status, 'UNMEASURED');
    assert.equal(nativeLog.formalLast30Census.exactCensus, null);
    const acceptance = summarizeAcceptance({
      functionalPassed: true,
      evidenceCollected: true,
      maxPositiveDriftMs: 0,
      processSummary: summarizeSamples([], context),
      nativeLog,
      buildProvenance: { status: 'UNMEASURED' },
    });
    assert.equal(
      acceptance.checks.find((check) => check.name === 'gcCount').status,
      'UNMEASURED',
    );
    const exact = describeCensusWindow(
      { windowEndedAt: Date.parse(context.formalEndedAt), windowMs: 30_000 },
      context.formalStartedAt,
      context.formalEndedAt,
    );
    assert.equal(exact.matchesFormalLast30, true);
    assert.equal(exact.formalLast30OverlapMs, 30_000);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('complete census windows retain unscaled values and worst failures even when the latest window is lower', () => {
  const reports = [
    {
      windowEndedAt: Date.parse('2026-09-22T12:00:40.100Z'),
      windowMs: 30_100,
      gcCount: 700,
      jsFpsMin: 19,
    },
    {
      windowEndedAt: Date.parse('2026-09-22T12:01:10.100Z'),
      windowMs: 30_000,
      gcCount: 300,
      jsFpsMin: 60,
    },
    {
      windowEndedAt: Date.parse('2026-09-22T12:03:40.000Z'),
      windowMs: 30_000,
      gcCount: 9999,
    },
    {
      windowEndedAt: Date.parse('2026-09-22T12:02:30.000Z'),
      windowMs: 15_000,
      gcCount: 9999,
    },
    {
      windowEndedAt: Date.parse('2026-09-22T12:02:30.000Z'),
      windowMs: 30_000,
      gcCount: 9999,
      suspendedCount: 1,
    },
  ].map((report) =>
    describeCensusWindow(
      report,
      context.formalStartedAt,
      context.formalEndedAt,
    ),
  );
  const observed = summarizeObservedCensusWindows(
    reports,
    Date.parse(context.formalStartedAt),
    Date.parse(context.formalEndedAt),
  );
  assert.equal(observed.observedCompleteCensusWindows.length, 2);
  assert.equal(observed.observedWindowThresholdFailure, true);
  assert.equal(observed.observedCompleteCensusWorst.gcCount.value, 700);
  assert.equal(
    observed.observedCompleteCensusWorst.gcCount.actualDurationMs,
    30_100,
  );
  assert.equal(observed.observedCompleteCensusWorst.jsFpsMin.value, 19);
  const nativeLog = {
    ...observed,
    windows: { last60: {}, allNetworks: null },
    formalLast30Census: { exactCensus: null },
  };
  const acceptance = summarizeAcceptance({
    functionalPassed: true,
    evidenceCollected: true,
    maxPositiveDriftMs: 0,
    processSummary: summarizeSamples([], context),
    nativeLog,
    buildProvenance: { status: 'UNMEASURED' },
  });
  assert.equal(acceptance.status, 'FAIL');
  assert.equal(
    acceptance.checks.find((check) => check.name === 'gcCount').status,
    'UNMEASURED',
  );
  assert.equal(
    acceptance.checks.find(
      (check) => check.name === 'observedWindowThresholdFailure',
    ).status,
    'FAIL',
  );
  const lowOnly = summarizeObservedCensusWindows(
    [reports[1]],
    Date.parse(context.formalStartedAt),
    Date.parse(context.formalEndedAt),
  );
  assert.equal(lowOnly.observedWindowThresholdFailure, false);
  assert.equal(
    lowOnly.observedCompleteCensusWorst.gcCount.status,
    'WITHIN_OBSERVED_WINDOW_THRESHOLD',
  );
  assert.equal(
    lowOnly.observedCompleteCensusWindows[0].matchesFormalLast30,
    false,
  );
});
