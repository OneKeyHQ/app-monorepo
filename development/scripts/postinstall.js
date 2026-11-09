#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running postinstall script...');

// Run setup:env, patch-package, copy:inject, and fonts:sync
execSync(
  'yarn setup:env && patch-package && yarn copy:inject && yarn fonts:sync',
  {
    stdio: 'inherit',
  },
);

console.log('Postinstall script completed.');
