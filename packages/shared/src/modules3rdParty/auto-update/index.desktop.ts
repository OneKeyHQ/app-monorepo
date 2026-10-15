import { useCallback, useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import { electronUpdateListeners } from './electronUpdateListeners';
import {
  EUpdateErrorCode,
  createUpdateError,
  getUpdateError,
  runUpdateOperation,
} from './error';
import {
  EAppUpdatePackageAvailabilityStatus,
  type IAppUpdate,
  type IBundleUpdate,
  type ICheckPackageAvailability,
  type IClearPackage,
  type IDownloadASC,
  type IDownloadPackage,
  type IInstallPackage,
  type IManualInstallPackage,
  type IUpdateDownloadedEvent,
  type IUpdateProgressUpdate,
  type IUseDownloadProgress,
  type IVerifyASC,
  type IVerifyPackage,
} from './type';

import type { TUpdateErrorStep } from './error';

const withUpdateError = <T>(
  step: TUpdateErrorStep,
  callback: () => Promise<T>,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const errorSubscription = electronUpdateListeners.onUpdateError?.(
      (error) => {
        if (platformEnv.isDev) {
          return;
        }
        errorSubscription?.();
        reject(createUpdateError(getUpdateError(error, step)));
      },
    );
    void callback()
      .then((result) => {
        errorSubscription?.();
        resolve(result);
      })
      .catch((error) => {
        errorSubscription?.();
        reject(createUpdateError(getUpdateError(error, step)));
      });
  });

const downloadPackage: IDownloadPackage = async ({
  headers,
  latestVersion,
}) => {
  let onDownloadedSubscription: (() => void) | undefined;
  const releaseDownloaded = () => {
    onDownloadedSubscription?.();
    onDownloadedSubscription = undefined;
  };
  try {
    const result = await withUpdateError('download', async () => {
      const updateInfo =
        await globalThis.desktopApiProxy.appUpdate.checkForUpdates(
          false,
          headers,
          latestVersion || '',
        );
      if (!updateInfo) {
        return null;
      }
      return new Promise<IUpdateDownloadedEvent>((resolve, reject) => {
        onDownloadedSubscription = electronUpdateListeners.onDownloaded?.(
          (params) => {
            if (params?.bundleVersion) {
              return;
            }
            releaseDownloaded();
            resolve(params);
          },
        );
        void globalThis.desktopApiProxy.appUpdate
          .downloadUpdate()
          .catch((error) => {
            releaseDownloaded();
            reject(error);
          });
      });
    });
    return result;
  } finally {
    releaseDownloaded();
  }
};

const downloadASC: IDownloadASC = async (params) => {
  const verified = await runUpdateOperation('downloadASC', () =>
    globalThis.desktopApiProxy.appUpdate.downloadASC({
      ...params,
      buildNumber: String(platformEnv.buildNumber || 1),
    }),
  );
  if (!verified) {
    throw createUpdateError({
      code: EUpdateErrorCode.unknown,
      step: 'downloadASC',
    });
  }
};

const verifyASC: IVerifyASC = async (params) => {
  const verified = await runUpdateOperation('verifyASC', () =>
    globalThis.desktopApiProxy.appUpdate.verifyASC({
      ...params,
      buildNumber: String(platformEnv.buildNumber || 1),
    }),
  );
  if (!verified) {
    throw createUpdateError({
      code: EUpdateErrorCode.integrityFailed,
      step: 'verifyASC',
    });
  }
};

const verifyPackage: IVerifyPackage = async (params) => {
  const verified = await runUpdateOperation('verifyPackage', () =>
    globalThis.desktopApiProxy.appUpdate.verifyPackage({
      ...params,
      buildNumber: String(platformEnv.buildNumber || 1),
    }),
  );
  if (!verified) {
    throw createUpdateError({
      code: EUpdateErrorCode.integrityFailed,
      step: 'verifyPackage',
    });
  }
};

const checkPackageAvailability: ICheckPackageAvailability = async ({
  latestVersion,
  downloadedEvent,
}) => {
  if (!latestVersion || downloadedEvent?.latestVersion !== latestVersion) {
    return { status: EAppUpdatePackageAvailabilityStatus.notPrepared };
  }
  return runUpdateOperation('install', () =>
    globalThis.desktopApiProxy.appUpdate.getDownloadedFileAvailability({
      latestVersion,
      downloadUrl: downloadedEvent?.downloadUrl,
    }),
  );
};

const installPackage: IInstallPackage = async (params) => {
  const { downloadedEvent } = params;
  if (
    !params.latestVersion ||
    downloadedEvent?.latestVersion !== params.latestVersion ||
    !downloadedEvent?.downloadUrl
  ) {
    throw createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });
  }
  const availability = await checkPackageAvailability(params);
  if (availability.status === EAppUpdatePackageAvailabilityStatus.missing) {
    throw createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });
  }
  if (availability.status === EAppUpdatePackageAvailabilityStatus.notPrepared) {
    throw createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'install',
    });
  }
  if (availability.status === EAppUpdatePackageAvailabilityStatus.unavailable) {
    throw createUpdateError({
      code: EUpdateErrorCode.storageError,
      step: 'install',
    });
  }
  return withUpdateError('install', async () => {
    const [installStarted] = await Promise.all([
      globalThis.desktopApiProxy.appUpdate.installPackage({
        ...downloadedEvent,
        latestVersion: params.latestVersion,
        buildNumber: String(platformEnv.buildNumber || 1),
      }),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 3500);
      }),
    ]);
    return installStarted;
  });
};

export const useDownloadProgress: IUseDownloadProgress = (scope) => {
  const latestVersion = scope?.latestVersion;
  const bundleVersion = scope?.bundleVersion;
  const [percent, setPercent] = useState(0);

  const updatePercent = useThrottledCallback(
    (params: IUpdateProgressUpdate) => {
      console.log('update/downloading', params);
      const { percent: progress } = params;
      defaultLogger.update.app.log('downloading', progress);
      setPercent(Number(Number(progress).toFixed()));
    },
    10,
  );

  const updatedDownloaded = useCallback(
    (event: IUpdateDownloadedEvent) => {
      if (bundleVersion || event?.bundleVersion) return;
      defaultLogger.update.app.log('downloaded');
      setPercent(100);
    },
    [bundleVersion],
  );

  useEffect(() => {
    setPercent(0);
    // Filter before throttling so another destination cannot replace queued progress.
    const onProgress = (event: IUpdateProgressUpdate) => {
      if (bundleVersion) {
        if (
          event.bundleVersion !== bundleVersion ||
          event.latestVersion !== latestVersion
        )
          return;
      } else if (event.bundleVersion) return;
      updatePercent(event);
    };
    const onProgressUpdateSubscription =
      electronUpdateListeners.onProgressUpdate?.(onProgress);
    const updateDownloadedSubscription =
      electronUpdateListeners.onDownloaded?.(updatedDownloaded);
    return () => {
      onProgressUpdateSubscription?.();
      updateDownloadedSubscription?.();
      updatePercent.cancel();
    };
  }, [updatedDownloaded, updatePercent, bundleVersion, latestVersion]);
  return percent;
};

const clearPackage: IClearPackage = async () => {
  await runUpdateOperation('cleanup', () =>
    globalThis.desktopApiProxy.appUpdate.clearUpdateCache(),
  );
};

// Desktop has no standalone APK artifacts (Android-only concept) — no-op.
const clearApkCache = async (): Promise<void> => {};

const manualInstallPackage: IManualInstallPackage = async (params) => {
  await runUpdateOperation('install', () =>
    Promise.all([
      globalThis.desktopApiProxy.appUpdate.manualInstallPackage(params),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 3500);
      }),
    ]),
  );
};

export const AppUpdate: IAppUpdate = {
  downloadPackage,
  verifyPackage,
  verifyASC,
  downloadASC,
  checkPackageAvailability,
  installPackage,
  manualInstallPackage,
  clearPackage,
  clearApkCache,
};

export const BundleUpdate: IBundleUpdate = {
  getWebEmbedPath: () => '',
  getWebEmbedPathAsync: () => Promise.resolve(''),
  downloadBundle: (params) =>
    runUpdateOperation('download', () =>
      globalThis.desktopApiProxy.bundleUpdate.downloadBundle(params),
    ),
  verifyBundle: (params) =>
    runUpdateOperation('verifyPackage', () =>
      globalThis.desktopApiProxy.bundleUpdate.verifyBundle(params),
    ),
  verifyBundleASC: (params) =>
    runUpdateOperation('verifyASC', () =>
      globalThis.desktopApiProxy.bundleUpdate.verifyBundleASC(params),
    ),
  downloadBundleASC: (params) =>
    runUpdateOperation('downloadASC', () =>
      globalThis.desktopApiProxy.bundleUpdate.downloadBundleASC(params),
    ),
  installBundle: (params) =>
    runUpdateOperation('install', () =>
      globalThis.desktopApiProxy.bundleUpdate.installBundle(params),
    ),
  getFallbackBundles: () =>
    globalThis.desktopApiProxy.bundleUpdate.getFallbackUpdateBundleData(),
  switchBundle: (params) =>
    runUpdateOperation('install', () =>
      globalThis.desktopApiProxy.bundleUpdate.setCurrentUpdateBundleData(
        params,
      ),
    ),
  isSkipGpgVerificationAllowed: () =>
    globalThis.desktopApiProxy.bundleUpdate.isSkipGpgVerificationAllowed(),
  pruneStaleAppVersionBundles: () =>
    globalThis.desktopApiProxy.bundleUpdate.pruneStaleAppVersionBundles(),
  isBundleExists: (appVersion, bundleVersion) =>
    globalThis.desktopApiProxy.bundleUpdate.isBundleExists(
      appVersion,
      bundleVersion,
    ),
  verifyExtractedBundle: (appVersion, bundleVersion) =>
    runUpdateOperation('verifyPackage', () =>
      globalThis.desktopApiProxy.bundleUpdate.verifyExtractedBundle(
        appVersion,
        bundleVersion,
      ),
    ),
  listLocalBundles: () =>
    globalThis.desktopApiProxy.bundleUpdate.listLocalBundles(),
  clearBundle: () =>
    runUpdateOperation('cleanup', () =>
      globalThis.desktopApiProxy.bundleUpdate.clearBundle(),
    ),
  clearDownload: () =>
    runUpdateOperation('cleanup', () =>
      globalThis.desktopApiProxy.bundleUpdate.clearDownload(),
    ),
  resetToBuiltInBundle: () =>
    runUpdateOperation('cleanup', () =>
      globalThis.desktopApiProxy.bundleUpdate.resetToBuiltInBundle(),
    ),
  restart: () => {
    void globalThis.desktopApiProxy.bundleUpdate.restart();
  },
  clearAllJSBundleData: () =>
    runUpdateOperation('cleanup', () =>
      globalThis.desktopApiProxy.bundleUpdate.clearAllJSBundleData(),
    ),
  testVerification: () =>
    globalThis.desktopApiProxy.bundleUpdate.testVerification(),
  testSkipVerification: () =>
    globalThis.desktopApiProxy.bundleUpdate.testSkipVerification(),
  testDeleteJsBundle: (appVersion, bundleVersion) =>
    globalThis.desktopApiProxy.bundleUpdate.testDeleteJsBundle(
      appVersion,
      bundleVersion,
    ),
  testDeleteJsRuntimeDir: (appVersion, bundleVersion) =>
    globalThis.desktopApiProxy.bundleUpdate.testDeleteJsRuntimeDir(
      appVersion,
      bundleVersion,
    ),
  testDeleteMetadataJson: (appVersion, bundleVersion) =>
    globalThis.desktopApiProxy.bundleUpdate.testDeleteMetadataJson(
      appVersion,
      bundleVersion,
    ),
  testWriteEmptyMetadataJson: (appVersion, bundleVersion) =>
    globalThis.desktopApiProxy.bundleUpdate.testWriteEmptyMetadataJson(
      appVersion,
      bundleVersion,
    ),
  getNativeAppVersion: () =>
    globalThis.desktopApiProxy.bundleUpdate.getNativeAppVersion(),
  getNativeBuildNumber: () =>
    globalThis.desktopApiProxy.bundleUpdate.getNativeBuildNumber(),
  getBuiltinBundleVersion: () =>
    globalThis.desktopApiProxy.bundleUpdate.getBuiltinBundleVersion(),
  getJsBundlePath: () =>
    globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath(),
  getBackgroundJsBundlePath: () => Promise.resolve(''),
  getSha256FromFilePath: (filePath) =>
    globalThis.desktopApiProxy.bundleUpdate.getSha256FromFilePath(filePath),
};
