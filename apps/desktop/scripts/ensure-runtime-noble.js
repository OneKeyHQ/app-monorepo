const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

// An error message only the Windows patch adds doubles as the binary marker.
const WIN_BINARY_MARKER = 'could not activate maintained GATT session';

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
  ['lib/win/src/peripheral_winrt.cc', 'session->MaintainConnection(false)'],
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

function getWindowsBindingPath(architecture) {
  return path.join(
    desktopPackageRoot,
    'node_modules/.cache/noble-runtime',
    architecture,
    'binding.node',
  );
}

function verifyWindowsBinding(file, architecture) {
  const binary = fs.readFileSync(file);
  const pe = binary.length >= 64 ? binary.readUInt32LE(0x3c) : -1;
  const machine = { x64: 0x86_64, arm64: 0xaa_64 }[architecture];
  if (
    !machine ||
    pe < 0 ||
    pe + 6 > binary.length ||
    binary.toString('ascii', 0, 2) !== 'MZ' ||
    binary.readUInt32LE(pe) !== 0x00_00_45_50 ||
    binary.readUInt16LE(pe + 4) !== machine
  ) {
    fail(
      `Noble runtime binary has the wrong Windows architecture (${architecture}): ${file}`,
    );
  }
  for (const marker of [...commonBinaryMarkers, WIN_BINARY_MARKER]) {
    if (!binary.includes(Buffer.from(marker)))
      fail(`Noble runtime binary is missing marker "${marker}": ${file}`);
  }
}

function verifyPatchedBinding(architecture) {
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

  if (isWindows) {
    verifyWindowsBinding(bindingPath, architecture);
    return;
  }
  const architectures = getBindingArchitectures();
  for (const macArchitecture of ['x86_64', 'arm64']) {
    if (!architectures.includes(macArchitecture)) {
      fail(
        `Noble runtime binary is missing ${macArchitecture}: ${bindingPath}`,
      );
    }
  }
}

function isCurrentPatchedBinding(architecture) {
  try {
    if (
      !fs.existsSync(bindingPath) ||
      fs.statSync(bindingPath).mtimeMs < getNativeSourceModifiedAt()
    ) {
      return false;
    }
    verifyPatchedBinding(architecture);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!isMac && !isWindows) return;
  verifyPatchedSources();
  const { rebuild } = await import('@electron/rebuild');
  const electronVersion = require('../package.json').devDependencies.electron;
  // Stage both targets before packaging begins. Pack jobs can run concurrently,
  // so they must not rebuild or select a shared build/Release for different CPUs.
  const architectures = isWindows
    ? ['x64', 'arm64']
        .filter((arch) => arch !== process.arch)
        .concat(process.arch)
    : [process.arch];
  for (const architecture of architectures) {
    const staged = getWindowsBindingPath(architecture);
    let stagedIsCurrent = false;
    if (
      isWindows &&
      fs.existsSync(staged) &&
      fs.statSync(staged).mtimeMs >= getNativeSourceModifiedAt()
    ) {
      try {
        verifyWindowsBinding(staged, architecture);
        fs.copyFileSync(staged, bindingPath);
        stagedIsCurrent = true;
      } catch {
        // Rebuild a stale or incompatible cached artifact.
      }
    }
    if (!stagedIsCurrent) {
      if (!isCurrentPatchedBinding(architecture)) {
        await rebuild({
          buildPath: runtimeAppDir,
          projectRootPath: runtimeAppDir,
          electronVersion,
          arch: architecture,
          onlyModules: ['noble'],
          force: true,
          buildFromSource: true,
          mode: 'sequential',
          disablePreGypCopy: true,
        });
      }
      verifyPatchedBinding(architecture);
      if (isWindows) {
        fs.mkdirSync(path.dirname(staged), { recursive: true });
        fs.copyFileSync(bindingPath, staged);
      }
    }
  }
  process.stdout.write(
    'Verified patched Noble runtime binaries for every packaging architecture.\n',
  );
}

module.exports = { getWindowsBindingPath, verifyWindowsBinding };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
