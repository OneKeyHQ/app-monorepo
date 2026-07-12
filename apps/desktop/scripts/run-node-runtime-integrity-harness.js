const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const desktopDir = path.join(__dirname, '..');

class HarnessError extends Error {}

const getExecutable = () => {
  if (process.platform === 'win32') {
    return path.join(
      desktopDir,
      'build-electron',
      'win-unpacked',
      'OneKey.exe',
    );
  }
  if (process.platform === 'linux') {
    return path.join(
      desktopDir,
      'build-electron',
      'linux-unpacked',
      'onekey-wallet',
    );
  }
  return null;
};

const executable = getExecutable();

if (!executable || !fs.existsSync(executable)) {
  throw new HarnessError(
    'A packaged desktop build is required before running the Node runtime integrity harness.',
  );
}

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'onekey-node-runtime-integrity-'),
);
const userDataDir = path.join(tempRoot, 'user-data');
const reportFile = path.join(tempRoot, 'report.json');
fs.mkdirSync(userDataDir, { recursive: true });

const child = childProcess.spawn(executable, [], {
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
}, 30_000);

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
      report.processType === 'browser' &&
      report.canonicalDriftsBeforeAppLoad.length === 0 &&
      report.canonicalDriftsAfterRepair.length === 0 &&
      report.driftsAfterRepair.length === 0 &&
      report.autoDownload === false &&
      report.checkForUpdatesCalled === false &&
      report.stagingResult.success === true &&
      report.stagingResult.idLength === 36 &&
      report.stagingResult.fileByteLength === 36 &&
      report.stagingResult.fileUuidFormat === true;

    process.stdout.write(
      `${JSON.stringify(
        {
          autoDownload: report.autoDownload,
          canonicalDriftsAfterRepair: report.canonicalDriftsAfterRepair,
          canonicalDriftsBeforeAppLoad: report.canonicalDriftsBeforeAppLoad,
          checkForUpdatesCalled: report.checkForUpdatesCalled,
          driftsAfterRepair: report.driftsAfterRepair,
          driftsBeforeRepair: report.driftsBeforeRepair,
          electron: report.electron,
          node: report.node,
          pass,
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
    const resolvedSystemTemp = `${path.resolve(os.tmpdir())}${path.sep}`;
    if (
      resolvedTempRoot.startsWith(resolvedSystemTemp) &&
      path
        .basename(resolvedTempRoot)
        .startsWith('onekey-node-runtime-integrity-')
    ) {
      fs.rmSync(resolvedTempRoot, { force: true, recursive: true });
    }
  }
});
