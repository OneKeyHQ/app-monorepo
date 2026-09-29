/* eslint-disable onekey/no-raw-error -- standalone build script without app runtime dependencies */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const desktopDir = path.resolve(__dirname, '..');
const cert = path.join(
  desktopDir,
  'resources/windows/code-signing/onekey-limited.cer',
);
const outputDir = path.join(desktopDir, 'build-electron');
const helperDir = path.join(desktopDir, 'app/build/static/bin');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Windows HSM signing`);
  }
  return value;
}

function runSignTool(args) {
  execFileSync(requiredEnv('WIN_SIGNTOOL_PATH'), args, { stdio: 'inherit' });
}

function verify(file) {
  runSignTool(['verify', '/pa', '/all', '/v', file]);
}

function signFile(file) {
  runSignTool([
    'sign',
    '/v',
    '/fd',
    'SHA256',
    '/tr',
    'http://timestamp.digicert.com',
    '/td',
    'SHA256',
    '/f',
    cert,
    '/csp',
    'Google Cloud KMS Provider',
    '/kc',
    requiredEnv('WIN_CODESIGN_KEY_VERSION'),
    file,
  ]);
  verify(file);
  const manifest = path.join(
    requiredEnv('RUNNER_TEMP'),
    'onekey-windows-signed.jsonl',
  );
  fs.appendFileSync(manifest, `${JSON.stringify(file)}\n`);
}

function listExes(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listExes(file);
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith('.exe')
      ? [file]
      : [];
  });
}

function helperFiles() {
  return ['bridge', 'ble-pair'].flatMap((name) =>
    listExes(path.join(helperDir, name)),
  );
}

function helperBackupDir() {
  return path.join(requiredEnv('RUNNER_TEMP'), 'onekey-unsigned-win-helpers');
}

function signHelpers() {
  for (const file of helperFiles()) {
    const relative = path.relative(helperDir, file);
    const backup = path.join(helperBackupDir(), relative);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(file, backup);
    signFile(file);
  }
}

function restoreHelpers() {
  for (const backup of listExes(helperBackupDir())) {
    const relative = path.relative(helperBackupDir(), backup);
    fs.copyFileSync(backup, path.join(helperDir, relative));
  }
  fs.rmSync(helperBackupDir(), { recursive: true, force: true });
}

function signPrepackaged(channel) {
  if (!['nsis', 'store'].includes(channel)) {
    throw new Error(`Unknown Windows package channel: ${channel}`);
  }
  const inputDir = path.join(desktopDir, 'signing-input', channel);
  for (const archDir of ['win-unpacked', 'win-arm64-unpacked']) {
    const dir = path.join(inputDir, archDir);
    if (!fs.existsSync(path.join(dir, 'OneKey.exe'))) {
      throw new Error(`Missing prepackaged OneKey.exe: ${dir}`);
    }
    for (const file of listExes(dir)) {
      signFile(file);
    }
  }
}

function verifyNsisOutput() {
  const manifest = path.join(
    requiredEnv('RUNNER_TEMP'),
    'onekey-windows-signed.jsonl',
  );
  const signed = fs
    .readFileSync(manifest, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const unpackedApps = signed.filter(
    (file) => path.basename(file) === 'OneKey.exe',
  );
  const uninstallers = signed.filter((file) =>
    file.endsWith('__uninstaller.exe'),
  );
  const installers = fs
    .readdirSync(outputDir)
    .filter((name) => name.toLowerCase().endsWith('.exe'))
    .map((name) => path.join(outputDir, name));
  if (
    unpackedApps.length === 0 ||
    uninstallers.length === 0 ||
    installers.length === 0
  ) {
    throw new Error(
      'Missing a signed app, NSIS uninstaller, or outer installer',
    );
  }
  for (const file of installers) {
    if (!signed.includes(file)) {
      throw new Error(`Unsigned NSIS installer: ${file}`);
    }
  }
  for (const file of signed) {
    if (fs.existsSync(file)) {
      verify(file);
    }
  }
}

module.exports = async function signWithCloudHsm(configuration) {
  if (configuration.hash !== 'sha256') {
    throw new Error(`Unsupported Windows signing hash: ${configuration.hash}`);
  }
  signFile(configuration.path);
};

if (require.main === module) {
  const command = process.argv[2];
  if (command === 'sign-helpers') {
    signHelpers();
  } else if (command === 'restore-helpers') {
    restoreHelpers();
  } else if (command === 'verify-nsis') {
    verifyNsisOutput();
  } else if (command === 'sign-prepackaged') {
    signPrepackaged(process.argv[3]);
  } else {
    throw new Error(`Unknown Windows signing command: ${command}`);
  }
}
