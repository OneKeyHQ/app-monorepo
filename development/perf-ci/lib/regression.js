const { median, countExceed } = require('./metrics');

function pickKeyMark(derivedJson, name) {
  const entry = derivedJson?.keyMarks?.marks?.[name];
  if (!entry || typeof entry !== 'object') return null;
  return {
    count: Number(entry.count) || 0,
    first: entry.first
      ? {
          t: entry.first.t ?? null,
          sinceSessionStartMs: entry.first.sinceSessionStartMs ?? null,
        }
      : null,
    last: entry.last
      ? {
          t: entry.last.t ?? null,
          sinceSessionStartMs: entry.last.sinceSessionStartMs ?? null,
        }
      : null,
  };
}

function extractDerivedDebugMetrics(derivedJson) {
  const homeRefresh = derivedJson?.homeRefreshTokens || null;
  return {
    // Keep diagnostic context for Slack/debugging; not used for threshold judgment.
    topSlowFunctions: Array.isArray(derivedJson?.slowFunctions)
      ? derivedJson.slowFunctions.slice(0, 5)
      : [],
    homeRefreshTopFunctions: Array.isArray(homeRefresh?.topFunctions)
      ? homeRefresh.topFunctions.slice(0, 5)
      : [],
    homeRefreshJsblockMarks: Array.isArray(homeRefresh?.jsblockMarksTop)
      ? homeRefresh.jsblockMarksTop.slice(0, 3)
      : [],
    homeRefreshStorageMarks: Array.isArray(homeRefresh?.storageMarksTop)
      ? homeRefresh.storageMarksTop.slice(0, 3)
      : [],
    homeRefreshSimpledbMarks: Array.isArray(homeRefresh?.simpledbMarksTop)
      ? homeRefresh.simpledbMarksTop.slice(0, 3)
      : [],
    homeRefreshTotals:
      homeRefresh && typeof homeRefresh === 'object'
        ? {
            span: homeRefresh.span ?? null,
            startSinceSessionStartMs:
              homeRefresh.startSinceSessionStartMs ?? null,
            endSinceSessionStartMs: homeRefresh.endSinceSessionStartMs ?? null,
            totals:
              homeRefresh.totals && typeof homeRefresh.totals === 'object'
                ? {
                    functionCalls: homeRefresh.totals.functionCalls ?? null,
                    functionTotalDuration:
                      homeRefresh.totals.functionTotalDuration ?? null,
                    marks: homeRefresh.totals.marks ?? null,
                  }
                : null,
          }
        : null,
    keyMarks: derivedJson?.keyMarks
      ? {
          sessionStart: derivedJson.keyMarks.sessionStart ?? null,
          marks: {
            appStart: pickKeyMark(derivedJson, 'app:start'),
            refreshStart: pickKeyMark(derivedJson, 'Home:refresh:start:tokens'),
            refreshDone: pickKeyMark(derivedJson, 'Home:refresh:done:tokens'),
            allNetStart: pickKeyMark(
              derivedJson,
              'AllNet:useAllNetworkRequests:start',
            ),
            allNetRequestsStart: pickKeyMark(
              derivedJson,
              'AllNet:requests:start',
            ),
            allNetRequestsDone: pickKeyMark(
              derivedJson,
              'AllNet:requests:done',
            ),
            postFetchStart: pickKeyMark(
              derivedJson,
              'Home:tokens:postFetch:start',
            ),
            postFetchDone: pickKeyMark(
              derivedJson,
              'Home:tokens:postFetch:done',
            ),
          },
        }
      : null,
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
    const vals = Array.isArray(values[key]) ? values[key] : [];
    const measuredRuns = vals.filter((v) => Number.isFinite(v)).length;
    const exceededRuns = Number.isFinite(t) ? countExceed(vals, t) : 0;
    const current = agg[key];
    const delta =
      Number.isFinite(current) && Number.isFinite(t) ? current - t : null;
    const deltaPct =
      Number.isFinite(delta) && Number.isFinite(t) && t !== 0
        ? (delta / t) * 100
        : null;
    if (!Number.isFinite(t)) {
      return {
        key,
        enabled: false,
        triggered: false,
        reason: null,
        threshold: null,
        current,
        delta,
        deltaPct,
        exceededRuns,
        measuredRuns,
        totalRuns: vals.length,
        values: vals,
      };
    }
    if (strategy === 'two_of_three') {
      const triggered = exceededRuns >= 2;
      return {
        key,
        enabled: true,
        triggered,
        reason: triggered
          ? `${key} exceeded in ${exceededRuns}/${vals.length} runs`
          : null,
        threshold: t,
        current,
        delta,
        deltaPct,
        exceededRuns,
        measuredRuns,
        totalRuns: vals.length,
        values: vals,
      };
    }
    const triggered = Number.isFinite(current) && current > t;
    return {
      key,
      enabled: true,
      triggered,
      reason: triggered ? `${key} median ${current} > ${t}` : null,
      threshold: t,
      current,
      delta,
      deltaPct,
      exceededRuns,
      measuredRuns,
      totalRuns: vals.length,
      values: vals,
    };
  };

  const start = checkOne('tokensStartMs');
  const span = checkOne('tokensSpanMs');
  const fc = checkOne('functionCallCount');
  const reasons = [start.reason, span.reason, fc.reason].filter(Boolean);
  return {
    triggered: start.triggered || span.triggered || fc.triggered,
    reasons,
    strategy,
    metrics: {
      tokensStartMs: start,
      tokensSpanMs: span,
      functionCallCount: fc,
    },
  };
}

module.exports = {
  aggregateRuns,
  checkRegression,
  extractDerivedDebugMetrics,
};
