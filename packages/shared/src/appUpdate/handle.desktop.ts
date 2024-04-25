import platformEnv from '../platformEnv';

import { getVersion } from './utils';

import type { IAppUpdateInfo, IHandleReleaseInfo } from './type';

export const handleReleaseInfo: IHandleReleaseInfo = (releaseInfo) => {
  const result: IAppUpdateInfo = getVersion(
    releaseInfo.desktop,
  ) as unknown as IAppUpdateInfo;
  if (platformEnv.isDesktopLinux) {
    result.downloadUrl = releaseInfo.desktop.linux;
  } else if (platformEnv.isDesktopLinuxSnap) {
    result.storeUrl = releaseInfo.desktop.snapStore.url;
  } else if (platformEnv.isDesktopMac) {
    result.downloadUrl = releaseInfo.desktop.macX64;
  } else if (platformEnv.isDesktopMacArm64) {
    result.downloadUrl = releaseInfo.desktop.macARM;
  } else if (platformEnv.isMas) {
    result.storeUrl = releaseInfo.desktop.mas.url;
  } else if (platformEnv.isDesktopWin) {
    result.downloadUrl = releaseInfo.desktop.win;
  } else if (platformEnv.isDesktopWinMsStore) {
    result.storeUrl = releaseInfo.desktop.msStore.url;
  }
  return result;
};
