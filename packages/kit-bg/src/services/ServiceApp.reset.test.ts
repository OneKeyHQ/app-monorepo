const mockAppRestart = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockAppStorageClear = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockLocalDbReset = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockPrepareAndCommitExtensionForegrounds = jest.fn<
  Promise<string[]>,
  unknown[]
>();
const mockQuiesceExtensionForegrounds = jest
  .fn<Promise<string[]>, unknown[]>()
  .mockResolvedValue(['ui-one', 'ui-two']);
const mockResumeExtensionForegrounds = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockDisposeExtensionForegroundConnectionTracker = jest.fn<
  void,
  unknown[]
>();

jest.mock('@onekeyhq/shared/src/cloudfs', () => ({
  isAvailable: jest.fn().mockResolvedValue(false),
  logoutFromGoogleDrive: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: { subscription: { onekeyIdLogout: jest.fn() } },
    setting: {
      page: {
        clearData: jest.fn(),
        clearDataStep: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  appRestart: (...args: unknown[]) => mockAppRestart(...args),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtensionBackground: true,
    isNative: false,
    isNativeAndroid: false,
    isRuntimeBrowser: false,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    clear: (...args: unknown[]) => mockAppStorageClear(...args),
    syncStorage: { clearAll: jest.fn() },
  },
  storageHub: {},
}));

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => ({
  coldStartCacheStorage: { clearAll: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/utils/timerUtils',
  ) as typeof import('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      wait: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: { reset: (...args: unknown[]) => mockLocalDbReset(...args) },
}));

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../migrations/v4ToV5Migration/v4appStorage', () => ({
  v4appStorage: { clear: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../migrations/v4ToV5Migration/v4dbHubs', () => ({
  __esModule: true,
  default: { v4localDb: { reset: jest.fn().mockResolvedValue(undefined) } },
}));

jest.mock('../states/jotai/atoms', () => ({
  appIsLocked: { get: jest.fn() },
}));

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: { get: jest.fn() },
}));

jest.mock('./ServicePassword/biologyAuthUtils', () => ({
  biologyAuthUtils: { deletePassword: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('./utils', () => ({
  EXTENSION_FOREGROUND_RESET_DEADLINE_MS: 30_000,
  createExtensionForegroundConnectionTracker: () => ({
    dispose: (...args: unknown[]) =>
      mockDisposeExtensionForegroundConnectionTracker(...args),
    getRevision: () => 0,
  }),
  prepareAndCommitExtensionForegrounds: (...args: unknown[]) =>
    mockPrepareAndCommitExtensionForegrounds(...args),
  quiesceExtensionForegrounds: (...args: unknown[]) =>
    mockQuiesceExtensionForegrounds(...args),
  resumeExtensionForegrounds: (...args: unknown[]) =>
    mockResumeExtensionForegrounds(...args),
}));

// eslint-disable-next-line import/first
import ServiceApp from './ServiceApp';

describe('ServiceApp Reset App extension commit recovery', () => {
  const originalChromeDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'chrome',
  );
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const originalIsBackgroundDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    '$onekeyIsInBackground',
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepareAndCommitExtensionForegrounds.mockReset();
    mockPrepareAndCommitExtensionForegrounds
      .mockRejectedValueOnce(new Error('ui-two commit failed'))
      .mockResolvedValue(['ui-one', 'ui-two']);
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: { clear: jest.fn().mockResolvedValue(undefined) },
          session: { clear: jest.fn().mockResolvedValue(undefined) },
        },
      },
      writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
      writable: true,
    });
    Object.defineProperty(globalThis, '$onekeyIsInBackground', {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    for (const [key, descriptor] of [
      ['chrome', originalChromeDescriptor],
      ['$onekeyIsInBackground', originalIsBackgroundDescriptor],
      ['navigator', originalNavigatorDescriptor],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  });

  const buildService = () =>
    new ServiceApp({
      backgroundApi: {
        bridgeExtBg: { ports: {} },
        serviceNotification: { unregisterClient: jest.fn() },
        servicePrime: { apiLogout: jest.fn() },
        serviceV4Migration: {
          checkIfV4DbExist: jest.fn().mockResolvedValue(false),
        },
      },
    });

  it('continues the background wipe and restarts after a partial foreground commit', async () => {
    const service = buildService();

    await expect(service.resetApp()).resolves.toBeUndefined();

    // The first partial commit is destructive, so resetData completes one
    // wipe, forces a fresh full re-wipe, and only then reaches restart.
    expect(mockAppStorageClear).toHaveBeenCalledTimes(2);
    expect(mockLocalDbReset).toHaveBeenCalledTimes(2);
    expect(mockAppRestart).toHaveBeenCalledTimes(1);
    expect(mockResumeExtensionForegrounds).not.toHaveBeenCalled();
    expect(
      mockDisposeExtensionForegroundConnectionTracker,
    ).not.toHaveBeenCalled();
  });

  it('reports an initial commit failure only after the re-wipe budget is exhausted', async () => {
    mockPrepareAndCommitExtensionForegrounds.mockReset();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      mockPrepareAndCommitExtensionForegrounds
        .mockRejectedValueOnce(new Error(`commit failed ${attempt}`))
        .mockResolvedValueOnce(['ui-one', 'ui-two']);
    }
    const service = buildService();

    await expect(service.resetApp()).rejects.toThrow(
      'extensionForegrounds-initial-commit',
    );

    expect(mockAppStorageClear).toHaveBeenCalledTimes(3);
    expect(mockLocalDbReset).toHaveBeenCalledTimes(3);
    expect(mockAppRestart).toHaveBeenCalledTimes(1);
    expect(mockResumeExtensionForegrounds).not.toHaveBeenCalled();
    expect(
      mockDisposeExtensionForegroundConnectionTracker,
    ).not.toHaveBeenCalled();
  });

  it('keeps the connection tracker through reload scheduling', async () => {
    mockPrepareAndCommitExtensionForegrounds.mockReset();
    mockPrepareAndCommitExtensionForegrounds.mockResolvedValue([
      'ui-one',
      'ui-two',
    ]);
    mockAppRestart.mockImplementationOnce(() => {
      expect(
        mockDisposeExtensionForegroundConnectionTracker,
      ).not.toHaveBeenCalled();
      return Promise.resolve();
    });
    const service = buildService();

    await expect(service.resetApp()).resolves.toBeUndefined();

    expect(mockAppRestart).toHaveBeenCalledTimes(1);
    expect(
      mockDisposeExtensionForegroundConnectionTracker,
    ).not.toHaveBeenCalled();
  });

  it('disposes the connection tracker when reload scheduling fails', async () => {
    mockPrepareAndCommitExtensionForegrounds.mockReset();
    mockPrepareAndCommitExtensionForegrounds.mockResolvedValue([
      'ui-one',
      'ui-two',
    ]);
    mockAppRestart.mockRejectedValueOnce(new Error('reload failed'));
    const service = buildService();

    await expect(service.resetApp()).rejects.toThrow('reload failed');

    expect(mockResumeExtensionForegrounds).toHaveBeenCalledTimes(1);
    expect(
      mockDisposeExtensionForegroundConnectionTracker,
    ).toHaveBeenCalledTimes(1);
  });

  it('disposes the connection tracker when the reversible prepare barrier aborts', async () => {
    mockQuiesceExtensionForegrounds.mockRejectedValueOnce(
      new Error('prepare timeout'),
    );
    const service = buildService();

    await expect(service.resetApp()).rejects.toThrow(
      'Extension foreground reset barrier failed: prepare timeout',
    );

    expect(mockAppRestart).not.toHaveBeenCalled();
    expect(mockResumeExtensionForegrounds).toHaveBeenCalledTimes(1);
    expect(
      mockDisposeExtensionForegroundConnectionTracker,
    ).toHaveBeenCalledTimes(1);
  });
});
