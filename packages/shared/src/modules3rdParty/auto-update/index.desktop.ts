import { useEffect, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import type {
  IDownloadPackage,
  IInstallPackage,
  IUseDownloadProgress,
} from './type';

const updateCheckingTasks: (() => void)[] = [];
window.desktopApi?.on?.('update/checking', () => {
  console.log('update/checking');
  while (updateCheckingTasks.length) {
    updateCheckingTasks.pop()?.();
  }
});

const updateAvailableTasks: (() => void)[] = [];
window.desktopApi?.on?.('update/available', ({ version }) => {
  console.log('update/available, version: ', version);
  while (updateAvailableTasks.length) {
    updateAvailableTasks.pop()?.();
  }
});

window.desktopApi?.on?.('update/download', ({ version }) => {
  console.log('update/download, version: ', version);
});

let updateDownloadingTasks: ((params: {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}) => void)[] = [];
window.desktopApi?.on?.('update/downloading', (params) => {
  updateDownloadingTasks.forEach((t) => t(params));
});

const updateDownloadedTasks: (() => void)[] = [];
window.desktopApi.on('update/downloaded', () => {
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
    const errorMessage =
      err.message ||
      'Network exception, please check your internet connection.';
    while (updateErrorTasks.length) {
      updateErrorTasks.pop()?.(err);
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
      console.log('update/downloading', progress);
      setPercent(percent);
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
