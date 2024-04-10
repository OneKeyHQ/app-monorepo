import platformEnv from '../platformEnv';

import { getVersionAndChangeLog } from './utils';

import type { IAppUpdateInfo, IHandleReleaseInfo } from './type';

export const handleReleaseInfo: IHandleReleaseInfo = (releaseInfo) => {
  const result: IAppUpdateInfo = getVersionAndChangeLog(
    releaseInfo.android,
    releaseInfo.changelog,
  ) as unknown as IAppUpdateInfo;
  if (platformEnv.isNativeAndroidHuawei) {
    result.storeUrl = releaseInfo.android.huawei.url;
  } else if (platformEnv.isNativeAndroidGooglePlay) {
    result.storeUrl = releaseInfo.android.google.url;
  } else {
    result.downloadUrl = releaseInfo.android.url;
  }
  return result;
};
