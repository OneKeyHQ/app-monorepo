/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, import/first */

jest.mock('../background/instance/backgroundApiProxy', () => {
  const svc = {
    processPendingInstallTask: jest.fn(),
  };
  (globalThis as any).__mockSvc = svc;
  return { __esModule: true, default: { servicePendingInstallTask: svc } };
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

(globalThis as any).__sharedReact = React;

const g = globalThis as any;

let svc: any;

function freshSplash() {
  let mod: typeof import('./SplashProvider') = undefined as any;
  jest.isolateModules(() => {
    jest.mock('react', () => (globalThis as any).__sharedReact);
    mod = require('./SplashProvider');
  });
  svc = g.__mockSvc;
  svc.processPendingInstallTask.mockResolvedValue(undefined);
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
  platformEnvMock.version = '1.0.0';
  platformEnvMock.bundleVersion = '1';
  platformEnvMock.isWeb = false;
  platformEnvMock.isDesktop = true;
  platformEnvMock.isNative = false;
});

describe('useDisplaySplash', () => {
  test('runs pending task processing once on launch and then shows splash', async () => {
    const { useDisplaySplash } = freshSplash();
    const { result } = renderHook(() => useDisplaySplash());
    expect(result.current).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  test('re-render does not re-run launch callback', async () => {
    const { useDisplaySplash } = freshSplash();
    const { rerender } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    rerender();
    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
  });

  test('errors during pending task processing still show splash', async () => {
    const { useDisplaySplash } = freshSplash();
    svc.processPendingInstallTask.mockRejectedValue(new Error('bg failed'));
    const { result } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  test('safety timer shows splash when launch callback hangs', async () => {
    jest.useFakeTimers();
    const { useDisplaySplash } = freshSplash();
    svc.processPendingInstallTask.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDisplaySplash());
    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current).toBe(true);
    jest.useRealTimers();
  });

  test('non-desktop and non-native returns true without background calls', () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.isDesktop = false;
    platformEnvMock.isNative = false;
    platformEnvMock.isWeb = false;

    const mod = freshSplash();
    const { result } = renderHook(() => mod.useDisplaySplash());

    expect(result.current).toBe(true);
    expect(svc.processPendingInstallTask).not.toHaveBeenCalled();
  });

  test('isNative: true, isDesktop: false calls processPendingInstallTask', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.isDesktop = false;
    platformEnvMock.isNative = true;
    platformEnvMock.isWeb = false;

    const { useDisplaySplash } = freshSplash();
    const { result } = renderHook(() => useDisplaySplash());
    expect(result.current).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  test('isNative: true + error during pending task still shows splash', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.isDesktop = false;
    platformEnvMock.isNative = true;
    platformEnvMock.isWeb = false;

    const { useDisplaySplash } = freshSplash();
    svc.processPendingInstallTask.mockRejectedValue(
      new Error('native bg failed'),
    );
    const { result } = renderHook(() => useDisplaySplash());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });
});
