#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('yarn setup:env && patch-package && yarn copy:inject', {
  stdio: 'inherit',
});

console.log('Postinstall script completed.');
