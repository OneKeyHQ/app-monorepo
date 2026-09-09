const STATUS = Object.freeze({
  FAIL: 'FAIL',
  PASS: 'PASS',
  UNKNOWN: 'UNKNOWN',
});

const LOG_PREFIX = '[NODE_RUNTIME_INTEGRITY]';

const statusFor = (value) => {
  if (value === undefined || value === null) {
    return STATUS.UNKNOWN;
  }
  return value ? STATUS.PASS : STATUS.FAIL;
};

const combineStatuses = (statuses) => {
  if (statuses.includes(STATUS.FAIL)) {
    return STATUS.FAIL;
  }
  if (statuses.includes(STATUS.UNKNOWN)) {
    return STATUS.UNKNOWN;
  }
  return STATUS.PASS;
};

const getArray = (report, name) =>
  Array.isArray(report?.[name]) ? report[name] : null;

const getNameList = (report, name) => {
  const items = getArray(report, name);
  return items === null
    ? null
    : items.filter((item) => typeof item === 'string' && item.length > 0);
};

const driftStatus = (drifts, name) =>
  drifts === null ? STATUS.UNKNOWN : statusFor(!drifts.has(name));

const createValueCheck = (name, actual, expected) => ({
  actual,
  expected,
  name,
  status: statusFor(actual === expected),
});

function evaluateHarnessReport({
  childExitCode,
  expectedArch,
  expectedPlatform,
  fatalError = null,
  report,
}) {
  if (!report || fatalError) {
    return {
      apiChecks: [],
      canonicalDriftChecks: [],
      environmentChecks: [
        createValueCheck('Electron child exit code', childExitCode, 0),
      ],
      fatalError: fatalError ?? 'Harness report was not available',
      pass: false,
      report: report ?? null,
      updaterChecks: [],
    };
  }

  const nodeRuntimeCheckNames = getNameList(report, 'nodeRuntimeCheckNames');
  const canonicalCheckNames = getNameList(
    report,
    'canonicalNodeGlobalCheckNames',
  );
  const canonicalNameSet = new Set(canonicalCheckNames ?? []);
  const driftsBeforeRepair = getArray(report, 'driftsBeforeRepair');
  const driftsAfterRepair = getArray(report, 'driftsAfterRepair');
  const driftsAfterAppInit = getArray(report, 'driftsAfterAppInit');
  const canonicalBeforeAppLoad = getArray(
    report,
    'canonicalDriftsBeforeAppLoad',
  );
  const canonicalAfterRepair = getArray(report, 'canonicalDriftsAfterRepair');
  const canonicalAfterAppInit = getArray(report, 'canonicalDriftsAfterAppInit');
  const repairs = getArray(report, 'repairs');

  const createEmptyArrayCheck = (name, items) => ({
    actual: items?.length ?? null,
    expected: 0,
    name,
    status: items === null ? STATUS.UNKNOWN : statusFor(items.length === 0),
  });
  // These arrays are an independent fail-closed boundary. Per-API rendering
  // below is intentionally richer, but must not be the only gate: a future
  // canonical-only check name may not exist in nodeRuntimeCheckNames.
  const canonicalDriftChecks = [
    createEmptyArrayCheck(
      'Canonical drift before app load',
      canonicalBeforeAppLoad,
    ),
    createEmptyArrayCheck('Canonical drift after repair', canonicalAfterRepair),
    createEmptyArrayCheck(
      'Canonical drift after app init',
      canonicalAfterAppInit,
    ),
  ];

  const toNameSet = (items) =>
    items === null
      ? null
      : new Set(
          items
            .map((item) => (typeof item === 'string' ? item : item?.name))
            .filter((name) => typeof name === 'string' && name.length > 0),
        );
  const driftSets = {
    afterAppInit: toNameSet(driftsAfterAppInit),
    afterRepair: toNameSet(driftsAfterRepair),
    beforeRepair: toNameSet(driftsBeforeRepair),
    canonicalAfterAppInit: toNameSet(canonicalAfterAppInit),
    canonicalAfterRepair: toNameSet(canonicalAfterRepair),
    canonicalBeforeAppLoad: toNameSet(canonicalBeforeAppLoad),
    repairs: toNameSet(repairs),
  };

  const apiChecks = (nodeRuntimeCheckNames ?? []).map((name) => {
    const appLoad = driftStatus(driftSets.beforeRepair, name);
    const afterRepair = driftStatus(driftSets.afterRepair, name);
    const appInit = driftStatus(driftSets.afterAppInit, name);
    const repairAction =
      driftSets.repairs === null
        ? STATUS.UNKNOWN
        : statusFor(!driftSets.repairs.has(name));
    const canonical = canonicalNameSet.has(name)
      ? [
          driftStatus(driftSets.canonicalBeforeAppLoad, name),
          driftStatus(driftSets.canonicalAfterRepair, name),
          driftStatus(driftSets.canonicalAfterAppInit, name),
        ]
      : null;
    const statuses = [appLoad, afterRepair, appInit, repairAction];
    if (canonical) {
      statuses.push(...canonical);
    }
    return {
      afterRepair,
      appInit,
      appLoad,
      canonical,
      name,
      repairAction,
      status: combineStatuses(statuses),
    };
  });

  const environmentChecks = [
    createValueCheck('Platform', report.platform, expectedPlatform),
    createValueCheck('Architecture', report.arch, expectedArch),
    createValueCheck('Packaged Electron app', report.isPackaged, true),
    createValueCheck('Electron main process', report.processType, 'browser'),
    createValueCheck('Electron child exit code', childExitCode, 0),
    {
      actual: report.electron,
      expected: 'reported',
      name: 'Electron version',
      status: statusFor(
        typeof report.electron === 'string' && report.electron.length > 0,
      ),
    },
    {
      actual: report.node,
      expected: 'reported',
      name: 'Node version',
      status: statusFor(
        typeof report.node === 'string' && report.node.length > 0,
      ),
    },
    {
      actual: nodeRuntimeCheckNames?.length ?? null,
      expected: '> 0',
      name: 'Node API check inventory',
      status: statusFor((nodeRuntimeCheckNames?.length ?? 0) > 0),
    },
    {
      actual: canonicalCheckNames?.length ?? null,
      expected: '> 0',
      name: 'Canonical global inventory',
      status: statusFor((canonicalCheckNames?.length ?? 0) > 0),
    },
  ];

  const stagingResult = report.stagingResult;
  const updaterChecks = [
    createValueCheck('autoDownload disabled', report.autoDownload, false),
    createValueCheck(
      'checkForUpdates call count',
      report.checkForUpdatesCallCount,
      0,
    ),
    createValueCheck(
      'checkForUpdates called flag',
      report.checkForUpdatesCalled,
      false,
    ),
    createValueCheck('Staging ID call succeeded', stagingResult?.success, true),
    createValueCheck(
      'Staging ID absent before test',
      stagingResult?.beforeExists,
      false,
    ),
    createValueCheck(
      'Staging ID file created',
      stagingResult?.afterExists,
      true,
    ),
    createValueCheck('Generated ID length', stagingResult?.idLength, 36),
    createValueCheck(
      'Staging ID file byte length',
      stagingResult?.fileByteLength,
      36,
    ),
    createValueCheck(
      'Staging ID file UUID format',
      stagingResult?.fileUuidFormat,
      true,
    ),
  ];

  const allStatuses = [
    ...environmentChecks.map(({ status }) => status),
    ...canonicalDriftChecks.map(({ status }) => status),
    ...apiChecks.map(({ status }) => status),
    ...updaterChecks.map(({ status }) => status),
  ];

  return {
    apiChecks,
    canonicalDriftChecks,
    environmentChecks,
    fatalError: null,
    pass: allStatuses.length > 0 && allStatuses.every((s) => s === STATUS.PASS),
    report,
    updaterChecks,
  };
}

const displayValue = (value) => {
  if (value === undefined || value === null) {
    return 'unknown';
  }
  return String(value);
};

const displayRepairAction = (status) => {
  if (status === STATUS.PASS) {
    return 'NONE';
  }
  if (status === STATUS.FAIL) {
    return 'USED';
  }
  return STATUS.UNKNOWN;
};

const prefixed = (value = '') => `${LOG_PREFIX}${value ? ` ${value}` : ''}`;

function formatConsoleSummary(result) {
  const lines = [];
  const divider = '='.repeat(78);
  lines.push(prefixed(divider));
  lines.push(
    prefixed(`FINAL SUMMARY: ${result.pass ? STATUS.PASS : STATUS.FAIL}`),
  );

  if (result.fatalError) {
    lines.push(prefixed(`FATAL: ${result.fatalError}`));
  }

  lines.push(prefixed());
  lines.push(prefixed('Execution environment'));
  for (const check of result.environmentChecks) {
    lines.push(
      prefixed(
        `${check.status.padEnd(7)} ${check.name.padEnd(30)} actual=${displayValue(
          check.actual,
        )} expected=${displayValue(check.expected)}`,
      ),
    );
  }

  lines.push(prefixed());
  lines.push(
    prefixed(
      'Protected Node APIs (canonical=startup/after-repair/app-init; repair=NONE is required)',
    ),
  );
  lines.push(
    prefixed(
      'canonical=N/A means the API is checked for identity drift against its startup baseline only',
    ),
  );
  if (result.apiChecks.length === 0) {
    lines.push(
      prefixed(
        'UNKNOWN API results unavailable because no valid report was produced',
      ),
    );
  } else {
    const longestName = Math.max(
      24,
      ...result.apiChecks.map(({ name }) => name.length),
    );
    for (const check of result.apiChecks) {
      const canonical = check.canonical ? check.canonical.join('/') : 'N/A';
      const repair = displayRepairAction(check.repairAction);
      lines.push(
        prefixed(
          `${check.status.padEnd(7)} ${check.name.padEnd(
            longestName,
          )} load=${check.appLoad} after-repair=${check.afterRepair} init=${
            check.appInit
          } canonical=${canonical} repair=${repair}`,
        ),
      );
    }
  }

  lines.push(prefixed());
  lines.push(prefixed('Canonical drift arrays (all must be empty)'));
  for (const check of result.canonicalDriftChecks) {
    lines.push(
      prefixed(
        `${check.status.padEnd(7)} ${check.name.padEnd(
          36,
        )} actual=${displayValue(check.actual)} expected=${displayValue(
          check.expected,
        )}`,
      ),
    );
  }

  lines.push(prefixed());
  lines.push(prefixed('Updater staging safety'));
  if (result.updaterChecks.length === 0) {
    lines.push(
      prefixed(
        'UNKNOWN Updater results unavailable because no valid report was produced',
      ),
    );
  } else {
    for (const check of result.updaterChecks) {
      lines.push(
        prefixed(
          `${check.status.padEnd(7)} ${check.name.padEnd(32)} actual=${displayValue(
            check.actual,
          )} expected=${displayValue(check.expected)}`,
        ),
      );
    }
    const { errorCode, errorMessage } = result.report.stagingResult ?? {};
    if (errorCode || errorMessage) {
      lines.push(
        prefixed(
          `DETAIL  staging error code=${displayValue(
            errorCode,
          )} message=${displayValue(errorMessage)}`,
        ),
      );
    }
  }

  const checks = [
    ...result.environmentChecks,
    ...result.canonicalDriftChecks,
    ...result.apiChecks,
    ...result.updaterChecks,
  ];
  const count = (status) =>
    checks.filter((check) => check.status === status).length;
  lines.push(prefixed());
  lines.push(
    prefixed(
      `TOTAL: ${count(STATUS.PASS)} passed, ${count(
        STATUS.FAIL,
      )} failed, ${count(STATUS.UNKNOWN)} unknown`,
    ),
  );
  const failedChecks = [
    ...result.environmentChecks
      .filter(({ status }) => status === STATUS.FAIL)
      .map(({ name }) => `environment: ${name}`),
    ...result.canonicalDriftChecks
      .filter(({ status }) => status === STATUS.FAIL)
      .map(({ name }) => `canonical: ${name}`),
    ...result.apiChecks
      .filter(({ status }) => status === STATUS.FAIL)
      .map(({ name }) => `Node API: ${name}`),
    ...result.updaterChecks
      .filter(({ status }) => status === STATUS.FAIL)
      .map(({ name }) => `updater: ${name}`),
  ];
  if (failedChecks.length === 0) {
    lines.push(prefixed('FAILED CHECKS: none'));
  } else {
    lines.push(prefixed(`FAILED CHECKS (${failedChecks.length}):`));
    for (const name of failedChecks) {
      lines.push(prefixed(`- ${name}`));
    }
  }
  lines.push(prefixed(divider));
  lines.push(
    prefixed(`FINAL RESULT: ${result.pass ? STATUS.PASS : STATUS.FAIL}`),
  );
  return `${lines.join('\n')}\n`;
}

const escapeMarkdown = (value) =>
  displayValue(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

function formatGitHubStepSummary(result) {
  const icon = result.pass ? '✅' : '❌';
  const lines = [
    `## ${icon} Electron Node runtime integrity: ${
      result.pass ? STATUS.PASS : STATUS.FAIL
    }`,
  ];
  if (result.fatalError) {
    lines.push('', `> Fatal: ${escapeMarkdown(result.fatalError)}`);
  }

  lines.push(
    '',
    '### Execution environment',
    '',
    '| Result | Check | Actual | Expected |',
    '| --- | --- | --- | --- |',
    ...result.environmentChecks.map(
      (check) =>
        `| ${check.status} | ${escapeMarkdown(check.name)} | ${escapeMarkdown(
          check.actual,
        )} | ${escapeMarkdown(check.expected)} |`,
    ),
    '',
    '### Protected Node APIs',
    '',
    '| Result | API | App load | After repair | App init | Canonical startup/repair/init | Repair action |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  if (result.apiChecks.length === 0) {
    lines.push('| UNKNOWN | Results unavailable | — | — | — | — | — |');
  } else {
    lines.push(
      ...result.apiChecks.map((check) => {
        const canonical = check.canonical ? check.canonical.join(' / ') : 'N/A';
        const repair = displayRepairAction(check.repairAction);
        return `| ${check.status} | ${escapeMarkdown(check.name)} | ${
          check.appLoad
        } | ${check.afterRepair} | ${check.appInit} | ${canonical} | ${repair} |`;
      }),
    );
  }

  lines.push(
    '',
    '### Canonical drift arrays',
    '',
    '| Result | Check | Actual | Expected |',
    '| --- | --- | --- | --- |',
    ...result.canonicalDriftChecks.map(
      (check) =>
        `| ${check.status} | ${escapeMarkdown(
          check.name,
        )} | ${escapeMarkdown(check.actual)} | ${escapeMarkdown(
          check.expected,
        )} |`,
    ),
  );

  lines.push(
    '',
    '### Updater staging safety',
    '',
    '| Result | Check | Actual | Expected |',
    '| --- | --- | --- | --- |',
  );
  if (result.updaterChecks.length === 0) {
    lines.push('| UNKNOWN | Results unavailable | — | — |');
  } else {
    lines.push(
      ...result.updaterChecks.map(
        (check) =>
          `| ${check.status} | ${escapeMarkdown(
            check.name,
          )} | ${escapeMarkdown(check.actual)} | ${escapeMarkdown(
            check.expected,
          )} |`,
      ),
    );
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  STATUS,
  evaluateHarnessReport,
  formatConsoleSummary,
  formatGitHubStepSummary,
};
