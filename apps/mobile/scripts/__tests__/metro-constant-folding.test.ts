import { runInNewContext } from 'node:vm';

import { getDefaultConfig } from 'metro-config';
import { transform } from 'metro-transform-worker';

const { projectRoot, transformer } =
  getDefaultConfig.getDefaultValues(__dirname);

function transformProductionModule(source: string) {
  return transform(
    {
      ...transformer,
      enableBabelRCLookup: false,
      unstable_disableModuleWrapping: true,
    },
    projectRoot,
    'constant-folding-fixture.js',
    Buffer.from(source),
    {
      dev: false,
      inlinePlatform: true,
      inlineRequires: false,
      minify: false,
      platform: 'ios',
      type: 'module',
      unstable_transformProfile: 'default',
    },
  );
}

describe('Metro production constant folding', () => {
  it.each([
    ['an arrow initializer', 'let callback = () => {}; callback = null;'],
    [
      'a function expression',
      'var callback = function () {}; callback = null;',
    ],
    ['a function declaration', 'function callback() {} callback = null;'],
    [
      'a self-reassigning function with an external write',
      'function callback() { callback = null; } callback = null;',
    ],
  ])('preserves the external assignment for %s', async (_, declarations) => {
    const { output } = await transformProductionModule(`
      module.exports = (function () {
        "use strict";
        ${declarations}
        if (__DEV__) callback();
        return "loaded";
      })();
    `);

    const fixtureModule = { exports: null };
    runInNewContext(output[0].data.code, { module: fixtureModule });
    expect(fixtureModule.exports).toBe('loaded');
  });

  it.each([
    [
      'a function declaration',
      `function lazy() {
        const value = require("unused-dependency");
        lazy = () => value;
        return value;
      }`,
    ],
    [
      'a function expression',
      `var lazy = function () {
        const value = require("unused-dependency");
        lazy = () => value;
        return value;
      };`,
    ],
  ])(
    'drops the dependency of an unused self-reassigning helper written as %s',
    async (_, declaration) => {
      const { dependencies } = await transformProductionModule(`
        ${declaration}
        if (__DEV__) lazy();
        module.exports = require("used-dependency");
      `);

      expect(dependencies.map(({ name }) => name)).toEqual(['used-dependency']);
    },
  );
});
