import { useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import { ETranslations } from '../../locale';
import { appLocale } from '../../locale/appLocale';
import { defaultLogger } from '../../logger/logger';

import type {
  IDownloadPackage,
  IInstallPackage,
  IUpdateDownloadedEvent,
  IUseDownloadProgress,
  IVerifyPackage,
} from './type';

const updateCheckingTasks: (() => void)[] = [];
window.desktopApi?.on?.('update/checking', () => {
  defaultLogger.update.app.log('checking');
  while (updateCheckingTasks.length) {
    updateCheckingTasks.pop()?.();
  }
});

const updateAvailableTasks: (() => void)[] = [];
window.desktopApi?.on?.('update/available', ({ version }) => {
  defaultLogger.update.app.log('available', version);
  while (updateAvailableTasks.length) {
    updateAvailableTasks.pop()?.();
  }
});

window.desktopApi?.on?.('update/not-available', (params) => {
  console.log('update/not-available', params);
  defaultLogger.update.app.log('not-available');
});

window.desktopApi?.on?.('update/download', ({ version }) => {
  defaultLogger.update.app.log('download', version);
});

const updateVerifyTasks: (() => void)[] = [];
window.desktopApi.on('update/verified', () => {
  defaultLogger.update.app.log('update/verified');
  while (updateVerifyTasks.length) {
    updateVerifyTasks.pop()?.();
  }
});

let updateDownloadingTasks: ((params: {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}) => void)[] = [];
window.desktopApi?.on?.(
  'update/downloading',
  (params: {
    percent: number;
    delta: number;
    bytesPerSecond: number;
    total: number;
    transferred: number;
  }) => {
    console.log('update/downloading', params);
    defaultLogger.update.app.log('downloading', params.percent);
    updateDownloadingTasks.forEach((t) => t(params));
  },
);

const updateDownloadedTasks: ((event: IUpdateDownloadedEvent) => void)[] = [];
window.desktopApi.on('update/downloaded', (event: IUpdateDownloadedEvent) => {
  defaultLogger.update.app.log('download');
  while (updateDownloadedTasks.length) {
    updateDownloadedTasks.pop()?.(event);
  }
  updateDownloadingTasks = [];
});

const updateErrorTasks: ((error: { message: string }) => void)[] = [];
window.desktopApi?.on?.(
  'update/error',
  ({
    err,
    isNetworkError,
  }: {
    err: { message: string };
    isNetworkError: boolean;
  }) => {
    console.log('update/error', err, isNetworkError);
    const message =
      err.message ||
      'Network exception, please check your internet connection.';
    defaultLogger.update.app.log('error', message);
    while (updateErrorTasks.length) {
      updateErrorTasks.pop()?.({ message });
    }
  },
);

export const downloadPackage: IDownloadPackage = () =>
  new Promise<IUpdateDownloadedEvent>((resolve, reject) => {
    updateAvailableTasks.push(() => {
      window.desktopApi.downloadUpdate();
    });
    updateDownloadedTasks.push((event: IUpdateDownloadedEvent) => {
      resolve(event);
    });
    updateErrorTasks.push(reject);
    window.desktopApi.checkForUpdates();
  });

export const verifyPackage: IVerifyPackage = async (params) =>
  new Promise((resolve, reject) => {
    updateVerifyTasks.push(resolve);
    updateErrorTasks.push(reject);
    window.desktopApi.verifyUpdate(params);
  });

export const installPackage: IInstallPackage = async ({ downloadedEvent }) =>
  new Promise((_, reject) => {
    defaultLogger.update.app.log('install');
    updateErrorTasks.push(reject);
    // verifyUpdate will be called by default in the electron module when calling to installUpdate
    window.desktopApi.installUpdate({
      ...downloadedEvent,
      dialog: {
        message: appLocale.intl.formatMessage({
          id: ETranslations.update_new_update_downloaded,
        }),
        buttons: [
          appLocale.intl.formatMessage({
            id: ETranslations.update_install_and_restart,
          }),
          appLocale.intl.formatMessage({
            id: ETranslations.global_later,
          }),
        ],
      },
    });
  });

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
      setPercent((prev) => Math.max(Number(Number(progress).toFixed()), prev));
    },
    10,
  );

  useEffect(() => {
    updateDownloadingTasks.push(updatePercent);
    updateDownloadedTasks.push(onSuccess);
    updateErrorTasks.push(onFailed);
  }, [onFailed, onSuccess, updatePercent]);
  return percent;
};
