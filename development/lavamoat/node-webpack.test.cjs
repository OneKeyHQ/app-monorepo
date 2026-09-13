// cspell:ignore LavaMoat lavamoat stoprocent Napi napi

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const {
  createNodeWebpackConfiguration,
  compileNodeWebpack,
} = require('./node-webpack.cjs');

function write(directory, name, source) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

function fixture() {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-node-webpack-')),
  );
  write(
    directory,
    'package.json',
    JSON.stringify({
      name: 'node-fixture-root',
      dependencies: { allowed: '1.0.0', denied: '1.0.0' },
    }),
  );
  for (const name of ['allowed', 'denied']) {
    write(
      directory,
      `node_modules/${name}/package.json`,
      JSON.stringify({ name, version: '1.0.0', browser: false }),
    );
  }
  return directory;
}

function configuration(directory, options = {}) {
  return createNodeWebpackConfiguration({
    context: directory,
    entry: './index.js',
    filename: 'main.js',
    outputPath: path.join(directory, 'dist'),
    policyLocation: directory,
    buildOptions: { target: 'node22' },
    ...options,
  });
}

test('protected Node modules retain package ownership and enforce builtin members', async () => {
  const directory = fixture();
  try {
    write(
      directory,
      'node_modules/allowed/index.js',
      `const { basename } = require('node:path');
      module.exports = { basename: basename('/tmp/example.txt'), processType: typeof process,
      mutation: Reflect.set(Object.prototype, '__nodeProbeMutation', true) };`,
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `module.exports = () => {
      try { require('node:fs').readFileSync('/not-permitted'); return false; }
      catch (error) { return error.message.includes('not allowed'); }
    };`,
    );
    write(
      directory,
      'index.js',
      `console.log(JSON.stringify({ ...require('allowed'), denied: require('denied')(),
      frozen: Object.isFrozen(Array.prototype), dirname: __dirname }));`,
    );
    await compileNodeWebpack(
      configuration(directory, { generatePolicy: true }),
    );
    const policy = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json')),
    );
    assert.equal(policy.resources.allowed.builtin['node:path.basename'], true);
    assert.equal(policy.resources.denied.builtin['node:fs.readFileSync'], true);
    write(
      directory,
      'policy.json',
      JSON.stringify({
        resources: {
          allowed: { builtin: { 'node:path.basename': true } },
          denied: {},
        },
      }),
    );
    await compileNodeWebpack(configuration(directory));
    const executable = path.join(directory, 'dist/main.js');
    const source = fs.readFileSync(executable, 'utf8');
    const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
    const rawSes = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
    assert.equal(source.split(rawSes).length, 2);
    const child = spawnSync(process.execPath, [executable], {
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), {
      basename: 'example.txt',
      processType: 'undefined',
      mutation: false,
      denied: true,
      frozen: true,
      dirname: path.join(directory, 'dist'),
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('trusted esbuild shims preserve real package identity and cannot be selected by source', async () => {
  const directory = fixture();
  const buildOptions = {
    target: 'node22',
    external: ['allowed'],
    plugins: [
      {
        name: 'exact-shim-fixture',
        setup(build) {
          build.onResolve({ filter: /^allowed$/ }, () => ({
            path: 'allowed',
            namespace: 'fixture-shim',
          }));
          build.onLoad({ filter: /.*/, namespace: 'fixture-shim' }, () => ({
            contents: 'module.exports = typeof process;',
            loader: 'js',
          }));
        },
      },
    ],
  };
  try {
    write(
      directory,
      'node_modules/allowed/index.js',
      'throw Error("Original source must be shimmed");',
    );
    write(directory, 'index.js', 'console.log(require("allowed"));');
    write(
      directory,
      'policy.json',
      JSON.stringify({ resources: { allowed: {} } }),
    );
    await compileNodeWebpack(configuration(directory, { buildOptions }));
    const result = spawnSync(
      process.execPath,
      [path.join(directory, 'dist/main.js')],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'undefined');
    write(directory, 'identity-loader.cjs', 'module.exports = value => value;');
    for (const request of [
      'allowed?__onekeyNodeBuildNamespace=fixture-shim',
      'allowed?%5f%5fonekeyNodeBuildNamespace=fixture-shim',
      'allowed?ignored=1&%5F%5FonekeyNodeBuildNamespace=fixture-shim#fragment',
      './identity-loader.cjs!allowed?%5f%5fonekeyNodeBuildNamespace=fixture-shim#fragment',
      './identity-loader.cjs?%5f%5fonekeyNodeBuildNamespace=fixture-shim!allowed',
    ]) {
      write(directory, 'index.js', `require(${JSON.stringify(request)});`);
      await assert.rejects(
        compileNodeWebpack(configuration(directory, { buildOptions })),
        /Source modules cannot select trusted build shims/,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('a workspace entry maps symlinked production packages from its own declared graph', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-node-workspace-')),
  );
  const workspace = path.join(directory, 'apps/cli');
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'monorepo',
        workspaces: ['apps/*', 'packages/*'],
      }),
    );
    write(
      workspace,
      'package.json',
      JSON.stringify({
        name: 'cli-workspace',
        dependencies: { core: 'workspace:*' },
      }),
    );
    write(
      directory,
      'packages/core/package.json',
      JSON.stringify({
        name: 'core',
        version: '1.0.0',
        dependencies: { helper: '1.0.0' },
      }),
    );
    write(
      directory,
      'packages/core/index.js',
      'module.exports = require("helper");',
    );
    write(
      directory,
      'node_modules/helper/package.json',
      JSON.stringify({ name: 'helper', version: '1.0.0' }),
    );
    write(
      directory,
      'node_modules/helper/index.js',
      'module.exports = () => require("node:fs").readFileSync("/not-permitted");',
    );
    fs.symlinkSync(
      path.join(directory, 'packages/core'),
      path.join(directory, 'node_modules/core'),
      'junction',
    );
    write(
      workspace,
      'index.js',
      `try { require('core')(); } catch (error) { console.log(error.message.includes('not allowed')); }`,
    );
    await compileNodeWebpack(
      configuration(workspace, { generatePolicy: true }),
    );
    const policy = JSON.parse(
      fs.readFileSync(path.join(workspace, 'policy.json'), 'utf8'),
    );
    assert.equal(policy.resources.core.packages['core>helper'], true);
    assert.equal(
      policy.resources['core>helper'].builtin['node:fs.readFileSync'],
      true,
    );
    policy.resources['core>helper'] = {};
    write(workspace, 'policy.json', JSON.stringify(policy));
    await compileNodeWebpack(configuration(workspace));
    const child = spawnSync(
      process.execPath,
      [path.join(workspace, 'dist/main.js')],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), 'true');
    await assert.rejects(
      compileNodeWebpack(
        configuration(workspace, {
          context: directory,
          entry: path.join(workspace, 'index.js'),
          generatePolicy: true,
        }),
      ),
      /unknown package directory/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('exact native boundaries protect JavaScript callers and reject a forged resource identity', async () => {
  const directory = fixture();
  try {
    write(
      directory,
      'node_modules/allowed/index.js',
      'module.exports = require("./native").getValue();',
    );
    write(
      directory,
      'node_modules/allowed/native.js',
      'module.exports = { getValue: () => "native-result" };',
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `module.exports = () => {
      try { require('allowed/native'); return false; }
      catch (error) { return error.message.includes('not allowed'); }
    };`,
    );
    write(
      directory,
      'node_modules/denied/fake.js',
      'module.exports = typeof process;',
    );
    write(directory, 'identity-loader.cjs', 'module.exports = value => value;');
    const forged =
      './node_modules/allowed/native.js!=!./identity-loader.cjs!./node_modules/denied/fake.js';
    write(
      directory,
      'index.js',
      `console.log(JSON.stringify({ allowed: require('allowed'), denied: require('denied')(), forged: require(${JSON.stringify(forged)}) }));`,
    );
    const nativeModules = [
      {
        file: path.join(directory, 'node_modules/allowed/native.js'),
        request: 'allowed/native',
      },
    ];
    await compileNodeWebpack(
      configuration(directory, { generatePolicy: true, nativeModules }),
    );
    const policy = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    assert.equal(policy.resources.allowed.builtin['allowed/native'], true);
    assert.equal(policy.resources.denied.builtin['allowed/native'], true);
    policy.resources.denied = {};
    write(directory, 'policy.json', JSON.stringify(policy));
    await compileNodeWebpack(configuration(directory, { nativeModules }));
    const child = spawnSync(
      process.execPath,
      [path.join(directory, 'dist/main.js')],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), {
      allowed: 'native-result',
      denied: true,
      forged: 'undefined',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the shipped passport JavaScript wrapper cannot enter its native dispatcher without policy permission', async () => {
  const directory = fixture();
  const desktopRequire = createRequire(
    path.resolve(__dirname, '../../apps/desktop/package.json'),
  );
  const passportDirectory = path.dirname(
    desktopRequire.resolve('passport-desktop/package.json'),
  );
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'passport-fixture',
        dependencies: { 'passport-desktop': '0.1.2' },
      }),
    );
    for (const file of [
      'package.json',
      'dist/index.js',
      'dist/dummies.js',
      'native.js',
    ]) {
      write(
        directory,
        `node_modules/passport-desktop/${file}`,
        fs.readFileSync(path.join(passportDirectory, file), 'utf8'),
      );
    }
    write(
      directory,
      'index.js',
      `try { require('passport-desktop').VerificationResult.Verified; }
      catch (error) { console.log(error.message.includes('not allowed')); }`,
    );
    const nativeModules = [
      {
        file: path.join(directory, 'node_modules/passport-desktop/native.js'),
        request: 'passport-desktop/native',
      },
    ];
    await compileNodeWebpack(
      configuration(directory, { generatePolicy: true, nativeModules }),
    );
    const policy = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    assert.equal(
      policy.resources['passport-desktop'].builtin['passport-desktop/native'],
      true,
    );
    policy.resources['passport-desktop'] = {};
    write(directory, 'policy.json', JSON.stringify(policy));
    await compileNodeWebpack(configuration(directory, { nativeModules }));
    write(
      directory,
      'bootstrap.cjs',
      `const Module = require('node:module'); const originalLoad = Module._load;
      let nativeLoads = 0;
      Module._load = function(request, ...rest) {
        if (request === 'passport-desktop/native') { nativeLoads += 1; throw Error('Native dispatcher must not execute'); }
        return Reflect.apply(originalLoad, this, [request, ...rest]);
      };
      require('./dist/main.js'); console.log(nativeLoads);`,
    );
    const child = spawnSync(
      process.execPath,
      [path.join(directory, 'bootstrap.cjs')],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, 'true\n0\n');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the shipped BLE SDK uses only its explicit native imports and does not report a working adapter as unsupported', async () => {
  const directory = fixture();
  const desktopRequire = createRequire(
    path.resolve(__dirname, '../../apps/desktop/package.json'),
  );
  const {
    createTrezorBleStaticRequiresPlugin,
    resolveTrezorBleEsmFile,
  } = require('../../apps/desktop/scripts/lavamoat-sdk-requires.cjs');
  const packageName = '@onekeyfe/hwk-trezor-connector-electron-ble';
  const packageDirectory = path.resolve(
    path.dirname(desktopRequire.resolve(`${packageName}/main`)),
    '..',
  );
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'ble-fixture',
        dependencies: { [packageName]: '1.2.2-alpha.106', denied: '1.0.0' },
      }),
    );
    fs.mkdirSync(path.join(directory, 'node_modules/@onekeyfe'), {
      recursive: true,
    });
    fs.symlinkSync(
      packageDirectory,
      path.join(directory, 'node_modules', packageName),
      'junction',
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `module.exports = () => {
      try { require('@stoprocent/noble'); return false; }
      catch (error) { return error.message.includes('not allowed'); }
    };`,
    );
    write(
      directory,
      'index.js',
      `import { initTrezorBleSupport } from '${packageName}/main';
      import denied from 'denied';
      const support = initTrezorBleSupport({ send() {} });
      support.handler.checkAvailability().then(availability => console.log(JSON.stringify({ availability, denied: denied() })));`,
    );
    write(
      directory,
      'bootstrap.cjs',
      `const Module = require('node:module'); const originalLoad = Module._load;
      let nobleLoads = 0; const channels = [];
      Module._load = function(request, ...rest) {
        if (request === '@stoprocent/noble') { nobleLoads += 1; return { state: 'poweredOn' }; }
        if (request === 'electron') return { ipcMain: { handle(channel) { channels.push(channel); }, removeHandler() {} } };
        return Reflect.apply(originalLoad, this, [request, ...rest]);
      };
      process.on('exit', () => console.log(JSON.stringify({ nobleLoads, channels: channels.length })));
      require('./dist/main.js');`,
    );
    const options = {
      external: ['electron', '@stoprocent/noble'],
      buildOptions: {
        target: 'node22',
        plugins: [createTrezorBleStaticRequiresPlugin()],
      },
    };
    await compileNodeWebpack(
      configuration(directory, { ...options, generatePolicy: true }),
    );
    const policy = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    assert.equal(
      policy.resources[packageName].builtin['@stoprocent/noble'],
      true,
    );
    assert.equal(
      policy.resources[packageName].builtin['electron.ipcMain'],
      true,
    );
    policy.resources[packageName].globals.require = false;
    policy.resources.denied = {};
    write(directory, 'policy.json', JSON.stringify(policy));
    await compileNodeWebpack(configuration(directory, options));
    const child = spawnSync(
      process.execPath,
      [path.join(directory, 'bootstrap.cjs')],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    const [result, native] = child.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(result, {
      availability: { available: true, state: 'poweredOn', initialized: false },
      denied: true,
    });
    assert.equal(native.nobleLoads, 1);
    assert.ok(native.channels > 0);
    const changedFile = path.join(directory, 'changed/main.mjs');
    write(
      directory,
      'changed/main.mjs',
      fs
        .readFileSync(resolveTrezorBleEsmFile(), 'utf8')
        .replace('__require("electron")', '__require("node:fs")'),
    );
    let handler;
    createTrezorBleStaticRequiresPlugin({ file: changedFile }).setup({
      onLoad: (_, callback) => {
        handler = callback;
      },
    });
    assert.throws(
      () => handler({ path: changedFile }),
      /Unexpected Trezor BLE native import/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the real CLI keyring adapter preserves native createRequire and SEA asset loading without granting it to another package', async () => {
  const directory = fixture();
  const cliDirectory = path.resolve(__dirname, '../../apps/cli');
  const packageName = '@onekeyfe/cli';
  const adapter = path.join(
    cliDirectory,
    'src/infra/secure-storage/secure-storage.napi-rs-keyring.ts',
  );
  const {
    createNativeKeyringParserRule,
  } = require('../../apps/cli/webpack.config.lavamoat.cjs');
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'keyring-fixture',
        dependencies: { [packageName]: '1.0.0', denied: '1.0.0' },
      }),
    );
    fs.mkdirSync(path.join(directory, 'node_modules/@onekeyfe'), {
      recursive: true,
    });
    fs.symlinkSync(
      cliDirectory,
      path.join(directory, 'node_modules', packageName),
      'junction',
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `module.exports = () => {
      try { require('node:module').createRequire(__filename)('node:fs'); return false; }
      catch (error) { return error.message.includes('not allowed'); }
    };`,
    );
    write(
      directory,
      'index.js',
      `import { NapiRsKeyringSecureStorage } from ${JSON.stringify(adapter)};
      import denied from 'denied';
      import forged from ${JSON.stringify(`${adapter}!=!${path.join(directory, 'node_modules/denied/index.js')}?parser-fixture=forged`)};
      import prefix from ${JSON.stringify(`${adapter}.sibling.ts!=!${path.join(directory, 'node_modules/denied/index.js')}?parser-fixture=prefix`)};
      const storage = new NapiRsKeyringSecureStorage();
      (async () => {
        await storage.set('synthetic', Buffer.from('fixture-only'));
        const value = await storage.get('synthetic');
        await storage.delete('synthetic');
        console.log(JSON.stringify({ value: value.toString(), denied: denied(), forged: forged(), prefix: prefix(), frozen: Object.isFrozen(Object.prototype) }));
      })().catch(error => { console.error(error); process.exitCode = 1; });`,
    );
    write(
      directory,
      'bootstrap.cjs',
      `const assert = require('node:assert/strict');
      const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
      const Module = require('node:module'); const originalLoad = Module._load;
      const asset = Uint8Array.from([11, 22, 33, 44]).buffer;
      const entries = new Map(); const nativeLoads = []; const calls = [];
      const temporary = path.join(__dirname, 'native-fixture'); fs.mkdirSync(temporary, { recursive: true });
      os.tmpdir = () => temporary;
      Module._load = function(request, ...rest) {
        if (request === 'node:sea') return { isSea: () => true, getRawAsset(name) { assert.equal(name, 'onekey-cli/keyring-native.node'); return asset; } };
        if (request === '@napi-rs/keyring' || request.endsWith('.node')) {
          if (request.endsWith('.node')) {
            assert.ok(request.startsWith(temporary + path.sep));
            assert.deepEqual(fs.readFileSync(request), Buffer.from(asset));
          }
          nativeLoads.push(request.endsWith('.node') ? 'sea-asset' : 'native-package');
          return { AsyncEntry: class {
            constructor(service, account) { assert.equal(service, 'onekey-cli'); assert.equal(account, 'napi-rs/synthetic'); }
            async setPassword(value) { calls.push('set'); entries.set('value', value); }
            async getPassword() { calls.push('get'); return entries.get('value'); }
            async deletePassword() { calls.push('delete'); entries.delete('value'); }
          } };
        }
        return Reflect.apply(originalLoad, this, [request, ...rest]);
      };
      process.on('exit', () => console.log(JSON.stringify({ nativeLoads, calls, remaining: entries.size })));
      require(process.env.ONEKEY_CLI_STANDALONE === '1' ? './sea-entry.cjs' : './dist/main.js');`,
    );
    const createConfig = (generatePolicy) => {
      const config = configuration(directory, { generatePolicy });
      config.module.rules.push(createNativeKeyringParserRule());
      return config;
    };
    await compileNodeWebpack(createConfig(true));
    const policy = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    assert.equal(
      policy.resources[packageName].builtin['node:module.createRequire'],
      true,
    );
    policy.resources.denied = {};
    write(directory, 'policy.json', JSON.stringify(policy));
    await compileNodeWebpack(configuration(directory));
    const brokenSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    assert.ok(brokenSource.includes('/* createRequire() */ undefined'));
    const broken = spawnSync(
      process.execPath,
      [path.join(directory, 'bootstrap.cjs')],
      {
        encoding: 'utf8',
        timeout: 15_000,
        env: { ...process.env, ONEKEY_CLI_STANDALONE: '0' },
      },
    );
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /requireFromCliRuntime is not a function/);
    const enforcedStats = await compileNodeWebpack(createConfig(false));
    const forgedModules = [...enforcedStats.compilation.modules].filter(
      (module) => module.matchResource?.startsWith(adapter),
    );
    assert.equal(forgedModules.length, 2);
    for (const module of forgedModules) {
      assert.equal(
        module.resource.split('?')[0],
        path.join(directory, 'node_modules/denied/index.js'),
      );
      assert.notEqual(module.parserOptions?.createRequire, false);
    }
    const source = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    assert.ok(!source.includes('/* createRequire() */ undefined'));
    const {
      prepareSeaEntry,
    } = require('../../apps/cli/scripts/package-macos-standalone.js');
    prepareSeaEntry(
      path.join(directory, 'dist/main.js'),
      path.join(directory, 'sea-entry.cjs'),
    );
    for (const standalone of process.platform === 'darwin'
      ? ['0', '1']
      : ['0']) {
      const child = spawnSync(
        process.execPath,
        [path.join(directory, 'bootstrap.cjs')],
        {
          encoding: 'utf8',
          timeout: 15_000,
          env: { ...process.env, ONEKEY_CLI_STANDALONE: standalone },
        },
      );
      assert.equal(child.status, 0, child.stderr);
      const [result, native] = child.stdout
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      assert.deepEqual(result, {
        value: 'fixture-only',
        denied: true,
        forged: true,
        prefix: true,
        frozen: true,
      });
      assert.deepEqual(native, {
        nativeLoads: Array(3).fill(
          standalone === '1' ? 'sea-asset' : 'native-package',
        ),
        calls: ['set', 'get', 'delete'],
        remaining: 0,
      });
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI modern Buffer adapters preserve real package behavior in both bundlers and reject source drift', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-node-buffer-')),
  );
  const cliRequire = createRequire(
    path.resolve(__dirname, '../../apps/cli/package.json'),
  );
  const { createBuildOptions } = require('../../apps/cli/esbuild.config');
  const {
    assertNoDeprecatedBufferConstructors,
  } = require('../../apps/cli/scripts/assert-no-deprecated-buffer');
  const originalOptions = createBuildOptions({ watch: false });
  const plugins = originalOptions.plugins.filter(
    (plugin) => plugin.name === 'patch-deprecated-buffer-constructors',
  );
  assert.equal(plugins.length, 1);
  function resolveDeclaredPackage(chain) {
    let dependencyRequire = cliRequire;
    for (const packageName of chain.slice(0, -1)) {
      dependencyRequire = createRequire(
        dependencyRequire.resolve(`${packageName}/package.json`),
      );
    }
    return dependencyRequire.resolve(chain.at(-1));
  }
  const safeBuffer = resolveDeclaredPackage([
    '@onekeyhq/core',
    'ecpair',
    'randombytes',
    'safe-buffer',
  ]);
  const saferBuffer = resolveDeclaredPackage([
    '@onekeyhq/core',
    'near-api-js',
    'node-fetch',
    'encoding',
    'iconv-lite',
    'safer-buffer',
  ]);
  const exercise = `const data = [require('safe-buffer'), require('safer-buffer')].map(({ Buffer: B }) => {
    let numericFromRejected = false;
    try { B.from(3); } catch (error) { numericFromRejected = error instanceof TypeError; }
    return { text: B.from('hello', 'utf8').toString('hex'), bytes: [...B.from([0, 127, 255])],
      fill: [...B.alloc(3, 7)], numericFromRejected,
      unsafeLength: typeof B.allocUnsafe === 'function' ? B.allocUnsafe(3).length : null };
  }); console.log(JSON.stringify(data));`;
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'buffer-fixture',
        dependencies: { 'safe-buffer': '5.2.1', 'safer-buffer': '2.1.2' },
      }),
    );
    for (const [name, source] of [
      ['safe-buffer', safeBuffer],
      ['safer-buffer', saferBuffer],
    ]) {
      write(
        directory,
        `node_modules/${name}/package.json`,
        fs.readFileSync(
          path.join(path.dirname(source), 'package.json'),
          'utf8',
        ),
      );
      write(
        directory,
        `node_modules/${name}/${path.basename(source)}`,
        fs.readFileSync(source, 'utf8'),
      );
    }
    write(directory, 'index.js', exercise);
    const baseline = spawnSync(
      process.execPath,
      [path.join(directory, 'index.js')],
      { encoding: 'utf8' },
    );
    assert.equal(baseline.status, 0, baseline.stderr);
    const esbuild = cliRequire('esbuild');
    await esbuild.build({
      entryPoints: [path.join(directory, 'index.js')],
      outfile: path.join(directory, 'normal.js'),
      bundle: true,
      platform: 'node',
      target: 'node22',
      plugins,
    });
    const normal = spawnSync(
      process.execPath,
      [path.join(directory, 'normal.js')],
      { encoding: 'utf8' },
    );
    assert.equal(normal.status, 0, normal.stderr);
    assert.equal(normal.stdout, baseline.stdout);
    assertNoDeprecatedBufferConstructors(path.join(directory, 'normal.js'));
    const buildOptions = { target: 'node22', plugins };
    await compileNodeWebpack(
      configuration(directory, { generatePolicy: true, buildOptions }),
    );
    await compileNodeWebpack(configuration(directory, { buildOptions }));
    const protectedPath = path.join(directory, 'dist/main.js');
    assertNoDeprecatedBufferConstructors(protectedPath);
    const protectedResult = spawnSync(process.execPath, [protectedPath], {
      encoding: 'utf8',
    });
    assert.equal(protectedResult.status, 0, protectedResult.stderr);
    assert.equal(protectedResult.stdout, baseline.stdout);
    const safePath = path.join(directory, 'node_modules/safe-buffer/index.js');
    fs.writeFileSync(
      safePath,
      fs
        .readFileSync(safePath, 'utf8')
        .replace('function SafeBuffer (arg,', 'function SafeBuffer (changed,'),
    );
    await assert.rejects(
      compileNodeWebpack(configuration(directory, { buildOptions })),
      /Missing expected deprecated Buffer constructor patch target/,
    );
    write(directory, 'unsafe.js', 'new Buffer(3);');
    assert.throws(
      () =>
        assertNoDeprecatedBufferConstructors(path.join(directory, 'unsafe.js')),
      /Deprecated Buffer constructor/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the service smoke rejects a stalled Electron operation within its host deadline', async () => {
  const {
    withTimeout,
  } = require('../../apps/desktop/scripts/smoke-lavamoat-services.cjs');
  assert.equal(
    await withTimeout(Promise.resolve('ready'), 1000, 'ready'),
    'ready',
  );
  await assert.rejects(
    withTimeout(new Promise(() => {}), 20, 'stalled evaluation'),
    /Timed out: stalled evaluation/,
  );
});

test('sandboxed Electron preload enforces package IPC grants without weakening security preferences', async () => {
  const directory = fixture();
  let application;
  try {
    write(
      directory,
      'node_modules/allowed/index.js',
      `const { ipcRenderer } = require('electron');
      module.exports = () => ({ reply: ipcRenderer.sendSync('allowed-probe'), processType: typeof process,
      mutation: Reflect.set(Object.prototype, '__electronProbeMutation', true) });`,
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `module.exports = () => {
      try { require('electron').ipcRenderer.send('forbidden'); return false; }
      catch (error) { return error.message.includes('not allowed'); }
    };`,
    );
    write(
      directory,
      'index.js',
      `const { contextBridge } = require('electron');
      contextBridge.exposeInMainWorld('probeResult', { ...require('allowed')(), denied: require('denied')(),
      frozen: Object.isFrozen(Object.prototype), hardenType: typeof harden });`,
    );
    write(
      directory,
      'policy.json',
      JSON.stringify({
        resources: {
          allowed: { builtin: { 'electron.ipcRenderer.sendSync': true } },
          denied: {},
        },
      }),
    );
    await compileNodeWebpack(
      configuration(directory, { target: 'electron-preload' }),
    );
    write(
      directory,
      'bootstrap.cjs',
      `const { app, BrowserWindow, ipcMain } = require('electron');
      app.setPath('userData', ${JSON.stringify(path.join(directory, 'profile'))});
      app.setPath('sessionData', ${JSON.stringify(path.join(directory, 'session'))});
      ipcMain.on('allowed-probe', event => { event.returnValue = 'native-ipc-ok'; });
      app.whenReady().then(() => {
        const window = new BrowserWindow({ show: false, webPreferences: {
          preload: ${JSON.stringify(path.join(directory, 'dist/main.js'))},
          sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true
        } });
        window.loadURL('data:text/html,<title>Protected preload</title><div data-testid="ready">Ready</div>');
      });`,
    );
    const { _electron: electron } = require('playwright-core');
    application = await electron.launch({
      executablePath: require('electron'),
      args: [path.join(directory, 'bootstrap.cjs')],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    });
    const page = await application.firstWindow();
    await page.waitForSelector('[data-testid="ready"]');
    assert.deepEqual(await page.evaluate(() => globalThis.probeResult), {
      reply: 'native-ipc-ok',
      processType: 'undefined',
      mutation: false,
      denied: true,
      frozen: true,
      hardenType: 'function',
    });
    const preferences = await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
    );
    assert.equal(preferences.sandbox, true);
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.webSecurity, true);
    assert.equal(preferences.nodeIntegration, false);
  } finally {
    await application?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Electron main dependencies run in compartments before opening the sandboxed window', async () => {
  const directory = fixture();
  let application;
  try {
    write(
      directory,
      'node_modules/allowed/index.js',
      `const { app } = require('electron');
      exports.ready = () => app.whenReady().then(() => ({ version: app.getVersion(), processType: typeof process,
        mutation: Reflect.set(Function.prototype, '__mainProbeMutation', true) }));`,
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `exports.probe = () => {
      try { require('electron').app.getPath('home'); return false; }
      catch (error) { return error.message.includes('not allowed'); }
    };`,
    );
    write(
      directory,
      'policy.json',
      JSON.stringify({
        resources: {
          allowed: {
            builtin: {
              'electron.app.getVersion': true,
              'electron.app.whenReady': true,
            },
          },
          denied: {},
        },
      }),
    );
    write(
      directory,
      'index.js',
      `const { app, BrowserWindow } = require('electron');
      app.setPath('userData', ${JSON.stringify(path.join(directory, 'profile'))});
      app.setPath('sessionData', ${JSON.stringify(path.join(directory, 'session'))});
      require('allowed').ready().then(result => {
        const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true,
          contextIsolation: true, nodeIntegration: false, webSecurity: true } });
        const data = { ...result, denied: require('denied').probe(), frozen: Object.isFrozen(Object.prototype) };
        window.loadURL('data:text/html,<div data-testid="result">' + encodeURIComponent(JSON.stringify(data)) + '</div>');
      });`,
    );
    await compileNodeWebpack(
      configuration(directory, { target: 'electron-main' }),
    );
    const { _electron: electron } = require('playwright-core');
    application = await electron.launch({
      executablePath: require('electron'),
      args: [path.join(directory, 'dist/main.js')],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    });
    const page = await application.firstWindow();
    const content = await page.getByTestId('result').textContent();
    const result = JSON.parse(decodeURIComponent(content));
    assert.equal(typeof result.version, 'string');
    assert.equal(result.processType, 'undefined');
    assert.equal(result.mutation, false);
    assert.equal(result.denied, true);
    assert.equal(result.frozen, true);
  } finally {
    await application?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function evaluateReleaseConfiguration(filename, dependencies, env) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    process: { env },
    console: { log() {}, warn: console.warn },
    require(request) {
      assert.ok(Object.hasOwn(dependencies, request), request);
      return dependencies[request];
    },
  });
  return module.exports;
}

class ReleaseConfigurationPlugin {}

test('Desktop production scripts preserve all packaged entries and one sourcemap upload owner', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const desktopPath = path.join(repoRoot, 'apps/desktop');
  const { scripts } = JSON.parse(
    fs.readFileSync(path.join(desktopPath, 'package.json'), 'utf8'),
  );
  assert.match(
    scripts['build:main'],
    /build-lavamoat\.cjs --production-output$/,
  );
  assert.doesNotMatch(scripts['build:main'], /--entry/);
  assert.match(scripts['build:renderer'], /yarn build:renderer:compile/);
  assert.match(
    scripts['build:renderer'],
    /finalize-production-assets\.js && node scripts\/finalize-renderer-assets\.js$/,
  );
  assert.match(scripts['build:renderer:compile'], /ONEKEY_LAVAMOAT=1/);
  assert.match(
    scripts['build:renderer:compile'],
    /ONEKEY_LAVAMOAT_GENERATE_POLICY=0/,
  );
  assert.match(scripts['build:renderer:compile'], /SENTRY_UPLOAD_BY_CLI=true/);
  assert.equal(
    scripts['build:JsBundle'],
    'cross-env BUILD_BUNDLE_UPDATE=true yarn build:renderer:compile',
  );
  for (const workflow of ['build-desktop-renderer', 'release-desktop-snap']) {
    const source = fs.readFileSync(
      path.join(repoRoot, '.github/workflows', `${workflow}.yml`),
      'utf8',
    );
    assert.match(source, /yarn build:renderer:compile/);
    assert.doesNotMatch(source, /rspack build/);
    assert.match(source, /finalize-production-assets\.js --strip-only/);
  }
  assert.match(scripts['build:main:dev'], /node scripts\/build\.js$/);
  assert.match(scripts['dev:renderer'], /rspack serve/);
  assert.match(
    scripts['build:unprotected'],
    /build:renderer:unprotected && yarn build:main:unprotected/,
  );

  const {
    createConfigurations,
  } = require('../../apps/desktop/scripts/build-lavamoat.cjs');
  const outputPath = path.join(desktopPath, 'app/dist');
  const configurations = createConfigurations({ outputPath });
  assert.deepEqual(
    configurations.map(({ output }) => output.filename).toSorted(),
    [
      'app.js',
      'preload.js',
      'service/checkBiometricAuthChanged.js',
      'service/enum.js',
      'service/index.js',
      'service/windowsHello.js',
    ],
  );
  assert.ok(configurations.every(({ output }) => output.path === outputPath));

  let sentryUploads = 0;
  const dependencies = {
    path,
    '@sentry/webpack-plugin': {
      sentryWebpackPlugin() {
        sentryUploads += 1;
        return {};
      },
    },
    'terser-webpack-plugin': ReleaseConfigurationPlugin,
    webpack: { DefinePlugin: ReleaseConfigurationPlugin },
    '../babelTools': { developmentConsts: { platforms: { ext: 'ext' } } },
    './lavamoat': {
      isLavaMoatEnabled: () => true,
      isLavaMoatPolicyGeneration: () => false,
    },
    './utils': {},
  };
  const prodConfig = path.join(
    repoRoot,
    'development/webpack/webpack.prod.config.js',
  );
  evaluateReleaseConfiguration(prodConfig, dependencies, {
    SENTRY_UPLOAD_BY_CLI: 'true',
  })({ platform: 'desktop', basePath: desktopPath });
  assert.equal(
    sentryUploads,
    0,
    'the compile subprocess must leave sourcemaps to its external owner',
  );
  evaluateReleaseConfiguration(
    prodConfig,
    dependencies,
    {},
  )({ platform: 'desktop', basePath: desktopPath });
  assert.equal(
    sentryUploads,
    1,
    'the fixture must exercise the real Sentry gate',
  );
});

test('Desktop OTA metadata hashes every surviving emitted and copied asset after production cleanup', async () => {
  const directory = fixture();
  try {
    const outputPath = path.join(directory, 'web-build');
    const files = {
      'index.html':
        '<script src="static/js/lavamoat-runtime.hash.bundle.js"></script>',
      'static/js/lavamoat-runtime.hash.bundle.js':
        '// Raw SES fixture bytes\nObject.freeze(Object.prototype);\n',
      'static/js/main.hash.bundle.js': 'console.log("entry");\n',
      'static/js/lazy.hash.chunk.js': 'console.log("lazy");\n',
      'static/css/main.hash.css': 'body { color: black; }',
      'static/binary/module.wasm.bin': Buffer.from([
        0, 97, 115, 109, 1, 0, 0, 0,
      ]),
      'static/css/main.hash.css.map': '{}',
      'static/css/main.hash.css.LICENSE.txt': 'license',
      'static/js/main.hash.bundle.js.map': '{}',
      'static/js/main.hash.bundle.js.LICENSE.txt': 'license',
    };
    Object.entries(files).forEach(([name, source]) =>
      write(outputPath, name, source),
    );
    write(directory, 'public/static/js-sdk/injected.js', 'injected-sdk');
    write(directory, 'public/static/images/icon.svg', '<svg/>');
    write(directory, 'public/static/preload.js', 'browser-sdk-preload');
    const dependencies = {
      crypto: { createHash },
      fs,
      path,
      'webpack-merge': {
        merge: (...configurations) => ({
          plugins: configurations.flatMap(({ plugins = [] }) => plugins),
        }),
      },
      'webpack-subresource-integrity': {
        SubresourceIntegrityPlugin: ReleaseConfigurationPlugin,
      },
      '../babelTools': {
        developmentConsts: { platforms: { desktop: 'desktop' } },
      },
      './constant': { NODE_ENV: 'production', ENABLE_ANALYZER: false },
      './lavamoat': {
        createLavaMoatWebpackOptimization: () => ({}),
        createLavaMoatWebpackPlugin: () => undefined,
        createLavaMoatWebpackRules: () => [],
        createLavaMoatWebpackValidationPlugin: () => undefined,
        isLavaMoatEnabled: () => false,
      },
      './lavamoat-kaspa-compatibility.cjs': {
        createKaspaCompatibilityRule() {
          assert.fail(
            'Unprotected metadata fixture must not load the Kaspa adapter',
          );
        },
      },
      './webpack.analyzer.config': () => ({}),
      './webpack.base.config': () => ({}),
      './webpack.development.config': () => ({}),
      './webpack.prod.config': () => ({}),
    };
    // Execute the real metadata plugin with a small compiler hook and real files;
    // the unrelated application graph is intentionally outside this unit fixture.
    const releaseConfiguration = evaluateReleaseConfiguration(
      path.resolve(__dirname, '../webpack/webpack.desktop.config.js'),
      dependencies,
      { BUILD_BUNDLE_UPDATE: 'true' },
    )({ basePath: directory });
    const metadataPlugin = releaseConfiguration.plugins.find(
      (plugin) => plugin.constructor.name === 'FileHashMetadataPlugin',
    );
    assert.ok(metadataPlugin);
    let emit;
    metadataPlugin.apply({
      hooks: {
        afterEmit: {
          tapAsync(_name, callback) {
            emit = callback;
          },
        },
      },
    });
    await new Promise((resolve, reject) =>
      emit(
        {
          outputOptions: { path: outputPath },
          getAssets: () => Object.keys(files).map((name) => ({ name })),
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    const {
      cleanupProductionAssets,
    } = require('../../apps/desktop/scripts/finalize-production-assets.js');
    cleanupProductionAssets(outputPath);
    const metadata = JSON.parse(
      fs.readFileSync(path.join(outputPath, 'metadata.json'), 'utf8'),
    );
    const collectFiles = (current, prefix = '') =>
      fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const relativePath = path.join(prefix, entry.name);
        return entry.isDirectory()
          ? collectFiles(path.join(current, entry.name), relativePath)
          : [relativePath];
      });
    const verifyMetadata = () => {
      assert.deepEqual(
        Object.keys(metadata).toSorted(),
        collectFiles(outputPath)
          .filter((name) => name !== 'metadata.json')
          .toSorted(),
      );
      for (const [name, hash] of Object.entries(metadata)) {
        assert.equal(
          createHash('sha512')
            .update(fs.readFileSync(path.join(outputPath, name)))
            .digest('hex'),
          hash,
          name,
        );
      }
    };
    verifyMetadata();
    assert.ok(metadata['static/js/lavamoat-runtime.hash.bundle.js']);
    assert.ok(metadata['static/js/lazy.hash.chunk.js']);
    assert.ok(metadata['static/preload.js']);
    write(outputPath, 'static/js/lazy.hash.chunk.js', 'tampered-after-hashing');
    assert.throws(verifyMetadata, /lazy\.hash\.chunk\.js/);
    fs.rmSync(path.join(outputPath, 'static/js/lazy.hash.chunk.js'));
    assert.throws(verifyMetadata, /lazy\.hash\.chunk\.js/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
