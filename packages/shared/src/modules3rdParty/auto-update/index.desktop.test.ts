import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

import {
  EUpdateErrorCode,
  UPDATE_ERROR_WIRE_PREFIX,
  getUpdateError,
} from './error';
import { AppUpdate } from './index.desktop';
import { EAppUpdatePackageAvailabilityStatus } from './type';

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

  test('downloadPackage resolves the app identity and ignores bundle events', async () => {
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
      });
      // App update event should resolve
      emitDownloaded({
        latestVersion: '6.6.0',
        downloadUrl: 'https://example.com/app.zip',
      });
    });

    const result = await AppUpdate.downloadPackage({
      latestVersion: '6.6.0',
    } as any);

    expect(result).toEqual({
      latestVersion: '6.6.0',
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
    emitUpdateError(
      new Error(
        `${UPDATE_ERROR_WIRE_PREFIX}{"code":"NETWORK_ERROR","step":"download"}`,
      ),
    );

    const error = await promise.catch((reason: unknown) => reason);
    expect(getUpdateError(error, 'download')).toEqual({
      code: EUpdateErrorCode.networkError,
      step: 'download',
    });
    expect(unsubscribeDownloaded).toHaveBeenCalledTimes(1);
  });

  test('one download error event plus rejected IPC promise yields one failure', async () => {
    let emitUpdateError: (error: Error) => void = () => {};
    let rejectDownload: (error: Error) => void = () => {};
    const unsubscribeError = jest.fn();
    const unsubscribeDownloaded = jest.fn();
    onUpdateError.mockImplementationOnce((callback) => {
      emitUpdateError = callback;
      return unsubscribeError;
    });
    onDownloaded.mockReturnValueOnce(unsubscribeDownloaded);
    checkForUpdates.mockResolvedValueOnce({ version: '6.6.0' });
    downloadUpdate.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectDownload = reject;
        }),
    );
    const failures: unknown[] = [];
    const promise = AppUpdate.downloadPackage({
      latestVersion: '6.6.0',
    } as any).catch((error: unknown) => failures.push(error));
    await Promise.resolve();
    await Promise.resolve();
    const wire = new Error(
      `${UPDATE_ERROR_WIRE_PREFIX}{"code":"NETWORK_ERROR","step":"download"}`,
    );
    emitUpdateError(wire);
    rejectDownload(wire);
    await promise;
    await Promise.resolve();
    expect(failures).toHaveLength(1);
    expect(getUpdateError(failures[0], 'download').code).toBe(
      EUpdateErrorCode.networkError,
    );
    expect(unsubscribeError).toHaveBeenCalledTimes(1);
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

  test('normalizes an unknown main-process failure without leaking its path', async () => {
    const error = new Error('EACCES /Users/private/installer.AppImage');
    manualInstallPackage.mockRejectedValue(error);

    const rejected = await AppUpdate.manualInstallPackage({} as any).catch(
      (reason: unknown) => reason,
    );
    expect(getUpdateError(rejected, 'install')).toEqual({
      code: EUpdateErrorCode.unknown,
      step: 'install',
    });
    expect((rejected as Error).message).not.toContain('/Users/private');
  });

  test('rejects a false package verification result', async () => {
    verifyPackage.mockResolvedValue(false);

    const rejected = await AppUpdate.verifyPackage({} as any).catch(
      (reason: unknown) => reason,
    );
    expect(getUpdateError(rejected, 'verifyPackage')).toEqual({
      code: EUpdateErrorCode.integrityFailed,
      step: 'verifyPackage',
    });
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
      latestVersion: '6.5.3',
      downloadedEvent: {
        latestVersion: '6.5.3',
        downloadUrl: 'https://example.com/app.zip',
      },
    } as any);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(onUpdateError).toHaveBeenCalled();
    emitUpdateError(error);

    const rejected = await promise.catch((reason: unknown) => reason);
    expect(getUpdateError(rejected, 'install')).toEqual({
      code: EUpdateErrorCode.unknown,
      step: 'install',
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  test.each([true, false])(
    'returns the main-process install decision (%s)',
    async (installStarted) => {
      installPackage.mockResolvedValueOnce(installStarted);

      const promise = AppUpdate.installPackage({
        latestVersion: '6.5.3',
        downloadedEvent: {
          latestVersion: '6.5.3',
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

    const rejected = await AppUpdate.installPackage({
      latestVersion: '6.5.3',
      downloadedEvent: {
        latestVersion: '6.5.3',
        downloadUrl: 'https://example.com/app.zip',
      },
    } as any).catch((reason: unknown) => reason);
    expect(getUpdateError(rejected, 'install')).toEqual({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });
    expect(installPackage).not.toHaveBeenCalled();
  });

  test('does not report a stale downloaded release as available', async () => {
    await expect(
      AppUpdate.checkPackageAvailability({
        latestVersion: '6.5.3',
        downloadedEvent: {
          latestVersion: '6.5.2',
          downloadUrl: 'https://example.com/app.zip',
        },
      } as IAppUpdateInfo),
    ).resolves.toEqual({
      status: EAppUpdatePackageAvailabilityStatus.notPrepared,
    });
    expect(getDownloadedFileAvailability).not.toHaveBeenCalled();
  });
});
