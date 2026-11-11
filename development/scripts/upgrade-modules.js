#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: yarn onekeyhq:modules:upgrade <version>');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '../..');
const files = [
  path.join(ROOT, 'package.json'),
  ...['apps', 'packages'].flatMap((directory) =>
    fs
      .readdirSync(path.join(ROOT, directory), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(ROOT, directory, entry.name, 'package.json'))
      .filter((file) => fs.existsSync(file)),
  ),
];

// ble-utils is published independently from the app-modules SDK.
const isAppModulesPackage = (name) =>
  name.startsWith('@onekeyfe/react-native-') &&
  name !== '@onekeyfe/react-native-ble-utils';

let totalUpdated = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(content);
  const relPath = path.relative(ROOT, file);
  let fileUpdated = 0;

  for (const section of ['dependencies', 'devDependencies', 'resolutions']) {
    if (pkg[section]) {
      for (const [name, value] of Object.entries(pkg[section])) {
        if (typeof value === 'string') {
          const alias = value.match(/^npm:((?:@[^/]+\/)?[^@]+)@/);
          if (isAppModulesPackage(alias ? alias[1] : name)) {
            const newValue = alias ? `${alias[0]}${newVersion}` : newVersion;
            if (newValue !== value) {
              pkg[section][name] = newValue;
              fileUpdated += 1;
            }
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
