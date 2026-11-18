const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectEventTimingSummary,
  evaluateEventCountBudgets,
  evaluateFanoutBudgets,
} = require('./account-selector-perf-metrics');

test('collectEventTimingSummary includes provider latency, hook stages, and rpc overhead', () => {
  const summary = collectEventTimingSummary([
    {
      actualDuration: 8,
      event: 'providerSubtreeCommit',
      stateChanges: [
        {
          activeStateToProviderCommitMs: 20,
          selectionStateToProviderCommitMs: 12,
        },
      ],
    },
    {
      event: 'autoDeriveResult',
      stageMs: { resolveFallback: 4, syncGlobal: 9 },
      totalMs: 15,
    },
    {
      approximateRpcOverheadMs: 3,
      bgRpcMs: 11,
      bgTotalMs: 8,
      event: 'activeBuildResult',
    },
    {
      commitToPaintMs: 6,
      event: 'providerSubtreePaint',
      stateChanges: [
        {
          activeStateToPaintMs: 26,
          selectionStateToPaintMs: 18,
        },
      ],
    },
  ]);

  assert.deepEqual(
    summary.timingSummaryByEvent.providerSubtreeCommit
      .selectionStateToProviderCommitMs,
    { count: 1, max: 12, p50: 12, p95: 12 },
  );
  assert.deepEqual(
    summary.timingSummaryByEvent.providerSubtreeCommit
      .activeStateToProviderCommitMs,
    { count: 1, max: 20, p50: 20, p95: 20 },
  );
  assert.deepEqual(
    summary.timingSummaryByEvent.autoDeriveResult['stageMs.syncGlobal'],
    { count: 1, max: 9, p50: 9, p95: 9 },
  );
  assert.deepEqual(
    summary.timingSummaryByEvent.activeBuildResult.approximateRpcOverheadMs,
    { count: 1, max: 3, p50: 3, p95: 3 },
  );
  assert.deepEqual(
    summary.timingSummaryByEvent.providerSubtreePaint.selectionStateToPaintMs,
    { count: 1, max: 18, p50: 18, p95: 18 },
  );
  assert.deepEqual(
    summary.timingSummaryByEvent.providerSubtreePaint.activeStateToPaintMs,
    { count: 1, max: 26, p50: 26, p95: 26 },
  );
});

test('evaluateEventCountBudgets rejects duplicate hook executions', () => {
  const results = evaluateEventCountBudgets(
    { eventCounts: { availableNetworksRequested: 8 } },
    [{ event: 'availableNetworksRequested', limit: 6 }],
  );

  assert.deepEqual(results, [
    {
      event: 'availableNetworksRequested',
      limit: 6,
      observed: 8,
      passed: false,
    },
  ]);
});

test('evaluateFanoutBudgets rejects an update that reaches too many unique consumers', () => {
  const results = evaluateFanoutBudgets(
    {
      fanout: {
        activeReloads: { maxConsumersPerOperation: 7 },
        selectionTransitions: { maxConsumersPerOperation: 4 },
      },
    },
    [
      {
        fanout: 'activeReloads',
        field: 'maxConsumersPerOperation',
        limit: 6,
      },
      {
        fanout: 'selectionTransitions',
        field: 'maxConsumersPerOperation',
        limit: 6,
      },
    ],
  );

  assert.deepEqual(
    results.map(({ fanout, observed, passed }) => ({
      fanout,
      observed,
      passed,
    })),
    [
      { fanout: 'activeReloads', observed: 7, passed: false },
      { fanout: 'selectionTransitions', observed: 4, passed: true },
    ],
  );
});
