const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const babel = require('@babel/core');

const packageRoot = path.resolve(
  __dirname,
  '../../node_modules/@tamagui/animations-reanimated',
);
const entries = [
  'src/createAnimations.tsx',
  'dist/cjs/createAnimations.native.js',
  'dist/esm/createAnimations.native.js',
];

function loadAnimation(entry, initialStyle) {
  const filename = path.join(packageRoot, entry);
  const source = fs.readFileSync(filename, 'utf8');
  const ast = babel.parseSync(source, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
  });
  const declarations = [];
  babel.traverse(ast, {
    VariableDeclarator({ node }) {
      if (['applyAnimation', 'createReanimatedConfig'].includes(node.id.name)) {
        declarations.push(`const ${source.slice(node.start, node.end)};`);
      }
    },
  });
  assert.equal(declarations.length, 2);

  const starts = [];
  const delays = [];
  const callbacks = [];
  const createAnimation = (value, _config, callback) => {
    // Reanimated's defineAnimation returns the target during initialUpdaterRun.
    if (initialStyle) return value;
    return {
      current: value,
      callback,
      onStart(_animation, startValue) {
        starts.push(startValue);
      },
    };
  };
  const reanimated = {
    withSpring: createAnimation,
    withTiming: createAnimation,
    withDelay(delay, animation) {
      delays.push(delay);
      return animation;
    },
  };
  const module = { exports: {} };
  const transformed = babel.transformSync(
    `'use strict';\n${declarations.join('\n')}\nmodule.exports = applyAnimation;`,
    {
      filename,
      configFile: false,
      babelrc: false,
      plugins: ['@babel/plugin-transform-typescript'],
    },
  ).code;
  vm.runInNewContext(transformed, {
    ...reanimated,
    import_react_native_reanimated: reanimated,
    module,
  });
  return {
    applyAnimation: module.exports,
    starts,
    delays,
    callbacks,
    callback: (finished) => callbacks.push(finished),
  };
}

for (const entry of entries) {
  for (const type of ['spring', 'timing']) {
    test(`${entry}: ${type} preserves primitive values during initial style evaluation`, () => {
      const { applyAnimation, delays } = loadAnimation(entry, true);
      assert.equal(applyAnimation(1, { type }, undefined, 0.9), 1);
      assert.equal(
        applyAnimation('#ffffff', { type }, undefined, undefined, true),
        '#ffffff',
      );
      assert.equal(applyAnimation(1, { type, delay: 100 }, undefined, 0.9), 1);
      assert.deepEqual(delays, [100]);
    });

    test(`${entry}: ${type} still seeds UI animations and preserves completion`, () => {
      const { applyAnimation, starts, delays, callback, callbacks } =
        loadAnimation(entry, false);
      const animation = applyAnimation(1, { type, delay: 100 }, callback, 0.9);

      animation.onStart(animation, 1, 0, undefined);
      assert.deepEqual(starts, [0.9]);
      assert.deepEqual(delays, [100]);
      animation.callback(true);
      assert.deepEqual(callbacks, [true]);
    });
  }
}
