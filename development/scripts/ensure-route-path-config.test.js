const { isViewRouterSourceFile } = require('./ensure-route-path-config');

describe('route config source watcher', () => {
  it.each([
    'Onboardingv2/router/index.tsx',
    'Onboardingv2/router/index.web-only.tsx',
    'Onboardingv2/router.ts',
    'Onboardingv2/router.native.mjs',
    'Onboardingv2/router.web-only.jsx',
  ])('watches supported router source %s', (filePath) => {
    expect(isViewRouterSourceFile(filePath)).toBe(true);
  });

  it.each([
    'Onboardingv2/pages/router-notes.ts',
    'Onboardingv2/router/index.json',
  ])('ignores unrelated source %s', (filePath) => {
    expect(isViewRouterSourceFile(filePath)).toBe(false);
  });

  it('handles a long router-like file name without backtracking', () => {
    expect(
      isViewRouterSourceFile(`Feature/${'.'.repeat(20_000)}router.tsx`),
    ).toBe(false);
  });
});
