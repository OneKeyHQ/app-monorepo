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

const pendingInstallTaskStorage = {
  getPendingInstallTask: jest.fn(async () => pendingTaskValue),
  setPendingInstallTask: jest.fn(async (task: any) => {
    pendingTaskValue = task;
    return pendingTaskValue;
  }),
  clearPendingInstallTask: jest.fn(async () => {
    pendingTaskValue = undefined;
  }),
};

jest.mock('./pendingInstallTaskStorage', () => ({
  getPendingInstallTask: pendingInstallTaskStorage.getPendingInstallTask,
  setPendingInstallTask: pendingInstallTaskStorage.setPendingInstallTask,
  clearPendingInstallTask: pendingInstallTaskStorage.clearPendingInstallTask,
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
  return new ServiceAppUpdate({
    backgroundApi: {
      serviceApp: {
        resetLaunchTimesAfterUpdate: jest.fn(async () => undefined),
      },
    },
  });
}

function resetAppUpdateState(overrides?: Partial<IAppUpdateInfo>) {
  appUpdateState = { ...INITIAL_APP_UPDATE_VALUE, ...overrides };
}

function resetPendingTask(value: any = undefined) {
  pendingTaskValue = value;
}

function getUpdateLogEvents() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { defaultLogger } = require('@onekeyhq/shared/src/logger/logger') as {
    defaultLogger: {
      app: { appUpdate: { log: jest.Mock } };
    };
  };
  return defaultLogger.app.appUpdate.log.mock.calls
    .map(([message]: [string]) => {
      try {
        return JSON.parse(message) as {
          event?: string;
          [key: string]: unknown;
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
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

describe('ServiceAppUpdate pendingInstallTask scheduling', () => {
  let service: ReturnType<typeof createService>;

  function mockReleaseInfo(releaseInfo: Record<string, any>) {
    jest
      .spyOn(service, 'getAppLatestInfo')
      .mockResolvedValue(releaseInfo as any);
    jest.spyOn(service, 'isNeedSyncAppUpdateInfo').mockResolvedValue(true);
    jest.spyOn(service, 'refreshUpdateStatus').mockResolvedValue(undefined);
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

  test('creates pending task when appVersion is same and jsBundleVersion is different', async () => {
    mockReleaseInfo({
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

  test('writes structured fetch/decision/upsert logs', async () => {
    mockReleaseInfo({
      version: '1.0.0',
      jsBundleVersion: '2',
      jsBundle: {
        signature: 'sig-2',
      },
    });

    await service.fetchAppUpdateInfo(true);

    const events = getUpdateLogEvents();
    expect(
      events.some(
        (event) =>
          event.event === 'app_update_fetch_start' &&
          typeof event.traceId === 'string' &&
          typeof event.requestSeq === 'number',
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.event === 'app_update_decision_resolved' &&
          event.decision === 'jsBundleUpgrade',
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.event === 'pending_task_upsert_decision' &&
          event.upsertAction === 'create',
      ),
    ).toBe(true);
  });

  test('creates rollback pending task when remote jsBundleVersion is lower than local', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '3';
    mockReleaseInfo({
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

    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      targetAppVersion: '1.0.0',
      payload: {
        bundleVersion: '2',
      },
    });
  });

  test('same appVersion + same bundleVersion does not create pending task', async () => {
    mockReleaseInfo({
      version: '1.0.0',
      jsBundleVersion: '1',
      jsBundle: {
        downloadUrl: 'https://cdn.onekey.so/bundle-v1.zip',
        fileSize: 1024,
        sha256: 'sha256-1',
        signature: 'sig-1',
      },
    });

    await service.fetchAppUpdateInfo(true);

    expect(pendingTaskValue).toBeUndefined();
  });

  test('keeps existing pending task when release appVersion is different', async () => {
    const existingTask = makeSwitchTask({
      taskId: 'jsbundle:1.0.0:2',
      targetAppVersion: '1.0.0',
      targetBundleVersion: '2',
    });
    resetPendingTask(existingTask);
    mockReleaseInfo({
      version: '1.0.1',
      jsBundleVersion: '3',
      jsBundle: {
        downloadUrl: 'https://cdn.onekey.so/bundle-v3.zip',
        fileSize: 1024,
        sha256: 'sha256-3',
        signature: 'sig-3',
      },
    });

    await service.fetchAppUpdateInfo(true);

    expect(pendingTaskValue).toEqual(existingTask);
  });

  test('reset does not clear pending task storage', async () => {
    const task = makeSwitchTask({ taskId: 'task-persist' });
    resetPendingTask(task);
    jest.spyOn(service, 'fetchAppUpdateInfo').mockResolvedValue(appUpdateState);

    await service.reset();

    expect(pendingTaskValue).toEqual(task);
  });
});

describe('ServiceAppUpdate processPendingInstallTask', () => {
  let service: ReturnType<typeof createService>;
  let bundleUpdate: any;

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
    bundleUpdate =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update').BundleUpdate;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not call refreshUpdateStatus when no pending task', async () => {
    const refreshSpy = jest
      .spyOn(service, 'refreshUpdateStatus')
      .mockResolvedValue(undefined);

    await service.processPendingInstallTask();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  test('calls refreshUpdateStatus after pending task processing', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(true);
    const refreshSpy = jest
      .spyOn(service, 'refreshUpdateStatus')
      .mockResolvedValue(undefined);
    resetPendingTask(makeSwitchTask());

    await service.processPendingInstallTask();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  test('recovers stale running task to pending and schedules retry', async () => {
    resetPendingTask(
      makeSwitchTask({
        status: 'running',
        runningStartedAt: Date.now() - 10 * 60 * 1000,
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue.status).toBe('pending');
    expect(pendingTaskValue.retryCount).toBe(1);
    expect(pendingTaskValue.lastError).toBe('INTERRUPTED');
    expect(pendingTaskValue.nextRetryAt).toBeGreaterThan(Date.now());
  });

  test('drops task when scheduled env mismatches current env', async () => {
    resetPendingTask(
      makeSwitchTask({
        scheduledEnvAppVersion: '2.0.0',
        scheduledEnvBundleVersion: '99',
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('uses local bundle path when bundle already exists', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(true);
    resetPendingTask(makeSwitchTask());

    await service.processPendingInstallTask();

    expect(bundleUpdate.isBundleExists).toHaveBeenCalledWith('1.0.0', '2');
    expect(bundleUpdate.verifyExtractedBundle).toHaveBeenCalledWith(
      '1.0.0',
      '2',
    );
    expect(bundleUpdate.switchBundle).toHaveBeenCalledWith({
      appVersion: '1.0.0',
      bundleVersion: '2',
      signature: 'sig-2',
    });
    expect(pendingTaskValue.status).toBe('applied_waiting_verify');
  });

  test('writes structured switch logs when executing pending task', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(true);
    resetPendingTask(makeSwitchTask());

    await service.processPendingInstallTask();

    const events = getUpdateLogEvents();
    expect(
      events.some(
        (event) =>
          event.event === 'pending_switch_start' &&
          event.taskId === 'jsbundle:1.0.0:2',
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.event === 'pending_switch_result' &&
          event.result === 'success' &&
          event.taskId === 'jsbundle:1.0.0:2',
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.event === 'pending_post_process_refresh_result' &&
          event.result === 'success',
      ),
    ).toBe(true);
  });

  test('applied_waiting_verify is cleared when target env is aligned', async () => {
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '2';
    resetPendingTask(makeSwitchTask({ status: 'applied_waiting_verify' }));

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('bundle missing triggers full-flow retry and clears task', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(false);
    resetPendingTask(makeSwitchTask());

    await service.processPendingInstallTask();

    expect(bundleUpdate.downloadBundle).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget?.['1.0.0:2']?.count).toBe(1);
  });

  test('verifyExtractedBundle failure triggers full-flow retry', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(true);
    bundleUpdate.verifyExtractedBundle.mockRejectedValueOnce(
      new Error('corrupted'),
    );
    resetPendingTask(makeSwitchTask());

    await service.processPendingInstallTask();

    expect(bundleUpdate.clearBundle).toHaveBeenCalled();
    expect(bundleUpdate.switchBundle).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget?.['1.0.0:2']?.count).toBe(1);
  });

  test('failure writes retry backoff metadata', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(true);
    bundleUpdate.switchBundle.mockRejectedValue(new Error('switch failed'));
    resetPendingTask(makeSwitchTask({ retryCount: 0 }));

    await service.processPendingInstallTask();

    expect(pendingTaskValue.status).toBe('pending');
    expect(pendingTaskValue.retryCount).toBe(1);
    expect(pendingTaskValue.lastError).toContain('switch failed');
    expect(pendingTaskValue.nextRetryAt).toBeGreaterThan(Date.now());
    expect(pendingTaskValue.nextRetryAt - Date.now()).toBeGreaterThanOrEqual(
      30_000,
    );
    expect(pendingTaskValue.nextRetryAt - Date.now()).toBeLessThanOrEqual(
      35_000,
    );
  });

  test('max retry clears task and freezes/ignores target', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(true);
    bundleUpdate.switchBundle.mockRejectedValue(new Error('switch failed'));
    resetPendingTask(makeSwitchTask({ retryCount: 2 }));
    const now = Date.now();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.freezeUntil).toBeGreaterThan(now);
    expect(appUpdateState.ignoredTargets?.['1.0.0:2']?.reason).toBe(
      'RETRY_EXHAUSTED',
    );
  });

  test('full-flow retry exhaustion freezes and ignores target', async () => {
    bundleUpdate.isBundleExists.mockResolvedValue(false);
    resetAppUpdateState({
      fullFlowRetryByTarget: {
        '1.0.0:2': {
          count: 2,
          updatedAt: Date.now(),
        },
      },
    });
    resetPendingTask(makeSwitchTask());
    const now = Date.now();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.freezeUntil).toBeGreaterThan(now);
    expect(appUpdateState.ignoredTargets?.['1.0.0:2']?.reason).toBe(
      'FULL_FLOW_RETRY_EXHAUSTED',
    );
  });

  test('unknown task type is logged and dropped', async () => {
    resetPendingTask({
      taskId: 'unknown-task',
      type: 'unknown-task-type',
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    const events = getUpdateLogEvents();
    expect(
      events.some(
        (event) =>
          event.event === 'pending_task_unknown_type_dropped' &&
          event.taskType === 'unknown-task-type',
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.event === 'pending_task_cleared' &&
          event.clearReason === 'invalid_task_payload',
      ),
    ).toBe(true);
  });
});
