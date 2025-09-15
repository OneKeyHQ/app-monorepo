import semver from 'semver';

import platformEnv from '../platformEnv';

import { EAppUpdateStatus, EUpdateFileType } from './type';

import type { IAppUpdateInfo } from './type';

export * from './utils';
export * from './type';

const APP_VERSION = platformEnv.version ?? '1.0.0';
const APP_BUNDLE_VERSION = platformEnv.bundleVersion ?? '1.0.0';

interface IIsNeedUpdateParams {
  latestVersion?: string;
  jsBundleVersion?: string;
  status?: EAppUpdateStatus;
}

export const isNeedUpdate: (params: IIsNeedUpdateParams) => {
  shouldUpdate: boolean;
  fileType: EUpdateFileType;
} = ({ latestVersion, jsBundleVersion, status }: IIsNeedUpdateParams) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    jsBundleVersion &&
    latestVersion &&
    semver.eq(latestVersion, APP_VERSION)
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

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    appUpdateInfo.jsBundleVersion &&
    appUpdateInfo.latestVersion &&
    semver.eq(appUpdateInfo.latestVersion, APP_VERSION)
  ) {
    return (
      appUpdateInfo.status !== EAppUpdateStatus.done &&
      appUpdateInfo.jsBundleVersion === APP_BUNDLE_VERSION
    );
  }
  return (
    appUpdateInfo.status !== EAppUpdateStatus.done &&
    appUpdateInfo.latestVersion &&
    semver.eq(APP_VERSION, appUpdateInfo.latestVersion)
  );
};
