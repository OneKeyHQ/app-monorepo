/* eslint-disable onekey/no-raw-error */

const mockCaptureException = jest.fn();
const mockAppEventOn = jest.fn();
const mockPlatformEnv = {
  isNativeBackgroundThread: false,
  isNativeMainThread: true,
  isProduction: false,
};

jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    NativeStorageContractViolation: 'NativeStorageContractViolation',
  },
  appEventBus: {
    on: mockAppEventOn,
  },
}));

jest.mock('../modules3rdParty/sentry', () => ({
  captureException: mockCaptureException,
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

type INativeStorageContractViolationModule =
  typeof import('./nativeStorageContractViolation');

function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./nativeStorageContractViolation') as INativeStorageContractViolationModule;
}

describe('nativeStorageContractViolation', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatformEnv.isNativeBackgroundThread = false;
    mockPlatformEnv.isNativeMainThread = true;
    mockPlatformEnv.isProduction = false;
    delete (
      globalThis as typeof globalThis & {
        __onekeyNativeStorageContractViolationBroadcast?: unknown;
        __onekeyNativeStorageContractViolationQueue?: unknown;
      }
    ).__onekeyNativeStorageContractViolationBroadcast;
    delete (
      globalThis as typeof globalThis & {
        __onekeyNativeStorageContractViolationQueue?: unknown;
      }
    ).__onekeyNativeStorageContractViolationQueue;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('queues a main-runtime development notification until the UI subscribes', () => {
    const storageContract = loadModule();
    const error =
      storageContract.reportUnsupportedAsyncStorageApi('useAsyncStorage');
    const listener = jest.fn();

    expect(error).toMatchObject({
      name: 'NativeStorageContractViolationError',
      apiName: 'useAsyncStorage',
      runtime: 'main',
    });
    expect(listener).not.toHaveBeenCalled();

    storageContract.subscribeNativeStorageContractViolations(listener);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        apiName: 'useAsyncStorage',
        runtime: 'main',
        stack: expect.stringContaining('NativeStorageContractViolationError'),
      }),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('useAsyncStorage'),
    );
  });

  it('queues a background violation until the BG-to-main bridge is available', () => {
    mockPlatformEnv.isNativeBackgroundThread = true;
    mockPlatformEnv.isNativeMainThread = false;
    const storageContract = loadModule();

    storageContract.reportUnsupportedAsyncStorageApi('unstableAPI');

    const runtimeGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageContractViolationQueue?: Array<{
        apiName: string;
        runtime: string;
      }>;
    };
    expect(runtimeGlobal.__onekeyNativeStorageContractViolationQueue).toEqual([
      expect.objectContaining({
        apiName: 'unstableAPI',
        runtime: 'background',
      }),
    ]);
  });

  it('delivers BG violations to main and reports them after Sentry is ready', async () => {
    mockPlatformEnv.isProduction = true;
    const storageContract = loadModule();
    storageContract.installNativeStorageContractViolationMainHandler();
    const eventHandler = mockAppEventOn.mock.calls[0][1] as (
      violation: unknown,
    ) => void;
    const violation = {
      apiName: 'unsupportedMethod',
      id: 'background:1',
      message: 'unsupported method',
      runtime: 'background' as const,
      stack: 'NativeStorageContractViolationError: unsupported method',
    };

    eventHandler(violation);
    expect(mockCaptureException).not.toHaveBeenCalled();

    storageContract.markNativeStorageContractViolationSentryReady();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'unsupported method',
        stack: violation.stack,
      }),
      {
        tags: {
          native_runtime: 'background',
          storage_api: 'unsupportedMethod',
          storage_contract: 'AsyncStorageBgMMKVProxy',
        },
      },
    );
  });
});
