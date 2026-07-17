const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectBrowserStorageViolations,
  createBuildOptions,
} = require('./esbuild.config');

test('detects direct and global browser storage access', () => {
  const violations = collectBrowserStorageViolations(
    'example.ts',
    [
      "const value = localStorage.getItem('key');",
      "window.sessionStorage.setItem('key', value);",
      "globalThis.localStorage?.removeItem('key');",
    ].join('\n'),
  );

  assert.deepEqual(
    violations.map(({ text }) => text),
    ['localStorage', 'window.sessionStorage', 'globalThis.localStorage'],
  );
});

test('ignores browser storage names used only as declarations', () => {
  const violations = collectBrowserStorageViolations(
    'example.ts',
    [
      'const localStorage = undefined;',
      'function sessionStorage() {}',
      'type StorageNames = "localStorage" | "sessionStorage";',
    ].join('\n'),
  );

  assert.deepEqual(violations, []);
});

test('keeps production and watch build behavior distinct', () => {
  const production = createBuildOptions({ watch: false });
  const watch = createBuildOptions({ watch: true });

  assert.equal(production.bundle, true);
  assert.equal(production.format, 'cjs');
  assert.equal(production.platform, 'node');
  assert.equal(production.target, 'node22');
  assert.deepEqual(production.drop, ['console', 'debugger']);
  assert.deepEqual(watch.drop, []);
});
