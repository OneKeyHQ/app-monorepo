import { useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { defaultLogger } from '../../logger/logger';

import { electronUpdateListeners } from './electronUpdateListeners';

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

export const downloadPackage: IDownloadPackage = async () => {
  const result = await withUpdateError(async () => {
    await globalThis.desktopApiProxy.update.checkForUpdates();
    return new Promise<IUpdateDownloadedEvent>((resolve) => {
      const onDownloadedSubscription = electronUpdateListeners.onDownloaded?.(
        (params) => {
          console.log('params', params);
          onDownloadedSubscription?.();
          resolve(params);
        },
      );
      void globalThis.desktopApiProxy.update.downloadUpdate();
    });
  });
  console.log('results', result);
  return result;
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
