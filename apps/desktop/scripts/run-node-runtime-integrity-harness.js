const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const {
  getPackagedExecutableCandidates,
  resolvePackagedExecutable,
} = require('./node-runtime-harness-paths');
const {
  evaluateHarnessReport,
  formatConsoleSummary,
  formatGitHubStepSummary,
} = require('./node-runtime-harness-summary');

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

let spawnError = null;
let timedOut = false;
child.once('error', (error) => {
  spawnError = error;
});

const timeout = setTimeout(() => {
  timedOut = true;
  child.kill();
}, 90_000);

child.once('close', (code, signal) => {
  clearTimeout(timeout);
  let fatalError = null;
  let report = null;
  try {
    if (spawnError) {
      fatalError = `Failed to start packaged Electron: ${spawnError.message}`;
    } else if (timedOut) {
      fatalError = 'Packaged Electron exceeded the 90 second harness timeout';
    } else if (!fs.existsSync(reportFile)) {
      fatalError = `Harness exited without a report (exit code ${code}, signal ${
        signal ?? 'none'
      })`;
    } else {
      report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
      if (report.fatalError) {
        fatalError = `Harness fatal error: ${report.fatalError}`;
      }
    }
  } catch (error) {
    fatalError = `Failed to read harness report: ${error.message}`;
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

  let result;
  try {
    result = evaluateHarnessReport({
      childExitCode: code,
      expectedArch: process.arch,
      expectedPlatform: process.platform,
      fatalError,
      report,
    });
  } catch (error) {
    result = evaluateHarnessReport({
      childExitCode: code,
      expectedArch: process.arch,
      expectedPlatform: process.platform,
      fatalError: `Harness report schema was invalid: ${error.message}`,
      report: null,
    });
  }
  const consoleSummary = redactIdentifiers(formatConsoleSummary(result));

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        redactIdentifiers(formatGitHubStepSummary(result)),
        'utf8',
      );
    } catch (error) {
      process.stderr.write(
        `${redactIdentifiers(
          `[NODE_RUNTIME_INTEGRITY] Unable to write GitHub Step Summary: ${error.message}`,
        )}\n`,
      );
    }
  }

  process.stdout.write(consoleSummary);
  if (!result.pass) {
    process.exitCode = 1;
  }
});
