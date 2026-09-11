// cspell:ignore AppArmor apparmor lavamoat tunables userns

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { prepareProfiles } = require('./prepare-linux-browser-sandbox.cjs');

function fixture(t) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-browser-sandbox-')),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const chromiumRoot = path.join(root, 'browsers');
  const electronRoot = path.join(root, 'node_modules/electron');
  fs.mkdirSync(chromiumRoot, { recursive: true });
  fs.mkdirSync(electronRoot, { recursive: true });
  const chromiumExecutable = path.join(chromiumRoot, 'chrome');
  const electronExecutable = path.join(electronRoot, 'electron');
  for (const executable of [chromiumExecutable, electronExecutable]) {
    fs.writeFileSync(executable, Buffer.from([0x7f, 0x45, 0x4c, 0x46]), {
      mode: 0o700,
    });
  }
  return {
    root,
    output: path.join(root, 'profiles'),
    chromiumRoot,
    chromiumExecutable,
    electronRoot,
    electronExecutable,
  };
}

test('AppArmor profiles attach only to the two resolved browser files', (t) => {
  const input = fixture(t);
  const alias = path.join(input.chromiumRoot, 'alias');
  fs.symlinkSync(input.chromiumExecutable, alias);
  const executables = prepareProfiles({ ...input, chromiumExecutable: alias });
  assert.deepEqual(executables, {
    chromium: input.chromiumExecutable,
    electron: input.electronExecutable,
  });
  assert.deepEqual(fs.readdirSync(input.output).toSorted(), [
    'onekey-lavamoat-ci-chromium',
    'onekey-lavamoat-ci-electron',
  ]);
  for (const [name, executable] of Object.entries(executables)) {
    assert.equal(
      fs.readFileSync(
        path.join(input.output, `onekey-lavamoat-ci-${name}`),
        'utf8',
      ),
      `abi <abi/4.0>,\ninclude <tunables/global>\n\nprofile onekey-lavamoat-ci-${name} "${executable}" flags=(unconfined) {\n  userns,\n}\n`,
    );
  }
});

test('profile generation refuses an executable that escapes its installation through a symlink', (t) => {
  const input = fixture(t);
  const outside = path.join(input.root, 'chrome');
  fs.renameSync(input.chromiumExecutable, outside);
  fs.symlinkSync(outside, input.chromiumExecutable);
  assert.throws(() => prepareProfiles(input), /inside its installation/);
  assert.equal(fs.existsSync(input.output), false);
});

test('profile generation rejects AppArmor syntax and wildcard characters in real paths', (t) => {
  for (const name of ['*', '?', '[a]', '{a,b}', '@{HOME}', '"', '\n', '\\']) {
    const input = fixture(t);
    const directory = path.join(input.chromiumRoot, name);
    fs.mkdirSync(directory);
    const executable = path.join(directory, 'chrome');
    fs.renameSync(input.chromiumExecutable, executable);
    assert.throws(
      () => prepareProfiles({ ...input, chromiumExecutable: executable }),
      /exact safe path/,
    );
    assert.equal(fs.existsSync(input.output), false);
  }
});

test('profile generation rejects missing, non-ELF, non-executable and wrongly named binaries', (t) => {
  for (const invalid of ['missing', 'script', 'mode', 'name']) {
    const input = fixture(t);
    if (invalid === 'missing') fs.unlinkSync(input.electronExecutable);
    if (invalid === 'script')
      fs.writeFileSync(input.electronExecutable, '#!/bin/sh\n');
    if (invalid === 'mode') fs.chmodSync(input.electronExecutable, 0o600);
    if (invalid === 'name') {
      const renamed = path.join(input.electronRoot, 'node');
      fs.renameSync(input.electronExecutable, renamed);
      input.electronExecutable = renamed;
    }
    assert.throws(() => prepareProfiles(input));
    assert.equal(fs.existsSync(input.output), false);
  }
});

test('profile generation refuses to replace an existing output or follow its symlink', (t) => {
  const input = fixture(t);
  const preserved = path.join(input.root, 'preserved');
  fs.mkdirSync(preserved);
  fs.writeFileSync(
    path.join(preserved, 'onekey-lavamoat-ci-chromium'),
    'existing',
  );
  fs.symlinkSync(preserved, input.output);
  assert.throws(() => prepareProfiles(input), { code: 'EEXIST' });
  assert.equal(
    fs.readFileSync(
      path.join(preserved, 'onekey-lavamoat-ci-chromium'),
      'utf8',
    ),
    'existing',
  );
});
