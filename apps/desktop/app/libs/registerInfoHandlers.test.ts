import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ipcMessageKeys } from '../config';

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

describe('desktop process startup timing claims', () => {
  const originalDesktopApi = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApi',
  );
  let register: typeof import('./registerInfoHandlers').registerInfoHandlers;
  let release: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
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
