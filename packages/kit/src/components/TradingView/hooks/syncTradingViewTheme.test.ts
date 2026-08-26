import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { syncTradingViewTheme } from './syncTradingViewTheme';

import type { IWebViewRef } from '../../WebView/types';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: false,
  },
}));

const mockPlatformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv')
  .default as {
  isDesktop: boolean;
  isNative: boolean;
};

function createWebViewRef(innerRef: object): IWebViewRef {
  return { innerRef } as unknown as IWebViewRef;
}

describe('syncTradingViewTheme', () => {
  beforeEach(() => {
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isNative = false;
  });

  it('injects the latest theme into a native WebView', () => {
    const injectJavaScript = jest.fn();

    mockPlatformEnv.isNative = true;
    syncTradingViewTheme(createWebViewRef({ injectJavaScript }), 'dark');

    expect(injectJavaScript).toHaveBeenCalledTimes(1);
    const script = injectJavaScript.mock.calls[0][0] as string;
    expect(script).toContain('window.__onekeyTradingViewTheme = "dark"');
    expect(script).toContain('changeTheme.call');
    expect(script).toContain('doWhenApiIsReady.call');
  });

  it('executes the theme script in a desktop WebView', () => {
    const executeJavaScript = jest.fn();

    mockPlatformEnv.isDesktop = true;
    syncTradingViewTheme(createWebViewRef({ executeJavaScript }), 'light');

    expect(executeJavaScript).toHaveBeenCalledTimes(1);
    expect(executeJavaScript.mock.calls[0][0]).toContain(
      'window.__onekeyTradingViewTheme = "light"',
    );
  });

  it('does not inject a script on web', () => {
    const injectJavaScript = jest.fn();
    const executeJavaScript = jest.fn();

    syncTradingViewTheme(
      createWebViewRef({ injectJavaScript, executeJavaScript }),
      'dark',
    );

    expect(injectJavaScript).not.toHaveBeenCalled();
    expect(executeJavaScript).not.toHaveBeenCalled();
  });

  it('tolerates a WebView that is not ready yet', () => {
    mockPlatformEnv.isDesktop = true;
    const executeJavaScript = jest.fn(() => {
      throw new OneKeyLocalError('not ready');
    });

    expect(() =>
      syncTradingViewTheme(createWebViewRef({ executeJavaScript }), 'dark'),
    ).not.toThrow();
    expect(() => syncTradingViewTheme(null, 'dark')).not.toThrow();
  });
});
