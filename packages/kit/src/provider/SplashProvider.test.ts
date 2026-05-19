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

jest.mock('@onekeyhq/shared/src/utils/pendingTaskUtils', () => {
  const fn = jest.fn(() => false);
  (globalThis as any).__mockHasPendingInstallTask = fn;
  return { __esModule: true, hasPendingInstallTask: fn };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const EAppEventBusNames = {
    PendingInstallTaskProcessFinished: 'PendingInstallTaskProcessFinished',
    HomePageReady: 'HomePageReady',
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
  delete g.__ONEKEY_CTX_ATOM_SNAPSHOT__;
  delete g.__onekeyBalanceDisplayed;
  delete g.__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT;
  g.__mockHasPendingInstallTask?.mockReturnValue(false);
  const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
  platformEnvMock.version = '1.0.0';
  platformEnvMock.bundleVersion = '1';
  platformEnvMock.isWeb = false;
  platformEnvMock.isDesktop = true;
  platformEnvMock.isNative = false;
});

describe('useCanDismissSplash', () => {
  test('runs pending task processing once and waits for the finish event', async () => {
    g.__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT = true;
    const { useCanDismissSplash } = freshSplash();
    g.__mockHasPendingInstallTask.mockReturnValue(true);
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
    g.__mockHasPendingInstallTask.mockReturnValue(true);
    svc.processPendingInstallTask.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCanDismissSplash());

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
    jest.useRealTimers();
  });

  test('safety timer fires even when hasCachedStates flips after mount (regression: timer decoupled from deps)', async () => {
    jest.useFakeTimers();
    const { useCanDismissSplash } = freshSplash();
    // Path 1: cache present (byOwner hit + active account hydrated) →
    // waits for HomePageReady (never comes in this test).
    const primedSnapshot = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '$2.31',
        byOwner: { 'hd-1--0000/0__onekeyall--0': '$2.31' },
      },
      'store:accountSelector@home::ctx:activeAccountsAtom': {
        0: {
          account: { id: 'hd-1--0000/0' },
          network: { id: 'onekeyall--0' },
        },
      },
    };
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = primedSnapshot;
    const { result, rerender } = renderHook(() => useCanDismissSplash());

    // Flip hasCachedStates between renders — previously this cancelled the
    // safety timer and left splash stuck forever.
    delete g.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    rerender();
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = primedSnapshot;
    rerender();

    await act(async () => {
      jest.advanceTimersByTime(5000);
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
    g.__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT = true;
    const { SplashProvider } = freshSplash();
    g.__mockHasPendingInstallTask.mockReturnValue(true);

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

describe('useCanDismissSplash — balance cache snapshot detection', () => {
  test('no snapshot → dismisses immediately (Path 3)', async () => {
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(g.__mockAppEventBus.on).not.toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );
  });

  test('snapshot has only accountWorthAtom → dismisses immediately (regression: stale-cache placeholder must not gate splash)', async () => {
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:accountWorthAtom': {
        worth: {},
        createAtNetworkWorth: '0',
        initialized: false,
        accountId: 'hd-1--0000/0',
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(g.__mockAppEventBus.on).not.toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );
  });

  test('snapshot has empty lastConfirmedOverviewBalanceAtom → dismisses immediately', async () => {
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '',
        byOwner: {},
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
  });

  test('snapshot has latest but empty byOwner → dismisses immediately (first frame cannot use latest)', async () => {
    // Regression guard for the old over-eager behavior: `latest` alone
    // cannot satisfy HomeOverviewContainer's first-frame render (the
    // `canReuseLatestDisplayedBalance` branch depends on runtime atoms
    // that aren't hydrated yet), so splash must NOT wait 5s for a
    // HomePageReady event that will never fire.
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '$2.31',
        byOwner: {},
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(g.__mockAppEventBus.on).not.toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );
  });

  test('snapshot has byOwner populated but no active account → dismisses immediately (cannot build ownerKey)', async () => {
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '',
        byOwner: { 'hd-1--0000/0__onekeyall--0': '$2.31' },
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(g.__mockAppEventBus.on).not.toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );
  });

  test('snapshot has active account but no byOwner entries → dismisses immediately', async () => {
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '',
        byOwner: {},
      },
      'store:accountSelector@home::ctx:activeAccountsAtom': {
        0: {
          account: { id: 'hd-1--0000/0' },
          network: { id: 'onekeyall--0' },
        },
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
  });

  test('snapshot has byOwner + active account but ownerKey mismatch → dismisses immediately', async () => {
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '$2.31',
        byOwner: { 'hd-9--9999/0__onekeyall--0': '$9.00' },
      },
      'store:accountSelector@home::ctx:activeAccountsAtom': {
        0: {
          account: { id: 'hd-1--0000/0' },
          network: { id: 'onekeyall--0' },
        },
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(g.__mockAppEventBus.on).not.toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );
  });

  test('snapshot has byOwner hit by active account ownerKey → waits for HomePageReady', async () => {
    g.__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT = true;
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '$2.31',
        byOwner: { 'hd-1--0000/0__onekeyall--0': '$2.31' },
      },
      'store:accountSelector@home::ctx:activeAccountsAtom': {
        0: {
          account: { id: 'hd-1--0000/0' },
          network: { id: 'onekeyall--0' },
        },
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(false);
    expect(g.__mockAppEventBus.on).toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );

    act(() => {
      g.__mockAppEventBus.emit(
        g.__mockAppEventBusNames.HomePageReady,
        undefined,
      );
    });

    await flushMicrotasks();

    expect(result.current).toBe(true);
  });

  test('snapshot has both lastConfirmedOverviewBalance (ownerKey hit) and accountWorthAtom stale placeholder → still waits on lastConfirmed signal', async () => {
    g.__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT = true;
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:accountWorthAtom': {
        worth: {},
        createAtNetworkWorth: '0',
        initialized: false,
        accountId: 'hd-1--0000/0',
      },
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '$2.31',
        byOwner: { 'hd-1--0000/0__onekeyall--0': '$2.31' },
      },
      'store:accountSelector@home::ctx:activeAccountsAtom': {
        0: {
          account: { id: 'hd-1--0000/0' },
          network: { id: 'onekeyall--0' },
        },
      },
    };
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(false);
  });

  test('balance already displayed before listener attaches → dismisses immediately even with cache', async () => {
    g.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      'store:homeAccountOverview::ctx:lastConfirmedOverviewBalanceAtom': {
        latest: '$2.31',
        byOwner: { 'hd-1--0000/0__onekeyall--0': '$2.31' },
      },
      'store:accountSelector@home::ctx:activeAccountsAtom': {
        0: {
          account: { id: 'hd-1--0000/0' },
          network: { id: 'onekeyall--0' },
        },
      },
    };
    g.__onekeyBalanceDisplayed = true;
    const { useCanDismissSplash } = freshSplash();
    const { result } = renderHook(() => useCanDismissSplash());

    await flushMicrotasks();

    expect(result.current).toBe(true);
    expect(g.__mockAppEventBus.on).not.toHaveBeenCalledWith(
      g.__mockAppEventBusNames.HomePageReady,
      expect.any(Function),
    );
  });
});
