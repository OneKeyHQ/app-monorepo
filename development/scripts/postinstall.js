#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('yarn setup:env && patch-package && yarn copy:inject', {
  stdio: 'inherit',
});

// Install or upgrade skillshare
try {
  require('./skillshare/install.js');
} catch (e) {
  console.warn('Skillshare install skipped:', e.message);
}

console.log('Postinstall script completed.');
