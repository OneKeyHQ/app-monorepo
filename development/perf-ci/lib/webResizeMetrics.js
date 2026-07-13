const { median } = require('./metrics');

const AGGREGATED_METRICS = [
  'settleMedianMs',
  'settleP95Ms',
  'settleMaxMs',
  'taskDurationMs',
  'scriptDurationMs',
  'recalcStyleDurationMs',
  'layoutDurationMs',
  'longTaskCount',
  'longTaskTotalMs',
  'longTaskMaxMs',
  'maxFrameDurationMs',
  'slowFrameCount',
  'droppedFrameEstimate',
  'resizeEventCount',
  'heapBeforeBytes',
  'heapAfterBytes',
  'heapDeltaBytes',
];

function aggregateResizeRuns(runs) {
  const byScenario = new Map();

  for (const run of runs) {
    for (const scenario of run.scenarios || []) {
      if (!byScenario.has(scenario.name)) {
        byScenario.set(scenario.name, []);
      }
      byScenario.get(scenario.name).push(scenario.metrics);
    }
  }

  const scenarios = {};
  for (const [name, metricsList] of byScenario) {
    const summary = { runCount: metricsList.length };
    for (const metricName of AGGREGATED_METRICS) {
      summary[metricName] = median(
        metricsList.map((metrics) => metrics[metricName]),
      );
    }
    scenarios[name] = summary;
  }

  return {
    runCount: runs.length,
    scenarios,
  };
}

function relativeChange(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
  if (baseline === 0) return current === 0 ? 0 : null;
  return (current - baseline) / baseline;
}

function compareResizeSummaries({ current, baseline, thresholds }) {
  const primaryMetric = thresholds.primaryMetric || 'scriptDurationMs';
  const defaultMinimumImprovementRatio =
    thresholds.minimumImprovementRatio ?? 0.1;
  const defaultMaximumRegressionRatio =
    thresholds.maximumRegressionRatio ?? 0.05;
  const guardMetrics = thresholds.guardMetrics || [];
  const scenarioResults = {};
  const reasons = [];

  for (const [name, currentMetrics] of Object.entries(current.scenarios)) {
    const baselineMetrics = baseline.scenarios[name];
    if (!baselineMetrics) {
      reasons.push(`${name}: missing baseline scenario`);
      scenarioResults[name] = { pass: false, reason: 'missing baseline' };
    } else {
      const scenarioThresholds = thresholds.scenarios?.[name] || {};
      const mode = scenarioThresholds.mode || 'improve';
      const minimumImprovementRatio =
        scenarioThresholds.minimumImprovementRatio ??
        defaultMinimumImprovementRatio;
      const maximumRegressionRatio =
        scenarioThresholds.maximumRegressionRatio ??
        defaultMaximumRegressionRatio;
      const primaryChangeRatio = relativeChange(
        currentMetrics[primaryMetric],
        baselineMetrics[primaryMetric],
      );
      const primaryImprovementRatio =
        primaryChangeRatio === null ? null : -primaryChangeRatio;
      const primaryPass =
        primaryChangeRatio !== null &&
        (mode === 'guard'
          ? primaryChangeRatio <= maximumRegressionRatio
          : primaryImprovementRatio >= minimumImprovementRatio);

      const guards = guardMetrics.map((metricName) => {
        const changeRatio = relativeChange(
          currentMetrics[metricName],
          baselineMetrics[metricName],
        );
        const pass =
          changeRatio !== null && changeRatio <= maximumRegressionRatio;
        return {
          metricName,
          current: currentMetrics[metricName],
          baseline: baselineMetrics[metricName],
          changeRatio,
          pass,
        };
      });
      const pass = primaryPass && guards.every((guard) => guard.pass);

      if (!primaryPass) {
        const expected =
          mode === 'guard'
            ? `regression <= ${maximumRegressionRatio}`
            : `improvement >= ${minimumImprovementRatio}`;
        reasons.push(
          `${name}: ${primaryMetric} did not meet ${expected} ` +
            `(actual improvement=${primaryImprovementRatio})`,
        );
      }
      for (const guard of guards.filter((item) => !item.pass)) {
        reasons.push(
          `${name}: ${guard.metricName} regressed beyond ` +
            `${maximumRegressionRatio} (change=${guard.changeRatio})`,
        );
      }

      scenarioResults[name] = {
        pass,
        mode,
        primaryMetric,
        primaryChangeRatio,
        primaryImprovementRatio,
        minimumImprovementRatio,
        maximumRegressionRatio,
        guards,
      };
    }
  }

  return {
    triggered: reasons.length > 0,
    reasons,
    scenarios: scenarioResults,
  };
}

module.exports = {
  AGGREGATED_METRICS,
  aggregateResizeRuns,
  compareResizeSummaries,
  relativeChange,
};
