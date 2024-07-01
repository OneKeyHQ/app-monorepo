import { useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import { defaultLogger } from '../../logger/logger';

import type {
  IDownloadPackage,
  IInstallPackage,
  IUseDownloadProgress,
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

const updateDownloadedTasks: (() => void)[] = [];
window.desktopApi.on('update/downloaded', () => {
  defaultLogger.update.app.log('download');
  while (updateDownloadedTasks.length) {
    updateDownloadedTasks.pop()?.();
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
  new Promise((resolve, reject) => {
    updateAvailableTasks.push(() => {
      window.desktopApi.downloadUpdate();
    });
    updateDownloadedTasks.push(resolve);
    updateErrorTasks.push(reject);
    window.desktopApi.checkForUpdates();
  });

export const installPackage: IInstallPackage = async () => {
  defaultLogger.update.app.log('install');
  window.desktopApi.installUpdate();
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
