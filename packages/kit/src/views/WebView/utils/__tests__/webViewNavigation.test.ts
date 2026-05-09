import { ERootRoutes, EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { openWebView } from '../webViewNavigation';

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: { $rootAppNavigation: { navigate: jest.fn() } },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const appGlobals = require('@onekeyhq/shared/src/appGlobals').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const platformEnv = require('@onekeyhq/shared/src/platformEnv').default;

// Avoid the literal `javascript:` URL form to satisfy `no-script-url`.
const JS_SCHEME_URL = ['java', 'script:', 'alert(1)'].join('');

describe('openWebView', () => {
  const originalOpen = (globalThis as { open?: unknown }).open;

  beforeEach(() => {
    Object.assign(platformEnv, { isWeb: false, isExtension: false });
    (globalThis as { open?: unknown }).open = jest.fn(() => null);
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
});
