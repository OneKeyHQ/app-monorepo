/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { EUpdateStrategy } from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

let appUpdateState: IAppUpdateInfo = {
  latestVersion: '0.0.0',
  updateAt: 0,
  status: 'done' as any,
  updateStrategy: EUpdateStrategy.manual,
};
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
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  AppUpdate: {
    installPackage: jest.fn(async () => undefined),
  },
  BundleUpdate: {
    switchBundle: jest.fn(async () => undefined),
    isBundleExists: jest.fn(async () => true),
    verifyExtractedBundle: jest.fn(async () => undefined),
    clearBundle: jest.fn(async () => undefined),
    resetToBuiltInBundle: jest.fn(async () => undefined),
    restart: jest.fn(),
    getBuiltinBundleVersion: jest.fn(async () => ''),
    getNativeAppVersion: jest.fn(async () => '1.0.0'),
    getNativeBuildNumber: jest.fn(async () => '100'),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      appUpdate: {
        log: jest.fn(),
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
      error: { log: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
}));

jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: (fn: any) => fn,
  memoFn: (fn: any) => fn,
}));

function createService(refreshUpdateStatus = jest.fn(async () => undefined)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ServicePendingInstallTask } = require('./servicePendingInstallTask');
  return new ServicePendingInstallTask({ refreshUpdateStatus });
}

function setState(overrides: Partial<IAppUpdateInfo>) {
  appUpdateState = {
    latestVersion: '0.0.0',
    updateAt: 0,
    status: 'done' as any,
    updateStrategy: EUpdateStrategy.manual,
    ...overrides,
  };
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

function makeAppShellInstallTask(overrides: Record<string, any> = {}) {
  const now = Date.now();
  return {
    taskId: 'appShell:2.0.0:direct',
    revision: 1,
    action: 'install-app',
    type: 'app-install',
    targetAppVersion: '2.0.0',
    targetBundleVersion: '1',
    scheduledEnvAppVersion: '1.0.0',
    scheduledEnvBundleVersion: '1',
    createdAt: now - 1000,
    expiresAt: now + 60_000,
    retryCount: 0,
    status: 'pending',
    payload: {
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      channel: 'direct',
      downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
    },
    ...overrides,
  };
}

describe('servicePendingInstallTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.version = '1.0.0';
    platformEnvMock.bundleVersion = '1';
    pendingTaskValue = undefined;
    setState({});
  });

  test('fetch stage does not create pending task before resources are ready', async () => {
    const service = createService();
    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 1,
      traceId: 'trace-fetch',
      stage: 'fetch',
    });
    expect(pendingTaskValue).toBeUndefined();
  });

  test('ready_to_install stage creates pending jsbundle task', async () => {
    const service = createService();
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      jsBundle: { signature: 'sig-2' },
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'sha256-2',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 2,
      traceId: 'trace-ready',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      action: 'switch-bundle',
      targetAppVersion: '1.0.0',
      targetBundleVersion: '2',
    });
  });

  test('ready_to_install stage creates rollback jsbundle task when remote bundle is lower than local', async () => {
    const service = createService();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '3';
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 3,
      traceId: 'trace-rollback',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      targetAppVersion: '1.0.0',
      targetBundleVersion: '2',
      payload: {
        bundleVersion: '2',
      },
    });
  });

  test('ready_to_install stage does not create pending task when app and bundle are already aligned', async () => {
    const service = createService();
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '1',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v1.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v1.zip',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '1',
        updateStrategy: EUpdateStrategy.seamless,
      },
      requestSeq: 4,
      traceId: 'trace-aligned',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toBeUndefined();
  });

  test('ready_to_install stage does not create pending task for non-seamless strategy', async () => {
    const service = createService();
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.manual,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.manual,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 5,
      traceId: 'trace-manual',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toBeUndefined();
  });

  test('newer requestSeq replaces existing pending target even when new bundle version is lower', async () => {
    const service = createService();
    pendingTaskValue = makeSwitchTask({
      taskId: 'jsbundle:1.0.0:2',
      revision: 1,
      targetBundleVersion: '2',
      payload: {
        appVersion: '1.0.0',
        bundleVersion: '2',
        signature: 'sig-2',
      },
    });
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '0',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v0.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v0.zip',
        signature: 'sig-0',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '0',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: { signature: 'sig-0' },
      },
      requestSeq: 6,
      traceId: 'trace-replace-lower',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toMatchObject({
      taskId: 'jsbundle:1.0.0:0',
      revision: 6,
      targetBundleVersion: '0',
      payload: {
        bundleVersion: '0',
        signature: 'sig-0',
      },
    });
  });

  test('processPendingInstallTask runs task and refreshes status', async () => {
    const refresh = jest.fn(async () => undefined);
    const service = createService(refresh);
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pendingTaskValue.status).toBe('applied_waiting_verify');
  });

  test('drops task when scheduled env mismatches current env', async () => {
    const service = createService();
    pendingTaskValue = makeSwitchTask({
      scheduledEnvAppVersion: '2.0.0',
      scheduledEnvBundleVersion: '99',
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('stale running task is recovered to pending with retry', async () => {
    const service = createService();
    pendingTaskValue = makeSwitchTask({
      status: 'running',
      runningStartedAt: Date.now() - 10 * 60 * 1000,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue.status).toBe('pending');
    expect(pendingTaskValue.retryCount).toBe(1);
    expect(pendingTaskValue.lastError).toBe('INTERRUPTED');
  });

  test('executes app shell install task when package is ready', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        downloadedFile: '/tmp/app-2.0.0.pkg',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(autoUpdate.AppUpdate.installPackage).toHaveBeenCalled();
    expect(pendingTaskValue.status).toBe('applied_waiting_verify');
  });

  test('bundle missing triggers full-flow retry and clears task', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(false);
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget?.['1.0.0:2']?.count).toBe(1);
  });

  test('unknown task type is dropped', async () => {
    const service = createService();
    pendingTaskValue = {
      taskId: 'unknown-task',
      type: 'unknown-task-type',
    };

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('ignored target with expired expiresAt allows task creation', async () => {
    const service = createService();
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
      },
      ignoredTargets: {
        '1.0.0:2': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now() - 100_000,
          expiresAt: Date.now() - 1, // expired
        },
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 10,
      traceId: 'trace-expired-ignored',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      targetBundleVersion: '2',
    });
  });

  test('same revision and same target is noop', async () => {
    const service = createService();
    pendingTaskValue = makeSwitchTask({ revision: 10 });
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 10,
      traceId: 'trace-same-rev',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    const logger = require('@onekeyhq/shared/src/logger/logger').defaultLogger
      .app.appUpdate;
    expect(logger.pendingTaskUpsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        upsertAction: 'noop',
        reason: 'same_revision_same_target',
      }),
    );
  });

  test('app-install target already aligned clears task', async () => {
    const service = createService();
    // Target app version matches current env
    pendingTaskValue = makeAppShellInstallTask({
      targetAppVersion: '1.0.0',
      targetBundleVersion: '1',
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('frozen target blocks app-install sync', async () => {
    const service = createService();
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      freezeUntil: Date.now() + 60_000,
      downloadedEvent: {
        downloadedFile: '/tmp/app-2.0.0.pkg',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '2.0.0',
        jsBundleVersion: '1',
        updateStrategy: EUpdateStrategy.seamless,
      },
      requestSeq: 20,
      traceId: 'trace-frozen-appshell',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

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

  test('ignored target blocks app-install sync', async () => {
    const service = createService();
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      ignoredTargets: {
        '2.0.0:1': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() + 60_000,
        },
      },
      downloadedEvent: {
        downloadedFile: '/tmp/app-2.0.0.pkg',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '2.0.0',
        jsBundleVersion: '1',
        updateStrategy: EUpdateStrategy.seamless,
      },
      requestSeq: 21,
      traceId: 'trace-ignored-appshell',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    expect(pendingTaskValue).toBeUndefined();
  });

  test('expired app-install task is cleared', async () => {
    const service = createService();
    pendingTaskValue = makeAppShellInstallTask({
      expiresAt: Date.now() - 1,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('app-install retry exhausted freezes target', async () => {
    const service = createService();
    setState({
      downloadedEvent: undefined,
    });
    pendingTaskValue = makeAppShellInstallTask({ retryCount: 2 });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
    expect(appUpdateState.ignoredTargets?.['2.0.0:1']).toMatchObject({
      reason: 'RETRY_EXHAUSTED',
    });
  });

  test('jsbundle-switch in applied_waiting_verify within grace period is skipped', async () => {
    const service = createService();
    pendingTaskValue = makeSwitchTask({
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now() - 60_000, // 1 minute ago, within 10min grace
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'applied_waiting_verify',
      type: 'jsbundle-switch',
    });
  });

  test('applied_waiting_verify with runningStartedAt=undefined skips grace period and checks alignment', async () => {
    const service = createService();
    // Target doesn't match current env (bundleVersion 2 vs current 1)
    pendingTaskValue = makeSwitchTask({
      status: 'applied_waiting_verify',
      runningStartedAt: undefined,
    });

    await service.processPendingInstallTask();

    // Should immediately check alignment (not wait for grace period)
    // Target is 1.0.0:2, current is 1.0.0:1 → mismatch → retry
    expect(pendingTaskValue.status).toBe('pending');
    expect(pendingTaskValue.retryCount).toBe(1);
    expect(pendingTaskValue.lastError).toBe('VERIFY_AFTER_RESTART_MISMATCH');
  });

  test('rollback with non-seamless strategy still creates pending task', async () => {
    const service = createService();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '3';
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.manual,
      downloadedEvent: {
        downloadedFile: '/tmp/bundle-v2.zip',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.manual,
        jsBundle: { signature: 'sig-2' },
      },
      requestSeq: 30,
      traceId: 'trace-rollback-manual',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });

    // Rollback should bypass strategy check and create task
    expect(pendingTaskValue).toMatchObject({
      type: 'jsbundle-switch',
      targetBundleVersion: '2',
    });
  });

  test('fullFlowRetryCount exceeds MAX_FULL_FLOW_RETRY freezes target', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(false);

    // Run 3 times: each run increments fullFlowRetryCount (1, 2, 3).
    // MAX_FULL_FLOW_RETRY = 2, so the third run (count=3) should freeze.
    for (let i = 0; i < 3; i += 1) {
      pendingTaskValue = makeSwitchTask();
      await service.processPendingInstallTask();
      expect(pendingTaskValue).toBeUndefined();
    }

    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
    expect(appUpdateState.ignoredTargets?.['1.0.0:2']).toMatchObject({
      reason: 'FULL_FLOW_RETRY_EXHAUSTED',
    });
  });

  test('nextRequestSeq falls back to timestamp-based seq when lastRequestSeq is 0', async () => {
    const service = createService();
    setState({ lastRequestSeq: 0 } as any);

    const seq = await service.nextRequestSeq();

    // When lastRequestSeq is 0, fallback uses Date.now() * 1000 + counter
    expect(seq).toBeGreaterThan(Date.now() * 999);
  });
});
