import platformEnv from '../platformEnv';

import { getVersionAndChangeLog } from './utils';

import type { IAppUpdateInfo, IHandleReleaseInfo } from './type';

export const handleReleaseInfo: IHandleReleaseInfo = (releaseInfo) => {
  const result: IAppUpdateInfo = getVersionAndChangeLog(
    releaseInfo.desktop,
    releaseInfo.changelog,
  ) as unknown as IAppUpdateInfo;
  result.storeUrl = releaseInfo.desktop.mas.url;
  return result;
};
