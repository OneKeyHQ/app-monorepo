import type { Analytics } from '@onekeyhq/shared/src/analytics';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ipcMessageKeys } from '../config';

let mockLoggerReady = true;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true, isNative: false },
}));

jest.mock('@onekeyhq/shared/src/logger/loggerConfig', () => ({
  loggerConfig: {
    get isReady() {
      return mockLoggerReady;
    },
    shouldLog: () => false,
  },
}));

const mockListeners = new Map<
  string,
  (event: { returnValue: unknown }, stage: unknown) => void
>();

jest.mock('electron', () => ({
  ipcMain: {
    removeAllListeners: (channel: string) => mockListeners.delete(channel),
    on: (
      channel: string,
      listener: (event: { returnValue: unknown }, stage: unknown) => void,
    ) => mockListeners.set(channel, listener),
  },
}));

jest.mock('electron-log/main', () => ({
  transports: { file: { getFile: () => ({ path: '/tmp/onekey.log' }) } },
}));

jest.mock('./desktopPlatformInfo', () => ({
  getDesktopPlatformInfo: () => ({}),
}));

function send(channel: string, stage: unknown): unknown {
  const event = { returnValue: undefined as unknown };
  const listener = mockListeners.get(channel);
  if (!listener) throw new OneKeyLocalError(`Missing IPC handler: ${channel}`);
  listener(event, stage);
  return event.returnValue;
}

function loadRenderer() {
  return jest.requireActual<
    typeof import('../../../../packages/shared/src/modules/LaunchOptionsManager/LaunchOptionsManager.desktop')
  >(
    '../../../../packages/shared/src/modules/LaunchOptionsManager/LaunchOptionsManager.desktop',
  ).default;
}

function loadPageLogger() {
  const appGlobals = jest.requireActual<
    typeof import('@onekeyhq/shared/src/appGlobals')
  >('@onekeyhq/shared/src/appGlobals').default;
  const { PageScene } = jest.requireActual<
    typeof import('@onekeyhq/shared/src/logger/scopes/app/scenes/page')
  >('@onekeyhq/shared/src/logger/scopes/app/scenes/page');
  const { loggerRuntime } = jest.requireActual<
    typeof import('@onekeyhq/shared/src/logger/runtime/loggerRuntime')
  >('@onekeyhq/shared/src/logger/runtime/loggerRuntime');
  const trackEvent = jest.fn();
  appGlobals.$analytics = { trackEvent } as unknown as Analytics;
  return { appGlobals, scene: new PageScene(), loggerRuntime, trackEvent };
}

describe('desktop process startup timing claims', () => {
  const originalDesktopApi = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApi',
  );
  let register: typeof import('./registerInfoHandlers').registerInfoHandlers;
  let release: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    mockLoggerReady = true;
    mockListeners.clear();
    register = jest.requireActual<typeof import('./registerInfoHandlers')>(
      './registerInfoHandlers',
    ).registerInfoHandlers;
    register(true, () => true);
    release = jest.fn((stage: string) =>
      send(ipcMessageKeys.RELEASE_STARTUP_TIMING, stage),
    );
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: {
        claimStartupTiming: (stage: string) =>
          send(ipcMessageKeys.CLAIM_STARTUP_TIMING, stage),
        releaseStartupTiming: release,
      },
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.requireActual<typeof import('@onekeyhq/shared/src/appGlobals')>(
      '@onekeyhq/shared/src/appGlobals',
    ).default.$analytics = undefined;
    jest.clearAllTimers();
    jest.useRealTimers();
    if (originalDesktopApi) {
      Object.defineProperty(globalThis, 'desktopApi', originalDesktopApi);
    } else {
      Reflect.deleteProperty(globalThis, 'desktopApi');
    }
    jest.restoreAllMocks();
  });

  it('reports each stage once across renderer module reloads and IPC re-registration', () => {
    const report = jest.fn();
    loadRenderer().reportStartupTiming('jsReadyTime', report);
    loadRenderer().reportStartupTiming('uiVisibleTime', report);
    jest.resetModules();
    register(true, () => true);
    loadRenderer().reportStartupTiming('jsReadyTime', report);
    loadRenderer().reportStartupTiming('uiVisibleTime', report);
    expect(report).toHaveBeenCalledTimes(2);
    expect(release).not.toHaveBeenCalled();
  });

  it('releases only a stage whose synchronous handoff failed so it can retry', () => {
    const manager = loadRenderer();
    const report = jest.fn();
    manager.reportStartupTiming('uiVisibleTime', report);
    manager.reportStartupTiming('jsReadyTime', () => {
      throw new OneKeyLocalError('enqueue failed');
    });
    manager.reportStartupTiming('jsReadyTime', report);
    manager.reportStartupTiming('uiVisibleTime', report);
    expect(report).toHaveBeenCalledTimes(2);
    expect(release.mock.calls).toEqual([['jsReadyTime']]);
  });

  it('does not release another renderer claim when claim IPC fails', () => {
    send(ipcMessageKeys.CLAIM_STARTUP_TIMING, 'jsReadyTime');
    Object.defineProperty(globalThis.desktopApi, 'claimStartupTiming', {
      value: () => {
        throw new OneKeyLocalError('IPC unavailable');
      },
    });
    const report = jest.fn();
    expect(() =>
      loadRenderer().reportStartupTiming('jsReadyTime', report),
    ).not.toThrow();
    expect(report).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(send(ipcMessageKeys.CLAIM_STARTUP_TIMING, 'jsReadyTime')).toBe(
      false,
    );
  });

  it('contains release IPC failures without interrupting other startup stages', () => {
    release.mockImplementation(() => {
      throw new OneKeyLocalError('release unavailable');
    });
    const manager = loadRenderer();
    expect(() =>
      manager.reportStartupTiming('jsReadyTime', () => {
        throw new OneKeyLocalError('enqueue failed');
      }),
    ).not.toThrow();
    const report = jest.fn();
    manager.reportStartupTiming('uiVisibleTime', report);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'hands off real timing logs before reload when logger ready is %p',
    (ready) => {
      mockLoggerReady = ready;
      const { scene, loggerRuntime, trackEvent } = loadPageLogger();
      const handoff = jest.spyOn(loggerRuntime, 'enqueueOrProcess');
      const manager = loadRenderer();
      manager.reportStartupTiming('jsReadyTime', () => scene.jsReadyTime(100));
      manager.reportStartupTiming('uiVisibleTime', () =>
        scene.uiVisibleTime(200),
      );
      expect(handoff).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
      if (!ready) {
        expect(trackEvent).not.toHaveBeenCalled();
        mockLoggerReady = true;
        loggerRuntime.drain();
      }
      expect(trackEvent.mock.calls).toEqual([
        ['jsReadyTime', { duration: 100 }],
        ['uiVisibleTime', { duration: 200 }],
      ]);

      jest.clearAllTimers();
      jest.resetModules();
      register(true, () => true);
      const reloaded = loadPageLogger();
      const nextManager = loadRenderer();
      nextManager.reportStartupTiming('jsReadyTime', () =>
        reloaded.scene.jsReadyTime(300),
      );
      nextManager.reportStartupTiming('uiVisibleTime', () =>
        reloaded.scene.uiVisibleTime(400),
      );
      expect(reloaded.trackEvent).not.toHaveBeenCalled();
      expect(release).not.toHaveBeenCalled();
    },
  );

  it('releases only the real timing log whose synchronous analytics handoff fails', () => {
    const { scene, trackEvent } = loadPageLogger();
    const manager = loadRenderer();
    manager.reportStartupTiming('uiVisibleTime', () =>
      scene.uiVisibleTime(200),
    );
    trackEvent.mockImplementationOnce(() => {
      throw new OneKeyLocalError('enqueue failed');
    });
    manager.reportStartupTiming('jsReadyTime', () => scene.jsReadyTime(100));
    expect(release.mock.calls).toEqual([['jsReadyTime']]);
    manager.reportStartupTiming('jsReadyTime', () => scene.jsReadyTime(101));
    manager.reportStartupTiming('uiVisibleTime', () =>
      scene.uiVisibleTime(201),
    );
    expect(trackEvent.mock.calls).toEqual([
      ['uiVisibleTime', { duration: 200 }],
      ['jsReadyTime', { duration: 100 }],
      ['jsReadyTime', { duration: 101 }],
    ]);
  });

  it('releases real timing claims when analytics is unavailable so they can retry', () => {
    const { appGlobals, scene, trackEvent } = loadPageLogger();
    const manager = loadRenderer();
    appGlobals.$analytics = undefined;
    manager.reportStartupTiming('jsReadyTime', () => scene.jsReadyTime(100));
    manager.reportStartupTiming('uiVisibleTime', () =>
      scene.uiVisibleTime(200),
    );
    expect(release.mock.calls).toEqual([['jsReadyTime'], ['uiVisibleTime']]);
    appGlobals.$analytics = { trackEvent } as unknown as Analytics;
    manager.reportStartupTiming('jsReadyTime', () => scene.jsReadyTime(100));
    manager.reportStartupTiming('uiVisibleTime', () =>
      scene.uiVisibleTime(200),
    );
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('keeps ordinary desktop activity logs deferred and repeatable', () => {
    const { scene, trackEvent } = loadPageLogger();
    scene.appStart();
    scene.appStart();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(2);
    jest.runOnlyPendingTimers();
    expect(trackEvent.mock.calls).toEqual([
      ['appStart', {}],
      ['appStart', {}],
    ]);
  });

  it.each([undefined, null, '', 'appStart', {}, []])(
    'rejects invalid IPC stages: %p',
    (stage) => {
      expect(send(ipcMessageKeys.CLAIM_STARTUP_TIMING, stage)).toBe(false);
      expect(send(ipcMessageKeys.RELEASE_STARTUP_TIMING, stage)).toBe(false);
      expect(send(ipcMessageKeys.CLAIM_STARTUP_TIMING, 'jsReadyTime')).toBe(
        true,
      );
    },
  );
});
