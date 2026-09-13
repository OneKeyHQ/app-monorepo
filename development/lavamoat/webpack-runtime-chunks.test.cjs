// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const {
  createLavaMoatWebpackOptimization,
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackValidationPlugin,
} = require('../webpack/lavamoat');

function write(directory, file, source) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

async function compile(configuration) {
  const compiler = webpack(configuration);
  try {
    return await new Promise((resolve, reject) => {
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result),
      );
    });
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('maxSize splitting preserves one untouched SES runtime before initial and lazy modules', async () => {
  const hostPrototypes = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
  ];
  const initialHostFrozen = hostPrototypes.map(Object.isFrozen);
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-split-runtime-')),
  );
  const previous = process.env.ONEKEY_LAVAMOAT;
  process.env.ONEKEY_LAVAMOAT = '1';
  const plugin = createLavaMoatWebpackPlugin({
    basePath: directory,
    target: 'web',
  });
  const optimization = createLavaMoatWebpackOptimization();
  const validation = createLavaMoatWebpackValidationPlugin();
  if (previous === undefined) delete process.env.ONEKEY_LAVAMOAT;
  else process.env.ONEKEY_LAVAMOAT = previous;
  plugin.options.policyLocation = directory;
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'split-runtime-root',
        private: true,
        dependencies: { 'restricted-dependency': '1.0.0' },
      }),
    );
    write(
      directory,
      'node_modules/restricted-dependency/package.json',
      JSON.stringify({ name: 'restricted-dependency', version: '1.0.0' }),
    );
    write(
      directory,
      'node_modules/restricted-dependency/index.js',
      `module.exports = () => ({ fetchType: typeof fetch, secretType: typeof hostSecret,
        mutated: Reflect.set(Object.prototype, '__splitRuntimePolluted', true) });`,
    );
    write(
      directory,
      'policy.json',
      JSON.stringify({ resources: { 'restricted-dependency': {} } }),
    );
    const imports = [];
    for (let index = 0; index < 6; index += 1) {
      write(
        directory,
        `payload-${index}.js`,
        `module.exports = ${JSON.stringify(crypto.randomBytes(900).toString('hex'))};`,
      );
      imports.push(`require('./payload-${index}.js')`);
    }
    write(
      directory,
      'index.js',
      `fixtureResult.initial = require('restricted-dependency')();
       fixtureResult.payloads = [${imports.join(',')}];
       fixtureResult.loadLazy = () => import('./lazy.js').then(module => module.default());`,
    );
    write(
      directory,
      'lazy.js',
      "module.exports = () => require('restricted-dependency')();",
    );
    const output = path.join(directory, 'dist');
    const configuration = {
      mode: 'production',
      context: directory,
      entry: './index.js',
      output: {
        path: output,
        filename: '[name].[contenthash:10].bundle.js',
        chunkFilename: '[name].[contenthash:10].chunk.js',
        publicPath: '/',
        crossOriginLoading: 'anonymous',
      },
      optimization: {
        ...optimization,
        concatenateModules: false,
        splitChunks: {
          chunks: 'all',
          minSize: 100,
          maxSize: 2200,
          hidePathInfo: true,
          automaticNameDelimiter: '.',
          name: false,
        },
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new SubresourceIntegrityPlugin(),
        plugin,
        validation,
      ],
    };
    const stats = await compile(configuration);
    assert.equal(
      stats.hasErrors(),
      false,
      stats.toString({ all: false, errors: true }),
    );
    const files = fs.readdirSync(output).filter((file) => file.endsWith('.js'));
    assert.ok(
      files.filter((file) =>
        /^main\.[a-f0-9]+\.[a-f0-9]+\.bundle\.js$/.test(file),
      ).length > 1,
      'the production-style maxSize regression must actually split and rename main',
    );
    const runtimeChunks = [...stats.compilation.chunks].filter((chunk) =>
      chunk.hasRuntime(),
    );
    assert.equal(runtimeChunks.length, 1);
    const [runtime] = runtimeChunks[0].files;
    assert.ok(plugin.options.inlineLockdown.test(runtime));
    const sesRequire = createRequire(require.resolve('@lavamoat/webpack'));
    const ses = fs.readFileSync(sesRequire.resolve('ses'), 'utf8');
    for (const file of files) {
      const source = fs.readFileSync(path.join(output, file), 'utf8');
      assert.equal(
        source.split(ses).length - 1,
        file === runtime ? 1 : 0,
        `${file} must contain untouched SES only when it owns the runtime`,
      );
    }
    assert.equal(fs.existsSync(path.join(output, 'lockdown')), false);
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*src="\/([^"]+)"[^>]*>/g)];
    assert.equal(
      scripts[0][1],
      runtime,
      'HTML must run SES before any modules',
    );
    for (const [tag, file] of scripts) {
      const integrity = crypto
        .createHash('sha384')
        .update(fs.readFileSync(path.join(output, file)))
        .digest('base64');
      assert.ok(tag.includes(`integrity="sha384-${integrity}"`));
    }
    const lazyRequests = [];
    const context = vm.createContext({
      loadLazyScript(url) {
        const file = url.slice(1);
        lazyRequests.push(file);
        vm.runInContext(
          fs.readFileSync(path.join(output, file), 'utf8'),
          context,
        );
      },
      nativeSetTimeout: setTimeout,
      nativeClearTimeout: clearTimeout,
    });
    // Allocate observable functions and objects inside the fixture realm. SES
    // must not recursively harden host prototypes used by later compilations.
    vm.runInContext(
      `(() => {
        const { loadLazyScript, nativeSetTimeout, nativeClearTimeout } = globalThis;
        delete globalThis.loadLazyScript;
        delete globalThis.nativeSetTimeout;
        delete globalThis.nativeClearTimeout;
        globalThis.setTimeout = (...args) => nativeSetTimeout(...args);
        globalThis.clearTimeout = (...args) => nativeClearTimeout(...args);
        globalThis.document = {
          getElementsByTagName: () => [],
          createElement: () => ({ setAttribute() {} }),
          head: {
            appendChild(script) {
              loadLazyScript(script.src);
              script.onload({ type: 'load', target: script });
            },
          },
        };
        globalThis.fixtureResult = {};
        globalThis.hostSecret = 'private host capability';
        globalThis.fetch = () => { throw new Error('A dependency must never call host fetch'); };
        globalThis.self = globalThis;
        globalThis.window = globalThis;
        globalThis.location = { origin: 'https://fixture.invalid' };
      })();`,
      context,
    );
    for (const [, file] of scripts) {
      vm.runInContext(
        fs.readFileSync(path.join(output, file), 'utf8'),
        context,
      );
      assert.equal(
        vm.runInContext(
          'typeof harden === "function" && [Object.prototype, Array.prototype, Function.prototype].every(Object.isFrozen)',
          context,
        ),
        true,
        'intrinsics must already be frozen after the first script',
      );
    }
    const denied = {
      fetchType: 'undefined',
      secretType: 'undefined',
      mutated: false,
    };
    assert.deepEqual(
      JSON.parse(JSON.stringify(context.fixtureResult.initial)),
      denied,
    );
    assert.equal(context.fixtureResult.payloads.length, 6);
    assert.deepEqual(
      JSON.parse(JSON.stringify(await context.fixtureResult.loadLazy())),
      denied,
    );
    assert.equal(
      lazyRequests.length,
      1,
      'exercise the emitted asynchronous chunk',
    );
    assert.ok(lazyRequests[0].endsWith('.chunk.js'));
    assert.equal(
      vm.runInContext('Object.prototype.__splitRuntimePolluted', context),
      undefined,
    );
    assert.deepEqual(
      hostPrototypes.map(Object.isFrozen),
      initialHostFrozen,
      'fixture lockdown must not freeze the host compiler realm',
    );
    for (const broken of ['missing', 'duplicated']) {
      const brokenPlugin = new plugin.constructor({
        ...plugin.options,
        inlineLockdown:
          broken === 'duplicated'
            ? /\.bundle\.js$/
            : plugin.options.inlineLockdown,
      });
      const result = await compile({
        ...configuration,
        output: {
          ...configuration.output,
          path: path.join(directory, broken),
          filename:
            broken === 'missing' ? '[name].js' : configuration.output.filename,
        },
        plugins: [
          new HtmlWebpackPlugin(),
          new SubresourceIntegrityPlugin(),
          brokenPlugin,
          validation,
        ],
      });
      assert.equal(
        result.hasErrors(),
        true,
        `${broken} SES must fail the build`,
      );
      assert.match(
        result.toString({ all: false, errors: true }),
        /exactly one expected runtime containing one untouched SES prelude/,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('optional development trees cannot rename production policy owners while bundled dev dependencies and physical versions stay isolated', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-policy-owners-')),
  );
  const LavaMoatPlugin = require('@lavamoat/webpack');
  const { loadCanonicalNameMap } = createRequire(
    require.resolve('@lavamoat/webpack'),
  )('@lavamoat/aa');
  const productionOwner =
    'production-entry>production-middle>production-leaf>shared-runtime';
  const secondOwner = 'production-alternative>shared-runtime';
  const developmentOwner = 'bundled-development';
  try {
    const scenarios = [];
    for (const optionalPresent of [false, true]) {
      const root = path.join(
        directory,
        optionalPresent ? 'optional-present' : 'optional-absent',
      );
      const manifest = (
        name,
        properties = {},
        location = `node_modules/${name}`,
      ) => {
        write(
          root,
          `${location}/package.json`,
          JSON.stringify({
            name,
            version: '1.0.0',
            main: 'index.js',
            ...properties,
          }),
        );
      };
      write(
        root,
        'package.json',
        JSON.stringify({
          name: 'stable-policy-owner-fixture',
          private: true,
          dependencies: {
            'production-entry': '1.0.0',
            'production-alternative': '1.0.0',
          },
          devDependencies: {
            'development-tool': '1.0.0',
            'bundled-development': '1.0.0',
          },
        }),
      );
      for (const [name, next] of [
        ['production-entry', 'production-middle'],
        ['production-middle', 'production-leaf'],
        ['production-leaf', 'shared-runtime'],
      ]) {
        manifest(name, { dependencies: { [next]: '1.0.0' } });
        write(
          root,
          `node_modules/${name}/index.js`,
          `module.exports = require(${JSON.stringify(next)});`,
        );
      }
      manifest('shared-runtime');
      write(
        root,
        'node_modules/shared-runtime/index.js',
        `module.exports = () => ({
        version: '1.0.0', value: productionV1, opposite: typeof productionV2,
        fetch: typeof fetch, secret: typeof hostSecret });`,
      );
      manifest('production-alternative', {
        dependencies: { 'shared-runtime': '2.0.0' },
      });
      write(
        root,
        'node_modules/production-alternative/index.js',
        "module.exports = require('shared-runtime');",
      );
      manifest(
        'shared-runtime',
        { version: '2.0.0' },
        'node_modules/production-alternative/node_modules/shared-runtime',
      );
      write(
        root,
        'node_modules/production-alternative/node_modules/shared-runtime/index.js',
        `module.exports = () => ({
        version: '2.0.0', value: productionV2, opposite: typeof productionV1,
        fetch: typeof fetch, secret: typeof hostSecret });`,
      );
      manifest('development-tool', {
        optionalDependencies: { 'optional-packaging': '1.0.0' },
      });
      // The optional package is not imported by the application. Its presence
      // models platform-specific install results without depending on this OS.
      // Its three-edge development path used to beat the four-edge runtime path.
      if (optionalPresent) {
        manifest('optional-packaging', {
          dependencies: { 'shared-runtime': '1.0.0' },
        });
        write(
          root,
          'node_modules/optional-packaging/index.js',
          "module.exports = require('shared-runtime');",
        );
      }
      manifest(developmentOwner);
      write(
        root,
        `node_modules/${developmentOwner}/index.js`,
        `module.exports = () => ({
        value: developmentValue, firstProduction: typeof productionV1,
        secondProduction: typeof productionV2, fetch: typeof fetch, secret: typeof hostSecret });`,
      );
      write(
        root,
        'index.js',
        `fixtureResult.values = {
        first: require('production-entry')(),
        second: require('production-alternative')(),
        development: require('bundled-development')(),
      };`,
      );
      const fullMap = await loadCanonicalNameMap({
        rootDir: root,
        includeDevDeps: true,
      });
      assert.equal(
        fullMap.get(path.join(root, 'node_modules/shared-runtime')),
        optionalPresent
          ? 'development-tool>optional-packaging>shared-runtime'
          : productionOwner,
        'the fixture must reproduce the original full-map ownership drift',
      );
      const configuration = (generatePolicyOnly) => ({
        mode: 'production',
        context: root,
        entry: './index.js',
        output: {
          path: path.join(root, 'dist'),
          filename: 'main.js',
          publicPath: '',
          globalObject: 'globalThis',
        },
        optimization: { minimize: false, concatenateModules: false },
        plugins: [
          new LavaMoatPlugin({
            rootDir: root,
            policyLocation: root,
            generatePolicyOnly,
            readableResourceIds: true,
            inlineLockdown: /^main\.js$/,
            lockdown: {
              errorTrapping: 'none',
              errorTaming: 'unsafe',
              reporting: 'none',
            },
          }),
        ],
      });
      const generatedStats = await compile(configuration(true));
      assert.equal(
        generatedStats.hasErrors(),
        false,
        generatedStats.toString({ all: false, errors: true }),
      );
      const policy = JSON.parse(
        fs.readFileSync(path.join(root, 'policy.json'), 'utf8'),
      );
      assert.ok(
        policy.resources[productionOwner],
        'production ownership must win over a shorter development-only path',
      );
      assert.ok(
        policy.resources[secondOwner],
        'the second physical version needs its own owner',
      );
      assert.ok(
        policy.resources[developmentOwner],
        'a bundled devDependency must remain a dependency compartment',
      );
      assert.equal(
        policy.resources['development-tool>optional-packaging>shared-runtime'],
        undefined,
      );
      assert.equal(
        policy.resources[productionOwner].globals.productionV1,
        true,
      );
      assert.equal(policy.resources[secondOwner].globals.productionV2, true);
      assert.equal(
        policy.resources[developmentOwner].globals.developmentValue,
        true,
      );
      scenarios.push({
        root,
        configuration,
        policy,
        policySource: fs.readFileSync(path.join(root, 'policy.json'), 'utf8'),
      });
    }
    assert.deepEqual(
      scenarios[0].policy,
      scenarios[1].policy,
      'the complete generated runtime policy must be independent of an unused optional development tree',
    );
    assert.equal(
      scenarios[0].policySource,
      scenarios[1].policySource,
      'generated policy bytes must match across optional development installs',
    );
    const approvedPolicy = scenarios[0].policy;
    const override = {
      resources: {
        [productionOwner]: {
          globals: { productionV2: false, fetch: false, hostSecret: false },
        },
        [secondOwner]: {
          globals: { productionV1: false, fetch: false, hostSecret: false },
        },
        [developmentOwner]: {
          globals: {
            productionV1: false,
            productionV2: false,
            fetch: false,
            hostSecret: false,
          },
        },
      },
    };
    for (const { root, configuration } of scenarios) {
      // Enforce exactly the policy approved on the other install layout, rather
      // than regenerating grants to accommodate a host-specific resource name.
      write(root, 'policy.json', JSON.stringify(approvedPolicy));
      write(root, 'policy-override.json', JSON.stringify(override));
      const enforcedStats = await compile(configuration(false));
      assert.equal(
        enforcedStats.hasErrors(),
        false,
        enforcedStats.toString({ all: false, errors: true }),
      );
      const source = fs.readFileSync(path.join(root, 'dist/main.js'), 'utf8');
      for (const owner of [productionOwner, secondOwner, developmentOwner]) {
        assert.ok(
          source.includes(`._LM_(${JSON.stringify(owner)}`),
          `${owner} must use the runtime policy wrapper`,
        );
      }
      const context = vm.createContext({});
      vm.runInContext(
        `globalThis.fixtureResult = {};
        globalThis.productionV1 = 'first-version-only';
        globalThis.productionV2 = 'second-version-only';
        globalThis.developmentValue = 'reviewed-development-module';
        globalThis.hostSecret = 'denied-host-value';
        globalThis.fetch = () => 'denied-network-capability';`,
        context,
      );
      vm.runInContext(source, context);
      assert.deepEqual(
        JSON.parse(JSON.stringify(context.fixtureResult.values)),
        {
          first: {
            version: '1.0.0',
            value: 'first-version-only',
            opposite: 'undefined',
            fetch: 'undefined',
            secret: 'undefined',
          },
          second: {
            version: '2.0.0',
            value: 'second-version-only',
            opposite: 'undefined',
            fetch: 'undefined',
            secret: 'undefined',
          },
          development: {
            value: 'reviewed-development-module',
            firstProduction: 'undefined',
            secondProduction: 'undefined',
            fetch: 'undefined',
            secret: 'undefined',
          },
        },
      );
      assert.equal(
        vm.runInContext('Object.isFrozen(Object.prototype)', context),
        true,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
