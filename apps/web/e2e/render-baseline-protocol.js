const assert = require('node:assert/strict');

const DECISIVE_PHASE = 'background-churn';
const RETENTION_PHASE = 'selector-retention';

const GATE_METRICS = ['renderedComponents', 'commits', 'maxRenderedInCommit'];
const CHURN_GATE_METRICS = ['diagnostics.reloadsStarted'];
const WARN_ONLY_METRICS = [
  'actualDurationMs',
  'maxInteractionLatencyMs',
  'maxLongAnimationFrameMs',
  'nextPaintCommits',
  'nextPaintRenderedComponents',
  'nextPaintWallMs',
  'wallMs',
];
const CHURN_WARN_ONLY_METRICS = ['diagnostics.reloadDurationTotalMs'];
const RETENTION_WARN_ONLY_METRICS = [
  'diagnostics.retainedDocuments',
  'diagnostics.retainedDomNodes',
  'diagnostics.retainedEventListeners',
  'diagnostics.retainedJsHeapBytes',
];

function median(values) {
  assert.ok(values.length > 0, 'median requires at least one value');
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizeDistribution(values) {
  assert.ok(values.length > 0, 'distribution requires at least one value');
  const sorted = values.toSorted((left, right) => left - right);
  const center = median(sorted);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, middle);
  const upper = sorted.slice(sorted.length % 2 === 1 ? middle + 1 : middle);
  const q1 = lower.length ? median(lower) : center;
  const q3 = upper.length ? median(upper) : center;
  return {
    iqr: q3 - q1,
    mad: median(sorted.map((value) => Math.abs(value - center))),
    max: sorted[sorted.length - 1],
    median: center,
    min: sorted[0],
    q1,
    q3,
    values,
  };
}

function buildBalancedSchedule(groups) {
  assert.ok(
    Number.isInteger(groups) && groups > 0,
    `groups must be a positive integer, received ${groups}`,
  );
  const schedule = [];
  for (let group = 1; group <= groups; group += 1) {
    const targets =
      group % 2 === 1
        ? ['baseline', 'candidate', 'candidate', 'baseline']
        : ['candidate', 'baseline', 'baseline', 'candidate'];
    targets.forEach((target, index) => {
      schedule.push({
        group,
        pair: index < 2 ? 1 : 2,
        position: index + 1,
        target,
      });
    });
  }
  return schedule;
}

function phaseMetric(phase, metric) {
  if (!phase) {
    return null;
  }
  if (metric === 'actualDurationMs') {
    return phase.actualDurationAvailable === true
      ? phase.actualDurationMs?.median
      : null;
  }
  if (metric.startsWith('diagnostics.')) {
    const name = metric.slice('diagnostics.'.length);
    return phase.diagnostics?.[name]?.median ?? null;
  }
  return phase[metric]?.median ?? null;
}

function metricNamesForPhase(phaseName) {
  const metrics = [...GATE_METRICS, ...WARN_ONLY_METRICS];
  if (phaseName === DECISIVE_PHASE) {
    metrics.push(...CHURN_GATE_METRICS, ...CHURN_WARN_ONLY_METRICS);
  }
  if (phaseName === RETENTION_PHASE) {
    metrics.push(...RETENTION_WARN_ONLY_METRICS);
  }
  return metrics;
}

function stableJson(value) {
  return JSON.stringify(value);
}

function comparableConfig(artifact) {
  return {
    churnEmits: artifact.churnEmits,
    churnState: artifact.churnState,
    environment: {
      arch: artifact.environment?.arch,
      browserVersion: artifact.environment?.browserVersion,
      headless: artifact.environment?.headless,
      nodeVersion: artifact.environment?.nodeVersion,
      platform: artifact.environment?.platform,
    },
    fixture: artifact.fixture,
    iterations: artifact.iterations,
    metricsVersion: artifact.metricsVersion,
    operationWindow: artifact.operationWindow,
    quietMs: artifact.quietMs,
    retentionIterations: artifact.retentionIterations,
    scenarioMatrix: artifact.scenarioMatrix,
    scenarioProfile: artifact.scenarioProfile,
    warmupIterations: artifact.warmupIterations,
  };
}

function validateComparableMeasurements(measurements, metricsVersion) {
  const issues = [];
  if (!Array.isArray(measurements) || measurements.length < 2) {
    return ['at least two measurements are required'];
  }
  const reference = measurements[0];
  const referenceConfig = comparableConfig(reference.artifact);
  const referencePhases = reference.artifact.phases?.map(({ phase }) => phase);
  const referenceByPhase = new Map(
    reference.artifact.phases?.map((phase) => [phase.phase, phase]) || [],
  );
  if (!Array.isArray(referencePhases) || referencePhases.length === 0) {
    issues.push(`${reference.label}: phases are missing`);
    return issues;
  }

  for (const measurement of measurements) {
    const { artifact, label } = measurement;
    if (artifact.metricsVersion !== metricsVersion) {
      issues.push(
        `${label}: metricsVersion ${artifact.metricsVersion} does not match ${metricsVersion}`,
      );
    }
    const config = comparableConfig(artifact);
    for (const key of Object.keys(referenceConfig)) {
      if (stableJson(config[key]) !== stableJson(referenceConfig[key])) {
        issues.push(
          `${label}: ${key} mismatch with ${reference.label}: ` +
            `${stableJson(config[key])} vs ${stableJson(referenceConfig[key])}`,
        );
      }
    }
    const phaseNames = artifact.phases?.map(({ phase }) => phase);
    if (stableJson(phaseNames) !== stableJson(referencePhases)) {
      issues.push(
        `${label}: phase set/order ${stableJson(phaseNames)} differs from ${stableJson(referencePhases)}`,
      );
    } else {
      for (const phase of artifact.phases) {
        const referencePhase = referenceByPhase.get(phase.phase);
        if (
          phase.actualDurationAvailable !==
          referencePhase?.actualDurationAvailable
        ) {
          issues.push(
            `${label}: phase ${phase.phase} actualDuration availability differs from ${reference.label}`,
          );
        }
        for (const metric of metricNamesForPhase(phase.phase)) {
          const durationUnavailable =
            metric === 'actualDurationMs' &&
            phase.actualDurationAvailable === false;
          if (!durationUnavailable) {
            const value = phaseMetric(phase, metric);
            if (typeof value !== 'number' || !Number.isFinite(value)) {
              issues.push(
                `${label}: phase ${phase.phase} metric ${metric} is missing or non-finite`,
              );
            }
          }
        }
      }
    }
  }
  return issues;
}

function buildPairedMeasurements(measurements) {
  const byPair = new Map();
  for (const measurement of measurements) {
    const key = `${measurement.group}:${measurement.pair}`;
    const entry = byPair.get(key) || {
      group: measurement.group,
      pair: measurement.pair,
    };
    assert.equal(
      entry[measurement.target],
      undefined,
      `duplicate ${measurement.target} measurement for pair ${key}`,
    );
    entry[measurement.target] = measurement;
    byPair.set(key, entry);
  }
  const pairs = [...byPair.values()].toSorted(
    (left, right) => left.group - right.group || left.pair - right.pair,
  );
  for (const pair of pairs) {
    assert.ok(
      pair.baseline && pair.candidate,
      `pair ${pair.group}:${pair.pair} must contain baseline and candidate`,
    );
  }
  return pairs;
}

function pairedRatio(baseline, candidate) {
  if (baseline === 0) {
    return candidate === 0 ? 1 : null;
  }
  return candidate / baseline;
}

function classifyPairedChange(pairedRatioSummary, zeroBaselineRegressions = 0) {
  if (zeroBaselineRegressions > 0) {
    return {
      direction: 'regression',
      reason: 'candidate exceeded a zero baseline',
      robustInterval: null,
    };
  }
  if (!pairedRatioSummary) {
    return {
      direction: 'inconclusive',
      reason: 'paired ratios are unavailable',
      robustInterval: null,
    };
  }
  if (pairedRatioSummary.values.every((ratio) => ratio === 1)) {
    return {
      direction: 'unchanged',
      reason: 'all paired ratios equal 1',
      robustInterval: { lower: 1, upper: 1 },
    };
  }
  if (pairedRatioSummary.values.length < 3) {
    return {
      direction: 'inconclusive',
      reason: 'at least three paired samples are required',
      robustInterval: null,
    };
  }
  const robustSpread =
    2 *
    Math.max(pairedRatioSummary.mad * 1.4826, pairedRatioSummary.iqr / 1.349);
  const robustInterval = {
    lower: pairedRatioSummary.median - robustSpread,
    upper: pairedRatioSummary.median + robustSpread,
  };
  if (robustInterval.upper < 1) {
    return {
      direction: 'improvement',
      reason: 'robust interval is below 1',
      robustInterval,
    };
  }
  if (robustInterval.lower > 1) {
    return {
      direction: 'regression',
      reason: 'robust interval is above 1',
      robustInterval,
    };
  }
  return {
    direction: 'inconclusive',
    reason: 'robust interval overlaps 1',
    robustInterval,
  };
}

function aggregateMetric(pairs, phaseName, metric) {
  const samples = pairs.map((pair) => {
    const baselinePhase = pair.baseline.artifact.phases.find(
      ({ phase }) => phase === phaseName,
    );
    const candidatePhase = pair.candidate.artifact.phases.find(
      ({ phase }) => phase === phaseName,
    );
    const baseline = phaseMetric(baselinePhase, metric);
    const candidate = phaseMetric(candidatePhase, metric);
    return {
      baseline,
      candidate,
      group: pair.group,
      pair: pair.pair,
      ratio: pairedRatio(baseline, candidate),
    };
  });
  const ratios = samples
    .map(({ ratio }) => ratio)
    .filter((ratio) => typeof ratio === 'number' && Number.isFinite(ratio));
  const pairedRatioSummary = ratios.length
    ? summarizeDistribution(ratios)
    : null;
  const zeroBaselineRegressions = samples.filter(
    ({ baseline, candidate }) => baseline === 0 && candidate > 0,
  ).length;
  return {
    baseline: summarizeDistribution(samples.map(({ baseline }) => baseline)),
    candidate: summarizeDistribution(samples.map(({ candidate }) => candidate)),
    classification: classifyPairedChange(
      pairedRatioSummary,
      zeroBaselineRegressions,
    ),
    pairedRatio: pairedRatioSummary,
    samples,
    zeroBaselineRegressions,
  };
}

function aggregatePairedMeasurements(measurements) {
  const pairs = buildPairedMeasurements(measurements);
  const phaseNames = measurements[0].artifact.phases.map(({ phase }) => phase);
  return {
    classificationMethod: 'median +/- 2 * max(1.4826 * MAD, IQR / 1.349)',
    pairCount: pairs.length,
    phases: phaseNames.map((phaseName) => ({
      metrics: Object.fromEntries(
        metricNamesForPhase(phaseName).map((metric) => [
          metric,
          aggregateMetric(pairs, phaseName, metric),
        ]),
      ),
      phase: phaseName,
    })),
  };
}

function formatPercent(ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
    return 'n/a';
  }
  const percent = Math.round((ratio - 1) * 1000) / 10;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function evaluatePairedRegressionGate(aggregate, factor) {
  const failures = [];
  const warnings = [];
  const phases = [];
  for (const phase of aggregate.phases) {
    const gatedMetrics =
      phase.phase === DECISIVE_PHASE
        ? [...GATE_METRICS, ...CHURN_GATE_METRICS]
        : GATE_METRICS;
    const checks = gatedMetrics.map((metric) => {
      const result = phase.metrics[metric];
      const ratio = result.pairedRatio?.median ?? null;
      const pass =
        result.zeroBaselineRegressions === 0 &&
        typeof ratio === 'number' &&
        ratio <= factor;
      if (!pass) {
        failures.push(
          result.zeroBaselineRegressions > 0
            ? `phase ${phase.phase} ${metric}: candidate exceeded a zero baseline in ${result.zeroBaselineRegressions} paired sample(s)`
            : `phase ${phase.phase} ${metric}: paired median ratio ${ratio} (${formatPercent(ratio)}) exceeds ${factor}`,
        );
      }
      return {
        evidence: result.classification,
        metric,
        pairedMedianRatio: ratio,
        pass,
        zeroBaselineRegressions: result.zeroBaselineRegressions,
      };
    });

    const warnOnlyMetrics = [...WARN_ONLY_METRICS];
    if (phase.phase === DECISIVE_PHASE) {
      warnOnlyMetrics.push(...CHURN_WARN_ONLY_METRICS);
    }
    if (phase.phase === RETENTION_PHASE) {
      warnOnlyMetrics.push(...RETENTION_WARN_ONLY_METRICS);
    }
    for (const metric of warnOnlyMetrics) {
      const ratio = phase.metrics[metric].pairedRatio?.median;
      if (typeof ratio === 'number' && ratio > factor) {
        warnings.push(
          `phase ${phase.phase} ${metric}: paired median ratio ${ratio} (${formatPercent(ratio)}) exceeds ${factor} (warning only)`,
        );
      }
    }
    phases.push({
      checks,
      pass: checks.every(({ pass }) => pass),
      phase: phase.phase,
    });
  }
  const evidenceDirections = new Set(
    phases.flatMap(({ checks }) =>
      checks.map(({ evidence }) => evidence.direction),
    ),
  );
  let evidenceStatus = 'unchanged';
  if (failures.length > 0) {
    evidenceStatus = 'regression';
  } else if (evidenceDirections.has('regression')) {
    evidenceStatus = 'regression-signal';
  } else if (evidenceDirections.has('inconclusive')) {
    evidenceStatus = 'inconclusive';
  } else if (evidenceDirections.has('improvement')) {
    evidenceStatus = 'improvement';
  }
  return {
    evidenceStatus,
    factor,
    failures,
    pass: failures.length === 0,
    phases,
    warnings,
  };
}

module.exports = {
  CHURN_GATE_METRICS,
  DECISIVE_PHASE,
  GATE_METRICS,
  RETENTION_PHASE,
  aggregatePairedMeasurements,
  buildBalancedSchedule,
  buildPairedMeasurements,
  classifyPairedChange,
  evaluatePairedRegressionGate,
  formatPercent,
  median,
  phaseMetric,
  summarizeDistribution,
  validateComparableMeasurements,
};
