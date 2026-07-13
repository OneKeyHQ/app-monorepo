const {
  evaluateHarnessReport,
  formatConsoleSummary,
  formatGitHubStepSummary,
} = require('./node-runtime-harness-summary');

const createPassingReport = () => ({
  arch: 'x64',
  autoDownload: false,
  canonicalDriftsAfterAppInit: [],
  canonicalDriftsAfterRepair: [],
  canonicalDriftsBeforeAppLoad: [],
  canonicalNodeGlobalCheckNames: ['global.Buffer'],
  checkForUpdatesCallCount: 0,
  checkForUpdatesCalled: false,
  driftsAfterAppInit: [],
  driftsAfterRepair: [],
  driftsBeforeRepair: [],
  electron: '39.8.9',
  isPackaged: true,
  node: '22.22.1',
  nodeRuntimeCheckNames: ['global.Buffer', 'node:fs.readFile'],
  platform: 'linux',
  processType: 'browser',
  repairs: [],
  stagingResult: {
    afterExists: true,
    beforeExists: false,
    errorCode: null,
    errorMessage: null,
    fileByteLength: 36,
    fileUuidFormat: true,
    idLength: 36,
    success: true,
  },
});

const evaluate = (report, childExitCode = 0) =>
  evaluateHarnessReport({
    childExitCode,
    expectedArch: 'x64',
    expectedPlatform: 'linux',
    report,
  });

describe('node runtime harness summary', () => {
  it('prints every passing API and ends with an explicit pass result', () => {
    const result = evaluate(createPassingReport());
    const summary = formatConsoleSummary(result);

    expect(result.pass).toBe(true);
    expect(summary).toContain(
      'PASS    global.Buffer            load=PASS after-repair=PASS init=PASS canonical=PASS/PASS/PASS repair=NONE',
    );
    expect(summary).toContain(
      'PASS    node:fs.readFile         load=PASS after-repair=PASS init=PASS canonical=N/A repair=NONE',
    );
    expect(summary).toContain('PASS    Staging ID file UUID format');
    expect(
      summary.trimEnd().endsWith('[NODE_RUNTIME_INTEGRITY] FINAL RESULT: PASS'),
    ).toBe(true);
  });

  it('identifies the exact API and phase that failed', () => {
    const report = createPassingReport();
    report.driftsBeforeRepair = [{ name: 'global.Buffer' }];
    report.repairs = [{ name: 'global.Buffer' }];
    report.stagingResult.fileUuidFormat = false;
    const result = evaluate(report, 2);
    const summary = formatConsoleSummary(result);

    expect(result.pass).toBe(false);
    expect(summary).toContain(
      'FAIL    global.Buffer            load=FAIL after-repair=PASS init=PASS canonical=PASS/PASS/PASS repair=USED',
    );
    expect(summary).toContain(
      'PASS    node:fs.readFile         load=PASS after-repair=PASS init=PASS canonical=N/A repair=NONE',
    );
    expect(summary).toContain('FAIL    Staging ID file UUID format');
    expect(summary).toContain('FAILED CHECKS (3):');
    expect(summary).toContain('- Node API: global.Buffer');
    expect(summary).toContain('- updater: Staging ID file UUID format');
    expect(
      summary.trimEnd().endsWith('[NODE_RUNTIME_INTEGRITY] FINAL RESULT: FAIL'),
    ).toBe(true);
  });

  it('fails closed for a canonical-only drift outside the API inventory', () => {
    const report = createPassingReport();
    report.canonicalNodeGlobalCheckNames.push('global.FutureCanonical');
    report.canonicalDriftsAfterAppInit = [{ name: 'global.FutureCanonical' }];
    const result = evaluate(report);
    const summary = formatConsoleSummary(result);

    expect(result.pass).toBe(false);
    expect(result.apiChecks.map(({ name }) => name)).not.toContain(
      'global.FutureCanonical',
    );
    expect(summary).toContain('FAIL    Canonical drift after app init');
    expect(summary).toContain('- canonical: Canonical drift after app init');
  });

  it('prints a structured fatal summary when Electron produces no report', () => {
    const result = evaluateHarnessReport({
      childExitCode: null,
      expectedArch: 'x64',
      expectedPlatform: 'linux',
      fatalError: 'Packaged Electron timed out',
      report: null,
    });
    const summary = formatConsoleSummary(result);

    expect(summary).toContain('FATAL: Packaged Electron timed out');
    expect(summary).toContain(
      'UNKNOWN API results unavailable because no valid report was produced',
    );
    expect(
      summary.trimEnd().endsWith('[NODE_RUNTIME_INTEGRITY] FINAL RESULT: FAIL'),
    ).toBe(true);
  });

  it('renders the same API results in the GitHub Step Summary', () => {
    const summary = formatGitHubStepSummary(evaluate(createPassingReport()));

    expect(summary).toContain('## ✅ Electron Node runtime integrity: PASS');
    expect(summary).toContain(
      '| PASS | global.Buffer | PASS | PASS | PASS | PASS / PASS / PASS | NONE |',
    );
  });
});
