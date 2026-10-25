import { useCallback, useEffect, useRef, useState } from 'react';

import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';
import { useThrottledCallback } from 'use-debounce';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import platformEnv from '../../platformEnv';
import { appRestart } from '../appRestart';
import { EAppRestartMode } from '../appRestart/types';

import {
  EUpdateErrorCode,
  createUpdateError,
  runUpdateOperation,
} from './error';
import {
  EAppUpdatePackageAvailabilityStatus,
  type IAppUpdate,
  type IBundleUpdate,
  type ICheckPackageAvailability,
  type IClearPackage,
  type IDownloadASC,
  type IDownloadPackage,
  type IInstallPackage,
  type IManualInstallPackage,
  type IUseDownloadProgress,
  type IVerifyASC,
  type IVerifyPackage,
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

type IReactNativeBundleUpdateWithPrune = typeof ReactNativeBundleUpdate & {
  pruneStaleAppVersionBundles(): Promise<number>;
};

const ReactNativeBundleUpdateWithPrune =
  ReactNativeBundleUpdate as IReactNativeBundleUpdateWithPrune;

const clearPackage: IClearPackage = async () => {
  if (!isAppUpdateAvailable) {
    return;
  }
  await runUpdateOperation('cleanup', () =>
    getReactNativeAppUpdate().clearCache(),
  );
};

// Android: wipe the standalone APK cache (cacheDir/apks). iOS exposes a
// native no-op stub. Channels without the AppUpdate native module
// (Google Play / Huawei) resolve immediately.
const clearApkCache = async (): Promise<void> => {
  if (!isAppUpdateAvailable) {
    return;
  }
  await runUpdateOperation('cleanup', () =>
    getReactNativeAppUpdate().clearApkCache(),
  );
};

const downloadPackage: IDownloadPackage = async ({
  downloadUrl,
  latestVersion,
  fileSize,
}) => {
  const nativeDownloadUrl = toNativeString(downloadUrl).trim();
  const nativeLatestVersion = toNativeString(latestVersion).trim();
  if (!nativeDownloadUrl || !nativeLatestVersion) {
    throw createUpdateError({
      code: EUpdateErrorCode.invalidArgument,
      step: 'download',
    });
  }
  await runUpdateOperation('download', () =>
    getReactNativeAppUpdate().downloadAPK({
      downloadUrl: nativeDownloadUrl,
      notificationTitle: 'Downloading',
      fileSize: toNativeNumber(fileSize),
    }),
  );
  return {
    downloadUrl: nativeDownloadUrl,
    latestVersion: nativeLatestVersion,
  };
};

const downloadASC: IDownloadASC = async (params) => {
  const nativeDownloadUrl = toNativeString(params?.downloadUrl).trim();
  if (!nativeDownloadUrl) {
    return;
  }
  await runUpdateOperation('downloadASC', () =>
    getReactNativeAppUpdate().downloadASC({
      downloadUrl: nativeDownloadUrl,
    }),
  );
};

const verifyASC: IVerifyASC = async (params) => {
  const nativeDownloadUrl = toNativeString(params?.downloadUrl).trim();
  if (!nativeDownloadUrl) {
    return;
  }
  await runUpdateOperation('verifyASC', () =>
    getReactNativeAppUpdate().verifyASC({
      downloadUrl: nativeDownloadUrl,
    }),
  );
};

const verifyNativeApk = async (
  nativeUpdate: IReactNativeAppUpdateNative,
  fileParams: { downloadUrl: string },
): Promise<void> => {
  // A fresh native instance has no in-memory ASC or package proof.
  await runUpdateOperation('verifyASC', () =>
    nativeUpdate.verifyASC(fileParams),
  );
  await runUpdateOperation('verifyPackage', () =>
    nativeUpdate.verifyAPK(fileParams),
  );
};

const verifyPackage: IVerifyPackage = async (params) => {
  const nativeDownloadUrl = toNativeString(params?.downloadUrl).trim();
  if (!nativeDownloadUrl) {
    return;
  }
  await runUpdateOperation('verifyPackage', async () => {
    const nativeUpdate = getReactNativeAppUpdate();
    const fileParams = { downloadUrl: nativeDownloadUrl };
    await verifyNativeApk(nativeUpdate, fileParams);
  });
};

// Android will provide a native APK availability check in a follow-up.
// Until then, preserve the existing APK lifecycle and let installAPK remain
// the authoritative native existence check.
const checkPackageAvailability: ICheckPackageAvailability = async () => ({
  status: EAppUpdatePackageAvailabilityStatus.notApplicable,
});

const installPackage: IInstallPackage = async ({
  latestVersion,
  downloadUrl,
}) => {
  defaultLogger.update.app.log('install', latestVersion);
  const nativeLatestVersion = toNativeString(latestVersion).trim();
  if (!nativeLatestVersion) {
    return false;
  }
  await runUpdateOperation('install', async () => {
    const nativeUpdate = getReactNativeAppUpdate();
    const fileParams = { downloadUrl: toNativeString(downloadUrl) };
    await verifyNativeApk(nativeUpdate, fileParams);
    await nativeUpdate.installAPK(fileParams);
  });
  return true;
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
  checkPackageAvailability,
  installPackage,
  manualInstallPackage,
  clearPackage,
  clearApkCache,
};

let bundleInstallPromise: Promise<void> | undefined;
let bundleInstallTarget: string | undefined;
let bundleRestartPromise: Promise<void> | undefined;
let bundleRestartFailed = false;

const restartBundle = async (reason: string) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 2500);
  });
  try {
    await appRestart({ mode: EAppRestartMode.All, reason });
  } catch {
    throw createUpdateError({
      code: EUpdateErrorCode.installFailed,
      step: 'install',
    });
  }
};

export function resetBundleInstallLockForTest() {
  bundleInstallPromise = undefined;
  bundleInstallTarget = undefined;
  bundleRestartPromise = undefined;
  bundleRestartFailed = false;
}

export const BundleUpdate: IBundleUpdate = {
  downloadBundle: async (params) => {
    const result = await runUpdateOperation('download', () =>
      ReactNativeBundleUpdate.downloadBundle({
        downloadUrl: toNativeString(params.downloadUrl),
        latestVersion: toNativeString(params.latestVersion),
        bundleVersion: toNativeString(params.bundleVersion),
        fileSize: toNativeNumber(params.fileSize),
        sha256: toNativeString(params.sha256),
      }),
    );
    return {
      downloadUrl: result.downloadUrl,
      latestVersion: result.latestVersion,
      bundleVersion: result.bundleVersion,
      sha256: result.sha256,
      signature: params.signature,
    };
  },
  verifyBundle: (params) =>
    runUpdateOperation('verifyPackage', () =>
      ReactNativeBundleUpdate.verifyBundle({
        sha256: toNativeString(params?.sha256),
        latestVersion: toNativeString(params?.latestVersion),
        bundleVersion: toNativeString(params?.bundleVersion),
      }),
    ),
  verifyBundleASC: (params) =>
    runUpdateOperation('verifyASC', () =>
      ReactNativeBundleUpdate.verifyBundleASC({
        sha256: toNativeString(params?.sha256),
        latestVersion: toNativeString(params?.latestVersion),
        bundleVersion: toNativeString(params?.bundleVersion),
        signature: toNativeString(params?.signature),
      }),
    ),
  downloadBundleASC: (params) =>
    runUpdateOperation('downloadASC', () =>
      ReactNativeBundleUpdate.downloadBundleASC({
        downloadUrl: toNativeString(params?.downloadUrl),
        signature: toNativeString(params?.signature),
        latestVersion: toNativeString(params?.latestVersion),
        bundleVersion: toNativeString(params?.bundleVersion),
        sha256: toNativeString(params?.sha256),
      }),
    ),
  installBundle: (params) => {
    const target = `${params?.latestVersion ?? ''}:${params?.bundleVersion ?? ''}`;
    if (bundleInstallPromise && bundleInstallTarget !== target) {
      if (!bundleRestartFailed) {
        return Promise.reject(
          new OneKeyLocalError('BUNDLE_INSTALL_TARGET_CONFLICT'),
        );
      }
      // Only replace an installed target after restart has failed.
      bundleInstallPromise = undefined;
    }
    bundleRestartFailed = false;
    if (!bundleInstallPromise) {
      bundleInstallTarget = target;
      bundleInstallPromise = (async () => {
        await runUpdateOperation('install', () =>
          ReactNativeBundleUpdate.installBundle({
            latestVersion: toNativeString(params?.latestVersion),
            bundleVersion: toNativeString(params?.bundleVersion),
            signature: toNativeString(params?.signature),
          }),
        );
      })().catch((error: unknown) => {
        bundleInstallPromise = undefined;
        bundleInstallTarget = undefined;
        throw error;
      });
    }
    return bundleInstallPromise.then(() => {
      if (!bundleRestartPromise) {
        // Same-target retries must not rewrite fallback history.
        bundleRestartPromise = (async () => {
          defaultLogger.app.appUpdate.restartRNApp();
          await restartBundle('ota.installBundle');
        })().catch(() => {
          bundleRestartPromise = undefined;
          bundleRestartFailed = true;
          defaultLogger.app.appUpdate.log(
            'BundleUpdate.installBundle: restart failed',
          );
          appEventBus.emitToSelf({
            type: EAppEventBusNames.BundleUpdateRestartFailed,
            payload: undefined,
          });
        });
      }
      // Do not await restart: it can terminate this runtime without resolving.
    });
  },
  clearBundle: () =>
    runUpdateOperation('cleanup', () => ReactNativeBundleUpdate.clearBundle()),
  clearDownload: () =>
    runUpdateOperation('cleanup', () =>
      ReactNativeBundleUpdate.clearDownload(),
    ),
  resetToBuiltInBundle: async () => {
    await runUpdateOperation('cleanup', () =>
      ReactNativeBundleUpdate.resetToBuiltInBundle(),
    );
  },
  restart: () => restartBundle('ota.restart'),
  isSkipGpgVerificationAllowed: () =>
    Promise.resolve(ReactNativeBundleUpdate.isSkipGpgVerificationAllowed()),
  pruneStaleAppVersionBundles: () =>
    ReactNativeBundleUpdateWithPrune.pruneStaleAppVersionBundles(),
  clearAllJSBundleData: () =>
    runUpdateOperation('cleanup', () =>
      ReactNativeBundleUpdate.clearAllJSBundleData(),
    ),
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
    runUpdateOperation('verifyPackage', () =>
      ReactNativeBundleUpdate.verifyExtractedBundle(appVersion, bundleVersion),
    ),
  listLocalBundles: () => ReactNativeBundleUpdate.listLocalBundles(),
  switchBundle: async (params) => {
    await runUpdateOperation('install', () =>
      ReactNativeBundleUpdate.setCurrentUpdateBundleData(params),
    );
    if (params.appVersion && params.bundleVersion) {
      await restartBundle('ota.switchBundle');
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
