const assert = require('node:assert/strict');
const { test } = require('node:test');

const { inspectJavaScript } = require('./check-browser-compat');

test('accepts syntax supported by the Chromium 80 baseline', () => {
  const failures = [];
  inspectJavaScript(
    `
      const nested = value?.nested?.[0] ?? 1;
      class Example {
        static field = 1_000;
        #private = 2;
      }
      export * as namespace from './namespace.js';
      void new Example();
      void nested;
    `,
    'chromium-80-supported.js',
    failures,
  );
  assert.deepEqual(failures, []);
});

test('rejects syntax introduced after the Chromium 80 baseline', () => {
  const failures = [];
  inspectJavaScript(
    'let value; value ??= 1; /value/d; class Future { #method() {} }',
    'post-chromium-80.js',
    failures,
  );
  assert.deepEqual(
    failures.map(({ reason }) => reason),
    [
      'assignment operator ??=',
      'regular expression flag d',
      'ClassPrivateMethod',
    ],
  );
});
