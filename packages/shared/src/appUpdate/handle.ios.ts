import { getVersionAndChangeLog } from './utils';

import type { IHandleReleaseInfo } from './type';

export const handleReleaseInfo: IHandleReleaseInfo = (releaseInfo) => ({
  ...getVersionAndChangeLog(releaseInfo.ios, releaseInfo.changelog),
  storeUrl: releaseInfo.ios.url,
});
