import { useCallback, useEffect, useRef, useState } from 'react';

import RNRestart from 'react-native-restart';
import { useThrottledCallback } from 'use-debounce';

import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import platformEnv from '../../platformEnv';

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

// AppUpdate native module is excluded from google/huawei builds via
// dependencyConfiguration: 'prodImplementation' in react-native.config.js.
// Use lazy require() to avoid crash when the module is not linked.
const isAppUpdateAvailable =
  !platformEnv.isNativeAndroidGooglePlay && !platformEnv.isNativeAndroidHuawei;

// Local interface matching the Nitro HybridObject shape, avoids name collision
// between the value export and the type re-export from the package.
interface IReactNativeAppUpdateNative {
  clearCache(): Promise<void>;
  downloadAPK(params: {
    downloadUrl: string;
    notificationTitle: string;
    fileSize: number;
  }): Promise<void>;
  downloadASC(params: { downloadUrl: string }): Promise<void>;
  verifyASC(params: { downloadUrl: string }): Promise<void>;
  verifyAPK(params: { downloadUrl: string }): Promise<void>;
  installAPK(params: { downloadUrl: string }): Promise<void>;
  addDownloadListener(
    callback: (event: { type: string; progress: number }) => void,
  ): number;
  removeDownloadListener(id: number): void;
}

let _reactNativeAppUpdate: IReactNativeAppUpdateNative | null = null;
function getReactNativeAppUpdate(): IReactNativeAppUpdateNative {
  if (!isAppUpdateAvailable) {
    throw new OneKeyLocalError(
      'AppUpdate is not available on Google Play / Huawei channel',
    );
  }
  if (!_reactNativeAppUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@onekeyfe/react-native-app-update');
    _reactNativeAppUpdate = mod.ReactNativeAppUpdate;
  }
  return _reactNativeAppUpdate!;
}

const clearPackage: IClearPackage = async () => {
  if (!isAppUpdateAvailable) {
    return;
  }
  await getReactNativeAppUpdate().clearCache();
};

const downloadPackage: IDownloadPackage = async ({
  downloadUrl,
  latestVersion,
  fileSize,
}) => {
  if (!downloadUrl || !latestVersion) {
    throw new OneKeyLocalError('Invalid version or downloadUrl');
  }
  await getReactNativeAppUpdate().downloadAPK({
    downloadUrl,
    notificationTitle: 'Downloading',
    fileSize: fileSize || 0,
  });
  return {
    downloadedFile: downloadUrl,
  };
};

const downloadASC: IDownloadASC = async (params) => {
  const { downloadUrl } = params || {};
  if (!downloadUrl) {
    return;
  }
  await getReactNativeAppUpdate().downloadASC({
    downloadUrl,
  });
};

const verifyASC: IVerifyASC = async (params) => {
  const { downloadUrl } = params || {};
  if (!downloadUrl) {
    return;
  }
  await getReactNativeAppUpdate().verifyASC({
    downloadUrl,
  });
};

const verifyPackage: IVerifyPackage = async (params) => {
  const { downloadUrl } = params || {};
  if (!downloadUrl) {
    return;
  }
  await getReactNativeAppUpdate().verifyAPK({
    downloadUrl,
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
  return getReactNativeAppUpdate().installAPK({
    downloadUrl: downloadUrl || '',
  });
};

const DOWNLOAD_EVENT_TYPE = {
  start: 'update/start',
  downloading: 'update/downloading',
  // AppUpdate native uses 'update/downloaded', BundleUpdate uses 'update/complete'
  appDownloaded: 'update/downloaded',
  bundleComplete: 'update/complete',
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
    if (isAppUpdateAvailable) {
      appUpdateListenerId.current =
        getReactNativeAppUpdate().addDownloadListener((event) => {
          if (event.type === DOWNLOAD_EVENT_TYPE.start) {
            startDownload();
          } else if (event.type === DOWNLOAD_EVENT_TYPE.downloading) {
            updatePercent({ progress: event.progress });
          }
        });
    }

    bundleUpdateListenerId.current =
      ReactNativeBundleUpdate.addDownloadListener((event) => {
        if (event.type === DOWNLOAD_EVENT_TYPE.start) {
          startDownload();
        } else if (event.type === DOWNLOAD_EVENT_TYPE.downloading) {
          updatePercent({ progress: event.progress });
        }
      });

    return () => {
      if (isAppUpdateAvailable && appUpdateListenerId.current !== null) {
        getReactNativeAppUpdate().removeDownloadListener(
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
  downloadBundle: async (params) => {
    const result = await ReactNativeBundleUpdate.downloadBundle({
      downloadUrl: params.downloadUrl || '',
      latestVersion: params.latestVersion || '',
      bundleVersion: params.bundleVersion || '',
      fileSize: params.fileSize || 0,
      sha256: params.sha256 || '',
    });
    return {
      ...params,
      downloadedFile: result.downloadedFile,
    };
  },
  verifyBundle: (params) =>
    ReactNativeBundleUpdate.verifyBundle({
      downloadedFile: params?.downloadedFile || '',
      sha256: params?.sha256 || '',
      latestVersion: params?.latestVersion || '',
      bundleVersion: params?.bundleVersion || '',
    }),
  verifyBundleASC: (params) =>
    ReactNativeBundleUpdate.verifyBundleASC({
      downloadedFile: params?.downloadedFile || '',
      sha256: params?.sha256 || '',
      latestVersion: params?.latestVersion || '',
      bundleVersion: params?.bundleVersion || '',
      signature: params?.signature || '',
    }),
  downloadBundleASC: (params) =>
    ReactNativeBundleUpdate.downloadBundleASC({
      downloadUrl: params?.downloadUrl || '',
      downloadedFile: params?.downloadedFile || '',
      signature: params?.signature || '',
      latestVersion: params?.latestVersion || '',
      bundleVersion: params?.bundleVersion || '',
      sha256: params?.sha256 || '',
    }),
  installBundle: async (params) => {
    await ReactNativeBundleUpdate.installBundle({
      downloadedFile: params?.downloadedFile || '',
      latestVersion: params?.latestVersion || '',
      bundleVersion: params?.bundleVersion || '',
      signature: params?.signature || '',
    });
    defaultLogger.app.appUpdate.restartRNApp();
    setTimeout(() => {
      RNRestart.restart();
    }, 2500);
  },
  clearBundle: () => ReactNativeBundleUpdate.clearBundle(),
  isSkipGpgVerificationAllowed: () =>
    Promise.resolve(ReactNativeBundleUpdate.isSkipGpgVerificationAllowed()),
  clearAllJSBundleData: () => ReactNativeBundleUpdate.clearAllJSBundleData(),
  testVerification: () => ReactNativeBundleUpdate.testVerification(),
  testSkipVerification: () => ReactNativeBundleUpdate.testSkipVerification(),
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
  getJsBundlePath: () => ReactNativeBundleUpdate.getJsBundlePathAsync(),
  getSha256FromFilePath: (filePath) =>
    ReactNativeBundleUpdate.getSha256FromFilePath(filePath),
};
