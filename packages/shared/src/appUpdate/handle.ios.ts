import { getVersion } from './utils';

import type { IHandleReleaseInfo } from './type';

export const handleReleaseInfo: IHandleReleaseInfo = (releaseInfo) => ({
  ...getVersion(releaseInfo.ios),
  storeUrl: releaseInfo.ios.url,
});
