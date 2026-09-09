// cspell:ignore Syml npath fslib

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { stripVTControlCharacters } = require('node:util');

const checker = require('./supply-chain.cjs');

const root = path.resolve(__dirname, '../..');
const yarn = path.join(root, '.yarn/releases/yarn-4.12.0.cjs');

function json(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(t) {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-supply-chain-')),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'development/lavamoat'), {
    recursive: true,
  });
  for (const filename of [
    'supply-chain.cjs',
    'supply-chain-plugin.cjs',
    'error.cjs',
  ]) {
    fs.copyFileSync(
      path.join(__dirname, filename),
      path.join(directory, 'development/lavamoat', filename),
    );
  }
  fs.writeFileSync(
    path.join(directory, '.yarnrc.yml'),
    [
      'enableScripts: false',
      'enableGlobalCache: false',
      'enableMirror: false',
      'enableTelemetry: false',
      'nodeLinker: node-modules',
      'plugins:',
      '  - path: development/lavamoat/supply-chain-plugin.cjs',
      '',
    ].join('\n'),
  );
  json(path.join(directory, checker.POLICY_PATH), { version: 1, packages: [] });
  fs.writeFileSync(
    path.join(directory, 'yarn.lock'),
    '__metadata:\n  version: 8\n',
  );
  return directory;
}

function run(directory, ...args) {
  return spawnSync(process.execPath, [yarn, ...args], {
    cwd: directory,
    env: {
      ...process.env,
      YARN_IGNORE_PATH: '1',
      YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
      YARN_ENABLE_GLOBAL_CACHE: 'false',
      YARN_ENABLE_MIRROR: 'false',
      YARN_ENABLE_NETWORK: 'false',
      // The outer Yarn script forces this false; each fixture must exercise its
      // own effective enableScripts setting, including rejection of true.
      YARN_ENABLE_SCRIPTS: undefined,
      npm_lifecycle_event: undefined,
      npm_package_json: undefined,
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function traceEnvironments(directory) {
  fs.writeFileSync(
    path.join(directory, 'environment-trace.cjs'),
    `module.exports = {
      name: 'environment-trace',
      factory(require) {
        const fs = require('node:fs');
        const path = require('node:path');
        const { npath } = require('@yarnpkg/fslib');
        return { hooks: { setupScriptEnvironment(project, env) {
          fs.appendFileSync(path.join(npath.fromPortablePath(project.cwd), 'ENVIRONMENT'),
            JSON.stringify({ manifest: env.npm_package_json, lifecycle: env.npm_lifecycle_event || null }) + '\\n');
        } } };
      }
    };\n`,
  );
  fs.appendFileSync(
    path.join(directory, '.yarnrc.yml'),
    '  - path: environment-trace.cjs\n',
  );
  return () =>
    fs
      .readFileSync(path.join(directory, 'ENVIRONMENT'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
}

function postProcessing(directory) {
  fs.copyFileSync(
    path.join(root, '.yarn/plugins/@yarnpkg/plugin-after-install.cjs'),
    path.join(directory, 'after-install.cjs'),
  );
  fs.appendFileSync(
    path.join(directory, '.yarnrc.yml'),
    [
      '  - path: after-install.cjs',
      'afterInstall: node post-processing.cjs',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(directory, 'post-processing.cjs'),
    "require('node:fs').writeFileSync('AFTER_INSTALL_RAN', 'yes');\n",
  );
  return path.join(directory, 'AFTER_INSTALL_RAN');
}

function approve(directory, allow) {
  const result = run(directory, 'supply-chain', 'inventory');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const policy = JSON.parse(result.stdout);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json')),
  );
  manifest.dependenciesMeta = {};
  for (const entry of policy.packages) {
    entry.allow = allow;
    entry.reason = 'Reviewed local test fixture.';
    if (allow && !entry.resolution.includes('@workspace:')) {
      const name = /^(.+)@(?:file|npm):/.exec(entry.resolution)[1];
      manifest.dependenciesMeta[`${name}@${entry.version}`] = { built: true };
    }
  }
  json(path.join(directory, checker.POLICY_PATH), policy);
  json(path.join(directory, 'package.json'), manifest);
  return policy;
}

test('Yarn disables unknown workspace-only dependencies and executes only reviewed exact versions', (t) => {
  const directory = fixture(t);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    workspaces: ['apps/*'],
  });
  json(path.join(directory, 'apps/mobile/package.json'), {
    name: 'mobile-fixture',
    version: '1.0.0',
    devDependencies: { 'install-fixture': 'file:../../fixture' },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'install-fixture',
    version: '1.0.0',
    scripts: {
      postinstall: "node -e \"require('fs').writeFileSync('RAN', 'yes')\"",
    },
  });
  const marker = path.join(directory, 'node_modules/install-fixture/RAN');
  let result = run(directory, 'install');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /explicit review decision/);
  assert.equal(fs.existsSync(marker), false);
  approve(directory, false);
  result = run(directory, 'install');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.existsSync(marker), false);
  approve(directory, true);
  result = run(directory, 'install');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.existsSync(marker), true);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json')),
  );
  manifest.dependenciesMeta = { 'install-fixture': { built: true } };
  json(path.join(directory, 'package.json'), manifest);
  result = run(directory, 'install');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Unreviewed or unpinned built:true/);
});

test('Yarn blocks modified lifecycle text before execution and refuses to carry approval into inventory', (t) => {
  const directory = fixture(t);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    dependencies: { 'install-fixture': 'file:./fixture' },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'install-fixture',
    version: '1.0.0',
    scripts: { install: 'node -e "process.exit(0)"' },
  });
  run(directory, 'install');
  approve(directory, true);
  const installedPath = path.join(
    directory,
    'node_modules/install-fixture/package.json',
  );
  const installed = JSON.parse(fs.readFileSync(installedPath));
  installed.scripts.install =
    "node -e \"require('fs').writeFileSync('UNREVIEWED', 'yes')\"";
  json(installedPath, installed);
  const result = run(directory, 'rebuild', 'install-fixture');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Reviewed scripts changed/);
  assert.equal(
    fs.existsSync(
      path.join(directory, 'node_modules/install-fixture/UNREVIEWED'),
    ),
    false,
  );
  const proposed = run(directory, 'supply-chain', 'inventory');
  assert.equal(proposed.status, 0, proposed.stdout + proposed.stderr);
  assert.equal(JSON.parse(proposed.stdout).packages[0].allow, false);
});

test('implicit binding.gyp is inventoried and guarded without a lifecycle event', (t) => {
  const directory = fixture(t);
  const environments = traceEnvironments(directory);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    dependencies: { 'native-fixture': 'file:./fixture' },
    scripts: { 'node-gyp': 'node -e "process.exit(0)"' },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'native-fixture',
    version: '1.0.0',
  });
  fs.writeFileSync(
    path.join(directory, 'fixture/binding.gyp'),
    '{"targets": []}\n',
  );
  const initial = run(directory, 'install');
  assert.notEqual(initial.status, 0);
  const policy = approve(directory, true);
  assert.equal(policy.packages[0].implicitNodeGyp, true);
  assert.deepEqual(policy.packages[0].scripts, { install: 'node-gyp rebuild' });
  const result = run(directory, 'install');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    environments().some(
      (env) =>
        env.manifest ===
          path.join(directory, 'node_modules/native-fixture/package.json') &&
        env.lifecycle === null,
    ),
  );

  const actualDirectory = path.join(directory, 'node_modules/native-fixture');
  const actual = { ...policy.packages[0], directory: actualDirectory };
  const context = {
    root: directory,
    resolutions: new Map([
      [
        actual.resolution,
        { version: actual.version, checksum: actual.checksum },
      ],
    ]),
    approvals: new Map([[actual.resolution, { ...actual, allow: false }]]),
    parseSyml: () => ({
      __metadata: { version: 1 },
      [actual.resolution]: { locations: ['node_modules/native-fixture'] },
    }),
  };
  assert.throws(
    () =>
      checker.checkExecution(
        context,
        path.join(actualDirectory, 'package.json'),
      ),
    /Lifecycle execution is denied/,
  );
});

test('all explicit lifecycle events provide a package manifest; missing metadata fails closed', (t) => {
  const directory = fixture(t);
  const environments = traceEnvironments(directory);
  const scripts = Object.fromEntries(
    ['preinstall', 'install', 'postinstall'].map((event) => [
      event,
      'node -e "process.exit(0)"',
    ]),
  );
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    version: '1.0.0',
    private: true,
    dependencies: { 'lifecycle-fixture': 'file:./fixture' },
    scripts,
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'lifecycle-fixture',
    version: '1.0.0',
    scripts,
  });
  run(directory, 'install');
  approve(directory, true);
  const result = run(directory, 'install');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const manifest of [
    path.join(directory, 'package.json'),
    path.join(directory, 'node_modules/lifecycle-fixture/package.json'),
  ]) {
    assert.deepEqual(
      environments()
        .filter((env) => env.manifest === manifest)
        .map((env) => env.lifecycle),
      ['preinstall', 'install', 'postinstall'],
    );
  }
  for (const event of ['preinstall', 'install', 'postinstall']) {
    assert.throws(
      () => checker.checkExecution({}, undefined, event),
      /Cannot identify package before/,
    );
  }
});

test('manual setup validates the complete installed inventory before post-processing', (t) => {
  const directory = fixture(t);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    dependencies: { 'unreviewed-fixture': 'file:./fixture' },
    scripts: {
      'setup:dependencies':
        "node -e \"require('fs').writeFileSync('SETUP_RAN', 'yes')\"",
    },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'unreviewed-fixture',
    version: '1.0.0',
    scripts: { postinstall: 'node -e "process.exit(0)"' },
  });
  run(directory, 'install');
  const result = run(directory, 'setup:dependencies');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /explicit review decision/);
  assert.equal(fs.existsSync(path.join(directory, 'SETUP_RAN')), false);
  approve(directory, false);
  const approved = run(directory, 'setup:dependencies');
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  assert.equal(fs.existsSync(path.join(directory, 'SETUP_RAN')), true);
});

test('official lockfile-only mode skips linking and post-processing without admitting scripts', (t) => {
  const directory = fixture(t);
  const afterInstallMarker = postProcessing(directory);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    dependencies: { 'unreviewed-fixture': 'file:./fixture' },
    scripts: {
      'setup:dependencies':
        "node -e \"require('fs').writeFileSync('SETUP_RAN', 'yes')\"",
    },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'unreviewed-fixture',
    version: '1.0.0',
    scripts: {
      postinstall: "node -e \"require('fs').writeFileSync('RAN', 'yes')\"",
    },
  });
  const result = run(directory, 'install', '--mode=update-lockfile');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    stripVTControlCharacters(result.stdout),
    /Skipped due to mode=update-lockfile/,
  );
  assert.match(
    fs.readFileSync(path.join(directory, 'yarn.lock'), 'utf8'),
    /unreviewed-fixture@file:/,
  );
  assert.equal(fs.existsSync(path.join(directory, 'node_modules')), false);
  assert.equal(fs.existsSync(afterInstallMarker), false);
  const manual = run(directory, 'setup:dependencies');
  assert.notEqual(manual.status, 0);
  assert.match(manual.stdout, /installation is incomplete/);
  assert.equal(fs.existsSync(path.join(directory, 'SETUP_RAN')), false);

  for (const options of [[], ['--mode=skip-build']]) {
    const install = run(directory, 'install', ...options);
    assert.notEqual(install.status, 0);
    assert.match(install.stdout, /explicit review decision/);
    assert.equal(fs.existsSync(afterInstallMarker), false);
    assert.equal(
      fs.existsSync(
        path.join(directory, 'node_modules/unreviewed-fixture/RAN'),
      ),
      false,
    );
  }
  approve(directory, false);
  const approved = run(directory, 'install');
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  assert.equal(fs.existsSync(afterInstallMarker), true);
});

test('normal and skip-build modes reject missing install state before the later after-install plugin', (t) => {
  for (const options of [[], ['--mode=skip-build']]) {
    const directory = fixture(t);
    json(path.join(directory, 'package.json'), {
      name: 'supply-chain-fixture',
      private: true,
    });
    fs.writeFileSync(
      path.join(directory, 'damage-state.cjs'),
      `module.exports = {
        name: 'damage-state',
        factory(require) {
          const fs = require('node:fs');
          const path = require('node:path');
          const { npath } = require('@yarnpkg/fslib');
          return { hooks: { validateProjectAfterInstall(project) {
            fs.unlinkSync(path.join(npath.fromPortablePath(project.cwd), 'node_modules/.yarn-state.yml'));
          } } };
        }
      };\n`,
    );
    fs.appendFileSync(
      path.join(directory, '.yarnrc.yml'),
      '  - path: damage-state.cjs\n',
    );
    const afterInstallMarker = postProcessing(directory);
    const result = run(directory, 'install', ...options);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /installation is incomplete/);
    assert.equal(fs.existsSync(afterInstallMarker), false);
  }
});

test('lockfile-only mode preserves configuration and Git admission before resolution or fetch', (t) => {
  for (const invalid of ['scripts', 'git']) {
    const directory = fixture(t);
    json(path.join(directory, 'package.json'), {
      name: 'supply-chain-fixture',
      private: true,
      ...(invalid === 'git'
        ? {
            dependencies: { unsafe: 'https://github.com/unknown/package#main' },
          }
        : {}),
    });
    if (invalid === 'scripts') {
      const config = path.join(directory, '.yarnrc.yml');
      fs.writeFileSync(
        config,
        fs
          .readFileSync(config, 'utf8')
          .replace('enableScripts: false', 'enableScripts: true'),
      );
    }
    const result = run(directory, 'install', '--mode=update-lockfile');
    assert.notEqual(result.status, 0);
    assert.match(
      result.stdout,
      invalid === 'scripts' ? /enableScripts/ : /HTTPS and a full commit SHA/,
    );
    assert.doesNotMatch(result.stdout, /Request to|git clone/);
    assert.equal(fs.existsSync(path.join(directory, 'node_modules')), false);
  }
});

test('incomplete node_modules fails closed instead of silently omitting dependencies', (t) => {
  const directory = fixture(t);
  const context = { root: directory, parseSyml: JSON.parse };
  assert.throws(
    () => checker.readInstalled(context),
    /installation is incomplete/,
  );
});
test('reviewed optional dependency failures keep Yarn native optional semantics', (t) => {
  const directory = fixture(t);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    optionalDependencies: { 'optional-fixture': 'file:./fixture' },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'optional-fixture',
    version: '1.0.0',
    scripts: { install: 'node -e "process.exit(1)"' },
  });
  run(directory, 'install');
  approve(directory, true);
  const result = run(directory, 'install');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /couldn't be built successfully/);
});

test('published files under build/ are verified; generated outputs do not replace their hashes', (t) => {
  const directory = fixture(t);
  const packageDirectory = path.join(directory, 'fixture');
  json(path.join(packageDirectory, 'package.json'), {
    name: 'conditional-fixture',
    version: '1.0.0',
    scripts: { install: 'node build/payload.js' },
  });
  fs.mkdirSync(path.join(packageDirectory, 'build'), { recursive: true });
  fs.writeFileSync(
    path.join(packageDirectory, 'build/payload.js'),
    'process.exit(0);\n',
  );
  const expected = checker.publishedFileHashes(packageDirectory, {
    'build/payload.js': '',
    'package.json': '',
  });
  const resolution = 'conditional-fixture@npm:1.0.0';
  const context = {
    root: directory,
    resolutions: new Map([[resolution, { version: '1.0.0' }]]),
    approvals: new Map([
      [
        resolution,
        {
          resolution,
          version: '1.0.0',
          scripts: { install: 'node build/payload.js' },
          implicitNodeGyp: false,
          checksum: null,
          allow: true,
          fileHashes: expected,
        },
      ],
    ]),
    parseSyml: () => ({
      __metadata: { version: 1 },
      [resolution]: { locations: ['fixture'] },
    }),
  };
  json(path.join(directory, 'node_modules/.yarn-state.yml'), {});
  fs.writeFileSync(
    path.join(packageDirectory, 'build/generated-output'),
    'generated',
  );
  assert.deepEqual(
    checker.publishedFileHashes(packageDirectory, expected),
    expected,
  );
  checker.checkExecution(
    context,
    path.join(packageDirectory, 'package.json'),
    'install',
  );
  fs.writeFileSync(
    path.join(packageDirectory, 'build/payload.js'),
    'process.exit(1);\n',
  );
  assert.notDeepEqual(
    checker.publishedFileHashes(packageDirectory, expected),
    expected,
  );
  assert.throws(
    () =>
      checker.checkExecution(
        context,
        path.join(packageDirectory, 'package.json'),
        'install',
      ),
    /Reviewed fileHashes changed/,
  );
});

test('non-GitHub hosts, floating Git refs and unapproved new transitive Git dependencies fail before fetching', (t) => {
  const sha = '1'.repeat(40);
  for (const specifier of [
    `https://gitlab.com/team/package.git#${sha}`,
    `git+https://github.com/team/package.git#${sha}`,
    'https://github.com/team/package#main',
    `ssh://git@example.com/team/package.git#${sha}`,
    'team/package#main',
    'exec:./unreviewed-generator.js',
  ]) {
    assert.throws(
      () => checker.gitUrl(specifier),
      /HTTPS and a full commit SHA/,
    );
  }
  assert.throws(
    () =>
      checker.gitUrl(
        'patch:package@https%3A%2F%2Fgithub.com%2Fteam%2Fpackage%23main#./change.patch',
      ),
    /Patched dependencies must reference npm registry sources/,
  );
  assert.equal(
    checker.gitUrl('patch:package@npm%3A1.0.0#./change.patch'),
    null,
  );
  const directory = fixture(t);
  json(path.join(directory, 'package.json'), {
    name: 'supply-chain-fixture',
    private: true,
    dependencies: { 'dependency-fixture': 'file:./fixture' },
  });
  json(path.join(directory, 'fixture/package.json'), {
    name: 'dependency-fixture',
    version: '1.0.0',
    dependencies: {
      'new-git-dependency': `https://github.com/unknown/package#${sha}`,
    },
  });
  const result = run(directory, 'install');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Review new Git source before install/);
  assert.doesNotMatch(result.stdout, /Request to|git clone/);
});
