#!/usr/bin/env node

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running postinstall script...');

// Run setup:env, patch-package, copy:inject, and fonts:sync
execSync(
  'yarn setup:env && patch-package && yarn copy:inject && yarn fonts:sync',
  {
    stdio: 'inherit',
  },
);

// The Breez SDK React Native package downloads its prebuilt iOS and Android
// libraries in a POSIX shell script. Yarn does not run it (dependenciesMeta in
// package.json), so installs on Windows never need sh; it runs here instead,
// on macOS and Linux only, and returns early once the libraries are present.
const breezReactNativeRoot = path.resolve(
  __dirname,
  '../../node_modules/@breeztech/breez-sdk-spark-react-native',
);
if (process.platform !== 'win32' && fs.existsSync(breezReactNativeRoot)) {
  execFileSync('sh', ['scripts/postinstall.sh'], {
    cwd: breezReactNativeRoot,
    stdio: 'inherit',
  });
}

console.log('Postinstall script completed.');
