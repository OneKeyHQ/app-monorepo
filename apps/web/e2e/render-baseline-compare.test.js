const assert = require('node:assert/strict');
const test = require('node:test');

const {
  aggregatePairedMeasurements,
  buildBalancedSchedule,
  classifyPairedChange,
  evaluatePairedRegressionGate,
  summarizeDistribution,
  validateComparableMeasurements,
} = require('./render-baseline-protocol');

const METRICS_VERSION = 7;

function stats(median) {
  return { max: median, median, min: median };
}

function buildPhase(phase, overrides = {}) {
  let diagnostics = {};
  if (phase === 'background-churn') {
    diagnostics = {
      reloadDurationTotalMs: stats(10),
      reloadsStarted: stats(1),
    };
  } else if (phase === 'selector-retention') {
    diagnostics = {
      retainedDocuments: stats(0),
      retainedDomNodes: stats(0),
      retainedEventListeners: stats(0),
      retainedJsHeapBytes: stats(0),
    };
  }
  const { diagnostics: diagnosticOverrides, ...phaseOverrides } = overrides;
  return {
    actualDurationAvailable: true,
    actualDurationMs: stats(5),
    commits: stats(2),
    diagnostics: { ...diagnostics, ...diagnosticOverrides },
    maxInteractionLatencyMs: stats(10),
    maxLongAnimationFrameMs: stats(10),
    maxRenderedInCommit: stats(4),
    nextPaintCommits: stats(2),
    nextPaintRenderedComponents: stats(10),
    nextPaintWallMs: stats(500),
    phase,
    renderedComponents: stats(10),
    wallMs: stats(900),
    ...phaseOverrides,
  };
}

function buildArtifact(overrides = {}) {
  return {
    churnEmits: 11,
    churnState: { accountIndex: 0, networkId: 'evm--1' },
    environment: {
      arch: 'arm64',
      browserVersion: 'Chrome/140',
      headless: true,
      nodeVersion: 'v25.2.1',
      platform: 'darwin',
    },
    fixture: { accountsPerWallet: 2, walletCount: 3 },
    instrumentation: {
      inAppAccountSelectorPerfWrapperDetected: false,
      mode: 'injection-only',
      reactDevtoolsHook: 'render-baseline-v7',
    },
    iterations: 5,
    metricsVersion: METRICS_VERSION,
    operationWindow: 'operation-to-hard-quiescence',
    phases: [
      buildPhase('account-switch'),
      buildPhase('selector-retention'),
      buildPhase('background-churn'),
    ],
    quietMs: 800,
    retentionIterations: 7,
    scenarioMatrix: [{ enabledNums: [0], sceneName: 'home' }],
    scenarioProfile: 'matrix',
    warmupIterations: 1,
    ...overrides,
  };
}

function measurement({ artifact = buildArtifact(), group, pair, target }) {
  return {
    artifact,
    group,
    label: `${target}-g${group}-p${pair}`,
    pair,
    target,
  };
}

function buildPairs({ baselineArtifact, candidateArtifact } = {}) {
  return [
    measurement({
      artifact: baselineArtifact || buildArtifact(),
      group: 1,
      pair: 1,
      target: 'baseline',
    }),
    measurement({
      artifact: candidateArtifact || buildArtifact(),
      group: 1,
      pair: 1,
      target: 'candidate',
    }),
  ];
}

test('balanced schedule alternates ABBA and BAAB groups', () => {
  assert.deepEqual(
    buildBalancedSchedule(2).map(({ target }) => target),
    [
      'baseline',
      'candidate',
      'candidate',
      'baseline',
      'candidate',
      'baseline',
      'baseline',
      'candidate',
    ],
  );
});

test('distribution reports conventional median, MAD and IQR', () => {
  assert.deepEqual(summarizeDistribution([1, 2, 4, 8]), {
    iqr: 4.5,
    mad: 1.5,
    max: 8,
    median: 3,
    min: 1,
    q1: 1.5,
    q3: 6,
    values: [1, 2, 4, 8],
  });
});

test('paired evidence is inconclusive when its robust interval crosses 1', () => {
  assert.equal(
    classifyPairedChange(summarizeDistribution([0.8, 0.82])).direction,
    'inconclusive',
  );
  assert.equal(
    classifyPairedChange(summarizeDistribution([0.9, 0.95, 1.05, 1.1]))
      .direction,
    'inconclusive',
  );
  assert.equal(
    classifyPairedChange(summarizeDistribution([0.8, 0.82, 0.84, 0.86]))
      .direction,
    'improvement',
  );
});

test('comparability rejects environment differences and missing metrics', () => {
  const candidate = buildArtifact({
    environment: {
      ...buildArtifact().environment,
      browserVersion: 'Chrome/141',
    },
    phases: [
      buildPhase('account-switch', { maxRenderedInCommit: undefined }),
      buildPhase('selector-retention'),
      buildPhase('background-churn'),
    ],
  });
  const issues = validateComparableMeasurements(
    buildPairs({ candidateArtifact: candidate }),
    METRICS_VERSION,
  );

  assert.match(issues.join('\n'), /environment mismatch/);
  assert.match(issues.join('\n'), /maxRenderedInCommit/);
});

test('comparability rejects different in-app instrumentation', () => {
  const candidate = buildArtifact({
    instrumentation: {
      ...buildArtifact().instrumentation,
      inAppAccountSelectorPerfWrapperDetected: true,
    },
  });
  const issues = validateComparableMeasurements(
    buildPairs({ candidateArtifact: candidate }),
    METRICS_VERSION,
  );

  assert.match(issues.join('\n'), /instrumentation mismatch/);
});

test('comparability rejects a missing phase instead of warning', () => {
  const candidate = buildArtifact({ phases: [buildPhase('account-switch')] });
  const issues = validateComparableMeasurements(
    buildPairs({ candidateArtifact: candidate }),
    METRICS_VERSION,
  );

  assert.match(issues.join('\n'), /phase set\/order/);
});

test('paired gate rejects redundant reload fan-out even when rendering improves', () => {
  const candidate = buildArtifact({
    phases: [
      buildPhase('account-switch'),
      buildPhase('selector-retention'),
      buildPhase('background-churn', {
        diagnostics: { reloadsStarted: stats(2) },
        renderedComponents: stats(1),
      }),
    ],
  });
  const aggregate = aggregatePairedMeasurements(
    buildPairs({ candidateArtifact: candidate }),
  );
  const verdict = evaluatePairedRegressionGate(aggregate, 1.3);

  assert.equal(verdict.pass, false);
  assert.match(verdict.failures.join('\n'), /reloadsStarted/);
});

test('paired gate hard-fails max rendered in one commit', () => {
  const candidate = buildArtifact({
    phases: [
      buildPhase('account-switch', { maxRenderedInCommit: stats(8) }),
      buildPhase('selector-retention'),
      buildPhase('background-churn'),
    ],
  });
  const aggregate = aggregatePairedMeasurements(
    buildPairs({ candidateArtifact: candidate }),
  );
  const verdict = evaluatePairedRegressionGate(aggregate, 1.3);

  assert.equal(verdict.pass, false);
  assert.match(verdict.failures.join('\n'), /maxRenderedInCommit/);
});

test('paired gate warns rather than fails on duration regression', () => {
  const candidate = buildArtifact({
    phases: [
      buildPhase('account-switch', { actualDurationMs: stats(10) }),
      buildPhase('selector-retention'),
      buildPhase('background-churn'),
    ],
  });
  const aggregate = aggregatePairedMeasurements(
    buildPairs({ candidateArtifact: candidate }),
  );
  const verdict = evaluatePairedRegressionGate(aggregate, 1.3);

  assert.equal(verdict.pass, true);
  assert.match(verdict.warnings.join('\n'), /actualDurationMs/);
});

test('paired gate does not call an undersampled small change conclusive', () => {
  const candidate = buildArtifact({
    phases: [
      buildPhase('account-switch', { renderedComponents: stats(9) }),
      buildPhase('selector-retention'),
      buildPhase('background-churn'),
    ],
  });
  const aggregate = aggregatePairedMeasurements(
    buildPairs({ candidateArtifact: candidate }),
  );
  const verdict = evaluatePairedRegressionGate(aggregate, 1.3);

  assert.equal(verdict.pass, true);
  assert.equal(verdict.evidenceStatus, 'inconclusive');
});

test('paired gate rejects non-zero candidate work against a zero baseline', () => {
  const baseline = buildArtifact({
    phases: [
      buildPhase('account-switch'),
      buildPhase('selector-retention'),
      buildPhase('background-churn', { commits: stats(0) }),
    ],
  });
  const candidate = buildArtifact({
    phases: [
      buildPhase('account-switch'),
      buildPhase('selector-retention'),
      buildPhase('background-churn', { commits: stats(1) }),
    ],
  });
  const aggregate = aggregatePairedMeasurements(
    buildPairs({ baselineArtifact: baseline, candidateArtifact: candidate }),
  );
  const verdict = evaluatePairedRegressionGate(aggregate, 1.3);

  assert.equal(verdict.pass, false);
  assert.match(verdict.failures.join('\n'), /zero baseline/);
});
