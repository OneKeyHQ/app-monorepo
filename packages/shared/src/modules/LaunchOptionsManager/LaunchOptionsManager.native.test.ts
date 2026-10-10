import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import appGlobals from '../../appGlobals';
import { OneKeyLocalError } from '../../errors';
import { loggerRuntime } from '../../logger/runtime/loggerRuntime';
import { PageScene } from '../../logger/scopes/app/scenes/page';

import LaunchOptionsManager from './LaunchOptionsManager.native';

import type { Analytics } from '../../analytics';

const mockInMemoryStore = new Map<string, string>();
let mockIsMain = true;
let mockLoggerReady = true;

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    setInMemoryValueIfAbsent: (key: string, value: string) => {
      if (mockInMemoryStore.has(key)) {
        return false;
      }
      mockInMemoryStore.set(key, value);
      return true;
    },
    removeInMemoryValue: (key: string) => mockInMemoryStore.delete(key),
  },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    get isNativeMainThread() {
      return mockIsMain;
    },
  },
}));

jest.mock('../../logger/loggerConfig', () => ({
  loggerConfig: {
    get isReady() {
      return mockLoggerReady;
    },
    shouldLog: () => false,
  },
}));

describe('native process startup reporting', () => {
  let trackEvent: jest.Mock;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockInMemoryStore.clear();
    mockIsMain = true;
    mockLoggerReady = true;
    trackEvent = jest.fn();
    logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    appGlobals.$analytics = { trackEvent } as unknown as Analytics;
  });

  afterEach(() => {
    loggerRuntime.drain();
    appGlobals.$analytics = undefined;
    logError.mockRestore();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function reportBoth(scene = new PageScene()) {
    LaunchOptionsManager.reportStartupTiming('jsReadyTime', () => {
      scene.jsReadyTime(100);
    });
    LaunchOptionsManager.reportStartupTiming('uiVisibleTime', () => {
      scene.uiVisibleTime(200);
    });
  }

  it('enqueues each stage immediately once across UI remounts', () => {
    reportBoth();
    reportBoth(new PageScene());
    expect(trackEvent.mock.calls).toEqual([
      ['jsReadyTime', { duration: 100 }],
      ['uiVisibleTime', { duration: 200 }],
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retains the native flag when the JS module is reloaded', () => {
    const report = jest.fn();
    LaunchOptionsManager.reportStartupTiming('jsReadyTime', report);
    jest.isolateModules(() => {
      const reloaded = jest.requireActual<
        typeof import('./LaunchOptionsManager.native')
      >('./LaunchOptionsManager.native').default;
      reloaded.reportStartupTiming('jsReadyTime', report);
    });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('reports again with a fresh native process Map', () => {
    reportBoth();
    mockInMemoryStore.clear();
    reportBoth();
    expect(trackEvent).toHaveBeenCalledTimes(4);
  });

  it('never lets background claim the UI stages', () => {
    mockIsMain = false;
    reportBoth();
    expect(mockInMemoryStore.size).toBe(0);
    expect(trackEvent).not.toHaveBeenCalled();
    mockIsMain = true;
    reportBoth();
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('releases only the failed stage after a local enqueue failure', () => {
    trackEvent.mockImplementationOnce(() => {
      throw new OneKeyLocalError('enqueue failed');
    });
    reportBoth();
    expect(logError).toHaveBeenCalledWith(
      'Startup timing enqueue failed',
      'jsReadyTime',
      expect.objectContaining({ message: 'enqueue failed' }),
    );
    expect(mockInMemoryStore.has('analytics:startup:jsReadyTime')).toBe(false);
    expect(mockInMemoryStore.has('analytics:startup:uiVisibleTime')).toBe(true);
    reportBoth();
    expect(trackEvent.mock.calls).toEqual([
      ['jsReadyTime', { duration: 100 }],
      ['uiVisibleTime', { duration: 200 }],
      ['jsReadyTime', { duration: 100 }],
    ]);
    reportBoth();
    expect(trackEvent).toHaveBeenCalledTimes(3);
  });

  it('contains a failed native claim without releasing another runtime key', () => {
    mockInMemoryStore.set('analytics:startup:jsReadyTime', 'other-runtime');
    const claim = jest
      .spyOn(ReactNativeDeviceUtils, 'setInMemoryValueIfAbsent')
      .mockImplementationOnce(() => {
        throw new OneKeyLocalError('store capacity exceeded');
      });
    const release = jest.spyOn(ReactNativeDeviceUtils, 'removeInMemoryValue');
    expect(() => reportBoth()).not.toThrow();
    expect(release).not.toHaveBeenCalled();
    expect(mockInMemoryStore.get('analytics:startup:jsReadyTime')).toBe(
      'other-runtime',
    );
    expect(trackEvent.mock.calls).toEqual([
      ['uiVisibleTime', { duration: 200 }],
    ]);
    expect(claim).toHaveBeenCalledTimes(2);
    mockInMemoryStore.delete('analytics:startup:jsReadyTime');
    reportBoth();
    expect(trackEvent.mock.calls).toEqual([
      ['uiVisibleTime', { duration: 200 }],
      ['jsReadyTime', { duration: 100 }],
    ]);
  });

  it('contains a native release failure and continues the next stage', () => {
    trackEvent.mockImplementationOnce(() => {
      throw new OneKeyLocalError('enqueue failed');
    });
    jest
      .spyOn(ReactNativeDeviceUtils, 'removeInMemoryValue')
      .mockImplementationOnce(() => {
        throw new OneKeyLocalError('release failed');
      });
    expect(() => reportBoth()).not.toThrow();
    expect(logError).toHaveBeenCalledWith(
      'Startup timing release failed',
      'jsReadyTime',
      expect.objectContaining({ message: 'release failed' }),
    );
    expect(logError).toHaveBeenCalledWith(
      'Startup timing enqueue failed',
      'jsReadyTime',
      expect.objectContaining({ message: 'enqueue failed' }),
    );
    expect(trackEvent.mock.calls).toEqual([
      ['jsReadyTime', { duration: 100 }],
      ['uiVisibleTime', { duration: 200 }],
    ]);
  });

  it('releases the flag if analytics is unavailable before enqueue', () => {
    appGlobals.$analytics = undefined;
    reportBoth();
    expect(logError).toHaveBeenCalledTimes(2);
    expect(mockInMemoryStore.size).toBe(0);
    appGlobals.$analytics = { trackEvent } as unknown as Analytics;
    reportBoth();
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('commits after entry to the existing logger queue without waiting for network', () => {
    mockLoggerReady = false;
    reportBoth();
    reportBoth();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(mockInMemoryStore.size).toBe(2);
    mockLoggerReady = true;
    loggerRuntime.drain();
    expect(trackEvent).toHaveBeenCalledTimes(2);
    reportBoth();
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('does not suppress independent activity or version logs', () => {
    const scene = new PageScene();
    reportBoth(scene);
    for (let i = 0; i < 2; i += 1) {
      scene.appStart();
      scene.jsVersion({
        appVersion: 'test',
        buildNumber: 'test',
        bundleVersion: 'test',
        githubSHA: 'test',
      });
    }
    jest.runOnlyPendingTimers();
    expect(
      trackEvent.mock.calls.filter(([name]) => name === 'appStart'),
    ).toHaveLength(2);
    expect(
      trackEvent.mock.calls.filter(([name]) => name === 'jsVersion'),
    ).toHaveLength(0);
  });
});
