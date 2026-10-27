import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

import {
  EUpdateErrorCode,
  UPDATE_ERROR_WIRE_PREFIX,
  createUpdateError,
  getUpdateError,
} from './error';
import {
  AppUpdate,
  BundleUpdate,
  resetBundleInstallLockForTest,
} from './index.desktop';
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

describe('desktop bundle install concurrency', () => {
  const installBundle = jest.fn<Promise<void>, []>();
  const restart = jest.fn<Promise<void>, []>();
  const switchBundle = jest.fn<Promise<void>, []>();
  const isBundleExists = jest.fn<Promise<boolean>, [string, string]>();

  beforeEach(() => {
    resetBundleInstallLockForTest();
    installBundle.mockReset().mockResolvedValue(undefined);
    restart.mockReset().mockResolvedValue(undefined);
    switchBundle.mockReset().mockResolvedValue(undefined);
    isBundleExists.mockReset().mockResolvedValue(true);
    globalThis.desktopApiProxy = {
      bundleUpdate: {
        installBundle,
        restart,
        setCurrentUpdateBundleData: switchBundle,
        isBundleExists,
      },
    } as unknown as typeof globalThis.desktopApiProxy;
  });

  test('missing switch target cannot reach the metadata setter or restart', async () => {
    isBundleExists.mockResolvedValueOnce(false);
    await expect(
      BundleUpdate.switchBundle({
        appVersion: '6.6.1',
        bundleVersion: '24910529',
        signature: 'signature',
      }),
    ).rejects.toMatchObject({
      data: {
        updateError: { code: EUpdateErrorCode.packageMissing, step: 'install' },
      },
    });
    expect(switchBundle).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
  });

  test.each(['restart', 'switchBundle'] as const)(
    '%s propagates the main-process failure and permits retry',
    async (action) => {
      const target = {
        appVersion: '6.6.1',
        bundleVersion: '24910529',
        signature: 'signature',
      };
      const api = action === 'restart' ? restart : switchBundle;
      const run = () =>
        action === 'restart'
          ? BundleUpdate.restart()
          : BundleUpdate.switchBundle(target);
      const error = createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'install',
      });
      api.mockRejectedValueOnce(error);
      await expect(run()).rejects.toMatchObject({
        data: { updateError: getUpdateError(error, 'install') },
      });
      await expect(run()).resolves.toBeUndefined();
      expect(api).toHaveBeenCalledTimes(2);
      expect(installBundle).not.toHaveBeenCalled();
    },
  );

  test('overlapping callers wait for the same failure and can retry', async () => {
    let rejectInstall: (error: Error) => void = () => {};
    installBundle.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectInstall = reject;
        }),
    );
    const first = BundleUpdate.installBundle({});
    const second = BundleUpdate.installBundle({});
    const outcome = Promise.allSettled([first, second]);
    const error = createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });

    rejectInstall(error);

    await expect(outcome).resolves.toMatchObject([
      {
        status: 'rejected',
        reason: { data: { updateError: getUpdateError(error, 'install') } },
      },
      {
        status: 'rejected',
        reason: { data: { updateError: getUpdateError(error, 'install') } },
      },
    ]);
    expect(installBundle).toHaveBeenCalledTimes(1);

    await BundleUpdate.installBundle({
      latestVersion: '6.6.2',
      bundleVersion: '25000000',
    });
    expect(installBundle).toHaveBeenCalledTimes(2);
  });

  test.each([
    { latestVersion: '6.6.2', bundleVersion: '24910529' },
    { latestVersion: '6.6.1', bundleVersion: '24910530' },
  ])(
    'rejects a different target during and after installation: %j',
    async (conflictingTarget) => {
      let completeInstall = () => {};
      installBundle.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeInstall = resolve;
          }),
      );
      const target = { latestVersion: '6.6.1', bundleVersion: '24910529' };
      const first = BundleUpdate.installBundle(target);
      await expect(
        BundleUpdate.installBundle(conflictingTarget),
      ).rejects.toThrow('BUNDLE_INSTALL_TARGET_CONFLICT');
      expect(installBundle).toHaveBeenCalledTimes(1);

      completeInstall();
      await first;
      await expect(
        BundleUpdate.installBundle(conflictingTarget),
      ).rejects.toThrow('BUNDLE_INSTALL_TARGET_CONFLICT');
      await BundleUpdate.installBundle({ ...target });
      expect(installBundle).toHaveBeenCalledTimes(1);
    },
  );

  test('successful installation remains one-shot while awaiting restart', async () => {
    await Promise.all([
      BundleUpdate.installBundle({}),
      BundleUpdate.installBundle({}),
    ]);
    await BundleUpdate.installBundle({});

    expect(installBundle).toHaveBeenCalledTimes(1);
  });
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
