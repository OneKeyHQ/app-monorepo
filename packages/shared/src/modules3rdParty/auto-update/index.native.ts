import { useCallback, useEffect, useRef, useState } from 'react';

import RNRestart from 'react-native-restart';
import { useThrottledCallback } from 'use-debounce';

import { ReactNativeAppUpdate } from '@onekeyfe/react-native-app-update';
import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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

const DIR_PATH = `file://${RNFS?.CachesDirectoryPath || ''}/apk`;
const buildFilePath = (version: string) => `${DIR_PATH}/${version}.apk`;

const clearPackage: IClearPackage = async () => {
  await ReactNativeAppUpdate.clearCache();
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
  await RNFS?.mkdir(DIR_PATH);
  if (!downloadUrl || !latestVersion) {
    throw new OneKeyLocalError('Invalid version or downloadUrl');
  }
  const filePath = buildFilePath(latestVersion);
  await ReactNativeAppUpdate.downloadAPK({
    downloadUrl,
    filePath,
    notificationTitle: 'Downloading',
    fileSize: 0,
  });
  return {
    downloadedFile: filePath,
  };
};

const downloadASC: IDownloadASC = async (params) => {
  const { downloadUrl, latestVersion } = params || {};
  if (!downloadUrl || !latestVersion) {
    return;
  }
  await ReactNativeAppUpdate.downloadASC({
    downloadUrl,
    filePath: buildFilePath(latestVersion),
  });
};

const verifyASC: IVerifyASC = async (params) => {
  const { downloadUrl, latestVersion } = params || {};
  if (!downloadUrl || !latestVersion) {
    return;
  }
  await ReactNativeAppUpdate.verifyASC({
    downloadUrl,
    filePath: buildFilePath(latestVersion),
  });
};

const verifyPackage: IVerifyPackage = async (params) => {
  const { downloadedFile, downloadUrl } = params || {};
  if (!downloadedFile || !downloadUrl) {
    return;
  }
  await ReactNativeAppUpdate.verifyAPK({
    filePath: downloadedFile || '',
    downloadUrl: downloadUrl || '',
  });
};

const installPackage: IInstallPackage = async ({
  latestVersion,
  downloadUrl,
}) => {
  defaultLogger.update.app.log('install', latestVersion);
  if (!latestVersion) {
    return;
  }
  return ReactNativeAppUpdate.installAPK({
    filePath: buildFilePath(latestVersion),
    downloadUrl: downloadUrl || '',
  });
};

const DOWNLOAD_EVENT_TYPE = {
  start: 'update/start',
  downloading: 'update/downloading',
  complete: 'update/complete',
  error: 'update/error',
};

export const useDownloadProgress: IUseDownloadProgress = () => {
  const [percent, setPercent] = useState(0);
  const appUpdateListenerId = useRef<number | null>(null);
  const bundleUpdateListenerId = useRef<number | null>(null);

  const updatePercent = useThrottledCallback(
    ({ progress }: { progress: number }) => {
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
    appUpdateListenerId.current = ReactNativeAppUpdate.addDownloadListener(
      (event) => {
        if (event.type === DOWNLOAD_EVENT_TYPE.start) {
          startDownload();
        } else if (event.type === DOWNLOAD_EVENT_TYPE.downloading) {
          updatePercent({ progress: event.progress });
        }
      },
    );

    bundleUpdateListenerId.current =
      ReactNativeBundleUpdate.addDownloadListener((event) => {
        if (event.type === DOWNLOAD_EVENT_TYPE.start) {
          startDownload();
        } else if (event.type === DOWNLOAD_EVENT_TYPE.downloading) {
          updatePercent({ progress: event.progress });
        }
      });

    return () => {
      if (appUpdateListenerId.current !== null) {
        ReactNativeAppUpdate.removeDownloadListener(
          appUpdateListenerId.current,
        );
      }
      if (bundleUpdateListenerId.current !== null) {
        ReactNativeBundleUpdate.removeDownloadListener(
          bundleUpdateListenerId.current,
        );
      }
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

export const BundleUpdate: IBundleUpdate = {
  downloadBundle: (params) => {
    const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    return new Promise((resolve, reject) => {
      ReactNativeBundleUpdate.downloadBundle(params)
        .then((result) => {
          let onListenerId: number | null = null;
          let settled = false;
          const timeoutId = setTimeout(() => {
            if (!settled) {
              settled = true;
              removeListener();
              reject(new Error('Bundle download timed out'));
            }
          }, DOWNLOAD_TIMEOUT_MS);
          const removeListener = () => {
            clearTimeout(timeoutId);
            if (onListenerId !== null) {
              ReactNativeBundleUpdate.removeDownloadListener(onListenerId);
            }
          };
          const onSuccess = () => {
            resolve(result);
            removeSubscriptions();
          };
          const onError = (error: string) => {
            reject(new Error(error));
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
  verifyBundle: (params) => ReactNativeBundleUpdate.verifyBundle(params),
  verifyBundleASC: (params) => ReactNativeBundleUpdate.verifyBundleASC(params),
  downloadBundleASC: (params) =>
    ReactNativeBundleUpdate.downloadBundleASC(params),
  installBundle: async (params) => {
    await ReactNativeBundleUpdate.installBundle(params);
    defaultLogger.app.appUpdate.restartRNApp();
    setTimeout(() => {
      RNRestart.restart();
    }, 2500);
  },
  clearBundle: () => ReactNativeBundleUpdate.clearBundle(),
  clearAllJSBundleData: () => ReactNativeBundleUpdate.clearAllJSBundleData(),
  testVerification: () => ReactNativeBundleUpdate.testVerification(),
  testDeleteJsBundle: (appVersion, bundleVersion) =>
    ReactNativeBundleUpdate.testDeleteJsBundle(appVersion, bundleVersion),
  testDeleteJsRuntimeDir: (appVersion, bundleVersion) =>
    ReactNativeBundleUpdate.testDeleteJsRuntimeDir(appVersion, bundleVersion),
  testDeleteMetadataJson: (appVersion, bundleVersion) =>
    ReactNativeBundleUpdate.testDeleteMetadataJson(appVersion, bundleVersion),
  testWriteEmptyMetadataJson: (appVersion, bundleVersion) =>
    ReactNativeBundleUpdate.testWriteEmptyMetadataJson(
      appVersion,
      bundleVersion,
    ),
  getWebEmbedPath: () => ReactNativeBundleUpdate.getWebEmbedPath() || '',
  getWebEmbedPathAsync: () => ReactNativeBundleUpdate.getWebEmbedPathAsync(),
  getFallbackBundles: () =>
    ReactNativeBundleUpdate.getFallbackUpdateBundleData(),
  isBundleExists: (appVersion, bundleVersion) =>
    ReactNativeBundleUpdate.isBundleExists(appVersion, bundleVersion),
  verifyExtractedBundle: (appVersion, bundleVersion) =>
    ReactNativeBundleUpdate.verifyExtractedBundle(appVersion, bundleVersion),
  listLocalBundles: () => ReactNativeBundleUpdate.listLocalBundles(),
  switchBundle: async (params) => {
    await ReactNativeBundleUpdate.setCurrentUpdateBundleData(params);
    setTimeout(() => {
      RNRestart.restart();
    }, 2500);
  },
  getNativeAppVersion: () => ReactNativeBundleUpdate.getNativeAppVersion(),
  getNativeBuildNumber: () => Promise.resolve(''),
  getJsBundlePath: () => ReactNativeBundleUpdate.getJsBundlePath(),
  getSha256FromFilePath: (filePath) =>
    ReactNativeBundleUpdate.getSha256FromFilePath(filePath),
};
