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
      type: 'appshell-install',
      action: 'install-app',
      targetAppVersion: '2.0.0',
      payload: {
        latestVersion: '2.0.0',
        channel: 'direct',
        downloadUrl: 'https://cdn.onekey.so/app-2.0.0.pkg',
      },
    });
  });

  test('reset does not clear pending task storage', async () => {
    const task = makeSwitchTask({ taskId: 'task-persist' });
    resetPendingTask(task);
    jest.spyOn(service, 'fetchAppUpdateInfo').mockResolvedValue(appUpdateState);

    await service.reset();

    expect(pendingTaskValue).toEqual(task);
  });
});
