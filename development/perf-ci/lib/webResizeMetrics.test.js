const {
  aggregateResizeRuns,
  compareResizeSummaries,
  relativeChange,
} = require('./webResizeMetrics');

function scenario(name, scriptDurationMs, taskDurationMs) {
  return {
    name,
    metrics: {
      scriptDurationMs,
      taskDurationMs,
    },
  };
}

describe('webResizeMetrics', () => {
  test('aggregates scenario medians across runs', () => {
    const summary = aggregateResizeRuns([
      { scenarios: [scenario('cross-md', 30, 50)] },
      { scenarios: [scenario('cross-md', 10, 20)] },
      { scenarios: [scenario('cross-md', 20, 30)] },
    ]);

    expect(summary.runCount).toBe(3);
    expect(summary.scenarios['cross-md']).toMatchObject({
      runCount: 3,
      scriptDurationMs: 20,
      taskDurationMs: 30,
    });
  });

  test('passes improvement and control guard scenarios', () => {
    const comparison = compareResizeSummaries({
      current: {
        scenarios: {
          'control-gt-md': { scriptDurationMs: 102, taskDurationMs: 103 },
          'cross-md': { scriptDurationMs: 80, taskDurationMs: 95 },
        },
      },
      baseline: {
        scenarios: {
          'control-gt-md': { scriptDurationMs: 100, taskDurationMs: 100 },
          'cross-md': { scriptDurationMs: 100, taskDurationMs: 100 },
        },
      },
      thresholds: {
        primaryMetric: 'scriptDurationMs',
        minimumImprovementRatio: 0.1,
        maximumRegressionRatio: 0.05,
        guardMetrics: ['taskDurationMs'],
        scenarios: {
          'control-gt-md': { mode: 'guard' },
          'cross-md': { mode: 'improve' },
        },
      },
    });

    expect(comparison.triggered).toBe(false);
    expect(comparison.scenarios['control-gt-md'].pass).toBe(true);
    expect(
      comparison.scenarios['cross-md'].primaryImprovementRatio,
    ).toBeCloseTo(0.2);
  });

  test('fails a candidate that does not improve the primary scenario', () => {
    const comparison = compareResizeSummaries({
      current: {
        scenarios: {
          'cross-md': { scriptDurationMs: 95, taskDurationMs: 100 },
        },
      },
      baseline: {
        scenarios: {
          'cross-md': { scriptDurationMs: 100, taskDurationMs: 100 },
        },
      },
      thresholds: {
        primaryMetric: 'scriptDurationMs',
        minimumImprovementRatio: 0.1,
        maximumRegressionRatio: 0.05,
        guardMetrics: ['taskDurationMs'],
      },
    });

    expect(comparison.triggered).toBe(true);
    expect(comparison.scenarios['cross-md'].pass).toBe(false);
  });

  test('handles a stable zero baseline without division by zero', () => {
    expect(relativeChange(0, 0)).toBe(0);
    expect(relativeChange(1, 0)).toBeNull();
  });
});
