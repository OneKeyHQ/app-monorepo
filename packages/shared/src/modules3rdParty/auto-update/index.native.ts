import { useCallback, useEffect, useRef, useState } from 'react';

import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';
import { useThrottledCallback } from 'use-debounce';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import platformEnv from '../../platformEnv';
import { appRestart } from '../appRestart';
import { EAppRestartMode } from '../appRestart/types';

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
  clearApkCache(): Promise<void>;
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

const toNativeString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const toNativeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clearPackage: IClearPackage = async () => {
  if (!isAppUpdateAvailable) {
    return;
  }
  await getReactNativeAppUpdate().clearCache();
};

// Android: wipe the standalone APK cache (cacheDir/apks). iOS exposes a
// native no-op stub. Channels without the AppUpdate native module
// (Google Play / Huawei) resolve immediately.
const clearApkCache = async (): Promise<void> => {
  if (!isAppUpdateAvailable) {
    return;
  }
  await getReactNativeAppUpdate().clearApkCache();
};

const downloadPackage: IDownloadPackage = async ({
  downloadUrl,
  latestVersion,
  fileSize,
}) => {
  const nativeDownloadUrl = toNativeString(downloadUrl).trim();
  const nativeLatestVersion = toNativeString(latestVersion).trim();
  if (!nativeDownloadUrl || !nativeLatestVersion) {
    throw new OneKeyLocalError('Invalid version or downloadUrl');
  }
  await getReactNativeAppUpdate().downloadAPK({
    downloadUrl: nativeDownloadUrl,
    notificationTitle: 'Downloading',
    fileSize: toNativeNumber(fileSize),
  });
  return {
    downloadedFile: nativeDownloadUrl,
  };
};

const downloadASC: IDownloadASC = async (params) => {
  const nativeDownloadUrl = toNativeString(params?.downloadUrl).trim();
  if (!nativeDownloadUrl) {
    return;
  }
  await getReactNativeAppUpdate().downloadASC({
    downloadUrl: nativeDownloadUrl,
  });
};

const verifyASC: IVerifyASC = async (params) => {
  const nativeDownloadUrl = toNativeString(params?.downloadUrl).trim();
  if (!nativeDownloadUrl) {
    return;
  }
  await getReactNativeAppUpdate().verifyASC({
    downloadUrl: nativeDownloadUrl,
  });
};

const verifyPackage: IVerifyPackage = async (params) => {
  const nativeDownloadUrl = toNativeString(params?.downloadUrl).trim();
  if (!nativeDownloadUrl) {
    return;
  }
  await getReactNativeAppUpdate().verifyAPK({
    downloadUrl: nativeDownloadUrl,
  });
};

const installPackage: IInstallPackage = async ({
  latestVersion,
  downloadUrl,
}) => {
  defaultLogger.update.app.log('install', latestVersion);
  const nativeLatestVersion = toNativeString(latestVersion).trim();
  if (!nativeLatestVersion) {
    return;
  }
  return getReactNativeAppUpdate().installAPK({
    downloadUrl: toNativeString(downloadUrl),
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
  clearApkCache,
};

export const BundleUpdate: IBundleUpdate = {
  downloadBundle: async (params) => {
    const result = await ReactNativeBundleUpdate.downloadBundle({
      downloadUrl: toNativeString(params.downloadUrl),
      latestVersion: toNativeString(params.latestVersion),
      bundleVersion: toNativeString(params.bundleVersion),
      fileSize: toNativeNumber(params.fileSize),
      sha256: toNativeString(params.sha256),
    });
    return {
      ...params,
      downloadedFile: result.downloadedFile,
    };
  },
  verifyBundle: (params) =>
    ReactNativeBundleUpdate.verifyBundle({
      downloadedFile: toNativeString(params?.downloadedFile),
      sha256: toNativeString(params?.sha256),
      latestVersion: toNativeString(params?.latestVersion),
      bundleVersion: toNativeString(params?.bundleVersion),
    }),
  verifyBundleASC: (params) =>
    ReactNativeBundleUpdate.verifyBundleASC({
      downloadedFile: toNativeString(params?.downloadedFile),
      sha256: toNativeString(params?.sha256),
      latestVersion: toNativeString(params?.latestVersion),
      bundleVersion: toNativeString(params?.bundleVersion),
      signature: toNativeString(params?.signature),
    }),
  downloadBundleASC: (params) =>
    ReactNativeBundleUpdate.downloadBundleASC({
      downloadUrl: toNativeString(params?.downloadUrl),
      downloadedFile: toNativeString(params?.downloadedFile),
      signature: toNativeString(params?.signature),
      latestVersion: toNativeString(params?.latestVersion),
      bundleVersion: toNativeString(params?.bundleVersion),
      sha256: toNativeString(params?.sha256),
    }),
  installBundle: async (params) => {
    await ReactNativeBundleUpdate.installBundle({
      downloadedFile: toNativeString(params?.downloadedFile),
      latestVersion: toNativeString(params?.latestVersion),
      bundleVersion: toNativeString(params?.bundleVersion),
      signature: toNativeString(params?.signature),
    });
    defaultLogger.app.appUpdate.restartRNApp();
    // mode=All — OTA install rewrote bundle on disk; both main and bg
    // runtimes need to come up against the new bundle so moduleId tables
    // stay consistent. The setTimeout keeps the existing 2.5s grace
    // window (MMKV / DB fsync, UI affordance) before reload triggers.
    // BootRecovery.markBootSuccess() is invoked inside appRestart.
    setTimeout(() => {
      void appRestart({
        mode: EAppRestartMode.All,
        reason: 'ota.installBundle',
      });
    }, 2500);
  },
  clearBundle: () => ReactNativeBundleUpdate.clearBundle(),
  clearDownload: () => ReactNativeBundleUpdate.clearDownload(),
  resetToBuiltInBundle: async () => {
    await ReactNativeBundleUpdate.resetToBuiltInBundle();
  },
  restart: () => {
    // Generic OTA-driven restart (retry path, dialog-confirmed restart).
    // Treated as all-mode because callers expect the same semantics as a
    // freshly-installed bundle. BootRecovery.markBootSuccess() runs inside
    // appRestart, so no explicit call is needed here.
    setTimeout(() => {
      void appRestart({ mode: EAppRestartMode.All, reason: 'ota.restart' });
    }, 2500);
  },
  isSkipGpgVerificationAllowed: () =>
    Promise.resolve(ReactNativeBundleUpdate.isSkipGpgVerificationAllowed()),
  pruneStaleAppVersionBundles: () =>
    ReactNativeBundleUpdate.pruneStaleAppVersionBundles(),
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
    if (params.appVersion && params.bundleVersion) {
      // Switching bundles changes what's on disk for both main and bg;
      // mode=All to avoid moduleId drift after the swap. BootRecovery is
      // marked inside appRestart, so no explicit call is needed here.
      setTimeout(() => {
        void appRestart({
          mode: EAppRestartMode.All,
          reason: 'ota.switchBundle',
        });
      }, 2500);
    }
  },
  getNativeAppVersion: () => ReactNativeBundleUpdate.getNativeAppVersion(),
  getNativeBuildNumber: () => ReactNativeBundleUpdate.getNativeBuildNumber(),
  getBuiltinBundleVersion: () =>
    ReactNativeBundleUpdate.getBuiltinBundleVersion(),
  getJsBundlePath: () => ReactNativeBundleUpdate.getJsBundlePathAsync(),
  getBackgroundJsBundlePath: () =>
    ReactNativeBundleUpdate.getBackgroundJsBundlePathAsync(),
  getSha256FromFilePath: (filePath) =>
    ReactNativeBundleUpdate.getSha256FromFilePath(filePath),
};
