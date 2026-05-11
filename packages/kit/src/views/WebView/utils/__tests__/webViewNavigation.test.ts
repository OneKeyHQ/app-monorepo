import { ERootRoutes, EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { openWebView } from '../webViewNavigation';

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $rootAppNavigation: { navigate: jest.fn() },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  resetToRoute: jest.fn(),
  rootNavigationRef: {
    current: {
      getRootState: jest.fn(() => ({ routes: [{ name: 'main' }], index: 0 })),
    },
  },
}));

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const components = require('@onekeyhq/components') as {
  resetToRoute: jest.Mock;
  rootNavigationRef: {
    current: {
      getRootState: jest.Mock;
    };
  };
};
const appGlobals = require('@onekeyhq/shared/src/appGlobals').default;
const platformEnv = require('@onekeyhq/shared/src/platformEnv').default;
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

// Avoid the literal `javascript:` URL form to satisfy `no-script-url`.
const JS_SCHEME_URL = ['java', 'script:', 'alert(1)'].join('');

describe('openWebView', () => {
  const originalOpen = (globalThis as { open?: unknown }).open;

  beforeEach(() => {
    Object.assign(platformEnv, {
      isWeb: false,
      isExtension: false,
      isNativeIOS: false,
    });
    (globalThis as { open?: unknown }).open = jest.fn(() => null);
    components.rootNavigationRef.current.getRootState.mockReturnValue({
      routes: [{ name: 'main' }],
      index: 0,
    });
    jest.clearAllMocks();
  });

  afterAll(() => {
    (globalThis as { open?: unknown }).open = originalOpen;
  });

  it('rejects javascript: scheme (no nav, no window.open)', () => {
    openWebView({ url: JS_SCHEME_URL });
    expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
    expect(globalThis.open).not.toHaveBeenCalled();
  });

  it('rejects http:// scheme — https-only policy', () => {
    openWebView({ url: 'http://example.com' });
    expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
    expect(globalThis.open).not.toHaveBeenCalled();
  });

  it('rejects userinfo embed (phishing vector)', () => {
    openWebView({ url: 'https://trusted.com@evil.com/' });
    expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
    expect(globalThis.open).not.toHaveBeenCalled();
  });

  it('opens window on web with noopener,noreferrer', () => {
    Object.assign(platformEnv, { isWeb: true });
    openWebView({ url: 'https://example.com' });
    expect(globalThis.open).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );
    expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
  });

  it('navigates root app on native with three-level params nesting', () => {
    openWebView({ url: 'https://example.com', title: 'X' });
    expect(appGlobals.$rootAppNavigation.navigate).toHaveBeenCalledWith(
      ERootRoutes.WebView,
      expect.objectContaining({
        screen: EWebViewRoutes.WebView,
        params: expect.objectContaining({
          screen: EWebViewRoutes.WebView,
          params: expect.objectContaining({
            url: 'https://example.com',
            title: 'X',
          }),
        }),
      }),
    );
  });

  it('opens window on extension with noopener,noreferrer', () => {
    Object.assign(platformEnv, { isExtension: true });
    openWebView({ url: 'https://example.com' });
    expect(globalThis.open).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );
    expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
  });

  describe('iOS atomic-overlay-swap', () => {
    beforeEach(() => {
      Object.assign(platformEnv, { isNativeIOS: true });
    });

    it('navigates directly when no overlay is stacked above Main', () => {
      components.rootNavigationRef.current.getRootState.mockReturnValue({
        routes: [{ name: 'main' }],
        index: 0,
      });
      openWebView({ url: 'https://example.com' });
      expect(components.resetToRoute).not.toHaveBeenCalled();
      expect(appGlobals.$rootAppNavigation.navigate).toHaveBeenCalledWith(
        ERootRoutes.WebView,
        expect.any(Object),
      );
    });

    it('atomically swaps to [Main, WebView] via resetToRoute when an overlay is stacked', () => {
      components.rootNavigationRef.current.getRootState.mockReturnValue({
        routes: [{ name: 'main' }, { name: 'modal' }],
        index: 1,
      });
      openWebView({ url: 'https://example.com', title: 'X' });
      // resetToRoute is called synchronously with the nested payload — no
      // promise chain, no setTimeout, one dispatch.
      expect(components.resetToRoute).toHaveBeenCalledWith(
        ERootRoutes.WebView,
        expect.objectContaining({
          screen: EWebViewRoutes.WebView,
          params: expect.objectContaining({
            screen: EWebViewRoutes.WebView,
            params: expect.objectContaining({
              url: 'https://example.com',
              title: 'X',
            }),
          }),
        }),
      );
      // navigate() must NOT also fire — that would be a double-dispatch.
      expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
    });
  });
});
