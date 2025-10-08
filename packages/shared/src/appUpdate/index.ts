import semver from 'semver';

import platformEnv from '../platformEnv';

import { EAppUpdateStatus, EUpdateFileType } from './type';

import type { IAppUpdateInfo } from './type';

export * from './utils';
export * from './type';

const APP_VERSION = platformEnv.version ?? '1.0.0';
const APP_BUNDLE_VERSION = platformEnv.bundleVersion ?? 1;

interface IIsNeedUpdateParams {
  latestVersion?: string;
  jsBundleVersion?: string;
  status?: EAppUpdateStatus;
}

export const getUpdateFileType: (
  params: IIsNeedUpdateParams,
) => EUpdateFileType = ({
  latestVersion,
  jsBundleVersion,
}: IIsNeedUpdateParams) => {
  if (!latestVersion || !jsBundleVersion) {
    return EUpdateFileType.appShell;
  }
  if (
    latestVersion &&
    semver.gte(latestVersion, APP_VERSION) &&
    jsBundleVersion &&
    jsBundleVersion !== APP_BUNDLE_VERSION
  ) {
    return EUpdateFileType.jsBundle;
  }
  return EUpdateFileType.appShell;
};

export const gtVersion = (appVersion?: string, bundleVersion?: string) => {
  if (!appVersion) {
    return false;
  }
  if (bundleVersion) {
    return (
      semver.gte(appVersion ?? '', APP_VERSION) &&
      Number(bundleVersion) > Number(APP_BUNDLE_VERSION)
    );
  }
  return semver.gt(appVersion ?? '', APP_VERSION);
};

export const isNeedUpdate: (params: IIsNeedUpdateParams) => {
  shouldUpdate: boolean;
  fileType: EUpdateFileType;
} = ({ latestVersion, jsBundleVersion, status }: IIsNeedUpdateParams) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    jsBundleVersion &&
    latestVersion &&
    semver.gte(latestVersion, APP_VERSION)
  ) {
    return {
      shouldUpdate: !!(
        latestVersion &&
        Number(jsBundleVersion) > Number(APP_BUNDLE_VERSION || 0) &&
        status !== EAppUpdateStatus.done
      ),
      fileType: EUpdateFileType.jsBundle,
    };
  }
  return {
    shouldUpdate: !!(
      latestVersion &&
      semver.gt(latestVersion, APP_VERSION) &&
      status !== EAppUpdateStatus.done
    ),
    fileType: EUpdateFileType.appShell,
  };
};

export const displayAppUpdateVersion = (
  appUpdateInfo: IAppUpdateInfo | undefined,
) => {
  if (!appUpdateInfo) {
    return APP_VERSION;
  }
  const { latestVersion } = appUpdateInfo;
  if (!latestVersion) {
    return APP_VERSION;
  }
  return latestVersion === APP_VERSION
    ? `${latestVersion}(${appUpdateInfo.jsBundleVersion ?? 1})`
    : latestVersion;
};

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    appUpdateInfo.jsBundleVersion &&
    appUpdateInfo.latestVersion &&
    semver.gte(APP_VERSION, appUpdateInfo.latestVersion)
  ) {
    return (
      appUpdateInfo.status !== EAppUpdateStatus.done &&
      Number(appUpdateInfo.jsBundleVersion) > Number(APP_BUNDLE_VERSION)
    );
  }
  return (
    appUpdateInfo.status !== EAppUpdateStatus.done &&
    appUpdateInfo.latestVersion &&
    semver.gt(APP_VERSION, appUpdateInfo.latestVersion)
  );
};
