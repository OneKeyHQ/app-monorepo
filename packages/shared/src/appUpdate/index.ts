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
  if (jsBundleVersion) {
    return {
      isNeedUpdate:
        latestVersion &&
        semver.eq(latestVersion, APP_VERSION) &&
        Number(jsBundleVersion) > Number(APP_BUNDLE_VERSION || 0) &&
        status !== EAppUpdateStatus.done,
      fileType: EUpdateFileType.jsBundle,
    };
  }
  return {
    shouldUpdate:
      latestVersion &&
      semver.gt(latestVersion, APP_VERSION) &&
      status !== EAppUpdateStatus.done,
    fileType: EUpdateFileType.appShell,
  };
};

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) =>
  appUpdateInfo.status !== EAppUpdateStatus.done &&
  appUpdateInfo.latestVersion &&
  semver.eq(APP_VERSION, appUpdateInfo.latestVersion);
