import { useCallback, useEffect, useState } from 'react';

import { NativeEventEmitter, NativeModules } from 'react-native';
import { useThrottledCallback } from 'use-debounce';

import { defaultLogger } from '../../logger/logger';
import RNFS from '../react-native-fs';

import type {
  IClearPackage,
  IDownloadPackage,
  IInstallPackage,
  IUseDownloadProgress,
  IVerifyPackage,
} from './type';

const DIR_PATH = `file://${RNFS?.CachesDirectoryPath || ''}/apk`;
const buildFilePath = (version: string) => `${DIR_PATH}/${version}.apk`;

const { AutoUpdateModule } = NativeModules as {
  AutoUpdateModule: {
    clearCache: () => Promise<void>;
    downloadAPK: (params: {
      url: string;
      filePath: string;
      notificationTitle: string;
      sha256?: string;
    }) => Promise<void>;
    // an exception will be thrown when validation fails.
    verifyAPK: (params: { filePath: string; sha256?: string }) => Promise<void>;
    // verifyAPK will be called by default in the native module when calling to install the APK
    installAPK: (params: {
      filePath: string;
      sha256?: string;
    }) => Promise<void>;
  };
};

export const clearPackage: IClearPackage = async () => {
  if (!RNFS) {
    return;
  }
  await AutoUpdateModule.clearCache();
  const isExist = await RNFS.exists(DIR_PATH);
  if (isExist) {
    await RNFS.unlink(DIR_PATH);
  }
};

export const downloadPackage: IDownloadPackage = async ({
  downloadUrl,
  latestVersion,
  sha256,
}) => {
  const info = await RNFS?.getFSInfo();
  if (info?.freeSpace && info.freeSpace < 1024 * 1024 * 300) {
    throw new Error('Insufficient disk space, please clear and retry.');
  }
  await RNFS?.mkdir(DIR_PATH);
  if (!downloadUrl || !latestVersion) {
    throw new Error('Invalid version or downloadUrl');
  }
  const filePath = buildFilePath(latestVersion);
  await AutoUpdateModule.downloadAPK({
    url: downloadUrl,
    filePath,
    notificationTitle: 'Downloading',
    sha256,
  });
  return {
    downloadedFile: filePath,
    sha256,
  };
};

export const verifyPackage: IVerifyPackage = async (params) => {
  await AutoUpdateModule.verifyAPK({
    filePath: params.downloadedFile,
    sha256: params.sha256,
  });
};

export const installPackage: IInstallPackage = ({ latestVersion, sha256 }) => {
  defaultLogger.update.app.log('install', latestVersion);
  if (!latestVersion) {
    return Promise.resolve();
  }
  return AutoUpdateModule.installAPK({
    filePath: buildFilePath(latestVersion),
    sha256,
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
      defaultLogger.update.app.log('downloading', progress);
      setPercent(progress);
    },
    10,
  );

  const handleSuccess = useCallback(() => {
    defaultLogger.update.app.log('downloaded');
    onSuccess();
  }, [onSuccess]);

  const handleFailed = useCallback(
    (params: { message: string }) => {
      defaultLogger.update.app.log('error', params.message);
      onFailed(params);
    },
    [onFailed],
  );

  useEffect(() => {
    const onStartEventListener = eventEmitter.addListener(
      'update/start',
      () => {
        defaultLogger.update.app.log('start');
        setPercent(0);
      },
    );
    const onDownloadingEventListener = eventEmitter.addListener(
      'update/downloading',
      updatePercent,
    );
    const onDownloadedEventListener = eventEmitter.addListener(
      'update/downloaded',
      handleSuccess,
    );
    const onErrorEventListener = eventEmitter.addListener(
      'update/error',
      handleFailed,
    );
    return () => {
      onStartEventListener.remove();
      onDownloadingEventListener.remove();
      onDownloadedEventListener.remove();
      onErrorEventListener.remove();
    };
  }, [handleFailed, handleSuccess, onFailed, onSuccess, updatePercent]);
  return percent;
};
