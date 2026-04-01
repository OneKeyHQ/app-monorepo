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

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const EAppEventBusNames = {
    PendingInstallTaskProcessFinished: 'PendingInstallTaskProcessFinished',
  };
  type IMockAppEventBus = {
    on: jest.Mock<IMockAppEventBus, [string, (payload: unknown) => void]>;
    off: jest.Mock<IMockAppEventBus, [string, (payload: unknown) => void]>;
    emit: jest.Mock<boolean, [string, unknown]>;
  };
  const appEventBus = {} as IMockAppEventBus;
  appEventBus.on = jest.fn(
    (eventName: string, listener: (payload: unknown) => void) => {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      listeners.get(eventName)?.add(listener);
      return appEventBus;
    },
  );
  appEventBus.off = jest.fn(
    (eventName: string, listener: (payload: unknown) => void) => {
      listeners.get(eventName)?.delete(listener);
      return appEventBus;
    },
  );
  appEventBus.emit = jest.fn((eventName: string, payload: unknown) => {
    listeners.get(eventName)?.forEach((listener) => {
      listener(payload);
    });
    return true;
  });

  (globalThis as any).__mockAppEventBus = appEventBus;
  (globalThis as any).__mockAppEventBusNames = EAppEventBusNames;
  (globalThis as any).__resetMockAppEventBus = () => {
    listeners.clear();
  };

  return { __esModule: true, appEventBus, EAppEventBusNames };
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

jest.mock(
  '@onekeyhq/components',
  () => ({
    Splash: ({ children, canDismissSplash }: any) => {
      (globalThis as any).__lastCanDismissSplash = canDismissSplash;
      return require('react').createElement(
        'div',
        { 'data-testid': 'mock-splash' },
        children,
      );
    },
  }),
  { virtual: true },
);

import * as React from 'react';

import { act, render, renderHook, screen } from '@testing-library/react';

(globalThis as any).__sharedReact = React;

const g = globalThis as any;

let svc: any;

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

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
  g.__resetMockAppEventBus?.();
  g.__lastCanDismissSplash = undefined;
  const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
  platformEnvMock.version = '1.0.0';
  platformEnvMock.bundleVersion = '1';
  platformEnvMock.isWeb = false;
  platformEnvMock.isDesktop = true;
  platformEnvMock.isNative = false;
});

describe('useCanDismissSplash', () => {
  test('runs pending task processing once and waits for the finish event', async () => {
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);

    act(() => {
      g.__mockAppEventBus.emit(
        g.__mockAppEventBusNames.PendingInstallTaskProcessFinished,
        undefined,
      );
    });

    await flushMicrotasks();

    expect(result.current).toBe(true);
  });

  test('re-render does not re-run launch callback', async () => {
    const { useCanDismissSplash } = freshSplash();
    const { rerender } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    rerender();
    await flushMicrotasks();

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
  });

  test('errors during pending task processing allow hiding splash', async () => {
    const { useCanDismissSplash } = freshSplash();
    svc.processPendingInstallTask.mockRejectedValue(new Error('bg failed'));
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
  });

  test('safety timer allows hiding splash when event is missing', async () => {
    jest.useFakeTimers();
    const { useCanDismissSplash } = freshSplash();
    svc.processPendingInstallTask.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCanDismissSplash());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
    jest.useRealTimers();
  });

  test('non-desktop and non-native returns true without background calls', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.isDesktop = false;
    platformEnvMock.isNative = false;
    platformEnvMock.isWeb = false;

    const mod = freshSplash();
    const { result } = renderHook(() => mod.useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(svc.processPendingInstallTask).not.toHaveBeenCalled();
  });

  test('isNative: true, isDesktop: false still starts pending task processing', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.isDesktop = false;
    platformEnvMock.isNative = true;
    platformEnvMock.isWeb = false;

    const { useCanDismissSplash } = freshSplash();
    renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(svc.processPendingInstallTask).toHaveBeenCalledTimes(1);
  });
});

describe('SplashProvider', () => {
  test('renders children immediately while splash is still waiting to hide', async () => {
    const { SplashProvider } = freshSplash();

    render(
      React.createElement(
        SplashProvider,
        undefined,
        React.createElement('div', { 'data-testid': 'child' }),
      ),
    );

    expect(screen.getByTestId('child')).toBeTruthy();
    expect(g.__lastCanDismissSplash).toBe(false);

    await flushMicrotasks();

    expect(g.__lastCanDismissSplash).toBe(false);
  });
});
