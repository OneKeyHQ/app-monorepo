import semver from 'semver';

import { EAppUpdateStatus } from './type';

import type { IAppUpdateInfo } from './type';

export * from './handle';
export * from './type';

export const isNeedUpdate = (currentVersion?: string, latestVersion?: string) =>
  currentVersion && latestVersion && semver.lt(latestVersion, currentVersion);

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) =>
  appUpdateInfo.status !== EAppUpdateStatus.done &&
  appUpdateInfo.version === appUpdateInfo.latestVersion;
