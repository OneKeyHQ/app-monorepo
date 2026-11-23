// cspell:ignore breeztech
/* eslint-disable @typescript-eslint/no-require-imports */
// The native SDK serves one JS runtime per process, and the app keeps it in
// the background runtime: loading it in the UI runtime as well would start a
// second SDK in the same process.

const NATIVE_PACKAGE = '@breeztech/breez-sdk-spark-react-native';

function loadInRuntime({
  enableNativeBackgroundThread,
  isNativeBackgroundThread,
  nativeModule = () => ({ marker: 'native module' }),
}: {
  enableNativeBackgroundThread: boolean;
  isNativeBackgroundThread: boolean;
  nativeModule?: () => unknown;
}) {
  jest.resetModules();
  jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
    __esModule: true,
    default: { enableNativeBackgroundThread, isNativeBackgroundThread },
  }));
  const loadNative = jest.fn(nativeModule);
  jest.doMock(NATIVE_PACKAGE, loadNative);
  const createAdapter = jest.fn(() => ({ marker: 'adapter' }));
  jest.doMock('./breezSdkNativeAdapter', () => ({
    createBreezSdkNativeAdapter: createAdapter,
  }));
  jest.doMock('./sparkStorage.native', () => ({
    resolveSparkStorageDir: jest.fn(),
  }));
  const { loadBreezSdk } =
    require('./breezSdk.native') as typeof import('./breezSdk.native');
  return { loadBreezSdk, loadNative, createAdapter };
}

describe('Breez SDK native loader', () => {
  it('refuses to load the native SDK in the UI runtime, without loading the package', async () => {
    const { loadBreezSdk, loadNative } = loadInRuntime({
      enableNativeBackgroundThread: true,
      isNativeBackgroundThread: false,
    });

    await expect(loadBreezSdk()).rejects.toThrow(
      'Breez SDK Spark must load in the background runtime',
    );
    expect(loadNative).not.toHaveBeenCalled();
  });

  it('loads the native SDK in the background runtime', async () => {
    const { loadBreezSdk, loadNative, createAdapter } = loadInRuntime({
      enableNativeBackgroundThread: true,
      isNativeBackgroundThread: true,
    });

    await expect(loadBreezSdk()).resolves.toEqual({ marker: 'adapter' });
    expect(loadNative).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ rn: { marker: 'native module' } }),
    );
  });

  it('loads it where the app runs a single runtime', async () => {
    const { loadBreezSdk, loadNative } = loadInRuntime({
      enableNativeBackgroundThread: false,
      isNativeBackgroundThread: false,
    });

    await expect(loadBreezSdk()).resolves.toEqual({ marker: 'adapter' });
    expect(loadNative).toHaveBeenCalledTimes(1);
  });

  it('tells an app built without the native module apart, and tries again later', async () => {
    const { loadBreezSdk, loadNative } = loadInRuntime({
      enableNativeBackgroundThread: true,
      isNativeBackgroundThread: true,
      nativeModule: () => {
        const { OneKeyLocalError } =
          require('@onekeyhq/shared/src/errors') as typeof import('@onekeyhq/shared/src/errors');
        throw new OneKeyLocalError('TurboModule not found');
      },
    });

    await expect(loadBreezSdk()).rejects.toThrow(
      'This app version does not support Lightning Self-Custody',
    );
    await expect(loadBreezSdk()).rejects.toThrow(
      'This app version does not support Lightning Self-Custody',
    );
    expect(loadNative).toHaveBeenCalledTimes(2);
  });
});
