const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  OXLINT_CONFIG_PATH,
  createSignalCleanupHandler,
  createTypeAwareOxlintConfig,
  getJsPluginRulePrefix,
  getTempTypeAwareConfigName,
  getTempTypeAwareConfigPath,
  parseOxlintConfig,
  parseOxlintCounts,
} = require('./eslint');

test('derives rule prefixes for named, package, and file-path oxlint jsPlugins', () => {
  assert.equal(
    getJsPluginRulePrefix({
      name: '@cspell',
      specifier: 'oxlint-plugin-cspell',
    }),
    '@cspell/',
  );
  assert.equal(
    getJsPluginRulePrefix('eslint-plugin-import-path'),
    'import-path/',
  );
  assert.equal(
    getJsPluginRulePrefix('./development/plugins/eslint-plugin-onekey.js'),
    'onekey/',
  );
});

test('strips jsPlugins and their rules from .oxlintrc.json while preserving native and type-aware rules', () => {
  const rawConfig = fs.readFileSync(OXLINT_CONFIG_PATH, 'utf8');
  const parsed = parseOxlintConfig(rawConfig);
  const typeAwareConfig = createTypeAwareOxlintConfig(parsed);

  assert.deepEqual(typeAwareConfig.jsPlugins, []);
  assert.equal(
    typeAwareConfig.rules['typescript/no-floating-promises'][0],
    'error',
  );
  assert.equal(typeAwareConfig.rules['typescript/no-unsafe-call'], 'error');
  assert.equal(typeAwareConfig.rules['no-restricted-imports'][0], 'error');

  for (const ruleName of Object.keys(typeAwareConfig.rules)) {
    assert.equal(
      ruleName.startsWith('@cspell/') ||
        ruleName.startsWith('import-path/') ||
        ruleName.startsWith('props-checker/') ||
        ruleName.startsWith('ban/') ||
        ruleName.startsWith('use-effect-no-deps/') ||
        ruleName.startsWith('import-js/') ||
        ruleName.startsWith('onekey/'),
      false,
      `Expected jsPlugin rule ${ruleName} to be removed from root rules`,
    );
  }

  for (const override of typeAwareConfig.overrides ?? []) {
    for (const ruleName of Object.keys(override.rules ?? {})) {
      assert.equal(
        ruleName.startsWith('onekey/'),
        false,
        `Expected jsPlugin rule ${ruleName} to be removed from override rules`,
      );
    }
  }

  assert.deepEqual(typeAwareConfig.ignorePatterns, parsed.ignorePatterns);
});

test('parses warning and error counts from oxlint summary output', () => {
  assert.deepEqual(
    parseOxlintCounts('Found 0 warnings and 0 errors.\nFinished in 9.3s'),
    { warnings: 0, errors: 0 },
  );
  assert.deepEqual(
    parseOxlintCounts('Found 1 warning and 3 errors.\nFinished in 12.1s'),
    { warnings: 1, errors: 3 },
  );
});

test('scopes temporary type-aware config path by pid to prevent concurrent run collisions', () => {
  assert.equal(
    getTempTypeAwareConfigName(12_345),
    '.oxlintrc.type-aware.12345.tmp.json',
  );
  assert.notEqual(
    getTempTypeAwareConfigPath('/repo', 1001),
    getTempTypeAwareConfigPath('/repo', 1002),
  );
});

test('signal cleanup handler kills active child, deletes temp config, and exits with 130/143', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-oxlint-test-'));
  const tempConfigPath = getTempTypeAwareConfigPath(tempDir, 4242);
  fs.writeFileSync(tempConfigPath, '{}');

  const killedSignals = [];
  const exitCodes = [];
  const fakeChild = {
    killed: false,
    kill(signal) {
      killedSignals.push(signal);
      this.killed = true;
    },
  };

  const handleSignal = createSignalCleanupHandler({
    tempConfigPath,
    getActiveChild: () => fakeChild,
    exitProcess: (code) => exitCodes.push(code),
  });

  handleSignal('SIGTERM');

  assert.equal(fs.existsSync(tempConfigPath), false);
  assert.deepEqual(killedSignals, ['SIGTERM']);
  assert.deepEqual(exitCodes, [143]);

  fs.writeFileSync(tempConfigPath, '{}');
  fakeChild.killed = false;
  handleSignal('SIGINT');

  assert.equal(fs.existsSync(tempConfigPath), false);
  assert.deepEqual(killedSignals, ['SIGTERM', 'SIGINT']);
  assert.deepEqual(exitCodes, [143, 130]);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
