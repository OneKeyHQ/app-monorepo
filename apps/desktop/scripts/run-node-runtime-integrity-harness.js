const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const {
  getPackagedExecutableCandidates,
  resolvePackagedExecutable,
} = require('./node-runtime-harness-paths');

const desktopDir = path.join(__dirname, '..');
const useInstalledSnap =
  process.env.ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_SNAP === 'true';

class HarnessError extends Error {}

if (useInstalledSnap && process.platform !== 'linux') {
  throw new HarnessError(
    'The installed Snap harness is only supported on Linux.',
  );
}

const executable = useInstalledSnap
  ? 'snap'
  : resolvePackagedExecutable({ desktopDir });
const executableArgs = useInstalledSnap ? ['run', 'onekey-wallet'] : [];

if (!executable) {
  const expectedPaths = getPackagedExecutableCandidates({
    arch: process.arch,
    desktopDir,
    platform: process.platform,
  }).join(', ');
  throw new HarnessError(
    `A packaged desktop build for ${process.platform}/${process.arch} is required. Expected one of: ${expectedPaths}`,
  );
}

const tempParent = useInstalledSnap
  ? path.join(os.homedir(), 'snap', 'onekey-wallet', 'common')
  : os.tmpdir();
fs.mkdirSync(tempParent, { recursive: true });
const tempRoot = fs.mkdtempSync(
  path.join(tempParent, 'onekey-node-runtime-integrity-'),
);
const userDataDir = path.join(tempRoot, 'user-data');
const reportFile = path.join(tempRoot, 'report.json');
fs.mkdirSync(userDataDir, { recursive: true });

const child = childProcess.spawn(executable, executableArgs, {
  env: {
    ...process.env,
    DESKTOP_E2E_MODE: 'true',
    DESKTOP_E2E_USER_DATA_DIR: userDataDir,
    ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_OUTPUT: reportFile,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

const redactIdentifiers = (value) =>
  value.replace(
    /\b[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}\b/g,
    '<redacted-uuid>',
  );

const forwardSanitizedLines = (stream, destination) => {
  const lineReader = readline.createInterface({ input: stream });
  lineReader.on('line', (line) => {
    destination.write(`${redactIdentifiers(line)}\n`);
  });
};

forwardSanitizedLines(child.stdout, process.stdout);
forwardSanitizedLines(child.stderr, process.stderr);

const timeout = setTimeout(() => {
  child.kill();
}, 90_000);

child.once('exit', (code) => {
  clearTimeout(timeout);
  try {
    if (!fs.existsSync(reportFile)) {
      throw new HarnessError(
        `Harness exited without a report (exit code ${code}).`,
      );
    }
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    if (report.fatalError) {
      throw new HarnessError(`Harness fatal error: ${report.fatalError}`);
    }
    const pass =
      report.arch === process.arch &&
      report.platform === process.platform &&
      report.isPackaged === true &&
      report.processType === 'browser' &&
      report.canonicalDriftsBeforeAppLoad.length === 0 &&
      report.canonicalDriftsAfterRepair.length === 0 &&
      report.canonicalDriftsAfterAppInit.length === 0 &&
      report.driftsBeforeRepair.length === 0 &&
      report.repairs.length === 0 &&
      report.driftsAfterRepair.length === 0 &&
      report.driftsAfterAppInit.length === 0 &&
      report.autoDownload === false &&
      report.checkForUpdatesCallCount === 0 &&
      report.checkForUpdatesCalled === false &&
      report.stagingResult.success === true &&
      report.stagingResult.idLength === 36 &&
      report.stagingResult.fileByteLength === 36 &&
      report.stagingResult.fileUuidFormat === true;

    process.stdout.write(
      `${JSON.stringify(
        {
          arch: report.arch,
          autoDownload: report.autoDownload,
          canonicalDriftsAfterAppInit: report.canonicalDriftsAfterAppInit,
          canonicalDriftsAfterRepair: report.canonicalDriftsAfterRepair,
          canonicalDriftsBeforeAppLoad: report.canonicalDriftsBeforeAppLoad,
          checkForUpdatesCallCount: report.checkForUpdatesCallCount,
          checkForUpdatesCalled: report.checkForUpdatesCalled,
          driftsAfterAppInit: report.driftsAfterAppInit,
          driftsAfterRepair: report.driftsAfterRepair,
          driftsBeforeRepair: report.driftsBeforeRepair,
          electron: report.electron,
          isPackaged: report.isPackaged,
          node: report.node,
          pass,
          platform: report.platform,
          processType: report.processType,
          repairs: report.repairs,
          stagingResult: report.stagingResult,
        },
        null,
        2,
      )}\n`,
    );
    if (!pass || code !== 0) {
      process.exitCode = 1;
    }
  } finally {
    const resolvedTempRoot = path.resolve(tempRoot);
    const resolvedTempParent = `${path.resolve(tempParent)}${path.sep}`;
    if (
      resolvedTempRoot.startsWith(resolvedTempParent) &&
      path
        .basename(resolvedTempRoot)
        .startsWith('onekey-node-runtime-integrity-')
    ) {
      fs.rmSync(resolvedTempRoot, { force: true, recursive: true });
    }
  }
});
