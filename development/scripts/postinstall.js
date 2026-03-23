#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('yarn setup:env && patch-package && yarn copy:inject', {
  stdio: 'inherit',
});

// Install or upgrade skillshare
try {
  execSync('yarn skills:sync', {
    stdio: 'inherit',
  });
} catch (e) {
  console.warn('Skillshare install and sync skipped:', e.message);
}

console.log('Postinstall script completed.');
