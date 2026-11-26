import {
  initFirstLaunch,
  isFirstLaunch,
  isFirstLaunchForCurrentAppVersion,
  isFirstLaunchForCurrentBundle,
  resetFirstLaunch,
} from '@onekeyfe/react-native-device-utils/first-launch';

import platformEnv from '../platformEnv';
import { travelModeManager } from '../travelMode';

export function initFirstLaunchForApp(): void {
  initFirstLaunch({
    bundleVersion: platformEnv.bundleVersion,
  });
}

export function isFreshInstallSync(): boolean {
  if (
    !platformEnv.isNativeMainThread ||
    travelModeManager.isMaskingDataSync()
  ) {
    return false;
  }
  try {
    return isFirstLaunch();
  } catch {
    return false;
  }
}

export function resetFirstLaunchState(): boolean {
  return resetFirstLaunch();
}

export {
  isFirstLaunch,
  isFirstLaunchForCurrentAppVersion,
  isFirstLaunchForCurrentBundle,
};
