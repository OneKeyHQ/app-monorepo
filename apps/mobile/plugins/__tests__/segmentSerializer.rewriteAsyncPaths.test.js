// apps/mobile/plugins/__tests__/segmentSerializer.rewriteAsyncPaths.test.js
const {
  rewriteAsyncPathsInModules,
} = require('../segmentSerializer.rewriteAsyncPaths');

// Simulates Metro's serialized output for one module that does
//   import('@onekeyhq/kit/src/views/Receive/pages/ReceiveToken')
// with module id 777, before Step 10 rewrite.
function makeModuleWithUnrewrittenPaths(modId, asyncIds) {
  const pathsObject = asyncIds
    .map(
      (id) =>
        `"${id}":"/packages/kit/src/views/X${id}/index.bundle?modulesOnly=true&runModule=false"`,
    )
    .join(',');
  return [
    modId,
    `__d(function (g, r, i, a, m, e, d) { asyncRequire(${asyncIds[0]}, {${pathsObject}}); }, ${modId}, [${asyncIds.join(',')}]);`,
  ];
}

describe('rewriteAsyncPathsInModules', () => {
  it('replaces every async-id value with its seg: key', () => {
    const moduleToSegment = new Map([
      [777, 'seg:kit.views.Receive.pages.ReceiveToken'],
      [791, 'seg:kit.views.ScanQrCode.pages.ScanQrCodeModal'],
    ]);
    const modules = [
      makeModuleWithUnrewrittenPaths(1000, [777]),
      makeModuleWithUnrewrittenPaths(1001, [791]),
    ];

    rewriteAsyncPathsInModules(modules, moduleToSegment);

    expect(modules[0][1]).toContain(
      '"777":"seg:kit.views.Receive.pages.ReceiveToken"',
    );
    expect(modules[0][1]).not.toContain('ReceiveToken.bundle');
    expect(modules[1][1]).toContain(
      '"791":"seg:kit.views.ScanQrCode.pages.ScanQrCodeModal"',
    );
  });

  it('is idempotent — running twice equals running once', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [
      [
        1000,
        '__d(function(){asyncRequire(777,{"777":"/p/q.bundle?modulesOnly=true&runModule=false"});},1000,[777]);',
      ],
    ];

    rewriteAsyncPathsInModules(modules, moduleToSegment);
    const afterOnce = modules[0][1];

    rewriteAsyncPathsInModules(modules, moduleToSegment);
    expect(modules[0][1]).toEqual(afterOnce);
  });

  it('skips entries with non-string module code (defensive)', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [
      [1000, null],
      [1001, undefined],
      [1002, 42],
    ];
    expect(() =>
      rewriteAsyncPathsInModules(modules, moduleToSegment),
    ).not.toThrow();
  });

  it('does nothing when moduleToSegment is empty', () => {
    const modules = [makeModuleWithUnrewrittenPaths(1000, [777])];
    const before = modules[0][1];
    rewriteAsyncPathsInModules(modules, new Map());
    expect(modules[0][1]).toBe(before);
  });

  it('matches paths that appear with both `{ "id":` and `, "id":` prefix shapes', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [
      [
        1000,
        `__d(fn,1000,[777]); /* sentinel */ var p = {"777":"/x/y.bundle?modulesOnly=true&runModule=false","999":"/z.bundle"};`,
      ],
      [
        1001,
        `__d(fn,1001,[777]); var q = {"a":1,"777":"/x/y.bundle?modulesOnly=true&runModule=false"};`,
      ],
    ];
    rewriteAsyncPathsInModules(modules, moduleToSegment);
    expect(modules[0][1]).toContain('"777":"seg:foo"');
    expect(modules[1][1]).toContain('"777":"seg:foo"');
  });

  it('handles values containing escaped quotes without corruption', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [
      [1000, '{"777":"/p/\\"q\\"/x.bundle?modulesOnly=true&runModule=false"}'],
    ];
    rewriteAsyncPathsInModules(modules, moduleToSegment);
    expect(modules[0][1]).toBe('{"777":"seg:foo"}');
  });

  it('does not rewrite ids that are not inside a paths-map shape', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [[1000, 'var x = ["aaa", "bbb"]; /* 777 was here */']];
    rewriteAsyncPathsInModules(modules, moduleToSegment);
    expect(modules[0][1]).toBe('var x = ["aaa", "bbb"]; /* 777 was here */');
  });

  // Codex 2026-04-28 audit, Important #1: this helper is BROADER than the
  // production-path helper (`unionBuildHelpers.js:rewriteAsyncRequirePaths`),
  // which scopes inside `"paths":{...}` blocks. Here we only require the
  // `[{,]` prefix, so an unrelated object literal whose key happens to be a
  // numeric string we are tracking COULD be mutated. Document the limit so
  // a future user of this legacy helper knows what they're getting.
  it('legacy helper IS susceptible to false-rewrite of unrelated `{"id":"value"}` shapes (known limit; production path scopes by `"paths":{...}` block)', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    // Imagine a config object accidentally keyed by the string "777":
    const modules = [
      [1000, 'const cfg = {"777":"some-unrelated-string-value"};'],
    ];
    rewriteAsyncPathsInModules(modules, moduleToSegment);
    // The helper rewrites it. This test pins the behavior so a future
    // tightening (scoping to `"paths":{...}`) is caught and re-evaluated.
    expect(modules[0][1]).toBe('const cfg = {"777":"seg:foo"};');
    // If you scope this helper to `"paths":{...}` blocks in the future,
    // flip this assertion to .not.toBe and update the documentation.
  });
});
