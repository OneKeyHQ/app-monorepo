const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

// `electron-builder install-app-deps` compiles native modules before
// apply-runtime-patches runs, so a native patch only ships after this rebuild.
if (!isMac && !isWindows) {
  process.stdout.write(
    'Skipping Noble runtime rebuild outside macOS and Windows.\n',
  );
  process.exit(0);
}

// An error message only the Windows patch adds doubles as the binary marker.
const WIN_BINARY_MARKER = 'could not maintain GATT session';

const desktopPackageRoot = path.join(__dirname, '..');
const runtimeAppDir = path.join(desktopPackageRoot, 'app');
const nobleRoot = path.join(runtimeAppDir, 'node_modules/@stoprocent/noble');
const commonNativeSources = [
  [
    'lib/common/include/Emit.h',
    'bool state, const std::string& error = "", const std::string& errorDomain',
  ],
  ['lib/common/src/Emit.cc', 'error.Set(_s("nativeErrorCode"), _n(code))'],
];
const macNativeSources = [
  [
    'lib/mac/src/ble_manager.mm',
    'characteristic.isNotifying, details.message, details.domain, details.code',
  ],
];
const winNativeSources = [
  ['lib/win/src/ble_manager.cc', WIN_BINARY_MARKER],
  ['lib/win/src/peripheral_winrt.cc', 'gattSession->MaintainConnection(false)'],
];
const nativeSources = [
  ...commonNativeSources,
  ...(isMac ? macNativeSources : winNativeSources),
];
const patchedSources = [
  ...nativeSources,
  ['lib/noble.js', "const wasConnecting = peripheral.state === 'connecting'"],
].map(([relativePath, marker]) => ({
  filePath: path.join(nobleRoot, relativePath),
  marker,
}));
const bindingPath = path.join(nobleRoot, 'build/Release/binding.node');
const commonBinaryMarkers = ['nativeErrorDomain', 'nativeErrorCode'];
const expectedBinaryMarkers = isWindows
  ? [...commonBinaryMarkers, WIN_BINARY_MARKER]
  : commonBinaryMarkers;

function fail(message) {
  // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- standalone Node build script
  throw new Error(message);
}

function verifyPatchedSources() {
  for (const { filePath, marker } of patchedSources) {
    if (!fs.existsSync(filePath)) {
      fail(`Noble runtime source is missing: ${filePath}`);
    }
    const source = fs.readFileSync(filePath, 'utf8');
    if (!source.includes(marker)) {
      fail(`Noble runtime patch is missing marker "${marker}": ${filePath}`);
    }
  }
}

function getNativeSourceModifiedAt() {
  return Math.max(
    ...nativeSources.map(
      ([relativePath]) =>
        fs.statSync(path.join(nobleRoot, relativePath)).mtimeMs,
    ),
  );
}

function getSelectedBindingPath() {
  const nodeGypBuildPath = require.resolve('node-gyp-build', {
    paths: [nobleRoot],
  });
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(nodeGypBuildPath).path(nobleRoot);
}

function getBindingArchitectures() {
  return execFileSync('lipo', ['-archs', bindingPath], {
    encoding: 'utf8',
  })
    .trim()
    .split(/\s+/u);
}

function verifyPatchedBinding() {
  if (!fs.existsSync(bindingPath)) {
    fail(`Patched Noble runtime binary is missing: ${bindingPath}`);
  }

  const selectedBindingPath = getSelectedBindingPath();
  if (path.resolve(selectedBindingPath) !== path.resolve(bindingPath)) {
    fail(`Noble runtime selected an unexpected binary: ${selectedBindingPath}`);
  }

  const binary = fs.readFileSync(bindingPath);
  for (const marker of expectedBinaryMarkers) {
    if (!binary.includes(Buffer.from(marker))) {
      fail(
        `Noble runtime binary is missing marker "${marker}": ${bindingPath}`,
      );
    }
  }

  // Windows builds one architecture per rebuild (process.arch); only the
  // macOS binary is universal.
  if (!isMac) {
    return;
  }
  const architectures = getBindingArchitectures();
  for (const architecture of ['x86_64', 'arm64']) {
    if (!architectures.includes(architecture)) {
      fail(`Noble runtime binary is missing ${architecture}: ${bindingPath}`);
    }
  }
}

function isCurrentPatchedBinding() {
  try {
    if (
      !fs.existsSync(bindingPath) ||
      fs.statSync(bindingPath).mtimeMs < getNativeSourceModifiedAt()
    ) {
      return false;
    }
    verifyPatchedBinding();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  verifyPatchedSources();

  if (isCurrentPatchedBinding()) {
    process.stdout.write('Patched Noble runtime binary is current.\n');
    return;
  }

  const { rebuild } = await import('@electron/rebuild');
  const electronVersion = require('../package.json').devDependencies.electron;

  await rebuild({
    buildPath: runtimeAppDir,
    projectRootPath: runtimeAppDir,
    electronVersion,
    arch: process.arch,
    onlyModules: ['noble'],
    force: true,
    buildFromSource: true,
    mode: 'sequential',
    disablePreGypCopy: true,
  });

  verifyPatchedBinding();
  process.stdout.write('Rebuilt and verified patched Noble runtime binary.\n');
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
