/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, import/first */

jest.mock('../background/instance/backgroundApiProxy', () => {
  const svc = {
    getUpdateInfo: jest.fn(),
    refreshUpdateStatus: jest.fn(),
    processPendingInstallTask: jest.fn(),
  };
  (globalThis as any).__mockSvc = svc;
  return { __esModule: true, default: { serviceAppUpdate: svc } };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const env = {
    version: '1.0.0',
    bundleVersion: '1',
    isDesktop: true,
    isNative: false,
    isWeb: false,
  };
  (globalThis as any).__mockPlatformEnv = env;
  return { __esModule: true, default: env };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      appUpdate: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/performance/init', () => ({
  debugLandingLog: jest.fn(),
}));

jest.mock('@onekeyhq/components', () => ({
  Splash: ({ children }: any) => children,
}));

import * as React from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';

(globalThis as any).__sharedReact = React;

const g = globalThis as any;
const mockPlatformEnv = g.__mockPlatformEnv;

let svc: any;

function makeAppInfo(overrides: Record<string, any> = {}) {
  return {
    status: EAppUpdateStatus.done,
    updateStrategy: EUpdateStrategy.manual,
    latestVersion: '1.0.0',
    ...overrides,
  };
}

function freshSplash() {
  let mod: typeof import('./SplashProvider') = undefined as any;
  jest.isolateModules(() => {
    jest.mock('react', () => (globalThis as any).__sharedReact);
    mod = require('./SplashProvider');
  });
  svc = g.__mockSvc;
  svc.getUpdateInfo.mockResolvedValue(makeAppInfo());
  svc.refreshUpdateStatus.mockResolvedValue(undefined);
  svc.processPendingInstallTask.mockResolvedValue(undefined);
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformEnv.isDesktop = true;
  mockPlatformEnv.isNative = false;
  mockPlatformEnv.isWeb = false;
});

describe('useDisplaySplash', () => {
  test('manual strategy shows splash and runs pending task processing', async () => {
    const { useDisplaySplash } = freshSplash();
    svc.getUpdateInfo.mockResolvedValue(
      makeAppInfo({ updateStrategy: EUpdateStrategy.manual }),
    );

    const { result } = renderHook(() => useDisplaySplash());
    expect(result.current).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  test('seamless + first launch after update refreshes status', async () => {
    const { useDisplaySplash } = freshSplash();
    svc.getUpdateInfo.mockResolvedValue(
      makeAppInfo({
        updateStrategy: EUpdateStrategy.seamless,
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0',
      }),
    );

    const { result } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.refreshUpdateStatus).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  test('seamless + ready only shows splash without direct install', async () => {
    const { useDisplaySplash } = freshSplash();
    svc.getUpdateInfo.mockResolvedValue(
      makeAppInfo({
        updateStrategy: EUpdateStrategy.seamless,
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
      }),
    );

    const { result } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.refreshUpdateStatus).not.toHaveBeenCalled();
    expect(result.current).toBe(true);
  });

  test('re-render does not re-run launch flow', async () => {
    const { useDisplaySplash } = freshSplash();
    const { rerender } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    rerender();
    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.getUpdateInfo).toHaveBeenCalledTimes(1);
    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
  });

  test('non-desktop and non-native returns true without background calls', () => {
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isNative = false;

    const mod = freshSplash();
    const { result } = renderHook(() => mod.useDisplaySplash());

    expect(result.current).toBe(true);
    expect(svc.getUpdateInfo).not.toHaveBeenCalled();
  });

  test('getUpdateInfo throws still shows splash', async () => {
    const { useDisplaySplash } = freshSplash();
    svc.getUpdateInfo.mockRejectedValue(new Error('bg failed'));

    const { result } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  test('safety timer shows splash when launch callback hangs', async () => {
    jest.useFakeTimers();
    const { useDisplaySplash } = freshSplash();
    svc.getUpdateInfo.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDisplaySplash());
    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current).toBe(true);
    jest.useRealTimers();
  });

  test('unmount clears safety timer', async () => {
    jest.useFakeTimers();
    const { useDisplaySplash } = freshSplash();
    svc.getUpdateInfo.mockReturnValue(new Promise(() => {}));

    const { result, unmount } = renderHook(() => useDisplaySplash());
    expect(result.current).toBe(false);

    unmount();

    await jest.advanceTimersByTimeAsync(15_000);

    expect(result.current).toBe(false);
    jest.useRealTimers();
  });
});
