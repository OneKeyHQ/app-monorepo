#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('bun run setup:env && npx patch-package && bun run copy:inject', {
  stdio: 'inherit',
});

console.log('Postinstall script completed.');
