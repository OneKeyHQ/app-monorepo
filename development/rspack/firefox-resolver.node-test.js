const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const { transformSync } = require('@swc/core');

const filename = path.join(__dirname, 'utils.ts');
const source = transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
  module: { type: 'commonjs' },
}).code;

function extensions(browser, configName = 'bg') {
  const module = { exports: {} };
  vm.runInNewContext(
    source,
    {
      module,
      exports: module.exports,
      console: { log() {} },
      require(id) {
        if (id === './constant')
          return {
            extChannel: browser,
            targetBrowser: browser,
            isManifestV3: true,
          };
        if (id === '../developmentConsts')
          return { platforms: { web: 'web', webEmbed: 'web-embed' } };
        return require(id);
      },
    },
    { filename },
  );
  return Array.from(
    module.exports.createResolveExtensions({ platform: 'ext', configName }),
  );
}

test('Firefox DOM background resolves web SDKs rather than offscreen proxies', () => {
  const suffixes = extensions('firefox');
  const sdkRoots = [
    'packages/shared/src/hardware/sdk-loader/index',
    ...[
      'ada/sdkAda',
      'kaspa/sdkKaspa',
      'xmr/sdkXmrRuntime',
      'zcash/sdkZcash',
    ].map((chain) => `packages/core/src/chains/${chain}/sdk/index`),
  ];
  const repoRoot = path.resolve(__dirname, '../..');
  for (const root of sdkRoots) {
    const resolved = suffixes.find((suffix) =>
      fs.existsSync(path.join(repoRoot, root + suffix)),
    );
    assert.ok(resolved, root);
    assert.notEqual(resolved, '.ext-bg-v3.ts', root);
  }
  assert.equal(suffixes.includes('.ext-bg-v3.ts'), false);
  const settings = 'packages/shared/src/storage/instance/mmkvStorageInstance';
  assert.equal(
    suffixes.find((suffix) =>
      fs.existsSync(path.join(repoRoot, settings + suffix)),
    ),
    '.ts',
    'Firefox settings must survive event-page restarts using the web storage implementation',
  );
});

test('Chrome and Edge backgrounds retain offscreen proxies; UI does not select them', () => {
  for (const browser of ['chrome', 'edge']) {
    assert.ok(
      extensions(browser).indexOf('.ext-bg-v3.ts') <
        extensions(browser).indexOf('.web.ts'),
    );
    assert.equal(extensions(browser, 'pages').includes('.ext-bg-v3.ts'), false);
  }
});

test('core-js global lookup works in a Firefox isolated world without dynamic code', () => {
  const context = vm.createContext({
    module: { exports: {} },
    window: { Math: {} },
    self: { Math: {} },
    Function() {
      throw new Error('CSP blocks Function');
    },
  });
  const shim = fs.readFileSync(
    path.join(__dirname, 'shims/core-js-global.js'),
    'utf8',
  );
  vm.runInContext(shim, context);
  assert.equal(context.module.exports, vm.runInContext('globalThis', context));
});
