const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const SCRIPT = path.join(__dirname, 'external-sdk.js');

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function createFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'external-sdk-lint-'));
  const packageRoot = path.join(base, 'node_modules', 'fake-sdk');
  writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: 'fake-sdk', version: '1.2.3' }, null, 2)}\n`,
  );
  writeFile(
    path.join(packageRoot, 'ios', 'Frameworks', 'Fake.xcframework', 'a.bin'),
    'alpha',
  );
  writeFile(
    path.join(
      packageRoot,
      'ios',
      'Frameworks',
      'Fake.xcframework',
      'nested',
      'b.bin',
    ),
    'beta',
  );
  writeFile(path.join(packageRoot, 'ios', 'Bridge.swift'), '// bridge\n');

  const configPath = path.join(base, 'external-sdk.config.json');
  writeFile(
    configPath,
    `${JSON.stringify(
      {
        version: 1,
        sdks: [
          {
            id: 'fake-sdk',
            root: 'node_modules/fake-sdk',
            packageVersion: { file: 'package.json', expect: '1.2.3' },
            directories: ['ios/Frameworks/Fake.xcframework'],
            files: ['ios/Bridge.swift'],
            hashes: {},
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  return { base, configPath, packageRoot };
}

function runLint(fixture, args = []) {
  return spawnSync(
    process.execPath,
    [SCRIPT, '--base', fixture.base, '--config', fixture.configPath, ...args],
    { encoding: 'utf8' },
  );
}

function pin(fixture) {
  const result = runLint(fixture, ['--write']);
  assert.equal(result.status, 0, result.stderr);
}

test('reports a clean manifest after --write', () => {
  const fixture = createFixture();
  pin(fixture);
  const result = runLint(fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK/u);
  assert.match(result.stdout, /3 files/u);
});

test('fails when a pinned file is modified', () => {
  const fixture = createFixture();
  pin(fixture);
  writeFile(
    path.join(
      fixture.packageRoot,
      'ios',
      'Frameworks',
      'Fake.xcframework',
      'a.bin',
    ),
    'tampered',
  );
  const result = runLint(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MODIFIED/u);
  assert.match(result.stderr, /a\.bin/u);
});

test('fails when an unexpected file is added', () => {
  const fixture = createFixture();
  pin(fixture);
  writeFile(
    path.join(
      fixture.packageRoot,
      'ios',
      'Frameworks',
      'Fake.xcframework',
      'injected.dylib',
    ),
    'payload',
  );
  const result = runLint(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /UNEXPECTED/u);
  assert.match(result.stderr, /injected\.dylib/u);
});

test('fails when a pinned file is removed', () => {
  const fixture = createFixture();
  pin(fixture);
  fs.rmSync(
    path.join(
      fixture.packageRoot,
      'ios',
      'Frameworks',
      'Fake.xcframework',
      'nested',
      'b.bin',
    ),
  );
  const result = runLint(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MISSING/u);
  assert.match(result.stderr, /b\.bin/u);
});

test('fails when the package version no longer matches the pin', () => {
  const fixture = createFixture();
  pin(fixture);
  writeFile(
    path.join(fixture.packageRoot, 'package.json'),
    `${JSON.stringify({ name: 'fake-sdk', version: '9.9.9' }, null, 2)}\n`,
  );
  const result = runLint(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected package version 1\.2\.3/u);
});

test('refuses to pin a symlink instead of following it', () => {
  const fixture = createFixture();
  const target = path.join(fixture.base, 'outside.txt');
  writeFile(target, 'outside');
  fs.symlinkSync(
    target,
    path.join(
      fixture.packageRoot,
      'ios',
      'Frameworks',
      'Fake.xcframework',
      'link.bin',
    ),
  );
  const result = runLint(fixture, ['--write']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /symlink/u);
});

test('--json returns a machine-readable summary', () => {
  const fixture = createFixture();
  pin(fixture);
  const result = runLint(fixture, ['--json']);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.totalFiles, 3);
  assert.equal(summary.sdks[0].id, 'fake-sdk');
});

test('uninitialized manifest fails closed', () => {
  const fixture = createFixture();
  const result = runLint(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no SHA-256 pins/u);
});
