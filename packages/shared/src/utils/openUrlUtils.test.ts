import { openURL } from 'expo-linking';
import { dismissBrowser, openBrowserAsync } from 'expo-web-browser';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  dismissNativeInAppBrowser,
  getOneKeyStoreHandoffUrl,
  handleOneKeyStoreLink,
  openUrlExternal,
  setForceSystemBrowserForDebug,
} from './openUrlUtils';

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const env = {
    isNative: true,
    isNativeIOS: false,
    isNativeAndroid: false,
    isNativeBackgroundThread: false,
    isDesktop: false,
    isDesktopMac: false,
    isExtension: false,
  };
  return { __esModule: true, default: env };
});

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openSettings: jest.fn().mockResolvedValue(undefined),
  openURL: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }),
  dismissBrowser: jest.fn().mockResolvedValue({ type: 'dismiss' }),
  WebBrowserPresentationStyle: { OVER_FULL_SCREEN: 'overFullScreen' },
}));

const IN_APP_BROWSER_OPTIONS = {
  createTask: false,
  presentationStyle: 'overFullScreen',
  dismissButtonStyle: 'close',
  enableBarCollapsing: true,
};

const mockEnv = platformEnv as unknown as {
  isNative: boolean;
  isNativeIOS: boolean;
  isNativeBackgroundThread: boolean;
  isDesktopMac: boolean;
};
const mockOpenURL = openURL as jest.Mock;
const mockOpenBrowserAsync = openBrowserAsync as jest.Mock;
const mockDismissBrowser = dismissBrowser as jest.Mock;

// The in-app browser call is fire-and-forget behind a dynamic import
// (compiled to a promise-wrapped require by swc), so drain the microtask
// queue before asserting.
const flushPromises = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('openUrlExternal (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.isNative = true;
    mockEnv.isNativeIOS = true;
    mockEnv.isNativeBackgroundThread = false;
    setForceSystemBrowserForDebug(false);
  });

  test('opens https URLs in the in-app browser, trimmed, full screen', async () => {
    openUrlExternal('  https://help.onekey.so/hc  ');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'https://help.onekey.so/hc',
      IN_APP_BROWSER_OPTIONS,
    );
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  test('opens http URLs in the in-app browser', async () => {
    openUrlExternal('http://192.168.1.1/admin');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'http://192.168.1.1/admin',
      IN_APP_BROWSER_OPTIONS,
    );
  });

  test('hands non-http schemes to the OS', async () => {
    openUrlExternal('wc:abc123@2?relay-protocol=irn');
    openUrlExternal('mailto:hi@onekey.so');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledTimes(2);
    expect(mockOpenURL).toHaveBeenCalledWith('wc:abc123@2?relay-protocol=irn');
    expect(mockOpenURL).toHaveBeenCalledWith('mailto:hi@onekey.so');
  });

  test('hands unparseable URLs to the OS', async () => {
    openUrlExternal('not a url at all');
    await flushPromises();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith('not a url at all');
  });

  test('useSystemBrowser opt-out skips the in-app browser', async () => {
    openUrlExternal('https://accounts.google.com/o/oauth2/auth', {
      useSystemBrowser: true,
    });
    await flushPromises();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/auth',
    );
  });

  test('debug flag forces the system browser', async () => {
    setForceSystemBrowserForDebug(true);
    openUrlExternal('https://onekey.so');
    await flushPromises();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith('https://onekey.so');
  });

  test('background JS runtime falls back to the system browser', async () => {
    mockEnv.isNativeBackgroundThread = true;
    openUrlExternal('https://onekey.so');
    await flushPromises();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith('https://onekey.so');
  });

  test.each([
    'https://apps.apple.com/app/id1609559473',
    'https://itunes.apple.com/app/id1609559473',
    'https://testflight.apple.com/join/abc',
    'https://play.google.com/store/apps/details?id=so.onekey.app.wallet',
    'https://www.play.google.com/store/apps/details?id=so.onekey.app.wallet',
    'https://twitter.com/OneKeyHQ',
    'https://mobile.twitter.com/OneKeyHQ',
    'https://x.com/OneKeyHQ',
    'https://WWW.X.COM/OneKeyHQ',
    'https://t.me/OneKeyHQ',
    'https://telegram.me/OneKeyHQ',
    'https://discord.com/invite/onekey',
    'https://discordapp.com/invite/onekey',
    'https://Discord.gg/onekey',
    'https://firmware.onekey.so/',
  ])('store/social host goes to the OS: %s', async (url) => {
    openUrlExternal(url);
    await flushPromises();
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith(url);
  });

  test('falls back to the system browser when the in-app browser rejects', async () => {
    mockOpenBrowserAsync.mockRejectedValueOnce(
      new Error('No matching browser activity'),
    );
    openUrlExternal('https://onekey.so');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith('https://onekey.so');
  });

  test('a successful in-app open reports a single inApp event', async () => {
    const openExternalUrlLog = jest.fn();
    appGlobals.$defaultLogger = {
      app: { page: { openExternalUrl: openExternalUrlLog } },
    } as unknown as typeof appGlobals.$defaultLogger;
    try {
      openUrlExternal('https://onekey.so');
      await flushPromises();
      await flushPromises();
      expect(openExternalUrlLog).toHaveBeenCalledTimes(1);
      expect(openExternalUrlLog).toHaveBeenCalledWith({
        host: 'onekey.so',
        method: 'inApp',
      });
    } finally {
      appGlobals.$defaultLogger = undefined;
    }
  });

  test('a failed in-app attempt reports only the system fallback', async () => {
    const openExternalUrlLog = jest.fn();
    appGlobals.$defaultLogger = {
      app: { page: { openExternalUrl: openExternalUrlLog } },
    } as unknown as typeof appGlobals.$defaultLogger;
    try {
      mockOpenBrowserAsync.mockRejectedValueOnce(
        new Error('No matching browser activity'),
      );
      openUrlExternal('https://onekey.so');
      await flushPromises();
      await flushPromises();
      expect(openExternalUrlLog).toHaveBeenCalledTimes(1);
      expect(openExternalUrlLog).toHaveBeenCalledWith({
        host: 'onekey.so',
        method: 'system',
      });
    } finally {
      appGlobals.$defaultLogger = undefined;
    }
  });

  test('a locked result (already presenting) triggers no fallback and no event', async () => {
    const openExternalUrlLog = jest.fn();
    appGlobals.$defaultLogger = {
      app: { page: { openExternalUrl: openExternalUrlLog } },
    } as unknown as typeof appGlobals.$defaultLogger;
    try {
      mockOpenBrowserAsync.mockResolvedValueOnce({ type: 'locked' });
      openUrlExternal('https://onekey.so');
      await flushPromises();
      await flushPromises();
      expect(mockOpenBrowserAsync).toHaveBeenCalledTimes(1);
      expect(mockOpenURL).not.toHaveBeenCalled();
      expect(openExternalUrlLog).not.toHaveBeenCalled();
    } finally {
      appGlobals.$defaultLogger = undefined;
    }
  });
});

describe('OneKey store deep links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.isNative = true;
    mockEnv.isNativeIOS = false;
    mockEnv.isNativeBackgroundThread = false;
    mockEnv.isDesktopMac = false;
    setForceSystemBrowserForDebug(false);
  });

  const appleLinks = [
    // onekey.so Mac App Store button (OK-64036)
    'macappstore://itunes.apple.com/app/id1609559473?mt=12',
    // App Store web page redirect in the iOS DApp browser (OK-63168)
    'itms-appss://apps.apple.com/us/app/onekey-open-source-wallet/id1609559473',
    'itms-apps://apps.apple.com/app/id1609559473',
    'ITMS-APPS://APPS.APPLE.COM/cn/app/onekey/id1609559473?pt=1&ct=2',
  ];

  test.each(appleLinks)('maps %s to the Mac App Store on macOS', (url) => {
    mockEnv.isNative = false;
    mockEnv.isDesktopMac = true;
    expect(getOneKeyStoreHandoffUrl(url)).toBe(
      'macappstore://itunes.apple.com/app/id1609559473?mt=12',
    );
  });

  test.each(appleLinks)('maps %s to the App Store app on iOS', (url) => {
    mockEnv.isNativeIOS = true;
    expect(getOneKeyStoreHandoffUrl(url)).toBe(
      'itms-apps://apps.apple.com/app/id1609559473',
    );
  });

  test.each(appleLinks)(
    'maps %s to the App Store web page elsewhere',
    (url) => {
      expect(getOneKeyStoreHandoffUrl(url)).toBe(
        'https://apps.apple.com/app/id1609559473',
      );
    },
  );

  test.each([
    'market://details?id=so.onekey.app.wallet',
    'market://details?id=so.onekey.app.wallet&referrer=utm_source%3Donekey.so',
    'market://details?referrer=x&id=so.onekey.app.wallet',
  ])('maps %s to the Play Store listing', (url) => {
    expect(getOneKeyStoreHandoffUrl(url)).toBe(
      'https://play.google.com/store/apps/details?id=so.onekey.app.wallet',
    );
  });

  test.each([
    'itms-apps://apps.apple.com/app/id1234567890',
    'itms-apps://apps.apple.com/app/id16095594730',
    'itms-apps://apps.apple.com/app/id1609559473abc',
    'itms-apps://apps.apple.com.example.com/app/id1609559473',
    'itms-apps://example.com@apps.apple.com/app/id1609559473',
    'itms-apps://apps.apple.com/app/other?next=/id1609559473',
    'https://apps.apple.com/app/id1609559473',
    'macappstores://apps.apple.com/account/subscriptions',
    'market://details?id=com.example.wallet',
    'market://details?id=so.onekey.app.wallet.fake',
    'market://details?xid=so.onekey.app.wallet',
    'x-safari-https://redirect.x.com/OneKeyHQ',
    'http://onekey.so',
  ])('leaves %s to the existing policy', (url) => {
    expect(getOneKeyStoreHandoffUrl(url)).toBeUndefined();
  });

  test('opens the canonical link, not the page-supplied one', () => {
    mockEnv.isNativeIOS = true;
    expect(
      handleOneKeyStoreLink(
        'itms-appss://apps.apple.com/us/app/onekey-open-source-wallet/id1609559473?ct=other',
      ),
    ).toBe(true);
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(
      'itms-apps://apps.apple.com/app/id1609559473',
    );
  });

  test('drops the link from an embedded frame without opening the store', () => {
    mockEnv.isNativeIOS = true;
    expect(
      handleOneKeyStoreLink('itms-apps://apps.apple.com/app/id1609559473', {
        isTopFrame: false,
      }),
    ).toBe(true);
    expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  test.each([true, false])(
    'leaves other links to the block page (isTopFrame: %s)',
    (isTopFrame) => {
      expect(
        handleOneKeyStoreLink('itms-apps://apps.apple.com/app/id1234567890', {
          isTopFrame,
        }),
      ).toBe(false);
      expect(mockOpenURL).not.toHaveBeenCalled();
    },
  );
});

describe('dismissNativeInAppBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.isNative = true;
    mockEnv.isNativeBackgroundThread = false;
  });

  test('dismisses the browser on iOS', async () => {
    mockEnv.isNativeIOS = true;
    dismissNativeInAppBrowser();
    await flushPromises();
    expect(mockDismissBrowser).toHaveBeenCalledTimes(1);
  });

  test('is a no-op off iOS', async () => {
    mockEnv.isNativeIOS = false;
    dismissNativeInAppBrowser();
    await flushPromises();
    expect(mockDismissBrowser).not.toHaveBeenCalled();
  });

  test('swallows dismiss errors (nothing to dismiss)', async () => {
    mockEnv.isNativeIOS = true;
    mockDismissBrowser.mockRejectedValueOnce(new Error('No browser open'));
    expect(() => dismissNativeInAppBrowser()).not.toThrow();
    await flushPromises();
    await flushPromises();
    expect(mockDismissBrowser).toHaveBeenCalledTimes(1);
  });
});
