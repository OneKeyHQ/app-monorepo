import platformEnv from '../platformEnv';

import { getVersion } from './utils';

import type { IAppUpdateInfo, IHandleReleaseInfo } from './type';

export const handleReleaseInfo: IHandleReleaseInfo = (releaseInfo) => {
  const result: IAppUpdateInfo = getVersion(
    releaseInfo.ext,
  ) as unknown as IAppUpdateInfo;
  if (platformEnv.isExtChrome) {
    result.storeUrl = releaseInfo.ext.chrome;
  } else if (platformEnv.isExtFirefox) {
    result.storeUrl = releaseInfo.ext.firefox;
  } else {
    result.storeUrl = releaseInfo.ext.edge;
  }
  return result;
};
