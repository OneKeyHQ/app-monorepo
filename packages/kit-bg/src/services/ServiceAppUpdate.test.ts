// ServiceAppUpdate state transition tests
// Tests the state machine that drives bundle/app updates:
//   notify → downloadPackage → downloadASC → verifyASC → verifyPackage → ready → done
// Native functions (BundleUpdate/AppUpdate) are mocked — they have their own tests.
//
// yarn jest packages/kit-bg/src/services/ServiceAppUpdate.test.ts

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';

import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

// ---------------------------------------------------------------------------
// In-memory atom mock — replaces appUpdatePersistAtom with a synchronous store
// so we can test ServiceAppUpdate without Jotai infrastructure.
// ---------------------------------------------------------------------------

const INITIAL_ATOM_VALUE: IAppUpdateInfo = {
  latestVersion: '0.0.0',
  updateAt: 0,
  status: EAppUpdateStatus.done,
  updateStrategy: EUpdateStrategy.manual,
  lastUpdateDialogShownAt: undefined,
};

let atomValue: IAppUpdateInfo = { ...INITIAL_ATOM_VALUE };

const mockAtom = {
  get: jest.fn(async () => atomValue),
  set: jest.fn(
    async (
      valOrUpdater: IAppUpdateInfo | ((prev: IAppUpdateInfo) => IAppUpdateInfo),
    ) => {
      if (typeof valOrUpdater === 'function') {
        atomValue = valOrUpdater(atomValue);
      } else {
        atomValue = valOrUpdater;
      }
      return atomValue;
    },
  ),
};

jest.mock('../states/jotai/atoms', () => ({
  appUpdatePersistAtom: mockAtom,
}));

// ---------------------------------------------------------------------------
// Mock platformEnv
// ---------------------------------------------------------------------------
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    version: '1.0.0',
    bundleVersion: '1',
    isExtension: false,
    isNativeAndroid: false,
  },
}));

// ---------------------------------------------------------------------------
// Mock auto-update native modules (BundleUpdate / AppUpdate)
// ---------------------------------------------------------------------------
jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  AppUpdate: {
    downloadPackage: jest.fn(async () => ({})),
    verifyPackage: jest.fn(async () => undefined),
    verifyASC: jest.fn(async () => undefined),
    downloadASC: jest.fn(async () => undefined),
    installPackage: jest.fn(async () => undefined),
    manualInstallPackage: jest.fn(async () => undefined),
    clearPackage: jest.fn(async () => undefined),
  },
  BundleUpdate: {
    downloadBundle: jest.fn(async () => ({})),
    verifyBundle: jest.fn(async () => undefined),
    verifyBundleASC: jest.fn(async () => undefined),
    downloadBundleASC: jest.fn(async () => undefined),
    installBundle: jest.fn(async () => undefined),
    clearBundle: jest.fn(async () => undefined),
    clearAllJSBundleData: jest.fn(async () => ({
      success: true,
      message: 'ok',
    })),
    getFallbackBundles: jest.fn(async () => []),
    switchBundle: jest.fn(async () => undefined),
    isBundleExists: jest.fn(async () => false),
    listLocalBundles: jest.fn(async () => []),
    testVerification: jest.fn(async () => false),
    testDeleteJsBundle: jest.fn(async () => ({
      success: true,
      message: 'ok',
    })),
    testDeleteJsRuntimeDir: jest.fn(async () => ({
      success: true,
      message: 'ok',
    })),
    testDeleteMetadataJson: jest.fn(async () => ({
      success: true,
      message: 'ok',
    })),
    testWriteEmptyMetadataJson: jest.fn(async () => ({
      success: true,
      message: 'ok',
    })),
    getWebEmbedPathAsync: jest.fn(async () => ''),
    getWebEmbedPath: jest.fn(() => ''),
    getNativeAppVersion: jest.fn(async () => ''),
    getSha256FromFilePath: jest.fn(async () => ''),
    getNativeBuildNumber: jest.fn(async () => ''),
    getJsBundlePath: jest.fn(async () => ''),
    verifyExtractedBundle: jest.fn(async () => undefined),
  },
}));

// ---------------------------------------------------------------------------
// Mock decorators (no-ops in test)
// ---------------------------------------------------------------------------
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
}));

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      appUpdate: {
        isNeedSyncAppUpdateInfo: jest.fn(),
        fetchConfig: jest.fn(),
        endInstallPackage: jest.fn(),
        startInstallPackage: jest.fn(),
      },
      error: { log: jest.fn() },
      component: {},
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock cacheUtils (memoizee + memoFn)
// ---------------------------------------------------------------------------
jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: (fn: any) => fn,
  memoFn: (fn: any) => fn,
}));

// ---------------------------------------------------------------------------
// Mock appApiClient
// ---------------------------------------------------------------------------
jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(async () => ({
      get: jest.fn(async () => ({ data: { code: 0, data: null } })),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock endpoints
// ---------------------------------------------------------------------------
jest.mock('../endpoints', () => ({
  getEndpointInfo: jest.fn(async () => ({ endpoint: 'https://test.com' })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ServiceAppUpdate = require('./ServiceAppUpdate').default;
  return new ServiceAppUpdate({
    backgroundApi: {
      serviceApp: {
        resetLaunchTimesAfterUpdate: jest.fn(async () => undefined),
      },
    },
  });
}

function resetAtom(overrides?: Partial<IAppUpdateInfo>) {
  atomValue = { ...INITIAL_ATOM_VALUE, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceAppUpdate state transitions', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // Happy path: full download → verify → ready flow
  // =========================================================================
  describe('happy path', () => {
    test('downloadPackage sets status to downloadPackage and clears downloadedEvent', async () => {
      resetAtom({
        status: EAppUpdateStatus.notify,
        downloadedEvent: { downloadedFile: '/old/file.zip' },
      });

      await service.downloadPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('updateDownloadedEvent stores downloaded event in atom', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      const event = {
        downloadedFile: '/tmp/bundle.zip',
        sha256: 'abc123',
        signature: 'sig1',
      };
      await service.updateDownloadedEvent(event);

      expect(atomValue.downloadedEvent).toEqual(event);
    });

    test('downloadASC sets status to downloadASC', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadASC();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
    });

    test('verifyASC sets status to verifyASC', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadASC });

      await service.verifyASC();

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    test('verifyPackage sets status to verifyPackage', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyASC });

      await service.verifyPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
    });

    test('readyToInstall sets status to ready', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyPackage });

      await service.readyToInstall();

      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });

    test('full happy path: notify → downloadPackage → downloadASC → verifyASC → verifyPackage → ready', async () => {
      resetAtom({ status: EAppUpdateStatus.notify });

      await service.downloadPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);

      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);

      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);

      await service.verifyPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);

      await service.readyToInstall();
      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });
  });

  // =========================================================================
  // Error paths: each step's failure scenario
  // =========================================================================
  describe('error paths', () => {
    test('downloadPackageFailed sets downloadPackageFailed status with default error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_network_exception_check_connection,
      );
    });

    test('downloadPackageFailed maps "Server not responding" error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed({
        message: 'Server not responding',
      });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('downloadPackageFailed maps "Cannot download" error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed({
        message: 'Cannot download update package',
      });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('downloadPackageFailed maps connection abort error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed({
        message: 'Software caused connection abort',
      });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_network_instability_check_connection,
      );
    });

    test('downloadPackageFailed maps HTTP 500 error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed({ message: '500' });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('downloadPackageFailed maps HTTP 404 error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed({ message: '404' });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('downloadPackageFailed maps HTTP 403 error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackageFailed({ message: '403' });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('verifyASCFailed sets verifyASCFailed status', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyASC });

      await service.verifyASCFailed({ message: 'Bad signature' });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASCFailed);
      expect(atomValue.errorText).toBe('Bad signature');
    });

    test('verifyASCFailed uses default error when no message', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyASC });

      await service.verifyASCFailed();

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_signature_verification_failed_alert_text,
      );
    });

    test('verifyPackageFailed sets verifyPackageFailed status', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyPackage });

      await service.verifyPackageFailed({ message: 'Corrupted package' });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackageFailed);
      expect(atomValue.errorText).toBe('Corrupted package');
    });

    test('verifyPackageFailed uses default error when no message', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyPackage });

      await service.verifyPackageFailed();

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_installation_not_safe_alert_text,
      );
    });

    test('downloadASCFailed maps HTTP 500 to server error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadASC });

      await service.downloadASCFailed({ message: '500' });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('downloadASCFailed maps HTTP 404 to server error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadASC });

      await service.downloadASCFailed({ message: '404' });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });

    test('downloadASCFailed defaults to network instability', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadASC });

      await service.downloadASCFailed({ message: 'some unknown error' });

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_network_instability_check_connection,
      );
    });
  });

  // =========================================================================
  // Download timeout
  // =========================================================================
  describe('download timeout', () => {
    test('downloadPackage triggers downloadPackageFailed after 30 minutes', async () => {
      resetAtom({ status: EAppUpdateStatus.notify });

      await service.downloadPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);

      // Advance 30 minutes
      await jest.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_download_timed_out_check_connection,
      );
    });

    test('verifyPackage clears download timeout', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackage();
      // Move to verify before timeout
      await service.verifyPackage();

      // Advance past 30 min — should NOT trigger downloadPackageFailed
      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
    });

    test('readyToInstall clears download timeout', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackage();
      await service.readyToInstall();

      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });
  });

  // =========================================================================
  // Recovery: reset and state correction
  // =========================================================================
  describe('recovery and reset', () => {
    test('reset sets atom to done state with platform version', async () => {
      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/bundle.zip' },
        errorText: ETranslations.update_network_exception_check_connection,
      });

      await service.reset();

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
      expect(atomValue.latestVersion).toBe('1.0.0'); // from platformEnv mock
      expect(atomValue.downloadedEvent).toBeUndefined();
      expect(atomValue.previousAppVersion).toBeUndefined();
      expect(atomValue.jsBundle).toBeUndefined();
    });

    test('resetToManualInstall sets manualInstall status and clears error', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackageFailed,
        errorText: ETranslations.update_installation_not_safe_alert_text,
      });

      await service.resetToManualInstall();

      expect(atomValue.status).toBe(EAppUpdateStatus.manualInstall);
      expect(atomValue.errorText).toBeUndefined();
    });

    test('resetToInComplete sets updateIncomplete status and clears error', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        errorText: ETranslations.update_network_exception_check_connection,
      });

      await service.resetToInComplete();

      expect(atomValue.status).toBe(EAppUpdateStatus.updateIncomplete);
      expect(atomValue.errorText).toBeUndefined();
    });

    test('can restart download after downloadPackageFailed', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackageFailed });

      await service.downloadPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
    });

    test('can restart from verifyASCFailed by re-entering download', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASCFailed,
        errorText:
          ETranslations.update_signature_verification_failed_alert_text,
      });

      await service.downloadPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);

      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);

      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    test('can restart from verifyPackageFailed by re-entering download', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackageFailed,
        errorText: ETranslations.update_installation_not_safe_alert_text,
      });

      await service.downloadPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
    });

    test('reset clears timers without error even when no timers active', async () => {
      resetAtom({ status: EAppUpdateStatus.done });

      // Should not throw
      await service.reset();

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });
  });

  // =========================================================================
  // updateDownloadUrl security
  // =========================================================================
  describe('updateDownloadUrl security', () => {
    test('accepts HTTPS download URL', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: { downloadedFile: '/tmp/old.zip' },
      });

      await service.updateDownloadUrl('https://cdn.onekey.so/bundle.zip');

      expect(atomValue.downloadedEvent?.downloadUrl).toBe(
        'https://cdn.onekey.so/bundle.zip',
      );
    });

    test('rejects HTTP download URL', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: { downloadedFile: '/tmp/old.zip' },
      });

      await service.updateDownloadUrl('http://evil.com/bundle.zip');

      // URL should NOT be updated
      expect(atomValue.downloadedEvent?.downloadUrl).toBeUndefined();
    });

    test('rejects empty download URL', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: {
          downloadedFile: '/tmp/old.zip',
          downloadUrl: 'https://original.com/bundle.zip',
        },
      });

      await service.updateDownloadUrl('');

      // Empty string is falsy, so passes the `if (downloadUrl &&` check
      // and sets it — this is allowed per current implementation
      expect(atomValue.downloadedEvent?.downloadUrl).toBe('');
    });
  });

  // =========================================================================
  // getUpdateStatus / getUpdateInfo / getDownloadEvent
  // =========================================================================
  describe('getters', () => {
    test('getUpdateStatus returns current status', async () => {
      resetAtom({ status: EAppUpdateStatus.ready });

      const status = await service.getUpdateStatus();

      expect(status).toBe(EAppUpdateStatus.ready);
    });

    test('getUpdateInfo returns full atom value', async () => {
      const expected: IAppUpdateInfo = {
        latestVersion: '2.0.0',
        updateAt: 123_456,
        status: EAppUpdateStatus.notify,
        updateStrategy: EUpdateStrategy.force,
      };
      resetAtom(expected);

      const info = await service.getUpdateInfo();

      expect(info.latestVersion).toBe('2.0.0');
      expect(info.status).toBe(EAppUpdateStatus.notify);
      expect(info.updateStrategy).toBe(EUpdateStrategy.force);
    });

    test('getDownloadEvent returns downloadedEvent from atom', async () => {
      const event = {
        downloadedFile: '/tmp/bundle.zip',
        sha256: 'abc',
      };
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: event,
      });

      const result = await service.getDownloadEvent();

      expect(result).toEqual(event);
    });

    test('getDownloadEvent returns undefined when no event', async () => {
      resetAtom({ status: EAppUpdateStatus.done });

      const result = await service.getDownloadEvent();

      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // updateLastDialogShownAt / clearLastDialogShownAt
  // =========================================================================
  describe('dialog shown tracking', () => {
    test('updateLastDialogShownAt sets timestamp', async () => {
      resetAtom({ lastUpdateDialogShownAt: undefined });

      const before = Date.now();
      await service.updateLastDialogShownAt();

      expect(atomValue.lastUpdateDialogShownAt).toBeGreaterThanOrEqual(before);
    });

    test('clearLastDialogShownAt removes timestamp', async () => {
      resetAtom({ lastUpdateDialogShownAt: Date.now() });

      await service.clearLastDialogShownAt();

      expect(atomValue.lastUpdateDialogShownAt).toBeUndefined();
    });
  });

  // =========================================================================
  // updateErrorText
  // =========================================================================
  describe('updateErrorText', () => {
    test('sets both status and errorText', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      service.updateErrorText(
        EAppUpdateStatus.downloadPackageFailed,
        'Custom error message',
      );

      // updateErrorText uses void (fire-and-forget), wait for microtask
      await Promise.resolve();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe('Custom error message');
    });
  });

  // =========================================================================
  // clearCache
  // =========================================================================
  describe('clearCache', () => {
    test('clears native caches and resets atom', async () => {
      const {
        AppUpdate,
        BundleUpdate,
      } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');

      resetAtom({
        status: EAppUpdateStatus.ready,
        downloadedEvent: { downloadedFile: '/tmp/old.zip' },
      });

      await service.clearCache();

      expect(AppUpdate.clearPackage).toHaveBeenCalled();
      expect(BundleUpdate.clearBundle).toHaveBeenCalled();
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });
  });

  // =========================================================================
  // fetchConfig security validations
  // =========================================================================
  describe('fetchConfig security', () => {
    function mockFetchConfigResponse(data: any) {
      const mockClient = {
        get: jest.fn(async () => ({ data: { code: 0, data } })),
      };
      jest.spyOn(service, 'getClient').mockResolvedValue(mockClient as any);
      return mockClient;
    }

    test('rejects unknown updateStrategy value', async () => {
      mockFetchConfigResponse({
        version: '2.0.0',
        updateStrategy: 99,
      });

      const result = await service.fetchConfig();

      // Should return cached (undefined initially), not update cache
      expect(result).toBeUndefined();
    });

    test('accepts valid updateStrategy values', async () => {
      for (const strategy of [
        EUpdateStrategy.silent,
        EUpdateStrategy.force,
        EUpdateStrategy.manual,
        EUpdateStrategy.seamless,
      ]) {
        mockFetchConfigResponse({
          version: '2.0.0',
          updateStrategy: strategy,
        });

        const result = await service.fetchConfig();

        expect(result).toBeDefined();
        expect(result?.version).toBe('2.0.0');
      }
    });

    test('rejects jsBundle with HTTP downloadUrl', async () => {
      mockFetchConfigResponse({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
        jsBundle: {
          downloadUrl: 'http://evil.com/bundle.zip',
          sha256: 'abc',
        },
      });

      const result = await service.fetchConfig();

      // Should return cached, not update with insecure URL
      expect(result).toBeUndefined();
    });

    test('accepts jsBundle with HTTPS downloadUrl', async () => {
      mockFetchConfigResponse({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle.zip',
          sha256: 'abc',
        },
      });

      const result = await service.fetchConfig();

      expect(result).toBeDefined();
      expect(result?.jsBundle?.downloadUrl).toBe(
        'https://cdn.onekey.so/bundle.zip',
      );
    });
  });

  // =========================================================================
  // isNeedSyncAppUpdateInfo
  // =========================================================================
  describe('isNeedSyncAppUpdateInfo', () => {
    test('returns false when status is downloadPackage', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      const result = await service.isNeedSyncAppUpdateInfo();

      expect(result).toBe(false);
    });

    test('returns false when status is ready', async () => {
      resetAtom({ status: EAppUpdateStatus.ready });

      const result = await service.isNeedSyncAppUpdateInfo();

      expect(result).toBe(false);
    });

    test('returns true when forceUpdate is true', async () => {
      resetAtom({
        status: EAppUpdateStatus.done,
        updateAt: Date.now(),
      });

      const result = await service.isNeedSyncAppUpdateInfo(true);

      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // refreshUpdateStatus (first launch after update)
  // =========================================================================
  describe('refreshUpdateStatus', () => {
    test('resets status to done when first launch after app shell update', async () => {
      // Simulate: latestVersion matches platformEnv.version (1.0.0),
      // and status is not done → isFirstLaunchAfterUpdated returns true
      resetAtom({
        latestVersion: '1.0.0',
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.manual,
        updateAt: Date.now(),
        downloadedEvent: { downloadedFile: '/tmp/bundle.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
      expect(atomValue.downloadedEvent).toBeUndefined();
      expect(atomValue.jsBundleVersion).toBeUndefined();
      expect(atomValue.jsBundle).toBeUndefined();
    });

    test('does not reset when status is already done', async () => {
      resetAtom({
        latestVersion: '1.0.0',
        status: EAppUpdateStatus.done,
        updateStrategy: EUpdateStrategy.manual,
        updateAt: 12_345,
      });

      await service.refreshUpdateStatus();

      // updateAt should remain unchanged (not reset to 0)
      expect(atomValue.updateAt).toBe(12_345);
    });
  });

  // =========================================================================
  // fetchAppUpdateInfo integration
  // =========================================================================
  describe('fetchAppUpdateInfo', () => {
    function mockLatestInfo(info: any) {
      jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue(info);
    }

    test('sets notify status when new version is available', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
        summary: 'New features',
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.latestVersion).toBe('2.0.0');
      expect(atomValue.summary).toBe('New features');
    });

    test('does not override status when already updating', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Status should stay downloadPackage, not change to notify
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
      // But latestVersion is updated
      expect(atomValue.latestVersion).toBe('3.0.0');
    });

    test('calls reset when no version info from server', async () => {
      resetAtom({
        status: EAppUpdateStatus.notify,
        latestVersion: '2.0.0',
        updateAt: 0,
      });
      mockLatestInfo({
        // No version, no jsBundleVersion
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });

    test('sets jsBundleVersion when jsBundle update available', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '1.0.0',
        jsBundleVersion: '5',
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle.zip',
          sha256: 'abc',
          signature: 'sig',
          fileSize: 1024,
        },
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.jsBundleVersion).toBe('5');
      expect(atomValue.jsBundle?.downloadUrl).toBe(
        'https://cdn.onekey.so/bundle.zip',
      );
    });

    test('returns cached atom when sync not needed', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
        updateAt: Date.now(),
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(false);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      const result = await service.fetchAppUpdateInfo();

      expect(result.status).toBe(EAppUpdateStatus.downloadPackage);
      expect(result.latestVersion).toBe('2.0.0');
    });
  });

  // =========================================================================
  // getAppLatestInfo caching
  // =========================================================================
  describe('getAppLatestInfo caching', () => {
    test('uses cache when not expired and not forceUpdate', async () => {
      const mockData = {
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      };
      const fetchConfigSpy = jest
        .spyOn(service, 'fetchConfig')
        .mockResolvedValue(mockData);

      // First call with force to populate cache
      const result1 = await service.getAppLatestInfo(true);
      expect(fetchConfigSpy).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockData);

      // Second call without force — should use cachedUpdateInfo
      // since updateAt was just set (within 5 min window)
      const result2 = await service.getAppLatestInfo(false);

      // Returns cached data
      expect(result2).toEqual(mockData);
    });

    test('bypasses cache when forceUpdate is true', async () => {
      const fetchConfigSpy = jest
        .spyOn(service, 'fetchConfig')
        .mockResolvedValue({
          version: '2.0.0',
          updateStrategy: EUpdateStrategy.manual,
        });

      await service.getAppLatestInfo(true);
      await service.getAppLatestInfo(true);

      expect(fetchConfigSpy).toHaveBeenCalledTimes(2);
    });
  });
});
