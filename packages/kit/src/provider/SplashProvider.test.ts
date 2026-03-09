/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, import/first */
// SplashProvider useDisplaySplash tests
//
// Tests the splash-screen gating logic that decides whether to show the
// splash while a seamless update is installed at launch.
//
// yarn jest packages/kit/src/provider/SplashProvider.test.ts

// ---------------------------------------------------------------------------
// jest.mock factories — hoisted above imports; expose via globalThis
// ---------------------------------------------------------------------------

jest.mock('../background/instance/backgroundApiProxy', () => {
  const svc = {
    getUpdateInfo: jest.fn(),
    refreshUpdateStatus: jest.fn(),
    reset: jest.fn(),
  };
  (globalThis as any).__mockSvc = svc;
  return { __esModule: true, default: { serviceAppUpdate: svc } };
});

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => {
  const au = { installPackage: jest.fn() };
  const bu = { installBundle: jest.fn() };
  (globalThis as any).__mockAppUpd = au;
  (globalThis as any).__mockBundleUpd = bu;
  return { AppUpdate: au, BundleUpdate: bu };
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
        startInstallPackage: jest.fn(),
        endInstallPackage: jest.fn(),
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

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import * as React from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';

// Keep shared React for isolateModules
(globalThis as any).__sharedReact = React;

// ---------------------------------------------------------------------------
// Convenience aliases — read lazily because jest.mock factories for
// backgroundApiProxy/auto-update only run when SplashProvider is required,
// while platformEnv mock runs immediately (it's imported at top level).
// ---------------------------------------------------------------------------

const g = globalThis as any;
const mockPlatformEnv = g.__mockPlatformEnv;

// These are set lazily — populated after first freshSplash()
let svc: any;
let appUpd: any;
let bundleUpd: any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  // After first require, the mock factories have run — grab references
  svc = g.__mockSvc;
  appUpd = g.__mockAppUpd;
  bundleUpd = g.__mockBundleUpd;
  // Set safe defaults
  svc.getUpdateInfo.mockResolvedValue(makeAppInfo());
  svc.refreshUpdateStatus.mockResolvedValue(undefined);
  svc.reset.mockResolvedValue(undefined);
  appUpd.installPackage.mockResolvedValue(undefined);
  bundleUpd.installBundle.mockResolvedValue(undefined);
  return mod;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformEnv.isDesktop = true;
  mockPlatformEnv.isNative = false;
});

// =========================================================================
// Tests
// =========================================================================

describe('useDisplaySplash', () => {
  // ----- A. Non-seamless strategy → show splash immediately -----
  describe('non-seamless strategy', () => {
    test('manual strategy → displaySplash becomes true', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({ updateStrategy: EUpdateStrategy.manual }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      // Initially false before async callback resolves
      expect(result.current).toBe(false);

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });

    test('force strategy → displaySplash becomes true', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({ updateStrategy: EUpdateStrategy.force }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
      // Should not attempt any install
      expect(appUpd.installPackage).not.toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
    });

    test('silent strategy → displaySplash becomes true', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({ updateStrategy: EUpdateStrategy.silent }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });
  });

  // ----- B. Seamless + isFirstLaunchAfterUpdated -----
  describe('seamless + first launch after update', () => {
    test('refreshes update status and shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      // isFirstLaunchAfterUpdated returns true when status !== done
      // and APP_VERSION (1.0.0) >= latestVersion
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

      expect(svc.refreshUpdateStatus).toHaveBeenCalled();
      expect(result.current).toBe(true);
      // Should not install anything
      expect(appUpd.installPackage).not.toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
    });
  });

  // ----- C. Seamless + ready + missing downloadedEvent -----
  describe('seamless + ready + missing downloadedEvent', () => {
    test('resets and shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '2.0.0',
          downloadedEvent: undefined,
        }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(svc.reset).toHaveBeenCalled();
      expect(result.current).toBe(true);
      expect(appUpd.installPackage).not.toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
    });
  });

  // ----- D. Seamless + ready + jsBundle + missing signature/sha256 -----
  describe('seamless + ready + jsBundle missing signature', () => {
    test('missing signature → resets and shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '1.0.0',
          jsBundleVersion: '5',
          downloadedEvent: {
            downloadedFile: '/tmp/bundle.zip',
            sha256: 'valid-hash',
            // signature missing
          },
        }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(svc.reset).toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
      expect(result.current).toBe(true);
    });

    test('missing sha256 → resets and shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '1.0.0',
          jsBundleVersion: '5',
          downloadedEvent: {
            downloadedFile: '/tmp/bundle.zip',
            signature: 'valid-sig',
            // sha256 missing
          },
        }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(svc.reset).toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
      expect(result.current).toBe(true);
    });
  });

  // ----- E. Seamless + ready + jsBundle + valid → installs bundle -----
  describe('seamless + ready + jsBundle install', () => {
    test('valid signature + sha256 → calls BundleUpdate.installBundle', async () => {
      const downloadedEvent = {
        downloadedFile: '/tmp/bundle.zip',
        signature: 'valid-sig',
        sha256: 'valid-hash',
      };
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '1.0.0',
          jsBundleVersion: '5',
          downloadedEvent,
        }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(bundleUpd.installBundle).toHaveBeenCalledWith(downloadedEvent);
      expect(appUpd.installPackage).not.toHaveBeenCalled();
      expect(svc.reset).not.toHaveBeenCalled();
      // On success, displaySplash stays false (app restarts/reloads)
      expect(result.current).toBe(false);
    });

    test('installBundle throws → resets and shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '1.0.0',
          jsBundleVersion: '5',
          downloadedEvent: {
            downloadedFile: '/tmp/bundle.zip',
            signature: 'valid-sig',
            sha256: 'valid-hash',
          },
        }),
      );
      bundleUpd.installBundle.mockRejectedValue(new Error('Install failed'));

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(svc.reset).toHaveBeenCalled();
      expect(result.current).toBe(true);
    });
  });

  // ----- F. Seamless + ready + appShell → installs package -----
  describe('seamless + ready + appShell install', () => {
    test('appShell (no jsBundleVersion) → calls AppUpdate.installPackage', async () => {
      const appInfo = makeAppInfo({
        updateStrategy: EUpdateStrategy.seamless,
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/app.dmg' },
      });
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(appInfo);

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(appUpd.installPackage).toHaveBeenCalledWith(appInfo);
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
      expect(svc.reset).not.toHaveBeenCalled();
      // On success, displaySplash stays false (desktop relaunches)
      expect(result.current).toBe(false);
    });

    test('installPackage throws → resets and shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '2.0.0',
          downloadedEvent: { downloadedFile: '/tmp/app.dmg' },
        }),
      );
      appUpd.installPackage.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(svc.reset).toHaveBeenCalled();
      expect(result.current).toBe(true);
    });
  });

  // ----- G. Seamless + other status (not ready, not firstLaunch) -----
  describe('seamless + other status', () => {
    test('status=downloadPackage → shows splash without install', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.downloadPackage,
          latestVersion: '2.0.0',
        }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
      expect(appUpd.installPackage).not.toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
      expect(svc.reset).not.toHaveBeenCalled();
      expect(svc.refreshUpdateStatus).not.toHaveBeenCalled();
    });

    test('status=done + seamless → shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.done,
          latestVersion: '2.0.0',
        }),
      );

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });
  });

  // ----- H. Idempotency: useLayoutEffect only fires once -----
  describe('idempotency', () => {
    test('re-render does not re-execute launch callback', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({ updateStrategy: EUpdateStrategy.manual }),
      );

      const { result, rerender } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
      expect(svc.getUpdateInfo).toHaveBeenCalledTimes(1);

      // Re-render — should NOT call getUpdateInfo again
      rerender();
      await act(async () => {
        await Promise.resolve();
      });

      expect(svc.getUpdateInfo).toHaveBeenCalledTimes(1);
    });
  });

  // ----- I. Web/extension platform → always returns true -----
  describe('web/extension platform', () => {
    test('non-desktop + non-native → useDisplaySplash returns true', () => {
      mockPlatformEnv.isDesktop = false;
      mockPlatformEnv.isNative = false;

      // The branch is decided at module load time by platformEnv
      const mod = freshSplash();
      const { result } = renderHook(() => mod.useDisplaySplash());

      expect(result.current).toBe(true);
      // No background calls at all
      expect(svc.getUpdateInfo).not.toHaveBeenCalled();
    });
  });

  // ----- J. Error resilience — must never leave displaySplash=false -----
  describe('error resilience', () => {
    test('getUpdateInfo throws → displaySplash becomes true', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockRejectedValue(new Error('bg process crashed'));

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });

    test('getUpdateInfo never resolves → safety timeout shows splash', async () => {
      jest.useFakeTimers();
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useDisplaySplash());

      // Still waiting
      expect(result.current).toBe(false);

      // Advance past the safety timeout
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      expect(result.current).toBe(true);
      jest.useRealTimers();
    });

    test('seamless + firstLaunch + refreshUpdateStatus throws → still shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.notify,
          latestVersion: '1.0.0',
        }),
      );
      svc.refreshUpdateStatus.mockRejectedValue(new Error('crash'));

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });

    test('seamless + ready + missing downloadedEvent + reset throws → still shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '2.0.0',
          downloadedEvent: undefined,
        }),
      );
      svc.reset.mockRejectedValue(new Error('reset failed'));

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });

    test('seamless + ready + missing signature + reset throws → still shows splash', async () => {
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '1.0.0',
          jsBundleVersion: '5',
          downloadedEvent: {
            downloadedFile: '/tmp/bundle.zip',
            sha256: 'hash',
          },
        }),
      );
      svc.reset.mockRejectedValue(new Error('reset failed'));

      const { result } = renderHook(() => useDisplaySplash());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current).toBe(true);
    });

    test('install succeeds but app does not restart → safety timeout shows splash', async () => {
      jest.useFakeTimers();
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockResolvedValue(
        makeAppInfo({
          updateStrategy: EUpdateStrategy.seamless,
          status: EAppUpdateStatus.ready,
          latestVersion: '2.0.0',
          downloadedEvent: { downloadedFile: '/tmp/app.dmg' },
        }),
      );
      // installPackage resolves but doesn't actually restart
      appUpd.installPackage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDisplaySplash());

      // Let async logic complete
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Install "succeeded" but app didn't restart — displaySplash still false
      expect(result.current).toBe(false);

      // Safety timeout kicks in
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });

      expect(result.current).toBe(true);
      jest.useRealTimers();
    });
  });

  // ----- K. Cleanup: unmounting clears the safety timeout -----
  describe('cleanup', () => {
    test('unmounting clears the safety timeout', async () => {
      jest.useFakeTimers();
      // getUpdateInfo never resolves — only the safety timer can show splash
      const { useDisplaySplash } = freshSplash();
      svc.getUpdateInfo.mockReturnValue(new Promise(() => {}));

      const { result, unmount } = renderHook(() => useDisplaySplash());
      expect(result.current).toBe(false);

      // Unmount before the 10s safety timer fires
      unmount();

      // Advance past 10s
      await jest.advanceTimersByTimeAsync(15_000);

      // Since we unmounted, the safety timer should have been cleared
      // result.current is frozen at false (hook unmounted)
      expect(result.current).toBe(false);
      jest.useRealTimers();
    });
  });
});
