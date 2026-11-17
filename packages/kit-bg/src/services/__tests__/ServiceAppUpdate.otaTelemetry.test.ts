/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EUpdateErrorCode,
  createUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const INITIAL_APP_UPDATE_VALUE: IAppUpdateInfo = {
  latestVersion: '0.0.0',
  updateAt: 0,
  status: EAppUpdateStatus.done,
  updateStrategy: EUpdateStrategy.manual,
  lastUpdateDialogShownAt: undefined,
};

let atomValue: IAppUpdateInfo = { ...INITIAL_APP_UPDATE_VALUE };
let pendingInstallTaskValue: unknown;
const syncStorageBackingMap = new Map<string, unknown>();

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

jest.mock('../../states/jotai/atoms', () => ({
  appUpdatePersistAtom: mockAtom,
}));

jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
    set: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: jest.fn((key: string) => {
        if (syncStorageBackingMap.has(key)) {
          return syncStorageBackingMap.get(key);
        }
        return pendingInstallTaskValue;
      }),
      setObject: jest.fn((key: string, value: unknown) => {
        syncStorageBackingMap.set(key, value);
        pendingInstallTaskValue = value;
        return value;
      }),
      delete: jest.fn((key: string) => {
        syncStorageBackingMap.delete(key);
        pendingInstallTaskValue = undefined;
      }),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    version: '1.0.0',
    bundleVersion: '100',
    isDesktop: false,
    isExtension: false,
    isNativeAndroid: false,
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  AppUpdate: {
    checkPackageAvailability: jest.fn(async () => ({
      status: 'notApplicable',
    })),
    downloadPackage: jest.fn(async () => ({})),
    verifyPackage: jest.fn(async () => undefined),
    verifyASC: jest.fn(async () => undefined),
    downloadASC: jest.fn(async () => undefined),
    installPackage: jest.fn(async () => true),
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
    getFallbackBundles: jest.fn(async () => []),
    switchBundle: jest.fn(async () => undefined),
    isBundleExists: jest.fn(async () => false),
    listLocalBundles: jest.fn(async () => []),
    getNativeAppVersion: jest.fn(async () => ''),
    getNativeBuildNumber: jest.fn(async () => ''),
    getBuiltinBundleVersion: jest.fn(async () => ''),
    getJsBundlePath: jest.fn(async () => ''),
    verifyExtractedBundle: jest.fn(async () => undefined),
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: string, desc: unknown) => desc,
  backgroundMethodForDev: () => (_t: unknown, _k: string, desc: unknown) =>
    desc,
}));

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
        pendingTaskCleared: jest.fn(),
        pendingTaskFrozen: jest.fn(),
        fullFlowRetryTriggered: jest.fn(),
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

jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: (fn: (...args: unknown[]) => unknown) => {
    const wrapped = (...args: unknown[]) => fn(...args);
    (wrapped as { clear?: () => void }).clear = () => undefined;
    return wrapped;
  },
  memoFn: (fn: unknown) => fn,
}));

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(async () => ({
      get: jest.fn(async () => ({ data: { code: 0, data: null } })),
      post: jest.fn(async () => ({
        data: { code: 0, data: { recorded: true } },
      })),
    })),
    getBasicClient: jest.fn(async () => ({
      get: jest.fn(async () => ({ data: { code: 0, data: null } })),
      post: jest.fn(async () => ({
        data: { code: 0, data: { recorded: true } },
      })),
    })),
  },
}));

jest.mock('../../endpoints', () => ({
  getEndpointInfo: jest.fn(async () => ({ endpoint: 'https://test.com' })),
}));

function resetAtom(overrides?: Partial<IAppUpdateInfo>) {
  atomValue = { ...INITIAL_APP_UPDATE_VALUE, ...overrides };
}

function createService() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../ServiceAppUpdate');
  mod.resetFailedRecoveryRetryCount();
  const ServiceAppUpdate = mod.default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ServicePendingInstallTask } = require('../servicePendingInstallTask');
  const backgroundApi: Record<string, unknown> = {
    serviceApp: {
      resetLaunchTimesAfterUpdate: jest.fn(async () => undefined),
    },
  };
  backgroundApi.servicePendingInstallTask = new ServicePendingInstallTask({
    backgroundApi,
    refreshUpdateStatus: jest.fn(async () => undefined),
  });
  const svc = new ServiceAppUpdate({
    backgroundApi,
  });
  backgroundApi.serviceAppUpdate = svc;
  return svc;
}

describe('ServiceAppUpdate OTA telemetry fixes', () => {
  const TELEMETRY_PATH = '/utility/v1/app-update/telemetry';
  let service: ReturnType<typeof createService>;
  let post: jest.Mock;

  async function flushTelemetry() {
    for (let i = 0; i < 20; i += 1) {
      await Promise.resolve();
    }
  }

  function telemetryBodies() {
    return post.mock.calls
      .filter(([path]) => path === TELEMETRY_PATH)
      .map(([, body]) => body);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(platformEnv, {
      version: '1.0.0',
      bundleVersion: '100',
      isDesktop: false,
    });
    resetAtom();
    pendingInstallTaskValue = undefined;
    syncStorageBackingMap.clear();
    jest.clearAllMocks();
    service = createService();
    post = jest.fn(async () => ({ status: 204, data: '' }));
    jest.spyOn(service, 'getRawDataClient').mockResolvedValue({ post } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('postOtaTelemetry deduplication and error rollback', () => {
    test('deduplicates identical telemetry events on success and rolls back dedupeKey when post fails', async () => {
      resetAtom({ status: EAppUpdateStatus.notify, latestVersion: '2.0.0' });

      // First attempt fails due to network error -> dedupeKey must be removed
      post.mockRejectedValueOnce(new Error('offline'));
      await service.downloadPackage();
      await flushTelemetry();
      expect(post).toHaveBeenCalledTimes(1);

      // Second attempt for the same target/event succeeds because dedupeKey was rolled back
      await service.downloadPackage();
      await flushTelemetry();
      expect(post).toHaveBeenCalledTimes(2);
      expect(telemetryBodies()).toHaveLength(2);

      // Third attempt in the same session is deduplicated because the second attempt succeeded
      await service.downloadPackage();
      await flushTelemetry();
      expect(post).toHaveBeenCalledTimes(2);
    });
  });

  describe('INSTALL_SUCCESS reporting and rollback suppression', () => {
    test('reports INSTALL_SUCCESS on normal hotUpdate upgrade and clears update state', async () => {
      resetAtom({
        latestVersion: '1.0.0',
        jsBundleVersion: '100',
        isRollbackTarget: false,
        status: EAppUpdateStatus.ready,
      });

      await service.refreshUpdateStatus();
      await flushTelemetry();

      expect(telemetryBodies()).toEqual([
        expect.objectContaining({
          category: 'hotUpdate',
          targetVersion: '1.0.0',
          bundleVersion: 100,
          event: 'INSTALL_SUCCESS',
        }),
      ]);
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
      expect(atomValue.jsBundleVersion).toBeUndefined();
      expect(atomValue.isRollbackTarget).toBeUndefined();
    });

    test('suppresses INSTALL_SUCCESS when isRollbackTarget is true for built-in bundle (bundleVersion = 0)', async () => {
      resetAtom({
        latestVersion: '1.0.0',
        jsBundleVersion: '0',
        isRollbackTarget: true,
        status: EAppUpdateStatus.ready,
      });

      await (service as any).postOtaTelemetry({
        event: 'INSTALL_SUCCESS',
        appInfo: atomValue,
      });

      expect(telemetryBodies()).toEqual([]);
    });

    test('suppresses INSTALL_SUCCESS and clears marker when isRollbackTarget is true for positive bundleVersion (e.g. 101 -> 100)', async () => {
      resetAtom({
        latestVersion: '1.0.0',
        jsBundleVersion: '100',
        isRollbackTarget: true,
        status: EAppUpdateStatus.ready,
      });

      await service.refreshUpdateStatus();
      await flushTelemetry();

      expect(telemetryBodies()).toEqual([]);
      expect(atomValue.status).toBe(EAppUpdateStatus.done);
      expect(atomValue.jsBundleVersion).toBeUndefined();
      expect(atomValue.isRollbackTarget).toBeUndefined();
    });
  });

  describe('verifyASCFailed and verifyPackageFailed granular errorCode mapping', () => {
    test('resolveVerifyErrorCode maps granular error codes to server-valid OtaErrorCode values and falls back to defaultCode', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { resolveVerifyErrorCode } = require('../ServiceAppUpdate');
      expect(
        resolveVerifyErrorCode(
          { code: EUpdateErrorCode.packageMissing, step: 'verifyPackage' },
          'SHA256_MISMATCH',
        ),
      ).toBe('UNZIP_OR_FILE_CORRUPT');
      expect(
        resolveVerifyErrorCode({ code: 'responseNot200' }, 'SIGNATURE_INVALID'),
      ).toBe('DOWNLOAD_HTTP_ERROR');
      expect(
        resolveVerifyErrorCode(
          { code: EUpdateErrorCode.httpError, step: 'verifyASC' },
          'SIGNATURE_INVALID',
        ),
      ).toBe('DOWNLOAD_HTTP_ERROR');
      expect(
        resolveVerifyErrorCode(
          { code: EUpdateErrorCode.storageError, step: 'verifyPackage' },
          'SHA256_MISMATCH',
        ),
      ).toBe('DISK_SPACE_INSUFFICIENT');
      expect(
        resolveVerifyErrorCode(
          { code: 'downloadTimeout' },
          'SIGNATURE_INVALID',
        ),
      ).toBe('NETWORK_TIMEOUT');
      expect(
        resolveVerifyErrorCode({ code: 'sha256Mismatch' }, 'SIGNATURE_INVALID'),
      ).toBe('SHA256_MISMATCH');
      expect(
        resolveVerifyErrorCode({ code: 'ascVerifyFailed' }, 'SHA256_MISMATCH'),
      ).toBe('SIGNATURE_INVALID');
      expect(
        resolveVerifyErrorCode(
          { code: EUpdateErrorCode.integrityFailed, step: 'verifyPackage' },
          'SHA256_MISMATCH',
        ),
      ).toBe('SHA256_MISMATCH');
      expect(
        resolveVerifyErrorCode(
          { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
          'SIGNATURE_INVALID',
        ),
      ).toBe('SIGNATURE_INVALID');
    });

    test('verifyASCFailed and verifyPackageFailed report mapped server-valid errorCodes', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
      });
      await service.verifyPackageFailed({
        code: EUpdateErrorCode.packageMissing,
        step: 'verifyPackage',
      });
      await flushTelemetry();

      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      await service.verifyASCFailed({
        code: 'responseNot200' as EUpdateErrorCode,
        step: 'verifyASC',
      });
      await flushTelemetry();

      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
      });
      await service.verifyPackageFailed({
        code: 'sha256Mismatch' as EUpdateErrorCode,
        step: 'verifyPackage',
      });
      await flushTelemetry();

      resetAtom({
        status: EAppUpdateStatus.verifyASC,
        latestVersion: '2.0.0',
      });
      await service.verifyASCFailed({
        code: 'ascVerifyFailed' as EUpdateErrorCode,
        step: 'verifyASC',
      });
      await flushTelemetry();

      expect(telemetryBodies().map((b) => [b.event, b.errorCode])).toEqual([
        ['VERIFY_FAILED', 'UNZIP_OR_FILE_CORRUPT'],
        ['VERIFY_FAILED', 'DOWNLOAD_HTTP_ERROR'],
        ['VERIFY_FAILED', 'SHA256_MISMATCH'],
        ['VERIFY_FAILED', 'SIGNATURE_INVALID'],
      ]);
    });
  });

  describe('readyToInstall and Desktop missing-package recovery telemetry', () => {
    test('does not report DOWNLOAD_SUCCESS when Desktop enters verifyPackage/verifyASC without downloadedEvent', async () => {
      Object.assign(platformEnv, { isDesktop: true });
      resetAtom({
        status: EAppUpdateStatus.downloadASC,
        latestVersion: '2.0.0',
        downloadedEvent: undefined,
      });

      await service.verifyASC();
      await service.verifyPackage();
      await flushTelemetry();

      expect(telemetryBodies()).toEqual([]);
    });

    test('reports only DOWNLOAD_SUCCESS (no false VERIFY_SUCCESS) when readyToInstall is called without verifyPackage stage', async () => {
      Object.assign(platformEnv, { isDesktop: true });
      resetAtom({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app.dmg',
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app.dmg',
        },
      });

      await service.readyToInstall();
      await flushTelemetry();

      expect(telemetryBodies().map((b) => b.event)).toEqual([
        'DOWNLOAD_SUCCESS',
      ]);
    });

    test('reports DOWNLOAD_SUCCESS and VERIFY_SUCCESS when entering readyToInstall from verifyPackage stage', async () => {
      resetAtom({
        status: EAppUpdateStatus.verifyPackage,
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app.dmg',
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app.dmg',
        },
      });

      await service.readyToInstall();
      await flushTelemetry();

      expect(telemetryBodies().map((b) => b.event)).toEqual([
        'DOWNLOAD_SUCCESS',
        'VERIFY_SUCCESS',
      ]);
    });
  });

  describe('reportOtaInstallFailure', () => {
    test('reports INSTALL_FAILED when invoked with appUpdateInfo and foreground install error', async () => {
      const appInfo: IAppUpdateInfo = {
        latestVersion: '2.1.0',
        updateAt: Date.now(),
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.force,
      };
      const err = createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'install',
      });

      await service.reportOtaInstallFailure(appInfo, err);
      await flushTelemetry();

      expect(telemetryBodies()).toEqual([
        expect.objectContaining({
          category: 'fullUpdate',
          targetVersion: '2.1.0',
          event: 'INSTALL_FAILED',
          errorCode: 'INSTALL_OR_APPLY_ERROR',
          errorSample: 'INSTALL_FAILED:install',
        }),
      ]);
    });

    test('reports INSTALL_FAILED when invoked with structured params', async () => {
      await service.reportOtaInstallFailure({
        category: 'hotUpdate',
        targetVersion: '1.0.0',
        bundleVersion: 105,
        errorCode: 'INSTALL_OR_APPLY_ERROR',
        errorSample: 'INSTALL_FAILED:install',
      });
      await flushTelemetry();

      expect(telemetryBodies()).toEqual([
        expect.objectContaining({
          category: 'hotUpdate',
          targetVersion: '1.0.0',
          bundleVersion: 105,
          event: 'INSTALL_FAILED',
          errorCode: 'INSTALL_OR_APPLY_ERROR',
          errorSample: 'INSTALL_FAILED:install',
        }),
      ]);
    });

    test('strips stale bundleVersion when reporting fullUpdate telemetry', async () => {
      const appInfo: IAppUpdateInfo = {
        latestVersion: '2.1.0',
        jsBundleVersion: '100',
        updateAt: Date.now(),
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.force,
      };
      const err = createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'install',
      });

      await service.reportOtaInstallFailure(appInfo, err);
      await flushTelemetry();

      expect(telemetryBodies()).toEqual([
        {
          category: 'fullUpdate',
          targetVersion: '2.1.0',
          bundleVersion: undefined,
          event: 'INSTALL_FAILED',
          errorCode: 'INSTALL_OR_APPLY_ERROR',
          errorSample: 'INSTALL_FAILED:install',
        },
      ]);
    });
  });

  describe('forceUpdateWhitelist strategy downgrade with pending task', () => {
    test('updates updateStrategy from force to manual even when a pending install task exists for the same target', async () => {
      resetAtom({
        latestVersion: '2.0.0',
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.force,
      });
      pendingInstallTaskValue = {
        taskId: 'task-1',
        type: 'appInstall',
        status: 'pending',
        targetAppVersion: '2.0.0',
        targetBundleVersion: '100',
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue({
        version: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
        downloadUrl: 'https://cdn.onekey.so/app.dmg',
      } as any);

      const latest = await service.fetchAppUpdateInfo(true);

      expect(latest.status).toBe(EAppUpdateStatus.ready);
      expect(latest.updateStrategy).toBe(EUpdateStrategy.manual);
      expect(atomValue.updateStrategy).toBe(EUpdateStrategy.manual);
    });
  });
});
