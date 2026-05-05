/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, import/first, vars-on-top, no-var */
// UpdateReminder hooks tests
//
// Tests the update flow orchestration logic in hooks.tsx:
//   - Utility functions (isShowToastError, isAutoUpdateStrategy, etc.)
//   - useDownloadPackage: download → downloadASC → verifyASC → verifyPackage → readyToInstall
//   - useAppUpdateInfo: useEffect startup logic, onUpdateAction routing
//
// yarn jest packages/kit/src/components/UpdateReminder/hooks.test.ts

// ---------------------------------------------------------------------------
// Jest hoists jest.mock() above imports. Variables referenced inside factory
// functions must already exist at hoist time. We use globalThis to bridge.
// ---------------------------------------------------------------------------

// All mock objects are created INSIDE jest.mock factories (which jest hoists)
// and exposed via globalThis so test code can reference them.

jest.mock('../../background/instance/backgroundApiProxy', () => {
  const svc = {
    getUpdateInfo: jest.fn(),
    getDownloadEvent: jest.fn(),
    downloadPackage: jest.fn(),
    downloadPackageFailed: jest.fn(),
    downloadASC: jest.fn(),
    downloadASCFailed: jest.fn(),
    verifyASC: jest.fn(),
    verifyASCFailed: jest.fn(),
    verifyPackage: jest.fn(),
    verifyPackageFailed: jest.fn(),
    readyToInstall: jest.fn(),
    updateDownloadedEvent: jest.fn(),
    fetchAppUpdateInfo: jest.fn(),
    refreshUpdateStatus: jest.fn(),
    processPendingInstallTask: jest.fn(),
    fetchChangeLog: jest.fn(),
    reset: jest.fn(),
    resetToInComplete: jest.fn(),
    updateLastDialogShownAt: jest.fn(),
  };
  (globalThis as any).__mockSvc = svc;
  return { __esModule: true, default: { serviceAppUpdate: svc } };
});

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => {
  const au = {
    downloadPackage: jest.fn(),
    downloadASC: jest.fn(),
    verifyASC: jest.fn(),
    verifyPackage: jest.fn(),
    installPackage: jest.fn(),
    manualInstallPackage: jest.fn(),
    clearPackage: jest.fn(),
  };
  const bu = {
    downloadBundle: jest.fn(),
    downloadBundleASC: jest.fn(),
    verifyBundleASC: jest.fn(),
    verifyBundle: jest.fn(),
    installBundle: jest.fn(),
    clearBundle: jest.fn(),
    resetToBuiltInBundle: jest.fn(),
    restart: jest.fn(),
    isSkipGpgVerificationAllowed: jest.fn().mockResolvedValue(false),
  };
  (globalThis as any).__mockAppUpd = au;
  (globalThis as any).__mockBundleUpd = bu;
  return { AppUpdate: au, BundleUpdate: bu };
});

jest.mock('../../hooks/useAppNavigation', () => {
  const n = {
    pushModal: jest.fn(),
    pushFullModal: jest.fn(),
    popStack: jest.fn(),
  };
  (globalThis as any).__mockNav = n;
  return { __esModule: true, default: () => n };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const atomHolder = {
    value: { status: 'done', updateStrategy: 2, latestVersion: '1.0.0' },
  };
  (globalThis as any).__mockAtomHolder = atomHolder;
  return {
    useAppUpdatePersistAtom: () => [atomHolder.value],
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  // Created inline — cannot reference __mocks here because jest hoists this
  // factory above the __mocks assignment.
  const env = {
    version: '1.0.0',
    bundleVersion: '1',
    isNative: false,
    isNativeAndroid: false,
    isDesktop: false,
    isExtension: false,
    isE2E: false,
    buildNumber: 1,
  };
  (globalThis as any).__mockPlatformEnv = env;
  return { __esModule: true, default: env };
});

jest.mock('@onekeyhq/components', () => {
  const ds = jest.fn();
  const te = jest.fn();
  (globalThis as any).__mockDialogShow = ds;
  (globalThis as any).__mockToastError = te;
  return {
    Dialog: { show: ds },
    Toast: { error: te },
    LottieView: () => null,
    YStack: ({ children }: any) => children,
    useInTabDialog: () => ({ show: ds }),
  };
});

jest.mock(
  '@onekeyhq/kit/assets/animations/update-notification-dark.json',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/assets/animations/update-notification-light.json',
  () => ({}),
);

jest.mock('../../hooks/useRunAfterTokensDone', () => ({
  runAfterTokensDone: ({ onRun }: { onRun: (trigger: string) => void }) => {
    onRun('test');
    return () => {};
  },
}));

jest.mock('../../utils/passwordUtils', () => ({
  whenAppUnlocked: () => Promise.resolve(),
}));

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn().mockResolvedValue({}),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => {
  const fn = jest.fn();
  (globalThis as any).__mockOpenUrlExternal = fn;
  return { openUrlExternal: fn };
});

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: () => Promise.resolve(),
    getTimeDurationMs: ({ seconds, minute, hour, day }: any = {}) => {
      if (day) return day * 86_400_000;
      if (hour) return hour * 3_600_000;
      if (minute) return minute * 60_000;
      if (seconds) return seconds * 1000;
      return 0;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      appUpdate: {
        softwareUpdateStarted: jest.fn(),
        softwareUpdateResult: jest.fn(),
        startCheckForUpdates: jest.fn(),
        startDownload: jest.fn(),
        endDownload: jest.fn(),
        startDownloadASC: jest.fn(),
        endDownloadASC: jest.fn(),
        startVerifyASC: jest.fn(),
        endVerifyASC: jest.fn(),
        startVerifyPackage: jest.fn(),
        endVerifyPackage: jest.fn(),
        startInstallPackage: jest.fn(),
        endInstallPackage: jest.fn(),
        startManualInstallPackage: jest.fn(),
        endManualInstallPackage: jest.fn(),
        isNeedSyncAppUpdateInfo: jest.fn(),
        fetchConfig: jest.fn(),
        startCheckForUpdatesOnly: jest.fn(),
        endCheckForUpdates: jest.fn(),
      },
      error: { log: jest.fn() },
      component: {
        closedInUpdateDialog: jest.fn(),
        confirmedInUpdateDialog: jest.fn(),
      },
    },
  },
}));

jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  EAppUpdateRoutes: {
    WhatsNew: 'WhatsNew',
    UpdatePreview: 'UpdatePreview',
    DownloadVerify: 'DownloadVerify',
    ManualInstall: 'ManualInstall',
  },
  EModalRoutes: {
    AppUpdateModal: 'AppUpdateModal',
  },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyError: class OneKeyError extends Error {},
}));

jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER all mocks
// ---------------------------------------------------------------------------

import * as React from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';

import {
  isAutoUpdateStrategy,
  isForceUpdateStrategy,
  isShowAppUpdateUIWhenUpdating,
  useDownloadPackage,
} from './hooks';

// Keep a reference to the shared React so isolated modules can reuse it
(globalThis as any).__sharedReact = React;

// ---------------------------------------------------------------------------
// Convenience aliases — read from globalThis where mock factories stored them
// ---------------------------------------------------------------------------

const g = globalThis as any;
const svc = g.__mockSvc;
const nav = g.__mockNav;
const appUpd = g.__mockAppUpd;
const bundleUpd = g.__mockBundleUpd;
const mockDialogShow = g.__mockDialogShow;
const mockToastError = g.__mockToastError;
const mockOpenUrlExternal = g.__mockOpenUrlExternal;
const mockPlatformEnv = g.__mockPlatformEnv;
const mockAtomHolder = g.__mockAtomHolder;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAtom(partial: Record<string, any>) {
  mockAtomHolder.value = {
    status: EAppUpdateStatus.done,
    updateStrategy: EUpdateStrategy.manual,
    latestVersion: '1.0.0',
    ...partial,
  };
}

function resetAllMocks() {
  jest.clearAllMocks();
  setAtom({});

  // Default resolved values
  svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
  svc.getDownloadEvent.mockResolvedValue(null);
  svc.downloadPackage.mockResolvedValue(undefined);
  svc.downloadPackageFailed.mockResolvedValue(undefined);
  svc.downloadASC.mockResolvedValue(undefined);
  svc.downloadASCFailed.mockResolvedValue(undefined);
  svc.verifyASC.mockResolvedValue(undefined);
  svc.verifyASCFailed.mockResolvedValue(undefined);
  svc.verifyPackage.mockResolvedValue(undefined);
  svc.verifyPackageFailed.mockResolvedValue(undefined);
  svc.readyToInstall.mockResolvedValue(undefined);
  svc.updateDownloadedEvent.mockResolvedValue(undefined);
  svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
  svc.refreshUpdateStatus.mockResolvedValue(undefined);
  svc.reset.mockResolvedValue(undefined);
  svc.resetToInComplete.mockResolvedValue(undefined);
  svc.fetchChangeLog.mockResolvedValue(undefined);
  svc.updateLastDialogShownAt.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  resetAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

// =========================================================================
// A. Utility functions
// =========================================================================
describe('Utility functions', () => {
  test('isAutoUpdateStrategy returns true for silent and seamless', () => {
    expect(isAutoUpdateStrategy(EUpdateStrategy.silent)).toBe(true);
    expect(isAutoUpdateStrategy(EUpdateStrategy.seamless)).toBe(true);
    expect(isAutoUpdateStrategy(EUpdateStrategy.manual)).toBe(false);
    expect(isAutoUpdateStrategy(EUpdateStrategy.force)).toBe(false);
  });

  test('isForceUpdateStrategy returns true only for force', () => {
    expect(isForceUpdateStrategy(EUpdateStrategy.force)).toBe(true);
    expect(isForceUpdateStrategy(EUpdateStrategy.manual)).toBe(false);
    expect(isForceUpdateStrategy(EUpdateStrategy.silent)).toBe(false);
    expect(isForceUpdateStrategy(EUpdateStrategy.seamless)).toBe(false);
  });

  describe('isShowAppUpdateUIWhenUpdating', () => {
    test('seamless strategy always returns false', () => {
      expect(
        isShowAppUpdateUIWhenUpdating({
          updateStrategy: EUpdateStrategy.seamless,
          updateStatus: EAppUpdateStatus.ready,
        }),
      ).toBe(false);
    });

    test('manual and force strategy always return true', () => {
      for (const strategy of [EUpdateStrategy.manual, EUpdateStrategy.force]) {
        expect(
          isShowAppUpdateUIWhenUpdating({
            updateStrategy: strategy,
            updateStatus: EAppUpdateStatus.downloadPackage,
          }),
        ).toBe(true);
      }
    });

    test('silent strategy returns true only when status is ready', () => {
      expect(
        isShowAppUpdateUIWhenUpdating({
          updateStrategy: EUpdateStrategy.silent,
          updateStatus: EAppUpdateStatus.ready,
        }),
      ).toBe(true);
      expect(
        isShowAppUpdateUIWhenUpdating({
          updateStrategy: EUpdateStrategy.silent,
          updateStatus: EAppUpdateStatus.downloadPackage,
        }),
      ).toBe(false);
    });
  });
});

// =========================================================================
// B. useDownloadPackage
// =========================================================================
describe('useDownloadPackage', () => {
  // ----- B1. downloadPackage -----
  describe('downloadPackage', () => {
    test('appShell happy path: download → chains to downloadASC', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.getDownloadEvent.mockResolvedValue({
        downloadedFile: '/tmp/app.zip',
      });
      appUpd.downloadPackage.mockResolvedValue({
        downloadedFile: '/tmp/app.zip',
      });
      appUpd.downloadASC.mockResolvedValue(undefined);
      appUpd.verifyASC.mockResolvedValue(undefined);
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(svc.downloadPackage).toHaveBeenCalled();
      expect(appUpd.downloadPackage).toHaveBeenCalled();
      expect(svc.updateDownloadedEvent).toHaveBeenCalled();
      // Chain continues to downloadASC
      expect(svc.downloadASC).toHaveBeenCalled();
    });

    test('jsBundle path uses BundleUpdate instead of AppUpdate', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        jsBundle: {
          downloadUrl: 'https://example.com/bundle.zip',
          sha256: 'abc',
          signature: 'sig',
          fileSize: 1000,
        },
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.getDownloadEvent.mockResolvedValue({
        downloadedFile: '/tmp/bundle.zip',
      });
      bundleUpd.downloadBundle.mockResolvedValue({
        downloadedFile: '/tmp/bundle.zip',
      });
      bundleUpd.downloadBundleASC.mockResolvedValue(undefined);
      bundleUpd.verifyBundleASC.mockResolvedValue(undefined);
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(bundleUpd.downloadBundle).toHaveBeenCalled();
      expect(appUpd.downloadPackage).not.toHaveBeenCalled();
    });

    test('download returns null → does not call updateDownloadedEvent', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.manual,
      });
      appUpd.downloadPackage.mockResolvedValue(null);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(svc.updateDownloadedEvent).not.toHaveBeenCalled();
    });

    test('download throws → calls downloadPackageFailed', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.manual,
      });
      appUpd.downloadPackage.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(svc.downloadPackageFailed).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Network error' }),
      );
    });

    test('download fails + manual strategy → shows Toast', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.manual,
      });
      appUpd.downloadPackage.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(mockToastError).toHaveBeenCalled();
    });

    test('download fails + silent strategy → no Toast', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.silent,
      });
      appUpd.downloadPackage.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });

    test('download fails + seamless strategy → no Toast', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.seamless,
      });
      appUpd.downloadPackage.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadPackage();
      });

      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  // ----- B2. downloadASC -----
  describe('downloadASC', () => {
    test('no downloadEvent → calls downloadASCFailed', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue(null);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadASC();
      });

      expect(svc.downloadASCFailed).toHaveBeenCalled();
      expect(svc.downloadASC).not.toHaveBeenCalled();
    });

    test('appShell: calls AppUpdate.downloadASC then chains to verifyASC', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.downloadASC.mockResolvedValue(undefined);
      appUpd.verifyASC.mockResolvedValue(undefined);
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadASC();
      });

      expect(svc.downloadASC).toHaveBeenCalled();
      expect(appUpd.downloadASC).toHaveBeenCalled();
      expect(svc.verifyASC).toHaveBeenCalled();
    });

    test('jsBundle: calls BundleUpdate.downloadBundleASC', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
      });
      svc.getDownloadEvent.mockResolvedValue({
        downloadedFile: '/tmp/b.zip',
      });
      bundleUpd.downloadBundleASC.mockResolvedValue(undefined);
      bundleUpd.verifyBundleASC.mockResolvedValue(undefined);
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadASC();
      });

      expect(bundleUpd.downloadBundleASC).toHaveBeenCalled();
      expect(appUpd.downloadASC).not.toHaveBeenCalled();
    });

    test('throws → calls downloadASCFailed(error)', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.downloadASC.mockRejectedValue(new Error('ASC download failed'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.downloadASC();
      });

      expect(svc.downloadASCFailed).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'ASC download failed' }),
      );
    });
  });

  // ----- B3. verifyASC -----
  describe('verifyASC', () => {
    test('no downloadEvent → calls verifyASCFailed', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue(null);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyASC();
      });

      expect(svc.verifyASCFailed).toHaveBeenCalled();
      expect(svc.verifyASC).not.toHaveBeenCalled();
    });

    test('appShell: calls AppUpdate.verifyASC then chains to verifyPackage', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.verifyASC.mockResolvedValue(undefined);
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyASC();
      });

      expect(svc.verifyASC).toHaveBeenCalled();
      expect(appUpd.verifyASC).toHaveBeenCalled();
      expect(svc.verifyPackage).toHaveBeenCalled();
    });

    test('jsBundle: calls BundleUpdate.verifyBundleASC', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
      });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/b.zip' });
      bundleUpd.verifyBundleASC.mockResolvedValue(undefined);
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyASC();
      });

      expect(bundleUpd.verifyBundleASC).toHaveBeenCalled();
      expect(appUpd.verifyASC).not.toHaveBeenCalled();
    });

    test('throws → calls verifyASCFailed(error)', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.verifyASC.mockRejectedValue(new Error('Signature mismatch'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyASC();
      });

      expect(svc.verifyASCFailed).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Signature mismatch' }),
      );
    });
  });

  // ----- B4. verifyPackage -----
  describe('verifyPackage', () => {
    test('no downloadEvent → calls verifyPackageFailed', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue(null);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(svc.verifyPackageFailed).toHaveBeenCalled();
      expect(svc.verifyPackage).not.toHaveBeenCalled();
    });

    test('appShell: calls AppUpdate.verifyPackage then readyToInstall', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(svc.verifyPackage).toHaveBeenCalled();
      expect(appUpd.verifyPackage).toHaveBeenCalled();
      expect(svc.readyToInstall).toHaveBeenCalled();
    });

    test('jsBundle: calls BundleUpdate.verifyBundle then readyToInstall', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
      });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/b.zip' });
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(bundleUpd.verifyBundle).toHaveBeenCalled();
      expect(appUpd.verifyPackage).not.toHaveBeenCalled();
      expect(svc.readyToInstall).toHaveBeenCalled();
    });

    test('throws → calls verifyPackageFailed(error)', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.verifyPackage.mockRejectedValue(new Error('Hash mismatch'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(svc.verifyPackageFailed).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hash mismatch' }),
      );
    });
  });

  // ----- B5. installPackage -----
  describe('installPackage', () => {
    test('appShell success → calls AppUpdate.installPackage + onSuccess', async () => {
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.installPackage(onSuccess, onFail);
      });

      expect(appUpd.installPackage).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
      expect(onFail).not.toHaveBeenCalled();
    });

    test('jsBundle success → calls BundleUpdate.installBundle + onSuccess', async () => {
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        updateStrategy: EUpdateStrategy.manual,
        downloadedEvent: { downloadedFile: '/tmp/bundle.zip' },
      });

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.installPackage(onSuccess, onFail);
      });

      expect(bundleUpd.installBundle).toHaveBeenCalled();
      expect(svc.processPendingInstallTask).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    test('jsBundle with no downloadedEvent → calls onFail immediately', async () => {
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        updateStrategy: EUpdateStrategy.manual,
        downloadedEvent: undefined,
      });

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.installPackage(onSuccess, onFail);
      });

      expect(onFail).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
    });

    test('install throws + manual → shows Toast (onFail only for NOT_FOUND_PACKAGE)', async () => {
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      appUpd.installPackage.mockRejectedValue(new Error('Install failed'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.installPackage(onSuccess, onFail);
      });

      expect(onFail).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalled();
    });

    test('install throws NOT_FOUND_PACKAGE → calls onFail', async () => {
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      appUpd.installPackage.mockRejectedValue(new Error('NOT_FOUND_PACKAGE'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.installPackage(onSuccess, onFail);
      });

      expect(onFail).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    test('install throws + silent → no Toast and no onFail', async () => {
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.silent,
      });
      appUpd.installPackage.mockRejectedValue(new Error('Install failed'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.installPackage(onSuccess, onFail);
      });

      expect(onFail).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  // ----- B6. manualInstallPackage -----
  describe('manualInstallPackage', () => {
    test('appShell: success → calls AppUpdate.manualInstallPackage', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
      });
      svc.getDownloadEvent.mockResolvedValue({
        downloadedFile: '/tmp/app.apk',
      });

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.manualInstallPackage();
      });

      expect(appUpd.manualInstallPackage).toHaveBeenCalled();
    });

    test('jsBundle: success → calls BundleUpdate.installBundle', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
      });
      svc.getDownloadEvent.mockResolvedValue({
        downloadedFile: '/tmp/bundle.zip',
      });

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.manualInstallPackage();
      });

      expect(bundleUpd.installBundle).toHaveBeenCalled();
      expect(appUpd.manualInstallPackage).not.toHaveBeenCalled();
    });

    test('no downloadEvent → Toast + resetToInComplete', async () => {
      svc.getDownloadEvent.mockResolvedValue(null);

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.manualInstallPackage();
      });

      expect(mockToastError).toHaveBeenCalled();
      expect(svc.resetToInComplete).toHaveBeenCalled();
    });

    test('install throws → Toast + resetToInComplete + shows dialog', async () => {
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
      });
      svc.getDownloadEvent.mockResolvedValue({
        downloadedFile: '/tmp/app.apk',
      });
      appUpd.manualInstallPackage.mockRejectedValue(new Error('Install error'));

      const { result } = renderHook(() => useDownloadPackage());

      await act(async () => {
        await result.current.manualInstallPackage();
      });

      expect(mockToastError).toHaveBeenCalled();
      expect(svc.resetToInComplete).toHaveBeenCalled();
      expect(mockDialogShow).toHaveBeenCalled();
    });
  });
});

// =========================================================================
// C. useAppUpdateInfo — useEffect startup logic
// =========================================================================
describe('useAppUpdateInfo useEffect', () => {
  // The module-level isFirstLaunch is consumed once per module load.
  // We use jest.isolateModules to get a fresh copy of ./hooks while
  // pinning 'react' to the shared instance (so renderHook works).

  function requireFreshHooks(): typeof import('./hooks') {
    let hooks: typeof import('./hooks') = undefined as any;
    jest.isolateModules(() => {
      // Pin react so the isolated hooks share the same React with renderHook
      jest.mock('react', () => (globalThis as any).__sharedReact);
      hooks = require('./hooks');
    });
    return hooks;
  }

  describe('status recovery on restart', () => {
    test('status=downloadPackage → resumes download', async () => {
      setAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.downloadPackage).toHaveBeenCalled();
    });

    test('status=downloadASC → resumes downloadASC', async () => {
      setAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      appUpd.downloadASC.mockResolvedValue(undefined);
      appUpd.verifyASC.mockResolvedValue(undefined);
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.downloadASC).toHaveBeenCalled();
    });

    test('status=verifyASC → resumes verifyASC', async () => {
      setAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      appUpd.verifyASC.mockResolvedValue(undefined);
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.verifyASC).toHaveBeenCalled();
    });

    test('status=verifyPackage → resumes verifyPackage', async () => {
      setAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.verifyPackage).toHaveBeenCalled();
    });

    test('status=updateIncomplete → does nothing', async () => {
      setAtom({
        status: EAppUpdateStatus.updateIncomplete,
        latestVersion: '2.0.0',
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.downloadPackage).not.toHaveBeenCalled();
      expect(svc.downloadASC).not.toHaveBeenCalled();
      expect(svc.verifyASC).not.toHaveBeenCalled();
      expect(svc.verifyPackage).not.toHaveBeenCalled();
    });
  });

  // ----- C4. ready status handling -----
  describe('ready status handling', () => {
    test('ready + jsBundle + seamless + valid signature → auto-installs', async () => {
      setAtom({
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.seamless,
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        downloadedEvent: {
          downloadedFile: '/tmp/bundle.zip',
          signature: 'valid-sig',
          sha256: 'valid-hash',
        },
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(bundleUpd.installBundle).toHaveBeenCalledWith(
        mockAtomHolder.value.downloadedEvent,
      );
    });

    test('ready + jsBundle + seamless + missing signature → reset', async () => {
      setAtom({
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.seamless,
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        downloadedEvent: {
          downloadedFile: '/tmp/bundle.zip',
        },
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
      expect(svc.reset).toHaveBeenCalled();
    });

    test('ready + appShell + seamless → auto-installs app package', async () => {
      setAtom({
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.seamless,
        latestVersion: '2.0.0',
        downloadedEvent: {
          downloadedFile: '/tmp/app.pkg',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      appUpd.installPackage.mockResolvedValue(undefined);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(appUpd.installPackage).toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
    });

    test('ready + force → shows force update preview, blocks other UI', async () => {
      setAtom({
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.force,
        latestVersion: '2.0.0',
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(nav.pushFullModal).toHaveBeenCalled();
      expect(bundleUpd.installBundle).not.toHaveBeenCalled();
    });
  });

  // ----- C6. Edge conditions -----
  describe('edge conditions', () => {
    test('autoCheck=false → useEffect does not trigger', async () => {
      setAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, false));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.downloadPackage).not.toHaveBeenCalled();
      expect(svc.fetchAppUpdateInfo).not.toHaveBeenCalled();
    });
  });

  // ----- C1. First launch after update -----
  describe('first launch after update', () => {
    test('isFirstLaunchAfterUpdated + non-seamless → opens WhatsNew', async () => {
      // isFirstLaunchAfterUpdated returns true when status !== done
      // and APP_VERSION >= latestVersion
      setAtom({
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0', // same as platformEnv.version
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      // Should call refreshUpdateStatus then schedule fetch
      expect(svc.refreshUpdateStatus).toHaveBeenCalled();
    });

    test('isFirstLaunchAfterUpdated + seamless → no WhatsNew dialog', async () => {
      setAtom({
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.seamless,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(svc.refreshUpdateStatus).toHaveBeenCalled();
      // pushFullModal for WhatsNew should NOT be called for seamless
      expect(nav.pushFullModal).not.toHaveBeenCalled();
    });
  });

  // ----- C5. fetchUpdateInfo result handling -----
  describe('fetchUpdateInfo result handling', () => {
    test('status=done + needUpdate + auto strategy → auto downloads', async () => {
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      // fetchAppUpdateInfo returns data indicating an update is needed
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.silent,
        status: EAppUpdateStatus.notify,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      // Allow promises to resolve
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      // checkForUpdates calls fetchAppUpdateInfo, then auto strategy → downloadPackage
      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
    });

    test('status=done + jsBundleRollback + seamless → auto downloads', async () => {
      // platformEnv.version='1.0.0', bundleVersion='1' (from mock defaults)
      // Remote returns same app version but LOWER bundleVersion → rollback
      // shouldUpdate=false but isRollback=true → seamless auto-download
      mockPlatformEnv.bundleVersion = '5';
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '3',
        updateStrategy: EUpdateStrategy.seamless,
        status: EAppUpdateStatus.notify,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
      expect(svc.downloadPackage).toHaveBeenCalled();
      mockPlatformEnv.bundleVersion = '1';
    });

    test('jsBundleRollback + manual strategy → still auto downloads (ignores strategy)', async () => {
      // Rollback is a corrective action — always auto-downloads
      // regardless of server-returned strategy.
      mockPlatformEnv.bundleVersion = '5';
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '3',
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.notify,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
      expect(svc.downloadPackage).toHaveBeenCalled();
      mockPlatformEnv.bundleVersion = '1';
    });

    test('jsBundleRollback + force strategy → still auto downloads (ignores strategy)', async () => {
      mockPlatformEnv.bundleVersion = '5';
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '3',
        updateStrategy: EUpdateStrategy.force,
        status: EAppUpdateStatus.notify,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
      expect(svc.downloadPackage).toHaveBeenCalled();
      mockPlatformEnv.bundleVersion = '1';
    });

    test('jsBundleRollback + seamless + downloadPackageFailed → does NOT re-download', async () => {
      // Simulates: previous rollback download failed, app restarts.
      // fetchAppUpdateInfo keeps failed status (same target), so rollback
      // auto-download must NOT trigger again to avoid retry loops.
      mockPlatformEnv.bundleVersion = '5';
      setAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.seamless,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '3',
        updateStrategy: EUpdateStrategy.seamless,
        status: EAppUpdateStatus.downloadPackageFailed,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
      expect(svc.downloadPackage).not.toHaveBeenCalled();
      mockPlatformEnv.bundleVersion = '1';
    });

    test('jsBundleRollback + seamless + verifyPackageFailed → does NOT re-download', async () => {
      mockPlatformEnv.bundleVersion = '5';
      setAtom({
        status: EAppUpdateStatus.verifyPackageFailed,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.seamless,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '3',
        updateStrategy: EUpdateStrategy.seamless,
        status: EAppUpdateStatus.verifyPackageFailed,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
      expect(svc.downloadPackage).not.toHaveBeenCalled();
      mockPlatformEnv.bundleVersion = '1';
    });

    test('status=done + needUpdate + force → toUpdatePreviewPage(full)', async () => {
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.force,
        status: EAppUpdateStatus.notify,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
    });

    test('ready + silent strategy → shows silent update dialog', async () => {
      setAtom({
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.silent,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        jest.runAllTimers();
      });

      // showSilentUpdateDialog uses setTimeout → Dialog.show
      expect(mockDialogShow).toHaveBeenCalled();
    });

    test('ready + manual strategy → shows regular update dialog', async () => {
      setAtom({
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.manual,
        latestVersion: '2.0.0',
      });
      mockPlatformEnv.isDesktop = true;
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        jest.runAllTimers();
      });

      // showUpdateDialog → dialog.show
      expect(mockDialogShow).toHaveBeenCalled();
      mockPlatformEnv.isDesktop = false;
    });

    test('status=done + jsBundle + storeUrl + native → confirm should not open store url', async () => {
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      mockPlatformEnv.isNative = true;
      svc.fetchAppUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.notify,
        storeUrl: 'https://apps.apple.com/app/id123',
      });
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.ready,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        jest.runAllTimers();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      const dialogParams = mockDialogShow.mock.calls.at(-1)?.[0];
      expect(dialogParams).toBeTruthy();

      await act(async () => {
        dialogParams.onConfirm?.();
        jest.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(mockOpenUrlExternal).not.toHaveBeenCalled();
      expect(nav.pushModal).toHaveBeenCalledWith(
        'AppUpdateModal',
        expect.objectContaining({ screen: 'DownloadVerify' }),
      );
      mockPlatformEnv.isNative = false;
    });
  });
});

// =========================================================================
// D. onUpdateAction routing
// =========================================================================
describe('onUpdateAction', () => {
  function requireFreshHooks(): typeof import('./hooks') {
    let hooks: typeof import('./hooks') = undefined as any;
    jest.isolateModules(() => {
      jest.mock('react', () => (globalThis as any).__sharedReact);
      hooks = require('./hooks');
    });
    return hooks;
  }

  test('status=done → navigates to UpdatePreview', async () => {
    setAtom({ status: EAppUpdateStatus.done, latestVersion: '2.0.0' });
    svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateAction();
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'UpdatePreview' }),
    );
  });

  test('status=notify → navigates to UpdatePreview', async () => {
    setAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });
    svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateAction();
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'UpdatePreview' }),
    );
  });

  test('status=updateIncomplete → shows incomplete dialog', () => {
    setAtom({
      status: EAppUpdateStatus.updateIncomplete,
      latestVersion: '2.0.0',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateAction();
    });

    expect(mockDialogShow).toHaveBeenCalled();
  });

  test('status=manualInstall → navigates to ManualInstall', () => {
    setAtom({
      status: EAppUpdateStatus.manualInstall,
      latestVersion: '2.0.0',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateAction();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'ManualInstall' }),
    );
  });

  test('status=downloadPackage → navigates to DownloadVerify', () => {
    setAtom({
      status: EAppUpdateStatus.downloadPackage,
      latestVersion: '2.0.0',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateAction();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'DownloadVerify' }),
    );
  });

  test('status=ready → navigates to DownloadVerify (default case)', () => {
    setAtom({
      status: EAppUpdateStatus.ready,
      latestVersion: '2.0.0',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateAction();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'DownloadVerify' }),
    );
  });
});
