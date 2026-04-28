#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running postinstall script...');

// Run setup:env, patch-package, copy:inject, and sync-version.
// sync-version regenerates packages/shared/src/runtime/version.ts from
// .env.version so app code can import APP_VERSION without depending on
// per-bundler env injection.
execSync(
  'yarn setup:env && patch-package && yarn copy:inject && node development/scripts/sync-version.js',
  {
    stdio: 'inherit',
  },
);

console.log('Postinstall script completed.');
