/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EUpdateErrorCode,
  createUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

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
    getObject: jest.fn(() => pendingTaskValue),
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
    isDesktop: true,
  },
}));

const appEventBus = {
  emit: jest.fn(),
};

const EAppEventBusNames = {
  PendingInstallTaskProcessFinished: 'PendingInstallTaskProcessFinished',
  StartAutoDownloadUpdate: 'StartAutoDownloadUpdate',
};

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  __esModule: true,
  appEventBus,
  EAppEventBusNames,
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  AppUpdate: {
    checkPackageAvailability: jest.fn(async () => ({
      status: 'notApplicable',
    })),
    installPackage: jest.fn(async () => true),
  },
  BundleUpdate: {
    switchBundle: jest.fn(async () => undefined),
    isBundleExists: jest.fn(async () => true),
    verifyExtractedBundle: jest.fn(async () => undefined),
    clearBundle: jest.fn(async () => undefined),
    clearDownload: jest.fn(async () => undefined),
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

function createBackgroundApiMock() {
  return {
    serviceAppUpdate: {
      // Desktop app-install execution is gated by canRestartForUpdate.
      canRestartForUpdate: jest.fn(async () => true),
    },
  };
}

function createService(refreshUpdateStatus = jest.fn(async () => undefined)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ServicePendingInstallTask } = require('./servicePendingInstallTask');
  return new ServicePendingInstallTask({
    backgroundApi: createBackgroundApiMock(),
    refreshUpdateStatus,
  });
}

function setState(overrides: Partial<IAppUpdateInfo>) {
  appUpdateState = {
    latestVersion: '0.0.0',
    updateAt: 0,
    status: 'done' as any,
    updateStrategy: EUpdateStrategy.manual,
    ...(overrides.status === EAppUpdateStatus.ready
      ? { readyAt: Date.now() - 1000 }
      : undefined),
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
  const originalDesktopApi = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApi',
  );
  beforeEach(() => {
    jest.clearAllMocks();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.version = '1.0.0';
    platformEnvMock.bundleVersion = '1';
    pendingTaskValue = undefined;
    setState({});
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: { processStartAt: Date.now() },
    });
  });

  afterEach(() => {
    if (originalDesktopApi)
      Object.defineProperty(globalThis, 'desktopApi', originalDesktopApi);
    else Reflect.deleteProperty(globalThis, 'desktopApi');
  });

  test('emits process finished event when there is no pending task', async () => {
    const service = createService();

    await service.processPendingInstallTask();

    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.PendingInstallTaskProcessFinished,
      undefined,
    );
  });

  test.each(['isDesktopMac', 'isDesktopWin', 'isDesktopLinux'])(
    'recovers a verified manual app update without a pending task on %s startup',
    async (platformFlag) => {
      const env = require('@onekeyhq/shared/src/platformEnv').default;
      const previous = env[platformFlag];
      env[platformFlag] = true;
      const {
        AppUpdate,
      } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      setState({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.manual,
        downloadUrl: 'feedUrl',
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
      });
      const service = createService();
      try {
        await service.processPendingInstallTask();

        expect(AppUpdate.installPackage).toHaveBeenCalledWith(
          expect.objectContaining({
            latestVersion: '2.0.0',
            installSource: 'startup',
            downloadedEvent: expect.objectContaining({
              downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
            }),
          }),
        );
        expect(pendingTaskValue).toMatchObject({
          type: 'app-install',
          status: 'applied_waiting_verify',
        });
        await service.processPendingInstallTask();
        expect(AppUpdate.installPackage).toHaveBeenCalledTimes(1);
      } finally {
        env[platformFlag] = previous;
      }
    },
  );

  test.each([
    { isDesktop: false },
    { isDesktopStore: true },
    { storeUrl: 'https://store.onekey.test/app' },
    { updateStrategy: EUpdateStrategy.force },
    { status: EAppUpdateStatus.verifyPackage },
    { latestVersion: '1.0.0', jsBundleVersion: '2' },
  ])(
    'does not recover a manual app update outside the desktop ready flow: %j',
    async (override) => {
      const env = require('@onekeyhq/shared/src/platformEnv').default;
      const previous = {
        isDesktop: env.isDesktop,
        isDesktopStore: env.isDesktopStore,
      };
      const { isDesktop, isDesktopStore, ...stateOverride } = override;
      Object.assign(env, {
        isDesktop: isDesktop ?? true,
        isDesktopStore: isDesktopStore ?? false,
      });
      const {
        AppUpdate,
      } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      setState({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
        ...stateOverride,
      });
      try {
        await createService().processPendingInstallTask();
        expect(pendingTaskValue).toBeUndefined();
        expect(AppUpdate.installPackage).not.toHaveBeenCalled();
      } finally {
        Object.assign(env, previous);
      }
    },
  );

  test('renderer reload leaves a manual ready update pending until the next native process starts', async () => {
    const readyAt = Date.now() - 1000;
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'desktopApi',
    );
    const {
      AppUpdate,
    } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    setState({
      status: EAppUpdateStatus.ready,
      latestVersion: '2.0.0',
      readyAt,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: { processStartAt: readyAt - 1000 },
    });
    try {
      await createService().processPendingInstallTask();
      expect(AppUpdate.installPackage).not.toHaveBeenCalled();
      expect(pendingTaskValue.status).toBe('pending');

      Object.defineProperty(globalThis, 'desktopApi', {
        configurable: true,
        value: { processStartAt: readyAt + 1000 },
      });
      await createService().processPendingInstallTask();
      expect(AppUpdate.installPackage).toHaveBeenCalledTimes(1);
      expect(pendingTaskValue.status).toBe('applied_waiting_verify');
    } finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'desktopApi', descriptor);
      else Reflect.deleteProperty(globalThis, 'desktopApi');
    }
  });

  test.each(['cancelled', 'busy', 'not_started'] as const)(
    'a %s manual startup attempt survives rescheduling and renderer reload without retrying',
    async (result) => {
      const {
        AppUpdate,
      } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      const now = Date.now();
      const processStartAt = now - 1000;
      setState({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        readyAt: now - 2000,
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
      });
      pendingTaskValue = makeAppShellInstallTask({
        payload: {
          ...makeAppShellInstallTask().payload,
          updateStrategy: EUpdateStrategy.manual,
        },
      });
      Object.defineProperty(globalThis, 'desktopApi', {
        configurable: true,
        value: { processStartAt },
      });
      const service = createService();
      if (result === 'busy') {
        jest
          .spyOn(service.backgroundApi.serviceAppUpdate, 'canRestartForUpdate')
          .mockResolvedValueOnce(false);
      } else if (result === 'cancelled') {
        AppUpdate.installPackage.mockRejectedValueOnce(
          createUpdateError({
            code: EUpdateErrorCode.cancelled,
            step: 'install',
          }),
        );
      } else {
        AppUpdate.installPackage.mockResolvedValueOnce(false);
      }

      await service.processPendingInstallTask();
      expect(pendingTaskValue).toMatchObject({
        status: 'pending',
        retryCount: 0,
        startupProcessStartAt: processStartAt,
      });
      expect(appUpdateState.installSource).not.toBe('startup');
      await service.syncPendingInstallTaskWithReleaseInfo({
        releaseInfo: {
          version: '2.0.0',
          updateStrategy: EUpdateStrategy.manual,
        },
        requestSeq: await service.nextRequestSeq(),
        traceId: 'reschedule-same-native-process',
        stage: 'ready_to_install',
        appInfo: appUpdateState,
      });
      await createService().processPendingInstallTask();
      expect(AppUpdate.installPackage).toHaveBeenCalledTimes(
        result === 'busy' ? 0 : 1,
      );
      expect(pendingTaskValue.status).toBe('pending');

      Object.defineProperty(globalThis, 'desktopApi', {
        configurable: true,
        value: { processStartAt: now },
      });
      await createService().processPendingInstallTask();
      expect(AppUpdate.installPackage).toHaveBeenCalledTimes(
        result === 'busy' ? 1 : 2,
      );
      expect(pendingTaskValue.status).toBe('applied_waiting_verify');
    },
  );

  test('manual startup without a stable native process identifier leaves the update pending', async () => {
    const {
      AppUpdate,
    } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    setState({
      status: EAppUpdateStatus.ready,
      latestVersion: '2.0.0',
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: {},
    });

    await createService().processPendingInstallTask();
    await createService().processPendingInstallTask();

    expect(AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(pendingTaskValue.status).toBe('pending');
    expect(appUpdateState.status).toBe(EAppUpdateStatus.ready);
  });

  test('a cleared eight-day-old manual task cannot be recovered on a later launch', async () => {
    const {
      AppUpdate,
    } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    const day = 24 * 60 * 60 * 1000;
    const readyAt = Date.now() - 8 * day;
    setState({
      status: EAppUpdateStatus.ready,
      latestVersion: '2.0.0',
      readyAt,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({
      createdAt: readyAt,
      expiresAt: readyAt + 7 * day,
      payload: {
        ...makeAppShellInstallTask().payload,
        updateStrategy: EUpdateStrategy.manual,
      },
    });

    await createService().processPendingInstallTask();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.ready);
    const service = createService();
    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: { version: '2.0.0', updateStrategy: EUpdateStrategy.manual },
      requestSeq: await service.nextRequestSeq(),
      traceId: 'expired-ready-reschedule',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });
    expect(pendingTaskValue).toBeUndefined();
    await createService().processPendingInstallTask();
    expect(pendingTaskValue).toBeUndefined();
    expect(AppUpdate.installPackage).not.toHaveBeenCalled();
  });

  test.each([undefined, Number.NaN, Date.now() + 60_000])(
    'legacy ready without a trustworthy age (%s) is left for explicit installation',
    async (readyAt) => {
      const {
        AppUpdate,
      } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      setState({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        readyAt,
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
      });
      await createService().processPendingInstallTask();
      expect(pendingTaskValue).toBeUndefined();
      expect(AppUpdate.installPackage).not.toHaveBeenCalled();
      expect(appUpdateState.status).toBe(EAppUpdateStatus.ready);
    },
  );

  test('recovering and rescheduling a six-day-old manual update keeps its original expiry', async () => {
    const {
      AppUpdate,
    } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    const day = 24 * 60 * 60 * 1000;
    const readyAt = Date.now() - 6 * day;
    setState({
      status: EAppUpdateStatus.ready,
      latestVersion: '2.0.0',
      readyAt,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    AppUpdate.installPackage.mockResolvedValueOnce(false);
    const service = createService();
    await service.processPendingInstallTask();
    const expiresAt = readyAt + 7 * day;
    expect(pendingTaskValue).toMatchObject({
      createdAt: readyAt,
      expiresAt,
      status: 'pending',
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: { version: '2.0.0', updateStrategy: EUpdateStrategy.manual },
      requestSeq: await service.nextRequestSeq(),
      traceId: 'preserve-ready-age',
      stage: 'ready_to_install',
      appInfo: appUpdateState,
    });
    expect(pendingTaskValue).toMatchObject({ createdAt: readyAt, expiresAt });
  });

  test.each([
    { freezeUntil: Date.now() + 60_000 },
    {
      ignoredTargets: {
        '2.0.0:1': {
          reason: 'RETRY_EXHAUSTED',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      },
    },
    {
      downloadedEvent: {
        latestVersion: '3.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-3.0.0.pkg',
      },
    },
  ])(
    'startup recovery preserves the target and retry controls: %j',
    async (override) => {
      const {
        AppUpdate,
      } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      setState({
        status: EAppUpdateStatus.ready,
        latestVersion: '2.0.0',
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
        ...override,
      });

      await createService().processPendingInstallTask();

      expect(pendingTaskValue).toBeUndefined();
      expect(AppUpdate.installPackage).not.toHaveBeenCalled();
    },
  );

  test('does not emit process finished event when bundle switch succeeds and restart is expected', async () => {
    const service = createService();
    const { defaultLogger } = require('@onekeyhq/shared/src/logger/logger');
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.PendingInstallTaskProcessFinished,
      undefined,
    );
    expect(
      defaultLogger.app.appUpdate.pendingSwitchResult,
    ).toHaveBeenCalledTimes(1);
    expect(
      defaultLogger.app.appUpdate.pendingSwitchResult,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'restart_requested' }),
    );
  });

  test('emits process finished event when bundle switch fails without scheduling restart', async () => {
    const service = createService();
    const {
      BundleUpdate,
    } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    pendingTaskValue = makeSwitchTask();
    BundleUpdate.switchBundle.mockRejectedValueOnce(
      createUpdateError({ code: EUpdateErrorCode.unknown, step: 'install' }),
    );

    await service.processPendingInstallTask();

    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.PendingInstallTaskProcessFinished,
      undefined,
    );
  });

  test.each(['bundle', 'builtin'])(
    '%s restart records the request before returning and retries a delayed failure',
    async (restartTarget) => {
      jest.useFakeTimers();
      try {
        const service = createService();
        const {
          BundleUpdate,
        } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
        const { defaultLogger } = require('@onekeyhq/shared/src/logger/logger');
        const isBuiltinFallback = restartTarget === 'builtin';
        pendingTaskValue = makeSwitchTask(
          isBuiltinFallback
            ? {
                targetBundleVersion: '0',
                payload: {
                  appVersion: '1.0.0',
                  bundleVersion: '0',
                  signature: 'signature',
                },
              }
            : {},
        );
        if (isBuiltinFallback) {
          BundleUpdate.isBundleExists.mockResolvedValueOnce(false);
        }
        const restart = isBuiltinFallback
          ? BundleUpdate.restart
          : BundleUpdate.switchBundle;
        restart.mockImplementationOnce(
          () =>
            new Promise<void>((_resolve, reject) => {
              setTimeout(
                () =>
                  reject(
                    createUpdateError({
                      code: EUpdateErrorCode.installFailed,
                      step: 'install',
                    }),
                  ),
                2500,
              );
            }),
        );
        const processing = service.processPendingInstallTask();
        await jest.advanceTimersByTimeAsync(0);
        if (isBuiltinFallback) {
          expect(pendingTaskValue).toBeUndefined();
        } else {
          expect(pendingTaskValue.status).toBe('applied_waiting_verify');
        }
        expect(
          defaultLogger.app.appUpdate.pendingSwitchResult,
        ).toHaveBeenCalledTimes(1);
        expect(
          defaultLogger.app.appUpdate.pendingSwitchResult,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            result: isBuiltinFallback
              ? 'builtin_fallback_restart_requested'
              : 'restart_requested',
          }),
        );

        await jest.advanceTimersByTimeAsync(2500);
        await processing;
        expect(pendingTaskValue).toMatchObject({
          status: 'pending',
          retryCount: 1,
          lastError: EUpdateErrorCode.installFailed,
        });
        expect(appEventBus.emit).toHaveBeenCalledWith(
          EAppEventBusNames.PendingInstallTaskProcessFinished,
          undefined,
        );
        expect(
          defaultLogger.app.appUpdate.pendingSwitchResult,
        ).toHaveBeenLastCalledWith(
          expect.objectContaining({
            result: 'fail',
            errorCode: EUpdateErrorCode.installFailed,
          }),
          'error',
        );
      } finally {
        jest.useRealTimers();
      }
    },
  );

  test('builtin fallback restart failure is retried instead of discarded', async () => {
    const service = createService();
    const {
      BundleUpdate,
    } = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    pendingTaskValue = makeSwitchTask({
      targetBundleVersion: '0',
      payload: {
        appVersion: '1.0.0',
        bundleVersion: '0',
        signature: 'signature',
      },
    });
    BundleUpdate.isBundleExists.mockResolvedValueOnce(false);
    BundleUpdate.restart.mockRejectedValueOnce(
      createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'install',
      }),
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: EUpdateErrorCode.installFailed,
    });
    expect(BundleUpdate.resetToBuiltInBundle).toHaveBeenCalledTimes(1);
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.PendingInstallTaskProcessFinished,
      undefined,
    );
  });

  test('fetch stage does not create pending task before resources are ready', async () => {
    const service = createService();
    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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
      status: 'verifyPackage' as any,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      jsBundle: {
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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

  test.each(['new target', 'incomplete status'])(
    'does not persist an old target after native-version lookup overlaps %s',
    async (change) => {
      const service = createService();
      const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      let lookupStarted!: () => void;
      let finishLookup!: (version: string) => void;
      const started = new Promise<void>((resolve) => {
        lookupStarted = resolve;
      });
      autoUpdate.BundleUpdate.getNativeAppVersion.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finishLookup = resolve;
            lookupStarted();
          }),
      );
      setState({
        status: 'verifyPackage' as any,
        latestVersion: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
        },
        downloadedEvent: {
          latestVersion: '1.0.0',
          bundleVersion: '2',
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
        },
      });
      const scheduling = service.syncPendingInstallTaskWithReleaseInfo({
        releaseInfo: {
          version: '1.0.0',
          jsBundleVersion: '2',
          updateStrategy: EUpdateStrategy.seamless,
          jsBundle: {
            downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
            signature: 'sig-2',
            sha256: 'a'.repeat(64),
          },
        },
        requestSeq: 2,
        traceId: 'trace-old-ready',
        stage: 'ready_to_install',
        appInfo: appUpdateState,
      });
      await started;
      setState({
        status:
          change === 'incomplete status'
            ? ('updateIncomplete' as any)
            : ('verifyPackage' as any),
        latestVersion: '1.0.0',
        jsBundleVersion: change === 'new target' ? '3' : '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          downloadUrl: `https://cdn.onekey.so/bundle-v${change === 'new target' ? '3' : '2'}.zip`,
          signature: change === 'new target' ? 'sig-3' : 'sig-2',
          sha256: (change === 'new target' ? 'b' : 'a').repeat(64),
        },
        downloadedEvent:
          change === 'new target'
            ? undefined
            : {
                latestVersion: '1.0.0',
                bundleVersion: '2',
                downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
                signature: 'sig-2',
                sha256: 'a'.repeat(64),
              },
      });
      finishLookup('1.0.0');
      await scheduling;

      expect(pendingTaskValue).toBeUndefined();
    },
  );

  test('ready_to_install stage creates rollback jsbundle task when remote bundle is lower than local', async () => {
    const service = createService();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '3';
    setState({
      status: 'verifyPackage' as any,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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
        latestVersion: '1.0.0',
        bundleVersion: '1',
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
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.manual,
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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
      status: 'verifyPackage' as any,
      latestVersion: '1.0.0',
      jsBundleVersion: '0',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '0',
        downloadUrl: 'https://cdn.onekey.so/bundle-v0.zip',
        signature: 'sig-0',
        sha256: 'b'.repeat(64),
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '0',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          signature: 'sig-0',
          sha256: 'b'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v0.zip',
        },
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
    expect(pendingTaskValue.lastError).toBe(EUpdateErrorCode.unknown);
  });

  test('running app install is cleared immediately after the target app starts', async () => {
    const service = createService();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    platformEnvMock.version = '2.0.0';
    pendingTaskValue = makeAppShellInstallTask({
      status: 'running',
      runningStartedAt: Date.now(),
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
  });

  test('executes app shell install task when package is ready', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    let statusDuringInstall: string | undefined;
    autoUpdate.AppUpdate.installPackage.mockImplementationOnce(async () => {
      statusDuringInstall = pendingTaskValue?.status;
      return true;
    });
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(autoUpdate.AppUpdate.installPackage).toHaveBeenCalled();
    expect(statusDuringInstall).toBe('applied_waiting_verify');
    expect(pendingTaskValue.status).toBe('applied_waiting_verify');
  });

  test('cancelled app shell install remains pending without retrying', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.installPackage.mockResolvedValueOnce(false);
    setState({
      latestVersion: '2.0.0',
      status: 'ready' as any,
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    const result = await service.processPendingInstallTask();

    expect(result).toBeUndefined();
    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 0,
      runningStartedAt: undefined,
    });
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.PendingInstallTaskProcessFinished,
      undefined,
    );
  });

  test('missing app shell package triggers full-flow re-download', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.checkPackageAvailability.mockResolvedValueOnce({
      status: 'missing',
    });
    setState({
      latestVersion: '2.0.0',
      status: 'ready' as any,
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe('notify');
    expect(appUpdateState.downloadedEvent).toBeUndefined();
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      { decision: 'appShellPackageRecovery' },
    );
  });

  test('unavailable app shell package is terminal without full-flow re-download', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.checkPackageAvailability.mockResolvedValueOnce({
      status: 'unavailable',
      errorCode: 'EACCES',
    });
    setState({
      latestVersion: '2.0.0',
      status: 'ready' as any,
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.verifyPackageFailed);
    expect(appUpdateState.updateError).toMatchObject({
      code: EUpdateErrorCode.storageError,
      step: 'install',
    });
    expect(appUpdateState.fullFlowRetryByTarget).toEqual({});
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      expect.anything(),
    );
  });

  test('already invalidated app package does not consume the retry budget twice', async () => {
    const service = createService();
    setState({
      latestVersion: '2.0.0',
      status: 'notify' as any,
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: undefined,
      fullFlowRetryByTarget: {
        'recovery:2.0.0:1': { count: 1, updatedAt: Date.now() },
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(
      appUpdateState.fullFlowRetryByTarget?.['recovery:2.0.0:1']?.count,
    ).toBe(1);
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      expect.anything(),
    );
  });

  test('reconciliation recovery budget does not exhaust pending full-flow retries', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.checkPackageAvailability.mockResolvedValueOnce({
      status: 'missing',
    });
    setState({
      latestVersion: '2.0.0',
      status: 'ready' as any,
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
      fullFlowRetryByTarget: {
        'recovery:2.0.0:1': { count: 2, updatedAt: Date.now() },
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe('notify');
    expect(
      appUpdateState.fullFlowRetryByTarget?.['recovery:2.0.0:1']?.count,
    ).toBe(2);
    expect(appUpdateState.fullFlowRetryByTarget?.['2.0.0:1']?.count).toBe(1);
    expect(appUpdateState.freezeUntil).toBeUndefined();
    expect(appUpdateState.ignoredTargets?.['2.0.0:1']).toBeUndefined();
  });

  test('exhausted app package recovery enters updateIncomplete', async () => {
    const refreshUpdateStatus = jest.fn(async (): Promise<undefined> => {
      setState({ status: 'notify' as any });
      return undefined;
    });
    const service = createService(refreshUpdateStatus);
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.checkPackageAvailability.mockResolvedValueOnce({
      status: 'missing',
    });
    setState({
      latestVersion: '2.0.0',
      status: 'ready' as any,
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
      fullFlowRetryByTarget: {
        '2.0.0:1': { count: 2, updatedAt: Date.now() },
      },
    });
    pendingTaskValue = makeAppShellInstallTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe('updateIncomplete');
    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
    expect(appUpdateState.ignoredTargets?.['2.0.0:1']).toMatchObject({
      reason: 'FULL_FLOW_RETRY_EXHAUSTED',
    });
    expect(refreshUpdateStatus).not.toHaveBeenCalled();
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      expect.anything(),
    );
  });

  test('unverified app package enters bounded full-flow recovery', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.checkPackageAvailability.mockResolvedValueOnce({
      status: 'notPrepared',
    });
    setState({
      latestVersion: '2.0.0',
      status: 'ready' as any,
      updateStrategy: EUpdateStrategy.silent,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({
      payload: {
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.silent,
        channel: 'direct',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });

    await service.processPendingInstallTask();

    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe('notify');
    expect(appUpdateState.downloadedEvent).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget?.['2.0.0:1']?.count).toBe(1);
    expect(appUpdateState.freezeUntil).toBeUndefined();
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      { decision: 'appShellPackageRecovery' },
    );
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
      status: 'verifyPackage' as any,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
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
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.seamless,
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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
    setState({
      fullFlowRetryByTarget: {
        '1.0.0:1': { count: 1, updatedAt: Date.now() },
        'recovery:1.0.0:1': { count: 2, updatedAt: Date.now() },
      },
    });
    // Target app version matches current env
    pendingTaskValue = makeAppShellInstallTask({
      targetAppVersion: '1.0.0',
      targetBundleVersion: '1',
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget).toEqual({});
  });

  test('frozen target blocks app-install sync', async () => {
    const service = createService();
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      freezeUntil: Date.now() + 60_000,
      downloadedEvent: {
        latestVersion: '2.0.0',
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
        latestVersion: '2.0.0',
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
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.AppUpdate.installPackage.mockRejectedValueOnce(
      createUpdateError({
        code: EUpdateErrorCode.networkError,
        step: 'install',
      }),
    );
    setState({
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({ retryCount: 2 });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
    expect(appUpdateState.ignoredTargets?.['2.0.0:1']).toMatchObject({
      reason: 'RETRY_EXHAUSTED',
    });
  });

  test('jsbundle-switch restart mismatch is terminal without a retry', async () => {
    const service = createService();
    pendingTaskValue = makeSwitchTask({
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now() - 60_000,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget).toEqual({});
  });

  test('applied_waiting_verify without a start time still terminates on mismatch', async () => {
    const service = createService();
    // Target doesn't match current env (bundleVersion 2 vs current 1)
    pendingTaskValue = makeSwitchTask({
      status: 'applied_waiting_verify',
      runningStartedAt: undefined,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget).toEqual({});
  });

  test('unconfirmed app install stays in its verification grace period', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    setState({
      latestVersion: '2.0.0',
      status: EAppUpdateStatus.ready,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({
      status: 'applied_waiting_verify',
      runningStartedAt: undefined,
      createdAt: Date.now() - 60_000,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'applied_waiting_verify',
      retryCount: 0,
    });
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.ready);
    expect(appUpdateState.downloadedEvent?.downloadUrl).toBe(
      'https://cdn.onekey.so/app-2.0.0.pkg',
    );
  });

  test('unconfirmed app install retries after grace without reopening the installer immediately', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    setState({
      latestVersion: '2.0.0',
      status: EAppUpdateStatus.ready,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now() - 11 * 60_000,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toMatchObject({
      status: 'pending',
      retryCount: 1,
      lastError: EUpdateErrorCode.unknown,
    });
    expect(pendingTaskValue.nextRetryAt).toBeGreaterThan(Date.now());
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.ready);
    expect(appUpdateState.downloadedEvent?.downloadUrl).toBe(
      'https://cdn.onekey.so/app-2.0.0.pkg',
    );

    await service.processPendingInstallTask();
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
  });

  test('unconfirmed app install exhausts its retry budget without looping', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    pendingTaskValue = makeAppShellInstallTask({
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now() - 11 * 60_000,
      retryCount: 2,
    });

    await service.processPendingInstallTask();
    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.ignoredTargets?.['2.0.0:1']).toMatchObject({
      reason: 'RETRY_EXHAUSTED',
    });
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
  });

  test('aligned app install clears without waiting for its grace period', async () => {
    const service = createService();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.version = '2.0.0';
    pendingTaskValue = makeAppShellInstallTask({
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now(),
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
  });

  test('unconfirmed old app install cannot overwrite a replacement task', async () => {
    const service = createService();
    const { defaultLogger } = require('@onekeyhq/shared/src/logger/logger');
    const replacement = makeAppShellInstallTask({
      taskId: 'appShell:3.0.0:direct',
      revision: 2,
      targetAppVersion: '3.0.0',
      payload: {
        latestVersion: '3.0.0',
        updateStrategy: EUpdateStrategy.seamless,
        channel: 'direct',
        downloadUrl: 'https://cdn.onekey.so/app-3.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({
      status: 'applied_waiting_verify',
      runningStartedAt: Date.now() - 11 * 60_000,
    });
    defaultLogger.app.appUpdate.pendingVerifyAfterRestart.mockImplementationOnce(
      () => {
        pendingTaskValue = replacement;
      },
    );

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toEqual(replacement);
  });

  test('rollback with non-seamless strategy still creates pending task', async () => {
    const service = createService();
    const platformEnvMock = require('@onekeyhq/shared/src/platformEnv').default;
    platformEnvMock.bundleVersion = '3';
    setState({
      status: 'verifyPackage' as any,
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      updateStrategy: EUpdateStrategy.manual,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        signature: 'sig-2',
        sha256: 'a'.repeat(64),
      },
    });

    await service.syncPendingInstallTaskWithReleaseInfo({
      releaseInfo: {
        version: '1.0.0',
        jsBundleVersion: '2',
        updateStrategy: EUpdateStrategy.manual,
        jsBundle: {
          signature: 'sig-2',
          sha256: 'a'.repeat(64),
          downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
        },
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

  test('bundle integrity failure is terminal without clearing or full-flow retry', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockResolvedValue(undefined);
    autoUpdate.BundleUpdate.switchBundle.mockRejectedValueOnce(
      createUpdateError({
        code: EUpdateErrorCode.integrityFailed,
        step: 'install',
      }),
    );
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(autoUpdate.BundleUpdate.clearBundle).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.fullFlowRetryByTarget).toEqual({});
  });

  test('missing extracted OTA bundle on startup invalidates ready atom, cleans staging download, and triggers auto recovery', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValueOnce(false);
    autoUpdate.BundleUpdate.clearDownload.mockClear();
    appEventBus.emit.mockClear();

    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.seamless,
      readyAt: 12_345,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
    });
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.clearDownload).toHaveBeenCalledTimes(1);
    expect(autoUpdate.BundleUpdate.clearBundle).not.toHaveBeenCalled();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.notify);
    expect(appUpdateState.downloadedEvent).toBeUndefined();
    expect(appUpdateState.readyAt).toBeUndefined();
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      { decision: 'jsBundlePackageRecovery' },
    );
  });

  test('missing extracted OTA bundle on startup transitions manual ready atom to updateIncomplete', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValueOnce(false);

    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
    });
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.updateIncomplete);
    expect(appUpdateState.downloadedEvent).toBeUndefined();
  });

  test('tampered extracted OTA bundle (SHA mismatch) on startup transitions manual ready atom to verifyPackageFailed and clears staging download', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValueOnce(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockRejectedValueOnce(
      createUpdateError({
        code: EUpdateErrorCode.integrityFailed,
        step: 'verifyPackage',
      }),
    );
    autoUpdate.BundleUpdate.clearDownload.mockClear();
    autoUpdate.BundleUpdate.clearBundle.mockClear();

    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
    });
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.clearDownload).toHaveBeenCalledTimes(1);
    expect(autoUpdate.BundleUpdate.clearBundle).not.toHaveBeenCalled();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.verifyPackageFailed);
    expect(appUpdateState.downloadedEvent).toBeUndefined();
    expect(appUpdateState.updateError).toMatchObject({
      code: EUpdateErrorCode.integrityFailed,
    });
  });

  test('tampered extracted OTA bundle on startup silently resets silent strategy to notify and triggers background re-download within retry budget', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockRejectedValue(
      createUpdateError({
        code: EUpdateErrorCode.integrityFailed,
        step: 'verifyPackage',
      }),
    );
    autoUpdate.BundleUpdate.clearDownload.mockClear();
    appEventBus.emit.mockClear();

    // First corrupt startup: silently resets ready -> notify and emits StartAutoDownloadUpdate
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '2',
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.silent,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
    });
    pendingTaskValue = makeSwitchTask();

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.clearDownload).toHaveBeenCalledTimes(1);
    expect(appUpdateState.status).toBe(EAppUpdateStatus.notify);
    expect(appUpdateState.downloadedEvent).toBeUndefined();
    expect(appUpdateState.updateError).toBeUndefined();
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      { decision: 'jsBundlePackageRecovery' },
    );

    // Exhaust MAX_FULL_FLOW_RETRY (2): third failure stops looping and freezes target
    appUpdateState = {
      ...appUpdateState,
      status: EAppUpdateStatus.ready,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
    };
    pendingTaskValue = makeSwitchTask({ revision: 2 });
    await service.processPendingInstallTask();
    expect(appUpdateState.status).toBe(EAppUpdateStatus.notify);

    appEventBus.emit.mockClear();
    appUpdateState = {
      ...appUpdateState,
      status: EAppUpdateStatus.ready,
      downloadedEvent: {
        latestVersion: '1.0.0',
        bundleVersion: '2',
        downloadUrl: 'https://cdn.onekey.so/bundle-v2.zip',
      },
    };
    pendingTaskValue = makeSwitchTask({ revision: 3 });
    await service.processPendingInstallTask();

    expect(appUpdateState.status).toBe(EAppUpdateStatus.verifyPackageFailed);
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.StartAutoDownloadUpdate,
      expect.anything(),
    );
    expect(appUpdateState.freezeUntil).toBeGreaterThan(Date.now());
  });

  test('shouldSkipTargetByControl allows mandatory force updates through freezeUntil while keeping BOOT_FAILED blocked', async () => {
    const service = createService();
    const now = Date.now();
    setState({
      freezeUntil: now + 60_000,
      ignoredTargets: {
        '2.0.0:1': {
          reason: 'DOWNLOAD_RETRY_EXHAUSTED',
          createdAt: now,
          expiresAt: now + 60_000,
        },
        '1.0.0:9': {
          reason: 'BOOT_FAILED',
          createdAt: now,
          expiresAt: now + 60_000,
        },
      },
    });

    // Non-force update is blocked by freezeUntil / DOWNLOAD_RETRY_EXHAUSTED
    expect(
      await service.shouldSkipTargetByControl('2.0.0:1', 't1', 1, false),
    ).toBe(true);
    // Mandatory force update bypasses freezeUntil and non-BOOT_FAILED ignore
    expect(
      await service.shouldSkipTargetByControl('2.0.0:1', 't2', 2, false, {
        isForceUpdate: true,
      }),
    ).toBe(false);
    // Native-boot-crashing OTA bundle remains blocked even if marked force
    expect(
      await service.shouldSkipTargetByControl('1.0.0:9', 't3', 3, false, {
        isForceUpdate: true,
      }),
    ).toBe(true);
  });

  test('stale pending task failure does not clear artifacts when persisted update has advanced to a newer target', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    autoUpdate.BundleUpdate.clearDownload.mockClear();

    // Case A: packageMissing on stale v2 while v3 is downloading
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValueOnce(false);
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '3',
      status: EAppUpdateStatus.downloadPackage,
      updateStrategy: EUpdateStrategy.seamless,
    });
    pendingTaskValue = makeSwitchTask({ targetBundleVersion: '2' });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.clearDownload).not.toHaveBeenCalled();
    expect(appUpdateState.jsBundleVersion).toBe('3');
    expect(appUpdateState.status).toBe(EAppUpdateStatus.downloadPackage);

    // Case B: integrityFailed on stale v2 while v3 is ready
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValueOnce(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockRejectedValueOnce(
      createUpdateError({
        code: EUpdateErrorCode.integrityFailed,
        step: 'verifyPackage',
      }),
    );
    setState({
      latestVersion: '1.0.0',
      jsBundleVersion: '3',
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.seamless,
    });
    pendingTaskValue = makeSwitchTask({
      targetBundleVersion: '2',
      revision: 2,
    });

    await service.processPendingInstallTask();

    expect(pendingTaskValue).toBeUndefined();
    expect(autoUpdate.BundleUpdate.clearDownload).not.toHaveBeenCalled();
    expect(appUpdateState.jsBundleVersion).toBe('3');
    expect(appUpdateState.status).toBe(EAppUpdateStatus.ready);
  });

  test('an old task clear cannot delete a replacement written after the sync deletion', async () => {
    const tasks = require('./servicePendingInstallTask');
    pendingTaskValue = makeSwitchTask({ revision: 999_111_001 });
    const clearing = tasks.clearPendingInstallTask();
    const replacement = makeSwitchTask({ revision: 999_111_002 });
    pendingTaskValue = replacement;
    await clearing;
    expect(pendingTaskValue).toBe(replacement);
  });

  test.each([false, true])(
    'refused manual clear recovers an interrupted worker without replacing a newer task (replacement: %s)',
    async (replaceTask) => {
      const service = createService();
      const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
      const tasks = require('./servicePendingInstallTask');
      let release!: (value: { status: string }) => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      autoUpdate.AppUpdate.checkPackageAvailability.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
            started();
          }),
      );
      setState({
        latestVersion: '2.0.0',
        updateStrategy: EUpdateStrategy.seamless,
        downloadedEvent: {
          latestVersion: '2.0.0',
          downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
        },
      });
      pendingTaskValue = makeAppShellInstallTask({ revision: 999_111_003 });
      const processing = service.processPendingInstallTask();
      await entered;
      const finish = tasks.beginManualUpdateCacheClear();
      release({ status: 'available' });
      // Let the worker encounter the suspension while the clear is still pending.
      await Promise.resolve();
      await Promise.resolve();
      const replacement = makeSwitchTask({ revision: 999_111_004 });
      if (replaceTask) pendingTaskValue = replacement;
      finish(false);
      await processing;
      expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
      expect(pendingTaskValue.status).toBe('pending');
      expect(pendingTaskValue.revision).toBe(
        replaceTask ? 999_111_004 : 999_111_003,
      );
      if (!replaceTask) {
        await service.processPendingInstallTask();
        expect(autoUpdate.AppUpdate.installPackage).toHaveBeenCalledTimes(1);
      }
    },
  );

  test('partial native revocation must not restore an interrupted task when disk cleanup fails', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    const tasks = require('./servicePendingInstallTask');
    let release!: (value: { status: string }) => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    autoUpdate.AppUpdate.checkPackageAvailability.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
          started();
        }),
    );
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({ revision: 999_111_005 });
    const processing = service.processPendingInstallTask();
    await entered;
    const finish = tasks.beginManualUpdateCacheClear();
    release({ status: 'available' });
    finish(true);
    await processing;
    expect(pendingTaskValue.status).toBe('running');
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
  });

  test('manual cache clear revokes a task already waiting for package availability', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    const tasks = require('./servicePendingInstallTask');
    let release!: (value: { status: string }) => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    autoUpdate.AppUpdate.checkPackageAvailability.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
          started();
        }),
    );
    setState({
      latestVersion: '2.0.0',
      updateStrategy: EUpdateStrategy.seamless,
      downloadedEvent: {
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
    pendingTaskValue = makeAppShellInstallTask({ revision: 987_654_321 });
    const processing = service.processPendingInstallTask();
    await entered;
    const finish = tasks.beginManualUpdateCacheClear();
    await tasks.clearPendingInstallTask();
    finish();
    release({ status: 'available' });
    await processing;
    expect(autoUpdate.AppUpdate.installPackage).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
  });

  test('manual cache clear invalidates a bundle task already waiting for verification', async () => {
    const service = createService();
    const autoUpdate = require('@onekeyhq/shared/src/modules3rdParty/auto-update');
    const tasks = require('./servicePendingInstallTask');
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    autoUpdate.BundleUpdate.isBundleExists.mockResolvedValue(true);
    autoUpdate.BundleUpdate.verifyExtractedBundle.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
          started();
        }),
    );
    pendingTaskValue = makeSwitchTask({ revision: 987_654_322 });
    const processing = service.processPendingInstallTask();
    await entered;
    const finish = tasks.beginManualUpdateCacheClear();
    await tasks.clearPendingInstallTask();
    finish();
    release();
    await processing;
    expect(autoUpdate.BundleUpdate.switchBundle).not.toHaveBeenCalled();
    expect(pendingTaskValue).toBeUndefined();
  });
});
