import { openURL } from 'expo-linking';
import { openBrowserAsync } from 'expo-web-browser';

import { OneKeyLocalError } from '../errors';

import {
  openUrlExternal,
  setForceSystemBrowserForDebug,
  setInAppBrowserLifecycleListener,
} from './openUrlUtils';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeIOS: true,
    isNativeAndroid: false,
    isNativeBackgroundThread: false,
    isDesktop: false,
    isDesktopMac: false,
    isExtension: false,
  },
}));

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openSettings: jest.fn().mockResolvedValue(undefined),
  openURL: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn().mockResolvedValue({ type: 'dismiss' }),
  WebBrowserPresentationStyle: { OVER_FULL_SCREEN: 'overFullScreen' },
}));

const mockOpenBrowserAsync = openBrowserAsync as jest.Mock;
const mockOpenURL = openURL as jest.Mock;

const flushPromises = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('in-app browser lifecycle listener', () => {
  let unregister: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    setForceSystemBrowserForDebug(false);
  });

  afterEach(() => {
    unregister?.();
    unregister = undefined;
  });

  test('wraps the whole presentation: open before, settle after dismissal', async () => {
    let resolveBrowser: (v: { type: string }) => void = () => {};
    mockOpenBrowserAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveBrowser = resolve;
      }),
    );
    const events: string[] = [];
    unregister = setInAppBrowserLifecycleListener(() => {
      events.push('open');
      return () => events.push('settled');
    });

    openUrlExternal('https://help.onekey.so/hc');
    expect(events).toEqual(['open']);
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['open']);

    resolveBrowser({ type: 'dismiss' });
    await flushPromises();
    expect(events).toEqual(['open', 'settled']);
  });

  test('settles when the browser fails to open and falls back', async () => {
    mockOpenBrowserAsync.mockRejectedValue(
      new OneKeyLocalError('no custom tabs'),
    );
    const settled = jest.fn();
    unregister = setInAppBrowserLifecycleListener(() => settled);

    openUrlExternal('https://help.onekey.so/hc');
    await flushPromises();
    await flushPromises();
    expect(settled).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith('https://help.onekey.so/hc');
  });

  test('a throwing listener never blocks opening the link', async () => {
    mockOpenBrowserAsync.mockResolvedValue({ type: 'dismiss' });
    unregister = setInAppBrowserLifecycleListener(() => {
      throw new OneKeyLocalError('listener failed');
    });

    openUrlExternal('https://help.onekey.so/hc');
    await flushPromises();
    await flushPromises();
    expect(mockOpenBrowserAsync).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  test('is not called for links handed to the system browser', async () => {
    const listener = jest.fn();
    unregister = setInAppBrowserLifecycleListener(listener);

    openUrlExternal('https://x.com/onekeyhq');
    await flushPromises();
    expect(listener).not.toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalled();
  });

  test('unregister only clears its own listener', async () => {
    mockOpenBrowserAsync.mockResolvedValue({ type: 'dismiss' });
    const first = jest.fn();
    const second = jest.fn();
    const unregisterFirst = setInAppBrowserLifecycleListener(first);
    unregister = setInAppBrowserLifecycleListener(second);
    unregisterFirst();

    openUrlExternal('https://help.onekey.so/hc');
    await flushPromises();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
