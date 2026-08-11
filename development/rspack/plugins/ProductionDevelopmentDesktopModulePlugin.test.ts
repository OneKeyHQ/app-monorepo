import { resolveProductionDevelopmentDesktopModuleRequest } from './productionDevelopmentDesktopModuleRequest';

describe('ProductionDevelopmentDesktopModulePlugin', () => {
  test.each([
    [
      '@onekeyhq/kit/src/developmentDesktop/webView',
      '@onekeyhq/kit/src/developmentDesktop/webView.ts',
    ],
    [
      '../developmentDesktop/modalRoutes.desktop.tsx?lazy',
      '../developmentDesktop/modalRoutes.ts?lazy',
    ],
    [
      '@onekeyhq/kit/src/developmentDesktop/webView.desktop',
      '@onekeyhq/kit/src/developmentDesktop/webView.ts',
    ],
    ['..\\developmentDesktop\\features.desktop.ts', '..\\developmentDesktop\\features.ts'],
  ])('maps %s to its feature-free TypeScript module', (request, expected) => {
    expect(resolveProductionDevelopmentDesktopModuleRequest(request)).toBe(expected);
  });

  test('does not rewrite modules outside the development Desktop boundary', () => {
    expect(
      resolveProductionDevelopmentDesktopModuleRequest('@onekeyhq/shared/src/routes/discovery'),
    ).toBe('@onekeyhq/shared/src/routes/discovery');
  });
});
