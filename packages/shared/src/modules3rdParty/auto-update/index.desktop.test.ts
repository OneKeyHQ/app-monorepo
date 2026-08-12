import { AppUpdate } from './index.desktop';
import { EAppUpdatePackageErrorCode } from './type';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    buildNumber: 1,
    isDev: false,
  },
}));

jest.mock('./electronUpdateListeners', () => {
  const onUpdateError = jest.fn();
  (globalThis as any).__mockOnUpdateError = onUpdateError;
  return {
    electronUpdateListeners: { onUpdateError },
  };
});

describe('desktop app update adapter', () => {
  const getDownloadedFileAvailability = jest.fn();
  const installPackage = jest.fn();
  const manualInstallPackage = jest.fn();
  const verifyPackage = jest.fn();
  const onUpdateError = (
    globalThis as unknown as {
      __mockOnUpdateError: jest.MockedFunction<
        (callback: (error: Error) => void) => () => void
      >;
    }
  ).__mockOnUpdateError;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (globalThis as any).desktopApiProxy = {
      appUpdate: {
        getDownloadedFileAvailability,
        installPackage,
        manualInstallPackage,
        verifyPackage,
      },
    };
    getDownloadedFileAvailability.mockResolvedValue({ status: 'available' });
    installPackage.mockResolvedValue(undefined);
    onUpdateError.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('waits for both IPC completion and the minimum transition duration', async () => {
    manualInstallPackage.mockResolvedValue(undefined);
    let settled = false;

    const promise = AppUpdate.manualInstallPackage({} as any).then(() => {
      settled = true;
    });
    await Promise.resolve();

    jest.advanceTimersByTime(3499);
    await Promise.resolve();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(1);
    await promise;
    expect(settled).toBe(true);
  });

  test('propagates a main-process verification failure', async () => {
    const error = new Error('APP_PACKAGE_UNAVAILABLE:EACCES');
    manualInstallPackage.mockRejectedValue(error);

    await expect(AppUpdate.manualInstallPackage({} as any)).rejects.toBe(error);
  });

  test('rejects a false package verification result', async () => {
    verifyPackage.mockResolvedValue(false);

    await expect(AppUpdate.verifyPackage({} as any)).rejects.toThrow(
      'APP_UPDATE_PACKAGE_VERIFICATION_FAILED',
    );
  });

  test('keeps the install error listener active after the IPC reply', async () => {
    const unsubscribe = jest.fn();
    let emitUpdateError: (error: Error) => void = () => {};
    onUpdateError.mockImplementationOnce((callback: (error: Error) => void) => {
      emitUpdateError = callback;
      return unsubscribe;
    });
    const error = new Error('installer spawn failed');

    const promise = AppUpdate.installPackage({
      downloadedEvent: {
        downloadedFile: '/tmp/app.zip',
        downloadUrl: 'https://example.com/app.zip',
      },
    } as any);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(onUpdateError).toHaveBeenCalled();
    emitUpdateError(error);

    await expect(promise).rejects.toBe(error);
    expect(unsubscribe).toHaveBeenCalled();
  });

  test('does not start installation for a macOS package not prepared in the current process', async () => {
    getDownloadedFileAvailability.mockResolvedValueOnce({
      status: 'unavailable',
      errorCode: EAppUpdatePackageErrorCode.packageNotPrepared,
    });

    await expect(
      AppUpdate.installPackage({
        downloadedEvent: {
          downloadedFile: '/tmp/app.zip',
          downloadUrl: 'https://example.com/app.zip',
        },
      } as any),
    ).rejects.toThrow(
      `${EAppUpdatePackageErrorCode.packageUnavailable}:${EAppUpdatePackageErrorCode.packageNotPrepared}`,
    );
    expect(installPackage).not.toHaveBeenCalled();
  });
});
