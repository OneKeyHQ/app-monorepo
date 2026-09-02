#!/usr/bin/env node

const { execFileSync, execSync } = require('child_process');
const path = require('path');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('yarn setup:env && patch-package && yarn copy:inject', {
  stdio: 'inherit',
});

if (process.platform === 'darwin') {
  // patch-package runs after dependency install, so rebuild Noble from the
  // patched Objective-C++ source instead of loading its bundled prebuild.
  const electronRebuildCli = path.join(
    path.dirname(require.resolve('@electron/rebuild')),
    'cli.js',
  );
  execFileSync(
    process.execPath,
    [
      electronRebuildCli,
      '--force',
      '--build-from-source',
      '--module-dir',
      'apps/desktop',
      // @electron/rebuild matches scoped packages by their basename here.
      '--only',
      'noble',
    ],
    { stdio: 'inherit' },
  );
}

console.log('Postinstall script completed.');
