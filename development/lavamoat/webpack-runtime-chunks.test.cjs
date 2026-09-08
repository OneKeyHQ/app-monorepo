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
    const document = {
      getElementsByTagName: () => [],
      createElement: () => ({ setAttribute() {} }),
      head: {
        appendChild(script) {
          const file = script.src.slice(1);
          lazyRequests.push(file);
          vm.runInContext(
            fs.readFileSync(path.join(output, file), 'utf8'),
            context,
          );
          script.onload({ type: 'load', target: script });
        },
      },
    };
    const context = vm.createContext({
      console,
      document,
      setTimeout,
      clearTimeout,
      fixtureResult: {},
      hostSecret: 'private host capability',
      fetch() {
        assert.fail('a dependency must never call host fetch');
      },
    });
    vm.runInContext(
      'globalThis.self = globalThis; globalThis.window = globalThis; globalThis.location = { origin: "https://fixture.invalid" };',
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
        /exactly one dedicated runtime containing one untouched SES prelude/,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
