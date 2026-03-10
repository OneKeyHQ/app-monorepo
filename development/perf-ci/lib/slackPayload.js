const path = require('path');

const METRIC_CONFIG = [
  {
    key: 'tokensStartMs',
    label: 'tokensStartMs',
    shortLabel: 'start',
    unit: 'ms',
    isCount: false,
  },
  {
    key: 'tokensSpanMs',
    label: 'tokensSpanMs',
    shortLabel: 'span',
    unit: 'ms',
    isCount: false,
  },
  {
    key: 'functionCallCount',
    label: 'functionCallCount',
    shortLabel: 'functionCalls',
    unit: '',
    isCount: true,
  },
];

function roundMetricValue(value, { isCount = false } = {}) {
  if (!Number.isFinite(value)) return null;
  if (isCount) return Math.round(value);
  return Math.round(value);
}

function formatMetricValue(key, value) {
  const config = METRIC_CONFIG.find((item) => item.key === key);
  if (!config) return Number.isFinite(value) ? String(value) : 'n/a';
  const rounded = roundMetricValue(value, { isCount: config.isCount });
  if (!Number.isFinite(rounded)) return 'n/a';
  return config.unit ? `${rounded}${config.unit}` : String(rounded);
}

function formatDeltaPct(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return Number(value).toLocaleString('en-US');
}

function formatStartedAt(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const tzHour = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0');
  const tzMin = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC${sign}${tzHour}:${tzMin}`;
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
      current:
        detail.current ?? report?.agg?.[config.key] ?? report?.values?.[config.key],
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

function buildMetricField(detail) {
  const ratio =
    detail.enabled && detail.totalRuns
      ? `${detail.exceededRuns}/${detail.totalRuns} exceed`
      : 'not used';
  const thresholdText = detail.enabled
    ? formatMetricValue(detail.key, detail.threshold)
    : 'n/a';
  return {
    type: 'mrkdwn',
    text: [
      `*${detail.label}*`,
      `${formatMetricValue(detail.key, detail.current)} / ${thresholdText}`,
      `${formatDeltaPct(detail.deltaPct)} | ${ratio}`,
    ].join('\n'),
  };
}

function pickRepresentativeRun(report, metricDetails) {
  const runs = Array.isArray(report?.runs) ? report.runs : [];
  if (!runs.length) return null;
  const scored = runs.map((run) => {
    let score = 0;
    for (const detail of metricDetails) {
      const current = Number(detail.current);
      const value = Number(run?.metrics?.[detail.key]);
      if (!Number.isFinite(current) || !Number.isFinite(value)) continue;
      const scale =
        Number.isFinite(detail.threshold) && detail.threshold > 0
          ? detail.threshold
          : Math.max(Math.abs(current), 1);
      score += Math.abs(value - current) / scale;
    }
    return { run, score };
  });
  scored.sort((a, b) => a.score - b.score || a.run.runIndex - b.run.runIndex);
  return scored[0]?.run || runs[0];
}

function formatRunLine(run) {
  const metrics = run?.metrics || {};
  return `#${run?.runIndex ?? '?'} ${run?.sessionId || 'n/a'}  start=${formatMetricValue(
    'tokensStartMs',
    metrics.tokensStartMs,
  )}  span=${formatMetricValue(
    'tokensSpanMs',
    metrics.tokensSpanMs,
  )}  fc=${formatMetricValue('functionCallCount', metrics.functionCallCount)}`;
}

function summarizeFunction(item) {
  if (!item || typeof item !== 'object') return null;
  const name = item.name || 'anonymous';
  const total = formatMetricValue('tokensSpanMs', item.total);
  const count = Number.isFinite(item.count) ? Math.round(item.count) : null;
  return count ? `${name} ${total}/${count} calls` : `${name} ${total}`;
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
    return '推断: 回归更像发生在 Home:refresh:start:tokens 之前的启动/初始化阶段。';
  }
  if (!startTriggered && spanTriggered && !fcTriggered) {
    return '推断: 回归集中在 Home refresh span 内部。';
  }
  if (!startTriggered && !spanTriggered && fcTriggered) {
    return '推断: 更像是调用次数膨胀或重复渲染，而不是单次耗时拉长。';
  }
  if (startTriggered && spanTriggered) {
    return '推断: 启动前准备和 refresh span 内部都出现了明显变慢。';
  }
  return null;
}

function buildDiagnosisLines(report, representativeRun, metricDetails) {
  const lines = [];
  const inference = buildInference(metricDetails);
  if (inference) lines.push(inference);

  const milestones = buildMilestoneSummary(representativeRun);
  if (milestones) lines.push(`关键里程碑: ${milestones}`);

  const refreshTopFunctions = Array.isArray(
    representativeRun?.metrics?.homeRefreshTopFunctions,
  )
    ? representativeRun.metrics.homeRefreshTopFunctions
    : [];
  const slowFunctions = Array.isArray(representativeRun?.metrics?.topSlowFunctions)
    ? representativeRun.metrics.topSlowFunctions
    : [];
  const topFunctions = (refreshTopFunctions.length
    ? refreshTopFunctions
    : slowFunctions
  )
    .map(summarizeFunction)
    .filter(Boolean)
    .slice(0, 3);
  if (topFunctions.length) {
    lines.push(`热点函数: ${topFunctions.join(' | ')}`);
  }

  const jsblock = representativeRun?.metrics?.homeRefreshJsblockMarks?.[0];
  const storage = representativeRun?.metrics?.homeRefreshStorageMarks?.[0];
  const simpledb = representativeRun?.metrics?.homeRefreshSimpledbMarks?.[0];
  const marks = [summarizeMark(jsblock), summarizeMark(storage), summarizeMark(simpledb)]
    .filter(Boolean)
    .slice(0, 2);
  if (marks.length) {
    lines.push(`附加热点: ${marks.join(' | ')}`);
  }

  if (!lines.length && report?.regression?.reasons?.length) {
    lines.push(`触发原因: ${report.regression.reasons.join(' ; ')}`);
  }

  return lines.slice(0, 4);
}

function buildHealthyMetricsSummary(metricDetails) {
  return metricDetails
    .filter((item) => !item.triggered)
    .map(
      (item) =>
        `${item.label} ${formatMetricValue(item.key, item.current)} 正常`,
    )
    .slice(0, 2)
    .join('，');
}

function buildRegressionSummary(metricDetails) {
  const triggered = metricDetails.filter((item) => item.triggered);
  const first = triggered[0];
  if (!first) return '检测到性能回归。';
  const summary = [
    `${first.label} 中位数 ${formatMetricValue(
      first.key,
      first.current,
    )}，超过阈值 ${formatMetricValue(first.key, first.threshold)}，${formatDeltaPct(
      first.deltaPct,
    )}`,
  ];
  if (first.totalRuns) {
    summary.push(`（${first.exceededRuns}/${first.totalRuns} runs 超阈）`);
  }
  const rest = triggered.slice(1).map((item) => item.label);
  if (rest.length) {
    summary.push(`；同时 ${rest.join('、')} 也触发。`);
  } else {
    summary.push('。');
  }
  const healthy = buildHealthyMetricsSummary(metricDetails);
  if (healthy) summary.push(` ${healthy}。`);
  return summary.join('');
}

function buildRecoverySummary(metricDetails, previousState) {
  const currentOk = metricDetails.every((item) => !item.triggered);
  if (!currentOk) return '当前结果仍未恢复正常。';
  const previous = previousState?.status
    ? `上一条状态为 ${String(previousState.status).toUpperCase()}`
    : '上一条存在异常告警';
  return `本次结果恢复正常，${previous}，当前 3 个核心指标均未超阈。`;
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
    .sort();
  return `${kind}:${triggered.join(',') || 'none'}`;
}

function buildContextFields(model) {
  return [
    {
      type: 'mrkdwn',
      text: `*commit*\n${escapeMrkdwn(shortSha(model.commitSha))}`,
    },
    {
      type: 'mrkdwn',
      text: `*time*\n${escapeMrkdwn(formatStartedAt(model.startedAt))}`,
    },
    {
      type: 'mrkdwn',
      text: `*job*\n${escapeMrkdwn(model.jobId)}`,
    },
    {
      type: 'mrkdwn',
      text: `*session*\n${escapeMrkdwn(model.representativeSessionId || 'n/a')}`,
    },
  ];
}

function buildActionText(model) {
  const items = [];
  if (model.links.dashboardUrl) {
    items.push(slackLink(model.links.dashboardUrl, '打开 Dashboard'));
  }
  if (model.links.outputUrl) {
    items.push(slackLink(model.links.outputUrl, '打开产物目录'));
  }
  if (model.links.reportUrl) {
    items.push(slackLink(model.links.reportUrl, '查看 report.json'));
  }
  if (model.links.homeRefreshUrl) {
    items.push(slackLink(model.links.homeRefreshUrl, '查看 home-refresh API'));
  }
  if (!items.length) return null;
  return items.filter(Boolean).join(' | ');
}

function buildFallbackText(model) {
  const hasMetricData = model.metricDetails.some(
    (item) =>
      Number.isFinite(item.current) || (item.enabled && Number.isFinite(item.threshold)),
  );
  const lines = [];
  lines.push(model.title);
  lines.push(model.summary);
  if (hasMetricData) {
    for (const detail of model.metricDetails) {
      const thresholdText = detail.enabled
        ? formatMetricValue(detail.key, detail.threshold)
        : 'n/a';
      const exceedText = detail.enabled
        ? `${detail.exceededRuns}/${detail.totalRuns} exceed`
        : 'not used';
      lines.push(
        `${detail.shortLabel}: ${formatMetricValue(
          detail.key,
          detail.current,
        )} / ${thresholdText} (${formatDeltaPct(detail.deltaPct)}, ${exceedText})`,
      );
    }
  }
  if (model.representativeRun) {
    lines.push(`代表 run: ${formatRunLine(model.representativeRun)}`);
  }
  if (model.diagnosisLines.length) {
    lines.push(...model.diagnosisLines);
  }
  if (model.links.reportUrl) lines.push(`report: ${model.links.reportUrl}`);
  if (model.links.dashboardUrl) lines.push(`dashboard: ${model.links.dashboardUrl}`);
  lines.push(`output: ${model.outputDir}`);
  return lines.join('\n');
}

function buildSlackPayload(model) {
  const hasMetricData = model.metricDetails.some(
    (item) =>
      Number.isFinite(item.current) || (item.enabled && Number.isFinite(item.threshold)),
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
        text: escapeMrkdwn(model.summary),
      },
    },
  ];

  if (hasMetricData) {
    blocks.push({
      type: 'section',
      fields: model.metricDetails.map(buildMetricField),
    });
  }

  if (model.runLines.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*3-run 稳定性*\n\`\`\`${model.runLines.join('\n')}\`\`\``,
      },
    });
  }

  if (model.diagnosisLines.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*定位摘要*\n${escapeMrkdwn(model.diagnosisLines.join('\n'))}`,
      },
    });
  }

  if (model.errorSummary) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*失败摘要*\n\`${escapeMrkdwn(model.errorSummary)}\``,
      },
    });
  }

  blocks.push({
    type: 'section',
    fields: buildContextFields(model),
  });

  const actionText = buildActionText(model);
  if (actionText) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Links*\n${actionText}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: escapeMrkdwn(`output: ${model.outputDir}`),
      },
    ],
  });

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
  const jobId = report?.meta?.jobId || path.basename(report?.outputDir || 'job');
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

  const titleMap = {
    regression: `[${severity}] Perf Regression | ${targetLabel}`,
    failed: `[${severity}] Perf Job Failed | ${targetLabel}`,
    recovered: `[INFO] Perf Recovered | ${targetLabel}`,
  };
  const summaryMap = {
    regression: buildRegressionSummary(metricDetails),
    failed: `任务执行失败，${errorMessage || '未提供错误详情'}。`,
    recovered: buildRecoverySummary(metricDetails, previousState),
  };

  const diagnosisLines =
    kind === 'failed'
      ? []
      : buildDiagnosisLines(report, representativeRun, metricDetails);
  if (consecutiveCount > 1 && kind !== 'recovered') {
    diagnosisLines.unshift(`连续第 ${consecutiveCount} 次出现相同告警签名。`);
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
    title: titleMap[kind] || `[INFO] Perf Alert | ${targetLabel}`,
    summary: summaryMap[kind] || 'Perf 状态已更新。',
    metricDetails,
    diagnosisLines,
    errorSummary,
    targetKey: report?.meta?.targetKey || targetLabel.toLowerCase(),
    targetLabel,
    startedAt: report?.meta?.startedAt || null,
    commitSha: report?.meta?.git?.sha || null,
    jobId,
    outputDir: report?.outputDir || 'n/a',
    representativeRun,
    representativeSessionId: representativeRun?.sessionId || null,
    runLines: (report?.runs || []).map(formatRunLine).slice(0, 5),
    links,
  };
}

module.exports = {
  buildPerfAlertModel,
  buildSlackPayload,
  formatMetricValue,
  formatStartedAt,
  shortSha,
};
