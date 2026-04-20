#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running postinstall script...');

// Run setup:env, patch-package, and copy:inject
execSync('yarn setup:env && patch-package && yarn copy:inject', {
  stdio: 'inherit',
});

// Fix @ledgerhq packages missing "main" field.
// Metro (React Native) can't resolve packages that only have "exports" (no "main").
// See: https://github.com/facebook/metro/issues/1222
// These packages are dependencies of @bytezhang/ledger-adapter.
const LEDGER_PACKAGES_MISSING_MAIN = [
  '@ledgerhq/device-management-kit',
  '@ledgerhq/device-signer-kit-ethereum',
  '@ledgerhq/device-signer-kit-solana',
  '@ledgerhq/device-transport-kit-react-native-ble',
  '@ledgerhq/context-module',
  '@ledgerhq/signer-utils',
];
const CJS_ENTRY = 'lib/cjs/index.js';

for (const pkg of LEDGER_PACKAGES_MISSING_MAIN) {
  const pkgJsonPath = path.join(__dirname, '..', '..', 'node_modules', pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;
  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (pkgJson.main) continue;
    const cjsPath = path.join(path.dirname(pkgJsonPath), CJS_ENTRY);
    if (!fs.existsSync(cjsPath)) continue;
    pkgJson.main = CJS_ENTRY;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`[postinstall] Added "main" to ${pkg}`);
  } catch (e) {
    console.warn(`[postinstall] Failed to fix ${pkg}:`, e.message);
  }
}

console.log('Postinstall script completed.');
