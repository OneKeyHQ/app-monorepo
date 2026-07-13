const path = require('path');

const { postJobAnalytics, postSessionAnalytics } = require('./analytics');
const { fileExists, readJson, writeJson } = require('./fs');
const { postSlackWebhook } = require('./slack');
const { buildPerfAlertModel, buildSlackPayload } = require('./slackPayload');

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function sanitizeKey(value) {
  return String(value || 'perf')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isLocalOnlyUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname);
  } catch {
    return true;
  }
}

function encodeUrlPath(relativePath) {
  return String(relativePath || '')
    .split(path.sep)
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function joinUrl(baseUrl, relativePath) {
  const base = trimTrailingSlash(baseUrl);
  const suffix = String(relativePath || '').replace(/^\/+/, '');
  return suffix ? `${base}/${suffix}` : base;
}

function readAlertState(filePath) {
  if (!fileExists(filePath)) return null;
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function writeAlertState(filePath, state) {
  try {
    writeJson(filePath, state);
  } catch (err) {
    // Non-critical: failing to persist alert state should never crash the runner
    // or trigger a false "FAILED" Slack notification.
    console.warn(`[perf] writeAlertState failed: ${err.message}`);
  }
}

function getAlertStatePath({ outputRoot, localConfig, targetKey }) {
  const stateRoot =
    process.env.PERF_ALERT_STATE_ROOT ||
    localConfig?.alertStateRoot ||
    path.join(outputRoot, '_alert_state');
  return path.join(stateRoot, `${sanitizeKey(targetKey)}.json`);
}

function getDashboardBaseUrl({ localConfig, serverUrl }) {
  const explicit =
    process.env.PERF_DASHBOARD_BASE_URL ||
    localConfig?.dashboardBaseUrl ||
    null;
  if (explicit) return trimTrailingSlash(explicit);
  if (serverUrl && !isLocalOnlyUrl(serverUrl)) {
    return trimTrailingSlash(serverUrl);
  }
  return null;
}

function getReportBaseUrl(localConfig) {
  const value = process.env.PERF_REPORT_BASE_URL || localConfig?.reportBaseUrl;
  return value ? trimTrailingSlash(value) : null;
}

function getPerfDashboardBaseUrl(localConfig) {
  const value =
    process.env.PERF_DASHBOARD_URL || localConfig?.perfDashboardBaseUrl;
  return value ? trimTrailingSlash(value) : null;
}

function buildLinks({
  report,
  outputRoot,
  localConfig,
  representativeSessionId,
}) {
  const links = {};
  const reportBaseUrl = getReportBaseUrl(localConfig);
  if (reportBaseUrl) {
    let relativeDir =
      report?.meta?.jobId || path.basename(report?.outputDir || '');
    if (report?.outputDir && outputRoot) {
      const relativeCandidate = path.relative(outputRoot, report.outputDir);
      if (
        relativeCandidate &&
        !relativeCandidate.startsWith('..') &&
        !path.isAbsolute(relativeCandidate)
      ) {
        relativeDir = relativeCandidate;
      }
    }
    const encoded = encodeUrlPath(relativeDir);
    if (encoded) {
      links.outputUrl = joinUrl(reportBaseUrl, encoded);
      links.reportUrl = joinUrl(reportBaseUrl, `${encoded}/report.json`);
    }
  }

  const dashboardBaseUrl = getDashboardBaseUrl({
    localConfig,
    serverUrl: report?.meta?.serverUrl,
  });
  if (dashboardBaseUrl && representativeSessionId) {
    links.dashboardUrl = `${dashboardBaseUrl}/?sessionId=${encodeURIComponent(
      representativeSessionId,
    )}`;
    links.homeRefreshUrl = `${dashboardBaseUrl}/api/sessions/${encodeURIComponent(
      representativeSessionId,
    )}/home-refresh`;
  }

  const perfDashboardBaseUrl = getPerfDashboardBaseUrl(localConfig);
  const jobId = report?.meta?.jobId;
  if (perfDashboardBaseUrl && jobId) {
    links.perfDashboardUrl = `${perfDashboardBaseUrl}/?job_id=${encodeURIComponent(jobId)}`;
  }

  return links;
}

function buildStateSnapshot(model) {
  return {
    status: model.status,
    severity: model.severity,
    signature: model.signature,
    consecutiveCount: model.consecutiveCount,
    targetKey: model.targetKey,
    targetLabel: model.targetLabel,
    commitSha: model.commitSha,
    startedAt: model.startedAt,
    jobId: model.jobId,
    representativeSessionId: model.representativeSessionId,
    summary: model.summary,
    updatedAt: new Date().toISOString(),
  };
}

async function postModelToSlack({ slackWebhookUrl, model }) {
  if (!slackWebhookUrl) return;
  const payload = buildSlackPayload(model);
  await postSlackWebhook(slackWebhookUrl, payload);
}

async function postAllSessionAnalytics({
  derivedSessions,
  analyticsUrl,
  analyticsSecret,
}) {
  if (!analyticsUrl || !Array.isArray(derivedSessions)) return;
  await Promise.allSettled(
    derivedSessions.map((s) =>
      postSessionAnalytics({
        sessionId: s.sessionId,
        derived: s.derived,
        jobId: s.jobId,
        sessionsDir: s.sessionsDir,
        platform: s.platform,
        analyticsUrl,
        analyticsSecret,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[analytics] session ingest failed:', err?.message || err);
      }),
    ),
  );
}

async function notifyPerfResult({
  report,
  outputRoot,
  slackWebhookUrl,
  localConfig,
  derivedSessions,
}) {
  const analyticsUrl =
    process.env.PERF_ANALYTICS_URL || localConfig?.analyticsUrl || null;
  const analyticsSecret =
    process.env.PERF_ANALYTICS_SECRET || localConfig?.analyticsSecret || null;

  const targetKey = report?.meta?.targetKey || 'perf';
  const alertStatePath = getAlertStatePath({
    outputRoot,
    localConfig,
    targetKey,
  });
  const previousState = readAlertState(alertStatePath);

  if (report?.regression?.triggered) {
    const draftModel = buildPerfAlertModel({
      kind: 'regression',
      report,
      previousState,
    });
    const model = {
      ...draftModel,
      links: buildLinks({
        report,
        outputRoot,
        localConfig,
        representativeSessionId: draftModel.representativeSessionId,
      }),
    };
    await postModelToSlack({ slackWebhookUrl, model }).catch(() => {});
    writeAlertState(alertStatePath, buildStateSnapshot(model));
    await postJobAnalytics({
      report,
      notifyModel: model,
      analyticsUrl,
      analyticsSecret,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        '[analytics] job ingest failed (regression):',
        err?.message || err,
      );
    });
    await postAllSessionAnalytics({
      derivedSessions,
      analyticsUrl,
      analyticsSecret,
    });
    return model;
  }

  if (
    previousState &&
    (previousState.status === 'regression' || previousState.status === 'failed')
  ) {
    const draftModel = buildPerfAlertModel({
      kind: 'recovered',
      report,
      previousState,
    });
    const model = {
      ...draftModel,
      links: buildLinks({
        report,
        outputRoot,
        localConfig,
        representativeSessionId: draftModel.representativeSessionId,
      }),
    };
    await postModelToSlack({ slackWebhookUrl, model }).catch(() => {});
    writeAlertState(alertStatePath, buildStateSnapshot(model));
    await postJobAnalytics({
      report,
      notifyModel: model,
      analyticsUrl,
      analyticsSecret,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        '[analytics] job ingest failed (recovered):',
        err?.message || err,
      );
    });
    await postAllSessionAnalytics({
      derivedSessions,
      analyticsUrl,
      analyticsSecret,
    });
    return model;
  }

  const okModel = {
    status: 'ok',
    severity: 'INFO',
    signature: 'ok',
    consecutiveCount: 1,
    targetKey,
    targetLabel: report?.meta?.targetLabel || targetKey,
    commitSha: report?.meta?.git?.sha || null,
    startedAt: report?.meta?.startedAt || null,
    jobId: report?.meta?.jobId || path.basename(report?.outputDir || 'job'),
    representativeSessionId: report?.runs?.[0]?.sessionId || null,
    summary: '当前结果正常。',
  };
  writeAlertState(alertStatePath, buildStateSnapshot(okModel));
  // Always post to analytics, even on healthy runs
  await postJobAnalytics({
    report,
    notifyModel: null,
    analyticsUrl,
    analyticsSecret,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[analytics] job ingest failed (ok):', err?.message || err);
  });
  await postAllSessionAnalytics({
    derivedSessions,
    analyticsUrl,
    analyticsSecret,
  });
  return null;
}

async function notifyPerfFailure({
  meta,
  outputDir,
  outputRoot,
  slackWebhookUrl,
  localConfig,
  errorMessage,
}) {
  const report = {
    meta: meta || {},
    outputDir,
    thresholds: {},
    agg: {},
    runs: [],
    regression: { triggered: false, reasons: [] },
  };
  const targetKey = report?.meta?.targetKey || 'perf';
  const alertStatePath = getAlertStatePath({
    outputRoot,
    localConfig,
    targetKey,
  });
  const previousState = readAlertState(alertStatePath);
  const draftModel = buildPerfAlertModel({
    kind: 'failed',
    report,
    previousState,
    errorMessage,
  });
  const model = {
    ...draftModel,
    links: buildLinks({
      report,
      outputRoot,
      localConfig,
      representativeSessionId: draftModel.representativeSessionId,
    }),
  };
  await postModelToSlack({ slackWebhookUrl, model }).catch(() => {});
  writeAlertState(alertStatePath, buildStateSnapshot(model));
  // Failures (build errors, unexpected crashes, etc.) are not uploaded to analytics.
  return model;
}

module.exports = {
  notifyPerfFailure,
  notifyPerfResult,
};
