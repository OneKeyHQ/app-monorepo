/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

const INITIAL_APP_UPDATE_VALUE: IAppUpdateInfo = {
  latestVersion: '0.0.0',
  updateAt: 0,
  status: EAppUpdateStatus.done,
  updateStrategy: EUpdateStrategy.manual,
  lastUpdateDialogShownAt: undefined,
};

let appUpdateState: IAppUpdateInfo = { ...INITIAL_APP_UPDATE_VALUE };
let pendingTaskValue: any;

const appUpdatePersistAtom = {
  get: jest.fn(async () => appUpdateState),
  set: jest.fn(
    async (
      valOrUpdater: IAppUpdateInfo | ((prev: IAppUpdateInfo) => IAppUpdateInfo),
    ) => {
      if (typeof valOrUpdater === 'function') {
        appUpdateState = valOrUpdater(appUpdateState);
      } else {
        appUpdateState = valOrUpdater;
      }
      return appUpdateState;
    },
  ),
};

jest.mock('../states/jotai/atoms', () => ({
  appUpdatePersistAtom,
}));

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
    set: jest.fn(),
  },
}));

const appStorageMock = {
  syncStorage: {
    getObject: jest.fn(async () => pendingTaskValue),
    setObject: jest.fn(async (_key: string, task: any) => {
      pendingTaskValue = task;
      return pendingTaskValue;
    }),
    delete: jest.fn(async () => {
      pendingTaskValue = undefined;
    }),
  },
};

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: appStorageMock,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    version: '1.0.0',
    bundleVersion: '1',
    isExtension: false,
    isNativeAndroid: false,
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  AppUpdate: {
    downloadPackage: jest.fn(async () => ({
      downloadedFile: '/tmp/app.pkg',
    })),
    verifyPackage: jest.fn(async () => undefined),
    verifyASC: jest.fn(async () => undefined),
    downloadASC: jest.fn(async () => undefined),
    installPackage: jest.fn(async () => undefined),
    clearPackage: jest.fn(async () => undefined),
  },
  BundleUpdate: {
    downloadBundle: jest.fn(async () => ({
      downloadedFile: '/tmp/bundle.zip',
    })),
    verifyBundle: jest.fn(async () => undefined),
    verifyBundleASC: jest.fn(async () => undefined),
    downloadBundleASC: jest.fn(async () => undefined),
    installBundle: jest.fn(async () => undefined),
    clearBundle: jest.fn(async () => undefined),
    resetToBuiltInBundle: jest.fn(async () => undefined),
    restart: jest.fn(),
    switchBundle: jest.fn(async () => undefined),
    isBundleExists: jest.fn(async () => false),
    verifyExtractedBundle: jest.fn(async () => undefined),
    clearAllJSBundleData: jest.fn(async () => ({
      success: true,
      message: 'ok',
    })),
    getFallbackBundles: jest.fn(async () => []),
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
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
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
        updateControlFrozenOrIgnored: jest.fn(),
        pendingTaskUnknownTypeDropped: jest.fn(),
        fullFlowRetryTriggered: jest.fn(),
        pendingRetryScheduled: jest.fn(),
        pendingPostProcessRefreshStart: jest.fn(),
        pendingPostProcessRefreshResult: jest.fn(),
        pendingTaskLockState: jest.fn(),
        pendingTaskValidation: jest.fn(),
        pendingVerifyAfterRestart: jest.fn(),
        pendingTaskEnvCheck: jest.fn(),
        pendingSwitchStart: jest.fn(),
        pendingSwitchResult: jest.fn(),
      },
      jsBundleDev: {
        fetchBundleVersions: jest.fn(),
        fetchBundleVersionsError: jest.fn(),
        fetchBundles: jest.fn(),
        fetchBundlesError: jest.fn(),
      },
      error: { log: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: (fn: any) => fn,
  memoFn: (fn: any) => fn,
}));

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

jest.mock('../endpoints', () => ({
  getEndpointInfo: jest.fn(async () => ({ endpoint: 'https://test.com' })),
}));

function createService() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ServiceAppUpdate = require('./ServiceAppUpdate').default;
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

function resetAppUpdateState(overrides?: Partial<IAppUpdateInfo>) {
  appUpdateState = { ...INITIAL_APP_UPDATE_VALUE, ...overrides };
}

function resetPendingTask(value: any = undefined) {
  pendingTaskValue = value;
}

function makeSwitchTask(overrides: Record<string, any> = {}) {
  const now = Date.now();
  return {
    taskId: 'jsbundle:1.0.0:2',
    revision: 1,
    action: 'switch-bundle',
    type: 'jsbundle-switch',
    targetAppVersion: '1.0.0',
    targetBundleVersion: '2',
    scheduledEnvAppVersion: '1.0.0',
    scheduledEnvBundleVersion: '1',
    createdAt: now - 1000,
    expiresAt: now + 60_000,
    retryCount: 0,
    status: 'pending',
    payload: {
      appVersion: '1.0.0',
      bundleVersion: '2',
      signature: 'sig-2',
    },
    ...overrides,
  };
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ServiceAppUpdate pendingInstallTask scheduling', () => {
  let service: ReturnType<typeof createService>;

  function mockReleaseInfoForFetch(releaseInfo: Record<string, any>) {
    jest.spyOn(service, 'getAppLatestInfo').mockResolvedValue({
      updateStrategy: EUpdateStrategy.seamless,
      ...releaseInfo,
    } as any);
    jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
    jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);
  }

  function setReadyState(overrides: Record<string, any> = {}) {
    resetAppUpdateState({
      status: EAppUpdateStatus.verifyPackage,
      updateStrategy: EUpdateStrategy.seamless,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      jsBundle: {
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        fileSize: 1024,
        sha256: 'sha256-2',
        signature: 'sig-2',
      },
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'sha256-2',
      },
      ...overrides,
    } as any);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.version = '1.0.0';
    platformEnvMock.bundleVersion = '1';
    resetAppUpdateState();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('fetchAppUpdateInfo only syncs metadata and does not create pending task before download is ready', async () => {
    mockReleaseInfoForFetch({
      version: '1.0.0',
      jsBundleVersion: '2',
      jsBundle: {
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        fileSize: 1024,
        sha256: 'sha256-2',
        signature: 'sig-2',
      },
    });

    await service.fetchAppUpdateInfo(true);

    expect(pendingTaskValue).toBeUndefined();
  });

  test('readyToInstall creates pending jsbundle task after download/verify completes', async () => {
    setReadyState();

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      action: 'switch-bundle',
      targetAppVersion: '1.0.0',
      targetBundleVersion: '2',
      scheduledEnvAppVersion: '1.0.0',
      scheduledEnvBundleVersion: '1',
      status: 'pending',
      payload: {
        appVersion: '1.0.0',
        bundleVersion: '2',
        signature: 'sig-2',
      },
    });
  });

  test('readyToInstall creates appshell pending task for seamless app update', async () => {
    setReadyState({
      latestVersion: '2.0.0',
      jsBundleVersion: '1',
      downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      downloadedEvent: {
        downloadedFile: '/tmp/app-2.0.0.pkg',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      type: 'app-install',
      action: 'install-app',
      targetAppVersion: '2.0.0',
      payload: {
        latestVersion: '2.0.0',
        channel: 'direct',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
  });

  test('readyToInstall does not create pending task for non-seamless strategy', async () => {
    setReadyState({
      updateStrategy: EUpdateStrategy.manual,
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('readyToInstall does not replace an in-progress running task with newer target', async () => {
    resetPendingTask(
      makeSwitchTask({
        taskId: 'jsbundle:1.0.0:2',
        targetBundleVersion: '2',
        status: 'running',
        runningStartedAt: Date.now(),
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '2',
          signature: 'sig-2',
        },
      }),
    );
    setReadyState({
      jsBundleVersion: '3',
      jsBundle: {
        downloadUrl: 'https://cdn.onekey.so/bundle-v3.zip',
        fileSize: 1024,
        sha256: 'sha256-3',
        signature: 'sig-3',
      },
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v3.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v3.zip',
        signature: 'sig-3',
        sha256: 'sha256-3',
      },
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      taskId: 'jsbundle:1.0.0:2',
      targetBundleVersion: '2',
      status: 'running',
    });
  });

  test('reset does not clear pending task storage', async () => {
    const task = makeSwitchTask({ taskId: 'task-persist' });
    resetPendingTask(task);
    jest.spyOn(service, 'fetchAppUpdateInfo').mockResolvedValue(appUpdateState);

    await service.reset();

    expect(pendingTaskValue).toEqual(task);
  });

  test('readyToInstall rejected when status is not verifyPackage or ready', async () => {
    resetAppUpdateState({
      status: EAppUpdateStatus.downloadPackage,
      updateStrategy: EUpdateStrategy.seamless,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'sha256-2',
      },
    } as any);

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
    // Status should remain unchanged (not set to ready)
    expect(appUpdateState.status).toBe(EAppUpdateStatus.downloadPackage);
  });

  test('rollback with non-seamless strategy creates pending task via readyToInstall', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '3';
    setReadyState({
      updateStrategy: EUpdateStrategy.manual,
      jsBundleVersion: '2',
    });

    await service.readyToInstall();

    // Rollback bypasses strategy check — pending task should be created
    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      targetBundleVersion: '2',
    });
  });
});

describe('processPendingInstallTask', () => {
  let service: ReturnType<typeof createService>;
  let pendingTaskService: any;
  let autoUpdate: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.version = '1.0.0';
    platformEnvMock.bundleVersion = '1';
    resetAppUpdateState();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
    pendingTaskService = service.backgroundApi.servicePendingInstallTask;
    autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('pending -> running -> applied_waiting_verify success path', async () => {
    resetPendingTask(makeSwitchTask());

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'applied_waiting_verify',
      retryCount: 0,
    });
    expect(autoUpdate.BundleUpdate.switchBundle).toHaveBeenCalledTimes(1);
  });

  test('pending -> running -> fail -> retry when retryCount < MAX_TASK_RETRY', async () => {
    autoUpdate.BundleUpdate.switchBundle.mockRejectedValueOnce(
      new Error('switch_failed'),
    );
    resetPendingTask(makeSwitchTask({ retryCount: 0 }));

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: 'switch_failed',
    });
    expect(pendingTaskValue.nextRetryAt).toBeGreaterThan(Date.now());
  });

  test('retry exhausted -> freezeAndIgnoreTarget', async () => {
    autoUpdate.BundleUpdate.switchBundle.mockRejectedValueOnce(
      new Error('switch_failed'),
    );
    resetPendingTask(makeSwitchTask({ retryCount: 2 }));

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
    expect(appUpdateState.ignoredTargets?.['1.0.0:2']).toMatchObject({
      reason: 'RETRY_EXHAUSTED',
    });
  });

  test('expired task is cleared', async () => {
    resetPendingTask(makeSwitchTask({ expiresAt: Date.now() - 1 }));

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('invalid task payload is cleared', async () => {
    resetPendingTask(
      makeSwitchTask({
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '2',
        },
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('applied_waiting_verify + target aligned -> clear success', async () => {
    resetAppUpdateState({
      ignoredTargets: {
        '1.0.0:1': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() + 60_000,
        },
      },
      fullFlowRetryByTarget: {
        '1.0.0:1': {
          count: 1,
          updatedAt: Date.now() - 1000,
        },
      },
    });
    resetPendingTask(
      makeSwitchTask({
        taskId: 'jsbundle:1.0.0:1',
        targetBundleVersion: '1',
        status: 'applied_waiting_verify',
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '1',
          signature: 'sig-1',
        },
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.ignoredTargets?.['1.0.0:1']).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget?.['1.0.0:1']).toBeUndefined();
  });

  test('applied_waiting_verify + target not aligned -> markTaskFailed', async () => {
    resetPendingTask(
      makeSwitchTask({
        status: 'applied_waiting_verify',
        targetBundleVersion: '2',
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '2',
          signature: 'sig-2',
        },
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: 'VERIFY_AFTER_RESTART_MISMATCH',
    });
    expect(pendingTaskValue.nextRetryAt).toBeGreaterThan(Date.now());
  });

  test('stale running task (>5m) marks interrupted and retries', async () => {
    resetPendingTask(
      makeSwitchTask({
        status: 'running',
        runningStartedAt: Date.now() - 6 * 60 * 1000,
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: 'INTERRUPTED',
    });
    expect(pendingTaskValue.nextRetryAt).toBeGreaterThan(Date.now());
  });

  test('concurrent/reentrant invocation is rejected by lock', async () => {
    const deferred = createDeferred<void>();
    autoUpdate.BundleUpdate.switchBundle.mockImplementationOnce(
      () => deferred.promise,
    );
    resetPendingTask(makeSwitchTask());

    const firstCall = service.processPendingInstallTask();
    const secondCall = service.processPendingInstallTask();

    await secondCall;
    expect(
      require('@onekeyhq/shared/src/logger/logger').defaultLogger.app.appUpdate
        .pendingTaskLockState,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        lockState: 'reentrant',
        lockHeldMs: expect.any(Number),
      }),
    );

    deferred.resolve();
    await firstCall;
    expect(autoUpdate.BundleUpdate.switchBundle).toHaveBeenCalledTimes(1);
  });

  test('lock timeout recovers and continues processing', async () => {
    resetPendingTask(makeSwitchTask());
    pendingTaskService.isProcessingPendingTask = true;
    pendingTaskService.pendingTaskLockAcquiredAt = Date.now() - 31_000;

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'applied_waiting_verify',
    });
    expect(
      require('@onekeyhq/shared/src/logger/logger').defaultLogger.app.appUpdate
        .pendingTaskLockState,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        lockState: 'timeout',
      }),
      'warn',
    );
  });

  test('env mismatch (neither target nor scheduled) drops task', async () => {
    resetPendingTask(
      makeSwitchTask({
        taskId: 'jsbundle:9.9.9:9',
        targetAppVersion: '9.9.9',
        targetBundleVersion: '9',
        scheduledEnvAppVersion: '8.8.8',
        scheduledEnvBundleVersion: '8',
        payload: {
          appVersion: '9.9.9',
          bundleVersion: '9',
          signature: 'sig-9',
        },
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.switchBundle).not.toHaveBeenCalled();
  });

  test('skip execution when nextRetryAt is not reached', async () => {
    resetPendingTask(
      makeSwitchTask({
        nextRetryAt: Date.now() + 60_000,
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 0,
    });
    expect(autoUpdate.BundleUpdate.switchBundle).not.toHaveBeenCalled();
  });

  test('target already aligned -> clear without execution', async () => {
    resetPendingTask(
      makeSwitchTask({
        taskId: 'jsbundle:1.0.0:1',
        targetBundleVersion: '1',
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '1',
          signature: 'sig-1',
        },
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.switchBundle).not.toHaveBeenCalled();
  });

  test('failed task is self-healed by clearing', async () => {
    resetPendingTask(
      makeSwitchTask({
        status: 'failed',
        lastError: 'switch_failed',
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('VERIFY_EXTRACTED_FAILED triggers incrementFullFlowRetry instead of normal retry', async () => {
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockRejectedValueOnce(
      new Error('checksum mismatch'),
    );
    resetPendingTask(makeSwitchTask({ retryCount: 0 }));

    await service.processPendingInstallTask();

    // Full flow retry clears the task (fallback to refetch) instead of setting retry state
    expect(pendingTaskValue).toBeUndefined();
    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.fullFlowRetryTriggered).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'verify_failed',
        fullFlowRetryCount: 1,
      }),
      'warn',
    );
  });

  test('stale running + retryCount=2 -> immediate exhaustion and freeze', async () => {
    autoUpdate.BundleUpdate.switchBundle.mockRejectedValueOnce(
      new Error('switch_failed'),
    );
    resetPendingTask(
      makeSwitchTask({
        status: 'running',
        retryCount: 2,
        runningStartedAt: Date.now() - 10 * 60 * 1000,
      }),
    );

    await service.processPendingInstallTask();

    // INTERRUPTED retry bumps retryCount to 3 -> exhausted -> freeze
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
  });

  test('appshell APP_INSTALL_CHANNEL_UNSUPPORTED for store channel triggers retry', async () => {
    resetPendingTask({
      taskId: 'appShell:2.0.0:store',
      revision: 1,
      action: 'install-app',
      type: 'app-install',
      targetAppVersion: '2.0.0',
      targetBundleVersion: '1',
      scheduledEnvAppVersion: '1.0.0',
      scheduledEnvBundleVersion: '1',
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 60_000,
      retryCount: 0,
      status: 'pending',
      payload: {
        latestVersion: '2.0.0',
        channel: 'store',
        storeUrl: 'https://play.google.com/store/apps/details?id=test',
      },
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: 'APP_INSTALL_CHANNEL_UNSUPPORTED',
    });
  });

  test('appshell APP_PACKAGE_MISSING when no downloadedFile triggers retry', async () => {
    // Clear downloadedEvent from atom
    resetAppUpdateState({
      downloadedEvent: undefined,
    });
    resetPendingTask({
      taskId: 'appShell:2.0.0:direct',
      revision: 1,
      action: 'install-app',
      type: 'app-install',
      targetAppVersion: '2.0.0',
      targetBundleVersion: '1',
      scheduledEnvAppVersion: '1.0.0',
      scheduledEnvBundleVersion: '1',
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 60_000,
      retryCount: 0,
      status: 'pending',
      payload: {
        latestVersion: '2.0.0',
        channel: 'direct',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: 'APP_PACKAGE_MISSING',
    });
  });

  test('app-install in applied_waiting_verify within grace period is skipped', async () => {
    resetPendingTask({
      taskId: 'appShell:2.0.0:direct',
      revision: 1,
      action: 'install-app',
      type: 'app-install',
      targetAppVersion: '2.0.0',
      targetBundleVersion: '1',
      scheduledEnvAppVersion: '1.0.0',
      scheduledEnvBundleVersion: '1',
      createdAt: Date.now() - 5000,
      expiresAt: Date.now() + 60_000,
      retryCount: 0,
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now() - 60_000, // 1 minute ago, within 10min grace
      payload: {
        latestVersion: '2.0.0',
        channel: 'direct',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.processPendingInstallTask();

    // Task should still be in applied_waiting_verify, not failed
    expect(pendingTaskValue).toMatchObject({
      status: 'applied_waiting_verify',
      type: 'app-install',
    });
  });
});

describe('syncPendingInstallTaskWithReleaseInfo', () => {
  let service: ReturnType<typeof createService>;

  function setReadyState(overrides: Record<string, any> = {}) {
    resetAppUpdateState({
      status: EAppUpdateStatus.verifyPackage,
      updateStrategy: EUpdateStrategy.seamless,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      jsBundle: {
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        fileSize: 1024,
        sha256: 'sha256-2',
        signature: 'sig-2',
      },
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'sha256-2',
      },
      ...overrides,
    } as any);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.version = '1.0.0';
    platformEnvMock.bundleVersion = '1';
    resetAppUpdateState();
    resetPendingTask();
    jest.clearAllMocks();
    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('frozen target prevents task creation', async () => {
    setReadyState({
      freezeUntil: Date.now() + 60_000,
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.pendingTaskUpsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        upsertAction: 'drop',
        reason: 'frozen',
      }),
    );
  });

  test('ignored target prevents task creation', async () => {
    setReadyState({
      ignoredTargets: {
        '1.0.0:2': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() + 60_000,
        },
      },
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.pendingTaskUpsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        upsertAction: 'drop',
        reason: 'ignored_target',
      }),
    );
  });

  test('stale_request_seq drops incoming task', async () => {
    // Pre-populate with a task that has a revision higher than any nextRequestSeq can produce
    resetPendingTask(makeSwitchTask({ revision: Number.MAX_SAFE_INTEGER }));
    setReadyState();

    await service.readyToInstall();

    // Task should not be overwritten because existing revision > new requestSeq
    expect(pendingTaskValue).toMatchObject({
      revision: Number.MAX_SAFE_INTEGER,
    });
  });

  test('same_target_keep_retry_state preserves retry fields', async () => {
    const futureRetryAt = Date.now() + 30_000;
    resetPendingTask(
      makeSwitchTask({
        retryCount: 2,
        nextRetryAt: futureRetryAt,
        lastError: 'previous_error',
        status: 'pending',
        revision: 1,
      }),
    );
    setReadyState();

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      retryCount: 2,
      nextRetryAt: futureRetryAt,
      lastError: 'previous_error',
    });
  });

  test('existing_task_in_progress (different target) drops new task', async () => {
    resetPendingTask(
      makeSwitchTask({
        taskId: 'jsbundle:1.0.0:3',
        targetBundleVersion: '3',
        status: 'running',
        runningStartedAt: Date.now(),
        revision: 1,
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '3',
          signature: 'sig-3',
        },
      }),
    );
    setReadyState();

    await service.readyToInstall();

    // Running task should not be replaced
    expect(pendingTaskValue).toMatchObject({
      taskId: 'jsbundle:1.0.0:3',
      status: 'running',
    });
  });

  test('same_target_in_progress drops sync when taskId matches and status is running', async () => {
    resetPendingTask(
      makeSwitchTask({
        status: 'running',
        runningStartedAt: Date.now(),
        revision: 1,
      }),
    );
    setReadyState();

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      status: 'running',
      taskId: 'jsbundle:1.0.0:2',
    });
    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.pendingTaskUpsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        upsertAction: 'drop',
        reason: 'same_target_in_progress',
      }),
    );
  });

  test('replace_invalid_task replaces corrupt stored task', async () => {
    // Set a corrupt/invalid task in storage
    resetPendingTask({ garbage: true });
    setReadyState();

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      action: 'switch-bundle',
      targetBundleVersion: '2',
    });
    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.pendingTaskUpsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'replace_invalid_task',
      }),
    );
  });

  test('frozen target blocks readyToInstall scheduling', async () => {
    setReadyState({
      freezeUntil: Date.now() + 60_000,
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('non-seamless + appShellUpdate does not create pending task', async () => {
    setReadyState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.manual,
      downloadedEvent: {
        downloadedFile: '/tmp/app-2.0.0.pkg',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('frozen target blocks app-install scheduling', async () => {
    setReadyState({
      latestVersion: '2.0.0',
      jsBundleVersion: '1',
      freezeUntil: Date.now() + 60_000,
      downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      downloadedEvent: {
        downloadedFile: '/tmp/app-2.0.0.pkg',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('non-seamless + jsbundle-switch does not create pending task', async () => {
    setReadyState({
      updateStrategy: EUpdateStrategy.manual,
    });

    await service.readyToInstall();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('newer revision replaces different pending target with update log', async () => {
    resetPendingTask(
      makeSwitchTask({
        taskId: 'jsbundle:1.0.0:3',
        targetBundleVersion: '3',
        status: 'pending',
        revision: 1,
        payload: {
          appVersion: '1.0.0',
          bundleVersion: '3',
          signature: 'sig-3',
        },
      }),
    );
    setReadyState();

    await service.readyToInstall();

    expect(pendingTaskValue).toMatchObject({
      taskId: 'jsbundle:1.0.0:2',
      targetBundleVersion: '2',
    });
    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.pendingTaskUpsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        upsertAction: 'update',
        reason: 'newer_revision_replace_target',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Rollback: executeBundleSwitchTask falls back to builtin when bundle missing
// ---------------------------------------------------------------------------
describe('executeBundleSwitchTask rollback to builtin', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAppUpdateState();
    resetPendingTask();
    service = createService();
  });

  test('rollback target not found locally falls back to builtin bundle', async () => {
    // platformEnv.bundleVersion is '1', target is '0' (lower → rollback)
    const { BundleUpdate } =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update') as {
        BundleUpdate: Record<string, jest.Mock>;
      };
    BundleUpdate.isBundleExists.mockReset().mockResolvedValue(false);
    BundleUpdate.resetToBuiltInBundle.mockReset().mockResolvedValue(undefined);
    BundleUpdate.switchBundle.mockReset().mockResolvedValue(undefined);

    const rollbackTask = makeSwitchTask({
      taskId: 'jsbundle:1.0.0:0',
      targetBundleVersion: '0',
      payload: {
        appVersion: '1.0.0',
        bundleVersion: '0',
        signature: 'sig-0',
      },
    });

    // Call executeBundleSwitchTask directly via prototype.
    // It throws BUILTIN_FALLBACK_RELAUNCH after clearing the task and
    // triggering relaunch, so the caller's success path is skipped.
    const pendingService = service.backgroundApi.servicePendingInstallTask;
    const proto = Object.getPrototypeOf(pendingService);
    await expect(
      proto.executeBundleSwitchTask.call(pendingService, rollbackTask),
    ).rejects.toThrow('BUILTIN_FALLBACK_RELAUNCH');

    expect(BundleUpdate.resetToBuiltInBundle).toHaveBeenCalled();
    expect(BundleUpdate.restart).toHaveBeenCalled();
  });

  test('upgrade target not found locally throws BUNDLE_MISSING', async () => {
    const { BundleUpdate } =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update') as {
        BundleUpdate: Record<string, jest.Mock>;
      };
    BundleUpdate.isBundleExists.mockReset().mockResolvedValue(false);
    BundleUpdate.resetToBuiltInBundle.mockReset().mockResolvedValue(undefined);
    BundleUpdate.switchBundle.mockReset().mockResolvedValue(undefined);

    // target '2' > current '1' → upgrade, should throw
    const upgradeTask = makeSwitchTask({
      taskId: 'jsbundle:1.0.0:2',
      targetBundleVersion: '2',
      payload: {
        appVersion: '1.0.0',
        bundleVersion: '2',
        signature: 'sig-2',
      },
    });

    const pendingService = service.backgroundApi.servicePendingInstallTask;
    const proto = Object.getPrototypeOf(pendingService);
    await expect(
      proto.executeBundleSwitchTask.call(pendingService, upgradeTask),
    ).rejects.toThrow();

    expect(BundleUpdate.resetToBuiltInBundle).not.toHaveBeenCalled();
  });
});
