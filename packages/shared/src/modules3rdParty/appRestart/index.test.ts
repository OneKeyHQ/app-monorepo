import { appRestart } from '.';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import { EAppRestartMode } from './types';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: {
      page: {
        restartApp: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/modules/BootRecovery', () => ({
  __esModule: true,
  default: {
    markBootSuccess: jest.fn(),
  },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtensionBackground: false,
    isRuntimeBrowser: false,
  },
}));

const mockPlatformEnv = jest.requireMock('../../platformEnv').default as {
  isDesktop: boolean;
  isExtensionBackground: boolean;
  isRuntimeBrowser: boolean;
};

describe('appRestart teardown guards', () => {
  const originalChromeDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'chrome',
  );
  const originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApiProxy',
  );
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'location',
  );

  beforeEach(() => {
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isExtensionBackground = false;
    mockPlatformEnv.isRuntimeBrowser = false;
  });

  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    for (const [key, descriptor] of [
      ['chrome', originalChromeDescriptor],
      ['desktopApiProxy', originalDesktopApiProxyDescriptor],
      ['location', originalLocationDescriptor],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
    jest.restoreAllMocks();
  });

  it('keeps the background guarded after chrome schedules reload', async () => {
    mockPlatformEnv.isExtensionBackground = true;
    const reload = jest.fn();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { reload } },
      writable: true,
    });

    await appRestart({
      mode: EAppRestartMode.All,
      reason: 'test',
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(resetUtils.getIsResetting()).toBe(true);
  });

  it('releases its guard if chrome.reload throws synchronously', async () => {
    mockPlatformEnv.isExtensionBackground = true;
    const reload = jest.fn(() => {
      throw new OneKeyLocalError('reload failed');
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { reload } },
      writable: true,
    });

    await expect(
      appRestart({
        mode: EAppRestartMode.All,
        reason: 'test',
      }),
    ).rejects.toThrow('reload failed');
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('keeps the desktop guarded after its bridge schedules renderer reload', async () => {
    mockPlatformEnv.isDesktop = true;
    const reload = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { system: { reload } },
      writable: true,
    });

    await appRestart({
      mode: EAppRestartMode.All,
      reason: 'test',
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(resetUtils.getIsResetting()).toBe(true);
  });

  it.each([
    ['synchronous', () => new OneKeyLocalError('sync reload failed')],
    ['asynchronous', () => Promise.reject(new Error('async reload failed'))],
  ])(
    'releases its desktop guard when reload fails %sly',
    async (_failureType, buildFailure) => {
      mockPlatformEnv.isDesktop = true;
      const reload = jest.fn(() => {
        const failure = buildFailure();
        if (failure instanceof Error) {
          throw failure;
        }
        return failure;
      });
      Object.defineProperty(globalThis, 'desktopApiProxy', {
        configurable: true,
        value: { system: { reload } },
        writable: true,
      });

      await expect(
        appRestart({
          mode: EAppRestartMode.All,
          reason: 'test',
        }),
      ).rejects.toThrow(/reload failed/);
      expect(resetUtils.getIsResetting()).toBe(false);
    },
  );

  it('fails closed without leaking a desktop guard when reload is unavailable', async () => {
    mockPlatformEnv.isDesktop = true;
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { system: {} },
      writable: true,
    });

    await expect(
      appRestart({
        mode: EAppRestartMode.All,
        reason: 'test',
      }),
    ).rejects.toThrow('Desktop reload API is unavailable');
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('keeps the browser guarded after location.reload schedules teardown', async () => {
    mockPlatformEnv.isRuntimeBrowser = true;
    const reload = jest.fn();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { reload },
      writable: true,
    });

    await appRestart({
      mode: EAppRestartMode.All,
      reason: 'test',
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(resetUtils.getIsResetting()).toBe(true);
  });

  it('releases its browser guard when location.reload throws', async () => {
    mockPlatformEnv.isRuntimeBrowser = true;
    const reload = jest.fn(() => {
      throw new OneKeyLocalError('browser reload failed');
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { reload },
      writable: true,
    });

    await expect(
      appRestart({
        mode: EAppRestartMode.All,
        reason: 'test',
      }),
    ).rejects.toThrow('browser reload failed');
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('fails closed without leaking a browser guard when reload is unavailable', async () => {
    mockPlatformEnv.isRuntimeBrowser = true;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {},
      writable: true,
    });

    await expect(
      appRestart({
        mode: EAppRestartMode.All,
        reason: 'test',
      }),
    ).rejects.toThrow('Browser reload API is unavailable');
    expect(resetUtils.getIsResetting()).toBe(false);
  });
});
