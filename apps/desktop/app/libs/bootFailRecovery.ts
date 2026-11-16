import type { IDesktopStoreUpdateBundleData } from '@onekeyhq/shared/types/desktop';

export interface IBootFailStore {
  getUpdateBundleData: () => Partial<IDesktopStoreUpdateBundleData> | undefined;
  getConsecutiveBootFailCount: () => number;
  incrementConsecutiveBootFailCount: () => number;
  resetConsecutiveBootFailCount: () => void;
  recordFailedOtaBundle: (appVersion: string, bundleVersion: string) => void;
  revokePendingSwitchForFailedBundle: (
    appVersion: string,
    bundleVersion: string,
  ) => boolean;
  clearUpdateBundleData: () => void;
}

export interface IBootFailLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface IBootFailRecoveryResult<TWindow> {
  bootFailCount: number;
  recoveryWindow?: TWindow;
}

// Roll an OTA bundle back once it has failed to boot three times in a row, then
// open the standalone recovery window if it still fails without a bundle.
export function applyBootFailThresholds<TWindow>(params: {
  store: IBootFailStore;
  logger: IBootFailLogger;
  appVersion: string;
  bootFailCount: number;
  createRecoveryWindow: () => TWindow;
}): IBootFailRecoveryResult<TWindow> {
  const { store, logger, appVersion, createRecoveryWindow } = params;
  let { bootFailCount } = params;
  const activeOtaBundleVersion = store.getUpdateBundleData()?.bundleVersion;
  if (bootFailCount >= 3 && activeOtaBundleVersion) {
    logger.warn(
      'Consecutive boot failures detected with active OTA bundle, rolling back to built-in bundle',
      {
        bootFailCount,
        bundleVersion: activeOtaBundleVersion,
        appVersion,
      },
    );
    store.recordFailedOtaBundle(appVersion, activeOtaBundleVersion);
    store.revokePendingSwitchForFailedBundle(
      appVersion,
      activeOtaBundleVersion,
    );
    store.clearUpdateBundleData();
    store.resetConsecutiveBootFailCount();
    bootFailCount = store.incrementConsecutiveBootFailCount();
  }
  if (bootFailCount >= 3) {
    logger.error('Recovery page triggered', {
      crashCount: bootFailCount,
      appVersion,
    });
    return { bootFailCount, recoveryWindow: createRecoveryWindow() };
  }
  return { bootFailCount };
}

// A graceful quit before the OTA reaches its health marker must not count as a
// failed boot, but a real renderer crash (or an already open recovery window)
// must be preserved.
export function resetBootFailCountOnGracefulQuit(params: {
  store: Pick<
    IBootFailStore,
    'getConsecutiveBootFailCount' | 'resetConsecutiveBootFailCount'
  >;
  mainRendererBootFailed: boolean;
}): void {
  if (
    !params.mainRendererBootFailed &&
    params.store.getConsecutiveBootFailCount() < 3
  ) {
    params.store.resetConsecutiveBootFailCount();
  }
}
