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

  it('error body includes the env var name and remediation hint', () => {
    expect(() =>
      assertBundleCompleteness([
        {
          runtimeLabel: 'main',
          result: { valid: false, missingAbsPaths: ['/x.js'] },
        },
      ]),
    ).toThrow(/ONEKEY_ALLOW_INCOMPLETE_BUNDLE=1/);

    expect(() =>
      assertBundleCompleteness([
        {
          runtimeLabel: 'main',
          result: { valid: false, missingAbsPaths: ['/x.js'] },
        },
      ]),
    ).toThrow(/bundle-groups\.config\.js/);
  });
});
