import { useCallback, useEffect, useState } from 'react';

import { NativeEventEmitter, NativeModules } from 'react-native';
import { useThrottledCallback } from 'use-debounce';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { defaultLogger } from '../../logger/logger';
import RNFS from '../react-native-fs';

import type {
  IClearPackage,
  IDownloadASC,
  IDownloadPackage,
  IInstallPackage,
  IManualInstallPackage,
  IUseDownloadProgress,
  IVerifyASC,
  IVerifyPackage,
} from './type';

const DIR_PATH = `file://${RNFS?.CachesDirectoryPath || ''}/apk`;
const buildFilePath = (version: string) => `${DIR_PATH}/${version}.apk`;

interface IFileParams {
  downloadUrl: string;
  filePath: string;
}

const { AutoUpdateModule } = NativeModules as {
  AutoUpdateModule: {
    clearCache: () => Promise<void>;
    downloadAPK: (
      params: IFileParams & {
        notificationTitle: string;
      },
    ) => Promise<void>;
    downloadASC: (params: IFileParams) => Promise<void>;
    verifyASC: (params: IFileParams) => Promise<void>;
    // an exception will be thrown when validation fails.
    verifyAPK: (params: IFileParams) => Promise<void>;
    // verifyAPK will be called by default in the native module when calling to install the APK
    installAPK: (params: IFileParams) => Promise<void>;
  };
};

export const clearPackage: IClearPackage = async () => {
  if (!AutoUpdateModule) {
    return;
  }
  await AutoUpdateModule.clearCache();
  if (!RNFS) {
    return;
  }
  const isExist = await RNFS.exists(DIR_PATH);
  if (isExist) {
    await RNFS.unlink(DIR_PATH);
  }
};

export const downloadPackage: IDownloadPackage = async ({
  downloadUrl,
  latestVersion,
}) => {
  if (!AutoUpdateModule) {
    return {
      downloadedFile: '',
    };
  }
  await RNFS?.mkdir(DIR_PATH);
  if (!downloadUrl || !latestVersion) {
    throw new OneKeyLocalError('Invalid version or downloadUrl');
  }
  const filePath = buildFilePath(latestVersion);
  await AutoUpdateModule.downloadAPK({
    downloadUrl,
    filePath,
    notificationTitle: 'Downloading',
  });
  return {
    downloadedFile: filePath,
  };
};

export const downloadASC: IDownloadASC = async ({
  downloadUrl,
  latestVersion,
}) => {
  if (!AutoUpdateModule || !downloadUrl || !latestVersion) {
    return;
  }
  await AutoUpdateModule.downloadASC({
    downloadUrl,
    filePath: buildFilePath(latestVersion),
  });
};

export const verifyASC: IVerifyASC = async ({ downloadUrl, latestVersion }) => {
  if (!AutoUpdateModule || !downloadUrl || !latestVersion) {
    return;
  }
  await AutoUpdateModule.verifyASC({
    downloadUrl,
    filePath: buildFilePath(latestVersion),
  });
};

export const verifyPackage: IVerifyPackage = async (params) => {
  if (!AutoUpdateModule) {
    return;
  }
  await AutoUpdateModule.verifyAPK({
    filePath: params.downloadedFile || '',
    downloadUrl: params.downloadUrl || '',
  });
};

export const installPackage: IInstallPackage = async ({
  latestVersion,
  downloadUrl,
}) => {
  if (!AutoUpdateModule) {
    return;
  }
  defaultLogger.update.app.log('install', latestVersion);
  if (!latestVersion) {
    return;
  }
  return AutoUpdateModule.installAPK({
    filePath: buildFilePath(latestVersion),
    downloadUrl: downloadUrl || '',
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

export const manualInstallPackage: IManualInstallPackage = () =>
  Promise.resolve();
