import { useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import { electronUpdateListeners } from './electronUpdateListeners';

import type {
  IAppUpdate,
  IBundleUpdate,
  IClearPackage,
  IDownloadASC,
  IDownloadPackage,
  IInstallPackage,
  IManualInstallPackage,
  IUpdateDownloadedEvent,
  IUseDownloadProgress,
  IVerifyASC,
  IVerifyPackage,
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

const downloadPackage: IDownloadPackage = async () => {
  const result = await withUpdateError(async () => {
    await globalThis.desktopApiProxy.appUpdate.checkForUpdates();
    return new Promise<IUpdateDownloadedEvent>((resolve) => {
      const onDownloadedSubscription = electronUpdateListeners.onDownloaded?.(
        (params) => {
          console.log('params', params);
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
  await globalThis.desktopApiProxy.appUpdate.downloadASC({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
};

const verifyASC: IVerifyASC = async () => {
  await globalThis.desktopApiProxy.appUpdate.verifyASC();
};

const verifyPackage: IVerifyPackage = async (params) => {
  await globalThis.desktopApiProxy.appUpdate.verifyPackage({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
};

const installPackage: IInstallPackage = async ({ downloadedEvent }) => {
  await globalThis.desktopApiProxy.appUpdate.installPackage({
    ...downloadedEvent,
    buildNumber: String(platformEnv.buildNumber || 1),
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

  useEffect(() => {
    const onProgressUpdateSubscription =
      electronUpdateListeners.onProgressUpdate?.(updatePercent);
    return () => {
      onProgressUpdateSubscription?.();
    };
  }, [updatePercent]);
  return percent;
};

const clearPackage: IClearPackage = async () => {
  await globalThis.desktopApiProxy.appUpdate.clearUpdateCache();
};

const manualInstallPackage: IManualInstallPackage = async (params) =>
  new Promise((resolve) => {
    void globalThis.desktopApiProxy.appUpdate.manualInstallPackage(params);
    setTimeout(() => {
      resolve();
    }, 3500);
  });

export const AppUpdate: IAppUpdate = {
  downloadPackage,
  verifyPackage,
  verifyASC,
  downloadASC,
  installPackage,
  manualInstallPackage,
  clearPackage,
};

export const BundleUpdate: IBundleUpdate = {
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
  clearBundle: () => globalThis.desktopApiProxy.bundleUpdate.clearBundle(),
};
