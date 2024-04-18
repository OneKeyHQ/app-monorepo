import { useEffect, useState } from 'react';

import { NativeEventEmitter, NativeModules } from 'react-native';
import { useThrottledCallback } from 'use-debounce';

import RNFS from '../react-native-fs';

import type {
  IDownloadPackage,
  IInstallPackage,
  IUseDownloadProgress,
} from './type';

const DIR_PATH = `file://${RNFS?.CachesDirectoryPath || ''}/apk`;
const buildFilePath = (version: string) => `${DIR_PATH}/${version}.apk`;

const { AutoUpdateModule } = NativeModules as {
  AutoUpdateModule: {
    installAPK: (params: {
      filePath: string;
      sha256?: string;
    }) => Promise<void>;
    downloadAPK: (params: {
      url: string;
      filePath: string;
      notificationTitle: string;
      sha256?: string;
    }) => Promise<void>;
  };
};

export const downloadPackage: IDownloadPackage = async (
  downloadUrl,
  version,
) => {
  const info = await RNFS?.getFSInfo();
  if (info?.freeSpace && info.freeSpace < 1024 * 1024 * 300) {
    throw new Error('Insufficient disk space, please clear and retry.');
  }
  await RNFS?.mkdir(DIR_PATH);
  if (!downloadUrl || !version) {
    return;
  }
  return AutoUpdateModule.downloadAPK({
    url: downloadUrl,
    filePath: buildFilePath(version),
    notificationTitle: `Download OneKey App ${version}`,
  });
};

export const installPackage: IInstallPackage = (version) => {
  if (!version) {
    return Promise.resolve();
  }
  return AutoUpdateModule.installAPK({
    filePath: buildFilePath(version),
  });
};

const eventEmitter = new NativeEventEmitter(NativeModules.AutoUpdateModule);
export const useDownloadProgress: IUseDownloadProgress = (
  onSuccess,
  onFailed,
) => {
  const [percent, setPercent] = useState(0);

  const updatePercent = useThrottledCallback(
    ({ progress }: { progress: number }) => {
      console.log('update/downloading', progress);
      setPercent(progress);
    },
    10,
  );

  useEffect(() => {
    const onStartEventListener = eventEmitter.addListener(
      'update/start',
      () => {
        console.log('update/start');
        setPercent(0);
      },
    );
    const onDownloadingEventListener = eventEmitter.addListener(
      'update/downloading',
      updatePercent,
    );
    const onDownloadedEventListener = eventEmitter.addListener(
      'update/downloaded',
      onSuccess,
    );
    const onErrorEventListener = eventEmitter.addListener(
      'update/error',
      onFailed,
    );
    return () => {
      onStartEventListener.remove();
      onDownloadingEventListener.remove();
      onDownloadedEventListener.remove();
      onErrorEventListener.remove();
    };
  }, [onFailed, onSuccess, updatePercent]);
  return percent;
};
