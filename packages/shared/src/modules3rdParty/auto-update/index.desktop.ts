import { useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import type {
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
    const errorSubscription =
      globalThis.desktopApiProxy.update.listeners.onUpdateError?.(reject);
    void callback()
      .then((result) => {
        errorSubscription?.();
        resolve(result);
      })
      .catch(reject);
  });

export const downloadPackage: IDownloadPackage = async () => {
  const results = await withUpdateError(async () => {
    await globalThis.desktopApiProxy.update.checkForUpdates();
    return Promise.all([
      globalThis.desktopApiProxy.update.downloadUpdate(),
      new Promise<IUpdateDownloadedEvent>((resolve) => {
        globalThis.desktopApiProxy.update.listeners.onDownloaded?.(resolve);
      }),
    ]);
  });
  return results[1];
};

export const downloadASC: IDownloadASC = async (params) => {
  await globalThis.desktopApiProxy.update.downloadASC({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
};

export const verifyASC: IVerifyASC = async () => {
  await globalThis.desktopApiProxy.update.verifyASC();
};

export const verifyPackage: IVerifyPackage = async (params) => {
  await globalThis.desktopApiProxy.update.verifyPackage({
    ...params,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
};

export const installPackage: IInstallPackage = async ({ downloadedEvent }) => {
  await globalThis.desktopApiProxy.update.installPackage({
    ...downloadedEvent,
    buildNumber: String(platformEnv.buildNumber || 1),
  });
};

export const useDownloadProgress: IUseDownloadProgress = (
  onSuccess,
  onFailed,
) => {
  const [percent, setPercent] = useState(0);

  const updatePercent = useThrottledCallback(
    ({
      percent: progress,
    }: {
      total: number;
      delta: number;
      transferred: number;
      percent: number;
      bytesPerSecond: number;
    }) => {
      defaultLogger.update.app.log('downloading', progress);
      setPercent(Number(Number(progress).toFixed()));
    },
    10,
  );

  useEffect(() => {
    const onProgressUpdateSubscription =
      desktopApiProxy.update.listeners.onProgressUpdate?.(updatePercent);
    const onDownloadedSubscription =
      desktopApiProxy.update.listeners.onDownloaded?.(onSuccess);
    return () => {
      onProgressUpdateSubscription?.();
      onDownloadedSubscription?.();
    };
  }, [onFailed, onSuccess, updatePercent]);
  return percent;
};

export const clearPackage: IClearPackage = async () => {
  await globalThis.desktopApiProxy.update.clearUpdateCache();
};

export const manualInstallPackage: IManualInstallPackage = async (params) =>
  new Promise((resolve) => {
    void globalThis.desktopApiProxy.update.manualInstallPackage(params);
    setTimeout(() => {
      resolve();
    }, 3500);
  });
