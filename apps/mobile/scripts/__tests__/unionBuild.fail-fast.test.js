const { assertBundleCompleteness } = require('../unionBuildHelpers');

describe('assertBundleCompleteness', () => {
  it('throws when any runtime has missing modules', () => {
    expect(() =>
      assertBundleCompleteness([
        {
          runtimeLabel: 'main',
          result: { valid: false, missingAbsPaths: ['/x.js', '/y.js'] },
        },
        {
          runtimeLabel: 'background',
          result: { valid: true, missingAbsPaths: [] },
        },
      ]),
    ).toThrow(/main runtime.*2 module/);
  });

  it('returns quietly when all runtimes are valid', () => {
    expect(() =>
      assertBundleCompleteness([
        {
          runtimeLabel: 'main',
          result: { valid: true, missingAbsPaths: [] },
        },
        {
          runtimeLabel: 'background',
          result: { valid: true, missingAbsPaths: [] },
        },
      ]),
    ).not.toThrow();
  });
});
