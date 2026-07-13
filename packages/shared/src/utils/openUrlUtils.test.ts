import { openURL } from 'expo-linking';
import { dismissBrowser, openBrowserAsync } from 'expo-web-browser';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  dismissNativeInAppBrowser,
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
}));

const mockEnv = platformEnv as unknown as {
  isNative: boolean;
  isNativeIOS: boolean;
  isNativeBackgroundThread: boolean;
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

  test('opens https URLs in the in-app browser, trimmed, with createTask:false', async () => {
    openUrlExternal('  https://help.onekey.so/hc  ');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'https://help.onekey.so/hc',
      { createTask: false },
    );
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  test('opens http URLs in the in-app browser', async () => {
    openUrlExternal('http://192.168.1.1/admin');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'http://192.168.1.1/admin',
      { createTask: false },
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
    'https://x.com/OneKeyHQ',
    'https://WWW.X.COM/OneKeyHQ',
    'https://t.me/OneKeyHQ',
    'https://discord.com/invite/onekey',
    'https://Discord.gg/onekey',
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

  test('a locked result (already presenting) does not trigger the fallback', async () => {
    mockOpenBrowserAsync.mockResolvedValueOnce({ type: 'locked' });
    openUrlExternal('https://onekey.so');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
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
