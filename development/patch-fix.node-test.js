const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('removes patched packages once, including sequenced and scoped patches', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-patch-fix-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const patches = [
    'react-native+0.86.2+001+initial.patch',
    'react-native+0.86.2+002+fix-hermes-podspec.patch',
    'react-native+0.86.2+003+fix-ios26-switch-thumb-tint.patch',
    'react-native+0.86.2+004+defer-ios26-nav-transition-focus.patch',
    'react-native+0.86.2+005+fix-thin-box-one-sided-border.patch',
    'react-native+0.86.2+006+fix-ios-refresh-offset.patch',
    '@scope+sequenced+1.2.3+001+initial.patch',
    '@scope+regular+1.2.3.patch',
    'regular+1.2.3.patch',
    'dev-only+1.2.3.dev.patch',
    'README.md',
  ];
  const targets = [
    'react-native',
    '@scope/sequenced',
    '@scope/regular',
    'regular',
    'dev-only',
  ];
  fs.mkdirSync(path.join(root, 'patches'));
  for (const filename of patches) {
    fs.writeFileSync(path.join(root, 'patches', filename), 'fixture');
  }
  for (const name of [
    ...targets,
    'unrelated',
    '@scope/unrelated',
    'README.md',
  ]) {
    const directory = path.join(root, 'node_modules', name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'sentinel'), 'keep');
  }

  const output = execFileSync(
    process.execPath,
    [path.join(__dirname, 'patch-fix.js')],
    { cwd: root, encoding: 'utf8' },
  );

  for (const name of targets) {
    assert.equal(
      fs.existsSync(path.join(root, 'node_modules', name)),
      false,
      name,
    );
  }
  for (const name of ['unrelated', '@scope/unrelated', 'README.md']) {
    assert.equal(
      fs.readFileSync(
        path.join(root, 'node_modules', name, 'sentinel'),
        'utf8',
      ),
      'keep',
      name,
    );
  }
  assert.equal(
    output.split('\n').filter((line) => line.startsWith('Removed: ')).length,
    targets.length,
  );
  assert.doesNotMatch(output, /Not found, skip:/u);
  for (const filename of patches) {
    assert.equal(
      fs.readFileSync(path.join(root, 'patches', filename), 'utf8'),
      'fixture',
    );
  }
});
