import { AppUpdate } from './index.desktop';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
} from './type';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    buildNumber: 1,
    isDev: false,
  },
}));

jest.mock('./electronUpdateListeners', () => {
  const onUpdateError = jest.fn();
  const onDownloaded = jest.fn();
  (globalThis as any).__mockOnUpdateError = onUpdateError;
  (globalThis as any).__mockOnDownloaded = onDownloaded;
  return {
    electronUpdateListeners: { onUpdateError, onDownloaded },
  };
});

describe('desktop app update adapter', () => {
  const checkForUpdates = jest.fn();
  const downloadUpdate = jest.fn();
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
  const onDownloaded = (
    globalThis as unknown as {
      __mockOnDownloaded: jest.MockedFunction<
        (callback: (params: any) => void) => () => void
      >;
    }
  ).__mockOnDownloaded;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (globalThis as any).desktopApiProxy = {
      appUpdate: {
        checkForUpdates,
        downloadUpdate,
        getDownloadedFileAvailability,
        installPackage,
        manualInstallPackage,
        verifyPackage,
      },
    };
    getDownloadedFileAvailability.mockResolvedValue({ status: 'available' });
    installPackage.mockResolvedValue(true);
    onUpdateError.mockReturnValue(jest.fn());
    onDownloaded.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('downloadPackage resolves downloaded event even when downloadedFile is provided and ignores bundle events', async () => {
    const unsubscribeDownloaded = jest.fn();
    let emitDownloaded: (params: any) => void = () => {};
    onDownloaded.mockImplementationOnce((callback) => {
      emitDownloaded = callback;
      return unsubscribeDownloaded;
    });
    checkForUpdates.mockResolvedValueOnce({ version: '6.6.0' });
    downloadUpdate.mockImplementationOnce(async () => {
      // Bundle event should be ignored
      emitDownloaded({
        bundleVersion: '100',
        downloadedFile: '/tmp/bundle.zip',
      });
      // App update event should resolve
      emitDownloaded({
        version: '6.6.0',
        downloadedFile: '/tmp/app.zip',
        downloadUrl: 'https://example.com/app.zip',
      });
    });

    const result = await AppUpdate.downloadPackage({
      downloadedFile: '/tmp/app.zip',
      latestVersion: '6.6.0',
    } as any);

    expect(result).toEqual({
      version: '6.6.0',
      downloadedFile: '/tmp/app.zip',
      downloadUrl: 'https://example.com/app.zip',
    });
    expect(unsubscribeDownloaded).toHaveBeenCalledTimes(1);
  });

  test('downloadPackage cleans up onDownloaded listener when onUpdateError rejects', async () => {
    const unsubscribeDownloaded = jest.fn();
    onDownloaded.mockReturnValueOnce(unsubscribeDownloaded);
    let emitUpdateError: (error: Error) => void = () => {};
    onUpdateError.mockImplementationOnce((callback) => {
      emitUpdateError = callback;
      return jest.fn();
    });
    checkForUpdates.mockResolvedValueOnce({ version: '6.6.0' });
    downloadUpdate.mockReturnValueOnce(new Promise(() => {}));

    const promise = AppUpdate.downloadPackage({
      latestVersion: '6.6.0',
    } as any);
    await Promise.resolve();
    await Promise.resolve();
    emitUpdateError(new Error('network error'));

    await expect(promise).rejects.toThrow('network error');
    expect(unsubscribeDownloaded).toHaveBeenCalledTimes(1);
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

  test.each([true, false])(
    'returns the main-process install decision (%s)',
    async (installStarted) => {
      installPackage.mockResolvedValueOnce(installStarted);

      const promise = AppUpdate.installPackage({
        latestVersion: '6.5.3',
        downloadedEvent: {
          downloadedFile: '/tmp/app.zip',
          downloadUrl: 'https://example.com/app.zip',
        },
      } as any);
      await jest.runAllTimersAsync();

      await expect(promise).resolves.toBe(installStarted);
      expect(installPackage).toHaveBeenCalledWith(
        expect.objectContaining({ latestVersion: '6.5.3' }),
      );
    },
  );

  test('does not start installation for a macOS package not prepared in the current process', async () => {
    getDownloadedFileAvailability.mockResolvedValueOnce({
      status: EAppUpdatePackageAvailabilityStatus.notPrepared,
    });

    await expect(
      AppUpdate.installPackage({
        downloadedEvent: {
          downloadedFile: '/tmp/app.zip',
          downloadUrl: 'https://example.com/app.zip',
        },
      } as any),
    ).rejects.toThrow(EAppUpdatePackageErrorCode.packageNotPrepared);
    expect(installPackage).not.toHaveBeenCalled();
  });
});
