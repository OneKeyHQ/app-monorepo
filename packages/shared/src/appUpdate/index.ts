import semver from 'semver';

import platformEnv from '../platformEnv';

import { EAppUpdateStatus } from './type';

import type { IAppUpdateInfo } from './type';

export * from './handle';
export * from './type';

export const isNeedUpdate = (latestVersion?: string) =>
  latestVersion && semver.gt(latestVersion, platformEnv.version);

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) =>
  appUpdateInfo.status !== EAppUpdateStatus.done &&
  platformEnv.version === appUpdateInfo.latestVersion;
