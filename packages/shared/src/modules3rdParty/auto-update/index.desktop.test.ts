import {
  AppUpdate,
  BundleUpdate,
  resetBundleInstallLockForTest,
} from './index.desktop';
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
  (globalThis as any).__mockOnUpdateError = onUpdateError;
  return {
    electronUpdateListeners: { onUpdateError },
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
    ).rejects.toThrow('BUNDLE_MISSING: Bundle directory not found');
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
      const error = new Error('Restart failed');
      api.mockRejectedValueOnce(error);
      await expect(run()).rejects.toBe(error);
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
    const error = new Error('Bundle directory not found');

    rejectInstall(error);

    await expect(outcome).resolves.toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
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
    installPackage.mockResolvedValue(true);
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
