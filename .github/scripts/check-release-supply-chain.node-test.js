const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { checkReleaseSupplyChain } = require('./check-release-supply-chain');

const SHA = 'a'.repeat(40);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-release-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write(
    '.github/workflows/release-test.yml',
    `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${SHA}\n`,
  );
  write('package.json', '{"scripts":{}}');
  write(
    '.github/tools/eas-cli/package.json',
    '{"dependencies":{"eas-cli":"27.2.0"}}',
  );
  write(
    '.github/tools/eas-cli/yarn.lock',
    '"eas-cli@npm:27.2.0":\n  version: 27.2.0\n  checksum: fixture\n',
  );
  write(
    '.github/tools/eas-cli/.yarnrc.yml',
    "enableScripts: false\nafterInstall: ''\n",
  );
  return { root, write, check: () => checkReleaseSupplyChain(root) };
}

test('accepts immutable references and ignores action-looking run content', (t) => {
  const f = fixture(t);
  f.write(
    '.github/workflows/release-test.yml',
    `jobs:\n  build:\n    steps:\n      - uses: 'actions/checkout@${SHA}' # pinned\n      - run: |\n          echo 'uses: example/action@main'\n`,
  );
  assert.deepEqual(f.check().errors, []);
});

test('walks reusable workflows and nested composite actions, including cycles', (t) => {
  const f = fixture(t);
  f.write(
    '.github/workflows/release-test.yml',
    'jobs:\n  build:\n    uses: ./.github/workflows/build.yaml\n',
  );
  f.write(
    '.github/workflows/build.yaml',
    'jobs:\n  build:\n    steps:\n      - uses: ./.github/actions/nested\n',
  );
  f.write(
    '.github/actions/nested/action.yaml',
    'runs:\n  using: composite\n  steps:\n    - uses: ./.github/actions/nested\n    - uses: actions/cache/restore@v4\n',
  );
  const result = f.check();
  assert.equal(result.files.length, 3);
  assert.match(
    result.errors.join('\n'),
    /nested\/action.yaml: unpinned action actions\/cache\/restore@v4/u,
  );
});

for (const reference of [
  'actions/checkout@v4',
  'actions/checkout@main',
  `actions/checkout@${SHA.slice(1)}`,
  'docker://alpine:latest',
]) {
  test(`rejects mutable or incomplete reference ${reference}`, (t) => {
    const f = fixture(t);
    f.write(
      '.github/workflows/release-test.yml',
      `jobs:\n  build:\n    steps:\n      - uses: ${reference}\n`,
    );
    assert.match(f.check().errors.join('\n'), /unpinned action/u);
  });
}

test('rejects unresolved local actions and duplicate YAML keys', (t) => {
  const f = fixture(t);
  f.write(
    '.github/workflows/release-test.yml',
    'jobs:\n  build:\n    steps:\n      - uses: ./.github/actions/missing\n',
  );
  assert.notEqual(f.check().errors.length, 0);
  f.write('.github/workflows/release-test.yml', 'jobs: {}\njobs: {}\n');
  assert.match(f.check().errors.join('\n'), /unique/u);
});

test('checks security-checks and package scripts for implicit downloads', (t) => {
  const f = fixture(t);
  f.write(
    '.github/workflows/security-checks.yml',
    'jobs:\n  check:\n    steps:\n      - run: npx tsx check.ts\n',
  );
  f.write(
    'package.json',
    '{"scripts":{"release":"yarn dlx eas-cli@latest build"}}',
  );
  assert.equal(f.check().errors.length, 2);
});

test('rejects package-manager downloads for all release tools', (t) => {
  const f = fixture(t);
  f.write(
    '.github/workflows/release-test.yml',
    'jobs:\n  build:\n    steps:\n      - run: npx sentry-cli releases list\n',
  );
  assert.match(f.check().errors.join('\n'), /locked local tools/u);
});

test('rejects EAS action installers even when their action is pinned', (t) => {
  const f = fixture(t);
  f.write(
    '.github/workflows/release-test.yml',
    `jobs:\n  build:\n    steps:\n      - uses: expo/expo-github-action@${SHA}\n        with:\n          eas-version: latest\n`,
  );
  assert.match(f.check().errors.join('\n'), /locked CI EAS project/u);
});

test('requires exact EAS version, matching integrity and disabled install hooks', (t) => {
  const f = fixture(t);
  f.write(
    '.github/tools/eas-cli/package.json',
    '{"dependencies":{"eas-cli":"^27.2.0"}}',
  );
  assert.match(f.check().errors.join('\n'), /exact version/u);
  f.write(
    '.github/tools/eas-cli/package.json',
    '{"dependencies":{"eas-cli":"27.2.0"}}',
  );
  f.write(
    '.github/tools/eas-cli/yarn.lock',
    '"eas-cli@npm:27.2.0":\n  version: 27.2.0\n',
  );
  assert.match(f.check().errors.join('\n'), /checksummed/u);
  f.write(
    '.github/tools/eas-cli/.yarnrc.yml',
    'enableScripts: true\nafterInstall: yarn postinstall\n',
  );
  assert.match(f.check().errors.join('\n'), /disable dependency scripts/u);
});
