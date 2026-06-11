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
    shouldResumeStalledDownload: jest.fn(),
    updateLastDialogShownAt: jest.fn(),
    setCurrentUpdateAttemptId: jest.fn(),
    pruneStaleArtifacts: jest.fn().mockResolvedValue(undefined),
  };
  const dev = {
    getSkipBundleGPGVerification: jest.fn(),
  };
  (globalThis as any).__mockSvc = svc;
  (globalThis as any).__mockDevSvc = dev;
  return {
    __esModule: true,
    default: { serviceAppUpdate: svc, serviceDevSetting: dev },
  };
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
  // The root jest.config.js moduleNameMapper rewrites `@onekeyhq/components`
  // AND every deeper subpath under it (including
  // `@onekeyhq/components/src/hooks/useNetInfo`) to the same
  // __mocks__/componentsMock.ts. As a result jest.mock attaches to the
  // resolved file, so both `import { Toast } from '@onekeyhq/components'`
  // AND `import { globalNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo'`
  // pull from this single returned object — we must expose ALL named exports
  // here, or one import path will silently overwrite the other.
  const netInfoListeners: Array<
    (s: { isInternetReachable: boolean | null }) => void
  > = [];
  const globalNetInfo = {
    currentState: () => ({ isInternetReachable: null as boolean | null }),
    addEventListener: (
      l: (s: { isInternetReachable: boolean | null }) => void,
    ) => {
      netInfoListeners.push(l);
      return () => {
        const idx = netInfoListeners.indexOf(l);
        if (idx >= 0) netInfoListeners.splice(idx, 1);
      };
    },
    __emit: (state: { isInternetReachable: boolean | null }) => {
      [...netInfoListeners].forEach((l) => l(state));
    },
    __reset: () => netInfoListeners.splice(0, netInfoListeners.length),
  };
  (globalThis as any).__mockGlobalNetInfo = globalNetInfo;
  return {
    Dialog: { show: ds },
    Toast: { error: te },
    LottieView: () => null,
    YStack: ({ children }: any) => children,
    useInTabDialog: () => ({ show: ds }),
    globalNetInfo,
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
        log: jest.fn(),
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
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER all mocks
// ---------------------------------------------------------------------------

import * as React from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  computeDownloadRetryDelayMs,
  extractUpdateErrorCode,
  getUpdateReminderActionLabelId,
  isAutoUpdateStrategy,
  isForceUpdateStrategy,
  isShowAppUpdateUIWhenUpdating,
  isToolboxUpdateIndicatorRedundant,
  isUnrecoverableDownloadError,
  runDownloadWithRetry,
  sanitizeUpdateErrorMessage,
  useDownloadPackage,
} from './useAppUpdate';

// Keep a reference to the shared React so isolated modules can reuse it
(globalThis as any).__sharedReact = React;

// ---------------------------------------------------------------------------
// Convenience aliases — read from globalThis where mock factories stored them
// ---------------------------------------------------------------------------

const g = globalThis as any;
const svc = g.__mockSvc;
const devSvc = g.__mockDevSvc;
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

  // Default resolved values. getUpdateInfo uses mockImplementation so it
  // always returns the CURRENT mockAtomHolder.value — tests that reassign
  // the holder via setAtom() after resetAllMocks() don't have to repeat
  // the mock setup. (mockResolvedValue would capture the reference at
  // call time and would not see post-setAtom reassignments.)
  svc.getUpdateInfo.mockImplementation(() =>
    Promise.resolve(mockAtomHolder.value),
  );
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
  // Defaults match the safe baseline: native disallows skip, dev setting off.
  bundleUpd.isSkipGpgVerificationAllowed.mockResolvedValue(false);
  devSvc.getSkipBundleGPGVerification.mockResolvedValue(false);
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
// A.z runDownloadWithRetry — exponential-backoff retry for transient errors
// =========================================================================
describe('runDownloadWithRetry', () => {
  // Drive backoff via fake timers so tests are instant.
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper: kick off pending timers as soon as the operation rejects, so
  // the next attempt can run without real wall-clock waits.
  const flush = async () => {
    // Multiple awaits because each retry chains through Promise + setTimeout.
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
      jest.runOnlyPendingTimers();
    }
  };

  test('returns immediately on success without retrying', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    const result = await runDownloadWithRetry(op, 'test');
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  test('retries on transient error and succeeds on a later attempt', async () => {
    const op = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('NSURLErrorDomain -1005'))
      .mockRejectedValueOnce(new Error('HTTP error 504'))
      .mockResolvedValueOnce('ok');
    const promise = runDownloadWithRetry(op, 'test');
    await flush();
    await flush();
    const result = await promise;
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
  });

  test('bails immediately on SHA256_MISMATCH (unrecoverable)', async () => {
    const err = new Error('Bundle SHA256 verification failed: MISMATCH');
    const op = jest.fn().mockRejectedValue(err);
    await expect(runDownloadWithRetry(op, 'test')).rejects.toBe(err);
    expect(op).toHaveBeenCalledTimes(1);
  });

  test('bails immediately on HTTP 403 / 404 / 410', async () => {
    for (const code of [403, 404, 410]) {
      const err = new Error(`HTTP ${code}`);
      const op = jest.fn().mockRejectedValue(err);
      // eslint-disable-next-line no-await-in-loop
      await expect(runDownloadWithRetry(op, 'test')).rejects.toBe(err);
      expect(op).toHaveBeenCalledTimes(1);
    }
  });

  test('bails immediately on programmer/config errors (HTTPS, invalid version)', async () => {
    const cases = [
      'Bundle download URL must use HTTPS',
      'Invalid version string format',
      'Invalid URL',
      'Already downloading',
    ];
    for (const msg of cases) {
      const err = new Error(msg);
      const op = jest.fn().mockRejectedValue(err);
      // eslint-disable-next-line no-await-in-loop
      await expect(runDownloadWithRetry(op, 'test')).rejects.toBe(err);
      expect(op).toHaveBeenCalledTimes(1);
    }
  });

  test('throws the last error after exhausting all 5 retries', async () => {
    const errs = [
      new Error('NSURLErrorDomain -1005'),
      new Error('NSURLErrorDomain -1001'),
      new Error('HTTP 502'),
      new Error('IO_SocketTimeoutException'),
      new Error('NSURLErrorDomain -1009'),
      new Error('HTTP 503'),
    ];
    const op = jest.fn<Promise<string>, []>();
    errs.forEach((e) => op.mockRejectedValueOnce(e));
    const promise = runDownloadWithRetry(op, 'test').catch((err) => err);
    // initial + 5 retries = 6 attempts; flush once per await chain.
    for (let i = 0; i < errs.length + 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }
    const finalErr = await promise;
    expect(finalErr).toBe(errs[errs.length - 1]);
    expect(op).toHaveBeenCalledTimes(errs.length); // initial + 5 retries
  });

  test('computeDownloadRetryDelayMs grows exponentially with jitter floor', () => {
    // Backoff base = 1500. attempt 0 → ≥1500, attempt 1 → ≥3000, attempt 2 → ≥6000.
    // Cap upper bound at base*2^attempt + 500 (jitter window).
    const a0 = computeDownloadRetryDelayMs(0);
    const a1 = computeDownloadRetryDelayMs(1);
    const a2 = computeDownloadRetryDelayMs(2);
    expect(a0).toBeGreaterThanOrEqual(1500);
    expect(a0).toBeLessThan(2000);
    expect(a1).toBeGreaterThanOrEqual(3000);
    expect(a1).toBeLessThan(3500);
    expect(a2).toBeGreaterThanOrEqual(6000);
    expect(a2).toBeLessThan(6500);
  });

  test('computeDownloadRetryDelayMs is capped at 60s for late attempts', () => {
    // base * 2^6 = 96_000 > 60_000 cap; cap must clamp before jitter pushes
    // us further. Same for attempt 10 (way past the cap).
    expect(computeDownloadRetryDelayMs(6)).toBeLessThanOrEqual(60_000);
    expect(computeDownloadRetryDelayMs(10)).toBeLessThanOrEqual(60_000);
  });

  test('camps on the NetInfo listener while offline and resumes once back online', async () => {
    const netInfo = (globalThis as any).__mockGlobalNetInfo;
    netInfo.__reset();
    // Start offline: the first retry should NOT proceed off the regular
    // backoff clock — it should wait for an online emission.
    let online = false;
    netInfo.currentState = () => ({
      isInternetReachable: online ? null : false,
    });
    const op = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('NSURLErrorDomain -1009'))
      .mockResolvedValueOnce('ok');
    const promise = runDownloadWithRetry(op, 'test').catch((e) => e);
    // Let the rejection settle and waitBeforeRetry block on addEventListener.
    for (let i = 0; i < 8; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    expect(op).toHaveBeenCalledTimes(1);
    // Simulate the device coming back online — the listener fires and the
    // grace-period setTimeout schedules; advance both.
    online = true;
    netInfo.__emit({ isInternetReachable: true });
    await flush();
    await flush();
    const result = await promise;
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
    // Restore default for sibling tests.
    netInfo.currentState = () => ({ isInternetReachable: null });
  });

  test('falls back to grace + retry when the offline cap expires', async () => {
    const netInfo = (globalThis as any).__mockGlobalNetInfo;
    netInfo.__reset();
    // Stay offline the whole time — the listener never fires, so the only
    // way the retry loop can make progress is by the 5-min offline-wait cap
    // tripping and bubbling out as exitReason='timeout'.
    netInfo.currentState = () => ({ isInternetReachable: false });
    const op = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('NSURLErrorDomain -1009'))
      .mockResolvedValueOnce('ok');
    const promise = runDownloadWithRetry(op, 'test').catch((e) => e);
    // Let the rejection settle and waitForOnlineOrTimeout register its timer.
    for (let i = 0; i < 8; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    expect(op).toHaveBeenCalledTimes(1);
    // Trip the offline cap → exitReason='timeout' → falls through to grace.
    jest.advanceTimersByTime(5 * 60 * 1000);
    await flush();
    const result = await promise;
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
    // Restore default for sibling tests.
    netInfo.currentState = () => ({ isInternetReachable: null });
  });
});

// =========================================================================
// A.y sanitizeUpdateErrorMessage — strip OS-username paths before reporting
// =========================================================================
describe('sanitizeUpdateErrorMessage', () => {
  test('redacts macOS /Users/<name>/ home directory', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          "ENOENT: no such file or directory, open '/Users/john/Library/Application Support/OneKey/x.zip'",
        ),
      ),
    ).toBe(
      "ENOENT: no such file or directory, open '/Users/<redacted>/Library/Application Support/OneKey/x.zip'",
    );
  });

  test('redacts Windows C:\\Users\\<Name>\\ profile path', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'ENOENT: no such file, open C:\\Users\\Alice\\AppData\\Roaming\\OneKey\\x.zip',
        ),
      ),
    ).toBe(
      'ENOENT: no such file, open C:\\Users\\<redacted>\\AppData\\Roaming\\OneKey\\x.zip',
    );
  });

  test('redacts Linux /home/<name>/ path', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error('EACCES: permission denied at /home/bob/.config/OneKey'),
      ),
    ).toBe('EACCES: permission denied at /home/<redacted>/.config/OneKey');
  });

  test('redacts iOS /var/mobile/Containers/Data/Application/<UUID>/', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'Failed to unzip bundle: file at /var/mobile/Containers/Data/Application/8E9F1234-AAAA-BBBB-CCCC-DEADBEEF0001/Library/Caches/x.zip',
        ),
      ),
    ).toBe(
      'Failed to unzip bundle: file at /var/mobile/Containers/Data/Application/<redacted>/Library/Caches/x.zip',
    );
  });

  test('redacts iOS /var/mobile/Containers/Shared/AppGroup/<UUID>/', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'open failed at /var/mobile/Containers/Shared/AppGroup/AAAA-BBBB/onekey/x',
        ),
      ),
    ).toBe(
      'open failed at /var/mobile/Containers/Shared/AppGroup/<redacted>/onekey/x',
    );
  });

  test('redacts Android /data/data/<pkg>/ internal storage path', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'java.io.FileNotFoundException: /data/data/so.onekey.app.wallet/files/onekey-bundle-download/x.zip.partial: open failed: ENOSPC',
        ),
      ),
    ).toBe(
      'java.io.FileNotFoundException: /data/data/<redacted>/files/onekey-bundle-download/x.zip.partial: open failed: ENOSPC',
    );
  });

  test('redacts Android /data/user/<id>/<pkg>/ multi-user storage path', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'IOException: /data/user/0/so.onekey.app.wallet/files/foo: permission denied',
        ),
      ),
    ).toBe('IOException: /data/user/0/<redacted>/files/foo: permission denied');
  });

  test('preserves non-PII content unchanged', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error('Bundle SHA256 verification failed: MISMATCH'),
      ),
    ).toBe('Bundle SHA256 verification failed: MISMATCH');
    expect(sanitizeUpdateErrorMessage(new Error('HTTP 416'))).toBe('HTTP 416');
  });

  test('caps over-long messages at 240 chars + ellipsis', () => {
    const filler = 'X'.repeat(500);
    const out = sanitizeUpdateErrorMessage(new Error(filler));
    expect(out).toBeDefined();
    expect((out as string).length).toBe(241); // 240 chars + "…"
    expect((out as string).endsWith('…')).toBe(true);
  });

  test('returns undefined for empty / nullish input', () => {
    expect(sanitizeUpdateErrorMessage(undefined)).toBe(undefined);
    expect(sanitizeUpdateErrorMessage(null)).toBe(undefined);
    expect(sanitizeUpdateErrorMessage(new Error(''))).toBe(undefined);
  });

  test('plain string input is also accepted', () => {
    expect(
      sanitizeUpdateErrorMessage(
        "ENOENT '/Users/eve/Library/Application Support/OneKey'",
      ),
    ).toBe("ENOENT '/Users/<redacted>/Library/Application Support/OneKey'");
  });

  test('redacts macOS username containing whitespace ("John Doe")', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          "ENOENT: no such file, open '/Users/John Doe/Library/Application Support/OneKey/x.zip'",
        ),
      ),
    ).toBe(
      "ENOENT: no such file, open '/Users/<redacted>/Library/Application Support/OneKey/x.zip'",
    );
  });

  test('redacts Windows username containing whitespace ("John Doe")', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'ENOENT: no such file, open C:\\Users\\John Doe\\AppData\\Roaming\\OneKey\\x.zip',
        ),
      ),
    ).toBe(
      'ENOENT: no such file, open C:\\Users\\<redacted>\\AppData\\Roaming\\OneKey\\x.zip',
    );
  });

  test('redacts URL query / fragment (signed-download tokens) but keeps host + path', () => {
    expect(
      sanitizeUpdateErrorMessage(
        new Error(
          'Cannot derive file name from URL: https://cdn.example.com/onekey/x.dmg?token=abc123&exp=999',
        ),
      ),
    ).toBe(
      'Cannot derive file name from URL: https://cdn.example.com/onekey/x.dmg?<redacted>',
    );
    expect(
      sanitizeUpdateErrorMessage(
        new Error('Download failed: http://host/file#frag-with-PII'),
      ),
    ).toBe('Download failed: http://host/file#<redacted>');
    expect(
      sanitizeUpdateErrorMessage(
        new Error('No-query URL stays intact: https://cdn.example.com/x.dmg'),
      ),
    ).toBe('No-query URL stays intact: https://cdn.example.com/x.dmg');
  });
});

// =========================================================================
// A.x extractUpdateErrorCode — error → stable mixpanel code mapping
// =========================================================================
describe('extractUpdateErrorCode', () => {
  test('iOS / Android SHA256 verification failure → SHA256_<reason>', () => {
    expect(
      extractUpdateErrorCode(
        new Error('Bundle SHA256 verification failed: MISMATCH'),
      ),
    ).toBe('SHA256_MISMATCH');
    expect(
      extractUpdateErrorCode(
        new Error('Bundle SHA256 verification failed: FILE_TRUNCATED'),
      ),
    ).toBe('SHA256_FILE_TRUNCATED');
    expect(
      extractUpdateErrorCode(
        new Error('Bundle SHA256 verification failed: OOM'),
      ),
    ).toBe('SHA256_OOM');
  });

  test('iOS native error class names with mixed case + digits survive intact', () => {
    // Regression: previously the regex was [A-Z][A-Z0-9_]* so
    // "IO_NSCocoaErrorDomain_257" was truncated to "IO_NSC".
    expect(
      extractUpdateErrorCode(
        new Error(
          'Bundle SHA256 verification failed: IO_NSCocoaErrorDomain_257',
        ),
      ),
    ).toBe('SHA256_IO_NSCOCOAERRORDOMAIN_257');
    expect(
      extractUpdateErrorCode(
        new Error(
          'Bundle SHA256 verification failed: IO_FileNotFoundException',
        ),
      ),
    ).toBe('SHA256_IO_FILENOTFOUNDEXCEPTION');
  });

  test('Desktop legacy "Download failed with status: <code>" still maps to HTTP_<code>', () => {
    // Back-compat: pre-fix Desktop reject sites used this shape. New
    // sites should use "HTTP <code>"; both work via the extractor.
    expect(
      extractUpdateErrorCode(new Error('Download failed with status: 404')),
    ).toBe('HTTP_404');
    expect(
      extractUpdateErrorCode(new Error('Download failed with status: 502')),
    ).toBe('HTTP_502');
  });

  test('Desktop SHA256 failure → SHA256_<reason>', () => {
    expect(
      extractUpdateErrorCode(
        new Error('Downloaded file is not valid: SHA256_FILE_NOT_FOUND'),
      ),
    ).toBe('SHA256_FILE_NOT_FOUND');
    expect(
      extractUpdateErrorCode(
        new Error('Downloaded file is not valid: SHA256_PERMISSION_DENIED'),
      ),
    ).toBe('SHA256_PERMISSION_DENIED');
  });

  test('HTTP errors → HTTP_<status>', () => {
    expect(extractUpdateErrorCode(new Error('HTTP 416'))).toBe('HTTP_416');
    expect(extractUpdateErrorCode(new Error('HTTP error 504'))).toBe(
      'HTTP_504',
    );
    expect(
      extractUpdateErrorCode(new Error('Download failed with HTTP 502')),
    ).toBe('HTTP_502');
  });

  test('iOS NSURL session errors → NSURL_<code>', () => {
    expect(extractUpdateErrorCode(new Error('NSURLErrorDomain -1005'))).toBe(
      'NSURL_-1005',
    );
    expect(
      extractUpdateErrorCode(new Error('NSURLErrorDomain code -1001')),
    ).toBe('NSURL_-1001');
  });

  test('Generic IO bubble → IO_<class>', () => {
    expect(
      extractUpdateErrorCode(
        new Error('something IO_FileNotFoundException happened'),
      ),
    ).toBe('IO_FileNotFoundException');
  });

  test('SHA256 token wins over HTTP / IO when both appear', () => {
    expect(
      extractUpdateErrorCode(
        new Error('SHA256_MISMATCH after HTTP 200 and IO_Wrap'),
      ),
    ).toBe('SHA256_MISMATCH');
  });

  test('returns undefined for noise that does not match any pattern', () => {
    expect(extractUpdateErrorCode(new Error('Already downloading'))).toBe(
      undefined,
    );
    expect(
      extractUpdateErrorCode(new Error('Bundle download URL must use HTTPS')),
    ).toBe(undefined);
    expect(extractUpdateErrorCode(undefined)).toBe(undefined);
    expect(extractUpdateErrorCode(null)).toBe(undefined);
    expect(extractUpdateErrorCode(new Error(''))).toBe(undefined);
  });

  test('plain string error is also accepted', () => {
    expect(
      extractUpdateErrorCode(
        'Bundle SHA256 verification failed: FILE_DISAPPEARED',
      ),
    ).toBe('SHA256_FILE_DISAPPEARED');
  });
});

// =========================================================================
// A4. isUnrecoverableDownloadError
// =========================================================================
describe('isUnrecoverableDownloadError', () => {
  test.each([
    ['SHA256_MISMATCH', 'Bundle SHA256 verification failed: MISMATCH'],
    ['HTTP_403', 'HTTP 403 Forbidden'],
    ['HTTP_404', 'HTTP error 404 Not Found'],
    ['HTTP_410', 'Download failed with status: 410'],
  ])('%s code → unrecoverable', (_label, msg) => {
    expect(isUnrecoverableDownloadError(new Error(msg))).toBe(true);
  });

  test.each([
    ['HTTP_500', 'HTTP 500 Internal Server Error'],
    ['HTTP_502', 'HTTP error 502 Bad Gateway'],
    ['HTTP_504', 'HTTP 504 Gateway Timeout'],
    ['HTTP_408', 'HTTP 408 Request Timeout'],
    ['HTTP_429', 'HTTP 429 Too Many Requests'],
    [
      'SHA256_FILE_TRUNCATED',
      'Bundle SHA256 verification failed: FILE_TRUNCATED',
    ],
    ['NSURL_-1009', 'NSURLErrorDomain code -1009 (offline)'],
    ['IO_FileNotFoundException', 'IO_FileNotFoundException: open failed'],
  ])('%s code → recoverable (transient)', (_label, msg) => {
    expect(isUnrecoverableDownloadError(new Error(msg))).toBe(false);
  });

  test.each([
    'Bundle download URL must use HTTPS',
    'Invalid version string format',
    'Already downloading',
    'Invalid URL: not-a-url',
  ])('programmer/config-error message %p → unrecoverable', (msg) => {
    expect(isUnrecoverableDownloadError(new Error(msg))).toBe(true);
  });

  test('matches programmer-error message even when it is a substring of a longer message', () => {
    expect(
      isUnrecoverableDownloadError(
        new Error('OneKeyError: Already downloading bundle x'),
      ),
    ).toBe(true);
  });

  test('plain unknown free-text error → recoverable (no false positive)', () => {
    expect(isUnrecoverableDownloadError(new Error('socket hang up'))).toBe(
      false,
    );
    expect(isUnrecoverableDownloadError(new Error(''))).toBe(false);
  });

  test('handles non-Error inputs without throwing', () => {
    expect(isUnrecoverableDownloadError(null)).toBe(false);
    expect(isUnrecoverableDownloadError(undefined)).toBe(false);
    expect(isUnrecoverableDownloadError('HTTP 404 Not Found')).toBe(true);
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

    test('rotates attemptId AND persists it via setCurrentUpdateAttemptId so the post-relaunch success event can re-emit the same id', async () => {
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

      // The attemptId passed to softwareUpdateStarted must match what we
      // persisted via the service — otherwise the post-relaunch success
      // event would correlate to a different id.
      const startedCalls = (
        defaultLogger.app.appUpdate.softwareUpdateStarted as jest.Mock
      ).mock.calls;
      expect(startedCalls.length).toBeGreaterThan(0);
      const startedAttemptId = startedCalls[0][0]?.attemptId as
        | string
        | undefined;
      expect(typeof startedAttemptId).toBe('string');
      expect(startedAttemptId?.length).toBeGreaterThan(0);
      expect(svc.setCurrentUpdateAttemptId).toHaveBeenCalledWith(
        startedAttemptId,
      );
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

    test('concurrent calls collapse to a single in-flight attempt', async () => {
      // Cold-launch useEffect, AppState 'active' listener, and user click
      // can all enter downloadPackage() in the same JS tick. The mutex
      // collapses them so only ONE native download starts and all
      // observers await the same Promise. Without it, the duplicate path
      // hits native's "Already downloading" → unrecoverable → status
      // flips to failed mid-flow on the original attempt.
      svc.getUpdateInfo.mockResolvedValue({
        latestVersion: '2.0.0',
        downloadUrl: 'https://example.com/app.zip',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.getDownloadEvent.mockResolvedValue({});
      // Hold the native call open so the second invocation can pile up
      // behind the first while it's still in-flight.
      let releaseDownload: (v: any) => void = () => {};
      appUpd.downloadPackage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseDownload = resolve;
          }),
      );

      const { result } = renderHook(() => useDownloadPackage());

      let firstSettled = false;
      let secondSettled = false;
      await act(async () => {
        const p1 = result.current.downloadPackage().then(() => {
          firstSettled = true;
        });
        const p2 = result.current.downloadPackage().then(() => {
          secondSettled = true;
        });
        // Drain enough microtasks for downloadPackage's several awaits
        // (getFileTypeFromUpdateInfo / getUpdateInfo / getDownloadEvent /
        // getRequestHeaders) to pass and the native call to be entered.
        // The number is generous; the assertion below is what matters.
        for (let i = 0; i < 20; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await Promise.resolve();
        }
        // Native should have been entered exactly once because the mutex
        // returned the in-flight Promise to caller 2.
        expect(appUpd.downloadPackage).toHaveBeenCalledTimes(1);
        expect(firstSettled).toBe(false);
        expect(secondSettled).toBe(false);
        releaseDownload({});
        await p1;
        await p2;
      });
      expect(firstSettled).toBe(true);
      expect(secondSettled).toBe(true);
      // No "Already downloading" path was hit, so no spurious failure.
      expect(svc.downloadPackageFailed).not.toHaveBeenCalled();
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

  // ----- B4b. getSkipGPGVerification routing through verifyPackage -----
  // The skip-GPG branch is security-sensitive: it lets a developer bypass
  // bundle signature verification on debug builds. The native
  // `BundleUpdate.isSkipGpgVerificationAllowed()` gate is the *first*
  // line of defense (only debug/dev builds return true); the dev-setting
  // toggle is the second. Both must be true for the flag to propagate
  // into BundleUpdate.verifyBundle. We assert this precise AND-chain
  // here so a regression that flips either gate (or removes one)
  // surfaces as a failing test instead of a release-build code-signing
  // bypass.
  describe('getSkipGPGVerification (via verifyPackage)', () => {
    const baseInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
    };

    test('appShell verify never reads the dev setting (branch short-circuits at fileType)', async () => {
      svc.getUpdateInfo.mockResolvedValue({ latestVersion: '2.0.0' });
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/a.zip' });
      appUpd.verifyPackage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());
      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(bundleUpd.isSkipGpgVerificationAllowed).not.toHaveBeenCalled();
      expect(devSvc.getSkipBundleGPGVerification).not.toHaveBeenCalled();
    });

    test('bundle + native gate disallows skip → skipGPGVerification:false (dev setting never read)', async () => {
      svc.getUpdateInfo.mockResolvedValue(baseInfo);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/b.zip' });
      bundleUpd.isSkipGpgVerificationAllowed.mockResolvedValue(false);
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());
      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(bundleUpd.verifyBundle).toHaveBeenCalledWith(
        expect.objectContaining({ skipGPGVerification: false }),
      );
      // Critical: the dev-setting branch must NOT be reached when the
      // native gate denies. Otherwise a misconfigured prod build with a
      // stale `skipBundleGPGVerification=true` setting would bypass.
      expect(devSvc.getSkipBundleGPGVerification).not.toHaveBeenCalled();
    });

    test('bundle + native gate allows skip + dev setting OFF → skipGPGVerification:false', async () => {
      svc.getUpdateInfo.mockResolvedValue(baseInfo);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/b.zip' });
      bundleUpd.isSkipGpgVerificationAllowed.mockResolvedValue(true);
      devSvc.getSkipBundleGPGVerification.mockResolvedValue(false);
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());
      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(devSvc.getSkipBundleGPGVerification).toHaveBeenCalledTimes(1);
      expect(bundleUpd.verifyBundle).toHaveBeenCalledWith(
        expect.objectContaining({ skipGPGVerification: false }),
      );
    });

    test('bundle + native gate allows skip + dev setting ON → skipGPGVerification:true (the only path that bypasses)', async () => {
      svc.getUpdateInfo.mockResolvedValue(baseInfo);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/b.zip' });
      bundleUpd.isSkipGpgVerificationAllowed.mockResolvedValue(true);
      devSvc.getSkipBundleGPGVerification.mockResolvedValue(true);
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());
      await act(async () => {
        await result.current.verifyPackage();
      });

      expect(bundleUpd.verifyBundle).toHaveBeenCalledWith(
        expect.objectContaining({ skipGPGVerification: true }),
      );
    });

    test('bundle + native gate throws → falls back to skipGPGVerification:false (catch path)', async () => {
      svc.getUpdateInfo.mockResolvedValue(baseInfo);
      svc.getDownloadEvent.mockResolvedValue({ downloadedFile: '/tmp/b.zip' });
      bundleUpd.isSkipGpgVerificationAllowed.mockRejectedValue(
        new Error('JNI bridge unavailable'),
      );
      bundleUpd.verifyBundle.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDownloadPackage());
      await act(async () => {
        await result.current.verifyPackage();
      });

      // Fail-closed: a thrown native gate must not be interpreted as a
      // pass-through to the dev-setting branch.
      expect(devSvc.getSkipBundleGPGVerification).not.toHaveBeenCalled();
      expect(bundleUpd.verifyBundle).toHaveBeenCalledWith(
        expect.objectContaining({ skipGPGVerification: false }),
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

  function requireFreshHooks(): typeof import('./useAppUpdate') {
    let hooks: typeof import('./useAppUpdate') = undefined as any;
    jest.isolateModules(() => {
      // Pin react so the isolated hooks share the same React with renderHook
      jest.mock('react', () => (globalThis as any).__sharedReact);
      hooks = require('./useAppUpdate');
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
      });

      // Should call refreshUpdateStatus then schedule fetch
      expect(svc.refreshUpdateStatus).toHaveBeenCalled();
    });

    test('softwareUpdateResult success re-emits the persisted attemptId from the pre-install softwareUpdateStarted', async () => {
      // Regression: before currentUpdateAttemptId was persisted, this
      // post-relaunch event would generate a fresh UUID via
      // buildSoftwareUpdateParams's `attemptId ?? generateUUID()`
      // fallback, breaking per-attempt funnel correlation against the
      // original softwareUpdateStarted event.
      const persistedId = 'attempt-uuid-from-pre-install';
      setAtom({
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
        currentUpdateAttemptId: persistedId,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const resultCalls = (
        defaultLogger.app.appUpdate.softwareUpdateResult as jest.Mock
      ).mock.calls;
      expect(resultCalls.length).toBeGreaterThan(0);
      const successCall = resultCalls.find((c) => c[0]?.status === 'success');
      expect(successCall).toBeDefined();
      expect(successCall?.[0]?.attemptId).toBe(persistedId);
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
        await jest.runAllTimersAsync();
      });

      expect(svc.refreshUpdateStatus).toHaveBeenCalled();
      // pushFullModal for WhatsNew should NOT be called for seamless
      expect(nav.pushFullModal).not.toHaveBeenCalled();
    });

    test('hook returns pre-hydration placeholder but service returns post-update state → dialog still fires on the same launch', async () => {
      // Regression for jotai persist hydration race in
      // AppUpdateForeground.tsx: the first-launch dispatch effect has
      // empty deps and runs exactly once per app lifecycle (gated by
      // didRunFirstLaunchDispatch). If it reads the React-hook snapshot
      // and that snapshot is still the initial-value placeholder
      // (status: done, latestVersion: '0.0.0') because per-key MMKV
      // hydration hasn't propagated yet, isFirstLaunchAfterUpdated()
      // returns false and the post-update "what's new" dialog gets
      // deferred to the *next* cold launch — exactly the user-visible
      // bug. Reading the authoritative state via getUpdateInfo() removes
      // the dependency on hydration timing.

      // Simulate the hook still showing the pre-hydration placeholder.
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '0.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      // ...but the persisted (authoritative) state via the service shows
      // a completed update waiting for the post-update dialog.
      svc.getUpdateInfo.mockResolvedValue({
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Proves the dispatch entered the isFirstLaunchAfterUpdated branch
      // even though the React-hook value would have failed the check.
      expect(svc.refreshUpdateStatus).toHaveBeenCalled();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
      });

      expect(svc.fetchAppUpdateInfo).toHaveBeenCalled();
    });

    test('hydration race + force update: preview opens with the force lock derived from authoritative state, not the stale hook snapshot', async () => {
      // Regression for the jotai persist hydration race (PR #11704). The
      // empty-deps first-launch effect can run while the React-hook snapshot
      // is still the pre-hydration placeholder (status: done, manual). The
      // force-update branch is correctly gated on the authoritative
      // getUpdateInfo() result, but toUpdatePreviewPage must ALSO carry the
      // force semantics from that authoritative state. Otherwise the route
      // opens a mandatory update with isForceUpdate=false and UpdatePreview's
      // usePreventRemove / header lock briefly treat it as dismissible during
      // the hydration window.

      // Hook snapshot is the stale, non-force placeholder...
      setAtom({
        status: EAppUpdateStatus.done,
        latestVersion: '0.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      // ...but the authoritative persisted state is a force update awaiting
      // install (status !== done, latestVersion ahead of APP_VERSION so it is
      // NOT treated as first-launch-after-update).
      svc.getUpdateInfo.mockResolvedValue({
        status: EAppUpdateStatus.notify,
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.force,
      });
      svc.fetchAppUpdateInfo.mockResolvedValue({
        status: EAppUpdateStatus.notify,
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.force,
      });

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(nav.pushFullModal).toHaveBeenCalledWith(
        'AppUpdateModal',
        expect.objectContaining({
          screen: 'UpdatePreview',
          params: expect.objectContaining({ isForceUpdate: true }),
        }),
      );
    });

    test('ready + silent strategy → no dialog (applied on restart via pending task)', async () => {
      // OK-55397: silent updates no longer pop a "ready" dialog. Once the
      // silent download reaches `ready`, ServiceAppUpdate.readyToInstall has
      // already queued a pending install task (silent is allowed past the
      // strategy gate), which is applied on the next restart; the header /
      // reminder update button offers an immediate restart-install. So the
      // first-launch dispatch must NOT surface any dialog or navigation here.
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
        await jest.runAllTimersAsync();
      });

      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(nav.pushModal).not.toHaveBeenCalled();
      expect(nav.pushFullModal).not.toHaveBeenCalled();
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

      // Same drain pattern as the silent-strategy test above —
      // showUpdateDialog also wraps async awaits inside setTimeout, so
      // sync runAllTimers leaves microtasks dangling outside act().
      await act(async () => {
        await jest.runAllTimersAsync();
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
        await jest.runAllTimersAsync();
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

  describe('AppState foreground resume', () => {
    // Capture the AppState handler so each test can fire transitions.
    function captureAppStateHandler() {
      const holder: { fn?: (state: string) => void } = {};
      const RN = require('react-native');
      RN.AppState.addEventListener.mockImplementationOnce(
        (_event: string, fn: (state: string) => void) => {
          holder.fn = fn;
          return { remove: jest.fn() };
        },
      );
      return holder;
    }

    test("AppState 'active' + service returns 'downloadPackage' → fires JS downloadPackage", async () => {
      // Critical assertion: it's the JS-side downloadPackage that ultimately
      // calls BundleUpdate.downloadBundle. A foreground-resume that only
      // pokes the service (and not the JS hook) would not start any bytes.
      const handlerHolder = captureAppStateHandler();
      svc.shouldResumeStalledDownload.mockResolvedValue('downloadPackage');

      // Wire enough state that downloadPackage()'s body completes its
      // first await without reaching the network — we only need to prove
      // the JS download function was entered.
      setAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.getDownloadEvent.mockResolvedValue({});

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));

      await act(async () => {
        handlerHolder.fn?.('active');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(svc.shouldResumeStalledDownload).toHaveBeenCalledTimes(1);
      // The JS downloadPackage hook is what guarantees byte flow — it
      // begins with svc.downloadPackage() before any native call.
      expect(svc.downloadPackage).toHaveBeenCalled();
      // ASC must NOT have been routed in the package-step branch.
      expect(svc.downloadASC).not.toHaveBeenCalled();
    });

    test("AppState 'active' + service returns 'downloadASC' → fires JS downloadASC, NOT downloadPackage", async () => {
      // Critical: an ASC-only failure must resume via downloadASC().
      // Routing it through downloadPackage() would clear downloadedEvent
      // and force a full re-download of an already-on-disk package —
      // wasted bandwidth, especially under foreground/background churn
      // or a permanent 403/404 on the ASC URL.
      const handlerHolder = captureAppStateHandler();
      svc.shouldResumeStalledDownload.mockResolvedValue('downloadASC');

      setAtom({
        status: EAppUpdateStatus.downloadASCFailed,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.getDownloadEvent.mockResolvedValue({});

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));
      svc.downloadPackage.mockClear();
      svc.downloadASC.mockClear();

      await act(async () => {
        handlerHolder.fn?.('active');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(svc.shouldResumeStalledDownload).toHaveBeenCalledTimes(1);
      expect(svc.downloadASC).toHaveBeenCalled();
      // Regression guard for the original review feedback:
      // downloadPackage MUST NOT be invoked on an ASC-only resume.
      expect(svc.downloadPackage).not.toHaveBeenCalled();
    });

    test("AppState 'active' + service returns null → does NOT fire downloadPackage", async () => {
      const handlerHolder = captureAppStateHandler();
      svc.shouldResumeStalledDownload.mockResolvedValue(null);

      // Use status===notify so the run-once useEffect on first mount
      // does not itself fire downloadPackage(); we want to attribute any
      // svc.downloadPackage call SOLELY to the AppState handler under test.
      setAtom({
        status: EAppUpdateStatus.notify,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));
      // Drain the cold-launch useEffect before clearing — that effect can
      // schedule its own setTimeout/microtask chain which would otherwise
      // race the AppState handler under test.
      await act(async () => {
        jest.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();
      });
      svc.downloadPackage.mockClear();
      svc.downloadASC.mockClear();

      await act(async () => {
        handlerHolder.fn?.('active');
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(svc.shouldResumeStalledDownload).toHaveBeenCalledTimes(1);
      // Critical regression guard: when the gate says no, no JS download
      // call must happen. Otherwise an in-flight download would race with
      // a duplicate downloadPackage call → "Already downloading" →
      // unrecoverable → status flipped to failed, killing a healthy flow.
      expect(svc.downloadPackage).not.toHaveBeenCalled();
      expect(svc.downloadASC).not.toHaveBeenCalled();
    });

    test("non-'active' transitions are no-ops (no service call at all)", async () => {
      const handlerHolder = captureAppStateHandler();
      setAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const hooks = requireFreshHooks();
      renderHook(() => hooks.useAppUpdateInfo(false, true));
      svc.shouldResumeStalledDownload.mockClear();
      svc.downloadPackage.mockClear();

      await act(async () => {
        handlerHolder.fn?.('background');
        handlerHolder.fn?.('inactive');
        await Promise.resolve();
      });
      expect(svc.shouldResumeStalledDownload).not.toHaveBeenCalled();
      expect(svc.downloadPackage).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // C-extra: once-per-app-lifetime guard
  // -------------------------------------------------------------------------
  // The first-launch dispatch effect lives on a module-scoped flag in
  // AppUpdateForeground.tsx (didRunFirstLaunchDispatch). It must fire
  // exactly once across the lifetime of the JS context, even if the
  // hook (or the <AppUpdateForeground /> component) is unmounted and
  // remounted — StrictMode double-invoke and hot-reload both remount.
  // The component-local `cancelled` flag would not catch this on its own.
  describe('once-per-app-lifetime guard', () => {
    function requireFreshHooksWithForeground(): {
      hooks: typeof import('./useAppUpdate');
      foreground: typeof import('./AppUpdateForeground');
    } {
      let hooks: typeof import('./useAppUpdate') = undefined as any;
      let foreground: typeof import('./AppUpdateForeground') = undefined as any;
      jest.isolateModules(() => {
        jest.mock('react', () => (globalThis as any).__sharedReact);
        hooks = require('./useAppUpdate');
        foreground = require('./AppUpdateForeground');
      });
      return { hooks, foreground };
    }

    test('remount within the same app lifecycle does NOT re-fire the first-launch dispatch', async () => {
      setAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const { hooks } = requireFreshHooksWithForeground();
      const r1 = renderHook(() => hooks.useAppUpdateInfo(false, true));
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      expect(svc.downloadPackage).toHaveBeenCalledTimes(1);

      r1.unmount();
      svc.downloadPackage.mockClear();

      // Same module instance → didRunFirstLaunchDispatch is still true.
      renderHook(() => hooks.useAppUpdateInfo(false, true));
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      expect(svc.downloadPackage).not.toHaveBeenCalled();
    });

    test('__resetAppUpdateForegroundForTests clears the guard so the next mount re-fires', async () => {
      setAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
      });
      svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);
      svc.fetchAppUpdateInfo.mockResolvedValue(mockAtomHolder.value);

      const { hooks, foreground } = requireFreshHooksWithForeground();
      const r1 = renderHook(() => hooks.useAppUpdateInfo(false, true));
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      expect(svc.downloadPackage).toHaveBeenCalledTimes(1);

      r1.unmount();
      svc.downloadPackage.mockClear();
      foreground.__resetAppUpdateForegroundForTests();

      renderHook(() => hooks.useAppUpdateInfo(false, true));
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      expect(svc.downloadPackage).toHaveBeenCalledTimes(1);
    });
  });
});

// =========================================================================
// D. onUpdateAction routing
// =========================================================================
describe('onUpdateAction', () => {
  function requireFreshHooks(): typeof import('./useAppUpdate') {
    let hooks: typeof import('./useAppUpdate') = undefined as any;
    jest.isolateModules(() => {
      jest.mock('react', () => (globalThis as any).__sharedReact);
      hooks = require('./useAppUpdate');
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

// =========================================================================
// D2. onUpdateActionDirect routing (toolbox reminder + top-right Update button)
// Never opens the changelog: hot update restarts, major update jumps to the
// download/verify modal (App Store builds open the store).
// =========================================================================
describe('onUpdateActionDirect', () => {
  function requireFreshHooks(): typeof import('./useAppUpdate') {
    let hooks: typeof import('./useAppUpdate') = undefined as any;
    jest.isolateModules(() => {
      jest.mock('react', () => (globalThis as any).__sharedReact);
      hooks = require('./useAppUpdate');
    });
    return hooks;
  }

  test('jsBundle + ready → installs bundle (restart), no navigation / no store', async () => {
    // latestVersion === platformEnv.version ('1.0.0') + higher jsBundleVersion
    // → getUpdateFileType resolves to jsBundle.
    setAtom({
      status: EAppUpdateStatus.ready,
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      downloadedEvent: { downloadUrl: 'https://x/bundle' },
    });
    svc.getUpdateInfo.mockResolvedValue(mockAtomHolder.value);

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    await act(async () => {
      result.current.onUpdateActionDirect();
      await Promise.resolve();
    });

    expect(bundleUpd.installBundle).toHaveBeenCalledWith(
      mockAtomHolder.value.downloadedEvent,
    );
    expect(nav.pushModal).not.toHaveBeenCalled();
    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
  });

  test('appShell + notify + downloadUrl → navigates to DownloadVerify (no changelog)', () => {
    setAtom({
      status: EAppUpdateStatus.notify,
      latestVersion: '2.0.0',
      downloadUrl: 'https://x/app',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateActionDirect();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'DownloadVerify' }),
    );
    expect(nav.pushModal).not.toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'UpdatePreview' }),
    );
  });

  test('appShell + storeUrl → opens store, no navigation', () => {
    setAtom({
      status: EAppUpdateStatus.notify,
      latestVersion: '2.0.0',
      storeUrl: 'https://apps.apple.com/onekey',
      downloadUrl: 'https://x/app',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateActionDirect();
    });

    expect(mockOpenUrlExternal).toHaveBeenCalledWith(
      'https://apps.apple.com/onekey',
    );
    expect(nav.pushModal).not.toHaveBeenCalled();
  });

  test('status=updateIncomplete → shows incomplete dialog', () => {
    setAtom({
      status: EAppUpdateStatus.updateIncomplete,
      latestVersion: '2.0.0',
    });

    const hooks = requireFreshHooks();
    const { result } = renderHook(() => hooks.useAppUpdateInfo(false, false));

    act(() => {
      result.current.onUpdateActionDirect();
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
      result.current.onUpdateActionDirect();
    });

    expect(nav.pushModal).toHaveBeenCalledWith(
      'AppUpdateModal',
      expect.objectContaining({ screen: 'ManualInstall' }),
    );
  });
});

// =========================================================================
// D3. getUpdateReminderActionLabelId — toolbox reminder CTA label
// A downloaded hot update (jsBundle @ ready) restarts on click → "Update now";
// every other state opens a flow → generic "View".
// =========================================================================
describe('getUpdateReminderActionLabelId', () => {
  test('jsBundle + ready → "Update now"', () => {
    expect(
      getUpdateReminderActionLabelId({
        fileType: EUpdateFileType.jsBundle,
        updateStatus: EAppUpdateStatus.ready,
      }),
    ).toBe(ETranslations.update_update_now);
  });

  test('jsBundle + notify → "View" (not yet downloaded)', () => {
    expect(
      getUpdateReminderActionLabelId({
        fileType: EUpdateFileType.jsBundle,
        updateStatus: EAppUpdateStatus.notify,
      }),
    ).toBe(ETranslations.global_view);
  });

  test('appShell + ready → "View" (opens install flow, not a restart)', () => {
    expect(
      getUpdateReminderActionLabelId({
        fileType: EUpdateFileType.appShell,
        updateStatus: EAppUpdateStatus.ready,
      }),
    ).toBe(ETranslations.global_view);
  });

  test('appShell + notify → "View"', () => {
    expect(
      getUpdateReminderActionLabelId({
        fileType: EUpdateFileType.appShell,
        updateStatus: EAppUpdateStatus.notify,
      }),
    ).toBe(ETranslations.global_view);
  });
});

// =========================================================================
// D4. isToolboxUpdateIndicatorRedundant — desktop hot-update has a dedicated
// header button, so the toolbox indicators (Action Center reminder AND the
// more-actions dot) are duplicates and must be hidden.
// =========================================================================
describe('isToolboxUpdateIndicatorRedundant', () => {
  test('desktop + jsBundle → redundant (dot + reminder hidden)', () => {
    expect(
      isToolboxUpdateIndicatorRedundant({
        isDesktop: true,
        fileType: EUpdateFileType.jsBundle,
      }),
    ).toBe(true);
  });

  test('desktop + appShell → not redundant (reminder shows download progress)', () => {
    expect(
      isToolboxUpdateIndicatorRedundant({
        isDesktop: true,
        fileType: EUpdateFileType.appShell,
      }),
    ).toBe(false);
  });

  test('non-desktop + jsBundle → not redundant (no header button on mobile)', () => {
    expect(
      isToolboxUpdateIndicatorRedundant({
        isDesktop: false,
        fileType: EUpdateFileType.jsBundle,
      }),
    ).toBe(false);
  });

  test('non-desktop + appShell → not redundant', () => {
    expect(
      isToolboxUpdateIndicatorRedundant({
        isDesktop: false,
        fileType: EUpdateFileType.appShell,
      }),
    ).toBe(false);
  });
});
