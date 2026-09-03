const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') {
  process.stdout.write('Skipping Noble rebuild outside macOS.\n');
  process.exit(0);
}

const desktopPackageRoot = path.join(__dirname, '..');
const moduleDir = process.argv.includes('--runtime')
  ? path.join(desktopPackageRoot, 'app')
  : desktopPackageRoot;
const nobleEntry = require.resolve('@stoprocent/noble', {
  paths: [moduleDir],
});
const nobleRoot = path.dirname(nobleEntry);
const patchedSources = [
  [
    'lib/common/include/Emit.h',
    'Disconnected(const std::string& uuid, const std::string& error',
  ],
  ['lib/common/src/Emit.cc', 'error.empty() ? env.Null() : _e(error)'],
  ['lib/mac/src/ble_manager.mm', 'emit.Disconnected(uuid, errorMessage)'],
  [
    'lib/noble.js',
    "peripheral.state === 'connecting' && reason instanceof Error",
  ],
].map(([relativePath, marker]) => ({
  filePath: path.join(nobleRoot, relativePath),
  marker,
}));

for (const { filePath, marker } of patchedSources) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes(marker)) {
    // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- standalone Node build script
    throw new Error(
      `Noble source patch is missing marker "${marker}": ${filePath}`,
    );
  }
}

const requiredBinaries = ['binding.node', 'noble.node'].map((binaryName) =>
  path.join(nobleRoot, 'build/Release', binaryName),
);
const sourceModifiedAt = Math.max(
  ...patchedSources.map(({ filePath }) => fs.statSync(filePath).mtimeMs),
);
const isCurrentBuild = requiredBinaries.every(
  (binaryPath) =>
    fs.existsSync(binaryPath) &&
    fs.statSync(binaryPath).mtimeMs >= sourceModifiedAt,
);

if (isCurrentBuild) {
  process.stdout.write(`Patched Noble binary is current in ${moduleDir}.\n`);
  process.exit(0);
}

const electronRebuildCli = path.join(
  path.dirname(
    require.resolve('@electron/rebuild', { paths: [desktopPackageRoot] }),
  ),
  'cli.js',
);
const electronVersion = require('../package.json').devDependencies.electron;

execFileSync(
  process.execPath,
  [
    electronRebuildCli,
    '--force',
    '--build-from-source',
    '--module-dir',
    moduleDir,
    '--version',
    electronVersion,
    '--only',
    'noble',
  ],
  { stdio: 'inherit' },
);
