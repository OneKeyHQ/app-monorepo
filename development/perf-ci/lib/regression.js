const { median, countExceed } = require('./metrics');

function extractDerivedDebugMetrics(derivedJson) {
  return {
    // Keep some extra context for debugging/Slack, but do not use these for thresholds by default.
    topSlowFunctions: Array.isArray(derivedJson?.slowFunctions)
      ? derivedJson.slowFunctions.slice(0, 10)
      : [],
  };
}

function aggregateRuns(runResults) {
  const values = {
    tokensStartMs: runResults.map((r) => r?.metrics?.tokensStartMs),
    tokensSpanMs: runResults.map((r) => r?.metrics?.tokensSpanMs),
    functionCallCount: runResults.map((r) => r?.metrics?.functionCallCount),
  };

  const agg = {
    tokensStartMs: median(values.tokensStartMs),
    tokensSpanMs: median(values.tokensSpanMs),
    functionCallCount: median(values.functionCallCount),
  };

  return { values, agg };
}

function checkRegression({ thresholds, values, agg }) {
  const strategy = String(thresholds?.strategy || 'median');

  const checkOne = (key) => {
    const t = thresholds?.[key];
    if (!Number.isFinite(t)) return { triggered: false, reason: null };
    const vals = values[key];
    if (strategy === 'two_of_three') {
      const c = countExceed(vals, t);
      return c >= 2
        ? { triggered: true, reason: `${key} exceeded in ${c}/3 runs` }
        : { triggered: false, reason: null };
    }
    const m = agg[key];
    return Number.isFinite(m) && m > t
      ? { triggered: true, reason: `${key} median ${m} > ${t}` }
      : { triggered: false, reason: null };
  };

  const start = checkOne('tokensStartMs');
  const span = checkOne('tokensSpanMs');
  const fc = checkOne('functionCallCount');
  const reasons = [start.reason, span.reason, fc.reason].filter(Boolean);
  return {
    triggered: start.triggered || span.triggered || fc.triggered,
    reasons,
  };
}

module.exports = {
  aggregateRuns,
  checkRegression,
  extractDerivedDebugMetrics,
};
