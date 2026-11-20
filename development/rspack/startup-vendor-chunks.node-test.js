const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const { transformSync } = require('@swc/core');

// Exercise the real config factory without loading the native bundler in tests.
const filename = path.join(__dirname, 'rspack.prod.config.ts');
const source = transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
  module: { type: 'commonjs' },
}).code;
const configModule = { exports: {} };
class Plugin {}
vm.runInNewContext(
  source,
  {
    exports: configModule.exports,
    module: configModule,
    console: { log() {} },
    require(id) {
      if (id === '@rspack/core')
        return {
          rspack: { DefinePlugin: Plugin, SwcJsMinimizerRspackPlugin: Plugin },
        };
      if (id === './plugins/RetryChunkLoadRspackPlugin')
        return { RetryChunkLoadRspackPlugin: Plugin };
      if (id === './utils') return { getOutputFolder: () => 'chrome' };
      if (id === '../developmentConsts') return require('../developmentConsts');
      if (id === 'path') return path;
      throw new Error(`Unexpected config dependency: ${id}`);
    },
  },
  { filename },
);
const config = (platform) =>
  configModule.exports.createProductionConfig({ platform, basePath: '/app' })
    .optimization.splitChunks;

test('eager date utilities get a stable group without pulling in lazy locales', () => {
  const group = config('web').cacheGroups.dateFnsVendor;
  assert.equal(group.name, 'vendor-date-fns');
  assert.equal(group.chunks, 'initial');
  assert.equal(group.reuseExistingChunk, true);
  assert.equal(group.enforce, undefined);
  assert.equal(group.priority, 20);
});

test('date utility matching is package-scoped on both supported path separators', () => {
  const { test: matches } = config('web').cacheGroups.dateFnsVendor;
  assert.equal(matches.test('/app/node_modules/date-fns/index.js'), true);
  assert.equal(matches.test('C:\\app\\node_modules\\date-fns\\index.js'), true);
  assert.equal(matches.test('/app/node_modules/date-fns-tz/index.js'), false);
  assert.equal(matches.test('/app/packages/date-fns/index.js'), false);
  assert.equal(matches.test('/app/node_modules/axios/index.js'), false);
});

test('the targeted web grouping does not alter other platform graphs', () => {
  for (const platform of ['desktop', 'ext', 'web-embed']) {
    assert.equal(config(platform).cacheGroups.dateFnsVendor, undefined);
  }
});

test('web splitting size and request constraints remain unchanged', () => {
  const split = config('web');
  assert.equal(split.minSize, 153_600);
  assert.equal(split.maxSize, 614_400);
  assert.equal(split.maxInitialRequests, 20);
});
