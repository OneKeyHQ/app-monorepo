import { useCallback, useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import { electronUpdateListeners } from './electronUpdateListeners';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
  type IAppUpdate,
  type IBundleUpdate,
  type ICheckPackageAvailability,
  type IClearPackage,
  type IDownloadASC,
  type IDownloadPackage,
  type IInstallPackage,
  type IManualInstallPackage,
  type IUpdateDownloadedEvent,
  type IUseDownloadProgress,
  type IVerifyASC,
  type IVerifyPackage,
} from './type';

const withUpdateError = <T>(callback: () => Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const errorSubscription = electronUpdateListeners.onUpdateError?.(
      (error) => {
        if (platformEnv.isDev) {
          return;
        }
        errorSubscription?.();
        reject(error);
      },
    );
    void callback()
      .then((result) => {
        errorSubscription?.();
        resolve(result);
      })
      .catch((error) => {
        errorSubscription?.();
        reject(error);
      });
  });

const downloadPackage: IDownloadPackage = async ({
  downloadedFile,
  headers,
  latestVersion,
}) => {
  const isDownloading =
    await globalThis.desktopApiProxy.appUpdate.isDownloadingPackage();
  if (isDownloading) {
    return;
  }
  if (downloadedFile) {
    const isFileExists =
      await globalThis.desktopApiProxy.appUpdate.checkDownloadedFileExists(
        downloadedFile,
      );
    if (isFileExists) {
      return;
    }
  }
  const result = await withUpdateError(async () => {
    const updateInfo =
      await globalThis.desktopApiProxy.appUpdate.checkForUpdates(
        false,
        headers,
        latestVersion || '',
      );
    if (!updateInfo) {
      return null;
    }
    return new Promise<IUpdateDownloadedEvent>((resolve) => {
      const onDownloadedSubscription = electronUpdateListeners.onDownloaded?.(
        (params) => {
          onDownloadedSubscription?.();
          resolve(params);
        },
      );
      void globalThis.desktopApiProxy.appUpdate.downloadUpdate();
    });
  });
  return result;
};

const downloadASC: IDownloadASC = async (params) => {
  const verified = await globalThis.desktopApiProxy.appUpdate.downloadASC({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
  if (!verified) {
    throw new OneKeyLocalError('APP_UPDATE_ASC_DOWNLOAD_FAILED');
  }
};

const verifyASC: IVerifyASC = async (params) => {
  const verified = await globalThis.desktopApiProxy.appUpdate.verifyASC({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
  if (!verified) {
    throw new OneKeyLocalError('APP_UPDATE_ASC_VERIFICATION_FAILED');
  }
};

const verifyPackage: IVerifyPackage = async (params) => {
  const verified = await globalThis.desktopApiProxy.appUpdate.verifyPackage({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
  if (!verified) {
    throw new OneKeyLocalError('APP_UPDATE_PACKAGE_VERIFICATION_FAILED');
  }
};

const checkPackageAvailability: ICheckPackageAvailability = async ({
  downloadedEvent,
}) =>
  globalThis.desktopApiProxy.appUpdate.getDownloadedFileAvailability(
    downloadedEvent?.downloadedFile,
  );

const installPackage: IInstallPackage = async (params) => {
  const { downloadedEvent } = params;
  if (!downloadedEvent?.downloadedFile || !downloadedEvent?.downloadUrl) {
    throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageMissing);
  }
  const availability = await checkPackageAvailability(params);
  if (availability.status === EAppUpdatePackageAvailabilityStatus.missing) {
    throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageMissing);
  }
  if (availability.status === EAppUpdatePackageAvailabilityStatus.notPrepared) {
    throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageNotPrepared);
  }
  if (availability.status === EAppUpdatePackageAvailabilityStatus.unavailable) {
    throw new OneKeyLocalError(
      `${EAppUpdatePackageErrorCode.packageUnavailable}:${
        availability.errorCode || 'IO_ERROR'
      }`,
    );
  }
  await withUpdateError(async () => {
    await Promise.all([
      globalThis.desktopApiProxy.appUpdate.installPackage({
        ...downloadedEvent,
        buildNumber: String(platformEnv.buildNumber || 1),
      }),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 3500);
      }),
    ]);
  });
};

export const useDownloadProgress: IUseDownloadProgress = () => {
  const [percent, setPercent] = useState(0);

  const updatePercent = useThrottledCallback(
    (params: {
      total: number;
      delta: number;
      transferred: number;
      percent: number;
      bytesPerSecond: number;
    }) => {
      console.log('update/downloading', params);
      const { percent: progress } = params;
      defaultLogger.update.app.log('downloading', progress);
      setPercent(Number(Number(progress).toFixed()));
    },
    10,
  );

  const updatedDownloaded = useCallback(() => {
    defaultLogger.update.app.log('downloaded');
    setPercent(100);
  }, []);

  useEffect(() => {
    const onProgressUpdateSubscription =
      electronUpdateListeners.onProgressUpdate?.(updatePercent);
    const updateDownloadedSubscription =
      electronUpdateListeners.onDownloaded?.(updatedDownloaded);
    return () => {
      onProgressUpdateSubscription?.();
      updateDownloadedSubscription?.();
    };
  }, [updatedDownloaded, updatePercent]);
  return percent;
};

const clearPackage: IClearPackage = async () => {
  await globalThis.desktopApiProxy.appUpdate.clearUpdateCache();
};

// Desktop has no standalone APK artifacts (Android-only concept) — no-op.
const clearApkCache = async (): Promise<void> => {};

const manualInstallPackage: IManualInstallPackage = async (params) => {
  await Promise.all([
    globalThis.desktopApiProxy.appUpdate.manualInstallPackage(params),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 3500);
    }),
  ]);
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
    globalThis.desktopApiProxy.bundleUpdate.downloadBundle(params),
  verifyBundle: (params) =>
    globalThis.desktopApiProxy.bundleUpdate.verifyBundle(params),
  verifyBundleASC: (params) =>
    globalThis.desktopApiProxy.bundleUpdate.verifyBundleASC(params),
  downloadBundleASC: (params) =>
    globalThis.desktopApiProxy.bundleUpdate.downloadBundleASC(params),
  installBundle: (params) =>
    globalThis.desktopApiProxy.bundleUpdate.installBundle(params),
  getFallbackBundles: () =>
    globalThis.desktopApiProxy.bundleUpdate.getFallbackUpdateBundleData(),
  switchBundle: (params) =>
    globalThis.desktopApiProxy.bundleUpdate.setCurrentUpdateBundleData(params),
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
    globalThis.desktopApiProxy.bundleUpdate.verifyExtractedBundle(
      appVersion,
      bundleVersion,
    ),
  listLocalBundles: () =>
    globalThis.desktopApiProxy.bundleUpdate.listLocalBundles(),
  clearBundle: () => globalThis.desktopApiProxy.bundleUpdate.clearBundle(),
  clearDownload: () => globalThis.desktopApiProxy.bundleUpdate.clearDownload(),
  resetToBuiltInBundle: () =>
    globalThis.desktopApiProxy.bundleUpdate.resetToBuiltInBundle(),
  restart: () => {
    void globalThis.desktopApiProxy.bundleUpdate.restart();
  },
  clearAllJSBundleData: () =>
    globalThis.desktopApiProxy.bundleUpdate.clearAllJSBundleData(),
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
