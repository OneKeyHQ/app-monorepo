import { useCallback, useEffect, useState } from 'react';

import { NativeEventEmitter, NativeModules } from 'react-native';
import RNRestart from 'react-native-restart';
import { useThrottledCallback } from 'use-debounce';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { defaultLogger } from '../../logger/logger';
import RNFS from '../react-native-fs';

import type {
  IAppUpdate,
  IBundleUpdate,
  IClearPackage,
  IDownloadASC,
  IDownloadPackage,
  IInstallPackage,
  IManualInstallPackage,
  IUseDownloadProgress,
  IVerifyASC,
  IVerifyPackage,
} from './type';
import type { NativeEventSubscription } from 'react-native';

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

const clearPackage: IClearPackage = async () => {
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

const downloadPackage: IDownloadPackage = async ({
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

const downloadASC: IDownloadASC = async (params) => {
  const { downloadUrl, latestVersion } = params || {};
  if (!AutoUpdateModule || !downloadUrl || !latestVersion) {
    return;
  }
  await AutoUpdateModule.downloadASC({
    downloadUrl,
    filePath: buildFilePath(latestVersion),
  });
};

const verifyASC: IVerifyASC = async (params) => {
  const { downloadUrl, latestVersion } = params || {};
  if (!AutoUpdateModule || !downloadUrl || !latestVersion) {
    return;
  }
  await AutoUpdateModule.verifyASC({
    downloadUrl,
    filePath: buildFilePath(latestVersion),
  });
};

const verifyPackage: IVerifyPackage = async (params) => {
  const { downloadedFile, downloadUrl } = params || {};
  if (!AutoUpdateModule || !downloadedFile || !downloadUrl) {
    return;
  }
  await AutoUpdateModule.verifyAPK({
    filePath: downloadedFile || '',
    downloadUrl: downloadUrl || '',
  });
};

const installPackage: IInstallPackage = async ({
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

let AutoUpdateEventEmitter: NativeEventEmitter | null = null;
if (NativeModules.AutoUpdateModule) {
  AutoUpdateEventEmitter = new NativeEventEmitter(
    NativeModules.AutoUpdateModule,
  );
}

let BundleUpdateEventEmitter: NativeEventEmitter | null = null;
if (NativeModules.BundleUpdateModule) {
  BundleUpdateEventEmitter = new NativeEventEmitter(
    NativeModules.BundleUpdateModule,
  );
}

const DOWNLOAD_EVENT_TYPE = {
  start: 'update/start',
  downloading: 'update/downloading',
  complete: 'update/complete',
  error: 'update/error',
};

export const useDownloadProgress: IUseDownloadProgress = () => {
  const [percent, setPercent] = useState(0);

  const updatePercent = useThrottledCallback(
    ({ progress }: { progress: number }) => {
      console.log('update/downloading', progress);
      defaultLogger.update.app.log('downloading', progress);
      setPercent(parseInt(progress.toString(), 10));
    },
    10,
  );

  const startDownload = useCallback(() => {
    defaultLogger.update.app.log('start');
    setPercent(0);
  }, []);

  useEffect(() => {
    const onStartEventListener = AutoUpdateEventEmitter?.addListener(
      DOWNLOAD_EVENT_TYPE.start,
      startDownload,
    );
    const onDownloadingEventListener = AutoUpdateEventEmitter?.addListener(
      DOWNLOAD_EVENT_TYPE.downloading,
      updatePercent,
    );

    const onBundleStartEventListener = BundleUpdateEventEmitter?.addListener(
      DOWNLOAD_EVENT_TYPE.start,
      startDownload,
    );
    const onBundleDownloadingEventListener =
      BundleUpdateEventEmitter?.addListener(
        DOWNLOAD_EVENT_TYPE.downloading,
        updatePercent,
      );
    return () => {
      onStartEventListener?.remove();
      onDownloadingEventListener?.remove();
      onBundleStartEventListener?.remove();
      onBundleDownloadingEventListener?.remove();
    };
  }, [startDownload, updatePercent]);
  return percent;
};

const manualInstallPackage: IManualInstallPackage = () => Promise.resolve();

export const AppUpdate: IAppUpdate = {
  downloadPackage,
  verifyPackage,
  verifyASC,
  downloadASC,
  installPackage,
  manualInstallPackage,
  clearPackage,
};

const { BundleUpdateModule } = NativeModules as {
  BundleUpdateModule: IBundleUpdate;
};

export const BundleUpdate: IBundleUpdate = {
  downloadBundle: (params) => {
    return new Promise((resolve, reject) => {
      BundleUpdateModule.downloadBundle(params)
        .then((result) => {
          // eslint-disable-next-line prefer-const
          let onSuccessSubscription: NativeEventSubscription | undefined;
          // eslint-disable-next-line prefer-const
          let onErrorSubscription: NativeEventSubscription | undefined;
          const removeSubscriptions = () => {
            onSuccessSubscription?.remove();
            onErrorSubscription?.remove();
          };
          const onSuccess = () => {
            resolve(result);
            removeSubscriptions();
          };
          const onError = (error: string) => {
            reject(error);
            removeSubscriptions();
          };
          onSuccessSubscription = BundleUpdateEventEmitter?.addListener(
            DOWNLOAD_EVENT_TYPE.error,
            onError,
          );
          onErrorSubscription = BundleUpdateEventEmitter?.addListener(
            DOWNLOAD_EVENT_TYPE.complete,
            onSuccess,
          );
        })
        .catch(reject);
    });
  },
  verifyBundle: (params) => BundleUpdateModule.verifyBundle(params),
  verifyBundleASC: (params) => BundleUpdateModule.verifyBundleASC(params),
  downloadBundleASC: (params) => BundleUpdateModule.downloadBundleASC(params),
  installBundle: async (params) => {
    await BundleUpdateModule.installBundle(params);
    setTimeout(() => {
      RNRestart.restart();
    }, 2500);
  },
  clearBundle: () => BundleUpdateModule.clearBundle(),
  testVerification: () => BundleUpdateModule.testVerification(),
};
