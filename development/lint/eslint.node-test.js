const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  OXLINT_CONFIG_PATH,
  createCspellOnlyOxlintConfig,
  createOxlintConfigWithoutCspell,
  createSignalCleanupHandler,
  createTypeAwareOxlintConfig,
  filterOxlintTargetFiles,
  getCspellFullScanReason,
  getJsPluginRulePrefix,
  getTempTypeAwareConfigName,
  getTempTypeAwareConfigPath,
  parseOxlintConfig,
  parseOxlintCounts,
  resolveCspellScope,
  resolveLintPasses,
  resolvePackageBinary,
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

test('selects oxlint passes so CI can split the type-aware pass into its own job', () => {
  const all = { standard: true, typeAware: true, format: true };
  assert.deepEqual(resolveLintPasses(undefined), all);
  assert.deepEqual(resolveLintPasses(''), all);
  assert.deepEqual(resolveLintPasses('all'), all);
  assert.deepEqual(resolveLintPasses('standard'), {
    standard: true,
    typeAware: false,
    format: true,
  });
  assert.deepEqual(resolveLintPasses('type-aware'), {
    standard: false,
    typeAware: true,
    format: false,
  });
  assert.throws(() => resolveLintPasses('typeaware'), /ONEKEY_OXLINT_PASS/);
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

test('signal cleanup handler kills active child process group, deletes temp config, and exits with 130/143', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-oxlint-test-'));
  const tempConfigPath = getTempTypeAwareConfigPath(tempDir, 4242);
  fs.writeFileSync(tempConfigPath, '{}');

  const processGroupKills = [];
  const exitCodes = [];
  const fakeChild = {
    pid: 9876,
    killed: false,
    kill() {
      this.killed = true;
    },
  };

  const handleSignal = createSignalCleanupHandler({
    tempConfigPath,
    getActiveChild: () => fakeChild,
    killProcess: (pid, signal) => processGroupKills.push({ pid, signal }),
    exitProcess: (code) => exitCodes.push(code),
  });

  handleSignal('SIGTERM');

  assert.equal(fs.existsSync(tempConfigPath), false);
  if (process.platform !== 'win32') {
    assert.deepEqual(processGroupKills, [{ pid: -9876, signal: 'SIGTERM' }]);
  }
  assert.deepEqual(exitCodes, [143]);

  fs.writeFileSync(tempConfigPath, '{}');
  fakeChild.killed = false;
  handleSignal('SIGINT');

  assert.equal(fs.existsSync(tempConfigPath), false);
  if (process.platform !== 'win32') {
    assert.deepEqual(processGroupKills, [
      { pid: -9876, signal: 'SIGTERM' },
      { pid: -9876, signal: 'SIGINT' },
    ]);
  }
  assert.deepEqual(exitCodes, [143, 130]);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('resolves package binary without requiring ./package.json in package exports', () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-oxlint-bin-test-'),
  );
  const pkgDir = path.join(tempDir, 'node_modules', 'mock-oxlint');
  const binFile = path.join(pkgDir, 'bin', 'mock-oxlint.js');
  fs.mkdirSync(path.dirname(binFile), { recursive: true });
  fs.writeFileSync(binFile, '#!/usr/bin/env node\n');
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({
      name: 'mock-oxlint',
      version: '1.0.0',
      exports: {
        '.': './dist/index.js',
      },
      bin: {
        'mock-oxlint': './bin/mock-oxlint.js',
      },
    }),
  );

  assert.equal(resolvePackageBinary('mock-oxlint', tempDir), binFile);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('splits .oxlintrc.json into a spellchecker-only config and the rest without losing or duplicating rules', () => {
  const parsed = parseOxlintConfig(fs.readFileSync(OXLINT_CONFIG_PATH, 'utf8'));
  const withoutCspell = createOxlintConfigWithoutCspell(parsed);
  const cspellOnly = createCspellOnlyOxlintConfig(parsed);

  const pluginPrefixes = (config) =>
    config.jsPlugins.map((pluginEntry) => getJsPluginRulePrefix(pluginEntry));
  assert.ok(!pluginPrefixes(withoutCspell).includes('@cspell/'));
  assert.deepEqual(pluginPrefixes(cspellOnly), ['@cspell/']);
  assert.equal(
    withoutCspell.jsPlugins.length + cspellOnly.jsPlugins.length,
    parsed.jsPlugins.length,
  );

  const ruleNames = (rules) => Object.keys(rules ?? {}).toSorted();
  assert.deepEqual(
    [
      ...ruleNames(withoutCspell.rules),
      ...ruleNames(cspellOnly.rules),
    ].toSorted(),
    ruleNames(parsed.rules),
  );
  assert.ok(
    ruleNames(cspellOnly.rules).every((rule) => rule.startsWith('@cspell/')),
  );
  assert.deepEqual(
    cspellOnly.rules['@cspell/spellchecker'],
    parsed.rules['@cspell/spellchecker'],
  );

  // Every native category and plugin is off in the spellchecker-only pass.
  assert.deepEqual(cspellOnly.plugins, []);
  assert.ok(
    Object.values(cspellOnly.categories).every((level) => level === 'off'),
  );
  assert.deepEqual(cspellOnly.ignorePatterns, parsed.ignorePatterns);
  assert.deepEqual(withoutCspell.ignorePatterns, parsed.ignorePatterns);
  assert.deepEqual(withoutCspell.categories, parsed.categories);
  assert.deepEqual(withoutCspell.plugins, parsed.plugins);
});

test('keeps spellchecker overrides only in the spellchecker-only config', () => {
  const config = {
    jsPlugins: [
      { name: '@cspell', specifier: 'oxlint-plugin-cspell' },
      'eslint-plugin-ban',
    ],
    categories: { correctness: 'error' },
    rules: { '@cspell/spellchecker': 'warn', 'ban/ban': 'error' },
    overrides: [
      {
        files: ['a/**'],
        rules: { '@cspell/spellchecker': 'off', 'ban/ban': 'off' },
      },
      { files: ['b/**'], rules: { 'no-console': 'error' } },
    ],
  };
  assert.deepEqual(createCspellOnlyOxlintConfig(config).overrides, [
    { files: ['a/**'], rules: { '@cspell/spellchecker': 'off' } },
  ]);
  assert.deepEqual(createOxlintConfigWithoutCspell(config).overrides, [
    { files: ['a/**'], rules: { 'ban/ban': 'off' } },
    { files: ['b/**'], rules: { 'no-console': 'error' } },
  ]);
});

test('forces a full spellchecker scan when its configuration, dictionaries or versions change', () => {
  for (const file of [
    'cspell.json',
    'development/spellCheckerSkipWords.txt',
    '.oxlintrc.json',
    'yarn.lock',
    'package.json',
    'development/lint/eslint.js',
    'packages/kit/.cspell.json',
    'apps/web/cspell.config.yaml',
  ]) {
    assert.equal(
      getCspellFullScanReason(['src/a.ts', file]),
      `${file} changed`,
    );
  }
  assert.equal(
    getCspellFullScanReason([
      'packages/kit/package.json',
      'packages/kit/src/cspellUtils.ts',
      'docs/readme.md',
    ]),
    null,
  );
});

test('only spellchecks files oxlint lints', () => {
  assert.deepEqual(
    filterOxlintTargetFiles([
      'a.ts',
      'b.tsx',
      'c.js',
      'd.jsx',
      'e.mjs',
      'f.cjs',
      'g.mts',
      'h.cts',
      'i.json',
      'j.md',
      'k.d.ts',
    ]),
    [
      'a.ts',
      'b.tsx',
      'c.js',
      'd.jsx',
      'e.mjs',
      'f.cjs',
      'g.mts',
      'h.cts',
      'k.d.ts',
    ],
  );
});

test('falls back to a full spellchecker scan unless a clean diff is available', () => {
  const config = {
    jsPlugins: [{ name: '@cspell', specifier: 'oxlint-plugin-cspell' }],
  };
  const unexpectedDiff = () => {
    throw new Error('should not diff');
  };

  assert.equal(
    resolveCspellScope({ base: '', config, getChangedFiles: unexpectedDiff })
      .mode,
    'full',
  );
  assert.equal(
    resolveCspellScope({
      base: 'HEAD^1',
      config: { jsPlugins: [] },
      getChangedFiles: unexpectedDiff,
    }).mode,
    'full',
  );
  assert.deepEqual(
    resolveCspellScope({
      base: 'HEAD^1',
      config,
      getChangedFiles: () => {
        throw new Error("fatal: bad revision 'HEAD^1'\nmore");
      },
    }),
    {
      mode: 'full',
      reason: "cannot diff against HEAD^1: fatal: bad revision 'HEAD^1'",
    },
  );
  assert.deepEqual(
    resolveCspellScope({
      base: 'HEAD^1',
      config,
      getChangedFiles: () => ['src/a.ts', 'cspell.json'],
    }),
    { mode: 'full', reason: 'cspell.json changed' },
  );
  assert.deepEqual(
    resolveCspellScope({
      base: 'HEAD^1',
      config,
      getChangedFiles: () => ['src/a.ts', 'docs/b.md', 'src/c.tsx'],
    }),
    { mode: 'changed', files: ['src/a.ts', 'src/c.tsx'] },
  );
});
