/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
// ServiceAppUpdate state transition tests
// Tests the state machine that drives bundle/app updates:
//   notify → downloadPackage → downloadASC → verifyASC → verifyPackage → ready → done
// Native functions (BundleUpdate/AppUpdate) are mocked — they have their own tests.
//
// yarn jest packages/kit-bg/src/services/ServiceAppUpdate.test.ts

import {
  EAppUpdateStatus,
  EPendingInstallTaskAction,
  EPendingInstallTaskStatus,
  EPendingInstallTaskType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

// ---------------------------------------------------------------------------
// In-memory atom mock — replaces appUpdatePersistAtom with a synchronous store
// so we can test ServiceAppUpdate without Jotai infrastructure.
// ---------------------------------------------------------------------------

const INITIAL_APP_UPDATE_VALUE: IAppUpdateInfo = {
  latestVersion: '0.0.0',
  updateAt: 0,
  status: EAppUpdateStatus.done,
  updateStrategy: EUpdateStrategy.manual,
  lastUpdateDialogShownAt: undefined,
};

let atomValue: IAppUpdateInfo = { ...INITIAL_APP_UPDATE_VALUE };
let pendingInstallTaskValue: any;

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

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
    set: jest.fn(),
  },
}));

const appStorageMock = {
  syncStorage: {
    getObject: jest.fn(async () => pendingInstallTaskValue),
    setObject: jest.fn(async (_key: string, task: any) => {
      pendingInstallTaskValue = task;
      return pendingInstallTaskValue;
    }),
    delete: jest.fn(async () => {
      pendingInstallTaskValue = undefined;
    }),
  },
};

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: appStorageMock,
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
    clearDownload: jest.fn(async () => undefined),
    resetToBuiltInBundle: jest.fn(async () => undefined),
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
    getBuiltinBundleVersion: jest.fn(async () => ''),
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
        log: jest.fn(),
        appUpdateFetchStart: jest.fn(),
        appUpdateFetchResult: jest.fn(),
        appUpdateDecisionResolved: jest.fn(),
        pendingTaskUpsertDecision: jest.fn(),
      },
      jsBundleDev: {
        fetchBundleVersions: jest.fn(),
        fetchBundleVersionsError: jest.fn(),
        fetchBundles: jest.fn(),
        fetchBundlesError: jest.fn(),
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
    getBasicClient: jest.fn(async () => ({
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
  const mod = require('./ServiceAppUpdate');
  mod.resetFailedRecoveryRetryCount();
  const ServiceAppUpdate = mod.default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ServicePendingInstallTask } = require('./servicePendingInstallTask');
  const backgroundApi = {
    serviceApp: {
      resetLaunchTimesAfterUpdate: jest.fn(async () => undefined),
    },
  } as any;
  backgroundApi.servicePendingInstallTask = new ServicePendingInstallTask({
    backgroundApi,
    refreshUpdateStatus: jest.fn(async () => undefined),
  });
  return new ServiceAppUpdate({
    backgroundApi,
  });
}

function resetAtom(overrides?: Partial<IAppUpdateInfo>) {
  atomValue = { ...INITIAL_APP_UPDATE_VALUE, ...overrides };
}

function resetPendingTask(value: any = undefined) {
  pendingInstallTaskValue = value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceAppUpdate state transitions', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
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

  describe('dev bundle switcher endpoint', () => {
    test('devFetchBundleVersions always uses test utility endpoint', async () => {
      await service.devFetchBundleVersions();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        appApiClient,
      } = require('@onekeyhq/shared/src/appApiClient/appApiClient');

      expect(appApiClient.getBasicClient).toHaveBeenCalledWith({
        name: EServiceEndpointEnum.Utility,
        endpoint: buildServiceEndpoint({
          serviceName: EServiceEndpointEnum.Utility,
          env: 'test',
        }),
      });
    });

    test('devFetchBundlesForVersion always uses test utility endpoint', async () => {
      await service.devFetchBundlesForVersion('7.6.0');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        appApiClient,
      } = require('@onekeyhq/shared/src/appApiClient/appApiClient');

      expect(appApiClient.getBasicClient).toHaveBeenCalledWith({
        name: EServiceEndpointEnum.Utility,
        endpoint: buildServiceEndpoint({
          serviceName: EServiceEndpointEnum.Utility,
          env: 'test',
        }),
      });
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

    test('downloadASCFailed with no message defaults to network instability', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadASC });

      await service.downloadASCFailed();
      await Promise.resolve();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_network_instability_check_connection,
      );
    });

    test('downloadASCFailed maps HTTP 403 to server error', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadASC });

      await service.downloadASCFailed({ message: '403' });
      await Promise.resolve();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_server_not_responding_try_later,
      );
    });
  });

  // =========================================================================
  // Android-specific error mapping
  // =========================================================================
  describe('Android-specific error mapping', () => {
    let platformEnvMock: any;

    beforeEach(() => {
      resetPendingTask();
      platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
      platformEnvMock.isNativeAndroid = true;
    });

    afterEach(() => {
      platformEnvMock.isNativeAndroid = false;
    });

    test('verifyASCFailed remaps Android native error string to translation key', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyASC });

      await service.verifyASCFailed({
        message: 'UPDATE_SIGNATURE_VERIFICATION_FAILED_ALERT_TEXT',
      });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASCFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_signature_verification_failed_alert_text,
      );
    });

    test('verifyASCFailed preserves non-matching error on Android', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyASC });

      await service.verifyASCFailed({ message: 'Some other error' });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASCFailed);
      expect(atomValue.errorText).toBe('Some other error');
    });

    test('verifyPackageFailed maps PACKAGE_NAME_MISMATCH on Android', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyPackage });

      await service.verifyPackageFailed({ message: 'PACKAGE_NAME_MISMATCH' });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_package_name_mismatch,
      );
    });

    test('verifyPackageFailed maps UPDATE_INSTALLATION_NOT_SAFE_ALERT_TEXT on Android', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyPackage });

      await service.verifyPackageFailed({
        message: 'UPDATE_INSTALLATION_NOT_SAFE_ALERT_TEXT',
      });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_installation_not_safe_alert_text,
      );
    });

    test('verifyPackageFailed preserves non-matching error on Android', async () => {
      resetAtom({ status: EAppUpdateStatus.verifyPackage });

      await service.verifyPackageFailed({ message: 'Unknown package error' });

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackageFailed);
      expect(atomValue.errorText).toBe('Unknown package error');
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
      await service.downloadASC();
      await service.verifyASC();
      // Move to verifyPackage before timeout
      await service.verifyPackage();

      // Advance past 30 min — should NOT trigger downloadPackageFailed
      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
    });

    test('readyToInstall clears download timeout', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      await service.downloadPackage();
      await service.downloadASC();
      await service.verifyASC();
      await service.verifyPackage();
      await service.readyToInstall();

      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });

    test('second downloadPackage call resets the 30-minute timeout', async () => {
      resetAtom({ status: EAppUpdateStatus.notify });

      await service.downloadPackage();

      // Advance 20 minutes (less than 30)
      await jest.advanceTimersByTimeAsync(20 * 60 * 1000);
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);

      // Second call resets timeout
      await service.downloadPackage();

      // 20 more minutes (40 from first, 20 from second)
      await jest.advanceTimersByTimeAsync(20 * 60 * 1000);
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);

      // 11 more minutes (31 from second call) — timeout fires
      await jest.advanceTimersByTimeAsync(11 * 60 * 1000);
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
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

      // Empty string is rejected — original URL must be preserved
      expect(atomValue.downloadedEvent?.downloadUrl).toBe(
        'https://original.com/bundle.zip',
      );
    });

    test('rejects javascript: protocol URL', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: { downloadedFile: '/tmp/old.zip' },
      });

      // eslint-disable-next-line no-script-url
      await service.updateDownloadUrl('javascript:alert(1)');

      expect(atomValue.downloadedEvent?.downloadUrl).toBeUndefined();
    });

    test('rejects ftp: protocol URL', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: { downloadedFile: '/tmp/old.zip' },
      });

      await service.updateDownloadUrl('ftp://files.example.com/bundle.zip');

      expect(atomValue.downloadedEvent?.downloadUrl).toBeUndefined();
    });

    test('rejects data: URI scheme', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        downloadedEvent: { downloadedFile: '/tmp/old.zip' },
      });

      await service.updateDownloadUrl(
        'data:text/html,<script>alert(1)</script>',
      );

      expect(atomValue.downloadedEvent?.downloadUrl).toBeUndefined();
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
      expect(BundleUpdate.clearDownload).toHaveBeenCalled();
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
    test('allows sync during downloadPackage (metadata stays fresh)', async () => {
      resetAtom({ status: EAppUpdateStatus.downloadPackage });

      const result = await service.isNeedSyncAppUpdateInfo();

      // Sync is no longer blocked — metadata is kept up-to-date
      // while the second layer (isUpdating) prevents status change
      expect(result).toBe(true);
    });

    test('allows sync during ready (metadata stays fresh)', async () => {
      resetAtom({ status: EAppUpdateStatus.ready });

      const result = await service.isNeedSyncAppUpdateInfo();

      expect(result).toBe(true);
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
  // isNeedSyncAppUpdateInfo — detailed time and platform behavior
  // =========================================================================
  describe('isNeedSyncAppUpdateInfo detailed behavior', () => {
    // Helper: consume the module-level firstLaunch flag so we test pure logic
    async function consumeFirstLaunch(svc: any) {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: Date.now() });
      await svc.isNeedSyncAppUpdateInfo();
    }

    test('firstLaunch flag returns true regardless of recent updateAt', async () => {
      jest.resetModules();
      const freshService = createService();
      resetAtom({
        status: EAppUpdateStatus.done,
        updateAt: Date.now(), // recent — would normally NOT need sync
      });

      const result = await freshService.isNeedSyncAppUpdateInfo();

      expect(result).toBe(true);
    });

    test('after firstLaunch consumed, recent updateAt returns false', async () => {
      jest.resetModules();
      const freshService = createService();
      await consumeFirstLaunch(freshService);

      resetAtom({ status: EAppUpdateStatus.done, updateAt: Date.now() });
      const result = await freshService.isNeedSyncAppUpdateInfo();

      expect(result).toBe(false);
    });

    test('returns true when updateAt exceeds 1 hour', async () => {
      jest.resetModules();
      const freshService = createService();
      await consumeFirstLaunch(freshService);

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      resetAtom({ status: EAppUpdateStatus.done, updateAt: twoHoursAgo });

      const result = await freshService.isNeedSyncAppUpdateInfo();

      expect(result).toBe(true);
    });

    test('returns false when updateAt is within 1 hour', async () => {
      jest.resetModules();
      const freshService = createService();
      await consumeFirstLaunch(freshService);

      const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
      resetAtom({ status: EAppUpdateStatus.done, updateAt: thirtyMinAgo });

      const result = await freshService.isNeedSyncAppUpdateInfo();

      expect(result).toBe(false);
    });

    test('Extension platform uses 24-hour window instead of 1-hour', async () => {
      jest.resetModules();
      const freshService = createService();
      const pEnv = require('@onekeyhq/shared/src/platformEnv').default;
      pEnv.isExtension = true;
      await consumeFirstLaunch(freshService);

      // 2 hours ago — within 24h extension window → false
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      resetAtom({ status: EAppUpdateStatus.done, updateAt: twoHoursAgo });
      const result1 = await freshService.isNeedSyncAppUpdateInfo();
      expect(result1).toBe(false);

      // 25 hours ago — exceeds 24h extension window → true
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      resetAtom({
        status: EAppUpdateStatus.done,
        updateAt: twentyFiveHoursAgo,
      });
      const result2 = await freshService.isNeedSyncAppUpdateInfo();
      expect(result2).toBe(true);

      pEnv.isExtension = false;
    });

    test('no status blocks sync — all statuses allow metadata refresh', async () => {
      jest.resetModules();
      const freshService = createService();
      await consumeFirstLaunch(freshService);

      const allStatuses = [
        EAppUpdateStatus.done,
        EAppUpdateStatus.notify,
        EAppUpdateStatus.downloadPackage,
        EAppUpdateStatus.downloadPackageFailed,
        EAppUpdateStatus.downloadASC,
        EAppUpdateStatus.downloadASCFailed,
        EAppUpdateStatus.verifyASC,
        EAppUpdateStatus.verifyASCFailed,
        EAppUpdateStatus.verifyPackage,
        EAppUpdateStatus.verifyPackageFailed,
        EAppUpdateStatus.ready,
        EAppUpdateStatus.failed,
        EAppUpdateStatus.manualInstall,
        EAppUpdateStatus.updateIncomplete,
      ];

      for (const status of allStatuses) {
        resetAtom({ status, updateAt: 0 }); // old updateAt → exceeds 1hr
        const result = await freshService.isNeedSyncAppUpdateInfo();
        expect(result).toBe(true);
      }
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

    test('does not reset when no version info from server', async () => {
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
      const resetSpy = jest.spyOn(service, 'reset');

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(resetSpy).not.toHaveBeenCalled();
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

    test('keeps failed status when server version is same as attempted', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
        errorText: ETranslations.update_network_exception_check_connection,
        updateAt: 0,
      });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Same version — user should retry, not re-notify
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.latestVersion).toBe('2.0.0');
    });

    test('resets failed status to notify when server has newer version', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASCFailed,
        latestVersion: '2.0.0',
        errorText:
          ETranslations.update_signature_verification_failed_alert_text,
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Newer version available — reset to notify
      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.errorText).toBeUndefined();
    });

    test('clears downloadedEvent when resetting verify failure to notify (verifyASCFailed)', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASCFailed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/corrupted.zip' },
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('clears downloadedEvent when resetting verify failure to notify (verifyPackageFailed)', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackageFailed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/tampered.zip' },
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('preserves downloadedEvent when resetting download failure to notify', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/partial.zip' },
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent?.downloadedFile).toBe(
        '/tmp/partial.zip',
      );
    });

    test('resets failed (install failure) status to notify when server has newer version', async () => {
      resetAtom({
        status: EAppUpdateStatus.failed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/installed.zip' },
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.errorText).toBeUndefined();
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('resets updateIncomplete status to notify when server has newer version', async () => {
      resetAtom({
        status: EAppUpdateStatus.updateIncomplete,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/incomplete.zip' },
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.errorText).toBeUndefined();
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('failed status with same version does NOT reset', async () => {
      resetAtom({
        status: EAppUpdateStatus.failed,
        latestVersion: '2.0.0',
        updateAt: 0,
      });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.failed);
    });

    test('stores force updateStrategy from server response', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.force,
        summary: 'Critical security fix',
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.updateStrategy).toBe(EUpdateStrategy.force);
      expect(atomValue.summary).toBe('Critical security fix');
    });

    test('sets previousAppVersion when transitioning to notify from done', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.previousAppVersion).toBe('1.0.0'); // from platformEnv mock
    });

    test('does not set previousAppVersion when already updating', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        previousAppVersion: '0.9.0',
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // previousAppVersion preserved from prior state
      expect(atomValue.previousAppVersion).toBe('0.9.0');
    });

    // -----------------------------------------------------------------------
    // Package vs jsBundle update path differentiation
    // -----------------------------------------------------------------------
    test('package-only update: sets notify with new version, no jsBundle fields', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
        summary: 'App shell update',
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.latestVersion).toBe('2.0.0');
      expect(atomValue.jsBundleVersion).toBeUndefined();
      expect(atomValue.jsBundle).toBeUndefined();
    });

    test('jsBundle-only update: same app version, higher bundleVersion', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '1.0.0', // same as installed (platformEnv.version)
        jsBundleVersion: '5', // higher than installed bundleVersion '1'
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle-v5.zip',
          sha256: 'abc',
          fileSize: 2048,
        },
        updateStrategy: EUpdateStrategy.silent,
        summary: 'Hot fix via jsBundle',
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.latestVersion).toBe('1.0.0');
      expect(atomValue.jsBundleVersion).toBe('5');
      expect(atomValue.jsBundle?.downloadUrl).toBe(
        'https://cdn.onekey.so/bundle-v5.zip',
      );
      expect(atomValue.updateStrategy).toBe(EUpdateStrategy.silent);
    });

    test('jsBundle update clears stale storeUrl and downloadUrl from previous config', async () => {
      resetAtom({
        status: EAppUpdateStatus.done,
        updateAt: 0,
        latestVersion: '9005.19.0',
        storeUrl: 'https://apps.apple.com/app/id1609559473',
        downloadUrl: 'https://old.onekey.so/app.ipa',
      });
      mockLatestInfo({
        version: '1.0.0',
        jsBundleVersion: '5',
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle-v5.zip',
          sha256: 'abc',
          fileSize: 2048,
        },
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.storeUrl).toBeUndefined();
      expect(atomValue.downloadUrl).toBeUndefined();
      expect(atomValue.jsBundle?.downloadUrl).toBe(
        'https://cdn.onekey.so/bundle-v5.zip',
      );
    });

    test('simultaneous version + jsBundle update: both fields stored', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '2.0.0',
        jsBundleVersion: '3',
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle-v3.zip',
          sha256: 'def',
          fileSize: 4096,
        },
        updateStrategy: EUpdateStrategy.force,
        summary: 'Major update with bundle',
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.latestVersion).toBe('2.0.0');
      expect(atomValue.jsBundleVersion).toBe('3');
      expect(atomValue.jsBundle?.downloadUrl).toBe(
        'https://cdn.onekey.so/bundle-v3.zip',
      );
      expect(atomValue.updateStrategy).toBe(EUpdateStrategy.force);
    });

    test('jsBundle same version as installed: no update', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      mockLatestInfo({
        version: '1.0.0', // same as installed
        jsBundleVersion: '1', // same as installed bundleVersion
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // gtVersion returns false → shouldUpdate=false → status stays done
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });

    test('skips fetch when pending install task has not executed yet (status=pending)', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      resetPendingTask({
        taskId: 'task-v101',
        revision: 1,
        action: EPendingInstallTaskAction.switchBundle,
        type: EPendingInstallTaskType.jsBundleSwitch,
        targetAppVersion: '1.0.0',
        targetBundleVersion: '101',
        scheduledEnvAppVersion: '1.0.0',
        scheduledEnvBundleVersion: '1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86_400_000,
        retryCount: 0,
        status: EPendingInstallTaskStatus.pending,
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '101',
          signature: 'sig',
        },
      });
      const mockLatest = jest.spyOn(service, 'getAppLatestInfo');

      await service.fetchAppUpdateInfo(true);

      // Should NOT have called getAppLatestInfo — fetch was skipped
      expect(mockLatest).not.toHaveBeenCalled();
      // Atom should remain unchanged
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });

    test('skips fetch when pending install task is running', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      resetPendingTask({
        taskId: 'task-v101',
        revision: 1,
        action: EPendingInstallTaskAction.switchBundle,
        type: EPendingInstallTaskType.jsBundleSwitch,
        targetAppVersion: '1.0.0',
        targetBundleVersion: '101',
        scheduledEnvAppVersion: '1.0.0',
        scheduledEnvBundleVersion: '1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86_400_000,
        retryCount: 0,
        status: EPendingInstallTaskStatus.running,
        runningStartedAt: Date.now(),
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '101',
          signature: 'sig',
        },
      });
      const mockLatest = jest.spyOn(service, 'getAppLatestInfo');

      await service.fetchAppUpdateInfo(true);

      expect(mockLatest).not.toHaveBeenCalled();
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });

    test('does NOT skip fetch when pending task status is failed', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      resetPendingTask({
        taskId: 'task-v101',
        revision: 1,
        action: EPendingInstallTaskAction.switchBundle,
        type: EPendingInstallTaskType.jsBundleSwitch,
        targetAppVersion: '1.0.0',
        targetBundleVersion: '101',
        scheduledEnvAppVersion: '1.0.0',
        scheduledEnvBundleVersion: '1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86_400_000,
        retryCount: 3,
        status: EPendingInstallTaskStatus.failed,
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '101',
          signature: 'sig',
        },
      });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Failed task should NOT block fetch — allow recovery with newer version
      expect(atomValue.latestVersion).toBe('2.0.0');
    });

    test('does NOT skip fetch when no pending task exists', async () => {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: 0 });
      resetPendingTask(undefined);
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.latestVersion).toBe('2.0.0');
    });

    test('blockedByControl=true prevents transition to notify', async () => {
      resetAtom({
        status: EAppUpdateStatus.done,
        updateAt: 0,
        freezeUntil: Date.now() + 60_000,
        ignoredTargets: {
          '2.0.0:0': {
            reason: 'RETRY_EXHAUSTED',
            createdAt: Date.now() - 1000,
            expiresAt: Date.now() + 60_000,
          },
        },
      });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.seamless,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Frozen/ignored target blocks shouldUpdate → status stays done
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
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

  // =========================================================================
  // TDD: Version discovery improvements
  // These tests describe DESIRED behavior and will FAIL until implemented.
  // =========================================================================

  // -------------------------------------------------------------------------
  // P1: Remove sync blocking during downloadPackage / ready
  // Rationale: metadata should always stay fresh; the second layer
  // (isUpdating guard in fetchAppUpdateInfo) already prevents status change.
  // -------------------------------------------------------------------------
  describe('P1: allow sync during active update states', () => {
    async function consumeFirstLaunch(svc: any) {
      resetAtom({ status: EAppUpdateStatus.done, updateAt: Date.now() });
      await svc.isNeedSyncAppUpdateInfo();
    }

    test('isNeedSyncAppUpdateInfo returns true during downloadPackage when time window exceeded', async () => {
      jest.resetModules();
      const freshService = createService();
      await consumeFirstLaunch(freshService);

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        updateAt: twoHoursAgo,
      });

      const result = await freshService.isNeedSyncAppUpdateInfo();

      expect(result).toBe(true);
    });

    test('isNeedSyncAppUpdateInfo returns true during ready when time window exceeded', async () => {
      jest.resetModules();
      const freshService = createService();
      await consumeFirstLaunch(freshService);

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      resetAtom({
        status: EAppUpdateStatus.ready,
        updateAt: twoHoursAgo,
      });

      const result = await freshService.isNeedSyncAppUpdateInfo();

      expect(result).toBe(true);
    });

    test('metadata is updated during downloadPackage without changing status', async () => {
      function mockLatestInfo(info: any) {
        jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue(info);
      }

      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
        updateAt: 0,
      });
      mockLatestInfo({
        version: '3.0.0',
        updateStrategy: EUpdateStrategy.force,
        summary: 'Critical security fix',
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Status preserved — download continues
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
      // But latest info is silently updated for later use
      expect(atomValue.latestVersion).toBe('3.0.0');
      expect(atomValue.updateStrategy).toBe(EUpdateStrategy.force);
    });
  });

  // -------------------------------------------------------------------------
  // P0: Failed state auto-recovery when a newer version is available
  // Rationale: no point retrying v2.0.0 download when v3.0.0 exists.
  // -------------------------------------------------------------------------
  describe('P0: failed state recovery to newer version', () => {
    function mockLatestInfo(info: any) {
      jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue(info);
    }

    const FAILED_STATUSES = [
      EAppUpdateStatus.downloadPackageFailed,
      EAppUpdateStatus.downloadASCFailed,
      EAppUpdateStatus.verifyASCFailed,
      EAppUpdateStatus.verifyPackageFailed,
      EAppUpdateStatus.failed,
      EAppUpdateStatus.updateIncomplete,
    ] as const;

    test.each(FAILED_STATUSES)(
      'resets %s to notify when server has newer app version',
      async (failedStatus) => {
        resetAtom({
          status: failedStatus,
          latestVersion: '2.0.0',
          errorText: ETranslations.update_network_exception_check_connection,
          updateAt: 0,
        });
        mockLatestInfo({
          version: '3.0.0',
          updateStrategy: EUpdateStrategy.manual,
        });
        jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
        jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

        await service.fetchAppUpdateInfo(true);

        expect(atomValue.status).toBe(EAppUpdateStatus.notify);
        expect(atomValue.latestVersion).toBe('3.0.0');
        expect(atomValue.errorText).toBeUndefined();
      },
    );

    test('resets failed status to notify when server has newer jsBundle version', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        errorText: ETranslations.update_network_exception_check_connection,
        updateAt: 0,
      });
      mockLatestInfo({
        version: '1.0.0',
        jsBundleVersion: '6',
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle-v6.zip',
          sha256: 'newsha',
        },
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.jsBundleVersion).toBe('6');
      expect(atomValue.errorText).toBeUndefined();
    });

    test('keeps failed status when server app version is same (user should retry)', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
        errorText: ETranslations.update_network_exception_check_connection,
        updateAt: 0,
      });
      mockLatestInfo({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Same version — keep failed, user can retry
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
      expect(atomValue.errorText).toBe(
        ETranslations.update_network_exception_check_connection,
      );
    });

    test('keeps failed status when server jsBundle version is same (user should retry)', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '1.0.0',
        jsBundleVersion: '5',
        errorText: ETranslations.update_network_exception_check_connection,
        updateAt: 0,
      });
      mockLatestInfo({
        version: '1.0.0',
        jsBundleVersion: '5',
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle-v5.zip',
          sha256: 'same',
        },
        updateStrategy: EUpdateStrategy.manual,
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.fetchAppUpdateInfo(true);

      // Same jsBundle version — keep failed, user can retry
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
    });

    test('keeps in-progress status even when server has newer version', async () => {
      // downloadPackage (in-progress) should NOT be reset — download is active
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

      // Active download must NOT be interrupted
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
    });
  });

  // -------------------------------------------------------------------------
  // P0: Immediate update check after installation completes
  // Rationale: after jsBundle hot-reload install, discover v3.0.0 immediately
  // instead of waiting 1–1.5 hours for the next sync cycle.
  // -------------------------------------------------------------------------
  describe('P0: immediate check after installation', () => {
    test('reset schedules an immediate update check', async () => {
      const fetchSpy = jest
        .spyOn(service, 'fetchAppUpdateInfo')
        .mockResolvedValue(atomValue);

      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
      });

      await service.reset();

      // Should schedule a check within a short delay
      await jest.advanceTimersByTimeAsync(100);

      expect(fetchSpy).toHaveBeenCalled();
    });

    test('immediate check after reset discovers newer version', async () => {
      // Simulate: installed v2.0.0, server already has v3.0.0
      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
      });

      // Mock fetchConfig to return v3.0.0
      const mockClient = {
        get: jest.fn(async () => ({
          data: {
            code: 0,
            data: {
              version: '3.0.0',
              updateStrategy: EUpdateStrategy.manual,
              summary: 'Even newer release',
            },
          },
        })),
      };
      jest.spyOn(service, 'getClient').mockResolvedValue(mockClient as any);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      await service.reset();

      // Wait for the scheduled check
      await jest.advanceTimersByTimeAsync(100);

      // After reset + immediate check, should discover v3.0.0
      // (the exact atom state depends on fetchAppUpdateInfo flow,
      // but fetchAppUpdateInfo should have been called)
      expect(mockClient.get).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refreshUpdateStatus: reset failed states on app launch / foreground
  // -------------------------------------------------------------------------
  describe('refreshUpdateStatus: failed state recovery on launch', () => {
    const FAILED_STATUSES = [
      EAppUpdateStatus.downloadPackageFailed,
      EAppUpdateStatus.downloadASCFailed,
      EAppUpdateStatus.verifyASCFailed,
      EAppUpdateStatus.verifyPackageFailed,
      EAppUpdateStatus.failed,
      EAppUpdateStatus.updateIncomplete,
    ] as const;

    test.each(FAILED_STATUSES)(
      'resets %s to notify on launch, preserving version info',
      async (failedStatus) => {
        resetAtom({
          status: failedStatus,
          latestVersion: '2.0.0',
          errorText: ETranslations.update_network_exception_check_connection,
          updateStrategy: EUpdateStrategy.force,
          summary: 'Important update',
          updateAt: 12_345,
        });

        await service.refreshUpdateStatus();

        expect(atomValue.status).toBe(EAppUpdateStatus.notify);
        expect(atomValue.errorText).toBeUndefined();
        // version info preserved
        expect(atomValue.latestVersion).toBe('2.0.0');
        expect(atomValue.updateStrategy).toBe(EUpdateStrategy.force);
        expect(atomValue.summary).toBe('Important update');
      },
    );

    test('clears downloadedEvent for verifyASCFailed (corrupted package)', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASCFailed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/corrupted.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('clears downloadedEvent for verifyPackageFailed (corrupted package)', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackageFailed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/bad.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('clears downloadedEvent for failed (install failure)', async () => {
      resetAtom({
        status: EAppUpdateStatus.failed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/failed-install.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('clears downloadedEvent for updateIncomplete', async () => {
      resetAtom({
        status: EAppUpdateStatus.updateIncomplete,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/incomplete.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('preserves downloadedEvent for download failures (partial data may be reusable)', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/partial.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toEqual({
        downloadedFile: '/tmp/partial.zip',
      });
    });

    test('isFirstLaunchAfterUpdated takes priority over failed reset', async () => {
      // latestVersion=1.0.0 matches platformEnv.version → isFirstLaunchAfterUpdated=true
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '1.0.0',
        updateAt: 12_345,
      });

      await service.refreshUpdateStatus();

      // isFirstLaunchAfterUpdated resets to done, takes priority
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });

    test('does not reset in-progress or other non-failed statuses', async () => {
      const nonFailedStatuses = [
        EAppUpdateStatus.downloadPackage,
        EAppUpdateStatus.downloadASC,
        EAppUpdateStatus.verifyASC,
        EAppUpdateStatus.verifyPackage,
        EAppUpdateStatus.ready,
        EAppUpdateStatus.notify,
      ];

      for (const status of nonFailedStatuses) {
        resetAtom({ status, latestVersion: '2.0.0' });
        await service.refreshUpdateStatus();
        expect(atomValue.status).toBe(status);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Failed state idle recovery: auto-reset to notify after 2 hours
  // -------------------------------------------------------------------------
  describe('failed state idle recovery timer (2 hours)', () => {
    test('downloadPackageFailed auto-recovers to notify after 2 hours', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();
      await service.downloadPackageFailed({ message: 'Network error' });
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);

      await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.errorText).toBeUndefined();
    });

    test('verifyASCFailed auto-recovers and clears downloadedEvent', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/file.zip' },
      });

      await service.verifyASCFailed({ message: 'Bad signature' });
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASCFailed);

      await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('verifyPackageFailed auto-recovers and clears downloadedEvent', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/bad.zip' },
      });

      await service.verifyPackageFailed({ message: 'Corrupted' });

      await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('downloadASCFailed auto-recovers after 2 hours', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
      });

      await service.downloadASCFailed({ message: 'timeout' });
      await Promise.resolve();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASCFailed);

      await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
      expect(atomValue.errorText).toBeUndefined();
    });

    test('does not auto-recover before 2 hours', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();
      await service.downloadPackageFailed({ message: 'error' });

      // 1 hour 59 minutes — not yet
      await jest.advanceTimersByTimeAsync(119 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
    });

    test('manual retry (downloadPackage) cancels recovery timer', async () => {
      jest.spyOn(service, 'fetchAppUpdateInfo').mockResolvedValue(atomValue);

      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });
      await service.downloadPackage();
      await service.downloadPackageFailed({ message: 'error' });

      // User retries and succeeds — walk through full state chain
      await service.downloadPackage();
      await service.downloadASC();
      await service.verifyASC();
      await service.verifyPackage();
      await service.readyToInstall();
      expect(atomValue.status).toBe(EAppUpdateStatus.ready);

      // Well past the 2-hour mark
      await jest.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);

      // Recovery timer was cancelled — status unchanged
      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });

    test('reset cancels recovery timer', async () => {
      jest.spyOn(service, 'fetchAppUpdateInfo').mockResolvedValue(atomValue);

      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });
      await service.downloadPackage();
      await service.downloadPackageFailed({ message: 'error' });

      await service.reset();
      expect(atomValue.status).toBe(EAppUpdateStatus.done);

      await jest.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
    });

    test('second failure resets the 2-hour timer', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();
      await service.downloadPackageFailed({ message: 'first error' });

      // 1.5 hours — first timer not yet fired
      await jest.advanceTimersByTimeAsync(90 * 60 * 1000);
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);

      // Retry and fail again — restarts the 2-hour timer
      await service.downloadPackage();
      await service.downloadPackageFailed({ message: 'second error' });

      // 1.5 hours from second failure (3h from first)
      await jest.advanceTimersByTimeAsync(90 * 60 * 1000);
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);

      // 30 more minutes — 2h from second failure
      await jest.advanceTimersByTimeAsync(30 * 60 * 1000);
      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    });
  });

  // -------------------------------------------------------------------------
  // State transition guards: prevent illegal regressions
  // -------------------------------------------------------------------------
  describe('state transition guards', () => {
    // downloadPackage should only be callable from valid entry states
    // (notify, done, or failed states). NOT from later in-progress states.
    test('downloadPackage is rejected when status is verifyPackage', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/verified.zip' },
      });

      await service.downloadPackage();

      // Should NOT regress — status and downloadedEvent preserved
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
      expect(atomValue.downloadedEvent?.downloadedFile).toBe(
        '/tmp/verified.zip',
      );
    });

    test('downloadPackage is rejected when status is ready', async () => {
      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        downloadedEvent: { downloadedFile: '/tmp/ready.zip' },
      });

      await service.downloadPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
      expect(atomValue.downloadedEvent?.downloadedFile).toBe('/tmp/ready.zip');
    });

    test('downloadPackage is rejected when status is downloadASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
      });

      await service.downloadPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
    });

    test('downloadPackage is rejected when status is verifyASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });

      await service.downloadPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    test('downloadPackage is allowed from notify', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();

      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
    });

    test('downloadPackage is allowed from failed states', async () => {
      for (const failedStatus of [
        EAppUpdateStatus.downloadPackageFailed,
        EAppUpdateStatus.downloadASCFailed,
        EAppUpdateStatus.verifyASCFailed,
        EAppUpdateStatus.verifyPackageFailed,
      ]) {
        resetAtom({ status: failedStatus, latestVersion: '2.0.0' });

        await service.downloadPackage();

        expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
      }
    });

    // 30-min download timeout must not fire during verification stages
    test('download timeout does not regress status from downloadASC', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);

      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);

      // 30 minutes pass — download timeout fires
      await jest.advanceTimersByTimeAsync(30 * 60 * 1000);

      // Should NOT regress to downloadPackageFailed
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
    });

    test('download timeout does not regress status from verifyASC', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();
      await service.downloadASC();
      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);

      // 30 minutes pass
      await jest.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    // downloadPackageFailed should only apply when still in downloadPackage
    test('downloadPackageFailed is ignored when status has progressed past download', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      await service.downloadPackage();
      await service.downloadASC();
      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);

      // Late/stale call to downloadPackageFailed
      await service.downloadPackageFailed({ message: 'stale timeout' });

      // Should be ignored — status preserved
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    // --- Forward-only guards for intermediate methods ---
    // Each method should only be callable from its predecessor state.

    test('downloadASC is rejected when status is notify', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });
      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    });

    test('downloadASC is rejected from failed states', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackageFailed,
        latestVersion: '2.0.0',
      });
      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
    });

    test('downloadASC is allowed from downloadPackage', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
      });
      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
    });

    test('downloadASC allows re-entry from downloadASC (resume after restart)', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
      });
      mockAtom.set.mockClear();
      await service.downloadASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
      // Must actually call set (not just silently return)
      expect(mockAtom.set).toHaveBeenCalled();
    });

    test('verifyASC is rejected when status is downloadPackage', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
      });
      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
    });

    test('verifyASC is allowed from downloadASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
      });
      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    test('verifyASC allows re-entry from verifyASC (resume after restart)', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      mockAtom.set.mockClear();
      await service.verifyASC();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
      expect(mockAtom.set).toHaveBeenCalled();
    });

    test('verifyPackage is rejected when status is downloadASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
      });
      await service.verifyPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
    });

    test('verifyPackage is allowed from verifyASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      await service.verifyPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
    });

    test('verifyPackage allows re-entry from verifyPackage (resume after restart)', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
      });
      mockAtom.set.mockClear();
      await service.verifyPackage();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
      expect(mockAtom.set).toHaveBeenCalled();
    });

    test('readyToInstall is rejected when status is verifyASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      await service.readyToInstall();
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    test('readyToInstall is allowed from verifyPackage', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
      });
      await service.readyToInstall();
      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });

    test('readyToInstall allows re-entry from ready (resume after restart)', async () => {
      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
      });
      mockAtom.set.mockClear();
      await service.readyToInstall();
      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
      expect(mockAtom.set).toHaveBeenCalled();
    });

    // --- Failed method guards ---
    // Each *Failed method should only apply when status matches its predecessor.

    test('downloadASCFailed is ignored when status is not downloadASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      await service.downloadASCFailed({ message: 'stale' });
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
    });

    test('verifyASCFailed is ignored when status is not verifyASC', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
      });
      await service.verifyASCFailed({ message: 'stale' });
      expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
    });

    test('verifyPackageFailed is ignored when status is not verifyPackage', async () => {
      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
      });
      await service.verifyPackageFailed({ message: 'stale' });
      expect(atomValue.status).toBe(EAppUpdateStatus.ready);
    });

    // --- Bypass paths: direct atom writes that skip the state chain ---
    // These methods operate on the atom directly and must NOT be blocked
    // by forward-only guards.

    test('App Store path: refreshUpdateStatus sets done from notify (first launch after update)', async () => {
      // Simulate: user was notified about v1.0.0, then installed via App Store.
      // On relaunch, platformEnv.version (1.0.0) >= latestVersion (1.0.0)
      // and status !== done → isFirstLaunchAfterUpdated returns true.
      resetAtom({
        status: EAppUpdateStatus.notify,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
        updateAt: Date.now(),
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('App Store path: refreshUpdateStatus sets done from downloadPackage (user switched to store mid-download)', async () => {
      // User started downloading via app, then decided to install via App Store.
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '1.0.0',
        updateStrategy: EUpdateStrategy.manual,
        updateAt: Date.now(),
        downloadedEvent: { downloadedFile: '/tmp/partial.zip' },
      });

      await service.refreshUpdateStatus();

      expect(atomValue.status).toBe(EAppUpdateStatus.done);
      expect(atomValue.downloadedEvent).toBeUndefined();
    });

    test('reset can set done from any in-progress state', async () => {
      jest.spyOn(service, 'fetchAppUpdateInfo').mockResolvedValue(atomValue);

      for (const inProgressStatus of [
        EAppUpdateStatus.downloadPackage,
        EAppUpdateStatus.downloadASC,
        EAppUpdateStatus.verifyASC,
        EAppUpdateStatus.verifyPackage,
        EAppUpdateStatus.ready,
      ]) {
        resetAtom({
          status: inProgressStatus,
          latestVersion: '2.0.0',
        });

        await service.reset();

        expect(atomValue.status).toBe(EAppUpdateStatus.done);
      }
    });

    test('resetToManualInstall can set manualInstall from any state', async () => {
      for (const status of [
        EAppUpdateStatus.downloadPackage,
        EAppUpdateStatus.verifyASC,
        EAppUpdateStatus.ready,
      ]) {
        resetAtom({ status, latestVersion: '2.0.0' });

        await service.resetToManualInstall();

        expect(atomValue.status).toBe(EAppUpdateStatus.manualInstall);
      }
    });

    test('resetToInComplete can set updateIncomplete from any state', async () => {
      for (const status of [
        EAppUpdateStatus.downloadPackage,
        EAppUpdateStatus.verifyASC,
        EAppUpdateStatus.ready,
      ]) {
        resetAtom({ status, latestVersion: '2.0.0' });

        await service.resetToInComplete();

        expect(atomValue.status).toBe(EAppUpdateStatus.updateIncomplete);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// State guard rejection tests — verify each method rejects calls from
// unexpected states by returning early without changing the atom.
// ---------------------------------------------------------------------------
describe('ServiceAppUpdate state guard rejection', () => {
  let service: ReturnType<typeof createService>;
  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // downloadPackage only allowed from: notify, done, downloadPackage, and failed states
  test('downloadPackage from verifyASC → no change', async () => {
    atomValue.status = EAppUpdateStatus.verifyASC;
    await service.downloadPackage();
    expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
  });

  test('downloadPackage from ready → no change', async () => {
    atomValue.status = EAppUpdateStatus.ready;
    await service.downloadPackage();
    expect(atomValue.status).toBe(EAppUpdateStatus.ready);
  });

  test('downloadPackage from verifyPackage → no change', async () => {
    atomValue.status = EAppUpdateStatus.verifyPackage;
    await service.downloadPackage();
    expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackage);
  });

  // downloadPackageFailed only from downloadPackage
  test('downloadPackageFailed from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.downloadPackageFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('downloadPackageFailed from verifyASC → no change', async () => {
    atomValue.status = EAppUpdateStatus.verifyASC;
    await service.downloadPackageFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
  });

  // verifyPackage only from verifyASC or verifyPackage
  test('verifyPackage from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.verifyPackage();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('verifyPackage from downloadPackage → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    await service.verifyPackage();
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
  });

  // verifyASC only from downloadASC or verifyASC
  test('verifyASC from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.verifyASC();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('verifyASC from downloadPackage → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    await service.verifyASC();
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
  });

  // downloadASC only from downloadPackage or downloadASC
  test('downloadASC from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.downloadASC();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('downloadASC from verifyASC → no change', async () => {
    atomValue.status = EAppUpdateStatus.verifyASC;
    await service.downloadASC();
    expect(atomValue.status).toBe(EAppUpdateStatus.verifyASC);
  });

  // verifyASCFailed only from verifyASC
  test('verifyASCFailed from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.verifyASCFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('verifyASCFailed from downloadASC → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadASC;
    await service.verifyASCFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadASC);
  });

  // verifyPackageFailed only from verifyPackage
  test('verifyPackageFailed from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.verifyPackageFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('verifyPackageFailed from downloadPackage → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    await service.verifyPackageFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
  });

  // downloadASCFailed only from downloadASC
  test('downloadASCFailed from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.downloadASCFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('downloadASCFailed from downloadPackage → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    await service.downloadASCFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
  });

  // readyToInstall only from verifyPackage or ready
  test('readyToInstall from notify → no change', async () => {
    atomValue.status = EAppUpdateStatus.notify;
    await service.readyToInstall();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('readyToInstall from downloadPackage → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    await service.readyToInstall();
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
  });
});

// ---------------------------------------------------------------------------
// Failed recovery timer — verifies the 2-hour auto-recovery behavior
// ---------------------------------------------------------------------------
describe('ServiceAppUpdate failedRecoveryTimer', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('downloadPackageFailed: 2h later → resets to notify, preserves downloadedEvent', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    atomValue.downloadedEvent = {
      downloadedFile: '/tmp/f',
      downloadUrl: 'https://x',
    } as any;
    await service.downloadPackageFailed({ message: 'timeout' });
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);

    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.downloadedEvent).toBeDefined();
  });

  test('verifyASCFailed: 2h later → resets to notify, clears downloadedEvent', async () => {
    atomValue.status = EAppUpdateStatus.verifyASC;
    atomValue.downloadedEvent = { downloadedFile: '/tmp/f' } as any;
    await service.verifyASCFailed({ message: 'bad sig' });
    expect(atomValue.status).toBe(EAppUpdateStatus.verifyASCFailed);

    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.downloadedEvent).toBeUndefined();
  });

  test('verifyPackageFailed: 2h later → resets to notify, clears downloadedEvent', async () => {
    atomValue.status = EAppUpdateStatus.verifyPackage;
    atomValue.downloadedEvent = { downloadedFile: '/tmp/f' } as any;
    await service.verifyPackageFailed({ message: 'bad pkg' });
    expect(atomValue.status).toBe(EAppUpdateStatus.verifyPackageFailed);

    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.downloadedEvent).toBeUndefined();
  });

  test('timer fires but status already recovered → no change', async () => {
    atomValue.status = EAppUpdateStatus.downloadPackage;
    await service.downloadPackageFailed({ message: 'err' });
    // Manually recover status before timer fires
    atomValue.status = EAppUpdateStatus.done;
    atomValue.errorText = undefined;

    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(atomValue.status).toBe(EAppUpdateStatus.done);
  });

  test('downloadPackage call clears recovery timer', async () => {
    resetAtom({
      status: EAppUpdateStatus.downloadPackage,
      latestVersion: '2.0.0',
    });
    await service.downloadPackageFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);

    // Start new download (from failed state, which is allowed)
    // Walk through the full state chain so the 30-min download timeout is also cleared
    await service.downloadPackage();
    await service.downloadASC();
    await service.verifyASC();
    await service.verifyPackage();
    await service.readyToInstall();
    expect(atomValue.status).toBe(EAppUpdateStatus.ready);

    // Advance past 2h — should NOT reset to notify because recovery timer was cleared
    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(atomValue.status).toBe(EAppUpdateStatus.ready);
  });
});

// ---------------------------------------------------------------------------
// Failed recovery retry limit
// ---------------------------------------------------------------------------
describe('ServiceAppUpdate failedRecoveryTimer retry limit', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('retries within limit reset to notify', async () => {
    // 1st failure + 2h → reset to notify (retry 1/3)
    resetAtom({
      status: EAppUpdateStatus.downloadPackage,
      latestVersion: '2.0.0',
    });
    await service.downloadPackageFailed({ message: 'err' });
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);

    await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });

  test('exceeding retry limit freezes and ignores target', async () => {
    // Simulate 4 consecutive failures + 2h resets (MAX = 3)
    for (let i = 0; i < 4; i += 1) {
      resetAtom({
        status: EAppUpdateStatus.downloadPackage,
        latestVersion: '2.0.0',
        // Preserve any freezeUntil / ignoredTargets from prior iterations
        freezeUntil: atomValue.freezeUntil,
        ignoredTargets: atomValue.ignoredTargets,
      });
      await service.downloadPackageFailed({ message: `err-${i}` });
      await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    }

    // After 4th timer fire (retry count 4 > MAX 3) → should be frozen
    expect(atomValue.freezeUntil).toBeGreaterThan(Date.now());
    // appShellUpdate: key is '2.0.0:1' (bundleVersion fallback)
    expect(atomValue.ignoredTargets?.['2.0.0:1']).toMatchObject({
      reason: 'DOWNLOAD_RETRY_EXHAUSTED',
    });
    // Status should NOT have been reset to notify on the 4th attempt
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
  });

  test('fetchAppUpdateInfo does not call refreshUpdateStatus', async () => {
    resetAtom({
      status: EAppUpdateStatus.downloadPackageFailed,
      latestVersion: '2.0.0',
      updateAt: 0,
    });
    jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue({
      version: '2.0.0',
      updateStrategy: EUpdateStrategy.manual,
    });
    jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
    const refreshSpy = jest.spyOn(service, 'refreshUpdateStatus');

    await service.fetchAppUpdateInfo(true);

    expect(refreshSpy).not.toHaveBeenCalled();
    // Status should stay failed (same version, no reset)
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
  });

  test('appShellUpdate target key matches between gate and task builder', async () => {
    // platformEnv.bundleVersion = '1'
    // For appShellUpdate with jsBundleVersion=null, gate should use '2.0.0:1'
    // (matching buildPendingAppShellTask), not '2.0.0:0'
    resetAtom({
      status: EAppUpdateStatus.done,
      updateAt: 0,
      ignoredTargets: {
        '2.0.0:1': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() + 60_000,
        },
      },
    });
    jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue({
      version: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
    });
    jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
    jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

    await service.fetchAppUpdateInfo(true);

    // Should be blocked by ignore check (key '2.0.0:1' matches)
    expect(atomValue.status).toBe(EAppUpdateStatus.done);
  });
});

// ---------------------------------------------------------------------------
// refreshUpdateStatus: all failed state branches
// ---------------------------------------------------------------------------
describe('ServiceAppUpdate refreshUpdateStatus failed branches', () => {
  let service: ReturnType<typeof createService>;
  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('downloadPackageFailed → notify, preserves downloadedEvent', async () => {
    resetAtom({
      status: EAppUpdateStatus.downloadPackageFailed,
      latestVersion: '2.0.0',
      errorText: 'some error' as any,
      downloadedEvent: { downloadedFile: '/tmp/f' },
    });
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.errorText).toBeUndefined();
    expect(atomValue.downloadedEvent).toBeDefined();
  });

  test('downloadASCFailed → notify, preserves downloadedEvent', async () => {
    resetAtom({
      status: EAppUpdateStatus.downloadASCFailed,
      latestVersion: '2.0.0',
      downloadedEvent: { downloadedFile: '/tmp/f' },
    });
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.downloadedEvent).toBeDefined();
  });

  test('verifyASCFailed → notify, clears downloadedEvent', async () => {
    resetAtom({
      status: EAppUpdateStatus.verifyASCFailed,
      latestVersion: '2.0.0',
      downloadedEvent: { downloadedFile: '/tmp/f' },
    });
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.downloadedEvent).toBeUndefined();
  });

  test('verifyPackageFailed → notify, clears downloadedEvent', async () => {
    resetAtom({
      status: EAppUpdateStatus.verifyPackageFailed,
      latestVersion: '2.0.0',
      downloadedEvent: { downloadedFile: '/tmp/f' },
    });
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.downloadedEvent).toBeUndefined();
  });

  test('notify status (non-failed) → no change', async () => {
    resetAtom({
      status: EAppUpdateStatus.notify,
      latestVersion: '2.0.0',
      errorText: 'old error' as any,
    });
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    expect(atomValue.errorText).toBe('old error');
  });

  test('downloadPackage status → no change', async () => {
    resetAtom({
      status: EAppUpdateStatus.downloadPackage,
      latestVersion: '2.0.0',
    });
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackage);
  });

  // ---------------------------------------------------------------------------
  // P2: reset → fetchAppUpdateInfo must NOT form an infinite loop.
  // fetchAppUpdateInfo no longer calls reset() when server payload is empty.
  // ---------------------------------------------------------------------------
  describe('P2: reset does not loop when server returns empty version', () => {
    test('reset is called only once (manual call)', async () => {
      resetAtom({ status: EAppUpdateStatus.ready, latestVersion: '2.0.0' });

      // Server always returns empty version data.
      jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue({
        updateStrategy: EUpdateStrategy.manual,
        // no version, no jsBundleVersion
      });
      jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
      jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);

      const resetSpy = jest.spyOn(service, 'reset');

      // 1st reset (manual) — schedules fetchAppUpdateInfo via setTimeout
      await service.reset();

      // Advance timers enough for multiple potential cycles.
      // Without the guard this would loop indefinitely within the
      // simulated time window.
      await jest.advanceTimersByTimeAsync(5000);

      // fetchAppUpdateInfo should not call reset() anymore.
      expect(resetSpy.mock.calls.length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// refreshUpdateStatus safety net: retry limit
// ---------------------------------------------------------------------------
describe('refreshUpdateStatus safety net retry limit', () => {
  let service: ReturnType<typeof createService>;
  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('safety net branch respects MAX_FAILED_RECOVERY_RETRY', async () => {
    // Set up a failed state with appShellUpdate target (1.0.0 → 2.0.0)
    // platformEnv.version = '1.0.0', bundleVersion = '1'
    // So target key = '2.0.0:1'
    resetAtom({
      status: EAppUpdateStatus.downloadPackageFailed,
      latestVersion: '2.0.0',
    });

    // First 3 calls should reset to notify
    for (let i = 0; i < 3; i += 1) {
      atomValue.status = EAppUpdateStatus.downloadPackageFailed;
      await service.refreshUpdateStatus();
      expect(atomValue.status).toBe(EAppUpdateStatus.notify);
    }

    // 4th call: retry count (3) >= MAX (3), should NOT reset
    atomValue.status = EAppUpdateStatus.downloadPackageFailed;
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.downloadPackageFailed);
  });
});

// ---------------------------------------------------------------------------
// computeUpdateTargetKey consistency tests
// ---------------------------------------------------------------------------
describe('computeUpdateTargetKey consistency', () => {
  let service: ReturnType<typeof createService>;
  beforeEach(() => {
    jest.useFakeTimers();
    resetAtom();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('jsBundleUpgrade target key matches buildPendingJsBundleTask', async () => {
    // For jsBundleUpgrade: remoteAppVersion = current (1.0.0),
    // remoteBundleVersion > current (1) → e.g. '2'
    // computeUpdateTargetKey should produce '1.0.0:2'
    // buildPendingJsBundleTask uses releaseInfo.jsBundleVersion = '2'
    // So key should be '1.0.0:2'
    resetAtom({
      status: EAppUpdateStatus.downloadPackageFailed,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
    });

    // Trigger fetchAppUpdateInfo with a matching release
    jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue({
      version: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
    });
    jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);

    // Add target '1.0.0:2' to ignored — should block the update
    resetAtom({
      status: EAppUpdateStatus.done,
      updateAt: 0,
      ignoredTargets: {
        '1.0.0:2': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() + 60_000,
        },
      },
    });

    await service.fetchAppUpdateInfo(true);

    // Should be blocked by the ignored target
    expect(atomValue.status).toBe(EAppUpdateStatus.done);
  });

  test('appShellUpdate with no jsBundleVersion uses bundleVersion fallback', async () => {
    // latestVersion > current (appShellUpdate decision), jsBundleVersion undefined
    // computeUpdateTargetKey falls back to platformEnv.bundleVersion = '1'
    // So target key = '2.0.0:1', matching buildPendingAppShellTask behavior
    resetAtom({
      status: EAppUpdateStatus.downloadPackageFailed,
      latestVersion: '2.0.0',
      jsBundleVersion: undefined,
    });

    // The safety net should reset to notify (appShellUpdate target key = '2.0.0:1')
    await service.refreshUpdateStatus();
    expect(atomValue.status).toBe(EAppUpdateStatus.notify);
  });
});
