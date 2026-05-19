const path = require('path');

const METRIC_CONFIG = [
  {
    key: 'tokensStartMs',
    label: '启动延迟 (tokensStartMs)',
    shortLabel: 'start',
    unit: 'ms',
    isCount: false,
  },
  {
    key: 'tokensSpanMs',
    label: 'Refresh 耗时 (tokensSpanMs)',
    shortLabel: 'span',
    unit: 'ms',
    isCount: false,
  },
  {
    key: 'functionCallCount',
    label: '函数调用次数 (functionCallCount)',
    shortLabel: 'calls',
    unit: '',
    isCount: true,
  },
];

function roundMetricValue(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function formatMetricValue(key, value) {
  const config = METRIC_CONFIG.find((item) => item.key === key);
  if (!config) return Number.isFinite(value) ? String(value) : 'n/a';
  const rounded = roundMetricValue(value);
  if (!Number.isFinite(rounded)) return 'n/a';
  return config.unit ? `${rounded}${config.unit}` : String(rounded);
}

function formatStartedAt(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick(
    'hour',
  )}:${pick('minute')}:${pick('second')} UTC+08:00`;
}

function shortSha(sha) {
  if (!sha) return 'n/a';
  return String(sha).slice(0, 7);
}

function escapeMrkdwn(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function slackLink(url, label) {
  if (!url || !label) return null;
  return `<${url}|${escapeMrkdwn(label)}>`;
}

function getMetricDetails(report) {
  const fromRegression = report?.regression?.metrics || {};
  return METRIC_CONFIG.map((config) => {
    const detail = fromRegression[config.key] || {};
    return {
      ...config,
      enabled: detail.enabled !== false,
      triggered: Boolean(detail.triggered),
      current: detail.current ?? report?.agg?.[config.key] ?? null,
      threshold: detail.threshold ?? report?.thresholds?.[config.key] ?? null,
      delta: detail.delta ?? null,
      deltaPct: detail.deltaPct ?? null,
      exceededRuns: Number(detail.exceededRuns) || 0,
      measuredRuns: Number(detail.measuredRuns) || 0,
      totalRuns: Number(detail.totalRuns) || (report?.runs || []).length,
      values: Array.isArray(detail.values) ? detail.values : [],
    };
  });
}

function buildMetricLine(detail) {
  let icon;
  if (detail.enabled !== true) {
    icon = '➖';
  } else if (detail.triggered) {
    icon = '🔴';
  } else {
    icon = '✅';
  }
  const currentText = formatMetricValue(detail.key, detail.current);
  const thresholdText = detail.enabled
    ? formatMetricValue(detail.key, detail.threshold)
    : 'n/a';
  return `${icon} *${detail.label}*  ${currentText} / ${thresholdText}`;
}

function pickRepresentativeRun(report, metricDetails) {
  const runs = Array.isArray(report?.runs) ? report.runs : [];
  if (!runs.length) return null;
  const scored = runs.map((run) => {
    let score = 0;
    for (const detail of metricDetails) {
      const current = Number(detail.current);
      const value = Number(run?.metrics?.[detail.key]);
      if (Number.isFinite(current) && Number.isFinite(value)) {
        const scale =
          Number.isFinite(detail.threshold) && detail.threshold > 0
            ? detail.threshold
            : Math.max(Math.abs(current), 1);
        score += Math.abs(value - current) / scale;
      }
    }
    return { run, score };
  });
  scored.sort((a, b) => a.score - b.score || a.run.runIndex - b.run.runIndex);
  return scored[0]?.run || runs[0];
}

function summarizeFunction(item) {
  if (!item || typeof item !== 'object') return null;
  const name = item.name || 'anonymous';
  const total = formatMetricValue('tokensSpanMs', item.total);
  const count = Number.isFinite(item.count) ? Math.round(item.count) : null;
  return count ? `${name} ${total} / ${count} 次` : `${name} ${total}`;
}

function summarizeMark(item) {
  if (!item || typeof item !== 'object') return null;
  const name = item.name || 'unknown';
  const duration = formatMetricValue('tokensSpanMs', item.duration);
  return `${name} ${duration}`;
}

function pickMarkSinceSessionStart(keyMarks, name) {
  const since =
    keyMarks?.marks?.[name]?.first?.sinceSessionStartMs ??
    keyMarks?.marks?.[name]?.last?.sinceSessionStartMs;
  return Number.isFinite(since) ? since : null;
}

function buildMilestoneSummary(run) {
  const keyMarks = run?.metrics?.keyMarks;
  if (!keyMarks || typeof keyMarks !== 'object') return null;
  const candidates = [
    ['appStart', 'app:start'],
    ['allNetStart', 'AllNet:useAllNetworkRequests:start'],
    ['allNetRequestsStart', 'AllNet:requests:start'],
    ['allNetRequestsDone', 'AllNet:requests:done'],
    ['postFetchStart', 'Home:tokens:postFetch:start'],
    ['postFetchDone', 'Home:tokens:postFetch:done'],
    ['refreshStart', 'Home:refresh:start:tokens'],
    ['refreshDone', 'Home:refresh:done:tokens'],
  ];
  const parts = [];
  for (const [key, label] of candidates) {
    const value = pickMarkSinceSessionStart(keyMarks, key);
    if (Number.isFinite(value)) {
      parts.push(`${label}=${formatMetricValue('tokensStartMs', value)}`);
    }
  }
  return parts.length ? parts.slice(0, 5).join(' | ') : null;
}

function buildInference(metricDetails) {
  const startTriggered = metricDetails.find(
    (item) => item.key === 'tokensStartMs',
  )?.triggered;
  const spanTriggered = metricDetails.find(
    (item) => item.key === 'tokensSpanMs',
  )?.triggered;
  const fcTriggered = metricDetails.find(
    (item) => item.key === 'functionCallCount',
  )?.triggered;

  if (startTriggered && !spanTriggered && !fcTriggered) {
    return '初步判断：问题出在启动阶段（Home refresh 开始前）';
  }
  if (!startTriggered && spanTriggered && !fcTriggered) {
    return '初步判断：问题出在 Home refresh 执行阶段';
  }
  if (!startTriggered && !spanTriggered && fcTriggered) {
    return '初步判断：函数调用次数增多，非单次执行变慢';
  }
  if (startTriggered && spanTriggered) {
    return '初步判断：启动阶段与 Home refresh 执行阶段均出现明显变慢';
  }
  return null;
}

function buildDiagnosisLines(report, representativeRun, metricDetails) {
  const lines = [];
  const inference = buildInference(metricDetails);
  if (inference) lines.push(inference);

  const milestones = buildMilestoneSummary(representativeRun);
  if (milestones) lines.push(`各阶段耗时：${milestones}`);

  const refreshTopFunctions = Array.isArray(
    representativeRun?.metrics?.homeRefreshTopFunctions,
  )
    ? representativeRun.metrics.homeRefreshTopFunctions
    : [];
  const slowFunctions = Array.isArray(
    representativeRun?.metrics?.topSlowFunctions,
  )
    ? representativeRun.metrics.topSlowFunctions
    : [];
  const topFunctions = (
    refreshTopFunctions.length ? refreshTopFunctions : slowFunctions
  )
    .map(summarizeFunction)
    .filter(Boolean)
    .slice(0, 3);
  if (topFunctions.length) {
    lines.push(`最慢的调用：${topFunctions.join(' | ')}`);
  }

  const jsblock = representativeRun?.metrics?.homeRefreshJsblockMarks?.[0];
  const storage = representativeRun?.metrics?.homeRefreshStorageMarks?.[0];
  const simpledb = representativeRun?.metrics?.homeRefreshSimpledbMarks?.[0];
  const marks = [
    summarizeMark(jsblock),
    summarizeMark(storage),
    summarizeMark(simpledb),
  ]
    .filter(Boolean)
    .slice(0, 2);
  if (marks.length) {
    lines.push(`其他耗时：${marks.join(' | ')}`);
  }

  if (!lines.length && report?.regression?.reasons?.length) {
    lines.push(`超阈原因：${report.regression.reasons.join(' ; ')}`);
  }

  return lines.slice(0, 4);
}

function buildRegressionSummary(metricDetails) {
  const triggered = metricDetails.filter((item) => item.triggered);
  if (!triggered.length) return '检测到性能回归。';
  return `性能回归：${triggered
    .map(
      (item) =>
        `${item.label} ${formatMetricValue(item.key, item.current)} / ${formatMetricValue(item.key, item.threshold)}`,
    )
    .join(' | ')}`;
}

function buildRecoverySummary(metricDetails, previousState) {
  const currentOk = metricDetails.every((item) => item.triggered !== true);
  if (!currentOk) return '当前结果仍未恢复正常。';
  const previous = previousState?.status
    ? `上次状态：${previousState.status}`
    : '上一轮存在异常';
  return `已恢复正常。${previous}`;
}

function getSeverity(kind, metricDetails) {
  if (kind === 'failed') return 'P1';
  if (kind === 'recovered') return 'INFO';
  const triggered = metricDetails.filter((item) => item.triggered);
  if (!triggered.length) return 'INFO';
  const severeTimeRegression = triggered.some(
    (item) =>
      (item.key === 'tokensStartMs' || item.key === 'tokensSpanMs') &&
      Number.isFinite(item.deltaPct) &&
      item.deltaPct >= 20,
  );
  const fullyExceeded = triggered.some(
    (item) => item.totalRuns > 0 && item.exceededRuns === item.totalRuns,
  );
  if (severeTimeRegression || fullyExceeded || triggered.length >= 2) {
    return 'P1';
  }
  return 'P2';
}

function buildSignature(kind, metricDetails) {
  if (kind === 'failed') return 'failed';
  if (kind === 'recovered') return 'recovered';
  const triggered = metricDetails
    .filter((item) => item.triggered)
    .map((item) => item.key)
    .toSorted();
  return `${kind}:${triggered.join(',') || 'none'}`;
}

function buildContextLine(model) {
  const parts = [
    `端: ${model.targetLabel || 'n/a'}`,
    `开始时间: ${formatStartedAt(model.startedAt)}`,
    `Git: ${model.branch || 'n/a'} @ ${shortSha(model.commitSha)}`,
  ];
  return escapeMrkdwn(parts.join(' | '));
}

function buildActionText(model) {
  const items = [];
  if (model.links.perfDashboardUrl) {
    items.push(slackLink(model.links.perfDashboardUrl, 'Perf Dashboard'));
  }
  if (model.links.dashboardUrl) {
    items.push(slackLink(model.links.dashboardUrl, 'Session Dashboard'));
  }
  if (model.links.reportUrl) {
    items.push(slackLink(model.links.reportUrl, 'report.json'));
  }
  if (!items.length) return null;
  return items.filter(Boolean).join(' | ');
}

function buildFallbackText(model) {
  const lines = [];
  lines.push(model.title);
  lines.push(model.summary);
  if (model.metricDetails.length) {
    lines.push('指标监控:');
    for (const detail of model.metricDetails) {
      lines.push(buildMetricLine(detail).replace(/\*/g, ''));
    }
  }
  if (model.errorSummary) lines.push(`失败原因: ${model.errorSummary}`);
  lines.push(buildContextLine(model));
  const actionText = buildActionText(model);
  if (actionText) lines.push(`链接: ${actionText}`);
  return lines.join('\n');
}

function buildSlackPayload(model) {
  const hasMetricData = model.metricDetails.some(
    (item) =>
      Number.isFinite(item.current) ||
      (item.enabled && Number.isFinite(item.threshold)),
  );
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: model.title,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: escapeMrkdwn(model.summary).slice(0, 2900),
      },
    },
  ];

  if (hasMetricData) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*指标监控*\n${model.metricDetails.map(buildMetricLine).join('\n')}`,
      },
    });
  }

  if (model.errorSummary) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*失败原因*\n\`${escapeMrkdwn(model.errorSummary)}\``,
      },
    });
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: buildContextLine(model),
    },
  });

  const actionText = buildActionText(model);
  if (actionText) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*相关链接*\n${actionText}`,
      },
    });
  }

  return {
    text: buildFallbackText(model),
    blocks,
  };
}

function buildPerfAlertModel({
  kind,
  report,
  previousState = null,
  links = {},
  errorMessage = null,
}) {
  const targetLabel = report?.meta?.targetLabel || 'Perf Guard';
  const jobId =
    report?.meta?.jobId || path.basename(report?.outputDir || 'job');
  const metricDetails = getMetricDetails(report);
  const representativeRun = pickRepresentativeRun(report, metricDetails);
  const severity = getSeverity(kind, metricDetails);
  const signature = buildSignature(kind, metricDetails);
  const consecutiveCount =
    previousState &&
    previousState.status === kind &&
    previousState.signature === signature
      ? Number(previousState.consecutiveCount || 0) + 1
      : 1;

  const severityIcon = { P1: '🔴', P2: '🟡', INFO: '🟢' };
  const icon = severityIcon[severity] || '';
  const titleMap = {
    regression: `${icon} Perf 回归 | ${targetLabel}`,
    failed: `❌ Perf 失败 | ${targetLabel}`,
    recovered: `✅ Perf 恢复 | ${targetLabel}`,
  };
  const failedErrorSnippet = errorMessage
    ? String(errorMessage).split('\n').find(Boolean) || String(errorMessage)
    : '未提供错误详情';
  const summaryMap = {
    regression: buildRegressionSummary(metricDetails),
    failed: `任务执行失败，${failedErrorSnippet.slice(0, 200)}。`,
    recovered: buildRecoverySummary(metricDetails, previousState),
  };

  const diagnosisLines =
    kind === 'failed'
      ? []
      : buildDiagnosisLines(report, representativeRun, metricDetails);
  if (consecutiveCount > 1 && kind !== 'recovered') {
    diagnosisLines.unshift(`同一问题已连续触发 ${consecutiveCount} 次。`);
  }

  const errorSummary =
    kind === 'failed' && errorMessage
      ? String(errorMessage).split('\n').find(Boolean) || String(errorMessage)
      : null;

  return {
    kind,
    status: kind,
    severity,
    signature,
    consecutiveCount,
    title: titleMap[kind] || `[INFO] 性能告警 | ${targetLabel}`,
    summary: summaryMap[kind] || 'Perf 状态已更新。',
    metricDetails,
    diagnosisLines,
    errorSummary,
    targetKey: report?.meta?.targetKey || targetLabel.toLowerCase(),
    targetLabel,
    startedAt: report?.meta?.startedAt || null,
    commitSha: report?.meta?.git?.sha || null,
    branch: report?.meta?.git?.branch || null,
    jobId,
    representativeRun,
    representativeSessionId: representativeRun?.sessionId || null,
    links,
  };
}

module.exports = {
  buildPerfAlertModel,
  buildSlackPayload,
};
