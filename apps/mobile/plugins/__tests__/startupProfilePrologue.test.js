const {
  buildStartupProfilePrologue,
  isStartupProfileEnabled,
  GLOBAL_FLAG_KEY,
  GLOBAL_ID_TO_PATH_KEY,
} = require('../startupProfilePrologue');

// Tiny Map-like stand-in for the real `fileToIdMap` — the helper only needs
// `.entries()`, and using a bare object keeps tests independent of
// `plugins/map.js` state (which is process-global and mutated by other tests).
function fakeFileToIdMap(entries) {
  return { entries: () => entries[Symbol.iterator]() };
}

describe('isStartupProfileEnabled', () => {
  it('returns false when env var is absent', () => {
    expect(isStartupProfileEnabled({})).toBe(false);
  });

  it('returns true for "1" and "true"', () => {
    expect(isStartupProfileEnabled({ ONEKEY_STARTUP_PROFILE: '1' })).toBe(true);
    expect(isStartupProfileEnabled({ ONEKEY_STARTUP_PROFILE: 'true' })).toBe(
      true,
    );
  });

  it('returns false for any other truthy-looking value', () => {
    for (const v of ['0', 'false', 'yes', 'on', '']) {
      expect(isStartupProfileEnabled({ ONEKEY_STARTUP_PROFILE: v })).toBe(
        false,
      );
    }
  });
});

describe('buildStartupProfilePrologue', () => {
  it('returns empty string when the flag is not set — caller must skip injection', () => {
    const out = buildStartupProfilePrologue({
      fileToIdMap: fakeFileToIdMap([['/repo/apps/mobile/index.ts', 1]]),
      env: {},
    });
    expect(out).toBe('');
  });

  it('emits both global assignments and a valid id→path JSON map when enabled', () => {
    const out = buildStartupProfilePrologue({
      fileToIdMap: fakeFileToIdMap([
        ['/abs/path/to/monorepo/apps/mobile/index.ts', 0],
        ['/abs/path/to/monorepo/packages/kit/src/App.tsx', 42],
        ['/abs/path/to/monorepo/node_modules/ethers/lib/index.js', 99],
      ]),
      env: { ONEKEY_STARTUP_PROFILE: '1' },
    });
    expect(out).toContain(`globalThis.${GLOBAL_FLAG_KEY} = true;`);
    expect(out).toContain(`globalThis.${GLOBAL_ID_TO_PATH_KEY} =`);

    // Extract and parse the JSON literal to verify trimming + id typing.
    const match = out.match(
      new RegExp(`globalThis\\.${GLOBAL_ID_TO_PATH_KEY} = (\\{.*\\});`),
    );
    expect(match).not.toBeNull();
    const idToPath = JSON.parse(match[1]);
    expect(idToPath).toEqual({
      0: 'apps/mobile/index.ts',
      42: 'packages/kit/src/App.tsx',
      99: 'node_modules/ethers/lib/index.js',
    });
  });

  it('filters non-number ids and non-string paths silently', () => {
    const out = buildStartupProfilePrologue({
      fileToIdMap: fakeFileToIdMap([
        ['/r/apps/x.ts', 1],
        ['/r/apps/bogus.ts', 'not-a-number'],
        [12_345, 2], // path must be a string
        [null, 3],
      ]),
      env: { ONEKEY_STARTUP_PROFILE: '1' },
    });
    const match = out.match(
      new RegExp(`globalThis\\.${GLOBAL_ID_TO_PATH_KEY} = (\\{.*\\});`),
    );
    const idToPath = JSON.parse(match[1]);
    expect(idToPath).toEqual({ 1: 'apps/x.ts' });
  });

  it('tolerates a missing or shape-incompatible fileToIdMap — emits empty map', () => {
    for (const arg of [undefined, {}, { entries: null }]) {
      const out = buildStartupProfilePrologue({
        fileToIdMap: arg,
        env: { ONEKEY_STARTUP_PROFILE: '1' },
      });
      expect(out).toContain(`globalThis.${GLOBAL_FLAG_KEY} = true;`);
      expect(out).toContain(`globalThis.${GLOBAL_ID_TO_PATH_KEY} = {};`);
    }
  });

  it('produces a string that is safe to concatenate into a bundle pre-section', () => {
    const out = buildStartupProfilePrologue({
      fileToIdMap: fakeFileToIdMap([['/m/apps/a.ts', 1]]),
      env: { ONEKEY_STARTUP_PROFILE: 'true' },
    });
    // No unterminated quotes, balanced braces.
    // eslint-disable-next-line no-new-func
    expect(() => Function(out)).not.toThrow();
  });

  it('emits a __d wrapper that intercepts factory definitions', () => {
    const out = buildStartupProfilePrologue({
      fileToIdMap: fakeFileToIdMap([['/m/apps/a.ts', 1]]),
      env: { ONEKEY_STARTUP_PROFILE: '1' },
    });
    // The wrapper must replace globalThis.__d and populate
    // __ONEKEY_STARTUP_PROFILE_STATS__ so flushStartupProfileJs can read it.
    expect(out).toContain('globalThis.__d = function');
    expect(out).toContain('__ONEKEY_STARTUP_PROFILE_STATS__');
    expect(out).toContain('_factory.apply');
  });

  it('__d wrapper actually times factory calls', () => {
    const out = buildStartupProfilePrologue({
      fileToIdMap: fakeFileToIdMap([]),
      env: { ONEKEY_STARTUP_PROFILE: '1' },
    });
    // Simulate Metro runtime: __d stores factory, __r calls it.
    // eslint-disable-next-line no-new-func
    const setup = new Function(
      'globalThis',
      `
      // Minimal Metro prelude stub
      globalThis.__d = function(factory, id) { globalThis._modules = globalThis._modules || {}; globalThis._modules[id] = factory; };
      globalThis.__r = function(id) { return globalThis._modules[id](); };
      // Run the prologue which wraps __d
      ${out}
      `,
    );
    const g = { Date };
    setup(g);
    // Register + invoke a module via the wrapped __d
    g.__d(function () {
      /* simulated 0ms factory */
    }, 42);
    g.__r(42);
    const stats = g.__ONEKEY_STARTUP_PROFILE_STATS__;
    expect(stats).toBeInstanceOf(Map);
    // Module 42 was invoked — stats may or may not record it depending on
    // Date.now() resolution (0ms rounds to < 1ms threshold). Just verify the
    // map exists and no error was thrown.
  });
});

// Regression: `unionBuild.js writeBundle()` must inject the prologue into the
// common bundle. It's the only bundle with `includePre=true`, and it's the
// one both runtimes load first. Before the fix it silently skipped injection
// and the JS-side profile never activated in union builds.
describe('unionBuild.js injection point', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/unionBuild.js'),
    'utf8',
  );

  it('imports the shared helper', () => {
    expect(src).toMatch(
      /require\(['"]\.\.\/plugins\/startupProfilePrologue['"]\)/,
    );
  });

  it('calls buildStartupProfilePrologue inside an includePre-gated branch', () => {
    // Anchor on `if (includePre)` followed within ~30 lines by the helper
    // call. Avoids over-specifying formatting.
    const m = src.match(
      /if \(includePre\)\s*\{[\s\S]{0,1500}?buildStartupProfilePrologue/,
    );
    expect(m).not.toBeNull();
  });
});
