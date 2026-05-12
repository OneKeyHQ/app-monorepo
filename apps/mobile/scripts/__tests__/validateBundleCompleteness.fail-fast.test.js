// apps/mobile/scripts/__tests__/validateBundleCompleteness.fail-fast.test.js
const { validateBundleCompleteness } = require('../unionBuildHelpers');

describe('validateBundleCompleteness — build-time guard', () => {
  it('returns valid=false when a sync dep is reachable but not covered', () => {
    // Graph: /a.js sync-requires /b.js. /a.js is in the eager bundle.
    // /b.js is neither eager nor in any segment → orphan → runtime crash.
    const graph = new Map([
      [
        '/a.js',
        {
          dependencies: new Map([
            [
              'b',
              { absolutePath: '/b.js', data: { data: { asyncType: null } } },
            ],
          ]),
        },
      ],
      ['/b.js', { dependencies: new Map() }],
    ]);

    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: new Set(['/a.js']),
      segmentAbsPaths: new Set(),
    });

    expect(result.valid).toBe(false);
    expect(result.missingAbsPaths).toContain('/b.js');
  });

  it('returns valid=true when every reachable sync dep is covered', () => {
    const graph = new Map([
      [
        '/a.js',
        {
          dependencies: new Map([
            [
              'b',
              { absolutePath: '/b.js', data: { data: { asyncType: null } } },
            ],
          ]),
        },
      ],
      ['/b.js', { dependencies: new Map() }],
    ]);
    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: new Set(['/a.js', '/b.js']),
      segmentAbsPaths: new Set(),
    });
    expect(result.valid).toBe(true);
    expect(result.missingAbsPaths).toHaveLength(0);
  });
});
