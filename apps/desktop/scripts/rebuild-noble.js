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
const patchedSourcePath = path.join(nobleRoot, 'lib/mac/src/ble_manager.mm');
const patchedSource = fs.readFileSync(patchedSourcePath, 'utf8');

if (!patchedSource.includes('error.domain, (long)error.code')) {
  // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- standalone Node build script
  throw new Error(`Noble source patch is missing: ${patchedSourcePath}`);
}

const requiredBinaries = ['binding.node', 'noble.node'].map((binaryName) =>
  path.join(nobleRoot, 'build/Release', binaryName),
);
const sourceModifiedAt = fs.statSync(patchedSourcePath).mtimeMs;
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
