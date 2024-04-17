import { useEffect, useState } from 'react';

import { NativeEventEmitter, NativeModules } from 'react-native';

import RNFS from '../react-native-fs';

import type { IDownloadAPK, IInstallAPK, IUseDownloadProgress } from './type';

const DIR_PATH = `file://${RNFS.CachesDirectoryPath}/apk`;
const buildFilePath = (version?: string) => `${DIR_PATH}/${version || ''}.apk`;

const { DownloadManager } = NativeModules as {
  DownloadManager: {
    installAPK: (path: string) => Promise<void>;
    downloadAPK: (url: string, filePath: string) => Promise<void>;
  };
};

export const downloadAPK: IDownloadAPK = async (downloadUrl, version) => {
  await RNFS?.mkdir(DIR_PATH);
  return downloadAPK(downloadUrl, buildFilePath(version));
};

export const installAPK: IInstallAPK = (version) =>
  DownloadManager.installAPK(buildFilePath(version));

const eventEmitter = new NativeEventEmitter(NativeModules.DownloadManager);
export const useDownloadProgress: IUseDownloadProgress = (onDownloaded) => {
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const onStartEventListener = eventEmitter.addListener(
      'update/start',
      () => {
        setPercent(0);
      },
    );
    const onDownloadingEventListener = eventEmitter.addListener(
      'update/downloading',
      ({ progress }: { progress: number }) => {
        setPercent(progress);
      },
    );
    const onDownloadedEventListener = eventEmitter.addListener(
      'update/downloaded',
      () => {
        onDownloaded();
      },
    );
    return () => {
      onStartEventListener.remove();
      onDownloadingEventListener.remove();
      onDownloadedEventListener.remove();
    };
  }, [onDownloaded]);
  return percent;
};
