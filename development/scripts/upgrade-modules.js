#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: yarn onekeyhq:modules:upgrade <version>');
  console.error('Example: yarn onekeyhq:modules:upgrade 3.0.12');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '../..');
const files = [
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'packages/components/package.json'),
  path.join(ROOT, 'apps/mobile/package.json'),
];

// Match @onekeyfe/react-native-* versions like "3.0.11" or "npm:@onekeyfe/...@3.0.11"
const VERSION_RE = /3\.0\.\d+/;

const isAppModulesRef = (name, value) => {
  if (name.startsWith('@onekeyfe/react-native-')) return true;
  if (name === '@onekeyfe/react-native-native-logger') return true;
  if (typeof value === 'string' && value.includes('@onekeyfe/react-native-')) {
    return true;
  }
  return false;
};

let totalUpdated = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(content);
  const relPath = path.relative(ROOT, file);
  let fileUpdated = 0;

  for (const section of ['dependencies', 'devDependencies', 'resolutions']) {
    if (pkg[section]) {
      for (const [name, value] of Object.entries(pkg[section])) {
        if (isAppModulesRef(name, value) && VERSION_RE.test(value)) {
          const newValue = value.replace(VERSION_RE, newVersion);
          if (newValue !== value) {
            pkg[section][name] = newValue;
            fileUpdated += 1;
          }
        }
      }
    }
  }

  if (fileUpdated > 0) {
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`✓ ${relPath} (${fileUpdated} packages updated)`);
    totalUpdated += fileUpdated;
  } else {
    console.log(`- ${relPath} (no changes)`);
  }
}

if (totalUpdated === 0) {
  console.log('\nNo packages to update.');
  process.exit(0);
}

console.log(`\nUpdated ${totalUpdated} packages to ${newVersion}`);

console.log('\nRunning yarn install...');
execSync('yarn', { cwd: ROOT, stdio: 'inherit' });

console.log('\nRunning pod install...');
execSync('pod install', {
  cwd: path.join(ROOT, 'apps/mobile/ios'),
  stdio: 'inherit',
});

console.log('\nDone!');
