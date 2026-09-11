// cspell:ignore LavaMoat lavamoat kaspa zbar wasm

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const webpack = require('webpack');

const { createLavaMoatWebpackRules } = require('../webpack/lavamoat');
const { getLavaMoatWasmPaths } = require('../webpack/lavamoat-wasm-loader.cjs');

const { LavaMoatError } = require('./error.cjs');

function write(directory, file, content) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function compile(
  directory,
  rules,
  { generatePolicyOnly = false, entry = './index.js', output = 'dist' } = {},
) {
  const compiler = webpack({
    mode: 'production',
    context: directory,
    entry,
    output: {
      path: path.join(directory, output),
      filename: 'main.js',
      publicPath: 'https://wasm-fixture.invalid/',
      assetModuleFilename: 'assets/[name].[contenthash:10][ext]',
    },
    optimization: { minimize: false },
    resolve: { fallback: { path: false, fs: false } },
    module: { rules: [{ test: /\.bin$/, type: 'asset/resource' }, ...rules] },
    plugins: [
      new LavaMoatPlugin({
        rootDir: directory,
        policyLocation: path.join(directory, 'policy'),
        generatePolicyOnly,
        inlineLockdown: /^main\.js$/,
      }),
    ],
  });
  try {
    return await new Promise((resolve, reject) => {
      compiler.run((error, stats) => (error ? reject(error) : resolve(stats)));
    });
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('explicit WASM admission preserves approved bytes and zbar scanning without admitting other dependency assets', async () => {
  const originalMode = process.env.ONEKEY_LAVAMOAT;
  process.env.ONEKEY_LAVAMOAT = '1';
  const rules = createLavaMoatWebpackRules();
  if (originalMode === undefined) delete process.env.ONEKEY_LAVAMOAT;
  else process.env.ONEKEY_LAVAMOAT = originalMode;
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-wasm-')),
  );
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'wasm-fixture-root',
        private: true,
        dependencies: {
          'fixture-wasm-owner': '1.0.0',
          '@onekeyfe/kaspa-wasm': '1.0.2',
          'zbar.wasm': '2.1.1',
        },
      }),
    );
    write(
      directory,
      'node_modules/fixture-wasm-owner/package.json',
      JSON.stringify({
        name: 'fixture-wasm-owner',
        version: '1.0.0',
        main: 'index.js',
        dependencies: { '@onekeyfe/kaspa-wasm': '1.0.2', 'zbar.wasm': '2.1.1' },
      }),
    );
    for (const name of ['@onekeyfe/kaspa-wasm', 'zbar.wasm']) {
      const target = path.join(directory, 'node_modules', name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.symlinkSync(
        path.dirname(require.resolve(`${name}/package.json`)),
        target,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    }
    write(
      directory,
      'node_modules/fixture-wasm-owner/index.js',
      `
      module.exports = {
        kaspaUrl: require('@onekeyfe/kaspa-wasm/kaspa_bg.wasm.bin'),
        unapprovedUrl: require('./unapproved.bin'),
        scan: require('zbar.wasm').scanGrayBuffer,
      };
    `,
    );
    write(
      directory,
      'node_modules/fixture-wasm-owner/unapproved.bin',
      Buffer.from('unapproved asset bytes'),
    );
    write(
      directory,
      'index.js',
      `
      const owner = require('fixture-wasm-owner');
      fixtureResult.kaspaUrl = owner.kaspaUrl;
      fixtureResult.unapprovedUrl = owner.unapprovedUrl;
      fixtureResult.ready = owner.scan(new Uint8Array(16).buffer, 4, 4)
        .then((symbols) => { fixtureResult.scanCount = symbols.length; });
    `,
    );
    for (const generatePolicyOnly of [true, false]) {
      const stats = await compile(directory, rules, { generatePolicyOnly });
      const summary = stats.toJson({
        all: false,
        errors: true,
        warnings: true,
      });
      assert.equal(
        stats.hasErrors(),
        false,
        JSON.stringify(summary.errors).slice(0, 5000),
      );
      const blocked = summary.warnings.filter((warning) =>
        warning.message.includes('silently emitted'),
      );
      assert.equal(blocked.length, 1, JSON.stringify(blocked));
      assert.match(
        blocked[0].message,
        /fixture-wasm-owner[/\\]unapproved\.bin/,
      );
    }
    const emitted = fs.readdirSync(path.join(directory, 'dist/assets'));
    assert.equal(
      emitted.length,
      2,
      'only the two approved WASM assets may be emitted',
    );
    for (const resource of getLavaMoatWasmPaths()) {
      const original = fs.readFileSync(resource);
      const basename = path.basename(resource, '.bin');
      const filename = emitted.find((file) => file.startsWith(`${basename}.`));
      assert.ok(filename, `missing approved WASM resource ${basename}`);
      assert.match(filename, /\.[a-f0-9]{10}\.bin$/);
      const built = fs.readFileSync(
        path.join(directory, 'dist/assets', filename),
      );
      assert.equal(built.length, original.length);
      assert.equal(
        digest(built),
        digest(original),
        'binary loader must preserve every source byte',
      );
    }

    const fetched = [];
    const context = vm.createContext({
      console,
      fixtureResult: {},
      fetch: async (url) => {
        fetched.push(String(url));
        const pathname = new URL(url).pathname.slice(1);
        assert.match(pathname, /^assets\/zbar\.wasm\.[a-f0-9]{10}\.bin$/);
        return new Response(
          fs.readFileSync(path.join(directory, 'dist', pathname)),
          {
            headers: { 'Content-Type': 'application/wasm' },
          },
        );
      },
    });
    vm.runInContext(
      `
      globalThis.self = globalThis;
      globalThis.window = globalThis;
      globalThis.document = { currentScript: { src: 'https://wasm-fixture.invalid/main.js' } };
    `,
      context,
    );
    vm.runInContext(
      fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8'),
      context,
    );
    let timer;
    try {
      await Promise.race([
        context.fixtureResult.ready,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new LavaMoatError('zbar WASM fixture timed out')),
            10_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    assert.equal(
      context.fixtureResult.scanCount,
      0,
      'real zbar WASM should initialize and scan a blank image',
    );
    assert.equal(
      fetched.length,
      1,
      'zbar must fetch its actual emitted browser asset URL',
    );
    assert.match(
      context.fixtureResult.kaspaUrl,
      /assets\/kaspa_bg\.wasm\.[a-f0-9]{10}\.bin$/,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          directory,
          'dist',
          new URL(context.fixtureResult.unapprovedUrl).pathname,
        ),
      ),
      false,
    );

    const loader = require.resolve('../webpack/lavamoat-wasm-loader.cjs');
    const unapproved = path.join(
      directory,
      'node_modules/fixture-wasm-owner/unapproved.bin',
    );
    for (const prefix of ['', `${getLavaMoatWasmPaths()[0]}!=!`]) {
      write(
        directory,
        'attack.js',
        `require(${JSON.stringify(`${prefix}!${loader}!${unapproved}`)});`,
      );
      const stats = await compile(directory, rules, {
        entry: './attack.js',
        output: 'attack',
      });
      assert.equal(
        stats.hasErrors(),
        true,
        'inline loader requests must not admit other resources',
      );
      assert.match(
        stats.toString({ all: false, errors: true }),
        /LavaMoat WASM loader rejected an unapproved resource/,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
