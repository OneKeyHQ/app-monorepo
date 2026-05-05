/**
 * Analytics ingestion helpers for perf-ci.
 *
 * Serializes report.json (job-level) and derived session data into payloads
 * that can be POSTed to a Cloudflare Worker backed by D1.
 *
 * Environment variables consumed by callers:
 *   PERF_ANALYTICS_URL     – base URL of the Cloudflare Worker, e.g. https://perf-analytics.example.workers.dev
 *   PERF_ANALYTICS_SECRET  – shared secret sent in x-perf-secret header
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeParseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * Read ALL mark events from a session's mark.log.
 * Returns an array of { name, ts, absoluteTime, detail } objects.
 */
function readAllMarks(sessionsDir, sessionId) {
  const markLogPath = path.join(sessionsDir, sessionId, 'mark.log');
  if (!fs.existsSync(markLogPath)) return [];

  const raw = fs.readFileSync(markLogPath, 'utf8');
  const marks = [];

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    const evt = line ? safeParseJsonLine(line) : null;
    if (evt) {
      const payload = evt.data && typeof evt.data === 'object' ? evt.data : evt;
      const name = payload?.name ?? evt?.name;
      const ts = evt?.timestamp ?? payload?.timestamp ?? null;
      const absoluteTime = evt?.absoluteTime ?? payload?.absoluteTime ?? null;
      const detail = payload?.detail ?? evt?.detail ?? null;
      const sinceSessionStartMs =
        payload?.sinceSessionStartMs ?? evt?.sinceSessionStartMs ?? null;

      if (
        typeof name === 'string' &&
        (Number.isFinite(ts) || Number.isFinite(absoluteTime))
      ) {
        marks.push({
          name,
          ts: Number.isFinite(ts) ? ts : null,
          absoluteTime: Number.isFinite(absoluteTime) ? absoluteTime : null,
          sinceSessionStartMs: Number.isFinite(sinceSessionStartMs)
            ? sinceSessionStartMs
            : null,
          detail,
        });
      }
    }
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

/**
 * Build the job-level payload from report.json (+ optional notify model for
 * severity / status fields that are computed in notify.js).
 */
function buildJobPayload(report, notifyModel) {
  const meta = report?.meta || {};
  const agg = report?.agg || {};
  const regression = report?.regression || {};
  const thresholds = report?.thresholds || {};
  const runs = Array.isArray(report?.runs) ? report.runs : [];

  // Delta / regression detail from regression.metrics (populated by notify.js)
  const rMetrics = regression?.metrics || {};
  const startMetric = rMetrics.tokensStartMs || {};
  const spanMetric = rMetrics.tokensSpanMs || {};

  const jobId = meta.jobId || path.basename(report?.outputDir || 'unknown');

  // platform from targetKey (e.g. 'ios', 'android', 'web', 'ext', 'desktop')
  // fall back to targetLabel lower-cased
  const platform =
    meta.targetKey ||
    (meta.targetLabel
      ? meta.targetLabel.toLowerCase().replace(/\s+/g, '-')
      : 'unknown');

  return {
    job_id: jobId,
    platform,
    branch: meta.git?.branch || null,
    commit_sha: meta.git?.sha || null,
    app_version: meta.appVersion || null,
    started_at: meta.startedAt
      ? new Date(meta.startedAt).getTime()
      : Date.now(),
    run_count: runs.length,

    // Aggregated metrics (median)
    start_ms: Number.isFinite(agg.tokensStartMs) ? agg.tokensStartMs : null,
    span_ms: Number.isFinite(agg.tokensSpanMs) ? agg.tokensSpanMs : null,
    fc_count: Number.isFinite(agg.functionCallCount)
      ? agg.functionCallCount
      : null,

    // Thresholds
    start_threshold: Number.isFinite(thresholds.tokensStartMs)
      ? thresholds.tokensStartMs
      : null,
    span_threshold: Number.isFinite(thresholds.tokensSpanMs)
      ? thresholds.tokensSpanMs
      : null,
    fc_threshold: Number.isFinite(thresholds.functionCallCount)
      ? thresholds.functionCallCount
      : null,

    // Regression fields – prefer notify model values (already computed) then fall back
    regression: regression.triggered ? 1 : 0,
    status: notifyModel?.status || (regression.triggered ? 'regression' : 'ok'),
    severity: notifyModel?.severity || 'INFO',
    delta_pct_start: Number.isFinite(startMetric.deltaPct)
      ? startMetric.deltaPct
      : null,
    delta_pct_span: Number.isFinite(spanMetric.deltaPct)
      ? spanMetric.deltaPct
      : null,

    // Per-run summary (minimal)
    runs: runs.map((r) => ({
      session_id: r.sessionId || null,
      run_index: r.runIndex ?? null,
      start_ms: r.metrics?.tokensStartMs ?? null,
      span_ms: r.metrics?.tokensSpanMs ?? null,
      fc_count: r.metrics?.functionCallCount ?? null,
    })),
  };
}

/**
 * Build the session-level payload from derived data + mark.log.
 *
 * @param {string}  sessionId
 * @param {object}  derived      – output of deriveSession() CLI (computeSessionDerived)
 * @param {string}  jobId
 * @param {string}  sessionsDir  – path to the sessions dir (contains <sessionId>/mark.log)
 * @param {string}  platform     – e.g. 'ios'
 */
function buildSessionPayload(sessionId, derived, jobId, sessionsDir, platform) {
  const slowFunctions = Array.isArray(derived?.slowFunctions)
    ? derived.slowFunctions.slice(0, 20)
    : [];

  const marks = readAllMarks(sessionsDir, sessionId);

  // Repeated calls (rapid repeated invocations within 100ms)
  const repeatedCalls = Array.isArray(derived?.repeatedCalls)
    ? derived.repeatedCalls.slice(0, 20).map((f) => ({
        name: f.name,
        file: f.file || null,
        module: f.module || null,
        calls: f.calls ?? null,
        total_duration_ms: Number.isFinite(f.totalDuration)
          ? Math.round(f.totalDuration)
          : null,
      }))
    : [];

  // JS thread block windows (top 5, slim shape)
  const jsblock = (() => {
    const raw = derived?.jsblock;
    if (!raw || !Array.isArray(raw.topWindows)) return null;
    return {
      minDriftMs: raw.minDriftMs ?? null,
      topWindows: raw.topWindows.slice(0, 5).map((w) => ({
        span: w.span ?? null,
        jsblock: w.jsblock
          ? { name: w.jsblock.name, duration: w.jsblock.duration }
          : null,
        topFunctions: Array.isArray(w.topFunctions)
          ? w.topFunctions.slice(0, 5).map((f) => ({
              name: f.name,
              module: f.module || null,
              p95: Number.isFinite(f.p95) ? Math.round(f.p95) : null,
              avg: Number.isFinite(f.avg) ? Math.round(f.avg) : null,
              count: f.count ?? null,
            }))
          : [],
      })),
    };
  })();

  // Low FPS windows (top 3, slim shape)
  const lowFps = (() => {
    const raw = derived?.lowFps;
    if (!raw || !Array.isArray(raw.topWindows)) return null;
    return {
      thresholdFps: raw.thresholdFps ?? null,
      topWindows: raw.topWindows.slice(0, 3).map((w) => ({
        span: w.span ?? null,
        fps: w.fps ? { min: w.fps.min, avg: w.fps.avg } : null,
        topFunctions: Array.isArray(w.topFunctions)
          ? w.topFunctions.slice(0, 5).map((f) => ({
              name: f.name,
              module: f.module || null,
              p95: Number.isFinite(f.p95) ? Math.round(f.p95) : null,
              avg: Number.isFinite(f.avg) ? Math.round(f.avg) : null,
              count: f.count ?? null,
            }))
          : [],
      })),
    };
  })();

  // Home refresh token window — top functions during the measurement span
  const homeRefresh = (() => {
    const raw = derived?.homeRefreshTokens;
    if (!raw) return null;
    return {
      startSinceSessionStartMs: raw.startSinceSessionStartMs ?? null,
      endSinceSessionStartMs: raw.endSinceSessionStartMs ?? null,
      spanMs:
        Number.isFinite(raw.startSinceSessionStartMs) &&
        Number.isFinite(raw.endSinceSessionStartMs)
          ? Math.round(
              raw.endSinceSessionStartMs - raw.startSinceSessionStartMs,
            )
          : null,
      topFunctions: Array.isArray(raw.topFunctions)
        ? raw.topFunctions.slice(0, 10).map((f) => ({
            name: f.name,
            module: f.module || null,
            p95: Number.isFinite(f.p95) ? Math.round(f.p95) : null,
            avg: Number.isFinite(f.avg) ? Math.round(f.avg) : null,
            count: f.count ?? null,
          }))
        : [],
    };
  })();

  // Key marks (slim: just first occurrence timing per mark name)
  const keyMarks = (() => {
    const raw = derived?.keyMarks;
    if (!raw || !raw.marks) return null;
    const sessionStart = Number(raw.sessionStart);
    const slim = {};
    for (const [name, info] of Object.entries(raw.marks)) {
      const t = info?.first?.t;
      slim[name] =
        Number.isFinite(t) && Number.isFinite(sessionStart)
          ? Math.round(t - sessionStart)
          : null;
    }
    return { sessionStart, marks: slim };
  })();

  return {
    job_id: jobId,
    session_id: sessionId,
    platform: platform || null,
    slow_functions: slowFunctions.map((f) => ({
      fn_name: f.name || 'unknown',
      fn_file: f.file || null,
      fn_module: f.module || null,
      call_count: Number.isFinite(f.count) ? Math.round(f.count) : null,
      total_ms: Number.isFinite(f.total) ? f.total : null,
      max_ms: Number.isFinite(f.max) ? f.max : null,
      avg_ms: Number.isFinite(f.avg) ? f.avg : null,
      p95_ms: Number.isFinite(f.p95) ? f.p95 : null,
    })),
    marks,
    repeated_calls: repeatedCalls,
    jsblock,
    low_fps: lowFps,
    home_refresh: homeRefresh,
    key_marks: keyMarks,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function postToWorker(analyticsUrl, secret, endpoint, payload) {
  const url = `${String(analyticsUrl).replace(/\/+$/, '')}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-perf-secret'] = secret;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Analytics POST to ${endpoint} failed (${res.status}): ${body}`,
    );
  }

  return res;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Post job-level data (report.json) to the analytics worker.
 * Fire-and-forget friendly: callers should `.catch(() => {})` if desired.
 */
async function postJobAnalytics({
  report,
  notifyModel = null,
  analyticsUrl,
  analyticsSecret,
}) {
  if (!analyticsUrl) return;
  const payload = buildJobPayload(report, notifyModel);
  await postToWorker(analyticsUrl, analyticsSecret, '/ingest/job', payload);
}

/**
 * Post session-level data (derived + marks) to the analytics worker.
 * Fire-and-forget friendly: callers should `.catch(() => {})` if desired.
 */
async function postSessionAnalytics({
  sessionId,
  derived,
  jobId,
  sessionsDir,
  platform,
  analyticsUrl,
  analyticsSecret,
}) {
  if (!analyticsUrl) return;
  const payload = buildSessionPayload(
    sessionId,
    derived,
    jobId,
    sessionsDir,
    platform,
  );
  await postToWorker(analyticsUrl, analyticsSecret, '/ingest/session', payload);
}

module.exports = {
  postJobAnalytics,
  postSessionAnalytics,
};
