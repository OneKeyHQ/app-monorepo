const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const output = path.resolve(__dirname, '../app/build/native/squirrel-cancel');

function buildSquirrelCancel() {
  if (process.platform !== 'darwin') return;
  const source = path.resolve(
    __dirname,
    '../native-modules/squirrel-cancel/main.m',
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(
    '/usr/bin/xcrun',
    [
      'clang',
      '-fobjc-arc',
      '-Wall',
      '-Wextra',
      '-Wno-deprecated-declarations',
      '-mmacosx-version-min=11.0',
      '-arch',
      'arm64',
      '-arch',
      'x86_64',
      '-framework',
      'Foundation',
      '-framework',
      'AppKit',
      '-framework',
      'Security',
      '-framework',
      'ServiceManagement',
      source,
      '-o',
      output,
    ],
    { stdio: 'inherit' },
  );
  fs.chmodSync(output, 0o755);
  return output;
}

module.exports = { buildSquirrelCancel, output };
if (require.main === module) buildSquirrelCancel();
