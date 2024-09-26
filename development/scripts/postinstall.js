#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('yarn setup:env && patch-package && yarn copy:inject', {
  stdio: 'inherit',
});

// Remove realm-flipper-plugin-device/src directory
const dirToRemove = path.join(
  __dirname,
  '..',
  '..',
  'node_modules',
  'realm-flipper-plugin-device',
  'src',
);
if (fs.existsSync(dirToRemove)) {
  fs.rmSync(dirToRemove, { recursive: true, force: true });
  console.log(`Removed directory: ${dirToRemove}`);
} else {
  console.log(`Directory not found: ${dirToRemove}`);
}

console.log('Postinstall script completed.');
