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

function formatDeltaPct(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
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
  const tzHour = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(
    2,
    '0',
  );
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
  if (!detail.enabled) {
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
  const ratioText =
    detail.enabled && detail.totalRuns
      ? `${detail.exceededRuns}/${detail.totalRuns} 次超阈`
      : '未启用';
  const deltaText = formatDeltaPct(detail.deltaPct);
  return `${icon} *${detail.label}*　${currentText} / ${thresholdText}　${deltaText}　${ratioText}`;
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
  if (!first) return '检测到性能下降。';
  const summary = [
    `${first.label} 中位数 ${formatMetricValue(
      first.key,
      first.current,
    )}，超过阈值 ${formatMetricValue(first.key, first.threshold)}，${formatDeltaPct(
      first.deltaPct,
    )}`,
  ];
  if (first.totalRuns) {
    summary.push(`（${first.exceededRuns}/${first.totalRuns} 次超阈）`);
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
  const statusZhMap = {
    regression: '性能检测',
    failed: '任务失败',
    recovered: '已恢复',
  };
  const previous = previousState?.status
    ? `上次告警状态为「${statusZhMap[previousState.status] || previousState.status}」`
    : '上次存在异常告警';
  return `本次结果已恢复正常，${previous}，当前 3 个核心指标均未超阈。`;
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

function buildContextFields(model) {
  const fields = [
    {
      type: 'mrkdwn',
      text: `*提交*\n${escapeMrkdwn(shortSha(model.commitSha))}`,
    },
    {
      type: 'mrkdwn',
      text: `*时间*\n${escapeMrkdwn(formatStartedAt(model.startedAt))}`,
    },
    {
      type: 'mrkdwn',
      text: `*任务*\n${escapeMrkdwn(model.jobId)}`,
    },
  ];
  if (model.branch) {
    fields.push({
      type: 'mrkdwn',
      text: `*分支*\n${escapeMrkdwn(model.branch)}`,
    });
  } else if (!model.links?.dashboardUrl) {
    // Only show session ID when there's no dashboard link to click
    fields.push({
      type: 'mrkdwn',
      text: `*会话 (sessionId)*\n${escapeMrkdwn(model.representativeSessionId || 'n/a')}`,
    });
  }
  return fields;
}

function buildActionText(model) {
  const items = [];
  if (model.links.perfDashboardUrl) {
    items.push(slackLink(model.links.perfDashboardUrl, '打开 Perf Dashboard'));
  }
  if (model.links.dashboardUrl) {
    items.push(slackLink(model.links.dashboardUrl, '打开 Session Dashboard'));
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
      Number.isFinite(item.current) ||
      (item.enabled && Number.isFinite(item.threshold)),
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
        ? `${detail.exceededRuns}/${detail.totalRuns} 次超阈`
        : '未启用';
      lines.push(
        `${detail.shortLabel}: ${formatMetricValue(
          detail.key,
          detail.current,
        )} / ${thresholdText} (${formatDeltaPct(detail.deltaPct)}, ${exceedText})`,
      );
    }
  }
  if (model.representativeRun) {
    lines.push(`代表运行: ${formatRunLine(model.representativeRun)}`);
  }
  if (model.diagnosisLines.length) {
    lines.push(...model.diagnosisLines);
  }
  if (model.links.reportUrl) lines.push(`report: ${model.links.reportUrl}`);
  if (model.links.perfDashboardUrl)
    lines.push(`dashboard: ${model.links.perfDashboardUrl}`);
  else if (model.links.dashboardUrl)
    lines.push(`session-dashboard: ${model.links.dashboardUrl}`);
  lines.push(`output: ${model.outputDir}`);
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

  if (model.runLines.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${model.runLines.length} 次运行对比*\n\`\`\`${model.runLines.join('\n')}\`\`\``,
      },
    });
  }

  if (model.diagnosisLines.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*定位分析*\n${escapeMrkdwn(model.diagnosisLines.join('\n'))}`,
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
    fields: buildContextFields(model),
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
    regression: `${icon} [${severity}] 性能检测 | ${targetLabel}`,
    failed: `❌ [P1] 任务失败 | ${targetLabel}`,
    recovered: `✅ [INFO] 已恢复 | ${targetLabel}`,
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
};
