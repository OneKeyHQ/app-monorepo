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
  popToMainRoute: jest.fn(() => Promise.resolve()),
  rootNavigationRef: {
    current: {
      getRootState: jest.fn(() => ({ routes: [{ name: 'main' }], index: 0 })),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const appGlobals = require('@onekeyhq/shared/src/appGlobals').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const platformEnv = require('@onekeyhq/shared/src/platformEnv').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const components = require('@onekeyhq/components');

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

  describe('iOS modal-dismiss-before-navigate', () => {
    beforeEach(() => {
      Object.assign(platformEnv, { isNativeIOS: true });
    });

    it('navigates directly when no overlay is stacked above Main', () => {
      components.rootNavigationRef.current.getRootState.mockReturnValue({
        routes: [{ name: 'main' }],
        index: 0,
      });
      openWebView({ url: 'https://example.com' });
      expect(components.popToMainRoute).not.toHaveBeenCalled();
      expect(appGlobals.$rootAppNavigation.navigate).toHaveBeenCalledWith(
        ERootRoutes.WebView,
        expect.any(Object),
      );
    });

    it('dismisses stacked overlays via popToMainRoute, then navigates', async () => {
      components.rootNavigationRef.current.getRootState.mockReturnValue({
        routes: [{ name: 'main' }, { name: 'modal' }],
        index: 1,
      });
      openWebView({ url: 'https://example.com' });
      // popToMainRoute is invoked synchronously; the navigate is chained
      // onto its returned promise, so it runs on the next microtask.
      expect(components.popToMainRoute).toHaveBeenCalledTimes(1);
      expect(appGlobals.$rootAppNavigation.navigate).not.toHaveBeenCalled();
      // Flush the pending microtask so the .then(navigate) fires.
      await Promise.resolve();
      expect(appGlobals.$rootAppNavigation.navigate).toHaveBeenCalledWith(
        ERootRoutes.WebView,
        expect.any(Object),
      );
    });
  });
});
