// cspell:ignore LAVAMOAT lavamoat

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const {
  createLavaMoatWebpackOptimization,
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackValidationPlugin,
} = require('../webpack/lavamoat');

const { LavaMoatError } = require('./error.cjs');
const {
  buildPublicKaspaTransaction,
  validateArtifact,
  validatePublicKaspaTransaction,
  withDeadline,
} = require('./smoke-web-embed.cjs');

test('Web Embed smoke rejects a dispatcher that never settles', async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 20), /deadline/);
  assert.equal(await withDeadline(Promise.resolve('ready'), 1000), 'ready');
});

test('Web Embed public Kaspa smoke reaches the generator and propagates RNG or CSP failures', async () => {
  const calls = [];
  const commit = {
    commitAddress: 'kaspa:publicfixture',
    commitScriptPubKey: 'aabb',
    commitScriptHex: 'ccdd',
  };
  for (const message of [
    'Web Crypto unavailable',
    'Refused to evaluate a string because unsafe-eval is not allowed',
  ]) {
    const failure = new LavaMoatError(message);
    const dispatch = async ({ data }) => {
      assert.equal(data.module, 'chainKaspa');
      calls.push(data.method);
      if (data.method === 'buildCommitTxInfo') return commit;
      assert.equal(data.method, 'createKRC20RevealTxJSON');
      assert.equal(data.params[0].encodedTx.inputs[0].txid, 'ab'.repeat(32));
      assert.equal(data.params[0].encodedTx.inputs[0].blockDaaScore, 123_456n);
      assert.equal(
        data.params[0].encodedTx.inputs[0].address,
        commit.commitAddress,
      );
      throw failure;
    };
    await assert.rejects(
      buildPublicKaspaTransaction(dispatch),
      (error) => error === failure,
    );
    assert.deepEqual(calls.splice(0), [
      'buildCommitTxInfo',
      'createKRC20RevealTxJSON',
    ]);
  }
  // This is the public, unsigned safeJSON shape emitted by the real reveal
  // generator. Exercise the installed SDK instead of inventing getter values.
  const reveal = {
    id: 'f760e3fdc65bd05cf1a666d90cabfc71b1f65807c73761e8a21f4c91490a6016',
    version: 0,
    inputs: [
      {
        transactionId: 'ab'.repeat(32),
        index: 0,
        sequence: '0',
        sigOpCount: 1,
        signatureScript: '',
        utxo: {
          address: null,
          amount: '130000000',
          scriptPublicKey:
            '0000aa20c16de512803317cc49ae71169569ee3cdea66655a59cee1a73ecce4e5ab26e6887',
          blockDaaScore: '123456',
          isCoinbase: false,
        },
      },
    ],
    outputs: [
      {
        value: '129997164',
        scriptPublicKey:
          '000020b5923e558c45923d66ce37ecd7b0a82b594fa901978f9a54327f1a50bf4ade1fac',
      },
    ],
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    mass: '1624',
    payload: '',
  };
  const revealSafeJson = JSON.stringify(reveal);
  const sdkPath = require.resolve('@onekeyfe/kaspa-wasm/kaspa.js');
  const sdk = await import(
    `data:text/javascript;base64,${fs.readFileSync(sdkPath).toString('base64')}`
  );
  sdk.initSync({
    module: fs.readFileSync(
      path.join(path.dirname(sdkPath), 'kaspa_bg.wasm.bin'),
    ),
  });
  const decoded = sdk.Transaction.deserializeFromSafeJSON(revealSafeJson);
  assert.equal(decoded.inputs[0].signatureScript, undefined);
  assert.equal(
    JSON.parse(decoded.serializeToSafeJSON()).inputs[0].signatureScript,
    '',
  );
  const transaction = {
    version: decoded.version,
    inputs: decoded.inputs.map((input) => ({
      previousOutpoint: {
        transactionId: input.previousOutpoint.transactionId,
        index: input.previousOutpoint.index,
      },
      signatureScript: input.signatureScript,
    })),
    outputs: decoded.outputs.map((output) => ({
      amount: output.value.toString(),
    })),
    lockTime: decoded.lockTime.toString(),
    subnetworkId: decoded.subnetworkId,
    gas: decoded.gas.toString(),
    payload: decoded.payload,
  };
  const dispatch = async ({ data }) => {
    calls.push(data.method);
    if (data.method === 'buildCommitTxInfo') return commit;
    if (data.method === 'createKRC20RevealTxJSON') return revealSafeJson;
    assert.equal(data.method, 'deserializeFromSafeJSON');
    assert.deepEqual(Array.from(data.params), [revealSafeJson]);
    return transaction;
  };
  // Exercise the exact self-contained function as Playwright serializes it,
  // including the production global dispatcher lookup rather than a closure.
  const result = await vm.runInNewContext(
    `(${buildPublicKaspaTransaction.toString()})()`,
    {
      $onekey: { $private: { webembedReceiveHandler: dispatch } },
    },
  );
  validatePublicKaspaTransaction(result);
  assert.equal(result.revealSafeJson, revealSafeJson);
  // JSON transports omit undefined properties; the explicit raw empty signature
  // remains mandatory for both that representation and an empty string getter.
  const transported = JSON.parse(JSON.stringify(result));
  assert.equal(
    Object.hasOwn(transported.transaction.inputs[0], 'signatureScript'),
    false,
  );
  validatePublicKaspaTransaction(transported);
  transported.transaction.inputs[0].signatureScript = '';
  validatePublicKaspaTransaction(transported);
  assert.deepEqual(calls, [
    'buildCommitTxInfo',
    'createKRC20RevealTxJSON',
    'deserializeFromSafeJSON',
  ]);
  for (const mutate of [
    (value) => {
      value.transaction.inputs[0].signatureScript = 'abcd';
    },
    (value) => {
      value.transaction.inputs[0].signatureScript = null;
    },
    (value) => {
      value.transaction.inputs[0].previousOutpoint.transactionId = 'cd'.repeat(
        32,
      );
    },
    (value) => {
      value.transaction.outputs[0].amount = '130000000';
    },
    (value) => {
      value.transaction.outputs[0].amount = '0';
    },
    (value) => {
      value.revealSafeJson = '{}';
    },
    (value) => {
      value.revealSafeJson = 'invalid';
    },
  ]) {
    const invalid = structuredClone(result);
    mutate(invalid);
    assert.throws(() => validatePublicKaspaTransaction(invalid));
  }
  for (const mutate of [
    (value) => {
      delete value.inputs[0].signatureScript;
    },
    (value) => {
      value.inputs[0].signatureScript = null;
    },
    (value) => {
      value.inputs[0].signatureScript = 'abcd';
    },
    (value) => {
      value.inputs[0].transactionId = 'cd'.repeat(32);
    },
    (value) => {
      value.inputs[0].index = 1;
    },
    (value) => {
      value.outputs[0].value = '129000000';
    },
    (value) => {
      value.payload = 'abcd';
    },
  ]) {
    const invalid = structuredClone(result);
    const invalidReveal = JSON.parse(invalid.revealSafeJson);
    mutate(invalidReveal);
    invalid.revealSafeJson = JSON.stringify(invalidReveal);
    assert.throws(() => validatePublicKaspaTransaction(invalid));
  }
});

test('Web Embed entries share one protected runtime and artifact validation rejects altered or reordered scripts', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-web-embed-test-')),
  );
  const previousFlag = process.env.ONEKEY_LAVAMOAT;
  process.env.ONEKEY_LAVAMOAT = '1';
  const write = (file, source) => {
    const fullPath = path.join(directory, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, source);
  };
  try {
    write(
      'package.json',
      JSON.stringify({
        name: 'embed-fixture-root',
        private: true,
        dependencies: { 'embed-fixture-dependency': '1.0.0' },
      }),
    );
    write(
      'node_modules/embed-fixture-dependency/package.json',
      JSON.stringify({
        name: 'embed-fixture-dependency',
        version: '1.0.0',
        main: 'index.js',
      }),
    );
    write(
      'node_modules/embed-fixture-dependency/index.js',
      'module.exports = () => ({ network: typeof fetch, bridge: typeof $onekey, mutation: Reflect.set(Object.prototype, "fixturePollution", true) });',
    );
    write(
      'sentry.js',
      'globalThis.fixtureResults.sentry = require("embed-fixture-dependency")();',
    );
    write(
      'main.js',
      'globalThis.fixtureResults.main = require("embed-fixture-dependency")();',
    );
    write(
      'policy.json',
      JSON.stringify({ resources: { 'embed-fixture-dependency': {} } }),
    );
    const plugin = createLavaMoatWebpackPlugin({
      basePath: directory,
      target: 'web-embed',
    });
    plugin.options.policyLocation = directory;
    const output = path.join(directory, 'dist');
    const compiler = webpack({
      context: directory,
      mode: 'production',
      entry: { 'web-embed-sentry': './sentry.js', main: './main.js' },
      output: {
        path: output,
        publicPath: './',
        filename: '[name].[contenthash:10].bundle.js',
        crossOriginLoading: 'anonymous',
      },
      optimization: {
        ...createLavaMoatWebpackOptimization(),
        splitChunks: false,
        minimizer: [new TerserPlugin({ parallel: 1 })],
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new SubresourceIntegrityPlugin(),
        createLavaMoatWebpackValidationPlugin(),
        plugin,
      ],
    });
    try {
      const stats = await new Promise((resolve, reject) =>
        compiler.run((error, result) =>
          error ? reject(error) : resolve(result),
        ),
      );
      assert.equal(
        stats.hasErrors(),
        false,
        stats.toString({ all: false, errors: true }),
      );
    } finally {
      await new Promise((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      );
    }
    const artifact = validateArtifact(output);
    const context = vm.createContext({
      fixtureResults: {},
      fetch() {
        throw new LavaMoatError('Unapproved network access');
      },
      $onekey: { privateCapability: true },
    });
    vm.runInContext('globalThis.self = globalThis;', context);
    for (const script of artifact.scripts) {
      vm.runInContext(
        fs.readFileSync(path.join(output, script), 'utf8'),
        context,
        { timeout: 10_000 },
      );
    }
    const denied = {
      network: 'undefined',
      bridge: 'undefined',
      mutation: false,
    };
    assert.deepEqual(JSON.parse(JSON.stringify(context.fixtureResults)), {
      sentry: denied,
      main: denied,
    });
    assert.equal(
      vm.runInContext('Object.isFrozen(Object.prototype)', context),
      true,
    );

    const entryFile = path.join(output, artifact.scripts[2]);
    const originalEntry = fs.readFileSync(entryFile, 'utf8');
    fs.writeFileSync(
      entryFile,
      `${originalEntry}\n;globalThis.changed = true;`,
    );
    assert.throws(() => validateArtifact(output), /sha384/);
    fs.writeFileSync(entryFile, originalEntry);
    const indexFile = path.join(output, 'index.html');
    const originalHtml = fs.readFileSync(indexFile, 'utf8');
    fs.writeFileSync(
      indexFile,
      originalHtml.replace(artifact.scripts[0], artifact.scripts[2]),
    );
    assert.throws(() => validateArtifact(output));
    fs.writeFileSync(
      indexFile,
      originalHtml.replace(
        '<head>',
        `<head><!-- <script src="./ignored.js"></script> -->`,
      ),
    );
    assert.deepEqual(validateArtifact(output).scripts, artifact.scripts);
  } finally {
    if (previousFlag === undefined) delete process.env.ONEKEY_LAVAMOAT;
    else process.env.ONEKEY_LAVAMOAT = previousFlag;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('real browser configs install the pinned Kaspa pre-loader only for protected production', () => {
  const inspect = async () => {
    const scenarioAssert = require('node:assert/strict');
    const scenarioFs = require('node:fs');
    const scenarioPath = require('node:path');
    const { createRequire } = require('node:module');
    const NormalModuleFactory = require('webpack/lib/NormalModuleFactory');
    const ResolverFactory = require('webpack/lib/ResolverFactory');
    const { runLoaders } = createRequire(require.resolve('webpack'))(
      'loader-runner',
    );
    const compatibilityPath =
      require.resolve('./development/webpack/lavamoat-kaspa-compatibility.cjs');
    const { getPinnedPaths } = require(compatibilityPath);
    const source = getPinnedPaths().source;
    const protectedProduction =
      process.env.NODE_ENV === 'production' &&
      (process.env.ONEKEY_LAVAMOAT === '1' ||
        process.env.ONEKEY_LAVAMOAT_GENERATE_POLICY === '1');
    for (const target of ['web', 'desktop', 'web-embed']) {
      const factory = require(
        `./development/webpack/webpack.${target}.config.js`,
      );
      const basePath = scenarioPath.join(process.cwd(), 'apps', target);
      if (target === 'web-embed' && !protectedProduction) {
        scenarioAssert.throws(
          () => factory({ basePath }),
          /requires production LavaMoat/,
        );
      } else {
        const config = factory({ basePath });
        const moduleFactory = new NormalModuleFactory({
          context: basePath,
          fs: scenarioFs,
          resolverFactory: new ResolverFactory(),
          options: { ...config.module, defaultRules: [] },
          associatedObjectForCache: {},
        });
        const effectsFor = (realResource, resource = realResource) =>
          moduleFactory.ruleSet.exec({
            resource,
            realResource,
            resourceQuery: '',
            resourceFragment: '',
            issuer: scenarioPath.join(basePath, 'index.js'),
            dependency: 'esm',
          });
        const effects = effectsFor(source);
        const compatibility = effects.filter(
          (effect) => effect.value?.loader === compatibilityPath,
        );
        scenarioAssert.equal(
          compatibility.length,
          protectedProduction ? 1 : 0,
          target,
        );
        if (protectedProduction) {
          scenarioAssert.equal(compatibility[0].type, 'use-pre');
          for (const foreign of [
            `${source}.untrusted.js`,
            scenarioPath.join(scenarioPath.dirname(source), 'kaspa_bg.wasm.js'),
            scenarioPath.join(process.cwd(), 'untrusted', 'kaspa.js'),
          ]) {
            scenarioAssert.equal(
              effectsFor(foreign, source).filter(
                (effect) => effect.value?.loader === compatibilityPath,
              ).length,
              0,
              'A forged matchResource must not select the physical SDK pre-loader',
            );
          }
          scenarioAssert.equal(
            effectsFor(
              source,
              scenarioPath.join(basePath, 'virtual.js'),
            ).filter((effect) => effect.value?.loader === compatibilityPath)
              .length,
            1,
          );
          if (target === 'web-embed') {
            const babel = effects.filter(
              (effect) =>
                effect.type === 'use' &&
                /(^|[/\\])babel-loader(?:[/\\]|$)/.test(
                  effect.value?.loader || '',
                ),
            );
            scenarioAssert.equal(
              babel.length,
              1,
              'The actual WebEmbed dependency Babel rule must match the SDK',
            );
            // Normal loaders appear before pre-loaders in Webpack's loader list;
            // loader-runner executes their normal phases from right to left.
            const loaders = [...babel, ...compatibility].map((effect) => ({
              ...effect.value,
              loader: require.resolve(effect.value.loader),
            }));
            const runPipeline = (pipeline) =>
              new Promise((resolve, reject) =>
                runLoaders(
                  {
                    resource: source,
                    loaders: pipeline,
                    readResource: scenarioFs.readFile.bind(scenarioFs),
                    context: {
                      rootContext: process.cwd(),
                      _module: { rawRequest: source },
                      getOptions() {
                        return this.loaders[this.loaderIndex].options || {};
                      },
                      emitWarning(warning) {
                        throw warning;
                      },
                      emitError(error) {
                        throw error;
                      },
                    },
                  },
                  (error, value) => (error ? reject(error) : resolve(value)),
                ),
              );
            const result = await runPipeline(loaders);
            await scenarioAssert.rejects(
              runPipeline(loaders.toReversed()),
              /pinned original source/,
            );
            const output = String(result.result[0]);
            scenarioAssert.notEqual(
              output,
              scenarioFs.readFileSync(source, 'utf8'),
            );
            scenarioAssert.ok(
              output.includes('Unsupported Kaspa generated function body'),
            );
            scenarioAssert.ok(
              !output.includes('new Function(getStringFromWasm0'),
            );
          }
        }
      }
    }
  };
  for (const [environment, flag, generate] of [
    ['production', '1', ''],
    ['production', '', '1'],
    ['production', '', ''],
    ['development', '1', ''],
    ['development', '', ''],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `(${inspect.toString()})().catch(error => { console.error(error); process.exitCode = 1; });`,
      ],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: {
          ...process.env,
          NODE_ENV: environment,
          NODE_OPTIONS: '--max-old-space-size=2048',
          ONEKEY_LAVAMOAT: flag,
          ONEKEY_LAVAMOAT_GENERATE_POLICY: generate,
          ENABLE_ANALYZER: '',
          SENTRY_UPLOAD_BY_CLI: 'true',
        },
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 1_048_576,
      },
    );
    assert.ifError(result.error);
    assert.equal(
      result.status,
      0,
      `${environment}/${flag}/${generate}: ${result.stdout}\n${result.stderr}`,
    );
  }
});
