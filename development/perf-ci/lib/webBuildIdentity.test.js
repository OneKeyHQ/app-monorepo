const {
  assertBuildScriptsLoaded,
  scriptAssetNamesFromHtml,
} = require('./webBuildIdentity');

describe('web build identity', () => {
  test('extracts quoted and unquoted script assets without query strings', () => {
    expect(
      scriptAssetNamesFromHtml(`
        <script defer src="/main.abc.bundle.js"></script>
        <script src='/static/js/chunk.def.js?v=1'></script>
        <script src=vendor.js#hash></script>
      `),
    ).toEqual(['main.abc.bundle.js', 'chunk.def.js', 'vendor.js']);
  });

  test('accepts the current build when all entry scripts are loaded', () => {
    expect(() =>
      assertBuildScriptsLoaded({
        expected: ['main.abc.bundle.js', 'vendor.js'],
        loaded: ['main.abc.bundle.js', 'vendor.js', 'lazy.js'],
      }),
    ).not.toThrow();
  });

  test('rejects a stale cached build', () => {
    expect(() =>
      assertBuildScriptsLoaded({
        expected: ['main.current.bundle.js'],
        loaded: ['main.stale.bundle.js'],
      }),
    ).toThrow(/stale Service Worker or browser cache/);
  });
});
